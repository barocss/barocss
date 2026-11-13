# D1023 — verify Fixed span end Hole preview and fresh Open

2026-11-13 · SMALL · P0 rows 05, 08, 15 and 16 · [#2447](https://github.com/barocss/barocss/issues/2447)

- **PASS** Click the last top face of the three-copy Fixed span part in desktop WebGPU Studio. The Ø2 through-Hole preview at [84, 13] mm appears on the last copy. The document remains at three features. The rendered preview volume is 551.0284388 mm³, within the 0.2 mm³ display tolerance.
- **PASS** Apply creates the bore on `n1.top@2`. Count 4 writes `n1.top@3` and preserves the physical bore centre. Native outputs pass strict B-rep validation, with two loops only on the last top face. Native volume matches Count × 192 − 8π mm³ within 1e-7 mm³.
- **PASS** Undo and Redo restore the exact references. Browser Project Save and fresh Open recover the Count 4 document and native bore. The reopened document is clean.
- **PASS** Visual review, 18 focused Studio tests, driver syntax and diff check. No production code changed.
- **FAIL** None.
- **NOT_RUN** Other Hole, pattern and stock families, general model preview for History edits, production build, type-checks, full suites and mobile.

D1018–D1023 cover the reported spacing and Count failures, dependency guidance, the rectangular cutter miss, preview, Undo/Redo, and fresh Open. #2447 is ready for evidence-based closure. Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
