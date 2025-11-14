#!/usr/bin/env python
"""Utility to inspect dnevuch.ru schedule sources for multiple slugs."""

from __future__ import annotations

import argparse
import json
import sys
import urllib.parse
from dataclasses import dataclass
from typing import Any, Iterable

import requests

from discover_slugs import discover_slugs

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    )
}

PATTERN_GROUPS = r"let\s+groups\s*=\s*(\[[\s\S]*?\]);"
PATTERN_SCHEDULE = r"let\s+scheduleData\s*=\s*(\[[\s\S]*?\]);"
PATTERN_INFO = r"let\s+info\s*=\s*(\{[\s\S]*?\});"


@dataclass
class SlugResult:
    slug: str
    sample_group: str | None
    schedule_items: int | str | None
    info_url: str | None
    notes: str | None = None

    def as_dict(self) -> dict[str, Any]:
        return {
            "slug": self.slug,
            "sample_group": self.sample_group,
            "schedule_items": self.schedule_items,
            "info_url": self.info_url,
            "notes": self.notes,
        }


def fetch(url: str) -> str:
    resp = requests.get(url, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    resp.encoding = "utf-8"
    return resp.text


def extract_json(text: str, pattern: str) -> Any | None:
    import re

    match = re.search(pattern, text)
    if not match:
        return None
    payload = match.group(1)
    payload = payload.strip()
    if not payload:
        return None
    try:
        return json.loads(payload)
    except json.JSONDecodeError:
        return None


def inspect_slug(slug: str, *, preferred_group: str | None = None) -> SlugResult:
    base_url = f"https://dnevuch.ru/raspisanie-{slug}"
    try:
        base_html = fetch(base_url)
    except Exception as exc:  # noqa: BLE001
        return SlugResult(slug, None, None, None, notes=f"base_error: {exc}")

    groups = extract_json(base_html, PATTERN_GROUPS)
    if not groups:
        return SlugResult(slug, None, None, None, notes="no groups array")

    sample_group = preferred_group
    if not sample_group:
        sample_group = groups[0].get("number")
    if not sample_group:
        return SlugResult(slug, None, None, None, notes="no sample group")

    detail_url = f"{base_url}?group={urllib.parse.quote(sample_group)}"
    try:
        detail_html = fetch(detail_url)
    except Exception as exc:  # noqa: BLE001
        return SlugResult(slug, sample_group, None, None, notes=f"group_error: {exc}")

    schedule = extract_json(detail_html, PATTERN_SCHEDULE)
    schedule_len: int | str | None = None
    if schedule is None:
        schedule_len = None
    else:
        try:
            schedule_len = len(schedule)
        except TypeError:
            schedule_len = "not_list"

    info = extract_json(detail_html, PATTERN_INFO)
    info_url = None
    if isinstance(info, dict):
        info_url = info.get("url") or info.get("source")

    notes = None
    if schedule_len == 0 and info_url is None:
        notes = "empty scheduleData"
    elif schedule_len and schedule_len > 0:
        notes = "embedded scheduleData"
    elif info_url:
        notes = "external url"

    return SlugResult(slug, sample_group, schedule_len, info_url, notes)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Inspect dnevuch.ru schedule sources for slugs."
    )
    parser.add_argument(
        "slugs",
        nargs="*",
        help="Slug names (default: a short built-in list)",
    )
    parser.add_argument(
        "--group",
        action="append",
        default=[],
        metavar="slug=GROUP",
        help="Provide explicit group for slug (can be repeated).",
    )
    parser.add_argument(
        "--discover",
        action="store_true",
        help="Auto-discover slugs from dnevuch.ru homepage.",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Output JSON instead of table.",
    )
    return parser.parse_args()


def parse_group_overrides(values: Iterable[str]) -> dict[str, str]:
    overrides: dict[str, str] = {}
    for value in values:
        if "=" not in value:
            raise SystemExit(f"invalid --group value '{value}', expected slug=GROUP")
        slug, group = value.split("=", 1)
        overrides[slug.strip().lower()] = group.strip()
    return overrides


DEFAULT_SLUGS = [
    "togu",
    "tpu",
    "pskovgu",
    "bgtu",
    "bgpu",
    "mgik",
    "chgik",
    "samgtu",
    "sgtu",
    "spbgasu",
]


def main() -> None:
    args = parse_args()
    slugs: list[str] = []
    if args.discover:
        slugs.extend(sorted(discover_slugs().keys()))
    slugs.extend(args.slugs)
    if not slugs:
        slugs = DEFAULT_SLUGS
    overrides = parse_group_overrides(args.group)

    results = [
        inspect_slug(slug, preferred_group=overrides.get(slug.lower()))
        for slug in slugs
    ]

    if args.json:
        json.dump([item.as_dict() for item in results], sys.stdout, ensure_ascii=False, indent=2)
        print()
        return

    print(f"{'slug':10} {'group':25} {'schedule':10} {'info_url'}")
    for item in results:
        print(
            f"{item.slug:10} "
            f"{(item.sample_group or '-'):25} "
            f"{str(item.schedule_items):10} "
            f"{item.info_url or item.notes or ''}"
        )


if __name__ == "__main__":
    main()

