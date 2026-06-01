from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
import hashlib
import json
from typing import Any
import uuid

from sqlmodel import Session, select

import time

from app.core.config import get_settings
from app.models import (
    ADPEntry,
    ADPSnapshot,
    KeeperRecommendation,
    MockDraftAnalysis,
    MockDraftPick,
    MockDraftSession,
    Player,
    Team,
    TeamScenarioSelection,
)
from app.models.league import League
from app.services import draft_history, mock_draft_ai
from app.services.ai_log import write_ai_log
from app.services.optimizer import latest_recommendation_batch


class MockDraftError(ValueError):
    pass


@dataclass(frozen=True)
class DraftSlot:
    round: int
    pick_in_round: int
    overall_pick: int
    team_id: uuid.UUID | None


DEFAULT_ROSTER_SLOTS = {
    "QB": 1,
    "RB": 2,
    "WR": 2,
    "TE": 1,
    "FLEX": 2,
    "SUPERFLEX": 1,
    "K": 1,
    "DST": 1,
    "BENCH": 6,
}

FLEX_POSITIONS = {"RB", "WR", "TE"}
SUPERFLEX_POSITIONS = {"QB", "RB", "WR", "TE"}
FLEX_POSITION_ORDER = ("RB", "WR", "TE")
SUPERFLEX_POSITION_ORDER = ("QB", "RB", "WR", "TE")
TEAM_DEFENSE_ALIASES = {"DEF", "D/ST", "DST"}
SPECIAL_TEAM_MIN_ADP_PICK = 100


def create_mock_draft_session(
    session: Session,
    league: League,
    *,
    user_id: uuid.UUID | None,
    adp_snapshot_id: uuid.UUID | None,
    scenario_name: str | None,
    pick_timer_seconds: int | None,
    bot_config: dict[str, Any],
    round_count: int | None,
) -> MockDraftSession:
    user_team = _require_user_team(session, league.id, user_id)
    resolved_round_count = _round_count_from_settings(league.roster_settings)
    adp_snapshot = _resolve_adp_snapshot(session, league, adp_snapshot_id)
    resolved_scenario_name = scenario_name or _selected_scenario_name(session, league.id, user_id)
    recommendations = latest_recommendation_batch(
        session,
        league.id,
        user_id=user_id,
        scenario_name=resolved_scenario_name,
        recommended_only=True,
    )
    keeper_context = _keeper_context(session, recommendations, resolved_scenario_name)
    draft_session = MockDraftSession(
        league_id=league.id,
        user_id=user_id,
        user_team_id=user_team.id,
        adp_snapshot_id=adp_snapshot.id if adp_snapshot else None,
        status="setup",
        pick_timer_seconds=pick_timer_seconds,
        bot_config=_default_bot_config(bot_config),
        keeper_context=keeper_context,
        draft_type=league.draft_type,
        round_count=resolved_round_count,
    )
    session.add(draft_session)
    session.commit()
    session.refresh(draft_session)

    _add_keeper_forfeit_picks(session, league, draft_session, recommendations)
    generate_strategy_plan(session, draft_session)
    enriched = _enrich_bot_config_with_history(session, league, draft_session.bot_config)
    if enriched is not draft_session.bot_config:
        draft_session.bot_config = enriched
    session.commit()
    session.refresh(draft_session)
    return draft_session


def start_mock_draft(session: Session, draft_session: MockDraftSession) -> MockDraftSession:
    if draft_session.status not in {"setup", "paused"}:
        raise MockDraftError("Only setup or paused mock drafts can be started")
    draft_session.status = "in_progress"
    session.add(draft_session)
    session.commit()
    session.refresh(draft_session)
    return draft_session


def pause_mock_draft(session: Session, draft_session: MockDraftSession) -> MockDraftSession:
    if draft_session.status != "in_progress":
        raise MockDraftError("Only in-progress mock drafts can be paused")
    draft_session.status = "paused"
    session.add(draft_session)
    session.commit()
    session.refresh(draft_session)
    return draft_session


def resume_mock_draft(session: Session, draft_session: MockDraftSession) -> MockDraftSession:
    if draft_session.status != "paused":
        raise MockDraftError("Only paused mock drafts can be resumed")
    draft_session.status = "in_progress"
    session.add(draft_session)
    session.commit()
    session.refresh(draft_session)
    return draft_session


def end_mock_draft(session: Session, draft_session: MockDraftSession) -> MockDraftSession:
    if draft_session.status == "complete":
        raise MockDraftError("Completed mock drafts cannot be ended")
    draft_session.status = "abandoned"
    session.add(draft_session)
    session.commit()
    session.refresh(draft_session)
    return draft_session


def update_mock_draft_session(
    session: Session,
    draft_session: MockDraftSession,
    *,
    pick_timer_seconds: int | None,
    bot_config: dict[str, Any] | None,
) -> MockDraftSession:
    if draft_session.status not in {"setup", "paused"}:
        raise MockDraftError("Only setup or paused mock drafts can be updated")
    draft_session.pick_timer_seconds = pick_timer_seconds
    if bot_config is not None:
        draft_session.bot_config = _default_bot_config(bot_config)
    session.add(draft_session)
    session.commit()
    session.refresh(draft_session)
    return draft_session


def generate_strategy_plan(
    session: Session,
    draft_session: MockDraftSession,
    *,
    force: bool = False,
) -> MockDraftSession:
    if draft_session.status not in {"setup", "paused"}:
        raise MockDraftError("Strategy plans can only be generated before or during a paused draft")
    league = _require_league(session, draft_session.league_id)
    cache_key = _strategy_cache_key(session, draft_session, league)
    if (
        not force
        and draft_session.strategy_plan
        and draft_session.strategy_plan_cache_key == cache_key
    ):
        return draft_session

    settings = get_settings()
    base_plan = _deterministic_strategy_plan(session, draft_session, league)
    ai_error = None
    ai_used = False
    if mock_draft_ai.is_enabled(settings):
        try:
            valid_players = _valid_strategy_players_by_id(session, draft_session)
            _t0 = time.monotonic()
            ai_plan = mock_draft_ai.generate_strategy_plan(
                settings=settings,
                context=_strategy_context(session, draft_session, league),
            )
            _latency = int((time.monotonic() - _t0) * 1000)
            base_plan = _clean_strategy_plan(
                {
                    "summary": ai_plan.summary,
                    "round_plan": ai_plan.round_plan,
                    "position_priorities": ai_plan.position_priorities,
                    "targets": ai_plan.targets,
                    "fades": ai_plan.fades,
                    "contingencies": ai_plan.contingencies,
                },
                fallback=base_plan,
            )
            base_plan = _filter_strategy_player_lists(base_plan, valid_players)
            ai_used = True
            write_ai_log(
                session,
                feature="strategy_plan",
                league_id=draft_session.league_id,
                user_id=draft_session.user_id,
                model=settings.mock_draft_ai_model,
                status="success",
                token_usage=ai_plan.token_usage,
                latency_ms=_latency,
            )
        except mock_draft_ai.MockDraftAIError as exc:
            ai_error = str(exc)[:1000]
            write_ai_log(
                session,
                feature="strategy_plan",
                league_id=draft_session.league_id,
                user_id=draft_session.user_id,
                model=settings.mock_draft_ai_model,
                status="failed",
                error_message=ai_error,
            )

    generated_at = datetime.now(UTC)
    base_plan.update(
        {
            "generated_at": generated_at.isoformat(),
            "cache_key": cache_key,
            "error": ai_error,
            "ai_used": ai_used,
            "model": settings.mock_draft_ai_model if ai_used else None,
        }
    )
    draft_session.strategy_plan = base_plan
    draft_session.strategy_plan_cache_key = cache_key
    draft_session.strategy_plan_generated_at = generated_at
    draft_session.strategy_plan_error = ai_error
    session.add(draft_session)
    session.commit()
    session.refresh(draft_session)
    return draft_session


def make_user_pick(
    session: Session,
    draft_session: MockDraftSession,
    *,
    user_id: uuid.UUID | None,
    player_id: uuid.UUID,
    decision_time_ms: int | None,
) -> MockDraftPick:
    if draft_session.status != "in_progress":
        raise MockDraftError("Mock draft must be in progress")
    current_slot = current_open_slot(session, draft_session)
    if current_slot is None:
        raise MockDraftError("Mock draft has no open picks")
    if current_slot.team_id != draft_session.user_team_id:
        raise MockDraftError("It is not the user team's turn")
    _require_owner(draft_session, user_id)
    player = session.get(Player, player_id)
    if player is None:
        raise MockDraftError("Player not found")
    _validate_available_player(session, draft_session, player, current_slot.team_id)
    pick = _create_pick(
        draft_session,
        current_slot,
        player_id=player_id,
        source="user",
        decision_time_ms=decision_time_ms,
        reasoning_summary=None,
    )
    session.add(pick)
    session.commit()
    session.refresh(pick)
    _complete_if_finished(session, draft_session)
    return pick


