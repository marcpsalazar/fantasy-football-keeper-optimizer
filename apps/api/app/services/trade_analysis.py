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
class TradeGivePickItem:
    round: int  # Give away the pick in this round (deletes team's DraftPick in that round)


@dataclass(frozen=True)
class TradeReceiveItem:
    player_id: uuid.UUID
    keeper_cost_round: int | None = None  # None = no existing pick (ADP-based cost)


@dataclass(frozen=True)
class TradeReceivePickItem:
    round: int  # Incoming pick round — auto-assigned to best uncovered roster player


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
    verdict: str  # "good" | "neutral" | "bad" from Team A perspective
    recommendation: str  # "proceed" | "modify" | "decline"
    summary: str
    team_a_analysis: str
    team_b_analysis: str
    modifications: list[str]
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
    give_picks_value: float
    receive_picks_value: float
    pick_value_delta: float
    total_value_delta: float
    gained: list[TradePlayerRow]
    lost: list[TradePlayerRow]
    # Team B side
    giving_team_id: str = ""
    giving_team_name: str = ""
    giving_baseline_keepers: list[TradePlayerRow] = None  # type: ignore[assignment]
    giving_hypothetical_keepers: list[TradePlayerRow] = None  # type: ignore[assignment]
    giving_baseline_surplus: float = 0.0
    giving_hypothetical_surplus: float = 0.0
    giving_surplus_delta: float = 0.0
    giving_total_value_delta: float = 0.0
    ai_narrative: TradeNarrativeResult | None = None

    def __post_init__(self) -> None:
        if self.giving_baseline_keepers is None:
            self.giving_baseline_keepers = []
        if self.giving_hypothetical_keepers is None:
            self.giving_hypothetical_keepers = []


def round_pick_value(pick_round: int, total_rounds: int = 15) -> float:
    """
    Pick value in keeper-surplus-equivalent rounds using a convex declining curve.
    Round 1 ≈ 5.0, last round ≈ 0.0.
    """
    if pick_round < 1:
        return 0.0
    total = max(total_rounds, pick_round)
    if total <= 1:
        return 0.0
    frac = max(0.0, (total - pick_round) / (total - 1))
    return round(5.0 * (frac ** 1.8), 2)


