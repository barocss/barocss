# D752 — Keep dimension ownership when turning a drawing set

P0, rows 11 and 16. FEATURE qualification. Parent `71f7fa899520069e6a282bc1825d55c3d47c410e`. [#2359](https://github.com/barocss/barocss/issues/2359). [D576 commit acceptance](../drawing-commit-ownership-2026-11-10/README.md).

Front from changes one orientation for the entire drawing. Studio sends the whole drawing settings through the existing remap and commits the result once. Model remaps each explicit sheet view assignment with the same axis permutation used for dimensions and other annotations. The physical view keeps its sheet. Details and removed sections keep their identifiers. The current commit result still owns the success notice.

## Qualification

- **FAIL (parent)** — A 64 × 32 × 8 mm through-hole plate showed its Front width 64 mm and height 8 mm on the A3 continuation. Turning from −Y to +X on sheet 1 reported success, removed the continuation's only view and left both dimensions attached to the old Front name. The drawing readout marked both measured edges lost. Four baseline desktop states over 333 frozen files.
- **PASS** — The same turn maps the old Front view to Right on the A3 continuation. Its original two dimension IDs and edge and point references still resolve to 64 mm and 8 mm. The A4 first sheet retains the Top dimensions 32, 16, 32 and Ø8 mm. Both sheet notes, sheet names, sizes, continuation scale and accepted model geometry are preserved. Python's XML reader independently checked the six dimension IDs, texts and note ownership in all four actual SVGs.
- **PASS** — A genuine +X projection held while the user switches to the continuation and changes its size arrives after the new setting. The original orientation and dimensions remain, history and dirty state match the newer edit, and Studio reports only `Change not applied`. The normal turn is one Undo/Redo operation. Local-project Save, Close, reload and Open retain the exact accepted drawing. Six current desktop states. No downloads, page errors or console errors. Native fixture SHA-256 `83fe6b6e37d63635f75e2650b509460b5af8a0796e5c4853dba57c210d36827a`. Saved SHA-256 `2c667f21580914fb2c5ccbde23dae7a97c26e4a41d57a64988da440b943ca236`.
- **PASS** — D576 desktop replay passes both single-sheet delayed Front and Auto requests plus current actions and Undo/Redo. Model 25/25 and Studio 17/17 focused tests. Model controls cover the complementary sheet assignment, the turn back, continuation detail and leader, and the local `set_drawing` consumer. Both type-checks, affected lint, driver syntax, production build and diff checks passed.
- **FAIL (initial harness)** — The first XML check treated notes and the sheet index as dimensions. It now reads only dimension groups. The first local tool assertion expected an omitted success flag. The actual tool returns `false` for `isError`.
- **NOT_RUN** — Full suites, mobile, PDF, and the whole-drawing direction heuristic during multi-sheet Auto-dimension. #2359 stays open for the remaining Auto and workspace-transition checks.

Use Node 22.19.0, existing Chrome and Playwright, the serial heavy gate and an external evidence directory.

```sh
D752_SOURCE_FROZEN=1 node apps/cad-studio/test/drawing-sheet-orientation-browser.mjs "$EVIDENCE/baseline-final" --baseline
D752_SOURCE_FROZEN=1 node apps/cad-studio/test/drawing-sheet-orientation-browser.mjs "$EVIDENCE/studio"
D576_SOURCE_FROZEN=1 node apps/cad-studio/test/drawing-commit-ownership-browser.mjs "$EVIDENCE/d576-final-replay" --expect=fixed
TEST_CONCURRENCY=2 pnpm --dir packages/barocss-cad-model test reorient auto-layout
TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test drawing-commit-roundtrip stop-work-ownership
pnpm --dir packages/barocss-cad-model type-check
pnpm --dir apps/cad-studio type-check
pnpm exec eslint packages/barocss-cad-model/src/drawing/reorient.ts packages/barocss-cad-model/test/reorient.test.ts apps/cad-studio/src/ui/DrawingWorkspace.tsx
node --check apps/cad-studio/test/drawing-sheet-orientation-browser.mjs
pnpm --dir apps/cad-studio exec vite build --outDir "$EVIDENCE/studio-dist"
git diff --check
```

Next D753 checks the automatic Front choice when Auto-dimension runs on one sheet of a drawing set. [#2359](https://github.com/barocss/barocss/issues/2359). Initial scenarios remain 5/10. Whole CAD and core readiness remain **NOT_MEASURED**.
