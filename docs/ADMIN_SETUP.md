# Homepage admin: setup and everyday guide

## What you will have

Your public homepage keeps its existing Jekyll layout, cards, page search, publication list, citation chart, CV iframe, images and URLs. A separate private-access admin website lets you edit the content without writing Markdown, YAML or scripts.

The admin stores text drafts in a **private** repository. Publishing writes only visible records and page content to the **public** site repository, which rebuilds the homepage. Hidden records and the recycle bin are excluded. Published information is public, including in Git history after deletion; a private draft repository cannot make information already published private again.

The initial editor is `mdsamiullah`. Additional editors can be added later. The setup below is a one-time technical step; everyday changes use forms and rich text.

## Free hosting choices

Use GitHub Free and Cloudflare Workers Free, with the included `workers.dev` address. Do not select Workers Paid, buy a domain, or enable paid add-ons. The private repository does not run Actions; builds run in the existing public repository. No external CMS subscriptions are used.

Cloudflare currently allows 100,000 Worker requests per day and 10 ms CPU per request on its free plan; limits apply. If limits are reached, requests may fail rather than the setup upgrading itself. This is designed for an occasional personal-site editor, not a high-volume CMS. Keep the content below 800 KB and imports below 1,000 rows/500 KB. File uploads are capped at 500 KB. No design can promise third-party free plans will remain unchanged forever.

Official references:
- https://developers.cloudflare.com/workers/platform/limits/
- https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/
- https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages
- https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app

## 1. Back up and apply the updated source

The starting archive was GitHub commit `653fd8fb8ba223f4c73d36e02c0896acc844f2ae`, dated 4 October 2026. If your actual repository has newer changes, compare them before replacing files; this package cannot preserve changes that were absent from the supplied archive.

In your local repository, first commit your current work, then create a branch:

```sh
git status
git add -A
git commit -m "Back up homepage before admin integration"
git switch -c feature/homepage-admin
```

If there is nothing to commit, skip that commit. Copy this package's contents into your existing checkout. Preserve the checkout's `.git` directory. Include the `.github` folder and `.gitignore` from this package.

Four source pages were renamed from Markdown to HTML so rich text is rendered consistently. After copying, remove the old names if they remain in your checkout:

```sh
git rm --ignore-unmatch index.markdown about.markdown publications/index.md cv/index.md
```

The replacements are `index.html`, `about.html`, `publications/index.html`, and `cv/index.html`. Leaving both versions can create duplicate output paths.

Use Node.js 22 or newer and run:

```sh
npm test
git status
git diff --stat
git add -A
git commit -m "Add private content admin and managed homepage content"
git push -u origin feature/homepage-admin
```

Open a pull request to `main`. The Admin browser checks workflow also runs on pull requests. Its browser test uses fixtures and mocked API responses; it never writes to GitHub. Review the changes and run checks before merging. A GitHub Actions Jekyll build is still required to verify the actual published layout.

After merging, in repository **Settings → Pages**, select **GitHub Actions** as the build source if it is not already selected. Inspect the deployment workflow in **Actions**. The workflow now generates `_cms_build` and uses that as the Jekyll source. A failed build does not replace the previous published site.

Do not point Pages at a branch's `/docs` folder. Do not upload the admin app as part of the public site build; the generator excludes it.

## 2. Create the private content repository

Create a repository named **homepage-content** under **mdsamiullah**:

- Visibility: **Private**.
- Initialise it with a README so the `main` branch exists.
- Leave Actions unused in this repository.

Do not copy your entire public source into this repository. The admin creates `draft.json` on its first save. If you prefer a different name, update `CONTENT_REPO` in the Worker configuration before deployment.

The proposed repository names are already populated in `admin-app/wrangler.toml`. They are configuration, not evidence that the private repository has been created.

## 3. Create the free admin Worker

Sign up for or sign in to Cloudflare, and stay on **Workers Free**. From a terminal in the updated project:

```sh
cd admin-app
npx wrangler@4 login
npx wrangler@4 deploy
```

The first deployment returns a URL similar to:

`https://sami-homepage-admin.YOUR-SUBDOMAIN.workers.dev`

Use the exact URL returned to you. Sign-in will not work until the remaining configuration is complete. No custom domain is needed.

Set `APP_ORIGIN` in `wrangler.toml` to this URL, with **no trailing slash**. Keep:

```toml
PUBLIC_REPO = "mdsamiullah/mdsamiullah.github.io"
CONTENT_REPO = "mdsamiullah/homepage-content"
BRANCH = "main"
ADMIN_USERS = "mdsamiullah"
```

