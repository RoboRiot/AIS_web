#!/usr/bin/env python3
"""Collect the official GE HealthCare MRI service-parts catalog.

The GE HealthCare Service Shop exposes its MRI parts category in a paginated
public catalog. This collector preserves the storefront's "Most Popular"
ordering, saves resumable checkpoints, and removes duplicate part numbers.

Examples:
    py -3 scrape_ge_ge_mri.py
    py -3 scrape_ge_ge_mri.py --workers 4 --delay 0.35
    py -3 scrape_ge_ge_mri.py --max-pages 10 --fresh
"""

from __future__ import annotations

import argparse
import html
import json
import math
import random
import re
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import unquote, urljoin

import requests


BASE_URL = "https://services.gehealthcare.com"
STOREFRONT_URL = f"{BASE_URL}/gehcstorefront/"
CATEGORY_URL = f"{BASE_URL}/gehcstorefront/c/Parts"
SITEMAP_URL = f"{BASE_URL}/gehcstorefront/sitemap.xml"
MRI_CATEGORY_CODE = "DIMagneticResonanceImaging"
DEFAULT_OUTPUT = Path(__file__).with_name("ge-MRI-GE.json")
DEFAULT_CHECKPOINT = Path(__file__).with_name(".ge-MRI-GE.checkpoint.json")
USER_AGENT = (
    "Advanced-Imaging-Services-Part-Research/1.0 "
    "(+https://advancedimagingparts.com)"
)
QUERY = f":mostpopular:allCategories:~{MRI_CATEGORY_CODE}"

FOUND_RE = re.compile(r"\(([0-9,]+)\s+Found\)", re.IGNORECASE)
PAGE_RE = re.compile(r"(?:[?&]|&amp;)page=([0-9]+)", re.IGNORECASE)
CARD_RE = re.compile(
    r"<li\s+class=[\"'][^\"']*\bnoBorderR\b[^\"']*[\"'][^>]*>",
    re.IGNORECASE,
)
PRODUCT_LINK_RE = re.compile(
    r"<a\b(?=[^>]*\bclass=[\"'][^\"']*\bproductMainLink\b[^\"']*[\"'])"
    r"(?=[^>]*\bhref=[\"'](?:https?://[^\"']+)?/gehcstorefront/p/([^\"'?]+)[\"'])"
    r"(?=[^>]*\btitle=[\"']([^\"']*)[\"'])[^>]*>",
    re.IGNORECASE | re.DOTALL,
)
IMAGE_TAG_RE = re.compile(
    r"<img\b(?=[^>]*\bitemprop=[\"']image[\"'])[^>]*>",
    re.IGNORECASE | re.DOTALL,
)
SRC_RE = re.compile(r"\bsrc=[\"']([^\"']+)[\"']", re.IGNORECASE)
DESCRIPTION_RE = re.compile(
    r"<div\b[^>]*class=[\"'][^\"']*\bmvItemDetails\b[^\"']*\bdesc\b[^\"']*[\"'][^>]*>"
    r"\s*<label[^>]*>\s*Description\s*</label>\s*<p[^>]*>(.*?)</p>",
    re.IGNORECASE | re.DOTALL,
)
TAG_RE = re.compile(r"<[^>]+>")
SPACE_RE = re.compile(r"\s+")
FIELD_PATTERNS: dict[str, re.Pattern[str]] = {}
THREAD_LOCAL = threading.local()


def clean_text(value: str) -> str:
    value = TAG_RE.sub(" ", html.unescape(value or ""))
    return SPACE_RE.sub(" ", value).strip()


def clean_listing_value(value: str) -> str:
    value = clean_text(value)
    return re.sub(r"(?:,\s*)?\[\.\.\.\]\s*$", "", value).strip(" ,")


def normalize_part_number(value: str) -> str:
    return re.sub(r"[^A-Z0-9]", "", value.upper())


def field_pattern(label: str) -> re.Pattern[str]:
    if label not in FIELD_PATTERNS:
        FIELD_PATTERNS[label] = re.compile(
            rf"<label\b[^>]*>.*?{re.escape(label)}.*?</label>\s*"
            r"<div\b[^>]*>(.*?)</div>",
            re.IGNORECASE | re.DOTALL,
        )
    return FIELD_PATTERNS[label]


