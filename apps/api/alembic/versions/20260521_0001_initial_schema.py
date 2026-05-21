"""Initial schema.

Revision ID: 20260521_0001
Revises:
Create Date: 2026-05-21
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "20260521_0001"
down_revision = None
branch_labels = None
depends_on = None


def timestamps() -> list[sa.Column]:
    return [
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    ]


def uuid_pk() -> sa.Column:
    return sa.Column("id", sa.Uuid(), nullable=False)


def upgrade() -> None:
    op.create_table(
        "app_default_optimizer_settings",
        *timestamps(),
        uuid_pk(),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("max_keepers", sa.Integer(), nullable=False),
        sa.Column("max_keepers_per_position", sa.Integer(), nullable=False),
        sa.Column("max_qb_keepers", sa.Integer(), nullable=False),
        sa.Column("minimum_keeper_value", sa.Float(), nullable=False),
        sa.Column("max_adp_cap", sa.Float(), nullable=True),
        sa.Column("minimum_keeper_score", sa.Float(), nullable=False),
        sa.Column("qb_weight", sa.Float(), nullable=False),
        sa.Column("rb_weight", sa.Float(), nullable=False),
        sa.Column("wr_weight", sa.Float(), nullable=False),
        sa.Column("te_weight", sa.Float(), nullable=False),
        sa.Column("k_weight", sa.Float(), nullable=False),
        sa.Column("def_weight", sa.Float(), nullable=False),
        sa.Column("qb_max_adp", sa.Float(), nullable=True),
        sa.Column("elite_qb_cutoff", sa.Float(), nullable=False),
        sa.Column("elite_qb_max_negative_edge", sa.Float(), nullable=False),
        sa.Column("talent_anchor", sa.Float(), nullable=False),
        sa.Column("talent_divisor", sa.Float(), nullable=False),
        sa.Column("starter_status_bonus", sa.Float(), nullable=False),
        sa.Column("bench_status_bonus", sa.Float(), nullable=False),
        sa.Column("ir_status_bonus", sa.Float(), nullable=False),
        sa.Column("enable_draft_slot_bonus", sa.Boolean(), nullable=False),
        sa.Column("enable_qb_scarcity_bonus", sa.Boolean(), nullable=False),
        sa.Column("enable_elite_player_bonus", sa.Boolean(), nullable=False),
        sa.Column("elite_player_max_negative_edge", sa.Float(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_app_default_optimizer_settings_is_active",
        "app_default_optimizer_settings",
        ["is_active"],
    )

    op.create_table(
        "leagues",
        *timestamps(),
        uuid_pk(),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("season_year", sa.Integer(), nullable=False),
        sa.Column("scoring_format", sa.String(length=80), nullable=False),
        sa.Column("draft_type", sa.String(length=40), nullable=False),
        sa.Column("max_keepers", sa.Integer(), nullable=False),
        sa.Column("max_keepers_per_position", sa.Integer(), nullable=False),
        sa.Column("max_qb_keepers", sa.Integer(), nullable=False),
        sa.Column("roster_settings", sa.JSON(), nullable=False),
        sa.Column("keeper_rules", sa.JSON(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name", "season_year", name="uq_leagues_name_season"),
    )
    op.create_index("ix_leagues_name", "leagues", ["name"])
    op.create_index("ix_leagues_season_year", "leagues", ["season_year"])

    op.create_table(
        "players",
        *timestamps(),
        uuid_pk(),
        sa.Column("external_id", sa.String(length=80), nullable=True),
        sa.Column("full_name", sa.String(length=160), nullable=False),
        sa.Column("position", sa.String(length=10), nullable=False),
        sa.Column("nfl_team", sa.String(length=10), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("full_name", "position", "nfl_team", name="uq_players_identity"),
    )
    op.create_index("ix_players_external_id", "players", ["external_id"])
    op.create_index("ix_players_full_name", "players", ["full_name"])
    op.create_index("ix_players_nfl_team", "players", ["nfl_team"])
    op.create_index("ix_players_position", "players", ["position"])

    op.create_table(
        "users",
        *timestamps(),
        uuid_pk(),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("role", sa.String(length=40), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("avatar_data_url", sa.String(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email", name="uq_users_email"),
    )
    op.create_index("ix_users_email", "users", ["email"])
    op.create_index("ix_users_is_active", "users", ["is_active"])
    op.create_index("ix_users_role", "users", ["role"])

    op.create_table(
        "adp_snapshots",
        *timestamps(),
        uuid_pk(),
        sa.Column("league_id", sa.Uuid(), nullable=False),
        sa.Column("season_year", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("source", sa.String(length=120), nullable=False),
        sa.Column("format_type", sa.String(length=80), nullable=False),
        sa.Column("snapshot_date", sa.Date(), nullable=False),
        sa.Column("notes", sa.String(length=500), nullable=True),
        sa.ForeignKeyConstraint(["league_id"], ["leagues.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "league_id",
            "season_year",
            "source",
            "format_type",
            "snapshot_date",
            name="uq_adp_snapshots_league_source_format_date",
        ),
    )
    op.create_index("ix_adp_snapshots_format_type", "adp_snapshots", ["format_type"])
    op.create_index("ix_adp_snapshots_league_id", "adp_snapshots", ["league_id"])
    op.create_index("ix_adp_snapshots_name", "adp_snapshots", ["name"])
    op.create_index("ix_adp_snapshots_season_year", "adp_snapshots", ["season_year"])
    op.create_index("ix_adp_snapshots_snapshot_date", "adp_snapshots", ["snapshot_date"])
    op.create_index("ix_adp_snapshots_source", "adp_snapshots", ["source"])

    op.create_table(
        "optimizer_settings",
        *timestamps(),
        uuid_pk(),
        sa.Column("league_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=True),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("max_keepers", sa.Integer(), nullable=False),
        sa.Column("max_keepers_per_position", sa.Integer(), nullable=False),
        sa.Column("max_qb_keepers", sa.Integer(), nullable=False),
        sa.Column("minimum_keeper_value", sa.Float(), nullable=False),
        sa.Column("max_adp_cap", sa.Float(), nullable=True),
        sa.Column("minimum_keeper_score", sa.Float(), nullable=False),
        sa.Column("qb_weight", sa.Float(), nullable=False),
        sa.Column("rb_weight", sa.Float(), nullable=False),
        sa.Column("wr_weight", sa.Float(), nullable=False),
        sa.Column("te_weight", sa.Float(), nullable=False),
        sa.Column("k_weight", sa.Float(), nullable=False),
        sa.Column("def_weight", sa.Float(), nullable=False),
        sa.Column("qb_max_adp", sa.Float(), nullable=True),
        sa.Column("elite_qb_cutoff", sa.Float(), nullable=False),
        sa.Column("elite_qb_max_negative_edge", sa.Float(), nullable=False),
        sa.Column("talent_anchor", sa.Float(), nullable=False),
        sa.Column("talent_divisor", sa.Float(), nullable=False),
        sa.Column("starter_status_bonus", sa.Float(), nullable=False),
        sa.Column("bench_status_bonus", sa.Float(), nullable=False),
        sa.Column("ir_status_bonus", sa.Float(), nullable=False),
        sa.Column("enable_draft_slot_bonus", sa.Boolean(), nullable=False),
        sa.Column("enable_qb_scarcity_bonus", sa.Boolean(), nullable=False),
        sa.Column("enable_elite_player_bonus", sa.Boolean(), nullable=False),
        sa.Column("elite_player_max_negative_edge", sa.Float(), nullable=False),
        sa.ForeignKeyConstraint(["league_id"], ["leagues.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "league_id",
            "user_id",
            "name",
            name="uq_optimizer_settings_league_user_name",
        ),
    )
    op.create_index("ix_optimizer_settings_league_id", "optimizer_settings", ["league_id"])
    op.create_index("ix_optimizer_settings_name", "optimizer_settings", ["name"])
    op.create_index("ix_optimizer_settings_user_id", "optimizer_settings", ["user_id"])

    op.create_table(
        "teams",
        *timestamps(),
        uuid_pk(),
        sa.Column("league_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=True),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("owner_name", sa.String(length=120), nullable=True),
        sa.Column("draft_slot", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["league_id"], ["leagues.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("league_id", "name", name="uq_teams_league_name"),
    )
    op.create_index("ix_teams_draft_slot", "teams", ["draft_slot"])
    op.create_index("ix_teams_league_id", "teams", ["league_id"])
    op.create_index("ix_teams_name", "teams", ["name"])
    op.create_index("ix_teams_user_id", "teams", ["user_id"])

    op.create_table(
        "adp_entries",
        *timestamps(),
        uuid_pk(),
        sa.Column("snapshot_id", sa.Uuid(), nullable=False),
        sa.Column("player_id", sa.Uuid(), nullable=False),
        sa.Column("position", sa.String(length=10), nullable=False),
        sa.Column("adp_pick", sa.Float(), nullable=False),
        sa.Column("adp_round", sa.Float(), nullable=True),
        sa.Column("source_note", sa.String(length=500), nullable=True),
        sa.Column("sos", sa.Float(), nullable=True),
        sa.Column("injury", sa.Float(), nullable=True),
        sa.Column("risk", sa.Float(), nullable=True),
        sa.Column("floor_projection", sa.Float(), nullable=True),
        sa.Column("consensus_projection", sa.Float(), nullable=True),
        sa.Column("draftsharks_projection", sa.Float(), nullable=True),
        sa.Column("ceiling_projection", sa.Float(), nullable=True),
        sa.Column("draftsharks_3d_value", sa.Float(), nullable=True),
        sa.ForeignKeyConstraint(["player_id"], ["players.id"]),
        sa.ForeignKeyConstraint(["snapshot_id"], ["adp_snapshots.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("snapshot_id", "player_id", name="uq_adp_entries_snapshot_player"),
    )
    op.create_index("ix_adp_entries_adp_pick", "adp_entries", ["adp_pick"])
    op.create_index("ix_adp_entries_player_id", "adp_entries", ["player_id"])
    op.create_index("ix_adp_entries_position", "adp_entries", ["position"])
    op.create_index("ix_adp_entries_snapshot_id", "adp_entries", ["snapshot_id"])

    op.create_table(
        "draft_picks",
        *timestamps(),
        uuid_pk(),
        sa.Column("league_id", sa.Uuid(), nullable=False),
        sa.Column("team_id", sa.Uuid(), nullable=False),
        sa.Column("player_id", sa.Uuid(), nullable=False),
        sa.Column("season_year", sa.Integer(), nullable=False),
        sa.Column("round", sa.Integer(), nullable=False),
        sa.Column("overall_pick", sa.Integer(), nullable=False),
        sa.Column("pick_in_round", sa.Integer(), nullable=True),
        sa.Column("position", sa.String(length=10), nullable=False),
        sa.ForeignKeyConstraint(["league_id"], ["leagues.id"]),
        sa.ForeignKeyConstraint(["player_id"], ["players.id"]),
        sa.ForeignKeyConstraint(["team_id"], ["teams.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "league_id",
            "season_year",
            "overall_pick",
            name="uq_draft_picks_league_season_overall",
        ),
    )
    op.create_index("ix_draft_picks_league_id", "draft_picks", ["league_id"])
    op.create_index("ix_draft_picks_overall_pick", "draft_picks", ["overall_pick"])
    op.create_index("ix_draft_picks_player_id", "draft_picks", ["player_id"])
    op.create_index("ix_draft_picks_position", "draft_picks", ["position"])
    op.create_index("ix_draft_picks_round", "draft_picks", ["round"])
    op.create_index("ix_draft_picks_season_year", "draft_picks", ["season_year"])
    op.create_index("ix_draft_picks_team_id", "draft_picks", ["team_id"])

    op.create_table(
        "final_roster_entries",
        *timestamps(),
        uuid_pk(),
        sa.Column("league_id", sa.Uuid(), nullable=False),
        sa.Column("team_id", sa.Uuid(), nullable=False),
        sa.Column("player_id", sa.Uuid(), nullable=False),
        sa.Column("season_year", sa.Integer(), nullable=False),
        sa.Column("position", sa.String(length=10), nullable=False),
        sa.Column("roster_status", sa.String(length=40), nullable=False),
        sa.ForeignKeyConstraint(["league_id"], ["leagues.id"]),
        sa.ForeignKeyConstraint(["player_id"], ["players.id"]),
        sa.ForeignKeyConstraint(["team_id"], ["teams.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "league_id",
            "team_id",
            "player_id",
            "season_year",
            name="uq_final_rosters_league_team_player_season",
        ),
    )
    op.create_index("ix_final_roster_entries_league_id", "final_roster_entries", ["league_id"])
    op.create_index("ix_final_roster_entries_player_id", "final_roster_entries", ["player_id"])
    op.create_index("ix_final_roster_entries_position", "final_roster_entries", ["position"])
    op.create_index(
        "ix_final_roster_entries_roster_status",
        "final_roster_entries",
        ["roster_status"],
    )
    op.create_index("ix_final_roster_entries_season_year", "final_roster_entries", ["season_year"])
    op.create_index("ix_final_roster_entries_team_id", "final_roster_entries", ["team_id"])

    op.create_table(
        "keeper_candidates",
        *timestamps(),
        uuid_pk(),
        sa.Column("team_id", sa.Uuid(), nullable=False),
        sa.Column("player_id", sa.Uuid(), nullable=False),
        sa.Column("season_year", sa.Integer(), nullable=False),
        sa.Column("keeper_cost", sa.Float(), nullable=False),
        sa.Column("projected_value", sa.Float(), nullable=True),
        sa.Column("notes", sa.String(length=500), nullable=True),
        sa.ForeignKeyConstraint(["player_id"], ["players.id"]),
        sa.ForeignKeyConstraint(["team_id"], ["teams.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_keeper_candidates_player_id", "keeper_candidates", ["player_id"])
    op.create_index("ix_keeper_candidates_season_year", "keeper_candidates", ["season_year"])
    op.create_index("ix_keeper_candidates_team_id", "keeper_candidates", ["team_id"])

    op.create_table(
        "keeper_recommendations",
        *timestamps(),
        uuid_pk(),
        sa.Column("league_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=True),
        sa.Column("team_id", sa.Uuid(), nullable=False),
        sa.Column("player_id", sa.Uuid(), nullable=False),
        sa.Column("settings_id", sa.Uuid(), nullable=True),
        sa.Column("adp_snapshot_id", sa.Uuid(), nullable=True),
        sa.Column("scenario_name", sa.String(length=120), nullable=False),
        sa.Column("keeper_cost_pick", sa.Float(), nullable=True),
        sa.Column("keeper_cost_round", sa.Float(), nullable=True),
        sa.Column("adp_pick", sa.Float(), nullable=True),
        sa.Column("adp_round", sa.Float(), nullable=True),
        sa.Column("keeper_value", sa.Float(), nullable=True),
        sa.Column("keeper_score", sa.Float(), nullable=True),
        sa.Column("is_eligible", sa.Boolean(), nullable=False),
        sa.Column("is_recommended", sa.Boolean(), nullable=False),
        sa.Column("reason", sa.String(length=1000), nullable=True),
        sa.ForeignKeyConstraint(["adp_snapshot_id"], ["adp_snapshots.id"]),
        sa.ForeignKeyConstraint(["league_id"], ["leagues.id"]),
        sa.ForeignKeyConstraint(["player_id"], ["players.id"]),
        sa.ForeignKeyConstraint(["settings_id"], ["optimizer_settings.id"]),
        sa.ForeignKeyConstraint(["team_id"], ["teams.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_keeper_recommendations_adp_snapshot_id",
        "keeper_recommendations",
        ["adp_snapshot_id"],
    )
    op.create_index(
        "ix_keeper_recommendations_is_eligible",
        "keeper_recommendations",
        ["is_eligible"],
    )
    op.create_index(
        "ix_keeper_recommendations_is_recommended",
        "keeper_recommendations",
        ["is_recommended"],
    )
    op.create_index("ix_keeper_recommendations_league_id", "keeper_recommendations", ["league_id"])
    op.create_index("ix_keeper_recommendations_player_id", "keeper_recommendations", ["player_id"])
    op.create_index(
        "ix_keeper_recommendations_scenario_name",
        "keeper_recommendations",
        ["scenario_name"],
    )
    op.create_index(
        "ix_keeper_recommendations_settings_id",
        "keeper_recommendations",
        ["settings_id"],
    )
    op.create_index("ix_keeper_recommendations_team_id", "keeper_recommendations", ["team_id"])
    op.create_index("ix_keeper_recommendations_user_id", "keeper_recommendations", ["user_id"])

    op.create_table(
        "manual_overrides",
        *timestamps(),
        uuid_pk(),
        sa.Column("league_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=True),
        sa.Column("team_id", sa.Uuid(), nullable=False),
        sa.Column("player_id", sa.Uuid(), nullable=False),
        sa.Column("override_type", sa.String(length=40), nullable=False),
        sa.Column("notes", sa.String(length=500), nullable=True),
        sa.ForeignKeyConstraint(["league_id"], ["leagues.id"]),
        sa.ForeignKeyConstraint(["player_id"], ["players.id"]),
        sa.ForeignKeyConstraint(["team_id"], ["teams.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "league_id",
            "user_id",
            "team_id",
            "player_id",
            name="uq_manual_overrides_league_user_team_player",
        ),
    )
    op.create_index("ix_manual_overrides_league_id", "manual_overrides", ["league_id"])
    op.create_index("ix_manual_overrides_override_type", "manual_overrides", ["override_type"])
    op.create_index("ix_manual_overrides_player_id", "manual_overrides", ["player_id"])
    op.create_index("ix_manual_overrides_team_id", "manual_overrides", ["team_id"])
    op.create_index("ix_manual_overrides_user_id", "manual_overrides", ["user_id"])

    op.create_table(
        "team_scenario_selections",
        *timestamps(),
        uuid_pk(),
        sa.Column("league_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("team_id", sa.Uuid(), nullable=False),
        sa.Column("scenario_name", sa.String(length=120), nullable=False),
        sa.ForeignKeyConstraint(["league_id"], ["leagues.id"]),
        sa.ForeignKeyConstraint(["team_id"], ["teams.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "league_id",
            "user_id",
            "team_id",
            name="uq_team_scenario_selections_league_user_team",
        ),
    )
    op.create_index(
        "ix_team_scenario_selections_league_id",
        "team_scenario_selections",
        ["league_id"],
    )
    op.create_index(
        "ix_team_scenario_selections_team_id",
        "team_scenario_selections",
        ["team_id"],
    )
    op.create_index(
        "ix_team_scenario_selections_user_id",
        "team_scenario_selections",
        ["user_id"],
    )


def downgrade() -> None:
    for table_name in (
        "team_scenario_selections",
        "manual_overrides",
        "keeper_recommendations",
        "keeper_candidates",
        "final_roster_entries",
        "draft_picks",
        "adp_entries",
        "teams",
        "optimizer_settings",
        "adp_snapshots",
        "users",
        "players",
        "leagues",
        "app_default_optimizer_settings",
    ):
        op.drop_table(table_name)
