# D1027 — draw the applied Assembly Cut

2026-11-13 · FEATURE · P0 rows 05, 13, 16 and 20 · [#2448](https://github.com/barocss/barocss/issues/2448)

The Drawing workspace took its root from a base-part evaluation that could outlive a cut edit. Its worker also stripped cut inputs. Take the applied cuts from the current document, carry them in drawing requests, and include them in the drawing model key and assembly sheet source stamp. Part scopes continue to read their own source. The general revision hash still serves existing project and version files.

- **FAIL** On the baseline, the applied sheet and its SVG had zero visible Top bore arcs. The stock and unapplied creation draft matched.
- **PASS** Desktop Studio and its SVG agree in Front, Top, Right and Iso across eight captures. Stock, pending Ø8 and Undo show no bore. Applied Ø8, Redo, pending Ø12, edit Cancel and fresh browser Project reopen show the Ø8 bore. Top's two semicircles meet at radius 4 mm and centre [30, 20]. Iso carries the expected ellipse. Front and Right each contain four hidden generators split at Z=5 mm. The base outline stays 90 × 80 mm and the SRC stamp changes with Apply.
- **PASS** Independent native projection and SVG review confirm the stock/applied geometry. Visual inspection, 65 Model tests, 26 Studio tests, both type-checks, driver syntax and diff check pass.
- **NOT_RUN** Dedicated PMI and section-view browser checks, other cut profiles and targets, PDF/DXF export, production build, full suites and mobile.

D1028 checks the Ø12 edit draft in STEP before #2448 closes. Desktop QA stays at 9/54, initial scenarios at 8/10, and whole CAD and core readiness **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
