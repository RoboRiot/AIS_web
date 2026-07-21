#!/usr/bin/env python3
"""Run the existing reviewed collectors for GE MRI, CT, or PET/CT.

The original GE MRI collectors remain the parser implementations. This wrapper
supplies a modality-specific category, output path, and checkpoint, then fixes
the output metadata so every source file has the same modality contract.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import re
import sys
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
IMPLEMENTATIONS = ROOT / "data" / "MRI" / "GE"

MODALITIES: dict[str, dict[str, str]] = {
    "MRI": {
        "folder": "MRI",
        "label": "MRI",
        "geCode": "DIMagneticResonanceImaging",
        "partsSourcePath": "/shop/medical-imaging-and-glassware/mri",
        "partsSourceCategory": "medical-imaging-and-glassware-mri",
        "blockMarker": "-ge-mri-",
        "dotmedUrl": "https://www.dotmed.com/browse/parts/imaging/mri/mri-scanner/ge/",
    },
    "CT": {
        "folder": "CT",
        "label": "CT",
        "geCode": "DIComputedTomography",
        "partsSourcePath": "/shop/medical-imaging-and-glassware/pet-ct/ct",
        "partsSourceCategory": "medical-imaging-and-glassware-pet-ct-ct",
        "blockMarker": "-ge-ct-",
        "dotmedUrl": "https://www.dotmed.com/browse/parts/imaging/ct/ct-scanner/ge/",
    },
    "PET": {
        "folder": "PET",
        "label": "PET/CT",
        "geCode": "DIPETCT",
        "partsSourcePath": "/shop/medical-imaging-and-glassware/pet-ct/pet-ct",
        "partsSourceCategory": "medical-imaging-and-glassware-pet-ct-pet-ct",
        "blockMarker": "-ge-pet-",
        "dotmedUrl": "https://www.dotmed.com/browse/parts/imaging/ct/pet-ct/ge/",
    },
}

SOURCE_MODULES = {
    "ge": "scrape_ge_ge_mri.py",
    "partssource": "scrape_partssource_ge_mri.py",
    "block": "scrape_block_ge_mri.py",
    "dotmed": "scrape_dotmed_ge_mri.py",
}


def load_module(source: str) -> Any:
    path = IMPLEMENTATIONS / SOURCE_MODULES[source]
    spec = importlib.util.spec_from_file_location(f"ais_{source}_collector", path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not load collector {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def output_path(modality: str, source: str) -> Path:
    return ROOT / "data" / MODALITIES[modality]["folder"] / "GE" / f"{source}-{modality}-GE.json"


def checkpoint_path(modality: str, source: str) -> Path:
    return output_path(modality, source).with_name(f".{source}-{modality}-GE.checkpoint.json")


def configure(module: Any, source: str, modality: str) -> None:
    config = MODALITIES[modality]
    output = output_path(modality, source)
    checkpoint = checkpoint_path(modality, source)
    output.parent.mkdir(parents=True, exist_ok=True)

    module.DEFAULT_OUTPUT = output
    if hasattr(module, "DEFAULT_CHECKPOINT"):
        module.DEFAULT_CHECKPOINT = checkpoint

    if source == "ge":
        module.MRI_CATEGORY_CODE = config["geCode"]
        module.QUERY = f":mostpopular:allCategories:~{config['geCode']}"
    elif source == "partssource":
        module.CATEGORY_PATH = config["partsSourcePath"]
        module.CATEGORY_ID = config["partsSourceCategory"]
        module.SOURCE_URL = (
            f"{module.BASE_URL}{module.CATEGORY_PATH}?OEM=GE%20Healthcare&_view=all"
        )
        module.CHECKPOINT_SIGNATURE = (
            f"{module.CATEGORY_ID}|{module.OEM_NAME}|{module.PAGE_SIZE}"
        )
    elif source == "block":
        module.PRODUCT_MARKER = config["blockMarker"]
    elif source == "dotmed":
        module.BASE_URL = config["dotmedUrl"]

        def is_listing_heading(value: str) -> bool:
            text = module.clean_text(value).lower()
            if not text.startswith("ge "):
                return False
            if modality == "MRI":
                return "mri" in text and "parts" in text
            if modality == "CT":
                return "ct scanner" in text and "parts" in text
            return ("pet/ct" in text or "pet-ct" in text or " pet " in text) and "parts" in text

        def derive_model(title: str) -> str:
            value = re.sub(r"^GE\s+", "", title, flags=re.I)
            value = re.sub(r"\s+(?:MRI|CT)\s+Scanner$", "", value, flags=re.I)
            value = re.sub(r"\s+PET/?CT$", "", value, flags=re.I)
            return module.clean_text(value)

        module.is_listing_heading = is_listing_heading
        module.derive_model = derive_model


def normalize_output(path: Path, modality: str) -> None:
    payload = json.loads(path.read_text(encoding="utf-8"))
    payload["manufacturer"] = "GE"
    payload["modality"] = MODALITIES[modality]["label"]
    payload["catalogModality"] = modality
    for item in payload.get("items", []):
        if isinstance(item, dict):
            item["manufacturer"] = item.get("manufacturer") or "GE"
            item["modality"] = MODALITIES[modality]["label"]
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Collect one GE catalog source by modality.")
    parser.add_argument("--source", choices=sorted(SOURCE_MODULES), required=True)
    parser.add_argument("--modality", choices=sorted(MODALITIES), required=True)
    parser.add_argument("--pages", type=int, default=0, help="DOTmed page count; defaults to 30.")
    parser.add_argument("collector_args", nargs=argparse.REMAINDER)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    module = load_module(args.source)
    configure(module, args.source, args.modality)
    output = output_path(args.modality, args.source)

    forwarded = list(args.collector_args)
    if forwarded and forwarded[0] == "--":
        forwarded = forwarded[1:]
    if args.source == "dotmed" and "--pages" not in forwarded:
        forwarded.extend(["--pages", str(args.pages or 30)])
    if "--output" not in forwarded:
        forwarded.extend(["--output", str(output)])
    if hasattr(module, "DEFAULT_CHECKPOINT") and "--checkpoint" not in forwarded:
        forwarded.extend(["--checkpoint", str(checkpoint_path(args.modality, args.source))])

    sys.argv = [SOURCE_MODULES[args.source], *forwarded]
    result = module.main()
    if result == 0 and output.exists():
        normalize_output(output, args.modality)
        payload = json.loads(output.read_text(encoding="utf-8"))
        print(f"Normalized {len(payload.get('items', [])):,} {args.modality} records in {output}")
    return result


if __name__ == "__main__":
    raise SystemExit(main())
