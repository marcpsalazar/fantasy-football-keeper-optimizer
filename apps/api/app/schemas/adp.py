from datetime import date, datetime
import uuid

from pydantic import BaseModel, ConfigDict


class ADPSnapshotBase(BaseModel):
    league_id: uuid.UUID
    season_year: int
    name: str
    source: str
    format_type: str = "superflex"
    snapshot_date: date
    notes: str | None = None


class ADPSnapshotCreate(ADPSnapshotBase):
    pass


class ADPSnapshotUpdate(BaseModel):
    league_id: uuid.UUID | None = None
    season_year: int | None = None
    name: str | None = None
    source: str | None = None
    format_type: str | None = None
    snapshot_date: date | None = None
    notes: str | None = None


class ADPSnapshotRead(ADPSnapshotBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ADPEntryBase(BaseModel):
    snapshot_id: uuid.UUID
    player_id: uuid.UUID
    position: str
    adp_pick: float
    adp_round: float | None = None
    source_note: str | None = None


class ADPEntryCreate(ADPEntryBase):
    pass


class ADPEntryUpdate(BaseModel):
    snapshot_id: uuid.UUID | None = None
    player_id: uuid.UUID | None = None
    position: str | None = None
    adp_pick: float | None = None
    adp_round: float | None = None
    source_note: str | None = None


class ADPEntryRead(ADPEntryBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
