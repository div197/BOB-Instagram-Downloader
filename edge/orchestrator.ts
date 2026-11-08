// BOB Edge Worker (Cloudflare Workers) — pure edge, NO cache, NO Shiva fallback.
// Owner constraint: no cache feature, no extension, Cloudflare-only.
// This worker FETCHES instagram.com/p/{shortcode}/ itself (Worker native fetch),
// parses data-sjs via @bob/extractor (packages/extractor), returns BOBMedia JSON.
// Cache is intentionally absent — every request pays one IG fetch (owner's choice;
// honest cost: ~200 req/hr/IP budget means high traffic will 429 — see docs/CLOUDFLARE-PURE.md §5).
// Public posts only. No cookies, no login, no private bypass. 429 → Retry-After honored.

import { extractXigPolarisMedia, parseMedia } from "../packages/extractor/src/index.ts";

const SHORT_RE = /instagram\.com\/(?:[A-Za-z0-9_.]+\/)?(p|reel|reels|tv)\/([A-Za-z0-9_\-]{8,})/;

function shortcodeFrom(url: string): string | null {
  const m = SHORT_RE.exec(url || "");
  return m ? m[2] : null;
}

export default {
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname !== "/api/extract") return new Response("Not found", { status: 404 });
    const raw = url.searchParams.get("url") || "";
    const shortcode = shortcodeFrom(raw);
    if (!shortcode) return Response.json({ ok: false, error: "INVALID_URL" }, { status: 400 });
    if (shortcode.length > 28) return Response.json({ ok: false, error: "PRIVATE" }, { status: 403 });

    // Edge fetch — Worker native fetch (browser headers only; no TLS impersonation available at edge).
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
  },
};
