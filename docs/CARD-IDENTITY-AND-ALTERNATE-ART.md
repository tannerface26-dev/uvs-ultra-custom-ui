# Card Identity and Alternate-Art Architecture

## Status

This document describes the current extension contract. It supersedes the
implementation plans in the `EXTENSION-*-HANDOFF.md` files when those plans differ
from the checked-in implementation.

The extension is already published. Changes to this contract require explicit
approval, compatibility review, and testing of the exact release package.

## Sources of truth

Use these in order when verifying behavior:

1. The checked-in implementation: `card-art.js`, `deck-card-art.js`, and
   `deck-custom.js`.
2. The generated packaged allowlist: `remote-card-art.js`.
3. The generator: `scripts/build-remote-card-art.py`.
4. The reviewed catalog inputs and runtime manifest used by the generator.
5. Historical handoff documents, which provide rationale and regression cases but
   may describe an earlier plan.

`remote-card-art.js` is generated data and must not be edited by hand.

## Canonical card identity

A deck row is anchored by UVS Ultra's numeric canonical card ID. Ordinary rendered
image identity is read from the actual same-origin image URL:

```text
/images/extensions/{setId}/{cardNumber}.jpg
/images/extensions/{setId}/{cardNumber}-preview.jpg
/images/extensions/{setId}/{cardNumber}-mini.jpg
/images/extensions/{setId}/{cardNumber}-ci-micro.jpg
```

`setId` and `cardNumber` are validated path segments. `cardNumber` remains a string
because leading zeroes are significant. Size suffixes are removed before Forum
Code is generated.

Card names are display and validation data, not unique identity. Duplicate names
are matched in deck order rather than collapsed into one record.

## Forum Code contract

The extension emits qualified card lines as:

```text
{quantity} -{setId}/{cardNumber} {complete card name}
```

For an ordinary image, the qualifier is its validated UVS Ultra image directory
and filename stem. For a selected alternate, `forumQualifier` from the packaged
allowlist takes precedence.

The qualifier grammar is:

```regex
^[A-Za-z0-9_-]+/[A-Za-z0-9_-]+$
```

The namespace is data-driven. Current generated data may use namespaces such as
`repo`, `tcgplayer`, or an Ultra-hosted set ID. Consumers must resolve the complete
qualifier through importer-owned allowlisted data. They must not interpolate
untrusted Forum Code into a network URL.

TTS/importer behavior and compatibility parsing are described in
`TTS-IMPORTER-EXTENSION-HANDOFF.md`.

## Reviewed alternate relationships

The extension offers alternate art only when variants are nested under the exact
canonical card ID in the packaged reviewed catalog. It does not infer an
alternate relationship from names, collector numbers, sets, image similarity, or
live-page scraping.

The detailed review criteria and negative cases are in
`EXTENSION-ALT-ART-MATCHING-RULES.md`.

Every card entry begins with an explicit `original` variant. Alternate records use
a stable `artworkId` and may contain:

- `forumQualifier` for exported identity;
- `legacyQualifiers` for safe storage migration;
- commit-pinned preview and micro image URLs; and
- a paired `transformBack` record.

## Selection storage and migration

Artwork selections are stored in local storage under `uvsu-card-art-v1`. The
selection scope is:

```text
{deckId}:{canonicalCardId}
```

The stored value is the selected variant's exact `artworkId`.

Legacy values are accepted only when they resolve to exactly one allowlisted
variant by exact set/card identity, known legacy qualifier, or legacy set ID. An
ambiguous or unknown legacy value is not guessed; selection returns to the first
variant, which is the explicit Original record.

Page-provided values and local storage cannot provide arbitrary image URLs. A
selection must match an existing packaged variant before it is persisted or used.

## Remote artwork security boundary

Remote artwork is limited to non-executable images under a commit-pinned path in
the project-owned `uvs-tts-assets` repository on
`https://raw.githubusercontent.com`.

At assignment time, `card-art.js` requires:

- the expected HTTPS origin;
- a full 40-character pinned Git revision;
- the exact repository and `alternate-art/` path prefix;
- no username or password;
- no query string; and
- no fragment.

`deck-card-art.js` sets `referrerPolicy` to `no-referrer` before assigning an image
source. The extension uses generated preview and micro derivatives rather than
full-resolution remote artwork in deck UI slots.

The extension does not fetch a remote manifest or executable code at runtime.

## Transform and shift cards

A selected front variant may include one nested `transformBack`. Preview behavior
updates both front and back panes while keeping the front image as the deck-row
thumbnail.

One front Forum Code qualifier represents the selected pair. The transformed back
is not emitted as a second deck line. Importers must retrieve the paired back from
their own allowlisted record for that front qualifier.

## Catalog update procedure

Catalog updates are build-time operations, not runtime discovery:

1. Regenerate or obtain the reviewed extension catalog.
2. Prepare missing preview and micro assets in the separate assets repository.
3. Commit those assets.
4. Run `scripts/build-remote-card-art.py` against the reviewed full asset commit.
5. Review generated counts, qualifier uniqueness, source paths, and transform
   pairs.
6. Test ordinary, alternate, multiple-alternate, mismatch, unknown, and transform
   cases.
7. Build and smoke-test the exact release ZIP.

The generator rejects malformed qualifiers, duplicate identities, missing source
files, paths outside the assets checkout, unexpected catalog counts, and asset
files absent from the pinned revision.

## Compatibility requirements

Do not intentionally change these without explicit approval:

- Existing stored `artworkId` values continue to resolve.
- Unique legacy selections continue to migrate.
- Ambiguous legacy selections fail closed to Original.
- Existing Forum Code qualifiers remain importer-resolvable.
- Ordinary card identities preserve exact filename stems and leading zeroes.
- Unknown or mismatched qualified identities never fall back silently to another
  printing.
- Transform alternates retain their paired back image.
- No new permission, remote-code path, or undisclosed data flow is introduced.

## Historical documents

These files remain at their existing paths to preserve references:

- `EXTENSION-CARD-NUMBER-HANDOFF.md`
- `EXTENSION-VALIDATED-ALT-ART-HANDOFF.md`
- `TTS-IMPORTER-EXTENSION-HANDOFF.md`

They are useful for rationale, examples, and regression cases. Treat this document
and the checked-in implementation as authoritative for current extension behavior.