from datetime import datetime
import uuid

from pydantic import BaseModel, ConfigDict


class FinalRosterEntryBase(BaseModel):
    league_id: uuid.UUID
    team_id: uuid.UUID
    player_id: uuid.UUID
    season_year: int
    position: str
    roster_status: str = "Bench"


class FinalRosterEntryCreate(FinalRosterEntryBase):
    pass


class FinalRosterEntryUpdate(BaseModel):
    league_id: uuid.UUID | None = None
    team_id: uuid.UUID | None = None
    player_id: uuid.UUID | None = None
    season_year: int | None = None
    position: str | None = None
    roster_status: str | None = None


class FinalRosterEntryRead(FinalRosterEntryBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
