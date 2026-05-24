"""Add league countdown dates.

Revision ID: 20260522_0004
Revises: 20260521_0003
Create Date: 2026-05-22
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "20260522_0004"
down_revision = "20260521_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("leagues", sa.Column("keeper_pick_deadline", sa.Date(), nullable=True))
    op.add_column("leagues", sa.Column("regular_season_start_date", sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column("leagues", "regular_season_start_date")
    op.drop_column("leagues", "keeper_pick_deadline")
