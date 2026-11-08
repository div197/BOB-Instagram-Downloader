// BOB Edge Worker (Cloudflare Workers) — pure edge, NO cache, NO Shiva fallback.
// Owner constraint: no cache feature, no extension, Cloudflare-only.
// This worker FETCHES instagram.com/p/{shortcode}/ itself (Worker native fetch),
// parses data-sjs via @bob/extractor (packages/extractor), returns BOBMedia JSON.
// Every request pays one IG fetch (owner's choice; ~200 req/hr/IP budget means
// high traffic will 429 — honest cost, not hidden).
// Public posts only. No cookies, no login, no private bypass. 429 → Retry-After honored.
//
// Advanced pacing (2027): in-flight single-flight coalescing + 5-concurrency semaphore.
// This is NOT a cache: no store, no TTL, nothing persisted. Concurrent identical
// shortcodes share ONE upstream fetch (promise removed after settle). Prevents
// burst 429s from the same viral link while honoring "no cache" spirit.

import { extractXigPolarisMedia, parseMedia } from "../packages/extractor/src/index.ts";

const SHORT_RE = /instagram\.com\/(?:[A-Za-z0-9_.]+\/)?(p|reel|reels|tv)\/([A-Za-z0-9_\-]{8,})/;

function shortcodeFrom(url: string): string | null {
  const m = SHORT_RE.exec(url || "");
  return m ? m[2] : null;
}

// --- pacing: single-flight + semaphore (transient, never stored) ---
const inflight = new Map<string, Promise<Response>>();
let inflightCount = 0;
const waiters: Array<() => void> = [];
const MAX_CONCURRENCY = 5;

async function withSem(fn: () => Promise<Response>): Promise<Response> {
  if (inflightCount >= MAX_CONCURRENCY) await new Promise<void>((r) => waiters.push(r));
  inflightCount++;
  try {
    return await fn();
  } finally {
    inflightCount--;
    const next = waiters.shift();
    next?.();
  }
}

export default {
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname !== "/api/extract") return new Response("Not found", { status: 404 });
    const raw = url.searchParams.get("url") || "";
    const shortcode = shortcodeFrom(raw);
    if (!shortcode) return Response.json({ ok: false, error: "INVALID_URL" }, { status: 400 });
    if (shortcode.length > 28) return Response.json({ ok: false, error: "PRIVATE" }, { status: 403 });

    // Single-flight: if same shortcode is already fetching, share its promise (no second fetch).
    const existing = inflight.get(shortcode);
    if (existing) return existing;

    const work = withSem(async () => {
      // Cloudflare Workers use a bundled TLS stack — no Chrome impersonation available at edge.
      // Browser headers are best-effort only; datacenter IP reputation governs IG acceptance.
      const igUrl = "https://www.instagram.com/p/" + shortcode + "/";
      const upstream = await fetch(igUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml",
          "Accept-Language": "en-US,en;q=0.9",
          "Referer": "https://www.instagram.com/",
        },
      });
      if (upstream.status === 429) {
        return Response.json({ ok: false, error: "SOURCE_RATE_LIMITED" }, { status: 429, headers: { "Retry-After": upstream.headers.get("retry-after") || "60" } });
      }
      if (upstream.status === 401 || upstream.status === 403 || upstream.status === 404) {
        return Response.json({ ok: false, error: "PRIVATE" }, { status: 403 });
      }
      const html = await upstream.text();
      const rawMedia = extractXigPolarisMedia(html);
      if (!rawMedia) {
        return Response.json({ ok: false, error: "EXTRACTION_FAILED: xig_polaris_media not found (gated or drift)" }, { status: 502 });
      }
      const media = parseMedia(rawMedia as any);
      return Response.json({ ok: true, media }, { headers: { "Content-Type": "application/json" } });
    });

    inflight.set(shortcode, work);
    try {
      return await work;
    } finally {
      inflight.delete(shortcode);
    }
  },
};
