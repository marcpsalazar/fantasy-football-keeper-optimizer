from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, date, datetime
import json
from typing import Any
from urllib import error, request

from sqlmodel import Session, select

from app.core.config import Settings
from app.models import ADPEntry, ADPSnapshot, League, Player


class AIADPError(RuntimeError):
    pass


ALLOWED_POSITIONS = {"QB", "RB", "WR", "TE", "K", "DST"}
TEAM_DEFENSE_ALIASES = {"DEF", "D/ST", "DST"}
SPECIAL_TEAM_MIN_ADP_PICK = 100
PLACEHOLDER_PLAYER_NAMES = {
    "defense",
    "defenses",
    "defensespecialteams",
    "dst",
    "kickers",
    "quarterbacks",
    "runningbacks",
    "widereceivers",
    "tightends",
}


@dataclass(frozen=True)
class AIADPRow:
    rank: int
    full_name: str
    position: str
    nfl_team: str | None
    adp_pick: float
    adp_round: float | None
    sources: list[str]
    confidence: str
    source_note: str


@dataclass(frozen=True)
class AIADPBoard:
    rows: list[AIADPRow]
    snapshot_name: str
    snapshot_date: date
    source: str
    notes: str
    source_url: str
    warnings: list[str]


def build_ai_adp_board(
    session: Session,
    league: League,
    settings: Settings,
    *,
    enforce_warning_limit: bool = True,
) -> AIADPBoard:
    if not settings.openai_api_key:
        raise AIADPError("OpenAI API key is not configured")
    board_size = max(1, settings.adp_ai_board_size)
    candidate_count = board_size + max(0, settings.adp_ai_extra_candidates)
    team_count = _team_count(session, league)
    previous = _previous_snapshot_entries(session, league.id)
    response = _responses_json(
        settings=settings,
        schema=_board_schema(candidate_count),
        instructions=(
            "Build a consolidated fantasy football ADP board using current public web information. "
            "Synthesize signals from FantasyPros Superflex consensus rankings, Fantasy Football Calculator "
            "ADP trends, Draft Sharks Superflex rankings, and FFToday positional data when available. "
            "Return only structured JSON. Do not include players you cannot substantiate from current sources."
        ),
        user_payload={
            "task": (
                f"Create a Top {board_size} PPR Superflex ADP board for {league.season_year} redraft leagues, "
                "including QB/RB/WR/TE/K/DST."
            ),
            "league": {
                "name": league.name,
                "season_year": league.season_year,
                "scoring_format": league.scoring_format,
                "team_count": team_count,
            },
            "requirements": {
                "board_size": board_size,
                "candidate_count": candidate_count,
                "positions": sorted(ALLOWED_POSITIONS),
                "unique_player_position_pairs": True,
                "duplicate_rule": (
                    "Each player-position pair may appear at most once. Audit the final players array "
                    "before returning it and replace any duplicate with the next best available player."
                ),
                "rank_rule": f"Ranks must be contiguous integers from 1 through {candidate_count}.",
                "include_at_least_one_kicker": True,
                "include_at_least_one_defense": True,
                "adp_pick": "overall pick number, not round.pick notation",
                "source_note": "12 words or fewer.",
                "source_domains": [
                    "fantasypros.com",
                    "fantasyfootballcalculator.com",
                    "draftsharks.com",
                    "fftoday.com",
                ],
            },
        },
    )
    board = _dedupe_and_trim_board(
        _parse_board(response, league, team_count)
        + _previous_snapshot_fallback_rows(session, league.id, team_count),
        board_size,
    )
    warnings = _validate_board(board, previous, settings, enforce_warning_limit=enforce_warning_limit)
    provenance = {
        "provider": "ai_synthesized",
        "model": settings.mock_draft_ai_model,
        "generated_at": datetime.now(UTC).isoformat(),
        "guardrails": {
            "board_size": board_size,
            "allowed_positions": sorted(ALLOWED_POSITIONS),
            "warning_count": len(warnings),
            "warning_sample": warnings[:5],
            "fallback_fill_count": sum(
                1 for row in board if row.source_note == "Carried forward from previous ADP snapshot."
            ),
        },
        "source_summary": response.get("source_summary"),
    }
    notes = _compact_json(provenance, limit=500)
    return AIADPBoard(
        rows=board,
        snapshot_name=f"{league.name} AI Synthesized ADP",
        snapshot_date=date.today(),
        source="AI Synthesized ADP",
        notes=notes,
        source_url="openai:responses:web_search",
        warnings=warnings,
    )


