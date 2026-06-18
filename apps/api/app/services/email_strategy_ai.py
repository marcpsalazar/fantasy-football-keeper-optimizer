from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.core.config import Settings
from app.services.mock_draft_ai import MockDraftAIError, _responses_json


@dataclass(frozen=True)
class EmailStrategyResult:
    strategy_headline: str
    strategy_bullets: list[str]
    featured_player: str | None
    token_usage: dict[str, Any] | None = None


def is_enabled(settings: Settings) -> bool:
    return bool(settings.email_strategy_ai_enabled and settings.openai_api_key)


def generate_email_strategy(
    *,
    settings: Settings,
    context: dict[str, Any],
) -> EmailStrategyResult:
    if not is_enabled(settings):
        raise MockDraftAIError("Email strategy AI is not enabled")

    schema = {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "strategy_headline": {"type": "string", "maxLength": 120},
            "strategy_bullets": {
                "type": "array",
                "items": {"type": "string", "maxLength": 200},
                "minItems": 2,
                "maxItems": 4,
            },
            "featured_player": {"type": ["string", "null"], "maxLength": 80},
        },
        "required": ["strategy_headline", "strategy_bullets", "featured_player"],
    }

    data, usage = _responses_json(
        settings=settings,
        name="email_strategy",
        schema=schema,
        instructions=(
            "You are an energetic, witty fantasy football analyst writing a personalized strategy "
            "section for a keeper league email reminder. Your tone is fun, confident, and engaging — "
            "like a knowledgeable friend who loves fantasy football. "
            "Given the owner's team, roster, scoring format, keeper deadline, and any relevant news, "
            "write: a punchy one-liner headline about their team situation, "
            "2–4 specific actionable strategy bullets tailored to their actual players, "
            "and optionally a featured_player name (from their roster) worth spotlighting. "
            "Be specific — mention actual player names. Return JSON only."
        ),
        user_payload=context,
        max_output_tokens=600,
        timeout_seconds=settings.email_strategy_ai_timeout_seconds,
    )

    bullets = data.get("strategy_bullets") or []
    if not isinstance(bullets, list):
        bullets = []

    return EmailStrategyResult(
        strategy_headline=str(data.get("strategy_headline") or "")[:120],
        strategy_bullets=[str(b)[:200] for b in bullets[:4]],
        featured_player=str(data["featured_player"])[:80] if data.get("featured_player") else None,
        token_usage=usage,
    )


def build_strategy_context(
    *,
    owner_name: str,
    team_name: str,
    league_name: str,
    season_year: int,
    scoring_format: str,
    keeper_pick_deadline: str | None,
    draft_date: str | None,
    players: list[dict[str, Any]],
    news_items: list[dict[str, str]],
) -> dict[str, Any]:
    return {
        "owner_name": owner_name,
        "team_name": team_name,
        "league_name": league_name,
        "season_year": season_year,
        "scoring_format": scoring_format,
        "keeper_pick_deadline": keeper_pick_deadline,
        "draft_date": draft_date,
        "players": players,
        "relevant_news": news_items,
    }
