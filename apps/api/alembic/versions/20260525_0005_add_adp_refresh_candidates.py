"""Add ADP refresh candidates.

Revision ID: 20260525_0005
Revises: 20260524_0004
Create Date: 2026-05-25
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260525_0005"
down_revision: str | None = "20260524_0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _json_type() -> sa.types.TypeEngine:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        return postgresql.JSONB(astext_type=sa.Text())
    return sa.JSON()


def upgrade() -> None:
    json_type = _json_type()
    op.create_table(
        "adp_refresh_candidates",
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("league_id", sa.Uuid(), nullable=False),
        sa.Column("provider", sa.String(length=80), nullable=False),
        sa.Column("model", sa.String(length=120), nullable=True),
        sa.Column("status", sa.String(length=40), nullable=False),
        sa.Column("board_size", sa.Integer(), nullable=False),
        sa.Column("generated_at", sa.String(length=80), nullable=False),
        sa.Column("source_summary", sa.String(length=1000), nullable=True),
        sa.Column("warnings", json_type, nullable=False),
        sa.Column("normalized_rows", json_type, nullable=False),
        sa.Column("error_message", sa.String(length=1000), nullable=True),
        sa.Column("approved_by_user_id", sa.Uuid(), nullable=True),
        sa.Column("approved_at", sa.String(length=80), nullable=True),
        sa.ForeignKeyConstraint(["approved_by_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["league_id"], ["leagues.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_adp_refresh_candidates_approved_by_user_id", "adp_refresh_candidates", ["approved_by_user_id"])
    op.create_index("ix_adp_refresh_candidates_generated_at", "adp_refresh_candidates", ["generated_at"])
    op.create_index("ix_adp_refresh_candidates_league_id", "adp_refresh_candidates", ["league_id"])
    op.create_index("ix_adp_refresh_candidates_provider", "adp_refresh_candidates", ["provider"])
    op.create_index("ix_adp_refresh_candidates_status", "adp_refresh_candidates", ["status"])


def downgrade() -> None:
    op.drop_index("ix_adp_refresh_candidates_status", table_name="adp_refresh_candidates")
    op.drop_index("ix_adp_refresh_candidates_provider", table_name="adp_refresh_candidates")
    op.drop_index("ix_adp_refresh_candidates_league_id", table_name="adp_refresh_candidates")
    op.drop_index("ix_adp_refresh_candidates_generated_at", table_name="adp_refresh_candidates")
    op.drop_index("ix_adp_refresh_candidates_approved_by_user_id", table_name="adp_refresh_candidates")
    op.drop_table("adp_refresh_candidates")
