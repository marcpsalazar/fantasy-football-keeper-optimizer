from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from typing import Any
import uuid

from app.core.config import Settings
from app.services.mock_draft_ai import MockDraftAIError, _responses_json


ENTITY_TYPE = "scenario_narrative"


@dataclass(frozen=True)
class ScenarioNarrativeResult:
    summary: str
    best_fit: str
    tradeoffs: list[dict[str, str]]
    decision_notes: list[str]
    token_usage: dict[str, Any] | None = None


def is_enabled(settings: Settings) -> bool:
    return bool(settings.scenario_narrative_ai_enabled and settings.openai_api_key)


def generate_scenario_narrative(
    *,
    settings: Settings,
    context: dict[str, Any],
) -> ScenarioNarrativeResult:
    if not is_enabled(settings):
        raise MockDraftAIError("Scenario narrative AI is not enabled")

    is_personalized = context.get("analysis_mode") == "personalized"
    if is_personalized:
        team_name = context.get("your_team", "your team")
        instructions = (
            f"You are a fantasy football analyst giving personalized keeper advice for {team_name}. "
            "The context lists their keeper options per scenario — players kept and picks forfeited. "
            "IMPORTANT: Scenarios marked with 'identical_keepers_to' share the exact same players as another scenario. "
            "When keeper sets are identical, treat those scenarios as strategically equivalent — "
            "do not imply one is better than the other based on scores, because score differences "
            "between identical keeper sets reflect different scoring weights, not real value differences. "
            "Focus your analysis on scenarios where the keeper set actually differs, "
            "and on picks forfeited as the key differentiator between identical-keeper scenarios. "
            f"Set 'best_fit' to the scenario that genuinely best fits {team_name}'s situation. "
            "Make decision_notes specific to their actual players and picks forfeited. "
            "Do not contradict the data. Return JSON only."
        )
    else:
        instructions = (
            "You are a fantasy football analyst comparing keeper strategy presets. "
            "Given the scenario data — keeper sets, total scores, picks forfeited — "
            "write a plain-English summary of the tradeoffs. "
            "Set 'best_fit' to the scenario name that best balances value and flexibility for most teams. "
            "Do not contradict numeric data. Return JSON only."
        )

    tradeoff_schema = {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "scenario": {"type": "string", "maxLength": 60},
            "benefit": {"type": "string", "maxLength": 300},
            "cost": {"type": "string", "maxLength": 300},
        },
        "required": ["scenario", "benefit", "cost"],
    }
    schema = {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "summary": {"type": "string", "maxLength": 700},
            "best_fit": {"type": "string", "maxLength": 60},
            "tradeoffs": {"type": "array", "items": tradeoff_schema, "maxItems": 5},
            "decision_notes": {
                "type": "array",
                "items": {"type": "string", "maxLength": 300},
                "maxItems": 5,
            },
        },
        "required": ["summary", "best_fit", "tradeoffs", "decision_notes"],
    }
    data, usage = _responses_json(
        settings=settings,
        name="scenario_narrative",
        schema=schema,
        instructions=instructions,
        user_payload=context,
        max_output_tokens=900,
        timeout_seconds=settings.scenario_narrative_ai_timeout_seconds,
    )
    return ScenarioNarrativeResult(
        summary=str(data.get("summary") or "")[:700],
        best_fit=str(data.get("best_fit") or "")[:60],
        tradeoffs=_clean_tradeoffs(data.get("tradeoffs")),
        decision_notes=_clean_string_list(data.get("decision_notes")),
        token_usage=usage,
    )


def narrative_input_hash(
    *,
    league_id: uuid.UUID,
    user_id: uuid.UUID | None,
    scenario_summaries: list[dict[str, Any]],
) -> str:
    key = {
        "league_id": str(league_id),
        "user_id": str(user_id) if user_id else None,
        "scenarios": sorted(
            scenario_summaries,
            key=lambda s: s.get("scenario_name", ""),
        ),
    }
    return hashlib.sha256(json.dumps(key, sort_keys=True).encode()).hexdigest()


def build_narrative_context(
    *,
    scoring_format: str,
    draft_type: str,
    team_count: int,
    scenarios: list[dict[str, Any]],
    user_team_context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    if user_team_context is not None:
        return {
            "scoring_format": scoring_format,
            "draft_type": draft_type,
            "team_count": team_count,
            "analysis_mode": "personalized",
            "your_team": user_team_context.get("team_name", ""),
            "scenarios": user_team_context.get("scenarios", []),
        }
    return {
        "scoring_format": scoring_format,
        "draft_type": draft_type,
        "team_count": team_count,
        "analysis_mode": "generic",
        "scenarios": scenarios,
    }


def _clean_tradeoffs(value: Any) -> list[dict[str, str]]:
    if not isinstance(value, list):
        return []
    out = []
    for item in value:
        if not isinstance(item, dict):
            continue
        scenario = str(item.get("scenario") or "")[:60]
        benefit = str(item.get("benefit") or "")[:300]
        cost = str(item.get("cost") or "")[:300]
        if scenario:
            out.append({"scenario": scenario, "benefit": benefit, "cost": cost})
    return out[:5]


def _clean_string_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item)[:300] for item in value if isinstance(item, str) and item.strip()][:5]
