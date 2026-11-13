# D1139 — Refuse fractional Circular Pattern Count in history

2026-11-14 · SMALL · P0 desktop QA, rows 09 and 21 · [#2461](https://github.com/barocss/barocss/issues/2461)

The history editor displays the whole-number range accepted by a stored circular pattern. The Model setter retains the old nodes on invalid values. The creation HUD retains its existing creation limits.

| Result | Check |
| --- | --- |
| FAIL | Parent Studio left Apply active with Count 2.5 on the stored Z pattern. The existing Model control expected the setter to round a fractional value. |
| PASS | Desktop history kept Count 2.5 visible, displayed the native stored range 1–64 and disabled Apply and Enter. The accepted three-copy document stayed exact. Count 4 kept the 180° spread, changed step to 60° and produced 960 mm³. Undo/Redo passed. |
| PASS | The Box Distance and constant Fillet Radius controls remained empty and blocked Apply. Reset restored the original values without changing the documents. The D1138 rectangular Extrude control also passed. |
| PASS | 20 focused Model tests, Studio and Model type checks, production build, scoped lint, driver syntax and diff check. |
| NOT_RUN | 3D Sketch zero Length, all count-driven features, full suites and mobile. |

#2461 remains open. Desktop QA is **23/54**. Initial scenarios are **8/10**. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