def make_bot_pick(session: Session, draft_session: MockDraftSession) -> MockDraftPick | None:
    if draft_session.status != "in_progress":
        raise MockDraftError("Mock draft must be in progress")
    current_slot = current_open_slot(session, draft_session)
    if current_slot is None:
        _complete_if_finished(session, draft_session)
        return None
    if current_slot.team_id == draft_session.user_team_id:
        return None
    player, reasoning = _select_bot_player(session, draft_session, current_slot)
    config = _team_bot_config(draft_session, current_slot.team_id)
    pick = _create_pick(
        draft_session,
        current_slot,
        player_id=player.id,
        source="bot",
        decision_time_ms=None,
        bot_personality=config["personality"],
        bot_difficulty=config["difficulty"],
        reasoning_summary=reasoning,
    )
    session.add(pick)
    session.commit()
    session.refresh(pick)
    _complete_if_finished(session, draft_session)
    return pick


def _require_league(session: Session, league_id: uuid.UUID) -> League:
    league = session.get(League, league_id)
    if league is None:
        raise MockDraftError("League not found")
    return league


def complete_mock_draft(
    session: Session,
    draft_session: MockDraftSession,
    *,
    force: bool = False,
) -> MockDraftSession:
    if draft_session.status == "complete":
        return draft_session
    if not force and current_open_slot(session, draft_session) is not None:
        raise MockDraftError("Mock draft still has open picks")
    draft_session.status = "complete"
    draft_session.completed_at = datetime.now(UTC)
    session.add(draft_session)
    session.flush()
    generate_analysis(session, draft_session)
    session.commit()
    session.refresh(draft_session)
    return draft_session


def generate_analysis(session: Session, draft_session: MockDraftSession) -> MockDraftAnalysis:
    existing = session.exec(
        select(MockDraftAnalysis).where(MockDraftAnalysis.session_id == draft_session.id)
    ).first()
    picks = _picks(session, draft_session.id)
    user_picks = [pick for pick in picks if pick.team_id == draft_session.user_team_id]
    adp_by_player = _adp_by_player(session, draft_session)
    players = _players_by_id(session, {pick.player_id for pick in picks})
    league = _require_league(session, draft_session.league_id)
    roster_cfg = league.roster_settings or {}
    is_superflex = any(
        str(k).upper() == "SUPERFLEX" and int(v or 0) > 0 for k, v in roster_cfg.items()
    )
    feedback = _pick_feedback(user_picks, adp_by_player, players, draft_session)
    value_picks = [item for item in feedback if _numeric(item.get("value_vs_adp")) >= 0]
    reaches = [
        item for item in feedback
        if _numeric(item.get("value_vs_adp")) < -8 and not item.get("exclude_from_reach_analysis")
    ]
    needs = roster_needs(session, draft_session, draft_session.user_team_id)
    roster_completion_score = _roster_completion_score(needs)
    value_score = _value_score(feedback)
    balance_score = _balance_score(session, draft_session, league, draft_session.user_team_id)
    score = round((value_score * 0.45) + (roster_completion_score * 0.35) + (balance_score * 0.20))
    score = max(0, min(100, score))
    letter = _letter_grade(score)
    summary = (
        f"User team completed a {draft_session.round_count}-round mock with {len(value_picks)} "
        f"value pick(s), {len(reaches)} notable reach(es), and a roster construction score of "
        f"{roster_completion_score}."
    )
    strengths = _analysis_strengths(feedback, needs, balance_score)
    weaknesses = _analysis_weaknesses(feedback, needs)
    payload = {
        "overall_letter_grade": letter,
        "overall_numeric_score": score,
        "summary": summary,
        "strengths": strengths,
        "weaknesses": weaknesses,
        "pick_feedback": feedback,
        "what_if_scenarios": _what_if_scenarios(feedback, user_picks, adp_by_player, players, is_superflex),
        "projected_rankings": _projected_rankings(
            session,
            draft_session,
            score,
            value_score,
            roster_completion_score,
            balance_score,
        ),
        "future_advice": _future_advice(feedback, needs),
    }
    payload = _apply_ai_analysis(session, draft_session, payload, feedback, needs)
    if existing is None:
        analysis = MockDraftAnalysis(session_id=draft_session.id, **payload)
    else:
        analysis = existing
        for field_name, value in payload.items():
            setattr(analysis, field_name, value)
    session.add(analysis)
    session.flush()
    return analysis


def board_slots(session: Session, draft_session: MockDraftSession) -> list[DraftSlot]:
    teams = _draft_order_teams(session, draft_session.league_id)
    team_count = len(teams)
    if team_count == 0:
        return []
    slots: list[DraftSlot] = []
    for round_number in range(1, draft_session.round_count + 1):
        ordered_teams = teams
        if draft_session.draft_type.lower() == "snake" and round_number % 2 == 0:
            ordered_teams = list(reversed(teams))
        for pick_in_round, team in enumerate(ordered_teams, start=1):
            overall_pick = (round_number - 1) * team_count + pick_in_round
            slots.append(
                DraftSlot(
                    round=round_number,
                    pick_in_round=pick_in_round,
                    overall_pick=overall_pick,
                    team_id=team.id,
                )
            )
    return slots


def _strategy_context(
    session: Session,
    draft_session: MockDraftSession,
    league: League,
) -> dict[str, Any]:
    user_team = session.get(Team, draft_session.user_team_id)
    teams = _draft_order_teams(session, draft_session.league_id)
    user_draft_slot = user_team.draft_slot if user_team else None
    adp_by_player = _adp_by_player(session, draft_session)
    top_players = _top_player_context_by_position(session, draft_session, limit_per_position=10)
    return {
        "league": {
            "name": league.name,
            "season_year": league.season_year,
            "scoring_format": league.scoring_format,
            "draft_type": draft_session.draft_type,
            "team_count": len(teams),
            "round_count": draft_session.round_count,
            "roster_settings": league.roster_settings,
            "keeper_rules": league.keeper_rules,
        },
        "user_team": {
            "team_id": str(draft_session.user_team_id),
            "team_name": user_team.name if user_team else None,
            "draft_slot": user_draft_slot,
        },
        "adp_snapshot_id": str(draft_session.adp_snapshot_id) if draft_session.adp_snapshot_id else None,
        "keeper_context": draft_session.keeper_context,
        "roster_needs": roster_needs(session, draft_session, draft_session.user_team_id),
        "top_player_tiers_by_position": top_players,
        "top_overall_players": [
            _player_context(player, adp_by_player.get(player.id))
            for player in _strategy_available_players(session, draft_session, limit=60)
        ],
        "completed_mock_summary": _latest_completed_mock_summary(session, draft_session),
    }


