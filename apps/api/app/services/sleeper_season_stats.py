"""Sleeper Season Stats service.

Fetches end-of-season NFL player stats from Sleeper's public API and generates
KeeperOutcome records for all KeeperCandidate players in a league.

Available to all league admins regardless of which platform they use for their
league — the Sleeper stats API is global and requires no league-level Sleeper ID.

Cross-reference priority:
  1. Player.external_id (Sleeper player_id) — exact, used when league was imported from Sleeper
  2. Player.full_name + Player.nfl_team — name+team composite, covers manually-entered players

Positional finish rank is derived by sorting all Sleeper players at each
position by fantasy points descending (rank 1 = best).

was_kept is set based on FinalKeeperSelection records for the league/season.
If no FinalKeeperSelection records exist, was_kept defaults to None (unknown).
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any
import uuid

from sqlmodel import Session, select

from app.models import KeeperCandidate, KeeperOutcome, KeeperRecommendation, Player, Team
from app.models.final_keeper import FinalKeeperSelection
from app.models.league import League
from app.services.sleeper_import import (
    SleeperAPIError,
    _build_player_lookup,
    _fetch_json,
    SLEEPER_BASE,
)

SCORING_FORMAT_MAP: dict[str, str] = {
    "ppr": "pts_ppr",
    "superflex": "pts_ppr",
    "half_ppr": "pts_half_ppr",
    "half-ppr": "pts_half_ppr",
    "standard": "pts_std",
    "std": "pts_std",
}
DEFAULT_SCORING_FIELD = "pts_ppr"


class SleeperStatsError(ValueError):
    pass


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

@dataclass
class SleeperOutcomeRow:
    player_id: str
    player_name: str
    position: str
    nfl_team: str | None
    team_id: str
    team_name: str
    season_year: int
    fantasy_points: float | None
    finish_rank: int | None
    was_kept: bool | None
    keeper_cost_pick: float | None
    keeper_cost_round: float | None
    adp_pick_at_keep: float | None
    adp_round_at_keep: float | None
    keeper_value_at_keep: float | None
    met_adp_projection: bool | None
    is_bust: bool
    match_method: str  # "external_id" | "name_team" | "unmatched"


@dataclass
class SleeperOutcomesPreviewResult:
    season_year: int
    scoring_field: str
    matched: list[SleeperOutcomeRow]
    unmatched: list[dict[str, Any]]
    match_count: int
    unmatch_count: int
    kept_count: int
    candidate_count: int

    def to_payload(self) -> dict[str, Any]:
        return {
            "season_year": self.season_year,
            "scoring_field": self.scoring_field,
            "match_count": self.match_count,
            "unmatch_count": self.unmatch_count,
            "kept_count": self.kept_count,
            "candidate_count": self.candidate_count,
            "matched": [_row_to_dict(r) for r in self.matched],
            "unmatched": self.unmatched,
        }


@dataclass
class SleeperOutcomesImportResult:
    imported: int
    updated: int
    skipped: int
    rows: list[dict[str, Any]] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def preview_sleeper_season_outcomes(
    session: Session,
    league_id: uuid.UUID,
    season_year: int | None,
    scoring_format: str | None,
) -> SleeperOutcomesPreviewResult:
    league = _require_league(session, league_id)
    resolved_year = season_year or (league.season_year - 1)
    scoring_field = SCORING_FORMAT_MAP.get((scoring_format or "").lower(), DEFAULT_SCORING_FIELD)

    players_db, stats = _fetch_sleeper_data(resolved_year)
    candidates, players, teams = _load_league_data(session, league_id, resolved_year)
    kept_player_ids = _get_kept_player_ids(session, league_id, resolved_year)
    positional_ranks = _compute_positional_ranks(players_db, stats, scoring_field)
    team_count = len(teams) or 12

    matched: list[SleeperOutcomeRow] = []
    unmatched: list[dict[str, Any]] = []

    for candidate in candidates:
        player = players.get(candidate.player_id)
        team = teams.get(candidate.team_id)
        if player is None or team is None:
            continue

        sleeper_id, method = _match_player(player, players_db)
        if sleeper_id is None:
            unmatched.append({
                "player_name": player.full_name,
                "position": player.position,
                "nfl_team": player.nfl_team,
                "team_name": team.name,
            })
            continue

        pts = _get_pts(stats, sleeper_id, scoring_field)
        rank = positional_ranks.get(player.position, {}).get(sleeper_id)
        was_kept: bool | None = (
            candidate.player_id in kept_player_ids
            if kept_player_ids is not None
            else None
        )

        rec = _get_recommendation(session, league_id, candidate.team_id, candidate.player_id)
        keeper_cost_pick = rec.keeper_cost_pick if rec else None
        keeper_cost_round = rec.keeper_cost_round if rec else None
        adp_pick = rec.adp_pick if rec else None
        adp_round = rec.adp_round if rec else None
        keeper_value = rec.keeper_value if rec else None

        met_proj, is_bust = _compute_signals(rank, adp_pick, team_count)

        matched.append(SleeperOutcomeRow(
            player_id=str(candidate.player_id),
            player_name=player.full_name,
            position=player.position,
            nfl_team=player.nfl_team,
            team_id=str(candidate.team_id),
            team_name=team.name,
            season_year=resolved_year,
            fantasy_points=pts,
            finish_rank=rank,
            was_kept=was_kept,
            keeper_cost_pick=keeper_cost_pick,
            keeper_cost_round=keeper_cost_round,
            adp_pick_at_keep=adp_pick,
            adp_round_at_keep=adp_round,
            keeper_value_at_keep=keeper_value,
            met_adp_projection=met_proj,
            is_bust=is_bust,
            match_method=method,
        ))

    kept_count = sum(1 for r in matched if r.was_kept is True)
    return SleeperOutcomesPreviewResult(
        season_year=resolved_year,
        scoring_field=scoring_field,
        matched=matched,
        unmatched=unmatched,
        match_count=len(matched),
        unmatch_count=len(unmatched),
        kept_count=kept_count,
        candidate_count=len(candidates),
    )


def import_sleeper_season_outcomes(
    session: Session,
    league_id: uuid.UUID,
    season_year: int | None,
    scoring_format: str | None,
) -> SleeperOutcomesImportResult:
    preview = preview_sleeper_season_outcomes(session, league_id, season_year, scoring_format)
    imported = updated = skipped = 0
    result_rows: list[dict[str, Any]] = []

    for row in preview.matched:
        player_uuid = uuid.UUID(row.player_id)
        team_uuid = uuid.UUID(row.team_id)

        existing = session.exec(
            select(KeeperOutcome).where(
                KeeperOutcome.league_id == league_id,
                KeeperOutcome.team_id == team_uuid,
                KeeperOutcome.player_id == player_uuid,
                KeeperOutcome.season_year == row.season_year,
            )
        ).first()

        if existing is not None:
            existing.fantasy_points = row.fantasy_points
            existing.finish_rank = row.finish_rank
            existing.was_kept = row.was_kept if row.was_kept is not None else existing.was_kept
            existing.met_adp_projection = row.met_adp_projection
            existing.is_bust = row.is_bust
            existing.keeper_cost_pick = row.keeper_cost_pick
            existing.keeper_cost_round = row.keeper_cost_round
            existing.adp_pick_at_keep = row.adp_pick_at_keep
            existing.adp_round_at_keep = row.adp_round_at_keep
            existing.keeper_value_at_keep = row.keeper_value_at_keep
            session.add(existing)
            updated += 1
        else:
            outcome = KeeperOutcome(
                league_id=league_id,
                team_id=team_uuid,
                player_id=player_uuid,
                season_year=row.season_year,
                fantasy_points=row.fantasy_points,
                finish_rank=row.finish_rank,
                was_kept=row.was_kept if row.was_kept is not None else True,
                met_adp_projection=row.met_adp_projection,
                is_bust=row.is_bust,
                keeper_cost_pick=row.keeper_cost_pick,
                keeper_cost_round=row.keeper_cost_round,
                adp_pick_at_keep=row.adp_pick_at_keep,
                adp_round_at_keep=row.adp_round_at_keep,
                keeper_value_at_keep=row.keeper_value_at_keep,
            )
            session.add(outcome)
            imported += 1

        session.flush()
        result_rows.append(_row_to_dict(row))

    skipped = preview.unmatch_count
    session.commit()
    return SleeperOutcomesImportResult(
        imported=imported,
        updated=updated,
        skipped=skipped,
        rows=result_rows,
    )


# ---------------------------------------------------------------------------
# Sleeper data fetch
# ---------------------------------------------------------------------------

def _fetch_sleeper_data(season_year: int) -> tuple[dict[str, Any], dict[str, Any]]:
    """Returns (players_db, stats) from Sleeper API."""
    try:
        players_db = _fetch_json(f"{SLEEPER_BASE}/players/nfl") or {}
        stats = _fetch_json(f"{SLEEPER_BASE}/stats/nfl/regular/{season_year}") or {}
    except SleeperAPIError as exc:
        raise SleeperStatsError(str(exc)) from exc
    return players_db, stats


# ---------------------------------------------------------------------------
# League data helpers
# ---------------------------------------------------------------------------

def _load_league_data(
    session: Session,
    league_id: uuid.UUID,
    season_year: int,
) -> tuple[list[KeeperCandidate], dict[uuid.UUID, Player], dict[uuid.UUID, Team]]:
    candidates = session.exec(
        select(KeeperCandidate).where(
            KeeperCandidate.league_id == league_id,
            KeeperCandidate.season_year == season_year,
        )
    ).all()

    # Fall back to any season if no candidates for the target year
    if not candidates:
        candidates = session.exec(
            select(KeeperCandidate).where(KeeperCandidate.league_id == league_id)
        ).all()

    player_ids = {c.player_id for c in candidates}
    team_ids = {c.team_id for c in candidates}
    players = {p.id: p for p in session.exec(
        select(Player).where(Player.id.in_(player_ids))
    ).all()} if player_ids else {}
    teams = {t.id: t for t in session.exec(
        select(Team).where(Team.id.in_(team_ids))
    ).all()} if team_ids else {}

    return list(candidates), players, teams


def _get_kept_player_ids(
    session: Session,
    league_id: uuid.UUID,
    season_year: int,
) -> set[uuid.UUID] | None:
    """Returns set of player_ids that were actually kept, or None if no FinalKeeperSelections exist."""
    selections = session.exec(
        select(FinalKeeperSelection).where(
            FinalKeeperSelection.league_id == league_id,
            FinalKeeperSelection.season_year == season_year,
        )
    ).all()
    if not selections:
        return None
    return {s.player_id for s in selections}


def _get_recommendation(
    session: Session,
    league_id: uuid.UUID,
    team_id: uuid.UUID,
    player_id: uuid.UUID,
) -> KeeperRecommendation | None:
    return session.exec(
        select(KeeperRecommendation).where(
            KeeperRecommendation.league_id == league_id,
            KeeperRecommendation.team_id == team_id,
            KeeperRecommendation.player_id == player_id,
            KeeperRecommendation.scenario_name == "Default",
        )
    ).first()


# ---------------------------------------------------------------------------
# Matching and ranking
# ---------------------------------------------------------------------------

def _match_player(
    player: Player,
    players_db: dict[str, Any],
) -> tuple[str | None, str]:
    """Returns (sleeper_player_id, match_method). match_method is 'external_id', 'name_team', or 'unmatched'."""
    # Priority 1: external_id (Sleeper player_id stored at import time)
    if player.external_id and player.external_id in players_db:
        return player.external_id, "external_id"

    # Priority 2: full_name + nfl_team composite
    name_lower = player.full_name.lower()
    team_lower = (player.nfl_team or "").lower()
    for pid, p in players_db.items():
        if not isinstance(p, dict):
            continue
        p_name = (p.get("full_name") or "").lower()
        p_team = (p.get("team") or "").lower()
        if p_name == name_lower and p_team and p_team == team_lower:
            return pid, "name_team"

    # Priority 3: full_name only (less precise, flag as name_team with no team confirmation)
    for pid, p in players_db.items():
        if not isinstance(p, dict):
            continue
        p_name = (p.get("full_name") or "").lower()
        if p_name == name_lower:
            return pid, "name_team"

    return None, "unmatched"


def _compute_positional_ranks(
    players_db: dict[str, Any],
    stats: dict[str, Any],
    scoring_field: str,
) -> dict[str, dict[str, int]]:
    """Returns position → {sleeper_player_id → finish_rank}."""
    by_position: dict[str, list[tuple[str, float]]] = {}
    player_lookup = _build_player_lookup(players_db)

    for pid, player_meta in player_lookup.items():
        pos = player_meta.get("position")
        if not pos:
            continue
        player_stats = stats.get(pid)
        if not isinstance(player_stats, dict):
            continue
        pts = player_stats.get(scoring_field)
        if pts is None:
            continue
        try:
            pts_float = float(pts)
        except (TypeError, ValueError):
            continue
        by_position.setdefault(pos, []).append((pid, pts_float))

    result: dict[str, dict[str, int]] = {}
    for pos, entries in by_position.items():
        sorted_entries = sorted(entries, key=lambda x: -x[1])
        result[pos] = {pid: rank + 1 for rank, (pid, _) in enumerate(sorted_entries)}

    return result


def _get_pts(
    stats: dict[str, Any],
    sleeper_id: str,
    scoring_field: str,
) -> float | None:
    player_stats = stats.get(sleeper_id)
    if not isinstance(player_stats, dict):
        return None
    val = player_stats.get(scoring_field)
    if val is None:
        return None
    try:
        return float(val)
    except (TypeError, ValueError):
        return None


def _compute_signals(
    finish_rank: int | None,
    adp_pick: float | None,
    team_count: int,
) -> tuple[bool | None, bool]:
    if finish_rank is None or adp_pick is None:
        return None, False
    implied_tier = math.ceil(adp_pick / team_count)
    met = finish_rank <= round(implied_tier * 1.5)
    bust = finish_rank > round(implied_tier * 3.0)
    return met, bust


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _require_league(session: Session, league_id: uuid.UUID) -> League:
    league = session.get(League, league_id)
    if league is None:
        raise SleeperStatsError(f"League {league_id} not found")
    return league


def _row_to_dict(row: SleeperOutcomeRow) -> dict[str, Any]:
    return {
        "player_id": row.player_id,
        "player_name": row.player_name,
        "position": row.position,
        "nfl_team": row.nfl_team,
        "team_id": row.team_id,
        "team_name": row.team_name,
        "season_year": row.season_year,
        "fantasy_points": row.fantasy_points,
        "finish_rank": row.finish_rank,
        "was_kept": row.was_kept,
        "keeper_cost_pick": row.keeper_cost_pick,
        "keeper_cost_round": row.keeper_cost_round,
        "adp_pick_at_keep": row.adp_pick_at_keep,
        "adp_round_at_keep": row.adp_round_at_keep,
        "keeper_value_at_keep": row.keeper_value_at_keep,
        "met_adp_projection": row.met_adp_projection,
        "is_bust": row.is_bust,
        "match_method": row.match_method,
    }
