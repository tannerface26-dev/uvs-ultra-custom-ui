"""Generate the extension's packaged alternate-art allowlist."""

from __future__ import annotations

import argparse
import json
import re
import subprocess
from pathlib import Path
from typing import Any
from urllib.parse import quote


EXPECTED_COUNTS = {
    "canonicalCards": 310,
    "reviewedAltSources": 430,
    "uniqueAlternateArtworks": 371,
    "mergedDuplicateSources": 59,
}
PREVIEW_SIZE = (358, 500)
MICRO_SIZE = (20, 20)
SAFE_QUALIFIER = re.compile(r"^[A-Za-z0-9_-]+/[A-Za-z0-9_-]+$")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("catalog", type=Path)
    parser.add_argument("assets", type=Path, help="uvs-tts-assets checkout root")
    parser.add_argument("revision", help="full committed uvs-tts-assets revision")
    parser.add_argument(
        "--prepare-assets",
        action="store_true",
        help="create missing preview and micro JPEGs before building",
    )
    return parser.parse_args()


def derived_paths(artwork_id: str) -> tuple[Path, Path]:
    stem = artwork_id.split("/", maxsplit=1)[1]
    base = Path("alternate-art") / "runtime-images"
    return base / f"{stem}-preview.jpg", base / f"{stem}-ci-micro.jpg"


def prepare_image(source: Path, destination: Path, size: tuple[int, int]) -> None:
    from PIL import Image, ImageOps

    destination.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(source) as image:
        rgb = image.convert("RGB")
        fitted = ImageOps.fit(rgb, size, method=Image.Resampling.LANCZOS)
        fitted.save(destination, "JPEG", quality=90, optimize=True)


def forum_qualifier(alternate: dict[str, Any]) -> str:
    for source in alternate.get("provenance") or []:
        if source.get("source") == "ultra-hosted":
            source_id = str(source.get("sourceId") or "")
            if SAFE_QUALIFIER.fullmatch(source_id):
                return source_id
    qualifier = str(alternate.get("artworkId") or "")
    if not SAFE_QUALIFIER.fullmatch(qualifier):
        raise ValueError(f"invalid Forum Code qualifier: {qualifier!r}")
    return qualifier


