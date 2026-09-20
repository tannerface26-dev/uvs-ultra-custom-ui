# Extension Alternate-Art Identity Rules

## Core Rule

The extension must never infer an alternate-art relationship from a matching
card name, set, collector number, rarity label, or similar-looking artwork.

Only variants explicitly present under the same canonical card entry in the
reviewed runtime catalog may appear in the alternate-art selector:

```text
uvs-tts-assets/alternate-art/runtime/manifest.json
```

If a relationship is absent or ambiguous, the extension must show no alternate
choice. It must not construct a candidate dynamically.

## Required Functional Fingerprint

During catalog generation or review, two printings may be grouped as alternate
art only when their gameplay identity agrees on every applicable field:

```text
canonical UVS Ultra card ID
card type
difficulty
control
block zone
block modifier
resource symbols
keywords and keyword values
deckbuilding or character restrictions
complete rules/ability text
attack speed, damage, and zone
character hand size and vitality
any other printed gameplay stat
front/back or transform relationship
```

The canonical UVS Ultra card ID is the preferred identity anchor. A shared ID
does not excuse a mechanics mismatch, and different IDs are separate cards by
default unless a reviewed record explicitly proves an intentional reprint or
alternate relationship.

## Classification Outcomes

Use one of these outcomes during catalog review:

```text
confirmed_alternate
    Same gameplay identity; different artwork or frame treatment.

functionally_distinct
    Any gameplay field differs. Keep as a separate card.

manual_errata_review
    Differences may be official errata, templating, or terminology updates.

insufficient_data
    One or more required gameplay fields are unavailable or unreadable.
```

Only `confirmed_alternate` records may be emitted into the extension runtime
catalog. `manual_errata_review` and `insufficient_data` fail closed until a
human review resolves them.

## Text Normalization Limits

Normalization may ignore only presentation differences that cannot change game
behavior:

- Leading/trailing whitespace.
- Repeated internal whitespace.
- Line wrapping.
- Case differences where card text is not case-sensitive.
- Unicode punctuation equivalents such as straight versus curly apostrophes.

Do not remove or normalize away numbers, signs, resource symbols, zones,
keywords, costs, timing words, restrictions, card types, or stat values.

Terminology changes such as `Destroy` versus `Sacrifice` require
`manual_errata_review`; they are not automatically equivalent.

## Same-Name Negative Test: Shishi-Oh

These are separate cards, not alternate art:

```text
UVS ID 7355
Name: Shishi-Oh
Image identity: soulcalibur6/039
Difficulty/control: 2/5
Keywords: Breaker: 1, Unique, Weapon
Rules: Stun/Weapon attack abilities

UVS ID 103
Name: Shishi-Oh ·
Image identity: scqos/004
Difficulty/control: 2/4
Keywords/restriction: Mitsurugi Only, Unique, Weapon
Rules: Different enhance abilities
```

They differ in canonical ID, control, block information, restriction, rules
text, symbols, and other printed gameplay details. A fuzzy or punctuation-free
name match must not group them.

## Extension Runtime Behavior

The extension should:

1. Identify the deck row's canonical numeric UVS Ultra card ID.
2. Look up that exact ID in the reviewed runtime catalog.
3. Require the normalized displayed name to match the catalog card name.
4. Offer only the variants nested under that exact catalog card entry.
5. Store the exact variant qualifier, not a name-derived or set-only value.
6. Emit the selected allowlisted qualifier in Forum Code.
7. Fall back to the rendered ordinary image identity when no reviewed catalog
   entry exists.

The extension should not compare rules text from the live page, scrape nearby
same-name cards, or merge catalog entries at runtime. Identity review belongs in
the catalog-generation process so every user receives the same approved result.

## Required Regression Checks

```text
Walk The Dog
    Reviewed variants are offered for canonical ID 10509.

Nejire Hado
    Both reviewed repo variants are offered under canonical ID 9958.

Shishi-Oh / Shishi-Oh ·
    No cross-card alternate choice is offered between IDs 7355 and 103.

Unknown same-name card
    No alternate is inferred without an exact reviewed catalog entry.

Name mismatch for a known canonical ID
    Catalog variants are not offered; fail closed and retain ordinary art.
```
