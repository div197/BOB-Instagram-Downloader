// BOB Pages static main — extension bridge (no backend, no Workers).
// Pages JS listens for BOB extension on this origin; extraction runs in the extension SW.

const status = (t: string) => { const el = document.getElementById("status"); if (el) el.textContent = t; };

// 1) Detect extension via custom ping (extension content-script on bob.example.com listens)
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
