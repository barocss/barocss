# D1228 — Identify historical references in Linked Inset review

2026-11-14 · FEATURE · P0 desktop QA, rows 09 and 21 · [#2481](https://github.com/barocss/barocss/issues/2481)

The source replacement review names the saved source and target even when a later feature consumes them. Each historical label includes the authored body name when present, the exact native ID and the earlier History step. A live candidate uses its Browser name and face ID. Long text wraps at word boundaries when it can.

| Result | Check |
| --- | --- |
| FAIL | Parent Studio showed only `n1.top` and `n1` for the source and target before Move. |
| PASS | Chrome WebGPU at 1024 × 800 showed the earlier Extrude 8 on both rows while Browser showed the current Move. A live candidate retained its name and ID. Controls with distinct and duplicate body names retained their respective native face IDs. |
| PASS | The real Front view pick at [130, 0, 4] mm gave a 1,024 mm³ preview with normal [0, −1, 0]. Keyboard Apply changed only the recipe's source fields. Strict closed B-rep, unchanged stock and target, Undo, Redo, Save and fresh Open passed. |
| PASS | The independent volumes were 960 and 1,024 mm³. The accepted centre was [130, −2, 4] mm. Ring volumes use the outer rectangle less the opening, multiplied by 4 mm. Volume and centre matched within 1e-7. |
| PASS | Five focused Studio tests, Studio type check, review lint, driver syntax, production build and frozen-source checks. |
| FAIL | Whole-file App lint reports the same unused `_k` in the parent and candidate. |
| NOT_RUN | Very long authored names, other transforms, assistive technology, full suites and CI. |

Keep #2481 open for remaining criteria. Desktop QA is **30/82 (37%)**. Initial scenarios are **8/10 (80%)**. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
