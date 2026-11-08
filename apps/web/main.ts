// BOB Pages static main — NO Workers, NO cache, NO extension, NO .html-upload.
// Primary: Bookmarklet (user IP, IG origin). BOB itself never fetches Instagram.
// Public posts only. No cookies sent anywhere.

const status = (t: string) => { const el = document.getElementById("status"); if (el) el.textContent = t; };

// 0) Wire the drag-link from /bookmarklet.js (so "Drag to bookmarks bar" actually installs it)
fetch("/bookmarklet.js")
  .then((r) => r.text())
  .then((code) => {
    const a = document.getElementById("bkm") as HTMLAnchorElement | null;
    if (a) a.href = "javascript:" + encodeURIComponent(code.trim());
  })
  .catch(() => { /* bookmarklet.js missing — link stays inert */ });

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
    status("Shared link received — open that post and tap ⤓ BOB (1 tap).");
  }
}

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

// Clone pattern: ONE box, ONE button. Paste → edge /api/extract (stateless) → preview + download.
document.getElementById("go")?.addEventListener("click", async () => {
  const url = (document.getElementById("url") as HTMLInputElement)?.value?.trim() || "";
  if (!/instagram\.com\/(p|reel|reels|tv)\//.test(url)) {
    status("That doesn't look like a public Instagram post/reel link.");
    return;
  }
  status("Fetching…");
  try {
    const res = await fetch("/api/extract?url=" + encodeURIComponent(url));
    const data = (await res.json()) as any;
    if (!res.ok || !data.ok) {
      if (res.status === 429) { status("Instagram is rate-limiting us. Try again in 60 seconds."); return; }
      if (data?.error === "PRIVATE") { status("This post is private, or accounts without login can't view it."); return; }
      status("Can't fetch this one right now (" + (data.error || res.status) + "). Try again shortly.");
      return;
    }
    const m = data.media || {};
    renderPreview({ shortcode: m.shortcode, video_url: m.video_url || "", thumb: m.thumbnail || "", owner: m.owner, duration: m.duration });
    status("Done — " + (m.owner ? "@" + m.owner + " · " : "") + (m.duration ? m.duration.toFixed(1) + "s" : m.width ? m.width + "×" + m.height : ""));
  } catch (e: any) {
    status("Network error: " + (e?.message || "retry shortly."));
  }
});
