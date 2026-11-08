# LIVE PROOF — Owner's Reel DfcUpmgsQZ6 (2026-11-08)

**Method:** user's own reel, fetched live with the BOB kernel (curl_cffi, public-only, no cookies). Evidence, not claims.

## Result (one fetch, 0.9s)

| Field | Value |
|---|---|
| URL | `instagram.com/reel/DfcUpmgsQZ6/` (tracking params stripped → `DfcUpmgsQZ6`) |
| Layer | **L1 (inline JSON, data-sjs → xig_polaris_media)** |
| Response | 200 · 819 KB HTML · 1 GET · ~0.9s · no browser, no yt-dlp, no cookies |
| Owner | `kailishnirmal` |
| Caption | "Happy Diwali 🪔 #happydiwali #diwali #diwali2026" |
| Likes / comments | 180,834 / 305 (live-moving) |
| Size | 1080×1920 (9:16 vertical) |
| Duration | 69.33s (parsed from DASH `mediaPresentationDuration`, zero extra fetch) |
| Progressive | **720p MP4** (`video_versions`, 3 ranked candidates) |
| DASH | 9-quality manifest (240p VP9 → **1080p HFR**) + separate AAC audio adaptation set |
| Thumbnails | 6 ranked image candidates (1080px first) |

## Byte verification

- Progressive MP4 downloaded: **8.41 MiB in 1.0s**, `ftyp` header verified.
- FFprobe: `h264 720×1280, 69.33s + aac 69.40s` — exact match to parsed metadata.
- CDN expiry (`oe`): **34.9 hours** on the video URL (matches the 460k-link research median of ~34h). Cache TTL = min(6h, time-to-`oe`) → stale URLs never serve.

## Resource ledger (bare minimum)

| Operation | Cost |
|---|---|
| L1 extraction | **1 HTTPS GET** (819 KB), ~25 MB RSS, 0 subprocesses, 0 browser |
| Cache hit | **0 network, 0.001s**, SQLite lookup |
| L3 fallback (yt-dlp) | 2.9s, richer network cost — proven as fallback, **not needed when L1 succeeds** |
| Byte delivery | direct IG CDN 302 (zero BOB egress) |

L1 beats L3 on **both** axes that matter: 0.9s vs 2.9s, and richer output (DASH 9-quality + image ladder + exact owner/caption) vs L3's single format pick. L3 remains as the honest fallback if `data-sjs` ever gates.

## Scale proof sketch

- 1 GET/reel uncached; cache hit rate target 30–50% → effective GETs/day = 0.5–0.7 × requests.
- Single residential IP ≈ 200 req/hr ceiling (research). At 0.6 effective ratio, 1 IP supports ~8k extractions/day uncached. IPv6 /64 rotation lifts this linearly with zero cost.
- Hourly synthetic probe (3 pinned reels) catches `doc_id`/parser drift before users do.

## What this proves (and doesn't)

- **Proves:** public reels extract anonymously today, with highest quality (720p progressive + 1080p DASH), in under a second, with one fetch.
- **Does not prove:** permanent immunity — Instagram rotates `doc_id` every 2–4 weeks and can gate `data-sjs` (that's why L2/L3/L4 exist). The 8-test suite locks the parser; the health probe alerts on drift.

Reproduce:

```bash
.venv/bin/python -m services.extractor.cli "https://www.instagram.com/reel/DfcUpmgsQZ6/" --preview
```
