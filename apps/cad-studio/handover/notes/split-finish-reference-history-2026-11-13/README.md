# D996 — restore held reference choices with Undo and Redo

2026-11-13 · SMALL · P0 rows 05, 15, 16 and 21 · [#2445](https://github.com/barocss/barocss/issues/2445)

- **FAIL, baseline** Undo restored the held Fillet geometry and document, but the References panel and its candidate disappeared.
- **PASS, fixed** Desktop WebGPU Studio restored the same held document, two unmodified solids and exact candidate text and actions on Undo for Fillet and Chamfer. Redo restored the confirmed edge, signature and geometry and closed the choice.
- **PASS** Actual project Save wrote the exact confirmed native documents to browser storage. After reload, project Open restored both finishes with the same geometry and no reference choice.
- **PASS** Visual review, 35 focused Studio tests, Studio type-check, driver syntax and diff check.
- **NOT_RUN** Live Split/linked inset edits, History direct repick, Draft/Flange/Hole, standalone Save, WebGL2, production build, full suites and mobile.

Reference problems are owned by the exact accepted document. History can reuse that ownership while an unrelated document cannot inherit it. Candidate confirmation retires after Open, worker or evaluation changes. Desktop issue acceptance remains 7/54. Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
