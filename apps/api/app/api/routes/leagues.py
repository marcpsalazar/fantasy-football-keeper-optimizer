from __future__ import annotations

import csv
from datetime import UTC, date, datetime
from io import StringIO
import time
from typing import Any, Literal
import uuid

from fastapi import APIRouter, Body, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel
from sqlmodel import Session, select

from app.db.session import get_session
from app.core.config import get_settings
from app.models import (
    ADPEntry,
    ADPRefreshCandidate,
    ADPSnapshot,
    AIExplanation,
    AppDefaultOptimizerSettings,
    DraftPick,
    FinalRosterEntry,
    KeeperCandidate,
    KeeperRecommendation,
    League,
    LeagueMembership,
    ManualOverride,
    MockDraftAnalysis,
    MockDraftPick,
    MockDraftSession,
    OptimizerSettings,
    Player,
    Team,
    TeamScenarioSelection,
    User,
)
from app.schemas.league import LeagueCreate, LeagueRead, LeagueUpdate, TeamRead, TeamUpdate
from app.schemas.optimizer import OptimizerSettingsRead, OptimizerSettingsUpdate
from app.services.csv_imports import (
    CSVImportError,
    import_adp_csv,
    import_draft_results_csv,
    import_final_rosters_csv,
)
from app.services.adp_refresh import ADPRefreshError, refresh_adp_from_api
from app.services.sleeper_import import (
    SleeperAPIError,
    commit_sleeper_import,
    preview_sleeper_import,
)
from app.services.yahoo_import import (
    commit_yahoo_import,
    list_user_leagues,
    preview_yahoo_import,
)
from app.services.yahoo_oauth import (
    YahooAPIError,
    YahooTokenExpiredError,
    YahooTokenMissingError,
    get_valid_access_token,
)
from app.schemas.yahoo_import import YahooImportRequest
from app.services.ai_adp import AIADPError
from app.services.adp_review import create_ai_adp_refresh_candidate as create_ai_adp_refresh_candidate_service
from app.services.csv_preview import (
    CSVPreviewError,
    preview_adp_csv,
    preview_draft_results_csv,
    preview_final_rosters_csv,
)
from app.services.excel_export import ExcelExportError, build_keeper_recommendations_workbook
from app.services.news_feed import NewsFeedError, fetch_fantasy_news
from app.services.composite_adp import CompositeADPError, build_composite_adp_template_rows
from app.services.optimizer import (
    OptimizerInputError,
    ScenarioComparison,
    latest_recommendation_batch,
    run_optimizer,
    run_scenario_comparison,
)
from app.services.pdf_export import PDFExportError, build_team_outlooks_pdf
from app.services.auth import (
    assert_league_admin,
    require_current_user,
    require_platform_admin,
)
from app.services import keeper_explanation_ai
from app.services.keeper_explanation_ai import (
    ENTITY_TYPE as KEEPER_EXPLANATION_ENTITY_TYPE,
    build_explanation_context,
    explanation_input_hash,
)
from app.services import scenario_narrative_ai
from app.services.scenario_narrative_ai import (
    ENTITY_TYPE as SCENARIO_NARRATIVE_ENTITY_TYPE,
    build_narrative_context,
    narrative_input_hash,
)
from app.services import player_summary_ai
from app.services.player_summary_ai import ENTITY_TYPE as PLAYER_SUMMARY_ENTITY_TYPE
from app.services.mock_draft_ai import MockDraftAIError
from app.services.ai_log import is_over_monthly_budget, monthly_usage_summary, recent_logs, write_ai_log
from app.services import draft_history as draft_history_svc
from app.schemas.draft_history import TeamDraftHistoryRead
from app.services import keeper_signals as keeper_signals_svc
from app.services import keeper_history as keeper_history_svc
from app.services.keeper_history import KeeperHistoryImportError
from app.services import final_keepers as final_keepers_svc
from app.services.final_keepers import FinalKeeperError, KeeperSelectionInput
from app.services import sleeper_season_stats as sleeper_stats_svc
from app.services.sleeper_season_stats import SleeperStatsError
from app.services import season_analysis as season_analysis_svc
from app.services.season_analysis import SeasonAnalysisError
from app.services.keeper_card import KeeperCardError, build_keeper_card
from app.services import compliance as compliance_svc
from app.services.compliance import LeagueComplianceResult
from app.services import notifications as notifications_svc
from app.services.notifications import NotificationError
from app.services.bulk_export import BulkExportError, build_bulk_pdf_zip
from app.services import news_impact as news_impact_svc
from app.services.news_impact import NewsAlert
from app.services import value_window as value_window_svc

router = APIRouter(
    prefix="/api",
    tags=["leagues"],
    dependencies=[Depends(require_current_user)],
)


class TeamCreateRequest(BaseModel):
    name: str
    user_id: uuid.UUID | None = None
    owner_name: str | None = None
    draft_slot: int | None = None


class ADPSnapshotCreateRequest(BaseModel):
    season_year: int | None = None
    name: str
    source: str
    format_type: str = "superflex"
    snapshot_date: date
    notes: str | None = None


class ADPRefreshCandidateRejectRequest(BaseModel):
    reason: str | None = None


class OptimizerRunRequest(BaseModel):
    settings_id: uuid.UUID | None = None
    adp_snapshot_id: uuid.UUID | None = None
    scenario_name: str | None = None


class ScenarioComparisonRequest(BaseModel):
    adp_snapshot_id: uuid.UUID | None = None
    scenario_names: list[str] | None = None
    persist: bool = True


class ManualOverrideRequest(BaseModel):
    team_id: uuid.UUID
    player_id: uuid.UUID
    override_type: Literal["auto", "force_keep", "exclude"]
    notes: str | None = None


class ScenarioSelectionRequest(BaseModel):
    scenario_name: str | None = None


class LeagueMembershipUpsertRequest(BaseModel):
    user_id: uuid.UUID
    role: Literal["league_admin", "member"] = "member"


class LeagueMemberRoleRequest(BaseModel):
    role: Literal["league_admin", "member"]


class LeagueAvatarRequest(BaseModel):
    avatar_data_url: str | None = None


class SleeperImportRequest(BaseModel):
    sleeper_league_id: str
    season_year: int | None = None


class TradeGiveItemRequest(BaseModel):
    player_id: uuid.UUID


class TradeGivePickItemRequest(BaseModel):
    round: int


class TradeReceiveItemRequest(BaseModel):
    player_id: uuid.UUID
    keeper_cost_round: int | None = None


class TradeReceivePickItemRequest(BaseModel):
    round: int


class TradeAnalysisRunRequest(BaseModel):
    receiving_team_id: uuid.UUID
    giving_team_id: uuid.UUID | None = None
    give: list[TradeGiveItemRequest] = []
    give_picks: list[TradeGivePickItemRequest] = []
    receive: list[TradeReceiveItemRequest] = []
    receive_picks: list[TradeReceivePickItemRequest] = []
    adp_snapshot_id: uuid.UUID | None = None
    include_ai: bool = False


def _count_league_admins(session: Session, league_id: uuid.UUID) -> int:
    return len(
        session.exec(
            select(LeagueMembership).where(
                LeagueMembership.league_id == league_id,
                LeagueMembership.role == "league_admin",
            )
        ).all()
    )


def _membership_row(membership: LeagueMembership, user: User | None = None) -> dict[str, Any]:
    return {
        "id": str(membership.id),
        "user_id": str(membership.user_id),
        "league_id": str(membership.league_id),
        "role": membership.role,
        "avatar_data_url": membership.avatar_data_url,
        "user_email": user.email if user else None,
        "user_alias": user.alias if user else None,
        "created_at": membership.created_at.isoformat() if membership.created_at else None,
        "updated_at": membership.updated_at.isoformat() if membership.updated_at else None,
    }


@router.post("/leagues", response_model=LeagueRead, status_code=status.HTTP_201_CREATED)
def create_league(
    payload: LeagueCreate,
    user: User | None = Depends(require_current_user),
    session: Session = Depends(get_session),
) -> League:
    league_data = payload.model_dump()
    if user is not None:
        league_data["created_by_user_id"] = user.id
    league = League(**league_data)
    session.add(league)
    session.flush()
    if user is not None:
        membership = LeagueMembership(
            user_id=user.id,
            league_id=league.id,
            role="league_admin",
        )
        session.add(membership)
    session.commit()
    session.refresh(league)
    return league


@router.get("/leagues")
def list_leagues(session: Session = Depends(get_session)) -> dict[str, Any]:
    leagues = session.exec(select(League).order_by(League.season_year.desc(), League.name)).all()
    rows = [LeagueRead.model_validate(league).model_dump(mode="json") for league in leagues]
    return _table(rows)


