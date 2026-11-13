# D1156 — Disclose separate solid pieces in 3MF export

2026-11-14 · FEATURE · P0 desktop QA, rows 07 and 13 · [#2464](https://github.com/barocss/barocss/issues/2464)

For each visible upright body with disconnected native solid pieces grouped in one 3MF mesh object, report the object count and disclose the grouped solid pieces. Use the current export's visibility and occurrence looks. Keep the existing 3MF object grouping, including the separate objects for edge or point contact.

| Result | Check |
| --- | --- |
| FAIL | The original Studio notice described the 2 mm gap case as one body. The actual 3MF had one mesh object and two separate closed 500 mm³ components. |
| PASS | The notice now reports one object, 24 triangles, and two separate solid pieces. Public export from desktop Studio and an independent Python ZIP/XML reader verified all three files. Face contact produced 1 object, 1 closed component, 12 triangles and 1000 mm³. Edge contact produced 2 objects and 2 closed 500 mm³ components. The 2 mm gap produced 1 object and 2 closed 500 mm³ components. The reader checked exact bounds, opposing edge pairs, millimetres, build object IDs and volumes within 1e−7 mm³. |
| PASS | Visual review, Studio shown Variant export with pending placed-body refusal, 39 Model and 16 Studio focused tests, both type checks, production build, scoped lint, driver syntax and diff check. |
| NOT_RUN | Multiple grouped objects in Studio, non-upright grouped solids, external slicer import, full suites and mobile. |

Keep #2464 open. D1157 reproduces an ordinary sketch on a native pocket floor after a source Cut depth edit. Desktop QA remains **25/54 (46%)**. Initial scenarios remain **8/10 (80%)**. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and hashes](qualification.json).
