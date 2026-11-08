"""Offline tests — no network. Locks the parser against silent IG schema drift."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from services.extractor.l1 import extract_xig_polaris_media, parse_media
from services.extractor.l3 import select_formats
from services.extractor.normalize import extract_shortcode
from services.extractor.errors import InvalidURLError
from tests.fixture import make_carousel_html, make_photo_html, make_sample_html
from services.extractor.l1 import extract_xig_polaris_media as py_extract


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
# (No-cache design: cache feature removed per owner constraint — no cache store, no short-circuit test.)


def test_photo_media_type():
    out = parse_media(extract_xig_polaris_media(make_photo_html()))
    assert out["type"] == "XIGPolarisPhotoMedia"
    assert out["media"][0]["is_video"] is False
    assert out["media"][0]["image_versions"][0]["width"] == 1080


def test_carousel_mixed_sidecar():
    out = parse_media(extract_xig_polaris_media(make_carousel_html()))
    assert out["type"] == "XIGPolarisCarouselMedia"
    assert len(out["media"]) == 2
    assert out["media"][0]["is_video"] is False  # photo
    assert out["media"][1]["is_video"] is True  # video
    assert out["media"][1]["video_url"] == "https://cdn.example/car2.mp4"

