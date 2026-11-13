# D993 — protect project Save and Make version after a model failure

2026-11-13 · SMALL · P0 rows 15 and 21 · [#2444](https://github.com/barocss/barocss/issues/2444)

- **FAIL, baseline** Studio opened a browser project file with a suppressed R4 source and an active dependent R0.5 Fillet. Save rewrote its native bytes and Make version retained the failed document.
- **PASS, fixed** Desktop WebGPU Studio refused Save in the failed full view and refused Save and Make version from a valid rollback prefix. The notice included the missing edge. The original file stayed byte-identical and no version log was written. The document, visible rollback, selection, history, file name and dirty state remained exact.
- **PASS** Unsuppressing the source repaired the chain. Save and Make version persisted the repaired document and the named version, both verified after a fresh page reload and project Open. The first fixed run matched a generic error phrase and stopped at the more specific missing-edge notice. The final driver verifies that exact reason.
- **PASS** Visual review, 9 Save ownership tests, Studio type-check, driver syntax and diff check.
- **NOT_RUN** Native file Save outside a project, Save Shared, invalid placed children, Drawing PDF, WebGL2, production build, full suites and mobile.

The Save family checks the full authored root when the current result does not prove it. A completed check is retired after a document dispatch, project Open, worker replacement or file rename. Desktop issue acceptance remains 6/54. Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
