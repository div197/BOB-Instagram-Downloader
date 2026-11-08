# Deep Reverse Engineering — `xig_polaris_media` (2026-11-08)

Why this file exists: every parser break in the wild came from **Instagram rotating Relay module order** (ScrapFly: every 2–4 weeks). This document locks the surviving surface so the parser never dies silently.

## 1. Raw Payload Shape (live HTML, owner reel `DfcUpmgsQZ6`, 820 KB)

```text
<script data-sjs>  (~30–40 blobs per page, 30–200 KB each)
  payload["require"][0][3][0]["__bbox"]["require"]  → modules[]
    module[3]                                       → entries[]
      entry["__bbox"]["result"]["data"]["xig_polaris_media"]  ← TARGET
Logged-out posts nest:  media = xig_polaris_media.if_not_gated_logged_out || xig_polaris_media
```

**Fragility:** if Relay renames the module slot (the `[0][3][0]` index), strict walk returns `null` → user sees `EXTRACTION_FAILED`. **Fix (this commit):** 2-tier walk — strict (fast) → **recursive signature search** (finds `xig_polaris_media` at any depth, max 40, works when modules shuffle). Both Python `l1.py` and TS `packages/extractor` implement it identically (parity lock).

## 2. `xig_polaris_media` Field Matrix (owner reel + fixtures)

| Field | Type | Notes |
|---|---|---|
| `__typename` | str | `XIGPolarisVideoMedia` (reel) · `XIGPolarisPhotoMedia` (photo) · `XIGPolarisCarouselMedia` (carousel) |
| `__isXIGPolarisMedia` | str | Mirror of `__typename` (present in 2026 Polaris) |
| `code` / `shortcode` | str | Stable ID (BOB stores only this) |
| `pk` / `id` | str | `id` = `POLARIS_{pk}` — prefer `pk` |
| `taken_at` / `taken_at_timestamp` | int | Unix seconds (dual-gen) |
| `user.username` (or `owner.username`) | str | Both gen tested |
| `caption.text` | str | + `edge_media_to_caption.edges[0].node.text` fallback (GraphQL older gen) |
| `accessibility_caption` | str | Alt text, e.g. *"Video by Kailish on Nov 07..."* |
| `like_count` / `comment_count` | int | Prefer flat; fallback `edge_media_like_request.count` / `comments.count` (0-safe: `!= null`, not `||`) |
| `media_type` | int | **1 = photo, 2 = video, 8 = carousel** — decides UI mode |
| `product_type` | str | `clips` (reel), `carousel_container`, `igtv`, `feed` (photo) |
| `original_width/height` or `dimensions` | int | Native size for honest ladder copy |
| `display_uri` / `display_url` / `thumbnail_src` / `display_src` | str | Poster chain (in this order) |
| `video_url` | str | Single progressive MP4 (often `720p` baseline) |
| `video_versions[]` | list | `{type(101/102/103), url}` progressive candidates → **rank by area**, best first |
| `video_dash_manifest` | MPD XML | Multi-quality DASH (240p→1080p HFR). `mediaPresentationDuration="PT69.333336S"` is **only reliable duration** for reels |
| `image_versions2.candidates[]` | list | `{url,width,height}` → **rank by area**, top 6 (≤1080px max) |
| `is_dash_eligible` / `number_of_qualities` | bool/int | Quality-ladder hints (9 in owner reel) |
| `clips_metadata` / `video_duration` | dict/sec | Rarely populated — DASH is primary |
| `seo_canonical_url`, `location`, `usertags.in`, `ai_label_info`, `has_audio` | misc | Present/copied pass-through; not download-critical |
| `carousel_media[]` / `edge_sidecar_to_children.edges[].node` | list | Child nodes (mixed photo+video). Handle **both** gens; each child reuses the same item parser |

## 3. Shape Rules (proven by fixtures, 2026-11-08)

- **Photo (`media_type=1`):** `video_versions=[]`, `dash=""`, `number_of_qualities=0` → UI = image ladder only (thumbnail = best `display_uri`).
- **Video/Reel (`media_type=2`):** progressive `video_url` + DASH. Duration from **DASH** (`PT69.333336S` exact), not `video_duration`.
- **Carousel (`media_type=8`):** sidecar children parsed independently. Mixed child types preserve order. `is_video` per item (`media_type==2` || `video_url` non-empty).
- **Caption/owner/counts:** dual-gen fallbacks, 0-safe. `user` vs `owner` both win.
- **URL normalization:** strip `utm_*`, `psln`, `igshid`, trailing `/`; `/reels/`→`/reel/`; `m.instagram.com`→`www`. Stories rejected (`media_type` n/a, login-gated upstream).

## 4. Limits (honest)

- Edge (Workers) native fetch = datacenter ASN → IG may gate even with perfect parse. Respect `429` + `Retry-After`; cache-first was removed by owner choice (see `edge/orchestrator.ts`).
- DASH mux (1080p single file) needs ffmpeg outside edge — progressive 720p is the default single-file delivery (lossless stream-copy, never transcode).
- Parser drift between IG deploys → CI fixtures (`tests/fixture.py`, `packages/extractor/test/fixture.mjs`) run every push.

## 5. Tests Lock

Python `tests/test_extractor_offline.py` (8 tests): reel full-schema, photo, carousel, empty HTML, normalize, format picks.  
TS `packages/extractor/test/parser.test.mjs` (5 tests): same 3 shapes + walk-fallback shuffle. Both suites must stay green or the build is not "purna".
