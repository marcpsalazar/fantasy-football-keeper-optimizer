from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlmodel import Session, select

from app.db.session import get_session
from app.models import MockDraftAnalysis, MockDraftPick, MockDraftSession, Player, Team, User
from app.models.league import League
from app.schemas.mock_draft import (
    MockDraftActionResult,
    MockDraftAnalysisRead,
    MockDraftAvailablePlayer,
    MockDraftBoardSlot,
    MockDraftBotPickResult,
    MockDraftCompleteRequest,
    MockDraftCreate,
    MockDraftHistoryRow,
    MockDraftPickCreate,
    MockDraftPickRead,
    MockDraftRosterNeed,
    MockDraftRerunAnalysisRequest,
    MockDraftSessionRead,
    MockDraftStrategyPlanRead,
    MockDraftUpdate,
)
from app.services.auth import require_current_user
from app.services.mock_draft import (
    MockDraftError,
    adp_entries_by_player,
    assert_session_owner,
    available_players,
    board_slots,
    complete_mock_draft,
    create_mock_draft_session,
    end_mock_draft,
    generate_analysis,
    generate_strategy_plan as generate_mock_draft_strategy_plan,
    make_bot_pick,
    make_user_pick,
    pause_mock_draft,
    resume_mock_draft,
    roster_needs,
    start_mock_draft,
    update_mock_draft_session,
)

router = APIRouter(
    prefix="/api",
    tags=["mock-drafts"],
    dependencies=[Depends(require_current_user)],
)


@router.post(
    "/leagues/{league_id}/mock-drafts",
    response_model=MockDraftSessionRead,
    status_code=status.HTTP_201_CREATED,
)
def create_mock_draft(
    league_id: uuid.UUID,
    payload: MockDraftCreate,
    user: User | None = Depends(require_current_user),
    session: Session = Depends(get_session),
) -> MockDraftSessionRead:
    league = _require_league(session, league_id)
    try:
        draft_session = create_mock_draft_session(
            session,
            league,
            user_id=_user_id(user),
            adp_snapshot_id=payload.adp_snapshot_id,
            scenario_name=payload.scenario_name,
            pick_timer_seconds=payload.pick_timer_seconds,
            bot_config=payload.bot_config,
            round_count=payload.round_count,
        )
    except MockDraftError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return _session_payload(session, draft_session)


@router.get("/leagues/{league_id}/mock-drafts", response_model=list[MockDraftHistoryRow])
def list_mock_drafts(
    league_id: uuid.UUID,
    user: User | None = Depends(require_current_user),
    session: Session = Depends(get_session),
) -> list[MockDraftHistoryRow]:
    _require_league(session, league_id)
    statement = (
        select(MockDraftSession)
        .where(
            MockDraftSession.league_id == league_id,
            MockDraftSession.user_id == _user_id(user),
            MockDraftSession.status == "complete",
        )
        .order_by(MockDraftSession.completed_at.desc(), MockDraftSession.created_at.desc())
    )
    sessions = session.exec(statement).all()
    team_names = _team_names(session, {item.user_team_id for item in sessions})
    analyses = _analyses_by_session(session, {item.id for item in sessions})
    return [
        MockDraftHistoryRow(
            id=item.id,
            league_id=item.league_id,
            user_team_id=item.user_team_id,
            user_team_name=team_names.get(item.user_team_id),
            status=item.status,
            draft_type=item.draft_type,
            round_count=item.round_count,
            pick_timer_seconds=item.pick_timer_seconds,
            completed_at=item.completed_at,
            created_at=item.created_at,
            overall_letter_grade=analyses[item.id].overall_letter_grade if item.id in analyses else None,
            overall_numeric_score=analyses[item.id].overall_numeric_score if item.id in analyses else None,
            summary=analyses[item.id].summary if item.id in analyses else None,
        )
        for item in sessions
    ]


@router.get("/mock-drafts/{session_id}", response_model=MockDraftSessionRead)
def read_mock_draft(
    session_id: uuid.UUID,
    user: User | None = Depends(require_current_user),
    session: Session = Depends(get_session),
) -> MockDraftSessionRead:
    draft_session = _require_mock_draft(session, session_id)
    _assert_visible(draft_session, user)
    return _session_payload(session, draft_session)


