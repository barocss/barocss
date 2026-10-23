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

## O12 — A5.4: the external MCP server (`cad-mcp --doc`) and the CLI (`cad-cli`) (2026-10-20)

- **`cad-mcp --doc part.bcad [--toolset v1|v2] [--autonomy 1–4] [--libraries dir]`** (`server/cadDoc.ts`, `scripts/cad-mcp.mjs`, `pnpm mcp`):
  - serves the studio's tools over stdio to any MCP client (Claude Code, Claude Desktop) for as long as the client keeps it. An MCP config entry is `{"command": "node", "args": ["<repo>/apps/cad-studio/scripts/cad-mcp.mjs", "--doc", "<abs>/part.bcad"]}`.
  - **One tool layer** with the chat: `serveMcp` now takes a store, either the chat server's per-turn state file (as before) or the document. The calls, results, gates and both tool lists are the same.
  - **Saves each change at once, atomically**: a temporary file beside it, renamed over it, so a reader sees the old file or the new one. Mesh blobs are saved in the container (`encodeStudioFile`); a part without them is plain JSON, as the studio saves. A read writes nothing; reopening without a change leaves the file byte-identical. A change the file cannot take (a missing folder, a blob not loaded) is answered as an error, `Not saved: …`.
  - A file that does not exist yet is a new, empty part, written on the first change.
  - **Local files only**: a path with a URL scheme is refused (a drive letter is fine), and so is one that is not `.bcad`/`.json`. The tools touch no other file.
  - **Autonomy as in the studio** (default L2; one MCP session is one turn, its base the file as opened):
    - an empty part is built directly, values are edited directly, and the rest is proposed;
    - proposals stay in the file for the user to accept in the studio (assemblies, drawings and locked parts always need that);
    - `--autonomy 3|4` lets the agent accept its own, as in the studio.
  - stdout carries only the protocol; usage errors go to stderr with exit code 2.
- **`cad-cli`** (`server/cadCli.ts`, `scripts/cad-cli.mjs`, `pnpm cli`), for batch work and CI:
  - `run <script | -> [-o part.bcad] [--doc base.bcad] [--step part.step] [--stl part.stl] [--check] [--dry-run]` runs a run_script script on base.bcad or an empty part and writes what is asked.
    - STL is one file per body when there are several (`part-b1.stl`, …): the kernel's writer, else the display mesh.
    - It prints a JSON summary (calls, names, facts, files written, checks).
  - `check part.bcad` runs a saved part's requirements.
  - The person running it is the author, so no autonomy gate applies.
  - **Exit codes**: 0 done; 1 the script or a tool refused (printed `file:line:col: [CODE] reason`, nothing written); 2 usage; 3 a hard requirement fails.
- **The script language gains `requirements([...])`** (set_requirements), so a script carries what it must meet and `--check` gates CI on it. It is a compatible addition to `barocss-cad-script-v1`, and the contracts are unchanged (descriptions are not frozen).
- **Sizes after it**: v1 tools/list 79 259, v2 11 073; prompts 6 870 / 7 094.
- **Evidence**:
  - `test/cad-external.test.ts` (6 tests):
    - **cad-mcp spawned as a client would** (the real script, stdio): initialize, list, run a script, the file saved on the change and not on a read, no temporary file left. A second session (v2) reopens the file and finds the same facts, and the file is byte-identical.
    - A container with mesh blobs: changed, saved with its blobs, read back whole.
    - The options (local files only, the flags), and the real script's usage error (exit 2, stdout empty).
    - A save failure reported as `Not saved`.
    - **cad-cli** in process: .bcad, STEP (`ISO-10303-21`) and binary STL (its size from its triangle count); `--check` passing and failing (exit 3); `check`; a refused line (exit 1, nothing written); `--doc` and `--dry-run`; one STL per body; the usage errors.
    - cad-cli spawned for real.
  - Conformance `a5/requirements-in-script`.
  - Studio 468/468, and 468/468 replayed through v2. Browser flow 152/152, with the new step "A5.4" (just before the last step): a part written by cad-cli from a script (with `--check`) opens in the studio with its five features, one body and its requirement.
- **Pending (reversible default taken)**: cad-mcp's default autonomy is L2, the studio's. An owner who drives the agent from their own client may want L4 by default; it is one flag today.
- **Not in A5.4**: editing one file from the studio and cad-mcp at once (the last writer wins; the studio does not watch files). That belongs to the document service (out of A5, O8).

## O13 — A5.5: the A/B harness, dry-run with the scripted agent (2026-10-20)

- **What** (`server/ab/briefs.ts`, `server/ab/harness.ts`, `server/ab/main.ts`, `scripts/ab.mjs`, `pnpm ab`):
  - **Arms**:
    - **json**: the v1 tools without run_script, and the prompt without its paragraph (today's tools before A5.2; `CAD_TOOLSET=json`);
    - **hybrid**: the v2 tools with `model.run` (A5.3).
  - **Briefs**: 10 single-part rungs of the RB9 ladder, each with 3 parameter variants (run k takes variant k):
    - block-hole, washer, phone-stand (RB9.3), machined-plate (RB9.4), l-bracket (RB9.5);
    - flange, open-box (RB9.8), pcb-enclosure (RB9.9), stepped-shaft, knob (RB9.13).
    - Each brief is a few sentences of words. Its dimensions are the brief's own, taken from no standard.
    - The assembly, sheet-metal and stress rungs are left for later: an agent can only propose an assembly, and the kernel has no stress oracle.
  - **The oracle**: each brief's hard requirements (bounding box ±0.1, volume in closed form ±0.5 % or between closed-form bounds for the knob's fillet, one solid).
    - The kernel checks them on the part the agent leaves, with the agent's own requirements set aside. The agent never sees them.
    - They depend on no face names, so any construction that makes the part passes.
  - **Every run takes the product path**:
    - a fresh empty document, one turn through the real chat server in-process;
    - the CLI spawned with the arm's tools and prompt, and the MCP tool server on a state file;
    - autonomy L2 (an empty part's first build applies directly).
    - The agent is the `claude` CLI (live) or the scripted stand-in (dry run), which makes the brief's ideal calls through the same path: requirements, then the build, then the check.
  - **Measures per run**: pass (every hard oracle requirement), each outcome, tool calls, refusals, the tools called, wall time, and tokens.
    - Live: the CLI's own usage and cost (the chat server now forwards the result message's `usage`, `num_turns` and `total_cost_usd` in its `done` event).
    - Dry run: an estimate of what each model turn would read: prompt, tools, the brief, and the calls and results so far, at 4 characters a token, one call a turn. Input not read from the prompt cache is reported apart.
  - **Summaries**: per brief and arm, passes, pass@k (any), pass^k (all) and means; per arm, the totals. Written to `results.json` and `report.md`.
  - **Live runs need `--live` and `CAD_AB_LIVE=1`**; either alone is refused with exit 2, and nothing runs. The owner decides.
- **Found by writing the briefs, fixed here**:
  - (1) The `between` edge selector missed edges whose name marks a face's second occurrence (`n1.side0#2|n1.top`, a cylinder's top edge), so a fillet on a cylinder's top edge by `edge(k.top, k.side0)` was refused. Fixed in `names.ts`.
  - (2) A script's feature handle as a body (`h.body`, or `h` in a selection) was the body as that feature made it, a key gone after its holes or a union. It is now the body that holds that feature's faces now. So `difference([plate, tool])` after the plate's holes works, and `union([b, cylinder(…)])` in a loop keeps joining onto one body.
  - (3) `const a = 1, b = 2` (several names in one `const`) was a syntax error; it is now in the language. It made 2 of 10 hybrid briefs fail on the first dry run.
- **The dry run** (`handover/notes/ab-dry-run-2026-10-20/`): 60 runs (10 briefs × 2 arms × 3 runs), **all pass in both arms**.

  | Arm | Calls a brief | Input tokens a brief | Not from the cache | Output |
  |---|---|---|---|---|
  | json | 6.4 | 151 944 | 21 918 | 396 |
  | hybrid | 2.0 | 14 175 | 4 993 | 342 |

  - These are estimates for an ideal agent: a lower bound.
  - Each model turn re-reads the prompt and tools: about 17.9k tokens in json, 4.1k in hybrid.
  - The dry run proves the harness, not value: the scripted agent is written to succeed (L2 for the harness; value needs the live L3 run).
- **Live cost estimate** (for the owner's decision; tokens, not money: the CLI reports the cost per run):
  - The plan: 10 briefs × 2 arms × 3 runs = 60 turns, at most 24 model turns each (the chat server's cap).
  - **Lower bound** (the ideal calls):
    - json 30 × 152k = 4.6M input (0.66M not from the cache), 12k output;
    - hybrid 30 × 14k = 0.43M (0.15M), 10k output;
    - **about 5.0M input tokens in all (0.8M uncached), 22k output**.
  - **If a live agent makes 3× the ideal calls** (an assumption, not a measurement: reading, inspecting, repairing):
    - json 19 calls, 515k input a run;
    - hybrid 6 calls, 40k;
    - in all 15.5M + 1.2M = **about 16.7M input tokens (1.1M uncached), 57k output**.
  - The json arm is about 92 % of either total.
  - A smaller first live run, 1 run a brief and arm, is a third of these.
- **Evidence**: `test/ab.test.ts` (6 tests):
  - every brief's ideal calls pass the oracle in every variant in both arms (60 builds in process), each in its arm's tool names;
  - the oracle fails wrong parts (no hole, too wide, two solids, nothing built);
  - what each arm reads (json has no run_script; the estimate grows each turn; json about 4.4× hybrid a turn);
  - pass@k and pass^k;
  - **the real `scripts/ab.mjs` dry run** of two briefs × both arms (4 runs: calls 4/2/13/2, json's input over 10× hybrid's on the enclosure);
  - the live guard.
  - script.test gains `const a, b`. Studio 474/474; replayed through v2 474/474. Browser flow 152/152 (no UI change, no new step). Bench 45/45 within budget.
- **Pending (the owner's)**: the live runs (L3). After them, the decision A5.3 left open: the default tool list and whether the v1 aliases go.

## O14 — RM1: the mate graph as a joint tree (2026-10-20)

- **Starting point** (S0, read here):
  - The assembly is instances placed by six mate kinds (coincident, distance, angle, concentric, tangent, lock), solved analytically.
  - The solver gives each instance's remaining freedom as counts (turns, slides) but not the axes. It refuses directed placement loops (`mates.ts`).
  - Spur gears carry their placement (`GearPlacement`, the part's own coordinates); D56's `checkPlacedSpurGears` checks a placed pair.
  - There is no gear mate kind and no ball face or mate.
- **What** (`src/robot/joints.ts`, versioned `doc.robot`):
  - **Links**: one a part (the base part and each instance), plus dummy links inside joint chains.
  - **One joint a pair of parts with mates between them.** Its kind is read from the mates' first-order constraints at the solved pose, not from the mate kinds by name:
    - each mate adds rows on the child's twist relative to its parent (directions that must not turn, points that must not move along a direction, lengths scaled by the assembly's size);
    - the free twists are the rows' null space (Gram–Schmidt).
    - So any combination the solver accepts is classified the same way, a redundant mate adding nothing.
  - **Classes**:
    - no freedom → **fixed**;
    - one turn → **revolute**, or **continuous** without lower and upper limits;
    - one slide → **prismatic**;
    - slides and one turn → a **chain through dummy links**, slides first (cylindrical = a slide and the turn on its axis; planar = two slides and the turn about the normal);
    - three turns about one point → a **ball** chain of three revolutes. The classifier knows it, but no mate kind makes it yet.
    - A screw motion, two turns on different axes, or more is **MOTION_UNSUPPORTED**, typed, never guessed.
  - **Joint frame**: the axis and a point on it (the child's origin projected onto it), world frame, mm. Joint values are 0 at the pose the mates solve to (onshape-to-robot's convention).
  - **The tree**: grown from the chosen base link (the base part by default; `robot.base` sets another) by **Prim's algorithm weighted by each pair's degrees of freedom**, ties in the document's order. A loose mate therefore closes a loop rather than replacing a stiffer joint. This was found by the loop case: breadth first took a planar `distance` pair over a revolute one.
    - Pairs the tree does not take are **loops**, reported with their mates and freedom, never dropped (closures are RM8's).
    - A grounded instance is fixed to the base; a part joined to nothing is **NOT_CONNECTED**.
    - A mate the solver could not meet makes no joint (**MATE_PROBLEM**).
  - **Joint keys**: the pair's parts in the document's order (`base~arm`), a chain's `#0`, `#1`, … whichever part is the parent. So settings survive a change of base link; with key `parent~child` they were orphaned.
  - **Limits and ratings** (`robot.joints[key]`: lower, upper, effort, velocity; radians or mm; N·m or N; rad/s or mm/s):
    - read leniently, malformed ones dropped;
    - **LIMITS_BAD** (lower above upper, a rating ≤ 0) is a problem;
    - **LIMITS_MISSING** is a note (a prismatic joint's range, or a joint's ratings, which export needs).
  - **Gear couplings** (D56's mate as a coupled joint): two spur gears on turning joints of one carrier, their axes on the joints' axes and their tip circles overlapping.
    - They are checked with `checkPlacedSpurGears` in a common frame (centre distance, backlash, contact ratio).
    - The second **mimics** the first: multiplier −z1/z2, offset 0.
    - Not coupled, with a note: gears on different carriers, gears facing opposite ways, or a pair the kernel refuses. A rack (a prismatic coupling) is left for later.
- **Tools**:
  - `get_joints` (read, output schema) and `set_joints` (base link and joint settings by key, null clearing; alters, idempotent), in v1 and as v2 `assembly.joints` / `assembly.set_joints`. These are compatible additions to both contracts.
  - The robot settings are the assembly's, so `approvalOf` now names `robot`: an agent proposes, the user accepts (D41).
  - One line in the system prompt.
- **Studio**: a **Joints** card (when the assembly has mates and nothing is selected) with the base-link select and each joint (parent → child, type, axis, limits, a gear follower), loops and problems.
- **Sizes**: v1 60 tools, tools/list 81 405 characters; v2 11 266; prompts 7 086 / 7 334.
- **Evidence**:
  - `test/robot-joints.test.ts` (8 tests) over assemblies built from real parts and solved:
    - revolute (axis +Z, origin on the hole axis at the child, continuous; limited → revolute with the limits kept);
    - prismatic along +X;
    - cylindrical and planar chains with their dummy links;
    - fixed by mates, by a lock and by grounding; a loose part NOT_CONNECTED;
    - a 2R chain from either end (keys kept, parents swapped); a loop kept; an unknown base link;
    - ball, screw and two-axis twists; a tangent pin MOTION_UNSUPPORTED;
    - two meshing gears (centre distance 50 = m(z1+z2)/2 exactly, follower ×−2/3);
    - the settings reader and both tools, gated (`needs_approval`), validated and proposable.
  - Conformance `packages/barocss-cad/conformance/rm/` (11 cases: each document and its expected tree; `UPDATE_RM_FIXTURES=1`), each also read back from its file.
  - Browser flow, a step "RM1" just before the last: an assembly opened, the Joints card reads `Base part → arm Continuous +Z`, and the base link moved to the arm (saved in `robot.base`).
  - Bench: the joint tree of a 12-link serial arm takes 0.27 ms (budget 1); 46 rows within budget. Studio 482/482, 482/482 replayed through v2; browser flow 154/154 (screenshot `notes/acceptance/rm1-joints.png`).
- **Next**: RM2, forward kinematics over the tree and the joint-slider preview (the gear pair turning together, its clearance shown).

## O15 — RM2: forward kinematics over the joint tree, the joint sliders (2026-10-20)

- **FK** (`src/robot/fk.ts`): the product of exponentials in the space frame (Lynch & Park).
  - Each joint's screw is its axis and point at the solved pose, where every value is 0. So a link's motion from its solved pose is `D = exp([S1] q1) · exp([S2] q2) · …` along its path from the base link, and its pose is `D · M`.
  - Revolute and continuous joints turn q radians about the axis through the point; prismatic ones slide q mm along it; fixed ones stay.
  - **Followers** (a gear's `mimic`) take multiplier × leader + offset, whatever was given for them.
  - **Limits are reported, not clamped**: `outOfLimits` (a preview may show them; an export refuses). Unknown keys are reported too.
  - It runs per slider move: module-level helpers writing into given arrays, no closures, one motion allocated a link.
- **The gear pair at any pose** (`gearPairAt`, D56):
  - each coupling now carries both gears in its common frame and each joint's sense about that frame's Z;
  - at joint values, both gears are turned by their joints and the kernel's `checkPlacedSpurGears` is run again.
  - With the right ratio and sign, the tooth phase stays the home phase, so the pair turns together; the check is what proves it.
- **The preview** (`src/robot/preview.ts`):
  - the instances shown are moved by FK on copies of their meshes (`placeBody`, now exported); the evaluated bodies are untouched;
  - at home nothing is copied;
  - when the base link is an instance, motions are shown relative to the base part's: the same relative motion, the base part still.
  - Nothing is saved: the placements in the document do not change.
- **Studio**:
  - in the Joints card, a slider for each moving joint that is not a follower, in degrees or mm (its limits; else a turn either way, or ±50 mm for a slide without limits);
  - a follower's value shown with it;
  - each gear pair's line: "mesh held" or "teeth out of phase", and its backlash at that pose;
  - **Home**, and **▶** to play one joint through its range (4 s a swing, `requestAnimationFrame`, stopped by touching a slider).
  - Exploding the view applies after the pose.
  - The sliders take any value (`step="any"`): with a step of a 720th of the range, the browser snapped π to 179.5°. This was found by the flow step.
- **Tool**: `forward_kinematics {values}` (read, output schema; v2 `assembly.pose`). It returns each part's placement at the values (position mm, rotation in degrees as `place_part` takes it), the values used, joints out of limits, and each gear pair's phase against home (`held`). Compatible additions to both contracts.
- **Sizes**: v1 61 tools, tools/list 82 438 characters; v2 11 336; prompts unchanged (7 086 / 7 334).
- **Evidence**:
  - `test/robot-fk.test.ts` (7 tests):
    - **the planar 2R tip by its closed form to 1e-9** over 200 random poses;
    - **the product of exponentials equals the moving-axis form** (each axis carried by its parent's motion, then turned about there) on 20 random 3D trees of 8 turning and sliding joints, to 1e-9, every rotation orthonormal to 1e-12;
    - the gear follower from its leader (even when given another value), the **tooth phase held at 25 random poses** to 1e-6°, the backlash and centre distance unchanged, and a wrong ratio caught;
    - limits reported not clamped, slider ranges, unknown keys, a prismatic slide;
    - the tool (a quarter turn: placements `[30, 10, …]` and `[0, 0, 90]`; the gear `held`; refusals);
    - the preview on copies (the evaluated mesh unchanged, a half turn's bounds, the same bodies at home);
    - the RM2 conformance cases.
  - Conformance `conformance/rm/fk-chain-2r` (5 poses' tip by the closed form, written from the formula, not the code) and `fk-gears` (4 leader values: the follower's value and the held phase). The RM1 case list now counts only its own step.
  - Browser flow, a step "RM2" just before the last:
    - the 2R arm from its conformance file; the second arm swung a half turn by its slider, shown at x 10…70 from 50…110 and reading 180.0°;
    - the document's placements unchanged; Home back;
    - the first joint played (moving by itself) and stopped.
  - Bench: FK of the 12-link arm takes 0.02 ms (budget 0.1); its 11 moving links' meshes posed take 0.45 ms (budget 2).
  - Studio 489/489, 489/489 replayed through v2; browser flow 155/155; bench 48/48 within budget (screenshot `notes/acceptance/rm2-posed.png`).
- **Next**: RM3, link-frame inertia about the CoM (I_L = R·I·Rᵀ), checked against an analytic rotated off-origin cuboid; SPD and the triangle inequality.

## O16 — RM3: link inertia about the centre of mass, in the link frame (2026-10-20)

- **What** (`src/robot/inertia.ts`):
  - **Each link's bodies** (its part's, in the part's own coordinates) are combined by mass:
    - each at its own material's density (the kernel's mass and inertia are aluminium's, scaled by ρ/2.70);
    - each inertia moved to the common centre by the parallel-axis theorem, `I + m(|d|²E − d dᵀ)`.
  - **Then into the link frame**: `I_L = Rᵀ·I·R` (R's columns: the link frame's axes in the part's coordinates), the centre `Rᵀ(c − o)`. SI units, as URDF and MJCF take them: kg, m, kg·m².
  - **Principal moments and axes** by cyclic Jacobi rotations: our own, exact to rounding for 3 × 3.
  - **The link frame**, the one RM4 writes the child link in (onshape-to-robot: the child frame at the joint):
    - the base link: its part frame;
    - a link on a moving joint: at the joint's point, Z along its axis, X the part's X square to it (else the part's Y), right-handed;
    - a link on a fixed joint: its part frame;
    - a dummy link: massless.
  - **Checks, typed**:
    - NOT_SPD (the least principal moment not above 0) and TRIANGLE (the largest above the sum of the other two) are problems;
    - NO_VOLUME (a body without a closed volume, not counted) and NO_BODY (massless) are reported;
    - MATERIAL_ASSUMED is said for each body without a material (aluminium taken).
- **Tool**: `link_inertia` (read, output schema; v2 `assembly.inertia`). Per link: mass, centre, inertia, principal moments and axes, the frame, the bodies counted (material, assumed, mass) and the issues, to 10 significant figures. Compatible additions to both contracts.
- **Studio**: the Joints card lists each link's mass and centre of mass (mm, link frame), "material assumed" where it is, and any problem; the principal moments are in its tooltip.
  - In the studio the bodies are already placed in the world, so the link frames are taken in world coordinates there. Same answer, other coordinates; checked by the flow against the tool's numbers.
- **Sizes**: v1 62 tools, tools/list 83 287 characters; v2 11 421; prompts unchanged.
- **Evidence**: `test/robot-inertia.test.ts` (8 tests).
  - **An analytic rotated, off-origin cuboid** (40 × 20 × 10 from (15, −7, 3), turned 30° about Z then 50° about X):
    - mass, the moved centre `R·c`, and `I = R·diag(m(d²+h²)/12, …)·Rᵀ`, all to 1e-12 relative;
    - its principal moments the cuboid's own;
    - in 10 arbitrary link frames, `I_L = Rᵀ I R` and the centre `Rᵀ(c − o)` to 1e-12, the principal moments unchanged.
  - A cylinder's `m r²/2` and `m(3r² + h²)/12` to 1e-12; another material scaling mass and inertia exactly by its density.
  - Two separate blocks combined by the parallel-axis theorem against the pair's closed form.
  - The checks on synthetic bodies (TRIANGLE for diag(1, 1, 3), NOT_SPD, NO_VOLUME and NO_BODY, a massless dummy).
  - The eigen-solver on 200 random symmetric matrices (rebuilt to 1e-12, vectors orthonormal).
  - The link frames checked through world coordinates on an instance turned three ways (origin and Z on the joint's point and axis, right-handed).
  - The tool on the 2R arm (the arm's mass 60·20·5 − 2π·25·5 mm³ of aluminium, its centre (0.02, 0, 0.0025) m from its turning hole).
  - Conformance `conformance/rm/inertia-cuboid`: the cuboid's document and its answer written from the closed form, not the code.
  - The positive-definite and triangle checks hold for every real body here; the kernel's mass properties are exact for these planar and cylindrical bodies.
  - Studio 497/497, 497/497 replayed through v2. Bench: link inertia of the 12-link arm takes 0.1 ms (budget 0.5); 49 rows within budget.
  - Browser flow 157/157, with a step "RM3" just before the last: the 2R arm's links in the Joints card (base 103.8 g; each arm 14.1 g, CoM (20.0, 0.0, 2.5) mm, material assumed). The step found a "−0.0" shown for a rounding of zero and a cramped row; both fixed. Screenshot `notes/acceptance/rm3-mass.png`.
- **Next**: RM4, URDF export. Child frame at the joint, meshes in the link frame, convex-hull collision, mm→m. Acceptance by `check_urdf`, and by MuJoCo or PyBullet as external oracles for mass, CoM, principal inertia and FK.

## O17 — RM4: URDF export, our reader and the URDF spec's structure; the MuJoCo comparison pending (2026-10-20)

- **Export** (`src/robot/urdf.ts`, `barocss-urdf-v1`):
  - One `<link>` a link, the base link the root. A joint chain's dummy links carry a tiny mass (1e-9 kg) and inertia (1e-15 kg·m²) rather than none: PyBullet takes a massless moving link as static, and MuJoCo refuses one. Documented here.
  - Each `<joint>`'s origin is the child link's frame in the parent link's (xyz in m; rpy as URDF's Rz·Ry·Rx) at the solved pose, where every value is 0.
    - Link frames are RM3's (at the joint, Z on its axis), taken into the world through each part's placement; a dummy link's is on its joint.
    - The axis is written in the child frame (computed: Z for a moving joint).
  - `<limit>`:
    - revolute: lower, upper, effort, velocity;
    - prismatic: the same, its limits and velocity in metres;
    - continuous: effort and velocity when both are set, else none, as URDF allows.
    - A gear follower is written as `<mimic joint multiplier offset>`.
  - `<inertial>`: RM3's mass, centre (m) and inertia about it (kg·m²) in the link frame.
  - `<visual>` and `<collision>`: the part's tessellation and its **convex hull** (`src/robot/hull.ts`, our own quickhull), binary STL in metres in the link frame, as `meshes/<link>.stl` and `meshes/<link>_collision.stl`.
  - Names: URDF-safe (`base~arm` → `base_to_arm`, a chain's `#1` → `_1`), unique.
- **Refused, typed** (`URDF_REFUSED`): MOTION_UNSUPPORTED, LIMITS_BAD, LIMITS_MISSING (a revolute or prismatic joint needs all four), INERTIA (a real link failing RM3's checks or massless), NO_HULL.
  - **Written with a note**: loops (URDF is a tree; the closure's mates are named), unconnected parts left out, materials assumed.
- **Read back and checked** (`src/robot/urdfCheck.ts`):
  - our own small XML reader (elements, attributes, comments, the declaration, the five entities, numeric references; typed errors with their place);
  - the robot model;
  - **the URDF spec's structural rules**: `<robot name>`; unique link and joint names; a joint's parent and child links exist; one parent a link; exactly one root; no cycle; a known joint type; revolute and prismatic `<limit>` complete; lower ≤ upper; a unit axis; mimic of an existing joint; inertials with mass > 0, positive definite and a triangle; every mesh file present.
  - **FK in URDF's own composition** (each joint's origin, then its motion about its axis in the child frame), against RM2's space-frame product of exponentials.
- **Where**:
  - tool `export_urdf` (read: the URDF text, the files with sizes, notes, our check; v2 `assembly.urdf`), a compatible addition to both contracts;
  - **Export URDF** in the Joints card (a zip: `robot.urdf` and `meshes/`);
  - `cad-cli urdf part.bcad -o folder [--name]`, which checks its output and exits 1 on any issue.
- **Pending: the external oracles** (the owner's go-ahead to install MuJoCo; the coordinator, 2026-10-20). `packages/barocss-cad/scripts/urdf-oracle.py` is written and not run. It loads the URDF in MuJoCo (no fusing, meshes by path) and compares each link's mass, centre and principal inertia, and link frames at sampled values (`xpos`, `xmat`), against `conformance/rm/urdf-*/expect.json`, tolerance 1e-6. The exact commands:

  ```
  uv venv ~/.cache/barocss-mujoco --python 3.12 && VIRTUAL_ENV=~/.cache/barocss-mujoco uv pip install mujoco==3.3.0
  node apps/cad-studio/scripts/cad-cli.mjs urdf packages/barocss-cad/conformance/rm/urdf-2r/robot.bcad -o /tmp/urdf-2r
  ~/.cache/barocss-mujoco/bin/python -I packages/barocss-cad/scripts/urdf-oracle.py /tmp/urdf-2r/robot.urdf packages/barocss-cad/conformance/rm/urdf-2r/expect.json
  ```

  The same applies to `urdf-gears`. `check_urdf` (ROS urdfdom, not on PyPI) runs where a ROS install is at hand. Until then the acceptance rests on our own checks below.
- **Run (O38, 2026-10-20)**: MuJoCo 3.3.0 (`mujoco-3.3.0-cp312-cp312-macosx_11_0_arm64.whl`, sha256 `2f435f34…d8710`). `urdf-2r` worst 1.1e-16, `urdf-gears` 2.2e-16, 21 rows each, against 1e-6. **The external check is closed.**
- **Evidence**: `test/robot-urdf.test.ts` (8 tests).
  - The hull:
    - a cube with points inside: 12 triangles, volume 1 to 1e-12, closed and oriented;
    - 2 000 random points: closed, Euler 2, every point inside to 1e-6;
    - flat and too few points refused, typed.
  - The XML reader and its six typed errors.
  - **The export read back**:
    - no structural issue;
    - the revolute-limited joint `base_to_arm` revolute, axis (0, 0, 1), its limits, origin (0.02, 0.02, 0.01) m;
    - the arm's inertial mass to 1e-15, its centre (0.02, 0, 0.0025);
    - the four mesh files present, their STL sizes consistent;
    - the checker catching a missing file, a cycle, a non-unit axis and a missing `<limit>`.
  - **FK read back from the URDF equals RM2's to 1e-12**: the 2R arm (50 random poses), the gear pair with its `<mimic>` multiplier −2/3 (20), and a slide-and-turn chain through a dummy link with limits in metres (30). Positions in the root frame and the full rotation.
  - Every visual vertex is inside its link's collision hull (1e-7 m); the arm's mesh lies in its link frame in metres (x −0.01…0.05 from its turning hole).
  - Refusals: a revolute without ratings, a slide without limits; a loop written with its note; a continuous joint without `<limit>`.
  - rpy read back through the reader's own Rz·Ry·Rx matrix, gimbal lock included.
  - The tool, the CLI (its folder's URDF equal to the frozen one), and the conformance cases `conformance/rm/urdf-2r` and `urdf-gears` (document, frozen `robot.urdf`, and `expect.json` for the pending oracle).
  - By hand: Python's standard `xml.etree` parses the frozen URDFs (an independent XML reader; no install).
  - Studio 505/505, 505/505 replayed through v2. Bench: URDF export and check of the 12-link arm takes 2.7 ms (budget 10); 50 rows within budget.
  - Browser flow 158/158, with a step "RM4" just before the last: Export URDF downloads a zip, read by Python's `zipfile`. Its `robot.urdf` is the CLI's frozen one to 12 significant figures. The studio works from world-placed bodies and the CLI from part coordinates, so only the last digits differ; the robot is named after the file.
- **Next**: RM5, MJCF export with the same checks; a 6R arm hangs under gravity stably. That step needs a simulator, so it depends on the same go-ahead.

## O18 — RM5: MJCF export, its structure and FK checked; the gravity hang pending (2026-10-20)

- **Shared model** (`robotParts`, `src/robot/urdf.ts`): link frames, RM3 inertials, meshes and hulls, refusals and notes, now one function used by both exporters. URDF's output is byte-identical to before (its frozen files unchanged).
- **MJCF** (`src/robot/mjcf.ts`, `barocss-mjcf-v1`):
  - bodies nest as the tree does, each at its link frame in its parent's (`pos` in m, `quat` w x y z: Shepperd's method, w ≥ 0);
  - a moving joint is a `hinge` or `slide` at the body origin along its axis (Z), `range` from its limits (a slide's in m), no range for continuous;
  - a fixed joint is no joint (the body welded to its parent); the base link is a body in the world without a joint (fixed);
  - `<inertial pos mass fullinertia>` from RM3, dummy links tiny as in the URDF;
  - each link has a visual mesh geom (no contacts, group 1) and its hull as a collision geom (group 3); meshes under `meshes/` (`compiler meshdir`), angles in radians;
  - a gear follower is `<equality><joint joint1=follower joint2=leader polycoef="0 m 0 0 0">`;
  - gravity −9.81 on Z.
  - **A passive model: no damping, friction, armature or actuators are invented.**
  - Refused as URDF is; loops not written (RM8 makes them equality closures).
- **Read back** (`src/robot/mjcfCheck.ts`, our XML reader), checking what MuJoCo's compiler would refuse from this export:
  - `<mujoco>`, `compiler angle="radian"`, `<worldbody>`;
  - unique body and joint names, one joint a body, a known type, unit axis and unit quaternion, `range` lower < upper;
  - every moving body with `<inertial>` (mass > 0, positive definite, a triangle);
  - every mesh geom's asset, and every asset's file;
  - equalities naming existing joints.
  - FK in MuJoCo's composition: a body's `pos`/`quat` in its parent, then its joint's motion about its own axis at its own `pos`; an equality's `joint1` from its polynomial.
- **The 6R arm** (`conformance/rm/arm-6r/robot.bcad`, built in `test/robot-mjcf.test.ts`):
  - a base plate and six 20 × 20 × 80 aluminium blocks, each with blind vertical holes at both ends and two through holes along Y (no bores crossing);
  - wrists stacked on Z, shoulders side by side on Y; axes Z, Y, Y, Z, Y, Z, from 12 mates; six continuous joints, no problem.
- **Where**: tool `export_mjcf` (read; v2 `assembly.mjcf`), a compatible addition; **Export MJCF** in the Joints card (a zip of `robot.xml` and `meshes/`); `cad-cli mjcf part.bcad -o folder`.
- **Pending: the gravity hang and MuJoCo's own read** (the owner's go-ahead; the coordinator, 2026-10-20). `packages/barocss-cad/scripts/mjcf-oracle.py` is written and not run. It loads `robot.xml` in MuJoCo and checks, against `conformance/rm/arm-6r/expect.json`:
  - masses, centres and principal inertia per body, and body frames (`xpos`, `xmat`) at two poses, tolerance 1e-6;
  - **the arm hanging under gravity** from the solved pose, RK4 at 0.5 ms:
    - as exported (no damping): 5 s with the total energy conserved to 1e-4 relative and nothing diverging;
    - with 0.002 N·m·s/rad on every joint, set in the oracle only (the export invents none): 30 s with the energy never rising, every |qvel| below 1e-3 rad/s at the end, and the centre of mass below its start.
  - The exact commands:

    ```
    uv venv ~/.cache/barocss-mujoco --python 3.12 && VIRTUAL_ENV=~/.cache/barocss-mujoco uv pip install mujoco==3.3.0
    node apps/cad-studio/scripts/cad-cli.mjs mjcf packages/barocss-cad/conformance/rm/arm-6r/robot.bcad -o /tmp/arm-6r
    ~/.cache/barocss-mujoco/bin/python -I packages/barocss-cad/scripts/mjcf-oracle.py /tmp/arm-6r/robot.xml packages/barocss-cad/conformance/rm/arm-6r/expect.json
    ```

  - **RM5 is not accepted without that run**: the writer, its checks and the arm are this checkpoint.
- **Run (O38, 2026-10-20)**: MuJoCo 3.3.0. It passed after two causes were found, with the tolerances unchanged: the upright equilibrium start (now RD1's gravity torques compared, to 4.4e-14, and the hang from a second pose), and contacts dissipating the energy (the hang now runs contacts off, the passive run at 0.1 ms). Passive drift 1.02e-6; damped settled at 8.8e-13 rad/s with the centre of mass fallen. **RM5 is accepted.**
- **Sizes**: v1 64 tools, tools/list 85 327 characters; v2 11 536.
- **Evidence**: `test/robot-mjcf.test.ts` (5 tests).
  - Quaternions: 300 rotations, near a half turn too, unit with w ≥ 0, back to the same matrix to 1e-12.
  - The 6R arm's MJCF read back with no issue: seven nested bodies, six hinges on their bodies' Z without range, 14 mesh assets, every inertial positive; gravity set; no damping, friction, armature or actuator attribute.
  - **FK three ways to 1e-12**: MJCF's (MuJoCo's composition) equals RM2's product of exponentials and the URDF's composition on the 6R arm (200 random poses), the gear pair (its equality `polycoef 0 −2/3`) and a slide-and-turn chain (its range in metres).
  - The checker's catches: degrees, a missing mesh file, a non-unit quaternion, an empty range, an equality to nothing, an inertia not positive definite or not a triangle, a moving body without `<inertial>`.
  - The tool (14 files, no issue), the CLI (`robot.xml` equal to the frozen one), and the case `conformance/rm/arm-6r` (document, frozen `robot.xml`, `expect.json` for the oracle).
  - By hand: Python's standard `xml.etree` parses the frozen model (7 bodies, 6 joints).
  - Studio 510/510, 510/510 replayed through v2. Bench: MJCF export and check of the 12-link arm takes 2.35 ms (budget 10); 51 rows within budget.
  - Browser flow 159/159, with a step "RM5" just before the last: the 6R arm opened (its six joints in the Joints card), Export MJCF read by Python (`zipfile`, `xml.etree`: 7 bodies, 6 hinges, 14 meshes), equal to the CLI's frozen model to 12 significant figures. Screenshot `notes/acceptance/rm5-arm.png`.
- **Next**: RM6, the sampled collision sweep (no simulator needed), unless the owner's answer comes first.
- **Follow-up (UX, logged 2026-10-20, not fixed)**: with six links the Joints card's mass list runs past the viewport and the card scrolls (`notes/acceptance/rm5-arm.png`). It could collapse to a summary line; it is listed in the README's outer-lane follow-ups.

## O19 — RM6: the collision sweep, conservative advancement (2026-10-20)

- **What** (`src/robot/sweep.ts`, `src/robot/gjk.ts`): a straight joint-space move `q(s) = q0 + s(q1 − q0)` checked for contact between links by conservative advancement (Schwarzer, Saha & Latombe).
  - At a sample, each pair's clearance `d`. Over the next step no point of one link moves towards the other more than `Δs · Σ_i |Δq_i| · r_i`, so the step `d / Σ|Δq_i| r_i` is free of contact. **The whole path is certified, not just its samples.**
  - **The bound**:
    - only the joints between the two links count (a common ancestor moves both together);
    - `r_i` holds in every pose: the joint-to-joint distances down the chain to the link (each fixed in its link) plus the link's own reach from its joint, by the triangle inequality;
    - a slide moves a point by exactly `|Δq|`; a gear follower counts with its multiplier.
  - **The clearance**:
    - first the links' convex hulls (RM4's) by **GJK**, our own (Ericson's closest-point regions on the simplex). This is the prefilter: a hull distance is never more than the true one, so a hull distance above zero proves two links apart;
    - where hulls meet, the meshes themselves: an **exact contact test** (an edge through the inside of a triangle, Möller–Trumbore with the edges and plane excluded, or one mesh inside the other by ray parity), and else their least distance (vertex–triangle and edge–edge, boxes first).
    - Touching without passing into each other is clearance 0, met to the tolerance (1e-6 mm).
  - **Pairs**: every pair of links but parent and child (they meet at their joint by design, as simulators exclude them); a pair in contact where the path starts and not moved by it is skipped, said so.
  - **Result**: clear, or the first contact (s, the joint values there, the two links); the least clearance and where; the samples taken; the pairs checked and skipped.
- **Where**: tool `sweep_path {from?, to}` (read, output schema; v2 `assembly.sweep`), a compatible addition; **Check path** in the Joints card (from the solved pose to the sliders', the result shown; moving a joint clears it).
- **Sizes**: v1 65 tools, tools/list 86 641 characters; v2 11 612.
- **Evidence**: `test/robot-sweep.test.ts` (5 tests).
  - **GJK** against the polytopes' brute-force distance (60 random hull pairs, to 1e-8), boxes in closed form (2, √3), 0 when overlapping.
  - **The motion bound holds**: 30 random 5-joint trees of turns and slides, a random step each; no hull point moves more than `Σ|Δq_i|·r_i` (dense FK at 100 points of the step).
  - **A 2R arm swung into a grounded post** (`conformance/rm/sweep-post`):
    - the first contact against an independent oracle, separating axes of the swung rectangles in the plane (both links span the post's height), found by bisection;
    - the sweep stops within 1e-4 rad of it and never past it; the post is named;
    - parent and child are skipped;
    - the way back (−π/2) is clear with its least clearance above 1 mm.
  - **The 6R arm folding** (three joints) against a dense sweep, the exact mesh test at 200 samples up to where the sweep stopped:
    - no earlier contact (the bound let none through);
    - where it stopped (link 4 meeting the base at s 0.739, 45 steps) the meshes are within the tolerance: a true contact;
    - 15 pairs checked (21 less the six parent–child ones).
  - The tool and the conformance case, its expected angle written from the plane oracle, not the sweep.
  - Studio 515/515, 515/515 replayed through v2. Bench: the 6R arm's folding sweep to its contact takes 225 ms (budget 700); 52 rows within budget.
  - Browser flow 160/160, with a step "RM6" just before the last: the arm turned 2 rad beside the post, Check path reports the contact with the post at its share of the move; a small move the other way is certified clear. Screenshot `notes/acceptance/rm6-contact.png`.
  - **Found by the flow and fixed (it touches RM3–RM5 too)**: the Joints card appears once the faces are read, before the placed parts' bodies are. Export or Check path pressed in that window found no bodies and refused "massless". The masses, both exports and Check path now wait until every placed part is evaluated as it stands (its bodies for that very instance; the buttons disabled until then). A part not yet evaluated is not massless. The RM5 step had passed by timing before.
- **Follow-up (not needed for RM6's acceptance)**: the mesh distance where hulls meet is brute force, O(n·m) triangle pairs. Fine for these parts (hundreds of triangles); a part of 100k triangles wants the BVH (R3.2) under it.
- **The RM track**: RM1–RM4 and RM6 are done; RM5 is at its writer checkpoint. **Pending the owner's go-ahead (MuJoCo)**: RM4's external comparison and RM5's gravity hang (O17, O18, commands there).

## O20 — RD1: static gravity torques (2026-10-20)

- **Lanes**: RD1–RD3 move from the kernel lane's sequence to the outer lane's (README §0, the coordinator 2026-10-20: they sit on `src/robot`).
- **What** (`src/robot/dynamics.ts`): G(q), what each joint must hold for the robot to stand still at q.
  - It is `G_j = ∂V/∂q_j` with `V = −Σ m_L g·c_L(q)`:
    - a turning joint: `Σ m_L (−g)·(a_j × (c_L − p_j))` (N·m);
    - a slide: `Σ m_L (−g)·a_j` (N);
    - over the links beyond the joint, its axis and point and each centre at q (RM2's FK; RM3's masses and centres, through each part's placement: `linkMasses`).
  - A gear follower moves with its leader, so its share goes to the leader by virtual work (`generalized`, ×multiplier); the follower's own axis value is kept too.
  - **Gravity**: standard 9.80665 m/s² (the CGPM's defined value) on −Z unless `g` is given. MJCF keeps MuJoCo's own default, 9.81, as the simulator's convention, and says so.
- **Where**: tool `gravity_torques {values?, g?}` (read, output schema; v2 `assembly.gravity`), a compatible addition; the Joints card shows "holds … N·m against gravity" for each joint at the pose shown.
- **The tool list's 15k guard** (A5.1: what annotations and output schemas add to tools/list): the robot tools had taken it to 15 053. The listing carried each tool's title twice (top level and in its annotations), so the annotations' copy is dropped from the listing. MCP lists the title at the top; the frozen contract keeps it. It is now 13 554: a de-duplication, not a looser guard.
- **Sizes**: v1 66 tools, tools/list 86 165 characters; v2 11 437; prompts unchanged.
- **Evidence**: `test/robot-dynamics.test.ts` (4 tests).
  - **The planar 2R and 3R closed forms to 1e-9** (300 random poses each):
    - arms of real 20 × 20 × 80 blocks on Y-axis joints beside an upright one;
    - each block's mass from its analytic volume (the box less its four holes, aluminium; the kernel's equal to 1e-12), its centre 20 mm above its lower joint, joints 40 mm apart;
    - `τ_j = −g Σ_{i≥j} m_i (x_ci − x_Jj)` in planar angles, independent of the 3D code;
    - upright, nothing to hold (to 1e-15).
  - **G = ∂V/∂q** on 40 random 3D trees of 6 turns and slides: central differences of the potential energy, to 1e-6.
  - A gear follower: `generalized` equals dV/dq along the coupling (1e-7), the follower not an independent joint.
  - The tool on the planar 3R, its torques equal to the closed form's, and the conformance case `conformance/rm/gravity-3r` (document, values, and torques written from the closed form, not the code).
  - Studio 519/519, 519/519 replayed through v2. Bench: gravity torques of the 12-link arm take 0.05 ms (budget 0.1); 53 rows within budget.
  - Browser flow 162/162, with a step "RD1" just before the last: the planar 3R from its conformance file posed by its sliders, each joint's "holds … N·m" equal to the closed form's to the 4 figures shown. Screenshot `notes/acceptance/rd1-holding.png`.
- **Next**: RD2, the RNEA, trapezoid and S-curve profiles, RMS and peak torque; RNEA = M(q)q̈ + C + G over 100 random states.

## O21 — RD2: inverse dynamics (RNEA), motion profiles, peak and RMS torque (2026-10-20)

- **RNEA** (`src/robot/dynamics.ts`), recursive Newton–Euler in world coordinates over the joint tree.
  - Outward: each link's ω, ω̇ and the acceleration of its joint point. A slide adds `a q̈ + 2 ω × a q̇`; gravity is the base accelerating upward, the usual device.
  - Inward: each link's `m a_c` and `I ω̇ + ω × I ω` about its centre, gathered to its joint; `τ = a·N` (a turn) or `a·F` (a slide).
  - Inertias are RM3's in world axes at home (`linkBodies`), turned by the pose. Slides are in mm (q, q̇, q̈) as in the studio, converted inside; torques N·m, forces N.
  - A gear follower's rates come from its leader.
  - Per call it builds no closures; child joints are cached a tree (it runs thousands of times a move).
- **The mass matrix by another route** (`massMatrix`): `M = Σ m J_vᵀ J_v + J_ωᵀ I J_ω` from the geometric Jacobians, not from the RNEA (a follower's column into its leader's).
  - That makes **RNEA = M q̈ + C + G** a check rather than a tautology: M from the Jacobians, G = RD1's.
- **Profiles** (`src/robot/profile.ts`), rest to rest, exact piecewise polynomials:
  - a trapezoid: `T = d/v + v/a`, or `2√(d/a)` triangular;
  - a **jerk-limited S-curve** (Biagiotti & Melchiorri's double S), seven constant-jerk segments, with the cases where a or v is not reached by their closed forms.
- **A move's torques** (`moveTorques`):
  - one profile on the path parameter s ∈ [0, 1], its limits the tightest over the joints (each joint's limit over its share |Δq|), so every joint stays within its own;
  - τ(t) by the RNEA with gravity along it.
  - **Sampling, stated in the result**: every segment end and 256 samples a segment. Each segment is evaluated by its own polynomial, one-sided at its ends, so the trapezoid's jumps in acceleration fall on the right side.
  - The largest |τ| is refined by golden section between its neighbours; the RMS is by Simpson's rule a segment.
  - **No limit is assumed**: the tool refuses a moving joint without its limits.
- **Found by the tests and fixed before commit**:
  - (1) samples at a segment's end first took the next segment's acceleration (and the move's last point none): the RMS was 1.4e-4 low on a trapezoid;
  - (2) a uniformly sampled oracle missed peaks sitting where an S-curve's jerk switches (a kink in τ(t)), 3.6e-6 low; the oracle now samples every segment by its own polynomial, ends included.
- **Where**: tool `motion_torques {to, profile, limits | joint_limits, from?}` (read, output schema; v2 `assembly.move`), a compatible addition. No studio UI in RD2: the profile limits must be given, and the joint settings hold no acceleration or jerk.
- **Sizes**: v1 67 tools, tools/list 87 749 characters; v2 11 526.
- **Evidence**: `test/robot-rnea.test.ts` (7 tests), the RNEA checked against oracles that do not use it.
  - **M from the Jacobians equals the RNEA's columns** `RNEA(q, 0, e_k) − G`, 40 random 3D trees of 6 turns and slides with random positive definite inertias, to 1e-9. **RNEA = M q̈ + C + G** there, and the RNEA's gravity part equals RD1's G.
  - **M symmetric** (1e-12) and **positive definite** (Cholesky). **½ q̇ᵀ M q̇ equals the kinetic energy** `Σ ½ m v² + ½ ωᵀ I ω` from FK velocities by central differences (v from the centres, ω from `R₊R₋ᵀ`), to 1e-6, 40 trees.
  - **The planar 2R Lagrangian closed form to 1e-9** (300 random q, q̇, q̈): `M11 = 2I + m lc² + m(l1² + lc² + 2 l1 lc cos q2)`, `M12`, `M22`, `h = m l1 lc sin q2`, gravity, on the RD1 arm (I about the hinge from RM3).
  - **The energy balance** along an S-curve from rest to rest: `∫ q̇ᵀ τ dt = V(end) − V(start)` (Simpson, 400 a segment), 10 random trees to 1e-6 and the 2R to 1e-7. This is the passivity check in its integral form.
  - The profiles:
    - durations against their closed forms: `d/v + v/a`, `2√(d/a)`, `d/v + v/a + a/j`, `4 (d/2j)^⅓`, and backwards;
    - the end at d exactly (1e-12) at rest;
    - the limits never exceeded (the peaks at the segment ends, and 2 001 samples each);
    - continuous position, velocity and, for the S-curve, acceleration;
    - v not reached with a reached.
  - **Peak and RMS against the closed form** of a joint with no gravity load: `|τ| = J a`, `RMS = J a √(2 t_a / T)` for the trapezoid, and the S-curve's from `∫a²` of its segments, to 1e-9.
  - The tool, and the conformance case `conformance/rm/move-2r`: the duration by the closed form and each peak from the 2R Lagrangian along that profile, written from the closed forms. The sampler's peak is within 1e-6 and never below it.
  - Browser flow 163/163, with a step "RD2" just before the last: `motion_torques` through the real chat and tool servers (the scripted agent) on the 2R from its conformance file, the S-curve's duration as the case has it.
  - Studio 526/526, 526/526 replayed through v2. Bench: a 12-link arm's S-curve move torques take 150 ms (budget 500). 54 rows within budget; on one run two kernel facet rows were slow under the kernel lane's concurrent load and passed on the re-run.
- **Next**: RD3, motor and reducer envelopes from named datasheets (each value with its source or flagged an estimate; no downloads, and a PDF-only value is a question for the coordinator) and the selection solver.
- **A page error the kernel lane saw** (its full flow on c885e6c0e, under load: "Cannot read properties of undefined (reading 'every')"; the coordinator asked which `.every(` of the outer lane's could take undefined):
  - Every `.every(` the outer lane added (R11b–RD2: drawing auto, issues, layout, reorient, types, dimensions; the tool contract; the joint tree; App's joint values and robot readiness) runs on an array that is always there: built by the function itself, a typed required field, or checked with `Array.isArray` first.
  - The RM3–RM5 race fixed in RM6 could not raise it either: before evaluation a part came back `null` and was handled as massless, not dereferenced.
  - The nearest candidates elsewhere are typed as required: a hole's `center` (`holeRegion.ts`), a picked vertex's `at` (App's selection).
  - **Not reproduced**: the full flow ran 164/164 here with the kernel suite running alongside it, and no page error.
  - The flow now records each page error's first stack lines (`test/browser-flow.mjs`), so the next occurrence names the code that threw.


## O22 — RD3: motor and reducer envelopes, source records, the selection solver (2026-10-20)

- **Source records** (`src/robot/actuators.ts`): every catalogue value is `{v, unit, src}`. `src` is one of:
  - `{page, read, label}`: the product page's URL, the date read and the page's own label for the value;
  - `{derived}`: how it follows from sourced values;
  - `{estimate}`: why it is estimated and what would replace it.
  - Units are as the pages give them (mNm, gcm², rpm/mNm …), converted to SI by one table. An unknown unit is refused.
- **Read for RD3** (2026-10-20, in the built-in browser): read only, no sign-in, nothing downloaded, non-essential cookies declined. maxon's dialog was answered "Deny". Harmonic Drive's banner offers only "I Accept", which was left unanswered.
  - **maxon 608131**, EC 45 flat Ø43.5 mm, 60 W (the page marks it NRND). Ten values under the page's labels: nominal voltage; no load speed and current; nominal torque (max. continuous torque); stall torque; speed / torque gradient; torque constant; rotor inertia; max. speed; weight.
    - Two other maxon part numbers (608141, 608139) and 353519 show no specifications here, so they were not used.
  - **Harmonic Drive CSG-2A-LW**: 18 component sets, sizes 14–32 at ratios 50–160. Each set's product page gives its ratio, Rated Torque L10, the limits for average, repeated peak and momentary peak torque, the Ave. Input Speed and the mass.
- **Estimated and flagged.** These values are not on the HTML pages; the catalogue is a PDF.
  - The values: the rated input speed, the L10 life the rated torque is given for, the maximum input speed, the wave generator's inertia, and the efficiency (70 %, which varies with speed, load and temperature).
  - Each estimate says so in its record, every check says whether its limit is `page`, `estimate` or `rule`, and the tool lists the chosen pair's estimates with why.
  - The inertia-ratio limit of 10 is a rule of thumb (`rule`), and can be set.
- **The model**, stated in the tool's `model` line:
  - rigid;
  - motor torque `τ_m = τ/(N η) + (J_m + J_in) N q̈ + T_f sgn q̇`, with η dividing in every quadrant (conservative);
  - friction `T_f = I_0 k_t`, from the page's no-load current and torque constant;
  - q̇'s sign is the move's, including its one-sided limit at the ends;
  - motor speed `N |q̇|`.
- **The cycle**: the move out, a dwell at the end, the move back and a dwell at the start, repeated. The dwells hold the static torque exactly, with no friction at rest.
- **The checks**:
  - motor:
    - the RMS over the cycle ≤ the nominal (max. continuous) torque;
    - |τ_m| ≤ the torque–speed line `(n_0 − n)/(Δn/ΔM)` at the nominal voltage, at every instant;
    - speed ≤ max. speed;
    - load inertia `M_jj(q)/N²` ≤ ratio × (J_m + J_in), with M_jj the largest over the segment ends.
  - reducer:
    - |τ| ≤ repeated peak;
    - input speed ≤ max. input speed;
    - the speed-weighted cube mean `T_av = (∫ n|τ|³ / ∫ n)^⅓` ≤ the average-torque limit;
    - `n_av = ∫ n / T_cycle` ≤ Ave. Input Speed;
    - life `L10 = L_n (T_r/T_av)³ (n_r/n_av)`, checked when a life is asked for.
  - Not checked: the momentary peak (emergency stops). The actuators' own mass is not added to the links, so each joint is sized alone. A slide is skipped, since there is no linear actuator data yet.
- **The solver**:
  - Every motor × reducer pair is checked over the sampled cycle. The feasible pairs are ranked by mass, ties going to the larger least margin.
  - The lightest is refined: golden section around each segment's worst sample for |τ_m|, the line margin and |τ|. It is then checked again; if it fails, the next pair is taken.
  - Sampling, stated: 256 samples a segment by its own polynomial, Simpson's rule for the integrals, the dwells exact.
- **Where**:
  - tool `size_actuators {to, profile, limits | joint_limits, from?, dwell_s?, life_h?, inertia_ratio_max?, motors?, reducers?, only_given?}`: read, with an output schema; v2 `assembly.size`; a compatible addition.
  - A caller's entries are refused without a source on every field.
  - `motion_torques` and `size_actuators` share one argument reader. RD2's `moveTorques` now builds its profile through `moveMotion` / `moveState`, which RD3 reuses, with no change in its results.
  - No studio UI: the profile limits must be given (as RD2).
- **Pending until the owner allows the documents** (opening a PDF is a download). The tool names them in `pending_worked_examples`:
  - the Harmonic Drive CSG-2A / CSF catalogue's gear-selection worked example (cube mean, average input speed, life);
  - the maxon catalogue's motor-selection example (operating point, RMS, the speed–torque line).
  - Either one, reproduced, would check the formulas against a published answer. The same documents would replace the five estimated reducer values.
- **Evidence**: `test/robot-actuators.test.ts` (5 tests).
  - **The closed forms to 1e-9** on a joint with no gravity load, on a trapezoid out and back with dwells, for two reducers. The checks: the motor RMS `√(2(t_a(A+T_f)² + t_v T_f² + t_a(A−T_f)²)/T_c)`, the line `A + T_f − (n_0 − N v)/(Δn/ΔM)`, the speeds, the inertia ratio, the peak `J a`, `T_av = J a (v t_a/d)^⅓`, `n_av = 2dN/T_c` and L10.
  - An S-curve's RMS against a dense independent sum (RNEA at 20 000 points a segment), to 1e-7.
  - **The dwell's share is exact** on a gravity-loaded joint: RMS²·T_c grows by `dwell (τ_hold(q1)² + τ_hold(q0)²)/(N η)²`, to 1e-9. The cube mean is unchanged; the mean speed scales with the cycle.
  - **The choice is the lightest that passes.** On a heavy one-joint arm (10 kg at 300 mm), with a test motor whose every value is a flagged estimate, the solver picks CSG-17-120. An enumeration one pair at a time shows every lighter set fails a check of its own: the three size 14s and the lower-ratio 17s. A longer life rejects at least as many.
  - **Every catalogue value is sourced**: a page (maxon or Harmonic Drive URL, 2026-10-20, a label) or an estimate with why.
    - Each reducer's page values come from its own page.
    - The torque limits are in the pages' order.
    - The motor page's values hold together: k_t × stall current ≈ stall torque within 1 %; n_0/(Δn/ΔM) ≈ stall torque within 3 %.
  - The tool, its refusals (no source, an unknown unit, nothing to choose from, no limits) and a slide skipped. The conformance case `conformance/rm/size-1r` is written from the closed forms.
  - Browser flow 165/165, with a step "RD3" just before the last. `size_actuators` runs through the real chat and tool servers on the size-1r case, and the move's and cycle's times are as the closed form has them. Studio 531/531.
  - Bench: sizing the 12-link arm's 11 joints over the 18 pairs (an S-curve out and back, refined) takes 735 ms (budget 2000). The refinement is most of it: an RNEA per probe for one joint.

## O23 — A6 S0: inputs — scope and acceptance frozen per item (2026-10-20)

Assigned by the coordinator after RM1–RM6 + RD1–RD3. Order: A6.1 → A6.2 → A6.3 → A6.4 → A6.5, with a checkpoint after each.

**What is already there** (surveyed; not rebuilt):
- **Requirements.** D36–D38: `requirements` with basis stated / assumed / ambiguous; Confirm in the requirements panel records `confirmed: {by, at}`.
- **Process.** `doc.process` holds the print and moulding processes (fdm, sla, sls, mjf, injection), with print rules. There is no CNC or sheet-metal process.
- **Materials.** Materials carry source ids, but every value is a flagged "typical" estimate; aluminium is assumed when none is set.
- **STEP and mesh.** They open as a new part (an `import` or `mesh` node). There are no reference, locked, datum or keep-out bodies.
- **Clearance.** `clearance` and `interference` exist: exact kernel `intersect` for overlap volume, display-mesh distance otherwise.
- **Images.** The image tools build solids directly from one `width_mm`, and nothing is confirmed. DXF is written only, never read.
- **Fasteners.** One `CATALOGUE` source list for the whole table; no per-value records.
- **Scripted agent.** It is stateless, one fixed list of calls per message, so a question-and-answer exchange is one scripted message per turn.

**Limits on every A6 step:**
- **No live-model run** without the owner's OK. Acceptance is deterministic: the scripted agent through the real chat and tool servers, plus fixtures for briefs and answers (`conformance/a6/`).
- **The kernel boundary.** A6.3 must not need kernel-core changes. If it turns out to need STEP import of assembly structure (instances, transforms) or an exact B-rep clearance, I stop and tell the coordinator.
- **Data provenance.** No ISO/ANSI text, no GPL tables. Every value carries its source record (as RD3's `{v, unit, src}`) or an estimate flag.

### A6.1 — the brief template (process and material required)
- **Scope**
  - **The brief.** `doc.brief` (versioned, in `STUDIO_DOC_FIELDS`), one record per field: `{value, basis: stated | assumed | ambiguous, source?: the user's words quoted, confirmed?}`.
  - **Fields**
    - Required: purpose, **process**, **material**.
    - Optional: quantity, envelope (max size), interfaces (mating parts, holes, fasteners), loads and environment, finish and appearance, notes.
  - **Process values.** The five existing processes, plus `cnc-milling`, `cnc-turning` and `sheet-metal`, recorded as intent only: their checks belong to the kernel lane's later steps (R12, CNC1–6) and are said to be not checked yet.
  - **Material values.** A library material id, or a named material not in the library (kept, its density unknown).
  - **Tools.**
    - `set_brief`: adds fields; a field the user stated is never overwritten by an assumption.
    - `get_brief`: returns the brief, with `gaps` listing the required fields still missing or not stated.
    - Both are added to the v2 groups.
  - **The link to the document.** A stated process sets `doc.process` when it is one of the existing processes. A stated library material sets the bodies' material only through the existing material setting, proposed (D41) when there are bodies.
  - **The prompt.** The system prompt says to fill the brief first.
- **Acceptance**
  - Brief fixtures (complete; process missing; material missing; both missing; a non-library material; CNC) give the expected gaps.
  - An assumption never overwrites a stated field.
  - The field registry test covers `brief`.
  - The v1/v2 contract records the tools.
  - A flow step: the scripted agent sets a brief through the real servers, and the studio shows it.

### A6.2 — the clarifying policy (blocking unknowns only; 1–2 batches of at most 5)
- **Scope**
  - **A question tool.** `ask_user {questions: [{id, field | requirement, text, kind: choice | number | text, options?, blocks: why the design cannot go on without it}]}`. The tool layer enforces the policy, not just the prompt:
    - at most **5 questions a batch** and **2 batches a brief** (counted in the session policy, D37);
    - each question names what it **blocks**: a required brief field, or a hard requirement whose value is unknown;
    - a question that blocks nothing is refused with "make it an assumption", and so is a 6th question or a 3rd batch;
    - typed refusals: `TOO_MANY`, `NOT_BLOCKING`, `BATCHES_USED`.
  - **Everything else is an editable assumption.** It goes into the brief or the requirements with `basis: assumed`.
  - **The Specify panel** (in the Browser, beside the requirements). It is our own, following the reference's pattern only (required / worth a check / accept all; nothing copied):
    - "N to answer, M to check";
    - the required questions with their inputs;
    - the assumptions worth a check, each editable;
    - **Accept all as they are**;
    - "nothing is blocked": the user may skip, and the agent goes on with the assumptions said.
  - **Answers.** They are written into the brief or requirement as `stated` with `confirmed: {by: 'user', at}`, then sent to the chat as one message.
  - **Questions are not asked** about values the brief or the model already has.
- **Acceptance**
  - Fixtures of briefs with scripted question batches, against the expected verdicts: accepted; refused as too many; as not blocking; as batches used.
  - Answer fixtures applied through the panel give the expected stated and confirmed fields.
  - Accept-all turns every listed assumption into a confirmed one.
  - A flow step drives one turn of scripted questions, the panel's answers, and a second scripted turn that sets the requirements from them.
  - No live model.

- **Added on acceptance (coordinator, 2026-10-20):**
  - "What it blocks" must name a real gap that `get_brief` reports, or a hard requirement whose value is unknown.
  - A question citing a field already stated is refused as `NOT_BLOCKING`, with a test.

### A6.3 — a STEP or mesh file as a locked reference body, with datums and keep-outs
- **Scope**
  - **The reference node.** `{kind: 'reference', name, source: {step} | {mesh}, locked: true, at?: placement}` is added to an existing part. It reuses the kernel's STEP reader and the studio's mesh path as they are: one or more solids as one reference, with **no assembly structure**.
  - **Locked.**
    - No feature may take a reference as a parent: Booleans, fillets and edits are refused with a typed `REFERENCE_LOCKED`.
    - A reference is left out of mass, exports and printability unless asked.
    - It is shown ghosted. Moving it is an explicit, recorded placement.
  - **Datums.** Named planes, axes and points, taken from a reference's planar face, cylindrical face or vertex, or given explicitly. They are stable through the A1 signatures. They are usable as a sketch plane, as `measure`, `distance_between` and requirement subjects, and as mate targets.
  - **Keep-outs.** Regions the part must not enter:
    - the reference itself offset by d mm (an envelope as a box or cylinder);
    - an explicit box or cylinder.
  - **The check.** The requirement query `keepout {keepout, body?}` reports the overlap volume (exact kernel `intersect`, as `interference` today) and the clearance (display-mesh distance, its chord tolerance stated).
- **The boundary.** If an exact B-rep clearance or STEP assembly structure turns out to be necessary, stop and ask (kernel lane).
- **Acceptance**
  - Fixtures: a STEP block and an STL bracket as references.
  - Their datums equal the faces' planes and axes to 1e-9.
  - Locked operations are refused, typed.
  - A keep-out overlap volume against a closed form (box ∩ box), and the clearance against a closed form within the stated chord tolerance.
  - The reference is not in mass or export.
  - Save and open keep it, with its signatures verified.
  - A flow step: open a part, add a STEP reference, add a datum from its face, sketch on it, and see a keep-out violation reported.

- **Added on acceptance (coordinator, 2026-10-20):**
  - A keep-out verdict decided on mesh clearance states the chord tolerance.
  - A clearance within that tolerance of the limit comes back **undecided**, not a pass.

### A6.4 — images and drawings give drafts only; their dimensions confirmed by the user
- **Scope**
  - **Drafts.** A feature built from an image (the existing image tools) or from a drawing is marked `draft: {from, dims: [{name, value, basis: scaled | from-drawing, confirmed?}]}`.
  - **A DXF reader of our own** (LINE, ARC, CIRCLE, LWPOLYLINE, the units header) makes a sketch draft.
  - **Raster and PDF drawings** go through the image path: a PDF that is a file the user gives is read locally, and nothing is downloaded.
  - **Unconfirmed dimensions** are listed:
    - in the panel, each with a value and **Confirm**: confirming one re-drives the feature parameter;
    - by `check_spec` as unknown, "from an image, not confirmed";
    - by an export, which warns "draft: N dimensions unconfirmed".
  - **The prompt.** It says to ask for or confirm the key dimensions, within A6.2's batches.
- **Acceptance**
  - DXF fixtures written by our own writer and by hand give the expected sketch geometry and units. Malformed or unsupported entities are refused, typed.
  - An image fixture gives a draft with its scaled dims unconfirmed.
  - Confirming one sets it and rebuilds the feature to the value (closed form).
  - `check_spec` lists the unconfirmed dims as unknowns.
  - Exports warn.
  - A flow step: a drawing opened as a draft, its dimensions confirmed in the panel.

### A6.5 — standards data with provenance
- **Scope**
  - **One provenance format for standards-derived tables**, RD3's source record per value or per row: `{page, read, label}`, `{derived}` or `{estimate}`, plus a **licence** on each source. A GPL or unknown licence is refused for a table.
  - **The tables migrate to it.**
    - Fasteners: per-row source records in place of the one `CATALOGUE` list. The values are unchanged and their checks stay; values the old list cannot source per row are flagged as estimates.
    - The drawing tolerance suggestions are already estimate-flagged and keep their format.
  - **A lookup tool.** `standards_lookup {table, key}` returns the value with its source.
  - **Prompts and tool descriptions name standards only by number.**
    - A test lists every standard named in the system prompts and tool descriptions, and checks each against an allowlist of names.
    - It also checks that no description carries a sentence of more than a few words in quotes attributed to a standard.
  - **Legal review before release** is the owner's step, recorded rather than performed.
- **Acceptance**
  - Every table value carries a source with a licence.
  - A table with a GPL or unknown licence is refused.
  - The fastener values are identical before and after the migration.
  - The allowlist test.
  - The lookup tool returns the record.

**Not in A6:**
- Live runs: an agent actually answering the questions. That needs the owner, as A7's single-versus-multi comparison will.
- Process checks for CNC or sheet metal (the kernel lane).
- A STEP assembly structure, and an exact B-rep clearance (the kernel lane, if needed).
- The legal review (the owner).

## O24 — A6.1: the brief template, process and material required (2026-10-20)

- **The brief** (`src/chat/brief.ts`) is kept in the document as `brief` (version 1, in `STUDIO_DOC_FIELDS`, carried over like the requirements).
  - Each field is `{value, basis: stated | assumed | ambiguous, source?, why?, confirmed?}`.
  - The fields: purpose, process, material (all three required), quantity, envelope `{x, y, z}` mm, interfaces (a list), loads, finish and notes.
- **The rules**, enforced by the tool, all or nothing, with typed refusals:
  - **stated needs the user's words** in `source` (`NO_SOURCE`);
  - a field the user stated is **never replaced or cleared by an assumption** (`STATED_KEPT`, naming their words); their own new words do replace it;
  - **only the user confirms** (`CONFIRM_IS_THE_USERS`), in the studio;
  - a value that does not fit is refused (`BAD_FIELD`): a process outside the list, a fractional quantity, an envelope ≤ 0, an empty list, an unknown field.
- **Gaps** (`get_brief`):
  - a required field missing;
  - any field assumed or ambiguous, each with the question that would settle it.
  - These are what A6.2's questions may cite.
  - `complete` means purpose, process and material are all stated.
- **The process.** The five with rules (fdm, sla, sls, mjf, injection), plus `cnc-milling`, `cnc-turning` and `sheet-metal`.
  - The last three are **recorded as intent, not checked**, and `get_brief` says so: their checks are the kernel lane's R12 and CNC steps.
  - A **stated** process with rules becomes `doc.process`, and a printer of another process is cleared, as the studio's picker does.
  - An assumed process is not applied until the user states or confirms it.
- **The material.**
  - A **stated library material** is the material of every body without its own, through `materialIdOf`. Mass, analysis, observe, link inertia and the studio's body panel all read it, so a mass is no longer "assumed" there. A body's own material still wins.
  - A name not in the library is kept as written. Its density is unknown, so it is not applied, its mass stays assumed, and the tool says so.
  - An assumed material is not applied.
- **Where.**
  - Tools `set_brief {fields}` (alters, batchable in `apply_ops`) and `get_brief` (read, with an output schema). v2: `requirements.brief` and `requirements.gaps`. The script: `brief({…})`.
  - The system prompt says to start from the brief: stated with the user's words, the agent's choices assumed with why.
  - The studio: a **Brief** section in the Browser above the requirements. Each field shows with its basis, a ✓ or ?, the gaps are counted ("N to settle · … missing"), and **Confirm** marks an assumed or ambiguous field stated by the user, with when. Editing values is A6.2's Specify panel.
- **Evidence**: `test/brief.test.ts` (5 tests).
  - **The ten fixtures** in `conformance/a6/briefs` are hand-written, so their expectations are not produced by the code: complete; process missing; material missing; both missing; assumed process; a non-library material; sheet metal as intent; stated kept; stated without words; confirm is the user's.
    - They are run through the tool, checking gaps, completeness, the part's process and the applied flags. Each refusal is typed, and leaves the state the very same object.
  - **Assumption against stated**: assumed, ambiguous and null over a stated field are refused, naming the words; the user's own new words replace it; all or nothing; the bad values are refused.
  - **The studio's confirm**: an assumed process confirmed becomes stated with who and when, and becomes `doc.process`. The gaps follow. `readBrief` keeps a saved brief and drops what does not fit.
  - **Mass**:
    - assumed before;
    - still assumed with an assumed steel or a stated non-library name;
    - not assumed with stated steel (7.85 g for a 10 mm cube);
    - a body's own aluminium still wins (2.7 g).
  - **The script's `brief()` and the v2 path** do what set_brief and get_brief do. The field registry test covers `brief`.
  - Browser flow 167/167, with a step "A6.1" before the last. The scripted agent sets the assumed-process fixture's brief through the real chat and tool servers; the Browser shows it with "1 to settle" and the part's process unset; the user's Confirm makes it stated "confirmed by user", the part's process fdm, and the brief complete.
  - Studio 536/536. Bench: every row within budget; the mass rows are unchanged.
- **Found by the flow**: the Browser's headers are upper-cased by CSS, so the step reads them case-insensitively.
- **Next**: A6.2, the clarifying policy. Its questions must cite a gap `get_brief` reports, or a hard requirement whose value is unknown.

## O25 — A6.2: the clarifying policy; a quote said to be the user's is checked against what they typed (2026-10-20)

- **The user's say** (the coordinator's gap, closed first since it is the same trust boundary).
  - The studio sends **what the user typed this conversation** (`turns`) with each turn. These are their own messages as typed, without the selection or attachment notes, reset by New conversation. The Specify panel's answers are messages too, so they are in it.
  - The path: the chat server checks the turns (at most 500, each at most 20 000 characters) and puts them in the turn's state file. The MCP server puts them in `ChatState.turns`. The agent never writes them.
  - **A stated quote must be verbatim in one of the user's messages**, with whitespace runs normalised to one space and nothing else (`saidIn`); a quote across two messages is not one quote. Otherwise it is refused, typed **`SOURCE_NOT_SAID`**.
  - This applies to the brief's stated fields and to stated requirements (basis stated, or none).
  - **Where there is no conversation** (cad-cli, `cad-mcp --doc`, a plain script, `dispatchTool` without turns), a stated field or requirement is kept as **stated but unverified** (`said: 'unverified'`). The Browser marks it ✓? with "unverified: no conversation to check the quote against", `get_brief` lists it, and the user can Confirm it.
  - **Only the user confirms** — in the requirements too now: `confirmed` or `said` given by the agent is refused (`CONFIRM_IS_THE_USERS`, or `BAD_FIELD` in the brief).
  - **A requirement the user stated (verified) or confirmed is not replaced** by an assumed one, **nor dropped** by `replace: true` (`STATED_KEPT`), as the brief's fields are not.
- **The questions** (`src/chat/questions.ts`, tool `ask_user`; v2 `requirements.ask`). The tool holds the policy, not just the prompt:
  - at most **5 questions a batch** (`TOO_MANY`), at most **2 batches a brief** (`BATCHES_USED`), one open at a time (`OPEN_BATCH`). The log is in the document (`questions`, version 1), so it holds across turns and sessions;
  - each question names what it **blocks**: `{field}`, a required brief field that `get_brief` reports as a gap, or `{requirement}`, a hard requirement whose value was assumed or ambiguous and not confirmed. Anything else is refused as **`NOT_BLOCKING`**, with what may be asked now, and is to be made an assumption: a stated field, an optional field, a soft requirement, a stated one, an unknown one;
  - `BAD_QUESTION` covers the rest: two questions on one gap, a choice outside 2–8 options, a process option that is not a process, a requirement's value asked as anything but a number;
  - the prompt: ask only what blocks; assume everything else with why, and say so; nothing waits on the answers. The image line now asks for a key dimension within the batches and builds at an assumed size meanwhile.
- **The Specify panel** (`src/ui/SpecifyPanel.tsx`, in the Browser above the brief). It is our own layout, following the reference's required / worth-a-check / accept-all pattern only:
  - "N to answer · M to check";
  - the open questions with a choice, number or text input; **Send answers** (a blank one is skipped) and **Skip**;
  - the assumptions worth a check: the brief's assumed or ambiguous fields and the unconfirmed assumed requirements, each with its why. Each is editable in its own row: the brief's Confirm and the requirement's value.
  - **Accept N as they are**;
  - "Nothing is blocked: the agent goes on with its assumptions."
- **Answers** (`answerBatch`):
  - each is written where it belongs as the user's: stated, with the answer as its source, `said: 'verified'` and `confirmed: {by: 'user', at}`. A requirement's value is set;
  - the batch is marked answered (or skipped) with the answers kept;
  - a value that does not fit is refused before anything is written;
  - the result is one message, "My answers to your questions (batch n): …", which the studio sends to the chat as the user's. ChatPanel takes an `outbox` and sends it once the chat is free.
  - **Accept all** confirms every listed assumption and sends "I accept your N assumptions as they are: …".
- **The listed tools' size**: `tools/list` had grown past A5.1's guard on what the contract adds (15 173 over 15 000).
  - A read tool now lists `readOnlyHint` and `openWorldHint` without `destructiveHint` and `idempotentHint`, which MCP defines as meaningful only when `readOnlyHint` is false. That gives 13 701.
  - The internal annotations, the frozen contract and the guard are unchanged.
- **Evidence**: `test/clarify.test.ts` (5 tests).
  - **The made-up quote**:
    - stated PETG is verified ("PETG please" against "PETG\nplease");
    - the agent's invented "switch it to PLA" is refused `SOURCE_NOT_SAID`, the state the very same object, PETG kept;
    - case is not normalised;
    - a quote spanning two messages is refused;
    - once the user does say it, the change is theirs;
    - an empty conversation verifies nothing.
  - **No conversation**: stated but unverified, listed by `get_brief`; the agent cannot mark it verified. The MCP state file carries the turns into the tools' state, and absent turns stay absent.
  - **Requirements**:
    - a stated source must be said;
    - an assumed one needs no quote;
    - an agent-supplied `confirmed` is refused;
    - the user's R1 is not replaced by an assumed R1, nor dropped by `replace: true`;
    - an assumed R2 may be replaced;
    - without a conversation, it is unverified.
  - **The eight question fixtures** in `conformance/a6/questions` are hand-written:
    - two batches answered, then a third refused;
    - too many;
    - not blocking: a stated field (the coordinator's test), an optional field, a soft requirement, a hard stated one, an unknown one;
    - an open batch;
    - all skipped;
    - malformed questions.
    - Each is run through the tool, checking the batch states, and the answered fields and requirements as the user's (stated, confirmed, verified, their words).
  - **The message's exact text**; a bad answer refused before anything is written; the answer then in the conversation (a later quote of it verified); accept-all confirming every assumption, then nothing left.
  - Browser flow 168/168, with a step "A6.2" before the last, run through the real chat and tool servers. The scripted agent:
    - writes the purpose quoting the user's message (verified) and an assumed finish;
    - asks process and material ("2 to answer · 1 to check").
  - The user answers fdm and petg in the Specify panel. The answers are stated, confirmed, verified; the part's process is fdm; the batch answered; the chat shows their message.
  - In a second turn, a question on the stated material is refused `NOT_BLOCKING`, and a requirement quoting "30 mm pipe" is kept verified, with one batch used.
  - Accept all confirms the finish and sends its message.
  - Studio 541/541. Bench: every row within budget. Lint and type-check clean.
- **Found by the flow, fixed before commit**:
  - (1) the Specify and Brief headers carried the requirements' `req-head` class, so a step reading the first `.req-head` read theirs; they have their own class now;
  - (2) a step's title became a screenshot file name past the 255-character limit, so it is shorter.
- **Next**: A6.3, the locked reference body. A keep-out decided on mesh clearance states its chord tolerance; within it of the limit, it is undecided.

## O26 — A6.3: a STEP or mesh file as a locked reference body, with datums and keep-outs (2026-10-20)

- **No kernel-core change was needed.**
  - The kernel's STEP reader, mesh path, intersection Boolean and `faceGeometry` are used as they are.
  - No STEP assembly structure is read: a file's solids are one reference.
  - No exact B-rep clearance is computed: the clearance is the exact distance between the meshes, within their stated chord tolerance.
- **References live outside the part's tree** (`doc.references`, version 1, `src/chat/references.ts`): `{references, datums, keepouts}`.
  - Each reference is evaluated **on its own**, as a document of one `import` node (scaled to mm when the file says another unit; a file of several solids read solid by solid) or one facet `mesh` node. Its node id is the reference's (`ref1`), so its faces are `ref1.…`.
  - It is placed by `at` {position mm, rotation degrees, as the instances}.
  - Being no node, it is **locked by construction**: never a parent, and in no mass, facts, export (STEP, STL, 3MF), print check or drawing.
  - The tool layer also refuses, typed **`REFERENCE_LOCKED`**, any part or assembly change whose arguments name a reference's face, edge or body (inside `apply_ops` and `run_script` too, call by call). The agent cannot delete or move a reference: those are the user's, in the studio.
  - The studio draws references **ghosted** (after the part's bodies, never picked), with the keep-outs' solids.
- **Datums** are planes, axes and points.
  - **From a reference face**, they are fitted to the face's **exact surface** where the kernel knows it. The display face now keeps it: a planar face's plane from its own control points (cheap, no recognition), a cylinder's axis, point and radius from `faceGeometry` (already called for radii); `placeBody` moves it. The residual is 0 there.
  - Otherwise they are fitted to the face's vertices, with the residual kept: least squares, plane by the least eigenvector, cylinder axis from the normals' null direction, the circle by an algebraic fit refined by Gauss–Newton.
  - **The Float32 display mesh alone gives only ~1e-6**. The first test run showed it (an axis 7.7e-8 off, residual 6e-7), so the exact surface is used.
  - A face that is not the shape asked for is refused (`DATUM_FIT`, beyond 0.001 mm). A point comes from a vertex within 1 mm. A datum may also be given explicitly.
  - Datums are stored in the reference's coordinates and move with it. They are **verified on open**: each is re-fitted from its face and compared (1e-9 relative), and a mismatch is listed in `get_references.problems`.
- **Datums as subjects**:
  - a sketch's `plane: {"datum": id}` in add_features becomes that plane;
  - `measure {a: datum, b: face}` gives the distance and angle: parallel planes, an axis against a cylinder's axis (concentricity), a point;
  - the requirement query `datum_distance {datum, face}`.
  - **Not done: datums as mate targets.** Mates join parts, and a datum lives on the base part's reference. This is a follow-up through the mates' face tables, and needs no kernel change.
- **Keep-outs**:
  - The shapes: a box {frame, size} or a cylinder {frame, radius, height}, on a frame {origin, normal, xAxis}, or a reference's envelope grown by an offset (a box on its frame, or a cylinder about its Z). Each has the clearance it asks for.
  - Each is built as a sketch on its frame plus an extrusion, appended to a probe of the part.
  - **The verdict** for each body:
    - it **violates** when it enters: the overlap's volume by the kernel's intersection, which is exact;
    - otherwise d is the **exact distance between the meshes' triangles** (RM6's vertex–triangle and edge–edge distance), and δ is the two meshes' **chord tolerance**. δ is a curved face's sag at the studio's 8 segments a quarter, r(1 − cos π/32); 0 for planes and mesh regions (`DisplayFace.facet`); unbounded for a curved face of no known radius;
    - **clear** when d − δ ≥ c, **violated** when d + δ < c, **undecided** otherwise. That is the coordinator's rule, and δ is stated in every verdict.
  - Tools `check_keepouts` and the requirement query `keepout`. A check good to a chord now comes back unknown ("undecided: … within the meshes' chord tolerance") when the limit lies within it.
- **Tools** (v1; v2 `requirements.references`, `reference`, `datum`, `keepout`, `unref` and `keepouts`):
  - `get_references` and `check_keepouts` (read, with output schemas);
  - `add_reference`, `add_datum`, `add_keepout`;
  - `delete_reference_item` (datums and keep-outs only).
  - A prompt line: build on datums, keep out of keep-outs, never on a reference's faces.
  - The contract's overhead is now 14 804 of A5.1's 15 000 guard. The next additions will need room.
- **Studio**: the **Reference bodies** card in the Browser (its label is distinct from A1's References card), shown when there are references; its "Add reference" button is always there, accepting STEP, STL or OBJ (mm).
  - Each reference has its placement (an explicit, recorded edit), a datum from a face chosen by name (plane, axis or point), an envelope keep-out by offset, and Remove (the user's: with the datums from it and the keep-outs around it).
  - Datums show their fit ("exact", or the residual). Keep-outs show their verdict, clearance and ± chord, checked as the part changes (debounced, after evaluation).
- **Evidence**: `test/reference-bodies.test.ts` (5 tests).
  - **Datums from a STEP block** (the studio's 40 × 30 × 10 with a Ø8 hole), placed at (100, 0, 0) and turned 90° about Z. Against the closed forms to 1e-9:
    - the top plane (z 10, +Z);
    - the hole's axis at (85, 12) along ±Z, radius 4, residual 0;
    - a corner at (70, 40, 10).
    - Refused, typed: an axis from a flat face; a plane from the bore; a face not there; a vertex too far. Kept through a save and verified on open; a datum moved by 0.001 mm is listed.
  - **Locked**: fillet, hole, add_features, apply_ops and deleting the reference are each refused `REFERENCE_LOCKED`, the state the very same object. The nodes, mass and STEP export are unchanged by adding it, and `get_references` lists its faces.
  - **A mesh reference** (a 20 × 20 × 5 slab placed at z 20): chord 0; the top plane at z 25 exact; an axis from it refused; a malformed mesh refused.
  - **Keep-out closed forms**:
    - a box overlapping the 10 mm cube by 125 mm³ (exact) is violated;
    - a box 2 mm away is clear at exactly 2, chord 0;
    - a cylinder r 5 is 5 mm away within its chord 0.0241 mm, so 5 required is **undecided**. **The tolerance is checked to be an upper bound** on the cylinder's own triangles: every side triangle's centre lies within it of the true radius;
    - the verdict rule on its cases; refused frames, sizes and two shapes at once.
  - **The requirement query** `keepout`, `datum_distance` (20, exact), a sketch on the datum (z 30, normal −Z), a missing datum refused, and `measure` from a datum. The conformance case `conformance/a6/references/block-keepout` (case.json and block.step) is written from the closed forms.
  - **Found and fixed before commit**: the new test file first took the name of A1's `test/references.test.ts` and replaced it, and the suite lost its 6 tests silently (541 → 540 with 5 added). A run at the last commit in a temporary worktree, with the test names compared, found it. A1's file was restored from git, and the new one is `test/reference-bodies.test.ts`; all 546 pass with nothing missing.
  - Browser flow 169/169, with a step "A6.3" before the last:
    - the case's 10 mm cube opened; the case's block.step added through "Add reference" and placed at z 30;
    - it is not a node or body of the part ("1 body");
    - a datum from its downward face, which reads "fit exact";
    - the envelope +2 keep-out reads "clear, 18 mm" as the case says;
    - the part saved 35 tall and opened again reads "violated".
  - Studio 546/546.
  - Bench: every row within budget. The planar-mesh mass row read ~70 ms against 51 ms earlier; an A/B with the new branch disabled gave the same, so it is the machine's load from the other sessions.
- **Also found by the flow**: the card's label first collided with A1's References card (`aria-label`), which broke step 96. Its inputs overflowed the Browser's width, and its layout now wraps.
- **Next**: A6.4, drafts from images and drawings.

## O27 — before A6.4: room in the tool contract; PERF3 C16 logged as a known flaky timing check (2026-10-20)

- **The contract's overhead**, A5.1's guard on what `tools/list` adds over the plain tools (annotations, titles, output schemas): **14 804 → 13 470** of 15 000, measured on the same head (f0bedadb1).
  - Before: 101 985 against 87 181 plain. After: 100 651 against 87 181. The guard is unchanged.
  - The trim follows MCP's own defaults, as O25 did. A tool that is not read-only lists `readOnlyHint: false` and `openWorldHint: false`, both always said. It lists `destructiveHint` only when false (the default is true) and `idempotentHint` only when true (the default is false). The internal annotations, the frozen contract and its breaking-change check keep every hint.
  - The MCP-server test's requirement that every listed tool states `readOnlyHint` holds. The first cut, which omitted it at its default, failed that test, so it is said explicitly.
  - Room left: 1 530. The other options were held back:
    - merging the A6.3 reference tools into one tool with actions would lose their output schemas;
    - shortening descriptions does not count against this guard, since descriptions are in the plain size.
- **PERF3 C16** (`test/cageEdit.test.ts`, the kernel lane's file; threshold unchanged) failed once, in the full studio suite on the merged head f0bedadb1.
  - It asserts that the slowest warm validation step is below half of the cold one.
  - It passed alone 3 of 3, the suite rerun was clean, and it did not reproduce in 8 runs alongside the bench.
  - The failing run's numbers were not captured: the run's output was filtered to test names.
  - Measured since, with a scratch copy that prints them: warm 0.25–0.28 ms against cold 9.3–12.2 ms, a ratio of 0.022–0.028 against the 0.5 limit, with the bench running alongside or not.
  - `warm` is the largest single step, a sub-millisecond measurement, so one GC pause or preemption of about 5 ms during the full suite's load fails it. Logged as a known flaky timing check in README §0's outer-lane follow-ups.
- **The checkpoint routine** keeps the coordinator's habit: the full suite's test names are compared with the last commit's run, so a test that disappears is found even when nothing fails.

## O28 — A6.4: images and drawings give drafts only; their dimensions confirmed by the user (2026-10-20)

- **Drafts** (`doc.drafts`, version 1, `src/chat/drafts.ts`): the features an image or a drawing made, by feature id, with the dimensions they were made at.
  - Each dimension records its value, its basis (`scaled` from an image, `from-drawing`), what it drives, and `confirmed: {by: 'user', at}` once confirmed.
  - A draft goes with its features: one whose features are deleted is no longer listed.
  - **Images**: `extrude_image_layer` records the silhouette's width, which scales its sketches about the image's corner, and the thickness, which is the extrusions' height. `inflate_image_layer` records the width and the depth, which scales the lofts' sections.
  - **Drawings**: `import_drawing` (or the Drafts list's "Add drawing") records the overall width and height, which scale the sketch about its corner, and each round hole's diameter, which scales that hole about its centre.
- **Confirming** (the studio's Drafts list, by Enter or Confirm; or the user's answer to a question about it):
  - at its value, it is confirmed as it is, and nothing moves;
  - **at another value, the features are re-driven**: sketches scaled, heights set, loft depths scaled;
  - the draft's other dimensions that the change moves follow it — a scale moves its holes and the other size — and are unconfirmed again;
  - a value bound to a parameter is refused (`BOUND`), as are a size of 0 or less (`BAD_VALUE`) and an unknown dimension (`NO_DRAFT`).
  - **Only the user confirms**: the tools report drafts (`get_drafts`) and never confirm one.
- **Where unconfirmed dimensions show**:
  - in `check_spec`'s unknowns (`draft:F1.width`, with what it is and its basis);
  - in `get_drafts` (with a note on what to do);
  - in every export: STEP writes it in a toast, and the STL and 3MF toasts say "This part is a draft: N dimensions … not confirmed (…)".
  - **A6.2's questions** may ask about one: `blocks {dimension: key}`, asked as a number. The answer confirms it and re-drives the features. A confirmed dimension blocks nothing.
- **Our own DXF reader** (`src/sketch/dxfRead.ts`):
  - It reads LINE, ARC, CIRCLE, LWPOLYLINE with bulges as arcs, and POLYLINE/VERTEX, which AC1009 writes, ours included. `$INSUNITS` is scaled to mm (inches, feet, cm, m; none declared is read as mm, said so).
  - The edges are chained end to end into closed loops (walked backwards where needed, a reversed arc turning the other way) within 1e-6 of the drawing's size.
  - A loop of arcs on one centre and radius is a circle, which is how a polyline of bulges writes one.
  - The largest loop and those beside it are regions; a loop inside one is a hole.
  - Text, dimensions, hatches and points are annotation: left out and listed.
  - Refused, typed: `DXF_UNSUPPORTED` (splines, ellipses, blocks, 3D, off the XY plane), `DXF_OPEN` (where the gap is), `DXF_NESTED` (an island in a hole), `DXF_EMPTY` and `DXF_MALFORMED`.
  - The result is a `loop` sketch with its regions and holes, on the XY plane, on a datum (`plane: {datum}`, A6.3) or on a given plane.
- **Not in A6.4**:
  - **PDF drawings**: reading a PDF needs a PDF renderer (a new dependency), and the image path takes raster files only. A drawing as a PNG or JPEG goes through the image path, whose result is a draft as above.
  - Dimension *text* in a DXF is left out, not used. The sizes come from the geometry, and the user confirms them.
- **The tool contract**: `get_drafts` (read, with an output schema) and `import_drawing` (alters, batchable, refused on a reference's names like any part change). v2: `requirements.drafts` and `requirements.drawing`. The overhead is 13 806 of 15 000.
- **Evidence**: `test/drafts.test.ts` (5 tests). Its name was checked free first.
  - **Our writer's files read back**, AC1015 (LWPOLYLINE with bulges) and AC1009 (POLYLINE/VERTEX), both written by the R11b writer from a 60 × 40 plate with two Ø8 holes:
    - one region and two holes, radius 4 to 1e-9;
    - extruded 5, its volume (60·40 − 2π·16)·5 to 1e-6;
    - dimensions width 60, height 40, d1 8, d2 8.
  - **A hand-written file in inches** (LINE, an ARC end, a CIRCLE, a TEXT and a DIMENSION):
    - to mm ×25.4;
    - the TEXT and DIMENSION left out and listed;
    - area (3·2 + π/2 − π/16) in², volume to 1e-6;
    - width 101.6, height 50.8, d1 12.7.
  - **Refusals**: spline, gap (located at (0, 10) mm), nested, empty, malformed, 3D, each typed with the state unchanged.
  - **Re-driven**:
    - confirmed as it is, nothing moves;
    - the width at 120 scales the plate ×2: the volume ×4 to 1e-6, the height becomes 80 and the holes 16, each unconfirmed again;
    - one hole at 10 changes only that loop: volume (120·80 − 25π − 64π)·5;
    - a value ≤ 0 and an unknown key are refused.
  - **An image draft** (a traced square):
    - width and thickness recorded;
    - the export warning's text;
    - `check_spec`'s unknowns `draft:F1.width` and `draft:F1.thickness`;
    - a question about the width asked as text is refused; asked as a number it is accepted, and answered 40 it re-drives the relief: volume ×4 against the traced area (the trace simplifies the square's corners, so the closed form is the ratio);
    - the thickness at 6 gives ×2 again;
    - then no warning, and a confirmed dimension blocks nothing.
  - The fixtures in `conformance/a6/drawings`: our writer's two files, the hand-written one, and six refusals.
  - Browser flow 171/171, with a step "A6.4" before the last:
    - the inches file added through "Add drawing": "3 to confirm", width 101.6;
    - the width confirmed as it is;
    - the hole entered as 15, which re-drives it (radius 7.5) and confirms it: "1 to confirm";
    - extruded and opened, then Export STL, whose toast says "This part is a draft: 1 dimension".
  - Studio 554/554. The test names were compared with the A6.3 run, and none is missing. Bench: every row within budget. Lint and type-check clean.
- **Next**: A6.5, standards data with provenance.
- **Added on acceptance (coordinator, 2026-10-20):** a drawing that declares no `$INSUNITS` is read as mm, and that is now an **assumption shown beside its dimensions**, not only in the import result.
  - It appears in `get_drafts.assumptions` ("F1: units assumed mm — the drawing declares none (were it inches, every size would be 25.4 times this)"), as a `check_spec` unknown `draft:F1.units`, and as a ⚠ line in the Drafts list.
  - It is listed while any of the drawing's dimensions is unconfirmed: confirming them is the user's acceptance of the sizes.
  - A declared unit is no assumption.
  - Test: the inches fixture with its `$INSUNITS` removed reads as 4 (not 101.6), the assumption listed in both places, then gone once all three are confirmed. Drafts tests 6/6.

## O29 — A6.5: standards data with provenance (2026-10-20)

- **One provenance format** for the studio's standards-derived tables (`src/standards/provenance.ts`):
  - **sources**: `{id, kind: page | standard | derived | estimate | own, where, read?, licence, unverified?}`;
  - **tables**: `{id, title, unit, standards (by number only), rows, fieldSources, rowSources}`. Each value's source is its field's, or its row's where that differs.
  - **Licences a table may carry**:
    - `facts`: the standards' or a page's numbers as read; no table layout, prose or notes copied;
    - `own`: written for BaroCSS;
    - `CC0-1.0`, `CC-BY-4.0`, `public-domain` and `MIT`.
    - Anything else is refused, typed `LICENCE`: GPL and LGPL, share-alike, non-commercial, unknown. A value without a source is refused `NO_SOURCE`.
- **The tables registered**:
  - **The metric coarse fasteners**, M3–M12, migrated from the one `CATALOGUE` list to a source per field, with no value changed. A snapshot fixture holds the values (`conformance/a6/standards/fasteners-values.json`), and `src/app/fasteners.ts` is unchanged. The sources:
    - the nominal sizes (pitches, heads, nuts, washers; `FAST-NOM`): facts, the cross-check recorded without an address, so **unverified**;
    - the ISO 4762 and ISO 4017 lengths: pages with their addresses, read 2026-10-17;
    - **row by row, the ISO 4017 lengths not cross-checked**: the 2d … 10d rule, unverified;
    - ISO 10642: the nominal relations, not cross-checked, unverified;
    - ISO 273 clearances: as suppliers give them, no single source, unverified;
    - tap drills: derived, d − P.
  - **The drawing's general tolerances**: estimates, as they were.
  - **The material densities**: the material library's own sources, licensed CC0-1.0 by the file.
- **The lookup**: tool `standards_lookup {table?, row?, field?}` (read, with an output schema; v2 `library.standards`) gives a value or a row with each value's source. Without a table it lists the tables. `NO_TABLE` and `NO_ROW` are typed.
- **Prompts and tool descriptions name standards only by number.** A test lists every standard number in the system prompts (v1, v2), the tool descriptions (v1, v2) and the groups' texts. Each must be in `NAMED_STANDARDS`, the tables' standards and ISO 68-1. The test also refuses a quoted passage of six words or more within 80 characters of a standard's number. There is no RAG.
- **The legal review before release is the owner's step**, recorded in README §0 and not done here. The material library's own licence line also says so.
- **The tool contract**: 14 169 of 15 000 (`standards_lookup` with its output schema); 831 left.
- **Evidence**: `test/standards.test.ts` (5 tests). Its name was checked free first.
  - Every value of every table, 149 of them, has a source. Every source carries an allowed licence, and every page source has an address. The ISO 4017 lengths not cross-checked are said so, row by row.
  - A table under GPL-3.0, LGPL-2.1, CC-BY-SA-4.0, CC-BY-NC-4.0 or unknown is refused `LICENCE`, and an unsourced value `NO_SOURCE`.
  - The fastener values equal the snapshot, and the table holds them as they are.
  - The lookup: M6's tap drill 5 with its source (derived), M8's row with its page and its unverified relations, the tables listed, refusals typed.
  - The allowlist: the standards named are ISO 4017, 4762, 10642, 4032, 7089 and 68-1, and there is no quote near one.
  - Browser flow 173/173, with a step "A6.5" before the last: `standards_lookup` through the real chat and tool servers. Studio 561/561. The test names were compared with the last run, and none is missing. Lint and type-check clean.
- **A6 is done**: A6.1–A6.5 (O24–O29).

## O30 — A7 S0: multi-agent v1, the deterministic core — scope, acceptance, exposure; the live comparison pending (2026-10-20)

Assigned by the coordinator after A6. Build the parts that need no model now, and drive them with scripted roles and seeded defects. Anything that needs a live model waits for the owner, with its protocol written here.

**What is already there:** op lists (`apply_ops`, all or nothing, op ids, dry runs; A4), proposals with risk and rebasing (D41), `modelHash` (a 32-bit FNV, for staleness), interference and clearance, keep-outs (A6.3), printability rules (AM), `check_spec` (A3), references verified after edits.

### A7.1 — patches against a base revision
- **A revision** (`revisionOf(doc)`) is a 64-bit FNV-1a over the canonical JSON (sorted keys) of what a patch may change or depend on: nodes, parameters, bodies' looks, requirements, brief, references (datums, keep-outs), process. `modelHash` is too weak to name a base.
- **A patch** is `{id, by: role, base: revision, ops: Op[] (A4's ops), rationale}`.
- A patch whose base is not the current revision is refused, typed **`STALE_BASE`**, naming the current revision.
- **Rebasing is explicit**: `rebase(patch, revision)` makes a new patch on the given revision, its trace naming the old base. Rebasing is never automatic.

### A7.2 — the deterministic Integrator: serial gates, typed verdicts, a trace per patch
- Patches go one at a time. Each is dry-run on its base: A4's `apply_ops` on a copy of the state, nothing committed.
- **The gates, in order**, each giving `{gate, verdict: pass | fail | undecided | skipped, findings: [{code, message, entities?}]}`. The first fail stops the rest, which are marked skipped "not reached".
  1. **validity**: every op applied; the part evaluates; at least one solid; no reference broken.
  2. **interference/clearance**: no two bodies of the part overlap that did not before (the kernel's intersection); every keep-out clear (A6.3; undecided within the chord tolerance).
  3. **interfaces**: the patch leaves the contracts alone — references, datums, keep-outs, the brief, the requirements and the process are the Requirements role's and the user's, not the Designer's (typed `CONTRACT_CHANGED`) — and every hard interface requirement (`keepout`, `datum_distance`, `clearance`, `hole_alignment`) passes.
  4. **DFM**: the printability rules of the brief's (or the part's) process. Skipped, said so, when there is none, or for a process with no checks yet (CNC, sheet metal).
  5. **analysis**: every hard requirement passes (`check_spec`). An unknown hard requirement is undecided.
- **The decision**:
  - **applied**: every gate passes or is skipped, and the Verifier accepts;
  - **rejected**: a gate fails, or the Verifier rejects with findings;
  - **held**: a gate is undecided. Held patches are the user's to decide.
  - **stale**: the base is not current.
- **The trace** (one per patch): the patch, its base (and rebased-from), the dry run's diff, each gate's verdict and findings, the Verifier's review, the decision, the revision after. A logical sequence number replaces wall time, so a run is reproducible to the byte.

### A7.3 — roles as interfaces; the Verifier sees only artifacts and requirements
- **Roles** are TypeScript interfaces with no chat tools:
  - `RequirementsRole.brief(input) → { brief fields, requirements }`;
  - `DesignerRole.propose(view) → Patch | 'done'`;
  - `VerifierRole.review(view) → { accept, findings }`.
  - Each role has a `model` field (recorded; a stronger or different model for the Verifier is the protocol's choice).
- **The Verifier's view is built, not prompted**. `verifierView(doc, bodies)` gives only:
  - the artifacts: facts, mass properties, each body's box, keep-out results, the printability report, the `check_spec` report;
  - the requirements and the brief.
  - It does not give the ops, the Designer's rationale or any chat.
  - It is a frozen plain object of a fixed key set, checked in a test, so a role cannot see more than it is given.
- **The run** (`runTeam`): the Requirements role sets the brief and requirements, applied and traced. The Designer proposes patches, the Integrator gates them, and the Verifier reviews each that passes. It ends when the Designer says done or a patch budget is reached.
- It logs per patch and per run the tokens each role reports (0 for scripted roles), the patches tried and accepted, and the cost per accepted design.

### A7.4 — exposure: no new chat tools
- The contract has 831 characters of room, and the roles need no chat tools.
- **The internal API** is `src/team/`. **`cad-cli team <scenario.json>`** runs a scripted team from a scenario file (the brief, the roles' patches and reviews) and prints the traces as JSON.
- `tools/list` is unchanged, and so is the guard.

### Acceptance (deterministic: scripted roles, seeded-defect fixtures in `conformance/a7/scenarios/`)
- The scripted Requirements, Designer and Verifier roles replay fixtures.
- **The seeded defects**, one a fixture, each caught by the gate (or the Verifier) named, with its typed verdict:
  - an op that does not apply (validity);
  - two bodies made to overlap (interference);
  - a body into a keep-out (interference);
  - a patch that edits a keep-out or a requirement (`CONTRACT_CHANGED`, interfaces);
  - a wall under the FDM minimum (DFM);
  - a hard requirement broken (analysis);
  - a stale base (`STALE_BASE`), then the same patch rebased and applied;
  - a defect no gate sees but the Verifier's deterministic check does (its findings);
  - a near-limit keep-out (held).
- **A clean run**: a brief to an accepted design in N patches, every trace complete, the result byte-identical on a rerun.
- **The Verifier's isolation**: its view's keys exactly the fixed set; no op, rationale or chat text in it (searched for the Designer's rationale string).
- Tests and conformance fixtures; `cad-cli team` on a fixture (byte-identical output twice). No browser step is needed: no UI changes.

### Pending until the owner: the live comparison (exact protocol)
- **Arms**: (a) one agent (the studio's chat agent, today's tools); (b) the team — Requirements, Designer, a Verifier on a stronger model, the deterministic Integrator — through `runTeam` with live role adapters.
- **Tasks**: A5.5's briefs (block-hole, washer, phone-stand and the rest of `server/ab/briefs.ts`), plus two with references and keep-outs (A6.3) and one from a drawing (A6.4).
- **Budget**: the same token budget per task for both arms, the sum over every model call: the single agent's turns against the team's roles.
- **Metrics**: accepted designs (every hard requirement passing; the Verifier's acceptance for the team), the hard-requirement pass rate, iterations, tokens and cost per accepted design. On the seeded-defect set, the Verifier's precision and recall.
- **Runs**: 10 per task per arm, at fixed model versions, recorded.
- **Needs**: the owner's OK for live runs and their cost, and the A5.5 A/B question that is open with them. The cost is estimated from A5.5's per-turn figures.

**Not in A7**: A8 (parallel reviewers, the Architect, leases, ECRs), and any UI for the team.

## O31 — A7.1–A7.4: the multi-agent core, deterministic (2026-10-20)

- **Revisions and patches** (`src/team/team.ts`):
  - `revisionOf(doc)` is a 64-bit FNV-1a, two 32-bit lanes mixed, 16 hex digits. It is taken over the canonical JSON (keys sorted) of nodes, parameters, bodies' looks, requirements, brief, references, process, printer and drafts. Key order, history and views do not change it; a contract does.
  - A patch is `{id, by, base, ops, rationale?, rebasedFrom?}`.
  - **A stale base is refused** with decision `stale` and finding `STALE_BASE`, naming the current revision; the state is the very same object.
  - **`rebase(patch, revision)` is explicit**, keeps the first base in `rebasedFrom`, and is never automatic.
- **The Integrator** (`integrate`) takes one patch against the state it is given. It runs A4's `apply_ops` on a copy of the state, so nothing is committed unless applied, then the gates in order:
  1. **validity**: `OP_REFUSED`, `NOT_EVALUATED`, `NO_SOLID`, `REFERENCE_BROKEN`;
  2. **interference**: `OVERLAP` for a pair of bodies that did not overlap before (the kernel's intersection); `KEEPOUT_VIOLATED`, and `KEEPOUT_UNDECIDED` within the chord tolerance (A6.3);
  3. **interfaces**: `CONTRACT_CHANGED` when the patch changes references, the brief, the requirements, the process, the printer, the drafts or the questions; `INTERFACE_FAILED` for a hard `keepout`, `datum_distance`, `clearance` or `hole_alignment` requirement failing;
  4. **dfm**: `DFM_FAILED` for the brief's stated process's (else the part's) feasibility rules. Skipped with `NO_PROCESS`, or with `NOT_CHECKED` for CNC and sheet metal;
  5. **analysis**: `HARD_FAILED`, and `HARD_UNKNOWN` (undecided).
  - Each gate is `{gate, verdict: pass | fail | undecided | skipped, findings}`. After a fail, the rest are skipped `NOT_REACHED`.
  - **The decision**:
    - `rejected` on a fail;
    - `held` on an undecided gate, left to the user;
    - otherwise the Verifier reviews, and `applied` or `rejected` with its findings.
  - **The trace**: seq (a logical clock), the patch, its base and rebased-from, the dry run's diff, the gates, the Verifier (its model, verdict and findings), the decision, the revision after (only when applied), and the tokens per role.
- **Roles are interfaces**, each with its `model`, and no chat tools:
  - `RequirementsRole.brief`: its ops are applied and traced without the design gates, since the contracts are its own;
  - `DesignerRole.propose(DesignerView)`: the view is the revision, facts, brief, requirements, and the last decision with its findings;
  - `VerifierRole.review(VerifierView)`.
  - **The Verifier's view is built, not prompted**: `verifierView` gives exactly `revision, brief, requirements, facts, mass, boxes, keepouts, printability, checks`. It is deep-frozen and JSON-copied, and holds nothing of the patch.
- **The run** (`runTeam`) applies the brief, then takes the Designer's patches through the Integrator and the Verifier until done or the patch budget. It reports accepted and tried, the tokens per role, and the cost per accepted design (null when none).
- **Scripted roles** (`src/team/scripted.ts`) are fixtures:
  - the Designer's steps: a patch, `done`, `rebase` (the last patch on the current revision, explicitly), or a patch on a stale base;
  - the Verifier's rules: total mass, size along an axis, body count, read only from its view.
- **`cad-cli team scenario.json`** prints the run's traces (exit 0 when a patch is applied, 1 when none is, 2 on usage). There are no new chat tools and `tools/list` is unchanged.
- **Fixed on the way**:
  - `add_keepout` and `add_datum` are batchable, so the Requirements role's ops can set the contracts in one `apply_ops`.
  - The REFERENCE_LOCKED guard (O26) exempts the reference tools. Making `add_datum` batchable had put it under the guard, and its own reference arguments were refused. The A6.3 tests failed, and the test-name comparison showed which.
- **Evidence**: `test/team.test.ts` (4 tests). Its name was checked free first.
  - **The ten scenarios** in `conformance/a7/scenarios/` are hand-written with their expected decisions and stops, and **byte-identical on a rerun**:

    | scenario | what happens |
    |---|---|
    | clean-run | every gate passes, DFM on FDM, the Verifier accepts, done |
    | op-refused | validity `OP_REFUSED` |
    | overlap | interference `OVERLAP` |
    | keepout | interference `KEEPOUT_VIOLATED` |
    | contract | interfaces `CONTRACT_CHANGED` |
    | dfm-thin | a 0.3 mm shell for FDM: dfm `DFM_FAILED` |
    | analysis | `HARD_FAILED`, then the right block applied |
    | stale-rebase | `STALE_BASE`, then rebased and applied, its trace naming the old base |
    | verifier-only | no gate sees it; the Verifier's mass rule rejects 14.9 g, not applied; a lighter block accepted |
    | held | a round keep-out 5 mm away asking 5: `KEEPOUT_UNDECIDED`, held |

    Every trace is complete, a revision after only when applied, and every gate after a fail not reached.
  - **Patches**: stale refused with the state unchanged; the rebase keeps the first base; the revision changes with a contract but not with history or key order.
  - **The Verifier's isolation**: its view's keys exactly the fixed set; no op, `run_command`, rationale (a marker string searched for) or patch in it; frozen; the same part gives the same view.
  - **`cad-cli team`**: the clean run's output identical twice, its five gates in order; exit 1 on the contract scenario, 2 for a missing file.
  - Studio 565/565, with no test name missing against the last run. Lint and type-check clean. Browser flow 173/173: no UI changed, and it is run for the shared tool code.
- **Pending until the owner** (O30's protocol): the live comparison of one agent against the team at the same token budget, and the Verifier's precision and recall with a live model.
- **Added on acceptance (coordinator, 2026-10-20), each a test** (`test/team.test.ts`, 6 tests now):
  1. **A contract change is held, not rejected.** `CONTRACT_CHANGED` makes the interfaces gate undecided, and the decision **held** for the user.
     - The changed contract fields are listed in the finding (its entities) and in the trace (`contractChanges`, `contract_changes` in the CLI's output). A8's ECR comes later.
     - The `contract` scenario now expects held with `["requirements"]`.
  2. **The hash is for staleness, not integrity.** `revisionOf` names the base, and `integrate`'s `bases` (each state a role was given, by revision, as its canonical JSON; `runTeam` keeps it) confirms it before applying.
     - A matching hash over a different state, as a 64-bit collision would give, is refused `STALE_BASE` ("a hash collision"), and so is a base the run never gave a role.
     - The test forces the collision.
  3. **The REFERENCE_LOCKED exemption is narrow.** Datums and keep-outs may be added and deleted, in a batch too.
     - Refused for every role: deleting a reference, its face in a part op (hole), in an assembly op (mate) and in a batch (fillet); and a Designer's patch on its face, rejected at validity with the reference untouched.
     - No tool moves a reference.

## O32 — A8 S0: multi-agent v2 and v3 — scope and acceptance frozen per step (2026-10-20)

Assigned by the coordinator after A7. It builds on A7's core (`src/team/`: revisions, patches, the Integrator's gates, built views, scripted roles, `cad-cli team`).

**Limits on every step:**
- Deterministic and scripted, with seeded-defect fixtures in `conformance/a8/scenarios/`. No live model: the live numbers wait for the owner, as A7's comparison does (O30).
- No chat tools: A8 adds none, and `tools/list` is unchanged. Exposure is `src/team/` and `cad-cli team` (scenario kinds v2 and v3).
- A step needing a kernel-core change stops and goes to the coordinator.
- The test names are compared at every checkpoint.

### A8.1 — v2: parallel read-only DFM and Analysis reviewers; a Drafting agent on a frozen revision
- **Reviewers** (`DfmReviewer`, `AnalysisReviewer`) review a patch's result **in parallel** with the Verifier.
  - Each is given a **built, frozen view** of a fixed key set, as the Verifier's (A7.3). The DFM view holds the printability report, the process, the facts and the boxes; the Analysis view holds the check report, the requirements, the mass and the keep-out results.
  - They are **structurally read-only**: a view holds no state, no evaluate and no dispatcher, so a reviewer cannot apply anything.
  - Each returns `{accept, findings: [{code, message, entities?}]}`, typed.
  - The Integrator joins them: any rejection rejects the patch, with every reviewer's findings in the trace, ordered by role name so the trace is deterministic even though the reviews run in parallel.
- **The Drafting agent** works on a **frozen revision**. Its patch holds only drawing ops (`auto_dimension`, `fix_drawing`, `set_drawing`, `accept_tolerances`; R14). Anything else is refused, typed `NOT_A_DRAWING_OP`.
  - It is made against the model's revision. If the model moved since, the patch is refused `STALE_BASE`, as in A7.1, with the same canonical confirmation.
  - Applied, its drawing is checked by `drawing_issues`: errors reject it (`DRAWING_ISSUES`); warnings are listed.
- **Acceptance (fixtures)**:
  - a DFM defect the gates allow (a feasible but not recommended overhang under the process) that only the DFM reviewer flags;
  - an analysis concern no hard requirement covers (a soft requirement failing) that only the Analysis reviewer flags;
  - both reviewers flagging one patch, their findings in role order;
  - a reviewer's view keys checked, frozen, with nothing of the patch in it;
  - the drafting patch applied on the frozen revision, its drawing issue-free;
  - a drafting patch refused after the model moved; a non-drawing op refused.

### A8.2 — v3: the Architect's `interfaces` section; Part agents against frozen contracts, with leases
- **Interfaces** (`doc.interfaces`, version 1, the Architect's) is the assembly's contract. It holds:
  - datums (A6.3's, by id);
  - hole patterns `{id, positions (mm, the assembly's frame), diameter, parts: [ids]}`;
  - envelopes `{id, part, box}`;
  - keep-outs (A6.3's, by id);
  - budgets `{mass_g?, parts?}`.
  - It has its own revision (`interfacesRevision`).
- **Leases**: the Architect leases each part to one Part agent, `{part, holder, contract: interfacesRevision, until: seq}`.
  - A Part agent's patch is ops on its part (`part: id`), made against the contract revision of its lease.
  - Refused, typed:
    - `NO_LEASE`: no lease, or it is another agent's;
    - `LEASE_EXPIRED`: the run's logical clock past `until`;
    - `CONTRACT_MOVED`: the interfaces' revision is not the lease's (the agent re-reads and its lease is renewed by the Architect);
    - `OUT_OF_PART`: ops on another part or the assembly.
- **The part's gates** are A7's, run on the part, plus its contract:
  - its body within its envelope;
  - its holes on its pattern (A3's `hole_alignment`-style check against the pattern's positions);
  - its share of the mass budget.
- **Acceptance**:
  - a two-part assembly (a bracket and a board) with a hole pattern, envelopes and a mass budget;
  - one fixture each for: no lease, another agent's lease, an expired lease, a contract moved, a hole off its pattern, a body out of its envelope, over its mass budget;
  - a clean run: both parts accepted under their leases.

### A8.3 — v3: ECRs (engineering change requests), impact analysis, human approval
- **A change to the interfaces** (from the Architect or a Part agent) is an **ECR**, `{id, by, changes (the interfaces' diff), impact, status: open | approved | rejected}`, never an op.
- **The impact** is computed: the parts whose leases name the changed items, the requirements whose subjects they are, and the open patches made against the old revision.
- **Only the user approves.** `approveEcr(doc, id, {by: 'user', at})` applies it, bumps the interfaces' revision and expires the leases it affects. An agent cannot approve one (`APPROVAL_IS_THE_USERS`).
- A7's `CONTRACT_CHANGED` hold becomes an ECR when the change is to the interfaces.
- **Acceptance**:
  - an ECR moving a hole pattern: its impact lists both parts and the board's open patch;
  - approved by the user, the leases expire and the open patch is refused `CONTRACT_MOVED`;
  - rejected, nothing changes;
  - an agent's approval refused.

### A8.4 — v3: the Assembly integrator and a BOM agent
- **The Assembly integrator** takes accepted part revisions into the assembly serially, one part at a time against the assembly's revision. Its gates:
  - interference between parts (the kernel's intersection on the placed bodies);
  - the interfaces (the hole patterns aligned across the parts that share them; envelopes);
  - the mass budget over the whole.
  - It uses typed verdicts and a trace, as A7.2.
- **The BOM agent** is read-only. Its output is derived from the assembly: parts, quantities, materials (the brief's or the bodies'), library parts (fasteners, A6.5 sources), and mass, as a BOM artifact checked against the assembly (every instance counted once). Its view is built, as the reviewers' are.
- **Acceptance**:
  - two parts integrated, a third that interferes refused;
  - a pattern misaligned across parts refused;
  - the BOM's lines and totals against the assembly's closed form;
  - its sources for library parts.

### A8.5 — per-role metrics on seeded defects
- Each fixture labels its seeded defects by category (validity, interference, interfaces, DFM, analysis, drawing, verifier-only).
- **Precision and recall per role** — Verifier, DFM reviewer, Analysis reviewer, each gate — are computed over the fixture set from the scripted roles. They are reported by `cad-cli team --metrics`, and a test asserts them: 1.0 and 1.0 for the scripted roles on their own categories, with the confusion counts listed.
- The same report with live roles is pending with O30's protocol.

**Order**: A8.1 → A8.2 → A8.3 → A8.4 → A8.5, with a checkpoint after each.

### S0 addendum (2026-10-20, #2177; O39) — pinned approval baselines, result freshness, the export bundle
The owner's decision on #2177 (O39, verbatim there): approval baselines, result freshness and the export bundle go into A8.4 and A8.5; CAE (FEM) stays out of the roadmap, as a reference only. Frozen here before any code. The limits above still hold: deterministic, no chat tool, `tools/list` unchanged, exposure `src/team/` and `cad-cli`.

**The digest.** Integrity needs a cryptographic digest; A7's 64-bit FNV `revisionOf` stays a staleness key only.
- `digestOf(value)`: **SHA-256** of the canonical JSON (A7's `canonical`: keys sorted, `undefined` left out) as UTF-8, 64 hex digits.
- Synchronous, our own TypeScript (`src/team/digest.ts`): the ECR and baseline decisions are synchronous, and WebCrypto's digest is not. Checked against `node:crypto` in the tests, an oracle only.
- A part's revision digest is `digestOf` of its document's revision fields (the fields `canonicalOf` reads).

#### A8.4b — pinned approval baselines (`src/team/baseline.ts`, `doc.baselines`, version 1)
- **A baseline** is `{id, kind: 'bom', parent: id | null, state, content: {bom, interfaces}, pins, digest, decided?}`:
  - `pins`: `{interfaces: digestOf(interfaces), bom: digestOf(bom), parts: {partId: revision digest}}`, every part in the assembly;
  - `digest`: `digestOf` of the record without `digest` itself, the parent's `digest` included in it, so a parent's records cannot change unseen (a chain).
- **States**: `draft → review → approved | rejected`.
  - Every move takes the **minted user token** (A8.3's channel); a value saying `{by: 'user'}` is refused `APPROVAL_IS_THE_USERS`.
  - A move out of order is refused `BAD_TRANSITION`.
  - Approving is refused `STALE_BASELINE` when the document no longer matches the pins. The changed items are named.
  - It is also refused `STALE_RESULT` when an analysis result the baseline cites is not current (A8.5b), naming the result and its changed input.
- **Immutable once decided.** An approved or rejected record is never written again (`BASELINE_FROZEN`).
  - A later change makes a new draft with `parent` the old id.
  - The old record still verifies, as what was approved then.
- **An approved ECR** records `pin: {interfaces: digestOf(next), parts: {…}}`, the exact interfaces approved and the part revisions it was approved against.
- **Verification on read-back** (`verifyBaseline(doc, id)`):
  - **intact** means the content's digests match the pins, the record's digest matches, and the chain holds to the root. Any mismatch is `DIGEST_MISMATCH`, naming the field (`content.bom`, `state`, the parent …);
  - **current** means the document's interfaces and parts match the pins. Otherwise the parts or interfaces changed since are named.
  - An ECR is verified the same way (`verifyEcrPin`).
- **Acceptance**:
  - a BOM baseline drafted, sent to review and approved by the user; an agent's approval refused; out-of-order moves refused;
  - tampering detected on read-back: a BOM quantity, the state, the interfaces, a pin, the parent's content, each named;
  - after approval, a part changed: the baseline is intact but no longer current (the part named); a new baseline with the old as its parent approved; the old one still verifies;
  - an approved ECR's pin verifies, and a tampered `next` is caught.

#### A8.5b — result freshness (`src/team/freshness.ts`)
- **Every result is stamped** with the fingerprint of what it reads: a digest per input.
- **The inputs:**
  - `model`: the part's nodes, parameters and the bodies' names;
  - `material`: each body's material id and its basis;
  - `process`;
  - `interfaces`;
  - `references`: A6.3's set;
  - `requirement`: the one it checks;
  - `drawing`;
  - `faces`: the A1 signature of each face or edge the result names.
- **What each kind reads:**

  | kind | inputs |
  |---|---|
  | `requirement` (one check_spec verdict) | model; plus material, process, references or faces as its query reads them |
  | `check_spec` (the report) | model, material, process, references, requirements |
  | `keepout` | model, references |
  | `mass` / `inertia` | model, material |
  | `dfm` (printability) | model, process, material |
  | `bom` | every part's model and material; interfaces |
  | `drawing` | model, drawing |

- **A result is** `{kind, subject, run, status: 'ok' | 'failed' | 'unsupported' | 'non_converged', value, verdict?: 'pass' | 'fail' | 'unknown', fingerprint}`.
- **Freshness** (`freshnessOf(result, doc, bodies)`):
  - **current**: every input's digest matches.
  - **stale**: it names each changed input (`material`, `process` …). A stale result is never displayed as current (`displayOf` labels it stale and names the input) and never used for an approval (`STALE_RESULT`).
  - **unresolved**: a face or edge it names is gone, or cannot be told. The check uses A1's one matcher (`matchSignature`):
    - none alike, the face is gone;
    - several as near, the candidates are listed;
    - a clear match under another name is unresolved too, "now named X, not re-targeted": the result is never moved to another face.
    - A result on a mate or another stored reference takes A1's `verifyReferences` problems for it, so A1's ambiguous re-match is the result's state, with A1's candidates.
- **Late results** (`openRun`, `recordResult`, `currentOf`):
  - each result belongs to the run that made it;
  - a run opened later for the same kind and subject supersedes it;
  - a result arriving for a superseded run is kept, marked late, under its own run only. `currentOf` gives the latest run's result, or pending, never a late one.
- **Never a 0 or a pass:**
  - a result not `ok` has value `null` and no verdict;
  - `numericOf` gives `null`; `passes` gives false;
  - a summary counts it as unknown, by status.
  - Each producer maps its own failures: an evaluation that fails, a check `unknown`, the inertia's codes, printability's `unknown` rules, a drawing that cannot be built.
- **Acceptance**:
  - each kind stamped; a material change, a process change and a reference move each make the right results stale, naming the input, and leave the others current;
  - a stale result refused for a baseline's approval;
  - a late result kept under its run only;
  - failed, unsupported and non-converged results never read as 0 or as a pass;
  - a face lost to a topology change makes its result unresolved (gone; ambiguous with candidates; re-matched under another name, not re-targeted);
  - A1's `refs-ambiguous` carried into a result's state with A1's candidates.

#### A8.6 — the export bundle (`src/team/bundle.ts`, `cad-cli bundle write | verify`)
- **A directory** with `manifest.json` (version 1) and these files:
  - `document.json`: the source document;
  - `baseline.json`: the approved BOM baseline and its ancestors;
  - `materials.json`: each part's bodies, their material and its sources (the library's per-value sources) and basis (`body`, `brief` or `default`);
  - `results.json`: each analysis result with its fingerprint and its freshness at writing;
  - `ecrs.json`: the ECR history with the pins.
- **The manifest** lists:
  - the document's revision digest;
  - the baseline's id and digest;
  - every other file with its SHA-256 and size;
  - `missing`, `stale` and `complete`.
- **`complete` is true only when nothing is missing or stale.** These count as missing or stale:
  - no approved baseline;
  - a baseline not current;
  - a body whose material has no source (the default, assumed, or a name outside the library);
  - a stale or unresolved result;
  - a result not `ok`.
- **Verification in a fresh process** (`cad-cli bundle verify <dir>`, spawned in the test). Every pin is checked:
  - each file's digest;
  - the document's revision digest;
  - the baseline's chain and pins against the document;
  - each ECR's pin;
  - each result's freshness against the document.
  - It lists what is missing (files, the baseline), changed (digests) and stale. It exits 0 only when complete and intact, and never says complete when something is missing.
- **Acceptance**:
  - a complete bundle written from the clean A8 run, verified in a spawned `cad-cli`;
  - with a file deleted, a file edited, a result made stale and no approved baseline, each listed, with `complete` false.

#### The material check (#2177): engineering material apart from display looks
- **Checked against the code (O39):** nothing infers a material from a look.
  - A body's material is only `bodies[key].material` (a library id), or the brief's stated library material. Its density and sources are in the material library.
  - Colour (`bodies[key].color`, face colours) and PBR appearances (`render.appearances`, the `APPEARANCES` presets) are never read for a material.
  - A look's or body's name is not read for one either.
- **Kept that way by a test** (`test/material-look.test.ts`). A body named "Steel bracket", coloured as the Steel appearance, with the Steel PBR preset, and with a brief finish saying steel, still has no material, and each consumer says so:
  - mass and inertia: assumed;
  - the BOM: none;
  - printability: unknown;
  - the bundle: no source.
  - Setting a material leaves the looks unchanged.

**Order**: A8.4b → A8.5b → A8.6, with a checkpoint after each.

## O33 — A8.1: parallel read-only DFM and Analysis reviewers; a Drafting agent on a frozen revision (2026-10-20)

- **Reviewers** (`ReviewerRole {name: dfm | analysis, model, review(view)}`) review what a patch makes **in parallel** with the Verifier, once the gates have passed.
  - Each is given **its own built view**: the DFM view is `revision, process, printability, facts, boxes`; the Analysis view is `revision, requirements, checks, mass, keepouts`. The views are deep-frozen JSON copies holding nothing of the patch and nothing callable, so the reviewers are **structurally read-only**: no state, evaluate or dispatcher is in reach.
  - Each returns `{accept, findings: [{code, message, entities?}]}`.
  - **Any rejection rejects the patch.** The reviews are joined **by role name**, so the trace is the same whichever ends first. Their tokens are counted per role, and their findings reach the Designer's next view.
- **The Drafting agent** (`DrafterRole`, `integrateDrawing`) runs after the design ends, on the revision it ended at.
  - Its patch may hold drawing ops only (`auto_dimension`, `fix_drawing`, `set_drawing`, `accept_tolerances`). Anything else is refused `NOT_A_DRAWING_OP`, and the part is unchanged.
  - **Refused `STALE_BASE` if the model moved**: the hash, confirmed by the canonical JSON, as in A7.1.
  - Applied, its drawing's issue list is read: errors reject it (`DRAWING_ISSUES`), and warnings are listed (`DRAWING_WARNING`). The model's revision does not move, since the drawing is not in it.
  - Drafting patches count neither as tried nor as accepted designs.
- **Scripted**:
  - the DFM reviewer flags a printability rule at a status — a recommended rule the DFM gate lets pass;
  - the Analysis reviewer flags failing soft requirements, which the analysis gate does not hold;
  - the drafting agent replays drawing patches, with a stale base when the fixture says so.
- **Evidence**: `test/team-v2.test.ts` (2 tests). Its name was checked free first.
  - **Six scenarios** in `conformance/a8/scenarios/` (`step: A8.1`), byte-identical on a rerun:

    | scenario | what happens |
    |---|---|
    | dfm-reviewer-only | a 1.0 mm FDM shell is feasible (the gate's 0.8 mm) but under the recommended 1.2 mm: only the DFM reviewer flags it (`DFM_RECOMMENDED`); 1.5 mm is accepted |
    | analysis-reviewer-only | a soft "8 tall" that no gate checks: only the Analysis reviewer flags 10 mm (`SOFT_FAILING`); 8 mm is accepted |
    | both-reviewers | both flag one patch; findings in the order analysis, dfm |
    | drafting | Auto-dimension applied, the drawing made, the revision unmoved |
    | drafting-stale | `STALE_BASE` |
    | drafting-not-drawing | `NOT_A_DRAWING_OP` |

  - **Read-only, parallel**: each view's keys exactly its set, frozen, with no patch, rationale or function. With the DFM reviewer made slower, the Analysis one ends first, yet the trace is in role order.
  - `cad-cli team` runs the v2 scenarios unchanged (exit 1 on both-reviewers, where none is accepted).
  - Studio 570/570, with no test name missing against the last run. Lint and type-check clean. No UI changed.
- **Next**: A8.2, the Architect's interfaces and Part agents with leases.
- **Added on acceptance (coordinator, 2026-10-20), each a scenario:**
  - **A reviewer that cannot decide holds the patch, never passes it.** A review's verdict is `accept | reject | undecided | skipped`, as the gates'.
    - A rejection rejects. An undecided or a skipped review **holds** the patch for the user.
    - The scripted DFM reviewer skips, with `NO_PROCESS` or `NOT_CHECKED`, when there is no printability report to review (no process, or one with no checks yet).
    - The Analysis reviewer is undecided (`UNDECIDED`) on a soft requirement the checks could not measure.
    - Scenarios: `reviewer-skipped` (CNC milling) and `reviewer-undecided` (a soft mass target with no material stated), both held.
  - **"Keep, because…" against soft findings.** A Designer's patch may carry `keep: reason`. When the only rejecting findings are soft (`SOFT_CODES`: `DFM_RECOMMENDED`, `SOFT_FAILING`), the patch is **held** for the user with that reason (`keptBecause` / `kept_because`), not rejected again, so a soft target that cannot be met does not loop. Hard findings still reject.
    - Scenario `soft-keep`: the 1.0 mm shell is rejected; kept but 50 wide, it is rejected by the hard W; kept at 40, it is held with the reason.
  - `test/team-v2.test.ts` 2/2 over nine A8.1 scenarios. Studio 570/570, with no test name missing.

## O34 — A8.2: the Architect's interfaces; Part agents against frozen contracts, with leases (2026-10-20)

- **The interfaces** (`doc.interfaces`, version 1, `src/team/parts.ts`) are the assembly's contract, the Architect's:
  - datums and keep-outs (A6.3's, by id);
  - **hole patterns** `{id, positions (the assembly's frame), diameter, axis, parts}`;
  - **envelopes** `{id, part, min, max}`;
  - **budgets** `{massG?, parts: {part: grams}}`.
  - They have **their own revision** (`interfacesRevision`, A7.1's hash over them alone). The doc's revision covers them, and so do the instances.
  - `interfaces` is a contract field: a Designer's change to it is held (A7).
- **The Architect** (`ArchitectRole.plan`) sets the assembly up through ops (`add_part`, placed), then the interfaces and the leases.
- **Leases** are `{part, holder, contract: the interfaces' revision, until: the run's logical clock}`.
- **A Part agent's patch** is `{id, by, part, contract, ops}`: ops on its part only (the Integrator gives each op `part`). `integratePart` checks, in order, with typed findings, and after a fail the rest is "not reached":
  1. **lease**:
     - `NO_LEASE`: none, or another agent's;
     - `LEASE_EXPIRED`: past `until`, decision stale; the Architect renews it;
     - `CONTRACT_MOVED`: the lease's or the patch's contract is not the interfaces' revision, decision stale;
     - `OUT_OF_PART`: an op on another part, or an assembly op (add, place or delete a part, mates, joints).
  2. **validity**: `OP_REFUSED`, or `NOT_EVALUATED` (no solid).
  3. **contract**: the part's bodies where the assembly places them:
     - `OUT_OF_ENVELOPE`;
     - `HOLE_OFF_PATTERN`: no exact cylinder of the pattern's diameter (±0.05 mm) on its axis through each position (±0.05 mm). It uses the display faces' exact surfaces (A6.3) moved by `placeBody`, and names the positions missed;
     - `OVER_BUDGET`: the part's mass, its own materials or aluminium assumed, against its share.
  - Applied, the part's ops are committed. Otherwise the assembly is unchanged.
- **The run** (`runParts`): the Architect's plan, then the Part agents take turns, one patch a turn, until all are done or the rounds run out.
- **Scripted**: the Architect replays its setup, interfaces and leases. Part agents replay patches, on a stale contract or another part when the fixture says so.
- **Evidence**: `test/team-v3.test.ts` (2 tests). Its name was checked free first.
  - **Eight scenarios** in `conformance/a8/scenarios/` (step A8.2), byte-identical on a rerun, each refusal at its gate with the rest skipped:

    | scenario | what happens |
    |---|---|
    | parts-clean | a bracket and a board on one Ø4 pattern at (10, 10) and (50, 10), each in its envelope and budget: both applied |
    | parts-no-lease | `NO_LEASE` |
    | parts-expired | `LEASE_EXPIRED` |
    | parts-contract-moved | `CONTRACT_MOVED` |
    | parts-out-of-part | the board edited, a part added: `OUT_OF_PART` twice |
    | parts-hole-off | a hole 2 mm off: `HOLE_OFF_PATTERN` |
    | parts-envelope | 70 wide: `OUT_OF_ENVELOPE` |
    | parts-budget | 64.8 g over 30 g: `OVER_BUDGET` |

  - **The clean run**:
    - both parts' holes on H1 (the exact cylinders, placed); the pattern moved 2 mm is missed at both positions;
    - the board's placed box at z 20–22;
    - every lease naming the interfaces' revision.
  - Studio 572/572, with no test name missing against the last run. Lint and type-check clean.
- **Next**: A8.3, ECRs with impact analysis and the user's approval.

## O35 — A8.3: ECRs — impact analysis, the user's approval (2026-10-20)

- **A change to the interfaces is an ECR, never an op** (`src/team/ecr.ts`). An ECR is `{id, by, base (the interfaces' revision), next (the interfaces proposed), changes, impact, status: open | approved | rejected, decided?, reason?}`, kept in the document (`ecrs`, version 1).
- **The changes** are computed item by item: patterns and envelopes by id (added, removed or changed), budgets per part and in total, datums and keep-outs by id. Each change names the parts it touches; the total budget touches every part.
- **The impact** is computed, not declared:
  - the parts touched;
  - the requirements whose subject is a changed datum or keep-out (`keepout` and `datum_distance` queries);
  - the open patches on those parts made on the old contract;
  - the leases on them.
- **Only the user decides** (`decideEcr`): anyone else is refused `APPROVAL_IS_THE_USERS`. An agent may open an ECR.
  - **Approved**: the interfaces become its proposal, so their revision moves.
    - **A touched lease keeps the old contract** (`expiredBy` the ECR), so its holder's next patch is refused **`CONTRACT_MOVED`** until the Architect renews it (`renewLeases`).
    - An untouched lease moves to the new revision, its part unaffected.
  - **Rejected**: nothing changes.
  - Refused: deciding twice (`DECIDED`); approving an ECR opened on interfaces that have moved since (`STALE_ECR`: open it again); opening one that changes nothing (`NO_CHANGE`).
- A7's `CONTRACT_CHANGED` hold covers the interfaces too, since no op edits them. The ECR is the only way they change, and it comes from the Architect or a Part agent through the team API, decided by the user.
- **Evidence**: `test/team-ecr.test.ts` (2 tests). Its name was checked free first.
  - **The fixture** `conformance/a8/scenarios/ecr-move-pattern.json`: after parts-clean, H1 is moved 2 mm along X.
    - Its change and impact exactly as the fixture says: both parts, the board's open patch made on the old contract, both leases, no requirements.
    - Opening it changes nothing yet; an agent's approval is refused.
    - The user's approval moves the interfaces and leaves both leases on the old contract.
    - The open patch is then refused `CONTRACT_MOVED`.
    - Renewed on the new contract, the board's patch is rejected `HOLE_OFF_PATTERN`: the part must follow the moved pattern.
    - Deciding twice is refused.
  - **Rejected**: the interfaces and leases are unchanged.
  - **Two ECRs on one base**: the second is `STALE_ECR` once the first is approved. A total-budget ECR touches both parts.
  - **One part's envelope changed**: that lease is left behind, the other moved to the new revision.
  - **A keep-out removed**: the requirement that checks it is in the impact.
  - Studio 574/574, with no test name missing against the last run. Lint and type-check clean.
- **For A8.4** (coordinator): the mass budget shared by parts is checked per patch (each part's share, A8.2) **and on the whole assembly**, so parts under their shares cannot sum past the total unnoticed.
- **Next**: A8.4, the Assembly integrator and the BOM agent.
- **Added on acceptance (coordinator, 2026-10-20): "the user" is the channel, not a claim.**
  - `decideEcr` takes only a **minted user token** (`userToken(at)`), kept in a module-private `WeakSet`. The studio UI and the CLI scenario runner mint it, from its top-level user decisions, never from a role's output.
  - A role's output is data. `{by: "user"}`, a frozen look-alike, a JSON copy of a real token, or another role's name: each is refused `APPROVAL_IS_THE_USERS`.
  - Test: `test/team-ecr.test.ts`, 3/3.

## O36 — A8.4: the Assembly integrator and the BOM agent (2026-10-20)

- **The Assembly integrator's gate** (`checkAssembly`, `src/team/assembly.ts`) is a fourth gate after a part's own three (A8.2). It checks the whole assembly with the part as it would be:
  - **`PARTS_MEET`**: no two parts' placed bodies interpenetrate (RM6's exact mesh test, after a box reject widened by their chord);
  - **`PARTS_TOUCH`**: within the meshes' chord tolerance of touching is **undecided**, so the patch is held, never passed. Two parts face to face at distance 0 come back so;
  - **`PATTERN_MISALIGNED`**: every hole pattern is on every built part that shares it, so a part moved after its acceptance is caught;
  - **`OVER_TOTAL_BUDGET`**: the whole assembly within the total mass budget (the coordinator's point). Parts each under a share that is not fixed cannot sum past the total unnoticed.
  - A fail rejects, an undecided holds, and the assembly is unchanged unless applied. An earlier gate's fail leaves this one "not reached".
- **The BOM agent is read-only.**
  - `bomView` is a plain JSON view: each instance's id, name, material, mass, library origin and shape fingerprint, nothing callable.
  - `deriveBom` puts identical parts (the same shape and material) on one line, in first-seen order, and names a library part's source (`tslot-20@0.1.0/profile:2020`).
  - `checkBom` checks a BOM against the assembly: every instance on one line once, each line's quantity its parts, the total quantity and mass, a library line's source.
- **Evidence**:
  - **The v3 scenarios** (`test/team-v3.test.ts`, now ten):
    - `assembly-interfere`: a clip inside its own envelope, over the bracket's end, passes its contract and is refused `PARTS_MEET` at the assembly gate;
    - `assembly-total-budget`: shares 80 g and 20 g with a 70 g total. The bracket (64.8 g) is applied; the board (13 g, under its share) takes the whole to 77.8 g and is refused `OVER_TOTAL_BUDGET`.
  - **`test/team-assembly.test.ts`** (2 tests; its name was checked free first):
    - the clean assembly passes, its mass against the closed form (two aluminium plates less their holes; grams to 3 decimals);
    - the board moved 2 mm after acceptance gives `PATTERN_MISALIGNED`;
    - set face to face on the bracket, it gives `PARTS_TOUCH` (undecided);
    - the BOM of bracket and two boards: lines [bracket ×1, board ×2], checked clean;
    - seeded BOM defects, each refused: a part dropped, a quantity wrong, a part twice, a total off;
    - a library part's line names its source, and a BOM without it is refused.
  - Studio 577/577, with no test name missing against the last run. Lint and type-check clean.
- **Correction (coordinator)**: the merge 2adc9dc52 brought the kernel lane's **R12.3b** (corner reliefs, ea8c877ae), not R12.4 as the A8.4 checkpoint said. R12.4 has not started.
- **Next**: A8.5, per-role precision and recall on the seeded defects.

## O37 — A8.5: per-role precision and recall on the seeded defects; declared contact passes (2026-10-20)

- **Declared contact (coordinator)**: face-to-face contact is the normal state of an assembly.
  - Two parts touching, with no interpenetration and within their chord tolerance, **pass as `EXPECTED_CONTACT`**, named in the trace with what declares it, when a declared interface or mate puts them together: a hole pattern both share (its mating faces), or a mate between them.
  - Only undeclared touching is held, as `PARTS_TOUCH`. Interpenetration (`PARTS_MEET`) fails either way.
  - Declaration is checked at the level of the pair: the shared pattern or the mate, not the particular faces in contact.
  - Tests (`test/team-assembly.test.ts`):
    - the board set on the bracket passes ("as the hole pattern H1 puts them together");
    - a lid resting on the board with nothing declared is held;
    - with a coincident mate, it passes ("the mate m1").
- **Labels**: every scenario with decisions (29: A7's ten, A8's nineteen) labels each patch with the detector its seeded defect is for, or none (`expect.seeded`). A patch may carry two labels (both reviewers). The labels sit in the fixtures beside the expected decisions.
- **The metric** (`src/team/metrics.ts`):
  - a detector (each gate, the Verifier, each reviewer, a part's lease, contract and assembly gates) **flags** a patch when it fails or cannot decide it (undecided, or a review skipped);
  - it is **clear** when it passes;
  - it **did not run** when an earlier gate stopped the patch or it had nothing to check (a skipped gate). It is then not counted for that patch, except that a labelled defect that went past a detector which never ran is a **miss**.
  - Over every patch it ran on, it reports true and false positives and negatives, precision and recall, and where it missed and where it raised false alarms. The Requirements role's own patches are left out.
- **`cad-cli team --metrics <folders>`** runs every labelled scenario and prints the table.
- **The scripted roles' numbers**: every detector at **precision 1 and recall 1**. TP / FP / FN / TN:

  | detector | TP | FP | FN | TN |
  |---|---|---|---|---|
  | analysis | 2 | 0 | 0 | 17 |
  | assembly | 2 | 0 | 0 | 5 |
  | contract | 3 | 0 | 0 | 7 |
  | dfm | 1 | 0 | 0 | 23 |
  | interfaces | 1 | 0 | 0 | 24 |
  | interference | 3 | 0 | 0 | 24 |
  | lease | 5 | 0 | 0 | 10 |
  | reviewer-analysis | 3 | 0 | 0 | 6 |
  | reviewer-dfm | 5 | 0 | 0 | 4 |
  | validity | 4 | 0 | 0 | 38 |
  | verifier | 1 | 0 | 0 | 2 |

  - These say the scripted roles and gates do what their fixtures were written for. They are **not evidence of a live model's quality**: that report, with live roles, waits for the owner (O30's protocol).
- **The metric itself is checked** (`test/team-metrics.test.ts`, 3 tests; its name was checked free first):
  - a clean patch mislabelled as an interference is a miss: recall 0.75, the miss named;
  - a defect labelled for the analysis gate, which a validity fail never let it reach, is a miss "(not run)", and validity's flag a false alarm;
  - a Verifier rejecting everything raises false alarms (precision below 1);
  - the CLI prints the same table.
- Studio 581/581 (53 s), with no test name missing against the last run. Lint and type-check clean.
- **A8 is done**: A8.1–A8.5 (O33–O37). Pending the owner: the live comparison and live per-role metrics (O30).
- **Fixed (coordinator, 2026-10-20)**: the team scenarios sat at `conformance/a7/*.json` and `conformance/a8/*.json`.
  - The kernel's conformance runner (`packages/barocss-cad/test/conformance.test.mjs`, the kernel lane's file, unchanged) reads every `conformance/<step>/*.json` as a kernel case, so the integration merge failed 28 cases.
  - They are now in `conformance/a7/scenarios/` and `conformance/a8/scenarios/`, as A6's fixtures are in subfolders, and the studio tests and CLI paths follow.
  - Kernel conformance 145/145. From now on every checkpoint gives it beside the studio suite and the flow.

## O38 — MuJoCo 3.3.0 run: RM4's external check and RM5's acceptance closed (2026-10-20)

- **The owner's go-ahead**, relayed by the coordinator: "좋아 진행해줘", in reply to the coordinator's explanation that MuJoCo is test-only.
  - Its place: a venv at `~/.cache/barocss-mujoco`, outside the repo, not a product dependency, imported by no package, never shipped.
  - Its scope: exactly `mujoco==3.3.0` from PyPI. Nothing else in the repo or the system Python. RD3's PDFs and the live model runs still wait.
- **Installed** with O17's commands: `uv venv ~/.cache/barocss-mujoco --python 3.12 && VIRTUAL_ENV=~/.cache/barocss-mujoco uv pip install mujoco==3.3.0`.
  - Python 3.12.9; `mujoco.__version__` is 3.3.0.
  - **The wheel**: `mujoco-3.3.0-cp312-cp312-macosx_11_0_arm64.whl` (the installed `WHEEL` tag `cp312-cp312-macosx_11_0_arm64`), 6 493 393 bytes, **sha256 `2f435f34ea8c41711e68c635ada89c7347e9d53a330c2ff748723a96495d8710`**. That is the digest PyPI publishes for that file, read from its JSON metadata. uv keeps the wheel unpacked, so the cached archive's own hash could not be taken.
  - mujoco's own dependencies came with it, into the same venv: numpy 2.5.4, glfw 2.11.0, pyopengl 3.1.10, absl-py 2.5.1, etils 1.14.0, fsspec, typing-extensions and zipp.
- **Each oracle ran with `python -I`**, its files passed as arguments (`packages/barocss-cad/scripts/urdf-oracle.py` and `mjcf-oracle.py`). Its reading is committed as data beside each case (`conformance/rm/<case>/oracle.mujoco-3.3.0.json`), as ezdxf's are (O1).
- **RM4, the URDF oracle: passed.** Masses, centres, principal inertia and link frames at sampled values, against `expect.json`, tolerance 1e-6:
  - `urdf-2r`: 21 rows, worst 1.1e-16;
  - `urdf-gears`: 21 rows, worst 2.2e-16.
  - MuJoCo warned of unnamed geoms; URDF allows a visual or collision without a name.
  - **RM4's external check is closed.** `check_urdf` (ROS urdfdom, not on PyPI) stays a check for a ROS install.
- **RM5, the MJCF oracle on arm-6r: passed after two causes were found.** The tolerances are unchanged.
  - **First run: failed.** The bodies and frames matched (49 rows, worst 5.6e-16), but in both hangs nothing moved: qvel 0, the energy and the centre of mass unchanged.
    - **The cause:** the pose the mates solve to is an upright **gravity equilibrium**. MuJoCo's bias there (`qfrc_bias`) is 0 on every joint, so nothing could fall, and "the centre of mass below its start" could not hold. The export was not at fault.
    - **The fix, which strengthens the check:**
      - `expect.json` now holds **RD1's gravity torques** at both poses (at MJCF's 9.81), and the oracle compares MuJoCo's bias at rest with them: 2.2e-17 at the upright pose, 4.4e-14 at the second;
      - the hang starts from the second pose (`hang.from`), where gravity acts.
  - **Second run: failed.** The passive run lost 88 % of its energy in 5 s.
    - **The cause:** contacts. Folding under gravity, the links' collision hulls touch (6 contacts), and contact dissipates energy.
    - With contacts off, the drift was 3.8e-4. The remaining drift was RK4's error at 0.5 ms on a chain spinning at up to 47 rad/s (74 at 0.1 ms).
    - **The fix:**
      - the hang runs with contacts off, since it checks the exported inertia and gravity — a frictionless chain — not contact;
      - the passive run steps at 0.1 ms, which tightens the integration;
      - the 1e-4 bound stays.
  - **Third run: passed.**
    - 51 rows (masses, centres, principal inertia, frames at two poses, gravity torques at two poses), worst 4.4e-14 against 1e-6.
    - **Passive, 5 s at 0.1 ms**: energy drift 1.02e-6 (bound 1e-4), no warnings.
    - **Damped, 0.002 N·m·s/rad, 30 s at 0.5 ms**: the energy never rises (largest rise 5.3e-16, bound 1e-9); every |qvel| at 8.8e-13 rad/s at the end (bound 1e-3); the centre of mass from 0.100 m to −0.026 m.
  - **RM5 is accepted.**
- **Tests**: the committed readings are held to their criteria: `test/robot-urdf.test.ts` and `test/robot-mjcf.test.ts`, a test each. The frozen exports are the files the oracle loaded, and a change to them shows there until MuJoCo is run again.
- **Not closed by this run**: contact behaviour (self-collision as the arm folds is RM6's sweep). A collision-on hang would test the contact model, not the export.
- **A contacts-on run** is a separate question for RM7/RM8 or later. It is neither a pass nor a fail of RM5 (coordinator, on accepting O38).

## O39 — #2177: the owner's decision recorded; engineering material apart from display looks (2026-10-20)

- **The owner's decision**, relayed by the coordinator, on [#2177](https://github.com/barocss/barocss/issues/2177) ("research(toolchain): CAD–CAE–PLM 연결과 부품 리비전·해석 추적·변경 승인 계약", read with `gh issue view 2177`), verbatim: "#2177에서 세 가지(승인 기준선 고정, 결과 최신성 표시, 내보내기 묶음)는 A8.4·A8.5에 넣고, CAE(FEM)는 로드맵에 넣지 말고 참고만 해."
  - It means: pinned approval baselines, result freshness and the export bundle go into A8.4 and A8.5. CAE (FEM) is a reference only, not a roadmap item.
  - Frozen as the S0 addendum to O32: A8.4b, A8.5b and A8.6. The bundle is its own step, after A8.5b, as the coordinator allowed ("A8.5 or A8.6").
- **The material check** (#2177: engineering material must stay apart from display looks). Read against the code before any coding:
  - **Where a material comes from.** `materialIdOf` (`src/app/bodies.ts`) reads only:
    - the body's `material` field (a library id);
    - else the brief's material, when it is stated and in the library (`briefMaterial`).
  - **Who reads it.** Mass (`chat/analysis.ts`, `chat/observe.ts`), inertia (`robot/inertia.ts`), the BOM (`team/assembly.ts`), printability (`print/rules.ts`) and library checks (`library/libraries.ts`).
    - Each reads it through the material library (`library/builtin/materials.json`: densities, each value with its source).
  - **What no consumer reads for a material:**
    - a body's colour, or its face colours;
    - its PBR appearance: `render.appearances`, or the `APPEARANCES` presets (`engine/render.ts`), which only set colour, metallic, roughness and opacity;
    - a body's or look's name.
  - The 3MF export writes the material's label beside the display colour. Nothing reads that back.
  - **Nothing infers one, so nothing is refused. The test keeps it that way.**
  - **Noted, not changed:**
    - The appearance presets `steel` and `brass` share their ids with library materials. They are separate namespaces, and the test covers them.
      - **Follow-up** (coordinator, on accepting O39): give the appearance ids a namespace prefix, or add a test that the two id sets never cross. The code is left as it is now.
    - The fastener command sets `steel` as its bodies' own material (`app/fasteners.ts`). It is a command's choice, not inferred from a look, and the bundle reports it as the body's material with the library's sources (basis `body`).

## O40 — A8.4b: approval baselines pinned by content digest (2026-10-20)

- **The digest** (`src/team/digest.ts`).
  - `digestOf(value)` is the SHA-256 of the canonical JSON: A7's `canonical`, now exported, with keys sorted and `undefined` left out. It is our own synchronous TypeScript, written without a function created in its loop.
  - It is checked against `node:crypto` (an oracle only) on these inputs:
    - the padding boundaries (55, 56, 63, 64 and 119 bytes);
    - UTF-8 (Korean, an emoji);
    - 1 MiB of bytes.
  - A part's revision digest (`partDigest`) covers its document's revision fields, its placement and whether it is hidden. The base part's own features count as `base` when it has any.
- **Baselines** (`src/team/baseline.ts`, `doc.baselines`, version 1, in `STUDIO_DOC_FIELDS`).
  - **`draftBaseline(doc, bom, view, {parent?})`.** The BOM is checked against a built view first; a mismatch is refused `BOM_INVALID` with its problems. The record pins:
    - the BOM;
    - the interfaces (a copy of each is kept in the record);
    - every part's revision digest.
  - Its own digest covers the record and its parent's digest.
  - A `parent` must be decided. A draft cannot follow a draft (`BAD_TRANSITION`).
  - **`moveBaseline(doc, id, to, token)`.** The states run draft → review → approved | rejected, and only a minted user token moves one.
    - **Refused, typed:**
      - `APPROVAL_IS_THE_USERS`: a role, `{by: 'user'}`, a JSON copy of a token, or a frozen look-alike;
      - `BAD_TRANSITION`: out of order;
      - `BASELINE_FROZEN`: any move of an approved or rejected baseline;
      - `STALE_BASELINE`: approving a baseline the document has moved past, the changes named.
    - **Each move** is recorded with its time, and the record is re-sealed.
  - **`verifyBaseline(doc, id)`** gives `{intact, mismatches, current, changed}`.
    - **intact** walks the chain to the root. It checks each record's content against its pins (`content.bom`, `content.interfaces`), its own digest (`record`) and its parent's digest (`parent BLn`, or `parent BLn missing`).
    - **current** compares the interfaces and every part against the pins. Changes are named: `part p2`, `part p1 (gone)`, `part p3 (added)`, `interfaces`.
- **An approved ECR** records `pin: {interfaces: digestOf(next), parts, record}`:
  - `parts` are the part revisions it was approved against;
  - `record` is the ECR's own digest.
  - `verifyEcrPin` names `next` or `record`. A rejected ECR pins nothing.
- **Tests** (`test/team-baseline.test.ts`):
  - the digest against `node:crypto`;
  - draft, review, approve; an agent and forged tokens refused; out-of-order moves refused; frozen once approved or rejected; an invalid BOM refused.
  - **Tampering on read-back, each named:**
    - a BOM quantity: `content.bom` and `record`;
    - the state: `record`;
    - the interfaces: `content.interfaces` and `record`;
    - a pin: `record`;
    - the parent's content with its pins and digest rewritten to match: the child's `parent BL1`;
    - the parent removed: `parent BL1 missing`.
  - **A change after approval** (the board moved 4 mm):
    - BL1 stays intact but is no longer current, with `part p2` named;
    - a draft from before the change is refused `STALE_BASELINE`;
    - BL2 with parent BL1 is approved; BL1 still verifies, and its record is byte for byte what was approved.
  - An approved ECR's pin verifies; a tampered `next` or impact is caught.
- **Limits:**
  - **The newest record's integrity** is anchored by whoever holds its digest. That is a child baseline's `parentDigest`, and A8.6's bundle manifest. A record rewritten alone with its pins and digest made consistent looks intact by itself, and the manifest is what catches it.
  - **`STALE_RESULT`** (a cited analysis result not current) comes with A8.5b's results.
- **The material check** (#2177, O39): `test/material-look.test.ts`.
  - A body named "Steel bracket", in the Steel appearance's colour, with the Steel PBR preset and a brief finish of "brushed steel look", has no material:
    - mass: Aluminium 6061, assumed;
    - inertia: assumed, `MATERIAL_ASSUMED`;
    - printability's warp rule: unknown, "material is not set";
    - its BOM line: no material.
  - A material set on the body is the only thing that makes it steel. Changing it leaves the colour, the face colours and the appearance as they were.

## O41 — A8.5b: result freshness — fingerprints, stale and unresolved, late results, no 0 and no pass for a failure (2026-10-20)

- **`src/team/freshness.ts`.**
  - `stamp` gives every result `{id, kind, subject, run, part?, status, value, number, verdict?, why?, fingerprint}`. The fingerprint is a digest per input it reads, plus the A1 signature of each face it names by name.
  - **The producers:**
    - `requirementResults`: each requirement's verdict, plus the `check_spec` report;
    - `keepoutResult`: the least clearance ≥ 0, A6.3's measure;
    - `massResult`, `inertiaResult`;
    - `dfmResult`: printability;
    - `bomResult`: derived, then checked against the assembly;
    - `drawingResult`: `drawing_issues`.
  - The inputs a requirement reads beyond its model and itself follow its query: `mass` the material; `library_check` the material and process; `print_rule` the process and material; `overhang_area` the process; `keepout` and `datum_distance` the references.
- **Two refinements of the addendum, made before code. The tests hold both:**
  - **`model`** is the features, the parameters and each part's name, placement and model. **Looks are not in it**: neither a body's colour nor its name. A display change must never make a mass stale. That was the point of #2177's material check, and the "bodies' names" the addendum listed would have broken it.
  - **`check_spec`** reads the drafts too: its report lists a draft's unconfirmed dimensions as unknowns.
- **`freshnessOf(result, doc, evaluate)`** gives `current`, `stale` (`changed`: each input named) or `unresolved` (each face with why and candidates). The faces are matched with A1's one matcher (`matchSignature`):
  - `gone`: none alike;
  - `ambiguous`: several as near, with the candidates;
  - `renamed`: clearly another name. The message says "the result is not moved to it", and it is never re-targeted.
  - **A result on a stored reference** (`refs: ['mate m1']`) takes A1's own `verifyReferences`. A problem gives `ambiguous` or `gone` with A1's candidates; a re-match, new or earlier and unconfirmed, gives `renamed`.
- **Display and approval:**
  - `displayOf` shows a value only when the result is current. Otherwise it reads `STALE — material changed since; it was …` or `UNRESOLVED — n1.top could be n1.top or n3.top; it was …`.
  - `passes` needs ok, a pass and current. `numericOf` is null unless the result is ok.
  - `summaryOf` counts pass, fail and unknown only for current, ok results; the rest go by state and status.
  - **A baseline's cited results** (`draftBaseline(…, {cites})`, kept in the record and in its digest). Approving reads each again:
    - a stale or unresolved one is refused `STALE_RESULT`, naming the input or the face;
    - one not ok is refused `RESULT_NOT_OK`, a code added beside the addendum's;
    - with no `evaluate`, it is refused `STALE_RESULT` ("cannot be read").
    - `moveBaseline` is async now for this.
- **Runs** (`openRun`, `recordResult`, `currentOf`):
  - a later run for the same kind, subject and part supersedes the earlier;
  - a result arriving for a superseded run is kept under its own run, marked `late`;
  - `currentOf` is the latest run's result or `pending`, never an earlier run's;
  - a result for a run of another subject is refused `NO_RUN`.
- **Never a 0 or a pass:**
  - a result not ok keeps no value, number or verdict, even when the producer passed some;
  - the producers map their own failures:
    - no body or no evaluation: `failed`;
    - a requirement not measurable, e.g. a mass with no material: `unsupported`. An undecided keep-out within its chord band is ok with verdict `unknown`, its value null;
    - printability with no process: `unsupported`;
    - a drawing of nothing: `failed`;
    - a BOM of a part that does not evaluate: `failed`, with no total.
  - **`non_converged`**: no producer reports it today. The eigen-solve and the solvers do not say. The status holds the same rule, tested on a stamped result.
- **Tests** (`test/team-freshness.test.ts`, 5):
  - **The reads of every kind, and each change against them:**
    - steel for aluminium makes the material results stale and leaves the height, face-distance, keep-out and drawing results current;
    - SLA for FDM makes only `dfm` and `check_spec` stale;
    - a keep-out added makes only `keepout` and `check_spec` stale;
    - a colour and a name make nothing stale;
    - a height change makes everything stale on `model`.
  - **Stale display and approval:**
    - a baseline citing p1's mass is approved while current;
    - after p1's material changes, it is refused `STALE_BASELINE` (part p1);
    - a new draft citing the old result is refused `STALE_RESULT` ("stale: material changed since");
    - a failed citation is refused `RESULT_NOT_OK`.
  - **Late results:** a late result is kept under its own run, the latest run stays pending, and then its own result is current.
  - **Failures:** failed, unsupported (twice) and non-converged results never read 0 or pass, and the summary counts them by status.
  - **Topology:**
    - a 30 mm box's top split into two alike tops is ambiguous (`n1.top`, `n3.top`);
    - a box moved off with another put in its place is renamed to `n3.*`, not moved;
    - a sphere leaves the faces gone;
    - A1's `refs-ambiguous` is carried in with A1's candidates exactly.

## O42 — A8.6: the export bundle — a manifest of digests, verified from its files alone in a fresh process (2026-10-20)

- **`src/team/bundle.ts`** is pure: no filesystem. `writeBundle(doc, evaluate, {baseline?, results?})` gives files by path:
  - `document.bcad`: the document as the studio saves it (`encodeStudioFile`);
  - `baseline.json`: the approved baseline with its ancestors;
  - `materials.json`: each part's bodies with material id, label, density, basis and **every library source with its text**;
  - `results.json`: each result with its fingerprint and its freshness when written;
  - `ecrs.json`: the ECR history with its pins;
  - `manifest.json`.
- **Results**: without `results`, the standard set is written: the BOM, each part's mass, and each part's requirements.
- **The manifest**: `{format: 'barocss-bundle', version: 1, document: {file, revision}, baseline: {id, digest}, files: [{path, sha256, bytes}], missing, stale, complete}`.
  - `revision` is the SHA-256 of the document's revision fields.
  - `complete` holds only when nothing is missing or stale.
  - **Missing:**
    - no approved baseline, or the one named not approved;
    - a baseline that does not verify;
    - a body with no material source: none set (the default, assumed), or a name outside the library;
    - a result not ok;
    - an ECR pin that does not verify.
  - **Stale:** a baseline not current; a stale or unresolved result.
- **`verifyBundle(read, evaluate)`** reads only through `read(path)` and gives `{complete, intact, missing, changed, stale, manifestSaidComplete}`.
  - **Integrity, from the files alone:**
    - each file's size and SHA-256 against the manifest. A file that does not match is not read further: its content is not the one pinned;
    - the document's revision against the manifest's;
    - the baseline's digest against the manifest's (the anchor O40 left to the bundle), then its chain and pins against the document;
    - each approved ECR's pin.
  - **State, against the document:** each result's freshness; each body's material source, read again from the document.
  - **The manifest's own `complete` is reported, never trusted.** `complete` requires nothing missing, changed or stale.
- **`cad-cli bundle write part.bcad -o folder [--baseline BL1]`** prints `{complete, missing, stale, wrote}` and exits 1 when the bundle is not complete.
- **`cad-cli bundle verify folder`** prints the check and exits 0 only when the bundle is complete and intact.
- **Tests** (`test/team-bundle.test.ts`):
  - **Complete.** The clean A8 assembly, each body's material set to al6061 and BL1 approved:
    - the manifest is complete, with each file's digest;
    - materials have basis `body` and the S-DENS source text;
    - the BOM and both masses are current;
    - verified in-process, by a **spawned `cad-cli bundle verify`** (exit 0), and by a spawned `bundle write` from a saved `.bcad`, then verify.
  - **Incomplete, each gap named:**
    - `results.json` deleted: missing, while the manifest said complete;
    - a density edited in `materials.json`: changed, its digest;
    - the document swapped and its file digest rewritten: its revision is not the manifest's;
    - the baseline rewritten consistently (content, pins, digest) and its file digest too: the manifest's anchor catches it;
    - p1's mass taken before its material was set: stale (material changed), at writing and on read-back;
    - no approved baseline and no materials: three missing;
    - spawned: `ecrs.json` deleted gives exit 1, missing.

## O43 — RM7 and RM8 S0: inverse kinematics; a four-bar loop closed — scope and acceptance frozen (2026-10-20)

Assigned by the coordinator after #2177. RD4–RD8 (beam and solid FEA, the tet mesher) are on hold: they are FEA, and the owner's #2177 decision keeps CAE/FEM off the roadmap. The coordinator is asking whether that covers these rows.

**Limits on both:**
- Our own TypeScript, no new dependency. MuJoCo 3.3.0 (O38's venv) is a test oracle only.
- No chat tool: `tools/list` is unchanged. The exposure is `src/robot/` and the MJCF export.
- A change to the kernel core stops and goes to the coordinator.
- The test names are compared at each checkpoint. The flow runs with `PW_DIR=$HOME/.cache/barocss-playwright/node_modules/playwright` (1.62.1), the flow's own install, never another project's tree.

### RM7 — damped least squares / Levenberg–Marquardt inverse kinematics (`src/robot/ik.ts`)
- **The target**: an end link's pose, its motion from the solved pose (RM2's `Motion`), at a tool point given in the solved pose's world coordinates (default: the joint's child origin).
- **The error**:
  - position: the tool point's distance in **m** (the tree's mm / 1000);
  - orientation: the angle of `R* Rᵀ` in **rad**, its axis-angle vector.
  - Both are taken as one 6-vector, unweighted.
- **The Jacobian**: the space Jacobian from each joint's screw at the current pose. A revolute column is `[ω × (x − p); ω]`, a prismatic one `[a; 0]`. A gear follower adds its multiplier times its column to its leader's; fixed and follower joints are not unknowns.
- **The step**:
  - `Δq = Jᵀ (J Jᵀ + λ² I)⁻¹ e`, with λ adapted as in LM: a step that lowers the error is kept and λ halves; one that does not is undone and λ grows by 4.
  - Limits clamp a joint that has them.
  - It stops at |Δp| ≤ 1e-7 m and |Δθ| ≤ 1e-7 rad (well inside the acceptance), or after 200 iterations.
  - It restarts from up to 15 seeds (the given start, then a deterministic random sequence seeded by the target). The best result is kept.
- **The result**: `{q, reached, iterations, restarts, errorM, errorRad, singular, sigmaMin, sigmaMax}`.
  - `reached` holds only when both errors are within 1e-4 m and 1e-3 rad. It is never claimed otherwise.
  - **The singularity flag**: at the result, `σmin / σmax` of J (its 6 rows, or as many as it has joints when fewer) below **1e-6**, computed by an eigen-solve of `J Jᵀ` (`JᵀJ` when narrower).
- **Acceptance (tests on the arm-6r fixture, RM5's)**:
  - **1000 targets, reachable by construction**: the FK of random joint values in [−π, π] (seeded). Each solve starts from 0.
    - **The oracle is RM2's `forwardKinematics`** on the returned q, not the solver's own error.
    - At least **990** reach the target within **1e-4 m and 1e-3 rad**. Successes, the worst errors and iteration counts are reported.
  - **Singular**:
    - the arm straight up (all q = 0), as a target, is reached and flagged singular, since no joint moves the tip along the arm;
    - a 2R chain stretched is flagged too;
    - random reachable targets are mostly not flagged, the count reported.
  - **Unreachable** (a target past the arm's reach): `reached: false` with its best error, never a success.

### RM8 — a four-bar loop, closed (`src/robot/loop.ts`, `conformance/rm/four-bar/`)
- **The fixture**: a crank–rocker four-bar built from mates, as a user would. A base plate carries two pivots `d` apart; on them a crank `a` and a rocker `c`, joined by a coupler `b`. All are planar links on pins (a concentric and a coincident mate each).
  - Grashof: a = 20, b = 70, c = 50, d = 60 mm, so s + l = 90 ≤ p + q = 110, and the crank turns fully.
  - **RM1's tree** takes three revolute joints. The fourth pin is its **Loop**, already reported with its mates.
- **The closure** (`closeLoop(tree, loop, driver, q)`):
  - given the crank's value, it solves the two dependent joints so the loop's pin coincides on both of its parts (Newton on the pin's planar residual);
  - **the branch is the assembled pose's**, followed by continuation from the previous solution. A step that would cross to the other branch (the sign of the coupler × rocker cross product flips) is refused `BRANCH_FLIP`, never taken;
  - a crank angle with no closure (past a dead point, for a non-Grashof linkage) is `NO_CLOSURE`, typed.
- **The oracle**: **Freudenstein's equation**, `K1 cos θ4 − K2 cos θ2 + K3 = cos(θ2 − θ4)`, with K1 = d/a, K2 = d/c, K3 = (a² − b² + c² + d²) / (2ac). Both of its roots are closed form; the branch is chosen by the assembled pose.
- **Acceptance**:
  - over a full crank turn in 360 steps, the rocker's angle equals Freudenstein's branch to **1e-9 rad**, the branch is never left, and the loop's pin coincides by FK to **1e-9 mm**;
  - the other branch is refused when asked for (`BRANCH_FLIP`);
  - a non-Grashof variant reports `NO_CLOSURE` at its dead points.
- **MJCF**:
  - the loop is written as an equality closure, `<equality><connect body1 body2 anchor/>` at the loop's pin. The tree is unchanged, and RM5's files are byte-identical for a tree without loops;
  - our reader checks the closure.
  - **MuJoCo** (`scripts/mjcf-oracle.py`, a closure mode, `python -I`), on the frozen export:
    - **statically**, at 12 crank angles with our qpos, the closure's violation (the connect's anchors apart) is ≤ **1e-9 m**;
    - **dynamically**, a 2 s passive run under gravity at 0.5 ms:
      - the violation stays ≤ **1e-4 m** (a soft constraint);
      - MuJoCo's rocker angle equals Freudenstein's at MuJoCo's crank angle within **1e-3 rad** throughout;
      - the branch is never left.
  - The readings are committed beside the case (`oracle.mujoco-3.3.0.json`), as O38's are.
- **URDF**: still a tree format. The loop is left out and noted, as before.

**Order**: RM7 → RM8, with a checkpoint after each.

## O44 — RM7: DLS/LM inverse kinematics — 999 of 1000 reached; the singularity flag's threshold corrected (2026-10-20)

- **`src/robot/ik.ts`**: `solveIk(tree, {link, motion, tool?, mode?}, start?)` and `jacobianConditioning(tree, link, q, tool?, mode?)`.
  - **The model** is O43's: the space Jacobian from each joint's screw at the current pose. A gear follower's column goes to its leader, times the multiplier.
  - **The step** is `Δq = Jᵀ (J Jᵀ + λ² I)⁻¹ e`, with LM's λ (halved on a kept step, × 4 on an undone one). Limits clamp. Up to 15 seeds come from a deterministic mulberry32 seeded by the target.
  - **Per iteration**: typed scratch arrays reused, a small Cholesky and a cyclic-Jacobi eigen-solve of our own, no closures. The seed generator is module state.
  - **`mode: 'position'`** solves for the tool point alone (3 rows), its turn left free. It was added for the 2R case: a planar chain's stretched singularity exists only in position. With the orientation rows, its two columns stay independent.
- **The arm-6r fixture** (RM5's frozen `robot.bcad`). The tool point is 80 mm up l6's axis from its joint. There are 1000 targets from RM2's FK at random q ∈ [−π, π]⁶, each solved from 0 and **judged by RM2's FK on the answer**:
  - **999 of 1000 reached** (the acceptance is 990). The worst reached errors are 9.6e-8 m and 7.8e-7 rad.
  - The one miss, target 405, ends at 2.1e-3 m and 3.2e-4 rad after all 15 seeds. It is reported as not reached, never claimed.
  - It takes 79 iterations a target on average. 4 of the 1000 solved targets are flagged singular.
  - The solver's own `reached` agrees with the oracle's reading on every target.
- **Two corrections to O43's frozen numbers, found by the singular cases.** The acceptance tolerances are unchanged.
  - **A solve that stops at 1e-7 sits about √1e-7 rad off a singular pose.** Along the singular direction, the error grows only as δ².
    - So the straight-up arm's solve ended 1e-3 rad off with σmin/σmax 7e-6, and was not flagged.
    - Each descent now refines down to 1e-12, or until a step stops helping. A seed within 1e-7 is not restarted, which keeps restarts and iterations down (230 → 79 a target).
  - **The flag's threshold is 1e-4, not 1e-6.**
    - Even refined to machine precision, a 2R solve on its stretched pose ends 7e-6 rad off, with ratio 1.4e-6. The 1e-6 threshold sits at double precision's own limit, so it would miss a solve that is on a singularity.
    - 1e-4 is a condition number of 1e4. Random poses of this arm have ratios from 6.8e-6 up, with a median of 7.5e-3. It flags 10 of 1000 random poses, and 4 of 1000 solved targets.
    - Flagging more is the conservative side.
    - **It is a flag threshold, not an accuracy tolerance** (coordinator, on accepting O44). It classifies a pose and changes no reached/not-reached verdict. The distribution behind it, over 1000 random poses of this arm: σmin/σmax from 6.8e-6, median 7.5e-3; 10 below 1e-4 (1 %), 78 below 1e-3, 632 below 1e-2.
- **Tests** (`test/robot-ik.test.ts`):
  - the 1000 targets, with the counts printed;
  - **singular cases:**
    - the straight-up arm reached and flagged;
    - the same arm bent, not flagged;
    - a 2R chain (100 and 60 mm) stretched, flagged in position, and a position solve to its stretched point reached and flagged;
    - bent, not flagged;
  - a target 40 mm past the 2R's reach: `reached: false`, its error above 0.03 m.

## O45 — RM8: a four-bar loop closed — Freudenstein to 3e-14 rad; MuJoCo holds the MJCF closure (2026-10-20)

- **`src/robot/loop.ts`.**
  - **`closureOfDoc(doc, tree, loop)`** finds the pin: the loop's concentric mate's axis on its first part, placed where the mates put it.
  - **`closureOf(tree, a, b, pin, axis)`** records the assembled branch.
    - Refused `NOT_ONE_LOOP` unless exactly three moving joints go round the loop besides its pin.
    - Refused `NOT_PLANAR` unless each is a turn about the pin's axis direction.
  - **`closeLoop(tree, closure, driver, value, from)`** solves the other two joints by Gauss–Newton on the pin's residual, from the previous solution. A step is capped at a quarter turn, and it stops at 1e-12 mm.
    - **The branch** is the sign of the turn from one part's lever to the other's at the pin, each lever from the part's own joint. A closure on the other branch is refused `BRANCH_FLIP`, never taken.
    - **A driver value with no closure** (residual above 1e-9 mm after 60 steps) is `NO_CLOSURE`.
- **The fixture** (`test/robot-loop.test.ts`, frozen in `conformance/rm/four-bar/`) is built from mates, as a user would: pins at A (20, 20) and D (80, 20) on a plate; bars with a hole at each end; a 20, b 70, c 50, d 60 (Grashof); assembled at crank 60° on the open branch.
  - **RM1's tree** has three continuous joints: `base~crank`, `crank~coupler`, `base~rocker`.
  - The coupler–rocker pin is its one loop.
- **Against Freudenstein's closed form** over a full crank turn in 360 steps:
  - the rocker's angle, read by FK of its pin and not by the closure, has a worst error of **3.0e-14 rad** (bound 1e-9);
  - the pin's worst gap by FK is **9.9e-13 mm** (bound 1e-9);
  - the branch is never left.
- **The other branch**: started from the crossed configuration (Freudenstein's other root), Newton closes there and is refused `BRANCH_FLIP`.
- **A non-Grashof triple rocker** (50, 30, 40, 70: s + l = 100 > p + q = 90) is driven from 30°. It is refused `NO_CLOSURE` at the first step past its dead point, exactly where Freudenstein has no root, and closes everywhere before it.
- **A non-planar loop** is refused `NOT_PLANAR`.
- **MJCF** (`exportMjcf(…, closures)`, `mjcfOfDoc`):
  - each planar loop becomes `<equality><connect name="loop_<a>_<b>" body1 body2 anchor/>`, the anchor at the pin in body1's link frame (m);
  - a loop that cannot be closed is left out and noted;
  - a tree without loops is written byte for byte as before (RM5's frozen arm-6r).
- **Our reader** parses `connect` (each body must exist, never a body to itself). `connectViolations(model, q)` takes body2's point from qpos 0, as MuJoCo does. The closure holds at every one of the 361 solver poses to 1e-9 m.
- **MuJoCo 3.3.0** (`packages/barocss-cad/scripts/loop-oracle.py`, `python -I`, O38's venv) ran on the frozen export (`cad-cli mjcf` writes the same `robot.xml` byte for byte). Its reading is committed as `oracle.mujoco-3.3.0.json`.
  - **This is a script of its own** beside `mjcf-oracle.py`, rather than O43's "closure mode" in it.
  - **Static, 12 crank angles at our joint values:**
    - the connect's three equality rows (`efc_pos`) worst **4.7e-16 m** (bound 1e-9);
    - the rocker's angle, from MuJoCo's own kinematics of the pins, against Freudenstein at MuJoCo's crank angle: worst **1.4e-14 rad** (bound 1e-9).
  - **Dynamic, 2 s passive at 0.5 ms, RK4, contacts off, gravity in the linkage's plane:** the export's gravity runs along the pins, where nothing would move, so the oracle sets it in the plane, in the oracle only. The crank swings through 2π.
    - **First run: failed.** The violation reached 7.0 mm and the angle error 0.145 rad.
      - **The cause:** MuJoCo's default equality is soft (solref time constant 0.02 s). Under gravity alone it gives way about g·τ² ≈ 4 mm.
      - **The fix**, in the oracle only, as its gravity and RM5's damping are: the closure's solref is set to 2·dt (critically damped), MuJoCo's stiffest at this step. The export sets no solref and invents nothing, and the bounds are unchanged.
    - **Second run: passed.**
      - violation at most **4.1e-5 m** (bound 1e-4);
      - rocker against Freudenstein at most **9.1e-4 rad** (bound 1e-3);
      - the branch kept; no warnings.
      - **The angle margin is thin.** The 4e-5 m give, on a 20 mm crank, turns into nearly the whole 1e-3 rad. A finer step (τ = 2·dt) would tighten it; the frozen run is 0.5 ms.
- **Re-run at 0.1 ms** (coordinator, on accepting O45: the thin margin), as RM5's passive run steps. Re-frozen:
  - closure violation at most **1.7e-6 m** (bound 1e-4);
  - rocker against Freudenstein at most **3.6e-5 rad** (bound 1e-3);
  - the branch kept, no warnings, the crank through 2π.
  - The bounds are unchanged and the export sets no solref.
- **The constraint parameters**, read from the model by the oracle and written into its reading:
  - solref **[0.0002, 1.0]** (2·dt, critically damped; set in the oracle only);
  - solimp **[0.9, 0.95, 0.001, 0.5, 2.0]**, MuJoCo's default, unchanged.
- **What each check measures:**
  - **The dynamic drift measures MuJoCo's soft-constraint solver, not our export.** That is why its bound is loose and its solref is the oracle's.
  - **The export's real test is the closure at 1e-9** on the static poses: our reader's at all 361 solver poses, and MuJoCo's own equality rows at 12 (4.7e-16 m).
- **Tests** (`test/robot-loop.test.ts`, 4):
  - the tree, the loop and the full turn against Freudenstein;
  - the other branch, the triple rocker's dead point and the non-planar refusal;
  - the MJCF connect read back and closed at every solver pose, the fixture frozen (`UPDATE_RM_FIXTURES`);
  - MuJoCo's committed reading held to the criteria.
- **URDF**: unchanged. A tree format: the loop is left out and noted.

## O46 — RD4–RD8 held as CAE; RD9 and RD10 S0 without FEA (2026-10-20)

- **The owner's decision**, relayed by the coordinator, verbatim: "RD4~RD8(FEA·메셔)도 CAE로 보고 로드맵에서 빼서 보류해. RD9·RD10은 FEA 없이 가능한 범위만."
  - It means: RD4–RD8 (FEA and the mesher) count as CAE. They come off the roadmap and are held. RD9 and RD10 go ahead only as far as they can without FEA.
- **Held** (README §0 and the roadmap section mark each; their rows are kept as history):
  - RD4: beam FEA and modal;
  - RD5: the tet mesher;
  - RD6: tet4 with PCG;
  - RD7: tet10, NAFEMS;
  - RD8: solid modal.
- **The outer lane's order**: RM7 (done, O44) → RM8 (done, O45) → RD9 → RD10, deterministic parts only, each with an S0.

**Limits on both:**
- No FEA. The only checks are RD1–RD3's sizing, RM's joint limits and sweeps, and closed-form checks.
- Our own TypeScript; no chat tool (`tools/list` unchanged).
- Exposure: `src/robot/` and `cad-cli`.

### RD9 — the design-check harness v1 (`src/robot/harness.ts`, `cad-cli robot-check`)
- **Input**: a robot document and a **duty**:
  - moves `{from, to, profile, limits, joint_limits?, dwell_s}`, run out and back as RD3 runs them;
  - `life_h?`, `inertia_ratio_max?`, `clearance_mm?` (default 0), `g?`;
  - optionally `actuators: {joint: {motor, reducer}}`. Without it, RD3's lightest feasible pair is checked.
- **Output**: one report, `{ok, margins, unknowns, consistency, least}`.
  - **A margin** is `{check, joint?, move?, value, limit, unit, margin, source, ok}`. It is the signed slack: `(limit − value)/|limit|` for an at-most limit; `(value − required)/max(required, 1 mm)` for clearance.
  - `ok` holds only when every margin is above 0, nothing is unknown, and every consistency check holds.
- **The checks** (each named, per joint and move):
  - **RD3, the actuators.** The given or chosen pair's nine checks, negative margins included: RMS, the torque–speed line, motor speed, inertia ratio, the reducer's repeated peak, input speed, average torque, average input speed and life. A new export, `checkPair`, gives the checks of one pair even when they fail; `sizeActuators` is unchanged.
  - **RM, the joints:**
    - `joint range`: each move's endpoints within lower…upper. A straight joint-space move rest to rest has no overshoot, so the endpoints bound it;
    - `joint velocity`: the profile's peak against the joint's velocity rating;
    - `joint effort`: RD2's peak torque against its effort rating.
    - A missing limit or rating is **unknown** (`LIMITS_MISSING`), never a pass. A continuous joint has no range check, and says so.
  - **RM6, the sweep**: each move's path certified clear, its least clearance against `clearance_mm`. A contact is a failing margin, its place and links named.
  - **Consistency (closed form).** At each move's ends:
    - the holding torques by RNEA (q̇ = q̈ = 0) equal RD1's gravity torques to 1e-9 relative;
    - the mass matrix is symmetric and positive definite.
    - A failure means the model is wrong, so the report is not ok.
- **Acceptance** (fixture `conformance/rd/arm-3r/`: a base and three 20 × 20 × 80 aluminium blocks on axes Z, Y, Y from mates, with limits and ratings set):
  - a clean duty: every margin above 0, each listed;
  - a rerun gives a byte-identical report;
  - **seeded defects**, each giving a negative margin at its own check and only there:
    - an endpoint past a limit;
    - a profile above a velocity rating;
    - an effort rating below the peak torque;
    - a colliding move;
    - an undersized actuator pair, with its failing RD3 check named;
    - a missing rating: unknown, the report not ok.
  - **Closed form:**
    - the holding torques at the arm's horizontal pose against the hand formula for uniform blocks (Σ m g r), to 1e-9;
    - the harness's torque and actuator numbers are RD2's and RD3's own (the same functions, equal).
  - **`cad-cli robot-check part.bcad duty.json`** prints the report and exits 0 only when ok, else 1.

### RD10 — sizing a 3-DoF arm until every margin is above zero (deterministic part)
- **The brief**: RD9's arm moves between two poses with a dwell, repeated, for a required life. The start is undersized: small actuators, ratings too low, a profile too fast.
- **The scripted sizer** (`src/robot/sizer.ts`, the deterministic agent):
  - each round runs the harness and takes the worst failing margin, applying one rule:
    - **an actuator check fails**: the joint takes RD3's lightest feasible pair. When none is feasible, the profile slows (velocity and acceleration × 0.8, every joint);
    - **a joint rating fails**: the rating becomes the chosen actuator's capability: velocity = min(motor max speed, reducer max input speed) / N; effort = the reducer's repeated peak torque;
    - **a joint range or a sweep fails**: no sizing rule fixes geometry. It stops `BRIEF_INFEASIBLE` with the failing check, never "done".
  - Each round's trace names the check that drove it and the change made.
- **Acceptance**:
  - from the undersized start, every margin is above 0 within 10 rounds;
  - the final design passes a fresh harness run on the saved document;
  - deterministic: the same trace on a rerun;
  - an infeasible brief (a pose past a limit) stops typed;
  - `cad-cli robot-size part.bcad duty.json -o sized.bcad` prints the trace.
- **The L3 evidence, pending the owner** (a live model run, not approved). The protocol:
  - a live model is given the same brief, with the harness as a tool (a `robot_check` chat tool, added only for that run, within the contract budget);
  - at least 3 runs;
  - success means every margin above 0 by a fresh harness run, never the model's word;
  - the rounds and the margins are compared with the scripted sizer's.

**Order**: RD9 → RD10, with a checkpoint after each.

**Scope additions, made during the steps and accepted by the coordinator:**
- **RD9 (O47):** the arm-3r fixture carries a 60 mm steel payload (1.7 kg) on a lock mate, beyond "three blocks". Without it nothing loads the smallest pair (RMS 5 % of its limit), and RD10 would have nothing to size.
- **RD10 (O48):** when a joint's actuator changes, its ratings are held to the new pair's capability. Without that rule, a design rated past its reducer (36 N·m on a 23 N·m reducer) would have passed the harness, which checks ratings against the duty, not against the actuator.

## O47 — RD9: the design-check harness v1, without FEA (2026-10-20)

- **`src/robot/harness.ts`**: `checkDesign(tree, bodies, sweepLinks | null, duty)` gives `{ok, margins, unknowns, consistency, least, actuators, notes}`.
  - **The document level** (`src/chat/robot.ts`):
    - `robotCheckOfDoc(doc, bodies, evaluate, duty)`;
    - `readDuty(tree, raw)`: each move checked as `motion_torques` takes one;
    - `robotOfDoc`, now exported;
    - `sweepLinksOfDoc`, shared with the `sweep_path` tool, whose behaviour is unchanged.
  - **`checkPair`** (`src/robot/actuators.ts`, new) gives one given pair's nine RD3 checks over sizeActuators' own cycle, refined, failing checks included. `sizeActuators` is unchanged.
  - **Every margin per move, in a fixed order:**
    - joint range at both ends, velocity rating against the profile's peak, effort rating against RD2's peak or RD1's hold;
    - RD3's checks for the given pair, or the lightest feasible pair's (life only when `life_h` is given);
    - the sweep;
    - then consistency at both ends: RNEA's holds against RD1's to 1e-9 relative; the mass matrix symmetric to 1e-12 and positive definite (Cholesky).
  - **Unknown, typed, never a pass:**
    - `LIMITS_MISSING` (no range, velocity or effort rating);
    - `NO_ACTUATOR` (a given id not in the catalogue, or a joint without one when actuators are given);
    - `NOT_SIZED` (no catalogue pair meets every check).
  - A continuous joint has no range check, and a slide's actuator is not checked; both are noted.
- **`cad-cli robot-check part.bcad duty.json`** prints the report. It exits 0 when ok, 1 otherwise, and 2 for a malformed duty.
- **The fixture** (`conformance/rd/arm-3r/`: `robot.bcad`, `duty.json`, `case.json`, in a subfolder so the kernel runner leaves it alone):
  - the arm is three of arm-6r's 20 × 20 × 80 aluminium blocks on axes Z, Y, Y from their mates, with limits and ratings;
  - **a 60 mm steel cube (1.7 kg), added beyond O46's text,** is locked on l3 (a `lock` mate, a fixed link). Without a payload, the blocks barely load the smallest pair (RMS 5 % of its limit), so sizing would decide nothing for RD10. With it, the shoulder holds 2.2 N·m and RD3 picks 100:1 for the shoulder and elbow.
  - **The duty**: two moves (0 → P1 → P2), trapezoid 1 rad/s and 3 rad/s², 0.5 s dwells, 20 000 h life.
- **Tests** (`test/robot-harness.test.ts`, 4):
  - **The clean duty: every margin above 0.**
    - 80 margins: 12 range, 6 velocity, 6 effort, 54 RD3 and 2 sweeps;
    - 8 consistency checks hold;
    - nothing is unknown. The least margin is joint range l1~l2 at 0.25;
    - a rerun is byte-identical.
  - **Seeded defects, each failing at its own check and only there:**
    - base~l1 to 2.7 (upper 2.5): `joint range base~l1`;
    - a velocity rating of 0.5: `joint velocity l1~l2`;
    - an effort rating of 1 N·m: `joint effort l1~l2`;
    - the payload swung into the base: `sweep`, with `contact base–payload`;
    - **an undersized actuator**: at 6 rad/s cruise and 60 rad/s² (ratings raised to allow it), the shoulder given the 100:1 reducer fails its own RD3 checks only, as its motor runs past its torque–speed line. On 50:1 it is clean.
    - a missing effort rating: two `LIMITS_MISSING`, no failing margin, the report not ok;
    - an unknown reducer id and a joint without one: `NO_ACTUATOR`.
  - **Closed form**: at shoulder-horizontal (l1~l2 = π/2), the holding torques equal `g Σ m dz`, taken from each part's own volume × density and centroid, to 1e-9 relative. This is an independent route: a π/2 turn about Y carries a centre dz above the axis to dz out along X. The 1e-9 needs masses unrounded, since `mass_properties` rounds grams to 3 decimals.
  - **The harness's numbers are RD2's and RD3's own**: effort equals `motion_torques`' peak or `gravity_torques`' hold, and every RD3 check value equals `sizeActuators`' for the same pair.
  - **The CLI** (spawned): the frozen arm and duty exit 0; a past-limit duty exits 1 with `least` joint range; a duty without limits exits 2 with the reason.
- **Note:** RD3's ranking, by mass and then the largest least margin, picks 100:1 over 50:1 at equal mass. The seeded defect therefore came from a fast duty, not from "the smallest reducer".

## O48 — RD10, the deterministic part: the scripted sizer takes arm-3r to every margin above zero (2026-10-20)

- **`src/robot/sizer.ts`**: `sizeDesign(tree, bodies, sweep, duty, {maxRounds})` gives `{ok, rounds, trace, tree, duty, report, stopped?}`.
  - **The document level**: `robotSizeOfDoc` writes the sized ratings back into `robot.joints`. The actuators and the profile stay in the duty.
  - **One change a round**, for the worst failing margin, or else the first unknown:
    - **an RD3 check fails, or a joint has no actuator**: the joint takes the lightest catalogue pair that passes every RD3 check in every move (by mass, then id). When none does, every move slows (velocity, acceleration and jerk × 0.8);
    - **a velocity or effort rating fails, or is missing**: it becomes the joint's actuator's capability (`capability`): velocity min(motor max speed, reducer max input speed) / N; effort the reducer's repeated peak torque;
    - **a range or a sweep fails**: `BRIEF_INFEASIBLE`, since no sizing rule changes geometry or the duty's poses;
    - **only consistency fails**: `BRIEF_INFEASIBLE` ("the model is inconsistent");
    - **past `maxRounds`** (10): `NOT_CONVERGED`.
  - **Added beyond O46, found by the first run:** when a joint's actuator changes, its ratings are held to the new pair's capability, said in the trace.
    - The run had rated the shoulder 36 N·m from its 100:1 reducer, then moved it to 50:1, whose repeated peak is 23 N·m. The harness checks ratings against the duty, not against the actuator, so the design would have "passed" rated past what it can give.
    - The test now asserts every final rating is within its pair's capability.
- **`cad-cli robot-size part.bcad duty.json -o sized.bcad`** writes `sized.bcad` (the ratings) and `sized.duty.json` (the actuators and the profile), and prints the trace. It exits 0 when sized, 1 when stopped, 2 for a malformed duty.
- **The run** (`test/robot-sizer.test.ts`). The brief is arm-3r between two poses at 6 rad/s and 60 rad/s², 0.5 s dwells, 20 000 h. The start is undersized: ratings 1 rad/s and 1 N·m, every joint on 100:1.
  - **16 failing margins** at the start.
  - **8 rounds:** 3 velocity ratings, then 2 effort ratings, then the shoulder to 50:1 (its effort held to 23), the base's effort, and the base to 50:1 (effort held to 23).
  - Every margin is then above 0, and the least is joint range l1~l2 at 0.25.
  - Each round's check was failing when it was taken.
  - **Saved and opened again**, a fresh harness run on the sized document and duty is ok and byte-identical to the sizer's last report. A rerun gives the same trace.
  - **Stops:**
    - a pose past a limit gives `BRIEF_INFEASIBLE` ("joint range base~l1 fails in move 0"), after the actuators and ratings are fixed first, since it is not the worst margin at the start;
    - the payload swung into the base gives `BRIEF_INFEASIBLE` (sweep, contact base–payload);
    - `maxRounds: 1` gives `NOT_CONVERGED`.
  - **Spawned:** `robot-size` exits 0, then `robot-check` on its outputs exits 0.
- **The L3 evidence is pending the owner**: a live model sizing the same arm, with the protocol in O46's S0. The scripted sizer's trace above is the baseline it is compared with: rounds, changes, final margins.

## O49 — S0: a generic drawing table (and R12's bend table on it) — scope, API and acceptance frozen (2026-10-20)

Asked by the coordinator for the kernel lane: FR4b's frame cut list needs a table on a drawing, and drawings are the outer lane's. It also closes R12's leftover item, "a drawing's bend table".

**The entity** (`src/drawing/types.ts`, in `DrawingSettings.tables`, read leniently by `readDrawing`):
```ts
interface TableColumn { key: string; label: string; unit?: string; align?: 'start' | 'middle' | 'end'; digits?: number }
type TableCell = string | number | null;          // null: shown as '—'
interface DrawingTable {
  id: string; title?: string;
  columns?: TableColumn[]; rows?: TableCell[][];  // its content given …
  from?: string;                                  // … or filled from the part at each build by a named source
  at?: XY;                                        // a sheet point (mm, y down) …
  corner?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';  // … that this corner of the table is on (default top-left)
}
```
- **Read leniently.** `readDrawing` keeps a valid table and drops a malformed one: 1–20 columns, at most 200 rows, every row as long as the columns, cells of at most 120 characters, ids unique.
- **No `at`: it lays itself out.** The table goes above the title block, right-aligned to it. Tables without `at` stack upward, in their order.
- **The sources** (`src/drawing/tables.ts`, `TABLE_SOURCES`): `(ctx: {doc, bodies}) => TableContent | {error}`, with `TableContent = {title?, columns, rows, notes?}`.
  - `bends` is R12's bend table, below.
  - **FR4b's cut list is one more entry**, `'cut-list'`: a pure function from the kernel lane's frame data to `TableContent`. The kernel lane may also write a table's `columns` and `rows` directly into a drawing.
- **The layout** (`tableLayout(content, at, corner)`, pure, in sheet mm) gives `{box, widths, rowHeight, marks}`.
  - Text is 2.5 mm, and each row is 5 mm.
  - Each column is as wide as its widest text (its header, with the unit as `label [unit]`) plus 1.5 mm each side.
  - A bold title row spans the columns, and the header row follows.
  - Numbers are shown to `digits` places (absent: up to 2, trailing zeros dropped) and aligned right by default; text is aligned left.
  - The outer border is drawn with the visible pen and the inner rules with the thin pen, as lines; the cells are text marks.
  - A source's `notes` go under the table, in the table's group.
- **On the sheet**: the table is a `table` mark group (`id` the table's), so every writer draws it as it draws any marks:
  - **SVG**: `<g class="table">`;
  - **PDF**;
  - **DXF, through the R11b writer**: lines on THIN/VISIBLE, TEXT entities on TEXT. No new writer code.
- **The issue check (R14)** treats a table as an annotation:
  - **`TEXT_OVERLAP`**: a table's box against any other text, or another table;
  - **`TEXT_OVER_LINES`**: against a view's lines or area;
  - **`OFF_SHEET`**: past the frame or into the title block;
  - each fixed by a new `move-table` fix, row by row as a note's;
  - **`TABLE_SOURCE`** (new, an error): a source that is unknown or that refuses. The table is drawn with its title and the reason, never as an empty table that would read as "no rows".
- **R12's bend table** (source `bends`):
  - one row per bend of every sheet body with a flat pattern;
  - **columns**: bend (its name), direction (UP / DOWN in the flat), angle [°], R [mm], K, BA [mm], BD [mm], and the bend-table rows used (`rows 2–3, interpolated`) or '—';
  - BA and BD use the kernel's own `bendAllowance` and `bendDeduction` (exported) on each bend's angle, R, K and the sheet's T;
  - a note gives T and the K's origin: the sheet's, a bend table's, or estimates flagged;
  - a part with no sheet body gives `TABLE_SOURCE`, "no sheet-metal body with a flat pattern".
- **In the studio**: a "Bend table" checkbox in the drawing workspace, shown for a part with sheet bodies. It adds or removes `{id: 'bends', from: 'bends'}`.
  - **No chat tool change**: `tools/list` stays unchanged and `set_drawing`'s schema is the same. The kernel lane's tables come through documents and sources.

**Acceptance**:
- **Layout**: column widths from the text widths, the box and the four corner anchors; a closed form for a 3 × 2 table (box size from the widths and row heights); numbers to their digits.
- **Writers**: the same table in the SVG (its texts and lines), the PDF (its texts) and the DXF (TEXT and LINE entities, read back by our DXF reader, with ezdxf's audit clean as R11b's oracle).
- **Issues**:
  - a table over a view: `TEXT_OVER_LINES`;
  - over a note: `TEXT_OVERLAP`;
  - over the title block: `OFF_SHEET`;
  - the `move-table` fix clears each;
  - an auto-placed table is clean on an A4 drawing of the R12 L-bracket;
  - an unknown source: `TABLE_SOURCE`.
- **The bend table**, on R12's conformance parts:
  - each bend's BA = θ(R + K·T) and BD = 2(R + T)tan(θ/2) − BA, closed form, to the shown digits;
  - with D120's shop table, the row's deduction (4.2) is the BD shown, and its rows named.
- **Exposure**: the studio checkbox, and a flow step (before the last) that ticks it on a sheet part and exports the drawing's SVG, PDF and DXF, each containing the table.

**The API for the kernel lane**:
- the types above;
- `TABLE_SOURCES[name] = (ctx) => TableContent | {error}`;
- `tableLayout`, if a table's size is needed before placing it.

The kernel lane writes FR4b's function returning `TableContent`. Registering it as `'cut-list'` is one line, done by the outer lane on request.

**Order**: the table and the bend table in one step, then AM6 and AM7, each with its own S0.

## O50 — the drawing table, and R12's bend table on it (2026-10-20)

- **`src/drawing/table.ts`** (pure): `tableSize`, `tableLayout(content, at, corner)` → `{box, widths, rowHeight, marks}`, plus `cellText` and `headerText`.
  - Text is 2.5 mm, rows 5 mm, the pad 1.5 mm.
  - A title wider than the columns widens the last column.
  - Source notes go under the table, and the box takes them in.
  - The border and the rule under the header use the visible pen; the other rules are thin.
  - Numbers align right, text left; `null` shows as '—'.
- **`src/drawing/tables.ts`**: `TABLE_SOURCES` (`bends`) and `tableContent(table, {doc, bodies?})`. An unknown source is an error that lists the known ones.
  - **`bendTable`**: per bend of every sheet body with a flat pattern — name, UP/DOWN, angle (1 place), R (2), K (3), BA (3) and BD (3) by the kernel's `bendAllowance` and `bendDeduction`, and the shop table's rows when K came from one.
  - Its note gives T and the K's origin, with K 0.5 flagged as an estimate.
  - Several bodies are told apart by key.
- **The sheet** (`buildSheet`, `meta.tableContent`):
  - tables go last, as `table` groups; `Sheet.tables` holds each one's box, and its error when its source gave nothing;
  - **without `at`, a table is placed by search**: the first spot clear of the views' areas, every text on the sheet and the tables already placed. The search starts just above the title block's right end and steps 5 mm, upward then leftward, inside the frame. **This goes beyond O49's "above the title block, stacked"**: the first run's fixed spot overlapped the right view's name on the L-bracket drawing;
  - a refusing source is drawn as the table's title, a "NOT AVAILABLE" header and the reason.
- **The issue check** (R14):
  - a table is one box owner (`table`) in `TEXT_OVERLAP` and `OFF_SHEET`;
  - `TEXT_OVER_LINES` fires when it lies over a view's lines or area;
  - **its fix (`move-table`) is the same search** (`tableRoom`). A row-by-row move like a note's cannot get a table out of a view, so this also goes beyond O49;
  - `TABLE_SOURCE` is an error;
  - an issue names its tables (`tables: [id]`).
- **The writers are unchanged.**
  - SVG: `<g class="table">`;
  - PDF: its texts as `Tj`;
  - DXF through the R11b writer: TEXT and LINE entities, `—` as Windows-1252, ° as `%%d`.
- **In the studio**: a "Bend table" checkbox in the drawing workspace, shown for a part with a sheet body. The workspace gets the evaluated bodies, so the source runs no evaluation of its own there, and `__studioDrawing` lists the tables.
  - The chat's `drawing_issues` and the other drawing tools fill sources through `drawingInputs`.
  - No tool schema changed.
- **Tests** (`test/drawing-table.test.ts`, 4):
  - **Layout**: the widths from the text widths; the box from the rows, at all four corners; numbers to their digits (`120.0`, `7.3`, `—`, `0.3`, `0.00`); alignment; the visible rules; the lenient reader (a short row dropped, a duplicate id dropped).
  - **The bend table:**
    - on R12.5's L-bracket: BA = θ(R + K·T) and BD = 2(R + T)tan(θ/2) − BA to 1e-12 (3.393 and 2.607);
    - with D120's shop table, BD is the row's 4.2, shown as `4.200`, its row named;
    - a box part gives the source's refusal; an unknown source names the known ones.
  - **On the sheet:**
    - auto-placed, clean;
    - **over the front view**: `TEXT_OVER_LINES`, and `move-table` clears it;
    - **anchored under a note**: `TEXT_OVERLAP` (auto-placed, it moves clear of the note);
    - **in the title block**: `OFF_SHEET`, and its fix clears it;
    - **`cut-list`, not registered yet**: `TABLE_SOURCE`, drawn with its reason.
  - **Written**: each text in the SVG's table group, the PDF's `Tj`s and the DXF's TEXT entities.
    - **The DXF is frozen** as bytes (`conformance/r14/tables/bends/expected.AC1015.dxf`; its date fixed).
    - **ezdxf 1.4.5** (`scripts/dxf-oracle.py`, `python -I`) audits it clean and reads every text back (`oracle.AC1015.json`).
    - **Found by the oracle:** the first freeze wrote the writer's text as UTF-8, so ezdxf read `—` as `â€”`. The file is the writer's Windows-1252 bytes, and the test compares bytes.
- **Found by the full suite:** the case first sat at `r14/table-bends/case.json`, and the studio's own R14 test (`test/drawing-issues.test.ts`) reads every `r14/<case>/case.json` as a drawing case. It moved one level down, to `r14/tables/bends/`.
- **Flow step** (before the last): a sheet L (K 0.4) in the Drawing workspace with the checkbox ticked. The table is placed with no table issue, and the SVG, PDF and DXF exports each contain `BEND TABLE`, `5.969` and `4.031` (BA and BD at R 3, T 2, K 0.4).
- **For FR4b**: the `'cut-list'` source is the one line to add once the kernel lane's function exists. The test above shows what an unregistered source does.

## O51 — AM6 S0: split a part too big for the bed, with dowel or plug connectors — scope and acceptance frozen (2026-10-20)

Assigned by the coordinator after the drawing table. It uses what exists:
- the `split` feature (cut faces named `<id>.cut`);
- `hole`, its centre in the other two axes in order, entering from the target's own bounding face on `side`;
- `difference` and `union`;
- sketches and extrudes for pins;
- the printer profiles (`buildMM`), AM1's `fitGap`, and AM4's print direction;
- the kernel's exact intersection, as the `interference` tool measures it.
- **No kernel-core change is needed.** If one turns out to be, it stops and goes to the coordinator.

**The command `split-bed`** ("Split to fit the bed", `src/print/splitBed.ts`, in the palette and through `run_command`) appends features to the part as one change, so it is undone as one.
- **Its values:**
  - `connector`: `dowel` (a separate pin, a bore in both pieces) or `plug` (a pin made one with the lower piece, a bore in the upper);
  - `d`: the pin's diameter;
  - `length`: the pin's length;
  - `count`: connectors per cut, default 2;
  - `fit`: the radial clearance; default the printing profile's `fitGap`, the gap that does not fuse;
  - `wall`: the least material round a bore, default 2 mm.
- **Its scope:**
  - **one body**, else refused `ONE_BODY`;
  - **an axis-aligned print direction**, `doc.print.direction` or +Z, else `DIRECTION_NOT_AXIS`;
  - **the document's printer**, else `NO_PRINTER`.
  - A piece fits when its height along the build direction is within the build height and its two other extents, sorted, are within the bed's, sorted: AM1's bed-fit, an in-plane turn allowed.
- **The split:**
  - along the one axis that needs it: the build axis when the part is too tall, else the longer in-plane axis;
  - into the fewest even pieces (2–20) that each fit;
  - typed refusals: `NOT_NEEDED` when the whole part fits; `TOO_BIG_TWO_WAYS` when no single-axis split fits, two axes being later scope.
  - The cuts are a chain: each split's upper side is split again.
- **The connectors, on each cut face:**
  - `count` points along the face's longer in-plane extent, evenly spread;
  - each at least `d/2 + fit + wall` inside the face's boundary, measured on the face's triangles;
  - none that far in: `NO_ROOM`, with the room there is.
  - **For each point:**
    - **dowel**: a bore Ø `d + 2·fit`, `length/2 + fit` deep, in both pieces (`hole` from the cut side); the pin is a separate body, a sketch circle on a plane `length/2` below the cut, extruded `length`;
    - **plug**: the pin is made one with the lower piece (`union`); the bore is in the upper piece only.
  - Bad values (`d`, `length` or `fit` ≤ 0, `count` outside 1–8): `BAD_CONNECTOR`.
- **The report** (the command's note; `bedSplit(doc, bodies)` for tests): the cuts, each piece's body key, box and fit, and each connector's position and radii.

**Acceptance:**
- **Volumes**: the pieces before connectors sum to the original to 1e-9 relative. After them:
  - Σ pieces + Σ dowels = original − Σ bores + Σ dowels, closed form π r² h;
  - a plug's pieces sum to original + the pins' protruding volume − the bores.
- **Fit**: each piece fits the bed by AM1's bed-fit rule. A 300 mm part on the 256 mm FDM printer gives 2 pieces; 600 mm gives 3.
- **At the given fit**: each bore's exact cylinder radius minus its pin's is `fit`, to 1e-9.
- **Interference, exact**: the assembled pieces and pins, every pair, have no overlap volume by the kernel's intersection. The cut faces touch, never overlap.
- **Refusals**: `NOT_NEEDED`, `ONE_BODY`, `NO_PRINTER`, `DIRECTION_NOT_AXIS`, `TOO_BIG_TWO_WAYS`, `NO_ROOM` (a cut face too thin for the bore and wall) and `BAD_CONNECTOR`, each typed.
- **Exposure**: the palette command and `run_command` (the tool contract regenerated, its overhead checked); a flow step before the last.

## O52 — AM6: split to fit the bed, with dowels or plugs (2026-10-20)

- **`src/print/splitBed.ts`**: `planBedSplit(doc, bodies, {connector, d, length, count?, fit?, wall?})` → `{doc, report}`, and `fitsBed`, AM1's bed-fit rule.
  - **The split**, following O51:
    - the axis that needs it;
    - the fewest even pieces (2–20);
    - the cuts as a chain of `split` features.
  - **The connector points.** The cuts are evaluated once first. On each lower piece's `<id>.cut` face, its triangles and boundary are taken in the plane, and `count` points are spread along its longer extent through its middle. A point not `d/2 + fit + wall` inside is looked for across the face in 1 mm steps.
  - **Then the features again, with the connectors:**
    - dowel bores in both pieces (`hole` from the cut side, Ø d + 2·fit, depth length/2 + fit);
    - a pin per point: a sketch circle on a plane length/2 below the cut, its centre projected into the plane's own frame (for Y, v = normal × xAxis is −Z), extruded `length`;
    - plugs: `union` with the lower piece and a bore in the upper only.
  - **`NO_ROOM`** names the cut, the bore and the room the face has: its deepest point on a 0.25 mm grid. The first message gave the depth at the failing spot, which read as "the face has 2.67 mm" for an 8 × 8 face whose centre has 4.
- **The command `split-bed`** ("Split to fit the bed", modify group) is built from the planner and undone as one change. Its defaults: dowel, Ø6, 20 long, 2 a cut, the process's fit gap (FDM 0.3 mm) and a 2 mm wall.
  - It reaches the agent through `run_command`: `COMMAND_DOCS` has its values, and `tools-v1.json` is regenerated (one line, the command's id; the overhead check passes).
- **Tests** (`test/split-bed.test.ts`, 3), on FDM's 256 mm bed:
  - **The 300 × 40 × 20 bar:**
    - cut at x = 150 into two pieces, each within the bed;
    - connectors at (150, 13.33, 10) and (150, 26.67, 10);
    - **volumes**: the pins π·3²·20 each, to 1e-9; the pieces equal the bar less four bores π(3.3)²(10.3), to 1e-9; the cut alone sums to the bar, to 1e-9;
    - **fit**: every bore face's exact cylinder radius is 3.3 and every pin's 3, so the difference is the fit, 0.3, to 1e-9;
    - **interference**: all six pairs of the two pieces and two pins have no overlap volume by the kernel's intersection.
  - **The fewest pieces, the build axis and plugs:**
    - a 600 mm bar goes into 3 pieces (cuts 200 and 400);
    - a 300 mm tall part is cut along z;
    - **plugs**: two bodies, their volume the bar + 2(π·9·10 − π·3.3²·10.3), to 1e-9, with no overlap.
  - **Refusals:**
    - a 100 mm part: `NOT_NEEDED`;
    - two bodies: `ONE_BODY`;
    - no printer: `NO_PRINTER`;
    - direction (1, 0, 1): `DIRECTION_NOT_AXIS`;
    - a 300 × 300 plate: `TOO_BIG_TWO_WAYS`;
    - an 8 × 8 bar: `NO_ROOM`, "needs 5.3 mm … it has 4";
    - d 0, length −1, count 9, fit 0: `BAD_CONNECTOR`.
- **Found by the full suite:** `test/chat.test.ts` runs every buildable command in a shared two-body context. `split-bed` takes one body, so it gets its own context there: a 300 mm bar on the FDM printer, as `gear-mesh` and `decimate` have theirs.
- **Flow step** (before the last):
  - a 300 mm bar file with the FDM printer, "fit the bed" from the palette, dowel by default;
  - four bodies, the features split, 4 holes and 2 sketch + extrude pairs, the cut at 150;
  - one undo returns the bar.
- **Not in AM6:**
  - splitting two ways;
  - tilted print directions;
  - several bodies;
  - choosing cut positions by feature (the cuts are even).

## O53 — AM7 S0: SDF voxel hollowing with drains (AM7a), then lattices (AM7b) — scope and acceptance frozen (2026-10-20)

Assigned by the coordinator after AM6. **No kernel-core change is needed**, and a probe shows why: a B-rep minus a facet `mesh` body is the kernel's existing `difference`. A 40 mm box less a 20 mm facet cube gives 56 000 mm³ exactly, with one inner shell. So AM7 keeps the part's outside exact and subtracts a voxel-meshed cavity.

### AM7a — hollowing with drains (`src/print/hollow.ts`, the command `hollow`, "Hollow for printing")
- **The field**: the part's body (one body) is sampled on a grid of spacing `h` over its box, padded by 2h, the origin offset by an irrational fraction of h so no node lies on a mesh vertex or face plane.
  - The depth at each node is its distance to the body's surface (point–triangle, triangles binned on a coarse grid of the search radius), signed by ray parity along +X per grid row.
  - The cavity's field is φ = depth − t inside the body.
- **The cavity**: φ > 0, meshed by **marching tetrahedra** (six tetrahedra a cell, no ambiguous cases, a closed manifold mesh). Its components are found by flood fill on the grid.
  - It becomes a `mesh` node (`representation: 'facets'`) whose arrays are blobs, put synchronously by our own SHA-256 (`team/digest.ts`). Its body is subtracted from the part's (`difference`).
- **The drains**, one per cavity component at least (`drains` per component, default 1): at the component's lowest grid point along the print direction, a `hole` of Ø `drain` from the part's bottom side (`side: min` of the up axis), deep enough to reach the cavity (the lowest point's height above the part's bottom + 2h).
  - **Typed refusals:**
    - `ONE_BODY`;
    - `DIRECTION_NOT_AXIS` (AM6's rule);
    - `NOTHING_TO_HOLLOW`: no node deeper than t, the part thinner than 2t everywhere;
    - `GRID_TOO_FINE`: over 4·10⁶ nodes, with the h that fits;
    - `BAD_VALUES`: t, h or drain ≤ 0; h > t/2;
    - `DRAIN_NO_ROOM`: a drain's circle not inside the bottom face.
- **The values**: `t` (the wall, default 2 mm), `h` (the voxel, default t/4), `drain` (Ø, default 4 mm).

**Acceptance (AM7a), with bounds derived, not tuned:**
- **Wall thickness against the target:**
  - **on planar walls**, φ is linear across a cell, so the inner surface is at depth t to 1e-6. Measured from points on the outer faces along their normals to the cavity mesh;
  - **everywhere**, the wall is at least t − h. For a convex part the depth is concave, linear interpolation under-reaches it, and the wall is at least t − 1e-6.
- **A drain reaches every enclosed cavity**:
  - before the drains, the kernel's result has one inner shell per cavity component, and a flood fill of the result's empty voxels from outside finds them enclosed;
  - after, the inner shells are 0 and the flood fill reaches every empty voxel inside the box. The check grid is h_c = drain/4, so a drain is at least 4 voxels across;
  - a part with two separate thick lumps gets two drains.
- **Mass against the closed form:**
  - **a box** a × b × c: V = abc − (a−2t)(b−2t)(c−2t) − Σ π r² t + δ, with 0 ≤ δ ≤ L·h² + 8h³. Here L is the cavity box's total edge length, where the cells straddling an edge cut a sliver of cross-section under h² from the cavity, and 8h³ allows for its corners;
  - **a sphere** of radius R (the kernel's exact sphere): the cavity is within 3·A·h²/(8(R − t)) of 4/3·π(R − t)³, where A is the cavity's area. A tetrahedron's longest edge is √3·h, and a chord's sagitta on a radius ρ is ℓ²/(8ρ);
    - **plus A·δ**, where δ is the body's display-mesh chord tolerance (`chordOf`). The depth is measured to the display mesh, which is the B-rep to within δ. This was added to the S0 before coding;
  - the drains' volume is subtracted as the holes' cylinder within the wall.
- **Exposure**: the command, available on a one-body part, undone as one change; `run_command` (the contract regenerated); a flow step before the last.

- **Two refinements, found in implementation before acceptance and frozen before the tests ran:**
  - **The kernel's mesh Boolean takes up to 16 000 triangles until F3.** The box's cavity had 46 488, refused "Booleans of two large meshes arrive with F3". This is a limit of the kernel lane's, not a change asked of it.
    - The cavity is simplified first by R9's own `decimate` feature, within e = h/50.
    - At a zero bound, 46 488 → 242 triangles, but the polyhedral Boolean refused the result ("touch along an edge"). At 0.01 mm it is 80 triangles and accepted.
    - So e = h/50, raised to h/20 and then h/10 only if the Boolean refuses. Otherwise `BOOLEAN_REFUSED`, typed, says a coarser h.
    - **The bounds take e:**
      - the wall is at least t − h − e;
      - on planar walls, collapses stay in the plane, so the inner surface stays at t;
      - the box's δ widens to [−A·e, L·h² + 8h³ + A·e];
      - the sphere's bound adds A·e;
      - A is the cavity's area.
  - **A drain goes to the middle of its cavity's floor**: of the lowest nodes, the one nearest their centroid. The first run's "lowest node" was the floor's corner.

### AM7b — lattices (a gyroid infill of the cavity)
- **The field**: inside the cavity, a gyroid sheet of cell `L` and thickness `w`: |sin x cos y + sin y cos z + sin z cos x| ≤ k, with k set from w, intersected with the cavity, unioned with the wall.
- **Scope**: frozen in an S0 of its own after AM7a, with its acceptance written then:
  - the lattice connected to the wall (one solid component by flood fill);
  - the cavity still drained;
  - the solid fraction against the gyroid's own numerical fraction for k.

## O54 — AM7a: SDF voxel hollowing with drains, for planar-faced parts; curved bodies wait for the kernel's mesh Booleans (2026-10-20)

- **`src/print/hollow.ts`.**
  - **The field and mesher:** `cavityField` (the depth by point–triangle distance on binned triangles; the sign by ray parity along +X per grid row); `marchingTetrahedra` (six tetrahedra a cell, vertices shared by grid edge, oriented outward); `cavityComponents` (flood fill).
  - **Pieces and checks:** `meshPieces` (connected pieces, union-find); `enclosedVoids` (a flood fill of a body's empty voxels from outside); `planHollow`.
  - **The hot loops** use typed arrays and module-level helpers. The marching state is an object, not a closure.
- **`planHollow` per O53**, for each cavity piece in turn: a facet `mesh` node (its arrays as blobs, hashed synchronously), R9's `decimate` within e, and `difference` from the part. Then a `hole` from the bottom into each cavity's floor.
- **The command `hollow`** ("Hollow for printing"): t 2, h 0.5, drain Ø4 by default. It is in the palette and reaches the agent through `run_command`; `COMMAND_DOCS` has it and `tools-v1.json` is regenerated (one line).
- **Found in implementation, all before the acceptance tests passed; the S0 refinements are written into O53:**
  - **The kernel's mesh Boolean takes ≤ 16 000 triangles until F3.** The cavity is decimated within e = h/50, raised to h/20 and h/10 only if refused, and the bounds take e.
  - **A cavity in two pieces** is refused by the kernel ("open each piece as its own body"), so there is one mesh node a piece.
  - **One irrational offset on every axis** put each row with j = k on the plane y = z, the diagonal of a square face's two triangles. The ray hit their shared edge twice, the parity broke along that row, and the dumbbell's two cavities came out as 22. Each axis now has its own irrational fraction (1/π, 1/e, √2 − 1).
  - **A drain goes to the middle of its cavity's floor**, not its corner.
  - **Curved bodies are refused at once (`CURVED_BODY`).** A curved B-rep less a facet mesh goes through the kernel's analytic Boolean: the sphere ran 457 s and failed ("the result is not a manifold"). Taking a mesh cavity from a curved body needs the kernel lane's F3, so this stopped at the coordinator's line: no kernel change, the question sent to the coordinator.
  - **`chordOf` (A6.3) understates the display mesh's depth on a doubly curved face.** It is an edge's sagitta, and a triangle's middle sits lower. On the R 15 sphere it gives 0.072 mm, and the mesh is 0.144 mm below the sphere. AM7's sphere check measures the mesh's own depth instead.
    - **A follow-up:** A6.3's keep-out band uses `chordOf`, so on spheres and tori its undecided band is too narrow.
- **Tests** (`test/hollow.test.ts`, 3):
  - **A 40 × 30 × 20 box, t 3, h 0.75:**
    - eight probes from the outer faces' middles reach the cavity at 3 to 1e-6;
    - every marching-tetrahedra vertex is at least 3 from the outside;
    - the decimated cavity's walls are at least t − h − e;
    - the drain is at the floor's middle;
    - before the drain, one inner shell and an enclosed void; after, none of either;
    - **mass:** δ = 19.0 mm³, within [−A·e, L·h² + 8h³ + A·e] = [−48.8, 214.2].
  - **The cavity mesher on a sphere** (R 15, t 2.5, h 0.5): 8004.2 against 8181.2 mm³. |Δ| = 177 is within 3·A·h²/(8(R − t)) + A·δ = 297, where δ = 0.144 is the mesh's measured depth. `planHollow` refuses the sphere `CURVED_BODY` in under a second.
  - **A dumbbell** (two 20 mm blocks in plan, joined by a 4 mm bar, extruded 20): two cavities, two drains, no inner shell, no enclosed void.
  - **Refusals:** `NOTHING_TO_HOLLOW` (a 4 mm cube), `ONE_BODY`, `DIRECTION_NOT_AXIS`, `BAD_VALUES` (t 0, h > t/2, drain 0) and `GRID_TOO_FINE` (h 0.01).
- **Flow step** (before the last): a 40 × 30 × 20 block file, "hollow for printing" from the palette with wall 2. It gives mesh, decimate, difference and hole; volume 9009 mm³ against the closed form 9000.9.
- **Waiting:**
  - **curved bodies**, for the kernel's mesh Booleans (F3), or for a decision to mesh the whole part in their case, its outside then approximated;
  - **AM7b (lattices)**, an S0 of its own after this.

## O55 — A6.3's chord tolerance bounded in both directions: a safety fix (2026-10-20)

- **The bug** (found by AM7, O54). A6.3's `chordOf` was an edge's sagitta at a curved face's radius, r(1 − cos π/32). On a doubly curved face, a triangle's middle sits about twice that below the surface.
  - On the R 15 sphere: 0.0722 mm against the mesh's true 0.1438.
  - So the keep-out band was half too narrow. A keep-out could be called **clear** that the true sphere **violates**.
  - A face with no radius, such as a torus, was unbounded: always undecided.
- **The fix** (`src/chat/references.ts`, `chordOf`), bounded from the tessellation's own steps in both directions. The mesh's vertex normals are the surface's.
  - **Each edge's sag** is |c·(nᵢ − nⱼ)| / (4(1 + cos(θ/2))), with θ the angle between its normals. That is exact for a circular arc, and for a cylinder's diagonal, whose axial run adds nothing.
  - **Each triangle's worst depth** is the maximum over the triangle of the quadratic patch 4(λ₁λ₂s₁₂ + λ₂λ₃s₂₃ + λ₃λ₁s₃₁): an edge's middle, or the interior stationary point, from a 2 × 2 solve.
  - The body's δ is the largest over its curved faces' triangles, cached per mesh. A curved face without normals is unbounded. `SEGMENTS_PER_QUARTER` is gone.
- **Tests** (`test/chord.test.ts`, 2), against the exact surfaces, the mesh sampled at 45 points a triangle:
  - **The sphere R 15:** true depth 0.14377; old δ 0.07223, under it; new δ 0.14387, at least the true depth and within 1.5× of it.
    - A keep-out face is placed square to the deepest point's direction, 2 mm off the true sphere. The mesh's gap lies between 2 and 2 + δ.
    - With the required clearance halfway between the old and new δ below the mesh's gap, **the old δ says clear while the true sphere is under the clearance**. The new δ says undecided.
  - **The torus** (R 20, r 5), unbounded before: true depth 0.15004, new δ 0.15008.
    - A box 2 mm above the tube, asking 1 mm, is **clear** (before: undecided).
    - Asking 2 mm, it is undecided.
- **Re-checked:**
  - A6.3's keep-out test (`reference-bodies`): the cylinder's δ is now from its own normals, 0.0240634 against r(1 − cos π/32) = 0.0240766, to 1e-4. The test asserted the old formula to 1e-12 and now asserts the bound. It is still undecided at 5 mm.
  - A8.4's PARTS_TOUCH and EXPECTED_CONTACT (`team-assembly`): unchanged, since boxes and the cylinders' bands are as before.
  - AM7's sphere check now reads 0.1439 from `chordOf` itself.

## O56 — AM7a's exact route first: the kernel's closed shell; the voxel cavity only when it refuses (2026-10-20)

- **The coordinator's design point, adopted:** the outer skin stays exact, and hollowing never turns a B-rep part into a voxel mesh.
- **The route** (`planHollow`, `route: 'auto'` by default):
  - first the kernel's exact closed shell (R11: a `shell` feature of thickness t with nothing opened, shellPart's general shell and offsets). Taken when the result is one body with at least one cavity;
  - else the voxel cavity (O53/O54), with `why` saying what the shell said;
  - **a curved body the shell refuses** is `CURVED_BODY`, the shell's reason attached. It waits on the kernel's mixed facet–analytic Booleans (F3), not on the outer lane;
  - `route: 'voxel'` asks for the voxel cavity; on a curved body it is `CURVED_BODY` at once.
  - The voxel field still places the drains on both routes: a node with φ > 0 is deeper than t, inside the exact cavity too.
- **The report** says the route, `why`, and **the wall measured against t** (`wallOf`, R11.3's way).
  - It is measured from up to about 400 outer-face triangle centroids, inward along the face normal to the next surface, on the hollowed part before the drains, since a drain's wall is not the shell's.
  - On the voxel route the bounds (O53) say the voxel size's effect: t − h − e at worst, t on planar walls.
- **Probes:**
  - the shell takes a box (12 576 = 24 000 − 34·24·14), a sphere (6898.94 = 4/3·π(15³ − 12³)), a torus (8290.47 = 2π²·20·21) and a cylinder with a 1 mm fillet under a 3 mm wall;
  - it refuses a pipe bent at its end: "a closed end of a swept body must be a straight run longer than the wall yet".
- **Tests** (`test/hollow.test.ts`, now 4):
  - **The exact route:**
    - the box is exact: 24 000 − 34·24·14 − π·2²·3 to 1e-9, wall 3 to 1e-5, drained;
    - the sphere's shell is 4/3·π(15³ − 12³) to 1e-9, drained, its wall within 2δ of t;
    - the bent pipe is `CURVED_BODY`, with "the kernel's exact shell refused it: a closed end of a swept body …".
  - **The voxel route, asked:** the box keeps O54's checks, with the route and why reported.
  - **The dumbbell** now takes the exact route: two cavities drained, the wall 2.5 (and 4 across the bar, too thin to hollow).
- **Flow step:** the block now goes shell then hole, its volume the closed form 9000.87 to the panel's 1 mm³.
- **What remains** for the kernel lane's F3, not an outer-lane item: a curved body the shell refuses (a mesh cavity in it needs mixed facet–analytic Booleans).

## O57 — AM7b S0: a gyroid lattice infill — scope, bounds and acceptance frozen (2026-10-20)

Following the coordinator's points: the skin stays exact, the lattice only inside, the bounds derived in advance. **Option B** (the coordinator's): the lattice is a separate mesh "infill" body, and the shell's B-rep is unchanged. A lattice mesh is far past the kernel's 16 000-triangle mesh Boolean, so it cannot be joined to the B-rep. **No kernel change.**

- **The command `lattice`** ("Fill with a lattice", `src/print/lattice.ts`) applies to a part hollowed by `hollow` (O54/O56); otherwise it is `NOT_HOLLOW`.
  - **Its values:** `cell` L (the gyroid's period), `thickness` k (the level band, |G| ≤ k, 0 < k < 1.5) and `h` (the voxel, default L/12).
- **The field:**
  - G(p) = sin X cos Y + sin Y cos Z + sin Z cos X, with (X, Y, Z) = ω(p − o), ω = 2π/L, and o the cavity's lowest corner (its phase);
  - the lattice region is ψ = min(k − |G|, φ_c, ρ_d) > 0, where:
    - φ_c = depth − t is the cavity (O53's field, the exact cavity's depth on both routes);
    - ρ_d = (distance to each drain's axis) − r is the drains, carved from the lattice too so they stay open;
  - it is meshed by marching tetrahedra (O54's).
- **Pieces:** a piece of the lattice not touching the cavity's wall (a loose fragment) is dropped, and the report says how many and how much.
- **The body:** the remaining lattice is a facet `mesh` node named `lattice` (blobs).
  - It is in the part's mass and in its 3MF.
  - It is left out of STEP, which stays the exact part. If that needs more than the export's own body filter, it stops and goes to the coordinator.
- **New drains**: the space left in the cavity (φ_c > 0 and ψ ≤ 0) is flood-filled. A sheet gyroid splits it into two interpenetrating labyrinths. **Each empty component gets a drain** (O54's placement), carved from the lattice and cut as a `hole` in the B-rep.

**Acceptance:**
- **Connected:** the solid (the shell's voxels ∪ the lattice's) is one 6-connected component, and no lattice piece is loose.
- **Drained:** the empty voxels inside the part's box all reach the outside (flood fill), with no inner shell in the B-rep.
- **The solid fraction against the gyroid's own:**
  - f(k) is the fraction of a unit cell where |G| ≤ k, by 10⁶ Halton points (σ ≤ 5·10⁻⁴);
  - on a cavity spanning whole cells (a 30 × 30 × 18 box, t 3, L 6: a 24 × 24 × 12 cavity, 4 × 4 × 2 cells), with no drains, the lattice's volume over the cavity's is f(k) within ε_MT + ε_clip + 4σ;
  - **ε_MT = A·3Hh²/(8·g·V)**: linear interpolation on a Kuhn tetrahedron (circumradius √3h/2) errs by at most H·r²/2 = 3Hh²/8 in the field, H = 3ω² bounds the Hessian of G, and g is the least |∇G| on the surface |G| = k, sampled. A is the lattice's area;
  - **ε_clip = ℓ·h²/V**: ℓ is the length of the lattice's kink against the cavity walls, the edges between its wall triangles and its gyroid triangles, measured on the mesh;
  - with drains, the lattice's volume is less than without, by no more than Σ π r²·(cavity height).
- **Mass:** the part's mass is the shell's B-rep volume plus the lattice body's, with no overlap (the lattice is inside φ_c > 0). It is checked against the kernel's intersection on a coarse case.
- **Refinements, before any code** (working the bounds through):
  - **The band is min(k − G, k + G)**, the same region as k − |G|, written as two smooth level sets;
  - **H = 4ω², not 3ω²**: by Gershgorin, a diagonal entry of G's Hessian has two terms and a mixed one one term;
  - **ε_MT = A·(3ω²h²/2)/(g·V)**. A Kuhn tetrahedron's circumradius² is 3h²/4, and linear interpolation errs by at most H·r²/2 in the field, so the surface moves by at most that over g;
  - **ε_clip becomes ε_mix = N·(h³/6)/V.** N is the number of tetrahedra a surface crosses whose active term changes inside them: at the band's G = 0 kink, or where the band meets the cavity wall or a drain. In those, the true and meshed surfaces both lie within the tetrahedron, so its volume bounds the error. N is counted while meshing, a rigorous replacement for the estimated kink length;
  - **STEP**: the export has no body filter (`stepFor` writes every output), so leaving the lattice out of STEP needs a change in `engine/evaluate.ts`. As frozen, that stops and goes to the coordinator. Until they say, STEP carries the lattice as a faceted body, said in the report.
- **Refusals, typed:** `NOT_HOLLOW`; `BAD_VALUES` (L ≤ 0, k outside (0, 1.5), h > L/4); `GRID_TOO_FINE` (O53's).
- **Exposure:** the command in the palette and `run_command` (the contract regenerated); a flow step before the last.

## O58 — AM7b done: a gyroid lattice infill, its wall vertices on the exact wall, one drain a round (2026-10-20)

The `lattice` command ("Fill with a lattice", `src/print/lattice.ts`) is built as O57 froze it: option B, a separate facet `mesh` body named `lattice` inside a part hollowed by `hollow`'s exact shell, the shell's B-rep unchanged but for the new drains. No kernel change. Four points changed in the building, each from a failure seen:

- **The wall vertices on the wall (`snapToWall`).** Marching tetrahedra puts a vertex at the zero of the *interpolated* min. Where the band is the least term at an edge's inside node and the wall at its outside node, the vertex misses the wall. At L 15, h 2.5 a 24-triangle piece in the cavity's corner floated 0.008 mm off it, and the old keep rule (φ_c ≤ h/2 by the grid) kept it.
  - Now each vertex whose edge's first crossing from its inside node is the wall's moves to the exact root of depth − t on that edge. That root is found by bisection on the exact depth (`depthBins`/`depthAt`, factored out of O53's `cavityField`, which now uses them).
  - The other terms' crossings are linear, each in its own term. The vertex stays ≥ τ from a node (the weld).
  - Topology is unchanged. Every vertex stays on its edge, so the ε_mix argument (the surfaces within the tetrahedron) holds.
- **A piece is kept if it touches the wall**, which means it has a vertex at the exact depth t, to 2τ. Otherwise it is dropped and reported. On the coarse kernel case, every shell–piece pair measures clearance 0 with no overlap.
- **Drains, one a round.** Adding a drain to every undrained region at once gave 13–44 drains on coarse grids. Regions stacked over one another got holes on the same axis, so the second hole cut nothing ("the hole misses the body"). Holes near each other met along an edge.
  - Now each round drains only the largest undrained region, and the flood fill reruns. The new column, carved up through the lattice, drains every region it passes.
  - Its axis is the floor node nearest the floor's centroid that keeps 2r + h clear of every column, and it gets a hole of its own.
  - Failing that, the column goes at the region's lowest node whose column overlaps another's by h. That column is *joined* to the other's drain and gets no hole (`report.joined`).
  - After 64 rounds the refusal is `UNDRAINED`.
- **h at most the drain's radius** (`BAD_VALUES`). A column that holds no grid node drains nothing. This is why coarse grids fragmented.

**Measured (`test/lattice.test.ts`, 12 s; it was 216 s):**
- **Fraction** (O57's case: a 30 × 30 × 18 box, t 3, L 6, k 0.6, h 0.5, no drains):
  - the lattice is 0.38740 vs f(k) 0.38929, |Δ| 0.00189;
  - the bound is ε_MT 0.344 + ε_mix 0.264 + 4σ 0.00195 (87 552 mixed tetrahedra, g 1.328);
  - the bound holds, though as derived it is loose by two orders. The measured error is near 4σ.
- **Filled, the same box with its 3 mm drain:**
  - 2 pieces, 0 dropped, 1 drain added (0 joined), 9391 wall vertices snapped;
  - 253 040 triangles, lattice 2666.9 mm³;
  - the lattice bodies' volumes sum to the report's;
  - the shell is lighter, because the new drain cuts it;
  - each body's voxels at 0.25 mm, OR'd: the solid is one 6-connected component and no empty voxel is enclosed.
  - (One merged triangle soup's parity flipped where the lattice meets the wall: 8 false one-voxel voids. The check ORs per body.)
- **The kernel's intersection** (24 × 24 × 18, t 3, a 6 mm drain, L 12, k 0.8, h 3; 344 triangles, 6 pieces, 8 drains):
  - no pair overlaps;
  - every piece is at clearance 0 from the shell.
  - The kernel's mesh Boolean takes 25–230 s past ~1000 triangles (12 340 triangles: 170 s), so the case is this coarse.
- **Refusals:** `NOT_HOLLOW` and `BAD_VALUES` (including h past the drain's radius).

**Exposure:**
- the command, available on one body hollowed by `hollow`, with defaults cell 8, k 0.6, h 0.5;
- `COMMAND_DOCS` and the contract regenerated;
- the flow step "AM7b" before the last: the AM7a block filled from the palette, the shell first and no fuller.

**STEP, still open for the coordinator:** STEP carries the lattice as a faceted body. Leaving it out needs a body filter in `engine/evaluate.ts` `stepFor`. That is outside this lane until the coordinator says.

## O59 — A6.3 chord tolerance on freeform faces: measured against the exact surface, unbounded until then (2026-10-20)

The coordinator's guard on O55. The edge-sag and quadratic-patch δ is exact at constant curvature along circles: plane, cylinder, sphere, cone, and torus along its circles. On a freeform face (a NURBS or SubD patch) the curvature varies inside a triangle, and the model can undershoot. That is the failure O55 fixed, in a new place.

- **Faces are classified in `bodyMesh`**, which is cheap.
  - `analytic`: a cylinder, or a surface of revolution of a line or an arc (cone, sphere, torus).
  - Any other curved face is `freeform`, with its B-rep faces listed.
- **`chordOf`** keeps the quadratic model for analytic faces. A freeform face counts as unbounded (undecided) until it is measured. A measured one takes the larger of its measured depth and the model's.
- **`measureChords(mesh, brep)`** measures on request, because it costs about 20× the tessellation (a measuring pass in `bodyMesh` made a SubD evaluation 0.5–1.1 s instead of 30 ms). On request it takes 40–360 ms.
  - It re-tessellates the B-rep at the mesh's own quality (`DisplayMesh.quality`, the same triangles).
  - It puts each vertex on the exact surface by Gauss–Newton (warm start, a 24 × 24 grid fallback). It refuses at 10⁻⁷ of the size, which gives Infinity.
  - At 42 points of each triangle (an order-8 barycentric grid) it measures the depth both ways:
    - the surface's point at the interpolated (u, v) to the nearest triangle of the triangle's one-ring;
    - at the 12 order-4 points, also the triangle's point to its nearest on the surface, by Gauss–Newton.
  - The max, times **CHORD_SAFETY = 1.25**. Sampling can miss a peak between points; the worst shortfall measured was 2 % (a SubD cap at one segment a quarter, 0.928 vs 0.946).
  - A placed copy keeps the measurement, because depth is invariant under a rigid move.
- **Callers:**
  - `checkKeepouts` measures each body through `partBreps(doc)` (`measureBody`);
  - the assembly gate does the same for the base part and each instance.
- **Refinements while building:**
  - Measuring against the surface at the interpolated (u, v) alone overstated the depth about 3× (0.43 vs 0.133). An uneven parametrization slides the point sideways. Hence the nearest point, both ways.
  - Measuring against the triangle alone still overstated it on SubD caps near extraordinary vertices (0.39 vs 0.14), because the point lands over a neighbour. Hence the one-ring.

**Measured** on a SubD cube with a corner pulled out 0–80 mm, at 1, 2, 4 and 8 segments a quarter. The truth is the distance to a 64-segment mesh, both ways.
- The plain model undershoots at one segment a quarter: 1.102 vs 1.143 (pull 40), 0.906 vs 0.946 (pull 80).
- The measured δ is never under the truth, and at most 1.53× it.
- **Test** (`chord.test.ts`, pull 40, one segment a quarter): unmeasured, δ is unbounded; the plain 1.10221 is under the truth 1.14317 ± 0.004; measured, δ is 1.42875. A keep-out 10 mm above the body, clearance 1, is measured through the check and decided clear.

## O60 — STEP leaves the lattice infill out, by its role (2026-10-20)

The coordinator's answer to O57's open point. STEP is the exact part. The lattice is a print infill, and it stays in the mass and in 3MF.

- **The role.** A mesh node can carry `role: 'infill'`; `lattice` writes it. The node's body result carries `role: 'infill'`.
  - The filter goes by role, not by name. A later infill kind follows the same rule, and renaming the body changes nothing.
  - The role stays studio-side. The kernel's part document never sees it.
- **`stepFor`** (`engine/evaluate.ts`, studio code) leaves infill bodies out, the part's own and each shown instance's. It returns `omitted: ['lattice infill not included (<keys>); 3MF carries it']`.
  - If only infill bodies remain, it refuses: "Only infill bodies: STEP carries the exact part, and there is none to export."
- **Where the note shows:**
  - the studio's STEP export shows it in its toast. It no longer asks "tessellated or planar?" for an infill body, since none goes out;
  - `cad run --step` lists it under `notes`.
- **3MF and the mass keep it**: `threeMfModelOf` and `massProperties` are unchanged.
- **Test** (`lattice.test.ts`, the coarse case):
  - every lattice piece is infill and the shell is not;
  - STEP has one solid (the shell), with no tessellated entity, and the note names the pieces;
  - with the role taken off, the same document's STEP carries 1 + pieces solids and no note;
  - renamed, the lattice is still left out;
  - 3MF has an object for the shell and each piece; the mass lists every body.

## O61 — DWG/SAT import S0: DWG read deferred, SAT import deferred, DWG write no-go (2026-10-20)

This is research and a decision only, with no product code. The full write-up, with sources, is [`notes/research-dwg-sat-2026-10-20.md`](notes/research-dwg-sat-2026-10-20.md). I read public HTML only. The two specifications exist only as PDFs, named and not read: `OpenDesign_Specification_for_.dwg_files.pdf` (ODA, v5.4.1, R13–2018, "informational use", no implementation grant found) and `sat.pdf` (Spatial's SAT Save File Format).

- **DWG 2D read (drawing or underlay): defer.**
  - Every DWG producer saves DXF, and the free ODA File Converter batch-converts. Our DXF reader and writer exist. No recorded scenario fails for DWG alone.
  - Effort is several weeks: R2000 bit streams, R2004+ compressed sections, R2007's separate encoding, the R2010+ object map, and the entity set. The spec terms need clearing first.
  - Cheaper and nearer the need, each needing its own S0 if wanted:
    - the DXF reader showing SPLINE, ELLIPSE, INSERT/BLOCK and TEXT as an underlay instead of refusing them;
    - a typed `.dwg` refusal that names the routes (save as DXF, or the ODA converter).
- **SAT/SAB solids into the B-rep: defer, no-go for now.**
  - SolidWorks, Inventor and the older ACIS tools all write STEP, which we import.
  - The SAT inside DWG/DXF 3DSOLIDs is AutoCAD's ShapeManager variant (save versions ≥ 20800, Spatial-incompatible, undocumented). It is not the ≤ 700 text the spec covers.
  - The ≤ 700 text is about 1.5–3 weeks in the kernel lane (records, topology, analytic surfaces, procedural splines at their fit tolerance, the STEP gate). If it ever goes ahead, it goes to the kernel lane.
- **DWG writing: no-go.** The R11b DXF writer already reaches every consumer. DWG adds the reader's complexity, plus checksums and AutoCAD's checks on files it did not write, for nothing DXF doesn't deliver.
- **Revisit when**, per item: a recorded scenario where only DWG or SAT exists and conversion is not acceptable; a consumer that takes DWG only; or the owner clearing the ODS terms. Evidence level is L0–L1, with no user data behind the demand side.

## O62 — RM9 S0: continuous collision along a timed joint path, a workspace map, SDF/USD export — scope and acceptance frozen (2026-10-20)

Assigned by the coordinator after O61. There are three items, in this order: the two deterministic ones first, and the exports last, since their external checks need a new install.

**Limits on all three:**
- Our own TypeScript, with no new runtime dependency.
- MuJoCo 3.3.0 (O38's venv `~/.cache/barocss-mujoco`) is a test oracle only, run `python -I`, its readings committed as data beside the case.
- **Nothing new is installed without asking.** RM9c's validators below are asked for, not assumed.
- No chat tool: `tools/list` is unchanged. The exposure is `src/robot/`, the Joints card and the exports.
- A change to the kernel core stops and goes to the coordinator.
- Test names are compared at each checkpoint. The flow runs with `PW_DIR` and `CAD_STUDIO_CHAT_PORT=52391`, its new steps just before the last.

### RM9a — continuous collision along a timed, multi-segment joint path (`src/robot/sweep.ts`, extended)
RM6 certifies one straight joint-space move by conservative advancement. It stops a step before the first contact, within 1e-4 rad. What it lacks:
- a path of several segments;
- time (when along the motion the contact happens);
- the time of contact itself, rather than a certified step short of it.

- **The path**: waypoints `q⁰ … qⁿ`. Each segment is straight in joint space and timed by RD2's profiles (trapezoid or S-curve, synchronised so all joints start and stop together), giving `q(t)`.
  - Its motion bound is RM6's, `|Δp| ≤ Σ_i |Δq_i(t₁) − Δq_i(t₀)| · r_i`, with the joint change over a time step taken from the profile. That change is monotone within a segment, so the bound still holds.
- **Time of impact (TOI)**:
  - conservative advancement to the last certified-free time `t_free`;
  - then bisection between `t_free` and the first sample whose meshes meet (RM6's exact contact test), down to **1e-9 s**;
  - the result: `{ clear, toi?, segment?, links?, values?, minClearance: { mm, t, links }, clearanceProfile: [t, mm][] }`.
  - **No contact is missed**: everything before `toi` is certified by the bound, and the contact at `toi` is exact.
- **Acceptance**:
  - **The 2R arm swung into the post** (RM6's `conformance/rm/sweep-post`, now on a trapezoid profile):
    - the TOI equals the planar separating-axis oracle's contact angle (RM6's, bisected to 1e-12), mapped through the trapezoid's closed-form `q(t)`, within **1e-9 s**;
    - nothing is reported before it.
  - **Two segments**: out clear, then back into the post. The contact is on segment 2 at its oracle time, and segment 1's least clearance equals a dense exact-mesh sampling's within the sampling's own step bound.
  - **MuJoCo, where its geometry is ours**: its mesh geoms collide as convex hulls, so the boxes-only 2R case is used.
    - The trajectory is replayed kinematically (`qpos` set, `mj_forward`, contacts read at 1e-5 s, then bisection).
    - MuJoCo's first contact time equals ours within **1e-6 s**, the readings committed as `oracle.mujoco-3.3.0.json`.
  - **The 6R arm folding** (RM6's case), on an S-curve: the TOI lies within the step RM6 stopped at, its meshes in contact to the tolerance there, and no earlier contact appears in a 2000-sample exact check.
  - **Bench**: the 6R case within 2× RM6's 225 ms.
- **Where**: the Joints card's **Check path** takes the waypoints recorded (the solved pose, then each "Add waypoint") and shows the TOI in seconds and the clearance along the path.

### RM9b — a workspace map (`src/robot/workspace.ts`)
- **What**: the positions a tool point reaches over the joint ranges (limits where they are set, else [−π, π]; slides over their limits, required).
  - Joint values come from a Halton sequence (deterministic). FK gives the tool point (RM2).
  - The points go into voxels of size `h`. Each voxel holds its count, the best manipulability seen, `w = √det(J Jᵀ)` (RM7's Jacobian, its position rows), and whether any pose there is free of self-contact (RM6's exact test, optional).
- **The result**: occupied voxels with `w`, the bounding box, the farthest reach, and the sample count. In the studio it is shown as a point cloud coloured by `w`.
- **Acceptance**:
  - **Planar 2R, closed form** (l₁ 80, l₂ 50, no limits):
    - every occupied voxel's centre is within `h√3/2` of the annulus 30 ≤ r ≤ 130;
    - every voxel wholly inside the annulus is occupied after N = 10⁵ samples (the miss chance per voxel is stated and below 1e-9);
    - the occupied area is within the boundary band's area of π(130² − 30²);
    - `w` at each sample equals `l₁ l₂ |sin θ₂|` to 1e-9.
  - **Limits**: the 2R with θ₂ ∈ [0, π/2] gives its closed-form region, by the same occupancy tests.
  - **6R (arm-6r)**:
    - the farthest reach equals the chain's straight-arm length within `h`;
    - no voxel lies past it;
    - `w` is zero (≤ 1e-9) at the straight pose.
  - **Self-contact filter**: on the 6R, poses the exact test finds in contact are excluded, with a count. A pose sampled in contact and checked against RM6's mesh test agrees.
  - Deterministic: the same inputs give the same map, byte for byte.
- **Where**: "Workspace" in the Joints card (N, h, the tool point), with the cloud shown and a JSON download.

### RM9c — SDF and USD export (`src/robot/sdf.ts`, `src/robot/usd.ts`)
The same model as URDF and MJCF (RM4, RM5): links with RM3's inertia about the centre of mass, visual and collision meshes, joints with axes, limits and gear couplings.
- **SDF**: SDFormat 1.11 (sdformat.org/spec, HTML).
  - `<model>` with `<link>` (`<inertial>` with `<pose>`, `<mass>`, `<inertia>`), `<visual>` and `<collision>` (`<mesh><uri>` to an STL beside it), and `<joint>` (revolute, prismatic, fixed; `<axis><xyz expressed_in>`, `<limit>`).
  - Poses relative to frames by `relative_to`, the SDF 1.7+ frame semantics (the tutorial "Specifying model kinematics").
  - A gear follower as a `<joint type="gearbox">`, or noted when the pair does not fit gearbox's form.
  - RM8's loop as a second joint closing it (SDF allows a graph), checked by our reader.
- **USD**: `.usda` text with the UsdPhysics schema (OpenUSD's, documented in HTML).
  - An `Xform` per link with `PhysicsRigidBodyAPI` and `PhysicsMassAPI` (`physics:mass`, `physics:centerOfMass`, `physics:diagonalInertia` with `physics:principalAxes`, from RM3's eigen-decomposition).
  - Meshes as `Mesh` prims (points, faceVertexIndices) under each link.
  - `PhysicsRevoluteJoint`, `PhysicsPrismaticJoint` and `PhysicsFixedJoint` with `body0`/`body1`, local frames, axis and limits (degrees, as UsdPhysics takes them).
  - `PhysicsArticulationRootAPI` on the root.
  - Units: `metersPerUnit = 0.001`, `kilogramsPerUnit = 1`, `upAxis = "Z"`.
- **Acceptance, ours** (deterministic, now):
  - our readers of both take the files back to the same tree: link names, masses to 1e-12, inertia tensors to 1e-12 relative, axes, limits;
  - FK from each file's frames equals RM2's at 100 random poses to 1e-9 mm;
  - URDF, MJCF, SDF and USD of arm-6r agree with one another on every one of those numbers;
  - RM4/RM5's files are byte-identical.
- **Acceptance, external**: **pending the owner's go-ahead to install**, asked here and not assumed.
  - **USD**: `usd-core` (Pixar's pip package, Apache-2.0-style licence) in the venv. `Usd.Stage.Open` without errors; `UsdPhysics`' own parser (`LoadUsdPhysicsFromRange`, OpenUSD 24.11+) reads the bodies and joints, and its masses, frames and axes are compared with ours.
  - **SDF**: libsdformat's validator (`gz sdf -k`, or the `sdformat` Python bindings). The file passes, and its parsed model's poses and inertias are compared.
  - MuJoCo reads neither, so it is not an oracle here.
- **Where**: "Export SDF" and "Export USD" beside URDF/MJCF in the Joints card, as files (with their STLs, or as a zip, as the URDF export does).

**Order and checkpoints**: RM9a, then RM9b, then RM9c (ours), then RM9c (external) on the owner's go-ahead. Each one is checkpointed with the kernel conformance count, the studio count with test names compared, and the flow count.

## O63 — a DWG refused, typed, with its routes (2026-10-20)

The coordinator's pick of O61's two cheaper items. The DXF underlay waits for its own S0.

- **Content, not the filename.** `readDxfSketch` checks the first six bytes for AutoCAD's version tag (`AC10xx`) and refuses with `DWG_NOT_READ`. The message names the release (AC1009 R11/R12 … AC1032 2018, otherwise the tag) and the two routes:
  - Save As → DXF from the program that made it;
  - the free ODA File Converter (one file or a folder at once), then add the DXF.
- This covers the Drafts panel's "Add drawing" (it now also accepts `.dwg`, so the refusal is reached), the agent's `import_drawing`, and the CLI.
- **Opening a `.dwg` as a model** gives the same refusal in a toast, and the part is unchanged.
- **Test** (`drafts.test.ts`):
  - a DWG header is refused `DWG_NOT_READ` with "AutoCAD 2018", "Save As → DXF" and "ODA File Converter", and the state is unchanged;
  - the release lookup works, including an unknown tag;
  - a DXF is never mistaken for a DWG.

## O64 — RM9a: continuous collision along a timed, multi-segment path; the time of impact to 1e-11 s (2026-10-20)

Built as O62 froze it (`src/robot/ccd.ts`, on RM6's `sweepPath`).

- **Timing**:
  - each segment is straight in joint space and runs one normalised profile u(t) over distance 1. Its limits are the tightest joint's: v′ = minᵢ vᵢ/|Δqᵢ|, a′ likewise, and j′ for the S-curve. Every joint starts and stops together, and none passes its own limit;
  - u is monotone, so a segment's path in s = u(t) is RM6's straight move;
  - `timeAt` inverts u by bisection to the double's precision (checked against the trapezoid's own closed-form inverse to 1e-12).
- **The time of impact**:
  - `sweepPath` takes a `tolerance` (RM6's default stays 1e-6 mm); RM9a uses 1e-9 mm;
  - each advancement step keeps the clearance at or above it, so the first sample where it is reached *is* the first time it is, to the step's 1e-12 in s. That s maps to time.
  - The bisection the S0 planned is not needed: the advancement already brackets the contact from below.
  - Also returned: the clearance profile [t, mm] (from `sweepPath`'s new `trace`), the least clearance with its time, and the segments' timing.
- **Found and fixed (RM6 too)**:
  - `meshDistance` measured every triangle pair, though its comment said "boxes first". At the tight tolerance, the contact pair's last steps are each a full mesh distance (about 60 ms on the 6R): 2.25× RM6's time with the same 45 samples.
  - A pair whose boxes are as far apart as the best found is now skipped. A box gap is never more than its triangles' distance, so the results are identical.
  - RM6's 6R fold went from 232 ms to **6 ms**, with the same contact s, and RM9a's takes **13 ms**.
- **Evidence** (`test/robot-ccd.test.ts`, 5 tests; `conformance/rm/ccd-post`):
  - **2R into the post on a trapezoid** (v 1, a 2): the TOI is 1.131635311870 s against the separating-axis angle through the trapezoid's closed form, 1.131635311896 s, |Δ| **2.6e-11 s**. Every earlier clearance is above the tolerance.
  - **Two segments** (out −π/2, then to 2 rad): the contact is on segment 2 at the oracle's 4.773227965 s, within 1e-9. Segment 1's least clearance, 5.000000 mm, equals a 400-sample dense exact one over the same pairs.
  - **MuJoCo 3.3.0** (`scripts/ccd-oracle.py`, kinematic replay of its own closed-form trapezoid, ccd_tolerance 1e-12, a scan every 1e-4 s then bisection): first contact `post_collision–a_collision` at 1.1316353212 s against ours 1.1316353119 s, |Δ| **9.3e-9 s** (acceptance 1e-6). The reading is committed as `oracle.mujoco-3.3.0.json`.
  - **6R folding on an S-curve**: the TOI's s equals RM6's contact within 1e-4. No contact appears in 2000 exact samples before it, and the meshes are within 1e-6 mm at it. 13 ms against the S0's budget of 2 × 225 ms.
- **Where**:
  - the Joints card gets **Add waypoint** and **Clear waypoints**;
  - **Check path** runs the timed path from the solved pose through the waypoints to the sliders'. Each joint's velocity limit is used where set, else 1 rad/s or 100 mm/s, and that is said. Acceleration is twice that per second.
  - It shows "Contact A – B at N % of the move, t T s (segment k of n)", or "Clear: the whole move certified, T s …; least clearance … at t …". RM6's wording is kept, and its flow step is unchanged.
  - The `sweep_path` tool is unchanged (RM6's straight move); `tools/list` is unchanged.
- **Flow**: a step "RM9a" just before the last. The ccd-post arm is moved out to a −90° waypoint and then to 2 rad, and Check path reports the contact with the post at t 4.773 s on segment 2 of 2.

## O65 — RM9b: a workspace map — the 2R annulus by exact set relations, the 6R's reach, the contact filter agreeing with RM6 (2026-10-20)

Built as O62 froze it (`src/robot/workspace.ts`; `toolProbe`/`probeAt` added to `src/robot/ik.ts`).

- **Sampling**:
  - joint values from a Halton sequence (the first primes as bases), over each joint's limits, else [−π, π] for a turn. A slide without limits is refused `NO_RANGE`, and bad values `BAD_VALUES`;
  - the tool point by FK into voxels of h, each with its count and best manipulability;
  - the farthest reach is measured from the first moving joint's axis point;
  - voxels are sorted by position, so the same inputs give the same map byte for byte.
- **Manipulability**:
  - w = √det(J Jᵀ) of RM7's position Jacobian (m per rad), or √det(Jᵀ J) when fewer joints than its three rows, so a planar 2R gives l₁l₂|sin θ₂|;
  - the 2×2 or 3×3 determinant is taken directly, not as a product of Jacobi eigenvalues, for accuracy near singular poses.
- **Self-contact filter** (optional): a pose is left out when two links (not parent and child, through RM6's `partParent`) interpenetrate, by GJK on the hulls, then RM6's exact `meshesMeet`.
- **Evidence** (`test/robot-workspace.test.ts`, 4 tests):
  - **planar 2R** (80, 50; 10⁵ samples, h 5), against the annulus 30 ≤ r ≤ 130:
    - every occupied cell meets it, every cell wholly inside is occupied, so inside 1884 ≤ occupied 2123 ≤ meeting 2140;
    - each occupied centre is within h√3/2 of it;
    - the occupied area is within the boundary band of π(130² − 30²);
    - the least expected count per cell is 31.7, so random sampling would miss a cell with chance e^−31.7 ≈ 2e-14, and Halton missed none;
    - the reach is 130 to 1e-9;
    - w equals 0.08·0.05·|sin θ₂| m² to 1e-9 relative, and r equals the law of cosines, at 200 poses;
  - **the elbow limited to [0, π/2]**: its annulus √(80² + 50²) ≤ r ≤ 130 by the same relations (832 ≤ 1168 ≤ 1192). Refusals typed;
  - **6R (arm-6r)**, 20 000 samples, h 20:
    - reach 285.0 mm against the straight arm's 286.4, within h, and nothing past it;
    - w at the straight pose 1e-34;
    - deterministic;
  - **the filter on the 6R** (300 poses): 143 left out, exactly the poses RM6's mesh test, run pair by pair, finds in contact.
- **Where**:
  - the Joints card gets **Workspace** (N 20 000, h 10 mm, "contact-free" optional). The tool point is the end link's tip: its farthest hull point from its joint at the solved pose;
  - a summary line (poses, voxels, reach, best w), **JSON** download and **Hide**;
  - the viewport draws the voxels as small squares in eight bands of w (blue low, red high), one SVG path a band;
  - `tools/list` is unchanged.
- **Flow**: a step "RM9b" just before the last. The RM9a arm's workspace is mapped from the card, its summary read, the bands drawn, then hidden.
- **Flakes seen in this checkpoint's runs** (the machine at load average 36–37 from other sessions):
  - `hollow.test.ts` "a curved body refused at once" missed its 1 s wall-clock guard once in the full suite (649/650). Rerun alone it passes (4/4). The guard is a proxy for "no mesher ran"; it is left as is and recorded here.
  - One flow run died on a screenshot timeout at step 1531 while the UI sources were being edited (a dev-server reload). The clean rerun passes, 187/187.
  - The render-source cascade (steps 48–55) did not recur.

## O66 — RM9c: SDF 1.11 and USD (UsdPhysics) export; our readers and the four formats agree; external validators pending (2026-10-20)

Built as O62 froze it (`src/robot/sdf.ts`, `src/robot/usd.ts`, readers in `src/robot/modelCheck.ts`), on the same parts as URDF and MJCF (`robotParts`). URDF and MJCF themselves are unchanged.

- **SDF**:
  - each `<link>` has its pose `relative_to="__model__"` (x y z and URDF's rpy), `<inertial>` with the centre of mass as its pose, the tensor in the link frame, and the mesh and hull as STL `<uri>`;
  - each `<joint>` is at its child's frame (`<pose>0 0 0 0 0 0</pose>`), its axis in the child frame, limits in rad or m;
  - a gear follower is `<axis><mimic joint>` with multiplier, offset and reference 0 (SDF 1.11, follower = m·(leader − ref) + offset, read from sdformat.org's HTML);
  - RM8's loop is a `ball` joint between its two links at the pin, since SDF allows a graph.
- **USD** (`.usda`):
  - the root Xform has `PhysicsArticulationRootAPI`;
  - each link is an Xform beneath it (flat: each its own rigid body) with `PhysicsRigidBodyAPI` and `PhysicsMassAPI`: mass, `centerOfMass`, and `diagonalInertia` about `principalAxes`, the eigen-decomposition of RM3's tensor made right-handed;
  - its frame is a `matrix4d xformOp:transform` (USD's row vectors);
  - its mesh is a `Mesh`, and its hull a `Mesh` with `PhysicsCollisionAPI` (approximation `convexHull`, purpose guide);
  - each joint is a `PhysicsRevoluteJoint`, `PhysicsPrismaticJoint` or `PhysicsFixedJoint` (body0 the parent, body1 the child, localPos0/localRot0 the child's frame in the parent's, axis "Z"), with limits in degrees or metres;
  - a loop is a `PhysicsSphericalJoint` excluded from the articulation.
  - What UsdPhysics has no attribute for (a gear coupling, effort and velocity limits) is kept as `barocss:` custom attributes, and the notes say so.
  - **One change from the S0**: `metersPerUnit = 1` (SI, as the other three formats), not 0.001, so all four carry the same numbers without a conversion.
- **Our readers**: `readSdf` (`parseXml` gained `{ text: true }`, since SDF keeps its values in element text) and `readUsda` (the prims RM9c writes). They feed one model and its FK, which composes each child at its parent's pose with their home relative frame and then its motion about its axis. That is a different composition from RM2's.
- **Evidence** (`test/robot-sdf-usd.test.ts`, 3 tests):
  - **arm-6r**:
    - both read back to the same links and joints (names, types, parents, children);
    - URDF, MJCF, SDF and USD agree on every link's mass, centre and inertia to **1.9e-16** (USD's tensor rebuilt from its principal frame), and on every axis and limit;
    - the MJCF is byte-identical to the frozen `conformance/rm/arm-6r/robot.xml`.
  - **FK at 100 poses**:
    - arm-6r: SDF 2.2e-13 mm, USD 1.4e-13 mm;
    - the gear pair (SDF's `<mimic>`, USD's custom attributes, noted): 2.8e-14;
    - the slide chain: 7.1e-15 (`prismatic`, limits ±0.02 m).
    - All are within the acceptance of 1e-9 mm.
  - **The four-bar**:
    - its loop is one ball joint (SDF) and one spherical joint outside the articulation (USD);
    - the pin's local points in both links equal RM8's pin to 1e-12;
    - the loop is not noted as left out;
    - the tree's FK is unchanged.
- **Where**: **Export SDF** (a zip of robot.sdf and its meshes) and **Export USD** (one .usda) in the Joints card. Both close each planar loop at its pin, as the chat's MJCF does. `tools/list` is unchanged.
- **External validators.** The owner's go-ahead was relayed on 2026-10-20: "RM9c 검증용으로 usd-core와 SDFormat 검사기를 ~/.cache 검증용 가상환경에만 설치해도 돼. 제품 의존성으로는 쓰지 말고."
  - **USD: usd-core 26.8**, in its own venv `~/.cache/barocss-usd` (uv, Python 3.12.9), installed `--require-hashes` from `requirements.txt` there.
    - The wheel is `usd_core-26.8-cp312-none-macosx_10_15_universal2.whl`, sha256 `aaf1a68bf4c7ab959b9f4d3a6e0ef9347ff6135a1452676bb40916060146c53e` (PyPI's published digest). No transitive dependency landed (`uv pip freeze`: usd-core==26.8 alone). Its licence is Pixar's TOST-1.0.
    - Nothing went into the repo, the system Python or Homebrew. It is run `python -I` with the file as an argument.
    - `scripts/usd-oracle.py` opens each frozen stage (`conformance/rm/arm-6r/robot.usda`, `four-bar/robot.usda`) with OpenUSD (no composition errors) and reads it with UsdPhysics' own parser (`LoadUsdPhysicsFromRange`) and MassAPI.
    - The readings are committed as `oracle.usd-core-26.8.json`. The frozen `robot.sdf` files sit beside them, for the SDF check.
    - **Compared** (`robot-sdf-usd.test.ts`, test 4):
      - arm-6r: 7 rigid bodies and 6 revolute joints, body0/body1, axis Z, one articulation 7/6. Frames to **8.3e-9 m** and mass properties to **4.0e-8** relative.
      - four-bar: 4 bodies, 3 revolute joints and the loop as a `SphericalJoint` excluded from the articulation. Frames to 3.7e-8 and mass properties to 3.9e-8.
      - SI metadata, Z up.
      - The frame bound is 1e-7. UsdPhysics' descriptors are single precision (GfVec3f, GfQuatf) though the file's matrix4d is double: 2⁻²⁴ of 0.3 m is 2e-8.
  - **SDF: libsdformat is not on PyPI.** The package named `sdformat` there (0.23.2, GPL) is a third-party interface, and sdformat.org's XSDs are unversioned, so neither is a 1.11 check. libsdformat ships via conda-forge, Homebrew's osrf tap or apt. **External SDFormat validation: declined by the owner** (relayed 2026-10-20): "SDFormat은 micromamba로 설치하지 말고 자체 리더와 구조 검사로만 검증해." RM9c's SDF acceptance is therefore our reader's round trip, FK at 100 poses, and the four formats agreeing. The third-party PyPI `sdformat` and the unversioned XSDs are not used as a stand-in.
    - **Historical note only**: the micromamba route that was asked about and declined. It was never run, and its conda-forge names and pins were never confirmed.

          mkdir -p ~/.cache/barocss-micromamba
          curl -Ls https://micro.mamba.pm/api/micromamba/osx-arm64/latest | tar -xj -C ~/.cache/barocss-micromamba bin/micromamba
          MAMBA_ROOT_PREFIX=~/.cache/barocss-micromamba ~/.cache/barocss-micromamba/bin/micromamba create -y -p ~/.cache/barocss-sdformat -c conda-forge --override-channels python=3.12 libsdformat15=<pin>
          ~/.cache/barocss-sdformat/bin/gz sdf -k packages/barocss-cad/conformance/rm/arm-6r/robot.sdf   # (or the bindings' parser, python -I)

      (Declined: nothing installed, no reading.)
- **Flow**: a step "RM9c" just before the last. The ccd-post arm is exported as SDF (the zip holds robot.sdf and the meshes, and python's zipfile reads the SDF: version 1.11, base_to_a continuous) and as USD (the articulation root, base_to_a a revolute joint, the post an Xform).

## O67 — a table with no room: a verified sheet or scale fix, else said so; the A4 cut list clears (2026-10-20)

The kernel lane's FR4b follow-up (D128). On A4 the 166 × 45 mm cut-list table, auto-placed, landed on the right view's name. R14 reported TEXT_OVERLAP with no fix, so Fix all could not clear it.

- **Why no placement could fix it.** At 1:20 the views and their names take about 120 × 116 mm of an A4 drawing area of about 267 × 150 mm. Side by side with the 166 mm table they need 286 mm of width; stacked, 161 mm of height. Neither fits, wherever the views, the view names or the table's corner go.
  - So O50's search, which already covers the whole frame in 5 mm steps, correctly finds nothing.
  - Splitting the table's rows does not narrow it. Splitting its columns needs two 83 × 45 rooms, and A4 has one.
- **The fix** (`issues.ts`):
  - an issue context can now `rebuild` its sheet for other settings;
  - a table with no room where it is tries, in order:
    1. A3 at the views' current scale;
    2. A3 at its own scale;
    3. each smaller standard scale on this sheet.
  - Each is built again, and the first whose sheet leaves the table clear (no TEXT_OVERLAP, TEXT_OVER_LINES or OFF_SHEET on it) is the fix. A fix is never offered that has not been checked.
  - The search is cached per sheet and table, and takes 9 ms on the frame.
  - When nothing clears it, the issue says so: "Nothing clears it: the table has no room on this sheet, on A3 or at a smaller standard scale; make it smaller or show fewer views."
  - The fix button reads "A3", or the scale (e.g. 1:1), instead of "Auto scale" for a set scale.
- **Evidence**:
  - **`frame-acceptance.test.ts` (the kernel lane's), updated as asked.** On A4 the cut list's overlap now carries `{ scale, sheet A3, scale 0.05 }`, and Fix all ends on A3 with nothing left on the table. Before, the pinned expectation was `[TEXT_OVERLAP, no fix]`.
  - **`drawing-table.test.ts`**, a new test on the L-bracket:
    - a 156 × 40 table on A4 gets A3 at 1:1, which clears it;
    - a 190 × 50 table on A3 at 2:1 gets 1:1, which clears it;
    - a 495 mm table gets no fix, and its message says nothing clears it;
    - a context without `rebuild` guesses no fix.
  - The R14 drawing-issues fixtures are unchanged.

## O68 — the DXF underlay S0: splines, ellipses, blocks and text shown as reference, regions as before — scope and acceptance frozen (2026-10-20)

O61's cheaper DWG item, assigned by the coordinator after O67. A DXF drawing's SPLINE, ELLIPSE, INSERT/BLOCK, TEXT and MTEXT become a **reference underlay** on the imported sketch instead of refusing the file. This is our own TypeScript, with no new dependency. ezdxf 1.4.5 (O1's venv `~/.cache/barocss-ezdxf`) is a test oracle only, run `python -I`.

- **Regions unchanged.** The profile import stays exact, from the top-level LINE, ARC, CIRCLE, LWPOLYLINE and POLYLINE, as O28 reads them now. Geometry inside a block, and every new entity kind, goes to the underlay only. The underlay **never** becomes a region, a hole, a sketch entity or a draft dimension.
- **The underlay** (`src/sketch/dxfUnderlay.ts`):
  - polylines and texts in the sketch plane, in mm, stored on the draft's sketch node as `underlay: { polylines: [x, y][][], texts: { at, text, height, angle }[], left?: Record<type, { count, why }> }`;
  - drawn thin and grey under the sketch, not pickable, with a "Hide underlay" toggle.
  - **SPLINE**: degree, knots, control points and weights (rational when given), evaluated by de Boor in our own code and flattened to a chord tolerance of **0.01 mm**. A spline with fit points only (no control points) is left out and listed, not refused: its interpolation is the writer's, and guessing it would put a wrong curve on screen.
  - **ELLIPSE**: centre, major axis, ratio and the parameters 41/42, flattened to the same tolerance.
  - **INSERT/BLOCK**:
    - the block's entities through the insert's transform `T(insertion) · R(rotation) · S(sx, sy) · T(−base point)`, nested to any depth (a cycle is refused typed);
    - MINSERT columns and rows as repeats;
    - the insert's OCS: an extrusion of (0, 0, −1) mirrors X, the arbitrary-axis algorithm for that one case;
    - non-uniform and mirrored scales are taken by transforming the flattened points, which is exact for points, so an arc under (2, 1) is the ellipse it becomes;
    - LINE, ARC, CIRCLE and LWPOLYLINE inside blocks go to the underlay too.
  - **TEXT and MTEXT**: insertion point (TEXT's alignment point when it has one), height, rotation and the plain string. MTEXT's inline codes are stripped (`\P` a new line; `\f…;`, `\H…;`, `{}` and the rest dropped), as ezdxf's `plain_text()` does.
  - Entities off the XY plane (other than OCS −Z) are still refused, as now. A file with only underlay geometry imports as a sketch with no region: an underlay to trace over, said so.
- **Acceptance**:
  - **Fixtures** are written by a script with ezdxf (`scripts/dxf-underlay-fixtures.py`, outside the product) and committed under `conformance/a64/underlay/<case>/` (subfolders, as for R14):
    - a spline set: cubic, a rational quadratic arc, a clamped quintic;
    - ellipses: full, partial, and with a tilted major axis;
    - nested blocks: three deep, scaled (2, −1), rotated 30°, mirrored by the OCS, a MINSERT 3 × 2;
    - TEXT and MTEXT: rotated, aligned, MTEXT with codes;
    - a plate whose regions sit beside an underlay.
  - **Counts**: the underlay's entities by type, after block expansion, equal ezdxf's (its `virtual_entities` recursively).
  - **Coordinates**:
    - SPLINE points at 64 parameters equal ezdxf's own `BSpline.point(t)` to 1e-9 mm;
    - ELLIPSE points at their parameters equal the closed form and ezdxf's to 1e-9;
    - block transforms against the closed form written in the test from the fixture's numbers. Every flattened vertex of a circle inside the nested, scaled, mirrored blocks satisfies the ellipse equation of its composed transform to 1e-9, and each insert's origin is where the composed matrix puts it;
    - TEXT and MTEXT position, height, rotation and plain string equal ezdxf's (`plain_text()`).
  - **Flattening**: every chord is within 0.01 mm of the curve, by dense evaluation (1000 points a span).
  - **Never regions or dimensions**: for each fixture, the regions, holes and draft dimensions equal those of the same file with its underlay entities deleted, deep-equal.
  - The ezdxf readings are committed as data (`oracle.ezdxf-1.4.5.json`), as O1's are.
- **Exposure**:
  - `import_drawing`'s result adds `underlay: { by type: count }` and `left_out`, a compatible addition, with the contract regenerated;
  - the Drafts toast says what came in as underlay;
  - a flow step just before the last: a DXF with a block and a spline imported, its underlay drawn, its regions as before.

## O69 — the DXF underlay: splines, ellipses, blocks and text to trace over, against ezdxf and closed forms (2026-10-20)

Built as O68 froze it and the coordinator accepted (`src/sketch/dxfUnderlay.ts`; the profile reader `dxfRead.ts` sends these kinds there). Fixtures are in `conformance/a6/underlay/<case>/`, beside A6's `drawings/`, as the coordinator asked: not "a64".

- **The profile is unchanged.** Regions and holes come from the top level's LINE, ARC, CIRCLE, LWPOLYLINE and POLYLINE, as before. SPLINE, ELLIPSE, INSERT, TEXT and MTEXT are skipped there and read by the underlay. TEXT and MTEXT are no longer "left out", since they are shown. DIMENSION, HATCH and the rest stay left out.
- **The underlay reader**:
  - SPLINE by our de Boor (rational with its weights), each knot span flattened on its own;
  - ELLIPSE by its parameters (the minor axis is the major turned a quarter, times the ratio);
  - both are flattened so that the points at ¼, ½ and ¾ of a chord are within half of 0.01 mm. The first run, at the full tolerance, let a spline's chord reach 0.01024 mm under the dense check; now chords are within 5.0e-3;
  - INSERT through `T(insertion)·R(rotation)·[MINSERT cell offset]·S(sx, sy)·T(−base)`, nested, with a cycle refused, and OCS (0, 0, −1) as a mirror of X. The tolerance is divided by the map's largest stretch;
  - a circle or arc under a non-similar map is counted ELLIPSE, as ezdxf makes it;
  - TEXT at its alignment point when aligned; MTEXT's direction (11/21) or rotation, its codes stripped as `plain_text()`;
  - fit-points-only splines are left out with the reason.
- **Where it lives** (one change from O68's "on the sketch node"): `doc.underlays`, each with an id, name, plane, its draft and `hidden`.
  - A file with curves but no closed profile is an underlay alone (no sketch, no dimensions, `draft: null`), and it has no sketch to hang on.
  - Text alone is still DXF_EMPTY.
  - Confirming a draft's width scales its underlay with its sketch.
  - The field is in `STUDIO_DOC_FIELDS`. The evaluation key leaves it out, so hiding an underlay never re-evaluates.
- **Exposure**:
  - `import_drawing` returns `underlay` counts and `left_out` (including fit-only splines), or `draft: null` with a note;
  - its description is updated. The frozen tool contract is unchanged, and its tests pass;
  - the Drafts panel lists each underlay with Hide/Show;
  - the viewport draws the underlays grey in its overlay (one path each, texts turned and sized by projection, every MTEXT line), not picked;
  - the toast says what came in as underlay.
- **Changed expectations** (A6.4's `drafts.test.ts`, on purpose):
  - the inches drawing's TEXT moves from `left_out` to the underlay;
  - `refuse-spline.dxf` (a LINE and a fit-only SPLINE) is now DXF_OPEN rather than DXF_UNSUPPORTED, and its message says the spline is shown as underlay only, because a profile takes lines, arcs and circles.
- **Evidence** (`test/dxf-underlay.test.ts`, 6 tests). ezdxf 1.4.5 wrote the fixtures from known numbers and read them back (`scripts/dxf-underlay-oracle.py`, readings committed as `oracle.ezdxf-1.4.5.json`).
  - **Splines** (cubic, rational quadratic, quintic, one fit-only):
    - degree, knots, control points and weights are as ezdxf reads them;
    - points at 64 parameters match `BSpline.point` to **2.9e-14 mm**;
    - the rational arc's vertices lie on its circle to 1e-9;
    - chords are within 5.0e-3 mm by dense evaluation;
    - the fit-only spline is listed.
  - **Ellipses**: points match `ConstructionEllipse.vertices` to **1.4e-14**; ends at the parameter ends; chords within 5.0e-3.
  - **Blocks**:
    - counts equal ezdxf's expansion: CIRCLE 7, ELLIPSE 1, LINE 8;
    - every circle vertex and line end is on its closed-form composed transform to **6.9e-14**, covering three deep, (2, −1) scale, rotations, the OCS mirror and the 3 × 2 MINSERT;
    - ezdxf's own expansion matches the same closed form.
  - **Texts**: positions to 1e-12, heights, rotations to 1e-9, and MTEXT's plain string equal to ezdxf's.
  - **Plate**: regions and holes deep-equal those of the same file with its SPLINE, TEXT and INSERT deleted; the underlay's counts match.
  - **The tool**:
    - the plate's underlay comes with draft F1 and is doubled with a 200 mm width;
    - a splines-only file is an underlay alone with no node;
    - a text-only file is DXF_EMPTY.
- **Flow**: a step "O68" just before the last. The plate DXF is added from Drafts: one node with its hole, the underlay drawn (with the note's text), hidden and shown.
  - Its first run found the viewport's group and the Drafts list item both labelled "Underlay U1". The drawing is now "Underlay drawing U1"; the rerun passes, and the flow is 192/192.
- **Test names**: two A6.4 tests in `drafts.test.ts` are renamed with their changed expectations (the inches drawing's text; refuse-spline), so the name comparison shows them as replaced.

## O70 — RB9 S0: the AI scenario ladder's deterministic harness — rungs, predicates, sampling, mutants, metrics; live trials pending (2026-10-20)

Assigned by the coordinator after O69 (README §4 RB9). There are 13 rungs, plus the owner's 2-axis robot arm as rung 14 (README "AI scenario ladder").

The harness extends A5.5's (`server/ab`, `pnpm ab`), whose 10 briefs hold fixed variants and bbox/volume/solids oracles. It becomes `pnpm rb9`:
- each rung has a **parameter sampler** (seeded, so trial k of rung n is reproducible), a **hidden checker**, a **scripted ideal agent** built from the sampled parameters, and **mutants**;
- the checker runs on the final document after the agent stops. It is never sent to the agent, nor written to its prompt, tools or files; the agent sees only the brief in words;
- it may compute anything our kernel and studio code computes, not only `check_spec` queries;
- our own TypeScript, no new dependency; ezdxf and MuJoCo stay test-only oracles outside the run;
- no VLM in the score.

**Metrics** (per rung and overall; n = 5 trials on fresh documents):
- **pass** = every hard predicate holds;
- pass@1 = c/n, pass@5 = 1 if any trial passes, pass^5 = 1 if all do (the τ-bench sense);
- the **Requirement Score** RS = the mean over trials of (hard predicates holding / hard predicates); soft ones are reported beside it, unweighted;
- calls, refusals, tokens (estimated) and wall time, as A5.5 reports them.
- Expected for the scripted agent: pass@1 = pass@5 = pass^5 = 1 and RS = 1 on every ready rung. Anything less is a harness or product bug, recorded.

**Mutant validation** (the checker checked):
- every hard predicate has at least one **seeded wrong design**: the scripted calls with one perturbation (a value off, a feature moved, dropped or added, a wrong material, a part left unmated);
- each must fail **its targeted predicate**. The kill rate is 100 % per rung, and the report lists the mutants, their target and what failed;
- a predicate no mutant kills is not admitted.

**The rungs**: their samplers (ranges, all mm unless said; constraints keep a sample buildable), hard predicates (tolerances are the kernel's exact-geometry ones unless said), capabilities and status. Each rung lists its mutants, at least one per predicate.

1. **Block with hole** — w, d ∈ [30, 120], h ∈ [8, 40], dh ∈ [3, 0.4·min(w, d)] (0.5 steps).
   - Hard: bbox = (w, d, h) to 1e-6; volume = whd − π(dh/2)²h to 1e-9 relative; one solid; the bore's exact cylinder has Ø dh to 1e-9, its axis at (w/2, d/2) square to the top to 1e-9, through (its face spans z 0…h).
   - Needs box and hole. **Ready** (A5.5's brief, sampled).
   - Mutants: Ø +1; axis 2 mm off; blind at h/2; w +5; no hole.
2. **Washer** — D ∈ [8, 40], d ∈ [0.4D, 0.7D], t ∈ [0.8, 4].
   - Hard: outer Ø D and bore Ø d (exact cylinders), coaxial to 1e-9; thickness t; volume π(D² − d²)t/4 to 1e-9; one solid.
   - Needs tube. **Ready.**
   - Mutants: bore offset 0.5; t × 1.5; d → 0.9D; a solid disc.
3. **Printed phone stand** — w ∈ [60, 100], D ∈ [50, 90], H ∈ [40, 80], wall 5, lip 8, phone slot g ∈ [10, 14].
   - Hard: bbox; volume by its closed form; one solid; the phone slot (lip to back) ≥ g; FDM rules on the print direction +Z: `min_wall` ≥ the fdm profile's and `print_rule` with no error.
   - Needs box/union and the AM3 rules. **Ready.**
   - Mutants: no lip; wall 0.5 (min_wall); slot g − 3; a floating second solid.
4. **Machined plate** — L ∈ [80, 200], W ∈ [50, 150], T ∈ [6, 20], four corner holes on a pitch (p_x, p_y), a central pocket a × b × depth with corner radius rc ∈ [3, 8].
   - Hard: bbox; four holes of their Ø at the pitch (exact axes to 1e-9); the pocket's size and depth; its vertical corner radii ≥ rc (`radius`); the volume's closed form.
   - Needs box, holes, pocket (cut) and fillet. **Ready as geometry.**
   - **The machining rules wait for CNC1–CNC6** (kernel lane, not started). The rung gains a soft "machinable" predicate when they land.
   - Mutants: one hole moved; pocket too deep; corner radius 1; three holes.
5. **Sheet-metal L-bracket** — R12.5's case (`sheet-l-bracket.calls.json`), now sampled: flange lengths, T ∈ [1, 3], R ∈ [T, 3T], K ∈ [0.3, 0.5].
   - Hard: volume by the middle line to 1e-12; flat length by BD to 1e-12; the K-factor area identity to 1e-11; the sheet rules with no error.
   - **Ready** (the kernel lane's R12.5; its frozen case keeps the ezdxf DXF audit).
   - Mutants: K off; R < T; a flange 5 short.
6. **Load bracket (beam stress), closed-form beam theory only.** CAE and FEM are off the roadmap (#2177), so this rung is **scoped down**, not held. A wall plate and a prismatic cantilever arm of length L ∈ [40, 150], section b × h (rectangular or a channel), a tip load F ∈ [20, 500] N, an aluminium or steel body (library materials), safety factor 2.
   - Hard:
     - the arm is prismatic: its root, mid and tip sections, cut by the kernel, have equal second moments to 1e-9;
     - slender, L/h ≥ 5, where Euler–Bernoulli is the stated validity range;
     - the root fillet is r ≥ 0.25h;
     - σ = F·L·c/I ≤ σ_y/2 and δ = F·L³/(3EI) ≤ δ_max (sampled), with I and c from the **root section polygon**, by Green's theorem on the kernel's cut face (no handbook section table).
   - The checker states what it does not judge: stress concentration beyond the factor, contact at the wall, buckling of thin flanges.
   - Needs the section second-moment predicate. **Buildable in the outer lane** (`src/rb9/beam.ts`), small.
   - Mutants: h too thin (σ); L doubled (δ); a tapered arm (prismatic fails); L/h = 3 (slender fails); no fillet.
7. **Bolted joint** — two plates lapped and bolted through a hole pattern.
   - **Held for the bolt itself**: there is no fastener in the library (enclosure and T-slot parts only), and standard fasteners come with **R12c machine elements (kernel lane)**.
   - Scoped now: the plates' clearance holes aligned (`hole_alignment`, 1e-9), their pattern and edge distances ≥ 1.5 Ø (stated as the brief's rule, not a standard's), the two plates mated, no interference.
   - When R12c lands: the bolt's library part, its length through the grip, and its clearance per the library's own data.
   - Mutants: a hole 1 mm off; edge distance 1 Ø; plates interfering.
8. **Snap-fit box** — a box and a lid (two bodies or instances), w, d, h, wall ∈ [1.5, 3], two or four snap hooks and ledges (library `snap-hook`, `snap-ledge`).
   - Hard: every hook's `library_check` passes (its strain on assembly against the body's material, the library's own rule); each hook meets its ledge (aligned to 0.1); lid-to-box clearance ≥ the process fit gap (`clearance`); no interference; two solids.
   - Needs the library parts and mates. **Ready.**
   - Mutants: a hook too thick (strain fails); a ledge moved 2; lid clearance 0; one hook missing.
9. **PCB enclosure** — A5.5's brief plus a PCB of size (a, b), its four holes on a pattern, standoffs (library `pcb-standoff`), vents.
   - Hard: the standoffs' axes on the PCB's hole pattern to 1e-6; the PCB's keep-out clear (`keepout`); `min_wall`; the vent count; the volume's closed form; base and lid two solids.
   - **Ready.**
   - Mutants: a standoff 1 off; the PCB keep-out entered; no vents.
10. **Sheet-metal PCB enclosure** — R12.5's case (`sheet-pcb-enclosure.calls.json`), sampled like rung 5, with its four standoff holes and connector slot. **Ready.** Mutants as rung 5's, plus a missing relief.
11. **Print-in-place toy** — a captive ring on an axle, or a spinner, printed assembled.
    - Hard:
      - two or more solids, not interpenetrating;
      - every facing gap between them in [fitGap, 2·fitGap] of the process profile (`clearance`);
      - print rules with no error;
      - **captive**: the moving part cannot leave along ±X, ±Y or ±Z. Each is a straight translation swept by RM6's conservative advancement (the part on a prismatic dummy joint) until contact; a clear sweep past the bounding box fails.
    - Needs that translation captivity check. **Buildable in the outer lane** on RM6, small.
    - Mutants: gap 0 (fused); gap 1.5 mm (loose beyond 2·fitGap); the axle's flange removed (escapes along Z).
12. **5-part assembly** — five instances (a base, two brackets, a shaft, a cap) placed by mates.
    - Hard: five instances; every instance's freedoms as the brief declares (0, or 1 for the shaft's turn), by RM1's joint tree; `checkAssembly` with no PARTS_MEET and only declared contacts; total mass by closed form; a BOM of five rows.
    - **Ready.**
    - Mutants: a part unmated (free); two interpenetrating; a part missing.
13. **Product from a brief** — a family (a knob on a D-shaft, a cable clip, a wall hook), the brief in words with sampled needs (shaft Ø and flat, cable Ø, load).
    - Hard: the frozen hidden requirements of that product (fits, sizes, printability, mass); the brief (A6.1) recorded with no open gap.
    - **Ready** (A6.1 brief, A5.5's knob brief generalised).
    - Mutants: bore Ø + 0.5; flat missing; the brief left with a gap.
14. **2-axis robot arm** (the owner's rung) — two revolute joints by mates, link lengths l₁, l₂ ∈ [80, 250], a payload m ∈ [0.1, 1] kg and a target reach R* < l₁ + l₂.
    - Hard:
      - RM1's tree has two revolute joints;
      - RM9b's reach ≥ R*;
      - RD10's sizer margins all ≥ 0 at the duty, with a reducer from RD3's envelopes;
      - the URDF exports, and our reader's FK equals RM2's to 1e-9 at 20 poses, its inertia RM3's to 1e-12.
    - MuJoCo's load and inertia comparison stays a test-only oracle on the frozen case, as O38's.
    - **Ready.**
    - Mutants: l₂ short (reach); a motor too small (margin); a joint fixed.

**Blocked, and whose lane:**
- rung 7's bolt (R12c machine elements, kernel lane);
- rung 4's machining rules (CNC1–CNC6, kernel lane).
- Rungs 6 and 11 need one small predicate each in this lane: the root-section beam check, and the translation captivity sweep.
- Everything else is ready on today's tools.

**Order**:
1. RB9.1: the harness, `src/rb9/` and `pnpm rb9`. Samplers, checkers and scripted agents for the ready rungs (1–3, 5, 8–10, 12–14), the mutants, and the report.
2. RB9.2: rungs 6 and 11 with their predicates.
3. RB9.3: rungs 4 and 7's scoped forms.

Each is checkpointed with the scripted metrics (expected 1) and the mutant kill table.

**Live trials, pending the owner's go-ahead** (not run):
- five trials per rung with a real model through the same chat server (the v2 hybrid arm, and the json arm for comparison), on fresh documents;
- seeds frozen in the report before the run, so the parameters are the scripted run's;
- the agent gets the brief in words only, at most 24 turns, and at most three repair attempts after its own check (the research's fade point);
- the checker runs after it stops; transcripts are recorded;
- metrics as above, with the repair count;
- no VLM.
- **Cost from A5.5's measures**: the hybrid arm read about 14k input tokens per brief when ideal. At three times the ideal calls, 14 rungs × 5 trials × 2 arms comes to about 4–12M input tokens. The owner approves before any run (`--live`, `CAD_AB_LIVE=1`, as A5.5).

## O71 — RB9.1a: the ladder harness and six rungs, scripted: 30/30 trials, 76/76 mutants killed (2026-10-20)

Built as O70 froze it and the coordinator accepted (`src/rb9/`; `pnpm rb9`). The rungs ready on today's tools come in two parts. This is the first: rungs 1, 2, 3, 5, 10 and 13. Rungs 8, 9, 12 and 14 are **RB9.1b**, next. They need the library parts' placement (snap hooks and ledges, the enclosure's base and lid, PCB standoffs) and the assembly tools' face names worked into scripted calls.

- **The core** (`core.ts`):
  - a rung's space (each parameter's range, which may depend on those before it, on a step grid; or a choice);
  - a seeded sampler (mulberry32). **The edges are forced**, as the coordinator asked: trial 0 puts every parameter at its low end, trial 1 at its high end, trials 2 and 3 alternate; the rest are random on the grid;
  - the build on a fresh document through the agent's own tools (`dispatchTool`, the layer the chat server's MCP side runs). The brief's words are passed as the conversation, so a brief field can be "stated";
  - the hidden checker, run after the build, on the part only;
  - mutants run on both range ends (trials 0 and 1). A mutant's target may depend on the parameters, where a rung has families;
  - the metrics: pass, pass@1 = c/n, pass@k, pass^k, and RS.
  - The live arm (A5.5's chat-server turn) is not wired. `pnpm rb9 --live` refuses, since live trials wait for the owner.
- **What the checker measures** (`measure.ts`):
  - volumes from the kernel's mass properties (exact, to 1e-9 relative);
  - bores and holes from the B-rep's exact cylinders, their radius, axis and extent (distinct by axis, so a face the kernel splits in halves is counted once);
  - planes from exact faces;
  - the box from the display mesh (1e-4);
  - the studio's own checks (`min_wall` and the rest) on a copy of the part with the checker's requirements and process, never the agent's;
  - sheet flats from the kernel's unfolding.
- **The rungs**:
  - **1, block with hole** (5 predicates, 6 mutants);
  - **2, washer** (6, 6);
  - **3, printed phone stand** (6, 6): the phone's slot from exact planes; the FDM wall from the fdm profile's 0.8, through `min_wall`;
  - **5, sheet L-bracket** (7, 7) and **10, sheet PCB enclosure** (8, 8): R12.5's closed forms (middle-line volume, BD flat size, K-factor area identity), the bends and the holes on exact axes, all sampled. T, R, K, legs, flanges, insets, slot;
  - **13, product from a brief** (6, 5), a family. A knob on a D-shaft: the bore's exact cylinder and depth, the flat's exact plane, the volume with the D-segment and the fillet by Pappus. Or a wall hook: two blind screw holes on the back's axis. Each with its A6.1 brief stated (purpose, process, material: no gap).
- **Found while building**:
  - a box command refuses a side under 1 mm, so the thin-wall mutant is a pocket leaving a 0.5 mm skin;
  - the hook's screw holes must be blind, because a through hole runs on through the lip beyond the back;
  - the hook's lip can rise above the back, so the box predicate takes the larger;
  - the first draft left predicates with no mutant (solids, the washer's outside, the stand's box and volume, the product's volume and solids). Each now has one, and the test asserts none is left.
- **Evidence**:
  - `pnpm rb9` (seed 2026, 5 trials): **30/30 trials pass, pass@1 = pass@5 = pass^5 = 1 and RS 1 on every rung; 76/76 mutants killed; every hard predicate killed by a mutant.**
  - The report, with each trial's seed and sampled values, is in `notes/rb9-scripted-2026-10-20/` (report.md, results.json).
  - `test/rb9.test.ts`: the sampler's edge patterns, determinism and grid; the ladder end to end, as the CLI's gate; each trial's seed and values in the report.

## O72 — RB9.1b: rungs 8, 9, 12 and 14 scripted (50/50 trials, 130/130 mutants); a library part's material from the brief; set_material proposed (2026-10-20)

Ordered by the coordinator after O71. There are three parts: the library's material fix, rung 8 without context numbers, and RB9.1b. A per-body material tool is proposed below, and not built.

- **A library part's material** (`src/library/libraries.ts`). The context now takes `materialIdOf(doc, target)`: the body's own material, else the brief's stated one. That is the material its mass already reads. Before this it read the body's look only, so a snap hook in a part whose brief stated ABS had no strain context unless the agent passed numbers. An assumed brief material still gives none, and says so.
- **Found while building, and fixed** (`src/chat/tools.ts`): the assembly group's tools (`add_library_part` among them) did not re-evaluate the part. A second `add_library_part` in the same turn looked for the body by its face among the bodies from before the first union, and was refused with "No such body to add to". The result now re-evaluates and hands on its bodies.
- Tests (`test/enclosure.test.ts`):
  - a stated ABS brief gives the hook ε_allow 0.025, E 2200, σy 40 and μ 0.5;
  - an assumed one gives the missing-material warning;
  - the body's own PLA comes first;
  - through the tools, `set_brief` then `add_library_part` gives the hook its context, with no `context`;
  - four standoffs in one turn end in one body.
- **The rungs**:
  - **8, snap-fit box** (6 predicates, 10 mutants). A box and a flat lid on its rim (two solids), with 2 or 4 cantilever hooks under the lid, each over a ledge on its wall. The material (ABS or PETG) comes from the brief only; **the scripted agent passes no `context` numbers**, as ordered. Predicates:
    - the box;
    - the two solids;
    - the hook count;
    - **flex**: `library_check` strain and yield ≤ 1 on every hook;
    - **latched**: each hook's catch face (an exact plane) faces a ledge's underside within 0 to 2·fitGap, and they overlap by at least (undercut − fitGap) × width;
    - **clearance**: every hook at least the FDM fit gap (0.3) from the box. The meshes' distance is taken from the hook's own triangles (its prefix faces);
    - no interference.
  - **9, PCB enclosure** (8, 7):
    - four standoffs (M2.5 or M3) on the board's hole pattern, their exact cylinders to 1e-9 and height to 1e-4;
    - the board's component space as a keep-out, checked by the studio's own `check_keepouts` on a copy (1 mm clearance);
    - the cable hole's exact cylinder;
    - the vents, by the kernel's section through the right wall: the area lost lies between n obround slots and n rectangles;
    - FDM `min_wall`, the box, one solid.
  - **12, 5-part assembly** (5, 5). A base, two brackets with bores, a cap and a shaft, each its own part placed by mates (origin-plane distances). Predicates:
    - five parts and five BOM rows;
    - each part's placed box, matched by position and not by name;
    - **freedoms by RM1's tree**: one joint moves, the shaft's, continuous about the bore axis; every other part is fixed; no loops or problems;
    - `checkAssembly` passes, with only the mates' contacts;
    - the mass against its closed form (6061) to 5e-3 g.
  - **14, 2-axis arm** (4, 5). Bars on a base, as RM's chain-2r, with a payload block sized by its mass, and ratings set by `set_joints`. Predicates:
    - two revolute joints on vertical axes, l₁ apart;
    - **reach**: RM9b's map, 2000 poses, from the end link's far bore must be at least R*;
    - **margins**: the RD9 harness at the brief's duty passes, with an RD3 pair on each joint;
    - **URDF**: the export is clean, its FK equals RM2's to 1e-9 at 20 poses, and its inertials equal RM3's to 1e-12.
- **Where these differ from O70's frozen text**:
  - Rung 8: "a hook too thick (strain fails)" cannot be built. For ABS and PETG, σy/E is below the allowable strain, so a thicker hook is refused at yield before its strain warns. The flex mutant is the brief without a stated material instead (strain unknown).
  - Rung 8: "lid-to-box clearance ≥ fitGap" is read as every hook's clearance from the box. The lid rests on the rim, and that contact is intended.
  - Rung 8: the hook–ledge alignment is the overlap rule above, which is ±0.2 across: the ledge is wider by its 2 × 0.2 clearance.
  - Rung 9 is the open base, one solid; the lid and two solids are rung 8's.
  - Rung 9's volume closed form is replaced by the vents' section bound, the standoffs' exact cylinders and the keep-out.
  - Rung 14's "motor too small" is a joint rated far below the move's torque. The document cannot hold an actuator choice, so the harness takes RD3's lightest feasible pair.
- **Found while building**:
  - `x_direction` sets a library part's width axis. A hook's latch faces −(x × z) on the face, so a hook by the left wall wants the opposite one.
  - A ledge on the −x wall comes upside down without its own `x_direction`.
  - A `distance` mate between two same-way faces offsets along a's normal, so the scripted agent uses the origin planes.
  - An axial mate between the shaft and the cap closed a loop in RM1's tree. The shaft's end is mated to bracket A instead, 1 mm short of the cap.
  - An unmated payload still exports a URDF (one robot, the loose part noted). The URDF mutant is unrated joints instead (LIMITS_MISSING).
- **Proposal, not built: a per-part material.** No tool sets a body's material today. The brief covers the base part only, so an instance (rungs 12 and 14) is always the studio's default 6061, and a payload's mass has to be shaped in aluminium. The tool contract's overhead stands at 14 440 of its 15 000-character guard (tools/list 112 889 against 98 449 plain).
  - **Recommended: a `material` field on `place_part`**, `{part: "base" | id, material, body?}`:
    - it sets the look's material on every body of that part, or on `body`;
    - an unknown id is refused with the list (MATERIAL_UNKNOWN);
    - `part: "base"` is taken for material alone;
    - it costs no contract overhead, about 300 plain characters, and goes in v2's assembly `place` action.
  - A separate `set_material` tool would fit today: about +130 of contract overhead, leaving ~430. But it would spend most of what the next tool needs.
  - Then rung 12 and rung 14 state a steel shaft and a steel payload, and their mass and inertia closed forms follow.
- **Evidence**:
  - `pnpm rb9` (seed 2026, 5 trials): **50/50 trials pass on all ten rungs; pass@1 = pass^5 = 1 and RS 1 each; 130/130 mutants killed; every hard predicate killed by a mutant.**
  - The report is regenerated in `notes/rb9-scripted-2026-10-20/`.
  - `test/rb9.test.ts` now runs all ten rungs.

## O73 — set_material, steel in rungs 12 and 14; RB9.2: rungs 6 (beam) and 11 (print-in-place) (2026-10-20)

Ordered by the coordinator after O72, which put a body's material on the body's look and not on placement.

- **No existing tool edits a body's look**, so a new tool, `set_material`, was added. It takes `{material, bodies?}`, plus `part`, as every part tool does, for a placed part's own bodies.
  - It writes the look's material: the first thing a body's mass, the BOM and a library part's context read, before the brief's material.
  - An id outside the material library is refused with `[MATERIAL_UNKNOWN]` and the id list.
  - It is batchable, so it can go in `apply_ops` and in the ops of `propose`; a placed part's change is proposed, as every assembly change is. It is classified as an idempotent alteration.
  - v2 lists it as `features.material`.
  - The system prompt names it as the path: "The brief's material is the base part's; a body or a placed part of another material gets it with set_material." The tool descriptions are the only docs that list tools.
  - The contract overhead went from 14 440 to **14 544** of the 15 000 guard (+104), leaving **456**. tools/list is 113 595 characters, 99 051 plain; 82 tools.
  - `tools-v1.json` and `tools-v2.json` were updated as a compatible change.
  - Test: a base body set to ABS weighs ABS's density with no "assumed" note. A snap hook on it takes ABS's strain with no brief. A placed pin set to steel shows steel in its BOM row. An unknown id, an unknown part and an unknown body are refused.
- **Rungs 12 and 14 now state steel.**
  - Rung 12: the shaft is steel, the rest 6061. The mass closed form takes each part's density. New mutant: the shaft left aluminium.
  - Rung 14: the payload is a steel block, sized by steel's density. New predicate: the payload link's mass from RM3, equal to m to 1e-9 relative. New mutant: the payload left aluminium.
- **Rung 6, load bracket** (7 predicates, 7 mutants). Closed-form beam theory only (#2177).
  - **`src/rb9/beam.ts`** cuts the body across x with the kernel's split. It takes the cut face's boundary from its B-rep edges, which have exact double endpoints, and chains them into loops; holes are signed by containment. Area, centroid and second moments then follow by **Green's theorem** on those loops. Only straight boundaries are accepted; a curved one is refused.
  - Predicates:
    - one body;
    - the stated material;
    - **prismatic**: root (past the farthest fillet axis), middle and tip sections, with I and area equal to 1e-9. On trial 1 they equal b·h³/12 = 12 282.5 exactly;
    - slender, L/h ≥ 5;
    - root fillets, top and bottom, r ≥ 0.25 h, from exact cylinders;
    - σ = F·L·c/I ≤ σy/2 and δ = F·L³/(3EI) ≤ δmax, with I and c from the root section, E and σy from the material library.
  - What it does not judge is stated in the file's head: stress concentration beyond the factor, contact at the wall, flange buckling.
  - The sampler keeps the brief feasible: F is capped so the stress depth stays under 0.16 L, and δmax is sampled above the deflection depth's floor.
  - The scripted agent sizes h in closed form on a 0.5 mm grid.
  - Mutants: thin (0.6 of the stress depth), long (L × 2), stepped (not prismatic), stubby (L/h = 3), no fillet, the wrong metal stated, the arm not joined.
  - The plate is 100 mm, so no mutant's fillet is refused.
- **Rung 11, print-in-place toy** (4 predicates, 5 mutants): a ring captive on a flanged axle, FDM.
  - **`src/rb9/captive.ts`**: each of ±X, ±Y and ±Z is a straight slide. The ring is on a prismatic dummy joint and the axle fixed, both children of one still link, so RM6 checks the pair (it skips a parent and its child). RM6's conservative advancement sweeps the slide, certified, until contact, or past the two parts' box plus 1 mm. A clear sweep means the ring escapes.
  - Predicates:
    - two solids, not meeting;
    - every facing gap within [fitGap, 2·fitGap] (0.3 to 0.6), from exact faces: the bore round the axle (cylinders), the flange below and the flange above (planes);
    - `check_printability`, no rule failing;
    - captive in all six directions. The scripted toy meets contact after exactly its gap in each.
  - Mutants: gap 0, gap 1.5, the top flange left off (escapes along +Z), an extra block, a 0.3 mm ring wall (print fails).
- **Evidence**:
  - `pnpm rb9` (seed 2026, 5 trials): **60/60 trials on twelve rungs; pass@1 = pass^5 = 1 and RS 1 each; 158/158 mutants killed; every hard predicate killed by a mutant.** The report is regenerated in `notes/rb9-scripted-2026-10-20/`.
  - The set_material test in `test/enclosure.test.ts`.
  - The contract tests with the new numbers.
- **Still held**: rung 4 (CNC1–CNC6) and rung 7's bolt (R12c), both in the kernel lane. Live trials wait for the owner.

## O74 — RB9.3: the scoped forms of rungs 4 (machined plate) and 7 (lap joint); the held rules named (2026-10-21)

Ordered by the coordinator after O73, per O70: the geometry the studio can judge today. What waits for the kernel lane is a **soft "held" outcome**: never passed, its lane named, outside pass and RS. The ladder now has all fourteen rungs (`src/rb9/rungs-plates.ts`).

- **Rung 4, machined plate** (6 hard predicates and 1 held; 7 mutants). A plate L × W × T, four corner through holes on a pitch, and a central pocket a × b × depth with vertical corner radius rc (a box cut, then its four vertical edges filleted). Predicates:
  - the box and one solid;
  - **holes**: four of their Ø, on the pitch, exact axes to 1e-9, through T, and no others of that Ø;
  - **pocket**: from exact planes inside the plate. The walls facing in give a × b, centred, to 1e-9; the floor facing up gives the depth to 1e-9;
  - **corners**: the four vertical cylinders that are not holes, each at its pocket corner inset by its radius, r ≥ rc;
  - **volume**: L·W·T − 4πr²T − (a·b − (4 − π)·rc²)·depth, to 1e-9 relative;
  - **held, machinable**: CNC1–CNC6 (kernel lane).

  Mutants: a hole 1 mm off its pitch, three holes, the pocket 1 mm deeper, corner radius 1, a stray Ø3 blind hole (volume), the plate 5 longer, a loose block.
- **Rung 7, bolted lap joint, the plates** (6 hard predicates and 1 held; 6 mutants). Plate A is fixed; plate B is lapped over A's far end and mated (coincident faces, concentric on the first hole, the xz origin planes 0 apart). The holes are Ø d clearance holes, 2 or 4 on one pattern centred in the lap. Predicates:
  - two plates, one solid each;
  - **mated**: RM1's tree is all fixed, with no problems;
  - **pattern**: A's holes at the brief's positions (exact axes, 1e-9);
  - **aligned**: every hole of A coaxial with one of B (1e-9);
  - **edges**: every hole ≥ 1.5 Ø from its own plate's sides (the brief's rule, not a standard's);
  - **contacts**: `checkAssembly` passes, with only the mate's contact;
  - **held, bolt**: R12c's fasteners (kernel lane).

  Mutants: one of B's holes 1 mm off, the rows 1 Ø from the sides, both plates' rows 2 mm apart (pattern), a nub under B 1 mm into A, B on one bolt hole and free to turn, plate B never added.
- **Evidence**: `pnpm rb9` (seed 2026, 5 trials): **70/70 trials on fourteen rungs; pass@1 = pass^5 = 1 and RS 1 each; 184/184 mutants killed; no hard predicate without a mutant.** The report is regenerated in `notes/rb9-scripted-2026-10-20/`.

## O75 — the outer-lane follow-ups: the Joints masses, the look ids, RD3's stop and coupling, datums as mate targets; the BVH skipped (2026-10-21)

The batch the coordinator ordered after O74, from README §0's "Outer-lane follow-ups" and the O-log. Each has a test.

- **The Joints card's link masses** (`src/ui/JointsPanel.tsx`). They are now one line, "Links N · total g", with "material assumed" when any is, and a Show/Hide button. The per-link list was what ran past the viewport on the 6R arm. It is closed by default. A link's own problem stays visible while closed, prefixed with the link's name.
  - Test: the RM3 flow step. The 2R arm reads "Links 3 · 131.9 g · material assumed" with no list. Show opens the per-link masses as before (14.1 g, CoM (20.0, 0.0, 2.5)); Hide closes them.
- **The appearance ids** (`src/engine/render.ts`). Every preset id now carries the `look-` prefix (`look-steel`, `look-brass`, …), so none is a material id. Documents keep appearances by value, not by preset id, so no saved file changes. The flow's two preset selections follow the new ids.
  - Test (`test/material-look.test.ts`): every look id starts with `look-`; no look id is a material id in either list (the library's or the studio's); no material id takes the prefix; the ids are unique.
- **RD3, the momentary peak torque** (`src/robot/actuators.ts`). A stated stop event, `estop` (rad/s²; `size_actuators` takes it as `estop_rad_s2`), is applied from the cycle's fastest sampled instant of each joint: every moving joint decelerates at that rate. The joint's output torque there comes from the RNEA and is checked against the reducer's page value, "Limit for Momentary Peak Torque". Without a stated stop there is no such check, and SIZING_MODEL says so. The check also runs in `checkPair`, the RD9 harness path, when its options carry `estop`.
  - Test: on the one-joint case the stop torque equals J·a to 1e-9, with the page's limit and source. A stop past every pair's limit leaves none feasible, and the rejection is named.
- **RD3, the actuators' own mass**: `sizeCoupled`, and `coupled: true` on `size_actuators`. Each chosen pair becomes a point mass at its joint's axis point on the joint's parent link (`withPointMass`, by the parallel-axis rule), and the robot is sized again until the choices repeat. It stops at 6 rounds, with `settled: false` if they still change. The result lists each added mass and its link.
  - Test, on chain-2r: the choices settle. The elbow's pair is added to the upper arm. The shoulder's mass-matrix diagonal grows by exactly M·d² of that pair, to 1e-9. Sizing again on the coupled bodies gives the same choices (a fixed point). A point mass at the centre adds no inertia.
- **A6.3, datums as mate targets** (`src/assembly/faces.ts`, `mates.ts`, `engine/references.ts`, `chat/assembly.ts`). The base part's face table now includes its datums as `datum:<id>`, where the datum's reference puts it: a plane datum as a flat face, an axis datum as a round one. Point datums do not mate.
  - Like origin planes they are frames, not B-rep faces (`frameFace`). A flat mate with one defaults to the same way, and they take no signatures.
  - `get_assembly faces_of: base` lists them, and the add_mate description names them.
  - Test (`test/reference-bodies.test.ts`): a pin concentric with an axis datum and flush (flip) on a plane datum stands at the datums, its world box (26, 21, 20)–(34, 29, 35), with one turn left. A point datum is refused as not a face of the base.
- **Skipped, as it needs a kernel-core change: the R3.2 BVH under RM6's mesh distance.** `facetBvh` (`packages/barocss-cad/src/facet-bvh.ts`) is built only from a B-rep made of facet faces, and is cached per B-rep. Its builder over raw positions and indices is not exported. Reusing it for display meshes needs a kernel export, such as `bvhOfTriangles(positions, indices)` returning the same `FacetBvh`. `meshDistance` keeps its box pruning in the meantime.
- **Contract**: the overhead is unchanged at 14 544 of 15 000 (tools/list 113 992 characters, 99 448 plain); `tools-v1.json` is updated as a compatible change (size_actuators' two new properties, the descriptions).

## O76 — IM S0: what injection moulding can measure exactly today, its sources, and the plan for IM1–IM6 (2026-10-21)

On 2026-10-21 the coordinator moved IM1–IM6 and CNC1–CNC6 from the kernel lane to the outer lane, as RD1–RD3 had moved (README §0's lane lines). This is the S0 for the IM track. Evidence: `test/im-s0.test.ts` (4 probes).

- **What exists**:
  - the material library's `injection` profile: rib 0.6 recommended and 1.0 at most, bosses 0.6–1.0 of the wall, walls 0.6 and 1.0 recommended, draft 1° recommended, fit 0.1. Every value is the BaroCSS rule of thumb `P-INJ`, flagged as such;
  - `draftAnalysis`: flat faces only, display-mesh normals; curved faces said to be not judged;
  - `wallThickness`: rays on the display mesh;
  - the printability report (AM3), rule by rule with pass, warn, fail, unknown and n/a;
  - the studio's own triangle BVH and ray query (`print/orient.ts`, AM4);
  - the kernel's exact `faceGeometry` (plane and cylinder; `other` for the rest) and `evaluateSurfaceD1`/`D2` on the B-rep's NURBS faces (`partBreps`).
- **Exact normals on curved faces need no kernel change.** A display-mesh vertex is projected onto its B-rep face's NURBS by Gauss–Newton on `evaluateSurfaceD1` (start from a 25 × 25 parameter grid; first derivatives only).
  - `evaluateSurfaceD2` refuses at a circle's C1 interior knot. D1 refuses exactly at a C0 knot (the quadrant joins, G1 in space), so the evaluation steps 1e-11 of the domain inside.
  - The display mesh joins a face's pieces (`x#1`, `x#2`) into one display face, so each vertex is projected onto every piece and the nearest kept.
  - The parameterised tessellation (`tessellateBrepWithParameters`, the vertices' (u, v)) is not exported. It would replace the search, but it is not needed.
- **The probes**:
  - **P1, a 3° drafted cylinder (a cone)**: the exact normal at each of 68 vertices gives the draft as 3° to **5.8e-15°**. The display mesh's normal is off by **0.0144°**, and the vertices lie 5.3e-7 mm off the surface (single precision). A draft check on curved faces must use the exact normal, not the mesh's.
  - **P2, a cylinder lying across the pull**: `faceGeometry`'s exact cylinder, and n·d equal to z/r at every vertex to 1e-6 (the vertex's own precision). The face takes both signs: it **straddles** the isocline n·d = 0.
  - **P3, undercuts by ±d visibility**: each triangle's centre is moved 0.01 mm along its normal into the open side, then a ray is cast along d through the studio BVH. A hole along the pull: 64/64 clear from +z and 64/64 from −z. A side hole across it: **0/64** both ways, so an undercut. A vertex on a face's rim grazes the next face, so vertex samples are ambiguous; triangle centres are not.
  - **P4, a shelled box (t = 1.8)**: `wallThickness` gives 1.8 to 1e-4.
- **Sources (public HTML only, read-only)**:
  - Protolabs' injection moulding guide page (`protolabs.com/resources/guides-and-trend-reports/injection-molding-guide-process-design-tips-materials/`, read 2026-10-21) is readable. It gives:
    - draft "1 to 2 degrees" as a starting point, "at least 3 degrees" for PM-T1 and 5° for PM-T2;
    - adjacent walls within 40–60 % of each other, ribs "around 60 percent";
    - shrink from 0.002 in/in (ABS, PC) to 0.025 in/in (TPE);
    - text over 20 pt, 0.010–0.015 in deep, with a 0.020 in stroke;
    - the largest part, 480 × 751 × 203 mm.
  - The services page (`protolabs.com/services/injection-molding/`, read 2026-10-21; the owner pointed to it) is readable. Its numbers are:
    - "+/- 0.003 in. (0.08mm)" moulded tolerance, plus a resin tolerance "no less than +/- 0.002 in./in.";
    - the largest part, "18.9 in. x 29.6 in. x 8 in. (480mm x 751mm x 203mm)".
    It gives no draft, wall or rib values; for those it links the guide above and design-tip pages. IM1 takes the tolerance and size limits from it, and IM6 quotes against them.
  - Its per-material wall ranges are not on that page. IM1 reads them from Fictiv's and Hubs' public guides. The linked "Definitive Guide" is a PDF, not read (no PDFs without asking).
  - Each value goes into the profile with its URL, the date read and the page's own label, or flagged as an estimate. No standard's text is used.
- **Tools, under the 15 000 contract guard (456 left).** One new tool per process would spend it. The proposal is to make `check_printability` the manufacturability report for the part's process: printing as now, injection moulding when the process is `injection`, machining for CNC. Its name stays for compatibility; its description and the rules change. Its output schema is the same rule list. This costs no overhead and goes to the coordinator first.
- **The plan**, each stage with closed-form or constructed oracles, mutants where it is a check, and a flow step:
  - **IM1**: the process rule.
    - the `injection` profile sourced value by value, with per-material wall ranges and shrink;
    - the pull direction and the surface finish (texture) on the document, versioned. The finish sets the minimum draft;
    - the brief's process `injection` selects it.
  - **IM2**: the draft field. For each face, the exact draft over its vertices and triangle centres, classified as:
    - drafted (≥ the finish's minimum);
    - low (0 < draft < minimum);
    - vertical;
    - negative (a back draft);
    - straddle (both signs past the tolerance).
    Steep faces and the isocline n·d = 0 are reported. Oracles: a cone's taper, a cylinder across the pull (straddle), a revolved sphere (its equator), a fillet (0 → 90°).
  - **IM3**: undercuts by ±d triangle visibility: each face's area hidden from both directions, and the undercut regions. Oracles: a side hole, a snap hook's latch, an internal groove; mutants.
  - **IM4**: walls, ribs, bosses, radii and sink.
    - walls: the nominal wall from the ray-thickness distribution and adjacent-wall ratios;
    - ribs: thickness at most 0.6 t (thin protrusions, by thickness against the nominal);
    - bosses: wall against the nominal (exact cylinders, coaxial);
    - radii: inside radii at least 0.5 t (concave exact cylinders);
    - sink: thick sections.
    Oracles: analytic shells, a constructed rib and boss.
  - **IM5**: the parting line, from silhouette loops — edges between faces of opposite n·d, and isocline curves traced on straddling faces by projection — with a manual override. **Splitting a straddling face along its isocline is a face split by a curve, likely a kernel-core operation.** IM5 stops there and asks; the line itself, its loops and the override do not need it.
  - **IM6**: the quote package: STEP, the DFM report (JSON and Markdown), the material, finish, pull and quantity, in one zip, like A8.5's bundle.
  - Later, after IM6: an RB9 rung for a moulded part.
- **No kernel-core change is needed for IM1–IM4 and IM6.** IM5's straddle-face split may need one, and it will be asked for when reached.

## O77 — IM1: injection moulding's process rule, sourced page by page; the manufacturability report names its process (2026-10-21)

The coordinator accepted O76 and approved the proposal, with additions: v1 keeps `check_printability`'s name; v2 names the action `query.manufacturability`, with `print.check` kept as its alias; and the report names the process it judged by, saying so when none is chosen rather than assuming one.

- **The data** (`materials.json`). A new source, **W-WEB**: a public page read only, each value as printed there, naming its page (`url`, `read`, `label`). `checkMaterials` refuses a web value without its page. All from Protolabs, read 2026-10-21:
  - **Wall by material** (*Solving Wall Thickness Issues in Molded Parts*, "Wall Thickness by Material"), with the page's millimetres kept:
    - ABS 1.143–3.556;
    - acetal (pom) 0.762–3.048;
    - polycarbonate 1.016–3.81;
    - polypropylene 0.635–3.81;
    - nylon (pa12, the page's "Nylon" family row) 0.762–2.921.
    These replace the injection ranges of the earlier S-TYP estimates; each material's own source key is `wallMM.injection`. PETG, PLA and the resin have no row there, so no moulding range: a rule on them says so.
  - **Shrink**: ABS and PC 0.002 ("shrink ranges from 0.002 in./in. for stable resins like ABS and polycarbonate", the injection moulding guide), as `mouldShrink`. The generic `shrink` stays the family's estimate.
  - **Finishes** (a new profile field): smooth at least 0.5° ("AT LEAST 0.5 degrees of draft on all vertical faces"), 1° recommended ("We suggest a minimum of 1 degree draft"); PM-T1 at least 3°; PM-T2 5° (the guide).
  - **Thresholds**:
    - `draftRecDeg` 1 and `ribRec` 0.6 now carry pages ("around 60 percent");
    - new: the largest part 751 × 480 × 203 mm, and ±0.08 mm with the resin's ±0.002 mm/mm (the services page).
    - `minWall` 0.6 and `minWallRec` 1.0 stay the flagged P-INJ rule of thumb: no page gives one number for every material.
- **The document**: `mould: {version: 1, pull?, finish?}` (versioned; a doc field like `print`). The Library panel shows Pull (±X, ±Y, ±Z) and Finish (with "≥ n°") when the process has finishes. Clearing both removes the block.
- **The report** (`print/rules.ts`). `check_printability` is now the manufacturability report for the part's process. It names its `process`, null when none is chosen, and then every rule is unknown with "no process is chosen … none is assumed". Moulding's rules:
  - **pull**: the direction given, else the document's; none, unknown;
  - **finish**: its least draft and source; unknown when none is set or the id is unknown (listing the ids);
  - **wall**: the thinnest against what fills (feasible);
  - **wall-material**: each body's thinnest wall, and its thick sections, against the material's moulding range. The thick sections are a new `thick95_mm` from `wallThickness`: the inward-ray depth that 95 % of the surface's area is within, so an open rim's ray down its own wall is left out. The material is the look's, else the brief's stated one (`materialIdOf`, O72);
  - **size**: the extents across the pull, either way round, and the depth along it, within the largest part. Without a pull, the sorted sides pass if they fit any way; otherwise the rule is unknown and asks for the pull;
  - **draft** and **undercut**: unknown, naming IM2 and IM3.

  `mould` adds the finish, its least and recommended draft, and each body's material, range and shrink. Warp on printing now reads the material through `materialIdOf` too, the same O72 fix. The `print_rule` cache key includes the mould settings and the brief's material.
- **The tools**: the description says "the manufacturability report for the part's process (printing, injection moulding, machining)", and `finish` is a new argument. v2 adds `query.manufacturability`; `print.check` is kept and declared in `V2_ALIASES`. `V2_OF` maps the tool to its canonical action, so the v2 prompt and `viaV2` say `query.manufacturability`. The contract overhead is unchanged at 14 544 (tools/list 114 367, 99 823 plain); both frozen files are updated as compatible changes.
- **Tests**:
  - `test/mould.test.ts` (5): the data and its page check; a shelled ABS box (1.8 walls, +Z, PM-T1) passes every IM1 rule, with 3°, ABS's shrink, and its size ratio exactly max(60/751, 40/480, 25/203);
  - walls: 0.9 in ABS is warned, in acetal it passes; a solid 20 mm block's section is warned; 0.5 fails;
  - nothing assumed: no pull, too long for any press, an unknown finish, no material, no process;
  - through the agent's tools: the brief states injection and ABS, and v1 and v2 give the same report;
  - `printing.test.ts`: moulding is judged by its own rules now;
  - `toolset.test.ts`: aliases are declared, and the canonical action is `query.manufacturability`;
  - a flow step: the Library panel's pull and finish kept on the document and cleared.
- **BVH**: the kernel request is withdrawn (README §0). The outer lane builds RM6's mesh distance on a dual-tree traversal over the studio's own triangle BVH, after IM.

## O78 — IM2: the draft field from exact normals; PA12's nylon-family wall range said so (2026-10-21)

The coordinator accepted IM1 and flagged one point: PA12 uses the page's generic nylon row, a family approximation that should be said as such in the data and the report. That fix is folded in here.

- **PA12's range**: a web value's page may now carry a `note`, which is ours and not the page's: "the page's nylon family row, not PA12-specific". The wall-material rule's message and `mould.bodies[].wallNote` repeat it.
- **The draft field** (`src/mould/draft.ts`). Each face's draft against the pull comes from its exact normal, never the display mesh's (IM S0: off by 0.014° on a 3° cone). The normal is taken by face kind:
  - **Planes**: the exact plane recorded on the display face.
  - **Cylinders**: the radial from the exact axis, made outward by the display normals' side.
  - **Any other face**, including a drafted extrusion's walls, which the display mesh records as NURBS with no exact plane: each sample is projected onto the B-rep's NURBS pieces of that name. The projection starts from a 25 × 25 parameter grid, precomputed per piece, then runs Gauss–Newton on first derivatives, stepping just off an exact C0 knot.
  - **Facet faces**: their triangles' own normals.

  Samples are the display mesh's vertices and its triangle centres. The draft at a sample is asin(n·d): 0 for a wall along the pull, ±90° for a face across it. Each face is classed as:
  - **drafted**: every sample's |draft| reaches the minimum, all on one side;
  - **steep**: some sample's does not;
  - **straddle**: n·d takes both signs.

  A straddling face carries its **isocline** points. Each is a mesh edge whose vertices' n·d differ in sign, bisected (60 steps) on the exact normal; a vertex exactly on n·d = 0 (a circle's quadrant point) counts as one. IM5 builds the parting line from these points.

  Each face also reports its side (+, − or ±), its least and greatest draft, its steepest |draft|, its area, and the area under the minimum by triangle centres. That last figure is coarse, one strip per triangle row, and the record says so.
- **In the report**: the moulding rule `draft` now judges every face against the finish's least draft, warning on steep and straddling faces and naming them. It is unknown without a pull or a finish. `mould.draft` lists every face. The `draft` tool (v2 `query.draft`) and the `draft_min` requirement now read the exact field, curved faces included. Before, they judged flat faces only; the tool's description now says so. The contract overhead is unchanged at 14 544 of 15 000.
- **Tests** (`test/mould-draft.test.ts`, 6; oracles closed form):
  - a cone drafted 3°: its side is 3° at every sample to 1e-9. It is drafted against 0.5° and 3°, and steep against PM-T2's 5°, with all of its area under. Its top is +90° and its bottom −90°;
  - a box drafted 2°: its four walls are 2° to 1e-9. Undrafted, they are 0° and steep. Pulled along +X, its X faces are ±90°;
  - a cylinder along the pull is 0° and steep. Across the pull it straddles, its draft running −90° … +90°, and every isocline point has z = 0 to 1e-9, at radius 10 (to the mesh's 1e-3);
  - a fillet (r 4) runs 0 … 90° across it, steep at its foot;
  - the report: a 3° cup passes PM-T1 and is warned under PM-T2, with its four walls named. Mutants (0° smooth, 2° on PM-T1, 0.4° smooth) are warned; 0.5° on smooth passes; no finish is unknown;
  - through the tools: `draft` gives the cone's side 3°, drafted, and `draft_min` as a requirement passes.

  `test/mould.test.ts`'s box is now warned for its undrafted walls, with PA12's note asserted. The type errors in that test from IM1 (`delete` on a read-only value; `null` for the mould argument) are fixed: `tsc` covers the tests, and IM1's run had only bundled them.
- **Flow**: an IM2 step through the real chat and tool servers. A drafted cone loaded with its mould settings: `draft` says `n1.side0` is 3°, drafted, and the report judges the part as injection moulding.

## O79 — IM3: undercuts by ±d visibility, with side actions (2026-10-21)

The coordinator accepted IM2 and ordered IM3.

- **What is an undercut** (`src/mould/undercut.ts`). The mould opens along the pull d: the half moving along +d frees what it sees along +d, and the other half what it sees along −d. A point that neither sees is an undercut.
- **Sampling**. Each display triangle is split into n² equal sub-triangles. n is the triangle's longest edge over the sampling step (the part's diagonal / 400, at least 0.05 mm), at most 64. Each sub-triangle's centre is moved 0.01 mm off the triangle along its normal, and a ray is cast along +d and along −d through the studio's triangle BVH (`print/orient.ts`, AM4). A sample hidden both ways is an undercut, and carries its share of the triangle's area.
  - The first version sampled only each triangle's centre. It missed the plate under a snap hook's latch: a big flat face shadowed by a small overhang has its centre in the open. Hence the sub-grid.
  - A 0.1 mm latch over a 44 mm triangle is still under the cap's step (0.7 mm). The method states the step it used.
- **Regions**: triangles with hidden samples, joined at shared positions.
- **Side actions**: for each region, the two axes across d are tried both ways (±X and ±Y for a pull along Z). The side action is the direction whose rays free every hidden sample, counted rather than summed: a float sum of areas came to 0.9999999999987 on an exact case. If no direction frees them all, the best direction is reported with its share.
- **In the report**, the moulding rule `undercut` is:
  - **pass**: no region;
  - **warn**: every region freed by a side action, each named;
  - **fail**: some region freed by no straight action across the pull ("a collapsing core, a lifter or a redesign");
  - **unknown**: no pull.

  `mould.undercuts` lists each region's faces, area, centre, side action and best share.
- **The chat** now summarises `check_printability` as its process and each rule's status ("injection: pull pass, …, undercut warn"). The whole JSON runs past the chat's 160-character line.
- **Tests** (`test/mould-undercut.test.ts`, 4, constructed oracles):
  - **A block with a hole along the pull and one across it**: the side hole's bore is the one region, its area the bore's mesh area to 1e-9, freed along its own axis (±Y). Pulled along Y instead, the vertical hole is the one region, freed along Z.
  - **A snap hook standing on a plate** (latch 1 mm): one region of three parts — the catch (1 × 6), the beam's face under the latch (12 × 6) and the plate under it (1 × 6). Its area is 84 to within 1 mm² (the step), and it is freed by a side action along +X, the latch's way. A plain post in the hook's place (the mutant) has none.
  - **An internal groove in a bore along the pull**: hidden both ways, and no side action frees it (best share under 1). Its regions' centres are within the groove's height.
  - **The report**: the side hole is warned with its side action named; the groove fails; a plain box passes; no pull is unknown. The chat's summary is checked.

  `test/mould.test.ts` now expects the IM1 box to pass on undercuts, with an empty list.
- **Flow**:
  - IM2's step now reads the report through the chat's summary: draft pass, undercut pass;
  - a new IM3 step through the real chat and tool servers: a block with a side hole, with the process set in the Library panel and the report run, ends in "undercut warn".

## O80 — IM4: walls, ribs, bosses, inside corners and sink; the undercut rule states its sampling limit (2026-10-21)

The coordinator accepted IM3 and asked for one addition, folded in here: when the step is capped, the undercut rule's message must itself say so ("may be missed below <step> mm"), not only its `method`.

- **The undercut rule's limit**. `undercuts` now returns `coarsestMM`: the largest sample spacing used, more than the step where a large triangle's n was capped at 64. Every undercut message, a pass included, ends with "(sampled every ≤ C mm: an undercut smaller than that may be missed)". On a 40 × 30 box, C is 0.781: the 50 mm diagonal over 64.
- **Local thickness** (`chat/analysis.ts wallSamples`). At each display triangle: the inward ray's depth, then twice the distance from the ray's middle to the nearest surface (capped at the depth), which is the inscribed sphere there. A rim's ray runs down its wall's length, but the sphere at its middle touches the wall's two faces, so the rim reads its wall. The nearest-surface query goes through the analysis grid's cells. The **thinnest** stays the ray depth, because the sphere reads low near a concave corner, where its middle is nearer the next wall. That only lowers thick sections, so they still use the sphere.
- **Sources** (`materials.json`, W-WEB, read 2026-10-21):
  - `adjacentWallRatio` 0.6, from Protolabs: "adjacent walls should stay within 40% to 60% of each other's thickness". The page's range is read as a thickness ratio of at least 0.6, its stricter end, and the value's note says so;
  - `insideRadiusRatio` 0.5, from Hubs: "a fillet equal to 0.5x the wall thickness to internal corners";
  - `ribHeightRatio` 3, from Hubs: "max. height equal to 3x the wall thickness". Recorded for later; rib height is not judged yet;
  - the boss wall range 0.6–1.0 stays the flagged P-INJ rule of thumb, with no page.
- **The analysis** (`src/mould/walls.ts`), per body:
  - **nominal**: the local thickness's area-weighted median, with the thinnest and the 95th percentile beside it;
  - **ribs**: two exact planes facing opposite ways, the nearest behind each within 3 × nominal, their boxes overlapping across the normal, and a ray out of either side hits the body. The ray test is what separates a box's own walls from a rib: an outer face sees out;
  - **bosses**: an outer and an inner exact cylinder on one axis (the part's face table); the boss wall is R − r;
  - **inside corners**: concave fillets are exact cylinders that face their axis and turn less than half a revolution, counting every display piece of the face, since a split hole's half spans under 180°. Sharp concave corners are straight edges between exact planes where the second face, just off the edge, lies on the first's outer side. "Just off the edge" means its triangle on the edge, not its centroid, which an annulus such as an open box's rim has in its hole.
  - **thick sections**: where the local thickness passes nominal / adjacentWallRatio.
- **The rules** (all recommended level):
  - `wall-uniform`: the thinnest over the nominal and the nominal over the 95th percentile, both at least 0.6;
  - `rib`: thickness at most 0.6 × nominal, warned with "sink on the face opposite"; n/a with no rib;
  - `boss`: wall within 0.6 … 1.0 × nominal; n/a with none;
  - `inside-radius`: no sharp corner, and every fillet at least 0.5 × nominal;
  - `sink`: no thick section, warned with "core them out".

  `wall-material` now uses the same local thickness. `mould.walls` lists each body's nominal, thinnest, thick95, ribs, bosses, fillets, sharp-corner count and thick section.
- **Tests** (`test/mould-walls.test.ts`, 5, analytic and constructed oracles):
  - a shelled box (t 2): nominal, thinnest and thick95 all 2 to 1e-6; no rib, boss or thick section; its eight inside corners sharp, with lengths 56, 56, 36, 36 and 23 × 4;
  - a rib inside it: found at 1.2 to 1e-9, passing as 0.6 t; at 2 (the mutant), warned;
  - bosses: R 3 with a Ø2.5 bore has a wall of 1.75 to 1e-9 and passes; R 5 is warned; R 5 solid has no boss, and a thick section on its side, between 2/0.6 and its diameter 10;
  - an L bracket (t 3): a fillet of 2 is found with its exact radius and passes; 1 is warned; with none, one sharp corner 20 long;
  - a floor made 5 mm thick in a 2 mm box: nominal 2, thick95 5, `wall-uniform` warned at 0.4, `sink` warned.

  The IM1 and AM3 tests are updated for the longer rule list.
- **Flow**: IM2's chat-summary match includes the new rules. A new IM4 step through the real chat and tool servers builds a shelled box with a 2 mm rib: "rib warn, boss n/a, inside-radius warn, sink pass".
- **Found, not fixed (follow-up)**: a `hole` on a cylinder's top face after that cylinder was united into a shell is refused with "the hole at (15, 20) along z misses the target", although the face is there. The tests drill the boss before the union.

## O81 — IM5: the parting line — halves, loops, the isocline across straddling faces, the person's override; the face split asked of the kernel lane (2026-10-21)

The coordinator accepted IM4 and ordered IM5. Two instructions came with it. If splitting a straddling face along its isocline needs a kernel face-split-by-curve, stop and say so; the loops and the override can be built first without it. And add a minimal repro of the hole-after-union refusal.

- **The repro**: `test/fixtures/hole-after-union.calls.json` holds five calls: a box, its shell, a cylinder, their union, then a hole on `n4.top`. `test/known-bugs.test.ts` runs it as a node `todo` test: it runs and reports, and does not fail the suite until the bug is fixed. It is listed in README §0's follow-ups for the kernel lane.
- **The halves** (`src/mould/parting.ts`). Each face goes to a half by its draft field (IM2, exact normals):
  - **+**: it releases along the pull;
  - **−**: it releases against it;
  - **a wall along the pull** (n·d 0 throughout; IM2's draft field now says side `0` rather than `−`): where the person says, else `−`;
  - **a straddling face**: split, unless the person puts it whole in one half.

  The person's halves live in `doc.mould.sides`, `{face: "+" | "-"}`, a versioned addition. `check_printability` takes `sides` as an argument, and an argument wins over the document.
- **The line**:
  - every display-edge segment between the halves, judged at its middle; next to a straddling face, that face's half at the point comes from its exact normal;
  - across each straddling face, its isocline n·d = 0, traced by marching its triangles. Each mesh edge's crossing is bisected 60 times on the exact normal and shared by position between the two triangles on that edge.

  The pieces are chained into loops, joined within half the longest piece, because a crossing on a face's rim meets its edge's segments mid-segment. Each loop reports whether it is closed, its length, its extent along the pull, and whether it is flat (within the mesh's 1e-4).
- **The face split is not built.** Moulding a straddling face in two halves needs the face split along its isocline: a face split by a curve, which is a kernel operation. The report names each such face and its isocline length. **Asked of the kernel lane** through the coordinator: `splitFaceAlongCurve(brep, face, curve)`, or a split of a face by the isocline n·d = 0 directly. Until then, the person can put the face whole in one half.
- **In the report**, the moulding rule `parting`:
  - **pass**: every loop closed and no face to split;
  - **warn**: a straddling face to split (named, with its isocline length and the remedy), an open loop, or no loop at all (the whole part in one half);
  - **unknown**: no pull.

  `mould.parting` lists each face's half and basis, the faces to split, and the loops.
- **Tests** (`test/mould-parting.test.ts`, 4, closed forms):
  - **a box pulled along +Z**: its walls go to − by default, giving one loop round the top, 140 long (2 × (40 + 30)) to 1e-9 and flat at 10. Put in +, the loop runs round the bottom at 0;
  - **a box drafted 2°**: its walls go to + by their draft, giving a loop round the bottom, 140 at 0;
  - **a cylinder lying across the pull**: it straddles, with an isocline 80 long to 1e-9 (the lines z = 0, y = ±10). The loop is closed round the isocline and the caps' upper halves: 80 plus two 16-chord half circles (2 × 16 × 10 × sin(π/32) each), to 1e-4, stepped 0 … 10, its isocline points on z = 0 to 1e-9. Put whole in +, it has two loops, each the caps' full 32-chord circle;
  - **the report**: a box passes ("1 parting loop (flat, 140 mm)"); the cross cylinder is warned, the face named; the document's sides or the tool's pass; all in one half gives "0 parting loops" (warned); no pull is unknown; a bad `sides` is refused.

  The IM1, IM3 and AM3 tests are updated for the rule.
- **Flow**: an IM5 step through the real chat and tool servers. On a cross cylinder the report ends "parting warn"; with `sides` putting it whole in +, "parting pass".
- The contract overhead is unchanged at 14 544 (tools/list 115 716, 101 172 plain); `tools-v1.json` is updated as a compatible change.

## O82 — IM6: the quote package; the IM track closed (2026-10-21)

The coordinator accepted IM5 and ordered IM6. IM6 closes the IM track; its summary follows, then CNC starts with an S0.

- **The package** (`src/mould/quote.ts`, `quotePackage`). One zip, written with fixed timestamps so the same part gives the same bytes:
  - `part.step` — the part;
  - `dfm.json` — the manufacturability report, IM1–IM5;
  - `dfm.md` — the same as a page to read, with the request and each rule's status and why;
  - `quote.json` — the request: material (its basis: the body's or the brief's), finish and its least draft, pull, quantity (given, else the brief's stated one), the part's size, volume and mass, the tolerance and shrink with their sources, the press limits, and the document's revision digest;
  - `manifest.json` — every file's SHA-256 and size, what is **open**, and `complete`.
- **There is no price**: prices are the moulder's, and the package says so.
- **Open** covers an unstated material (or bodies of different materials), quantity, pull or finish, a missing STEP, a failing rule, and an unknown rule. A warning is not open: the report carries it. The package is **complete** only when nothing is open.
- It is refused unless the process is injection moulding, and refused for a quantity that is not a whole number above 0.
- **Where to get it**:
  - `cad-cli mould-quote part.bcad -o package.zip [--quantity n]`, exit 1 while anything is open;
  - the Library panel's **Quote package** button, shown when the process is moulding. The button is a prop, `onQuote`, handled in `App.tsx`. The panel imports nothing new from domain code: the PKG rule.

  There is no new agent tool: the contract has 456 characters of headroom, and every report value is already in `check_printability`.
- **Tests** (`test/mould-quote.test.ts`, 3):
  - **Complete**: an ABS block drafted 3°, 1000 stated, PM-T1, pulled along +Z. Nothing is open. The zip holds the five files by its local headers, and each file's SHA-256 matches node:crypto's.
    - The volume matches the drafted block's closed form, 25 (2400 − 100 d + 4d²/3) with d = 25 tan 3°, to 1e-6. The mass is that volume × ABS's density.
    - Tolerance ±0.08 + 0.002 mm/mm comes from the services page; shrink is 0.002; the press is 751 × 480 × 203.
    - The STEP is ISO-10303-21, and the page says "No price".
  - **Nothing assumed**: with no material and no quantity, both are open and the mass is null. A finish asking more draft than the part has is warned, not open. No process and quantity 2.5 are refused.
  - **The CLI**: exit 0 when complete, 1 without a quantity, 0 with `--quantity 250`.
- **Flow**: an IM6 step. A drafted ABS block with its mould settings and a stated quantity: the Library panel's Quote package downloads `…-quote.zip`, and the toast says it is complete.

### The IM track, IM1–IM6 (O76–O82): summary

- **What it is**: injection moulding's manufacturability, judged on the exact part. All of it lives in the one report, `check_printability`, which names the process it judged by (v2 `query.manufacturability`); with no process, nothing is assumed. The quote package carries it out.
- **Exact, not the display mesh**: drafts come from exact normals — planes, cylinders, and NURBS faces by projection (Gauss–Newton on D1, stepping off C0 knots). The display mesh's normals are off by 0.014° on a 3° cone. The isocline n·d = 0 is bisected on the exact normal.
- **Sampled, and said so**: undercut visibility uses ±d rays on a sub-triangle grid, and its coarsest spacing is stated in the message. Wall thickness uses the inscribed sphere at each inward ray's middle, with the ray itself for the thinnest. The area below a draft minimum is by triangle centres, and is coarse.
- **Sourced**: every Protolabs and Hubs value is recorded with its page, the date read and the page's label (W-WEB), and `checkMaterials` refuses a web value without its page. PA12's range is the page's nylon family row, and says so. Where no page gives a value (the boss range, the minimum wall), it stays the flagged P-INJ rule of thumb.
- **The rules**: pull, finish, wall, wall-material, wall-uniform, rib, boss, inside-radius, sink, size, draft, undercut, parting. Each has a closed-form or constructed oracle and a mutant.
- **For the kernel lane** (queued by the coordinator):
  - a face split by a curve, to mould a straddling face in two halves (IM5);
  - the hole-after-union refusal, kept as a `todo` test with its fixture;
  - the triangle-BVH consolidation (track K).
- **Not built**: rib height (Hubs' 3 t is recorded); casting (IM8); shut-offs, the parting surface, core and cavity, and side cores (IM7); a price.
- **Counts across the track**: 31 studio tests added (S0 4, IM1 5, IM2 6, IM3 4, IM4 5, IM5 4, IM6 3), 1 todo (the kernel repro), 6 flow steps (IM1–IM6). The contract overhead is unchanged at 14 544 through the track.

## O83 — CNC S0: what machining can measure exactly today, its sources, and the plan for CNC1–CNC6 (2026-10-21)

The coordinator closed IM with O82 and ordered CNC to start with an S0. Evidence is in `test/cnc-s0.test.ts` (4 probes).

- **What exists**:
  - the brief's processes `cnc-milling` and `cnc-turning`, with no profile in the material library yet;
  - the standards data: metric coarse threads, tap drills (d − P), clearance holes, each flagged as sourced or derived (`standards/provenance.ts`, `standards_lookup`);
  - the drawing's callouts, datums, tolerances and threads (R14, `src/drawing/`), with no surface-roughness note;
  - IM's exact queries: exact normals by projection (`mould/draft.ts`), visibility rays through the studio BVH (`mould/undercut.ts`), the walls' fillets, sharp corners and local thickness (`mould/walls.ts`);
  - the kernel's STEP writer: AP214/AP242 B-rep and AP242 tessellated, with **no semantic PMI**.
- **The probes**:
  - **P1, a pocket**: in a 120 × 80 × 12 plate, its four vertical corner radii are found exact (r 5) and its floor by exact planes (depth 8). That compares against Hubs' "larger than ⅓ x pocket depth" (5 ≥ 2.667). Found and fixed on the way: `wallsOf` grouped a feature's fillet pieces by name alone. A pocket's four corners are one feature, so they were read as a full turn and not as fillets; pieces are now grouped by name and axis (`sameAxis`). IM4's tests are unchanged and pass.
  - **P2, access from six directions**: on a block with a side hole, every triangle is seen from one of ±X, ±Y, ±Z, its bore along ±Y; a greedy setup count gives two. Rays along a face count it seen, which is side milling's reach; CNC4 adds the tool's side, n·t ≥ 0. An internal groove is seen from none of the six.
  - **P3, a hole**: Ø5 and 30 deep, from its exact cylinder and its extent, has depth over diameter of 6. That is Hubs' "Maximum depth: 6 x nominal diameter".
  - **P4, turning's axisymmetry**: on a drafted cylinder (a cone, end planes) about Z, every exact normal meets the axis, n · (a × (p − c)) = 0 to 1e-9. On a box the side faces miss it by more than 0.5.
- **Sources** (public HTML, read-only, 2026-10-21; values recorded per value in CNC1):
  - **Hubs' CNC machining guide** (`hubs.com/guides/cnc-machining/`):
    - inside edges larger than ⅓ × pocket depth;
    - pockets 4 × width recommended, 10 × tool diameter feasible;
    - walls 0.8 / 0.5 mm in metal and 1.5 / 1.0 in plastic;
    - holes 4 × d recommended, 6 × d maximum;
    - threads 3 × d long, M6 recommended, M2 feasible;
    - small features 2.5 / 0.5 mm;
    - tall features h/w < 4;
    - tolerance ±0.125 standard, ±0.025 feasible;
    - milling 400 × 250 × 150; turning Ø500 × 1000;
    - undercuts 3–40 mm wide and at most 2 × wide deep.
  - **Protolabs' CNC service page** (`protolabs.com/services/cnc-machining/`):
    - milling size 559 × 356 × 95.3 and 650 × 650 × 300;
    - tolerance ±0.127 mm without a drawing, with the classes **ISO 2768-1 f** (metals) and **m** (plastics). The class is named; its values are not copied;
    - text 0.457 / 0.838 mm wide and 0.3 deep;
    - turning Ø100.33 × 228.6 and Ø431 × 990, walls 0.51.
  - Its milling and turning guideline pages are linked HTML, to read in CNC1. No PDFs.
- **The plan**, each stage with oracles, mutants where it is a check, and a flow step, all inside the one manufacturability report (`check_printability`, `query.manufacturability`), as IM's are:
  - **CNC1**: `cnc-milling` and `cnc-turning` profiles sourced page by page, metal or plastic by the material's family; the tolerance class named, with its values sourced; warn and error levels by recommended and feasible.
  - **CNC2**: holes and threads — each bore's depth over its diameter, standard drill sizes, tap drills and thread depth from the standards data, counterbores (stepped coaxial bores), cosmetic threads and callouts.
  - **CNC3**: tool radius, depth and walls — inside vertical corners against ⅓ × depth (fillets, and sharp corners as radius 0), pocket depth against width, the thinnest wall (IM4's walls) against metal and plastic, small features, text stroke.
  - **CNC4**: access and setups — the six directions with the tool's side, undercut flags (seen from none), a greedy setup count, the envelope against the machine's.
  - **CNC5**: drawing and PMI minimum — views, hole callouts, datums, a tolerance note, material, Ra, all checked on the drawing (R14). **AP242 semantic PMI in the STEP writer is a kernel-core change**, so CNC5 stops there and asks; the drawing check does not need it.
  - **CNC6**: turning — axisymmetry by P4, grooves, thread relief, L/D, against the turning profile.
  - **RB9 rung 4**'s held "machinable" rule becomes real when CNC1–CNC4 land.
- **Kernel-core**: none is needed for CNC1–CNC4 or CNC6. CNC5's semantic PMI is the kernel's.

## O84 — CNC1: machining's process rule, sourced page by page (2026-10-21)

The coordinator accepted the CNC S0 and set a process rule: a product-file change needs the full flow before its checkpoint, even when the suite passes. O83 had skipped it for the `walls.ts` fix. This checkpoint runs the flow. The rule is recorded as feedback.

- **The profiles** (`materials.json`, W-WEB, read 2026-10-21), every value with its page and label:
  - **`cnc-milling`**:
    - walls: metal 0.5 feasible and 0.8 recommended, plastic 1.0 and 1.5 (Hubs);
    - inside edges above ⅓ × pocket depth; pockets 4 × width; holes 4 × d recommended and 6 × d at most; threads 3 × d long, M6 recommended, M2 feasible; small features 2.5 and 0.5; tall features h/w under 4 (Hubs);
    - tolerance ±0.125 standard, ±0.025 feasible (Hubs);
    - a typical mill 400 × 250 × 150 (Hubs);
    - the deepest milled 50.8 from either side; engraved text 0.457 and 0.838 wide, 0.3 deep (Protolabs' milling guidelines).
  - **`cnc-turning`**:
    - the same walls and standard tolerance (Hubs), and ±0.13 (Protolabs' turning guidelines);
    - a lathe Ø500 × 1000 (Hubs);
    - from Protolabs: Ø0.76 in any region, walls 0.51, outside grooves at least 1.2 wide and at most 24.1 deep, holes 1 on the axis and 2 radial, point angles above 30°.
  - **Tolerance classes**, a new profile field `toleranceClasses`: ISO 2768-1 f for metals and m for plastics, from Protolabs' CNC page. The class is named; its values are the standard's and are not copied, and the note says so. `checkMaterials` checks its page.
- **The report** (`src/machining/report.ts`, through `check_printability` / `query.manufacturability`, which names `cnc-milling` or `cnc-turning`):
  - **material**: one material for the part, its family the library's (metal, or polymer read as plastic); unknown when none is set or the bodies differ, and none is assumed;
  - **wall**: the thinnest (IM4's ray) against the family's feasible (fail) and recommended (warn) limits; unknown without a family;
  - **size**: for milling, the sorted sides against the mill's. For turning it is unknown until its axis (CNC6);
  - **holes**, **corners**, **access**, **drawing**: unknown, naming CNC2–CNC5. Turning adds **turning** (CNC6).

  `machining` adds the family, the material, the tolerance with its source, and the class.
- **The brief**: CNC milling and turning have rules now, so a stated machining process becomes the part's process. The brief's "recorded as intent" notes for them are removed; sheet metal's stays. Two changes follow from this:
  - the A6 fixture `conformance/a6/briefs/non-library-material.json` (stated "machined") now expects `cnc-milling` applied, its note saying why;
  - AM1's profile list now includes the two machining profiles.
  - the A8.1 scenario `conformance/a8/scenarios/reviewer-skipped.json` needs a process the DFM reviewer can't check, so it moves from CNC milling to sheet metal, its note saying why. Its expected verdicts (held, dfm skipped NOT_CHECKED) are unchanged;
  - R6b.7's profile list now includes the two machining profiles.
- **Tests** (`test/cnc-process.test.ts`, 5):
  - the data: every value's page, and the classes named, not copied;
  - an aluminium block 100 × 60 × 20: a metal, so material, wall and size pass. Its size ratio is exactly max(100/400, 60/250, 20/150), its tolerance ±0.125 under ISO 2768-1 f, and CNC2–CNC5 are said to come;
  - walls by family: in aluminium, 0.6 is warned and 0.4 fails; in ABS, 1.2 is warned, 0.9 fails and 2 passes, under ISO 2768-1 m;
  - nothing assumed: with no material, material and wall are unknown and there is no class; 450 long fails; turned, size and turning are unknown (CNC6); with no process, none is assumed;
  - through the tools: a stated CNC milling in aluminium becomes the part's process and the report judges by it.
- **Flow**: a CNC1 step. CNC milling is chosen in the Library panel, which shows no moulding settings. An aluminium block is made and set through the real chat and tool servers: "cnc-milling: material pass, wall pass, size pass, holes unknown, corners unknown, access unknown, drawing unknown".

## O85 — CNC2: holes and threads from the exact geometry (2026-10-21)

- **Holes found** (`src/machining/holes.ts`, `holesOf`):
  - A bore is a concave exact cylinder that goes round more than half a turn. Concavity is read from its triangles' normals against the radial direction, not from the face table. Half a turn or less is a fillet (CNC3's).
  - A hole is the bores on one axis line, of any radius. Its steps are one radius each: pieces the kernel split are joined, with their extents along the axis.
  - An end is open when a ray down the axis from just inside it leaves the part (the studio's BVH, as IM3 uses).
  - A step's **reach** runs from the nearer open end to its far side, counting only an end with no narrower step between. A wider step behind a narrower one is an internal groove, which no straight tool reaches: its reach is null, as is a hole open at neither end. Both go to CNC4's access.
  - A **counterbore** is a wider step at an open end.
- **Tapped holes** (`tappedHoles`): the document's `hole.thread` (cosmetic, "M6×1"), matched to its bore by face name (`n4.side0` is node n4's). Patterned copies are judged by their worst.
- **The rules** (milling; turning's holes stay unknown, naming CNC6), in place of CNC1's placeholder `holes`:
  - **hole-depth**: the deepest step's reach over its diameter. Over Hubs' 4 × is warned, over 6 × fails. A hole reached from no end is unknown, naming CNC4.
  - **hole-size**: each hole's narrowest step, which is the drilled one:
    - under the 0.5 mm least feature fails; under the 2.5 mm that standard tools cut is warned (Hubs);
    - off the drill table is warned, against Hubs' "standard drill bit sizes", naming the sizes either side;
    - above the table's 25 mm the hole is milled, and only counted;
    - wider steps (counterbores) are milled, and only counted.
  - **thread**:
    - a bore that is not its tap drill (d − P, the fastener table) fails;
    - a size under M2 fails, and under M6 is warned (Hubs);
    - a length over 3 × d is warned (Hubs: "Threads longer than 3 times the nominal diameter are unusable");
    - a size outside the fastener table (M3–M12) has its tap drill unknown;
    - a bore cut away is unknown.
  - With no holes, the rules pass and say so.

  The report's `machining` adds `holes` and `tapped`.
- **The drill table** (W-WEB, read 2026-10-21): Engineers Edge's "ISO (Metric Size Drills)" table at `engineersedge.com/drill_sizes.htm`.
  - The steps as read: 0.35–2.75 by 0.05; 2.8–10 by 0.1, with the quarter sizes it lists; 10–25 by 0.5. The quarters were read as a pattern from those listed, not checked one by one, and the note says so.
  - These go in as new milling thresholds (`drillMinMM` … `drillCoarseStepMM`), each with its page and label, plus `holeDiameterRec` holding Hubs' label.
  - Protolabs' milling page names "metric threads from M2 to M12" in its own factory. That is one supplier's limit, so it is not a rule.
- **Tests** (`test/cnc-holes.test.ts`, 6). Each oracle is the construction (the depth and diameter as built), not the geometry read back:
  - Ø5 blind 20, 30 and 32 deep give 4, 6 and 6.4 × d: pass, warn, fail. Mutants: moving the profile's maximum to 7 warns, and moving the recommended too passes;
  - a counterbored Ø6.6 through 20 with Ø11 × 6: open at both ends, with reaches 14 (from the bottom) and 6 (from the top), counterbored, passing;
  - the drill table's step rule against an enumerated list, every 0.01 mm from 0.30 to 26;
  - hole size:
    - Ø5 and Ø3.25 standard;
    - Ø5.03 warned (5 or 5.1);
    - Ø2 warned;
    - Ø0.4 failed (set on the node directly: the hole command's least is 0.5);
    - Ø30 milled;
  - threads:
    - M6 blind 12 on Ø5 passes;
    - M6 through 20 is warned (over 18);
    - M3 is warned;
    - a mutant with the bore at Ø5.5 fails, "not its tap drill Ø5 (d − P)";
  - no straight reach: the internal groove's Ø16 step reach is null, and a sealed void is open at neither end. Both are unknown, naming CNC4; with no holes, all pass.
  - CNC1's tests now expect the hole rules to pass on a plain block, and the data test allows the drill table's page.
- **Flow**:
  - the CNC1 step now reads "… size pass, hole-depth pass, hole-size pass, thread pass, corners unknown …";
  - a new CNC2 step, through the real chat and tool servers: a 60 × 40 × 20 aluminium plate with a counterbored Ø6.6 and an M6 tapped through. The report reads "hole-depth pass, hole-size pass, thread warn", with the holes' nodes as built.

## O86 — CNC3: inside corners, cavities, small features, tall walls, text; derived drill steps marked (2026-10-21)

The coordinator accepted CNC2 with one flag. Drill sizes "read as a pattern" are not values as printed, so they are marked derived. That fix lands in this commit.

- **Derived values**:
  - a new library source `W-DERIVED`: derived from a public page by a stated rule, not a value as printed;
  - the drill table's four steps (`drillFineStepMM`, `drillStepMM`, `drillQuarterStepMM`, `drillCoarseStepMM`) are now `W-DERIVED`, each note starting "derived:" and stating its rule. The quarter step reads as a pattern from the quarter sizes listed. The others are the step between the listed sizes, which the page prints as sizes, not as a step;
  - the table's ends as printed (0.35, 2.75, 10, 25) stay `W-WEB`;
  - `checkMaterials` refuses a derived value without its page and its rule.
- **What a tool leaves** (`src/machining/cavities.ts`, `cavitiesOf`), from the exact geometry and rays through the studio's BVH:
  - **Inside corners**: concave cylinders spanning half a turn or less, with pieces on one axis and radius joined.
    - A fillet is an **edge fillet** when a plane beside it looks out along its normal: a corner-radius or ball tool cuts it from that side. The display drops smooth edges, so the planes it is tangent to are found by geometry: the axis lies r off the plane on its outer side, and a vertex sits on the tangent line.
    - Otherwise it is a **cavity's corner**: its axis line, which lies in the cavity, leads out of the part (a straight tool's axis). Its depth is its axial extent.
  - **Sharp concave edges between planes**:
    - **cut sharp**, when the planes are square and one looks out along its normal beside the edge (the end mill's end on it, its side on the other);
    - otherwise a **sharp corner**, radius 0, reached along the edge if a ray from just inside it, either way, leaves the part. If no ray does, it is closed;
    - an edge between planes that are not square is **angled**.
  - **Floors**: a plane looking out along its normal, with a neighbour rising above it across a concave edge. Straight edges are tested beside the edge; curved ones (a round pocket's, a boss's) are taken as rising. An L's side face meets the floor at a convex edge and does not rise.
    - Its depth is the highest rising neighbour.
    - Its width is its narrowest extent, by rotating calipers on its hull, measured only across directions with a rising neighbour wholly at or past each side. A rib's top between two walls is as wide as the walls are apart. A step, open on a side, is not a cavity.
    - A floor that only a hole's bores rise from is the hole's bottom (CNC2's).
  - **Tall features**: IM4's ribs. The height runs across the rib face from its longest concave straight root edge; with no root edge, the height is unknown.
- **The rules** (milling; turning's corners stay unknown, naming CNC6), in place of CNC1's placeholder `corners`. All are recommended-level with sourced limits (Hubs); a fail needs a sourced feasible value:
  - **corners**: each corner reached along a tool's axis, its radius against ⅓ × its depth (warn under). A sharp corner reads "a rotating tool leaves its radius". Closed and angled corners are unknown, naming CNC4. Edges cut sharp and edge fillets are counted;
  - **pocket**: the deepest floor for its width, against 4 × (warn over);
  - **feature**: the narrowest cavity, failing under 0.5 mm and warned under 2.5 mm;
  - **tall**: the tallest thin wall for its thickness, warned at 4 × or more (Hubs: "height / width is < 4"); one unmeasured is unknown;
  - **text**: the studio has no text feature, so it passes, saying so. With an imported or mesh body it is unknown: text in it is not read. Protolabs' stroke and depth are named in the reason.

  The report's `machining` adds `cavities`. Shared helpers: `concaveSpan` and `extent` from holes.ts, and `besideEdge` (now exported) from walls.ts. IM4's behaviour is unchanged.
- **Tests** (`test/cnc-cavities.test.ts`, 7). Each oracle is the construction:
  - the data: the four steps are derived with their rules, and the table's ends are printed values. A mutant derived value without its note is refused;
  - `narrowest` against closed forms: a rectangle, a rotated one, and a 360-gon's 20 cos(π/360);
  - a 50 × 30 pocket 8 deep with r 5 corners: four corners reached (r 5, depth 8), one floor 8 deep and 30 wide, everything passing. The mutant r 2 is warned, "under ⅓ of it (2.667)";
  - the pocket with sharp corners: four corners of radius 0, depth 8, reached and warned; its four floor edges are cut sharp;
  - slots 2 wide: 8 deep is exactly 4 × and passes; the feature is warned (2 mm); 10 deep is 5 × and warned. Mutants: the pocket limit moved to 6 passes; the feasible least moved to 2.2 fails;
  - a shelled box with a rib 1.2 thick and 15 high: tall 12.5 × is warned, a 4 mm rib (3.75 ×) passes. The rib's top is a cavity 8 deep and 36 wide (the walls), not 1.2. The shell's sharp inside corners (23 deep) are warned;
  - an L bracket: its inside edge is cut sharp and the base is a step, so there is no cavity. Filleted r 5, it is an edge fillet, not a cavity's corner.
  - CNC1's block test expects the new rules to pass; CNC2's tests are unchanged and pass.
- **Flow**:
  - CNC1's and CNC2's steps read the new rules;
  - a new CNC3 step, through the real chat and tool servers: a 120 × 80 × 12 aluminium plate with a 50 × 30 pocket 8 deep reads "corners warn", sharp. Filleted r 5, it reads "corners pass".

## O87 — CNC4: access from the six directions and setups; RB9 rung 4's "machinable" made real (2026-10-21)

- **Access** (`src/machining/access.ts`, `accessOf`):
  - Each surface sample uses IM3's grid: every display triangle split into n² parts, n from its longest edge over a step (the diagonal over 200, at least 0.1 mm, n at most 48), each part's centre 0.01 mm off it.
  - Each sample is tested against ±X, ±Y and ±Z, the directions a part is set up along. A direction **reaches** a sample when the tool comes from the face's side (n · d ≥ 0: the end on it, or its side along it, which is side milling) and the ray along d leaves the part (the studio's BVH).
  - A sample no direction reaches is an **undercut for a 3-axis mill**.
  - The samples' areas are kept in 64 bins by their 6-bit masks.
  - **Setups** are counted greedily over the bins: the direction reaching the most area not yet reached, then the next, until everything any direction reaches is covered. The count is exact for the samples.
- **The rules** (milling; turning's access stays unknown, naming CNC6), in place of CNC1's placeholder `access`:
  - **access**: the area no direction reaches is warned, its faces named: "a 5-axis setup, an undercut cutter or a change". It is a warning because no source gives a feasible limit; Hubs' undercut widths are not a reach rule;
  - **setups**: the greedy count and its directions. It is a count, not a judgement, since no source gives a limit.

  CNC2's and CNC3's undecided reaches (a step behind a narrower one, a closed corner) now point to the access rule. The report's `machining` adds `access`.
- **RB9 rung 4** (`src/rb9/rungs-plates.ts`): the held `machinable` is now a hard predicate.
  - It runs the CNC milling report on the plate. No rule may fail or be undecided, except material and wall: the brief states no material, so neither is judged. Stages not built yet are also left out (the drawing, CNC5). Warnings are kept in `measured`.
  - Over the rung's space, every sampled trial passes. The tightest are a 3 mm corner on an 18 mm pocket and Ø4 through 20, both warned, not failed.
  - Two mutants target it, both killed at both range ends:
    - **deep-hole**: a Ø0.5 blind hole T − 1 deep, over 6 × d, fails;
    - **groove**: an internal groove round a corner hole leaves a step reached by no straight tool, so the reach is undecided and the area unreached.
  - The ladder's check passes: every rung 5/5 with RS 1, every mutant killed, and no hard predicate without a mutant.
- **Tests** (`test/cnc-access.test.ts`, 4), against closed forms:
  - a 40 × 30 × 20 box: its area is 2(1200 + 800 + 600) exactly, and every face is reached. Setups: +X first (30·20 + 2·40·20 + 2·40·30), then −X (600);
  - a sealed 10 × 10 × 5 void: 400 mm² unreached (planar, so exact), its faces named, warned;
  - a side slot open to +X is reached. The mutant, stopped 1 mm short of the face, is sealed: 760 mm² unreached exactly;
  - an internal groove (r 8, 4 high, round a Ø10 bore): 142π hidden, within the chord (at least 98 % and at most exact). The bore itself is reached, and hole-depth's reason points to the access rule.
  - CNC1's block test now expects access to pass in two setups.
- **Flow**:
  - CNC1's step now reads "… access pass, setups pass, drawing unknown";
  - a new CNC4 step, through the real chat and tool servers: a side slot open to +X reads "access pass, setups pass"; the slot sealed reads "access warn".

## O88 — CNC5: the drawing a machined part goes with, on R14's drawing; AP242 semantic PMI left to the kernel lane (2026-10-21)

The coordinator's rule: stop before any AP242 semantic PMI in the STEP writer. CNC5 checks the studio's own drawing, which is the document a shop quotes and machines from. The STEP writer is not touched. Semantic PMI stays the kernel lane's queued request (flagged in O83).

- **Sources** (public HTML, read-only, 2026-10-21), each item naming its page and the page's words (`DRAWING_PAGES`):
  - Hubs' CNC guide:
    - "A technical drawing is required … When feature tolerances are required";
    - "If no tolerance is specified in the technical drawing, then the standard ± 0.125 mm will be held";
    - "The standard surface roughness of as-machined parts is 3.2 μm".
  - Hubs' technical-drawing page (`hubs.com/knowledge-base/how-prepare-technical-drawing-cnc-machining/`):
    - the title block's "part name, material, finish and color …", and "the standards used for dimensioning and tolerancing";
    - "Include one or more 3D pictorial views", with two or three orthographic views sufficient;
    - "dimensioning all critical features";
    - "Specify the location, size, and length of all threads";
    - finishing requirements annotated, the standard "Ra 3.2 μm".
- **The check** (`src/machining/drawing.ts`, `drawingCheck`; the report's `drawing` rule for milling and turning alike, its items in `machining.drawing`):
  - **Is a drawing needed?** Threads go on a drawing: with a tapped hole and no drawing, the rule fails. With neither threads nor a drawing, it passes: the standard ±0.125 mm holds. The studio states no tolerance tighter than standard outside the drawing.
  - **On the drawing** (`drawingInputs` and R14's `issueContext`):
    - **views**: a pictorial (iso) one among those shown, else warned. A drawing with no views chosen shows all four;
    - **dimensions**: R14's errors (lost dimensions, datums or frames, overlaps and the like) fail, because the sheet is wrong. Its warnings that leave a size or position unsaid (HOLE_SIZE_MISSING, HOLE_NOT_LOCATED, STEP_NOT_LOCATED, OVERALL_MISSING, VIEW_NEEDED) are warned;
    - **threads**: each tapped hole's designation is in a callout on the sheet (its size, and its length as THRU or DEEP);
    - **tolerance**: a general note ("UNLESS OTHERWISE STATED …", R14's own, or one naming ISO 2768);
    - **title**: the title block names the part (not the default "part");
    - **material**: a note names the part's material, by its library label or id. With no material set, or bodies that differ, it is unknown;
    - **finish**: when the brief states a finish, a note names it or gives an Ra. With none stated, it is as machined (Ra 3.2, the standard) and passes.
  - The rule takes the worst item and says how many are in order. The title block has no material or finish cell, so a note carries them; a title-block cell would be an R14 layout change, left as a follow-up.
- **RB9 rung 4**: `machinable` already left out the stages not built yet. The drawing is now built, so it is judged. The plate has no threads and no drawing, so it passes.
- **Tests** (`test/cnc-drawing.test.ts`, 4):
  - every item has its page;
  - no drawing:
    - a plain block passes, ±0.125 holding;
    - with an M6 tapped hole it fails, "no drawing, but 1 tapped hole (M6×1)";
    - the mutant, its thread taken off, passes;
  - a drawing made complete, through the agent's Auto-dimension, the four views, a title, the general note and the material note:
    - every item passes, "7 of 7 items in order";
    - each one taken away is the item warned. For views, title, tolerance and material it is the only item warned; dimensions and threads move together, because the callout is a dimension;
    - a dimension on an edge the part does not have fails (R14's error);
  - the finish: the brief states "bead blasted", so the drawing without it is warned and a note naming it passes. With no material set, material is unknown.
  - CNC1's block test expects the drawing to pass, needing none.
- **Flow**:
  - CNC1's step now reads "… drawing pass";
  - a new CNC5 step, through the real chat and tool servers: a plate with an M6 tapped hole and no drawing reads "drawing fail". After Auto-dimension in the Drawing workspace the M6×1 callout is on the sheet, and it reads "drawing warn": no general note, title or material yet.

## O89 — CNC6: turning; the CNC track closed (2026-10-21)

The coordinator accepted CNC5 and ordered CNC6, which closes the CNC track. Its summary follows.

- **Sources** (public HTML, read-only, 2026-10-21):
  - Protolabs' turning guidelines (`protolabs.com/services/cnc-machining/cnc-turning/design-guidelines/`). CNC1 already recorded the least diameter in any region (0.76), walls (0.51), outside grooves (at least 1.2 wide, at most 24.1 deep), holes (1 on the axis, 2 radial) and points (over 30°). New profile values:
    - `holeMinRadialSoftMM` 1 and `grooveWidthMinSoftMM` 0.5, "for aluminum and brass";
    - the least part, `minPartDiameterMM` 4.07 and `minPartLengthMM` 1.27.
    - Statements followed: live tools mill "flats, slots, and grooves"; holes "parallel or perpendicular to the axis of revolution", and at odd angles only in aluminium and brass; "ID grooves are not supported"; "Sharp inside corners … will be radiused"; outside corners "typically include a 0.005 in. chamfer".
  - Hubs' CNC guide: the lathe Ø500 × 1000 (CNC1), and turned parts "with rotational symmetry".
  - Neither page gives a part's L/D limit or a thread relief. L/D is reported in the turning message; neither is judged.
- **What a lathe makes** (`src/machining/turning.ts`, `turningOf`):
  - **The axis**: the line the part's exact cylinders share most by area.
  - **Turned**: a display triangle whose three corners' exact normals meet the axis (CNC S0's P4, n · (a × (p − c)) = 0 relative to the radius). That covers planes square to the axis, cylinders, and cones by projection. The rest, by face, is milled with live tools.
  - **Size**: the largest radius × 2 and the extent along the axis.
  - **Outside profile**: the convex exact cylinders on the axis, joined by radius and extent.
  - **Grooves**:
    - outside: a step smaller than its neighbours on both sides along the axis, with its width and its depth below the smaller neighbour;
    - inside: a bore step on the axis behind a narrower one (CNC2's reach null).
  - **Holes**: CNC2's holes, by their axes against the turning axis: on-axis, axial (parallel, off the axis), radial (square to it), or angled.
  - **Points**: a face without an exact kind whose normals, away from the apex, all make one angle with the axis (a cone, |n·a| = sin α) and that reaches the axis. Its included angle is 2α.
- **The rules** (cnc-turning, in place of CNC1's placeholders). Protolabs' values are one service's, so they warn; the lathe's envelope (Hubs) and no axis fail:
  - **size**: over Ø500 × 1000 fails; under the least part (Ø4.07 × 1.27) warns. With no axis it is unknown;
  - **turning**: no axis fails ("a lathe makes parts with rotational symmetry"). Surfaces not turned warn, with their area and faces ("milled by live tools on a mill-turn …"). Otherwise it passes, giving L/D;
  - **diameter**: the least outside diameter under 0.76 warns;
  - **groove**: an outside groove narrower than 1.2 mm (0.5 in aluminium or brass), or deeper than 24.1, warns; any inside groove warns;
  - **holes**: on-axis or axial under 1, radial under 2 (1 in aluminium or brass), or angled in another material, warns. Off-axis holes are noted as live tools;
  - **point**: an included angle under 30° warns;
  - **corners**: passes, saying sharp inside corners come out radiused and outside corners chamfered.

  Turning has no access or setups rules: a lathe's access is its turning. The drawing (CNC5) applies as for milling. The report's `machining` adds `turning`.
- **Tests** (`test/cnc-turning.test.ts`, 4), against closed forms:
  - a revolved stepped shaft (Ø20 × 52; steps r 10, 6, 8; a cone to a point):
    - axis Y, every surface turned;
    - one groove, 10 wide and 2 deep;
    - the least outside diameter Ø12;
    - a point of 2·atan(8/12) = 67.38° to 1e-4;
    - every rule passes, with no access or setups;
  - mutants on the shaft:
    - a groove 1 wide is warned in steel (under 1.2) and not in aluminium (0.5);
    - a point of 2·atan(8/40) = 22.6° is warned;
  - a cylinder r 10 with a flat at x = 8:
    - 2·√(100 − 64)·30 = 360 mm² not turned, to 1e-6 (planar), warned;
    - a radial Ø1.5 hole from the flat is warned in steel (under 2), not in aluminium (1);
    - Ø0.8 on the axis is warned (under 1);
  - no lathe part:
    - a box has no axis, so it fails and its size is unknown;
    - Ø520 fails;
    - Ø3 is warned, under Ø4.07;
    - an inside groove is warned.
  - CNC1's turned box now expects "no axis of revolution".
- **Flow**: a CNC6 step through the real chat and tool servers. CNC turning is chosen; an aluminium bar Ø20 × 30 reads "cnc-turning: material pass, wall pass, size pass, turning pass, diameter pass, groove pass, holes pass, point pass, corners pass, drawing pass". After a flat is milled on it, it reads "turning warn".

### The CNC track, S0 and CNC1–CNC6 (O83–O89): summary

- **What it is**: CNC milling's and turning's manufacturability, judged on the exact part, in the one report (`check_printability`, v2 `query.manufacturability`, naming `cnc-milling` or `cnc-turning`). With no process, nothing is assumed. The material's family (metal or plastic, the library's) chooses the wall limits and the general tolerance class. ISO 2768-1 f / m are named; their values are not copied.
- **Exact, not the display mesh**:
  - holes and steps come from exact concave cylinders;
  - inside corners come from exact fillet cylinders, and their tangent planes are found by geometry where the display drops smooth edges;
  - floors come from exact planes;
  - turning uses exact normals against the axis.
- **Sampled, and said so**: access uses IM3's sub-triangle grid, with rays along ±X, ±Y, ±Z on the face's side. The greedy setups are exact for the samples.
- **Sourced**:
  - Hubs' CNC guide and technical-drawing page, Protolabs' milling, turning and service pages, and Engineers Edge's drill table, every value with its page, date and label (W-WEB);
  - values derived from a page (the drill table's steps) are `W-DERIVED` with their rule, and `checkMaterials` refuses one without it;
  - one supplier's limits warn, never fail. Protolabs' milling depth and M2–M12 are not rules;
  - L/D and thread relief have no source and are not judged.
- **The rules**:
  - milling: material, wall, size, hole-depth, hole-size, thread, corners, pocket, feature, tall, text, access, setups, drawing;
  - turning: material, wall, size, turning, diameter, groove, holes, point, corners, drawing.
  - Each has a closed-form or constructed oracle and a mutant where it is a check.
- **RB9 rung 4**: `machinable` is a hard predicate on the milling report. It is killed by the deep-hole and groove mutants.
- **For the kernel lane**: AP242 semantic PMI in the STEP writer (CNC5 stopped before it); the hole-after-union refusal (still the one todo); the triangle-BVH consolidation (track K).
- **Not built**: the title block's material and finish cells (an R14 layout change; notes carry them); 5-axis and undercut cutters (access only warns); a price or a quote package for machining (IM6's pattern, if wanted); L/D and thread relief rules (no source).
- **Counts across the track**: 34 studio tests added (S0 4, CNC1 5, CNC2 6, CNC3 7, CNC4 4, CNC5 4, CNC6 4), 6 flow steps (CNC1–CNC6), and 2 RB9 mutants. The contract overhead is unchanged: no tool text changed.

## O90 — the top bar's shapes strip: a More menu, never a sideways page (2026-10-21)

The kernel lane found the strip full at 1440 px. One more placed command (worm-pair) shifted the page sideways and broke flow step 72, so they put that command in the side toolbar. The coordinator asked for the strip to handle overflow, with a flow assertion that the page does not scroll sideways.

- **Measured**: at 1440 the strip's 15 shapes never fitted. The bar's other controls (852 px), its gaps and padding left room for 12. Before this change the bar ran about 25 px over and squeezed its other children.
- **`src/ui/ShapesStrip.tsx`**:
  - It shows as many shapes as the bar has room for. The room is the bar's width less its other laid-out children, gaps and padding, leaving out the two `.grow` spacers. A child hidden with `display: none` takes no gap.
  - When not every shape fits, a **More shapes** button holds the rest in a grid menu. The menu closes on a pick, a click outside it, or Escape.
  - The room is measured again whenever the bar or any of its children changes size (ResizeObserver; the browser API stays inside `ui/`, the PKG rule).
  - `App.tsx` passes the same tool buttons as before, so drag-to-place, tips and the lit active command are unchanged. Everything goes through one component.
- **CSS**:
  - `.shapes` may shrink (`flex: 0 1 auto; min-width: 0`);
  - `.topbar` clips sideways (`overflow-x: clip`, the vertical axis left visible for its dropdowns), so nothing in it can widen the page.
- **Flow**:
  - a new step checks 1440, 1100 and 860. The page never scrolls sideways (scrollWidth and scrollLeft). The whole bar fits down to 1100. Shown plus in the menu stays the same total (11 + 4, 0 + 15, 0 + 15), and no more are shown as the window narrows. A shape picked from the menu starts its command, its button lit, and the menu closes;
  - the five steps that clicked Fastener, and one that clicked Cylinder, use a `shape(label)` helper that opens More when the strip has no room for it.
- **Follow-up, beyond the strip**: below about 1100 px the bar's other controls alone are wider than the window. The mode group and the right-hand tools are clipped at its edge rather than shifting the page. A narrow-window layout for the whole bar is its own piece of work.

## O91 — PKG-a: the empty `@barocss/cad-model` package (2026-10-21)

PKG is the owner-approved package split (`handover/notes/research-package-boundary-2026-10-21.md`, README §0 roadmap item 4). The coordinator ordered only the two steps that are safe while the kernel lane is mid-track, each its own checkpoint: PKG-a, then PKG-b. The moves (PKG-c to PKG-f) wait for the joint boundary.

- **`packages/barocss-cad-model`**:
  - `@barocss/cad-model`, private, `type: module`;
  - `exports: {"./*": "./src/*.ts"}`, so modules are imported by path;
  - dependency `@barocss/cad: workspace:*`; devDependencies typescript 5.9.2 and @types/node 26.6.4, the studio's versions;
  - a tsconfig with `moduleResolution: Bundler`, `types: ["node"]` and `lib: ["ES2022"]`: no DOM, so a browser global in model code fails its type check once code moves in;
  - scripts `lint` (eslint, the root config) and `type-check`;
  - one file, `src/index.ts`, a comment and `export {}`, because tsc refuses an empty input.
- **The studio** depends on it (`"@barocss/cad-model": "workspace:*"`). The workspace already globs `packages/*`.
- **`pnpm-lock.yaml`**: the coordinator said this change is expected, so it is committed. The diff is only the new importer and the studio's new link, 16 lines. `pnpm install --offline` relinked node_modules: it added the package's links and pruned stale entries; the lock itself changed only by those lines.
- **Nothing moved.**
- **Checks**:
  - the package's lint 0 and type-check 0;
  - studio tsc 0;
  - suite 743 = 742 pass + 1 todo, the same names as before;
  - kernel conformance 195/195;
  - full flow 211/211.

## O92 — PKG-b: blockers B1–B4 cut in place, nothing moved (2026-10-21)

The second of PKG's two early steps. B1–B4 are the four places where code bound for `@barocss/cad-model` reaches into the app (`viewport/`, `ui/`, browser storage). Each is cut where it stands. Behaviour is unchanged, and the UI reads every moved name from where it did, by re-export. The moves (PKG-c to PKG-f) wait for the joint boundary.

- **B1, the sketch types**: `SketchTool`, `SketchShape`, `SketchAnchor`, `SketchState` and `Make` move from `viewport/Viewport.tsx` to the new `src/sketch/types.ts`. Their types come from `sketch/plane`, `sketch/terms` and `sketch/rules`. `Viewport.tsx` re-exports them, and the 11 sketch modules that type-imported them from the viewport import `./types`.
- **B2, `Axis3`**: declared in `engine/vec3.ts`. `viewport/gizmo.ts` re-exports it; `assembly/drag.ts` imports it from the engine.
- **B3, `meshToStl`**: moves to the new `src/engine/stl.ts`. `ui/files.ts` re-exports it (`downloadBytes` stays there). `server/cadCli.ts` imports it from the engine, so the CLI no longer imports `ui/`.
- **B4, the user's libraries' storage**:
  - `library/libraries.ts` keeps them in a `LibraryStore` (`getItem`/`setItem`) that the app sets with `setLibraryStore`. With none set (a test, the CLI) nothing is kept, which is what happened before in Node, where `globalThis.localStorage` was undefined.
  - The studio sets it from `ui/browserStore.ts`, `localStorage` guarded: storage that is missing or refused gives null. It is set in the same mount effect, just before `loadUserLibraries()`.
  - `library/` no longer names `localStorage`. The browser API stays in `ui/`, the PKG rule.
- **Kept cut** (`test/pkg-boundary.test.ts`, 2):
  - sketch/*, assembly/drag, library/*, engine/stl, engine/vec3 and the CLI import nothing from `viewport/` or `ui/`; library/ names no `localStorage` outside comments; the three re-exports are in place;
  - with no store, registering a user library keeps nothing. With a store set, it is written there and read back by `loadUserLibraries`.
- **Not in PKG-b**: `app/templates.ts` and `app/recovery.ts` also use `localStorage`. They are app modules in the proposal and stay. B11, the tests importing pure functions from `.tsx`, is optional and left.

## O93 — `@barocss/cad-model` made a public package (2026-10-21)

The owner's decision, verbatim: "@barocss/cad-model 는 공개패키지로 해줘" (make @barocss/cad-model a public package). The coordinator forwarded it after PKG-b's checkpoint, so it is its own small commit.

- **`packages/barocss-cad-model/package.json`**: `private` removed, mirroring the kernel's publish fields:
  - version `0.0.0-experimental` and license MIT;
  - `repository` (git, `packages/barocss-cad-model`), `homepage` and `bugs`;
  - `files` (src, README.md, LICENSE) and `publishConfig: {access: public}`;
  - a description: the CAD document model and engineering domain logic on top of @barocss/cad, no UI.

  The kernel's `publishConfig` also maps its exports to a compiled `dist/`. This package has no build yet, so it has no `dist` mapping; that comes with its first real code.
- **Added**: a README (what the package is, that it is empty until the moves, that a release goes through the release process) and the repository's MIT LICENSE.
- **Nothing published, pushed or released.** `pnpm pack`, run locally into the scratchpad, gives a tarball of LICENSE, package.json, README.md and src/index.ts.
- **No changeset yet**: one comes when real code lands (PKG-c). The repository's checks, read for a new public package that only exports `{}`:
  - `release.yml` ("Npm version PR", run by hand on develop) runs type-check, lint, build:library, the non-app tests and `check-packages.mjs`, then opens a changesets version PR. This package passes lint and type-check, has no build or test script to run, and a package without a changeset is not versioned;
  - `check-packages.mjs` and `check-release-version.mjs` cover only the fixed release set in `.github/scripts/release-manifests.mjs` (kit, browser, server, render). A new package is not packed or checked there, and it cannot trip the pending-changeset check while it has none;
  - `npm-release.yml` publishes only those four tarballs, by name. A public cad-model is not published by any workflow until it is added to that set on purpose.
- **Open, for the coordinator and the owner later**: a public package's exports are an API. `"./*"` stays for the moves. Before the first release it needs a curated public entry (`index.ts`) and a stability policy for its exports. Not designed here. (History: settled in O107. The package is fully public, with no curated entry; stability is 0.x experimental.)
- The lockfile is unchanged: workspace links carry no version.

## O94 — A7.5: candidates isolated, verified and approved — the replay gate, operations, undo against freshness, #2181's nine steps (2026-10-21)

The owner's decision, verbatim: "#2181에서 빠진 네 가지(저장→새로 열기 재생 검사, 취소·중복 전달 처리, 실행 취소와 최신성 시험, 9단계 시나리오 자동화)를 바깥 줄 A7.5로 PKG-a·b 다음에 넣어." That is: put #2181's four missing pieces (a save → reopen replay check, cancel and duplicate-delivery handling, undo against freshness, and the nine-step scenario automated) into the outer lane as A7.5, after PKG-a and PKG-b.

#2181 was read first (`gh issue view 2181`; its §4 contract and §5 scenario). Most of it already exists in A7/A8: the base revision with STALE_BASE, explicit rebase, the gates, the Verifier, held, freshness, baselines, the minted token. A7.5 adds only the four pieces.

- **The board** (`src/team/candidates.ts`, `CandidateBoard`), around A7's Integrator:
  - **Isolation**: a candidate starts on its own copy of the accepted state (structuredClone). It is built there with the agent's own tools (`apply_ops` through `dispatchTool`), and its evidence is stamped with the revision and the token it was built on: facts, each requirement's verdict and measure, and A7's gates. The accepted part and the other candidates never see it.
  - **Checked before it runs**:
    - the unit (the studio's documents are mm: WRONG_UNIT);
    - each op against the tools a batch may hold (UNSUPPORTED_OP; `BATCHABLE_TOOLS`, exported from `chat/tools.ts`);
    - its dependencies (MISSING_DEPENDENCY when one is not accepted);
    - its ops budget.
  - **Checked as it builds**: a target that is not there (WRONG_TARGET), and its bodies and triangles budgets. Each budget is refused by name: "budget triangles: 72 over 1".
  - **Operations**: every call carries an operationId. A second delivery is answered from the trace (DUPLICATE, with the first outcome) and never applied again.
  - **Cancel and timeout**:
    - a cancelled candidate's state is discarded, and nothing else is touched;
    - its result arriving after the cancel, mid-build, is refused (CANCELLED);
    - the clock is logical (ticks), so a result past its deadline is refused (TIMED_OUT).
  - **Accepting**:
    - first the token. A candidate is accepted only on the token it was built on, else STALE_BASE, naming both;
    - then A7's `integrate` on the accepted state (its gates and its STALE_BASE). A failure is GATE_FAILED, with the finding;
    - then the **replay gate**: the document saved as the studio saves it (`encodeStudioFile`), read back by a fresh reader (`readStudioFile`, evaluated afresh) and compared;
    - facts must match: solids, the volume to 1e-9 relative, the bbox. Each requirement's verdict must match, and its measure within that check's tolerance. Otherwise REPLAY_FACTS_DIFFER, REPLAY_VERDICT_DIFFERS or REPLAY_UNREADABLE, and the part is unchanged;
    - the reader is in-process on the studio's path; `cad-cli board --fresh` spawns `cad-cli replay` per accept, a fresh process.
  - **Undo and redo** restore the accepted document (its source, geometry and references). Results stamped against the undone revision read stale by A8.5b's `freshnessOf`, and current again after the redo.
  - **The acceptance token** is a counter that every accept, undo and redo moves on and never reuses. A candidate built before an undo is refused even when the content it was built on is back. That is #2181's "revision token reuse".
  - **A saved file** opens as a new board (`CandidateBoard.open`). One that does not read is refused (CORRUPT_FILE).
- **The scenario** (`src/team/boardScenario.ts`; `conformance/a7/candidates/candidates-nine-steps.json`, 42 steps): #2181's nine steps in order, every volume by the closed form 20·10·h:
  - R0 is 1000 mm³. A (h 6) is 1200 and B (h 7) 1400, built in isolation, R0 unchanged;
  - a wrong target and a cancel mid-build leave everything intact, and a duplicate run is answered;
  - A is accepted (R1, 1200). B is refused stale. B2, rebuilt on R1, gives 1400 with new evidence and is accepted (R2);
  - a mass stamped on R2 reads stale after the undo. E, built on R1 before R2, is refused stale with R1's content back. After the redo the mass is current;
  - save, fresh open, then a re-edit: F (h 9) gives 1800. G (h 12) is built, then refused at accept by the hard requirement H ≤ 10 (GATE_FAILED);
  - the negatives, each typed: UNSUPPORTED_OP, WRONG_UNIT, WRONG_TARGET, MISSING_DEPENDENCY, BUDGET_EXCEEDED (ops, triangles), TIMED_OUT, DUPLICATE (an accept delivered again, not applied), CORRUPT_FILE (the saved file cut in half).
  - **Two paths, the same steps**: in-process (the studio's tool path) and `cad-cli board scenario.json --fresh` (exit 0 when every step is the expected one).
- **CLI**:
  - `cad-cli board scenario.json [--fresh]` prints the steps, `matches` and `differ`;
  - `cad-cli replay part.bcad` prints a saved part's evidence read afresh.
- **Tests** (`test/candidates.test.ts`, 5):
  - the scenario in-process, every step as expected, with the closed forms checked;
  - the same through a spawned `cad-cli board --fresh`;
  - isolation: R0's canonical JSON unchanged; A's and B's evidence unchanged by a failure and a cancel mid-build;
  - the replay gate's mutants: facts off by 1 mm³, H measured 0.02 off (its tolerance 0.01), H's verdict flipped, a file that does not read. Each is refused by name with the part unchanged; 0.005 off still matches;
  - a duplicate accept applied once (one undo, then NOTHING_TO_UNDO); undo and redo restore the canonical JSON and the volume; E refused on the new token; tokens only move on.
- **Not in A7.5**: a UI for the board (it runs headless and in the studio's tool path); parallel execution in workers (candidates build in turn on their own copies, which isolates their state but is not concurrency); assembly candidates (#2181's later step).

## O95 — PKG-c: the 42 SCC-independent model files moved to `@barocss/cad-model` (2026-10-21)

The coordinator called the joint PKG boundary: the kernel lane had finished R12b and stopped, and the integration branch was at 3677add70, the same tree as dbc4aa678.

- **The partition, again at HEAD.** The proposal's 41 / 95 / 42 were measured at 73aaf95a6, and both lanes have added files since. A script over every import, export, `import()` and `new URL()` specifier in `src/`, with the proposal's app files left out, gives:
  - 195 model files: 192 TypeScript and the 3 built-in library JSON files. `tools-v1/v2.json` stay in the app (risk 2);
  - **0 edges from model into the app**, after PKG-b;
  - one strongly connected component of **105** files (20,955 lines);
  - **42 independent** files (39 TS and 3 JSON, 4,848 lines) and **48 dependents** (4,214 lines).
  - Since the proposal, `sketch/{offset,corner,history}` joined the SCC (through `sketch/types` and its `rules` import), and `engine/stl` joined the independent files (PKG-b's B3). The new folders (`machining/`, more of `mould/`, `team/candidates`) are in the SCC or depend on it.
- **The move** (a script, its rewrites computed against the tree before the move):
  - `git mv` of each file to `packages/barocss-cad-model/src/<the same path>`. All **42 are R100**, byte-identical renames.
  - **180 importers** (src/, server/, test/) re-pointed: 313 specifiers to `@barocss/cad-model/<path>`.
  - No shims at old paths. The moved files import only each other, relatively, and `@barocss/cad`. The model is imported by package specifier only (B10); vite and esbuild resolve the workspace link to the one real file, so module-global state stays one module.
- **The moved files**:
  - `app/{edgeChain,materials,measure}`;
  - `chat/{api,contract,groups,script,trace}`;
  - `drawing/text`;
  - `engine/{clip,curveSource,direct,directModule,errors,fit,geom2,mesh,meshImport,render,stepUnits,stl,trim,vec3}`;
  - `io/zip`;
  - `library/{materials,sharing}` and `library/builtin/{enclosure,materials,tslot-20}.json`;
  - `print/threemf`;
  - `robot/{gjk,hull,mjcfCheck,profile,urdfCheck}`;
  - `sketch/{osnap,plane,profile,spline,terms}`;
  - `subd/cageEdit`;
  - `team/sha256`.
- **The package**:
  - `exports` gains `"./*.json": "./src/*.json"` beside `"./*"` (the longer key wins), so the app's `library/libraries.ts` reads the built-in JSON by specifier;
  - its tsconfig gains `lib: ES2022 + DOM` and `resolveJsonModule`. Dropping DOM is PKG-g's question.
- **The kernel-file touch, declared**: `packages/barocss-cad/test/fr-1.test.mjs:111` now reads `tslot-20.json` from its new path, `packages/barocss-cad-model/src/library/builtin/`. The one-line path change is the only kernel edit; the fixture moved with the library.
- **The first changeset for `@barocss/cad-model`** (minor) names the modules that landed. Nothing is published.
- **`test/pkg-boundary.test.ts`**:
  - every file in the package imports nothing back into the app by a relative path, and no `react` or `@barocss/gpu`;
  - the gizmo's `Axis3` and `ui/files`' `meshToStl` re-exports now come from the package specifier;
  - the frozen tool contracts pass without `UPDATE_TOOL_CONTRACT`.

## O96 — PKG-e: the 105-file SCC moved to `@barocss/cad-model` in one commit; PKG-d skipped (2026-10-21)

The coordinator merged PKG-c as 16f409e41 and agreed to skip PKG-d. That leaves one mechanical move of the whole SCC, with the same checks.

- **The SCC at HEAD**: 105 files (20,955 lines), recomputed after PKG-c. No file in it imports the app; 48 dependents remain.
- **The move** (the same script):
  - `git mv` to the same subtree.
  - **232 importers** re-pointed, 1,116 specifiers to `@barocss/cad-model/<path>`.
  - Inside the package, the moving files' **97 own `@barocss/cad-model/…` imports** (from PKG-c's rewrite) become relative again, since a package does not import itself by name.
  - Each of the 105 files is **byte-identical to its content before PKG-c** (`git show e0083c045^:…` against the moved file, all 105 the same). Against HEAD, 48 are R100 and 57 are R094–R099, differing only by those specifiers.
  - The empty `src/library/` folder is gone; its JSON moved in PKG-c.
- **What is left in the app** (all app files, plus the 48 dependents for PKG-f):
  - app: `App.tsx`, `main.tsx`, `ui/`, `viewport/`, `app/{recovery,templates}`, `assembly/{useAssembly,faceClient,faces.worker}`, `chat/{client,images}`, `engine/{client,engine.worker}`, `subd/useCageEditor`;
  - the dependents: `rb9/`, part of `robot/`, `sketch/{corner,dxf,history,offset,select,settle,trim}`, part of `team/`, `engine/{container,meshWire,migrate}`, and the rest of `chat/`, `drawing/`, `assembly/`, `app/`, `mould/` and `print/`;
  - `chat/tools-v1/v2.json` stay (risk 2).
- **A second changeset** (minor) names the document core.
- **`test/pkg-boundary.test.ts`**: the library's storage check now reads the moved `library/` (no `localStorage`). The sketch types' re-export comes from the package specifier. At least 140 package files are checked for imports back into the app, `react` or `@barocss/gpu`.
- **Checks**:
  - kernel suite 1368: 1363 pass, the 1 known environmental failure (`actual native Split source…`, Node pinned), the rest skipped;
  - conformance 201/201;
  - studio suite 754 = 753 pass + 1 todo, its test names unchanged;
  - the frozen contracts pass without the update flag;
  - app tsc 0; the package's type-check 0 and lint 0;
  - lint on the 232 edited studio files: 0 errors (91 existing `no-explicit-any` warnings in tests);
  - full flow 213/213.

## O97 — PKG-f: the 48 dependents moved; server, ab and rb9 on the package (2026-10-21)

The coordinator merged PKG-e as 8a3badab2. PKG-f moves the 48 files that depended on the SCC, the last of the model in the app.

- **The move** (the same script, after fast-forwarding to 8a3badab2):
  - 48 files `git mv`ed to the same subtree. Each is **byte-identical to its content before PKG-c** (48 of 48). Against HEAD, 3 are R100 and 45 are R090–R099, differing only by their own package specifiers, which are relative again (163 of them).
  - **86 importers** re-pointed, 153 specifiers, including `server/` (cadCli, cadMcp, cadDoc, chatServer, `ab/`) and the tests.
  - `scripts/rb9.mjs` bundles `packages/barocss-cad-model/src/rb9/main.ts`. Its ladder was run once by hand from the new entry.
  - The emptied folders are removed: `io`, `machining`, `mould`, `print`, `rb9`, `robot`, `sketch`, `standards`, `team`.
- **What the app keeps**:
  - `App.tsx`, `main.tsx`, `styles.css`, `ui/`, `viewport/`;
  - `app/{recovery,templates}`, `assembly/{useAssembly,faceClient,faces.worker}`, `chat/{client,images}`, `engine/{client,engine.worker}`, `subd/useCageEditor`;
  - `drawing/drawing.css`, and `chat/tools-v1/v2.json` (until PKG-h).
- **A third changeset** (minor), for the rest of the model.
- **`test/pkg-boundary.test.ts`**:
  - every `server/` file imports nothing of the model by a path into the app's `src/`; only the app's own client and worker files may be named that way;
  - at least 190 package files are checked.
- **Checks (T2; a move touches everything)**:
  - lint of the 87 edited files: 0 errors (31 existing `no-explicit-any` warnings in tests);
  - the package's lint and type-check 0; the kernel's lint 0; app tsc 0;
  - studio suite 754 = 753 pass + 1 todo, its names unchanged;
  - conformance 201/201;
  - kernel suite 1368: 1363 pass, the 1 known environmental failure;
  - full flow 213/213.
- The first run of this verification never started (a backgrounded chain that died with its shell, no logs). The coordinator noticed. It was rerun as a tracked background task.

## O98 — PKG-g: the boundary guarded by lint; DOM kept, PKG-g2 planned (2026-10-21)

- **`eslint.config.mjs`** (root; a shared-config touch, declared). `no-restricted-imports`:
  - **in `packages/barocss-cad-model/**`**, each refused by name with its reason: `react` and `react-dom`, `@barocss/gpu`, any `apps/` path or the studio app package, and the package's own name (inside it, modules import each other relatively);
  - **in `packages/barocss-cad/**`**: `@barocss/cad-model`, so the kernel imports nothing of the model above it.
  - Mutant-tested before landing, with two temporary files: in the model, `react`, `@barocss/gpu`, `../../../apps/cad-studio/src/ui/files` and `@barocss/cad-model/team/team` are each an error with its message; in the kernel, `@barocss/cad-model/team/team` is one. The real package and the kernel lint clean.
- **DOM kept in the package's `lib`**: without it the package has **8 type errors**:
  - `engine/blobs.ts`'s IndexedDB (`IDBDatabase`, `indexedDB`, `IDBTransaction`), browser storage inside the model;
  - `engine/meshWire.ts`'s `Transferable`;
  - `io/zip.ts`'s `BlobPart`.
- **PKG-g2, next** (the coordinator's plan):
  - a `BlobStore` interface the app sets, as `LibraryStore` (B4), so `engine/blobs.ts` stops naming IndexedDB;
  - local structural types for `Transferable` and `BlobPart`;
  - then DOM dropped from the package's `lib`, if it type-checks.
- **Checks**: the same T2 run as PKG-f (O97), with this config in place: the package's and the kernel's lint 0.

## O99 — PKG-g2: the recovery blobs' store set by the app; the model's lib without DOM (2026-10-21)

The coordinator's plan after O98. Without DOM the package had 8 type errors: IndexedDB in `engine/blobs.ts`, `Transferable` in `engine/meshWire.ts`, `BlobPart` in `io/zip.ts`.

- **`BlobStore`** (`engine/blobs.ts`), the same pattern as B4's `LibraryStore`:
  - an async store of typed arrays by hash (`keys`, `get`, `put`, `delete`), set by the app with `setBlobStore`;
  - `saveRecoveryBlobs`, `loadRecoveryBlobs` and `collectRecoveryBlobs` go through it. With none set (a test, the CLI, the servers), nothing is kept and nothing found, as before in Node, where `indexedDB` was undefined;
  - the model no longer names IndexedDB.
- **`src/ui/blobStore.ts`** (the app): `indexedDbBlobStore()`, the IndexedDB code moved from the model as it was (the `studio.blobs` database, its `blobs` store, one open and close per call, storage that is missing or refused keeping nothing). `App.tsx` sets it at load, before the studio reads or writes a recovery copy.
- **Local types, no DOM names**:
  - `meshWire.ts` exports `type Transfer = ArrayBuffer` (its pushes cast `as ArrayBuffer`). The worker passes the list to `postMessage` as before;
  - `zip.ts`'s `BlobPiece` reads the part type off `Blob`'s own constructor, so it is the same under the DOM's lib and Node's.
- **The package's `lib` is `["ES2022"]`**: it type-checks without DOM, with `@types/node` supplying `Blob`, `CompressionStream`, `Response`, `TextEncoder` and `performance`. The app's tsconfig, with DOM, type-checks the same files too.
- **Test** (`test/pkg-boundary.test.ts`, +1):
  - with none set, a mesh's blobs are not kept (false);
  - with a Map-backed store set, both are kept;
  - a recovered document naming blobs this session has not loaded reads them back into the blob store;
  - collecting with no document empties the store;
  - `engine/blobs.ts` names no IndexedDB, and the package's lib has no DOM.
- **Checks: T2**, since `App.tsx` changed (results in the checkpoint).

## O100 — CNC7 S0: feature recognition and stock — what reads exactly today, and the plan for CNC7 and CNC8 (2026-10-21)

The coordinator set the next outer-lane work in roadmap order. IM7 needs the kernel's face split (queued), so machining comes first: CNC7, feature recognition and stock export, then CNC8, an optional 2.5D CAM preview marked "not for production". README §4 forbids production G-code. Evidence is in `test/cnc7-s0.test.ts` (3 probes). Every oracle is the construction: a 120 × 80 × 20 plate with one of each feature.

- **P1, floors by their walls**, per setup: the planes a tool along +Z faces, looking out, with a wall rising at their edge.
  - Classified by the in-plane directions their walls bound on both sides: all of them, a **pocket**; some, a **slot**; none, a **step**.
  - The pocket 30 × 20 reads 8 deep and 20 wide; the slot 6 deep and 10 wide; the step 5 deep.
  - The step's floor comes in two faces, because the slot runs through it: one feature, two floors. CNC7 groups them.
  - Two rules the probe found:
    - floors are per setup direction. An L's riser faces a tool along Y, so it is that setup's floor and not this one's;
    - a rising wall counts only at the floor's edge. A boss standing inside the top face does not make the top a floor.
- **P2, holes and bosses**:
  - CNC2's holes are already features: Ø6.6 through 20 and Ø5 blind 10 deep, with type and steps;
  - a **boss** is a convex exact cylinder whose base lies on a plane facing along its axis: Ø12, 8 high.
- **P3, stock from the user's list**: the smallest block whose sorted sides hold the part's sorted sides plus twice an allowance.
  - The part with its boss is 120 × 80 × 28. With a 1 mm allowance, the list gives 122 × 82 × 30.
  - A turned Ø20 × 52 takes the smallest bar of at least Ø22, cut to 54.
  - When none fits, that is said.
  - **No stock list is built in**, the owner's pattern (D121, bend tables; FR's sections): the user loads their shop's list. The allowance is a flagged estimate until the user sets it.
- **The plan**, each stage with oracles, mutants where it is a check, and a flow step:
  - **CNC7a, feature recognition** (`machining/features.ts`):
    - per setup direction (CNC4's), pockets, slots and steps from floors classed by their bounding walls; the floors of one feature (a step crossed by a slot) grouped by their walls;
    - holes by CNC2 (through, blind, counterbored, tapped) and bosses;
    - each feature with its exact size, depth, faces and the setup that reaches it;
    - a `features` section in the machining report and an agent-readable list (through `check_printability`, no new tool unless the contract has room).
  - **CNC7b, stock**:
    - a stock list the user loads (blocks, plates, bars; each row its source, or the user's own) and an allowance (an estimate until set);
    - the smallest block or bar around the part in the setup's frame; refused by name when none fits (STOCK_NONE_FITS);
    - **stock export**: `stock.json` (size, placement against the part, allowance with its basis, the row chosen) and the stock as STEP through the kernel's writer, for a CAM program to read.
  - **CNC8, an optional 2.5D CAM preview**, marked **"not for production"** wherever it shows (the viewport, the report, every file):
    - outlines only, for the recognised pockets (offset contours at the tool's radius, stepped by depth) and holes (drill points);
    - **no G-code**, no feeds or speeds.
- **Then** IM8 (casting presets, allowances, section and solidification checks), and the parts of IM7 that do not need the face split.

## O101 — CNC7a: machining features recognised per setup (2026-10-21)

- **`machining/features.ts`** (`featuresOf`, in `@barocss/cad-model`):
  - **Floors**, for every setup direction (CNC4's ±X, ±Y, ±Z). A floor is a plane facing the tool, looking out along its normal, with a wall rising at its edge. It is a **pocket** when its walls bound it in every in-plane direction, a **slot** when only across, a **step** on one side (O100's probe).
  - **One feature's floors** are one face name at one level: a step a slot runs through is one feature of two pieces.
  - **One feature seen from two setups**: when two floors are each other's rising wall (an L's floor and riser, a pocket run out through an edge and its end wall), the shallower reading is kept, the way a tool cuts it, and it is reachable from both setups.
  - **Sizes**:
    - a pocket: its narrowest width across its walls (rotating calipers) and its longest extent;
    - a slot: across, and along its free direction;
    - a step: out from its wall, and along it;
    - the depth: below the highest wall.
  - **Holes** are CNC2's: the narrowest step's diameter, through or blind, the depth along the axis, a counterbore's diameter and depth, a tapped hole's thread. Their setups are out of each open end along the axis.
  - **Bosses**: a convex exact cylinder standing on a plane that faces along its axis, its diameter and height.
  - Each feature has an id (`pocket1`, `hole2` …), its body, setups and faces.
- **The report**: for milling, a `features` rule after the drawing's ("1 pocket, 1 slot, 1 step, 2 holes, 1 boss recognised, each with its setup") and the list in `machining.features`. The agent reads it through `check_printability`. No new tool.
- **Tests** (`test/cnc-features.test.ts`, 4). Every size is the construction's:
  - O100's plate:
    - the pocket 30 × 20 × 8 from +Z;
    - the slot 10 wide, 80 long, 6 deep;
    - the step 15 wide, 120 long, 5 deep: one feature of two floors, from +Y and +Z;
    - Ø6.6 through 20 from ±Z; Ø5 blind 10 from +Z;
    - the boss Ø12 × 8;
    - the report's rule and list;
  - mutants:
    - the pocket run out through the near edge is a slot (its end wall's −X reading merged);
    - its corners filleted r 5, it is still a pocket 30 × 20 × 8;
    - with the boss taken away, there is none;
  - a counterbored Ø6.6 through 20 (Ø11 × 6) and an M6 tapped blind 12, with their counterbore and thread;
  - a pocket cut into the side: from −Y, 10 deep, 10 × 20.
- **Flow**: a CNC7a step through the real chat and tool servers. A milled plate with a pocket and a hole reads "features pass".
- **Checks: T1** (results in the checkpoint).

## O102 — CNC7b: stock from the shop's list, and its export (2026-10-21)

- **The list is the user's** (`doc.machining`, versioned: `stock` rows and `allowanceMM`). None is built in, the owner's pattern of D121.
  - A row is a block (three sides) or a bar (a diameter, and the longest it comes in), with its source (the shop, a page).
  - **`set_stock`** (an agent tool, v1 and v2's `material` group as `stock`) sets the rows, the allowance or both. Refused by name: a row without an id or source, a block not of three positive sides, a bar not of a positive diameter, two rows of one id (STOCK_ROW); an allowance outside 0–100 mm (STOCK_ALLOWANCE).
  - The frozen contracts gained it additively (`UPDATE_TOOL_CONTRACT=1`: v1 +28 lines, v2 +1). Their overhead is 14,645 of 15,000.
- **The choice** (`machining/stock.ts`, `chooseStock`):
  - **milling**: the smallest block whose sorted sides hold the part's box plus twice the allowance, laid along the part (longest on longest) and centred on its box;
  - **turning**: the thinnest bar holding the turned diameter plus twice the allowance, long enough when it says how long, cut to the length plus twice the allowance, along CNC6's axis from the part's lowest point less the allowance;
  - **the allowance** is the user's, else 1 mm a face, an estimate, said in the rule and in `stock.json`;
  - **refused, typed**: STOCK_NONE_LOADED (unknown), STOCK_NONE_FITS (warned, the size needed said), STOCK_NO_AXIS;
  - sizes read off the mesh fit to 1e-6 mm. Its vertices lie on the exact surfaces only to rounding: a Ø20 shaft read Ø20.000000x and missed Ø22 by 1e-9.
- **The report**: a `stock` rule for milling and turning ("stock B30: 122 × 82 × 30 mm (the shop), 1 mm a face (an estimate: set yours)"), and `machining.stock`.
- **The export**: `cad-cli stock part.bcad -o folder [--list stock.json] [--allowance mm]` writes:
  - `stock.json`: the row, the size as cut, the placement, the allowance with its basis, the part's size;
  - `stock.step`: the stock as a body (a box, or a cylinder on a plane square to the axis) through the kernel's writer.
  - It exits 1 when none is loaded or none fits.
- **Tests** (`test/cnc-stock.test.ts`, 6), against closed forms:
  - O100's plate (120 × 80 × 28 with its boss) takes B30, 122 × 82 × 30 at 1 mm, an estimate, from min (−1, −1, −1) to max (121, 81, 29); a block listed as 30 × 122 × 82 is laid along. With 2 mm set it takes B32, 125 × 85 × 32;
  - none loaded is unknown; none fits is warned, naming 122 × 82 × 30;
  - a turned Ø20 × 52 takes R22 (not R16 or R25), 54 long, from y = −1. One listed 50 long is warned;
  - the export: the block's body is 122 · 82 · 30 to 1e-6 mm³; the bar's is π · 11² · 54 within 1 %; the STEP is ISO-10303-21;
  - set_stock's four refusals;
  - `cad-cli stock`, spawned: exit 0, `stock.json` (B30, an estimate) and `stock.step`; without a list, exit 1 with STOCK_NONE_LOADED.
- **Flow**: a CNC7b step through the real chat and tool servers. The agent sets the list; the report reads "stock pass", and the document holds both rows.
- **Two tests that follow from it**:
  - `chat.test.ts`'s tool list gains `set_stock`;
  - RB9 rung 4's `machinable` leaves the `stock` rule out, as it does material and wall: the brief loads no stock list. Without that, every plate read "stock: unknown".
- **Two failures that came and went**, neither from this change:
  - `hollow.test.ts`'s "refused at once" (under 1000 ms) failed once with the full suite running beside it, then passed alone and in the next full suite;
  - flow step 109, R12b.6's throated worm wheel (the kernel lane's), timed out once, then passed with the worm and CNC steps rerun.
- **Checks: T2**, since `chat/tools.ts`, the frozen contracts and `engine/doc.ts` changed (results in the checkpoint).

## O103 — CNC8: an optional 2.5D CAM preview, NOT FOR PRODUCTION; the CNC track's roadmap items done (2026-10-21)

The coordinator's limit: the contract has 355 characters left, so **no new tool**. The preview is a model function and a CLI command, as CNC7b's export is. README §4 forbids production G-code, and none is written.

- **`machining/cam.ts`** (`camPreview`):
  - **pockets** (CNC7a's, closed only): the floor's outline (its triangles' boundary edges walked into loops, the largest kept, collinear points dropped), offset inward by the tool's radius, then by the stepover, until it closes up. Each loop is the tool's centre. The **levels** run from the top down by the step-down, the last at the floor. The loops and the length (their perimeters × the levels) are in the floor's plane;
  - **`inset`**: each edge moved in, the corners where the moved lines cross. An edge the offset turns against its own direction (a rounded corner's short chord, once the offset passes its radius) is dropped and the corners found again, so the corner turns sharp, as a contour offset does. It gives null once the outline closes up;
  - **holes**: a drill point at each open end the hole is reached from: entry, axis into the part, depth, diameter;
  - **slots and steps** are listed in `skipped`, not previewed (open on a side);
  - **the tool** is given (`--tool`), else Ø6, an estimate. The stepover (40 %) and step-down (50 %) of its diameter are estimates, said;
  - **not there**: G-code, feeds or speeds, a collision check, islands cleared around, a stock model.
- **Marked everywhere it shows**: the preview's first key is its banner, "NOT FOR PRODUCTION — a 2.5D preview of outlines to look at, not a toolpath for a machine: no G-code, no feeds or speeds, no collision check". The SVG's first line is that banner as a comment, and it is drawn on the sheet in red.
- **`cad-cli cam-preview part.bcad -o folder [--tool mm]`** writes `cam-preview.json` and one `cam-preview-<setup>.svg` per setup (pZ, mZ …): the loops as polygons, the drill points as circles.
- **Tests** (`test/cnc-cam.test.ts`, 5), against closed forms:
  - `inset`: 10 × 4 by 1 gives 8 × 2, and by 2 it closes up; a rounded square past its corner radius turns sharp (14 × 14);
  - a 50 × 30 pocket 8 deep with Ø6 (an estimate):
    - loops (44 − 4.8k) × (24 − 4.8k) for k = 0…4, at stepover 2.4;
    - levels 3, 6, 8;
    - length 3 · Σ 2(68 − 9.6k) = 1464;
    - the floor's plane at z 12, +Z;
    - the mutant, Ø32, gives no loop, "does not fit (30 wide)";
  - filleted r 5: the same loop boxes; the first loop's length 2(44 + 24) − 16 + 4π within the chord; the third sharp-cornered (2(34.4 + 14.4) exactly);
  - drill points: Ø6.6 through 20 from +Z at z 20 and from −Z at z 0, both 20 deep; Ø5 blind from +Z, 10. A slot is skipped. A given Ø4 is said given, and the SVG's first line carries the banner;
  - `cad-cli cam-preview`, spawned: the two files, the JSON's first key the banner, the SVG's first line the banner, no G-code token (G0–G3, M3/M6) in any file.
- **The CNC track's roadmap items** (CNC1–CNC8) are all done: O84–O89, O101–O103, with S0s O83 and O100. Still open: the title block's material and finish cells (R14), 5-axis and undercut cutters, and a quote package for machining.
- **Checks: T1**. A model module, the CLI and a test; no UI and no T2 file, so no flow step is affected.

## O104 — IM8 S0: casting — modulus, hot spots, allowances, die-casting draft; the plan (2026-10-21)

The coordinator's order after CNC8: IM8 (casting presets, allowances, section and solidification checks), then the parts of IM7 that do not need the kernel's face split. Evidence is in `test/im8-s0.test.ts` (4 probes), each against a closed form. Before it, the integration branch was merged (K3, K4: the kernel's one point–triangle distance and nearest query).

- **P1, the casting modulus** M = V/A, from exact volume and area:
  - a 100 × 100 × 10 plate is 100000 / 24000 = 4.1667; a 20 mm cube is 20 / 6 = 3.3333;
  - **Chvorinov's rule** (solidification time ∝ M²; the physics, derived and not copied) gives the ratio (M₁/M₂)² = 1.5625: the plate freezes last.
- **P2, the hot spot of an L junction** (walls 4, a sharp inside corner):
  - **a finding**: IM4's local thickness, an inscribed sphere at each face's inward ray, reads 4 everywhere. The junction's ball lies on no face's ray, so IM4 misses the hot spot;
  - **the largest inscribed ball**, found along the corner's bisector with the kernel's exact nearest distance (`nearestDistance2`, K2–K4), is 2r = 2t(2 − √2) = 4.686 to 2e-3;
  - so IM8's section check searches the distance field for its local maxima, the hot spots. It does not use the per-face sphere.
- **P3, a pattern's shrink allowance**, from NPTEL's foundry lecture (`archive.nptel.ac.in/…/metalcasting/lecture3.htm`, read 2026-10-21; inches per foot by metal and size band):
  - aluminium up to 4 ft, 0.155 in/ft: 100 mm cast is 101.2917 on the pattern;
  - cast steel up to 2 ft, 0.251 in/ft: 102.0917.
- **P4, die-casting draft per alloy** (Dynacast's die-cast design guide, read 2026-10-21: "0.5º is achievable for zinc", "1º-2º is achievable for aluminum"), on IM2's exact draft field: a block drafted 0.75° meets zinc's 0.5° and not aluminium's 1°.
- **Sources found and not used for values**:
  - Dynacast's FAQ (tolerances ±0.001–0.002 in for zinc, ±0.002–0.004 in for aluminium, walls "typically 2mm for aluminum") is to read page by page in IM8a;
  - a handbook table seen only through a third-party upload is not used;
  - percentage shrink figures disagree between sources, so the inch-per-foot table is the one used.
- **The plan**, each stage with closed-form oracles, mutants and a flow step, in the one manufacturability report:
  - **IM8a, casting presets**: process profiles `die-casting` (zinc, aluminium, magnesium by family) and `sand-casting`. Each value sourced page by page (W-WEB) or derived (W-DERIVED) or an estimate: draft, least wall, tolerance. The material's alloy family chooses.
  - **IM8b, allowances**: shrink by alloy and size band (the lecture's table, W-WEB), the machining allowance (the user's or an estimate, as CNC7b's), draft by process. A pattern's dimensions are scaled, exported as a scaled STEP and the factors in JSON.
  - **IM8c, sections and solidification**: the distance field's local maxima (the largest inscribed balls, the kernel's nearest query) as hot spots, each with its modulus. Chvorinov's ordering: a hot spot with no path of rising modulus to a feeder (the gate, set by the user) is an isolated hot spot, a shrink-porosity risk, warned with where it is. Section changes are steeper than a ratio, sourced or an estimate.
  - **Then IM7's parts without the face split**: core and cavity halves from IM5's parting where faces do not straddle, side-core directions from IM3's undercut side actions, shut-off candidates. The split surfaces wait for the kernel.

## O105 — v2 the only tool surface; v1 removed; one per-turn guard (2026-10-21)

Owner, 2026-10-21, relayed by the coordinator. First: "앱 채팅과 MCP 기본값을 v2로 바꾸고 v1은 동결해. 새 기능은 v2 동작으로 넣고, 상한은 표면별 매 차례 전체 양(목록+프롬프트)으로 바꿔." Then, replacing the freeze: "우리는 릴리즈 한게 아니라서 toolset v1 은 없어도 돼" (we haven't released, so toolset v1 isn't needed).

- **One surface.** The 13 v2 tools (`barocss-cad-tools-v2`, frozen in `tools-v2.json`) are what the app chat, MCP (`cad-mcp`) and the chat server's CLI see.
  - Removed: `CAD_TOOLSET`, `cad-mcp --toolset` (now refused as an unknown option), `toolset()`/`toolsetOf()`, `TOOLS_V1` as a list, `tools-v1.json`, `TOOL_CONTRACT_VERSION`.
  - `toolset.ts` exports one `TOOLSET {version, tools, prompt}`.
  - MCP `tools/call` takes only the listed names. A handler's own name (`run_command`) is a JSON-RPC error −32602 that names the tools; a freeze would have had to keep it callable.
- **`json` removed.** Only the A/B's json arm used it. The arm is gone, and the harness keeps the ten briefs on the v2 tools (`hybrid`) through the real chat server; live runs still need `CAD_AB_LIVE=1`.
  - **A5.5's v1/v2 live A/B is dropped** by this decision. Its dry-run report stays as history (`notes/ab-dry-run-2026-10-20/`).
- **The handlers are kept** (`chat/tools.ts`, its 83 tools and their annotations and output schemas in `contract.ts`). Each v2 action dispatches to one, so a v2 call is a handler call.
  - In-process tests (`dispatchTool`, `runTool`) and saved proposals' ops may still name handlers. Ops naming v2 tools are stored as handler calls, as before, so saved documents replay.
  - Conformance `a2/` and `a4/` are in-process handler cases and are unchanged.
- **Moved to v2 names**:
  - the nine `test/fixtures/*.calls.json`, nested proposal ops included: 84 scripted calls and 6 mocked chat events in the flow;
  - the scripted agent's MCP calls in `chat.test.ts` and `cad-external.test.ts`;
  - the MCP tests in `tool-contract.test.ts` and `toolset.test.ts`;
  - `subdClamp.test.ts`, which now records the agent's calls as v2 calls (`v2Call`, a new export of `groups.ts`, which `viaV2` uses) and maps them back with `v1Call` for the editor's own steps.
  - The scripted agent now reports a JSON-RPC error as a failed call, as the CLI does.
  - The transcript labels a call `features.command` (tool.action).
- **New capability only as v2**: a tool is a group action, with detail behind `describe`. A command or feature kind goes into the live registries; the features tool names them in its text (no enum) and `describe` gives the detail. If headroom runs low, the lists move behind `describe` too. This is in README §0 for both lanes.
- **One guard**: per turn, tools/list JSON plus the system prompt, v2 ≤ 25,000 characters (`toolset.test.ts`).
  - It replaces `listed − plain < 15000` (tool-contract) and `tools/list ≤ 15000` (toolset).
  - At 7691e0c90 (the coordinator's measurement) v2 was 13,164 + 8,242 = 21,406, against v1's 118,495 + 7,922 = 126,417.
- **Tests removed or renamed**: listed in the O105 checkpoint, each with its reason.

## O105b — handler texts read as v2 tool.actions at the MCP boundary (2026-10-21)

- The MCP server passes every tool result through `v2Result` (groups.ts). Prose goes through `v2Text`: an underscored handler name becomes its action (`get_part_summary` → `query.summary`), and "(propose)" and "with propose," become `proposals.propose`. A stored `{tool, args}` call in a result reads as its v2 call. Keys stay as they are; handlers keep their names internally. toolset.ts now uses `v2Text` for the prompt as well, and the per-turn size is unchanged at 21,406.
- Tests (toolset.test.ts):
  - every string literal in the model package that names a handler (≥ 60) reads, through `v2Text`, with no handler name left and every action it names real;
  - through MCP, three refusals (no requirements, no snapshot, L2's proposal) name v2 tools;
  - `v2Result` converts a stored op.
- Verified so far: app tsc 0, toolset.test 11/11. **Not yet run:** the full studio suite name diff and FLOW_ONLY on the chat steps.

## O106 — IM8a: casting presets — die casting and sand casting by the alloy's casting family (2026-10-21)

- **The data** (`library/builtin/materials.json`).
  - Two process profiles, `die-casting` and `sand-casting`. Their limits are keyed by casting family (`zincWallMinMM`, `aluminiumDraftRecDeg`, …), with the process's own value applying to every family (sand casting's draft). Each limit names its page, read 2026-10-21:
    - **eFunda, die casting** (`efunda.com/processes/metal_processing/die_casting.cfm`), its table of minimum thickness and draft:
      - zinc alloys 0.6 mm, 0.25°;
      - aluminium alloys 0.9 mm, 0.5°;
      - copper alloys (brass) 1.25 mm, 0.7°.
    - **Dynacast, a beginner's guide to die-cast design**: "0.5º is achievable for zinc 1º-2º is achievable for aluminum". Achievable draft is zinc 0.5° and aluminium 1° (the low end).
      - Tolerances "±0.001" and ±0.002"" for zinc and "±0.002" and ±0.004"" for aluminium are W-DERIVED: the looser end × 25.4, so 0.0508 and 0.1016 mm.
    - **Dynacast, die casting design FAQ**: "Wall thickness, typically is 2mm for aluminum die casting." This is aluminium's typical wall: under it warns, under 0.9 fails.
    - **Engineers Edge, design for sand casting**:
      - walls "0.10" - Aluminum, .13 Magnesium and .13 for Steel", W-DERIVED × 25.4 as 2.54, 3.302 and 3.302 mm;
      - "Standard draft for sand casting is 2 degrees with a minimum of about 1 degree".
  - **Not read, so unknown and said**:
    - Magnesium in die casting: no HTML page gave a value; the TMS course and Wikipedia's table taken from a standard were not used.
    - Copper tolerance.
    - Sand-casting tolerance: Engineers Edge's chart is an image.
    - Iron.
  - **Materials**: a `castFamily` (zinc | aluminium | magnesium | copper | steel), checked by `checkMaterials`.
    - New casting alloys `zamak3`, `a380`, `az91d` (die) and `a356` (sand). Their mechanical values are S-TYP estimates, flagged.
    - Brass (copper, die) and steel (steel, sand) gained a family.
    - Al 6061 has none: a wrought alloy.
- **The report** (`casting/report.ts`, `castability`, dispatched from `printability`) has these rules:
  - **material**: a non-casting alloy fails; a family with no value read is unknown;
  - **pull**: `doc.mould.pull` or `direction`;
  - **wall**: IM4's thinnest against the least (fail) and typical (warn);
  - **draft**: IM2's exact field against the least (fail) and achievable (warn); straddling faces warn;
  - **tolerance**: where read.
  - It also returns a `casting` summary: family, tolerance and page, the steep faces.
- **Surfaces**:
  - The brief's processes now include `die-casting` and `sand-casting`.
  - The Library panel lists both and shows the Pull for casting; finishes stay moulding's.
  - The report tool's description and the v2 `query.manufacturability` hint add casting (+16 characters a turn: 21,406 → 21,422).
  - No new tool or action (O105's rule).
- **Tests** (`test/im8a.test.ts`, 6), with a block drafted θ on each side of every draft limit and a box shelled to t on each side of every wall limit:
  - data and page checks;
  - die draft: zinc 0.75/0.5 pass, 0.4 warn, 0.2 fail; aluminium 1.5 pass, 0.75 warn, 0.4 fail;
  - sand draft: 0.75 fail, 1.5 warn, 2.5 pass;
  - walls: die zinc 0.8 pass; aluminium 0.8 fail, 1.5 warn, 2.5 pass; sand aluminium 2 fail, 3 pass; sand steel 3 fail, 3.5 pass;
  - the unknowns;
  - the tool and its v2 action.
  - Flow step "IM8a" chooses die casting with a +Z pull in the Library panel. Through the real chat, A380 at 0.75° warns on draft and Zamak 3 passes.
- **Next**: IM8b, allowances.
- **With it, O105b's review** (the coordinator): a pass-through test in toolset.test. Names a user chose that are not handlers' (`my_bracket_v2`, `left_rail_2`, a non-handler `tool`) come back unchanged; only a handler's exact name is rewritten, and that known limit (a part named `add_part`) is pinned.

## O107 — @barocss/cad-model is fully public (2026-10-21)

Owner, relayed by the coordinator: "@barocss/cad-model 은 완전 공개 패키지야" (@barocss/cad-model is a fully public package).

- Every module under `packages/barocss-cad-model/src/` is public API, imported by its path (`@barocss/cad-model/<module>`), as the `./*` export already does. There is no curated subset and no internal/public split; `src/index.ts` exports nothing.
  - This settles O93's open item. "Stability policy" stays only as: 0.x experimental (`0.0.0-experimental`), no compatibility promise yet.
- **The package README** is rewritten:
  - every module public, with a module map, one line each (engine, sketch, app, assembly, subd, chat, drawing, print, mould, machining, casting, robot, library, standards, team, rb9, io);
  - no UI or DOM, layered on `@barocss/cad`;
  - the data rules;
  - 0.x, so the API may change.
  - `src/index.ts`'s stale "empty until the moves" comment is updated.
- **Checked under src/, since everything ships** (197 files):
  - No absolute `/Users/`, `/private/`, `/home/` or `/var/folders/` paths, no temp paths, no test probes (`*.test.*`, `_*`, `*probe*`), no hosts or ports.
  - No secrets: no API keys, passwords or bearer tokens. The "tokens" in `team/` are minted approval tokens, not credentials.
  - The only environment reads are the agent's run settings (`CAD_AUTONOMY`, `CAD_MAX_TURNS`, `CAD_MODEL`, `CAD_PROMPT`) and the test hook `CAD_TOOLS_VIA_V2`, each guarded for no `process`.
  - The data: `library/builtin/{materials,enclosure,tslot-20}.json` are CC0, written for BaroCSS, values sourced (W-WEB/W-DERIVED with pages) or flagged estimates, no supplier's or standard's tables. `standards/provenance.ts` refuses GPL, share-alike, non-commercial or unknown licences. Shop lists (stock, bend tables, frame sections) are the user's to load.
  - `rb9/` (the scenario ladder and its scripted agent) is product code, public with the rest.
- **Test**: `test/cad-model-public.test.ts` fails if a file under `src/` holds such a path. A planted `/Users/someone/x.json` was caught by its pattern.
- **Release item**, with no change now: the exports point at `.ts` sources, so a build step to JS and `.d.ts` comes before a real publish. No publish and no version change.

## O108 — IM8b: a casting pattern's allowances — shrinkage and machining by NPTEL's tables, the pattern as STEP and JSON (2026-10-21)

- **The data** (the `sand-casting` profile's `allowances`, as printed, read 2026-10-21):
  - NPTEL metal casting lecture 3, Table 1, "Rate of Contraction of Various Metals", inch/ft by the pattern dimension:
    - Grey Cast Iron 0.125 / 0.105 / 0.083 (up to 2 ft, 2–4 ft, over 4 ft);
    - Cast Steel 0.251 / 0.191 / 0.155 (2, 6 ft);
    - Aluminum 0.155 / 0.143 / 0.125 (4, 6 ft);
    - Magnesium 0.173 / 0.155 (4 ft).
  - Lecture 4, Table 3, "Machining Allowances of Various Metals", in inches:
    - cast iron 0.12 / 0.20 / 0.25 by 12, 20, 40 in;
    - cast steel 0.12 / 0.25 / 0.30 by 6, 20, 40;
    - non ferrous 0.09 / 0.12 / 0.16 by 8, 12, 40.
  - The values are kept as printed; the code applies the stated rule (ft × 304.8, in × 25.4, inch/ft ÷ 12 as a ratio). `checkMaterials` checks the pages, the rising bands and positive values.
  - Lecture 4's Table 2 (pattern draft by pattern material and surface height) was read but is not used yet. Die casting has no allowance table read, so its shrink is unknown and said. New material `grey-iron` (family iron, S-TYP estimates).
- **The rules** (casting report):
  - `shrink`: one factor for the whole pattern, 1 + ratio, by the part's largest extent; the band's top is in the band; the user's `doc.casting.shrink` takes precedence.
  - `machining-allowance`: the table's mm, or the user's, on the faces marked machined. None marked is n/a; a name not on the part fails `[CASTING_FACE]`; a curved face is unknown (only flat faces move out); past the table's 40 in is unknown and said.
  - **One uniform scale, not per dimension**: a uniform scale keeps exact planes and cylinders exact in the STEP, and a per-dimension one would not. (O109, at the coordinator's review: the report and pattern.json say it is a simplification. A pattern maker may scale each dimension by its own band, and the factors each dimension's band would give are listed where they differ.)
- **The tool**: `set_casting`, a v2 action `features.casting` (O105's rule, a compatible enum addition recorded in tools-v2.json). It sets machined, allowance and shrink, each refused by name. Per turn 21,531 (+109). Why a tool, though O104 said IM8 would need none: which faces are machined after casting is the person's choice, as are their own allowance and shrinkage. The document has to hold them, and the agent has to be able to set them, so an action carries them.
- **The pattern** (`casting/pattern.ts`): each machined flat face moved out by the allowance (the studio's `offset-face`), then the body scaled about the part's box centre (the studio's `scale`), both through the tool layer.
  - `cad-cli pattern part.bcad -o dir` writes pattern.step and pattern.json: factor, band, page, allowance, faces, pivot, the part's and the pattern's boxes. Typed codes otherwise (PATTERN_NOT_CASTING, _ONE_BODY, _MATERIAL, _SHRINK, _ALLOWANCE, _FACE, _BUILD).
- **Tests** (`test/im8b.test.ts`, 7):
  - the data as printed;
  - every band, its top included;
  - the allowances in mm;
  - the report rules;
  - the pattern of a 100 × 60 × 20 A356 block with its top machined: 100·60·22.286·f³ to 1e-9 relative, its box about the centre, its STEP read back to the volume to 1e-6;
  - refusals;
  - the CLI.
  - Flow step "IM8b": sand casting and the Pull in the Library panel; through the real chat a block, A356 and its top marked; the report's shrink and machining-allowance pass.
- **Next**: IM8c, hot spots and feeding.

## O109 — IM8c: hot spots and feeding from the distance field; the section change; the IM8 casting track's items done (2026-10-21)

- **The field** (`casting/solidification.ts`): the part's distance field on a voxel grid through the kernel's K6 `voxelInsideFlags` and `voxelDepth`, which run on K2's nearest query. There is no new copy.
  - Each inside node's depth is the radius of the largest ball about it inside the part.
  - The grid is at most 400k nodes (step from the box, or a caller's `h`), offset irrationally so no row runs through a mesh edge. The depth is capped at half the least extent, so nothing clips.
  - The L junction at h 0.4 is 1.87M nodes in 179 ms, most of them outside.
- **Hot spots**:
  - a plateau of the field (26-neighbours, equal within 1e-9 of the size) with no deeper neighbour: the centre of a locally largest inscribed ball, which is how IM8 S0 found the L junction that IM4's per-face sphere misses;
  - smaller than a cell: dropped;
  - one whose liquid region holds a larger one is part of it.
  - Modulus is r/2, a plate's (2r thick) or a long bar's V/A, said to be an estimate.
- **Feeding** (Chvorinov orders freezing by modulus):
  - a hot spot's liquid region is the nodes joined to it at depth ≥ its own less a quarter cell;
  - it is fed when the ball at some node of the region reaches the gate. The gate is the person's, `features.casting {gate}` / `doc.casting.gate`, and none is assumed.
  - An unfed one is warned `[SHRINK_POROSITY]` with its r and where it is.
  - The quarter cell matters: the L junction's r 2.343 sits over its walls' 2 by less than a cell of 0.4, so a floor of r − h would let the region run down the legs. The test pins it.
- **Section change**: the thickest section (2 × the deepest radius) against IM4's nominal wall, against Engineers Edge's "If a section change of over 2:1 thickness ratio is unavoidable … use a wedge form between the unequal sections." (W-WEB, read 2026-10-21; sand casting's `sectionRatioMax`). Die casting has no ratio read, so it is unknown and said.
- **The shrink wording (O108 review)**: the report and pattern.json say the one uniform factor by the largest extent is a simplification. A pattern maker may scale each dimension by its own band, and where the bands differ each dimension's factor is listed, e.g. X 1.011917 (4–6 ft); Y, Z 1.012917.
- **Tests** (`test/im8c.test.ts`, 4, plus one in im8b for the wording):
  - a plate 100 × 60 × 10: one hot spot r = 5 on the mid-plane (within half a cell), fed from a gate on top, section 1 : 1;
  - the L junction: r = t(2 − √2) on the bisector; isolated from a leg's end, fed from the outer corner; the mutant noted;
  - a 20 mm block on a 4 mm plate: isolated from the far end ([SHRINK_POROSITY]), fed from a gate on the block, section 5 : 1 past 2 : 1;
  - the unknowns and the gate's refusals.
  - Flow step "IM8c": through the real chat, the block on the plate gated far warns, then gated on the block passes.
  - IM8a's tool test and the IM8a and IM8b flow regexes name the three new rules.
- **The IM8 track's items (S0, a, b, c) are done.** Next, by O104's plan, comes IM7 without the face split. Its parts that need straddling faces wait for the kernel's splitFaceAlongCurve (queue item 2).

## O110 — IM7 S0: a mould's halves where no face needs a split; shut-offs, side-core directions; IM8c's modulus corrected (2026-10-21)

- **The halves** (`mould/tooling.ts`):
  - The input is IM5's parting line at an axis pull (±X, ±Y, ±Z). When no face straddles it and every parting loop is flat and at one height along the pull, the halves meet on one plane.
  - A block about the part (10 mm a side, an estimate, or `--margin`), less the part, is cut there with the document's own nodes (extrude, difference, split). The kernel's B-rep gives the volumes.
  - The half on the +pull side moves along it: IM5's "+", the moving half, B side, usually the core. The other half is fixed: A side, usually the cavity.
  - Every face must lie on its half's side of the plane, checked from its mesh extent along the pull.
- **Shut-offs**: the inner closed parting loops in the plane, where the halves touch across an opening; the core half's metal fills it up to the plane. Each gets its area (shoelace in the plane), its polygon centroid and its length.
- **Side cores**: IM3's undercut regions freed across the pull give their directions, faces, area and centroid. Their bodies are not built. They are given on a refusal too, since a side core's own faces often straddle or step the parting line (a side hole's wall straddles).
  - Undercuts that no side core frees are listed.
  - Not built: a gate, runners, cooling, ejectors, the mould base.
- **Refused by code, each with what it waits for**:
  - `MOULD_STRADDLE`, a face straddling the pull: the kernel's face split (D149, splitFaceAlongCurve). The person can still put the face whole in one half.
  - `MOULD_STEPPED`, a parting loop not flat, or loops at more than one height: a stepped parting surface, IM7a.
  - `MOULD_ACROSS_PLANE`, a half's face on the other side of the plane, e.g. a cup's inside put in the moving half (its core reaches below the rim): an insert, IM7a.
  - `MOULD_PULL_AXIS`, `_ONE_BODY`, `_NO_PULL`, `_NO_PARTING`, `_BUILD`.
  - So only straddling faces wait for the kernel. IM7a, the next stage, is the cup's core insert and the stepped parting surface.
- **Surfaces**:
  - The injection report gains a `tooling` rule after `parting`: pass with the plane, the shut-offs and the side cores, warn when an undercut stays unfreed, unknown with the code otherwise.
  - `cad-cli mould part.bcad -o dir [--margin mm]` writes mould.step (both halves, two solids) and mould.json (the plane, the block, the halves' volumes and labels, shut-offs, side cores, stuck regions, what is not built, the margin's basis).
  - No tool or action; no viewport or App.tsx change.
- **IM8c's modulus corrected** (the coordinator's review). A plate 2r thick has V/A ≈ r, not r/2 (S0's 100×100×10 plate: 4.17 against r = 5). Each hot spot's modulus now comes from its plateau's shape, read from the covariance's principal extents; an extent longer than the ball's diameter counts:
  - a sheet (two or more such extents) gives r;
  - a line (one) gives r/2;
  - a point (none) gives r/3.
  - The range [r/3, r] is reported, and the value is labelled an estimate. Feeding (ball reach) is unchanged.
- **Tests**:
  - `test/im7.test.ts`, 5:
    - the holed plate's plan: plane z = 10, one shut-off of π·5² within 2 % (the chord), centroid (30, 20);
    - the halves' exact volumes: 48000 and 96000 − (24000 − 250π), summing to the block less the part, 1e-6;
    - the refusals: the rod across the pull → D149; the cup → MOULD_STEPPED; the cup with its inside in the moving half → MOULD_ACROSS_PLANE;
    - the side hole's ±X side core on the refusal, and the report's tooling rule;
    - the CLI.
  - One more in im8c (the plate a sheet ≈ r; a long round bar a line ≈ r/2; a cube in a plate a point ≈ r/3; the L junction a line).
  - Flow step "IM7": injection with Pull +Z; through the real chat a holed plate gives "parting pass, tooling pass".
  - The injection rule lists pinned in printing.test, mould-undercut.test and the IM5 flow step gain `tooling`.

## O111 — IM7a: a cup's core and a stepped parting line — the block less the part cut and its lumps given to halves by rays (2026-10-21)

- **The construction** (`mould/tooling.ts`, replacing S0's single plane cut):
  - The block less the part is cut by the plan's planes: each parting height across the pull, and, between two heights, each riser's plane. A riser is a flat wall of the part along the pull running from one parting height to another.
  - Only pieces that span a plane are split. Each piece of more than one lump is separated (lumps counted by mesh connectivity; the kernel refuses to separate a one-piece body).
  - Each lump goes to a half by rays along ±pull against the part, from a hair inside each of its 32 largest triangles, voting by area:
    - shadowed from above (the part over it): the fixed half;
    - open above and on the part below (a cup's inside): the moving half, its core;
    - neither or both: the side of the nearest parting loop's height (across the pull).
  - The lumps partition the block less the part, so the halves' volumes sum to it exactly.
  - The halves are now lists of lumps. mould.json lists each lump with its half, its basis and its volume, plus each half's lump count and total.
  - The tooling rule says "meeting at N parting heights … and R risers" when there are several heights.
- **What it does**:
  - A cup is moulded either way: with its inner walls in the fixed half (IM5's default: the parting line stepped at the floor, 2, and the rim, 25, the inner walls its four risers), or with them in the moving half (the rim the one plane). Its inside goes to the moving half as the core.
  - A stepped block (50 × 40 × 20 beside 50 × 40 × 10): its halves meet at z = 20 and z = 10 on the step's wall x = 50.
- **IM5's chaining fixed**: a loop that has come back to its start is now closed, and stops growing. Before, it ran on into another loop near it (two stepped loops a riser apart were joined into one "stepped" loop with a jump), because the tolerance a straddling face's isocline needs is wide. IM5's own tests still pass.
- **Shut-offs**: a closed loop inside another at its height, now meaning smaller and with a point of it inside. A centroid test counted the outer loop as inside the hole whose centre it shares.
- **Refused, with what each waits for**:
  - a straddling face: the kernel's face split (D149);
  - a sloped or curved parting line (a loop not flat), or a riser not flat across an axis: IM7b, a parting surface off the axis planes.
  - The S0 code MOULD_ACROSS_PLANE is gone: the rays now decide it.
- **Tests** (`test/im7.test.ts`, 7). Each case's halves sum to the block less the part to 1e-6:
  - the cup both ways: the moving half 46368 + 48000, the fixed 108000;
  - the stepped block: the moving half 36000 + 72000, the fixed 120000;
  - S0's plate, its halves now lump lists;
  - the CLI.
  - Flow step "IM7a": through the real chat a cup ends "tooling pass".

## O112 — PKG-h: the model-only tests in @barocss/cad-model (2026-10-21)

The coordinator's order, the PKG roadmap's last step (research-package-boundary §PKG-h): move the model-only tests into `packages/barocss-cad-model/test`.

- **The runner**: `packages/barocss-cad-model/scripts/test.mjs` bundles each test with the package's sources, as the studio's runner does, and runs `node --test` from the package.
  - Every test lives in `test/`, so `import.meta.dirname` is defined as that folder in every bundle, and a test's paths are its own.
  - `pnpm test [name …]` runs the suite or the named tests; type-check and lint include `test/`.
  - The root `pnpm test` is already `pnpm run -r test`, so it picks the package up with no root change.
- **What moved** (git mv, five commits, each green with the name diff):
  1. 72 tests with no paths;
  2. 30 more: 26 on the kernel's conformance (their paths now from the package root, two levels below the repo as the studio is, so the same relative paths hold) and mould-draft, mould-parting, mould-walls and mould (D149 touches no studio file, the coordinator);
  3. the studio's `conformance/{a1,a2,a3,a4}`, read only by these tests, with the 8 tests reading them;
  4. 12 fixtures (block-cm.stl, two .bcad, nine *.calls.json) with the 12 tests reading them. The flow and cad-external now read those fixtures from the package.
  5. `tools-v2.json`, byte-identical at sha-256 885c5fe2…, to `packages/barocss-cad-model/src/chat/` beside contract.ts, with toolset.test and tool-contract.test, run with no update flag.
  - 124 test files in all. In a moved test, `'@barocss/cad-model/X'` became `'../src/X'` (inside the package, imports are relative) and `process.cwd()` became `resolve(import.meta.dirname, '..')`.
- **Split, not moved**: a few tests of the studio itself were cut out unchanged and stay in the studio:
  - engine.test's one viewport-camera test is now `sketch-framing.test.ts`;
  - toolset.test's MCP-server, chat-server and O105b-through-MCP tests are now `toolset-mcp.test.ts`;
  - tool-contract.test's MCP-server test is now `tool-contract-mcp.test.ts`.
  - meshWire.test reads the DOM's `Transferable` as `unknown[]`, since the package has no DOM lib.
- **What stays in the studio**: tests of the servers (MCP, chat, CLI, A/B), of the UI, viewport and App, ones that spawn the studio's scripts, the bench fixtures', pkg-boundary (the app's own boundary check), mould-quote and mould-undercut (server imports), and instance / instance-drag (held for the GPU lane). The kernel's tests are untouched.
- **Names**: before, 805 in the studio. After, studio 179 + package 626 = 805, and the union equals the set before, 0 missing and 0 added, at every step.
- **Release note**, unchanged: the exports point at .ts sources, so a build step comes before a real publish (O107).

## O113 — IM7b: straddling faces split along their isoclines (D149) before the halves; a loop climbing along walls (2026-10-21)

- **The split first** (`mould/tooling.ts`, `splitStraddles`):
  - A display face IM5 finds straddling the pull may be several kernel faces. A full cylinder's side, for one, is two half-faces `n1.side0#1` and `#2` under one display name.
  - Each of them gets a `split-face` node in the document's history, the kernel's D149 isocline split with the pull, with pieces `<face>#1` on the + side, `#2`, …. A new studio node kind, `{ kind: 'split-face', parent, face, pull, names? }` (engine/doc.ts, engine/part.ts), is internal to the mould tooling: add_features does not document it, so the agent's feature kinds do not list it.
  - A kernel face already one-sided (NO_SPLIT, or ON_BOUNDARY "wholly on one side": its seam on the isocline) needs no split.
  - Any other refusal is said with its tag, as MOULD_STRADDLE.
  - IM5's parting line traces the isocline across a straddling face, so it holds as the halves' line. The plan accepts the resolved faces, including their pieces' names on the split part.
- **A loop climbing along walls**: a parting loop that is not flat but climbs only along faces along the pull (a rod's end caps, above its isocline) takes the height of its runs across the pull. The cut plane crosses those walls. A loop that climbs across other faces is refused as MOULD_STEPPED: a parting surface off the axis planes, not built, said.
- **The rod across the pull** (S0's D149 refusal), Ø20 × 50 along X, pull +Z, moulds on the plane through its axis, z = 0:
  - drawn with its seam on the isocline, no split is needed;
  - drawn with its seam across, both half-faces are split (two `split-face` nodes).
  - Either way each half is 70·40·20 − 2500π, summing to the block less the part to 1e-6.
  - The same rod tilted 45° in XZ slopes its parting line across the cylinder (not a wall): MOULD_STEPPED.
- **Surfaces**: the injection report's tooling rule and `cad-cli mould` split first. mould.json lists the faces split; the rule says "N faces split along the isocline".
- **Tests** (`test/im7.test.ts`, 7): the rod both ways, halves exact, the splits in the document's history; the tilted rod refused; the CLI's refusal now the tilted rod's MOULD_STEPPED. IM7a's and S0's cases are unchanged.
- **Merged**: the integration tip 1355102ab (D149 and its RB rows), the kernel rebuilt.

## O114 — FR S0: the plan for FR's leftovers (items 1–7), its oracles and data rules (2026-10-21)

Owner, relayed by the coordinator: "FR 에서 1, 2, 3, 모두 하고 그 밖에 남은 것도 하고" (do all of FR's leftover groups 1, 2, 3, plus the rest FR left): roadmap item 5, the outer lane's part. Evidence is in `packages/barocss-cad-model/test/fr-s0.test.ts` (4 probes).

- **What exists**, from a survey of the code:
  - Frames, the cut list (FR4a), the cut-list drawing table (FR4b) and O67's A3 fix for A4.
  - tslot-20's library parts with their interfaces.
  - CNC7b's user-loaded stock pattern (`StockRow`, `set_stock`, "none is built in").
  - Nothing for weld data, nesting, a section library, a shared skeleton or a 3D skeleton. Frame members have no interfaces, so hardware cannot snap to them.
- **Probes**:
  - **P1**: a mitred corner's weld seam is read off the geometry. The mitre face of a 40 × 40 × 3 tube cut at 45° has an outer loop of 2 · (40 + 40√2) = 193.137 and an inner one of 2 · (34 + 34√2), both to 1e-3. Weld lengths need no table.
  - **P2**: nesting must be exact for small counts. First-fit-decreasing packs 5 5 4 4 3 3 3 3 into bars of 10 as four; the optimum is three (5 5 · 4 3 3 · 4 3 3). With a 0.5 kerf the optimum is four. The waste total is the bars less the pieces less the kerfs.
  - **P3**: a parameter already moves two frames together. That shares numbers, not a skeleton's topology.
  - **P4**: the cut list's pieces carry each long-point length (320 and 220 for the L's mitred members) and the counts nesting needs.
- **The stages**, each with closed-form oracles, mutants, a flow step and the usual checkpoint:
  - **FRa, the A4 cut-list placement (item 6, D128)**: when no free rectangle on A4 holds the whole table, split it into column blocks of whole rows, each placed clear with its header repeated; else say so. Oracle: no overlap with any view, name or title block on the A4 welded table at 1:20; the rows' total is unchanged.
  - **FRb, stock nesting (item 2)**:
    - The stock is a user-loaded list (`doc.frames.stock`: {id, lengthMM, count?, source}); none is built in, as CNC7b.
    - The kerf is the user's, else an estimate flagged as one.
    - Pieces come from the cut list's long-point lengths. Exact branch-and-bound up to a stated count (P2's oracle), else first-fit-decreasing with the gap to the lower bound ⌈Σ(L + kerf)/stock⌉ said.
    - The plan per bar, with the offcuts and an exact waste total. A v2 action `features.frame_stock`, and cad-cli and the cut-list dialog's own export.
  - **FRc, the user's section library and its editor (item 3)**:
    - `doc.frames.sections` rows (kind, dims, name, source or estimate; none built in, D122); a frame's `section` may name one.
    - A v2 action to load or edit rows; an editor panel in the Library panel (src/ui, not the viewport or App's joint, explode or section paths).
    - The palette's prefills stay flagged as estimates. Oracle: a frame on a library row evaluates to the same body as the same section inline.
  - **FRd, weld metadata and symbols (item 1)**:
    - Each frame joint gets a weld record: its kind (fillet, butt, all-round), size and the person's notes.
    - The seam lengths come from the joint's faces (P1). The size is the person's or an estimate rule flagged as one.
    - Drawing symbols are our own glyphs built from the joint's geometry (reference line, arrow to the seam, the weld's mark), with no standard's text copied. They go in SVG, PDF and DXF.
    - Oracle: P1's lengths, the symbol count equal to the joints, and the arrow's end on the seam.
    - Bead geometry is the kernel lane's (after R12c); the symbols on beads wait for it, said.
  - **FRe, T-slot hardware on frame members (item 5)**:
    - A tslot frame member exposes slot interfaces along its axis (role t-slot, accepting slot-nut), its ends and its faces, so library hardware (tslot-20's nut, cap, bracket) snaps to it.
    - Dimensions come from the library's rows (user-loaded or sourced per page), never a built-in table.
    - Oracle: a nut snapped to a member's slot sits where tslot-20's own profile places it.
  - **FRf, shared skeletons (item 4)**:
    - A skeleton node (points, segments) that several frames reference, so editing it moves them all.
    - A frame that follows another part's sketch: its segments taken from that sketch's entities lifted by the sketch plane, kept live.
    - Oracle: editing one point moves every member on it, in each frame.
  - **FRg, the 3D skeleton sketch's model (item 7)**:
    - Points, segments and 3D constraints in cad-model: coincident, length, angle, parallel, perpendicular, on an axis or a plane, fixed.
    - Our own solver (Gauss–Newton with Levenberg–Marquardt damping, no WASM) with typed over- and under-constraint diagnosis.
    - The viewport tool is the GPU lane's (G17), built on this.
    - Oracle: closed-form constructions (a rectangle of given sides square in 3D, a tetrahedron of given edges) to 1e-9, and the degrees of freedom left.
- **What waits on the kernel lane's FR geometry** (after R12c): gussets in the cut list, weld beads (FRd's symbols on beads), end caps, tapered flanges, arc members, weld gaps and saddle notches, and the 7.5 s trim. Each stage does its model and drawing side against today's geometry and says what waits.
- **Data rules** (unchanged): no built-in stock, section or hardware table; every value is the user's, a public page's with its record, derived by a stated rule, or a flagged estimate; no ISO or ANSI text.
- **Order**: FRa, FRb, FRc, FRd, FRe, FRf, FRg. The coordinator may resequence.

## O115 — FRa: a table with no room whole goes in blocks; the A4 cut list placed clear (D128) (2026-10-21)

- **The cause, measured**: on the A4 welded table at 1:20 the cut list is 166 mm wide, and the widest room clear of the views is about 85 mm (x 202–287). No whole placement exists. The table stayed at its first place, over the right view and its name (D128); O67's fix offered A3.
- **The rule** (`drawing/sheet.ts`, `inBlocks`): when no room holds the whole table, it goes in the fewest blocks that all fit.
  - Its columns go in 1–3 groups of whole columns in order, each led again by the first column, the key (ITEM), and its rows in 1, 2 … blocks of whole rows in order, sizes differing by at most one. There are at most 6 blocks.
  - Each block has its header, the title on the first, the notes on the last. Each is placed clear in turn by the sheet's own search, as a whole table is.
  - A table placed in blocks lists each one in `sheet.tables` with `part: [k, n]`.
  - A table the person keeps whole (`whole: true`) is never split, and O67's sheet and scale fixes apply to it as before.
  - None fits: as before, the issue list says what it meets and offers the A3 or scale fix.
- **On the A4 welded table at 1:20** it is 3 blocks (the columns in three groups, all five rows each), in the free column right of the views: [220, 130, 287, 165], [229, 95, 287, 125], [220, 50, 287, 90]. The issue list finds nothing on it. Every column appears in a block; every row appears once a group, in order.
- **Tests**:
  - frame-acceptance: the A4 expectation is now "in blocks, clear" (it was the overlap and its A3 fix): key column in each block, title first, notes last, rows in order, blocks apart.
  - drawing-table: O67's fix paths keep `whole: true`; the same 10×6 table on A4 and 12×8 on A3 without it go in blocks, clear, every column present.
- Rendering (SVG, PDF, DXF) is the table group's marks and needs no change.

## O116 — FRb: the cut list nested into the shop's stock lengths, exact for small counts (2026-10-21)

- **Data** (`doc.frames`, versioned): `stock` [{id, lengthMM, count?, section?, source}] and `kerfMM`.
  - The user loads them: `features.frame_stock` (handler `set_frame_stock`), or `cad-cli nest --list`. None is built in (CNC7b's pattern).
  - A row with no `section` takes any section. One with a section takes only the cut list's rows of that section text.
  - An unset kerf is taken as 3 mm, an estimate, and said (`kerf.basis`).
  - Rows are refused by name (FRAME_STOCK_ROW: no source, a length ≤ 0, a count not a whole number, an empty section, two rows of one id). A kerf outside 0–20 mm is FRAME_KERF.
- **The rule** (`frames/nesting.ts`, `nestCutList`):
  - Each piece is its long-point length (FR4a). A bar of k pieces takes k − 1 kerfs; its end is left as it comes.
  - Per section, the plan minimises total stock length, then the bar count.
  - Up to 14 pieces it is exact: branch and bound, longest piece first, into each distinct open bar (same stock and free length tried once) or a new bar of each stock row left. The bound is the length used plus what the rest needs past the open bars' free length. The budget is 200 000 nodes.
  - Past 14 pieces, past the budget, or with counts that leave a piece without a bar, it is first-fit-decreasing into the shortest stock that takes the piece.
  - Each section states its method, whether it is optimal, and its lower bound: over bar counts b, the least of max(pieces + kerf · (n − b), b · shortest stock), where b of the longest stock can hold them. A first-fit-decreasing plan at the bound is optimal; otherwise the gap is stated as "at most".
  - The waste is exact: the bars' length less the pieces' and the kerfs'. Pieces no stock takes are listed as NEST_TOO_LONG, or NEST_STOCK_SHORT when the counts are spent.
- **Surfaces**:
  - The cut list's result (`query.cutlist`) gains `nesting`: the plan, or `{error}` saying how to load stock.
  - The cut list dialog shows the bars, the stock, the waste, the kerf and each section's method, with a nesting CSV.
  - `cad-cli nest part.bcad -o folder [--list lengths.json] [--kerf mm]` writes nesting.json and nesting.csv. It exits 1 when refused or when a piece is left over.
  - The v2 contract adds `features.frame_stock` (compatible; recorded in tools-v2.json). Per turn is 21,682 characters (+142).
- **Closed forms**:
  - FR S0's P2: 5 5 4 4 3 3 3 3 into 10s is exactly 3 bars with no waste (FFD takes 4). With a kerf of 0.5 it is 4 bars, the waste 40 − 30 − 2.
  - The welded table's 12 long points (9320 mm) into 6000 mm bars at a 3 mm kerf: 2 bars (9320 > 6000), the waste 12 000 − 9320 − 30 = 2650. With 4000 mm bars too: one of each, 10 000 mm, the waste 650, since no sum of 4000s and 6000s lies in [9330, 10 000).
  - The mitred L (320 and 220) into 600: one bar, 543 used, the offcut 57.
  - 40 × 1000 into 6000: first-fit-decreasing takes 7 bars, at the bound of 42 000 (six bars hold 36 000), so optimal.
- **Tests**: package frame-nesting (5); studio frame-nest-cli (the CLI); fields (the new field); chat's tool set. Flow step "FRb …" after FR4b.
- **Not done**: optimising for offcuts kept for reuse, or several kerfs per saw. The cut list's rows are taken as cut from straight bars: no bend allowance (FR's bent members wait on the kernel).

## O117 — FRc: the user's section library and its editor; a frame names a row (2026-10-21)

- **Data**: `doc.frames.sections` holds rows {id, name?, section, source | estimate: true}.
  - A row's section is given by its dimensions (rect-tube, round-tube, angle, channel, tslot), the kernel's kinds.
  - A row needs a source, or the flag that its sizes are estimates. None is built in (D122).
- **A frame or member names a row**: its section is `{kind: 'library', id}`, and so may an override's.
  - `engine/part.ts` resolves it from the document's library before the kernel, so the kernel is untouched.
  - The chat refuses an id the library does not hold: FRAME_SECTION_UNKNOWN, with the rows listed.
  - A document naming a deleted or renamed row (written by hand) is refused at evaluation in `engine/part.ts`, typed `[FRAME_SECTION_UNKNOWN]` with the row and the rows held, titled "A frame names a section that is not in the library". It never falls back to another section.
- **Editing** (`frames/sections.ts`, `editSections`), shared by the chat and the panel:
  - Rows are added or replaced by id, and ids removed. A changed row moves every frame on it.
  - A row in use is not removed: FRAME_SECTION_IN_USE, naming each feature as `feature i (label)`.
  - Rows are refused by name: FRAME_SECTION_ROW (no source and no flag, a sketch or library section, a missing dimension, an unknown field, two rows of one id).
- **Surfaces**:
  - The v2 action `features.frame_sections` (handler `set_frame_sections`) re-evaluates the part.
  - The Library panel's SECTIONS list shows each row's label, its source or "estimate", and how many features use it. A form adds or edits rows (an edited row keeps its id), and a sections file (JSON) can be added. Remove is disabled while a row is in use.
  - The palette's member and frame commands offer "From your library" and its rows once the document has some. The prefills stay flagged as estimates, as before.
  - A member's panel names its row and the row's source. An estimate row is a warning: "its sizes are estimates, not your stock's".
  - v2 records the action (compatible). Per turn is 21,808 characters (+126).
- **Closed forms**:
  - The mitred L on a row is the same as with the section inline: volumes, centroids and boxes exactly.
  - Two straight frames on R40 (40 × 40 × 3) are each A · 300 = 133 200 mm³. With R40 edited to 50 × 30 × 4 they are each 576 · 300 = 172 800.
- **Tests**: package frame-sections (5); fields (the new field). Flow step "FRc …": a row written in the panel, a frame on it through the chat, the row edited and the frame following.
- **Found by the flow step**: the studio's evaluated document followed only the nodes and parameters, so a row written before the frame never reached the evaluation, and the frame was refused FRAME_SECTION_UNKNOWN. `evaluated` now also follows `doc.frames.sections` (App.tsx, the core memo, not the GPU lane's paths). The editor's form and buttons are keyed apart (React reused the file input as the Name field).
  - The same step then found the engine worker's view of the document (`evaluatedPart`, wireDoc.ts) without the library, which also left the evaluation memo's key blind to it. The library now crosses the wire (the stock list stays behind). `evaluationKey` follows from that, and `contentKey` (face tables, rendered views) also takes the rows when there are some. A package test sends a frame on a row over the wire and checks the keys change with an edited row.
- **Not done**: a sketch section as a library row (it belongs to one part's features), and sharing rows across parts. A library file stays the person's own; the team libraries (LIB4) are for parts, not sections.

## O118 — FRd1: a frame's weld joints read off the geometry, the person's welds, the weld list (2026-10-21)

FRd is split in two: FRd1 (joints, records, the list as a table) here, and FRd2 (the symbols in the views) next.

- **Joints** (`frames/welds.ts`, `weldList`), where a member's end meets another member:
  - **mitre**: two members cut on one plane at a corner (the kernel's `with`). One joint per corner, named by the lesser of its two end ids. Seam: the mitre face's outer loop. A butt weld by default.
  - **butt**: an end on the face of a member running through (`with`). Seam: the end face's loop. A fillet.
  - **on-face**: a square end lying on other members' faces with no corner between them (a leg under a top), found by contact: the end face's plane on an opposite, coplanar face of another member, their outlines overlapping. A fillet, meeting every member it touches.
  - Ids are `<body>.<end>`, stable while the frame's members are.
- **Seam lengths**: the end face's outer loop on the display mesh (FR S0's P1). `seamBasis: exact` where the section's outer sides are straight (a sharp RHS, an angle or channel with zero radii). `mesh` along a curved side: within the mesh's chord tolerance, said in the list's notes.
- **Inner loops** (coordinator's review): an end face's inner loops (a tube's bore) are given with each joint (`innerLoop.mm`). Whether they are welded is the person's record (`inner: true | false`), never a default. Unsaid, they are not counted in the seam, marked BORE ? in the list, and said in its notes. `weldMM` is the outer loop, plus the inner where said. The welded table's bores: 2(34 + 34√2) at a mitre, 4 · 34 elsewhere.
- **Records** (`doc.frames.welds`, the person's, by joint): kind, size (mm), all round, inner, notes. Unset, the rule's weld: a butt weld at a mitre, a fillet elsewhere, the size the thinner wall of the members. That size is an estimate, a rule of thumb rather than a calculation, and is said. A section with no wall (a sketch, a T-slot) gives no size and says so. A record whose joint is gone (corners changed) is kept and listed as orphaned, not dropped.
- **Surfaces**:
  - v2 `features.welds` (set_welds): refuses WELD_JOINT_UNKNOWN (listing the ids), WELD_FIELD and WELD_NO_JOINTS.
  - v2 `query.welds` (weld_list): joints labelled W1…, totals and orphaned records.
  - The drawing's 'weld-list' table and its "Weld list" checkbox beside the cut list's: W1… with the members as cut-list items, estimated sizes starred, the seams' total.
  - v2 recorded (compatible). Per turn 22,014 characters (+206).
- **Closed forms**, the welded table: 4 mitres at 2(40 + 40√2), 8 butts and 4 legs at 160 each, 16 joints and 2692.548 mm of seam. Every size is 3 mm, an estimate. An RHS 20 × 20 × 2 with 3 mm corners butted in a T: the seam below 2(20 + 20) − 24 + 6π = 74.850 and within 0.5 %, basis mesh, size 2.
- **Tests**: package frame-welds (4). Flow step "FRd1 …": the welds through the chat and the weld list on an A3 drawing, clear and in the SVG.
- **Waits**: bead geometry is the kernel lane's (after R12c). A coped end (FR3b `cope`) has no plane, so it is no joint here yet; said for FRd2.

## O119 — FRd2: weld symbols in the views, our own glyphs, each arrow on a seam edge by name (2026-10-21)

- **The symbol** (`drawing/welds.ts`) is built from the joint's geometry. No standard's text is copied.
  - An arrow whose tip is the midpoint of a visible edge of the joint's end face, found by its persistent name in the view.
  - A leader to a knee just outside the view, then a reference line with the weld's mark on it: a fillet is a small right triangle, a butt weld two short bars.
  - The size before the mark: the person's, or the estimate starred.
  - A ring at the knee where the weld goes all round, and a second ring where the bore is welded too (FRd1's `inner`, the person's).
  - The joint's W-number at the line's end, as in the weld list.
- **Placement**:
  - Each joint is shown once, in the first of front, top and right where an edge of its end face is visible.
  - The knee goes on the side of the view box nearest the tip, OUT 7 mm past it. Knees along one side are kept 7 mm apart in order of their tips.
  - Symbols are placed before the tables, so an auto-placed table keeps clear of their texts.
  - A joint seen in no view gets no symbol. The sheet lists it (`welds.unshown`), and the issue list warns WELD_NOT_SHOWN: the weld list holds it, and a section or detail view would show it.
- **Surfaces**: the drawing setting `weldSymbols` and its "Weld symbols" checkbox (off by default). The sheet's `welds {placed (label, joint, view, tip, edge), unshown}`. SVG, PDF and DXF draw the marks (lines, a fill, arcs, texts) as they draw every group.
- **Oracles**:
  - On the welded table on A3, 11 of the 16 joints are shown (6 front, 2 top, 3 right). W8 and W13–W16 have every edge of their end face hidden in all three views, and are said.
  - Each arrow's tip is the midpoint of an edge named after its joint's end face, visible in its view.
  - The W-numbers appear in the SVG, PDF and DXF.
  - Coordinator's request: a mitred L with its corner at x = w, w 300 → 400. The corner's joint keeps its id, its arrow resolves by the same edge name, and it moves 100 along the front view's x.
- **Follow-up (coordinator's review, folded into FRe's checkpoint)**: the symbols are in the issue list's overlap checks.
  - TEXT_OVERLAP covers symbol against symbol, against dimensions, notes, datums and tables. A weld symbol has no move of its own, so the other annotation is the one moved and fixed.
  - TEXT_OVER_LINES covers a symbol's texts over a view's lines or another view.
  - A dimension's text over a symbol's lines is flagged, and a dimension's move keeps clear of them. Issues name the symbols in `welds`.
  - The checks found real clashes on the welded table (W10 against W11 between the front and right views, W3's text over the top view). So placement now seeks clearance: each symbol takes the first knee, along its nearest side in 7 mm steps from its tip and then the other sides, whose symbol (all but its leader) is clear of every view, the title block, the frame's edge and the symbols placed before it.
  - On A3 with both lists the table is clear. A note planted on W1's number is flagged as overlapping weld symbol W1, the note is the one moved, and Fix all clears it.
- **Open**: a coped end (FR3b `cope`, no plane) gives no joint until the kernel's FR geometry lands. Bead geometry stays the kernel lane's.
- **Fixes found by the run**:
  - FRd1's two long flow step names made the screenshot's file name too long (ENAMETOOLONG), which killed the flow. They are shortened.
  - The read-tools contract test now runs `weld_list`.
  - drawing-table's pinned source list includes 'weld-list'.

## O-G6 — sample exports for the GPU lane's analysis maps (2026-10-21)

The GPU lane's G6 shows the analyses on the model as colour maps and lines. Only new functions were added; the existing ones' results are unchanged (accessOf's loop moved into a shared per-triangle function, adding in its own order).

- **`draftSamples(doc, body, pull)`** (mould/draft.ts) gives a Float32Array, one value per display vertex: the signed draft in degrees, asin(n·d), from the exact normal at the vertex's position. It is the same evaluation draftField makes (a plane's normal, a cylinder's radial, the NURBS foot's). A facet face's vertex takes its display normal.
- **`accessSamples(bodies, stepMM?)`** (machining/access.ts) gives, per body and per display triangle: `unreachedShare` (0..1), the share of its area no ±X, ±Y or ±Z reaches, and `mask`, the OR of its samples' 6-bit masks. These are accessOf's samples, kept by triangle.
- **`isoclinePolylines(doc, body, pull)`** goes in mould/parting.ts, beside the marching and chaining it reuses, rather than in draft.ts. It gives `{face, points, closed}` per straddling face's isocline: its triangles marched as the parting line marches them, chained as its loops are.
- **`castingDraftLimits(doc, bodies, profile)`** (casting/report.ts) is the one extra: a cast part's least and achievable draft by its alloy's family, with the page. The casting report's draft rule switches its `limit` between the two, so it is not a threshold to read.
- **Oracles** (package test g6-samples, 5 tests):
  - A 3° cone's side is 3 at every vertex, to Float32 rounding of a value within 1e-9.
  - The draft's sign changes on exactly the faces draftField calls straddling, over six cases.
  - The access shares, area-weighted, equal accessOf's unreachedMM2 (400 and 760, sealed void and sealed slot). A void's triangles have mask 0, and the top face has +Z.
  - A cylinder r 10 × 40 across the pull gives two open polylines at z = 0, each 40 long. A cone gives none.
  - castingDraftLimits holds the least and achievable that the A380 report's rule judges by.
- **Threshold sources for G6**, confirmed or corrected:
  - **IM2, corrected**: the minimum draft is not the profile's but the surface finish's.
    - Injection: `printability(…).mould.minDraftDeg` (and `recDraftDeg`), the finish chosen in `doc.mould.finish`. None chosen: null, and the draft rule is unknown, so show no marks.
    - Casting: `castingDraftLimits`.
    - Marks at ±min and saturating at 2 × min are the GPU lane's to choose.
  - **IM4, confirmed with sources named**: `wallSamples(body).local` is a Float64Array, mm per triangle, Infinity where no wall.
    - The range [0, max(2 × nominal, thick95)] works: `nominalMM` and `thick95MM` come from wallsOf's report.
    - Red under: the process's `minWall` threshold (the 'wall' rule's limit), and also under the material's moulding range low end when it has one (`materialData(id).wallMM.injection`, the 'wall-material' rule).
    - Purple over: the thick-section limit is `nominalMM / adjacentWallRatio` (the profile's threshold, 0.6 when unset). wallsOf's `thick` gives the faces and `maxMM`, not the limit.
  - **Parting, confirmed**: `PartingReport.loops[].points` are polylines with `closed` and `flat`, in the part's coordinates (a placed instance's transform is the viewer's).
  - **mouldHalves, confirmed**: `plus` and `minus` are BodyResult[] on success, else `{ok: false, code: 'MOULD_BUILD'}`.

## O120 — FRe: T-slot frame members expose the tslot-20 interfaces; library hardware snaps to them (2026-10-21)

- **The interfaces** (`frames/interfaces.ts`, `tslotInterfaces`): a T-slot frame member (a frame's or a single member's) gets tslot-20's own profile interfaces, with the same ids, roles and accepts:
  - `slot-t1` … `slot-l`: t-slot ⇄ slot-nut;
  - `end0` and `end1`: profile-end ⇄ end-cap;
  - `face-top` and `face-right`: profile-face ⇄ bracket-leg.
- **How each frame is read**: off the member's own faces, by the kernel's section names, with no table of sizes. Every plane is the face's exact one, since the display mesh's points are single precision and gave 8.199999809 for 8.2.
  - A slot: on its lips' underside (`<slot>.under0`), centred between its two lips, at the member's start; z the underside's normal (into the slot), x along the member.
  - An end: on its end face, at the section's origin (the first cell's centre, from the outer faces).
  - A face: on the top or right outer face.
  - The mates go on the face each frame lies on.
- **Snapping**: `snap_part` takes `<body>.<id>` (e.g. `b0.slot-t1`) on any part holding T-slot members. A missing one is refused with the part's interfaces named. `get_assembly` lists each part's `member_interfaces`. No kernel face-naming change was needed.
- **Oracles** (package test frame-tslot-interfaces, 5 tests):
  - Every interface of a 20×20 member with four slots open, and of a 20×40 member with six, has the frame of tslot-20's profile in each one's section coordinates, to 1e-9.
  - A slot nut snapped 100 along slot-t1 sits where it sits on the library's profile (position and turn), with its mate on the member's `t1.under0`.
  - The chat path (get_assembly, insert_part, snap_part) puts it in the same place.
  - An RHS member has none.
- **Flow step "FRe …"**: through the chat, the member's first build applies; the nut's insert and snap are proposed and accepted; the mate is on `t1.under0`.
- **Open**: end caps and brackets snap through the same ids and are not flow-tested here. Hardware sizes stay the library's estimates as it states them.

## O121 — FRf: shared skeletons; a frame follows a skeleton or a sketch, kept live (2026-10-21)

- **The model** (engine/doc.ts):
  - A `skeleton` node holds points and straight segments, and makes no body.
  - A frame's `follows: {skeleton: k} | {sketch: k}` gives it that source's points and segments at every evaluation (`frameGeometry`).
  - A followed sketch gives its straight edges (a rectangle's four, a polygon's, an outline of lines) lifted by its plane, its parameters' values read at that evaluation.
  - A frame keeps its own `points` and `segments` as a copy, set when it is added. They are not read for geometry: the kernel document, the body list, member notes and the edit fields all resolve the source.
- **Live**:
  - Editing the skeleton (or the sketch) moves every frame on it.
  - A frame that follows has no point fields of its own (they are edited at the source); its corner choices use the followed points.
  - A skeleton has point fields in the feature editor.
  - The evaluation memo and the worker see the skeleton as a node, so no extra keying was needed.
- **Typed refusals**, each naming the frames, never a silent break:
  - Deleting a skeleton or sketch a frame follows is `FRAME_SKELETON_IN_USE` (deleteFeature, through `parentsOf`/`usesOf`).
  - An edit of a followed skeleton that takes away a segment, or a point its segments use, is `FRAME_SKELETON_IN_USE` (edit_feature). Moving points and adding points and segments is fine.
  - A frame following what is no skeleton or sketch is `FRAME_SKELETON_UNKNOWN` / `FRAME_SKETCH_UNKNOWN`. A curved sketch is `FRAME_SKETCH_CURVED`. Both are refused at add_features (checkNode) and at evaluation (engine/part.ts, for a document written by hand).
  - A skeleton's segment naming a point it lacks is refused at the check, and `FRAME_SKELETON_POINT` at evaluation.
- **The prompt** gains one line on skeletons and `follows`. Per turn 22,032 (+18).
- **Closed forms** (package test frame-skeleton, 4 tests):
  - Two frames on a 600 × 400 skeleton (sharp RHS 40 × 40 × 3 and 20 × 20 × 2, mitred) have members A · 600 and A · 400. Edited to 800 × 400, both follow. Adding a point and a segment adds a member to each.
  - A frame on a 300 × 200 rectangle sketch on z = 100 sits on that plane; the sketch edited to 500 × 200, it follows.
  - Every refusal above is tested.
- **Flow step "FRf …"** through the chat: 8 members; the skeleton's points moved by a value edit (L2 applies it); the first member is 444 · 800 mm³; deleting the skeleton is refused and it stays.
- **Open**: a sketch in another placed part (an instance) is not followed. That would be a reference across parts' documents, which neither the mates' faces nor the evaluation carry today. Followed sketches here are the same part's features, as the frame command's edge pick was.

## O122 — FRg: the 3D skeleton sketch's model and solver, our own (2026-10-21)

- **The model** (`frames/sketch3d.ts`): a skeleton's `constraints` among its points and segments.
  - Point constraints: coincident, fixed (at a point, default the origin), distance, on-axis (x, y, z or a line), on-plane.
  - Segment constraints: length, angle (0–180°, exclusive), parallel (either sense), perpendicular, along (an axis or a direction).
  - Indices and values are checked, refused as SKETCH3D_INPUT. A skeleton with constraints has numbers for its points.
- **The solver** is our own: Levenberg–Marquardt with no WASM and no numeric library.
  - Each constraint is a residual with its analytic Jacobian. Parallel, on-axis and along are cross products, three rows of rank two.
  - The step solves (JᵀJ + λI)δ = −Jᵀr by Cholesky; λ is divided by 3 on a step that lowers ‖r‖² and multiplied by 4 on one that does not.
  - It stops at ‖r‖ ≤ 1e-10, at 200 iterations, or when no step lowers ‖r‖.
  - The residual function's helpers are module-level, with no closures in its loop.
- **Diagnosis** at the solution:
  - `dof` is 3N less the rank of the rows, each normalised and orthogonalised in order (Gram–Schmidt twice, 1e-8).
  - `redundant` lists constraints adding no rank to those before them. `unmet` lists those whose residual stays above 1e-9.
  - `free` lists points with a coordinate outside the rows' span.
  - `status` is well, under, over or conflict. A sketch with nothing fixed keeps its rigid motions (6, or 3 for a point).
- **In the document**: a skeleton with constraints is solved when added and on every edit, from its points as given, and stored solved. Frames that follow it (FRf) follow the solved points.
  - A conflict is refused: `[SKETCH3D_CONFLICT]`, naming each unmet constraint and its residual.
  - add_features returns each solved skeleton's status, dof, redundant and free.
  - The prompt's skeleton line names the constraints. Per turn 22,039 (+7).
- **Closed forms** (package test sketch3d, 5 tests):
  - A tetrahedron of edges 3, √5, √6, √8, 3, √5, with p0 fixed, p1 on the x axis and p2 on the xy plane: well constrained, 0 freedoms, every corner at (3,0,0), (1,±2,0), (1,±1,±2) to 1e-9. Edges 3–8, which bound no tetrahedron (Cayley–Menger negative), are a conflict.
  - A rectangle 30 × 20 from a tilted start, with p0 fixed, its two lengths, a square corner and opposite sides parallel: every side to 1e-9 and every corner 90° to 1e-7, with 3 freedoms left (turning about p0). With its first side along x, 1 freedom.
  - A free segment of length 10 has 5 freedoms; two coincident points 3; two free points 6.
  - A triangle 1 1 5 is a conflict with its lengths named. A length given twice is over, the second redundant.
  - Through the chat: a rough rectangle solved to 600 × 400 with a mitred frame on it (A · L); its length edited to 800, solved again, the frame following; a contradicting distance refused.
- **Flow step "FRg …"**: the rough rectangle and a frame through the chat. The solved corners are (600, 0, 0) and z = 0, and the first member is 444 · 600 mm³.
- **The viewport's tool** is the GPU lane's (G17), built on `solveSketch3D` and its diagnosis.
- **Not done**: constraint values bound to parameters (they are numbers), and a dragged point's solve (the tool's, G17).
- **The FR queue (O114) is done**: FRa through FRg, items 1–7. What waits on the kernel lane's FR geometry (gussets, beads, end caps, coped joints, a cross-part followed sketch) is said in each stage.

## O123 — FRf2 S0: a frame following another part's sketch — the reference across parts, frozen (2026-10-21)

The coordinator asked for this as its own stage (D122's "a frame cannot follow another part's sketch", in scope since the owner said all of FR). The design question is the reference across part documents. It uses A7's revisions and A8's digests, with no new link. Evidence is in `packages/barocss-cad-model/test/frf2-s0.test.ts` (4 probes).

- **What a "part" is here**: a placed instance (`doc.instances[k]`) whose document the assembly holds inline. Parts are not separate files; a team bundle carries the one assembly document. So the reference crosses part documents inside one assembly document, not files.
- **Probes**:
  - **P1**: a placed part's sketch, lifted by its plane and placed by the instance's `rotationMatrix(rotation)·p + position`, is where the part's own body stands (a 300 × 200 plate at (100, 50, 0) turned 90° about z: its box to 1e-9). The transform is the mates' own.
  - **P2**: freshness's `modelInput` already holds each part's own model, recursively. A base frame following a part's sketch has its results go stale when the part changes. **No freshness change.**
  - **P3**: A7's `revisionOf(part doc)` follows a part's content, not its placement; A8's `partDigest` follows both. So the link pins the revision, and the placement is read live.
  - **P4**: a part is deleted today whatever refers to it.
  - **P5**: the base's evaluation input (`evaluatedPart`) holds its parts' documents; a part's own evaluation holds no siblings.
- **The reference, frozen**: `follows: { part: '<instance id>', sketch: '<the sketch's stable feature id in that part>', revision: '<A7 revisionOf of that part's document when linked>' }`.
  - It names the feature by stable id (FR's other references use indices within one document; across documents only ids survive the other part's reordering).
- **Live**: the geometry is the part's sketch now, lifted and placed by the instance's placement now, at every evaluation of the base. A change in the other part reaches the base on the base's next evaluation: the evaluation memo's key already includes the instances' documents (evaluatedPart), and the studio's `evaluated` memo will also follow the followed parts (App.tsx's core memo, as FRc did for the section library).
- **Staleness**: the geometry is always current. The pinned `revision` says which version the person linked. When the part's revision differs, the frame's member notes, its result and the issue list say "the followed sketch changed since it was linked (a → b)" until the person relinks (`features.edit` with the new revision, no new action). Results go stale by freshness as P2 shows, and baselines already pin each part's digest (A8.4b), so an approval sees the part changed.
- **Refusals**, typed, naming the frames:
  - FRAME_PART_UNKNOWN: no such placed part.
  - FRAME_PART_FEATURE_GONE: no feature with that id in it.
  - FRAME_SKETCH_UNKNOWN or FRAME_SKETCH_CURVED: not a straight-edged sketch. All of these at add or edit and at evaluation.
  - FRAME_PART_IN_USE: deleting a followed part (delete_part), or deleting or replacing its sketch with a curved one through the part-scoped tools.
- **Scope, and the one assembly-wide change, said before building**:
  - v1 lets **the base part's frames** follow placed parts' sketches. That needs no assembly-wide evaluation change (P5: the base already holds its parts).
  - A frame **inside a placed part** following a sibling would need each part evaluated with its siblings, an assembly-wide evaluation change (parts are evaluated alone today: describe, placedBodies, the mates' solve). Refused there, FRAME_PART_SCOPE, until decided.
  - A sub-assembly's nested parts are reached through their instance only (`part` is a top-level instance id).
- **Next**: FRf2 itself, after the coordinator's reply on this S0.

## O124 — D155 on the drawing and the A3 query: fit callouts with their limits; fit_clearance (2026-10-22)

The kernel lane's request (D139 puts these with the outer lane), queued after FRg and before FRf2's build.

- **Fit callouts** (`drawing/fits.ts`):
  - A diameter dimension on a face that carries a tolerance class (`doc.fits.faces`, the kernel lane's D155) reads the class and its limits from the user's tables at the dimension's own size. For example `Ø12 H7 (+0.018/0)`, or for a declared hole–shaft pair `Ø12 H7/g6 (+0.018/0, -0.006/-0.017)`. The limits come from the kernel's `lookupFit` / `fitLimits` and are written as the row gives them.
  - `(est.)` follows when a row is an estimate.
  - The deviations are in mm with an ASCII sign (+0.025, 0, -0.009), as the PDF's fonts show.
  - The size and a hole's callout come first: `Ø12 THRU H7/g6 …`.
  - The callout function now also takes the measured diameter (`(edge, diameterMM?)`, compatible with every caller). The issue checks that compare hole callouts call it without one, so they are unchanged.
- **A class with no row** for that size keeps its class alone in the callout and is a typed issue in the drawing's list: `FIT_ROW_MISSING` (error), with the kernel's FIT_TABLE_MISS saying what to load. Never a guessed limit.
  - The model's evaluation already refuses such a document (D155). The drawing builds from the bodies' B-reps without that check, so the issue is what the drawing shows when a row is gone.
- **`fit_clearance`** (v2 `query.fit_clearance`, read only) takes either form:
  - The hole and shaft faces, with their classes as set or given: the limits, the least and greatest clearance (µm, negative for interference), the kind, and the kernel's `checkFit` at MMC and LMC (overlaps, the axes' offset, the margin, `contradicted`).
  - Two classes and a size: the limits.
  - A class with no row is refused, typed (FIT_TABLE_MISS). A face with no class is FIT_FACE.
  - Recorded in tools-v2.json (compatible). Per turn 22,211 (+168 over 22,043).
- **Closed forms** (package test fit-drawing, 3 tests; the kernel test's tube and pin):
  - The callouts and deviations.
  - The bore's auto diameter on the sheet reads its fit, with no issue. Its class changed to H8 (no row), it reads H8/g6 and raises FIT_ROW_MISSING.
  - fit_clearance on the faces: clearance from 0 − (−6) = 6 to 18 − (−17) = 35 µm, limits 12 … 12.018 and 11.983 … 11.994, clear at MMC. The classes at Ø12 give the same. At Ø30, FIT_TABLE_MISS. The pin 0.01 off the axis is contradicted at MMC (an undeclared pair, since a declared one refuses the evaluation).
  - The read-tools contract test runs it.
- **Flow step "D155 fit callouts …"** follows the kernel lane's Fits step: auto-dimensioned on A3, the bore's callout in the SVG, no FIT_ROW_MISSING.

## O125 — FRf2 v1: the base part's frames follow placed parts' sketches (2026-10-22)

Built as the S0 (O123) froze it, and as the coordinator approved.

- **The reference**: `follows: { part, sketch, revision }`, the placed part's id, the sketch's stable feature id, and the part's A7 revision when linked.
  - `FrameFollows` gains the form, and `followsIndex` keeps it out of local-index code (parentsOf, renumber, flatten, followers).
  - A7's `canonical` and `revisionOf` moved unchanged into `team/revision.ts` (no imports) and are re-exported from team/team.ts, so frames/ can pin a revision without importing chat/tools.
- **Live**: `frameGeometry` resolves the part's sketch by its id, lifts its straight edges by its plane (the part's parameters), and places them by the instance's rotation and position now.
  - The kernel document (engine/part.ts) passes the assembly's parts.
  - The studio's `evaluated` memo follows `doc.instances` only when a base frame follows a part, so moving parts does not re-evaluate the base otherwise. The worker's input already holds the parts.
  - A part-scoped edit refreshes the base frames' copies.
- **Staleness**:
  - Moving the part changes nothing pinned: the revision is its content.
  - When the part's revision differs from the one pinned, the frame's geometry is still current. It is said in `get_part_summary`'s `followed_changed`, as a warning in the member's notes, and as FOLLOWED_CHANGED (warning) in the drawing's issues, until the person relinks through features.edit with the new revision.
  - Linking pins the revision when none is given.
- **Typed refusals**, naming the frames:
  - FRAME_PART_IN_USE: delete_part of a followed part; a part-scoped edit leaving the sketch gone or not straight-edged; one leaving it fewer edges than the frame has members (FRf's rule, as the coordinator asked).
  - FRAME_PART_SCOPE: a frame inside a placed part following any part's sketch. ChatState gains `partOf` for part-scoped calls.
  - FRAME_PART_UNKNOWN and FRAME_PART_FEATURE_GONE, at add or edit and at evaluation.
- **Open (the coordinator raises it with the owner)**: a placed part's frame following a sibling needs each part evaluated with its siblings: describe, placedBodies, the mates' solve.
- **Tests** (package frf2-frames, 3 tests): a 300 × 200 plate at z = 100.
  - The frame's members are A · 300 and A · 200 on z = 100, with the revision pinned and the notes naming the part. Moved to z = 150, the frame moves and nothing is stale.
  - The sketch widened to 400 through the part: A · 400, said in the summary, the notes and the drawing until relinked; relinking clears it.
  - Every refusal above; deleting an unfollowed part is fine.
  - The prompt's skeleton line names the part form; per turn unchanged (22,211).
- **Flow step "FRf2 …"**: a saved assembly with the plate, and a frame following its sketch through the chat. 4 members, the revision pinned.

## O126 — a body's surface area is the kernel's exact one, not the display mesh's sum (2026-10-22)

The coordinator's queue, item 1. The Selection panel's "Surface area" summed the display mesh's triangles, which reads 0.11 % low on the D84 pipe clamp (11 007 vs 11 019.5 mm²). `mass_properties`' `area_mm2` did the same.

- **Now**: each body carries `areaMM2` from the kernel's `brepSurfaceArea`, over its exact surfaces as mass properties integrate them. It is computed once a B-rep (cached like the masses) with `areaBasis: 'exact'`.
  - Where the kernel cannot integrate a body, it falls back to the display mesh's triangles with `areaBasis: 'display mesh'`, labelled "(mesh)" in the panel and as `area_basis` in mass_properties.
- **Tests** (package surface-area, 2):
  - A cylinder r 10 × 20 is 600π to 1e-9, with the mesh's sum below it; a box 40 × 30 × 10 is 3800; mass_properties gives the same.
  - The D84 pipe clamp is its conformance area 11 019.522 to within 1e-4, where the mesh's sum is more than 0.05 % low.
- App.tsx: only the props panel's area line, not the viewport or the GPU lane's paths.

## O127 — the narrow-window top bar: the right-hand tools fold into More tools (2026-10-22)

The coordinator's queue, item 2: O90's follow-up. Below about 1100 px the bar's controls clipped at the window's edge.

- **`src/ui/ToolsTray.tsx`**: the right-hand tools (Chat … Insert part) show as many as the bar has room for, and the rest go from the right into a **More tools** menu.
  - The tray counts the shapes strip at its least (its More button alone), so the shapes give way first, then the tools.
  - Measured again on any size change (ResizeObserver, inside `ui/`).
  - The menu closes on a pick, a click outside it, or Escape. Templates keeps its own dropdown open inside it.
- **Spacing**: the tray keeps the bar's 10 px between tools.
- **App.tsx**: the same 14 tool nodes, passed to the tray (keys added). This is the top bar only, not the viewport or the GPU lane's paths.
- **Flow step "narrow window top bar …"** at 1024 and 800 px:
  - the whole bar fits, and the page never scrolls sideways;
  - every mode button is inside the window;
  - every tool is on the bar or under More tools, none lost (at 800 some fold);
  - Parameters opened from the menu opens its panel.
  - O90's step is unchanged.

## O128 — hollowing's curved-body refusal is structural, not timed (2026-10-22)

The coordinator's queue, item 3. hollow.test asserted "refused at once" by wall-clock time (< 1000 ms) and flaked under load.

- **What it found**: the refusal was never "at once" in structure. For an explicit voxel route on a curved body, `planHollow` built the whole cavity field and its components first and only then refused CURVED_BODY. It was merely fast enough.
- **Now** (print/hollow.ts): the explicit voxel route checks for curved faces before any voxel work. The auto route still builds the field first, since its drains need it for the exact shell too, and refuses as before. `hollowWork.fields` counts the cavity fields built.
- **The test** asserts that the refused call built no field: the count is unchanged, with no clock. Its name now says "refused before any voxel work" (the name diff shows the rename).

## O129 — G12 S0: a proposal's added and removed material, exactly (2026-10-22)

The coordinator's queue, item 4: model data for the GPU lane's two-colour proposal overlay. This is the S0, and the shape goes to the coordinator before building. Evidence is in `packages/barocss-cad-model/test/g12-s0.test.ts` (4 probes).

- **The route probed**: unite each side's bodies (the base before, the proposal after), then `removed = before − after` and `added = after − before` with the kernel's analytic Boolean. It does not depend on body keys: a union node gets a new key though its material hardly changes, so matching bodies by key would call the whole plate removed and added.
- **Probes**:
  - **P1**: a Ø6 hole through a 40 × 30 × 10 plate removes π · 9 · 10 = 282.743 exactly, and adds nothing.
  - **P2**: a boss r 5 × 8 united on its top (a new key) adds π · 25 · 8 = 628.319, and removes nothing.
  - **P3**: the extrude made 15 adds the slab 6000 exactly and removes nothing. This was the hard case, the two sides' faces coinciding, and the Boolean takes it.
  - **P4**: the faces by persistent name. The hole adds `n2.side0`; `n1.top` and `n1.bottom` keep their names but their areas change. "Changed" is by geometry, not by name.
- **Proposed shape**: `proposalDiff(base, proposed)` returns:
  - `added`, `removed`: `{ mesh: DisplayMesh, volumeMM3 } | null`, each the display mesh of the Boolean's result, tessellated as bodies are, so the GPU lane draws it as any body;
  - `changedFaces`: `{ name, kind: 'added' | 'removed' | 'changed' }[]`, by persistent name, with changed by geometry (area, or the A1 signature where kept);
  - `parts`: the existing `proposalParts`, for labels;
  - `method`: `'boolean' | 'faces'`. Where the Boolean refuses (facet or mixed bodies until the kernel's F3), only the faces are given, with `why`.
- **Scope v1**: the base part's geometry. A proposal's placed-part changes are listed by part, not diffed in geometry. It is computed on demand, not per evaluation (two Booleans a proposal).
- **Next**: build after the coordinator's reply on the shape.

## O130 — PERF3 B13 S0: blob eviction — every holder, and a safe rule (2026-10-22)

The coordinator's queue, item 5. The S0 is for the coordinator's reply before building. Evidence is in `packages/barocss-cad-model/test/blob-evict-s0.test.ts` (3 probes).

- **Today**: the store (engine/blobs.ts) keeps every blob of the session, never evicted. P1: a mesh feature deleted, its arrays still held.
- **The holders** of a blob's hash:
  1. **the current document**: its mesh nodes, a repair's result, its placed parts' and pending parts' documents (`blobRefs` covers these);
  2. **undo and redo**: the App's stacks of documents (up to 50);
  3. **open proposals**: their **ops**, not documents. An add_features op may carry a mesh node naming a blob the document does not (P2: `blobRefs` misses it, so a rule over documents alone would drop what accepting the proposal needs);
  4. **a chat turn in flight**: the panel's base, its built and shared states, and the server's copy (by `blobRefs` and the session's sent set);
  5. **a pending mesh repair**: its result's blobs, put before the document naming them is committed;
  6. **the worker wire**: the sender's `sentBlobs` and the worker's own copy of the store. P3: a blob is sent once, so one evicted and put back would never reach the worker again without a forget;
  7. **the kernel's snapshot caches**: they hold their own arrays, but re-read `getBlob` whenever a document is converted, so anything reachable must stay;
  8. **the recovery store** (IndexedDB): already collected against the document it keeps (`collectRecoveryBlobs`), separate from this.
  - Not holders: templates (inlined), the clipboard (a body key), history (hashes of models), baselines (digests), drafts (image and drawing ids), drawings and bodies (evaluated arrays).
- **Proposed rule: reachability, with a grace generation.** `evictBlobs(roots, pinned)` keeps:
  - every hash reachable from the roots: the current document, every undo and redo document, and each document's open proposals' ops (found by walking their args for `blob: {positions, indices}` and repair results);
  - every pinned hash: a pending repair's, and anything put by an operation not yet committed;
  - every blob put since the last sweep (they survive one sweep, so a put whose document is not yet committed is safe without pinning).
  It drops the rest.
  - The app sweeps only at an idle point: after a commit, with no chat turn running and no repair pending.
  - The wire's sender is told the evicted hashes (`forget`), so it sends them again if they come back. The worker drops them when the sender's next request names them as dropped, in lockstep as the nodes are pruned.
- **The test it will carry**: random sequences of mesh adds, deletes, undo, redo, proposals made and accepted, and repairs. After each sweep, every hash reachable from every root is still in the store and every evaluation of a root still builds; an unreachable hash is gone after its grace sweep.
- **Next**: build after the coordinator's reply.

## O131 — FRf2's sibling scope: decided-deferred (2026-10-22)

The owner, through the coordinator, verbatim: "둘다 제안한대로 해줘" (do both as proposed). The proposal: a placed part's frame following a sibling part's sketch stays the typed refusal `FRAME_PART_SCOPE`, with no change now to how the assembly is evaluated (describe, placedBodies and the mates' solve stay per part); it is built only when a real need appears. The other half of the same decision, the chat turn's merge, is O132.

## O132 — S0: a chat turn merged onto the document as it is now, conflicts re-proposed (2026-10-22)

The owner's decision through the coordinator ("둘다 제안한대로 해줘", option (a)): the README defect "Chat turn overwrites edits made during it" is fixed by re-applying the agent's operations onto the current document and re-proposing only the conflicting ones, with A7's machinery: a patch on a base revision, STALE_BASE, an explicit rebase. Today `ChatPanel.send` takes `base` at send (`src/ui/ChatPanel.tsx:106`), and the end of the turn commits the agent's whole document (`App.tsx` chat `onCommit` → `commit(next)`). `carryOver` keeps only the non-model fields, so a box added meanwhile is lost.

- **Capture: the turn's patch, recorded by the MCP server** (`server/cadMcp.ts`):
  - Every tool call that changed the part (`out.changed`, not an error) is appended as an op in the form proposals already store and replay: the handler's name and arguments after `viaV2`/`v1Call`.
  - Each op also records the serial range of the feature ids it handed out (`nextId` before → after).
  - The state file keeps `patch: { id, by, base: revisionOf(turnBase), ops, ids }` (A7's `Patch` plus the id ranges). The chat server passes it through in `done`, so an aborted turn's patch is the part made so far.
- **The fast path (unchanged behaviour)**: when the current document's revision is the patch's base, the agent's document is committed as today.
- **The slow path: STALE_BASE, then an explicit rebase.** It runs in the browser in `chat/merge.ts` (the model), as acceptProposal already does: `mergeTurn(base, current, patch, evaluate) → { doc, applied, deferred }`.
  - The ops replay one at a time on the current document through `dispatchTool`, with the gates the agent already passed at its autonomy.
  - The person's change set `U` is `treeDiff(base, current)` (nodes added, changed and deleted), plus the parameters and other revision fields that differ.
  - Before an op runs, its ids are remapped. The ids the agent's run handed out, from the base's `nextId`, are mapped to the ones the replay hands out on the current document. Whole `n<k>` id tokens in its arguments are rewritten, so a box the person added as `n4` meanwhile and the agent's own `n4` never collide.
  - An op that conflicts is not applied (the merge keeps the state before it) and goes to `deferred` with a typed reason. Every other op is applied in order.
- **What counts as a conflict** (per op, judged on its own before → after during the replay):
  - **TURN_SAME_NODE**: the op changes or deletes a node the person changed or deleted.
  - **TURN_NODE_GONE**: the op is refused on the current document (its error is kept), breaks a reference, or names a node the person deleted.
  - **TURN_PARAMETER_CHANGED**: the op's arguments, or the args of a node it touches, name a parameter the person changed or deleted, or the op writes one.
  - **TURN_FIELD_CHANGED**: the op writes a revision field (brief, requirements, material, process, references, interfaces…) the person also changed.
  - **TURN_NOT_REPLAYABLE**: `restore` and `restore_best` bring back a whole earlier state.
  - **TURN_BUILDS_ON_DEFERRED**: the op names an id a deferred op made.
  - **TURN_SHAPE_DIFFERS**: the replay hands out a different number of ids than the agent's run did.
- **What the person sees**:
  - The merged document is committed as one change: one undo step back over the agent's change, the person's edit kept.
  - The toast says "Chat turn merged with your edits: 7 of 9 changes applied, 2 wait as P3", with Undo.
  - The deferred ops become one open proposal on the merged document: base `modelHash(merged)`, its ops remapped to the ids its replay will hand out, and its plan listing each op's reason ("not applied: you changed n2's depth during the turn"; "n5 was deleted"). It also gets an optional additive field, `merge: { turn, conflicts: [{ op, code, reason }] }`.
  - The person previews, accepts, rejects or rebases it as any proposal. The design history's prompt entry says the turn was merged.
- **Edges**:
  - If the person edits again while the replay runs, it reruns against the newest document, at most twice, then defers the rest with the reason.
  - With a rollback marker, the merge compares the document's prefix the person sees, as `base` is now.
  - The previews during the turn still show the agent's states on the send-time base (unchanged).
- **Tests**:
  - The README repro: a long scripted turn with a box added meanwhile ends with both the box and the agent's change, and the ids don't clash.
  - A same-node edit, a used node deleted, and a parameter changed under the agent each give a proposal, never a silent overwrite, with the person's value kept.
  - A deferred op's dependants are deferred, and the proposal accepts cleanly on the merged document.
  - The fast path is identical to today.
  - In the studio, ⌘Z after the merge steps back once over the agent's change, and the person's edit stays.
  - Flow step: the real chat with a slow scripted turn (the scripted agent's delay) and an edit in between, placed before "command palette and light theme".
- **Touches**: `server/cadMcp.ts` and `server/chatServer.ts` (the patch), `src/chat/client.ts` (the done type), `src/ui/ChatPanel.tsx` (passes the patch and base), App.tsx's chat `onCommit` (the merge before `commit`, no joint, explode or section paths), and the model's new `chat/merge.ts` plus `Proposal.merge?`. FLOW_ONLY: chat/agent steps and proposal steps.
- **Shared with G12 (item 4)**: the person's change set and the per-op touched set use the same `treeDiff`/revision-field comparison that `proposalDiff`'s `changedFaces` pairing will name.
- **To check while building**: `rebaseProposal` replays a proposal's ops on a changed part. If those ops name ids they made themselves, the same id shift may hit stale proposals today. It will be confirmed by a probe, and fixed by the same remap if it does.

## O133 — item 0: a chat turn merged onto the edits made during it (2026-10-22)

The coordinator approved O132 with one addition: implicit dependants. An op whose meaning comes from a deferred op without naming an id (the selection, a newest-sketch default, a mode) must not be applied to another target. Built at e8e213a6e.

- **Capture made explicit** (`chat/merge.ts` `captureOp`). The coordinator offered two options; this takes the first, so ops are fully explicit at capture.
  - Each call that changed the part is recorded twice:
    - as the call itself, for a proposal to replay;
    - as what it did: the features added (each after the one it followed), changed and deleted, in *id form*, plus the parameters, body outputs, looks, other fields, proposals and history entries.
  - In id form, every index reference is the referenced feature's serial (`renumber`).
  - So an implicit target becomes the feature it picked. An extrude of "the newest unused sketch" reads that sketch's id, and a selector reads the face it resolved to.
  - Why not replay the calls on the current document, as the S0 said: node references are indices (`sketch: 2`, `BodyRef.node`), and commands pick implicit targets. A replay on a part the person changed would build on the wrong features (the coordinator's own case).
- **Merge** (`mergeTurn`, in the browser):
  - The person's change is captured the same way, from the base to now.
  - The turn's ids move past the person's by one offset (`n<k>`, `n<k>.top`, `b<k>` follow).
  - Each op is checked against the person's change and against the ops deferred so far, then applied in id form and converted back to indices once. The result is evaluated once; if it does not build, it is evaluated op by op and the failing ops are deferred (TURN_NODE_GONE, with the reason).
  - Codes: TURN_SAME_NODE, TURN_NODE_GONE, TURN_PARAMETER_CHANGED (a parameter the person changed, named in the op's features or written by it), TURN_FIELD_CHANGED, TURN_NOT_REPLAYABLE, TURN_BUILDS_ON_DEFERRED, TURN_SHAPE_DIFFERS.
  - TURN_BUILDS_ON_DEFERRED covers an op that uses, changes or writes what a deferred op made, changed or wrote. That includes implicit picks, which capture made explicit.
  - An eighth code, TURN_STILL_EDITING: after two reruns for edits made while merging, every op waits, unrun and with nothing awaited, so no edit can land in between.
- **The proposal**:
  - The deferred calls are moved to the merged part (`moveOps`) and worked out as any proposal: risk, checks, `orders`.
  - When they do not replay, the proposal is kept with high risk, and its summary says why.
  - Its plan lists each call's reason, and `merge: {turn, conflicts}` keeps the codes.
- **The studio**:
  - The tool server keeps `ops` in the state file. The chat server sends each op once, in `state` and `done`.
  - ChatPanel merges when `changedDuring(base, now)`: anything but the design history differs. Otherwise it commits as before (the fast path, unchanged).
  - App commits the merged document as one change, with a toast ("Chat turn merged with your edits: 1 of 1 change applied"; or "2 wait as P3 (why)") and Undo.
- **rebaseProposal** (the S0's "to check"):
  - The probe confirmed the bug. A proposal `[box, edit_feature {index: 3}]`, rebased after the person added a box, edited the person's box.
  - Proposals now keep `orders`, the feature ids before each op (`runOps`). A rebase moves each op by what its indices and self-made ids named (`chat/remap.ts`, `moveOps`), one op at a time.
  - Older proposals without `orders` rebase as before.
- **Tests**:
  - `test/chat-merge.test.ts`:
    - the README repro: ten calls, and a box the person added meanwhile (ids n2 and n3 taken). Both are kept, the agent's moved to n4–n6, and the volume is the sum;
    - SAME_NODE: the person's 12 kept; the proposal accepted gives 20; the independent box applied;
    - NODE_GONE: a hole on a box the person deleted;
    - PARAMETER_CHANGED;
    - the implicit context: op 0 deferred, op 1 extruding the newest sketch is BUILDS_ON_DEFERRED, and the person's own unused sketch is not extruded;
    - the fast path's test.
  - `test/rebase-moves-ops.test.ts`: the probe turned into a regression test.
  - The flow step "chat turn merged with an edit made during it…": a scripted turn pauses (a new `{"pause": ms}` call in the scripted agent) after raising the box to 20. Meanwhile the person adds a box at X 40. Both are kept, and one ⌘Z gives 16 again with the second box kept.
- **Limits**:
  - A batch's inner op naming, by index, a feature an earlier inner op made is moved as the outer op is, so it is exact only for appends.
  - A script's `node(i)` is not rewritten. The merge's applied path does not depend on either: it applies what the op did.

## O134 — the palette ranks a command's label before any keyword (2026-10-22)

The coordinator's request after 8788eafec: the kernel lane's Shaft command lists "fillet" among its keywords, so the palette's first result for "fillet" was Shaft and 21 fillet and chamfer flow steps failed. The palette filtered on label, keywords and id alike and sorted only by availability.

- `src/ui/paletteRank.ts` ranks each match: 0 the label is the text; 1 the label starts with it; 2 a word of the label starts with it; 3 the label holds it; 4 only the keywords or id hold it. Availability orders the commands within a rank, then the toolbar's order. A keyword can never beat a label, whatever is available.
- `test/palette-rank.test.ts`: every command's label typed gives it (or one of the same label) first, available or not. A command keyed "fillet chamfer" comes after every label match for "fillet" and "chamfer".

## O135 — PERF3 B13: mesh blobs evicted at idle points (2026-10-22)

The coordinator approved O130 with both choices as proposed, plus: an unlisted-holder test; an evicted-then-requested hash logged as an error; no sweep mid recovery write; and a DEV counter of the bytes freed. Built at 60441d33a and f29337d8b.

- **`evictBlobs(roots, pinned)`** (engine/blobs.ts) keeps:
  - every hash the roots name through `blobRefs`, which now also walks open proposals' ops for mesh nodes (P2's gap);
  - every pinned hash (`pinBlobs` → release);
  - every blob put since the last sweep (`fresh`, the grace generation), returned as `graced`.
- **Everything else is dropped**:
  - its bytes are counted in `blobStats` (sweeps, lastFreed, freed, lastDropped);
  - the hashes are remembered (capped at 4096): a later `getBlob` of one logs an error and records it in `blobStats.evictedAsked`, naming a missed holder.
- **Holds**: `holdSweeps()` makes a sweep return null. ChatPanel holds sweeps for a whole turn, merge included. `saveRecoveryBlobs` holds while it writes.
- **The studio**: the sweep runs 2 s after the last change to the document or undo/redo, never while a repair is asked. Its roots are the document, every undo and redo step, and the evaluated document. DEV: `window.__studioBlobs` (the stats, kept and graced).
- **The worker in lockstep**:
  - `WireSender` subscribes to `onBlobsEvicted`;
  - `forget(hashes)` removes them from `sentBlobs` and queues them;
  - the next `pack` carries `dropped`, which `WireReceiver.unpack` drops before it puts that message's blobs;
  - a blob put back is therefore sent again (P3's gap).
- **Tests** (`test/blob-evict.test.ts`):
  - grace, then the drop with its bytes;
  - four random sessions of 120 steps: mesh adds and deletes, undo, redo, proposals made and accepted, a pinned repair, sweeps. After every sweep, every hash any root names is present and every root's blobs resolve;
  - an unlisted holder: kept by grace and reported, then gone, with the error logged;
  - holds;
  - the wire in step: forgotten, `dropped` sent, and re-sent when put back.
  The S0's P2 now asserts the fix.
- **Flow step**: an STL is opened, then a new part. The idle sweeps run while the mesh document is an undo step; undo and redo build it, and no dropped blob is asked for. The bytes freed are printed for the record.
- **Not measured yet**: the effect on a 200k-triangle mesh session. The counter is there to read it.

## O136 — G12: `proposalDiff`, a proposal's added and removed material (2026-10-22)

The S0 (O129) was approved with two notes: `changedFaces` must be complete when the method is `faces`, shown by a facet-body test; and results are cached by (base revision, proposal id). Built in `src/chat/proposalDiff.ts`.

- **`proposalDiff(base, proposed)`**, where each side is `{doc, bodies}`, returns `{ added, removed, changedFaces, parts, method, why? }`:
  - **`added` and `removed`**: each side's B-reps are united, then `after − before` and `before − after` are taken with the kernel's analytic Boolean. Each result is a display mesh, tessellated at the bodies' quality 8, with its volume; null when nothing is there.
  - **`changedFaces`**: computed from both sides' display faces by persistent name, whichever method ran: added, removed, or changed. "Changed" means the area (9 significant digits), the centroid (1e-5 mm) or the exact surface (1e-9) differs.
  - **`parts`**: from `proposalParts`.
  - **`method: 'faces'`**: used when the Boolean refuses, with the kernel's message in `why`. Today that is any facet body ("faceted (mesh) faces are not supported yet"); added and removed are null then.
- **`proposalDiffFor(key, base, proposed)`**: a small LRU (8) keyed by `revision|proposal`. A proposal hovered twice runs its Booleans once; `diffWork.booleans` counts them.
- **Tests** (`test/proposal-diff.test.ts`):
  - the hole: removed 90π as a mesh; the n2 faces added; n1.top and n1.bottom changed;
  - the boss: added 200π;
  - the taller extrude: added 6000;
  - a facet cube moved 5 up: `faces` with why, and every mesh face listed as changed, the plate untouched. The test says it turns into `boolean` with 500/500 after F3;
  - the cache.
- **For the GPU lane**: draw `added` and `removed` like any body, in two colours. Under `faces`, tint `changedFaces` on the proposal's bodies.

## O137 — the inline dimension editor above the top bar (2026-10-22)

The coordinator flagged a regression from O127's z 6 top bar: `.dim-edit` (the sketch's inline dimension input, z 5) went under the bar when the edited dimension sat in the top 36 px of the window. Of the two options offered, it is raised to z 7, above the bar and below the palette's backdrop (10), rather than clamped below the bar: the input stays at its dimension. It is transient, and is gone before a menu of the bar can open. Flow, in "explicit constraints and dimensions…": the open editor is moved into the bar's band (top 8 px). The point at its middle is the editor, not the bar, and it then still takes its value.

## O138 — a key's width fit in the studio (2026-10-22)

The coordinator's queue after O137, the kernel lane's open studio item. Fit class took only cylindrical faces; a key's fit is on its width, between planar sides.

- **Fit class** now also takes a planar face, if it is a side of a key (`n4.side0`), of a shaft's keyseat (`n0.keyseat1`) or of a hub's keyway (`n3.keyway`): `keyFitRole` in engine/fits.ts. The class is stored like a cylinder's, in `doc.fits.faces`. Any other plane is refused, saying what is allowed. **Fit pair** stays cylinders only: a key pairs its own classes.
- **Evaluation** (engine/part.ts): a key node takes the classes on its own sides (a shaft's class), its keyseat's and its hub keyway's (holes' classes), via `keyClasses`. It gives them to D157's kernel `fit: {tables, key, seat?, hub?}`. The size is the key's width; the limits come from D155's `fitLimits` on the user's tables (none built in).
- **Notes**: the key's notes add "Width fit in the seat: N9/h9 at 6 mm — transition, −0.03 to +0.03 mm clearance (an estimate)", and the same for the hub's keyway; an estimate row is a warning.
- **Refusals**, typed FIT_FACE:
  - a hole's class on the key's side, or a shaft's class on a seat or keyway;
  - a seat or keyway classed while the key has no class;
  - a row missing (the kernel's lookup error).
  The kernel's KEY_FIT rule stands: with classes, the key is modelled at its seat's width.
- **Tests**: `test/key-fit.test.ts`, with the test's own estimate rows. N9/h9 gives −30 to +30 µm, JS9/h9 −15 to +45, both transition; plus the refusals and the plain-plane refusal. The flow step "key width fit (O138)…" loads the table in the Library panel, builds the shaft, hub, keyway and key through the real chat, classes the three sides through the chat, and reads both notes from the key's body.

## O139 — retaining-ring rows in the Library panel (2026-10-22)

The coordinator's queue, the kernel lane's open studio item. A studio ring was always an estimate: part.ts sent the kernel `row: { estimate: true }` whatever the ring.

- **The rows**: `doc.rings: { version: 1, rows }` (engine/rings.ts). Each row is `{ id, designation?, shaftDiameterMM, grooveDiameterMM, grooveWidthMM, source | estimate: true }`.
  - `ringRowProblem` refuses unknown fields, a size that is not above 0, a groove Ø not below the shaft's, and a row with neither or both of source and estimate.
  - `editRingRows` adds or replaces rows by id, removes them, and keeps a row a ring uses.
  - `ringRowsFor(doc, shaftØ, grooveØ)` finds the rows that fit a groove.
  - None is built in.
- **The ring**: a `retaining-ring` node takes `row?`. The Retaining ring command gains a Ring row choice: the person's rows, or None (an estimate). Its default is the row that fits the first groove's sizes.
- **Evaluation**: part.ts gives the kernel the row it names, in its part model's field names (shaftDiameter, grooveDiameter, grooveWidth). The first mapping used the …MM names, which the kernel ignores, so nothing was checked; the test found it. Its `ringSolid` checks the step's and the groove's sizes (RING_FIT). A row the document no longer holds is refused as [RING_ROW_UNKNOWN]. A ring with no row stays an estimate, said with a warning.
- **The notes**: a ring on a row cites it ("Its groove checked against your ring row (the maker's sheet)"), with no estimate warning.
- **The studio**: the Library panel's RINGS section loads a JSON file of rows (one or a list), lists them with their sizes and source, and removes them (refused, and said, for a used row).
- **Tests**: `test/ring-rows.test.ts`: the default offered and cited; no row, an estimate; refusals for a row for another groove (RING_FIT), a row gone, a used row removed, and bad rows. `fields.test.ts`' every-field document includes `rings`. The flow step "ring rows (O139)…" loads a row in the Library panel, makes the shaft and its ring on that row through the real chat, reads the citation, and has the row's removal refused.

## O140 — FRg: a 3D skeleton's values bound to parameters (2026-10-22)

The coordinator's queue item 4, the model side (G17's drag tool comes later), closing §0's "FRg's 3D skeleton constraints take numbers only".

- **Bound values**: a `length`'s or `distance`'s `value`, or an `angle`'s `degrees`, may be `{ parameter: name }` (`BoundConstraint3D` in frames/sketch3d.ts). The solver still takes numbers only; `boundConstraints` gives it each parameter's value now, with a map of which constraint is bound to which parameter.
- **Refusals**, naming the parameter:
  - a parameter the document lacks: [SKETCH3D_PARAMETER] "constraint 4 (length) is bound to the parameter "D", which the document does not have";
  - a bound value out of range: [SKETCH3D_INPUT] "constraint 3 (length, bound to W = -5): …";
  - a conflict: [SKETCH3D_CONFLICT], each unmet constraint with its binding ("…, bound to W = 800) off by …"), ending "Change the parameter W, or change or remove one of them". When none of the unmet constraints is bound, it names every parameter the skeleton binds, since one of them moved it there.
- **Re-solved when a parameter changes**: `resolveSkeletons(doc)` re-solves every skeleton with a bound value from its stored points. It returns the very same document when no point moved, so caches keep their keys, or the refusal with the skeleton's feature named.
  - The Parameters panel calls it before committing. A refusal is a toast ("That value does not hold"), and the parameters stay as they were.
  - Every evaluation entry (evaluateDoc, evaluatePart, evaluateVolumes) applies it too, so a parameter changed by any other path (a configuration applied, a sensitivity variant) builds the solved geometry.
  - add_features and edit_feature solve with the document's parameters.
- **Tests**: `test/sketch3d-params.test.ts`:
  - W and D bound: 600 × 400, A·600;
  - W set to 800: re-solved, the frame A·800; evaluated without the re-solve, the same; a second re-solve gives the same document;
  - the refusals: a conflict through a held diagonal naming W, a missing parameter, a bound length −5.
  The flow step "FRg bound to parameters (O140)…": W and D added in the Parameters panel, the skeleton and its frame via the real chat (444 · 600), W set to 800 in the panel (444 · 800), D set to −5 refused with D named and the parameters unchanged.

## O141 — item 5: the App's cost of a bracket click, on a production build (2026-10-22)

The coordinator's item 5, from the GPU lane's G13 profile: a bracket click cost 55 ms on the dev server, 36 of it React's jsxDEV, attributed to the App's panels being re-created on each selection change. The ask was to measure on a production build first, and memoise only if it still costs more than a few ms.

- **The bench**: `test/bench-panels.mjs`, opt-in, not a budget. It runs 120 placed brackets (the G9 scene) on the dev server and on a production build (vite build, served by vite preview). It reports the main thread's task time (CDP TaskDuration) for a bracket clicked from idle, the selection cleared (Escape) and 60 pointer moves, five runs each, as the median and every value. `PROFILE=1` gives a CPU profile of the session's first click (on an unminified production build) and `TRACE=1` a devtools.timeline trace of it.
- **Measured** (load 33–59 from other lanes; all times main-thread task time):

  | | dev server | production build |
  |---|---|---|
  | first click of the session | 77.7 ms | 100.5 ms (39–53 in other runs) |
  | each later click (after Escape) | 4.4–6.6 ms, median 5.8 | 4.1–5.7 ms, median 5.2 |
  | Escape | 0.4 ms | 0.4 ms |
  | hover | 1.91 ms a move | 1.80 ms a move |

- **What the first click is** (production, profiled and traced):
  - 52.8 ms of task, of which 11.7 ms is sampled JavaScript.
  - The trace splits it: style and layout 1.4 ms, paint 1.3 ms, GC 0.7 ms. The rest is first-run work: V8 compiling and running code the first selection takes for the first time (the reconciler's mount paths, the props panel's).
  - A later click mounts the same panel again in 3.5 ms of task, only 1.5 ms of it JavaScript (profiled).
- **Decision: no memoisation now.**
  - A later click costs about 5 ms on either build, and React's share of it is about 1.5 ms; memoising the panels could save at most about that.
  - The 55 ms G13 saw is its bench's one bracket click, the scene's first: a first-run cost that memoisation would not remove.
  - What would cut it is warming that code ahead of the click (e.g. mounting the props panel's tree once while idle). That is a separate question, for the coordinator to decide.
- **Not run**: a quiet-machine rerun (load 33–59 here).

## O142 — S0: R12c's machine elements on drawings and in the BOM (2026-10-22)

The coordinator's next item, for the outer side of the kernel lane's machine elements (D153–D159 so far: springs, shafts, keys, keyways, retaining rings, pins, bearings, O-ring glands; cams and the rest coming). This is the S0, for the coordinator's reply before building. Data rules hold: no built-in tables, no copied standards text. Every value comes from the user's rows or the kernel's report, and every estimate is flagged.

**What there is today** (survey):
- **BOM** (team/assembly.ts `bomView`/`deriveBom`/`checkBom`):
  - one line per placed part, merged by shape and material: `{item, parts, qty, material, massG, source}`;
  - the source is only a library part's `lib@version/part`;
  - the base part is not a line, and nothing reads a node's kind, size, row or estimate;
  - its consumers are the team's BOM agent's oracle, freshness and baselines. The studio shows no BOM, and no drawing has a BOM table.
- **Drawing tables** (drawing/tables.ts):
  - three sources: `bends`, `cut-list`, `weld-list`;
  - rendered as plain marks in SVG, PDF and DXF, placed clear of everything else;
  - a source's error drawn as NOT AVAILABLE;
  - checkboxes in the Drawing workspace.
- **Callouts**: holes (drawing/callout.ts) and D155 fits on diameter dimensions only. There are none for bearings, rings, keys, keyways, springs or glands.
- **The reports**: the kernel's snapshot carries each element's report (`spring`, `shaft`, `key`, `keyway`, `ring`, `pin`, `bearing`, `gland`, `oring`), but `BodyResult` keeps only their note text. Gears and racks are the exception. Drawing code cannot read the numbers today.
- **Side finding**: in `bodyOf` a body's later `notes:` spreads replace a library body's notes instead of adding to them. To fix in S1.

**Proposed scope**, three stages, each a checkpoint:
- **S1, the data**:
  - **`BodyResult.element`**: the kernel's report as plain data, `{ kind, report, row? }`. `row` is the user's row it used (bearing / ring / O-ring id, its source or estimate) or the fit table rows.
  - **`elementRows(doc, bodies)`**, one row per machine-element body:
    - `{ item (feature id and label), kind, size, row, source, estimate, why? }`;
    - `size` is our own short text from the report: spring Ø wire × Ø mean × free length, n active; key b × h × l; pin Ø d × L; ring groove Ø × width, s thick; bearing designation or row, d × D × B; gland ring, ID × CS;
    - `estimate` with `why`: a row marked estimate, no row (a ring), a modulus estimated (springs).
  - **BOM lines for bought elements**: bearing, retaining ring, key, pin, O-ring and spring become lines of their own beside the parts that hold them. Their qty is multiplied by the placed copies, and they merge by (kind, size, row). `BomLine` gains optional `kind`, `size`, `row` and `estimate`. Shafts, keyways and glands are made features, not lines. `deriveBom` and `checkBom` include them, so the BOM agent's oracle checks them too.
- **S2, the drawing tables**, three new `from` sources with Drawing workspace checkboxes, shown when the part has such elements:
  - `elements`: the element rows above;
  - `springs`: the data a spring drawing carries, one row a spring, from its report. Free length, wire Ø, mean Ø, outer Ø, active and total coils, pitch, solid height, ends, hand, rate (or "—" with no G given). The modulus's basis goes in the table's notes.
  - `glands`: one row a gland. The ring (row id / dash), ID × CS, groove Ø, width and depth, stretch, squeeze and fill %, and the ranges' source or estimate.
  Column titles are our own words. A table asked for a part with none of its kind is NOT AVAILABLE, with why.
- **S3, the callouts and dimensions**:
  - a bearing seat's diameter dimension (shaft step or housing bore) appends the bearing's designation or row and its source or "(est.)";
  - a ring groove's diameter dimension appends the groove width and the ring's row ("Ø19 × 1.3 · ring r20");
  - auto-dimension adds a keyseat's width b and depth t1 on the shaft's view, and a keyway's width and d + t2 on the hub's.
  These are text after the dimension (as D155's fits), not new leader marks.

**Oracles** (the kernel's conformance values where they exist):
- S1: the shaft-parts scene (default shaft, hub, keyway, key, ring on row r20, pin, bearing row, gland row):
  - element rows exactly: key "6 × 6 × 18"; ring on r20 citing its source, not an estimate; the same ring without a row an estimate; pin "Ø4 × 20"; the bearing's d × D × B from its row;
  - an assembly of 2 copies of a part with a key and a ring: part ×2, key ×2, ring ×2, merged;
  - an estimate row flagged in the BOM.
- S2:
  - the springs table's cells equal D153's conformance spring report (to its column digits), with the G-estimate note;
  - the glands table equals D159's S0 gland report;
  - each table's texts are in the SVG, PDF and DXF;
  - NOT AVAILABLE for a part without springs.
- S3:
  - the bearing seat's Ø20 dimension names the bearing's row;
  - the groove's Ø19 dimension reads "× 1.3" and the ring's row;
  - the key dimensions are 6 and 3.5 on the shaft and 6 and 22.8 (Ø20 + 2.8) on the hub, each as auto-dimension gives it.
- A flow step a stage, before the theme step.

**Questions for the coordinator**:
1. Bought elements as BOM lines of their own (proposed), and that list of kinds?
2. Callouts as text after the seat's or groove's dimension (proposed), or leader notes on the element?
3. Should the element rows and BOM cover the placed parts' elements in v1 (proposed: yes, multiplied by copies)?

## O143 — R12c on drawings and in the BOM, S1: the elements as data, and their BOM lines (2026-10-22)

The coordinator approved O142's S0 with three answers:
- Bought elements get their own BOM lines. The default kinds are bearing, retaining ring, key, dowel pin, O-ring and spring; gears, racks, worms and cams are made. A per-node `bought` override is added, and a line says when the override decided it.
- Callouts go after the dimension, with a leader only where an element has no dimension of its own (S3).
- Placed parts are covered, multiplied by their copies.

S1 is built.

- **`BodyResult.element`** (engine/elements.ts) is the kernel's report as plain data. It is kept stable for the GPU lane and later readers.
  - Shape: `{ kind, report, row? }`, where kind is spring, shaft, key, keyway, retaining-ring, pin, bearing, oring-gland or oring.
  - `row` is the user's row it was checked against: `{ id, source?, estimate }` for a bearing, a ring on a row, or a gland's ring.
  - A test structured-clones every kind's data, which is what the worker's post does.
- **The notes in one list**: `bodyOf` gathers every source's notes (a library's, a gear's and its mesh's, a spring's, a sheet's, a member's…) into one array. Before, a later `notes:` spread replaced an earlier one. That was latent: no built-in body has two sources, but a library part that is a spring or a gear would have lost its library line. The package suite is unchanged by it (729/729).
- **`bought`**: an override on any node (`NodeExtras.bought`, true or false; checkNode takes it; the every-field test carries it). Unset, `boughtOf` gives the default for the kind.
- **`elementLines(doc, bodies)`**: one line per element body, plus each node the person marked bought. The line is `{ item, label, kind, size, row, estimate, why, bought, boughtBy, massG }`.
  - `size` is our own short text from the report: "6 × 6 × 18", "Ø4 × 20", "Ø19 / Ø24 × 1.2", "compression, Ø… wire, Ø… mean × … free, … active", "3 steps Ø20–Ø25 × 95".
  - `why` gives each estimate: a row marked an estimate, a ring with no row, G or E estimated, a gland's ranges.
- **The BOM** (team/assembly.ts):
  - `bomView` adds `elements`, the bought ones from the base part and each placed part.
  - `deriveBom` gives each its own line, merged by (kind, size, row), with `kind`, `size`, `row`, `estimate` and `override` (the person's override decided it). The line's `parts` are `part:feature`. `elementQty` counts them; their mass stays their parts' and is not added to the total.
  - `checkBom` checks each bought element: on one line once, the line's kind, size and row its own, an estimate said, and the count. The BOM agent's oracle covers them.
- **Tests** (`test/elements.test.ts`):
  - the shaft-parts scene's lines exactly, with its default-bought list;
  - a ring on r20 citing its source, and without a row an estimate;
  - a spring's G estimate said;
  - the library notes kept in order;
  - 2 copies of the part: the part ×2, key ×2 (`i0:n4`, `i1:n4`), ring ×2 on r20, pin ×2, checked; a line left off found;
  - the overrides: the key made (no line), the shaft bought (a line, `override`);
  - a ring with no row gives an estimate line.
- **No flow step for S1**: the studio shows no BOM yet, and S2's element table is where the lines become visible. The browser side is covered by the verify's machine-element and library steps, which carry the new field over the worker's wire.

## O144 — R12c on drawings and in the BOM, S2: the element, spring and gland tables (2026-10-22)

S2 of O142, built on S1's data (`BodyResult.element`, `elementLines`). There are three new table sources (drawing/elementTables.ts) in `TABLE_SOURCES`. Column titles are our own words; every value is the model's (the user's rows, the kernel's report).

- **`elements`** (MACHINE ELEMENTS): item, kind, size [mm], row, source, bought (made / bought, "(set)" when the person's override decided it), est., mass [g]. Under it, each estimate's why, and "Sizes and rows are yours (none built in)…".
- **`springs`** (SPRING DATA): one row a spring, with type, wire Ø, mean Ø, outer Ø, active and total coils, free (or body) length, pitch, solid height, ends or hooks, hand, and rate (— with no G). Under it, each spring's G and E with "an estimate" where flagged, and a torsion spring's rate in N·mm/°.
- **`glands`** (O-RING GLANDS): kind, ring, the ring's ID and section, groove Ø, width and depth, stretch, squeeze (free and stretched) and fill (of the stretched section, as it is judged). Under it, the ranges judged by with their source and "(an estimate)", an estimate row, and each warning.
- A part without the kind: the source's error, drawn NOT AVAILABLE with why.
- **The studio**: the Drawing workspace offers Element list, Spring data and Gland table checkboxes, each only when the part has that kind (the element list also when a node is marked bought).
- **Tests** (`test/element-tables.test.ts`):
  - the shaft-parts scene's element list exactly, and a spring's estimate marked and said;
  - the default spring's data equal to D153's figures: wire 2, mean 20, outer 22, 6 active of 8, free length 34.00, pitch 5, solid 16.01, closed-ground, right hand, rate Gd⁴/(8D³n) = 3.304;
  - the piston gland equal to D159's S0: 214, 24.99 × 3.53, groove Ø25.5 × 4.7 × 2.8, stretch 2.0, squeeze 20.7 (20.0 stretched), fill 73.1 % stretched, Fictiv's ranges an estimate, the fill warning;
  - NOT AVAILABLE for each on a box;
  - the tables' texts in the SVG, the PDF and the DXF.
  `drawing-table.test`'s list of sources is updated.
- **Flow step** "element tables (O144)…": a spring from the palette, its A3 drawing with both tables by their checkboxes, no gland table offered, the SVG holding them and the estimate line.

## O145 — R12c on drawings and in the BOM, S3a: the elements on their dimensions, and leader notes (2026-10-22)

The first part of O142's S3, as the coordinator answered: text after the dimension (as D155's fits), and a leader note only where an element has no dimension of its own.

- **Callouts** (drawing/elementCallouts.ts `withElements`), built from the part's elements:
  - the studio passes its evaluated bodies' (`elementsOfBodies`), since none are evaluated on the page;
  - the chat's and the servers' drawings use `partElements(doc)`, the kernel's snapshot.
  They wrap the hole and fit callouts in both places, DrawingWorkspace and chat/drawing.ts. What they add:
  - **a bearing**: a diameter dimension on its seat (the shaft's `seat<step>` face, at the bearing's bore) or on its housing's bore (a face of the housing node, at its outside diameter) adds "bearing 6204 (B1 (D139))". That is its designation or row, with the row's source or "(est.)".
  - **a retaining ring**: a diameter on its groove's bottom (`groove<g>`, at the groove's Ø) adds "× 1.3 · ring r20 (the maker's sheet)", the groove's width being the ring's thickness plus its play. Without a row it reads "· ring (est.)".
  - Another diameter on the same face adds nothing.
- **Leader notes** (`elementNotes`, `withElementNotes`): a key and a dowel pin have no dimension of their own.
  - Auto layout (the studio's Auto-dimension, and the chat's `drawing.auto_dimension`) gives each a note `el-<feature>`, worded as the element list's ("key 6 × 6 × 18", "dowel pin Ø4 × 20").
  - Its leader runs to the middle of a visible edge of its faces in the first view (front, top, right) that shows one; the note goes just outside that view's nearest side.
  - The issue list's moves clear one that overlaps. Each pass makes them again, keeping the person's own notes.
  - `SheetInputs.elements` carries the elements to Auto layout.
- **Tests** (`test/element-callouts.test.ts`):
  - the bearing's seat Ø20 and housing Ø47 callouts, and after a fit's text;
  - the ring groove's with and without a row, and on a hand-placed diameter dimension on the sheet;
  - Auto layout's two notes with their leaders, no issue about them, and made again without doubling.
  - The flow step "element notes (O145)…": a shaft and its key from the palette, then Auto-dimension on A3. The key's note is there with its leader, there is no text overlap, and it is in the SVG.
- **Still to do (S3b)**: the key and keyway dimensions in auto-dimension, i.e. the keyseat's width b and d − t1 on the shaft, and the keyway's width and d + t2 on the hub. They need references the auto-dimension does not make today: the far silhouette of the shaft and the far side of the bore, not edge ends. That is the next checkpoint.

## O146 — R12c on drawings and in the BOM, S3b: keyseats and keyways dimensioned (2026-10-22)

The rest of O142's S3. Auto-dimension (drawing/auto.ts `keyPlans`, given `SheetInputs.elements`) adds four dimensions:
- for each shaft keyseat: its width **b**, and **d − t1**, from the step's far side to the seat's floor;
- for each hub keyway: its width, and **d + t2**, from the bore's far side to the keyway's floor.

- **How it finds them**: each is a pair of edge ends found by their faces' names, exactly the report's distance apart along a view axis. The width's two ends also sit level across it.
  - keyseat: `<shaft>.keyseat<j>`; the floor is an edge between two of the seat's own faces; the far side is the step's silhouette `<shaft>.seat<k>~sil`;
  - keyway: `<keyway>.keyway`, against the bore's face, whose circle has an end at its far side.
  - The view chosen is the one where both ends lie on visible edges, else the first that has them (dashed: the keyseat is seen through the shaft in the front and side views). One not found is skipped, with why.
- **Counting**: they are counted in `report.keys`, apart from `added`, whose exact shape R14's conformance cases pin. The studio's message adds them in.
- **Tests**:
  - in `test/element-callouts.test.ts`, the shaft-parts scene's Auto layout gives 4 key dimensions, with values 6 (b), 16.5 (20 − 3.5), 6 (the keyway) and 22.8 (20 + 2.8), and no error issue on them;
  - R14's auto-dimension and layout conformance is unchanged;
  - the O145 flow step now also checks b 6 and d − t1 16.5 on the sheet.
- **R12c on drawings and in the BOM is done** (S1–S3b, O143–O146).

### O146 addendum — dimensions on hidden lines said, not hidden (2026-10-22)

The coordinator's drawing-practice point: avoid dimensioning to hidden lines.
- **The view**: `keyPlans` already takes the view where both ends are visible; a seat facing a view shows there (the default shaft's keyseat, in the right view: b on visible lines).
- **Hidden in every view** (a keyseat under its hub; d − t1, which only edge-on views show): the dimension is kept, and the issue list warns `DIM_ON_HIDDEN`. "Dimension … measures to a hidden line in the front view: a section through it would show it (none is added for it)."
  - It covers any linear dimension, the person's too.
  - A point is hidden only when no visible edge of the view ends there: a corner that a hidden edge also ends at is a seen point. With that rule, R14's conformance raises none (79/79 drawing tests).
- **No section is added.** A section through the seat is R14's view logic, an open item (§0).
- **Test**: the shaft-parts scene under its hub warns d − t1 (16.5) on a hidden line, and not the hub's keyway width, which the top view shows.

### O143 addendum — D160's cam and D161's drives in the element data (2026-10-22)

The coordinator's note with integration cadfe4700, merged here as 26b88406b. The kernel's cam and drive notes were already folded into the one notes list, after the spring's.
- **`BodyElement`** gains `cam`, `sprocket`, `pulley`, `belt` (a belt or a chain) and `coupling`, each with its row: a sprocket's chain, a pulley's belt, a belt's row, a coupling's row, each with its source or estimate.
- **Bought by default**: belts and chains are bought. A coupling is bought as its kernel report's `bought` says (from its row). Cams, sprockets and pulleys are made.
- A coupling's part number and supplier are carried as the line's `catalogue`, into the BOM line and the element list's source cell.
- **Sizes**, our words from the reports:
  - cam: "translating roller, base R20, stroke 8 mm";
  - sprocket: "17 teeth, p 12.7, Ø… pitch";
  - pulley: "flat, Ø80 pitch × 50";
  - belt: "flat-belt, L … at 150";
  - coupling: "Ø12 / Ø14 bores, Ø30 × 40".
  Why an estimate: a cam's pressure-angle limit, a belt's band section.
- **Test**: two pulleys, their belt, a coupling and a cam (the kernel lane's test rows):
  - lines with pulleys made, belt bought, coupling bought, cam made;
  - the coupling's catalogue "TEST-1, a test supplier";
  - the BOM's belt and coupling lines;
  - every element's data structured-cloned.

### O143 addendum 2 — D162's connectors in the element data (2026-10-22)

With integration 36bfcb970 (merged here as 3f30f8dc1; D162's two UI edits, a section-table read in FrameSections and ConnectorRows in the Library panel, fight nothing in flight).
- **`BodyElement`** gains `connector-opening` (the kernel's ConnectorReport, its row cited) and `connector-body` (its row, with source and estimate from `doc.connectors`).
- **Bought by default**: the body is bought; the opening, cut in the panel, is made.
- **Sizes**, in our words from the user's row. The row's name loses a trailing "opening", and the line says which part it is:
  - "USB-C receptacle opening, stadium 8.34 × 2.56 × 6.2 deep; its body 0.045 / 0.08 clear across" (the declared fit's gaps);
  - "USB-C receptacle envelope stadium 8.25 × 2.4 × 6.51".
- **Test**: D139's U1 row (the kernel lane's test row):
  - both lines exactly, with the row cited;
  - the BOM's connector-body line;
  - both elements' data structured-cloned.

## O147 — S0: the BOM made visible and usable (2026-10-22)

The coordinator approved this gap: S1's BOM data (O143) is shown to no one. Constraints: src/ui only; App.tsx call sites only; the viewport untouched. This S0 needs the coordinator's reply before building.

**B1 — the BOM panel, the bought toggle, the CSV.**
- **Panel** (`ui/BomPanel.tsx`, opened by a "BOM" tool in the top bar's tray):
  - It shows `deriveBom(bomView(doc, evaluate))`, its evaluations through the engine worker (`engine.part`, the 'agent' slot), never the page.
  - A part with no placed parts shows one line for the part itself and its bought elements; an assembly shows its parts' lines and the bought elements' lines.
  - Columns: item no., item, qty, kind, size, row or catalogue, source or "estimate" (with its why on hover), bought or made ("set" when overridden).
  - Totals under it: parts, bought elements, the mass (the parts' only, as S1).
- **The bought/made toggle**, one per element line:
  - It writes the `bought` override as one undoable edit: on the base part's node, or, for an element in placed parts, on that node in every instance document the line merges.
  - A "default" choice clears the override.
  - Undo restores all of it at once.
- **CSV** ("Export purchase list"), the panel's button and a chat-free download:
  - The bought lines only, as `item no., item, qty, kind, size, row, catalogue, source, estimate`.
  - A checkbox "with made parts" adds the part lines and the made elements.
  - Text cells are quoted; the numbers are the BOM's.
- **Oracles**:
  - S1's scene of 2 copies with a key, a ring and a pin: 4 lines (the part ×2, key ×2, ring ×2 on r20, pin ×2); the CSV has 3 rows (the bought ones), 4 with made parts.
  - The key toggled to made: its line leaves the BOM and the CSV; one ⌘Z brings it back.
  - A ring with no row: its line and CSV row read "estimate".
- **Flow step**: the panel on a two-copy assembly, the toggle and its undo, the CSV download's rows.

**B2 — the drawing's BOM table and balloons.**
- **`from: 'bom'`** (BILL OF MATERIALS): the same lines and item numbers as the panel.
  - The BOM is worked out by the caller (the studio: the panel's, through the worker; the chat: awaited before the sheet) and given to the table's context (`TableSourceContext.bom`). It is never evaluated on the page.
- **Balloons** (a Drawing workspace checkbox, `settings.balloons`):
  - One balloon a line on the assembly's iso view: a circle with the item number, and a leader to the middle of a visible edge of one instance of that item.
  - For a part line, an edge of `<instance>/…`; for a bought element, an edge of that element's faces in that instance (`<instance>/<node>.…`, or `<node>.…` in the base part).
  - Item numbers match the table's.
  - Placement seeks clearance as the weld symbols do (O119): knees out past the view's sides in steps, clear of the views, the title, the tables and the balloons before. A balloon with no clear place keeps its nearest place and raises an issue, `BALLOON_NOT_CLEAR`.
  - An item with no visible edge in the iso view gets no balloon, with an issue `BALLOON_NO_EDGE` (the table still lists it).
- **Oracles**:
  - The two-copy assembly: 4 table rows equal to the panel's lines, and 4 balloons numbered 1–4.
  - Each leader's tip on a visible iso edge of its item (by the edge's name), and no balloon issue on the A3 sheet.
  - The table's texts and the balloons' numbers in the SVG, the PDF and the DXF.
- **Flow step**: Auto layout of the assembly with the BOM table and balloons, then the SVG.

**Not in scope**: a BOM for a placed part's own sub-assembly (one level, as S1), costs, or suppliers' quantities.

## O148 — S0: section views for what the standard views hide (2026-10-22)

The coordinator approved this as the next gap, after O147. Today there is one section, A–A, square to the front view's depth at `y` and placed under the front view, with no dimension on it. O146 warns DIM_ON_HIDDEN where only hidden lines would carry a dimension. This S0 needs the coordinator's reply before building.

**X1 — sections as a list, on any principal plane.**
- **`settings.sections`**: `[{ id: 'A', view: 'front' | 'top' | 'right', at }]`.
  - Each is the part cut by the plane square to that view's depth at `at`, seen as that view, with the material in front taken away.
  - Its cut rings are hatched, as A–A's are. The engine worker's `sectionOf` takes the view and `at`.
  - The old `section: { y }` reads as `[{ id: 'A', view: 'front', at: y }]`, so files and R14's section conformance stay as they are.
- **Layout**: each section goes beside its view, on the side away from its neighbour: a front's below it as today, a top's to its side, a right's below it. It carries "SECTION A–A" under it, and a cutting-plane line with arrows and letters across its parent view. The layout's fit and Auto layout's scale count them all.
- **Exports**: SVG, PDF and DXF draw them all. "Section alone as a 1:1 DXF" takes the one chosen.
- **Oracles**:
  - A–A unchanged (R14's section conformance);
  - a second section B–B square to the top view through a shaft: its ring the step's circle (πr² hatched), its letters on the top view;
  - the layout clean on A3.

**X2 — dimensions on sections.**
- `DrawingDimension.view` may name a section (`section:A`). Its snap points and edges come from the section's projection, and its marks are placed and checked like a view's.
- Auto-dimension's key pass (O146) looks in the sections as well as the views, and prefers visible ends. So a measurement a section shows moves there, and DIM_ON_HIDDEN no longer fires for it.
- **Oracle**: with a section through the keyseat, b 6 and d − t1 16.5 are placed on the section with visible ends, with no DIM_ON_HIDDEN; the hub's d + t2 22.8 is there too, where the section crosses the hub.

**X3 — the section a dimension needs, as a fix.**
- DIM_ON_HIDDEN gets a fix, `add-section`, applied like the issue list's other fixes (never on its own):
  - the plane square to the axis of the feature the dimension measures (a keyseat's or a keyway's: the shaft's or the bore's axis), through the feature's centre;
  - mapped to the principal plane it is (a shaft along Z gives a section square to the top view's depth, at the seat's middle);
  - the next free letter.
- A feature whose axis is no principal axis is said, with no fix.
- Auto layout does not add sections itself: the person, or the agent through the drawing tools as a proposal, applies the fix.
- **Oracles**:
  - the shaft-and-hub scene: DIM_ON_HIDDEN on d − t1 carries `add-section` at the keyseat's middle (z 15);
  - applied, auto-dimension moves b and d − t1 onto it, and the warnings are gone;
  - a tilted shaft gives no fix, said.

**Each stage gets a flow step and FLOW_ONLY on the section, R14 and DXF steps only.**

## O147 B1 — the BOM panel, the bought/made choice, the purchase list (2026-10-22)

The coordinator approved O147. B1 is built.

- **The model** (`team/bom.ts`):
  - `bomPanelData(doc, evaluate, name)` gives S1's BOM. A part with no placed parts is its own line. It also gives the **made** elements as lines, merged as the bought ones are, so that a person can mark one bought.
  - `setBought(doc, parts, true | false | null)` writes the override on every `part:feature` a line merges (every copy's node) as one document change. Null clears it, back to the default for its kind.
  - `purchaseCsv(data, withMade)` is the purchase list: item no., item, qty, kind, size, row, catalogue, source, estimate. It holds the bought lines: the bought elements, and the library parts as catalogue parts. "With made parts" adds the part lines and the made elements after them. Text cells are quoted where needed.
- **The panel** (`ui/BomPanel.tsx`; a BOM tool in the top bar's tray; App.tsx has only the tool and the panel's call):
  - lines numbered, with item, qty, row or catalogue, and source or "estimate" (its why on hover);
  - a bought / made / default choice on each element line. Its tooltip says it "applies to all N copies" where a line merges several, and the change is one Undo;
  - the made elements below, each with the same choice;
  - the totals: the parts, the bought elements, and the parts' mass;
  - "Export purchase list", with its "With made parts" tick.
  The panel's evaluations go through the engine worker (`engine.part`, the 'read' slot).
- **Tests** (`test/bom-panel.test.ts`):
  - S1's two-copy part: lines part ×2, key, ring on r20 and pin ×2; the shaft a made element ×2;
  - the CSV's 3 bought rows exactly, and the made rows with the tick;
  - a ring with no row gives an estimate row;
  - the key made: written on both copies, its line gone and a made element instead, out of the list; default clears both;
  - a single part as its own line.
  - Flow step "BOM panel (O147)…": a shaft and its key from the palette; the panel's lines and made elements; the key made and its line gone; one ⌘Z back; the CSV's header and the key's row.

## O147 B2 — the BOM on the drawing: its table and the item balloons (2026-10-22)

B2 is built as frozen. The BOM is worked out by the caller and passed in, so the drawing stays pure.

- **The BOM's synchronous core** (`team/bomCore.ts`, split from `team/assembly.ts`, which re-exports it):
  - `bomViewOf(doc, evaluate)`, `deriveBom(view)` and the Bom types;
  - `bomPanelDataOf` (team/bom.ts) builds the panel's data from evaluations given at once.
  - Why the split: chat/drawing.ts reading team/assembly.ts made an import cycle through chat/tools.ts (team/parts imports it). `DRAWING_CHANGES` was undefined when tools.ts's module body ran. bomCore imports nothing of the chat's tools; checked with an esbuild metafile.
- **The 'bom' table source** (`drawing/tables.ts`, from `TableSourceContext.bom`):
  - a row a BOM line: NO., ITEM, QTY, MATERIAL, ROW (with the catalogue), SOURCE ("estimate" where it is one), BOUGHT (made / bought / bought (set) / bought (library part)), MASS;
  - its numbers are the panel's and the purchase list's;
  - with no BOM given it says "the BOM was not worked out for this sheet" (TABLE_SOURCE).
- **Balloons** (`drawing/balloons.ts`; `settings.balloons`, off by default; role `balloon`):
  - one per BOM line on the iso view, or the front view when the iso is not shown.
  - Each leads to the middle of the longest visible piece of an edge of an instance of its item, found by name:
    - a placed part: `<inst>/…`;
    - an element: its node's faces `<node>.…`, in a placed part `<inst>/<node>.…`;
    - a part's balloon leaves out its bought elements' edges, so it points at its own made shape.
  - Placement is as the weld symbols' (O119): along the side nearest the tip in 9 mm steps, then the other sides. A clear place is inside the frame and clear of the views, the title block, the texts so far and the balloons before it. Balloons sorted by side and along it, so neighbours' leaders don't cross.
  - The glyph is our own: a circle with the number, and a thin leader to a filled arrow on the edge.
  - Built after the weld symbols and before the tables; an auto-placed table keeps clear of each balloon's circle (takenOf).
  - Issues (warnings):
    - `BALLOON_NOT_CLEAR`: no clear room, so the balloon sits at its nearest place;
    - `BALLOON_NO_EDGE`: a line none of whose items shows an edge in the view; the table holds it.
  - Balloon texts are checked as the weld symbols' are (TEXT_OVER_LINES, overlaps, OFF_SHEET), and balloon leaders count as lines for dimension texts.
- **Callers**:
  - The studio (DrawingWorkspace) works out the BOM through the engine worker (`bomPanelData`, 'read' slot), only when the BOM table or the balloons are on.
  - The chat's `drawingInputs` works it out synchronously (`bomPanelDataOf` with `evaluatePart(…, 'read')`), only then.
  - Checkboxes "BOM table" and "Balloons" appear for an assembly or a part with machine elements.
  - `__studioDrawing().balloons` gives the placed (no., item, view, edge), unclear and noEdge.
- **Tests** (`test/bom-balloons.test.ts`):
  - S1's two-copy assembly on A3: table rows 1–4 (shaft 0 ×2, key, ring, pin), made/bought.
  - Balloons 1–4 on the iso view: each tip exactly on a visible piece of its named edge, the part's on the shaft's own edges, the elements' on their nodes'.
  - Nothing clashes: the only issues are the four "missing dimensions" a bare sheet has.
  - Circles, numbers and arrows are in the SVG (4 `balloon` groups), the PDF and the DXF; off by default (no BOM worked out).
  - With the iso hidden, on the front view.
  - A line with no edge gives BALLOON_NO_EDGE; no room gives BALLOON_NOT_CLEAR (all four); a missing BOM gives the table error.
  - Flow step "BOM table and balloons (O147 B2)…": shaft and key on A3, both checkboxes; the table with no error; balloons 1–2 on the iso view, balloon 2 on the key's edge; no balloon or overlap issues; the SVG.
- **Left open** (recorded, not built): balloons avoid only tables placed after them; a table pinned by `at` is not in their way yet. Leaders may cross another balloon's leader when the sides fill.

## O148 X1 — sections as a list, on any principal plane (2026-10-22)

X1 is built as the S0 froze it, with one correction (below).

- **Settings** (`drawing/types.ts`):
  - `sections?: [{ id, view: 'front' | 'top' | 'right', at }]`, where `at` runs along the view's depth (as A–A's `y` always did: Y = y for the default front; a top's depth is −Z, so its `at` is −z).
  - `sectionsOf(settings)` reads the old `section: { y }` as `[{ A, front, y }]`.
  - `withSections` writes one A on the front back as `section`, so such files stay byte for byte as they were.
  - `readDrawing` keeps valid entries only: a letter A–Z (two at most), a principal view, a finite `at`, letters unique.
  - `nextSectionId` gives the next free letter.
- **Cutting** (`drawing/section.ts`):
  - `sectionOf(doc, at, orientation, view)` cuts square to any principal view's depth. It uses the kernel's split along x, y or z (`sectionDepth` in views.ts) and projects as that view.
  - `sectionsCut` cuts the whole list. The engine worker takes `options.sections`, and the drawing result carries `sections` (each with its result or error).
- **Layout** (`layoutSheet`; `SheetLayout.sections`, each placement with its letter and view):
  - A front's or a right's section goes in a row under the views, in its view's column and in projection with it. A–A is placed exactly as before. A later one moves along the row past the one before where they would meet.
  - A top's section goes beside the top view, on the side away from its neighbour (third angle: left; first angle: right), in its row.
  - The fit and Auto layout's scale count them all: the side column's width, the row's height, and the row's width when two or more share it.
- **Sheet**:
  - Each section is drawn (visible edges, hatch) with "SECTION X–X" under it. A front's or a right's is moved under its view's name, as A–A always was.
  - Its cutting plane goes in the first shown view that sees the plane edge-on: a front's in the top view, then the right; a top's in the front view, then the right; a right's in the front view, then the top. It is a chain line, thick at its ends, with arrows the way it is seen and its letter at each end.
  - The cutting planes are worked out before the views' names, so a name goes below its view's cutting-plane ends (a right section's vertical line on the front view no longer hits FRONT).
  - The cutting-plane group is pushed right after its section's drawing, as A–A's marks always were, so the DXF fixtures keep their entity order. They pass unchanged.
- **Correction to the S0**: the S0 said B–B's letters go "on the top view". A plane square to the top view's depth is parallel to that view and cannot show there as a line, so its cutting plane is drawn on the front view, where it is edge-on.
- **Elsewhere**:
  - Reorient (R14.3b) turns each section along its view's new depth (`turnSections`). A top's always stays. One cut across is refused (SECTION_ACROSS, naming it; A–A's message as before).
  - The issue list, the weld symbols, auto-dimension's room and the tables keep clear of every section's box.
  - The chat's drawingInputs cuts the list (`sheetSections`).
- **Studio** (DrawingWorkspace):
  - "Section A–A" and "Cut at Y" work as before.
  - "Add section" adds the next letter from B (A belongs to the front checkbox) on the top view (then the right), at the part's middle along that depth (`sectionMiddle`).
  - Each other section has a row: its view (select; a change re-centres it), its `at`, and Remove.
  - "Export section DXF" takes the section chosen (a select when there are two or more); the file is `…-section-X-X.dxf`.
  - `__studioDrawing()` gives `sections` (id, view, at, rings/edges or error) and `placedSections`; `section` stays A's for the older flow steps.
- **Tests** (`test/sections.test.ts`):
  - B–B square to the top view through a stepped shaft (Ø20 × 30, Ø30 × 40) at the Ø30 step's middle:
    - one ring, every vertex on the Ø30 circle, its area between its inscribed polygon's and πr²;
    - A–A under the front view, B–B left of the top view in its row (first angle: right of it); the sheet fits on A3;
    - its cutting plane at Z across the front view with B at both ends; hatched; no overlap, over-lines, off-sheet or fit issues;
    - in the SVG, PDF and DXF.
  - Files: old `section` → A on the front; two written as `sections`, back to one as `section`; invalid lists dropped; the next letter.
  - Reorient: a top section kept; a right section across x+ refused.
  - drawing.test and dxf.test read A–A's drawing group (`!view`); all R14 section and DXF fixtures pass unchanged.
  - Flow step "sections (O148 X1)…": a box on A3; Add section gives B–B on the top view, beside it, one cut face, clean, in the SVG; its view → right, still one; B–B alone as DXF with a hatch; removed.

## O148 X2 — dimensions on sections (2026-10-22)

X2 is built as frozen, with one oracle change (below).

- **Where a dimension sits**: `DrawingDimension.view` is a `DimView`: a view, or a section by its letter (`section:B`). `readDrawing` keeps both kinds (`isDimView`).
- **On the sheet** (buildSheet):
  - Dimensions on views are resolved as before.
  - One on a section is resolved after its section is placed (moved under its view's name), against the section's projection. It is drawn as a view's would be (boxed if basic, with its frames), and the section's name goes below its dimensions.
  - One on a section the sheet lacks is kept unresolved: DIMENSION_LOST, "in section B–B is lost: Its section (B–B) is not on the sheet."
  - `sheet.sections` carries each section's placement and projection.
  - `placementOf` and `projectionOf` find a view's or a section's; the issue list, its fixes, tolerance suggestions, the DXF's DIMENSION entities and the studio all use them.
- **Auto-dimension**:
  - The O146 key pass looks in the placed sections after the views and moves a measurement to a section only where the section shows more of its ends visible. The section's cut face (`section<k>.cut…`) is left out of an edge's faces, so an edge of the seat's floor and the cut counts as the seat's.
  - The sections take rows like a view's: room round their box, the same placing.
  - `autoDimensions`, `autoLayout`, the chat's drawing tools and the issue list's auto-dimension fix pass the sections.
- **Oracle change**: the S0 said the hub's d + t2 22.8 lands on the section too. Its keyway is seen whole from the top (both ends visible), so it stays on the top view. A section is taken only where it shows more, so measurements well shown in a standard view are not moved.
- **DUPLICATE**: the same span on features with nothing in common is not "given twice" — a hub keyway's 6 on the top view and its shaft keyseat's b 6 on the section. Features are read from the ends' face names, a placed part's prefix kept, the cut face left out. All earlier duplicate cases still fire, since they share a feature.
- **Reorient**: a drawing with dimensions on a section is refused, typed SECTION_DIMENSIONS ("… on a section (B–B): those are not turned yet. Remove them first …"). A section's view turns or mirrors with the front.
- **Studio**:
  - The dimension tools work on sections: hover picks a section's placed box too, snaps come from its projection, edges and circles from it, and placing and dragging use its placement.
  - Note leaders stay on views.
  - `__studioDrawingAt` takes `section:B`.
- **Tests** (`test/section-dimensions.test.ts`; the fixture `test/fixtures/shaft-hub-keyseat.bcad` is checked byte for byte against the scene and written with UPDATE_SECTION_FIXTURE=1):
  - O146's shaft and hub with B–B at Z 15: Auto layout adds the 4 key dimensions; b 6 and d − t1 16.5 land on section:B, every end on a visible edge of the section; 22.8 stays on the top view.
  - No DIM_ON_HIDDEN for them; no DUPLICATE; no errors on them.
  - Drawn there (groups on section:B), in the SVG and as DXF DIMENSIONs, and read back from the file.
  - Without the section: both lost, said; reorient refused.
  - Flow step "dimensions on sections (O148 X2)…": the file opened; Add section, B at −15; Auto-dimension; 6 and 16.5 on section:B, no DIM_ON_HIDDEN or DUPLICATE; the SVG; the dimension tool snaps at the shaft's centre on the section.
- **Open** (README): the section's edge names carry the split's index (`section<k>`), so a dimension on a section is re-matched if the part's bodies are reordered. Adjacent parts in one section are hatched alike.

## O148 X3 — the section a dimension needs, as a fix (2026-10-22)

X3 is built as the S0 froze it.

- **DIM_ON_HIDDEN's fix** (`sectionFor` in issues.ts) applies when the dimension measures a keyseat or a keyway:
  - **The axis**: a keyseat's is its shaft step's round edges (centre and normal, from the standard views); a keyway's comes from its report (`axisPoint`, `axis`).
  - **The middle**: half way between the ends of the feature's edges along that axis.
  - **The plane**: the principal plane the axis is along, the section view whose depth runs that way (a shaft along Z: square to the top view's depth), `at` signed along that depth (Z 15 → −15).
  - **The letter**: the next free one from B; A only for a front section while it is free (A is the front checkbox's).
  - **The message**: "section B–B, square to its axis (Z) through its middle (Z 15), would show it — the fix adds it."
  - **A section already there**: "section B–B through it shows it: Auto-dimension puts it there." The fix is Auto-dimension, not another section. That also keeps Fix all from adding letter after letter.
  - **An axis along none of X, Y and Z**: said, with no fix ("an aligned section is not drawn yet"; the open item).
  - **No keyseat or keyway**: the old text, no fix.
- **Applying** (`applyFix`, `add-section`) adds the section to the list, so the old `section` is written as `sections` when needed. It is applied like the other fixes: by the person's Fix (button "Add B–B"), Fix all, or the chat's fix tool as a proposal. Auto layout applies only moves, so it never adds a section on its own.
- **Studio**: the issue list and its fixes get the part's elements and the sections cut (`IssueContext.elements`, `sections`).
- **A tilted shaft**: after a rotate, the kernel's output carries no shaft report, so Auto-dimension finds no key dimensions there and no section is offered. A hand-placed one gets the old text. A keyway on a tilted bore keeps its report and gets the "no principal section" text. Both are covered.
- **Tests**:
  - `section-dimensions.test.ts`, X3 (2):
    - the shaft-and-hub scene auto-dimensioned: d − t1's DIM_ON_HIDDEN carries `{ add-section, B, top, −15 }` with its words;
    - applied: the section in the settings; drawn again and auto-dimensioned, no DIM_ON_HIDDEN, and 6 and 16.5 on section:B;
    - the section there but the dimensions still on the views: every fix is Auto-dimension;
    - a keyway on a bore rotated 30° about X: the "no principal section" text, no fix.
  - `element-callouts.test.ts`: O146's message assertion now reads the fix text.
  - Flow step "the section a dimension needs (O148 X3)…": the file auto-dimensioned; the Fix button on 16.5 reads "Add B–B"; clicked, the sections are `[B, top, −15]`; Auto-dimension again; dimensions on section:B, no DIM_ON_HIDDEN.

### O147 B1 correction — the BOM tool off the top bar (2026-10-22)

The coordinator's window flow on f7d526c80 bisected a regression to the B1 merge (f1726b560). O90's shapes-strip step (242) failed at 1100 px: the bar was 1.375 px too wide and the strip showed no shapes. B1 had put a BOM tool in the top bar's tray. ToolsTray counts each tool as 30 px and keeps every tool before the shapes, so one more tool took the strip's room, and the estimate's slack ran out.
- The fix: the BOM is an inspect tool on the left toolbar, after Interference and Measure, with its own generated icon (`cad-bom`: a sheet, its lines, the item marks in the accent). The top bar is as before B1.
- The BOM panel's flow step clicks it there.
- From now on, a top-bar change runs O90's shapes-strip step and O127's narrow-window step, the two layout guards (the coordinator).

### Flow step 39's recovery prompt (the coordinator's flake, 2026-10-22)

The coordinator saw step 39 ("draw a plate…") fail twice in full window flows on `locator.fill` timeouts, with "Unsaved work from … 'Untitled' was not saved" open at the bottom left. Steps 38–46 pass together.
- **What blocks step 39 is not the prompt.** It is a `.toast` dialog with no modal layer and no focus taken, and the studio's keys do not check for it. But the studio offers recovery only when it starts: `useState(() => readRecovery())`, with no error boundary and no remount. So the prompt in step 39's screenshot means the page loaded again during the run.
- **Why the page loads again.** The flow never reloads before step 39 (its only reloads are later recovery steps). vite.config has no React plugin, so any change to a file the dev server serves (src, or a package's dist that `build:library` writes) is a full page reload. A fresh Vite cache was tried with the Drawing workspace and the BOM opened, and there was no reload from dependency optimizing. The likeliest cause: files changed under that dev server during the run (a merge or a library build in the worktree the window flow serves).
- **Flow side**: the flow now counts main-frame loads it did not ask for (its own `page.reload()` calls say `expectLoad()` first) and watches the dev server's files. A failing step's line then ends with "[the page reloaded during this step, not by the flow: <files> changed]", and the run ends with a note of both. The next such failure names its cause.
- **App side: a real bug, though not the flake's cause.** While the prompt was open, the session's own recovery copies wrote over the copy offered (one key), and Discard removed the key, so it deleted the copy of the work done since. It also swept every recovery blob (`collectRecoveryBlobs(null)`), so the work since lost its mesh arrays.
  - Now the copy offered is set aside under its own key (`offerRecovery`), and the session writes its own beside it. Restore and Discard settle only the offered one (`settleRecovery`).
  - Discard keeps the current work's blobs; Save keeps a still-offered copy's.
  - At start, of the last session's copy and one offered before and never answered, the newer is offered.
  - Tested in recovery.test.ts.
- **The kernel's suggestion (Keepout.fills)**, declined for now: the connector's keep-out lives only in the kernel's report, and none of it becomes a document keep-out that `checkKeepouts` reads. D163's fix (the keep-out from the plug's front) is where the "violated (±0.0058)" came from and went.
- **SECTION_DIMENSIONS** now says what to do: "Remove the section's dimensions, or turn the drawing and add them again after." Carrying them through a reorient is queued (item 3).

## Queue 1 — adjacent parts hatched apart in one section (2026-10-22)

The coordinator's queue after O148, item 1: vary the hatch by part, as the GPU lane's G19.3 is to in the viewport (45°, 135°, 30°, 120°… by body).
- **Which body each cut ring is**: `sectionOf` carries `ringBodies`, the part's output index of each ring's body. A body has the same hatch in every section of the part.
- **The angles**: `hatchGroups` groups a section's rings by body. Body k is hatched at `HATCH_ANGLES[k mod 6]` = 45°, 135°, 30°, 120°, 60°, 150°, and past six with the spacing widened 40 % a round. A part of one body is hatched at 45°, 2.5 mm, exactly as before, so the DXF fixtures are unchanged.
- **Drawing it**: `hatch(rings, spacing, angle)` scans at any angle, and at 45° keeps √½ both ways so its lines stay the same to the last digit. The sheet draws a hatch mark per body, the SVG and PDF draw their lines at the mark's angle, the sheet's DXF HATCH takes it (as before, `−angle` with y up), and the section-alone DXF writes a HATCH per body.
- **Test** (section-dimensions.test.ts): the shaft, key and hub through B–B are three bodies with three angles (their HATCH_ANGLES). Every hatch line runs at its group's angle. The SVG and PDF draw them all, the sheet's DXF has the HATCHes, and the section-alone DXF has one per body at the same angles.

## Queue 2 — balloons clear of a table pinned by `at` (2026-10-22)

Balloons are placed before the tables, so a table pinned by `at` was not yet in their way. Now the pinned tables' boxes (laid out from their content and corner, as `tableGroups` lays them) are added to what a balloon keeps clear of. Auto-placed tables still go after and keep clear of the balloons.
- Test (bom-balloons.test.ts): the BOM table pinned over where balloon 1 stood. Every balloon ends up off the table, none is unclear, and no issue names a balloon. The pinned table meeting the iso view's name is the person's placing, and the issue list says so as ever.

## Queue 3 — section dimensions carried through a reorient (2026-10-22)

SECTION_DIMENSIONS is gone. A section is kept through a turn only where its view's new depth runs along the old (else SECTION_ACROSS, as before), so its view either turns within its own plane (a top section: the top view's up follows the front) or is seen from the other side (a front or right section, y− ↔ y+). Either way, R14.3b's map for that view (`viewMap`: a view point through the model to the new view's axes, horizontal and vertical swapped where the axes swap) is the map for the section's dimensions. They stay on their section. Their edge references are by name and 3D point and don't change; the value check skips them, since the sheet has no section projection to read them from before cutting.
- Test (section-dimensions.test.ts): the shaft and hub with B–B square to Z, auto-dimensioned, turned to a front from +X and from +Y. B–B is kept at −15. Drawn again (cut for the new side), its dimensions read the same values (6 and 16.5), with no DIMENSION_LOST. Adding a front section C still refuses the turn to +X (SECTION_ACROSS).

## Queue 4 — S0: the drawing's annotations as model-space anchors (the data side of the GPU lane's G24) (2026-10-22)

The coordinator's item 4: export the drawing's annotations, with world positions, leader targets by persistent name and their text, for the GPU lane to draw on the model with its SDF labels. This S0 needs the coordinator's and the GPU lane's reply before building.

**What is exported** (pure, in cad-model `drawing/annotations3d.ts`): `modelAnnotations(inputs, sheet) → { version: 'model-annotations-v1', items: ModelAnnotation[], left: { id, why }[] }`, from the same resolved sheet the drawing draws (so the 3D text is exactly the sheet's).

```ts
type Vec3 = [number, number, number];
/** A point on the model: where it is, and what it is on by persistent name (an instance's `<id>/` prefix kept). */
interface Target { at: Vec3; edge?: string; face?: string; centre?: true }
interface ModelAnnotation {
  id: string;                         // the dimension's, datum's, frame's, weld joint's (W-number) or note's id
  kind: 'dimension' | 'datum' | 'frame' | 'weld' | 'note';
  from: DimView;                      // the drawing view (or section:B) it was placed in
  /** The plane it lies in, as placed in its view: the view's toward (normal) and up, through `depth` along toward. */
  plane: { normal: Vec3; up: Vec3; right: Vec3; depth: number };
  /** Its text's anchor (the dimension line's middle, a leader's end), and its lines as drawn: value, tolerance, callout. */
  anchor: Vec3; text: string[]; align: 'start' | 'middle' | 'end';
  /** What it points at, in order (a linear dimension's two ends, a diameter's edge and centre, a leader's target). */
  targets: Target[];
  /** Its own lines in model mm (dimension and extension lines, the leader, the arrow tips), for a renderer that draws them. */
  lines: [Vec3, Vec3][]; arrows: { tip: Vec3; dir: Vec3 }[];
  /** By kind: the measure and its tolerance (fit code, ± or deviation, basic); the frame's characteristic, zone and datums;
   *  the datum's letter; the weld's kind, size (an estimate flagged), all round, inner. */
  dimension?: { measure: 'linear' | 'diameter' | 'radius' | 'pcd' | 'angle'; value: number; unit: 'mm' | 'deg'; tol?: Tolerance; basic?: true; count?: number; callout?: string };
  frame?: { characteristic: 'position'; zone: 'diameter'; value: number; datums: string[]; dim: string };
  datum?: { letter: string };
  weld?: { kind: 'fillet' | 'butt'; sizeMM: number | null; estimate: boolean; allRound: boolean; inner: boolean; joint: string };
}
```

- **Lifting a view's point into the model**: a point (u, v) placed in a view is `u·right + v·up + depth·toward`, with the view's own axes (orientation honoured). `depth` is its targets' mean depth along the view's toward, so a dimension stands in the plane through what it measures. A section's annotations use its cut plane's depth.
- **Targets**:
  - by the references the drawing already keeps: a linear dimension's `DimPoint`s (edge name, `end` or `center`, 3D `near`), a diameter's or radius's edge and its circle's centre, a pitch circle's member centres, a datum's edge, a weld symbol's seam edge, a note leader's view point lifted;
  - so they follow the model as its names do, the same rule as the sheet.
- **Text**: the sheet's own strings — `dimensionText` with its callout and count (`4× Ø6.6 THRU`, `Ø20 H7`), the tolerance lines as `toleranceText` gives them, the frame's cells (`⌖ | Ø0.1 | A | B`), the datum letter, the weld's size and W-number.
- **Left out, said in `left`**: a lost dimension (its reason); a note with no leader (it is placed on the paper, not on the model); tables and balloons (sheet-only for v1); a dimension in the isometric view.
- **Where it runs**: cad-model, pure. The studio computes it from the drawing's inputs when the viewport asks. The GPU lane's toggle, its prop and the drawing are theirs, so my side ends at the data and a test hook `__studioAnnotations()`. A chat read can follow later if wanted.
- **Oracles** (when built):
  - the starter plate auto-dimensioned: every dimension's targets are its references' 3D points exactly, its anchor projected back into its view equals its sheet place (1e-9), and its text equals the sheet's;
  - a fit callout `Ø8 H7` and a ± tolerance carry their strings;
  - a datum and a position frame on the geometric plate carry their letters and cells;
  - the welded table's symbols: their seam edges by name, size `3*` with the estimate flag;
  - after a parameter edit, the same ids and targets by the same names, moved.

**Questions for the GPU lane**:
- (a) Billboard text or planar in `plane`? Both are given.
- (b) Do they want our `lines`/`arrows`, or draw their own from `targets` and `anchor`?
- (c) Instance prefixes: targets keep `<inst>/`, as the edge names do — fine?

## Queue 5a — FRk1's gussets and end caps as plates, and their seams as welds (2026-10-22)

The kernel lane's FRk1 (D165) is in (integration 7f9c31f0b, merged here as b3ae7e0c9). The outer lane's side:
- **Elements** (`engine/elements.ts`):
  - `gusset` and `end-cap` are ElementReports (`o.gusset`, `o.endCap`), made by default.
  - Their size text: "plate 5 thick, legs 120 × 100, clipped 15"; "plate 4 thick, over, 1600 mm²".
- **BOM** (`team/bomCore.ts`):
  - `BomView.plates` holds each made plate: part, item, kind, thickness, area, volume, material and mass.
  - `deriveBom` lists them after the parts, merged by kind, thickness, area and material (two copies → ×2), as a `BomLine.plate` with its item ("gusset plate 5 mm") and size ("5 mm plate, 5887.5 mm²"). `plateQty` counts them.
  - `checkBom` checks each plate is on one plate line, with the line's sizes and the count.
  - A plate is not also a made element (the panel's list), and it is not bought. A person can set one bought in the panel (a plate ordered in, laser-cut), and it then becomes a bought element line.
  - The purchase list "with made parts" gives its kind and size. The BOM table shows it as made.
  - A plate line's balloon points at the plate's own edges.
- **Welds** (`frames/welds.ts`):
  - New joint kinds `gusset` (one a seam, on each of its two members) and `cap` (round its member's end).
  - The id is `<plate body>.<member body>`; `end` is the cap's end, or null for a gusset's seam. The face is the kernel's seam face, or the member's end face for a cap.
  - The seam length is the kernel's (exact).
  - The size, unset, is the thinner of the plate's thickness and the member's wall (an estimate, as O118's rule). The weld is a fillet by default.
  - The weld list table says GUSSET and END CAP.
  - FRk2's beads will map onto these ids.
- **Tests** (`test/frame-plates.test.ts`), on the mitred L with a 120 × 100 × 5 gusset clipped 15 and a 4 mm cap over member 1's start:
  - the element lines' sizes;
  - the plate lines 5887.5 mm² × 5 = 29437.5 mm³ and 1600 × 4 = 6400 mm³, checked by `checkBom`; not made elements;
  - the purchase CSV rows; two copies ×2 with their part ids;
  - the joints `<gusset>.<m0>` 105, `<gusset>.<m1>` 85 and `<cap>.<m0>` 160 at `start`, each a fillet sized 3 (estimate), exact; the mitre joint stays; the table's words.
- **For the coordinator**: integration's `test/weldment.test.ts` (the kernel lane's, b03719ada) fails the cad-model type-check: two calls of `fields?` possibly undefined (lines 23 and 42) and a sketch node cast (line 70). Not touched here.

## G24 data side — built (2026-10-22)

`drawing/annotations3d.ts` (`modelAnnotations`, version model-annotations-v1) is built as the S0 froze it, with the GPU lane's five additions:
1. Heads as heads (`tip`, `dir`, `length`, `width`, `style`), from the `head` the sheet's marks now carry.
2. A `role` on each line (dimension, extension, leader, frame, weld), set where the sheet builds its marks.
3. Text height in model mm and alignment along `dir`/`up` in the plane.
4. Frame cells and box, weld data, and the sheet's glyph builders in plane coordinates (`frameGlyph`, `weldGlyph`, `toPlane`).
5. Ids equal to the sheet items'.

The studio hook is `__studioAnnotations()`. Tests are in `test/annotations3d.test.ts`: the geometric plate and the welded table equal the sheet's to 1e-9, and the glyphs give the sheet's marks back. Only package T1 tests were run; the verify-worktree run and the checkpoint message are still to do.

## Queue 5b — weld records → the kernel's weld beads (FRk2, D166) (2026-10-22)

The kernel lane's FRk2 is in (integration 56e11f3ae, merged here as ba71497a6). The record → bead mapping is the outer lane's (`engine/part.ts`, after every node in `toPartDocument`):
- **Which records**: a record makes a bead when its kind is a fillet (set, or unset where a fillet is the default) and its size is set; its size is the leg. A record with no size makes no bead.
- **The mapping**:
  - `<member>.<end>` (a butt, an on-face end, a mitre set to fillet) → `{ kind: 'weld-bead', frame: <the frame's feature id>, on: { member: k, end }, leg, inner? }`. k is the body key's side `part<k>` (`solid`: 0); the body key resolves to its node by `bodyNodeOf`. An on-face end maps as its own end, and the kernel finds every face it lands on.
  - `<gusset>.<member>` → `on: { gusset }`; `<cap>.<member>` → `on: { cap }`. The kernel welds all of a plate's seams in one bead, so its joints share one feature (`bead_<plate key>`), the first record's leg.
  - The feature id is `bead_<joint id>` for a member's end. Its body is keyed the same, with no node: it weighs (it is in the part's bodies) and makes no BOM line.
- **Refusals never fail the part**: `withBeadRetry` runs each evaluation (the snapshot, part, volumes, preview, placed and base, STEP, drawing B-reps, sections, assembly faces). When the kernel throws a CadPartError on a bead feature, that bead is left out (remembered by what decides the kernel's answer: the bead, its frame and plate nodes, the parameters, the section library) and the part is built again. The reason goes to the joint.
- **Defaults**: a mitre's default weld stays a groove (butt). A cap's default is now a corner weld (butt), since the kernel says a cap sits flush. A record left with no kind on either is no bead, and the kernel's BEAD_KIND there is kept quiet; set to fillet, it is said.
- **The weld list**: each joint has `bead`, either `{ feature, legMM, throatMM, volumeMM3, seamMM, flushMM }` from its body's report (a `weld-bead` ElementReport), or `{ refused }`. The table's notes say "W<k>: no bead — <the kernel's reason>".
- **Tests** (`test/weld-beads.test.ts`, the kernel's frk/ scenes built from records, not features):
  - the 40 rail on the 80 post: 756 mm³ (and the case's own value);
  - on the 40 post: 360 (flush sides none);
  - the clipped gusset's two seam joints: one bead, 1710 = (105 + 85)·3²;
  - leg 3, throat 3/√2; no BOM line, its volume in the part's;
  - a mitre set to fillet: BEAD_KIND said on the joint and in the table, the part evaluated;
  - unset on the mitre: no bead, quiet, kind butt;
  - the 60° brace: BEAD_ANGLE said;
  - no size: no bead.
- `frame-plates.test.ts`: the cap's default kind is now butt.

## G22 data side — S0: the assembly's interference and clearance map (2026-10-22)

The coordinator approved the order: G22's data, then section edge names, then G23's data. This S0 needs the coordinator's and the GPU lane's reply before building. The style is G24's: pure, in cad-model (`team/clearanceMap.ts`), the exact values ours and the per-pixel field the GPU's.

**Measured, on the 120-copy prototype** (the starter plate with its top edges filleted R2: 272 triangles; 12 × 10 copies pitched so x-neighbours overlap 2 mm and y-neighbours sit 1 mm apart, every other turned 180° about Z; load 35–45):

| stage | time |
|---|---|
| placing the copies' meshes | 5.8 ms |
| a K2 tree (`triangleBvh`) a copy | 47.9 ms |
| pruning by boxes grown by the near band (sweep and prune along x, then y and z) | 2.7 ms → 416 candidate pairs of the 7140 |
| exact clearance on the candidates (`meshClearance` with the trees) | 44.2 ms → 110 crossing, 306 near, 0 clear |
| a per-vertex distance field for the amber band (`nearestDistance2` per vertex of each side, bounded by the band) | about 10 ms for 832 pair sides of a 92-vertex plate (scales with the vertices) |
| **the exact overlap Booleans** (`booleanAnalytic` intersection + its volume + its mesh), 110 pairs | **56.4 s (about 0.5 s a pair, curved fillets)** |

The K2 tree is a triangle hierarchy with ray and nearest-point queries, not a box-overlap one. Pairs are pruned by sorting the bodies' boxes, cheap at 120; the K2 trees serve the exact clearance and the distance field. Everything but the Booleans is about 0.1 s together. The Booleans are 500× that, so the S0 makes them progressive.

**Shape** (`clearanceMap(doc, evaluate, { nearMM })`; everything from the evaluated placed parts, body keys with `<inst>/` kept):
```ts
interface ClearanceMap {
  version: 'clearance-map-v1';
  near: { mm: number; source: 'requirement' | 'input' };   // a stated clearance requirement, else the input, said
  pairs: ClearancePair[];                                    // candidates only; every other pair is clear by its boxes
  pending: number;                                           // overlap Booleans not done yet (they come in later updates)
  timing: { pruneMS: number; clearanceMS: number; booleanMS: number };
}
interface ClearancePair {
  a: string; b: string;                                      // body keys
  state: 'overlap' | 'near' | 'clear';
  minGapMM: number;                                          // 0 where they cross (the exact least distance of the display meshes, to their chord)
  closest: { a: Vec3; b: Vec3; faceA: string; faceB: string };  // the closest points and their faces by persistent name
  /** The exact overlap: its volume and its display mesh (volume = the mesh's B-rep's), or pending, or why the Boolean refused. */
  overlap?: { volumeMM3: number; mesh: DisplayMesh } | { pending: true } | { refused: string };
  /** For the amber band: each side's vertices' distance to the other body, clamped at the band (Float32, the body's display-mesh vertex order). */
  field?: { a: Float32Array; b: Float32Array };
}
```
- **Scale**: pruning first, then exact clearance only on candidates, both always. The overlap Booleans run in the engine worker, nearest pairs first and cached by the two bodies' content and poses. The map comes out at once with `overlap: { pending }` and fills in over later updates. `pending` says how many are left; a moved part re-queues only its own pairs. The GPU lane colours a pending overlap from the clearance (crossing = red) until its exact body arrives.
- **Volume and mesh agree**: the overlap mesh is the tessellation of the very B-rep whose `volumeMM3` is given, as the coordinator asked.
- **Second stage, not now**: joint play and motion study first contact (`robot/sweep`'s meshesMeet along a motion).
- **Oracles (when built)**: two boxes overlapping by a known block (its volume exact, its mesh's volume equal); a gap of 1 mm (minGap 1, the closest faces by name, the field 1 at the facing vertices); the 120 copies (110 overlaps, 306 near, the timing in the result); a moved copy re-queues only its pairs.

**Questions for the GPU lane**:
- (a) A per-vertex field (Float32 per display vertex) for the band, or will they compute their own on the GPU from the meshes?
- (b) Overlap meshes as display meshes in world coordinates: fine?
- (c) Updates as the Booleans finish: replace the whole map, or a list of filled pairs?

## Item 4 — a section's edge names keyed by its body (2026-10-22)

`sectionOf` cut each body by a split with the id `section<k>`, where k was its output index. So the cut face `section<k>.cut.top`, its edges, and the dimensions on them (O148 X2) changed names whenever an earlier body came or went, and were re-matched or lost. The split is now `section_<body key>` (`section_b2`, `section_b0_part1`). `auto.ts`'s cut-face filter and `issues.ts`'s feature reading take both forms.

Test (section-dimensions.test.ts): the shaft and hub after an unrelated box (nodes 0–1), auto-dimensioned with B–B. The box is then suppressed, so every output shifts by one. B–B's dimensions still read 6 and 16.5, with no DIMENSION_LOST or REMATCHED. It failed before the change.

## G23 data side — S0: print layers, and the CNC preview as the GPU lane reads it (2026-10-22)

The coordinator's item 2 after G22. This S0 needs the coordinator's and the GPU lane's reply before building. Pure, in cad-model; display only (no slicer, no G-code: README §4).

**A. Print layers** (`print/layers.ts`, `printLayers(doc, bodies, { layerMM, direction?, limitDeg? })`):
- **The frame**: the chosen build direction (`direction`, else AM4's best orientation, said which). The part is turned so it is +Z, its lowest point on the bed (z 0). The turn and the offset are given, so the GPU lane maps layers back onto the model.
- **Layers** at heights `(k + ½)·layerMM` from the bed, `layerMM` the person's (unset: 0.2, an estimate, said).
- **Per layer**:
  - `contours`: the closed loops of the plane through the display meshes (every body to be printed; lattices as AM7 has them), each a polyline in bed coordinates, outer loops anticlockwise and holes clockwise (by signed area, the even-odd rule over all loops).
  - `overhang`: the overhanging triangles (AM2's rule, −n·b > sin θ, θ the process's limit) that the layer's band crosses, projected onto the layer as triangles, with their faces by persistent name.
  - `support`: the footprints of AM4's support columns spanning the layer — from each overhanging triangle straight down (K2 rays) to the part or the bed — as projected triangles, the same columns AM4's support volume sums.
- **Totals**: layer count, height, support volume (equal to AM4's for the same direction), and the chord error of the meshes the contours come from (said: contours are to the display mesh, not exact).
- **Cost**: one pass bucketing the triangles by their z-range, then a segment a crossing triangle per layer, stitched by the mesh's shared edges into loops. O(triangles + segments), no per-layer scan of the whole mesh. Measured when built (the oracle sets include a 100 000-triangle case, as AM4's).
- **Oracles**:
  - a 20 mm cube at 0.2 mm: 100 layers, each one square loop of 400 mm²;
  - a Ø10 bore through a plate: an outer loop and a clockwise hole of π·25 (to the chord);
  - a 45° overhang at a 45° limit is none, at 40° all of it;
  - AM4's support volume equal to the sum of the layers' support areas × layerMM (to the layer's discretisation, stated);
  - the turn back maps every contour point onto the mesh's surface (1e-9 of the plane).

**B. The CNC preview packaged** (`machining/camPackage.ts`, `camPackage(doc, bodies, { toolMM? })`): what CNC8's `camPreview` and CNC7b's `chooseStock` give, in one object in world coordinates for the GPU lane's material-removal preview.
- `banner` and `notForProduction: true` come first, as every CNC8 output does.
- `tool`: its diameter and basis (given or estimate); `stepoverMM`, `stepdownMM` and their basis.
- `stock`: CNC7b's choice (a block's min/max, or a bar's start, axis, length and diameter), or its refusal (STOCK_NONE_LOADED, STOCK_NONE_FITS) said.
- `passes`, in machining order:
  - a pocket's per-level tool-centre loops lifted into world space (the floor plane's origin + x·u + y·v − level·normal), each with its setup's direction (the tool's axis) and its level;
  - drill points with entry, axis, depth and diameter.
- `skipped`: CNC8's list (slots and steps open on a side, with why).
- The GPU lane sweeps the tool along `passes` through its height field or dexels, starting from `stock`. Uncut is what the stock keeps outside the part; overcut is where the swept tool enters the part, theirs to colour.
- **Oracles**: CNC8's 50 × 30 pocket (loops (44 − 4.8k) × (24 − 4.8k), levels 3, 6, 8) lifted to its plane exactly; a hole's drill point; the block stock 122 × 82 × 30 about O100's plate; no stock loaded, said.

**Questions for the GPU lane**:
- (a) Layers in bed coordinates plus the turn, or already in model coordinates?
- (b) Supports as projected triangles, or as merged polygons?
- (c) Is an all-layers-at-once array fine, or do they want one layer by index (for a slider on a large part)?

## G22 data side — built (2026-10-22)

`team/clearanceMap.ts` follows the S0 (eedfe15b2) with the GPU lane's three changes.
- **Bodies**: `assemblyPlacedBodies(doc, evaluate)` takes the base part's bodies and each shown placed part's in its own frame, with its pose (`world = m·local + t`, as `placedBodies` places it) and its B-rep. Keys keep the `<inst>/` prefix.
- **The map**: `clearanceMap(bodies, { nearMM })`.
  - Boxes grown by the band are sorted along x, then pruned on y and z.
  - `meshClearance` runs on each candidate pair through its K2 trees.
  - `closest` points are given in each body's own frame, with their faces by persistent name.
  - `pose` is the two bodies' content and pose hash. `revision` is the map's.
  - An overlap starts as `{ pending }`, or `{ refused }` when a body has no exact solid.
- **Bands** (`band: { a, b }`, each `{ positions, indices, field }` in its body's frame): a side's triangles that can be within the band are split while their edge is over near/3. The split stops where the field is affine over the triangle (edge middles and centroid within near/100 of the corners' interpolation). Each vertex carries the exact `nearestDistance2` to the other body, clamped at the band.
  - So flat faces facing each other stay a few big triangles, and a spot mid-face is refined down to near/3.
  - The first version split everything down to near/3: 5.9 M band triangles in 5.1 s on 120 boxes. Now it is 0.77 M in 2.0 s.
- **Overlaps**: `fillOverlap(map, bodies, pair)` intersects B moved into A's frame with A (the analytic Boolean). It gives the volume and the display mesh of that very B-rep, in body a's frame. `applyFill` applies a fill only while the pair's pose key is the one it was worked out for, and drops it otherwise. `pendingPairs` lists what is left.
- **Measured on 120 boxes** (30 × 20 × 8, x-neighbours overlapping 2 mm, y-neighbours 1 mm apart; load 15–20): pruning 7.6 ms, clearance 19.7 ms, bands 1.97 s, the 110 fills 0.37 s. Planar boxes make cheap Booleans; the S0's curved plates took about 0.5 s a pair. 416 pairs: 110 overlap, 306 near.
- **Not built yet** (the next step on the studio side, the GPU lane's to call): the engine worker's request, which sends the map at once and the fills nearest first, re-queuing a moved part's pairs. The near band is the input's (1 mm unset); requirements have no clearance field yet.
- **Tests** (`test/clearance-map.test.ts`):
  - an overlap of 5 × 20 × 10: pending, then filled with 1000 mm³; its mesh encloses the same volume; in a's frame x 15–20;
  - 1 mm apart: near; gap 1 between the facing faces by name; closest points local; the facing field 1; far apart, no pair;
  - **the band oracle**: a 2 mm cube 0.8 above the middle of a 60 × 40 box's top (a few big triangles) gives a band only around the spot, its least field within near/3 of the gap;
  - turned 90°: the fill still 1000 in a's frame; the closest points land together in the world; a moved part's new pose key drops the old fill;
  - 120 boxes: 110 overlaps pending, the timing given.

## G23 data side A — print layers, built (2026-10-22)

`print/layers.ts` follows the S0 (90e62fc7f) with the GPU lane's additions.
- **Calls**: `printLayers(meshes, { layerMM, direction, limitDeg })` returns a light summary plus `layer(k)`, worked out on first asking and kept. There is no batch call.
- **The turn**:
  - The direction goes to +Z, and the part's lowest point to z 0. `modelToBed` is that turn as a column-major 4×4 (model → bed); +Z stays the identity.
  - The direction is the caller's (AM4's best when it passes it); unset is +Z, said as 'default'.
  - `layerMM` unset is 0.2 and `limitDeg` unset is 45, both said as estimates.
- **Contours**: the vertices are welded by position, so faces' edges meet. Triangles go into 64-layer chunks by z-range. A layer's plane cuts its chunk's crossing triangles into segments, stitched along the welded edges they cross. Loops are wound outer anticlockwise and holes clockwise, by even–odd nesting. They are the display mesh's (said), not the exact surfaces'.
- **Supports**: AM4's own columns, from each overhanging triangle's centroid straight down (K2 ray) to the part or the bed. Their projected area times height sums to AM4's support volume for the same direction. `supportColumns` (footprint anticlockwise, z0 to z1) is given once, for the GPU lane to extrude and clip.
- **Per layer**:
  - `overhang` is AM2's rule on the triangles the layer's band crosses;
  - `support` is the columns spanning the layer.
  - Both are merged polygons: footprints are made anticlockwise and the edges used once are walked into loops (a connected patch is one region). Regions whose boxes meet are then united by the kernel's exact `booleanPolygons`. They take the contours' winding, as flat x, y at the layer's z.
- **Tests** (`test/print-layers.test.ts`):
  - a 20 mm cube at 0.2 mm: 100 layers, each one anticlockwise 400 mm² square; the identity 4×4; `layer(k)` kept, out of range refused;
  - the starter plate's Ø8: outer loop and clockwise hole, its area between the inscribed polygon's (its sides counted, the strips' diagonals' points on chords left out) and π·16;
  - the cube along (1, 0, 1): no overhang at a 45° limit, all at 40°, one merged region a layer; every contour point mapped back through the 4×4 lies on the model's mesh (1e-9);
  - a sphere along AM4's best direction: the support volume equals AM4's to 1e-9, and the columns' footprint × height sums to it.

## G23 data side B — the CNC preview as a tool-tip program, built (2026-10-22)

`machining/camPackage.ts` follows the S0 (90e62fc7f) with the GPU lane's additions, and is new CNC8 logic in machining/ with its own tests. It is NOT FOR PRODUCTION: the banner comes first and no G-code is written.
- **The tool**: a whole shape — flat, ball (corner D/2) or bull (corner given, else D/4) — with its flute length (3 D unset) and shank Ø (D unset), basis said. The diameter is CNC8's.
- **A setup**: one frame (world → machine, column-major 4×4; the setup's axes, the tool's axis machine +Z; −Z turned over) and a program of typed moves of the tool's tip in that frame.
  - A rapid runs only at the safe height: the stock's top along the axis + 5 mm, or the part's box's with no stock — an estimate, said.
  - A retract goes straight up to it.
  - A pocket, level by level, outermost loop in:
    - a plunge from the safe height through the air cleared so far;
    - then a ramp at 3° along the level's first loop where it is long enough for the step down, else a plunge (the rule and angle stated as estimates);
    - a feed back to the loop's start and round it;
    - the inner loops reached by a feed at depth, inside the pocket;
    - a retract before the next level.
  - A hole is a plunge from the safe height to its bottom and a retract.
  - `passes` names each pocket loop's (level, loop) and each hole's move range.
- **Stock**: CNC7b's choice as a solid (a box's min/max, a bar's cylinder), or its refusal (STOCK_NONE_LOADED, STOCK_NONE_FITS) as given. The uncut/overcut target is the part's own mesh, which the GPU lane has.
- **Tests** (`test/cam-package.test.ts`):
  - CNC8's 50 × 30 pocket 8 deep, Ø6: the banner first; the tool flat 6/0/18/6, estimates; one +Z setup with the identity frame; safe = the block stock's top + 5.
  - **The linking oracle**: every rapid at the safe height; retracts straight up; the program continuous; it ends at the safe height. Feeds at z 17, 14, 12; passes (3, 0…4) then (6, 0)…; no stock gives the refusal and the rule still holds.
  - **The swept-volume oracle**: the feed and ramp moves' swept area a level (0.05 mm raster), times its thickness, is 12000 mm³ less at most the four corners a flat Ø6 tool cannot reach, 4(1 − π/4)R² a mm of depth, within the raster's bound.
  - CNC8's holes (Ø6.6 through, Ø5 blind 10): +Z and −Z setups; each a plunge to its bottom (z 0 and z 10 from +Z) and a retract to the safe height; −Z's axis (0, 0, −1).

### G22 addendum — bands on demand (2026-10-22)

The coordinator: bands at 1.97 s for 120 boxes must not hold up the first map. Now:
- `clearanceMap` gives pairs, closest points, states and pose keys at once: 19.8 ms for the 120 boxes' 416 pairs, the K2 trees included.
- Bands come only on asking: `bandFor(map, bodies, pair)`, about 26 ms for one near pair of boxes, cached on the pair, and null for a stale pose. Each body's K2 trees and hash are prepared once per body object and reused. `bandPending(map)` lists the pairs still without one, nearest first. `bands: true` still gives them all at once.
- Overlaps stream after them as before (`fillOverlap`, `applyFill`).
- **The worker request** (the map first, then the bands nearest first for what is on screen, then the overlaps) **is the GPU lane's, at G22**, calling these.

## A9 — S0: brief to buyable, manufacturable product (2026-10-22)

The coordinator's end-to-end acceptance. One scripted agent run, through the real v2 chat tools (`dispatchTool`, no live model), goes from a written brief to what a shop needs. It finds the integration gaps between this week's pieces. **Nothing is fixed in this S0.** A dry run (a scratch probe, not committed) drove the steps below and found the gaps listed at the end; each gap names the probe outcome it rests on.

### The brief (frozen)

*A bench drive unit.* It has four parts:
- **Frame (the base part).** A welded table frame 400 × 300 × 300 of RHS 40 × 40 × 3, steel, with butt corners.
  - A fillet weld of 3 mm at every joint.
  - A gusset 60 × 60 × 5, corner clipped 10, at each leg top.
  - An inset end cap, 4 thick, in each leg's foot.
- **Plate (part p1).** Machined from Al 6061 block stock 310 × 210 × 16, the finished size 300 × 200 × 14.
  - Four Ø6.6 through holes fix it to the rails.
  - A Ø47 H7 bore takes the bearing.
  - A 50 × 30 × 8 pocket.
- **Shaft (part p2).** A steel turned shaft, Ø20 × 30 / Ø25 × 40 / Ø20 × 25.
  - A 6 × 6 × 18 key in its keyseat.
  - A 6204 bearing on step 1 against the Ø25 shoulder, the seat k5. **Corrected by O158: on step 3 against the same Ø25 shoulder; on step 1 it sat over the key.**
- **Cover (part p3).** A Ø60 × 8 cover, PETG, printed on FDM, with a face O-ring gland for a 2-214 O-ring. It sits on the plate over the bore.

**What the shop gets**: per-part DFM reports, a drawing per made part, the BOM and the purchase CSV, a clean clearance map, and the export bundle.

### The person's rows, loaded first

They come from one fixture, `conformance/a9/rows.json`. The values are this lane's existing test rows, each citing its source as a test row. Nothing is built in and there is no standards text.
- The section row R40.
- Stock lengths S6, 6000 mm, kerf 2.
- Block B1, 310 × 210 × 16, allowance 1.
- Bar stock for the shaft, Ø30.
- Fit tables H7, k5, k6, N9, h9 and JS9, over 18–30 mm and 6 mm, each flagged an estimate.
- The bearing row 6204 (bearing.test's D139 values).
- The O-ring row 214 (gland.test's).
- A fastener row M6 for the screws (not yet probed).

The section and stock rows go in by chat (`features.frame_sections`, `frame_stock`, `stock`). The fit, bearing and O-ring rows have no chat action; they are written into the part's document, as the Library panel does (gap A9-9).

### Steps and their oracles (frozen)

Each step is a chat call or a short run of them, with its expected outcome. "Exact" means a closed form or a kernel case. The probe's outcome is given where it reached the step.

1. **Rows.**
   - Before loading: the bearing and the O-ring gland are refused, typed: "Load your … rows first: none is built in" (probed).
   - After loading: each row echoed with its source.
2. **Briefs per part**: process, material and purpose. The frame is welded fabrication, the plate cnc-milling, the shaft cnc-turning, the cover fdm. Gap A9-2 blocks this today, and A9-12 for the frame.
3. **Frame.** `features.command frame` with the table skeleton on R40 and butt corners: 8 members.
   - **Exact**: A · ΣL = 444 · (4 · 320 + 2 · 360 + 2 · 260) = 1 118 880 mm³, where A = 40² − 34² (probed: 1118880).
   - Cut list: 3 rows (legs 320 × 4, rails 360 × 2 and 260 × 2), nested into one S6 length.
   - Offcut: 6000 − 2520 − 8 · 2 kerf, by FRb's rule (frozen from FRb's own test).
4. **Welds, gussets and caps.**
   - Expected joints: each rail end butting its leg. The `weld_list` finds none today, so no records, beads or symbols (gap A9-1).
   - Bead oracle, once found: each rail end on its 40 leg is the kernel's frk `bead-tee-flush` case, 360 mm³ at leg 3 (8 ends, 2880 mm³).
   - Gussets (4) and end caps (4), each by FRk1's oracle: a cap's plug is 34 · 34 · 4 = 4624 mm³; a gusset is (l1 · l2 − c²)/2 · t.
   - Their seams are welds, and the cap's default kind is butt.
   - Beads weigh but make no BOM line (5b).
5. **Plate.**
   - Box, four holes, the Ø47 bore and the pocket, the bore classed H7 (`fit-class`).
   - **Exact** (B-rep): 840000 − 12000 − 4π · 3.3² · 14 − π · 23.5² · 14.
   - DFM for cnc-milling, today the base part's (gap A9-2).
   - CAM package (G23 B) from its own document:
     - one +Z setup;
     - pocket feed levels 11, 8 and 6 at stepdown 3;
     - **the linking oracle and the swept-volume oracle** of cam-package.test: 12000 mm³ less at most 4(1 − π/4)R² · 8;
     - the stock a box from B1.
   - The probe got STOCK_NONE_LOADED until the stock was set on p1 itself (gap A9-8).
6. **Shaft.**
   - `shaft` (the defaults), then `key` (6 × 6 × 18, its height an estimate), then `bearing` 6204 on step 1, k5. **O158: on step 3 against its start.**
   - **Exact**: the bearing's body is 19800.6522 mm³ (Pappus; the kernel's case).
   - The seat note: "k5: 20.002 to 20.011, interference −21 to −2 µm".
   - `query.fit_clearance` H7/k6 at 20: −15 to +19 µm, closed form (probed: −15, +19).
   - DFM for cnc-turning, per part (gap A9-2).
7. **Cover.** A Ø60 × 8 cylinder with an `oring-gland` on its top face for 214.
   - Gland prefills (estimates), **closed form**:
     - depth h = 3.53 · (1 − 0.25) = 2.6475;
     - width w = π · 1.765² / (0.8 · h) = 4.6208 (probed: 2.648 and 4.621).
   - Print layers (G23 A) at 0.2 along +Z:
     - 40 layers;
     - no overhang and no support (the groove opens upward);
     - above z 5.3525 the groove shows as a hole and an island between the outer loop's inscribed-polygon area and π · 30².
8. **Assembly.** Parts placed exactly (`place_part`):
   - the plate on the rails' top (z 320);
   - the shaft through the bore, the bearing's outer ring in the Ø47 bore;
   - the cover on the plate over it.
   - The clearance map (G22) is **clean** when no pair has an overlap volume > 0 except the designed ones (the O-ring's squeeze, the bearing's seat), and no near pair falls below the brief's least gap.
   - Today, contact reads as overlap (A9-5) and designed interferences read as clashes (A9-6).
   - The bearing's housing has to be in the plate, another part (A9-7).
9. **Drawings**, one per made part (`drawing.auto` with `part` works: probed for p1, no issues).
   - **Weldment**: weld symbols, the weld list, the cut list, the BOM table and balloons.
   - **Plate**: section A–A through the bore and the pocket, the Ø47 H7 fit callout.
   - **Shaft**: Ø20 k5, the keyseat.
   - **Cover**: the gland's section.
   - Oracles, after `drawing.fix`:
     - no error in `drawing.issues`;
     - balloon numbers are the BOM's item numbers;
     - no WELD_NOT_SHOWN with symbols on;
     - no FIT_ROW_MISSING.
   - `drawing.set` cannot ask for any of these today (A9-4). The base's drawing draws every instance too (A9-13).
10. **BOM and purchase CSV.**
    - Made lines: the members (by cut-list rows), the plate, the shaft and the cover.
    - Bought lines, **exact** counts: the key, the 6204 bearing (row, source), the 214 O-ring (row, source) and 4 M6 screws.
    - The CSV holds exactly the bought lines (probed: key, bearing and O-ring).
    - The key's line has no source and no estimate flag (A9-11).
    - Mass: Σ volume · density by material, with no assumed mass left.
    - No chat action for either (A9-10).
11. **Export bundle (A8.6).**
    - The person approves the BOM baseline: the script plays the person with a token. The agent's own approval is refused, APPROVAL_IS_THE_USERS.
    - `writeBundle`: the manifest is complete.
    - `verifyBundle` in a fresh process: intact, nothing missing, changed or stale.
    - The probe got "incomplete: no approved baseline, materials defaulted" until both were set, which is the expected refusal path.
    - No chat action (A9-10).

The run lives in `test/a9-acceptance.test.ts` with `conformance/a9/` (the scenario JSON with its calls, the rows and the expected outcomes). It also runs from a fresh process by `cad-cli`, as A7.5's board does, with the same outcomes. A9 asserts each step's oracle and keeps every refusal's code.

### Refused or estimated (frozen)

**Refused, typed** (the run asserts these):
- A bearing or gland before its rows.
- `fit_clearance` with no class ([FIT_FACE]).
- An unknown material ([MATERIAL_UNKNOWN]).
- A frame-stock row without a length ([FRAME_STOCK_ROW]).
- CAM with no stock (STOCK_NONE_LOADED) or none that fits (STOCK_NONE_FITS).
- A fillet record on a mitre (BEAD_KIND, the part still evaluates).
- The agent approving a baseline (APPROVAL_IS_THE_USERS).
- The bundle while anything is missing or stale.

**Estimated, said as such**:
- The key's height and the keyseat's sizes.
- The gland's width and depth (80 % fill, 25 % squeeze).
- A weld size left unset (the thinner wall).
- The CAM tool's Ø, the safe height and the 3° ramp. CAM is NOT FOR PRODUCTION: no G-code.
- The 0.2 mm layer height when unset.
- The fit rows (test rows flagged estimate).
- A part's mass until its material is set.

### Gaps found (items, before fixing anything)

| # | Gap | Probe outcome | Where |
|---|-----|---------------|-------|
| A9-1 | No weld joints where three members meet (the ordered trim's `through` ends: a table's or a box's top corners), so a table frame has no welds, beads, symbols or weld table. | table/box frames: `weld_list` "no weld joints"; a rectangle (two-member corners): 4 joints | outer, `frames/welds.ts` |
| A9-2 | `query.manufacturability` and `requirements.brief` take no `part`: they judge and write the base part. The studio's process set by one brief also outlived a later brief's sheet-metal. | p1's report named the frame's steel and `b0_part0`; the base's brief said sheet-metal, its report fdm | outer, chat |
| A9-3 | Unknown arguments are dropped silently, and the call says ok: `part` on a tool without one, `weldSymbols`/`balloons` on `drawing.set`. An agent believes it acted. Needs a typed refusal. | `drawing.set {weldSymbols, balloons}` ok, nothing set | outer, chat dispatch |
| A9-4 | `drawing.set` cannot ask for weld symbols, balloons, sections or tables (BOM, cut list, weld list): the shop drawing's parts are out of an agent's reach. | the schema has sheet, scale, projection, front, views, tolerancing and title only | outer, chat/drawing |
| A9-5 | The clearance map reads contact (gap 0) as overlap; its fill is 0 mm³ and the pair stays an overlap. Welded members, the plate on its rails, a bearing in its bore can never be clean. Needs a contact state, and how members of one weldment count. | table frame: 12 overlaps, each filled 0.000 mm³ | outer, `team/clearanceMap.ts` |
| A9-6 | Designed interference (a seat's press fit, an O-ring's squeeze, a key in its seat) reads as a clash: the map does not read the fit records or the gland/bearing notes. | p2: shaft~key, shaft~bearing overlaps; the cover's O-ring in its gland | outer, G22 |
| A9-7 | A bearing's housing must be a feature of its own part: the plate's Ø47 bore cannot be the 6204's housing (no seat or housing-class check across parts). | `bearing` on p2: housing "none" | outer (the kernel's check takes the housing as given?) |
| A9-8 | The person's shop rows live per part document: the base's stock does not reach p1. The same holds for fit tables and bearing and O-ring rows. Decide: load per part, or the parts read the document's. | p1's CAM STOCK_NONE_LOADED until `features.stock {part: p1}` | decision, then outer |
| A9-9 | No chat action loads fit tables or bearing, O-ring, ring or drive rows (only the Library panel does), while section and stock rows load by chat. Decide: by design (the person loads them) or an action. | gland "Load your O-ring rows first" with no tool to do it | decision |
| A9-10 | No chat action for the BOM, the purchase CSV, the clearance map (G22), the CAM package and print layers (G23) or the export bundle (A8.6): the shop's package is not an agent's to make. | called off the chat in the probe | outer, chat |
| A9-11 | A key's purchase line has no row, no source and no estimate flag, though its sizes are estimates. | CSV `4,key 6 × 6 × 18,1,key,6 × 6 × 18,,,,` | outer, `team/bom.ts` |
| A9-12 | No process for a weldment's DFM (none of the processes is welded fabrication). Decide: add one (cut list, weld access, the distortion rule as estimate), or the cut and weld lists stand in. | brief processes: fdm … sheet-metal | decision |
| A9-13 | The base part's drawing, when the document has instances, draws and dimensions every part: the frame's drawing showed the cover's Ø60 and the shaft's Ø20. A part drawing should draw its own part; an assembly drawing wants balloons, not dimensions. | `drawing.auto` on the base: Ø60, Ø19, Ø20, Ø25, Ø6.6 among its dimensions | outer, drawing |

**Proposed order once the S0 is accepted:**
1. A9-3 (cheap, and it makes the rest safe to probe).
2. A9-2.
3. A9-1.
4. A9-5, then A9-6.
5. A9-13, then A9-4.
6. A9-10.
7. A9-11.
8. A9-7.
9. The decisions A9-8, A9-9 and A9-12 as the coordinator rules.

After each item, the A9 run moves one step further. It is the acceptance once all eleven steps hold.

## A9 decisions (2026-10-22)

- **A9-8** (coordinator): parts read the document's shop rows. The rows are loaded once at the base or assembly document; a placed part inherits them; a part's own rows override by id. Reports state the origin.
- **A9-9** (owner, verbatim: "b 로 하자"): the agent may load rows only from a file the person gave in this conversation, its source recorded. One rule for every row kind (the section and stock loaders included); agent-written rows are refused (ROWS_NOT_FROM_PERSON); the Library panel is unchanged.
- **A9-12** (coordinator): no weldment process for now. The cut, weld and bead reports stand in. The welded-fabrication DFM profile is an open item.

## Outer lane: hand-over (account change, 2026-10-22)


**State.** Branch `claude/cad-outer-lane-531d5a` (worktree `.claude/worktrees/studio-mates-cbde0e`), local only. The last O-number is O148; later entries in `decisions-outer.md` are titled, not numbered (queue 3–5b, G22, G23, A9). The last work commit is `65eeac483`; this block's commit follows it.

| commit | item | verified |
|---|---|---|
| `a739066a4` | A9 S0 (docs) | — |
| `e3db22957` | A9-3: unknown arguments refused, `[UNKNOWN_ARGUMENT]` | **yes**: package 794/794, studio 211/211, every FLOW_ONLY "chat" step ok |
| `1b7333f9f` | A9-2: `part` on the report, the print orientation and the brief | its own tests (part-scoped, brief, unknown-arguments, printability) and tsc only |
| `cc452383b`, `4f93e826c` | A9-1: weld joints at ordered-trim nodes; `set_welds` re-evaluates | frame-welds, weld-beads, frame-plates and frame tests (37/37) and tsc only |
| `65eeac483` | **wip** A9-5/6: contact, touching, designed in the clearance map | clearance tests 9/9, tsc and eslint only |

**Checks stopped before finishing: none.** The owner's stop ("백그라운드에서 돌고있는거 다 멈추고 인수인계에 적어줘") found nothing of this lane running: the one background verify (v169, of A9-3) had completed green, and no test, flow or build was left mid-run. What is not yet verified, all in one run: the full package and studio suites, and the flow with `FLOW_ONLY="chat|weld|FRd|frame|clearance|brief|printab"`.

**The A9 queue** (the S0 is in `decisions-outer.md`, "A9 — S0"):
- Done: A9-3 ✓, then A9-2 ✓, A9-1 ✓ and A9-5/6 (wip), the last three on their own tests.
- Left, in this order: **A9-13 → A9-4 → A9-10 → A9-9 → A9-11 → A9-7**.

**Decisions:**
- **A9-8** (coordinator): parts read the document's shop rows. The rows are loaded once at the base or assembly document; a placed part inherits them; a part's own rows override by id for that part. Reports state the row's origin. Test: the base's B1 stock reaches p1. Not built yet; it goes in with A9-10.
- **A9-9** (owner, verbatim): "b 로 하자".
  - The agent may load rows only from a file the person gave in this conversation (attached or pasted), its source recorded.
  - One rule for every row kind: fits, bearings, O-rings, rings, drives, sections, stock, bend tables and connectors.
  - A v2 action per group, or one `library.load_rows {kind, file}`; mind the per-turn count.
  - Each row keeps `source: {file name, supplied by: person, conversation turn}` beside its own source or estimate flag.
  - Rows the agent writes itself are refused (ROWS_NOT_FROM_PERSON).
  - The existing section and stock chat loaders come under the same rule; the Library panel route is unchanged.
  - Tests: a person's file loads with its source kept; agent-written rows are refused; the A9 run loads `conformance/a9/rows.json` as the person's file.
- **A9-12** (coordinator): no weldment process for now. The cut list, the weld list and the bead reports stand in. Open item: a welded-fabrication DFM profile (weld access, distortion rules), which needs sourced rules.

**Found while fixing (for the A9 run and the kernel lane):**
- **Kernel request:** the kernel refuses a bead on an ordered-trim end (`[BEAD_SEAM_NOT_PLANAR] … trimmed to an envelope or a body`), even where the envelope face is a plane (a rectangular tube's flat side). The weld list says so per joint, and the part still builds. A9 step 4's bead oracle (8 × 360 = 2880 mm³) waits on it.
- **The A9 brief needs one correction before its run is written:** the default shaft's keyseat sits on step 1, under the 6204. The map now shows it as a 115 mm³ clash (nothing seats the key with the bearing). Put the key on another step, or move the bearing.

**G22 data (done; the GPU lane's worker consumes it at G22, not built yet).** `team/clearanceMap.ts`:
- `assemblyPlacedBodies(doc, evaluate)` gives the bodies, each with `key`, `mesh`, `brep`, `pose` (world = m·local + t), `designedWith?` and `squeeze?`.
- `clearanceMap(bodies, {nearMM})` gives `{version 'clearance-map-v1', revision, near, pairs, pending, timing}`. Each pair is:
  - `a`, `b` and `state`, one of overlap, contact, touching, designed, near or clear;
  - `designed?` (the source) and `squeezeMM3?`;
  - `minGapMM` and `closest {a, b, faceA, faceB}`, each point in its own body's frame;
  - `pose` and `overlap?`: `{volumeMM3, mesh}` in a's frame, or `{pending}`, or `{refused}`;
  - `band?`.
- Then, nearest first: `bandFor` and `bandPending`; `fillOverlap`, `applyFill` and `pendingPairs`.
- Also `designedSeats(doc, bodies)` and `TOUCHING_MM3 = 1e-6`.
- State rules:
  - no distance is `contact`; after the fill it becomes `touching` (≤ TOUCHING_MM3) or `overlap`;
  - a seated or fit-paired pair is `designed`;
  - an O-ring is designed against anything up to its gland's `overlapMM3`; past that it is an `overlap`.

**G23 data (done).**
- `print/layers.ts` `printLayers(meshes, {layerMM, direction, limitDeg})` gives:
  - `{version 'print-layers-v1', direction, directionSource, modelToBed, layerMM {mm, basis}, limitDeg, count, heightMM}`, where `modelToBed` is a column-major 4×4;
  - `supportColumns` (`{footprint, z0, z1}`) and `supportVolumeMM3`;
  - `layer(k)`, cached: `{z, contours [{points, hole}], overhang, support}`, the points flat x, y on the bed.
- `machining/camPackage.ts` `camPackage(doc, bodies, {toolMM?, tool?})`. It is NOT FOR PRODUCTION: the banner comes first and no G-code is written. It gives:
  - the tool's whole shape, the stepover and stepdown, and the basis;
  - the stock as a solid, or its refusal;
  - `setups`: `{setup, frame, axis, safeZ, entry, moves [{kind, a, b}], passes}`, the frame column-major;
  - `skipped`.

**Open items:**
- Verify the wip and A9-1 and A9-2 (see above).
- The kernel bead request.
- The A9 run itself: `test/a9-acceptance.test.ts` and `conformance/a9/` (rows, scenario, expected outcomes), after A9-9, A9-10 and the brief's key correction.
- The welded-fabrication DFM profile (A9-12).
- The carried items below.
- This session's scratch probes (`zz-a9-*`) were not committed. The S0's table records what they showed.

**Standing rules:**
- Check the load first (`vm.loadavg`); if it is over 40, wait. Run the kernel suite at `--test-concurrency=4`.
- FLOW_ONLY runs only the steps the change runs. Rerun only a failing step and its prerequisites.
- No edits while a flow runs: its Vite server reloads live sources. Run checks in a separate verify worktree.
- A top-bar change also runs O90's shapes-strip step and O127's narrow-window step (the layout guards).
- Run tsc after the last test edit: cad-model's tsc covers `test/`, and the esbuild runner does not.
- Compare test names against the last run's: an overwritten test file vanishes silently.
- No nested closures in hot paths.
- The model imports nothing from ui/ or viewport/, and stays out of `src/viewport/**`.
- No built-in tables or standards text; the person's rows come first.
- Typed refusals; never loosen a tolerance.
- Kill only your own PIDs.
- New commits only: no amend, no rebase.
- pnpm-lock only with a new dependency.
- Commit as easylogic `<cyberuls@gmail.com>`.

**How to resume:**
1. Read this block, then `decisions-outer.md` from "A9 — S0" to the end.
2. Make a detached verify worktree at the head, then:
   ```bash
   pnpm install --offline
   ```
   Run `build:library` in `packages/barocss-cad` and `packages/barocss-gpu`; `lint` and `type-check` in `packages/barocss-cad-model`; `npx tsc --noEmit -p .` and `node scripts/test.mjs` in `apps/cad-studio`; `node scripts/test.mjs` in `packages/barocss-cad-model`.
3. Diff the passing test names against the last run's.
4. Run the flow as `FLOW_ONLY=… CAD_STUDIO_CHAT_PORT=52391 CHROME=… PW_DIR=~/.cache/barocss-playwright/node_modules/playwright node test/browser-flow.mjs <out>`.
5. Once the wip is green, take A9-13.


### A9-4 — manufacturing drawing options (2026-10-22, source preparation)

- Normal merge baseline: `720c703619f3c2b711c52298f89a06e9699f87a8` (parents native `b62f4656c5b978c956f555fa92f214919f5eef57` and exact Integration `73434a7dd69b2e8e040320a5b4580e27dc743dac`). Clean before implementation. A9-13 native evidence remains separate; this merge adds no verification claim.
- `drawing.set` retains the existing proposal/user-approval path. No direct application, batch or agent approval exemption.
- Optional `weldSymbols` and `balloons`: booleans; true enables, false removes the saved flag. Omitted fields retain their current value. Null, coercions and unknown keys are refused atomically.
- `sections`: complete replacement array of strict `{id, view, at}` records. IDs are unique A–Z or AA–ZZ, view is front/top/right, at is finite model mm. Empty array clears both modern sections and the legacy section. Use existing `withSections` canonical storage (single A/front writes legacy section). A changed/removed section referenced by a dimension is refused; no dimension or manual reference is silently removed.
- `tables`: complete replacement array of strict `{id, from, title?, at?, corner?, whole?}` source-table records. `from` is bom, cut-list or weld-list; IDs unique nonempty strings; at is exactly two finite sheet-mm numbers; corner uses existing four values; whole is boolean. No generated columns, rows, standards or supplier data. Empty array removes tables. Omission preserves all existing table kinds and authored content.
- Scope is resolved before option changes and stored explicitly; enabling BOM/balloons must not switch an implicit base part to assembly. Part local geometry, assembly Auto refusal and BOM/balloon identity remain A9-13 contracts.
- Native/worker/proposal/batch regressions and actual UI/export/Save/Open/reedit are required. GPU owns the serial check slot: no build/type/test/browser starts during source preparation. Record immutable task SHA, then request the slot.

### A9-4 — native feature verified (2026-10-22)

- Baseline `720c703619f3c2b711c52298f89a06e9699f87a8`; production `7f9773cdaccac59e44964dd2d3935c8846736cef`; exact tested checkout `ab679bcc95e92bb4b38cc2ca60af693a437a2857`. Production and test source hashes identical between the latter two. Receipt/manifest: `packages/barocss-cad-model/evidence/ab679bcc95e92bb4b38cc2ca60af693a437a2857/`.
- Lease cad-a94-ab679-feature-20261022: own detached clean scratch/deps/dist, Node22.19.0/GOMAXPROCS1/test concurrency1, serial commands and bounded running load. CAD/GPU builds, affected native20/20 (including production worker and A9-13/FixAll), both type checks and scoped lint pass.
- Actual scripted-claude → real chat/MCP v2 drawing.set proposal → UI user Accept: weld symbols, balloon1 with plate identity, sections A/B and BOM/cut-list/weld-list display/output. Actual Save/New/Open/title reedit, disable flags/clear lists and restore pass. All3 proposals accepted, model/instances/user welds preserved in saved files. PDF one-page A3 render visually checked plus extracted texts; DXF ANSI_1252 group-code texts agree with SVG/PDF. External CAD import/render remains unrun.
- First failure is only extra file-audit's incorrect UTF-8 read of Windows-1252 DXF; original script/log kept. Separate CP1252 audit passes. Product source and passing checks/UI unchanged, no repeat. Poppler Fontconfig warning preceded natural exit0 and valid PNG. Existing BEAD_KIND physical-bead refusal for the fixture's mitre/fillet record is printed; no bead creation or manufacture qualification claim.
- All owned recorded process roots exited, ports52391/52392 clear, scratch tracked clean; unrelated Chrome preserved. Model slot returned, no further checks. Native feature verified; Integration adoption/validation pending. No remote/live-model/full-suite/benchmark work.

### A9-10/8 — source preparation (2026-10-22)

- Baseline a671eee202837147a99c16319ed05fc54bc57a7e, normal merge of exact30f7ca2bdcd500b2bc063a5b5a8860c84a989533. Frozen task bounds and existing-generator reuse decisions in packages/barocss-cad-model/evidence/a9-10-8/brief.md. Source only; feature verification has not started.
- Six read-only actions: query.bom/purchase_csv/clearance/cam, print.layers, assembly.bundle; strict input and expectedRevision, file content+SHA256 via existing MCP JSON, no approval mutation/new host loader. Bundle existing user approval/freshness/bead gates remain.
- Derived shop row context retains authored child/parent and row refs; same-id local override, report origins. Existing material registry absent, so no new material schema; existing material semantics retained. Human/coordinator explicitly extended lease for two part dispatch branches, drawing scope and engine/wire/cache context. No App/GPU/Kernel/shared runner or extra frames edits.
- Nested section rows inline in temporary flatten view; actual distinct nested machine-row conflict refuses explicitly. No full nested machine-row flatten claim; namespace seam outside current owned path. This limit must remain visible in verification/adoption.
- Interrupted solely for separately routed old unknown guard: source5f5636e73/evidence5c9a38d5,10/10+Model types+lint, coordinator adoptiona0010e44. Original17 WIP hashes unchanged, no reset/stash/mixing. Main feature source work resumed; no feature checks until a new lease.

- Second isolated interruption: a001 baseline → frame guard/legacy label sourcef36f33619, evidence24510f8b0.18/18 frame+FRk3/FRk4 editor controls, both types and scoped lint pass;24 WIP hashes unchanged. Slot returned. No whole-suite/UI claims or mixing into this WIP. Source work resumed.
- Wire origin metadata and optional successful evaluation origins are additive runtime data, not StudioDoc schema. Full local overrides retain parent context; same-view re-resolution does not reinterpret inherited rows as local. Source tests cover actual App worker and direct/batch/proposal/context save paths. Feature checks remain unrun until its own exact-SHA lease.

### A9-9 — conversation row files, source-only (2026-10-22)

- Separate branch codex/cad-model-a99-rows starts at14387248f89cf4c028ada541ddce386ced45ec7d. Preserve the original A9-10/8 branch and its first execution slot. Managed worktree creation failed for disk space; the coordinator approved a branch in the original clean checkout. No other checkout/output cleanup followed.
- Implemented the owner's rows rule b: actual user JSON attachment/paste → conversation file reference → existing v2 library.load_rows and domain validation. Existing section/stock chat loaders use the same file authority and refuse agent rows. The Library panel is unchanged.
- The coordinator approved exactly ChatPanel/client/chatServer/cadMcp plus Model doc field/list, wire retention and shopRows provenance consumption. A per-row digest sidecar keeps filename/person/turn/file SHA256 beside the original strict source/estimate fields. Inheritance and override use matched row receipts; stale receipts do not support changed values. Bend explicitly targets an existing sheet feature and keeps proposal/approval gates.
- See packages/barocss-cad-model/evidence/a9-9/brief.md for the source contract, capability boundary, persistence limit and separate execution order. No builds, tests, types, lint, server or browser ran for A9-9. Its source tests are not passing evidence. Source-only checkpoint precedes the assigned exact9b318 normal merge.

### A9-10/8 — actual outputs and Studio lifecycle receipt (2026-10-22)

- Frozen baseline14387248f89cf4c028ada541ddce386ced45ec7d; tested sourcefea13033a045e6e67a0ddc3a588c7effab1d2d24. Initial module initialization and readonly type failures were corrected inside the same feature. The v2 file envelope now preserves exact content bytes rather than translating handler-like user text.
- Final related native34/34, Model/Studio types and scoped lint pass. Actual MCP generates BOM, CSV, clearance, CAM, print layers and approved evidence bundle for inherited p1 and local-override p2; initial and post-Studio files match generators and independent bundle verification. Full responses, fixed filenames, sizes and SHA256 are retained. Unapproved/stale/invalid/missing/incomplete-bead refusals preserve state; contact remains pending for exact overlap.
- Actual scripted-claude/chat/MCP Studio flow passes: read-only outputs, user-accepted parent stock change, Save/New/Open, user-accepted child geometry reedit, another Save/New/Open. Inherited stock stays absent from the authored p1; p2's local override remains. The resulting Save file is used for the second MCP output phase. BOM approvals use the existing top-level deterministic scenario userToken channel; stock/geometry proposal acceptances use the real UI. No live model.
- Earlier browser load-stop and original timing-audit failure remain separate. The amended runtime policy applies only to the second browser attempt, which starts under1m20/5m25 and passes. No performance pass is claimed.
- Native evidence: packages/barocss-cad-model/evidence/fea13033a045e6e67a0ddc3a588c7effab1d2d24/a9108-output-feature/receipt.md. Own process groups ended;52391/52392 free; sole slot returned before packaging. Native feature evidence is ready for serial Integration adoption; no integrated-head or release claim. A9-9 source353f02c59 remains separate and unexecuted.

### A9-9 — adopted output baseline connected, source-only (2026-10-22)

- Normal merge c228158846bfd296a13b3461d351abf8f05d0297 joins preserved353f02c59 to exact owner-assigned Integrationc6f92174ca20f212847fae76688797b3e11b2758. The handover append conflict was resolved by retaining both records. A9-10/8 descriptor initialization, readonly types, exact file payloads and adopted receipts stay intact.
- Remaining real consumer seams: v2 preserves person filenames/row evidence ids instead of treating them as tool guidance; large whole-JSON pastes keep complete file bytes without violating the existing20k quote-history field limit. Actual ChatPanel user input remains the only browser registration path; plain prose/tool call scripts do not mint files. Library panel, App, viewport and Kernel files are unchanged by these source fixes.
- Added source cases for another conversation's ref, handler-like filenames/row ids, raw provenance plus ordinary guidance conversion, and whole/fenced/large paste bytes. Existing same-value parent/child file isolation, targeted reloads, different-value override and Save/Open cases remain. No A9-9 build/test/type/lint/browser was started; Kernel still owns execution. A9-10/8 adopted native results must not be relabeled as A9-9 results.

### A9-9 — explicit conversation context and approved App bridge (2026-10-22)

- ca36afb7 removes the module-global active/default context; absent/empty/foreign/revoked states cannot borrow another conversation's refs. Source cases cover loader and proposal preview/rebase/accept, including unchanged-state refusal.
- The coordinator then approved the concrete minimal App patch: chatRowFiles ref, explicit rowFiles at three proposal call sites, ChatPanel callback and capability lifetime only. Applied with a guard against re-publishing revoked authority. Close preserves pending approval; a new conversation clears/revokes prior authority. Stream/async completion does not publish capabilities. Added a paused actual-dispatch source case for revocation during evaluation.
- No viewport, instance evaluation, G22, general Save/Open/recovery or Kernel changes. No build/test/type/lint/server/browser was started. This is the next A9-9 source checkpoint, not execution evidence or feature acceptance.

### A9-9 — native actual person-file lifecycle receipt (2026-10-22)

- Baselinef7affc42; tested38e7433f2d3014337455fec36e817e0159c87128. Schema constant initialization, stale-test input, formal-field fixture and lint filename expression first failures/fixes are recorded separately. No App server existed during source edits; all actual UI flows use the final frozen source. Later Integration7f1b52 was not merged during this execution.
- Native31/31, final Model/Studio types and scoped lint pass (3 existing warnings retained). Actual JSON attachment and >20k clipboard paste use host-issued refs through real MCP proposals, existing preview/rebase/accept, Save/New/Open. Chat close preserves pending approval. Equal-id/equal-value parent/child rows from distinct files stay distinct through ordinary edits and parent-only/child-only reloads. Inherited p1 rows are not materialized. Original source strings and estimate:true persist.
- Actual empty new conversation rejects old refs, fake person input and raw agent rows. A separate live-current-file proposal followed by the actual New conversation button verifies immediate ref revocation. Native cases also cover absent/revoked contexts and revocation while evaluation is pending; no global authority fallback remains.
- The actual saved file supplies both p1/p2 six-output requests:22 files with byte/hash checks, generator content comparison and independent bundle verification. Baseline approval uses the existing top-level scenario userToken API; row proposals use real App UI approval. No live model or publication claim.
- Evidence: packages/barocss-cad-model/evidence/38e7433f2d3014337455fec36e817e0159c87128/a99-person-files/receipt.md. Owned groups ended and52691/64316 free; slot returned before packaging. Native feature ready for serial local Integration adoption; new integrated HEAD validation remains separate.

### O lane checkpoint — A9-7 native adoption and UI dependency (2026-10-23)

- Owner: Execute CAD Model / Outer. Actual worktree: `/Users/user/.codex/worktrees/c35f/barocss`. Actual feature branch: `codex/cad-model-a99-rows`. Product/tested SHA: `f78d98bcb7a9357c4457996c1a3c03a7dff3e81d`; evidence/checkpoint parent: `44bca47b0ba48906684a285790c57be1e6e12344`. No uncommitted product WIP or running Model check remains at this checkpoint. This append changes only the O decision record and does not rerun or extend native acceptance.
- Completed: explicit `{root, owner}` cross-part housing context; stable `housingRef`; current exact native housing and relative-pose checks; parent/local row handling; worker, memo and freshness inputs; existing Bearing command/editFields API; linked-part BOM refusal. Focused native 15/15, Model types and scoped lint on 22 TypeScript paths passed on the tested SHA. Original initialization/type failures and fixes remain in evidence. All seven own process groups ended; no browser/server/TCP port was used. Slot `cad-a97-37eb-native-20261023` was returned before packaging. Evidence has 25 content files / 44,300 bytes plus two manifests; 22 tested source hashes match.
- Coordinator adoption: `d47785c4263385e6b44ae7292f3321a6b8c65b01`, reported and inspected as the local A9-7 Model adoption. The coordinator alone owns integration branch `codex/cad-coordinator-handover-20261022`, serial `merge --no-ff`, and current `state.yaml` adopted scopes. This feature checkout has not merged that later adoption commit, and its earlier local state snapshot must not be presented as current coordinator state. Active WIP is retained; no branch is discarded or reset.
- Current UI dependency: GPU observed Housing/H7 Apply commit, followed by a blank screen because `useAssembly` read a bare linked child through `FaceClient.table(flattenAssembly(i.doc))`. GPU owns the assigned `useAssembly.ts`, App and BomPanel correction: current root plus explicit occurrence id, `resolveShopTree`, then the existing EngineClient part/read native face table. Model product changes are not currently requested. GPU owns the current execution; Model starts no duplicate or broad checks.
- Exact next first step: receive the immutable GPU bridge source/receipt and any concrete Model failure from the coordinator. Inspect the failed Model boundary against that exact current root/owner input. If the failure belongs to Model, fix only its assigned paths, preserve the first failure, and run only the assigned affected checks under a new serial slot. Then connect and check final manufacturing/purchase outputs against the actual saved UI document. Exit requires actual current geometry/row/source facts and exact output bytes/hashes, plus the coordinator's scoped adoption; native/API evidence alone cannot close the UI feature.
- Not run: actual UI plate selection/link/edit/move/error, Undo/Redo, downloaded manufacturing/purchase files and UI Save/New/Open on the combined bridge. A new GPU bridge SHA and Model WIP SHA for those changes are not yet received; none is invented. The separate A9-11 UI/download gap remains pending. No final aggregate validation, release, push, PR or publication is claimed.
- Standing owner rules retained: the existing protocol/state/three-Work structure; own TypeScript only; no WASM/new runtime dependencies/icon-font bundle; no nested function creation in frame/element hot paths; typed refusal without tolerance relaxation; no embedded standard rows/text. Production rows use only files supplied by the person in the conversation with provenance, and agent-authored rows are refused. Synthetic native test rows are fixture inputs only and are not production authority. CAD tool actions remain v2 with tools-list-plus-prompt at most 25,000 characters per turn. Terminate only own PIDs. Git author/committer is `easylogic <cyberuls@gmail.com>`; records/commits are English and user reports Korean. Preserve the three protected historical branches named by the owner. If the owner says to finish, stop only own active checks and report the exact point; the coordinator owns the final serial window and `codex-handback-<date>.md`.

### O lane clarification — no confirmed human-supplied row/fit file for A9-7 product acceptance (2026-10-23)

- Read-only audit result: no confirmed file was found that connects an actual human message/attachment in this conversation to original row/fit bytes and their hash. No human-source path, original message/attachment identifier or matching hash can be reported from the reviewed evidence. Missing provenance is not replaced by a saved `suppliedBy: person` field, a test source string, a file digest alone, or an automation-created conversation turn.
- A9-7 `test/bearing-housing-context.test.ts` declares the `6204` row and `H7-test` fit as literal fixture values, with source text `A9-7 supplied test row`. `test/bearing-housing.test.ts` declares `6204-test` with source text `A9-7 test row`. These are agent-authored correctness fixtures, not files supplied by the person. Native evidence `f78d98bcb7a9357c4457996c1a3c03a7dff3e81d/a97-bearing-housing-native` proves only the recorded native/API behavior on those inputs, not compliance with rows (b) for product use or actual-person A9-7 acceptance.
- Reviewed A9-9 evidence `38e7433f2d3014337455fec36e817e0159c87128/a99-person-files/receipt.md` explicitly describes a scripted CLI fixture with no live inference. Its retained `browser-case.js` drives file input/paste and proposal controls from an automation script, including generated reload files. Those files, host-issued refs, hashes, saved receipts and screenshots establish the controlled transport/capability test. They do not establish that the human supplied those rows in this conversation. Earlier labels such as "actual person files" must be read within that controlled test boundary, not promoted to real human-source evidence.
- Existing native and adoption records remain immutable. The product boundary stays open: a real human-provided row/fit file with its original message/attachment source and exact bytes/hash is needed before a corresponding actual-person product flow can qualify under rows (b). No file is invented, no fixture is reclassified, no source/estimate is rewritten, and no loader authority is fabricated. The coordinator/GPU owns that actual UI witness; Model waits for exact assigned defects or authorized output work. This clarification changes only the O record. No product check, browser, server or process was started.

### O lane owner stop — preserved A9-7 handback point (2026-10-23)

- Owner requested finish. New implementation and new feature checks are stopped. Actual worktree `/Users/user/.codex/worktrees/c35f/barocss`, branch `codex/cad-model-a99-rows`. Baseline `a283cb58c67d641e971267822f6052a84e202ce8` was normally merged at `715492ce76a123e9e0c076244cb772f1915d4f7d`; initial task `37ebd004cbf8150f997aa0600a401a3af3ab4103`; final tested product `f78d98bcb7a9357c4457996c1a3c03a7dff3e81d`; native evidence `44bca47b0ba48906684a285790c57be1e6e12344`. Pre-stop local HEAD `f32598a71f7f1a3a4d0787c12820c4426c82998c` contains only the later O clarifications. Coordinator adopted those records at `9810fe1e43298a867f26328a4f91469fd6bf3670`; the coordinator branch was observed at `f2415e3095aec5f353bd405c674662653ce27402`, not verified by Model.
- Dirty paths before this stop receipt: none. No uncommitted product WIP, active own check, server or browser exists. All seven recorded own PID/group ids (`15197`, `93054`, `63189`, `25795`, `34715`, `16943`, `96780`) were already ended at slot return and are absent again at stop observation. No signal was sent now, and no other Work PID was touched. Stop observation is `packages/barocss-cad-model/evidence/a9-7/owner-stop-20261023.json`. Original partial/failing logs remain unchanged in the native evidence directory. No reset/stash/amend/rebase, branch discard or product edit occurred.
- Last completed feature step: Model native/API housing implementation and its 15/15 focused native tests, final Model types and scoped lint. Exact coverage and source hashes remain in the native receipt. First failures remain the new test entry's CHAT_COMMANDS initialization failure and the missing-context TypeScript narrowing failure; both corrections and final passing runs are preserved. Last completed documentation step: explicit finding that no real human-provided row/fit file was confirmed. Synthetic rows remain correctness fixtures only.
- Unverified feature work: GPU's combined App/useAssembly/BomPanel bridge and its actual screen/file flow are outside the tested Model SHA. No newer Model product WIP SHA was assigned or produced. Model has not run actual combined UI link/edit/move/error, Undo/Redo, Save/New/Open, manufacturing/purchase download verification, or final integrated-head checks. A9-11 UI/download acceptance is also still pending in Model's records. Human-source row/fit product acceptance remains open; no fixture provenance is promoted. Source/native adoption is retained without claiming product completion.
- Exact first command after a new owner resume instruction: `git -C /Users/user/.codex/worktrees/c35f/barocss show codex/cad-coordinator-handover-20261022:apps/cad-studio/handover/state.yaml`. Then read the coordinator's final handback and exact GPU bridge receipt, reconcile the latest immutable SHA and owned-path assignment, and address only any assigned Model failure or output connection. Do not start a build/test/browser automatically. The coordinator alone owns the final serial validation window on the final integration SHA and `codex-handback-<date>.md`. The present commit is a local documentation checkpoint only.

## O149 — the import cycle Codex's outputs closed, broken (2026-10-23)

**The defect.** At `99da385a1`, `chat/tools.ts` imported `./outputs` statically (Codex, the v2 output tools). The chain was outputs → team/bundle → team/baseline → team/assembly → team/parts → chat/tools.
- Any entry that reached tools.ts through the team modules first found `commands` and `ROBOT_TOOLS` undefined at tools.ts's load: "ROBOT_TOOLS is not iterable".
- It failed every test file that loads that way: the model's sheet and cageEdit, and most of the studio suite's 21 failures (cad-cli, CNC, nest, mould, pattern, robot, bundles, chat, palette, decimate, frame).

**The fix, behaviour unchanged:**
- **tools.ts** loads `./outputs` on first use: a module-level promise, filled once by `import('./outputs')` in the output-tool branch. The static edge is gone, so no load order can see tools.ts half-built.
- **team/interfaces.ts** is a new leaf: the Architect's `readInterfaces`, `interfacesRevision`, `HolePattern`, `Envelope` and `Interfaces`, moved unchanged from team/parts.ts.
  - It imports only team/revision.
  - bundle, baseline, ecr and freshness read the interfaces from it; bundle and digest read `canonical` and `revisionContent` from team/revision, the same functions team.ts re-exports.
  - parts.ts re-exports the moved names, so every importer still resolves.
- **The cycle finder** (scratchpad `outer/cycles.mjs`) no longer puts chat/tools in a cycle with chat/outputs.

**Verified (T1):**
- sheet.test 8/8, with O150's fixture; the one failure left before O150 was rows (b), not the cycle;
- cageEdit.test 7/7;
- tsc of cad-model and of cad-studio;
- eslint of cad-model's src and test: 0 errors.

**Not run:** the full package and studio suites. They wait for a coordinator slot.

## O150 — rows rule (b) through the fixtures; stock and frame stock merge by id (2026-10-23)

**The fixtures.** Codex's rule (b) refuses agent-written rows (ROWS_NOT_FROM_PERSON), and that refusal is right. Tests that still handed the tools their own rows now load the same rows as a file the person supplied:
- `test/person-file.ts`: one supplied file at turn 1 (`receivePersonRowFiles`), with the reference a loader takes;
- the tests moved to it: batch-changes, clearance-designed (A9-5), frame-nesting (FRb ×2), frame-sections (FRc), frame-welds (A9-1), drawing-table (the R12 bend table) and sheet (D120).

The bend-table cases now add a plain sheet (K 0.5), then `load_rows {kind: 'bend', file, feature: 0}`, which replaces K with the person's table. The flat (80.8) and the TABLE ROWS cell are unchanged.

Each tool family still asserts the refusal:
- `set_frame_sections {rows}`, both directly and through `apply_ops` (batch-changes);
- the agent's raw sheet node carrying its own `bendTable` (sheet D120).

Rule (b) itself is unchanged.

**Merge by id: review finding P2, a behaviour change.**
- **The defect:** `set_stock` and `set_frame_stock` replaced the whole list. On a placed part whose parent carries stock, the part's shop view (the inherited rows plus its own) then read the inherited rows as removed, and the call was refused (SHOP_ROW_INHERITED_REMOVE).
- **The fix:** stock and frame-stock rows now merge by id, like every other row kind. The file's rows replace the same ids in place, new ids are appended, and rows the file does not name stay.
- **Checks per row:** a bad row is refused by its index and id. Two rows with one id in one file are refused (`[STOCK_ROW]`, `[FRAME_STOCK_ROW] two rows with one id.`).
- **Test:** person-rows P2. A placed part keeps its inherited B1 and S6 and gets its own B2 and S4, which are written into the part only. The base keeps B1 when a later file adds only R30.
- **The report:** `set_frame_sections` now names the rows the file added or changed and the ids removed. Its content lists the library: id, name, section, and the source or `estimate`.

**Open (not decided here):** with merge by id, no chat call removes a stock or frame-stock row. Before, a smaller file did that by replacing the list. A `remove` argument, like `set_frame_sections`'s, is a v2 contract change, so it goes to the coordinator first.

**Verified (T1):**
- person-rows 9/9, batch-changes 6/6, clearance-designed 4/4, frame-nesting 5/5, frame-sections 6/6, frame-welds 5/5, drawing-table 5/5, sheet 8/8;
- tsc of cad-model and of cad-studio;
- eslint of cad-model's src and test: 0 errors.

**Not run:** the full package and studio suites, which need a coordinator slot. The window's remaining model failures are separate checkpoints: enclosure O73, shop-rows (inherited-context identity), tool-contract (read-tool output schema) and toolset (the frozen v2 contract).

## O151 — the read-tool contract covers Codex's output tools; a part-scoped result's shopRows (2026-10-23)

**tool-contract.** "every read tool's result matches its output schema" failed at `99da385a1`. Codex had given six output tools an output schema in contract.ts but never ran them in the test: `output_bom`, `output_purchase_csv`, `output_clearance`, `output_print_layers`, `output_cam_package` and `output_bundle`.

The test now runs each one through `dispatchTool`, which also exercises O149's lazy load, on a document where it succeeds:
- a 20 × 15 × 4 plate for BOM, CSV, clearance and print layers;
- for the CAM package, a placed plate on the document's test stock row (written into the document directly, not through a tool);
- for the bundle, the plate approved through draft → review → approved with a user token.

Each result conforms to its schema, reports `changed: false`, and leaves the document as it was.

**enclosure O73.** A part-scoped `set_material` result now begins with `shopRows`, the provenance of the shop rows the part sees. That is the coordinator's A9-8 decision ("reports state the row's origin"), which Codex built. The part has no rows, so the expectation adds `shopRows: []`. Nothing else changes.

**Verified (T1):** tool-contract 3/3, enclosure 17/17, chat-outputs 7/7, bom-panel 4/4.

## O152 — an assembly without a cross-part housing link keeps its identity (2026-10-23)

**The defect.**
- Codex's A9-7 (`7e8dece38`, 10-23) made `resolveShopTree(root)` always return a new view of an assembly root: the root and every instance carried a bearing-context symbol.
- That broke A9-10's guarantee from the day before (`1e00c2f52`, "empty inherited context preserves legacy document and instance identity").
- Identity is what the resolved-tree caches and the studio's reference comparisons key on.

**The fix.**
- `bearingAssemblyView` builds the context only when a bearing of the root or of an immediate part has a raw `housingRef`. Otherwise it returns the root itself.
- `bearingPartView`, a part draft in part dispatch or the feature editor, still always gets its context from the root, because the draft may be adding the first link.
- Nothing else reads the context without a `housingRef` node: part.ts and wireDoc use it only for linked bearings, and the Housing choice falls back to `ctx.bearingAssembly` or the root's instances.
- `linksHousing` is a module-level loop with no closures, as the hot-path rule requires.

**Verified (T1):**
- shop-rows 9/9; bearing-housing-context 8/8 (A9-7's own tests);
- the 57 model test files that touch instances, bearings or the shop tree, all passing;
- tsc of model and studio; eslint 0 errors.

**Not run:** the full package and studio suites, and A9-7's studio UI. The GPU lane is porting `8789e468`, so it should check that the Housing path still gets its context from part dispatch.

## O153 — the studio side of rows rule (b): cad-cli's `--list` is the person's file; the studio runner takes names (2026-10-23)

**cad-cli `stock` and `nest`.**
- **Before:** `--list file.json` read the file and handed its rows to `set_stock` / `set_frame_stock` as `rows`, which rule (b) refuses. So both commands failed with any list.
- **Now:** the file is received the way the chat receives an attached one, through `personListFile` in server/cadCli.ts:
  - `receivePersonRowFiles` with the file's name, its bytes' SHA-256 and turn 1, in a conversation id derived from the path;
  - the loader then takes it by reference (`{file}`).
- **Why this is a person's file:** the person names it on their own command line, and no agent is involved.
- **What it does not do:** add a flag that marks rows as the person's without a file. A file that is not `*.json`, or not JSON at all, is refused with the receiver's message.

**cnc-stock (CNC7b ×6).**
- Lists arrive as person files (`stockList`, with `test/person-file.ts` on the studio side).
- The by-name refusals now come from files: a missing source, a block of two sides, two rows of one id.
- Two refusals stay on `set_stock`'s own arguments: a negative allowance, and rows the agent writes itself (ROWS_NOT_FROM_PERSON).
- "One too short refused" now loads its single short bar onto the shaft afresh. With merge by id (O150), the earlier R22 would otherwise stay and be chosen. This shows O150's open item: there is still no chat call that removes a row.

**chat.test.** The handler list adds Codex's `load_rows` and its six output tools.

**The studio test runner** (scripts/test.mjs) takes names, as cad-model's runner does (the coordinator approved this):
- `node scripts/test.mjs cnc-stock frame` runs only the files whose name contains one of them;
- no names runs every file, exactly as before;
- names that match nothing exit 1 rather than letting `node --test` pick its own files.

**Verified (T1), per file:**
- previously failing: cnc-stock 6/6, frame-nest-cli 1/1, chat 18/18;
- failing in the window at `99da385a1`, now passing with O149: cad-external 6/6, candidates 5/5, cnc-cam 5/5, im7 7/7, im8b 8/8, robot-sizer 3/3, team-bundle 2/2, decimate 3/3, frame 10/10, palette-rank 2/2, palette 2/2;
- tsc of studio; eslint of the changed files: 0 errors.

**Not run:** the full studio suite and any browser flow.

## O154 — S3: the frozen v2 contract, re-recorded; load_rows moves to `features` (2026-10-23)

**The diff** between `src/chat/tools-v2.json` (last recorded at O124, `c176929f6`) and the live TOOLS_V2. Codex never re-recorded the file. Group inputs carry only the action enum.
- assembly + `bundle`; print + `layers`; query + `bom`, `purchase_csv`, `clearance`, `cam` — additive.
- library + `load_rows`, with library's `destructiveHint` false → true — flagged breaking ("library: now destructive"). load_rows is rightly in contract.ts's ALTERS (it replaces rows of the same id and a sheet's K), and a group is destructive if any action is.

**The coordinator's choice: (a).**
- load_rows moves into the `features` group, which is already destructive, so library stays non-destructive (toolset.test asserts that).
- v2 was never released, and `library.load_rows` lived only in Codex's squashed work, so it is renamed outright with no alias.
- The handler name stays `load_rows`.

**Every use changed:**
- `src/chat/groups.ts`: the action moves from library to features;
- `src/chat/rows.ts`: the ROWS_KIND message, "describe features.load_rows";
- `apps/cad-studio/server/chatServer.ts`: the row-file note the agent reads, "features.load_rows takes file by id";
- `test/person-rows.test.ts`: four v2 calls and one proposal op, `library` → `features`.

Checked with git grep:
- the other `load_rows` uses call the handler name, and stay as they are (tools.ts's BATCHABLE, MUTATORS and case, drawing-table, sheet, studio chat.test);
- no studio flow or fixture names `library.load_rows`;
- the README §0 and decisions-outer A9-9 text that mentions it is history, kept.

**Re-recorded** with `UPDATE_TOOL_CONTRACT=1`. That run first asserts there is no breaking change against the old file, and it passed. The file gains seven action names and nothing else.

**Verified (T1):**
- toolset 9/9: the frozen contract, `library` not destructive, the per-turn guard at 23,180 of 25,000 characters (13 tools, list 14,938, prompt 8,242);
- shop-context-tools 3/3 (its own ≤ 25,000 guard), person-rows 9/9, tool-contract 3/3, sheet 8/8, drawing-table 5/5, studio chat 18/18;
- tsc of model and studio; eslint 0 errors.

## O155 — stock and frame-stock rows leave by name: `remove` on set_stock and set_frame_stock (2026-10-23)

This closes O150's open item. O150 made rows merge by id, so a smaller file no longer drops rows. The coordinator chose a `remove: [ids]` argument mirroring `set_frame_sections`'s.

- **The calls:** `set_stock {file?, remove?, allowance?}` and `set_frame_stock {file?, remove?, kerf?}`.
  - The file merges first, then the named rows are dropped (`removeRows` in tools.ts, a module-level helper).
  - An id the list does not have is refused with the list (`[STOCK_ROW_UNKNOWN]`, `[FRAME_STOCK_UNKNOWN]`), and the document is unchanged.
  - The v2 hints and the descriptions name `remove`. Group inputs carry only the action enum, so the frozen contract is unchanged.
- **On a placed part:**
  - its own row goes;
  - an inherited row is the base's, so removing it there is refused by A9-8's restore (SHOP_ROW_INHERITED_REMOVE), and the base keeps it.
- **Nothing references a stock row by id** (CAM and nesting choose from the list), so no in-use check is needed. That differs from sections, which members name.
- **cnc-stock's "one too short"** now removes R16, R25 and R22 by name and adds the short R22s, on the same shaft. O153 had needed a fresh document for this.

**Verified (T1):**
- person-rows 10/10, with the new O155 case: base remove, kerf with remove, unknown ids, file plus remove, and part-own versus inherited;
- toolset 9/9 at 23,198 of 25,000 characters a turn; shop-context-tools 3/3, tool-contract 3/3, frame-nesting 5/5, batch-changes 6/6;
- studio cnc-stock 6/6, frame-nest-cli 1/1, chat 18/18;
- tsc of model and studio; eslint 0 errors.

## O157 — the CAM package's pockets where they are: the floor plane's origin added once (2026-10-23)

**The defect.** The GPU lane's G23 overcut check found it.
- **Symptom:** CNC8's pocket is 50 × 30 at x 35–85, y 25–55, with its floor at z 12. Its packaged feeds ran at x 73–117, y 53–77, where they should be at 38–82, 28–52 (the pocket inset by R 3). The program was shifted by the floor plane origin's in-plane part (35, 25), so the tool would have milled the plate's top.
- **Cause:** cam.ts's `outlineOf` gives the loops as absolute projections [p·X, p·Y]. camPackage's `pocketMoves` then added the whole origin again: `o + q0·X + q1·Y + (floor − depth)·n`. z came out right only because the origin's normal component is the floor's height.
- **Why the test missed it:** the existing swept-volume test measured the cut against the feeds' own bounds.

**The fix.**
- A point at a depth is `q0·X + q1·Y + (o·n + floor − depth)·n`, then taken into the setup's frame. Only the origin's height along the normal counts.
- It is a module-level `pocketPoint`, with the top height `o·n + floor` worked out once per pocket. The per-point `[0, 1, 2].map` closure is gone, as the hot-path rule requires.
- Holes are unaffected, because `drillMoves` uses the world point `op.at`.

**The oracle**, absolute (cam-package.test, "O157 the pocket where it is"). Each setup's feeds are taken back to world coordinates through its frame's transpose and must lie in the pocket inset by R = 3, at its levels:

| Setup | Pocket | Feeds (x, y, depth) |
|---|---|---|
| +Z | CNC8's | [38, 82] × [28, 52], z [12, 17] |
| −Z | the same, opening on the bottom | [38, 82] × [28, 52], z [3, 8] |
| +X | a side pocket into x 120, y 25–55, z 4–16 | x [112, 117] × y [28, 52] × z [7, 13] |

The test fails on the old code and passes on the fix.

**Verified (T1):**
- cam-package 4/4, chat-outputs 7/7, tool-contract 3/3;
- studio cnc-cam 5/5 and chat 18/18;
- tsc of model and studio; eslint 0 errors.

**Not run:** the GPU lane's end-to-end "no overcut" check, which they add after this lands.

## O158 — O3: the A9 brief's bearing moves off the key, from step 1 to step 3 (2026-10-23)

**The clash.** With the default shaft (Ø20 × 30 / Ø25 × 40 / Ø20 × 25) and the default keyseat on step 1 (z 6–24), A9's 6204 on step 1 against the Ø25 shoulder (z 16–30) sat over the key. The clearance map reads that as a 115 mm³ clash, since nothing seats a key with a bearing (A9-6's test pins it).

**The choice: move the bearing, not the key.**
- The bearing goes on step 3, against that step's start, which is the other side of the same Ø25 shoulder. It now sits at z 70–84.
- The shaft keeps every default: the keyseat on step 1, and the ring groove on step 3 at 18 from its start (z 88), clear of the bearing.
- Step 3 is Ø20 like step 1, so the seat and its numbers do not change: k5 at 20, the seat note, `fit_clearance` H7/k6, and the bearing body's 19800.6522 mm³.
- The S0's two lines (the parts list and step 6) are marked "corrected by O158". The A9 run (O5) follows the corrected brief. No placement in it is written yet.

**The test** (clearance-designed, "O3 (A9 brief)"):
1. The default shaft, its key, and the 6204 at `{step: 3, against: 'start'}`. The node stores step 3 and start.
2. The key sits at z 6–24 and the bearing at z 70–84, read from their meshes.
3. Key and shaft, and bearing and shaft, are both designed seats.
4. No pair overlaps. The key and the bearing are not even a pair within the map's 1 mm.

The A9-6 test of the old placement stays as it is: it is the record that the clash is found.

**Verified (T1):** clearance-designed 5/5, tsc, eslint 0 errors.

## O159 — O5, the A9 acceptance run, first half: the rows fixture and steps 1–7 (2026-10-23)

**The rows** (`packages/barocss-cad-model/conformance/a9/rows/*.json`, with its README). The coordinator's conditions:
- **It is a test fixture standing in for the person's files.** Each file is received through the chat's person-file path, `receivePersonRowFiles` at turn 1 (rows rule b), then passed by `file` to `features.load_rows` or the stock tools.
- **Every row cites a source or says it is an estimate:**
  - 6204: NSK's page, D139's B1. It gives no `boreDeviationUM`, because the page gives no bore tolerance.
  - 214: Global O-Ring's AS568 chart, D139's O1.
  - The fit rows (H7 18–30 and 30–50, k5, k6, N9, JS9, h9): all `estimate: true`, since ISO 286's deviations are not public as text (D139).
  - R40: `estimate: true`, with sharp corners.
  - B1, R30 and S6: the stock loaders require a source text, so it names this fixture as "an illustrative shop list for the A9 run, not a real shop's".
- There is no standards text and no copied table.
- One file per kind, in place of the S0's single rows.json, because a loader takes one kind per file.
- **The owner's own acceptance, with a real person-supplied row/fit file, stays pending.**

**The run** (`test/a9-acceptance.test.ts`). It goes through the real v2 tools (`dispatchTool`), on the brief as O158 corrected it. Each step and its oracle, all passing:
1. **Rows.**
   - `frame_sections {rows}` with the fixture's own rows is refused (ROWS_NOT_FROM_PERSON); the file loads R40, an estimate.
   - Frame stock S6 with kerf 2, and stock B1 and R30 with allowance 1.
   - The bearing, fit and O-ring rows go on the base, and each load echoes its file: name, `suppliedBy: person`, turn 1. The parts inherit them (A9-8).
2. **Briefs.** The frame states purpose and material, and its process stays a gap: there is no weldment process (A9-12). p1 is cnc-milling, al6061; p2 cnc-turning, steel; p3 fdm, petg. Each part's manufacturability report runs on its own process (A9-2).
3. **Frame.** 8 members, steel.
   - **Exact:** A · ΣL = 444 · 2520 = 1 118 880 mm³, with the top at z 320.
   - Cut list: [4 × 320, 2 × 360, 2 × 260].
   - Nested into one S6: used 2520, kerf 14, offcut 3466.
4. *(Welds, gussets and caps: not in this half.)*
5. **Plate.** 200 × 300 × 14, so its 300 bridges the two 360 rails; four Ø6.6 holes over the rails, the Ø47 bore and the 50 × 30 × 8 pocket.
   - **Exact:** 840000 − 12000 − 4π·3.3²·14 − π·23.5²·14 = 801 794.9075 mm³, to 5e-7.
   - CAM: NOT FOR PRODUCTION; the stock a 210 × 310 × 16 box from B1 with allowance 1; the pocket's feed levels 11, 8, 6 in the +Z setup.
6. **Shaft.** The defaults, the key, and the 6204: refused before its rows ("Load your bearing rows first"), then on step 3 against the start at k5.
   - **Exact:** the bearing's body is 19 800.6522 mm³.
   - Seat note: "k5: 20.002 to 20.011 (the ring's tolerance is not in its row), an estimate". The row's source is cited in the bearing's note.
   - `fit_clearance` H7/k6 at 20: transition, −15 to +19 µm, an estimate.
7. **Cover.** Ø60 × 8, a face gland for 214.
   - Prefills: depth 3.53 · 0.75 = 2.6475 (2.648) and width π · 1.765² / (0.8 h) = 4.6208 (4.621), to 3 decimals.

**Where the S0 was wrong, corrected here (no product change):**
- **The offcut** is 6000 − 2520 − **7** · 2 = 3466. FRb's rule is n − 1 kerfs a bar (nesting.ts), where the S0 had 8 · 2.
- **The seat note** has no "interference −21 to −2 µm": the row has no bore deviation, since D139's NSK source gives none.
- **No weldment process**, so the frame's brief has no process (A9-12).

**Findings: oracles not met, and not asserted yet.**
- **F1. Manufacturing reports include the part's bought elements.**
  - The shaft's cnc-turning report sizes it at "Ø47 × 95 mm along its axis". Ø47 is the 6204's outside; the shaft's largest step is Ø25.
  - The cover's print layers (`print.layers`, G23 A) slice the bought O-ring body too: 45 layers to 8.882 mm with support columns from z 5.352, where the S0 expects 40 layers and no support.
  - The BOM already tells made from bought (`elementLines`, bomCore). DFM, print and CAM do not use it.
  - Proposal: one `madeBodies(doc, bodies)` by the same rule, applied to the manufacturability report, print layers and CAM. It touches cad-model's print and machining modules (this lane) and maybe the GPU lane's Print workspace input.
- **F2. CAM drills every through hole twice,** once in the +Z setup and once in the −Z setup: holes 1–5 in both. The S0 expects one +Z setup.
- **F3. CAM drills the Ø47 bore** as a plunge with the Ø6 tool, which cannot make it. A bore wider than the tool needs a circular pocket, or a refusal that names it.
- **F4. Step 8 needs a placement decision.**
  - With the bearing in the plate's bore (z 320–334), the shaft's step 3 stands 11 mm above the plate (z 345). A cover "on the plate over the bore" would clash with it.
  - Options: (a) the cover on the plate clear of the shaft; (b) a cover with a clearance hole for the shaft; (c) the shaft's step 3 shortened to the bearing's 14, with no groove.

**Verified (T1):** a9-acceptance 1/1 (steps 1–7), tsc, eslint 0 errors. Not run: the full suites.

**Next (the second half), after F1–F4 are decided:** steps 4 and 8–11 — welds, gussets and caps; the assembly and its clean clearance map; the drawings; the BOM and purchase CSV; the outputs; the bundle; reopened identical.

## O160 — F1: a part's process judges what it makes; bought elements stay out of DFM, print layers and CAM (2026-10-23)

**The defect** (A9's F1):
- The shaft's cnc-turning report sized it at "Ø47 × 95": Ø47 is the bought 6204's outside.
- The cover's print layers sliced its bought O-ring: 45 layers with support columns from z 5.352.

The BOM already tells made from bought; manufacturing did not ask.

**The coordinator's decision: one shared filter, by the BOM's rule.**
- **`madeBodies(nodes, bodies)`** (engine/elements.ts) keeps every body except a bought element's. "Bought" is decided by `boughtOf`, the BOM's own rule: the person's override (`bought` on the node), else the kind's default (BOUGHT_BY_DEFAULT: bearing, ring, key, pin, O-ring, spring, belt or chain, a connector's body; a coupling as its row says).
- **Applied at the entry points**, so every caller follows:
  - `printability`, which covers FDM/SLA/SLS/MJF, moulding, casting and machining through it;
  - `machinability`, also called directly by rb9;
  - `camPreview` and `camPackage`, including their stock and safe height;
  - `output_print_layers`. A part whose bodies are all bought is refused there, with `[OUTPUT_EVALUATION]`.
- **The studio's Print workspace** (the GPU lane's viewport/print.worker) builds its own mesh list, so it does not follow by itself. It needs `madeBodies` on its input. The coordinator relays that, and I touched none of their files.

**Oracles** (a9-acceptance, plus the new made-bodies.test):
- the shaft's turning size: "Ø25 × 95 mm along its axis…";
- the cover's print at 0.2: 40 layers, no support, 8 high, as the S0 froze it;
- the shaft's CAM refusal: identical with and without the key and the 6204, and naming the part's 95 × 25 × 25 (milled stock from the block list holds no shaft, so both refuse);
- `madeBodies` directly: the shaft in and its key out; the person setting the key made puts it back.

**F5, found while timing (not this fix):** the A9 shaft's cnc-turning report takes about 50 s at load 40–50. It took 72 s before this change, with the bearing counted. It makes a9-acceptance about a minute long, and a profile is worth doing later.

**Verified (T1):**
- model: made-bodies 1/1, a9-acceptance 1/1, and every model test file using printability, machinability, CAM or print layers (21 files, all passing);
- studio: cnc-preview, cnc-cam, chat, im7, cnc-stock, im8b, mould-undercut, all passing;
- tsc of model and studio; eslint 0 errors.

## O161 — F2: a through hole is drilled once, by the first setup that reaches it (2026-10-23)

**The defect** (A9's F2): the CAM package drilled every through hole in both its +Z and its −Z setup. `camPreview` lists each setup a hole is reachable from (`drillPoints`, one per access direction), and `camPackage` programmed them all.

**The coordinator's rule, built in camPackage:**
- **Setup order** is the order the operations bring the setups in. The pockets come first, so on CNC8's and A9's plates that is +Z.
- **A hole reachable from several setups** is drilled once, in the first of them.
- **Each other setup that has work of its own** records `notes: ["hole1: drilled in the +Z setup, not again here"]`. `SetupProgram.notes` is a new optional field, so cam-package-v1 readers are unaffected.
- **A setup left with no work** is not made at all: A9's plate is one +Z setup.
- **The preview** (`camPreview`, its SVG and the studio's cnc-cam test) still lists every direction a hole is reachable from. That list is about access, not the program.

**The expectation change**, a decision-backed one:
- The old cam-package test "CNC8's holes" pinned the through hole in −Z too.
- It now has three holes: a through Ø6.6, a blind Ø5 from the top, and a blind Ø4 from the bottom, so the −Z setup still exists.
- Each hole is drilled exactly once, and the through and top holes come from +Z, at depths 0 and 10.
- −Z has only the bottom hole, a turned-over frame (axis [0, 0, −1]) and the note naming the through hole. +Z has no notes.

**A9:** the plate's package is the one +Z setup, with its five holes each drilled once. The Ø47 bore is still a drill there, which is F3, next.

**Verified (T1):**
- model: cam-package 4/4, a9-acceptance 1/1, chat-outputs 7/7, cnc-holes 6/6, cnc-features 4/4, cnc-access 4/4;
- studio: cnc-cam 5/5, cnc-preview 8/8;
- tsc of model and studio; eslint 0 errors.

## O162 — the bearing's housing line names its shoulder (the kernel's D181, FRk8a) (2026-10-23)

The kernel lane's D181 (`ec4a4724c`) adds `report.housing.shoulder { at, diameterMM } | null` to `seatedBearing`: the planar annulus at a face of the bearing stepping in from the bore, its diameter the inner edge's. It also adds a warning when the housing has no shoulder at the located side, or at either face.

- **The housing line** (engine/evaluate.ts `bearingNotes`) now reads "In the housing's Ø47 bore against its Ø40 shoulder at the bearing's end; no overlap" when there is a shoulder. With none, it reads as before.
- **The warning** comes through as a warning note, unchanged: it was already in `report.warnings`, which the notes pass on.
- **Tests** (bearing.test):
  - a Ø47 bore over the bearing's 16–30 with a Ø40 lip over 30–34, unioned into one housing body: the line names the Ø40 shoulder at the end, and there is no warning;
  - a plain Ø47 bore: the line without a shoulder, plus the kernel's "the housing has no shoulder at either face of the bearing" as a warning.
- This worktree's `packages/barocss-cad` dist was rebuilt from integration (D181 included) before the tests ran.

**Verified (T1):** bearing 5/5, bearing-housing 4/4, bearing-housing-context 8/8, clearance-designed 5/5; tsc of model and studio; eslint 0 errors.

## O163 — F3: a hole wider than the tool is milled as a circular pocket, never plunged (2026-10-23)

**The defect** (A9's F3): CAM planned the plate's Ø47 bore as a plunge with the Ø6 tool. The package carries one tool, and a plunge of it makes a hole of the tool's diameter. The GPU lane's heightfield cuts every move with that tool, so a "drill" pass already showed Ø6 holes for every hole.

**The rule**, the coordinator's "never a plunge" with "the tool too small for a plunge of that size":
- **A hole up to the tool's diameter** (within 1e-9) is a drill point, as before: plunge and retract.
- **A wider hole** is a circular pocket (`boreAsPocket` in cam.ts, a module-level function), built with the pocket machinery:
  - the floor at the hole's bottom, the plane square to its setup;
  - the outline its circle, drawn as an inscribed polygon whose chord-to-arc gap is ≤ 1e-3 mm, so the cut stays inside;
  - loops inset by R, then by the stepover; levels at the step-down to its depth;
  - the note "Ø47 is wider than the Ø6 tool: milled as a circular pocket, not drilled".
- **Through bores** are listed from both ends by the preview. O161's made-once rule now covers every operation by feature, not only drills, so a bore is milled once and the other setup notes "milled in the +Z setup, not again here".
- **This also covers the Ø6.6 holes with the Ø6 tool:** each is a small circular pass, the loop at r 0.3. A plunge of the Ø6 tool would leave them Ø6. A hole narrower than the tool is still a drill point (it overcuts), as before. A refusal for it is not decided here.
- **No refusal code was needed:** the pocket machinery takes the circle for any hole wider than the tool.

**Tests:**
- cam-package's hole test is now about drills: three Ø4 holes with the Ø4 tool, each plunged once, with F2's notes.
- The new F3 test: a Ø47 through bore and a Ø6 hole with the Ø6 tool, checked in world coordinates:
  - one +Z setup; the bore one circular pocket, never drilled, at levels 3, 6, 9, 12 and 14;
  - every feed within 23.5 − R of the axis, the outermost there to the polygon's 2e-3;
  - feeds from z 11 down to z 0; the Ø6 hole plunged.
- The A9 plate: one +Z setup with six features (the 50 × 30 pocket, the Ø47 bore and the four Ø6.6 holes), each made once and none drilled. The pocket's own feeds are still at levels 11, 8 and 6.
- The studio's cnc-cam CNC8 test, Ø4 tool:
  - the Ø6.6 through hole is a circular pocket listed from +Z (floor z 0) and from −Z (floor z 20); the Ø5 blind one from +Z (floor z 10), each with its note;
  - with a Ø5 tool, the Ø5 hole is a drill point again;
  - the SVG draws the pockets' polygons, and a drill's circle.

**Not run:** the browser flow. The GPU lane's CNC flow step on `cnc8-pocket.bcad` may count drill passes. Its Ø6.6 holes with the default Ø6 tool are now pocket passes, so that flow needs a run, theirs or the window's.

**Verified (T1):**
- model: cam-package 5/5, a9-acceptance 1/1, chat-outputs 7/7, tool-contract 3/3;
- studio: cnc-cam 5/5, cnc-preview 8/8, made-bodies-previews 2/2, chat 18/18;
- tsc of model and studio; eslint 0 errors.

## O164 — O5, second half begun: the weldment (step 4) and the assembly with a clean clearance map (step 8) (2026-10-23)

The A9 run's second test continues the first's state. It is one run on one document, with the brief as O158 corrected it.

**Two brief adjustments, made so the parts fit together:**
- **The plate's holes** sit 10 in from its 300 ends (y 10 and 290), so all four land on the rails. The rails' centres are 300 apart and each rail is 40 wide (z 280–320); 20 in from the ends would miss one rail. The exact volume is unchanged.
- **F4 (b), the coordinator's choice:** the cover has a Ø22 hole round the shaft's end. That is the Ø20 step plus a stated 1 mm a side (`SHAFT_END_MM`, `COVER_CLEARANCE_MM`). The cover still prints in 40 layers with no support.

**4. The weldment:**
- **Gussets:** 4 at the leg tops, each 60 × 60 × 5 clipped 10, with its 360 rail. Each is (60·60 − 10²)/2·5 = 8750 mm³ (FRk1).
- **End caps:** 4 inset caps, 4 thick, in the legs' feet, each 34·34·4 = 4624 mm³.
- **Joints:** 20 — 8 rail ends, 8 gusset seams and 4 caps.
- **A cap's weld** defaults to butt. A fillet record on a cap is refused (the caps' joints are in `refusedJointIds`), the part still evaluates, and the records are removed.
- **Fillets** of 3 mm at the other 16 joints, with bead ownership `{version 1, equal-length}`. Without it, the shared seams are refused (BEAD_SHARED_CONTEXT).
- **Beads:**
  - each rail end is the kernel's `bead-tee-flush` case, 360 mm³ nominal (8 × 360 = 2880, as the S0 froze it);
  - each gusset's 200 mm of seams at leg 3 is 3²/2·200 = 900 mm³;
  - complete: 12 bodies, 6480 mm³ nominal, none refused.

**8. The assembly:**
- **Placed exactly:**
  - the plate at (100, 0, 320), on the rails' top;
  - the shaft at (200, 150, 250), so the bearing's 14 lies in the plate's 14, z 320–334;
  - the cover at (200, 150, 334), on the plate over the bore.
- **A9-7, the 6204 housed in the plate's bore** (another part) through the bearing command with `housing: part:{p1, b9}` and H7:
  - "In the housing's Ø47 bore; no overlap";
  - "Housing seat H7: 47 to 47.025…";
  - D181's warning that the plain bore does not locate the outer ring.
- **The clearance map**, with every contact filled (83 pairs, about 4 s), is clean:
  - no pair overlaps;
  - the designed seats are named: the key in its keyseat, the bearing on its shaft (k5) and in p1/b9 (H7), the O-ring in its gland;
  - the weld beads are designed with their members;
  - the rest touch or are clear;
  - the one near pair is the shaft's end in the cover's hole: 1 mm a side by construction, which the display meshes measure as 0.984 (their chords). It is asserted within 0.02 below 1.

**Findings (not fixed here):**
- **F6. The chat's `edit_feature` cannot set a cross-part housing.**
  - `editFields` gets no assembly context in a part-scoped edit, so its Housing choice is only "none, 0, 1". The bearing command does get the context, through the part draft's view (`bearingPartView`).
  - An agent has to delete the bearing and put it again with the housing, which is what the run does.
  - The fix is in this lane: pass the part draft's bearing context to `editFields` from the edit handler (tools.ts:899).
- **F7. The cap's bead refusal is reported only as ids in this order.**
  - With the fillet records set first and the ownership after, the weld list puts the caps in `refusedJointIds` but gives no `bead.refused` message on the joint.
  - In a scratch probe that set them in another order, the joint carried "[BEAD_KIND] a cap sits flush…".
  - It is a reporting gap: the refusal itself holds.
- **F5 (O160)** is unchanged: the shaft's turning report takes about 50 s, and the run is now about 65 s.

**Still to do in O5:** step 9 (the drawings, one per made part in sequence: the document has one drawing and its scope picks the part), step 10 (the BOM and the purchase CSV), step 11 (the bundle), and reopened identical.

**Verified (T1):** a9-acceptance 2/2 (about 65 s), tsc, eslint 0 errors.

## O165 — O5 done as an automated run: drawings, BOM and CSV, the bundle, reopened the same; F8–F10 left open (2026-10-23)

The A9 run (`test/a9-acceptance.test.ts`) is three tests on one state: steps 1–7 (O159–O160), steps 4 and 8 (O164), and now 9–11 with the reopen. It takes about 185 s at load 30–35; F5's turning report is most of the first test's time.

**9. A drawing per made part.**
- **The model:** a document has one drawing, and a part scope switches its subject. Once a sheet holds model references, switching is refused (DRAWING_SCOPE_REFERENCES). So the weldment is the base's own drawing, and each placed part has its own drawing, set part-scoped.
- **Sequence:** each is set by a proposal the person accepts (`acceptProposal`), then `auto` and `fix` run.
  - The weldment drawing: A3, front/top/right/iso, weld symbols, balloons, and the BOM, cut-list and weld-list tables.
  - The plate, the shaft and the cover: A3 each.
- **Asserted:**
  - each part has its own drawing;
  - the weldment's options are on;
  - **the plate's drawing is clean**;
  - no drawing is short of a fit row.

**10. The BOM and the purchase CSV, through v2.**
- **The CSV** holds exactly the three bought lines:
  - the key: no row, no source, an estimate (A9-11);
  - the 6204 and the 214, each with its row and its D139 source.
- **The made lines' masses** are by material, for example the plate's 801 794.9075 mm³ · 2.7 g/cm³.

**11. The bundle.**
- Refused with no approved baseline (`[OUTPUT_BUNDLE_INCOMPLETE]`).
- A forged user token's approval is refused (APPROVAL_IS_THE_USERS).
- The person approves through review → approved with the user's token. The bundle is then complete and intact, with nothing missing, changed or stale, and its six files.
- `cad-cli`'s fresh-process verify (A7.5's style) is not run here.

**Reopened.** The document is encoded, read again, and gives the same BOM, CSV and clearance map (less the map's run-time `timing`), and a complete, intact bundle.

**Open findings, not asserted:**
- **F8. Drawing issues left after auto and fix:**
  - **Weldment:**
    - TEXT_OVERLAP, an error: the top view's name over weld symbol W1. At A3 1:10 it was TEXT_OVER_LINES.
    - WELD_NOT_SHOWN: 12 welds have no visible edge in front/top/right, against the S0's "none with symbols on".
    - BALLOON_NO_EDGE: BOM line 3.
  - **Shaft:**
    - TEXT_OVERLAP, an error: a note over the front view's name.
    - DIM_ON_HIDDEN ×2: the keyseat's 12.5 and 25, with no section added. O148 X3's fix covers a keyseat, yet `fix` did not add it here.
  - **Cover:** HOLE_NOT_LOCATED reports "4 holes" on a cover with one hole, plus the gland, so it is probably counting the gland's edges.
  - **The sheet sizes** are A4 and A3 only.
- **F9. The four M6 screws cannot be BOM lines.**
  - The `fastener` command builds them from a built-in catalogue (FASTENER_SIZES), which the rows rule would replace with a person's row.
  - No element kind makes a fastener a bought line.
  - Needs a decision: a fastener row kind and element, or the screws left out of A9.
- **F10. The frame's members are not BOM lines** and their mass is not in the BOM.
  - `deriveBom` lists placed parts, plates and elements, but not the base part's own bodies.
  - The S0 expects the members by cut-list row, and Σ volume · density with nothing assumed.

**The owner's acceptance** with a real person-supplied row/fit file stays pending: the rows here are the fixture.

**Verified (T1):** a9-acceptance 3/3 (about 185 s), tsc, eslint 0 errors. Not run: the full suites and any browser flow.

## O166 — a hole narrower than the tool is refused by name, CAM_TOOL_TOO_LARGE, never an overcut drill (2026-10-23)

**The rule**, the owner's ("a typed refusal over a wrong result"), relayed by the coordinator:
- A plunge of the package's tool makes a hole of the tool's diameter. Since O163, a hole wider than the tool is a circular pocket.
- A hole **narrower** than the tool was still a drill point, and it would come out too big without saying so.
- camPackage now refuses that operation, not the package:
  - `refusals: [{ feature, setup, code: 'CAM_TOOL_TOO_LARGE', message: 'Ø5 hole is narrower than the Ø6 tool: a plunge would overcut it' }]`, a new optional field, absent when there is nothing to refuse, so cam-package-v1 readers are unaffected;
  - the setup that would have drilled it notes "hole1: [CAM_TOOL_TOO_LARGE] …";
  - the rest of the program is kept.
- **The preview** (`camPreview`) still lists the hole's drill point, as its access list. The package is what refuses.

**Test** (cam-package, "O166"):
- a Ø5 and a Ø6 blind hole with the Ø6 tool: the Ø5 is refused by its code and message, in +Z with its note, and the Ø6 is still drilled; the linking rule holds;
- with a Ø5 tool there is no `refusals` key at all (the Ø5 is drilled, the Ø6 a pocket).

No studio expectation relied on an overcut drill: cnc-cam tests the preview.

**Verified (T1):** model cam-package 6/6, chat-outputs 7/7, a9-acceptance 3/3; studio cnc-cam 5/5, cnc-preview 8/8, made-bodies-previews 2/2; tsc of model and studio; eslint 0 errors.

## O167 — F6: the chat's edit_feature links an existing bearing to another part's housing (2026-10-23)

**The gap** (A9's F6):
- A part-scoped `edit_feature` called `editFields(nodes, index)` with neither an assembly input nor the part draft's bearing context. Its Housing choice was only the part's own bodies (none, 0, 1), and its seat-class choices were empty, because no fit tables were passed.
- The bearing command already offered the other parts' bodies, through the draft's context (`bearingPartView`). So an agent had to delete a bearing and put it again to link its housing.

**The fix:**
- `editFields` takes an optional fifth argument, `EditScope { context?, fits? }`, used only when no assembly input is given:
  - the housing options come from `bearingHousingOptions(…, context)`, the same as the bearing command's;
  - the seat classes include the draft's fit tables.
- The chat's edit handler (tools.ts) passes `{ context: bearingContextOf(state.doc), fits: state.doc.fits }`. In a part-scoped call, `state.doc` is the part's shop view, carrying its context and its inherited rows.
- The studio's call (App.tsx, with its assembly input) is unchanged.

**Tests:**
- bearing-housing-context, "O167 (F6)":
  - an existing bearing on p2 is linked by `edit_feature {housing: part:{p1, b1}, housingClass: H7}`: `housingRef` set, `housing` unset, the class H7, and the report covered;
  - then cleared with `none`;
  - a housing in a part that does not exist is refused.
- The command path with a housing stays tested in the file's A9-7 test.
- **The A9 run** now edits the bearing it put in step 6, rather than deleting and re-adding it. The bearing keeps its id (n2), and the clearance map names its seats as "bearing n2 …".

**Verified (T1):**
- model: bearing-housing-context 9/9, a9-acceptance 3/3, and every model test file using `edit_feature` or `editFields` (28 files, all passing);
- studio: bearing-edit 7/7, bom-linked-ui 5/5, assembly-linked-faces 5/5;
- tsc of model and studio; eslint 0 errors.

## O168 — F7: a refused bead is said on its joint with placed parts too (2026-10-23)

**The defect** (A9's F7): with placed parts, a fillet on a cap was counted refused (`refusedJointIds`), but its joint in the weld list had no `bead.refused` message.

**The cause:**
- The kernel's bead refusals are kept by key: the bead feature plus the canonical model content of the document evaluated (`refusedBeads` in engine/part.ts).
- The evaluation (`partSnapshot`) keys them on the resolved document, with shop rows resolved into each placed part and skeletons solved.
- `beadRefusal`, which the weld list and the bead accounting use, looked them up on the authored document. Without placed parts the two coincide, which is why a scratch probe saw the message. With placed parts, the inherited rows make them differ, so the lookup missed.

**The fix:**
- `beadRefusal` looks in the evaluated view first: `resolveShopTree`, then `resolveSkeletons`, the evaluation's own steps, cached per document in a WeakMap.
- It then looks in the authored document, where the section and face readers record refusals through `withBeadRetry` directly.
- The refusals and their keys are unchanged.

**Tests:**
- frame-welds, "O168 (F7)": a table frame with one inset cap and a placed part inheriting the base's section row. A fillet on the cap, with bead ownership set, gives `[BEAD_KIND] a cap sits flush…` on the cap's joint and its id in `refusedJointIds`. The test fails without the fix.
- The A9 run asserts the message on each of its four caps' joints.

**Verified (T1):**
- model: frame-welds 6/6, a9-acceptance 3/3, and every model test file on beads or welds (14 files, all passing: bead-ownership-policy, shared-bead*, weld-beads, wire-welds, frk-acceptance, frk5-editor, cnc-drawing, shop-rows, team-input-authority, tool-contract);
- studio: chat, frame, memory, mould-quote;
- tsc of model and studio; eslint 0 errors.

## O169 — F10: an assembly's base part makes things too; its members are BOM lines, and BOM masses are by material (2026-10-23)

**The defect** (A9's F10): `deriveBom` listed the placed parts, plates and elements, but not the base part's own bodies. A9's welded frame, the base, had no member lines, and its mass was missing from the total. The S0 wants the members by cut-list row and Σ volume · density with nothing assumed.

**The coordinator's decision:**
- An assembly's base part's made bodies are BOM lines.
- Frame members merge by cut-list row (section, length, material).
- The mass is Σ volume · density.
- This is a correction, not a contract break: the BOM is derived, and nothing saved changes.

**Built** (team/bomCore.ts, team/assembly.ts):
- **The view's new optional `base`**, only for a document with placed parts:
  - its members by the cut-list rows of its made bodies (`madeBodies`, then `partCutList`): item, section, long-point length, material, pieces, mass;
  - its other made bodies (neither members nor elements), one each;
  - the base part's whole mass, as a placed part's is counted.
- **Lines:**
  - each member row is a line "rect-tube 40 × 40 × 3 × 320", qty its pieces, `parts` `base:<body>`, `member {section, lengthMM}`, after the parts and before the plates;
  - each other base body is its own line.
- **`totalMassG`** adds the base part's mass. `totalQty` stays the number of placed parts.
- **`checkBom`** checks the base lines:
  - each member piece on its row's line exactly once, with that row's section, length and material;
  - each other base body on one line;
  - the total mass with the base included.
- **A single part** (no placed parts) is unchanged: it is its own one line, "this part" (bom.ts), so its bodies are not listed twice.

**Found while building it — BOM masses were the default material's.**
- A body's own `massG` is the default material's density (aluminium), whatever the person set, so four steel gussets weighed 94.5 g, at 2.7.
- BOM masses now come from the exact volume times the body's material density (`exactMass`) for the members, other base bodies and plates. A single part's base mass uses `massProperties`, as a placed part's always did.
- No existing test had pinned a plate's mass in a material other than the default, so no expectation changes for it.

**Expectations changed**, each justified:
- The A9 run, step 10, now asserts:
  - the three member lines: [320 × 4, 360 × 2, 260 × 2], steel, each n · A · L · 7.85e-3;
  - the plates by steel: 4 × 8750 · 7.85e-3 and 4 × 4624 · 7.85e-3;
  - the total above the parts plus the members (the plates and beads too).
- Its comment no longer lists F10 as open.
- No other model or studio test changed: none had base-part bodies in an assembly.

**New test** (bom-base.test):
- a frame base with one placed plate: the member lines by row in steel, `checkBom` clean, the total the plate plus the base, `totalQty` 1;
- a single frame part: its one line, weighed in steel, not aluminium.

**Verified (T1):**
- model: bom-base 2/2, a9-acceptance 3/3, and every model test file on the BOM, baseline or mass, all passing;
- studio: bom-linked-ui, chat, made-bodies-previews, mould-quote, team-bundle;
- tsc of model and studio; eslint 0 errors.

## O170 — F8, first error: one Fix leaves the sheet fixed, with the sheet built again after each round (2026-10-23)

**The defect:**
- On the A9 shaft (the defaults, the key, the 6204), after `auto` and one `fix`, there was a TEXT_OVERLAP error: a dimension over the key's note (in A9, over a view's name).
- A second `fix` cleared it.
- **Cause:** that Fix adds the keyseat's section B (O148 X3's fix) and re-dimensions. The new section is a new view to lay out. `fixAll` ran on inputs built before it started, so the section's view and the overlap it brings were invisible to the same pass.

**The fix** (chat/drawing.ts, `fix_drawing`):
- After a round of `fixAll`, the inputs are built again from the fixed settings (`drawingInputs`), and the fixes run again, until a round applies none (`FIX_ROUNDS`, 4).
- The answer's issue list is the sheet as built after the fixes, the same as asking for the issues again.
- **The studio's Fix all** (DrawingWorkspace, its sections from `useDrawingSheet`) still does one round: its section geometry follows the settings asynchronously, so a second press finishes it. That is left as a follow-up, because the hook now feeds the GPU lane's 3D annotations.

**Test** (drawing-fix-rounds):
- on the shaft, one Fix adds the section and leaves no error and no TEXT_OVERLAP;
- its reported issues equal a fresh `issues` call;
- a second Fix applies nothing.

**Still open in F8** (the A9 run, after this):
- **Weldment**, A3, four views, symbols, balloons and three tables: two TEXT_OVER_LINES errors without a fix — a dimension "3" over lines, and the top view's name pushed into the next view by the dimensions under it.
  - Auto layout's room counts only dimensions: not weld symbols, tables or balloons. At A3, the largest sheet, its scale search finds no clean layout.
  - At an explicit 1:10, it becomes a TEXT_OVERLAP between the top view's name and weld symbol W1, again with no fix, because names and weld symbols are not movers.
- **Shaft:** DIM_ON_HIDDEN ×2, now on two dimensions besides the one X3's section serves.
- **Cover:** HOLE_NOT_LOCATED counts 4.
- **Weldment:** BALLOON_NO_EDGE, WELD_NOT_SHOWN.

**Verified (T1):** drawing-fix-rounds 1/1; chat-drawing 4/4, drawing-issues 9/9, drawing-scope 8/8, frame-acceptance 2/2, frame-weld-symbols 3/3, tool-contract 3/3, toolset 9/9; a9-acceptance 3/3 (the shaft's drawing now has no error); tsc of model and studio; eslint 0 errors.

## O171 — F8, second error: a frame member's bore gives no levels; the weldment's drawing has no error (2026-10-23)

**The defect:**
- A9's welded table frame drawing (A3, four views asked, weld symbols, balloons, the BOM, cut-list and weld-list tables), after `auto` and `fix`, kept two TEXT_OVER_LINES errors with no fix: a dimension "3" over lines, and the top view's name pushed into the next view by the dimensions under it.
- **Cause:** at every member end, Auto-dimension took the tube's bore edges as levels: they are visible looking into the open end. So it gave a 3 and a 37 (the wall, and the bore's other side) at each, 19 dimensions in all.
- Those crowded the sheet past its room. The layout's scale search then found no readable clean scale at A3 and kept the attempt with the fewest errors.

**The fix** (drawing/auto.ts `levels`):
- A frame member's bore, a face named `n<frame>.m<member>.bore…`, gives no levels. Its wall is its section's, said in the cut list and in the section's callout.
- Gears' and pulleys' `.bore` faces are not frame members and are unchanged.
- `levels` also serves the view choice and STEP_NOT_LOCATED, which therefore no longer ask for those levels either.

**Result:**
- The frame gets 11 dimensions (the overall 400, 300 and 320, the rails' 40s, 340, 440 and the levels of the gussets and caps).
- Auto finds a readable 1:10 on A3, and Fix has nothing to do.
- What is left is the two warnings, BALLOON_NO_EDGE and WELD_NOT_SHOWN, which are F8's next items.

**Tests:**
- weldment-drawing, "O171": that frame with a placed plate. After `auto` and one `fix`, there is no error, no dimension to a member's bore, and the overall 400, 300 and 320 are given. The test fails without the fix.
- The A9 run's step 9 now asserts the S0's oracle: no error on any of the four drawings.

**Verified (T1):**
- model: weldment-drawing 1/1, a9-acceptance 3/3, and every model test file on auto-dimension, auto layout, drawing issues or frames, all passing;
- studio: every test file on drawings, auto or frames, all passing;
- tsc of model and studio; eslint 0 errors.

## O172 — F8: Fix keeps the keyseat's dimension; a snap point is a visible edge's; the shaft's DIM_ON_HIDDEN found to be the bought bearing's (2026-10-23)

**The coordinator's question:** why didn't O148 X3's section serve the shaft's two DIM_ON_HIDDEN?
- **Answer:** they are not the keyseat's.
  - Dimension 12.5 runs from the Ø25 shoulder to the end chamfer's centre, and dimension 25 across the Ø25 shoulder, both in the top view.
  - From the top, both Ø25 shoulder circles (z 30 and z 70) are hidden by the **bought 6204** on step 3 (z 70–84), whose ring covers radius 10 to 23.5.
  - X3's section is the keyseat's. These two are hidden because the part's drawing is projected with its bought elements in it.
- **The same cause** makes the issue list count a bought bearing's bore and an O-ring's circles as holes: the shaft's "5 holes" and the cover's "4 holes" (HOLE_NOT_LOCATED and HOLE_SIZE_MISSING). Auto-dimension cannot meet those.
- **The fix that would end all of it:** a part's drawing views projected from what it makes, by the BOM's `boughtOf` (`madeBodies`, as O160 did for DFM, print and CAM). It changes every drawing with elements, in two places: the chat's `drawingInputs` and the studio's `useDrawingSheet`, which now feeds the GPU lane's 3D annotations. **It goes to the coordinator for a decision; not built here.**

**What is built, three defects found on the way:**
- **Fix's Auto-dimension had no elements.**
  - In `applyFix`, the `auto-dimension` fix called `autoDimensions(…, [] , …)`, so O146's keyseat and keyway plans were lost. A Fix that re-dimensioned dropped the keyseat's d − t1 instead of putting it on its section, the very thing X3's message promises.
  - It now passes the context's elements (issues.ts).
- **A snap point was the first edge found at a place,** hidden or not (dimensions.ts `snapPoints`). Where edges coincide on the view, it is now a visible edge's when one is: a module-level `addSnap`, with no closure per point.
- **Fix's rounds** (O170) re-dimensioned every round, with Auto-dimension and the moves undoing each other on issues it cannot meet (the bought holes above). A later round now re-dimensions only after the round before added a section. On the shaft that is 2 re-dimensions, not 4.

**Tests** (drawing-fix-elements):
- one Fix on the shaft adds section B, re-dimensions twice, leaves the keyseat's dimension on section B–B, and leaves no error;
- a synthetic view with a hidden and a visible edge at one place: the snap point is the visible one's, in either order.
- Both fail on the code before.

**Verified (T1):**
- model: drawing-fix-elements 2/2, a9-acceptance 3/3, and every model test file on drawings or dimensions, all passing;
- studio: every test file on drawings or dimensions, all passing;
- tsc of model and studio; eslint 0 errors.

**Still open in F8:**
- **The decision above.** It would end the shaft's DIM_ON_HIDDEN and the cover's hole count.
- **BALLOON_NO_EDGE** (the weldment's BOM line 3).
- **WELD_NOT_SHOWN** (12 welds with no visible edge in front, top and right).

## O173 — F8: every weld has its symbol; BALLOON_NO_EDGE on the end caps is right (2026-10-23)

**WELD_NOT_SHOWN.** A9's frame drawing said 12 welds had no visible edge in front, top or right, so they got no symbol. Two misreadings in `seamEdge` (drawing/welds.ts), which finds a joint's seam edge by its end face's name:
- **A trimmed end face comes in pieces:** the projection names them `n0_env1#1` and `n0_env1#2`. The seam's face is `n0_env1`, and the names were compared exactly, so every rail end that butts a leg had no seam in any view. A piece is now the face's (`onFace`, stripping `#n`).
- **An edge with no pieces lies wholly on visible ink,** by BrepProjection's contract: it coincides with a visible line another edge draws. It was read as unseen. It is now visible.
- **Stability:** an arrow still follows its seam by name through an edit (FRd2). The seam edge is chosen with an edge drawn in its own visible pieces before one only on another's ink, then the longer, then by name.

**BALLOON_NO_EDGE stays, by design.** On the weldment it is BOM line 3, the end caps: inset plugs inside the legs' feet, with no visible edge from the iso view's side. The warning says so, and the BOM table lists them.

**Expectation changed** (frame-weld-symbols, FRd2's own test):
- It pinned W8 and W13–W16 as unshown, "behind other members". By the projection's contract they were not hidden: their seams lie on another member's visible outline, as edges with no pieces.
- All 16 joints are now shown, and WELD_NOT_SHOWN is not raised.
- Its `onEdge` helper accepts an edge on ink as visible and a pieced face name as the face's.
- The edit-follow test still holds, the same edge before and after, by the selection order above.

**Tests:**
- weldment-drawing (O171's) now also asserts all 20 welds placed, none unshown, and the one issue left BALLOON_NO_EDGE;
- frame-weld-symbols 3/3.

**Verified (T1):**
- model: every test file on drawings or welds, all passing; a9-acceptance 3/3;
- studio: every test file on drawings or welds, all passing;
- tsc of model and studio; eslint 0 errors.

**F8 now:** the weldment drawing has only BALLOON_NO_EDGE (correct). The shaft's DIM_ON_HIDDEN and the cover's hole count wait on the coordinator's decision (O172: a part's views without its bought elements). The A4/A3-only limit is recorded.

## O174 — F8: a part's drawing is projected from what it makes (2026-10-23)

**Decision (the coordinator's, on O172's question).** A part's drawing documents what the part makes. Its bought elements (the BOM's `boughtOf`: keys, pins, bearings, O-rings, unless the person sets `bought: false`) are left out of its views and its sections, as DFM, print and CAM leave them (O160). An assembly-scope drawing keeps its bought parts. No phantom display of bought elements for now; that stays a possible later option.

**Where:**
- `brepsFor(doc, { made })` (engine/evaluate) drops the outputs `boughtOutputIds` names, falling back to every output if none would remain; instances unchanged.
- `sectionsCut(…, made)` (drawing/section) neither cuts nor draws them.
- The chat's `drawingInputs` and the studio (`useDrawingSheet` → `engine.drawing({ made })` → the worker) both pass `made` when the scope is not `assembly`. useDrawingSheet's change was agreed with the coordinator (the GPU lane reads that hook).

**Two follow-ons the change exposed:**
- **A round outline locates what is on its centre** (drawing/issues `coverage`). A view whose extents equal a circle's diameter (a shaft or cover seen end on) locates every circle concentric with it: there is no edge to measure from. The extents are of the flattened curves, so the match is to `OUTLINE_REL` = 1e-4 of the diameter (24.9998 against 25). An off-centre hole is still HOLE_NOT_LOCATED until dimensioned.
- **Fix keeps its best round.** With the bearing gone, a Fix round can make what the next one clears (a section's view), and a later round can undo an earlier one. The rounds run as before (O170, O172); the sheet with the fewest errors, then the fewest warnings, is kept only when better than the start. A second Fix applies nothing (idempotent).

**Expectations changed, by class:**
- **Bought elements' edges are no longer projected** in a part's views. The shaft's Ø25 shoulders had been hidden behind the bearing (DIM_ON_HIDDEN).
- **Hole counts exclude bought bores and rings:** the bearing's bore and the O-ring's circles had counted as the part's holes.
- **Leader notes to bought elements are dropped** (element-callouts): with the key and pin bought, no note; set made (`bought: false`), both notes as before.
- **Bought keys are not cut in sections** (section-dimensions): 2 bodies cut with the key bought, 3 with it made, each hatched at its own angle as before.

**Tests** (drawing-made-views, new):
- the shaft with key and bearing: no edge of n1/n2 in front, top or right; after Auto-dimension and Fix, no issue; `brepsFor` gives 1 B-rep made, 3 for an assembly's drawing;
- the cover: its Ø22 bore and gland concentric with the round outline are located by it, the O-ring not drawn, no issue; an off-centre Ø4 is still HOLE_NOT_LOCATED.

**Verified (T1):**
- model: drawing-made-views 2/2, and the 27 model test files on drawings, sections, welds or dimensions, a9-acceptance 3/3 among them, all passing;
- studio: pmi 3/3, section-cutout 2/2, section-hatch 3/3, section-planes 4/4, section-view 5/5, bom-linked-ui 5/5;
- tsc of model and studio; eslint 0 errors on the changed files.
- Not run: the flow (its slot is still pending, with the uncommitted rows-file steps).

**F8 now:** the shaft and the cover drawings have no issue; the weldment's only issue is BALLOON_NO_EDGE (correct, O173).

## O175 — the studio's Fix all runs the chat's rounds; a part's sheet with balloons draws its bought items (2026-10-23)

**Fix all's rounds in the studio.** The chat's fix_drawing builds the sheet again after each round (O170), re-dimensions only after a section was added (O172) and keeps its best round (O174). The studio's Fix all ran one fixAll pass: on the default shaft and its key it added the keyseat's section B and stopped, and the section's view still had DIM_ON_HIDDEN, so it took a second click.
- **The rounds are one function now,** `fixRound` in drawing/issues (with `fixRoundsStart`, `fixRoundsOutcome`, `fixScore` and `FIX_ROUNDS`). Each call scores the sheet the last round's settings built, keeps the best, and runs the next fixAll. It hands back `next`, the settings to build and come back with, or the outcome.
- **The chat** runs the rounds in one call, building each `next` with drawingInputs (its behaviour unchanged).
- **The studio** (DrawingWorkspace only; no hook change) commits each `next` and waits until the worker has cut every section the settings list. Then it runs the next round on the sheet with that view. The rounds stop if the settings change from elsewhere or the projection fails (the best so far kept). The toast comes at the end, with the best sheet's issues.
- **Limit:** each round is its own undo step (App's `commitDrawing` pushes one per change). Undoing a Fix takes as many steps as it had rounds.

**A part's sheet with balloons draws its bought items** (`drawsMadeOnly` in drawing/scope; the chat's drawingInputs and useDrawingSheet both use it). O174 left them out of every part-scope sheet. A balloon points at its BOM line's item, a bought key too, so on the flow's BOM-table-and-balloons sheet (a part scope since its first change) balloon 2 had no edge. With balloons on, the sheet is drawn from every body, as an assembly's is.

**Tests:**
- drawing-fix-rounds, new: Fix all driven round by round as the studio does reaches the chat's settings with no error. One pass alone adds the section and leaves more (the studio before).
- drawing-made-views, new: a part sheet with balloons draws the bought key, balloons 1 and 2 on their items, none without an edge. Without balloons, the key is not drawn. It fails without `drawsMadeOnly`.
- Flow, uncommitted until its slot:
  - a new step `O175 Fix all rounds`: the shaft and its bought key, Auto-dimension, one Fix all; section B, no issue, no Fix all button left, no note on the key;
  - O145's element-notes step sets the key made in the BOM first, since a bought key is not drawn (O174);
  - CNC7b's `fs` import moved from CNC2, where the earlier edit had put it (lint).

**Verified (T1):**
- model: the drawing test files listed in the commit, a9-acceptance 3/3 among them, all passing;
- tsc of model and studio; eslint 0 errors on the changed files.
- Not run: the flow (its slot is pending with the rows-file steps and these).

## O176 — F9: a placed fastener is a bought BOM line, named by the person's fastener row (2026-10-23)

**The gap (O165's F9).** A9's four M6 screws could not be BOM lines. The fastener command builds plain extrudes and unions from its own catalogue (FASTENER_SIZES), and no element kind or row made a fastener bought.

**What is new (cad-model only, no kernel change):**
- **A row kind `fasteners`** (engine/fastenerRows), loaded only from a file the person supplied (`features.load_rows`, rows rule b; an agent-written row is ROWS_NOT_FROM_PERSON). A row has:
  - `id`, `kind` (hex-bolt, socket-screw, csk-screw, hex-nut, washer), `size` ("M6");
  - `lengthMM` for a screw or bolt and none for a nut or washer;
  - optional `designation`, `partNumber`, `supplier`;
  - `source` or `estimate: true`, never both, never neither; unknown fields refused.
  - It is stored as `doc.fasteners`, a new document field (additive: saved documents keep resolving). It is carried by the wire form and the receipts (`rowEntries`), and checked in fields.test's full document.
- **A fastener placed as a part of its own** (the command's `insert: 'instance'`, whose last node is `made` by the fastener command) is a bought BOM line (bomCore `fastenerOfPart`):
  - merged over its copies by shape and material, as parts are: 4 equal screws, one line ×4;
  - named by the row of its kind, size and length (1e-6 mm): its designation, row id, source, and catalogue (part number, supplier);
  - with no such row, the line is an estimate and says what is missing ("no fastener row for socket-screw M6 × 20: what is bought is an estimate"), so the person knows which file to supply; an estimate row says so too;
  - in the purchase list (kind `fastener`), its mass in the parts' as before;
  - checkBom checks each fastener line's parts are placed fasteners with the line's size and row, an estimate said.
- **Balloons and the BOM table** treat a fastener line as a part line (its parts are placed parts, not `part:feature`): its balloon goes on a screw's edge, and the table says bought.
- **The studio's BOM panel** shows a fastener line as "bought part", with no bought/made choice: the choice sets `bought` on a part's feature, and a placed fastener is a part.

**Not in this step, said:**
- A fastener built into a part (`insert: 'part'`) stays the part's bodies, not a bought line.
- The screws' shape still comes from FASTENER_SIZES. That table is a built-in catalogue, the owner's open item: untouched, a row names what is bought, not how it is drawn.
- The rails under A9's plate have no tapped holes: the screws' shanks enter the rails' walls (the clearance map's step 8 runs before they are placed).

**Found, not fixed here:** on an assembly sheet with balloons, a base part's own made-body line (O169's `base:<body>`, e.g. a plain plate as the base) has no edge: `targetOf` reads `base:b1` as an instance id. Members' lines take the same path. A follow-up: a body key is not a face name, so the target needs the body's node.

**The v2 contract:** no action was added or changed, so tools-v2.json is unchanged. `load_rows`' kind enum takes ROW_KINDS, and its description names `fasteners` in one clause. Per turn: 23,198 of 25,000 characters.

**A9:** conformance/a9/rows/fasteners.json (SCS-M6x20, a fixture standing in for the person's file, its source naming the fixture) is loaded in step 10. Four socket-screw M6 × 20 are then placed through the plate's Ø6.6 holes (z 334). The BOM's bought lines are fastener ×4 (SCS-M6x20, not an estimate), key, 6204 and 214. The CSV has 4 bought lines, the screws first. The S0's "4 M6 screws" is met.

**Tests:**
- bom-fasteners, new:
  - four placed screws with no row: one line ×4, an estimate with its reason, in the CSV, checkBom clean;
  - the person's row: the line named by it, no estimate; an agent's rows refused; a row of another length not this screw's;
  - the row checks.
- bom-fasteners also: on the assembly's sheet with balloons, the screws' balloon is on an `instN/` edge, and the BOM table says bought.
- a9-acceptance's step 10 as above.

**Verified (T1):**
- model: bom-fasteners 4/4, a9-acceptance 3/3, and bom-balloons, bom-base, bom-panel, editFields, fields, migrate, person-rows, ring-rows, shop-rows, team-assembly, team-baseline, wire-doc, toolset, tool-contract, fasteners, drawing-table, chat-drawing and standards, all passing;
- studio: bom-linked-ui 5/5;
- tsc of model and studio; eslint 0 errors on the changed files.
- Not run: the flow (the BOM panel's fastener line is in no flow step yet).

**O175's flow (the coordinator's slot, before this step).** The runs were from detached scratch worktrees on port 52391, load 1m 9–16.
- At `5eb851d3e`, the rows-file steps, A9-11, the BOM panel, BOM table and balloons, element notes, CNC7b and IM8a passed.
- Two steps failed there:
  - **The new O175 step:** Auto-dimension's turned projection and Turn the drawing (DrawingWorkspace's two other `engine.drawing` calls) had no `made`, so the bought key got a leader note. Fixed in `d89a1cd75`; the step passes.
  - **FRb's cut-list step:** alone under FLOW_ONLY, it found no member selected, so "Show the cut list" never appeared. It now selects one (`b679cff88`) and passes.

## O177 — the base part's own BOM lines get their balloons (2026-10-23)

**The defect (found in O176, the coordinator's order to fix).** On an assembly's sheet with balloons, the base part's own BOM lines (O169) had no balloon:
- a frame member's cut-list row;
- a made body of the base's own (a plain plate as the base).
Their parts are `base:<body key>`; `targetOf` read that whole string as an instance id, which no edge has, and the line went to BALLOON_NO_EDGE.

**The fix.**
- A body key is not a face name: `b0_part3` is a member whose faces are `n0.m3.…`, and a holed plate `b2` has faces of n1 and n2. So the balloon now gets the base part's face names by body key, `bodyFaces`, on the sheet's meta.
  - In the chat, `baseBodyFaces(doc)` (engine/evaluate) reads them from the snapshot's B-reps.
  - In the studio, `bodyFacesOf(bodies)` (drawing/balloons) reads them from the bodies' display meshes.
  - Either is computed only for a sheet with balloons.
- A `base:<key>` line's target is an edge whose faces are all that body's (piece suffixes `#n` stripped). It takes the longest visible piece, as before. Each body's face set is built once a sheet, and the check is a module-level function (no closure per edge).
- useDrawingSheet gains one output, `bodyFaces`; nothing else in the hook changed (named to the coordinator). DrawingWorkspace passes it in its five sheet metas: accept all, Fix all, Auto-dimension, and the two drag previews.

**Tests:**
- balloons-base, new: a frame (members 320 ×4, 360 ×2, 260 ×2), a block of the base's own and a placed plate, on an assembly sheet with balloons:
  - each member row's balloon on one of its own pieces' edges (`n0.m<k>.`);
  - the block's on its own faces;
  - the plate's on `p1/`;
  - none without an edge, a balloon per line.
- bom-fasteners: the base plate's line now has its balloon too (noEdge was [2]).

**Verified (T1):**
- model: balloons-base 1/1, bom-fasteners 4/4, and bom-balloons, bom-base, weldment-drawing, drawing-made-views, drawing, drawing-issues, drawing-table, drawing-scope, chat-drawing, frame-weld-symbols, all passing;
- a9-acceptance 3/3, though the run took far longer than its usual 3 minutes: the machine's load was 48 from other runs, and its process was stopped by hand after its summary. A timed rerun is pending.
- tsc of model and studio; eslint 0 errors on the changed files.
- Not run: the flow.

## O178 — O6: aligned sections for off-axis features (2026-10-23)

**The item (the coordinator's: build it).** A feature whose axis runs along none of X, Y and Z, such as a keyway in a tilted bore, had no section to show it. X3 (O148) said so: "an aligned section is not drawn yet". Its dimensions stayed on hidden lines (DIM_ON_HIDDEN) with no fix.

**What is new:**
- **`DrawingSection.dir`** (optional): the section plane's own normal, in model axes and any length. `at` is along it (the plane is dot(p, dir/|dir|) = at, the far side kept). The section is laid out as `view`'s sections are.
  - Principal sections are unchanged, with no `dir`.
  - Saved and read back with its direction (`readDrawing`); `drawing.options` validates it (three finite numbers, not all zero).
  - `withSections` never folds an aligned A into the old `section` field.
  - Sections compare by letter, view, place and direction (`sameSection`): in options' reference check, the sheet's extents, and the studio's cut filter and Fix-all settle check. useDrawingSheet's outputs are unchanged.
- **`sectionFrame`** (drawing/views): a section's unit depth, its principal axis (none for an aligned one), and the view it is seen in. An aligned section looks along its normal, with its view's up made square to it.
- **The cut** (`sectionOf`, its new last argument `dir`):
  - The kernel's split takes the plane's `normal`; a principal section keeps its axis split exactly as before.
  - The cut faces' rings come from `planeRings`, on the general plane. `cutRings` is now that function on a principal axis, the same arithmetic.
- **The cutting plane** (sheet): in the first shown view whose depth is square to the normal, a line across the view, padded past the part and clipped to the box. Its arrows point along the normal as seen there, the letter by each end.
- **The fix** (issues `sectionFor`): an off-axis keyway's dimension now offers `add-section` with `dir`:
  - the plane square to the axis through the keyway's middle;
  - its view the principal one whose depth lies nearest the axis, the normal turned to that depth's side;
  - once that section is there, the issue's fix is Auto-dimension.
- **Turning the front** (reorient) keeps an aligned section as it is: its plane is the model's own.

**Not in this step:** no studio control to type a direction. An aligned section comes from its issue's fix (Fix, Fix all) or from the chat's `drawing.options`.

**Expectation changed:** X3's test (O148) said "no section offered" for the tilted keyway. That was the gap this item closes, so the test is replaced by O178's.

**Test** (section-dimensions, O178): a keyway in a bore tilted 30° about X.
- The fix is an aligned section with dir ∥ the bore's axis (top's side, −Z), laid out as the top's.
- It cuts with rings, and the projection's depth is the normal.
- Its cutting plane is in the right view with the letter twice; its view is hatched.
- In the SVG and the PDF, and the sheet's and the section's DXF (HATCH).
- Read back with `dir`; then the issue's fix is Auto-dimension.

**Verified (T1):**
- model: section-dimensions 8/8, and sections, reorient, dxf, frame-sections, frk3-section-tables, drawing, drawing-issues, drawing-fix-rounds, drawing-fix-elements, chat-drawing, drawing-scope, auto-dimension, toolset (23,198 of 25,000, unchanged), tool-contract and balloons-base, all passing;
- a9-acceptance 3/3 in 161 s at load 13. O177's slow run (about 50 min) was the load of 48, not a regression.
- studio: section-cutout, section-hatch, section-planes, section-view and pmi, all passing;
- tsc of model and studio; eslint 0 errors on the changed files.
- Not run: the flow (no step makes an aligned section yet).

## R3a — chat/tools.ts by action group, first step: the shared kit, query and image (2026-10-23)

**Phase R, R3 (the coordinator's plan, approved).** chat/tools.ts was 1,699 lines; 540 of them one switch of 37 v1 handlers. It is split by v2 action group, behaviour-preserving only, in five checkpoints (R3a–R3e).
- **The facade.** chat/tools.ts stays a file (the package exports `./*` → `./src/*.ts`).
  - It keeps runTool, dispatchTool and the dispatch.
  - It re-exports every name that moved, so `@barocss/cad-model/chat/tools` and every relative import resolve as before.
- **Modules** go in `chat/part/`, one per v2 group. The shared kit is `chat/toolKit.ts`.
- **No cycle:** a handler that calls tools again gets the runner as its `run` argument; no module imports tools.ts.

**R3a moved, verbatim (code text unchanged; only indentation and the function around a case's body):**
- **chat/toolKit.ts:**
  - the ChatState, Evaluate and ToolOutcome types, and the new PartRun and PartHandler;
  - the per-call flags, now `export let responseFormat` and `because`, set by `setCall(args)` as runPartTool starts. Importers read the live bindings unchanged;
  - r3, v3, json, describeBodies, features, CHECKPOINTS, DETAIL_LIMIT, accept, fail, checkValues, isObj, strings, list.
- **chat/part/query.ts:** get_part_summary, measure, weld_list, fit_clearance, mass_properties, interference, section, wall_thickness and draft, plus fitView.
  - wall_thickness and draft shared one case that read `name`: it is one hoisted `wallThicknessOrDraft(name, …)` and two module-level handlers.
- **chat/part/image.ts:** get_image_layers, extrude_image_layer, inflate_image_layer and the trace geometry (traceOf … surfaceAt, INFLATE, BUMP, layerSketches).
- **tools.ts** is 1,309 lines.
  - `PART_HANDLERS` is a module-level const of hoisted functions, built once.
  - It is looked up with `Object.hasOwn` before the remaining switch, after the drawing tools, as the cases were.
  - It re-exports describeBodies, ChatState, Evaluate, ToolOutcome, INFLATE, layerSketches and surfaceAt.

**The byte check** (a scratch snapshot, never committed): TOOLS as JSON, SYSTEM_PROMPT, the v2 tools list and prompt, `describe` of every group, action, command and feature kind, the mutator and argument tables, and three refusals (468 KB). It reproduced identically twice before the move, and is identical after it.

**Seams and proposals left by R3a:**
- **The per-call flags.** `export let responseFormat/because` with `setCall(args)` keeps the flow identical and writes them in one place. They are still module state set on every call. This is the seam for the later step that carries them in the call context instead (the survey's item 6), when that step can keep the per-call flow the same.
- **A proposal for the coordinator, not made here:** the package runner `scripts/test.mjs` passes no concurrency to `node --test`. The one-line change would be to pass `--test-concurrency=${process.env.TEST_CONCURRENCY}` when that variable is set. Until then, R checkpoints run the suite through an uncommitted scratch copy with `--test-concurrency=4`.

**Verified (R3a):**
- the byte check, identical;
- toolset 9/9 (23,198 of 25,000, unchanged) and tool-contract 3/3;
- the cad-model suite at --test-concurrency=4: 960 of 960 pass, in 378 s. LOADED: it started at load 36 and the kernel lane's suite took the load to 105 during it.
- tsc of model and studio; eslint 0 errors on the changed files.
- Not run: the flow (no studio change).

## O179 — a volume found from the mesh says so: volume_basis, the BOM's and the quote's estimate (2026-10-23)

**The finding (the kernel lane's, relayed by the coordinator; the kernel's D200, `69122b44b`).** When the quadrature cannot integrate a curved body, the kernel's mass falls back to the mesh. D200 gives that result `method: 'tessellated'` and `volumeBoundMM3`: the volume's change from a mesh of half the segments, about three times the error. cad-model dropped both, and its mass_properties, BOM and quote showed such a volume and mass as exact. Area already carried `area_basis`.

**What is new:**
- **The body:** `BodyResult.volumeBasis` (`{ method: 'tessellated', boundMM3 }`), set by `bodyOf` from the kernel's result through `volumeBasisOf` (engine/evaluate). An exact method (quadrature, planar, closed form) leaves it out, so every exact body is as before.
- **mass_properties:** `volume_basis: { method, bound_mm3, mass_bound_g, note }` beside volume and mass, the way `area_basis` stands beside area. The mass's bound is the volume's times the body's density. `massBoundOf(doc, bodies)` sums it (null when a tessellated body has no bound).
- **The BOM:**
  - a placed part, a base member row or a base body whose mass is partly from the mesh has `massBoundG` and its line is an estimate (merged copies add their bounds; null stays unknown);
  - the BOM gains `totalMassBoundG` when any of its total is from the mesh;
  - a part with no placed parts (its own line) too.
  - All of it is additive: a BOM with no tessellated body is byte for byte as before, so approved baselines stay valid.
- **The quote request** (mould/quote): its part gains an additive `volumeBasis` (volume and mass bounds), and the page's part line says "an estimate from the mesh: ± … mm³, ± … g".

**Two studio edits (the coordinator approved both, in O179):**
- **App.tsx, the body panel** (one additive JSX line at 2581–2582, right after the Volume line at 2580): a volume from the mesh shows "From the mesh ± … mm³", in the warning colour, with a title saying the volume, mass and centre of mass are from the display mesh. The R1 split of App.tsx should keep it beside Volume.
- **viewport/sectionView.ts `mergeBodies`** (the GPU lane's file; the coordinator told them):
  - The coordinator asked for `volumeBasis` to be dropped there, as areaBasis is. I changed that, and say so: the merged volume is the pieces' sum and stays on the body, so dropping the basis would show a partly-mesh volume as exact.
  - The first piece's own basis is dropped. The merged body gets `{ method: 'tessellated', boundMM3: Σ }` when any piece's is from the mesh (null if one's bound is unknown), and none when all are exact.
  - Studio test volume-basis-merge, new: none / one / two / unknown.

**Tests** (volume-basis, new; built on the kernel's own tessellated result, `brepMassProperties(…, { quadratureSegments: 0 })` on a ball r 4, and on that ball's body as the fallback gives it):
- the method and bound kept, the exact 4/3 π r³ within the bound; the ball as evaluated (quadrature) carries none;
- mass_properties: volume_basis with the volume's and the mass's bound (aluminium 2.7); nothing for an exact body;
- the BOM: the ball's line an estimate with its bound, the plate's line as before, the total's bound; none when nothing is from the mesh;
- the quote: quote.json's `volumeBasis` and the page's estimate text; none when exact.

**Verified (T1):**
- cad-model suite at --test-concurrency=4: 964 of 964 (the 960 of R3a, plus volume-basis's 4), 291 s, at load 40 → 21;
- studio volume-basis-merge 1/1; tsc of model and studio; eslint 0 errors on the changed files (App.tsx and sectionView.ts among them).
- Flow at `d803fa40f`, FLOW_ONLY the body panel and section steps, from a detached scratch worktree on port 52391, at load 39 → 37: 73 section view, 91 mass, 262 G19.2, 263 G19.3, 264 G19.4 and 266 G20.2, all ok (each on either renderer where it says so).

## R3b — chat/tools.ts by action group: the features group, the person-row steps, ranged and point checks (2026-10-23)

**Moved, verbatim** (as R3a): chat/part/features.ts holds the features group's handlers and their data.
- The handlers: run_command, add_features, edit_feature, delete_feature, set_material, load_rows, set_stock, set_casting, set_frame_stock, set_frame_sections, set_welds.
- Their data: CHAT_COMMANDS, COMMAND_DOCS, removeRows.
- tools.ts is 1,021 lines (1,309 after R3a, 1,699 before R3). It imports CHAT_COMMANDS and COMMAND_DOCS back for describe and re-exports them.

**The survey's items in this checkpoint:**
- **4, the person-row actions' steps.** set_stock, set_frame_stock and set_frame_sections repeated the same four steps; they now call `rowsAsked(args, other)` and `fileRows(state, args, kind)` in features.ts. The four steps:
  - rows from the agent refused (ROWS_NOT_FROM_PERSON);
  - the ids to remove;
  - "Give file, remove, … or any of them." / "Give file, remove or both.", built from the action's own setting;
  - the person's file loaded when given.
  Each action's own check still runs between the two, in the same order, and every refusal text is the same (the byte check probes each).
- **5, ranged numbers and points.** `inRange(v, lo, hi, loOpen?)` and `isVec3(v)` in toolKit replace six inline checks and one plane check:
  - the stock allowance, the kerf, the casting allowance and shrink, a weld's size;
  - the casting gate, and the sketch plane's origin, normal and xAxis (tools.ts).
  The casting allowance and shrink lacked `Number.isFinite`; their range comparisons already refused NaN and ±Infinity, so the outcome is the same for every input.
- **7, the duplicate point-in-polygon.** image.ts's `insidePoly` was the same even–odd test as engine/geom2's `insideRing`, which the module already imports as `inside`: the same comparisons in the same order, so the same result for every input. It is gone; `surfaceAt` uses `inside`.
- **The runner** (the coordinator approved it): scripts/test.mjs passes `--test-concurrency=$TEST_CONCURRENCY` when the variable is set. The R checkpoints run `TEST_CONCURRENCY=4 node scripts/test.mjs`; the scratch copy is retired.

**The byte check** now also probes the features group, on an empty part and on a plate: 37 refusals and plain answers, and four completed changes with their documents (stock allowance, kerf, casting, material). The baseline was taken before any edit and was identical across two runs. It is identical after the move and after items 4, 5 and 7.

**Verified (R3b):**
- the byte check, identical (with the features group's probes);
- toolset 9/9 (23,198 of 25,000, unchanged) and tool-contract 3/3;
- the cad-model suite, `TEST_CONCURRENCY=4 node scripts/test.mjs`: 964 of 964 pass, in 299 s, at load 38 → 29;
- tsc of model and studio; eslint 0 errors on the changed files.
- Not run: the flow (no studio change).

## R3c — chat/tools.ts by action group: requirements and views (2026-10-23)

**Moved, verbatim** (as R3a and R3b):
- chat/part/requirements.ts: set_requirements and check_spec;
- chat/part/views.ts: render_views, inspect and select. chat/views.ts keeps its rendering helpers.
tools.ts is 967 lines.

**The byte check** also probes the requirements and view tools, on an empty part and on a plate: 11 calls, with each call's content, error flag, changed flag, selection and requirements. The baseline was taken before the edit and was identical across two runs; it is identical after.

**Verified (R3c):**
- the byte check, identical;
- toolset 9/9 and tool-contract 3/3;
- the cad-model suite: 964 of 964, in 299 s, at load 20 → 22;
- tsc and eslint clean.
- Not run: the flow.

## R3d — chat/tools.ts by action group: the definitions (2026-10-23)

**The order changed (the coordinator approved it):** the definitions move before the history and proposal tools. That machinery (runOps, the script host, moveOps) calls takesArgument and unknownArguments, which lived in the definitions block; moving it first would have needed it to import tools.ts, a cycle.

**Moved, verbatim and in today's order** to chat/toolDefinitions.ts (361 lines):
- BATCHABLE/BATCHABLE_TOOLS and MUTATORS/isMutator;
- the schema helpers, commandDoc, describe and featureKinds;
- PART_TOOLS, with the pass that adds `because` to the tools that change the part, and PART_SCOPED/withPartArgument;
- argumentsOf, takesArgument and unknownArguments;
- TOOLS and SYSTEM_PROMPT.

It imports nothing from tools.ts. tools.ts (623 lines) imports back the six it uses (BATCHABLE, MUTATORS, PART_SCOPED, describe, takesArgument, unknownArguments) and re-exports the seven public ones (BATCHABLE_TOOLS, isMutator, featureKinds, takesArgument, unknownArguments, TOOLS, SYSTEM_PROMPT).

**The byte check** is identical: TOOLS JSON, SYSTEM_PROMPT, the v2 list and prompt, every describe, the argument tables and the groups' probes.

**Verified (R3d):**
- the byte check, identical;
- toolset 9/9 and tool-contract 3/3, within the suite;
- the cad-model suite through the lanes guard's gate (go at load 15): 964 of 964, in 338 s;
- tsc and eslint clean.
- Not run: the flow.
