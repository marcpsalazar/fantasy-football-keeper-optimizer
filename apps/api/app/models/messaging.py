import uuid

from sqlalchemy import Column, Text, UniqueConstraint
from sqlmodel import Field

from app.models.base import TimestampMixin


class Message(TimestampMixin, table=True):
    __tablename__ = "messages"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    sender_id: uuid.UUID = Field(foreign_key="users.id", index=True)
    channel_type: str = Field(max_length=10, index=True)  # "dm" | "league"
    league_id: uuid.UUID | None = Field(default=None, foreign_key="leagues.id", nullable=True, index=True)
    recipient_id: uuid.UUID | None = Field(default=None, foreign_key="users.id", nullable=True, index=True)
    content: str = Field(sa_column=Column(Text, nullable=False))


class MessageRead(TimestampMixin, table=True):
    __tablename__ = "message_reads"
    __table_args__ = (UniqueConstraint("message_id", "user_id", name="uq_message_reads_msg_user"),)

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    message_id: uuid.UUID = Field(foreign_key="messages.id", index=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", index=True)
