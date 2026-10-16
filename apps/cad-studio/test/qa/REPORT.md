# cad-studio QA report — 2026-10-16

Tester session on branch `claude/studio-tester-412a82`.

- First pass: on `1ff129f2`.
- Second pass: merged with the integration tip `2d9c79bc` (sketch constraints and assembly mates);
  every probe was re-run there.
- Third pass: merged with `635591fd` (2D drawings, rectangles with constraints, horizontal and
  vertical point distances); every probe was re-run there.

Every finding below carries an area tag for routing: **[sketch-constraints]**,
**[assembly-mates]**, **[drawing]** or **[core]** (everything else).
I ran the real app in headless Chrome with WebGPU (`--enable-unsafe-webgpu`; the viewport reported
`data-renderer="webgpu"`) and checked every result against numbers computed by hand. I did not change
any product code.

## How to rerun

```bash
export PATH=$HOME/.nvm/versions/node/v22.19.0/bin:$PATH
cd apps/cad-studio
# Engine level: the same evaluateDoc / stepFor / stlFor code the worker runs (126 cases, ~3 s).
node test/qa/run-engine-probe.mjs                     # engine-probe.ts
node test/qa/run-engine-probe.mjs regions-probe.ts    # overlapping shapes in one sketch
node test/qa/run-engine-probe.mjs detail-probe.ts     # fillet/chamfer sizes, edge-touch union, hole/region classification
node test/qa/run-engine-probe.mjs constraints-mates-probe.ts   # sketch constraints + mates (42 cases)
node test/qa/run-engine-probe.mjs drawing-probe.ts              # hidden-line views, layout, dimensions (19 cases)
node test/qa/run-engine-probe.mjs torus-probe.ts                # overlapping tori (W5)
# Real app (Vite on :52044 + Chromium, 67 cases, ~15 min). Optional 2nd arg: a case-id regex, e.g. 'U4|U69'.
PW_DIR=/Users/user/.npm/_npx/e41f203b7505f1fb/node_modules/playwright \
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
node test/qa/ui-probe.mjs /tmp/cad-studio-qa
```

The raw outputs of the final run are in `test/qa/results/`. Screenshots for the findings are in
`test/qa/screenshots/`, named by case id; `results/ui-probe.json` names every case's screenshot.

Final run on `635591fd`:

- UI: **47/67** cases as expected.
- Engine: **116/126** as expected.
- Constraints and mates probe: **38/42** as expected.
- Drawing probe: **19/19** as expected.

Every earlier finding still reproduces on this tip.

The only page error in the whole run is the C1 TypeError. The cases that were not
as expected are the findings below. Where a mismatch came from my own expected value, I fixed the
probe and did not report it.

---

## Findings, most severe first

Severity labels: **wrong geometry**, **crash**, **refusal without reason**, **UX**. "Data" marks a
number that is a little off where the shape itself is right.

W1 and C1 are in the sketch *profile* builder (`src/sketch/loops.ts`), not in the constraint code, so
they are tagged [core]. The sketch-constraints session touches neighbouring files.

The later passes' findings are in their own sections below:
- second pass: A1–A2, S1–S3, X1;
- third pass: W5, DR1–DR2.

By severity:
- A1 and W5 rank with the W items;
- S1, S3 and DR1 rank with the U items;
- the rest are data or UX notes.

### W1 [core] — wrong geometry: overlapping shapes in one sketch become a cut or a bump, depending on where the second shape is

When two closed shapes in one sketch overlap and neither contains the other, the result depends on
which shape's *first outline point* falls inside the other. The user gets a silent subtraction
instead of a union, and the same drawing on a different edge gives the opposite result.

