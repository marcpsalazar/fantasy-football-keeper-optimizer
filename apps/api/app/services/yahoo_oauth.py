"""Yahoo Fantasy Sports OAuth 2.0 helpers.

Handles the authorization code flow, token exchange, token refresh, and
authenticated API fetches. All Yahoo API calls go through yahoo_get().

State format (no DB storage needed):
  base64url(user_id|timestamp|nonce) + "." + HMAC-SHA256(payload, SESSION_SECRET)
  Valid for 10 minutes.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlmodel import Session, select

from app.core.config import Settings
from app.models.oauth import YahooOAuthToken

_YAHOO_AUTH_URL = "https://api.login.yahoo.com/oauth2/request_auth"
_YAHOO_TOKEN_URL = "https://api.login.yahoo.com/oauth2/get_token"
_YAHOO_API_BASE = "https://fantasysports.yahooapis.com/fantasy/v2"
_YAHOO_SCOPE = "fspt-r"
_STATE_TTL_SECONDS = 600  # 10 minutes
_FETCH_TIMEOUT = 20


class YahooOAuthError(Exception):
    """Raised when OAuth exchange/refresh fails."""


class YahooAPIError(Exception):
    """Raised when a Yahoo Fantasy API call fails."""


class YahooTokenMissingError(Exception):
    """Raised when no stored token exists for the user."""


class YahooTokenExpiredError(Exception):
    """Raised when the stored refresh token is no longer valid."""


@dataclass
class TokenData:
    access_token: str
    refresh_token: str
    expires_at: datetime
    scope: str


# ---------------------------------------------------------------------------
# State generation and validation
# ---------------------------------------------------------------------------


def _sign_state(payload: str, secret: str) -> str:
    return hmac.new(secret.encode(), payload.encode(), hashlib.sha256).hexdigest()


def build_auth_url(user_id: uuid.UUID, settings: Settings) -> str:
    """Generate a Yahoo OAuth2 authorization URL with a signed state parameter."""
    nonce = secrets.token_urlsafe(16)
    payload = f"{user_id}|{int(time.time())}|{nonce}"
    raw_state = base64.urlsafe_b64encode(payload.encode()).decode()
    sig = _sign_state(raw_state, settings.session_secret)
    state = f"{raw_state}.{sig}"

    params = {
        "client_id": settings.yahoo_client_id,
        "redirect_uri": settings.yahoo_redirect_uri,
        "response_type": "code",
        "scope": _YAHOO_SCOPE,
        "state": state,
    }
    return f"{_YAHOO_AUTH_URL}?{urllib.parse.urlencode(params)}"


def validate_state(state: str, settings: Settings) -> uuid.UUID:
    """Validate the OAuth state and return the embedded user_id.

    Raises ValueError if the state is invalid or expired.
    """
    if "." not in state:
        raise ValueError("Malformed state parameter")
    raw_state, sig = state.rsplit(".", 1)
    expected_sig = _sign_state(raw_state, settings.session_secret)
    if not hmac.compare_digest(sig, expected_sig):
        raise ValueError("Invalid state signature")

    try:
        payload = base64.urlsafe_b64decode(raw_state.encode() + b"==").decode()
        user_id_str, timestamp_str, _nonce = payload.split("|", 2)
    except Exception:
        raise ValueError("Malformed state payload")

    if time.time() - int(timestamp_str) > _STATE_TTL_SECONDS:
        raise ValueError("State parameter expired")

    return uuid.UUID(user_id_str)


# ---------------------------------------------------------------------------
# Token exchange and refresh
# ---------------------------------------------------------------------------


def _basic_auth_header(settings: Settings) -> str:
    credentials = f"{settings.yahoo_client_id}:{settings.yahoo_client_secret}"
    return "Basic " + base64.b64encode(credentials.encode()).decode()


def _parse_token_response(body: bytes) -> TokenData:
    data = json.loads(body)
    if "error" in data:
        raise YahooOAuthError(f"Yahoo token error: {data.get('error_description', data['error'])}")
    expires_in = int(data.get("expires_in", 3600))
    return TokenData(
        access_token=data["access_token"],
        refresh_token=data["refresh_token"],
        expires_at=datetime.now(UTC) + timedelta(seconds=expires_in),
        scope=data.get("scope", _YAHOO_SCOPE),
    )


def exchange_code(code: str, settings: Settings) -> TokenData:
    """Exchange an authorization code for access + refresh tokens."""
    body = urllib.parse.urlencode(
        {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": settings.yahoo_redirect_uri,
        }
    ).encode()
    req = urllib.request.Request(
        _YAHOO_TOKEN_URL,
        data=body,
        headers={
            "Authorization": _basic_auth_header(settings),
            "Content-Type": "application/x-www-form-urlencoded",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=_FETCH_TIMEOUT) as resp:
            return _parse_token_response(resp.read())
    except urllib.error.HTTPError as exc:
        raw = exc.read()
        try:
            detail = json.loads(raw).get("error_description", exc.reason)
        except Exception:
            detail = exc.reason
        raise YahooOAuthError(f"Token exchange failed ({exc.code}): {detail}") from exc
    except Exception as exc:
        raise YahooOAuthError(f"Token exchange request failed: {exc}") from exc


def _refresh_access_token(stored: YahooOAuthToken, settings: Settings) -> TokenData:
    body = urllib.parse.urlencode(
        {
            "grant_type": "refresh_token",
            "refresh_token": stored.refresh_token,
        }
    ).encode()
    req = urllib.request.Request(
        _YAHOO_TOKEN_URL,
        data=body,
        headers={
            "Authorization": _basic_auth_header(settings),
            "Content-Type": "application/x-www-form-urlencoded",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=_FETCH_TIMEOUT) as resp:
            return _parse_token_response(resp.read())
    except urllib.error.HTTPError as exc:
        raw = exc.read()
        try:
            data = json.loads(raw)
            detail = data.get("error_description", exc.reason)
            # Yahoo returns 401 when the refresh token has been revoked/expired.
            if exc.code == 401 or data.get("error") == "invalid_grant":
                raise YahooTokenExpiredError(
                    "Yahoo refresh token is no longer valid. Please reconnect your Yahoo account."
                ) from exc
        except YahooTokenExpiredError:
            raise
        except Exception:
            detail = exc.reason
        raise YahooOAuthError(f"Token refresh failed ({exc.code}): {detail}") from exc
    except YahooTokenExpiredError:
        raise
    except Exception as exc:
        raise YahooOAuthError(f"Token refresh request failed: {exc}") from exc


# ---------------------------------------------------------------------------
# Token persistence
# ---------------------------------------------------------------------------


def upsert_token(session: Session, user_id: uuid.UUID, token: TokenData) -> YahooOAuthToken:
    """Store or replace the Yahoo OAuth token for a user (one row per user)."""
    stored = session.exec(
        select(YahooOAuthToken).where(YahooOAuthToken.user_id == user_id)
    ).first()
    if stored is None:
        stored = YahooOAuthToken(user_id=user_id)
    stored.access_token = token.access_token
    stored.refresh_token = token.refresh_token
    stored.expires_at = token.expires_at
    stored.scope = token.scope
    session.add(stored)
    session.commit()
    session.refresh(stored)
    return stored


def get_valid_access_token(session: Session, user_id: uuid.UUID, settings: Settings) -> str:
    """Return a non-expired access token, refreshing automatically if needed.

    Raises YahooTokenMissingError if no token record exists for the user.
    Raises YahooTokenExpiredError if the refresh token is invalid.
    """
    stored = session.exec(
        select(YahooOAuthToken).where(YahooOAuthToken.user_id == user_id)
    ).first()
    if stored is None:
        raise YahooTokenMissingError(
            "No Yahoo account connected. Please authorize via Connect Yahoo Account."
        )
    # Refresh if within 5 minutes of expiry.
    now = datetime.now(UTC)
    expires_at = stored.expires_at if stored.expires_at.tzinfo else stored.expires_at.replace(tzinfo=UTC)
    if expires_at - now < timedelta(minutes=5):
        refreshed = _refresh_access_token(stored, settings)
        upsert_token(session, user_id, refreshed)
        return refreshed.access_token
    return stored.access_token


def get_token_status(session: Session, user_id: uuid.UUID) -> dict:
    stored = session.exec(
        select(YahooOAuthToken).where(YahooOAuthToken.user_id == user_id)
    ).first()
    if stored is None:
        return {"connected": False, "expires_at": None}
    return {"connected": True, "expires_at": stored.expires_at.isoformat()}


# ---------------------------------------------------------------------------
# Authenticated Yahoo API fetch
# ---------------------------------------------------------------------------


def yahoo_get(path: str, access_token: str) -> dict:
    """Fetch a Yahoo Fantasy API resource as JSON.

    path should be relative to the API base, e.g. "league/nfl.l.12345".
    '?format=json' is appended automatically.
    """
    sep = "&" if "?" in path else "?"
    url = f"{_YAHOO_API_BASE}/{path}{sep}format=json"
    req = urllib.request.Request(
        url,
        headers={
            "Authorization": f"Bearer {access_token}",
            "User-Agent": "keeper-optimizer/1.0",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=_FETCH_TIMEOUT) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as exc:
        raw = exc.read()
        try:
            detail = json.loads(raw)
        except Exception:
            detail = exc.reason
        raise YahooAPIError(f"Yahoo API error {exc.code} for {path}: {detail}") from exc
    except urllib.error.URLError as exc:
        raise YahooAPIError(f"Yahoo API request failed for {path}: {exc.reason}") from exc
    except Exception as exc:
        raise YahooAPIError(f"Yahoo API unexpected error for {path}: {exc}") from exc
