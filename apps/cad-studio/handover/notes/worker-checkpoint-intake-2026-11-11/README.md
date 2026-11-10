---
work_id: D611
artifact_type: bounded-product-qualification
status: implemented-and-verified
last_updated: 2026-11-11
---

# D611 — Open a verified local worker checkpoint in Studio

P0 automation, B09 follow-up, rows 04, 12 and 16. FULL interface qualification. Run the following command from `apps/cad-studio`, then choose the result from Studio's normal Open control.

```sh
node scripts/cad-cli.mjs task-run export <run-directory> <output>.bcad-run
```

Export reads one durable run pointer and both immutable native files. It requires the latest completed task, its matching accepted operation and no pending publication. It does not acquire a writer or change the run. The bundle holds the original and accepted native bytes, the recorded task and its commit-time plan. Existing plain native exports use the same path as before.

Studio checks both native payloads and re-encodes the accepted model to confirm that Save can reproduce its bytes. It recompiles the task plan from the original document, verifies the specification and scope, reconstructs the exact authored height edit and matches the local approval. The Worker then rechecks current hard requirements for the accepted occurrence. A late read cannot adopt the document after another Open. A successful adoption clears reference warnings from the previous document.

| Group | Result | Evidence |
| --- | --- | --- |
| I01 | PASS | The real CLI exported D600's latest committed lid task and reproduced both original native payloads, 5,888 and 8,149 bytes. The source run record and directory entries remained unchanged. |
| I02 | PASS | Actual Studio refused changed native bytes and kept the working document and project log. A completed but held Worker response was discarded after a newer native Open. The valid checkpoint cleared a genuine held-reference warning from the previous document. |
| I03 | PASS | Actual Studio opened task `lid` at run revision 14. The one hard requirement passed. Placed bounds retained the 20 × 10 × 6 mm base and the 12 × 8 × 4 mm lid at their recorded positions. The independent fixture arithmetic gives 1,200 mm³ for the base and 288 → 384 mm³ for the lid. The desktop read checks bounds. |
| I04 | PASS | Studio Save wrote the exact 8,149 accepted bytes to the browser project. Fresh project Open showed the accepted model and retained the original project file and version log. |
| I05 | PASS | CLI and focused checks reject an unapproved run, changed native/model/specification/candidate/scope pins, a valid JSON reformat that would alter saved bytes, and an unavailable native check. The original task plan still exports after a later policy revision. A legacy record refuses if the available plan cannot reproduce the original specification. |

The first desktop run waited for an Open button on a file that had just become active. The final driver waits for the document row and compares raw project bytes. Review also found gaps in specification binding, exact Save bytes and prior reference state. The final code recompiles the recorded plan, admits only reproducible accepted bytes and guards late reference-choice updates. Both review lanes cleared the final implementation.

The bundle is a local, integrity-checked handoff. Run and operation labels are recorded metadata. The read does not authenticate an external signer or check whether a live run advanced. A plain `.bcad` Save retains the native approval history. The complete portable receipt remains in `.bcad-run`. The qualified desktop profile is the ordinary D600 prism task. Bundle intake is capped at 64 MiB.

See [commands and hashes](qualification.json). In-Studio worker approval, portable review in Versions, packed-blob runtime coverage, whole suites, mobile and live providers are **NOT_RUN**. B09 remains 9/9 scoped groups. Four of ten initial scenarios have accepted v1 ledgers. Whole CAD and core readiness remain **NOT_MEASURED**. [#2279](https://github.com/barocss/barocss/issues/2279) and [#2402](https://github.com/barocss/barocss/issues/2402) remain open.
