# Decision records — outer lane (O-numbers)

The outer lane's records (owner, 2026-10-19: one kernel lane plus this outer lane; the coordinator merges):
R11b DXF writer → R14 automatic drawings → A5 DSL + MCP → RM1–RM6 robot kinematics (→ RD1–RD3). The kernel
lane keeps `decisions.md` (D-numbers). Same format: what was decided, why, what it binds. Newest last.
Conformance cases: `packages/barocss-cad/conformance/r11b/`, `r14/`, `a5/`, `rm/`.

## O1 — R11b: our own DXF writer, AC1015 by default with an R12 option; drawings, sections and sketches (2026-10-19)

- **What**: `packages/barocss-cad/src/dxf-writer.ts` (`writeDxf`, contract `barocss-dxf-writer-v1`), a new kernel file; no core file touched. Input a plain document (units, layers, line types, text styles, blocks, entities in drawing units); output deterministic text and its bytes (handles numbered in writing order, no time stamps: the same document gives the same file).
  - Entities: LINE, CIRCLE, ARC, ELLIPSE, LWPOLYLINE with bulges, SPLINE (NURBS, rational or not), TEXT, MTEXT, SOLID, HATCH (solid, or one family of lines at an angle and spacing through an origin; loops with bulges), INSERT of a BLOCK, DIMENSION (linear, aligned, angular, diameter, radius) with its anonymous block `*D<k>` holding what it shows.
  - AC1015 is written whole: handles and owners, subclass markers, the nine tables (block records included), `*Model_Space`/`*Paper_Space`, the Model and Layout1 layouts, the root, group, layout and plot-style dictionaries. `$INSUNITS`, `$MEASUREMENT`, `$EXTMIN/MAX`, `$HANDSEED`; layers carry colour, line type and line weight.
- **R12 (AC1009)**: written without what R12 lacks, each change counted in the report (`report.r12`), none silent:
  - LWPOLYLINE → POLYLINE/VERTEX/SEQEND (exact); MTEXT → one TEXT a line (exact placement, MTEXT's 5/3 spacing);
  - ELLIPSE and SPLINE → polylines only within an explicit `r12ChordTolerance` (refused `R12_NEEDS_TOLERANCE` without it), halved until every side lies within it, measured at 7 points a side (`maxChordDeviation`); `APPROX_TOLERANCE_NOT_MET` past 4096 sides a span;
  - a line hatch of straight-sided loops → its lines (exact, the same family); a solid hatch or one with arc sides is refused `R12_UNSUPPORTED`;
  - no `$INSUNITS` and no line weights in R12 (`unitsNotStored`, `lineweightsDropped`).
- **Text**: the files are Windows-1252 (`$DWGCODEPAGE ANSI_1252`, R12 and R2000's native form): Ø ° ± as `%%c %%d %%p`, `%` as `%%%`, other Windows-1252 characters as their byte, the rest as `\U+XXXX`. First written as 7-bit ASCII with `\U+` for every non-ASCII character: the oracle (ezdxf) reads `\U+` in R2000 TEXT literally (“SECTION A\U+2013A” in its render), so code-page bytes were taken. Control characters, characters outside the BMP, a TEXT over 250 characters are refused typed; MTEXT goes in 250-character chunks.
- **Numbers**: the shortest decimal that reads back to the same binary64, never in exponent form (below 1e-6, 20 places); |x| ≥ 1e15 refused. So coordinates are exact, not to 1e-9 only.
- **Typed refusals** (`DxfWriteError`, `DXF [CODE]: …`): `NOT_FINITE`, `BAD_ENTITY`, `BAD_NAME` (DXF's forbidden characters, the code page, R12's A–Z 0–9 $ _ - up to 31), `DUPLICATE_NAME` (case-insensitive), `UNKNOWN_LAYER/LINETYPE/STYLE/BLOCK`, `BLOCK_CYCLE`, `BAD_TEXT`, `TEXT_TOO_LONG`, `R12_UNSUPPORTED`, `R12_NEEDS_TOLERANCE`, `APPROX_TOLERANCE_NOT_MET`. A dimension inside a block, or a dimension block holding an insert or a dimension, is refused.
- **Studio** (`apps/cad-studio`):
  - `src/drawing/dxf.ts` (`cad-studio-sheet-dxf-v1`): the sheet at true size, one unit a paper millimetre, y up from the sheet's bottom edge, as the SVG and PDF print it. Layers are the pens (VISIBLE 0.50, HIDDEN 0.35 dashed 3/1.5, THIN 0.25, CENTER 0.25 chain 8/1.5/1.5/1.5, FRAME 0.70) plus TEXT, HATCH and DIMENSIONS; line types `BC_HIDDEN`, `BC_CENTER` (our names, the sheet's own patterns). The frame and title block are one block, `TITLE_BLOCK`. A projected circle that shows round is an ARC/CIRCLE, otherwise an ELLIPSE on its principal axes, the same way round. Arrowheads are SOLIDs; the round dots (12-gons) solid HATCHes in 2000, fans of SOLIDs in R12 (exact: they are convex). Each dimension a DIMENSION whose block is the sheet's own marks for it; its definition points from the model at the sheet's scale, its text override the sheet's text with its tolerance, its measurement the model value. Section A–A's cut faces a HATCH of the sheet's own line family (−45° in y-up coordinates through the sheet's top left corner: the same lines the SVG draws, one for one).
  - The sheet keeps the section's hatching as one mark (`kind: 'hatch'`) that the SVG and PDF expand to the same lines as before (their output unchanged) and the DXF writes as a HATCH.
  - Section A–A alone at 1:1 in model mm (`sectionDxfDocument`): the cut part's visible edges, its cut faces hatched at 45° 2.5 apart.
  - `src/sketch/dxf.ts` (`cad-studio-sketch-dxf-v1`): a sketch at 1:1 in its plane's coordinates; each loop a closed LWPOLYLINE with its arcs as bulges (a lone circle a CIRCLE); outer loop and regions on PROFILE, holes on HOLES, construction shapes on CONSTRUCTION (dashed). Parameters resolved from the document; a parameter with no value is refused by name.
  - UI: the drawing's EXPORT row: DXF, a version choice (2000 / R12) and, when section A–A is shown, “A–A DXF”. An R12 export says in a toast what was changed to fit it. The history menu: “Export sketch DXF” beside “Edit sketch”.
