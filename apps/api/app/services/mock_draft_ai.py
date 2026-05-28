from __future__ import annotations

from dataclasses import dataclass
import json
from typing import Any
from urllib import error, request
import uuid

from app.core.config import Settings


class MockDraftAIError(RuntimeError):
    pass


@dataclass(frozen=True)
class AIBotPickDecision:
    player_id: uuid.UUID
    reasoning_summary: str
    confidence: float | None = None
    token_usage: dict[str, Any] | None = None


@dataclass(frozen=True)
class AIAnalysisDecision:
    summary: str | None = None
    strengths: list[dict[str, str]] | None = None
    weaknesses: list[dict[str, str]] | None = None
    what_if_scenarios: list[dict[str, Any]] | None = None
    future_advice: list[dict[str, str]] | None = None
    token_usage: dict[str, Any] | None = None


@dataclass(frozen=True)
class AIStrategyPlanDecision:
    summary: str
    round_plan: list[dict[str, Any]]
    position_priorities: list[dict[str, Any]]
    targets: list[dict[str, Any]]
    fades: list[dict[str, Any]]
    contingencies: list[dict[str, Any]]
    token_usage: dict[str, Any] | None = None


def is_enabled(settings: Settings) -> bool:
    return bool(settings.mock_draft_ai_enabled and settings.openai_api_key)


def choose_bot_player(
    *,
    settings: Settings,
    context: dict[str, Any],
    valid_player_ids: set[uuid.UUID],
) -> AIBotPickDecision:
    if not is_enabled(settings):
        raise MockDraftAIError("Mock draft AI is not enabled")
    schema = {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "player_id": {"type": "string"},
            "reasoning_summary": {"type": "string", "maxLength": 500},
            "confidence": {"type": "number", "minimum": 0, "maximum": 1},
        },
        "required": ["player_id", "reasoning_summary", "confidence"],
    }
    data, usage = _responses_json(
        settings=settings,
        name="mock_draft_bot_pick",
        schema=schema,
        instructions=(
            "You are making one fantasy football mock draft pick for a bot team. "
            "Choose exactly one player_id from candidate_players. Respect roster needs, "
            "position limits, ADP value, projections, and the bot personality. Return concise JSON only."
        ),
        user_payload=context,
        max_output_tokens=700,
    )
    player_id = _uuid_from_value(data.get("player_id"))
    if player_id not in valid_player_ids:
        raise MockDraftAIError("AI selected a player that is not available")
    reasoning = str(data.get("reasoning_summary") or "AI selected the best available roster fit.")[:500]
    confidence = data.get("confidence")
    return AIBotPickDecision(
        player_id=player_id,
        reasoning_summary=reasoning,
        confidence=confidence if isinstance(confidence, int | float) else None,
        token_usage=usage,
    )


def generate_strategy_plan(
    *,
    settings: Settings,
    context: dict[str, Any],
) -> AIStrategyPlanDecision:
    if not is_enabled(settings):
        raise MockDraftAIError("Mock draft AI is not enabled")
    round_schema = {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "round": {"type": "integer", "minimum": 1},
            "priority": {"type": "string", "maxLength": 160},
            "avoid": {"type": "string", "maxLength": 160},
            "notes": {"type": "string", "maxLength": 300},
        },
        "required": ["round", "priority", "avoid", "notes"],
    }
    priority_schema = {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "position": {"type": "string", "maxLength": 20},
            "priority": {"type": "string", "enum": ["high", "medium", "low"]},
            "reason": {"type": "string", "maxLength": 300},
        },
        "required": ["position", "priority", "reason"],
    }
    player_schema = {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "player_id": {"type": "string"},
            "player_name": {"type": "string", "maxLength": 120},
            "reason": {"type": "string", "maxLength": 300},
            "acceptable_range": {"type": "string", "maxLength": 80},
        },
        "required": ["player_id", "player_name", "reason", "acceptable_range"],
    }
    contingency_schema = {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "trigger": {"type": "string", "maxLength": 200},
            "action": {"type": "string", "maxLength": 300},
        },
        "required": ["trigger", "action"],
    }
    schema = {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "summary": {"type": "string", "maxLength": 700},
            "round_plan": {"type": "array", "items": round_schema, "maxItems": 30},
            "position_priorities": {"type": "array", "items": priority_schema, "maxItems": 8},
            "targets": {"type": "array", "items": player_schema, "maxItems": 12},
            "fades": {"type": "array", "items": player_schema, "maxItems": 8},
            "contingencies": {"type": "array", "items": contingency_schema, "maxItems": 6},
        },
        "required": [
            "summary",
            "round_plan",
            "position_priorities",
            "targets",
            "fades",
            "contingencies",
        ],
    }
    data, usage = _responses_json(
        settings=settings,
        name="mock_draft_strategy_plan",
        schema=schema,
        instructions=(
            "You are a fantasy football pre-draft strategy coach. Build a compact strategy plan for the "
            "user's team using only supplied player IDs, ADP, keeper context, roster settings, and draft slot. "
            "Respect superflex value, roster limits, and keeper forfeits. Do not invent players. Return JSON only."
        ),
        user_payload=context,
        max_output_tokens=5000,
    )
    return AIStrategyPlanDecision(
        summary=_optional_string(data.get("summary")) or "",
        round_plan=_list_of_dicts(data.get("round_plan")) or [],
        position_priorities=_list_of_dicts(data.get("position_priorities")) or [],
        targets=_list_of_dicts(data.get("targets")) or [],
        fades=_list_of_dicts(data.get("fades")) or [],
        contingencies=_list_of_dicts(data.get("contingencies")) or [],
        token_usage=usage,
    )


