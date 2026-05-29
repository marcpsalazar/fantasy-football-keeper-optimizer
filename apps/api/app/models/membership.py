import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Column, Text, UniqueConstraint
from sqlmodel import Field, Relationship

from app.models.base import TimestampMixin

if TYPE_CHECKING:
    from app.models.auth import User
    from app.models.league import League


class LeagueMembership(TimestampMixin, table=True):
    __tablename__ = "league_memberships"
    __table_args__ = (UniqueConstraint("user_id", "league_id", name="uq_league_memberships_user_league"),)

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", index=True)
    league_id: uuid.UUID = Field(foreign_key="leagues.id", index=True)
    role: str = Field(default="member", index=True, max_length=40)
    avatar_data_url: str | None = Field(default=None, sa_column=Column(Text, nullable=True))

    user: "User" = Relationship(back_populates="memberships")
    league: "League" = Relationship(back_populates="memberships")
