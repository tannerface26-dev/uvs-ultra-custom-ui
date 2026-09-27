# Codex Extension Handoff

## Status

This handoff records the active alternate-art work as of 2026-09-25. It is an
implementation status note, not the architecture source of truth. Read
`CARD-IDENTITY-AND-ALTERNATE-ART.md` and
`EXTENSION-ALT-ART-MATCHING-RULES.md` before changing behavior.

> **2026-09-26 identity update:** Source-specific qualifiers shown later in this
> historical record have been superseded. Public repository-hosted identities now
> use `repo/{uvsUltraCardId}-{assetId}`. Build-time provenance remains in audit
> data but is not emitted in Forum Code or packaged runtime identity data.

Target table patch and save:

```text
uvs_tts_3.15.1
TS_Save_24.json
```

The user has completed two updater review passes:

- 262 general TCGplayer candidates: 246 accepted as `alt`, 16 rejected as
  `functionally_distinct`.
- 24 TK802 character variants: all 24 accepted as `alt`.

The resulting extension catalog includes 270 newly accepted selections relative
to the prior checked-in catalog. The user validated TTS patch `3.15.1` with the
exact extension `0.4.1` layout on 2026-09-26.

## Current generated state

`docs/extension_alt_art_catalog.json` currently reports:

```text
canonicalCards: 513
reviewedAltSources: 798
uniqueAlternateArtworks: 640
mergedDuplicateSources: 158
```

`remote-card-art.js` currently contains:

```text
canonical cards: 522
selectable alternate qualifiers: 682
```

All generated repository URLs are pinned to this `uvs-tts-assets` revision:

```text
6348e7dc2270a800da0d475bee46a99430db7b8c
```

That asset revision was committed and pushed as:

```text
6348e7d Add reviewed TK802 character alternate art
```

It added 69 TK802 files: 21 full-resolution TCGplayer images and 48
preview/micro derivatives. Three full-resolution product images already existed
in the repository.

## TK802 identity correction

Do not map TK802 character variants through an older same-name card. The first
review queue incorrectly mapped Heihachi, Kazuya, and Nina to legacy UVS IDs
because the updater's `cardDB_fresh.json` did not contain the active TK802 rows.
The corrected queue uses `.tts/bundled/card_db.664c59.lua` as its identity
source.

The reviewed TK802 mappings are:

| Character | UVS ID | Original image | Accepted variants |
|---|---:|---|---:|
| Alisa Bosconovitch | `12659` | `tk802/001` | 1 |
| Asuka Kazama | `12674` | `tk802/002` | 1 |
| Eddy Gordo | `12721` | `tk802/003` | 1 |
| Heihachi Mishima | `12697` | `tk802/004` | 3 |
| Hwoarang | `12722` | `tk802/005` | 1 |
| Jack-8 | `12660` | `tk802/006` | 1 |
| Jin Kazama | `12695` | `tk802/225` | 2 |
| Kazuya Mishima | `12643` | `tk802/007` | 3 |
| King | `12698` | `tk802/008` | 3 |
| Lars Alexandersson | `12678` | `tk802/009` | 1 |
| Nina Williams | `12723` | `tk802/010` | 1 |
| Reina | `12691` | `tk802/011` | 1 |
| Sergei Dragunov | `12679` | `tk802/012` | 1 |
| Victor Chevalier | `12717` | `tk802/013` | 1 |
| Yoshimitsu | `12699` | `tk802/014` | 3 |

The 24 accepted products consist of 14 Alternate/Alternative Art products, five
Chrome Rares, and five Autograph Versions. Heihachi's exact qualifiers are:

```text
tcgplayer/12697-709938
tcgplayer/12697-711192
tcgplayer/12697-711197
```

The obsolete rejected qualifier `tcgplayer/3320-709938` belongs to the bad
legacy mapping and must never be restored.

## Relevant files

Extension workspace:

```text
docs/extension_alt_art_catalog.json
docs/extension_alt_art_catalog_report.md
docs/tcgplayer-alternate-art-audit.json
docs/tcgplayer-variant-import-audit.json
remote-card-art.js
scripts/audit-tcgplayer-alternates.py
scripts/import-tcgplayer-variants.py
scripts/build-remote-card-art.py
```

Review and TTS generation remain in the separate TTS workspace:

```text
C:\Users\tanne\OneDrive\Documents\TTS UVS\docs\alt_art_review_decisions.json
C:\Users\tanne\OneDrive\Documents\TTS UVS\docs\tcgplayer_tk802_character_review.json
C:\Users\tanne\OneDrive\Documents\TTS UVS\uvs_tts_card_updater\build_tcgplayer_set_character_review.py
C:\Users\tanne\OneDrive\Documents\TTS UVS\uvs_tts_card_updater\build_tts_qualified_catalog.py
```

The extension working tree was already dirty before this handoff. Preserve all
existing runtime, CSS, manifest, catalog, and script changes. Do not reset or
replace them wholesale.

## Rebuild commands

The current runtime allowlist was generated from this extension checkout with:

```powershell
python .\scripts\build-remote-card-art.py `
  .\docs\extension_alt_art_catalog.json `
  'C:\Users\tanne\OneDrive\Documents\git\uvs-tts-assets' `
  6348e7dc2270a800da0d475bee46a99430db7b8c
```

The exact extension package was built with:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass `
  -File .\scripts\build-release.ps1
```

Current package:

```text
release/plus-ultra-online-0.4.1.zip
SHA-256: b5d119d6781be29df64fd9bfa07ac7b93f2d1a537c2aba9b8f1af6eb410f9dea
```

The ZIP contains exactly the 12 files allowlisted by `build-release.ps1`, and
its `remote-card-art.js` matched the workspace source when verified.

## Verification completed

- All 24 TK802 selections exist in the reviewed JSON catalog.
- All 24 exist under the correct canonical IDs and source-neutral `repo`
  qualifiers in `remote-card-art.js`.
- All 24 source-neutral identities exist in the TTS qualified CardDB catalog.
- All 48 TK802 preview/micro raw GitHub URLs returned `200 image/jpeg` after
  the asset push.
- Bundled CardDB Lua, object Lua, and object-data `LuaScript` are identical.
- Python generator compilation passed.
- `git diff --check` passed apart from line-ending conversion warnings.
- All 678 packaged `repo` qualifiers and four packaged `bl01` qualifiers resolve
  through TTS CardDB, and all 19 transform variants retain paired backs.
- `TS_Save_24.json` matches the bundled CardDB and Global scripts.
- Node.js is not installed in this environment, so `node --check` was not
  available.

## Completion

- Extension `0.4.1` and TTS `3.15.1` compatibility are validated.
- Save 24 is synchronized to the source-neutral `repo` layout.
- The user approved and the TTS workspace created the full
  `mods_backup/uvs_tts/uvs_tts_3.15.1` snapshot after validation.

Do not commit or push the extension workspace without reviewing its full dirty
worktree. The asset repository commit above is already pushed; the extension
workspace changes are not committed by this handoff.
