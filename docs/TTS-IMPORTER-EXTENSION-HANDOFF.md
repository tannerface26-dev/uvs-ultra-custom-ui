# TTS Importer Handoff: UVS Ultra Extension Identities

> **External integration contract and historical handoff.** The local repository
> paths and revision examples below describe the environment at the time of the
> handoff. The extension is already published; do not change its runtime solely
> to make this document cleaner. Current extension-side identity behavior is
> summarized in `CARD-IDENTITY-AND-ALTERNATE-ART.md`.

## Goal

Update the TTS deck importer and CardDB so Forum Code produced by the Chrome
extension resolves the exact selected card art. This includes ordinary UVS
Ultra images, repository-hosted alternate art, multiple alternates for one
card, and paired front/back art for shift or transform cards.

Local repositories:

```text
Extension:
C:\Users\tanne\OneDrive\Documents\chrome_custom_extensions\uvs_ultra_custom_ui

Assets and runtime catalog:
C:\Users\tanne\OneDrive\Documents\git\uvs-tts-assets

TTS project:
C:\Users\tanne\OneDrive\Documents\git\uvs_tts_v3_files
```

Assets revision used by extension `0.3.4`:

```text
ff69e6b283e3c0afcfeabccffe2f7e3a75d1b301
```

Runtime catalog:

```text
uvs-tts-assets/alternate-art/runtime/manifest.json
```

## Forum Code Format

The extension emits every card line as:

```text
{quantity} -{setId}/{cardNumber} {complete card name}
```

Parse this format first:

```regex
^\s*(\d+)\s+-([A-Za-z0-9_-]+)/([A-Za-z0-9_-]+)\s+(.+?)\s*$
```

Capture groups are quantity, set ID, card number, and complete card name.
Preserve `cardNumber` as a string because leading zeroes are significant.

Continue parsing these older formats afterward for compatibility:

```text
{quantity} -{setId} {cardName}
{quantity} {cardName}
```

Qualified lookups must fail closed. If an exact qualified identity is unknown,
report that card as unresolved. Do not silently fall back to another printing
with the same name.

## Ordinary UVS Ultra Identity

For ordinary cards, `setId/cardNumber` is the exact image directory and filename
stem from UVS Ultra:

```text
1 -yyhdt/095 Walk The Dog
```

The full image URL is:

```text
https://uvsultra.online/images/extensions/yyhdt/095.jpg
```

Build an exact CardDB index using:

```text
lowercase(setId) + newline + cardNumber + newline + normalized complete name
```

Do not use set ID alone. Different images can share both a card name and set
directory.

## Repository Alternate Identity

Repository-hosted alternates reserve `repo` as the set ID:

```text
repo/{uvsUltraCardId}-{officialGalleryId}
```

Examples:

```text
1 -repo/9958-3914 Nejire Hado
1 -repo/9958-4788 Nejire Hado
1 -repo/10964-2727 Eren Yeager, Promising Scout
```

Never construct a URL by interpolating Forum Code. Resolve the complete token
and normalized card name through importer-owned data generated from the runtime
catalog. Unknown tokens must fail.

Use the full-resolution `sourcePath` image for TTS card faces. `previewPath` and
`microPath` are browser UI derivatives and should not be imported into TTS.

A pinned raw GitHub URL has this shape:

```text
https://raw.githubusercontent.com/tannerface26-dev/uvs-tts-assets/{approvedCommit}/alternate-art/official-gallery/images/...
```

Prefer generating the TTS lookup at build/update time from the checked-out
catalog. Do not fetch a mutable remote manifest during gameplay.

## Runtime Catalog Shape

Schema version 3 groups alternates under the canonical front card:

