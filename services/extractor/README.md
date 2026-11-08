# BOB Extractor Kernel

Roots of the upside-down tree (Gita 15.1). Public-only, no cookies, no login.

## Layers

| Layer | What | Cost |
|---|---|---|
| L0 | oEmbed preview (`graph.facebook.com .../instagram_oembed`) | 1 tiny GET, never blocks |
| L1 | `data-sjs` → `xig_polaris_media` (ScrapFly spec + yt-dlp walk) | **1 GET (~819 KB), 0.9s** |
| L2 | GraphQL persisted query (auto doc_id, yt-dlp HEAD `27130156389949648`) | 1 POST, on L1 miss only |
| L3 | yt-dlp `extract_info(download=False)` (Reelkeep format-pick) | 1 subprocess, on L1+L2 miss |
| L4 | Managed API hook (`MANAGED_API_URL` env, off by default) | vendor cost, budget-gated |

## Run

```bash
.venv/bin/pip install -r services/extractor/requirements.txt
.venv/bin/python -m services.extractor.cli "https://www.instagram.com/reel/DfcUpmgsQZ6/" --preview
.venv/bin/python -m pytest tests/ -q          # 8 offline tests, no network
.venv/bin/python -m services.extractor.health # synthetic probe
```

## Cache

SQLite (`bob_cache.sqlite3` default), keyed by `shortcode`, TTL = min(6h, `oe`-derived expiry).
Second request for the same shortcode: 0 network, ~1ms.

## Design laws

- Store the stable `shortcode`, never a media URL (video URLs expire ~34h).
- `curl_cffi` Chrome impersonation on every IG fetch — plain `requests` is throttled instantly.
- Honest typed errors (`INVALID_URL` / `PRIVATE` / `SOURCE_RATE_LIMITED` / `EXTRACTION_FAILED`) — never a 500 to users.
- Private/stories → immediate typed rejection without attempting.
