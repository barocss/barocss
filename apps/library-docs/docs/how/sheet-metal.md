<script setup>
import SheetBend from '../.vitepress/components/algorithms/SheetBend.vue';
import SheetTable from '../.vitepress/components/algorithms/SheetTable.vue';
import SheetUnfold from '../.vitepress/components/algorithms/SheetUnfold.vue';
</script>

# Sheet metal: bends and the flat pattern

A sheet-metal part is cut flat from a sheet of one thickness and then bent. Its model has two jobs: build the bent
part as an exact solid, and give back the *flat pattern*, the outline to cut before bending. The flat is what a laser
or a punch press is given, so its length must account for how the material stretches in each bend. This page explains
the bend's arithmetic, where its K-factor comes from, and how the kernel unfolds a B-rep into its flat. The features are
listed in [Modeling](/packages/cad/modeling); the studio's commands in [Features](/studio/features#sheet-metal).

The figures play their steps as you reach them. Use **Play**/**Pause**, the arrows or a step's number to go through
one at your own pace. The methods, formulas and constants are the kernel's, in `packages/barocss-cad/src/frame-sheet/`
and `packages/barocss-cad/src/part/`.

## The sheet's rules and its features

Every sheet-metal body carries its rules: its thickness T, its bends' inner radius R, and either one K-factor for every
bend or a bend table. One of the two, never both or neither: otherwise the feature is refused. A K-factor must lie
from 0 to 1. The kernel builds in no K values and no default (D115). They come from the person's own data.

| Feature | What it makes | Faces |
|---|---|---|
| `sheet-base` | A plate: a sketch's one outer loop (holes allowed) extruded T, upwards or, with `reverse`, downwards | its sides, `<id>.top`, `<id>.bottom` |
| `sheet-contour` | A profile: an open path of 2 to 64 points, the material T thick to its `left` or `right`, extruded `width`; a bend at every corner | `<id>.leg<i>.a` (on the path) and `.b`, `<id>.bend<k>.inner` / `.outer`, `<id>.start`, `<id>.end`, `<id>.front`, `<id>.back` |
| `sheet-flange` | An edge flange: a bend and a straight leg on a straight edge between a skin and a thickness face | `<id>.bend.inner` / `.outer`, `<id>.leg.inner` / `.outer`, `<id>.tip`; its ends `<id>.start` / `.end` and the plate's cuts `<id>.trim.*`, `<id>.relief<k>.*` where they are not merged into the plate's own faces |
| `sheet-corner-relief` | A square or a round cut-out at a plate's corner, before its two flanges | — |

A contour path's corners are the reference skin's virtual sharps (explained below). At each corner the radius on the
path's skin is R where the material lies outside the turn and R + T where it lies inside, so the inner radius is R
either way. A path point in line with its neighbours, or turning back 180° (a hem), is refused `BEND_ANGLE`: a turn
within 10⁻⁹ rad of 0 or π. A leg whose straight part, after its bends' setbacks, is not longer than 10⁻⁶ mm is refused
`BEND_DOES_NOT_FIT`. A section that meets itself is refused `SHEET_CROSSES_ITSELF`, tested with closed forms for each
pair of lines and arcs, to 10⁻⁹ times the section's size.

The rules travel with the body through `difference` and `hole` features, so holes and cuts keep it a sheet. A move,
a pattern, a mirror or a union drops them: a flange on such a body is refused `NOT_A_SHEET`, and its flat needs T and
K given to the kernel's `flatPattern` (D117).

## 1. One bend

A bend is a piece of a cylinder. The inside of the sheet is compressed and the outside stretched; one layer between
keeps its length. That layer, the *neutral layer*, sits at radius R + K·T. The K-factor says where: 0 at the inner face,
1 at the outer. Every bend's report (`SheetBendReport`) gives three numbers computed from it:

| Quantity | Formula | Function |
|---|---|---|
| Bend allowance, BA | θ (R + K·T), θ in radians | `bendAllowance` |
| Outside setback, OSSB | (R + T) · tan(θ/2), θ &lt; π | `outsideSetback` |
| Bend deduction, BD | 2·OSSB − BA | `bendDeduction` |

<SheetBend />

For an L whose legs are A and B to the outer virtual sharp, the flat is A + B − BD long. Adding up the straight
parts and BA gives the same length; the kernel's unfolding does the second, and the tests check it against the first.

## 2. Bend tables

A single K for every bend is an approximation. A shop's test bends give K, or BA, or BD for each thickness, radius and
angle it uses. A bend table carries these as rows (R12.4, D120). It has an `id`, an optional `material`, its `sources`
(`id`, `label`, optional `url`, `read` date, `note`) and 1 to 1024 rows. Each row has:

- `thickness` and `radius`, both above 0;
- an optional `angle`, in degrees, in (0, 180): without it the row holds at any angle;
- exactly one of `kFactor`, `allowance` or `deduction`. The last two hold at one angle, so they need `angle`;
- a `source` naming one of the table's sources, or `estimate: true`. A row with neither is refused.

A table is checked when it is given (`bendTableProblem`). Every row is turned into a K (`rowKFactor`); a K outside 0 to 1
is refused, as is a row whose thickness, radius and angle repeat another's. A table that fails is refused
`[BEND_TABLE]` with the reason.

In the studio a bend table comes from a rows file of kind `bend` that the person supplies: rows the agent wrote itself
are refused `[ROWS_NOT_FROM_PERSON]`. See [Shop rows](/studio/rows) for the rule and [Rows file formats](/reference/rows#bend)
for the file.

<SheetTable />

A bend outside the table is refused, never given a fallback K: `[BEND_TABLE_MISS]`. A feature's bends are looked up
when it is built, by their own R and angle. A flat built from a table looks each bend up again: it first finds every
bend's angle and inner radius from the B-rep (they do not depend on K), its angle the widest turn of its pieces, then
its K. Each bend of the flat names the rows it used, whether they were matched or interpolated, and whether any is an
estimate.

## 3. The flat pattern

The flat is computed from the body's B-rep and the sheet's T and K alone (R12.2, D117): not from the feature history.
A body read back from STEP, with no names and no history, unfolds to the same flat (to 10⁻⁹ in the tests), given T and K.

| Stage | What it does | Function |
|---|---|---|
| Fixed face | The named planar face (its largest piece), else the largest planar face | `pickFixed` |
| Skin | The faces reached from it across smooth edges, each with its development | `developSkin` |
| Thickness | The other skin T away; every other face a cut square to the sheet | `checkThickness` |
| Outline | The skin's boundary walked through the B-rep's loops; each piece's exact image | `outline`, `imageOf` |
| Volume | The body's volume against T times its skin at the middle | `checkVolume` |
| Bends | Each cylinder of the skin: its angle, radius, K, BA, tangent and centre lines | `bendsOf` |
| Overlaps | The flat must not cover itself | `checkOverlaps` |

A part's `flatPatternOf(output)` uses the sheet's own rules and fixed face: a plate's `top`, a profile's `leg0.a`.
`fixedFace` and `kFactor` can be given instead.

<SheetUnfold />

The developments are exact maps. A plane is moved rigidly: x ↦ o₂ + ((x − o₃)·e₁) f₁ + ((x − o₃)·e₂) f₂. A cylinder of
radius ρ is unrolled at its neutral radius, ρ − T + K·T where the skin is its outside, ρ + K·T where the skin is its
inside: a point at axial distance s and angle φ goes to o₂ + s f<sub>a</sub> + (R + K·T) φ f<sub>x</sub>. Each new
face's frame is built at the straight tangent line it is reached across, from the face before. One rule serves plane to
cylinder, cylinder to plane and cylinder to cylinder.

The outline's pieces are lines, circular arcs (a plane's circles), or splines (any other planar curve, its control
points moved by the plane's affine map). On a bend only lines are possible. Consecutive collinear lines, and arcs of one
circle, are joined. The flat is seen from the fixed face's outside, its x axis world X in that plane (else Y), and moved
so its box starts at (0, 0). Each bend is reported `up` when it folds towards the viewer and `down` when it folds away.

The checks hold the flat to what a sheet is. Lengths are compared to 10⁻⁷ times the body's largest vertex coordinate (at least 1 mm).

- **Smooth.** Two faces meet smoothly when their outward normals agree to 1 − 10⁻⁹ at the edge's three quarter points.
- **Thickness.** A face off the skin is either the other skin (a plane T away facing back, or a coaxial cylinder at
  ρ ∓ T) or a side face, which must meet the skin square at its edges' quarter points (|n₁·n₂| ≤ 10⁻⁷).
- **Volume.** The body's volume must be T times the skin at the sheet's middle: planes' developed area, bends' developed
  area × (R + T/2)/(R + K·T). The two agree to 10⁻⁷ relative, or the body is no sheet of T.
- **Overlaps.** No two pieces of the outline (arcs sampled at π/64) may cross or overlap along a line, found with a
  uniform grid; a touch at a point is allowed. A point inside each skin face, developed, must lie inside the outline
  once: a winding number of 2 means two faces landed on one place.

## 4. Reliefs

Where a flange stops inside an edge, the plate next to the bend would tear. A relief is cut there first. Its kind and
sizes are always given: the kernel has no relief defaults (D119).

- **Flange reliefs.** A `sheet-flange` with `offsets` narrower than its edge needs a `relief` at each end inside the
  edge: `rectangular` or `obround`, with its `width` and its `depth` past the bend, or `{ kind: 'none' }`. Left out, it
  is refused `RELIEF_REQUIRED`. An obround relief needs a depth of at least half its width; a relief that does not fit
  beside the flange is refused `BEND_DOES_NOT_FIT`.
- **Corner reliefs.** A `sheet-corner-relief` cuts the plate's corner away before the corner's two flanges: a `square`
  of side `size` along both edges, or a `round` quarter of radius `size` about the corner, through the sheet. It must
  take exactly the plate's corner, size² T or π size² T / 4 (to 10⁻⁸ relative), and leave one piece, else
  `CORNER_NOT_CLEAR`. Corners must be square and convex (`CORNER_NOT_SQUARE`). Flanges on both edges then stop `size`
  from the corner and meet nowhere.

An edge flange also sets where its bend sits. `length` is measured to the outer virtual sharp (`measure: 'outer'`, the
default), the inner one (`'inner'`), or from the tangent line (`'tangent'`). `position: 'material-inside'` (the default)
puts the outer sharp on the edge and trims the plate back by OSSB; `'material-outside'` puts the inner sharp there and
trims R·tan(θ/2); `'bend-outside'` starts the bend at the edge. A flange that runs into the sheet is refused
`FLANGES_COLLIDE`: the union's volume must equal the plate's and the flange's to 10⁻⁸ relative.

## 5. The flat as DXF

`flatPatternDxf(flat)` turns a flat into a document for the kernel's DXF writer ([Exchange formats](/packages/cad/formats#dxf)),
in millimetres:

| Layer | Colour | What is on it |
|---|---|---|
| `OUTLINE` | 7 | The outline: LINE, ARC, CIRCLE (a closed arc), SPLINE |
| `BEND_UP` | 3 | Each up bend's centre line, line type DASHED (5, −2.5) |
| `BEND_DOWN` | 1 | Each down bend's centre line, DASHED |
| `BEND_NOTES` | 2 | A TEXT at each centre line's middle, along it and kept upright: `DOWN 90° R2` (height 2.5 unless given) |

## Where it is in the code

| File | Responsibility |
|---|---|
| `packages/barocss-cad/src/frame-sheet/sheet-metal.ts` | `bendAllowance`, `outsideSetback`, `bendDeduction`; the contour flange's section (`contourFlangeSection`) and its self-contact test; the edge flange's section (`flangeSection`); bend tables (`bendTableProblem`, `rowKFactor`, `lookupBend`) |
| `packages/barocss-cad/src/frame-sheet/sheet-flat.ts` | `flatPattern`: the fixed face, the skin's developments, the checks, the outline, the bends; `flatPatternDxf` |
| `packages/barocss-cad/src/part/part-sheet.ts` | The four sheet features' inputs, their checks and the sheet's report |
| `packages/barocss-cad/src/part/part-model.ts` | `sheetFlange` (trim, reliefs, union, collision test), `sheetCornerRelief`, `bendK`, `flatPatternOf` |

## How it is checked

The tests' oracles are written from the definitions, never by the unfolder: the textbook flat length A + B − BD, the
K-factor's area identity (the flat's area is V/T + (K − ½)·T·Σθw, V the kernel's volume, w each bend's width), and
closed forms of cut-outs.

- `packages/barocss-cad/test/r12-1.test.mjs`: contour flanges (an L at any angle, a hat, a zed, a channel) against
  textbook volumes; each bend's allowance, setback and deduction; the base flange; the refusals.
- `packages/barocss-cad/test/r12-2.test.mjs`: the flat of a channel with a hole, of an L at 30° to 150° (also through
  STEP), of a tray of four flanges; `NON_NORMAL_CUT`, `NOT_A_SHEET`, `BEND_NOT_CYLINDRICAL`, `FLAT_OVERLAPS`; the DXF,
  and the DXF cases in `conformance/r12/flat-dxf/` (`channel-hole`, `tray-holes`, `pcb-enclosure`) reproduced byte for
  byte and read back by ezdxf.
- `packages/barocss-cad/test/r12-3.test.mjs`: edge flanges in each position at 30°–150°, part width with each relief,
  trays, the report dropped past moves; corner reliefs and their refusals.
- `packages/barocss-cad/test/r12-4.test.mjs`: a row's K, BA or BD honoured by the flat; linear and bilinear lookup; a
  sheet on a table through STEP; `BEND_TABLE_MISS` and the table's own refusals.
- `packages/barocss-cad/test/r12-s0.test.mjs`: the feasibility probe the unfolder grew from (D115).
- Conformance cases in `packages/barocss-cad/conformance/r12/` (run by `test/conformance.test.mjs`): among them
  `flat-l-bracket-120`, `flat-channel-hole`, `table-l-bracket-deduction`, `corner-relief-box-square`,
  `flange-part-width-obround` and one `refuse-*` case for each refusal above.
- `packages/barocss-cad-model/test/sheet.test.ts` and `sheet-acceptance.test.ts`: the studio's sheet commands, the
  flat in a body's notes, its DXF download, a bend table's rows named in the notes; the L-bracket and the PCB enclosure
  an agent builds.

## Limits

| Refusal | When |
|---|---|
| `BEND_ANGLE` | A path corner in line or turning back 180°; a flange angle outside (0, 180)°. Hems are not supported yet |
| `BEND_DOES_NOT_FIT` | A leg or a flange shorter than its setbacks; offsets that leave nothing; a plate too narrow behind the edge for the trim; a relief that does not fit |
| `SHEET_CROSSES_ITSELF` | A contour section that meets or touches itself |
| `EDGE_NOT_SHEET` | A flange edge that is not straight, or not between a skin and a thickness face; a corner edge that is not T long between two thickness faces |
| `RELIEF_REQUIRED` | A flange ending inside its edge with no relief said |
| `FLANGES_COLLIDE`, `SHEET_IN_PIECES` | A flange or its cut running into the sheet; reliefs that cut the sheet in two |
| `CORNER_NOT_SQUARE`, `CORNER_NOT_CLEAR` | A corner relief at a corner that is not square and convex, or a cut that would take more than the corner |
| `BEND_TABLE`, `BEND_TABLE_MISS` | A table that fails its checks; a bend with no matching row or rows round it |
| `NOT_A_SHEET` | Mesh faces; a body in pieces; no planar face; a face T away in the wrong place or at another distance; a smooth curved edge; a bend tighter than T; the volume identity failing |
| `NON_NORMAL_CUT` | A cut meeting the sheet off square |
| `BEND_NOT_CYLINDRICAL` | A smooth continuation of the skin that is not a plane or a cylinder |
| `FLAT_OVERLAPS` | A flat that would cover itself |
| `CUT_ACROSS_BEND` | An edge on a bend that does not develop to a straight line (a guard: no cut today's features make reaches it) |

Through `flatPatternOf`, flat refusals become the part's `GEOMETRY` errors, `CUT_ACROSS_BEND` a `CAPABILITY` error, with
the code in the message. See [Refusals](/reference/refusals) for the full list.
