---
work_id: D639
artifact_type: bounded-product-qualification
status: implemented-and-verified
last_updated: 2026-11-11
---

# D639 — Reopen a stopped CAD run with historical native findings

P0 automation, B09 follow-up, rows 04, 12 and 16. FEATURE qualification.

Stop changes unfinished tasks to cancelled and retains their attempt records. The run reader now accepts a cancelled task's historical native finding when the stopped run contains the matching failed native operation. Current status omits those historical findings. The accepted native model can still open through the existing baseline action.

Studio chat omits the local filesystem path from run cards and user-facing start errors. The baseline Open notice states that the model is open on inactive runs.

| Group | Result | Evidence |
| --- | --- | --- |
| K01 | PASS | The previously unreadable stopped run now returns CLI status. Its existing record remains byte-identical. |
| K02 | PASS | Desktop Studio starts the failed H1 run, observes two native findings, and reopens the same run after terminal Stop. The card shows both tasks cancelled and offers no review, rebuild, replacement or chat evidence action. |
| K03 | PASS | Explicit baseline Open reads the exact native bytes. Reopen and Refresh leave the separate working model in place until that action. The run's budget, earlier native findings and native object hashes remain intact. |
| K04 | PASS | The mixed completed and failed case keeps its earlier approval and native baseline. Selected evidence refuses after Stop. The reader refuses a historical finding whose operation does not match. |
| K05 | PASS | Actual active and stopped chat cards omit the local directory. A failed start on an unreadable existing run returns a path-free message. The stopped baseline notice states that the model is open. |
| K06 | PASS | The independent byte reader, desktop active-baseline regression, focused suites, type checks, lint and build pass. |

[Commands and hashes](qualification.json). The original boundary check **FAIL** left an unreadable stopped record. The first repaired desktop check exposed a misleading baseline notice. The final desktop check verifies the corrected text and path visibility. Live model behavior, whole CAD suites, mobile, and Stop while an initial worker is active in Studio are **NOT_RUN**. B09 remains 9/9 scoped groups. Four of ten initial scenarios have accepted v1 ledgers. Whole CAD and core readiness remain **NOT_MEASURED**. [#2279](https://github.com/barocss/barocss/issues/2279) and [#2402](https://github.com/barocss/barocss/issues/2402) remain open.
