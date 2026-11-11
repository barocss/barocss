# D753 — Keep Auto-dimension in the drawing set's current orientation

P0, rows 11 and 16. FEATURE qualification. Parent `fcea15e1705da065ab5c29d279c7c274e099ba60`. [#2359](https://github.com/barocss/barocss/issues/2359). [D576 notice ownership](../drawing-commit-ownership-2026-11-10/README.md) and [D752 manual Front](../drawing-sheet-orientation-2026-11-12/README.md).

Auto-dimension lays out the active sheet in the common orientation of a drawing set. The information heuristic keeps automatic direction selection for an eligible single sheet. The whole-set and sheet-local inputs both identify a drawing set. Front from remains the explicit drawing-wide direction change. The success notice follows the accepted commit.

## Qualification

- **FAIL (parent)** — A two-sheet 60 × 30 × 30 mm block had a manual Ø8 through-hole callout on the A3 continuation. Auto-dimension on sheet 1 chose +X through a genuine Worker projection and reported six placements. The common orientation changed. The continuation's callout became lost because its circle no longer projected round in that view. Three baseline desktop states.
- **PASS** — Auto-dimension adds three dimensions on sheet 1, 30, 30 and 60 mm. The A3 continuation retains its original manual dimension ID, source edge, Ø8 through-hole reading, view, note and scale. No oriented projection runs for the Auto request. Independent XML readback verifies both sheets. The sibling SVG before and after is byte-identical with SHA-256 `dae26fd290de053c17bd1c82845a6c3eddbd31f13fa621be533619fd7369ef89`. The active SVG hash is `602453b02b5a65caac6dbf6a8d428f5b84499d1bd3bd4638b67fb3d648bfffb6`. Undo and Redo restore exact settings. Local-project Save, Close, reload and Open keep the accepted drawing and continuation diameter.
- **PASS** — Holding a real successful single-sheet Auto projection while leaving Drawing and starting a new part produces only `Change not applied` when the old reply arrives. The new part, history and dirty state stay exact. Six current desktop states across 333 frozen files. No downloads, page errors or console errors. Native fixture SHA-256 `ca1f80b1e6cae3ba047ad6a876f1ddd532a18b7a394e57c0b94b6da14f5d31ca`. Saved SHA-256 `15bcbd2c58e3653c03c9256b999f1400d2a97cd6191d3378abf5da0160e46311`.
- **PASS** — D752 manual Front and D576 single-sheet Front/Auto replays pass six desktop states each. Model 25/25 and Studio 17/17 focused tests. Both type-checks, affected lint, driver syntax, production build and diff checks passed.
- **NOT_RUN** — Full suites, mobile, PDF and separate delayed Accept all/Fix all interactions. Sequential allocation of dimension IDs on multiple sheets is the next separate check.

Use Node 22.19.0, existing Chrome and Playwright, the serial heavy gate and an external evidence directory.

```sh
D753_SOURCE_FROZEN=1 node apps/cad-studio/test/drawing-sheet-orientation-browser.mjs "$EVIDENCE/baseline" --auto-baseline
D753_SOURCE_FROZEN=1 node apps/cad-studio/test/drawing-sheet-orientation-browser.mjs "$EVIDENCE/studio" --auto
D752_SOURCE_FROZEN=1 node apps/cad-studio/test/drawing-sheet-orientation-browser.mjs "$EVIDENCE/d752-manual-replay"
D576_SOURCE_FROZEN=1 node apps/cad-studio/test/drawing-commit-ownership-browser.mjs "$EVIDENCE/d576-replay" --expect=fixed
TEST_CONCURRENCY=2 pnpm --dir packages/barocss-cad-model test reorient auto-layout
TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test drawing-commit-roundtrip stop-work-ownership
pnpm --dir packages/barocss-cad-model type-check
pnpm --dir apps/cad-studio type-check
pnpm exec eslint packages/barocss-cad-model/src/drawing/layout.ts packages/barocss-cad-model/test/reorient.test.ts
node --check apps/cad-studio/test/drawing-sheet-orientation-browser.mjs
pnpm --dir apps/cad-studio exec vite build --outDir "$EVIDENCE/studio-dist"
git diff --check
```

Next D754 checks whether automatic or manual dimension creation reuses IDs from another sheet. Initial scenarios remain 5/10. Whole CAD and core readiness remain **NOT_MEASURED**.
