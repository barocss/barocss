<script setup>
import ClosestNewton from '../.vitepress/components/algorithms/ClosestNewton.vue';
import ClosestGolden from '../.vitepress/components/algorithms/ClosestGolden.vue';
</script>

# Closest points on curves and surfaces

Given a point, which point of a curve or a surface lies nearest to it? The kernel and the studio's model ask this
whenever a 3D point has to be read in a face's own parameters, or a distance from a curve or a surface decides
something:

- a trim curve carried onto a surface as a loop of (u, v) points;
- which way a face's boundary loop runs in the face's (u, v) domain;
- the draft angle of a curved face at sample points, from the exact normal there;
- how far a display mesh's triangles lie from the exact surface (the chord measure);
- in a [Boolean](/how/boolean), whether a point lies on a face's surface, and where a point lies along a cut curve.

There are two methods. Surfaces use Gauss–Newton on their exact first derivatives. General curves, which may come with
no derivatives at all, are sampled and then searched by golden section. Lines, arcs, planes and cylinders have closed
forms. All lengths are in mm.

## The cases at a glance

| The point is projected onto | Method | Source |
|---|---|---|
| A NURBS surface | Gauss–Newton from a seed on exact first derivatives; Newton's step when it is slow | `nurbs/surfaces/surface-closest.ts` (`closestPointOnSurface`) |
| A NURBS face, inside a Boolean | Gauss–Newton on difference quotients, from the last answer or a 25 × 25 grid | `brep/analytic-boolean.ts` (`nurbsParam`) |
| A plane or cylinder face, inside a Boolean | Closed form | `brep/analytic-boolean.ts` (`to2`, `offSurface`) |
| A general 2D curve segment | Nearest of 65 samples, then 60 golden-section steps | `brep/curved-arrangement.ts` (`paramOf`) |
| A 2D line or arc | Closed form | `brep/curved-arrangement.ts` (`paramOf`) |
| A 3D cut curve, inside a Boolean | Nearest of 65 samples, then 60 golden-section steps | `brep/analytic-boolean.ts` (`onCurve`, `nearestOn`) |

Paths are under `packages/barocss-cad/src/`.

## 1. The nearest point of a surface

A surface S(u, v) and a point p are given. The task is to find (u, v) where the squared distance ½‖S(u, v) − p‖² is
least. There the gap r = S − p is square to both tangents S<sub>u</sub> and S<sub>v</sub>.

`closestPointOnSurface` replaces the surface by its tangent plane at the current (u, v) and finds the point of that
plane nearest p. In the parameters this is the Gauss–Newton step, a 2 × 2 linear solve:

| Symbol | Meaning |
|---|---|
| a = S<sub>u</sub>·S<sub>u</sub>, b = S<sub>u</sub>·S<sub>v</sub>, c = S<sub>v</sub>·S<sub>v</sub> | The tangent plane's metric |
| g<sub>u</sub> = r·S<sub>u</sub>, g<sub>v</sub> = r·S<sub>v</sub> | How the squared distance changes along u and v |
| Δu = −(c g<sub>u</sub> − b g<sub>v</sub>) / (ac − b²), Δv = −(a g<sub>v</sub> − b g<sub>u</sub>) / (ac − b²) | The step |

The derivatives are the NURBS surface's exact first derivatives, not difference quotients. A system with
\|ac − b²\| ≤ 10⁻³⁰⁰ (a degenerate point) ends the iteration. Four safeguards keep each step sound:

- **The domain.** The new (u, v) is clamped to the surface's domain.
- **Halving.** The step is kept when the surface's new point is no farther from p: its squared distance at most
  (1 + 10⁻¹²) × the last one, plus 10⁻²⁸ × (1 + ‖p‖²). Otherwise the step is halved, up to 40 times.
- **An edge.** When one parameter sits on its bound and its step points out of the domain, only the other parameter is
  solved for: Gauss–Newton along that edge's curve. Solved in both and then clamped, the free part of the step,
  coupled to the clamped one, crawled: points off a patch with their foot on its edge ran all 30 steps (D211).
