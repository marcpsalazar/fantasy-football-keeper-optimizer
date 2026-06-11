"""Yahoo Fantasy Sports league import service.

Mirrors the Sleeper import pattern: preview (read-only) + commit (upsert).

Yahoo API quirks handled here:
  - Numeric-keyed collections: {"0": {...}, "1": {...}, "count": N}
  - Team metadata is a list of single-key dicts that must be flattened
  - Draft results only contain player_key; player names need separate batch calls
  - PPR detection via reception stat modifier (stat_id 11)
  - Roster positions come from a sub-resource endpoint
"""

from __future__ import annotations

import re
import uuid
from dataclasses import dataclass
from typing import Any, Iterator

from sqlmodel import Session, select

from app.models import DraftPick, FinalRosterEntry, League, Player, Team
from app.schemas.yahoo_import import (
    YahooImportResult,
    YahooLeagueSettingsPreview,
    YahooPreviewResult,
    YahooPreviewTeam,
    YahooUserLeague,
)
from app.services.yahoo_oauth import YahooAPIError, yahoo_get

_VALID_POSITIONS = frozenset({"QB", "RB", "WR", "TE", "K", "DST"})

_SUFFIX_RE = re.compile(r"\s+(jr\.?|sr\.?|ii|iii|iv|v|vi)$", re.IGNORECASE)


def _strip_suffix(name: str) -> str:
    return _SUFFIX_RE.sub("", name).strip()

# Yahoo selected_position values that count as starter slots
_STARTER_POSITIONS = frozenset({
    "QB", "WR", "RB", "TE", "K", "DEF", "DST",
    "FLEX", "W/R", "W/T", "R/T", "W/R/T", "W/R/T/Q",
    "SUPER_FLEX", "OP",
})

# Yahoo position → app position mapping
_POSITION_MAP: dict[str, str] = {
    "QB": "QB", "RB": "RB", "WR": "WR", "TE": "TE",
    "K": "K", "DEF": "DST", "DST": "DST", "PK": "K",
}

# Yahoo stat ID for receptions (used to detect PPR scoring)
_RECEPTIONS_STAT_ID = "11"


@dataclass
class _RawLeagueData:
    league_key: str
    league_name: str
    num_teams: int
    season: str
    yahoo_scoring_type: str
    yahoo_draft_type: str
    # parsed from settings sub-resource
    roster_positions: list[dict]   # [{"position": "QB", "count": 1}, ...]
    reception_points: float        # 0 = standard, 0.5 = half PPR, 1.0 = full PPR
    has_super_flex: bool
    # raw team list
    teams: list[dict]              # [{"team_key", "name", "owner_name", "draft_position"}, ...]
    # raw draft picks
    draft_picks: list[dict]        # [{"overall_pick", "round", "team_key", "player_key"}, ...]
    # player_key → {full_name, position, nfl_team}
    player_info: dict[str, dict]
    # team_key → [{player_key, selected_position}, ...]
    rosters: dict[str, list[dict]]


# ---------------------------------------------------------------------------
# Yahoo JSON structure helpers
# ---------------------------------------------------------------------------

def _iter_yahoo_collection(obj: dict) -> Iterator[Any]:
    """Iterate items in a numeric-keyed Yahoo collection {"0": x, "1": x, "count": N}."""
    count = int(obj.get("count", 0))
    for i in range(count):
        yield obj[str(i)]


def _flatten_team_meta(meta_list: list) -> dict:
    """Yahoo team[0] is a list of single-key dicts; merge them into one dict."""
    result: dict = {}
    for item in meta_list:
        if isinstance(item, dict):
            result.update(item)
    return result


def _get_manager_nickname(team_flat: dict) -> str | None:
    managers = team_flat.get("managers")
    if not managers:
        return None
    if isinstance(managers, list) and managers:
        mgr = managers[0]
        if isinstance(mgr, dict) and "manager" in mgr:
            return mgr["manager"].get("nickname") or mgr["manager"].get("name")
        if isinstance(mgr, dict):
            return mgr.get("nickname") or mgr.get("name")
    return None


def _normalize_position(pos: str | None) -> str | None:
    if not pos:
        return None
    return _POSITION_MAP.get(pos.upper())


# ---------------------------------------------------------------------------
# Yahoo API fetch helpers
# ---------------------------------------------------------------------------

