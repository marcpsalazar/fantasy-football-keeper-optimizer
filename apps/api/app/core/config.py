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
    adp_auto_refresh_enabled: bool = True
    adp_auto_refresh_interval_hours: int = 168
    adp_auto_refresh_on_startup: bool = True
    adp_ai_board_size: int = 250
    adp_ai_extra_candidates: int = 100
    adp_ai_review_required: bool = True
    adp_ai_timeout_seconds: float = 180.0
    adp_ai_max_output_tokens: int = 32000
    adp_ai_max_jump_warning: float = 60.0
    adp_ai_max_jump_warning_count: int = 25
    draftsharks_superflex_adp_url: str = "https://www.draftsharks.com/rankings/ppr-superflex"
    fantasy_football_calculator_adp_url: str = "https://fantasyfootballcalculator.com/api/v1/adp"
    sleeper_players_url: str = "https://api.sleeper.app/v1/players/nfl"
    fantasy_nerds_api_key: str | None = None
    fantasy_nerds_adp_url: str = "https://api.fantasynerds.com/v1/nfl/adp"
    session_secret: str = "dev-session-secret-change-me"
    session_cookie_name: str = "keeper_optimizer_session"
    session_cookie_secure: bool | None = None
    session_cookie_samesite: str | None = None
    initial_admin_email: str | None = None
    initial_admin_password: str | None = None
    openai_api_key: str | None = None
    openai_base_url: str = "https://api.openai.com/v1"
    mock_draft_ai_enabled: bool = False
    mock_draft_ai_model: str = "gpt-5.4-mini"
    mock_draft_ai_timeout_seconds: float = 90.0
    mock_draft_ai_candidate_limit: int = 40
    keeper_explanation_ai_enabled: bool = False
    keeper_explanation_model: str = "gpt-5.4-mini"
    keeper_explanation_ai_timeout_seconds: float = 30.0
    scenario_narrative_ai_enabled: bool = False
    scenario_narrative_model: str = "gpt-5.4-mini"
    scenario_narrative_ai_timeout_seconds: float = 45.0
    player_summary_ai_enabled: bool = False
    player_summary_model: str = "gpt-5.4-mini"
    player_summary_ai_timeout_seconds: float = 30.0
    mock_draft_ai_max_ai_round: int = 0
    ai_monthly_token_budget: int = 0
    yahoo_client_id: str | None = None
    yahoo_client_secret: str | None = None
    yahoo_redirect_uri: str = "http://localhost:8000/api/auth/yahoo/callback"
    frontend_url: str = "http://localhost:3000"
    adp_yahoo_player_limit: int = 200
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_username: str | None = None
    smtp_password: str | None = None
    smtp_from_email: str = "noreply@keeperoptimizer.com"
    smtp_from_name: str = "Keeper Optimizer"
    smtp_use_tls: bool = True

    @property
    def use_secure_session_cookie(self) -> bool:
        if self.session_cookie_secure is not None:
            return self.session_cookie_secure
        return self.environment.lower() == "production"

    @property
    def cookie_samesite_policy(self) -> str:
        if self.session_cookie_samesite is not None:
            return self.session_cookie_samesite
        if self.environment.lower() == "production":
            return "none"
        return "lax"

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