| Steps (one sketch on XY, extrude 5) | Expected (union) | Actual | Case |
|---|---|---|---|
| Rect (0,0) 10×10 + rect (5,5) 10×10 | 875 mm³ (area 175) | **375 mm³**: an L-shape, i.e. A − B | U43 |
| Rect 40×20 + Ø10 circle at (20,19), crossing the **top** edge | 4246 mm³ | **3754 mm³**: a notch | U41 |
| Rect 40×20 + Ø10 circle at (38,10), crossing the **right** edge | 4099 mm³ | 4099 mm³: a bump (correct) | U42 |
| Two Ø20 circles 12 apart | 2694.3 mm³ | **1123.5 mm³**: a crescent | regions-probe |

To reproduce in the UI: press `S`, then `R` and drag a rectangle. Type Corner 0/0 and Width/Height
10/10. Click the canvas to blur the field, press `R`, drag a second rectangle and type 5/5/10/10.
Click Finish sketch, enter Distance 5 and press Enter. Select the body. The panel shows
Volume 375 mm³ and Bounds 10 × 10 × 5.

Screenshots: `screenshots/U43-…jpg`, `U41-…jpg`, `U42-…jpg`.

Suspected code:
- `src/sketch/loops.ts` `profileOf`. `inside(ring[0], other)` tests only the first sampled point,
  and nothing detects that two outlines cross. Overlapping outlines should be merged or refused.
- The kernel also accepts a `holes` loop that crosses the outer loop and cuts a notch (engine case
  E15). Nothing validates that a hole lies inside its region.

### W2 [core] — wrong geometry: a fillet or chamfer bigger than the wall is accepted and distorts the body

Steps: make a box of 32×32×16 (`B`, then type the values). Select the top front edge
(`n1.side0|n1.top`). Open the palette, run fillet, set Radius 20 and press Enter. The HUD says
`preview` and Apply works.

| Size on a 16 mm wall | Expected | Actual | Case |
|---|---|---|---|
| Fillet R20 | refused: "The chamfer or fillet is too large" | **accepted**: Volume 13651, Bounds 32 × **31.6** × 16, front wall gone, bottom face cut back | U30 |
| Chamfer 20 | refused | **accepted**: Volume 10240, Bounds 32 × **28** × 16 (the bottom loses 4 mm) | U31 |
| Fillet R16.5 / 17 / 24 / 33 | refused | accepted; the bottom edge moves in by 0.008 / 0.03 / 1.37 / 4.7 mm | detail-probe |
| Chamfer 17 | refused | accepted: 11776 mm³, against 11760 if it fitted | detail-probe |
| Fillet R4 (control) | 16274 | 16274 ✓ | U32 |

Screenshots: `screenshots/U30-…jpg`, `U31-…jpg`. In the first one the fillet sweeps into the bottom
face.

Suspected code: `packages/barocss-cad/src/edge-finish.ts`. It only refuses when corner setbacks
exceed the **edge length** (around line 118). It does not check the size against the **width of the
two faces across the edge**, here the 16 mm side wall. `errors.ts` already maps
`too large for walls`, but this path never raises it.

### W3 [core] — wrong geometry (non-manifold): a union of bodies that touch only along an edge or at a corner is accepted as one body

Steps: make box A at (0,0,0) and box B at (10,10,0), both 10³. Select both bodies and press `U`.

- Expected: a refusal, "The bodies only touch along an edge or a point". `errors.ts` has this rule
  and `analytic-boolean.ts` / `polyhedral-boolean.ts` throw it.
- Actual: the union is applied. The outliner shows **1 body** ("Union"), 2000 mm³. `checkBrep`
  reports `bodies: 2, shells: 2`: two lumps that share an edge inside one output (U69, engine B08).
  A union at a single vertex is accepted the same way (detail-probe).
- Screenshot: `screenshots/U69-…jpg`.
- Suspected code: the upright (Z-prismatic) Boolean path in `packages/barocss-cad/src/part-model.ts`.
  It does not run the manifold check that the analytic and polyhedral Booleans run.

### W4 [core] — wrong geometry: the Pipe HUD shows Angle 360° but builds a 90° bend

