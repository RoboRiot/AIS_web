#!/usr/bin/env python3
"""Export the GE MRI products displayed on the AIS parts page.

The AIS parts page reads its inventory from the public Firebase Firestore
``Parts`` collection. This script reads that same collection, applies the same
GE/MRI field filters, preserves all matching inventory records, and writes a
local comparison file beside the external catalog exports.

Examples:
    py -3 scrape_ais_ge_mri.py
    py -3 scrape_ais_ge_mri.py --delay 0.5 --fresh
"""

from __future__ import annotations

import argparse
import json
import random
import re
import sys
import time
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import quote

import requests


SITE_URL = "https://advancedimagingparts.com"
PARTS_PAGE_URL = f"{SITE_URL}/parts"
FIREBASE_PROJECT_ID = "magmo-ac10c"
FIREBASE_API_KEY = "AIzaSyCxC-a8b5Vhhey8GF47LpXZ1aMKYmiIhwE"
FIRESTORE_BASE_URL = (
    "https://firestore.googleapis.com/v1/projects/"
    f"{FIREBASE_PROJECT_ID}/databases/(default)/documents"
)
COLLECTION_NAME = "Parts"
DEFAULT_OUTPUT = Path(__file__).with_name("ais-MRI-GE.json")
USER_AGENT = (
    "Advanced-Imaging-Services-Part-Research/1.0 "
    "(+https://advancedimagingparts.com)"
)

SPACE_RE = re.compile(r"\s+")
PRODUCT_CODE_RE = re.compile(
    r"\b(?=[A-Z0-9-]*[A-Z])(?=[A-Z0-9-]*\d)[A-Z0-9-]{4,}\b",
    re.IGNORECASE,
)


def clean_text(value: Any) -> str:
    if value is None:
        return ""
    return SPACE_RE.sub(" ", str(value).replace("?", " ")).strip()


def normalize_part_number(value: str) -> str:
    return re.sub(r"[^A-Z0-9]", "", value.upper())


def parse_firestore_value(value: dict[str, Any] | None) -> Any:
    if not isinstance(value, dict):
        return None
    if "nullValue" in value:
        return None
    if "stringValue" in value:
        return value["stringValue"]
    if "integerValue" in value:
        return int(value["integerValue"])
    if "doubleValue" in value:
        return float(value["doubleValue"])
    if "booleanValue" in value:
        return bool(value["booleanValue"])
    if "timestampValue" in value:
        return value["timestampValue"]
    if "referenceValue" in value:
        return value["referenceValue"]
    if "bytesValue" in value:
        return value["bytesValue"]
    if "arrayValue" in value:
        values = value["arrayValue"].get("values", [])
        return [parse_firestore_value(item) for item in values]
    if "mapValue" in value:
        fields = value["mapValue"].get("fields", {})
        return {
            key: parse_firestore_value(field_value)
            for key, field_value in fields.items()
        }
    return None


def parse_document(document: dict[str, Any]) -> dict[str, Any]:
    document_id = clean_text(document.get("name")).rsplit("/", 1)[-1]
    fields = document.get("fields", {})
    parsed = {
        key: parse_firestore_value(value)
        for key, value in fields.items()
    }
    return {"id": document_id, **parsed}


def make_session() -> requests.Session:
    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": USER_AGENT,
            "Accept": "application/json",
            "Referer": PARTS_PAGE_URL,
        }
    )
    return session


def request_collection_page(
    session: requests.Session,
    page_token: str,
    delay: float,
    timeout: float,
    retries: int,
) -> dict[str, Any]:
    params = {"pageSize": 500, "key": FIREBASE_API_KEY}
    if page_token:
        params["pageToken"] = page_token

    last_error = "unknown request error"
    url = f"{FIRESTORE_BASE_URL}/{COLLECTION_NAME}"
    for attempt in range(retries + 1):
        if delay > 0:
            time.sleep(random.uniform(delay, delay * 1.25))
        try:
            response = session.get(url, params=params, timeout=timeout)
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
                raise RuntimeError("Firebase denied access to the Parts collection (HTTP 403)")
            response.raise_for_status()
            payload = response.json()
            if not isinstance(payload, dict):
                raise RuntimeError("Firebase returned an unexpected response format")
            return payload
        except (requests.RequestException, ValueError) as exc:
            last_error = str(exc)
            if attempt < retries:
                time.sleep(2 ** (attempt + 1))

    raise RuntimeError(
        f"Firebase request failed after {retries + 1} attempts: {last_error}"
    )