def generate_draft_analysis(
    *,
    settings: Settings,
    context: dict[str, Any],
) -> AIAnalysisDecision:
    if not is_enabled(settings):
        raise MockDraftAIError("Mock draft AI is not enabled")
    item_schema = {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "label": {"type": "string"},
            "detail": {"type": "string"},
        },
        "required": ["label", "detail"],
    }
    scenario_schema = {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "name": {"type": "string"},
            "changed_picks": {"type": "integer"},
            "score_delta": {"type": "integer"},
            "recommendation": {"type": "string"},
        },
        "required": ["name", "changed_picks", "score_delta", "recommendation"],
    }
    schema = {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "summary": {"type": "string", "maxLength": 900},
            "strengths": {"type": "array", "items": item_schema, "maxItems": 5},
            "weaknesses": {"type": "array", "items": item_schema, "maxItems": 5},
            "what_if_scenarios": {"type": "array", "items": scenario_schema, "maxItems": 4},
            "future_advice": {"type": "array", "items": item_schema, "maxItems": 5},
        },
        "required": ["summary", "strengths", "weaknesses", "what_if_scenarios", "future_advice"],
    }
    data, usage = _responses_json(
        settings=settings,
        name="mock_draft_analysis",
        schema=schema,
        instructions=(
            "You are a fantasy football draft analyst. Improve the narrative analysis using the provided "
            "deterministic scores, roster needs, ADP values, pick feedback, and league settings. "
            "Apply these rules strictly:\n"
            "1. SUPERFLEX/QB DEPTH: If is_superflex is true, having 2-3 QBs is standard and healthy — "
            "never flag QB count of 2-3 as overinvestment. Only flag a QB as a reach if it was drafted "
            "significantly early versus ADP AND the team already had a starter-quality QB. "
            "If the team has 3 QBs in a superflex league with 2 starter spots (QB + SUPERFLEX), "
            "the third QB is a normal depth pick — at most note tier quality, never overinvestment.\n"
            "2. KICKER / DST LAST ROUND: Any pick with is_last_round=true and position K or DST must NOT "
            "be flagged as a reach, weakness, or what-if scenario regardless of value_vs_adp. "
            "There is no opportunity cost on the final pick; kicker ADP is irrelevant in the last round.\n"
            "3. Use scoring_format and is_superflex to calibrate all positional value judgments.\n"
            "Do not invent players or contradict the supplied pick data. Return concise JSON only."
        ),
        user_payload=context,
        max_output_tokens=1600,
    )
    return AIAnalysisDecision(
        summary=_optional_string(data.get("summary")),
        strengths=_list_of_label_details(data.get("strengths")),
        weaknesses=_list_of_label_details(data.get("weaknesses")),
        what_if_scenarios=_list_of_dicts(data.get("what_if_scenarios")),
        future_advice=_list_of_label_details(data.get("future_advice")),
        token_usage=usage,
    )


