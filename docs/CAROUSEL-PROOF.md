# Carousel Proof — Owner's `Bs--NpcjJ2p` (2026-11-08, local only)

**URL:** `instagram.com/p/Bs--NpcjJ2p/` · owner `divinenakshatra` · **1 fetch, 1.1s, 692 KB HTML** (Python curl_cffi). No cache, no extension, no wrangler.

## Result (live, public)

| | |
|---|---|
| Type | `XIGPolarisCarouselMedia` · `product_type=carousel_container` |
| Children | **8 total → 5 photos + 3 videos** (order preserved) |
| Photo child | `media_type=1`, 1080×1080, 6-image ladder, JPEG magic `FFD8` ✓ (child1: 92,159 B) |
| Video child | `media_type=2`, 640×640, 3 `video_versions` + poster JPEG ✓ (child5: **10,642,561 B**, `ftyp` ✓) |
| Caption | `#gentinghighland #firstworldhotel #klcctower` · 122 likes, 0 comments (2019 post, `taken_at=1548261248`) |

## Byte verification (no full download stored)

- Child1 poster: 64 KB head read, JPEG `FFD8` ✓
- Child5 best video: 10.6 MB total, `ftyp` ✓
- Child5 poster: JPEG ✓

## Parity

Python 8/8 == TS 8/8 (per-child `is_video`, `media_type`, ladder counts identical). Synthetic fixtures in `tests/fixture.py` / `packages/extractor/test/fixture.mjs` already cover this shape; live HTML confirms **no new field** was needed — `carousel_media[]` + per-item `image_versions2`/`video_versions` is the whole surface.

## Deep lesson

Carousel is **not** "one video with a playlist". It is a sidecar of independently-typed children (`1`/`2`). n=8 breaks naive "first media = only media" parsers — BOB expands all sidecars (Python + TS + Worker share the same `parseMedia`). DASH per child (`video_dash_manifest` on child node, not parent) is why parent `duration=0` — correct, don't sum DASH across children.