Both repositories need the configured branch name. The public repository must allow authorised users to commit to that branch. If branch protection requires pull requests, direct publication will be rejected; do not silently remove protections. This version uses direct, attributed content commits and does not implement an approval/PR publishing workflow.

## 4. Register a GitHub App

In GitHub, open **Settings → Developer settings → GitHub Apps → New GitHub App**. This must be a **GitHub App**, not an OAuth App.

Configure:

- Name: a unique name such as `Sami Homepage Editor` (GitHub may require a suffix).
- Homepage URL: your Worker URL.
- Callback URL: your Worker URL followed by `/auth/callback`.
- Webhook: deactivate; this application does not receive webhooks.
- Repository permissions: **Contents: Read and write**. Metadata read access is automatic.
- No Actions, administration, or workflow-write permission is needed.
- Keep expiring user tokens enabled. The admin asks you to sign in again after the session expires; it does not keep refresh tokens.
- Restrict installation to your account if that matches your repository ownership.

Install the App on **only these two repositories**: the public homepage and the private content repository. Sign in as the account with write access to both. A GitHub App user token can only do what both the user and the installed App are permitted to do.

Copy the **Client ID** (not the App ID) into `GITHUB_CLIENT_ID` in `wrangler.toml`. Generate a client secret, then store it using:

```sh
npx wrangler@4 secret put GITHUB_CLIENT_SECRET
```

Paste the secret at the prompt. Do not put it in `wrangler.toml`, public code, chat, screenshots, or Git history. An App private key is not needed for this user-sign-in implementation.

Generate a separate random session secret locally:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy that output into this prompt:

```sh
npx wrangler@4 secret put SESSION_SECRET
```

Finally deploy the updated configuration:

```sh
npx wrangler@4 deploy
```

Keep `wrangler.toml` as the source of truth for nonsecret settings. Future Wrangler deployments can overwrite dashboard changes to those settings. Secrets remain in Cloudflare.

## 5. First sign-in and validation

Open the Worker URL and choose **Sign in with GitHub**. Approve the installed App for your account.

On the first visit, the admin reads the public content as its starting draft. Check these counts:

| Collection | Original count |
| --- | ---: |
| Publications | 39 |
| Supervision | 44 |
| Teaching | 31 |
| Certificates | 31 |
| Portfolio | 23 |

Then:

1. Click **Save private draft**. Verify `draft.json` now exists in the private repository, not the public repository.
2. Add a temporary supervision record. Give it a name, project and year; set **Visible** off. Save.
3. Publish and verify that hidden test record is absent from the public `_data/managed.json` and from the deployed page.
4. Delete the test record and restore it from **Recycle bin**. Delete it again and save privately.
5. Import a small CSV containing one duplicate and one new entry. The duplicate must start unchecked in review. Import the new entry, then remove the test entry afterwards.
6. Edit a public text field, save and publish. Wait for the Pages deployment to succeed, then refresh the live site.
7. Check the home cards, supervision cards, portfolio, publication list, CV iframe, sidebar, page search and mobile layout.

A successful admin publish means the GitHub content commit succeeded. It does **not** mean GitHub Pages has finished deploying. Follow the Actions link in **Editors & backups**.

## Everyday editing

**Profile & navigation** changes your name, designation list, interests, location, social details, and menu labels/order. Navigation URLs must point to an existing page. Adding a link does not create a new page template.

**Pages & home cards** controls prose, page headings, home cards, CV file/button, the existing About page, error page, and starter blog post. Page routes stay fixed to preserve links. Titles and structured fields use plain inputs; descriptions and page bodies use a rich text toolbar. Paste from Word or other websites: unsupported formatting is removed for safety. Tables, headings, bold, italic, lists, links, quotes, and undo/redo are available. Inline images are not supported in the prose editor; use the image fields or file links.

**Research publications / Supervision / Teaching / Certificates / Portfolio** provides Add, Edit, Move up/down and Delete. Section/subsection fields group the existing cards. Reordering within a section is supported; the public publication list still sorts by year. The portfolio collection includes your research projects. Publication year `0` means **Undated**, preserving three records already stored that way in the original archive.

**Visibility** controls inclusion in the next publication. Saving a hidden change does not remove a previously published record until you publish again.

**Labels & footer** changes the visible interface wording. **Colours** changes the accent colours and background; the existing overall layout remains in place.

**Citations** uses the existing Scholar fetch when Automatic citations is enabled. The selected Scholar ID comes from Profile & navigation. Disable automatic mode to use the entered year/count rows. Weekly updates trigger a new site build. External Google Scholar availability cannot be guaranteed; the original script retains the last data when fetching fails.

## CSV imports and duplicates

