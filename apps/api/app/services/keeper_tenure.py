"""Keeper Tenure service.

Tracks how many consecutive seasons a team has kept a given player.
Admins backfill this data via CSV upload. When a league has
max_consecutive_keeper_seasons set, the optimizer marks players at or
above that limit as ineligible.

CSV format:
    player,position,team,consecutive_seasons[,last_kept_season_year]

Where:
  - player / position: used to look up the Player record
  - team: matched to a Team record in the league
  - consecutive_seasons: integer >= 1
  - last_kept_season_year (optional): the most recent season year the
    player was kept by this team
"""
from __future__ import annotations

import csv
from dataclasses import dataclass
from io import StringIO
from typing import Any
import uuid

from sqlmodel import Session, select

from app.models import KeeperTenure, League, Player, Team

VALID_POSITIONS = {"QB", "RB", "WR", "TE", "K", "DEF", "DST", "FLEX"}


class KeeperTenureError(ValueError):
    pass


# ---------------------------------------------------------------------------
# Read
# ---------------------------------------------------------------------------

def get_tenure_for_league(session: Session, league_id: uuid.UUID) -> list[dict[str, Any]]:
    tenures = session.exec(
        select(KeeperTenure).where(KeeperTenure.league_id == league_id)
    ).all()
    if not tenures:
        return []

    player_ids = {t.player_id for t in tenures}
    team_ids = {t.team_id for t in tenures}
    players = {p.id: p for p in session.exec(select(Player).where(Player.id.in_(player_ids))).all()}
    teams = {t.id: t for t in session.exec(select(Team).where(Team.id.in_(team_ids))).all()}

    league = session.get(League, league_id)
    max_seasons = league.max_consecutive_keeper_seasons if league else None

    rows = []
    for t in sorted(tenures, key=lambda x: (teams.get(x.team_id, Team()).name or "", -(x.consecutive_seasons))):
        player = players.get(t.player_id)
        team = teams.get(t.team_id)
        rows.append({
            "tenure_id": str(t.id),
            "league_id": str(t.league_id),
            "team_id": str(t.team_id),
            "team_name": team.name if team else None,
            "player_id": str(t.player_id),
            "player_name": player.full_name if player else None,
            "position": player.position if player else None,
            "nfl_team": player.nfl_team if player else None,
            "consecutive_seasons": t.consecutive_seasons,
            "last_kept_season_year": t.last_kept_season_year,
            "at_limit": max_seasons is not None and t.consecutive_seasons >= max_seasons,
        })
    return rows


# ---------------------------------------------------------------------------
# CSV preview
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class TenurePreviewResult:
    valid: bool
    total_rows: int
    valid_rows: int
    rows: list[dict[str, Any]]
    errors: list[dict[str, Any]]
    warnings: list[dict[str, Any]]

    def to_payload(self) -> dict[str, Any]:
        columns = list(self.rows[0].keys()) if self.rows else []
        return {
            "kind": "keeper-tenure",
            "valid": self.valid,
            "total_rows": self.total_rows,
            "valid_rows": self.valid_rows,
            "error_count": len(self.errors),
            "warning_count": len(self.warnings),
            "columns": columns,
            "rows": self.rows,
            "errors": self.errors,
            "warnings": self.warnings,
        }


def preview_tenure_csv(
    session: Session,
    league_id: uuid.UUID,
    csv_text: str,
) -> TenurePreviewResult:
    league = _require_league(session, league_id)
    teams = {t.name.lower(): t for t in session.exec(select(Team).where(Team.league_id == league_id)).all()}
    raw_rows = _read_csv(csv_text)

    preview_rows: list[dict[str, Any]] = []
    errors: list[dict[str, Any]] = []
    warnings: list[dict[str, Any]] = []

    for i, row in enumerate(raw_rows, start=2):
        row_errors: list[str] = []
        row_warnings: list[str] = []

        player_name = row.get("player", "").strip()
        position = row.get("position", "").strip().upper()
        team_name = row.get("team", "").strip()
        consecutive_seasons_raw = row.get("consecutive_seasons", "").strip()
        last_year_raw = row.get("last_kept_season_year", "").strip()

        if not player_name:
            row_errors.append("player name is required")
        if not position:
            row_errors.append("position is required")
        elif position not in VALID_POSITIONS:
            row_errors.append(f"invalid position '{position}'")
        if not team_name:
            row_errors.append("team name is required")
        elif team_name.lower() not in teams:
            row_warnings.append(f"team '{team_name}' not found in league — row will be skipped")

        consecutive_seasons: int | None = None
        if not consecutive_seasons_raw:
            row_errors.append("consecutive_seasons is required")
        else:
            try:
                consecutive_seasons = int(consecutive_seasons_raw)
                if consecutive_seasons < 1:
                    row_errors.append("consecutive_seasons must be >= 1")
            except ValueError:
                row_errors.append(f"consecutive_seasons '{consecutive_seasons_raw}' is not a valid integer")

        last_kept_season_year: int | None = None
        if last_year_raw:
            try:
                last_kept_season_year = int(last_year_raw)
            except ValueError:
                row_errors.append(f"last_kept_season_year '{last_year_raw}' is not a valid integer")

        at_limit = (
            league.max_consecutive_keeper_seasons is not None
            and consecutive_seasons is not None
            and consecutive_seasons >= league.max_consecutive_keeper_seasons
        )
        if at_limit:
            row_warnings.append(
                f"Player is at or exceeds the max consecutive seasons limit ({league.max_consecutive_keeper_seasons}) — they will be ineligible"
            )

        preview_rows.append({
            "row_number": i,
            "player": player_name,
            "position": position,
            "team": team_name,
            "consecutive_seasons": consecutive_seasons,
            "last_kept_season_year": last_kept_season_year,
            "at_limit": at_limit,
            "errors": row_errors,
            "warnings": row_warnings,
        })

        for msg in row_errors:
            errors.append({"row_number": i, "field": None, "message": msg, "severity": "error"})
        for msg in row_warnings:
            warnings.append({"row_number": i, "field": None, "message": msg, "severity": "warning"})

    valid_rows = sum(1 for r in preview_rows if not r["errors"])
    is_valid = len(errors) == 0 and valid_rows > 0

    return TenurePreviewResult(
        valid=is_valid,
        total_rows=len(raw_rows),
        valid_rows=valid_rows,
        rows=preview_rows,
        errors=errors,
        warnings=warnings,
    )


