> **SUPERSEDED — history.** Final state is Cloudflare-pure (no cache, no extension, Edge Worker + Pages only). See docs/REVERSE-ENGINEERING-DEEP.md + docs/CANONICAL.md.

# Shiva–Shakti Architecture — No Install, Edge-First, Shiva-Tiny

**Project:** BOB = Break Ordinary Boundaries  
**Date:** 2026-11-08 (Round 7)  
**Owner metaphor:** *Shiva — we host (tiny, still, origin) · Shakti — Cloudflare Pages (energy, infinite edge).*  
**Proven:** `docs/LIVE-PROOF.md` (0.9s, 1 GET) · `docs/BATCH-PROOF.md` (4/4) · `services/extractor/` (Python L1)

```text
                    ┌── SHAKTI · Cloudflare Pages (static ∞ free) ──┐
                    │  HTML/JS/CSS · SEO pages · AdSense             │
                    │  No Workers required (static-only deploy)      │
                    └───────┬───────────────────┬──────────────────┘
                     visitor│ /proxy or /api     │ direct CDN
                            ▼                      ▼
              ┌─ mobile browser ─┐   ┌─ Shiva extract ──┐   Instagram
              │  paste → download│──►│  Go stdlib L1    │──►│  (requester IP nahi,
              │  WhatsApp share  │   │  JSON-only       │   │   Shiva IP — cache-first)
              └──────────────────┘   └──────────────────┘   └───────────────────┘
```

**One-line dharm:** Shakti infinity deti hai, Shiva sirf tab jagta hai jab Shakti IG ko na chho sake.

---

## 1. Edge Limits — Methodologically Decoded (2026)

### 1.1 What edge CAN do (and does free)

| Component | Free limit | BOB need | Verdict |
|---|---|---|---|
| Pages static | **Free + unlimited** requests | HTML/JS/CSS + SEO | ✅ Shakti core |
| Workers CPU | **10ms free / 30s paid** (fetch wait uncounted) | regex+JSON.parse ~5–25ms | Free tight, Paid $5 comfortable |
| Subrequests | **50 free / 10,000 paid** | 1 IG fetch + KV + R2 = 3–4 | ✅ |
| Memory | **128 MB** | HTML 0.5–1.5 MB + JSON <5 MB | ✅ |
| KV | **100k reads/day, 1k writes/day** | shortcode→JSON 6h TTL | ✅ ≤1k uniques/day free; paid $0.50/M reads, $5/M writes |
| R2 | **10 GB, 1M A, 10M B, egress free** | manifest JSON + optional bytes | ✅ Public bucket + custom domain serves **without any Worker** |
| D1 | **5M reads/day, 100k writes** | audit log (optional) | Only if queryable history wanted |
| Queues | **10k ops/day free** | 429 retry enqueue | Optional |

**Edge can parse L1 perfectly.** `GET instagram.com/p/{code}/` → regex `data-sjs` → `JSON.parse xig_polaris_media` → `video_url` + DASH. CPU, memory, subrequests — sab green.

### 1.2 What edge CANNOT do (the real wall)

**Workers egress = datacenter ASN (AS13335). Instagram blocks datacenter on first request** (ScrapFly 2026, live-verified): *"flagged immediately… before rate limits"*, TLS fingerprint tells bot even with copied headers, ~200 req/hr/IP unauthenticated, then 429 → longer block → permanent ban. ScrapFly live test: plain HTTP → 200 with stripped `data-sjs` or 401 `require_login`. **Full payload only via rotating TLS + residential IPs.**

Cloudflare Worker `fetch()` cannot control TLS fingerprint, HTTP/2 frame order, or ASN. Browser headers don't help. **Edge fetch IG = unreliable by design, not by bug.**

**FFmpeg (DASH mux) + yt-dlp subprocess also cannot run in Workers** — V8 isolates have no OS, filesystem, or `child_process`. Containers ($5/mo, 25 GiB-hrs incl) or tiny server required. Browser Rendering/Run (Playwright REST, 10 min/day free) has same datacenter-IP problem.

### 1.3 Methodological bypass (respectful, no circumvention)

We do **not** spoof fingerprints or rotate identities to evade IG. The bypass is architectural, not adversarial:

```text
1. CACHE-FIRST: KV/R2 absorbs repeat shortcodes. 6h TTL → ≤~4k IG fetches/day bound.
   A viral reel re-downloaded 10,000× = 1 IG fetch, 9,999 cache hits. Edge IP load ≈ 0.
2. SHIVA-ONLY-ON-MISS: edge calls tiny Go server (IPv6 /64, Hetzner/Cloud Run) ONLY when
   KV miss + R2 miss. Shiva burns its one IP; edge never does.
3. HONEST BACKOFF: on 429/401 honor Retry-After, queue retry 30 min, return cached-or-error.
   No retry storm. Null-rate drift alert if xig_polaris_media goes empty (parser drift).
4. PROGRESSIVE-FIRST, DASH-OPT-IN: 720p progressive needs zero mux. ffmpeg mux is rare (1080p opt-in)
   → Shiva container only, never edge.
```

