from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from typing import Any
import uuid

from app.core.config import Settings
from app.services.mock_draft_ai import MockDraftAIError, _responses_json


ENTITY_TYPE = "player"


@dataclass(frozen=True)
class PlayerSummaryResult:
    quick_take: str
    fantasy_points_context: str
    value_note: str
    risk_note: str
    roster_fit: str
    draft_recommendation: str  # "draft now" | "target next round" | "watchlist" | "avoid"
    token_usage: dict[str, Any] | None = None


def is_enabled(settings: Settings) -> bool:
    return bool(settings.player_summary_ai_enabled and settings.openai_api_key)


def generate_player_summary(
    *,
    settings: Settings,
    context: dict[str, Any],
) -> PlayerSummaryResult:
    if not is_enabled(settings):
        raise MockDraftAIError("Player summary AI is not enabled")
    schema = {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "quick_take": {"type": "string", "maxLength": 200},
            "fantasy_points_context": {"type": "string", "maxLength": 300},
            "value_note": {"type": "string", "maxLength": 200},
            "risk_note": {"type": "string", "maxLength": 200},
            "roster_fit": {"type": "string", "maxLength": 200},
            "draft_recommendation": {
                "type": "string",
                "enum": ["draft now", "target next round", "watchlist", "avoid"],
            },
        },
        "required": [
            "quick_take",
            "fantasy_points_context",
            "value_note",
            "risk_note",
            "roster_fit",
            "draft_recommendation",
        ],
    }
    data, usage = _responses_json(
        settings=settings,
        name="player_summary",
        schema=schema,
        instructions=(
            "You are a fantasy football analyst providing a quick snap-decision summary for a draft pick. "
            "Given the player's position, ADP, projections (may be null), and league scoring format, "
            "write concise analysis to help a drafter decide in seconds. "
            "quick_take: one sentence on why this player is or isn't worth drafting here. "
            "fantasy_points_context: contextualize projected points or ADP relative to position tier "
            "(use ADP rank among position if projections are null). "
            "value_note: whether this player is value, fair price, or a reach at their ADP. "
            "risk_note: key risk factor or injury concern (write 'Low injury history' if no notable risks). "
            "roster_fit: how this player fits the scoring format and typical roster construction. "
            "draft_recommendation based on ADP value: "
            "draft now (strong value or top-tier at current pick), "
            "target next round (slight reach, may be available one round later), "
            "watchlist (wait for a later round), "
            "avoid (overvalued or high risk relative to ADP). "
            "Return JSON only."
        ),
        user_payload=context,
        max_output_tokens=400,
        timeout_seconds=settings.player_summary_ai_timeout_seconds,
    )
    return PlayerSummaryResult(
        quick_take=str(data.get("quick_take") or "")[:200],
        fantasy_points_context=str(data.get("fantasy_points_context") or "")[:300],
        value_note=str(data.get("value_note") or "")[:200],
        risk_note=str(data.get("risk_note") or "")[:200],
        roster_fit=str(data.get("roster_fit") or "")[:200],
        draft_recommendation=str(data.get("draft_recommendation") or "watchlist"),
        token_usage=usage,
    )


def summary_input_hash(
    *,
    player_id: uuid.UUID,
    adp_snapshot_id: uuid.UUID,
    scoring_format: str,
    draft_type: str,
) -> str:
    key = {
        "player_id": str(player_id),
        "adp_snapshot_id": str(adp_snapshot_id),
        "scoring_format": scoring_format,
        "draft_type": draft_type,
    }
    return hashlib.sha256(json.dumps(key, sort_keys=True).encode()).hexdigest()


def build_summary_context(
    *,
    player_name: str,
    position: str,
    nfl_team: str | None,
    adp_pick: float,
    adp_round: float | None,
    consensus_projection: float | None,
    floor_projection: float | None,
    ceiling_projection: float | None,
    risk: float | None,
    sos: float | None,
    scoring_format: str,
    draft_type: str,
    team_count: int,
    board_size: int,
) -> dict[str, Any]:
    return {
        "player_name": player_name,
        "position": position,
        "nfl_team": nfl_team,
        "adp_pick": adp_pick,
        "adp_round": adp_round,
        "consensus_projection": consensus_projection,
        "floor_projection": floor_projection,
        "ceiling_projection": ceiling_projection,
        "risk": risk,
        "strength_of_schedule": sos,
        "scoring_format": scoring_format,
        "draft_type": draft_type,
        "team_count": team_count,
        "board_size": board_size,
    }
