---
work_id: D617
artifact_type: bounded-product-qualification
status: implemented-and-verified
last_updated: 2026-11-11
---

# D617 — Inspect the authored worker plan in Studio chat

P0 automation, B09 follow-up, rows 04, 12 and 16. FULL interface qualification. The existing `requirements` tool adds `plan_tasks`.

```json
{"action":"plan_tasks","occurrences":["p1","p2"]}
```

The result gives the selected occurrence IDs, their feature write scopes, the authored nominal targets in millimetres and their source requirement IDs. It also gives the SHA-256 revision of the exact document in the turn. Pass that revision as `expectedRevision` to require the same model on a later call. The read changes no CAD document and starts no worker. Studio shows the plan status in the existing tool transcript.

The Model planner and the CLI share the same target selection. If both scopes compile, a blocked report can include the eligible target of the other occurrence and structured issues for the blocked one. A structural compile failure returns the selected IDs and the compiler issue. Starting the local run still requires its separate saved-file plan and exact source bytes.

| Group | Result | Evidence |
| --- | --- | --- |
| K01 | PASS | Actual Studio chat, the local server and stdio MCP return the same p1 5 → 6 mm and p2 3 → 4 mm targets as the CLI plan generated from Studio Save. |
| K02 | PASS | After a new document Open, the old revision is refused with no targets. The current report retains the p1 target and identifies p2's unresolved requirement. A third document with a stated p2 target returns 5 mm at its new revision. |
| K03 | PASS | The agent receives the exact authored requirement ID `check_spec`. The MCP regression checks both response formats. The plan action rejects `part` before part evaluation. |
| K04 | PASS | Studio reports no changed document, selection, operations or version writes. The original browser project file retains its bytes. A separate oracle checks the authored scopes, target values and tolerance against the three fixture documents. |
| K05 | PASS | The frozen additive action fits the current 25,000-character tool and prompt budget at 24,999 characters. Existing v2 actions and the D616 manual and planned CLI paths retain their contract. |

The initial desktop observer decoded the event-stream summary with the wrong encoding. The rendered Studio text was correct. The final driver checks the rendered summary and the actual MCP tool payload separately. Review found two integration defects before publication. The tool definition now stays outside child-part routing, and MCP preserves the authored plan fields without translating their text. The generated docs also include earlier source changes. [Commands and hashes](qualification.json).

The revision identifies the model snapshot sent to the turn and any changes made within it. A separate viewport change enters a later turn. The original occurrence IDs are required. The existing `assembly.get` response can rewrite unusual imported IDs that match tool names, so use the original IDs from the model in that case.

Studio launch handoff, live model behavior, other task families, mobile and whole suites are **NOT_RUN**. B09 remains 9/9 scoped groups. Four of ten initial scenarios have accepted v1 ledgers. Whole CAD and core readiness are **NOT_MEASURED**. [#2279](https://github.com/barocss/barocss/issues/2279) and [#2402](https://github.com/barocss/barocss/issues/2402) remain open.