def _strategy_cache_key(
    session: Session,
    draft_session: MockDraftSession,
    league: League,
) -> str:
    user_team = session.get(Team, draft_session.user_team_id)
    payload = {
        "league_id": str(league.id),
        "league_settings": {
            "scoring_format": league.scoring_format,
            "draft_type": league.draft_type,
            "roster_settings": league.roster_settings,
            "keeper_rules": league.keeper_rules,
        },
        "user_team_id": str(draft_session.user_team_id),
        "user_draft_slot": user_team.draft_slot if user_team else None,
        "adp_snapshot_id": str(draft_session.adp_snapshot_id) if draft_session.adp_snapshot_id else None,
        "keeper_context": draft_session.keeper_context,
        "round_count": draft_session.round_count,
        "bot_config": draft_session.bot_config,
    }
    encoded = json.dumps(payload, sort_keys=True, default=str, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def _deterministic_strategy_plan(
    session: Session,
    draft_session: MockDraftSession,
    league: League,
) -> dict[str, Any]:
    needs = roster_needs(session, draft_session, draft_session.user_team_id)
    top_players = _strategy_available_players(session, draft_session, limit=80)
    adp_by_player = _adp_by_player(session, draft_session)
    primary_needs = [
        str(need["slot"])
        for need in needs
        if int(need["remaining"]) > 0 and str(need["slot"]) not in {"BENCH", "FLEX", "SUPERFLEX"}
    ]
    if not primary_needs:
        primary_needs = ["QB", "RB", "WR", "TE"]
    priority_summary = ", ".join(primary_needs[:4])
    round_plan = []
    for round_number in range(1, min(draft_session.round_count, 8) + 1):
        early = round_number <= 3
        round_plan.append(
            {
                "round": round_number,
                "priority": f"{'Best value' if early else 'Roster fit'} at {priority_summary}",
                "avoid": "Low-upside depth unless ADP value clearly falls",
                "notes": "Balance ADP value against remaining starter slots and keeper forfeits.",
            }
        )
    position_priorities = [
        {
            "position": str(need["slot"]),
            "priority": "high" if int(need["remaining"]) > 0 else "low",
            "reason": f"{need['filled']} of {need['target']} roster slot(s) filled.",
        }
        for need in needs
        if str(need["slot"]) != "BENCH"
    ]
    targets = [
        _strategy_player_item(player, adp_by_player.get(player.id), reason="Strong ADP fit for this build.")
        for player in top_players[:8]
    ]
    fades = [
        _strategy_player_item(player, adp_by_player.get(player.id), reason="Take only if the room discounts him.")
        for player in top_players[-4:]
        if player.id in adp_by_player
    ]
    return {
        "summary": (
            f"Prioritize {priority_summary} while taking value that falls from the active ADP board. "
            "Use keeper forfeits as fixed roster commitments before chasing depth."
        ),
        "round_plan": round_plan,
        "position_priorities": position_priorities,
        "targets": targets,
        "fades": fades,
        "contingencies": [
            {
                "trigger": "Quarterbacks go earlier than ADP in the first two rounds",
                "action": "Move QB up one tier in superflex decisions and lean RB/WR only on clear value.",
            },
            {
                "trigger": "Starter slots are mostly filled by the middle rounds",
                "action": "Shift to ceiling bench picks before low-impact floor plays.",
            },
        ],
    }


def _clean_strategy_plan(plan: dict[str, Any], *, fallback: dict[str, Any]) -> dict[str, Any]:
    return {
        "summary": str(plan.get("summary") or fallback.get("summary") or "")[:700],
        "round_plan": _clean_strategy_items(plan.get("round_plan"), fallback.get("round_plan"), 30),
        "position_priorities": _clean_strategy_items(
            plan.get("position_priorities"),
            fallback.get("position_priorities"),
            8,
        ),
        "targets": _clean_strategy_items(plan.get("targets"), fallback.get("targets"), 12),
        "fades": _clean_strategy_items(plan.get("fades"), fallback.get("fades"), 8),
        "contingencies": _clean_strategy_items(
            plan.get("contingencies"),
            fallback.get("contingencies"),
            6,
        ),
    }


def _clean_strategy_items(value: Any, fallback: Any, limit: int) -> list[dict[str, Any]]:
    source = value if isinstance(value, list) and value else fallback
    if not isinstance(source, list):
        return []
    return [item for item in source[:limit] if isinstance(item, dict)]


def _filter_strategy_player_lists(
    plan: dict[str, Any],
    valid_players: dict[str, Player],
) -> dict[str, Any]:
    filtered = dict(plan)
    for key in ("targets", "fades"):
        seen: set[str] = set()
        rows = []
        for item in filtered.get(key) or []:
            if not isinstance(item, dict):
                continue
            player_id = str(item.get("player_id") or "")
            player = valid_players.get(player_id)
            if player is None or player_id in seen:
                continue
            seen.add(player_id)
            cleaned = dict(item)
            cleaned["player_id"] = player_id
            cleaned["player_name"] = player.full_name
            cleaned["position"] = _normalize_position(player.position)
            rows.append(cleaned)
        filtered[key] = rows
    return filtered


def _strategy_player_item(player: Player, adp: ADPEntry | None, *, reason: str) -> dict[str, Any]:
    acceptable_range = "No ADP"
    if adp and adp.adp_pick:
        low = max(1, int(adp.adp_pick) - 6)
        high = int(adp.adp_pick) + 8
        acceptable_range = f"{low}-{high}"
    return {
        "player_id": str(player.id),
        "player_name": player.full_name,
        "position": _normalize_position(player.position),
        "reason": reason,
        "acceptable_range": acceptable_range,
    }


def _top_player_context_by_position(
    session: Session,
    draft_session: MockDraftSession,
    *,
    limit_per_position: int,
) -> dict[str, list[dict[str, Any]]]:
    adp_by_player = _adp_by_player(session, draft_session)
    grouped: dict[str, list[dict[str, Any]]] = {}
    for player in _strategy_available_players(session, draft_session, limit=250):
        position = _normalize_position(player.position)
        rows = grouped.setdefault(position, [])
        if len(rows) < limit_per_position:
            rows.append(_player_context(player, adp_by_player.get(player.id)))
    return grouped


def _strategy_available_players(
    session: Session,
    draft_session: MockDraftSession,
    *,
    limit: int,
) -> list[Player]:
    return [
        player
        for player in available_players(session, draft_session, limit=limit * 2)
        if not _is_strategy_placeholder_name(player.full_name)
    ][:limit]


def _valid_strategy_players_by_id(
    session: Session,
    draft_session: MockDraftSession,
) -> dict[str, Player]:
    return {
        str(player.id): player
        for player in _strategy_available_players(session, draft_session, limit=500)
    }


def _is_strategy_placeholder_name(name: str) -> bool:
    normalized = name.strip().lower()
    return (
        not normalized
        or "placeholder" in normalized
        or normalized.startswith("source_not_substantiated")
        or normalized in {"kickers", "defenses", "quarterbacks", "running backs", "wide receivers", "tight ends"}
    )


def _latest_completed_mock_summary(
    session: Session,
    draft_session: MockDraftSession,
) -> dict[str, Any] | None:
    previous = session.exec(
        select(MockDraftAnalysis, MockDraftSession)
        .join(MockDraftSession, MockDraftAnalysis.session_id == MockDraftSession.id)
        .where(
            MockDraftSession.league_id == draft_session.league_id,
            MockDraftSession.user_id == draft_session.user_id,
            MockDraftSession.status == "complete",
        )
        .order_by(MockDraftSession.completed_at.desc(), MockDraftSession.created_at.desc())
    ).first()
    if previous is None:
        return None
    analysis, previous_session = previous
    return {
        "session_id": str(previous_session.id),
        "completed_at": previous_session.completed_at.isoformat()
        if previous_session.completed_at
        else None,
        "overall_letter_grade": analysis.overall_letter_grade,
        "overall_numeric_score": analysis.overall_numeric_score,
        "summary": analysis.summary,
        "future_advice": analysis.future_advice[:3],
    }


def _apply_ai_analysis(
    session: Session,
    draft_session: MockDraftSession,
    payload: dict[str, Any],
    feedback: list[dict[str, Any]],
    needs: list[dict[str, int | str]],
) -> dict[str, Any]:
    settings = get_settings()
    projected_rankings = dict(payload.get("projected_rankings") or {})
    projected_rankings["ai_analysis_used"] = False
    projected_rankings["ai_model"] = settings.mock_draft_ai_model if mock_draft_ai.is_enabled(settings) else None
    payload["projected_rankings"] = projected_rankings
    if not mock_draft_ai.is_enabled(settings):
        return payload
    league = _require_league(session, draft_session.league_id)
    picks = _picks(session, draft_session.id)
    players = _players_by_id(session, {pick.player_id for pick in picks})
    roster_cfg = league.roster_settings or {}
    is_superflex = any(
        str(k).upper() == "SUPERFLEX" and int(v or 0) > 0 for k, v in roster_cfg.items()
    )
    user_team = session.get(Team, draft_session.user_team_id)
    teams = _draft_order_teams(session, draft_session.league_id)
    team_count = len(teams)
    user_picks_for_context = [pick for pick in picks if pick.team_id == draft_session.user_team_id]

    # Roster composition by position
    roster_composition: dict[str, int] = {}
    for pick in user_picks_for_context:
        pos = (players[pick.player_id].position if pick.player_id in players else "UNK") or "UNK"
        roster_composition[pos] = roster_composition.get(pos, 0) + 1

    # Round-by-round pick structure: which rounds were active vs forfeited to keepers
    active_pick_rounds = sorted(
        pick.round for pick in user_picks_for_context if pick.source != "keeper_forfeit"
    )
    forfeit_rounds = sorted(
        pick.round for pick in user_picks_for_context if pick.source == "keeper_forfeit"
    )

    # Position scarcity: cumulative position counts off the board at each of the user's first 8 picks
    position_scarcity_at_picks: list[dict[str, Any]] = []
    all_picks_sorted = sorted(picks, key=lambda p: p.overall_pick)
    running_pos_counts: dict[str, int] = {}
    for p in all_picks_sorted:
        p_player = players.get(p.player_id)
        if p_player:
            pos = (p_player.position or "UNK").upper()
            running_pos_counts[pos] = running_pos_counts.get(pos, 0) + 1
        if p.team_id == draft_session.user_team_id and len(position_scarcity_at_picks) < 8:
            position_scarcity_at_picks.append({
                "round": p.round,
                "overall_pick": p.overall_pick,
                "positions_gone": dict(running_pos_counts),
            })

    # Value-vs-ADP index keyed by overall_pick for quick lookup
    feedback_by_pick = {f["overall_pick"]: f for f in feedback}

    try:
        _t0 = time.monotonic()
        decision = mock_draft_ai.generate_draft_analysis(
            settings=settings,
            context={
                "league": {
                    "draft_type": draft_session.draft_type,
                    "round_count": draft_session.round_count,
                    "team_count": team_count,
                    "scoring_format": league.scoring_format,
                    "roster_settings": roster_cfg,
                    "is_superflex": is_superflex,
                },
                "user_team": {
                    "draft_slot": user_team.draft_slot if user_team else None,
                    "team_name": user_team.name if user_team else None,
                },
                "keeper_context": draft_session.keeper_context,
                "deterministic_scores": {
                    "overall_letter_grade": payload["overall_letter_grade"],
                    "overall_numeric_score": payload["overall_numeric_score"],
                    "projected_rankings": payload["projected_rankings"],
                },
                "roster_needs": needs,
                "user_pick_feedback": feedback,
                "roster_composition": roster_composition,
                "draft_structure": {
                    "active_pick_rounds": active_pick_rounds,
                    "forfeit_rounds": forfeit_rounds,
                },
                "position_scarcity_at_picks": position_scarcity_at_picks,
                "user_picks": [
                    {
                        "overall_pick": pick.overall_pick,
                        "round": pick.round,
                        "is_last_round": pick.round == draft_session.round_count,
                        "player_name": players[pick.player_id].full_name if pick.player_id in players else None,
                        "position": players[pick.player_id].position if pick.player_id in players else None,
                        "source": pick.source,
                        "value_vs_adp": feedback_by_pick.get(pick.overall_pick, {}).get("value_vs_adp"),
                        "exclude_from_reach_analysis": feedback_by_pick.get(
                            pick.overall_pick, {}
                        ).get("exclude_from_reach_analysis", False),
                    }
                    for pick in user_picks_for_context
                ],
            },
        )
        write_ai_log(
            session,
            feature="draft_analysis",
            league_id=draft_session.league_id,
            user_id=draft_session.user_id,
            model=settings.mock_draft_ai_model,
            status="success",
            token_usage=decision.token_usage,
            latency_ms=int((time.monotonic() - _t0) * 1000),
        )
    except mock_draft_ai.MockDraftAIError as _exc:
        write_ai_log(
            session,
            feature="draft_analysis",
            league_id=draft_session.league_id,
            user_id=draft_session.user_id,
            model=settings.mock_draft_ai_model,
            status="failed",
            error_message=str(_exc)[:500],
        )
        return payload
    if decision.summary:
        payload["summary"] = decision.summary[:2000]
    if decision.strengths:
        payload["strengths"] = decision.strengths
    if decision.weaknesses:
        payload["weaknesses"] = decision.weaknesses
    if decision.what_if_scenarios:
        payload["what_if_scenarios"] = decision.what_if_scenarios
    if decision.future_advice:
        payload["future_advice"] = decision.future_advice
    projected_rankings["ai_analysis_used"] = True
    payload["projected_rankings"] = projected_rankings
    return payload


def current_open_slot(session: Session, draft_session: MockDraftSession) -> DraftSlot | None:
    picked_overalls = {pick.overall_pick for pick in _picks(session, draft_session.id)}
    for slot in board_slots(session, draft_session):
        if slot.overall_pick not in picked_overalls:
            return slot
    return None


def available_players(session: Session, draft_session: MockDraftSession, *, limit: int = 500) -> list[Player]:
    picked_player_ids = {pick.player_id for pick in _picks(session, draft_session.id)}
    unsubstantiated_player_ids = _unsubstantiated_adp_player_ids(session, draft_session)
    adp_by_player = _adp_by_player(session, draft_session)
    current_slot = current_open_slot(session, draft_session)
    current_round = current_slot.round if current_slot else draft_session.round_count
    players = session.exec(select(Player)).all()
    players = [
        player
        for player in players
        if player.id not in picked_player_ids
        and player.id not in unsubstantiated_player_ids
        and not _is_placeholder_player_name(player.full_name)
    ]
    players.sort(
        key=lambda player: (
            _available_player_sort_adp(
                player,
                adp_by_player.get(player.id),
                current_round=current_round,
                round_count=draft_session.round_count,
            ),
            player.full_name,
        )
    )
    return players[:limit]


def adp_entries_by_player(session: Session, draft_session: MockDraftSession) -> dict[uuid.UUID, ADPEntry]:
    return _adp_by_player(session, draft_session)


def roster_needs(
    session: Session,
    draft_session: MockDraftSession,
    team_id: uuid.UUID,
) -> list[dict[str, int | str]]:
    league = _require_league(session, draft_session.league_id)
    slots = _roster_slots(league.roster_settings)
    counts = _roster_counts(session, draft_session, team_id)
    filled_by_slot, _bench_counts = _allocate_roster_slots(slots, counts)
    needs: list[dict[str, int | str]] = []
    for slot, target in slots.items():
        filled = filled_by_slot.get(slot, 0)
        needs.append(
            {
                "slot": slot,
                "filled": filled,
                "target": target,
                "remaining": max(0, target - filled),
            }
        )
    return needs


def assert_session_owner(draft_session: MockDraftSession, user_id: uuid.UUID | None) -> None:
    _require_owner(draft_session, user_id)


def _require_user_team(session: Session, league_id: uuid.UUID, user_id: uuid.UUID | None) -> Team:
    statement = select(Team).where(Team.league_id == league_id)
    if user_id is None:
        team = session.exec(statement.order_by(Team.draft_slot, Team.name)).first()
    else:
        team = session.exec(statement.where(Team.user_id == user_id)).first()
    if team is None:
        raise MockDraftError("User must be assigned to a team before starting a mock draft")
    return team


def _require_owner(draft_session: MockDraftSession, user_id: uuid.UUID | None) -> None:
    if draft_session.user_id != user_id:
        raise MockDraftError("Only the mock draft owner can control this draft")


def _resolve_adp_snapshot(
    session: Session,
    league: League,
    adp_snapshot_id: uuid.UUID | None,
) -> ADPSnapshot | None:
    if adp_snapshot_id is not None:
        snapshot = session.get(ADPSnapshot, adp_snapshot_id)
        if snapshot is None or snapshot.league_id != league.id:
            raise MockDraftError("ADP snapshot not found")
        return snapshot
    return session.exec(
        select(ADPSnapshot)
        .where(ADPSnapshot.league_id == league.id)
        .order_by(ADPSnapshot.snapshot_date.desc(), ADPSnapshot.created_at.desc())
    ).first()


def _selected_scenario_name(
    session: Session,
    league_id: uuid.UUID,
    user_id: uuid.UUID | None,
) -> str | None:
    if user_id is None:
        return None
    selection = session.exec(
        select(TeamScenarioSelection)
        .where(
            TeamScenarioSelection.league_id == league_id,
            TeamScenarioSelection.user_id == user_id,
        )
        .order_by(TeamScenarioSelection.updated_at.desc())
    ).first()
    return selection.scenario_name if selection else None


def _keeper_context(
    session: Session,
    recommendations: list[KeeperRecommendation],
    scenario_name: str | None,
) -> dict[str, Any]:
    players = {
        player.id: player
        for player in session.exec(
            select(Player).where(Player.id.in_({item.player_id for item in recommendations}))
        ).all()
    } if recommendations else {}
    return {
        "scenario_name": scenario_name,
        "keepers": [
            {
                "team_id": str(recommendation.team_id),
                "player_id": str(recommendation.player_id),
                "player_name": players[recommendation.player_id].full_name
                if recommendation.player_id in players
                else None,
                "position": players[recommendation.player_id].position
                if recommendation.player_id in players
                else None,
                "keeper_cost_pick": recommendation.keeper_cost_pick,
                "keeper_cost_round": recommendation.keeper_cost_round,
                "keeper_score": recommendation.keeper_score,
            }
            for recommendation in recommendations
        ],
    }


def _add_keeper_forfeit_picks(
    session: Session,
    league: League,
    draft_session: MockDraftSession,
    recommendations: list[KeeperRecommendation],
) -> None:
    teams = {team.id: team for team in _draft_order_teams(session, league.id)}
    team_count = len(teams)
    if team_count == 0:
        return
    by_overall: dict[int, KeeperRecommendation] = {}
    for recommendation in recommendations:
        team = teams.get(recommendation.team_id)
        if team is None or team.draft_slot is None:
            continue
        overall_pick = _team_forfeited_overall_pick(
            keeper_cost_pick=recommendation.keeper_cost_pick,
            keeper_cost_round=recommendation.keeper_cost_round,
            draft_slot=team.draft_slot,
            team_count=team_count,
            draft_type=draft_session.draft_type,
        )
        if overall_pick is not None and overall_pick <= draft_session.round_count * team_count:
            by_overall.setdefault(overall_pick, recommendation)
    slots = {slot.overall_pick: slot for slot in board_slots(session, draft_session)}
    for overall_pick, recommendation in by_overall.items():
        slot = slots.get(overall_pick)
        if slot is None:
            continue
        session.add(
            _create_pick(
                draft_session,
                slot,
                player_id=recommendation.player_id,
                source="keeper_forfeit",
                decision_time_ms=None,
                reasoning_summary="Keeper selection forfeits this draft pick.",
            )
        )


def _team_forfeited_overall_pick(
    *,
    keeper_cost_pick: float | None,
    keeper_cost_round: float | None,
    draft_slot: int,
    team_count: int,
    draft_type: str,
) -> int | None:
    round_number = None
    if keeper_cost_round is not None and keeper_cost_round > 0:
        round_number = int(keeper_cost_round)
    elif keeper_cost_pick is not None and keeper_cost_pick > 0:
        round_number = int((keeper_cost_pick - 1) // team_count) + 1
    if round_number is None or round_number <= 0:
        return None
    if draft_type.lower() == "snake" and round_number % 2 == 0:
        pick_in_round = team_count + 1 - draft_slot
    else:
        pick_in_round = draft_slot
    return (round_number - 1) * team_count + pick_in_round


def _draft_order_teams(session: Session, league_id: uuid.UUID) -> list[Team]:
    teams = session.exec(
        select(Team).where(Team.league_id == league_id).order_by(Team.draft_slot, Team.name)
    ).all()
    team_count = len(teams)
    by_slot = {
        team.draft_slot: team
        for team in teams
        if team.draft_slot is not None and 1 <= team.draft_slot <= team_count
    }
    fallback_teams = sorted(teams, key=lambda team: (team.draft_slot or 99, team.name))
    for index, team in enumerate(fallback_teams, start=1):
        by_slot.setdefault(index, team)
    return [by_slot[index] for index in range(1, team_count + 1) if index in by_slot]


def _create_pick(
    draft_session: MockDraftSession,
    slot: DraftSlot,
    *,
    player_id: uuid.UUID,
    source: str,
    decision_time_ms: int | None,
    reasoning_summary: str | None,
    bot_personality: str | None = None,
    bot_difficulty: str | None = None,
) -> MockDraftPick:
    if slot.team_id is None:
        raise MockDraftError("Draft slot has no team")
    return MockDraftPick(
        session_id=draft_session.id,
        round=slot.round,
        pick_in_round=slot.pick_in_round,
        overall_pick=slot.overall_pick,
        team_id=slot.team_id,
        player_id=player_id,
        source=source,
        decision_time_ms=decision_time_ms,
        bot_personality=bot_personality,
        bot_difficulty=bot_difficulty,
        reasoning_summary=reasoning_summary,
    )


def _validate_available_player(
    session: Session,
    draft_session: MockDraftSession,
    player: Player,
    team_id: uuid.UUID | None,
) -> None:
    picked_player_ids = {pick.player_id for pick in _picks(session, draft_session.id)}
    if player.id in picked_player_ids:
        raise MockDraftError("Player has already been drafted")
    if team_id is None:
        raise MockDraftError("Draft slot has no team")
    league = _require_league(session, draft_session.league_id)
    _validate_roster_fit(session, draft_session, league, team_id, player)


def _select_bot_player(
    session: Session,
    draft_session: MockDraftSession,
    current_slot: DraftSlot,
) -> tuple[Player, str]:
    league = _require_league(session, draft_session.league_id)
    candidates = _bot_candidates(session, draft_session, current_slot, league)
    if not candidates:
        raise MockDraftError("No available players")
    adp_by_player = _adp_by_player(session, draft_session)
    config = _team_bot_config(draft_session, current_slot.team_id)
    ai_decision = _choose_ai_bot_player(
        session,
        draft_session,
        current_slot,
        league,
        candidates,
        adp_by_player,
        config,
    )
    if ai_decision is not None:
        player_by_id = {player.id: player for player in candidates}
        player = player_by_id.get(ai_decision.player_id)
        if player is not None:
            return player, _truncate_reasoning(f"AI: {ai_decision.reasoning_summary}")
    scored = [
        (
            _bot_score(player, current_slot.overall_pick, adp_by_player.get(player.id), config),
            player,
        )
        for player in candidates
    ]
    scored.sort(key=lambda item: (-item[0], item[1].full_name))
    player = scored[0][1]
    adp = adp_by_player.get(player.id)
    if adp is None:
        reasoning = f"{config['personality']} bot selected best known player without ADP data."
    else:
        value = round(adp.adp_pick - current_slot.overall_pick, 1)
        reasoning = (
            f"{config['personality']} bot selected ADP value at pick {current_slot.overall_pick} "
            f"(ADP {adp.adp_pick}, value {value})."
        )
    return player, reasoning


def _bot_candidates(
    session: Session,
    draft_session: MockDraftSession,
    current_slot: DraftSlot,
    league: League,
) -> list[Player]:
    return [
        player
        for player in available_players(session, draft_session, limit=500)
        if current_slot.team_id is not None
        and _can_fit_roster(session, draft_session, league, current_slot.team_id, player)
    ]


def _choose_ai_bot_player(
    session: Session,
    draft_session: MockDraftSession,
    current_slot: DraftSlot,
    league: League,
    candidates: list[Player],
    adp_by_player: dict[uuid.UUID, ADPEntry],
    config: dict[str, str],
) -> mock_draft_ai.AIBotPickDecision | None:
    settings = get_settings()
    if not mock_draft_ai.is_enabled(settings):
        return None
    max_ai_round = settings.mock_draft_ai_max_ai_round
    if max_ai_round > 0 and current_slot.round > max_ai_round:
        return None
    candidate_limit = max(5, min(settings.mock_draft_ai_candidate_limit, len(candidates)))
    scoped_candidates = candidates[:candidate_limit]
    try:
        _t0 = time.monotonic()
        decision = mock_draft_ai.choose_bot_player(
            settings=settings,
            valid_player_ids={player.id for player in scoped_candidates},
            context={
                "league": {
                    "draft_type": draft_session.draft_type,
                    "round_count": draft_session.round_count,
                    "roster_settings": league.roster_settings,
                },
                "current_pick": {
                    "round": current_slot.round,
                    "pick_in_round": current_slot.pick_in_round,
                    "overall_pick": current_slot.overall_pick,
                    "team_id": str(current_slot.team_id),
                },
                "bot": config,
                "bot_owner_history": _format_history_for_ai(config.get("history_profile")),
                "team_roster_counts": _roster_counts(session, draft_session, current_slot.team_id)
                if current_slot.team_id
                else {},
                "team_roster_needs": roster_needs(session, draft_session, current_slot.team_id)
                if current_slot.team_id
                else [],
                "recent_picks": _recent_pick_context(session, draft_session, limit=12),
                "candidate_players": [
                    _player_context(player, adp_by_player.get(player.id)) for player in scoped_candidates
                ],
            },
        )
        write_ai_log(
            session,
            feature="bot_pick",
            league_id=draft_session.league_id,
            user_id=draft_session.user_id,
            model=settings.mock_draft_ai_model,
            status="success",
            token_usage=decision.token_usage,
            latency_ms=int((time.monotonic() - _t0) * 1000),
        )
        return decision
    except mock_draft_ai.MockDraftAIError as _exc:
        write_ai_log(
            session,
            feature="bot_pick",
            league_id=draft_session.league_id,
            user_id=draft_session.user_id,
            model=settings.mock_draft_ai_model,
            status="failed",
            error_message=str(_exc)[:500],
        )
        return None


def _player_context(player: Player, adp: ADPEntry | None) -> dict[str, Any]:
    return {
        "player_id": str(player.id),
        "name": player.full_name,
        "position": _normalize_position(player.position),
        "nfl_team": player.nfl_team,
        "adp_pick": adp.adp_pick if adp else None,
        "adp_round": adp.adp_round if adp else None,
        "risk": adp.risk if adp else None,
        "floor_projection": adp.floor_projection if adp else None,
        "consensus_projection": adp.consensus_projection if adp else None,
        "ceiling_projection": adp.ceiling_projection if adp else None,
        "draftsharks_3d_value": adp.draftsharks_3d_value if adp else None,
    }


def _recent_pick_context(
    session: Session,
    draft_session: MockDraftSession,
    *,
    limit: int,
) -> list[dict[str, Any]]:
    picks = _picks(session, draft_session.id)[-limit:]
    players = _players_by_id(session, {pick.player_id for pick in picks})
    return [
        {
            "overall_pick": pick.overall_pick,
            "team_id": str(pick.team_id),
            "player_name": players[pick.player_id].full_name if pick.player_id in players else None,
            "position": players[pick.player_id].position if pick.player_id in players else None,
            "source": pick.source,
        }
        for pick in picks
    ]


def _truncate_reasoning(reasoning: str) -> str:
    return reasoning[:1000]


def _format_history_for_ai(profile_data: Any) -> dict[str, Any] | None:
    """Compact history summary for the AI bot-pick context."""
    if not isinstance(profile_data, dict):
        return None
    profile = draft_history.profile_from_dict(profile_data)
    if profile is None or profile.seasons_with_data == 0:
        return None
    top_early = sorted(profile.early_round_positions, key=profile.early_round_positions.get, reverse=True)[:3]  # type: ignore[arg-type]
    tendency_label = (
        "value drafter" if profile.adp_tendency > 3
        else "reach drafter" if profile.adp_tendency < -3
        else "neutral"
    )
    return {
        "seasons_analyzed": profile.seasons_with_data,
        "early_round_tendencies": profile.early_round_positions,
        "position_adp_tendencies": profile.position_adp_tendencies,
        "keeper_history": {
            "avg_keepers_per_season": profile.keeper_count_avg,
            "preferred_positions": profile.keeper_positions[:4],
        },
        "summary": (
            f"This owner has {profile.seasons_with_data} season(s) of data. "
            f"ADP tendency: {tendency_label} ({profile.adp_tendency:+.1f} picks avg). "
            f"Early-round favorites: {', '.join(top_early) or 'unknown'}."
        ),
    }


def _bot_score(
    player: Player,
    overall_pick: int,
    adp: ADPEntry | None,
    config: dict[str, Any],
) -> float:
    adp_pick = adp.adp_pick if adp else 999
    value_score = max(-50, min(75, adp_pick - overall_pick))
    base = 1000 - adp_pick + value_score
    position_boost = {
        "QB Lover": {"QB": 45},
        "RB Heavy": {"RB": 35},
        "WR Heavy": {"WR": 35},
        "Conservative": {},
        "Aggressive": {},
        "Balanced": {},
        "Value Hunter": {},
        "Need Based": {},
        "Chaos": {},
    }.get(config["personality"], {})
    base += position_boost.get(player.position.upper(), 0)
    if config["personality"] == "Value Hunter":
        base += value_score * 0.5
    if config["difficulty"] == "Easy":
        base -= (hash(str(player.id)) % 20)
    elif config["difficulty"] == "Hard":
        base += value_score * 0.25
    profile_data = config.get("history_profile")
    if isinstance(profile_data, dict):
        profile = draft_history.profile_from_dict(profile_data)
        if profile is not None:
            base += _history_position_boost(player, overall_pick, profile)
    return base


def _history_position_boost(
    player: Player,
    overall_pick: int,
    profile: draft_history.OwnerDraftProfile,
) -> float:
    """Nudge score (±20 pts) based on owner's historical position preferences."""
    position = player.position.upper().strip()
    if position in ("D/ST", "DST", "DEF"):
        position = "DST"

    if overall_pick <= 48:
        rates = profile.early_round_positions
    elif overall_pick <= 108:
        rates = profile.mid_round_positions
    else:
        rates = profile.late_round_positions

    if not rates:
        return 0.0

    rate = rates.get(position, 0.0)
    baseline = 1.0 / max(len(rates), 4)
    deviation = rate - baseline
    return max(-20.0, min(20.0, deviation * 80.0))


def _team_bot_config(draft_session: MockDraftSession, team_id: uuid.UUID | None) -> dict[str, Any]:
    config = draft_session.bot_config or {}
    team_configs = config.get("teams", {}) if isinstance(config.get("teams"), dict) else {}
    team_config = team_configs.get(str(team_id), {}) if team_id is not None else {}
    result: dict[str, Any] = {
        "personality": team_config.get(
            "personality",
            config.get("default_personality", "Balanced"),
        ),
        "difficulty": team_config.get("difficulty", config.get("default_difficulty", "Medium")),
    }
    if "history_profile" in team_config:
        result["history_profile"] = team_config["history_profile"]
    return result


def _default_bot_config(config: dict[str, Any]) -> dict[str, Any]:
    return {
        "default_personality": config.get("default_personality", "Balanced"),
        "default_difficulty": config.get("default_difficulty", "Medium"),
        "teams": config.get("teams", {}),
    }


def _enrich_bot_config_with_history(
    session: Session,
    league: League,
    bot_config: dict[str, Any],
) -> dict[str, Any]:
    try:
        profiles = draft_history.get_league_draft_profiles(
            session,
            league.id,
            league.name,
            league.season_year,
        )
    except Exception:
        return bot_config

    if not profiles:
        return bot_config

    config = dict(bot_config)
    teams_config = dict(config.get("teams") or {})
    for team_id, profile in profiles.items():
        entry = dict(teams_config.get(str(team_id)) or {})
        entry["history_profile"] = draft_history.profile_to_dict(profile)
        teams_config[str(team_id)] = entry
    config["teams"] = teams_config
    return config


def _round_count_from_settings(roster_settings: dict[str, Any]) -> int:
    slots = roster_settings.get("slots")
    if isinstance(slots, dict):
        total = sum(int(value) for value in slots.values() if isinstance(value, int | float) and int(value) > 0)
        if total > 0:
            return total
    return 16


def _roster_slots(roster_settings: dict[str, Any]) -> dict[str, int]:
    raw_slots = roster_settings.get("slots") or roster_settings.get("roster_slots") or {}
    if not isinstance(raw_slots, dict):
        raw_slots = {}
    slots = {
        _normalize_position(slot): int(value)
        for slot, value in raw_slots.items()
        if isinstance(value, int | float) and int(value) > 0
    }
    return slots or DEFAULT_ROSTER_SLOTS.copy()


def _max_position_counts(roster_settings: dict[str, Any]) -> dict[str, int]:
    raw_limits = (
        roster_settings.get("max_positions")
        or roster_settings.get("max_position_counts")
        or roster_settings.get("position_limits")
        or {}
    )
    if not isinstance(raw_limits, dict):
        return {}
    return {
        _normalize_position(position): int(value)
        for position, value in raw_limits.items()
        if isinstance(value, int | float) and int(value) > 0
    }


def _bench_position_limits(roster_settings: dict[str, Any]) -> dict[str, int]:
    raw_limits = (
        roster_settings.get("bench_position_limits")
        or roster_settings.get("bench_limits")
        or {}
    )
    if not isinstance(raw_limits, dict):
        return {}
    return {
        _normalize_position(position): int(value)
        for position, value in raw_limits.items()
        if isinstance(value, int | float) and int(value) >= 0
    }


def _allowed_positions(roster_settings: dict[str, Any]) -> set[str]:
    raw_positions = roster_settings.get("allowed_positions")
    if isinstance(raw_positions, list):
        return {
            _normalize_position(position)
            for position in raw_positions
            if isinstance(position, str) and position.strip()
        }
    slots = _roster_slots(roster_settings)
    allowed = {position for position in slots if position not in {"BENCH", "FLEX", "SUPERFLEX"}}
    if "FLEX" in slots:
        allowed.update(FLEX_POSITIONS)
    if "SUPERFLEX" in slots:
        allowed.update(SUPERFLEX_POSITIONS)
    return allowed


def _validate_roster_fit(
    session: Session,
    draft_session: MockDraftSession,
    league: League,
    team_id: uuid.UUID,
    player: Player,
) -> None:
    if not _can_fit_roster(session, draft_session, league, team_id, player):
        position = _normalize_position(player.position)
        counts = _roster_counts(session, draft_session, team_id)
        slots = _roster_slots(league.roster_settings)
        total_target = sum(slots.values())
        if sum(counts.values()) >= total_target:
            raise MockDraftError("Roster is already full")
        limits = _max_position_counts(league.roster_settings)
        if position in limits and counts.get(position, 0) >= limits[position]:
            raise MockDraftError(f"{position} roster limit has been reached")
        next_counts = counts.copy()
        next_counts[position] = next_counts.get(position, 0) + 1
        _filled_by_slot, bench_counts = _allocate_roster_slots(slots, next_counts)
        if _bench_position_limit_reached(league.roster_settings, position, bench_counts):
            raise MockDraftError(f"{position} bench limit has been reached")
        raise MockDraftError(f"{position} does not fit remaining roster slots")


def _can_fit_roster(
    session: Session,
    draft_session: MockDraftSession,
    league: League,
    team_id: uuid.UUID,
    player: Player,
) -> bool:
    position = _normalize_position(player.position)
    slots = _roster_slots(league.roster_settings)
    allowed_positions = _allowed_positions(league.roster_settings)
    if position not in allowed_positions:
        return False
    counts = _roster_counts(session, draft_session, team_id)
    total_target = sum(slots.values())
    if sum(counts.values()) >= total_target:
        return False
    limits = _max_position_counts(league.roster_settings)
    if position in limits and counts.get(position, 0) >= limits[position]:
        return False

    next_counts = counts.copy()
    next_counts[position] = next_counts.get(position, 0) + 1
    filled_by_slot, bench_counts = _allocate_roster_slots(slots, next_counts)
    if filled_by_slot.get("BENCH", 0) > slots.get("BENCH", 0):
        return False
    return not _bench_position_limit_reached(league.roster_settings, position, bench_counts)


def _roster_counts(
    session: Session,
    draft_session: MockDraftSession,
    team_id: uuid.UUID,
) -> dict[str, int]:
    players = _players_by_id(session, {pick.player_id for pick in _picks(session, draft_session.id)})
    counts: dict[str, int] = {}
    for pick in _picks(session, draft_session.id):
        if pick.team_id != team_id:
            continue
        player = players.get(pick.player_id)
        if player is None:
            continue
        position = _normalize_position(player.position)
        counts[position] = counts.get(position, 0) + 1
    return counts


def _players_by_id(session: Session, player_ids: set[uuid.UUID]) -> dict[uuid.UUID, Player]:
    if not player_ids:
        return {}
    return {
        player.id: player
        for player in session.exec(select(Player).where(Player.id.in_(player_ids))).all()
    }


def _normalize_position(position: str) -> str:
    normalized = position.strip().upper()
    return "DST" if normalized in TEAM_DEFENSE_ALIASES else normalized


def _is_placeholder_player_name(name: str) -> bool:
    normalized = " ".join(name.strip().lower().replace("_", " ").replace("-", " ").split())
    return (
        "placeholder" in normalized
        or normalized.startswith("source not substantiated")
        or normalized in {"kickers", "defenses", "quarterbacks", "running backs", "wide receivers", "tight ends"}
    )


def _is_unsubstantiated_source_note(note: str | None) -> bool:
    normalized = " ".join((note or "").strip().lower().replace("_", " ").replace("-", " ").split())
    return "insufficient current source substantiation" in normalized


def _is_implausible_special_team_adp(position: str, adp_pick: float) -> bool:
    return _normalize_position(position) in {"K", "DST"} and adp_pick < SPECIAL_TEAM_MIN_ADP_PICK


def _available_player_sort_adp(
    player: Player,
    adp: ADPEntry | None,
    *,
    current_round: int,
    round_count: int,
) -> float:
    adp_pick = adp.adp_pick if adp else 9999
    position = _normalize_position(player.position)
    special_team_round = max(13, round_count - 2)
    if position in {"K", "DST"} and current_round < special_team_round:
        return adp_pick + 10000
    return adp_pick


def _starter_capacity(slots: dict[str, int]) -> int:
    return sum(value for slot, value in slots.items() if slot != "BENCH")


def _fixed_flex_base(slots: dict[str, int]) -> int:
    return sum(slots.get(position, 0) for position in FLEX_POSITIONS)


def _fixed_superflex_base(slots: dict[str, int]) -> int:
    return sum(slots.get(position, 0) for position in SUPERFLEX_POSITIONS) + slots.get("FLEX", 0)


def _flex_remaining(slots: dict[str, int], counts: dict[str, int]) -> int:
    filled = max(0, sum(counts.get(position, 0) for position in FLEX_POSITIONS) - _fixed_flex_base(slots))
    return max(0, slots.get("FLEX", 0) - filled)


def _superflex_remaining(slots: dict[str, int], counts: dict[str, int]) -> int:
    filled = max(
        0,
        sum(counts.get(position, 0) for position in SUPERFLEX_POSITIONS) - _fixed_superflex_base(slots),
    )
    return max(0, slots.get("SUPERFLEX", 0) - filled)


def _bench_filled(slots: dict[str, int], counts: dict[str, int]) -> int:
    filled_by_slot, _bench_counts = _allocate_roster_slots(slots, counts)
    return filled_by_slot.get("BENCH", 0)


def _bench_position_limit_reached(
    roster_settings: dict[str, Any],
    position: str,
    bench_counts: dict[str, int],
) -> bool:
    limits = _bench_position_limits(roster_settings)
    if position not in limits:
        return False
    return bench_counts.get(position, 0) > limits[position]


def _allocate_roster_slots(
    slots: dict[str, int],
    counts: dict[str, int],
) -> tuple[dict[str, int], dict[str, int]]:
    remaining_counts = {
        _normalize_position(position): max(0, int(count))
        for position, count in counts.items()
        if count > 0
    }
    filled_by_slot: dict[str, int] = {}

    for slot, target in slots.items():
        if slot in {"BENCH", "FLEX", "SUPERFLEX"}:
            continue
        filled = min(remaining_counts.get(slot, 0), target)
        filled_by_slot[slot] = filled
        remaining_counts[slot] = max(0, remaining_counts.get(slot, 0) - filled)

    flex_filled = _fill_eligible_slot(remaining_counts, FLEX_POSITION_ORDER, slots.get("FLEX", 0))
    if "FLEX" in slots:
        filled_by_slot["FLEX"] = flex_filled

    superflex_filled = _fill_eligible_slot(
        remaining_counts,
        SUPERFLEX_POSITION_ORDER,
        slots.get("SUPERFLEX", 0),
    )
    if "SUPERFLEX" in slots:
        filled_by_slot["SUPERFLEX"] = superflex_filled

    bench_counts = {position: count for position, count in remaining_counts.items() if count > 0}
    if "BENCH" in slots:
        filled_by_slot["BENCH"] = sum(bench_counts.values())
    return filled_by_slot, bench_counts


def _fill_eligible_slot(
    remaining_counts: dict[str, int],
    eligible_positions: tuple[str, ...],
    target: int,
) -> int:
    filled = 0
    for position in eligible_positions:
        if filled >= target:
            break
        available = remaining_counts.get(position, 0)
        used = min(available, target - filled)
        if used <= 0:
            continue
        remaining_counts[position] = available - used
        filled += used
    return filled


def _adp_by_player(session: Session, draft_session: MockDraftSession) -> dict[uuid.UUID, ADPEntry]:
    if draft_session.adp_snapshot_id is None:
        return {}
    active_entries = session.exec(
        select(ADPEntry).where(ADPEntry.snapshot_id == draft_session.adp_snapshot_id)
    ).all()
    adp_by_player = _valid_adp_entries_by_player(active_entries)
    fallback_entries = _fallback_adp_entries(session, draft_session)
    for player_id, entry in _valid_adp_entries_by_player(fallback_entries).items():
        adp_by_player.setdefault(player_id, entry)
    return adp_by_player


def _valid_adp_entries_by_player(entries: list[ADPEntry]) -> dict[uuid.UUID, ADPEntry]:
    return {
        entry.player_id: entry
        for entry in entries
        if not _is_implausible_special_team_adp(entry.position, entry.adp_pick)
        and not _is_unsubstantiated_source_note(entry.source_note)
    }


def _fallback_adp_entries(session: Session, draft_session: MockDraftSession) -> list[ADPEntry]:
    snapshot = session.get(ADPSnapshot, draft_session.adp_snapshot_id)
    if snapshot is None:
        return []
    previous_snapshots = session.exec(
        select(ADPSnapshot)
        .where(
            ADPSnapshot.league_id == draft_session.league_id,
            ADPSnapshot.id != snapshot.id,
        )
        .order_by(ADPSnapshot.snapshot_date.desc(), ADPSnapshot.created_at.desc())
    ).all()
    entries: list[ADPEntry] = []
    seen_player_ids: set[uuid.UUID] = set()
    for previous_snapshot in previous_snapshots:
        for entry in session.exec(
            select(ADPEntry)
            .where(ADPEntry.snapshot_id == previous_snapshot.id)
            .order_by(ADPEntry.adp_pick)
        ).all():
            if entry.player_id in seen_player_ids:
                continue
            seen_player_ids.add(entry.player_id)
            entries.append(entry)
    return entries


def _unsubstantiated_adp_player_ids(
    session: Session,
    draft_session: MockDraftSession,
) -> set[uuid.UUID]:
    if draft_session.adp_snapshot_id is None:
        return set()
    entries = session.exec(
        select(ADPEntry).where(ADPEntry.snapshot_id == draft_session.adp_snapshot_id)
    ).all()
    return {
        entry.player_id
        for entry in entries
        if _is_unsubstantiated_source_note(entry.source_note)
    }


def _picks(session: Session, draft_session_id: uuid.UUID) -> list[MockDraftPick]:
    return session.exec(
        select(MockDraftPick)
        .where(MockDraftPick.session_id == draft_session_id)
        .order_by(MockDraftPick.overall_pick)
    ).all()


def _complete_if_finished(session: Session, draft_session: MockDraftSession) -> None:
    if current_open_slot(session, draft_session) is None:
        complete_mock_draft(session, draft_session)


def _letter_grade(score: int) -> str:
    if score >= 97:
        return "A+"
    if score >= 93:
        return "A"
    if score >= 90:
        return "A-"
    if score >= 87:
        return "B+"
    if score >= 83:
        return "B"
    if score >= 80:
        return "B-"
    if score >= 77:
        return "C+"
    if score >= 73:
        return "C"
    if score >= 70:
        return "C-"
    if score >= 60:
        return "D"
    return "F"


def _pick_feedback(
    picks: list[MockDraftPick],
    adp_by_player: dict[uuid.UUID, ADPEntry],
    players: dict[uuid.UUID, Player],
    draft_session: MockDraftSession,
) -> list[dict[str, Any]]:
    feedback = []
    keeper_context = _keeper_context_by_player(draft_session)
    for pick in picks:
        adp = adp_by_player.get(pick.player_id)
        player = players.get(pick.player_id)
        keeper = keeper_context.get(str(pick.player_id))
        evaluation_pick = pick.overall_pick
        if pick.source == "keeper_forfeit" and keeper is not None:
            evaluation_pick = _numeric(keeper.get("keeper_cost_pick"), pick.overall_pick)
        value = None if adp is None else _pick_value_vs_adp(pick.source, evaluation_pick, adp.adp_pick)
        risk = adp.risk if adp else None
        projection = adp.consensus_projection or adp.draftsharks_projection if adp else None
        position = player.position if player else None
        feedback.append(
            {
                "overall_pick": pick.overall_pick,
                "source": pick.source,
                "evaluation_pick": evaluation_pick,
                "player_id": str(pick.player_id),
                "player_name": player.full_name if player else None,
                "position": position,
                "adp_pick": adp.adp_pick if adp else None,
                "keeper_cost_pick": keeper.get("keeper_cost_pick") if keeper else None,
                "keeper_cost_round": keeper.get("keeper_cost_round") if keeper else None,
                "value_vs_adp": value,
                "risk": risk,
                "projection": projection,
                "grade": _pick_grade(value),
                "summary": _pick_summary(value, risk, pick.source),
                "exclude_from_reach_analysis": position in ("K", "DST"),
            }
        )
    return feedback


def _keeper_context_by_player(draft_session: MockDraftSession) -> dict[str, dict[str, Any]]:
    keepers = draft_session.keeper_context.get("keepers")
    if not isinstance(keepers, list):
        return {}
    return {
        str(keeper["player_id"]): keeper
        for keeper in keepers
        if isinstance(keeper, dict) and keeper.get("player_id")
    }


def _pick_value_vs_adp(source: str, evaluation_pick: float, adp_pick: float) -> float:
    if source == "keeper_forfeit":
        return round(evaluation_pick - adp_pick, 1)
    return round(adp_pick - evaluation_pick, 1)


def _numeric(value: Any, fallback: float = 0) -> float:
    return value if isinstance(value, int | float) else fallback


def _pick_grade(value: float | None) -> str:
    if value is None:
        return "N/A"
    if value >= 18:
        return "A"
    if value >= 8:
        return "B"
    if value >= -4:
        return "C"
    if value >= -14:
        return "D"
    return "F"


def _pick_summary(value: float | None, risk: float | None, source: str) -> str:
    if value is None:
        return "No ADP available for this pick."
    risk_note = " Elevated player risk." if risk is not None and risk >= 7 else ""
    if source == "keeper_forfeit":
        if value >= 18:
            return f"Major keeper discount versus ADP.{risk_note}"
        if value >= 8:
            return f"Solid keeper value versus ADP.{risk_note}"
        if value >= -4:
            return f"Keeper cost is close to market value.{risk_note}"
        return f"Keeper cost is expensive versus ADP.{risk_note}"
    if value >= 18:
        return f"Major value against ADP.{risk_note}"
    if value >= 8:
        return f"Solid value against ADP.{risk_note}"
    if value >= -4:
        return f"Reasonable market-cost pick.{risk_note}"
    if value >= -14:
        return f"Picked ahead of ADP; roster fit needs to justify the reach.{risk_note}"
    return f"Large reach versus ADP.{risk_note}"


def _value_score(feedback: list[dict[str, Any]]) -> int:
    if not feedback:
        return 70
    values = [_numeric(item.get("value_vs_adp")) for item in feedback]
    average_value = sum(values) / len(values)
    return max(0, min(100, round(72 + average_value * 1.2)))


def _roster_completion_score(needs: list[dict[str, int | str]]) -> int:
    targets = sum(_numeric(need.get("target")) for need in needs)
    remaining = sum(_numeric(need.get("remaining")) for need in needs)
    if targets <= 0:
        return 70
    return max(0, min(100, round(((targets - remaining) / targets) * 100)))


def _balance_score(
    session: Session,
    draft_session: MockDraftSession,
    league: League,
    team_id: uuid.UUID,
) -> int:
    counts = _roster_counts(session, draft_session, team_id)
    slots = _roster_slots(league.roster_settings)
    has_superflex = slots.get("SUPERFLEX", 0) > 0
    qb_starter_target = 2 if has_superflex else 1
    starter_positions = [position for position in ("QB", "RB", "WR", "TE") if slots.get(position, 0) > 0]
    if not starter_positions:
        return 70

    def _position_covered(position: str) -> bool:
        needed = qb_starter_target if position == "QB" else 1
        return counts.get(position, 0) >= needed

    filled = sum(1 for position in starter_positions if _position_covered(position))
    return max(0, min(100, round((filled / len(starter_positions)) * 100)))


def _analysis_strengths(
    feedback: list[dict[str, Any]],
    needs: list[dict[str, int | str]],
    balance_score: int,
) -> list[dict[str, str]]:
    strengths = []
    value_picks = [item for item in feedback if _numeric(item.get("value_vs_adp")) >= 0]
    if value_picks:
        best = max(value_picks, key=lambda item: _numeric(item.get("value_vs_adp")))
        strengths.append(
            {
                "label": "Best value",
                "detail": f"{best.get('player_name') or 'A pick'} beat ADP by {best.get('value_vs_adp')} pick(s).",
            }
        )
    if all(_numeric(need.get("remaining")) == 0 for need in needs):
        strengths.append({"label": "Roster filled", "detail": "All configured roster slots are accounted for."})
    if balance_score >= 80:
        strengths.append({"label": "Positional balance", "detail": "Core starter positions were covered."})
    return strengths or [{"label": "Draft reps", "detail": "This mock creates a baseline for comparing future runs."}]


def _analysis_weaknesses(
    feedback: list[dict[str, Any]],
    needs: list[dict[str, int | str]],
) -> list[dict[str, str]]:
    weaknesses = []
    reaches = [
        item for item in feedback
        if _numeric(item.get("value_vs_adp")) < -8 and not item.get("exclude_from_reach_analysis")
    ]
    if reaches:
        worst = min(reaches, key=lambda item: _numeric(item.get("value_vs_adp")))
        weaknesses.append(
            {
                "label": "Costly reach",
                "detail": f"{worst.get('player_name') or 'One pick'} went {abs(_numeric(worst.get('value_vs_adp')))} pick(s) ahead of ADP.",
            }
        )
    open_needs = [need for need in needs if _numeric(need.get("remaining")) > 0 and need.get("slot") != "BENCH"]
    if open_needs:
        labels = ", ".join(str(need["slot"]) for need in open_needs[:4])
        weaknesses.append({"label": "Open roster needs", "detail": f"Remaining starter/flex needs: {labels}."})
    return weaknesses


def _what_if_scenarios(
    feedback: list[dict[str, Any]],
    user_picks: list[MockDraftPick],
    adp_by_player: dict[uuid.UUID, ADPEntry],
    players: dict[uuid.UUID, Player],
    is_superflex: bool = False,
) -> list[dict[str, Any]]:
    values = [_numeric(item.get("value_vs_adp")) for item in feedback]
    average_value = round(sum(values) / len(values), 1) if values else 0
    qb_picks = [
        pick for pick in user_picks
        if (players.get(pick.player_id).position if players.get(pick.player_id) else "") == "QB"
    ]
    te_picks = [
        pick for pick in user_picks
        if (players.get(pick.player_id).position if players.get(pick.player_id) else "") == "TE"
    ]
    early_qb = any(pick.overall_pick <= 36 for pick in qb_picks)
    best_adp_misses = [
        entry
        for entry in adp_by_player.values()
        if entry.player_id not in {pick.player_id for pick in user_picks}
    ]
    best_adp_misses.sort(key=lambda entry: entry.adp_pick)

    # BPA delta: positive when user underperformed ADP (gain available), negative when already beating it
    bpa_score_delta = round(-average_value)

    if is_superflex:
        if len(qb_picks) >= 2:
            # User has adequate QB depth — surface a TE-targeting scenario instead
            early_te = any(pick.overall_pick <= 72 for pick in te_picks)
            positional_scenario = {
                "name": "Target elite TE earlier",
                "changed_picks": 0 if early_te else 1,
                "score_delta": 0 if early_te else 2,
                "recommendation": (
                    "With QB handled, test locking in an elite TE before round 7 to secure "
                    "positional scarcity before the tier break."
                ),
            }
        else:
            positional_scenario = {
                "name": "Add a second QB",
                "changed_picks": 1,
                "score_delta": 4,
                "recommendation": (
                    "In superflex formats, a second quality QB provides a weekly starter advantage "
                    "and a meaningful trade chip throughout the season."
                ),
            }
    else:
        if early_qb:
            positional_scenario = {
                "name": "Streaming QB approach",
                "changed_picks": 0,
                "score_delta": -1,
                "recommendation": (
                    "You secured QB early. Test the opposite in a future run — wait on QB "
                    "and use early picks on RB/WR depth to compare roster construction."
                ),
            }
        else:
            positional_scenario = {
                "name": "Prioritize QB earlier",
                "changed_picks": 1,
                "score_delta": 3,
                "recommendation": "Test taking a top-12 QB before round 4 to lock in the position advantage.",
            }

    return [
        {
            "name": "Best available by ADP",
            "changed_picks": min(len(user_picks), len(best_adp_misses)),
            "score_delta": bpa_score_delta,
            "recommendation": (
                "You out-drafted ADP overall — use this as a control baseline to see if "
                "strict ADP discipline loses value in future runs."
                if average_value > 0
                else "Use this as the control strategy when comparing future mock runs."
            ),
        },
        positional_scenario,
        {
            "name": "Strict value hunting",
            "changed_picks": len([
                item for item in feedback
                if _numeric(item.get("value_vs_adp")) < 0 and not item.get("exclude_from_reach_analysis")
            ]),
            "score_delta": max(1, round(abs(min(0, average_value)))),
            "recommendation": "Avoid reaches unless the player fills a scarce roster need.",
        },
    ]


def _projected_rankings(
    session: Session,
    draft_session: MockDraftSession,
    score: int,
    value_score: int,
    roster_score: int,
    balance_score: int,
) -> dict[str, Any]:
    team_count = len(_draft_order_teams(session, draft_session.league_id))
    projected_finish = 1 + round((100 - score) / max(1, 100 / max(team_count, 1)))
    projected_finish = max(1, min(team_count or 1, projected_finish))
    return {
        "projected_finish": projected_finish,
        "projected_regular_season_rank": projected_finish,
        "playoff_odds_tier": "High" if score >= 85 else "Medium" if score >= 72 else "Low",
        "component_scores": {
            "value_score": value_score,
            "roster_construction_score": roster_score,
            "positional_balance_score": balance_score,
        },
        "comparison_to_baseline": "above baseline" if score >= 75 else "below baseline",
    }


def _future_advice(
    feedback: list[dict[str, Any]],
    needs: list[dict[str, int | str]],
) -> list[dict[str, str]]:
    open_needs = [str(need["slot"]) for need in needs if _numeric(need.get("remaining")) > 0]
    reaches = [
        item for item in feedback
        if _numeric(item.get("value_vs_adp")) < -8 and not item.get("exclude_from_reach_analysis")
    ]
    advice = [
        {
            "label": "Compare strategies",
            "detail": "Run the same setup with a different bot personality to identify fragile pick ranges.",
        }
    ]
    if open_needs:
        advice.append(
            {
                "label": "Attack needs",
                "detail": f"Prioritize these unresolved slots earlier next run: {', '.join(open_needs[:5])}.",
            }
        )
    if reaches:
        advice.append(
            {
                "label": "Reduce reaches",
                "detail": "Flag favorite targets before drafting so you know which ones can likely wait.",
            }
        )
    return advice
