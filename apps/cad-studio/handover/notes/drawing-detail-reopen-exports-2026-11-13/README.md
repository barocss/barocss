# D982 — qualify the repaired split Detail on reopen and export

2026-11-13 · SMALL · P0 rows 07 and 21 · [#2442](https://github.com/barocss/barocss/issues/2442)

- **PASS** Desktop WebGPU Studio moved the split Detail, undid and redid it, saved the exact repaired document, then opened it in a fresh Chrome context. The reopened document retained both sheets, Detail B at 2:1, Ø12 and both geometric frames.
- **PASS** ElementTree read the parent and detail A3 SVGs and checked the sheet link, two 12 mm paper-radius arcs, dimension text and both frame values. ezdxf 1.4.5 read DXF 2000 with millimetre units, exact nominal Ø12 and both frame values, with zero audit errors or repairs. Poppler and a PDF stream reader checked two A3 pages and the expected callouts, diameter and frame values on their owning pages.
- **PASS** Studio visual review, driver syntax and diff check. No product source changes, page errors or console errors. Local Save and export bytes were captured before browser delivery.
- **OPEN** The fresh Open Browser also reported two candidate edges for the diameter while the drawing and all three export formats resolved it. Retain the original reference and determine whether the warning indicates an ambiguous authored reference before closing #2442.
- **NOT_RUN** PDF raster visual review (local Fontconfig unavailable), standards-level PDF qualification, WebGL2, type-check, production build, full suites and mobile.

Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
