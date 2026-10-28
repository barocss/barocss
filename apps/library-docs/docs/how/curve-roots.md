<script setup>
import RootsCubic from '../.vitepress/components/algorithms/RootsCubic.vue';
import RootsTangent from '../.vitepress/components/algorithms/RootsTangent.vue';
import RootsSpans from '../.vitepress/components/algorithms/RootsSpans.vue';
</script>

# Where a curve meets a plane

Several kernel operations need the points where a curve crosses a plane: where a curve enters a planar face
(`intersectCurveWithPlanarFaceMaterial`), or where it leaves a convex loop of lines in a plane
(`clipCurveWithConvexLineLoop`, which asks where the curve meets each line). The kernel answers
without sampling the curve or building a mesh. The curve's distance from the plane is a polynomial, and the kernel finds
that polynomial's roots, each in a bracket at most 10⁻¹² wide in the curve's parameter. When it cannot tell a tangent
from two close crossings, it refuses instead of guessing.

The figures play their steps as you reach them. Use **Play**/**Pause**, the arrows or a step's number to go at your own
pace; with reduced motion turned on in your system, each step is shown still. They run the kernel's own root solvers,
ported into the page, or show the built kernel's output; each figure's note says which.

## The functions at a glance

| Function | Curve | Against | Source (`packages/barocss-cad/src/`) |
|---|---|---|---|
| `intersectBezierCurveWithAffinePlaneSurface` | one Bézier span, degree 1 or 2 | an affine plane | `intersect/own-curve-plane-intersection.ts` |
| `intersectCubicBezierCurveWithAffinePlaneSurface` | one cubic Bézier span | an affine plane | `intersect/own-cubic-curve-plane-intersection.ts` |
| `intersectCurveWithAffinePlaneSurface` | degree 1 or 2, up to 8 spans and 12 control points | an affine plane | `intersect/own-multispan-curve-plane.ts` |
| `intersectCurveWideWithAffinePlaneSurface` | degree 1 or 2, up to 64 spans | an affine plane | `nurbs/source-wide/curve-wide-plane-intersection.ts` |
| `intersectCubicCurveWideWithAffinePlaneSurface` | degree 3, up to 64 spans | an affine plane | `nurbs/source-wide/curve-wide-cubic-plane-intersection.ts` |
| `intersectCoplanarCurveWithLineSegment` | degree 1 or 2, up to 8 spans, lying in a plane | a line segment in that plane | `intersect/own-curve-line-intersection.ts` |

All of them use two root solvers: one for degree 1 and 2 (`intersect/own-homogeneous-bernstein-roots.ts`) and one for
degree 3 (`intersect/own-cubic-bernstein-roots.ts`).

## 1. The distance is a polynomial

The plane is a degree 1 × 1 NURBS surface with four control points Q<sub>00</sub>, Q<sub>10</sub>, Q<sub>01</sub>,
Q<sub>11</sub> and four equal weights. Its origin is O = Q<sub>00</sub> and its axes are A = Q<sub>10</sub> − O and
B = Q<sub>01</sub> − O. The fourth point must be O + A + B, so the patch is flat, not twisted. The unit normal is
n̂ = A × B / ‖A × B‖. Axes that are too close to parallel are refused: the Gram determinant
‖A‖²‖B‖² − (A · B)² must be above 64 ε (‖A‖²‖B‖² + (A · B)²). Here ε = 2⁻⁵² is the spacing of binary64 numbers
near 1.

A rational Bézier curve of degree p is

C(t) = Σ B<sub>i,p</sub>(t) w<sub>i</sub> P<sub>i</sub> / Σ B<sub>i,p</sub>(t) w<sub>i</sub>, &nbsp; B<sub>i,p</sub>(t) = (p choose i) t<sup>i</sup> (1 − t)<sup>p−i</sup>,

with t running over [0, 1] on the span (see [NURBS curves and surfaces](/how/nurbs)). Its signed distance from the plane
is

n̂ · (C(t) − O) = Σ B<sub>i,p</sub>(t) c<sub>i</sub> / Σ B<sub>i,p</sub>(t) w<sub>i</sub>, &nbsp; c<sub>i</sub> = w<sub>i</sub> n̂ · (P<sub>i</sub> − O).

Every weight is positive, so the denominator is positive and the roots are those of the numerator
N(t) = Σ B<sub>i,p</sub>(t) c<sub>i</sub>. That is a polynomial in the same Bernstein form as the curve. Its
coefficients are the control points' distances times their weights (`curvePlaneCoefficientsTrusted`). The weights are
not normalised away. A nonzero distance whose product with its weight underflows to zero is refused.

Two facts about the Bernstein form do most of the work:

- **Exact ends.** N(0) = c<sub>0</sub> and N(1) = c<sub>p</sub>. A zero end coefficient is an exact root.
- **Convex hull.** N(t) stays inside the convex hull of the points (i/p, c<sub>i</sub>). If every c<sub>i</sub> has
  the same sign, N has no root, and nothing needs to be searched. The number of sign changes in the c<sub>i</sub> is
  also an upper bound on the number of roots in (0, 1). The kernel never uses that count; it isolates each root as
  below.

## 2. A cubic: turning points first, then halving

<RootsCubic />

The degree-3 solver (`solveCubicBernsteinRoots`) never uses a closed-form cubic formula. It cuts [0, 1] at the
distance function's turning points, so that each piece rises or falls, and halves a bracket in each piece that changes
sign:

| Step | What the code does | Refused when |
|---|---|---|
| Normalise | c̃ = c / max \|c<sub>i</sub>\| | a nonzero c̃<sub>i</sub> underflows, or two different neighbours become equal |
| Hull test | no root if every c̃<sub>i</sub> &gt; g, or every c̃<sub>i</sub> &lt; −g, with the guard g = 64 ε max(1, max \|c̃<sub>i</sub>\|) | — |
| Turning points | the derivative's Bernstein coefficients 3 (c̃<sub>i+1</sub> − c̃<sub>i</sub>) are passed to the degree-2 solver | that solver refuses (a stationary tangent) |
| Clear the turning points | each derivative root's bracket of radius r: \|f(centre)\| &gt; L r + g, with L = max \|c̃′<sub>i</sub>\| + g max(1, max \|c̃′<sub>i</sub>\|), and both bracket ends of the same sign | the test fails: a root may hide there |
| Monotone pieces | up to three pieces between the turning brackets; a piece whose end signs differ holds one root | an end value within g of zero (other than an exact end coefficient zero) |
| Halve | bisection on f, at most 64 halvings, until the bracket is no wider than the target | a midpoint within g of zero whose quarter points do not show the ends' signs |
| Collect | at most three roots, sorted; their brackets must be disjoint | two roots or brackets touch: close roots are never merged |

f is evaluated by de Casteljau's repeated averaging of the coefficients, at most 1024 times per span. The bracket
target is 10⁻¹² in the curve's own parameter: on a span of length h it is min(10⁻¹², 10⁻¹²/h) in the span's [0, 1].

Each root becomes an event. The original curve (not a copy) is evaluated at the root. That point must lie on the plane
within the linear tolerance, max(10⁻⁷ mm, 10⁻¹¹ × the largest coordinate) (`linearToleranceMM`). Its (u, v) on the
plane comes from solving the 2 × 2 Gram system of the plane's axes, which works for skew axes too.

## 3. Degree 1 and 2, and tangents

The degree-1 and degree-2 solver (`solveHomogeneousBernsteinEquation`) works on the same coefficients. It writes them
in powers of t, f(t) = a t² + b t + c with a = c<sub>0</sub> − 2c<sub>1</sub> + c<sub>2</sub>,
b = 2(c<sub>1</sub> − c<sub>0</sub>) and c = c<sub>0</sub>, and then:

1. returns no root if all coefficients have one sign (the hull test, with no guard);
2. if both end coefficients are nonzero, checks the discriminant b² − 4ac against its uncertainty
   32 ε (\|b²\| + \|4ac\|): clearly negative, no root; inside the band, refused;
3. cuts [0, 1] at the parabola's vertex −b / 2a when it lies inside, so each piece is monotone;
4. halves each piece whose end values differ in sign, at most 64 times, down to the same target as the cubic. A
   midpoint that is exactly zero is stepped over to the quarter points;
5. adds an exact root at t = 0 or t = 1 for a zero end coefficient, with a touch flag when the neighbouring
   coefficient is zero too.

A degree-1 curve is one piece and needs only step 4.

<RootsTangent />

What happens at a tangent:

| Case | Degree 1 and 2 | Degree 3 |
|---|---|---|
| Tangent or double root inside the span | refused: discriminant within its band | refused: a turning point's margin test fails, or a near-zero midpoint cannot be stepped over |
| Tangent at an end (c<sub>0</sub> = c<sub>1</sub> = 0) | reported: an endpoint event with `rootTouch` set | the same |
| Curve lying in the plane (every c<sub>i</sub> = 0) | `coincident-support`, no events; whether every control point's (u, v) lies inside the plane's rectangle is recorded | the same |
| Two crossings very close together | found, each in its own bracket, while the discriminant is outside its band | found while each turning point passes its margin test |

A refusal is an error from the whole call, with no partial result. The cubic one is a
`CubicCurveAffinePlaneIntersectionError` with code `REPRESENTABILITY` (or `BUDGET` when a count runs out); the degree-1
and degree-2 ones carry the message alone, for example "unresolved interior tangent/discriminant ambiguity".

## 4. A B-spline, one span at a time

<RootsSpans />

A B-spline's distance from a plane is a polynomial only on each span between knots. The multi-span functions cut the
curve into Bézier spans first. `intersectCurveWithAffinePlaneSurface` splits it at every inner knot
(`splitCurveAtParameter`); the two wide functions use Bézier extraction (`extractCurveBezierSpans`), which rewrites the
basis functions of each span in that span's Bernstein basis. Each span is then solved by the one-span function above.

The spans' events are gathered in the original curve's parameter. Two contributions with exactly the same parameter
become one event. That happens when a root lies on an inner knot and both neighbouring spans report it, and the event is
then a `knot-event`. Only exact equality merges; distinct roots, however close, stay distinct. At each event the
original curve's point must agree with the span's point within 10⁻⁷ mm. The signed distance on each side, halfway to
the next root or the span's end, is recorded, so a reader of the result can see which way the curve passes.

The plane is finite: its rectangle is its (u, v) domain. An event whose point and both bracket ends map inside the
rectangle is `finite-domain-admitted`, and the plane surface evaluated there must match the point within the
tolerance. One lying entirely beyond one side is `outside-domain`: reported, but not a point on the face. A bracket that
straddles the rectangle's edge is refused. The result's kind is `isolated` (some event on the rectangle),
`finite-disjoint` (events only outside it), `support-disjoint` (no event), or `coincident-spans` / `mixed` when some
spans lie in the plane.

## 5. A curve and a line in a plane

`intersectCoplanarCurveWithLineSegment` takes a degree-1 or degree-2 curve and a line segment, both lying exactly in one
plane. Every control point's weighted distance from the plane must be exactly zero. Each control point is mapped to the
plane's (u, v). With the segment running from a to b and e = b − a, the signed distance from the line is replaced by a
cross product, which is again a Bernstein polynomial:

c<sub>i</sub> = w<sub>i</sub> ((u<sub>i</sub> − a<sub>u</sub>) e<sub>v</sub> − (v<sub>i</sub> − a<sub>v</sub>) e<sub>u</sub>).

The degree-2 solver finds its roots span by span. For each root, the coordinate along the line,
s = (p − a)<sub>k</sub> / e<sub>k</sub> on the axis k where e is larger, tells whether it lies on the segment
(0 ≤ s ≤ 1).

A span lying on the line (every c<sub>i</sub> = 0) is an overlap, not a point. The kernel first proves that the
span's coordinate along the line only rises or only falls. The derivative's numerator has Bernstein coefficients
2w<sub>0</sub>w<sub>1</sub>(q<sub>1</sub> − q<sub>0</sub>), w<sub>0</sub>w<sub>2</sub>(q<sub>2</sub> − q<sub>0</sub>),
2w<sub>1</sub>w<sub>2</sub>(q<sub>2</sub> − q<sub>1</sub>) for the coordinates q<sub>i</sub>, and these must be all
≥ 0 or all ≤ 0, with at least one nonzero. It then solves w<sub>i</sub>(q<sub>i</sub> − 0) and
w<sub>i</sub>(q<sub>i</sub> − 1) for where the span passes the segment's two ends; a piece between them whose midpoint
lies on the segment is an overlap. Bindings in (u, v) use the dimensionless tolerance 10⁻⁷; points in space use the
linear tolerance.

## 6. A surface straight in one direction

The same coefficients, one dimension up, give some plane sections with no root finding at all.
`buildVLinearSurfacePlaneSection` takes a surface of degree 1 or 2 in u and degree 1 in v: along every u it is a
straight segment between its rows v = 0 and v = 1. The plane's equation along that segment is linear in v,

f(u, v) = (1 − v) F<sub>0</sub>(u) + v F<sub>1</sub>(u),

where F<sub>0</sub> and F<sub>1</sub> are Bernstein polynomials in u. Their coefficients are the rows' weighted
distances from the plane, w (n · P + d), with the unnormalised normal n = A × B and d = −n · O. If every coefficient of F<sub>0</sub> is
negative and every one of F<sub>1</sub> positive (or the other way round), then by the hull property
F<sub>0</sub>(u) &lt; 0 &lt; F<sub>1</sub>(u) for every u. Every segment then crosses the plane exactly once, at
v = F<sub>0</sub> / (F<sub>0</sub> − F<sub>1</sub>). The section curve is exact: in homogeneous coordinates it is
F<sub>1</sub>(u) H<sub>0</sub>(u) − F<sub>0</sub>(u) H<sub>1</sub>(u), with H<sub>0</sub>, H<sub>1</sub> the two rows.
That is a product of Bernstein polynomials, of degree 2p for rows of degree p. The kernel computes it in exact
rational arithmetic, rounds each control point once to binary64, and checks that a bound on the gap between the stored
and the exact curve (and their (u, v) curves on the surface and the plane) is at most 10⁻⁷ mm. Any other sign pattern is refused, whether partial, tangent or coincident: "Exact whole Bernstein columns
must have strict opposite signs". `buildMultiSpanVLinearSurfacePlaneSection` does the same span by span, and the
rectangular face extrusion and section features build on it.

## Tolerances and budgets

| Quantity | Value | Source |
|---|---|---|
| Root bracket width | 10⁻¹² in the curve's parameter: min(10⁻¹², 10⁻¹²/h) in a span of length h | `own-curve-plane-intersection.ts:41, 107`, `own-cubic-curve-plane-intersection.ts:146` |
| Halvings per root | at most 64 | `own-homogeneous-bernstein-roots.ts:45`, `own-cubic-bernstein-roots.ts:153` |
| Cubic sign guard | 64 ε max(1, max \|c̃<sub>i</sub>\|) on the normalised coefficients | `own-cubic-bernstein-roots.ts:60` |
| Discriminant band | 32 ε (\|b²\| + \|4ac\|) | `own-homogeneous-bernstein-roots.ts:17` |
| Turning-point margin | L r + g, L the derivative coefficients' largest magnitude | `own-cubic-bernstein-roots.ts:107–119` |
| Cubic evaluations | at most 1024 per span; 65 536 over a wide cubic | `own-cubic-bernstein-roots.ts:83`, `curve-wide-cubic-plane-intersection.ts` |
| Roots per span | 2 (degree 2), 3 (degree 3); the caller names a slot for each event | `own-homogeneous-bernstein-roots.ts:49`, `own-cubic-bernstein-roots.ts:173` |
| Point on the plane | max(10⁻⁷ mm, 10⁻¹¹ × the largest coordinate) | `numeric-policy.ts:48`, `own-curve-plane-intersection.ts:85–87` |
| Original and span points agree | 10⁻⁷ mm | `own-multispan-curve-plane.ts:60, 110` |
| (u, v) bindings (curve and line) | 10⁻⁷, dimensionless | `numeric-policy.ts:21`, `own-curve-line-intersection.ts:123` |
| Plane axes | Gram determinant above 64 ε (‖A‖²‖B‖² + (A · B)²) | `own-curve-plane-intersection.ts:70` |

## Where it is in the code

All paths are under `packages/barocss-cad/src/`.

| File | Responsibility |
|---|---|
| `intersect/own-homogeneous-bernstein-roots.ts` | `createHomogeneousBernsteinEquation`, `solveHomogeneousBernsteinEquation`: the degree-1 and degree-2 solver (hull test, discriminant band, vertex split, bisection, exact ends) |
| `intersect/own-cubic-bernstein-roots.ts` | `solveCubicBernsteinRoots`: normalisation, hull test, turning points by the degree-2 solver, margin test, monotone pieces, bisection |
| `intersect/own-curve-plane-intersection.ts` | the plane's axes (`prepareCurvePlaneAxesTrusted`), the coefficients c<sub>i</sub> (`curvePlaneCoefficientsTrusted`), events with (u, v) and residual checks (`bindCurvePlaneRootsTrusted`), one degree-1 or degree-2 span |
| `intersect/own-cubic-curve-plane-intersection.ts` | one cubic span against a plane, with the solver's evidence in its report |
| `intersect/own-multispan-curve-plane.ts` | splitting at knots and gathering span events into one list (`assembleCurvePlaneEventsTrusted`) |
| `nurbs/source-wide/curve-wide-plane-intersection.ts`, `curve-wide-cubic-plane-intersection.ts` | the same for up to 64 spans, by Bézier extraction |
| `intersect/own-curve-line-intersection.ts` | a curve and a line segment in one plane: point roots, and overlaps of spans lying on the line |
| `intersect/vlinear-plane-section.ts`, `multispan-vlinear-plane-section.ts` | exact plane sections of surfaces of degree 1 in v |
| `numeric-policy.ts` | `linearToleranceMM`, `uvBindingTolerance` |

Every one of these functions has a `validate…` partner that recomputes the result from the original curve, plane and
options and compares every field.

## How it is checked

- `packages/barocss-cad/test/own-bernstein-roots-bracket.test.mjs`: a crossing just inside t = 0 or t = 1 is found,
  not lost to rounding; in 4000 random quadratics with coefficients over 18 orders of magnitude, every sign change between
  the ends gives a bracketed root no wider than 10⁻¹² whose ends differ in sign (or a refusal naming a tangent); fixed
  results for (1, −3, 1), (0, 1, −1), (0, 0, 1) and (1, 0, 1); and (1, −1, 1) is refused as a tangent.
- `packages/barocss-cad/test/numeric-policy-scale.test.mjs`: curve and plane intersections at 10³ and 10⁶ mm bind, and
  report the tolerance used; coplanar curve and line intersections scale the same way and find both points.
- `packages/barocss-cad/test/numeric-policy-range.test.mjs`: the degree-2 intersection works at 5 × 10⁵ mm and refuses
  beyond the geometry range.
- Example scripts with assertions, run with node: `examples/cad-nurbs/cubic-curve-plane-intersection-demo.mjs` (among
  others, a triple root and an interior tangent are refused), `own-curve-plane-intersection-demo.mjs`,
  `own-multispan-curve-plane-demo.mjs`, `curve-wide-plane-intersection-demo.mjs`,
  `curve-wide-cubic-plane-intersection-demo.mjs`, `own-curve-line-intersection-demo.mjs` and
  `multispan-vlinear-plane-section-demo.mjs`.

## Limits

- Only planes: affine degree 1 × 1 patches with four equal weights. A curve against a curved surface is not handled here;
  surface pairs are traced by marching (see [Booleans of curved solids](/how/boolean)).
- Only curves of degree 1, 2 and 3. Bézier extraction stops at degree 3.
- Tangents, double and triple roots inside a span are refused, never reported as a single point.
- A root whose bracket straddles the edge of the plane's rectangle is refused.
- A curve lying in the plane is reported as coincident, but not clipped to the rectangle.
- The cubic path accepts coordinates within ±10 000 mm. The one-span degree-1 and degree-2 path and the curve and line
  path accept the geometry range (to 10⁶ mm), with the tolerance scaled beyond 10 000 mm.
- Every check is local: each root is found to its bracket and its point checked against the tolerance. A global bound on
  the binary64 error is not claimed.
