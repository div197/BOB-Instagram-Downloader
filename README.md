# BOB — Instagram Downloader

**BOB = Break Ordinary Boundaries**

A deep, honest, **zero-server** system to download **public** Instagram reels, posts, carousels & photos in HD.
No cache. No extension. No Cloudflare Workers. **Your browser's IP is the game.** 

> Every claim below is live-verified on 6 real posts (4 reels, 1 carousel, 1 photo). If a number isn't in a proof doc, it's not in this README.

---

## 1. The Problem Everyone Else Has — And We Don't

Clone sites fail 3 ways (all of them solve the same wall — *datacenter IP blocks*):

| Clone failure | Why it happens | BOB's answer (engineered out) |
|---|---|---|
| 429 / "Rate limited" hourly | Server fetches from shared datacenter IPs | **BOB makes zero requests to Instagram.** Your browser already loaded the post; the bookmarklet reads what *your session* already fetched. |
| Cache = legal + storage + stale URLs | KV/D1 storage + 34h-expiry CDN URLs saved forever | **No cache store at all.** Stateless — parse happens on-device, bytes never hosted |
| Isolated "server" with proxy pool / Go farm | Residential proxies = hiding datacenter ASN | **No proxy pool, no spoofing.** One honest fetch per click, `Retry-After` honored, crawl closed |

