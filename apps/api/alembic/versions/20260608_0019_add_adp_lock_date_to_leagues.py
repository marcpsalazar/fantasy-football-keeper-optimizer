"""add adp_lock_date to leagues

Revision ID: 20260608_0019
Revises: 20260604_0018
Create Date: 2026-06-08

"""

import sqlalchemy as sa
from alembic import op

revision = "20260608_0019"
down_revision = "20260604_0018"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("leagues", sa.Column("adp_lock_date", sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column("leagues", "adp_lock_date")
