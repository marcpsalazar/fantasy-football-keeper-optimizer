"""add injury_status to players

Revision ID: 20260616_0023
Revises: 20260615_0022
Create Date: 2026-06-16
"""

from alembic import op
import sqlalchemy as sa

revision = "20260616_0023"
down_revision = "20260615_0022"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("players", sa.Column("injury_status", sa.String(20), nullable=True))


def downgrade() -> None:
    op.drop_column("players", "injury_status")
