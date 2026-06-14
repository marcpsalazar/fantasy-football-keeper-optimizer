import uuid
from typing import TYPE_CHECKING

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, Relationship

from app.models.base import TimestampMixin

if TYPE_CHECKING:
    from app.models.league import League
    from app.models.player import Player


class PlayerWatchlist(TimestampMixin, table=True):
    __tablename__ = "player_watchlists"
    __table_args__ = (
        UniqueConstraint("user_id", "league_id", "player_id", name="uq_player_watchlists_user_league_player"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(index=True)
    league_id: uuid.UUID = Field(foreign_key="leagues.id", index=True)
    player_id: uuid.UUID = Field(foreign_key="players.id", index=True)

    league: "League" = Relationship()
    player: "Player" = Relationship()
