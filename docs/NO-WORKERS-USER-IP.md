# NO-WORKERS — User IP Is The Game (2026-11-08)

**Owner constraint:** No cache, no extension, Cloudflare-only, no wrangler locally.  
**This document answers:** "Cloudflare Workers ko kaise hataye, user ka IP hi game ho?"

## 1. The Wall (honest)

| Path | Works without a server? | Why |
|---|---|---|
| `fetch(https://www.instagram.com/p/…)` from `bob.example.com` | ❌ | **CORS:** Instagram sends no `Access-Control-Allow-Origin`. Browser drops the body (`opaque`). Server proxy/Fetch CORS is the only fix — that proxy *is* a Worker (or any server). |
| `<img>/<video>` embed from bob.example.com | ⚠️ Display-only | CDN bytes render in browser chrome, not readable/parlable as files. Download needs same-origin blob — `fetch(CDN)` also CORS-blocked. |
| **Bookmarklet on instagram.com** | ✅ | Runs in IG origin: DOM + `data-sjs` already loaded, cookies natural, download via `<a download>` to CDN URL (CDN download of a file is *navigation*, not a CORS fetch). **Zero server. User IP. User login.** |
| **Save-page-as-HTML + upload to BOB** | ✅ | User saves `instagram.com/p/...` (Cmd+S → `.html`), BOB parses locally via `FileReader` (`@bob/extractor`). Zero network, zero server. Manual but honest. |
| PWA Share Target (Instagram → BOB) | ⚠️ Partial | Receives the shared *URL string* only. Still needs a fetch to resolve — CORS wall again. Useful as *deep-link convenience*, not an extractor. |
| Extension `host_permissions` | (rejected) | Owner vetoed. Bookmarklet is the same technique without install. |

**Verdict:** Workers-free + user-IP means **code must run on instagram.com** (bookmarklet) or **in the browser on a user-supplied file**. There is no third way. Middleware (Workers, Shiva, any proxy) is exactly the datacenter-IP bottleneck we are removing.

## 2. Bookmarklet Lane (primary, zero install)

```text
User opens reel in browser (Chrome, logged in or not — public posts load either way)
  → clicks "⤓ BOB" bookmark on the post page
  → bookmarklet (apps/web/public/bookmarklet.js) runs IN the IG tab:
      1. walks script[data-sjs] → xig_polaris_media (recursive signature walk)
      2. picks best video_url (720p progressive) or image (1080 ladder)
      3. triggers <a download> to CDN URL (direct File, no BOB roundtrip)
      4. optional: opens BOB with #m=<media summary> for share/WhatsApp
  → File lands in Downloads → user shares to WhatsApp Status
```

**Why it never 429s from BOB:** IG sees the user's browser on their home IP — exactly the traffic Instagram expects. BOB makes **zero requests to Instagram, ever.** Rate limit is the user's own session, spent exactly like viewing the post.

**Mobile honesty (bookmarklet edge cases):**
- iOS Safari: `javascript:` URLs from the bookmarks menu *do not execute* (Apple blocks). Workaround: copy bookmarklet JS → paste into address bar via share sheet "Open in Quick Look" trick is unreliable — recommend the **upload fallback** on mobile (save post → upload `.html`).
- Android Chrome: bookmarklets work via address bar dropdown (long-press bookmark). Documented limitation in UI.

## 3. Upload Lane (mobile + fallback, zero network)

```text
User: IG post → ⋮ → "Save Page" (or long-press → Save) → .html file in Downloads
  → BOB site → "Upload saved Instagram page (.html)" → FileReader (local only)
  → same @bob/extractor parser (data-sjs walk) → preview + download/share
```

No upload to any server — file never leaves the device except for the CDN download the user triggers. This is the **most honest** lane: user supplies the bytes Instagram already served them.

## 4. What stays on Cloudflare (and what dies)

| Stays (Pages static, $0 ∞) | Dies |
|---|---|
| `apps/web` — UI, SEO, bookmarklet install, upload parser, Web Share API, PWA manifest | `edge/orchestrator.ts` (Workers) — datacenter fetch bottleneck |
| `packages/extractor` — signature parser (now runs in **browser** via upload lane) | Python `services/extractor` fetcher (`curl_cffi` — dev harness only) |
| R2 (optional) — none | KV/D1/R2/Queues/Cron/Go — none used |
| — | Cache — removed by owner (accepted: repeat shortcodes pay one browser-side load) |

Deploy: `apps/web/dist` → Pages, that's it. **No `wrangler`, no Workers, no env secrets in git.**

## 5. Tests

- Python offline (pytest): normalize + L1 shapes + error taxonomy — no network.
- TS parser (node --test): reel + photo + carousel + shuffle-walk.
- Bookmarklet: load an IG post, click bookmarklet, watch 720p MP4 start.
- Upload lane: `tests/fixture.py` HTML → `FileReader` → preview. (Live IG HTML paste is *not* committed — signed URLs expire ~34h.)
