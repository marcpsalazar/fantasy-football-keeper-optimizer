from __future__ import annotations

import json
import re
import urllib.error
import urllib.request
import uuid
from dataclasses import dataclass, field
from typing import Any

from sqlmodel import Session, select

from app.models import DraftPick, FinalRosterEntry, League, Player, Team

ESPN_BASE = "https://fantasy.espn.com/apis/v3/games/ffl"

_POSITION_MAP: dict[int, str] = {
    1: "QB",
    2: "RB",
    3: "WR",
    4: "TE",
    5: "K",
    16: "DST",
}
_VALID_POSITIONS = frozenset({"QB", "RB", "WR", "TE", "K", "DST"})

_SUFFIX_RE = re.compile(r"\s+(jr\.?|sr\.?|ii|iii|iv|v|vi)$", re.IGNORECASE)


def _strip_suffix(name: str) -> str:
    return _SUFFIX_RE.sub("", name).strip()

# Lineup slot IDs that represent starter positions
_STARTER_SLOT_IDS = frozenset({0, 2, 4, 6, 16, 17, 23, 24})
_IR_SLOT_ID = 21

# ESPN pro team ID → NFL abbreviation
_ESPN_NFL_TEAM_MAP: dict[int, str] = {
    1: "ATL", 2: "BUF", 3: "CHI", 4: "CIN", 5: "CLE",
    6: "DAL", 7: "DEN", 8: "DET", 9: "GB", 10: "TEN",
    11: "IND", 12: "KC", 13: "LV", 14: "LAR", 15: "MIA",
    16: "MIN", 17: "NE", 18: "NO", 19: "NYG", 20: "NYJ",
    21: "PHI", 22: "ARI", 23: "PIT", 24: "LAC", 25: "SF",
    26: "SEA", 27: "TB", 28: "WSH", 29: "CAR", 30: "JAX",
    33: "BAL", 34: "HOU",
}


class EspnAPIError(Exception):
    pass


@dataclass
class EspnPreviewResult:
    season_year: int
    league_name: str
    teams: list[dict[str, Any]]
    draft_picks_count: int
    roster_entries_count: int
    warnings: list[str]
    errors: list[str]
    valid: bool


