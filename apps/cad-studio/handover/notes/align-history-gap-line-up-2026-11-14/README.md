# D1202 — Keep Align faces, Gap and Line up in History

2026-11-14 · FEATURE · P0 desktop QA, rows 07 and 21 · [#2491](https://github.com/barocss/barocss/issues/2491)

New face-to-face Align between two admitted native rectangular axis-plane faces stores one versioned feature. Its moving body, target body, native names and outward axes remain explicit. History shows both face names and edits Gap and Line up. The target is a dependency and remains a separate output. Evaluation uses exact rectangular trims from the native prefix and lowers to the existing rigid rotation and translation. The output key is stable when rotation is unnecessary. Old Rotate/Move documents remain readable. Floor and unsupported-face workflows still use the existing lowering.

| Result | Check |
| --- | --- |
| FAIL | Parent Studio selected the right C face but created Rotate 180° and Move. History offered no Gap, Line up or target. The first implementation also exposed a module initialization cycle, corrected before final runs. |
| PASS | Studio aligned A to C at Gap 2 with centres lined up. One Align row retained n1.top and n5.top. Native result b6 was strict-valid at 720 mm³, centroid (95, 10, 17) mm. Both stationary bodies retained their bounds and native mass. |
| PASS | Studio edited Gap to 4 and Line up to Touch only. The same output key retained 720 mm³ with centroid (6, 5, 19) mm. Independent native bounds, centroid and volume checks used 1e-7 tolerance. Undo, Redo and fresh-context Open retained the same recipe and values. |
| PASS | Model 29/29 includes stale signed face refusal, preview recovery, self/forward target-file refusal, target dependency and stable output across rotation/no rotation. Model and Studio types, scoped lint, driver syntax, diff, frozen-source checks and production build passed. |
| NOT_RUN | History target replacement, previous-release read of new Align files, a live upstream producer edit in Studio, deeply nested placement, varied curved or grouped faces, full suites, CI and mobile. |

Keep #2491 open for target replacement and its direct Studio proof. Desktop QA is **29/54 (54%)**. Initial scenarios are **8/10 (80%)**. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