- **A C0 knot.** Exactly on a knot where the derivatives are not defined (the joins of a rational circle's quarters),
  they are taken just off it, 10⁻¹¹ of the domain away, in the first of eight directions that evaluates
  (`surfaceD1Near`).

The figure runs this iteration on a section. Across its axis, one quarter patch of a cylinder R 10 is an arc, so
there is one parameter instead of two. Move P with the slider or the buttons to see the steps slow down off the curve.

<ClosestNewton />

### Why it slows down off the surface

Newton's method would divide by the whole second derivative of the squared distance. Along one parameter that is
C′·C′ + r·C″; on a surface it is the 2 × 2 Hessian, the metric (a, b, c) plus r dotted with the second derivatives.
Gauss–Newton keeps only the metric.

At the foot, r points along the normal and its length is the distance d. The dropped term r·C″ is then about d κ times
the kept one, where κ is the curvature. So:

| Where p is | Each step leaves about | What happens |
|---|---|---|
| On the surface (d = 0) | nothing to first order | Quadratic convergence: the error is squared each step |
| Outside a convex surface | −d κ of the error | The step is too long by 1 + d κ; the points alternate sides of the foot |
| Beyond the radius of curvature (d κ &gt; 1) | — | The whole step goes farther; halving holds it |
| Inside, on the concave side | +d κ of the error | The step falls short by 1 − d κ; near the centre of curvature it creeps |

Most queries are of the first kind: a display mesh's vertex, a point of a curve lying on the surface. There the whole
Gauss–Newton step is always taken. The safeguards came from points off the surface. Before halving was added, a point
15 mm outside a Ø20 cylinder converged to a foot 23 mm away, on the wrong side. A point near a cylinder's axis needed
more than 30 Gauss–Newton steps; with Newton's step below, it needs 10 (D143).

### Newton's step when it is slow

When two steps running each shrink by less than 3⅓ (each is more than 0.3 of the one before) and the step is larger than
10⁻¹² of the domain, Newton's step with the second derivatives is tried as well. It is kept where the full Hessian is
positive definite (its first entry and its determinant positive) and its point ends nearer p than Gauss–Newton's. On an
edge it is Newton's step in the one free parameter. Second derivatives cost about 30 first ones (84 µs against 2.5 µs
when measured), so they are taken only in this case (D143). A surface's second-derivative evaluator is made on first
use and kept with its seed grid.

### When it stops

- A step below 10⁻¹⁵ × (1 + |u| + |v|): done.
- The rounding floor: a step below 10⁻⁸ of the domain that is larger than the last one, while the distance did not
  fall. The iteration stops at the point before. Where d κ exceeds 1, the step otherwise grew from rounding noise and
  the first test never held (D211).
- The step limit: 30 by default (`iterations`).

The result is { u, v, point, distance, normal, iterations }. The normal is S<sub>u</sub> × S<sub>v</sub> made unit, or
[0, 0, 0] where the surface is degenerate (a pole). The query does not fail when it runs out of steps: it returns its
last point, and callers compare `distance` with their own tolerance.

### Seeds

The caller may give a seed: the last answer, or the (u, v) of the vertex before. Without one, the start is the nearest
node of a grid of the domain. `surfaceSeedGrid(surface, n = 24)` evaluates (n + 1) × (n + 1) = 625 points once. A caller
making many queries on one surface builds it once and passes it to each. The grid also carries the surface's
derivative evaluator, validated once, so a query with it skips that check (D185).

## 2. Who projects onto surfaces

| Caller | What it projects | Seeds and steps |
|---|---|---|
| `packages/barocss-cad/src/brep/brep-core.ts` (`loopWindsInDomain`) | A face loop's samples (a straight edge's corners, 16 points of a curved one), to tell which way the loop runs in (u, v) | From the sample before; at the first, or past a seam, from a 24-grid made once. A sample farther than `reach`: the direction cannot be told |
| `packages/barocss-cad-model/src/engine/trim.ts` (`projectLoop`) | 160 samples of a closed trim curve, as the trim's loop in (u, v) | From the sample before and from the nearest node of its own 25 × 25 grid, the nearer kept; 20 steps |
| `packages/barocss-cad-model/src/mould/draft.ts` (`foot`) | Draft samples on a curved face, for the exact normal there (the draft is asin(n · d)) | A 24-grid per face piece; the normal turned by the face's sense |
| `packages/barocss-cad-model/src/engine/mesh.ts` (`sampledChord`) | A freeform face's mesh vertices to (u, v), then 12 points of each triangle to the surface | Vertices: from the last vertex, 40 steps, then from a 24-grid if farther than 10⁻⁷ × (1 + size). Triangle points: from the interpolated (u, v), 8 steps |

Three kernel modules keep projections of their own, each on its own evaluator and seeds: tessellation
(`brep/brep-tessellate.ts`), the offset cavity (`blend/offset-cavity.ts`) and the rolling ball (`blend/rolling-ball.ts`).
The analytic Boolean has its own too (section 4).

## 3. The nearest point of a 2D curve

