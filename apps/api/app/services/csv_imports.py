from __future__ import annotations

import csv
import math
from dataclasses import dataclass
from datetime import date
from io import StringIO
from typing import Any
import uuid

from sqlmodel import Session, select

from app.models import ADPEntry, ADPSnapshot, DraftPick, FinalRosterEntry, League, Player, Team

MAX_ROUND_PICK_ROUND = 30


class CSVImportError(ValueError):
    """Raised when an import CSV is missing required data."""


@dataclass
class ImportResult:
    imported: int
    rows: list[dict[str, Any]]


def import_draft_results_csv(session: Session, league_id: uuid.UUID, csv_text: str) -> ImportResult:
    league = _require_league(session, league_id)
    rows: list[dict[str, Any]] = []

    for row in _read_csv(csv_text):
        team_name = _required(row, "team")
        player_name = _required(row, "player")
        position = _position(_required(row, "position"))
        overall_pick = _int(_required(row, "overall_pick"))
        round_number = _int(_first(row, "round"), _round_for_pick(overall_pick, _team_count(session, league)))
        season_year = _int(_first(row, "season_year", "season", "year"), league.season_year)

        team = _get_or_create_team(session, league, team_name)
        player = _get_or_create_player(session, player_name, position, _first(row, "nfl_team"))
        draft_pick = session.exec(
            select(DraftPick).where(
                DraftPick.league_id == league.id,
                DraftPick.season_year == season_year,
                DraftPick.overall_pick == overall_pick,
            )
        ).first()

        if draft_pick is None:
            draft_pick = DraftPick(
                league_id=league.id,
                team_id=team.id,
                player_id=player.id,
                season_year=season_year,
                round=round_number,
                overall_pick=overall_pick,
                pick_in_round=_optional_int(_first(row, "pick_in_round")),
                position=position,
            )
            session.add(draft_pick)
        else:
            draft_pick.team_id = team.id
            draft_pick.player_id = player.id
            draft_pick.round = round_number
            draft_pick.pick_in_round = _optional_int(_first(row, "pick_in_round"))
            draft_pick.position = position

        session.flush()
        rows.append(
            {
                "id": str(draft_pick.id),
                "league_id": str(league.id),
                "team_id": str(team.id),
                "team_name": team.name,
                "player_id": str(player.id),
                "player_name": player.full_name,
                "position": position,
                "season_year": season_year,
                "round": round_number,
                "overall_pick": overall_pick,
                "pick_in_round": draft_pick.pick_in_round,
            }
        )

    session.commit()
    return ImportResult(imported=len(rows), rows=rows)


def import_final_rosters_csv(session: Session, league_id: uuid.UUID, csv_text: str) -> ImportResult:
    league = _require_league(session, league_id)
    rows: list[dict[str, Any]] = []

    for row in _read_csv(csv_text):
        team_name = _required(row, "team")
        player_name = _required(row, "player")
        position = _position(_required(row, "position"))
        roster_status = _first(row, "roster_status", "status") or "Bench"
        season_year = _int(_first(row, "season_year", "season", "year"), league.season_year)

        team = _get_or_create_team(session, league, team_name)
        player = _get_or_create_player(session, player_name, position, _first(row, "nfl_team"))
        roster_entry = session.exec(
            select(FinalRosterEntry).where(
                FinalRosterEntry.league_id == league.id,
                FinalRosterEntry.team_id == team.id,
                FinalRosterEntry.player_id == player.id,
                FinalRosterEntry.season_year == season_year,
            )
        ).first()

        if roster_entry is None:
            roster_entry = FinalRosterEntry(
                league_id=league.id,
                team_id=team.id,
                player_id=player.id,
                season_year=season_year,
                position=position,
                roster_status=roster_status,
            )
            session.add(roster_entry)
        else:
            roster_entry.position = position
            roster_entry.roster_status = roster_status

        session.flush()
        rows.append(
            {
                "id": str(roster_entry.id),
                "league_id": str(league.id),
                "team_id": str(team.id),
                "team_name": team.name,
                "player_id": str(player.id),
                "player_name": player.full_name,
                "position": position,
                "season_year": season_year,
                "roster_status": roster_entry.roster_status,
            }
        )

    session.commit()
    return ImportResult(imported=len(rows), rows=rows)


