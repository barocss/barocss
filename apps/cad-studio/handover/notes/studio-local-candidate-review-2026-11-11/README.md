---
work_id: D620
artifact_type: bounded-product-qualification
status: implemented-and-verified
last_updated: 2026-11-11
---

# D620 — Review a held local candidate directly in Studio

P0 automation, B09 follow-up, rows 04, 12 and 16. FULL interface qualification.

Select **Review** beside a held task in the existing local run row. Studio opens Project & versions and shows the candidate for its exact occurrence. **Show accepted model** restores the accepted viewport. Reopening the candidate requests a fresh verification. The terminal operator still controls approval, rejection and publication.

The loopback route accepts a bounded set of identifiers, including the service-owned run key and the working baseline digest. It reads the current run without a writer lease. It verifies the run, task, attempt, digest and accepted baseline. Studio checks the native baseline bytes and model digest, reconstructs the candidate and evaluates the part and its placement. It checks the same held receipt again before display. A newer working document or review intent retires a late response. A competing view blocks the action. Collapsing the review restores the accepted viewport.

| Group | Result | Evidence |
| --- | --- | --- |
| K01 | PASS | Actual Studio opens both candidates from the same run row. Preview bounds are 6/3 mm for p1 and 5/4 mm for p2. Only the reviewed occurrence changes. Independent rectangle arithmetic confirms candidate volumes of 1,200 and 384 mm³ and deltas of +200 and +96 mm³. |
| K02 | PASS | Review opens a collapsed Versions section. Closing it or showing the accepted model restores 5/3 mm. Parameters blocks the action. Closing Versions during verification prevents a late response from reopening it. Both reviews and repeat display preserve the working document, saved native file, run record and run directory entries. Undo and Redo retain their initial availability. |
| K03 | PASS | A terminal rejection during the second read returns 409 and Studio leaves the accepted viewport visible. Studio also refuses a different working baseline and a malformed final response with HTTP 200. |
| K04 | PASS | Focused checks refuse nonlocal requests, invalid keys, a symlinked run, mismatched run/task/attempt/digests and an oversized request. Seven isolated overlays exercise the server guards. |
| K05 | PASS | The actual offline review regression still opens, evaluates and previews a portable candidate. The terminal separately approves p1 and Studio reopens the approved checkpoint. |

The preview records what the local run held at its last successful check. The row reports the launch snapshot. An explicit review verifies current state even if a terminal decision has changed that snapshot. The tested profile is two static extrusion-height occurrences. [Commands and hashes](qualification.json).

Live providers, mobile, whole suites, other task profiles and a live status feed are **NOT_RUN**. B09 remains 9/9 scoped groups. Four of ten named initial scenarios have accepted v1 ledgers. Whole CAD and core readiness are **NOT_MEASURED**. [#2279](https://github.com/barocss/barocss/issues/2279) and [#2402](https://github.com/barocss/barocss/issues/2402) remain open for broader acceptance.
