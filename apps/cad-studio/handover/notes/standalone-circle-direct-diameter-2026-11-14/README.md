# D1098 — edit a standalone circle diameter directly

2026-11-14 · FEATURE · P0 desktop QA, rows 09 and 21 · [#2456](https://github.com/barocss/barocss/issues/2456)

In Dimension, the standalone circle rim and diameter label open the existing inline dimension control. The picked and painted rim share the same screen projection. An accepted value uses the existing circle panel edit path and history. The source and current draft must still own the input. Repeat Enter uses Studio's existing sketch-action guard.

- **FAIL** Parent desktop Studio opens the standalone circle's sketch but a direct rim click shows no inline Diameter editor.
- **PASS** Desktop WebGPU highlights the rim in Dimension, clears the highlight on switching to Select without moving the pointer, and opens the 18 mm editor after fresh native Open. The input refuses 0 mm and leaves the diameter at 18 mm. The label opens the same input and accepts 22 mm. Repeated Enter leaves the draft open and the accepted document unchanged. Draft and document Undo and Redo restore each value. A second Open reads Ø22. The attached circle control also edits Ø18 → Ø22 with the original Extrude node and side IDs.
- **PASS** Strict native B-rep checks and independent cylinder or plate-minus-hole formulas agree within 1e-7 mm³. The standalone result changes from 1272.3450247038668 to 1900.6635554218249 mm³ and retains its face names. The plate with the edited hole has volume 15599.33644457815 mm³. Studio type check, 35 focused tests, scoped lint, driver syntax, diff, visual and independent source review pass.
- **NOT_RUN** Additional planes and viewport sizes, linked circle draft replay, full suites and production build.

#2456 remains open. Desktop QA is 19/54. Initial scenarios are 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
