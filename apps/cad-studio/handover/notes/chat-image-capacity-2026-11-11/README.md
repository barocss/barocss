---
work_id: D599
artifact_type: bounded-product-qualification
status: repaired-and-verified
last_updated: 2026-11-11
---

# D599 — Preserve Chat after the image trace limit

P0 automation, B09 follow-up, rows 04 and 16. SMALL fix to Studio Chat admission. Use the D598 desktop driver, the actual local Chat server and real read-only MCP tools. The offline CLI fixture captures each accepted request. The server keeps its limit of 16 image traces per conversation.

| Group | Original | Fixed |
| --- | --- | --- |
| C01 | PASS | PASS. Four messages carry four PNGs each. All sixteen traces have their expected indexes. Explicit index 1 still matches the first trace. Explicit index 16 and the default lookup match the latest trace. |
| C02 | FAIL | PASS. Studio refuses an attempted seventeenth image before HTTP. It explains the limit and retains both the typed text and the pending attachment. |
| C03 | FAIL | PASS. After the excess attachment is removed, a text-only retry receives HTTP 200. The original session, sixteen traces and their indexes survive. The tool refuses explicit index 17. |
| C04 | NOT_RUN | PASS. New conversation accepts an image at index 1. The native document matches the initial Studio document. |

The original overflow request returned HTTP 400 with seventeen traces. The panel cleared the draft, while the hook kept the overflowing trace. A later text-only request sent seventeen traces again and returned HTTP 400. The fixed panel checks the hook's current count before clearing the draft or sending. Browser and server use the same limit.

The fixed run includes four desktop states and nine real MCP calls. The index 17 tool refusal is an expected outcome. The D598 same-name and new-conversation flow passes again in five desktop states. Each fixed run retains all 952 source hashes through cleanup. Targeted Studio tests pass 32/32. Studio TypeScript checks pass on Node 22.19.0. See [commands and hashes](qualification.json).

Live model interpretation, live multi-worker delivery, whole-browser and whole-kernel suites, and mobile are **NOT_RUN**. The scoped B09 v1 groups remain 9/9. Four of the ten initial product scenarios have accepted ledgers. Whole CAD and core readiness remain **NOT_MEASURED**. The broader AI workflow in [#2402](https://github.com/barocss/barocss/issues/2402) remains open.
