# BOB Decentralised Architecture — Requester-IP, Open-Source, No Paywall

**Project:** BOB = Break Ordinary Boundaries  
**Date:** 2026-11-08 (Round 4)  
**Baseline proven:** `docs/LIVE-PROOF.md` (server L1, 0.9 s) · `docs/MILLION-SCALE-REVIEW.md`  
**New mandate from owner:** use the **requester's own IP**, no closed-source paywall, most modern decentralised code.

---

## 0. The Idea — Why Requester-IP Changes Everything

Today's clones all share one bottleneck: **the server's IP burns**. One datacenter IP = ~200 req/hr of Instagram trust. Millions of requests need a proxy pool ($1–3k/mo) or a paywalled API (Apify/Bright Data) — a closed tollgate.

The requester already *can* see the public post in incognito. If extraction runs **in their browser**, Instagram sees a normal residential user, not our server. Scale = installs, not IPs. No pool, no tollgate.

```text
                    SERVER (us)                          REQUESTER (them)
                    ┌─────────────────────┐              ┌──────────────────────┐
                    │ Index · KV/D1 · R2/  │              │ Browser / Extension  │
                    │ MinIO · Hono API     │◄────────────►│ their home IP        │
                    │ NEVER fetches IG     │  signed      │ fetches IG (1 GET)    │
        Bytes     ──│ only streams/saves   │  manifest    │ parses data-sjs /     │
                    └─────────────────────┘              │ GraphQL in-tab        │
                                                         │ downloads via browser │
                                                         └──────────────────────┘
                              Instagram sees: residential user ✓
```

**Nishkaam test:** requester IP ≠ tricking Instagram. It's the user viewing what they already may view. Rate: 1 fetch per deliberate click, stop on 429, public URLs only.

---

## 1. Feasibility Verdict — 5 Paths, 1 Winner

| Path | Verdict | Blocker / Enabler |
|---|---|---|
| **A. Pure web JS `fetch(ig)`** | ❌ Blocked | CORS: IG sends no `Access-Control-Allow-Origin`. `no-cors` = opaque, unreadable. |
| **B. MV3 extension (service-worker `fetch`)** | ✅ **Primary** | `host_permissions` exempts the SW from CORS. Real UA/TLS/cookies/residential IP. |
| **C. Desktop (Tauri/Electron native `fetch`)** | ✅ Secondary | Native HTTP = no CORS. Electron = Chromium TLS (best). Tauri `reqwest` = detectable JA3. |
| **D. WebRTC relay alone** | ❌ Alone | DataChannel transports bytes; it can't create them. Page `fetch(ig)` still CORS-blocked. Only works *with* an extension. |
| **E. Worker "fetch as CF-Connecting-IP"** | ❌ Impossible | TCP/TLS source IP is the egress socket. `CF-Connecting-IP` is a cosmetic header IG ignores. |

**Conclusion:** BOB's decentralised core = **MV3 extension** (every Chrome/Brave/Edge/Firefox user) + **web fallback** (paste HTML / upload). Desktop later. Pure-web relay and Worker spoofing are provably dead ends — do not build them.

---

## 2. How the Extension Actually Extracts (code-verified, 2026)

From 8 live repos (hoaianle, TheKonka, Sectorus Turbo, ESuit, Glassgram, Papan1a…), the 2026 pattern is settled:

**3-tier cascade (robustness order):**
1. **MAIN-world GraphQL/network intercept** — patch `fetch`/`XHR`/`JSON.parse` inside the IG tab, read IG's own `xdt_shortcode_media` / `xig_polaris_media` JSON. Inherits `x-ig-app-id`, `x-ig-www-claim`, cookies. No CORS. Survives wrapper changes via object-signature detection (`image_versions2` + `code`), not fixed paths.
2. **Embedded SSR JSON scan** — same `data-sjs` walk as our server L1, but executed in the tab.
3. **DOM walk** — `video.currentSrc`, `<source src>`, Shadow-DOM recursion (needed since 2026: IG renders media inside shadow roots; plain `querySelectorAll("video")` returns empty).

**Reference repos to model (all MIT, clean — no Sentry/analytics):**

