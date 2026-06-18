"""per-member email opt-out commissioner override

Revision ID: 20260618_0026
Revises: 20260618_0025
Create Date: 2026-06-18
"""

from alembic import op
import sqlalchemy as sa

revision = "20260618_0026"
down_revision = "20260618_0025"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "league_memberships",
        sa.Column(
            "email_opt_out_commissioner_override",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    op.drop_column("leagues", "email_override_opt_out")


def downgrade() -> None:
    op.drop_column("league_memberships", "email_opt_out_commissioner_override")
    op.add_column(
        "leagues",
        sa.Column(
            "email_override_opt_out",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