Steps: open the palette, choose **pipe**, draw a circle and Finish. The HUD shows **Angle 360°** and
Apply makes `angleDegrees: 90` (U64). If the user types 360 on purpose, the bend is also 90°.
Values below 360 are honoured; 180 works.

- Screenshot: `screenshots/U64-…jpg`.
- Code: `src/App.tsx` around lines 356, 363 and 380. The default `deg: 360` is shared with revolve,
  and `Number(v.deg) >= 360 ? 90 : …` replaces it.
- Expected: a pipe default of 90°, and the angle shown is the angle built.

### C1 [core] — crash: Finish sketch throws when each shape's first point lies inside the other shape

Steps: press `S`. Draw a circle and type Centre 0/0, Diameter 20. Blur the field, press `R`, draw a
rectangle and type Corner 5/−3, Width 15, Height 6. Click **Finish sketch**.

- Expected: one merged body, or a toast that explains the refusal.
- Actual: nothing happens and the sketch stays open. The page logs:
  `TypeError: Cannot read properties of undefined (reading 'node')` at `src/sketch/loops.ts:71`,
  called from `App.tsx:333` `finishSketch` (U44).
- Cause: both shapes get depth 1, so `outers` is empty and `main` is undefined.
- Screenshot: `screenshots/U44-…jpg`.

### R1 [core] — refusal without reason and data loss: opening a file that is not STEP replaces the current part

Steps: with a part open, use Open to load `garbage.step` (its content is `hello`).

- Expected: "Could not open this file: not a STEP file", with the current part kept.
- Actual: the part is **replaced** by a document holding one broken `Import` feature (2 nodes become
  1). The toast is the generic "The kernel could not build this. Undo the last change…" (U74).
  Undo does bring the part back.
- For comparison, a broken `.bcad` is refused correctly and keeps the part: "Could not open this
  file · Expected property name…".
- Screenshot: `screenshots/U74-…jpg`.
- Suspected code: `src/App.tsx` `open()`. The STEP branch calls `commit()` before anything is
  evaluated. `src/engine/errors.ts` has no rule for STEP parse errors.

### R2 [core] — refusal without reason: an extrude draft too steep for its height

Steps: sketch a 10×10 rectangle, Finish, then set Distance 20 and Draft 60°.

- Actual: the HUD says `refused` with **"The kernel could not build this"**. The reason is only under
  "Kernel detail": *the draft closes a straight wall before the top (steeper than the profile
  allows)* (U62, E11).
- Fix: add a rule in `src/engine/errors.ts` for `/draft closes/`, for example "The draft is too
  steep for this height".
- Screenshot: `screenshots/U62-…jpg`.

### R3 [core] — refusal without reason: revolve angle 0

The HUD field has `min=1`, but typing `0` is not blocked. The refusal is generic: "The kernel could
not build this", with detail `angleDegrees must be in (0, 360]` (U61, R08).

- Fix: add an errors.ts rule, or enforce the field's min and max in `src/App.tsx` (the preview's
  `missing` check).
- Screenshot: `screenshots/U61-…jpg`.

### D1 [core] — data: reopening an exported STEP changes the volume of curved bodies

The exporter writes exact rational B-splines (`step-dump.ts` shows a torus as
`RATIONAL_B_SPLINE_SURFACE` with weights √2/2). The face counts survive the round trip, but the
volume of the reopened body drifts:

| Body | Exact (studio) | After Export STEP → Open | Δ |
|---|---|---|---|
| Torus (circle r5 at 30,10, revolve) | 14804.41 | **14794.84** (UI: 14804 → 14795) | −0.065 % |
| Pipe Ø10, 8 + R20 90° + 8 | 3724.04 | 3721.80 | −0.06 % |
| Loft square → circle | 2023.60 | 2023.22 | −0.02 % |
| Starter plate (Ø8 hole) | 15981.876 | 15982.038 | +0.001 % |
| Box, fillet R4, shell, tilted extrude | — | identical | ✓ |

