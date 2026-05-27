from __future__ import annotations

import csv
from datetime import UTC, date, datetime
from io import StringIO
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
    AppDefaultOptimizerSettings,
    DraftPick,
    FinalRosterEntry,
    KeeperCandidate,
    KeeperRecommendation,
    League,
    ManualOverride,
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
from app.services.auth import require_admin, require_current_user

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


@router.post("/leagues", response_model=LeagueRead, status_code=status.HTTP_201_CREATED)
def create_league(
    payload: LeagueCreate,
    _: User | None = Depends(require_admin),
    session: Session = Depends(get_session),
) -> League:
    league = League(**payload.model_dump())
    session.add(league)
    session.commit()
    session.refresh(league)
    return league


@router.get("/leagues")
def list_leagues(session: Session = Depends(get_session)) -> dict[str, Any]:
    leagues = session.exec(select(League).order_by(League.season_year.desc(), League.name)).all()
    rows = [LeagueRead.model_validate(league).model_dump(mode="json") for league in leagues]
    return _table(rows)


@router.get("/leagues/{league_id}", response_model=LeagueRead)
def read_league(league_id: uuid.UUID, session: Session = Depends(get_session)) -> League:
    return _require_league(session, league_id)


@router.patch("/leagues/{league_id}", response_model=LeagueRead)
def update_league(
    league_id: uuid.UUID,
    payload: LeagueUpdate,
    _: User | None = Depends(require_admin),
    session: Session = Depends(get_session),
) -> League:
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
    _: User | None = Depends(require_admin),
    session: Session = Depends(get_session),
) -> Team:
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
    _: User | None = Depends(require_admin),
    session: Session = Depends(get_session),
) -> Team:
    team = session.get(Team, team_id)
    if team is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")

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
    _: User | None = Depends(require_admin),
    session: Session = Depends(get_session),
) -> Response:
    team = session.get(Team, team_id)
    if team is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")

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
    _: User | None = Depends(require_admin),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    try:
        return preview_draft_results_csv(session, league_id, csv_text).to_payload()
    except CSVPreviewError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/leagues/{league_id}/draft-results/import")
def import_draft_results(
    league_id: uuid.UUID,
    csv_text: str = Body(..., media_type="text/csv"),
    _: User | None = Depends(require_admin),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
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
    _: User | None = Depends(require_admin),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    try:
        return preview_final_rosters_csv(session, league_id, csv_text).to_payload()
    except CSVPreviewError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/leagues/{league_id}/final-rosters/import")
def import_final_rosters(
    league_id: uuid.UUID,
    csv_text: str = Body(..., media_type="text/csv"),
    _: User | None = Depends(require_admin),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    try:
        result = import_final_rosters_csv(session, league_id, csv_text)
    except CSVImportError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return _table(result.rows, imported=result.imported)


@router.post(
    "/leagues/{league_id}/adp-snapshots",
    status_code=status.HTTP_201_CREATED,
)
def create_adp_snapshot(
    league_id: uuid.UUID,
    payload: ADPSnapshotCreateRequest,
    _: User | None = Depends(require_admin),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
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
    _: User | None = Depends(require_admin),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    try:
        result = import_adp_csv(session, league_id, csv_text)
    except CSVImportError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return _table(result.rows, imported=result.imported)


@router.post("/leagues/{league_id}/adp/refresh")
def refresh_adp(
    league_id: uuid.UUID,
    _: User | None = Depends(require_admin),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    _require_league(session, league_id)
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
    _: User | None = Depends(require_admin),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    league = _require_league(session, league_id)
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
    admin: User | None = Depends(require_admin),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    candidate = _require_adp_refresh_candidate(session, candidate_id)
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
    candidate.approved_by_user_id = admin.id if admin else None
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
    _: User | None = Depends(require_admin),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    candidate = _require_adp_refresh_candidate(session, candidate_id)
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
    _: User | None = Depends(require_admin),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    league = _require_league(session, league_id)
    try:
        composite = build_composite_adp_template_rows(session, league, get_settings())
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
    _: User | None = Depends(require_admin),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    league = _require_league(session, league_id)
    try:
        composite = build_composite_adp_template_rows(session, league, get_settings())
    except CompositeADPError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return composite.coverage


@router.post("/leagues/{league_id}/adp/preview")
@router.post("/leagues/{league_id}/adp-snapshots/preview")
def preview_adp(
    league_id: uuid.UUID,
    csv_text: str = Body(..., media_type="text/csv"),
    _: User | None = Depends(require_admin),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    try:
        return preview_adp_csv(session, league_id, csv_text).to_payload()
    except CSVPreviewError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


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

    return _scenario_comparison_payload(comparisons)


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
    session: Session = Depends(get_session),
) -> Response:
    league = _require_league(session, league_id)
    try:
        result = build_composite_adp_template_rows(session, league, get_settings())
    except CompositeADPError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return _csv_response(
        rows=result.rows,
        filename=f"adp-template-{league_id}-{datetime.now().strftime('%Y%m%d-%H%M%S')}.csv",
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

    rows = []
    for recommendation in recommendations:
        team = teams.get(recommendation.team_id)
        player = players.get(recommendation.player_id)
        override = overrides.get((recommendation.team_id, recommendation.player_id))
        adp_entry = adp_entries.get((recommendation.adp_snapshot_id, recommendation.player_id))
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


def _scenario_comparison_payload(comparisons: list[ScenarioComparison]) -> dict[str, Any]:
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
    }


def _table(rows: list[dict[str, Any]], **extra: Any) -> dict[str, Any]:
    columns = list(rows[0].keys()) if rows else []
    return {
        "count": len(rows),
        "columns": columns,
        "rows": rows,
        **extra,
    }
