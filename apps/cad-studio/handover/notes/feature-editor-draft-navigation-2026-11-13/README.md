# D963 — protect unapplied feature editor inputs on navigation

2026-11-13 · SMALL · P0 rows 12, 15 and 16 · [#2439](https://github.com/barocss/barocss/issues/2439)

- **FAIL on parent** Entering Render and returning to Model restored the accepted 2 mm Distance and lost the unapplied 4 mm entry.
- **Change** The feature editor reports its current draft identity to the existing workspace exit dialog. The protected transitions are Render, Sketch and a different feature in the history bar. Drawing retains the feature editor; its existing command draft protection remains in use.
- **PASS** Desktop Studio Keep editing preserved 4 mm, the current document, selection, history, dirty flag and Distance focus for each transition. Escape preserved a temporarily empty Distance field. Discard opened the second feature at 5 mm; reselecting the first displayed the original 2 mm.
- **PASS** The existing actual Box workspace flow also passed. Visual review confirmed the restored focus and value. Both browser runs recorded zero page errors, console errors and downloads. 69 focused Studio checks, Studio type-check, syntax and diff check passed.
- **NOT_RUN** Valid File Open, other feature entry points, New part, template, Model Undo, Cmd+S, 3D Sketch, in-place Cancel, Mate, production build, full suites and mobile. Keep #2439 open for the remaining transitions.

Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
