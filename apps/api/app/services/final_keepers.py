"""Final Keeper Selections service.

Manages the process of an admin finalizing which players each team is keeping
before the draft. Once finalized, selections are visible to all league members.

Selections are pre-populated from KeeperRecommendation (Default scenario) as a
starting point. Admins can add, remove, or adjust before locking.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timezone
from typing import Any
import uuid

from sqlmodel import Session, select

from app.models import FinalKeeperSelection, KeeperRecommendation, Player, Team
from app.models.league import League
from app.services.keeper_tenure import update_tenure_after_finalization


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
            "team_keepers_finalized": team.team_keepers_finalized,
            "team_keepers_finalized_at": team.team_keepers_finalized_at.isoformat() if team.team_keepers_finalized_at else None,
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

    update_tenure_after_finalization(session, league_id, league.season_year)

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


def self_finalize_team_keepers(
    session: Session,
    league_id: uuid.UUID,
    team_id: uuid.UUID,
    user_id: uuid.UUID,
    is_league_admin: bool = False,
) -> dict[str, Any]:
    """Copy the team's recommended keepers to FinalKeeperSelection and mark the team as finalized.

    The team owner can call this before the keeper deadline; league admins can always call it.
    """
    league = _require_league(session, league_id)

    if league.keepers_finalized:
        raise FinalKeeperError("League keepers are already finalized by the admin")

    team = session.get(Team, team_id)
    if team is None or team.league_id != league_id:
        raise FinalKeeperError("Team not found in this league")

    if not is_league_admin and team.user_id != user_id:
        raise FinalKeeperError("You do not own this team")

    if not is_league_admin and league.keeper_pick_deadline:
        if date.today() > league.keeper_pick_deadline:
            raise FinalKeeperError("The keeper deadline has passed")

    if team.team_keepers_finalized:
        raise FinalKeeperError("Team keepers are already finalized")

    # Pull recommended keepers for this team (Default scenario, is_recommended only)
    raw_recs = session.exec(
        select(KeeperRecommendation).where(
            KeeperRecommendation.league_id == league_id,
            KeeperRecommendation.team_id == team_id,
            KeeperRecommendation.scenario_name == "Default",
            KeeperRecommendation.is_recommended == True,  # noqa: E712
        )
    ).all()

    # Deduplicate by player_id, keeping the row with the highest keeper_score
    seen: dict[uuid.UUID, KeeperRecommendation] = {}
    for rec in raw_recs:
        existing = seen.get(rec.player_id)
        if existing is None or (rec.keeper_score or 0) > (existing.keeper_score or 0):
            seen[rec.player_id] = rec
    recs = list(seen.values())

    # Respect max_keepers; take top by score if over the limit
    if len(recs) > league.max_keepers:
        recs = sorted(recs, key=lambda r: -(r.keeper_score or 0))[: league.max_keepers]

    # Replace any existing selections for this team
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

    player_ids = [r.player_id for r in recs]
    players = (
        {p.id: p for p in session.exec(select(Player).where(Player.id.in_(player_ids))).all()}
        if player_ids
        else {}
    )

    new_rows: list[FinalKeeperSelection] = []
    for rec in recs:
        if rec.player_id not in players:
            continue
        row = FinalKeeperSelection(
            league_id=league_id,
            team_id=team_id,
            player_id=rec.player_id,
            season_year=league.season_year,
            cost_pick=rec.keeper_cost_pick,
            cost_round=rec.keeper_cost_round,
        )
        session.add(row)
        new_rows.append(row)

    team.team_keepers_finalized = True
    team.team_keepers_finalized_at = datetime.now(timezone.utc).replace(tzinfo=None)
    team.team_keepers_finalized_by_user_id = user_id
    session.add(team)
    session.commit()

    return {
        "team_keepers_finalized": True,
        "team_keepers_finalized_at": team.team_keepers_finalized_at.isoformat(),
        "keepers": [_selection_row(r, players) for r in new_rows],
    }


def self_unfinalize_team_keepers(
    session: Session,
    league_id: uuid.UUID,
    team_id: uuid.UUID,
    user_id: uuid.UUID,
    is_league_admin: bool = False,
) -> dict[str, Any]:
    """Remove a team's final keeper selections and clear their self-finalized status.

    The team owner can unfinalize before the keeper deadline; league admins can always do it.
    """
    league = _require_league(session, league_id)

    if league.keepers_finalized:
        raise FinalKeeperError("League keepers are already admin-locked and cannot be changed")

    team = session.get(Team, team_id)
    if team is None or team.league_id != league_id:
        raise FinalKeeperError("Team not found in this league")

    if not is_league_admin and team.user_id != user_id:
        raise FinalKeeperError("You do not own this team")

    if not is_league_admin and league.keeper_pick_deadline:
        if date.today() > league.keeper_pick_deadline:
            raise FinalKeeperError("The keeper deadline has passed; contact your commissioner to make changes")

    if not team.team_keepers_finalized:
        raise FinalKeeperError("Team keepers are not finalized")

    existing = session.exec(
        select(FinalKeeperSelection).where(
            FinalKeeperSelection.league_id == league_id,
            FinalKeeperSelection.team_id == team_id,
            FinalKeeperSelection.season_year == league.season_year,
        )
    ).all()
    for row in existing:
        session.delete(row)

    team.team_keepers_finalized = False
    team.team_keepers_finalized_at = None
    team.team_keepers_finalized_by_user_id = None
    session.add(team)
    session.commit()

    return {"team_keepers_finalized": False}


# ---------------------------------------------------------------------------
# Draft Board
# ---------------------------------------------------------------------------

def get_draft_board(session: Session, league_id: uuid.UUID) -> dict[str, Any]:
    """Build a full snake-draft pick grid annotated with forfeited keeper picks."""
    league = _require_league(session, league_id)
    teams = session.exec(select(Team).where(Team.league_id == league_id)).all()
    team_count = len(teams) or 12
    round_count = _round_count_from_roster_settings(league.roster_settings)

    sorted_teams = sorted(teams, key=lambda t: (t.draft_slot or 999, t.name))
    slot_to_team: dict[int, Team] = {
        t.draft_slot: t for t in sorted_teams if t.draft_slot is not None
    }

    # Load forfeited picks from FinalKeeperSelections
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

    # Map overall_pick → {player_name, position, team_id}
    forfeited: dict[int, dict[str, Any]] = {}
    for sel in selections:
        if sel.cost_pick is not None:
            player = players.get(sel.player_id)
            forfeited[int(sel.cost_pick)] = {
                "player_name": player.full_name if player else None,
                "position": player.position if player else None,
                "nfl_team": player.nfl_team if player else None,
                "team_id": str(sel.team_id),
            }

    # Build the rounds
    rounds: list[dict[str, Any]] = []
    for r in range(1, round_count + 1):
        slots_in_order = list(range(1, team_count + 1))
        if r % 2 == 0:
            slots_in_order = list(reversed(slots_in_order))

        picks: list[dict[str, Any]] = []
        for pos, slot in enumerate(slots_in_order):
            overall_pick = (r - 1) * team_count + (pos + 1)
            team = slot_to_team.get(slot)
            forf = forfeited.get(overall_pick)
            picks.append({
                "overall_pick": overall_pick,
                "round": r,
                "pick_in_round": pos + 1,
                "draft_slot": slot,
                "team_id": str(team.id) if team else None,
                "team_name": team.name if team else None,
                "owner_name": team.owner_name if team else None,
                "is_forfeited": forf is not None,
                "forfeited_player_name": forf["player_name"] if forf else None,
                "forfeited_player_position": forf["position"] if forf else None,
                "forfeited_player_nfl_team": forf["nfl_team"] if forf else None,
            })
        rounds.append({"round": r, "picks": picks})

    team_summary = [
        {
            "team_id": str(t.id),
            "team_name": t.name,
            "owner_name": t.owner_name,
            "draft_slot": t.draft_slot,
        }
        for t in sorted_teams
    ]

    return {
        "season_year": league.season_year,
        "draft_type": league.draft_type,
        "team_count": team_count,
        "round_count": round_count,
        "is_finalized": league.keepers_finalized,
        "teams": team_summary,
        "rounds": rounds,
    }


def _round_count_from_roster_settings(roster_settings: dict[str, Any]) -> int:
    slots = roster_settings.get("slots") if isinstance(roster_settings, dict) else None
    if isinstance(slots, dict):
        total = sum(int(v) for v in slots.values() if isinstance(v, (int, float)) and int(v) > 0)
        if total > 0:
            return total
    return 16


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
