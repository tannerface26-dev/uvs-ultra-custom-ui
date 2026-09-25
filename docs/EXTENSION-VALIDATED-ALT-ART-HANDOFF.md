# Validated Alternate-Art Catalog Handoff

> **Historical implementation record.** This file documents an earlier catalog
> delivery workflow and includes machine-specific commands. For current extension
> behavior, use `CARD-IDENTITY-AND-ALTERNATE-ART.md`, the checked-in generator,
> and the generated allowlist. Do not regenerate published runtime data during a
> documentation-only task.

## Artifact

Use:

```text
docs/extension_alt_art_catalog.json
```

This is a generated input artifact for the extension. The generator is owned by
the separate TTS workspace and is intentionally not copied into the extension
repository. To regenerate it, run from the TTS workspace:

```powershell
Set-Location 'C:\Users\tanne\OneDrive\Documents\TTS UVS'
python .\uvs_tts_card_updater\build_alt_art_handoff.py
```

That command writes the TTS workspace's `docs/extension_alt_art_catalog.json`.
After regeneration, copy the catalog and report into this extension `docs`
folder. Do not run the command from the extension repository.

To prepare and package the runtime allowlist, generate any missing image sizes,
commit those assets to `uvs-tts-assets`, and then build against that full commit:

```powershell
python .\scripts\build-remote-card-art.py `
  .\docs\extension_alt_art_catalog.json `
  'C:\Users\tanne\OneDrive\Documents\git\uvs-tts-assets' `
  <full-uvs-tts-assets-commit> `
  --prepare-assets
```

Run the command again with the new committed revision after asset preparation.
The generated `remote-card-art.js` embeds that revision, and runtime URL checks
accept images only below its pinned `alternate-art` path.

The generator accepts only review decisions classified as `alt`. It excludes
`not_alt` and `functionally_distinct`, merges duplicate artwork only within the
same canonical Ultra card, preserves all source provenance, and carries paired
transform backs from the runtime source data.

## Canonical identity

Match canonical cards by:

```text
setId + cardNumber
```

`uvsUltraCardId` is a stable supporting identifier. `cardName` is display
metadata and must not establish identity because same-name cards can have
different mechanics and renamed reprints can be functionally identical.

## Catalog shape

```json
{
  "cards": [
    {
      "uvsUltraCardId": "10404",
      "setId": "yyhdt",
      "cardNumber": "154",
      "cardName": "Urameshi Perseverance",
      "alternates": [
        {
          "artworkId": "tcgplayer/10404-539680",
          "image": {
            "repositoryPath": "alternate-art/supplemental/tcgplayer-candidates/539680 - Urameshi Perseverance.jpg",
            "sourceUrl": "https://www.tcgplayer.com/product/539680/...",
            "imageUrl": "https://tcgplayer-cdn.tcgplayer.com/product/539680_in_1000x1000.jpg"
          },
          "provenance": []
        }
      ]
    }
  ]
}
```

`provenance` may contain several source records when the official gallery and
TCGplayer provided the same artwork. Do not emit duplicate choices for those
records. Use `artworkId` as the stable alternate choice identifier.

## Asset paths

Every `repositoryPath` is relative to the root of the separate
[`uvs-tts-assets`](https://github.com/tannerface26-dev/uvs-tts-assets)
repository. It is not relative to the extension repository. The catalog's
top-level `assetRepository` object declares this base explicitly. Consumers may
use `imageUrl` directly for source recognition; local file access requires a
checkout of `uvs-tts-assets`.

## Extension behavior

The extension's forum-code output should continue to emit canonical identity:

```text
{quantity} -{setId}/{cardNumber} {cardName}
```

When the source page exposes a recognized alternate image or product URL, it
may additionally associate the selected `artworkId` for importer use. Preserve
the canonical set/card pair; never replace it with TCGplayer product metadata.

The extension must not perform its own scraping or infer alternate identity by
name. Refreshes are generated and reviewed in this workspace, then delivered as
an updated catalog.
