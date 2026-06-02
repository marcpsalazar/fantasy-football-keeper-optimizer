"""Final Keeper Selections service.

Manages the process of an admin finalizing which players each team is keeping
before the draft. Once finalized, selections are visible to all league members.

Selections are pre-populated from KeeperRecommendation (Default scenario) as a
starting point. Admins can add, remove, or adjust before locking.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any
import uuid

from sqlmodel import Session, select

from app.models import FinalKeeperSelection, KeeperRecommendation, Player, Team
from app.models.league import League


class FinalKeeperError(ValueError):
    pass


# ---------------------------------------------------------------------------
# Read
# ---------------------------------------------------------------------------

def get_league_final_keepers(session: Session, league_id: uuid.UUID) -> dict[str, Any]:
    league = _require_league(session, league_id)
    teams = session.exec(
        select(Team).where(Team.league_id == league_id)
    ).all()
    selections = session.exec(
        select(FinalKeeperSelection).where(
            FinalKeeperSelection.league_id == league_id,
            FinalKeeperSelection.season_year == league.season_year,
        )
    ).all()

    player_ids = {s.player_id for s in selections}
    players = {p.id: p for p in session.exec(
        select(Player).where(Player.id.in_(player_ids))
    ).all()} if player_ids else {}

    by_team: dict[uuid.UUID, list[FinalKeeperSelection]] = {t.id: [] for t in teams}
    for sel in selections:
        if sel.team_id in by_team:
            by_team[sel.team_id].append(sel)

    team_rows = []
    all_forfeited: list[dict[str, Any]] = []
    for team in sorted(teams, key=lambda t: (t.draft_slot or 999, t.name)):
        team_selections = by_team[team.id]
        keepers = [_selection_row(s, players) for s in team_selections]
        forfeited = _forfeited_picks(team_selections)
        all_forfeited.extend(forfeited)
        team_rows.append({
            "team_id": str(team.id),
            "team_name": team.name,
            "owner_name": team.owner_name,
            "draft_slot": team.draft_slot,
            "keepers": keepers,
            "forfeited_picks": forfeited,
        })

    return {
        "season_year": league.season_year,
        "is_finalized": league.keepers_finalized,
        "finalized_at": league.keepers_finalized_at.isoformat() if league.keepers_finalized_at else None,
        "teams": team_rows,
        "all_forfeited_picks": sorted(all_forfeited, key=lambda p: (p["round"], p["pick"])),
    }


def get_prefill_from_recommendations(
    session: Session,
    league_id: uuid.UUID,
) -> dict[str, Any]:
    """Return recommended keepers per team to use as a prefill starting point."""
    league = _require_league(session, league_id)
    teams = session.exec(select(Team).where(Team.league_id == league_id)).all()

    recs = session.exec(
        select(KeeperRecommendation).where(
            KeeperRecommendation.league_id == league_id,
            KeeperRecommendation.scenario_name == "Default",
        )
    ).all()

    player_ids = {r.player_id for r in recs}
    players = {p.id: p for p in session.exec(
        select(Player).where(Player.id.in_(player_ids))
    ).all()} if player_ids else {}

    by_team: dict[uuid.UUID, list[KeeperRecommendation]] = {}
    for rec in recs:
        by_team.setdefault(rec.team_id, []).append(rec)

    team_rows = []
    for team in sorted(teams, key=lambda t: (t.draft_slot or 999, t.name)):
        team_recs = sorted(by_team.get(team.id, []), key=lambda r: -(r.keeper_score or 0))
        keepers = []
        for rec in team_recs:
            player = players.get(rec.player_id)
            if player is None:
                continue
            keepers.append({
                "player_id": str(rec.player_id),
                "player_name": player.full_name,
                "position": player.position,
                "nfl_team": player.nfl_team,
                "cost_pick": rec.keeper_cost_pick,
                "cost_round": rec.keeper_cost_round,
                "keeper_score": rec.keeper_score,
                "keeper_value": rec.keeper_value,
            })
        team_rows.append({
            "team_id": str(team.id),
            "team_name": team.name,
            "owner_name": team.owner_name,
            "draft_slot": team.draft_slot,
            "suggested_keepers": keepers,
        })

    return {
        "season_year": league.season_year,
        "teams": team_rows,
    }


# ---------------------------------------------------------------------------
# Write
# ---------------------------------------------------------------------------

@dataclass
class KeeperSelectionInput:
    player_id: uuid.UUID
    cost_pick: float | None = None
    cost_round: float | None = None


def set_team_keepers(
    session: Session,
    league_id: uuid.UUID,
    team_id: uuid.UUID,
    selections: list[KeeperSelectionInput],
) -> list[dict[str, Any]]:
    """Replace all keeper selections for a team. Returns the updated list."""
    league = _require_league(session, league_id)
    if league.keepers_finalized:
        raise FinalKeeperError("Keeper selections are finalized and cannot be changed")

    team = session.get(Team, team_id)
    if team is None or team.league_id != league_id:
        raise FinalKeeperError("Team not found in this league")

    # Validate max_keepers
    if len(selections) > league.max_keepers:
        raise FinalKeeperError(
            f"Too many keepers: {len(selections)} exceeds league maximum of {league.max_keepers}"
        )

    # Delete existing selections for this team this season
    existing = session.exec(
        select(FinalKeeperSelection).where(
            FinalKeeperSelection.league_id == league_id,
            FinalKeeperSelection.team_id == team_id,
            FinalKeeperSelection.season_year == league.season_year,
        )
    ).all()
    for row in existing:
        session.delete(row)
    session.flush()

    player_ids = [s.player_id for s in selections]
    players = {p.id: p for p in session.exec(
        select(Player).where(Player.id.in_(player_ids))
    ).all()} if player_ids else {}

    new_rows = []
    for sel in selections:
        if sel.player_id not in players:
            raise FinalKeeperError(f"Player {sel.player_id} not found")
        row = FinalKeeperSelection(
            league_id=league_id,
            team_id=team_id,
            player_id=sel.player_id,
            season_year=league.season_year,
            cost_pick=sel.cost_pick,
            cost_round=sel.cost_round,
        )
        session.add(row)
        new_rows.append(row)

    session.flush()
    return [_selection_row(r, players) for r in new_rows]


def finalize_league_keepers(
    session: Session,
    league_id: uuid.UUID,
    user_id: uuid.UUID,
) -> dict[str, Any]:
    """Lock keeper selections for the league. Irreversible except by platform admin."""
    league = _require_league(session, league_id)
    if league.keepers_finalized:
        raise FinalKeeperError("Keeper selections are already finalized")

    league.keepers_finalized = True
    league.keepers_finalized_at = datetime.now(timezone.utc).replace(tzinfo=None)
    league.keepers_finalized_by_user_id = user_id
    session.add(league)
    session.commit()

    return {
        "is_finalized": True,
        "finalized_at": league.keepers_finalized_at.isoformat(),
    }


def unfinalize_league_keepers(
    session: Session,
    league_id: uuid.UUID,
) -> None:
    """Reopen keeper selections (platform admin only)."""
    league = _require_league(session, league_id)
    league.keepers_finalized = False
    league.keepers_finalized_at = None
    league.keepers_finalized_by_user_id = None
    session.add(league)
    session.commit()


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _require_league(session: Session, league_id: uuid.UUID) -> League:
    league = session.get(League, league_id)
    if league is None:
        raise FinalKeeperError(f"League {league_id} not found")
    return league


def _selection_row(
    sel: FinalKeeperSelection,
    players: dict[uuid.UUID, Player],
) -> dict[str, Any]:
    player = players.get(sel.player_id)
    return {
        "selection_id": str(sel.id),
        "player_id": str(sel.player_id),
        "player_name": player.full_name if player else None,
        "position": player.position if player else None,
        "nfl_team": player.nfl_team if player else None,
        "cost_pick": sel.cost_pick,
        "cost_round": sel.cost_round,
    }


def _forfeited_picks(selections: list[FinalKeeperSelection]) -> list[dict[str, Any]]:
    picks = []
    for sel in selections:
        if sel.cost_pick is not None:
            picks.append({
                "pick": int(sel.cost_pick),
                "round": int(sel.cost_round) if sel.cost_round is not None else None,
                "player_id": str(sel.player_id),
            })
    return sorted(picks, key=lambda p: p["pick"])
