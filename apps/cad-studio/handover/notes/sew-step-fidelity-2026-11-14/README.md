# D1192 — Block STEP export when a sewn boundary exceeds the accuracy limit

2026-11-14 · FULL · P0 desktop QA, rows 13 and 21 · [#2467](https://github.com/barocss/barocss/issues/2467), checklist lines 1978–1991

The native STEP writer checks B-reps with Sew provenance before it emits any bytes. It compares the measured vertex and edge-to-support gaps to the nominal STEP accuracy of 0.000001 mm. The response states the measured gap and asks the user to align the edges. The authored Sew tolerance remains available for modeling. A coincident body sewn at the same tolerance can still export.

| Result | Check |
| --- | --- |
| FAIL | Parent desktop Studio prepared both 0.02 mm gap orders near 1200 mm³. Actual Open of the dome-first prepared bytes returned 1201.6222855121314 mm³ and failed strict B-rep. Dome-last Open refused. An interim unit run failed when its assertion expected the earlier refusal wording, then passed with the updated assertion. |
| PASS | Current desktop Studio refused STEP preparation for both gap orders, disabled Export and kept the exact accepted document. The native edge-to-support gap is about 0.02 mm in both orders. The last-picked dome has zero vertex gap, so the edge measurement matters. Root inspected the refusal screenshot. |
| PASS | The coincident control at the same authored 0.021 mm tolerance produced a STEP blob from the actual Export button. The test intercepted the local blob and opened its exact bytes through the file chooser. One strict-valid solid reopened at 1199.9999999999995 mm³, matching the 1200 mm³ analytic and declared values within 1e−7 mm³. All four seam midpoints remained at Z11.5 mm and measured vertex and edge gaps were zero. |
| PASS | Sol High audit and an in-memory placed/rotated Model control across all three output modes. Kernel 7/7 and Model 6/6 focused tests, three type checks, scoped lint, syntax, diff, source-freeze verification and production build passed. |
| NOT_RUN | Independent external reader, saved legacy gap import repair, derived solids with other native provenance, arbitrary localized gaps between sampled positions, full suite, CI and mobile. |

Keep #2467 open for the remaining cross-reader and boundary-location acceptance. The guard covers the reproduced fidelity failures. Desktop QA is **29/54 (54%)**. Initial scenarios are **8/10 (80%)**. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
