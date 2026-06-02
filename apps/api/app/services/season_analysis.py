"""End of Season Analysis service.

Compares what was recommended, what was actually kept (FinalKeeperSelection),
and how each player performed (KeeperOutcome) to produce a per-team and
league-level post-season decision quality report.

Decision categories per player:
  HIT           — kept, met_adp_projection is True
  MISS          — kept, met_adp_projection is False, not a bust
  BUST          — kept, is_bust is True
  LEFT_ON_TABLE — not kept, met_adp_projection would have been True (opportunity cost)
  DODGED        — not kept, is_bust is True (avoided a bust)
  BELOW_ADP     — not kept, met_adp_projection is False (passed correctly)
  UNKNOWN       — kept but no outcome data, or outcome data is incomplete
"""
from __future__ import annotations

from typing import Any
import uuid

from sqlmodel import Session, select

from app.models import KeeperOutcome, KeeperRecommendation, Player, Team
from app.models.final_keeper import FinalKeeperSelection
from app.models.league import League

DecisionCategory = str  # one of the literals below
HIT = "hit"
MISS = "miss"
BUST = "bust"
LEFT_ON_TABLE = "left_on_table"
DODGED = "dodged"
BELOW_ADP = "below_adp"
UNKNOWN = "unknown"


class SeasonAnalysisError(ValueError):
    pass


