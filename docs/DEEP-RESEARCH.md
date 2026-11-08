# BOB Instagram Downloader — Ultra Deep Research

**Project:** BOB = Break Ordinary Boundaries — BOB Instagram Downloader  
**Date:** 2026-11-08  
**Scope:** PUBLIC Instagram posts / Reels / IGTV / Carousels only. No private accounts, no DRM bypass, no login-wall bypass, no credential harvesting.  
**Status:** Research complete. Git initialised on `main`, no code yet.  
**Prepared by:** Drishtadyumna

> This is technical research, not legal advice. Instagram ToS and Google AdSense policies are cited throughout — they materially shape what is buildable and monetizable.

---

## 1. Executive Verdict — Read This First

### 1.1 It is buildable, but NOT as a "simple downloader"
Instagram in 2026 is actively anti-scraper. There is no stable free API. every working downloader site (SaveInsta, SnapInsta, Inflact, Instadp) runs the same pattern: **server-side extraction → short-lived CDN URLs → client**. No site uses the official Graph API for this — it is restricted to a creator's own account with Meta app review and explicitly forbids repurposing metadata for download.

**Adopted BOB approach: hybrid edge + heavy extractor.** Cloudflare Pages + Workers for frontend, API, cache, queue, and R2 delivery. A container extractor (Go + yt-dlp + ffmpeg on a Hetzner/Fly/Cloudflare Container) for the actual Instagram fetch. Workers alone cannot run yt-dlp, Python, ffmpeg, headless Chrome, or residential proxies.

