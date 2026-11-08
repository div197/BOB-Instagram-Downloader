# GENUINE AUDIT — Kya Saccha, Kya Fake (2026-11-08)

**Sawaal (owner):** "Review how genuine, confirm what we have done which no one has done, and what is clearly fake."

## 1. Saccha — Jo humne kiya, kisi clone ne nahi kiya

| # | Genuine contribution | Proof |
|---|---|---|
| 1 | **dual-walk signature parser** — strict `data-sjs` → recursive `xig_polaris_media` search; Relay module shuffle ko survival proof | Python 8/8 + TS 5/5, shuffle-fallback test green |
| 2 | **3 shapes live-verified, 6 posts** — 4 reels (720p + DASH), 1 carousel (8 children mix), 1 photo (1440×1450 JPEG) | `LIVE-PROOF` + `BATCH-PROOF` + `CAROUSEL-PROOF` + `PHOTO-PROOF` (byte-verified, FFprobe) |
| 3 | **No-cache, no-extension, no-server** — BOB kabhi Instagram ko fetch nahi karta, User IP hi game hai | `NO-WORKERS-USER-IP.md` + bookmarklet + upload lane |
| 4 | **Lossless delivery** — progressive 720p + DASH ladder, har quality honest (480p source ko 480p bola, 1080p tak promote nahi) | 4 reels ke `number_of_qualities` + DASH repr |
| 5 | **Honest errors** — `PRIVATE / SOURCE_RATE_LIMITED / EXTRACTION_FAILED` — 500 nahi, jhooth nahi | `services/extractor/errors.py` + edge tests |
| 6 | **Zero-cost stack** — Pages static ∞ free + bookmarklet (install zero), domain + $5 Chrome (if listed) hi recurring | `docs/README` cost table (verified 2026) |

## 2. Fake / Overclaim — Jo ab workspace me NAHI hai (or we still must not repeat)

| Claim | Sach | Status |
|---|---|---|
| "Ultra-scalable, infinite users" (Worker shape) | No-cache Worker = datacenter IP = **429 storm** at >500/day. Scalable nahi hai — **user-IP lane** se scale milta hai (per-browser quota) | **REMOVED** — README/CANONICAL Workers references updated |
| "Never 429" | **Impossible** — Instagram can always rate-limit anonymous datacenter. Bookmarklet lane me BOB fetch hi nahi karta, isliye BOB never 429s (user apni session 429 karega to honest message) | Corrected — "429 concept does not apply (no server fetch)" |
| Cache/shiva/Go/Hetzner/KV/D1/R2/Cron docs | **Archived** — owner ne mana kiya. Proof bacha hai, design nahi | `docs/archive/` deleted 2026-11-08 (commit 99ee193) |
| Extension/MV3 as primary | **Removed** — bookmarklet replace | Deleted `apps/extension/` |
| AdSense ₹/$ RPM, freemium tiers | Not implemented (koi billing code nahi) | Removed from README principles |
| `pencamp`... (stale content) | — | — |

## 3. Scalar / Magic Numbers — Sacchai

| Number | Source | Sach? |
|---|---|---|
| `~200 req/hr/IP` anonymous IG cap | ScrapFly 2026 live research | **Research truth** — residential IP par, datacenter par pehle se blocked |
| `77k parses/sec` | local micro-benchmark (CPU parse only) | **Isolated truth** — system throughput nahi. Kabhi "system handles 77k/s" mat likho |
| `4,800/day/IP` | 200×24 arithmetic | **Math truth** — har IP limit, Workers shared pool me far less |
| `~$0/mo` | Pages ∞ + R2 10GB free + GitHub Actions free | **Cost truth** (domain $10/yr + Chrome $5 if listed) |
| `0 network / 1ms` cache hit | Purana SQLite cache proof | **HISTORICAL only** — cache deleted, ab nahi hai |

## 4. Abhi ke gate (purna)

- Python 8/8 ✅ · TS 5/5 ✅ · Vite build ✅ (3.57 KB + 6.09 KB)
- Workspace 1.1 MB source + 916K .git — GitHub-ready
- Deploy: Pages ← `apps/web/dist` — **`wrangler` nahi, direct upload**

## 5. Kya bacha hai

- Sirf **5 proof docs + CANONICAL + REVERSE-ENGINEERING-DEEP** — baaki sab history/delete.
- Ek hi decision: **bookmarklet vs upload** — dono ready hain.
