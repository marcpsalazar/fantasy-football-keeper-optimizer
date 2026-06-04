"""Add birth_date to players table

Revision ID: 20260604_0017
Revises: 20260604_0016
Create Date: 2026-06-04
"""

from alembic import op
import sqlalchemy as sa

revision = "20260604_0017"
down_revision = "20260604_0016"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("players", sa.Column("birth_date", sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column("players", "birth_date")
