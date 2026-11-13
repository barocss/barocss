# D967 — protect an unapplied feature edit at Edit part Cancel

2026-11-13 · SMALL · P0 rows 10, 15 and 16 · [#2439](https://github.com/barocss/barocss/issues/2439)

- **FAIL on parent** Cancel left the shared Cube 2 part and silently discarded the unapplied 28 mm Distance when the accepted part had no changes.
- **Change** Route Cancel with an unapplied draft through the existing confirmation. The prompt covers changes to the part. The existing confirmation for applied changes still handles sessions without an unapplied draft.
- **PASS** Desktop Studio Keep editing retained the 28 mm value, exact accepted 20 mm cube, assembly context, selection, part history and dirty state. Focus returned to Distance. Explicit discard restored the exact original assembly with both instances.
- **PASS** Visual review, 23 focused Studio checks, Studio type-check, syntax and diff check. No page errors, console errors or downloads.
- **NOT_RUN** Mate, other Open and feature entry points, build, full suites and mobile. #2439 remains open.

Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
