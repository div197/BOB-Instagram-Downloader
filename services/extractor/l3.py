"""L3 — yt-dlp engine (Reelkeep pattern).

extract_info(download=False) → format pick → return CDN URLs.
Byte download + ffmpeg merge + FFprobe verify happen at the edge/R2,
not inside the metadata call (Reelkeep worker.py spec).
"""
from __future__ import annotations

from .errors import ExtractionFailedError, RateLimitedError, SourceTimeoutError


def select_formats(info: dict) -> tuple[dict, dict | None]:
    """Combined MP4 preferred; else AVC ≤1080p video + best audio (Reelkeep spec)."""
    formats = info.get("formats") or []
    if not formats:
        # single-format fallback (video_url)
        url = info.get("url") or ""
        if url:
            return {"url": url, "ext": "mp4", "vcodec": "avc1", "acodec": "mp4a", "height": info.get("height")}, None
        raise ExtractionFailedError("L3 yt-dlp: no formats returned.")

    def _height(f):
        return f.get("height") or 0

    combined = [
        f for f in formats
        if f.get("vcodec") not in (None, "none")
        and f.get("acodec") not in (None, "none")
        and f.get("ext") in ("mp4", None)
    ]
    videos = [
        f for f in formats
        if f.get("vcodec") not in (None, "none") and f.get("url")
    ]
    audios = [
        f for f in formats
        if f.get("vcodec") in ("none", None) and f.get("acodec") not in ("none", None)
    ]

    if combined:
        chosen = max(combined, key=lambda f: (_height(f), f.get("tbr") or 0))
    elif videos:
        capped = [f for f in videos if 0 < _height(f) <= 1080] or videos
        chosen = max(
            capped,
            key=lambda f: (
                str(f.get("vcodec") or "").startswith(("avc", "h264")),
                _height(f),
                f.get("tbr") or 0,
            ),
        )
    else:
        raise ExtractionFailedError("L3 yt-dlp: no supported direct MP4 video format.")
    audio = max(audios, key=lambda f: f.get("tbr") or 0) if audios else None
    return chosen, audio


def _map_error(detail: str) -> Exception:
    low = detail.lower()
    if "429" in detail or "rate-limit" in low or "rate limit" in low:
        return RateLimitedError(detail, retry_after=60)
    if "timed out" in low or "timeout" in low:
        return SourceTimeoutError(detail)
    return ExtractionFailedError(detail[-1800:])


def l3_extract(shortcode: str) -> dict:
    """Meta-only extraction via yt-dlp library (anonymous, Instagram only)."""
    try:
        import yt_dlp
    except ImportError as e:
        raise ExtractionFailedError("L3 yt-dlp not installed (pip install yt-dlp).") from e

    url = f"https://www.instagram.com/reel/{shortcode}/"
    options = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "noplaylist": True,
        "socket_timeout": 10,
        "retries": 0,
        "extractor_retries": 0,
        "cachedir": False,
        "usenetrc": False,
        "allowed_extractors": ["Instagram"],
        "playlistend": 1,
        "ignoreerrors": False,
        "geo_bypass": False,
    }
    try:
        with yt_dlp.YoutubeDL(options) as ydl:
            info = ydl.extract_info(url, download=False)
    except yt_dlp.utils.DownloadError as e:
        raise _map_error(str(e)) from e

    if not info or info.get("_type") in ("playlist", "multi_video"):
        raise ExtractionFailedError("L3 yt-dlp: only one video per link supported (carousel via L1).")

    chosen, audio = select_formats(info)
    media = {
        "thumbnail": info.get("thumbnail") or "",
        "video_url": chosen.get("url") or "",
        "is_video": True,
        "width": chosen.get("width") or info.get("width"),
        "height": chosen.get("height") or info.get("height"),
        "audio_url": audio.get("url") if audio else "",
        "format": chosen.get("format_id") or "",
    }
    # carousel entries via yt-dlp → playlist entries
    entries = info.get("entries") or []
    medias = [media]
    for e in entries:
        if isinstance(e, dict) and (e.get("url") or e.get("thumbnail")):
            medias.append(
                {
                    "thumbnail": e.get("thumbnail") or "",
                    "video_url": e.get("url") or "",
                    "is_video": bool(e.get("url")),
                }
            )
    return {
        "shortcode": shortcode,
        "pk": str(info.get("id") or ""),
        "type": "reel",
        "product_type": "",
        "caption": (info.get("description") or "")[:2000],
        "like_count": int(info.get("like_count") or 0),
        "comment_count": int(info.get("comment_count") or 0),
        "taken_at": int(info.get("timestamp") or 0),
        "owner": info.get("uploader") or info.get("channel") or "",
        "media": medias,
        "video_dash_manifest": "",
        "layer": "L3(yt-dlp)",
    }