def get_season_analysis(
    session: Session,
    league_id: uuid.UUID,
    season_year: int | None = None,
) -> dict[str, Any]:
    league = _require_league(session, league_id)
    resolved_year = season_year or (league.season_year - 1)

    teams = session.exec(select(Team).where(Team.league_id == league_id)).all()
    if not teams:
        return _empty_result(resolved_year)

    # ── Load all data ────────────────────────────────────────────────────────
    recommendations = session.exec(
        select(KeeperRecommendation).where(
            KeeperRecommendation.league_id == league_id,
            KeeperRecommendation.scenario_name == "Default",
        )
    ).all()
    rec_by_team_player: dict[tuple[uuid.UUID, uuid.UUID], KeeperRecommendation] = {
        (r.team_id, r.player_id): r for r in recommendations
    }

    final_selections = session.exec(
        select(FinalKeeperSelection).where(
            FinalKeeperSelection.league_id == league_id,
            FinalKeeperSelection.season_year == resolved_year,
        )
    ).all()
    kept_set: set[tuple[uuid.UUID, uuid.UUID]] = {
        (s.team_id, s.player_id) for s in final_selections
    }

    outcomes = session.exec(
        select(KeeperOutcome).where(
            KeeperOutcome.league_id == league_id,
            KeeperOutcome.season_year == resolved_year,
        )
    ).all()
    outcome_by_team_player: dict[tuple[uuid.UUID, uuid.UUID], KeeperOutcome] = {
        (o.team_id, o.player_id): o for o in outcomes
    }

    player_ids = (
        {r.player_id for r in recommendations}
        | {s.player_id for s in final_selections}
        | {o.player_id for o in outcomes}
    )
    players: dict[uuid.UUID, Player] = {
        p.id: p
        for p in session.exec(select(Player).where(Player.id.in_(player_ids))).all()
    } if player_ids else {}

    has_final_selections = len(final_selections) > 0
    has_outcomes = len(outcomes) > 0

    # ── Per-team analysis ────────────────────────────────────────────────────
    league_hits = league_misses = league_busts = 0
    league_left_on_table = league_dodged = 0
    league_rec_followed = league_rec_ignored = league_rec_correct_pass = 0
    opportunity_cost_rounds: list[float] = []

    team_rows = []
    for team in sorted(teams, key=lambda t: (t.draft_slot or 999, t.name)):
        # All player IDs relevant to this team
        team_player_ids: set[uuid.UUID] = set()
        for (tid, pid) in rec_by_team_player:
            if tid == team.id:
                team_player_ids.add(pid)
        for (tid, pid) in kept_set:
            if tid == team.id:
                team_player_ids.add(pid)
        for (tid, pid) in outcome_by_team_player:
            if tid == team.id:
                team_player_ids.add(pid)

        decisions = []
        team_hits = team_misses = team_busts = 0
        team_left_on_table = team_dodged = 0
        team_opp_cost: list[float] = []

        for pid in sorted(team_player_ids, key=lambda p: players[p].full_name if p in players else ""):
            player = players.get(pid)
            if player is None:
                continue

            rec = rec_by_team_player.get((team.id, pid))
            outcome = outcome_by_team_player.get((team.id, pid))

            # was_kept: prefer FinalKeeperSelection (admin-confirmed), fall back to outcome flag
            was_kept = (team.id, pid) in kept_set
            if not was_kept and outcome is not None:
                was_kept = outcome.was_kept if outcome.was_kept is not None else False

            is_recommended = rec is not None and rec.is_recommended

            category = _categorize(was_kept, outcome)

            if category == HIT:
                team_hits += 1
                league_hits += 1
            elif category == MISS:
                team_misses += 1
                league_misses += 1
            elif category == BUST:
                team_busts += 1
                league_busts += 1
            elif category == LEFT_ON_TABLE:
                team_left_on_table += 1
                league_left_on_table += 1
                if outcome and outcome.keeper_value_at_keep is not None:
                    team_opp_cost.append(outcome.keeper_value_at_keep)
                    opportunity_cost_rounds.append(outcome.keeper_value_at_keep)
            elif category == DODGED:
                team_dodged += 1
                league_dodged += 1

            if is_recommended:
                if was_kept:
                    league_rec_followed += 1
                else:
                    if category in (LEFT_ON_TABLE, BELOW_ADP, DODGED):
                        league_rec_ignored += 1
                    if category in (BELOW_ADP, DODGED):
                        league_rec_correct_pass += 1

            decisions.append({
                "player_id": str(pid),
                "player_name": player.full_name,
                "position": player.position,
                "nfl_team": player.nfl_team,
                "was_kept": was_kept,
                "is_recommended": is_recommended,
                "keeper_cost_round": outcome.keeper_cost_round if outcome else (rec.keeper_cost_round if rec else None),
                "adp_round_at_keep": outcome.adp_round_at_keep if outcome else (rec.adp_round if rec else None),
                "keeper_value_at_keep": outcome.keeper_value_at_keep if outcome else (rec.keeper_value if rec else None),
                "finish_rank": outcome.finish_rank if outcome else None,
                "fantasy_points": outcome.fantasy_points if outcome else None,
                "met_adp_projection": outcome.met_adp_projection if outcome else None,
                "is_bust": outcome.is_bust if outcome else False,
                "category": category,
            })

        team_kept_count = sum(1 for d in decisions if d["was_kept"])
        team_rec_kept = sum(1 for d in decisions if d["was_kept"] and d["is_recommended"])
        team_rec_hit = sum(1 for d in decisions if d["was_kept"] and d["is_recommended"] and d["category"] == HIT)
        avg_opp_cost = round(sum(team_opp_cost) / len(team_opp_cost), 2) if team_opp_cost else None

        team_rows.append({
            "team_id": str(team.id),
            "team_name": team.name,
            "owner_name": team.owner_name,
            "draft_slot": team.draft_slot,
            "keepers_kept": team_kept_count,
            "hits": team_hits,
            "misses": team_misses,
            "busts": team_busts,
            "left_on_table_count": team_left_on_table,
            "dodged_count": team_dodged,
            "rec_followed_count": team_rec_kept,
            "rec_hit_rate": round(team_rec_hit / team_rec_kept, 3) if team_rec_kept else None,
            "avg_opportunity_cost_rounds": avg_opp_cost,
            "decisions": sorted(decisions, key=lambda d: _category_sort_order(d["category"])),
        })

    # ── League summary ───────────────────────────────────────────────────────
    total_kept = league_hits + league_misses + league_busts
    rec_hit_rate = None
    if league_rec_followed > 0:
        rec_hits = sum(
            1 for t in team_rows
            for d in t["decisions"]
            if d["was_kept"] and d["is_recommended"] and d["category"] == HIT
        )
        rec_hit_rate = round(rec_hits / league_rec_followed, 3)

    league_summary = {
        "season_year": resolved_year,
        "total_kept": total_kept,
        "hits": league_hits,
        "misses": league_misses,
        "busts": league_busts,
        "hit_rate": round(league_hits / total_kept, 3) if total_kept else None,
        "bust_rate": round(league_busts / total_kept, 3) if total_kept else None,
        "left_on_table_count": league_left_on_table,
        "dodged_count": league_dodged,
        "rec_followed_count": league_rec_followed,
        "rec_hit_rate": rec_hit_rate,
        "avg_opportunity_cost_rounds": (
            round(sum(opportunity_cost_rounds) / len(opportunity_cost_rounds), 2)
            if opportunity_cost_rounds else None
        ),
        "has_final_selections": has_final_selections,
        "has_outcomes": has_outcomes,
    }

    return {
        "season_year": resolved_year,
        "league_summary": league_summary,
        "teams": team_rows,
    }


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _categorize(was_kept: bool, outcome: KeeperOutcome | None) -> DecisionCategory:
    if outcome is None:
        return UNKNOWN
    if was_kept:
        if outcome.is_bust:
            return BUST
        if outcome.met_adp_projection is True:
            return HIT
        if outcome.met_adp_projection is False:
            return MISS
        return UNKNOWN
    else:
        if outcome.is_bust:
            return DODGED
        if outcome.met_adp_projection is True:
            return LEFT_ON_TABLE
        if outcome.met_adp_projection is False:
            return BELOW_ADP
        return UNKNOWN


def _category_sort_order(category: str) -> int:
    return {HIT: 0, LEFT_ON_TABLE: 1, MISS: 2, BUST: 3, DODGED: 4, BELOW_ADP: 5, UNKNOWN: 6}.get(category, 7)


def _empty_result(season_year: int) -> dict[str, Any]:
    return {
        "season_year": season_year,
        "league_summary": {
            "season_year": season_year,
            "total_kept": 0,
            "hits": 0, "misses": 0, "busts": 0,
            "hit_rate": None, "bust_rate": None,
            "left_on_table_count": 0, "dodged_count": 0,
            "rec_followed_count": 0, "rec_hit_rate": None,
            "avg_opportunity_cost_rounds": None,
            "has_final_selections": False, "has_outcomes": False,
        },
        "teams": [],
    }


def _require_league(session: Session, league_id: uuid.UUID) -> League:
    league = session.get(League, league_id)
    if league is None:
        raise SeasonAnalysisError(f"League {league_id} not found")
    return league
