import uuid
from typing import TYPE_CHECKING

from sqlmodel import Field, Relationship

from app.models.base import TimestampMixin

if TYPE_CHECKING:
    from app.models.league import Team
    from app.models.player import Player


class KeeperCandidate(TimestampMixin, table=True):
    __tablename__ = "keeper_candidates"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    team_id: uuid.UUID = Field(foreign_key="teams.id", index=True)
    player_id: uuid.UUID = Field(foreign_key="players.id", index=True)
    season_year: int = Field(index=True)
    keeper_cost: float = Field(default=0)
    projected_value: float | None = Field(default=None)
    notes: str | None = Field(default=None, max_length=500)

    team: "Team" = Relationship(back_populates="keeper_candidates")
    player: "Player" = Relationship(back_populates="keeper_candidates")