def board_to_csv(board: AIADPBoard, league: League) -> str:
    lines = [
        "player,position,nfl_team,adp_pick,adp_round,source,snapshot_name,snapshot_date,format,source_note,notes"
    ]
    for row in board.rows:
        lines.append(
            ",".join(
                [
                    _csv_escape(row.full_name),
                    _csv_escape(row.position),
                    _csv_escape(row.nfl_team or ""),
                    f"{row.adp_pick:g}",
                    f"{row.adp_round:g}" if row.adp_round is not None else "",
                    _csv_escape(board.source),
                    _csv_escape(board.snapshot_name),
                    board.snapshot_date.isoformat(),
                    _csv_escape(league.scoring_format),
                    _csv_escape(row.source_note),
                    _csv_escape(board.notes),
                ]
            )
        )
    return "\n".join(lines)


def _responses_json(
    *,
    settings: Settings,
    schema: dict[str, Any],
    instructions: str,
    user_payload: dict[str, Any],
) -> dict[str, Any]:
    payload = {
        "model": settings.mock_draft_ai_model,
        "instructions": instructions,
        "tools": [{"type": "web_search_preview"}],
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
                "name": "ai_adp_board",
                "schema": schema,
                "strict": True,
            }
        },
        "max_output_tokens": settings.adp_ai_max_output_tokens,
    }
    response_body = _post_json(settings, "/responses", payload)
    if response_body.get("status") == "incomplete":
        raise AIADPError(f"AI ADP response was incomplete: {response_body.get('incomplete_details')}")
    text = _extract_response_text(response_body)
    try:
        data = json.loads(text)
    except json.JSONDecodeError as exc:
        raise AIADPError("AI ADP response was not valid JSON") from exc
    if not isinstance(data, dict):
        raise AIADPError("AI ADP response must be a JSON object")
    return data


def _board_schema(board_size: int) -> dict[str, Any]:
    row_schema = {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "rank": {"type": "integer", "minimum": 1, "maximum": board_size},
            "full_name": {"type": "string"},
            "position": {"type": "string", "enum": sorted(ALLOWED_POSITIONS)},
            "nfl_team": {"type": ["string", "null"]},
            "adp_pick": {"type": "number", "minimum": 1},
            "adp_round": {"type": ["number", "null"]},
            "sources": {"type": "array", "items": {"type": "string"}, "minItems": 1, "maxItems": 3},
            "confidence": {"type": "string", "enum": ["high", "medium", "low"]},
            "source_note": {"type": "string", "maxLength": 120},
        },
        "required": [
            "rank",
            "full_name",
            "position",
            "nfl_team",
            "adp_pick",
            "adp_round",
            "sources",
            "confidence",
            "source_note",
        ],
    }
    return {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "source_summary": {"type": "string", "maxLength": 500},
            "players": {
                "type": "array",
                "items": row_schema,
                "minItems": board_size,
                "maxItems": board_size,
            },
        },
        "required": ["source_summary", "players"],
    }


