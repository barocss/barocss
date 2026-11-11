---
work_id: D654
artifact_type: bounded-product-qualification
status: implemented-and-verified
last_updated: 2026-11-11
---

# D654 — Attach a retained saved follow-up to the Studio agent

P0 automation evidence, rows 04, 12 and 16. FULL qualification of the selected-turn MCP input.

The saved follow-up panel offers an attachment action for the retained v1 report. Studio sends the exact file and three pinned snapshots with the next manual chat message. The selected evidence tool validates the saved sequence, approval, occurrence and later verdict. It returns the original report text and checksum through the existing read-only interface.

| Check | Result | Evidence |
| --- | --- | --- |
| Original desktop behavior | FAIL | Studio reads the retained follow-up after Open. The panel offers no action to attach it. |
| Exact agent read | PASS | Actual desktop Studio reopens the report and attaches it. The local chat server and stdio MCP return the same file text and SHA-256. The three saved heights are 6 mm fail, 4 mm approved pass and 8 mm later fail. The working model remains at 3 mm. |
| Refusal and ownership | PASS | The server refuses a missing later snapshot, a substituted later pin and a different occurrence. A complete report about a skipped successor is also refused in the focused check. The next turn has no attachment. Closing the project or opening another document clears a pending attachment. The attached session is retired when the project closes. |
| Persistence and regressions | PASS | The working document, version index, snapshots and retained file keep their exact bytes. D652 pair attachment, D653 follow-up persistence and D610 history/MCP reads pass. Six isolated mutations are detected. |

[Commands and hashes](qualification.json). This is a read-only connection from one selected historical report to one local Studio turn. The test uses a scripted caller over the actual Studio and MCP transport. Live model execution, mobile and whole CAD suites are **NOT_RUN**. Four of ten initial scenarios have accepted v1 ledgers. B09 remains 9/9 and whole CAD/core readiness remains **NOT_MEASURED**. [#2279](https://github.com/barocss/barocss/issues/2279) remains open.
