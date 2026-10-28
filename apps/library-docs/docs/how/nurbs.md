<script setup>
import NurbsBasis from '../.vitepress/components/algorithms/NurbsBasis.vue';
import NurbsWeights from '../.vitepress/components/algorithms/NurbsWeights.vue';
import NurbsRefine from '../.vitepress/components/algorithms/NurbsRefine.vue';
</script>

# NURBS curves and surfaces

The kernel's free-form geometry is NURBS: non-uniform rational B-splines. A curve is a list of control points, a weight
for each and a knot vector; a surface is a grid of control points with a knot vector in each direction. The Boolean's
patches ([Booleans of curved solids](/how/boolean)), the studio's direct curve and surface tools and the IGES exchange all
carry this data. This page shows how the kernel turns it into points and tangents, and how it changes the data without
changing the shape: inserting knots, splitting, cutting into Bézier pieces and raising the degree.

The figures play their steps as you reach them. Use **Play**/**Pause**, the arrows or a step's number to go at your own
pace; with reduced motion turned on in your system, each step is shown still. They run small cases in the page with the
kernel's formulas, or show the built kernel's own output; each figure's note says which.

## The data

Coordinates are in millimetres; parameters and weights have no unit (`src/types.ts`).

| Field | Curve | Surface |
|---|---|---|
| Degree | `degree` p | `degreeU`, `degreeV` |
| Knots | `knots`: n + p + 1 numbers | `knotsU`, `knotsV` |
| Control points | `controlPoints`: n points [x, y, z] | `controlPoints[i][j]`: rows follow U, columns follow V |
| Weights | `weights`: one per point | `weights[i][j]` |

The curve's parameter runs over [u<sub>p</sub>, u<sub>n</sub>], the knots at index p and n (`curveDomain`). The
kernel admits only clamped knot vectors: the first p + 1 knots equal, the last p + 1 equal, every one in between strictly
inside the domain. A clamped curve starts at its first control point and ends at its last.

## Basis functions and a point on the curve

Each control point P<sub>i</sub> has a basis function N<sub>i,p</sub>(u), a bump over the knots u<sub>i</sub> …
u<sub>i+p+1</sub>. The curve point is the average of the control points weighted by their basis values (and their
weights w<sub>i</sub>, all 1 in this first figure):

C(u) = Σ N<sub>i,p</sub>(u) w<sub>i</sub> P<sub>i</sub> / Σ N<sub>i,p</sub>(u) w<sub>i</sub>

<NurbsBasis />

The kernel's `basisInto` (in `core/math.ts`) computes the basis by the Cox–de Boor recursion in its triangular form, the
one in most NURBS texts:

- It finds the knot span holding u by binary search. The right end of the domain uses the last span, so u = u<sub>n</sub>
  is a valid parameter. A parameter outside the domain is refused.
- It computes only the p + 1 basis values that are nonzero in that span, level by level, from the left and right knot
  distances u − u<sub>j</sub> and u<sub>j</sub> − u. Each distance is divided by max(1, |u<sub>p</sub>|,
  |u<sub>n</sub>|); if the subtraction itself overflows, both terms are divided first. A domain from −10³⁰⁸ to 10³⁰⁸
  still evaluates. A fraction with denominator 0 counts as 0.
- It divides by each denominator rather than multiply by its reciprocal, which would change the last bit (D243).

`curvePoint` then forms the two sums and divides. If every control point has the same value in one coordinate (a curve in
the plane z = 5, say), the point takes that value exactly, so rounding cannot move a planar curve off its plane.

There are two ways to call it. `evaluateCurve` validates the curve on every call. `curveEvaluator` validates once and
returns a function with its own buffers; its points are bit-identical to `evaluateCurve`'s. `surfaceEvaluator` does the
same for a surface. It also keeps the last U or V basis when the next call repeats that parameter, as an iso-curve or a
difference stencil does.

### Tangents

`evaluateCurveD1` (in `core/derivatives.ts`) returns the point and the first derivative together. The derivative of a
basis function is a difference of two values one degree lower, taken from the same table. The rational quotient rule
then gives C′ = (A′ − W′ C) / W, where A = Σ N w P and W = Σ N w. Three rules apply:

- Derivatives are in the curve's own knot units: millimetres per unit of u.
- At an interior knot repeated p times or more the curve may have a corner. There the kernel refuses with
  *First derivative is not defined at an exact C0 interior knot*. It refuses even when the control points happen to line
  up and there is no corner.
- The domain's ends use the inside span. A zero tangent is a valid result; regularity is not claimed.

## Weights: exact circles

With every weight 1 the curve is a polynomial B-spline, and no polynomial traces a circle exactly. A weight changes how
strongly its point pulls. With the right weights a quadratic gives an exact conic: the kernel's own test makes a quarter
circle from three points with weights 1, cos 45°, 1.

<NurbsWeights />

The kernel stores the weights apart from the points. Operations that build new control points first lift each one to
homogeneous form P<sup>w</sup> = (w x, w y, w z, w), blend those four numbers, and divide back. Knot insertion, Bézier
span extraction and degree elevation all do this, so a rational curve stays the same rational curve. A control point
whose blend would get a weight of 0 or below is refused. Weights must lie in [10⁻⁶, 10⁶].

## Surfaces

A surface is the tensor product of two such bases: for each (u, v) a U basis over the rows and a V basis over the
columns, and the same quotient over the whole grid:

S(u, v) = Σ<sub>i</sub> Σ<sub>j</sub> N<sub>i,p</sub>(u) N<sub>j,q</sub>(v) w<sub>ij</sub> P<sub>ij</sub> /
Σ<sub>i</sub> Σ<sub>j</sub> N<sub>i,p</sub>(u) N<sub>j,q</sub>(v) w<sub>ij</sub>

Only (p + 1) × (q + 1) terms are nonzero at a point. `evaluateSurfaceD1` returns the two partial derivatives
S<sub>u</sub> and S<sub>v</sub> by the same rule as for a curve, in the surface's own parameter units; it does not
normalise them.

Operations along one direction work row by row. `insertSurfaceKnot` cuts the grid into strips along the chosen direction
(one per row or column across it). It inserts the knot into each strip as a curve with `insertCurveKnot`, and requires
every strip to give the same knots and the same insertion steps before it assembles the new grid. Degree elevation of a
surface direction (`elevateSourceSurfaceAxisDegree`) uses the curve elevation below on each strip, in the same way.

## Changing the data, not the shape

The same curve can be written with more knots and more control points, or as a chain of Bézier pieces, or at a higher
degree. These rewrites are how the kernel splits curves, adds detail for editing, makes curves alike for a loft, and
samples a curve to a tolerance.

<NurbsRefine />

**Knot insertion** (`insertCurveKnot`) is Boehm's method in homogeneous coordinates. Inserting ū into span k with
existing multiplicity s replaces p − s control points by points on the polygon's edges:

Q<sub>i</sub> = α<sub>i</sub> P<sub>i</sub> + (1 − α<sub>i</sub>) P<sub>i−1</sub>, &nbsp;
α<sub>i</sub> = (ū − u<sub>i</sub>) / (u<sub>i+p</sub> − u<sub>i</sub>), &nbsp; i = k − p + 1 … k − s

The kernel requires each α strictly between 0 and 1, and each new weight positive and finite. Points it does not replace
are copied bit for bit. It then evaluates the old and the new curve at every distinct knot and at the midpoint of every
span. If they differ by more than the curve's linear tolerance, it refuses. That tolerance is max(10⁻⁷ mm,
10⁻¹¹ × the largest coordinate), so 10⁻⁷ mm for any model up to 10 000 mm.

**Splitting** (`splitCurveAtParameter`) inserts the parameter until its multiplicity equals the degree. The control point
made last then lies on the curve; it is shared by the two halves, which take the poles and knots on each side.

**Bézier spans.** `extractCurveBezierSpans` gives one Bézier curve (p + 1 points, a single span) for each nonzero knot
span. It does not insert knots: it expands each basis function of the span into the Bernstein basis by the same
recursion, then combines the homogeneous points. It checks each span against the original at the start, the midpoint and
the end, to 10⁻⁷ mm. For the figure's curve it gives (0, 0) (5, 10) (7.5, 0) (10, 0) on [0, 0.5] and
(10, 0) (12.5, 0) (15, 10) (20, 0) on [0.5, 1].

**De Casteljau subdivision.** Halving a single Bézier span inserts its midpoint p times; on one span every α is ½, which
is de Casteljau's construction. The adaptive sampler (`sampleSourceCurveAdaptive`) halves each span this way until
every control point of a piece is within the requested chord tolerance of the piece's chord. The curve lies inside its
control points' convex hull, so it is then within the tolerance too.

**Degree elevation** raises a Bézier piece from degree p to p + 1, keeping its end points:

Q<sub>i</sub> = (i / (p + 1)) P<sub>i−1</sub> + (1 − i / (p + 1)) P<sub>i</sub>, &nbsp; i = 1 … p, in homogeneous form

`elevateSourceCurveDegree` does this on a single Bézier span or on a chain of them: a curve whose every interior knot has
multiplicity exactly p. It goes one degree per call, to a target of 2 to 5. A curve with smoother joins is refused. Make
it a chain first by inserting knots. `elevateBezierCurveDegree` is the smaller form for one span of degree 1 or 2.

## What the kernel checks on a curve

`validateCurve` runs before every evaluation through `evaluateCurve` and once in `curveEvaluator`. It refuses:

| Check | Refused when |
|---|---|
| Degree | not an integer in 1 … 5, or not smaller than the number of control points |
| Control points | fewer than 2 or more than 64; a coordinate not finite or beyond 10⁶ mm |
| Knot count | not equal to control points + degree + 1 |
| Knot order | a knot not finite, or smaller than the one before |
| Domain | u<sub>p</sub> ≥ u<sub>n</sub> (zero length) |
| Clamping | the first or the last p + 1 knots not all equal (*Knots must be open and clamped*) |
| Interior knots | one not strictly inside the domain, or repeated more than p times |
| Weights | not one per control point, or one outside [10⁻⁶, 10⁶] |
| ID | not an identifier (letter or _, then letters, digits, _ or -) |

`validateSurface` applies the same knot rules in each direction. It allows 2 … 16 control points per direction, at most
256 in all, and requires a rectangular grid with one weight per point.

**Guarded knots.** An interior knot repeated p times or more is a C0 join: the curve may turn a corner there, and the
first derivative is refused there (above). `guardKnots` (in `knot-guard.ts`) lists these knots. Knot insertion,
splitting and control polygon edits (`editCurveControlPolygon`) report them for the input and for the result;
`insertSurfaceKnot` does the same in each direction. A caller can see when an
operation has made a new possible corner, as the third insertion in the last figure does.

## Through given points

`buildInterpolatingCurve` makes a polynomial curve (all weights 1) through 2 … 16 points at parameters the caller gives,
of degree 1 … 3. Its interior knots are averages of p consecutive parameters. Each basis value is read by evaluating a
curve whose control points are all zero but one, so it is the evaluator's own number. The square system is solved by
Gaussian elimination with scaled partial pivoting. A pivot below 128 × machine epsilon times its row's scale is refused
rather than repaired. The curve is then checked to pass through every given point within 10⁻⁷ mm.

## Where it is in the code

All paths are under `packages/barocss-cad/src/`.

| File | Responsibility |
|---|---|
| `types.ts` | The `Curve` and `Surface` shapes |
| `core/math.ts` | `validateCurve`, `validateSurface`; `basisInto` (the basis); `evaluateCurve`, `evaluateSurface`, `curveEvaluator`, `surfaceEvaluator`; `sampleCurve`, `sampleSurface` |
| `core/derivatives.ts` | `evaluateCurveD1`, `evaluateSurfaceD1` and their evaluators: first derivatives, the C0-knot refusal |
| `numeric-policy.ts` | The linear tolerance `max(1e-7, 1e-11 × scale)` and the coordinate range |
| `nurbs/curves/curve-knot-insertion.ts` | `insertCurveKnot`: Boehm insertion in homogeneous form, with before/after observations |
| `nurbs/curves/curve-parameter-split.ts` | `splitCurveAtParameter`: insert to multiplicity p, cut at the shared point |
| `nurbs/curves/curve-bezier-spans.ts` | `extractCurveBezierSpans`: one Bézier per knot span (the arithmetic is in `nurbs/source-wide/curve-wide-adaptive-sampling.ts`) |
| `nurbs/curves/curve-bezier-subdivision-internal.ts` | Halving a Bézier span by p insertions at its midpoint |
| `nurbs/source-wide/source-curve-adaptive-sampling.ts` | `sampleSourceCurveAdaptive`: halving until each piece's control points are within tolerance of its chord |
| `nurbs/curves/bezier-curve-degree-elevation.ts` | `elevateBezierCurveDegree`: one span, degree 1 → 2 or 2 → 3 |
| `nurbs/curves/curve-c0-degree-elevation-internal.ts`, `nurbs/source-wide/source-curve-degree-elevation.ts` | Degree elevation of a Bézier chain, to degree 5 |
| `nurbs/curves/knot-guard.ts` | `guardKnots`: the interior knots of multiplicity ≥ p |
| `nurbs/curves/curve-interpolation.ts`, `curve-interpolation-kernel-internal.ts` | `buildInterpolatingCurve`: averaged knots, pivoted solve |
| `nurbs/surfaces/surface-knot-insertion.ts` | `insertSurfaceKnot`: curve insertion on every strip |
| `nurbs/surfaces/surface-control-net.ts` | `editSurfaceControlNet`: move points or change weights of a surface's grid |

## How it is checked

| Test | What it covers |
|---|---|
| `packages/barocss-cad/test/math.test.mjs` | The quarter circle: its ends, its radius within 10⁻⁹ mm over 129 samples, unchanged when every weight is × 123, and more than 0.1 mm off with weights 1. Also nonuniform and repeated knots, overflow-free tiny and huge knot domains, every refusal of malformed data, the largest accepted counts, and U rows / V columns on a quarter cylinder |
| `packages/barocss-cad/test/derivatives.test.mjs` | Derivatives of degree 1 … 5 Bernstein curves, rational and polynomial; the quarter circle's analytic tangent; refusal at a C0 knot (even when the poles cancel the corner); a doubly repeated cubic knot (C1) accepted; both partials of a weighted surface |
| `packages/barocss-cad/test/numeric-policy-range.test.mjs` | Splitting and sampling at 5 × 10⁵ mm; refusals beyond the geometry range |
| `packages/barocss-cad/test/k7b-fit-plain.test.mjs` | `buildInterpolatingCurve` against the plain fit `interpolateCurvePlain` on 31 parameter sets × degrees 1 … 3, equal to rounding; knot removal (`removeCurveKnotPlain`) |
| `packages/barocss-cad/test/property.test.mjs` (properties in `scripts/rb/property.mjs`) | *Knot insertion and degree elevation of a curved face keep the mass*: a solid's volume unchanged to 10⁻⁹ of itself after `insertSurfaceKnot` or `elevateSurfaceBezierAxisDegree`, on seeded random cases |
| `packages/barocss-cad-model/test/direct.test.ts` | The studio's curve and surface tools: split, insert a knot, raise a degree with the point at u = 0.3 unchanged within 10⁻⁹ mm |
| `packages/barocss-cad-model/test/fit.test.ts` | The figure's curve: a knot inserted at 0.25 comes out again by knot removal with the original poles |

Besides the tests, knot insertion, splitting, span extraction, degree elevation and interpolation check themselves on
each call. Each evaluates the original and the result at its own observation parameters (knots and span midpoints, or a
span's ends and midpoint, or the given points). It refuses if they differ by more than 10⁻⁷ mm (the linear tolerance,
for knot insertion and splitting).

## Limits

- Curves of degree 1 … 5 and 2 … 64 control points; surfaces of 2 … 16 control points per direction, 256 in all.
  Clamped, non-periodic knots only.
- `insertCurveKnot`, `splitCurveAtParameter` and `insertSurfaceKnot` take degree 1 … 3, at most 16 control points per
  direction after the change, and 1 … 3 insertions a call. The final multiplicity may not exceed the degree. The studio's
  source-level `insertSourceCurveKnot` takes degree up to 5, one insertion a call.
- Degree elevation needs a Bézier span or a chain of them; it raises one degree a call, to 5 at most.
- `core/derivatives.ts` gives first derivatives, and none at a C0 knot. Curvature (`evaluateCurveCurvature`, in
  `nurbs/surfaces/local-curvature.ts`) is not covered on this page.
- Interpolation is polynomial, through points only: no end tangents, no periodic curves, no least-squares fit.
- Every result is checked at sample parameters, not certified over the whole domain. The reports say so
  (`geometricValidity: 'not-certified'`).
