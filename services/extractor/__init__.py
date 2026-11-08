"""BOB extractor kernel — roots of the upside-down tree (Gita 15.1).

Layers: L0 oEmbed preview → L1 inline JSON (data-sjs) →
L2 GraphQL persisted query → L3 yt-dlp engine → L4 managed fallback (opt-in).

Public-only. No cookies, no login, no private-account attempts.
"""
from .errors import (
    BOBError,
    InvalidURLError,
    PrivateError,
    RateLimitedError,
    SourceTimeoutError,
    MediaExpiredError,
    UnsupportedMediaError,
    ExtractionFailedError,
)
from .pipeline import Extractor, MediaResult

__all__ = [
    "BOBError",
    "InvalidURLError",
    "PrivateError",
    "RateLimitedError",
    "SourceTimeoutError",
    "MediaExpiredError",
    "UnsupportedMediaError",
    "ExtractionFailedError",
    "Extractor",
    "MediaResult",
]