Cases: U70 and X01–X08; screenshot `screenshots/U70-…jpg`. The reopened torus also renders visibly
faceted.

Suspected code: the mass properties of imported NURBS faces, probably integrated over a tessellation
(`packages/barocss-cad/src/solid-mass.ts` `segmentsPerQuarter`) rather than the exact surfaces that
were read.

### D2 [core] — data/UX: a STEP file with two solids reopens as one body

Steps: export two separate boxes. The file holds 2 `MANIFOLD_SOLID_BREP`. Open it again.

- Actual: the outliner shows **1 body**, "Import Untitled" (U71, X07). The two solids cannot be
  selected, moved or Booleaned separately.
- Screenshot: `screenshots/U71-…jpg`.
- Suspected code: the `import` feature in `src/engine/part.ts` and the kernel import (one output per
  file).

### D3 [core] — data: the measured arc length uses the display polyline

Select the starter hole's rim edge. The panel shows *Arc · Radius 4 mm* (exact) but **Length
25.09 mm**, against 8π = 25.13 mm (−0.16 %) (U03). `src/app/measure.ts` `measureItem` sums segment
lengths; once it knows the radius and sweep it could report r·θ.

Screenshot: `screenshots/U03-…jpg`.

### D4 [core] — data: fillet volume is slightly off at large radii

On a 32×32×16 box with one top edge filleted, compared with exact (r² − πr²/4)·32:

| Radius | Exact | Kernel |
|---|---|---|
| R4 | 16274.12 | 16273.96 (−1e-5) |
| R15 | 14838.70 | 14836.60 |
| R16 | 14625.98 | 14623.40 (−1.8e-4) |

The UI rounds to whole mm³, so a user sees 14836 where 14839 is right (F06). This is small, but
chamfers, shells, holes and extrudes are exact to 1e-9 here, so fillets stand out.

### U1 [core] — UX: there is no way to delete a feature

None of these offer delete or remove (U83):
- the History chip's context menu (it has no right-click menu at all)
- the `Delete` and `Backspace` keys with a chip selected
- the palette, searched for "delete"
- the feature editor, which has only Apply and Reset

The only way out is to roll back and add a new feature, which discards *every* later feature. So
"delete a feature others depend on" cannot be tested; it does not exist yet.

Screenshot: `screenshots/U83-…jpg`.

### U2 [core] — UX: the "Removed N later features" toast counts sketch nodes

Steps: build box A and box B, double-click A's chip to roll back, then add box C. The toast says
**"Removed 2 later features"**, but the History bar showed one (Extrude 8); the hidden sketch node is
counted too (U82). Undo restores the document correctly.

Code: `src/App.tsx` `commit()`, `dropped = doc.nodes.length - marker`.

Screenshot: `screenshots/U82-…jpg`.

### U3 [core] — UX: after typing a dimension, tool keys are swallowed and the next click draws the wrong shape

After typing in a sketch panel field (for example Height), focus stays in the field. Pressing `C`
does nothing, and the next click on the canvas starts another **rectangle**. The panel then shows a
0-height rectangle with the status "Fully defined · every value is dimensioned".

A user who types and then presses a tool key gets a stray shape. Blurring the dimension box on
Enter, or letting tool keys work from number fields, would avoid this.

Screenshot: `screenshots/U40-firstrun-focus-kept-in-field.jpg`.

---

## Second pass — sketch constraints and assembly mates (`2d9c79bc`)

### A1 [assembly-mates] — wrong placement: a mate that needs a non-90° turn about X or Y is accepted, then the instance cannot be built

Steps:
1. Make a box of 40×40×20 and chamfer its top front edge by 10. This gives a 45° face, `n2.face`.
2. Insert `block.bcad`, a 10×10×4 box.
3. Click **Add mate**. Pick the chamfer face, then the block's bottom face.

Expected: the block lies on the chamfer, or the mate is refused with a reason.

