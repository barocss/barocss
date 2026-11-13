# D1105 — focus the two Fix constraints behind a point distance refusal

2026-11-14 · FEATURE · P0 desktop QA, rows 09 and 21 · [#2456](https://github.com/barocss/barocss/issues/2456)

After a viewport refusal, compare the requested point distance with the distance determined by the two explicit Fix targets. Use an 8e-7 mm margin for the fixed coordinates, measurement and helper rows. The document and exact outline own both target rows. Keep the existing solver response when the proof lacks two unambiguous Fix targets.

- **FAIL** The parent refuses the aligned 45 → 55 mm edit without a way to locate the two Fix rows.
- **PASS** Desktop WebGPU refuses the aligned 55 mm, vertical 37 mm and horizontal 46 mm edits while both points are fixed. Each action focuses its own Fix row and highlights the correct point. Remove the Fix at point 4 and retry the horizontal 46 mm edit. It preserves the other Fix, side tags and 5 mm Extrude. Document Undo/Redo and fresh native Open pass.
- **PASS** Native output is valid. Its volume of 4845.000000000001 mm³ agrees with the independent polygon area of 969 mm² times 5 mm. The D1104 edge-to-circle focus regression, 36 focused tests, Studio type check, scoped lint, driver syntax, diff, visual review and independent numerical audit pass.
- **NOT_RUN** Implicit Anchor and adjacent straight-edge Length attribution, ambiguous Fix rows, additional viewports, full suites and production build.

#2456 remains open. Desktop QA is 19/54. Initial scenarios are 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
