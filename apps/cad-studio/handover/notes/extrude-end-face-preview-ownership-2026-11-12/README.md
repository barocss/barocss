# D845 — Qualify delayed Extrude to face results

P1, rows 07, 08 and 16. SMALL evidence-only item for the D841 command. Desktop WebGPU uses a 10 × 10 mm source and two native target caps at Z20 and Z30. The driver holds four successful replies from the actual preview Worker and sends Enter while the HUD is evaluating.

| Result | Check |
| --- | --- |
| PASS | The control delivers the held reply without changing the target. The queued Enter commits once to `n1.bottom`, producing 20 mm and 2000 mm³. First Undo restores the source. |
| PASS | A real pick of `n3.bottom` replaces `n1.bottom` before the old reply arrives. The accepted state stays exact until explicit Apply. Eight sampled frames show only the two source bodies or the current 30 mm preview. One explicit Apply produces 3000 mm³. Both native target bodies stay separate. The control and the re-pick each have 24 exact native corners. |
| PASS | Cancel closes the HUD before the held success arrives. Seven sampled frames retain the two source bodies. The accepted document, geometry, selection, dirty state and history stay exact. |
| PASS | Open replaces the source with the same IDs and two new cap positions at Z42 and Z55. Delivering the old success leaves the replacement exact. Five sampled frames retain the replacement's two bodies. First Undo restores the original source. |
| PASS | Model 11/11, Studio 50/50, Model types, driver syntax, diff check and root visual review pass. |
| FAIL | The first driver treated the expected current preview tint as part of accepted body state. The corrected comparison checks accepted geometry and tint separately. |
| NOT_RUN | Other renderers, independent STEP in this item, full suites, fresh Studio type check and production build, mobile and other browsers. |

[Issue #2308](https://github.com/barocss/barocss/issues/2308) remains open. D846 reads the actual STEP bytes for one bounded bound-extrusion profile using the existing independent Part 21 reader and checks Studio Open and the history loss disclosure. Initial scenarios remain 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and receipt digests](qualification.json).
