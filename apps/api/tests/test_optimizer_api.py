from collections.abc import Generator
from contextlib import contextmanager
from datetime import UTC, date, datetime
import json
import uuid

from fastapi import Response
from fastapi.testclient import TestClient
import pytest
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel, Session, create_engine

import app.models  # noqa: F401
from app.core.config import Settings, get_settings
from app.db.session import get_session
from app.main import create_app, ensure_initial_admin_user
from app.models import (
    ADPEntry,
    ADPSnapshot,
    DraftPick,
    FinalRosterEntry,
    KeeperRecommendation,
    Player,
    User,
)
from app.services.auth import clear_session_cookie, hash_password, set_session_cookie, verify_password
import app.services.auth as auth_service
from app.services.adp_refresh import refresh_adp_from_api
from app.services.ai_adp import AIADPBoard, AIADPError, AIADPRow, _dedupe_and_trim_board, _validate_board
from app.services.composite_adp import ProviderFetchResult, _parse_draftsharks_browser_payload
import app.services.mock_draft_ai as mock_draft_ai
import app.services.mock_draft as mock_draft_service
import app.services.news_feed as news_feed
import app.services.keeper_explanation_ai as keeper_explanation_ai
from app.services.keeper_explanation_ai import (
    KeeperExplanationResult,
    explanation_input_hash,
)
import app.services.scenario_narrative_ai as scenario_narrative_ai
from app.services.scenario_narrative_ai import (
    ScenarioNarrativeResult,
    narrative_input_hash,
)


def _test_settings(**overrides: object) -> Settings:
    return Settings(_env_file=None, **overrides)


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> Generator[TestClient, None, None]:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)

    def override_get_session() -> Generator[Session, None, None]:
        with Session(engine) as session:
            yield session

    monkeypatch.setattr("app.main.get_settings", lambda: _test_settings())
    monkeypatch.setattr("app.services.mock_draft.get_settings", lambda: _test_settings())
    app = create_app()
    app.dependency_overrides[get_session] = override_get_session
    app.dependency_overrides[get_settings] = lambda: _test_settings()

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()


def _disable_draftsharks_browser_scraper(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "app.services.composite_adp._fetch_draftsharks_browser_rows",
        lambda settings, team_count: ProviderFetchResult(rows={}, error="browser scraper disabled in test"),
    )


def _create_admin_and_login(client: TestClient) -> dict[str, str]:
    response = client.post(
        "/api/admin/users",
        json={"email": "admin@example.com", "password": "secret", "role": "platform_admin"},
    )
    assert response.status_code == 201
    login_response = client.post(
        "/api/auth/login",
        json={"email": "admin@example.com", "password": "secret"},
    )
    assert login_response.status_code == 200
    return response.json()


@contextmanager
def _session_from_client(client: TestClient) -> Generator[Session, None, None]:
    session_generator = client.app.dependency_overrides[get_session]()
    try:
        yield next(session_generator)
    finally:
        session_generator.close()


def test_auth_requires_login_after_user_exists(client: TestClient) -> None:
    _create_admin_and_login(client)
    client.post("/api/auth/logout")

    response = client.get("/api/leagues")

    assert response.status_code == 401


def test_user_can_update_and_clear_profile_avatar(client: TestClient) -> None:
    _create_admin_and_login(client)
    avatar = "data:image/png;base64,aGVsbG8="

    update_response = client.patch("/api/auth/profile", json={"avatar_data_url": avatar})
    assert update_response.status_code == 200
    assert update_response.json()["user"]["avatar_data_url"] == avatar

    me_response = client.get("/api/auth/me")
    assert me_response.status_code == 200
    assert me_response.json()["user"]["avatar_data_url"] == avatar

    clear_response = client.patch("/api/auth/profile", json={"avatar_data_url": None})
    assert clear_response.status_code == 200
    assert clear_response.json()["user"]["avatar_data_url"] is None


def test_user_can_update_profile_alias_without_clearing_avatar(client: TestClient) -> None:
    _create_admin_and_login(client)
    avatar = "data:image/png;base64,aGVsbG8="

    avatar_response = client.patch("/api/auth/profile", json={"avatar_data_url": avatar})
    assert avatar_response.status_code == 200

    alias_response = client.patch("/api/auth/profile", json={"alias": "Mayhem Manager"})
    assert alias_response.status_code == 200
    assert alias_response.json()["user"]["alias"] == "Mayhem Manager"
    assert alias_response.json()["user"]["avatar_data_url"] == avatar

    clear_response = client.patch("/api/auth/profile", json={"alias": "   "})
    assert clear_response.status_code == 200
    assert clear_response.json()["user"]["alias"] is None


def test_user_can_change_own_password_with_current_password(client: TestClient) -> None:
    _create_admin_and_login(client)

    wrong_current_response = client.post(
        "/api/auth/password",
        json={"current_password": "wrong", "new_password": "new-secret"},
    )
    assert wrong_current_response.status_code == 400

    update_response = client.post(
        "/api/auth/password",
        json={"current_password": "secret", "new_password": "new-secret"},
    )
    assert update_response.status_code == 200

    client.post("/api/auth/logout")
    old_login_response = client.post(
        "/api/auth/login",
        json={"email": "admin@example.com", "password": "secret"},
    )
    assert old_login_response.status_code == 401
    new_login_response = client.post(
        "/api/auth/login",
        json={"email": "admin@example.com", "password": "new-secret"},
    )
    assert new_login_response.status_code == 200


def test_session_cookie_is_not_secure_by_default_in_development(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        auth_service,
        "get_settings",
        lambda: _test_settings(environment="development", session_secret="test-secret"),
    )
    response = Response()

    set_session_cookie(
        response,
        User(email="dev@example.com", password_hash=hash_password("secret")),
    )

    set_cookie = response.headers["set-cookie"]
    assert "httponly" in set_cookie.lower()
    assert "samesite=lax" in set_cookie.lower()
    assert "secure" not in set_cookie.lower()


def test_session_cookie_is_secure_by_default_in_production(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        auth_service,
        "get_settings",
        lambda: _test_settings(environment="production", session_secret="test-secret"),
    )
    response = Response()

    set_session_cookie(
        response,
        User(email="prod@example.com", password_hash=hash_password("secret")),
    )
    clear_session_cookie(response)

    set_cookie_headers = response.headers.getlist("set-cookie")
    assert "secure" in set_cookie_headers[0].lower()
    assert "secure" in set_cookie_headers[1].lower()
    assert "samesite=none" in set_cookie_headers[0].lower()
    assert "samesite=none" in set_cookie_headers[1].lower()


def test_session_cookie_secure_setting_overrides_environment(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        auth_service,
        "get_settings",
        lambda: _test_settings(
            environment="production",
            session_cookie_secure=False,
            session_secret="test-secret",
        ),
    )
    response = Response()

    set_session_cookie(
        response,
        User(email="override@example.com", password_hash=hash_password("secret")),
    )

    assert "secure" not in response.headers["set-cookie"].lower()


def test_session_cookie_samesite_setting_overrides_environment(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        auth_service,
        "get_settings",
        lambda: _test_settings(
            environment="production",
            session_cookie_samesite="lax",
            session_secret="test-secret",
        ),
    )
    response = Response()

    set_session_cookie(
        response,
        User(email="same-site@example.com", password_hash=hash_password("secret")),
    )

    assert "samesite=lax" in response.headers["set-cookie"].lower()


def test_settings_normalizes_railway_postgresql_database_url() -> None:
    settings = _test_settings(database_url="postgresql://keeper:secret@host.railway.internal:5432/keeper")

    assert (
        settings.sqlalchemy_database_url
        == "postgresql+psycopg://keeper:secret@host.railway.internal:5432/keeper"
    )


def test_settings_keeps_explicit_sqlalchemy_and_sqlite_database_urls() -> None:
    postgres_settings = _test_settings(
        database_url="postgresql+psycopg://keeper:secret@localhost:5432/keeper"
    )
    sqlite_settings = _test_settings(database_url="sqlite:////tmp/keeper_optimizer_dev.db")

    assert (
        postgres_settings.sqlalchemy_database_url
        == "postgresql+psycopg://keeper:secret@localhost:5432/keeper"
    )
    assert sqlite_settings.sqlalchemy_database_url == "sqlite:////tmp/keeper_optimizer_dev.db"


def test_initial_admin_seed_keeps_existing_hash_only_admin_password(client: TestClient) -> None:
    session_generator = client.app.dependency_overrides[get_session]()
    session = next(session_generator)
    try:
        user = User(
            email="admin@example.com",
            password_hash=hash_password("old-secret"),
            role="admin",
            is_active=True,
        )
        session.add(user)
        session.commit()

        ensure_initial_admin_user(session, "admin@example.com", "change-me")
        session.refresh(user)

        assert verify_password("old-secret", user.password_hash)
        assert not verify_password("change-me", user.password_hash)
    finally:
        session_generator.close()


def test_regular_user_is_blocked_from_admin_endpoints(client: TestClient) -> None:
    _create_admin_and_login(client)
    league_response = client.post(
        "/api/leagues",
        json={"name": "Blocked League", "season_year": 2026},
    )
    assert league_response.status_code == 201
    league_id = league_response.json()["id"]
    response = client.post(
        "/api/admin/users",
        json={"email": "user@example.com", "password": "secret", "role": "user"},
    )
    assert response.status_code == 201
    client.post("/api/auth/logout")
    login_response = client.post(
        "/api/auth/login",
        json={"email": "user@example.com", "password": "secret"},
    )
    assert login_response.status_code == 200

    league_create_response = client.post(
        "/api/leagues",
        json={"name": "Blocked League 2", "season_year": 2026},
    )
    draft_preview_response = client.post(
        f"/api/leagues/{league_id}/draft-results/preview",
        content="team,round,overall_pick,player,position\nBlocked,1,1,Player,QB\n",
        headers={"content-type": "text/csv"},
    )
    draft_import_response = client.post(
        f"/api/leagues/{league_id}/draft-results/import",
        content="team,round,overall_pick,player,position\nBlocked,1,1,Player,QB\n",
        headers={"content-type": "text/csv"},
    )

    assert league_create_response.status_code == 201  # any authenticated user can create a league
    assert draft_preview_response.status_code == 403  # non-member cannot access another league
    assert draft_import_response.status_code == 403   # non-member cannot import into another league


def test_team_management_is_admin_only_and_can_assign_users(client: TestClient) -> None:
    _create_admin_and_login(client)
    league_response = client.post(
        "/api/leagues",
        json={"name": "Managed League", "season_year": 2026},
    )
    assert league_response.status_code == 201
    league_id = league_response.json()["id"]
    user_response = client.post(
        "/api/admin/users",
        json={
            "email": "owner@example.com",
            "password": "secret",
            "alias": "Original Owner",
            "role": "user",
        },
    )
    assert user_response.status_code == 201
    user_id = user_response.json()["id"]
    assert user_response.json()["alias"] == "Original Owner"

    team_response = client.post(
        f"/api/leagues/{league_id}/teams",
        json={"name": "Managed Team", "draft_slot": 4, "user_id": user_id},
    )
    assert team_response.status_code == 201
    team_id = team_response.json()["id"]

    list_response = client.get(f"/api/leagues/{league_id}/teams")
    assert list_response.status_code == 200
    assert list_response.json()["rows"][0]["user_id"] == user_id
    assert list_response.json()["rows"][0]["user_email"] == "owner@example.com"
    assert list_response.json()["rows"][0]["user_alias"] == "Original Owner"
    assert list_response.json()["rows"][0]["owner_display_name"] == "Original Owner"

    update_user_response = client.patch(
        f"/api/admin/users/{user_id}",
        json={"alias": "Admin Alias"},
    )
    assert update_user_response.status_code == 200
    assert update_user_response.json()["alias"] == "Admin Alias"

    list_response = client.get(f"/api/leagues/{league_id}/teams")
    assert list_response.status_code == 200
    assert list_response.json()["rows"][0]["owner_display_name"] == "Admin Alias"

    client.post("/api/auth/logout")
    login_response = client.post(
        "/api/auth/login",
        json={"email": "owner@example.com", "password": "secret"},
    )
    assert login_response.status_code == 200
    assert login_response.json()["user"]["team_id"] == team_id
    assert login_response.json()["user"]["team_name"] == "Managed Team"
    me_response = client.get("/api/auth/me")
    assert me_response.status_code == 200
    assert me_response.json()["user"]["team_id"] == team_id
    assert me_response.json()["user"]["team_name"] == "Managed Team"
    assert me_response.json()["user"]["alias"] == "Admin Alias"

    alias_response = client.patch("/api/auth/profile", json={"alias": "Self Alias"})
    assert alias_response.status_code == 200
    assert alias_response.json()["user"]["alias"] == "Self Alias"

    list_response = client.get(f"/api/leagues/{league_id}/teams")
    assert list_response.status_code == 200
    assert list_response.json()["rows"][0]["owner_display_name"] == "Self Alias"

    blocked_update = client.patch(f"/api/teams/{team_id}", json={"user_id": None})
    blocked_delete = client.delete(f"/api/teams/{team_id}")
    assert blocked_update.status_code == 403
    assert blocked_delete.status_code == 403

    client.post("/api/auth/logout")
    admin_login = client.post(
        "/api/auth/login",
        json={"email": "admin@example.com", "password": "secret"},
    )
    assert admin_login.status_code == 200
    unassign_response = client.patch(f"/api/teams/{team_id}", json={"user_id": None})
    assert unassign_response.status_code == 200
    assert unassign_response.json()["user_id"] is None
    delete_response = client.delete(f"/api/teams/{team_id}")
    assert delete_response.status_code == 204


def test_mock_draft_session_prefills_keeper_and_runs_controls(client: TestClient) -> None:
    admin = _create_admin_and_login(client)
    league_response = client.post(
        "/api/leagues",
        json={
            "name": "Mock Draft League",
            "season_year": 2026,
            "draft_type": "snake",
            "roster_settings": {
                "slots": {"QB": 1, "RB": 1},
                "allowed_positions": ["QB", "RB", "WR"],
            },
        },
    )
    assert league_response.status_code == 201
    league_id = league_response.json()["id"]
    team_response = client.post(
        f"/api/leagues/{league_id}/teams",
        json={"name": "User Team", "draft_slot": 1, "user_id": admin["id"]},
    )
    assert team_response.status_code == 201
    user_team_id = team_response.json()["id"]
    bot_team_response = client.post(
        f"/api/leagues/{league_id}/teams",
        json={"name": "Bot Team", "draft_slot": 2},
    )
    assert bot_team_response.status_code == 201

    with _session_from_client(client) as session:
        snapshot = ADPSnapshot(
            league_id=uuid.UUID(league_id),
            season_year=2026,
            name="Mock ADP",
            source="test",
            format_type="superflex",
            snapshot_date=date(2026, 5, 1),
        )
        players = [
            Player(full_name="Keeper QB", position="QB", nfl_team="KC"),
            Player(full_name="Bot RB", position="RB", nfl_team="ATL"),
            Player(full_name="Bot WR", position="WR", nfl_team="DET"),
            Player(full_name="User RB", position="RB", nfl_team="NYJ"),
        ]
        session.add(snapshot)
        for player in players:
            session.add(player)
        session.commit()
        for index, player in enumerate(players, start=1):
            session.add(
                ADPEntry(
                    snapshot_id=snapshot.id,
                    player_id=player.id,
                    position=player.position,
                    adp_pick=float(index),
                )
            )
        session.add(
            KeeperRecommendation(
                league_id=uuid.UUID(league_id),
                user_id=uuid.UUID(admin["id"]),
                team_id=uuid.UUID(user_team_id),
                player_id=players[0].id,
                adp_snapshot_id=snapshot.id,
                scenario_name="Default",
                keeper_cost_round=1,
                adp_pick=1,
                adp_round=1,
                keeper_value=10,
                keeper_score=20,
                is_recommended=True,
            )
        )
        session.commit()
        snapshot_id = str(snapshot.id)

    create_response = client.post(
        f"/api/leagues/{league_id}/mock-drafts",
        json={"adp_snapshot_id": snapshot_id, "round_count": 2, "pick_timer_seconds": 60},
    )
    assert create_response.status_code == 201
    draft = create_response.json()
    assert draft["status"] == "setup"
    assert draft["round_count"] == 2
    assert draft["user_team_id"] == user_team_id
    assert draft["board"][0]["status"] == "Keeper"
    assert draft["board"][0]["pick"]["player_name"] == "Keeper QB"
    assert draft["current_pick"] == 2

    start_response = client.post(f"/api/mock-drafts/{draft['id']}/start")
    assert start_response.status_code == 200
    assert start_response.json()["session"]["status"] == "in_progress"

    bot_response = client.post(f"/api/mock-drafts/{draft['id']}/bot-pick")
    assert bot_response.status_code == 200
    assert bot_response.json()["pick"]["source"] == "bot"
    assert bot_response.json()["pick"]["player_name"] == "Bot RB"

    pause_response = client.post(f"/api/mock-drafts/{draft['id']}/pause")
    assert pause_response.status_code == 200
    assert pause_response.json()["session"]["status"] == "paused"
    resume_response = client.post(f"/api/mock-drafts/{draft['id']}/resume")
    assert resume_response.status_code == 200
    assert resume_response.json()["session"]["status"] == "in_progress"

    complete_response = client.post(f"/api/mock-drafts/{draft['id']}/complete", json={"force": True})
    assert complete_response.status_code == 200
    completed = complete_response.json()["session"]
    assert completed["status"] == "complete"
    assert completed["analysis"]["overall_letter_grade"]
    assert completed["analysis"]["pick_feedback"][0]["player_name"] == "Keeper QB"
    assert completed["analysis"]["what_if_scenarios"]
    assert completed["analysis"]["projected_rankings"]["component_scores"]["value_score"] >= 0
    assert completed["analysis"]["future_advice"]

    history_response = client.get(f"/api/leagues/{league_id}/mock-drafts")
    assert history_response.status_code == 200
    assert [row["id"] for row in history_response.json()] == [draft["id"]]


