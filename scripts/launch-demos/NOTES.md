# #379 launch demos (unpublished, unlisted)

Output: `apps/barocss-docs/docs/public/demos/` (copied as-is by the docs build to `/demos/`, not linked from the nav).
Pages: `cms/`, `widget/`, `ssr/with.html` + `ssr/without.html`, index `demos/index.html`.

- Generate: `node scripts/launch-demos/build.mjs` (needs `build:library` of kit + server; uses recorded #253 opus blocks, no model calls)
- Run (one command): `node scripts/launch-demos/serve.mjs [--local] [port]` -> http://localhost:7450/demos/
- Verify: `PW_DIR=… CHROME=… node scripts/launch-demos/verify.mjs`

Version: the pages reference `@barocss/browser@0.10.1` on cdn.jsdelivr.net. Nothing was downloaded from npm;
verification routed that URL to the workspace build `packages/barocss-browser/dist/cdn/barocss.umd.cjs` (package.json
version 0.10.1, integration develop 89dd587). The SSR pages were pre-rendered with the workspace `@barocss/server`
(0.10.1) dist. Not verified: the published CDN file itself (content type of `.cjs` on jsdelivr) and the
`@tailwindcss/browser` arm (external requests aborted in verification).

Verified (Chromium 1223, headless, 2026-09-26): cms baro styled / none unstyled; widget baro styled, 0/7 host elements
changed, 0 CSP violations, no document styles; ssr with: styled before the runtime, without: unstyled until the runtime;
0 console errors on every page.

Known gap (0.10.1): in the widget, the hero's `bg-gradient-to-b from-slate-900 to-slate-800` background does not render
inside the shadow root (header/other utilities do), so the hero text is hard to read. Fix or swap the block before launch.
