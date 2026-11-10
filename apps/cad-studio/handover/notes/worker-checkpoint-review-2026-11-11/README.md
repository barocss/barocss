---
work_id: D612
artifact_type: bounded-product-qualification
status: implemented-and-verified
last_updated: 2026-11-11
---

# D612 — Review a worker checkpoint in Studio

P0 automation, B09 follow-up, rows 04, 12 and 16. FEATURE qualification. Open a verified `.bcad-run` file and review the original and approved checks in the existing Project & Versions panel. The table shows the task, exact occurrence, proposal, criterion and both verdicts. Evidence revisions are available in the same section. The view uses the reports evaluated on checkpoint admission. It does not start another Worker calculation.

The review belongs to the opened checkpoint. It stays available after working edits and ordinary Undo/Redo. Studio hides it while a placed part is open for in-place editing. A whole-document replacement retires the review. Undo or Redo across that boundary does not restore it. Reopen the portable checkpoint to review it again. A plain native save retains the model and its approval history. The full portable review stays in the checkpoint file.

| Group | Result | Evidence |
| --- | --- | --- |
| J01 | PASS | Actual Studio shows task `lid`, occurrence `p2`, proposal `P2` and the two exact evidence revisions. The height limit is 4 ± 0.001 mm. The original height was 3 mm and failed. The approved height was 4 mm and passed. The base has a requirement with the same ID and does not appear in the review. |
| J02 | PASS | The lid was edited in place to 5 mm. Studio's current check failed. After Finish, Undo and Redo, the original and approved measurements and both pins stayed fixed. The saved model retained its accepted bytes. The review did not create a project version. |
| J03 | PASS | A corrupted checkpoint kept the edited document and its prior review. A successful standalone native Open retired the review, even when opening the same accepted bytes. Boundary Undo and Redo did not restore it. Opening the checkpoint without a project restored the historical table. Fresh native project Open retained the model and left the table absent. |
| J04 | PASS | Focused checks validate the original and approved reports returned by the actual CLI checkpoint flow. Code review approved the final source and the architecture review was clear. |

The retained D600 worker record supplies the local checkpoint. The real CLI exports it, and Studio Open verifies it again. The analytic prism checks and native placed bounds remain separate. The new live 5 mm read is the existing Studio requirement check. The final browser driver verifies the original project log, absence of a new checkpoint version log and byte identity of both immutable worker files.

See [commands and hashes](qualification.json). Browser verification covers the listed replacement paths on one ordinary prism task. Other replacement paths were inspected in source. Durable review in a plain native file, in-Studio worker approval, whole suites, mobile and live providers are **NOT_RUN**. B09 remains 9/9 scoped groups. Four of ten initial scenarios have accepted v1 ledgers. Whole CAD and core readiness remain **NOT_MEASURED**. [#2279](https://github.com/barocss/barocss/issues/2279) and [#2402](https://github.com/barocss/barocss/issues/2402) remain open.
