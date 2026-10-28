<script setup>
import TolSpacing from '../.vitepress/components/algorithms/TolSpacing.vue';
import TolMultiples from '../.vitepress/components/algorithms/TolMultiples.vue';
import TolMerge from '../.vitepress/components/algorithms/TolMerge.vue';
</script>

# Tolerances and numbers

The kernel computes with binary64 numbers, and binary64 rounds. Two computations of the same point rarely agree to the
last bit, so a test such as "do these two curve ends meet?" or "does this point lie on that surface?" has to allow a
small distance. This page explains the numbers behind those tests: how far apart binary64 numbers are, the one policy
that fixes the base tolerance, the multiples of it the Boolean uses, how points within a tolerance become one vertex, the
tolerances stored on edges and vertices, and the places where the kernel avoids tolerances altogether.

The policy is `CadNumericPolicy` in `packages/barocss-cad/src/numeric-policy.ts`. Use **Play**/**Pause**, the arrows or
a step's number to go through each figure.

## The policy at a glance

| Field | Value | Meaning |
|---|---|---|
| `version` | 1 | The policy's version |
| `coordinateAbs` | 10 000 | Modeling range, mm: authored and stored geometry |
| `geometryCoordinateAbs` | 1 000 000 | Geometry range, mm: curves and surfaces accepted by math validation (`validateCurve`, IGES import) |
| `linearTolerance` | 10⁻⁷ | Absolute floor, mm, for comparing points |
| `relativeLinearTolerance` | 10⁻¹¹ | Scale-relative part, × the geometry's size S |
| `uvBindingTolerance` | 10⁻⁷ | Comparison of dimensionless chart (u, v) values; the same number as the mm floor, kept apart because it means something else |
| `relativeComparison` | 10⁻⁷ | Dimensionless relative comparison (derivatives, chains): value × max(1, scale) |
| `parameterWidth` | 10⁻¹² | Bracket width, in a normalized parameter, at which root refinement stops |
| `chartParameters` | `'exact-or-one-rounding-certified-v1'` | Stored chart parameters: exact, or within what one rounding can do (below) |

Two functions go with it. `linearToleranceMM(S)` returns max(10⁻⁷, 10⁻¹¹ × |S|), the linear tolerance for geometry whose
coordinates reach S. `geometryScaleMM(...lists)` returns S: the largest absolute coordinate over lists of points (curve
poles, surface poles). The policy has no angular tolerance; the modules that compare angles keep their own (below).

## Units

The kernel's documents and results use MMGS: lengths in millimetres, mass in grams, time in seconds. Volume is in mm³,
inertia in g·mm² ([Volume, centroid and inertia](/how/mass-properties)). Angles in the public API and in documents are
degrees ([Modeling API](/packages/cad/modeling)); inside the kernel's geometry they are radians: an arc's sweep is
compared with π, and the shell's smooth-edge test is an angle of 10⁻⁴ rad. Chart parameters (u, v) have no unit, which is
why `uvBindingTolerance` is a field of its own.

## 1. How far apart binary64 numbers are

A binary64 number has 53 significant bits. Between two powers of two there are always 2⁵² of them, evenly spaced, so the
gap from one to the next, its *ulp*, doubles with every power of two: between 1.1 × 10⁻¹⁶ and 2.2 × 10⁻¹⁶ of the number. A fixed tolerance
in millimetres therefore means something different at different sizes, and the policy combines a fixed and a relative
part.

<TolSpacing />

The relative part exists because of what the methods leave behind, not because of the ulp alone. Root finding stops at a
parameter bracket of 10⁻¹², and on geometry of size S that places a point within about 10⁻¹² S of the true one (the
policy's comment). Below 10 m this is under the 10⁻⁷ mm floor; at 10⁶ mm it is 10⁻⁶ mm, ten times the floor. Before the
relative part, 36 % of the scale test's seeded curve-plane cases at 10⁶ mm were refused (the C7 test's title records
this); they now bind. Each of these intersections (curve-plane, curve-line) compares with `linearToleranceMM` of its own inputs' scale and reports the value
it used (`report.numericPolicy.pointBindingComparisonMM`).

Because the two parts meet at exactly 10⁴ mm, the modeling range, every result inside it is computed with 10⁻⁷ mm as
before the relative part existed.

| Range | Limit | Where it is enforced |
|---|---|---|
| Modeling | \|x\| ≤ 10 000 mm | a part's lengths: `part-model.ts` refuses anything not "a finite length within ±10000 mm" |
| Geometry | \|x\| ≤ 10⁶ mm | `validateCurve` / `validateSurface` (`core/math.ts`): "Coordinates must be finite and within 1e6 mm" |
| Weights | 10⁻⁶ ≤ w ≤ 10⁶ | the same validation |
| Knots and parameters | within 10 000 | the curvature and derivative routes (`core/second-derivatives.ts`): only coordinates were widened |

## 2. One tolerance, fixed multiples

The analytic Boolean (curved B-reps, [Booleans of curved solids](/how/boolean)) takes S as the largest absolute
coordinate of its two inputs' vertices, at least 1, and sets

ε = 10 × linearToleranceMM(S),

which is 10⁻⁶ mm for any part within 10 m. Every length test in it is ε or a fixed multiple of ε, chosen for what is
being compared: a curve against its own fit, the same edge computed twice, a traced curve against an exact one, or a
shortcut that decides without computing.

<TolMultiples />

| Multiple | Used for | Source (`brep/analytic-boolean.ts` unless named) |
|---|---|---|
| ¼ ε | Fit of a traced edge as a NURBS curve; a tighter `edgeFitTolerance` may replace it, a looser one may not | `analyticBoolean` (`edgeFit`), `stitchWith` (`fitTol`), `fitPieces` |
| ¼ ε | A fillet's contact curves on their faces; refined until met, refused as `APPROX_TOLERANCE_NOT_MET` past 4096 sections | `blend/edge-finish.ts` (`tolMM`), `blend/rolling-ball.ts` |
| ε | A point on a surface (`offSurface`), boxes that meet, a vertex lying on a curve (T-junction split), a cut's least length | `boxesMeet`, `cutPair`, `edgeOnSurface`, `stitchWith` (`onCurve`) |
| 10 ε | One edge reaching the stitch from both its faces (exact curves); a point on a region's boundary; coplanar pieces' boxes when joining | `stitchWith` (`edgeOf`), `locateInRegion` calls, `mergePieces` (`ringsBox`) |
| 20 ε | The vertex merge radius; an arc lying in its plane; a region's box when skipping it | `stitchWith` (`PointSet3`), `curve2` (`arcNearPlane`) |
| 100 ε | One edge from both faces when either copy is traced; the ends of neighbouring pieces in a ring; the marching tracer's tolerance; equal coordinates when numbering repeated names | `edgeOf`, `stitchWith` (alias), `cutPair` (`intersectPatches`), `keyOrder` |
| 300 ε | A traced cut's end snapped onto the face edge it crosses | `snapEnds` |
| 1000 ε | An uncut face whose box is this far clear of the other solid (outside, no ray); a NURBS patch this far from a plane or cylinder (not intersected); the offset of the points a shell's faces vote with | `analyticBoolean`, `patchClearOf`, `stitchWith` |

The other modules mostly compare with `linearTolerance` or `linearToleranceMM` directly (the curve-plane and curve-line
intersections, curve refinement, surface regions, lofts, the coplanar face Booleans). The intersections record the
value they used in their reports (`pointBindingComparisonMM`).

## 3. Points within a radius become one vertex

When the stitch builds the result, the ends of every kept piece's boundary curves become vertices. Each end is looked up
among the vertices so far, and the first one within the merge radius r = 20 ε is its vertex; an end with none becomes a
new vertex (`PointSet3`). The code's comment gives the reason vertices merge more loosely than curves are fitted: an
edge meeting a surface it touches (a double root, as where a fillet meets a sloping side) is found less precisely than a
curve where it crosses a surface.

<TolMerge />

Three properties follow from this rule, and the figure runs the kernel's class to show each:

- **A vertex sits at its first end.** Later ends move onto it, by up to r. Nothing is averaged.
- **The merge is not transitive.** Points 0.7 r apart in a row do not collapse into one vertex. Only stored points are
  compared, so a chain gives a vertex at every other point. This keeps every vertex within r of each end it took, which
  a transitive closure would not: a long chain would become one vertex of any width.
- **The grouping follows the order.** The same points added in another order are grouped differently. The stitch adds
  ends in a fixed order (pieces, then rings, then curves), so the result is reproducible.

Two looser joins come after the merge. The end of each piece and the start of the next in one ring are joined within
100 ε, with a union-find (`alias`, `canon`), because a traced curve's end lands only within its tracing tolerance of the
exact curve it meets. And a vertex lying on a curve within ε splits that curve there. Edges are then matched by their two
vertices and by their midpoints, within 10 ε, or 100 ε when a copy is traced.

The polyhedral path has no merge radius: its points are exact fractions, and two points are one vertex only when they
are equal ([Exact arithmetic for planar solids](/how/exact-boolean#stitching-and-the-stored-result)).

## 4. Tolerances stored on edges and vertices

Every B-rep edge and vertex records a `tolerance` in mm. `buildBrep` (`brep/brep-core.ts`) fills it with the B-rep's
tolerance, by default max(10⁻⁷, 10⁻¹¹ × the largest coordinate), or with an entity's own tolerance where that is larger:
a fitted offset's, as the shell's offset cavity gives each entity twice its measured deviation (D110). The analytic
Boolean builds its result with max(ε, the largest entity tolerance of its inputs), so a tolerant input's edges keep
their tolerance through later Booleans (D113).

Measured on the built kernel (a 30 × 30 × 8 plate, one top edge rounded with radius 2, a boss of radius 3 joined on top):

| Body | Edge and vertex tolerance |
|---|---|
| The extruded plate | 10⁻⁷ mm |
| After the fillet and the union (both go through the analytic Boolean) | 10⁻⁶ mm (ε) |
| The same part at 300 × the size (a 9000 mm plate), after the fillet | 1.14 × 10⁻⁶ mm: ε for S = 11 400 mm, so a coordinate of the fillet's Boolean lay past 10 m though the plate stays within 9000 mm |

The checker reads these tolerances. `checkBrep` reports an edge whose end is farther from its vertex than the larger of
their two tolerances, and a pcurve farther from its edge than the edge's tolerance. The strict check adds that every edge
lies within max(10 × its tolerance, 10⁻⁶ × the model's size) of the surfaces that use it, and that no tolerance has grown
past `TOLERANCE_CAP`, 10⁻³ × the model's size (at least 1 mm across): a tolerance that large has blown up
(`brep/brep-check-geometry.ts`).

## 5. Where no tolerance decides

- **Planar solids.** When both bodies of a Boolean are planar, every sign that decides the topology is computed on exact
  fractions ([Exact arithmetic for planar solids](/how/exact-boolean)). Binary64 only skips work whose answer is already
  certain. A body whose faces are planar only to rounding is refused there (`NOT_PLANAR_WITHIN_FLOAT`) and goes to the
  analytic Boolean, with its tolerances.
- **Stored chart parameters.** A pcurve's (u, v) pole derived from exact geometry is computed exactly and rounded once to
  binary64. The solid proof accepts it when it is exact, or when its 3D deviation is within the bound one such rounding
  can cause (`chartRoundingBoundMM`): per coordinate i, 2 × (2⁻⁵³ max(|u₀|, |u₁|) / (u₁ − u₀) × |Uᵢ| + the same for v),
  where [u₀, u₁] is the chart's domain and U its axis; about 10⁻¹⁵ of the chart's size. Anything larger is refused ("exceeds one chart rounding"). A split at an integer position stays exact;
  a split of a 22 mm box at 3.3 is certified with a deviation below 10⁻¹² mm.

## 6. Numbers read back

The analytic Boolean reads its inputs from the last result, so some quantities are computed again at every step and drift
in their last bits. A test that compares such a quantity with an exact constant, or orders by it exactly, can change its
answer after a few Booleans. D282 found two: an arc's sweep compared with π, and repeated face names ordered by their
points inside. Both now compare with a margin, π + 10⁻¹² and 100 ε. The cases are told in
[Booleans of curved solids](/how/boolean#numbers-that-must-not-flip) and
[Names that survive edits](/how/naming#_3-the-rounding-trap).

## What a tolerance is not

A tolerance says when two computed numbers stand for the same thing. It is not a licence to accept a shape the kernel
cannot build ([B-rep, robustness and refusals](/packages/cad/robustness#result-names-contact-and-tolerances)):

- A result that is not a manifold solid after the merge is refused (`TOPOLOGY`), whatever the tolerance allowed.
- When the stitch had to collapse two curves within the tolerance into one edge (inputs that graze), the result is
  checked strictly before it is returned, and refused if it fails: "the inputs graze within 0.00002 mm (the merge
  radius) and the sliver between them cannot be built".
- A requested `edgeFitTolerance` that a traced edge cannot meet after 10 halvings is refused ("parametric edge fit did
  not meet the requested accuracy"), not met more loosely; a fillet whose contacts stay off their faces past 4096
  sections is refused (`APPROX_TOLERANCE_NOT_MET`).
- A tighter `edgeFitTolerance` changes only the fit of new parametric edges; the topology tolerances stay as they are.
- A stored tolerance past the cap is a strict-check failure, not a larger allowance.

## Where it is in the code

| File | Responsibility |
|---|---|
| `packages/barocss-cad/src/numeric-policy.ts` | `CadNumericPolicy`, `linearToleranceMM`, `geometryScaleMM`, `chartRoundingBoundMM` |
| `packages/barocss-cad/src/brep/analytic-boolean.ts` | ε and its multiples (`analyticBoolean`, `cutPair`, `snapEnds`, `mergePieces`); `PointSet3`, `stitchWith` (merge, alias, edge match, result tolerance); `keyOrder` |
| `packages/barocss-cad/src/brep/curved-arrangement.ts` | `curveTolerance` (`linearToleranceMM` of a set of rings); `halves` (π + 10⁻¹²) |
| `packages/barocss-cad/src/brep/brep-core.ts` | per-entity tolerances in `buildBrep`; `checkBrep` gaps against them |
| `packages/barocss-cad/src/brep/brep-check-geometry.ts` | `TOLERANCE_CAP`; edges on their surfaces within their tolerance |
| `packages/barocss-cad/src/core/math.ts` | the geometry range (10⁶ mm) and weight range in `validateCurve` / `validateSurface` |
| `packages/barocss-cad/src/part/part-model.ts` | the modeling range for a part's lengths (`CadPartLimits.length`) |
| `packages/barocss-cad/src/intersect/own-curve-plane-intersection.ts`, `own-curve-line-intersection.ts` | the scale-relative point binding, reported |
| `packages/barocss-cad/src/convex-planar-solid-proof-internal.ts` | the one-rounding certification of stored chart parameters |
| `packages/barocss-cad/src/blend/edge-finish.ts`, `blend/rolling-ball.ts` | the fillet's ¼ ε contact tolerance |
| `packages/barocss-cad/src/blend/offset-cavity.ts` | `SMOOTH` (10⁻⁴ rad); entity tolerance from the measured deviation |

## How it is checked

- `packages/barocss-cad/test/numeric-policy.test.mjs`: the policy's constants and that the object is frozen; the
  one-rounding bound on a 22 mm chart is below 10⁻¹³; integer split positions stay exact; a split of a 22 mm box at 3.3
  is certified below 10⁻¹² mm and its parts still measure and export; holes of radius 3, 3.5, 4 and 6 on an 80 × 40
  plate are certified, radius 5 stays exact; a stored UV pole moved by 10⁻⁹ is refused.
- `packages/barocss-cad/test/numeric-policy-scale.test.mjs`: `linearToleranceMM` is 10⁻⁷ at 0 and at 10⁴ and 10⁻⁵ at
  10⁶; 600 seeded curve-plane intersections at 10³ and 10⁶ mm bind and report the tolerance of their own scale; coplanar
  curve-line intersections at 10, 10³ and 3 × 10⁵ mm find both crossings, with 10⁻⁷ in the modeling range.
- `packages/barocss-cad/test/numeric-policy-range.test.mjs`: intersection, adaptive sampling, splitting and curvature
  all work at 5 × 10⁵ mm and all refuse at 2 × 10⁶ mm; results at 100 mm keep the 10⁻⁷ floor; knots stay limited to
  10 000.
- `packages/barocss-cad/test/brep-check-strict.test.mjs`: a tolerance of 1 mm on a 10 mm sheet is reported past the cap.
- `packages/barocss-cad/test/boolean-boss-row.test.mjs`: the two D282 margins, across eight Booleans.

## Limits

- The multiples are fixed per comparison, not derived from an error bound of each computation. They were set where the
  kernel's tests and fuzzing found the need (the decision records name each change).
- Merging is order-dependent by design. A different order of pieces could group a chain of close points differently.
- The relative part only widens comparisons above 10 m. Inside the modeling range the kernel does not adapt its
  tolerance to a small part: a 0.01 mm feature is compared with the same 10⁻⁷ mm (10⁻⁶ mm in the analytic Boolean).
- Some modules still state their limits as their own literals (10 000 mm coordinates in the rigid-transform and pattern
  routes and in curve refinement) rather than reading the policy; the values are the same.
