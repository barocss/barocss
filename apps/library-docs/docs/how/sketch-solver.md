<script setup>
import SketchSolve from '../.vitepress/components/algorithms/SketchSolve.vue';
import SketchFreedom from '../.vitepress/components/algorithms/SketchFreedom.vue';
import SketchArcs from '../.vitepress/components/algorithms/SketchArcs.vue';
</script>

# Solving sketch constraints

A sketch is drawn by hand, so its points are never exactly where its constraints say: an edge meant to be horizontal
leans a little, a length is 36.1 mm instead of 40. The solver moves the points until every constraint holds, then says
how much freedom is left. In the studio this runs after every edit of a [sketch](/studio/sketches): the shape on screen
is always the solved one, and the status line counts what is still free (`2 DOF`) until it reads **Fully defined**.

The method is a damped form of Newton's method on the constraints written as equations. The figures run it in the page
on small sketches, with a copy of the kernel's code; on these sketches its iterates are bit-identical to the kernel's.

## Three solvers

| Solver | Unknowns | Method | Used by |
|---|---|---|---|
| Kernel line solver, `solveXYNumericalSketch`, `solveXYNumericalSketchPoints` | x, y of each point | Levenberg–Marquardt, Householder QR | the studio's 2D sketches: every outline, arcs included |
| Kernel circular solver, `solveXYCircularNumericalSketch` | x, y of each point, and each circle's radius | the same loop | a kernel API; the studio does not call it |
| Skeleton solver, `solveSketch3D` (`@barocss/cad-model`) | x, y, z of each point | Levenberg–Marquardt, normal equations, Cholesky | the studio's 3D skeleton sketches for [frames](/studio/frames) |

Most of this page is the line solver, since the studio's sketches go through it. The other two are at the end.

## 1. Constraints as residuals

The unknowns are the coordinates of the points, in one vector x = (x₀, y₀, x₁, y₁, …). Each constraint becomes one or
two equations rᵢ(x) = 0, called *residuals*: zero when the constraint holds, and as large as the error when it does not.
A segment s runs from point a to point b; its vector is s = b − a.

| Constraint | Rows | Residual | Tolerance |
|---|---|---|---|
| fixed | 2 | x − tₓ, y − t<sub>y</sub> | 10⁻⁷ mm |
| coincident | 2 | x<sub>b</sub> − x<sub>a</sub>, y<sub>b</sub> − y<sub>a</sub> | 10⁻⁷ mm |
| horizontal | 1 | y<sub>b</sub> − y<sub>a</sub> | 10⁻⁷ mm |
| vertical | 1 | x<sub>b</sub> − x<sub>a</sub> | 10⁻⁷ mm |
| length | 1 | ‖s‖ − L, with 0.001 ≤ L ≤ 20000√2 mm | 10⁻⁷ mm |
| equal-length | 1 | ‖s<sub>A</sub>‖ − ‖s<sub>B</sub>‖ | 10⁻⁷ mm |
| signed-angle | 1 | wrap(atan2(s<sub>B</sub>) − atan2(s<sub>A</sub>) − θ), with −π &lt; θ ≤ π | 10⁻⁹ rad |

`wrap` brings an angle into (−π, π]. Each row also has its derivatives with respect to every coordinate, written out by
hand in the code: together the rows of derivatives are the *Jacobian* J. The sum of squares Σ rᵢ² that the solver
lowers adds millimetres and radians as they are: 1 mm counts as much as 1 rad.

## 2. The damped Newton step

Newton's method replaces r by its straight-line approximation r(x + δ) ≈ r(x) + J δ and solves that for the step δ.
J is rarely square and invertible (a sketch has fewer independent equations than unknowns until it is fully defined),
so the step is a least-squares one. The kernel adds a penalty λ‖δ‖² that keeps the step short: this is the Levenberg–Marquardt method, and λ is its
*damping*. A large λ gives short, cautious steps; a small λ gives the plain Gauss–Newton step.

<SketchSolve />

The loop in the kernel:

1. λ = 10⁻³. If every residual is already within its tolerance, stop.
2. Solve [J ; √λ I] δ ≈ [−r ; 0] by Householder QR with column pivoting.
3. Evaluate r at x + δ from scratch. If Σ rᵢ² fell, keep the step and set λ = max(10⁻¹², λ / 3).
4. If not (or if x + δ is refused, below), discard it and set λ = min(10¹², 10 λ); try again, up to 12 times.
5. Repeat from 1, up to 100 iterations and 1200 evaluations of r. If no try succeeds and λ has reached 10¹², stop.

