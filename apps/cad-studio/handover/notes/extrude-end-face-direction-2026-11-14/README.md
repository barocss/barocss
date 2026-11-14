# D1161 — Report the reverse To face direction in the command HUD

2026-11-14 · SMALL · P0 desktop QA, rows 07 and 21 · [#2464](https://github.com/barocss/barocss/issues/2464)

Keep the exact kernel refusal. Show the direction and action directly in the existing command error. The prior HUD completion check remains controlled by the current native preview.

| Result | Check |
| --- | --- |
| FAIL | The original command correctly disabled Apply, but the direction only appeared inside Kernel detail. An initial driver opened the Bottom camera before choosing the profile and therefore clicked the wrong side of the stock. |
| PASS | In desktop Studio, the native rectangular −Z cap at Z−20 fails for direction even though it has the same normal and valid trim as the ahead control. It retains the cap name, shows the reason without opening Kernel detail, leaves End face unchecked and disables Apply. Enter preserves the exact document, selection and Undo/Redo state. |
| PASS | The cap at Z20 checks the step and enables Apply. The accepted solid is valid with Z0–20 span and 2000 mm³. Undo and Redo restore both documents. Visual review and the native holed cap, wall, curved face and target-deletion desktop regression pass. |
| PASS | 18 Model and 4 Studio focused tests, scoped lint, driver syntax and diff check. |
| NOT_RUN | Full suites, mobile, other direction/attachment families and migration of unmarked Through all files. |

Issue #2464 closeout evidence is D1151–D1161. It covers circular Cut Distance, persistent upright Through all, end-face refusals, zero-material Cut, Join target and piece count, 3MF grouping, a native attached sketch and side/oblique Draft Cut on the stated fixtures. After issue closeout desktop QA is **26/54 (48%)**. Initial scenarios remain **8/10 (80%)**. Whole CAD and core readiness remain **NOT_MEASURED**. D1162 starts #2480 and checks whether an original Revolve edge pick survives the New and Join preview order. [Commands and hashes](qualification.json).