@router.patch("/mock-drafts/{session_id}", response_model=MockDraftSessionRead)
def update_mock_draft(
    session_id: uuid.UUID,
    payload: MockDraftUpdate,
    user: User | None = Depends(require_current_user),
    session: Session = Depends(get_session),
) -> MockDraftSessionRead:
    draft_session = _require_mock_draft(session, session_id)
    try:
        assert_session_owner(draft_session, _user_id(user))
        draft_session = update_mock_draft_session(
            session,
            draft_session,
            pick_timer_seconds=payload.pick_timer_seconds,
            bot_config=payload.bot_config,
        )
    except MockDraftError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return _session_payload(session, draft_session)


@router.post("/mock-drafts/{session_id}/strategy-plan", response_model=MockDraftActionResult)
def generate_strategy_plan(
    session_id: uuid.UUID,
    user: User | None = Depends(require_current_user),
    session: Session = Depends(get_session),
) -> MockDraftActionResult:
    draft_session = _owned_session(session, session_id, user)
    try:
        draft_session = generate_mock_draft_strategy_plan(session, draft_session, force=True)
    except MockDraftError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return MockDraftActionResult(session=_session_payload(session, draft_session))


@router.post("/mock-drafts/{session_id}/start", response_model=MockDraftActionResult)
def start_draft(
    session_id: uuid.UUID,
    user: User | None = Depends(require_current_user),
    session: Session = Depends(get_session),
) -> MockDraftActionResult:
    draft_session = _owned_session(session, session_id, user)
    try:
        draft_session = start_mock_draft(session, draft_session)
    except MockDraftError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return MockDraftActionResult(session=_session_payload(session, draft_session))


@router.post("/mock-drafts/{session_id}/pick", response_model=MockDraftActionResult)
def draft_player(
    session_id: uuid.UUID,
    payload: MockDraftPickCreate,
    user: User | None = Depends(require_current_user),
    session: Session = Depends(get_session),
) -> MockDraftActionResult:
    draft_session = _owned_session(session, session_id, user)
    try:
        make_user_pick(
            session,
            draft_session,
            user_id=_user_id(user),
            player_id=payload.player_id,
            decision_time_ms=payload.decision_time_ms,
        )
    except MockDraftError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return MockDraftActionResult(session=_session_payload(session, _require_mock_draft(session, session_id)))


@router.post("/mock-drafts/{session_id}/bot-pick", response_model=MockDraftBotPickResult)
def draft_bot_player(
    session_id: uuid.UUID,
    user: User | None = Depends(require_current_user),
    session: Session = Depends(get_session),
) -> MockDraftBotPickResult:
    draft_session = _owned_session(session, session_id, user)
    try:
        pick = make_bot_pick(session, draft_session)
    except MockDraftError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    refreshed = _require_mock_draft(session, session_id)
    return MockDraftBotPickResult(
        session=_session_payload(session, refreshed),
        pick=_pick_payload(session, pick) if pick else None,
    )


@router.post("/mock-drafts/{session_id}/pause", response_model=MockDraftActionResult)
def pause_draft(
    session_id: uuid.UUID,
    user: User | None = Depends(require_current_user),
    session: Session = Depends(get_session),
) -> MockDraftActionResult:
    draft_session = _owned_session(session, session_id, user)
    try:
        draft_session = pause_mock_draft(session, draft_session)
    except MockDraftError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return MockDraftActionResult(session=_session_payload(session, draft_session))


@router.post("/mock-drafts/{session_id}/resume", response_model=MockDraftActionResult)
def resume_draft(
    session_id: uuid.UUID,
    user: User | None = Depends(require_current_user),
    session: Session = Depends(get_session),
) -> MockDraftActionResult:
    draft_session = _owned_session(session, session_id, user)
    try:
        draft_session = resume_mock_draft(session, draft_session)
    except MockDraftError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return MockDraftActionResult(session=_session_payload(session, draft_session))


@router.post("/mock-drafts/{session_id}/complete", response_model=MockDraftActionResult)
def complete_draft(
    session_id: uuid.UUID,
    payload: MockDraftCompleteRequest | None = None,
    user: User | None = Depends(require_current_user),
    session: Session = Depends(get_session),
) -> MockDraftActionResult:
    draft_session = _owned_session(session, session_id, user)
    try:
        draft_session = complete_mock_draft(session, draft_session, force=payload.force if payload else False)
    except MockDraftError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return MockDraftActionResult(session=_session_payload(session, draft_session))


