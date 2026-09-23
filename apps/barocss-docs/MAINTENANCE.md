# Documentation site maintenance

Status: 2026-09-23. BaroCSS `0.4.0` is published on npm, and both browser CDN files are available. The first main Pages deployment passed live smoke at `main@9d0ab731`. Future Docs updates still require the normal develop-to-main release path.

## Sources of truth

- Package exports and CDN filenames: the three package manifests, browser `src/index.ts`, the package checker, and the files actually published to npm/CDN.
- Compatibility claims: `packages/barocss/docs/tailwind-compatibility.md` and `docs/verification/0.0.4-rc-review.md` record earlier candidate tests. They do not prove full compatibility of the published `0.4.0` release.
- Published installation examples: verify the current npm package versions and exact CDN URLs before changing site examples.
- Wiki: maintainer procedures and release decisions. Keep installation, API usage, and examples on this site.

## Priority and acceptance criteria

| Priority | Work | Acceptance criterion |
| --- | --- | --- |
| P0 | Keep the home, introduction, Quick Start, and main examples aligned with the published release. | No full Tailwind compatibility claim. `baroStart` and `BrowserRuntime` match public exports. npm and CDN examples use the verified published `0.4.0` files. |
| P1 | Audit every API and integration example against package exports and generated output. | Each runnable example has a stated package version and a working import. Remove incomplete or speculative snippets. |
| P1 | Check navigation and Markdown links. | Every internal sidebar link and Markdown page link resolves; the VitePress build passes. |
| P2 | Review accessibility and information structure. | Check keyboard navigation, heading order, link text, color contrast, and narrow-screen layout in a browser. Record each defect and fix it. |
| P2 | Make docs checks part of CI. | Run the site build and link audit on changes to the docs or package API. |

## Current evidence and limits

- The [first main Pages run](https://github.com/barocss/barocss/actions/runs/35848469099) built and deployed `main@9d0ab731`. The [live smoke record](https://github.com/barocss/barocss/pull/92#issuecomment-5793205551) checked six key pages, 198 internal path targets, and browser execution of the then-published CDN examples.
- The corrected Docs tree built with Node `22.22.0` and pnpm `9.15.4`. Its generated link audit covered 220 HTML pages and 41,692 internal links with zero missing targets. Re-run these checks for each Docs change.
- The public `0.4.0` browser ESM and UMD files returned HTTP 200. Both exposed `baroStart` and generated CSS for `bg-red-500` in isolated Chromium frames. npm reports `0.4.0` for kit, browser, and server.
- The large examples page uses small snippets with public exports and selected fixture classes. Other integration and API pages still need the P1 audit. No full browser accessibility audit or external link check has been completed.

## GitHub Pages procedure

`.github/workflows/deploy-docs.yml` builds Docs pull requests without deployment. A reviewed `main` push that changes Docs content or the Docs package manifest builds and deploys `apps/barocss-docs/docs/.vitepress/dist` automatically. Docs changes enter `develop` first; the user manually merges a release-ready develop-to-main PR. Confirm the Pages run SHA, deployment record, live Quick Start, CDN URLs, and internal links after that merge. Manual workflow dispatch is limited to `main` and requires approval. npm publication is a separate release action.