The [curve arrangement](/how/boolean#_2-splitting-a-face) splits a face's 2D domain by its cuts. Its segments are lines,
circular arcs, and general curves. A general curve is only a function f(t) over t₀ → t₁: a plane's cut through a
cylinder in the cylinder's domain, a traced intersection curve. `paramOf(s, p)` returns the parameter u ∈ [0, 1] of the
point of s nearest p:

- **A line** a → b: the projection u = (p − a)·(b − a) / ‖b − a‖².
- **An arc**: the angle of p about the centre, measured from the start along the sweep in [0, 2π), over the sweep. Past
  the end it is the nearer reading: a little before the start or a little after the end.
- **A general curve**: the nearest of its 65 samples (`CURVE_SAMPLES` = 64 chords), then golden-section search on the
  squared distance over the two chords beside that sample.

Golden section needs no derivative and cannot diverge: each step keeps a fixed 0.618 of a bracket that always holds the
answer. The price is a fixed cost: the kernel evaluates both inner points at every step, 120 evaluations of f per
search, for a bracket 0.618⁶⁰ ≈ 2.9 × 10⁻¹³ of its first width. The samples and their box are made once per segment
and kept.

<ClosestGolden />

### A point on another branch

The search beside the nearest sample assumes that sample lies on the same part of the curve as the answer. A curve
sampled sparsely against its turn breaks this. A plane nearly along a cylinder's axis cuts it in an ellipse whose 64
samples lie some 25–30 mm apart along its long axis. A point on one side can lie nearer a sample of the other side, and
the search there ended 6.7 mm off. So when the first answer is farther from p than 10⁻⁶ × (1 + |p<sub>x</sub>| +
|p<sub>y</sub>|), every chord nearer p than that answer is searched, nearest first, over [(k − 0.5)/64, (k + 1.5)/64]. The
first answer that puts p on the curve within that margin is kept; failing all, the first answer stands. On a closed
curve the chord across from its nearest end is not searched (D197).

`paramOf` serves the arrangement's other steps through `segDistance`, the distance from p to the segment's point at
u clamped to [0, 1]. It splits a segment at its crossings (their parameters, sorted), tests whether a point lies on a
segment within the tolerance, and measures how far a candidate inside point is from a region's boundary. Before any
search, a point farther than the tolerance outside a general curve's sample box, padded by its longest chord, is taken
to lie on none of it, and no search runs.

## 4. Projections inside the analytic Boolean

The Boolean in `brep/analytic-boolean.ts` reads each face in a 2D domain of its own (`to2`, and back with `to3`):

- **A plane**: x − o in the plane's frame, (d·e₁, d·e₂).
- **A cylinder**: the angle about the axis (unwrapped about a reference angle) times the radius, and the height along
  the axis.
- **A general (NURBS) face**: `nurbsParam`, Gauss–Newton with derivatives by forward differences of 10⁻⁷ of each
  parameter's range (backward at the domain's upper end). Each step is clamped to the domain; at most 30 steps; done when
  both steps are below 10⁻¹⁴ of their ranges. It starts from the caller's hint or the face's last answer. If the result
  is more than 10⁻⁹ × the patch's size from x, it runs again from the nearest of a 25 × 25 grid of the patch, skipping
  grid points at a pole, and the nearer result is kept. It has no halving: it is used for points on or near the face.

`offSurface(g, x, limit)` is the distance from x to a face's surface, for a comparison with `limit`:

| Surface | Distance |
|---|---|
| Plane | \|n · (x − o)\| |
| Cylinder | \|‖x's offset from the axis‖ − r\| |
| NURBS | When x is farther than `limit` from the control points' box, that box distance (a lower bound, also past the limit) without projecting; else ‖to3(to2(x)) − x‖ |

It decides:

- whether a point lies on another face, within 10 tolerances, when classifying a piece (`classify`; then the two normals
  say 'same' or 'opposite');
- whether a face's boundary edge lies on another face's surface, at its quarter points (`edgeOnSurface`);
- whether a curve given to split a face lies on its surface: 64 samples, refused with `OFF_SURFACE` beyond the
  tolerance (`curveCuts`).

Along 3D cut curves, `onCurve` (the parameter of a vertex lying on a curve strictly between its ends, for splitting
edges in the stitch), `nearestOn` and `throughPole` take the nearest of 65 samples and 60 golden-section steps, with
the same ratio 0.6180339887. `curveDistance`, for 2D cut curves, uses the rounded ratios 0.382 and 0.618 and returns
the smaller of the nearest sample's distance and the search's.

