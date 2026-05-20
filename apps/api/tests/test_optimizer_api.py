from collections.abc import Generator
import json

from fastapi.testclient import TestClient
import pytest
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel, Session, create_engine

import app.models  # noqa: F401
from app.core.config import Settings
from app.db.session import get_session
from app.main import create_app
from app.services.composite_adp import ProviderFetchResult


@pytest.fixture
def client() -> Generator[TestClient, None, None]:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)

    def override_get_session() -> Generator[Session, None, None]:
        with Session(engine) as session:
            yield session

    app = create_app()
    app.dependency_overrides[get_session] = override_get_session

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()


def _disable_draftsharks_browser_scraper(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "app.services.composite_adp._fetch_draftsharks_browser_rows",
        lambda settings: ProviderFetchResult(rows={}, error="browser scraper disabled in test"),
    )


def _create_admin_and_login(client: TestClient) -> dict[str, str]:
    response = client.post(
        "/api/admin/users",
        json={"email": "admin@example.com", "password": "secret", "role": "admin"},
    )
    assert response.status_code == 201
    login_response = client.post(
        "/api/auth/login",
        json={"email": "admin@example.com", "password": "secret"},
    )
    assert login_response.status_code == 200
    return response.json()


def test_auth_requires_login_after_user_exists(client: TestClient) -> None:
    _create_admin_and_login(client)
    client.post("/api/auth/logout")

    response = client.get("/api/leagues")

    assert response.status_code == 401


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

    assert league_create_response.status_code == 403
    assert draft_preview_response.status_code == 403
    assert draft_import_response.status_code == 403


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
        json={"email": "owner@example.com", "password": "secret", "role": "user"},
    )
    assert user_response.status_code == 201
    user_id = user_response.json()["id"]

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

    client.post("/api/auth/logout")
    login_response = client.post(
        "/api/auth/login",
        json={"email": "owner@example.com", "password": "secret"},
    )
    assert login_response.status_code == 200
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
    assert user_payload["password"] == "first-secret"
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
    assert reset_response.json()["password"] == "second-secret"

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
    assert "player,position,nfl_team,adp_pick,adp_round,source,snapshot_name,snapshot_date,format,source_note,draftsharks_superflex_adp,ffc_2qb_adp,ffc_ppr_adp,existing_adp,composite_method,review_flag" in adp_template_response.text
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
                """
            )
        if "sleeper.app" in url:
            return FakeResponse(
                '{"1":{"full_name":"Elite QB","position":"QB","team":"BAL"},"2":{"full_name":"Elite WR","position":"WR","team":"CIN"},"3":{"full_name":"League QB","position":"QB","team":"BUF"},"4":{"full_name":"League WR","position":"WR","team":"PHI"}}'
            )
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
    assert "Elite QB,QB,BAL,1.01,1,Composite Superflex ADP - Composite League" in template_response.text
    assert "Elite WR,WR,CIN,1.05,1,Composite Superflex ADP - Composite League" in template_response.text
    assert "League QB,QB,BUF,2.02,1,Composite Superflex ADP - Composite League" in template_response.text
    assert "League WR,WR,PHI,3.07,1,Composite Superflex ADP - Composite League" in template_response.text
    assert "DraftSharks Superflex ADP 1.01" in template_response.text
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
    assert "DraftSharks Superflex ADP 30.5" in template_response.text


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
    assert "Josh Allen,QB,BUF,1.01,1,Composite Superflex ADP - Scraped Composite League" in template_response.text
    assert "Lamar Jackson,QB,BAL,1.08,1,Composite Superflex ADP - Scraped Composite League" in template_response.text
    assert "Ja'Marr Chase,WR,CIN,1.1,1,Composite Superflex ADP - Scraped Composite League" in template_response.text
    assert "Bijan Robinson,RB,ATL,2.04,1,Composite Superflex ADP - Scraped Composite League" in template_response.text
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
    assert "DraftSharks public page is truncated" in response.json()["detail"]


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
        lambda: Settings(
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
        lambda: Settings(
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
        lambda: Settings(
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
                "<title>Backfield Battle Shifts Heading Into Camp - Another Source</title>"
                "<link>https://example.com/news-2</link>"
                "<pubDate>Fri, 16 May 2026 12:00:00 GMT</pubDate>"
                "<source>Another Source</source>"
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
    assert payload["rows"][0]["headline"] == "Fantasy Breakout Candidate Emerges"
    assert payload["rows"][0]["link"] == "https://example.com/news-1"
    assert payload["rows"][0]["source"] == "Example Source"
