"""Shortcode cache — SQLite store with Instagram `oe`-aware expiry.

Never store media URLs forever: video ~34h, image ~4.4d (oe param).
KV in production; SQLite here for the kernel proof.
"""
from __future__ import annotations

import json
import pathlib
import sqlite3
import time


def _oe_expires_at(media: dict, ttl: int = 6 * 3600) -> int:
    """min(6h, oe-derived expiry) — never serve a stale CDN URL."""
    now = int(time.time())
    expiry = now + ttl
    for m in media.get("media") or []:
        for key in ("video_url", "thumbnail", "audio_url"):
            url = m.get(key) or ""
            if "oe=" in url:
                try:
                    hex_val = url.split("oe=", 1)[1].split("&", 1)[0]
                    expiry = min(expiry, int(hex_val, 16))
                except ValueError:
                    pass
    return expiry


class ShortcodeCache:
    def __init__(self, path: str | pathlib.Path = "bob_cache.sqlite3"):
        self.path = str(path)
        con = sqlite3.connect(self.path)
        con.execute(
            """CREATE TABLE IF NOT EXISTS media (
                shortcode TEXT PRIMARY KEY,
                type TEXT,
                payload TEXT,
                expires_at INTEGER,
                created_at INTEGER,
                hits INTEGER DEFAULT 0
            )"""
        )
        con.commit()
        con.close()

    def get(self, shortcode: str) -> dict | None:
        con = sqlite3.connect(self.path)
        con.row_factory = sqlite3.Row
        row = con.execute("SELECT * FROM media WHERE shortcode=?", (shortcode,)).fetchone()
        if not row:
            con.close()
            return None
        if row["expires_at"] <= int(time.time()):
            con.execute("DELETE FROM media WHERE shortcode=?", (shortcode,))
            con.commit()
            con.close()
            return None
        con.execute("UPDATE media SET hits=hits+1 WHERE shortcode=?", (shortcode,))
        con.commit()
        con.close()
        data = json.loads(row["payload"])
        data["_cache_hits"] = row["hits"] + 1
        data["_cached"] = True
        return data

    def put(self, shortcode: str, media: dict, ttl: int = 6 * 3600) -> None:
        expires = _oe_expires_at(media, ttl)
        now = int(time.time())
        con = sqlite3.connect(self.path)
        con.execute(
            "INSERT OR REPLACE INTO media(shortcode,type,payload,expires_at,created_at,hits) VALUES (?,?,?,?,?,0)",
            (shortcode, media.get("type", ""), json.dumps(media), expires, now),
        )
        con.commit()
        con.close()

    def clear(self) -> None:
        con = sqlite3.connect(self.path)
        con.execute("DELETE FROM media")
        con.commit()
        con.close()
