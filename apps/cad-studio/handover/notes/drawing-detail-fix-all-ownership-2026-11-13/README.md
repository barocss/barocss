# D980 — protect annotated empty details during Studio Fix all

2026-11-13 · SMALL · P0 rows 07 and 21 · [#2442](https://github.com/barocss/barocss/issues/2442)

- **FAIL on parent** Fix all on the second sheet removed Detail B, its diameter and the attached frame. The standalone frame remained without its original view. The result reported three fixes and no issues.
- **Change** Use the whole drawing to identify annotated details that are unavailable on the active sheet. Skip their removal and the destructive fixes for their dimensions and frames in Studio Fix all. The result names the preserved detail and lists the remaining issues. Single removal of a missing parent detail uses the existing protected Remove action.
- **PASS** Desktop WebGPU Studio preserved Detail B, the Ø12 diameter record, both frame records and the Sheet 2 assignment. The result reported zero fixes and three unresolved issues. Switching from Sheet 2 to Sheet 1 and back preserved the exact document. The missing dimension remained reported.
- **PASS** Visual review, 19 focused drawing checks, Studio type-check, driver syntax and diff check. No page errors, console errors or downloads.
- **NOT_RUN** Repair from the split detail sheet, save/reopen, SVG/DXF/PDF exports, CLI/MCP drawing fixes, WebGL2, production build, full suites and mobile. #2442 remains open.

Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
