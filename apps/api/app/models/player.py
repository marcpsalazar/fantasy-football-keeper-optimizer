import uuid
from datetime import date
from typing import TYPE_CHECKING

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, Relationship

from app.models.base import TimestampMixin

if TYPE_CHECKING:
    from app.models.adp import ADPEntry
    from app.models.draft import DraftPick
    from app.models.final_keeper import FinalKeeperSelection
    from app.models.keeper import KeeperCandidate
    from app.models.keeper_outcome import KeeperOutcome
    from app.models.mock_draft import MockDraftPick
    from app.models.optimizer import KeeperRecommendation, ManualOverride
    from app.models.roster import FinalRosterEntry


class Player(TimestampMixin, table=True):
    __tablename__ = "players"
    __table_args__ = (
        UniqueConstraint("full_name", "position", "nfl_team", name="uq_players_identity"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    external_id: str | None = Field(default=None, index=True, max_length=80)
    full_name: str = Field(index=True, max_length=160)
    position: str = Field(index=True, max_length=10)
    nfl_team: str | None = Field(default=None, index=True, max_length=10)
    birth_date: date | None = Field(default=None)

    keeper_candidates: list["KeeperCandidate"] = Relationship(back_populates="player")
    draft_picks: list["DraftPick"] = Relationship(back_populates="player")
    final_roster_entries: list["FinalRosterEntry"] = Relationship(back_populates="player")
    adp_entries: list["ADPEntry"] = Relationship(back_populates="player")
    manual_overrides: list["ManualOverride"] = Relationship(back_populates="player")
    keeper_recommendations: list["KeeperRecommendation"] = Relationship(back_populates="player")
    mock_draft_picks: list["MockDraftPick"] = Relationship(back_populates="player")
    keeper_outcomes: list["KeeperOutcome"] = Relationship(back_populates="player")
    final_keeper_selections: list["FinalKeeperSelection"] = Relationship(back_populates="player")
