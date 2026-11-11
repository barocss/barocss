---
work_id: D651
artifact_type: bounded-product-qualification
status: implemented-and-verified
last_updated: 2026-11-11
---

# D651 — Preserve a saved approval review in the Studio project

P0 automation evidence, rows 04, 12 and 16. FEATURE qualification with existing MCP report compatibility.

The saved nested approval comparison can keep the original failure and approved result in the project. The sidecar uses the existing output-file envelope and v1 approval evidence payload. It is bound to the project document, two saved version and snapshot pins, proposal and exact occurrence. Fresh Open reads and validates the saved evidence before offering a recalculation. The saved report remains historical evidence for its pinned revisions.

| Check | Result | Evidence |
| --- | --- | --- |
| Original desktop behavior | FAIL | The saved comparison showed the 6 mm failure and 4 mm approval. It offered no way to keep the report, and the project had no approval artifact. |
| Save and fresh Open | PASS | Actual Studio saves the original 6 mm fail and approved 4 mm pass for a 5 mm limit on `p1/p1`. A fresh page opens the project and displays the same report with zero check evaluation calls. The working model remains 8 mm and the document, version log and snapshots retain their exact bytes. |
| Invalid evidence | PASS | Replacing the approval ID with a later saved version ID while recomputing the checksum does not admit the report. Studio displays a refusal and leaves the file unchanged. Focused tests also refuse an altered checksum, occurrence, evidence run and recovery value. |
| Write and retry | PASS | An identical retry keeps the same record and tag in the store test. A conflicting populated entry remains intact. An empty entry from an incomplete write can be completed on retry. The Studio writer uses a browser lock when available and the existing expected tag when committing. |
| Independent check and regressions | PASS | The Python reader checks the payload checksum, exact pins, original authored criteria, six local prism heights and both historical outcomes. The Studio follow-up comparison and the D610 Studio agent/MCP flows pass. |

The first baseline driver accessed its observation before it was initialized. The corrected baseline observes the missing save action and artifact. The final desktop run uses the guarded writer and the same review controls.

[Commands and hashes](qualification.json). This covers the saved pair for one supported nested approval. The native project schema and MCP report format remain unchanged. Later follow-up evidence is still calculated separately. Paid live execution, mobile and whole CAD suites are **NOT_RUN**. Four of ten initial scenarios have accepted v1 ledgers. B09 remains 9/9 and whole CAD/core readiness remains **NOT_MEASURED**. [#2279](https://github.com/barocss/barocss/issues/2279) remains open.