# ---------------------------------------------------------------------------
# CSV import
# ---------------------------------------------------------------------------

@dataclass
class TenureImportResult:
    imported: int
    updated: int
    skipped: int
    rows: list[dict[str, Any]]


def import_tenure_csv(
    session: Session,
    league_id: uuid.UUID,
    csv_text: str,
) -> TenureImportResult:
    _require_league(session, league_id)
    teams = {t.name.lower(): t for t in session.exec(select(Team).where(Team.league_id == league_id)).all()}
    raw_rows = _read_csv(csv_text)

    imported = updated = skipped = 0
    result_rows: list[dict[str, Any]] = []

    for row in raw_rows:
        player_name = row.get("player", "").strip()
        position = row.get("position", "").strip().upper()
        team_name = row.get("team", "").strip()
        consecutive_seasons_raw = row.get("consecutive_seasons", "").strip()
        last_year_raw = row.get("last_kept_season_year", "").strip()

        if not player_name or not position or not team_name or not consecutive_seasons_raw:
            skipped += 1
            continue
        if position not in VALID_POSITIONS:
            skipped += 1
            continue
        team = teams.get(team_name.lower())
        if team is None:
            skipped += 1
            continue

        try:
            consecutive_seasons = int(consecutive_seasons_raw)
            if consecutive_seasons < 1:
                skipped += 1
                continue
        except ValueError:
            skipped += 1
            continue

        last_kept_season_year: int | None = None
        if last_year_raw:
            try:
                last_kept_season_year = int(last_year_raw)
            except ValueError:
                pass

        player = _find_player(session, player_name, position)
        if player is None:
            skipped += 1
            continue

        existing = session.exec(
            select(KeeperTenure).where(
                KeeperTenure.league_id == league_id,
                KeeperTenure.team_id == team.id,
                KeeperTenure.player_id == player.id,
            )
        ).first()

        if existing is not None:
            existing.consecutive_seasons = consecutive_seasons
            existing.last_kept_season_year = last_kept_season_year
            session.add(existing)
            updated += 1
        else:
            tenure = KeeperTenure(
                league_id=league_id,
                team_id=team.id,
                player_id=player.id,
                consecutive_seasons=consecutive_seasons,
                last_kept_season_year=last_kept_season_year,
            )
            session.add(tenure)
            imported += 1

        session.flush()
        result_rows.append({
            "team": team.name,
            "player": player.full_name,
            "position": player.position,
            "consecutive_seasons": consecutive_seasons,
            "last_kept_season_year": last_kept_season_year,
        })

    session.commit()
    return TenureImportResult(imported=imported, updated=updated, skipped=skipped, rows=result_rows)


# ---------------------------------------------------------------------------
# Delete
# ---------------------------------------------------------------------------

def delete_tenure(session: Session, league_id: uuid.UUID, tenure_id: uuid.UUID) -> None:
    tenure = session.exec(
        select(KeeperTenure).where(
            KeeperTenure.id == tenure_id,
            KeeperTenure.league_id == league_id,
        )
    ).first()
    if tenure is None:
        raise KeeperTenureError(f"Tenure record {tenure_id} not found in this league")
    session.delete(tenure)
    session.commit()


def clear_all_tenure(session: Session, league_id: uuid.UUID) -> int:
    tenures = session.exec(
        select(KeeperTenure).where(KeeperTenure.league_id == league_id)
    ).all()
    count = len(tenures)
    for t in tenures:
        session.delete(t)
    session.commit()
    return count


# ---------------------------------------------------------------------------
# Lookup helper used by optimizer
# ---------------------------------------------------------------------------

def get_tenure_map(
    session: Session,
    league_id: uuid.UUID,
) -> dict[tuple[uuid.UUID, uuid.UUID], int]:
    """Return {(team_id, player_id): consecutive_seasons} for a league."""
    tenures = session.exec(
        select(KeeperTenure).where(KeeperTenure.league_id == league_id)
    ).all()
    return {(t.team_id, t.player_id): t.consecutive_seasons for t in tenures}


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _require_league(session: Session, league_id: uuid.UUID) -> League:
    league = session.get(League, league_id)
    if league is None:
        raise KeeperTenureError(f"League {league_id} not found")
    return league


def _find_player(session: Session, full_name: str, position: str) -> Player | None:
    players = session.exec(
        select(Player).where(Player.full_name == full_name, Player.position == position)
    ).all()
    return players[0] if players else None


def _read_csv(csv_text: str) -> list[dict[str, str]]:
    reader = csv.DictReader(StringIO(csv_text.strip()))
    if not reader.fieldnames:
        raise KeeperTenureError("CSV header row is required")
    return [
        {str(k).strip().lower(): str(v or "").strip() for k, v in row.items() if k is not None}
        for row in reader
    ]
