# D994 — refuse Drawing PDF when a fit row is missing

2026-11-13 · SMALL · P0 rows 07, 15 and 21 · [#2444](https://github.com/barocss/barocss/issues/2444)

- **FAIL, baseline** Actual Studio restored a native drawing with a missing Ø8 H7 row. The sheet reported FIT_ROW_MISSING, but the PDF contained only “Ø8 THRU H7” without an unresolved-limits notice.
- **PASS, fixed** Export PDF refused that drawing and directed the user to load the required row. It also refused from Sheet 1 when only the unselected Sheet 2 had the missing fit. The notice identified the sheet and missing class and size. No PDF bytes were delivered for either refusal.
- **PASS** Loading the covering H7 estimate through Library enabled a current one-page A3 PDF. Poppler checked page metadata and a separate parser read its actual text. The PDF retained Ø8 and the estimate marker. It printed +0.015/+0.001 mm within the authored 0 to +0.015 mm interval. The driver uses an inward interval check because the output may quantize the lower end.
- **PASS** Visual review, 11 focused model tests, Studio type-check, driver syntax and diff check.
- **NOT_RUN** PDF raster comparison, unresolved-fit export via public APIs, SVG/DXF policy changes, WebGL2, production build, full suites and mobile. The B06 PDF standards HOLD remains.

The PDF action checks the rendered diameter dimensions of every sheet before writing any bytes. Desktop QA acceptance is tracked in #2492. Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
