/**
 * @bob/extractor — signature parser (TS port of Python L1, dual-schema).
 * Matches by object shape (image_versions2 + code), never by brittle path.
 * Runs in extension SW / web / Node (zero deps).
 */

export interface VideoVersion { type?: number; url: string; width?: number; height?: number }
export interface ImageCandidate { url: string; width?: number; height?: number }
export interface MediaItem {
  thumbnail: string;
  video_url: string;
  video_versions: VideoVersion[];
  image_versions: ImageCandidate[];
  is_video: boolean;
  width: number | null;
  height: number | null;
  media_type: number | null;
}
export interface BOBMedia {
  shortcode: string;
  pk: string;
  type: string;
  product_type: string;
  caption: string;
  like_count: number;
  comment_count: number;
  taken_at: number;
  duration: number;
  number_of_qualities: number;
  owner: string;
  media: MediaItem[];
  video_dash_manifest: string;
  is_dash_eligible: boolean;
  layer: string;
}

const DATA_SJS_RE = /<script[^>]*data-sjs[^>]*>([\s\S]*?)<\/script>/g;

export function extractXigPolarisMedia(html: string): Record<string, any> | null {
  let m: RegExpExecArray | null;
  DATA_SJS_RE.lastIndex = 0;
  while ((m = DATA_SJS_RE.exec(html))) {
    if (!m[1].includes("xig_polaris_media")) continue;
    try {
      const payload = JSON.parse(m[1]);
      const modules = payload?.["require"]?.[0]?.[3]?.[0]?.["__bbox"]?.["require"];
      if (!Array.isArray(modules)) continue;
      for (const mod of modules) {
        if (!Array.isArray(mod) || mod.length <= 3) continue;
        const entries = mod[3];
        if (!Array.isArray(entries)) continue;
        for (const entry of entries) {
          const media = entry?.["__bbox"]?.["result"]?.["data"]?.["xig_polaris_media"];
          if (media) return media;
        }
      }
    } catch { /* try next script */ }
  }
  return null;
}

function bestVideoVersions(post: Record<string, any>): VideoVersion[] {
  const out = (Array.isArray(post["video_versions"]) ? post["video_versions"] : [])
    .filter((v: any) => v?.url) as VideoVersion[];
  return out.sort((a, b) => ((b.width ?? 0) * (b.height ?? 0) || (b.type ?? 0)) - ((a.width ?? 0) * (a.height ?? 0) || (a.type ?? 0)));
}
function bestImageVersions(post: Record<string, any>): ImageCandidate[] {
  const cands = (post["image_versions2"]?.["candidates"] ?? []) as ImageCandidate[];
  return [...cands].sort((a, b) => (b.width ?? 0) * (b.height ?? 0) - (a.width ?? 0) * (a.height ?? 0));
}
function mediaItem(m: Record<string, any>): MediaItem {
  let thumb = m["display_url"] || m["display_uri"] || "";
  let vurl: string = m["video_url"] || "";
  const vv = bestVideoVersions(m);
  if (!vurl && vv.length) vurl = vv[0].url;
  const imgs = bestImageVersions(m);
  if (!thumb && imgs.length) thumb = imgs[0].url;
  return {
    thumbnail: thumb,
    video_url: vurl,
    video_versions: vv,
    image_versions: imgs.slice(0, 6),
    is_video: Boolean(m["is_video"] || vurl || m["media_type"] === 2),
    width: (m["dimensions"]?.["width"] ?? m["original_width"] ?? null) as number | null,
    height: (m["dimensions"]?.["height"] ?? m["original_height"] ?? null) as number | null,
    media_type: (m["media_type"] ?? null) as number | null,
  };
}
export function parseMedia(raw: Record<string, any>): BOBMedia {
  const post: Record<string, any> = raw["if_not_gated_logged_out"] || raw;
  const caption: string = post["caption"]?.["text"] || "";
  let sidecar: any[] = post["carousel_media"] || [];
  if (!sidecar.length && Array.isArray(post["edge_sidecar_to_children"]?.edges))
    sidecar = post["edge_sidecar_to_children"].edges.map((e: any) => e?.node).filter(Boolean);
  const media: MediaItem[] = sidecar.length ? sidecar.filter(x => x && typeof x === "object").map(mediaItem) : [mediaItem(post)];
  const dash: string = post["video_dash_manifest"] || "";
  let duration: number = post["clips_metadata"]?.["video_duration"] || post["video_duration"] || 0;
  if (!duration && dash) {
    const dm = /mediaPresentationDuration="PT([\d.]+)S"/.exec(dash);
    if (dm) duration = parseFloat(dm[1]);
  }
  return {
    shortcode: post["shortcode"] || post["code"] || "",
    pk: String(post["pk"] || post["id"] || ""),
    type: post["__typename"] || (sidecar.length ? "carousel" : "post"),
    product_type: post["product_type"] || "",
    caption,
    like_count: Number(post["like_count"] ?? post["edge_media_like_request"]?.count ?? 0),
    comment_count: Number(post["comment_count"] ?? post["comments"]?.count ?? 0),
    taken_at: post["taken_at_timestamp"] || post["taken_at"] || 0,
    duration,
    number_of_qualities: post["number_of_qualities"] || 0,
    owner: post["owner"]?.username || post["user"]?.username || "",
    media,
    video_dash_manifest: dash,
    is_dash_eligible: Boolean(post["is_dash_eligible"]),
    layer: "L1",
  };
}
export { DATA_SJS_RE };
