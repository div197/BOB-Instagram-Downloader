"""L0→L5 pipeline orchestrator.

L0 oEmbed preview (parallel, never blocks) → cache → L1 → L2 → L3 → L4 (opt-in).
First success wins; typed errors propagate honestly.
"""
from __future__ import annotations

import os

from .errors import ExtractionFailedError, PrivateError, RateLimitedError
from .fetcher import Fetcher
from .l1 import extract_xig_polaris_media, parse_media
from .l2 import l2_extract
from .l3 import l3_extract
from .normalize import extract_shortcode

L0_URL = "https://graph.facebook.com/v27.0/instagram_oembed"


class MediaResult(dict):
    """Normalized BOB media dict (shortcode, media[], caption, layer, ...)."""


class Extractor:
    def __init__(self, fetcher: Fetcher | None = None):
        self.fetcher = fetcher or Fetcher()

    # -- L0 preview (best-effort, never raises) --------------------------
    def l0_preview(self, shortcode: str) -> dict | None:
        try:
            resp = self.fetcher.get(
                f"{L0_URL}?url=https://www.instagram.com/p/{shortcode}/",
            )
            if resp.status_code != 200:
                return None
            data = resp.json()
            return {
                "thumbnail": data.get("thumbnail_url") or "",
                "author_name": data.get("author_name") or "",
                "embed_html": data.get("html") or "",
            }
        except Exception:
            return None

    # -- L1 ---------------------------------------------------------------
    def l1_extract(self, shortcode: str) -> dict:
        url = f"https://www.instagram.com/p/{shortcode}/"
        resp = self.fetcher.get(url)
        if resp.status_code == 429:
            raise RateLimitedError("Instagram rate-limited this egress IP.", retry_after=60)
        if resp.status_code in (401, 403, 404):
            raise PrivateError("Private, removed, or logged-out-gated content.")
        final = getattr(resp, "url", "") or ""
        if "/accounts/login" in final:
            raise RateLimitedError(
                "Instagram redirected to login (anonymous rate-limit exceeded).",
                retry_after=60,
            )
        media = extract_xig_polaris_media(resp.text)
        if not media:
            raise ExtractionFailedError("L1: data-sjs xig_polaris_media not found (page gated or parser drift).")
        post = media.get("if_not_gated_logged_out") or media
        if not (post.get("display_url") or post.get("display_uri") or post.get("video_url")):
            raise PrivateError("Private or gated content (empty media object).")
        return parse_media(media)

    # -- main entry -------------------------------------------------------
    def extract(self, raw_url: str) -> MediaResult:
        shortcode = extract_shortcode(raw_url)

        errors: list[str] = []
        for layer_name, fn in (
            ("L1", lambda: self.l1_extract(shortcode)),
            ("L2", lambda: l2_extract(self.fetcher, shortcode)),
            ("L3", lambda: l3_extract(shortcode)),
        ):
            try:
                result = fn()
            except (PrivateError, RateLimitedError):
                raise  # honest terminal signals — don't mask as generic failure
            except Exception as e:  # noqa: BLE001
                errors.append(f"{layer_name}: {type(e).__name__}: {e}")
                continue
            if result:
                result["shortcode"] = shortcode
                return MediaResult(result)

        # L4 managed fallback (opt-in, budget-gated)
        managed = self._l4_managed(shortcode)
        if managed:
            return MediaResult(managed)

        raise ExtractionFailedError(
            "All layers failed. " + " | ".join(errors) + " (try again; if public in incognito, an upstream change may be in flight)."
        )

    def _l4_managed(self, shortcode: str) -> dict | None:
        """Bright Data / Apify hook — enabled only via MANAGED_API_URL env.

        Wire the vendor's JSON into parse_media shape. Disabled by default.
        """
        base = os.environ.get("MANAGED_API_URL")
        if not base:
            return None
        try:
            resp = self.fetcher.get(f"{base}?url=https://www.instagram.com/p/{shortcode}/")
            if resp.status_code != 200:
                return None
            data = resp.json()
            data.setdefault("shortcode", shortcode)
            data["layer"] = "L4(managed)"
            return data
        except Exception:
            return None
