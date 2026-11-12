# D779 — Approve rectangle width and depth together

P1 and AI automation, rows 04, 09, 16 and 29. FULL interface qualification. One local task reads two stated exact local X and Y requirements and changes both extents of one ordinary rectangular sketch. The same task, lease, candidate and approval cover both values. The minimum corner, stable side tags, extrusion, occurrence placement and sibling stay fixed at the first approval. The two effective extents must meet their own requirements before the edit reaches evaluation.

| Result | Check |
| --- | --- |
| PASS | CLI and Studio chat agree on p1/n0 width × depth 20 × 10 → 24 × 14 mm and p2/n1 height 3 → 4 mm. Studio preview shows both extents and +680 mm³. One explicit p1 approval publishes both changes. The sibling's old review retires and can be rebuilt and approved separately. |
| PASS | Both exact checkpoints open. The final native project saves and opens after a fresh page load. Width and depth each report a current pass. The feature editor changes both again to 25 × 15 mm. Original project bytes, saved approval and durable run stay exact. |
| PASS | Direct strict B-rep readback checks six planes and eight vertices. Independent Python expectations confirm the minimum corner (3, −3, 0) mm, approved maximum (27, 11, 5) mm, re-edited maximum (28, 12, 5) mm, volumes 1,680 and 1,875 mm³, and centroids (15, 4, 2.5) and (15.5, 4.5, 2.5) mm. Absolute tolerance is 1e-8. |
| PASS | Model 25/25 and Studio 44/44 focused tests, both type checks, two independent audits and two mutation overlays. Partial, swapped, unrepresentable and unstated values are refused. Changing only the depth under the same CLI operation ID conflicts. A rechecksummed scalar checkpoint scope is refused. Paired repair verifies both unchanged failed criteria. Stale replacement retains both criteria and the same sketch. |
| PASS | Desktop width regression opens the D622 height checkpoint. Desktop circular regression approves and re-edits the native cylinder. The three desktop runs have zero unexpected errors or downloads. |
| FAIL, first checks | Initial type checks found scalar-only assumptions. The first mutation runner expected an assertion code, while the depth-drop mutation reached the test's explicit evaluator refusal. The final runner verifies that refusal and detects the removed native-plane gate. |
| NOT_RUN | Full suites, live LLM providers, mobile, and the standard Box command's paired edit. The current footprint scope requires an ordinary sketch and extrusion. |

[Commands and receipt digests](qualification.json). Initial scenarios remain 8/10 and B09 v1 remains 9/9. Whole CAD and core readiness are **NOT_MEASURED**. [#2402](https://github.com/barocss/barocss/issues/2402) remains open.
