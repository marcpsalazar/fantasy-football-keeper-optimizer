import uuid
from datetime import datetime
from typing import Any, TYPE_CHECKING

from sqlalchemy import Column, JSON, UniqueConstraint
from sqlmodel import Field, Relationship

from app.models.base import TimestampMixin

if TYPE_CHECKING:
    from app.models.adp import ADPSnapshot
    from app.models.auth import User
    from app.models.league import League, Team
    from app.models.player import Player


class MockDraftSession(TimestampMixin, table=True):
    __tablename__ = "mock_draft_sessions"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    league_id: uuid.UUID = Field(foreign_key="leagues.id", index=True)
    user_id: uuid.UUID | None = Field(default=None, foreign_key="users.id", index=True)
    user_team_id: uuid.UUID = Field(foreign_key="teams.id", index=True)
    adp_snapshot_id: uuid.UUID | None = Field(
        default=None,
        foreign_key="adp_snapshots.id",
        index=True,
    )
    status: str = Field(default="setup", index=True, max_length=40)
    pick_timer_seconds: int | None = Field(default=None)
    bot_config: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))
    keeper_context: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))
    strategy_plan: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))
    strategy_plan_cache_key: str | None = Field(default=None, max_length=160)
    strategy_plan_generated_at: datetime | None = Field(default=None)
    strategy_plan_error: str | None = Field(default=None, max_length=1000)
    draft_type: str = Field(default="snake", max_length=40)
    round_count: int = Field(default=16)
    completed_at: datetime | None = Field(default=None, index=True)

    league: "League" = Relationship(back_populates="mock_draft_sessions")
    user: "User" = Relationship(back_populates="mock_draft_sessions")
    user_team: "Team" = Relationship(back_populates="mock_draft_sessions")
    adp_snapshot: "ADPSnapshot" = Relationship(back_populates="mock_draft_sessions")
    picks: list["MockDraftPick"] = Relationship(back_populates="session")
    analysis: "MockDraftAnalysis" = Relationship(back_populates="session")


class MockDraftPick(TimestampMixin, table=True):
    __tablename__ = "mock_draft_picks"
    __table_args__ = (
        UniqueConstraint("session_id", "overall_pick", name="uq_mock_draft_picks_session_overall"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    session_id: uuid.UUID = Field(foreign_key="mock_draft_sessions.id", index=True)
    round: int = Field(index=True)
    pick_in_round: int = Field(index=True)
    overall_pick: int = Field(index=True)
    team_id: uuid.UUID = Field(foreign_key="teams.id", index=True)
    player_id: uuid.UUID = Field(foreign_key="players.id", index=True)
    source: str = Field(max_length=40, index=True)
    decision_time_ms: int | None = Field(default=None)
    bot_personality: str | None = Field(default=None, max_length=80)
    bot_difficulty: str | None = Field(default=None, max_length=40)
    reasoning_summary: str | None = Field(default=None, max_length=1000)

    session: "MockDraftSession" = Relationship(back_populates="picks")
    team: "Team" = Relationship(back_populates="mock_draft_picks")
    player: "Player" = Relationship(back_populates="mock_draft_picks")


class MockDraftAnalysis(TimestampMixin, table=True):
    __tablename__ = "mock_draft_analyses"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    session_id: uuid.UUID = Field(
        foreign_key="mock_draft_sessions.id",
        index=True,
        unique=True,
    )
    overall_letter_grade: str = Field(max_length=4)
    overall_numeric_score: int = Field(index=True)
    summary: str = Field(max_length=2000)
    strengths: list[dict[str, Any]] = Field(default_factory=list, sa_column=Column(JSON, nullable=False))
    weaknesses: list[dict[str, Any]] = Field(default_factory=list, sa_column=Column(JSON, nullable=False))
    pick_feedback: list[dict[str, Any]] = Field(default_factory=list, sa_column=Column(JSON, nullable=False))
    what_if_scenarios: list[dict[str, Any]] = Field(
        default_factory=list,
        sa_column=Column(JSON, nullable=False),
    )
    projected_rankings: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))
    future_advice: list[dict[str, Any]] = Field(default_factory=list, sa_column=Column(JSON, nullable=False))

    session: "MockDraftSession" = Relationship(back_populates="analysis")
