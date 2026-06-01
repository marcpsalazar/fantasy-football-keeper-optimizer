import uuid

from pydantic import BaseModel, ConfigDict


class TeamDraftHistoryRead(BaseModel):
    team_id: uuid.UUID
    team_name: str | None = None
    owner_name: str | None = None
    seasons_found: list[int]
    seasons_with_data: int
    total_picks_analyzed: int
    position_pick_rates: dict[str, float]
    early_round_positions: dict[str, float]
    mid_round_positions: dict[str, float]
    late_round_positions: dict[str, float]
    adp_tendency: float
    position_adp_tendencies: dict[str, float]
    keeper_positions: list[str]
    keeper_count_avg: float

    model_config = ConfigDict(from_attributes=True)
