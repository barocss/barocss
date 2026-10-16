# cad-studio QA (studio-tester) — 2026-10-16
Branch claude/studio-tester-412a82, commit db4c26d18 (new files only under apps/cad-studio/test/qa/; no product code).
Full report: apps/cad-studio/test/qa/REPORT.md (steps, expected vs actual numbers, screenshots, suspected files).

Top findings for routing:
- W1 wrong geometry: overlapping shapes in one sketch → silent cut/notch instead of union (2 overlapping 10x10 rects → 375 mm³ vs 875). src/sketch/loops.ts profileOf (first-point containment). Touches the sketch-constraints lane.
- C1 crash: same function, both shapes' first points inside each other → TypeError loops.ts:71, Finish does nothing.
- W2 wrong geometry: fillet/chamfer > wall accepted and distorts body (R20 on 16 wall → 13651 mm³, bounds 32×31.6×16). packages/barocss-cad/src/edge-finish.ts lacks face-width check.
- W3 non-manifold: union of edge/vertex-touching boxes accepted as 1 body (2 lumps). upright Boolean path in part-model.ts.
- W4 pipe HUD shows Angle 360° but builds 90° (App.tsx ~356/380).
- R1 opening a non-STEP .step replaces the current part with a broken Import + generic toast (App.tsx open()).
- R2/R3 generic refusals: draft too steep, revolve 0° (errors.ts rules missing).
- D1 STEP reopen volume drift on NURBS (torus −0.065%); D2 two STEP solids reopen as 1 body; D3 arc length from polyline; D4 fillet volume ~1e-4 off at large R.
- U1 no feature delete anywhere; U2 "Removed N later features" counts sketch nodes; U3 tool keys swallowed after typing a sketch dimension.

## Second pass on 2d9c79bc (constraints + mates), commit see branch tip
All 15 first-pass findings still reproduce. REPORT.md headings now carry [core]/[sketch-constraints]/[assembly-mates].
- A1 [assembly-mates]: mate needing a non-quarter X/Y turn (block flush on a 45° chamfer / 30° tilted face) is accepted; rotation 44.99999999745556; placedDoc → kernel refuses "Only quarter turns"; instance shows "Bodies …" and vanishes. mates.ts solveAssembly vs doc.ts placedDoc.
- S1 [core]: ⌘Z while sketching discards the sketch AND undoes the previous feature (App.tsx doUndo → cancel()).
- S2 [sketch-constraints]: constraints/driving dims dropped at Finish (node keeps only points); no re-edit.
- A2 [core]: feature editor hidden while an instance is selected.
Constraints refusals (implied/conflict/limits) and mates (seat, re-solve after part edit + undo, missing face, conflict, flip, delete, loop) all work.

## Third pass on 635591fd (drawings, rectangle constraints, H/V distances)
All earlier findings still reproduce (UI 47/67, engine 116/126, constraints+mates 38/42, drawing 19/19).
- W5 [core]: union of really-overlapping tori (ring turned 30/45/90° about Z; circular pattern ×8) refused as "only touch along an edge" (analytic Boolean edge with 4 uses). Booleans with a torus also lose ~0.065% volume.
- S3 [sketch-constraints]: pressing Select/Dimension on a Rectangle-tool rectangle saves it as a polygon → feature editor loses Width/Depth/Corner (select.ts startPicking).
- DR1 [drawing]: instances not drawn on the sheet at the tip — drawings commits a20fedaae and f8123a6a0 (claude/studio-drawings-cd772f) are NOT ancestors of 635591fd.
- DR2 [drawing]: empty part → extra toast "Could not draw the part · Fix the model's errors first".
Drawing projection/layout/dimensions/SVG/PDF/persistence otherwise all correct.

## Fourth pass on 5b270428 (incl. 356c3a7f) — commit 7b2278646
UI 55/68, engine 118/126, constraints+mates 38/42, drawing 19/19, drawing SVG/PDF 19/20. No regressions.
Fixed (now passing): W4 pipe angle, R1 bad STEP, R2 draft refusal, R3 revolve 0°, D3 arc length, U2 removed-count toast, DR1 instances on the sheet.
New: DR3 [drawing] long title (52 chars) runs out of the 120 mm title block and off the A4 sheet (est. end x≈325 > 297); sheet.ts titleBlock.
Still open: W1, C1, W2, W3, W5, D1, D2, D4, U1, U3, A1, A2, S1, S2, S3, X1(info), DR2.
Drawings verified numerically from the exported SVG/PDF: outlines, hidden lines, centre marks/centrelines, instances (occlusion, dims to instances follow moves), title block, true-size SVG, PDF stroke count/dashes.

## Fifth pass on d5fa5fa6 (final; QA stopped here, 8e2c4b17 not covered)
Fixed: W1 (overlaps refused), C1, W2, W3, W4, W5 message, R1–R3, D3, U2, U3, A1, A2, S1, S2, S3, DR1, DR2, DR3. Open by design: D1, D2, D4, U1, X1, W5 kernel. Regressions: none (U42 union now a reasoned refusal).
New: S4 [sketch-constraints] dimensioned circle outside/crossing the outline becomes material (7751 / 7549 mm³ vs 7500 plate); A3 [assembly-mates] origin-plane mates default opposed → part flips 180°, third plane mate refused unless Flip; U4 [core] New part keeps an open sketch, its shapes go into the new part; U5 [core] chat panel without server logs a 502 console error.
