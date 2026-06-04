"""Multi-year keeper value window projection service.

Given a player's current ADP, keeper cost, age, and position, projects
how their keep value evolves over the next 3 seasons using position-specific
aging curves, then identifies the "value window" — the years where keeping
is still positive expected value.
"""
from __future__ import annotations

import math
import uuid
from dataclasses import dataclass
from datetime import date
from typing import Any

from sqlmodel import Session, select

from app.models import KeeperRecommendation, League, OptimizerSettings, Player, Team
from app.services.optimizer import latest_recommendation_batch


# ---------------------------------------------------------------------------
# Aging curves: ADP-round degradation per year of player age
# Positive = ADP worsens (goes up), meaning the player is less valuable to draft.
# ---------------------------------------------------------------------------

# Each curve maps age → adp_rounds_lost_next_year.
# For ages not in the table, we interpolate using the nearest boundary.
_QB_CURVE: dict[int, float] = {
    22: 0.2, 23: 0.2, 24: 0.2, 25: 0.2, 26: 0.2, 27: 0.2,
    28: 0.3, 29: 0.3, 30: 0.3, 31: 0.3, 32: 0.5,
    33: 0.8, 34: 1.2, 35: 1.5, 36: 2.0, 37: 2.5,
}

_RB_CURVE: dict[int, float] = {
    21: 0.3, 22: 0.3, 23: 0.3, 24: 0.4, 25: 0.4, 26: 0.5,
    27: 0.8, 28: 1.2, 29: 1.8, 30: 2.5, 31: 3.0, 32: 3.5,
}

_WR_CURVE: dict[int, float] = {
    21: 0.2, 22: 0.2, 23: 0.2, 24: 0.2, 25: 0.3, 26: 0.3,
    27: 0.4, 28: 0.5, 29: 0.6, 30: 0.8, 31: 1.2, 32: 1.8,
    33: 2.2, 34: 2.8,
}

_TE_CURVE: dict[int, float] = {
    22: 0.2, 23: 0.2, 24: 0.2, 25: 0.2, 26: 0.3, 27: 0.3,
    28: 0.4, 29: 0.5, 30: 0.6, 31: 0.8, 32: 1.2, 33: 1.8,
    34: 2.2,
}

_DEFAULT_CURVE: dict[int, float] = {
    22: 0.3, 23: 0.3, 24: 0.3, 25: 0.4, 26: 0.5, 27: 0.6,
    28: 0.8, 29: 1.0, 30: 1.3, 31: 1.6, 32: 2.0,
}

_CURVES: dict[str, dict[int, float]] = {
    "QB": _QB_CURVE,
    "RB": _RB_CURVE,
    "WR": _WR_CURVE,
    "TE": _TE_CURVE,
}

_PROJECTION_YEARS = 3


def _adp_degradation(position: str, age: int) -> float:
    """Return how many ADP rounds the player is expected to lose next season."""
    curve = _CURVES.get(position, _DEFAULT_CURVE)
    ages = sorted(curve.keys())
    if not ages:
        return 1.0
    if age <= ages[0]:
        return curve[ages[0]]
    if age >= ages[-1]:
        return curve[ages[-1]]
    # Linear interpolation between adjacent table entries.
    lo = max(a for a in ages if a <= age)
    hi = min(a for a in ages if a >= age)
    if lo == hi:
        return curve[lo]
    t = (age - lo) / (hi - lo)
    return curve[lo] + t * (curve[hi] - curve[lo])


def _current_age(birth_date: date) -> int:
    today = date.today()
    age = today.year - birth_date.year
    if (today.month, today.day) < (birth_date.month, birth_date.day):
        age -= 1
    return age


@dataclass(frozen=True)
class ValueWindowYear:
    year_offset: int          # 0 = current season, 1 = next, …
    player_age: int | None
    keeper_cost_round: float  # what you pay in picks to keep
    projected_adp_round: float
    projected_keeper_value: float  # cost_round − adp_round (+ = value)
    is_value: bool             # True when projected_keeper_value >= minimum_keeper_value


