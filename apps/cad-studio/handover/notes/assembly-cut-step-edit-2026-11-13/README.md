# D1028 — verify STEP during an Assembly Cut edit

2026-11-13 · SMALL · P0 rows 05, 13, 16 and 20 · [#2448](https://github.com/barocss/barocss/issues/2448)

- **PASS** Desktop Studio shows the Ø12 draft while an AP214 export still carries the applied Ø8. A point 5 mm from the centre lies in the draft opening and returns to the plate on Cancel. The edit field and draft survive export.
- **PASS** Eight STEP captures are read in a separate process with strict B-rep checks and an analytic volume oracle. Each plate stays at 12,000 mm³ in stock, creation draft and Undo. Apply, Ø12 edit draft, edit Cancel, Redo and Project reopen each retain both R4 bores at [30, 20] and plate volumes of 12,000 − 80π mm³ within 1e-6 mm³. The base stays at 28,800 mm³.
- **PASS** Visual review, 22 focused Studio tests, driver syntax and diff check. No production change.
- **FAIL** None on the current source in this scope. D1024, D1026 and D1027 retain the first failures.
- **NOT_RUN** Third-party STEP reader, other target types, 3MF, production build, type-checks, full suites and mobile.

D1024–D1028 satisfy the reported two-plate case of #2448. Desktop QA is 10/54 including this case, initial scenarios remain 8/10, and whole CAD and core readiness **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
