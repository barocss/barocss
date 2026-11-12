# B05 v1 — Static linked assembly evidence ledger

[Product baseline](04-product-baseline.md) · [Core workflows](02-core-workflows.md) · [D758 repeated linked placement](../notes/static-assembly-linked-placement-2026-11-12/README.md)

## Frozen scope

B05 v1 qualifies ordinary, small static assemblies. The matrix uses separate declared profiles for repeated placement, planar and axial mates, nested revisions, BOM and issued drawings. A retained proof is tied to its source, fixture and consumer. An integrated combination needs its own receipt.

The repeated-placement profile uses one authored 30 × 12 mm rectangular extrusion in a local project. The linked source moves from 6 to 8 mm in depth. Two occurrences share the one definition and keep separate translations. A native check reads the two exact instance documents. An independent calculation uses 360H mm³ and local centroid [15, 6, H/2]. The viewport reports each accepted world bound against its explicit translation.

## Seven action groups

| ID | Required action and result | Evidence |
| --- | --- | --- |
| B05-01 | Insert an authored project part, duplicate it and move only one occurrence. Check distinct occurrence IDs, the shared definition and file link, separate placements and current geometry. | **PASS, current Studio D758**. [D456](../notes/bom-parameter-identity-2026-11-03/README.md) retains independent W60/W80 definitions and parameter-specific grouping. |
| B05-02 | Edit the linked source. Keep both placed copies at the last accepted revision while the offer waits. Explicit Accept updates both definitions and retains each position. Check first Undo/Redo, local-project Save and fresh Open, then move one copy again. | **PASS, current Studio D758**. [D457](../notes/static-mate-linked-update-2026-11-03/README.md) retains a related planar-mate revision. |
| B05-03 | Ground one part, add supported planar Coincident references and observe the remaining freedom. Close the selected three-plane chain, reject a conflicting distance, then follow an accepted source revision with the same references and solve state. | Retained [D457](../notes/static-mate-linked-update-2026-11-03/README.md) and [D493](../notes/fully-constrained-mate-workflow-2026-11-04/README.md). Current consumer pending. |
| B05-04 | Mate an ordinary pin and holder through the public concentric and distance controls. Check axes, separation, a bounded conflict refusal, history and native project reopen. | Retained [D458](../notes/concentric-distance-workflow-2026-11-03/README.md). Current consumer pending. |
| B05-05 | Select an exact nested occurrence, change its linked definition and keep the accepted occurrence and native mate references through Keep and Accept. Verify the selected card and current geometry, history and project reopen. | Retained [D512](../notes/nested-selection-bom-revision-2026-11-04/README.md), [D513](../notes/nested-card-freshness-2026-11-04/README.md) and [D707](../notes/bom-nested-currentness-2026-11-11/README.md). Current selected mate and UI binding pending. |
| B05-06 | Edit material and a pattern or skip value. Check exact quantities, material inheritance and independently computed total mass. Check first Undo/Redo and native reopen. | Retained [D511](../notes/patterned-material-bom-mass-2026-11-04/README.md) and [D706](../notes/bom-project-csv-readback-2026-11-11/README.md). Combined selected pattern/skip and material profile pending. |
| B05-07 | Issue a drawing for an assembly, change the accepted placement or linked geometry, and verify the stale notice and current drawing source. Issue the next revision and reopen the project with exact drawing and assembly data. | Retained [D459](../notes/assembly-drawing-revision-2026-11-03/README.md). Current consumer pending. |

D758 qualifies 2/7 selected groups. B05 v1 remains pending until the five remaining groups qualify. The original scenario count stays 5/10 while B05 is pending. Whole CAD and core readiness remain **NOT_MEASURED**. Motion, Physics, broad solver and large assembly scopes remain outside this matrix.