def extract_field(card_html: str, label: str) -> str:
    match = field_pattern(label).search(card_html)
    return clean_text(match.group(1)) if match else ""


def extract_description(card_html: str) -> str:
    match = DESCRIPTION_RE.search(card_html)
    return clean_text(match.group(1)) if match else ""


def get_session() -> requests.Session:
    session = getattr(THREAD_LOCAL, "session", None)
    if session is None:
        session = requests.Session()
        session.headers.update(
            {
                "User-Agent": USER_AGENT,
                "Accept": "text/html,application/xhtml+xml",
                "Accept-Language": "en-US,en;q=0.8",
                "Referer": STOREFRONT_URL,
            }
        )
        THREAD_LOCAL.session = session
    return session


def request_page(
    page: int,
    delay: float,
    timeout: float,
    retries: int,
    dynamic: bool = True,
) -> str:
    params: dict[str, str | int] = {
        "q": QUERY,
        "page": page,
        "viewAllPage": "no",
        "isMustInclude": "false",
    }
    if dynamic:
        params["dynamic"] = "Product"

    last_error = "unknown request error"
    for attempt in range(retries + 1):
        if delay > 0:
            time.sleep(random.uniform(delay, delay * 1.35))
        try:
            response = get_session().get(
                CATEGORY_URL,
                params=params,
                timeout=timeout,
                allow_redirects=True,
            )
            if response.status_code == 429:
                retry_after = response.headers.get("Retry-After", "")
                wait = float(retry_after) if retry_after.isdigit() else 2 ** (attempt + 2)
                last_error = f"rate limited (HTTP 429); retrying after {wait:.0f}s"
                time.sleep(wait)
                continue
            if response.status_code >= 500:
                last_error = f"temporary server error HTTP {response.status_code}"
                time.sleep(2 ** (attempt + 1))
                continue
            if response.status_code == 403:
                raise RuntimeError("GE HealthCare denied the request (HTTP 403)")
            response.raise_for_status()
            return response.text
        except requests.RequestException as exc:
            last_error = str(exc)
            if attempt < retries:
                time.sleep(2 ** (attempt + 1))

    raise RuntimeError(f"page {page + 1} failed after {retries + 1} attempts: {last_error}")


def catalog_metadata(page_html: str) -> tuple[int, int]:
    found_match = FOUND_RE.search(page_html)
    if not found_match:
        raise RuntimeError("GE HealthCare did not return an MRI result count")
    result_count = int(found_match.group(1).replace(",", ""))

    page_numbers = [int(value) for value in PAGE_RE.findall(page_html)]
    page_count = max(page_numbers, default=0) + 1
    if page_count <= 1 and result_count > 10:
        page_count = math.ceil(result_count / 10)
    return result_count, page_count


def parse_page(page_html: str, page: int) -> list[dict[str, Any]]:
    starts = list(CARD_RE.finditer(page_html))
    items: list[dict[str, Any]] = []

    for index, start in enumerate(starts):
        end = starts[index + 1].start() if index + 1 < len(starts) else len(page_html)
        card = page_html[start.end() : end]
        product_match = PRODUCT_LINK_RE.search(card)
        if not product_match:
            continue

        part_number = clean_text(unquote(product_match.group(1)))
        part_name = clean_text(product_match.group(2))
        if not normalize_part_number(part_number):
            continue

        image_url = ""
        image_match = IMAGE_TAG_RE.search(card)
        if image_match:
            src_match = SRC_RE.search(image_match.group(0))
            if src_match:
                image_url = urljoin(BASE_URL, html.unescape(src_match.group(1)))

        equivalent_items = clean_listing_value(extract_field(card, "Equivalent Item(s)"))
        manufacturer = extract_field(card, "Manufacturer") or "GE HealthCare"
        item_order = page * 10 + index + 1
        source_url = f"{BASE_URL}/gehcstorefront/p/{part_number}"

        items.append(
            {
                "sourceOrder": item_order,
                "popularityRank": item_order,
                "partNumber": part_number,
                "partName": part_name,
                "description": extract_description(card),
                "manufacturer": manufacturer,
                "manufacturerPartNumber": extract_field(card, "Manufacturer Part No."),
                "modality": "MRI",
                "condition": extract_field(card, "Condition"),
                "purchaseType": extract_field(card, "Purchase Type"),
                "equivalentItems": equivalent_items,
                "imageUrl": image_url,
                "sourceUrl": source_url,
                "sourcePage": page + 1,
                "catalogOccurrences": 1,
            }
        )

    return items


