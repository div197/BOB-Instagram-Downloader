// BOB Pages static main — extension bridge (no backend, no Workers).
// Pages JS listens for BOB extension on this origin; extraction runs in the extension SW.

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

// Download helper (mobile-first): try Web Share API files first, fallback <a download>.
export async function shareOrDownload(cdnUrl: string, filename: string) {
  // Fetch bytes (CDN is CORS-open for <a>, but fetch needs CORS — use blob via <a> when share fails)
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
  } catch { /* fallback to anchor below */ }
  const a = document.createElement("a");
  a.href = cdnUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  return "anchored";
}
let connected = false;
window.addEventListener("message", (e) => {
  if (e.data?.source === "bob-ext" && e.data?.type === "pong") {
    connected = true;
    status("BOB extension connected — paste a public Instagram link to download in HD.");
  }
  if (e.data?.source === "bob-ext" && e.data?.type === "media") {
    const v = (e.data.media?.media || [])[0];
    const box = document.getElementById("preview");
    if (box && (v?.video_url || v?.thumbnail)) {
      const src = v.video_url || v.thumbnail;
      box.innerHTML = v.is_video
        ? `<video controls preload="metadata" src="${src}"></video><p class="note">Ready — right-click → Save video, or use the Download button above in the extension.</p>`
        : `<img alt="Instagram media" src="${src}" style="width:100%;border-radius:12px">`;
    }
  }
});
window.postMessage({ source: "bob-web", type: "ping" }, "*");

// 2) Paste → postMessage to extension (if present). No extension → install funnel (honest).
document.getElementById("go")?.addEventListener("click", () => {
  const url = (document.getElementById("url") as HTMLInputElement)?.value?.trim() || "";
  if (!/instagram\.com\/(p|reel|reels|tv)\//.test(url)) {
    status("That doesn't look like a public Instagram post/reel link.");
    return;
  }
  if (connected) {
    window.postMessage({ source: "bob-web", type: "extract", url }, "*");
    status("Fetching from your browser (your IP)…");
  } else {
    status("Install the BOB extension for one-click HD downloads (uses your own browser). Or open the reel in Instagram → long-press → Save.");
  }
});