def _fetch_league_info(league_key: str, access_token: str) -> dict:
    data = yahoo_get(f"league/{league_key}", access_token)
    league_raw = data["fantasy_content"]["league"]
    # league_raw is [metadata_dict, sub_resources_dict]
    if isinstance(league_raw, list) and len(league_raw) >= 1:
        return league_raw[0]
    raise YahooAPIError(f"Unexpected league response structure for {league_key}")


def _fetch_league_settings(league_key: str, access_token: str) -> tuple[list[dict], float]:
    """Returns (roster_positions, reception_points).

    roster_positions: [{"position": "QB", "count": 1}, ...]
    reception_points: PPR modifier for receptions (stat_id 11).
    """
    data = yahoo_get(f"league/{league_key}/settings", access_token)
    league_raw = data["fantasy_content"]["league"]
    sub = league_raw[1] if isinstance(league_raw, list) and len(league_raw) > 1 else {}
    settings_list = sub.get("settings", [{}])
    settings = settings_list[0] if settings_list else {}

    # Roster positions
    roster_positions: list[dict] = []
    for rp_item in settings.get("roster_positions", []):
        rp = rp_item.get("roster_position", {})
        pos = rp.get("position") or rp.get("abbreviation")
        count = int(rp.get("count", 0))
        if pos and count:
            roster_positions.append({"position": pos, "count": count})

    # Reception PPR detection via stat_modifiers
    reception_points = 0.0
    for cat_item in settings.get("stat_categories", {}).get("stats", {}).get("stat", []):
        if str(cat_item.get("stat_id", "")) == _RECEPTIONS_STAT_ID:
            try:
                reception_points = float(cat_item.get("bonuses", {}).get("bonus", 0) or 0)
            except (TypeError, ValueError):
                pass
            break

    # Try stat_modifiers if stat_categories didn't have it
    if reception_points == 0.0:
        for mod in settings.get("stat_modifiers", {}).get("stats", {}).get("stat", []):
            if str(mod.get("stat_id", "")) == _RECEPTIONS_STAT_ID:
                try:
                    reception_points = float(mod.get("value", 0) or 0)
                except (TypeError, ValueError):
                    pass
                break

    return roster_positions, reception_points


def _fetch_teams(league_key: str, access_token: str) -> list[dict]:
    """Returns list of {team_key, name, owner_name, draft_position}."""
    data = yahoo_get(f"league/{league_key}/teams", access_token)
    league_raw = data["fantasy_content"]["league"]
    sub = league_raw[1] if isinstance(league_raw, list) and len(league_raw) > 1 else {}
    teams_obj = sub.get("teams", {})

    result = []
    for team_wrapper in _iter_yahoo_collection(teams_obj):
        team_list = team_wrapper.get("team", [])
        if not team_list:
            continue
        # team[0] is a list of single-key dicts OR a dict
        meta_raw = team_list[0]
        if isinstance(meta_raw, list):
            flat = _flatten_team_meta(meta_raw)
        elif isinstance(meta_raw, dict):
            flat = meta_raw
        else:
            continue

        result.append({
            "team_key": flat.get("team_key", ""),
            "name": flat.get("name", ""),
            "owner_name": _get_manager_nickname(flat),
            "draft_position": int(flat.get("draft_position") or 0),
        })
    return result


def _fetch_draft_picks(league_key: str, access_token: str) -> list[dict]:
    """Returns list of {overall_pick, round, team_key, player_key}."""
    data = yahoo_get(f"league/{league_key}/draftresults", access_token)
    league_raw = data["fantasy_content"]["league"]
    sub = league_raw[1] if isinstance(league_raw, list) and len(league_raw) > 1 else {}
    dr_obj = sub.get("draft_results", {})

    result = []
    for item in _iter_yahoo_collection(dr_obj):
        dr = item.get("draft_result", {})
        pick = dr.get("pick")
        rd = dr.get("round")
        team_key = dr.get("team_key", "")
        player_key = dr.get("player_key", "")
        if pick and rd and team_key and player_key:
            result.append({
                "overall_pick": int(pick),
                "round": int(rd),
                "team_key": team_key,
                "player_key": player_key,
            })
    return result


