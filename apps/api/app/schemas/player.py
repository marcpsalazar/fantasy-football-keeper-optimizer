from datetime import datetime
import uuid

from pydantic import BaseModel, ConfigDict


class PlayerBase(BaseModel):
    external_id: str | None = None
    full_name: str
    position: str
    nfl_team: str | None = None


class PlayerCreate(PlayerBase):
    pass


class PlayerUpdate(BaseModel):
    external_id: str | None = None
    full_name: str | None = None
    position: str | None = None
    nfl_team: str | None = None


class PlayerRead(PlayerCreate):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
