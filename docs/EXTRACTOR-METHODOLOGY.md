# BOB Extractor Methodology — Upside-Down Tree (Roots First)

**Project:** BOB = Break Ordinary Boundaries  
**Date:** 2026-11-08 (Round 2 — code-level GitHub review)  
**Companion:** [DEEP-RESEARCH.md](./DEEP-RESEARCH.md) (Round 1)  
**Status:** Methodology locked. No extractor code yet — next step is Phase-0 build.

---

## 0. Bhagavad Gita, Chapter 15 — The Upside-Down Banyan Tree

> *ūrdhva-mūlam adhaḥ-śākham aśvatthaṃ prāhur avyayam* —  
> "They speak of an eternal banyan tree with roots above and branches below." (Gita 15.1)

**BOB application — this is our architecture principle:**

```
                    ┌─────────────────────┐
     BRANCHES       │  Frontend (Vite)    │  ← beautiful, fast, gentleman UX
     (180°)         │  SEO pages · PWA    │     (built LAST, grows from roots)
                    └──────────┬──────────┘
                               │  API contract (stable)
              ┌────────────────▼─────────────────────┐
              │  Control plane: Worker + KV/D1 + R2  │  ← cache, queue, signed URLs
              └────────────────┬─────────────────────┘
              ┌────────────────┴─────────────────────┐
     ROOTS    │  Extractor kernel: L0→L5 layers      │  ← THE TREE'S LIFE
     (anchored)│  inline JSON · GraphQL · yt-dlp ·  │
               │  managed fallback · fingerprint    │
               └──────────────────────────────────────┘
```

**Methodology rule:** Most clone sites grow branches first (pretty page + 50 ad slots) and then wonder why the tree dies when Instagram rotates a token. **BOB grows roots first.** A verified, cached, rate-limited extractor kernel makes *any* frontend trivial. A beautiful frontend on a dead extractor is just another ad farm.

The "gentleman" corollary of the inverted tree: roots are invisible. Nobody sees them, nobody thanks them — but they feed everything. Likewise BOB's discipline is invisible: shortcode cache, signed URLs, honest errors, no storage. The visible part (frontend + ads) stays minimal because the roots do the real work.

---

## 1. The Gentleman Doctrine — Why Every Competitor Fails the User

**Observed 2026 reality:** SaveInsta, SnapInsta, Instadp all *work* — then bury the user under popups, redirect loops, fake "Download" ad buttons, and interstitials that hijack back-navigation. Reviews consistently flag: *"pop-up ads, redirects, inconsistent performance."* SaveIG goes further and advertises **private account** downloads — an invitation to phishing.

**BOB's vow (founder principle, from owner):**

> "I am not doing anything new. I am doing the same thing in the most gentleman way."

Concrete translation into product law:

| Law | Meaning | Enforcement |
|---|---|---|
| **One tool, one result zone** | Paste → preview → one honest download button per media item. No decoy buttons. | AdSense deceptive-implementation policy requires this anyway. |
| **Ads below the fold, never above the tool** | Max 1 ad unit per page, below tool + FAQ. Never adjacent to a download button. No popunders, no interstitials, no fake players. | CLS-safe reserved slot; label "Advertisement". |
| **No login, ever** | "We never ask for your Instagram login." Not in copy, not in cookies, not in extractor. | Public-only extractor (L0–L3); private → honest 403. |
| **No storage, no hosting** | Stream from Instagram CDN at the edge; discard. R2 only as 24h transitory fallback. | DMCA §512 conduit posture; kill-switch on takedown. |
| **Honest failure** | "Instagram expired this link / rate-limited us — try again in 60s." Never a fake spinner, never a redirect to an ad. | Structured error codes (see §7). |
| **Speed is the respect** | Tool interactive <1s, LCP <2.5s, thumbnails with fixed aspect-ratio (zero layout shift). | Pages static HTML; preview fetches lazily. |

This is not marketing fluff. It is the **only sustainable moat** against ad-farmed clones: a tool users return to by name (brand search), not just land on and flee.

