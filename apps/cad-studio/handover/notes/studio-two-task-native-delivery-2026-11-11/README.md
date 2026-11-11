---
work_id: D644
artifact_type: bounded-product-qualification
status: verified
last_updated: 2026-11-11
---

# D644 — Deliver a two-task assembly through Studio approval and project Save

P0 automation, B09 follow-up, rows 04, 12 and 16. FEATURE qualification of the existing product workflow.

The desktop flow starts from the saved two-part housing. It approves p1 in Studio, opens the approved model, and rebuilds p2 from that model. It reviews and approves the rebuilt p2 in Studio. It then saves the final native assembly under a separate name and opens the file through the browser project in a fresh page.

| Group | Result | Evidence |
| --- | --- | --- |
| K01 | PASS | The original project file reports two current hard height failures at 5 and 3 mm. The first Studio approval publishes p1 at 6 mm and retires the initial p2 review. |
| K02 | PASS | Studio rebuilds p2 from the first approved native digest. The attempt changes from `2:2:p2` to `4:3:p2`. Preview shows both placed bodies at 6 and 4 mm while the working model still has the first approved dimensions. |
| K03 | PASS | The second explicit Studio approval completes p2. The durable run has two Studio approval commits, one rebuild, and zero terminal decisions. The second commit starts from the first accepted file. |
| K04 | PASS | Project Save and fresh project Open preserve the exact final native bytes. The original file remains byte-identical. A fresh Studio evidence turn reports both current hard requirements passing at 6 and 4 mm. |
| K05 | PASS | An independent reader checks both checkpoint byte ranges, commit ancestry and source/final hashes. The simple rectangular dimensions give 1,200 and 384 mm³. The single-approval Studio regression, focused Studio tests and Model type check pass. |

[Commands and hashes](qualification.json). The scripted chat adapter uses the existing local Studio tool path. Live model behavior, exchange export, whole CAD suites and mobile are **NOT_RUN**. B09 remains 9/9 scoped groups. Four of ten initial scenarios have accepted v1 ledgers. Whole CAD and core readiness remain **NOT_MEASURED**. [#2279](https://github.com/barocss/barocss/issues/2279) and [#2402](https://github.com/barocss/barocss/issues/2402) remain open.
