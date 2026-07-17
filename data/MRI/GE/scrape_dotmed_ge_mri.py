#!/usr/bin/env python3
"""Collect and deduplicate public GE MRI part listings from DOTmed.

The script intentionally does not bypass CAPTCHAs, Cloudflare challenges, login
requirements, or other access controls. It can also parse HTML pages saved from
a normal browser session with one or more ``--html`` arguments.

Examples:
    py -3 scrape_dotmed_ge_mri.py --pages 5 --delay 8
    py -3 scrape_dotmed_ge_mri.py --html page-1.html --html page-2.html
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
from collections import OrderedDict
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from typing import Any
from urllib.parse import urljoin

import requests


BASE_URL = "https://www.dotmed.com/browse/parts/imaging/mri/mri-scanner/ge/"
DEFAULT_OUTPUT = Path(__file__).with_name("dotmed-MRI-GE.json")
USER_AGENT = (
    "Advanced-Imaging-Services-Part-Research/1.0 "
    "(+https://advancedimagingparts.com)"
)
MONTHS = (
    "January|February|March|April|May|June|July|August|September|October|"
    "November|December"
)
DATE_RE = re.compile(rf"^(?:{MONTHS})\s+\d{{1,2}}(?:,?\s+\d{{4}})?$", re.I)
SPACE_RE = re.compile(r"\s+")


def clean_text(value: str) -> str:
    return SPACE_RE.sub(" ", value.replace("\xa0", " ")).strip()


def normalize_part_number(value: str) -> str:
    return re.sub(r"[^A-Z0-9]", "", value.upper())


def is_listing_heading(value: str) -> bool:
    text = clean_text(value).lower()
    return (
        text.startswith("ge ")
        and "mri" in text
        and ("parts for sale" in text or "parts wanted" in text)
    )


def trim_listing_suffix(value: str) -> str:
    return re.sub(
        r"\s+Parts\s+(?:For\s+Sale|Wanted).*?$", "", clean_text(value), flags=re.I
    )


class DotmedListingParser(HTMLParser):
    """Extract listing blocks without requiring a third-party HTML parser."""

    HEADING_TAGS = {"h2", "h3", "h4", "h5"}

    def __init__(self, page_url: str) -> None:
        super().__init__(convert_charrefs=True)
        self.page_url = page_url
        self.listings: list[dict[str, Any]] = []
        self._heading_tag: str | None = None
        self._heading_text: list[str] = []
        self._heading_url = ""
        self._current: dict[str, Any] | None = None

    def handle_starttag(
        self, tag: str, attrs: list[tuple[str, str | None]]
    ) -> None:
        tag = tag.lower()
        if tag in self.HEADING_TAGS:
            self._heading_tag = tag
            self._heading_text = []
            self._heading_url = ""
        elif tag == "a" and self._heading_tag:
            href = dict(attrs).get("href")
            if href:
                self._heading_url = urljoin(self.page_url, href)

    def handle_data(self, data: str) -> None:
        text = clean_text(data)
        if not text:
            return
        if self._heading_tag:
            self._heading_text.append(text)
        elif self._current is not None:
            self._current["chunks"].append(text)

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        if tag != self._heading_tag:
            return

        heading = clean_text(" ".join(self._heading_text))
        if tag in {"h2", "h3", "h4"} and self._current is not None:
            self._finish_current()

        if is_listing_heading(heading):
            self._current = {
                "title": trim_listing_suffix(heading),
                "listingUrl": self._heading_url or self.page_url,
                "chunks": [],
            }

        self._heading_tag = None
        self._heading_text = []
        self._heading_url = ""

    def close(self) -> None:
        super().close()
        self._finish_current()

    def _finish_current(self) -> None:
        if self._current is None:
            return
        listing = parse_listing_chunks(self._current)
        if listing:
            self.listings.append(listing)
        self._current = None


def value_after_label(chunks: list[str], label: str) -> tuple[str, int]:
    target = label.lower()
    for index, chunk in enumerate(chunks):
        lowered = chunk.lower()
        if lowered.startswith(target):
            value = clean_text(chunk[len(label) :].lstrip(" :"))
            if value:
                return value, index
            if index + 1 < len(chunks):
                return chunks[index + 1], index + 1
    return "", -1


def parse_listing_chunks(raw: dict[str, Any]) -> dict[str, Any] | None:
    chunks = [clean_text(chunk) for chunk in raw["chunks"] if clean_text(chunk)]
    part_number, part_index = value_after_label(chunks, "Part Number")
    if not part_number:
        return None

    part_name = ""
    for chunk in chunks[part_index + 1 :]:
        lowered = chunk.lower()
        if (
            DATE_RE.match(chunk)
            or lowered.startswith(("asking price", "phone:", "webstore", "view more"))
            or " / " in chunk
        ):
            continue
        part_name = chunk
        break

    listed_date = next((chunk for chunk in chunks if DATE_RE.match(chunk)), "")
    seller = next((chunk for chunk in chunks if " / " in chunk), "")
    asking_price, _ = value_after_label(chunks, "Asking Price")

    description_chunks: list[str] = []
    if part_index >= 0:
        start = part_index + 2 if part_name else part_index + 1
        for chunk in chunks[start:]:
            lowered = chunk.lower()
            if (
                DATE_RE.match(chunk)
                or " / " in chunk
                or lowered.startswith(("asking price", "phone:", "webstore"))
                or re.fullmatch(r"\(\d+\)", chunk)
            ):
                break
            if lowered != "view more":
                description_chunks.append(chunk)

    title = raw["title"]
    return {
        "partNumber": part_number,
        "partName": part_name,
        "model": derive_model(title),
        "title": title,
        "description": clean_text(" ".join(description_chunks)),
        "askingPrice": asking_price,
        "listedDate": listed_date,
        "seller": seller,
        "listingUrl": raw["listingUrl"],
    }


def derive_model(title: str) -> str:
    value = re.sub(r"^GE\s+", "", title, flags=re.I)
    value = re.sub(r"\s+MRI\s+Scanner$", "", value, flags=re.I)
    return clean_text(value)


def parse_page(html: str, page_url: str) -> list[dict[str, Any]]:
    parser = DotmedListingParser(page_url)
    parser.feed(html)
    parser.close()
    return parser.listings


def challenge_reason(response: requests.Response) -> str | None:
    text = response.text[:12000].lower()
    if response.status_code == 429:
        return "DOTmed returned HTTP 429 (rate limited)."
    if response.status_code == 403 and (
        "just a moment" in text
        or "challenges.cloudflare.com" in text
        or "cf-chl" in text
    ):
        return "DOTmed returned HTTP 403 with a Cloudflare browser challenge."
    if response.status_code == 403:
        return "DOTmed returned HTTP 403 (access denied)."
    return None


def page_url(page_index: int) -> str:
    if page_index == 0:
        return BASE_URL
    return urljoin(BASE_URL, f"offset/{page_index * 15}/")


def fetch_pages(page_count: int, delay: float) -> list[dict[str, Any]]:
    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml",
            "Accept-Language": "en-US,en;q=0.8",
        }
    )

    listings: list[dict[str, Any]] = []
    for index in range(page_count):
        url = page_url(index)
        print(f"Fetching page {index + 1}/{page_count}: {url}")
        try:
            response = session.get(url, timeout=30, allow_redirects=True)
        except requests.RequestException as exc:
            raise RuntimeError(f"Request failed for {url}: {exc}") from exc

        reason = challenge_reason(response)
        if reason:
            raise RuntimeError(
                f"{reason} The scraper stopped and did not attempt to bypass it."
            )
        response.raise_for_status()
        if "text/html" not in response.headers.get("content-type", "").lower():
            raise RuntimeError(f"Unexpected content type from {url}.")

        page_listings = parse_page(response.text, response.url)
        print(f"  Parsed {len(page_listings)} listings")
        if not page_listings:
            print("  No listing blocks found; stopping pagination.")
            break
        listings.extend(page_listings)

        if index + 1 < page_count:
            time.sleep(delay)

    return listings


def load_saved_html(paths: list[Path]) -> list[dict[str, Any]]:
    listings: list[dict[str, Any]] = []
    for index, path in enumerate(paths):
        html = path.read_text(encoding="utf-8", errors="replace")
        parsed = parse_page(html, page_url(index))
        print(f"Parsed {len(parsed)} listings from {path}")
        listings.extend(parsed)
    return listings


def deduplicate(listings: list[dict[str, Any]]) -> list[dict[str, Any]]:
    unique: OrderedDict[str, dict[str, Any]] = OrderedDict()

    for source_rank, listing in enumerate(listings, start=1):
        part_key = normalize_part_number(listing["partNumber"])
        key = part_key or clean_text(
            f"{listing['title']} {listing['partName']}"
        ).lower()
        if key not in unique:
            unique[key] = {
                **listing,
                "listingCount": 1,
                "firstSeenOrder": source_rank,
                "sellers": [listing["seller"]] if listing["seller"] else [],
                "listingUrls": [listing["listingUrl"]],
            }
            continue

        item = unique[key]
        item["listingCount"] += 1
        if listing["seller"] and listing["seller"] not in item["sellers"]:
            item["sellers"].append(listing["seller"])
        if listing["listingUrl"] not in item["listingUrls"]:
            item["listingUrls"].append(listing["listingUrl"])

    ranked = sorted(
        unique.values(),
        key=lambda item: (-item["listingCount"], item["firstSeenOrder"]),
    )
    for popularity_rank, item in enumerate(ranked, start=1):
        item["popularityRank"] = popularity_rank
    return ranked


def write_output(
    output: Path, listings: list[dict[str, Any]], source_mode: str
) -> dict[str, Any]:
    items = deduplicate(listings)
    payload = {
        "source": "DOTmed",
        "sourceUrl": BASE_URL,
        "modality": "MRI",
        "manufacturer": "GE",
        "collectedAt": datetime.now(timezone.utc).isoformat(),
        "sourceMode": source_mode,
        "rankingMethod": (
            "Unique part numbers ranked by listing frequency across scanned pages, "
            "then by first appearance in DOTmed's displayed order. DOTmed does not "
            "publish sales-volume or units-sold data on these listing pages."
        ),
        "rawListingCount": len(listings),
        "uniquePartCount": len(items),
        "items": items,
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, indent=2, ensure_ascii=True) + "\n")
    return payload


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Scrape and deduplicate public DOTmed GE MRI part listings."
    )
    parser.add_argument(
        "--pages", type=int, default=3, help="Number of 15-listing pages to request."
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=8.0,
        help="Seconds between requests; values below 3 are rejected.",
    )
    parser.add_argument(
        "--html",
        action="append",
        type=Path,
        default=[],
        help="Parse a browser-saved HTML page instead of requesting DOTmed.",
    )
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    return parser


def main() -> int:
    args = build_parser().parse_args()
    if args.pages < 1:
        print("Error: --pages must be at least 1.", file=sys.stderr)
        return 2
    if not args.html and args.delay < 3:
        print("Error: --delay must be at least 3 seconds.", file=sys.stderr)
        return 2

    try:
        if args.html:
            listings = load_saved_html(args.html)
            mode = "saved-html"
        else:
            listings = fetch_pages(args.pages, args.delay)
            mode = "live-http"
    except (OSError, RuntimeError, requests.RequestException) as exc:
        print(f"Stopped: {exc}", file=sys.stderr)
        return 3

    if not listings:
        print("No GE MRI listings were parsed; no JSON file was written.", file=sys.stderr)
        return 4

    payload = write_output(args.output, listings, mode)
    print(
        f"Wrote {payload['uniquePartCount']} unique parts from "
        f"{payload['rawListingCount']} listings to {args.output}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