---

## 2. GitHub Landscape Audit — Code-Reviewed 2026-11-08

Method: GitHub API search (sorted by updated + by stars), shallow-cloned 11 repos, read the extractor code directly. Shallow-clone HEAD dates captured at review time.

### 2.1 Tier A — Actively maintained, integrable (the shortlist)

| Repo | HEAD (clone) | Stars class | Approach (code-verified) | BOB verdict |
|---|---|---|---|---|
| **yt-dlp** `yt-dlp/yt-dlp` | 2026-11-04 (`#17990`) | flagship | Hybrid: logged-in `/media/{id}/info/` first → logged-out GraphQL `PolarisLoggedOutDesktopWWWPostRootContentQuery` `doc_id=27130156389949648` → webpage `data-sjs` parse (`xig_polaris_media` → `if_not_gated_logged_out`). Impersonation via curl-cffi. 767-line `instagram.py`; `InstagramIE` handles DASH (`video_dash_manifest`), carousel (`_extract_product`, playlist), comments (`comments_connection`). | **Borrow as download engine, not as fetcher.** Best-in-class parser; free; community fixes within days of IG shifts. Go backend embeds yt-dlp binary, calls `extract_info(download=False)` for metadata, then pinned CDN fetch. |
| **Reelkeep** `freelanceguru06-create/reelkeep-instagram-downloader` | Oct 2026, 8 commits, 0 stars | experiment | **Closest open blueprint for BOB.** Astro static FE + FastAPI BE. `backend/worker.py`: isolated child process, `yt_dlp.YoutubeDL({skip_download, allowed_extractors:['Instagram'], noplaylist, retries:0})` → format selection (combined MP4 preferred; split AVC ≤1080p + M4A, `ffmpeg -c copy` merge, `file,pipe` protocol allowlist) → **pinned-HTTPS CDN fetch** (DNS validated to global addresses, TLS hostname preserved, 4-redirect cap, `ftyp` container check) → FFprobe verification. 50 MiB cap, 55s deadline, 20/hr quota, 100 MiB/day delivery. Zero ads, no tracking, 4-page site (index/privacy/acceptable-use/404). **Verified end-to-end Oct 28 2026** (local + cloud). | **Copy the pattern, not the caps.** Reelkeep proves anonymous yt-dlp extraction still works for public reels in Nov 2026 — from a single Render free host with no proxies. BOB = Reelkeep engineering × scale layers (cache, queue, proxy tiers, managed fallback). |
| **instaloader** `instaloader/instaloader` | 2026-11-01 | ~13.1k stars, v4.15.3 | Profile-oriented bulk downloader (CLI+lib), logged-out public + optional login. Most maintained open-source IG tool (ScrapFly 2026 ranking). | Reference for profile bulk later (Premium). Not a single-URL API; 429-prone at volume. |
| **gallery-dl** `mikf/gallery-dl` | 2026-10-31, v1.32.19 | large | `InstagramExtractor` with `api == "graphql"` mode; `shortcode_from_id(pk)`; carousel/sidecar expansion; per-type dispatch (post/reels/stories/saved). Same upstream endpoints as yt-dlp. | Fallback extractor library (Python sidecar) if yt-dlp's IG parser stalls. |
| **instagrapi** `subzeroid/instagrapi` | 2026-11-07, v3.2.7 | ~6.6k stars | Private mobile API + login (`Client().login()`, session dump, 2FA/challenge). Maintainers: "fragile in production". | **REJECT as core.** Login-required, ban/challenge-prone, ToS violation. Optional opt-in only. |
| **ScrapFly `instagram-scraper`** `scrapfly/scrapfly-scrapers` | 2026 (last commit Aug 2026 per ScrapFly) | vendor repo | `data-sjs` regex → `__bbox.require` walk → `xig_polaris_media.if_not_gated_logged_out`; profile via `xig_user_by_username` (`web_profile_info` now 400-gated). `doc_id=28904005159232689` for posts pagination (rotates). Anti-bot via ScrapFly API (`unblocker`, residential). | **Copy the parser; rent the anti-bot at scale.** `scrapfly-scrapers/instagram-scraper/instagram.py` `_extract_xig_polaris_media()` is our L1 spec. |
| **herascrape IG downloader** `herascrape/instagram-video-downloader` | Oct 2026 | vendor FE | **Pure Cloudflare Worker FE:** static page + `/resolve` proxy + `/dl` edge streaming from IG CDN with **HMAC-signed tokens** (`base64url(json).base64url(HMAC-SHA256)`, `{u,f,e}` claims, open-proxy guard) + Range forwarding for video seeking + ZIP build at edge. Resolution itself delegated to private backend (herascrape API). Turnstile-gated, per-IP rate-limited. | **Copy the edge-delivery pattern.** BOB Worker = same shape: never proxy bytes through origin; verify HMAC claim; stream CDN response with `Content-Disposition`. |
| **shahzaibnagi instagram-downloader** | Oct 2026 | 2-file UI | Config-driven static client (`config.js` → resolver API), validated links, clean errors, EN+Urdu. No backend. | Reference for config-driven frontend. Proves the FE/ resolver split. |

