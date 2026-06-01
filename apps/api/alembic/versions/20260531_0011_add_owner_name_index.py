"""add owner_name index to teams

Revision ID: 20260531_0011
Revises: 20260530_0010
Create Date: 2026-05-31

"""

from alembic import op

revision = "20260531_0011"
down_revision = "20260530_0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index("ix_teams_owner_name", "teams", ["owner_name"])


def downgrade() -> None:
    op.drop_index("ix_teams_owner_name", table_name="teams")
