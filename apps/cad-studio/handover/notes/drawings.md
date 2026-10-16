# 2D drawings (session studio-drawings) — hand-over

## Summary (final, 2026-10-16)
Branch `claude/studio-drawings-cd772f`, tip a2243e587 (= tip 8e2c4b174 of claude/cad-studio-2026-10-16 merged in,
plus e0ebf30d7). Everything up to 37cc5e049 (DR3) is already in the integration branch; only e0ebf30d7 is new.

Commits (oldest first; merges of the integration tip into this branch left out):
- b900edec7 feat(cad): hidden-line projection of B-reps for 2D drawings
- 008bad3ab feat(cad-studio): drawing sheets from the part's hidden-line views
- c6761db48 feat(cad-studio): Drawing workspace
- be195ca60 fix(cad): circular edges seen through a concave face keep their visibility
- f3d215517 test(cad-studio): flow step for a dimensioned drawing and its SVG and PDF
- f8123a6a0 feat(cad): hidden-line name prefixes, circle sweeps, edges wholly under ink kept
- a20fedaae feat(cad-studio): centre marks and centrelines; placed instances on the drawing
- 7325a539c feat(cad-studio): angular dimensions on drawings
- 73b743ab5 feat(cad): tangent edges in hidden-line projections on request
- 6c31cdecf feat(cad-studio): tangent edges on drawings
- 357b5739a feat(cad-studio): section A–A on drawings
- 9b35a5fbb fix(cad-studio): no error toast when drawing an empty part (DR2)
- 37cc5e049 fix(cad-studio): title block fields fit their cells (DR3)
- e0ebf30d7 feat(cad-studio): tolerances and notes on drawings

What the Drawing workspace does: front/top/right/iso views from the kernel's hidden-line projection (exact lines
and arcs, cylinder silhouettes exact, other curves tessellated), third/first angle on A4/A3 at a standard or chosen
scale, title block; linear/diameter/radius/angle dimensions by persistent edge names (follow model edits) with
tolerances (±, upper/lower, fits); notes with optional leaders; centre marks/centrelines; optional tangent edges;
section A–A (plane Y = y); placed instances drawn; SVG (exact arcs) and vector PDF export; settings in doc.drawing.

Limits: dimensions only in front/top/right (iso refused) and not on the section view; one section, parallel to
the front view; no ordinate/baseline dimensions, BOM or balloons; silhouettes of non-cylindrical curved faces
are tessellation-accurate (12 segments per quarter); angle values are as projected in the view; text widths are
estimated from Helvetica metrics (5 % spare); the cad suite's native-split demo test pins Node 22.23.3 and fails
on 22.19 (pre-existing, unrelated).

Verified at a2243e587: app pnpm test 123/123, type-check clean; cad hidden-line tests 10/10, cad lint clean;
browser flow 44/44 on WebGPU, no page errors (one earlier run timed out on a screenshot in step 25, a sketch step;
the rerun passed).

---

## Detailed log

Branch: `claude/studio-drawings-cd772f` (worktree `.claude/worktrees/studio-drawings-cd772f`), cut from 1ff129f2.

## Kernel (packages/barocss-cad) — new file + 2 export lines
- `src/brep-hidden-line.ts`: `projectBrepHiddenLines(breps, { toward, up })` → exact 2D curves (lines, elliptic
  arcs of circular edges, polylines otherwise) + curved-face silhouettes (exact generators on cylinders), split into
  visible / hidden pieces (samples tested against the tessellated faces, changes bisected; hidden runs lying on
  visible ink dropped).
- `src/index.ts`: 2 export lines after the `tessellateBrep` exports. `test/brep-hidden-line.test.mjs` (7 tests).
- Rebuild `pnpm build:library` in packages/barocss-cad before the cad tests.

## App — new files (no merge risk)
- `src/drawing/{types,views,dimensions,sheet,svg,pdf,project}.ts`, `src/drawing/drawing.css` (imported by the
  workspace; styles.css untouched), `src/ui/DrawingWorkspace.tsx`, `test/drawing.test.ts` (8 tests).

