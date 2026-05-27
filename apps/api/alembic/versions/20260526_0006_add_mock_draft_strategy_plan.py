"""Add mock draft strategy plan fields.

Revision ID: 20260526_0006
Revises: 20260525_0005
Create Date: 2026-05-26
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260526_0006"
down_revision: str | None = "20260525_0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _json_type() -> sa.types.TypeEngine:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        return postgresql.JSONB(astext_type=sa.Text())
    return sa.JSON()


def upgrade() -> None:
    bind = op.get_bind()
    default = sa.text("'{}'::jsonb") if bind.dialect.name == "postgresql" else sa.text("'{}'")
    op.add_column(
        "mock_draft_sessions",
        sa.Column("strategy_plan", _json_type(), nullable=False, server_default=default),
    )
    op.add_column(
        "mock_draft_sessions",
        sa.Column("strategy_plan_cache_key", sa.String(length=160), nullable=True),
    )
    op.add_column(
        "mock_draft_sessions",
        sa.Column("strategy_plan_generated_at", sa.DateTime(), nullable=True),
    )
    op.add_column(
        "mock_draft_sessions",
        sa.Column("strategy_plan_error", sa.String(length=1000), nullable=True),
    )
    op.alter_column("mock_draft_sessions", "strategy_plan", server_default=None)


def downgrade() -> None:
    op.drop_column("mock_draft_sessions", "strategy_plan_error")
    op.drop_column("mock_draft_sessions", "strategy_plan_generated_at")
    op.drop_column("mock_draft_sessions", "strategy_plan_cache_key")
    op.drop_column("mock_draft_sessions", "strategy_plan")
