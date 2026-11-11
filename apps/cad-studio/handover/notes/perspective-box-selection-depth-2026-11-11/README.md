# D713 — Keep bodies behind the perspective eye out of box selection

P0, rows 16 and 21. SMALL private selection repair. Parent `f830253e9c73833801ea672f1670d0d0035d0cfa`. [#2431](https://github.com/barocss/barocss/issues/2431).

## Reproduction and decision

Open two native 2 × 2 × 2 mm boxes in desktop Studio. Their Z intervals are 0–2 and 40–42 mm. Use Top, middle-button pan and the wheel. The parent run measured eye Z at 26.0000559467 mm while the camera faced nearly along −Z. The rear box was wholly behind the eye and still had finite projected XY. Both the left-to-right window and right-to-left crossing selected `b1` and `b3`. The front box alone was visible in the viewport.

The ordinary perspective Model candidate check now uses signed forward depth. If the farthest point of the native body's bounds has negative depth, the body is behind the eye. If the bounds cross the eye plane, check every vertex before excluding the body. Mixed-depth bodies continue through the existing window and crossing rules. This preserves the numeric projection contract and the original body indices. Shift-additive selection still retains an explicit existing selection.

The baseline driver's first setup attempts used an incorrect button label or placed an endpoint outside the canvas. A later fixed-source run also had overlapping boxes in a case that required isolated screen bounds. Those setup failures led to the current Studio-control positioning. The original product failure was recorded on the unmodified parent before the production fix.

## Qualification

- **PASS** — Three native documents in one desktop Chrome WebGPU context, with 15 selection drags and 18 snapshots. Both directions kept the front body and omitted the rear. Front-only, rear-only, empty, Shift-additive, explicit prior selection, projection mode change, camera change, reordered native Open and a body crossing the eye plane all passed. Source document, body results and history stayed exact during every drag. Root reviewed the browser frame and body rows. All 786 frozen inputs matched through cleanup. No page or console errors or downloads.
- **PASS** — Existing D555 pointer tail replayed actual window selection, handle dragging, applying width and Undo, with six snapshots and 323 frozen inputs through cleanup. Studio focused tests 44/44, final Model and Studio TypeScript, affected lint, Studio production build, driver syntax and diff checks passed.
- **FAIL** — On the parent, window and crossing selected the body entirely behind the eye. Fixed in the current branch.
- **NOT_RUN** — Full suites, mobile, generalized camera-plane clipping and broader section, nested instance, Render, CAM or Print selection acceptance. Explicitly hidden Model bodies remain the separate #2288 acceptance. Crossing with no vertex in the box remains the separate #2430 acceptance.

Run from the repository root with Node 22.19.0, existing Chrome and Playwright, and the serial heavy gate. Use the baseline switch only with the parent production source.

```sh
D713_SOURCE_FROZEN=1 node apps/cad-studio/test/perspective-box-selection-browser.mjs "$EVIDENCE/studio"
TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test box-selection-depth camera-projector camera-relative-query selection-edge vertex-pick-filter
pnpm --dir packages/barocss-cad-model type-check
pnpm --dir apps/cad-studio type-check
pnpm --dir apps/cad-studio exec vite build --outDir "$EVIDENCE/studio-dist"
D555_SOURCE_FROZEN=1 D555_POINTER_TAIL=1 node apps/cad-studio/test/viewport-pointer-boundary-browser.mjs "$EVIDENCE/d555-pointer"
```

Next D714 checks whether ordinary Model box selection adds a body explicitly hidden in the Browser. [#2288](https://github.com/barocss/barocss/issues/2288). Initial scenarios remain 5/10. Whole CAD and core readiness remain **NOT_MEASURED**.
