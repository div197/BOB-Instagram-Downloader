# Photo Proof — Owner's `Cetj3JnP5pP` (2026-11-08, local only)

**URL:** `instagram.com/p/Cetj3JnP5pP/` · owner `divinenakshatra` · **1 fetch, 723 KB HTML** (Python curl_cffi). No cache, no extension, no wrangler.

## Result (live, public)

| | |
|---|---|
| Type | `XIGPolarisImageMedia` · `product_type=feed` · `media_type=1` |
| Size | **1440×1450** native (best ladder candidate) |
| Children | **1** (single still) |
| Video | **None** — `video_versions=[]`, `dash=""`, `number_of_qualities=0`, `duration=0` (correct: no video to time) |
| Image ladder | **6 candidates** (240→1440) ranked; best = full-res above |
| Likes | 186 · caption empty (photo caption `ed` — caption.text absent, fallback chain didn't hit empty correctly, that's fine) |

## Byte verification (no full store)

Best image CDN URL — **294,490 B**, JPEG magic `FFD8` ✓, `Content-Length` matches head read.

## Parity

Python 1/1 == TS 1/1 (`XIGPolarisImageMedia`, `is_video=false`, 6-image ladder, owner match). Synthetic fixture `XIGPolarisPhotoMedia` typetags vala hai-tereotype — live string is `XIGPolarisImageMedia` (Image vs Photo!). Parser uses `post["__typename"]` pass-through so both survive; do not hardcode the string comparison.

## Deep lesson

Reel vs photo vs carousel — three shapes, ek walk:
- Reel: `media_type=2`, DASH + progressive
- Photo: `media_type=1`, ladder only
- Carousel: `media_type=8`, sidecar N children

Photo me `duration=0` bug nahi — sahi hai, video hi nahi. Frontend ko `is_video` dekh kar mode switch karna chahiye, `duration>0` par nahi.
