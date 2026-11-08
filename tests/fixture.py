"""Offline fixture — minimal data-sjs HTML (synthesized from live schema)."""
import json


def make_sample_html(shortcode="DfcUpmgsQZ6", owner="kailishnirmal"):
    media = {
        "__typename": "XIGPolarisVideoMedia",
        "code": shortcode,
        "pk": "4025182986741810810",
        "taken_at": 1794059312,
        "like_count": 180113,
        "comment_count": 301,
        "product_type": "clips",
        "media_type": 2,
        "user": {"username": owner, "pk": "5279874734"},
        "caption": {"text": "Happy Diwali 🪔 \n\n#happydiwali"},
        "display_uri": "https://scontent.cdninstagram.com/img.jpg?oe=6AF5EC4C",
        "video_versions": [
            {"type": 101, "url": "https://cdn.example/720.mp4"},
            {"type": 103, "url": "https://cdn.example/1080.mp4"},
        ],
        "image_versions2": {
            "candidates": [
                {"url": "https://cdn.example/720.jpg", "width": 720, "height": 720},
                {"url": "https://cdn.example/1080.jpg", "width": 1080, "height": 1920},
            ]
        },
        "video_dash_manifest": '<MPD mediaPresentationDuration="PT69.333336S"><Period></Period></MPD>',
        "is_dash_eligible": True,
        "number_of_qualities": 9,
        "original_width": 1080,
        "original_height": 1920,
    }
    payload = {
        "require": [
            [
                "x",
                "y",
                "z",
                [
                    {
                        "__bbox": {
                            "require": [
                                [
                                    "a",
                                    "b",
                                    "c",
                                    [
                                        {"__bbox": {"result": {"data": {"xig_polaris_media": media}}}}
                                    ],
                                ]
                            ]
                        }
                    }
                ],
            ]
        ]
    }
    return f'<html><script data-sjs>{json.dumps(payload)}</script></html>'


def make_photo_html(shortcode="Cphoto00001", owner="photopro"):
    """Photo fixture: media_type=1, no video_versions, no dash — image_versions2 only."""
    media = {
        "__typename": "XIGPolarisPhotoMedia",
        "code": shortcode, "pk": "1234567890123456789",
        "taken_at": 1794050000, "like_count": 5200, "comment_count": 80,
        "product_type": "", "media_type": 1,
        "user": {"username": owner}, "caption": {"text": "Golden hour"},
        "display_uri": "https://cdn.example/photo1080.jpg?oe=6AF5EC4C",
        "image_versions2": {"candidates": [
            {"url": "https://cdn.example/photo150.jpg", "width": 150, "height": 150},
            {"url": "https://cdn.example/photo1080.jpg", "width": 1080, "height": 1080},
        ]},
        "original_width": 1080, "original_height": 1080,
        "video_versions": [], "video_dash_manifest": "",
        "is_dash_eligible": False, "number_of_qualities": 0,
    }
    entry = {"__bbox": {"result": {"data": {"xig_polaris_media": media}}}}
    module = ["a", "b", "c", [entry]]
    inner = {"__bbox": {"require": [module]}}
    payload = {"require": [["x", "y", "z", [inner]]]}
    return f'<html><script data-sjs>{json.dumps(payload)}</script></html>'


def make_carousel_html(shortcode="Ccar0000001", owner="traveldiary"):
    """Carousel fixture: media_type=8, mixed sidecar (photo + video)."""
    child_photo = {
        "__typename": "XIGPolarisPhotoMedia", "media_type": 1,
        "display_uri": "https://cdn.example/car1.jpg",
        "image_versions2": {"candidates": [{"url": "https://cdn.example/car1_1080.jpg", "width": 1080, "height": 1080}]},
        "original_width": 1080, "original_height": 1080,
    }
    child_video = {
        "__typename": "XIGPolarisVideoMedia", "media_type": 2,
        "display_uri": "https://cdn.example/car2.jpg",
        "video_versions": [{"type": 101, "url": "https://cdn.example/car2.mp4"}],
        "video_dash_manifest": '<MPD mediaPresentationDuration="PT12.5S"><Period></Period></MPD>',
        "original_width": 720, "original_height": 1280,
    }
    media = {
        "__typename": "XIGPolarisCarouselMedia", "code": shortcode, "pk": "9876543210987654321",
        "taken_at": 1794040000, "like_count": 3200, "comment_count": 40,
        "product_type": "carousel_container", "media_type": 8,
        "user": {"username": owner}, "caption": {"text": "Trip dump"},
        "carousel_media": [child_photo, child_video],
        "is_dash_eligible": True, "number_of_qualities": 3,
    }
    entry = {"__bbox": {"result": {"data": {"xig_polaris_media": media}}}}
    module = ["a", "b", "c", [entry]]
    inner = {"__bbox": {"require": [module]}}
    payload = {"require": [["x", "y", "z", [inner]]]}
    return f'<html><script data-sjs>{json.dumps(payload)}</script></html>'
