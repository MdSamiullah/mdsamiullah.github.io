# Verification report — 16 November 2026

## Passed locally

`node --test tests/*.test.mjs`: **16 tests passed, 0 failed**.

Coverage:
- Imported content validation; all 168 original academic records retained.
- CSV BOM, Unicode, quoted commas, escaped quotes and multiline cells.
- Rejection of malformed CSV, inconsistent rows and duplicate headers.
- DOI, normalised-title, similar-title and supervision-name duplicate detection.
- Public projection excludes hidden records, recycle-bin entries and unknown top-level metadata.
- Rich text filtering, unsafe URL rejection, duplicate-ID validation and theme validation.
- Spreadsheet formula-prefix protection in CSV exports.
- Build materialization preserves source files, retains record counts and excludes admin/test code.
- Session encryption, expiration, tamper rejection and editor allowlist checks.
- Cross-origin write rejection, OAuth state rejection and PKCE generation.
- Mocked GitHub private draft saving, stale-version conflicts and approved publication.
- Refusal to save private drafts to a public repository.
- Upload path/extension validation and file-signature checks.
- Cache/security response headers and immediate allowlist enforcement.

Additional checks:
- Original YAML fields were compared against the imported JSON, not just counted: all five collections match exactly after removing the newly added ID/visibility metadata.
- Generated Jekyll configuration, data and page frontmatter parse successfully.
- JavaScript files pass Node syntax checks.
- Workflow YAML parses successfully.
- Original assets and main stylesheet are retained; changes to card markup preserve its existing classes. Actual visual equivalence remains unverified.

## Not completed here

- **Browser execution:** Chromium startup was attempted but blocked by the execution environment (`socket() failed: Operation not permitted`). The included Playwright test has NOT been executed successfully here.
- **Full Jekyll build:** Ruby/Jekyll is not installed in this environment. Materialization passed, but that is not a Jekyll build.
- **Live GitHub/Cloudflare integration:** no private repository, GitHub App or Worker has been created in the user's accounts. Live OAuth callbacks, permissions, free-tier CPU usage and deployment require setup and validation.
- **External services:** the Scholar fetch and page screenshot workflows were not executed against live services.

The package includes an Admin browser checks GitHub workflow and the updated Pages build workflow. Run both, then follow the first-sign-in acceptance checks in ADMIN_SETUP.md before treating this as production-verified. The test suite uses mocked GitHub requests; it does not imply that a real publication has succeeded.

## Scope limits

- Every existing content area is exposed, including the starter About/error/blog content. Arbitrary new page templates, custom HTML/CSS editing and a freeform drag-and-drop layout builder are not implemented.
- Rich text supports prose and tables; structured names, dates and URLs use regular form controls. Inline image embedding in prose is not provided.
- Preview is a content preview, not a pixel-exact rendering of the Jekyll website.
- Editor access is configured through GitHub collaborators and the Worker allowlist; separate reviewer roles are not implemented.
- Uploads are public immediately and limited to 500 KB; private media staging is not implemented.
- Revision restoration uses private JSON backups or GitHub file history; there is no in-panel commit-history browser.
- No automatic two-way BibTeX synchronisation; the old conversion step is skipped while managed content is active.
