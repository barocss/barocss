# D968 — preserve a Mate draft during a feature history request

2026-11-13 · SMALL · P0 rows 10, 15 and 16 · [#2439](https://github.com/barocss/barocss/issues/2439)

- **FAIL on parent** Selecting the base Extrude from History discarded the active Distance mate and the Base part XY plane reference without confirmation.
- **Change** Use the current Mate draft identity for the existing draft confirmation before the History action clears the Mate. A changed draft cannot authorize the earlier request.
- **PASS** Desktop Studio Keep editing retained the Distance type, Base part XY plane, selection, accepted document, bodies, history and dirty state. Focus returned to Mate type. Explicit discard opened the requested feature with the assembly unchanged.
- **FAIL** The first fixed run reached the expected Studio state but the worktree watcher detected changes in decision files. The frozen repeat passed with no source changes, page errors, console errors or downloads.
- **PASS** Visual review, 43 focused Studio checks, Studio type-check, syntax and diff check.
- **NOT_RUN** Other feature entry points, Project-list and exchange Open, production build, full suites and mobile. #2439 remains open.

Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