def _responses_json(
    *,
    settings: Settings,
    name: str,
    schema: dict[str, Any],
    instructions: str,
    user_payload: dict[str, Any],
    max_output_tokens: int,
    timeout_seconds: float | None = None,
) -> tuple[dict[str, Any], dict[str, Any] | None]:
    payload = {
        "model": settings.mock_draft_ai_model,
        "instructions": instructions,
        "input": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "input_text",
                        "text": json.dumps(user_payload, default=str, separators=(",", ":")),
                    }
                ],
            }
        ],
        "text": {
            "format": {
                "type": "json_schema",
                "name": name,
                "schema": schema,
                "strict": True,
            }
        },
        "max_output_tokens": max_output_tokens,
    }
    response_body = _post_json(settings, "/responses", payload, timeout_seconds=timeout_seconds)
    if response_body.get("status") == "incomplete":
        details = response_body.get("incomplete_details")
        reason = details.get("reason") if isinstance(details, dict) else None
        raise MockDraftAIError(f"AI response was incomplete{f': {reason}' if reason else ''}")
    text = _extract_response_text(response_body)
    data = _loads_json_object(text)
    if not isinstance(data, dict):
        raise MockDraftAIError("AI response JSON must be an object")
    usage = response_body.get("usage")
    return data, (usage if isinstance(usage, dict) else None)


def _post_json(
    settings: Settings,
    path: str,
    payload: dict[str, Any],
    *,
    timeout_seconds: float | None = None,
) -> dict[str, Any]:
    if not settings.openai_api_key:
        raise MockDraftAIError("OpenAI API key is missing")
    url = settings.openai_base_url.rstrip("/") + path
    encoded = json.dumps(payload).encode("utf-8")
    http_request = request.Request(
        url,
        data=encoded,
        headers={
            "Authorization": f"Bearer {settings.openai_api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    effective_timeout = timeout_seconds if timeout_seconds is not None else settings.mock_draft_ai_timeout_seconds
    try:
        with request.urlopen(http_request, timeout=effective_timeout) as response:
            response_text = response.read().decode("utf-8")
    except TimeoutError as exc:
        raise MockDraftAIError("OpenAI request timed out") from exc
    except error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise MockDraftAIError(f"OpenAI request failed with status {exc.code}: {detail[:500]}") from exc
    except error.URLError as exc:
        raise MockDraftAIError(f"OpenAI request failed: {exc.reason}") from exc
    try:
        data = json.loads(response_text)
    except json.JSONDecodeError as exc:
        raise MockDraftAIError("OpenAI response was not valid JSON") from exc
    if not isinstance(data, dict):
        raise MockDraftAIError("OpenAI response must be a JSON object")
    if data.get("error"):
        raise MockDraftAIError(f"OpenAI returned an error: {data['error']}")
    return data


def _extract_response_text(response_body: dict[str, Any]) -> str:
    output_text = response_body.get("output_text")
    if isinstance(output_text, str) and output_text.strip():
        return output_text
    for item in response_body.get("output") or []:
        if not isinstance(item, dict):
            continue
        for content in item.get("content") or []:
            if not isinstance(content, dict):
                continue
            text = content.get("text")
            if isinstance(text, str) and text.strip():
                return text
    raise MockDraftAIError("OpenAI response did not contain output text")


def _loads_json_object(text: str) -> dict[str, Any]:
    candidates = [text.strip()]
    stripped = _strip_code_fence(text)
    if stripped not in candidates:
        candidates.append(stripped)
    extracted = _extract_json_object(text)
    if extracted and extracted not in candidates:
        candidates.append(extracted)
    for candidate in candidates:
        try:
            data = json.loads(candidate)
        except json.JSONDecodeError:
            continue
        if isinstance(data, dict):
            return data
    raise MockDraftAIError("AI response was not valid JSON")


def _strip_code_fence(text: str) -> str:
    stripped = text.strip()
    if not stripped.startswith("```"):
        return stripped
    lines = stripped.splitlines()
    if len(lines) >= 2 and lines[-1].strip() == "```":
        return "\n".join(lines[1:-1]).strip()
    return stripped


def _extract_json_object(text: str) -> str | None:
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return None
    return text[start : end + 1]


def _uuid_from_value(value: Any) -> uuid.UUID:
    try:
        return uuid.UUID(str(value))
    except (TypeError, ValueError) as exc:
        raise MockDraftAIError("AI returned an invalid player_id") from exc


def _optional_string(value: Any) -> str | None:
    if isinstance(value, str) and value.strip():
        return value.strip()
    return None


def _list_of_label_details(value: Any) -> list[dict[str, str]] | None:
    items = _list_of_dicts(value)
    if items is None:
        return None
    cleaned = []
    for item in items:
        label = _optional_string(item.get("label"))
        detail = _optional_string(item.get("detail"))
        if label and detail:
            cleaned.append({"label": label[:120], "detail": detail[:500]})
    return cleaned or None


def _list_of_dicts(value: Any) -> list[dict[str, Any]] | None:
    if not isinstance(value, list):
        return None
    return [item for item in value if isinstance(item, dict)]
