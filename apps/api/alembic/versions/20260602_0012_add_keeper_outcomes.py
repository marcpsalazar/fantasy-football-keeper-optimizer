"""add keeper_outcomes table

Revision ID: 20260602_0012
Revises: 20260531_0011
Create Date: 2026-06-02

"""

import sqlalchemy as sa
import sqlmodel
from alembic import op

revision = "20260602_0012"
down_revision = "20260531_0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "keeper_outcomes",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("league_id", sa.Uuid(), nullable=False),
        sa.Column("team_id", sa.Uuid(), nullable=False),
        sa.Column("player_id", sa.Uuid(), nullable=False),
        sa.Column("season_year", sa.Integer(), nullable=False),
        sa.Column("keeper_cost_pick", sa.Float(), nullable=True),
        sa.Column("keeper_cost_round", sa.Float(), nullable=True),
        sa.Column("adp_pick_at_keep", sa.Float(), nullable=True),
        sa.Column("adp_round_at_keep", sa.Float(), nullable=True),
        sa.Column("keeper_value_at_keep", sa.Float(), nullable=True),
        sa.Column("finish_rank", sa.Integer(), nullable=True),
        sa.Column("fantasy_points", sa.Float(), nullable=True),
        sa.Column("met_adp_projection", sa.Boolean(), nullable=True),
        sa.Column("is_bust", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("notes", sqlmodel.AutoString(length=500), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["league_id"], ["leagues.id"]),
        sa.ForeignKeyConstraint(["team_id"], ["teams.id"]),
        sa.ForeignKeyConstraint(["player_id"], ["players.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "league_id", "team_id", "player_id", "season_year",
            name="uq_keeper_outcomes_league_team_player_season",
        ),
    )
    op.create_index("ix_keeper_outcomes_league_id", "keeper_outcomes", ["league_id"])
    op.create_index("ix_keeper_outcomes_team_id", "keeper_outcomes", ["team_id"])
    op.create_index("ix_keeper_outcomes_player_id", "keeper_outcomes", ["player_id"])
    op.create_index("ix_keeper_outcomes_season_year", "keeper_outcomes", ["season_year"])


def downgrade() -> None:
    op.drop_index("ix_keeper_outcomes_season_year", table_name="keeper_outcomes")
    op.drop_index("ix_keeper_outcomes_player_id", table_name="keeper_outcomes")
    op.drop_index("ix_keeper_outcomes_team_id", table_name="keeper_outcomes")
    op.drop_index("ix_keeper_outcomes_league_id", table_name="keeper_outcomes")
    op.drop_table("keeper_outcomes")
