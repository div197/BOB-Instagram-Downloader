"""L2 — GraphQL persisted query (doc_id auto-discovery + health).

yt-dlp HEAD (2026-11-04): doc_id=27130156389949648,
friendly-name PolarisLoggedOutDesktopWWWPostRootContentQuery,
variables {media_id} → data.xig_polaris_media.
Older generation used {shortcode} (ahmedrangel doc_id=10015901848480474).

doc_id rotates every 2–4 weeks — never trust a blog value without probing.
"""
from __future__ import annotations

import json

from .errors import ExtractionFailedError
from .fetcher import Fetcher
from .l1 import parse_media

APP_ID = "936619743392459"
ASBD_ID = "359341"
FRIENDLY_NAME = "PolarisLoggedOutDesktopWWWPostRootContentQuery"

# Candidate doc_ids ordered by recency (yt-dlp HEAD first). Health check filters dead ones.
DOC_ID_CANDIDATES = [
    "27130156389949648",  # yt-dlp HEAD 2026-11-04 (media_id)
    "10015901848480474",  # ahmedrangel 2025 (shortcode) — legacy, probe-only
]


def _id_to_pk(shortcode: str) -> str:
    """shortcode → numeric media id (base64url decode, yt-dlp _id_to_pk inverse)."""
    table = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"
    val = 0
    for ch in shortcode:
        idx = table.find(ch)
        if idx < 0:
            break
        val = val * 64 + idx
    return str(val) if val else shortcode


def l2_fetch(fetcher: Fetcher, shortcode: str, doc_id: str, var_key: str = "media_id") -> dict | None:
    media_id = _id_to_pk(shortcode)
    variables = {var_key: media_id if var_key == "media_id" else shortcode}
    headers = {
        "X-IG-App-ID": APP_ID,
        "X-ASBD-ID": ASBD_ID,
        "X-IG-WWW-Claim": "0",
        "X-FB-Friendly-Name": FRIENDLY_NAME,
        "X-Requested-With": "XMLHttpRequest",
        "Origin": "https://www.instagram.com",
        "Referer": f"https://www.instagram.com/p/{shortcode}/",
        "Content-Type": "application/x-www-form-urlencoded",
    }
    resp = fetcher.post(
        "https://www.instagram.com/api/graphql",
        data={
            "fb_api_caller_class": "RelayModern",
            "fb_api_req_friendly_name": FRIENDLY_NAME,
            "server_timestamps": "true",
            "variables": json.dumps(variables, separators=(",", ":")),
            "doc_id": doc_id,
        },
        headers=headers,
    )
    if resp.status_code != 200:
        return None
    try:
        data = resp.json()
    except Exception:
        return None
    media = (data.get("data") or {}).get("xdt_shortcode_media") or (
        data.get("data") or {}
    ).get("xig_polaris_media")
    if not media:
        return None
    out = parse_media(media)
    out["layer"] = f"L2(doc_id={doc_id})"
    return out


def l2_extract(fetcher: Fetcher, shortcode: str) -> dict:
    for doc_id in DOC_ID_CANDIDATES:
        # yt-dlp HEAD uses media_id; try legacy shortcode form for the legacy id
        var_key = "media_id" if doc_id == DOC_ID_CANDIDATES[0] else "shortcode"
        try:
            result = l2_fetch(fetcher, shortcode, doc_id, var_key=var_key)
        except Exception:
            continue
        if result:
            return result
    raise ExtractionFailedError("L2 GraphQL: all doc_id candidates returned no media (rotation likely).")
