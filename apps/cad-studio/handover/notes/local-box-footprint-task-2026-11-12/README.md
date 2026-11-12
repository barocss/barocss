# D780 — Keep Box editable after paired footprint approval

P1 and AI automation, rows 04, 09, 16 and 29. FULL interface qualification. The existing paired footprint task accepts a standard upright Box. The minimum corner, extrusion height, native feature IDs and unedited command fields stay fixed. The new sketch operation explicitly retains the Box command and synchronizes its stored width and depth. The before and after nodes must both rebuild exactly through the existing Box editor. An endpoint must also satisfy the command's dimension limits.

| Result | Check |
| --- | --- |
| PASS | CLI and Studio chat agree on one Box task from 20 × 10 to 24 × 14 mm and one independent height task. Studio previews, approves and opens the exact native checkpoints. At the first approval only the Box's sketch extents and matching retained width and depth change on that occurrence. |
| PASS | Fresh project Open shows `Box 24×14×5`. A native depth handle opens `Edit Box`. The HUD keeps the 24 mm width, 5 mm height and origin (3, −3, 0) mm. The same command re-edits both extents to 25 × 15 mm. Studio Save updates the open project document and fresh Open reads the exact saved bytes. The original source project file and the approved durable run retain their exact bytes. |
| PASS | The strict native B-rep has one shell, six planes and eight vertices. Independent Python expectations confirm 1,680 mm³ after approval and 1,875 mm³ after the manual edit. Centroids are (15, 4, 2.5) and (15.5, 4.5, 2.5) mm. Absolute tolerance is 1e-8. |
| PASS | Model 52/52 and Studio 44/44 focused tests, both type checks, two independent audits and two mutation overlays. A decimal origin retains an exact 1 mm Box input. Stale command data and subminimum edits are refused. Unmarked historical proposals replay their original edit. Omitting a marked Box restores its sketch with its extrusion, including a batch that also deletes a Hole. |
| PASS | Desktop ordinary-rectangle footprint regression verifies the existing approval and native Save/Open path. Both final desktop runs have zero unexpected errors and downloads. |
| FAIL, first desktop drivers | The first two drivers reached the second Save with a locator that required the exact file label while the tab also announced unsaved changes. The third expected a new project path after renaming the tab. The final driver uses Save on the current file and verifies its persisted bytes after reload. |
| NOT_RUN | Full suites, live LLM providers, mobile, rotated or elevated Box profiles, and new single-axis Box command retention. |

[Commands and receipt digests](qualification.json). Initial scenarios remain 8/10 and B09 v1 remains 9/9. Whole CAD and core readiness are **NOT_MEASURED**. [#2402](https://github.com/barocss/barocss/issues/2402) remains open.
