from datetime import date
import math
import uuid

import pytest
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel, Session, create_engine, select

import app.models  # noqa: F401
from app.models import (
    ADPEntry,
    ADPSnapshot,
    DraftPick,
    FinalRosterEntry,
    League,
    ManualOverride,
    OptimizerSettings,
    Player,
    Team,
)
from app.services.optimizer import qb_scarcity_bonus, run_optimizer, run_scenario_comparison


@pytest.fixture
def session() -> Session:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session


def make_context(
    session: Session,
    *,
    minimum_keeper_value: float = 1,
    minimum_keeper_score: float = 0,
    max_keepers: int = 4,
    max_keepers_per_position: int = 2,
    max_qb_keepers: int = 1,
) -> tuple[League, OptimizerSettings, ADPSnapshot]:
    league = League(
        name=f"Test League {uuid.uuid4()}",
        season_year=2026,
        scoring_format="superflex",
        max_keepers=max_keepers,
        max_keepers_per_position=max_keepers_per_position,
        max_qb_keepers=max_qb_keepers,
    )
    session.add(league)
    session.flush()

    settings = OptimizerSettings(
        league_id=league.id,
        name="Default",
        max_keepers=max_keepers,
        max_keepers_per_position=max_keepers_per_position,
        max_qb_keepers=max_qb_keepers,
        minimum_keeper_value=minimum_keeper_value,
        minimum_keeper_score=minimum_keeper_score,
    )
    session.add(settings)

    snapshot = ADPSnapshot(
        league_id=league.id,
        season_year=league.season_year,
        name="Test ADP",
        source="Test",
        format_type="superflex",
        snapshot_date=date(2026, 5, 1),
    )
    session.add(snapshot)
    session.flush()
    return league, settings, snapshot


def add_team(session: Session, league: League, name: str, draft_slot: int) -> Team:
    team = Team(league_id=league.id, name=name, draft_slot=draft_slot)
    session.add(team)
    session.flush()
    return team


def add_candidate(
    session: Session,
    *,
    league: League,
    team: Team,
    snapshot: ADPSnapshot,
    name: str,
    position: str,
    adp_pick: float,
    keeper_value: float | None = None,
    cost_pick: int | None = None,
    roster_status: str = "Starter",
    drafted_team: Team | None = None,
) -> Player:
    player = Player(full_name=name, position=position)
    session.add(player)
    session.flush()

    session.add(
        FinalRosterEntry(
            league_id=league.id,
            team_id=team.id,
            player_id=player.id,
            season_year=league.season_year,
            position=position,
            roster_status=roster_status,
        )
    )
    session.add(
        ADPEntry(
            snapshot_id=snapshot.id,
            player_id=player.id,
            position=position,
            adp_pick=adp_pick,
            adp_round=float(math.ceil(adp_pick / 12)),
        )
    )

    if drafted_team is not None:
        pick = cost_pick if cost_pick is not None else int(adp_pick + (keeper_value or 0))
        session.add(
            DraftPick(
                league_id=league.id,
                team_id=drafted_team.id,
                player_id=player.id,
                season_year=league.season_year,
                round=math.ceil(pick / 12),
                overall_pick=pick,
                position=position,
            )
        )

    session.flush()
    return player


@pytest.mark.parametrize(
    ("expected_keepers", "keeper_values"),
    [
        (0, [0, 0, 0, 0]),
        (1, [40, 0, 0, 0]),
        (2, [40, 35, 0, 0]),
        (3, [40, 35, 30, 0]),
        (4, [40, 35, 30, 25]),
    ],
)
def test_optimizer_selects_zero_to_four_keepers(
    session: Session,
    expected_keepers: int,
    keeper_values: list[int],
) -> None:
    league, _, snapshot = make_context(session)
    team = add_team(session, league, "Mayhem", 1)
    positions = ["WR", "RB", "TE", "QB"]

    for index, keeper_value in enumerate(keeper_values):
        adp_pick = 10 + index
        add_candidate(
            session,
            league=league,
            team=team,
            snapshot=snapshot,
            name=f"Player {index}",
            position=positions[index],
            adp_pick=adp_pick,
            keeper_value=keeper_value,
            drafted_team=team,
        )

    recommendations = run_optimizer(session, league.id, persist=False)
    selected = [recommendation for recommendation in recommendations if recommendation.is_recommended]

    assert len(selected) == expected_keepers
    assert 0 <= len(selected) <= 4


def test_default_settings_do_not_select_neutral_value_keepers(session: Session) -> None:
    league = League(name="Default Value Floor", season_year=2026, scoring_format="superflex")
    session.add(league)
    session.flush()
    team = add_team(session, league, "Neutral Team", 1)
    snapshot = ADPSnapshot(
        league_id=league.id,
        season_year=league.season_year,
        name="Test ADP",
        source="Test",
        format_type="superflex",
        snapshot_date=date(2026, 5, 1),
    )
    session.add(snapshot)
    session.flush()

    for index, position in enumerate(["QB", "RB", "WR", "TE"]):
        adp_pick = 20 + index
        add_candidate(
            session,
            league=league,
            team=team,
            snapshot=snapshot,
            name=f"Neutral Player {index}",
            position=position,
            adp_pick=adp_pick,
            cost_pick=adp_pick,
            drafted_team=team,
        )

    recommendations = run_optimizer(session, league.id, persist=False)
    selected = [recommendation for recommendation in recommendations if recommendation.is_recommended]

    assert selected == []
    assert {recommendation.reason for recommendation in recommendations} == {
        "Keeper value below minimum"
    }


