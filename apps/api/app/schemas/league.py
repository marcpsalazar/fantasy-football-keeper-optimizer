from datetime import date, datetime
import uuid
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class LeagueBase(BaseModel):
    name: str
    season_year: int
    scoring_format: str = "superflex"
    draft_type: str = "snake"
    max_keepers: int = 4
    max_keepers_per_position: int = 2
    max_qb_keepers: int = 1
    keeper_pick_deadline: date | None = None
    regular_season_start_date: date | None = None
    draft_date: date | None = None
    keeper_reveal_date: date | None = None
    roster_settings: dict[str, Any] = Field(default_factory=dict)
    keeper_rules: dict[str, Any] = Field(default_factory=dict)


class LeagueCreate(LeagueBase):
    pass


class LeagueUpdate(BaseModel):
    name: str | None = None
    season_year: int | None = None
    scoring_format: str | None = None
    draft_type: str | None = None
    max_keepers: int | None = None
    max_keepers_per_position: int | None = None
    max_qb_keepers: int | None = None
    keeper_pick_deadline: date | None = None
    regular_season_start_date: date | None = None
    draft_date: date | None = None
    keeper_reveal_date: date | None = None
    roster_settings: dict[str, Any] | None = None
    keeper_rules: dict[str, Any] | None = None


class LeagueRead(LeagueCreate):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TeamBase(BaseModel):
    league_id: uuid.UUID
    user_id: uuid.UUID | None = None
    name: str
    owner_name: str | None = None
    draft_slot: int | None = None


class TeamCreate(TeamBase):
    pass


class TeamUpdate(BaseModel):
    league_id: uuid.UUID | None = None
    user_id: uuid.UUID | None = None
    name: str | None = None
    owner_name: str | None = None
    draft_slot: int | None = None


class TeamRead(TeamCreate):
    id: uuid.UUID
    user_email: str | None = None
    user_alias: str | None = None
    owner_display_name: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
