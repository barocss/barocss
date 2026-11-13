# D1051 — requalify the Model tool rail and projected corner reach

2026-11-14 · SMALL · P0 desktop QA, rows 09, 20 and 21 · [#2487](https://github.com/barocss/barocss/issues/2487)

Current production source retains the D687 Model rail and D1041 projection framing. Extend the desktop driver to click all four projected corners. No production source changes.

- **PASS** In desktop WebGPU at 1024 × 800 with Chat closed and 1280 × 800 with Chat open, Sketch and Extrude have visible names. A closed 40 × 24 mm rectangle extrudes to 12 mm and 11,520 mm³. A face exposes Hole and an edge exposes Fillet. Both open and cancel. Group and command search controls remain available. Box vertex reach before and after Frame all passes.
- **PASS** At 1024 × 900, Front → Project to sketch on a pocket plate leaves four distinct corners selectable without panning. Their leftmost x is 163.66 CSS px and the rail ends at x=100. When panning deliberately puts the first corner at x=98, the rail owns the click and the sketch remains unselected. The source document stays exact.
- **PASS** Visual review, eight focused tests, driver syntax and diff checks. Both passing runs have zero downloads, page errors, console errors and source changes.
- **FAIL** The first four-corner driver kept the fourth corner selected before its blocked-click control. Clear selection before panning. The corrected replay passes on the same product source.
- **NOT_RUN** Arbitrary projection profiles, full suites, production build, WebGL2 and mobile.

#2487 meets its desktop criteria. Desktop QA reaches 17/54 on issue closure. Initial scenarios are 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
