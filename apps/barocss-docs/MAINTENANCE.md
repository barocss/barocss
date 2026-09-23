# Documentation site maintenance

Status: 2026-09-23. This file records the 0.0.4 candidate audit. It does not approve a release or a Pages deployment.

## Sources of truth

- Package exports and CDN filenames: the three package manifests, browser `src/index.ts`, and the candidate's `.github/scripts/check-packages.mjs`.
- Compatibility claims: `packages/barocss/docs/tailwind-compatibility.md` and `docs/verification/0.0.4-rc-review.md` on the 0.0.4 candidate branch.
- Published installation examples: the version currently available from npm. The candidate is not a published version.
- Wiki: confirmed maintainer procedures and decisions. Keep installation, API usage, and examples on this site. Link the Wiki Home after it is published.

## Priority and acceptance criteria

| Priority | Work | Acceptance criterion |
| --- | --- | --- |
| P0 | Correct the home, introduction, Quick Start, and main examples. | No full Tailwind compatibility claim. `baroStart` and `BrowserRuntime` match public exports. Published `0.0.3` examples are distinct from the `0.0.4` candidate. |
| P1 | Audit every API and integration example against package exports and generated output. | Each runnable example has a stated package version and a working import. Remove incomplete or speculative snippets. |
| P1 | Check navigation and Markdown links. | Every internal sidebar link and Markdown page link resolves; the VitePress build passes. |
| P2 | Review accessibility and information structure. | Check keyboard navigation, heading order, link text, color contrast, and narrow-screen layout in a browser. Record each defect and fix it. |
| P2 | Make docs checks part of CI. | Run the site build and link audit on changes to the docs or package API. |

## Current evidence and limits

- The site build passed locally with Node `18.19.0` and pnpm `10.11.0` after an offline frozen-lockfile install. The Pages workflow uses Node 22 and pnpm 9; its build still needs to pass on the integrated branch.
- A local link audit found four missing sidebar targets. The navigation entries were corrected or removed. The Markdown page-link audit found no missing page target.
- The large examples page had incomplete code and claims without tests. It was replaced with small examples that use public exports and selected fixture classes. Other integration and API pages still need the P1 audit.
- No browser accessibility audit or external link check has been completed.

## GitHub Pages procedure

`.github/workflows/deploy-docs.yml` runs only through `workflow_dispatch`. It installs dependencies with a frozen lockfile, builds the site, uploads `apps/barocss-docs/docs/.vitepress/dist`, and deploys that artifact. Review the integrated changes and the Pages build before requesting a deployment. Do not dispatch the deployment without the user's approval.
