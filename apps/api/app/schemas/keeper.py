import uuid

from pydantic import BaseModel, ConfigDict


class KeeperCandidateCreate(BaseModel):
    team_id: uuid.UUID
    player_id: uuid.UUID
    season_year: int
    keeper_cost: float = 0
    projected_value: float | None = None
    notes: str | None = None


class KeeperCandidateRead(KeeperCandidateCreate):
    id: uuid.UUID

    model_config = ConfigDict(from_attributes=True)

