from __future__ import annotations

import math
import uuid
from dataclasses import dataclass

from sqlmodel import Session, select

from app.models import (
    ADPEntry,
    ADPSnapshot,
    AppDefaultOptimizerSettings,
    DraftPick,
    FinalRosterEntry,
    KeeperRecommendation,
    League,
    ManualOverride,
    OptimizerSettings,
    Player,
    Team,
)

AUTO_OVERRIDE = "auto"
EXCLUDE_OVERRIDE = "exclude"
FORCE_KEEP_OVERRIDE = "force_keep"


class OptimizerInputError(ValueError):
    """Raised when the optimizer cannot run with the supplied league data."""


@dataclass(frozen=True)
class SelectionLimits:
    max_keepers: int
    max_keepers_per_position: int
    max_qb_keepers: int


@dataclass(frozen=True)
class CandidateScore:
    keeper_value: float
    weighted_value: float
    talent_bonus: float
    status_bonus: float
    draft_slot_bonus: float
    qb_scarcity_bonus: float
    elite_anchor_bonus: float
    risk_penalty: float

    @property
    def total(self) -> float:
        return (
            self.weighted_value
            + self.talent_bonus
            + self.status_bonus
            + self.draft_slot_bonus
            + self.qb_scarcity_bonus
            + self.elite_anchor_bonus
            - self.risk_penalty
        )


@dataclass
class KeeperCandidate:
    recommendation: KeeperRecommendation
    roster_entry: FinalRosterEntry
    player: Player
    override_type: str
    selection_priority: int = 0


@dataclass(frozen=True)
class ScenarioPreset:
    name: str
    description: str
    strategic_notes: str
    settings: OptimizerSettings


@dataclass(frozen=True)
class ScenarioKeeper:
    player_id: uuid.UUID
    player_name: str
    position: str
    keeper_cost_pick: float | None
    keeper_cost_round: float | None
    keeper_value: float | None
    keeper_score: float | None
    reason: str | None


@dataclass(frozen=True)
class ScenarioTeamResult:
    team_id: uuid.UUID
    team_name: str
    selected_keepers: list[ScenarioKeeper]
    total_keeper_score: float
    picks_forfeited: list[str]
    strategic_notes: str


@dataclass(frozen=True)
class ScenarioComparison:
    scenario_name: str
    description: str
    strategic_notes: str
    total_keeper_score: float
    teams: list[ScenarioTeamResult]


SCENARIO_PRESET_ORDER = (
    "Pure Value",
    "Balanced",
    "Superflex Heavy",
    "Win Now",
    "Rebuild",
)

