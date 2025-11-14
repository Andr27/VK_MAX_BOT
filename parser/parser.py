import argparse
import difflib
import json
import re
import sys
import urllib.parse
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Dict, List, Protocol
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup, Tag

BASE_URL_TEMPLATE = "https://dnevuch.ru/raspisanie-{slug}"
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    )
}

PATTERN_GROUPS = re.compile(r"let\s+groups\s*=\s*(\[[\s\S]*?\]);")
PATTERN_SCHEDULE = re.compile(r"let\s+scheduleData\s*=\s*(\[[\s\S]*?\]);")
PATTERN_INFO = re.compile(r"let\s+info\s*=\s*(\{[\s\S]*?\});")

TOGU_GROUPS_URL = "https://togudv.ru/rasp/groups/"
TOGU_GROUP_URL_TEMPLATE = TOGU_GROUPS_URL + "{group_id}/"
TOGU_PAIR_TIMES: dict[str, tuple[str, str]] = {
    "1": ("08:30", "10:00"),
    "2": ("10:10", "11:40"),
    "3": ("11:50", "13:20"),
    "4": ("13:50", "15:20"),
    "5": ("15:30", "17:00"),
    "6": ("17:10", "18:40"),
    "7": ("18:50", "20:20"),
    "8": ("20:30", "22:00"),
}
PAIR_LABEL_RE = re.compile(r"(\d+)\s*пара", re.IGNORECASE)
TIME_RE = re.compile(r"\b(\d{1,2}:\d{2})\b")
HREF_DIGITS_RE = re.compile(r"^\d+/$")


def fetch_page(url: str) -> str:
    response = requests.get(url, headers=HEADERS, timeout=30)
    response.raise_for_status()
    response.encoding = "utf-8"
    return response.text


def extract_js_array(html: str, pattern: re.Pattern) -> list | None:
    match = pattern.search(html)
    if not match:
        return None

    try:
        return json.loads(match.group(1))
    except json.JSONDecodeError as error:
        raise ValueError(
            "Не удалось преобразовать данные из скрипта в JSON"
        ) from error


def extract_js_object(html: str, pattern: re.Pattern) -> dict | None:
    match = pattern.search(html)
    if not match:
        return None
    try:
        return json.loads(match.group(1))
    except json.JSONDecodeError:
        return None


def _normalize_week_type(raw: str) -> str | None:
    if not raw:
        return None
    normalized = raw.lower().replace(".", "").replace(" ", "")
    mapping = {
        "ч": "числ.",
        "чс": "числ.",
        "числ": "числ.",
        "з": "знам.",
        "зн": "знам.",
        "знам": "знам.",
    }
    return mapping.get(normalized, raw.strip())


def _parse_pair_cell(text: str) -> dict[str, Any]:
    text = re.sub(r"\s+", " ", text.strip())
    pair_info: dict[str, Any] = {"label": text or None}
    match_pair = PAIR_LABEL_RE.search(text)
    if match_pair:
        pair_info["number"] = match_pair.group(1)
    match_time = TIME_RE.search(text)
    if match_time:
        pair_info["start"] = match_time.group(1)
    number = pair_info.get("number")
    if number and number in TOGU_PAIR_TIMES:
        start_time, end_time = TOGU_PAIR_TIMES[number]
        pair_info["start"] = start_time
        pair_info["end"] = end_time
        pair_info["time_range"] = f"{start_time} - {end_time}"
    elif pair_info.get("start"):
        start = pair_info["start"]
        pair_info["time_range"] = start
    return pair_info


def _parse_rooms(cell: Tag | None) -> list[dict[str, Any]]:
    rooms: list[dict[str, Any]] = []
    if not cell:
        return rooms
    for link in cell.find_all("a", href=True):
        name = link.get_text(strip=True)
        if not name:
            continue
        rooms.append(
            {
                "name": name,
                "url": urljoin(TOGU_GROUPS_URL, link["href"]),
            }
        )
    if not rooms:
        text = " ".join(cell.stripped_strings)
        if text:
            rooms.append({"name": text, "url": None})
    return rooms


def _parse_teachers(cell: Tag | None) -> list[dict[str, Any]]:
    teachers: list[dict[str, Any]] = []
    if not cell:
        return teachers
    paragraphs = cell.find_all("p") or [cell]
    for item in paragraphs:
        content = item.get_text(strip=True)
        if not content:
            continue
        title_tag = item.find("span", class_="prepod-title")
        title = title_tag.get_text(strip=True) if title_tag else None
        if title_tag:
            title_tag.extract()
        link = item.find("a", href=True)
        if link:
            name = link.get_text(strip=True)
            href = urljoin(TOGU_GROUPS_URL, link["href"])
        else:
            name = item.get_text(strip=True)
            href = None
        teachers.append({"name": name, "title": title, "url": href})
    return teachers


