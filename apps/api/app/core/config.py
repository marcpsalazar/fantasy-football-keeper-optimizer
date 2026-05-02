from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Fantasy Football Keeper Optimizer API"
    environment: str = "development"
    database_url: str = "postgresql+psycopg://keeper:keeper@localhost:5432/keeper_optimizer"
    cors_origins: list[str] = Field(
        default_factory=lambda: ["http://localhost:3000", "http://127.0.0.1:3000"]
    )
    create_tables_on_startup: bool = False
    seed_data_on_startup: bool = False
    sample_data_path: str = "sample-data"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
