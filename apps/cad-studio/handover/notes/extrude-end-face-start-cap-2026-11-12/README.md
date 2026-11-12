# D852 — Refuse a reversed extrusion target with the same lower face name

P1, rows 07, 08 and 16. FULL for the saved target admission change. A zero-draft native extrusion calls its geometrically lower cap `<feature>.bottom`. A negative distance makes the other authored end the lower cap. The shared reader and Model lowering now refuse a non-forward distance for an active direct binding to that name. They also refuse positional `#n` face names as saved identity. The recipe fields and file schema stay the same.

| Result | Check |
| --- | --- |
| FAIL | The unchanged parent reproduced the product defect in Studio. With Start Z20 fixed, a History change from Distance +5 to −5 silently moved the bound result from Z20 to Z15. Native cap positions and the independent 10 × 10 mm area give 2000 → 1500 mm³. The reproduction driver passed its assertion of the defect. |
| PASS | Studio now refuses the edit and keeps the accepted Doc, body results, selection, dirty state and history. A subsequent Start Z30 edit gives a 30 mm, 3000 mm³ dependent. First Undo and Redo restore the exact valid states. |
| PASS | Actual Open rejects the reversed saved binding and keeps the prior document. The same signed −5 mm extrusion opens on its own and has a native span Z15–20. |
| PASS | The current Studio runs retain the earlier holed, nonparallel and curved refusals, dependent deletion, and cardinal YZ creation, project reopen and re-edit. Model controls keep translated, drafted and rotated target cases, including a negative drafted target with the distinct native `n1.top` role. |
| PASS | Model 142/142, Studio 79/79, both type checks, scoped lint, driver syntax, production build and diff check. The mutation control passes and all five altered cases fail their designated assertions.
| FAIL | Source comparison found that an initial broader guard also refused existing translated, drafted and rotated targets. The delivered guard is limited to the direct zero-draft lower-name case, plus positional names. |
| NOT_RUN | General same-name continuity for other producer or cap roles, cold-process project reopen, independent third-party STEP geometry import and full test suites. |

Existing active saved direct zero-draft lower-face bindings with non-forward target height now refuse instead of binding to the other authored end. [Issue #2308](https://github.com/barocss/barocss/issues/2308) remains open for the unqualified wider reference cases. D853 takes up the next P1 sketch workflow. Initial scenarios remain **8/10**. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and receipt digests](qualification.json).