Result: edge serves 95% from cache/CDN; Shiva fetches <5% under real traffic. IG sees low, bursty, respectful volume from one IP — not a farm.

---

## 2. Shiva — Ultra-Tiny Extractor (Go stdlib only)

**Choice: Go, single `main.go`, `net/http` + regex + `encoding/json`. No Fiber, no deps.**  
**⚠️ Live-test update (2026-11-08): Go stdlib `net/http` fetch to IG returned gated/empty `data-sjs` (TLS fingerprint: Go JA3 ≠ Chrome). Python `curl_cffi` impersonation succeeded from same machine (0.9s, 819 KB). MVP Shiva = **Python (curl_cffi)** is the only proven path today; Go needs `uTLS` Chrome fingerprint (adds dependency) or a `curl_cffi` sidecar. Keep Go skeleton under `services/shiva/` as reference — it builds (6.6 MB) and passes offline parse tests, but production L1 must impersonate Chrome TLS.

| Metric | Go (stdlib) | Python FastAPI (for ref) |
|---|---|---|
| Image (scratch/distroless) | **12–20 MB** | 150–250 MB |
| Idle RSS | **8–15 MB** | 48–200 MB |
| Cold start (Cloud Run/Fly) | **<50 ms** | 0.8–2 s |
| RPS ceiling | 50–100k | 6–8k (1 worker) |

IG fetch latency (~0.9s proven) dominates CPU (~10ms) — RPS beyond 1k is irrelevant. What matters is **memory, cold start, image size** → Go wins all three.

### Hosting verdict (2026 prices)

| Host | 100k req/mo | 1M req/mo | Notes |
|---|---|---|---|
| **Cloud Run (req-based)** | **$0** | **~$2.88** | Free: 2M req, 180k vCPU-sec. JSON-only (client fetches CDN direct). **Recommended primary.** |
| **Fly.io shared-1x** | **$2.19–3.69** | **$3.69** | Always-on, 5s autostop, IPv6 free. Best fallback if cold-start fails QA. |
| **Hetzner CX23** | **€5.99** | **€5.99** | Only viable if Shiva proxies video bytes (20 TB incl). Old CX22 €3.79 discontinued. |
| **Render free** | $0 but 60s spin-down | — | **Not viable** — user perceives broken on wake. |
| **Oracle Always Free** | **$0** (10 TB egress) | **$0** | True $0 always-on, fragile quota. Phase-3 fallback. |

**Rule:** JSON-only → **Cloud Run $0**. Byte-proxy (iOS `/proxy`) → **Hetzner €5.99 flat**. Client-fetches-CDN-direct keeps Shiva JSON-only = $0.

### Shiva API (tiny surface)

```text
GET  /healthz                         → {ok:true, ig:"reachable"} (synthetic probe)
GET  /extract?url=instagram.com/...   → BOBMedia JSON (same shape as Python L1)
     CORS: * | 429/Retry-After honored | 1 GET/extract, <1s p50
GET  /proxy?u=<cdn-url>&name=bob.mp4  → stream bytes, Content-Disposition: attachment
     (iOS fallback only; never buffers whole file; Range passthrough)
GET  /share?url=...                   → HTML result page (for Telegram/web share, cacheable)
```

No cookies, no session, no `yt-dlp`, no ffmpeg in v1. DASH mux + yt-dlp = Phase-2 Shiva container behind feature flag.

---

## 3. Zero-Install Mobile Web Flow (90% audience)

**The problem mobile solves without any install:** user opens BOB link in mobile browser, pastes reel URL (copied via Instagram ✈️), taps download, saves to phone, posts to WhatsApp Status. No extension, no PWA install, no home-screen icon — bilkul nahi.

### 3.1 The `<a download>` wall (MDN + Chrome 65+)

> `download` only works for **same-origin, `blob:`, `data:` URLs. Cross-origin CDN URL → attribute ignored, tap opens in new tab.**

**Fix (verified pattern):** point the anchor at **same-origin `/proxy`** on your own hostname (Cloudflare Tunnel / Shiva custom domain). Server streams bytes with `Content-Disposition: attachment; filename="bob-reel.mp4"`. Works on every mobile browser, ignores CDN CORS, honors `download`.

### 3.2 Platform truth (2026)

