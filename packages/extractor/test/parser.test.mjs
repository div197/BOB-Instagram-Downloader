import { test } from "node:test";
import assert from "node:assert/strict";
import { extractXigPolarisMedia, parseMedia } from "../dist/index.js";
import { makeSampleHTML } from "./fixture.mjs";

test("L1 parse full schema", () => {
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

test("empty HTML returns null", () => {
  assert.equal(extractXigPolarisMedia("<html><body>no data</body></html>"), null);
});
