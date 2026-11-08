"""URL normalization → stable shortcode (the only ID BOB ever stores)."""
from __future__ import annotations

import re
import urllib.parse

from .errors import InvalidURLError

_SHORTCODE_RE = re.compile(
    r"instagram\.com/(?:[A-Za-z0-9_.]+/)?(p|reel|reels|tv|stories)/([A-Za-z0-9_\-]{8,})/?"
)


def normalize_url(raw: str) -> str:
    """Strip tracking params, unify hosts/paths. Raises InvalidURLError."""
    raw = (raw or "").strip()
    if not raw:
        raise InvalidURLError("Empty URL.")
    if "://" not in raw:
        raw = "https://" + raw
    u = urllib.parse.urlparse(raw)
    if u.hostname not in ("www.instagram.com", "instagram.com", "m.instagram.com"):
        raise InvalidURLError("Not an Instagram URL.")
    if not _SHORTCODE_RE.search(u.path + "/" if not u.path.endswith("/") else u.path):
        # try with path as-is
        if "/" not in u.path.strip("/") :
            raise InvalidURLError("Not an Instagram post/reel URL.")
    return f"https://www.instagram.com{u.path.rstrip('/')}/"


def extract_shortcode(raw: str) -> str:
    """Return the stable shortcode or raise InvalidURLError."""
    url = normalize_url(raw)
    m = _SHORTCODE_RE.search(url)
    if not m:
        raise InvalidURLError(
            "Only profile-prefixed post URLs are supported: /p/, /reel/, /reels/, /tv/."
        )
    kind, shortcode = m.group(1), m.group(2)
    if kind == "stories":
        raise InvalidURLError("Stories are not supported in MVP (24h expiry, login-gated upstream).")
    if len(shortcode) > 28:
        # Long IDs are private-only upstream (yt-dlp rule: shortcode + 28 chars)
        raise PrivateError("This content is only available to registered users who follow this account.")
    return shortcode


def canonical_post_url(shortcode: str, kind: str = "p") -> str:
    if kind in ("reel", "reels"):
        return f"https://www.instagram.com/reel/{shortcode}/"
    return f"https://www.instagram.com/p/{shortcode}/"
