from __future__ import annotations

import csv
from datetime import date
from io import StringIO
from typing import Any, Literal
import uuid

from fastapi import APIRouter, Body, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel
from sqlmodel import Session, select

from app.db.session import get_session
from app.models import (
    ADPEntry,
    ADPSnapshot,
    DraftPick,
    FinalRosterEntry,
    KeeperRecommendation,
    League,
    ManualOverride,
    OptimizerSettings,
    Player,
    Team,
)
from app.schemas.league import LeagueCreate, LeagueRead, LeagueUpdate, TeamRead, TeamUpdate
from app.schemas.optimizer import OptimizerSettingsRead, OptimizerSettingsUpdate
from app.services.csv_imports import (
    CSVImportError,
    import_adp_csv,
    import_draft_results_csv,
    import_final_rosters_csv,
)
from app.services.csv_preview import (
    CSVPreviewError,
    preview_adp_csv,
    preview_draft_results_csv,
    preview_final_rosters_csv,
)
from app.services.excel_export import ExcelExportError, build_keeper_recommendations_workbook
from app.services.optimizer import (
    OptimizerInputError,
    ScenarioComparison,
    run_optimizer,
    run_scenario_comparison,
)
from app.services.pdf_export import PDFExportError, build_team_outlooks_pdf

router = APIRouter(prefix="/api", tags=["leagues"])


class TeamCreateRequest(BaseModel):
    name: str
    owner_name: str | None = None
    draft_slot: int | None = None


class ADPSnapshotCreateRequest(BaseModel):
    season_year: int | None = None
    name: str
    source: str
    format_type: str = "superflex"
    snapshot_date: date
    notes: str | None = None


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


@router.post("/leagues", response_model=LeagueRead, status_code=status.HTTP_201_CREATED)
def create_league(payload: LeagueCreate, session: Session = Depends(get_session)) -> League:
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
    session: Session = Depends(get_session),
) -> Team:
    _require_league(session, league_id)
    team = Team(league_id=league_id, **payload.model_dump())
    session.add(team)
    session.commit()
    session.refresh(team)
    return team


@router.get("/leagues/{league_id}/teams")
def list_teams(league_id: uuid.UUID, session: Session = Depends(get_session)) -> dict[str, Any]:
    _require_league(session, league_id)
    teams = session.exec(select(Team).where(Team.league_id == league_id).order_by(Team.name)).all()
    rows = [TeamRead.model_validate(team).model_dump(mode="json") for team in teams]
    return _table(rows)


@router.patch("/teams/{team_id}", response_model=TeamRead)
def update_team(
    team_id: uuid.UUID,
    payload: TeamUpdate,
    session: Session = Depends(get_session),
) -> Team:
    team = session.get(Team, team_id)
    if team is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")

    update_data = payload.model_dump(exclude_unset=True)
    update_data.pop("league_id", None)
    for field_name, value in update_data.items():
        setattr(team, field_name, value)

    session.add(team)
    session.commit()
    session.refresh(team)
    return team


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
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    try:
        result = import_adp_csv(session, league_id, csv_text)
    except CSVImportError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return _table(result.rows, imported=result.imported)


