import uuid
from typing import TYPE_CHECKING

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, Relationship

from app.models.base import TimestampMixin

if TYPE_CHECKING:
    from app.models.league import League, Team
    from app.models.player import Player


class DraftPick(TimestampMixin, table=True):
    __tablename__ = "draft_picks"
    __table_args__ = (
        UniqueConstraint(
            "league_id",
            "season_year",
            "overall_pick",
            name="uq_draft_picks_league_season_overall",
        ),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    league_id: uuid.UUID = Field(foreign_key="leagues.id", index=True)
    team_id: uuid.UUID = Field(foreign_key="teams.id", index=True)
    player_id: uuid.UUID = Field(foreign_key="players.id", index=True)
    season_year: int = Field(index=True)
    round: int = Field(index=True)
    overall_pick: int = Field(index=True)
    pick_in_round: int | None = Field(default=None)
    position: str = Field(index=True, max_length=10)

    league: "League" = Relationship(back_populates="draft_picks")
    team: "Team" = Relationship(back_populates="draft_picks")
    player: "Player" = Relationship(back_populates="draft_picks")
