# D1029 — reserve occurrence ids named in saved drawings

2026-11-13 · SMALL · P0 rows 10, 12 and 20 · [#2449](https://github.com/barocss/barocss/issues/2449)

The shared part allocator reserves occurrence ids still named by saved drawing scope, dimensions and datum geometry. Existing stored references stay in place when their occurrence is removed.

- **FAIL** After deletion of the dimensioned copy `inst1`, desktop Studio assigned `inst1` to a new duplicate and to a different inserted part. The same saved dimension resolved to Ø12 on the duplicate and Ø8 on the inserted part. SVG and Project reopen reproduced the reassignment.
- **PASS** With the allocator change, both replacement actions assign `inst2` in their respective history branches. The saved edge still names `inst1` and stays lost in the sheet and absent from SVG. Undo of the original removal restores its Ø12. Redo restores the lost state. Duplicate Undo/Redo and fresh Project reopen keep the original saved reference.
- **PASS** Nine desktop Drawing/SVG captures, visual review, 37 Model tests, 17 Studio tests, both type-checks, driver syntax and diff check.
- **NOT_RUN** Overlapping rim choice, Hidden lines selection, explicit reattachment, loss warnings before export, DIMENSIONS deletion after Redo, other export formats, production build, full suites and mobile.

#2449 remains open. Desktop QA is 10/54, initial scenarios are 8/10, and whole CAD and core readiness **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
