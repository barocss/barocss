# D825 — Approve a parameter-driven circular extrusion height

P1 and local AI, rows 04, 09, 16 and 29. FULL interface qualification. One plain upright circular extrusion can use the existing named-height task if the local parameter controls only its height. The operation remains scoped `set_parameters`. The candidate and approval use the existing native cylinder oracle. The literal circular and named rectangular routes keep their existing checks.

| Result | Check |
| --- | --- |
| FAIL | On the parent, actual Studio chat blocks the positive named circle with `UNSUPPORTED_PROFILE`. It keeps the saved source and creates no local run. |
| FAIL | The first corrected browser run reads compiled metadata from the CLI's authored request fields. The driver now checks the request shape, and the focused Model test checks the compiled parameter and oracle. |
| PASS | Local CLI and Studio chat agree on the 5 to 6 mm Base task and the separate 3 to 4 mm Lid task. Studio rejects stale and mismatched reviews, explicitly approves Base, rebuilds and approves Lid, and opens both exact native checkpoints. |
| PASS | The first operation changes only Base `Thickness`. The authored height binding, tagged circle, unused `Spare`, same-name assembly and sibling parameters, and original project bytes remain exact. |
| PASS | After fresh Open, Edit part displays the bound 6 mm extrusion. Parameters changes it to 7 mm. Finish, Save and another fresh Open preserve that edit, the original binding and the durable 6 mm approval. |
| PASS | Native inspection finds one valid solid with one shell, two caps and the tagged wall at radius 4.23 mm. Independent calculation checks the cap directions, wall, and volumes 337.2732191485 and 393.4854223399 mm³. Centroids are (3.07, −7.13, 3) and (3.07, −7.13, 3.5) mm. Absolute tolerance is 1e-8. |
| PASS | Model 57/57, Studio 44/44, both type checks, affected lint, production build, driver syntax, diff check and root visual review. The current named rectangle and literal cylinder desktop regressions pass. Focused controls refuse a shared or configuration-owned height and an altered native radius. |
| NOT_RUN | Live models, combined changes across a parameter's uses, active variants, unrelated saved configurations, multi-feature named-height tasks, full suites, mobile and other browsers. |

[Commands and receipt digests](qualification.json). [#2402](https://github.com/barocss/barocss/issues/2402) remains open for its broader requirements. Initial scenarios remain 8/10 and B09 v1 remains 9/9. Whole CAD and core readiness are **NOT_MEASURED**.