def fetch_all_products(
    delay: float,
    timeout: float,
    retries: int,
) -> list[dict[str, Any]]:
    products: list[dict[str, Any]] = []
    page_token = ""
    session = make_session()

    while True:
        payload = request_collection_page(
            session,
            page_token,
            delay,
            timeout,
            retries,
        )
        for document in payload.get("documents", []):
            if isinstance(document, dict):
                products.append(parse_document(document))
        page_token = clean_text(payload.get("nextPageToken"))
        if not page_token:
            break
    return products


def parse_description_specs(description: Any) -> dict[str, str]:
    specs: dict[str, str] = {}
    for line in str(description or "").splitlines():
        raw_key, separator, raw_value = line.partition(":")
        if not separator:
            continue
        key = clean_text(raw_key).casefold()
        value = clean_text(raw_value)
        if not value:
            continue
        if "part number" in key:
            specs["partNumber"] = value
        elif "system model" in key:
            specs["systemModel"] = value
        elif "system manufacturer" in key:
            specs["manufacturer"] = value
        elif "category" in key:
            specs["category"] = value
    return specs


def add_unique(values: list[str], value: Any) -> None:
    cleaned = clean_text(value)
    if not cleaned:
        return
    normalized = cleaned.casefold()
    if normalized not in {item.casefold() for item in values}:
        values.append(cleaned)


def get_displayed_part_numbers(product: dict[str, Any]) -> list[str]:
    specs = parse_description_specs(product.get("Description"))
    explicit_values = [product.get("PN"), specs.get("partNumber")]
    searchable_values = [
        *explicit_values,
        product.get("Name"),
        product.get("Description"),
    ]
    values: list[str] = []

    for explicit in explicit_values:
        if not explicit:
            continue
        for part in re.split(r"[,/|;]", clean_text(explicit)):
            add_unique(values, part)

    for value in searchable_values:
        if not value:
            continue
        for match in PRODUCT_CODE_RE.findall(clean_text(value).upper()):
            if not re.fullmatch(r"TEMP-\d+", match, re.IGNORECASE):
                add_unique(values, match)
    return values[:8]


def slugify(value: Any) -> str:
    text = unicodedata.normalize("NFKD", str(value or "")).lower()
    text = text.replace("\u2013", "-").replace("\u2014", "-")
    text = "".join(character for character in text if not unicodedata.combining(character))
    return re.sub(r"^-+|-+$", "", re.sub(r"[^a-z0-9]+", "-", text))


def build_product_slug(product: dict[str, Any], part_numbers: list[str]) -> str:
    name_slug = slugify(product.get("Name"))
    pieces = [name_slug] if name_slug else []
    for part_number in part_numbers[:2]:
        part_slug = slugify(part_number)
        if part_slug and part_slug not in name_slug:
            pieces.append(part_slug)

    id_slug = slugify(product.get("id"))
    if id_slug and not any(
        piece == id_slug or id_slug in piece for piece in pieces
    ):
        pieces.append(id_slug)
    return "-".join(filter(None, pieces))[:140].rstrip("-")


def normalized_images(value: Any) -> list[str]:
    values = value if isinstance(value, list) else [value] if value else []
    result: list[str] = []
    for image in values:
        add_unique(result, image)
    return result


def is_ge_mri(product: dict[str, Any]) -> bool:
    return (
        clean_text(product.get("OEM")).casefold() == "ge"
        and clean_text(product.get("Modality")).casefold() == "mri"
    )