_SETTINGS_COPY_FIELDS = (
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


def run_optimizer(
    session: Session,
    league_id: uuid.UUID,
    *,
    user_id: uuid.UUID | None = None,
    settings_id: uuid.UUID | None = None,
    adp_snapshot_id: uuid.UUID | None = None,
    scenario_name: str | None = None,
    settings_override: OptimizerSettings | None = None,
    persist: bool = True,
) -> list[KeeperRecommendation]:
    league = _require_league(session, league_id)
    if settings_override is None:
        settings, settings_is_persisted = _resolve_settings(
            session,
            league,
            settings_id,
            user_id=user_id,
        )
    else:
        settings = settings_override
        settings_is_persisted = False
    adp_snapshot = _resolve_adp_snapshot(session, league, adp_snapshot_id)
    scenario = scenario_name or settings.name

    teams = session.exec(select(Team).where(Team.league_id == league.id)).all()
    team_by_id = {team.id: team for team in teams}
    team_count = len(teams) or 12

    roster_entries = session.exec(
        select(FinalRosterEntry).where(
            FinalRosterEntry.league_id == league.id,
            FinalRosterEntry.season_year == league.season_year,
        )
    ).all()

    players = {
        player.id: player
        for player in session.exec(
            select(Player).where(Player.id.in_([entry.player_id for entry in roster_entries]))
        ).all()
    }
    adp_entries = {
        entry.player_id: entry
        for entry in session.exec(
            select(ADPEntry).where(ADPEntry.snapshot_id == adp_snapshot.id)
        ).all()
    }
    original_picks = {
        (pick.team_id, pick.player_id): pick
        for pick in session.exec(
            select(DraftPick).where(
                DraftPick.league_id == league.id,
                DraftPick.season_year == league.season_year,
            )
        ).all()
    }
    overrides = {
        (override.team_id, override.player_id): override
        for override in session.exec(
            select(ManualOverride).where(ManualOverride.league_id == league.id)
            .where(ManualOverride.user_id == user_id)
        ).all()
    }

    candidates = [
        _build_candidate(
            league=league,
            settings=settings,
            settings_id=settings.id if settings_is_persisted else None,
            adp_snapshot=adp_snapshot,
            team=team_by_id.get(roster_entry.team_id),
            player=players.get(roster_entry.player_id),
            roster_entry=roster_entry,
            adp_entry=adp_entries.get(roster_entry.player_id),
            original_pick=original_picks.get((roster_entry.team_id, roster_entry.player_id)),
            manual_override=overrides.get((roster_entry.team_id, roster_entry.player_id)),
            scenario_name=scenario,
            team_count=team_count,
            user_id=user_id,
        )
        for roster_entry in roster_entries
        if roster_entry.team_id in team_by_id and roster_entry.player_id in players
    ]

    recommendations = _select_recommendations(candidates, settings, league, team_by_id)

    if persist:
        _replace_persisted_recommendations(
            session=session,
            league_id=league.id,
            user_id=user_id,
            settings_id=settings.id if settings_is_persisted else None,
            adp_snapshot_id=adp_snapshot.id,
            scenario_name=scenario,
            recommendations=recommendations,
        )

    return recommendations


def run_scenario_comparison(
    session: Session,
    league_id: uuid.UUID,
    *,
    user_id: uuid.UUID | None = None,
    adp_snapshot_id: uuid.UUID | None = None,
    scenario_names: list[str] | None = None,
    persist: bool = True,
) -> list[ScenarioComparison]:
    league = _require_league(session, league_id)
    base_settings, _ = _resolve_settings(session, league, None, user_id=user_id)
    adp_snapshot = _resolve_adp_snapshot(session, league, adp_snapshot_id)
    presets_by_name = {
        preset.name: preset
        for preset in build_scenario_presets(league=league, base_settings=base_settings)
    }
    requested_names = scenario_names or list(SCENARIO_PRESET_ORDER)

    comparisons: list[ScenarioComparison] = []
    for scenario_name in requested_names:
        preset = presets_by_name.get(scenario_name)
        if preset is None:
            raise OptimizerInputError(f"Unknown scenario preset: {scenario_name}")

        recommendations = run_optimizer(
            session,
            league.id,
            user_id=user_id,
            adp_snapshot_id=adp_snapshot.id,
            scenario_name=preset.name,
            settings_override=preset.settings,
            persist=persist,
        )
        comparisons.append(_build_scenario_comparison(session, league.id, preset, recommendations))

    return comparisons


def latest_recommendation_batch(
    session: Session,
    league_id: uuid.UUID,
    *,
    user_id: uuid.UUID | None = None,
    scenario_name: str | None = None,
    recommended_only: bool = False,
) -> list[KeeperRecommendation]:
    latest = _latest_recommendation(
        session,
        league_id,
        user_id=user_id,
        scenario_name=scenario_name,
    )
    if latest is None:
        return []

    statement = select(KeeperRecommendation).where(
        KeeperRecommendation.league_id == league_id,
        KeeperRecommendation.user_id == user_id,
        KeeperRecommendation.scenario_name == latest.scenario_name,
    )
    if latest.settings_id is None:
        statement = statement.where(KeeperRecommendation.settings_id.is_(None))
    else:
        statement = statement.where(KeeperRecommendation.settings_id == latest.settings_id)

    if latest.adp_snapshot_id is None:
        statement = statement.where(KeeperRecommendation.adp_snapshot_id.is_(None))
    else:
        statement = statement.where(KeeperRecommendation.adp_snapshot_id == latest.adp_snapshot_id)

    if recommended_only:
        statement = statement.where(KeeperRecommendation.is_recommended.is_(True))

    return session.exec(statement).all()


def build_scenario_presets(
    *,
    league: League,
    base_settings: OptimizerSettings,
) -> list[ScenarioPreset]:
    return [
        ScenarioPreset(
            name="Pure Value",
            description="Ranks keepers primarily by raw pick value over market ADP.",
            strategic_notes="Best for preserving surplus draft capital and avoiding name-value traps.",
            settings=_scenario_settings(
                league=league,
                base_settings=base_settings,
                name="Pure Value",
                minimum_keeper_value=max(base_settings.minimum_keeper_value, 1),
                minimum_keeper_score=max(base_settings.minimum_keeper_score, 1),
                qb_weight=1.0,
                rb_weight=1.0,
                wr_weight=1.0,
                te_weight=1.0,
                talent_anchor=0,
                starter_status_bonus=0,
                bench_status_bonus=0,
                ir_status_bonus=0,
                enable_draft_slot_bonus=False,
                enable_qb_scarcity_bonus=False,
            ),
        ),
        ScenarioPreset(
            name="Balanced",
            description="Uses the league's default optimizer posture.",
            strategic_notes="Best baseline for comparing value, roster quality, and flexibility.",
            settings=_scenario_settings(league=league, base_settings=base_settings, name="Balanced"),
        ),
        ScenarioPreset(
            name="Superflex Heavy",
            description="Raises QB weights and scarcity bonuses for superflex roster construction.",
            strategic_notes="Best when the room is expected to push quarterbacks above neutral ADP.",
            settings=_scenario_settings(
                league=league,
                base_settings=base_settings,
                name="Superflex Heavy",
                minimum_keeper_value=min(base_settings.minimum_keeper_value, -2),
                qb_weight=max(base_settings.qb_weight, 2.15),
                rb_weight=base_settings.rb_weight,
                wr_weight=max(base_settings.wr_weight, 0.95),
                te_weight=base_settings.te_weight,
                qb_max_adp=base_settings.qb_max_adp or 90,
                elite_qb_cutoff=max(base_settings.elite_qb_cutoff, 30),
                enable_qb_scarcity_bonus=True,
            ),
        ),
        ScenarioPreset(
            name="Win Now",
            description="Accepts lower pure value for elite players and starter-heavy rosters.",
            strategic_notes="Best for contenders willing to spend premium picks on weekly ceiling.",
            settings=_scenario_settings(
                league=league,
                base_settings=base_settings,
                name="Win Now",
                minimum_keeper_value=min(base_settings.minimum_keeper_value, -6),
                minimum_keeper_score=max(base_settings.minimum_keeper_score, 6),
                max_adp_cap=min(base_settings.max_adp_cap or 120, 120),
                talent_anchor=max(base_settings.talent_anchor, 220),
                starter_status_bonus=max(base_settings.starter_status_bonus, 4),
                bench_status_bonus=min(base_settings.bench_status_bonus, 0.5),
            ),
        ),
        ScenarioPreset(
            name="Rebuild",
            description="Keeps only strong value plays and protects early draft flexibility.",
            strategic_notes="Best for teams that need extra picks and should avoid marginal keepers.",
            settings=_scenario_settings(
                league=league,
                base_settings=base_settings,
                name="Rebuild",
                max_keepers=min(base_settings.max_keepers, 2),
                minimum_keeper_value=max(base_settings.minimum_keeper_value, 8),
                minimum_keeper_score=max(base_settings.minimum_keeper_score, 10),
                max_adp_cap=min(base_settings.max_adp_cap or 160, 160),
                starter_status_bonus=min(base_settings.starter_status_bonus, 2),
                bench_status_bonus=min(base_settings.bench_status_bonus, 0.5),
            ),
        ),
    ]


def calculate_keeper_score(
    *,
    settings: OptimizerSettings,
    league: League,
    team: Team | None,
    player: Player,
    keeper_value: float,
    adp_pick: float,
    roster_status: str,
    team_count: int,
    adp_entry: ADPEntry | None = None,
) -> CandidateScore:
    position = _normalize_position(player.position)
    return CandidateScore(
        keeper_value=keeper_value,
        weighted_value=keeper_value * position_weight(settings, position),
        talent_bonus=talent_bonus(settings, adp_pick),
        status_bonus=status_bonus(settings, roster_status),
        draft_slot_bonus=draft_slot_bonus(settings, team, team_count),
        qb_scarcity_bonus=qb_scarcity_bonus(settings, league, position, adp_pick),
        elite_anchor_bonus=elite_anchor_bonus(settings, adp_pick, position, adp_entry),
        risk_penalty=risk_penalty(roster_status),
    )


def position_weight(settings: OptimizerSettings, position: str) -> float:
    weights = {
        "QB": settings.qb_weight,
        "RB": settings.rb_weight,
        "WR": settings.wr_weight,
        "TE": settings.te_weight,
        "K": settings.k_weight,
        "DEF": settings.def_weight,
        "DST": settings.def_weight,
    }
    return weights.get(_normalize_position(position), 1.0)


def talent_bonus(settings: OptimizerSettings, adp_pick: float) -> float:
    if settings.talent_divisor <= 0:
        return 0
    return max(0, (settings.talent_anchor - adp_pick) / settings.talent_divisor)


def status_bonus(settings: OptimizerSettings, roster_status: str) -> float:
    status = _normalize_status(roster_status)
    if status in {"starter", "start"}:
        return settings.starter_status_bonus
    if status in {"ir", "injured_reserve", "pup", "out", "suspended"}:
        return settings.ir_status_bonus
    return settings.bench_status_bonus


def draft_slot_bonus(settings: OptimizerSettings, team: Team | None, team_count: int) -> float:
    if not settings.enable_draft_slot_bonus or team is None or team.draft_slot is None:
        return 0

    if team.draft_slot < 1 or team.draft_slot > team_count:
        return 0

    return (team_count + 1 - team.draft_slot) / team_count


def qb_scarcity_bonus(
    settings: OptimizerSettings,
    league: League,
    position: str,
    adp_pick: float,
) -> float:
    if (
        not settings.enable_qb_scarcity_bonus
        or _normalize_position(position) != "QB"
        or "superflex" not in league.scoring_format.lower()
    ):
        return 0

    elite_cutoff = max(settings.elite_qb_cutoff, 1)
    if adp_pick <= elite_cutoff:
        return 40
    if adp_pick <= elite_cutoff * 2:
        return 30
    if adp_pick <= elite_cutoff * 3:
        return 20
    if adp_pick <= elite_cutoff * 4:
        return 10
    return 0


def elite_anchor_bonus(
    settings: OptimizerSettings,
    adp_pick: float,
    position: str,
    adp_entry: ADPEntry | None = None,
) -> float:
    if not settings.enable_elite_player_bonus:
        return 0

    metric_bonus = _draftsharks_elite_metric_bonus(position, adp_entry)
    if metric_bonus is not None:
        return metric_bonus

    if adp_pick <= 12:
        return 15
    if adp_pick <= 24:
        return 8
    return 0


def _draftsharks_elite_metric_bonus(position: str, adp_entry: ADPEntry | None) -> float | None:
    if adp_entry is None:
        return None

    has_metric = any(
        value is not None
        for value in (
            adp_entry.draftsharks_3d_value,
            adp_entry.draftsharks_projection,
            adp_entry.consensus_projection,
            adp_entry.floor_projection,
            adp_entry.ceiling_projection,
        )
    )
    if not has_metric:
        return None

    bonus = 0.0
    if adp_entry.draftsharks_3d_value is not None:
        bonus += min(12.0, max(0.0, adp_entry.draftsharks_3d_value / 8.0))

    projection = _best_projection(adp_entry)
    if projection is not None:
        bonus += _projection_elite_bonus(position, projection)

    if (
        projection is not None
        and adp_entry.ceiling_projection is not None
        and adp_entry.ceiling_projection > projection
    ):
        bonus += min(4.0, (adp_entry.ceiling_projection - projection) / 15.0)

    if adp_entry.floor_projection is not None and projection is not None and projection > 0:
        floor_ratio = adp_entry.floor_projection / projection
        if floor_ratio >= 0.85:
            bonus += 3.0
        elif floor_ratio >= 0.75:
            bonus += 1.5

    bonus -= _metric_risk_discount(adp_entry.risk)
    bonus -= _metric_risk_discount(adp_entry.injury)
    return max(0.0, min(20.0, bonus))


def _best_projection(adp_entry: ADPEntry) -> float | None:
    return max(
        (
            value
            for value in (
                adp_entry.draftsharks_projection,
                adp_entry.consensus_projection,
            )
            if value is not None
        ),
        default=None,
    )


def _projection_elite_bonus(position: str, projection: float) -> float:
    thresholds = {
        "QB": (360, 330, 300),
        "RB": (285, 250, 220),
        "WR": (285, 250, 220),
        "TE": (220, 190, 165),
    }
    high, mid, low = thresholds.get(_normalize_position(position), (140, 110, 90))
    if projection >= high:
        return 6
    if projection >= mid:
        return 4
    if projection >= low:
        return 2
    return 0


def _metric_risk_discount(value: float | None) -> float:
    if value is None:
        return 0
    if value <= 1:
        return value * 4
    if value <= 10:
        return value * 0.4
    return min(6.0, value / 15.0)


def risk_penalty(roster_status: str) -> float:
    status = _normalize_status(roster_status)
    if status in {"ir", "injured_reserve", "pup", "out", "suspended"}:
        return 2
    if status in {"questionable", "doubtful"}:
        return 1
    return 0


def _build_candidate(
    *,
    league: League,
    settings: OptimizerSettings,
    settings_id: uuid.UUID | None,
    adp_snapshot: ADPSnapshot,
    team: Team | None,
    player: Player | None,
    roster_entry: FinalRosterEntry,
    adp_entry: ADPEntry | None,
    original_pick: DraftPick | None,
    manual_override: ManualOverride | None,
    scenario_name: str,
    team_count: int,
    user_id: uuid.UUID | None,
) -> KeeperCandidate:
    if player is None:
        raise OptimizerInputError(f"Missing player for roster entry {roster_entry.id}")

    override_type = _normalize_override(manual_override.override_type if manual_override else None)
    adp_pick = adp_entry.adp_pick if adp_entry else None
    adp_round = adp_entry.adp_round if adp_entry else None

    if original_pick is not None:
        keeper_cost_pick = float(original_pick.overall_pick)
        keeper_cost_round = float(original_pick.round)
    else:
        keeper_cost_pick = adp_pick
        keeper_cost_round = adp_round

    recommendation = KeeperRecommendation(
        league_id=league.id,
        user_id=user_id,
        team_id=roster_entry.team_id,
        player_id=player.id,
        settings_id=settings_id,
        adp_snapshot_id=adp_snapshot.id,
        scenario_name=scenario_name,
        keeper_cost_pick=keeper_cost_pick,
        keeper_cost_round=keeper_cost_round,
        adp_pick=adp_pick,
        adp_round=adp_round,
        is_eligible=False,
        is_recommended=False,
    )

    if adp_pick is None:
        recommendation.reason = "Missing ADP"
        return KeeperCandidate(recommendation, roster_entry, player, override_type)

    if keeper_cost_pick is None:
        recommendation.reason = "Missing keeper cost"
        return KeeperCandidate(recommendation, roster_entry, player, override_type)

    if recommendation.adp_round is None:
        recommendation.adp_round = float(_round_for_pick(adp_pick, team_count))
    if recommendation.keeper_cost_round is None:
        recommendation.keeper_cost_round = float(_round_for_pick(keeper_cost_pick, team_count))

    keeper_value = keeper_cost_pick - adp_pick
    score = calculate_keeper_score(
        settings=settings,
        league=league,
        team=team,
        player=player,
        keeper_value=keeper_value,
        adp_pick=adp_pick,
        roster_status=roster_entry.roster_status,
        team_count=team_count,
        adp_entry=adp_entry,
    )
    recommendation.keeper_value = round(keeper_value, 3)
    recommendation.keeper_score = round(score.total, 3)

    if override_type == EXCLUDE_OVERRIDE:
        recommendation.reason = "Manual override excluded player"
        return KeeperCandidate(recommendation, roster_entry, player, override_type)

    if override_type == FORCE_KEEP_OVERRIDE:
        recommendation.is_eligible = True
        recommendation.reason = "Manual override forced keeper"
        return KeeperCandidate(recommendation, roster_entry, player, override_type, selection_priority=1)

    is_eligible, reason = _calculate_eligibility(
        settings,
        player,
        adp_pick,
        keeper_value,
        score.total,
        score.elite_anchor_bonus,
    )
    recommendation.is_eligible = is_eligible
    recommendation.reason = reason
    return KeeperCandidate(recommendation, roster_entry, player, override_type)


def _select_recommendations(
    candidates: list[KeeperCandidate],
    settings: OptimizerSettings,
    league: League,
    team_by_id: dict[uuid.UUID, Team],
) -> list[KeeperRecommendation]:
    limits = _selection_limits(settings, league)

    by_team: dict[uuid.UUID, list[KeeperCandidate]] = {team_id: [] for team_id in team_by_id}
    for candidate in candidates:
        by_team.setdefault(candidate.roster_entry.team_id, []).append(candidate)

    for team_id, team_candidates in by_team.items():
        selected: list[KeeperCandidate] = []
        position_counts: dict[str, int] = {}
        qb_count = 0

        forced_candidates = [
            candidate
            for candidate in team_candidates
            if candidate.override_type == FORCE_KEEP_OVERRIDE and candidate.recommendation.is_eligible
        ]
        auto_candidates = [
            candidate
            for candidate in team_candidates
            if candidate.override_type != FORCE_KEEP_OVERRIDE and candidate.recommendation.is_eligible
        ]

        for candidate in sorted(
            forced_candidates,
            key=_candidate_sort_key,
            reverse=True,
        ):
            allowed, reason = _can_select_candidate(
                candidate,
                limits,
                selected,
                position_counts,
                qb_count,
            )
            if not allowed:
                candidate.recommendation.reason = reason
                continue
            selected.append(candidate)
            position = _normalize_position(candidate.player.position)
            position_counts[position] = position_counts.get(position, 0) + 1
            qb_count += 1 if position == "QB" else 0

        for candidate in sorted(auto_candidates, key=_candidate_sort_key, reverse=True):
            allowed, reason = _can_select_candidate(
                candidate,
                limits,
                selected,
                position_counts,
                qb_count,
            )
            if not allowed:
                if candidate.recommendation.reason == "Eligible":
                    candidate.recommendation.reason = reason
                continue
            selected.append(candidate)
            position = _normalize_position(candidate.player.position)
            position_counts[position] = position_counts.get(position, 0) + 1
            qb_count += 1 if position == "QB" else 0

        for candidate in selected:
            candidate.recommendation.is_recommended = True
            if candidate.override_type == FORCE_KEEP_OVERRIDE:
                candidate.recommendation.reason = "Manual override forced keeper"
            elif candidate.recommendation.reason == "Eligible":
                candidate.recommendation.reason = "Selected by optimizer"

        selected_ids = {candidate.recommendation.player_id for candidate in selected}
        for candidate in team_candidates:
            if (
                candidate.recommendation.is_eligible
                and candidate.recommendation.player_id not in selected_ids
                and candidate.recommendation.reason == "Eligible"
            ):
                candidate.recommendation.reason = "Eligible but not selected"

    return [candidate.recommendation for candidate in candidates]


def _calculate_eligibility(
    settings: OptimizerSettings,
    player: Player,
    adp_pick: float,
    keeper_value: float,
    keeper_score: float,
    elite_anchor_bonus: float,
) -> tuple[bool, str]:
    if settings.max_adp_cap is not None and adp_pick > settings.max_adp_cap:
        return False, "ADP exceeds cap"

    if (
        _normalize_position(player.position) == "QB"
        and settings.qb_max_adp is not None
        and adp_pick > settings.qb_max_adp
    ):
        return False, "QB ADP exceeds cap"

    has_elite_floor_exception = (
        settings.enable_elite_player_bonus
        and elite_anchor_bonus >= 12
        and keeper_value < 0
        and keeper_value >= -abs(settings.elite_player_max_negative_edge)
    )
    if keeper_value < settings.minimum_keeper_value and not has_elite_floor_exception:
        return False, "Keeper value below minimum"

    if keeper_score < settings.minimum_keeper_score:
        return False, "Keeper score below minimum"

    return True, "Eligible"


def _selection_limits(settings: OptimizerSettings, league: League) -> SelectionLimits:
    return SelectionLimits(
        max_keepers=max(0, min(4, settings.max_keepers, league.max_keepers)),
        max_keepers_per_position=max(
            0,
            min(settings.max_keepers_per_position, league.max_keepers_per_position),
        ),
        max_qb_keepers=max(0, min(settings.max_qb_keepers, league.max_qb_keepers)),
    )


def _can_select_candidate(
    candidate: KeeperCandidate,
    limits: SelectionLimits,
    selected: list[KeeperCandidate],
    position_counts: dict[str, int],
    qb_count: int,
) -> tuple[bool, str]:
    if len(selected) >= limits.max_keepers:
        return False, "Keeper limit reached"

    position = _normalize_position(candidate.player.position)
    if position_counts.get(position, 0) >= limits.max_keepers_per_position:
        return False, "Position keeper limit reached"

    if position == "QB" and qb_count >= limits.max_qb_keepers:
        return False, "QB keeper limit reached"

    return True, "Eligible"


def _candidate_sort_key(candidate: KeeperCandidate) -> tuple[int, float, float, float]:
    recommendation = candidate.recommendation
    keeper_score = (
        recommendation.keeper_score if recommendation.keeper_score is not None else float("-inf")
    )
    keeper_value = (
        recommendation.keeper_value if recommendation.keeper_value is not None else float("-inf")
    )
    adp_pick = recommendation.adp_pick if recommendation.adp_pick is not None else float("inf")
    return (
        candidate.selection_priority,
        keeper_score,
        keeper_value,
        -adp_pick,
    )


def _replace_persisted_recommendations(
    *,
    session: Session,
    league_id: uuid.UUID,
    user_id: uuid.UUID | None,
    settings_id: uuid.UUID | None,
    adp_snapshot_id: uuid.UUID,
    scenario_name: str,
    recommendations: list[KeeperRecommendation],
) -> None:
    existing = session.exec(
        select(KeeperRecommendation).where(
            KeeperRecommendation.league_id == league_id,
            KeeperRecommendation.user_id == user_id,
            KeeperRecommendation.adp_snapshot_id == adp_snapshot_id,
            KeeperRecommendation.scenario_name == scenario_name,
        )
    ).all()

    for recommendation in existing:
        session.delete(recommendation)

    for recommendation in recommendations:
        session.add(recommendation)

    session.commit()


def _latest_recommendation(
    session: Session,
    league_id: uuid.UUID,
    *,
    user_id: uuid.UUID | None,
    scenario_name: str | None,
) -> KeeperRecommendation | None:
    statement = select(KeeperRecommendation).where(
        KeeperRecommendation.league_id == league_id,
        KeeperRecommendation.user_id == user_id,
    )
    if scenario_name is not None:
        return session.exec(
            statement.where(KeeperRecommendation.scenario_name == scenario_name).order_by(
                KeeperRecommendation.updated_at.desc(),
                KeeperRecommendation.created_at.desc(),
            )
        ).first()

    latest_default = session.exec(
        statement.where(KeeperRecommendation.scenario_name == "Default").order_by(
            KeeperRecommendation.updated_at.desc(),
            KeeperRecommendation.created_at.desc(),
        )
    ).first()
    if latest_default is not None:
        return latest_default

    return session.exec(
        statement.order_by(
            KeeperRecommendation.updated_at.desc(),
            KeeperRecommendation.created_at.desc(),
        )
    ).first()


def _scenario_settings(
    *,
    league: League,
    base_settings: OptimizerSettings,
    name: str,
    **overrides: object,
) -> OptimizerSettings:
    values = {field_name: getattr(base_settings, field_name) for field_name in _SETTINGS_COPY_FIELDS}
    values.update(overrides)
    values["max_keepers"] = min(int(values["max_keepers"]), league.max_keepers, 4)
    values["max_keepers_per_position"] = min(
        int(values["max_keepers_per_position"]),
        league.max_keepers_per_position,
    )
    values["max_qb_keepers"] = min(int(values["max_qb_keepers"]), league.max_qb_keepers)
    return OptimizerSettings(league_id=league.id, name=name, **values)


def _build_scenario_comparison(
    session: Session,
    league_id: uuid.UUID,
    preset: ScenarioPreset,
    recommendations: list[KeeperRecommendation],
) -> ScenarioComparison:
    selected = [recommendation for recommendation in recommendations if recommendation.is_recommended]
    player_ids = {recommendation.player_id for recommendation in selected}
    teams = {
        team.id: team
        for team in session.exec(select(Team).where(Team.league_id == league_id)).all()
    }
    players = {
        player.id: player
        for player in session.exec(select(Player).where(Player.id.in_(player_ids))).all()
    }

    selected_by_team: dict[uuid.UUID, list[KeeperRecommendation]] = {team_id: [] for team_id in teams}
    for recommendation in selected:
        selected_by_team.setdefault(recommendation.team_id, []).append(recommendation)

    team_results = [
        _build_scenario_team_result(
            team=team,
            selected_recommendations=selected_by_team.get(team.id, []),
            players=players,
            scenario_name=preset.name,
        )
        for team in sorted(teams.values(), key=lambda team: (team.draft_slot or 99, team.name))
    ]

    return ScenarioComparison(
        scenario_name=preset.name,
        description=preset.description,
        strategic_notes=preset.strategic_notes,
        total_keeper_score=round(
            sum(team.total_keeper_score for team in team_results),
            3,
        ),
        teams=team_results,
    )


def _build_scenario_team_result(
    *,
    team: Team,
    selected_recommendations: list[KeeperRecommendation],
    players: dict[uuid.UUID, Player],
    scenario_name: str,
) -> ScenarioTeamResult:
    keepers = [
        ScenarioKeeper(
            player_id=recommendation.player_id,
            player_name=players[recommendation.player_id].full_name,
            position=players[recommendation.player_id].position,
            keeper_cost_pick=recommendation.keeper_cost_pick,
            keeper_cost_round=recommendation.keeper_cost_round,
            keeper_value=recommendation.keeper_value,
            keeper_score=recommendation.keeper_score,
            reason=recommendation.reason,
        )
        for recommendation in sorted(
            selected_recommendations,
            key=lambda recommendation: (
                recommendation.keeper_cost_pick
                if recommendation.keeper_cost_pick is not None
                else float("inf"),
                -(recommendation.keeper_score or 0),
            ),
        )
        if recommendation.player_id in players
    ]
    total_score = round(
        sum(keeper.keeper_score or 0 for keeper in keepers),
        3,
    )

    return ScenarioTeamResult(
        team_id=team.id,
        team_name=team.name,
        selected_keepers=keepers,
        total_keeper_score=total_score,
        picks_forfeited=[_format_forfeited_pick(keeper) for keeper in keepers],
        strategic_notes=_team_strategy_note(
            scenario_name=scenario_name,
            keeper_count=len(keepers),
            total_keeper_score=total_score,
            premium_pick_count=sum(
                1
                for keeper in keepers
                if keeper.keeper_cost_pick is not None and keeper.keeper_cost_pick <= 24
            ),
        ),
    )


def _format_forfeited_pick(keeper: ScenarioKeeper) -> str:
    if keeper.keeper_cost_pick is None:
        return "No pick"
    if keeper.keeper_cost_round is None:
        return f"Pick {keeper.keeper_cost_pick:g}"
    return f"R{keeper.keeper_cost_round:g} / Pick {keeper.keeper_cost_pick:g}"


def _team_strategy_note(
    *,
    scenario_name: str,
    keeper_count: int,
    total_keeper_score: float,
    premium_pick_count: int,
) -> str:
    if keeper_count == 0:
        return "No keepers selected; keep draft board flexibility intact."

    if scenario_name == "Rebuild":
        return f"Keep {keeper_count} value play(s) and preserve early draft volume."
    if scenario_name == "Win Now":
        return f"Lean into {keeper_count} starter(s) with {total_keeper_score:g} total keeper score."
    if scenario_name == "Superflex Heavy":
        return f"Prioritize quarterback leverage while forfeiting {premium_pick_count} premium pick(s)."
    if scenario_name == "Pure Value":
        return f"Capture surplus value with {keeper_count} keeper(s) and minimal narrative bias."
    return f"Balanced set of {keeper_count} keeper(s) worth {total_keeper_score:g} total score."


def _require_league(session: Session, league_id: uuid.UUID) -> League:
    league = session.get(League, league_id)
    if league is None:
        raise OptimizerInputError(f"League {league_id} was not found")
    return league


def _resolve_settings(
    session: Session,
    league: League,
    settings_id: uuid.UUID | None,
    *,
    user_id: uuid.UUID | None,
) -> tuple[OptimizerSettings, bool]:
    if settings_id is not None:
        settings = session.get(OptimizerSettings, settings_id)
        if settings is None or settings.league_id != league.id or settings.user_id != user_id:
            raise OptimizerInputError(f"Optimizer settings {settings_id} were not found")
        return settings, True

    settings = session.exec(
        select(OptimizerSettings).where(
            OptimizerSettings.league_id == league.id,
            OptimizerSettings.user_id == user_id,
        )
    ).first()
    if settings is not None:
        return settings, True

    defaults = session.exec(
        select(AppDefaultOptimizerSettings)
        .where(AppDefaultOptimizerSettings.is_active.is_(True))
        .order_by(AppDefaultOptimizerSettings.created_at.desc())
    ).first()
    if defaults is None:
        return OptimizerSettings(league_id=league.id, user_id=user_id), False
    return (
        OptimizerSettings(
            league_id=league.id,
            user_id=user_id,
            **{field_name: getattr(defaults, field_name) for field_name in _SETTINGS_COPY_FIELDS},
        ),
        False,
    )


def _resolve_adp_snapshot(
    session: Session,
    league: League,
    adp_snapshot_id: uuid.UUID | None,
) -> ADPSnapshot:
    if adp_snapshot_id is not None:
        snapshot = session.get(ADPSnapshot, adp_snapshot_id)
        if snapshot is None or snapshot.league_id != league.id:
            raise OptimizerInputError(f"ADP snapshot {adp_snapshot_id} was not found")
        return snapshot

    snapshot = session.exec(
        select(ADPSnapshot)
        .where(ADPSnapshot.league_id == league.id)
        .order_by(ADPSnapshot.snapshot_date.desc(), ADPSnapshot.created_at.desc())
    ).first()
    if snapshot is None:
        raise OptimizerInputError(f"League {league.id} has no ADP snapshot")
    return snapshot


def _round_for_pick(pick: float, team_count: int) -> int:
    return max(1, math.ceil(pick / max(team_count, 1)))


def _normalize_override(value: str | None) -> str:
    normalized = (value or AUTO_OVERRIDE).strip().lower()
    if normalized in {"force", "forced", "keep", "force_keep"}:
        return FORCE_KEEP_OVERRIDE
    if normalized in {"exclude", "excluded", "do_not_keep"}:
        return EXCLUDE_OVERRIDE
    return AUTO_OVERRIDE


def _normalize_position(position: str) -> str:
    return position.strip().upper()


def _normalize_status(status: str) -> str:
    return status.strip().lower().replace(" ", "_").replace("-", "_")
