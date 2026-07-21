#!/usr/bin/env python3
"""Collect Siemens or Toshiba imaging-part sources by modality.

The parser implementations are the reviewed GE MRI collectors. This wrapper
supplies OEM and modality-specific storefront filters, URL markers, output
paths, and metadata without duplicating their request and parsing logic.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import re
import sys
from pathlib import Path
from typing import Any
from urllib.parse import quote


ROOT = Path(__file__).resolve().parents[1]
IMPLEMENTATIONS = ROOT / "data" / "MRI" / "GE"

MODALITIES: dict[str, dict[str, str]] = {
    "MRI": {
        "folder": "MRI",
        "label": "MRI",
        "partsSourcePath": "/shop/medical-imaging-and-glassware/mri",
        "partsSourceCategory": "medical-imaging-and-glassware-mri",
        "dotmedPath": "imaging/mri/mri-scanner",
        "dotmedLabel": "MRI",
    },
    "CT": {
        "folder": "CT",
        "label": "CT",
        "partsSourcePath": "/shop/medical-imaging-and-glassware/pet-ct/ct",
        "partsSourceCategory": "medical-imaging-and-glassware-pet-ct-ct",
        "dotmedPath": "imaging/ct/ct-scanner",
        "dotmedLabel": "CT",
    },
    "PET": {
        "folder": "PET",
        "label": "PET/CT",
        "partsSourcePath": "/shop/medical-imaging-and-glassware/pet-ct/pet-ct",
        "partsSourceCategory": "medical-imaging-and-glassware-pet-ct-pet-ct",
        "dotmedPath": "imaging/ct/pet-ct",
        "dotmedLabel": "PET/CT",
    },
}

OEMS: dict[str, dict[str, Any]] = {
    "PHILIPS": {
        "folder": "Philips",
        "label": "Philips",
        "slug": "philips",
        "headingPrefixes": ["Philips"],
        "partsSource": {
            "default": "Philips",
        },
        "aliases": [
            "PHILIPS",
            "PHILIPS HEALTHCARE",
            "PHILIPS MEDICAL SYSTEMS",
        ],
    },
    "SIEMENS": {
        "folder": "Siemens",
        "label": "Siemens",
        "slug": "siemens",
        "headingPrefixes": ["Siemens"],
        "partsSource": {
            "default": "Siemens Medical Solutions",
        },
        "aliases": [
            "SIEMENS",
            "SIEMENS MEDICAL SOLUTIONS",
            "SIEMENS HEALTHINEERS",
        ],
    },
    "TOSHIBA": {
        "folder": "Toshiba",
        "label": "Toshiba",
        "slug": "toshiba",
        "headingPrefixes": ["Toshiba", "Canon"],
        "partsSource": {
            "default": "Toshiba America Medical Systems (TAMS)",
            "canon": "Canon Medical Systems USA, Inc.",
        },
        "aliases": [
            "TOSHIBA",
            "TOSHIBA AMERICA MEDICAL SYSTEMS",
            "TOSHIBA AMERICA MEDICAL SYSTEMS (TAMS)",
            "CANON MEDICAL SYSTEMS USA",
            "CANON MEDICAL SYSTEMS USA, INC.",
            "CANON MEDICAL",
        ],
    },
}

SOURCE_MODULES = {
    "partssource": "scrape_partssource_ge_mri.py",
    "block": "scrape_block_ge_mri.py",
    "dotmed": "scrape_dotmed_ge_mri.py",
}


def load_module(source: str) -> Any:
    path = IMPLEMENTATIONS / SOURCE_MODULES[source]
    spec = importlib.util.spec_from_file_location(
        f"ais_{source}_oem_collector", path
    )
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not load collector {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def source_key(source: str, variant: str) -> str:
    if source == "partssource" and variant != "default":
        return f"partssource-{variant}"
    return source


def output_path(oem_key: str, modality: str, source: str, variant: str) -> Path:
    oem = OEMS[oem_key]
    config = MODALITIES[modality]
    key = source_key(source, variant)
    return (
        ROOT
        / "data"
        / config["folder"]
        / oem["folder"]
        / f"{key}-{modality}-{oem['folder']}.json"
    )


def checkpoint_path(oem_key: str, modality: str, source: str, variant: str) -> Path:
    output = output_path(oem_key, modality, source, variant)
    return output.with_name(f".{output.stem}.checkpoint.json")


def manufacturer_matches(value: str, aliases: list[str]) -> bool:
    normalized = re.sub(r"[^A-Z0-9]", "", str(value).upper())
    return any(
        normalized == re.sub(r"[^A-Z0-9]", "", alias.upper())
        for alias in aliases
    )


def configure(
    module: Any,
    source: str,
    oem_key: str,
    modality: str,
    variant: str,
) -> None:
    oem = OEMS[oem_key]
    config = MODALITIES[modality]
    output = output_path(oem_key, modality, source, variant)
    checkpoint = checkpoint_path(oem_key, modality, source, variant)
    output.parent.mkdir(parents=True, exist_ok=True)

    module.DEFAULT_OUTPUT = output
    if hasattr(module, "DEFAULT_CHECKPOINT"):
        module.DEFAULT_CHECKPOINT = checkpoint

    if source == "partssource":
        selected_oem = oem["partsSource"].get(variant)
        if not selected_oem:
            raise RuntimeError(
                f"{oem['label']} has no PartsSource variant named {variant}"
            )
        module.OEM_NAME = selected_oem
        module.CATEGORY_PATH = config["partsSourcePath"]
        module.CATEGORY_ID = config["partsSourceCategory"]
        module.SOURCE_URL = (
            f"{module.BASE_URL}{module.CATEGORY_PATH}"
            f"?OEM={quote(selected_oem)}&_view=all"
        )
        module.CHECKPOINT_SIGNATURE = (
            f"{module.CATEGORY_ID}|{selected_oem}|{module.PAGE_SIZE}"
        )
        module.TITLE_SUFFIX_RE = re.compile(
            rf"\s+by\s+{re.escape(selected_oem)}\s*$", re.IGNORECASE
        )
        module.is_ge_healthcare = lambda value: manufacturer_matches(
            value, [selected_oem, *oem["aliases"]]
        )
    elif source == "block":
        module.PRODUCT_MARKER = f"-{oem['slug']}-{modality.lower()}-"

        def product_name_from_title(title: str) -> str:
            parts = [module.clean_text(part) for part in title.split(" - ")]
            if (
                len(parts) >= 4
                and parts[1].upper() == oem["label"].upper()
                and parts[2].upper() == config["dotmedLabel"].upper()
            ):
                return " - ".join(parts[3:])
            return title

        module.product_name_from_title = product_name_from_title
    elif source == "dotmed":
        module.BASE_URL = (
            f"https://www.dotmed.com/browse/parts/{config['dotmedPath']}"
            f"/{oem['slug']}/"
        )

        def is_listing_heading(value: str) -> bool:
            text = module.clean_text(value).lower()
            has_prefix = any(
                text.startswith(f"{prefix.lower()} ")
                for prefix in oem["headingPrefixes"]
            )
            if not has_prefix or "parts" not in text:
                return False
            if modality == "MRI":
                return "mri" in text
            if modality == "CT":
                return "ct scanner" in text
            return "pet/ct" in text or "pet-ct" in text or " pet " in text

        def derive_model(title: str) -> str:
            prefixes = "|".join(re.escape(value) for value in oem["headingPrefixes"])
            value = re.sub(rf"^(?:{prefixes})\s+", "", title, flags=re.I)
            value = re.sub(r"\s+(?:MRI|CT)\s+Scanner$", "", value, flags=re.I)
            value = re.sub(r"\s+PET/?CT$", "", value, flags=re.I)
            return module.clean_text(value)

        module.is_listing_heading = is_listing_heading
        module.derive_model = derive_model


def normalize_output(
    path: Path,
    oem_key: str,
    modality: str,
    source: str,
    variant: str,
) -> None:
    oem = OEMS[oem_key]
    payload = json.loads(path.read_text(encoding="utf-8"))
    payload["manufacturer"] = oem["label"]
    payload["modality"] = MODALITIES[modality]["label"]
    payload["catalogModality"] = modality
    payload["sourceKey"] = source_key(source, variant)
    if source == "partssource":
        payload["sourceManufacturerFilter"] = oem["partsSource"][variant]
    for item in payload.get("items", []):
        if not isinstance(item, dict):
            continue
        item["sourceManufacturer"] = item.get("manufacturer", "")
        item["manufacturer"] = oem["label"]
        item["modality"] = MODALITIES[modality]["label"]
    path.write_text(
        json.dumps(payload, indent=2, ensure_ascii=True) + "\n",
        encoding="utf-8",
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Collect Philips, Siemens, or Toshiba catalog sources by modality."
    )
    parser.add_argument("--oem", choices=sorted(OEMS), required=True)
    parser.add_argument("--source", choices=sorted(SOURCE_MODULES), required=True)
    parser.add_argument("--modality", choices=sorted(MODALITIES), required=True)
    parser.add_argument(
        "--variant",
        default="default",
        help="PartsSource OEM variant; Toshiba additionally supports canon.",
    )
    parser.add_argument("--pages", type=int, default=0)
    parser.add_argument("collector_args", nargs=argparse.REMAINDER)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    module = load_module(args.source)
    configure(module, args.source, args.oem, args.modality, args.variant)
    output = output_path(
        args.oem, args.modality, args.source, args.variant
    )

    forwarded = list(args.collector_args)
    if forwarded and forwarded[0] == "--":
        forwarded = forwarded[1:]
    if args.source == "dotmed" and "--pages" not in forwarded:
        forwarded.extend(["--pages", str(args.pages or 30)])
    if "--output" not in forwarded:
        forwarded.extend(["--output", str(output)])
    if hasattr(module, "DEFAULT_CHECKPOINT") and "--checkpoint" not in forwarded:
        forwarded.extend(
            [
                "--checkpoint",
                str(
                    checkpoint_path(
                        args.oem,
                        args.modality,
                        args.source,
                        args.variant,
                    )
                ),
            ]
        )

    sys.argv = [SOURCE_MODULES[args.source], *forwarded]
    result = module.main()
    if result == 0 and output.exists():
        normalize_output(
            output,
            args.oem,
            args.modality,
            args.source,
            args.variant,
        )
        payload = json.loads(output.read_text(encoding="utf-8"))
        print(
            f"Normalized {len(payload.get('items', [])):,} "
            f"{OEMS[args.oem]['label']} {args.modality} records in {output}"
        )
    return result


if __name__ == "__main__":
    raise SystemExit(main())