def build_item(product: dict[str, Any], source_order: int) -> dict[str, Any]:
    specs = parse_description_specs(product.get("Description"))
    part_numbers = get_displayed_part_numbers(product)
    original_part_number = clean_text(product.get("PN"))
    primary_part_number = original_part_number or (part_numbers[0] if part_numbers else "")
    part_number_source = (
        "PN field"
        if original_part_number
        else "inferred from displayed name or description"
        if primary_part_number
        else "missing"
    )
    slug = build_product_slug(product, part_numbers)

    return {
        "sourceOrder": source_order,
        "inventoryId": clean_text(product.get("id")),
        "partNumber": primary_part_number,
        "originalPartNumber": original_part_number,
        "partNumberSource": part_number_source,
        "alternatePartNumbers": [
            value
            for value in part_numbers
            if normalize_part_number(value) != normalize_part_number(primary_part_number)
        ],
        "partName": clean_text(product.get("Name")),
        "description": str(product.get("Description") or "").strip(),
        "manufacturer": clean_text(product.get("OEM") or specs.get("manufacturer")),
        "modality": clean_text(product.get("Modality") or specs.get("category")),
        "model": clean_text(product.get("Machine") or specs.get("systemModel")),
        "imagePaths": normalized_images(product.get("Images")),
        "available": product.get("Available"),
        "sold": product.get("Sold"),
        "listedDate": clean_text(product.get("Date")),
        "sourceUrl": f"{SITE_URL}/products/{quote(slug)}" if slug else PARTS_PAGE_URL,
    }


def build_output(all_products: list[dict[str, Any]]) -> dict[str, Any]:
    matching = sorted(
        (product for product in all_products if is_ge_mri(product)),
        key=lambda product: (
            clean_text(product.get("Name")).casefold(),
            clean_text(product.get("id")).casefold(),
        ),
    )
    items = [
        build_item(product, index)
        for index, product in enumerate(matching, start=1)
    ]
    normalized_numbers = [
        normalize_part_number(item["partNumber"])
        for item in items
        if normalize_part_number(item["partNumber"])
    ]
    duplicate_keys = {
        value for value in normalized_numbers if normalized_numbers.count(value) > 1
    }

    return {
        "source": "Advanced Imaging Services",
        "sourceUrl": PARTS_PAGE_URL,
        "sourceData": "Firebase Firestore Parts collection",
        "firebaseProjectId": FIREBASE_PROJECT_ID,
        "manufacturer": "GE",
        "modality": "MRI",
        "collectedAt": datetime.now(timezone.utc).isoformat(),
        "selectionMethod": (
            "The same case-insensitive OEM=GE and Modality=MRI fields used by the "
            "AIS parts-page filters. All matching inventory documents are retained."
        ),
        "orderingMethod": (
            "Alphabetical by product Name, matching the parts page's default A-Z order."
        ),
        "allPartsCollectionCount": len(all_products),
        "matchingPartCount": len(items),
        "availablePartCount": sum(item["available"] is True for item in items),
        "soldPartCount": sum(item["sold"] in (True, 1) for item in items),
        "inferredPartNumberCount": sum(
            item["partNumberSource"].startswith("inferred") for item in items
        ),
        "missingPartNumberCount": sum(not item["partNumber"] for item in items),
        "duplicatePartNumberCount": len(duplicate_keys),
        "uniquePartNumberCount": len(set(normalized_numbers)),
        "items": items,
    }


def atomic_write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(
        json.dumps(value, indent=2, ensure_ascii=True) + "\n",
        encoding="utf-8",
    )
    temporary.replace(path)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Export the GE MRI products displayed on the AIS parts page."
    )
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--delay", type=float, default=0.25)
    parser.add_argument("--timeout", type=float, default=60.0)
    parser.add_argument("--retries", type=int, default=4)
    parser.add_argument(
        "--fresh",
        action="store_true",
        help="Accepted for consistency; the output is always refreshed atomically.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.delay < 0 or args.retries < 0:
        print("--delay and --retries cannot be negative", file=sys.stderr)
        return 2

    print("Reading the live AIS Parts collection...")
    try:
        all_products = fetch_all_products(args.delay, args.timeout, args.retries)
    except RuntimeError as exc:
        print(f"Unable to read the AIS inventory: {exc}", file=sys.stderr)
        return 1
    if not all_products:
        print("The AIS Parts collection returned no products.", file=sys.stderr)
        return 1

    output = build_output(all_products)
    atomic_write_json(args.output, output)
    print(f"Wrote {args.output}")
    print(
        f"Found {output['allPartsCollectionCount']:,} total AIS parts and "
        f"exported {output['matchingPartCount']:,} GE MRI records."
    )
    print(
        f"Captured {output['inferredPartNumberCount']:,} displayed part numbers "
        f"from records whose PN field was blank."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
