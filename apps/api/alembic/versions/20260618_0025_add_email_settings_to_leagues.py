"""add email settings to leagues

Revision ID: 20260618_0025
Revises: 20260618_0024
Create Date: 2026-06-18
"""

from alembic import op
import sqlalchemy as sa

revision = "20260618_0025"
down_revision = "20260618_0024"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("leagues", sa.Column("email_enabled", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("leagues", sa.Column("email_schedule", sa.String(20), nullable=False, server_default="none"))
    op.add_column("leagues", sa.Column("email_last_sent", sa.DateTime(), nullable=True))
    op.add_column("leagues", sa.Column("email_override_opt_out", sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade() -> None:
    op.drop_column("leagues", "email_override_opt_out")
    op.drop_column("leagues", "email_last_sent")
    op.drop_column("leagues", "email_schedule")
    op.drop_column("leagues", "email_enabled")