def fetch_and_parse_page(
    page: int,
    delay: float,
    timeout: float,
    retries: int,
) -> tuple[int, list[dict[str, Any]]]:
    page_html = request_page(page, delay, timeout, retries)
    items = parse_page(page_html, page)
    if not items:
        raise RuntimeError(f"page {page + 1} returned no product cards")
    return page, items


def atomic_write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(
        json.dumps(value, indent=2, ensure_ascii=True) + "\n",
        encoding="utf-8",
    )
    temporary.replace(path)


def load_checkpoint(path: Path) -> dict[int, list[dict[str, Any]]]:
    if not path.exists():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise RuntimeError(f"Could not read checkpoint {path}: {exc}") from exc
    if data.get("query") != QUERY:
        raise RuntimeError(f"Checkpoint {path} belongs to a different catalog query")
    return {int(page): items for page, items in data.get("pages", {}).items()}


def save_checkpoint(
    path: Path,
    page_records: dict[int, list[dict[str, Any]]],
    reported_count: int,
    total_pages: int,
) -> None:
    atomic_write_json(
        path,
        {
            "query": QUERY,
            "reportedResultCount": reported_count,
            "totalPages": total_pages,
            "savedAt": datetime.now(timezone.utc).isoformat(),
            "pages": {str(page): page_records[page] for page in sorted(page_records)},
        },
    )


def is_ge_manufacturer(value: str) -> bool:
    normalized = clean_text(value).upper()
    return normalized.startswith("GE ") or normalized in {"GE", "GENERAL ELECTRIC"}


def deduplicate(
    page_records: dict[int, list[dict[str, Any]]],
) -> tuple[list[dict[str, Any]], int, int]:
    unique: dict[str, dict[str, Any]] = {}
    duplicates = 0
    excluded_non_ge = 0

    for page in sorted(page_records):
        for item in page_records[page]:
            if not is_ge_manufacturer(item["manufacturer"]):
                excluded_non_ge += 1
                continue
            key = normalize_part_number(item["partNumber"])
            if key not in unique:
                unique[key] = item
                continue
            duplicates += 1
            unique[key]["catalogOccurrences"] += 1

    items = sorted(unique.values(), key=lambda item: item["sourceOrder"])
    for rank, item in enumerate(items, start=1):
        item["popularityRank"] = rank
    return items, duplicates, excluded_non_ge


