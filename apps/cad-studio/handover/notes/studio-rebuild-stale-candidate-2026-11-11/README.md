---
work_id: D631
artifact_type: bounded-product-qualification
status: implemented-and-verified
last_updated: 2026-11-11
---

# D631 — Rebuild a stale candidate from Studio

P0 automation, B09 follow-up, rows 04, 12 and 16. FULL interface qualification.

The Studio run card offers Rebuild on a stale attempt with a stored submission. The service checks the run ID, status revision, accepted baseline, task and attempt. It verifies the stored input digest before acquiring the run writer. It then uses the same native rebuild operation as the CLI and returns a new candidate for review. Publication still requires a separate terminal decision.

| Group | Result | Evidence |
| --- | --- | --- |
| K01 | PASS | A terminal approval of the first part retires the second part's preview. The Studio Rebuild action sends one request for the stale attempt and returns a new candidate on the accepted baseline. |
| K02 | PASS | An older revision, wrong attempt and repeated request are refused without another writer. The original candidate pin cannot be reviewed after the rebuild. |
| K03 | PASS | A live writer or mismatched stored input digest refuses rebuild before any write. The accepted model and native objects remain the same during the successful rebuild. The operation consumes zero additional run units. |
| K04 | PASS | Studio previews the new 3 → 4 mm candidate and opens the final 6 mm and 4 mm parts after terminal approval. The independent reader confirms the exact byte chain and two terminal publications. |
| K05 | PASS | The reopened-baseline and three-task Studio paths, focused tests, type checks, lint and the Studio build pass. |

[Commands and hashes](qualification.json). Whole suites, mobile, live providers and dependent candidate rebuilds are **NOT_RUN**. B09 remains 9/9 scoped groups. Four of ten initial scenarios have accepted v1 ledgers. Whole CAD and core readiness are **NOT_MEASURED**. [#2279](https://github.com/barocss/barocss/issues/2279) and [#2402](https://github.com/barocss/barocss/issues/2402) remain open.
