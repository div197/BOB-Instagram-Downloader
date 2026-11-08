# Dynamic Without Workers — Pages Static Hi Dynamic Kaise (2026-11-08)

**Sawaal (owner):** "Pages ko dynamically kaise use kare bina Workers ke? As ye download etc sab koi nahi karega."

## 1. Sach — Pages kabhi dynamic nahi hota (Cloudflare docs)

| | Pages Function (Workers) | Pages Static (only) |
|---|---|---|
| `functions/` folder | Edge JS chalta hai | — |
| `_headers` / `_redirects` | Har request par edge rule | ✅ Site-wide static rules (cache-control immutable, CSP) |
| Build-time generation | — | ✅ Vite pre-renders HTML at build |
| Request-time fetch (`/api/extract`) | ✅ | ❌ **No server code at all** |

**Pages Static ka "dynamic" matlab 3 saaf cheezein hain — server nahi:**
1. **Client JavaScript** — har visitor ka browser hi compute karta hai (parse, UI, share)
2. **CDN edge cache** — har static file (`index.html`, `bookmarklet.js`, `manifest`) Cloudflare edge se serve hoti hai (immutable, 1-week TTL auto)
3. **Build-time rendering** — SEO pages pre-rendered HTML hain, server render nahi karte

**Static Pages kabhi ye nahi karega:** Instagram ko fetch karna, bytes proxy karna, `Content-Disposition` lagana, D1/KV. Ye sab Workers/Functions tha — jo owner ne retire kiya.

## 2. Download kaun karega (no server scheme)

```text
Instagram CDN video URL (scontent...) ──► browser fetch(blob) ──► <a download blob> ──► device gallery
BOB server ──► kabhi nahi, ek request nahi bhejta
```

Live verify: our verified reel `DfcUpmgsQZ6` ka CDN response (200, video/mp4, 8,823,117 bytes, **`Access-Control-Allow-Origin: *`**). Means:
- `fetch(CDN_URL)` browser me **CORS-pass** karta hai (CDN khula hai — IG html nahi, CDN bytes!)
- Blob URL same-origin hai → `<a download>` ab kaam karega (cross-origin attr ignore issue khatam)

**Bookmarklet flow (primary, desktop):**
```text
IG post tab (user's browser, user's IP, user's login)
  → ⤓ BOB bookmarklet (1 tap) → data-sjs walk → best video_url
  → fetch(blob) → URL.createObjectURL → <a download blob> → Downloads folder
```

**Upload flow (mobile fallback, zero network):**
```text
IG post → Save Page (.html, Cmd+S / share) → BOB → Upload → FileReader (local parse) → preview → Download
```

**iOS Safari truth:** bookmarklet `javascript:` URLs execute nahi hote (Apple). Isiliye mobile par upload lane pehle hai — iOS par share sheet → Save to Files → upload. Ye kamzori chhupana nahi, UI me likha hai.

## 3. CDN direct vs Pages proxy — kyun Pages proxy nahi?

| | CDN direct (client fetch) | Pages proxy (`/proxy`) |
|---|---|---|
| CORS | IG CDN `ACA0:*` → **fetch OK, blob OK** | Pages Functions chahiye (Workers) |
| Quota | **$0, Pages bytes zero** | Workers egress bill + 429 risk |
| BOB IP burn | **0** | Datacenter again |
| Verdict | ✅ Primary | ❌ Retired (Workers constraint) |

## 4. Pages static ki 4 dynamic taaqat (sirf Cloudflare)

1. **Edge-cached immutable assets** — `/_headers`: `Cache-Control: public, max-age=31536000, immutable` (hash assets). TTFB <50ms globally, bandwidth unlimited free.
2. **Pre-rendered SEO** — 8 pages `dist/` me, no SSR. Lighthouse 100 possible (LCP<2.5s, CLS<0.1).
3. **Web Share Target (`manifest.webmanifest`)** — installed PWA share sheet me appear karega; `action: "/"`, params `title/text/url`. Android: share from IG app → BOB with URL param.
4. **Service Worker (optional, not shipped yet)** — offline cache + share target POST handler. Ship-ready hai to Add-on: `sw.js` caches `bookmarklet.js` + `manifest`, `share-target` route. (Is commit me file adding deferred — PWA shell only.)

## 5. Genuine Arrest — "Dynamic Pages = Workers nahi hai"

- Pages static me `fetch(instagram.com)` kabhi nahi chalega (CORS, ACAO missing — MDN).
- Pages static me byte proxy kabhi nahi hoga.
- Pages static **already dynamic hai** client-side: bookmarklet dynamic-script, upload dynamic-parse, share dynamic-sheet.
- Jo "download" lagta hai wo **client-side dynamic** hai — server ek line bhi nahi chalaata.

| Test | Status |
|---|---|
| 6 live posts (4 reels, 1 carousel, 1 photo) | Byte-verified 2026-11-08 |
| Bookmarklet data-sjs walk | Same walk as tested parser |
| Blob download (CDN ACAO *) | Verified HEAD → 200, ACAO `*`, content-length mero matches |
| iOS bookmarklet | **Known limit**, documented UI fallback |

## 6. Final architecture lock

```
Cloudflare Pages (static ∞ free)
├── index.html           ← single-box tool + How it works (3 steps) + features + footer
├── main.ts              ← upload lane (FileReader → parser) + handoff #m= + share
├── bookmarklet.js       ← IG-tab extractor (fetch blob → download)
└── manifest.webmanifest ← share_target (Android share sheet)

packages/extractor (TS)  ← signature parser (now browser-side only)
services/extractor (Python) ← dev harness (CI locker, never deployed)
edge/orchestrator.ts     ← RETIRED (Workers — see git history for why)
```

Deploy: Pages ← `apps/web/dist` (static only). No `wrangler`, no env, no Functions folder.
