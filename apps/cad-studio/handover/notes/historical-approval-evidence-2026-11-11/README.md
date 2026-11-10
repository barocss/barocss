---
work_id: D595
artifact_type: historical-approval-evidence
status: verified
last_updated: 2026-11-11
---

# D595 — Read saved approval evidence after a later edit

P0 automation, rows 04, 12 and 16. FEATURE qualification of a saved target in Studio Versions. The default comparison still targets the working document. A saved target names both versions and labels its requirement rows as saved approval checks.

Both saved endpoints belong to the active project, part and branch list. Each snapshot is checked by the existing version reader. The report reuses the exact approval and unchanged-criterion rules from D594. A saved-to-saved comparison reads the snapshots without restoring either document. It produces no geometry overlay on the working model. Working comparison overlays belong to the current document and selected version, with a separate cancellation lane from the proposal preview.

| Group | Result | Evidence |
| --- | --- | --- |
| V01 Working regression | PASS | Actual Studio edits p1 in place from 10 to 12 mm and shows a failing height check. The evaluated body volume matches the independent 20 × 10 × 12 mm calculation within 1e−8 mm³. The p2 control and the approval history stay unchanged. Studio saves the third version and reopens the same working document. |
| V02 Historical approval | PASS | Selecting Initial failure and Approved correction displays p1's saved 11 to 10 mm and 2,200 to 2,000 mm³ Fail → Pass results. The viewport stays at the failing 12 mm working revision and has no version overlay. The working comparison shows no approved recovery for that revision. |
| V03 Target and ownership controls | PASS | Switching to the later saved version removes the approval rows. A held read cannot reappear after a target change. Returning to Working restores its comparison overlay. The native file, log and all three snapshots retain their exact hashes through the review. A separate writer's valid log replacement drops the old overlay and retains the working model. |

- **PASS** — Ten desktop snapshots, 77 focused Studio checks, 41 Model checks, types, production build and syntax.
- **FAIL** — The baseline had no saved comparison target after a later edit. The final scoped run passes. Initial harness runs also exposed a strict floating-point equality and a stale control label. Both harness corrections are retained in the run record.
- **FAIL** — One final desktop reload showed an unreadable automatic recovery copy. The main document and all required version reads passed. The warning was absent from two earlier runs. Recovery consistency is a separate D596 reproduction target.
- **NOT_RUN** — Nested occurrence matching, defect lifecycle beyond the admitted versions, whole browser and kernel suites, live providers, mobile and release.

[Issue #2279](https://github.com/barocss/barocss/issues/2279) remains open. B09 v1 stays 9/9 and four of ten initial product scenarios have accepted v1 evidence. Whole CAD readiness remains NOT_MEASURED.

[Commands and evidence custody](qualification.json).
