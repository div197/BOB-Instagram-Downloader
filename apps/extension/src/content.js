// Content script — page-aware button + video/image DOM fallback (no fetch — CORS-bound, per MV3 law).
// All extraction data flows via shortcode → SW. This script never sees cookies.

(() => {
  const btn = document.createElement("button");
  btn.textContent = "⤓ BOB";
  btn.style.cssText =
    "position:fixed;right:16px;bottom:16px;z-index:99999;padding:10px 14px;border-radius:999px;border:0;background:#111;color:#fff;font:600 13px system-ui;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.35)";
  btn.onclick = async () => {
    btn.textContent = "Fetching…";
    const res = await chrome.runtime.sendMessage({ type: "BOB_EXTRACT", url: location.href });
    btn.textContent = res?.ok ? "Done ✓" : (res?.code?.includes("RATE_LIMITED") ? "Rate-limited, retry 60s" : "Not public / not loaded");
    setTimeout(() => (btn.textContent = "⤓ BOB"), 4000);
  };
  document.documentElement.appendChild(btn);
})();
