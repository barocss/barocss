---
work_id: D636
artifact_type: bounded-product-qualification
status: implemented-and-verified
last_updated: 2026-11-11
---

# D636 — Read a selected native failure in Studio chat

P0 automation, B09 follow-up, rows 04, 10 and 16. FULL interface qualification.

A failed task card offers Use in chat. The selected run, task, attempt and checked model revision travel with the next user message. That selected turn has a read-only `read_selected_native_check` MCP tool and matching CLI permission. On each call, the tool reopens the owned local run, checks its current finding and compares the current tool document with the checked model revision. Success returns structured evidence with the same fields as its JSON text. Selection expires after the message completes and can be removed before sending.

| Group | Result | Evidence |
| --- | --- | --- |
| K01 | PASS | Desktop Studio attaches the selected p2 failure and the actual chat server and stdio MCP return its exact `HOLE_OFF_PATTERN` finding on the failed run baseline. No state event, model edit or publication follows. |
| K02 | PASS | On the separate approved working model, the selected check refuses as a different revision. After a parameter edit, the selected check refuses again. Both refusals omit the native finding. |
| K03 | PASS | The one-message selection clears after each turn. The following ordinary planning turn carries no task selection. Both run records and the working model remain unchanged by the reads. |
| K04 | PASS | Focused checks verify the conditional tool list, CLI allowlist, exact structured output schema, wrong attempt/run/task refusal and rejection of caller-provided tool arguments. A later accepted revision retires the old finding. |
| K05 | PASS | The independent reader joins the agent report, the failed native bytes and the persisted attempt. The replacement-provenance desktop regression, focused suites, type checks, lint and build pass. |

[Commands and hashes](qualification.json). The browser uses controlled tool calls through the real local chat server and MCP. Live model selection, repair proposals, dependent tasks, whole suites and mobile are **NOT_RUN**. The first browser attempt **FAIL** came from an exact-text assertion that included the chip's remove button. The corrected locator checks the visible chip and its label. Read-only review also identified the CLI allowlist gap, which is corrected and covered by a focused check. B09 remains 9/9 scoped groups. Four of ten initial scenarios have accepted v1 ledgers. Whole CAD and core readiness are **NOT_MEASURED**. [#2279](https://github.com/barocss/barocss/issues/2279) and [#2402](https://github.com/barocss/barocss/issues/2402) remain open.
