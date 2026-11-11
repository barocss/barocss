---
work_id: D652
artifact_type: bounded-product-qualification
status: implemented-and-verified
last_updated: 2026-11-11
---

# D652 — Attach a retained approval review to a Studio agent turn

P0 automation evidence, rows 04, 12 and 16. FULL qualification for the selected-turn MCP interface.

Studio offers an attachment action for a stored, valid nested approval. The selected file travels with the next manual message. The local server and MCP process check the same v1 payload against both saved snapshots and the exact proposal and occurrence. The read-only tool returns the retained file text and checksum. The version pair describes historical checks. The working model keeps its separate result.

| Check | Result | Evidence |
| --- | --- | --- |
| Original desktop behavior | FAIL | The project retains the D651 report and Studio displays it after Open. The original UI offers no attachment action. |
| Exact Studio agent read | PASS | Desktop Studio saves and reopens the report, then attaches it from Versions. The actual local chat server and stdio MCP return the exact report text and SHA-256. Its saved height is 6 mm fail and 4 mm approved pass with a 5 mm limit. The working model remains at 8 mm. |
| Turn and document ownership | PASS | The next turn has no attachment or selected tool. Closing and reopening the same project clears the pending attachment and the prior provider session that saw it. Opening another document also clears the pending attachment. The native document, version log, snapshots and retained file remain byte-identical. |
| Input and interface controls | PASS | The server refuses a different occurrence even with a valid checksum. It also refuses a missing snapshot. The tool refuses arguments, declares read-only semantics, returns matching structured and text results, and performs no model or version write. Five isolated mutations are detected. |
| Existing consumers | PASS | D651 saved-report Open and D610 history evidence pass on the final desktop build. Focused Studio and Model suites, type checks, lint and build pass. |

The first D610 regression reached the chat server and refused the existing history action. The new eager reader brought approval dependencies into the bundled tool initialization. Separating serialization from validation and loading the server validator only for an attached report restores D610. The final D652 desktop flow and both regressions use that arrangement.

[Commands and hashes](qualification.json). The attached report covers the D651 saved pair. Later saved follow-up retention is pending. The desktop run uses a scripted caller over the real Studio and MCP transport. Live model execution, mobile and whole CAD suites are **NOT_RUN**. Four of ten initial scenarios have accepted v1 ledgers. B09 remains 9/9 and whole CAD/core readiness remains **NOT_MEASURED**. [#2279](https://github.com/barocss/barocss/issues/2279) remains open.
