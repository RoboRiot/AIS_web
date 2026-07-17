#!/usr/bin/env python3
"""Build a deduplicated GE MRI parts catalog from Block Imaging.

The public sitemap provides the complete product URL inventory. Optional product
page enrichment adds the exact display name, model, and image for the first N
unique parts without requiring a full-site crawl.

Examples:
    py -3 scrape_block_ge_mri.py
    py -3 scrape_block_ge_mri.py --enrich 50 --delay 0.75
"""

from __future__ import annotations

import argparse
import html
import json
import re
import sys
import time
from collections import OrderedDict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import unquote, urlparse
from xml.etree import ElementTree

import requests


SITEMAP_URL = "https://www.blockimaging.com/sitemap.xml"
PARTS_URL = "https://www.blockimaging.com/parts"
DEFAULT_OUTPUT = Path(__file__).with_name("block-MRI-GE.json")
USER_AGENT = (
    "Advanced-Imaging-Services-Part-Research/1.0 "
    "(+https://advancedimagingparts.com)"
)
PRODUCT_MARKER = "-ge-mri-"
PRODUCT_JSON_RE = re.compile(
    r"<script[^>]+type=[\"']application/ld\+json[\"'][^>]*>(.*?)</script>",
    re.IGNORECASE | re.DOTALL,
)


def normalize_part_number(value: str) -> str:
    return re.sub(r"[^A-Z0-9]", "", value.upper())


def clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def title_from_slug(value: str) -> str:
    words = clean_text(value.replace("-", " ").replace("_", " ")).split()
    acronyms = {
        "ac",
        "adc",
        "dc",
        "dvmr",
        "if",
        "io",
        "mri",
        "rf",
        "rfi",
        "rfp",
        "tcu",
        "usb",
    }
    return " ".join(
        word.upper()
        if word.lower() in acronyms or (any(char.isdigit() for char in word) and len(word) <= 8)
        else word.capitalize()
        for word in words
    )


def make_session() -> requests.Session:
    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9",
            "Accept-Language": "en-US,en;q=0.8",
        }
    )
    return session


def fetch(session: requests.Session, url: str, timeout: int = 60) -> requests.Response:
    try:
        response = session.get(url, timeout=timeout, allow_redirects=True)
    except requests.RequestException as exc:
        raise RuntimeError(f"Request failed for {url}: {exc}") from exc

    if response.status_code == 429:
        raise RuntimeError(f"Block Imaging rate limited the request for {url}.")
    if response.status_code == 403:
        raise RuntimeError(f"Block Imaging denied access to {url}.")
    response.raise_for_status()
    return response


def sitemap_records(xml_bytes: bytes) -> list[dict[str, str]]:
    try:
        root = ElementTree.fromstring(xml_bytes)
    except ElementTree.ParseError as exc:
        raise RuntimeError(f"Block Imaging returned invalid sitemap XML: {exc}") from exc

    records: list[dict[str, str]] = []
    for node in root:
        loc = ""
        last_modified = ""
        for child in node:
            tag = child.tag.rsplit("}", 1)[-1]
            if tag == "loc":
                loc = clean_text(child.text or "")
            elif tag == "lastmod":
                last_modified = clean_text(child.text or "")

        lowered = loc.lower()
        if "/parts/" not in lowered or PRODUCT_MARKER not in lowered:
            continue
        records.append({"url": loc, "lastModified": last_modified})
    return records


def item_from_url(record: dict[str, str], source_order: int) -> dict[str, Any] | None:
    slug = unquote(urlparse(record["url"]).path.rstrip("/").rsplit("/", 1)[-1])
    marker_index = slug.lower().find(PRODUCT_MARKER)
    if marker_index <= 0:
        return None

    part_number = slug[:marker_index].upper()
    description_slug = slug[marker_index + len(PRODUCT_MARKER) :]
    if not normalize_part_number(part_number) or not description_slug:
        return None

    return {
        "sourceOrder": source_order,
        "partNumber": part_number,
        "partName": title_from_slug(description_slug),
        "manufacturer": "GE",
        "modality": "MRI",
        "model": "",
        "imageUrl": "",
        "lastModified": record["lastModified"],
        "sourceUrl": record["url"],
        "catalogOccurrences": 1,
        "alternateNames": [],
        "alternateUrls": [],
        "enriched": False,
    }


def deduplicate(records: list[dict[str, str]]) -> list[dict[str, Any]]:
    unique: OrderedDict[str, dict[str, Any]] = OrderedDict()

    for source_order, record in enumerate(records, start=1):
        candidate = item_from_url(record, source_order)
        if candidate is None:
            continue
        key = normalize_part_number(candidate["partNumber"])
        if key not in unique:
            unique[key] = candidate
            continue

        existing = unique[key]
        existing["catalogOccurrences"] += 1
        if candidate["partName"] != existing["partName"]:
            existing["alternateNames"].append(candidate["partName"])
        if candidate["sourceUrl"] != existing["sourceUrl"]:
            existing["alternateUrls"].append(candidate["sourceUrl"])
        if candidate["lastModified"] > existing["lastModified"]:
            existing["lastModified"] = candidate["lastModified"]

    return list(unique.values())


