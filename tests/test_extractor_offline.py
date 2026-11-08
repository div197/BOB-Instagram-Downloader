"""Offline tests — no network. Locks the parser against silent IG schema drift."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from services.extractor.cache import ShortcodeCache
from services.extractor.l1 import extract_xig_polaris_media, parse_media
from services.extractor.l3 import select_formats
from services.extractor.normalize import extract_shortcode
from services.extractor.errors import InvalidURLError
from tests.fixture import make_sample_html


def test_normalize_strips_tracking():
    assert extract_shortcode("https://www.instagram.com/reel/DfcUpmgsQZ6/?utm_source=ig_web_copy_link&psln=XYZ==") == "DfcUpmgsQZ6"
    assert extract_shortcode("https://instagram.com/p/DfcUpmgsQZ6/") == "DfcUpmgsQZ6"
    assert extract_shortcode("https://m.instagram.com/reel/DfcUpmgsQZ6/") == "DfcUpmgsQZ6"


def test_normalize_rejects_stories():
    try:
        extract_shortcode("https://www.instagram.com/stories/someuser/123456/")
        raise AssertionError("should have raised")
    except InvalidURLError:
        pass


def test_l1_parse_full_schema():
    html = make_sample_html()
    media = extract_xig_polaris_media(html)
    assert media is not None
    out = parse_media(media)
    assert out["shortcode"] == "DfcUpmgsQZ6"
    assert out["owner"] == "kailishnirmal"
    assert out["like_count"] == 180113
    assert out["comment_count"] == 301
    assert out["duration"] == 69.333336  # from DASH
    assert out["number_of_qualities"] == 9
    m = out["media"][0]
    assert m["video_url"] == "https://cdn.example/1080.mp4"  # best ranked
    assert len(m["video_versions"]) == 2
    assert m["image_versions"][0]["width"] == 1080


def test_l1_empty_html_returns_none():
    assert extract_xig_polaris_media("<html><body>no data</body></html>") is None


def test_l3_format_prefers_combined():
    info = {
        "formats": [
            {"format_id": "b", "ext": "mp4", "vcodec": "avc1", "acodec": "mp4a", "height": 720, "tbr": 1000, "url": "https://x/combined.mp4"},
            {"format_id": "v", "ext": "mp4", "vcodec": "avc1", "acodec": "none", "height": 1080, "tbr": 2000, "url": "https://x/video.mp4"},
            {"format_id": "a", "ext": "m4a", "vcodec": "none", "acodec": "mp4a", "tbr": 128, "url": "https://x/audio.m4a"},
        ]
    }
    chosen, audio = select_formats(info)
    assert chosen["url"] == "https://x/combined.mp4"
    assert audio["url"] == "https://x/audio.m4a"


def test_l3_format_avc_cap_1080():
    info = {
        "formats": [
            {"format_id": "v1080", "ext": "mp4", "vcodec": "avc1", "acodec": "none", "height": 1080, "tbr": 2000, "url": "https://x/1080.mp4"},
            {"format_id": "v2160", "ext": "mp4", "vcodec": "avc1", "acodec": "none", "height": 2160, "tbr": 4000, "url": "https://x/2160.mp4"},
        ]
    }
    chosen, _ = select_formats(info)
    assert chosen["url"] == "https://x/1080.mp4"


def test_cache_put_get_and_expiry(tmp_path):
    c = ShortcodeCache(tmp_path / "t.sqlite3")
    c.put("ABC123", {"shortcode": "ABC123", "type": "reel", "media": [{"video_url": "https://cdn/x.mp4?oe=FFFFFFFFFF"}]})
    hit = c.get("ABC123")
    assert hit is not None and hit["shortcode"] == "ABC123" and hit["_cached"] is True
    assert c.get("MISSING") is None


def test_pipeline_cache_short_circuits_network(tmp_path, monkeypatch):
    from services.extractor.pipeline import Extractor
    monkeypatch.setattr(Extractor, "l1_extract", lambda self, sc: (_ for _ in ()).throw(AssertionError("network should not run")))
    c = ShortcodeCache(tmp_path / "t2.sqlite3")
    c.put("DfcUpmgsQZ6", {"shortcode": "DfcUpmgsQZ6", "type": "reel", "media": []})
    ex = Extractor(cache=c)
    out = ex.extract("https://www.instagram.com/reel/DfcUpmgsQZ6/")
    assert out["shortcode"] == "DfcUpmgsQZ6" and out["_cached"] is True
