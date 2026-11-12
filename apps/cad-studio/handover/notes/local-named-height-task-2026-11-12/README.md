# D782 — Approve a parameter-driven extrusion height

P1 and AI automation, rows 04, 09, 16 and 29. FULL interface qualification. The local planner derives a positive exact height target from the part's stated requirements. A worker can change the existing local parameter of one upright rectangular extrusion when that parameter drives only the height. The worker uses the existing Parameters operation. Candidate review and checkpoint intake reconstruct that operation from the same scope and exact source.

| Result | Check |
| --- | --- |
| PASS | CLI and Studio chat agree on the local plan. Studio previews and approves a 5 to 6 mm height change on Base. Only its local `Thickness` value changes. The raw extrusion binding, sketch, unused `Spare` value, and parameters with the same name on the assembly and sibling are preserved. The separate Lid height changes from 3 to 4 mm after rebuild and approval. |
| PASS | Studio opens the approved native checkpoints and saves the assembly to its project. After a fresh Open, the feature editor shows `Thickness` as the binding and displays 6 mm. The Parameters panel changes it to 7 mm. Finish, Save and a second fresh Open preserve the edited bytes and the raw binding. The source project file and durable approval retain their original bytes. |
| PASS | The strict native reader finds one shell, six planes and eight vertices. Independent Python expectations confirm 1,200 and 1,400 mm³ with centroids (13, 2, 3) and (13, 2, 3.5) mm. Absolute tolerance is 1e-8. The Studio preview and saved geometry were also visually reviewed. |
| PASS | Model 56/56 and Studio 44/44 focused tests, both type checks, and two mutation overlays. Missing, nonpositive, shared and configuration-owned bindings are refused in focused coverage. |
| PASS | Independent reviews traced scoped ownership and historical checkpoint reconstruction. The direct height API keeps its existing requirement-range semantics. The local planner derives a single stated exact target. |
| PASS | Desktop regression repeats the D781 width approval and exact legacy handoff/checkpoint replay. This also exercises the unchanged sibling literal-height path. Both desktop runs had zero unexpected console errors and downloads. |
| FAIL, first focused Model run | A retained D780 test still read the old helper result field after the operation became explicit. Its assertion was updated to check the operation. The final focused run passed. |
| NOT_RUN | Full suites, live LLM providers, mobile, multi-feature parameter edits and named-height profiles with cut features or circular sections. |

[Commands and receipt digests](qualification.json). Initial scenarios remain 8/10 and B09 v1 remains 9/9. Whole CAD and core readiness are **NOT_MEASURED**. [#2402](https://github.com/barocss/barocss/issues/2402) remains open.