## Shared-file edits (thin)
- `engine/doc.ts`: `StudioDoc.drawing?: DrawingSettings` right after `instances?` (+1 type import). The mates branch
  adds `mates?` next to `instances` too: adjacent-line conflict, keep both.
- `engine/evaluate.ts`: `brepsFor(doc)` appended at the end (+`type Brep` in the kernel import).
- `engine/engine.worker.ts`: `{ type: 'drawing' }` request; `engine/client.ts`: `drawing(doc)` method.
- `App.tsx`: 2 imports after the InstancePanel import; `drawing` state after `rendering`; `commitDrawing` before
  `commitDirect`; `start()` also clears drawing; key handler returns early while drawing (after ⌘Z/⌘S);
  Model/Render buttons clear drawing + a new "Drawing" mode button; `<DrawingWorkspace …/>` before the HUD; `open()`
  reads `parsed.drawing` with `readDrawing`.
- `test/browser-flow.mjs`: one step 'draw a plate: standard views, dimensions that follow the model, SVG and PDF'
  right after 'export the part as STEP'. It makes a new 64×32×8 plate + Ø8 hole, ends back in Model with that part.

## Not done / limits
- Dimensions only in the orthographic views (iso refused); no angular/ordinate dimensions or section views;
  tangent (smooth) edges are not drawn.

## Commits (on claude/studio-drawings-cd772f, base 1ff129f22)
- b900edec7 feat(cad): hidden-line projection of B-reps for 2D drawings
- 008bad3ab feat(cad-studio): drawing sheets from the part's hidden-line views
- c6761db48 feat(cad-studio): Drawing workspace
- be195ca60 fix(cad): circular edges seen through a concave face keep their visibility
- f3d215517 test(cad-studio): flow step for a dimensioned drawing and its SVG and PDF

Verified: cad `brep-hidden-line` 8/8 (full cad suite 824 of 829 pass, 4 skipped: the one failure is the pre-existing
native-split demo that pins Node 22.23.3), cad lint clean; app `pnpm test` 59/59, `pnpm type-check` clean;
browser flow 32/32 on WebGPU with no page errors. pnpm-lock.yaml is dirty from install only (not committed).
The new step is #25; it leaves a new part (64×32×8 plate, Ø12 hole, a drawing with 2 dimensions) in Model.

## Follow-up (2026-10-16, second round)
- d07bbd2e4 merge of the integration tip claude/cad-studio-2026-10-16 (2d9c79bcb: constraints + mates) into this
  branch — conflicts pre-resolved (doc.ts drawing?+mates?, App imports, drawing key guard before Escape), so
  merging this branch into the tip should now be a fast-forward / conflict-free.
- f8123a6a0 feat(cad): hidden-line name prefixes, circle sweeps, edges wholly under ink kept (pieces may be []).
- a20fedaae feat(cad-studio): centre marks + centrelines (pen 'center', setting `centers?: false`), shown
  instances drawn beside the part with edges named `<instanceId>/<edge>`; brepsFor returns {breps, prefixes}.
  App.tsx: DrawingWorkspace gets `doc={{ ...evaluated, instances: doc.instances }}` (one line).
Verified on the merged branch: app pnpm test 75/75, type-check clean; cad hidden-line 9/9, lint clean;
browser flow 34/34 on WebGPU, no page errors. Instances on the sheet are unit-tested, not driven in the UI.

## Third round (2026-10-16)
- fb6487c1e merge of the integration tip (635591fd4) into this branch — clean, no conflicts.
- 7325a539c feat(cad-studio): angular dimensions on drawings
  Angle tool (A): two straight edges + placement sector; DrawingDimension kind 'angle' { a, b: EdgeRef, place }.
  Flow step now also places a 90° angle (3 dimensions; later assertions updated).
Verified: app pnpm test 79/79, type-check clean; browser flow 36/36 on WebGPU, no page errors.
(f8123a6a0/a20fedaae were merged in 356c3a7fa; the angle commit was not — see the fourth round.)

