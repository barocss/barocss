---
work_id: D609
artifact_type: bounded-product-qualification
status: implemented-and-verified
last_updated: 2026-11-11
---

# D609 — Read saved nested approval evidence in Studio chat

P0 automation, B09 follow-up, rows 04, 12 and 16. FEATURE qualification. Studio chat can call `history.approval_evidence` with two distinct saved version IDs and the exact nested leaf path. The tool uses the same operation matching and replay as the [D608 Versions panel](../saved-nested-approval-comparison-2026-11-11/README.md). The report contains the saved version, snapshot, authored revision and evidence revision pins at both ends. It includes both requirement reports, recoveries and any changed requirement definitions. The JSON file carries its byte count and SHA-256.

When an endpoint is missing from the turn context, the tool requests both IDs for the next turn. The existing snapshot budget still applies. A request to load snapshots leaves the version log and working document unchanged. Studio accepts the request only for the project session and file that sent the turn. The approval authority is the local project history. The tool requires the Studio project version context.

| Group | Result | Evidence |
| --- | --- | --- |
| A01 | PASS | Real desktop Studio, the local chat server and stdio MCP returned the approved report after a first turn requested both saved snapshots. The scripted local driver exercised the real tool calls without an external model. At `p1/p1`, HEIGHT was 6 mm fail in the saved source, 4 mm pass in the approved version and 8 mm fail in the separate working report. The limit was 5 mm. The independent oracle checked the saved and working geometry in six cases. |
| A02 | PASS | The sibling and unrelated saved pair were refused with no report file. The version log, saved snapshots and working document retained their bytes. A delayed request sent before project close could not add snapshots to the first turn after reopen. The desktop run captured five states and reported zero page errors, console errors and downloads. |
| A03 | PASS | Focused tests check exact response schemas, opaque occurrence paths, one warm endpoint, corrupt or ambiguous version records, and project log ownership. Studio's existing version mutations still return a version log. A read that asks for snapshots returns only the requested IDs. |

Initial failures were retained outside Git. The first tool list exceeded its 25,000-character budget and generic part routing consumed the exact occurrence path. The tool now has explicit root-history dispatch, and shorter list hints keep the budget. The first desktop run sent a turn after document load but before the versions list was ready. The final driver waits for the saved comparison entry before sending. Review also found stale calls in existing ownership tests. The tests now keep the receipt bound to its originating turn.

See [commands and hashes](qualification.json). External signer authentication, a defect lifecycle report, standalone CLI project history, full suites, mobile and live providers are **NOT_RUN** for this decision. B09 v1 remains 9/9 scoped groups. Four of ten initial scenarios have accepted v1 ledgers. Whole CAD and core readiness remain **NOT_MEASURED**. [#2279](https://github.com/barocss/barocss/issues/2279) and [#2402](https://github.com/barocss/barocss/issues/2402) remain open.
