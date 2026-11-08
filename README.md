# BOB Instagram Downloader

**BOB = Break Ordinary Boundaries**

A deep, ultra-scalable, edge-first system to download **public** Instagram posts, reels, IGTV, and carousels — with a modern hybrid architecture (Cloudflare Pages + Workers + Go extractor) and freemium-first monetization.

> Ultra-deep research (extraction, edge/scale architecture, competitors, AdSense policy, SEO, business model) lives in **[docs/DEEP-RESEARCH.md](docs/DEEP-RESEARCH.md)**. Read §1 Executive Verdict before writing any code.
>
> The extractor kernel — upside-down tree, roots first (Gita 15.1) — is specified in **[docs/EXTRACTOR-METHODOLOGY.md](docs/EXTRACTOR-METHODOLOGY.md)**: L0 oEmbed preview → L1 inline JSON → L2 GraphQL → L3 yt-dlp/Reelkeep engine → L4 managed fallback → L5 browser last-resort, code-reviewed against the latest GitHub repos (Nov 2026).

## Principles

- Public-only. No private accounts, no login walls, no credential harvesting — never ask for an Instagram login.
- No media hosting. On-demand fetch from Instagram CDN, short retention (R2 24h lifecycle), DMCA takedown honoured.
- Cache by `shortcode` (stable ID), not by expiring media URLs (video URLs expire in ~34h).
- Freemium-first revenue (Premium no-ads/bulk/API). Google AdSense is **high risk** for a pure downloader (Publisher Policies ban "download streaming videos if prohibited by the content provider") — treated as optional, never load-bearing.

## Status

- [x] Local git initialised (`main`)
- [x] Ultra-deep research complete — `docs/DEEP-RESEARCH.md`
- [x] Upside-down extractor methodology + GitHub audit — `docs/EXTRACTOR-METHODOLOGY.md`
- [x] **Phase-0 extractor kernel built & live-proven** — `services/extractor/` (L0→L3) + 8 offline tests
- [x] **Live proof on owner's reel `DfcUpmgsQZ6`** — `docs/LIVE-PROOF.md` (L1, 0.9s, 1 fetch, 720p + 1080p DASH, 8.41 MiB verified)
- [ ] Worker control plane (KV/D1/Queues/R2, HMAC-signed edge delivery)
- [ ] Gentleman frontend (Vite + SEO pages, 1 ad unit below fold)
- [ ] Extractor host pick: Hetzner CX22 (recommended) vs Fly.io vs Containers

## Planned stack

- Frontend: Vite + React, pre-rendered SEO HTML → Cloudflare Pages
- API: Cloudflare Worker (TypeScript) + KV + D1 + Queues + R2
- Extractor: Go + embedded yt-dlp + ffmpeg → Hetzner / Fly / Containers
- SEO: 8–12 tool pages (`/instagram-reels-downloader/`, etc.), EN → ES/PT-BR/ID/HI