| Platform | Download behavior | WhatsApp step |
|---|---|---|
| **Chrome Android 89+** | `<a download>` → Downloads folder, background service continues | Share → WhatsApp, or Files → Share → WhatsApp Status |
| **Safari iOS 13+** | Downloads button → Quick Look → Share → **Save Video → Photos** (Files → Downloads is the store; no direct-to-Photos) | Photos → WhatsApp Status |
| **Web Share L2** | `navigator.share({files})` shares file directly (15+ iOS, 89+ Android) | Native sheet → WhatsApp — **best bridge** |

**iOS flow (exact):** Paste → Download → Downloads icon → tap file → Share → Save Video → Photos → WhatsApp Status. UI must teach this coachmark, else completion <40%.

**Order inside the page (feature-detect, no UA-sniff):**
1. `/proxy` same-origin stream (primary, works everywhere)
2. Web Share `files` (if `canShare`) as "Share / Save to Photos" button
3. Long-press → Open video → Share → Save Video (escape hatch for stubborn WebViews)

### 3.3 Telegram Bot (mobile-native channel, P1)

Bot reuses the **same Shiva box**: long-poll `getUpdates`, L1 parse, `sendVideo` (≤50 MB multipart, ≤20 MB by URL). User forwards link in chat → bot replies video in chat → save → WhatsApp. Zero install, chat-native. **Wall:** 50 MB ceiling — 90-sec Reels over that need re-? or split. Bot is an *acquisition channel*, not the web replacement (it cannot publish to WhatsApp).

---

## 4. Final Shiva–Shakti Layout

```text
Cloudflare Pages (Shakti) — static ∞ free
├── index.html  ·  SEO pages  ·  AdSense (below tool only)
├── main.ts     → POST Shiva /extract (CORS *) → video_url + thumb
└── <a href="/proxy?u=…&name=…"> → Shiva streams → phone Downloads
                                   (iOS: Files → Share → Save Video → WhatsApp)

Shiva (Go, Cloud Run $0 or Hetzner €5.99)
├── L1: GET instagram.com/p/{code}/ (curl-impersonate? NO — honest fetch, backoff)
├── parse: data-sjs → xig_polaris_media (TS fixture parity, Node tests)
├── cache: in-memory LRU 10k + SQLite (6h oe-aware TTL)
└── /proxy: byte stream, Range passthrough, Content-Disposition
```

**Cost at scale:** 100k/mo = $0 (Cloud Run) · 1M/mo = $2.88 (JSON-only). Byte-proxy via Shivahost only → €5.99 flat. Pages = $0 ∞. **Total ≈ $0/mo.**

---

## 5. Build Sequence

1. **Shiva Go v1** — `shiva/main.go` (this doc's code) + `go test` + curl proof on `DfcUpmgsQZ6` (<1s).
2. **Edge Pages web** — `apps/web` calls Shiva `/extract`, renders preview, `<a href="/proxy…">` download.
3. **Mobile QA** — Chrome Android download + iOS Safari Files→Photos→WhatsApp (4 owner reels).
4. **Telegram bot P1** — same Shiva box, long-poll, 45 MB guardrail.
5. **Extension P1.5** — MV3 requester-IP (already scaffolded, `apps/extension/dist/`).

---

## 6. Sources

- Workers limits/pricing (10ms/30s/300s, 50/10k subrequests, 128 MB): `https://developers.cloudflare.com/workers/platform/limits` · `/pricing`
- Edge IP block evidence (datacenter flagged before rate limit, TLS fingerprint): ScrapFly `https://scrapfly.io/blog/posts/how-to-scrape-instagram` (Oct 2026)
- Pages static ∞ free, Functions = Workers: `https://developers.cloudflare.com/pages/functions/pricing`
- KV/D1/R2/Queues 2026 free tiers: `https://developers.cloudflare.com/kv/platform/limits` · `/d1/platform/pricing` · `/r2/pricing` · `/queues/platform/pricing`
- Containers (ffmpeg needs OS, $5/mo): `https://developers.cloudflare.com/containers/platform/pricing`
- Cloud Run / Fly / Hetzner / Render / Oracle 2026 pricing: sub-agent tables (Cloud Run $0/$2.88, Fly $2.19, Hetzner €5.99, Oracle 10 TB)
- Go vs Python (2 MB scratch, 8–15 MB RSS, <50 ms cold): scratch benchmarks + augmentedmind.de
- MDN `<a download>` same-origin law + iOS Files→Photos path: `https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/a` · Apple Support 102440
- Web Share L2 (files, iOS 15+, Android 89+): `https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share`
- Telegram 50/20 MB caps: `https://core.telegram.org/bots/api`