def build_output(
    page_records: dict[int, list[dict[str, Any]]],
    reported_count: int,
    total_pages: int,
    failed_pages: list[int],
) -> dict[str, Any]:
    items, duplicates, excluded_non_ge = deduplicate(page_records)
    raw_count = sum(len(records) for records in page_records.values())
    source_url = (
        f"{CATEGORY_URL}?q=:mostpopular:supercategories:~{MRI_CATEGORY_CODE}"
    )
    return {
        "source": "GE HealthCare Service Shop",
        "sourceUrl": source_url,
        "storefrontUrl": STOREFRONT_URL,
        "sitemapUrl": SITEMAP_URL,
        "manufacturer": "GE",
        "modality": "MRI",
        "collectedAt": datetime.now(timezone.utc).isoformat(),
        "orderingMethod": (
            "Official GE HealthCare MRI parts category in its displayed Most Popular "
            "order. GE HealthCare does not publish the sales-volume formula behind "
            "this ranking."
        ),
        "reportedResultCount": reported_count,
        "catalogPageCount": total_pages,
        "pagesCollected": len(page_records),
        "failedPages": [page + 1 for page in sorted(failed_pages)],
        "rawListingCount": raw_count,
        "nonGEListingsExcluded": excluded_non_ge,
        "duplicatesRemoved": duplicates,
        "uniquePartCount": len(items),
        "items": items,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Collect GE HealthCare's official GE MRI parts catalog."
    )
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--checkpoint", type=Path, default=DEFAULT_CHECKPOINT)
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--delay", type=float, default=0.35)
    parser.add_argument("--timeout", type=float, default=60.0)
    parser.add_argument("--retries", type=int, default=4)
    parser.add_argument("--checkpoint-every", type=int, default=40)
    parser.add_argument(
        "--max-pages",
        type=int,
        default=0,
        help="Limit collection for testing; 0 collects the complete catalog.",
    )
    parser.add_argument(
        "--fresh",
        action="store_true",
        help="Ignore and replace any existing checkpoint.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.workers < 1 or args.workers > 12:
        print("--workers must be between 1 and 12", file=sys.stderr)
        return 2
    if args.delay < 0 or args.retries < 0:
        print("--delay and --retries cannot be negative", file=sys.stderr)
        return 2

    print("Reading the official GE HealthCare MRI parts category...")
    try:
        first_html = request_page(0, args.delay, args.timeout, args.retries, dynamic=False)
        reported_count, total_pages = catalog_metadata(first_html)
    except (RuntimeError, requests.RequestException) as exc:
        print(f"Unable to read the catalog: {exc}", file=sys.stderr)
        return 1

    target_pages = total_pages
    if args.max_pages > 0:
        target_pages = min(target_pages, args.max_pages)
    print(
        f"GE reports {reported_count:,} MRI parts across {total_pages:,} pages; "
        f"collecting {target_pages:,} page(s)."
    )

    if args.fresh and args.checkpoint.exists():
        args.checkpoint.unlink()

    try:
        page_records = load_checkpoint(args.checkpoint)
    except RuntimeError as exc:
        print(exc, file=sys.stderr)
        return 1
    page_records = {
        page: records for page, records in page_records.items() if page < target_pages
    }

    if 0 not in page_records:
        first_items = parse_page(first_html, 0)
        if not first_items:
            print("The first catalog page did not contain product cards.", file=sys.stderr)
            return 1
        page_records[0] = first_items

    missing_pages = [page for page in range(target_pages) if page not in page_records]
    print(
        f"Resuming with {len(page_records):,} page(s) already saved; "
        f"{len(missing_pages):,} page(s) remain."
    )

    failed_pages: list[int] = []
    completed_since_save = 0
    if missing_pages:
        with ThreadPoolExecutor(max_workers=args.workers) as executor:
            futures = {
                executor.submit(
                    fetch_and_parse_page,
                    page,
                    args.delay,
                    args.timeout,
                    args.retries,
                ): page
                for page in missing_pages
            }
            for future in as_completed(futures):
                page = futures[future]
                try:
                    parsed_page, records = future.result()
                    page_records[parsed_page] = records
                    completed_since_save += 1
                except Exception as exc:  # Keep the checkpoint usable after partial failure.
                    failed_pages.append(page)
                    print(f"Page {page + 1:,} failed: {exc}", file=sys.stderr)

                completed = len(page_records)
                if completed % 20 == 0 or completed == target_pages:
                    raw = sum(len(records) for records in page_records.values())
                    print(
                        f"Progress: {completed:,}/{target_pages:,} pages, "
                        f"{raw:,} raw parts"
                    )
                if completed_since_save >= args.checkpoint_every:
                    save_checkpoint(
                        args.checkpoint,
                        page_records,
                        reported_count,
                        total_pages,
                    )
                    completed_since_save = 0

    save_checkpoint(args.checkpoint, page_records, reported_count, total_pages)
    output = build_output(
        page_records,
        reported_count,
        total_pages,
        failed_pages,
    )
    atomic_write_json(args.output, output)

    complete_run = len(page_records) == target_pages and not failed_pages
    if complete_run and target_pages == total_pages:
        args.checkpoint.unlink(missing_ok=True)

    print(f"Wrote {args.output}")
    print(
        f"Collected {output['rawListingCount']:,} raw listings and "
        f"{output['uniquePartCount']:,} unique part numbers; "
        f"removed {output['duplicatesRemoved']:,} duplicates."
    )
    if failed_pages:
        print(
            f"{len(failed_pages)} page(s) failed. Run the same command again to resume.",
            file=sys.stderr,
        )
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