def _parse_discipline(cell: Tag | None) -> dict[str, Any]:
    if not cell:
        return {
            "subject": None,
            "lesson_type": None,
            "lesson_type_full": None,
            "date_range": None,
            "subgroups": [],
        }
    copy = BeautifulSoup(str(cell), "html.parser").find("td")
    event_type_tag = copy.find("span", class_="event-type")
    lesson_type = None
    lesson_type_full = None
    if event_type_tag:
        lesson_type = event_type_tag.get_text(strip=True)
        lesson_type_full = event_type_tag.get("title")
        event_type_tag.extract()
    subgroups: list[str] = []
    for subgroup_tag in copy.select("span.event-subgroup"):
        text = subgroup_tag.get_text(strip=True)
        if text:
            subgroups.append(text)
        subgroup_tag.extract()
    strong_tag = copy.find("strong")
    date_range = None
    if strong_tag:
        date_range = strong_tag.get_text(strip=True)
        strong_tag.extract()
    mobile_block = copy.find("div", class_="visible-xs")
    if mobile_block:
        mobile_block.extract()
    subject = copy.get_text(" ", strip=True) or None
    return {
        "subject": subject,
        "lesson_type": lesson_type or None,
        "lesson_type_full": lesson_type_full or None,
        "date_range": date_range or None,
        "subgroups": subgroups,
    }


def _fetch_togu_group_ids() -> dict[str, str]:
    html = fetch_page(TOGU_GROUPS_URL)
    soup = BeautifulSoup(html, "html.parser")
    mapping: dict[str, str] = {}
    for link in soup.find_all("a", href=True):
        href = link["href"].strip()
        if not HREF_DIGITS_RE.match(href):
            continue
        name = link.get_text(strip=True)
        if name:
            mapping[name] = href.rstrip("/")
    if not mapping:
        raise ValueError("Не удалось получить список групп на сайте ТОГУ")
    return mapping


def _resolve_togu_group_name(
    group_name: str,
    group_ids: dict[str, str],
) -> str:
    if group_name in group_ids:
        return group_name

    variants = {group_name}
    # Попытки восстановить строку после проблем с кодировкой консоли.
    encodings = ("cp1251", "cp866", "latin-1")
    for enc in encodings:
        try:
            variants.add(
                group_name.encode(enc, errors="ignore").decode("utf-8")
            )
        except UnicodeError:
            pass
        try:
            variants.add(
                group_name.encode("utf-8", errors="ignore").decode(enc)
            )
        except UnicodeError:
            pass
    for variant in variants:
        if variant in group_ids:
            return variant
        lowered = variant.casefold()
        for key in group_ids:
            if key.casefold() == lowered:
                return key

    keys = list(group_ids.keys())
    matches = difflib.get_close_matches(group_name, keys, n=1, cutoff=0.6)
    if matches:
        return matches[0]
    matches = difflib.get_close_matches(
        group_name.casefold(),
        [key.casefold() for key in keys],
        n=1,
        cutoff=0.6,
    )
    if matches:
        idx = [key.casefold() for key in keys].index(matches[0])
        return keys[idx]

    raise ValueError(
        f"Группа '{group_name}' не найдена на сайте ТОГУ"
    )


def _parse_togu_schedule(html: str) -> list[dict[str, Any]]:
    soup = BeautifulSoup(html, "html.parser")
    container = soup.select_one("#all_weeks")
    if not container:
        return []

    days: list[dict[str, Any]] = []
    for heading in container.select("h3.rasp-weekday-title"):
        day_name = heading.get_text(strip=True)
        table = heading.find_next_sibling("table")
        lessons: list[dict[str, Any]] = []
        if table:
            current_pair: dict[str, Any] | None = None
            current_week_type: str | None = None
            for row in table.find_all("tr"):
                time_cell = row.find("td", class_="time-hour")
                if time_cell:
                    pair_text = " ".join(time_cell.stripped_strings)
                    current_pair = _parse_pair_cell(pair_text)
                week_cell = row.find("td", class_="time-weektype")
                if week_cell is not None:
                    week_text = " ".join(week_cell.stripped_strings)
                    current_week_type = _normalize_week_type(week_text)
                discipline_cell = row.find("td", class_="time-discipline")
                room_cell = row.find("td", class_="time-room")
                teacher_cell = row.find("td", class_="time-prepod")

                info = _parse_discipline(discipline_cell)
                if not info["subject"] and not room_cell and not teacher_cell:
                    continue

                lesson = {
                    "pair": current_pair or {},
                    "week_type": current_week_type,
                    "subject": info["subject"],
                    "lesson_type": info["lesson_type"],
                    "lesson_type_full": info["lesson_type_full"],
                    "date_range": info["date_range"],
                    "subgroups": info["subgroups"],
                    "rooms": _parse_rooms(room_cell),
                    "teachers": _parse_teachers(teacher_cell),
                }
                lessons.append(lesson)
        days.append({"name": day_name, "lessons": lessons})
    return days


