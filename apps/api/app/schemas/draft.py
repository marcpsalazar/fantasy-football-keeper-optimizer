from datetime import datetime
import uuid

from pydantic import BaseModel, ConfigDict


class DraftPickBase(BaseModel):
    league_id: uuid.UUID
    team_id: uuid.UUID
    player_id: uuid.UUID
    season_year: int
    round: int
    overall_pick: int
    pick_in_round: int | None = None
    position: str


class DraftPickCreate(DraftPickBase):
    pass


class DraftPickUpdate(BaseModel):
    league_id: uuid.UUID | None = None
    team_id: uuid.UUID | None = None
    player_id: uuid.UUID | None = None
    season_year: int | None = None
    round: int | None = None
    overall_pick: int | None = None
    pick_in_round: int | None = None
    position: str | None = None


class DraftPickRead(DraftPickBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
