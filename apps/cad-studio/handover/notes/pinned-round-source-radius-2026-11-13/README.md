# D892 — retain a finite round when its source radius changes

2026-11-13 · FEATURE · P1 rows 09 and 16 · [#2282](https://github.com/barocss/barocss/issues/2282) remains open.

On the parent, changing the source arc from R20 to R16 produced the expected native geometry. Entering R10 then produced a draft marked Fully defined even though the exact line and arc contacts coincide at R10. The panel showed rounded X coordinates 20.0008 and 20.0014 mm at the nominal collapse. Cancel retained the committed R16 part. A separate focused run reproduced the same false acceptance after clearing the source lock and entering R10.

Apply the finite-contact guard to a change in either driving radius, one at a time. On a source edit, keep the R4 fillet, anchor, fixed endpoint, horizontal and vertical constraints, and original winding. Move the source center along the perpendicular through the fixed end. Preserve the normal unlock action. When a source radius is re-locked, use its actual arc to recover the previous radius, then require the full prior outline to match the same finite solution before calculating the new branch. Generic edits retain their current path.

## Acceptance

For the selected counterclockwise XY and clockwise XZ outlines, desktop Studio WebGPU created R4 on an R20 source, changed the source to R16 through the outline panel, and verified Undo, Redo, OPFS Save and fresh Open. R10 was refused in the panel and in a separate on-canvas edit. Removing the source lock left one degree of freedom. An invalid R10 re-lock preserved that unlocked shape and committed history. Re-locking at R18 in the on-canvas editor restored a fully defined outline. The R18 Undo and Redo returned the exact accepted documents.

The independent oracle checks finite contacts, centers, native radii, cap vertices and extruded volume within 1e-8 mm and 1e-7 mm³. Source side e2 and fillet side e5 stayed on the same native cylinders. Extrude n1 and its output reference stayed unchanged. The R16 and R18 volumes expected from the independent boundary are 6616.283004441058 and 6865.290693253592 mm³, respectively. The prior reflected fillet-radius workflow also passed. Commands, native values and evidence hashes are in [qualification.json](qualification.json).

The first post-fix driver run used a driving-label selector after the source was unlocked. The reference-label selector corrected that driver failure. Full suites, mobile, arbitrary orientations, unlocked fillet re-lock, simultaneous edits of both radii, and downstream measurement were NOT_RUN. Next, verify real Measure picks and native names on the retained arc and fillet after rebuilding.
