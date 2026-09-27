"""Discover TCGplayer art/promo variants that are mechanically identical."""

from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import hashlib
import html
from io import BytesIO
import json
import re
import shutil
import unicodedata
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

import imagehash
from PIL import Image, ImageOps


TAG = re.compile(r"<[^>]+>")
SPACE = re.compile(r"\s+")
DB_SUFFIX = re.compile(r"\s*\[uvs_id\s+\d+\](?:\s+\d+)?\s*$", re.I)
VARIANT_TOKEN = re.compile(
    r"(?:alternate|alternative|alt|full)\s+art|promo|wedding|\blgs\b",
    re.I,
)
PARENTHETICAL = re.compile(r"\s*\(([^)]*)\)")
IMAGE_IDENTITY = re.compile(
    r"/images/extensions/([^/]+)/([^/.]+)\.(?:jpg|png)(?:\?.*)?$", re.I
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("catalog", type=Path)
    parser.add_argument("tcg_catalog", type=Path)
    parser.add_argument("card_db", type=Path)
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--assets", type=Path)
    parser.add_argument("--image-cache", type=Path)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--decisions", type=Path)
    parser.add_argument("--apply-review-decisions", action="store_true")
    return parser.parse_args()


def normalized_text(value: Any) -> str:
    value = html.unescape(str(value or ""))
    value = TAG.sub(" ", value)
    return SPACE.sub(" ", unicodedata.normalize("NFKC", value).casefold()).strip()


def loose_name(value: Any) -> str:
    value = DB_SUFFIX.sub("", normalized_text(value))
    value = value.replace("â€™", "'").replace("�", "")
    return re.sub(r"[^a-z0-9]+", "", value)


def variant_name(value: Any) -> tuple[bool, str, list[str]]:
    qualifiers: list[str] = []

    def replace(match: re.Match[str]) -> str:
        token = match.group(1).strip()
        if VARIANT_TOKEN.search(token):
            qualifiers.append(token)
            return ""
        return match.group(0)

    base = SPACE.sub(" ", PARENTHETICAL.sub(replace, str(value or ""))).strip()
    return bool(qualifiers), base, qualifiers


def extended(product: dict[str, Any]) -> dict[str, str]:
    return {
        str(item.get("name") or ""): str(item.get("value") or "")
        for item in product.get("extendedData") or []
    }


def field(data: dict[str, str], *names: str) -> str:
    return next((data[name] for name in names if data.get(name)), "")


def mechanics(product: dict[str, Any]) -> dict[str, Any] | None:
    data = extended(product)
    if not data.get("CardType") or not data.get("Description"):
        return None
    return {
        "type": normalized_text(data.get("CardType")),
        "resources": sorted(
            normalized_text(item)
            for item in re.split(r"[;•�]", data.get("Resource", ""))
            if item.strip()
        ),
        "difficulty": normalized_text(data.get("Difficulty")),
        "check": normalized_text(data.get("Check")),
        "blockModifier": normalized_text(data.get("BlockModifier")),
        "blockZone": normalized_text(data.get("BlockZone")),
        "attackZone": normalized_text(data.get("AttackZone")),
        "speed": normalized_text(field(data, "AttackSpeed", "Speed")),
        "damage": normalized_text(field(data, "AttackDamage", "Damage")),
        "handSize": normalized_text(data.get("HandSize")),
        "vitality": normalized_text(field(data, "Vitality", "Health")),
        "keywords": sorted(
            normalized_text(item)
            for item in re.split(r"[;•�]", data.get("Keywords", ""))
            if item.strip()
        ),
        "text": normalized_text(data.get("Description")),
    }


def fingerprint(product: dict[str, Any]) -> str | None:
    values = mechanics(product)
    if values is None:
        return None
    return hashlib.sha256(json.dumps(values, sort_keys=True).encode()).hexdigest()


def collector_identity(value: str) -> tuple[str | None, str | None]:
    left = str(value or "").split("/", 1)[0].strip()
    match = re.fullmatch(r"(?:(.+?)\s+)?(\d+)", left)
    if not match:
        return None, None
    prefix = re.sub(r"[^a-z0-9]", "", (match.group(1) or "").casefold()) or None
    return prefix, str(int(match.group(2)))


def card_db_records(card_db: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    records: dict[str, dict[str, Any]] = {}
    for key, value in card_db.items():
        ultra_id = str(value.get("uvs_id") or "")
        match = IMAGE_IDENTITY.search(str(value.get("image") or ""))
        if not ultra_id or not match:
            continue
        records[ultra_id] = {
            "uvsUltraCardId": ultra_id,
            "cardName": DB_SUFFIX.sub("", key),
            "looseName": loose_name(key),
            "setId": match.group(1).casefold(),
            "cardNumber": match.group(2),
            "numericCardNumber": str(int(match.group(2))) if match.group(2).isdigit() else None,
            "type": normalized_text(value.get("type")),
        }
    return list(records.values())


def choose_db_record(
    variant: dict[str, Any],
    anchors: list[dict[str, Any]],
    db_records: list[dict[str, Any]],
) -> tuple[dict[str, Any] | None, list[dict[str, Any]]]:
    _, variant_base, _ = variant_name(variant["name"])
    names = {loose_name(variant_base)}
    for anchor in anchors:
        _, anchor_base, _ = variant_name(anchor["name"])
        names.add(loose_name(anchor_base))
        names.update(loose_name(part) for part in re.split(r"\s*//\s*", anchor_base))

    typed = normalized_text(extended(variant).get("CardType"))
    candidates = [record for record in db_records if record["looseName"] in names]
    if typed:
        matching_type = [record for record in candidates if record["type"] == typed]
        if matching_type:
            candidates = matching_type

    scored: list[tuple[int, dict[str, Any]]] = []
    for candidate in candidates:
        score = 0
        for anchor in anchors:
            prefix, number = collector_identity(extended(anchor).get("Number", ""))
            set_id = re.sub(r"[^a-z0-9]", "", candidate["setId"])
            if prefix and prefix == set_id:
                score += 20
            if number and number == candidate["numericCardNumber"]:
                score += 10
            if prefix == set_id and number == candidate["numericCardNumber"]:
                score += 50
        scored.append((score, candidate))

    scored.sort(key=lambda item: (-item[0], int(item[1]["uvsUltraCardId"])))
    if not scored:
        return None, []
    if len(scored) == 1 or scored[0][0] > scored[1][0]:
        return scored[0][1], [item[1] for item in scored]
    return None, [item[1] for item in scored]


def safe_filename(value: str) -> str:
    return re.sub(r'[<>:"/\\|?*]', "-", value).strip(" .")


def download_url(url: str, destination: Path) -> Path:
    if destination.is_file() and destination.stat().st_size:
        return destination
    request = Request(
        url,
        headers={"Referer": "https://www.tcgplayer.com/", "User-Agent": "Mozilla/5.0"},
    )
    with urlopen(request, timeout=60) as response:
        content = response.read()
    Image.open(BytesIO(content)).verify()
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(content)
    return destination


def image_hashes(path: Path) -> tuple[imagehash.ImageHash, imagehash.ImageHash]:
    with Image.open(path) as image:
        rgb = image.convert("RGB")
        return imagehash.phash(rgb, hash_size=16), imagehash.dhash(rgb, hash_size=16)


def duplicate_hashes(
    left: tuple[imagehash.ImageHash, imagehash.ImageHash],
    right: tuple[imagehash.ImageHash, imagehash.ImageHash],
) -> bool:
    return left[0] - right[0] <= 10 and left[1] - right[1] <= 10


def prepare_image(source: Path, destination: Path, size: tuple[int, int]) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(source) as image:
        fitted = ImageOps.fit(
            image.convert("RGB"), size, method=Image.Resampling.LANCZOS
        )
        fitted.save(destination, "JPEG", quality=90, optimize=True)


def apply_records(
    catalog: dict[str, Any],
    records: list[dict[str, Any]],
    catalog_path: Path,
    assets: Path,
    cache: Path,
    database: list[dict[str, Any]],
) -> dict[str, int]:
    selected = [record for record in records if record["status"] == "mechanics_match_mapped"]
    cache.mkdir(parents=True, exist_ok=True)
    downloads: dict[str, Path] = {}
    errors: dict[str, str] = {}
    with ThreadPoolExecutor(max_workers=6) as executor:
        futures = {}
        for record in selected:
            product_id = record["productId"]
            futures[executor.submit(
                download_url, record["imageUrl"], cache / f"{product_id}.jpg"
            )] = (product_id, "front")
            if record["imageCount"] > 1:
                back_url = (
                    "https://tcgplayer-cdn.tcgplayer.com/product/"
                    f"{product_id}_1_in_1000x1000.jpg"
                )
                futures[executor.submit(
                    download_url, back_url, cache / f"{product_id}-back.jpg"
                )] = (product_id, "back")
        for future in as_completed(futures):
            product_id, side = futures[future]
            try:
                downloads[f"{product_id}:{side}"] = future.result()
            except (HTTPError, URLError, OSError, ValueError) as error:
                errors[f"{product_id}:{side}"] = str(error)

    cards_by_id = {str(card["uvsUltraCardId"]): card for card in catalog["cards"]}
    runtime = json.loads(
        (assets / "alternate-art" / "runtime" / "manifest.json").read_text(
            encoding="utf-8"
        )
    )
    runtime_by_id = {str(card["uvsUltraCardId"]): card for card in runtime["cards"]}
    existing_hashes: dict[str, list[tuple[dict[str, Any], tuple[Any, Any]]]] = {}
    stats: dict[str, int] = defaultdict(int)
    destination_root = assets / "alternate-art" / "supplemental" / "tcgplayer-reviewed"

    def transform_back_identity(record: dict[str, Any]) -> dict[str, Any] | None:
        parts = re.split(r"\s*//\s*", record["baseName"], maxsplit=1)
        if len(parts) != 2:
            return None
        wanted = loose_name(parts[1])
        matches = [candidate for candidate in database if candidate["looseName"] == wanted]
        return matches[0] if len(matches) == 1 else None

    for record in selected:
        product_id = record["productId"]
        source_path = downloads.get(f"{product_id}:front")
        if not source_path:
            record["importStatus"] = "image_download_failed"
            record["importError"] = errors.get(f"{product_id}:front")
            stats["imageDownloadFailed"] += 1
            continue
        identity = record["identity"]
        ultra_id = identity["uvsUltraCardId"]
        if record["imageCount"] > 1:
            runtime_card = runtime_by_id.get(ultra_id)
            back = None
            if runtime_card:
                back = next(
                    (
                        variant.get("transformBack")
                        for variant in runtime_card.get("variants") or []
                        if variant.get("transformBack")
                    ),
                    None,
                )
                if back is None and runtime_card.get("transformBackOriginal"):
                    original_back = runtime_card["transformBackOriginal"]
                    back = next(
                        (
                            candidate
                            for candidate in database
                            if candidate["setId"] == original_back["setId"].casefold()
                            and candidate["cardNumber"].casefold()
                            == str(original_back["cardNumber"]).casefold()
                        ),
                        None,
                    )
            if back is None:
                back = transform_back_identity(record)
            if not back:
                record["importStatus"] = "transform_identity_unavailable"
                stats["transformIdentityUnavailable"] += 1
                continue
            if f"{product_id}:back" not in downloads:
                record["importStatus"] = "transform_back_download_failed"
                record["importError"] = errors.get(f"{product_id}:back")
                stats["transformBackDownloadFailed"] += 1
                continue

        card = cards_by_id.get(ultra_id)
        if card is None:
            card = {
                "uvsUltraCardId": ultra_id,
                "setId": identity["setId"],
                "cardNumber": identity["cardNumber"],
                "cardName": record["baseName"].split("//", 1)[0].strip(),
                "alternates": [],
            }
            cards_by_id[ultra_id] = card
            catalog["cards"].append(card)

        if record["imageCount"] > 1:
            back_identity = transform_back_identity(record)
            runtime_card = runtime_by_id.get(ultra_id)
            if back_identity and not runtime_card:
                card["transformBackOriginal"] = {
                    "uvsUltraCardId": back_identity["uvsUltraCardId"],
                    "cardName": back_identity["cardName"],
                    "setId": back_identity["setId"],
                    "cardNumber": back_identity["cardNumber"],
                }

        if ultra_id not in existing_hashes:
            values = []
            for alternate in card["alternates"]:
                path = assets / alternate["image"]["repositoryPath"]
                if path.is_file():
                    values.append((alternate, image_hashes(path)))
            existing_hashes[ultra_id] = values

        source_hashes = image_hashes(source_path)
        duplicate = next(
            (
                alternate
                for alternate, hashes in existing_hashes[ultra_id]
                if duplicate_hashes(source_hashes, hashes)
            ),
            None,
        )
        qualifier = f"tcgplayer/{ultra_id}-{product_id}"
        provenance = {
            "source": "tcgplayer",
            "sourceId": product_id,
            "qualifier": qualifier,
            "label": f"{record['set']} / {', '.join(record['qualifiers'])}",
            "sourceUrl": record["productUrl"],
            "imageUrl": record["imageUrl"],
        }
        if duplicate:
            if not any(
                item.get("source") == "tcgplayer" and str(item.get("sourceId")) == product_id
                for item in duplicate.get("provenance") or []
            ):
                duplicate.setdefault("provenance", []).append(provenance)
                duplicate["provenance"].sort(
                    key=lambda item: (item.get("source", ""), str(item.get("sourceId", "")))
                )
            record["importStatus"] = "merged_duplicate_artwork"
            stats["mergedDuplicateArtwork"] += 1
            continue

        filename = f"{product_id} - {safe_filename(record['name'])}.jpg"
        destination = destination_root / filename
        destination.parent.mkdir(parents=True, exist_ok=True)
        if not destination.exists():
            shutil.copyfile(source_path, destination)
        relative_path = destination.relative_to(assets).as_posix()
        provenance["repositoryPath"] = relative_path
        alternate: dict[str, Any] = {
            "artworkId": qualifier,
            "image": {
                "repositoryPath": relative_path,
                "sourceUrl": record["productUrl"],
                "imageUrl": record["imageUrl"],
            },
            "provenance": [provenance],
        }

        if record["imageCount"] > 1:
            runtime_card = runtime_by_id.get(ultra_id)
            back = None
            if runtime_card:
                back = next(
                    (
                        variant.get("transformBack")
                        for variant in runtime_card.get("variants") or []
                        if variant.get("transformBack")
                    ),
                    None,
                )
                if back is None and runtime_card.get("transformBackOriginal"):
                    original_back = runtime_card["transformBackOriginal"]
                    back = next(
                        candidate
                        for candidate in database
                        if candidate["setId"] == original_back["setId"].casefold()
                        and candidate["cardNumber"].casefold()
                        == str(original_back["cardNumber"]).casefold()
                    )
            if back is None:
                back = transform_back_identity(record)
            back_source = downloads[f"{product_id}:back"]
            back_stem = f"{ultra_id}-{product_id}-back"
            preview = assets / "alternate-art" / "runtime-images" / f"{back_stem}-preview.jpg"
            micro = assets / "alternate-art" / "runtime-images" / f"{back_stem}-ci-micro.jpg"
            prepare_image(back_source, preview, (358, 500))
            prepare_image(back_source, micro, (20, 20))
            back_destination = destination_root / (
                f"{product_id}-back - {safe_filename(str(back.get('cardName') or 'Transform Back'))}.jpg"
            )
            if not back_destination.exists():
                shutil.copyfile(back_source, back_destination)
            alternate["transformBack"] = {
                "uvsUltraCardId": str(back["uvsUltraCardId"]),
                "cardName": str(back.get("cardName") or "Transformed Back"),
                "qualifier": f"tcgplayer/{back['uvsUltraCardId']}-{product_id}-back",
                "sourcePath": "../supplemental/tcgplayer-reviewed/" + back_destination.name,
                "previewPath": "../runtime-images/" + preview.name,
                "microPath": "../runtime-images/" + micro.name,
            }

        card["alternates"].append(alternate)
        card["alternates"].sort(key=lambda item: item["artworkId"])
        existing_hashes[ultra_id].append((alternate, source_hashes))
        record["importStatus"] = "added_new_artwork"
        stats["addedNewArtwork"] += 1

    catalog["cards"].sort(key=lambda card: int(card["uvsUltraCardId"]))
    catalog["generatedAt"] = datetime.now().astimezone().isoformat()
    sources = sum(
        len(alternate.get("provenance") or [])
        for card in catalog["cards"]
        for alternate in card["alternates"]
    )
    artworks = sum(len(card["alternates"]) for card in catalog["cards"])
    catalog["counts"] = {
        "canonicalCards": len(catalog["cards"]),
        "reviewedAltSources": sources,
        "uniqueAlternateArtworks": artworks,
        "mergedDuplicateSources": sources - artworks,
    }
    catalog_path.write_text(
        json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return dict(stats)


def apply_review_decisions(
    catalog: dict[str, Any], decisions_path: Path, catalog_path: Path
) -> dict[str, int]:
    decisions = json.loads(decisions_path.read_text(encoding="utf-8")).get(
        "decisions", {}
    )
    stats: dict[str, int] = defaultdict(int)
    kept_cards = []
    for card in catalog.get("cards", []):
        kept_alternates = []
        for alternate in card.get("alternates", []):
            qualifier = str(alternate.get("artworkId") or "")
            decision = (decisions.get(qualifier) or {}).get("decision")
            if decision in {"not_alt", "functionally_distinct"}:
                stats[decision] += 1
                continue
            kept_alternates.append(alternate)
        if kept_alternates:
            card["alternates"] = kept_alternates
            kept_cards.append(card)
        else:
            stats["emptyCardsRemoved"] += 1

    catalog["cards"] = kept_cards
    catalog["generatedAt"] = datetime.now().astimezone().isoformat()
    sources = sum(
        len(alternate.get("provenance") or [])
        for card in kept_cards
        for alternate in card["alternates"]
    )
    artworks = sum(len(card["alternates"]) for card in kept_cards)
    catalog["counts"] = {
        "canonicalCards": len(kept_cards),
        "reviewedAltSources": sources,
        "uniqueAlternateArtworks": artworks,
        "mergedDuplicateSources": sources - artworks,
    }
    catalog_path.write_text(
        json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    stats["acceptedAlternateArtworks"] = artworks
    return dict(stats)


def main() -> None:
    args = parse_args()
    catalog = json.loads(args.catalog.read_text(encoding="utf-8"))
    tcg_catalog = json.loads(args.tcg_catalog.read_text(encoding="utf-8"))
    card_db = json.loads(args.card_db.read_text(encoding="utf-8"))

    represented: dict[str, str] = {}
    for card in catalog["cards"]:
        for alternate in card["alternates"]:
            for source in alternate.get("provenance") or []:
                if source.get("source") == "tcgplayer":
                    represented[str(source["sourceId"])] = str(card["uvsUltraCardId"])

    products = tcg_catalog["products"]
    by_fingerprint: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for product in products:
        product_fingerprint = fingerprint(product)
        if product_fingerprint:
            by_fingerprint[product_fingerprint].append(product)

    database = card_db_records(card_db)
    records = []
    for product in products:
        is_variant, base_name, qualifiers = variant_name(product.get("name"))
        if not is_variant:
            continue
        product_fingerprint = fingerprint(product)
        equivalent = by_fingerprint.get(product_fingerprint or "", [])
        anchors = [
            candidate
            for candidate in equivalent
            if not variant_name(candidate.get("name"))[0]
            and loose_name(variant_name(candidate.get("name"))[1])
            == loose_name(base_name)
        ]
        if not anchors:
            anchors = [
                candidate
                for candidate in equivalent
                if not variant_name(candidate.get("name"))[0]
            ]

        existing_ultra_ids = {
            represented[str(candidate["productId"])]
            for candidate in equivalent
            if str(candidate["productId"]) in represented
        }
        selected = None
        mapping_candidates: list[dict[str, Any]] = []
        if len(existing_ultra_ids) == 1:
            ultra_id = next(iter(existing_ultra_ids))
            selected = next(
                record for record in database if record["uvsUltraCardId"] == ultra_id
            )
        elif anchors:
            selected, mapping_candidates = choose_db_record(product, anchors, database)

        product_id = str(product["productId"])
        status = "mechanics_match_mapped" if selected and anchors else "unresolved"
        if product_id in represented:
            status = "already_represented"
        elif not anchors:
            status = "no_mechanics_identical_original"
        elif not selected:
            status = "ambiguous_or_unmapped_identity"

        records.append({
            "productId": product_id,
            "name": product.get("name"),
            "baseName": base_name,
            "qualifiers": qualifiers,
            "set": product.get("groupName"),
            "number": extended(product).get("Number"),
            "productUrl": product.get("url"),
            "imageUrl": (
                "https://tcgplayer-cdn.tcgplayer.com/product/"
                f"{product_id}_in_1000x1000.jpg"
            ),
            "imageCount": int(product.get("imageCount") or 1),
            "mechanicsFingerprint": product_fingerprint,
            "anchorProductIds": sorted(str(item["productId"]) for item in anchors),
            "status": status,
            "identity": selected,
            "identityCandidates": mapping_candidates,
        })

    counts: dict[str, int] = defaultdict(int)
    for record in records:
        counts[record["status"]] += 1
    output = {
        "schemaVersion": 1,
        "policy": (
            "Parenthetical art/promo variants require an identical complete TCGplayer "
            "mechanics fingerprint and an unambiguous canonical +Ultra identity."
        ),
        "counts": {"variantProducts": len(records), **dict(sorted(counts.items()))},
        "records": sorted(records, key=lambda row: int(row["productId"])),
    }
    if args.apply:
        if not args.assets or not args.image_cache:
            raise ValueError("--assets and --image-cache are required with --apply")
        output["importCounts"] = apply_records(
            catalog,
            output["records"],
            args.catalog,
            args.assets.resolve(),
            args.image_cache.resolve(),
            database,
        )
    if args.apply_review_decisions:
        if not args.decisions:
            raise ValueError("--decisions is required with --apply-review-decisions")
        output["reviewDecisionCounts"] = apply_review_decisions(
            catalog, args.decisions.resolve(), args.catalog
        )
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(
        json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(output["counts"], indent=2))


if __name__ == "__main__":
    main()
