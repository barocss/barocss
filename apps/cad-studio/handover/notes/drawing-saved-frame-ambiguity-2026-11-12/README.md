# D756 — Suppress a saved frame with an ambiguous dimension

P0, rows 11 and 16. FEATURE qualification. Parent `91618392160c3f6c0c10eb877f486521024f4614`. [D755 control editing](../drawing-legacy-dimension-control-2026-11-12/README.md).

The sheet draws a saved dimension-attached frame only if its dimension ID is unique in the drawing set. The issue list and model annotation omission report explain the shared ID. The native frame and dimensions remain stored as authored. If the operator removes one of the duplicate dimensions, the existing frame follows the remaining unique dimension. The standalone frame path retains its explicit view and position.

## Qualification

- **FAIL (parent)** — Studio opened a native two-sheet drawing with a 30 mm Top dimension, an Ø8 through-hole dimension and a saved position frame on the shared ID `d1`. The A3 continuation drew `Ø0.1` under the hole diameter and offered the same frame in model annotations and the actual SVG. The XML reader counted one frame on that SVG. Fixture SHA-256 `3a62c4c8e263fa6aebe88c2072e0046263fbb051455e7e560e052c66f6929a42`, baseline continuation SVG `a396654242e22bd3343b212ef5383da7990e80249e970508cc23a44d6b0a9ccd`.
- **PASS** — The continuation keeps the exact loaded drawing, including its original `control-d1`, and names the omission in its existing issue list. The sheet and current annotation consumer omit the ambiguous frame. Independent XML readback finds the Ø8 through-hole dimension and zero frames. Continuation SVG SHA-256 `49161a1e01b379989bf6e000babaaa7c3c9f44dfbce245d4da45b6c77f9e9f0f`.
- **PASS** — Explicitly removing the continuation dimension leaves the original frame bytes. The remaining 30 mm Top dimension displays `Ø0.1` in Studio, the annotation consumer and the independently parsed SVG. Undo restores the exact original with its omission. Redo restores the exact unique state. Top SVG SHA-256 `7a6a11b3b436cce97df96f07ae391e7b9c575c56571f0119b183d952193ebaa9`. One baseline and two fixed WebGPU desktop states across 335 frozen files. No downloads, page errors or console errors.
- **PASS** — Model 29/29, including native codec retention, same-sheet and cross-sheet ambiguity, standalone controls, and current SVG/PMI results. Studio 17/17. Both type checks, affected lint, driver syntax, production build, diff check and D755 five-state desktop replay. The first Model run failed because its new assertion read `view` on a model annotation. The replay uses the existing `from` field. Two intermediate type checks exposed an inferred optional test assertion. The final test types and narrows the issue before using its message.
- **NOT_RUN** — Full suites, mobile, PDF, DXF, alternate frame authors, GPU display of 3D PMI and native Save/Open after the D756 repair itself. D755 separately replays actual Save/Open of a uniquely attached frame.

Use Node 22.19.0, existing Chrome and Playwright, the serial heavy gate and an external evidence directory.

```sh
D756_SOURCE_FROZEN=1 node apps/cad-studio/test/drawing-legacy-dimension-control-browser.mjs "$EVIDENCE/baseline" --stored-baseline
D756_SOURCE_FROZEN=1 node apps/cad-studio/test/drawing-legacy-dimension-control-browser.mjs "$EVIDENCE/studio" --stored
D755_SOURCE_FROZEN=1 node apps/cad-studio/test/drawing-legacy-dimension-control-browser.mjs "$EVIDENCE/d755-replay"
TEST_CONCURRENCY=2 pnpm --dir packages/barocss-cad-model test drawing-composite-frame-consumer drawing-standalone-frame-consumer drawing-issues auto-layout
TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test drawing-commit-roundtrip stop-work-ownership
pnpm --dir packages/barocss-cad-model type-check
pnpm --dir apps/cad-studio type-check
pnpm exec eslint packages/barocss-cad-model/src/drawing/{annotations3d,controls,issues,sheet}.ts packages/barocss-cad-model/test/drawing-composite-frame-consumer.test.ts
node --check apps/cad-studio/test/drawing-legacy-dimension-control-browser.mjs
pnpm --dir apps/cad-studio exec vite build --outDir "$EVIDENCE/studio-dist"
git diff --check
```

Next D757 checks inspection of a replacement edge for an unresolved drawing dimension before any explicit reference change. [#2311](https://github.com/barocss/barocss/issues/2311). Initial scenarios remain 5/10. Whole CAD and core readiness remain **NOT_MEASURED**.
