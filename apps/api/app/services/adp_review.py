from __future__ import annotations

from datetime import UTC, datetime
import json
from typing import Any

from sqlmodel import Session

from app.core.config import Settings
from app.models import ADPRefreshCandidate, League
from app.services.ai_adp import AIADPBoard, AIADPError, build_ai_adp_board


def create_ai_adp_refresh_candidate(
    session: Session,
    league: League,
    settings: Settings,
) -> ADPRefreshCandidate:
    try:
        board = build_ai_adp_board(session, league, settings, enforce_warning_limit=False)
    except AIADPError as exc:
        candidate = ADPRefreshCandidate(
            league_id=league.id,
            provider="ai_synthesized",
            model=settings.mock_draft_ai_model,
            status="failed",
            board_size=settings.adp_ai_board_size,
            generated_at=datetime.now(UTC).isoformat(),
            source_summary=None,
            warnings=[],
            normalized_rows=[],
            error_message=str(exc),
        )
        session.add(candidate)
        session.commit()
        session.refresh(candidate)
        raise

    notes = _json_dict(board.notes)
    candidate = ADPRefreshCandidate(
        league_id=league.id,
        provider="ai_synthesized",
        model=settings.mock_draft_ai_model,
        status="pending",
        board_size=len(board.rows),
        generated_at=board.snapshot_date.isoformat(),
        source_summary=str(notes.get("source_summary") or "")[:1000] or None,
        warnings=board.warnings,
        normalized_rows=[_normalized_row(row, board, league) for row in board.rows],
    )
    session.add(candidate)
    session.commit()
    session.refresh(candidate)
    return candidate


def _normalized_row(row: Any, board: AIADPBoard, league: League) -> dict[str, Any]:
    return {
        "player": row.full_name,
        "position": row.position,
        "nfl_team": row.nfl_team or "",
        "adp_pick": row.adp_pick,
        "adp_round": row.adp_round,
        "source": board.source,
        "snapshot_name": board.snapshot_name,
        "snapshot_date": board.snapshot_date.isoformat(),
        "format": league.scoring_format,
        "source_note": row.source_note,
        "notes": board.notes,
    }


def _json_dict(value: str | None) -> dict[str, Any]:
    if not value:
        return {}
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError:
        return {}
    return parsed if isinstance(parsed, dict) else {}
