from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from email.utils import parsedate_to_datetime
from threading import Lock
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

from app.core.config import Settings


class NewsFeedError(Exception):
    """Raised when fantasy football news cannot be fetched."""


@dataclass
class NewsItem:
    headline: str
    link: str
    published_at: str
    source: str


@dataclass
class _NewsCache:
    fetched_at: datetime
    items: list[NewsItem]


_NEWS_CACHE: _NewsCache | None = None
_NEWS_CACHE_LOCK = Lock()
_NEWS_CACHE_TTL = timedelta(hours=24)


def fetch_fantasy_news(settings: Settings, limit: int = 8) -> list[NewsItem]:
    global _NEWS_CACHE

    with _NEWS_CACHE_LOCK:
        now = datetime.now(UTC)
        if _NEWS_CACHE and now - _NEWS_CACHE.fetched_at < _NEWS_CACHE_TTL:
            return _NEWS_CACHE.items[:limit]

        items = _load_google_news_rss(settings, limit=max(limit, 12))
        _NEWS_CACHE = _NewsCache(fetched_at=now, items=items)
        return items[:limit]


def _load_google_news_rss(settings: Settings, limit: int) -> list[NewsItem]:
    query = '("fantasy football" OR "fantasy football news" OR NFL fantasy)'
    request_url = (
        "https://news.google.com/rss/search?"
        + urllib.parse.urlencode(
            {
                "q": query,
                "hl": "en-US",
                "gl": "US",
                "ceid": "US:en",
            }
        )
    )
    request = urllib.request.Request(
        request_url,
        headers={
            "Accept": "application/rss+xml, application/xml;q=0.9, */*;q=0.5",
            "User-Agent": "keeper-optimizer-news-feed/0.1",
        },
        method="GET",
    )
    try:
        with urllib.request.urlopen(request, timeout=settings.adp_refresh_timeout_seconds) as response:
            payload = response.read()
    except urllib.error.HTTPError as exc:
        raise NewsFeedError(f"News feed request failed with status {exc.code}") from exc
    except urllib.error.URLError as exc:
        raise NewsFeedError("News feed request could not reach Google News") from exc

    try:
        root = ET.fromstring(payload)
    except ET.ParseError as exc:
        raise NewsFeedError("News feed response was not valid RSS") from exc

    items: list[NewsItem] = []
    for entry in root.findall("./channel/item"):
        headline = _entry_text(entry, "title")
        link = _entry_text(entry, "link")
        if not headline or not link:
            continue
        published_at = _published_iso(_entry_text(entry, "pubDate"))
        source = _entry_text(entry, "source") or _extract_source_from_title(headline)
        items.append(
            NewsItem(
                headline=_strip_source_suffix(headline),
                link=link,
                published_at=published_at,
                source=source,
            )
        )
        if len(items) >= limit:
            break

    if not items:
        raise NewsFeedError("News feed returned no usable headlines")
    return items


def _entry_text(entry: ET.Element, tag_name: str) -> str:
    element = entry.find(tag_name)
    if element is None or element.text is None:
        return ""
    return element.text.strip()


def _published_iso(value: str) -> str:
    if not value:
        return ""
    try:
        return parsedate_to_datetime(value).astimezone(UTC).isoformat()
    except (TypeError, ValueError):
        return value


def _extract_source_from_title(title: str) -> str:
    parts = title.rsplit(" - ", 1)
    return parts[1].strip() if len(parts) == 2 else "Google News"


def _strip_source_suffix(title: str) -> str:
    parts = title.rsplit(" - ", 1)
    return parts[0].strip() if len(parts) == 2 else title
