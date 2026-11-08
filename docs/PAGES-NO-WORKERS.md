# Pages-Only Architecture — Infinite Free Edge, Zero Workers

**Project:** BOB = Break Ordinary Boundaries  
**Date:** 2026-11-08 (Round 5)  
**Owner constraint:** deeply hostable on **Cloudflare Pages**, infinite free edge hosting, **without Cloudflare Workers at all**.  
**Baseline proven:** `docs/LIVE-PROOF.md` + `docs/BATCH-PROOF.md` (4/4 reels, 8.41 MiB verified, 1 GET each).

---

## 1. Verdict — Yes, Possible. With One Inescapable Condition.

**Pure-static Pages (no `/functions`, no Workers) can be the entire public product — if extraction runs in the requester's browser via an MV3 extension.** The extension uses the requester's residential IP + logged-in session to fetch Instagram (CORS-exempt). Pages serves only static HTML/JS/CSS — free, unlimited bandwidth, edge-cached globally.

**What "without Workers" strictly means (verified from Cloudflare docs, Sep 2026):**
- Pages static asset requests: **free and unlimited** (`pages/functions/pricing`: "requests to static assets are free and unlimited").
- Pages Functions requests: **billed as Workers** (Free: 100k/day shared quota). A `/functions` route *is* a Worker — using it violates the owner's constraint.
- Pages Free limits: **20,000 files/site, 25 MiB/file, 500 builds/mo, 100 custom domains**. Plenty for an SEO tool site (Vite build ≈ 200–800 KB, 8–12 pages).

Therefore: **no `/functions` directory, no KV, no D1, no Queues, no Durable Objects, no `wrangler` deploy for code.** One `vite build` → deploy `dist/` to Pages → done.

### Can / Can't without Workers

| Goal | Pages static-only? | How |
|---|---|---|
| Serve frontend + 8–12 SEO pages | ✅ Free unlimited | Vite static + pre-rendered HTML, edge-cached |
| Serve AdSense ads | ✅ | AdSense is a static script tag; no server needed |
| Fetch Instagram server-side | ❌ | No server code at all. CORS blocks browser JS too. |
| Extract via requester IP | ✅ | **MV3 extension** (host_permissions bypass CORS) |
| Cache media metadata | ⚠️ Client-only | IndexedDB (per-device) instead of KV/D1 |
| Queue / job system | ⚠️ Client-only | Extension service worker (in-browser) |
| Signed download URLs | ⚠️ Client-only | CDN URL returned by extension; no server HMAC |
| Host media files (R2) | ✅ Optional, no Worker | R2 *public bucket* (`r2.dev` / custom domain) serves bytes directly — no Worker in the path |
| Central analytics / abuse graph | ❌ | No backend. Telemetry lives in Privacy-respecting page stats (CF Web Analytics) + extension (opt-in). |

**The trade is clean:** you give up server-side caching and central index, you gain **zero-cost infinite scale, zero IP burn, zero paywall, zero Workers bill**.

---

## 2. Pages-Only Topology (final)

```text
                     ┌─────────────────────────────────────────────┐
                     │  Cloudflare Pages — STATIC ONLY (free ∞)    │
                     │  Vite build: / + 8–12 SEO pages + PWA       │
                     │  AdSense script · Turnstile (page-level)    │
                     │  No /functions · No wrangler · No Workers   │
                     └──────────────┬──────────────────────────────┘
                                    │ HTTPS (edge, unlimited)
                 ┌──────────────────▼──────────────────┐
                 │ Visitor's browser (their home IP)   │
                 │ ① Pages JS detects extension        │
                 │    window.postMessage("bob:ping")   │
                 │ ② If present → main path (below)    │
                 │ ③ If absent → install prompt        │
                 └──────────────────┬──────────────────┘
                                    │ extension API (postMessage / custom element)
                 ┌──────────────────▼──────────────────┐
                 │ MV3 Extension (requester IP)        │
                 │ • host_permissions: instagram.com/* │
                 │ • service worker fetch(ig) — CORS   │
                 │   exempt, real TLS + cookies        │
                 │ • MAIN-world GraphQL intercept      │
                 │   (xdt_shortcode_media / data-sjs)  │
                 │ • L1 parser (TS port of Python L1)  │
                 │ • chrome.downloads → user's disk    │
                 └──────────────────┬──────────────────┘
                                    │ 1 GET per user paste (their IP, their quota)
                                    ▼
                            instagram.com/p/{shortcode}/
                            (their browser is a normal user — no ban surface on BOB)
```

**No-install fallback (still no Workers):** user pastes link → Pages JS shows "Install BOB extension for one-click download" + instructions to open the reel in Instagram → long-press → save (manual). Honest, gentleman-grade. Optional: self-host the Python extractor (Hetzner €3.79) as a public API the Pages JS calls cross-origin with CORS `*` — Pages stays static, backend lives elsewhere (not Cloudflare, no Workers). Recommended only if extension adoption stalls.

---

## 3. How Every Previous Piece Maps (full context, reconciled)

