"""Historical Keeper ROI Tracker service.

Handles end-of-season outcome CSV imports and multi-year ROI aggregation.

CSV format (admin import):
    player,position,team,season_year,finish_rank,fantasy_points[,met_projection,is_bust,notes]

Where:
  - player / position / team: matched to existing Player and Team records
  - season_year: defaults to league.season_year - 1 if omitted
  - finish_rank: positional rank for the season (1 = best at that position)
  - fantasy_points: total fantasy points scored
  - met_projection (optional bool): admin override; auto-computed if omitted
  - is_bust (optional bool): admin override; auto-computed if omitted
  - notes (optional): free-text note

Auto-computation rules (applied when the optional columns are absent):
  - met_adp_projection: finish_rank <= round(adp_pick_at_keep / team_count * 1.5)
      i.e. player finished within ~50% of their ADP-implied positional tier
  - is_bust: finish_rank > round(adp_pick_at_keep / team_count * 3.0)
      i.e. finished 3× worse than their ADP-implied tier
  If no KeeperRecommendation is found (player was not formally recommended),
  both fields are left as None / False.
"""
from __future__ import annotations

import csv
import math
from dataclasses import dataclass
from io import StringIO
from typing import Any
import uuid

from sqlmodel import Session, select

from app.models import KeeperOutcome, KeeperRecommendation, League, Player, Team

VALID_POSITIONS = {"QB", "RB", "WR", "TE", "K", "DEF", "DST"}


class KeeperHistoryImportError(ValueError):
    pass


# ---------------------------------------------------------------------------
# CSV preview
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class OutcomePreviewRow:
    row_number: int
    player_name: str
    position: str
    team_name: str
    season_year: int
    finish_rank: int | None
    fantasy_points: float | None
    met_projection_override: bool | None
    is_bust_override: bool | None
    notes: str | None
    warning: str | None
    error: str | None


