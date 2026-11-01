# D395 audit round 1 — CHANGES_REQUIRED (Opus, full tier)

Verified fine: canonical key order through chat set_drawing, readDrawing, Save/Open; `kind: 'point'` dropped on read with old rows unchanged; area size = model mm × view scale at scales 1, 2, 0.5; 90° reorient of rectangle corners for x±/y+ on front/top/right; hatch spacing exactly 1 mm, nothing outside the outline, tiny areas give no hatch and no NaN (SVG, PDF, DXF 2000/R12, 3D); DXF linetype table before layers, BC_PHANTOM total = sum of dashes, PHANTOM absent without targets; DATUM_UNDEFINED counts line/area letters; reference signatures leave line/area rows alone; notation "Ø6"/"6×4" above the split.

1. (medium) Line and area targets never went stale: after the part shrank, a half-in-the-air line and a far area raised nothing but OFF_SHEET.
2. (medium) Moveable symbol drawn as a separate triangle above the circle; ASME draws the circle drawn out to a point by two tangent lines; a leader leaving upward crossed the triangle.
3. (low-medium) Line target mixed standards (ASME phantom line + ISO X ends).
4. (low) JSON schema looser than the checker (missing per-kind fields, no maximum) → refusal round trips for agents.
5. (low) Test gaps: hatch spacing, rectangle key order, area scale ≠ 1, PHANTOM only when used, non-zero depth plane, the references guard.
6. (low, Studio) Kind change left a pending line pick; moveable toggle on legacy point rows refused with the strict message; short phantom lines look solid.
Mutations 21/28 caught.
Root image review (run02, zoomed render of the exported SVG): split symbols, Ø4 above the split, hatch inside the phantom circle, leader to a dot; the A1 symbol collided with the TOP view title because of the driver's chosen placement (moved in the next run).
