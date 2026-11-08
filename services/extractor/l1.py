"""L1 — Inline JSON (data-sjs → xig_polaris_media).

Spec ported from scrapfly/scrapfly-scrapers instagram-scraper
(_extract_xig_polaris_media) + yt-dlp's _SJS_RE walk (HEAD 2026-11-04).

Payload shape:
  <script data-sjs>
    payload["require"][0][3][0]["__bbox"]["require"] → modules
  each module[3] → entries → entry["__bbox"]["result"]["data"]["xig_polaris_media"]
Logged-out posts nest under if_not_gated_logged_out.
"""
from __future__ import annotations

import json
import re
from typing import Any

_DATA_SJS_RE = re.compile(r'<script[^>]*data-sjs[^>]*>(.*?)</script>', re.DOTALL)


def extract_xig_polaris_media(html: str) -> dict | None:
    for script in _DATA_SJS_RE.findall(html or ""):
        if "xig_polaris_media" not in script:
            continue
        try:
            payload = json.loads(script)
            modules = payload["require"][0][3][0]["__bbox"]["require"]
        except (KeyError, IndexError, TypeError, json.JSONDecodeError):
            continue
        for module in modules:
            if not isinstance(module, list) or len(module) <= 3:
                continue
            for entry in module[3]:
                if not isinstance(entry, dict):
                    continue
                media = (
                    entry.get("__bbox", {})
                    .get("result", {})
                    .get("data", {})
                    .get("xig_polaris_media")
                )
                if media:
                    return media
    return None


def _get(d: Any, *keys, default=None):
    cur = d
    for k in keys:
        if not isinstance(cur, dict):
            return default
        cur = cur.get(k)
        if cur is None:
            return default
    return cur


def _best_video_versions(post: dict) -> list[dict]:
    """video_versions[] (Polaris 2026) — progressive MP4s. Pick highest, return ranked."""
    out = []
    for v in post.get("video_versions") or []:
        if isinstance(v, dict) and v.get("url"):
            out.append(v)
    # rank by width*height (or type) descending
    def _area(v):
        return (v.get("width") or 0) * (v.get("height") or 0) or (v.get("type") or 0)
    return sorted(out, key=_area, reverse=True)


def _best_image_versions(post: dict) -> list[dict]:
    cands = (post.get("image_versions2") or {}).get("candidates") or []
    return sorted(cands, key=lambda c: (c.get("width") or 0) * (c.get("height") or 0), reverse=True)


def _media_item(m: dict) -> dict:
    """One sidecar/carousel item — dual-schema (ScrapFly + Polaris)."""
    thumb = m.get("display_url") or m.get("display_uri") or ""
    vurl = m.get("video_url") or ""
    if not vurl and m.get("video_versions"):
        best = _best_video_versions(m)
        vurl = best[0].get("url") if best else ""
    imgs = _best_image_versions(m)
    if imgs and not thumb:
        thumb = imgs[0].get("url") or ""
    return {
        "thumbnail": thumb,
        "video_url": vurl,
        "video_versions": _best_video_versions(m),
        "image_versions": imgs[:6],
        "is_video": bool(m.get("is_video") or vurl or m.get("media_type") == 2),
        "width": _get(m, "dimensions", "width") or m.get("original_width"),
        "height": _get(m, "dimensions", "height") or m.get("original_height"),
        "media_type": m.get("media_type"),
    }


def parse_media(raw: dict) -> dict:
    """Normalize xig_polaris_media (or its if_not_gated_logged_out child) to BOB shape."""
    post = raw.get("if_not_gated_logged_out") or raw
    caption = _get(post, "caption", "text", default="") or ""

    # Counts across generations (edge_media_* vs flat vs Polaris like_count)
    likes = (
        post.get("like_count")
        if post.get("like_count") is not None
        else _get(post, "edge_media_like_request", "count")
        or _get(post, "likes", "count")
        or 0
    )
    comments = (
        post.get("comment_count")
        if post.get("comment_count") is not None
        else _get(post, "comments", "count")
        or 0
    )

    media: list[dict] = []
    # Carousel / sidecar: carousel_media[] (ScrapFly) or edge_sidecar_to_children
    sidecar = post.get("carousel_media") or []
    if not sidecar:
        sidecar = _get(post, "edge_sidecar_to_children", "edges", default=[]) or []
        sidecar = [e.get("node") for e in sidecar if isinstance(e, dict)]
    for m in sidecar:
        if not isinstance(m, dict):
            continue
        media.append(_media_item(m))
    if not media:
        media.append(_media_item(post))

    dash = post.get("video_dash_manifest") or ""
    # Duration from DASH (Polaris reels: no video_duration field) — first-class, zero extra fetch
    duration = (post.get("clips_metadata") or {}).get("video_duration") or (post.get("video_duration") or 0)
    if not duration and dash:
        m = re.search(r'mediaPresentationDuration="PT([\d.]+)S"', dash)
        if m:
            duration = float(m.group(1))
    return {
        "shortcode": post.get("shortcode") or post.get("code") or "",
        "pk": str(post.get("pk") or post.get("id") or ""),
        "type": post.get("__typename") or ("carousel" if sidecar else "post"),
        "product_type": post.get("product_type") or "",
        "caption": caption,
        "like_count": int(likes or 0),
        "comment_count": int(comments or 0),
        "taken_at": post.get("taken_at_timestamp") or post.get("taken_at") or 0,
        "duration": duration,
        "number_of_qualities": post.get("number_of_qualities") or 0,
        "owner": (
            _get(post, "owner", "username", default="")
            or _get(post, "user", "username", default="")
        ),
        "media": media,
        "video_dash_manifest": dash,
        "is_dash_eligible": bool(post.get("is_dash_eligible")),
        "seo_canonical_url": post.get("seo_canonical_url") or "",
        "layer": "L1",
    }