@dataclass(frozen=True)
class OutcomePreviewResult:
    valid: bool
    total_rows: int
    valid_rows: int
    rows: list[dict[str, Any]]
    errors: list[dict[str, Any]]
    warnings: list[dict[str, Any]]

    def to_payload(self) -> dict[str, Any]:
        columns = list(self.rows[0].keys()) if self.rows else []
        return {
            "kind": "keeper-outcomes",
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


def preview_outcomes_csv(
    session: Session,
    league_id: uuid.UUID,
    csv_text: str,
) -> OutcomePreviewResult:
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
        season_year_raw = row.get("season_year", "").strip()
        finish_rank_raw = row.get("finish_rank", "").strip()
        fantasy_points_raw = row.get("fantasy_points", "").strip()

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

        season_year = league.season_year - 1
        if season_year_raw:
            try:
                season_year = int(season_year_raw)
            except ValueError:
                row_errors.append(f"season_year '{season_year_raw}' is not a valid integer")

        finish_rank: int | None = None
        if finish_rank_raw:
            try:
                finish_rank = int(finish_rank_raw)
                if finish_rank < 1:
                    row_errors.append("finish_rank must be >= 1")
            except ValueError:
                row_errors.append(f"finish_rank '{finish_rank_raw}' is not a valid integer")

        fantasy_points: float | None = None
        if fantasy_points_raw:
            try:
                fantasy_points = float(fantasy_points_raw)
            except ValueError:
                row_errors.append(f"fantasy_points '{fantasy_points_raw}' is not a valid number")

        if not finish_rank and not fantasy_points:
            row_warnings.append("no finish_rank or fantasy_points supplied — outcome recorded with no result data")

        preview_rows.append({
            "row_number": i,
            "player": player_name,
            "position": position,
            "team": team_name,
            "season_year": season_year,
            "finish_rank": finish_rank,
            "fantasy_points": fantasy_points,
            "errors": row_errors,
            "warnings": row_warnings,
        })

        for msg in row_errors:
            errors.append({"row_number": i, "field": None, "message": msg, "severity": "error"})
        for msg in row_warnings:
            warnings.append({"row_number": i, "field": None, "message": msg, "severity": "warning"})

    valid_rows = sum(1 for r in preview_rows if not r["errors"])
    is_valid = len(errors) == 0 and valid_rows > 0

    return OutcomePreviewResult(
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
class OutcomeImportResult:
    imported: int
    updated: int
    skipped: int
    rows: list[dict[str, Any]]


def import_outcomes_csv(
    session: Session,
    league_id: uuid.UUID,
    csv_text: str,
) -> OutcomeImportResult:
    league = _require_league(session, league_id)
    teams = {t.name.lower(): t for t in session.exec(select(Team).where(Team.league_id == league_id)).all()}
    team_count = len(teams) or 12

    raw_rows = _read_csv(csv_text)
    imported = updated = skipped = 0
    result_rows: list[dict[str, Any]] = []

    for row in raw_rows:
        player_name = row.get("player", "").strip()
        position = row.get("position", "").strip().upper()
        team_name = row.get("team", "").strip()
        season_year_raw = row.get("season_year", "").strip()
        finish_rank_raw = row.get("finish_rank", "").strip()
        fantasy_points_raw = row.get("fantasy_points", "").strip()
        met_proj_raw = row.get("met_projection", row.get("met_adp_projection", "")).strip().lower()
        is_bust_raw = row.get("is_bust", "").strip().lower()
        notes = row.get("notes", "").strip() or None

        if not player_name or not position or not team_name:
            skipped += 1
            continue
        if position not in VALID_POSITIONS:
            skipped += 1
            continue
        team = teams.get(team_name.lower())
        if team is None:
            skipped += 1
            continue

        season_year = league.season_year - 1
        if season_year_raw:
            try:
                season_year = int(season_year_raw)
            except ValueError:
                skipped += 1
                continue

        finish_rank: int | None = None
        if finish_rank_raw:
            try:
                finish_rank = int(finish_rank_raw)
            except ValueError:
                pass

        fantasy_points: float | None = None
        if fantasy_points_raw:
            try:
                fantasy_points = float(fantasy_points_raw)
            except ValueError:
                pass

        player = _find_player(session, player_name, position)
        if player is None:
            skipped += 1
            continue

        # Cross-reference KeeperRecommendation for economics at time of keep
        rec = session.exec(
            select(KeeperRecommendation).where(
                KeeperRecommendation.league_id == league_id,
                KeeperRecommendation.team_id == team.id,
                KeeperRecommendation.player_id == player.id,
                KeeperRecommendation.scenario_name == "Default",
            )
        ).first()

        keeper_cost_pick = rec.keeper_cost_pick if rec else None
        keeper_cost_round = rec.keeper_cost_round if rec else None
        adp_pick_at_keep = rec.adp_pick if rec else None
        adp_round_at_keep = rec.adp_round if rec else None
        keeper_value_at_keep = rec.keeper_value if rec else None

        # Derive met_adp_projection and is_bust unless admin overrides
        met_adp_projection: bool | None = None
        is_bust = False

        if met_proj_raw in ("true", "1", "yes"):
            met_adp_projection = True
        elif met_proj_raw in ("false", "0", "no"):
            met_adp_projection = False
        elif finish_rank is not None and adp_pick_at_keep is not None:
            implied_tier = math.ceil(adp_pick_at_keep / team_count)
            met_adp_projection = finish_rank <= round(implied_tier * 1.5)

        if is_bust_raw in ("true", "1", "yes"):
            is_bust = True
        elif is_bust_raw in ("false", "0", "no"):
            is_bust = False
        elif finish_rank is not None and adp_pick_at_keep is not None:
            implied_tier = math.ceil(adp_pick_at_keep / team_count)
            is_bust = finish_rank > round(implied_tier * 3.0)

        existing = session.exec(
            select(KeeperOutcome).where(
                KeeperOutcome.league_id == league_id,
                KeeperOutcome.team_id == team.id,
                KeeperOutcome.player_id == player.id,
                KeeperOutcome.season_year == season_year,
            )
        ).first()

        if existing is not None:
            existing.finish_rank = finish_rank
            existing.fantasy_points = fantasy_points
            existing.met_adp_projection = met_adp_projection
            existing.is_bust = is_bust
            existing.keeper_cost_pick = keeper_cost_pick
            existing.keeper_cost_round = keeper_cost_round
            existing.adp_pick_at_keep = adp_pick_at_keep
            existing.adp_round_at_keep = adp_round_at_keep
            existing.keeper_value_at_keep = keeper_value_at_keep
            existing.notes = notes
            session.add(existing)
            updated += 1
            outcome = existing
        else:
            outcome = KeeperOutcome(
                league_id=league_id,
                team_id=team.id,
                player_id=player.id,
                season_year=season_year,
                keeper_cost_pick=keeper_cost_pick,
                keeper_cost_round=keeper_cost_round,
                adp_pick_at_keep=adp_pick_at_keep,
                adp_round_at_keep=adp_round_at_keep,
                keeper_value_at_keep=keeper_value_at_keep,
                finish_rank=finish_rank,
                fantasy_points=fantasy_points,
                met_adp_projection=met_adp_projection,
                is_bust=is_bust,
                notes=notes,
            )
            session.add(outcome)
            imported += 1

        session.flush()
        result_rows.append({
            "team": team.name,
            "player": player.full_name,
            "position": player.position,
            "season_year": season_year,
            "finish_rank": finish_rank,
            "fantasy_points": fantasy_points,
            "met_adp_projection": met_adp_projection,
            "is_bust": is_bust,
        })

    session.commit()
    return OutcomeImportResult(imported=imported, updated=updated, skipped=skipped, rows=result_rows)


# ---------------------------------------------------------------------------
# History aggregation
# ---------------------------------------------------------------------------

def get_keeper_history(session: Session, league_id: uuid.UUID) -> dict[str, Any]:
    outcomes = session.exec(
        select(KeeperOutcome).where(KeeperOutcome.league_id == league_id)
    ).all()

    if not outcomes:
        return {"league_summary": [], "team_history": [], "player_history": []}

    player_ids = {o.player_id for o in outcomes}
    team_ids = {o.team_id for o in outcomes}
    players = {p.id: p for p in session.exec(select(Player).where(Player.id.in_(player_ids))).all()}
    teams = {t.id: t for t in session.exec(select(Team).where(Team.id.in_(team_ids))).all()}

    # ── League-level summary by season ───────────────────────────────────────
    by_season: dict[int, list[KeeperOutcome]] = {}
    for o in outcomes:
        by_season.setdefault(o.season_year, []).append(o)

    league_summary = []
    for yr in sorted(by_season.keys()):
        season_outcomes = by_season[yr]
        total = len(season_outcomes)
        met = sum(1 for o in season_outcomes if o.met_adp_projection is True)
        busts = sum(1 for o in season_outcomes if o.is_bust)
        surplus_vals = [o.keeper_value_at_keep for o in season_outcomes if o.keeper_value_at_keep is not None]
        avg_surplus = round(sum(surplus_vals) / len(surplus_vals), 2) if surplus_vals else None
        league_summary.append({
            "season_year": yr,
            "total_keepers": total,
            "met_projection_count": met,
            "met_projection_pct": round(met / total, 3) if total else None,
            "bust_count": busts,
            "bust_pct": round(busts / total, 3) if total else None,
            "avg_surplus_rounds": avg_surplus,
        })

    # ── Team-level history ────────────────────────────────────────────────────
    by_team: dict[uuid.UUID, list[KeeperOutcome]] = {}
    for o in outcomes:
        by_team.setdefault(o.team_id, []).append(o)

    team_history = []
    for team_id, team_outcomes in sorted(
        by_team.items(), key=lambda kv: (teams[kv[0]].draft_slot or 999, teams[kv[0]].name)
    ):
        team = teams[team_id]
        total = len(team_outcomes)
        met = sum(1 for o in team_outcomes if o.met_adp_projection is True)
        busts = sum(1 for o in team_outcomes if o.is_bust)
        surplus_vals = [o.keeper_value_at_keep for o in team_outcomes if o.keeper_value_at_keep is not None]
        avg_surplus = round(sum(surplus_vals) / len(surplus_vals), 2) if surplus_vals else None
        seasons_seen = sorted({o.season_year for o in team_outcomes})
        team_history.append({
            "team_id": str(team_id),
            "team_name": team.name,
            "owner_name": team.owner_name,
            "seasons": len(seasons_seen),
            "season_years": seasons_seen,
            "total_keepers": total,
            "met_projection_count": met,
            "met_projection_pct": round(met / total, 3) if total else None,
            "bust_count": busts,
            "bust_pct": round(busts / total, 3) if total else None,
            "avg_surplus_rounds": avg_surplus,
            "outcomes": [_outcome_row(o, players, teams) for o in sorted(team_outcomes, key=lambda x: -x.season_year)],
        })

    # ── Player-level history ──────────────────────────────────────────────────
    by_player: dict[uuid.UUID, list[KeeperOutcome]] = {}
    for o in outcomes:
        by_player.setdefault(o.player_id, []).append(o)

    player_history = []
    for player_id, player_outcomes in sorted(
        by_player.items(),
        key=lambda kv: -len(kv[1]),
    ):
        player = players.get(player_id)
        if player is None:
            continue
        total = len(player_outcomes)
        met = sum(1 for o in player_outcomes if o.met_adp_projection is True)
        busts = sum(1 for o in player_outcomes if o.is_bust)
        ranks = [o.finish_rank for o in player_outcomes if o.finish_rank is not None]
        costs = [o.keeper_cost_round for o in player_outcomes if o.keeper_cost_round is not None]
        surplus_vals = [o.keeper_value_at_keep for o in player_outcomes if o.keeper_value_at_keep is not None]
        player_history.append({
            "player_id": str(player_id),
            "player_name": player.full_name,
            "position": player.position,
            "nfl_team": player.nfl_team,
            "times_kept": total,
            "avg_finish_rank": round(sum(ranks) / len(ranks), 1) if ranks else None,
            "avg_keeper_cost_round": round(sum(costs) / len(costs), 1) if costs else None,
            "avg_surplus_rounds": round(sum(surplus_vals) / len(surplus_vals), 2) if surplus_vals else None,
            "met_projection_count": met,
            "met_projection_pct": round(met / total, 3) if total else None,
            "bust_count": busts,
            "outcomes": [_outcome_row(o, players, teams) for o in sorted(player_outcomes, key=lambda x: -x.season_year)],
        })

    return {
        "league_summary": league_summary,
        "team_history": team_history,
        "player_history": player_history,
    }


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _outcome_row(
    o: KeeperOutcome,
    players: dict[uuid.UUID, Player],
    teams: dict[uuid.UUID, Team],
) -> dict[str, Any]:
    player = players.get(o.player_id)
    team = teams.get(o.team_id)
    return {
        "outcome_id": str(o.id),
        "season_year": o.season_year,
        "team_name": team.name if team else None,
        "player_name": player.full_name if player else None,
        "position": player.position if player else None,
        "keeper_cost_round": o.keeper_cost_round,
        "adp_round_at_keep": o.adp_round_at_keep,
        "keeper_value_at_keep": o.keeper_value_at_keep,
        "finish_rank": o.finish_rank,
        "fantasy_points": o.fantasy_points,
        "met_adp_projection": o.met_adp_projection,
        "is_bust": o.is_bust,
        "notes": o.notes,
    }


def _require_league(session: Session, league_id: uuid.UUID) -> League:
    league = session.get(League, league_id)
    if league is None:
        raise KeeperHistoryImportError(f"League {league_id} not found")
    return league


def _find_player(session: Session, full_name: str, position: str) -> Player | None:
    players = session.exec(
        select(Player).where(Player.full_name == full_name, Player.position == position)
    ).all()
    return players[0] if players else None


def _read_csv(csv_text: str) -> list[dict[str, str]]:
    reader = csv.DictReader(StringIO(csv_text.strip()))
    if not reader.fieldnames:
        raise KeeperHistoryImportError("CSV header row is required")
    return [
        {str(k).strip().lower(): str(v or "").strip() for k, v in row.items() if k is not None}
        for row in reader
    ]
