# D1103 — focus a proven circle centre-distance conflict

2026-11-14 · FEATURE · P0 desktop QA, rows 09 and 21 · [#2456](https://github.com/barocss/barocss/issues/2456)

After a refused aligned centre-distance edit, compare the requested value with authored horizontal and vertical distances for the same unordered circle pair. The 6e-7 mm gap covers two helper ties, the axis run and length, the aligned length, and floating-point roundoff. When multiple rows independently prove the contradiction, focus the largest axis distance. The action identifies a participating row and never implies that removal alone will resolve every edit. It is bound to the document and exact outline that produced the refusal.

- **FAIL** The parent refuses 35 → 20 mm but gives no way to locate the existing 24 mm horizontal distance.
- **PASS** Desktop WebGPU at 1280 × 800 refuses 20 mm and retains the accepted document. Enter on the conflict action selects the horizontal distance filter, turns off Picked only and focuses the exact row. Inspection marks both circles. Tab and Enter remove the row, and retrying 20 mm preserves the independent edge-to-circle lock, both hole IDs and the 5 mm Extrude. Document Undo/Redo and fresh native Open pass.
- **PASS** The native output is valid, has a 20 mm centre distance and a volume of 26214.60183664007 mm³. The independent plate-minus-holes formula agrees within 1e-7 mm³. The D1089 opposite-edge length desktop regression, 34 focused tests, Studio type check, scoped lint, driver syntax, diff, visual review and independent numerical audit pass.
- **NOT_RUN** Edge-to-circle or multi-rule conflict attribution, the combined hypotenuse when neither axis alone proves conflict, other viewports, full suites and production build.

#2456 remains open. Desktop QA is 19/54. Initial scenarios are 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
