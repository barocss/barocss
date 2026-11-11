---
work_id: D635
artifact_type: bounded-product-qualification
status: implemented-and-verified
last_updated: 2026-11-11
---

# D635 — Show the native check that refused a local CAD task

P0 automation, B09 follow-up, rows 04, 10 and 16. FULL interface qualification.

The host records the first failed or unresolved native finding from its own evaluation. The task record binds the finding to the checked model revision, task occurrence, feature and attempt. Studio shows the gate, code and explanation in the failed task card. The read path returns a current finding only while its accepted model and specification match the attempt. A late result on a moved baseline goes stale before the host records a finding. Older run records can still open without a finding.

| Group | Result | Evidence |
| --- | --- | --- |
| K01 | PASS | Desktop Studio shows `PATTERN_MISALIGNED` for the assembly gate on p1 and `HOLE_OFF_PATTERN` for the contract gate on p2. Both details name the H1 issue on p2 and retain their distinct attempt and feature scope. |
| K02 | PASS | Fresh desktop Studio reopens the failed run from its exact handoff. Both findings survive status refresh. The unrelated approved working model and both run records remain unchanged. |
| K03 | PASS | The independent reader joins the checked revision to the exact failed-run native model and both persisted attempts. It verifies that the Studio snapshots retain the separate approved assembly. |
| K04 | PASS | Focused host checks hide a historical finding after a sibling publication and prevent a delayed failure from attaching to the new accepted model. The wire reader refuses a mismatched revision. |
| K05 | PASS | Desktop replacement provenance, focused suites, type checks, lint and build pass. |

[Commands and hashes](qualification.json). The desktop case exercises two dispatch-time failed findings. Decision-time revalidation details, an unresolved native gate in desktop, dependent tasks, whole suites, mobile and live providers are **NOT_RUN**. B09 remains 9/9 scoped groups. Four of ten initial scenarios have accepted v1 ledgers. Whole CAD and core readiness are **NOT_MEASURED**. [#2279](https://github.com/barocss/barocss/issues/2279) and [#2402](https://github.com/barocss/barocss/issues/2402) remain open.