def _fetch_rosters(league_key: str, access_token: str) -> dict[str, list[dict]]:
    """Returns {team_key: [{player_key, selected_position}, ...]}."""
    data = yahoo_get(f"league/{league_key}/teams;out=roster", access_token)
    league_raw = data["fantasy_content"]["league"]
    sub = league_raw[1] if isinstance(league_raw, list) and len(league_raw) > 1 else {}
    teams_obj = sub.get("teams", {})

    result: dict[str, list[dict]] = {}
    for team_wrapper in _iter_yahoo_collection(teams_obj):
        team_list = team_wrapper.get("team", [])
        if not team_list:
            continue
        meta_raw = team_list[0]
        if isinstance(meta_raw, list):
            flat = _flatten_team_meta(meta_raw)
        elif isinstance(meta_raw, dict):
            flat = meta_raw
        else:
            continue
        team_key = flat.get("team_key", "")
        if not team_key:
            continue

        players: list[dict] = []
        # roster is team_list[1]["roster"]["players"] OR flat may have it
        if len(team_list) > 1:
            roster_data = team_list[1] if isinstance(team_list[1], dict) else {}
            roster = roster_data.get("roster", {})
            players_obj = roster.get("players", {})
            for pl_wrapper in _iter_yahoo_collection(players_obj):
                pl_list = pl_wrapper.get("player", [])
                if not pl_list:
                    continue
                pl_meta = pl_list[0]
                if isinstance(pl_meta, list):
                    pl_flat = _flatten_team_meta(pl_meta)
                elif isinstance(pl_meta, dict):
                    pl_flat = pl_meta
                else:
                    continue
                # selected_position is in pl_list[1] or pl_flat
                selected_pos = None
                if len(pl_list) > 1 and isinstance(pl_list[1], dict):
                    sp = pl_list[1].get("selected_position", [{}])
                    if isinstance(sp, list) and sp:
                        selected_pos = sp[0].get("position")
                    elif isinstance(sp, dict):
                        selected_pos = sp.get("position")
                players.append({
                    "player_key": pl_flat.get("player_key", ""),
                    "selected_position": selected_pos or "BN",
                })
        result[team_key] = players
    return result


def _resolve_player_names(
    player_keys: list[str],
    access_token: str,
) -> dict[str, dict]:
    """Batch-fetch player info for a list of player_keys.

    Yahoo allows max 25 player keys per request.
    Returns {player_key: {full_name, position, nfl_team}}.
    """
    result: dict[str, dict] = {}
    batch_size = 25
    for i in range(0, len(player_keys), batch_size):
        batch = player_keys[i : i + batch_size]
        keys_param = ",".join(batch)
        try:
            data = yahoo_get(f"players;player_keys={keys_param}", access_token)
        except YahooAPIError:
            continue  # Skip failed batches — will become "unknown player" warnings
        players_obj = data.get("fantasy_content", {}).get("players", {})
        for pl_wrapper in _iter_yahoo_collection(players_obj):
            pl_list = pl_wrapper.get("player", [])
            if not pl_list:
                continue
            pl_meta = pl_list[0]
            if isinstance(pl_meta, list):
                pl_flat = _flatten_team_meta(pl_meta)
            elif isinstance(pl_meta, dict):
                pl_flat = pl_meta
            else:
                continue
            player_key = pl_flat.get("player_key", "")
            if not player_key:
                continue
            name_data = pl_flat.get("name", {})
            full_name = name_data.get("full") or (
                f"{name_data.get('first', '')} {name_data.get('last', '')}".strip()
            )
            raw_pos = pl_flat.get("display_position") or pl_flat.get("primary_position") or ""
            position = _normalize_position(raw_pos.split(",")[0].strip() if raw_pos else None)
            editorial_team = pl_flat.get("editorial_team_abbr") or pl_flat.get("editorial_team_full_name") or None
            result[player_key] = {
                "full_name": full_name,
                "position": position,
                "nfl_team": editorial_team,
                "image_url": pl_flat.get("image_url") or None,
            }
    return result