| Repo | Stars | Pattern |
|---|---|---|
| `hoaianle/Instagram-Downloader` | 462 | Relay doc_id `27852811784380813`, mp4box DASH mux in-browser |
| `TheKonka/instagram-download-browser-extension` | 417 | MAIN-world `inject.ts` + XHR patch, dual Chrome/Firefox |
| `Sectorus/Turbo-Downloader-for-Instagram` | 7 | `CometRelay.fetchQuery`, captures `x-ig-www-claim` live. ⚠️ **ships Sentry — do not copy un-scrubbed** |
| `ariedotcodotnz/ESuit-Photos-Downloader-For-Instagram` | 3 | Vite+crxjs, auto doc_id discovery, **WebCodecs/Mediabunny DASH mux (WASM)** — most advanced 2026. ⚠️ no LICENSE file — treat as all-rights-reserved |
| `jewdev/glassgram` | 3 | Dual-target (Chrome SW + Firefox event-page), privacy-exemplary, GPL-3.0 |
| `Papan1a/instagram-media-saver` | — | Docs gold standard: MAIN inject → isolated content → background (sole storage writer) |

**Server-side `fetch(url)` + regex is fallback-only** (fragile: SPA, cookies, 429). Our server L1 stays as the **no-install fallback** — but the extension is primary.

**Data flow:**
```text
user on instagram.com/reel/XYZ → clicks BOB button (content script)
→ MAIN-world script resolves media via GraphQL intercept (in-tab, own IP)
→ background SW requests file via chrome.downloads (cookie context)
→ server (optional) records {shortcode, cid, quality} to index — bytes never needed
```

**Privacy law:** fetch only the pasted public URL, only on click, cookie stays in-browser (never forwarded), 1 fetch/click, halt on 429/503, no background crawl, explicit consent screen.

---

## 3. The Open Monorepo — Most Modern, No Paywall (2027)

**Mandate:** every component MIT/Apache (MinIO AGPL only as deployable service, never vendored), self-hostable with one `docker compose up`, no Apify/Bright Data anywhere. R2 optional endpoint, never required.

```text
bob/
├── apps/
│   ├── extension/      # MV3 · TS · Vite+crxjs · React popup · dual Chrome/Firefox
│   ├── web/            # Hono (edge) + Vite — link resolver, index UI
│   ├── desktop/        # Tauri 2 + React (later) — ffmpeg sidecar, offline vault
│   └── node/           # Community extractor node — Bun/Node + Hono + libSQL
└── packages/
    ├── extractor/      # Pure TS: signature detection, doc_id discovery, DASH parser
    ├── db/             # SQLite/libSQL schema
    ├── s3/             # MinIO client (S3_ENDPOINT env; R2 is just an endpoint)
    ├── ipfs/           # Kubo client (CID/IPNS)
    ├── torrent/        # WebTorrent wrapper (P2P delivery)
    ├── nostr/          # Nostr events (coordination, NIP-01)
    └── ui/             # Shared tokens/components
```

| Layer | Choice | Why |
|---|---|---|
| Monorepo | **Turborepo 2.11 + pnpm** (MIT) | 20M/wk downloads, remote cache, `turbo prune` |
| Extension | **MV3 + Vite + crxjs** | Glassgram proves the Firefox event-page branch |
| Edge API | **Hono** (MIT) | Web-Standards, Workers *and* Bun/Node (same code) |
| DB | **SQLite + libSQL** (MIT) | `sqld` self-host binary; D1 optional |
| Media store | **MinIO** (AGPL service) default | S3-compatible; `S3_ENDPOINT` switch to R2 without code change |
| P2P delivery | **WebTorrent** (MIT) | magnet = CID-derived infoHash; browser seeds without server |
| Content addressing | **IPFS Kubo v0.43.1** (MIT/Apache) | CID per file, IPNS index per node. Pin release (Shipyard ended Sep-2026) |
| Coordination | **Nostr relays** (opt-in) | Signed events (`bob:media-v1`), no central registry |
| Mux | **Mediabunny + WebCodecs** (ext) / **ffmpeg** (desktop) | ESuit pattern, no native helper |

