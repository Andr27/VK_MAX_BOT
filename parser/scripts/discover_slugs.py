#!/usr/bin/env python
"""Fetch dnevuch.ru front page and extract available schedule slugs."""

from __future__ import annotations

import re
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    )
}


def discover_slugs() -> dict[str, str]:
    resp = requests.get("https://dnevuch.ru", headers=HEADERS, timeout=30)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")
    slugs: dict[str, str] = {}

    for link in soup.select("a[href*='raspisanie-']"):
        href = link.get("href")
        if not href:
            continue
        full = urljoin(resp.url, href)
        match = re.search(r"raspisanie-([a-z0-9-]+)", full)
        if not match:
            continue
        slug = match.group(1)
        text = link.get_text(strip=True) or link.get("title") or ""
        slugs.setdefault(slug, text)
    return slugs


def main() -> None:
    for slug, label in sorted(discover_slugs().items()):
        print(f"{slug:15} {label}")


if __name__ == "__main__":
    main()

