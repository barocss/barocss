<script setup>
import LoftRevolve from '../.vitepress/components/algorithms/LoftRevolve.vue';
import LoftSections from '../.vitepress/components/algorithms/LoftSections.vue';
import LoftSweep from '../.vitepress/components/algorithms/LoftSweep.vue';
</script>

# Lofts, sweeps and revolves

Most solids start as a flat profile, a closed loop of lines and arcs in a sketch. The features on this page turn such
profiles into faces and solids: `revolve` turns one about an axis, `extrude` with a draft pushes one up while its walls
lean, `sweep` and `sweep-curve` carry one along a path, and `loft` joins several. The [fillet](/how/fillets) tools are
built the same way, from sections the rolling ball leaves. The features are listed in
[Modeling](/packages/cad/modeling); this page shows how their surfaces are made.

Each figure plays its steps as you reach it. Use **Play**/**Pause**, the arrows or a step's number to go through it at
your own pace; with reduced motion turned on in your system, each step is shown still. The methods, the formulas and
the constants are the kernel's, in `packages/barocss-cad/src/`. The words *control point*, *weight* and *knot* are
those of the [NURBS page](/how/nurbs).

## The builders at a glance

| Feature | What it makes | Faces | Source |
|---|---|---|---|
| `revolve` | A profile turned about an axis in its plane, by 0 &lt; α ≤ 360° | Exact: planes, cylinders, cones, spheres, tori, as rational patches | `features/revolve.ts` (`revolveProfile`) |
| `extrude` with `draft` | A profile pushed up, every wall leaning by the draft angle | Exact: sloping planes, cone patches | `features/drafted-extrusion.ts` (`draftedExtrusion`) |
| `sweep` | A profile along straight runs and circular bends | Exact: prisms and revolves, glued at their shared sections | `part/part-model.ts` (`sweepBrep`) |
| `sweep-curve` | A profile along any NURBS curve | Faceted: flat triangles between rings of exact points | `brep/sweep-solid.ts` (`sweepSolid`) |
| `loft` | Profiles at heights, or on frames, joined | Exact: ruled patches, or C1 cubic patches through every section | `features/loft.ts` (`loftSolid`) and the files it calls |

The kernel also builds lofted *surfaces* from NURBS section curves, with no solid around them. They are in the last
part of section 4.

## 1. Revolve

The profile lies in the sketch plane; so does the axis, a point o and a direction d. Each point is written as (h, ρ):
h along the axis, ρ its distance from it. The profile must lie on one side of the axis. It may touch the axis only at a
vertex (a pole: a sphere's top, a cone's tip) or run along it for a whole line, which then bounds no face.

<LoftRevolve />

Every circle is exact. `unitArc` cuts the turn of one part into ⌈Δ<sub>part</sub> / 90° − 10⁻¹²⌉ pieces of equal angle
Δ. Each piece is a rational quadratic: its ends on the circle with weight 1, its middle control point on the bisector at
ρ / cos(Δ/2) with weight cos(Δ/2). The turn itself is split into parts first: a full turn into two halves, 0–180° and
180–360°, so a face never closes on itself; a turn above 180° into two equal parts; anything else is one part. So a full
turn makes each wall two faces (named `…#1`, `…#2`), each of two 90° pieces.

A wall is one patch: degree 2 round the axis, and the profile segment's own degree along it (1 for a line, 2 for an arc
piece). Its control points are the arc's poles laid round each profile control point, and its weights are the products
of the two. A line square to the axis (its h the same at both ends, within 10⁻¹² × max(1, |h|)) gives a flat ring or
disc instead, written as a bilinear patch in its plane; a partial turn is closed by two flat end caps, the profile at 0
and at α.

Before it builds anything, `revolveProfile` checks the profile against the axis. Arcs are checked at their ends and at
the points of their circle nearest to and farthest from the axis; whether those points lie on the arc is decided in
exact rational arithmetic, so a tangency is found wherever it is, not only at samples. It refuses a profile that crosses the axis, touches it inside a segment, or lies on it, and a full
turn whose profile meets the axis at a single vertex between two walls: that solid would pinch to a point. Bores (holes
in the profile) must lie strictly inside it and apart from each other; they become inner walls.

The volume, centroid and inertia of a revolve are in closed form: dV = ρ dφ dA, the φ integrals done exactly, the
profile's moments by Green's theorem. See [Volume, centroid and inertia](/how/mass-properties).

A second, smaller builder, `buildZAxisRevolvedSurface`, turns one NURBS meridian curve (in the XZ plane, degree 1 … 3,
2 … 16 control points, radius 0.001 … 10 000 mm) a full turn about the Z axis as a single surface. It uses one closed
circle of four 90° pieces: 9 control points, knots [0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 4], weights 1, √½, 1, … It checks
the surface's boundary against the meridian and the circles to 10⁻⁷ mm, and that the seam closes.

## 2. Extrude with a draft

`draftedExtrusion` pushes a profile from z<sub>0</sub> to z<sub>1</sub> and leans every wall into the material by the
draft angle θ. The top section is the bottom one moved inwards by d = (z<sub>1</sub> − z<sub>0</sub>) tan θ: each line
parallel to itself, each arc about its own centre: to radius r − d where the arc bulges out of the profile, r + d where it
cuts in. A negative θ leans the walls out.

| Bottom segment | Wall |
|---|---|
| Line | A sloping plane: the bilinear patch from the bottom line to the moved top line |
| Arc | A cone patch: the arc's rational quadratic below, the moved arc above, straight between (degree 1 up) |

Where two segments meet tangentially, the corner moves along their shared normal, so the walls stay tangent. Where two
lines meet at an angle, the top corner is where their moved lines cross. A corner between an arc and another segment that
is not tangent is refused (*not supported yet*), as is a draft that closes a wall before the top (a line whose moved
copy runs backwards, an arc whose radius reaches zero), an angle of 89° or more, and a height that is not positive. The
part model's separate `draft` feature, which tilts chosen faces of a body that already exists, is a different operation
and is not covered here.

## 3. Sweeps

### Along straight runs and bends

The `sweep` feature's path is a list of steps: `straight` (a length) and `bend` (a radius, an angle in (0°, 180°], and
a side: x, −x, y or −y of the profile). It is exact because each step is a feature already described: a straight run is
the profile extruded, a bend is the profile revolved about an axis lying in its plane, `radius` away on that side. After
each bend the profile's frame is turned about that axis by the bend's angle, so the next step starts where it ended and
the profile never turns about the path.

Consecutive pieces meet in a whole cross-section. When no two pieces other than neighbours have overlapping boxes, the
pieces are glued along those sections; otherwise (a path that comes back near itself, as a ring of four bends does) they
are united by a [Boolean](/how/boolean). The mass is the sum of the pieces' closed forms only when every join was a glue;
after a Boolean it is computed from the final body, so an overlap is not counted twice (D168). A bend whose radius does
not clear the profile is refused: the profile reaches the bend's axis.

### Along any curve

`sweep-curve` takes a NURBS path. The profile cannot be carried exactly along a general curve, so the result is a
faceted solid: exact points on rings, flat triangles between them. The question is how to orient the profile at each
ring.

<LoftSweep />

The kernel uses a *rotation-minimising frame*, computed by the double reflection method: two reflections a step, each
a few dot products. The frame turns with the path's tangent and does not
spin about it. The Frenet frame, which follows the curve's curvature, would spin where the bending changes side and
is undefined on a straight run.

The profile's arcs become chords of at most 11.25° (π/16) before the sweep; holes in the profile run through as bores.
A closed path (its two ends within 10⁻⁹ × max(1, L) of each other) is refused, as is a path that stops (a zero tangent). At a corner
of the path, where the curve has no derivative, the tangent is taken from the neighbouring samples. The mesh is turned
into a B-rep by `brepFromTriangles`, which checks that it is closed and consistently wound, with at most 400 000
triangles.

## 4. Lofts

### Sections at heights

The `loft` feature with sections at heights z is the main path. It makes every pair of sections alike, piece for piece,
then joins them, either *ruled* (straight from each section to the next) or *smooth* (one cubic through all of them).

<LoftSections />

Making the sections alike takes three rewrites, none of which changes a section's shape:

| Rewrite | How | Why |
|---|---|---|
| Same number of pieces | Arcs cut into spans of at most 90°; then, in a section with fewer pieces, the longest piece halved (the first of equal ones) until the counts agree | Piece i of one section is joined to piece i of the next |
| Same start | The starts about their centroid, over their rms radius; the cyclic shift with the least sum of squared distances to the previous section's | So the sides do not twist round: each piece is joined to the nearest one above |
| Same degree | A line opposite an arc written as a quadratic, its middle point at its midpoint | A patch needs one degree across |

A *ruled* side between a line and an arc gives the line the arc's middle weight. Both rows then have the same weights,
so the section a fraction λ up is (1 − λ) C<sub>0</sub>(s) + λ C<sub>1</sub>(s), and its area moments are polynomials
in λ: the volume is exact by three-point Gauss–Legendre across, and correct to rounding by 24-point quadrature along. Two lines that are
neither parallel nor meeting give a twisted side; it is written as a quadratic too, with weight 1, and stays exact.

A *smooth* loft (`smooth: true`, three sections or more) joins each control point's homogeneous column (w x, w y, w z, w)
through the sections by a cubic in v, with non-uniform Catmull–Rom tangents. Its knots in v are 0 four times, each inner
section's v three times, 1 four times, v<sub>k</sub> = (z<sub>k</sub> − z<sub>0</sub>) / (z<sub>K</sub> − z<sub>0</sub>).
The side passes through every section exactly and is C1 across it. Neighbouring sides share their edge columns, so their
edges are the same curve. If a weight in the cubic turns zero or negative, which happens when the sections are too far
apart for the tangents, the loft is refused. On the figure's sections the kernel gives 1490.49 mm³ smooth and
1480.41 mm³ ruled.

### One polynomial guide on height sections

Two to eight ruled sections may take `guide: {kind: 'nurbs', degree, knots, controlPoints}`. The degree is 1–5,
with 2–64 control points (at least degree + 1), clamped non-decreasing knots and no rational weights. Each control
point must rise along the sections' common normal. The guide must pass through a vertex of every section and end
on the last section. The sections turn to start at those vertices.

Each slice is the ruled slice translated by the guide's departure from its chord at that height. The guide is cut
where it crosses each inner section. A side's control net uses the guide's normalized height coefficients in its own basis, so a nonlinear height
parameter does not change a taper. Mass uses max(2p + 2, ceil(5p / 2)) Gauss points per knot interval (13 for degree 5). A translated slice keeps its area, so the volume matches the unguided loft.

In Studio, **Loft** copies a polynomial direct curve selected in **Guide (copied)**. It sorts the picked parallel
sketches by height. Later edits of the direct curve do not change the loft. A single quadratic or cubic Bézier span
keeps the existing framed Bezier guide path below. Two guides, smooth guided sections and rational guides
remain unsupported.

Large polynomial guides keep the same source and input limit. Guided sides with more than 16 controls are split
at existing knots into patches with at most 16 controls along V. Adjacent patches share their boundary edges and
vertices. The original guide still supplies the mass integrals. This also handles 64-control guides crossing inner
sections without increasing the Curve or Surface limits. Existing valid small-guide results are unchanged.

The height path already supports a common non-XY sketch plane. Raw explicit frames also admit one polynomial
guide across two to eight ruled sections with line/arc profiles. All frame axes must be identical and form a
certified rigid basis. Section origins and world guide controls must reconstruct exactly through the common
local frame; inputs that fail this floating-point witness are refused. Sections retain their supplied order
and must have positive separation. Inline ellipse objects and different/nonparallel axes are outside this
polynomial-frame path. Circle and mixed line/arc profiles retain their original correspondence rules.

The raw frame adapter builds the local height loft once and places it once. It retains the original mass method;
native SI inertia keeps the existing typed `transformed` refusal. In Studio, open the current-schema recipe and
use the existing profile Width/Depth fields, Undo/Redo and Save/Open. No separate frame/guide editor is added.

The Model facade accepts the same polynomial guide. This tested example makes a square frustum with volume 7/3 mm³:

```ts
import { part, sketch } from '@barocss/cad-model/api';

const count = 17;
const knots = [0, 0, 0,
  ...Array.from({ length: count - 3 }, (_, i) => (i + 1) / (count - 2)),
  1, 1, 1];
const controlPoints = Array.from({ length: count }, (_, i): [number, number, number] =>
  [0, 0, (knots[i + 1] + knots[i + 2]) / 2]);
const model = part('Polynomial guide').loft([
  { sketch: sketch().rectangle({ w: 1, d: 1 }), z: 0 },
  { sketch: sketch().rectangle({ w: 2, d: 2 }), z: 1 },
], { guide: { kind: 'nurbs', degree: 2, knots, controlPoints } });
```

The actual Studio example below uses a 64-control cubic guide and the same physical frustum. The unit-scale
fixture has a nonzero mass below the inspector's displayed precision; native volume and centroid are checked
separately. This screenshot is an actual preview, not a generated design target.

![Studio previews a copied 64-control cubic guide between two square sections](/shots/studio/loft-polynomial-64.png)

### Sections on frames, twist and guides

A section can be placed on an explicit frame instead of a height: an origin and two unit, perpendicular axes (checked to
10⁻⁹). Without a polynomial guide, `orientedLoftSolid` admits the following families, each with its own proof that the solid does not fold:

| Sections | Admitted when | Sides |
|---|---|---|
| Two strictly convex polygons, equal edge counts | The second is an exact affine image of the first, on any two planes; or both frames have identical axes | Ruled, one patch an edge. The Jacobian det(A(t), B(t), D(q)) must stay positive at every vertex over the whole span, its minimum found exactly (it is quadratic in t). With identical axes, every in-between polygon must stay strictly convex, checked the same way |
| Two to eight circles or ellipses, seam at +X | Parallel frames with identical axes, in order | Ruled, exact: every in-between section is an ellipse with radii linear in t (`curved-loft.ts`) |
| Two loops of lines and arcs | The second is the first scaled by a positive factor and moved | The ruled loft above, in a common frame (`framed-mixed-loft.ts`) |

A frame may be turned against the other: a quarter turn of a square between its two frames is a valid twisted loft. A
half turn is refused, because the section collapses on the way even though both ends are fine. Smooth sides are not
available on frames.

A two-section loft of conics or of mixed loops on frames may take one *guide*: a quadratic or cubic Bézier curve for its seam, from the first cap's
+X seam point to the second's, both exactly. The middle control point must lie exactly on the plane halfway between the
caps (a cubic's two on the one-third and two-thirds planes). Every ruling is then moved by the same sideways offset as
the guide, 2t(1 − t) d for a quadratic, so each side becomes a patch of the guide's degree in v and every section stays a
translate of the ruled one.

### Surfaces from NURBS sections

These builders take section curves and give one surface, not a solid. Each checks its result against its inputs at
sample parameters, to 10⁻⁷ mm, and refuses rather than repairs.

| Function | Sections | What it does |
|---|---|---|
| `buildCompatibleRuledSurface` | Two, with the same degree, control point count, knots and weights, bit for bit | Pairs control point i of each into one row; degree 1 across. Nothing is made compatible for you |
| `buildRationalRuledSurface` | Two of the same degree and control point count on the same knots, each with its own weights | Rows (P<sub>0,i</sub>, P<sub>1,i</sub>) with weights (w<sub>0,i</sub>, w<sub>1,i</sub>): S(u, v) = ((1 − v) W<sub>0</sub> C<sub>0</sub> + v W<sub>1</sub> C<sub>1</sub>) / ((1 − v) W<sub>0</sub> + v W<sub>1</sub>), W the curves' denominators. Not the plain average (1 − v) C<sub>0</sub> + v C<sub>1</sub> |
| `buildAlignedRationalRuledSurface` | Two of the same degree on the same domain | The union of their interior knots, each at the larger multiplicity (at most the degree); the knots each section lacks inserted (Boehm, see [NURBS](/how/nurbs)), at most 14 in all; then the rational ruled surface. At most 16 control points and 20 knots after |
| `buildDegreeMatchedBezierRuledSurface` | Two single Bézier spans | Each raised one degree at a time to a target of 2 or 3, then the rational ruled surface |
| `buildMultiSectionLoftSurface` | 2 … 15 compatible sections at increasing v | Each row of control points interpolated through the sections (`buildInterpolatingCurve`, degree 1 … 3 in v, averaged knots, pivoted solve); the sections' common weights kept along v; first and last rows copied bit for bit |
| `buildThreeSectionLoftSurface` | Three compatible sections | Quadratic in v through v = 0, ½, 1: the middle homogeneous row is 2 H<sub>middle</sub> − ½ (H<sub>first</sub> + H<sub>last</sub>), so the surface at v = ½ is the middle section. Refused if a weight made this way is not positive or leaves [10⁻⁶, 10⁶] |
| `buildPiecewiseRationalLoftSurface` | 2 … 15 sections with common degree, count and knots | Degree 1 in v, through each section at its station, each keeping its own weights |

## Where it is in the code

All paths are under `packages/barocss-cad/src/`.

| File | Responsibility |
|---|---|
| `features/revolve.ts` | `revolveProfile`: axis checks, `unitArc`, stations, wall patches, caps, bores; `revolveMassProperties` |
| `nurbs/surfaces/z-axis-revolved-surface.ts` | `buildZAxisRevolvedSurface`: a NURBS meridian turned once about Z |
| `nurbs/surfaces/surface-revolution.ts` | `revolutionOf`: recognises a NURBS patch as a surface of revolution (its axis and meridian), as revolves make them |
| `features/drafted-extrusion.ts` | `draftedExtrusion`: the moved top loop (`offsetLoop`), sloping planes and cone patches |
| `part/part-model.ts` | The `revolve`, `extrude` (with `draft`), `sweep`, `sweep-curve` and `loft` features; `sweepBrep` (runs and bends, glue or union); `loopPoints` (arcs to chords for `sweep-curve`) |
| `brep/sweep-solid.ts` | `sweepSolid`: sampling, the double-reflection frames, rings, caps, the closed mesh |
| `brep/brep-glue.ts` | `glueAtSharedFace`: two bodies joined along a shared section |
| `features/loft.ts` | `loftSolid`: pieces, turn, degree match, ruled sides (`legacyLoft`), smooth sides (`smoothLoft`), their mass integrals |
| `features/oriented-loft.ts`, `features/curved-loft.ts`, `features/framed-mixed-loft.ts` | Lofts on frames: polygons with their fold certificates, conics, mixed loops |
| `features/loft-nurbs-guide.ts` | Polynomial guide admission, bounded section crossings, chord elevation and per-span mass integrals |
| `features/loft-guide-patches.ts` | Split oversized guided sides at native knots with shared ruling segments and interior rings |
| `features/framed-nurbs-loft.ts`, `features/loft-common-frame.ts` | Certified common-frame polynomial guide adapter and shared rigid placement/mass |
| `features/loft-guide.ts` | `admitLoftGuide`: the quadratic and cubic seam guides and their offsets |
| `nurbs/surfaces/compatible-ruled-surface.ts`, `nurbs/surfaces/rational-ruled-surface.ts` | Ruled surfaces between two compatible sections |
| `features/section-knot-alignment.ts` | `buildAlignedRationalRuledSurface`: knot union, insertion, ruled |
| `nurbs/surfaces/degree-matched-bezier-ruled.ts` | `buildDegreeMatchedBezierRuledSurface` |
| `features/multi-section-loft.ts`, `features/three-section-loft.ts`, `features/piecewise-rational-loft.ts` | Lofted surfaces through many, three or piecewise sections |
| `nurbs/curves/curve-interpolation.ts` | `buildInterpolatingCurve`: the row interpolation the multi-section loft uses |

## How it is checked

| Test | What it covers |
|---|---|
| `packages/barocss-cad/test/freeform.test.mjs` | *Revolved solids*: torus, cones, tube, half torus, 270° cone, sphere with poles, sphere wedge, solid cone and cylinder, an axis along x: valid, watertight, volumes; the closed-form torus volume to 10⁻¹²; the refusals (crossing, touching inside a segment, pinching, angle 0) |
| `packages/barocss-cad/test/revolve-axis-admission.test.mjs` | An arc tangent to the axis between samples, and a narrow crossing, refused; tilted axes; axial lines and semicircle poles kept |
| `packages/barocss-cad/test/frk-4-revolve.test.mjs` | Revolves with bores: rectangular and round tubes, offset bores, the bore refusals |
| `packages/barocss-cad/test/drafted-extrusion.test.mjs` | Boxes leaning in and out, an L, a slot (cones on tangent arcs), a cylinder: volumes against the integral of the shrinking area; the two collapse refusals; draft in the part model with holes and fillets |
| `packages/barocss-cad/test/part-model.test.mjs` | *sweep*: a 90° bend, a U, bends in two planes, a ring of four bends (genus 1), against Pappus to 10⁻¹² and the body's mesh; the bend-axis refusal. *loft*: frustums, an oblique cylinder, a twisted square (exact volumes to 10⁻¹²), a triangle to a hexagon. *smooth loft*: a frustum exactly 2800 mm³, the figure's circle–square–circle, a vase that is C1 at its middle sections |
| `packages/barocss-cad/test/sweep-solid.test.mjs` | `sweep-curve`: a bent rod within 1 % of Pappus, its start cap on the path's start, a tube with its bore, the closed-path and bad-curve refusals |
| `packages/barocss-cad/test/interpolated-hole-sweep-regression.test.mjs` | An interpolated space curve as the path of a holed sweep, saved and read back; mismatched weights refused |
| `packages/barocss-cad/test/oriented-loft.test.mjs` | Lofts on frames: prisms between unparallel caps, a twist, the half-turn refusal, non-affine polygons, circles and ellipses, mixed loops, every typed refusal |
| `packages/barocss-cad/test/framed-polynomial-guide.test.mjs`, `packages/barocss-cad-model/test/framed-polynomial-guide.test.ts` | Raw framed polynomial guides: placement, mass, bounded profiles, retained data and typed refusals |
| `packages/barocss-cad/test/loft-nurbs-guide.test.mjs` | Polynomial guide: Cavalieri volume, independent de Boor centroid integration, knot and section crossings, strict B-rep and watertight mesh, typed refusals |
| `packages/barocss-cad/test/loft-multi-conic.test.mjs`, `loft-cubic-guide.test.mjs` | Four and eight conic sections; the cubic seam guide; their refusals |
| `packages/barocss-cad-model/test/api-multi-conic-loft.test.ts`, `api-loft-guide.test.ts` | The same through the studio's API |
| `packages/barocss-cad/test/k7b-fit-plain.test.mjs` | `buildInterpolatingCurve` against a plain fit |

The NURBS-section surface builders have no test file of their own: their checks are the assertions in their demos in
`examples/cad-nurbs/`, and `packages/barocss-cad/test/nurbs-demos.test.mjs` runs the ones that run in a fresh checkout
(compatible, degree-matched and rational ruled surfaces, the piecewise loft, section knot alignment). The multi- and
three-section loft demos import the TypeScript sources directly and do not run there.

## Limits

- `sweep-curve` is faceted, not exact. Nothing checks that its walls do not cross each other, as they would where the
  path bends tighter than the profile is wide. Closed paths are refused.
- `sweep` takes one loop with no holes; its path has 1 … 64 steps, bends of at most 180° to one of four sides.
- `loft` at heights: 2 … 64 sections, each above the one before. Smooth sides need three or more sections. On frames:
  the families in the table above and the certified common-frame polynomial path only; no smooth sides.
  Bezier guides use two sections; polynomial guides use two to eight.
- Draft: corners between an arc and a segment it does not meet tangentially are refused.
- The NURBS-section builders take curves of degree 1 … 3 with at most 16 control points, and make nothing compatible
  unless that is their job (knot alignment, degree matching). Their reports say their shape is checked at samples, not
  certified (`geometricValidity: 'not-certified'`).
