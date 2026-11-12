# D861 — Preview a straight-edge constraint before applying it

P1, rows 09, 15 and 16. FEATURE. The existing Parallel, Perpendicular and Equal controls can preview two selected straight edges on one ordinary closed outline. Pointer and keyboard focus share the current sketch's inspection store. The last input to enter a control owns the preview. A dashed outline displays the result of the existing apply and settle checks. Each exact sketch owner and constraint kind can reuse its isolated result. The existing click, Enter and Space apply one edit.

| Result | Check |
| --- | --- |
| PASS | Real pointer and keyboard focus show the Parallel candidate in Studio. All four projected vertices match the existing isolated solve within 0.02 CSS px. The accepted sketch, picked edges 1 and 3, history, solver state and dirty flag stay unchanged through hover, leave, Escape and no-op Undo/Redo. App renders, Worker requests, file writes and storage writes each increase by zero in the measured 1,000 ms autosave window. |
| PASS | A typed 85.5° dimension draft stays intact across preview hover, focus and first Escape. Editing a base point retires the candidate, and the first local Undo restores the original fields. |
| PASS | One held Enter applies Parallel once. First local Undo restores the original, and Redo restores the same solved coordinates. Equal preview, refused Perpendicular and Equal again keep the accepted geometry and the previous Vertical error. A refusal identical to the existing error appears once. Real click and Space each apply Equal once and the first local Undo restores Parallel alone. Independent Equal residual is 6.621e−11 mm. |
| PASS | Tool change, Finish, same-context File Open and New part retire the preview. Finish with an unaccepted Equal candidate saves only Parallel. The 8 mm Extrude keeps its reference and has independent volume 6,432.046632 mm³. Project Save writes 1,239 bytes. Fresh File Open and sketch re-edit retain the original tags and applied Parallel. |
| PASS | Current desktop regression for D856 keeps existing rule-row inspection, keyboard Remove, selection and dimension-draft ownership. Root visual review checked the candidate outline and the separate prior and transient errors. |
| FAIL | Independent FEATURE review identified comparison retention on empty Undo/Redo and during Finish dispatch. The command entry points now clear it. An early desktop view displayed the same refusal twice. The final desktop run verifies a single copy. |
| PASS | Studio 74/74, Model 29/29, both type checks, scoped lint, production build, browser-driver syntax and diff check. |
| FAIL | Full App.tsx lint reports the same unused `_k` on the parent and current source. |
| NOT_RUN | Larger sketches, arcs and linked or multi-outline candidates, a delayed Finish-reply experiment, additional browser engines, mobile and full suites. |

Pointer-to-result was 44.654 ms in the recorded desktop path, including automation and projection. The read-only comparison uses the local solver and does not enqueue a Worker job. The existing recipe, solver, schema and whole-model acceptance stay on their ordinary paths. [Issue #2306](https://github.com/barocss/barocss/issues/2306) · [Commands and receipt digests](qualification.json). Initial scenarios remain **8/10**. Whole CAD and core readiness remain **NOT_MEASURED**.
