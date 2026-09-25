# AI Controls

These instructions apply to all AI-assisted work on this project.

The root `AGENTS.md` is the automatically loaded, concise agent policy. This
document remains the detailed security reference. If the two differ, preserve
the stricter security requirement and update both documents so they do not drift.

Because the extension is already published, documentation-only or planning work
must not modify runtime package files, the extension version, generated runtime
catalog data, or the release allowlist.

## Primary Requirement

Security is the highest priority. This extension is intended for publication in
the Chrome Web Store. Prefer the smallest possible permissions, execution scope,
and attack surface over convenience.

## Required Practices

- Preserve Manifest V3 compatibility.
- Restrict the extension to `https://uvsultra.online/*`.
- Do not add HTTP support or permit insecure resource URLs.
- Request no Chrome permission or host permission unless the feature cannot be
  implemented without it. Document the reason and security impact first.
- Do not add remote scripts, dynamic code execution, `eval`, `Function`, or
  fetched executable code.
- Do not inject untrusted HTML with `innerHTML`, `outerHTML`,
  `insertAdjacentHTML`, or `document.write`.
- Use `textContent`, DOM construction methods, and explicit allowlists for data
  originating from the page.
- Validate URLs immediately before assigning them to resource or navigation
  properties. Allow HTTPS only and narrow hosts when practical.
- Do not collect, store, transmit, or log user data unless explicitly required.
  Document the purpose, retention, and disclosure behavior before implementing
  any such feature.
- Do not add analytics, tracking, remote configuration, or third-party network
  calls without explicit approval.
- Treat the host page DOM as untrusted input, even though the script runs only
  on the intended site.
- Keep dependencies to a minimum. Review any dependency before adding it and
  avoid dependencies for functionality that can be implemented clearly with
  browser APIs.
- Preserve site behavior and accessibility when moving or wrapping existing DOM
  controls.

## Change Checklist

Before considering a change complete:

1. Review manifest scope and permissions.
2. Search for unsafe HTML, dynamic-code, URL, storage, and network sinks.
3. Validate all page-derived values before using them in sensitive sinks.
4. Test the extension on the HTTPS site with expected and malformed page data.
5. Confirm there are no remote-code or undisclosed-data behaviors prohibited by
   Chrome Web Store policy.
6. Record reusable discoveries in `docs/lessons.md`.

## Review Expectations

Security findings must be reported before style or maintainability concerns.
Do not silently weaken a security check. If a requested feature conflicts with
these controls or Chrome Web Store requirements, stop and explain the conflict
before implementation.
