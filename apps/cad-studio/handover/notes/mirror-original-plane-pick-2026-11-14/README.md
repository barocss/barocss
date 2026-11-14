# D1200 — Pick the Mirror plane on original geometry

2026-11-14 · FEATURE · P0 desktop QA, rows 07, 20 and 21 · [#2469](https://github.com/barocss/barocss/issues/2469)

Mirror resolves retained reference faces by original body and face identity. Generated faces in the combined preview cannot stand in for original faces. Pick plane displays the original bodies and pauses Apply. Picking an eligible native axis-aligned face resumes preview using its exact plane coordinate. The Plane face field identifies the source. The saved Mirror records the selected plane position as a numeric snapshot.

| Result | Check |
| --- | --- |
| FAIL | The plain-box probe returned the correct Z=0 plane, so its forced wrong-plane assertion failed. Repeating with the asymmetric through-hole reproduced the reported defect. The parent applied Z=10 after a bottom-face click, yielding Z0–20. |
| FAIL | The first candidate needed an explicit Values type for the Model command return. |
| PASS | In actual Studio, the generated preview face was refused and the document remained unchanged. Pick plane showed the original body, disabled Apply, and accepted n1.bottom at Z=0. The active preview and accepted output used that plane. |
| PASS | The native result was strict-valid, volume 18,948.672587712834 mm³, centroid (20.119372304319153, 12.066317946843965, 0) mm and bounds (0, 0, −10)–(40, 24, 10) mm. Independent box-minus-bore and extrema checks used 1e-7 tolerance. Undo and Redo matched the exact documents. |
| PASS | Model 19/19, Model and Studio type checks, scoped lint, driver syntax, production build, diff and frozen-source checks. |
| NOT_RUN | A newly picked separate spectator plane, reflected-only sheet browser regression, History source reference editing, fresh Open, controlled worker delay, full suites, CI and mobile. |

Keep #2469 open for remaining source editing, Split output control and export acceptance. Desktop QA is **29/54 (54%)**. Initial scenarios are **8/10 (80%)**. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
