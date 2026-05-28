from __future__ import annotations

import uuid

from sqlmodel import Field

from app.models.base import TimestampMixin


class AIRequestLog(TimestampMixin, table=True):
    __tablename__ = "ai_request_logs"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    feature: str = Field(index=True, max_length=80)
    league_id: uuid.UUID = Field(index=True)
    user_id: uuid.UUID | None = Field(default=None, index=True)
    model: str = Field(max_length=120)
    status: str = Field(index=True, max_length=20)  # "success" | "fallback" | "failed"
    input_tokens: int | None = Field(default=None)
    output_tokens: int | None = Field(default=None)
    total_tokens: int | None = Field(default=None)
    latency_ms: int | None = Field(default=None)
    error_message: str | None = Field(default=None, max_length=500)
