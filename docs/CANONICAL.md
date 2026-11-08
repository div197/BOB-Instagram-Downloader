# CANONICAL — Instagram Khush, User Khush, System Khush

**Final state (2026-11-08): Cloudflare-pure, no cache, no extension, no wrangler locally.**  
Superseded decisions archived in `docs/archive/` (history). Canonical engineering: `docs/REVERSE-ENGINEERING-DEEP.md`.

## 1. Tarika — teeno khushkaun

| Party | Khushi | Tareeka |
|---|---|---|
| **Instagram** (Meta) | Public creator content, no private chori, no login impersonation, no hammering | Public `data-sjs` only (what logged-out browser already sees), 1 fetch/shortcode, **429 → Retry-After + stop** (no retry storm, no CAPTCHA solve, no proxy farm), no storing/republishing, DMCA-ready notice on site |
| **User** | 1 paste → preview <1s → HD download → WhatsApp share, no install, no login | Pages + Worker edge, direct CDN `<a download>` / Web Share API, honest errors (`PRIVATE`, `RATE_LIMITED`, `EXTRACTION_FAILED`) |
| **System (BOB)** | ~$0/mo, no store to breach, no extension to maintain | Pages static ∞ + Worker per-request parse (stateless, no KV/D1/R2, no cron). **No cache by owner choice** — accepted cost: repeat shortcodes pay 1 fetch each |

**Nishkaam maryada:** satya (honest errors, honest quality "480p source" jab 480p hai), sampurna (har gate green, chhupa FAIL nahi), purna (no cache, no extension — koi adhoora Shiva/Go trunk nahi).

## 2. Relay module order — auto-update protocol (Instagram 2–4 hafte badalta hai)

Instagram ka `data-sjs` blob har Relay deploy par modules shuffle kar sakta hai. Strict path `require[0][3][0]` tootega. **BOB har 2–4 hafte manually nahi sudharta — ye 3 layers ka kaam hai:**

```text
1. Strict walk     → fast path (current layout)          — 12/13 tests lock
2. Deep walk       → recursive signature search           — shuffle-proof (fallback test: wrapped payload)
3. CI drift gate   → test fixture shuffle                               — push par red = patch before deploy
                   + health probe (L1 null-rate)          — hourly cron (GitHub Actions)
```

**No `doc_id`, no login, no cookies** — logged-out `data-sjs` is the survivor path (ScrapFly 2026: `web_profile_info` now 400-gated; `data-sjs` is not). If IG ever gates `data-sjs` itself, the honest answer is an error message, not circumvention.

## 3. Stack (sirf Cloudflare)

```text
Cloudflare Pages (static)     → HTML/JS + SEO + AdSense (below tool)
Cloudflare Worker (edge)      → GET instagram.com/p/{code}/ → data-sjs → BOBMedia JSON
  No KV · No D1 · No R2 · No Queues · No Cron      (stateless, per-request)
R2 (optional, public bucket)  → optional media index only — not used by default
Go / Hetzner / Cloud Run / Telegram bot / extension   → ARCHIVED (see docs/archive/)
```

Deploy: Pages ← `apps/web/dist`; Worker ← `edge/orchestrator.ts` (`wrangler deploy` only when deploying — local dev is Node tests, no wrangler).

## 4. Tests (local first, no wrangler)

```bash
.venv/bin/python -m pytest tests/ -q                                    # 8 passed
./node_modules/.bin/tsc -p packages/extractor/tsconfig.json
node --test packages/extractor/test/*.test.mjs                          # 5 passed
cd apps/web && ../../node_modules/.bin/vite build
```

Live proof scope: 4 owner reels (downloaded, FFprobe-verified, deleted after verify) + synthetic photo/carousel fixtures. **Photo/carousel live URLs pending** — owner to share 1 link each for the falsification probe.
