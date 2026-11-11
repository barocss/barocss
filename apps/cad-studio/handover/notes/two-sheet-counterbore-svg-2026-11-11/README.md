# D675 — Export the current counterbore callout on its own sheet

P2 B06, rows 11–13 and 16. [D503](../counterbore-callout-revision-2026-11-04/README.md) verifies live depth and revision changes through Drawing and project Open. [D548](../two-sheet-postopen-svg-2026-11-05/README.md) reads actual SVG files for a two-sheet part. D675 covers the counterbore callout in the exported files before and after one depth edit.

## Desktop Studio

**PASS.** Chrome WebGPU at 1440 × 900 opened the exact D500 seed embedded in the D542 source. The 1,535-byte seed matches SHA-256 `f2866bb360876da5e0c804382525d19cc91d2c54d4a1a268ff929056b4299529`. Studio ran Auto-dimension, added an A4 sheet, moved Top to it and set its scale to 1:1. It exported both sheets, applied the public feature editor's Depth change from 4 to 2 mm, and exported both again. The accepted model nodes changed only at that depth field. The output body identity stayed `b3`.

| Recess depth | Sheet 1 | Sheet 2 |
| --- | --- | --- |
| 4 mm | Front and Isometric, zero counterbore callouts | Top, one d4 callout, Ø4 THRU CBORE Ø8 × 4 DEEP |
| 2 mm | Front and Isometric, zero counterbore callouts | Top, one d4 callout, Ø4 THRU CBORE Ø8 × 2 DEEP |

The independent XML reader checked the original files for A4 dimensions, current sheet numbers, view and callout ownership, and the 1:1 millimetre Top outline of 80 × 40 mm. Both files on Sheet 2 show 2 and 4 mm arc radii. The separate analytic body check subtracts a through cylinder and an annular recess from the block. Studio's body volumes at depths 4 and 2 were 38098.40710525531 and 38173.80532894145 mm³. Centroid Z was 5.984167690060566 and 5.990124350580661 mm. The volume and centroid checks used absolute tolerances of 1e-8 mm³ and 1e-9 mm. Both Top screenshots were reviewed. The 330-file source capsule matched through cleanup, with zero page errors, console errors and source changes.

**First runner FAIL.** The unscoped Scale locator matched two controls. The second run used the Drawing settings panel to identify its scale input. This changed only the driver.

## Reproduction and limits

Use Node 22.19.0 and one heavy job at a time through `gate.sh acquire heavy 180 <label>` and `gate.sh release heavy`.

- From Studio, set local `PW_DIR` and `CHROME`. Run `D675_SOURCE_FROZEN=1 node test/two-sheet-counterbore-svg-browser.mjs "$EVIDENCE"` with an external evidence directory. Final receipt SHA-256 `9fc4a6fd99ab45e7117a56cba210d503ef2b55166ba2aae59365369348ca868a`. First runner receipt SHA-256 `c264eea37838bb3f84cd9799931a9adc6184b021c5a3697554d9a47c22f256a9`.
- From the root, `TEST_CONCURRENCY=2 pnpm --dir packages/barocss-cad-model test auto-dimension.test drawing-parameter-hole-callout.test hole-types.test` passed 19/19. `TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test drawing-commit-roundtrip drawing-revision-print` passed 17/17.
- `pnpm --dir apps/cad-studio exec tsc --noEmit`, `pnpm --dir packages/barocss-cad-model run type-check`, `node --check apps/cad-studio/test/two-sheet-counterbore-svg-browser.mjs` and `git diff --check` passed.

**NOT_RUN.** Issuing or reopening a project, actual PDF, full suites and wider B06 acceptance. The owner-deferred ASME PDF mismatch stays on hold. [#540](https://github.com/barocss/barocss/issues/540) and [#536](https://github.com/barocss/barocss/issues/536) remain open. D676 checks that an actual SVG omits a lost diameter after Hole suppression and restores it after Undo, using D477 to identify the existing supported case.
