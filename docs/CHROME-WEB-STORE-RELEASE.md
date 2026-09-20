# +Ultra Online Chrome Web Store Release

## Store identity

- Name: `+Ultra Online`
- Positioning: unofficial companion for UVS Ultra
- Suggested category: Tools
- Suggested single purpose: Improve the UVS Ultra browsing and deck-building
  experience with accessible themes, reorganized search controls, deck export
  helpers, and validated alternate card artwork.

Do not imply that +Ultra Online is produced, authorized, or endorsed by UVS Games or
the UVS Ultra website unless written authorization exists. Use original icon
and promotional artwork rather than official logos or card art.

## Privacy declarations

- Remote code: No. All executable logic is bundled in the extension.
- Permissions: No named Chrome API permissions are requested.
- Site access: Restricted to `https://uvsultra.online/*`; required to enhance
  the site's search and deck pages.
- Data handling: Disclose local processing of website/deck content and local
  storage of theme and artwork preferences.
- Network behavior: Disclose commit-pinned alternate-art image requests to
  `raw.githubusercontent.com`. No referrer is sent.
- Analytics, advertising, and tracking: None.

Published privacy policy:
`https://tannerface26-dev.github.io/uvs-ultra-custom-ui/PRIVACY.html`

Published support page:
`https://tannerface26-dev.github.io/uvs-ultra-custom-ui/SUPPORT.html`

Enter those URLs in the Store Listing and Privacy practices tabs. Keep the
dashboard answers consistent with the published policy.

## Required assets

- Original PNG icons declared in the manifest at 16, 32, 48, and 128 pixels.
- A 128x128 store icon.
- At least one accurate 1280x800 screenshot.
- A 440x280 small promotional tile.
- A 1400x560 marquee tile is optional.

Screenshots and descriptions must show the current product accurately and must
not expose private deck or account information.

## Release package

Package only runtime files and declared icon assets:

- `manifest.json`
- `ultra-custom.css`
- `ultra-custom.js`
- `deck-custom.css`
- `deck-custom.js`
- `remote-card-art.js`
- `card-art.js`
- `deck-card-art.js`
- declared PNG icons

Keep `docs`, `scripts`, editor workspaces, caches, and source catalogs out of
the uploaded ZIP. Place `manifest.json` at the ZIP root.

## Final checks

1. [x] Add and declare the icon set.
2. [x] Host the privacy policy and support page on public HTTPS URLs.
3. [x] Test search, theme persistence, deck sorting, forum code, and the
   bundled alternate-art runtime in an isolated browser profile.
4. [x] Confirm every remote image URL is HTTPS, commit-pinned, and allowlisted.
5. [x] Create the ZIP from the runtime allowlist and load that exact extracted
   package for a final smoke test.
6. [ ] Complete Store Listing, Privacy practices, Distribution, and optional
   test instructions before submitting for review.
