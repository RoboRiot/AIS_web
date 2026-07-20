#!/usr/bin/env python3
"""Collect PartSource's GE HealthCare MRI catalog.

The public PartSource MRI category exposes a GE HealthCare OEM filter and a
paginated JSON catalog endpoint. This collector uses that same category/filter,
keeps the storefront's default ordering, saves resumable checkpoints, and
deduplicates normalized OEM part numbers.

Examples:
    py -3 scrape_partssource_ge_mri.py
    py -3 scrape_partssource_ge_mri.py --workers 2 --delay 0.5
    py -3 scrape_partssource_ge_mri.py --max-pages 3 --fresh
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
from urllib.parse import quote, urljoin

import requests


BASE_URL = "https://www.partssource.com"
API_BASE_URL = "https://prodasf-vip.partssource.com/Orion"
API_URL = f"{API_BASE_URL}/CatalogService/api/v1/search/category"
CATEGORY_PATH = "/shop/medical-imaging-and-glassware/mri"
CATEGORY_ID = "medical-imaging-and-glassware-mri"
OEM_NAME = "GE Healthcare"
PAGE_SIZE = 200
SOURCE_URL = (
    f"{BASE_URL}{CATEGORY_PATH}?OEM={quote(OEM_NAME)}&_view=all"
)
DEFAULT_OUTPUT = Path(__file__).with_name("partssource-MRI-GE.json")
DEFAULT_CHECKPOINT = Path(__file__).with_name(
    ".partssource-MRI-GE.checkpoint.json"
)
USER_AGENT = (
    "Advanced-Imaging-Services-Part-Research/1.0 "
    "(+https://advancedimagingparts.com)"
)
CHECKPOINT_SIGNATURE = f"{CATEGORY_ID}|{OEM_NAME}|{PAGE_SIZE}"

TAG_RE = re.compile(r"<[^>]+>")
SPACE_RE = re.compile(r"\s+")
TITLE_SUFFIX_RE = re.compile(r"\s+by\s+GE\s+Healthcare\s*$", re.IGNORECASE)
THREAD_LOCAL = threading.local()


def clean_text(value: Any) -> str:
    if value is None:
        return ""
    text = TAG_RE.sub(" ", html.unescape(str(value)))
    return SPACE_RE.sub(" ", text).strip()


def normalize_part_number(value: str) -> str:
    return re.sub(r"[^A-Z0-9]", "", value.upper())


def unique_strings(values: Any) -> list[str]:
    if not isinstance(values, list):
        values = [values] if values else []
    result: list[str] = []
    seen: set[str] = set()
    for value in values:
        cleaned = clean_text(value)
        key = cleaned.casefold()
        if cleaned and key not in seen:
            seen.add(key)
            result.append(cleaned)
    return result


def optional_number(value: Any) -> int | float | None:
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, (int, float)):
        return value
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return int(number) if number.is_integer() else number


def get_session() -> requests.Session:
    session = getattr(THREAD_LOCAL, "session", None)
    if session is None:
        session = requests.Session()
        session.headers.update(
            {
                "User-Agent": USER_AGENT,
                "Accept": "application/json",
                "Accept-Language": "en-US,en;q=0.8",
                "Content-Type": "application/json",
                "Origin": BASE_URL,
                "Referer": SOURCE_URL,
            }
        )
        THREAD_LOCAL.session = session
    return session


def request_body(page: int) -> dict[str, Any]:
    start = page * PAGE_SIZE
    page_number = page + 1
    catalog_url = (
        f"{CATEGORY_PATH}?OEM={quote(OEM_NAME)}&_view=all"
        f"&_pageSize={PAGE_SIZE}&_page={page_number}"
    )
    return {
        "query": CATEGORY_ID,
        "start": start,
        "limit": PAGE_SIZE,
        "facets": [{"name": "OEM", "value": OEM_NAME}],
        "routeFacets": [{"name": "category", "value": CATEGORY_ID}],
        "facilityId": 38451,
        "url": catalog_url,
        "urlParams": [{"name": "OEM", "value": OEM_NAME}],
        "id_ins": None,
    }


def request_page(
    page: int,
    delay: float,
    timeout: float,
    retries: int,
) -> dict[str, Any]:
    last_error = "unknown request error"
    for attempt in range(retries + 1):
        if delay > 0:
            time.sleep(random.uniform(delay, delay * 1.25))
        try:
            response = get_session().post(
                API_URL,
                json=request_body(page),
                timeout=timeout,
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
                raise RuntimeError("PartSource denied the catalog request (HTTP 403)")
            response.raise_for_status()
            payload = response.json()
            if not isinstance(payload, dict):
                raise RuntimeError("PartSource returned an unexpected response format")
            return payload
        except (requests.RequestException, ValueError) as exc:
            last_error = str(exc)
            if attempt < retries:
                time.sleep(2 ** (attempt + 1))

    raise RuntimeError(
        f"page {page + 1} failed after {retries + 1} attempts: {last_error}"
    )


def parse_compatible_with(value: Any) -> list[dict[str, str]]:
    if not isinstance(value, list):
        return []
    result: list[dict[str, str]] = []
    seen: set[tuple[str, str]] = set()
    for record in value:
        if not isinstance(record, dict):
            continue
        part_number = clean_text(
            record.get("displayPartNumber") or record.get("partNumber")
        )
        manufacturer = clean_text(record.get("oemName") or record.get("manufacturer"))
        key = (normalize_part_number(part_number), manufacturer.casefold())
        if not key[0] or key in seen:
            continue
        seen.add(key)
        result.append(
            {"partNumber": part_number, "manufacturer": manufacturer}
        )
    return result


def parse_buying_options(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []
    result: list[dict[str, Any]] = []
    seen: set[tuple[Any, ...]] = set()
    for option in value:
        if not isinstance(option, dict):
            continue
        ps_part_number = clean_text(option.get("psPartNumber"))
        condition_code = optional_number(option.get("lineItemCondition"))
        warranty_code = optional_number(option.get("lineItemWarranty"))
        price = optional_number(option.get("price"))
        purchase_choice = optional_number(option.get("purchaseChoice"))
        key = (
            normalize_part_number(ps_part_number),
            condition_code,
            warranty_code,
            price,
            purchase_choice,
        )
        if key in seen:
            continue
        seen.add(key)
        record: dict[str, Any] = {
            "partSourcePartNumber": ps_part_number,
            "conditionCode": condition_code,
            "warrantyCode": warranty_code,
            "price": price,
            "purchaseChoice": purchase_choice,
            "leadTimeDays": optional_number(option.get("leadTimeDays")),
            "unitOfMeasurement": clean_text(option.get("unitOfMeasurement")),
            "returnable": bool(option.get("isReturnable", False)),
        }
        result.append(record)
    return result


def parse_product(product: dict[str, Any], source_order: int, page: int) -> dict[str, Any] | None:
    part_number = clean_text(product.get("partNumber"))
    if not normalize_part_number(part_number):
        return None

    title = clean_text(product.get("title"))
    description = clean_text(product.get("description"))
    part_name = description or TITLE_SUFFIX_RE.sub("", title).strip()
    detail_url = clean_text(product.get("detailUrl"))
    source_url = urljoin(BASE_URL, detail_url) if detail_url else ""
    brand = clean_text(product.get("brand"))
    options = parse_buying_options(product.get("options"))

    return {
        "sourceOrder": source_order,
        "partNumber": part_number,
        "partName": part_name,
        "title": title,
        "description": description,
        "manufacturer": brand,
        "modality": "MRI",
        "models": unique_strings(product.get("models")),
        "compatibleWith": parse_compatible_with(product.get("compatibleWith")),
        "imageUrl": clean_text(product.get("thumbnailUrl")),
        "imageAltText": clean_text(product.get("thumbnailAltText")),
        "outrightListPrice": optional_number(product.get("outrightListPrice")),
        "buyingOptionCount": len(options),
        "buyingOptions": options,
        "partSourceId": clean_text(product.get("id")),
        "isVariantProduct": bool(product.get("isVariantProduct", False)),
        "hasDefaultVariant": bool(product.get("hasDefaultVariant", False)),
        "isDiscontinued": bool(product.get("isDiscontinued", False)),
        "sourceUrl": source_url,
        "sourcePage": page + 1,
        "catalogOccurrences": 1,
        "alternateTitles": [],
        "alternateUrls": [],
    }


def parse_page(payload: dict[str, Any], page: int) -> list[dict[str, Any]]:
    products = payload.get("products")
    if not isinstance(products, list):
        raise RuntimeError(f"page {page + 1} did not contain a product list")

    items: list[dict[str, Any]] = []
    for index, product in enumerate(products):
        if not isinstance(product, dict):
            continue
        source_order = page * PAGE_SIZE + index + 1
        item = parse_product(product, source_order, page)
        if item is not None:
            items.append(item)
    return items


def fetch_and_parse_page(
    page: int,
    delay: float,
    timeout: float,
    retries: int,
) -> tuple[int, list[dict[str, Any]]]:
    payload = request_page(page, delay, timeout, retries)
    items = parse_page(payload, page)
    if not items:
        raise RuntimeError(f"page {page + 1} returned no usable product records")
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
    if data.get("signature") != CHECKPOINT_SIGNATURE:
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
            "signature": CHECKPOINT_SIGNATURE,
            "reportedResultCount": reported_count,
            "totalPages": total_pages,
            "savedAt": datetime.now(timezone.utc).isoformat(),
            "pages": {str(page): page_records[page] for page in sorted(page_records)},
        },
    )


def is_ge_healthcare(value: str) -> bool:
    normalized = clean_text(value).upper().replace("&", "AND")
    return normalized.startswith("GE HEALTHCARE") or normalized in {
        "GE",
        "GENERAL ELECTRIC",
    }


def merge_unique_strings(target: list[str], values: list[str]) -> None:
    seen = {value.casefold() for value in target}
    for value in values:
        if value.casefold() not in seen:
            seen.add(value.casefold())
            target.append(value)


def merge_duplicates(existing: dict[str, Any], duplicate: dict[str, Any]) -> None:
    existing["catalogOccurrences"] += 1
    if duplicate["title"] and duplicate["title"] != existing["title"]:
        merge_unique_strings(existing["alternateTitles"], [duplicate["title"]])
    if duplicate["sourceUrl"] and duplicate["sourceUrl"] != existing["sourceUrl"]:
        merge_unique_strings(existing["alternateUrls"], [duplicate["sourceUrl"]])
    merge_unique_strings(existing["models"], duplicate["models"])

    compatible_keys = {
        (
            normalize_part_number(record.get("partNumber", "")),
            record.get("manufacturer", "").casefold(),
        )
        for record in existing["compatibleWith"]
    }
    for record in duplicate["compatibleWith"]:
        key = (
            normalize_part_number(record.get("partNumber", "")),
            record.get("manufacturer", "").casefold(),
        )
        if key not in compatible_keys:
            compatible_keys.add(key)
            existing["compatibleWith"].append(record)

    option_keys = {
        (
            option.get("partSourcePartNumber"),
            option.get("conditionCode"),
            option.get("warrantyCode"),
            option.get("price"),
            option.get("purchaseChoice"),
        )
        for option in existing["buyingOptions"]
    }
    for option in duplicate["buyingOptions"]:
        key = (
            option.get("partSourcePartNumber"),
            option.get("conditionCode"),
            option.get("warrantyCode"),
            option.get("price"),
            option.get("purchaseChoice"),
        )
        if key not in option_keys:
            option_keys.add(key)
            existing["buyingOptions"].append(option)
    existing["buyingOptionCount"] = len(existing["buyingOptions"])


def deduplicate(
    page_records: dict[int, list[dict[str, Any]]],
) -> tuple[list[dict[str, Any]], int, int, int]:
    unique: dict[str, dict[str, Any]] = {}
    duplicates = 0
    non_ge = 0
    invalid = 0

    for page in sorted(page_records):
        for item in page_records[page]:
            key = normalize_part_number(item["partNumber"])
            if not key:
                invalid += 1
                continue
            if not is_ge_healthcare(item["manufacturer"]):
                non_ge += 1
                continue
            if key not in unique:
                unique[key] = item
                continue
            duplicates += 1
            merge_duplicates(unique[key], item)

    items = sorted(unique.values(), key=lambda item: item["sourceOrder"])
    return items, duplicates, non_ge, invalid


def build_output(
    page_records: dict[int, list[dict[str, Any]]],
    reported_count: int,
    total_pages: int,
    failed_pages: list[int],
) -> dict[str, Any]:
    items, duplicates, non_ge, invalid = deduplicate(page_records)
    raw_count = sum(len(records) for records in page_records.values())
    return {
        "source": "PartSource",
        "sourceUrl": SOURCE_URL,
        "manufacturerPageUrl": f"{BASE_URL}/parts/ge-healthcare/",
        "manufacturer": "GE",
        "modality": "MRI",
        "collectedAt": datetime.now(timezone.utc).isoformat(),
        "selectionMethod": (
            "PartSource's public MRI category filtered to OEM GE Healthcare. "
            "Products can be cross-listed by PartSource in more than one category."
        ),
        "orderingMethod": (
            "Items retain PartSource's default displayed catalog order. PartSource "
            "does not identify this order as sales volume or publish a popularity formula."
        ),
        "reportedResultCount": reported_count,
        "apiPageSize": PAGE_SIZE,
        "catalogPageCount": total_pages,
        "pagesCollected": len(page_records),
        "failedPages": [page + 1 for page in sorted(failed_pages)],
        "rawListingCount": raw_count,
        "nonGEListingsExcluded": non_ge,
        "invalidPartNumbersExcluded": invalid,
        "duplicatesRemoved": duplicates,
        "uniquePartCount": len(items),
        "items": items,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Collect PartSource's GE HealthCare MRI parts catalog."
    )
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--checkpoint", type=Path, default=DEFAULT_CHECKPOINT)
    parser.add_argument("--workers", type=int, default=2)
    parser.add_argument("--delay", type=float, default=0.5)
    parser.add_argument("--timeout", type=float, default=90.0)
    parser.add_argument("--retries", type=int, default=4)
    parser.add_argument("--checkpoint-every", type=int, default=5)
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
    if args.workers < 1 or args.workers > 6:
        print("--workers must be between 1 and 6", file=sys.stderr)
        return 2
    if args.delay < 0 or args.retries < 0:
        print("--delay and --retries cannot be negative", file=sys.stderr)
        return 2
    if args.checkpoint_every < 1:
        print("--checkpoint-every must be at least 1", file=sys.stderr)
        return 2

    print("Reading PartSource's GE HealthCare MRI catalog...")
    try:
        first_payload = request_page(0, args.delay, args.timeout, args.retries)
        reported_count = int(first_payload.get("totalResults", 0))
        if reported_count <= 0:
            raise RuntimeError("PartSource did not return a positive result count")
        total_pages = math.ceil(reported_count / PAGE_SIZE)
    except (RuntimeError, requests.RequestException, TypeError, ValueError) as exc:
        print(f"Unable to read the catalog: {exc}", file=sys.stderr)
        return 1

    target_pages = total_pages
    if args.max_pages > 0:
        target_pages = min(target_pages, args.max_pages)
    print(
        f"PartSource reports {reported_count:,} GE HealthCare MRI results across "
        f"{total_pages:,} API pages; collecting {target_pages:,} page(s)."
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
        first_items = parse_page(first_payload, 0)
        if not first_items:
            print("The first catalog page contained no usable products.", file=sys.stderr)
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
                except Exception as exc:  # Preserve partial results for a later resume.
                    failed_pages.append(page)
                    print(f"Page {page + 1:,} failed: {exc}", file=sys.stderr)

                completed = len(page_records)
                if completed % 5 == 0 or completed == target_pages:
                    raw = sum(len(records) for records in page_records.values())
                    print(
                        f"Progress: {completed:,}/{target_pages:,} pages, "
                        f"{raw:,} raw products"
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