# NOTE: /leagues/my must be declared BEFORE /leagues/{league_id} — FastAPI resolves in order.
@router.get("/leagues/my")
def list_my_leagues(
    user: User | None = Depends(require_current_user),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    if user is None:
        return _table([])
    if user.role == "platform_admin":
        leagues = session.exec(select(League).order_by(League.season_year.desc(), League.name)).all()
        league_ids = [lg.id for lg in leagues]
        avatar_map: dict = {}
        if league_ids:
            admin_memberships = session.exec(
                select(LeagueMembership).where(
                    LeagueMembership.user_id == user.id,
                    LeagueMembership.league_id.in_(league_ids),
                )
            ).all()
            avatar_map = {m.league_id: m.avatar_data_url for m in admin_memberships}
        rows = []
        for league in leagues:
            row = LeagueRead.model_validate(league).model_dump(mode="json")
            row["league_role"] = "league_admin"
            row["avatar_data_url"] = avatar_map.get(league.id)
            rows.append(row)
        return _table(rows)
    memberships = session.exec(
        select(LeagueMembership).where(LeagueMembership.user_id == user.id)
    ).all()
    if not memberships:
        return _table([])
    league_role_map = {m.league_id: m.role for m in memberships}
    membership_avatar_map = {m.league_id: m.avatar_data_url for m in memberships}
    leagues = session.exec(
        select(League)
        .where(League.id.in_(list(league_role_map.keys())))
        .order_by(League.season_year.desc(), League.name)
    ).all()
    rows = []
    for league in leagues:
        row = LeagueRead.model_validate(league).model_dump(mode="json")
        row["league_role"] = league_role_map.get(league.id, "member")
        row["avatar_data_url"] = membership_avatar_map.get(league.id)
        rows.append(row)
    return _table(rows)


@router.get("/leagues/{league_id}", response_model=LeagueRead)
def read_league(league_id: uuid.UUID, session: Session = Depends(get_session)) -> League:
    return _require_league(session, league_id)


@router.delete("/leagues/{league_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_league(
    league_id: uuid.UUID,
    user: User | None = Depends(require_current_user),
    session: Session = Depends(get_session),
) -> Response:
    league = _require_league(session, league_id)
    assert_league_admin(session, user, league_id)

    # Collect indirect IDs before deleting parents.
    session_ids = [
        r.id for r in session.exec(select(MockDraftSession).where(MockDraftSession.league_id == league_id)).all()
    ]
    snapshot_ids = [
        r.id for r in session.exec(select(ADPSnapshot).where(ADPSnapshot.league_id == league_id)).all()
    ]
    team_ids = [
        r.id for r in session.exec(select(Team).where(Team.league_id == league_id)).all()
    ]

    # Delete dependents of mock draft sessions.
    if session_ids:
        for row in session.exec(select(MockDraftAnalysis).where(MockDraftAnalysis.session_id.in_(session_ids))).all():
            session.delete(row)
        for row in session.exec(select(MockDraftPick).where(MockDraftPick.session_id.in_(session_ids))).all():
            session.delete(row)

    # Delete league-scoped rows.
    for model in (MockDraftSession, KeeperRecommendation, ManualOverride, TeamScenarioSelection,
                  OptimizerSettings, AIExplanation, ADPRefreshCandidate):
        for row in session.exec(select(model).where(model.league_id == league_id)).all():
            session.delete(row)

    # Delete ADP entries via snapshots.
    if snapshot_ids:
        for row in session.exec(select(ADPEntry).where(ADPEntry.snapshot_id.in_(snapshot_ids))).all():
            session.delete(row)
    for row in session.exec(select(ADPSnapshot).where(ADPSnapshot.league_id == league_id)).all():
        session.delete(row)

    # Delete team dependents.
    if team_ids:
        for row in session.exec(select(KeeperCandidate).where(KeeperCandidate.team_id.in_(team_ids))).all():
            session.delete(row)

    for model in (FinalRosterEntry, DraftPick):
        for row in session.exec(select(model).where(model.league_id == league_id)).all():
            session.delete(row)
    for row in session.exec(select(Team).where(Team.league_id == league_id)).all():
        session.delete(row)

    # Memberships cascade via FK, but delete explicitly too.
    for row in session.exec(select(LeagueMembership).where(LeagueMembership.league_id == league_id)).all():
        session.delete(row)

    session.delete(league)
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.patch("/leagues/{league_id}", response_model=LeagueRead)
def update_league(
    league_id: uuid.UUID,
    payload: LeagueUpdate,
    user: User | None = Depends(require_current_user),
    session: Session = Depends(get_session),
) -> League:
    assert_league_admin(session, user, league_id)
    league = _require_league(session, league_id)
    for field_name, value in payload.model_dump(exclude_unset=True).items():
        setattr(league, field_name, value)

    session.add(league)
    session.commit()
    session.refresh(league)
    return league


@router.post(
    "/leagues/{league_id}/teams",
    response_model=TeamRead,
    status_code=status.HTTP_201_CREATED,
)
def create_team(
    league_id: uuid.UUID,
    payload: TeamCreateRequest,
    user: User | None = Depends(require_current_user),
    session: Session = Depends(get_session),
) -> Team:
    assert_league_admin(session, user, league_id)
    _require_league(session, league_id)
    if payload.user_id is not None:
        _require_user(session, payload.user_id)
    team = Team(league_id=league_id, **payload.model_dump())
    session.add(team)
    session.commit()
    session.refresh(team)
    return team


@router.get("/leagues/{league_id}/teams")
def list_teams(league_id: uuid.UUID, session: Session = Depends(get_session)) -> dict[str, Any]:
    _require_league(session, league_id)
    teams = session.exec(select(Team).where(Team.league_id == league_id).order_by(Team.name)).all()
    user_ids = {team.user_id for team in teams if team.user_id is not None}
    users = {
        user.id: user
        for user in session.exec(select(User).where(User.id.in_(user_ids))).all()
    } if user_ids else {}
    rows = []
    for team in teams:
        row = TeamRead.model_validate(team).model_dump(mode="json")
        assigned_user = users.get(team.user_id)
        row["user_email"] = assigned_user.email if assigned_user else None
        row["user_alias"] = assigned_user.alias if assigned_user else None
        row["owner_display_name"] = _team_owner_display_name(team, assigned_user)
        rows.append(row)
    return _table(rows)


@router.patch("/teams/{team_id}", response_model=TeamRead)
def update_team(
    team_id: uuid.UUID,
    payload: TeamUpdate,
    user: User | None = Depends(require_current_user),
    session: Session = Depends(get_session),
) -> Team:
    team = session.get(Team, team_id)
    if team is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")
    assert_league_admin(session, user, team.league_id)

    update_data = payload.model_dump(exclude_unset=True)
    update_data.pop("league_id", None)
    if "user_id" in update_data and update_data["user_id"] is not None:
        _require_user(session, update_data["user_id"])
    for field_name, value in update_data.items():
        setattr(team, field_name, value)

    session.add(team)
    session.commit()
    session.refresh(team)
    return team


@router.delete("/teams/{team_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_team(
    team_id: uuid.UUID,
    user: User | None = Depends(require_current_user),
    session: Session = Depends(get_session),
) -> Response:
    team = session.get(Team, team_id)
    if team is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")
    assert_league_admin(session, user, team.league_id)

    for model in (
        TeamScenarioSelection,
        KeeperRecommendation,
        ManualOverride,
        KeeperCandidate,
        DraftPick,
        FinalRosterEntry,
    ):
        for row in session.exec(select(model).where(model.team_id == team_id)).all():
            session.delete(row)
    session.delete(team)
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def _team_owner_display_name(team: Team, user: User | None) -> str | None:
    if user is not None:
        return user.alias or team.owner_name or None
    return team.owner_name


@router.get("/leagues/{league_id}/draft-results")
def list_draft_results(
    league_id: uuid.UUID,
    season_year: int | None = Query(default=None),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    league = _require_league(session, league_id)
    return _table(_draft_result_rows(session, league, season_year=season_year))


@router.post("/leagues/{league_id}/draft-results/preview")
def preview_draft_results(
    league_id: uuid.UUID,
    csv_text: str = Body(..., media_type="text/csv"),
    user: User | None = Depends(require_current_user),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    assert_league_admin(session, user, league_id)
    try:
        return preview_draft_results_csv(session, league_id, csv_text).to_payload()
    except CSVPreviewError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/leagues/{league_id}/draft-results/import")
def import_draft_results(
    league_id: uuid.UUID,
    csv_text: str = Body(..., media_type="text/csv"),
    user: User | None = Depends(require_current_user),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    assert_league_admin(session, user, league_id)
    try:
        result = import_draft_results_csv(session, league_id, csv_text)
    except CSVImportError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return _table(result.rows, imported=result.imported)


@router.get("/leagues/{league_id}/final-rosters")
def list_final_rosters(
    league_id: uuid.UUID,
    season_year: int | None = Query(default=None),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    league = _require_league(session, league_id)
    return _table(_final_roster_rows(session, league, season_year=season_year))


@router.post("/leagues/{league_id}/final-rosters/preview")
def preview_final_rosters(
    league_id: uuid.UUID,
    csv_text: str = Body(..., media_type="text/csv"),
    user: User | None = Depends(require_current_user),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    assert_league_admin(session, user, league_id)
    try:
        return preview_final_rosters_csv(session, league_id, csv_text).to_payload()
    except CSVPreviewError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/leagues/{league_id}/final-rosters/import")
def import_final_rosters(
    league_id: uuid.UUID,
    csv_text: str = Body(..., media_type="text/csv"),
    user: User | None = Depends(require_current_user),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    assert_league_admin(session, user, league_id)
    try:
        result = import_final_rosters_csv(session, league_id, csv_text)
    except CSVImportError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return _table(result.rows, imported=result.imported)


@router.post("/leagues/{league_id}/import/sleeper/preview")
def preview_sleeper(
    league_id: uuid.UUID,
    payload: SleeperImportRequest,
    user: User | None = Depends(require_current_user),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    assert_league_admin(session, user, league_id)
    result = preview_sleeper_import(
        session, league_id, payload.sleeper_league_id, payload.season_year
    )
    return {
        "valid": result.valid,
        "season_year": result.season_year,
        "teams": result.teams,
        "draft_picks_count": result.draft_picks_count,
        "roster_entries_count": result.roster_entries_count,
        "warnings": result.warnings,
        "errors": result.errors,
    }


@router.post("/leagues/{league_id}/import/sleeper/commit")
def commit_sleeper(
    league_id: uuid.UUID,
    payload: SleeperImportRequest,
    user: User | None = Depends(require_current_user),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    assert_league_admin(session, user, league_id)
    try:
        result = commit_sleeper_import(
            session, league_id, payload.sleeper_league_id, payload.season_year
        )
    except SleeperAPIError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return {
        "season_year": result.season_year,
        "teams_upserted": result.teams_upserted,
        "draft_picks_upserted": result.draft_picks_upserted,
        "roster_entries_upserted": result.roster_entries_upserted,
        "warnings": result.warnings,
    }


def _yahoo_access_token(session: Session, user: User | None) -> str:
    """Resolve a valid Yahoo access token for the current user or raise HTTP 4xx."""
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    settings = get_settings()
    try:
        return get_valid_access_token(session, user.id, settings)
    except YahooTokenMissingError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except YahooTokenExpiredError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc


def _yahoo_access_token_optional(session: Session, user: User | None) -> str | None:
    """Return a Yahoo access token if one is available, otherwise None (no error)."""
    if user is None:
        return None
    try:
        return get_valid_access_token(session, user.id, get_settings())
    except Exception:
        return None


@router.get("/leagues/{league_id}/import/yahoo/user-leagues")
def list_yahoo_user_leagues(
    league_id: uuid.UUID,
    user: User | None = Depends(require_current_user),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    assert_league_admin(session, user, league_id)
    access_token = _yahoo_access_token(session, user)
    try:
        leagues = list_user_leagues(access_token)
    except YahooAPIError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    return {"leagues": [lg.model_dump() for lg in leagues]}


@router.post("/leagues/{league_id}/import/yahoo/preview")
def preview_yahoo(
    league_id: uuid.UUID,
    payload: YahooImportRequest,
    user: User | None = Depends(require_current_user),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    assert_league_admin(session, user, league_id)
    access_token = _yahoo_access_token(session, user)
    try:
        result = preview_yahoo_import(
            session,
            league_id,
            payload.yahoo_league_key,
            access_token,
            payload.season_year,
        )
    except YahooAPIError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return result.model_dump()


@router.post("/leagues/{league_id}/import/yahoo/commit")
def commit_yahoo(
    league_id: uuid.UUID,
    payload: YahooImportRequest,
    user: User | None = Depends(require_current_user),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    assert_league_admin(session, user, league_id)
    access_token = _yahoo_access_token(session, user)
    try:
        result = commit_yahoo_import(
            session,
            league_id,
            payload.yahoo_league_key,
            access_token,
            payload.season_year,
            payload.import_league_settings,
        )
    except YahooAPIError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return result.model_dump()


@router.post(
    "/leagues/{league_id}/adp-snapshots",
    status_code=status.HTTP_201_CREATED,
)
def create_adp_snapshot(
    league_id: uuid.UUID,
    payload: ADPSnapshotCreateRequest,
    user: User | None = Depends(require_current_user),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    assert_league_admin(session, user, league_id)
    league = _require_league(session, league_id)
    snapshot = ADPSnapshot(
        league_id=league.id,
        season_year=payload.season_year or league.season_year,
        name=payload.name,
        source=payload.source,
        format_type=payload.format_type,
        snapshot_date=payload.snapshot_date,
        notes=payload.notes,
    )
    session.add(snapshot)
    session.commit()
    session.refresh(snapshot)
    return _adp_snapshot_row(snapshot, entry_count=0)


@router.get("/leagues/{league_id}/adp-snapshots")
def list_adp_snapshots(
    league_id: uuid.UUID,
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    _require_league(session, league_id)
    snapshots = session.exec(
        select(ADPSnapshot)
        .where(ADPSnapshot.league_id == league_id)
        .order_by(ADPSnapshot.snapshot_date.desc(), ADPSnapshot.created_at.desc())
    ).all()
    entry_counts = _adp_entry_counts(session, [snapshot.id for snapshot in snapshots])
    return _table(
        [
            _adp_snapshot_row(snapshot, entry_count=entry_counts.get(snapshot.id, 0))
            for snapshot in snapshots
        ]
    )


@router.post("/leagues/{league_id}/adp/import")
@router.post("/leagues/{league_id}/adp-snapshots/import")
def import_adp(
    league_id: uuid.UUID,
    csv_text: str = Body(..., media_type="text/csv"),
    user: User | None = Depends(require_current_user),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    assert_league_admin(session, user, league_id)
    try:
        result = import_adp_csv(session, league_id, csv_text)
    except CSVImportError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return _table(result.rows, imported=result.imported)


@router.post("/leagues/{league_id}/adp/refresh")
def refresh_adp(
    league_id: uuid.UUID,
    user: User | None = Depends(require_current_user),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    assert_league_admin(session, user, league_id)
    league = _require_league(session, league_id)
    if league.adp_lock_date is not None:
        from datetime import date as _date
        if _date.today() >= league.adp_lock_date:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"ADP is locked as of {league.adp_lock_date.isoformat()}. No further refreshes are allowed.",
            )
    try:
        result = refresh_adp_from_api(session, league_id, get_settings())
    except ADPRefreshError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return {
        **_table(result.import_result.rows, imported=result.import_result.imported),
        "provider": result.provider,
        "source_url": result.source_url,
    }


@router.post(
    "/leagues/{league_id}/adp/ai-refresh-candidates",
    status_code=status.HTTP_201_CREATED,
)
def create_ai_adp_refresh_candidate(
    league_id: uuid.UUID,
    user: User | None = Depends(require_current_user),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    assert_league_admin(session, user, league_id)
    league = _require_league(session, league_id)
    if league.adp_lock_date is not None:
        from datetime import date as _date
        if _date.today() >= league.adp_lock_date:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"ADP is locked as of {league.adp_lock_date.isoformat()}. No further refreshes are allowed.",
            )
    try:
        candidate = create_ai_adp_refresh_candidate_service(session, league, get_settings())
    except AIADPError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    return _adp_refresh_candidate_row(candidate, include_rows=True)


@router.get("/leagues/{league_id}/adp/ai-refresh-candidates")
def list_ai_adp_refresh_candidates(
    league_id: uuid.UUID,
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    _require_league(session, league_id)
    candidates = session.exec(
        select(ADPRefreshCandidate)
        .where(ADPRefreshCandidate.league_id == league_id)
        .order_by(ADPRefreshCandidate.created_at.desc())
    ).all()
    return _table([_adp_refresh_candidate_row(candidate) for candidate in candidates])


@router.get("/adp/ai-refresh-candidates/{candidate_id}")
def read_ai_adp_refresh_candidate(
    candidate_id: uuid.UUID,
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    candidate = _require_adp_refresh_candidate(session, candidate_id)
    return _adp_refresh_candidate_row(candidate, include_rows=True)


@router.post("/adp/ai-refresh-candidates/{candidate_id}/approve")
def approve_ai_adp_refresh_candidate(
    candidate_id: uuid.UUID,
    user: User | None = Depends(require_current_user),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    candidate = _require_adp_refresh_candidate(session, candidate_id)
    assert_league_admin(session, user, candidate.league_id)
    if candidate.status != "pending":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only pending candidates can be approved")
    if not candidate.normalized_rows:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Candidate has no ADP rows")
    try:
        result = import_adp_csv(session, candidate.league_id, _rows_to_csv_text(candidate.normalized_rows))
    except CSVImportError as exc:
        candidate.status = "failed"
        candidate.error_message = str(exc)
        session.add(candidate)
        session.commit()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    candidate.status = "approved"
    candidate.approved_by_user_id = user.id if user else None
    candidate.approved_at = datetime.now(UTC).isoformat()
    candidate.error_message = None
    session.add(candidate)
    session.commit()
    session.refresh(candidate)
    return {
        **_adp_refresh_candidate_row(candidate),
        "imported": result.imported,
        "rows": result.rows,
    }


@router.post("/adp/ai-refresh-candidates/{candidate_id}/reject")
def reject_ai_adp_refresh_candidate(
    candidate_id: uuid.UUID,
    payload: ADPRefreshCandidateRejectRequest | None = None,
    user: User | None = Depends(require_current_user),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    candidate = _require_adp_refresh_candidate(session, candidate_id)
    assert_league_admin(session, user, candidate.league_id)
    if candidate.status != "pending":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only pending candidates can be rejected")
    candidate.status = "rejected"
    candidate.error_message = (payload.reason if payload else None) or "Rejected by admin"
    session.add(candidate)
    session.commit()
    session.refresh(candidate)
    return _adp_refresh_candidate_row(candidate)


@router.post("/leagues/{league_id}/adp/import-composite")
def import_composite_adp(
    league_id: uuid.UUID,
    user: User | None = Depends(require_current_user),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    assert_league_admin(session, user, league_id)
    league = _require_league(session, league_id)
    yahoo_token = _yahoo_access_token_optional(session, user)
    try:
        composite = build_composite_adp_template_rows(session, league, get_settings(), yahoo_access_token=yahoo_token)
        import_rows = [row for row in composite.rows if str(row.get("adp_pick", "")).strip()]
        if not import_rows:
            raise CompositeADPError("Composite ADP build returned no importable rows with ADP values")
        result = import_adp_csv(session, league_id, _rows_to_csv_text(import_rows))
    except (CompositeADPError, CSVImportError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return _table(
        result.rows,
        imported=result.imported,
        generated=len(composite.rows),
        skipped_missing_adp=len(composite.rows) - len(import_rows),
        coverage=composite.coverage,
    )


@router.get("/leagues/{league_id}/adp/coverage-summary")
def adp_coverage_summary(
    league_id: uuid.UUID,
    user: User | None = Depends(require_current_user),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    assert_league_admin(session, user, league_id)
    league = _require_league(session, league_id)
    yahoo_token = _yahoo_access_token_optional(session, user)
    try:
        composite = build_composite_adp_template_rows(session, league, get_settings(), yahoo_access_token=yahoo_token)
    except CompositeADPError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return composite.coverage


@router.post("/leagues/{league_id}/adp/preview")
@router.post("/leagues/{league_id}/adp-snapshots/preview")
def preview_adp(
    league_id: uuid.UUID,
    csv_text: str = Body(..., media_type="text/csv"),
    user: User | None = Depends(require_current_user),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    assert_league_admin(session, user, league_id)
    try:
        return preview_adp_csv(session, league_id, csv_text).to_payload()
    except CSVPreviewError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/leagues/{league_id}/adp-trend")
def get_adp_trend(
    league_id: uuid.UUID,
    snapshot_limit: int = Query(default=8, ge=2, le=16),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    """Return per-player ADP pick history across the most recent N snapshots."""
    _require_league(session, league_id)
    snapshots = session.exec(
        select(ADPSnapshot)
        .where(ADPSnapshot.league_id == league_id)
        .order_by(ADPSnapshot.snapshot_date.desc(), ADPSnapshot.created_at.desc())
        .limit(snapshot_limit)
    ).all()
    if not snapshots:
        return {"rows": []}

    # Oldest first for chronological sparkline display.
    snapshots = list(reversed(snapshots))

    all_entries = session.exec(
        select(ADPEntry).where(ADPEntry.snapshot_id.in_([s.id for s in snapshots]))
    ).all()

    # Build (snapshot_id, player_id) → adp_pick lookup.
    entry_map: dict[tuple[uuid.UUID, uuid.UUID], float] = {
        (e.snapshot_id, e.player_id): e.adp_pick for e in all_entries
    }

    # Produce history rows for every player in the most recent snapshot.
    latest_snapshot = snapshots[-1]
    latest_entries = [e for e in all_entries if e.snapshot_id == latest_snapshot.id]

    rows = []
    for entry in latest_entries:
        history = [
            {
                "snapshot_date": snapshot.snapshot_date.isoformat(),
                "adp_pick": entry_map[(snapshot.id, entry.player_id)],
            }
            for snapshot in snapshots
            if (snapshot.id, entry.player_id) in entry_map
        ]
        rows.append({"player_id": str(entry.player_id), "history": history})

    return {"rows": rows}


@router.get("/adp-snapshots/{snapshot_id}")
def read_adp_snapshot(
    snapshot_id: uuid.UUID,
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    snapshot = session.get(ADPSnapshot, snapshot_id)
    if snapshot is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ADP snapshot not found")

    rows = _adp_entry_rows(session, snapshot)
    return {
        **_table(rows),
        "snapshot": _adp_snapshot_row(snapshot, entry_count=len(rows)),
    }


@router.get("/news/fantasy-football")
def fantasy_football_news() -> dict[str, Any]:
    try:
        items = fetch_fantasy_news(get_settings(), limit=8)
    except NewsFeedError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    rows = [
        {
            "headline": item.headline,
            "link": item.link,
            "published_at": item.published_at,
            "source": item.source,
        }
        for item in items
    ]
    return _table(rows)


@router.get("/leagues/{league_id}/manual-overrides")
def list_manual_overrides(
    league_id: uuid.UUID,
    user: User | None = Depends(require_current_user),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    _require_league(session, league_id)
    overrides = session.exec(
        select(ManualOverride).where(
            ManualOverride.league_id == league_id,
            ManualOverride.user_id == _user_id(user),
        )
    ).all()
    return _table(_manual_override_rows(session, overrides))


@router.put("/leagues/{league_id}/manual-overrides")
def upsert_manual_override(
    league_id: uuid.UUID,
    payload: ManualOverrideRequest,
    user: User | None = Depends(require_current_user),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    _require_league(session, league_id)
    team = session.get(Team, payload.team_id)
    player = session.get(Player, payload.player_id)
    if team is None or team.league_id != league_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")
    if player is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Player not found")

    override = session.exec(
        select(ManualOverride).where(
            ManualOverride.league_id == league_id,
            ManualOverride.user_id == _user_id(user),
            ManualOverride.team_id == payload.team_id,
            ManualOverride.player_id == payload.player_id,
        )
    ).first()

    if payload.override_type == "auto":
        if override is not None:
            session.delete(override)
            session.commit()
        return {
            "id": None,
            "league_id": str(league_id),
            "team_id": str(payload.team_id),
            "team_name": team.name,
            "player_id": str(payload.player_id),
            "player_name": player.full_name,
            "position": player.position,
            "override_type": "auto",
            "notes": payload.notes,
        }

    if override is None:
        override = ManualOverride(
            league_id=league_id,
            user_id=_user_id(user),
            team_id=payload.team_id,
            player_id=payload.player_id,
            override_type=payload.override_type,
            notes=payload.notes,
        )
    else:
        override.override_type = payload.override_type
        override.notes = payload.notes

    session.add(override)
    session.commit()
    session.refresh(override)
    return _manual_override_rows(session, [override])[0]


@router.get("/leagues/{league_id}/optimizer/settings", response_model=OptimizerSettingsRead)
def read_optimizer_settings(
    league_id: uuid.UUID,
    settings_id: uuid.UUID | None = Query(default=None),
    user: User | None = Depends(require_current_user),
    session: Session = Depends(get_session),
) -> OptimizerSettings:
    _require_league(session, league_id)
    settings = _resolve_optimizer_settings(session, league_id, settings_id, user_id=_user_id(user))
    return settings


@router.patch("/leagues/{league_id}/optimizer/settings", response_model=OptimizerSettingsRead)
def update_optimizer_settings(
    league_id: uuid.UUID,
    payload: OptimizerSettingsUpdate,
    settings_id: uuid.UUID | None = Query(default=None),
    user: User | None = Depends(require_current_user),
    session: Session = Depends(get_session),
) -> OptimizerSettings:
    _require_league(session, league_id)
    settings = _resolve_optimizer_settings(
        session,
        league_id,
        settings_id,
        user_id=_user_id(user),
        for_update=True,
    )
    update_data = payload.model_dump(exclude_unset=True)
    update_data.pop("league_id", None)

    for field_name, value in update_data.items():
        setattr(settings, field_name, value)

    session.add(settings)
    session.commit()
    session.refresh(settings)
    return settings


@router.post("/leagues/{league_id}/optimizer/run")
def run_league_optimizer(
    league_id: uuid.UUID,
    payload: OptimizerRunRequest | None = None,
    user: User | None = Depends(require_current_user),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    payload = payload or OptimizerRunRequest()
    try:
        recommendations = run_optimizer(
            session,
            league_id,
            user_id=_user_id(user),
            settings_id=payload.settings_id,
            adp_snapshot_id=payload.adp_snapshot_id,
            scenario_name=payload.scenario_name,
            persist=True,
        )
    except OptimizerInputError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return _optimizer_table(session, recommendations)


@router.post("/leagues/{league_id}/optimizer/trade-analysis")
def run_trade_analysis(
    league_id: uuid.UUID,
    payload: TradeAnalysisRunRequest,
    user: User | None = Depends(require_current_user),
    session: Session = Depends(get_session),
    app_settings=Depends(get_settings),
) -> dict[str, Any]:
    from app.services.trade_analysis import (
        TradeAnalysisResult,
        TradeGiveItem,
        TradeGivePickItem,
        TradeReceiveItem,
        TradeReceivePickItem,
        analyze_trade,
    )

    _require_league(session, league_id)
    try:
        result = analyze_trade(
            session,
            league_id,
            payload.receiving_team_id,
            [TradeGiveItem(player_id=g.player_id) for g in payload.give],
            [TradeReceiveItem(player_id=r.player_id, keeper_cost_round=r.keeper_cost_round)
             for r in payload.receive],
            giving_team_id=payload.giving_team_id,
            give_picks=[TradeGivePickItem(round=p.round) for p in payload.give_picks],
            receive_picks=[TradeReceivePickItem(round=p.round) for p in payload.receive_picks],
            adp_snapshot_id=payload.adp_snapshot_id,
            user_id=_user_id(user),
            app_settings=app_settings if payload.include_ai else None,
            include_ai=payload.include_ai,
        )
    except OptimizerInputError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    def _row(r: "TradeAnalysisResult") -> dict[str, Any]:  # noqa: F821 — used locally
        return {
            "player_id": r.player_id,
            "player_name": r.player_name,
            "position": r.position,
            "nfl_team": r.nfl_team,
            "keeper_cost_pick": r.keeper_cost_pick,
            "keeper_cost_round": r.keeper_cost_round,
            "adp_pick": r.adp_pick,
            "adp_round": r.adp_round,
            "keeper_value": r.keeper_value,
            "keeper_score": r.keeper_score,
            "is_recommended": r.is_recommended,
            "is_incoming": r.is_incoming,
        }

    ai = None
    if result.ai_narrative is not None:
        ai = {
            "verdict": result.ai_narrative.verdict,
            "recommendation": result.ai_narrative.recommendation,
            "summary": result.ai_narrative.summary,
            "team_a_analysis": result.ai_narrative.team_a_analysis,
            "team_b_analysis": result.ai_narrative.team_b_analysis,
            "modifications": result.ai_narrative.modifications,
            "key_risk": result.ai_narrative.key_risk,
            "opportunity_cost": result.ai_narrative.opportunity_cost,
        }

    return {
        "receiving_team_id": result.receiving_team_id,
        "receiving_team_name": result.receiving_team_name,
        "baseline_keepers": [_row(r) for r in result.baseline_keepers],
        "hypothetical_keepers": [_row(r) for r in result.hypothetical_keepers],
        "baseline_surplus": result.baseline_surplus,
        "hypothetical_surplus": result.hypothetical_surplus,
        "surplus_delta": result.surplus_delta,
        "give_picks_value": result.give_picks_value,
        "receive_picks_value": result.receive_picks_value,
        "pick_value_delta": result.pick_value_delta,
        "total_value_delta": result.total_value_delta,
        "gained": [_row(r) for r in result.gained],
        "lost": [_row(r) for r in result.lost],
        "giving_team_id": result.giving_team_id,
        "giving_team_name": result.giving_team_name,
        "giving_baseline_keepers": [_row(r) for r in result.giving_baseline_keepers],
        "giving_hypothetical_keepers": [_row(r) for r in result.giving_hypothetical_keepers],
        "giving_baseline_surplus": result.giving_baseline_surplus,
        "giving_hypothetical_surplus": result.giving_hypothetical_surplus,
        "giving_surplus_delta": result.giving_surplus_delta,
        "giving_total_value_delta": result.giving_total_value_delta,
        "ai_narrative": ai,
    }


@router.post("/leagues/{league_id}/optimizer/scenarios")
def compare_optimizer_scenarios(
    league_id: uuid.UUID,
    payload: ScenarioComparisonRequest | None = None,
    user: User | None = Depends(require_current_user),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    payload = payload or ScenarioComparisonRequest()
    try:
        comparisons = run_scenario_comparison(
            session,
            league_id,
            user_id=_user_id(user),
            adp_snapshot_id=payload.adp_snapshot_id,
            scenario_names=payload.scenario_names,
            persist=payload.persist,
        )
    except OptimizerInputError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    base_payload = _scenario_comparison_payload(comparisons)
    all_teams = session.exec(select(Team).where(Team.league_id == league_id)).all()
    user_team_id = _resolve_user_team_id(user, all_teams)
    narrative = _load_scenario_narrative(
        session,
        league_id,
        user_id=_user_id(user),
        scenario_rows=base_payload["scenarios"],
        user_team_id=user_team_id,
        teams=all_teams,
    )
    base_payload["narrative"] = narrative
    return base_payload


@router.get("/leagues/{league_id}/optimizer/scenarios/narrative")
def get_scenario_narrative(
    league_id: uuid.UUID,
    user: User | None = Depends(require_current_user),
    session: Session = Depends(get_session),
    app_settings=Depends(get_settings),
) -> dict[str, Any]:
    _require_league(session, league_id)
    existing = session.exec(
        select(AIExplanation).where(
            AIExplanation.entity_type == SCENARIO_NARRATIVE_ENTITY_TYPE,
            AIExplanation.league_id == league_id,
            AIExplanation.user_id == _user_id(user),
        )
        .order_by(AIExplanation.created_at.desc())
    ).first()
    return {"narrative": existing.content if existing else None}


@router.post("/leagues/{league_id}/optimizer/scenarios/narrative")
def generate_scenario_narrative(
    league_id: uuid.UUID,
    user: User | None = Depends(require_current_user),
    session: Session = Depends(get_session),
    app_settings=Depends(get_settings),
) -> dict[str, Any]:
    _require_league(session, league_id)
    try:
        comparisons = run_scenario_comparison(
            session,
            league_id,
            user_id=_user_id(user),
            persist=False,
        )
    except OptimizerInputError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    base_payload = _scenario_comparison_payload(comparisons)
    scenario_rows: list[dict[str, Any]] = base_payload["scenarios"]

    if not scenario_rows:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No scenario data available. Run scenarios first.",
        )

    league = session.get(League, league_id)
    teams = session.exec(select(Team).where(Team.league_id == league_id)).all()
    user_team_id = _resolve_user_team_id(user, teams)
    user_team_context = _build_user_team_context(scenario_rows, user_team_id, teams)

    summaries = _narrative_summaries(scenario_rows, user_team_context)
    rec_hash = narrative_input_hash(
        league_id=league_id,
        user_id=_user_id(user),
        scenario_summaries=summaries,
    )
    existing = session.exec(
        select(AIExplanation).where(
            AIExplanation.entity_type == SCENARIO_NARRATIVE_ENTITY_TYPE,
            AIExplanation.input_hash == rec_hash,
        )
    ).first()
    if existing is not None:
        return {"narrative": existing.content}

    if not scenario_narrative_ai.is_enabled(app_settings):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Scenario narrative AI is not enabled. Set SCENARIO_NARRATIVE_AI_ENABLED=true.",
        )

    if is_over_monthly_budget(session, app_settings):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Monthly AI token budget exceeded.",
        )

    context = build_narrative_context(
        scoring_format=league.scoring_format if league else "ppr",
        draft_type=league.draft_type if league else "snake",
        team_count=len(teams),
        scenarios=scenario_rows,
        user_team_context=user_team_context,
    )
    try:
        _t0 = time.monotonic()
        result = scenario_narrative_ai.generate_scenario_narrative(
            settings=app_settings, context=context
        )
        _latency = int((time.monotonic() - _t0) * 1000)
    except MockDraftAIError as exc:
        write_ai_log(
            session,
            feature="scenario_narrative",
            league_id=league_id,
            user_id=_user_id(user),
            model=app_settings.scenario_narrative_model,
            status="failed",
            error_message=str(exc)[:500],
        )
        session.commit()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"AI narrative failed: {exc}",
        ) from exc

    content = {
        "summary": result.summary,
        "best_fit": result.best_fit,
        "tradeoffs": result.tradeoffs,
        "decision_notes": result.decision_notes,
    }
    record = AIExplanation(
        league_id=league_id,
        user_id=_user_id(user),
        entity_type=SCENARIO_NARRATIVE_ENTITY_TYPE,
        input_hash=rec_hash,
        model=app_settings.scenario_narrative_model,
        content=content,
    )
    session.add(record)
    write_ai_log(
        session,
        feature="scenario_narrative",
        league_id=league_id,
        user_id=_user_id(user),
        model=app_settings.scenario_narrative_model,
        status="success",
        token_usage=result.token_usage,
        latency_ms=_latency,
    )
    session.commit()
    return {"narrative": content}


@router.get("/leagues/{league_id}/scenario-selections")
def list_scenario_selections(
    league_id: uuid.UUID,
    user: User | None = Depends(require_current_user),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    _require_league(session, league_id)
    if user is None:
        return _table([])
    selections = session.exec(
        select(TeamScenarioSelection).where(
            TeamScenarioSelection.league_id == league_id,
            TeamScenarioSelection.user_id == user.id,
        )
    ).all()
    teams = _teams_by_id(session, {selection.team_id for selection in selections})
    rows = [
        {
            "id": str(selection.id),
            "league_id": str(selection.league_id),
            "team_id": str(selection.team_id),
            "team_name": teams.get(selection.team_id).name if teams.get(selection.team_id) else None,
            "scenario_name": selection.scenario_name,
            "created_at": selection.created_at.isoformat(),
            "updated_at": selection.updated_at.isoformat(),
        }
        for selection in selections
    ]
    rows.sort(key=lambda row: row["team_name"] or "")
    return _table(rows)


@router.put("/leagues/{league_id}/scenario-selections/{team_id}")
def upsert_scenario_selection(
    league_id: uuid.UUID,
    team_id: uuid.UUID,
    payload: ScenarioSelectionRequest,
    user: User | None = Depends(require_current_user),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    _require_league(session, league_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    team = session.get(Team, team_id)
    if team is None or team.league_id != league_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")

    selection = session.exec(
        select(TeamScenarioSelection).where(
            TeamScenarioSelection.league_id == league_id,
            TeamScenarioSelection.user_id == user.id,
            TeamScenarioSelection.team_id == team_id,
        )
    ).first()

    scenario_name = (payload.scenario_name or "").strip()
    if not scenario_name:
        if selection is not None:
            session.delete(selection)
            session.commit()
        return {
            "id": None,
            "league_id": str(league_id),
            "team_id": str(team_id),
            "team_name": team.name,
            "scenario_name": None,
        }

    if selection is None:
        selection = TeamScenarioSelection(
            league_id=league_id,
            user_id=user.id,
            team_id=team_id,
            scenario_name=scenario_name,
        )
    else:
        selection.scenario_name = scenario_name
    session.add(selection)
    session.commit()
    session.refresh(selection)
    return {
        "id": str(selection.id),
        "league_id": str(selection.league_id),
        "team_id": str(selection.team_id),
        "team_name": team.name,
        "scenario_name": selection.scenario_name,
        "created_at": selection.created_at.isoformat(),
        "updated_at": selection.updated_at.isoformat(),
    }


@router.get("/leagues/{league_id}/draft-impact")
def read_draft_impact(
    league_id: uuid.UUID,
    scenario_name: str | None = Query(default=None),
    rounds: int = Query(default=10, ge=1, le=30),
    user: User | None = Depends(require_current_user),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    league = _require_league(session, league_id)
    rows = _draft_impact_rows(
        session,
        league,
        scenario_name=scenario_name,
        rounds=rounds,
        user_id=_user_id(user),
    )
    return _table(rows, forfeited_count=sum(1 for row in rows if row["status"] == "Forfeited"))


@router.get("/leagues/{league_id}/optimizer/results")
def read_optimizer_results(
    league_id: uuid.UUID,
    settings_id: uuid.UUID | None = Query(default=None),
    adp_snapshot_id: uuid.UUID | None = Query(default=None),
    scenario_name: str | None = Query(default=None),
    user: User | None = Depends(require_current_user),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    _require_league(session, league_id)
    if settings_id is None and adp_snapshot_id is None:
        recommendations = latest_recommendation_batch(
            session,
            league_id,
            user_id=_user_id(user),
            scenario_name=scenario_name,
        )
    else:
        statement = select(KeeperRecommendation).where(
            KeeperRecommendation.league_id == league_id,
            KeeperRecommendation.user_id == _user_id(user),
        )
        if settings_id is not None:
            statement = statement.where(KeeperRecommendation.settings_id == settings_id)
        if adp_snapshot_id is not None:
            statement = statement.where(KeeperRecommendation.adp_snapshot_id == adp_snapshot_id)
        if scenario_name is not None:
            statement = statement.where(KeeperRecommendation.scenario_name == scenario_name)
        recommendations = session.exec(statement).all()
    return _optimizer_table(session, recommendations)


@router.get("/leagues/{league_id}/optimizer/results/{recommendation_id}/explanation")
def get_keeper_explanation(
    league_id: uuid.UUID,
    recommendation_id: uuid.UUID,
    user: User | None = Depends(require_current_user),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    _require_league(session, league_id)
    recommendation = _require_recommendation(session, recommendation_id, league_id, user)
    rec_hash = explanation_input_hash(
        league_id=recommendation.league_id,
        user_id=recommendation.user_id,
        player_id=recommendation.player_id,
        scenario_name=recommendation.scenario_name,
        keeper_cost_pick=recommendation.keeper_cost_pick,
        adp_pick=recommendation.adp_pick,
        keeper_score=recommendation.keeper_score,
    )
    existing = session.exec(
        select(AIExplanation).where(
            AIExplanation.entity_type == KEEPER_EXPLANATION_ENTITY_TYPE,
            AIExplanation.input_hash == rec_hash,
        )
    ).first()
    if existing is None:
        return {"recommendation_id": str(recommendation_id), "ai_explanation": None}
    return {"recommendation_id": str(recommendation_id), "ai_explanation": existing.content}


@router.post("/leagues/{league_id}/optimizer/results/{recommendation_id}/explanation")
def generate_keeper_explanation(
    league_id: uuid.UUID,
    recommendation_id: uuid.UUID,
    user: User | None = Depends(require_current_user),
    session: Session = Depends(get_session),
    settings=Depends(get_settings),
) -> dict[str, Any]:
    _require_league(session, league_id)
    recommendation = _require_recommendation(session, recommendation_id, league_id, user)
    player = session.get(Player, recommendation.player_id)
    league = session.get(League, recommendation.league_id)
    team_count = session.exec(
        select(Team).where(Team.league_id == recommendation.league_id)
    ).all()

    rec_hash = explanation_input_hash(
        league_id=recommendation.league_id,
        user_id=recommendation.user_id,
        player_id=recommendation.player_id,
        scenario_name=recommendation.scenario_name,
        keeper_cost_pick=recommendation.keeper_cost_pick,
        adp_pick=recommendation.adp_pick,
        keeper_score=recommendation.keeper_score,
    )
    existing = session.exec(
        select(AIExplanation).where(
            AIExplanation.entity_type == KEEPER_EXPLANATION_ENTITY_TYPE,
            AIExplanation.input_hash == rec_hash,
        )
    ).first()
    if existing is not None:
        return {"recommendation_id": str(recommendation_id), "ai_explanation": existing.content}

    if not keeper_explanation_ai.is_enabled(settings):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Keeper explanation AI is not enabled. Set KEEPER_EXPLANATION_AI_ENABLED=true.",
        )

    if is_over_monthly_budget(session, settings):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Monthly AI token budget exceeded.",
        )

    context = build_explanation_context(
        player_name=player.full_name if player else "Unknown",
        position=player.position if player else "?",
        nfl_team=player.nfl_team if player else None,
        keeper_cost_pick=recommendation.keeper_cost_pick,
        keeper_cost_round=recommendation.keeper_cost_round,
        adp_pick=recommendation.adp_pick,
        adp_round=recommendation.adp_round,
        keeper_value=recommendation.keeper_value,
        keeper_score=recommendation.keeper_score,
        is_recommended=recommendation.is_recommended,
        is_eligible=recommendation.is_eligible,
        scenario_name=recommendation.scenario_name,
        scoring_format=league.scoring_format if league else "ppr",
        draft_type=league.draft_type if league else "snake",
        team_count=len(team_count),
    )
    try:
        _t0 = time.monotonic()
        result = keeper_explanation_ai.generate_keeper_explanation(settings=settings, context=context)
        _latency = int((time.monotonic() - _t0) * 1000)
    except MockDraftAIError as exc:
        write_ai_log(
            session,
            feature="keeper_explanation",
            league_id=recommendation.league_id,
            user_id=recommendation.user_id,
            model=settings.keeper_explanation_model,
            status="failed",
            error_message=str(exc)[:500],
        )
        session.commit()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"AI explanation failed: {exc}",
        ) from exc

    content = {
        "short_reason": result.short_reason,
        "value_explanation": result.value_explanation,
        "risk_note": result.risk_note,
        "opportunity_cost": result.opportunity_cost,
        "decision": result.decision,
    }
    record = AIExplanation(
        league_id=recommendation.league_id,
        user_id=recommendation.user_id,
        entity_type=KEEPER_EXPLANATION_ENTITY_TYPE,
        entity_id=recommendation.id,
        input_hash=rec_hash,
        model=settings.keeper_explanation_model,
        content=content,
    )
    session.add(record)
    write_ai_log(
        session,
        feature="keeper_explanation",
        league_id=recommendation.league_id,
        user_id=recommendation.user_id,
        model=settings.keeper_explanation_model,
        status="success",
        token_usage=result.token_usage,
        latency_ms=_latency,
    )
    session.commit()
    return {"recommendation_id": str(recommendation_id), "ai_explanation": content}


@router.get("/leagues/{league_id}/adp/players/{player_id}/summary")
def get_player_summary(
    league_id: uuid.UUID,
    player_id: uuid.UUID,
    snapshot_id: uuid.UUID,
    user: User | None = Depends(require_current_user),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    league = _require_league(session, league_id)
    rec_hash = player_summary_ai.summary_input_hash(
        player_id=player_id,
        adp_snapshot_id=snapshot_id,
        scoring_format=league.scoring_format,
        draft_type=league.draft_type,
    )
    existing = session.exec(
        select(AIExplanation).where(
            AIExplanation.entity_type == PLAYER_SUMMARY_ENTITY_TYPE,
            AIExplanation.input_hash == rec_hash,
        )
    ).first()
    if existing is None:
        return {"player_id": str(player_id), "ai_summary": None}
    return {"player_id": str(player_id), "ai_summary": existing.content}


@router.post("/leagues/{league_id}/adp/players/{player_id}/summary")
def generate_player_summary(
    league_id: uuid.UUID,
    player_id: uuid.UUID,
    snapshot_id: uuid.UUID,
    user: User | None = Depends(require_current_user),
    session: Session = Depends(get_session),
    settings=Depends(get_settings),
) -> dict[str, Any]:
    league = _require_league(session, league_id)
    player = session.get(Player, player_id)
    teams = session.exec(select(Team).where(Team.league_id == league_id)).all()
    adp_entry = session.exec(
        select(ADPEntry).where(
            ADPEntry.snapshot_id == snapshot_id,
            ADPEntry.player_id == player_id,
        )
    ).first()
    snapshot_size = session.exec(
        select(ADPEntry).where(ADPEntry.snapshot_id == snapshot_id)
    ).all()

    rec_hash = player_summary_ai.summary_input_hash(
        player_id=player_id,
        adp_snapshot_id=snapshot_id,
        scoring_format=league.scoring_format,
        draft_type=league.draft_type,
    )
    existing = session.exec(
        select(AIExplanation).where(
            AIExplanation.entity_type == PLAYER_SUMMARY_ENTITY_TYPE,
            AIExplanation.input_hash == rec_hash,
        )
    ).first()
    if existing is not None:
        return {"player_id": str(player_id), "ai_summary": existing.content}

    if not player_summary_ai.is_enabled(settings):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Player summary AI is not enabled. Set PLAYER_SUMMARY_AI_ENABLED=true.",
        )

    if is_over_monthly_budget(session, settings):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Monthly AI token budget exceeded.",
        )

    context = player_summary_ai.build_summary_context(
        player_name=player.full_name if player else "Unknown",
        position=player.position if player else "?",
        nfl_team=player.nfl_team if player else None,
        adp_pick=adp_entry.adp_pick if adp_entry else 999.0,
        adp_round=adp_entry.adp_round if adp_entry else None,
        consensus_projection=adp_entry.consensus_projection if adp_entry else None,
        floor_projection=adp_entry.floor_projection if adp_entry else None,
        ceiling_projection=adp_entry.ceiling_projection if adp_entry else None,
        risk=adp_entry.risk if adp_entry else None,
        sos=adp_entry.sos if adp_entry else None,
        scoring_format=league.scoring_format,
        draft_type=league.draft_type,
        team_count=len(teams),
        board_size=len(snapshot_size),
    )
    try:
        _t0 = time.monotonic()
        result = player_summary_ai.generate_player_summary(settings=settings, context=context)
        _latency = int((time.monotonic() - _t0) * 1000)
    except MockDraftAIError as exc:
        write_ai_log(
            session,
            feature="player_summary",
            league_id=league_id,
            user_id=user.id if user else None,
            model=settings.player_summary_model,
            status="failed",
            error_message=str(exc)[:500],
        )
        session.commit()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"AI player summary failed: {exc}",
        ) from exc

    content = {
        "quick_take": result.quick_take,
        "fantasy_points_context": result.fantasy_points_context,
        "value_note": result.value_note,
        "risk_note": result.risk_note,
        "roster_fit": result.roster_fit,
        "draft_recommendation": result.draft_recommendation,
    }
    record = AIExplanation(
        league_id=league_id,
        user_id=user.id if user else None,
        entity_type=PLAYER_SUMMARY_ENTITY_TYPE,
        entity_id=player_id,
        input_hash=rec_hash,
        model=settings.player_summary_model,
        content=content,
    )
    session.add(record)
    write_ai_log(
        session,
        feature="player_summary",
        league_id=league_id,
        user_id=user.id if user else None,
        model=settings.player_summary_model,
        status="success",
        token_usage=result.token_usage,
        latency_ms=_latency,
    )
    session.commit()
    return {"player_id": str(player_id), "ai_summary": content}


@router.get("/leagues/{league_id}/exports/keeper-recommendations.csv")
def export_keeper_recommendations_csv(
    league_id: uuid.UUID,
    scenario_name: str | None = Query(default=None),
    user: User | None = Depends(require_current_user),
    session: Session = Depends(get_session),
) -> Response:
    _require_league(session, league_id)
    payload = _optimizer_table(
        session,
        latest_recommendation_batch(
            session,
            league_id,
            user_id=_user_id(user),
            scenario_name=scenario_name,
            recommended_only=True,
        ),
    )
    return _csv_response(
        rows=payload["rows"],
        filename=f"keeper-recommendations-{league_id}.csv",
    )


@router.get("/leagues/{league_id}/exports/adp-template.csv")
def export_adp_template_csv(
    league_id: uuid.UUID,
    user: User | None = Depends(require_current_user),
    session: Session = Depends(get_session),
) -> Response:
    league = _require_league(session, league_id)
    yahoo_token = _yahoo_access_token_optional(session, user)
    try:
        result = build_composite_adp_template_rows(session, league, get_settings(), yahoo_access_token=yahoo_token)
    except CompositeADPError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return _csv_response(
        rows=result.rows,
        filename=f"adp-template-{league_id}-{datetime.now().strftime('%Y%m%d-%H%M%S')}.csv",
    )


@router.get("/leagues/{league_id}/exports/adp-current.csv")
def export_current_adp_csv(
    league_id: uuid.UUID,
    user: User | None = Depends(require_current_user),
    session: Session = Depends(get_session),
) -> Response:
    league = _require_league(session, league_id)
    snapshot = session.exec(
        select(ADPSnapshot)
        .where(ADPSnapshot.league_id == league.id)
        .order_by(ADPSnapshot.snapshot_date.desc(), ADPSnapshot.created_at.desc())
    ).first()
    if snapshot is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No ADP snapshot found for this league")
    rows = _adp_entry_rows(session, snapshot)
    csv_rows = [
        {
            "player": row["player_name"],
            "position": row["position"],
            "nfl_team": row["nfl_team"],
            "adp_pick": row["adp_pick"],
            "adp_round": row["adp_round"],
            "source": row["source"],
            "snapshot_date": row["snapshot_date"],
            "format": row["format_type"],
        }
        for row in rows
    ]
    return _csv_response(
        rows=csv_rows,
        filename=f"adp-{league_id}-{snapshot.snapshot_date.strftime('%Y%m%d')}.csv",
    )


@router.get("/leagues/{league_id}/exports/team-outlooks.pdf")
def export_team_outlooks_pdf(
    league_id: uuid.UUID,
    team_id: uuid.UUID | None = Query(default=None),
    scenario_name: str | None = Query(default=None),
    user: User | None = Depends(require_current_user),
    session: Session = Depends(get_session),
) -> Response:
    try:
        content = build_team_outlooks_pdf(
            session,
            league_id,
            team_id=team_id,
            scenario_name=scenario_name,
            user_id=_user_id(user),
        )
    except PDFExportError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    filename = f"team-outlooks-{team_id or league_id}.pdf"
    return Response(
        content=content,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/leagues/{league_id}/teams/{team_id}/exports/keeper-card.png")
def export_keeper_card_png(
    league_id: uuid.UUID,
    team_id: uuid.UUID,
    scenario_name: str | None = Query(default=None),
    user: User | None = Depends(require_current_user),
    session: Session = Depends(get_session),
) -> Response:
    try:
        content = build_keeper_card(
            session,
            league_id,
            team_id,
            scenario_name=scenario_name,
            user_id=_user_id(user),
        )
    except KeeperCardError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    filename = f"keeper-card-{team_id}.png"
    return Response(
        content=content,
        media_type="image/png",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/leagues/{league_id}/exports/keeper-recommendations.xlsx")
def export_keeper_recommendations_excel(
    league_id: uuid.UUID,
    scenario_name: str | None = Query(default=None),
    user: User | None = Depends(require_current_user),
    session: Session = Depends(get_session),
) -> Response:
    try:
        content = build_keeper_recommendations_workbook(
            session,
            league_id,
            scenario_name=scenario_name,
            user_id=_user_id(user),
        )
    except ExcelExportError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    filename = f"keeper-recommendations-{league_id}.xlsx"
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _draft_result_rows(
    session: Session,
    league: League,
    *,
    season_year: int | None = None,
) -> list[dict[str, Any]]:
    year = season_year or league.season_year
    picks = session.exec(
        select(DraftPick)
        .where(DraftPick.league_id == league.id, DraftPick.season_year == year)
        .order_by(DraftPick.overall_pick)
    ).all()
    teams = _teams_by_id(session, {pick.team_id for pick in picks})
    players = _players_by_id(session, {pick.player_id for pick in picks})

    rows = []
    for pick in picks:
        player = players.get(pick.player_id)
        team = teams.get(pick.team_id)
        rows.append(
            {
                "id": str(pick.id),
                "league_id": str(pick.league_id),
                "team_id": str(pick.team_id),
                "team_name": team.name if team else None,
                "player_id": str(pick.player_id),
                "player_name": player.full_name if player else None,
                "position": player.position if player else pick.position,
                "nfl_team": player.nfl_team if player else None,
                "season_year": pick.season_year,
                "round": pick.round,
                "overall_pick": pick.overall_pick,
                "pick_in_round": pick.pick_in_round,
                "keeper_cost": _format_round_pick(pick.round, pick.pick_in_round, pick.overall_pick),
            }
        )
    return rows


def _final_roster_rows(
    session: Session,
    league: League,
    *,
    season_year: int | None = None,
) -> list[dict[str, Any]]:
    year = season_year or league.season_year
    entries = session.exec(
        select(FinalRosterEntry).where(
            FinalRosterEntry.league_id == league.id,
            FinalRosterEntry.season_year == year,
        )
    ).all()
    teams = _teams_by_id(session, {entry.team_id for entry in entries})
    players = _players_by_id(session, {entry.player_id for entry in entries})

    rows = []
    for entry in entries:
        team = teams.get(entry.team_id)
        player = players.get(entry.player_id)
        rows.append(
            {
                "id": str(entry.id),
                "league_id": str(entry.league_id),
                "team_id": str(entry.team_id),
                "team_name": team.name if team else None,
                "player_id": str(entry.player_id),
                "player_name": player.full_name if player else None,
                "position": player.position if player else entry.position,
                "nfl_team": player.nfl_team if player else None,
                "season_year": entry.season_year,
                "roster_status": entry.roster_status,
                "acquired_via": _acquisition_label(
                    session=session,
                    league=league,
                    team_id=entry.team_id,
                    player_id=entry.player_id,
                ),
            }
        )

    rows.sort(key=lambda row: (row["team_name"] or "", row["player_name"] or ""))
    return rows


def _adp_entry_rows(session: Session, snapshot: ADPSnapshot) -> list[dict[str, Any]]:
    entries = session.exec(
        select(ADPEntry).where(ADPEntry.snapshot_id == snapshot.id).order_by(ADPEntry.adp_pick)
    ).all()
    players = _players_by_id(session, {entry.player_id for entry in entries})

    rows = []
    for entry in entries:
        player = players.get(entry.player_id)
        rows.append(
            {
                "id": str(entry.id),
                "league_id": str(snapshot.league_id),
                "snapshot_id": str(snapshot.id),
                "snapshot_name": snapshot.name,
                "source": snapshot.source,
                "snapshot_date": snapshot.snapshot_date.isoformat(),
                "format_type": snapshot.format_type,
                "player_id": str(entry.player_id),
                "player_name": player.full_name if player else None,
                "position": player.position if player else entry.position,
                "nfl_team": player.nfl_team if player else None,
                "adp_pick": entry.adp_pick,
                "adp_round": entry.adp_round,
                "source_note": entry.source_note,
                "sos": entry.sos,
                "injury": entry.injury,
                "risk": entry.risk,
                "floor_projection": entry.floor_projection,
                "consensus_projection": entry.consensus_projection,
                "draftsharks_projection": entry.draftsharks_projection,
                "ceiling_projection": entry.ceiling_projection,
                "draftsharks_3d_value": entry.draftsharks_3d_value,
            }
        )
    return rows


def _adp_snapshot_row(snapshot: ADPSnapshot, *, entry_count: int) -> dict[str, Any]:
    return {
        "id": str(snapshot.id),
        "league_id": str(snapshot.league_id),
        "season_year": snapshot.season_year,
        "name": snapshot.name,
        "source": snapshot.source,
        "format_type": snapshot.format_type,
        "snapshot_date": snapshot.snapshot_date.isoformat(),
        "notes": snapshot.notes,
        "entry_count": entry_count,
        "created_at": snapshot.created_at.isoformat(),
        "updated_at": snapshot.updated_at.isoformat(),
    }


def _adp_refresh_candidate_row(
    candidate: ADPRefreshCandidate,
    *,
    include_rows: bool = False,
) -> dict[str, Any]:
    row_count = len(candidate.normalized_rows or [])
    payload: dict[str, Any] = {
        "id": str(candidate.id),
        "league_id": str(candidate.league_id),
        "provider": candidate.provider,
        "model": candidate.model,
        "status": candidate.status,
        "board_size": candidate.board_size,
        "generated_at": candidate.generated_at,
        "source_summary": candidate.source_summary,
        "warnings": candidate.warnings,
        "warning_count": len(candidate.warnings or []),
        "row_count": row_count,
        "error_message": candidate.error_message,
        "approved_by_user_id": str(candidate.approved_by_user_id) if candidate.approved_by_user_id else None,
        "approved_at": candidate.approved_at,
        "created_at": candidate.created_at.isoformat(),
        "updated_at": candidate.updated_at.isoformat(),
    }
    if include_rows:
        payload["rows"] = candidate.normalized_rows
    else:
        payload["preview_rows"] = (candidate.normalized_rows or [])[:8]
    return payload


def _require_adp_refresh_candidate(session: Session, candidate_id: uuid.UUID) -> ADPRefreshCandidate:
    candidate = session.get(ADPRefreshCandidate, candidate_id)
    if candidate is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ADP refresh candidate not found")
    return candidate


def _manual_override_rows(
    session: Session,
    overrides: list[ManualOverride],
) -> list[dict[str, Any]]:
    teams = _teams_by_id(session, {override.team_id for override in overrides})
    players = _players_by_id(session, {override.player_id for override in overrides})
    rows = []
    for override in overrides:
        team = teams.get(override.team_id)
        player = players.get(override.player_id)
        rows.append(
            {
                "id": str(override.id),
                "league_id": str(override.league_id),
                "team_id": str(override.team_id),
                "team_name": team.name if team else None,
                "player_id": str(override.player_id),
                "player_name": player.full_name if player else None,
                "position": player.position if player else None,
                "override_type": override.override_type,
                "notes": override.notes,
                "created_at": override.created_at.isoformat(),
                "updated_at": override.updated_at.isoformat(),
            }
        )
    rows.sort(key=lambda row: (row["team_name"] or "", row["player_name"] or ""))
    return rows


def _draft_impact_rows(
    session: Session,
    league: League,
    *,
    scenario_name: str | None,
    rounds: int,
    user_id: uuid.UUID | None = None,
) -> list[dict[str, Any]]:
    teams = session.exec(
        select(Team).where(Team.league_id == league.id).order_by(Team.draft_slot, Team.name)
    ).all()
    team_count = len(teams)
    if team_count == 0:
        return []

    by_slot = {
        team.draft_slot: team
        for team in teams
        if team.draft_slot is not None and 1 <= team.draft_slot <= team_count
    }
    fallback_teams = sorted(teams, key=lambda team: (team.draft_slot or 99, team.name))
    teams_by_id = {team.id: team for team in teams}
    for index, team in enumerate(fallback_teams, start=1):
        by_slot.setdefault(index, team)

    recommendations = latest_recommendation_batch(
        session,
        league.id,
        user_id=user_id,
        scenario_name=scenario_name,
        recommended_only=True,
    )
    players = _players_by_id(session, {recommendation.player_id for recommendation in recommendations})
    forfeited_by_pick: dict[int, KeeperRecommendation] = {}
    for recommendation in recommendations:
        team = teams_by_id.get(recommendation.team_id)
        if team is None or team.draft_slot is None:
            continue
        forfeited_pick = _team_forfeited_overall_pick(
            keeper_cost_pick=recommendation.keeper_cost_pick,
            keeper_cost_round=recommendation.keeper_cost_round,
            draft_slot=team.draft_slot,
            team_count=team_count,
            draft_type=league.draft_type,
        )
        if forfeited_pick is not None:
            forfeited_by_pick[forfeited_pick] = recommendation

    rows = []
    for round_number in range(1, rounds + 1):
        slots = range(1, team_count + 1)
        if league.draft_type.lower() == "snake" and round_number % 2 == 0:
            slots = range(team_count, 0, -1)

        for pick_in_round, slot in enumerate(slots, start=1):
            overall_pick = (round_number - 1) * team_count + pick_in_round
            recommendation = forfeited_by_pick.get(overall_pick)
            team = by_slot.get(slot)
            player = players.get(recommendation.player_id) if recommendation else None
            rows.append(
                {
                    "round": round_number,
                    "pick_in_round": pick_in_round,
                    "overall_pick": overall_pick,
                    "team_id": str(team.id) if team else None,
                    "team_name": team.name if team else None,
                    "status": "Forfeited" if recommendation else "Open",
                    "keeper_player": player.full_name if player else None,
                    "keeper_position": player.position if player else None,
                    "keeper_score": recommendation.keeper_score if recommendation else None,
                }
            )
    return rows


def _team_forfeited_overall_pick(
    *,
    keeper_cost_pick: float | None,
    keeper_cost_round: float | None,
    draft_slot: int,
    team_count: int,
    draft_type: str,
) -> int | None:
    if team_count <= 0 or draft_slot < 1 or draft_slot > team_count:
        return None

    round_number: int | None = None
    if keeper_cost_round is not None and keeper_cost_round > 0:
        round_number = int(keeper_cost_round)
    elif keeper_cost_pick is not None and keeper_cost_pick > 0:
        round_number = int((keeper_cost_pick - 1) // team_count) + 1

    if round_number is None or round_number <= 0:
        return None

    snake = draft_type.lower() == "snake"
    if snake and round_number % 2 == 0:
        pick_in_round = team_count + 1 - draft_slot
    else:
        pick_in_round = draft_slot

    return (round_number - 1) * team_count + pick_in_round


def _teams_by_id(session: Session, team_ids: set[uuid.UUID]) -> dict[uuid.UUID, Team]:
    if not team_ids:
        return {}
    return {
        team.id: team
        for team in session.exec(select(Team).where(Team.id.in_(team_ids))).all()
    }


def _players_by_id(session: Session, player_ids: set[uuid.UUID]) -> dict[uuid.UUID, Player]:
    if not player_ids:
        return {}
    return {
        player.id: player
        for player in session.exec(select(Player).where(Player.id.in_(player_ids))).all()
    }


def _adp_entry_counts(
    session: Session,
    snapshot_ids: list[uuid.UUID],
) -> dict[uuid.UUID, int]:
    if not snapshot_ids:
        return {}

    counts: dict[uuid.UUID, int] = {snapshot_id: 0 for snapshot_id in snapshot_ids}
    entries = session.exec(select(ADPEntry).where(ADPEntry.snapshot_id.in_(snapshot_ids))).all()
    for entry in entries:
        counts[entry.snapshot_id] = counts.get(entry.snapshot_id, 0) + 1
    return counts


def _format_round_pick(
    round_number: float | int | None,
    pick_in_round: int | None,
    overall_pick: float | int | None,
) -> str | None:
    if round_number is None and overall_pick is None:
        return None

    if round_number is not None and pick_in_round is not None:
        return f"{round_number:g}.{pick_in_round:02d}"

    if round_number is not None and overall_pick is not None:
        return f"R{round_number:g} / Pick {overall_pick:g}"

    return f"Pick {overall_pick:g}" if overall_pick is not None else None


def _acquisition_label(
    *,
    session: Session,
    league: League,
    team_id: uuid.UUID,
    player_id: uuid.UUID,
) -> str:
    pick = session.exec(
        select(DraftPick).where(
            DraftPick.league_id == league.id,
            DraftPick.season_year == league.season_year,
            DraftPick.player_id == player_id,
        )
    ).first()
    if pick is None:
        return "Waivers/FA"
    if pick.team_id == team_id:
        return "Drafted"
    return "Trade"


def _csv_response(rows: list[dict[str, Any]], filename: str) -> Response:
    content = _rows_to_csv_text(rows)
    if not rows:
        content = _rows_to_csv_text([{"message": "No rows"}])

    return Response(
        content=content,
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
            "Pragma": "no-cache",
            "Expires": "0",
        },
    )


def _rows_to_csv_text(rows: list[dict[str, Any]]) -> str:
    output = StringIO()
    fieldnames = list(rows[0].keys()) if rows else ["message"]
    writer = csv.DictWriter(output, fieldnames=fieldnames, extrasaction="ignore")
    writer.writeheader()
    if rows:
        writer.writerows(rows)
    return output.getvalue()


@router.get("/admin/ai/usage")
def get_ai_usage(
    _: User | None = Depends(require_platform_admin),
    session: Session = Depends(get_session),
    settings=Depends(get_settings),
) -> dict[str, Any]:
    return {
        "current_month": monthly_usage_summary(session),
        "recent_logs": recent_logs(session, limit=50),
        "settings": {
            "mock_draft_ai_enabled": settings.mock_draft_ai_enabled,
            "keeper_explanation_ai_enabled": settings.keeper_explanation_ai_enabled,
            "scenario_narrative_ai_enabled": settings.scenario_narrative_ai_enabled,
            "player_summary_ai_enabled": settings.player_summary_ai_enabled,
            "mock_draft_ai_max_ai_round": settings.mock_draft_ai_max_ai_round,
            "ai_monthly_token_budget": settings.ai_monthly_token_budget,
            "mock_draft_ai_model": settings.mock_draft_ai_model,
        },
    }


# ---------------------------------------------------------------------------
# League membership endpoints
# ---------------------------------------------------------------------------

@router.get("/leagues/{league_id}/memberships")
def list_league_memberships(
    league_id: uuid.UUID,
    user: User | None = Depends(require_current_user),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    _require_league(session, league_id)
    assert_league_admin(session, user, league_id)
    memberships = session.exec(
        select(LeagueMembership).where(LeagueMembership.league_id == league_id)
    ).all()
    user_ids = {m.user_id for m in memberships}
    users_map = {
        u.id: u
        for u in session.exec(select(User).where(User.id.in_(user_ids))).all()
    } if user_ids else {}
    rows = [_membership_row(m, users_map.get(m.user_id)) for m in memberships]
    return _table(rows)


@router.post("/leagues/{league_id}/memberships", status_code=status.HTTP_201_CREATED)
def upsert_league_membership(
    league_id: uuid.UUID,
    payload: LeagueMembershipUpsertRequest,
    user: User | None = Depends(require_current_user),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    _require_league(session, league_id)
    assert_league_admin(session, user, league_id)
    target = session.get(User, payload.user_id)
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    existing = session.exec(
        select(LeagueMembership).where(
            LeagueMembership.league_id == league_id,
            LeagueMembership.user_id == payload.user_id,
        )
    ).first()
    if existing is not None:
        # Guard: cannot demote the last league admin.
        if existing.role == "league_admin" and payload.role == "member":
            if _count_league_admins(session, league_id) <= 1:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="League must have at least one admin",
                )
        existing.role = payload.role
        session.add(existing)
        session.commit()
        session.refresh(existing)
        return _membership_row(existing, target)
    membership = LeagueMembership(
        user_id=payload.user_id,
        league_id=league_id,
        role=payload.role,
    )
    session.add(membership)
    session.commit()
    session.refresh(membership)
    return _membership_row(membership, target)


@router.patch("/leagues/{league_id}/memberships/{target_user_id}/role")
def update_league_member_role(
    league_id: uuid.UUID,
    target_user_id: uuid.UUID,
    payload: LeagueMemberRoleRequest,
    user: User | None = Depends(require_current_user),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    _require_league(session, league_id)
    assert_league_admin(session, user, league_id)
    membership = session.exec(
        select(LeagueMembership).where(
            LeagueMembership.league_id == league_id,
            LeagueMembership.user_id == target_user_id,
        )
    ).first()
    if membership is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Membership not found")
    if membership.role == "league_admin" and payload.role == "member":
        if _count_league_admins(session, league_id) <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="League must have at least one admin",
            )
    membership.role = payload.role
    session.add(membership)
    session.commit()
    session.refresh(membership)
    target = session.get(User, target_user_id)
    return _membership_row(membership, target)


@router.delete("/leagues/{league_id}/memberships/{target_user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_league_member(
    league_id: uuid.UUID,
    target_user_id: uuid.UUID,
    user: User | None = Depends(require_current_user),
    session: Session = Depends(get_session),
) -> Response:
    _require_league(session, league_id)
    assert_league_admin(session, user, league_id)
    membership = session.exec(
        select(LeagueMembership).where(
            LeagueMembership.league_id == league_id,
            LeagueMembership.user_id == target_user_id,
        )
    ).first()
    if membership is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Membership not found")
    if membership.role == "league_admin":
        if _count_league_admins(session, league_id) <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="League must have at least one admin",
            )
    session.delete(membership)
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.patch("/leagues/{league_id}/memberships/me/avatar")
def update_league_member_avatar(
    league_id: uuid.UUID,
    payload: LeagueAvatarRequest,
    user: User | None = Depends(require_current_user),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    _require_league(session, league_id)
    membership = session.exec(
        select(LeagueMembership).where(
            LeagueMembership.league_id == league_id,
            LeagueMembership.user_id == user.id,
        )
    ).first()
    # Platform admins may not have a membership row; create one on demand.
    if membership is None:
        if user.role != "platform_admin":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="League membership required")
        membership = LeagueMembership(
            user_id=user.id,
            league_id=league_id,
            role="league_admin",
        )
        session.add(membership)
        session.flush()
    if payload.avatar_data_url is not None:
        if len(payload.avatar_data_url) > 1_500_000:
            raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Avatar image is too large")
        if not payload.avatar_data_url.startswith("data:image/") or ";base64," not in payload.avatar_data_url:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Avatar must be a base64 image data URL")
    membership.avatar_data_url = payload.avatar_data_url
    session.add(membership)
    session.commit()
    session.refresh(membership)
    return _membership_row(membership, user)


@router.get("/leagues/{league_id}/draft-history", response_model=list[TeamDraftHistoryRead])
def get_league_draft_history(
    league_id: uuid.UUID,
    user: User | None = Depends(require_current_user),
    session: Session = Depends(get_session),
) -> list[TeamDraftHistoryRead]:
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    league = _require_league(session, league_id)
    profiles = draft_history_svc.get_league_draft_profiles(
        session, league.id, league.name, league.season_year
    )
    teams = session.exec(select(Team).where(Team.league_id == league_id)).all()
    result: list[TeamDraftHistoryRead] = []
    for team in teams:
        profile = profiles.get(team.id)
        if profile is None:
            continue
        result.append(
            TeamDraftHistoryRead(
                team_id=team.id,
                team_name=team.name,
                owner_name=team.owner_name,
                seasons_found=profile.seasons_found,
                seasons_with_data=profile.seasons_with_data,
                total_picks_analyzed=profile.total_picks_analyzed,
                position_pick_rates=profile.position_pick_rates,
                early_round_positions=profile.early_round_positions,
                mid_round_positions=profile.mid_round_positions,
                late_round_positions=profile.late_round_positions,
                adp_tendency=profile.adp_tendency,
                position_adp_tendencies=profile.position_adp_tendencies,
                keeper_positions=profile.keeper_positions,
                keeper_count_avg=profile.keeper_count_avg,
            )
        )
    return result


@router.get(
    "/leagues/{league_id}/teams/{team_id}/draft-history",
    response_model=TeamDraftHistoryRead,
)
def get_team_draft_history(
    league_id: uuid.UUID,
    team_id: uuid.UUID,
    user: User | None = Depends(require_current_user),
    session: Session = Depends(get_session),
) -> TeamDraftHistoryRead:
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    league = _require_league(session, league_id)
    team = session.get(Team, team_id)
    if team is None or team.league_id != league_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")
    profile = draft_history_svc.get_owner_draft_profile(
        session, league.name, team_id, current_season_year=league.season_year
    )
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No draft history available for this team")
    return TeamDraftHistoryRead(
        team_id=team.id,
        team_name=team.name,
        owner_name=team.owner_name,
        seasons_found=profile.seasons_found,
        seasons_with_data=profile.seasons_with_data,
        total_picks_analyzed=profile.total_picks_analyzed,
        position_pick_rates=profile.position_pick_rates,
        early_round_positions=profile.early_round_positions,
        mid_round_positions=profile.mid_round_positions,
        late_round_positions=profile.late_round_positions,
        adp_tendency=profile.adp_tendency,
        position_adp_tendencies=profile.position_adp_tendencies,
        keeper_positions=profile.keeper_positions,
        keeper_count_avg=profile.keeper_count_avg,
    )


@router.get("/leagues/{league_id}/keeper-signals")
def get_keeper_signals(
    league_id: uuid.UUID,
    user: User | None = Depends(require_current_user),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    """Return keeper signals (probable keeper choices) for every team in the league.

    League admins and platform admins see all teams' player details.
    Regular members see full signal data for every team that has run the
    optimizer — running the optimizer is treated as implicit consent to
    share recommendations as signals.
    """
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    _require_league(session, league_id)
    is_admin = _is_league_admin(session, user, league_id)
    signals = keeper_signals_svc.get_league_keeper_signals(
        session,
        league_id,
        requesting_user_id=_user_id(user),
        is_admin=is_admin,
    )
    return {
        "my_team_id": signals.my_team_id,
        "all_probable_keeper_ids": list(signals.all_probable_keeper_ids),
        "signals": [
            {
                "team_id": sig.team_id,
                "team_name": sig.team_name,
                "owner_name": sig.owner_name,
                "has_run_optimizer": sig.has_run_optimizer,
                "probable_keepers": [
                    {
                        "player_id": sp.player_id,
                        "player_name": sp.player_name,
                        "position": sp.position,
                        "nfl_team": sp.nfl_team,
                        "adp_pick": sp.adp_pick,
                        "adp_round": sp.adp_round,
                        "keeper_score": sp.keeper_score,
                        "confidence": sp.confidence,
                    }
                    for sp in sig.probable_keepers
                ],
            }
            for sig in signals.signals
        ],
    }


@router.post("/leagues/{league_id}/keeper-outcomes/preview")
def preview_keeper_outcomes(
    league_id: uuid.UUID,
    payload: dict,
    user: User = Depends(require_current_user),
    session: Session = Depends(get_session),
) -> dict:
    if not _is_league_admin(session, user, league_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="League admin required")
    csv_text = payload.get("csv_text", "")
    try:
        result = keeper_history_svc.preview_outcomes_csv(session, league_id, csv_text)
    except KeeperHistoryImportError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))
    return result.to_payload()


@router.post("/leagues/{league_id}/keeper-outcomes/import")
def import_keeper_outcomes(
    league_id: uuid.UUID,
    payload: dict,
    user: User = Depends(require_current_user),
    session: Session = Depends(get_session),
) -> dict:
    if not _is_league_admin(session, user, league_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="League admin required")
    csv_text = payload.get("csv_text", "")
    try:
        result = keeper_history_svc.import_outcomes_csv(session, league_id, csv_text)
    except KeeperHistoryImportError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))
    return {
        "imported_count": result.imported,
        "updated_count": result.updated,
        "skipped_count": result.skipped,
        "rows": result.rows,
    }


class SleeperStatsRequest(BaseModel):
    season_year: int | None = None
    scoring_format: str | None = None


@router.post("/leagues/{league_id}/keeper-outcomes/sleeper-preview")
def preview_sleeper_outcomes(
    league_id: uuid.UUID,
    payload: SleeperStatsRequest,
    user: User = Depends(require_current_user),
    session: Session = Depends(get_session),
) -> dict:
    if not _is_league_admin(session, user, league_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="League admin required")
    try:
        result = sleeper_stats_svc.preview_sleeper_season_outcomes(
            session, league_id, payload.season_year, payload.scoring_format
        )
    except SleeperStatsError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))
    return result.to_payload()


@router.post("/leagues/{league_id}/keeper-outcomes/sleeper-import")
def import_sleeper_outcomes(
    league_id: uuid.UUID,
    payload: SleeperStatsRequest,
    user: User = Depends(require_current_user),
    session: Session = Depends(get_session),
) -> dict:
    if not _is_league_admin(session, user, league_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="League admin required")
    try:
        result = sleeper_stats_svc.import_sleeper_season_outcomes(
            session, league_id, payload.season_year, payload.scoring_format
        )
    except SleeperStatsError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))
    return {
        "imported_count": result.imported,
        "updated_count": result.updated,
        "skipped_count": result.skipped,
        "rows": result.rows,
    }


@router.get("/leagues/{league_id}/keeper-history")
def get_keeper_history(
    league_id: uuid.UUID,
    user: User = Depends(require_current_user),
    session: Session = Depends(get_session),
) -> dict:
    _require_league(session, league_id)
    return keeper_history_svc.get_keeper_history(session, league_id)


# ── Final Keeper Selections ───────────────────────────────────────────────────

@router.get("/leagues/{league_id}/final-keepers")
def get_final_keepers(
    league_id: uuid.UUID,
    user: User = Depends(require_current_user),
    session: Session = Depends(get_session),
) -> dict:
    _require_league(session, league_id)
    return final_keepers_svc.get_league_final_keepers(session, league_id)


@router.get("/leagues/{league_id}/final-keepers/prefill")
def get_final_keepers_prefill(
    league_id: uuid.UUID,
    user: User = Depends(require_current_user),
    session: Session = Depends(get_session),
) -> dict:
    if not _is_league_admin(session, user, league_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="League admin required")
    return final_keepers_svc.get_prefill_from_recommendations(session, league_id)


class FinalKeeperSelectionItem(BaseModel):
    player_id: uuid.UUID
    cost_pick: float | None = None
    cost_round: float | None = None


@router.put("/leagues/{league_id}/final-keepers/{team_id}")
def set_team_final_keepers(
    league_id: uuid.UUID,
    team_id: uuid.UUID,
    payload: list[FinalKeeperSelectionItem],
    user: User = Depends(require_current_user),
    session: Session = Depends(get_session),
) -> dict:
    if not _is_league_admin(session, user, league_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="League admin required")
    try:
        selections = [
            KeeperSelectionInput(
                player_id=item.player_id,
                cost_pick=item.cost_pick,
                cost_round=item.cost_round,
            )
            for item in payload
        ]
        keepers = final_keepers_svc.set_team_keepers(session, league_id, team_id, selections)
        session.commit()
    except FinalKeeperError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))
    return {"keepers": keepers}


@router.post("/leagues/{league_id}/final-keepers/finalize")
def finalize_keepers(
    league_id: uuid.UUID,
    user: User = Depends(require_current_user),
    session: Session = Depends(get_session),
) -> dict:
    if not _is_league_admin(session, user, league_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="League admin required")
    try:
        return final_keepers_svc.finalize_league_keepers(session, league_id, user.id)
    except FinalKeeperError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))


@router.post("/leagues/{league_id}/final-keepers/unfinalize")
def unfinalize_keepers(
    league_id: uuid.UUID,
    user: User = Depends(require_current_user),
    session: Session = Depends(get_session),
) -> dict:
    if getattr(user, "role", None) != "platform_admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Platform admin required")
    try:
        final_keepers_svc.unfinalize_league_keepers(session, league_id)
    except FinalKeeperError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))
    return {"is_finalized": False}


@router.get("/leagues/{league_id}/draft-board")
def get_draft_board(
    league_id: uuid.UUID,
    user: User = Depends(require_current_user),
    session: Session = Depends(get_session),
) -> dict:
    _require_league(session, league_id)
    return final_keepers_svc.get_draft_board(session, league_id)


@router.get("/leagues/{league_id}/season-analysis")
def get_season_analysis(
    league_id: uuid.UUID,
    season_year: int | None = None,
    user: User = Depends(require_current_user),
    session: Session = Depends(get_session),
) -> dict:
    _require_league(session, league_id)
    try:
        return season_analysis_svc.get_season_analysis(session, league_id, season_year)
    except SeasonAnalysisError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))


def _is_league_admin(session: Session, user: User | None, league_id: uuid.UUID) -> bool:
    if user is None:
        return False
    if getattr(user, "role", None) == "platform_admin":
        return True
    membership = session.exec(
        select(LeagueMembership).where(
            LeagueMembership.league_id == league_id,
            LeagueMembership.user_id == user.id,
        )
    ).first()
    return membership is not None and membership.role == "league_admin"


def _require_league(session: Session, league_id: uuid.UUID) -> League:
    league = session.get(League, league_id)
    if league is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="League not found")
    return league


def _require_user(session: Session, user_id: uuid.UUID) -> User:
    user = session.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


def _require_recommendation(
    session: Session,
    recommendation_id: uuid.UUID,
    league_id: uuid.UUID,
    user: User | None,
) -> KeeperRecommendation:
    recommendation = session.get(KeeperRecommendation, recommendation_id)
    if recommendation is None or recommendation.league_id != league_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recommendation not found",
        )
    if recommendation.user_id != _user_id(user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )
    return recommendation


def _resolve_optimizer_settings(
    session: Session,
    league_id: uuid.UUID,
    settings_id: uuid.UUID | None,
    *,
    user_id: uuid.UUID | None,
    for_update: bool = False,
) -> OptimizerSettings:
    if settings_id is not None:
        settings = session.get(OptimizerSettings, settings_id)
        if settings is None or settings.league_id != league_id or settings.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Optimizer settings not found",
            )
        return settings

    settings = session.exec(
        select(OptimizerSettings).where(
            OptimizerSettings.league_id == league_id,
            OptimizerSettings.user_id == user_id,
        )
    ).first()
    if settings is not None:
        return settings

    defaults = _active_default_settings(session)
    settings = OptimizerSettings(
        league_id=league_id,
        user_id=user_id,
        **{
            field_name: getattr(defaults, field_name)
            for field_name in _optimizer_settings_copy_fields()
        },
    )
    if for_update:
        session.add(settings)
        session.commit()
        session.refresh(settings)
    return settings


def _optimizer_table(
    session: Session,
    recommendations: list[KeeperRecommendation],
) -> dict[str, Any]:
    team_ids = {recommendation.team_id for recommendation in recommendations}
    player_ids = {recommendation.player_id for recommendation in recommendations}
    teams = {
        team.id: team
        for team in session.exec(select(Team).where(Team.id.in_(team_ids))).all()
    }
    players = {
        player.id: player
        for player in session.exec(select(Player).where(Player.id.in_(player_ids))).all()
    }
    adp_keys = {
        (recommendation.adp_snapshot_id, recommendation.player_id)
        for recommendation in recommendations
        if recommendation.adp_snapshot_id is not None
    }
    adp_entries = (
        {
            (entry.snapshot_id, entry.player_id): entry
            for entry in session.exec(
                select(ADPEntry).where(
                    ADPEntry.snapshot_id.in_({snapshot_id for snapshot_id, _ in adp_keys}),
                    ADPEntry.player_id.in_({player_id for _, player_id in adp_keys}),
                )
            ).all()
        }
        if adp_keys
        else {}
    )
    league_ids = {recommendation.league_id for recommendation in recommendations}
    user_id = recommendations[0].user_id if recommendations else None
    overrides = (
        {
            (override.team_id, override.player_id): override
            for override in session.exec(
                select(ManualOverride).where(
                    ManualOverride.league_id.in_(league_ids),
                    ManualOverride.user_id == user_id,
                )
            ).all()
        }
        if league_ids
        else {}
    )

    input_hashes = {
        recommendation.id: explanation_input_hash(
            league_id=recommendation.league_id,
            user_id=recommendation.user_id,
            player_id=recommendation.player_id,
            scenario_name=recommendation.scenario_name,
            keeper_cost_pick=recommendation.keeper_cost_pick,
            adp_pick=recommendation.adp_pick,
            keeper_score=recommendation.keeper_score,
        )
        for recommendation in recommendations
    }
    hash_to_explanation = (
        {
            exp.input_hash: exp
            for exp in session.exec(
                select(AIExplanation).where(
                    AIExplanation.entity_type == KEEPER_EXPLANATION_ENTITY_TYPE,
                    AIExplanation.input_hash.in_(set(input_hashes.values())),
                )
            ).all()
        }
        if input_hashes
        else {}
    )

    rows = []
    for recommendation in recommendations:
        team = teams.get(recommendation.team_id)
        player = players.get(recommendation.player_id)
        override = overrides.get((recommendation.team_id, recommendation.player_id))
        adp_entry = adp_entries.get((recommendation.adp_snapshot_id, recommendation.player_id))
        rec_hash = input_hashes.get(recommendation.id)
        explanation = hash_to_explanation.get(rec_hash) if rec_hash else None
        rows.append(
            {
                "id": str(recommendation.id),
                "league_id": str(recommendation.league_id),
                "team_id": str(recommendation.team_id),
                "team_name": team.name if team else None,
                "player_id": str(recommendation.player_id),
                "player_name": player.full_name if player else None,
                "position": player.position if player else None,
                "nfl_team": player.nfl_team if player else None,
                "image_url": player.image_url if player else None,
                "settings_id": str(recommendation.settings_id)
                if recommendation.settings_id
                else None,
                "adp_snapshot_id": str(recommendation.adp_snapshot_id)
                if recommendation.adp_snapshot_id
                else None,
                "scenario_name": recommendation.scenario_name,
                "keeper_cost_pick": recommendation.keeper_cost_pick,
                "keeper_cost_round": recommendation.keeper_cost_round,
                "adp_pick": recommendation.adp_pick,
                "adp_round": recommendation.adp_round,
                "adp_source_note": adp_entry.source_note if adp_entry else None,
                "keeper_value": recommendation.keeper_value,
                "keeper_score": recommendation.keeper_score,
                "is_eligible": recommendation.is_eligible,
                "is_recommended": recommendation.is_recommended,
                "manual_override": override.override_type if override else "auto",
                "override_notes": override.notes if override else None,
                "reason": recommendation.reason,
                "ai_explanation": explanation.content if explanation else None,
            }
        )

    rows.sort(
        key=lambda row: (
            row["team_name"] or "",
            not row["is_recommended"],
            -(row["keeper_score"] or 0),
            row["player_name"] or "",
        )
    )
    return _table(rows, selected_count=sum(1 for row in rows if row["is_recommended"]))


def _active_default_settings(session: Session) -> AppDefaultOptimizerSettings:
    settings = session.exec(
        select(AppDefaultOptimizerSettings)
        .where(AppDefaultOptimizerSettings.is_active.is_(True))
        .order_by(AppDefaultOptimizerSettings.created_at.desc())
    ).first()
    if settings is None:
        settings = AppDefaultOptimizerSettings()
        session.add(settings)
        session.commit()
        session.refresh(settings)
    return settings


def _optimizer_settings_copy_fields() -> tuple[str, ...]:
    return (
        "max_keepers",
        "max_keepers_per_position",
        "max_qb_keepers",
        "minimum_keeper_value",
        "max_adp_cap",
        "minimum_keeper_score",
        "qb_weight",
        "rb_weight",
        "wr_weight",
        "te_weight",
        "k_weight",
        "def_weight",
        "qb_max_adp",
        "elite_qb_cutoff",
        "elite_qb_max_negative_edge",
        "talent_anchor",
        "talent_divisor",
        "starter_status_bonus",
        "bench_status_bonus",
        "ir_status_bonus",
        "enable_draft_slot_bonus",
        "enable_qb_scarcity_bonus",
        "enable_elite_player_bonus",
        "elite_player_max_negative_edge",
    )


def _user_id(user: User | None) -> uuid.UUID | None:
    return user.id if user is not None else None


def _scenario_comparison_payload(
    comparisons: list[ScenarioComparison],
    narrative: dict[str, Any] | None = None,
) -> dict[str, Any]:
    team_names = sorted(
        {
            team.team_name
            for comparison in comparisons
            for team in comparison.teams
        }
    )
    scenario_rows = []
    for comparison in comparisons:
        team_rows = []
        for team in comparison.teams:
            team_rows.append(
                {
                    "team_id": str(team.team_id),
                    "team_name": team.team_name,
                    "total_keeper_score": team.total_keeper_score,
                    "picks_forfeited": team.picks_forfeited,
                    "strategic_notes": team.strategic_notes,
                    "selected_keepers": [
                        {
                            "player_id": str(keeper.player_id),
                            "player_name": keeper.player_name,
                            "position": keeper.position,
                            "keeper_cost_pick": keeper.keeper_cost_pick,
                            "keeper_cost_round": keeper.keeper_cost_round,
                            "keeper_value": keeper.keeper_value,
                            "keeper_score": keeper.keeper_score,
                            "reason": keeper.reason,
                        }
                        for keeper in team.selected_keepers
                    ],
                }
            )

        scenario_rows.append(
            {
                "scenario_name": comparison.scenario_name,
                "description": comparison.description,
                "strategic_notes": comparison.strategic_notes,
                "total_keeper_score": comparison.total_keeper_score,
                "teams": team_rows,
            }
        )

    return {
        "count": len(scenario_rows),
        "team_names": team_names,
        "scenario_names": [row["scenario_name"] for row in scenario_rows],
        "scenarios": scenario_rows,
        "narrative": narrative,
    }


def _resolve_user_team_id(
    user: User | None,
    teams: list[Team],
) -> uuid.UUID | None:
    if user is None:
        return None
    for team in teams:
        if team.user_id == user.id:
            return team.id
    return None


def _build_user_team_context(
    scenario_rows: list[dict[str, Any]],
    user_team_id: uuid.UUID | None,
    teams: list[Team],
) -> dict[str, Any] | None:
    if user_team_id is None:
        return None
    team_name = next((t.name for t in teams if t.id == user_team_id), None)
    if team_name is None:
        return None
    user_team_id_str = str(user_team_id)
    scenarios = []
    for row in scenario_rows:
        team_data = next(
            (t for t in row["teams"] if str(t.get("team_id")) == user_team_id_str),
            None,
        )
        if team_data is None:
            continue
        scenarios.append({
            "scenario_name": row["scenario_name"],
            "your_keepers": [
                {
                    "player": k.get("player_name", ""),
                    "position": k.get("position", ""),
                }
                for k in team_data.get("selected_keepers", [])
            ],
            "your_picks_forfeited": team_data.get("picks_forfeited", []),
            "your_strategic_notes": team_data.get("strategic_notes", ""),
        })
    if not scenarios:
        return None

    # Annotate scenarios that share an identical keeper set with another scenario.
    # Keeper scores differ across scenarios because each uses different weights, so
    # score comparisons between identical sets are meaningless — flag this for the AI.
    keeper_sets: dict[str, frozenset[str]] = {
        s["scenario_name"]: frozenset(k["player"] for k in s["your_keepers"])
        for s in scenarios
    }
    for s in scenarios:
        identical = sorted(
            name for name, other in keeper_sets.items()
            if name != s["scenario_name"] and other == keeper_sets[s["scenario_name"]]
        )
        if identical:
            s["identical_keepers_to"] = identical

    return {"team_name": team_name, "scenarios": scenarios}


def _narrative_summaries(
    scenario_rows: list[dict[str, Any]],
    user_team_context: dict[str, Any] | None,
) -> list[dict[str, Any]]:
    if user_team_context is not None:
        return [
            {
                "scenario_name": s["scenario_name"],
                "your_keeper_count": len(s["your_keepers"]),
                "your_keepers": sorted(k["player"] for k in s["your_keepers"]),
                "your_picks_forfeited": sorted(s.get("your_picks_forfeited", [])),
            }
            for s in user_team_context["scenarios"]
        ]
    return [
        {
            "scenario_name": row["scenario_name"],
            "total_keeper_score": round(row["total_keeper_score"], 2),
            "team_count": len(row["teams"]),
            "keeper_count": sum(len(t["selected_keepers"]) for t in row["teams"]),
        }
        for row in scenario_rows
    ]


def _load_scenario_narrative(
    session: Session,
    league_id: uuid.UUID,
    user_id: uuid.UUID | None,
    scenario_rows: list[dict[str, Any]],
    user_team_id: uuid.UUID | None = None,
    teams: list[Team] | None = None,
) -> dict[str, Any] | None:
    if not scenario_rows:
        return None
    user_team_context = _build_user_team_context(scenario_rows, user_team_id, teams or [])
    summaries = _narrative_summaries(scenario_rows, user_team_context)
    rec_hash = narrative_input_hash(
        league_id=league_id,
        user_id=user_id,
        scenario_summaries=summaries,
    )
    existing = session.exec(
        select(AIExplanation).where(
            AIExplanation.entity_type == SCENARIO_NARRATIVE_ENTITY_TYPE,
            AIExplanation.input_hash == rec_hash,
        )
    ).first()
    return existing.content if existing else None


def _table(rows: list[dict[str, Any]], **extra: Any) -> dict[str, Any]:
    columns = list(rows[0].keys()) if rows else []
    return {
        "count": len(rows),
        "columns": columns,
        "rows": rows,
        **extra,
    }


# ---------------------------------------------------------------------------
# Commissioner Tools (3.2)
# ---------------------------------------------------------------------------

class KeeperReminderRequest(BaseModel):
    dry_run: bool = False


@router.get("/leagues/{league_id}/commissioner/compliance")
def get_compliance_report(
    league_id: uuid.UUID,
    scenario_name: str | None = Query(default=None),
    user: User | None = Depends(require_current_user),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    assert_league_admin(session, user, league_id)
    try:
        result = compliance_svc.check_league_compliance(
            session,
            league_id,
            scenario_name=scenario_name,
            user_id=user.id if user else None,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    return _compliance_result_to_dict(result)


@router.post("/leagues/{league_id}/commissioner/reminders/send")
def send_keeper_reminders(
    league_id: uuid.UUID,
    payload: KeeperReminderRequest,
    user: User | None = Depends(require_current_user),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    assert_league_admin(session, user, league_id)
    try:
        recipients = notifications_svc.send_keeper_deadline_reminders(
            session,
            league_id,
            dry_run=payload.dry_run,
        )
    except NotificationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    return {
        "sent": len(recipients),
        "recipients": recipients,
        "dry_run": payload.dry_run,
    }


@router.get("/leagues/{league_id}/commissioner/reminders/smtp-status")
def get_smtp_status(
    league_id: uuid.UUID,
    user: User | None = Depends(require_current_user),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    assert_league_admin(session, user, league_id)
    return notifications_svc.smtp_status()


@router.get("/leagues/{league_id}/reveal")
def get_keeper_reveal(
    league_id: uuid.UUID,
    user: User | None = Depends(require_current_user),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    """Public reveal endpoint: before reveal_date only shows requesting user's team;
    on/after reveal_date shows all teams' finalized keepers."""
    league = session.get(League, league_id)
    if league is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="League not found")

    from app.models.final_keeper import FinalKeeperSelection
    from datetime import date as _date

    today = _date.today()
    reveal_date = league.keeper_reveal_date
    revealed = reveal_date is not None and today >= reveal_date

    teams = session.exec(select(Team).where(Team.league_id == league_id)).all()
    team_by_id = {t.id: t for t in teams}

    selections = session.exec(
        select(FinalKeeperSelection).where(FinalKeeperSelection.league_id == league_id)
    ).all()
    player_ids = {s.player_id for s in selections}
    players: dict[uuid.UUID, Player] = {}
    if player_ids:
        players = {
            p.id: p
            for p in session.exec(select(Player).where(Player.id.in_(player_ids))).all()
        }

    my_team_id: uuid.UUID | None = None
    if user:
        my_team = next((t for t in teams if t.user_id == user.id), None)
        my_team_id = my_team.id if my_team else None

    team_rows: list[dict[str, Any]] = []
    for team in sorted(teams, key=lambda t: (t.draft_slot or 99, t.name)):
        is_mine = team.id == my_team_id
        if not revealed and not is_mine:
            team_rows.append(
                {
                    "team_id": str(team.id),
                    "team_name": team.name,
                    "owner_name": team.owner_name,
                    "draft_slot": team.draft_slot,
                    "hidden": True,
                    "keepers": [],
                }
            )
            continue

        team_selections = [s for s in selections if s.team_id == team.id]
        keeper_rows = []
        for sel in team_selections:
            player = players.get(sel.player_id)
            keeper_rows.append(
                {
                    "player_id": str(sel.player_id),
                    "player_name": player.full_name if player else str(sel.player_id),
                    "position": player.position if player else None,
                    "nfl_team": player.nfl_team if player else None,
                    "keeper_cost_round": sel.cost_round,
                }
            )

        team_rows.append(
            {
                "team_id": str(team.id),
                "team_name": team.name,
                "owner_name": team.owner_name,
                "draft_slot": team.draft_slot,
                "hidden": False,
                "keepers": keeper_rows,
            }
        )

    return {
        "league_id": str(league_id),
        "league_name": league.name,
        "season_year": league.season_year,
        "reveal_date": reveal_date.isoformat() if reveal_date else None,
        "revealed": revealed,
        "keepers_finalized": league.keepers_finalized,
        "teams": team_rows,
    }


@router.get("/leagues/{league_id}/exports/bulk")
def download_bulk_export(
    league_id: uuid.UUID,
    scenario_name: str | None = Query(default=None),
    user: User | None = Depends(require_current_user),
    session: Session = Depends(get_session),
) -> Response:
    assert_league_admin(session, user, league_id)
    league = session.get(League, league_id)
    if league is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="League not found")
    try:
        zip_bytes = build_bulk_pdf_zip(
            session,
            league_id,
            scenario_name=scenario_name,
            user_id=user.id if user else None,
        )
    except BulkExportError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    filename = f"{league.name.replace(' ', '_')}_{league.season_year}_keeper_reports.zip"
    return Response(
        content=zip_bytes,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ---------------------------------------------------------------------------
# News Impact (4.1)
# ---------------------------------------------------------------------------


@router.get("/leagues/{league_id}/news-impact")
def get_news_impact(
    league_id: uuid.UUID,
    scenario_name: str | None = Query(default=None),
    user: User | None = Depends(require_current_user),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    assert_league_admin(session, user, league_id)
    alerts = news_impact_svc.get_news_alerts(
        session,
        league_id,
        scenario_name=scenario_name,
        user_id=user.id if user else None,
    )
    return {
        "alerts": [_alert_to_dict(a) for a in alerts],
        "total": len(alerts),
    }


def _alert_to_dict(alert: NewsAlert) -> dict[str, Any]:
    return {
        "player_id": alert.player_id,
        "player_name": alert.player_name,
        "position": alert.position,
        "nfl_team": alert.nfl_team,
        "team_name": alert.team_name,
        "is_recommended": alert.is_recommended,
        "current_keeper_value": alert.current_keeper_value,
        "current_adp_round": alert.current_adp_round,
        "keeper_cost_round": alert.keeper_cost_round,
        "flip_adp_round": alert.flip_adp_round,
        "headline": alert.headline,
        "headline_link": alert.headline_link,
        "published_at": alert.published_at,
    }


def _compliance_result_to_dict(result: LeagueComplianceResult) -> dict[str, Any]:
    return {
        "league_id": result.league_id,
        "league_name": result.league_name,
        "all_pass": result.all_pass,
        "teams": [
            {
                "team_id": t.team_id,
                "team_name": t.team_name,
                "draft_slot": t.draft_slot,
                "passes": t.passes,
                "max_keepers_pass": t.max_keepers_pass,
                "max_per_position_pass": t.max_per_position_pass,
                "max_qb_pass": t.max_qb_pass,
                "cost_validity_pass": t.cost_validity_pass,
                "keeper_count": t.keeper_count,
                "max_keepers_allowed": t.max_keepers_allowed,
                "qb_count": t.qb_count,
                "max_qb_allowed": t.max_qb_allowed,
                "position_counts": t.position_counts,
                "max_per_position_allowed": t.max_per_position_allowed,
                "invalid_cost_players": t.invalid_cost_players,
            }
            for t in result.teams
        ],
    }


# ---------------------------------------------------------------------------
# Value Window Projection (4.2)
# ---------------------------------------------------------------------------


@router.get("/leagues/{league_id}/optimizer/results/{recommendation_id}/value-window")
def get_value_window(
    league_id: uuid.UUID,
    recommendation_id: uuid.UUID,
    user: User | None = Depends(require_current_user),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    result = value_window_svc.get_value_window(
        session,
        league_id,
        recommendation_id,
    )
    if result is None:
        raise HTTPException(status_code=404, detail="Recommendation not found or missing ADP data")
    return value_window_svc.value_window_to_dict(result)
