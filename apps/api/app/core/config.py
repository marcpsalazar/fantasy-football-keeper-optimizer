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
    adp_provider: str | None = None
    adp_refresh_url: str | None = None
    adp_refresh_token: str | None = None
    adp_refresh_timeout_seconds: float = 20.0
    draftsharks_superflex_adp_url: str = "https://www.draftsharks.com/rankings/ppr-superflex"
    fantasy_football_calculator_adp_url: str = "https://fantasyfootballcalculator.com/api/v1/adp"
    sleeper_players_url: str = "https://api.sleeper.app/v1/players/nfl"
    fantasy_nerds_api_key: str | None = None
    fantasy_nerds_adp_url: str = "https://api.fantasynerds.com/v1/nfl/adp"
    session_secret: str = "dev-session-secret-change-me"
    session_cookie_name: str = "keeper_optimizer_session"
    session_cookie_secure: bool | None = None
    initial_admin_email: str | None = None
    initial_admin_password: str | None = None

    @property
    def use_secure_session_cookie(self) -> bool:
        if self.session_cookie_secure is not None:
            return self.session_cookie_secure
        return self.environment.lower() == "production"

    @property
    def sqlalchemy_database_url(self) -> str:
        if self.database_url.startswith("postgresql://"):
            return self.database_url.replace("postgresql://", "postgresql+psycopg://", 1)
        return self.database_url

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
