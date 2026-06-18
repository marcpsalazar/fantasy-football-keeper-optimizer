"""drop email_opt_out_commissioner_override from league_memberships

Revision ID: 20260618_0027
Revises: 20260618_0026
Create Date: 2026-06-18
"""

from alembic import op
import sqlalchemy as sa

revision = "20260618_0027"
down_revision = "20260618_0026"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_column("league_memberships", "email_opt_out_commissioner_override")


def downgrade() -> None:
    op.add_column(
        "league_memberships",
        sa.Column(
            "email_opt_out_commissioner_override",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
