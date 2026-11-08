"""HTTP fetcher with browser-shaped TLS fingerprint.

curl_cffi (Chrome impersonation) is mandatory for Instagram in 2026 —
plain requests gets a gutted payload (ScrapFly, Sep 2026).
Proxy injected via env IG_PROXY (e.g. http://user:pass@host:port).
"""
from __future__ import annotations

import os

_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
)

_HEADERS = {
    "User-Agent": _UA,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://www.instagram.com/",
    "Sec-Fetch-Site": "same-origin",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-User": "?1",
}


class Fetcher:
    """thin wrapper; swaps in curl_cffi when available."""

    def __init__(self, proxy: str | None = None, timeout: float = 20.0):
        self.proxy = proxy or os.environ.get("IG_PROXY")
        self.timeout = timeout

    def get(self, url: str, headers: dict | None = None, timeout: float | None = None):
        h = {**_HEADERS, **(headers or {})}
        t = timeout or self.timeout
        proxies = {"http": self.proxy, "https": self.proxy} if self.proxy else None
        try:
            from curl_cffi import requests as cffi_requests

            return cffi_requests.get(
                url, headers=h, timeout=t, proxies=proxies,
                impersonate="chrome", allow_redirects=True,
            )
        except ImportError:
            import urllib.request

            req = urllib.request.Request(url, headers=h)
            with urllib.request.urlopen(req, timeout=t) as r:  # noqa: S310
                body = r.read().decode("utf-8", "ignore")
                return _Resp(r.status, body, dict(r.headers), r.url)

    def post(self, url: str, data: dict, headers: dict | None = None, timeout: float | None = None):
        h = {**_HEADERS, **(headers or {})}
        t = timeout or self.timeout
        proxies = {"http": self.proxy, "https": self.proxy} if self.proxy else None
        try:
            from curl_cffi import requests as cffi_requests

            return cffi_requests.post(
                url, data=data, headers=h, timeout=t, proxies=proxies,
                impersonate="chrome", allow_redirects=True,
            )
        except ImportError:
            import urllib.parse as up
            import urllib.request

            body = up.urlencode(data).encode()
            req = urllib.request.Request(url, data=body, headers=h, method="POST")
            with urllib.request.urlopen(req, timeout=t) as r:  # noqa: S310
                txt = r.read().decode("utf-8", "ignore")
                return _Resp(r.status, txt, dict(r.headers), r.url)


class _Resp:
    def __init__(self, status_code: int, text: str, headers: dict, url: str):
        self.status_code = status_code
        self.text = text
        self.headers = headers
        self.url = url

    def json(self):
        import json

        return json.loads(self.text)
