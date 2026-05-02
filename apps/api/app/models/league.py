import uuid
from typing import Any
from typing import TYPE_CHECKING

from sqlalchemy import Column, JSON, UniqueConstraint
from sqlmodel import Field, Relationship

from app.models.base import TimestampMixin

if TYPE_CHECKING:
    from app.models.adp import ADPSnapshot
    from app.models.draft import DraftPick
    from app.models.keeper import KeeperCandidate
    from app.models.optimizer import KeeperRecommendation, ManualOverride, OptimizerSettings
    from app.models.roster import FinalRosterEntry


class League(TimestampMixin, table=True):
    __tablename__ = "leagues"
    __table_args__ = (UniqueConstraint("name", "season_year", name="uq_leagues_name_season"),)

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str = Field(index=True, max_length=120)
    season_year: int = Field(index=True)
    scoring_format: str = Field(default="superflex", max_length=80)
    draft_type: str = Field(default="snake", max_length=40)
    max_keepers: int = Field(default=4)
    max_keepers_per_position: int = Field(default=2)
    max_qb_keepers: int = Field(default=1)
    roster_settings: dict[str, Any] = Field(
        default_factory=dict,
        sa_column=Column(JSON, nullable=False),
    )
    keeper_rules: dict[str, Any] = Field(
        default_factory=dict,
        sa_column=Column(JSON, nullable=False),
    )

    teams: list["Team"] = Relationship(back_populates="league")
    draft_picks: list["DraftPick"] = Relationship(back_populates="league")
    final_roster_entries: list["FinalRosterEntry"] = Relationship(back_populates="league")
    adp_snapshots: list["ADPSnapshot"] = Relationship(back_populates="league")
    optimizer_settings: list["OptimizerSettings"] = Relationship(back_populates="league")
    manual_overrides: list["ManualOverride"] = Relationship(back_populates="league")
    keeper_recommendations: list["KeeperRecommendation"] = Relationship(back_populates="league")


class Team(TimestampMixin, table=True):
    __tablename__ = "teams"
    __table_args__ = (UniqueConstraint("league_id", "name", name="uq_teams_league_name"),)

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    league_id: uuid.UUID = Field(foreign_key="leagues.id", index=True)
    name: str = Field(index=True, max_length=120)
    owner_name: str | None = Field(default=None, max_length=120)
    draft_slot: int | None = Field(default=None, index=True)

    league: "League" = Relationship(back_populates="teams")
    keeper_candidates: list["KeeperCandidate"] = Relationship(back_populates="team")
    draft_picks: list["DraftPick"] = Relationship(back_populates="team")
    final_roster_entries: list["FinalRosterEntry"] = Relationship(back_populates="team")
    manual_overrides: list["ManualOverride"] = Relationship(back_populates="team")
    keeper_recommendations: list["KeeperRecommendation"] = Relationship(back_populates="team")
