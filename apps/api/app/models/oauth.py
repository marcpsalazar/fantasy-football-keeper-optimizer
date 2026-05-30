from __future__ import annotations

import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlmodel import Column, Field, UniqueConstraint

from app.models.base import TimestampMixin


class YahooOAuthToken(TimestampMixin, table=True):
    __tablename__ = "yahoo_oauth_tokens"
    __table_args__ = (UniqueConstraint("user_id", name="uq_yahoo_oauth_tokens_user_id"),)

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", index=True)
    access_token: str = Field(sa_column=Column(sa.Text, nullable=False))
    refresh_token: str = Field(sa_column=Column(sa.Text, nullable=False))
    expires_at: datetime
    scope: str = Field(max_length=255)