A curve's map into a NURBS face's domain would cost a projection at every parameter. It is tabulated once instead:
129 exact projections with their exact derivatives, and cubic Hermite interpolation between them, about
(span / 128)⁴ off.

## Where it is in the code

| File | Responsibility |
|---|---|
| `packages/barocss-cad/src/nurbs/surfaces/surface-closest.ts` | `closestPointOnSurface`: Gauss–Newton, halving, the edge case, Newton's step when slow, the stop tests; `surfaceSeedGrid`; `surfaceD1Near` |
| `packages/barocss-cad/src/core/derivatives.ts`, `core/second-derivatives.ts` | `surfaceD1Evaluator`, `surfaceD2Evaluator`: exact first and second derivatives, validated once per surface |
| `packages/barocss-cad/src/brep/curved-arrangement.ts` | `paramOf`, `goldenNearest` (60 steps), `nearerChords` (D197), `segDistance`, `surelyOff` |
| `packages/barocss-cad/src/brep/analytic-boolean.ts` | `to2` / `to3`, `nurbsParam`, `gridOf` (25 × 25), `offSurface`, `onCurve`, `nearestOn`, `throughPole`, `curveDistance`, `tabulated` |
| `packages/barocss-cad/src/brep/brep-core.ts` | `loopWindsInDomain`: a loop's direction in its face's domain, through `closestPointOnSurface` |
| `packages/barocss-cad-model/src/engine/trim.ts` | `projectLoop`: a trim curve's loop in (u, v) |
| `packages/barocss-cad-model/src/mould/draft.ts` | `foot`: the draft field's exact normals |
| `packages/barocss-cad-model/src/engine/mesh.ts` | `sampledChord`: a freeform face's chord depth against the exact surface |

## How it is checked

| Test | What it covers |
|---|---|
| `packages/barocss-cad/test/k4-closest-point.test.mjs` | A cylinder R 10: 200 seeded points from 0.3 to 2.3 R from its axis, inside and outside, give the radial foot and distance to 10⁻⁹ mm and a radial normal. Points on the circle's quarter joins (C0 knots) do not throw. A point past the patch's end finds its foot on the top circle. A sphere R 12 and a torus R 20, r 4 (150 points each) to 10⁻⁸ mm. A freeform bicubic patch: 40 points against a 200 × 200 parameter scan refined by shrinking windows — never farther than the scan, within 10⁻⁷ mm of it; a prebuilt grid gives the same result, and a query seeded at its own foot stays there |
| `packages/barocss-cad/test/k11-closest-edge.test.mjs` | A torus's patches, from points 4 to 16 mm off the tube (farther than its radius 4) whose foot lies on a patch edge: the distance within 10⁻⁹ mm of a dense scan, at least 60 such feet, at most one in 20 running all 30 steps (D211) |
| `packages/barocss-cad/test/boolean-steep-ellipse.test.mjs` | `paramOf` on two ellipses sampled 64 times against their turn (3.5 × 300 and 2 × 200): a point on one branch maps onto that branch within 10⁻⁶; a Boolean with faces nearly along a cylinder's axis cuts it where its trims are (D197) |
| `packages/barocss-cad-model/test/mould-draft.test.ts` | The draft field from projected samples: a cone drafted 3° reads 3° at every sample to 10⁻⁹, a drafted box's walls 2°, cylinders, a fillet |
| `packages/barocss-cad-model/test/chord.test.ts` | A freeform SubD face's chord depth measured against the exact surface covers the mesh's true depth |

## Limits

- Both methods are local. Gauss–Newton finds the nearest point near its seed, and golden section the nearest point
  within its bracket. With the grid or the 65 samples as the start this is the global answer unless the surface or
  curve comes back near p between two nodes. Nothing afterwards checks that the result is the global nearest point.
- `closestPointOnSurface` does not refuse a query that runs out of steps; it returns its last point with `distance`
  and `iterations`. It throws a `RangeError` when no first derivative can be taken near (u, v).
- Off the surface, Gauss–Newton converges linearly, at a rate of about d κ. Newton's step helps only where the full
  Hessian is positive definite. Near the centre of curvature on the concave side, every point of the surface is
  nearly as far as the foot, and the foot is barely determined.
- The normal is [0, 0, 0] at a pole.
- The 2D search gives way to other chords only for a point that should lie on the curve (within 10⁻⁶ of its size). A
  point off the curve keeps the answer beside its nearest sample.
- The analytic Boolean's `nurbsParam` uses difference quotients and no halving. It is meant for points on or near its
  face.
