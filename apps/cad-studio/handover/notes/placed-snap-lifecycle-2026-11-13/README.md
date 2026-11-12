# D885 — Verify placed snap visibility and document replacement

P1, rows 09, 10 and 16. SMALL qualification for [#2333](https://github.com/barocss/barocss/issues/2333). The existing product passes the selected snap lifecycle. This decision adds desktop regression coverage.

| Result | Check |
| --- | --- |
| PASS | The left occurrence's Appearance Details Visible checkbox hid body `b1` while the occurrence itself stayed enabled. Its endpoint became unavailable and the independent right midpoint stayed available. |
| PASS | Rev B with a zero-height Extrude produced a genuine failed placed Worker response. While the response was held, the old mesh stayed visible and supplied no snap. Delivery reached the original callback and removed the failed mesh. The old endpoint click used the grid at (10, 14) mm. The right midpoint and accepted document stayed intact. |
| PASS | Removal and New retired the left and then the remaining occurrence. A separate direct File Open replaced a sketch with a visible old cue. The new file reused both occurrence IDs and body key `b1`. The old cue was gone, the old point had no candidate and only the new left position supplied End. |
| PASS | A double Finish click created one Rectangle. One Undo restored the replacement document and Redo restored the sketch. The accepted corners (35.25, 14.25) and (65.75, 34.25) mm made a valid 1,220 mm³ native Extrude. Moving the left source to X = 38.25 mm kept the root nodes and native outputs exactly equal. |
| PASS | Independent review, 41 focused Model tests, 21 focused Studio tests, both driver syntax checks and diff check. The final actual desktop run recorded 10 states and retained 841 inputs through cleanup. D882–D884 supply the translated, rotated, revision and project Save/fresh Open evidence. |
| FAIL | Adjacent finding. The current Rev B error notice was correct on failure, then stayed visible after Undo to Rev A, Remove, New and direct Open of a healthy assembly. The failed source was absent in those states. D886 will scope placed evaluation notices to their current source. |
| NOT_RUN | Polygon, a placed reply held across same-ID Open, a dedicated coincident-point tie or 0.0001 mm rounding desktop case, build, full suites and mobile. |

The first [#2333](https://github.com/barocss/barocss/issues/2333) acceptance is satisfied for ordinary desktop root Rectangle, visible top-level static native rectangular extrusions, and exact Z quarter-turns. The change introduces no persisted external reference. Dedicated candidate ties and input rounding retain the existing source rules. The adjacent stale notice is a separate reliability finding. Initial scenarios remain **8/10**. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt digests](qualification.json).
