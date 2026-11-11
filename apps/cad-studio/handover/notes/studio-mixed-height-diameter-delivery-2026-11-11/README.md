---
work_id: D647
artifact_type: bounded-product-qualification
status: verified
last_updated: 2026-11-11
---

# D647 — Deliver a mixed height and through-hole diameter run in Studio

P0 automation, B09 follow-up, rows 04, 07 and 16. FEATURE qualification of the mixed local task workflow.

The desktop flow starts from a saved two-part model. It approves p1 at 6 mm height and opens that checkpoint. It rebuilds the p2 through-hole candidate on the first approved bytes, previews Ø4 to Ø6 mm, and approves the rebuilt attempt. It saves the final native assembly separately and opens it in a fresh project page.

| Group | Result | Evidence |
| --- | --- | --- |
| K01 | PASS | The Studio tool and CLI plan agree on p1 extrusion height and p2 through-hole diameter. The saved source reports current failures at 5 mm and Ø4 mm. |
| K02 | PASS | Studio approves height first at revision 9. The first publication keeps the original bore. An approval request for the retired diameter review returns 409 with no record change. |
| K03 | PASS | Studio rebuilds the diameter on the first accepted native file. The attempt moves from `2:2:p2` to `4:3:p2`. The preview shows Ø4 to Ø6 mm and −94.248 mm³. The second approval keeps p1 unchanged and publishes one native radius change from 2 to 3 mm. |
| K04 | PASS | Project Save and fresh Open preserve the second checkpoint bytes and the original project file. Both current requirements pass at 6 mm. The independent reader binds the files to two approvals and checks the rebuilt inner cylinder, full span, volume and centroid. |
| K05 | PASS | The Studio two-height delivery and independent-hole regressions, focused Studio tests, both type checks and browser syntax checks pass. |

[Commands and hashes](qualification.json). The chat test uses the scripted adapter and actual Studio tool path. Live providers, exchange export, the production build, whole kernel suites and mobile are **NOT_RUN**. B09 remains 9/9 scoped groups. Four of ten initial scenarios have accepted v1 ledgers. Whole CAD and core readiness remain **NOT_MEASURED**. [#2279](https://github.com/barocss/barocss/issues/2279) and [#2402](https://github.com/barocss/barocss/issues/2402) remain open.