1. Download a CSV template from the collection you want to edit.
2. Fill in one record per row. For supervision, use `name`, `project`, `year`, `role`, `section`, `subsection` and optional URL/description. For publications, use `title`, `authors`, `venue`, `year`, and optional link fields.
3. Upload the CSV and map its columns. Missing optional columns can be skipped. Section/subsection names are text labels, not separate numeric IDs.
4. Review all rows before applying. Invalid rows cannot be imported. Potential duplicates are unchecked by default, including duplicates within the uploaded file.
5. Choose which rows to import. Applying an import only changes the working draft.
6. For records you want to merge, import them deliberately and use **Compare & merge** in the duplicate review section. Select the value to keep for each differing field. The second record moves to the recycle bin. There is no silent automatic merge.
7. Save your private draft; publish when ready.

Detection uses DOI matches, normalised titles/years, supervision names, and similar titles. It flags possible matches rather than proving identity. Different students sharing a name or the same course taught in different years can be legitimate records. The duplicate panel shows the first 100 pairs; resolve or search entries to narrow a large import.

CSV exports escape spreadsheet formula prefixes. If you deliberately use values beginning with `=`, `+`, `-` or `@`, exports may contain a leading apostrophe for spreadsheet safety.

## Files, images and CV

Use **Upload files** for PNG, JPG, WebP or PDF files up to 500 KB. This is a **public upload**, and the panel asks you to confirm that. Files get unique paths and do not overwrite the old version. Copy the returned path to the corresponding image, CV PDF or link field, then save and publish the text change.

Uploads become public as soon as committed, even before they are referenced by a page. Do not upload student-private documents, unpublished material, or confidential files here. Old assets remain in the public repository until deliberately removed with Git; removal does not erase Git history. Larger assets can still be added through your normal repository workflow.

## Add or remove editors later

1. Invite the person's own GitHub account as a collaborator with write access to both repositories.
2. Ensure the GitHub App remains installed on both repositories. The new editor must authorise it when signing in.
3. Add their exact GitHub username to `ADMIN_USERS`, comma separated, for example `mdsamiullah,second-editor`.
4. Redeploy the Worker. The **Editors & backups** screen shows the current allowlist.

All editors in this version can edit and publish. Separate author/reviewer roles are not implemented. Editor membership is managed in GitHub and the Worker configuration, not by a self-service invitation form in the admin. To remove access, remove the username from `ADMIN_USERS` and redeploy, then remove GitHub repository access. The allowlist is checked on every API request, including existing sessions.

## Backups, conflicts, and rollback

- **Export backup** downloads the entire private working document, including hidden records and the recycle bin. Store it privately.
- **Restore JSON backup** replaces the working draft, then requires a separate save and publish. Export current work first.
- GitHub commits retain earlier private drafts and public publications. You can retrieve an earlier `draft.json` through GitHub file history and import it as a backup. There is no in-panel Git history browser.
- If another editor saved first, your save is rejected with a conflict message. Export your work, reload the current draft, and reapply the relevant changes. Do not force overwrite.
- To roll back a bad publication, restore the earlier private JSON backup, review, and publish. To roll back the whole integration, revert its merge commit through your normal Git workflow.
- Signing out clears the secure session cookie. Revoke the App authorisation in GitHub if you need to invalidate the underlying token immediately.

## Existing manual scripts

The admin-managed content becomes the source of truth for the five collections. Editing `_data/*.yml` alone will be overwritten in the build copy by approved admin content. The original YAML and BibTeX files remain in the source as migration references.

The BibTeX conversion workflow is retained but its conversion step is skipped while `_data/managed.json` exists, preventing it from overwriting admin publications. New publications should be entered in the admin or imported as CSV. There is no automatic two-way BibTeX sync in this version. Citation automation and page snapshot automation remain separate.

## Troubleshooting

- **Sign-in expired/state mismatch:** restart from Sign in. Check the exact callback URL and `APP_ORIGIN`.
- **GitHub 401:** session/token expired or authorisation revoked. Sign out and in again.
- **GitHub 403/404:** check App installation on both repos, user write access, repo/branch names, private repo README, and `ADMIN_USERS`.
- **GitHub 409/422:** another change may have occurred or branch rules may reject the write. Export your draft before reloading; inspect repository rules if conflicts continue.
- **Publish succeeded but website unchanged:** inspect the Pages workflow. An App user-token content commit should trigger it; deployment is asynchronous.
- **Worker error/limit reached:** inspect Cloudflare logs without logging tokens or private content. Retry later on the free plan. No paid upgrade is required by this package.
- **Build failure:** the previous live site should remain. Inspect the failed Actions step. Ruby/Jekyll and browser execution could not be validated in the authoring environment; the workflows are included to run those checks on GitHub.
