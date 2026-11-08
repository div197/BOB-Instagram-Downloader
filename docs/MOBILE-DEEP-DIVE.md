# BOB Mobile Deep-Dive — 90% Mobile, No Extension, WhatsApp Status First

**Question (owner):** Extension mobile par nahi chalta. 90% log mobile se honge — Instagram reel WhatsApp status par dalna chahenge. Kuch alag socho.

**Answer:** Extension desktop ke liye hai. Mobile ke liye **3 surfaces, ek khoy** — sab ek hi extractor core (`packages/extractor` TS / `services/extractor` Python) share karte hain.

```text
                    ┌─────────────────────┐
     SURFACE 1      │ Pages web (PWA)     │  "Paste link → Download → Share"
                    │  mobile browser     │  ← zero install, ∞ free edge
                    └─────────┬───────────┘
                              │ fetch(metadata)
     SURFACE 2      ┌─────────▼───────────┐
     (Android)      │ Android native app  │  "Phone ka IP = requester IP"
                    │  Flutter/Kotlin     │  ← on-device L1, gallery+, intent-share
                    └─────────┬───────────┘
                              │ same parser, native fetch (no CORS)
     SURFACE 3      ┌─────────▼───────────┐
     (Telegram)     │ Telegram bot        │  "Link bhejo → video wapas"
                    │  python L1 server   │  ← zero install, chat-native
                    └─────────────────────┘
```

---

## 1. Mobile User Ka Asli Flow (WhatsApp Status)

Research (2026 guides + Play Store patterns) confirms 4-step reality — har successful site yehi bechti hai:

```text
1. Instagram reel par ✈️ Share → Copy link
2. Downloader me paste (mobile browser / app / bot)
3. Video gallery/Downloads me save
4. WhatsApp → Status → My status → Gallery se select → Post
```

Mobile UX law: **2 taps me preview, 3 taps me download**. Desktop ka "popup + click" model yahan nahi chalega. BOB ka mobile UI:
- Bada paste box, badi preview card (9:16 vertical, autoplay muted loop)
- Quality chip: "720p · 69s · 8.4 MB" (source ladder se, honest)
- Ek primary button: **Download & Share** (Web Share API first, fallback anchor)

---

## 2. Surface 1 — Mobile Web PWA (primary, zero install)

**Pattern:** Pages static site, mobile browser. Paste → server-L1 metadata (optional fallback API) → **direct CDN `<a download>` to phone** → Web Share API to WhatsApp.

