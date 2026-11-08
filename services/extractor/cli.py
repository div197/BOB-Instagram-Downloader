"""BOB extractor CLI — gentleman-grade output.

Usage:
  python -m services.extractor.cli <instagram-url> [--no-cache] [--preview]
Exit codes mirror the error taxonomy (0 ok, 400/403/429/504/502).
"""
from __future__ import annotations

import argparse
import json
import sys

from services.extractor import BOBError
from services.extractor.pipeline import Extractor


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="bob-extract", description="BOB public IG extractor (L0→L3)")
    ap.add_argument("url", help="Public Instagram post/reel URL")
    ap.add_argument("--no-cache", action="store_true", help="Bypass shortcode cache")
    ap.add_argument("--preview", action="store_true", help="Also show L0 oEmbed preview")
    ap.add_argument("--db", default="bob_cache.sqlite3", help="Cache DB path")
    args = ap.parse_args(argv)

    from services.extractor.cache import ShortcodeCache

    ex = Extractor(cache=ShortcodeCache(args.db))
    try:
        result = ex.extract(args.url, use_cache=not args.no_cache)
    except BOBError as e:
        print(json.dumps({"ok": False, "error": {"code": e.code, "message": str(e), "retry_after": e.retry_after}}), file=sys.stderr)
        print(f"Invalid or unsupported URL")  # keep stderr honest; JSON above is machine-readable
        return e.http if e.http else 502
    except Exception as e:  # noqa: BLE001
        print(json.dumps({"ok": False, "error": {"code": "BACKEND_ERROR", "message": f"Unexpected ({type(e).__name__})"}}), file=sys.stderr)
        return 502

    print(json.dumps({"ok": True, "media": dict(result)}, indent=2))
    if args.preview:
        from services.extractor.normalize import extract_shortcode

        print("L0 preview:", json.dumps(ex.l0_preview(extract_shortcode(args.url)), indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
