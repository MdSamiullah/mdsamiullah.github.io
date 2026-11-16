# Md Samiullah — homepage with a private content admin

Start with **[docs/ADMIN_SETUP.md](docs/ADMIN_SETUP.md)**. This is a complete updated copy of the supplied Jekyll homepage, with a separate free-tier admin app.

- Public website: existing Jekyll/GitHub Pages site.
- Private text drafts: `homepage-content` private GitHub repository.
- Editor: Cloudflare Worker + GitHub App sign-in; your GitHub account initially, additional approved editors later.
- No paid CMS, database, custom domain, private Actions runner, or AI API required.
- The admin is not deployed or connected yet. Account setup is required.

See [the change list](docs/CHANGES.md) and [test report](docs/TEST_REPORT.md).

Developer checks (Node 22+):

```sh
npm test
```

The tests prepare a generated `_cms_build` directory. Your source data remains unchanged. GitHub Pages builds that directory using the existing Jekyll build action. Do not edit or commit `_cms_build`.
