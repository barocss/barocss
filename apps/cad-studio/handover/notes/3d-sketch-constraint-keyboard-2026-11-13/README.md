# D972 — keep 3D Sketch constraint focus and native control keys

2026-11-13 · SMALL · P0 rows 09, 15 and 21 · [#2440](https://github.com/barocss/barocss/issues/2440)

- **FAIL on parent** After an actual 30 mm segment was constrained to 24 mm, Enter replaced the focused Length input. A second Enter applied the entire sketch to the document.
- **Change** Keep the constraint input mounted while its value changes. Skip unchanged or invalid constraint updates. Leave Enter and Space on focused controls and Tab on focusable controls to the browser.
- **PASS** Desktop Studio retained 24 mm and Length focus through two Enter presses, with the accepted document unchanged. Tab and Shift+Tab moved focus between Line and Select with XY unchanged. Shift+Enter activated Cancel and left the accepted document exact. No page errors, console errors or downloads.
- **PASS** Visual review, 20 focused Studio checks, Studio type-check, driver syntax and diff check.
- **NOT_RUN** Hidden editor input and history, Mate and Hole activation, Delete confirmation, WebGL2, project reopen, production build, full suites and mobile. #2440 remains open.

Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
