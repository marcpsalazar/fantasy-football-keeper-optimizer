"""add keeper tenure table and max_consecutive_keeper_seasons

Revision ID: 20260611_0020
Revises: 20260608_0019
Create Date: 2026-06-11

"""

import sqlalchemy as sa
from alembic import op

revision = "20260611_0020"
down_revision = "20260608_0019"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "leagues",
        sa.Column("max_consecutive_keeper_seasons", sa.Integer(), nullable=True),
    )
    op.create_table(
        "keeper_tenures",
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("league_id", sa.Uuid(), nullable=False),
        sa.Column("team_id", sa.Uuid(), nullable=False),
        sa.Column("player_id", sa.Uuid(), nullable=False),
        sa.Column("consecutive_seasons", sa.Integer(), nullable=False),
        sa.Column("last_kept_season_year", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["league_id"], ["leagues.id"]),
        sa.ForeignKeyConstraint(["team_id"], ["teams.id"]),
        sa.ForeignKeyConstraint(["player_id"], ["players.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "league_id", "team_id", "player_id",
            name="uq_keeper_tenures_league_team_player",
        ),
    )
    op.create_index("ix_keeper_tenures_league_id", "keeper_tenures", ["league_id"])
    op.create_index("ix_keeper_tenures_team_id", "keeper_tenures", ["team_id"])
    op.create_index("ix_keeper_tenures_player_id", "keeper_tenures", ["player_id"])


def downgrade() -> None:
    op.drop_index("ix_keeper_tenures_player_id", "keeper_tenures")
    op.drop_index("ix_keeper_tenures_team_id", "keeper_tenures")
    op.drop_index("ix_keeper_tenures_league_id", "keeper_tenures")
    op.drop_table("keeper_tenures")
    op.drop_column("leagues", "max_consecutive_keeper_seasons")