- **Evidence**:
  - Oracle: ezdxf 1.4.5 (MIT), run outside the product (`packages/barocss-cad/scripts/dxf-oracle.py`, a venv at `~/.cache/barocss-ezdxf`), its reading committed as data (`conformance/r11b/<case>/oracle.<version>.json`). Every file audits clean (no errors, no fixes); `test/dxf-writer.test.mjs` compares the reading with the input: entity types and order, layers, line types and weights, units, coordinates to 1e-9 (exact in practice), bulges, text as shown, dimension types and definition points, hatch pattern line and origin. ezdxf's own hatch lines (its `hatching` renderer) match the writer's in number and total length; its own ellipse points match our parameterisation; its own spline points lie within the tolerance of our R12 polylines.
  - Conformance cases (`conformance/r11b/`, each a folder: `case.json`, the committed `expected.<version>.dxf`, the oracle's reading): `entities` (every entity kind, 2000 and R12), `plate-drawing` (the starter plate: four views, six dimensions of every kind with each kind of tolerance, a note with a leader, section A–A; 2000 and R12), `section-a-a` (1:1), `sketch-plate` (a loop with a bulge, a circle hole, a two-arc hole, a construction slot; 2000 and R12). The writer's output must match the committed file byte for byte; the studio's test writes and checks the studio-made documents (`UPDATE_DXF_FIXTURES=1`, then `scripts/dxf-fixtures.mjs` with `DXF_ORACLE_PYTHON`).
  - A render of the R12 plate drawing by ezdxf's drawing add-on (matplotlib): `handover/notes/acceptance/r11b-plate-drawing-r12-ezdxf.png` — the same sheet as the SVG.
  - Studio: `test/dxf.test.ts` (arcs to DXF curves either way round; every sheet mark accounted for; dimension values from their definition points; the hatch lines one for one; R12), the section test updated to the hatch mark; a browser-flow step (DXF 2000, R12 with its toast, A–A DXF, a sketch's DXF from the history menu).
  - Bench: `dxf: 120-hole plate sheet, 2000 / R12` in `pnpm bench`.
- **Not done / deferred**:
  - Opening the files in a free viewer by hand (LibreCAD, QCAD, or Autodesk's web viewer) is the owner's L1 check; ezdxf's audit and render are the automated stand-ins.
  - R12 flat patterns (bend lines on their own layer) and FR4 cut lists come with R12 and FR4; the writer needs nothing new for them.
  - No DXF reader (DWG/SAT import stays late, after A5–A8).
  - Dimension styles are one `Standard` style with the sheet's sizes; a CAD program regenerating a dimension draws it in its own style (the block is ours until then).
- **Why our own**: the owner's rule (no WASM, no runtime dependencies; acadrust read for the format only, ezdxf as a test oracle). The writer is small, data in → text out, and testable against an independent reader.

## O2 — R14.1: Auto-dimension from the part's geometry and its features' intent (2026-10-19)

- **R14's steps** (taken here; the README's scope: view selection and layout, dimensions from feature intent, GD&T and tolerance suggestions; the draftwright note's grouped hole dimensions, feature callouts and a drawing issue list):
  - R14.1 Auto-dimension (this record);
  - R14.2 the drawing issue list — overlapping or off-sheet annotations, dimensions lost or no longer matching, features left undimensioned (holes, steps), crowded sides — listed and fixable; R14's acceptance check;
  - R14.3 views chosen and laid out for their dimensions (the front view by most information, views that add nothing dropped, room reserved for rows, a scale or sheet that fits them);
  - R14.4 tolerance and GD&T suggestions — a ± or geometric mode, datums from the main faces, position on hole patterns, fits from library interfaces; a named general-tolerance class only with sourced or estimate-flagged values; suggestions, never applied silently;
  - R14.5 agent tools (auto-dimension, list issues) and the pitch circle of holes on a circle.
- **What** (`apps/cad-studio/src/drawing/auto.ts`, `cad-studio-auto-dimensions-v1`; the button “Auto” in the drawing's DIMENSIONS card): ordinary drawing dimensions with persistent edge references — they follow the model, can be moved, removed or toleranced — marked `auto: true`. Running it again replaces its own and keeps those placed by hand; one that a hand-placed dimension already gives (same view, kind, orientation and references) is left out.
  - Overall sizes: width and height in the front view, depth in the top view, between edge ends at the view's extremes. A view whose extreme is no edge end (a round outline) is listed, not guessed.
  - Levels: the positions of the visible straight edges inside a view (steps, notches), baseline from the view's left and bottom extremes — across and along in the top view, heights in the front view.
  - Holes: whole circles that show round (a circle's arcs added up to a turn; both rims of a hole one circle), each in the first of top, front, right it shows round in, located from that view's extremes. Three or more in a row at one pitch: the first located, then one dimension of the pitch with its count (`3× 20`, the number of equal spaces).
  - Callouts: one diameter per kind of hole, its text the hole feature's callout (THRU, DEEP, thread, counterbore, countersink) with the number of such holes (`4× Ø6.6 THRU`, `6× Ø6 THRU`); a counterbore's or countersink's outer circle is in its callout.
  - New dimension field `count` (2–999): “stands for that many”. It replaces a callout's own count on the sheet and in the DXF. Saved and read back; a bad value dropped. Old files are unchanged.
- **Placement**: horizontal rows on the freer side above/below the view, vertical on the freer side left/right (free room measured to the other views, the section, the title block, the frame). The shortest dimension is innermost, the overall size outermost; rows are 10 mm then 8 mm apart on the sheet. Rows that do not fit spill, shortest first, to the opposite side. Callouts go out past the view's edge on the side the horizontal rows leave free, one row each.
  - A side that needs more room than it has is reported in `crowded` (needed and available mm), and the toast suggests a larger sheet or a smaller scale. At 1:1 on A4 the bolt-circle plate's top view needs 33 mm below and has 22; on A3 it fits. Making the layout give that room is R14.3, and listing the overlaps is R14.2.
- **Not done, listed**: holes evenly on a circle get positions (correct, many). Their pitch circle (a PCD dimension) is listed as not available yet (R14.5). Slots, arcs of rounded corners, angles and section dimensions are not auto-dimensioned yet. The isometric view gets none.
- **Fix on the way**: `holeCallout` did not recognise a hole pattern's copies (`n<k>_p<j>.side…`): a diameter put on a copy by hand read plain `Ø6.6`, not `4× Ø6.6 THRU`. It reads the callout now.
- **Evidence**:
  - Conformance `packages/barocss-cad/conformance/r14/` (studio documents and their drawing settings, run by `apps/cad-studio/test/auto-dimension.test.ts`; `UPDATE_R14_FIXTURES=1` writes them): `starter-plate`, `hole-row`, `counterbore`, `l-plate`, `bolt-circle` (A4: crowded below the top view), `bolt-circle-a3`. Each expected dimension text is the part's design value, checked by hand: e.g. the bolt circle's x 20/30/50/60 and y 22.68 + 2× 17.32 = 40 ± 20·sin 60°.
  - Tests: the dimensions measure whole millimetres on whole-millimetre parts; a wider plate reads 120, not 100 (they follow the model); a hand-placed width is kept and its auto twin left out; a second run gives the same set; `count` survives a save. A browser-flow step: plate, one dimension by hand, Auto: six dimensions `16, 32, 32, 64, 8, Ø8 THRU`, five of them auto, the same set after a second run.
  - Bench `drawing: auto-dimension, 120-hole plate`: 7.7 ms (budget 16).
- **Why geometry first**: the views already carry persistent names, exact ends and circles; feature intent comes in through the existing callout (the hole feature's own record), so nothing is inferred that the document does not say.

## O3 — R14.2: the drawing's issue list, R14's "the drawing is right" check (2026-10-19)

- **What** (`apps/cad-studio/src/drawing/issues.ts`, `cad-studio-drawing-issues-v1`): every issue found on the built sheet, each with a severity, a message, the dimensions or notes it is about, where it is, and a fix where one is safe. The drawing's ISSUES card lists them; a row selects its dimension; Fix applies one fix and Fix all applies every fix in turn, building the sheet again after each (errors first, then warnings; it stops when nothing fixable is left, when a fix changes nothing, or after 40 fixes). Undo takes a fix back like any edit.
- **Wrong on the sheet (errors)**:
  - `DIMENSION_LOST`: an edge it measures is gone or no longer shows as it did. Fix: remove it.
  - `TEXT_OVERLAP`: two texts overlap (dimensions, notes, view names). Text boxes are drawn from Helvetica's widths, from just under the baseline to the cap height, turned with the text, and tested by the separating-axis test with a 0.2 mm allowance. The one moved is an auto dimension before a hand-placed one, before a note; the later of two equals.
  - `TEXT_OVER_LINES`: a dimension's text lies over a view's lines, over another dimension's lines, or on the area of a view other than its own. A view's name pushed by dimensions into the next view is listed with no fix: it needs room, which is R14.3's.
  - `OFF_SHEET`: an annotation reaches past the frame or into the title block.
  - `VIEWS_DONT_FIT`: the views don't fit at the scale. Fix: back to an automatic scale, or A3 when the scale already is automatic.
  - Moves for the three text issues: a place clear of every text, line, other view and the title block, inside the frame. A linear dimension tries 8 mm rows each way from where it is, then fresh rows beside its view either side (for one far off); a leader tries further out and round the circle in eighths; an angle tries further from its vertex; a note tries steps in four directions. None is offered when nothing clears.
- **Worth a check (warnings)**:
  - `DUPLICATE`: the same size given twice, in one view or in two that share the axis (front and top share X, front and right Z). Its fix removes the auto one, or the later of two placed by hand.
  - `REMATCHED`: a reference was matched again after an edit (its `was`). Fix: accept it, which clears the mark, as the references panel does.
  - `HOLE_SIZE_MISSING`: a hole with no diameter of its own, no counted diameter of its kind, and not the outer circle of a counterbore or countersink callout on its centre.
  - `HOLE_NOT_LOCATED`: a hole's position across or up is not given by a linear dimension's end or by a counted pitch's reach. Views sharing an axis count; a position at the view's extreme needs nothing.
  - `STEP_NOT_LOCATED`: the inner straight-edge levels Auto-dimension would give (top view both ways, front view heights).
  - `OVERALL_MISSING`: width (X), height (Z) or depth (Y) is not one linear dimension over the whole extent in a view showing it. A round outline's diameter counts.
  - Fix for the four missing kinds: Auto-dimension, which keeps the hand-placed ones.
- **Evidence**:
  - Conformance `conformance/r14/issues-*` (run by `apps/cad-studio/test/drawing-issues.test.ts`; `UPDATE_R14_FIXTURES=1`): the issue codes found and those left after Fix all.
    - `issues-undimensioned`: the starter plate bare gives the three missing kinds; nothing is left after Fix all.
    - `issues-auto-clean`: none.
    - `issues-wrong-on-sheet`: a lost dimension; the width given again three times by hand, two of them on one spot and one far off the sheet; a re-matched reference. Seven issues, nothing left.
    - `issues-scale-too-big`: 10:1 gives VIEWS_DONT_FIT and six off-sheet dimensions; nothing left.
    - `issues-crowded-a4`: the bolt-circle plate on A4. The callout over lines is moved clear; the top view's name pushed into the front view is left — it needs R14.3.
  - Every R14.1 part Auto-dimension doesn't report crowded comes out with no issue. That check found the counterbore's outer circle listed as unsized, now fixed.
  - Tests of the box and segment geometry (turned text, the separating axis), each fix, a move clearing what it moved, accept clearing only its mark.
  - A browser-flow step: the bare plate lists 3 issues; Fix all leaves none and six dimensions. The width added by hand lists "given twice"; its fix leaves yours and removes the auto one.
  - Bench `drawing: issue list, 120-hole plate` (auto-dimensioned, 480 circles in its views): 13 ms (budget 26).
- **Not done**: dimension lines (not text) crossing other views are not listed; text against hatching and the iso view's lines are checked only as a view's area; the R14.3 layout is what removes the crowded cases' remaining issue.

## O4 — R14.3: views chosen and laid out for their dimensions (2026-10-19)

- **What** (`apps/cad-studio/src/drawing/layout.ts`, `cad-studio-auto-layout-v1`): the drawing's "Auto" button now lays the drawing out, then auto-dimensions it. Its own earlier dimensions are replaced and hand-placed ones kept, as before.
  - **Views** (`chooseViews`): the front and top views always. The right view is left out when it adds nothing: no circle shows round in it, it has no curve, every straight edge's position across and up is already one of the top view's or the front view's, and nothing is placed in it by hand (a dimension or a note's leader). The isometric view stays as set.
  - **Room**: Auto-dimension reports what each view side's rows take (`needs`, sheet mm from the view's edge). The layout spaces the views by it (`settings.room`, below). The two run in turn until every side has its rows, at most four rounds. The issue list's moves then clear what still overlaps (a short dimension's text, a callout over lines).
  - **Scale and sheet**, in two passes. Pass one: the scales at which the smallest hole is at least `MIN_HOLE_ON_PAPER_MM` = 2.5 mm across on paper, largest first (or the one set), on the sheet set and then A3 for an A4 sheet. The first that gives nothing crowded and no error on the issue list is taken. Pass two, only if pass one found none: the largest clean scale below that, reported as not reading well. Else the attempt with the fewest errors, with what is left listed.
  - 2.5 mm is **an estimate**, not from a standard: below it a hole's centre lines, leader and callout crowd it. It is named in the code and in the toast.
  - The scale stays automatic in the file where the layout would pick it anyway.
- **New settings** (versioned fields, read back validated; old files are unchanged):
  - `views`: the views shown; front and top are always included. Hidden views are drawn nowhere.
    - A dimension in a hidden view is kept and resolves "its view is not shown" (the issue list's DIMENSION_LOST names it).
    - A hole that shows round only in a hidden view is the new warning `VIEW_NEEDED`; its fix shows the view.
    - Switches "Right view" and "Isometric view" in the SHEET card.
  - `room`: sheet mm per view side, 0–200. The layout uses it only where it is more than the gaps (22 mm) and margins (14 mm) already give, plus 3 mm clear and the view name's 7 mm below. Without it, or with an empty one, the layout is exactly as before (tested).
- **Auto-dimension change**: a dimension a hand-placed one already gives — in its view or one sharing the axis — is left out. Before this, a depth placed by hand in the right view still got an auto depth in the top view, and the issue list called it a duplicate.
- **Evidence**:
  - Conformance `conformance/r14/layout-*` (run by `apps/cad-studio/test/auto-layout.test.ts`; `UPDATE_R14_FIXTURES=1`): views, sheet, scale, readable, issues left, the dimensions as they read; each checked by hand.
    - `layout-plate`: right view left out, A4 1:1, clean.
    - `layout-cross-hole`: a hole along X; the right view stays and holds Ø8 THRU, 15, 15.
    - `layout-bolt-circle`: crowded at A4 1:1 in R14.1/R14.2; now A4 1:2 with room, clean, Ø6 holes 3 mm on paper.
    - `layout-long-plate`: 240 × 120. A4 would need 1:5, putting its Ø8 holes at 1.6 mm, so A3 at 1:2: 10× Ø8 THRU, 20 then 9× 20.
    - `layout-hand-in-right`: the right view stays for the hand-placed 32; no auto depth beside it.
  - Each chosen layout reads back from a saved file and gives the same sheet with no error.
  - Tests: room changes nothing where the gaps already suffice, and widens a gap by what is asked; hidden views take no room and are drawn nowhere; `rightAddsNothing` on a plate and a cross hole; VIEW_NEEDED with its fix.
  - A browser-flow step: the plate's Auto leaves the right view out (the toast says so), has six dimensions and no issue; its switch brings the view back.
  - Bench `drawing: auto layout, 120-hole plate`: 45 ms (budget 100). The first version took 7.3 s, with two causes.
    - Each candidate place a move tried scanned all ~15k segments of the views' lines. A grid of 10 mm cells (`SegmentGrid`) now gives each box only the segments near it.
    - The loop ran the moves while sides were still crowded, and kept scanning ever smaller scales after a clean layout that did not read well. Now moves run only once nothing is crowded, and the search goes in two passes: scales at which holes read first (A4, then A3), then the largest clean scale below that. The 120-hole plate's Ø4 holes read at no scale that fits either sheet (1:1 does not fit); it gets A4 at 1:5, reported as not reading well, in one try.
- **Deferred (R14.3b)**: choosing which side of the part is the front ("the front view by most information"). It changes every view's direction and the dimensions placed in them, so it needs a versioned view-orientation setting and a decision on what happens to existing dimensions. Also not done: dropping the isometric view to make room, and laying out the section with its own dimensions.

## O5 — R14.4: tolerance and GD&T suggestions, from the fastener data or flagged as estimates (2026-10-19)

- **What** (`apps/cad-studio/src/drawing/tolerance.ts`, `cad-studio-tolerance-suggestions-v1`; the drawing's TOLERANCING card): suggestions of how exact the part must be. Each shows its basis — the data and the relation, or "Estimate" — and is applied only when accepted, one at a time or Accept all (datums before the frames that name them; then the issue list's moves for what overlaps). A mode switch, `settings.tolerancing` (± dimensions by default, or geometric), only changes what is offered.
  - **Either mode**: a general note "UNLESS OTHERWISE STATED: LINEAR ±0.2 · ANGULAR ±0.5°". **An estimate**: a common machining default, not from a standard, so check the shop's own (`GENERAL_TOLERANCE`). No tolerance class is named and no standard's table is used. It is not suggested again where a note already opens that way.
  - **± mode**: per kind of hole, a ± tolerance on its location dimensions — the per-axis square inside its position zone, T/(2√2). A dimension shared by holes that line up gets the tightest value its holes need: a looser ± already there is tightened, never loosened, and none goes on a basic dimension.
  - **Geometric mode**:
    - Datums A, B, C: the part's three largest flat sides square to each other, by area (bottom, front side, left side for a prismatic part), each on the view edge that shows it edge-on, the symbol placed where it is clear of everything on the sheet. If no spot on the edge is clear, the symbol goes on the edge's extension line past the view, with the extension line drawn.
    - Per kind of hole, a position frame under its callout: ⌖ Ø T | A | B | C. It names only datums the drawing has or is offered. Its location dimensions become basic (boxed, their own tolerance removed).
- **The value T** (`holePosition`), from the studio's fastener data (`app/fasteners.ts`, ISO 273 clearance holes with their source records) by the usual tolerancing relations:
  - a clearance hole H for a screw F (via `sizeForHole`): **floating fastener**, T = H − F. Ø6.6 for M6: Ø0.6, so ±0.21 per axis;
  - a tapped hole M<d>: **fixed fastener**, T = (H − F)/2, H the screw's medium clearance hole **assumed** in the mating part (said so). M6: (6.6 − 6)/2 = Ø0.3, so ±0.1;
  - no fastener in the data fits: **an estimate**, Ø0.2 (`POSITION_ESTIMATE_MM`), said so;
  - values rounded down to 0.01 mm (tighter, never looser).
- **Not offered** (no sourced data): fit codes (H7 …) from interfaces — the library's fits are spatial checks and the repo has no limits-and-fits deviation table (none may be taken from ISO). Also flatness on datum A, profile and orientation tolerances, projected zones for tapped holes, and datums on round parts (no flat extreme side: none offered).
- **The sheet** (versioned settings read back validated; old files unchanged):
  - `datums` (letter A–Z without I, O, Q; view; edge reference; place): a boxed letter, a leader, a filled triangle on the edge (or on its extension line).
  - `frames` (dimension, position, value, datums): drawn under the dimension's text, moving with it. The position symbol is drawn as a circle and a cross, so every font, PDF and DXF shows it.
  - `basic` on dimensions: the text boxed.
  - The DXF writes them as lines, solids and text; Ø as %%c.
- **The issue list** gains `DATUM_LOST` (edge gone; fix: remove), `DATUM_TWICE` (fix: remove the later), `FRAME_LOST` (its dimension gone or lost; fix: remove) and `DATUM_UNDEFINED` (a frame names a datum not there; no fix). A frame is part of its dimension for overlaps and moves; datums take part in overlaps (no move). A datum's leader must not cross other lines.
- **Fixes on the way**:
  - Auto-dimension's pitch rows are now found per line of holes. Two holes sharing an x could start "3× 20" at the wrong one: on the hole-row plate it ran from the tapped hole to the clearance row (the right value, the wrong feature). A run's first hole is now the baseline's target.
  - On the bolt-circle plate, "2× 17.32" was not a row (the holes are not on one line). It is now three positions, 22.68, 40, 57.32 (40 ± 20·sin 60°); the R14.1/R14.3 bolt fixtures were updated, no other case changed.
- **Evidence**:
  - Conformance `conformance/r14/tol-*` (run by `apps/cad-studio/test/tolerance.test.ts`; `UPDATE_R14_FIXTURES=1`): the suggestions offered and, after accepting all, no issue and what is on the sheet; worked by hand.
    - `tol-row-plus-minus`: ±0.1 on the tapped M6's 2 location dimensions (the shared 20 included), ±0.21 on the row's; four tolerances 0.1, 0.1, 0.21, 0.21.
    - `tol-row-geometric`: A, B, C; Ø0.6 and Ø0.3 frames; 4 basic.
    - `tol-plate-geometric`: Ø8 fits no fastener, so Ø0.2 is an estimate.
    - `tol-cross-hole-geometric`: the frame in the right view.
  - Tests: the relations for M3–M10 clearance and tapped holes; modes change only the offer; a user's own general note respected; save and read back; drawn in the SVG, PDF (no missing characters) and DXF; the four new issues; bad datums and frames dropped on reading.
  - A browser-flow step: a plate with a Ø6.6 hole. ± mode offers ±0.21; geometric mode offers three datums, a Ø0.6 position frame and the note; Accept all leaves no suggestion and no issue, with A, B, C, the frame and two basic dimensions on the sheet.
  - Benches: `drawing: tolerance suggestions, 120-hole plate` 1.9 ms (budget 5); the issue list now 1.9 ms with R14.3's segment grid (13.7 ms before; budget 4).

## O6 — R14.5: pitch circles, and the agent's drawing tools (2026-10-19)

- **Pitch circles** (`kind: 'pcd'` dimensions, `at: 'pcd'` dimension points; versioned, read back validated, old files unchanged):
  - A `pcd` dimension names three or more holes by their circles' edges (`ring`). It resolves to the circle through their centres: the circumcentre of the first three, every member within 1e-6 of its radius, else lost. It reads "Ø40 PCD · 6× EQ SP" (EQ SP when every member is 360°/n from the next round the circle). It is drawn as a chain-line circle through the centres with a leader like a diameter's; in the DXF as lines, an arrow and text (DXF has no pitch-circle dimension type).
  - A dimension point at `pcd` is that circle's centre, which no edge has, so a linear dimension can locate a bolt circle with nothing at its middle.
  - The references panel, re-matching and renaming walk every member.
  - **Auto** finds rings: three or more holes of one kind, evenly round a point, and not a grid. A rectangle's corners are lined up both ways, so they stay positions.
    - A ring gets its pitch circle (placed like a callout) and its centre's position, not each hole's: by the hole on its centre if there is one (a flange's bore), else by the `pcd` point.
    - Its angular position is given when a hole lies on a centre line through it (the usual 0°). When none does, it is listed as not placed (an angle to the first hole is not yet a dimension kind).
  - The **issue list** counts a ring's holes as located when a pitch circle names them and its centre is located both ways.
  - **Tolerances**: in geometric mode a ring's pitch circle and its centre's dimensions become basic with the frame. In ± mode the pitch circle gets the same ± as the centre's location: a hole's radial error is half the diameter's, so this is tighter than the zone needs, never looser.
  - The bolt-circle fixtures of R14.1/R14.3 (`bolt-circle`, `bolt-circle-a3`, `layout-bolt-circle`) now read Ø40 PCD · 6× EQ SP and the centre 40/40, in place of six holes' positions; no other case changed. At the R14.1 layout (no room), two leaders below the top view report that side crowded: a reserve that also counts the view's name (the drawing itself has no issue there; R14.3's layout gives the room).
- **The agent's drawing tools** (`apps/cad-studio/src/chat/drawing.ts`, offered with the part tools):
  - Reading: `drawing_issues` (the issue list, its fixes, and the sheet: size, scale, views, dimensions, mode) and `tolerance_suggestions` (with basis and the estimate flag; `mode` looks at the other mode without changing it).
  - Changing: `auto_dimension` (Auto layout and dimensions; `layout: false` dimensions only), `fix_drawing` (Fix all, or only given issue codes), `accept_tolerances` (all, or by id; `mode` first) and `set_drawing` (sheet, a standard scale or auto, projection, views, mode, title).
  - A drawing change is always the user's (D41). Made directly, it is refused `needs_approval` by the existing gate. The change tools ride as ops of `propose` (they are batchable, not part mutators). The agent may not accept such a proposal at any autonomy; the user accepts it in the studio.
  - The system prompt says so, and asks the agent to say which tolerances are estimates and which come from the fastener data.
- **An estimate made explicit** (the R14.4 data): a hole near, but not equal to, an ISO 273 clearance hole (Ø6 for M5, whose coarse hole is Ø5.8) was reported as from the data. Its screw is now said to be assumed, flagged as an estimate; only an exact ISO 273 diameter is "from the data".
- **Evidence**:
  - Conformance `conformance/r14/pcd-*` (R14.5 cases in the Auto-dimension runner):
    - `pcd-flange`: Ø60 PCD · 4× EQ SP about a Ø20 bore located at 50/50.
    - `pcd-three`: 3× at 120°, Ø40 PCD, centre 40/40.
    - `pcd-square-grid`: four corners, positions 15/45 each way, no pitch circle.
    - `pcd-turned`: six turned 15°; its angular position listed.
  - Each non-crowded R14.1/R14.5 part has no issue after Auto.
  - `test/chat-drawing.test.ts`: the tools offered with schemas; reading changes nothing; every change tool refused directly (`needs_approval`, the drawing unchanged); a proposal of Auto plus geometric tolerances has risk approval `drawing`, the agent cannot accept it, and the user's acceptance gives the drawing its dimensions (a 3× pitch), datums A B C, a Ø0.6 frame and no issue; through dispatch, layout off, set_drawing (a non-standard scale refused), accepting one suggestion by id (an unknown id refused), and a fix by code.
  - A browser-flow step: the flange opened from its case file; Auto gives Ø60 PCD · 4× EQ SP, 4× Ø6 THRU, Ø20 THRU, its bore at 50/50, no issue; the DXF holds the pitch circle's text.
- **R14 done** with this step: R14.1 auto-dimension, R14.2 issue list, R14.3 layout, R14.4 tolerances, R14.5 pitch circles and agent tools. Pending (README): R14.3b, the front view's side; then A5.

## O7 — R14.3b: the front view's side, versioned; annotations re-mapped or the turn refused (2026-10-20)

- **The setting** `orientation` (the D16 pattern): the side the front view looks from, `x+`, `y+` or `x-`. **None means `y-`**, from −Y: every drawing saved before has none and reopens exactly as it was. `viewsFor('y-')` gives the very numbers the views always had (tested against the literal), and the R11b DXF document fixture and every R14 case are unchanged byte for byte. A bad value is dropped on reading.
  - For each side: the top view looks down Z keeping the front's horizontal axis; the right view is the front turned a quarter to its right; the isometric is from the front-right-top corner. So for every side, front and top share u, front and right share Z, and the top's v is the right's u (tested). Auto's and the issue list's shared-axis rules hold without change.
  - **Section A–A** is cut square to the front's depth: `section.y` is the position along it (model Y from −Y; X = −y from +X, Y = −y from +Y, X = y from −X). The far side is kept, as before.
  - Wired through the worker, the client, the agent's tools and the DXF/PDF/SVG (which draw what the sheet holds).
- **The rule for what is on a drawing when it turns** (`drawing/reorient.ts`, `cad-studio-reorient-v1`):
  - **Re-map**: each annotation goes to the view of the new side that looks along the same model axis as its own. One always does: the top view stays, the front and right views swap or turn round. Its places, note leader points and datum symbol spots are carried through the model. A horizontal or vertical dimension turns where the axes swap. The views shown turn with them: a view shown before keeps its annotations shown.
  - **Refuse, typed**, and change nothing, when:
    - a dimension would not read what it read before — the same edges, the same kind and value to 1e-9, or no longer resolves (`ORIENTATION_REMAP_FAILED`, with each dimension's before and after);
    - section A–A would be cut across the present front (`SECTION_ACROSS`: turn it off first). Along it (−Y ↔ +Y, ±X ↔ ∓X) it is kept, its position turned.
  - Nothing is dropped silently, and nothing is kept in a view that no longer shows its axes.
- **Auto's choice** (`frontByInformation`): the side the right view looks from, when it tells clearly more than the front. Information is visible edges, plus three for each circle that shows round, less half the hidden ones; "clearly" means a fifth more and two more. Only for a drawing with no side set and nothing placed by hand on it (dimensions, leaders, datums); otherwise the front stays. The studio's Auto and the agent's `auto_dimension` project the part for that side, turn by the rule above, and lay out; the toast and the tool's `front` say why. The block with a hole along X gets its front from +X, so its hole shows round in the front view; a plate keeps −Y.
- **Studio**: "Front from" in the SHEET card (−Y default, +X, +Y, −X), turning by the rule (a refusal says why, its list in the details). The workspace shows no views of the old side while the new ones come. The agent's `set_drawing` takes `front`.
- **Evidence**:
  - Conformance `conformance/r14/orient-*` (`test/reorient.test.ts`):
    - `orient-plate-x-plus`: the plate's 64 and 8 move from the front to the right view, which is shown again; top unchanged; every value kept.
    - `orient-cross-hole-y-plus`: from behind, the same views mirrored, every value kept.
    - `orient-section-across`: refused SECTION_ACROSS.
  - Tests:
    - an old drawing (no side) reads back, lays out and draws exactly as with the old views;
    - the shared axes for all four sides;
    - a turn and its way back give the places to 1e-9;
    - section along kept at −16, across refused;
    - a turn against views where the hole is gone refused with the Ø8 and positions listed;
    - section A–A from +X: the plane X = 30, the far side kept, a 30 × 30 cut face less the hole, "Nothing … behind X = −10";
    - Auto's choice for the block, none for a plate, none with a side set or a dimension by hand;
    - the agent's auto_dimension on the block: front from +X, the hole's diameter in the front view, no issue; set_drawing back to −Y re-maps it to the right view; a bad side refused.
  - A browser-flow step: the auto-dimensioned plate turned to +X — the same six values, no error, the old front's dimensions in the right view (shown) — then back to −Y as it was; with section A–A on, turning to +X is refused and nothing changes.

## O8 — A5 S0: what the tool layer is today, and A5's steps (2026-10-20)

- **Measured** (HEAD `975a62fed`; deterministic, no model run):
  - The agent's tool layer (`src/chat/tools.ts` `TOOLS`): **57 tools**. Their `tools/list` JSON is **64 531 characters** (about 16k tokens), and the system prompt another 6 588, sent every turn. The largest: `run_command` 11 697 (every toolbar command's value keys in one description), `add_features` 3 656, `set_requirements` 2 283, the image tools about 1.8k each, `inspect` and `measure` about 1.5k.
  - **MCP** (`server/cadMcp.ts`): a per-turn stdio process the chat server starts on a state file. It answers `initialize`, `tools/list` and `tools/call`. It has no tool annotations, no `outputSchema`, no `structuredContent` (results are JSON in a text item), no document of its own, and no way for an external client (Claude Code, Desktop) to open or save a `.bcad`.
  - **Command-only modelling works headless**: `dispatchTool` / `apply_ops` build any part in Node (every chat test does), all-or-nothing with op ids.
    - A bracket (a 100 × 40 × 10 plate, a row of four Ø6.6 holes, a tapped M6 hole), built here through `apply_ops`, is **391 characters of op JSON**. The same as the draft DSL below is **156: 2.5×**.
    - The owner's SubD pipe clamp is 43 calls, 4 188 characters of call JSON.
    - So a script saves little text per operation. What it saves is round trips (a part in one call, not one call per feature) and a tool surface the model must read each turn.
  - The kernel's `cad.model()` builder (`CONCISE_API.md`) is an older, narrower surface (convex polygons, a few features), not the studio's feature set. The DSL should compile to the studio's feature ops (`run_command` commands and `add_features` kinds), the format proposals, undo and the A1 references already use.
- **A5's steps** (a proposal):
  - **A5.1 tool contract v1** (`barocss-cad-tools-v1`):
    - every tool gets MCP annotations: title, and read-only / destructive / idempotent hints from the existing mutator and approval sets;
    - read tools get an `outputSchema` and return `structuredContent` beside the text;
    - the names and input schemas are frozen in a committed list, with a test that fails on any unversioned change.
    - Acceptance: the schema test; an MCP conformance test (a JSON-RPC client: initialize, list, call, structured results).
  - **A5.2 `run_script`** — a small TypeScript-like language, our own lexer and parser, no `eval`, no new dependency:
    - parameters, `const` names, numbers in mm, arrays and objects, arithmetic, bounded `for` loops;
    - calls named after the commands and feature kinds with their HUD value keys; faces and edges by A1 names or selectors (`plate.top`);
    - compiled to ops and run as one `apply_ops` (all or nothing, never raw B-rep), returning each statement's feature ids and the part's facts;
    - typed errors with line and column; limits on statements and loop iterations;
    - later, `script_of(doc)`: the feature tree written back as a script for reading.
    - Acceptance: conformance `conformance/a5/` (script → features and volume); the parser fuzzed for typed errors; round trip where the decompiler covers the tree.
  - **A5.3 consolidated tools** (about a dozen): `model` (run_script), `features` (feature JSON add/edit/delete), `query` (summary, inspect, measure, mass, interference, section, wall, draft, render), `history`, `requirements`, `proposals`, `assembly`, `library`, `print`, `drawing`, `subd`, `describe` (one command's or feature's full schema on request).
    - The old names stay as versioned aliases until A5.5 decides.
    - Acceptance: `tools/list` at most 15k characters (from 64.5k); every existing chat, proposal and cage test replayed through the consolidated layer.
  - **A5.4 external MCP server and CLI** (one tool layer with the in-app chat):
    - `cad-mcp --doc part.bcad`: long-lived stdio, saves on change atomically with its blob files, local files only;
    - `cad-cli run script -o part.bcad [--step] [--stl] [--check]` for batch and CI.
    - Acceptance: a client test (spawn, list, run a script, save, reopen identical) and a CLI test.
  - **A5.5 A/B**: JSON-only (today's tools) against the hybrid (consolidated tools and `run_script`), on 8–12 briefs from the AI scenario ladder, each with A3 requirements as the kernel oracle.
    - Measures: hard-requirement pass rate, tool calls, input and output tokens, wall time, refusals.
    - A scripted agent dry-runs the harness in CI. **Live model runs (L3 evidence, the owner's usage) only on a go-ahead**, at least 3 runs a brief and arm.
- **Out of A5**: the chat-turn overwrite (README TODO, the owner's decision), the document service, accounts and concurrent editing (A7/A8 and a server track, per the research note).

## O9 — A5.1: the tool contract v1 (`barocss-cad-tools-v1`) (2026-10-20)

- **What** (`apps/cad-studio/src/chat/contract.ts`; frozen in `src/chat/tools-v1.json`):
  - **Every tool classified** in one table:
    - read (22 tools: they change nothing in the document — part, drawing, requirements, proposals, assembly);
    - additive change (10: a feature, part, mate, library or proposal added, nothing altered);
    - other change (25, each marked idempotent or not).
    - A tool the table does not name throws, so a new tool cannot ship unclassified.
    - (`checkpoint` keeps a session snapshot and `select` sets the viewport selection: both are read tools, the document unchanged.)
  - **MCP annotations** from it: `title`; `readOnlyHint`; `destructiveHint` (true for every change that may alter or remove); `idempotentHint`; `openWorldHint: false` for all (nothing reaches outside the document).
  - **Output schemas** for 21 of the 22 read tools: their result's top-level shape, with what is always there required and the rest optional. `get_image_layers` has none (its shape varies). Change tools have none in v1.
  - **The frozen list**: each tool's name, annotations, input schema and output schema, descriptions stripped (wording may change; shape may not). A test compares the tools with it:
    - a **breaking** difference fails and needs `barocss-cad-tools-v2`: a tool gone; an input property gone, retyped, an enum narrowed or added, a property newly required; a read tool no longer read only, or a non-destructive one now destructive; an output property gone, retyped or no longer required, or an output schema removed;
    - a **compatible** one (new tools, new optional properties, wider input enums, new output properties) fails until recorded with `UPDATE_TOOL_CONTRACT=1`, which refuses to record a breaking one.
- **MCP** (`server/cadMcp.ts`):
  - `initialize` answers with `serverInfo.version = barocss-cad-tools-v1` (and a title);
  - `tools/list` gives each tool its `title`, `annotations` and, for read tools, `outputSchema`;
  - `tools/call` on a read tool returns `structuredContent` (the same JSON as its text, so text-only clients see no change); a change or a refused call has none.
  - JSON-RPC errors as before (−32601 unknown method, −32700 not JSON).
- **Sizes** (what a model reads every turn; A5.3 measures against them):
  - **tools/list 76 697 characters** with the contract (64 531 without: annotations and output schemas add 12 166);
  - **system prompt 6 588 characters**.
  - A5.3's target (≤ 15k characters for tools/list, coordinator 2026-10-20) is against the 76.7k; both numbers are reported again there.
- **Evidence** (`test/tool-contract.test.ts`):
  - every tool classified (none reaching out; read tools neither destructive nor non-idempotent; an unknown tool throws);
  - the frozen comparison;
  - the breaking-change rules on a synthetic contract (removal, a narrowed enum, newly required, no longer required, no longer read only: break; additions: do not);
  - all 21 output schemas validated against real results (both `measure` forms, the SubD tools on a cage), each read call leaving the document the same object and `changed` false;
  - an MCP client over in-memory pipes: initialize (protocol 2025-06-18, the contract version), tools/list (titles, annotations, output schemas where due), a read call (structured content equal to the text, valid), a change (none), a refusal (`isError`, none), the JSON-RPC errors, the change saved to the state file.

## O10 — A5.2: `run_script`, a part in one call (`barocss-cad-script-v1`) (2026-10-20)

- **What** (`apps/cad-studio/src/chat/script.ts`; the tool in `src/chat/tools.ts`):
  - **A small JS-like language**, our own lexer, parser and interpreter (no `eval`, no dependency):
    - statements: `const name = expr`, an expression, `for (const i of list) { … }`, `if (c) { … } else { … }`, `//` and `/* */` comments;
    - expressions: numbers, strings, booleans, lists, objects (with `{ w }` shorthand), member and index access, calls, `+ - * / %`, comparisons, `&& || !`, `a ? b : c`;
    - built in: `range`, `min`, `max`, `abs`, `sqrt`, `round`, `floor`, `ceil`, `sin`/`cos`/`tan` in degrees, `PI`.
    - Not in the language, refused with a pointer: `let`/`var` (names are set once), `function`, `while`, `return`.
  - **Every command is a call** by its id with `-` as `_` (`box`, `hole`, `linear_pattern`, …): `cmd(selection?, {values})`, the values by run_command's keys. It runs as `run_command`. The selection may be a face, an edge, a feature (its body), a body or a list.
  - **Handles**: a command or `feature({...})` returns its feature (the last node it added).
    - `h.top`, `h.bottom`, `h.cut`, `h.side0`, `h.side(2)`, `h.side("e3")`, `h.face(role)` are faces by role (A1.2 selectors);
    - `h.body` is its body; `h.id` its id;
    - `edge(a, b)` is the edge between two faces; `face({normal, pick})` a face by direction;
    - `node("n3")` or `node(index)` is a feature there before the script.
  - **Raw features**: `feature({kind: …})` adds one node, as add_features takes it. A handle inside its JSON is that feature's node index, so `extrude {sketch: s}` works; `ref(h, side)` is a body reference.
  - `edit(h, {values})` and `remove(h)` run edit_feature and delete_feature, with the index found by id at that moment.
  - Handles are told from a script's own objects by identity (a WeakSet), never by their keys (`{h: 8}` is a box height).
- **All or nothing**, like apply_ops:
  - each call goes through the dispatcher on a working copy, in order, with a concise result (the `because` of the script passed to each);
  - the first refusal or error stops it, nothing is applied, and the result says so.
  - Typed errors: `script_syntax`, `script_unknown_name` (with near names), `script_type`, `script_limit`, `script_refused` (the tool's own reason), each with `line` and `col`.
  - Limits: 20 000 characters, 200 calls, 2 000 loop iterations, nesting 48, lists of 1 000.
  - `dryRun: true` returns what would change.
- **The result**: `script` (the language version), `calls` [{line, tool, did, features}], `names` (top-level names bound to features), the feature-tree `diff`, the facts' `change`, broken references, and `facts`.
- **Gates**: run_script is a mutator, so autonomy L1/L2 and the approval gate apply to it as to any change; a dry run changes nothing. It is batchable, so `propose` can hold a script and accepting replays it. At L2 a turn's script on an empty part builds directly (the owner's exception); on a built part, adding features is proposed.
- **Contract**: classified as alters, not idempotent (it may edit and delete). Recorded in `tools-v1.json` as a compatible addition (no breaking change).
- **Sizes**:
  - **tools: 58; tools/list 79 171 characters** (+2 474 for the tool, whose description carries the language);
  - **system prompt 6 870** (+282: one paragraph, "write a part of many steps as one run_script").
  - A5.3 consolidates against these.
- **Evidence**:
  - `test/script.test.ts` (8 tests):
    - a part built in one change (commands, a loop, faces by role, an edge between faces, raw features with a handle, an edit), its volume in closed form less the fillet;
    - all or nothing: a refused value, a refused fillet, a name set twice, arithmetic on a face, an unknown node, `let`, a call limit — each leaves the very same state, with code and line;
    - a dry run; existing features by index; a feature handle as a body (linear pattern);
    - the gates: L2 builds an empty part directly, refuses an addition on a built part (`needs_proposal`), and a proposed script is accepted by replay;
    - the language against a recording host (precedence, conditionals, shorthand, side and face selectors);
    - parser limits and errors with positions;
    - a fuzz of 4 000 seeded scripts (token soup and valid scripts with characters dropped, doubled or swapped): every one ends in a result or a typed `ScriptError` with a position. All five outcomes are seen.
  - Conformance `packages/barocss-cad/conformance/a5/` (9 cases):
    - plate-hole-row, flange-trig, raw-feature-handle and edit-and-remove, with volumes in closed form;
    - refused-line, syntax-line, unknown-name, type-error and loop-limit, each with its code and line.
  - Browser flow 149/149, with the new step "A5.2" (just before the last step) through the real chat and tool servers with the scripted agent: a plate, a loop of three holes and a fillet in one call (6 nodes, one Undo takes it all back); a refused second line applies nothing and names line 2.
  - Bench: parsing a 6k-character script takes 1.16 ms (budget 4); a plate with 10 holes in a loop and a fillet, 12 calls each evaluated, takes 231 ms (budget 700).
- **Deferred**: `script_of(doc)`, writing a part back as a script. It is not needed for A5.5's A/B, and it comes later if the A/B shows value.

## O11 — A5.3: the consolidated tools (`barocss-cad-tools-v2`) (2026-10-20)

- **What** (`src/chat/groups.ts`, `src/chat/toolset.ts`):
  - **13 tools**, each taking an `action` beside the arguments of the v1 tool it stands for:
    - `model` (run_script; its one action may be left unsaid);
    - `features` (command, add, edit, delete, batch);
    - `query` (summary, inspect, measure, mass, interference, section, wall, draft, render, select);
    - `history`, `requirements`, `proposals`, `assembly`, `library`, `print`, `drawing`, `subd`, `image`;
    - `describe`.
    - Every v1 tool is exactly one action (a test checks it).
  - **One tool layer**: a v2 call is translated to its v1 call at the dispatcher's two entry points (gated `runTool`, ungated `dispatchTool`), so results, refusals and the autonomy/approval gates are the v1 ones. Ops in `features.batch` and `proposals.propose` may name v2 tools; they are kept as the v1 call, so a proposal replays the same whichever list proposed it.
  - **The v1 names stay callable** (aliases) from either list until A5.5 decides. No v2 name is also a v1 name.
  - **`describe`** gives what the short list leaves out, on request:
    - the tools and their actions;
    - an action's full v1 description and input schema;
    - a command's selection and values (from the same docs run_command lists);
    - a feature kind's node JSON (the add_features lines for that kind).
    - The `features` description names every command and feature kind, and a test describes each one.
  - **Annotations** from the actions: read only if every action is (`query`, `describe`); destructive if any is; idempotent if all are. v2 declares no output schemas (a group's shapes differ). A read action whose v1 tool has an output schema still returns `structuredContent`.
  - **The system prompt for v2** is the v1 prompt with each tool written as `group.action`, plus one line on `action` and `describe`:
    - names with an underscore are mapped as words;
    - the few one-word tool names only in the phrases that name the tool, so "propose it" and similar English words stay English.
  - **Switch**: `CAD_TOOLSET=v2` makes the chat server list the v2 tools (`--allowedTools`) with the v2 prompt and pass the set to the MCP server. The MCP server lists them and answers `initialize` with `barocss-cad-tools-v2`. **v1 stays the default** until the A/B.
  - **Frozen** in `src/chat/tools-v2.json` with the same breaking-change rules as v1 (an action removed narrows the enum: breaking). tools-v1.json is unchanged.
- **Sizes** (what a model reads every turn):
  - **v2 tools/list 10 985 characters** (target ≤ 15k), against v1's 79 171;
  - **system prompt v2 7 094**, against v1's 6 870 (+224: names with a group, one line);
  - **per turn 86 041 → 18 079 characters (−79 %)**.
  - The biggest v2 tool is `model` (2 476, the script language); `features` is 1 451 with every command and feature kind named.
- **Evidence**:
  - `test/toolset.test.ts` (9 tests):
    - the sizes;
    - every v1 tool is one action, and the v2 prompt names only v2 tools that exist;
    - the frozen v2 contract and an action removal flagged as breaking;
    - v2 calls give byte-identical results to their v1 calls, and unknown or missing actions are refused with the list;
    - `describe` in all its forms, and for every listed command and feature kind;
    - the gates (L2 `needs_proposal`), a v2 op kept as `run_command` and replayed on accept, a v2 batch;
    - the MCP server in v2 (contract version, 13 tools, v2 and v1 calls, structured content, `query.select` saving the selection);
    - the chat server's arguments per set;
    - the replay hook.
  - Browser flow 151/151, with the new step "A5.3" (just before the last step): a v2 chat server; the scripted agent calls describe, model, features.edit, query.mass and the v1 mass_properties in one turn; the part built, every call answered.
  - **The whole studio suite replayed through v2**: `CAD_TOOLS_VIA_V2=1` sends every v1 call (tests, ops, proposals) as its v2 call. **462/462**, the same as without it, which covers every chat, proposal, assembly, drawing and cage test (O8's acceptance).
  - Bench: all 45 rows within budget (dispatch adds one table lookup a call; run_script 12 calls 238 ms, check_spec 24 ms).
- **Deferred to A5.5**: which list is the default, and whether the v1 aliases go. That is a measured decision (pass rate, calls, tokens), not a size one.
