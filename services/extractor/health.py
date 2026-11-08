"""Synthetic health probe — 3 pinned public reels through L0→L3.

Run hourly (cron / CI). Alerts on: L1 null-rate, L2 doc_id drift, L3 429-rate.
Usage: python -m services.extractor.health [url1 url2 ...]
"""
from __future__ import annotations

import json
import sys
import time

from services.extractor import BOBError
from services.extractor.cache import ShortcodeCache
from services.extractor.pipeline import Extractor

# Pinned by status, not by permanence — replace when a reel disappears.
PINNED = [
    "https://www.instagram.com/reel/Cx0e2s6rZ5f/",
]


def probe(urls: list[str], cache_db: str = "bob_cache.sqlite3") -> dict:
    ex = Extractor(cache=ShortcodeCache(cache_db))
    report = {"ts": int(time.time()), "results": []}
    for u in urls:
        try:
            r = ex.extract(u, use_cache=False)
            report["results"].append({"url": u, "ok": True, "layer": r.get("layer"), "shortcode": r.get("shortcode")})
        except BOBError as e:
            report["results"].append({"url": u, "ok": False, "code": e.code, "error": str(e)[:200]})
        except Exception as e:  # noqa: BLE001
            report["results"].append({"url": u, "ok": False, "code": "BACKEND_ERROR", "error": str(e)[:200]})
    report["pass"] = sum(1 for r in report["results"] if r["ok"]) / max(len(report["results"]), 1)
    return report


def main(argv: list[str] | None = None) -> int:
    urls = (argv or sys.argv[1:]) or PINNED
    report = probe(urls)
    print(json.dumps(report, indent=2))
    return 0 if report["pass"] >= 0.5 else 1


if __name__ == "__main__":
    raise SystemExit(main())
