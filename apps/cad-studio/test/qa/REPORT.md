# cad-studio QA report — 2026-10-16

Tester session on branch `claude/studio-tester-412a82` (based on `1ff129f2`, the integration tip).
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
# Real app (Vite on :52044 + Chromium, 51 cases, ~8 min). Optional 2nd arg: a case-id regex, e.g. 'U4|U69'.
PW_DIR=/Users/user/.npm/_npx/e41f203b7505f1fb/node_modules/playwright \
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
node test/qa/ui-probe.mjs /tmp/cad-studio-qa
```

The raw outputs of the final run are in `test/qa/results/`. Screenshots for the findings are in
`test/qa/screenshots/`, named by case id; `results/ui-probe.json` names every case's screenshot.

Final run: **UI 36/51 cases as expected**, **engine 116/126 as expected**. The cases that were not
as expected are the findings below. Where a mismatch came from my own expected value, I fixed the
probe and did not report it.

---

## Findings, most severe first

Severity labels: **wrong geometry**, **crash**, **refusal without reason**, **UX**. "Data" marks a
number that is a little off where the shape itself is right.

### W1 — wrong geometry: overlapping shapes in one sketch become a cut or a bump, depending on where the second shape is

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

### W2 — wrong geometry: a fillet or chamfer bigger than the wall is accepted and distorts the body

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

### W3 — wrong geometry (non-manifold): a union of bodies that touch only along an edge or at a corner is accepted as one body

Steps: make box A at (0,0,0) and box B at (10,10,0), both 10³. Select both bodies and press `U`.

- Expected: a refusal, "The bodies only touch along an edge or a point". `errors.ts` has this rule
  and `analytic-boolean.ts` / `polyhedral-boolean.ts` throw it.
- Actual: the union is applied. The outliner shows **1 body** ("Union"), 2000 mm³. `checkBrep`
  reports `bodies: 2, shells: 2`: two lumps that share an edge inside one output (U69, engine B08).
  A union at a single vertex is accepted the same way (detail-probe).
- Screenshot: `screenshots/U69-…jpg`.
- Suspected code: the upright (Z-prismatic) Boolean path in `packages/barocss-cad/src/part-model.ts`.
  It does not run the manifold check that the analytic and polyhedral Booleans run.

### W4 — wrong geometry: the Pipe HUD shows Angle 360° but builds a 90° bend

Steps: open the palette, choose **pipe**, draw a circle and Finish. The HUD shows **Angle 360°** and
Apply makes `angleDegrees: 90` (U64). If the user types 360 on purpose, the bend is also 90°.
Values below 360 are honoured; 180 works.

- Screenshot: `screenshots/U64-…jpg`.
- Code: `src/App.tsx` around lines 356, 363 and 380. The default `deg: 360` is shared with revolve,
  and `Number(v.deg) >= 360 ? 90 : …` replaces it.
- Expected: a pipe default of 90°, and the angle shown is the angle built.

### C1 — crash: Finish sketch throws when each shape's first point lies inside the other shape

Steps: press `S`. Draw a circle and type Centre 0/0, Diameter 20. Blur the field, press `R`, draw a
rectangle and type Corner 5/−3, Width 15, Height 6. Click **Finish sketch**.

- Expected: one merged body, or a toast that explains the refusal.
- Actual: nothing happens and the sketch stays open. The page logs:
  `TypeError: Cannot read properties of undefined (reading 'node')` at `src/sketch/loops.ts:71`,
  called from `App.tsx:333` `finishSketch` (U44).
- Cause: both shapes get depth 1, so `outers` is empty and `main` is undefined.
- Screenshot: `screenshots/U44-…jpg`.

### R1 — refusal without reason and data loss: opening a file that is not STEP replaces the current part

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

### R2 — refusal without reason: an extrude draft too steep for its height

Steps: sketch a 10×10 rectangle, Finish, then set Distance 20 and Draft 60°.

- Actual: the HUD says `refused` with **"The kernel could not build this"**. The reason is only under
  "Kernel detail": *the draft closes a straight wall before the top (steeper than the profile
  allows)* (U62, E11).
- Fix: add a rule in `src/engine/errors.ts` for `/draft closes/`, for example "The draft is too
  steep for this height".
- Screenshot: `screenshots/U62-…jpg`.

### R3 — refusal without reason: revolve angle 0

The HUD field has `min=1`, but typing `0` is not blocked. The refusal is generic: "The kernel could
not build this", with detail `angleDegrees must be in (0, 360]` (U61, R08).

- Fix: add an errors.ts rule, or enforce the field's min and max in `src/App.tsx` (the preview's
  `missing` check).
- Screenshot: `screenshots/U61-…jpg`.

### D1 — data: reopening an exported STEP changes the volume of curved bodies

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

### D2 — data/UX: a STEP file with two solids reopens as one body

Steps: export two separate boxes. The file holds 2 `MANIFOLD_SOLID_BREP`. Open it again.

- Actual: the outliner shows **1 body**, "Import Untitled" (U71, X07). The two solids cannot be
  selected, moved or Booleaned separately.
- Screenshot: `screenshots/U71-…jpg`.
- Suspected code: the `import` feature in `src/engine/part.ts` and the kernel import (one output per
  file).

### D3 — data: the measured arc length uses the display polyline

Select the starter hole's rim edge. The panel shows *Arc · Radius 4 mm* (exact) but **Length
25.09 mm**, against 8π = 25.13 mm (−0.16 %) (U03). `src/app/measure.ts` `measureItem` sums segment
lengths; once it knows the radius and sweep it could report r·θ.

Screenshot: `screenshots/U03-…jpg`.

### D4 — data: fillet volume is slightly off at large radii

On a 32×32×16 box with one top edge filleted, compared with exact (r² − πr²/4)·32:

| Radius | Exact | Kernel |
|---|---|---|
| R4 | 16274.12 | 16273.96 (−1e-5) |
| R15 | 14838.70 | 14836.60 |
| R16 | 14625.98 | 14623.40 (−1.8e-4) |

The UI rounds to whole mm³, so a user sees 14836 where 14839 is right (F06). This is small, but
chamfers, shells, holes and extrudes are exact to 1e-9 here, so fillets stand out.

### U1 — UX: there is no way to delete a feature

None of these offer delete or remove (U83):
- the History chip's context menu (it has no right-click menu at all)
- the `Delete` and `Backspace` keys with a chip selected
- the palette, searched for "delete"
- the feature editor, which has only Apply and Reset

The only way out is to roll back and add a new feature, which discards *every* later feature. So
"delete a feature others depend on" cannot be tested; it does not exist yet.

Screenshot: `screenshots/U83-…jpg`.

### U2 — UX: the "Removed N later features" toast counts sketch nodes

Steps: build box A and box B, double-click A's chip to roll back, then add box C. The toast says
**"Removed 2 later features"**, but the History bar showed one (Extrude 8); the hidden sketch node is
counted too (U82). Undo restores the document correctly.

Code: `src/App.tsx` `commit()`, `dropped = doc.nodes.length - marker`.

Screenshot: `screenshots/U82-…jpg`.

### U3 — UX: after typing a dimension, tool keys are swallowed and the next click draws the wrong shape

After typing in a sketch panel field (for example Height), focus stays in the field. Pressing `C`
does nothing, and the next click on the canvas starts another **rectangle**. The panel then shows a
0-height rectangle with the status "Fully defined · every value is dimensioned".

A user who types and then presses a tool key gets a stray shape. Blurring the dimension box on
Enter, or letting tool keys work from number fields, would avoid this.

Screenshot: `screenshots/U40-firstrun-focus-kept-in-field.jpg`.

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
- Assembly mates and drawings, which other sessions are still building.
