"""Add yahoo_oauth_tokens table for per-user Yahoo Fantasy OAuth2 token storage.

Revision ID: 20260530_0010
Revises: 20260529_0009
Create Date: 2026-05-30
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260530_0010"
down_revision = "20260529_0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "yahoo_oauth_tokens",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("access_token", sa.Text(), nullable=False),
        sa.Column("refresh_token", sa.Text(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("scope", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", name="uq_yahoo_oauth_tokens_user_id"),
    )
    op.create_index("ix_yahoo_oauth_tokens_user_id", "yahoo_oauth_tokens", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_yahoo_oauth_tokens_user_id", table_name="yahoo_oauth_tokens")
    op.drop_table("yahoo_oauth_tokens")
