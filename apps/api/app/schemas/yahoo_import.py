from __future__ import annotations

from pydantic import BaseModel


class YahooImportRequest(BaseModel):
    yahoo_league_key: str
    season_year: int | None = None
    import_league_settings: bool = True


class YahooLeagueInfo(BaseModel):
    league_key: str
    league_id: str
    name: str
    num_teams: int
    season: str
    scoring_type: str
    draft_type: str
    url: str | None = None


class YahooPreviewTeam(BaseModel):
    team_key: str
    draft_position: int
    name: str
    owner_name: str | None
    player_count: int


class YahooLeagueSettingsPreview(BaseModel):
    scoring_format: str
    draft_type: str
    roster_settings: dict


class YahooPreviewResult(BaseModel):
    valid: bool
    season_year: int
    league_name: str
    teams: list[YahooPreviewTeam]
    draft_picks_count: int
    roster_entries_count: int
    league_settings_preview: YahooLeagueSettingsPreview | None
    warnings: list[str]
    errors: list[str]


class YahooImportResult(BaseModel):
    season_year: int
    league_name: str
    teams_upserted: int
    draft_picks_upserted: int
    roster_entries_upserted: int
    league_settings_updated: bool
    warnings: list[str]


class YahooUserLeague(BaseModel):
    league_key: str
    name: str
    season: str
    num_teams: int
    scoring_type: str
