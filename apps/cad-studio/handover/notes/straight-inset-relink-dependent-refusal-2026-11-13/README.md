# D921 — retain the accepted inset when a replacement Extrude fails

2026-11-13 · SMALL · P1 rows 07, 09 and 16 · [#2324](https://github.com/barocss/barocss/issues/2324) remains open.

The replacement stock has a native 4.25 × 4.25 mm top at Z=8. Its X range is [9990, 9994.25] mm. The 2 mm inset resolves to one 0.25 × 0.25 mm opening. The independent opening area is 0.0625 mm². The native profile check uses 1e-9 × 9992.25² = 0.0998450600625 mm² as its area floor for this loop. The linked sketch resolves, then the dependent Extrude refuses the opening.

- **PASS** The isolated native read confirmed a valid replacement stock, the exact four inner vertices, retained separate target, successful source resolution and the downstream failure on `n5`. The native stock volume was 144.50000000001455 mm³.
- **PASS** Actual Studio selected the same native top and displayed the Extrude refusal with no applicable preview. The accepted document, title, dirty state, three bodies, selection and history stayed equal. First Undo removed the accepted Extrude, and Redo restored the original 960 mm³ ring. The healthy re-link, Cancel, late reply, Save and fresh re-edit regression also passed.
- **PASS** 22 Model and 44 Studio focused tests, driver syntax and diff checks. Independent geometry review confirmed the two admission thresholds.
- **FAIL** The first browser observer did not declare the projected X coordinate as a page-function argument. The corrected observer passed.
- **NOT_RUN** Nonaxial re-link, damaged-file repair, whole suites and mobile. The native area policy is unchanged.

[Commands and receipt hashes](qualification.json).
