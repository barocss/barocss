# D393 audit round 1 — CHANGES_REQUIRED (Opus, full tier)

Root, before the audit (actual run02 image review): the move gizmo of a selected part hidden as waiting floated in mid-air at steps 1–2 → fixed (shownSelection; no gizmo/outline for hidden waiting parts).

1. (wrong result) A stale step reference was silently remapped: a file with a step naming an unplaced p4 opened (kept, unresolved), then addPart handed out the id p4 and the step showed the new part as active, the report gone. Same id reuse in Studio insert, library insert, fasteners, chat add_part, facade — and D392's cut targets had the same hole.
2. (minor) Open accepted 'base' and 'p1/q' in a step and reported "base is not placed now".
3. (minor) Step name length unlimited in the model (panel caps 60).
4. (coverage) instGizmo guard, explode restore after close, camera, CommitText blur not asserted (the driver now asserts the gizmo and the explode label).

Verified fine: next/back/jump determinism and reorder; NO_STEP for bad indices; duplicates and malformed values refused on Open (also inside sub-assemblies); every remove path guarded (Studio Remove, chat delete_part, pattern count/skip/delete, seed delete); make independent / accept revision / edit in place keep ids; presentation only (evaluationKey excludes steps; exports read committed bodies; render/drawing hide the panel; explode restored on close); CommitText commits to the step it was typed on; index clamped. Mutations 12/12 caught.
