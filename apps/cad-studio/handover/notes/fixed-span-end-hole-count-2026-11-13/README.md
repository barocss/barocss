# D1020 — keep a Fixed span Hole on the physical end copy

2026-11-13 · FEATURE · P0 rows 05, 08, 15 and 16 · [#2447](https://github.com/barocss/barocss/issues/2447)

- **FAIL, baseline** Actual Studio accepted Count 4 on the 32 mm Fixed span. The Hole still stored `n1.top@2` even though the native cut remained at the physical end, now `n1.top@3`.
- **PASS, fixed** Count 3 → 4 → 2 keeps the Ø2 bore at [84, 13] mm. The same edit writes `n1.top@3` then `n1.top@1`. Each strict native output has two loops only at the last top face and volume Count × 192 − 8π mm³ within 1e-7 mm³. Undo/Redo restore the matching references and documents.
- **PASS** Count 3 → 6 at span 20.02 mm keeps the authored bore centre [1.77, 13] mm. The represented end offset changes by about 3.55e-15 mm. Both layout checks keep the complete bore inside the end face and the new strict B-rep names `n1.top@5`.
- **PASS** Studio refuses an interior-copy Count edit and a combined distance-mode and Count edit. It preserves the accepted document. The interior refusal also preserves geometry, selection, dirty state and history controls.
- **PASS** Visual review, 64 focused Model tests, 18 focused Studio tests, both type-checks, driver syntax and diff check.
- **NOT_RUN** Total span-only edits, suppression order, other Hole and stock families, parameter or API changes, fresh Open after Count retarget, no-material cut, production build, full suites and mobile.

The accepted History path requires a terminal simple through Hole on the exact numbered top face of a separated lateral rectangular copy. It checks the old and new native pitch calculations, both represented bore clearances, and unchanged span, axis and parent. It saves the new end ordinal in the same edit as Count. #2447 remains open. Desktop QA is 8/54 and initial scenarios 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
