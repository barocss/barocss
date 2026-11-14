# D1187 — Show native scope for varying circular Fillet

2026-11-14 · FULL · P0 desktop QA, rows 07 and 21 · [#2466](https://github.com/barocss/barocss/issues/2466)

Successful varying circular Fillet previews use the native original-target report. The HUD labels both radii as the picked start and end radii. Those positions belong to the selection. A tangent continuation can extend the finished path past them. The authored document keeps the picked native names and both endpoint constraints.

| Result | Check |
| --- | --- |
| FAIL | Parent Studio accepted the open-edge varying preview but did not display the native scope. Two early mutation runs stopped on navigation timeouts. |
| PASS | Current desktop Studio picked the original 40 mm straight edge of a 40 × 30 × 10 mm box and showed one picked native target, zero additions, and picked radii R1 to R3. The four-edge closed stadium rim refused unequal endpoint radii and did not allow Apply. Root checked the open preview screenshot. |
| PASS | Apply, Undo, Redo and fresh Open preserved the accepted result. The strict-valid solid had volume 11962.802348322295 mm³ against independent linear-radius integration at 11962.802348322224 mm³. Four native contact points at the two ends distinguish radius direction within 1e−7 mm. The successful native rolling-ball report named the same original edge. |
| PASS | Injecting a different original-target name into the current worker result retained the geometry and suppressed the unverifiable scope. The detector produced the expected assertion failure. The latest unmodified run passed on the same frozen source. |
| PASS | Sol High geometry audit, Kernel 16/16 and Studio 19/19 focused tests, all three type checks, scoped lint, browser-script syntax, D1185 desktop removal regression and production build. |
| NOT_RUN | Successful varying-radius extension beyond a picked endpoint in desktop Studio, conic and G2 sections, full suites, CI and mobile. |

Keep #2466 open for the Edges-filter face fallback and the three-picked-plus-one-added Studio control. Desktop QA is **29/54 (54%)**. Initial scenarios are **8/10 (80%)**. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
