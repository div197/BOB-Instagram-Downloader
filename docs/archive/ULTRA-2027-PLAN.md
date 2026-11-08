> **SUPERSEDED — history.** Final state is Cloudflare-pure (no cache, no extension, Edge Worker + Pages only). See docs/REVERSE-ENGINEERING-DEEP.md + docs/CANONICAL.md.

# ULTRA 2027 Plan — Zero-Cost, Lossless, Requester-IP, Pages-Only

**Project:** BOB = Break Ordinary Boundaries  
**Date:** 2026-11-08 (Round 6 — ultra)  
**Baseline proven:** `docs/LIVE-PROOF.md` (1 GET, 0.9s) · `docs/BATCH-PROOF.md` (4/4 reels, byte-verified)  
**Constraint set (owner):** Pages static ∞ free · **no Workers** · requester-IP primary · no paywall · lossless · totally free service (hosting ≈ $0/mo)

---

## 1. The 2027 Truth — What "Totally Free" Actually Costs

Verified against Cloudflare + Chrome + Mozilla primary docs (Sep–Oct 2026):

| Line item | 0 → 1M visitors/mo | Floor |
|---|---|---|
| **Pages static** (frontend + SEO) | **$0** — bandwidth + requests unlimited free | 20k files · 25 MiB/file · 500 builds/mo (use Actions Direct Upload to bypass count) |
| **R2 public** (optional media index) | **$0** (10 GB + 1M writes + 10M reads free, egress free forever) | Custom domain (not r2.dev) + Cache Rule; hot media on Pages instead |
| **GitHub Actions CI** (public repo) | **$0** — minutes free + unlimited on standard runners | Keep repo public |
| **Chrome Web Store** | **$5 one-time** (per dev account) | No renewal, no per-item fee |
| **Firefox AMO** | **$0** | 200 MB max; manual-review backlog — ship source + build script with every submission |
| **Domain** | **~$0.85–1/mo amortized** (~$10–12/yr) | Only unavoidable recurring cost |
| **AdSense script** | **$0** (revenue-positive $2–5 RPM general) | `ads.txt` + privacy page + consent banner |
| **Extractor** | **$0** — runs in user's browser (requester IP) | Server extractor = CI harness only, never prod |

**Total: $0/mo after a $5 one-time + $10/yr domain.** Break points with clean $0 escapes: Pages builds >500/mo → Actions deploy; R2 reads >10M/mo → Pages or 90%+ cache; file count >20k → second Pages project (cap 100).

**Cloudflare direction (2026):** Pages nudges new projects to Workers, but Pages is **not deprecated**; Workers Static Assets has identical economics. Pages is compliant today; quarterly check `developers.cloudflare.com/pages/platform/limits/` is the 2027 guard.

---

## 2. Ultra Low-Level Extension Engineering (MV3 2026)

### 2.1 Architecture primitives (verified)

```text
MAIN world (injected.js, document_start)  — page JS env, NO chrome.* — passive intercept
    │ window.postMessage {source:"ig-saver", type:"media-found", items}
    ▼
ISOLATED content script (content.js)      — page-aware buttons, DOM scan
    │ chrome.runtime.sendMessage {type:"collect", shortcode}  ← ONLY shortcode crosses
    ▼
Service Worker (background.js, module)    — CORS-EXEMPT fetch, sole storage writer
    │ fetch(https://www.instagram.com/p/{code}/, {credentials:"include"})
    ▼
instagram.com (requester's residential IP, real cookies, real TLS)
```

**CORS law (Chrome docs):** SW/popup/options/offscreen are **exempt** for `host_permissions` hosts. ISOLATED content scripts are **not** (page origin, since Chrome 85). MAIN world is page origin. → **All IG fetches happen in the SW, never in the content script.**

**SW lifecycle (30s idle kill, 5 min request cap):** fetch is a single awaitable — no long-lived streams in SW. DOM-heavy work (HTML parse, `createObjectURL`, canvas) moves to an **offscreen document** (one at a time, needs a `Reason` justification).

### 2.2 The 4 extraction techniques, ranked 2026

