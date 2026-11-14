# D1198 — Keep the Render appearance of a moved Split side

2026-11-14 · FEATURE · P0 desktop QA, rows 07, 20 and 21 · [#2469](https://github.com/barocss/barocss/issues/2469)

The Studio Move command copies the selected body's explicit Render appearance to the output it creates. The original appearance entry remains available when History is rolled back. Other bodies and the default appearance retain their own settings.

| Result | Check |
| --- | --- |
| FAIL | Moving the negative Split side changed its Render appearance from painted red (#a8161a, roughness 0.5) to the default (#bfc2c8, roughness 0.6). The positive side stayed black (#26272a). |
| FAIL | The first fixed driver used a property-order-sensitive comparison after Open. The opened values matched. The corrected driver waits for the Move node and compares the decoded document structurally. |
| PASS | Studio moved the negative side by +40 mm along Y, with volume 7,200 mm³ and centroid (12, 55, 5) mm within 1e-7. Its rendered appearance and panel returned the original red and roughness. The positive side kept its distinct black appearance. |
| PASS | Undo restored the pre-Move document and Redo restored the Move with the same appearance values. A fresh Chrome context opened the moved document and displayed both appearances. Root inspected the rendered screenshot. |
| PASS | Studio render-focus 1/1, Studio type check, scoped lint, driver syntax, production build, diff and frozen-source checks. |
| NOT_RUN | Product Save button, migration for already-authored Moves with missing appearance, other geometry commands, animation-track migration, full suites, CI and mobile. |

Keep #2469 open. Desktop QA is **29/54 (54%)**. Initial scenarios are **8/10 (80%)**. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
