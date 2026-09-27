"""Audit TCGplayer UniVersus alternate-art products against the reviewed catalog."""

from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from io import BytesIO
import json
import re
import tempfile
import unicodedata
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

import imagehash
from PIL import Image


SEARCH_URL = (
    "https://mp-search-api.tcgplayer.com/v1/search/request"
    "?q=alternate+art&isList=false&mpfev=5580"
)
HEADERS = {
    "Origin": "https://www.tcgplayer.com",
    "Referer": "https://www.tcgplayer.com/",
    "User-Agent": "Mozilla/5.0",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("catalog", type=Path)
    parser.add_argument("--assets", type=Path)
    parser.add_argument("--card-db", type=Path)
    parser.add_argument("--image-cache", type=Path)
    parser.add_argument("--report", type=Path)
    parser.add_argument("--debug", action="store_true")
    return parser.parse_args()


def search_payload(offset: int, size: int = 24) -> dict[str, Any]:
    return {
        "algorithm": "sales_dismax",
        "from": offset,
        "size": size,
        "filters": {
            "term": {"productLineName": ["universus"]},
            "range": {},
            "match": {},
        },
        "listingSearch": {
            "context": {"cart": {"packages": {}}},
            "filters": {
                "term": {"sellerStatus": "Live", "channelId": 0},
                "range": {"quantity": {"gte": 1}},
                "exclude": {"channelExclusion": 0},
            },
        },
        "context": {
            "cart": {"packages": {}},
            "shippingCountry": "US",
            "userProfile": {},
        },
        "settings": {"useFuzzySearch": True, "didYouMean": {}},
        "sort": {"field": "product-sorting-name", "order": "asc"},
    }


def fetch_page(offset: int) -> dict[str, Any]:
    request = Request(
        SEARCH_URL,
        data=json.dumps(search_payload(offset)).encode("utf-8"),
        headers={**HEADERS, "Content-Type": "application/json"},
        method="POST",
    )
    with urlopen(request, timeout=30) as response:
        data = json.load(response)

    if data.get("errors"):
        raise RuntimeError(data["errors"])
    results = data.get("results") or []
    if len(results) != 1:
        raise ValueError("TCGplayer returned an unexpected search result shape")
    return results[0]


def fetch_products() -> list[dict[str, Any]]:
    products: dict[int, dict[str, Any]] = {}
    offset = 0
    total = None

    while total is None or offset < total:
        page = fetch_page(offset)
        total = int(page["totalResults"])
        page_products = page.get("results") or []
        if not page_products:
            break
        for product in page_products:
            products[int(product["productId"])] = product
        offset += len(page_products)

    if total is None or len(products) != total:
        raise ValueError(
            f"TCGplayer result count mismatch: expected {total}, "
            f"received {len(products)} unique products"
        )
    return list(products.values())


def existing_tcgplayer_ids(catalog: dict[str, Any]) -> set[int]:
    return {
        int(source["sourceId"])
        for card in catalog["cards"]
        for alternate in card["alternates"]
        for source in alternate.get("provenance") or []
        if source.get("source") == "tcgplayer"
    }


def alternate_card_name(product_name: str) -> str:
    return re.sub(
        r"\s*\(Alternate Art\)(?:\s*\([^)]*\))*\s*$",
        "",
        product_name,
        flags=re.I,
    ).strip()


def normalized_name(value: str) -> str:
    return re.sub(r"\s+", " ", unicodedata.normalize("NFKC", value).casefold()).strip()


def image_url(product_id: int) -> str:
    return (
        "https://tcgplayer-cdn.tcgplayer.com/product/"
        f"{product_id}_in_1000x1000.jpg"
    )


def download_image(product_id: int, cache: Path) -> Path:
    destination = cache / f"{product_id}.jpg"
    if destination.is_file() and destination.stat().st_size:
        return destination
    request = Request(image_url(product_id), headers=HEADERS)
    with urlopen(request, timeout=60) as response:
        content = response.read()
    Image.open(BytesIO(content)).verify()
    destination.write_bytes(content)
    return destination


def perceptual_hash(path: Path) -> imagehash.ImageHash:
    with Image.open(path) as image:
        return imagehash.phash(image.convert("RGB"))


def catalog_cards_by_id(catalog: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {str(card["uvsUltraCardId"]): card for card in catalog["cards"]}


def card_db_match(
    product_name: str, card_db: dict[str, dict[str, Any]]
) -> dict[str, Any] | None:
    name = alternate_card_name(product_name)
    candidates = [name, *re.split(r"\s*//\s*", name)]
    for candidate in candidates:
        match = card_db.get(normalized_name(candidate))
        if match:
            return match
    return None


def audit_images(
    products: list[dict[str, Any]],
    catalog: dict[str, Any],
    assets: Path,
    card_db: dict[str, dict[str, Any]],
    cache: Path,
) -> list[dict[str, Any]]:
    cache.mkdir(parents=True, exist_ok=True)
    paths: dict[int, Path] = {}
    download_errors: dict[int, str] = {}
    with ThreadPoolExecutor(max_workers=8) as executor:
        futures = {
            executor.submit(download_image, int(product["productId"]), cache): int(
                product["productId"]
            )
            for product in products
        }
        for future in as_completed(futures):
            product_id = futures[future]
            try:
                paths[product_id] = future.result()
            except (HTTPError, URLError, OSError, ValueError) as error:
                download_errors[product_id] = str(error)

    catalog_by_id = catalog_cards_by_id(catalog)
    local_hashes: dict[str, list[tuple[str, imagehash.ImageHash]]] = {}
    records = []
    for product in products:
        product_id = int(product["productId"])
        db_match = card_db_match(product["productName"], card_db)
        ultra_id = str(db_match["uvs_id"]) if db_match else None
        catalog_card = catalog_by_id.get(ultra_id or "")
        closest = None
        if catalog_card and product_id in paths:
            if ultra_id not in local_hashes:
                values = []
                for alternate in catalog_card["alternates"]:
                    repository_path = alternate["image"]["repositoryPath"]
                    local_path = assets / repository_path
                    if local_path.is_file():
                        values.append((alternate["artworkId"], perceptual_hash(local_path)))
                local_hashes[ultra_id] = values
            remote_hash = perceptual_hash(paths[product_id])
            distances = [
                (remote_hash - existing_hash, artwork_id)
                for artwork_id, existing_hash in local_hashes[ultra_id]
            ]
            if distances:
                distance, artwork_id = min(distances)
                closest = {"artworkId": artwork_id, "pHashDistance": int(distance)}

        records.append(
            {
                "productId": product_id,
                "productName": product["productName"],
                "cardName": alternate_card_name(product["productName"]),
                "setName": product["setName"],
                "setUrlName": product["setUrlName"],
                "productUrlName": product["productUrlName"],
                "rarityName": product.get("rarityName"),
                "customAttributes": product.get("customAttributes") or {},
                "imageUrl": image_url(product_id),
                "imageDownloaded": product_id in paths,
                "imageDownloadError": download_errors.get(product_id),
                "uvsUltraCardId": ultra_id,
                "cardDbType": db_match.get("type") if db_match else None,
                "closestExistingArtwork": closest,
            }
        )
    return records


def main() -> None:
    args = parse_args()
    catalog = json.loads(args.catalog.read_text(encoding="utf-8"))
    products = fetch_products()
    alternates = sorted(
        (
            product
            for product in products
            if re.search(r"\(Alternate Art\)", product["productName"], re.I)
        ),
        key=lambda product: (
            product["productName"].casefold(),
            int(product["productId"]),
        ),
    )
    represented = existing_tcgplayer_ids(catalog)
    missing = [
        product
        for product in alternates
        if int(product["productId"]) not in represented
    ]

    print(f"search products={len(products)}")
    print(f"exact '(Alternate Art)' products={len(alternates)}")
    print(f"already represented={len(alternates) - len(missing)}")
    print(f"missing={len(missing)}")
    for product in missing:
        print(
            f"{int(product['productId'])}\t{product['productName']}\t"
            f"{product['setName']}"
        )

    report = None
    if args.assets or args.card_db or args.report:
        if not args.assets or not args.card_db:
            raise ValueError("--assets and --card-db are required for a detailed audit")
        card_db = json.loads(args.card_db.read_text(encoding="utf-8"))
        cache = args.image_cache or Path(tempfile.gettempdir()) / "uvs-tcgplayer-alts"
        records = audit_images(missing, catalog, args.assets, card_db, cache)
        report = {
            "searchProductCount": len(products),
            "exactAlternateArtCount": len(alternates),
            "representedProductIdCount": len(alternates) - len(missing),
            "unrepresentedProductIdCount": len(missing),
            "records": records,
        }
        if args.report:
            args.report.parent.mkdir(parents=True, exist_ok=True)
            args.report.write_text(
                json.dumps(report, indent=2, ensure_ascii=False) + "\n",
                encoding="utf-8",
            )

    if args.debug:
        print(json.dumps(report or missing, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
