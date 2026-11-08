// BOB Pages + Worker main — NO extension, NO cache. Paste → POST? GET /api/extract (Worker) → preview → download.
// Public posts only. No cookies, no login. 429 → Retry-After honored.

const status = (t: string) => { const el = document.getElementById("status"); if (el) el.textContent = t; };

// Web Share Target: prefill from PWA share (Android intent → BOB).
{
  const q = new URLSearchParams(location.search);
  const shared = q.get("url") || q.get("text") || "";
  const m = /https?:\/\/[^\s]*instagram\.com\/[^\s]*/.exec(shared);
  if (m) {
    const el = document.getElementById("url") as HTMLInputElement | null;
    if (el) el.value = m[0];
    if (m[0]) document.getElementById("go")?.dispatchEvent(new Event("click"));
  }
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
  } catch { /* fallback below */ }
  const a = document.createElement("a");
  a.href = cdnUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  return "anchored";
}

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
      status("Can't fetch this one right now (" + (data.error || res.status) + "). Try again shortly.");
      return;
    }
    const item = (data.media.media || [])[0] as any;
    const src = item?.video_url || item?.thumbnail || "";
    const box = document.getElementById("preview");
    if (box && src) {
      box.innerHTML = item?.is_video
        ? `<video controls preload="metadata" src="${src}"></video><p class="note">Ready — tap Download, or long-press → Save.</p>`
        : `<img alt="Instagram media" src="${src}" style="width:100%;border-radius:12px">`;
      const dl = document.createElement("button");
      dl.textContent = "⤓ Download HD";
      dl.style.cssText = "margin-top:10px;width:100%;padding:12px;border-radius:10px;border:0;background:#fff;color:#000;font-weight:700";
      dl.onclick = () => shareOrDownload(src, "bob-" + (data.media.shortcode || "reel") + ".mp4");
      box.appendChild(dl);
    }
    status("Done — " + (data.media.owner ? "@" + data.media.owner + " · " : "") + (data.media.duration ? data.media.duration.toFixed(1) + "s" : ""));
  } catch (e: any) {
    status("Network error: " + (e?.message || "retry shortly."));
  }
});
