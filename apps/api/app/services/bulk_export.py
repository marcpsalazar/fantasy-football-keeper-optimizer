from __future__ import annotations

import re
import uuid
import zipfile
from io import BytesIO

from sqlmodel import Session, select

from app.models import League, Team
from app.services.excel_export import ExcelExportError, build_keeper_recommendations_workbook
from app.services.pdf_export import PDFExportError, build_team_outlooks_pdf


class BulkExportError(ValueError):
    """Raised when a bulk export cannot be built."""


def build_bulk_pdf_zip(
    session: Session,
    league_id: uuid.UUID,
    *,
    scenario_name: str | None = None,
    user_id: uuid.UUID | None = None,
) -> bytes:
    """Return a ZIP archive containing one PDF per team plus a league summary PDF."""
    league = session.get(League, league_id)
    if league is None:
        raise BulkExportError(f"League {league_id} was not found")

    teams = session.exec(select(Team).where(Team.league_id == league_id)).all()
    if not teams:
        raise BulkExportError("This league has no teams.")

    buf = BytesIO()
    with zipfile.ZipFile(buf, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        try:
            league_pdf = build_team_outlooks_pdf(
                session,
                league_id,
                scenario_name=scenario_name,
                user_id=user_id,
            )
            zf.writestr(f"{_safe_name(league.name)}_all_teams.pdf", league_pdf)
        except PDFExportError as exc:
            raise BulkExportError(str(exc)) from exc

        for team in sorted(teams, key=lambda t: (t.draft_slot or 99, t.name)):
            try:
                team_pdf = build_team_outlooks_pdf(
                    session,
                    league_id,
                    team_id=team.id,
                    scenario_name=scenario_name,
                    user_id=user_id,
                )
                filename = f"{_safe_name(team.name)}.pdf"
                zf.writestr(filename, team_pdf)
            except PDFExportError:
                continue

        try:
            workbook_bytes = build_keeper_recommendations_workbook(
                session,
                league_id,
                scenario_name=scenario_name,
                user_id=user_id,
            )
            zf.writestr(f"{_safe_name(league.name)}_keeper_report.xlsx", workbook_bytes)
        except ExcelExportError:
            pass

    buf.seek(0)
    return buf.getvalue()


def _safe_name(name: str) -> str:
    return re.sub(r"[^A-Za-z0-9_\-]", "_", name)
