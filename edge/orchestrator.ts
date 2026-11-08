// BOB Edge Worker (Cloudflare Workers / Pages Functions) — cache-first orchestration.
// Shakti edge: KV cache hit → 302 CDN; miss → Shiva /extract (single source of fetch).
// Deploy: wrangler deploy (no Pages Functions needed if shipped as standalone Worker).
// Bindings: KV `BOB_CACHE` (shortcode → BOBMedia JSON, 6h TTL). Secret: SHIVA_URL.

const SHIVA = "https://shiva.bob.example.com"; // env: SHIVA_URL

const SHORT_RE = /instagram\.com\/(?:[A-Za-z0-9_.]+\/)?(p|reel|reels|tv)\/([A-Za-z0-9_\-]{8,})/;

function shortcodeFrom(url: string): string | null {
  const m = SHORT_RE.exec(url || "");
  return m ? m[2] : null;
}

export default {
  async fetch(req: Request, env: { BOB_CACHE?: KVNamespace; SHIVA_URL?: string }): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname !== "/api/extract") return new Response("Not found", { status: 404 });
    const raw = url.searchParams.get("url") || "";
    const shortcode = shortcodeFrom(raw);
    if (!shortcode) return Response.json({ ok: false, error: "INVALID_URL" }, { status: 400 });
    if (shortcode.length > 28) return Response.json({ ok: false, error: "PRIVATE" }, { status: 403 });

    // 1) Edge cache — zero IG fetch on hit (the whole game)
    if (env.BOB_CACHE) {
      const hit = await env.BOB_CACHE.get(shortcode);
      if (hit) {
        return new Response(hit, { headers: { "Content-Type": "application/json", "X-Cache": "HIT" } });
      }
    }

    // 2) Shiva fallback — one fetch, respectful backoff honored
    const shiva = env.SHIVA_URL || SHIVA;
    const upstream = await fetch(shiva + "/extract?url=" + encodeURIComponent("https://www.instagram.com/reel/" + shortcode + "/"), {
      headers: { "User-Agent": "BOB-Shakti/1.0" },
    });
    const body = await upstream.text();
    if (upstream.ok && env.BOB_CACHE) {
      await env.BOB_CACHE.put(shortcode, body, { expirationTtl: 21600 });
      return new Response(body, { status: upstream.status, headers: { "Content-Type": "application/json", "X-Cache": "MISS" } });
    }
    return new Response(body, {
      status: upstream.status,
      headers: {
        "Content-Type": "application/json",
        ...(upstream.headers.get("retry-after") ? { "Retry-After": upstream.headers.get("retry-after")! } : {}),
      },
    });
  },
};
