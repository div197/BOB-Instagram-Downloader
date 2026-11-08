// Cloudflare Pages Function: GET /api/extract?url=https://www.instagram.com/reel/XYZ/
// Stateless edge extraction (clone pattern). No cache, no DB, public only.
// Instagram sees datacenter ASN → 429 handling honors Retry-After honestly.

const SHORTCODE_RE = /instagram\.com\/(?:[A-Za-z0-9_.]+\/)?(p|reel|reels|tv)\/([A-Za-z0-9_\-]{8,})/;

function shortcodeFrom(url) {
  const m = SHORTCODE_RE.exec(url || "");
  return m ? m[2] : null;
}

function walkXig(o, d) {
  d = d || 0;
  if (d > 40) return null;
  if (o && typeof o === "object") {
    if (!Array.isArray(o) && o.xig_polaris_media && typeof o.xig_polaris_media === "object") return o.xig_polaris_media;
    const vals = Array.isArray(o) ? o : Object.values(o);
    for (const v of vals) { const f = walkXig(v, d + 1); if (f) return f; }
  }
  return null;
}

function parseXIG(html) {
  const re = /<script[^>]*data-sjs[^>]*>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html))) {
    if (!m[1].includes("xig_polaris_media")) continue;
    try {
      const payload = JSON.parse(m[1]);
      const modules = payload?.require?.[0]?.[3]?.[0]?.__bbox?.require;
      if (Array.isArray(modules)) {
        for (const mod of modules) {
          if (!Array.isArray(mod) || mod.length <= 3) continue;
          for (const entry of mod[3] || []) {
            const media = entry?.__bbox?.result?.data?.xig_polaris_media;
            if (media) return media;
          }
        }
      }
      const deep = walkXig(payload);
      if (deep) return deep;
    } catch { /* next script */ }
  }
  return null;
}

function bestVideo(vers) {
  if (!Array.isArray(vers) || !vers.length) return "";
  return [...vers].sort((a, b) => ((b.width || 0) * (b.height || 0) || (b.type || 0)) - ((a.width || 0) * (a.height || 0) || (a.type || 0)))[0].url || "";
}

// Single-flight (transient, NOT a cache): concurrent identical shortcode requests
// share ONE upstream fetch, then the promise is discarded. Nothing stored past the request.
const inflight = new Map();
let inflightCount = 0;
const waiters = [];
const MAX_CONCURRENCY = 3;
async function withSem(fn) {
  if (inflightCount >= MAX_CONCURRENCY) await new Promise((r) => waiters.push(r));
  inflightCount++;
  try { return await fn(); } finally {
    inflightCount--;
    const next = waiters.shift();
    next?.();
  }
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const raw = url.searchParams.get("url") || "";
  const shortcode = shortcodeFrom(raw);
  if (!shortcode) return Response.json({ ok: false, error: "INVALID_URL" }, { status: 400 });
  if (shortcode.length > 28) return Response.json({ ok: false, error: "PRIVATE" }, { status: 403 });

  const existing = inflight.get(shortcode);
  if (existing) return existing;

  const work = withSem(async () => {
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
    const rawMedia = parseXIG(html);
    if (!rawMedia) {
      return Response.json({ ok: false, error: "EXTRACTION_FAILED: xig_polaris_media not found (gated or drift)" }, { status: 502 });
    }
    const post = rawMedia.if_not_gated_logged_out || rawMedia;
    const media = {
      shortcode: post.shortcode || post.code || shortcode,
      owner: post.user?.username || post.owner?.username || "",
      caption: post.caption?.text || "",
      video_url: post.video_url || bestVideo(post.video_versions) || "",
      thumbnail: post.display_uri || post.display_url || (post.image_versions2?.candidates?.[0]?.url || ""),
      is_video: !!(post.video_url || (Array.isArray(post.video_versions) && post.video_versions.length)),
      width: post.original_width || post.dimensions?.width || null,
      height: post.original_height || post.dimensions?.height || null,
      layer: "L1-edge",
    };
    return Response.json({ ok: true, media });
  });

  inflight.set(shortcode, work);
  try { return await work; } finally { inflight.delete(shortcode); }
}
