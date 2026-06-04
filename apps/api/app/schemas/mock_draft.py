from datetime import datetime
from typing import Any, Literal
import uuid

from pydantic import BaseModel, ConfigDict, Field, field_validator


MockDraftStatus = Literal["setup", "in_progress", "paused", "complete", "abandoned"]
MockDraftPickSource = Literal["user", "bot", "keeper_forfeit", "auto_timeout"]


class MockDraftCreate(BaseModel):
    adp_snapshot_id: uuid.UUID | None = None
    scenario_name: str | None = None
    pick_timer_seconds: Literal[30, 60, 90, 120] | None = None
    bot_config: dict[str, Any] = Field(default_factory=dict)
    round_count: int | None = Field(default=None, ge=1, le=30)


class MockDraftUpdate(BaseModel):
    pick_timer_seconds: Literal[30, 60, 90, 120] | None = None
    bot_config: dict[str, Any] | None = None


class MockDraftPickCreate(BaseModel):
    player_id: uuid.UUID
    decision_time_ms: int | None = Field(default=None, ge=0)


class MockDraftPickRead(BaseModel):
    id: uuid.UUID
    session_id: uuid.UUID
    round: int
    pick_in_round: int
    overall_pick: int
    team_id: uuid.UUID
    team_name: str | None = None
    player_id: uuid.UUID
    player_name: str | None = None
    position: str | None = None
    nfl_team: str | None = None
    source: str
    decision_time_ms: int | None = None
    bot_personality: str | None = None
    bot_difficulty: str | None = None
    reasoning_summary: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class MockDraftBoardSlot(BaseModel):
    round: int
    pick_in_round: int
    overall_pick: int
    team_id: uuid.UUID | None = None
    team_name: str | None = None
    status: Literal["Open", "Keeper", "Drafted"]
    pick: MockDraftPickRead | None = None


class MockDraftAvailablePlayer(BaseModel):
    player_id: uuid.UUID
    player_name: str
    position: str
    nfl_team: str | None = None
    adp_pick: float | None = None
    adp_round: float | None = None
    risk: float | None = None
    projection: float | None = None
    image_url: str | None = None


class MockDraftRosterNeed(BaseModel):
    slot: str
    filled: int
    target: int
    remaining: int


class MockDraftAnalysisRead(BaseModel):
    id: uuid.UUID
    session_id: uuid.UUID
    overall_letter_grade: str
    overall_numeric_score: int
    summary: str
    strengths: list[dict[str, Any]]
    weaknesses: list[dict[str, Any]]
    pick_feedback: list[dict[str, Any]]
    what_if_scenarios: list[dict[str, Any]]
    projected_rankings: dict[str, Any]
    future_advice: list[dict[str, Any]]
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class MockDraftStrategyPlanRead(BaseModel):
    summary: str = ""
    round_plan: list[dict[str, Any]] = Field(default_factory=list)
    position_priorities: list[dict[str, Any]] = Field(default_factory=list)
    targets: list[dict[str, Any]] = Field(default_factory=list)
    fades: list[dict[str, Any]] = Field(default_factory=list)
    contingencies: list[dict[str, Any]] = Field(default_factory=list)
    generated_at: datetime | None = None
    cache_key: str | None = None
    error: str | None = None
    ai_used: bool = False
    model: str | None = None


class MockDraftSessionRead(BaseModel):
    id: uuid.UUID
    league_id: uuid.UUID
    user_id: uuid.UUID | None
    user_team_id: uuid.UUID
    user_team_name: str | None = None
    adp_snapshot_id: uuid.UUID | None
    status: str
    pick_timer_seconds: int | None
    bot_config: dict[str, Any]
    keeper_context: dict[str, Any]
    draft_type: str
    round_count: int
    current_pick: int | None = None
    completed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    picks: list[MockDraftPickRead] = Field(default_factory=list)
    board: list[MockDraftBoardSlot] = Field(default_factory=list)
    available_players: list[MockDraftAvailablePlayer] = Field(default_factory=list)
    roster_needs: list[MockDraftRosterNeed] = Field(default_factory=list)
    strategy_plan: MockDraftStrategyPlanRead | None = None
    analysis: MockDraftAnalysisRead | None = None

    model_config = ConfigDict(from_attributes=True)


class MockDraftHistoryRow(BaseModel):
    id: uuid.UUID
    league_id: uuid.UUID
    user_team_id: uuid.UUID
    user_team_name: str | None = None
    status: str
    draft_type: str
    round_count: int
    pick_timer_seconds: int | None
    completed_at: datetime | None
    created_at: datetime
    overall_letter_grade: str | None = None
    overall_numeric_score: int | None = None
    summary: str | None = None


class MockDraftActionResult(BaseModel):
    session: MockDraftSessionRead


class MockDraftBotPickResult(BaseModel):
    session: MockDraftSessionRead
    pick: MockDraftPickRead | None = None


class MockDraftCompleteRequest(BaseModel):
    force: bool = False


class MockDraftRerunAnalysisRequest(BaseModel):
    save: bool = True


class MockDraftCreateValidated(MockDraftCreate):
    @field_validator("bot_config")
    @classmethod
    def validate_bot_config(cls, value: dict[str, Any]) -> dict[str, Any]:
        return value or {}
