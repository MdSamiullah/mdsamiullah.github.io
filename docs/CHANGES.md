# Changes in this package

## Added

- Standalone Cloudflare Worker admin with GitHub App sign-in, encrypted secure cookies, PKCE, CSRF/origin protection and an editor allowlist.
- Private draft saving and explicit publication to the public homepage repository, with concurrent-edit checks.
- Form editing for profile, navigation, page text, home cards, CV controls, labels, colours, citations and all five academic collections.
- Rich text descriptions/page bodies, with headings, lists, links, tables, paste filtering and formatting controls.
- CSV mapping, validation and preview; possible duplicates start unchecked.
- Duplicate comparison and field-by-field merge; reorder, visibility, deletion and recycle-bin restoration.
- Public media upload, JSON backup/restore and content preview.
- Production content materializer, automated logic/integration checks, browser-check workflow, setup guide and verification report.

## Preserved

All original fields in 39 publications, 44 supervision records, 31 teaching records, 31 certificates and 23 portfolio entries were retained. The six home cards remain. Original images, CV PDF, icons and main SCSS remain unchanged. Existing page URLs, card classes, page search, publication year sorting, citation chart and CV iframe remain in use.

## Behaviour changes to understand

- Approved `_data/managed.json` becomes the authoritative content source. The build generates a separate `_cms_build` staging folder without rewriting source files.
- Four Markdown pages become HTML templates to support rich prose; remove the old filenames when applying the package to an existing checkout.
- Existing card descriptions use div wrappers so paragraphs, lists and tables produce valid container markup.
- The original BibTeX conversion is skipped while managed content is active, preventing admin publication data from being overwritten.
- Scholar updates use the configured profile ID and respect manual citation mode. Completion of the Scholar workflow can trigger a Pages deployment.
- Existing missing `page`/`post` layout references in About, error and starter blog content now use the existing default layout.
- Three original publication records with year 0 display under an editable Undated label.
- A generated CSS supplement supports rich text and constrains the profile image width; the main stylesheet is untouched.

## Source files modified

- `.github/workflows/bib2yml.yml`
- `.github/workflows/jekyll-gh-pages.yml`
- `.gitignore`
- `404.html`
- `README.md`
- `_includes/cards-from-data.html`
- `_includes/cards-search.html`
- `_includes/sidebar.html`
- `_layouts/default.html`
- `_posts/2026-02-10-welcome-to-jekyll.markdown`
- `certificates/index.html`
- `mentoring/index.html`
- `portfolio/index.html`
- `scripts/FetchScholarlyCitations.py`
- `teaching/index.html`

## Replaced filenames

- `index.markdown` → `index.html`
- `about.markdown` → `about.html`
- `publications/index.md` → `publications/index.html`
- `cv/index.md` → `cv/index.html`

## Main new files

- `admin-app/worker.mjs`
- `admin-app/wrangler.toml`
- `admin-app/public/index.html`
- `admin-app/public/app.mjs`
- `admin-app/public/core.mjs`
- `admin-app/public/style.css`
- `_data/managed.json`
- `scripts/base-config.json`
- `scripts/materialize-content.mjs`
- `assets/css/managed.css`
- `tests/`
- `.github/workflows/admin-checks.yml`
- `docs/ADMIN_SETUP.md`
- `docs/TEST_REPORT.md`