The result is accepted only if every residual is within its tolerance. Otherwise the sketch is refused with
`NONCONVERGENCE`, and the message says *this is not an inconsistency proof*: a local method that does not converge
has not shown that no solution exists. The accepted point is evaluated once more from scratch and must pass the same
test before it is returned.

## 3. Degrees of freedom

Each point has two coordinates, so a sketch of n points has 2n *degrees of freedom* (DOF) before any constraint. Each
independent equation takes one away. The number of independent equations is the *rank* of J at the solution, so

DOF = unknowns − rank J.

The kernel computes the rank with the same QR, on J alone without the damping rows: a diagonal entry of the factor R
counts when it is above max(1, the largest |R<sub>kk</sub>|) × 10⁻¹⁰. It reports `numericalRank`,
`localDegreesOfFreedom` and `fullyConstrainedLocally` (rank = unknowns); *locally* because the rank is that of J at
this solution, not a proof about other solutions.

<SketchFreedom />

An equation that adds no rank is *redundant*: it holds, but the others already imply it. The kernel solves such a
sketch and reports it (more rows than rank); the studio decides what to do with it. It counts the redundant rows as
rows − rank and:

- refuses an edit that makes more rows redundant than before, with the reason `… is already implied by the other
  constraints — adding it would over-define the sketch`, and keeps the previous shape;
- shows **Over-defined · n redundant constraint(s) — remove one** on an outline that has some, and otherwise
  **Under-defined · n DOF left** or **Fully defined**.

A constraint that contradicts the others, such as |s₁| = 30 mm on the fully defined quad above, leaves residuals the
loop cannot bring within tolerance. The kernel returns `NONCONVERGENCE`, the studio shows that reason and keeps the
previous shape.

## 4. Arcs and circles in the studio

The studio stores an outline as points and *bulges*: segment i runs from point i to point i + 1, and a nonzero bulge
b = tan(sweep / 4) makes it an arc, counter-clockwise when b &gt; 0. The kernel's line solver knows only points and
straight segments, so the studio rewrites each arc before solving:

- its centre becomes a point (two more unknowns);
- two *radius segments*, centre → start and centre → end, held equal by an equal-length row;
- a tangent joint is a signed angle between the line and the radius: +90° or −90°, whichever is nearer the drawing
  (between two arcs' radii, 0° or 180°);
- a radius dimension is a length on the radius segment centre → start; equal radii is an equal-length row between two
  arcs' radius segments, concentric arcs a coincident row between their centres.

So each arc brings one degree of freedom of its own: with its ends fixed, its radius can still change.

<SketchArcs />

Closing an outline infers what was drawn nearly so, and the solve makes it exact:

| Inferred on closing | When | Becomes |
|---|---|---|
| Horizontal, vertical | a straight edge drawn with exactly equal y (or x) on the 1 mm snap | horizontal / vertical row |
| Tangent | a joint next to an arc drawn within 12° of tangent | signed angle ±90° (0° / 180° between arcs) |
| Equal radii | two arcs whose radii differ by at most max(0.5 mm, 3 % of the smaller) | equal-length row |
| Concentric | two arcs whose centres are at most max(1.5 mm, 5 % of the smaller radius) apart | coincident row |

All inferred relations are tried together first. If together they fail, or they add redundant rows, they are tried one
at a time and each is kept only while the sketch still solves and the redundancy does not grow. A relation an outline
already implies is therefore not added a second time.

After the solve, each arc's bulge is rebuilt from the solved ends and centre: the sweep is the angle from start to end
about the centre, turned the way the arc was drawn (2π added or taken away when the sign came out wrong), and
b = tan(sweep / 4).

The studio's other constraints are written in the same few kinds, sometimes with helper points:

| Studio constraint | Kernel rows |
|---|---|
| Parallel, perpendicular | signed angle 0° or 180°, ±90°, the one nearest the drawing |
| Equal | equal-length |
| Fix | fixed where the point was when the constraint was added |
| Coincident (point on an arc's centre) | coincident |
| Distance between two points | a length on a helper segment between them |
| Horizontal or vertical distance | two helper points 10 mm across the axis, tied to the points; the distance measured between the helpers, so it never collapses when the points line up |
| Angle between two lines | signed angle, its sign and half turns taken from the drawing |
| Symmetric about a line | a helper midpoint M: a–M and M–b in line and of one length, M on the line, a–b square to it |
| Tangent (line and circle) | a helper touching point on the line, its radius segment square to the line, of the circle's radius |
| Concentric circles, circle distances | coincident centres, lengths between centres or to points |

A circle placed in an outline (a hole or a boss) is its centre point; its radius is a value, not an unknown.

## 5. Which solution

Constraints usually have more than one solution: a triangle with three given side lengths can be built two ways, one
the mirror image of the other.
The solver finds the one its seed (the drawing) leads to, with no guarantee it is the nearest; the report says so
(`seed-dependent-no-global-closest-root-guarantee`).

The kernel accepts *branch guards* to hold a solution on one side:

| Guard | Holds when |
|---|---|
| `positive-projection` | a segment's vector has a positive component along a given direction |
| `oriented-triplet` | three points turn counter-clockwise (or clockwise): (b − a) × (c − a) &gt; 0 (or &lt; 0) |

They are checked at every evaluation: at the seed (a failing seed refuses the sketch with `BRANCH`) and at every
candidate step (a failing candidate is discarded like a step that did not lower Σ rᵢ²). The studio passes none. It
picks its targets nearest the drawing instead (the sign of a tangent's 90°, parallel 0° or 180°, an angle's side) and
keeps each arc turning the way it was drawn when it rebuilds the bulge.

## 6. The circular solver

`solveXYCircularNumericalSketch` takes full circles as well as points and segments. Each circle has a centre point and a
radius, and the radius is an unknown of its own, after the coordinates. It adds two constraint kinds to the line
solver's (all but equal-length):

| Constraint | Residual |
|---|---|
| `radius` | r − R |
| `line-circle-tangent` | σ n · (c − a) − r: the centre's signed distance from the segment's line, on the given side (σ = +1 left, −1 right), minus the radius |

Here n is the segment's unit left normal and a its start. A tangency is accepted only where it touches the segment
strictly inside it, on the given side: the foot of the centre on the line, at parameter t = (c − a) · s / ‖s‖², must have
0 &lt; t &lt; 1, and σ n · (c − a) &gt; 0. A candidate that breaks this, or a radius outside 0.001–10000 mm, is discarded
like any refused step. The damping, tolerances, rank and DOF are the line solver's; DOF counts the radii as unknowns.

The result is built as curves: a degree-1 NURBS per segment and a degree-2 rational NURBS per circle (9 control points,
weights alternating 1 and √½, its seam at parameter 0 and 4).

## 7. The skeleton solver (3D)

A [frame](/studio/frames)'s skeleton is a 3D sketch: points, straight segments and constraints among them, solved by
`solveSketch3D` in `@barocss/cad-model`. It is Levenberg–Marquardt as well, written differently:

| | 2D line solver | 3D skeleton solver |
|---|---|---|
| Step | [J ; √λ I] δ ≈ [−r ; 0] by QR | (JᵀJ + λI) δ = Jᵀr by Cholesky |
| λ | from 10⁻³; ÷ 3 on a kept step (floor 10⁻¹²), × 10 on a discarded one (ceiling 10¹²) | from 10⁻³; ÷ 3 (floor 10⁻¹⁵), × 4 |
| Tries, iterations | 12, 100 | 30, 200 |
| Stop | every residual within its tolerance | Σ rᵢ² ≤ 10⁻²⁰ |
| Rank | QR of J, relative 10⁻¹⁰ | Gram–Schmidt (twice) of each row normalised, 10⁻⁸ |
| Diagnosis | rank and DOF; the caller counts redundancy | per constraint: redundant (adds no rank), unmet (residual &gt; 10⁻⁹), free points; status `well`, `under`, `over` or `conflict` |

Its constraints are coincident, fixed, length, distance, angle (on the cosine), parallel (the cross product over the
lengths, three rows), perpendicular, on an axis, on a plane, and along an axis. A sketch with nothing fixed keeps its 6
rigid motions.

## Where it is in the code

| File | Responsibility |
|---|---|
| `packages/barocss-cad/src/sketch/xy-numerical-sketch-solver-internal.ts` | `limits`, `tolerances`, `qr`, `evaluate` (residuals, Jacobian, branch guards), `solve` (the damped loop, final check, rank) |
| `packages/barocss-cad/src/sketch/xy-numerical-sketch-admission-internal.ts` | the document checked before solving: kinds, references, value ranges, sizes |
| `packages/barocss-cad/src/sketch/xy-numerical-sketch.ts` | `solveXYNumericalSketch` (solve, then native line curves), `solveXYNumericalSketchPoints` (points and report only), `validateXYNumericalSketch` |
| `packages/barocss-cad/src/sketch/xy-circular-numerical-sketch-solver-internal.ts` | the circular solver: radius and tangent rows, the same loop |
| `packages/barocss-cad/src/sketch/xy-circular-numerical-sketch.ts`, `…-admission-internal.ts`, `…-native-internal.ts` | its API, admission and native circle curves |
| `packages/barocss-cad-model/src/sketch/profile.ts` | `solveOutline`: an outline with arcs as the kernel's document; `inferredHV`, `inferTangents`, `inferArcRelations`; bulges rebuilt |
| `packages/barocss-cad-model/src/sketch/terms.ts` | `ruleTerms`: the studio's explicit constraints and dimensions as kernel rows and helper points |
| `packages/barocss-cad-model/src/sketch/rules.ts` | `solveShape`, `redundancy`, `checkEdit` (refusing an over-defining edit), applying and committing constraints |
| `packages/barocss-cad-model/src/sketch/settle.ts` | `settleShape`: what closing infers, and which inferred relations are kept |
| `apps/cad-studio/src/ui/SketchPanel.tsx` | the status line: rank, DOF, over-, under- or fully defined |
| `packages/barocss-cad-model/src/frames/sketch3d.ts` | `solveSketch3D`: the 3D skeleton solver and its diagnosis |

## How it is checked

| Test | What it covers |
|---|---|
| `packages/barocss-cad/test/xy-numerical-sketch-equal-length.test.mjs` | equal-length keeps an arc end on its circle with one DOF left; a slot of lines, centres and radii with ±90° tangency fully defined from a rough seed; the equal-length Jacobian against central differences; refusals and the 16-segment limit; the -v1 profile's larger limits |
| `packages/barocss-cad/test/r7-consumer-dependencies.test.mjs` | both the line and the circular solver solve a length and a right angle, rebuild to the same result, and refuse old field names |
| `packages/barocss-cad-model/test/sketch-profile-precision.test.ts` | solved coordinates kept unrounded (driving lengths, arcs, radii, angles); a non-converging edit keeps the previous shape with the kernel's message |
| `apps/cad-studio/test/constraints.test.ts` | DOF counts as constraints are added and removed; an implied constraint refused as over-defining; dimensions; symmetric (two DOF less); tangent to a circle; concentric arcs and circles |
| `packages/barocss-cad-model/test/sketch3d.test.ts` | the 3D solver on a tetrahedron and a tilted rectangle; freedoms counted; diagnosis of a conflict and of a redundant length |

## Limits

| | Line solver `-v0` | Line solver `-v1` (the studio's) | Circular solver |
|---|---|---|---|
| Points | 2–16 | 2–64 | 1–16 |
| Segments | 1–16 | 1–64 | 0–8 |
| Circles | — | — | 1–4 |
| Constraints | 32 | 128 | 32 |
| Scalar residuals | 64 | 256 | 64 |
| Unknowns | 32 | 128 | 32 (radii included) |
| Branch guards | 16 | 32 | 16 |
| Iterations / evaluations | 100 / 1200 | 100 / 1200 | 100 / 1200 |

- Coordinates must stay within ±10000 mm and every segment at least 0.001 mm long; a step that breaks either is
  discarded. The studio reports a collapsing edge as `These constraints would collapse an edge to a point`.
- The studio refuses an outline of more than 64 points or segments, counting arcs' centres and helper points, before
  solving (`Too many points, arcs and point dimensions for the sketch solver (64 points / 64 segments)`); the kernel's
  `LIMIT` or `BUDGET` reads `The sketch is too large for the solver (at most 128 constraints)`.
- `solveXYNumericalSketch` also builds native curves, bounded to 16 of them; `solveXYNumericalSketchPoints` returns the
  points only, for larger sketches.
- The solve is local: it finds the solution the drawing leads to, and a failure to converge does not prove the
  constraints conflict. The rank is numerical, at the solution only.
