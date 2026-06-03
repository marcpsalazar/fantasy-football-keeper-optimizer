from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
import uuid

from sqlmodel import Session, select

from app.models import KeeperCandidate, KeeperRecommendation, League, Player, Team
from app.services.optimizer import latest_recommendation_batch


@dataclass
class TeamComplianceResult:
    team_id: str
    team_name: str
    draft_slot: int | None
    # rule check outcomes
    max_keepers_pass: bool
    max_per_position_pass: bool
    max_qb_pass: bool
    cost_validity_pass: bool
    # counts for display
    keeper_count: int
    max_keepers_allowed: int
    qb_count: int
    max_qb_allowed: int
    position_counts: dict[str, int]
    max_per_position_allowed: int
    invalid_cost_players: list[str]
    # overall
    passes: bool = field(init=False)

    def __post_init__(self) -> None:
        self.passes = (
            self.max_keepers_pass
            and self.max_per_position_pass
            and self.max_qb_pass
            and self.cost_validity_pass
        )


@dataclass
class LeagueComplianceResult:
    league_id: str
    league_name: str
    all_pass: bool
    teams: list[TeamComplianceResult]


def check_league_compliance(
    session: Session,
    league_id: uuid.UUID,
    *,
    scenario_name: str | None = None,
    user_id: uuid.UUID | None = None,
) -> LeagueComplianceResult:
    league = session.get(League, league_id)
    if league is None:
        raise ValueError(f"League {league_id} was not found")

    teams = session.exec(select(Team).where(Team.league_id == league_id)).all()
    team_by_id = {team.id: team for team in teams}

    recommendations = latest_recommendation_batch(
        session,
        league_id,
        user_id=user_id,
        scenario_name=scenario_name,
    )
    recommended = [r for r in recommendations if r.is_recommended]

    player_ids = {r.player_id for r in recommended}
    players: dict[uuid.UUID, Player] = {}
    if player_ids:
        players = {
            p.id: p
            for p in session.exec(select(Player).where(Player.id.in_(player_ids))).all()
        }

    # Keeper cost validity: cost must be ≥ 1 and ≤ league total rounds (use 20 as upper bound)
    candidates = session.exec(
        select(KeeperCandidate).where(KeeperCandidate.team_id.in_(list(team_by_id.keys())))
    ).all()
    valid_costs: dict[tuple[uuid.UUID, uuid.UUID], bool] = {}
    for c in candidates:
        valid_costs[(c.team_id, c.player_id)] = c.keeper_cost >= 1

    recs_by_team: dict[uuid.UUID, list[KeeperRecommendation]] = defaultdict(list)
    for r in recommended:
        recs_by_team[r.team_id].append(r)

    team_results: list[TeamComplianceResult] = []
    for team in sorted(teams, key=lambda t: (t.draft_slot or 99, t.name)):
        keepers = recs_by_team.get(team.id, [])
        keeper_count = len(keepers)

        position_counts: dict[str, int] = defaultdict(int)
        for r in keepers:
            player = players.get(r.player_id)
            pos = (player.position if player else "UNK") or "UNK"
            position_counts[pos] += 1

        qb_count = position_counts.get("QB", 0)
        max_pos_count = max(position_counts.values(), default=0)

        invalid_cost_players: list[str] = []
        for r in keepers:
            is_valid = valid_costs.get((team.id, r.player_id))
            if is_valid is False:
                player = players.get(r.player_id)
                name = player.full_name if player else str(r.player_id)
                invalid_cost_players.append(name)

        result = TeamComplianceResult(
            team_id=str(team.id),
            team_name=team.name,
            draft_slot=team.draft_slot,
            max_keepers_pass=keeper_count <= league.max_keepers,
            max_per_position_pass=max_pos_count <= league.max_keepers_per_position,
            max_qb_pass=qb_count <= league.max_qb_keepers,
            cost_validity_pass=len(invalid_cost_players) == 0,
            keeper_count=keeper_count,
            max_keepers_allowed=league.max_keepers,
            qb_count=qb_count,
            max_qb_allowed=league.max_qb_keepers,
            position_counts=dict(position_counts),
            max_per_position_allowed=league.max_keepers_per_position,
            invalid_cost_players=invalid_cost_players,
        )
        team_results.append(result)

    all_pass = all(r.passes for r in team_results)
    return LeagueComplianceResult(
        league_id=str(league_id),
        league_name=league.name,
        all_pass=all_pass,
        teams=team_results,
    )