@router.post("/mock-drafts/{session_id}/end", response_model=MockDraftActionResult)
def end_draft(
    session_id: uuid.UUID,
    user: User | None = Depends(require_current_user),
    session: Session = Depends(get_session),
) -> MockDraftActionResult:
    draft_session = _owned_session(session, session_id, user)
    try:
        draft_session = end_mock_draft(session, draft_session)
    except MockDraftError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return MockDraftActionResult(session=_session_payload(session, draft_session))


@router.post("/mock-drafts/{session_id}/analysis/rerun", response_model=MockDraftAnalysisRead)
def rerun_analysis(
    session_id: uuid.UUID,
    _: MockDraftRerunAnalysisRequest | None = None,
    user: User | None = Depends(require_current_user),
    session: Session = Depends(get_session),
) -> MockDraftAnalysisRead:
    draft_session = _owned_session(session, session_id, user)
    if draft_session.status != "complete":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only completed mock drafts can be analyzed",
        )
    analysis = generate_analysis(session, draft_session)
    session.commit()
    session.refresh(analysis)
    return MockDraftAnalysisRead.model_validate(analysis)


@router.delete("/mock-drafts/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_mock_draft(
    session_id: uuid.UUID,
    user: User | None = Depends(require_current_user),
    session: Session = Depends(get_session),
) -> Response:
    draft_session = _owned_session(session, session_id, user)
    for analysis in session.exec(
        select(MockDraftAnalysis).where(MockDraftAnalysis.session_id == draft_session.id)
    ).all():
        session.delete(analysis)
    for pick in session.exec(select(MockDraftPick).where(MockDraftPick.session_id == draft_session.id)).all():
        session.delete(pick)
    session.delete(draft_session)
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def _session_payload(session: Session, draft_session: MockDraftSession) -> MockDraftSessionRead:
    team_names = _team_names(session, {draft_session.user_team_id})
    picks = _picks(session, draft_session.id)
    pick_by_overall = {pick.overall_pick: _pick_payload(session, pick) for pick in picks}
    board = []
    for slot in board_slots(session, draft_session):
        pick = pick_by_overall.get(slot.overall_pick)
        status_label = "Open"
        if pick is not None:
            status_label = "Keeper" if pick.source == "keeper_forfeit" else "Drafted"
        board.append(
            MockDraftBoardSlot(
                round=slot.round,
                pick_in_round=slot.pick_in_round,
                overall_pick=slot.overall_pick,
                team_id=slot.team_id,
                team_name=_team_names(session, {slot.team_id}).get(slot.team_id) if slot.team_id else None,
                status=status_label,
                pick=pick,
            )
        )
    analysis = session.exec(
        select(MockDraftAnalysis).where(MockDraftAnalysis.session_id == draft_session.id)
    ).first()
    return MockDraftSessionRead(
        id=draft_session.id,
        league_id=draft_session.league_id,
        user_id=draft_session.user_id,
        user_team_id=draft_session.user_team_id,
        user_team_name=team_names.get(draft_session.user_team_id),
        adp_snapshot_id=draft_session.adp_snapshot_id,
        status=draft_session.status,
        pick_timer_seconds=draft_session.pick_timer_seconds,
        bot_config=draft_session.bot_config,
        keeper_context=draft_session.keeper_context,
        draft_type=draft_session.draft_type,
        round_count=draft_session.round_count,
        current_pick=next((slot.overall_pick for slot in board if slot.status == "Open"), None),
        completed_at=draft_session.completed_at,
        created_at=draft_session.created_at,
        updated_at=draft_session.updated_at,
        picks=[_pick_payload(session, pick) for pick in picks],
        board=board,
        available_players=_available_player_payload(session, draft_session),
        roster_needs=[
            MockDraftRosterNeed(**need)
            for need in roster_needs(session, draft_session, draft_session.user_team_id)
        ],
        strategy_plan=_strategy_plan_payload(draft_session),
        analysis=MockDraftAnalysisRead.model_validate(analysis) if analysis else None,
    )


