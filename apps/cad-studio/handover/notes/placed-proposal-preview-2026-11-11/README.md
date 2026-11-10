---
work_id: D593
artifact_type: placed-proposal-preview
status: verified
last_updated: 2026-11-11
---

# D593 — Preview geometry at the affected placement

P0 automation and viewport, rows 04, 10 and 16. FEATURE qualification for a proposal that changes one visible placed part at its current position and rotation.

Actual Studio showed +0 mm³ and both plates remained 11 mm high while the proposal was in its After state. The base part has no bodies in the retained assembly fixture. The old preview used only base-part geometry and volume.

Studio now resolves the candidate with its existing placed-part worker. It compares the before and after evaluation inputs by occurrence ID and uses candidate bodies only in the viewport. The volume includes the measured change for affected placed bodies. Before and Hide restore the accepted bodies. The candidate bodies cannot supply picks to the accepted model. When a proposal changes placement membership, pose or visibility, the existing preview card explains its scope and omits the volume delta.

| Group | Result | Evidence |
| --- | --- | --- |
| V01 Placed candidate | PASS | Actual Studio After displays p1 at 10 mm and p2 at 11 mm. The delta is −200 mm³. The viewport receives the candidate only for p1. |
| V02 Review and acceptance | PASS | Before and Hide restore both 11 mm heights. Preview and toggles retain exact document bytes, selection and history. Explicit Accept changes only p1 and records one approval. |
| V03 Controls | PASS | The existing base-only preview displays −200 mm³ and −9.09%. An unsupported placement change retains the accepted display and shows a scope message without a numeric delta. |

The independent oracle computes 20 × 10 × (10 − 11) = −200 mm³ and checks the world bounds of both placements in four captured states to 1e−6 mm. Desktop Studio uses the D592 assembly and D591 base input. No new geometry or Boolean method is involved.

- **PASS** — Six actual desktop states, 82 focused checks, independent arithmetic, types, build and source freeze.
- **FAIL** — The initial actual Studio run displayed +0 mm³ and kept p1 at 11 mm during After. The initial Studio type check caught a nullable body volume. The final run and type check pass.
- **NOT_RUN** — Motion, section and render combinations, broad assembly authoring, nested occurrence evidence, whole browser/kernel suites, mobile, live providers and release.

The placed comparison is for body geometry at existing visible placements. The proof leaves durable defect resolution and broad issue #2279 acceptance open. B09 v1 remains 9/9. Four of ten initial product scenarios have accepted v1 evidence. Whole CAD readiness remains NOT_MEASURED.

[Commands and evidence custody](qualification.json).
