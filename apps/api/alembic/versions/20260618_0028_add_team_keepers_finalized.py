"""Add per-team keeper finalization fields to teams table

Revision ID: 20260618_0028
Revises: 20260618_0027
Create Date: 2026-06-18
"""

from alembic import op
import sqlalchemy as sa

revision = "20260618_0028"
down_revision = "20260618_0027"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("teams", sa.Column("team_keepers_finalized", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("teams", sa.Column("team_keepers_finalized_at", sa.DateTime(), nullable=True))
    op.add_column("teams", sa.Column("team_keepers_finalized_by_user_id", sa.Uuid(), nullable=True))


def downgrade() -> None:
    op.drop_column("teams", "team_keepers_finalized_by_user_id")
    op.drop_column("teams", "team_keepers_finalized_at")
    op.drop_column("teams", "team_keepers_finalized")
