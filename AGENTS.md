# +Ultra Online Agent Guide

## Published-extension stability

+Ultra Online is already published. Preserve the behavior and package contents of
the published extension unless the user explicitly requests a runtime change.

For documentation, planning, or agent-integration work:

- Do not edit `manifest.json`, runtime JavaScript, runtime CSS, or packaged icons.
- Do not regenerate `remote-card-art.js`.
- Do not change the runtime allowlist in `scripts/build-release.ps1`.
- Do not change the extension version.
- Keep existing documentation URLs and file paths working; prefer status notices
  and replacement links over moving or deleting historical files.
- Before completion, verify that no runtime file changed with `git diff --` and
  the runtime-file list below.

Runtime package files:

```text
manifest.json
ultra-custom.css
ultra-custom.js
deck-custom.css
deck-custom.js
remote-card-art.js
card-art.js
deck-card-art.js
assets/icons/icon-16.png
assets/icons/icon-32.png
assets/icons/icon-48.png
assets/icons/icon-128.png
```

If a runtime change is explicitly requested, make the smallest compatible change,
preserve stored user selections and Forum Code compatibility, and test the exact
release package rather than only the working tree.

## Security requirements

Security and Chrome Web Store compliance take priority over convenience.

- Preserve Manifest V3 compatibility.
- Restrict execution to `https://uvsultra.online/*` and the narrower existing
  deck-page match where applicable.
- Request no new Chrome permission or host permission without first documenting
  why the feature cannot work without it and obtaining explicit approval.
- Do not add remote scripts, fetched executable code, `eval`, `Function`, or other
  dynamic-code execution.
- Treat the host page DOM, URLs, attributes, text, and stored browser values as
  untrusted input.
- Build UI with `textContent` and DOM construction. Do not inject untrusted HTML
  through `innerHTML`, `outerHTML`, `insertAdjacentHTML`, or `document.write`.
- Validate URLs immediately before use. Require HTTPS and narrow origins and paths
  to the smallest practical allowlist.
- Do not add analytics, tracking, remote configuration, logging of user content,
  or third-party network calls without explicit approval and corresponding public
  disclosure.
- Keep dependencies and execution scope minimal.
- Preserve site behavior and accessibility when moving or wrapping existing
  controls.

Detailed controls and accumulated findings remain in:

- `docs/AI-CONTROLS.md`
- `docs/lessons.md`

## Context routing

Read the relevant document before changing the associated behavior:

| Work area | Required context |
|---|---|
| Card identity, Forum Code, alternate-art selection, transforms, or catalog generation | `docs/CARD-IDENTITY-AND-ALTERNATE-ART.md` and `docs/EXTENSION-ALT-ART-MATCHING-RULES.md` |
| TTS/importer compatibility | `docs/TTS-IMPORTER-EXTENSION-HANDOFF.md` |
| Chrome Web Store packaging or release | `docs/CHROME-WEB-STORE-RELEASE.md` |
| Privacy, storage, or network behavior | `docs/PRIVACY.md`, `docs/SUPPORT.md`, and `docs/THIRD_PARTY_NOTICES.md` |
| Any runtime implementation change | Relevant source files plus `docs/lessons.md` |

The files containing `HANDOFF` in their names are historical implementation
records. Use them for rationale and regression cases, not as the primary statement
of current extension behavior. The current contract is
`docs/CARD-IDENTITY-AND-ALTERNATE-ART.md` and the implementation itself.

## Current implementation boundaries

- `ultra-custom.js` and `ultra-custom.css` affect the general UVS Ultra site.
- `deck-custom.js` and `deck-custom.css` contain deck-page behavior.
- `card-art.js` validates and manages artwork choices and local persistence.
- `deck-card-art.js` connects validated choices to deck rows and previews.
- `remote-card-art.js` is generated allowlist data; do not edit it manually.
- `scripts/build-remote-card-art.py` generates the remote-art allowlist.
- `scripts/build-release.ps1` packages only the explicit runtime allowlist and
  verifies the archive entries.

Do not infer current behavior solely from generated reports or old handoffs. Trace
symbols to their definitions and usages before editing.

## Verification

For documentation-only changes:

1. Check all added or changed Markdown links and referenced paths.
2. Run `git diff --check`.
3. Confirm the runtime package files listed above have no diff.
4. Confirm `manifest.json` is unchanged and still parses as JSON.

For an explicitly requested runtime change, additionally:

1. Review manifest matches and permissions.
2. Search modified code for unsafe HTML, dynamic-code, URL, storage, and network
   sinks.
3. Validate page-derived and stored values before sensitive use.
4. Exercise expected and malformed input paths.
5. Run available syntax/tests and record any tooling that is unavailable.
6. Build the release ZIP with `scripts/build-release.ps1`.
7. Inspect and smoke-test the exact extracted ZIP before release.
8. Record durable discoveries in `docs/lessons.md`.

Never report the published extension or Store listing as changed unless that exact
external state was deliberately changed and verified.