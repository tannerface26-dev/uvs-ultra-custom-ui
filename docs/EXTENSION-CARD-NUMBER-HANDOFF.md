# UVS Ultra Extension: Card-Number-Qualified Forum Code Handoff

> **Historical implementation record.** The extension has been published and
> this handoff is retained for rationale and regression cases. For current
> behavior, use `CARD-IDENTITY-AND-ALTERNATE-ART.md` and the checked-in
> implementation. Do not treat planned wording below as authorization to change
> the published runtime.

## Goal

Change the Chrome extension's Forum Code output so a TTS import line identifies
the exact UVS Ultra image, including alternate images stored in the same set
directory.

The existing `setId + cardName` identity is insufficient for confirmed cases
where two images share a set directory. The new identity is:

```text
setId + cardNumber + normalized cardName
```

## New Output Format

Emit every card line as:

```text
{quantity} -{setId}/{cardNumber} {cardName}
```

Examples:

```text
1 -yyhdt/095 Walk The Dog
1 -bl01/005 Walk The Dog
1 -mha05/073 Nejire Hado
1 -repo/9958-3914 Nejire Hado
```

The slash is part of the format. It separates the UVS Ultra image directory
from the exact image filename stem.

Repository-hosted alternates use the same parser-compatible shape with a
reserved `repo` namespace:

```text
1 -repo/9958-3914 Nejire Hado
```

The second token combines canonical UVS Ultra card ID and official gallery ID.
The importer must resolve it through a packaged allowlist. It must not construct
a network URL from Forum Code input.

For shift or transform cards, one front-face qualifier may resolve to a paired
front and transformed-back image. For example, `repo/10964-2727` identifies
Eren Yeager, Promising Scout alternate `2727` and its paired Attack Titan,
Ferocious Challenger back `repo/10965-2799`. The importer must preserve both
allowlisted URLs for gameplay; the back face is not emitted as another deck
line.

## Value Source

For ordinary cards, derive both values from the actual same-origin image URL
rendered by UVS Ultra:

```text
/images/extensions/{setId}/{cardNumber}.jpg
```

The URL may include a query string. UVS Ultra may also render size variants:

```text
{cardNumber}-preview.jpg
{cardNumber}-mini.jpg
{cardNumber}-ci-micro.jpg
```

Strip the size suffix and `.jpg`, preserving the underlying filename stem and
its leading zeroes. Do not substitute the official collector number. UVS Ultra
image numbers and official collector numbers are not reliably interchangeable.

For an alternate selected from `card-art.js`, use the allowlisted variant's
`setId` and `cardNumber` directly. They must agree with its allowlisted
`imageUrl`.

## Validation

Accept only image paths that match the extension's strict same-origin shape.
Recommended token allowlists:

```text
setId:     [A-Za-z0-9_-]+
cardNumber:[A-Za-z0-9_-]+
```

Reject path traversal, percent-encoded separators, extra path segments,
periods, query data inside either token, and non-`uvsultra.online` image URLs.
Do not allow stored extension state or page text to inject an arbitrary image
URL.

## Alternate Selection Identity

Do not key an alternate choice by `setId` alone. Two variants can share one
set directory.

Use an immutable variant identity containing both values, for example:

```js
const variantKey = `${variant.setId}/${variant.cardNumber}`;
```

Keep the existing deck ID plus canonical numeric UVS Ultra card ID scope around
that variant key.

If old browser storage contains only a `setId`, migrate it only when exactly one
allowlisted variant for that card has that set ID. If multiple variants share
the set ID, fall back to the card's default variant rather than guessing.

## Reviewed False Positive

Canonical UVS Ultra card ID `11512`, U.S.S. Cerritos, NCC-75567, has no distinct
alternate art. Its five official-gallery records are explicitly excluded from
the runtime catalog and must not produce an art selector.

## Multiple-Alternate Test Case