def _fetch_user_leagues(access_token: str) -> list[YahooUserLeague]:
    """Return all NFL fantasy leagues the authenticated user is in."""
    try:
        data = yahoo_get(
            "users;use_login=1/games;game_keys=nfl/leagues",
            access_token,
        )
    except YahooAPIError:
        return []

    try:
        users_obj = data["fantasy_content"]["users"]
        user_data = next(_iter_yahoo_collection(users_obj))
        user = user_data.get("user", [{}])
        games_obj = user[1].get("games", {}) if len(user) > 1 else {}
        game_data = next(_iter_yahoo_collection(games_obj), None)
        if not game_data:
            return []
        game = game_data.get("game", [{}])
        leagues_obj = game[1].get("leagues", {}) if len(game) > 1 else {}
    except (KeyError, StopIteration, TypeError):
        return []

    leagues = []
    for lg_wrapper in _iter_yahoo_collection(leagues_obj):
        lg = lg_wrapper.get("league", [{}])
        meta = lg[0] if lg else {}
        if not isinstance(meta, dict):
            continue
        key = meta.get("league_key", "")
        if not key:
            continue
        leagues.append(YahooUserLeague(
            league_key=key,
            name=meta.get("name", key),
            season=str(meta.get("season", "")),
            num_teams=int(meta.get("num_teams", 0)),
            scoring_type=meta.get("scoring_type", ""),
        ))
    return leagues


# ---------------------------------------------------------------------------
# League settings parsing
# ---------------------------------------------------------------------------

def _derive_scoring_format(
    yahoo_scoring_type: str,
    reception_points: float,
    has_super_flex: bool,
) -> str:
    if has_super_flex:
        return "superflex"
    if reception_points >= 0.9:
        return "ppr"
    if reception_points >= 0.4:
        return "half_ppr"
    return "standard"


def _derive_draft_type(yahoo_draft_type: str) -> str:
    mapping = {
        "live": "snake",
        "autopick": "snake",
        "offline": "snake",
        "auction": "auction",
    }
    return mapping.get(yahoo_draft_type.lower(), "snake")


def _parse_league_settings(
    yahoo_scoring_type: str,
    yahoo_draft_type: str,
    roster_positions: list[dict],
    reception_points: float,
) -> YahooLeagueSettingsPreview:
    has_super_flex = any(
        rp["position"] in ("SUPER_FLEX", "OP") for rp in roster_positions
    )
    scoring_format = _derive_scoring_format(yahoo_scoring_type, reception_points, has_super_flex)
    draft_type = _derive_draft_type(yahoo_draft_type)

    # Build roster_settings dict: {position: count}
    roster_settings: dict[str, int] = {}
    for rp in roster_positions:
        pos = rp["position"]
        count = rp["count"]
        roster_settings[pos] = roster_settings.get(pos, 0) + count

    return YahooLeagueSettingsPreview(
        scoring_format=scoring_format,
        draft_type=draft_type,
        roster_settings=roster_settings,
    )


# ---------------------------------------------------------------------------
# DB helpers (adapted from sleeper_import.py)
# ---------------------------------------------------------------------------

def _get_or_create_player(
    session: Session,
    full_name: str,
    position: str,
    nfl_team: str | None,
    image_url: str | None = None,
) -> Player:
    """Match player by name+position (no yahoo_id stored to avoid conflict with sleeper IDs)."""
    candidates = session.exec(
        select(Player).where(Player.full_name == full_name, Player.position == position)
    ).all()

    # Suffix-stripped fallback: "Travis Etienne Jr." ↔ "Travis Etienne", etc.
    if not candidates:
        stripped = _strip_suffix(full_name).lower()
        if stripped != full_name.lower():
            all_pos = session.exec(select(Player).where(Player.position == position)).all()
            candidates = [p for p in all_pos if _strip_suffix(p.full_name).lower() == stripped]

    player = (
        next((p for p in candidates if p.nfl_team == nfl_team), None)
        or next((p for p in candidates if p.nfl_team is None), None)
        or (candidates[0] if candidates else None)
    )
    if player is not None:
        if nfl_team and player.nfl_team != nfl_team:
            player.nfl_team = nfl_team
        if image_url and player.image_url is None:
            player.image_url = image_url
        return player

    player = Player(full_name=full_name, position=position, nfl_team=nfl_team, image_url=image_url)
    session.add(player)
    session.flush()
    return player


def _get_or_create_team(
    session: Session,
    league: League,
    draft_position: int,
    team_name: str,
    owner_name: str | None,
) -> Team:
    # Prefer draft_slot match.
    team = session.exec(
        select(Team).where(Team.league_id == league.id, Team.draft_slot == draft_position)
    ).first()
    if team is not None:
        return team

    # Fall back to name match.
    team = session.exec(
        select(Team).where(Team.league_id == league.id, Team.name == team_name)
    ).first()
    if team is not None:
        team.draft_slot = draft_position
        if owner_name and not team.owner_name:
            team.owner_name = owner_name
        return team

    team = Team(
        league_id=league.id,
        name=team_name,
        owner_name=owner_name,
        draft_slot=draft_position,
    )
    session.add(team)
    session.flush()
    return team


