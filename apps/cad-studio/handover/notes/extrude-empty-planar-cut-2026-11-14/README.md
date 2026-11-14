# D1160 — Refuse a rectangular side or drafted Cut that removes no material

2026-11-14 · FEATURE · P0 desktop QA, rows 07 and 21 · [#2464](https://github.com/barocss/barocss/issues/2464)

Extend the terminal native intersection in the current Cut preview to one planar solid made by a simple rectangular stock extrusion and a simple rectangular tool. Confirm the replacement is the same terminal feature and an Intersection. A successful empty result refuses Apply without introducing a mass or mesh calculation. Keep the original upright scope, ordinary Difference algebra and the existing unqualified path for unsupported operands or a refused probe.

| Result | Check |
| --- | --- |
| FAIL | Original Studio appended Difference for side gap, side face contact, drafted gap and drafted edge contact. All four left a valid 12000 mm³ solid with no removed material. |
| PASS | The same four candidates report no material and disable Apply. Enter leaves the model, Undo state and 12000 mm³ stock unchanged. The covered drafted cutter uses +10° Draft on the top work plane. |
| PASS | A lateral positive Cut removes 64 mm³ and has its floor at X38. A 0.001 mm overlap removes 0.032 mm³ with native floor X39.999. The +10° drafted positive control removes 178.225481054 mm³ and has its floor at Z8. All results are single valid native solids. Visual review, the upright bore/contact regression and the three D1159 work-plane flows pass. |
| PASS | Sol High source review, 64 Model and 3 Studio focused tests, both type checks, production build, scoped lint, driver syntax and diff check. Seven polyhedral Boolean tests passed against the existing kernel build. |
| NOT_RUN | Full suites, mobile, empty oblique Draft, general curved/faceted branches, and no-material admission on arbitrary existing authored History tools. |

Review #2464 against D1151–D1160. The next unverified source case is a reverse To face candidate with a planar end behind the sketch. Test that exact direction in D1161 prior to issue closeout and the #2480 Revolve flow. Desktop QA remains **25/54 (46%)**. Initial scenarios remain **8/10 (80%)**. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and hashes](qualification.json).