def _pick_payload(session: Session, pick: MockDraftPick) -> MockDraftPickRead:
    team = session.get(Team, pick.team_id)
    player = session.get(Player, pick.player_id)
    return MockDraftPickRead(
        id=pick.id,
        session_id=pick.session_id,
        round=pick.round,
        pick_in_round=pick.pick_in_round,
        overall_pick=pick.overall_pick,
        team_id=pick.team_id,
        team_name=team.name if team else None,
        player_id=pick.player_id,
        player_name=player.full_name if player else None,
        position=player.position if player else None,
        nfl_team=player.nfl_team if player else None,
        source=pick.source,
        decision_time_ms=pick.decision_time_ms,
        bot_personality=pick.bot_personality,
        bot_difficulty=pick.bot_difficulty,
        reasoning_summary=pick.reasoning_summary,
        created_at=pick.created_at,
        updated_at=pick.updated_at,
    )


def _strategy_plan_payload(draft_session: MockDraftSession) -> MockDraftStrategyPlanRead | None:
    if not draft_session.strategy_plan:
        return None
    plan = dict(draft_session.strategy_plan)
    return MockDraftStrategyPlanRead(
        summary=str(plan.get("summary") or ""),
        round_plan=plan.get("round_plan") if isinstance(plan.get("round_plan"), list) else [],
        position_priorities=plan.get("position_priorities")
        if isinstance(plan.get("position_priorities"), list)
        else [],
        targets=plan.get("targets") if isinstance(plan.get("targets"), list) else [],
        fades=plan.get("fades") if isinstance(plan.get("fades"), list) else [],
        contingencies=plan.get("contingencies") if isinstance(plan.get("contingencies"), list) else [],
        generated_at=draft_session.strategy_plan_generated_at,
        cache_key=draft_session.strategy_plan_cache_key,
        error=draft_session.strategy_plan_error,
        ai_used=bool(plan.get("ai_used")),
        model=str(plan.get("model")) if plan.get("model") else None,
    )


def _available_player_payload(
    session: Session,
    draft_session: MockDraftSession,
) -> list[MockDraftAvailablePlayer]:
    adp_by_player = adp_entries_by_player(session, draft_session)
    rows = []
    for player in available_players(session, draft_session):
        adp = adp_by_player.get(player.id)
        rows.append(
            MockDraftAvailablePlayer(
                player_id=player.id,
                player_name=player.full_name,
                position=player.position,
                nfl_team=player.nfl_team,
                adp_pick=adp.adp_pick if adp else None,
                adp_round=adp.adp_round if adp else None,
                risk=adp.risk if adp else None,
                projection=adp.consensus_projection if adp else None,
                image_url=player.image_url,
            )
        )
    return rows


def _require_league(session: Session, league_id: uuid.UUID) -> League:
    league = session.get(League, league_id)
    if league is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="League not found")
    return league


def _require_mock_draft(session: Session, session_id: uuid.UUID) -> MockDraftSession:
    draft_session = session.get(MockDraftSession, session_id)
    if draft_session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mock draft not found")
    return draft_session


def _owned_session(
    session: Session,
    session_id: uuid.UUID,
    user: User | None,
) -> MockDraftSession:
    draft_session = _require_mock_draft(session, session_id)
    try:
        assert_session_owner(draft_session, _user_id(user))
    except MockDraftError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    return draft_session


def _assert_visible(draft_session: MockDraftSession, user: User | None) -> None:
    if draft_session.user_id != _user_id(user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Mock draft not visible")


def _team_names(session: Session, team_ids: set[uuid.UUID | None]) -> dict[uuid.UUID, str]:
    concrete_ids = {team_id for team_id in team_ids if team_id is not None}
    if not concrete_ids:
        return {}
    return {
        team.id: team.name
        for team in session.exec(select(Team).where(Team.id.in_(concrete_ids))).all()
    }


def _analyses_by_session(
    session: Session,
    session_ids: set[uuid.UUID],
) -> dict[uuid.UUID, MockDraftAnalysis]:
    if not session_ids:
        return {}
    return {
        analysis.session_id: analysis
        for analysis in session.exec(
            select(MockDraftAnalysis).where(MockDraftAnalysis.session_id.in_(session_ids))
        ).all()
    }


def _picks(session: Session, session_id: uuid.UUID) -> list[MockDraftPick]:
    return session.exec(
        select(MockDraftPick)
        .where(MockDraftPick.session_id == session_id)
        .order_by(MockDraftPick.overall_pick)
    ).all()


def _user_id(user: User | None) -> uuid.UUID | None:
    return user.id if user is not None else None
