from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import Column, JSON, UniqueConstraint
from sqlmodel import Field

from app.models.base import TimestampMixin


class AIExplanation(TimestampMixin, table=True):
    __tablename__ = "ai_explanations"
    __table_args__ = (
        UniqueConstraint("entity_type", "input_hash", name="uq_ai_explanations_entity_type_hash"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    league_id: uuid.UUID = Field(index=True)
    user_id: uuid.UUID | None = Field(default=None, index=True)
    entity_type: str = Field(index=True, max_length=60)
    entity_id: uuid.UUID | None = Field(default=None, index=True)
    input_hash: str = Field(index=True, max_length=64)
    model: str = Field(max_length=120)
    content: dict[str, Any] = Field(sa_column=Column(JSON, nullable=False))
    token_usage: dict[str, Any] | None = Field(default=None, sa_column=Column(JSON, nullable=True))
