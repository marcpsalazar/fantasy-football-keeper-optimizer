from sqlalchemy import inspect, text
from sqlalchemy.engine import Connection
from collections.abc import Generator
from uuid import uuid4

from sqlmodel import Session, SQLModel, create_engine

from app.core.config import get_settings


settings = get_settings()
engine = create_engine(settings.sqlalchemy_database_url, pool_pre_ping=True)


def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session


def init_db() -> None:
    import app.models  # noqa: F401

    SQLModel.metadata.create_all(engine)
    _apply_lightweight_sqlite_migrations()


def _apply_lightweight_sqlite_migrations() -> None:
    if engine.dialect.name != "sqlite":
        return

    column_additions = {
        "users": [("avatar_data_url", "TEXT"), ("alias", "VARCHAR(120)")],
        "teams": [("user_id", "CHAR(32)")],
        "optimizer_settings": [
            ("user_id", "CHAR(32)"),
            ("enable_elite_player_bonus", "BOOLEAN DEFAULT 1"),
            ("elite_player_max_negative_edge", "FLOAT DEFAULT 12"),
        ],
        "manual_overrides": [("user_id", "CHAR(32)")],
        "keeper_recommendations": [("user_id", "CHAR(32)")],
        "app_default_optimizer_settings": [
            ("enable_elite_player_bonus", "BOOLEAN DEFAULT 1"),
            ("elite_player_max_negative_edge", "FLOAT DEFAULT 12"),
        ],
        "adp_entries": [
            ("sos", "FLOAT"),
            ("injury", "FLOAT"),
            ("risk", "FLOAT"),
            ("floor_projection", "FLOAT"),
            ("consensus_projection", "FLOAT"),
            ("draftsharks_projection", "FLOAT"),
            ("ceiling_projection", "FLOAT"),
            ("draftsharks_3d_value", "FLOAT"),
        ],
    }
    inspector = inspect(engine)
    with engine.begin() as connection:
        _cleanup_interrupted_sqlite_rebuild(connection, "manual_overrides")
        _cleanup_interrupted_sqlite_rebuild(connection, "optimizer_settings")
        existing_tables = set(inspector.get_table_names())
        for table_name, columns in column_additions.items():
            if table_name not in existing_tables:
                continue
            existing_columns = {column["name"] for column in inspector.get_columns(table_name)}
            for column_name, column_type in columns:
                if column_name not in existing_columns:
                    connection.execute(
                        text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_type}")
                    )

        if _has_unique_index(connection, "manual_overrides", ["league_id", "team_id", "player_id"]):
            _rebuild_sqlite_table(connection, "manual_overrides")
        if _has_unique_index(connection, "optimizer_settings", ["league_id", "name"]):
            _rebuild_sqlite_table(connection, "optimizer_settings")


def _has_unique_index(connection: Connection, table_name: str, columns: list[str]) -> bool:
    indexes = connection.execute(text(f"PRAGMA index_list({table_name})")).mappings().all()
    for index in indexes:
        if not index["unique"]:
            continue
        index_columns = connection.execute(text(f"PRAGMA index_info({index['name']})")).mappings().all()
        if [column["name"] for column in index_columns] == columns:
            return True
    return False


def _rebuild_sqlite_table(connection: Connection, table_name: str) -> None:
    table = SQLModel.metadata.tables[table_name]
    legacy_table = f"{table_name}_legacy_{uuid4().hex}"
    connection.execute(text("PRAGMA foreign_keys=OFF"))
    connection.execute(text(f"ALTER TABLE {table_name} RENAME TO {legacy_table}"))
    _drop_sqlite_indexes(connection, legacy_table)
    table.create(connection)

    legacy_columns = {
        column["name"]
        for column in connection.execute(text(f"PRAGMA table_info({legacy_table})")).mappings().all()
    }
    target_columns = [column.name for column in table.columns]
    select_expressions = [
        column_name if column_name in legacy_columns else f"NULL AS {column_name}"
        for column_name in target_columns
    ]
    connection.execute(
        text(
            f"INSERT INTO {table_name} ({', '.join(target_columns)}) "
            f"SELECT {', '.join(select_expressions)} FROM {legacy_table}"
        )
    )
    connection.execute(text(f"DROP TABLE {legacy_table}"))
    connection.execute(text("PRAGMA foreign_keys=ON"))


def _cleanup_interrupted_sqlite_rebuild(connection: Connection, table_name: str) -> None:
    legacy_tables = [
        row["name"]
        for row in connection.execute(
            text(
                "SELECT name FROM sqlite_master "
                "WHERE type = 'table' AND name LIKE :pattern"
            ),
            {"pattern": f"{table_name}_legacy_%"},
        ).mappings()
    ]
    if not legacy_tables:
        return

    current_exists = connection.execute(
        text("SELECT name FROM sqlite_master WHERE type = 'table' AND name = :table_name"),
        {"table_name": table_name},
    ).first()
    if current_exists is None:
        connection.execute(text(f"ALTER TABLE {legacy_tables[0]} RENAME TO {table_name}"))
        return

    for legacy_table in legacy_tables:
        _copy_legacy_rows(connection, source_table=legacy_table, target_table=table_name)
        _drop_sqlite_indexes(connection, legacy_table)
        connection.execute(text(f"DROP TABLE {legacy_table}"))


def _copy_legacy_rows(connection: Connection, *, source_table: str, target_table: str) -> None:
    table = SQLModel.metadata.tables[target_table]
    source_columns = {
        column["name"]
        for column in connection.execute(text(f"PRAGMA table_info({source_table})")).mappings().all()
    }
    target_columns = [column.name for column in table.columns]
    select_expressions = [
        column_name if column_name in source_columns else f"NULL AS {column_name}"
        for column_name in target_columns
    ]
    connection.execute(
        text(
            f"INSERT OR IGNORE INTO {target_table} ({', '.join(target_columns)}) "
            f"SELECT {', '.join(select_expressions)} FROM {source_table}"
        )
    )


def _drop_sqlite_indexes(connection: Connection, table_name: str) -> None:
    indexes = connection.execute(text(f"PRAGMA index_list({table_name})")).mappings().all()
    for index in indexes:
        if index["origin"] == "c":
            connection.execute(text(f"DROP INDEX IF EXISTS {index['name']}"))
