"""Add ai_explanations table for cached AI-generated keeper and scenario explanations.

Revision ID: 20260527_0007
Revises: 20260526_0006
Create Date: 2026-05-27
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260527_0007"
down_revision: str | None = "20260526_0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "ai_explanations",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("league_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=True),
        sa.Column("entity_type", sa.String(length=60), nullable=False),
        sa.Column("entity_id", sa.UUID(), nullable=True),
        sa.Column("input_hash", sa.String(length=64), nullable=False),
        sa.Column("model", sa.String(length=120), nullable=False),
        sa.Column("content", postgresql.JSON(astext_type=sa.Text()), nullable=False),
        sa.Column("token_usage", postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("entity_type", "input_hash", name="uq_ai_explanations_entity_type_hash"),
    )
    op.create_index("ix_ai_explanations_league_id", "ai_explanations", ["league_id"])
    op.create_index("ix_ai_explanations_user_id", "ai_explanations", ["user_id"])
    op.create_index("ix_ai_explanations_entity_type", "ai_explanations", ["entity_type"])
    op.create_index("ix_ai_explanations_entity_id", "ai_explanations", ["entity_id"])
    op.create_index("ix_ai_explanations_input_hash", "ai_explanations", ["input_hash"])


def downgrade() -> None:
    op.drop_index("ix_ai_explanations_input_hash", table_name="ai_explanations")
    op.drop_index("ix_ai_explanations_entity_id", table_name="ai_explanations")
    op.drop_index("ix_ai_explanations_entity_type", table_name="ai_explanations")
    op.drop_index("ix_ai_explanations_user_id", table_name="ai_explanations")
    op.drop_index("ix_ai_explanations_league_id", table_name="ai_explanations")
    op.drop_table("ai_explanations")