| Earlier decision | Pages-only new home |
|---|---|
| Python L1 parser (77k/s, proven) | **Ported to TS** in `packages/extractor` — runs in extension SW, tested against same fixture + live reel. Python stays as **dev harness + optional fallback API**. |
| Shortcode cache (SQLite/KV) | **IndexedDB** (per-device, user's browser). 6h TTL, `oe`-aware. KV/D1 deleted — no Workers, no bill. |
| Queue (Cloudflare Queues) | **Extension SW** single-flight promise + in-page retry (429 → 60s backoff, typed `SOURCE_RATE_LIMITED`). |
| HMAC-signed delivery (herascrape pattern) | **Unneeded** — extension downloads via `chrome.downloads` (cookie context) or opens CDN URL directly. Open-proxy risk disappears. |
| R2 media store | **Optional public bucket** (or skipped entirely). Bytes flow Instagram CDN → user disk. No BOB egress, no storage bill. |
| Go worker fleet (millions review) | **Not needed.** Millions scale = installs, not containers. Python fleet only if fallback API runs. |
| SEO pages (8–12) | **Static pre-rendered HTML** on Pages. 20k-file limit is 1,000× headroom. `lastmod` sitemap pushed via build. |
| AdSense | **Static script tag** below the tool, CLS-safe slot. Zero server risk to ads.txt. |
| Health probe (hourly) | **CI cron** (GitHub Actions, free) runs extractor fixture tests + live probe on owner URLs; extension ships an update when `doc_id`/parser shifts (MV3 auto-update). |
| DMCA / takedown | `dmca.html` static page + designated-agent contact. No backend to take down — no hosting liability at all. |

---

## 4. Build Plan (Nodes / Files / Steps)

```text
bob/
├── apps/
│   ├── web/              # Vite build → Pages (static)
│   │   ├── src/          # tool page + 8 SEO pages (pre-rendered at build)
│   │   └── dist/         # ← deploy this dir to Pages (drag / git push)
│   ├── extension/        # MV3, Vite+crxjs, TS
│   │   ├── manifest.config.ts   # host_permissions: https://www.instagram.com/*
│   │   ├── src/background.ts    # service worker: fetch(ig, {credentials:"include"})
│   │   ├── src/inject/main.ts   # MAIN world: fetch/XHR/JSON.parse intercept
│   │   ├── src/parser.ts        # TS port of L1 dual-schema (tested)
│   │   └── src/popup.html       # React popup = SAME tool UI as web (iframe-less)
│   └── api/              # OPTIONAL fallback: Python L1 as FastAPI (Hetzner) — not on CF
├── packages/
│   └── extractor/        # Shared TS parser + types (web + extension import)
└── docs/                 # this review + LIVE-PROOF + BATCH-PROOF (all in repo)
```

**Deploy (Pages):** connect GitHub → build command `pnpm build` → output `apps/web/dist` → free ∞ bandwidth. Custom domain `bob.example.com` (1 of 100 free). No `wrangler`, no Functions, no Workers in `wrangler.toml` (file absent by design).

**AdSense:** `adsbygoogle.js` in `index.html`, one 320×100 slot below the tool, `data-adtest` in dev. No server-rendered ad logic.

**Extension store:** Chrome Web Store + Firefox Add-ons (dual manifest). "Request site data" warning for `instagram.com` is the install friction — mitigated by honest PRIVACY.md ("fetch only pasted public URL, cookie never leaves device, stop on 429, no tracking").

---

## 5. Risks & Honest Limits

| Risk | Reality | Mitigation |
|---|---|---|
| Install friction | Users must install extension — web-only visitors can't extract | Extension-first marketing + manual "Save from Instagram" fallback; short install video |
| CORS is bypassed only in extension | Pure-web JS can never fetch IG HTML | No workaround exists upstream — extension *is* the workaround (Chrome docs sanction it) |
| No central cache | Repeat downloads re-fetch from the user's own browser (their quota, not ours) | IndexedDB per-device; public reel popularity lives in browser, not server — acceptable |
| doc_id / parser drift | MV3 extensions auto-update, but drift window = hours | CI probe detects; extension ships fix; server L1 (dev harness) validates first |
| Store review delay | Broad host permission triggers scrutiny | Sideload for v0.1 + honest PRIVACY.md; store for polish |
| AdSense on tool pages | Still high-risk per Publisher Policies (see DEEP-RESEARCH §7) | Freemium-first (Premium no-ads) — static site is *cheaper* to keep ad-free |

**What Pages-only does NOT solve:** If growth outruns the extension funnel (e.g., 1M casual visitors, 1% install), most visitors never extract. The mitigation is funnel quality (install in ≤2 clicks, store badges, "BOB for Chrome" CTA above the fold), not server code — adding a Workers backend would reintroduce the IP-burn + bill the owner explicitly rejected.

---

## 6. Direct Answer

> *"Can this be deeply hostable on Cloudflare Pages without Workers at all?"*

**Yes — as a pure-static Pages site + MV3 extension.** Pages gives infinite free edge hosting for everything static (frontend, SEO, AdSense, PWA). Extraction moves to the requester's browser (their IP, their quota, their disk) — the most decentralised, paywall-free, ban-safe design possible. The cost is install friction and no central cache — both acceptable for a gentleman tool.

**Recommended order:**
1. Scaffold `apps/web` (Vite static, 1 tool page + 2 SEO pages) → deploy to Pages → confirm infinite-free.
2. Scaffold `apps/extension` (MV3, TS L1 port) → test against `DfcUpmgsQZ6` in-browser (requester-IP proof).
3. Wire `postMessage` bridge (Pages ↔ extension) + install funnel.
4. Keep Python extractor as CI harness + optional fallback API (Hetzner) — never on Cloudflare.

---

## 7. Sources

- Pages limits (20k files, 25 MiB, 500 builds/mo): https://developers.cloudflare.com/pages/platform/limits/
- Static free & unlimited; Functions = Workers billing: https://developers.cloudflare.com/pages/functions/pricing/
- MV3 host_permissions + CORS exemption: https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions
- R2 public buckets (no Worker needed): https://developers.cloudflare.com/r2/buckets/public-buckets/
- BOB proofs: `docs/LIVE-PROOF.md`, `docs/BATCH-PROOF.md`, `services/extractor/` (commit b325c13)