def import_adp_csv(session: Session, league_id: uuid.UUID, csv_text: str) -> ImportResult:
    league = _require_league(session, league_id)
    rows: list[dict[str, Any]] = []

    for row in _read_csv(csv_text):
        source = _first(row, "source", "source_name") or "Unknown ADP"
        format_type = _first(row, "format_type", "format", "scoring_format") or league.scoring_format
        snapshot_date = _date(_first(row, "snapshot_date", "date"), date.today())
        season_year = _int(_first(row, "season_year", "season", "year"), league.season_year)
        snapshot_name = _first(row, "snapshot_name", "name") or f"{source} {snapshot_date}"
        player_name = _required(row, "player")
        position = _position(_required(row, "position"))
        team_count = _team_count(session, league)
        raw_adp_pick = _required(row, "adp_pick", "adp", "pick")
        adp_pick = _normalize_adp_pick(raw_adp_pick, team_count)
        adp_round = _float(_first(row, "adp_round", "round"), float(_round_for_pick(adp_pick, team_count)))

        snapshot = _get_or_create_adp_snapshot(
            session=session,
            league=league,
            season_year=season_year,
            name=snapshot_name,
            source=source,
            format_type=format_type,
            snapshot_date=snapshot_date,
            notes=_first(row, "notes") or None,
        )
        player = _get_or_create_player(session, player_name, position, _first(row, "nfl_team"))
        adp_entry = session.exec(
            select(ADPEntry).where(
                ADPEntry.snapshot_id == snapshot.id,
                ADPEntry.player_id == player.id,
            )
        ).first()

        if adp_entry is None:
            adp_entry = ADPEntry(
                snapshot_id=snapshot.id,
                player_id=player.id,
                position=position,
                adp_pick=adp_pick,
                adp_round=adp_round,
                source_note=_first(row, "source_note", "note") or None,
                sos=_optional_float(_first(row, "sos")),
                injury=_optional_float(_first(row, "injury")),
                risk=_optional_float(_first(row, "risk")),
                floor_projection=_optional_float(_first(row, "floor", "floor_projection")),
                consensus_projection=_optional_float(
                    _first(row, "consensus_proj", "consensus_projection")
                ),
                draftsharks_projection=_optional_float(
                    _first(row, "ds_proj", "draftsharks_projection", "draft_sharks_projection")
                ),
                ceiling_projection=_optional_float(_first(row, "ceiling", "ceiling_projection")),
                draftsharks_3d_value=_optional_float(
                    _first(row, "3d_value", "draftsharks_3d_value", "draft_sharks_3d_value")
                ),
            )
            session.add(adp_entry)
        else:
            adp_entry.position = position
            adp_entry.adp_pick = adp_pick
            adp_entry.adp_round = adp_round
            adp_entry.source_note = _first(row, "source_note", "note") or None
            adp_entry.sos = _optional_float(_first(row, "sos"))
            adp_entry.injury = _optional_float(_first(row, "injury"))
            adp_entry.risk = _optional_float(_first(row, "risk"))
            adp_entry.floor_projection = _optional_float(_first(row, "floor", "floor_projection"))
            adp_entry.consensus_projection = _optional_float(
                _first(row, "consensus_proj", "consensus_projection")
            )
            adp_entry.draftsharks_projection = _optional_float(
                _first(row, "ds_proj", "draftsharks_projection", "draft_sharks_projection")
            )
            adp_entry.ceiling_projection = _optional_float(_first(row, "ceiling", "ceiling_projection"))
            adp_entry.draftsharks_3d_value = _optional_float(
                _first(row, "3d_value", "draftsharks_3d_value", "draft_sharks_3d_value")
            )

        session.flush()
        rows.append(
            {
                "id": str(adp_entry.id),
                "league_id": str(league.id),
                "snapshot_id": str(snapshot.id),
                "snapshot_name": snapshot.name,
                "source": snapshot.source,
                "snapshot_date": snapshot.snapshot_date.isoformat(),
                "format_type": snapshot.format_type,
                "player_id": str(player.id),
                "player_name": player.full_name,
                "position": position,
                "adp_pick": adp_entry.adp_pick,
                "adp_round": adp_entry.adp_round,
                "source_note": adp_entry.source_note,
                "sos": adp_entry.sos,
                "injury": adp_entry.injury,
                "risk": adp_entry.risk,
                "floor_projection": adp_entry.floor_projection,
                "consensus_projection": adp_entry.consensus_projection,
                "draftsharks_projection": adp_entry.draftsharks_projection,
                "ceiling_projection": adp_entry.ceiling_projection,
                "draftsharks_3d_value": adp_entry.draftsharks_3d_value,
            }
        )

    session.commit()
    return ImportResult(imported=len(rows), rows=rows)


def _read_csv(csv_text: str) -> list[dict[str, str]]:
    reader = csv.DictReader(StringIO(csv_text.strip()))
    if not reader.fieldnames:
        raise CSVImportError("CSV header row is required")

    return [
        {
            str(key).strip().lower(): str(value or "").strip()
            for key, value in row.items()
            if key is not None
        }
        for row in reader
    ]


def _require_league(session: Session, league_id: uuid.UUID) -> League:
    league = session.get(League, league_id)
    if league is None:
        raise CSVImportError(f"League {league_id} was not found")
    return league


