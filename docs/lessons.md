# Project Lessons

Keep short, reusable lessons here as the extension evolves. Include enough
context to prevent the same issue from returning.

The root `AGENTS.md` contains the small set of rules that agents must receive in
every session. This file is the detailed project knowledge base: consult the
relevant section before changing runtime behavior, and promote only broadly
applicable, stable rules into `AGENTS.md`.

Current card-identity and alternate-art behavior is summarized in
`CARD-IDENTITY-AND-ALTERNATE-ART.md`. Files with `HANDOFF` in their names are
historical implementation records rather than the primary current contract.

## Security

- Chrome Web Store release packages should use an explicit runtime-file
  allowlist. Do not upload source catalogs, build scripts, editor workspaces,
  caches, or handoff documents with the extension.
- Remote alternate-art files are non-executable image resources. Keep every URL
  HTTPS, commit-pinned, path-allowlisted, and `no-referrer`; disclose the GitHub
  image request in the public privacy policy.
- UVS Ultra pages are HTTPS-only. The manifest must match only
  `https://uvsultra.online/*`, and resource URL validation must reject HTTP.
- The host page DOM is untrusted input. Prefer `textContent`, existing DOM nodes,
  and explicit validation instead of parsing or injecting markup.
- The extension currently needs no Chrome permissions, background worker,
  remote scripts, or direct API requests. Preserve that minimal security
  surface unless a documented feature requirement changes it. Approved
  alternate art may load as an HTTPS image from the project-owned GitHub repo.
- Preview image URLs are derived from the page and must remain restricted to the
  `https:` protocol before assignment to `img.src`.
- Chrome Web Store publication is a project requirement. Every feature should be
  reviewed for least privilege, remote-code restrictions, and data disclosure.
- Remote alternate art must be a packaged allowlist, pinned to a full Git commit,
  and restricted at assignment time to the exact project-owned raw GitHub path.
  Never fetch executable code or use a remotely mutable manifest at runtime.
- Set `referrerPolicy` to `no-referrer` before assigning repository-hosted card
  images so private deck URLs and deck tokens are not disclosed to the host.
- Do not reuse full-size repository art in Ultra's preview and deck-row image
  slots. Generate `358x500` preview and `20x20` micro JPEGs and select the URL
  that matches the requested display size; intrinsic dimensions otherwise
  disrupt the deck layout.

## Code Maintenance

- Deck-page features should use separate `deck-custom.js` and `deck-custom.css`
  files with a `deck.php` manifest match so their behavior stays isolated.
- In this project, `index.php` is the main card-search page and `deck.php` is the
  deckbuilder page. Alternate-art controls belong to each card's action menu on
  `deck.php`, and preferences should be scoped by numeric deck ID plus canonical
  card ID.
- The deck page's Forum Code control originally uses an inline jQuery handler to
  toggle and select `#code_forum`. Extension enhancements should replace only
  that interaction and preserve the site's generated code as read-only text.
- Forum-code card names are not unique. Preserve exact image identity by deriving
  set ID and card number from the same-origin image path and exporting card lines
  as `{quantity} -{setId}/{cardNumber} {cardName}`. Preserve leading zeroes and
  match duplicate names in deck order rather than collapsing them by name.
- UVS Ultra search results use `DISTINCT frontid`, so a one-result name search
  does not prove that only one image or printing exists. For example, "Walk The
  Dog" has the canonical `yyhdt/095` image and alternate art at `bl01/005`.
  Image-sensitive features must use the actual rendered image path when it is
  available instead of inferring identity from the card name or search count.
- UVS Ultra's deck action request stores only canonical `id_card`; it has no art
  parameter. Alternate-art choices therefore need an extension-owned,
  allowlisted mapping keyed by canonical card ID. Store only the selected variant
  key, validate it against that mapping, and let the deck exporter resolve it.
- Repository-hosted art uses `repo/{uvsUltraCardId}-{officialGalleryId}` as its
  Forum Code identity. The TTS importer must resolve this token through its own
  allowlisted catalog; it must never convert untrusted Forum Code into a URL.
- Public alternate-art identity must be source-neutral. Use
  `repo/{uvsUltraCardId}-{assetId}` for every repository-hosted alternate,
  regardless of where it was discovered; retain third-party attribution only in
  build-time provenance and audit records. Migrate a prior stored namespace by
  its validated token only when it resolves to exactly one allowlisted variant.