def analyze_trade(
    session: Session,
    league_id: uuid.UUID,
    receiving_team_id: uuid.UUID,
    give: list[TradeGiveItem],
    receive: list[TradeReceiveItem],
    *,
    giving_team_id: uuid.UUID | None = None,
    give_picks: list[TradeGivePickItem] | None = None,
    receive_picks: list[TradeReceivePickItem] | None = None,
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
    give_picks = give_picks or []
    receive_picks = receive_picks or []

    # Baseline run — no DB changes, no persist
    baseline_recs = run_optimizer(
        session, league_id,
        user_id=user_id,
        adp_snapshot_id=adp_snapshot_id,
        persist=False,
    )
    baseline_team_recs = [r for r in baseline_recs if r.team_id == receiving_team_id]

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

    # Pre-fetch keeper rounds for players Team A is giving away (needed for Team B side)
    give_player_keeper_rounds: dict[uuid.UUID, int | None] = {}
    for item in give:
        pick = session.exec(
            select(DraftPick).where(
                DraftPick.league_id == league_id,
                DraftPick.team_id == receiving_team_id,
                DraftPick.player_id == item.player_id,
                DraftPick.season_year == league.season_year,
            )
        ).first()
        give_player_keeper_rounds[item.player_id] = pick.round if pick else None

    giving_team = session.get(Team, giving_team_id) if giving_team_id else None
    giving_team_baseline_recs = [r for r in baseline_recs if r.team_id == giving_team_id] if giving_team_id else []

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

        # Remove given-away picks (by round): deletes whatever pick the team has in that round
        for pick_item in give_picks:
            picks_in_round = session.exec(
                select(DraftPick).where(
                    DraftPick.league_id == league_id,
                    DraftPick.team_id == receiving_team_id,
                    DraftPick.season_year == league.season_year,
                    DraftPick.round == pick_item.round,
                )
            ).all()
            for p in picks_in_round:
                session.delete(p)

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

        # Received picks are valued separately below — no keeper slot assignment needed

        # Apply Team B hypothetical changes in the same savepoint
        if giving_team is not None:
            giving_draft_slot = giving_team.draft_slot or (team_count // 2)

            # Team B loses the players it is sending to Team A
            for item in receive:
                b_entry = session.exec(
                    select(FinalRosterEntry).where(
                        FinalRosterEntry.league_id == league_id,
                        FinalRosterEntry.team_id == giving_team_id,
                        FinalRosterEntry.player_id == item.player_id,
                        FinalRosterEntry.season_year == league.season_year,
                    )
                ).first()
                if b_entry is not None:
                    session.delete(b_entry)
                b_pick = session.exec(
                    select(DraftPick).where(
                        DraftPick.league_id == league_id,
                        DraftPick.team_id == giving_team_id,
                        DraftPick.player_id == item.player_id,
                        DraftPick.season_year == league.season_year,
                    )
                ).first()
                if b_pick is not None:
                    session.delete(b_pick)

            # Team B loses the picks it is sending to Team A
            for pick_item in receive_picks:
                b_round_picks = session.exec(
                    select(DraftPick).where(
                        DraftPick.league_id == league_id,
                        DraftPick.team_id == giving_team_id,
                        DraftPick.season_year == league.season_year,
                        DraftPick.round == pick_item.round,
                    )
                ).all()
                for p in b_round_picks:
                    session.delete(p)

            session.flush()

            # Team B gains the players from Team A (with their original keeper costs)
            for item in give:
                player = players.get(item.player_id)
                if player is None:
                    continue
                b_existing = session.exec(
                    select(FinalRosterEntry).where(
                        FinalRosterEntry.league_id == league_id,
                        FinalRosterEntry.team_id == giving_team_id,
                        FinalRosterEntry.player_id == item.player_id,
                        FinalRosterEntry.season_year == league.season_year,
                    )
                ).first()
                if b_existing is None:
                    session.add(FinalRosterEntry(
                        league_id=league_id,
                        team_id=giving_team_id,
                        player_id=item.player_id,
                        season_year=league.season_year,
                        position=player.position,
                        roster_status="Bench",
                    ))
                keeper_round = give_player_keeper_rounds.get(item.player_id)
                if keeper_round is not None:
                    b_target = (keeper_round - 1) * team_count + giving_draft_slot
                    b_conflict = session.exec(
                        select(DraftPick).where(
                            DraftPick.league_id == league_id,
                            DraftPick.season_year == league.season_year,
                            DraftPick.overall_pick == b_target,
                        )
                    ).first()
                    if b_conflict is not None:
                        session.delete(b_conflict)
                        session.flush()
                    session.add(DraftPick(
                        league_id=league_id,
                        team_id=giving_team_id,
                        player_id=item.player_id,
                        season_year=league.season_year,
                        round=keeper_round,
                        overall_pick=b_target,
                        pick_in_round=giving_draft_slot,
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
        giving_hypo_recs = [r for r in hypo_recs if r.team_id == giving_team_id] if giving_team_id else []

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

    total_rounds = 16
    if isinstance(league.roster_settings, dict):
        slots = league.roster_settings.get("slots")
        if isinstance(slots, dict):
            derived = sum(int(v) for v in slots.values() if isinstance(v, (int, float)) and int(v) > 0)
            if derived > 0:
                total_rounds = derived

    give_picks_value = round(sum(round_pick_value(p.round, total_rounds) for p in give_picks), 2)
    receive_picks_value = round(sum(round_pick_value(p.round, total_rounds) for p in receive_picks), 2)
    pick_value_delta = round(receive_picks_value - give_picks_value, 2)
    surplus_delta = round(hypo_surplus - baseline_surplus, 2)

    # Team B rows and surplus
    giving_incoming_ids = {item.player_id for item in give}
    giving_baseline_rows = [
        _make_row(r, players, is_incoming=False)
        for r in sorted(giving_team_baseline_recs, key=lambda r: -(r.keeper_score or 0))
        if r.is_recommended
    ]
    giving_hypo_rows = [
        _make_row(r, players, is_incoming=r.player_id in giving_incoming_ids)
        for r in sorted(giving_hypo_recs, key=lambda r: -(r.keeper_score or 0))
        if r.is_recommended
    ]
    giving_baseline_surplus = sum(r.keeper_value or 0 for r in giving_team_baseline_recs if r.is_recommended)
    giving_hypo_surplus = sum(r.keeper_value or 0 for r in giving_hypo_recs if r.is_recommended)
    giving_surplus_delta = round(giving_hypo_surplus - giving_baseline_surplus, 2)
    giving_total_value_delta = round(giving_surplus_delta - pick_value_delta, 2)

    result = TradeAnalysisResult(
        receiving_team_id=str(receiving_team_id),
        receiving_team_name=receiving_team.name,
        baseline_keepers=baseline_rows,
        hypothetical_keepers=hypo_rows,
        baseline_surplus=round(baseline_surplus, 2),
        hypothetical_surplus=round(hypo_surplus, 2),
        surplus_delta=surplus_delta,
        give_picks_value=give_picks_value,
        receive_picks_value=receive_picks_value,
        pick_value_delta=pick_value_delta,
        total_value_delta=round(surplus_delta + pick_value_delta, 2),
        gained=gained,
        lost=lost,
        giving_team_id=str(giving_team_id) if giving_team_id else "",
        giving_team_name=giving_team.name if giving_team else "",
        giving_baseline_keepers=giving_baseline_rows,
        giving_hypothetical_keepers=giving_hypo_rows,
        giving_baseline_surplus=round(giving_baseline_surplus, 2),
        giving_hypothetical_surplus=round(giving_hypo_surplus, 2),
        giving_surplus_delta=giving_surplus_delta,
        giving_total_value_delta=giving_total_value_delta,
    )

    if include_ai and app_settings is not None:
        give_names = [players[i.player_id].full_name for i in give if i.player_id in players]
        give_pick_descs = [f"Round {p.round} pick" for p in give_picks]
        receive_names = [players[i.player_id].full_name for i in receive if i.player_id in players]
        receive_pick_descs = [f"Round {p.round} pick" for p in receive_picks]
        try:
            result.ai_narrative = generate_trade_narrative(
                settings=app_settings,
                result=result,
                give_names=give_names + give_pick_descs,
                receive_names=receive_names + receive_pick_descs,
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

    def _keeper_rows(rows: list[TradePlayerRow]) -> list[dict[str, Any]]:
        return [
            {
                "name": r.player_name,
                "position": r.position,
                "keeper_value": r.keeper_value,
                "keeper_cost_round": r.keeper_cost_round,
                "adp_round": r.adp_round,
                "incoming": r.is_incoming,
            }
            for r in rows
        ]

    context: dict[str, Any] = {
        "team_a": {
            "name": result.receiving_team_name,
            "sends": give_names,
            "receives": receive_names,
            "baseline_keepers": _keeper_rows(result.baseline_keepers),
            "projected_keepers": _keeper_rows(result.hypothetical_keepers),
            "keeper_surplus_change": result.surplus_delta,
            "pick_value_received": result.receive_picks_value,
            "pick_value_sent": result.give_picks_value,
            "total_value_change": result.total_value_delta,
        },
        "team_b": {
            "name": result.giving_team_name or "Team B",
            "sends": receive_names,
            "receives": give_names,
            "baseline_keepers": _keeper_rows(result.giving_baseline_keepers),
            "projected_keepers": _keeper_rows(result.giving_hypothetical_keepers),
            "keeper_surplus_change": result.giving_surplus_delta,
            "pick_value_received": result.give_picks_value,
            "pick_value_sent": result.receive_picks_value,
            "total_value_change": result.giving_total_value_delta,
        },
    }

    schema = {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "verdict": {"type": "string", "enum": ["good", "neutral", "bad"]},
            "summary": {"type": "string", "maxLength": 600},
            "recommendation": {"type": "string", "enum": ["proceed", "modify", "decline"]},
            "team_a_analysis": {"type": "string", "maxLength": 400},
            "team_b_analysis": {"type": "string", "maxLength": 400},
            "modifications": {
                "type": "array",
                "items": {"type": "string", "maxLength": 200},
                "maxItems": 3,
            },
            "key_risk": {"type": "string", "maxLength": 300},
            "opportunity_cost": {"type": "string", "maxLength": 300},
        },
        "required": [
            "verdict", "summary", "recommendation",
            "team_a_analysis", "team_b_analysis",
            "modifications", "key_risk", "opportunity_cost",
        ],
    }

    data, usage = _responses_json(
        settings=settings,
        name="trade_analysis",
        schema=schema,
        instructions=(
            "You are a fantasy football keeper league analyst evaluating a proposed trade from both teams' perspectives. "
            "total_value_change combines keeper surplus change and draft pick value (in round-equivalent units). "
            "Positive = the team gains value, negative = they lose value. "
            "verdict: 'good' if Team A clearly benefits (total_value_change > 2), "
            "'bad' if Team A clearly loses (total_value_change < -2), 'neutral' otherwise. "
            "recommendation: 'proceed' if both teams benefit or the trade is balanced, "
            "'modify' if one side is significantly lopsided but fixable, "
            "'decline' if the trade is badly imbalanced or harmful to both teams. "
            "In modifications, suggest 1-3 concrete adjustments (specific players or picks to add/swap) "
            "that would make the trade more equitable and beneficial for both teams. "
            "Be direct, mention player names, and keep analyses concise. Return JSON only."
        ),
        user_payload=context,
        max_output_tokens=900,
    )

    return TradeNarrativeResult(
        verdict=str(data.get("verdict") or "neutral"),
        recommendation=str(data.get("recommendation") or "modify"),
        summary=str(data.get("summary") or "")[:600],
        team_a_analysis=str(data.get("team_a_analysis") or "")[:400],
        team_b_analysis=str(data.get("team_b_analysis") or "")[:400],
        modifications=[str(m)[:200] for m in (data.get("modifications") or [])],
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
