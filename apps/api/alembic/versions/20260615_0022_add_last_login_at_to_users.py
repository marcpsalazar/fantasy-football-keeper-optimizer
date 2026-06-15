"""add last_login_at to users

Revision ID: 20260615_0022
Revises: 20260613_0021
Create Date: 2026-06-15
"""

from alembic import op
import sqlalchemy as sa

revision = "20260615_0022"
down_revision = "20260613_0021"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("last_login_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "last_login_at")
