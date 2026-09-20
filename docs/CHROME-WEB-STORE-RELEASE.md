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

Publish `docs/PRIVACY.md` at a stable public HTTPS URL and enter that URL in the
Privacy practices tab. Keep the dashboard answers consistent with the policy.

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

1. Add and declare the icon set.
2. Host the privacy policy and support page on public HTTPS URLs.
3. Test search, theme persistence, deck sorting, forum code, alternate art, and
   transform backs in a clean Chrome profile.
4. Confirm every remote image URL is HTTPS, commit-pinned, and allowlisted.
5. Create the ZIP from the runtime allowlist above and load that exact package
   unpacked for one final smoke test.
6. Complete Store Listing, Privacy practices, Distribution, and test
   instructions before submitting for review.