Actual:
- The mate is **accepted** with no refusal. The solver sets rotation
  **[44.99999999745556, 0, 0]**; Euler angles are not cleaned here.
- Evaluating the placed part then fails. The only message is an unrelated toast: "Only quarter turns
  about X and Y · Rotate about X or Y by 90°, 180° or 270°".
- The instance panel shows "Bodies …" forever, and the block is not drawn (UM6).
- The same happens for a block flush on the top of a 30°-tilted extrude (engine M10).

Screenshot: `screenshots/UM6-…jpg`.

Cause: `src/assembly/mates.ts` `solveAssembly` produces any rotation. But
`src/engine/doc.ts` `placedDoc` applies it as kernel `rotate` features, and the kernel only allows
X/Y multiples of 90°. Either the mate should refuse with that reason, or placedDoc needs a general
rotation.

### A2 [core] — UX: the feature editor is hidden while a part instance is selected

With an instance selected (always the case right after Add mate), clicking a History chip highlights
it, but no editor opens. The Selection panel holding the editor is hidden because
`!instanceSel.length` is false. The user has to click empty space first (UM2).

Code: `src/App.tsx`, the Selection aside condition.

Screenshot: `screenshots/UM2-…jpg`. In it the chip `Extrude 8` is highlighted and no editor shows.

### S1 [core] — UX/data loss: ⌘Z while sketching throws the sketch away and undoes the feature before it

Steps:
1. Make a box.
2. Press `S`, then `L`, and draw a closed 4-point outline.
3. Type a width of 60, then press **⌘Z**, as you would to undo that dimension.

Expected: the last sketch edit (or constraint) is undone and the sketch stays open.

Actual:
- The sketch closes and is **discarded**.
- The **box feature is undone too**: the document goes from 2 nodes to 0 (UC1).

Redo brings the box back, but the sketch is lost. With explicit constraints and dimensions, undoing
inside a sketch is now a natural thing to try.

Code: `src/App.tsx`. `doUndo()` calls `cancel()` and pops the document undo stack. The sketch has no
undo history of its own.

Screenshot: `screenshots/UC1-…jpg`.

### S2 [sketch-constraints] — UX: constraints and driving dimensions are dropped when the sketch is finished

Steps: draw a line-tool outline, type width 60 and height 25 (fully defined), then finish and extrude.

Actual:
- The sketch node keeps only the solved points:
  `{"profile":"polygon","points":[[34,30],[94,30],[94,5],[34,5]]}`.
- `hv`, `lengths`, `rules` and the distance dimensions are gone (engine K18).
- Clicking the feature in History offers no dimensions (UC3), and the sketch cannot be reopened.

So a driving dimension drives only until Finish; the part is not parametric in it afterwards.

Code: `src/sketch/loops.ts` `shapeNode` / `profileOf`, and `src/app/editFields.ts`, which has
`sketchFields` only for rectangles and circles.

Screenshot: `screenshots/UC3-…jpg`.

### S3 [sketch-constraints] — UX/regression: a rectangle loses its editable Width and Depth once Select or Dimension touches it

Steps: draw a 40×20 rectangle with the Rectangle tool. Press `S` (Select) or `D` (Dimension), even
without adding anything. Then finish and extrude.

Actual:
- The sketch is saved as a 4-point `polygon`, not a `rectangle`.
- The feature editor then offers only Distance, Start Z and Draft.
- An untouched rectangle offers Width, Depth, Corner X and Corner Y as well (engine K29).

Code: `src/sketch/select.ts` `startPicking` / `rectangleOutline`, together with `shapeNode` in
`src/sketch/loops.ts`. This compounds S2.

### X1 [assembly-mates] — information only: interference is not checked

These are accepted without a warning (engine M05, M11). Most CAD tools allow this, so it is listed
only as a decision to confirm:
- a distance mate of −5 mm sinks the pin 5 mm into the plate;
- a concentric Ø12 pin goes into the Ø8 hole.

