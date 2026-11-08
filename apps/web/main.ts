// BOB Pages static main — NO Workers, NO cache, NO extension.
// Primary: Bookmarklet (user IP, IG origin) · Fallback: Upload saved .html (local parse).
// Public posts only. No cookies sent anywhere. 429 concept does not apply (no server fetch).

import { extractXigPolarisMedia, parseMedia } from "../../../packages/extractor/src/index.ts";

const status = (t: string) => { const el = document.getElementById("status"); if (el) el.textContent = t; };

// 1) Bookmarklet handoff: ?m=<base64> (or #m=) carries {shortcode, video_url, thumb, owner}
{
  const q = new URLSearchParams(location.search);
  const hash = location.hash.startsWith("#m=") ? location.hash.slice(3) : (q.get("m") || "");
  if (hash) {
    try {
      const data = JSON.parse(decodeURIComponent(escape(atob(hash))));
      if (data.video_url || data.thumb) {
        renderPreview(data as any);
        status("Opened from the bookmarklet — press Download or Share to WhatsApp.");
      }
    } catch { /* malformed handoff — ignore */ }
    history.replaceState(null, "", location.pathname + location.search);
  }
  const shared = q.get("text") || q.get("url") || "";
  const m = /https?:\/\/[^\s]*instagram\.com\/[^\s]*/.exec(shared);
  if (m) {
    (document.getElementById("url") as HTMLInputElement | null)!.value = m[0];
    status("Shared link received — now open that post in your browser and run the BOB bookmarklet (1 tap), or upload the saved page below.");
  }
}

// 2) Upload saved IG page (.html) → local FileReader parse → preview. Zero network.
document.getElementById("file")?.addEventListener("change", async (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  status("Reading saved page locally…");
  const html = await file.text();
  const raw = extractXigPolarisMedia(html);
  if (!raw) { status("No public media found in that file (private post or wrong page?)."); return; }
  const media = parseMedia(raw as any);
  renderPreview({ shortcode: media.shortcode, video_url: (media.media[0] as any)?.video_url || "", thumb: (media.media[0] as any)?.thumbnail || "", owner: media.owner, duration: media.duration });
  status("Done — from your saved file (" + (media.owner ? "@" + media.owner : "public post") + ").");
});

function renderPreview(data: any) {
  const box = document.getElementById("preview");
  if (!box) return;
  const src = data.video_url || data.thumb || "";
  const item: any = { is_video: !!data.video_url, video_url: data.video_url, thumbnail: data.thumb };
  box.innerHTML = item.is_video
    ? `<video controls preload="metadata" src="${src}"></video><p class="note">Ready — tap Download, or long-press → Save.</p>`
    : `<img alt="Instagram media" src="${src}" style="width:100%;border-radius:12px">`;
  const dl = document.createElement("button");
  dl.textContent = "⤓ Download HD";
  dl.style.cssText = "margin-top:10px;width:100%;padding:12px;border-radius:10px;border:0;background:#fff;color:#000;font-weight:700";
  dl.onclick = () => shareOrDownload(src, "bob-" + (data.shortcode || "reel") + (item.is_video ? ".mp4" : ".jpg"));
  box.appendChild(dl);
}

// Download helper (mobile-first): Web Share API files first, fallback <a download>.
export async function shareOrDownload(cdnUrl: string, filename: string) {
  try {
    if ("canShare" in navigator && navigator.canShare({ files: [new File([], "x")] })) {
      const resp = await fetch(cdnUrl);
      const blob = await resp.blob();
      const file = new File([blob], filename, { type: blob.type || "video/mp4" });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "BOB Reel" });
        return "shared";
      }
    }
  } catch { /* iOS Safari often rejects fetch(CDN) — fallback anchor below */ }
  const a = document.createElement("a");
  a.href = cdnUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  return "anchored";
}

// Paste-link is a convenience deep-link ONLY — it cannot fetch IG from BOB origin (CORS).
// Guide the user to the two honest lanes instead of pretending.
document.getElementById("go")?.addEventListener("click", () => {
  const url = (document.getElementById("url") as HTMLInputElement)?.value?.trim() || "";
  if (!/instagram\.com\/(p|reel|reels|tv)\//.test(url)) {
    status("That doesn't look like a public Instagram post/reel link.");
    return;
  }
  status("Open that link in your browser, then tap the BOB bookmarklet on the post (1 tap). Or save page → upload below. (BOB never fetches Instagram for you — your browser does.)");
  window.open(url, "_blank");
});
