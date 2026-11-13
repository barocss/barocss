# D970 — protect a Box draft after STEP validation

2026-11-13 · SMALL · P0 rows 12, 15 and 16 · [#2439](https://github.com/barocss/barocss/issues/2439)

- **FAIL on parent** Opening the retained STEP part replaced the current document and discarded a Box preview without confirmation.
- **Change** After a successful STEP read, use the existing draft confirmation before adoption. Check the original Open owner again before replacement and publish STEP success only after acceptance.
- **PASS** In desktop Studio, Keep editing and Escape retained Width X 48 mm, Height Z 18 mm, preview, selection, document, history and dirty state. Focus returned to Height Z. Discard adopted one solid and retained the exact STEP source. The Worker volume agreed with the box-minus-bore calculation within 1e-7 mm³.
- **PASS** Visual review, 39 focused Studio checks, Studio type-check, driver syntax and diff check. No page errors, console errors or downloads.
- **NOT_RUN** Other exchange routes, alternate feature entry points, production build, full suites and mobile. #2439 stays open for the remaining feature entry points.

Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
