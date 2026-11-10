---
work_id: D598
artifact_type: bounded-product-qualification
status: repaired-and-verified
last_updated: 2026-11-11
---

# D598 — Keep drawing attachments in the correct chat conversation

P0 automation, B09 follow-up, rows 04 and 16. SMALL fix to Studio Chat image drafts. Reuse the D597 drawing. Derive a second revision with an Ø8 bore in place of Ø6. Attach both as separate PNGs with the same filename. Run the actual Studio and local Chat server. The test CLI captures provider input and delegates scripted read-only calls to the real MCP server.

| Group | First run | Fixed run |
| --- | --- | --- |
| I01 | PASS | PASS. Studio sends the exact PNG for each revision in its own turn. The local CLI receives the same bytes. Its MCP state retains Rev A at image 1 and Rev B at image 2. The default trace matches explicit image 2, while image 1 still returns the Rev A trace. |
| I02 | FAIL | PASS. New conversation clears an already decoded draft and discards a prior decode that completes after reset. A new attachment completes normally. |
| I03 | NOT_RUN | PASS. Remove the new attachment and send a text-only turn. It starts without the prior session, images, traces or prompts. The read-only image tool reports that there is no image. The native document remains byte-equivalent as JSON. |

The first Studio run showed one pending image immediately after reset. After the delayed decode completed and the current image loaded, three pending images were visible. The fix clears the image draft on New conversation and gives each pending decode the generation of the draft that started it. The fixed run showed zero pending images immediately after reset and one after the current image loaded.

Five desktop states, five real MCP calls, and 32 targeted Studio tests passed on Node 22.19.0. The fifth tool call was the expected refusal in the empty conversation. Studio TypeScript checks passed. All 951 source pins matched before the run, after the run and after cleanup. See [qualification commands and hashes](qualification.json).

Live model interpretation, provider comparisons, whole-browser and whole-kernel suites, and mobile are **NOT_RUN**. B09 remains 9/9 scoped groups. Four of ten initial product scenarios have accepted ledgers. Whole CAD and core readiness remain **NOT_MEASURED**. The larger workflows in [#2279](https://github.com/barocss/barocss/issues/2279) and [#2402](https://github.com/barocss/barocss/issues/2402) remain open.
