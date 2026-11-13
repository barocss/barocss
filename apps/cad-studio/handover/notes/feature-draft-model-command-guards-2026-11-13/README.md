# D965 — protect a Box draft at New part, templates and Model Undo

2026-11-13 · SMALL · P0 rows 12, 15 and 16 · [#2439](https://github.com/barocss/barocss/issues/2439)

- **FAIL on parent** New part discarded the active Box with 48 mm width and 18 mm height without a prompt.
- **Change** Route New part, template adoption and Model history replay through the existing draft confirmation. Keep the existing text input and sketch history paths. Defer template adoption and camera fit until confirmation.
- **PASS** Desktop Studio Keep editing retained the Box inputs, preview, selection, accepted document, bodies, history and dirty state after New part, toolbar Undo and a template request. Focus returned to Height Z. Explicitly discarding for the empty template produced the new Untitled document once.
- **PASS** Actual Cmd+S from the focused draft field emitted the exact accepted native document and filename at the browser delivery boundary. The draft values, preview and focus stayed active. Visual review confirmed retained input and focus.
- **PASS** 27 focused Studio checks, Studio type-check, driver syntax and diff check. No page errors, console errors or downloads.
- **NOT_RUN** Other template and history variants, 3D Sketch exit, in-place Cancel, Mate, production build, full suites and mobile. #2439 remains open.

Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