@dataclass(frozen=True)
class ValueWindowResult:
    player_id: str
    player_name: str
    position: str
    current_age: int | None
    has_age_data: bool
    minimum_keeper_value: float
    team_count: int
    years: list[ValueWindowYear]
    # Last year_offset where is_value is True (None = not a value keeper even now)
    optimal_keep_through_year: int | None


def compute_value_window(
    *,
    player_id: str,
    player_name: str,
    position: str,
    birth_date: date | None,
    current_adp_round: float,
    current_keeper_cost_round: float,
    team_count: int,
    minimum_keeper_value: float = 1.0,
    # +1 = cost round escalates 1 round per year (standard keeper rule)
    cost_escalation_per_year: float = 1.0,
) -> ValueWindowResult:
    has_age = birth_date is not None
    current_age = _current_age(birth_date) if birth_date else None

    years: list[ValueWindowYear] = []
    adp_round = current_adp_round
    player_age = current_age

    for offset in range(_PROJECTION_YEARS + 1):
        cost_round = current_keeper_cost_round + offset * cost_escalation_per_year
        keeper_value = cost_round - adp_round
        is_val = keeper_value >= minimum_keeper_value

        years.append(ValueWindowYear(
            year_offset=offset,
            player_age=player_age,
            keeper_cost_round=round(cost_round, 1),
            projected_adp_round=round(adp_round, 1),
            projected_keeper_value=round(keeper_value, 1),
            is_value=is_val,
        ))

        # Advance ADP for next year using aging curve at this age
        if has_age and player_age is not None:
            degradation = _adp_degradation(position, player_age)
            adp_round = adp_round + degradation
            player_age += 1
        else:
            # Without age data we assume flat ADP — cost escalation dominates
            adp_round = adp_round

    # Optimal through = last offset where the player is a value keep
    value_offsets = [y.year_offset for y in years if y.is_value]
    optimal_through = max(value_offsets) if value_offsets else None

    return ValueWindowResult(
        player_id=player_id,
        player_name=player_name,
        position=position,
        current_age=current_age,
        has_age_data=has_age,
        minimum_keeper_value=minimum_keeper_value,
        team_count=team_count,
        years=years,
        optimal_keep_through_year=optimal_through,
    )


def get_value_window(
    session: Session,
    league_id: uuid.UUID,
    recommendation_id: uuid.UUID,
) -> ValueWindowResult | None:
    """Load a KeeperRecommendation by ID and compute its value window."""
    rec = session.get(KeeperRecommendation, recommendation_id)
    if rec is None or rec.league_id != league_id:
        return None
    if rec.adp_round is None or rec.keeper_cost_round is None:
        return None

    player = session.get(Player, rec.player_id)
    if player is None:
        return None

    league = session.get(League, league_id)
    if league is None:
        return None

    teams = session.exec(select(Team).where(Team.league_id == league_id)).all()
    team_count = max(len(teams), 1)

    minimum_keeper_value = 1.0
    if rec.settings_id:
        settings = session.get(OptimizerSettings, rec.settings_id)
        if settings:
            minimum_keeper_value = settings.minimum_keeper_value

    return compute_value_window(
        player_id=str(player.id),
        player_name=player.full_name,
        position=player.position,
        birth_date=player.birth_date,
        current_adp_round=rec.adp_round,
        current_keeper_cost_round=rec.keeper_cost_round,
        team_count=team_count,
        minimum_keeper_value=minimum_keeper_value,
    )


def value_window_to_dict(result: ValueWindowResult) -> dict[str, Any]:
    return {
        "player_id": result.player_id,
        "player_name": result.player_name,
        "position": result.position,
        "current_age": result.current_age,
        "has_age_data": result.has_age_data,
        "minimum_keeper_value": result.minimum_keeper_value,
        "team_count": result.team_count,
        "optimal_keep_through_year": result.optimal_keep_through_year,
        "years": [
            {
                "year_offset": y.year_offset,
                "player_age": y.player_age,
                "keeper_cost_round": y.keeper_cost_round,
                "projected_adp_round": y.projected_adp_round,
                "projected_keeper_value": y.projected_keeper_value,
                "is_value": y.is_value,
            }
            for y in result.years
        ],
    }