@dataclass
class EspnImportResult:
    season_year: int
    league_name: str
    teams_upserted: int
    draft_picks_upserted: int
    roster_entries_upserted: int
    warnings: list[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# ESPN HTTP helpers
# ---------------------------------------------------------------------------

def _fetch_league_data(
    espn_league_id: int,
    season_year: int,
    espn_s2: str | None = None,
    swid: str | None = None,
) -> dict[str, Any]:
    url = (
        f"{ESPN_BASE}/seasons/{season_year}/segments/0/leagues/{espn_league_id}"
        "?view=mTeam&view=mRoster&view=mDraftDetail"
    )
    headers: dict[str, str] = {
        "User-Agent": "keeper-optimizer/1.0",
        "Accept": "application/json",
    }
    if espn_s2 or swid:
        parts = []
        if espn_s2:
            parts.append(f"espn_s2={espn_s2}")
        if swid:
            parts.append(f"SWID={swid}")
        headers["Cookie"] = "; ".join(parts)

    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        if exc.code == 401:
            raise EspnAPIError(
                "ESPN returned 401 — the league is private. Provide your espn_s2 and SWID cookies to access it."
            ) from exc
        if exc.code == 404:
            raise EspnAPIError(
                f"ESPN league {espn_league_id} not found for season {season_year}. Check the league ID and year."
            ) from exc
        raise EspnAPIError(f"ESPN API returned HTTP {exc.code}") from exc
    except (urllib.error.URLError, OSError) as exc:
        raise EspnAPIError(f"Could not reach ESPN API: {exc}") from exc
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise EspnAPIError(f"Invalid JSON from ESPN API: {exc}") from exc


def _normalize_position(pos_id: Any) -> str | None:
    try:
        return _POSITION_MAP.get(int(pos_id))
    except (TypeError, ValueError):
        return None


def _get_roster_status(lineup_slot_id: int) -> str:
    if lineup_slot_id == _IR_SLOT_ID:
        return "IR"
    if lineup_slot_id in _STARTER_SLOT_IDS:
        return "Starter"
    return "Bench"


def _build_member_map(members: list[dict]) -> dict[str, str]:
    result: dict[str, str] = {}
    for member in members:
        mid = str(member.get("id") or "").strip()
        if not mid:
            continue
        display = (
            member.get("displayName")
            or (f"{member.get('firstName', '')} {member.get('lastName', '')}".strip() or None)
        )
        if display:
            result[mid] = str(display)
    return result


def _team_display_name(team: dict) -> str:
    name = str(team.get("name") or "").strip()
    if name:
        return name
    location = str(team.get("location") or "").strip()
    nickname = str(team.get("nickname") or "").strip()
    combined = f"{location} {nickname}".strip()
    return combined or f"Team {team.get('id', '?')}"


# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------

def _get_or_create_player(
    session: Session,
    espn_player_id: str,
    full_name: str,
    position: str,
    nfl_team: str | None,
) -> Player:
    external_id = f"espn:{espn_player_id}"
    player = session.exec(
        select(Player).where(Player.external_id == external_id)
    ).first()
    if player is not None:
        if nfl_team and player.nfl_team != nfl_team:
            player.nfl_team = nfl_team
        return player

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
        if not player.external_id:
            player.external_id = external_id
        if nfl_team and player.nfl_team != nfl_team:
            player.nfl_team = nfl_team
        return player

    player = Player(
        full_name=full_name,
        position=position,
        nfl_team=nfl_team,
        external_id=external_id,
    )
    session.add(player)
    session.flush()
    return player


def _get_or_create_team(
    session: Session,
    league: League,
    espn_team_id: int,
    team_name: str,
    owner_name: str | None,
) -> Team:
    team = session.exec(
        select(Team).where(Team.league_id == league.id, Team.draft_slot == espn_team_id)
    ).first()
    if team is not None:
        return team

    team = session.exec(
        select(Team).where(Team.league_id == league.id, Team.name == team_name)
    ).first()
    if team is not None:
        team.draft_slot = espn_team_id
        return team

    team = Team(
        league_id=league.id,
        name=team_name,
        owner_name=owner_name,
        draft_slot=espn_team_id,
    )
    session.add(team)
    session.flush()
    return team


def _extract_player_info(
    pool_entry: dict,
) -> tuple[str, str | None, str | None, str | None]:
    """Returns (full_name, position, nfl_team, espn_player_id) from a playerPoolEntry dict."""
    player_data = pool_entry.get("player") or {}
    full_name = str(player_data.get("fullName") or "").strip()
    pos = _normalize_position(player_data.get("defaultPositionId"))
    nfl_team_id = player_data.get("proTeamId")
    nfl_team = _ESPN_NFL_TEAM_MAP.get(int(nfl_team_id)) if nfl_team_id is not None else None
    espn_pid = str(player_data.get("id") or "").strip()
    return full_name, pos, nfl_team, espn_pid


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def preview_espn_import(
    session: Session,
    league_id: uuid.UUID,
    espn_league_id: int,
    season_year: int,
    espn_s2: str | None = None,
    swid: str | None = None,
) -> EspnPreviewResult:
    league = session.get(League, league_id)
    if league is None:
        return EspnPreviewResult(
            season_year=season_year, league_name="",
            teams=[], draft_picks_count=0, roster_entries_count=0,
            warnings=[], errors=["League not found."], valid=False,
        )

    try:
        data = _fetch_league_data(espn_league_id, season_year, espn_s2, swid)
    except EspnAPIError as exc:
        return EspnPreviewResult(
            season_year=season_year, league_name="",
            teams=[], draft_picks_count=0, roster_entries_count=0,
            warnings=[], errors=[str(exc)], valid=False,
        )

    settings = data.get("settings") or {}
    league_name = str(settings.get("name") or f"ESPN League {espn_league_id}")
    teams_raw = data.get("teams") or []
    members = data.get("members") or []
    draft_detail = data.get("draftDetail") or {}
    picks_raw = draft_detail.get("picks") or []

    if not teams_raw:
        return EspnPreviewResult(
            season_year=season_year, league_name=league_name,
            teams=[], draft_picks_count=0, roster_entries_count=0,
            warnings=[], errors=["No teams returned — verify the ESPN League ID and season year."], valid=False,
        )

    member_map = _build_member_map(members)
    warnings: list[str] = []

    teams_preview: list[dict[str, Any]] = []
    for team in teams_raw:
        team_id = int(team.get("id") or 0)
        name = _team_display_name(team)
        primary_owner = str(team.get("primaryOwner") or "").strip()
        owner_name = member_map.get(primary_owner)
        roster = team.get("roster") or {}
        valid_count = sum(
            1 for e in (roster.get("entries") or [])
            if _normalize_position(
                ((e.get("playerPoolEntry") or {}).get("player") or {}).get("defaultPositionId")
            ) in _VALID_POSITIONS
        )
        teams_preview.append({
            "team_id": team_id,
            "team_name": name,
            "owner_name": owner_name,
            "player_count": valid_count,
        })

    valid_picks = 0
    skipped_picks = 0
    for pick in picks_raw:
        full_name, pos, _, _ = _extract_player_info(pick.get("playerPoolEntry") or {})
        if full_name and pos and pos in _VALID_POSITIONS:
            valid_picks += 1
        elif full_name:
            skipped_picks += 1

    if skipped_picks:
        warnings.append(
            f"{skipped_picks} draft pick(s) are at non-standard positions (IDP, Team D/ST, etc.) and will be skipped."
        )

    valid_entries = 0
    for team in teams_raw:
        roster = team.get("roster") or {}
        for entry in roster.get("entries") or []:
            _, pos, _, _ = _extract_player_info(entry.get("playerPoolEntry") or {})
            if pos and pos in _VALID_POSITIONS:
                valid_entries += 1

    if not draft_detail.get("drafted"):
        warnings.append("Draft has not been completed yet — draft picks may be empty.")

    return EspnPreviewResult(
        season_year=season_year,
        league_name=league_name,
        teams=teams_preview,
        draft_picks_count=valid_picks,
        roster_entries_count=valid_entries,
        warnings=warnings,
        errors=[],
        valid=True,
    )


def commit_espn_import(
    session: Session,
    league_id: uuid.UUID,
    espn_league_id: int,
    season_year: int,
    espn_s2: str | None = None,
    swid: str | None = None,
) -> EspnImportResult:
    league = session.get(League, league_id)
    if league is None:
        raise ValueError(f"League {league_id} not found")

    data = _fetch_league_data(espn_league_id, season_year, espn_s2, swid)
    settings = data.get("settings") or {}
    league_name = str(settings.get("name") or f"ESPN League {espn_league_id}")
    teams_raw = data.get("teams") or []
    members = data.get("members") or []
    draft_detail = data.get("draftDetail") or {}
    picks_raw = draft_detail.get("picks") or []

    member_map = _build_member_map(members)
    warnings: list[str] = []

    espn_id_to_team: dict[int, Team] = {}
    for team in teams_raw:
        team_id = int(team.get("id") or 0)
        name = _team_display_name(team)
        primary_owner = str(team.get("primaryOwner") or "").strip()
        owner_name = member_map.get(primary_owner)
        db_team = _get_or_create_team(session, league, team_id, name, owner_name)
        espn_id_to_team[team_id] = db_team

    picks_upserted = 0
    for pick in picks_raw:
        overall_pick = int(pick.get("overallPickNumber") or 0)
        round_num = int(pick.get("roundId") or 0)
        pick_in_round = int(pick.get("roundPickNumber") or 0)
        team_id = int(pick.get("teamId") or 0)

        if not overall_pick or not round_num:
            continue

        full_name, pos, nfl_team, espn_pid = _extract_player_info(pick.get("playerPoolEntry") or {})
        if not full_name or not pos or pos not in _VALID_POSITIONS or not espn_pid:
            continue

        db_team = espn_id_to_team.get(team_id)
        if db_team is None:
            continue

        player = _get_or_create_player(session, espn_pid, full_name, pos, nfl_team)

        existing = session.exec(
            select(DraftPick).where(
                DraftPick.league_id == league.id,
                DraftPick.season_year == season_year,
                DraftPick.overall_pick == overall_pick,
            )
        ).first()
        if existing is None:
            existing = DraftPick(
                league_id=league.id,
                team_id=db_team.id,
                player_id=player.id,
                season_year=season_year,
                round=round_num,
                overall_pick=overall_pick,
                pick_in_round=pick_in_round,
                position=pos,
            )
            session.add(existing)
        else:
            existing.team_id = db_team.id
            existing.player_id = player.id
            existing.round = round_num
            existing.pick_in_round = pick_in_round
            existing.position = pos

        session.flush()
        picks_upserted += 1

    entries_upserted = 0
    for team in teams_raw:
        team_id = int(team.get("id") or 0)
        db_team = espn_id_to_team.get(team_id)
        if db_team is None:
            continue

        roster = team.get("roster") or {}
        for entry in roster.get("entries") or []:
            lineup_slot_id = int(entry.get("lineupSlotId") or 20)
            full_name, pos, nfl_team, espn_pid = _extract_player_info(entry.get("playerPoolEntry") or {})

            if not full_name or not pos or pos not in _VALID_POSITIONS or not espn_pid:
                continue

            player = _get_or_create_player(session, espn_pid, full_name, pos, nfl_team)
            roster_status = _get_roster_status(lineup_slot_id)

            existing_entry = session.exec(
                select(FinalRosterEntry).where(
                    FinalRosterEntry.league_id == league.id,
                    FinalRosterEntry.team_id == db_team.id,
                    FinalRosterEntry.player_id == player.id,
                    FinalRosterEntry.season_year == season_year,
                )
            ).first()
            if existing_entry is None:
                existing_entry = FinalRosterEntry(
                    league_id=league.id,
                    team_id=db_team.id,
                    player_id=player.id,
                    season_year=season_year,
                    position=pos,
                    roster_status=roster_status,
                )
                session.add(existing_entry)
            else:
                existing_entry.position = pos
                existing_entry.roster_status = roster_status

            session.flush()
            entries_upserted += 1

    session.commit()

    return EspnImportResult(
        season_year=season_year,
        league_name=league_name,
        teams_upserted=len(espn_id_to_team),
        draft_picks_upserted=picks_upserted,
        roster_entries_upserted=entries_upserted,
        warnings=warnings,
    )