### 1.2 AdSense is HIGH RISK — do not depend on it
Google Publisher Policies (verified 2026-11-08, [support.google.com/adsense/answer/10502938](https://support.google.com/adsense/answer/10502938)) ban:

> "pages that assist or enable users to **download streaming videos if prohibited by the content provider**" — under *Enabling dishonest behavior*.

Instagram's Terms prohibit automated collection without express permission, and its content is copyrighted by creators. A pure Instagram downloader is therefore structurally in the same bucket as YouTube-MP3 sites. Expect **rejection or "limited ads"**, not approval. Every competitor showing AdSense is not proof of safety — Google explicitly says other violators are not a defence.

**BOB monetization correction:** Freemium-first (free tier + Premium no-ads/bulk/API like Inflact), AdSense as optional second leg only with the full compliant posture (public-only, no storage, DMCA agent, no-login promise). Never build a business that *only* works if AdSense approves.

### 1.3 No single extraction method scales alone
- Best DIY path in 2026: **inline JSON (`data-sjs` → `xig_polaris_media` / `if_not_gated_logged_out`) + GraphQL `doc_id` fallback + yt-dlp download engine**, behind browser-like TLS (`curl_cffi`), residential/IPv6 rotation, and a 6h `shortcode` cache.
- At scale: **managed scraper API** (Bright Data ~$0.75/1k, Apify ~$1.00–$2.70/1k) as primary or fallback. Datacenter IPs are instantly blocked; one residential IP ≈ 200 req/hr.
- Media URLs expire: **video median ~34 hours, image median ~4.4 days** (`oe` param). Never store URLs long-term — store the stable `shortcode`, download within hours, re-fetch when expired.

---

## 2. Extraction Methods — What Actually Works (2025–2026)

### 2.1 Official oEmbed — preview only
- **Endpoint:** `GET https://graph.facebook.com/v27.0/instagram_oembed?url=<URL>` (legacy `instagram.com/api/v1/oembed/` deprecated; `api.instagram.com/oembed` removed 2020).
- Returns `thumbnail_url`, `author_name`, embed HTML. ~1,000 req/hr. Tokenless for public posts since June 2026.
- **Fatal limit:** Meta prohibits using oEmbed metadata "for any purpose other than providing a front-end view" — i.e. not for extraction. No `video_url`, no carousel children, no quality variants, no Stories. **Use for thumbnails/preview in MVP only.**

### 2.2 Inline JSON in public page HTML (`data-sjs`) — ⭐ best current DIY path
- Fetch `https://www.instagram.com/p/{shortcode}/` or `/reel/{shortcode}/` logged-out. HTML contains `<script type="application/json" data-sjs>` with `xig_polaris_media` (single post) and `xig_user_by_username` (profile); logged-out posts nest under `if_not_gated_logged_out`.
- Reference parser: `scrapfly/scrapfly-scrapers` Instagram scraper regex-extracts `data-sjs`, walks the `require` structure, returns the payload.
- OG tags alone give `og:image`/`og:video` subset but **not** carousel children or DASH variants.
- **Requirements:** `curl_cffi` Chrome impersonation (plain `requests` gets a gutted payload — verified 2026-09-23), residential proxy, cache. Parser breaks when Instagram renames keys — budget weekly maintenance + field-level alerting (null-rate per field, not just HTTP status). Silent breaks are normal: public GraphQL broke 2026-06-29; `web_profile_info` gating forced migration 2026-07-30.

### 2.3 GraphQL persisted query (`doc_id`) — fallback / DASH quality
- `POST https://www.instagram.com/graphql/query` with `doc_id` + `variables`. Single post uses `doc_id=8845758582119845` + `variables={"shortcode":"...}` → `data.xdt_shortcode_media.video_url` + `video_dash_manifest`. Feed path uses a different `doc_id`. Mobile variant `GET /api/v1/media/{pk}/info/` returns DASH MPD.
- **Cons:** `doc_id` rotates unpredictably, must re-discover (DevTools Network). Needs `x-ig-app-id`, referral headers, TLS impersonation. Partial silent failures (null view counts). Lower stability than inline JSON.

### 2.4 yt-dlp Instagram extractor — download engine
- Free, Python `pip install yt-dlp`, 1700+ sites incl. Instagram. Handles DASH stitching, separate video/audio merge via FFmpeg, format selection `-f bv+ba`, `-j` metadata-only. Auto-updates (`yt-dlp -U`).
- **2026 reality:** anonymous public extraction increasingly fails without cookies (login wall); cookies raise account-ban risk. Instagram user extraction is listed as broken in upstream supported-sites. Rate-limit block is 24h+ per IP. **Needs proxy rotation** (`--proxy`), `--sleep-requests` delays, and an FFmpeg binary.
- **BOB role:** not the fetcher — the **downloader**. Go binary embeds yt-dlp, pipes `--newline --progress` output, merges to MP4, streams to R2.

### 2.5 gallery-dl · Instaloader · instagrapi
| Tool | Role | Verdict for BOB |
|---|---|---|
| gallery-dl (`gallery_dl/extractor/instagram.py`, ~20k stars) | Gallery bulk, archive DB | Same endpoints as yt-dlp; useful fallback, single-maintainer risk |
| Instaloader (v4.16, MIT) | Profile bulk crawl, best metadata fidelity | Archival jobs, not a single-URL API; 429-prone; needs login for full fidelity |
| instagrapi (7.1k stars, private mobile API) | Full API incl. media_info, stories | **NOT core** — requires account login; "anonymous paths opportunistic, not guaranteed"; ban/challenge-prone; ToS violation. Optional opt-in logged-in enhancement only |

### 2.6 Headless browser (Playwright / Puppeteer)
- Real browser TLS/canvas passes blocks that flagged `requests`. Handles JS-rendered flows (comments pagination).
- **Cons:** 200–500 MB RAM per browser, 5–10 s/page, headless mode trips anti-bot. Scaling is expensive. **Use as last-resort fallback only.** Cloudflare Browser Run is an alternative ($0.09/browser-hr, 10 concurrent, datacenter IP — IG bot-wall risk), capped ~7,200 sessions/hr/account.

### 2.7 Managed APIs — the scale answer
| Vendor | Price / 1k posts | Success |
|---|---|---|
| Bright Data Instagram Scraper API | **$0.75** pay-per-success, 7 endpoints, 400M+ residential IPs | ~98.9% (benchmark) |
| Apify `instagram-post-scraper` | $1.00 pay-per-event ($2.70 free) | ~100% runs |
| Zyte / Decodo / ScrapingBee | $0.88–$1.01 | 87–99% |

Pros: zero maintenance, proxy/TLS/rotation/CAPTCHA handled, structured JSON incl. `childPosts`, play counts, music info. Cons: cost, vendor lock-in, latency. **BOB plan: DIY inline-JSON for MVP, managed API as Tier-1 fallback when Instagram breaks or traffic spikes.**

### 2.8 How top sites actually work (SaveInsta, SnapInsta, Instadp, Inflact)
All confirmed to the same high-level pattern: **user pastes URL → backend fetcher (yt-dlp/gallery-dl-class worker or managed scraper + residential proxy + queue) → signed CDN URLs returned to browser. No evidence any uses official Graph API.** SaveInsta's stated policy: "never stores, hosts, or republishes… fetched live on demand from Instagram's CDN and discarded."

---

## 3. Media URLs — Expiry, Quality, Carousels

```text
Instagram CDN: scontent.*.cdninstagram.com / fbcdn.net
Signed params:  stp=dst-jpg|dst-mp4 · efg=eyJ... · _nc_ht · oh (signature) · oe (expiry, hex Unix)
```

- **Expiry (measured 460k links, Oct 2026):** video median **34h** (32h–4.5d), image median **4.4 days**. Read via `parseInt(oe,16)`. Changing one char breaks the signature — no way to extend.
- **Images:** `displayUrl` 1080px + `image_versions2.candidates` multiple resolutions.
- **Videos/Reels:** `video_url` = progressive MP4 baseline (e.g. 720p `video_dashinit.mp4`); `video_dash_manifest` MPD = 360p/720p Representations + audio `mp4a.40.5`. `product_type:"clips"`, play/view counts.
- **Carousels:** `childPosts[]` / `edge_sidecar_to_children` — each child has its own `displayUrl`/`videoUrl`. BOB stores N media per `shortcode`, offers carousel-as-ZIP (Premium).
- **Operational rule:** store `shortcode` (stable), never media URL; download within 34h (video) / 4.4d (image); re-fetch for fresh `oe`; R2 lifecycle 24h.

---

## 4. Anti-Bot Reality — Why Naive Builds Die

Multi-layer stack, in order:

1. **IP quality** — datacenter ASN (AWS/GCP/DO) blocked on *first* request. Residential required. ~200 req/hr/IP → ~4,800/day/IP.
2. **TLS fingerprint** — `requests`/`httpx` flagged instantly; `curl_cffi` impersonation required.
3. **Browser fingerprint** — HTTP/2 frame order, header order, canvas/WebGL.
4. **Rate limit** — ~200/hr per anonymous IP → 429 → hours–days block → permanent ban for repeats.
5. **Login wall / challenge** — `400` "make sure you are logged in", `401 require_login`, checkpoint, CAPTCHA.

**Proxies:**

| Tier | Trust | Arg | Cost |
|---|---|---|---|
| IPv6 /64 rotation (Hetzner/Fly) | Low–mid | Free | ~70% of public reels |
| Residential sticky | High | ~300*/hr/IP | $1–3/GB |
| Mobile 4G/5G | Highest | ~300/hr/IP | $60–120/mo/IP — overkill unless 1M+/day |

Sticky 5–10 min per IP, rotate on 429/403, exponential backoff 2→4→8→16s. **Never rotate mid-challenge** (instagrapi best practice).

**Without login works:** oEmbed thumbnail, public `data-sjs` single post (increasingly gated), GraphQL `doc_id` sometimes. **Needs cookies:** current stories, search/hashtag browse, follower lists, full comments, mobile media-info fast path. Structural limits regardless: private accounts off-limits, native hashtag browse removed from logged-out 2024.

---

## 5. Architecture — The Deep System (BOB Hybrid Topology)

### 5.1 Why pure Cloudflare Workers fail for extraction

| Work | Worker? | Why |
|---|---|---|
| URL normalize, dedupe, cache lookup, rate-limit, AdSense frontend | ✅ ideal | <10 ms CPU, unlimited HTTP wall time |
| Light fetch `instagram.com/p/.../embed/` → parse `og:video`/JSON | ✅ for public posts | 2–5 s wall, <30 ms CPU, no JS |
| Pipe IG CDN → client/R2 via `TransformStream` | ✅ | No buffering, 128 MB safe if streamed |
| yt-dlp (Python, subprocess, `curl-cffi`, ffmpeg merge, cookies) | ❌ | No subprocess/filesystem/Python/natives, 10 MB script cap |
| Headless Chrome at scale | ⚠️ technically | Browser Run: 10 concurrent paid, $0.09/browser-hr, datacenter IP |
| Residential proxy rotation, sticky IG cookies | ❌ | Worker egress = Cloudflare datacenter range, shared, IG-flagged |
| ffmpeg remux, thumbnails | ❌ | Needs container/VM |

**Workers core limits (2025–2026):** Paid ($5/mo) 10M req/mo +$0.30/M, CPU **30 s default / 300 s opt-in** (5 min, Mar 2025), 128 MB isolate, **10,000 subrequests/invocation default (Feb 2026)**, wall time unlimited while client connected. Free: 100k req/day, 10 ms CPU. CPU time = active execution only — `await fetch()`/KV/D1 waits don't count. (Sources in §12.)

### 5.2 Recommended topology

```text
Browser → Cloudflare Pages (Vite static, free unlimited bandwidth)
          /tool SPA + /instagram-*-downloader SEO HTML + AdSense + Turnstile
               │ fetch /api/extract?url=
          Worker API (Paid $5)
            • Normalize URL → shortcode
            • KV get media:{id} → hit? 302 to R2/CDN
            • miss? D1 check → Queues.send(job) → 202 jobId
            • Rate limit (DO token bucket), Turnstile verify, WAF
            • Stream/302 R2 public URL, Cache-Control
        ┌───────┼──────────────────┬──────────────────┐
        KV       D1                 Queues           R2
     (hot cache) (dedupe/meta)     (async jobs)    (bytes, 24h TTL)
        └──────────────────┬──────────────────┤
                    Extractor Tier (pick one):
                    A) Cloudflare Containers (standard-1, Go+yt-dlp+ffmpeg)
                    B) Fly.io / Hetzner (IPv6 rotation + residential gateway)
                    Go orchestrator: semaphore, cookie pool, --sleep-requests
                    Pipe: yt-dlp stdout → ffmpeg (merge) → R2 PutObject
                              │
                        R2 bob-media → media.bob.com → User (free egress)
```

### 5.3 Component stack

| Component | Choice | Limits / pricing |
|---|---|---|
| Frontend | **Vite + React**, pre-rendered SEO HTML (or Astro), Tailwind | Pages free unlimited static, 500 builds/mo |
| API/edge | Cloudflare Worker (TypeScript) | $5 + 10M req $0.30/M + 30M CPU-ms $0.02/M |
| Hot cache | KV — `media:{shortcode}` 6h TTL | 10M reads $0.50/M, 1M writes $5/M, 1 GB +$0.50/GB |
| DB | D1 — dedupe, job history, analytics | 25B rows read incl, 50M written $1/M, 5 GB $0.75/GB |
| Queue | Cloudflare Queues | 1M ops/mo +$0.40/M; DLQ + backoff |
| Object store | **R2** (egress free) — 24h lifecycle | $0.015/GB-mo, $4.50/M Class A, $0.36/M Class B |
| Extractor | **Go 1.22** + embedded yt-dlp binary + ffmpeg 6 | Containers std-1 (0.5 vCPU/4 GB); Fly perf-1x $33/mo; Hetzner CX22 €3.79/mo |
| Rate limit | Durable Object token bucket + CF Rate Limiting Rules | DO 1M req $0.15/M |
| Proxies | Tier-1 IPv6 + Tier-2 sticky residential | $0 / $500–2,000 at scale |
| Analytics | Cloudflare Web Analytics (free) + D1 events | — |

**Language verdict: Go for the extractor** — 15 MB binary, ~30 MB RAM (vs Node 100 MB+), goroutine-per-job, `go:embed` yt-dlp, stdout→ffmpeg→R2 streaming. Node + yt-dlp sidecar proven (111k-request community rig) but 2–3× memory. Python only if Instaloader/gallery-dl features needed (GIL → process pool).

**Frontend verdict: Vite pre-rendered, not bare Vite SPA, not Next.js.** Vanilla Vite SPA ships an empty `<div>` shell (3–5× slower crawl, no server HTML). Next.js SSR is overkill — the tool is client-driven, SEO pages are static. **Vite + pre-rendered SEO HTML (or Astro islands)** wins: LCP <2.5s, CLS <0.1, INP <200ms, TTFB <100ms globally on Pages.

### 5.4 Scaling patterns
- **URL normalization:** strip `?utm_*`, `?igshid=*`, `?img_index=*`, trailing `/`; `m.instagram.com`→`www`, `/reels/`→`/reel/`; key = `ig:{shortcode}`.
- **3-tier cache:** CDN/Cache API (60s JSON) → KV (6h media) → D1 (source of truth). Target 30–50% hit rate — viral reels are re-downloaded constantly. Every 10% cache hit saves ~$200/mo at 1M/day.
- **Direct CDN vs R2 store:** prefer **direct IG CDN 302** (zero egress, fastest, expires in hours — risk: expired before click). **R2 store** as fallback (own domain, Range support, no expiry; Class A $4.50/M puts). Never proxy bytes through Worker except streaming `new Response(upstream.body)`.
- **Queue decoupling:** Worker sync <2s (normalize→KV→hit?302 : `send`→202 jobId); consumer extracts→R2→D1→KV→DO notify. Cloudflare Queues to 1M/day; Redis/BullMQ beyond (priority, delayed retry, per-IP fairness).
- **Abuse guards:** Turnstile on submit, DO token bucket (10 extracts/hr anon, 100/hr post-Turnstile), per-IP concurrency 1, global semaphore 20–50, private/stories/bulk-profile → 403 without attempting.

### 5.5 Extractor host comparison

| Option | Cost | Scale | yt-dlp fit |
|---|---|---|---|
| Hetzner CX22 2vCPU/4GB/20TB | **€3.79/mo** | Manual, EU-only | Excellent — free IPv6 /64 rotation |
| Fly.io shared-1x 256MB $2.19/mo → perf-1x 2GB $33/mo | Per-second, scale-to-zero, Anycast | Best PaaS for bursty extraction |
| Cloud Run | Free 180k vCPU-s/mo, then $0.000024/vCPU-s | 0→100s instances | Best serverless container |
| Render / Railway | $7–$25/mo flat / usage-based | Idle waste | OK |
| Vercel | 25s streaming cap, no subprocess/fs | ❌ unsuitable for extractor |

**Containers (Cloudflare, 2025–2026):** `standard-1` (0.5 vCPU/4 GB) runs Go+yt-dlp+ffmpeg; account limits 1,500 vCPU/6 TiB RAM concurrent; inside $5 Paid incl 25 GiB-hrs/mo, then ~$0.072/vCPU-hr, egress $0.025/GB NA/EU. Scale-to-zero + sleep. **BOB Phase-0 pick: Hetzner CX22 (€3.79) — cheapest always-on extractor at 0–100k/day; migrate to Containers/Fly when multi-region matters.**

### 5.6 Cost at scale (from architecture model)

| Volume | Extractors | Infra total |
|---|---|---|
| 1k/day (MVP) | 1× Hetzner CX22 | **~$4–9/mo** |
| 100k/day (3M/mo) | 3× Hetzner CX42 or 5× Fly + 1 perf | **$120–350/mo** + ~$150 proxies |
| 1M/day (30M/mo) | Cloud Run 0→200 (~$1,290) or 3× Hetzner CX52 (~$105) + Fly overflow | **$1,800–3,500/mo** (proxies dominate: $1–2k) |

R2's free egress saves ~$3,600/mo vs S3 at 1M/day. Hyperdrive: skip until D1 >100–200 writes/s.

---

## 6. Competitors — Matrix & How BOB Beats Them

| Site | Reel/Post/Story | Premium | Monetization | Key weakness |
|---|---|---|---|---|
| SaveInsta | ✅ all, HD/4K claim | ❌ "free forever" | AdSense + popups/redirects | Slow/flaky at peak, ad-heavy |
| SnapInsta | ✅ all + HD MP4, no login | ❌ | AdSense | Intermittent failures, ads |
| Instadp | ✅ reels/stories/PFP, mobile | ❌ | Display ads | Thin content |
| SaveIG | ✅ 4K, Android app, 25 languages | ❌ | Display ads + app funnel | Claims "private account" download — trust red flag |
| Inflact | ✅ bulk profile ZIP, API, extension | ✅ $22–$79/mo | **Subscriptions only** | Higher price, no free bulk |

**BOB differentiators (all compliance-safe):**
1. **Speed + graceful failure** — edge cache + CDN-direct streaming; clear "try again" when Instagram shifts endpoints.
2. **Clean UX** — one result area, no fake "Download" ad buttons, ads ≥1 viewport from the button (also what AdSense's deceptive-implementation policy requires).
3. **Real content SEO** — genuinely helpful guides (own-content backup, copyright-respectful use, iPhone Safari steps) instead of doorway spam.
4. **Explicit public-only trust** — "We never ask for your Instagram login. Files stream directly, nothing stored." Never offer "private account" download: any site claiming it either wants credentials (phishing) or can't deliver.
5. **Durable brand** — single canonical domain + PWA + extension. Competitor domains churn constantly (.app/.to mirrors); SnapInsta-class traffic is ~80% direct/type-in — brand search is the moat.

---

## 7. AdSense Policy — Verified 2026-11-08

### 7.1 The banning text (primary source, fetched today)
Google Publisher Policies → *Enabling dishonest behavior*:

> "We do not allow content that: promotes any form of hacking or cracking and/or provides users with instructions, equipment, or software that tampers with or provides unauthorized access to devices, software, servers, or websites. Examples: … products or services that bypass copyright protection, including circumvention of digital rights management technologies; … **pages that assist or enable users to download streaming videos if prohibited by the content provider**" — [support.google.com/adsense/answer/10502938](https://support.google.com/adsense/answer/10502938)

Google Advertising Policies (Copyrights) also ban "unauthorized sites or software that capture, copy, or provide access to copyrighted content," explicitly including music and works by independent creators.

### 7.2 Why it applies here
1. Instagram content is copyrighted by creators; posting copyrighted material without permission is prohibited on Instagram.
2. Instagram Terms of Use §4.2: "You can't … attempt to create accounts or access or collect information in an automated way without our express permission." Every downloader works by automated fetching of Instagram's CDN without permission.
3. AdSense Product-team precedent (Facebook video downloader question): *"Your site is trying to promote illegal downloads (ie from YouTube or Facebook etc). So of course it won't be approved for Adsense."*
4. YouTube-MP3 precedent: Google C&D + server block (2012), permanent injunction (2017), Search delisting + AdSense suspension (MP3.to, 2024). Third parties actively file complaints hitting **Search and AdSense together**.
5. Limited-ads enforcement: borderline pages get ad serving throttled to near-zero RPM *before* human review. Rejection is usually "copyrighted content / IP abuse" with no appeal path for a pure downloader.

### 7.3 If you still apply — the only compliant posture
- **Public-only, no credentials. Never ask for Instagram login.** State it in the UI.
- **No storage, no hosting.** Stream from Instagram CDN to the user, discard immediately (SaveInsta's exact stated posture). This is the §512(d) conduit posture, not pirated hosting.
- **DMCA designated agent** registered with the U.S. Copyright Office + published contact + expeditious takedown + repeat-infringer policy.
- **Privacy / Terms / DMCA / Disclaimer** on every page; "not affiliated with Instagram/Meta; copyright remains with creators; personal backup only."
- **No "DRM removal / ripper" claims.** Advertise "save the public file Instagram already serves, at its original resolution."
- **Never "remove watermark"** — Instagram does not watermark; marketing it as circumvention invites a claim you don't need.

Even with all of the above, **expect a high probability of rejection** because the core service still enables ToS-prohibited automated collection. This is a policy prediction, not legal advice. **Do not** cloak, obfuscate ad code, or evade policy.

### 7.4 Legal posture (not legal advice)
- Instagram ToS (§4.2) + Meta Automated Data Collection Terms require express written permission — which downloader sites do not have.
- US case law is narrowly favourable for *public, logged-off* scraping (*hiQ v LinkedIn* 2022, *Van Buren* 2021, *Meta v Bright Data* Jan 2024) but does not bless private/login-wall scraping and does not override contractual ToS or Google policy claims.
- Privacy: GDPR Art. 6 lawful basis + CCPA duties; public visibility ≠ exemption. Copyright: storing media risks creator-rights infringement — limit to on-demand fetch, short retention, takedown honoured.
- **BOB guardrails baked into design:** public-only (incognito-testable), never solve CAPTCHAs or bypass checkpoints, short retention (store shortcode, 24h R2 lifecycle), DMCA page from day one.

---

## 8. SEO — Keyword Map & Page Architecture

### 8.1 Volume landscape (2025 data, US/global mix)

| Keyword | Monthly vol | Difficulty | BOB page |
|---|---|---|---|
| `instagram reel downloader` | 201,000 | 70 Hard | ⭐ money keyword |
| `instagram video download` | 201,000 | 79 Very Hard | dedicated page |
| `instagram story downloader` | 201,000 | 71 Hard | dedicated page |
| `instagram reels download` | 60,500 | 69 Hard | same reel page (semantic) |
| `instagram reel download` | 40,500 | 62 Hard | same reel page |
| `instagram post downloader` | 27,100 | 75 Hard | photo/carousel page |
| `instagram download` | 301,000 | 93 Very Hard | **do not target** head term |
| `instagram downloader` (generic) | 500K+ combined | 90+ | do not target month 1 |

Win the **tool + content-type intersections**, one dedicated page each.

### 8.2 Programmatic architecture (8–12 quality pages, not 500 thin pages)

```text
/                                (home: Video + Photo Downloader)
/instagram-reels-downloader/
/instagram-video-downloader/
/instagram-photo-downloader/
/instagram-carousel-downloader/
/instagram-story-downloader/
/instagram-profile-picture-downloader/
/instagram-igtv-downloader/
/how-to-download-instagram-videos/   (guide hub)
/how-to-save-instagram-stories/
/instagram-download-copyright/
/about/ /privacy/ /terms/ /dmca/ /contact/
```

Each tool page: unique H1 + hero copy + 3-step instructions + 6–8 *non-duplicated* FAQs, HowTo + FAQPage + WebSite JSON-LD, self-canonical, one H1, real "Copy link" screenshots (never competitor assets).

### 8.3 i18n plan
Start EN (US). Add ES → PT-BR → ID → HI → AR → FR → DE (highest Instagram-downloader demand) via `/es/...`, `/pt-br/...` subfolders with **real translated content**, per-language canonical, `hreflang` + `x-default`, sitemap with `xhtml:link`. Launch 1 language, prove indexing + downloads, then add the next weekly. Never 50 at once.

### 8.4 Technical requirements
- LCP <2.5s, CLS <0.1, INP <200ms on mid-tier mobile; tool box interactive <1s; fixed-aspect preview (no layout shift).
- No ads adjacent to the download button (deceptive-implementation policy); label ad units; keep ≥1 viewport separation.
- Mobile-first + PWA (retention beats one-off visits).
- Trust signals on every footer: Privacy/Terms/DMCA/About/Contact + "We never ask for your login" near the input.
- IndexNow ping on tool-page updates; per-locale sitemap in Search Console; monitor Core Web Vitals per locale.

---

## 9. Business Model — Freemium-First

### 9.1 What AdSense would pay (benchmarks)
Tech/utilities with mixed global traffic (US 20–30%): **$1.50–$3.50 blended RPM** at 1.8 pages/session, 3 ad units/page. US tech ~$8 RPM; India/SEA 10–20% of that ($0.8–$1.6).  
`100k visitors/mo × 1.8 pages × $2.50/1k ≈ $450/mo` gross — **if** ads serve at all. **Don't build a model that only works with AdSense.**

### 9.2 Recommended model (Inflact-proven)
- **Free:** 3 downloads/day, 1080p, single file, ads *below* the tool.
- **Premium $4.99/mo ($39/yr):** no ads, unlimited, carousel-as-ZIP, profile bulk (≤500 posts), priority processing, Chrome extension.
- **API $49–$99/mo:** keyed bulk-profile endpoint (Inflact sells $9/10 → $99/unlimited bulk profiles).
- Justification: immune to AdSense rejection; LTV follows the creator/marketer segment that actually pays; no-ads removes deceptive-implementation risk. 2–5 premium conversions ≈ AdSense revenue of 100k visits.
- **Secondary (if AdSense rejects):** direct affiliate (VPN, backup/creator tools), donations (Ko-fi / Buy Me a Coffee). **Never** pop-under/traffic-pop networks (policy violation + trust destruction).

---

## 10. Roadmap

### Phase 0 — MVP (Week 1–2, ~$4–9/mo)
Pages + Worker Free + KV Free + R2 Free. 1× Hetzner CX22 (Go + yt-dlp + ffmpeg), single cookie, no Queue (Worker→extractor HTTP). oEmbed preview + inline-JSON extractor + GraphQL fallback. Goal: prove public-reel parsing on real URLs.

### Phase 1 — Launch scale (100k/day, $120–350/mo)
Workers Paid $5, KV/D1/Queues/R2 paid. 30% cache hit. 3× Hetzner CX42 or Fly fleet. `--sleep-requests 2`, 5-account cookie pool. SEO pages live (8–12). Premium tier + Stripe. Managed-API fallback switch.

### Phase 2 — 1M/day ($1,800–3,500/mo)
Cloud Run autoscale or Hetzner CX52 fleet + Fly overflow. 40% cache hit. Residential proxy tier. Multi-region extractors (iad/fra/sin). Browser Run fallback 1%. Hyperdrive only if D1 >200 writes/s.

### Maintenance budget (every phase)
~2–4 h/week watching `data-sjs`/`doc_id` changes; field-level null-rate alerts; yt-dlp nightly update; DMCA inbox SLA. **This is not set-and-forget.**

---

## 11. Risks & Open Decisions

| Risk | Severity | Mitigation |
|---|---|---|
| AdSense rejection / limited ads | **High** | Freemium-first revenue; compliant posture; never depend on AdSense |
| Instagram extractor break | **High** | Multi-tier fallbacks (inline JSON → GraphQL → managed API) + graceful UX |
| Meta / creator DMCA·ToS complaint | Medium–High | DMCA agent, no-storage design, public-only, takedown SLA |
| Credential-harvesting demand ("private accounts") | Medium | Never fulfil; educate ("any site claiming it wants your password") |
| RPM seasonality (Q1 dip) | Medium | Annual plans, API tier, affiliate offers |

**Decisions needed from owner:**
1. Extractor host for MVP: **Hetzner CX22 (recommended, €3.79)** vs Fly.io vs Cloudflare Containers?
2. Revenue order: confirm **freemium-first** (AdSense optional), or still attempt AdSense-led launch knowing the risk?
3. Test data: provide 1–2 public Instagram URLs to validate the extractor in Phase 0?
4. Domain + brand assets for BOB (logo, domain, social handles)?
5. Scaffold now? Say the word and Phase-0 repo structure + first commit lands next.

---

## 12. Primary Sources

**Extraction & media**
- How to scrape Instagram (2026, ScrapFly — inline JSON, GraphQL, TLS, rate limits, residential): https://scrapfly.io/blog/posts/how-to-scrape-instagram
- yt-dlp Instagram issue #11151 (GraphQL `doc_id=8845758582119845`, DASH, login wall): https://github.com/yt-dlp/yt-dlp/issues/11151
- yt-dlp GitHub + PyPI: https://github.com/yt-dlp/yt-dlp · https://pypi.org/project/yt-dlp/
- ScrapFly Instagram scraper repo: https://github.com/scrapfly/scrapfly-scrapers/tree/main/instagram-scraper
- gallery-dl: https://github.com/mikf/gallery-dl · Instaloader: https://instaloader.github.io/ · instagrapi: https://github.com/subzeroid/instagrapi
- Instagram oEmbed (official): https://developers.facebook.com/documentation/instagram-platform/oembed
- Media URL expiry study (median 34h video / 4.4d image, `oe` param): https://sociavault.com/blog/how-long-do-social-media-urls-last
- Apify Instagram post scraper: https://apify.com/apify/instagram-post-scraper
- Bright Data best Instagram scrapers (pricing/success benchmarks): https://brightdata.com/blog/web-data/best-instagram-scrapers
- Instagram-scraper ToS guide (2026): https://instagramscraperapi.com/blog/instagram-terms-of-service-scraping
- Is scraping Instagram legal (hiQ/Van Buren/Meta v Bright Data, GDPR/CCPA): https://thunderbit.com/blog/is-scraping-instagram-legal

**Workers / infra**
- Workers limits & pricing: https://developers.cloudflare.com/workers/platform/limits/ · https://developers.cloudflare.com/workers/platform/pricing/
- 5-min CPU (Mar 2025): https://developers.cloudflare.com/changelog/2025-03-25-higher-cpu-limits/
- 10k subrequests (Feb 2026): https://developers.cloudflare.com/changelog/post/2026-02-11-subrequests-limit/
- Browser Run pricing: https://developers.cloudflare.com/changelog/post/2025-07-28-br-pricing/
- Containers pricing/limits: https://developers.cloudflare.com/containers/pricing/ · https://developers.cloudflare.com/containers/platform/limits/
- KV / D1 / R2 / Queues / Hyperdrive / Pages pricing: developers.cloudflare.com {kv,d1,r2,queues,hyperdrive,pages}/platform/pricing
- yt-dlp Instagram guide: https://ytdlp.org/guides/yt-dlp-for-instagram · yt-dlp 429 errors: https://yt-dlp.net/errors/http-error-429-too-many-requests
- Scale proof (111k-request yt-dlp rig): https://www.reddit.com/r/youtubedl/comments/1rbihik/scaling_ytdlp_to_100k_requests_my_architecture
- Go `go:embed` yt-dlp pattern: https://github.com/anharfhdn/ytdlp-desktop
- Fly.io pricing: https://fly.io/pricing/ · Cloud Run pricing: https://cloud.google.com/run/pricing
- Vite vs Next.js SEO: https://strapi.io/blog/vite-vs-nextjs-2025-developer-framework-comparison · https://blog.cloudflare.com/vinext

**AdSense / policy (verified fetch 2026-11-08)**
- Google Publisher Policies — "download streaming videos if prohibited": https://support.google.com/adsense/answer/10502938
- Google Advertising Policies (Copyrights): https://support.google.com/adspolicy/answer/6018015
- AdSense program policies (deceptive implementation): https://support.google.com/publisherpolicies/answer/48182
- Facebook video downloader precedent: https://support.google.com/adsense/thread/62761254
- YouTube-MP3 C&D (2012): https://9to5google.com/2012/06/19/report-google-warns-legal-action-against-youtube-mp3-org-blocks-websites-access-to-youtube
- YouTube-to-MP3 injunction (2017): https://news.bloomberglaw.com/ip-law/youtube-to-mp3-site-gives-in-to-music-labels-copyright-lawsuit
- MP3.to delisting + AdSense suspension (2024): https://completemusicupdate.com/yout-owner-forces-u-turn-on-record-industrys-attempt-to-delist-mp3-conversion-site-from-googles-search-results
- DMCA §512 designated agent requirement: https://www.copyright.gov/512/
- Instagram copyright help: https://help.instagram.com/650723219466129 · Instagram Terms: https://www.instagram.com/legal/terms

**Competitors / SEO / business**
- SaveInsta (no-storage posture): https://saveinsta.dev/about · SnapInsta: https://snapinsta.in/ · Inflact pricing: https://inflact.com/pricing · Inflact bulk: https://inflact.com/blog/premium-instagram-downloader/
- SaveIG (private-account red flag): https://saveig.in/
- Keyword volumes/difficulty: https://resources.clicks.so/popular-keywords/instagram-keywords
- AdSense RPM benchmarks: https://www.launchory.app/tools/adsense-revenue-calculator · https://theprtech.in/how-much-does-google-pay-for-blogs-adsense-rpm-real-rates-and-2025-payout-math
- Core Web Vitals: https://web.dev/vitals-tools · Multilingual SEO / hreflang: https://better-i18n.com/en/blog/foreign-language-search-engine-optimization