| # | Technique | Robustness | CORS | When |
|---|---|---|---|---|
| **D. `data-sjs` SSR blobs** | **High** (direct nav) | N/A (in-page) | **Primary** — `<script data-sjs>` already in DOM; walk `__bbox → result.data.xig_polaris_media` (yt-dlp canonical path) |
| **B. MAIN-world intercept** | Med-high | N/A (passive) | **Feed/carousel** — `fetch`/`XHR` clone + signature walk (`image_versions2`+`code`); `JSON.parse` patch as SES fallback (mayconvm) |
| **A. SW `fetch` HTML** | Medium | ✅ exempt (SW) | **Paste-URL fallback** — offline "paste a link" without tab open; strict 429 handling |
| **C. DOM walk** | Medium (single) / Low (carousel) | N/A | **Last resort + visual button anchors** — `video.currentSrc`, `srcset`, Shadow-DOM recursion ≤15 (jeongpiano) |

**Shipping stack:** D + B + C fallback, A only for paste-URL. Signature detection (never brittle paths) — matches Papan1a's object-signature contract.

### 2.3 Media quality chain (highest, lossless)

```text
image_versions2.candidates[]  → pick max width×height (≤1080px)
video_versions[]              → progressive 720p MP4 (default, instantly playable)
video_dash_manifest (MPD)     → 240p–1080p HFR + AAC (highest, needs mux)
```

- **Progressive-first default.** DASH-mux only on explicit opt-in (hoaianle pattern).
- **Lossless mux:** WebCodecs + **Mediabunny** (zero-dep, transmux = codec copy, never re-encode). `mp4box.js` legacy alternative.
- **CDN `efg` decode** (ZenekeZene): `vencode_tag`/`bitrate` filter audio-only tracks → pick max bitrate when `video_versions` absent.

### 2.4 Download mechanics

```ts
// CDN URL (typical 1-50 MB) → browser downloads with its own cookies
await chrome.downloads.download({ url: cdnUrl, filename, saveAs: false, conflictAction: "overwrite" });
// track completion → downloads.onChanged (never assume success on call return)
```

- Filename: sanitize `[\\/:*?"<>|]`, allowlist ext (`jpg|jpeg|png|webp|mp4|mov|m4v|gif|mp3`), 200 ms gap between batch files (anti-429 throttle).
- SW has **no `createObjectURL`** → generated bytes (muxed MP4) go via **offscreen BLOBS** → blob URL → `chrome.downloads.download(blobUrl)` → revoke.
- **429 = hard stop.** `retry-after` → countdown + manual resume. No silent retry loops. Private/login-wall/CAPTCHA → stop path with honest copy.

### 2.5 Privacy sandbox (Chrome Web Store Limited Use)

```text
MAIN → ISOLATED → SW : only {shortcode, slideIndex} crosses. NEVER cookies, sessionid, raw HTML.
SW: validates https CDN-only, whitelisted ext, safe keys before storing. Storage TTL 6h.
host_permissions: ["https://www.instagram.com/*"] ONLY (not <all_urls>).
PRIVACY.md: collected = shortcode + already-visible CDN URLs · no third-party · no cookies ·
            no analytics · single purpose Limited Use certified in dashboard.
```

---

## 3. Pages-Only Mapping — Every Server Piece, Rehomed

| Server piece (earlier) | Pages-only new home | Cost |
|---|---|---|
| Pages frontend | **Vite build → `dist/` → Pages** (Git or Actions Direct Upload) | $0 ∞ |
| SEO (8–12 pages) | **Pre-rendered static HTML** (20k-file cap = 1,000× headroom) | $0 |
| AdSense | **Static script tag**, below-fold slot, CLS-safe | $0 (revenue +) |
| L1 parser (Python) | **TS port** in `packages/extractor` — runs in extension SW | $0 |
| Cache (KV/D1) | **IndexedDB** (per-device, 6h `oe`-aware) | $0 |
| Queue | **SW single-flight** + typed backoff | $0 |
| Signed delivery | **Unneeded** — `chrome.downloads` (cookie context) | $0 |
| R2 media index | **Optional public bucket** (or skipped) | $0 ≤10 GB |
| Health probe | **GitHub Actions cron** (free, public repo) | $0 |
| DMCA | **Static page**, no backend → zero hosting liability | $0 |

**Web ↔ Extension bridge:** Pages tool page does `window.postMessage({type:"bob:ping"})` → extension replies → UI switches to "BOB connected — paste a link". No extension → install funnel + manual "Open in Instagram → long-press → Save" instructions (gentleman honesty).

---

## 4. Unique Reengineering (the 2027 moat)

Not a clone. Seven differentiators, each independently buildable:

