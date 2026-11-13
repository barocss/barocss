# D1002 — preserve the open document when a Hole loses its Split face

2026-11-13 · SMALL · P0 rows 08, 15, 16 and 21 · [#2445](https://github.com/barocss/barocss/issues/2445)

- **FAIL, baseline** File Open adopted a document whose blind Hole named the missing Split face `n2.cut.side1`. The title changed and Studio displayed the previous geometry with an evaluation failure.
- **PASS, fixed** Actual desktop WebGPU Studio refused the damaged File Open before adoption and named the original face. The current document, title, dirty state, selection, geometry and Undo/Redo were retained. The valid corrected file opened normally. Project Open refused the same damaged bytes in browser storage and opened the valid project file.
- **PASS** History moved the same Split face from X24 to X30 and retained the blind bore. Reversing the normal at X30 removed the face. Live Apply refused and preserved the current document and history. Independent cylinder removal and first-moment checks matched the two volumes and bore centroid.
- **PASS** Visual review, 14 focused Studio tests, Model and Studio type-check, driver syntax and diff check. Review found that old `face: null` files treat the field as unnamed. A string check and regression preserve that path. GPT-6.1 Sol High reviewed the geometry and admission scope.
- **FAIL, earlier type-check** The suppressed fixture widened `true` to `boolean`. A contextual `StudioDoc` type corrected the fixture.
- **NOT_RUN** Other missing Hole face kinds, pattern-copy and downstream failures masked by an earlier evaluation error, kernel alias semantics, production build, full suites and mobile.

The preadoption check applies when the first full-history kernel refusal names the exact missing face of an active direct Split-cap Hole. It leaves the native Hole data and reference-matching rules intact. Desktop issue acceptance remains 7/54. Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
