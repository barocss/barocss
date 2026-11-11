# D674 — Keep a view-attached leader on its current SVG sheet

P2 B06, rows 11–13 and 16. This check uses the existing Drawing and Export SVG controls. [D510](../view-attached-leader-note-2026-11-04/README.md) verifies the note lifecycle in Studio. [D548](../two-sheet-postopen-svg-2026-11-05/README.md) reads real current-sheet SVG files for the issued drawing. D674 checks the leader in both actual files before and after moving its view.

## Studio result

**PASS.** Chrome WebGPU at 1440 × 900 opened a fresh seed based on the tracked 30 × 12 × 6 mm bracket fixture. The D510 retained input was unavailable. The seed declares two A4 sheets and one existing note at Top model coordinates [10, 3]. Seed SHA-256 `0ff299b5aab00fa7afbac87b0fd7789f6b3549ae282847af61bc1bcb3965a300`.

| Check | Sheet 1 | Sheet 2 |
| --- | --- | --- |
| Before Move | Front only, zero notes | Top at 5:1, one note, arrow tip (112.5, 93) mm |
| After Move | Front and Top at 2:1, one note, arrow tip (127.5, 78) mm | No views or notes |
| First Undo | Front only, zero notes | Top and one note |
| First Redo | Front and Top, one note | No views or notes |

The real **Export SVG** button produced four files. An independent Python XML reader checked A4 (297 × 210 mm), view and note membership, text, the shoulder, the line endpoint and the filled arrow. The reader derived the expected tip from each exported Top outline and the known 10 mm horizontal and 3 mm vertical offsets. Top outlines were 150 × 60 mm and 60 × 24 mm. Tip checks used 0.0001 mm absolute tolerance. Studio's fresh body read agreed with the analytic volume of 2160 mm³ and centroid [15, 6, 3] mm in all eight observations. First Undo and Redo restored the exact accepted documents. The two owner-sheet screenshots were visually checked. Zero page errors, console errors or source changes. The 326-file source capsule matched through browser and server cleanup.

**First runner FAIL.** Both initial exports passed. The move assertion then expected a scope-less Drawing document, while Studio materialized its default `scope: { kind: 'part' }` on the first edit. The final fixture declares that scope and the move changes only Top ownership. Product source stayed unchanged.

## Reproduction and limits

Use Node 22.19.0 and run one heavy command at a time through `gate.sh acquire heavy 180 <label>` and `gate.sh release heavy`. Use an external evidence directory. Run the desktop check from `apps/cad-studio` with local `PW_DIR` and `CHROME`:

- `D674_SOURCE_FROZEN=1 node test/two-sheet-leader-svg-browser.mjs "$EVIDENCE"`. Final receipt SHA-256 `716f5c707db279425c314ec236ddec7fed377e7d400aabe70374c9b110279a10`. First runner receipt SHA-256 `bd1e35aea24c2b5a3977598e15dc3188dc64f8932419c6594b27ecca87c48c2c`.
- From the root, `TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test drawing-commit-roundtrip drawing-revision-print` passed 17/17.
- From the root, `TEST_CONCURRENCY=2 pnpm --dir packages/barocss-cad-model test drawing-sheets.test sheet.test sheet-acceptance.test` yielded 36 PASS and 1 FAIL. The existing ASME PDF hash mismatch matches the [recorded failure](../shaft-drawing-fix-2026-11-03/qualification.json) and stays deferred.
- `pnpm --dir apps/cad-studio exec tsc --noEmit`, `pnpm --dir packages/barocss-cad-model run type-check`, `node --check apps/cad-studio/test/two-sheet-leader-svg-browser.mjs` and `git diff --check` passed.

**NOT_RUN.** New leader creation or project Save/reopen in this run, actual PDF export, full suites and wider B06 acceptance. [#540](https://github.com/barocss/barocss/issues/540) remains open. The next check is D675, which compares D503 against the remaining counterbore callout acceptance for actual current-sheet SVG.