### Sketch constraints that work

Engine K01–K23 and UI UC2, plus the flow test's own constraint step:

- **Line-tool rectangle.** It closes with H/V kept and 2 DOF. Fixing point 3 makes it fully
  defined; removing the fix gives 2 DOF again.
- **Refused as already implied, each with the plain "already implied … would over-define" reason:**
  - parallel on edges that are already horizontal;
  - perpendicular on edges that are already H and V;
  - equal on opposite rectangle edges;
  - a diagonal of exactly 65 on a 60 × 25 rectangle;
  - a top edge of 60 when the bottom is 60;
  - vertical on edge 4 after 2 ∥ 4 and 1 ⊥ 2.
- **Refused as conflicts, each with a reason:**
  - vertical on a horizontal edge ("remove that constraint first");
  - a diagonal of 70;
  - a length on a fixed, fully defined outline.
- **Refused dimensions:** 0 and −5 ("must be greater than 0"); 1e6 (the solver range).
- **Refused selections:** equal on a line and an arc; a point on the centre of its own arc; a 14-gon
  with 3 point distances (the solver limit, with a reason).
- **Removing:** removing a dimension frees exactly one DOF and leaves the shape as it is. Removing
  the first of two rules keeps the second.
- **Viewport dimension editor:** 0 is refused inline. Escape closes the editor and leaves the value
  and the sketch as they were.

### Assembly mates that work

Engine M01–M12 and UI UM1–UM5:

- **Pin in the starter hole.** Coincident + concentric picked in the real app puts it at
  **(32, 16, 8)**.
- **Re-solve after the base changes.** Editing the plate from 8 to 20 thick moves the pin to
  **z = 20**, and ⌘Z puts both back to 8 (UM2).
- **Missing face.** Rolling the hole feature back flags "Concentric 2" with "One of its faces is no
  longer on the part" (UM3).
- **Conflict.** A third mate, pin top on plate top, is refused with "Conflicts with Coincident 1 … 180°".
- **Flip.** Flipping the flush mate turns the pin 180° about X, so it hangs through the plate:
  z −12…8.
- **Delete.** Deleting a mate keeps the other one (UM4).
- **Remove the instance.** Its mates are removed with it (UM5).
- **Loops.** Two instances placed by each other are both refused with "It closes a loop" (M08).
- **Stability.** A solved assembly stays put when solved again (M12).
- **Flow test.** It covers a grounded part, distance edits, and following a moved fixed part.

---

## Third pass — 2D drawings, rectangle constraints, H/V distances (`635591fd`)

### W5 [core] — wrong refusal: a union of tori that really overlap is refused as "only touch along an edge"

A ring (circle r5 at (30,10), revolved about Y) joined to a copy of itself turned 30°, 45° or 90°
about Z is refused. The two tubes cross each other with plenty of overlap, yet the refusal says
**"The bodies only touch along an edge or a point"**. The kernel detail is *analytic Boolean: … edge
has 4 uses*. A circular pattern ×8 of the ring is refused the same way (`torus-probe.ts`).

This is a failure in the intersection curves of two tori, reported with W3's message, so the advice
"overlap the bodies" is wrong here.

Related data point (D1 family): joining a torus to a body it does not touch loses volume.
- Two disjoint tori: 29589.67 mm³ against 2 × 14804.41.
- Torus + rod: 15297.29 against 15307.06.

That is the same −0.065 % as D1: once a Boolean puts the torus through B-spline faces, its mass is
approximate.

### DR1 [drawing] — merge gap: part instances are not drawn on the sheet at this tip

Insert `block.bcad` beside the starter plate, then open Drawing. The sheet is byte-identical to
before; the instance is missing (UD6).

The drawings hand-over (`side-session-notes/…/studio-drawings.md`) lists `a20fedaae` (instances on
the sheet, centre marks) and `f8123a6a0` on `claude/studio-drawings-cd772f`. **Neither is an
ancestor of `635591fd`.** At the tip, `App.tsx` passes `doc={evaluated}` without instances, and
`brepsFor` ignores them.

