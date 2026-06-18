import uuid
from datetime import date, datetime
from typing import Any
from typing import TYPE_CHECKING

from sqlalchemy import Column, JSON, UniqueConstraint
from sqlmodel import Field, Relationship

from app.models.base import TimestampMixin

if TYPE_CHECKING:
    from app.models.adp import ADPSnapshot
    from app.models.auth import User
    from app.models.draft import DraftPick
    from app.models.keeper import KeeperCandidate
    from app.models.final_keeper import FinalKeeperSelection
    from app.models.keeper_outcome import KeeperOutcome
    from app.models.keeper_tenure import KeeperTenure
    from app.models.membership import LeagueMembership
    from app.models.mock_draft import MockDraftPick, MockDraftSession
    from app.models.optimizer import (
        KeeperRecommendation,
        ManualOverride,
        OptimizerSettings,
        TeamScenarioSelection,
    )
    from app.models.roster import FinalRosterEntry


class League(TimestampMixin, table=True):
    __tablename__ = "leagues"
    __table_args__ = (UniqueConstraint("name", "season_year", name="uq_leagues_name_season"),)

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str = Field(index=True, max_length=120)
    season_year: int = Field(index=True)
    created_by_user_id: uuid.UUID | None = Field(default=None, foreign_key="users.id", index=True)
    scoring_format: str = Field(default="superflex", max_length=80)
    draft_type: str = Field(default="snake", max_length=40)
    max_keepers: int = Field(default=4)
    max_keepers_per_position: int = Field(default=2)
    max_qb_keepers: int = Field(default=1)
    keeper_pick_deadline: date | None = Field(default=None)
    adp_lock_date: date | None = Field(default=None)
    regular_season_start_date: date | None = Field(default=None)
    draft_date: date | None = Field(default=None)
    keeper_reveal_date: date | None = Field(default=None)
    keepers_finalized: bool = Field(default=False)
    keepers_finalized_at: datetime | None = Field(default=None)
    keepers_finalized_by_user_id: uuid.UUID | None = Field(default=None, foreign_key="users.id")
    roster_settings: dict[str, Any] = Field(
        default_factory=dict,
        sa_column=Column(JSON, nullable=False),
    )
    draft_format: str = Field(default="snake", max_length=20)
    keeper_rules: dict[str, Any] = Field(
        default_factory=dict,
        sa_column=Column(JSON, nullable=False),
    )
    max_consecutive_keeper_seasons: int | None = Field(default=None)
    email_enabled: bool = Field(default=False)
    email_schedule: str = Field(default="none", max_length=20)
    email_last_sent: datetime | None = Field(default=None)

    teams: list["Team"] = Relationship(back_populates="league")
    memberships: list["LeagueMembership"] = Relationship(back_populates="league")
    draft_picks: list["DraftPick"] = Relationship(back_populates="league")
    final_roster_entries: list["FinalRosterEntry"] = Relationship(back_populates="league")
    adp_snapshots: list["ADPSnapshot"] = Relationship(back_populates="league")
    optimizer_settings: list["OptimizerSettings"] = Relationship(back_populates="league")
    manual_overrides: list["ManualOverride"] = Relationship(back_populates="league")
    keeper_recommendations: list["KeeperRecommendation"] = Relationship(back_populates="league")
    scenario_selections: list["TeamScenarioSelection"] = Relationship(back_populates="league")
    mock_draft_sessions: list["MockDraftSession"] = Relationship(back_populates="league")
    keeper_outcomes: list["KeeperOutcome"] = Relationship(back_populates="league")
    final_keeper_selections: list["FinalKeeperSelection"] = Relationship(back_populates="league")
    keeper_tenures: list["KeeperTenure"] = Relationship(back_populates="league")


class Team(TimestampMixin, table=True):
    __tablename__ = "teams"
    __table_args__ = (UniqueConstraint("league_id", "name", name="uq_teams_league_name"),)

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    league_id: uuid.UUID = Field(foreign_key="leagues.id", index=True)
    user_id: uuid.UUID | None = Field(default=None, foreign_key="users.id", index=True)
    name: str = Field(index=True, max_length=120)
    owner_name: str | None = Field(default=None, max_length=120)
    draft_slot: int | None = Field(default=None, index=True)

    league: "League" = Relationship(back_populates="teams")
    user: "User" = Relationship(back_populates="teams")
    keeper_candidates: list["KeeperCandidate"] = Relationship(back_populates="team")
    draft_picks: list["DraftPick"] = Relationship(back_populates="team")
    final_roster_entries: list["FinalRosterEntry"] = Relationship(back_populates="team")
    manual_overrides: list["ManualOverride"] = Relationship(back_populates="team")
    keeper_recommendations: list["KeeperRecommendation"] = Relationship(back_populates="team")
    mock_draft_sessions: list["MockDraftSession"] = Relationship(back_populates="user_team")
    mock_draft_picks: list["MockDraftPick"] = Relationship(back_populates="team")
    keeper_outcomes: list["KeeperOutcome"] = Relationship(back_populates="team")
    final_keeper_selections: list["FinalKeeperSelection"] = Relationship(back_populates="team")
    keeper_tenures: list["KeeperTenure"] = Relationship(back_populates="team")
