# D969 — keep an unapplied feature at Project Open

2026-11-13 · SMALL · P0 rows 12, 15 and 16 · [#2439](https://github.com/barocss/barocss/issues/2439)

- **FAIL on parent** Opening a different native part from Project documents discarded the unapplied 4 mm Distance. The first harness attempt used a Box command, for which the existing Studio hides the Project list. The reproducing run used the visible feature editor.
- **Change** Confirm the current draft after validating the project file. Keep editing leaves the active path and Save receipt scope in place. Discard rechecks the original Open owner before publishing the new document and path.
- **PASS** Desktop Studio retained 4 mm, the accepted bodies, original title and project path, selection, history and dirty state after Keep editing. Focus returned to Distance. Explicit discard opened the 7 mm replacement and changed its active path. The actual D958 Save regression also passed and retained the exact B bytes.
- **PASS** Visual review, 65 focused Studio checks, Studio type-check, driver syntax and diff check. Both passing runs had zero page errors, console errors and downloads.
- **NOT_RUN** Exchange Open, alternate feature entry points, build, full suites and mobile. #2439 remains open for the remaining acceptance review.

Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
