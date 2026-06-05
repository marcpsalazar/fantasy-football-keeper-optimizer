"""One-time backfill: match existing players to Sleeper by name+position,
then store the Sleeper CDN image URL and external_id.

Run from apps/api/:
    .venv/bin/python backfill_player_images.py [--dry-run]
"""

import argparse
import json
import sys
import urllib.error
import urllib.request

from sqlmodel import Session, select

from app.db.session import engine
from app.models.player import Player

SLEEPER_PLAYERS_URL = "https://api.sleeper.app/v1/players/nfl"
SLEEPER_THUMB_URL = "https://sleepercdn.com/content/nfl/players/thumb/{}.jpg"

_POSITION_MAP = {
    "QB": "QB", "RB": "RB", "WR": "WR", "TE": "TE",
    "K": "K", "DEF": "DST", "DST": "DST",
}
_VALID = frozenset({"QB", "RB", "WR", "TE", "K", "DST"})


def _fetch_sleeper_players() -> dict:
    print("Fetching Sleeper player database…")
    req = urllib.request.Request(
        SLEEPER_PLAYERS_URL,
        headers={"User-Agent": "keeper-optimizer/1.0", "Accept": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


_SUFFIX_RE = __import__("re").compile(
    r"\s+(jr\.?|sr\.?|ii|iii|iv|v|vi)$", __import__("re").IGNORECASE
)


def _strip_suffix(name: str) -> str:
    """Remove generational suffixes so 'James Cook III' matches 'James Cook'."""
    return _SUFFIX_RE.sub("", name).strip()


def _build_name_lookup(players_db: dict) -> dict[str, list[tuple[str, str]]]:
    """Build (normalized_name, position) → [(sleeper_id, image_url)] lookup.

    Indexes each player under both their full name and their suffix-stripped
    name so that DB entries like 'James Cook III' match Sleeper's 'James Cook'.
    """
    lookup: dict[str, list[tuple[str, str]]] = {}
    for pid, p in players_db.items():
        if not isinstance(p, dict):
            continue
        first = (p.get("first_name") or "").strip()
        last = (p.get("last_name") or "").strip()
        full = p.get("full_name") or f"{first} {last}".strip()
        if not full:
            continue
        raw_pos = str(p.get("position") or "")
        pos = _POSITION_MAP.get(raw_pos.upper())
        if pos not in _VALID:
            continue
        entry = (str(pid), SLEEPER_THUMB_URL.format(pid))
        for name_variant in {full.lower(), _strip_suffix(full).lower()}:
            key = f"{name_variant}|{pos}"
            lookup.setdefault(key, []).append(entry)
    return lookup


def main(dry_run: bool = False) -> None:
    players_db = _fetch_sleeper_players()
    print(f"  {len(players_db)} Sleeper players loaded.")

    lookup = _build_name_lookup(players_db)
    print(f"  {len(lookup)} unique name+position entries in lookup.")

    updated = 0
    skipped_ambiguous = 0
    skipped_no_match = 0

    with Session(engine) as session:
        db_players = session.exec(
            select(Player).where(Player.image_url.is_(None))  # type: ignore[union-attr]
        ).all()
        print(f"  {len(db_players)} players in DB with no image_url.")

        for player in db_players:
            # Try exact name first, then suffix-stripped fallback
            key = f"{player.full_name.lower()}|{player.position}"
            if key not in lookup:
                key = f"{_strip_suffix(player.full_name).lower()}|{player.position}"
            matches = lookup.get(key, [])
            if not matches:
                skipped_no_match += 1
                continue
            if len(matches) > 1:
                # Prefer the match where nfl_team also lines up, if possible.
                team_matches = [
                    (pid, url) for pid, url in matches
                    if players_db[pid].get("team") == player.nfl_team
                ]
                if len(team_matches) == 1:
                    matches = team_matches
                else:
                    skipped_ambiguous += 1
                    continue

            sleeper_id, image_url = matches[0]
            print(f"  {'[DRY RUN] ' if dry_run else ''}Updating {player.full_name} ({player.position}) "
                  f"→ Sleeper ID {sleeper_id}")
            if not dry_run:
                player.image_url = image_url
                if player.external_id is None:
                    player.external_id = sleeper_id
            updated += 1

        if not dry_run:
            session.commit()

    print(f"\nDone. Updated: {updated}  No match: {skipped_no_match}  Ambiguous: {skipped_ambiguous}")
    if dry_run:
        print("(dry run — no changes written)")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    try:
        main(dry_run=args.dry_run)
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        sys.exit(1)
