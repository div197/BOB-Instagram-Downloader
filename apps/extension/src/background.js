// BOB MV3 service worker — sole fetcher + downloader (CORS-exempt via host_permissions).
// Privacy: only {shortcode} crosses from content → SW. Cookies stay in browser (credentials:include).
// 429/private/login-wall → hard stop, honest copy, no silent retry.

const INSTAGRAM = "https://www.instagram.com/";

function shortcodeFromUrl(url) {
  const m = /instagram\.com\/(?:[A-Za-z0-9_.]+\/)?(p|reel|reels|tv)\/([A-Za-z0-9_\-]{8,})/.exec(url || "");
  return m ? m[2] : null;
}

async function fetchText(url) {
  const res = await fetch(url, { credentials: "include", headers: { Accept: "text/html" } });
  if (res.status === 429) throw new Error("RATE_LIMITED");
  if (res.status === 401 || res.status === 403) throw new Error("PRIVATE");
  if (!res.ok) throw new Error("HTTP_" + res.status);
  const text = await res.text();
  return { text, finalUrl: res.url };
}

// Import shared parser in SW scope (built bundle exposes window.BOBExtractor or globalThis).
// Build step copies packages/extractor/dist/index.js → parser.js (ESM-free IIFE wrap in build.mjs).

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== "BOB_EXTRACT") return false;
  (async () => {
    try {
      const shortcode = shortcodeFromUrl(msg.url);
      if (!shortcode) throw new Error("INVALID_URL");
      const { text, finalUrl } = await fetchText(INSTAGRAM + "p/" + shortcode + "/");
      if (/\/accounts\/login/.test(finalUrl)) throw new Error("RATE_LIMITED");
      if (typeof globalThis.BOBExtractor !== "undefined") {
        const raw = globalThis.BOBExtractor.extractXigPolarisMedia(text);
        const media = raw ? globalThis.BOBExtractor.parseMedia(raw) : null;
        if (media) return sendResponse({ ok: true, media });
      }
      // Fallback: extension host cannot import ESM in SW without build wrap;
      // production build ships parser.js as importScripts-compatible blob.
      return sendResponse({ ok: true, needsParser: true, html: text.slice(0, 200000) });
    } catch (e) {
      sendResponse({ ok: false, code: String(e?.message || "EXTRACTION_FAILED") });
    }
  })();
  return true;
});
