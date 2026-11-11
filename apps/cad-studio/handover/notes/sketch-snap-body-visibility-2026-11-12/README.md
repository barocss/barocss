# D746 — Respect body visibility in sketch snapping

P0, rows 09 and 16. FEATURE qualification. Parent `c3605fd18e25f5e7b6f35ad2105f5cf351727e51`. [#2305](https://github.com/barocss/barocss/issues/2305).

The Studio supplies only visible top-level body meshes to the existing model snap calculation. The cache owns the body array, the current hidden-index set and the plane. It discards a previous model snap cue when its input changes. Hover and click use the same cache and current props. Original body indices, grid spacing, existing sketch and origin candidates, and the ghost appearance retain their current contracts.

## Qualification

- **FAIL (parent)** — Actual desktop Studio displayed End at the hidden body's bottom endpoint and stored `[10.25,12.25] mm` in a finished rectangle. The body remained hidden. The baseline captured two states.
- **PASS** — In the same current sketch, warming the visible endpoint and hiding its body clears the previous cue before another hover. The candidate stays absent on hover, returns after Show, and stays absent after Hide again. The actual click then uses the 1 mm grid and saves `[10,12]..[18,19] mm`. The original two bodies and their geometry remain exact. Opening the visible source again under the same body keys gives the End cue and authors `[10.25,12.25]..[18,19] mm`.
- **PASS** — The visible model midpoint and the origin retain their cues. A construction-line midpoint snaps while shown, disappears when hidden and returns when shown. Cancel keeps the accepted document. First Undo and Redo, local-project Save, Close, reload and Open retain the hidden state and exact grid-authored profile. Seven current desktop states over 329 frozen files. No browser downloads, page errors or console errors. Saved native SHA-256 `a6fc0d82299b4b44086cfb56886ca0dcab7e0d43ea8d263f2d215bb6a3496ba0`.
- **PASS** — Model 2/2 and Studio 37/37. The current cache tests preserve body-key order, stable inputs, shifted planes, reordered bodies and changed visibility with the same body array. Both type-checks, affected lint, driver syntax, production build and diff check pass.
- **FAIL (initial baseline driver)** — The first cue reader used the HTML text API on an SVG node. The reproduction uses SVG text content.
- **NOT_RUN** — Full suites, mobile and occlusion, section, placed-instance or new snap modes. The qualification covers explicit top-level visibility and ordinary XY sketch input.

Use Node 22.19.0, existing Chrome and Playwright, the serial heavy gate and an external evidence directory.

```sh
D746_SOURCE_FROZEN=1 node apps/cad-studio/test/sketch-snap-visibility-browser.mjs "$EVIDENCE/baseline-final" --baseline
D746_SOURCE_FROZEN=1 node apps/cad-studio/test/sketch-snap-visibility-browser.mjs "$EVIDENCE/studio-final"
TEST_CONCURRENCY=2 pnpm --dir packages/barocss-cad-model test osnap
TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test sketch-snap-visibility viewport-pick project-open-ownership
pnpm --dir packages/barocss-cad-model type-check
pnpm --dir apps/cad-studio type-check
pnpm exec eslint apps/cad-studio/src/viewport/{modelSketchSnaps,viewportPointerInput}.ts apps/cad-studio/test/sketch-snap-visibility.test.ts
node --check apps/cad-studio/test/sketch-snap-visibility-browser.mjs
pnpm --dir apps/cad-studio exec vite build --outDir "$EVIDENCE/studio-dist"
git diff --check
```

Next D747 verifies that Finish and Edit sketch retain the deletion of the last horizontal or vertical constraint. [#2320](https://github.com/barocss/barocss/issues/2320). Initial scenarios remain 5/10. Whole CAD and core readiness remain **NOT_MEASURED**.
