# D966 — confirm the final Escape from a changed 3D sketch

2026-11-13 · SMALL · P0 rows 09, 15 and 16 · [#2439](https://github.com/barocss/barocss/issues/2439)

- **FAIL on parent** Drawing two points and one segment, ending the line with Escape and pressing Escape again silently discarded the whole 3D sketch. Two earlier harness attempts used the wrong command entry. The reproducing run used the public palette from the viewport.
- **Change** The final Escape asks the existing draft dialog to close a changed 3D sketch. Local Escape for the active chain, axis and selection keeps its existing order. The final closure checks ownership of the pending sketch session.
- **PASS** Desktop Studio kept both points, the segment, exact viewport markup, the document, selection, history and dirty flag after Keep editing. Focus returned to the XY control. Explicit discard ended the same session and left the empty accepted document.
- **PASS** Visual review, 20 focused Studio checks, Studio type-check, driver syntax and diff check. No page errors, console errors or downloads.
- **NOT_RUN** Existing skeleton edit, remaining 3D Sketch keyboard ownership, in-place Cancel, Mate, production build, full suites and mobile. #2439 remains open.

Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