### 2.2 Tier B — Stale, archived, or structurally dead (do not depend)

| Repo | Evidence | Lesson |
|---|---|---|
| **ahmedrangel/instagram-media-scraper** ("Working 2025", Node) | Method 1 "Magic Parameters" `?__a=1&__d=dis` + cookie; Method 2 GraphQL `doc_id=10015901848480474` (no cookie). | Proves `doc_id` churn: the working ID in 2025 was `10015901848480474`; yt-dlp's current L2 is `27130156389949648`. **Hard-coding any `doc_id` from a blog post is a guaranteed silent death in 2–4 weeks.** BOB auto-discovers + health-checks it (see §6). |
| **instascrape** (tnychn, 176 stars) | `requests`-based, `instagram-private-api`-era headers, 2FA/checkpoint handling, GraphQL query IDs. | `requests` = instant TLS-fingerprint throttle in 2026. BOB uses curl-cffi/impersonation only. |
| **drawrowfly/instagram-scraper** (905 stars) | Dormant since Nov 2022 per ScrapFly audit. | Never install deprecated scrapers; read as reference at most. |
| **instagram-private-api** (dilame) | No commit since Mar 2024, 408 open issues. | Private-API Node path is dead upstream. Rejected. |
| **whizzzkid/instagram-proxy-api** | README header: *"Archived April 24, 2018. All endpoints dead."* Old `graphql/query` IDs `17888483320059182`. | Historical proof that every IG endpoint generation dies. Build for rotation, not permanence. |
| **Scrapstagram / OSINT tools** (93 stars class) | OSINT recon, not downloaders. | Out of BOB scope (no PII collection). |

**ScrapFly 2026 ranking cross-check** (Oct 28, 2026, fetched live): Instaloader = best-maintained public downloader; instagrapi = most capable but fragile; "no truly no-login path to serious volume — logged-out throttles within minutes; `doc_id` rotates every 2–4 weeks." Our L1+L3+L4 layering is built for exactly this.

---

## 3. Byte-Level Findings — yt-dlp's Current Logged-Out Flow

From `yt_dlp/extractor/instagram.py` (HEAD 2026-11-04, code read live):

```text
1. If logged in:  GET {API}/media/{media_id}/info/   (media_id = _id_to_pk(shortcode), base64url)
2. Else logged-out triple fallback:
   a. GET /web/get_ruling_for_content/  (access check, CSRF seed)
   b. POST /api/graphql  doc_id=27130156389949648
      friendly-name: PolarisLoggedOutDesktopWWWPostRootContentQuery
      variables: {media_id}    →  data.xig_polaris_media.if_not_gated_logged_out
   c. GET /p/{video_id}  → parse <script data-sjs> via _SJS_RE
      → require → RelayPrefetchedStreamCache → __bbox.result.data.xig_polaris_media
3. _extract_product() expands: video_url, video_dash_manifest (MPD), carousel sidecars
   (playlist), caption, counts, taken_at_timestamp, comments_connection
```

