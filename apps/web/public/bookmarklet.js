// BOB Bookmarklet — runs ON instagram.com (user's IP, user's login, zero server).
// Source (readable, MIT). Drag the link in the homepage to your bookmarks bar.
// Paste into console: document.body.appendChild(s) etc. — for review only.
// Extracts xig_polaris_media via data-sjs walk + DOM fallbacks, then asks
// the user to download the best video/image. No cookies are read or sent.

(function () {
  "use strict";
  function walk(o, d) {
    d = d || 0;
    if (d > 40) return null;
    if (o && typeof o === "object") {
      if (!Array.isArray(o) && o.xig_polaris_media && typeof o.xig_polaris_media === "object") return o.xig_polaris_media;
      var vals = Array.isArray(o) ? o : Object.values(o);
      for (var i = 0; i < vals.length; i++) { var f = walk(vals[i], d + 1); if (f) return f; }
    }
    return null;
  }
  function bestV(vers) {
    if (!vers || !vers.length) return "";
    var sortable = vers.slice().sort(function (a, b) { return ((b.width || 0) * (b.height || 0) || (b.type || 0)) - ((a.width || 0) * (a.height || 0) || (a.type || 0)); });
    return sortable[0].url || "";
  }
  function bestI(cands) {
    if (!cands || !cands.length) return "";
    var sorted = cands.slice().sort(function (a, b) { return (b.width || 0) * (b.height || 0) - (a.width || 0) * (a.height || 0); });
    return sorted[0].url || "";
  }
  function findMedia() {
    var scripts = Array.prototype.slice.call(document.querySelectorAll("script[data-sjs]"));
    for (var i = 0; i < scripts.length; i++) {
      var txt = scripts[i].textContent || "";
      if (txt.indexOf("xig_polaris_media") === -1) continue;
      try {
        var payload = JSON.parse(txt);
        var found = walk(payload);
        if (found) return found;
      } catch (e) { /* try next script */ }
    }
    // DOM fallback: <video> currentSrc, or og:video
    var v = document.querySelector("video");
    var og = document.querySelector('meta[property="og:video"]') || document.querySelector('meta[property="og:image"]');
    return { __dom: true, video_url: (v && v.currentSrc) || (og && og.getAttribute("content")) || "", display_uri: (og && og.getAttribute("content")) || "" };
  }
  function main() {
    var raw = findMedia();
    if (!raw) { alert("BOB: public post not found on this page (try a logged-out incognito view?)"); return; }
    var post = raw.if_not_gated_logged_out || raw;
    var url = post.video_url || bestV(post.video_versions) || bestI(post.image_versions2 && post.image_versions2.candidates) || post.display_uri || post.display_url || (raw.__dom ? raw.video_url : "");
    if (!url) { alert("BOB: no media URL found (photo has no video — trying image)."); }
    var name = "bob-" + (post.code || "instagram") + ((post.media_type === 2 || url.indexOf(".mp4") !== -1) ? ".mp4" : ".jpg");
    function saveBlob(u) {
      fetch(u, { mode: "cors" }).then(function (r) { return r.blob(); }).then(function (b) {
        var tmp = document.createElement("a");
        tmp.href = URL.createObjectURL(b);
        tmp.download = name;
        tmp.rel = "noreferrer";
        document.body.appendChild(tmp);
        tmp.click();
        tmp.remove();
        setTimeout(function () { URL.revokeObjectURL(tmp.href); }, 5000);
      }).catch(function () { window.open(u, "_blank", "noopener"); });
    }
    saveBlob(url);
    // Handoff (optional): open BOB gallery with media summary in hash
    try {
      var summary = { shortcode: post.code || "", video_url: url, thumb: post.display_uri || post.display_url || "" };
      var handoff = "https://www.bob.example.com/#m=" + btoa(unescape(encodeURIComponent(JSON.stringify(summary))));
      if (confirm("BOB: download started. Open BOB gallery to share / save to WhatsApp?")) window.open(handoff, "_blank");
    } catch (e) { /* download is the product; handoff is optional */ }
  }
  main();
  void 0;
})();