### DR2 [drawing] — UX: an empty part shows a misleading toast

New part, then Drawing. The panel correctly says "There is no body to draw.", but a toast also pops
up: **"Could not draw the part · Fix the model’s errors first"**. There are no errors (UD7).

Code: `src/ui/DrawingWorkspace.tsx` raises the error toast for every projection error, including the
empty case.

### Drawings that work

Engine `drawing-probe.ts` 19/19, plus UI UD1–UD5.

Projection, each checked against coordinates:
- cylinder silhouettes at x = ±8 and a true R8 circle from the top;
- open shell: inner walls hidden at x = 2 / 30 and the floor at z = 2;
- a taller box behind a short one: no hidden lines drawn over visible ink;
- R4 fillet arc in the side view;
- torus extents ±35;
- 30°-tilted extrude extents 21.32 × (−10…6.93);
- a notch hole hidden only inside the plate;
- loft circle R5.

Layout and scale:
- auto scale gives 10:1 for a 0.5 mm cube, 1:20 for 2000 × 1000, 1:100 for a 10 m bar, all fitting;
- A3 at 10:1 warns "do not fit";
- first angle puts the top view below the front;
- A3 auto scale is 2:1.

Dimensions:
- clicked dimensions read 64 and Ø8;
- they follow edits to 80 and Ø12, and a hole moved to (10,10);
- a new Ø4 hole near the old spot does not steal the Ø dimension;
- a removed hole reports "no longer in the part";
- refusals have clear hints: "Pick a different point", "Click a circle or an arc", "Dimensions go on
  the front, top and right views";
- ⌘Z removes the last dimension and stays in Drawing; Delete removes a selected one.

Export and persistence:
- SVG and PDF (`%PDF-1.4`) carry the dimension texts;
- title, sheet, projection and dimensions survive Save → Open and autosave recovery.

Speed: 12 holed plates project in 0.34 s; a torus joined to a rod in about 1 s.

### H/V distances and rectangle constraints that work

Engine K24–K28, K30:
- a horizontal distance of 55 from point 1 to point 3 widens a rectangle exactly;
- refused as conflicts: a vertical distance between the ends of a horizontal edge, and a horizontal
  distance along a vertical edge;
- refused as implied: edge = 55 after dx = 55;
- the H distance is listed in the constraint list and removable;
- after Select, a rectangle with an inner circle keeps the hole.

---

## Tested and working (numbers checked)

All of these matched the hand-computed value (UI rounding to 1 mm³ or the stated tolerance, engine
to 1e-4 relative or better).

### Data and properties
- **Starter plate** 64×32×8 with a Ø8 through hole shows Volume **15982** mm³
  (16384 − 128π = 15981.876), Mass **43.2 g** in Al 6061, **7 faces** and Bounds 64 × 32 × 8 (U01).
- The same plate built by hand gives the same numbers: `B` with 64/32/8, Top view, click the face,
  `H` with Ø8 at (32,16) (U20).
- **Measure**: top to bottom face gives Normal distance **8 mm** and Angle 0°. The top face area is
  1998.06 mm², against 1997.73 exact; the display mesh polygonizes the hole (U02). Top to side face
  gives **Angle 90°** and Distance 0 (U56).
- **Feature editor**: width 64 → 80 gives **20078** with the hole kept (U21). Width 20 is refused
  with "The hole misses the body" and the document is kept (U22). Hole Ø −8 is refused with "Sizes
  must be greater than zero" (U23).
- **Undo/redo** returns exactly 15982 ↔ 20078 (U24).
- **Rapid undo/redo**: 12× ⌘Z then 7× ⇧⌘Z while a ×24 pattern computes ends with the outliner
  matching the document (U84).

