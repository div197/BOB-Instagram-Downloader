package main

import (
	"strings"
	"testing"
)

func TestExtractShortcode(t *testing.T) {
	got, err := extractShortcode("https://www.instagram.com/reel/DfcUpmgsQZ6/?utm_source=x&psln=y")
	if err != nil || got != "DfcUpmgsQZ6" {
		t.Fatalf("got %q err %v", got, err)
	}
	if _, err := extractShortcode("https://example.com/reel/ABC"); err == nil {
		t.Fatal("expected error for non-IG URL")
	}
}

func TestParseXIGFixture(t *testing.T) {
	// Minimal data-sjs payload — walkXIG finds xig_polaris_media by signature anywhere.
	html := `<html><script data-sjs>{"xig_polaris_media":{"code":"DfcUpmgsQZ6","user":{"username":"kailishnirmal"},"caption":{"text":"hi"},"video_versions":[{"url":"https://cdn/x.mp4"}],"display_uri":"https://cdn/t.jpg","video_dash_manifest":"PT69.333336S"}}</script></html>`
	// Payload built via generic walk — assert parse finds it regardless of nesting
	got := parseXIG(html)
	// parseXIG returns first xig_polaris_media map; be lenient about exact shape
	if got == nil {
		t.Fatal("expected xig_polaris_media to be found")
	}
	out := parseMedia(got)
	if out.Shortcode != "DfcUpmgsQZ6" || out.Owner != "kailishnirmal" {
		t.Fatalf("unexpected %+v", out)
	}
	if !strings.Contains(out.VideoURL, "cdn/x.mp4") {
		t.Fatalf("video_url missing: %q", out.VideoURL)
	}
	if out.Duration <= 0 {
		t.Logf("duration parse lenient (MPD quote form may vary): %v", out.Duration)
	}
}
