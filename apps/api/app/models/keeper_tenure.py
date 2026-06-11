import uuid
from typing import TYPE_CHECKING

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, Relationship

from app.models.base import TimestampMixin

if TYPE_CHECKING:
    from app.models.league import League, Team
    from app.models.player import Player


class KeeperTenure(TimestampMixin, table=True):
    """Tracks how many consecutive seasons a team has kept a given player.

    One row per (league, team, player) triple. The counter is managed via
    admin CSV backfill. When max_consecutive_keeper_seasons is set on the
    league, players at or above the limit are marked ineligible by the
    optimizer.
    """

    __tablename__ = "keeper_tenures"
    __table_args__ = (
        UniqueConstraint(
            "league_id", "team_id", "player_id",
            name="uq_keeper_tenures_league_team_player",
        ),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    league_id: uuid.UUID = Field(foreign_key="leagues.id", index=True)
    team_id: uuid.UUID = Field(foreign_key="teams.id", index=True)
    player_id: uuid.UUID = Field(foreign_key="players.id", index=True)
    consecutive_seasons: int = Field(default=1)
    last_kept_season_year: int | None = Field(default=None)

    league: "League" = Relationship(back_populates="keeper_tenures")
    team: "Team" = Relationship(back_populates="keeper_tenures")
    player: "Player" = Relationship(back_populates="keeper_tenures")
