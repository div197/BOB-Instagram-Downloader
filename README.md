# BOB Instagram Downloader

**BOB = Break Ordinary Boundaries**

A deep, ultra-scalable, edge-first system to download **public** Instagram posts, reels, IGTV, and carousels — **Cloudflare Pages static + user-IP bookmarklet (no Worker)**, **no cache**, **no extension**, **no wrangler locally**.

> Deep reverse engineering of `xig_polaris_media` (strict + deep-walk parser, photo/carousel/reel shapes, 13/13 tests) lives in **[docs/REVERSE-ENGINEERING-DEEP.md](docs/REVERSE-ENGINEERING-DEEP.md)**. Read §1–§3 before changing the parser.
> Final truth (teeno khushka kaun): **[docs/CANONICAL.md](docs/CANONICAL.md)**.

## Architecture (final)

```text
apps/web (Vite → Cloudflare Pages, static ∞ free)
```

- **Parser core:** `packages/extractor` (TS, zero deps) — strict `data-sjs` walk **+ recursive signature fallback** (survives Relay module rotation).
- **Dev harness:** `services/extractor` (Python, `curl_cffi`) — same shape, proves parser on live HTML. Not deployed.
- **Public-only.** Stories rejected (login-gated upstream). Private/long-ID → `PRIVATE`. 429 → `Retry-After` honored. No cookies, no login, no private bypass.

## Quick start (local, no wrangler)

```bash
# 1) Python harness tests
.venv/bin/python -m pytest tests/ -q            # 8 passed
# 2) TS parser tests
./node_modules/.bin/tsc -p packages/extractor/tsconfig.json
node --test packages/extractor/test/*.test.mjs  # 5 passed
# 3) Web build (Pages preview)
cd apps/web && ../../node_modules/.bin/vite build && ../../node_modules/.bin/vite preview
```


## Push to Div197 (when ready)

```bash
git remote add origin https://github.com/Div197/BOB-Instagram-Downloader.git
git push -u origin main
```

## Principles

- Public-only. Never ask for an Instagram login.
- Lossless delivery (progressive 720p + DASH ladder; no re-encode).
- No cache stored, no video bytes hosted by BOB — CDN links pass through.
- Freemium-first if monetized (AdSense is high-risk for downloaders — Publisher Policies).

## Live URL
- GitHub: https://github.com/div197/BOB-Instagram-Downloader
- Cloudflare Pages: (dashboard me connect karke `apps/web` build karo — Build: `cd apps/web && vite build`, Output: `apps/web/dist`)
