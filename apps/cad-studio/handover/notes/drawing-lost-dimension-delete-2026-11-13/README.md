# D1033 — verify DIMENSIONS deletion after part removal Redo

2026-11-13 · SMALL · P0 rows 10, 12 and 20 · [#2449](https://github.com/barocss/barocss/issues/2449)

- **PASS** Desktop Studio removes Plate 2, restores it with Undo, then removes it again with Redo. The DIMENSIONS row action deletes lost `d2` on the first click. The visible Ø8 `d1`, all remaining geometry and other drawing settings stay unchanged. Undo of dimension deletion restores only the lost row and its warning. Redo removes them again.
- **PASS** Visual inspection, 17 focused Studio tests, driver syntax and diff check.
- **FAIL** The historical report recorded a refusal. It did not recur on the current desktop source after the Drawing projection had refreshed. No production change.
- **NOT_RUN** An immediate row click during a pending projection, explicit reattachment, other sheets, build, full suites and mobile.

#2449 remains open for explicit diameter reattachment. Desktop QA is 10/54, initial scenarios are 8/10, and whole CAD and core readiness **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
