"""add email_opt_out to league_memberships

Revision ID: 20260618_0024
Revises: 20260616_0023
Create Date: 2026-06-18
"""

from alembic import op
import sqlalchemy as sa

revision = "20260618_0024"
down_revision = "20260616_0023"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "league_memberships",
        sa.Column("email_opt_out", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column("league_memberships", "email_opt_out")
