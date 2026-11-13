# D1019 — name the dependent Hole when Count removes its copy

2026-11-13 · FEATURE · P0 rows 05, 08, 15 and 16 · [#2447](https://github.com/barocss/barocss/issues/2447)

- **FAIL, baseline** The desktop History editor refused Count 2 on a spacing-controlled pattern with a Hole on copy 3. The primary error was generic. The missing face was only in Kernel detail.
- **PASS, fixed** The editor reports that Count 2 removes copy 3, which Hole Ø2 (n3) uses at `n1.top@2`. It tells the user to keep at least 3 copies or suppress the affected Hole first. The typed Count 2 remains available for correction. The accepted document, bodies, selection, dirty state and history controls remain exact.
- **PASS** Set Count 4 in the same editor. The third copy alone keeps the Ø2 bore at [84, 13] mm. The fourth copy has one outer top loop. Both accepted shapes pass strict native validation and match Count × 192 − 8π mm³ within 1e-7 mm³. Undo/Redo restore the exact documents.
- **PASS** Visual review, 18 focused Studio tests, both type-checks, driver syntax and diff check.
- **NOT_RUN** Fixed span end reference, suppression order, other Hole dependencies, no-material cut, fresh reopen of Count 4, production build, full suites and mobile.

This rule reports active direct Hole consumers of numbered copies on the spacing-controlled Linear Pattern. Fixed span can preserve the physical end while changing its ordinal. It requires separate handling. #2447 remains open. Desktop QA remains 8/54 and initial scenarios 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