Key headers: `X-IG-App-ID: 936619743392459` (web), `X-FB-Friendly-Name: PolarisLoggedOutDesktopWWWPostRootContentQuery`, `X-ASBD-ID: 359341`, `X-IG-WWW-Claim: 0`, `Referer: https://www.instagram.com/{url}`. **All fetches with `impersonate=True` (curl-cffi Chrome).** Failure modes are first-class: login-redirect → "rate-limit exceeded anonymously"; empty media → "check in incognito; if accessible, file a bug."

**ahmedrangel's Node GraphQL (older generation):** `POST /api/graphql?variables={"shortcode":…}&doc_id=10015901848480474&lsd=AVqbxe3J_YA`, headers `X-FB-LSD`, `X-ASBD-ID: 129477`. Different friendly-name, different doc_id, different ASBD — confirming per-generation rotation.

---

## 4. The BOB Layered Extractor (L0 → L5)

One principle: **cheapest layer that succeeds wins; every layer failure is data, not disaster.** Each layer returns normalized media or a typed error. Cache is consulted before any network.

```text
request URL
   │
   ▼ normalize → shortcode ──► KV/D1 cache? ──yes──► signed URL (302/stream) ──► DONE (0 IG calls)
   │ no
   ▼
 L0  oEmbed preview        (graph.facebook.com .../instagram_oembed?url=)
     → thumbnail, author_name, embed HTML. ~1k req/hr. NEVER for extraction.
     → FE shows preview in <300ms even while L1/L3 run.
   │
   ▼
 L1  Inline JSON           GET /p/{shortcode}/ (curl-cffi, impersonation)
     → data-sjs → xig_polaris_media.if_not_gated_logged_out
     → display_url, video_url, carousel sidecars, caption, counts
     → FASTEST public path in Nov 2026 (ScrapFly + Reelkeep both land here)
   │
   ▼ (L1 gated / empty / 429)
 L2  GraphQL persisted     POST /api/graphql doc_id=<auto-discovered>
     → xdt_shortcode_media → same fields + video_dash_manifest (multi-quality)
     → doc_id health-checked hourly; on null-rate >20%, re-discover (DevTools/HTML probe)
   │ (L2 rejected / login-redirect)
 L3  yt-dlp engine         YoutubeDL(allowed_extractors=['Instagram'], skip_download)
     → Reelkeep pattern: format pick (combined > AVC≤1080p) → pinned-CDN fetch
     → ffmpeg -c copy merge (file,pipe allowlist) → FFprobe verify → R2 24h TTL
   │ (L3 SOURCE_RATE_LIMITED / SOURCE_TIMEOUT)
 L4  Managed fallback      Bright Data ($0.75/1k, ~98.9%) or Apify ($1–2.70/1k)
     → structured JSON → same normalizer → L3 download path
     → budget-gated: L4 only after L1–L3 typed-fail; cost counter per day
   │
   ▼ (all fail)
 L5  Browser fallback      Cloudflare Browser Run (10 concurrent, $0.09/hr)
     → last resort for JS-gated pages; never primary (datacenter IP, 5–10s/page)
   │
   ▼
 HONEST ERROR              typed code + retry-after + "try again" (no ad-redirect)
```

### Why this ordering
- **L0 first, always, in parallel** — the gentleman trick the clones don't do: instant thumbnail/proof-of-life while extraction runs. Perceived latency ≈ 300ms; real extraction reuses the same page load.
- **L1 before L2** — inline JSON survives `doc_id` rotation; ScrapFly migrated *to* it when `web_profile_info` gated.
- **L3 as the byte engine** — yt-dlp's DASH stitching + Reelkeep's pinned-fetch/FFprobe pattern is the only proven open path to *verified* MP4 bytes (Reelkeep: Oct 28 2026 cloud-verified).
- **L4 as insurance, not crutch** — managed APIs convert "Instagram changed something at 3am" from an outage into a line item. DIE (dependency-update) model: upgrade a parser, not rewrite a product.

