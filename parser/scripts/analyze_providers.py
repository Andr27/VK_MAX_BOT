#!/usr/bin/env python
"""Utility to summarize providers_status.json file."""

from __future__ import annotations

import json
from collections import Counter, defaultdict
from pathlib import Path


def main() -> None:
    path = Path("providers_status.json")
    data = json.loads(path.read_text(encoding="utf-8"))

    status_counter = Counter(item.get("notes") or "unknown" for item in data)
    print("Status counts:")
    for status, count in status_counter.items():
        print(f"  {status}: {count}")

    issues: defaultdict[str, list[str]] = defaultdict(list)
    for item in data:
        if item.get("notes") == "embedded scheduleData":
            continue
        issues[item.get("notes") or "unknown"].append(item["slug"])

    if issues:
        print("\nNeeds manual work:")
        for note, slugs in sorted(issues.items()):
            print(f"- {note}: {', '.join(sorted(slugs))}")


if __name__ == "__main__":
    main()

