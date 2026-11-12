# D847 — Qualify existing Extrude modes after To face

P1, rows 06, 08 and 16. SMALL evidence-only item. The direct desktop workflows exercise existing numeric Distance, draft, named height and Start Z, then face-start Join, New body and Cut Through all. Independent analytic prism, frustum and rectangular void formulas supply the physical oracles.

| Result | Check |
| --- | --- |
| PASS | With another body present, a finished rectangle defaults to Distance 8 mm. A typed 12 mm Distance and 5° Draft create the ordinary extrusion. Its volume is 965.6680784751 mm³. |
| PASS | History binds Distance to the named Height value 15 mm and sets Start Z to 3 mm. The draft remains 5°. Volume is 1140.7452122383 mm³. First Undo and Redo restore the exact ordinary and bound-height documents. |
| PASS | Actual top-face selection and 4 mm Join produce one 5600 mm³ solid. Actual New body produces separate 4000 and 1600 mm³ solids. |
| PASS | Studio draws a 6 × 8 mm rectangle on the original top face. Cut offers Distance and Through all. Through all uses an 11 mm tool from local −11 and produces one 3520 mm³ body with 16 native corners. First Undo and Redo restore the exact drawn and cut documents. |
| PASS | Model 95/95, Studio 40/40, final Model types, driver syntax, diff check and root visual review pass. |
| FAIL | The first browser run passed four groups, then a viewport handle already owned keyboard focus during the Sketch attempt. The final driver uses an interior face point and the real Sketch rail button. |
| NOT_RUN | Full B01/B02 workflow replays, third-party STEP geometry import, full suites, fresh Studio types and production build, mobile and other browsers. The exact historical B01/B02 temporary seed files were unavailable. Their earlier accepted results retain their recorded scope. |

[Issue #2308](https://github.com/barocss/barocss/issues/2308) remains open. D848 starts from an eligible saved Distance extrusion and stages To face by an explicit original-face pick in History. Initial scenarios remain 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and receipt digests](qualification.json).