---

## 5. Fingerprint, Proxy & Session Discipline

| Concern | BOB rule | Source |
|---|---|---|
| TLS fingerprint | `curl_cffi` Chrome impersonation on every IG fetch (L1–L3 internally). Plain `requests`/`httpx` never touches IG. | ScrapFly 2026 (gutted payload w/o impersonation, Sep 23 2026); yt-dlp `impersonate=True` everywhere. |
| App ID / client headers | `X-IG-App-ID 936619743392459` (web), `X-ASBD-ID 359341`, `X-FB-Friendly-Name PolarisLoggedOutDesktopWWWPostRootContentQuery`, `Referer` = original post URL. Rotatable in config; health-checked. | yt-dlp HEAD. |
| IP quality | Tier-1 IPv6 /64 rotation (free) → Tier-2 sticky residential → Tier-3 mobile only if 1M+/day. Sticky 5–10 min; rotate on 429/403; backoff 2→4→8→16s. | ScrapFly: datacenter blocked on 1st request; ~200 req/hr/IP. |
| Rate budget | 1 extractor concurrency per IP; global semaphore 20–50; `--sleep-requests 1–2`. yt-dlp 429 = per-IP metadata counter, not bytes. | yt-dlp 429 docs; Reelkeep 20/hr quota analog. |
| Cookies | **None for public path.** No `sessionid`, no user account, no sacrificial pool for L0–L3. A logged-in cookie pool would convert BOB into an instagrapi-class ban risk and void the "never ask for login" vow. | Reelkeep: "Never loads yt-dlp CLI config or browser cookies." |
| doc_id lifecycle | Auto-discover (HTML probe + known-candidate list); hourly synthetic health check against a pinned public reel; null-rate alert >20%; `doc_id` stored in D1, versioned, never hard-coded without the probe. | ScrapFly: rotation every 2–4 wks; ahmedrangel vs yt-dlp ID divergence proves churn. |
| LSD/CSRF | `_lsd_token` + csrftoken re-initialized per app version; treated as cacheable metadata with TTL. | yt-dlp `_real_initialize()`. |

**Private-account line (structural, not policy):** private posts, full follower lists, current stories, hashtag browse are login-only upstream. BOB returns `403 PRIVATE` immediately without attempting. No challenge-solving, no CAPTCHA bypass — if Instagram challenges, BOB backs off and says so.

---

## 6. Cache, Queue & Delivery (the invisible roots)

```text
Normalize: strip ?utm_*, ?igshid=*, ?img_index=*, trailing "/"; m.instagram.com→www; /reels/→/reel/
Key:       ig:{shortcode}     (shortcode = stable ID, never expires)
KV (6h TTL): media:{shortcode} → {cdn_url, thumb, type, expires_at (from oe), quality}
D1:        shortcode, type (reel|post|carousel), media array, created_at, hit_count
R2:        bob-media, 24h lifecycle, media.bob.com custom domain
```

- **Expiry-aware:** `oe` → `parseInt(oe,16)` → Unix seconds. Video ~34h, image ~4.4d. KV TTL = min(6h, time-to-`oe`) so a stale URL never serves.
- **Delivery:** default = **Worker 302 to IG CDN** (zero egress, fastest, IG CDN handles the bytes). Fallback = Worker streams CDN → R2 (Reelkeep pinned-fetch) → `media.bob.com` with `Range` support (herascrape `/view` proves video seeking works at the edge). Carrier: **HMAC-signed claims** (`{u,f,e}` base64url+HMAC-SHA256, herascrape `token.ts` spec) — Worker only streams URLs *it* signed (open-proxy guard).
- **Queue:** Worker sync path (normalize → KV → hit?302 : `Queues.send` → 202 + `jobId`) decouples the <2s API from the 40–60s extraction. Consumer = Go extractor (semaphore, cookie-free, yt-dlp + ffmpeg + FFprobe). DLQ + exponential backoff; per-IP concurrency 1.
- **Carousel:** 1 post → N signed URLs; free = individual MP4/JPG; Premium = ZIP built at the edge (herascrape `buildStoredZip` pattern — stored, no compression, streamed).
- **Hit-rate target 30–50%** (viral reels re-download). Every 10% hit-rate gain saves ~$200/mo at 1M/day.

