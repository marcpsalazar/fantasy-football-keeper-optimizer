from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from typing import Any
import uuid

from app.core.config import Settings
from app.services.mock_draft_ai import MockDraftAIError, _responses_json


ENTITY_TYPE = "keeper_recommendation"


@dataclass(frozen=True)
class KeeperExplanationResult:
    short_reason: str
    value_explanation: str
    risk_note: str
    opportunity_cost: str
    decision: str  # "strong keep" | "lean keep" | "toss-up" | "avoid"
    token_usage: dict[str, Any] | None = None


def is_enabled(settings: Settings) -> bool:
    return bool(settings.keeper_explanation_ai_enabled and settings.openai_api_key)


def generate_keeper_explanation(
    *,
    settings: Settings,
    context: dict[str, Any],
) -> KeeperExplanationResult:
    if not is_enabled(settings):
        raise MockDraftAIError("Keeper explanation AI is not enabled")
    schema = {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "short_reason": {"type": "string", "maxLength": 160},
            "value_explanation": {"type": "string", "maxLength": 500},
            "risk_note": {"type": "string", "maxLength": 300},
            "opportunity_cost": {"type": "string", "maxLength": 300},
            "decision": {
                "type": "string",
                "enum": ["strong keep", "lean keep", "toss-up", "avoid"],
            },
        },
        "required": [
            "short_reason",
            "value_explanation",
            "risk_note",
            "opportunity_cost",
            "decision",
        ],
    }
    data = _responses_json(
        settings=settings,
        name="keeper_explanation",
        schema=schema,
        instructions=(
            "You are a fantasy football analyst explaining a keeper recommendation. "
            "Given the player data, draft cost, ADP, keeper value, and league settings, "
            "write a concise explanation. Be direct and specific. "
            "Set 'decision' based on keeper_value and keeper_score: "
            "strong keep (value>=15), lean keep (value>=5), toss-up (value>0), avoid (value<=0 or ineligible). "
            "Return JSON only."
        ),
        user_payload=context,
        max_output_tokens=600,
        timeout_seconds=settings.keeper_explanation_ai_timeout_seconds,
    )
    return KeeperExplanationResult(
        short_reason=str(data.get("short_reason") or "")[:160],
        value_explanation=str(data.get("value_explanation") or "")[:500],
        risk_note=str(data.get("risk_note") or "")[:300],
        opportunity_cost=str(data.get("opportunity_cost") or "")[:300],
        decision=str(data.get("decision") or "toss-up"),
    )


def explanation_input_hash(
    *,
    league_id: uuid.UUID,
    user_id: uuid.UUID | None,
    player_id: uuid.UUID,
    scenario_name: str,
    keeper_cost_pick: float | None,
    adp_pick: float | None,
    keeper_score: float | None,
) -> str:
    key = {
        "league_id": str(league_id),
        "user_id": str(user_id) if user_id else None,
        "player_id": str(player_id),
        "scenario_name": scenario_name,
        "keeper_cost_pick": round(keeper_cost_pick or 0, 1),
        "adp_pick": round(adp_pick or 0, 1),
        "keeper_score": round(keeper_score or 0, 2),
    }
    return hashlib.sha256(json.dumps(key, sort_keys=True).encode()).hexdigest()


def build_explanation_context(
    *,
    player_name: str,
    position: str,
    nfl_team: str | None,
    keeper_cost_pick: float | None,
    keeper_cost_round: float | None,
    adp_pick: float | None,
    adp_round: float | None,
    keeper_value: float | None,
    keeper_score: float | None,
    is_recommended: bool,
    is_eligible: bool,
    scenario_name: str,
    scoring_format: str,
    draft_type: str,
    team_count: int,
) -> dict[str, Any]:
    return {
        "player_name": player_name,
        "position": position,
        "nfl_team": nfl_team,
        "keeper_cost_pick": keeper_cost_pick,
        "keeper_cost_round": keeper_cost_round,
        "adp_pick": adp_pick,
        "adp_round": adp_round,
        "keeper_value": keeper_value,
        "keeper_score": keeper_score,
        "is_recommended": is_recommended,
        "is_eligible": is_eligible,
        "scenario_name": scenario_name,
        "scoring_format": scoring_format,
        "draft_type": draft_type,
        "team_count": team_count,
    }
