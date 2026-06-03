"""add draft_date and keeper_reveal_date to leagues

Revision ID: 20260602_0015
Revises: 20260602_0014
Create Date: 2026-06-02

"""

import sqlalchemy as sa
from alembic import op

revision = "20260602_0015"
down_revision = "20260602_0014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("leagues", sa.Column("draft_date", sa.Date(), nullable=True))
    op.add_column("leagues", sa.Column("keeper_reveal_date", sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column("leagues", "keeper_reveal_date")
    op.drop_column("leagues", "draft_date")
