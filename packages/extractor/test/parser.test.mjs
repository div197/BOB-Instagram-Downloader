import { test } from "node:test";
import assert from "node:assert/strict";
import { extractXigPolarisMedia, parseMedia } from "../dist/index.js";
import { makeSampleHTML, makePhotoHTML, makeCarouselHTML } from "./fixture.mjs";

test("L1 parse reel full schema", () => {
  const media = extractXigPolarisMedia(makeSampleHTML());
  assert.notEqual(media, null);
  const out = parseMedia(media);
  assert.equal(out.shortcode, "DfcUpmgsQZ6");
  assert.equal(out.owner, "kailishnirmal");
  assert.equal(out.like_count, 180113);
  assert.equal(out.duration, 69.333336);
  assert.equal(out.number_of_qualities, 9);
  assert.equal(out.media[0].video_url, "https://cdn.example/1080.mp4");
  assert.equal(out.media[0].image_versions[0].width, 1080);
});

test("photo — no video, image ladder only", () => {
  const out = parseMedia(extractXigPolarisMedia(makePhotoHTML()));
  assert.equal(out.type, "XIGPolarisPhotoMedia");
  assert.equal(out.media[0].is_video, false);
  assert.equal(out.media[0].video_url, "");
  assert.equal(out.media[0].thumbnail, "https://cdn.example/photo1080.jpg?oe=6AF5EC4C");
  assert.equal(out.media[0].image_versions[0].width, 1080);
});

test("carousel — photo + video sidecar", () => {
  const out = parseMedia(extractXigPolarisMedia(makeCarouselHTML()));
  assert.equal(out.type, "XIGPolarisCarouselMedia");
  assert.equal(out.media.length, 2);
  assert.equal(out.media[0].is_video, false);
  assert.equal(out.media[1].is_video, true);
  assert.equal(out.media[1].video_url, "https://cdn.example/car2.mp4");
});

test("empty HTML returns null", () => {
  assert.equal(extractXigPolarisMedia("<html><body>no data</body></html>"), null);
});

test("fallback: walk finds media even when module order changes", () => {
  // Same media, payload shuffled — deep walk must still find it
  const html = makeSampleHTML();
  const payload = JSON.parse(/<script[^>]*data-sjs[^>]*>([\s\S]*?)<\/script>/.exec(html)[1]);
  const wrapped = `<html><script data-sjs>${JSON.stringify({ wrapper: payload })}</script></html>`;
  const media = extractXigPolarisMedia(wrapped);
  assert.notEqual(media, null);
  assert.equal(media.code, "DfcUpmgsQZ6");
});
