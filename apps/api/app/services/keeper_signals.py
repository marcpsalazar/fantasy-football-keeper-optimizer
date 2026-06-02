"""Opponent keeper signal service.

Derives probable keeper choices for every team in a league from the most
recent KeeperRecommendation rows — no separate table required.

A "signal" is not a commitment.  It represents which players the optimizer
currently recommends for a team and is used to help a user understand which
players their opponents are likely to keep before the draft.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Any

from sqlmodel import Session, select

from app.models import KeeperRecommendation, Player, Team


@dataclass(frozen=True)
class KeeperSignalPlayer:
    player_id: str
    player_name: str
    position: str
    nfl_team: str | None
    adp_pick: float | None
    adp_round: float | None
    keeper_score: float | None
    # 0.0–1.0 normalised within the team's recommended set
    confidence: float


@dataclass(frozen=True)
class TeamKeeperSignal:
    team_id: str
    team_name: str
    owner_name: str | None
    has_run_optimizer: bool
    probable_keepers: list[KeeperSignalPlayer]


@dataclass(frozen=True)
class LeagueKeeperSignals:
    my_team_id: str | None
    signals: list[TeamKeeperSignal]
    # player_ids that are probably kept by *any* team — used for ADP impact
    all_probable_keeper_ids: set[str]


def get_league_keeper_signals(
    session: Session,
    league_id: uuid.UUID,
    *,
    requesting_user_id: uuid.UUID | None = None,
    is_admin: bool = False,
) -> LeagueKeeperSignals:
    """Return keeper signals for every team in the league.

    Privacy:
    - League admins see all teams' player details.
    - Regular members see player names for every team whose signal exists
      (running the optimizer is implicit consent to sharing recommendations
      as signals).  This is the simplest model that matches the plan intent.
    """
    teams = session.exec(select(Team).where(Team.league_id == league_id)).all()
    if not teams:
        return LeagueKeeperSignals(my_team_id=None, signals=[], all_probable_keeper_ids=set())

    my_team = _find_my_team(teams, requesting_user_id)
    my_team_id = str(my_team.id) if my_team else None

    # Fetch the latest recommended keepers per team (Default scenario first, any scenario fallback)
    recs_by_team = _latest_recommendations_by_team(session, league_id, teams)

    # Player details lookup
    all_player_ids = {
        rec.player_id
        for recs in recs_by_team.values()
        for rec in recs
    }
    players: dict[uuid.UUID, Player] = {}
    if all_player_ids:
        players = {
            p.id: p
            for p in session.exec(select(Player).where(Player.id.in_(all_player_ids))).all()
        }

    signals: list[TeamKeeperSignal] = []
    all_probable_ids: set[str] = set()

    for team in sorted(teams, key=lambda t: (t.draft_slot or 999, t.name)):
        recs = recs_by_team.get(team.id, [])
        has_run = len(recs) > 0
        probable = _build_signal_players(recs, players)
        for sp in probable:
            all_probable_ids.add(sp.player_id)
        signals.append(TeamKeeperSignal(
            team_id=str(team.id),
            team_name=team.name,
            owner_name=team.owner_name,
            has_run_optimizer=has_run,
            probable_keepers=probable,
        ))

    return LeagueKeeperSignals(
        my_team_id=my_team_id,
        signals=signals,
        all_probable_keeper_ids=all_probable_ids,
    )


def get_opponent_probable_keeper_ids(
    session: Session,
    league_id: uuid.UUID,
    my_team_id: uuid.UUID,
) -> set[uuid.UUID]:
    """Return player UUIDs likely to be kept by teams other than my_team_id.

    Used by the mock draft strategy plan to adjust available-player projections.
    """
    teams = session.exec(select(Team).where(Team.league_id == league_id)).all()
    opponent_team_ids = {t.id for t in teams if t.id != my_team_id}
    if not opponent_team_ids:
        return set()

    recs = session.exec(
        select(KeeperRecommendation).where(
            KeeperRecommendation.league_id == league_id,
            KeeperRecommendation.team_id.in_(opponent_team_ids),  # type: ignore[attr-defined]
            KeeperRecommendation.is_recommended == True,  # noqa: E712
        )
    ).all()

    # Deduplicate: if a player appears recommended for multiple teams, keep them once
    return {rec.player_id for rec in recs}


def signals_to_strategy_context(
    session: Session,
    league_id: uuid.UUID,
    my_team_id: uuid.UUID,
) -> list[dict[str, Any]]:
    """Return a compact list of opponent probable keepers for the strategy plan context."""
    teams = session.exec(select(Team).where(Team.league_id == league_id)).all()
    team_name_by_id = {t.id: t.name for t in teams}
    opponent_ids = {t.id for t in teams if t.id != my_team_id}

    recs = session.exec(
        select(KeeperRecommendation).where(
            KeeperRecommendation.league_id == league_id,
            KeeperRecommendation.team_id.in_(opponent_ids),  # type: ignore[attr-defined]
            KeeperRecommendation.is_recommended == True,  # noqa: E712
        )
    ).all()

    if not recs:
        return []

    player_ids = {rec.player_id for rec in recs}
    players = {
        p.id: p
        for p in session.exec(select(Player).where(Player.id.in_(player_ids))).all()
    }

    result: list[dict[str, Any]] = []
    for rec in sorted(recs, key=lambda r: -(r.keeper_score or 0)):
        player = players.get(rec.player_id)
        result.append({
            "team_name": team_name_by_id.get(rec.team_id, "Unknown"),
            "player_name": player.full_name if player else str(rec.player_id),
            "position": player.position if player else "?",
            "adp_pick": rec.adp_pick,
            "adp_round": rec.adp_round,
            "keeper_cost_round": rec.keeper_cost_round,
        })
    return result


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _find_my_team(teams: list[Team], user_id: uuid.UUID | None) -> Team | None:
    if user_id is None:
        return None
    return next((t for t in teams if t.user_id == user_id), None)


def _latest_recommendations_by_team(
    session: Session,
    league_id: uuid.UUID,
    teams: list[Team],
) -> dict[uuid.UUID, list[KeeperRecommendation]]:
    """Return the most recent recommended keepers per team.

    Prefer the Default scenario; fall back to whatever scenario was last run.
    """
    all_recs = session.exec(
        select(KeeperRecommendation).where(
            KeeperRecommendation.league_id == league_id,
            KeeperRecommendation.is_recommended == True,  # noqa: E712
        )
    ).all()

    # Group by (team_id, scenario_name) and track max updated_at per group
    by_team_scenario: dict[tuple[uuid.UUID, str], list[KeeperRecommendation]] = {}
    latest_at: dict[tuple[uuid.UUID, str], object] = {}

    for rec in all_recs:
        key = (rec.team_id, rec.scenario_name)
        if key not in by_team_scenario:
            by_team_scenario[key] = []
            latest_at[key] = rec.updated_at
        by_team_scenario[key].append(rec)
        if rec.updated_at > latest_at[key]:  # type: ignore[operator]
            latest_at[key] = rec.updated_at

    # For each team, pick Default if it exists, otherwise the most recently updated scenario
    result: dict[uuid.UUID, list[KeeperRecommendation]] = {}
    for team in teams:
        default_key = (team.id, "Default")
        if default_key in by_team_scenario:
            result[team.id] = by_team_scenario[default_key]
            continue
        # Pick the scenario updated most recently for this team
        team_keys = [k for k in by_team_scenario if k[0] == team.id]
        if team_keys:
            best = max(team_keys, key=lambda k: latest_at[k])  # type: ignore[arg-type]
            result[team.id] = by_team_scenario[best]
    return result


def _build_signal_players(
    recs: list[KeeperRecommendation],
    players: dict[uuid.UUID, Player],
) -> list[KeeperSignalPlayer]:
    if not recs:
        return []

    # Normalise confidence within this team's set based on keeper_score
    scores = [rec.keeper_score or 0.0 for rec in recs]
    score_max = max(scores) if scores else 1.0
    score_min = min(scores) if scores else 0.0
    score_range = score_max - score_min or 1.0

    result: list[KeeperSignalPlayer] = []
    for rec in sorted(recs, key=lambda r: -(r.keeper_score or 0)):
        player = players.get(rec.player_id)
        normalised = (((rec.keeper_score or 0) - score_min) / score_range) * 0.4 + 0.6
        result.append(KeeperSignalPlayer(
            player_id=str(rec.player_id),
            player_name=player.full_name if player else str(rec.player_id),
            position=player.position if player else "?",
            nfl_team=player.nfl_team if player else None,
            adp_pick=rec.adp_pick,
            adp_round=rec.adp_round,
            keeper_score=rec.keeper_score,
            confidence=round(min(1.0, normalised), 3),
        ))
    return result
