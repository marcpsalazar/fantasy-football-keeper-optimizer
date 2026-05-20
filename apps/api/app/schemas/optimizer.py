from datetime import datetime
from typing import Literal
import uuid

from pydantic import BaseModel, ConfigDict, Field


class OptimizerSettingsBase(BaseModel):
    league_id: uuid.UUID
    name: str = "Default"
    max_keepers: int = 4
    max_keepers_per_position: int = 2
    max_qb_keepers: int = 1
    minimum_keeper_value: float = Field(default=1, ge=-5)
    max_adp_cap: float | None = None
    minimum_keeper_score: float = 0
    qb_weight: float = 1.75
    rb_weight: float = 1.20
    wr_weight: float = 1.00
    te_weight: float = 1.10
    k_weight: float = 0.10
    def_weight: float = 0.10
    qb_max_adp: float | None = None
    elite_qb_cutoff: float = 24
    elite_qb_max_negative_edge: float = 12
    talent_anchor: float = 180
    talent_divisor: float = 15
    starter_status_bonus: float = 3
    bench_status_bonus: float = 1
    ir_status_bonus: float = 0.5
    enable_draft_slot_bonus: bool = True
    enable_qb_scarcity_bonus: bool = True
    enable_elite_player_bonus: bool = True
    elite_player_max_negative_edge: float = 12


class OptimizerSettingsCreate(OptimizerSettingsBase):
    pass


class OptimizerSettingsUpdate(BaseModel):
    league_id: uuid.UUID | None = None
    name: str | None = None
    max_keepers: int | None = None
    max_keepers_per_position: int | None = None
    max_qb_keepers: int | None = None
    minimum_keeper_value: float | None = Field(default=None, ge=-5)
    max_adp_cap: float | None = None
    minimum_keeper_score: float | None = None
    qb_weight: float | None = None
    rb_weight: float | None = None
    wr_weight: float | None = None
    te_weight: float | None = None
    k_weight: float | None = None
    def_weight: float | None = None
    qb_max_adp: float | None = None
    elite_qb_cutoff: float | None = None
    elite_qb_max_negative_edge: float | None = None
    talent_anchor: float | None = None
    talent_divisor: float | None = None
    starter_status_bonus: float | None = None
    bench_status_bonus: float | None = None
    ir_status_bonus: float | None = None
    enable_draft_slot_bonus: bool | None = None
    enable_qb_scarcity_bonus: bool | None = None
    enable_elite_player_bonus: bool | None = None
    elite_player_max_negative_edge: float | None = None


class OptimizerSettingsRead(OptimizerSettingsBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


OverrideType = Literal["auto", "force_keep", "exclude"]


class ManualOverrideBase(BaseModel):
    league_id: uuid.UUID
    team_id: uuid.UUID
    player_id: uuid.UUID
    override_type: OverrideType = "auto"
    notes: str | None = None


class ManualOverrideCreate(ManualOverrideBase):
    pass


class ManualOverrideUpdate(BaseModel):
    league_id: uuid.UUID | None = None
    team_id: uuid.UUID | None = None
    player_id: uuid.UUID | None = None
    override_type: OverrideType | None = None
    notes: str | None = None


class ManualOverrideRead(ManualOverrideBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class KeeperRecommendationBase(BaseModel):
    league_id: uuid.UUID
    team_id: uuid.UUID
    player_id: uuid.UUID
    settings_id: uuid.UUID | None = None
    adp_snapshot_id: uuid.UUID | None = None
    scenario_name: str = "Default"
    keeper_cost_pick: float | None = None
    keeper_cost_round: float | None = None
    adp_pick: float | None = None
    adp_round: float | None = None
    keeper_value: float | None = None
    keeper_score: float | None = None
    is_eligible: bool = True
    is_recommended: bool = False
    reason: str | None = None


class KeeperRecommendationCreate(KeeperRecommendationBase):
    pass


class KeeperRecommendationUpdate(BaseModel):
    league_id: uuid.UUID | None = None
    team_id: uuid.UUID | None = None
    player_id: uuid.UUID | None = None
    settings_id: uuid.UUID | None = None
    adp_snapshot_id: uuid.UUID | None = None
    scenario_name: str | None = None
    keeper_cost_pick: float | None = None
    keeper_cost_round: float | None = None
    adp_pick: float | None = None
    adp_round: float | None = None
    keeper_value: float | None = None
    keeper_score: float | None = None
    is_eligible: bool | None = None
    is_recommended: bool | None = None
    reason: str | None = None


class KeeperRecommendationRead(KeeperRecommendationBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
