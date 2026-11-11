---
work_id: D653
artifact_type: bounded-product-qualification
status: implemented-and-verified
last_updated: 2026-11-11
---

# D653 — Preserve the direct saved follow-up in Studio

P0 automation evidence, rows 04, 12 and 16. FEATURE qualification with targeted persisted-format mutations.

The saved follow-up panel can keep one explicitly selected direct successor with the original failure and approved result. The artifact uses the existing v1 follow-up payload and a separate key for its three saved versions and occurrence. Studio checks the source lineage, the three pins, the admitted occurrence edit and the recorded findings when it reads the artifact. The pair report keeps its existing key and read path.

| Check | Result | Evidence |
| --- | --- | --- |
| Original desktop behavior | FAIL | The direct saved successor displays its regression. The original UI has no action to keep the result. |
| Save and fresh Open | PASS | Studio saves one report with 6 mm initial fail, 4 mm approved pass and 8 mm saved regression against the same 5 mm limit on `p1/p1`. No separate pair report is required. After a fresh project Open, the three results read from the report with zero check evaluation calls. The working model from the later skipped version remains at 3 mm. |
| Refusal and pair preservation | PASS | The later ID substituted with a skipped version is refused even with a valid checksum. Studio preserves the separately saved pair and the refused record. The native document, version index and four snapshots keep their exact bytes. The focused checks also refuse a skipped parent and a substituted verdict. |
| Independent check and regressions | PASS | The Python reader verifies the file checksum, all three saved pins, original criteria, six local prism heights and the later failed check. The D650 comparison, D652 agent attachment and D610 history/MCP flows pass. Five isolated mutations are detected. |

[Commands and hashes](qualification.json). The retained follow-up is historical evidence for the three exact saved revisions. Attaching that three-version artifact to an agent turn remains pending. Live model execution, mobile and whole CAD suites are **NOT_RUN**. Four of ten initial scenarios have accepted v1 ledgers. B09 remains 9/9 and whole CAD/core readiness remains **NOT_MEASURED**. [#2279](https://github.com/barocss/barocss/issues/2279) remains open.