**kyun ye kaam karta hai mobile par (extension ke bina):**
- Metadata ke liye mobile browser JS **CORS-blocked hai** (web JS can't fetch IG HTML). Isliye server-L0/L1 fallback API chahiye — yahi woh Hetzner €3.79 Python extractor hai jo pehle `services/extractor` me proven hai (0.9s, 1 GET). Pages static JS us API ko cross-origin call karta hai (our own CORS `*`). **Hosting still ~$0** (Pages ∞ + one €3.79 box, ya free-tier Render).
- **Download itself has no CORS problem:** Instagram CDN `<a href="https://scontent.../720.mp4" download>` seedha phone pe girlfriend. Chrome Android: Downloads folder. Safari iOS: Files.
- **WhatsApp step:** `navigator.share({ files: [mp4File] })` (Web Share API Level 2, Chrome Android 89+, Safari 15+) native share sheet kholta hai → WhatsApp → Status. iOS par share sheet → "Save to Files" → Files me "Save Video" → Photos → WhatsApp Status (Apple's official path).

**iOS Safari ki sacchai (2026):**

| | Reality |
|---|---|
| File download | Files app pe jata hai, Photos pe seedha nahi — user ko 1 extra "Save Video" tap |
| share files | Safari 15+ `navigator.share({files})` supported (HTTPS + user gesture) |
| PWA storage | ~60% disk per site cap; inactivity par SW evict — offline cache volatile |
| `<a download>` | Files me save hota hai, gallery me nahi — UI copy me instruction chahiye |

**Android Chrome ki sacchai:**

| | Reality |
|---|---|
| Download | Downloads/ + MediaStore gallery (permission `WRITE_EXTERNAL_STORAGE` pre-Android 10, `MediaStore` 10+) |
| Share files | Chrome 89+ `navigator.share({files})` + Web Share Target PWA — BOB *share sheet me* bhi appear kar sakta hai (manifest `share_target`) |
| PWA install | "Add to Home screen" — no Play Store needed, no $25 fee |

**Build details (ultra):**
- PWA manifest: `"display": "standalone"`, `"theme_color": "#0b0d12"`, icons (SVG maskable), `share_target` (action `/share`, method GET, params `url`).
- Mobile CSS: `100dvh` (not `100vh`), `inputmode="url"`, `enterkeyhint="go"`, safe-area `env(safe-area-inset-*)`.
- AdSense: mobile ad = 320×100 banner **below** the tool, never above; AdSense policy forbids ads looking like download buttons (deceptive implementation).
- SEO mobile: LCP ≤2.5s (Early Hints preload), CLS ≤0.1 (fixed 9:16 preview box), INP ≤200ms.

---

## 3. Surface 2 — Android Native (requester-IP, zero server)

**Why native:** Android app ka process sidha IG fetch karta hai (native HTTP, no CORS, phone's own IP) — server cost zero, IP burn zero, Play Store $25 one-time (ya Pages/R2 se APK sideload, $0).

**Stack choice (2026):**

| Option | Verdict |
|---|---|
| **Flutter 3.x** (Dart) | ⭐ **Recommended** — one codebase Android+iOS, `http` package native fetch (no CORS), `share_plus` (WhatsApp Intent), `path_provider` + MediaStore |
| Tauri Mobile (Rust) | Viable (v2 stable) but ecosystem young; share-intent plugin community-maintained (Reddit: queue pattern) — keep as Phase-2 |
| Kotlin (native) | Best perf + Play policies, but 2 codebases (iOS Swift later) |
| React Native | Overkill — no JS-heavy UI needed |

**Flow (requester-IP):**
```kotlin
// Pseudocode — Kotlin
suspend fun fetchReel(shortcode: String): BOBMedia {
    val html = httpGet("https://www.instagram.com/p/$shortcode/", headers = browserUA)
    return TsParser.parse(extractXig(html)) // same data-sjs walk as server L1
}
// then MediaStore: copy CDN bytes → Pictures/BOB/ (no re-encode)
val intent = Intent(Intent.ACTION_SEND).apply {
    type = "video/mp4"; putExtra(Intent.EXTRA_STREAM, fileUri)
    setPackage("com.whatsapp") // or chooser
}
```

**Permissions (2026):**
- Android 13+: `READ_MEDIA_VIDEO` (gallery read), storage write via MediaStore (no perm needed for app-committed files)
- Android 14+: granular media access (`READ_MEDIA_VISUAL_USER_SELECTED`)
- WhatsApp share: `ACTION_SEND` Intent + `FLAG_GRANT_READ_URI_PERMISSION` (FileProvider)

**iOS counterpart (Phase-2):** SwiftUI Action Extension ("Share to BOB" from Instagram share sheet) + PHPhotoLibrary. App Store review is the botleneck — same $99/yr Apple fee. Shortcut (.shortcut) is $0 alternative: Instagram → Share → Shortcuts → BOB (downloads to Files).

---

## 4. Surface 3 — Telegram Bot (zero install, mobile-native)

**Why unique:** 90% mobile user already has Telegram *ya* can open it in 10s. Bot = server extractor (our proven Python L1) + Telegram Bot API (free). User forwards a link in chat; bot replies the video **in the same chat**; user saves to gallery → WhatsApp Status. Zero app, zero extension, zero PWA install.

**Infra (still ~$0):**
```text
Telegram update (long-poll / webhook) → Hetzner €3.79 (or free Render) → Python L1 (0.9s)
→ CDN bytes re-sent via sendVideo → user phone
```

**UX steps (3 taps):**
```text
1. Instagram ✈️ Copy link
2. Telegram → @bob_downloader_bot → paste
3. Video appears in chat → tap → Save to Gallery → WhatsApp Status
```

**Why this is "kuch alag" (unique vs clones):** No clone ships a Telegram funnel as primary. SnapInsta/SaveInsta are web-only; Inflact has API/bulk. BOB = **web + extension + bot** — jo surface user pehle se khola hai, wahi serving surface. Bot is itself an installer: every download ends with "Want one-click? Add BOB to home screen / install app" loop.

**Limit honesty:** bot extractor burns server IP (200/hr/IP cap). Mitigations: cache-first (SQLite per-shortcode), 20/hr per-chat quota (Reelkeep pattern), bot only for mobile; desktop users stay on extension (requester-IP, zero burn).

---

## 5. One Core, Three Skins (architecture)

```text
packages/extractor (TS)     ← single source of truth
├── apps/web                 → Pages static (server-L1 fallback API for metadata)
├── apps/extension           → MV3 requester-IP (desktop)
├── apps/android (Flutter)   → on-device requester-IP (mobile, Phase-2)
└── services/bot             → Telegram bot (Python L1, mobile, Phase-1.5)
```

Parser rules (shared):
1. Normalize URL → shortcode (strip `utm`, `psln`)
2. L1 `data-sjs` walk → `xig_polaris_media` → dual-schema normalize
3. Best video: `video_versions[0]` (720p progressive) + DASH ladder offered
4. Download bytes direct from CDN (no BOB egress, no re-encode)
5. Typed errors only: `PRIVATE` / `RATE_LIMITED` / `EXTRACTION_FAILED` (honest, retry-after)

---

## 6. Cost & Scale (mobile cut)

| Surface | Cost/mo | Scale ceiling |
|---|---|---|
| Pages web | $0 | ∞ (static edge) |
| Extension | $0 (+$5 one-time Chrome) | ∞ (per-user IP) |
| Android app | $0 (+$25 one-time Play, ya $0 sideload) | ∞ (per-device IP) |
| Telegram bot | €3.79 (one box) | ~4,800 fetches/day/IP → cache + quota bound; add IPv6 /64 to scale free |
| Fallback API (web metadata) | shared with bot box | same |

**Total at 100k mobile downloads/day:** ~€3.79 + domain → abhi bhi **~$0**. No proxy pool, no paywall API, no Workers.

---

## 7. Next Build (owner choice)

1. **Mobile web first** (fastest): `apps/web/main.ts` me Web Share API file-sharing + PWA manifest + 390px mobile layout → test iPhone Safari + Chrome Android download → gallery → WhatsApp flow.
2. **Telegram bot skeleton** (`services/bot/bot.py`, long-poll + L1) → test with owner's 4 reels.
3. **Android Flutter skeleton** (fetch + parse + MediaStore + share intent) → sideload APK.

**Recommended order:** 1 → 2 → 3. Web covers 100% mobile users on day one (zero install); bot captures the most impatient; app is polish.

---

## 8. Sources

- Web Share + PWA share_target (MDN, Chrome TWA, Chromium notes)
- iOS PWA limits (storage, share files, Files→Photos path) — Apple + Stack Overflow + Firt 2026
- Tauri mobile (v2 stable, share-intent plugin) — Tauri docs + Reddit plugin post
- Reel→WhatsApp 4-step guides (2026) — instagramreelsdownload.org,igexport.com, Play Store status savers
- Core Web Vitals budgets — Google web.dev
- BOB proofs — `docs/LIVE-PROOF.md`, `docs/BATCH-PROOF.md`, `services/extractor/` (b325c13), `apps/extension/` (a8d4e9c)