def main() -> None:
    args = parse_args()
    if not re.fullmatch(r"[0-9a-f]{40}", args.revision):
        raise ValueError("revision must be a full 40-character Git commit")

    catalog = json.loads(args.catalog.read_text(encoding="utf-8"))
    if catalog.get("schemaVersion") != 1:
        raise ValueError("unsupported catalog schemaVersion")
    if catalog.get("counts") != EXPECTED_COUNTS:
        raise ValueError(
            f"catalog counts changed: expected {EXPECTED_COUNTS}, "
            f"received {catalog.get('counts')}"
        )

    assets = args.assets.resolve()
    runtime_manifest = json.loads(
        (assets / "alternate-art" / "runtime" / "manifest.json").read_text(
            encoding="utf-8"
        )
    )
    original_backs = {
        str(card["uvsUltraCardId"]): card["transformBackOriginal"]
        for card in runtime_manifest["cards"]
        if card.get("transformBackOriginal")
    }
    repository_url = (
        "https://raw.githubusercontent.com/tannerface26-dev/uvs-tts-assets/"
        f"{args.revision}/"
    )
    output: dict[str, list[dict[str, Any]]] = {}
    artwork_ids: set[str] = set()
    represented_qualifiers: set[str] = set()
    referenced_paths: set[str] = set()

    def checked_path(relative_path: str) -> Path:
        path = (assets / relative_path).resolve()
        path.relative_to(assets)
        if not path.is_file():
            raise FileNotFoundError(path)
        return path

    def image_url(relative_path: Path | str) -> str:
        relative = Path(relative_path)
        checked_path(relative.as_posix())
        referenced_paths.add(relative.as_posix())
        encoded = "/".join(quote(part, safe="") for part in relative.parts)
        return repository_url + encoded

    runtime_root = assets / "alternate-art" / "runtime"

    def runtime_relative(value: str) -> Path:
        return (runtime_root / value).resolve().relative_to(assets)

    for card in catalog["cards"]:
        card_id = str(card["uvsUltraCardId"])
        if card_id in output:
            raise ValueError(f"duplicate canonical card ID: {card_id}")

        canonical = {
            "setId": card["setId"],
            "cardNumber": card["cardNumber"],
        }
        original: dict[str, Any] = {
            "artworkId": "original",
            "label": "Original",
            **canonical,
        }
        if card_id in original_backs:
            back = original_backs[card_id]
            original["transformBack"] = {
                "label": "Original Transformed Back",
                "setId": back["setId"],
                "cardNumber": back["cardNumber"],
            }
        variants: list[dict[str, Any]] = [original]

        for index, alternate in enumerate(card["alternates"], start=1):
            artwork_id = alternate["artworkId"]
            if artwork_id in artwork_ids:
                raise ValueError(f"duplicate artworkId: {artwork_id}")
            artwork_ids.add(artwork_id)

            source_path = Path(alternate["image"]["repositoryPath"])
            source = checked_path(source_path.as_posix())
            preview_path, micro_path = derived_paths(artwork_id)
            if args.prepare_assets:
                if not (assets / preview_path).is_file():
                    prepare_image(source, assets / preview_path, PREVIEW_SIZE)
                if not (assets / micro_path).is_file():
                    prepare_image(source, assets / micro_path, MICRO_SIZE)

            provenance = alternate.get("provenance") or []
            represented_qualifiers.update(
                str(item["qualifier"])
                for item in provenance
                if item.get("qualifier")
            )
            label = next(
                (item.get("label") for item in provenance if item.get("label")),
                f"Alternate Art {index}",
            )
            variant: dict[str, Any] = {
                "artworkId": artwork_id,
                "forumQualifier": forum_qualifier(alternate),
                "legacyQualifiers": sorted({
                    item["qualifier"]
                    for item in provenance
                    if item.get("qualifier")
                }),
                "label": label,
                **canonical,
                "imageUrls": {
                    "preview": image_url(preview_path),
                    "micro": image_url(micro_path),
                },
            }

            if alternate.get("transformBack"):
                back = alternate["transformBack"]
                variant["transformBack"] = {
                    "label": back["cardName"],
                    "imageUrls": {
                        "preview": image_url(runtime_relative(back["previewPath"])),
                        "micro": image_url(runtime_relative(back["microPath"])),
                    },
                }

            variants.append(variant)

        output[card_id] = variants

    runtime_additions = 0
    for card in runtime_manifest["cards"]:
        card_id = str(card["uvsUltraCardId"])
        if card_id not in output:
            original: dict[str, Any] = {
                "artworkId": "original",
                "label": "Original",
                "setId": card["original"]["setId"],
                "cardNumber": card["original"]["cardNumber"],
            }
            if card.get("transformBackOriginal"):
                back = card["transformBackOriginal"]
                original["transformBack"] = {
                    "label": "Original Transformed Back",
                    "setId": back["setId"],
                    "cardNumber": back["cardNumber"],
                }
            output[card_id] = [original]

        for runtime_variant in card.get("variants") or []:
            qualifier = str(runtime_variant["qualifier"])
            if qualifier in represented_qualifiers:
                continue
            if not SAFE_QUALIFIER.fullmatch(qualifier):
                raise ValueError(f"invalid runtime qualifier: {qualifier!r}")
            if qualifier in artwork_ids:
                raise ValueError(f"duplicate runtime artworkId: {qualifier}")
            artwork_ids.add(qualifier)
            runtime_additions += 1

            variant: dict[str, Any] = {
                "artworkId": qualifier,
                "forumQualifier": qualifier,
                "legacyQualifiers": [qualifier],
                "label": runtime_variant["label"],
                "setId": card["original"]["setId"],
                "cardNumber": card["original"]["cardNumber"],
                "imageUrls": {
                    "preview": image_url(runtime_relative(runtime_variant["previewPath"])),
                    "micro": image_url(runtime_relative(runtime_variant["microPath"])),
                },
            }
            if runtime_variant.get("transformBack"):
                back = runtime_variant["transformBack"]
                variant["transformBack"] = {
                    "label": back["cardName"],
                    "imageUrls": {
                        "preview": image_url(runtime_relative(back["previewPath"])),
                        "micro": image_url(runtime_relative(back["microPath"])),
                    },
                }
            output[card_id].append(variant)

    expected_cards = len({
        *(str(card["uvsUltraCardId"]) for card in catalog["cards"]),
        *(str(card["uvsUltraCardId"]) for card in runtime_manifest["cards"]),
    })
    if len(output) != expected_cards:
        raise ValueError("generated canonical-card count mismatch")
    expected_alternates = EXPECTED_COUNTS["uniqueAlternateArtworks"] + runtime_additions
    if len(artwork_ids) != expected_alternates:
        raise ValueError("generated alternate-art count mismatch")

    if args.prepare_assets:
        print(
            f"prepared cards={len(output)} alternates={len(artwork_ids)}; "
            "commit the asset changes, then rebuild without --prepare-assets"
        )
        return

    committed_paths = set(subprocess.run(
        [
            "git", "-C", str(assets), "ls-tree", "-r", "-z", "--name-only",
            args.revision,
        ],
        check=True,
        capture_output=True,
    ).stdout.decode("utf-8").rstrip("\0").split("\0"))
    missing_from_revision = sorted(referenced_paths - committed_paths)
    if missing_from_revision:
        sample = "\n".join(f"  {path}" for path in missing_from_revision[:10])
        raise ValueError(
            f"{len(missing_from_revision)} image files are absent from revision "
            f"{args.revision}:\n{sample}"
        )

    destination = Path(__file__).parent.parent / "remote-card-art.js"
    generated = (
        "// Generated by scripts/build-remote-card-art.py. Do not edit by hand.\n"
        f'globalThis.UVSU_REMOTE_CARD_ART_REVISION = "{args.revision}";\n'
        "globalThis.UVSU_REMOTE_CARD_ART = Object.freeze("
        + json.dumps(output, ensure_ascii=True, indent=4)
        + ");\n"
    )
    destination.write_text(generated, encoding="utf-8", newline="\n")
    print(f"cards={len(output)} alternates={len(artwork_ids)}")


if __name__ == "__main__":
    main()