```json
{
  "uvsUltraCardId": "10964",
  "cardName": "Eren Yeager, Promising Scout",
  "original": {
    "setId": "aot01",
    "cardNumber": "331"
  },
  "transformBackOriginal": {
    "setId": "aot01",
    "cardNumber": "331B"
  },
  "variants": [
    {
      "qualifier": "repo/10964-2727",
      "sourcePath": "../official-gallery/images/2727 - Eren Yeager, Promising Scout.png",
      "transformBack": {
        "qualifier": "repo/10965-2799",
        "cardName": "Attack Titan, Ferocious Challenger",
        "sourcePath": "../official-gallery/images/2799 - Attack Titan, Ferocious Challenger.png"
      }
    }
  ]
}
```

Resolve catalog paths relative to the directory containing `manifest.json`,
then verify the resolved path stays inside the assets repository. Reject missing
files, traversal, malformed qualifiers, duplicate qualifiers, and conflicting
name mappings during generation.

## Transform And Shift Cards

A transforming card still produces one Forum Code line for its front identity:

```text
1 -repo/10964-2727 Eren Yeager, Promising Scout
```

That lookup must return both:

```text
Front: repo/10964-2727, gallery image 2727
Back:  repo/10965-2799, gallery image 2799
```

Do not expect a separate Forum Code line for the transformed face. Preserve the
paired back URL in whatever CardDB structure the TTS spawning and flip/transform
logic already uses for two-sided cards. The alternate front must not retain the
original back image.

The current catalog contains 16 reviewed front/back alternate pairs. Paired back
faces are nested under `transformBack` and are intentionally not emitted as
standalone runtime cards.

## Suggested Internal Records

Parsed deck entry:

```lua
{
    number = 1,
    card = "Eren Yeager, Promising Scout",
    setId = "repo",
    cardNumber = "10964-2727",
    side = false,
    sectionType = "Character"
}
```

Resolved CardDB entry:

```lua
{
    key = "eren yeager, promising scout [repo/10964-2727]",
    image = "<allowlisted full-resolution front URL>",
    imageBack = "<allowlisted full-resolution transformed-back URL>",
    uvs_id = 10964,
    transform_back_uvs_id = 10965
}
```

Field names may follow the existing CardDB conventions. The required behavior
is exact qualified lookup plus preservation of both face URLs.

## Security Requirements

- Treat Forum Code as untrusted text.
- Do not turn user-provided tokens into network URLs.
- Resolve only against importer-owned CardDB and catalog records.
- Require the complete normalized card name to agree with the qualifier.
- Require HTTPS and an explicitly approved host for every generated URL.
- Pin repository URLs to a reviewed full Git commit.
- Validate catalog paths remain inside the checked-out assets repository.
- Fail a qualified card when lookup is missing or ambiguous.
- Do not download or execute remote Lua or other code.

## Regression Cases

### Ordinary exact image

```text
1 -yyhdt/095 Walk The Dog
```

Expected front: `yyhdt/095.jpg`.

### Existing UVS Ultra alternate

```text
1 -bl01/005 Walk The Dog
```

Expected front: `bl01/005.jpg`.

### Multiple repository alternates

```text
1 -repo/9958-3914 Nejire Hado
1 -repo/9958-4788 Nejire Hado
```

Each token must resolve to a different full-resolution image despite sharing the
same displayed card name and canonical UVS Ultra card ID.

### Transforming repository alternate

```text
1 -repo/10964-2727 Eren Yeager, Promising Scout
```

Expected: alternate front `2727` and alternate transformed back `2799`.

### Name mismatch

```text
1 -repo/10964-2727 Walk The Dog
```

Expected: reject as unresolved.

### Unknown qualifier

```text
1 -repo/10964-999999 Eren Yeager, Promising Scout
```

Expected: reject as unresolved without attempting a network request.

### Compatibility

Confirm legacy name-only lines still use existing legacy behavior, while every
line containing `setId/cardNumber` uses exact lookup and never silently falls
back.

## Completion Report

When implementation is complete, report:

1. Importer and CardDB files changed.
2. Exact qualified-index key shape.
3. How the runtime manifest becomes importer-owned lookup data.
4. How paired transform backs are represented and spawned.
5. Results for all regression cases above.
6. Any catalog entries that could not be represented safely.