---

## 7. Error Taxonomy (honest failure, gentleman-style)

| Code | HTTP | Meaning | UX copy |
|---|---|---|---|
| `INVALID_URL` | 400 | Not an IG p/reel/tv link | "That doesn't look like an Instagram link." |
| `PRIVATE` | 403 | Private / unavailable while logged out | "This post is private, or Instagram blocks logged-out access." |
| `SOURCE_RATE_LIMITED` | 429 | IG throttling this egress IP | "Instagram is rate-limiting us. Try again in 60s." |
| `SOURCE_TIMEOUT` | 504 | Extraction exceeded 50s budget | "Instagram is slow right now. Try again." |
| `MEDIA_EXPIRED` | 410 | CDN `oe` passed | *(auto-retry once via L2/L3, then)* "Link expired. We re-fetched." |
| `UNSUPPORTED_MEDIA` | 422 | Photo-only / carousel-only (MVP) / manifest-only | "Photos aren't downloadable on this plan yet." (Premium/ZIP later) |
| `EXTRACTION_FAILED` | 502 | Upstream parse failure | "Instagram changed something. Our engineers have been alerted." + internal alert fired |

No 500s to users. No tracebacks, no paths, no `sessionid` in any output (Reelkeep `main()` discipline).

---

## 8. Verification Protocol (Reelkeep-grade, before any launch)

1. **Unit:** 20+ fixture URLs (reel, video post, photo post, carousel, private, malformed) → expected typed results. CI-green on every parser change.
2. **Live probe (opt-in, manual):** `live_probe <authorized URL>` fetches real bytes, FFprobe-verifies (`ftyp` + has_audio), deletes temp copy. Reelkeep ran 3 local + 2 cloud on 2026-10-28 — BOB repeats at every L1/L2/detector change.
3. **Synthetic health:** hourly probe of 3 pinned public reels through L0→L3. Alert on: L1 null-rate >20%, L2 `doc_id` 400/401, L3 429-rate >5%, FFprobe failure.
4. **Load:** 100k/day simulated against cache (no IG calls) → prove Worker/D1/KV/R2 ceiling; then 1k real IG calls → measure 429 surface.
5. **Ad audit:** one `adsbygoogle` tag per page max, below fold, reserved slot (CLS 0). Popunder/interstitial code scan in CI — fail build if present.

---

## 9. Phase-0 Extractor Build Spec (Go container)

```text
services/extractor/            # Go 1.22, single Docker image (~200MB with yt-dlp+ffmpeg)
  cmd/extractor/main.go        # HTTP server: POST /extract {url} → {media[]} | typed error
  internal/parser/             # L1: inline-JSON (ScrapFly _extract_xig_polaris_media spec)
                               # L2: GraphQL (auto doc_id, health-checked)
  internal/engine/             # L3: go:embed yt-dlp binary, extract_info(download=False)
                               # format pick: combined > AVC≤1080p; ffmpeg -c copy (file,pipe only)
                               # pinned-HTTPS fetch (Reelkeep public_addresses()+PinnedHTTPS spec)
                               # FFprobe verify (ftyp, has_audio, size≤cap)
  internal/cache/              # KV/D1 client wrapper, oe-aware TTL
  internal/proxy/              # Tier-1 IPv6 → Tier-2 sticky, semaphore, backoff
```

Resources: `standard-1` (0.5 vCPU/4GB) or Hetzner CX22. Per-job budget 55s, 50 MiB file cap (MVP; raise for Premium 500 MB). Health endpoint `/health` (ffprobe present + 3-pinned-reel probe). No cookies, no shell-from-URL, no remote URL to ffmpeg — ever.

