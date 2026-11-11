# D719 — Select bodies intersected by an orthographic crossing box

P0, row 16. FEATURE qualification for desktop Studio. Parent `1381ea13eda446dda8643345992057267f4e8340`. [#2430](https://github.com/barocss/barocss/issues/2430).

On the parent, two actual right-to-left drags missed the same 50 × 10 × 4 mm plate, body `b1`. One crossed its silhouette and the other lay inside its face. The mesh had 24 vertex records and 12 triangles. Neither box enclosed a vertex. With the Top view in orthographic projection, the edge box spanned CSS `[495.063,643.609]–[580.265,681.476]` and the face box spanned `[495.063,690.943]–[580.265,728.811]`. The corner and hole controls behaved as expected.

The ordinary orthographic Model mouse path now projects the indexed display triangles in the same CSS coordinate system as the pointer. It tests the closed triangle and rectangle intervals along the screen axes and each triangle-edge normal. It includes boundary contact and triangles projected as segments or points. Unused vertices and empty regions cannot qualify a body. Body indices and existing visibility ownership stay with Studio. Perspective, window selection, Print, section and the other preview or transformed paths keep their existing selection rules.

## Qualification

- **PASS** — Actual Chrome WebGPU, 22 states and 788 frozen inputs through cleanup. Both previously missed drags selected `b1`. The hole and outside rectangles stayed empty. Window containment, visible and hidden crossings, face-filter click, Shift-additive, empty replacement, active Box command and cancellation, and the subsequent crossing passed. Native geometry, visibility and history stayed exact across selection operations. After a native document replacement with the same local keys, the reordered plate resolved to index 2.
- **PASS** — Studio project Save and fresh Open retained the exact native document. A fresh crossing picked the reopened plate. Saved native SHA-256 is `007e4d437178fc845a25c27a38368068882d0832fc6b1702cf3f2c098f58efc4`.
- **PASS** — Focused geometry checks covered diagonal and corner contact, AABB-only misses, projected segments and points, malformed triangles, and the same long narrow strip under altered density, winding, index order and duplicate vertices. Sol High compared the underlying interval test with an independent segment-and-containment oracle for 26,244 integer-grid combinations. D714 and D713 desktop replays passed 16 and 18 states. Zero downloads, page errors and console errors. Studio 29/29 focused tests, Model and Studio type-checks, affected lint, build, driver syntax and diff checks passed.
- **FAIL** — The parent missed the two zero-vertex drags. The first expanded driver clicked a selected body's edit handle while checking the face filter. The passing run clears selection before testing an ordinary face click.
- **NOT_RUN** — Full suites, mobile, large-scene performance and new perspective, near-plane, clipping, assembly, or occlusion selection policies.

Run with Node 22.19.0, existing Chrome and Playwright, and the serial heavy gate. Use the baseline switch with the parent production source.

```sh
D719_SOURCE_FROZEN=1 node apps/cad-studio/test/crossing-box-selection-browser.mjs "$EVIDENCE/studio"
D714_SOURCE_FROZEN=1 node apps/cad-studio/test/hidden-box-selection-browser.mjs "$EVIDENCE/d714-replay"
D713_SOURCE_FROZEN=1 node apps/cad-studio/test/perspective-box-selection-browser.mjs "$EVIDENCE/d713-replay"
TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test box-crossing-selection box-selection-depth selection-edge vertex-pick-filter nested-selection
pnpm --dir packages/barocss-cad-model type-check
pnpm --dir apps/cad-studio type-check
pnpm exec eslint apps/cad-studio/src/App.tsx apps/cad-studio/src/viewport/{viewportPointerInput,boxSelectionCrossing}.ts apps/cad-studio/test/box-crossing-selection.test.ts
node --check apps/cad-studio/test/crossing-box-selection-browser.mjs
pnpm --dir apps/cad-studio exec vite build --outDir "$EVIDENCE/studio-dist"
git diff --check
```

Next D720 reproduces section planes that can leave a thin model's span at initialization or during drag. [#2407](https://github.com/barocss/barocss/issues/2407). Initial scenarios remain 5/10. Whole CAD and core readiness remain **NOT_MEASURED**.
