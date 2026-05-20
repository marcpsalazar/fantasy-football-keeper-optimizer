import uuid
from typing import TYPE_CHECKING

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, Relationship

from app.models.base import TimestampMixin

if TYPE_CHECKING:
    from app.models.adp import ADPSnapshot
    from app.models.auth import User
    from app.models.league import League, Team
    from app.models.player import Player


class OptimizerSettings(TimestampMixin, table=True):
    __tablename__ = "optimizer_settings"
    __table_args__ = (
        UniqueConstraint("league_id", "user_id", "name", name="uq_optimizer_settings_league_user_name"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    league_id: uuid.UUID = Field(foreign_key="leagues.id", index=True)
    user_id: uuid.UUID | None = Field(default=None, foreign_key="users.id", index=True)
    name: str = Field(default="Default", index=True, max_length=120)
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

    league: "League" = Relationship(back_populates="optimizer_settings")
    user: "User" = Relationship(back_populates="optimizer_settings")
    keeper_recommendations: list["KeeperRecommendation"] = Relationship(back_populates="settings")


class ManualOverride(TimestampMixin, table=True):
    __tablename__ = "manual_overrides"
    __table_args__ = (
        UniqueConstraint(
            "league_id",
            "user_id",
            "team_id",
            "player_id",
            name="uq_manual_overrides_league_user_team_player",
        ),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    league_id: uuid.UUID = Field(foreign_key="leagues.id", index=True)
    user_id: uuid.UUID | None = Field(default=None, foreign_key="users.id", index=True)
    team_id: uuid.UUID = Field(foreign_key="teams.id", index=True)
    player_id: uuid.UUID = Field(foreign_key="players.id", index=True)
    override_type: str = Field(default="auto", index=True, max_length=40)
    notes: str | None = Field(default=None, max_length=500)

    league: "League" = Relationship(back_populates="manual_overrides")
    user: "User" = Relationship(back_populates="manual_overrides")
    team: "Team" = Relationship(back_populates="manual_overrides")
    player: "Player" = Relationship(back_populates="manual_overrides")


class KeeperRecommendation(TimestampMixin, table=True):
    __tablename__ = "keeper_recommendations"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    league_id: uuid.UUID = Field(foreign_key="leagues.id", index=True)
    user_id: uuid.UUID | None = Field(default=None, foreign_key="users.id", index=True)
    team_id: uuid.UUID = Field(foreign_key="teams.id", index=True)
    player_id: uuid.UUID = Field(foreign_key="players.id", index=True)
    settings_id: uuid.UUID | None = Field(
        default=None,
        foreign_key="optimizer_settings.id",
        index=True,
    )
    adp_snapshot_id: uuid.UUID | None = Field(
        default=None,
        foreign_key="adp_snapshots.id",
        index=True,
    )
    scenario_name: str = Field(default="Default", index=True, max_length=120)
    keeper_cost_pick: float | None = Field(default=None)
    keeper_cost_round: float | None = Field(default=None)
    adp_pick: float | None = Field(default=None)
    adp_round: float | None = Field(default=None)
    keeper_value: float | None = Field(default=None)
    keeper_score: float | None = Field(default=None)
    is_eligible: bool = Field(default=True, index=True)
    is_recommended: bool = Field(default=False, index=True)
    reason: str | None = Field(default=None, max_length=1000)

    league: "League" = Relationship(back_populates="keeper_recommendations")
    user: "User" = Relationship(back_populates="keeper_recommendations")
    team: "Team" = Relationship(back_populates="keeper_recommendations")
    player: "Player" = Relationship(back_populates="keeper_recommendations")
    settings: "OptimizerSettings" = Relationship(back_populates="keeper_recommendations")
    adp_snapshot: "ADPSnapshot" = Relationship()


class TeamScenarioSelection(TimestampMixin, table=True):
    __tablename__ = "team_scenario_selections"
    __table_args__ = (
        UniqueConstraint(
            "league_id",
            "user_id",
            "team_id",
            name="uq_team_scenario_selections_league_user_team",
        ),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    league_id: uuid.UUID = Field(foreign_key="leagues.id", index=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", index=True)
    team_id: uuid.UUID = Field(foreign_key="teams.id", index=True)
    scenario_name: str = Field(max_length=120)

    league: "League" = Relationship(back_populates="scenario_selections")
    user: "User" = Relationship(back_populates="scenario_selections")
    team: "Team" = Relationship()