class ScheduleProvider(Protocol):
    slug: str

    def list_groups(self) -> list[dict]:
        ...

    def get_schedule(self, group_name: str) -> Any:
        ...


class DnevuchEmbeddedProvider:
    def __init__(self, slug: str) -> None:
        self.slug = slug.lower()
        self.base_url = BASE_URL_TEMPLATE.format(slug=self.slug)

    def list_groups(self) -> list[dict]:
        html = fetch_page(self.base_url)
        groups = extract_js_array(html, PATTERN_GROUPS)
        if groups is None:
            raise ValueError("Список групп не найден на странице")
        return groups

    def get_schedule(self, group_name: str) -> Any:
        query = urllib.parse.quote(group_name)
        page = fetch_page(f"{self.base_url}?group={query}")
        schedule = extract_js_array(page, PATTERN_SCHEDULE)
        if schedule is None:
            info = extract_js_object(page, PATTERN_INFO)
            hint = ""
            if info and info.get("url"):
                hint = f" Попробуйте перейти на {info['url']}."
            raise ValueError(
                "Расписание не найдено. Проверь название группы или доступность данных."
                + hint
            )
        return schedule


class ToguScheduleProvider:
    slug = "togu"

    def list_groups(self) -> list[dict]:
        mapping = _fetch_togu_group_ids()
        return [
            {"number": name, "group_id": group_id}
            for name, group_id in sorted(mapping.items())
        ]

    def get_schedule(self, group_name: str) -> dict[str, Any]:
        group_ids = _fetch_togu_group_ids()
        group_key = _resolve_togu_group_name(group_name, group_ids)
        if group_key != group_name:
            print(
                f"Использую ближайшее совпадение группы: {group_key}",
                file=sys.stderr,
            )
        group_id = group_ids[group_key]

        source_url = TOGU_GROUP_URL_TEMPLATE.format(group_id=group_id)
        html = fetch_page(source_url)
        days = _parse_togu_schedule(html)
        return {
            "provider": "togudv.ru",
            "group": group_key,
            "group_id": group_id,
            "source": source_url,
            "retrieved_at": datetime.now(timezone.utc).isoformat(),
            "pair_times": TOGU_PAIR_TIMES,
            "days": days,
        }


PROVIDER_FACTORIES: Dict[str, Callable[[], ScheduleProvider]] = {
    "togu": ToguScheduleProvider,
}


def get_provider(slug: str) -> ScheduleProvider:
    slug_lower = slug.lower()
    factory = PROVIDER_FACTORIES.get(slug_lower)
    if factory:
        return factory()
    return DnevuchEmbeddedProvider(slug_lower)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Парсер расписания с dnevuch.ru"
    )
    parser.add_argument(
        "--slug",
        default="togu",
        help="суффикс URL (например: togu, tpu, pskovgu)"
    )
    parser.add_argument(
        "--group",
        help="название группы, точно как на сайте"
    )
    parser.add_argument(
        "--list-groups",
        action="store_true",
        help="вывести список доступных групп и завершить работу"
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("schedule.json"),
        help="путь к файлу для сохранения расписания"
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    provider = get_provider(args.slug)

    if args.list_groups:
        try:
            groups = provider.list_groups()
        except Exception as exc:
            print(f"Ошибка: {exc}", file=sys.stderr)
            sys.exit(1)

        for item in groups:
            direction = item.get("direction") or item.get("faculty") or ""
            number = item.get("number") or ""
            if direction:
                print(f"{number} ({direction})")
            else:
                print(number)
        return

    if not args.group:
        print("Укажите группу (--group) или используйте --list-groups")
        sys.exit(1)

    try:
        schedule = provider.get_schedule(args.group)
    except Exception as exc:
        print(f"Ошибка: {exc}", file=sys.stderr)
        sys.exit(1)

    args.output.write_text(
        json.dumps(schedule, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )
    print(f"Расписание сохранено в {args.output}")


if __name__ == "__main__":
    main()
