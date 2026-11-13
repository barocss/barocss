# D964 — protect a Box draft at native File Open

2026-11-13 · SMALL · P0 rows 12, 15 and 16 · [#2439](https://github.com/barocss/barocss/issues/2439)

- **FAIL on parent** Opening a valid native file replaced the document and removed the unapplied Box with Width X 48 mm and Height Z 18 mm without confirmation.
- **Change** Validate the native file first, then ask the existing draft dialog to authorize adoption. Recheck the original Open, document and Worker owner before accepting. Capture the prior field focus when the person clicks Open.
- **PASS** Desktop Studio Keep editing and Escape retained the Box values, preview status, selection, document, accepted bodies, history and dirty flag. Focus returned to Height Z. Discard changes closed the Box and opened the exact replacement with its own title. Visual review confirmed the restored field focus.
- **PASS** 49 focused Studio checks, Studio type-check, driver syntax and diff check. No page errors, console errors or downloads.
- **NOT_RUN** Project-list and exchange import draft transitions, picker behavior, New part, template, Model history, Cmd+S, 3D Sketch, in-place Cancel, Mate, build, full suites and mobile. The broader issue stays open.

Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
