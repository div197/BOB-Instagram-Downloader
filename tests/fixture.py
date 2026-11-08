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
