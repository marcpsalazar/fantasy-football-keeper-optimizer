from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import func
from sqlmodel import Session, select

from app.core.config import Settings
from app.models.ai_request_log import AIRequestLog


def write_ai_log(
    session: Session,
    *,
    feature: str,
    league_id: uuid.UUID,
    user_id: uuid.UUID | None = None,
    model: str,
    status: str,
    token_usage: dict[str, Any] | None = None,
    latency_ms: int | None = None,
    error_message: str | None = None,
) -> None:
    input_tokens: int | None = None
    output_tokens: int | None = None
    total_tokens: int | None = None
    if isinstance(token_usage, dict):
        raw_in = token_usage.get("input_tokens")
        raw_out = token_usage.get("output_tokens")
        raw_tot = token_usage.get("total_tokens")
        input_tokens = int(raw_in) if isinstance(raw_in, int | float) else None
        output_tokens = int(raw_out) if isinstance(raw_out, int | float) else None
        total_tokens = int(raw_tot) if isinstance(raw_tot, int | float) else None
    record = AIRequestLog(
        feature=feature,
        league_id=league_id,
        user_id=user_id,
        model=model,
        status=status,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        total_tokens=total_tokens,
        latency_ms=latency_ms,
        error_message=error_message[:500] if error_message else None,
    )
    session.add(record)


def is_over_monthly_budget(session: Session, settings: Settings) -> bool:
    """Returns True if the monthly token budget is configured and has been exceeded."""
    if not settings.ai_monthly_token_budget:
        return False
    first_of_month = datetime.now(UTC).date().replace(day=1)
    result = session.exec(
        select(func.sum(AIRequestLog.total_tokens)).where(
            AIRequestLog.created_at >= datetime(
                first_of_month.year, first_of_month.month, 1, tzinfo=UTC
            )
        )
    ).first()
    used = int(result) if isinstance(result, int | float) else 0
    return used >= settings.ai_monthly_token_budget


def monthly_usage_summary(session: Session) -> dict[str, Any]:
    first_of_month = datetime.now(UTC).date().replace(day=1)
    cutoff = datetime(first_of_month.year, first_of_month.month, 1, tzinfo=UTC)

    rows = session.exec(
        select(AIRequestLog).where(AIRequestLog.created_at >= cutoff).order_by(
            AIRequestLog.created_at.desc()  # type: ignore[union-attr]
        )
    ).all()

    total_requests = len(rows)
    total_input = sum(r.input_tokens or 0 for r in rows)
    total_output = sum(r.output_tokens or 0 for r in rows)
    total_tokens = sum(r.total_tokens or 0 for r in rows)
    success_count = sum(1 for r in rows if r.status == "success")

    by_feature: dict[str, dict[str, int]] = {}
    for r in rows:
        entry = by_feature.setdefault(r.feature, {"requests": 0, "input_tokens": 0, "output_tokens": 0, "total_tokens": 0})
        entry["requests"] += 1
        entry["input_tokens"] += r.input_tokens or 0
        entry["output_tokens"] += r.output_tokens or 0
        entry["total_tokens"] += r.total_tokens or 0

    return {
        "total_requests": total_requests,
        "total_input_tokens": total_input,
        "total_output_tokens": total_output,
        "total_tokens": total_tokens,
        "success_rate": round(success_count / total_requests, 3) if total_requests else None,
        "by_feature": by_feature,
    }


def recent_logs(session: Session, limit: int = 50) -> list[dict[str, Any]]:
    rows = session.exec(
        select(AIRequestLog).order_by(
            AIRequestLog.created_at.desc()  # type: ignore[union-attr]
        ).limit(limit)
    ).all()
    return [
        {
            "id": str(r.id),
            "feature": r.feature,
            "model": r.model,
            "status": r.status,
            "input_tokens": r.input_tokens,
            "output_tokens": r.output_tokens,
            "total_tokens": r.total_tokens,
            "latency_ms": r.latency_ms,
            "error_message": r.error_message,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]