# ---------------------------------------------------------------------------
# Raw data fetch
# ---------------------------------------------------------------------------

def _fetch_all(league_key: str, access_token: str) -> _RawLeagueData:
    info = _fetch_league_info(league_key, access_token)
    roster_positions, reception_points = _fetch_league_settings(league_key, access_token)
    teams = _fetch_teams(league_key, access_token)
    draft_picks = _fetch_draft_picks(league_key, access_token)
    rosters = _fetch_rosters(league_key, access_token)

    # Resolve player names for draft picks + rosters
    all_player_keys = list({
        dp["player_key"] for dp in draft_picks if dp.get("player_key")
    } | {
        rp["player_key"]
        for team_players in rosters.values()
        for rp in team_players
        if rp.get("player_key")
    })
    player_info = _resolve_player_names(all_player_keys, access_token)

    has_super_flex = any(
        rp["position"] in ("SUPER_FLEX", "OP") for rp in roster_positions
    )

    return _RawLeagueData(
        league_key=league_key,
        league_name=info.get("name", league_key),
        num_teams=int(info.get("num_teams", 0)),
        season=str(info.get("season", "")),
        yahoo_scoring_type=info.get("scoring_type", "head"),
        yahoo_draft_type=info.get("draft_type", "live"),
        roster_positions=roster_positions,
        reception_points=reception_points,
        has_super_flex=has_super_flex,
        teams=teams,
        draft_picks=draft_picks,
        player_info=player_info,
        rosters=rosters,
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def list_user_leagues(access_token: str) -> list[YahooUserLeague]:
    return _fetch_user_leagues(access_token)


def preview_yahoo_import(
    session: Session,
    league_id: uuid.UUID,
    yahoo_league_key: str,
    access_token: str,
    season_year: int | None = None,
) -> YahooPreviewResult:
    raw = _fetch_all(yahoo_league_key, access_token)
    season = season_year or int(raw.season) if raw.season.isdigit() else 2025

    warnings: list[str] = []
    errors: list[str] = []

    # Validate team count
    if not raw.teams:
        errors.append("No teams found in Yahoo league. Check the league key and try again.")

    # Build preview teams
    preview_teams: list[YahooPreviewTeam] = []
    for t in raw.teams:
        tk = t.get("team_key", "")
        player_count = len(raw.rosters.get(tk, []))
        preview_teams.append(YahooPreviewTeam(
            team_key=tk,
            draft_position=t.get("draft_position", 0),
            name=t.get("name", tk),
            owner_name=t.get("owner_name"),
            player_count=player_count,
        ))

    # Count valid draft picks
    valid_picks = 0
    for dp in raw.draft_picks:
        pk = dp.get("player_key", "")
        info = raw.player_info.get(pk, {})
        pos = info.get("position")
        if pos in _VALID_POSITIONS:
            valid_picks += 1
        elif pk:
            warnings.append(f"Draft pick player_key {pk!r} has unknown/unsupported position; will be skipped.")

    # Count valid roster entries
    valid_roster = sum(
        1
        for team_players in raw.rosters.values()
        for rp in team_players
        if raw.player_info.get(rp.get("player_key", ""), {}).get("position") in _VALID_POSITIONS
    )

    # League settings preview
    settings_preview = _parse_league_settings(
        raw.yahoo_scoring_type,
        raw.yahoo_draft_type,
        raw.roster_positions,
        raw.reception_points,
    ) if raw.roster_positions else None

    if raw.reception_points == 0.0 and not raw.has_super_flex:
        warnings.append(
            "Could not confirm PPR scoring from Yahoo settings; scoring_format set to 'standard'. "
            "Verify this matches your league settings after import."
        )

    return YahooPreviewResult(
        valid=not errors,
        season_year=season,
        league_name=raw.league_name,
        teams=preview_teams,
        draft_picks_count=valid_picks,
        roster_entries_count=valid_roster,
        league_settings_preview=settings_preview,
        warnings=warnings,
        errors=errors,
    )


def commit_yahoo_import(
    session: Session,
    league_id: uuid.UUID,
    yahoo_league_key: str,
    access_token: str,
    season_year: int | None = None,
    import_league_settings: bool = True,
) -> YahooImportResult:
    raw = _fetch_all(yahoo_league_key, access_token)
    season = season_year or (int(raw.season) if raw.season.isdigit() else 2025)

    league = session.get(League, league_id)
    if league is None:
        raise ValueError(f"League {league_id} not found")

    warnings: list[str] = []

    # Build team_key → Team map
    team_key_map: dict[str, Team] = {}
    teams_upserted = 0
    for t in raw.teams:
        tk = t.get("team_key", "")
        dp = t.get("draft_position", 0)
        name = t.get("name") or f"Team {dp}"
        owner = t.get("owner_name")
        team = _get_or_create_team(session, league, dp, name, owner)
        if tk:
            team_key_map[tk] = team
        teams_upserted += 1

    # Draft picks upsert
    draft_picks_upserted = 0
    num_teams = raw.num_teams or len(raw.teams) or 10
    for dp in raw.draft_picks:
        pk = dp.get("player_key", "")
        info = raw.player_info.get(pk, {})
        pos = info.get("position")
        full_name = info.get("full_name", "")
        if pos not in _VALID_POSITIONS:
            continue
        if not full_name:
            warnings.append(f"Skipping draft pick for player_key {pk!r}: name not resolved.")
            continue
        team_key = dp.get("team_key", "")
        team = team_key_map.get(team_key)
        if team is None:
            warnings.append(f"Skipping draft pick #{dp.get('overall_pick')} — team_key {team_key!r} not matched.")
            continue

        player = _get_or_create_player(session, full_name, pos, info.get("nfl_team"), image_url=info.get("image_url"))
        overall_pick = dp["overall_pick"]
        rd = dp["round"]
        pick_in_round = overall_pick - (rd - 1) * num_teams

        existing = session.exec(
            select(DraftPick).where(
                DraftPick.league_id == league_id,
                DraftPick.season_year == season,
                DraftPick.overall_pick == overall_pick,
            )
        ).first()
        if existing is None:
            existing = DraftPick(
                league_id=league_id,
                season_year=season,
                overall_pick=overall_pick,
            )
        existing.team_id = team.id
        existing.player_id = player.id
        existing.round = rd
        existing.pick_in_round = pick_in_round
        existing.position = pos
        session.add(existing)
        draft_picks_upserted += 1

    # Roster entries upsert
    roster_entries_upserted = 0
    for team_key, players in raw.rosters.items():
        team = team_key_map.get(team_key)
        if team is None:
            continue
        for rp in players:
            pk = rp.get("player_key", "")
            info = raw.player_info.get(pk, {})
            pos = info.get("position")
            full_name = info.get("full_name", "")
            if pos not in _VALID_POSITIONS or not full_name:
                continue
            player = _get_or_create_player(session, full_name, pos, info.get("nfl_team"), image_url=info.get("image_url"))
            selected_pos = rp.get("selected_position", "BN")
            if selected_pos in ("IR", "IL"):
                roster_status = "IR"
            elif selected_pos == "BN":
                roster_status = "Bench"
            else:
                roster_status = "Starter"

            existing = session.exec(
                select(FinalRosterEntry).where(
                    FinalRosterEntry.league_id == league_id,
                    FinalRosterEntry.team_id == team.id,
                    FinalRosterEntry.player_id == player.id,
                    FinalRosterEntry.season_year == season,
                )
            ).first()
            if existing is None:
                existing = FinalRosterEntry(
                    league_id=league_id,
                    team_id=team.id,
                    player_id=player.id,
                    season_year=season,
                )
            existing.position = pos
            existing.roster_status = roster_status
            session.add(existing)
            roster_entries_upserted += 1

    # League settings update
    league_settings_updated = False
    if import_league_settings and raw.roster_positions:
        settings_preview = _parse_league_settings(
            raw.yahoo_scoring_type,
            raw.yahoo_draft_type,
            raw.roster_positions,
            raw.reception_points,
        )
        league.scoring_format = settings_preview.scoring_format
        league.draft_type = settings_preview.draft_type
        existing_rs = league.roster_settings or {}
        existing_rs.update(settings_preview.roster_settings)
        league.roster_settings = existing_rs
        session.add(league)
        league_settings_updated = True

    session.commit()

    return YahooImportResult(
        season_year=season,
        league_name=raw.league_name,
        teams_upserted=teams_upserted,
        draft_picks_upserted=draft_picks_upserted,
        roster_entries_upserted=roster_entries_upserted,
        league_settings_updated=league_settings_updated,
        warnings=warnings,
    )