def find_product_json(page_html: str) -> dict[str, Any] | None:
    for match in PRODUCT_JSON_RE.finditer(page_html):
        try:
            value = json.loads(html.unescape(match.group(1)).strip())
        except (json.JSONDecodeError, TypeError):
            continue
        candidates = value if isinstance(value, list) else [value]
        for candidate in candidates:
            if not isinstance(candidate, dict):
                continue
            product_type = candidate.get("@type")
            if product_type == "Product" or (
                isinstance(product_type, list) and "Product" in product_type
            ):
                return candidate
    return None


def product_name_from_title(title: str) -> str:
    parts = [clean_text(part) for part in title.split(" - ")]
    if len(parts) >= 4 and parts[1].upper() == "GE" and parts[2].upper() == "MRI":
        return " - ".join(parts[3:])
    return title


def enrich_items(
    session: requests.Session,
    items: list[dict[str, Any]],
    count: int,
    delay: float,
) -> tuple[int, int]:
    requested = min(count, len(items))
    succeeded = 0

    for index, item in enumerate(items[:requested], start=1):
        print(f"Enriching {index}/{requested}: {item['partNumber']}")
        try:
            response = fetch(session, item["sourceUrl"], timeout=30)
            product = find_product_json(response.text)
        except (RuntimeError, requests.RequestException) as exc:
            print(f"  Skipped: {exc}", file=sys.stderr)
            product = None

        if product:
            title = clean_text(str(product.get("name", "")))
            model = clean_text(str(product.get("model", "")))
            image_value = product.get("image", "")
            if isinstance(image_value, list):
                image_value = image_value[0] if image_value else ""
            item["partName"] = product_name_from_title(title) or item["partName"]
            item["model"] = model
            item["imageUrl"] = clean_text(str(image_value))
            item["enriched"] = True
            succeeded += 1

        if index < requested:
            time.sleep(delay)

    return requested, succeeded


def write_output(
    output: Path,
    records: list[dict[str, str]],
    items: list[dict[str, Any]],
    enrichment_requested: int,
    enrichment_succeeded: int,
) -> dict[str, Any]:
    payload = {
        "source": "Block Imaging",
        "sourceUrl": PARTS_URL,
        "sitemapUrl": SITEMAP_URL,
        "manufacturer": "GE",
        "modality": "MRI",
        "collectedAt": datetime.now(timezone.utc).isoformat(),
        "orderingNote": (
            "Items retain Block Imaging sitemap order. Block Imaging does not "
            "publish sales volume or a popularity ranking in the public catalog."
        ),
        "rawCatalogUrlCount": len(records),
        "uniquePartCount": len(items),
        "enrichmentRequested": enrichment_requested,
        "enrichmentSucceeded": enrichment_succeeded,
        "items": items,
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, indent=2, ensure_ascii=True) + "\n")
    return payload


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Build a deduplicated Block Imaging GE MRI parts catalog."
    )
    parser.add_argument(
        "--enrich",
        type=int,
        default=0,
        help="Number of product pages to enrich with exact model and image data.",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=0.75,
        help="Seconds between optional product-page requests; minimum 0.5.",
    )
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    return parser


def main() -> int:
    args = build_parser().parse_args()
    if args.enrich < 0:
        print("Error: --enrich cannot be negative.", file=sys.stderr)
        return 2
    if args.enrich and args.delay < 0.5:
        print("Error: --delay must be at least 0.5 seconds.", file=sys.stderr)
        return 2

    session = make_session()
    print(f"Fetching sitemap: {SITEMAP_URL}")
    try:
        response = fetch(session, SITEMAP_URL)
        records = sitemap_records(response.content)
    except (RuntimeError, requests.RequestException) as exc:
        print(f"Stopped: {exc}", file=sys.stderr)
        return 3

    if not records:
        print("No Block Imaging GE MRI product URLs were found.", file=sys.stderr)
        return 4

    items = deduplicate(records)
    enrichment_requested = 0
    enrichment_succeeded = 0
    if args.enrich:
        enrichment_requested, enrichment_succeeded = enrich_items(
            session, items, args.enrich, args.delay
        )

    payload = write_output(
        args.output,
        records,
        items,
        enrichment_requested,
        enrichment_succeeded,
    )
    print(
        f"Wrote {payload['uniquePartCount']} unique GE MRI parts from "
        f"{payload['rawCatalogUrlCount']} catalog URLs to {args.output}"
    )
    if enrichment_requested:
        print(
            f"Enriched {enrichment_succeeded}/{enrichment_requested} product pages."
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