1. **Single-parse core** — one `data-sjs` walk yields thumbnail + 3 video_versions + 9-quality DASH + image ladder + caption/owner/counts (proven: 819 KB → everything).
2. **Signature parser** — match by object shape (`image_versions2`+`code`), never by path. Field renames degrade gracefully (see §4.7).
3. **Requester-IP infinity** — scale = installs, no proxy pool, no paywall, no ASN burn. The IP *is* the user.
4. **Native-grade UX from web** — `bob:ping` bridge makes the Pages page *feel* like a cloud tool while computing locally.
5. **Lossless by contract** — progressive-first, DASH-opt-in, Mediabunny transmux (codec copy, never transcode), FFprobe parity in CI.
6. **Offline-first PWA** — Vite static + service-worker cache; entire tool works on a plane (extension cache carries it).
7. **Federated index (opt-in)** — extension publishes signed Nostr events `{shortcode, cid}`; peers discover via IPNS. No central DB required.

---

## 5. Build Sequence (each step independently verifiable)

1. **Monorepo** — `pnpm-workspace.yaml`, `turbo.json`, `packages/extractor` (TS parser + fixture tests in Node).
2. **`apps/web`** — Vite, 1 tool page + 2 SEO pages, `postMessage` bridge, AdSense stub. Deploy Pages → confirm ∞ free.
3. **`apps/extension`** — MV3 dual manifest (Chrome+Firefox), SW fetch + MAIN intercept + `chrome.downloads`, PRIVACY.md. Test in-browser on `DfcUpmgsQZ6` → requester-IP proof.
4. **Quality picker + DASH mux** — Mediabunny transmux opt-in, FFprobe parity.
5. **CI** — GitHub Actions: `pnpm build && pytest && wrangler pages deploy ./dist` (Direct Upload, public repo = $0).
6. **Store listings** — Chrome ($5) + Firefox ($0), 3 screenshots, short install video, honesty-first privacy copy.

---

## 6. Risks (stated plainly)

| Risk | Truth | Mitigation |
|---|---|---|
| Install friction | Pure-web visitors can't extract without extension | 2-click funnel, store badges, manual fallback copy |
| SES / bundle race | MAIN patch may miss first-post JSON | D is primary (SSR blobs) — B is only for feed/carousel |
| Store review (weeks) | Broad host perm + new dev = slow lane | Sideload v0.1, submit with source + build script, single-origin perm only |
| 20k-file SEO ceiling | Programmatic pages capped | Audit `dist` count monthly; overflow → 2nd Pages project (cap 100) |
| AdSense high-risk | Publisher Policies ban "download streaming if prohibited" | Freemium-first (Premium no-ads) — static site is cheapest to keep ad-free |

---

## 7. Sources

- Pages limits / pricing (static ∞ free, Functions = Workers): `https://developers.cloudflare.com/pages/platform/limits/` · `https://developers.cloudflare.com/pages/functions/pricing/`
- R2 free tier / public buckets: `https://developers.cloudflare.com/r2/pricing/` · `https://developers.cloudflare.com/r2/buckets/public-buckets/`
- GitHub Actions public-free: `https://docs.github.com/en/billing/concepts/product-billing/github-actions`
- Chrome register ($5) / review / MV3 perms / SW lifecycle / CORS / downloads / Limited Use: `https://developer.chrome.com/docs/webstore/register` · `/review-process` · `/declare-permissions` · `/service-workers/lifecycle` · `/network-requests` · `/downloads` · `/cws-dashboard-privacy`
- Firefox submit ($0, backlog): `https://extensionworkshop.com/documentation/publish/submitting-an-add-on/`
- yt-dlp data-sjs path: `https://github.com/yt-dlp/yt-dlp/blob/master/yt_dlp/extractor/instagram.py`
- mayconvm (JSON.parse) · Papan1a (fetch/XHR + trust boundary) · jeongpiano (Shadow DOM) · ehmorris (DOM walk, GPL) · hoaianle (Fiber + mux) · ZenekeZene (doc_id + efg) — GitHub READMEs (see Round 2–4 docs)
- Mediabunny (transmux, MPL-2.0): `https://mediabunny.dev/guide/introduction`
- BOB proofs: `docs/LIVE-PROOF.md` · `docs/BATCH-PROOF.md` · `services/extractor/` (b325c13) · `downloads/index.html` (e3282aa)
