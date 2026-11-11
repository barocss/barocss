---
work_id: D638
artifact_type: bounded-product-qualification
status: verified
last_updated: 2026-11-11
---

# D638 — Deliver both height edits on the repaired H1 assembly

P0 automation, B09 follow-up, rows 04, 10, 12 and 16. FEATURE qualification of the existing workflow.

Studio starts from the saved shared hole repair. The first terminal decision accepts p1 and retires the earlier p2 attempt. Studio rebuilds p2 on the exact first checkpoint. The second terminal decision accepts that rebuilt candidate. The final approved native bytes are saved as a third project document.

| Group | Result | Evidence |
| --- | --- | --- |
| K01 | PASS | The first terminal publication moves p1 from 5 to 6 mm and retains p2 at 3 mm. The old p2 terminal receipt refuses while stale and after rebuild. The live Studio review request for the retired pin also refuses. |
| K02 | PASS | One explicit Studio Rebuild produces a new p2 attempt on the first checkpoint. Review shows 3 → 4 mm and +83.434 mm³. The underlying approved model remains at 6 and 3 mm while the candidate is shown. Rebuild publishes zero native states and uses zero additional units. |
| K03 | PASS | Both terminal receipts bind to one run and two native publications. The second input exactly equals the first output. The second output, saved project document and fresh Studio document bytes match. The earlier repair, both original runs and the two earlier project files retain their bytes. |
| K04 | PASS | Fresh Studio requirement reports read both hard checks as pass at 6 and 4 mm. The independent oracle verifies all three native states, H1, placements, exact cylindrical axes, twelve rational trim planes, volumes, centroids and the authored model edit boundaries. |
| K05 | PASS | Desktop repair regression, focused suites, type checks, driver syntax and Studio build pass. |

The initial repaired state measures 5 and 3 mm. Both Ø4 holes keep their common axis through XY (5, 5) in all three states. The delivered volumes are 1124.601776314 and 333.734517543 mm³. Geometry comparisons use an absolute tolerance of 1e-8. The two authored height tolerances are 0.001 mm. [Commands and hashes](qualification.json).

The initial desktop run passed the workflow and reused an earlier terminal receipt file name. The final run retains both sets of receipts in separate evidence directories. The fresh Open capture is partially framed. Current placed bounds and native readback establish the geometry. Full viewport framing, live model behavior, downstream exchange, whole suites and mobile are **NOT_RUN**. B09 remains 9/9 scoped groups. Four of ten initial scenarios have accepted v1 ledgers. Whole CAD and core readiness are **NOT_MEASURED**.

A separate copied-run boundary check found that Stop succeeds on a run with native failure findings but the next status read fails. The accepted native checksum remains intact. D639 covers stopped-run readability and Studio Open. [#2279](https://github.com/barocss/barocss/issues/2279) and [#2402](https://github.com/barocss/barocss/issues/2402) remain open.
