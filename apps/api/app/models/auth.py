import uuid
from typing import TYPE_CHECKING

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, Relationship

from app.models.base import TimestampMixin

if TYPE_CHECKING:
    from app.models.league import Team
    from app.models.membership import LeagueMembership
    from app.models.mock_draft import MockDraftSession
    from app.models.optimizer import (
        KeeperRecommendation,
        ManualOverride,
        OptimizerSettings,
        TeamScenarioSelection,
    )


class User(TimestampMixin, table=True):
    __tablename__ = "users"
    __table_args__ = (UniqueConstraint("email", name="uq_users_email"),)

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    email: str = Field(index=True, max_length=255)
    alias: str | None = Field(default=None, max_length=120)
    password_hash: str = Field(max_length=255)
    role: str = Field(default="user", index=True, max_length=40)
    is_active: bool = Field(default=True, index=True)
    avatar_data_url: str | None = Field(default=None)

    optimizer_settings: list["OptimizerSettings"] = Relationship(back_populates="user")
    manual_overrides: list["ManualOverride"] = Relationship(back_populates="user")
    keeper_recommendations: list["KeeperRecommendation"] = Relationship(back_populates="user")
    scenario_selections: list["TeamScenarioSelection"] = Relationship(back_populates="user")
    teams: list["Team"] = Relationship(back_populates="user")
    mock_draft_sessions: list["MockDraftSession"] = Relationship(back_populates="user")
    memberships: list["LeagueMembership"] = Relationship(back_populates="user")


class AppDefaultOptimizerSettings(TimestampMixin, table=True):
    __tablename__ = "app_default_optimizer_settings"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str = Field(default="Default", max_length=120)
    is_active: bool = Field(default=True, index=True)
    max_keepers: int = Field(default=4)
    max_keepers_per_position: int = Field(default=2)
    max_qb_keepers: int = Field(default=1)
    minimum_keeper_value: float = Field(default=1)
    max_adp_cap: float | None = Field(default=None)
    minimum_keeper_score: float = Field(default=0)
    qb_weight: float = Field(default=1.75)
    rb_weight: float = Field(default=1.20)
    wr_weight: float = Field(default=1.00)
    te_weight: float = Field(default=1.10)
    k_weight: float = Field(default=0.10)
    def_weight: float = Field(default=0.10)
    qb_max_adp: float | None = Field(default=None)
    elite_qb_cutoff: float = Field(default=24)
    elite_qb_max_negative_edge: float = Field(default=12)
    talent_anchor: float = Field(default=180)
    talent_divisor: float = Field(default=15)
    starter_status_bonus: float = Field(default=3)
    bench_status_bonus: float = Field(default=1)
    ir_status_bonus: float = Field(default=0.5)
    enable_draft_slot_bonus: bool = Field(default=True)
    enable_qb_scarcity_bonus: bool = Field(default=True)
    enable_elite_player_bonus: bool = Field(default=True)
    elite_player_max_negative_edge: float = Field(default=12)
    budget_per_team: float | None = Field(default=None)
    max_keeper_salary_pct: float | None = Field(default=None)