- Official-gallery names can be mapped automatically only when they have one
  exact normalized CardDB match. Keep missing and ambiguous records out of the
  runtime catalog until reviewed.
- Exact names are still insufficient when the game-card types differ. Gallery
  character art must match a CardDB Character row; Yoshimitsu is a confirmed
  false positive where the gallery card is a Character and Ultra ID `4587` is
  an Asset.
- A gallery classification is not proof that an image is visually distinct.
  Keep reviewed false positives in an explicit exclusion list; Cerritos is a
  confirmed example whose gallery images are not alternate art.
- Every generated alternate-art entry must include an explicit canonical
  Original variant. Otherwise default selection can silently replace ordinary
  deck art with the first alternate.
- When official-gallery and marketplace records show the same artwork, merge
  their provenance into one variant and retain every prior qualifier as a
  legacy alias. Different source crops or resolutions are not distinct art.
- Marketplace alternate-art audits must paginate the complete, stably sorted
  result set. TCGplayer's best-match ordering can repeat products between pages;
  its alphabetic product-name sort produced the complete unique inventory.
- Parenthetical labels such as Alternate Art, Alternative Art, Full Art Promo,
  Wedding Promo, and monthly LGS Promo are discovery hints, not identity proof.
  Promote them only when the marketplace variant and a canonical printing have
  identical complete mechanics fingerprints and the canonical set/card identity
  maps unambiguously to Ultra.
- Set-specific treatments such as Chrome Rare and Autograph Version also require
  explicit discovery and review; a scanner limited to `Alternate Art` labels can
  silently omit valid variants.
- When same-name cards exist across eras, generate review identities from the
  active CardDB used by the table. A stale JSON export can map a new set variant
  to an older card with the same base name, as happened with TK802 Heihachi and
  legacy UVS ID `3320`.
- TCGplayer transform products use the primary CDN image for the front and
  `{productId}_1_in_1000x1000.jpg` for the back. Require both images and both
  Ultra identities before exposing a transform alternate.
- Art-selector hover is a temporary preview only. Original, Alternate, and
  nested alternate choices should update the large preview on hover, restore
  the saved selection when the pointer leaves, and persist only on click.
- Shift and transform cards use two separate Ultra preview panes. Alternate-art
  records must pair front and transformed-back images; update both panes on
  hover and selection, keep only the front as the deck thumbnail, and expose
  both URLs to the TTS importer under one front-face qualifier.
- Compile or syntax-check catalog generators before accepting their output, then
  validate generated qualifier uniqueness and source-file existence. Escaping
  bugs at parser boundaries should fail before any catalog is written.
- Duplicate function declarations in the same scope are silently overridden due
  to JavaScript hoisting. Search for duplicate declarations during cleanup and
  review.
- When code is removed, also remove configuration variables and comments that
  only described the removed behavior.
- Preview positioning depends on page layout and dynamic result updates. Changes
  in this area should be tested after initial load, result updates, scrolling,
  resizing, and responsive layout changes.
- Search-result card actions open in the site's `#cluetip` element. Its stacking
  level must remain above the hover and locked card previews so the controls stay
  clickable.
- Full card details opened from a search result load into Colorbox's
  `#cboxLoadedContent`. In dark mode, give that container the same diagonal
  black-on-charcoal background as search-result cards and explicitly use white
  text and links; leave the site's normal light-mode panel unchanged.
- Card and deck action confirmations use a fixed Messenger list with the classes
  `messenger-on-top messenger-on-right`. Reposition that container with scoped
  CSS rather than replacing the site's notification behavior.
- The search page does not preload `.listing_deck`. Its native current-deck
  refresh path writes `onthefly.php` into `#onthefly` after card quantities or
  the selected deck change. A floating deck view should provide that hidden
  bridge, validate and render a separate visible list, and keep alternate-art
  menus isolated to `deck.php`.
- Resolve the initial search-page deck token from the authenticated flat deck
  list by exact displayed deck name, require one unambiguous same-origin HTTPS
  `deck.php` match, and cache the validated name/token pair across page reloads.
  Revalidate site-driven `onthefly.php` updates before replacing that cache.
- Dynamic modal contrast rules should target deck and folder name links by
  their stable `.avatar-deck-info` and `.avatar-folder-info` containers. This
  also covers names inserted after deck or folder creation without recoloring
  the surrounding controls.

## Verification

- This workspace may not have Node.js available. Record when JavaScript syntax or
  automated tests could not be run, and use a browser-based extension test before
  release.
- Validate `manifest.json` after every manifest edit.