def test_optimizer_can_use_lower_keeper_value_thresholds_when_configured(
    session: Session,
) -> None:
    league, _, snapshot = make_context(
        session,
        minimum_keeper_value=-5,
        minimum_keeper_score=-100,
    )
    team = add_team(session, league, "Floor Team", 1)

    positive = add_candidate(
        session,
        league=league,
        team=team,
        snapshot=snapshot,
        name="Positive Value",
        position="WR",
        adp_pick=30,
        keeper_value=5,
        drafted_team=team,
    )
    neutral = add_candidate(
        session,
        league=league,
        team=team,
        snapshot=snapshot,
        name="Neutral Value",
        position="RB",
        adp_pick=40,
        keeper_value=0,
        drafted_team=team,
    )
    negative = add_candidate(
        session,
        league=league,
        team=team,
        snapshot=snapshot,
        name="Negative Value",
        position="TE",
        adp_pick=50,
        keeper_value=-4,
        drafted_team=team,
    )

    recommendations = run_optimizer(session, league.id, persist=False)
    by_player_id = {recommendation.player_id: recommendation for recommendation in recommendations}

    assert by_player_id[positive.id].is_recommended is True
    assert by_player_id[neutral.id].is_recommended is True
    assert by_player_id[negative.id].is_recommended is True


def test_optimizer_respects_position_and_qb_caps(session: Session) -> None:
    league, _, snapshot = make_context(session)
    team = add_team(session, league, "Cap Test", 1)

    add_candidate(
        session,
        league=league,
        team=team,
        snapshot=snapshot,
        name="WR One",
        position="WR",
        adp_pick=30,
        keeper_value=80,
        drafted_team=team,
    )
    add_candidate(
        session,
        league=league,
        team=team,
        snapshot=snapshot,
        name="WR Two",
        position="WR",
        adp_pick=32,
        keeper_value=70,
        drafted_team=team,
    )
    add_candidate(
        session,
        league=league,
        team=team,
        snapshot=snapshot,
        name="WR Three",
        position="WR",
        adp_pick=34,
        keeper_value=60,
        drafted_team=team,
    )
    add_candidate(
        session,
        league=league,
        team=team,
        snapshot=snapshot,
        name="QB One",
        position="QB",
        adp_pick=15,
        keeper_value=50,
        drafted_team=team,
    )
    add_candidate(
        session,
        league=league,
        team=team,
        snapshot=snapshot,
        name="QB Two",
        position="QB",
        adp_pick=16,
        keeper_value=48,
        drafted_team=team,
    )
    add_candidate(
        session,
        league=league,
        team=team,
        snapshot=snapshot,
        name="RB One",
        position="RB",
        adp_pick=36,
        keeper_value=40,
        drafted_team=team,
    )

    recommendations = run_optimizer(session, league.id, persist=False)
    selected_ids = {
        recommendation.player_id for recommendation in recommendations if recommendation.is_recommended
    }
    players = session.exec(select(Player)).all()
    selected_positions = [
        player.position for player in players if player.id in selected_ids
    ]

    assert len(selected_positions) == 4
    assert selected_positions.count("WR") == 2
    assert selected_positions.count("QB") == 1
    assert selected_positions.count("RB") == 1


def test_keeper_cost_uses_same_team_draft_pick_otherwise_adp(session: Session) -> None:
    league, _, snapshot = make_context(session, minimum_keeper_value=-100, minimum_keeper_score=-100)
    current_team = add_team(session, league, "Current Team", 1)
    other_team = add_team(session, league, "Other Team", 2)

    same_team_player = add_candidate(
        session,
        league=league,
        team=current_team,
        snapshot=snapshot,
        name="Same Team Keeper",
        position="WR",
        adp_pick=20,
        cost_pick=60,
        drafted_team=current_team,
    )
    acquired_player = add_candidate(
        session,
        league=league,
        team=current_team,
        snapshot=snapshot,
        name="Acquired Keeper",
        position="RB",
        adp_pick=25,
        cost_pick=70,
        drafted_team=other_team,
    )

    recommendations = run_optimizer(session, league.id, persist=False)
    by_player_id = {recommendation.player_id: recommendation for recommendation in recommendations}

    assert by_player_id[same_team_player.id].keeper_cost_pick == 60
    assert by_player_id[same_team_player.id].keeper_value == 40
    assert by_player_id[acquired_player.id].keeper_cost_pick == 25
    assert by_player_id[acquired_player.id].keeper_value == 0


