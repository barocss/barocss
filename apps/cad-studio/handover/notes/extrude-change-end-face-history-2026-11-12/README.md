# D849 — Change a saved bound extrusion's end face

P1, rows 07, 08 and 16. FEATURE for an already bound saved extrusion. **Change end face** uses the existing original-face pick and current native validation. The previous exact target is a refused no-op. One Apply stores the new target at the same History slot and preserves the sketch, feature ID, output keys and next serial.

| Result | Check |
| --- | --- |
| PASS | Studio opens a 20 mm bound extrusion with target `n1.bottom`. Selecting the same face leaves Apply disabled. Cancel after a valid alternative preview keeps the accepted document, geometry, selection, dirty state and history exact. |
| PASS | One explicit Apply switches `n5` to `n3.bottom`, producing a 30 mm extrusion and 3000 mm³. First Undo restores the exact 20 mm relation. First Redo restores the exact 30 mm relation. |
| PASS | Moving the former cap from Z20 to Z24 leaves the end at Z30. Moving the new cap from Z30 to Z40 moves the end to Z40. After the 1307-byte project reopens, moving the former cap to Z22 keeps Z40. Moving the new cap to Z45 moves the end to Z45 and gives 4500 mm³. |
| PASS | At all eight native checkpoints, the three outputs have 24 exact native corners. The two target body volumes remain 2000 and 4500 mm³. The Model verifies the sole new dependency and stable identity. The actual D845 delayed creation and D848 Distance conversion regressions pass. |
| PASS | Model 138/138, Studio 76/76, both type checks, scoped lint, driver syntax, production build, diff check and root visual review pass. |
| FAIL | Full App.tsx lint reports the same pre-existing unused `_k` as the clean parent. |
| NOT_RUN | Recovery of an already unresolved imported project, additional negative native target topology, third-party STEP geometry import, full suites, mobile and other browsers. |

[Issue #2308](https://github.com/barocss/barocss/issues/2308) remains open. D850 verifies the remaining unsupported target geometry and authored dependency refusals in the same-document profile. Initial scenarios remain 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and receipt digests](qualification.json).
