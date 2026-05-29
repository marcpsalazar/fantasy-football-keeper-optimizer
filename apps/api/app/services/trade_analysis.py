from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Any

from sqlmodel import Session, select

from app.core.config import Settings
from app.models import (
    DraftPick,
    FinalRosterEntry,
    KeeperRecommendation,
    League,
    Player,
    Team,
)
from app.services.mock_draft_ai import MockDraftAIError, _responses_json
from app.services.optimizer import OptimizerInputError, run_optimizer


@dataclass(frozen=True)
class TradeGiveItem:
    player_id: uuid.UUID


@dataclass(frozen=True)
class TradeReceiveItem:
    player_id: uuid.UUID
    keeper_cost_round: int | None = None  # None = no existing pick (ADP-based cost)


@dataclass(frozen=True)
class TradePlayerRow:
    player_id: str
    player_name: str
    position: str
    nfl_team: str | None
    keeper_cost_pick: float | None
    keeper_cost_round: float | None
    adp_pick: float | None
    adp_round: float | None
    keeper_value: float | None
    keeper_score: float | None
    is_recommended: bool
    is_incoming: bool = False


@dataclass
class TradeNarrativeResult:
    verdict: str  # "good" | "neutral" | "bad"
    summary: str
    key_risk: str
    opportunity_cost: str
    token_usage: dict[str, Any] | None = None


@dataclass
class TradeAnalysisResult:
    receiving_team_id: str
    receiving_team_name: str
    baseline_keepers: list[TradePlayerRow]
    hypothetical_keepers: list[TradePlayerRow]
    baseline_surplus: float
    hypothetical_surplus: float
    surplus_delta: float
    gained: list[TradePlayerRow]
    lost: list[TradePlayerRow]
    ai_narrative: TradeNarrativeResult | None = None