def test_mock_draft_bot_uses_ai_decision_when_enabled(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    admin = _create_admin_and_login(client)
    league_response = client.post(
        "/api/leagues",
        json={
            "name": "AI Bot Mock League",
            "season_year": 2026,
            "draft_type": "snake",
            "roster_settings": {
                "slots": {"QB": 1},
                "allowed_positions": ["QB"],
            },
        },
    )
    assert league_response.status_code == 201
    league_id = league_response.json()["id"]
    user_team_response = client.post(
        f"/api/leagues/{league_id}/teams",
        json={"name": "User Team", "draft_slot": 1, "user_id": admin["id"]},
    )
    assert user_team_response.status_code == 201
    bot_team_response = client.post(
        f"/api/leagues/{league_id}/teams",
        json={"name": "Bot Team", "draft_slot": 2},
    )
    assert bot_team_response.status_code == 201

    with _session_from_client(client) as session:
        snapshot = ADPSnapshot(
            league_id=uuid.UUID(league_id),
            season_year=2026,
            name="AI Bot ADP",
            source="test",
            format_type="superflex",
            snapshot_date=date(2026, 5, 1),
        )
        user_qb = Player(full_name="User QB", position="QB", nfl_team="BUF")
        model_qb = Player(full_name="Model QB", position="QB", nfl_team="KC")
        fallback_qb = Player(full_name="Fallback QB", position="QB", nfl_team="CIN")
        session.add(snapshot)
        session.add(user_qb)
        session.add(model_qb)
        session.add(fallback_qb)
        session.commit()
        for index, player in enumerate([user_qb, fallback_qb, model_qb], start=1):
            session.add(
                ADPEntry(
                    snapshot_id=snapshot.id,
                    player_id=player.id,
                    position=player.position,
                    adp_pick=float(index),
                )
            )
        session.commit()
        snapshot_id = str(snapshot.id)
        user_qb_id = str(user_qb.id)
        model_qb_id = model_qb.id

    monkeypatch.setattr("app.services.mock_draft.mock_draft_ai.is_enabled", lambda settings: True)

    def choose_bot_player(**kwargs: object) -> mock_draft_ai.AIBotPickDecision:
        context = kwargs["context"]
        assert isinstance(context, dict)
        assert context["candidate_players"]
        return mock_draft_ai.AIBotPickDecision(
            player_id=model_qb_id,
            reasoning_summary="Chose the model-preferred quarterback for roster fit.",
            confidence=0.83,
        )

    monkeypatch.setattr("app.services.mock_draft.mock_draft_ai.choose_bot_player", choose_bot_player)

    create_response = client.post(
        f"/api/leagues/{league_id}/mock-drafts",
        json={"adp_snapshot_id": snapshot_id},
    )
    assert create_response.status_code == 201
    draft_id = create_response.json()["id"]
    assert client.post(f"/api/mock-drafts/{draft_id}/start").status_code == 200
    user_pick = client.post(f"/api/mock-drafts/{draft_id}/pick", json={"player_id": user_qb_id})
    assert user_pick.status_code == 200

    bot_response = client.post(f"/api/mock-drafts/{draft_id}/bot-pick")

    assert bot_response.status_code == 200
    pick = bot_response.json()["pick"]
    assert pick["player_name"] == "Model QB"
    assert pick["reasoning_summary"].startswith("AI: Chose the model-preferred quarterback")


def test_mock_draft_analysis_uses_ai_narrative_when_enabled(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    admin = _create_admin_and_login(client)
    league_response = client.post(
        "/api/leagues",
        json={
            "name": "AI Analysis Mock League",
            "season_year": 2026,
            "roster_settings": {"slots": {"QB": 1}, "allowed_positions": ["QB"]},
        },
    )
    assert league_response.status_code == 201
    league_id = league_response.json()["id"]
    team_response = client.post(
        f"/api/leagues/{league_id}/teams",
        json={"name": "User Team", "draft_slot": 1, "user_id": admin["id"]},
    )
    assert team_response.status_code == 201

    with _session_from_client(client) as session:
        snapshot = ADPSnapshot(
            league_id=uuid.UUID(league_id),
            season_year=2026,
            name="AI Analysis ADP",
            source="test",
            format_type="superflex",
            snapshot_date=date(2026, 5, 1),
        )
        player = Player(full_name="Analysis QB", position="QB", nfl_team="PHI")
        session.add(snapshot)
        session.add(player)
        session.commit()
        session.add(
            ADPEntry(
                snapshot_id=snapshot.id,
                player_id=player.id,
                position=player.position,
                adp_pick=1,
            )
        )
        session.commit()
        snapshot_id = str(snapshot.id)
        player_id = str(player.id)

    monkeypatch.setattr("app.services.mock_draft.mock_draft_ai.is_enabled", lambda settings: True)

    def generate_draft_analysis(**kwargs: object) -> mock_draft_ai.AIAnalysisDecision:
        context = kwargs["context"]
        assert isinstance(context, dict)
        assert context["user_pick_feedback"][0]["player_name"] == "Analysis QB"
        return mock_draft_ai.AIAnalysisDecision(
            summary="AI says this build is clean and value-aware.",
            strengths=[{"label": "AI strength", "detail": "Roster construction matched the format."}],
            weaknesses=[{"label": "AI weakness", "detail": "Depth still needs pressure testing."}],
            what_if_scenarios=[
                {
                    "name": "AI scenario",
                    "changed_picks": 1,
                    "score_delta": 2,
                    "recommendation": "Try one alternate early-round path.",
                }
            ],
            future_advice=[{"label": "AI advice", "detail": "Compare this against a value-only run."}],
        )

    monkeypatch.setattr(
        "app.services.mock_draft.mock_draft_ai.generate_draft_analysis",
        generate_draft_analysis,
    )

    create_response = client.post(
        f"/api/leagues/{league_id}/mock-drafts",
        json={"adp_snapshot_id": snapshot_id},
    )
    assert create_response.status_code == 201
    draft_id = create_response.json()["id"]
    assert client.post(f"/api/mock-drafts/{draft_id}/start").status_code == 200
    assert client.post(f"/api/mock-drafts/{draft_id}/pick", json={"player_id": player_id}).status_code == 200

    complete_response = client.post(f"/api/mock-drafts/{draft_id}/complete", json={"force": True})

    assert complete_response.status_code == 200
    analysis = complete_response.json()["session"]["analysis"]
    assert analysis["summary"] == "AI says this build is clean and value-aware."
    assert analysis["strengths"][0]["label"] == "AI strength"
    assert analysis["projected_rankings"]["ai_analysis_used"] is True


def test_mock_draft_ai_json_parser_accepts_fenced_json() -> None:
    parsed = mock_draft_ai._loads_json_object('```json\n{"summary":"ok"}\n```')

    assert parsed == {"summary": "ok"}


def test_mock_draft_ai_json_parser_extracts_prefaced_json() -> None:
    parsed = mock_draft_ai._loads_json_object('Here is the plan:\n{"summary":"ok"}')

    assert parsed == {"summary": "ok"}


def test_mock_draft_create_includes_strategy_plan(client: TestClient) -> None:
    admin = _create_admin_and_login(client)
    league_response = client.post(
        "/api/leagues",
        json={
            "name": "Strategy Mock League",
            "season_year": 2026,
            "draft_type": "snake",
            "roster_settings": {
                "slots": {"QB": 1, "RB": 1, "WR": 1},
                "allowed_positions": ["QB", "RB", "WR"],
            },
        },
    )
    assert league_response.status_code == 201
    league_id = league_response.json()["id"]
    team_response = client.post(
        f"/api/leagues/{league_id}/teams",
        json={"name": "User Team", "draft_slot": 1, "user_id": admin["id"]},
    )
    assert team_response.status_code == 201

    with _session_from_client(client) as session:
        snapshot = ADPSnapshot(
            league_id=uuid.UUID(league_id),
            season_year=2026,
            name="Strategy ADP",
            source="test",
            format_type="superflex",
            snapshot_date=date(2026, 5, 1),
        )
        players = [
            Player(full_name="Strategy QB", position="QB", nfl_team="BUF"),
            Player(full_name="Strategy RB", position="RB", nfl_team="ATL"),
            Player(full_name="Strategy WR", position="WR", nfl_team="DET"),
        ]
        session.add(snapshot)
        for player in players:
            session.add(player)
        session.commit()
        for index, player in enumerate(players, start=1):
            session.add(
                ADPEntry(
                    snapshot_id=snapshot.id,
                    player_id=player.id,
                    position=player.position,
                    adp_pick=float(index),
                )
            )
        session.commit()
        snapshot_id = str(snapshot.id)

    create_response = client.post(
        f"/api/leagues/{league_id}/mock-drafts",
        json={"adp_snapshot_id": snapshot_id},
    )

    assert create_response.status_code == 201
    plan = create_response.json()["strategy_plan"]
    assert plan["summary"]
    assert plan["round_plan"]
    assert plan["targets"][0]["player_name"] == "Strategy QB"
    assert plan["ai_used"] is False
    assert plan["cache_key"]


def test_mock_draft_strategy_plan_uses_ai_when_enabled(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    admin = _create_admin_and_login(client)
    league_response = client.post(
        "/api/leagues",
        json={
            "name": "AI Strategy Mock League",
            "season_year": 2026,
            "roster_settings": {"slots": {"QB": 1}, "allowed_positions": ["QB"]},
        },
    )
    assert league_response.status_code == 201
    league_id = league_response.json()["id"]
    team_response = client.post(
        f"/api/leagues/{league_id}/teams",
        json={"name": "User Team", "draft_slot": 1, "user_id": admin["id"]},
    )
    assert team_response.status_code == 201

    with _session_from_client(client) as session:
        snapshot = ADPSnapshot(
            league_id=uuid.UUID(league_id),
            season_year=2026,
            name="AI Strategy ADP",
            source="test",
            format_type="superflex",
            snapshot_date=date(2026, 5, 1),
        )
        player = Player(full_name="AI Strategy QB", position="QB", nfl_team="PHI")
        session.add(snapshot)
        session.add(player)
        session.commit()
        session.add(
            ADPEntry(
                snapshot_id=snapshot.id,
                player_id=player.id,
                position=player.position,
                adp_pick=1,
            )
        )
        session.commit()
        snapshot_id = str(snapshot.id)
        player_id = str(player.id)

    monkeypatch.setattr("app.services.mock_draft.mock_draft_ai.is_enabled", lambda settings: True)

    def generate_strategy_plan(**kwargs: object) -> mock_draft_ai.AIStrategyPlanDecision:
        context = kwargs["context"]
        assert isinstance(context, dict)
        assert context["top_overall_players"][0]["name"] == "AI Strategy QB"
        return mock_draft_ai.AIStrategyPlanDecision(
            summary="AI says attack quarterback value early.",
            round_plan=[
                {
                    "round": 1,
                    "priority": "Secure QB",
                    "avoid": "Low-ceiling RB",
                    "notes": "The room starts at your pick.",
                }
            ],
            position_priorities=[
                {"position": "QB", "priority": "high", "reason": "Only required starter."}
            ],
            targets=[
                {
                    "player_id": player_id,
                    "player_name": "AI Strategy QB",
                    "reason": "Best fit.",
                    "acceptable_range": "1-4",
                }
            ],
            fades=[],
            contingencies=[],
        )

    monkeypatch.setattr(
        "app.services.mock_draft.mock_draft_ai.generate_strategy_plan",
        generate_strategy_plan,
    )

    create_response = client.post(
        f"/api/leagues/{league_id}/mock-drafts",
        json={"adp_snapshot_id": snapshot_id},
    )

    assert create_response.status_code == 201
    plan = create_response.json()["strategy_plan"]
    assert plan["summary"] == "AI says attack quarterback value early."
    assert plan["ai_used"] is True
    assert plan["model"] == "gpt-5.4-mini"
    assert plan["targets"][0]["player_id"] == player_id


def test_mock_draft_strategy_plan_regenerate_endpoint(client: TestClient) -> None:
    admin = _create_admin_and_login(client)
    league_response = client.post(
        "/api/leagues",
        json={
            "name": "Regenerate Strategy Mock League",
            "season_year": 2026,
            "roster_settings": {"slots": {"QB": 1}, "allowed_positions": ["QB"]},
        },
    )
    assert league_response.status_code == 201
    league_id = league_response.json()["id"]
    team_response = client.post(
        f"/api/leagues/{league_id}/teams",
        json={"name": "User Team", "draft_slot": 1, "user_id": admin["id"]},
    )
    assert team_response.status_code == 201

    create_response = client.post(f"/api/leagues/{league_id}/mock-drafts", json={"round_count": 1})
    assert create_response.status_code == 201
    draft_id = create_response.json()["id"]

    regenerate_response = client.post(f"/api/mock-drafts/{draft_id}/strategy-plan")

    assert regenerate_response.status_code == 200
    assert regenerate_response.json()["session"]["strategy_plan"]["summary"]

    assert client.post(f"/api/mock-drafts/{draft_id}/start").status_code == 200
    rejected_response = client.post(f"/api/mock-drafts/{draft_id}/strategy-plan")
    assert rejected_response.status_code == 400
    assert "before or during a paused draft" in rejected_response.json()["detail"]


def test_abandoned_mock_draft_is_excluded_from_history(client: TestClient) -> None:
    admin = _create_admin_and_login(client)
    league_response = client.post(
        "/api/leagues",
        json={
            "name": "Abandoned Mock League",
            "season_year": 2026,
            "roster_settings": {"slots": {"QB": 1}, "allowed_positions": ["QB"]},
        },
    )
    assert league_response.status_code == 201
    league_id = league_response.json()["id"]
    team_response = client.post(
        f"/api/leagues/{league_id}/teams",
        json={"name": "User Team", "draft_slot": 1, "user_id": admin["id"]},
    )
    assert team_response.status_code == 201

    create_response = client.post(f"/api/leagues/{league_id}/mock-drafts", json={"round_count": 1})
    assert create_response.status_code == 201
    draft_id = create_response.json()["id"]
    end_response = client.post(f"/api/mock-drafts/{draft_id}/end")
    assert end_response.status_code == 200
    assert end_response.json()["session"]["status"] == "abandoned"

    history_response = client.get(f"/api/leagues/{league_id}/mock-drafts")
    assert history_response.status_code == 200
    assert history_response.json() == []


def test_mock_draft_analysis_grades_keeper_cost_against_adp(client: TestClient) -> None:
    admin = _create_admin_and_login(client)
    league_response = client.post(
        "/api/leagues",
        json={
            "name": "Keeper Analysis Mock League",
            "season_year": 2026,
            "draft_type": "snake",
            "roster_settings": {
                "slots": {"RB": 1, "BENCH": 1},
                "allowed_positions": ["RB"],
            },
        },
    )
    assert league_response.status_code == 201
    league_id = league_response.json()["id"]
    team_response = client.post(
        f"/api/leagues/{league_id}/teams",
        json={"name": "User Team", "draft_slot": 1, "user_id": admin["id"]},
    )
    assert team_response.status_code == 201
    user_team_id = team_response.json()["id"]
    bot_team_response = client.post(
        f"/api/leagues/{league_id}/teams",
        json={"name": "Bot Team", "draft_slot": 2},
    )
    assert bot_team_response.status_code == 201

    with _session_from_client(client) as session:
        snapshot = ADPSnapshot(
            league_id=uuid.UUID(league_id),
            season_year=2026,
            name="Keeper ADP",
            source="test",
            format_type="superflex",
            snapshot_date=date(2026, 5, 1),
        )
        player = Player(full_name="Discount Keeper RB", position="RB", nfl_team="CIN")
        session.add(snapshot)
        session.add(player)
        session.commit()
        session.add(
            ADPEntry(
                snapshot_id=snapshot.id,
                player_id=player.id,
                position=player.position,
                adp_pick=1,
            )
        )
        session.add(
            KeeperRecommendation(
                league_id=uuid.UUID(league_id),
                user_id=uuid.UUID(admin["id"]),
                team_id=uuid.UUID(user_team_id),
                player_id=player.id,
                adp_snapshot_id=snapshot.id,
                scenario_name="Default",
                keeper_cost_round=2,
                keeper_cost_pick=4,
                adp_pick=1,
                adp_round=1,
                keeper_value=3,
                keeper_score=20,
                is_recommended=True,
            )
        )
        session.commit()
        snapshot_id = str(snapshot.id)

    create_response = client.post(
        f"/api/leagues/{league_id}/mock-drafts",
        json={"adp_snapshot_id": snapshot_id},
    )
    assert create_response.status_code == 201
    draft_id = create_response.json()["id"]
    complete_response = client.post(f"/api/mock-drafts/{draft_id}/complete", json={"force": True})
    assert complete_response.status_code == 200
    feedback = complete_response.json()["session"]["analysis"]["pick_feedback"][0]
    assert feedback["source"] == "keeper_forfeit"
    assert feedback["keeper_cost_pick"] == 4
    assert feedback["adp_pick"] == 1
    assert feedback["value_vs_adp"] == 3
    assert "keeper cost" in feedback["summary"].lower()
    assert "reach" not in feedback["summary"].lower()


def test_mock_draft_rejects_pick_that_exceeds_roster_limits(client: TestClient) -> None:
    admin = _create_admin_and_login(client)
    league_response = client.post(
        "/api/leagues",
        json={
            "name": "Roster Limit Mock League",
            "season_year": 2026,
            "roster_settings": {
                "slots": {"QB": 1},
                "allowed_positions": ["QB"],
                "max_positions": {"QB": 1},
            },
        },
    )
    assert league_response.status_code == 201
    league_id = league_response.json()["id"]
    team_response = client.post(
        f"/api/leagues/{league_id}/teams",
        json={"name": "User Team", "draft_slot": 1, "user_id": admin["id"]},
    )
    assert team_response.status_code == 201

    with _session_from_client(client) as session:
        qb_one = Player(full_name="Limit QB One", position="QB", nfl_team="KC")
        qb_two = Player(full_name="Limit QB Two", position="QB", nfl_team="BUF")
        session.add(qb_one)
        session.add(qb_two)
        session.commit()
        qb_one_id = str(qb_one.id)
        qb_two_id = str(qb_two.id)

    update_response = client.patch(
        f"/api/leagues/{league_id}",
        json={
            "roster_settings": {
                "slots": {"QB": 1, "BENCH": 1},
                "allowed_positions": ["QB"],
                "max_positions": {"QB": 1},
            }
        },
    )
    assert update_response.status_code == 200

    create_response = client.post(f"/api/leagues/{league_id}/mock-drafts", json={"round_count": 2})
    assert create_response.status_code == 201
    draft_id = create_response.json()["id"]
    assert create_response.json()["roster_needs"] == [
        {"slot": "QB", "filled": 0, "target": 1, "remaining": 1},
        {"slot": "BENCH", "filled": 0, "target": 1, "remaining": 1},
    ]
    start_response = client.post(f"/api/mock-drafts/{draft_id}/start")
    assert start_response.status_code == 200

    first_pick = client.post(f"/api/mock-drafts/{draft_id}/pick", json={"player_id": qb_one_id})
    assert first_pick.status_code == 200
    assert first_pick.json()["session"]["roster_needs"] == [
        {"slot": "QB", "filled": 1, "target": 1, "remaining": 0},
        {"slot": "BENCH", "filled": 0, "target": 1, "remaining": 1},
    ]

    second_pick = client.post(f"/api/mock-drafts/{draft_id}/pick", json={"player_id": qb_two_id})
    assert second_pick.status_code == 400
    assert "QB roster limit has been reached" in second_pick.json()["detail"]


def test_mock_draft_roster_needs_allocate_superflex_before_bench(client: TestClient) -> None:
    admin = _create_admin_and_login(client)
    league_response = client.post(
        "/api/leagues",
        json={
            "name": "Superflex Allocation Mock League",
            "season_year": 2026,
            "roster_settings": {
                "slots": {"QB": 1, "SUPERFLEX": 1, "BENCH": 6},
                "allowed_positions": ["QB"],
            },
        },
    )
    assert league_response.status_code == 201
    league_id = league_response.json()["id"]
    team_response = client.post(
        f"/api/leagues/{league_id}/teams",
        json={"name": "User Team", "draft_slot": 1, "user_id": admin["id"]},
    )
    assert team_response.status_code == 201

    with _session_from_client(client) as session:
        qbs = [
            Player(full_name="Allocation QB One", position="QB", nfl_team="KC"),
            Player(full_name="Allocation QB Two", position="QB", nfl_team="BUF"),
            Player(full_name="Allocation QB Three", position="QB", nfl_team="BAL"),
        ]
        session.add_all(qbs)
        session.commit()
        qb_ids = [str(player.id) for player in qbs]

    create_response = client.post(f"/api/leagues/{league_id}/mock-drafts", json={})
    assert create_response.status_code == 201
    assert create_response.json()["round_count"] == 8
    draft_id = create_response.json()["id"]
    start_response = client.post(f"/api/mock-drafts/{draft_id}/start")
    assert start_response.status_code == 200

    session_payload = start_response.json()["session"]
    for player_id in qb_ids:
        pick_response = client.post(f"/api/mock-drafts/{draft_id}/pick", json={"player_id": player_id})
        assert pick_response.status_code == 200
        session_payload = pick_response.json()["session"]

    assert session_payload["roster_needs"] == [
        {"slot": "QB", "filled": 1, "target": 1, "remaining": 0},
        {"slot": "SUPERFLEX", "filled": 1, "target": 1, "remaining": 0},
        {"slot": "BENCH", "filled": 1, "target": 6, "remaining": 5},
    ]


def test_mock_draft_available_player_sort_demotes_early_kickers() -> None:
    kicker = Player(full_name="Sort Kicker", position="K", nfl_team="MIA")
    quarterback = Player(full_name="Sort QB", position="QB", nfl_team="IND")
    kicker_adp = ADPEntry(
        snapshot_id=uuid.uuid4(),
        player_id=uuid.uuid4(),
        position="K",
        adp_pick=182,
        adp_round=15,
    )
    quarterback_adp = ADPEntry(
        snapshot_id=uuid.uuid4(),
        player_id=uuid.uuid4(),
        position="QB",
        adp_pick=280,
        adp_round=24,
    )

    assert mock_draft_service._available_player_sort_adp(
        kicker,
        kicker_adp,
        current_round=11,
        round_count=17,
    ) > mock_draft_service._available_player_sort_adp(
        quarterback,
        quarterback_adp,
        current_round=11,
        round_count=17,
    )
    assert mock_draft_service._available_player_sort_adp(
        kicker,
        kicker_adp,
        current_round=15,
        round_count=17,
    ) < mock_draft_service._available_player_sort_adp(
        quarterback,
        quarterback_adp,
        current_round=15,
        round_count=17,
    )


def test_mock_draft_available_players_hide_bad_ai_adp_rows(client: TestClient) -> None:
    admin = _create_admin_and_login(client)
    league_response = client.post(
        "/api/leagues",
        json={
            "name": "Bad ADP Mock League",
            "season_year": 2026,
            "roster_settings": {"slots": {"QB": 1, "DST": 1}, "allowed_positions": ["QB", "DST"]},
        },
    )
    assert league_response.status_code == 201
    league_id = league_response.json()["id"]
    team_response = client.post(
        f"/api/leagues/{league_id}/teams",
        json={"name": "User Team", "draft_slot": 1, "user_id": admin["id"]},
    )
    assert team_response.status_code == 201

    with _session_from_client(client) as session:
        snapshot = ADPSnapshot(
            league_id=uuid.UUID(league_id),
            season_year=2026,
            name="Bad AI ADP",
            source="test",
            format_type="superflex",
            snapshot_date=date(2026, 5, 1),
        )
        previous_snapshot = ADPSnapshot(
            league_id=uuid.UUID(league_id),
            season_year=2026,
            name="Fallback ADP",
            source="test-prior",
            format_type="superflex",
            snapshot_date=date(2026, 4, 1),
        )
        quarterback = Player(full_name="Available QB", position="QB", nfl_team="BUF")
        texans = Player(full_name="Houston Texans", position="DST", nfl_team="HOU")
        placeholder = Player(full_name="source_not_substantiated_placeholder", position="RB")
        unsubstantiated = Player(full_name="Chris Johnson", position="WR")
        fallback_wr = Player(full_name="Fallback WR", position="WR")
        session.add(snapshot)
        session.add(previous_snapshot)
        session.add(quarterback)
        session.add(texans)
        session.add(placeholder)
        session.add(unsubstantiated)
        session.add(fallback_wr)
        session.commit()
        session.add(
            ADPEntry(snapshot_id=snapshot.id, player_id=quarterback.id, position="QB", adp_pick=1)
        )
        session.add(
            ADPEntry(snapshot_id=snapshot.id, player_id=texans.id, position="DST", adp_pick=23)
        )
        session.add(
            ADPEntry(snapshot_id=snapshot.id, player_id=placeholder.id, position="RB", adp_pick=51)
        )
        session.add(
            ADPEntry(
                snapshot_id=snapshot.id,
                player_id=unsubstantiated.id,
                position="WR",
                adp_pick=96,
                source_note="Insufficient current-source substantiation.",
            )
        )
        session.add(
            ADPEntry(
                snapshot_id=previous_snapshot.id,
                player_id=fallback_wr.id,
                position="WR",
                adp_pick=174,
                adp_round=15,
            )
        )
        session.commit()
        snapshot_id = str(snapshot.id)

    create_response = client.post(
        f"/api/leagues/{league_id}/mock-drafts",
        json={"adp_snapshot_id": snapshot_id},
    )

    assert create_response.status_code == 201
    available = create_response.json()["available_players"]
    assert "source_not_substantiated_placeholder" not in {
        player["player_name"] for player in available
    }
    assert "Chris Johnson" not in {player["player_name"] for player in available}
    fallback_row = next(player for player in available if player["player_name"] == "Fallback WR")
    assert fallback_row["adp_pick"] == 174
    texans_row = next(player for player in available if player["player_name"] == "Houston Texans")
    assert texans_row["adp_pick"] is None


def test_adp_import_converts_round_pick_notation_to_overall_pick(client: TestClient) -> None:
    _create_admin_and_login(client)
    league_response = client.post(
        "/api/leagues",
        json={"name": "Round Pick ADP League", "season_year": 2026},
    )
    assert league_response.status_code == 201
    league_id = league_response.json()["id"]
    for draft_slot in range(1, 13):
        team_response = client.post(
            f"/api/leagues/{league_id}/teams",
            json={"name": f"Round Pick Team {draft_slot}", "draft_slot": draft_slot},
        )
        assert team_response.status_code == 201

    csv_text = (
        "player,position,adp_pick,source,snapshot_date,format\n"
        "Late RB,RB,21.09,Endpoint ADP,2026-05-01,superflex\n"
        "Deep QB,QB,447.06,Endpoint ADP,2026-05-01,superflex\n"
    )
    preview_response = client.post(
        f"/api/leagues/{league_id}/adp/preview",
        content=csv_text,
        headers={"content-type": "text/csv"},
    )
    assert preview_response.status_code == 200
    assert preview_response.json()["rows"][0]["adp_pick"] == 249
    assert preview_response.json()["rows"][1]["adp_pick"] == 447.06

    import_response = client.post(
        f"/api/leagues/{league_id}/adp/import",
        content=csv_text,
        headers={"content-type": "text/csv"},
    )
    assert import_response.status_code == 200
    snapshot_response = client.get(f"/api/adp-snapshots/{import_response.json()['rows'][0]['snapshot_id']}")
    assert snapshot_response.status_code == 200
    assert snapshot_response.json()["rows"][0]["adp_pick"] == 249
    assert snapshot_response.json()["rows"][0]["adp_round"] == 21
    assert snapshot_response.json()["rows"][1]["adp_pick"] == 447.06
    assert snapshot_response.json()["rows"][1]["adp_round"] == 38


def test_draftsharks_browser_payload_does_not_convert_large_decimal_adp() -> None:
    rows = _parse_draftsharks_browser_payload(
        {
            "rows": [
                {
                    "player": "Deep QB",
                    "position": "QB",
                    "nfl_team": "CLE",
                    "adp_pick": 447.06,
                    "rank": "447.06",
                },
                {
                    "player": "Late RB",
                    "position": "RB",
                    "nfl_team": "LAR",
                    "adp_pick": "21.09",
                },
            ]
        },
        team_count=12,
    )

    assert rows[("deepqb", "QB")].adp_pick == 447.06
    assert rows[("laterb", "RB")].adp_pick == 249


def test_ai_adp_refresh_imports_validated_board(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _create_admin_and_login(client)
    league_response = client.post(
        "/api/leagues",
        json={"name": "AI ADP League", "season_year": 2026, "scoring_format": "superflex"},
    )
    assert league_response.status_code == 201
    league_id = uuid.UUID(league_response.json()["id"])

    def build_ai_adp_board(session: Session, league: object, settings: Settings) -> AIADPBoard:
        return AIADPBoard(
            snapshot_name="AI ADP League AI Synthesized ADP",
            snapshot_date=date(2026, 5, 25),
            source="AI Synthesized ADP",
            source_url="openai:responses:web_search",
            notes='{"provider":"ai_synthesized","guardrails":{"warnings":[]}}',
            warnings=[],
            rows=[
                AIADPRow(1, "AI QB", "QB", "BUF", 1, 1, ["FantasyPros"], "high", "QB note"),
                AIADPRow(2, "AI RB", "RB", "ATL", 2, 1, ["FFC"], "high", "RB note"),
                AIADPRow(3, "AI WR", "WR", "DET", 3, 1, ["Draft Sharks"], "medium", "WR note"),
                AIADPRow(4, "AI TE", "TE", "KC", 4, 1, ["FFToday"], "medium", "TE note"),
                AIADPRow(5, "AI K", "K", "DAL", 100, 9, ["FantasyPros"], "low", "K note"),
                AIADPRow(6, "AI DST", "DST", "PIT", 101, 9, ["FantasyPros"], "low", "DST note"),
            ],
        )

    monkeypatch.setattr("app.services.adp_refresh.build_ai_adp_board", build_ai_adp_board)

    with _session_from_client(client) as session:
        result = refresh_adp_from_api(
            session,
            league_id,
            _test_settings(
                database_url="sqlite://",
                adp_provider="ai_synthesized",
                openai_api_key="test-key",
                adp_ai_board_size=6,
            ),
        )

    assert result.provider == "ai_synthesized"
    assert result.source_url == "openai:responses:web_search"
    assert result.import_result.imported == 6
    assert result.import_result.rows[0]["player_name"] == "AI QB"
    assert result.import_result.rows[-1]["position"] == "DST"


def test_ai_adp_refresh_candidate_can_be_approved(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _create_admin_and_login(client)
    league_response = client.post(
        "/api/leagues",
        json={"name": "AI Candidate League", "season_year": 2026, "scoring_format": "superflex"},
    )
    assert league_response.status_code == 201
    league_id = league_response.json()["id"]

    def build_ai_adp_board(session: Session, league: object, settings: Settings, **kwargs: object) -> AIADPBoard:
        return AIADPBoard(
            snapshot_name="AI Candidate League AI Synthesized ADP",
            snapshot_date=date(2026, 5, 25),
            source="AI Synthesized ADP",
            source_url="openai:responses:web_search",
            notes='{"provider":"ai_synthesized","guardrails":{"warning_sample":["Big move"]},"source_summary":"Test sources"}',
            warnings=["Big move"],
            rows=[
                AIADPRow(1, "Candidate QB", "QB", "BUF", 1, 1, ["FantasyPros"], "high", "QB note"),
                AIADPRow(2, "Candidate RB", "RB", "ATL", 2, 1, ["FFC"], "medium", "RB note"),
            ],
        )

    monkeypatch.setattr("app.services.adp_review.build_ai_adp_board", build_ai_adp_board)

    candidate_response = client.post(f"/api/leagues/{league_id}/adp/ai-refresh-candidates")
    assert candidate_response.status_code == 201
    candidate = candidate_response.json()
    assert candidate["status"] == "pending"
    assert candidate["row_count"] == 2
    assert candidate["warnings"] == ["Big move"]
    assert candidate["source_summary"] == "Test sources"

    approve_response = client.post(f"/api/adp/ai-refresh-candidates/{candidate['id']}/approve")
    assert approve_response.status_code == 200
    assert approve_response.json()["status"] == "approved"
    assert approve_response.json()["imported"] == 2

    snapshots_response = client.get(f"/api/leagues/{league_id}/adp-snapshots")
    assert snapshots_response.status_code == 200
    assert snapshots_response.json()["count"] == 1
    snapshot_id = snapshots_response.json()["rows"][0]["id"]
    snapshot_response = client.get(f"/api/adp-snapshots/{snapshot_id}")
    assert [row["player_name"] for row in snapshot_response.json()["rows"]] == ["Candidate QB", "Candidate RB"]


def test_ai_adp_refresh_candidate_can_be_rejected(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _create_admin_and_login(client)
    league_response = client.post(
        "/api/leagues",
        json={"name": "AI Candidate Reject League", "season_year": 2026, "scoring_format": "superflex"},
    )
    assert league_response.status_code == 201
    league_id = league_response.json()["id"]

    def build_ai_adp_board(session: Session, league: object, settings: Settings, **kwargs: object) -> AIADPBoard:
        return AIADPBoard(
            snapshot_name="AI Candidate Reject League AI Synthesized ADP",
            snapshot_date=date(2026, 5, 25),
            source="AI Synthesized ADP",
            source_url="openai:responses:web_search",
            notes='{"provider":"ai_synthesized","guardrails":{"warning_sample":[]}}',
            warnings=[],
            rows=[AIADPRow(1, "Reject QB", "QB", "BUF", 1, 1, ["FantasyPros"], "high", "QB note")],
        )

    monkeypatch.setattr("app.services.adp_review.build_ai_adp_board", build_ai_adp_board)

    candidate_response = client.post(f"/api/leagues/{league_id}/adp/ai-refresh-candidates")
    assert candidate_response.status_code == 201
    candidate_id = candidate_response.json()["id"]

    reject_response = client.post(
        f"/api/adp/ai-refresh-candidates/{candidate_id}/reject",
        json={"reason": "Needs manual review"},
    )
    assert reject_response.status_code == 200
    assert reject_response.json()["status"] == "rejected"
    assert reject_response.json()["error_message"] == "Needs manual review"

    snapshots_response = client.get(f"/api/leagues/{league_id}/adp-snapshots")
    assert snapshots_response.status_code == 200
    assert snapshots_response.json()["count"] == 0


def test_ai_adp_guardrails_reject_duplicate_players() -> None:
    rows = [
        AIADPRow(1, "Duplicate QB", "QB", "BUF", 1, 1, ["FantasyPros"], "high", "one"),
        AIADPRow(2, "Duplicate QB", "QB", "BUF", 2, 1, ["FFC"], "high", "two"),
    ]

    with pytest.raises(AIADPError, match="Duplicate AI ADP player"):
        _validate_board(
            rows,
            previous={},
            settings=_test_settings(database_url="sqlite://", adp_ai_board_size=2),
        )


def test_ai_adp_guardrails_reject_position_placeholders() -> None:
    rows = [
        AIADPRow(1, "Quarterbacks", "QB", None, 1, 1, ["FantasyPros"], "low", "placeholder"),
    ]

    with pytest.raises(AIADPError, match="position placeholder"):
        _validate_board(
            rows,
            previous={},
            settings=_test_settings(database_url="sqlite://", adp_ai_board_size=1),
        )


def test_ai_adp_guardrails_reject_unsubstantiated_placeholders() -> None:
    rows = [
        AIADPRow(
            1,
            "source_not_substantiated_placeholder",
            "RB",
            None,
            51,
            5,
            ["FantasyPros"],
            "low",
            "placeholder",
        ),
    ]

    with pytest.raises(AIADPError, match="position placeholder"):
        _validate_board(
            rows,
            previous={},
            settings=_test_settings(database_url="sqlite://", adp_ai_board_size=1),
        )


def test_ai_adp_guardrails_reject_unsubstantiated_source_notes() -> None:
    rows = [
        AIADPRow(
            1,
            "Chris Johnson",
            "WR",
            None,
            96,
            8,
            ["FantasyPros"],
            "low",
            "Insufficient current-source substantiation.",
        ),
    ]

    with pytest.raises(AIADPError, match="lacks current-source substantiation"):
        _validate_board(
            rows,
            previous={},
            settings=_test_settings(database_url="sqlite://", adp_ai_board_size=1),
        )


def test_ai_adp_guardrails_reject_early_special_teams() -> None:
    rows = [
        AIADPRow(1, "Houston Texans", "DST", None, 23, 2, ["FantasyPros"], "low", "DST note"),
    ]

    with pytest.raises(AIADPError, match="implausibly early"):
        _validate_board(
            rows,
            previous={},
            settings=_test_settings(database_url="sqlite://", adp_ai_board_size=1),
        )


def test_ai_adp_board_dedupes_extra_candidates_before_validation() -> None:
    rows = [
        AIADPRow(1, "Duplicate QB", "QB", "BUF", 1, 1, ["FantasyPros"], "high", "one"),
        AIADPRow(2, "Duplicate QB", "QB", "BUF", 2, 1, ["FFC"], "high", "two"),
        AIADPRow(3, "Unique RB", "RB", "ATL", 3, 1, ["Draft Sharks"], "medium", "three"),
    ]

    board = _dedupe_and_trim_board(rows, 2)

    assert [row.full_name for row in board] == ["Duplicate QB", "Unique RB"]
    assert [row.rank for row in board] == [1, 2]


def test_admin_can_manage_users_passwords_and_team_assignment(client: TestClient) -> None:
    _create_admin_and_login(client)
    league_response = client.post(
        "/api/leagues",
        json={"name": "User Admin League", "season_year": 2026},
    )
    assert league_response.status_code == 201
    league_id = league_response.json()["id"]
    team_response = client.post(
        f"/api/leagues/{league_id}/teams",
        json={"name": "Assigned Team", "draft_slot": 2},
    )
    assert team_response.status_code == 201
    team_id = team_response.json()["id"]

    user_response = client.post(
        "/api/admin/users",
        json={
            "email": "owner@example.com",
            "password": "first-secret",
            "role": "user",
            "team_id": team_id,
        },
    )

    assert user_response.status_code == 201
    user_payload = user_response.json()
    assert "password" not in user_payload
    assert user_payload["team_id"] == team_id
    user_id = user_payload["id"]

    updated_response = client.patch(
        f"/api/admin/users/{user_id}",
        json={"email": "renamed@example.com", "is_active": False, "team_id": None},
    )
    assert updated_response.status_code == 200
    assert updated_response.json()["email"] == "renamed@example.com"
    assert updated_response.json()["is_active"] is False
    assert updated_response.json()["team_id"] is None

    reset_response = client.post(
        f"/api/admin/users/{user_id}/reset-password",
        json={"password": "second-secret"},
    )
    assert reset_response.status_code == 200
    assert "password" not in reset_response.json()

    client.patch(f"/api/admin/users/{user_id}", json={"is_active": True})
    client.post("/api/auth/logout")
    login_response = client.post(
        "/api/auth/login",
        json={"email": "renamed@example.com", "password": "second-secret"},
    )
    assert login_response.status_code == 200

    client.post("/api/auth/logout")
    client.post("/api/auth/login", json={"email": "admin@example.com", "password": "secret"})
    delete_response = client.delete(f"/api/admin/users/{user_id}")
    assert delete_response.status_code == 204
    team_list_response = client.get(f"/api/leagues/{league_id}/teams")
    assert team_list_response.status_code == 200
    assert team_list_response.json()["rows"][0]["user_id"] is None


def test_user_settings_and_scenario_selections_are_isolated(client: TestClient) -> None:
    _create_admin_and_login(client)
    league_response = client.post(
        "/api/leagues",
        json={"name": "Auth League", "season_year": 2026},
    )
    assert league_response.status_code == 201
    league_id = league_response.json()["id"]
    team_response = client.post(
        f"/api/leagues/{league_id}/teams",
        json={"name": "Auth Team", "draft_slot": 1},
    )
    assert team_response.status_code == 201
    team_id = team_response.json()["id"]
    response = client.post(
        "/api/admin/users",
        json={"email": "user@example.com", "password": "secret", "role": "user"},
    )
    assert response.status_code == 201

    admin_settings = client.patch(
        f"/api/leagues/{league_id}/optimizer/settings",
        json={"minimum_keeper_value": 9},
    )
    assert admin_settings.status_code == 200
    admin_selection = client.put(
        f"/api/leagues/{league_id}/scenario-selections/{team_id}",
        json={"scenario_name": "Pure Value"},
    )
    assert admin_selection.status_code == 200

    client.post("/api/auth/logout")
    login_response = client.post(
        "/api/auth/login",
        json={"email": "user@example.com", "password": "secret"},
    )
    assert login_response.status_code == 200
    user_settings = client.patch(
        f"/api/leagues/{league_id}/optimizer/settings",
        json={"minimum_keeper_value": 3},
    )
    assert user_settings.status_code == 200
    user_selection = client.put(
        f"/api/leagues/{league_id}/scenario-selections/{team_id}",
        json={"scenario_name": "Balanced"},
    )
    assert user_selection.status_code == 200

    assert client.get(f"/api/leagues/{league_id}/optimizer/settings").json()[
        "minimum_keeper_value"
    ] == 3
    assert client.get(f"/api/leagues/{league_id}/scenario-selections").json()["rows"][0][
        "scenario_name"
    ] == "Balanced"

    client.post("/api/auth/logout")
    client.post("/api/auth/login", json={"email": "admin@example.com", "password": "secret"})

    assert client.get(f"/api/leagues/{league_id}/optimizer/settings").json()[
        "minimum_keeper_value"
    ] == 9
    assert client.get(f"/api/leagues/{league_id}/scenario-selections").json()["rows"][0][
        "scenario_name"
    ] == "Pure Value"


def test_optimizer_run_endpoint_returns_frontend_table(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _disable_draftsharks_browser_scraper(monkeypatch)

    class FakeResponse:
        def __init__(self, body: str) -> None:
            self.body = body.encode("utf-8")

        def __enter__(self) -> "FakeResponse":
            return self

        def __exit__(self, exc_type, exc, tb) -> None:
            return None

        def read(self) -> bytes:
            return self.body

    def fake_urlopen(request, timeout):
        url = request.full_url
        if "draftsharks.com/rankings/ppr-superflex" in url:
            return FakeResponse(
                """
                <tr class="player-row mpb-player__tr" data-pid="1">
                  <tr class="player-row">
                    <td class="rank centered"><div class="column-title rank-index"><span>1</span></div></td>
                    <td class="player-name overall"><div class="player-name-inner"><div><a class="hide-on-mobile">Value WR</a><div><div class="team-position-logo-container"><span>PHI</span><div class="position-rank RB">WR1</div></div></div></div></div></td>
                    <td class="adp centered" data-value="1.02"></td>
                  </tr>
                </tr>
                <tr class="player-row mpb-player__tr" data-pid="2">
                  <tr class="player-row">
                    <td class="rank centered"><div class="column-title rank-index"><span>2</span></div></td>
                    <td class="player-name overall"><div class="player-name-inner"><div><a class="hide-on-mobile">Value RB</a><div><div class="team-position-logo-container"><span>ATL</span><div class="position-rank RB">RB1</div></div></div></div></div></td>
                    <td class="adp centered" data-value="3.04"></td>
                  </tr>
                </tr>
                <tr class="player-row mpb-player__tr" data-pid="3">
                  <tr class="player-row">
                    <td class="rank centered"><div class="column-title rank-index"><span>3</span></div></td>
                    <td class="player-name overall"><div class="player-name-inner"><div><a class="hide-on-mobile">Market QB</a><div><div class="team-position-logo-container"><span>CIN</span><div class="position-rank RB">QB1</div></div></div></div></div></td>
                    <td class="adp centered" data-value="1.08"></td>
                  </tr>
                </tr>
                """
            )
        if "sleeper.app" in url:
            return FakeResponse('{"1":{"full_name":"Value WR","position":"WR","team":"PHI"},"2":{"full_name":"Value RB","position":"RB","team":"ATL"},"3":{"full_name":"Market QB","position":"QB","team":"CIN"}}')
        if "fantasyfootballcalculator.com" in url:
            return FakeResponse('{"players": []}')
        raise AssertionError(f"Unexpected URL: {url}")

    monkeypatch.setattr(
        "app.services.composite_adp.urllib.request.urlopen",
        fake_urlopen,
    )

    league_response = client.post(
        "/api/leagues",
        json={
            "name": "Endpoint League",
            "season_year": 2026,
            "scoring_format": "superflex",
        },
    )
    assert league_response.status_code == 201
    league_id = league_response.json()["id"]

    team_response = client.post(
        f"/api/leagues/{league_id}/teams",
        json={"name": "Endpoint Team", "draft_slot": 1},
    )
    assert team_response.status_code == 201

    other_team_response = client.post(
        f"/api/leagues/{league_id}/teams",
        json={"name": "Other Team", "draft_slot": 2},
    )
    assert other_team_response.status_code == 201
    other_team_id = other_team_response.json()["id"]

    league_update_response = client.patch(
        f"/api/leagues/{league_id}",
        json={"keeper_rules": {"cost": "same-team draft pick or ADP"}},
    )
    assert league_update_response.status_code == 200
    assert league_update_response.json()["keeper_rules"]["cost"] == "same-team draft pick or ADP"

    team_update_response = client.patch(
        f"/api/teams/{other_team_id}",
        json={"owner_name": "Other Owner"},
    )
    assert team_update_response.status_code == 200
    assert team_update_response.json()["owner_name"] == "Other Owner"

    invalid_draft_preview = client.post(
        f"/api/leagues/{league_id}/draft-results/preview",
        content=(
            "team,round,overall_pick,player,position\n"
            "Endpoint Team,5,50,Value WR,WR\n"
            "Ghost Team,5,50,Copy WR,WR\n"
            "Endpoint Team,0,nope,Bad Player,FLEX\n"
        ),
        headers={"content-type": "text/csv"},
    )
    assert invalid_draft_preview.status_code == 200
    invalid_draft_payload = invalid_draft_preview.json()
    assert invalid_draft_payload["valid"] is False
    assert invalid_draft_payload["error_count"] == 4
    assert invalid_draft_payload["warning_count"] == 1
    assert any(error["field"] == "overall_pick" for error in invalid_draft_payload["errors"])
    assert invalid_draft_payload["warnings"][0]["field"] == "team"

    valid_draft_preview = client.post(
        f"/api/leagues/{league_id}/draft-results/preview",
        content=(
            "team,round,overall_pick,player,position\n"
            "Endpoint Team,5,50,Value WR,WR\n"
            "Endpoint Team,8,90,Value RB,RB\n"
        ),
        headers={"content-type": "text/csv"},
    )
    assert valid_draft_preview.status_code == 200
    assert valid_draft_preview.json()["valid"] is True
    assert valid_draft_preview.json()["valid_rows"] == 2

    draft_response = client.post(
        f"/api/leagues/{league_id}/draft-results/import",
        content=(
            "team,round,overall_pick,player,position\n"
            "Endpoint Team,5,50,Value WR,WR\n"
            "Endpoint Team,8,90,Value RB,RB\n"
            "Endpoint Team,2,20,Market QB,QB\n"
            "Other Team,1,1,Other WR,WR\n"
        ),
        headers={"content-type": "text/csv"},
    )
    assert draft_response.status_code == 200
    assert draft_response.json()["imported"] == 4
    draft_results_response = client.get(f"/api/leagues/{league_id}/draft-results")
    assert draft_results_response.status_code == 200
    assert draft_results_response.json()["count"] == 4
    assert draft_results_response.json()["rows"][0]["player_name"] == "Other WR"

    roster_response = client.post(
        f"/api/leagues/{league_id}/final-rosters/import",
        content=(
            "team,player,position,roster_status\n"
            "Endpoint Team,Value WR,WR,Starter\n"
            "Endpoint Team,Value RB,RB,Starter\n"
            "Endpoint Team,Market QB,QB,Starter\n"
        ),
        headers={"content-type": "text/csv"},
    )
    assert roster_response.status_code == 200
    assert roster_response.json()["count"] == 3
    roster_results_response = client.get(f"/api/leagues/{league_id}/final-rosters")
    assert roster_results_response.status_code == 200
    assert roster_results_response.json()["count"] == 3
    assert roster_results_response.json()["rows"][0]["acquired_via"] == "Drafted"

    invalid_roster_preview = client.post(
        f"/api/leagues/{league_id}/final-rosters/preview",
        content=(
            "team,player,position,roster_status\n"
            "Endpoint Team,Value WR,WR,Starter\n"
            "Endpoint Team,Value WR,WR,Bench\n"
            "Endpoint Team,Bad Position,FLEX,Bench\n"
        ),
        headers={"content-type": "text/csv"},
    )
    assert invalid_roster_preview.status_code == 200
    assert invalid_roster_preview.json()["valid"] is False
    assert invalid_roster_preview.json()["error_count"] == 2

    adp_response = client.post(
        f"/api/leagues/{league_id}/adp/import",
        content=(
            "player,position,adp_pick,source,snapshot_date,format\n"
            "Value WR,WR,15,Endpoint ADP,2026-05-01,superflex\n"
            "Value RB,RB,40,Endpoint ADP,2026-05-01,superflex\n"
            "Market QB,QB,20,Endpoint ADP,2026-05-01,superflex\n"
        ),
        headers={"content-type": "text/csv"},
    )
    assert adp_response.status_code == 200
    assert adp_response.json()["count"] == 3
    snapshots_response = client.get(f"/api/leagues/{league_id}/adp-snapshots")
    assert snapshots_response.status_code == 200
    assert snapshots_response.json()["count"] == 1
    snapshot_id = snapshots_response.json()["rows"][0]["id"]
    snapshot_response = client.get(f"/api/adp-snapshots/{snapshot_id}")
    assert snapshot_response.status_code == 200
    assert snapshot_response.json()["snapshot"]["entry_count"] == 3
    assert snapshot_response.json()["rows"][0]["player_name"] == "Value WR"
    adp_template_response = client.get(f"/api/leagues/{league_id}/exports/adp-template.csv")
    assert adp_template_response.status_code == 200
    assert "player,position,nfl_team,adp_pick,adp_round,source,snapshot_name,snapshot_date,format,source_note,draftsharks_superflex_adp,ffc_2qb_adp,ffc_ppr_adp,existing_adp,composite_method,source_count,adp_spread,disagreement_flag,sleeper_player_id,sleeper_status,adp_movement,movement_flag,review_flag" in adp_template_response.text
    assert "Composite Superflex ADP - Endpoint League,Endpoint League Composite ADP" in adp_template_response.text

    invalid_adp_preview = client.post(
        f"/api/leagues/{league_id}/adp/preview",
        content=(
            "player,position,adp_pick,source,snapshot_date\n"
            "Value WR,WR,15,Endpoint ADP,2026-05-01\n"
            "Value WR,WR,16,Endpoint ADP,2026-05-01\n"
            "Bad ADP,FLEX,-1,Endpoint ADP,not-a-date\n"
        ),
        headers={"content-type": "text/csv"},
    )
    assert invalid_adp_preview.status_code == 200
    assert invalid_adp_preview.json()["valid"] is False
    assert invalid_adp_preview.json()["error_count"] == 4

    settings_read_response = client.get(f"/api/leagues/{league_id}/optimizer/settings")
    assert settings_read_response.status_code == 200

    settings_response = client.patch(
        f"/api/leagues/{league_id}/optimizer/settings",
        json={
            "minimum_keeper_value": 1,
            "minimum_keeper_score": 0,
            "max_keepers": 4,
            "max_keepers_per_position": 2,
            "max_qb_keepers": 1,
        },
    )
    assert settings_response.status_code == 200

    run_response = client.post(f"/api/leagues/{league_id}/optimizer/run", json={})
    assert run_response.status_code == 200
    payload = run_response.json()

    assert payload["count"] == 3
    assert payload["selected_count"] == 2
    assert {"team_name", "player_name", "keeper_score", "is_recommended"}.issubset(
        payload["columns"]
    )

    selected_names = {
        row["player_name"] for row in payload["rows"] if row["is_recommended"]
    }
    assert selected_names == {"Value WR", "Value RB"}

    qb_row = next(row for row in payload["rows"] if row["player_name"] == "Market QB")
    assert qb_row["is_recommended"] is False
    assert qb_row["reason"] == "Keeper value below minimum"
    value_rb_row = next(row for row in payload["rows"] if row["player_name"] == "Value RB")

    force_response = client.put(
        f"/api/leagues/{league_id}/manual-overrides",
        json={
            "team_id": qb_row["team_id"],
            "player_id": qb_row["player_id"],
            "override_type": "force_keep",
        },
    )
    assert force_response.status_code == 200
    assert force_response.json()["override_type"] == "force_keep"
    exclude_response = client.put(
        f"/api/leagues/{league_id}/manual-overrides",
        json={
            "team_id": value_rb_row["team_id"],
            "player_id": value_rb_row["player_id"],
            "override_type": "exclude",
            "notes": "Testing override flow",
        },
    )
    assert exclude_response.status_code == 200
    assert exclude_response.json()["notes"] == "Testing override flow"
    overrides_response = client.get(f"/api/leagues/{league_id}/manual-overrides")
    assert overrides_response.status_code == 200
    assert overrides_response.json()["count"] == 2

    rerun_response = client.post(f"/api/leagues/{league_id}/optimizer/run", json={})
    assert rerun_response.status_code == 200
    rerun_payload = rerun_response.json()
    overridden_selected = {
        row["player_name"] for row in rerun_payload["rows"] if row["is_recommended"]
    }
    assert overridden_selected == {"Value WR", "Market QB"}
    overridden_rb = next(row for row in rerun_payload["rows"] if row["player_name"] == "Value RB")
    assert overridden_rb["manual_override"] == "exclude"
    assert overridden_rb["reason"] == "Manual override excluded player"

    clear_response = client.put(
        f"/api/leagues/{league_id}/manual-overrides",
        json={
            "team_id": qb_row["team_id"],
            "player_id": qb_row["player_id"],
            "override_type": "auto",
        },
    )
    assert clear_response.status_code == 200
    assert clear_response.json()["override_type"] == "auto"

    results_response = client.get(f"/api/leagues/{league_id}/optimizer/results")
    assert results_response.status_code == 200
    results_payload = results_response.json()
    assert results_payload["count"] == 3
    assert results_payload["selected_count"] == 2

    draft_impact_response = client.get(f"/api/leagues/{league_id}/draft-impact?rounds=30")
    assert draft_impact_response.status_code == 200
    draft_impact_payload = draft_impact_response.json()
    assert draft_impact_payload["forfeited_count"] == 2
    forfeited = [row for row in draft_impact_payload["rows"] if row["status"] == "Forfeited"]
    assert {row["keeper_player"] for row in forfeited} == {"Value WR", "Market QB"}

    clear_rb_response = client.put(
        f"/api/leagues/{league_id}/manual-overrides",
        json={
            "team_id": value_rb_row["team_id"],
            "player_id": value_rb_row["player_id"],
            "override_type": "auto",
        },
    )
    assert clear_rb_response.status_code == 200
    restore_response = client.post(f"/api/leagues/{league_id}/optimizer/run", json={})
    assert restore_response.status_code == 200
    restored_selected = {
        row["player_name"] for row in restore_response.json()["rows"] if row["is_recommended"]
    }
    assert restored_selected == {"Value WR", "Value RB"}

    scenarios_response = client.post(
        f"/api/leagues/{league_id}/optimizer/scenarios",
        json={"persist": False},
    )
    assert scenarios_response.status_code == 200
    scenarios_payload = scenarios_response.json()
    assert scenarios_payload["scenario_names"] == [
        "Pure Value",
        "Balanced",
        "Superflex Heavy",
        "Win Now",
        "Rebuild",
    ]
    assert scenarios_payload["count"] == 5
    assert "Endpoint Team" in scenarios_payload["team_names"]

    balanced = next(
        scenario
        for scenario in scenarios_payload["scenarios"]
        if scenario["scenario_name"] == "Balanced"
    )
    endpoint_team = next(
        team
        for team in balanced["teams"]
        if team["team_name"] == "Endpoint Team"
    )
    assert endpoint_team["total_keeper_score"] > 0
    assert endpoint_team["picks_forfeited"] == ["R5 / Pick 50", "R8 / Pick 90"]
    assert [keeper["player_name"] for keeper in endpoint_team["selected_keepers"]] == [
        "Value WR",
        "Value RB",
    ]
    assert endpoint_team["strategic_notes"]


def test_optimizer_settings_endpoint_accepts_negative_keeper_value_floor(
    client: TestClient,
) -> None:
    league_response = client.post(
        "/api/leagues",
        json={
            "name": "Threshold League",
            "season_year": 2026,
            "scoring_format": "superflex",
        },
    )
    assert league_response.status_code == 201
    league_id = league_response.json()["id"]

    settings_response = client.patch(
        f"/api/leagues/{league_id}/optimizer/settings",
        json={"minimum_keeper_value": -5},
    )
    assert settings_response.status_code == 200
    assert settings_response.json()["minimum_keeper_value"] == -5


def test_elite_player_bonus_can_override_raw_keeper_value_floor(client: TestClient) -> None:
    league_response = client.post(
        "/api/leagues",
        json={
            "name": "Elite Bonus League",
            "season_year": 2026,
            "scoring_format": "superflex",
        },
    )
    assert league_response.status_code == 201
    league_id = league_response.json()["id"]

    team_response = client.post(
        f"/api/leagues/{league_id}/teams",
        json={"name": "Death Is On The Line", "draft_slot": 1},
    )
    assert team_response.status_code == 201

    draft_response = client.post(
        f"/api/leagues/{league_id}/draft-results/import",
        content="team,player,position,overall_pick,round\nDeath Is On The Line,Jahmyr Gibbs,RB,1,1\n",
        headers={"content-type": "text/csv"},
    )
    assert draft_response.status_code == 200

    roster_response = client.post(
        f"/api/leagues/{league_id}/final-rosters/import",
        content="team,player,position,roster_status\nDeath Is On The Line,Jahmyr Gibbs,RB,Starter\n",
        headers={"content-type": "text/csv"},
    )
    assert roster_response.status_code == 200

    adp_response = client.post(
        f"/api/leagues/{league_id}/adp/import",
        content=(
            "player,position,adp_pick,source,snapshot_date,format,"
            "floor,consensus_proj,ds_proj,ceiling,3d_value,risk,injury\n"
            "Jahmyr Gibbs,RB,4,DraftSharks Superflex,2026-05-01,superflex,"
            "235,280,290,330,96,1,0\n"
        ),
        headers={"content-type": "text/csv"},
    )
    assert adp_response.status_code == 200

    settings_response = client.patch(
        f"/api/leagues/{league_id}/optimizer/settings",
        json={"minimum_keeper_value": 1, "minimum_keeper_score": 0},
    )
    assert settings_response.status_code == 200

    run_response = client.post(f"/api/leagues/{league_id}/optimizer/run", json={})
    assert run_response.status_code == 200
    gibbs_row = next(row for row in run_response.json()["rows"] if row["player_name"] == "Jahmyr Gibbs")
    assert gibbs_row["keeper_value"] == -3
    assert gibbs_row["is_recommended"] is True

    settings_response = client.patch(
        f"/api/leagues/{league_id}/optimizer/settings",
        json={"enable_elite_player_bonus": False},
    )
    assert settings_response.status_code == 200

    rerun_response = client.post(f"/api/leagues/{league_id}/optimizer/run", json={})
    assert rerun_response.status_code == 200
    gibbs_row = next(row for row in rerun_response.json()["rows"] if row["player_name"] == "Jahmyr Gibbs")
    assert gibbs_row["is_recommended"] is False
    assert gibbs_row["reason"] == "Keeper value below minimum"


def test_draft_impact_uses_team_round_pick_in_snake_draft(client: TestClient) -> None:
    league_response = client.post(
        "/api/leagues",
        json={
            "name": "Snake Draft Impact League",
            "season_year": 2026,
            "scoring_format": "superflex",
            "draft_type": "snake",
        },
    )
    assert league_response.status_code == 201
    league_id = league_response.json()["id"]

    for draft_slot in range(1, 5):
        response = client.post(
            f"/api/leagues/{league_id}/teams",
            json={"name": f"Team {draft_slot}", "draft_slot": draft_slot},
        )
        assert response.status_code == 201

    roster_response = client.post(
        f"/api/leagues/{league_id}/final-rosters/import",
        content="team,player,position,roster_status\nTeam 4,Elite QB,QB,Starter\n",
        headers={"content-type": "text/csv"},
    )
    assert roster_response.status_code == 200

    adp_response = client.post(
        f"/api/leagues/{league_id}/adp/import",
        content=(
            "player,position,adp_pick,source,snapshot_date,format\n"
            "Elite QB,QB,2,Endpoint ADP,2026-05-01,superflex\n"
        ),
        headers={"content-type": "text/csv"},
    )
    assert adp_response.status_code == 200

    settings_response = client.patch(
        f"/api/leagues/{league_id}/optimizer/settings",
        json={
            "minimum_keeper_value": -5,
            "minimum_keeper_score": 0,
            "max_keepers": 4,
            "max_qb_keepers": 1,
        },
    )
    assert settings_response.status_code == 200

    run_response = client.post(f"/api/leagues/{league_id}/optimizer/run", json={})
    assert run_response.status_code == 200
    selected_rows = [row for row in run_response.json()["rows"] if row["is_recommended"]]
    assert {row["player_name"] for row in selected_rows} == {"Elite QB"}

    draft_impact_response = client.get(f"/api/leagues/{league_id}/draft-impact?rounds=2")
    assert draft_impact_response.status_code == 200
    rows = draft_impact_response.json()["rows"]

    round_one = [row for row in rows if row["round"] == 1]
    assert [row["team_name"] for row in round_one] == ["Team 1", "Team 2", "Team 3", "Team 4"]
    assert round_one[1]["status"] == "Open"
    assert round_one[3]["status"] == "Forfeited"
    assert round_one[3]["keeper_player"] == "Elite QB"


def test_adp_template_builds_composite_from_ffc_sources(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _disable_draftsharks_browser_scraper(monkeypatch)

    class FakeResponse:
        def __init__(self, body: str) -> None:
            self.body = body.encode("utf-8")

        def __enter__(self) -> "FakeResponse":
            return self

        def __exit__(self, exc_type, exc, tb) -> None:
            return None

        def read(self) -> bytes:
            return self.body

    def fake_urlopen(request, timeout):
        url = request.full_url
        if "draftsharks.com/rankings/ppr-superflex" in url:
            return FakeResponse(
                """
                <tr class="player-row"><td class="rank centered"><div class="column-title rank-index"><span>1</span></div></td><td class="player-name overall"><div class="player-name-inner"><div><a class="hide-on-mobile">Elite QB</a><div><div class="team-position-logo-container"><span>BAL</span><div class="position-rank RB">QB1</div></div></div></div></div></td><td class="adp centered" data-value="1.01"></td></tr>
                <tr class="player-row"><td class="rank centered"><div class="column-title rank-index"><span>2</span></div></td><td class="player-name overall"><div class="player-name-inner"><div><a class="hide-on-mobile">Elite WR</a><div><div class="team-position-logo-container"><span>CIN</span><div class="position-rank RB">WR1</div></div></div></div></div></td><td class="adp centered" data-value="1.05"></td></tr>
                <tr class="player-row"><td class="rank centered"><div class="column-title rank-index"><span>3</span></div></td><td class="player-name overall"><div class="player-name-inner"><div><a class="hide-on-mobile">League QB</a><div><div class="team-position-logo-container"><span>BUF</span><div class="position-rank RB">QB2</div></div></div></div></div></td><td class="adp centered" data-value="2.02"></td></tr>
                <tr class="player-row"><td class="rank centered"><div class="column-title rank-index"><span>4</span></div></td><td class="player-name overall"><div class="player-name-inner"><div><a class="hide-on-mobile">League WR</a><div><div class="team-position-logo-container"><span>PHI</span><div class="position-rank RB">WR2</div></div></div></div></div></td><td class="adp centered" data-value="3.07"></td></tr>
                <tr class="player-row"><td class="rank centered"><div class="column-title rank-index"><span>249</span></div></td><td class="player-name overall"><div class="player-name-inner"><div><a class="hide-on-mobile">Late RB</a><div><div class="team-position-logo-container"><span>LAR</span><div class="position-rank RB">RB80</div></div></div></div></div></td><td class="adp centered" data-value="21.09"></td></tr>
                """
            )
        if "sleeper.app" in url:
            return FakeResponse(
                '{"1":{"full_name":"Elite QB","position":"QB","team":"BAL"},"2":{"full_name":"Elite WR","position":"WR","team":"CIN"},"3":{"full_name":"League QB","position":"QB","team":"BUF"},"4":{"full_name":"League WR","position":"WR","team":"PHI"},"5":{"full_name":"Late RB","position":"RB","team":"LAR"}}'
            )
        if "fantasyfootballcalculator.com" in url:
            return FakeResponse('{"players": []}')
        raise AssertionError(f"Unexpected URL: {url}")

    monkeypatch.setattr(
        "app.services.composite_adp.urllib.request.urlopen",
        fake_urlopen,
    )

    league_response = client.post(
        "/api/leagues",
        json={
            "name": "Composite League",
            "season_year": 2026,
            "scoring_format": "superflex",
        },
    )
    assert league_response.status_code == 201
    league_id = league_response.json()["id"]

    for draft_slot in range(1, 13):
        team_response = client.post(
            f"/api/leagues/{league_id}/teams",
            json={"name": f"Composite Team {draft_slot}", "draft_slot": draft_slot},
        )
        assert team_response.status_code == 201

    roster_response = client.post(
        f"/api/leagues/{league_id}/final-rosters/import",
        content=(
            "team,player,position,roster_status\n"
            "Composite Team 1,League QB,QB,Starter\n"
            "Composite Team 1,League WR,WR,Starter\n"
        ),
        headers={"content-type": "text/csv"},
    )
    assert roster_response.status_code == 200

    template_response = client.get(f"/api/leagues/{league_id}/exports/adp-template.csv")
    assert template_response.status_code == 200
    assert "Elite QB,QB,BAL,1,1,Composite Superflex ADP - Composite League" in template_response.text
    assert "Elite WR,WR,CIN,2,1,Composite Superflex ADP - Composite League" in template_response.text
    assert "League QB,QB,BUF,3,1,Composite Superflex ADP - Composite League" in template_response.text
    assert "League WR,WR,PHI,4,1,Composite Superflex ADP - Composite League" in template_response.text
    assert "Late RB,RB,LAR,249,21,Composite Superflex ADP - Composite League" in template_response.text
    assert "DS:1" in template_response.text
    assert "draftsharks_superflex_adp" in template_response.text


def test_adp_template_uses_browser_scraped_draftsharks_rows(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class FakeCompletedProcess:
        returncode = 0
        stderr = ""

        def __init__(self, stdout: str) -> None:
            self.stdout = stdout

    class FakeResponse:
        def __init__(self, body: str) -> None:
            self.body = body.encode("utf-8")

        def __enter__(self) -> "FakeResponse":
            return self

        def __exit__(self, exc_type, exc, tb) -> None:
            return None

        def read(self) -> bytes:
            return self.body

    browser_rows = [
        {
            "player": f"Browser Player {index}",
            "position": "QB" if index % 2 else "WR",
            "nfl_team": "BUF" if index % 2 else "MIA",
            "adp_pick": float(index),
        }
        for index in range(1, 31)
    ]
    browser_rows[-1] = {
        "player": "Late Browser Player",
        "position": "WR",
        "nfl_team": "MIA",
        "adp_pick": 30.5,
    }

    def fake_run(*args, **kwargs):
        return FakeCompletedProcess(
            json.dumps(
                {
                    "source_url": "https://www.draftsharks.com/rankings/ppr-superflex",
                    "row_count": len(browser_rows),
                    "rows": browser_rows,
                }
            )
        )

    def fake_urlopen(request, timeout):
        url = request.full_url
        if "sleeper.app" in url:
            return FakeResponse("{}")
        if "fantasyfootballcalculator.com" in url:
            return FakeResponse('{"players": []}')
        raise AssertionError(f"Unexpected URL: {url}")

    monkeypatch.setattr("app.services.composite_adp.subprocess.run", fake_run)
    monkeypatch.setattr(
        "app.services.composite_adp.urllib.request.urlopen",
        fake_urlopen,
    )

    league_response = client.post(
        "/api/leagues",
        json={
            "name": "Browser DraftSharks League",
            "season_year": 2026,
            "scoring_format": "superflex",
        },
    )
    assert league_response.status_code == 201
    league_id = league_response.json()["id"]

    for draft_slot in range(1, 13):
        team_response = client.post(
            f"/api/leagues/{league_id}/teams",
            json={"name": f"Browser Team {draft_slot}", "draft_slot": draft_slot},
        )
        assert team_response.status_code == 201

    template_response = client.get(f"/api/leagues/{league_id}/exports/adp-template.csv")
    assert template_response.status_code == 200
    assert "Late Browser Player,WR,MIA,30.5,3,Composite Superflex ADP - Browser DraftSharks League" in template_response.text
    assert "DS:30.5" in template_response.text


def test_composite_adp_import_endpoint_ingests_generated_rows(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class FakeCompletedProcess:
        returncode = 0
        stderr = ""

        def __init__(self, stdout: str) -> None:
            self.stdout = stdout

    class FakeResponse:
        def __init__(self, body: str) -> None:
            self.body = body.encode("utf-8")

        def __enter__(self) -> "FakeResponse":
            return self

        def __exit__(self, exc_type, exc, tb) -> None:
            return None

        def read(self) -> bytes:
            return self.body

    browser_rows = [
        {
            "player": f"Imported Composite Player {index}",
            "position": "QB" if index % 2 else "RB",
            "nfl_team": "BUF" if index % 2 else "ATL",
            "adp_pick": float(index),
        }
        for index in range(1, 31)
    ]

    def fake_run(*args, **kwargs):
        return FakeCompletedProcess(
            json.dumps(
                {
                    "source_url": "https://www.draftsharks.com/rankings/ppr-superflex",
                    "row_count": len(browser_rows),
                    "rows": browser_rows,
                }
            )
        )

    def fake_urlopen(request, timeout):
        url = request.full_url
        if "sleeper.app" in url:
            return FakeResponse("{}")
        if "fantasyfootballcalculator.com" in url:
            return FakeResponse('{"players": []}')
        raise AssertionError(f"Unexpected URL: {url}")

    monkeypatch.setattr("app.services.composite_adp.subprocess.run", fake_run)
    monkeypatch.setattr(
        "app.services.composite_adp.urllib.request.urlopen",
        fake_urlopen,
    )

    league_response = client.post(
        "/api/leagues",
        json={
            "name": "Composite Import League",
            "season_year": 2026,
            "scoring_format": "superflex",
        },
    )
    assert league_response.status_code == 201
    league_id = league_response.json()["id"]

    for draft_slot in range(1, 13):
        team_response = client.post(
            f"/api/leagues/{league_id}/teams",
            json={"name": f"Import Team {draft_slot}", "draft_slot": draft_slot},
        )
        assert team_response.status_code == 201

    import_response = client.post(f"/api/leagues/{league_id}/adp/import-composite")
    assert import_response.status_code == 200
    assert import_response.json()["imported"] == 30
    assert import_response.json()["generated"] == 30
    assert import_response.json()["skipped_missing_adp"] == 0
    coverage = import_response.json()["coverage"]
    assert coverage["total_players"] == 30
    assert "source_coverage" in coverage
    assert "top_150" in coverage
    assert "movement" in coverage
    assert "roster_players" in coverage

    snapshots_response = client.get(f"/api/leagues/{league_id}/adp-snapshots")
    assert snapshots_response.status_code == 200
    assert snapshots_response.json()["count"] == 1
    assert snapshots_response.json()["rows"][0]["entry_count"] == 30

    snapshot_id = snapshots_response.json()["rows"][0]["id"]
    snapshot_response = client.get(f"/api/adp-snapshots/{snapshot_id}")
    assert snapshot_response.status_code == 200
    assert snapshot_response.json()["rows"][0]["player_name"] == "Imported Composite Player 1"
    assert snapshot_response.json()["rows"][0]["adp_pick"] == 1


def test_composite_template_falls_back_to_scraped_ffc_pages(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _disable_draftsharks_browser_scraper(monkeypatch)

    class FakeResponse:
        def __init__(self, body: str) -> None:
            self.body = body.encode("utf-8")

        def __enter__(self) -> "FakeResponse":
            return self

        def __exit__(self, exc_type, exc, tb) -> None:
            return None

        def read(self) -> bytes:
            return self.body

    def fake_urlopen(request, timeout):
        url = request.full_url
        if "draftsharks.com/rankings/ppr-superflex" in url:
            return FakeResponse(
                """
                <tr class="player-row"><td class="rank centered"><div class="column-title rank-index"><span>1</span></div></td><td class="player-name overall"><div class="player-name-inner"><div><a class="hide-on-mobile">Josh Allen</a><div><div class="team-position-logo-container"><span>BUF</span><div class="position-rank RB">QB1</div></div></div></div></div></td><td class="adp centered" data-value="1.01"></td></tr>
                <tr class="player-row"><td class="rank centered"><div class="column-title rank-index"><span>2</span></div></td><td class="player-name overall"><div class="player-name-inner"><div><a class="hide-on-mobile">Lamar Jackson</a><div><div class="team-position-logo-container"><span>BAL</span><div class="position-rank RB">QB2</div></div></div></div></div></td><td class="adp centered" data-value="1.08"></td></tr>
                <tr class="player-row"><td class="rank centered"><div class="column-title rank-index"><span>3</span></div></td><td class="player-name overall"><div class="player-name-inner"><div><a class="hide-on-mobile">Ja'Marr Chase</a><div><div class="team-position-logo-container"><span>CIN</span><div class="position-rank RB">WR1</div></div></div></div></div></td><td class="adp centered" data-value="1.10"></td></tr>
                <tr class="player-row"><td class="rank centered"><div class="column-title rank-index"><span>4</span></div></td><td class="player-name overall"><div class="player-name-inner"><div><a class="hide-on-mobile">Bijan Robinson</a><div><div class="team-position-logo-container"><span>ATL</span><div class="position-rank RB">RB1</div></div></div></div></div></td><td class="adp centered" data-value="2.04"></td></tr>
                """
            )
        if "sleeper.app" in url:
            return FakeResponse("{}")
        if "fantasyfootballcalculator.com" in url:
            return FakeResponse('{"players": []}')
        raise AssertionError(f"Unexpected URL: {url}")

    monkeypatch.setattr(
        "app.services.composite_adp.urllib.request.urlopen",
        fake_urlopen,
    )

    league_response = client.post(
        "/api/leagues",
        json={
            "name": "Scraped Composite League",
            "season_year": 2026,
            "scoring_format": "superflex",
        },
    )
    assert league_response.status_code == 201
    league_id = league_response.json()["id"]

    for draft_slot in range(1, 13):
        team_response = client.post(
            f"/api/leagues/{league_id}/teams",
            json={"name": f"Scrape Team {draft_slot}", "draft_slot": draft_slot},
        )
        assert team_response.status_code == 201

    template_response = client.get(f"/api/leagues/{league_id}/exports/adp-template.csv")
    assert template_response.status_code == 200
    assert "Josh Allen,QB,BUF,1,1,Composite Superflex ADP - Scraped Composite League" in template_response.text
    assert "Lamar Jackson,QB,BAL,2,1,Composite Superflex ADP - Scraped Composite League" in template_response.text
    assert "Ja'Marr Chase,WR,CIN,3,1,Composite Superflex ADP - Scraped Composite League" in template_response.text
    assert "Bijan Robinson,RB,ATL,4,1,Composite Superflex ADP - Scraped Composite League" in template_response.text
    assert "adp-template-" in template_response.headers["content-disposition"]


def test_adp_template_returns_error_when_composite_sources_are_unavailable(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _disable_draftsharks_browser_scraper(monkeypatch)

    def failing_urlopen(request, timeout):
        raise OSError("network down")

    monkeypatch.setattr(
        "app.services.composite_adp.urllib.request.urlopen",
        failing_urlopen,
    )

    league_response = client.post(
        "/api/leagues",
        json={
            "name": "Unavailable Composite League",
            "season_year": 2026,
            "scoring_format": "superflex",
        },
    )
    assert league_response.status_code == 201
    league_id = league_response.json()["id"]

    response = client.get(f"/api/leagues/{league_id}/exports/adp-template.csv")
    assert response.status_code == 400
    assert "Composite ADP build failed" in response.json()["detail"]


def test_adp_template_returns_error_when_draftsharks_public_page_is_gated(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _disable_draftsharks_browser_scraper(monkeypatch)

    class FakeResponse:
        def __init__(self, body: str) -> None:
            self.body = body.encode("utf-8")

        def __enter__(self) -> "FakeResponse":
            return self

        def __exit__(self, exc_type, exc, tb) -> None:
            return None

        def read(self) -> bytes:
            return self.body

    draftsharks_rows = "".join(
        f"""
        <tr class="player-row">
          <td class="rank centered"><div class="column-title rank-index"><span>{index}</span></div></td>
          <td class="player-name overall">
            <div class="player-name-inner"><div><a class="hide-on-mobile">Player {index}</a>
              <div><div class="team-position-logo-container"><span>BUF</span><div class="position-rank RB">QB{index}</div></div></div>
            </div></div>
          </td>
          <td class="adp centered" data-value="1.{index:02d}"></td>
        </tr>
        """
        for index in range(1, 27)
    )

    def fake_urlopen(request, timeout):
        url = request.full_url
        if "draftsharks.com/rankings/ppr-superflex" in url:
            return FakeResponse(
                f"""
                <html>
                  <body>
                    <script>var subscriptionAppData = {{}};</script>
                    {draftsharks_rows}
                  </body>
                </html>
                """
            )
        if "sleeper.app" in url:
            return FakeResponse("{}")
        if "fantasyfootballcalculator.com" in url:
            raise OSError("FFC unreachable in test")
        raise AssertionError(f"Unexpected URL: {url}")

    monkeypatch.setattr(
        "app.services.composite_adp.urllib.request.urlopen",
        fake_urlopen,
    )

    league_response = client.post(
        "/api/leagues",
        json={
            "name": "Gated DraftSharks League",
            "season_year": 2026,
            "scoring_format": "superflex",
        },
    )
    assert league_response.status_code == 201
    league_id = league_response.json()["id"]

    response = client.get(f"/api/leagues/{league_id}/exports/adp-template.csv")
    assert response.status_code == 400
    assert "Composite ADP build failed" in response.json()["detail"]


def test_composite_builds_from_ffc_when_draftsharks_gated(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _disable_draftsharks_browser_scraper(monkeypatch)

    class FakeResponse:
        def __init__(self, body: str) -> None:
            self.body = body.encode("utf-8")

        def __enter__(self) -> "FakeResponse":
            return self

        def __exit__(self, exc_type, exc, tb) -> None:
            return None

        def read(self) -> bytes:
            return self.body

    gated_ds_rows = "".join(
        f"""
        <tr class="player-row">
          <td class="rank centered"><div class="column-title rank-index"><span>{i}</span></div></td>
          <td class="player-name overall">
            <div class="player-name-inner"><div><a class="hide-on-mobile">DS Player {i}</a>
              <div><div class="team-position-logo-container"><span>BUF</span><div class="position-rank RB">QB{i}</div></div></div>
            </div></div>
          </td>
          <td class="adp centered" data-value="1.{i:02d}"></td>
        </tr>
        """
        for i in range(1, 27)
    )

    ffc_2qb_json = json.dumps({
        "players": [
            {"name": "FFC QB One", "position": "QB", "team": "KC", "adp": 1.0},
            {"name": "FFC WR Two", "position": "WR", "team": "SF", "adp": 2.0},
            {"name": "FFC RB Three", "position": "RB", "team": "DEN", "adp": 3.0},
        ]
    })

    def fake_urlopen(request, timeout):
        url = request.full_url
        if "draftsharks.com/rankings/ppr-superflex" in url:
            return FakeResponse(
                f"""
                <html>
                  <body>
                    <script>var subscriptionAppData = {{}};</script>
                    {gated_ds_rows}
                  </body>
                </html>
                """
            )
        if "sleeper.app" in url:
            return FakeResponse("{}")
        if "fantasyfootballcalculator.com" in url and "2qb" in url:
            return FakeResponse(ffc_2qb_json)
        if "fantasyfootballcalculator.com" in url:
            return FakeResponse('{"players": []}')
        raise AssertionError(f"Unexpected URL: {url}")

    monkeypatch.setattr(
        "app.services.composite_adp.urllib.request.urlopen",
        fake_urlopen,
    )

    league_response = client.post(
        "/api/leagues",
        json={
            "name": "FFC Fallback League",
            "season_year": 2026,
            "scoring_format": "superflex",
        },
    )
    assert league_response.status_code == 201
    league_id = league_response.json()["id"]

    for draft_slot in range(1, 13):
        team_response = client.post(
            f"/api/leagues/{league_id}/teams",
            json={"name": f"FFC Team {draft_slot}", "draft_slot": draft_slot},
        )
        assert team_response.status_code == 201

    template_response = client.get(f"/api/leagues/{league_id}/exports/adp-template.csv")
    assert template_response.status_code == 200
    assert "FFC QB One,QB,KC,1,1,Composite Superflex ADP - FFC Fallback League" in template_response.text
    assert "FFC WR Two,WR,SF,2,1,Composite Superflex ADP - FFC Fallback League" in template_response.text
    assert "FFC2QB:1" in template_response.text
    assert "ffc_2qb_only" in template_response.text


def test_adp_coverage_summary_endpoint_returns_quality_stats(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _disable_draftsharks_browser_scraper(monkeypatch)
    _create_admin_and_login(client)

    class FakeResponse:
        def __init__(self, body: str) -> None:
            self.body = body.encode("utf-8")

        def __enter__(self) -> "FakeResponse":
            return self

        def __exit__(self, exc_type, exc, tb) -> None:
            return None

        def read(self) -> bytes:
            return self.body

    ffc_2qb_players = [
        {"name": f"Coverage Player {i}", "position": "QB" if i % 2 else "WR", "team": "BUF", "adp": float(i)}
        for i in range(1, 11)
    ]

    def fake_urlopen(request, timeout):
        url = request.full_url
        if "draftsharks.com" in url:
            raise OSError("DS unavailable")
        if "sleeper.app" in url:
            return FakeResponse("{}")
        if "fantasyfootballcalculator.com" in url and "2qb" in url:
            return FakeResponse(json.dumps({"players": ffc_2qb_players}))
        if "fantasyfootballcalculator.com" in url:
            return FakeResponse('{"players": []}')
        raise AssertionError(f"Unexpected URL: {url}")

    monkeypatch.setattr("app.services.composite_adp.urllib.request.urlopen", fake_urlopen)

    league_response = client.post(
        "/api/leagues",
        json={"name": "Coverage League", "season_year": 2026, "scoring_format": "superflex"},
    )
    assert league_response.status_code == 201
    league_id = league_response.json()["id"]

    for draft_slot in range(1, 5):
        client.post(
            f"/api/leagues/{league_id}/teams",
            json={"name": f"Coverage Team {draft_slot}", "draft_slot": draft_slot},
        )

    summary_response = client.get(f"/api/leagues/{league_id}/adp/coverage-summary")
    assert summary_response.status_code == 200
    coverage = summary_response.json()
    assert coverage["total_players"] == 10
    assert coverage["source_coverage"]["1"] == 10   # all single-source (FFC 2QB only)
    assert coverage["top_150"]["total"] == 10
    assert coverage["top_150"]["multi_source_count"] == 0
    assert coverage["roster_players"]["total"] == 0  # no roster imports


def test_optimizer_results_do_not_duplicate_after_settings_are_created(
    client: TestClient,
) -> None:
    league_response = client.post(
        "/api/leagues",
        json={
            "name": "Duplicate Guard League",
            "season_year": 2026,
            "scoring_format": "superflex",
        },
    )
    assert league_response.status_code == 201
    league_id = league_response.json()["id"]

    team_response = client.post(
        f"/api/leagues/{league_id}/teams",
        json={"name": "Guard Team", "draft_slot": 1},
    )
    assert team_response.status_code == 201

    draft_response = client.post(
        f"/api/leagues/{league_id}/draft-results/import",
        content="team,round,overall_pick,player,position\nGuard Team,5,50,Discount WR,WR\n",
        headers={"content-type": "text/csv"},
    )
    assert draft_response.status_code == 200

    roster_response = client.post(
        f"/api/leagues/{league_id}/final-rosters/import",
        content="team,player,position,roster_status\nGuard Team,Discount WR,WR,Starter\n",
        headers={"content-type": "text/csv"},
    )
    assert roster_response.status_code == 200

    adp_response = client.post(
        f"/api/leagues/{league_id}/adp/import",
        content=(
            "player,position,adp_pick,source,snapshot_date,format\n"
            "Discount WR,WR,10,Guard ADP,2026-05-01,superflex\n"
        ),
        headers={"content-type": "text/csv"},
    )
    assert adp_response.status_code == 200

    first_run = client.post(f"/api/leagues/{league_id}/optimizer/run", json={})
    assert first_run.status_code == 200
    assert first_run.json()["count"] == 1

    settings_response = client.get(f"/api/leagues/{league_id}/optimizer/settings")
    assert settings_response.status_code == 200

    second_run = client.post(f"/api/leagues/{league_id}/optimizer/run", json={})
    assert second_run.status_code == 200
    assert second_run.json()["count"] == 1

    results_response = client.get(f"/api/leagues/{league_id}/optimizer/results")
    assert results_response.status_code == 200
    results_payload = results_response.json()
    assert results_payload["count"] == 1
    assert results_payload["selected_count"] == 1
    assert results_payload["rows"][0]["player_name"] == "Discount WR"

    csv_export_response = client.get(
        f"/api/leagues/{league_id}/exports/keeper-recommendations.csv"
    )
    assert csv_export_response.status_code == 200
    assert csv_export_response.text.count("Discount WR") == 1


def test_adp_refresh_endpoint_imports_configured_csv(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class FakeResponse:
        def __enter__(self) -> "FakeResponse":
            return self

        def __exit__(self, exc_type, exc, tb) -> None:
            return None

        def read(self) -> bytes:
            return (
                "player,position,adp_pick,source,snapshot_date,format\n"
                "API WR,WR,12,Configured ADP,2026-05-02,superflex\n"
                "API QB,QB,25,Configured ADP,2026-05-02,superflex\n"
            ).encode("utf-8")

    monkeypatch.setattr(
        "app.api.routes.leagues.get_settings",
        lambda: _test_settings(
            adp_refresh_url="https://example.com/adp.csv",
            adp_refresh_timeout_seconds=5,
        ),
    )
    monkeypatch.setattr(
        "app.services.adp_refresh.urllib.request.urlopen",
        lambda request, timeout: FakeResponse(),
    )

    league_response = client.post(
        "/api/leagues",
        json={
            "name": "ADP Refresh League",
            "season_year": 2026,
            "scoring_format": "superflex",
        },
    )
    assert league_response.status_code == 201
    league_id = league_response.json()["id"]

    refresh_response = client.post(f"/api/leagues/{league_id}/adp/refresh")
    assert refresh_response.status_code == 200
    assert refresh_response.json()["imported"] == 2
    assert refresh_response.json()["provider"] == "csv_url"
    assert refresh_response.json()["source_url"] == "https://example.com/adp.csv"

    snapshots_response = client.get(f"/api/leagues/{league_id}/adp-snapshots")
    assert snapshots_response.status_code == 200
    assert snapshots_response.json()["count"] == 1

    snapshot_id = snapshots_response.json()["rows"][0]["id"]
    snapshot_response = client.get(f"/api/adp-snapshots/{snapshot_id}")
    assert snapshot_response.status_code == 200
    assert [row["player_name"] for row in snapshot_response.json()["rows"]] == ["API WR", "API QB"]


def test_adp_refresh_endpoint_supports_fantasy_nerds_provider(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class FakeResponse:
        def __enter__(self) -> "FakeResponse":
            return self

        def __exit__(self, exc_type, exc, tb) -> None:
            return None

        def read(self) -> bytes:
            return (
                '[{"name":"Nerds QB","position":"QB","adp":18,"last_update":"2026-05-15"},'
                '{"name":"Nerds WR","position":"WR","adp":44,"last_update":"2026-05-15"}]'
            ).encode("utf-8")

    monkeypatch.setattr(
        "app.api.routes.leagues.get_settings",
        lambda: _test_settings(
            adp_provider="fantasynerds",
            fantasy_nerds_api_key="live-key",
            fantasy_nerds_adp_url="https://api.fantasynerds.com/v1/nfl/adp",
            adp_refresh_timeout_seconds=5,
        ),
    )
    monkeypatch.setattr(
        "app.services.adp_refresh.urllib.request.urlopen",
        lambda request, timeout: FakeResponse(),
    )

    league_response = client.post(
        "/api/leagues",
        json={
            "name": "Fantasy Nerds League",
            "season_year": 2026,
            "scoring_format": "superflex",
        },
    )
    assert league_response.status_code == 201
    league_id = league_response.json()["id"]
    client.post(f"/api/leagues/{league_id}/teams", json={"name": "Team 1", "draft_slot": 1})
    client.post(f"/api/leagues/{league_id}/teams", json={"name": "Team 2", "draft_slot": 2})

    refresh_response = client.post(f"/api/leagues/{league_id}/adp/refresh")
    assert refresh_response.status_code == 200
    assert refresh_response.json()["imported"] == 2
    assert refresh_response.json()["provider"] == "fantasynerds"
    assert "teams=2" in refresh_response.json()["source_url"]
    assert "format=superflex" in refresh_response.json()["source_url"]

    snapshots_response = client.get(f"/api/leagues/{league_id}/adp-snapshots")
    assert snapshots_response.status_code == 200
    snapshot_id = snapshots_response.json()["rows"][0]["id"]

    snapshot_response = client.get(f"/api/adp-snapshots/{snapshot_id}")
    assert snapshot_response.status_code == 200
    assert [row["player_name"] for row in snapshot_response.json()["rows"]] == ["Nerds QB", "Nerds WR"]


def test_adp_refresh_endpoint_supports_fantasy_football_calculator_provider(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class FakeResponse:
        def __enter__(self) -> "FakeResponse":
            return self

        def __exit__(self, exc_type, exc, tb) -> None:
            return None

        def read(self) -> bytes:
            return (
                '{"players":['
                '{"name":"FFC QB","position":"QB","adp":18.4},'
                '{"name":"FFC WR","position":"WR","adp":41.2}'
                "]}".encode("utf-8")
            )

    monkeypatch.setattr(
        "app.api.routes.leagues.get_settings",
        lambda: _test_settings(
            adp_provider="fantasyfootballcalculator",
            fantasy_football_calculator_adp_url="https://fantasyfootballcalculator.com/api/v1/adp",
            adp_refresh_timeout_seconds=5,
        ),
    )
    monkeypatch.setattr(
        "app.services.adp_refresh.urllib.request.urlopen",
        lambda request, timeout: FakeResponse(),
    )

    league_response = client.post(
        "/api/leagues",
        json={
            "name": "FFC League",
            "season_year": 2026,
            "scoring_format": "superflex",
        },
    )
    assert league_response.status_code == 201
    league_id = league_response.json()["id"]
    client.post(f"/api/leagues/{league_id}/teams", json={"name": "Team 1", "draft_slot": 1})
    client.post(f"/api/leagues/{league_id}/teams", json={"name": "Team 2", "draft_slot": 2})

    refresh_response = client.post(f"/api/leagues/{league_id}/adp/refresh")
    assert refresh_response.status_code == 200
    assert refresh_response.json()["imported"] == 2
    assert refresh_response.json()["provider"] == "fantasyfootballcalculator"
    assert "/2qb?" in refresh_response.json()["source_url"]
    assert "teams=2" in refresh_response.json()["source_url"]
    assert "year=2026" in refresh_response.json()["source_url"]

    snapshots_response = client.get(f"/api/leagues/{league_id}/adp-snapshots")
    assert snapshots_response.status_code == 200
    snapshot_id = snapshots_response.json()["rows"][0]["id"]

    snapshot_response = client.get(f"/api/adp-snapshots/{snapshot_id}")
    assert snapshot_response.status_code == 200
    assert [row["player_name"] for row in snapshot_response.json()["rows"]] == ["FFC QB", "FFC WR"]


def test_fantasy_football_news_endpoint_returns_headlines(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class FakeResponse:
        def __enter__(self) -> "FakeResponse":
            return self

        def __exit__(self, exc_type, exc, tb) -> None:
            return None

        def read(self) -> bytes:
            return (
                "<rss><channel>"
                "<item>"
                "<title>Fantasy Breakout Candidate Emerges - Example Source</title>"
                "<link>https://example.com/news-1</link>"
                "<pubDate>Fri, 16 May 2026 10:00:00 GMT</pubDate>"
                "<source>Example Source</source>"
                "</item>"
                "<item>"
                "<title>Brutal fantasy football punishment sends lone astronaut to Kauffman Stadium nosebleeds for Royals game - Offbeat Source</title>"
                "<link>https://example.com/news-offbeat</link>"
                "<pubDate>Fri, 16 May 2026 11:00:00 GMT</pubDate>"
                "<source>Offbeat Source</source>"
                "</item>"
                "<item>"
                "<title>Backfield Battle Shifts Heading Into Camp - Another Source</title>"
                "<link>https://example.com/news-2</link>"
                "<pubDate>Fri, 16 May 2026 12:00:00 GMT</pubDate>"
                "<source>Another Source</source>"
                "</item>"
                "<item>"
                "<title>Pressing fantasy baseball questions: Can Ben Brown be a starter? - The New York Times</title>"
                "<link>https://example.com/news-baseball</link>"
                "<pubDate>Fri, 16 May 2026 12:30:00 GMT</pubDate>"
                "<source>The New York Times</source>"
                "</item>"
                "<item>"
                "<title>Brian Flores subpoenas 25 NFL teams to delay discrimination lawsuit, league alleges - The Athletic</title>"
                "<link>https://example.com/news-lawsuit</link>"
                "<pubDate>Fri, 16 May 2026 13:00:00 GMT</pubDate>"
                "<source>The Athletic</source>"
                "</item>"
                "</channel></rss>"
            ).encode("utf-8")

    monkeypatch.setattr(
        "app.services.news_feed.urllib.request.urlopen",
        lambda request, timeout: FakeResponse(),
    )
    monkeypatch.setattr("app.services.news_feed._NEWS_CACHE", None)

    news_response = client.get("/api/news/fantasy-football")
    assert news_response.status_code == 200
    payload = news_response.json()
    assert payload["count"] == 2
    assert [row["link"] for row in payload["rows"]] == [
        "https://example.com/news-1",
        "https://example.com/news-2",
    ]
    assert payload["rows"][0]["headline"] == "Fantasy Breakout Candidate Emerges"
    assert payload["rows"][0]["link"] == "https://example.com/news-1"
    assert payload["rows"][0]["source"] == "Example Source"


def test_fantasy_football_news_filters_stale_cached_noise(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "app.services.news_feed._NEWS_CACHE",
        news_feed._NewsCache(
            fetched_at=datetime.now(UTC),
            items=[
                news_feed.NewsItem(
                    headline="Fantasy Breakout Candidate Emerges",
                    link="https://example.com/news-1",
                    published_at="2026-05-16T10:00:00+00:00",
                    source="Example Source",
                ),
                news_feed.NewsItem(
                    headline=(
                        "Brutal fantasy football punishment sends lone astronaut to "
                        "Kauffman Stadium nosebleeds for Royals game"
                    ),
                    link="https://example.com/news-offbeat",
                    published_at="2026-05-16T11:00:00+00:00",
                    source="Offbeat Source",
                ),
                news_feed.NewsItem(
                    headline="Pressing fantasy baseball questions: Can Ben Brown be a starter?",
                    link="https://example.com/news-baseball",
                    published_at="2026-05-16T12:30:00+00:00",
                    source="The New York Times",
                ),
                news_feed.NewsItem(
                    headline=(
                        "Brian Flores subpoenas 25 NFL teams to delay discrimination "
                        "lawsuit, league alleges"
                    ),
                    link="https://example.com/news-lawsuit",
                    published_at="2026-05-16T13:00:00+00:00",
                    source="The Athletic",
                ),
            ],
        ),
    )

    news_response = client.get("/api/news/fantasy-football")

    assert news_response.status_code == 200
    payload = news_response.json()
    assert payload["count"] == 1
    assert payload["rows"][0]["link"] == "https://example.com/news-1"


# ---------------------------------------------------------------------------
# Phase 4: Keeper Recommendation Explanations
# ---------------------------------------------------------------------------


def _setup_keeper_recommendation(
    client: TestClient,
) -> tuple[str, str]:
    """Create a league with one eligible recommendation and return (league_id, recommendation_id)."""
    _create_admin_and_login(client)
    league_resp = client.post(
        "/api/leagues",
        json={"name": "Explanation League", "season_year": 2026, "draft_type": "snake"},
    )
    assert league_resp.status_code == 201
    league_id = league_resp.json()["id"]
    team_resp = client.post(
        f"/api/leagues/{league_id}/teams",
        json={"name": "Explain Team", "draft_slot": 1},
    )
    assert team_resp.status_code == 201
    team_id = team_resp.json()["id"]

    with _session_from_client(client) as session:
        player = Player(full_name="Explain WR", position="WR", nfl_team="SF")
        session.add(player)
        session.commit()
        snapshot = ADPSnapshot(
            league_id=uuid.UUID(league_id),
            season_year=2026,
            name="Explain ADP",
            source="test",
            format_type="ppr",
            snapshot_date=date(2026, 5, 1),
        )
        session.add(snapshot)
        session.commit()
        session.add(
            ADPEntry(
                snapshot_id=snapshot.id,
                player_id=player.id,
                position="WR",
                adp_pick=20.0,
            )
        )
        session.add(
            DraftPick(
                league_id=uuid.UUID(league_id),
                team_id=uuid.UUID(team_id),
                player_id=player.id,
                season_year=2026,
                round=3,
                overall_pick=30,
                position="WR",
                nfl_team="SF",
            )
        )
        session.add(
            FinalRosterEntry(
                league_id=uuid.UUID(league_id),
                team_id=uuid.UUID(team_id),
                player_id=player.id,
                season_year=2026,
                position="WR",
                nfl_team="SF",
            )
        )
        session.commit()

    run_resp = client.post(f"/api/leagues/{league_id}/optimizer/run", json={})
    assert run_resp.status_code == 200
    rows = run_resp.json()["rows"]
    assert rows, "Expected at least one recommendation row"
    recommendation_id = rows[0]["id"]
    return league_id, recommendation_id


def test_keeper_explanation_get_returns_null_when_not_generated(client: TestClient) -> None:
    league_id, recommendation_id = _setup_keeper_recommendation(client)

    response = client.get(
        f"/api/leagues/{league_id}/optimizer/results/{recommendation_id}/explanation"
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["recommendation_id"] == recommendation_id
    assert payload["ai_explanation"] is None


def test_keeper_explanation_post_returns_503_when_ai_disabled(client: TestClient) -> None:
    league_id, recommendation_id = _setup_keeper_recommendation(client)

    response = client.post(
        f"/api/leagues/{league_id}/optimizer/results/{recommendation_id}/explanation",
        json={},
    )

    assert response.status_code == 503
    assert "not enabled" in response.json()["detail"].lower()


def test_keeper_explanation_generates_and_caches(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    league_id, recommendation_id = _setup_keeper_recommendation(client)

    monkeypatch.setattr(keeper_explanation_ai, "is_enabled", lambda settings: True)
    call_count = 0

    def fake_generate(**kwargs: object) -> KeeperExplanationResult:
        nonlocal call_count
        call_count += 1
        return KeeperExplanationResult(
            short_reason="Great value at this cost.",
            value_explanation="ADP is 10 picks earlier than cost.",
            risk_note="No significant injury history.",
            opportunity_cost="Forfeiting a late-round pick.",
            decision="strong keep",
        )

    monkeypatch.setattr(keeper_explanation_ai, "generate_keeper_explanation", fake_generate)

    first_response = client.post(
        f"/api/leagues/{league_id}/optimizer/results/{recommendation_id}/explanation",
        json={},
    )
    assert first_response.status_code == 200
    payload = first_response.json()
    assert payload["ai_explanation"]["decision"] == "strong keep"
    assert payload["ai_explanation"]["short_reason"] == "Great value at this cost."
    assert call_count == 1

    second_response = client.post(
        f"/api/leagues/{league_id}/optimizer/results/{recommendation_id}/explanation",
        json={},
    )
    assert second_response.status_code == 200
    assert second_response.json()["ai_explanation"]["decision"] == "strong keep"
    assert call_count == 1, "AI should not be called again for a cached explanation"


def test_keeper_explanation_appears_in_optimizer_results_after_generation(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    league_id, recommendation_id = _setup_keeper_recommendation(client)

    results_before = client.get(f"/api/leagues/{league_id}/optimizer/results")
    assert results_before.status_code == 200
    row_before = next(
        (r for r in results_before.json()["rows"] if r["id"] == recommendation_id),
        None,
    )
    assert row_before is not None
    assert row_before["ai_explanation"] is None

    monkeypatch.setattr(keeper_explanation_ai, "is_enabled", lambda settings: True)
    monkeypatch.setattr(
        keeper_explanation_ai,
        "generate_keeper_explanation",
        lambda **kwargs: KeeperExplanationResult(
            short_reason="Solid value.",
            value_explanation="Draft cost is well below ADP.",
            risk_note="Healthy starter.",
            opportunity_cost="Round 3 pick.",
            decision="lean keep",
        ),
    )
    client.post(
        f"/api/leagues/{league_id}/optimizer/results/{recommendation_id}/explanation",
        json={},
    )

    results_after = client.get(f"/api/leagues/{league_id}/optimizer/results")
    assert results_after.status_code == 200
    row_after = next(
        (r for r in results_after.json()["rows"] if r["id"] == recommendation_id),
        None,
    )
    assert row_after is not None
    assert row_after["ai_explanation"] is not None
    assert row_after["ai_explanation"]["decision"] == "lean keep"
    assert row_after["ai_explanation"]["short_reason"] == "Solid value."


def test_explanation_input_hash_is_deterministic() -> None:
    league_id = uuid.UUID("11111111-1111-1111-1111-111111111111")
    player_id = uuid.UUID("22222222-2222-2222-2222-222222222222")

    h1 = explanation_input_hash(
        league_id=league_id,
        user_id=None,
        player_id=player_id,
        scenario_name="Default",
        keeper_cost_pick=30.0,
        adp_pick=20.0,
        keeper_score=12.5,
    )
    h2 = explanation_input_hash(
        league_id=league_id,
        user_id=None,
        player_id=player_id,
        scenario_name="Default",
        keeper_cost_pick=30.0,
        adp_pick=20.0,
        keeper_score=12.5,
    )
    assert h1 == h2
    assert len(h1) == 64


def test_explanation_hash_changes_when_adp_changes() -> None:
    league_id = uuid.UUID("11111111-1111-1111-1111-111111111111")
    player_id = uuid.UUID("22222222-2222-2222-2222-222222222222")

    h_original = explanation_input_hash(
        league_id=league_id,
        user_id=None,
        player_id=player_id,
        scenario_name="Default",
        keeper_cost_pick=30.0,
        adp_pick=20.0,
        keeper_score=12.5,
    )
    h_new_adp = explanation_input_hash(
        league_id=league_id,
        user_id=None,
        player_id=player_id,
        scenario_name="Default",
        keeper_cost_pick=30.0,
        adp_pick=10.0,
        keeper_score=12.5,
    )
    assert h_original != h_new_adp


def test_keeper_explanation_404_for_unknown_recommendation(client: TestClient) -> None:
    _create_admin_and_login(client)
    league_resp = client.post(
        "/api/leagues",
        json={"name": "404 League", "season_year": 2026},
    )
    assert league_resp.status_code == 201
    league_id = league_resp.json()["id"]
    fake_id = str(uuid.uuid4())

    get_response = client.get(
        f"/api/leagues/{league_id}/optimizer/results/{fake_id}/explanation"
    )
    assert get_response.status_code == 404

    post_response = client.post(
        f"/api/leagues/{league_id}/optimizer/results/{fake_id}/explanation",
        json={},
    )
    assert post_response.status_code == 404


def test_keeper_explanation_is_not_enabled_by_default() -> None:
    settings = _test_settings()
    assert not keeper_explanation_ai.is_enabled(settings)


def test_keeper_explanation_requires_api_key() -> None:
    settings = _test_settings(keeper_explanation_ai_enabled=True)
    assert not keeper_explanation_ai.is_enabled(settings)


def test_keeper_explanation_enabled_with_key() -> None:
    settings = _test_settings(
        keeper_explanation_ai_enabled=True,
        openai_api_key="sk-test-key",
    )
    assert keeper_explanation_ai.is_enabled(settings)


# Phase 5: Scenario Comparison Narratives
# ---------------------------------------------------------------------------


def _setup_scenario_league(client: TestClient) -> str:
    """Create a minimal league with one team and one eligible keeper, return league_id."""
    _create_admin_and_login(client)
    league_resp = client.post(
        "/api/leagues",
        json={"name": "Narrative League", "season_year": 2026, "draft_type": "snake"},
    )
    assert league_resp.status_code == 201
    league_id = league_resp.json()["id"]
    team_resp = client.post(
        f"/api/leagues/{league_id}/teams",
        json={"name": "Narrative Team", "draft_slot": 1},
    )
    assert team_resp.status_code == 201
    team_id = team_resp.json()["id"]

    with _session_from_client(client) as session:
        player = Player(full_name="Narrative WR", position="WR", nfl_team="KC")
        session.add(player)
        session.commit()
        snapshot = ADPSnapshot(
            league_id=uuid.UUID(league_id),
            season_year=2026,
            name="Narrative ADP",
            source="test",
            format_type="ppr",
            snapshot_date=date(2026, 5, 1),
        )
        session.add(snapshot)
        session.commit()
        session.add(
            ADPEntry(
                snapshot_id=snapshot.id,
                player_id=player.id,
                position="WR",
                adp_pick=18.0,
            )
        )
        session.add(
            DraftPick(
                league_id=uuid.UUID(league_id),
                team_id=uuid.UUID(team_id),
                player_id=player.id,
                season_year=2026,
                round=3,
                overall_pick=30,
                position="WR",
                nfl_team="KC",
            )
        )
        session.add(
            FinalRosterEntry(
                league_id=uuid.UUID(league_id),
                team_id=uuid.UUID(team_id),
                player_id=player.id,
                season_year=2026,
                position="WR",
                nfl_team="KC",
            )
        )
        session.commit()

    run_resp = client.post(f"/api/leagues/{league_id}/optimizer/run", json={})
    assert run_resp.status_code == 200
    return league_id


def test_scenario_narrative_get_returns_null_when_not_generated(client: TestClient) -> None:
    league_id = _setup_scenario_league(client)

    response = client.get(f"/api/leagues/{league_id}/optimizer/scenarios/narrative")
    assert response.status_code == 200
    assert response.json()["narrative"] is None


def test_scenario_narrative_post_returns_503_when_ai_disabled(client: TestClient) -> None:
    league_id = _setup_scenario_league(client)

    response = client.post(
        f"/api/leagues/{league_id}/optimizer/scenarios/narrative",
        json={},
    )
    assert response.status_code == 503


def test_scenario_narrative_generates_and_caches(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    league_id = _setup_scenario_league(client)

    monkeypatch.setattr(scenario_narrative_ai, "is_enabled", lambda settings: True)
    call_count = 0

    def fake_generate(**_kwargs: object) -> ScenarioNarrativeResult:
        nonlocal call_count
        call_count += 1
        return ScenarioNarrativeResult(
            summary="Balanced offers the best tradeoff between value and picks.",
            best_fit="Balanced",
            tradeoffs=[
                {"scenario": "Pure Value", "benefit": "Max keepers.", "cost": "Loses 5 picks."}
            ],
            decision_notes=["Consider your draft position."],
        )

    monkeypatch.setattr(scenario_narrative_ai, "generate_scenario_narrative", fake_generate)

    first_response = client.post(
        f"/api/leagues/{league_id}/optimizer/scenarios/narrative",
        json={},
    )
    assert first_response.status_code == 200
    narrative = first_response.json()["narrative"]
    assert narrative["best_fit"] == "Balanced"
    assert narrative["summary"] == "Balanced offers the best tradeoff between value and picks."
    assert len(narrative["tradeoffs"]) == 1
    assert narrative["decision_notes"] == ["Consider your draft position."]

    second_response = client.post(
        f"/api/leagues/{league_id}/optimizer/scenarios/narrative",
        json={},
    )
    assert second_response.status_code == 200
    assert second_response.json()["narrative"]["best_fit"] == "Balanced"
    assert call_count == 1, "AI should not be called again for a cached narrative"


def test_scenario_narrative_appears_in_scenarios_response_after_generation(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    league_id = _setup_scenario_league(client)

    scenarios_before = client.post(
        f"/api/leagues/{league_id}/optimizer/scenarios",
        json={"persist": False},
    )
    assert scenarios_before.status_code == 200
    assert scenarios_before.json()["narrative"] is None

    monkeypatch.setattr(scenario_narrative_ai, "is_enabled", lambda settings: True)
    monkeypatch.setattr(
        scenario_narrative_ai,
        "generate_scenario_narrative",
        lambda **_kwargs: ScenarioNarrativeResult(
            summary="Win Now maximizes immediate upside.",
            best_fit="Win Now",
            tradeoffs=[],
            decision_notes=[],
        ),
    )
    gen_resp = client.post(
        f"/api/leagues/{league_id}/optimizer/scenarios/narrative",
        json={},
    )
    assert gen_resp.status_code == 200

    scenarios_after = client.post(
        f"/api/leagues/{league_id}/optimizer/scenarios",
        json={"persist": False},
    )
    assert scenarios_after.status_code == 200
    assert scenarios_after.json()["narrative"] is not None
    assert scenarios_after.json()["narrative"]["best_fit"] == "Win Now"


def test_narrative_input_hash_is_deterministic() -> None:
    league_id = uuid.UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
    summaries = [
        {"scenario_name": "Balanced", "total_keeper_score": 15.5, "team_count": 10, "keeper_count": 20},
        {"scenario_name": "Pure Value", "total_keeper_score": 18.0, "team_count": 10, "keeper_count": 25},
    ]
    h1 = narrative_input_hash(league_id=league_id, user_id=None, scenario_summaries=summaries)
    h2 = narrative_input_hash(league_id=league_id, user_id=None, scenario_summaries=summaries)
    assert h1 == h2
    assert len(h1) == 64


def test_narrative_hash_changes_when_scores_change() -> None:
    league_id = uuid.UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
    summaries_original = [
        {"scenario_name": "Balanced", "total_keeper_score": 15.5, "team_count": 10, "keeper_count": 20},
    ]
    summaries_changed = [
        {"scenario_name": "Balanced", "total_keeper_score": 20.0, "team_count": 10, "keeper_count": 20},
    ]
    h_original = narrative_input_hash(
        league_id=league_id, user_id=None, scenario_summaries=summaries_original
    )
    h_changed = narrative_input_hash(
        league_id=league_id, user_id=None, scenario_summaries=summaries_changed
    )
    assert h_original != h_changed


def test_scenario_narrative_is_not_enabled_by_default() -> None:
    settings = _test_settings()
    assert not scenario_narrative_ai.is_enabled(settings)


def test_scenario_narrative_requires_api_key() -> None:
    settings = _test_settings(scenario_narrative_ai_enabled=True)
    assert not scenario_narrative_ai.is_enabled(settings)


def test_scenario_narrative_enabled_with_key() -> None:
    settings = _test_settings(
        scenario_narrative_ai_enabled=True,
        openai_api_key="sk-test-key",
    )
    assert scenario_narrative_ai.is_enabled(settings)
