# D1000 — show the correct Hole centre axes in History

2026-11-13 · SMALL · P0 rows 08, 15, 16 and 21 · [#2445](https://github.com/barocss/barocss/issues/2445), checklist line 399

- **FAIL, baseline** Actual desktop WebGPU Studio showed Centre X and Centre Y for an X-axis through hole. The 12 mm and 7 mm values were the Y and Z coordinates of the bore.
- **PASS, fixed** Studio File Open and History show Y/Z for X-axis holes, X/Z for Y-axis holes, and X/Y for older files with no stored axis. Creation and History use the same coordinate order. The saved fields retain their existing keys and order.
- **PASS** On each axis, edit the second coordinate from 7 to 9 mm, then Undo and Redo. The three accepted documents change only the second centre value. Twelve Studio states match the independent cuboid-minus-cylinder volume and centroid oracle. Maximum errors were 5.10e-11 mm³ and 3.78e-14 mm. No browser or console errors occurred.
- **PASS** Visual review, 3 focused Model tests, the Studio chat Hole edit regression, Model and Studio type-check, driver syntax and diff check.
- **FAIL, existing** The Studio chat file passed 27 of 28 checks. The Mirror schema assertion expects the sheet-only `result` field in a solid context. A separate replay with the three pre-change source files reproduces the same assertion.
- **NOT_RUN** Draft and Flange comparison, Hole face rematch, production build, full suites and mobile.

Desktop issue acceptance remains 7/54. Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