**Federated node flow (no central server required):**
1. Extension intercepts GraphQL, computes CID client-side.
2. User chooses: *Save locally* · *Pin to my node* · *Publish to index* (signed Nostr event, bytes opt-in).
3. `apps/node` accepts `POST /v1/pins` (Nostr-signature auth), stores CIDs in libSQL, bytes in MinIO, pins in Kubo.
4. Peers discover via Nostr relay or IPNS; bytes via nearest MinIO gateway or WebTorrent magnet.
5. **Zero closed APIs.** Every IG read uses the user's own session.

**License hygiene:** extension MIT · services MIT · MinIO AGPL as deployable (not vendored) · Kubo/WebTorrent/Hono/Turbo all permissive.

---

## 4. What Changes vs. Server-Only (the honest delta)

| | Server-only (today's L1) | Decentralised (extension-primary) |
|---|---|---|
| IG fetch IP | Our server (200/hr cap) | **Requester's browser** (per-user cap) |
| Scale | Proxy pool $$ | Installs |
| Install friction | None | **Extension install required for primary path** |
| Logged-out reliability | Works (1 GET, proven) | Weaker (login-wall on profiles) — server L1 remains fallback |
| Trust surface | Server sees URL | Browser sees URL; server sees *what user publishes* |

**Hybrid answer (recommended):** extension primary (requester IP, logged-in fidelity, unlimited scale) + **server L1 as no-install fallback** (anonymous, proven 0.9s) + link-unfurl via Hono. Nobody is locked out; nobody's IP is burned for the primary path.

---

## 5. Ultra-Deep Engineering Notes

- **SES lockdown (Oct 2025):** IG freezes `fetch`/`XHR` via Secure ECMAScript — override `JSON.parse` in MAIN world instead (mayconvm pattern).
- **Shadow DOM (2026):** `querySelectorAll("video")` returns empty — walk `document.querySelectorAll("*")` → `shadowRoot` recursively (jeongpiano pattern).
- **doc_id auto-discovery:** never hard-code (ahmedrangel's `10015901848480474` vs yt-dlp's `27130156389949648` proves churn). Scan `.graphql` modules at runtime (ESuit).
- **`x-ig-www-claim` / `x-ig-app-id`:** capture live from the tab's own requests (Turbo pattern) — never guess.
- **Firefox has no SW:** dual manifest, event-page branch (Glassgram).
- **Chrome Web Store review** for `instagram.com` host permission is friction (warning text) — sideload for dev, store for distribution.

---

## 6. Next Actions (owner)

1. **Share the reels** (as promised) — I will run all of them through server L1 + extension-simulated parses and report per-shape results (reel/post/carousel/photo).
2. **Scaffold `apps/extension/`** (MV3 + Vite + crxjs, MAIN-world GraphQL intercept) — first commit, MIT, zero Sentry.
3. **Scaffold Turborepo monorepo** + `packages/extractor` shared TS parser (port our Python L1 dual-schema logic to TS, tested against fixture + live reel).

---

## 7. Sources

- CORS/extension feasibility: Chrome MV3 permissions https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions · DNR https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest · InstaGhost https://github.com/uppifyagency/instaghost
- Desktop native fetch: Tauri http plugin https://v2.tauri.app/plugin/http-client/ · Electron net https://electronjs.org/docs/latest/api/net
- IG CORS: https://stackoverflow.com/questions/45508831/fetch-cors-error-with-instagram-api
- Extension repos: hoaianle https://github.com/hoaianle/Instagram-Downloader · TheKonka https://github.com/TheKonka/instagram-download-browser-extension · Sectorus Turbo https://github.com/Sectorus/Turbo-Downloader-for-Instagram · ESuit https://github.com/ariedotcodotnz/ESuit-Photos-Downloader-For-Instagram · Glassgram https://github.com/jewdev/glassgram · Papan1a https://github.com/Papan1a/instagram-media-saver
- SES lockdown: mayconvm https://github.com/mayconvm/chrome-instagram-download · Shadow DOM: jeongpiano https://github.com/jeongpiano/instagram-media-downloader
- MinIO/R2, Hono, Turborepo, Tauri, WebTorrent, Kubo, Nostr, Pixelfed: sources in sub-agent reports (toolradar, honojs, vercel/turborepo, v2.tauri.app, webtorrent, ipfs/kubo, nostr-protocol, pixelfed)
