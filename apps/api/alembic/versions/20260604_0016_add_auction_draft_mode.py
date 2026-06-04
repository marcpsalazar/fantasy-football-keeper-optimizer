"""Add auction draft mode columns

Revision ID: 20260604_0016
Revises: 20260602_0015
Create Date: 2026-06-04
"""

from alembic import op
import sqlalchemy as sa

revision = "20260604_0016"
down_revision = "20260602_0015"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("leagues", sa.Column("draft_format", sa.String(length=20), nullable=False, server_default="snake"))

    op.add_column("optimizer_settings", sa.Column("budget_per_team", sa.Float(), nullable=True))
    op.add_column("optimizer_settings", sa.Column("max_keeper_salary_pct", sa.Float(), nullable=True))

    op.add_column("app_default_optimizer_settings", sa.Column("budget_per_team", sa.Float(), nullable=True))
    op.add_column("app_default_optimizer_settings", sa.Column("max_keeper_salary_pct", sa.Float(), nullable=True))

    op.add_column("adp_entries", sa.Column("auction_value", sa.Float(), nullable=True))

    op.add_column("final_roster_entries", sa.Column("keeper_salary", sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column("final_roster_entries", "keeper_salary")
    op.drop_column("adp_entries", "auction_value")
    op.drop_column("app_default_optimizer_settings", "max_keeper_salary_pct")
    op.drop_column("app_default_optimizer_settings", "budget_per_team")
    op.drop_column("optimizer_settings", "max_keeper_salary_pct")
    op.drop_column("optimizer_settings", "budget_per_team")
    op.drop_column("leagues", "draft_format")
