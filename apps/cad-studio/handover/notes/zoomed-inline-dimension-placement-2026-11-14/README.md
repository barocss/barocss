# D1144 — Keep the zoomed Sketch dimension editor in view

2026-11-14 · SMALL · P0 desktop QA, rows 09, 20 and 21 · [#2473](https://github.com/barocss/barocss/issues/2473)

The inline Sketch dimension editor follows its projected anchor within the current work area shared with model framing. Clamp the input and Radius/Diameter buttons as a group. The same editor instance keeps the current value, mode and focus as the camera moves.

| Result | Check |
| --- | --- |
| FAIL | Parent desktop wheel zoom moved the 141 × 26 CSS px editor to x=1668.672. Its right edge passed the 1140 CSS px viewport by 669.672 CSS px. |
| PASS | The same wheel gesture kept the editor at x=987 with a 12 CSS px right margin. The input retained focus, the Diameter mode stayed selected, and the three controls passed pointer hit testing. Enter applied the typed diameter of 24 mm. The resulting 2 mm Extrude was 2372.3893421169305 mm³ against the independent rectangle-plus-semicircle formula within 1e-7 mm³. Undo and Redo restored the exact documents. |
| PASS | Desktop adaptive arc path, standalone and attached Circle, and Radius/Diameter through continued native Extrude/Open. Twenty-seven focused Studio checks, both type checks, scoped lint, driver syntax and diff checks. |
| NOT_RUN | Native solid cylinder, committed Band rails, Bézier, canvas smaller than the editor, full suites and mobile. |

Keep [#2473](https://github.com/barocss/barocss/issues/2473) open. Desktop QA is **24/54**. Initial scenarios are **8/10**. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