The one wall you *cannot* code around (and shouldn't):

```
bob.example.com  ──fetch()──►  instagram.com
        ▲                         │
        └────── CORS block ───────┘
        Instagram sends NO Access-Control-Allow-Origin.
        Pure web JS can never read IG HTML — period (MDN, 2026-03-23).
```

That single fact decides the architecture: **code must run on `instagram.com` (bookmarklet) or on a file the user already saved.** Workers, Shiva, proxies — sab usi wall ke peeche hain.

---

## 2. Architecture — Two Lanes, Zero Server

                  ┌─────────────────────────────────────────────┐
                  │  Cloudflare Pages (static, ∞ free, $0)       │  ← this repo's `apps/web`
                  │  HTML/JS + SEO + AdSense-ready shell         │
                  └───────────────┬──────────────────────────────┘
                                  │ user interaction only (no IG fetch)
            ┌─────────────────────┴─────────────────────┐
            ▼                                           ▼
   Lane A: BOOKMARKLET (desktop, primary)      Lane B: SAVE-UPLOAD (mobile, fallback)
   runs on instagram.com origin                runs in BOB browser tab
   user's IP + logged-in session               FileReader parses saved .html offline
            │                                           │
        data-sjs already in DOM                same parser, zero network
            └───────────────┬───────────────────┘
                            ▼
              @bob/extractor (packages/extractor)
              strict walk → recursive signature fallback
                            │
        progressive 720p video_url / 1080px image ladder ──direct CDN download──► phone gallery ──► WhatsApp Status
```

**What lives where:**

| Piece | File | Language | Runs on |
|---|---|---|---|
| Bookmarklet | `apps/web/public/bookmarklet.js` | JS (readable MIT) | **instagram.com tab** (user IP) |
| Web (Pages) | `apps/web` (Vite) | TS → static | Cloudflare edge |
| Parser core | `packages/extractor/src/index.ts` | TS, zero deps | browser (upload lane) |
| Dev harness | `services/extractor` (Python + `curl_cffi`) | Python | your laptop only (never deployed) |
| Tests | `tests/` (Python) + `packages/extractor/test/` (Node) | — | CI / local |

**Removed by design (and honest in `docs/GENUINE-AUDIT.md`):** KV/D1/R2/Queues, extension/MV3, Go/Rust servers, Telegram bot, ytdlp/proxy pools. If you fork this, you fork today's repo, not the archive (`docs/archive` deleted 2026-11-08).

---

## 3. How It Works (user flows)

### Lane A — Bookmarklet (4 taps, desktop)

```text
1. Drag "⤓ BOB Downloader" (homepage) to your bookmarks bar
2. Open any public reel/post in your browser (Chrome, logged in or not)
3. Click the ⤓ BOB bookmark → runs ON the IG page
4. HD download starts (CDN file) → verify in Downloads → share to WhatsApp
```

The bookmarklet **reads the page Instagram already served you** — no new IG request, no cookie harvesting (`bookmarklet.io` security review passed: readable source, no closed bundle).

### Lane B — Save → Upload (3 taps, mobile)

```text
1. IG post ⋮ → "Save Page" (or long-press → Save)      → .html lands in Downloads
2. Open BOB site → "Upload saved Instagram page (.html)"
3. Parser runs locally (FileReader, zero network) → preview → Download HD → Share
```

### Lane C — Share Target (Android, PWA)

Install BOB as PWA → it appears in the Android share sheet → Instagram → ⤓ Share → BOB → auto-parse → download. (iOS has no share-target — Lane B covers it.)

---

## 4. Live Proofs — 6 Real Posts, Byte-Verified

All fetched live with public `data-sjs` (curl_cffi Chrome impersonation, 1 GET each, no cookies):

| Post | Type | Native | Best progressive | Verified |
|---|---|---|---|---|
| `DfcUpmgsQZ6` | Reel | 1080×1920 | 720p + DASH | `ftyp` · h264 720×1280 + AAC · 8.41 MiB · FFprobe |
| `DfdArgeTvfS` | Reel | 720×1280 | 720p | `ftyp` · 5.91 MiB |
| `Dfcqnq9C9IP` | Reel | **480×854** (low-res upload) | 480p | `ftyp` · 2.64 MiB · honest ladder (no fake upscale) |
| `Dfc5t9-gsct` | Reel | 1080×1920 | 720p prog + **1080p DASH** | `ftyp` · 0.41 MiB |
| `Bs--NpcjJ2p` | Carousel | **8 children (5 photo + 3 video)** | 1080×1080 photos · 640×640 videos | JPEG magic `FFD8` + `ftyp` per child, 10.6 MB video verified |
| `Cetj3JnP5pP` | Photo | **1440×1450** | 6-image ladder (no video) | JPEG `FFD8` · 294,490 B |

Detail: `docs/LIVE-PROOF.md` · `docs/BATCH-PROOF.md` · `docs/CAROUSEL-PROOF.md` · `docs/PHOTO-PROOF.md`

---

## 5. Deep Reverse Engineering — `xig_polaris_media`

Why this file exists: every parser break in the wild came from **Instagram rotating Relay module order** (ScrapFly: every 2–4 weeks). The parser is locked so it can never die silently.

### 5.1 Raw payload (live HTML, 820 KB, ~40 `data-sjs` blobs)

```text
<script data-sjs>
  payload["require"][0][3][0]["__bbox"]["require"]  → modules[]
    module[3]  → entries[]
      entry["__bbox"]["result"]["data"]["xig_polaris_media"]   ← TARGET
Logged-out posts: media = xig_polaris_media.if_not_gated_logged_out || xig_polaris_media
```

**Fragility + fix (this repo):** if Relay renames the `[0][3][0]` slot, strict walk dies. So **2-tier walk**: strict (fast) → **recursive signature search** (finds the key at any depth, max 40) — works when modules shuffle. Python and TS implement it identically.

### 5.2 Field matrix (proven across all 6 live posts)

| Field | Shape | Notes |
|---|---|---|
| `__typename` | `XIGPolarisVideoMedia` / `XIGPolarisImageMedia` / `XIGPolarisCarouselMedia` | **pass-through, never hardcode-compare** (Image vs Photo proved this) |
| `code` / `shortcode` / `pk` | stable ID | BOB stores only this — never media URLs (expire ~34h) |
| `user.username` / `owner.username` | str | Both generations tested |
| `caption.text` (fallback `edge_media_to_caption…`) | str | Dual-gen |
| `accessibility_caption` | str | Alt text, e.g. *"Video by Kailish on Nov 07..."* |
| `like_count` / `comment_count` | int **0-safe** (`!= null`, not `\|\|`) | 0-like posts exist — `\|\|` would lie |
| `media_type` | **1 = photo, 2 = video, 8 = carousel** | UI mode switch |
| `product_type` | `clips` / `carousel_container` / `feed` / `igtv` | |
| `display_uri` chain | `display_url → display_uri → thumbnail_src → display_src` | Poster fallback chain (yt-dlp order) |
| `video_url` + `video_versions[]` | MP4 candidates | Rank by **area**, best first; `type` 101/102/103 fallback |
| `video_dash_manifest` (MPD) | multi-quality DASH | **`mediaPresentationDuration="PT69.333336S"` = only reliable duration** |
| `image_versions2.candidates[]` | 240→1440 ladder | Rank by area, top 6 |
| `carousel_media[]` / `edge_sidecar_to_children` | sidecar children | Independently typed; order preserved; per-child DASH |

### 5.3 Shape rules

- **Photo (`media_type=1`):** ladder only, `video_url=""`, `duration=0` (correct — no video to time)
- **Video/Reel (`media_type=2`):** progressive + DASH; duration from **DASH**, not `video_duration`
- **Carousel (`media_type=8`):** parent `duration=0` (correct); each child parsed alone (mixed photo+video survives)
- **Normalization:** strip `utm_*`, `psln`, `igshid`; `/reels/`→`/reel/`; stories **rejected** (login-gated upstream)

Full matrix: `docs/REVERSE-ENGINEERING-DEEP.md`

---

## 6. Accuracy — No Cache, No Extension, Honest Limits

- **No cache** (owner choice): no KV/D1/SQLite. Repeat shortcodes pay 1 fetch (browser-side). This kills storage liability *and* stale-URL bugs (CDN `oe=` expiry).
- **Rate reality:** Cloudflare datacenter IPs *can* be gated with perfect parse. Bookmarklet lane makes this **irrelevant** (BOB does zero IG requests).
- **Public-only.** No logins, no private accounts, no DMCA-targeted storage. CDN links pass through; copyright stays with creators.
- **Lossless delivery:** progressive + DASH ladder (never transcode). If source is 480p, BOB says 480p — never fake-upscales.
- **Type scale (analyzed in `docs/GENUINE-AUDIT.md`):** Workers-only narrows to ~hundreds/day before 429 pressure; user-IP lane scales with *users*, not IPs. Do not quote "77k parses/sec" as system throughput — that was a CPU micro-bench.

---

## 7. Quick Start (local, no wrangler)

```bash
# 1) Python harness tests (parser lock)
.venv/bin/python -m pytest tests/ -q            # 8 passed
# 2) TS parser tests (same shapes, same shuffle-fallback)
./node_modules/.bin/tsc -p packages/extractor/tsconfig.json
node --test packages/extractor/test/*.test.mjs  # 5 passed
# 3) Web build (Pages preview)
cd apps/web && ../../node_modules/.bin/vite build && ../../node_modules/.bin/vite preview
```

## 8. Cloudflare Pages Deploy (static only — no Workers, no Functions)

```text
Dashboard → Workers & Pages → Create → Pages → Connect GitHub → div197/BOB-Instagram-Downloader

Framework preset: Vite
Root directory:   apps/web
Build command:    npm install && npx vite build
Output directory: dist
```

> **Build command (exact):** `cd apps/web && npm install && npx vite build`  
> **Output directory:** `dist` (relative to root `apps/web`)

3. Custom domain (optional) + **Deploy**. Live URL will be `https://bob.pages.dev` (or your custom domain).
4. No env vars, no secrets, no Workers. If you see a `vite: command not found`, your root is wrong — set **Root directory = `apps/web`** (above).

### Live test checklist (first 3 minutes on Pages)

```
1. Open your Pages URL on desktop Chrome
2. Drag "⤓ BOB Downloader" to bookmarks bar
3. Open DfcUpmgsQZ6 reel → tap bookmark → MP4 starts (Downloads folder)
4. Phone: save a reel page (.html) → BOB → Upload → preview → Download HD → Share to WhatsApp
```

## 9. Repo Structure

```text
.
├── apps/web/                  ← Cloudflare Pages (Vite)
│   ├── index.html             ← tool page (bookmarklet drag + upload + paste UX)
│   ├── main.ts                ← bookmarklet handoff + upload parser + share API
│   ├── public/bookmarklet.js  ← readable MIT bookmarklet (the extractor)
│   └── public/manifest.webmanifest (share_target)
├── packages/extractor/        ← TS signature parser (zero deps, 197 lines)
│   ├── src/index.ts           ← extractXigPolarisMedia + parseMedia
│   └── test/ (fixture + 5 tests)
├── services/extractor/        ← Python dev harness (curl_cffi, CLI, health) — NOT deployed
├── tests/                     ← 8 portable parser-fixture tests
├── docs/
│   ├── CANONICAL.md               ← final truth (teeno khush)
│   ├── REVERSE-ENGINEERING-DEEP.md← xig_polaris_media matrix (read before changing parser)
│   ├── LIVE-PROOF.md · BATCH-PROOF.md · CAROUSEL-PROOF.md · PHOTO-PROOF.md
│   ├── GENUINE-AUDIT.md            ← saccha vs fake lock
│   └── NO-WORKERS-USER-IP.md       ← why Workers are retired
└── LICENSE (MIT)
```

## 10. Security & Privacy

- **No cookies harvested.** Bookmarklet runs on IG origin, reads only the already-loaded public post, downloads CDN file. No `sessionid` ever leaves the browser.
- **No analytics, no tracking.** Pages site has zero trackers; manifest + PWA only.
- **Public only.** Stories, private accounts, long-ID (`>28` chars = private) → honest `PRIVATE` rejection.
- **Open source (MIT).** Fork, read, self-host — nothing gates you.

## 11. Roadmap

| Phase | Item | Status |
|---|---|---|
| ✅ | Deep RE + dual-walk lock (13/13) | done |
| ✅ | Cloudflare-pure cleanup (no cache/extension/Go/Hetzner) | done |
| ✅ | GitHub `div197/BOB-Instagram-Downloader` push | done |
| ⏳ | Pages live confirm (you) | **needs you** — connect repo, deploy, test 3-min checklist above |
| ⏳ | PWA share-target deep-link (Instagram → BOB) | manifest ready, handler ready |
| ⏳ | DASH 1080p on-demand mux (Mediabunny, client-side) | designed, not shipped (1080p DASH already parsed) |
| 🚫 | IGTV / Stories / private | **Intentionally out** — login-gated upstream, not bypassed |

## 12. Push to GitHub (Div197)

Repo is already live at https://github.com/div197/BOB-Instagram-Downloader

```bash
git push origin main
```

## 13. License

MIT — see `LICENSE`. Media rights remain with Instagram creators; BOB is a tool for personal backup of public posts you can already view.

---

*ॐ पूर्णमदः पूर्णमिदं पूर्णात् पूर्णमुदच्यते। पूर्णस्य पूर्णमादाय पूर्णमेवावशिष्यते॥*  
— İsha Upanishad ("When completeness is taken from completeness, completeness alone remains.")
