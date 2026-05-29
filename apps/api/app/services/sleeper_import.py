from __future__ import annotations

import json
import urllib.error
import urllib.request
import uuid
from dataclasses import dataclass, field
from typing import Any

from sqlmodel import Session, select

from app.models import DraftPick, FinalRosterEntry, League, Player, Team

SLEEPER_BASE = "https://api.sleeper.app/v1"

_POSITION_MAP: dict[str, str] = {
    "QB": "QB", "RB": "RB", "WR": "WR", "TE": "TE",
    "K": "K", "DEF": "DST", "DST": "DST",
}
_VALID_POSITIONS = frozenset({"QB", "RB", "WR", "TE", "K", "DST"})


class SleeperAPIError(Exception):
    pass


@dataclass
class SleeperPreviewResult:
    season_year: int
    teams: list[dict[str, Any]]
    draft_picks_count: int
    roster_entries_count: int
    warnings: list[str]
    errors: list[str]
    valid: bool


@dataclass
class SleeperImportResult:
    season_year: int
    teams_upserted: int
    draft_picks_upserted: int
    roster_entries_upserted: int
    warnings: list[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Sleeper HTTP helpers
# ---------------------------------------------------------------------------

def _fetch_json(url: str) -> Any:
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "keeper-optimizer/1.0", "Accept": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        raise SleeperAPIError(f"Sleeper API returned HTTP {exc.code}") from exc
    except (urllib.error.URLError, OSError) as exc:
        raise SleeperAPIError(f"Could not reach Sleeper API: {exc}") from exc
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise SleeperAPIError(f"Invalid JSON from Sleeper API: {exc}") from exc


def _normalize_position(pos: str | None) -> str | None:
    if not pos:
        return None
    return _POSITION_MAP.get(pos.upper())


def _fetch_league_data(
    sleeper_league_id: str,
) -> tuple[dict, list[dict], list[dict], list[dict], dict]:
    """Returns (league_info, users, rosters, picks, players_db)."""
    league_info = _fetch_json(f"{SLEEPER_BASE}/league/{sleeper_league_id}")
    users = _fetch_json(f"{SLEEPER_BASE}/league/{sleeper_league_id}/users") or []
    rosters = _fetch_json(f"{SLEEPER_BASE}/league/{sleeper_league_id}/rosters") or []
    drafts = _fetch_json(f"{SLEEPER_BASE}/league/{sleeper_league_id}/drafts") or []

    picks: list[dict] = []
    valid_drafts = [d for d in drafts if isinstance(d, dict) and d.get("draft_id")]
    # Prefer the most recent complete draft; fall back to any draft.
    sorted_drafts = sorted(
        valid_drafts,
        key=lambda d: (d.get("status") == "complete", d.get("draft_id", "")),
        reverse=True,
    )
    for draft in sorted_drafts:
        draft_picks = _fetch_json(f"{SLEEPER_BASE}/draft/{draft['draft_id']}/picks") or []
        if draft_picks:
            picks = draft_picks
            break

    players_db = _fetch_json(f"{SLEEPER_BASE}/players/nfl") or {}
    return league_info, users, rosters, picks, players_db


# ---------------------------------------------------------------------------
# Mapping helpers
# ---------------------------------------------------------------------------

def _build_player_lookup(players_db: dict[str, Any]) -> dict[str, dict[str, str | None]]:
    """Returns sleeper_player_id → {full_name, position, nfl_team}."""
    result: dict[str, dict[str, str | None]] = {}
    for pid, p in players_db.items():
        if not isinstance(p, dict):
            continue
        first = (p.get("first_name") or "").strip()
        last = (p.get("last_name") or "").strip()
        full_name = p.get("full_name") or f"{first} {last}".strip()
        if not full_name:
            continue
        pos = _normalize_position(str(p.get("position") or ""))
        if not pos:
            continue
        result[str(pid)] = {
            "full_name": full_name,
            "position": pos,
            "nfl_team": p.get("team") or None,
        }
    return result


def _build_roster_team_map(
    users: list[dict], rosters: list[dict]
) -> dict[int, dict[str, str | None]]:
    """Maps roster_id → {team_name, owner_name}."""
    user_map = {str(u.get("user_id", "")): u for u in users if u.get("user_id")}
    result: dict[int, dict[str, str | None]] = {}
    for roster in rosters:
        roster_id = int(roster.get("roster_id") or 0)
        owner_id = str(roster.get("owner_id") or "")
        user = user_map.get(owner_id)
        if user:
            metadata = user.get("metadata") or {}
            team_name = (
                metadata.get("team_name")
                or user.get("display_name")
                or f"Team {roster_id}"
            )
            owner_name = user.get("display_name") or None
        else:
            team_name = f"Team {roster_id}"
            owner_name = None
        result[roster_id] = {"team_name": str(team_name), "owner_name": owner_name}
    return result


# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------

def _get_or_create_player(
    session: Session,
    sleeper_id: str,
    full_name: str,
    position: str,
    nfl_team: str | None,
) -> Player:
    # Exact Sleeper ID match (fastest path after first import).
    player = session.exec(
        select(Player).where(Player.external_id == sleeper_id)
    ).first()
    if player is not None:
        if nfl_team and player.nfl_team != nfl_team:
            player.nfl_team = nfl_team
        return player

    # Name + position fallback (matches rows created by CSV import).
    candidates = session.exec(
        select(Player).where(Player.full_name == full_name, Player.position == position)
    ).all()
    player = (
        next((p for p in candidates if p.nfl_team == nfl_team), None)
        or next((p for p in candidates if p.nfl_team is None), None)
        or (candidates[0] if candidates else None)
    )
    if player is not None:
        player.external_id = sleeper_id
        if nfl_team and player.nfl_team != nfl_team:
            player.nfl_team = nfl_team
        return player

    player = Player(
        full_name=full_name,
        position=position,
        nfl_team=nfl_team,
        external_id=sleeper_id,
    )
    session.add(player)
    session.flush()
    return player


def _get_or_create_team(
    session: Session,
    league: League,
    roster_id: int,
    team_name: str,
    owner_name: str | None,
) -> Team:
    # Prefer draft_slot match (roster_id == draft_slot in Sleeper).
    team = session.exec(
        select(Team).where(Team.league_id == league.id, Team.draft_slot == roster_id)
    ).first()
    if team is not None:
        return team

    # Fall back to name match.
    team = session.exec(
        select(Team).where(Team.league_id == league.id, Team.name == team_name)
    ).first()
    if team is not None:
        team.draft_slot = roster_id
        return team

    team = Team(
        league_id=league.id,
        name=team_name,
        owner_name=owner_name,
        draft_slot=roster_id,
    )
    session.add(team)
    session.flush()
    return team


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def preview_sleeper_import(
    session: Session,
    league_id: uuid.UUID,
    sleeper_league_id: str,
    season_year: int | None = None,
) -> SleeperPreviewResult:
    league = session.get(League, league_id)
    if league is None:
        return SleeperPreviewResult(
            season_year=season_year or 0,
            teams=[], draft_picks_count=0, roster_entries_count=0,
            warnings=[], errors=["League not found."], valid=False,
        )

    try:
        league_info, users, rosters, picks, players_db = _fetch_league_data(sleeper_league_id)
    except SleeperAPIError as exc:
        return SleeperPreviewResult(
            season_year=season_year or 0,
            teams=[], draft_picks_count=0, roster_entries_count=0,
            warnings=[], errors=[str(exc)], valid=False,
        )

    resolved_year = season_year or _parse_season(league_info.get("season"), league.season_year)
    player_lookup = _build_player_lookup(players_db)
    team_info_map = _build_roster_team_map(users, rosters)
    warnings: list[str] = []

    # Teams preview.
    teams_preview: list[dict[str, Any]] = []
    for roster in rosters:
        roster_id = int(roster.get("roster_id") or 0)
        info = team_info_map.get(roster_id, {"team_name": f"Team {roster_id}", "owner_name": None})
        valid_players = sum(
            1 for pid in (roster.get("players") or [])
            if (lk := player_lookup.get(str(pid))) and lk["position"] in _VALID_POSITIONS
        )
        teams_preview.append({
            "roster_id": roster_id,
            "team_name": info["team_name"],
            "owner_name": info["owner_name"],
            "player_count": valid_players,
        })

    # Draft picks.
    valid_picks = 0
    unmapped_names: list[str] = []
    for pick in picks:
        pid = str(pick.get("player_id") or "")
        if not pid:
            continue
        info = player_lookup.get(pid)
        if info and info["position"] in _VALID_POSITIONS:
            valid_picks += 1
        elif not info:
            meta = pick.get("metadata") or {}
            name = f"{meta.get('first_name', '')} {meta.get('last_name', '')}".strip()
            if name:
                unmapped_names.append(name)

    if unmapped_names:
        sample = ", ".join(unmapped_names[:5])
        extra = f" and {len(unmapped_names) - 5} more" if len(unmapped_names) > 5 else ""
        warnings.append(
            f"{len(unmapped_names)} pick(s) not found in Sleeper player DB and will be skipped: {sample}{extra}."
        )

    # Roster entries.
    valid_entries = 0
    unmapped_roster = 0
    for roster in rosters:
        for pid in roster.get("players") or []:
            info = player_lookup.get(str(pid))
            if info and info["position"] in _VALID_POSITIONS:
                valid_entries += 1
            elif not info:
                unmapped_roster += 1

    if unmapped_roster:
        warnings.append(
            f"{unmapped_roster} roster player(s) not found in Sleeper player DB (possibly rookies or practice-squad)."
        )

    if not rosters:
        return SleeperPreviewResult(
            season_year=resolved_year,
            teams=[], draft_picks_count=0, roster_entries_count=0,
            warnings=[], errors=["No rosters returned — verify the Sleeper league ID."], valid=False,
        )

    return SleeperPreviewResult(
        season_year=resolved_year,
        teams=teams_preview,
        draft_picks_count=valid_picks,
        roster_entries_count=valid_entries,
        warnings=warnings,
        errors=[],
        valid=True,
    )


def commit_sleeper_import(
    session: Session,
    league_id: uuid.UUID,
    sleeper_league_id: str,
    season_year: int | None = None,
) -> SleeperImportResult:
    league = session.get(League, league_id)
    if league is None:
        raise ValueError(f"League {league_id} not found")

    league_info, users, rosters, picks, players_db = _fetch_league_data(sleeper_league_id)
    resolved_year = season_year or _parse_season(league_info.get("season"), league.season_year)
    player_lookup = _build_player_lookup(players_db)
    team_info_map = _build_roster_team_map(users, rosters)
    warnings: list[str] = []

    # Upsert teams.
    roster_to_team: dict[int, Team] = {}
    for roster in rosters:
        roster_id = int(roster.get("roster_id") or 0)
        info = team_info_map.get(roster_id, {"team_name": f"Team {roster_id}", "owner_name": None})
        team = _get_or_create_team(session, league, roster_id, info["team_name"], info["owner_name"])
        roster_to_team[roster_id] = team

    num_teams = len(rosters) or 12

    # Upsert draft picks.
    picks_upserted = 0
    for pick in picks:
        pid = str(pick.get("player_id") or "")
        roster_id = int(pick.get("roster_id") or 0)
        pick_no = int(pick.get("pick_no") or 0)
        round_number = int(pick.get("round") or 0)

        if not pid or not pick_no or not round_number:
            continue

        info = player_lookup.get(pid)
        if not info or info["position"] not in _VALID_POSITIONS:
            continue

        team = roster_to_team.get(roster_id)
        if team is None:
            continue

        player = _get_or_create_player(
            session, pid, info["full_name"], info["position"], info.get("nfl_team"),
        )
        pick_in_round = pick_no - (round_number - 1) * num_teams

        existing = session.exec(
            select(DraftPick).where(
                DraftPick.league_id == league.id,
                DraftPick.season_year == resolved_year,
                DraftPick.overall_pick == pick_no,
            )
        ).first()
        if existing is None:
            existing = DraftPick(
                league_id=league.id,
                team_id=team.id,
                player_id=player.id,
                season_year=resolved_year,
                round=round_number,
                overall_pick=pick_no,
                pick_in_round=pick_in_round,
                position=info["position"],
            )
            session.add(existing)
        else:
            existing.team_id = team.id
            existing.player_id = player.id
            existing.round = round_number
            existing.pick_in_round = pick_in_round
            existing.position = info["position"]

        session.flush()
        picks_upserted += 1

    # Upsert final roster entries.
    entries_upserted = 0
    for roster in rosters:
        roster_id = int(roster.get("roster_id") or 0)
        team = roster_to_team.get(roster_id)
        if team is None:
            continue

        starters = {str(p) for p in (roster.get("starters") or [])}
        reserve = {str(p) for p in (roster.get("reserve") or [])}

        for pid in roster.get("players") or []:
            info = player_lookup.get(str(pid))
            if not info or info["position"] not in _VALID_POSITIONS:
                continue

            player = _get_or_create_player(
                session, str(pid), info["full_name"], info["position"], info.get("nfl_team"),
            )

            if str(pid) in reserve:
                roster_status = "IR"
            elif str(pid) in starters:
                roster_status = "Starter"
            else:
                roster_status = "Bench"

            existing_entry = session.exec(
                select(FinalRosterEntry).where(
                    FinalRosterEntry.league_id == league.id,
                    FinalRosterEntry.team_id == team.id,
                    FinalRosterEntry.player_id == player.id,
                    FinalRosterEntry.season_year == resolved_year,
                )
            ).first()
            if existing_entry is None:
                existing_entry = FinalRosterEntry(
                    league_id=league.id,
                    team_id=team.id,
                    player_id=player.id,
                    season_year=resolved_year,
                    position=info["position"],
                    roster_status=roster_status,
                )
                session.add(existing_entry)
            else:
                existing_entry.position = info["position"]
                existing_entry.roster_status = roster_status

            session.flush()
            entries_upserted += 1

    session.commit()

    return SleeperImportResult(
        season_year=resolved_year,
        teams_upserted=len(roster_to_team),
        draft_picks_upserted=picks_upserted,
        roster_entries_upserted=entries_upserted,
        warnings=warnings,
    )


def _parse_season(season_str: Any, fallback: int) -> int:
    try:
        return int(season_str)
    except (TypeError, ValueError):
        return fallback