@router.post("/leagues/{league_id}/adp/preview")
@router.post("/leagues/{league_id}/adp-snapshots/preview")
def preview_adp(
    league_id: uuid.UUID,
    csv_text: str = Body(..., media_type="text/csv"),
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


@router.get("/leagues/{league_id}/manual-overrides")
def list_manual_overrides(
    league_id: uuid.UUID,
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    _require_league(session, league_id)
    overrides = session.exec(
        select(ManualOverride).where(ManualOverride.league_id == league_id)
    ).all()
    return _table(_manual_override_rows(session, overrides))


@router.put("/leagues/{league_id}/manual-overrides")
def upsert_manual_override(
    league_id: uuid.UUID,
    payload: ManualOverrideRequest,
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
    session: Session = Depends(get_session),
) -> OptimizerSettings:
    _require_league(session, league_id)
    settings = _resolve_optimizer_settings(session, league_id, settings_id)
    if session.get(OptimizerSettings, settings.id) is None:
        session.add(settings)
        session.commit()
        session.refresh(settings)
    return settings


@router.patch("/leagues/{league_id}/optimizer/settings", response_model=OptimizerSettingsRead)
def update_optimizer_settings(
    league_id: uuid.UUID,
    payload: OptimizerSettingsUpdate,
    settings_id: uuid.UUID | None = Query(default=None),
    session: Session = Depends(get_session),
) -> OptimizerSettings:
    _require_league(session, league_id)
    settings = _resolve_optimizer_settings(session, league_id, settings_id)
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
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    payload = payload or OptimizerRunRequest()
    try:
        recommendations = run_optimizer(
            session,
            league_id,
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
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    payload = payload or ScenarioComparisonRequest()
    try:
        comparisons = run_scenario_comparison(
            session,
            league_id,
            adp_snapshot_id=payload.adp_snapshot_id,
            scenario_names=payload.scenario_names,
            persist=payload.persist,
        )
    except OptimizerInputError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return _scenario_comparison_payload(comparisons)


@router.get("/leagues/{league_id}/draft-impact")
def read_draft_impact(
    league_id: uuid.UUID,
    scenario_name: str | None = Query(default=None),
    rounds: int = Query(default=10, ge=1, le=30),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    league = _require_league(session, league_id)
    rows = _draft_impact_rows(session, league, scenario_name=scenario_name, rounds=rounds)
    return _table(rows, forfeited_count=sum(1 for row in rows if row["status"] == "Forfeited"))


@router.get("/leagues/{league_id}/optimizer/results")
def read_optimizer_results(
    league_id: uuid.UUID,
    settings_id: uuid.UUID | None = Query(default=None),
    adp_snapshot_id: uuid.UUID | None = Query(default=None),
    scenario_name: str | None = Query(default=None),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    _require_league(session, league_id)
    statement = select(KeeperRecommendation).where(KeeperRecommendation.league_id == league_id)
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
    session: Session = Depends(get_session),
) -> Response:
    _require_league(session, league_id)
    statement = select(KeeperRecommendation).where(
        KeeperRecommendation.league_id == league_id,
        KeeperRecommendation.is_recommended.is_(True),
    )
    if scenario_name is not None:
        statement = statement.where(KeeperRecommendation.scenario_name == scenario_name)

    payload = _optimizer_table(session, session.exec(statement).all())
    return _csv_response(
        rows=payload["rows"],
        filename=f"keeper-recommendations-{league_id}.csv",
    )


@router.get("/leagues/{league_id}/exports/team-outlooks.pdf")
def export_team_outlooks_pdf(
    league_id: uuid.UUID,
    team_id: uuid.UUID | None = Query(default=None),
    scenario_name: str | None = Query(default=None),
    session: Session = Depends(get_session),
) -> Response:
    try:
        content = build_team_outlooks_pdf(
            session,
            league_id,
            team_id=team_id,
            scenario_name=scenario_name,
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
    session: Session = Depends(get_session),
) -> Response:
    try:
        content = build_keeper_recommendations_workbook(
            session,
            league_id,
            scenario_name=scenario_name,
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

    statement = select(KeeperRecommendation).where(
        KeeperRecommendation.league_id == league.id,
        KeeperRecommendation.is_recommended.is_(True),
    )
    if scenario_name is not None:
        statement = statement.where(KeeperRecommendation.scenario_name == scenario_name)
    recommendations = session.exec(statement).all()
    players = _players_by_id(session, {recommendation.player_id for recommendation in recommendations})
    forfeited_by_pick = {
        int(recommendation.keeper_cost_pick): recommendation
        for recommendation in recommendations
        if recommendation.keeper_cost_pick is not None
        and recommendation.keeper_cost_pick == int(recommendation.keeper_cost_pick)
    }

    rows = []
    for round_number in range(1, rounds + 1):
        slots = range(1, team_count + 1)
        if league.draft_type.lower() == "snake" and round_number % 2 == 0:
            slots = range(team_count, 0, -1)

        for pick_in_round, slot in enumerate(slots, start=1):
            overall_pick = (round_number - 1) * team_count + pick_in_round
            recommendation = forfeited_by_pick.get(overall_pick)
            team = (
                teams_by_id.get(recommendation.team_id)
                if recommendation is not None
                else by_slot.get(slot)
            )
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
    output = StringIO()
    fieldnames = list(rows[0].keys()) if rows else ["message"]
    writer = csv.DictWriter(output, fieldnames=fieldnames, extrasaction="ignore")
    writer.writeheader()
    if rows:
        writer.writerows(rows)
    else:
        writer.writerow({"message": "No rows"})

    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _require_league(session: Session, league_id: uuid.UUID) -> League:
    league = session.get(League, league_id)
    if league is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="League not found")
    return league


def _resolve_optimizer_settings(
    session: Session,
    league_id: uuid.UUID,
    settings_id: uuid.UUID | None,
) -> OptimizerSettings:
    if settings_id is not None:
        settings = session.get(OptimizerSettings, settings_id)
        if settings is None or settings.league_id != league_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Optimizer settings not found",
            )
        return settings

    settings = session.exec(
        select(OptimizerSettings).where(OptimizerSettings.league_id == league_id)
    ).first()
    if settings is not None:
        return settings

    return OptimizerSettings(league_id=league_id)


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
    league_ids = {recommendation.league_id for recommendation in recommendations}
    overrides = (
        {
            (override.team_id, override.player_id): override
            for override in session.exec(
                select(ManualOverride).where(ManualOverride.league_id.in_(league_ids))
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