def test_manual_overrides_force_and_exclude_players(session: Session) -> None:
    league, _, snapshot = make_context(session, minimum_keeper_value=10)
    team = add_team(session, league, "Override Team", 1)

    excluded = add_candidate(
        session,
        league=league,
        team=team,
        snapshot=snapshot,
        name="Excluded Star",
        position="WR",
        adp_pick=10,
        keeper_value=90,
        drafted_team=team,
    )
    forced = add_candidate(
        session,
        league=league,
        team=team,
        snapshot=snapshot,
        name="Forced Weak",
        position="RB",
        adp_pick=80,
        keeper_value=0,
        drafted_team=team,
    )
    automatic = add_candidate(
        session,
        league=league,
        team=team,
        snapshot=snapshot,
        name="Auto Solid",
        position="TE",
        adp_pick=30,
        keeper_value=40,
        drafted_team=team,
    )
    session.add(
        ManualOverride(
            league_id=league.id,
            team_id=team.id,
            player_id=excluded.id,
            override_type="exclude",
        )
    )
    session.add(
        ManualOverride(
            league_id=league.id,
            team_id=team.id,
            player_id=forced.id,
            override_type="force_keep",
        )
    )
    session.flush()

    recommendations = run_optimizer(session, league.id, persist=False)
    by_player_id = {recommendation.player_id: recommendation for recommendation in recommendations}

    assert by_player_id[excluded.id].is_eligible is False
    assert by_player_id[excluded.id].is_recommended is False
    assert by_player_id[forced.id].is_eligible is True
    assert by_player_id[forced.id].is_recommended is True
    assert by_player_id[automatic.id].is_recommended is True


def test_qb_is_not_forced_when_below_threshold(session: Session) -> None:
    league, _, snapshot = make_context(session, minimum_keeper_value=5)
    team = add_team(session, league, "QB Test", 1)

    add_candidate(
        session,
        league=league,
        team=team,
        snapshot=snapshot,
        name="Market Price QB",
        position="QB",
        adp_pick=10,
        drafted_team=None,
    )

    recommendations = run_optimizer(session, league.id, persist=False)

    assert len([recommendation for recommendation in recommendations if recommendation.is_recommended]) == 0
    assert recommendations[0].reason == "Keeper value below minimum"


def test_qb_scarcity_bonus_has_superflex_tiers() -> None:
    league = League(name="Tier Test", season_year=2026, scoring_format="superflex")
    settings = OptimizerSettings(league_id=uuid.uuid4(), elite_qb_cutoff=24)

    elite = qb_scarcity_bonus(settings, league, "QB", 12)
    strong = qb_scarcity_bonus(settings, league, "QB", 36)
    fringe = qb_scarcity_bonus(settings, league, "QB", 60)
    late = qb_scarcity_bonus(settings, league, "QB", 120)

    assert elite > strong > fringe > late
    assert (elite, strong, fringe) == (40, 30, 20)
    assert late == 0


def test_scenario_comparison_returns_presets_team_scores_and_forfeited_picks(
    session: Session,
) -> None:
    league, _, snapshot = make_context(session, minimum_keeper_value=1)
    team = add_team(session, league, "Scenario Team", 1)
    empty_team = add_team(session, league, "Empty Team", 2)
    assert empty_team.id is not None

    add_candidate(
        session,
        league=league,
        team=team,
        snapshot=snapshot,
        name="Value Receiver",
        position="WR",
        adp_pick=25,
        keeper_value=45,
        drafted_team=team,
    )
    add_candidate(
        session,
        league=league,
        team=team,
        snapshot=snapshot,
        name="Market QB",
        position="QB",
        adp_pick=18,
        keeper_value=0,
        drafted_team=team,
    )

    comparisons = run_scenario_comparison(session, league.id, persist=False)

    assert [comparison.scenario_name for comparison in comparisons] == [
        "Pure Value",
        "Balanced",
        "Superflex Heavy",
        "Win Now",
        "Rebuild",
    ]
    expected_by_scenario = {
        "Pure Value": ["Value Receiver"],
        "Balanced": ["Value Receiver"],
        "Superflex Heavy": ["Market QB", "Value Receiver"],
        "Win Now": ["Market QB", "Value Receiver"],
        "Rebuild": ["Value Receiver"],
    }
    for comparison in comparisons:
        team_result = next(
            result for result in comparison.teams if result.team_name == "Scenario Team"
        )
        assert [keeper.player_name for keeper in team_result.selected_keepers] == expected_by_scenario[
            comparison.scenario_name
        ]

    balanced = next(comparison for comparison in comparisons if comparison.scenario_name == "Balanced")
    scenario_team = next(team_result for team_result in balanced.teams if team_result.team_name == "Scenario Team")
    empty_result = next(team_result for team_result in balanced.teams if team_result.team_name == "Empty Team")

    assert scenario_team.total_keeper_score > 0
    assert scenario_team.picks_forfeited == ["R6 / Pick 70"]
    assert scenario_team.selected_keepers[0].player_name == "Value Receiver"
    assert "Balanced" in scenario_team.strategic_notes
    assert empty_result.selected_keepers == []
    assert empty_result.picks_forfeited == []
