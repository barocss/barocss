# D1154 — Refuse an empty upright Extrude Cut before Apply

2026-11-14 · FEATURE · P0 desktop QA, rows 07 and 21 · [#2464](https://github.com/barocss/barocss/issues/2464)

The new Cut command carries the terminal Difference's stable feature ID into its current Worker preview. For the selected zero-draft upright solid result, re-evaluate that terminal operation as a native intersection using the preview's cached operands. A successful empty intersection blocks Apply and Enter. The probe adds no Worker request, mesh transfer or mass integration. Generic Difference algebra and saved files retain their behavior. Unsupported or failed probes do not certify emptiness. A Cut that consumes its whole target is a separate case and is not inferred empty.

| Result | Check |
| --- | --- |
| FAIL | Original Studio accepted an entirely disjoint 2 mm Cut and appended Difference while the stock volume stayed 12000 mm³. |
| PASS | Studio refuses the exterior cut, the wall-only contact and a cut wholly inside a prior through bore. The last case overlaps the stock bounding box. Apply is disabled and Enter leaves the document, Undo availability and accepted stock volume unchanged. |
| PASS | Moving the same 8 × 8 mm profile to cross the stock removes exactly 64 mm³. The native single body is valid and measures 11936 mm³. The native bottom lies at Z=8 mm. Undo and Redo restore both documents. The persistent Through all regression passes. |
| PASS | Sol High source review, 64 Model and 3 Studio focused tests, Model/Studio type checks, production build, scoped lint, driver syntax and diff check. |
| NOT_RUN | Full suites, mobile, tilted or drafted Cut emptiness, history no-material admission and performance of high-complexity native intersection probes. |

Keep #2464 open. Next D1155 checks the target and actual Join piece count before Apply. Desktop QA is **25/54 (46%)**. Initial scenarios are **8/10 (80%)**. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
