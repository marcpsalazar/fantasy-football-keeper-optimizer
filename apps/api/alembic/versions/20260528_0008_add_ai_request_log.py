"""Add ai_request_logs table for AI call observability and token tracking.

Revision ID: 20260528_0008
Revises: 20260527_0007
Create Date: 2026-05-28
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260528_0008"
down_revision: str | None = "20260527_0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "ai_request_logs",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("feature", sa.String(length=80), nullable=False),
        sa.Column("league_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=True),
        sa.Column("model", sa.String(length=120), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("input_tokens", sa.Integer(), nullable=True),
        sa.Column("output_tokens", sa.Integer(), nullable=True),
        sa.Column("total_tokens", sa.Integer(), nullable=True),
        sa.Column("latency_ms", sa.Integer(), nullable=True),
        sa.Column("error_message", sa.String(length=500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ai_request_logs_feature", "ai_request_logs", ["feature"])
    op.create_index("ix_ai_request_logs_league_id", "ai_request_logs", ["league_id"])
    op.create_index("ix_ai_request_logs_user_id", "ai_request_logs", ["user_id"])
    op.create_index("ix_ai_request_logs_status", "ai_request_logs", ["status"])
    op.create_index("ix_ai_request_logs_created_at", "ai_request_logs", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_ai_request_logs_created_at", "ai_request_logs")
    op.drop_index("ix_ai_request_logs_status", "ai_request_logs")
    op.drop_index("ix_ai_request_logs_user_id", "ai_request_logs")
    op.drop_index("ix_ai_request_logs_league_id", "ai_request_logs")
    op.drop_index("ix_ai_request_logs_feature", "ai_request_logs")
    op.drop_table("ai_request_logs")
