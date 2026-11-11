# D714 — Keep hidden Model bodies out of box selection

P0, rows 16 and 21. SMALL private selection repair. Parent `9f193c494dc05b964ae2e94e20ed5150fc6f5b72`. [#2288](https://github.com/barocss/barocss/issues/2288).

## Reproduction and decision

In desktop Studio, open two native 6 × 6 × 6 mm boxes. Hide the right box with its Browser eye button. The parent selected both `b1` and `b3` with a window drag and with a crossing drag. The right box remained hidden in the viewport and in the native document.

Use the current visibility set when the pointer releases. Skip a hidden body before the ordinary Model projection test, while keeping the original index for each visible body. Print continues to skip hidden bodies and tests only vertices from displayed triangles. An explicit Browser selection can still include a hidden body. Shift-additive retains that selection while applying the new candidate filter.

## Qualification

- **PASS** — 13 actual desktop Studio selection drags and 16 snapshots in Chrome WebGPU, across two native documents with opposite body orders. Both drag directions, visible-only, hidden-only, empty range, Shift-additive, hide/show/hide, a prior explicit Browser selection and reordered Open passed. During a held marquee, keyboard focus moved to the Browser visibility control and Space hid the right box. The marquee completed with only the visible body selected. Document, geometry, history and visibility matched the state before each selection read. The viewport and Browser rows showed the same outcome. All 786 frozen inputs matched through cleanup. No downloads, page errors or console errors.
- **PASS** — The actual Print preview retained the hidden exclusion on the 0.200 mm displayed layer. A box containing only the hidden body's projected footprint selected nothing. Crossing both footprints selected the visible body at original index 1. D713 replay passed all 15 perspective and orthographic drags on this source. Studio focused tests 44/44, Model and Studio TypeScript, affected lint, driver syntax, Studio production build and diff checks passed.
- **FAIL** — The parent selected the hidden body in both directions. Fixed in the current branch.
- **NOT_RUN** — Full suites, mobile, nested visibility, section and animated selection. General crossing with no vertex in the box remains open in [#2430](https://github.com/barocss/barocss/issues/2430).

Run from the repository root with Node 22.19.0, existing Chrome and Playwright, and the serial heavy gate. Use the baseline switch only with the parent production source.

```sh
D714_SOURCE_FROZEN=1 node apps/cad-studio/test/hidden-box-selection-browser.mjs "$EVIDENCE/studio"
D713_SOURCE_FROZEN=1 node apps/cad-studio/test/perspective-box-selection-browser.mjs "$EVIDENCE/d713-perspective"
TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test box-selection-depth camera-projector camera-relative-query selection-edge vertex-pick-filter
pnpm --dir packages/barocss-cad-model type-check
pnpm --dir apps/cad-studio type-check
pnpm --dir apps/cad-studio exec vite build --outDir "$EVIDENCE/studio-dist"
```

Next D715 returns to the daily part workflow. Reproduce the first valid Sketch Extend intersection being skipped after translation or after adding distant geometry. [#2432](https://github.com/barocss/barocss/issues/2432). Initial scenarios remain 5/10. Whole CAD and core readiness remain **NOT_MEASURED**.
