import uuid
from typing import TYPE_CHECKING

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, Relationship

from app.models.base import TimestampMixin

if TYPE_CHECKING:
    from app.models.league import League, Team
    from app.models.player import Player


class KeeperOutcome(TimestampMixin, table=True):
    """End-of-season outcome for one keeper decision in one season.

    Records the actual finish (positional rank and fantasy points) of a player
    who was kept by a team, cross-referenced with the ADP and cost at the time
    of the keep decision.  Used to compute per-team and per-player ROI over time.
    """

    __tablename__ = "keeper_outcomes"
    __table_args__ = (
        UniqueConstraint(
            "league_id", "team_id", "player_id", "season_year",
            name="uq_keeper_outcomes_league_team_player_season",
        ),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    league_id: uuid.UUID = Field(foreign_key="leagues.id", index=True)
    team_id: uuid.UUID = Field(foreign_key="teams.id", index=True)
    player_id: uuid.UUID = Field(foreign_key="players.id", index=True)
    season_year: int = Field(index=True)

    # Keeper economics at the time of the keep decision
    # (populated from KeeperRecommendation when the outcome is imported)
    keeper_cost_pick: float | None = Field(default=None)
    keeper_cost_round: float | None = Field(default=None)
    adp_pick_at_keep: float | None = Field(default=None)
    adp_round_at_keep: float | None = Field(default=None)
    keeper_value_at_keep: float | None = Field(default=None)

    # Actual season outcome (supplied via end-of-season CSV import)
    finish_rank: int | None = Field(default=None)       # positional rank (1 = best at position)
    fantasy_points: float | None = Field(default=None)

    # Derived signals (computed at import time; can be overridden via CSV)
    met_adp_projection: bool | None = Field(default=None)
    is_bust: bool = Field(default=False)

    notes: str | None = Field(default=None, max_length=500)

    league: "League" = Relationship(back_populates="keeper_outcomes")
    team: "Team" = Relationship(back_populates="keeper_outcomes")
    player: "Player" = Relationship(back_populates="keeper_outcomes")
