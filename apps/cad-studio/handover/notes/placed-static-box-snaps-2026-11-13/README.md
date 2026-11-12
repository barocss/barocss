# D882 — Snap a root rectangle to current placed box edges

P1, rows 09, 10 and 16. FEATURE qualification for [#2333](https://github.com/barocss/barocss/issues/2333).

A new ordinary root Rectangle can snap to the visible straight endpoints and midpoints of a top-level static translated native rectangular extrusion. The candidate binds the accepted occurrence, its rendered body and its unmerged native vertices. The code reads world coordinates from the rendered edge once. It rejects stale evaluation, hidden sources and excluded display poses. The existing plane test uses 0.001 mm and the existing pointer input rounds to 0.0001 mm. The result is ordinary sketch coordinates.

| Result | Check |
| --- | --- |
| FAIL | D881 baseline. The placed cues were absent and the grid corners (10, 14) and (66, 34) produced 2,240 mm³. |
| PASS | Actual desktop Studio WebGPU. Root End and Middle and all four placed cues appeared. Placed cue anchors matched the projected points within 0.02 CSS px. Endpoint disabled, 3 mm off plane, explode and hidden occurrence controls excluded the applicable candidates. |
| PASS | Rectangle stored (10.25, 14.25) and (65.75, 34.25) mm. Native 2 mm Extrude produced 2,220 mm³ and the eight expected corners. Undo/Redo and a 3,153-byte browser project Save and fresh Open retained the result and both source occurrences. Native checks used 1e-8. |
| PASS | A real left placement edit moved X from 10.25 to 35.25 mm. With the original successful Worker reply held, the old mesh remained visible, the old and pending left cues were absent, and the right midpoint stayed current. An actual click at the old endpoint used (10, 14) mm grid fallback and did not mutate the document. After release, the new left endpoint and unchanged right midpoint produced 1,220 mm³. |
| PASS | Independent source review, Model and Studio focused tests and type checks, Studio build, scoped lint, driver syntax and diff check. Existing object-snap controls and Arc Extension completed desktop regression flows. |
| NOT_RUN | Exact co-located placed endpoint in an Arc Extension desktop fixture, rotation, other source shapes, replacement after source revision, broader occurrence lifecycle, full suites and mobile. |

Initial desktop attempts found two test driver faults. The midpoint triangle's bounding-box center differed from its anchor by 0.5 CSS px. The Corner X/Y fields include the unit in their accessible names. The final driver checks the triangle anchor and the panel's field IDs. Independent source review also found that placed candidates could interfere with Arc Extension. Both dedicated extension stages now keep their prior candidate set.

[#2333](https://github.com/barocss/barocss/issues/2333) remains open. The next slice checks a Z quarter-turn against independent world coordinates. Initial scenarios remain **8/10**. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt digests](qualification.json).
