---
work_id: D649
artifact_type: bounded-product-qualification
status: implemented-and-verified
last_updated: 2026-11-11
---

# D649 — Keep local CLI paths out of Studio chat diagnostics

P0 Studio chat diagnostics, rows 04 and 16. FEATURE qualification.

The chat server returns short recovery guidance when Claude Code is unavailable, fails to start, reports a failed turn, or exits with an error. The server retains raw execution diagnostics in its local log. The existing step-limit message still reports the limit.

| Check | Result | Evidence |
| --- | --- | --- |
| Original Studio behavior | FAIL | The unavailable-CLI notice showed its configured executable path. A failed result and a process exit showed the private fixture path in both the chat and the turn response. |
| Actual desktop Studio and local server | PASS | The same three cases show recovery guidance with no fixture path in the chat or response. Result and stderr details remain in the local server log. The 24-step limit and a successful next turn appear in the same chat. The document remains exact across all four turns. |
| Process start controls | PASS | Synchronous and asynchronous start failures return the same guidance. The local log still receives the original error. Focused tests also retain the Stop control. |

[Commands and hashes](qualification.json). The coverage applies to server-generated CLI status and turn diagnostics. Assistant-generated text, user text and individual CAD tool summaries use their existing contracts. The actual desktop run uses a local fixture CLI. Paid live execution, mobile and whole CAD suites are **NOT_RUN**. Four of ten initial scenarios have accepted v1 ledgers. B09 remains 9/9 and whole CAD/core readiness remains **NOT_MEASURED**. [#2402](https://github.com/barocss/barocss/issues/2402) and [#2279](https://github.com/barocss/barocss/issues/2279) remain open.