## Fourth round (2026-10-16): tangent edges
- 73b743ab5 feat(cad): tangent edges in hidden-line projections on request
- 6c31cdecf feat(cad-studio): tangent edges on drawings
  Kernel option tangentEdges (ProjectedEdge.tangent), drawing setting `tangent?: true` (off by default, thin pen);
  client.drawing(doc, { tangentEdges }) / worker request gains optional `options`.
Verified: cad hidden-line 10/10, lint clean; app pnpm test 80/80, type-check clean; flow 36/36 on WebGPU;
checked a filleted plate in the app (thin tangent lines in top, front and iso views).
Correction: the tip 356c3a7fa had drawings only up to a20fedaae. 951075315 merges the tip 5b270428b into this
branch (clean); on top of it: unit 85/85, type-check clean, flow 37/37 on WebGPU, no page errors.
Waiting for the tip: 7325a539c (angle), 73b743ab5 + 6c31cdecf (tangent edges) — merging this branch is conflict-free.

## Fifth round (2026-10-16): section A–A
- 357b5739a feat(cad-studio): section A–A on drawings — new src/drawing/section.ts (worker: split each body
  the plane Y = y crosses with the kernel's split feature, keep the far side, project like the front view,
  cut-face rings), hatch()/cutting plane in sheet.ts, layout row under the front view, setting
  `section?: { y }`; worker drawing request options gain `section`. Flow step turns it on (rings 2, SVG label).
- 7df4eea3b merges the tip abc47f67a into this branch (clean).
Verified on the merged branch: app pnpm test 104/104, type-check clean; browser flow 40/40 on WebGPU, no page
errors; looked at the exported SVG and PDF (hatched cut faces either side of the hole, A–A arrows in top view).
Waiting for the tip: 7325a539c (angle), 73b743ab5 + 6c31cdecf (tangent edges), 357b5739a (section) — conflict-free.
Limits: one section only, its plane parallel to the front view; no dimensions on the section view.

## QA DR1/DR2 (2026-10-16)
- DR1 confirmed at the tip abc47f67a itself (temporary detached worktree): unit 99/99 incl. 'placed instances are
  drawn too', and in the real UI an inserted instance draws beside the part in all four views (auto 1:2, no page errors).
- DR2 fixed: 9b35a5fbb fix(cad-studio): no error toast when drawing an empty part (DR2). Unit 105/105, flow 40/40 on WebGPU.
Unmerged on this branch (on top of tip abc47f67a, conflict-free): 7325a539c angle, 73b743ab5 + 6c31cdecf tangent
edges, 357b5739a section A–A, 9b35a5fbb DR2.

## QA DR3 (2026-10-16)
- Tip c9611d272 merged first (fast-forward). 37cc5e049 fix(cad-studio): title block fields fit their cells (DR3) —
  new src/drawing/text.ts (textWidth moved from pdf.ts, fitText: shrink to a floor, then ellipsis); sheet.ts
  titleBlock uses it for the title (5 → 3 mm, up to the projection symbol) and the four cell values (3.5 → 2.2 mm).
  Unit 109/109 (new extent test), type-check clean, flow 40/40 on WebGPU; SVG and PDF of the 52-char title checked.

## Tolerances and notes (2026-10-16)
- e0ebf30d7 feat(cad-studio): tolerances and notes on drawings — DrawingDimension gains `tol?: Tolerance`
  (symmetric ±, deviation upper/lower stacked, fit code); DrawingSettings gains `notes?: DrawingNote[]`
  ({ id, text, at sheet mm, leader?: { view, at } }). sheet.ts valueMarks/toleranceText/noteMarks; Note tool (N),
  tolerance + note editors in the panel, note drag/delete. Flow step adds ±0.1 on the width and a note.
- a2243e587 merges the tip 8e2c4b174 (clean).
Verified on the merged branch: unit 123/123, type-check clean, flow 44/44 on WebGPU (one earlier run hit a
screenshot timeout in step 25, a sketch step before mine; the rerun passed). SVG and PDF checked.
Waiting for the tip: e0ebf30d7 (and the merge a2243e587) — conflict-free.