Canonical UVS Ultra card ID `9958`, Nejire Hado, currently has two confirmed
repository variants: `repo/9958-3914` and `repo/9958-4788`. The Alternate Art
button must open a list containing both choices.

## Existing Alternate Regression Cases

The change must preserve the current selections for these canonical IDs:

```text
10509  Walk The Dog       yyhdt/095  bl01/005
10456  Paying the Cost    yyhdt/044  bl01/006
10554  Resting Up         yyhdt/143  bl01/007
10424  Weapon Clash       yyhdt/009  bl01/008
```

## TTS Compatibility Contract

### Current importer shape

The red and blue TTS importers use the same flow:

1. Scan Forum Code line by line while tracking the current deck section and
   whether entries belong to the sideboard.
2. Parse each card line into an internal entry containing `number` (quantity),
   `card` (complete displayed name), optional `setId`, section type, and
   sideboard state.
3. Ask the dedicated CardDB object to resolve that identity to an importer-owned
   card key.
4. Read the face URL and metadata from CardDB using that key.
5. Group spawn work by exact face URL and create the requested card quantity.

The importer does not turn untrusted Forum Code directly into a network URL.
The qualifiers select among URLs already present in CardDB. A qualified lookup
that is not found fails that card entry instead of silently falling back to a
different image with the same name.

The currently deployed qualified resolver indexes CardDB entries by:

```text
lowercase(setId) + newline + normalized base card name
```

It obtains `setId` from each known CardDB image URL. This cannot represent two
same-name images in the same directory because one lookup key overwrites the
other. The TTS-side follow-up will replace that lookup with an exact index using:

```text
lowercase(setId) + newline + exact cardNumber stem + newline + normalized base card name
```

The planned internal parsed-entry shape is therefore:

```text
{
  number = quantity,
  card = complete card name,
  setId = image directory or nil,
  cardNumber = image filename stem or nil,
  side = sideboard boolean,
  sectionType = parsed Forum Code section
}
```

For the new format, both `setId` and `cardNumber` will be passed to CardDB. The
name remains in the lookup so malformed output cannot select an unrelated card
merely by naming another known image path.

### Parser order

The TTS importer will parse the new format first:

```regex
^\s*(\d+)\s+-([A-Za-z0-9_-]+)/([A-Za-z0-9_-]+)\s+(.+?)\s*$
```

Capture groups are quantity, set ID, card number, and complete card name.

The importer will then try the current set-only format, followed by the legacy
name-only format. During migration, TTS will therefore continue accepting:

```text
{quantity} -{setId} {cardName}
{quantity} {cardName}
```

The extension should switch all generated card lines to the new format in one
change. BBCode headings and unrelated Forum Code content should remain
unchanged.

This ordering means the extension must not place whitespace around `/`, must
not omit leading zeroes, and must keep the complete card name after one or more
spaces. The card number is a string identity, not an integer.

## Acceptance Checks

1. Ordinary cards include the set directory and exact image filename stem.
2. Leading zeroes are retained.
3. Preview/mini/micro URLs produce the same full-image card number.
4. All four existing Borderlands alternate selectors still export correctly.
5. Cerritos has no alternate-art selector.
6. Nejire Hado displays both repository alternates in a nested list.
7. Selecting Original Art or a final alternate closes the action menu.
8. Reloading the deck preserves the selected exact variant.
9. An old unique set-only stored selection migrates without changing its art.
10. Ambiguous old set-only state falls back deterministically and does not guess.
11. Invalid or cross-origin image paths cannot enter Forum Code or selection
    storage.
12. Transforming alternate art updates both preview panes and its front
    qualifier resolves to both allowlisted face URLs.

## Return Handoff

When complete, report:

- The final emitted syntax.
- Files changed.
- How ordinary image URLs are parsed.
- The new stored variant-key shape and migration behavior.
- Test results for Walk The Dog, Nejire Hado, and the Cerritos exclusion.
