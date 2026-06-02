"""add final_keeper_selections table and league finalization columns

Revision ID: 20260602_0013
Revises: 20260602_0012
Create Date: 2026-06-02

"""

import sqlalchemy as sa
from alembic import op

revision = "20260602_0013"
down_revision = "20260602_0012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "final_keeper_selections",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("league_id", sa.Uuid(), nullable=False),
        sa.Column("team_id", sa.Uuid(), nullable=False),
        sa.Column("player_id", sa.Uuid(), nullable=False),
        sa.Column("season_year", sa.Integer(), nullable=False),
        sa.Column("cost_pick", sa.Float(), nullable=True),
        sa.Column("cost_round", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["league_id"], ["leagues.id"]),
        sa.ForeignKeyConstraint(["team_id"], ["teams.id"]),
        sa.ForeignKeyConstraint(["player_id"], ["players.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "league_id", "team_id", "player_id", "season_year",
            name="uq_final_keeper_selections_league_team_player_season",
        ),
    )
    op.create_index("ix_final_keeper_selections_league_id", "final_keeper_selections", ["league_id"])
    op.create_index("ix_final_keeper_selections_team_id", "final_keeper_selections", ["team_id"])
    op.create_index("ix_final_keeper_selections_player_id", "final_keeper_selections", ["player_id"])
    op.create_index("ix_final_keeper_selections_season_year", "final_keeper_selections", ["season_year"])

    op.add_column("leagues", sa.Column("keepers_finalized", sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.add_column("leagues", sa.Column("keepers_finalized_at", sa.DateTime(), nullable=True))
    op.add_column("leagues", sa.Column("keepers_finalized_by_user_id", sa.Uuid(), nullable=True))
    op.create_foreign_key(
        "fk_leagues_keepers_finalized_by_user_id",
        "leagues", "users",
        ["keepers_finalized_by_user_id"], ["id"],
    )


def downgrade() -> None:
    op.drop_constraint("fk_leagues_keepers_finalized_by_user_id", "leagues", type_="foreignkey")
    op.drop_column("leagues", "keepers_finalized_by_user_id")
    op.drop_column("leagues", "keepers_finalized_at")
    op.drop_column("leagues", "keepers_finalized")

    op.drop_index("ix_final_keeper_selections_season_year", table_name="final_keeper_selections")
    op.drop_index("ix_final_keeper_selections_player_id", table_name="final_keeper_selections")
    op.drop_index("ix_final_keeper_selections_team_id", table_name="final_keeper_selections")
    op.drop_index("ix_final_keeper_selections_league_id", table_name="final_keeper_selections")
    op.drop_table("final_keeper_selections")