**Worker (TypeScript)** holds everything else: Pages FE, `/api/extract`, KV/D1/Queues, HMAC signing (herascrape `verifyToken` spec), `/dl` + `/view` (Range) + `/dl/zip` edge streaming, Turnstile, DO rate buckets, 8–12 SEO pages (EN first).

---

## 10. What We Borrow, What We Reject

**Borrow:** yt-dlp's triple-fallback parser + impersonation discipline · ScrapFly's `data-sjs` walker · Reelkeep's pinned-fetch + FFprobe + format-pick + honest caps · herascrape's HMAC edge-streaming + Turnstile + Worker FE · shahzaib's config-driven resolver split · Instaloader's profile bulk (Premium, later).

**Reject:** instagrapi/private-API login path · `?__a=1&__d=dis` magic params (cookie-required, account risk) · hard-coded `doc_id` from any blog · archived/dormant scrapers · OSINT/PII tools · any "private account" claim · ad-farm frontend patterns (popups, redirects, fake download buttons).

**The BOB test:** if a repo can't pass §8's verification protocol on a public reel *today*, it doesn't touch the tree.

---

## 11. Decisions for Owner

1. **Go with this layering?** (L0 oEmbed preview → L1 inline JSON → L2 GraphQL → L3 yt-dlp/Reelkeep engine → L4 managed fallback → L5 Browser last-resort)
2. **Extractor host:** Hetzner CX22 (€3.79, recommended MVP) vs Fly.io vs Cloudflare Containers?
3. **Test URLs:** 1–2 public Instagram reels you own/are authorized to download, for the live probe?
4. **Frontend second (branches):** after the kernel verifies, Vite + pre-rendered SEO pages with the gentleman ad doctrine (1 unit, below fold)? Confirm.

---

## 12. Sources (Round 2, code-verified)

- yt-dlp `yt_dlp/extractor/instagram.py` HEAD 2026-11-04 — `doc_id=27130156389949648`, `PolarisLoggedOutDesktopWWWPostRootContentQuery`, `xig_polaris_media`, `if_not_gated_logged_out`, `video_dash_manifest`: https://github.com/yt-dlp/yt-dlp/blob/master/yt_dlp/extractor/instagram.py
- ScrapFly *5 Best Open-Source Instagram Scrapers (2026)* — Instaloader 13.1k stars v4.15.3, instagrapi fragility, `doc_id` 2–4-week rotation, logged-out 429: https://scrapfly.io/blog/posts/best-open-source-instagram-scrapers
- ScrapFly `instagram-scraper` — `data-sjs` walk, `doc_id=28904005159232689`, `web_profile_info` gating: https://github.com/scrapfly/scrapfly-scrapers/tree/main/instagram-scraper
- Reelkeep (Astro + FastAPI, anonymous yt-dlp, pinned-HTTPS, FFprobe, Oct 28 2026 verified): https://github.com/freelanceguru06-create/reelkeep-instagram-downloader
- herascrape IG downloader (Worker edge streaming, HMAC tokens, Turnstile): https://github.com/herascrape/instagram-video-downloader
- ahmedrangel/instagram-media-scraper — magic params + `doc_id=10015901848480474` (docs the rotation): https://github.com/ahmedrangel/instagram-media-scraper
- shahzaibnagi/instagram-downloader — config-driven resolver client: https://github.com/shahzaibnagi/instagram-downloader
- instaloader HEAD 2026-11-01 · instagrapi 2026-11-07 · gallery-dl 2026-10-31: https://github.com/instaloader/instaloader · https://github.com/subzeroid/instagrapi · https://github.com/mikf/gallery-dl
- Media URL expiry (video ~34h, image ~4.4d, `oe`): https://sociavault.com/blog/how-long-do-social-media-urls-last
- Gita 15.1 (ūrdhva-mūlam adhaḥ-śākham): standard translation
