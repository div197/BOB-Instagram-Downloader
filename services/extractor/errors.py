"""Typed error taxonomy (gentleman failure — honest, actionable, never a 500 to users)."""


class BOBError(Exception):
    code: str = "EXTRACTION_FAILED"
    http: int = 502
    retry_after: int | None = None

    def __init__(self, message: str, retry_after: int | None = None):
        super().__init__(message)
        if retry_after is not None:
            self.retry_after = retry_after


class InvalidURLError(BOBError):
    code = "INVALID_URL"
    http = 400


class PrivateError(BOBError):
    code = "PRIVATE"
    http = 403


class RateLimitedError(BOBError):
    code = "SOURCE_RATE_LIMITED"
    http = 429


class SourceTimeoutError(BOBError):
    code = "SOURCE_TIMEOUT"
    http = 504
    retry_after = 60


class MediaExpiredError(BOBError):
    code = "MEDIA_EXPIRED"
    http = 410
    retry_after = 0


class UnsupportedMediaError(BOBError):
    code = "UNSUPPORTED_MEDIA"
    http = 422


class ExtractionFailedError(BOBError):
    code = "EXTRACTION_FAILED"
    http = 502
