"""Add image_url to players table

Revision ID: 20260604_0018
Revises: 20260604_0017
Create Date: 2026-06-04
"""

from alembic import op
import sqlalchemy as sa

revision = "20260604_0018"
down_revision = "20260604_0017"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("players", sa.Column("image_url", sa.String(length=500), nullable=True))


def downgrade() -> None:
    op.drop_column("players", "image_url")