def _get_or_create_team(session: Session, league: League, name: str) -> Team:
    team = session.exec(
        select(Team).where(
            Team.league_id == league.id,
            Team.name == name,
        )
    ).first()
    if team is not None:
        return team

    team = Team(league_id=league.id, name=name)
    session.add(team)
    session.flush()
    return team


def _get_or_create_player(
    session: Session,
    full_name: str,
    position: str,
    nfl_team: str | None = None,
) -> Player:
    players = session.exec(
        select(Player).where(
            Player.full_name == full_name,
            Player.position == position,
        )
    ).all()
    player = next((candidate for candidate in players if candidate.nfl_team == nfl_team), None)
    player = player or next((candidate for candidate in players if candidate.nfl_team is None), None)
    if player is not None:
        if nfl_team and player.nfl_team is None:
            player.nfl_team = nfl_team
        return player

    player = Player(full_name=full_name, position=position, nfl_team=nfl_team or None)
    session.add(player)
    session.flush()
    return player


def _get_or_create_adp_snapshot(
    *,
    session: Session,
    league: League,
    season_year: int,
    name: str,
    source: str,
    format_type: str,
    snapshot_date: date,
    notes: str | None,
) -> ADPSnapshot:
    snapshot = session.exec(
        select(ADPSnapshot).where(
            ADPSnapshot.league_id == league.id,
            ADPSnapshot.season_year == season_year,
            ADPSnapshot.source == source,
            ADPSnapshot.format_type == format_type,
            ADPSnapshot.snapshot_date == snapshot_date,
        )
    ).first()
    if snapshot is not None:
        snapshot.name = name
        snapshot.notes = notes
        return snapshot

    snapshot = ADPSnapshot(
        league_id=league.id,
        season_year=season_year,
        name=name,
        source=source,
        format_type=format_type,
        snapshot_date=snapshot_date,
        notes=notes,
    )
    session.add(snapshot)
    session.flush()
    return snapshot


def _team_count(session: Session, league: League) -> int:
    teams = session.exec(select(Team).where(Team.league_id == league.id)).all()
    return len(teams) or 12


def _first(row: dict[str, str], *names: str) -> str:
    for name in names:
        value = row.get(name)
        if value:
            return value
    return ""


def _required(row: dict[str, str], *names: str) -> str:
    value = _first(row, *names)
    if not value:
        raise CSVImportError(f"Missing required CSV column: {'/'.join(names)}")
    return value


def _position(position: str) -> str:
    return position.strip().upper()


def _int(value: str | int | float | None, default: int | None = None) -> int:
    if value in (None, ""):
        if default is None:
            raise CSVImportError("Missing required integer value")
        return default
    try:
        return int(float(value))
    except ValueError as exc:
        raise CSVImportError(f"Invalid integer value: {value}") from exc


def _optional_int(value: str | int | float | None) -> int | None:
    if value in (None, ""):
        return None
    try:
        return int(float(value))
    except ValueError as exc:
        raise CSVImportError(f"Invalid integer value: {value}") from exc


def _float(value: str | int | float | None, default: float | None = None) -> float:
    if value in (None, ""):
        if default is None:
            raise CSVImportError("Missing required numeric value")
        return default
    try:
        return float(value)
    except ValueError as exc:
        raise CSVImportError(f"Invalid numeric value: {value}") from exc


def _optional_float(value: str | int | float | None) -> float | None:
    if value in (None, ""):
        return None
    try:
        return float(value)
    except ValueError:
        return None


def _normalize_adp_pick(value: str | int | float, team_count: int) -> float:
    round_pick = _round_pick_to_overall(value, team_count)
    return round_pick if round_pick is not None else _float(value)


def _round_pick_to_overall(value: str | int | float, team_count: int) -> float | None:
    if team_count <= 0:
        return None

    text = str(value).strip()
    if "." not in text:
        return None

    round_text, pick_text = text.split(".", 1)
    if not round_text.isdigit() or not pick_text.isdigit() or len(pick_text) > 2:
        return None

    round_number = int(round_text)
    pick_in_round = int(pick_text) if len(pick_text) == 2 else int(pick_text) * 10
    if (
        round_number <= 0
        or round_number > MAX_ROUND_PICK_ROUND
        or pick_in_round <= 0
        or pick_in_round > team_count
    ):
        return None

    return float((round_number - 1) * team_count + pick_in_round)


def _date(value: str | None, default: date) -> date:
    if not value:
        return default
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise CSVImportError(f"Invalid date value: {value}") from exc


def _round_for_pick(pick: float | int, team_count: int) -> int:
    return max(1, math.ceil(float(pick) / max(team_count, 1)))
