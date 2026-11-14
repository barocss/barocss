# D1196 — Keep a straight linked Path cut through decimal Stretch

2026-11-14 · FEATURE · P0 desktop QA, rows 09 and 21 · [#2468](https://github.com/barocss/barocss/issues/2468)

The Path cut planner measures distance along the curve. For a linked multi-span quadratic with unit weights and double interior knots, each ordered middle pole can prove the same straight locus as its segment endpoints. A non-midpoint span must be exactly axis-aligned, with identical transverse coordinates. The planner can then use a temporary linear path. Studio retains the original quadratic curve and object ID. Raw paths retain their strict midpoint rule. This accepts exact geometric equivalence for any ordered middle pole on the qualifying axis segment, without a geometric tolerance.

| Result | Check |
| --- | --- |
| FAIL | The parent refused X Stretch 0.8 from the 48 mm path even though the result was 41.6 mm and the cuts required 32 mm. Its first pole pair summed to 16.000000000000004 and the doubled middle pole was 16. The first implementation also needed an explicit tuple type for the midpoint check. |
| PASS | Studio accepted the 41.6 mm path. The original quadratic and linked feature recipe persisted. The real 12 mm path still refused, with no accepted edit or extra Undo entry. Undo/Redo restored the original, 48 mm and 41.6 mm states. |
| PASS | Fresh-context Studio Open retained the linked Path, Spacing 8 and Count 5. Native volume 23,600 mm³, centroid (30.08949152542373, 20.164745762711863, 5) mm and all 20 named cut walls matched independent stock-minus-prism and boundary checks within 1e-7. The final cut starts at (33.6, 14.4) mm. The native shape was strict-valid. |
| PASS | Model 16/16, including raw midpoint refusal, an off-axis deviation of 1e-12 mm, a middle pole beyond its segment and native file codec round-trip. Both type checks, scoped lint, driver syntax, production build, diff and frozen-source checks passed. |
| NOT_RUN | In-product Save command, opening the new file in earlier releases, arbitrary non-axis non-midpoint spans, full suites, CI and mobile. |

Keep #2468 open for earlier-source authoring and remaining reference acceptance. Desktop QA is **29/54 (54%)**. Initial scenarios are **8/10 (80%)**. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