def analyze_trade(
    session: Session,
    league_id: uuid.UUID,
    receiving_team_id: uuid.UUID,
    give: list[TradeGiveItem],
    receive: list[TradeReceiveItem],
    *,
    adp_snapshot_id: uuid.UUID | None = None,
    user_id: uuid.UUID | None = None,
    app_settings: Settings | None = None,
    include_ai: bool = False,
) -> TradeAnalysisResult:
    league = session.get(League, league_id)
    if league is None:
        raise OptimizerInputError(f"League {league_id} not found")

    receiving_team = session.get(Team, receiving_team_id)
    if receiving_team is None:
        raise OptimizerInputError(f"Team {receiving_team_id} not found")

    all_teams = session.exec(select(Team).where(Team.league_id == league_id)).all()
    team_count = len(all_teams) or 12
    draft_slot = receiving_team.draft_slot or (team_count // 2)

    # Baseline run — no DB changes, no persist
    baseline_recs = run_optimizer(
        session, league_id,
        user_id=user_id,
        adp_snapshot_id=adp_snapshot_id,
        persist=False,
    )
    baseline_team_recs = [r for r in baseline_recs if r.team_id == receiving_team_id]

    # Collect player metadata
    all_player_ids = (
        {r.player_id for r in baseline_recs}
        | {item.player_id for item in give}
        | {item.player_id for item in receive}
    )
    players: dict[uuid.UUID, Player] = {
        p.id: p
        for p in session.exec(select(Player).where(Player.id.in_(all_player_ids))).all()
    }

    # Validate received players exist
    for item in receive:
        if item.player_id not in players:
            raise OptimizerInputError(f"Player {item.player_id} not found")

    # Hypothetical run inside a savepoint — all changes are rolled back after
    savepoint = session.begin_nested()
    try:
        # Remove given-away players from receiving team
        for item in give:
            entry = session.exec(
                select(FinalRosterEntry).where(
                    FinalRosterEntry.league_id == league_id,
                    FinalRosterEntry.team_id == receiving_team_id,
                    FinalRosterEntry.player_id == item.player_id,
                    FinalRosterEntry.season_year == league.season_year,
                )
            ).first()
            if entry is not None:
                session.delete(entry)

            pick = session.exec(
                select(DraftPick).where(
                    DraftPick.league_id == league_id,
                    DraftPick.team_id == receiving_team_id,
                    DraftPick.player_id == item.player_id,
                    DraftPick.season_year == league.season_year,
                )
            ).first()
            if pick is not None:
                session.delete(pick)

        session.flush()

        # Add received players to receiving team
        for item in receive:
            player = players[item.player_id]

            existing_entry = session.exec(
                select(FinalRosterEntry).where(
                    FinalRosterEntry.league_id == league_id,
                    FinalRosterEntry.team_id == receiving_team_id,
                    FinalRosterEntry.player_id == item.player_id,
                    FinalRosterEntry.season_year == league.season_year,
                )
            ).first()
            if existing_entry is None:
                session.add(FinalRosterEntry(
                    league_id=league_id,
                    team_id=receiving_team_id,
                    player_id=item.player_id,
                    season_year=league.season_year,
                    position=player.position,
                    roster_status="Bench",
                ))

            if item.keeper_cost_round is not None:
                round_num = max(1, int(item.keeper_cost_round))
                target_overall = (round_num - 1) * team_count + draft_slot

                # Clear any pick already occupying this slot so the unique constraint holds
                conflicting = session.exec(
                    select(DraftPick).where(
                        DraftPick.league_id == league_id,
                        DraftPick.season_year == league.season_year,
                        DraftPick.overall_pick == target_overall,
                    )
                ).first()
                if conflicting is not None:
                    session.delete(conflicting)
                    session.flush()

                session.add(DraftPick(
                    league_id=league_id,
                    team_id=receiving_team_id,
                    player_id=item.player_id,
                    season_year=league.season_year,
                    round=round_num,
                    overall_pick=target_overall,
                    pick_in_round=draft_slot,
                    position=player.position,
                ))

        session.flush()

        hypo_recs = run_optimizer(
            session, league_id,
            user_id=user_id,
            adp_snapshot_id=adp_snapshot_id,
            persist=False,
        )
        hypo_team_recs = [r for r in hypo_recs if r.team_id == receiving_team_id]

    finally:
        savepoint.rollback()

    incoming_player_ids = {item.player_id for item in receive}

    baseline_rows = [
        _make_row(r, players, is_incoming=False)
        for r in sorted(baseline_team_recs, key=lambda r: -(r.keeper_score or 0))
        if r.is_recommended
    ]
    hypo_rows = [
        _make_row(r, players, is_incoming=r.player_id in incoming_player_ids)
        for r in sorted(hypo_team_recs, key=lambda r: -(r.keeper_score or 0))
        if r.is_recommended
    ]

    baseline_surplus = sum(r.keeper_value or 0 for r in baseline_team_recs if r.is_recommended)
    hypo_surplus = sum(r.keeper_value or 0 for r in hypo_team_recs if r.is_recommended)

    baseline_player_ids = {r.player_id for r in baseline_team_recs if r.is_recommended}
    hypo_player_ids = {r.player_id for r in hypo_team_recs if r.is_recommended}

    gained = [r for r in hypo_rows if uuid.UUID(r.player_id) not in baseline_player_ids]
    lost = [r for r in baseline_rows if uuid.UUID(r.player_id) not in hypo_player_ids]

    result = TradeAnalysisResult(
        receiving_team_id=str(receiving_team_id),
        receiving_team_name=receiving_team.name,
        baseline_keepers=baseline_rows,
        hypothetical_keepers=hypo_rows,
        baseline_surplus=round(baseline_surplus, 2),
        hypothetical_surplus=round(hypo_surplus, 2),
        surplus_delta=round(hypo_surplus - baseline_surplus, 2),
        gained=gained,
        lost=lost,
    )

    if include_ai and app_settings is not None:
        give_names = [players[i.player_id].full_name for i in give if i.player_id in players]
        receive_names = [players[i.player_id].full_name for i in receive if i.player_id in players]
        try:
            result.ai_narrative = generate_trade_narrative(
                settings=app_settings,
                result=result,
                give_names=give_names,
                receive_names=receive_names,
            )
        except MockDraftAIError:
            pass

    return result


def generate_trade_narrative(
    *,
    settings: Settings,
    result: TradeAnalysisResult,
    give_names: list[str],
    receive_names: list[str],
) -> TradeNarrativeResult:
    from app.services.mock_draft_ai import is_enabled as _ai_enabled

    if not _ai_enabled(settings):
        raise MockDraftAIError("AI is not enabled")

    context: dict[str, Any] = {
        "team_name": result.receiving_team_name,
        "giving_away": give_names,
        "receiving": receive_names,
        "baseline_keepers": [
            {
                "name": r.player_name,
                "position": r.position,
                "keeper_value": r.keeper_value,
                "keeper_cost_round": r.keeper_cost_round,
                "adp_round": r.adp_round,
            }
            for r in result.baseline_keepers
        ],
        "hypothetical_keepers": [
            {
                "name": r.player_name,
                "position": r.position,
                "keeper_value": r.keeper_value,
                "keeper_cost_round": r.keeper_cost_round,
                "adp_round": r.adp_round,
                "incoming": r.is_incoming,
            }
            for r in result.hypothetical_keepers
        ],
        "surplus_delta": result.surplus_delta,
        "gained": [r.player_name for r in result.gained],
        "lost": [r.player_name for r in result.lost],
    }

    schema = {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "verdict": {"type": "string", "enum": ["good", "neutral", "bad"]},
            "summary": {"type": "string", "maxLength": 500},
            "key_risk": {"type": "string", "maxLength": 300},
            "opportunity_cost": {"type": "string", "maxLength": 300},
        },
        "required": ["verdict", "summary", "key_risk", "opportunity_cost"],
    }

    data, usage = _responses_json(
        settings=settings,
        name="trade_analysis",
        schema=schema,
        instructions=(
            "You are a fantasy football keeper league analyst. Evaluate a proposed trade based on its "
            "keeper value impact for the receiving team. "
            "surplus_delta > 0 means the trade improves the team's total keeper surplus (positive). "
            "Set verdict to: 'good' if surplus_delta > 3 or the strategic fit is clearly better, "
            "'bad' if surplus_delta < -3 or the trade materially weakens keepers, 'neutral' otherwise. "
            "Be direct and specific. Mention player names. Return JSON only."
        ),
        user_payload=context,
        max_output_tokens=600,
    )

    return TradeNarrativeResult(
        verdict=str(data.get("verdict") or "neutral"),
        summary=str(data.get("summary") or "")[:500],
        key_risk=str(data.get("key_risk") or "")[:300],
        opportunity_cost=str(data.get("opportunity_cost") or "")[:300],
        token_usage=usage,
    )


def _make_row(
    rec: KeeperRecommendation,
    players: dict[uuid.UUID, Player],
    is_incoming: bool,
) -> TradePlayerRow:
    player = players.get(rec.player_id)
    return TradePlayerRow(
        player_id=str(rec.player_id),
        player_name=player.full_name if player else str(rec.player_id),
        position=player.position if player else "?",
        nfl_team=player.nfl_team if player else None,
        keeper_cost_pick=rec.keeper_cost_pick,
        keeper_cost_round=rec.keeper_cost_round,
        adp_pick=rec.adp_pick,
        adp_round=rec.adp_round,
        keeper_value=rec.keeper_value,
        keeper_score=rec.keeper_score,
        is_recommended=rec.is_recommended,
        is_incoming=is_incoming,
    )