### HUD input checks
- Width 0 or −5 is refused with "Sizes must be greater than zero" and Apply is disabled.
- 1e6 is refused with "out of range ±10000 mm". An empty field is refused with "Enter a value".
- 0.0001 previews (U10–U14).

### Sketch
- Clicks snap to whole millimetres (U59).
- A rectangle with a circle inside makes a plate with a hole, 3607 mm³ (U40).
- A front-face sketch with a through-all cut makes a 20×10 window: **9984** = 16384 − 6400 (U50).
- XZ plane at offset 5 places the plane at y −5 with normal −Y. Ø10 extruded 12 gives 942 mm³ and
  Bounds 10 × 12 × 10 (U51).
- A 30° tilted plane with a 30×20 rectangle extruded 8 gives exactly **4800** mm³ and 6 faces
  (U52, E17).
- A sketch on a sloped 45° chamfer face, extruded 3, adds exactly 180 mm³ (U53).
- A hole on that sloped face is refused with "Holes go into a flat face facing ±X, ±Y or ±Z" (U55).
- A shape inside a hole (an island) is refused with a reason (detail-probe).

### Features
- **Revolve** a rectangle into a tube: 9425 (U60).
- **Pipe** Ø10, 8 + R20 90° + 8: **3724** (U63). A bend tighter than the section is refused with a
  reason (P02).
- **Loft** to a 50% square gives a frustum of **2333** (U65). Square → circle closes (L02).
- **Shell**: wall 2 open at the top gives **5408**; wall 16 is refused as "too thick" (U66). A
  closed shell, two open faces, a 0.1 mm wall and a shell of the holed plate are all exact
  (S01–S07).
- **Patterns**: a ×3 linear pattern whose copies overlap merges to **8192** with Bounds 32 × 16 × 16
  (U67). Circular ×4 is exact, as is a pattern of a holed plate.
- **Booleans**: union → subtract → intersect chain gives **3000** in 1 body (U68). Face-coincident
  unions merge to one 6-face body. Flush and pocket subtracts are exact. A tangent cylinder
  subtract, a tool covering the whole body (0 bodies), disjoint intersect (0 bodies) and the union
  of identical bodies are all correct (B01–B15 except B08).
- **Holes**: through, blind (depth 2), side ±X and ±Y, notch at the edge, tangent from inside,
  Ø80 wider than the plate, two overlapping holes, and a hole on a union result are all exact to
  ≤ 3e-5. A hole off the body or only touching it is refused with "misses the body"
  (H01–H14, H05).
- **Mirror** YZ: 2000 with Bounds 30 × 10 × 10. **Split** of the mirrored pair at X = 0 gives
  2 bodies. **Cylinder** r8 h24: 4825 with 3 faces (U57, U58).
- **Draft** 10° matches V = h(400 − 40d + 4d²/3) (E10). Negative distances extrude downwards
  (E02, D07). Rotating 45° about X is refused with "Only quarter turns about X and Y", a documented
  limit (T11).

### Files
- **STL** export is binary, 84 + 50·n bytes, and its volume is 16384.000 (U72).
- **.bcad** Save then Open gives the same nodes and volume and clears the unsaved dot (U73).
- A broken `.bcad` is refused with its reason (U74, first half).
- **STEP** round trip is exact for planar, filleted, shelled and tilted bodies (X02, X04, X08).
- Part + instance export writes 2 solids (U90).
- **Autosave**: after a reload, Restore brings back the same nodes and 2 bodies (U80).
- **Instance** of `bracket.bcad` shows Volume 2160 mm³ and exports as its own STEP solid (U90).

### Console
- The only page error in the whole run was the C1 TypeError (U44).

## Not covered

- Driving every inferred constraint by hand; `browser-flow.mjs` already covers tangent, radius,
  concentric and equal.
- Inferred constraints beyond what U59 and the closed outline settle.
- The WebGL2 fallback renderer.
- Render workspace visuals.
- 2D drawings' second round (instances on the sheet, centre marks): not merged into the tip; see DR1.