def _post_json(settings: Settings, path: str, payload: dict[str, Any]) -> dict[str, Any]:
    url = settings.openai_base_url.rstrip("/") + path
    http_request = request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {settings.openai_api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with request.urlopen(http_request, timeout=settings.adp_ai_timeout_seconds) as response:
            response_text = response.read().decode("utf-8")
    except error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise AIADPError(f"OpenAI ADP request failed with status {exc.code}: {detail[:500]}") from exc
    except error.URLError as exc:
        raise AIADPError(f"OpenAI ADP request failed: {exc.reason}") from exc
    except TimeoutError as exc:
        raise AIADPError("OpenAI ADP request timed out") from exc
    try:
        data = json.loads(response_text)
    except json.JSONDecodeError as exc:
        raise AIADPError("OpenAI ADP response was not valid JSON") from exc
    if not isinstance(data, dict):
        raise AIADPError("OpenAI ADP response must be a JSON object")
    if data.get("error"):
        raise AIADPError(f"OpenAI returned an ADP error: {data['error']}")
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
    raise AIADPError("OpenAI ADP response did not contain output text")


def _parse_board(payload: dict[str, Any], league: League, team_count: int) -> list[AIADPRow]:
    players = payload.get("players")
    if not isinstance(players, list):
        raise AIADPError("AI ADP response did not include a players array")
    rows: list[AIADPRow] = []
    for item in players:
        if not isinstance(item, dict):
            raise AIADPError("AI ADP player rows must be objects")
        adp_pick = _float(item.get("adp_pick"), "adp_pick")
        rows.append(
            AIADPRow(
                rank=_int(item.get("rank"), "rank"),
                full_name=_string(item.get("full_name"), "full_name"),
                position=_position(_string(item.get("position"), "position")),
                nfl_team=_optional_string(item.get("nfl_team")),
                adp_pick=adp_pick,
                adp_round=_optional_float(item.get("adp_round"))
                or float(_round_for_pick(adp_pick, team_count)),
                sources=_sources(item.get("sources")),
                confidence=_string(item.get("confidence"), "confidence").lower(),
                source_note=_string(item.get("source_note"), "source_note")[:120],
            )
        )
    return rows


def _validate_board(
    rows: list[AIADPRow],
    previous: dict[tuple[str, str], float],
    settings: Settings,
    *,
    enforce_warning_limit: bool = True,
) -> list[str]:
    expected_size = settings.adp_ai_board_size
    if len(rows) != expected_size:
        raise AIADPError(f"AI ADP board must include exactly {expected_size} players")
    keys: set[tuple[str, str]] = set()
    positions: set[str] = set()
    warnings: list[str] = []
    sorted_rows = sorted(rows, key=lambda row: row.rank)
    for expected_rank, row in enumerate(sorted_rows, start=1):
        if row.rank != expected_rank:
            raise AIADPError("AI ADP ranks must be contiguous from 1 through board size")
        if row.position not in ALLOWED_POSITIONS:
            raise AIADPError(f"Unsupported ADP position: {row.position}")
        if _is_placeholder_player_name(row.full_name):
            raise AIADPError(f"AI ADP row is a position placeholder, not a player: {row.full_name}")
        if _is_unsubstantiated_source_note(row.source_note):
            raise AIADPError(f"AI ADP row lacks current-source substantiation: {row.full_name}")
        if _is_implausible_special_team_adp(row.position, row.adp_pick):
            raise AIADPError(f"{row.position} ADP is implausibly early: {row.full_name} at {row.adp_pick:g}")
        if row.adp_pick <= 0:
            raise AIADPError("AI ADP picks must be positive")
        if row.confidence not in {"high", "medium", "low"}:
            raise AIADPError("AI ADP confidence must be high, medium, or low")
        key = (_key(row.full_name), row.position)
        if key in keys:
            raise AIADPError(f"Duplicate AI ADP player: {row.full_name} {row.position}")
        keys.add(key)
        positions.add(row.position)
        previous_adp = previous.get(key)
        if previous_adp is not None and abs(previous_adp - row.adp_pick) > settings.adp_ai_max_jump_warning:
            warnings.append(
                f"{row.full_name} moved from {previous_adp:g} to {row.adp_pick:g}"
            )
    missing_positions = ALLOWED_POSITIONS - positions
    if missing_positions:
        raise AIADPError(f"AI ADP board is missing positions: {', '.join(sorted(missing_positions))}")
    if enforce_warning_limit and len(warnings) > settings.adp_ai_max_jump_warning_count:
        raise AIADPError(
            "AI ADP board has too many large movement warnings versus the previous snapshot"
        )
    return warnings


def _dedupe_and_trim_board(rows: list[AIADPRow], board_size: int) -> list[AIADPRow]:
    unique_rows: list[AIADPRow] = []
    seen: set[tuple[str, str]] = set()
    for row in sorted(rows, key=lambda item: item.rank):
        key = (_key(row.full_name), row.position)
        if key in seen:
            continue
        seen.add(key)
        unique_rows.append(row)
        if len(unique_rows) == board_size:
            break
    if len(unique_rows) != board_size:
        raise AIADPError(f"AI ADP board had only {len(unique_rows)} unique players after de-duplication")
    return [
        AIADPRow(
            rank=index,
            full_name=row.full_name,
            position=row.position,
            nfl_team=row.nfl_team,
            adp_pick=row.adp_pick,
            adp_round=row.adp_round,
            sources=row.sources,
            confidence=row.confidence,
            source_note=row.source_note,
        )
        for index, row in enumerate(unique_rows, start=1)
    ]


def _previous_snapshot_entries(session: Session, league_id: Any) -> dict[tuple[str, str], float]:
    snapshot = session.exec(
        select(ADPSnapshot)
        .where(ADPSnapshot.league_id == league_id)
        .order_by(ADPSnapshot.snapshot_date.desc(), ADPSnapshot.created_at.desc())
    ).first()
    if snapshot is None:
        return {}
    entries = session.exec(select(ADPEntry).where(ADPEntry.snapshot_id == snapshot.id)).all()
    players = {
        player.id: player
        for player in session.exec(select(Player).where(Player.id.in_({entry.player_id for entry in entries}))).all()
    } if entries else {}
    return {
        (_key(players[entry.player_id].full_name), _position(entry.position)): entry.adp_pick
        for entry in entries
        if entry.player_id in players
    }


def _previous_snapshot_fallback_rows(
    session: Session,
    league_id: Any,
    team_count: int,
) -> list[AIADPRow]:
    snapshot = session.exec(
        select(ADPSnapshot)
        .where(ADPSnapshot.league_id == league_id)
        .order_by(ADPSnapshot.snapshot_date.desc(), ADPSnapshot.created_at.desc())
    ).first()
    if snapshot is None:
        return []
    entries = session.exec(
        select(ADPEntry).where(ADPEntry.snapshot_id == snapshot.id).order_by(ADPEntry.adp_pick)
    ).all()
    if not entries:
        return []
    players = {
        player.id: player
        for player in session.exec(select(Player).where(Player.id.in_({entry.player_id for entry in entries}))).all()
    }
    source = snapshot.source or "Previous ADP"
    return [
        AIADPRow(
            rank=10000 + index,
            full_name=players[entry.player_id].full_name,
            position=_position(entry.position),
            nfl_team=players[entry.player_id].nfl_team,
            adp_pick=entry.adp_pick,
            adp_round=entry.adp_round or float(_round_for_pick(entry.adp_pick, team_count)),
            sources=[source[:80]],
            confidence="low",
            source_note="Carried forward from previous ADP snapshot.",
        )
        for index, entry in enumerate(entries, start=1)
        if entry.player_id in players
        and not _is_placeholder_player_name(players[entry.player_id].full_name)
        and not _is_implausible_special_team_adp(_position(entry.position), entry.adp_pick)
    ]


def _team_count(session: Session, league: League) -> int:
    from app.models import Team

    return len(session.exec(select(Team).where(Team.league_id == league.id)).all()) or 12


def _round_for_pick(pick: float, team_count: int) -> int:
    return max(1, int((pick - 1) // max(team_count, 1)) + 1)


def _key(value: str) -> str:
    return "".join(character for character in value.casefold() if character.isalnum())


def _compact_json(payload: dict[str, Any], *, limit: int) -> str:
    text = json.dumps(payload, separators=(",", ":"))
    if len(text) <= limit:
        return text
    compact = dict(payload)
    guardrails = dict(compact.get("guardrails") or {})
    guardrails.pop("warning_sample", None)
    compact["guardrails"] = guardrails
    compact.pop("source_summary", None)
    text = json.dumps(compact, separators=(",", ":"))
    return text[:limit]


def _position(value: str) -> str:
    normalized = value.strip().upper()
    return "DST" if normalized in TEAM_DEFENSE_ALIASES else normalized


def _is_placeholder_player_name(name: str) -> bool:
    normalized = _key(name)
    return (
        normalized in PLACEHOLDER_PLAYER_NAMES
        or "placeholder" in normalized
        or normalized.startswith("source not substantiated")
    )


def _is_unsubstantiated_source_note(note: str | None) -> bool:
    normalized = _key(note or "")
    return "insufficientcurrentsourcesubstantiation" in normalized


def _is_implausible_special_team_adp(position: str, adp_pick: float) -> bool:
    return _position(position) in {"K", "DST"} and adp_pick < SPECIAL_TEAM_MIN_ADP_PICK


def _string(value: Any, field_name: str) -> str:
    if isinstance(value, str) and value.strip():
        return value.strip()
    raise AIADPError(f"AI ADP row missing {field_name}")


def _optional_string(value: Any) -> str | None:
    if isinstance(value, str) and value.strip():
        return value.strip().upper()
    return None


def _float(value: Any, field_name: str) -> float:
    if isinstance(value, int | float):
        return float(value)
    raise AIADPError(f"AI ADP row missing numeric {field_name}")


def _optional_float(value: Any) -> float | None:
    if isinstance(value, int | float):
        return float(value)
    return None


def _int(value: Any, field_name: str) -> int:
    if isinstance(value, int):
        return value
    raise AIADPError(f"AI ADP row missing integer {field_name}")


def _sources(value: Any) -> list[str]:
    if not isinstance(value, list):
        raise AIADPError("AI ADP row missing sources")
    sources = [item.strip() for item in value if isinstance(item, str) and item.strip()]
    if not sources:
        raise AIADPError("AI ADP row must include at least one source")
    return sources[:6]


def _csv_escape(value: str) -> str:
    if any(char in value for char in [",", "\"", "\n"]):
        return f"\"{value.replace('\"', '\"\"')}\""
    return value
