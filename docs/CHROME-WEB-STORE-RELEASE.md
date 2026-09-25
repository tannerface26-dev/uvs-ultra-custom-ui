# +Ultra Online Chrome Web Store Release

## Published baseline protection

The extension is already published. Running verification or updating release
documentation must not alter the extension runtime, generated catalog,
`manifest.json` version, or Chrome Web Store listing.

Only prepare a new runtime package when the user explicitly requests a release or
runtime change. Build output is reproducible and ignored by Git; building the ZIP
does not itself publish or update the extension.

For agent-driven release work:

1. Read the root `AGENTS.md`, `AI-CONTROLS.md`, and `lessons.md`.
2. Confirm the task explicitly permits runtime changes.
3. Review every runtime diff and verify backward compatibility.
4. Run `scripts/build-release.ps1`; it packages only its explicit allowlist and
   rejects missing or unexpected archive entries.
5. Extract and smoke-test the exact generated ZIP in an isolated browser profile.
6. Stop before Chrome Web Store upload or submission unless that external action
   was explicitly requested.
7. After any requested external update, read back the Store state before
   reporting success.

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
