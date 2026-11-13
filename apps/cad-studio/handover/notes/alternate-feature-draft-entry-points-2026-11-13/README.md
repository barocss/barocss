# D971 — protect drafts on History menu and Browser feature edits

2026-11-13 · SMALL · P0 rows 15, 16 and 21 · [#2439](https://github.com/barocss/barocss/issues/2439)

- **FAIL on parent** The History context menu's Edit action replaced an unapplied 4 mm Distance without confirmation. The first harness run supplied a noncanonical translated output key. The reproducing run used its canonical key.
- **Change** Check the draft before the History menu edit actions or a Browser feature row changes the editor or selection. Retain the original focus from the History context-menu trigger and the Browser row pointer.
- **PASS** In desktop Studio, Keep editing on both routes retained the 4 mm Distance, accepted geometry, current document, dirty flag, selection and history. Focus returned to Distance. Explicit discard from the Browser opened the requested 5 mm feature and selected its body.
- **PASS** Visual review, 45 focused Studio checks, Studio type-check, driver syntax and diff check. No page errors, console errors or downloads. With D963–D970 this covers the reported #2439 desktop draft transitions.
- **NOT_RUN** Other exchange formats, other direct-edit controls, folder projects, WebGL2, production build, full suites and mobile.

Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
