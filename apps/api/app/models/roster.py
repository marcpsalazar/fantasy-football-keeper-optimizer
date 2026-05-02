import uuid
from typing import TYPE_CHECKING

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, Relationship

from app.models.base import TimestampMixin

if TYPE_CHECKING:
    from app.models.league import League, Team
    from app.models.player import Player


class FinalRosterEntry(TimestampMixin, table=True):
    __tablename__ = "final_roster_entries"
    __table_args__ = (
        UniqueConstraint(
            "league_id",
            "team_id",
            "player_id",
            "season_year",
            name="uq_final_rosters_league_team_player_season",
        ),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    league_id: uuid.UUID = Field(foreign_key="leagues.id", index=True)
    team_id: uuid.UUID = Field(foreign_key="teams.id", index=True)
    player_id: uuid.UUID = Field(foreign_key="players.id", index=True)
    season_year: int = Field(index=True)
    position: str = Field(index=True, max_length=10)
    roster_status: str = Field(default="Bench", index=True, max_length=40)

    league: "League" = Relationship(back_populates="final_roster_entries")
    team: "Team" = Relationship(back_populates="final_roster_entries")
    player: "Player" = Relationship(back_populates="final_roster_entries")
