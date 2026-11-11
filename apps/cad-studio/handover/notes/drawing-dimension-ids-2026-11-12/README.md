# D754 — Allocate dimension IDs across the drawing set

P0, rows 11 and 16. FEATURE qualification. Parent `ef40ab54b49c6177d8ff8e7f8e50b82c3ae227c8`. [D753 Auto-dimension sheet scope](../drawing-auto-sheet-scope-2026-11-12/README.md).

Manual dimensions allocate IDs from the whole drawing. Auto-dimension reserves IDs used by other sheets and by retained dimensions on the active sheet. The reservation comes from the sheet view of the accepted drawing and stays out of the stored drawing settings. Auto-dimension can reuse IDs from the dimensions it replaces on the same sheet.

## Qualification

- **FAIL (parent)** — On a two-sheet 60 × 30 × 30 mm block with an Ø8 through-hole, sheet 1 Auto-dimension created `d1` to `d3`. The manual Diameter tool on the continuation reused `d1`. After Undo, Auto-dimension on the continuation reused all three IDs. Three baseline desktop states across 333 frozen files. Native fixture SHA-256 `81b22147b3654f4aa7711152509ee55c3d6ad0569de40fedfb5d5f1328fed146`.
- **PASS** — The manual continuation diameter receives `d4`. After Undo, continuation Auto-dimension places `d4`, `d5` and `d6` at 15 mm, 15 mm and Ø8 through. Sheet 1 retains `d1` to `d3` at 30, 30 and 60 mm. An independent XML readback checks both SVG exports for disjoint IDs and these values. SHA-256 in sheet order: `0469d1f246d5f6d6424de8fee1bbecdaf81d3f5bf7d58fea0327f14de5980793`, `585dfe52d3bc9c7ff40dd89941f497fed776d8270251beb085947736434a2266`.
- **PASS** — Local-project Save, Close, reload and Open retain the accepted drawing exactly. Saved SHA-256 `5c0f5b49002fe7b32339c8be420d11b57769bba782bfd06a6408b004b75c1b6a`. Four current WebGPU desktop states across 333 frozen files. Zero browser errors and downloads.
- **PASS** — Model 31/31 and Studio 17/17 focused tests. Model covers both sheet orders, whole-set layout and a retained sibling diameter with tolerance. Both type checks, affected lint, driver syntax, production build, diff check and six desktop states of the D753 Auto-dimension replay pass.
- **NOT_RUN** — Full suites, mobile, PDF and control-frame editing in a legacy file with pre-existing duplicate dimension IDs.

Use Node 22.19.0, existing Chrome and Playwright, the serial heavy gate and an external evidence directory.

```sh
D754_SOURCE_FROZEN=1 node apps/cad-studio/test/drawing-dimension-ids-browser.mjs "$EVIDENCE/baseline" --baseline
D754_SOURCE_FROZEN=1 node apps/cad-studio/test/drawing-dimension-ids-browser.mjs "$EVIDENCE/studio"
D753_SOURCE_FROZEN=1 node apps/cad-studio/test/drawing-sheet-orientation-browser.mjs "$EVIDENCE/d753-replay" --auto
TEST_CONCURRENCY=2 pnpm --dir packages/barocss-cad-model test auto-layout reorient drawing-detail-ownership
TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test drawing-commit-roundtrip stop-work-ownership
pnpm --dir packages/barocss-cad-model type-check
pnpm --dir apps/cad-studio type-check
pnpm exec eslint packages/barocss-cad-model/src/drawing/{auto,sheets}.ts packages/barocss-cad-model/test/auto-layout.test.ts apps/cad-studio/src/ui/DrawingWorkspace.tsx
node --check apps/cad-studio/test/drawing-dimension-ids-browser.mjs
pnpm --dir apps/cad-studio exec vite build --outDir "$EVIDENCE/studio-dist"
git diff --check
```

Next D755 checks dimension-attached geometric controls in older drawing sets with duplicate IDs. Initial scenarios remain 5/10. Whole CAD and core readiness remain **NOT_MEASURED**.
