<script setup>
import ValidCube from '../.vitepress/components/algorithms/ValidCube.vue';
import ValidEuler from '../.vitepress/components/algorithms/ValidEuler.vue';
import ValidBroken from '../.vitepress/components/algorithms/ValidBroken.vue';
</script>

# What makes a B-rep valid

A solid in the kernel is a *B-rep* (boundary representation): a set of records that describe its boundary, from the
body down to its faces, edges and vertices. Every operation that makes a body returns such a set, and one function,
`checkBrep`, decides whether it describes a solid. The Booleans check their result before returning it, `checkOutput`
runs the strict check on a part's output, and the conformance cases and the fuzz require every result to pass it.

This page covers the records, the topological checks, the Euler–Poincaré count, the geometric checks and the refusals
for results that are not manifold. The figures use the kernel's own records and messages, read from the built kernel.
Use **Play**/**Pause**, the arrows or a step's number to go through a figure at your own pace.

## The records

A B-rep is plain JSON: seven flat lists of records keyed by id, plus a header (`format: 'barocss-brep'`, `version: 0`,
`lengthUnit: 'mm'` and the `source` it was converted from). Each record points to the records above and below it.

| Record | Holds |
|---|---|
| Body | `kind` (`solid` or `sheet`), its shells |
| Shell | its body, its faces, `closed` |
| Face | its shell, a surface (NURBS or a facet patch), a `sense`, its loops, an optional persistent `name` |
| Loop | its face, `kind` (`outer` or `inner`), its coedges in order |
| Coedge | one use of an edge by a loop: the edge, a `sense`, its loop, `next`, `prev`, its `twin`, an optional `pcurve` |
| Edge | a 3D curve over its whole domain, its two vertices (domain start, domain end), a tolerance, an optional name |
| Vertex | a point and a tolerance |

A face's `sense: 'forward'` means its outward normal is ∂S/∂u × ∂S/∂v; `reversed` means the opposite. A coedge's
`forward` runs its edge from `vertices[0]` to `vertices[1]`. A *pcurve* is the edge drawn in the face's (u, v)
parameters, a curve with z = 0 over the edge's own domain.

Tolerances belong to each vertex and edge, not to the model. `buildBrep` gives every entity
max(10⁻⁷ mm, 10⁻¹¹ × S), S the largest coordinate of the vertices, unless the entity brings a larger one of its own
(a fitted offset's edges do, D110). Builders describe faces as loops of directed edge uses; `buildBrep` names the
loops and coedges, links `next`/`prev` and pairs as twins the two uses of each edge that has exactly two, of opposite
senses.

<ValidCube />

## The topological checks

`checkBrep` runs these in order and reports each problem it finds as `kind: detail`:

- **References.** Ids are unique, every id a record names exists, and each record points back to its owner: a shell to
  its body, a face to its shell, a loop to its face, a coedge to its loop. Persistent names are unique among faces and
  among edges.
- **Faces.** Each face has exactly one outer loop.
- **Loops.** A loop is not empty. Its coedges' `next` and `prev` follow the listed order, and each coedge ends at the
  vertex where the next one starts.
- **Twins.** A coedge's twin names it back, uses the same edge and has the opposite sense.
- **Closed shells.** In a closed shell every edge has exactly two uses. In any shell an edge with no use is an issue.
- **Vertices.** Around each vertex of a closed shell, the walk *coedge → its next → that one's twin* must reach every
  coedge ending at the vertex. The faces round the vertex then form a single fan, so two solids sharing only a corner
  fail here.
- **Connected shells.** The faces of a shell form one component through their twins.
- **Face sense.** The outer loop runs counter-clockwise about the outward normal (below, with the geometry).
- **Euler–Poincaré** per body (next section).

## Euler–Poincaré: counting the topology

For a body with V vertices, E edges, F faces, L loops, S shells and G through holes (its *genus*):

**V − E + F − (L − F) = 2(S − G)**

L − F is the number of inner loops (rings), since every face has one outer loop. `checkBrep` counts per body: the
body's shells, their faces and those faces' loops, the edges its coedges use and those edges' vertices. It solves for
the genus, G = S − (V − E + F − (L − F)) / 2, and reports it in `topology`. For a body of kind `solid` whose shells are
all closed, G must be a whole number, 0 or more; otherwise the body *fails Euler–Poincaré*. Each shell is one closed
surface: a cavity is a second shell of the same body.

The formula is a count: it catches a missing face or a stray edge, not a misplaced one. Counts from `checkBrep` on
kernel bodies:

| Body | V | E | F | L | S | G |
|---|---|---|---|---|---|---|
| Cube, `rectangle(20, 20).extrude(20)` | 8 | 12 | 6 | 6 | 1 | 0 |
| Plate with one round hole, `.hole(…)` (its wall cut by one seam edge) | 10 | 15 | 7 | 9 | 1 | 1 |
| Plate with one square hole, `extrudeProfileWithHoles` | 16 | 24 | 10 | 12 | 1 | 1 |
| The same plate with three square holes | 32 | 48 | 18 | 24 | 1 | 3 |
| A cube minus a box inside it (`booleanPolyhedra`) | 16 | 24 | 12 | 12 | 2 | 0 |

The kernel also builds B-reps with *Euler operators* (`BrepEditor`, `brep-euler.ts`). Each changes the counts in a way
that keeps the formula, so topology built only from them satisfies it before any geometry is attached.
`extrudeProfileWithHoles` builds plates with holes this way.

| Operator | Makes | Changes |
|---|---|---|
| `mvfs` | a vertex, a face with a loop anchored at it, a shell | +1 V, +1 F, +1 S |
| `mev` | an edge and a vertex: a strut out of a loop vertex | +1 V, +1 E |
| `mef` | an edge and a face: a loop split between two of its coedges | +1 E, +1 F |
| `kemr` | kills an edge whose two uses are on one loop, makes a ring | −1 E, +1 ring |
| `kfmrh` | kills a face with no rings; its loop becomes a ring of another face | −1 F, +1 ring, +1 G |

<ValidEuler />

## The geometric checks

These run in every check, each within the tolerances of the entities involved:

- **Curves and surfaces** pass their own validation (`validateCurve`, `validateSurface`); a facet patch passes
  `facetPatchProblem`.
- **Edge ends.** The curve at the start and end of its domain lies within max(vertex tolerance, edge tolerance) of the
  vertex. The largest gap is reported as `maximumVertexGap`.
- **Pcurves.** A pcurve has the same domain as its edge. At 5 samples (`pcurveSamples`), it stays inside the surface's
  domain (within 10⁻⁹) and S(pcurve(t)) is within the edge's tolerance of the edge at the same t. The largest gap is
  `maximumPcurveGap`.
- **Face sense.** The outer loop's vector area, A = ½ ∮ p × dp, must point the way of ∂S/∂u × ∂S/∂v at the middle of
  the surface's domain for a forward face, the other way for a reversed one. Straight edges count by their corners,
  curves by 16 samples. A loop that encloses no net area (at most 10⁻⁶ × extent²) cannot be judged this way and is
  skipped. On a surface that turns by more than a half turn without a pole, such as a cylinder's wall over most of a
  turn, the loop's winding in the face's own (u, v) domain decides when it can be told (D257, D263). A facet face's
  boundary must have the vector area of its triangles, with its sense's sign.

### Strict

`checkBrep(brep, { strict: true })` adds the checks of `brep-check-geometry.ts`. They cost point inversions, so the
builders' own checks leave them out; the analytic Boolean and `checkOutput` run them.

- **Tolerances under a cap.** No vertex or edge tolerance exceeds 10⁻³ × size, where size is the largest vertex
  coordinate, at least 1 mm.
- **Edges on their surfaces.** Each edge is sampled along each of its uses, a straight line at 3 points and a curve at
  9. Each sample's distance from the face's surface must be at most max(10 × the edge's tolerance, 10⁻⁶ × size). A
  plane measures the distance to the plane. Another surface finds the sample's (u, v) by damped Newton steps
  (Levenberg–Marquardt) started from the four nearest points of a 16 × 16 grid and from the previous sample's (u, v).
  The largest distance is `maximumEdgeSurfaceGap`. A facet face's polyline edges must pass only through its patch's
  own vertices.
- **Loops that cross.** In the face's parameters, no loop crosses or touches itself or another loop of the face. A
  crossing found on the 9-sample chords is confirmed on chords 8 times finer before it is reported, since chords cut
  inside a curve's bulge (D191). A loop passing one vertex twice without crossing there is allowed (D194), and so is a
  cusp, where two curves leave a vertex tangent on one side (D274). Faces on a surface with a seam or a pole skip this
  test, since their boundary's parameters are ambiguous there.
- **Slivers.** A planar face whose width, 2 × area / perimeter, is below its edges' tolerance is a sliver. So is a
  *lens*: a face of one loop of two edges that stay within 10⁻² of their chord of each other all along, where the face
  across one of them is tangent to it (normals within 10⁻⁴ rad at its middle) (D102).

<ValidBroken />

## Refusals for results that are not manifold

A Boolean of two solids that touch only along an edge or at a vertex produces boundary that is not a manifold: an edge
with four uses, a vertex whose faces form two fans. The kernel never returns such a body.

- **Separate bodies (D204).** Where the result is lumps touching along a line or at a point, the analytic Boolean
  (`splitTouchingEdges`) pairs an edge's four uses by lump and moves the second lump's pair to a copy of the edge. Each
  lump becomes a body of its own, closed and valid by itself. The prismatic route already emits such lumps as separate
  bodies, and `evaluateCadPart` returns them as one output with `bodyCount` 2.
- **A lump touching itself (D275)** is refused, typed `GEOMETRY`. In the analytic Boolean: a planar face whose boundary
  passes one point at two vertices, "the result touches itself at (…): a face's boundary passes that point twice; the
  inputs touch along a line there". In prismatic solids: "the solid touches itself along the vertical line at (…): two
  of its walls meet there from outside each other".
- **Any other failure** of the final check is refused, typed `TOPOLOGY`, with the check's first issue: "polyhedral
  Boolean: the result is not a manifold solid (the inputs touch along an edge or at a vertex): …", and the same for the
  analytic Boolean.
- **Cavities.** The Booleans sort the shells of a result by signed volume: positive shells are outer ones, the others are
  cavities, each placed in the smallest outer shell that contains it. A cavity inside no outer shell is refused, "a
  cavity lies in no outer shell". `checkBrep` itself checks neither the sign of a body's volume nor where its cavities
  lie.

`assertValidBrep` throws a `BrepError` carrying the report when a B-rep is not valid: code `GEOMETRY` when the first
issue is a geometry issue, `TOPOLOGY` otherwise.

## What `checkOutput` reports

`checkOutput(output)` is `checkBrep(output.brep, { strict: true })`, computed once per output and kept. The report holds:

| Field | What it is |
|---|---|
| `valid` | true when no issue was found |
| `issues` | the first problems found, at most 32, each `kind: detail`; kinds are `reference`, `naming`, `topology`, `geometry`, `orientation` and, in strict, `tolerance` (a duplicate id is reported under its record's kind) |
| `counts` | the numbers of bodies, shells, faces, loops, coedges, edges and vertices in the B-rep |
| `topology` | per body: V, E, F, L, S and the genus from Euler–Poincaré |
| `maximumVertexGap`, `maximumPcurveGap` | the largest edge-end and pcurve gaps measured |
| `maximumEdgeSurfaceGap` | in strict, the largest distance of an edge sample from a surface of a face using it; else 0 |

The guarantees this gives to a modeling result are listed on
[B-rep, robustness and refusals](/packages/cad/robustness#strict-validity-and-typed-refusals). How a Boolean builds the
result this check reads is on [Booleans of curved solids](/how/boolean#_6-stitching-the-result).

## Where it is in the code

| File | Responsibility |
|---|---|
| `packages/barocss-cad/src/brep/brep-core.ts` | The record types; `buildBrep` (ids, next/prev, twins, tolerances); `checkBrep` (references, loops, twins, closed shells, vertex fans, connectivity, pcurves, face sense, Euler–Poincaré); `assertValidBrep`, `BrepError`; `loopVectorArea`, `loopWindsInDomain`, `wrapsWithoutPoles` |
| `packages/barocss-cad/src/brep/brep-check-geometry.ts` | `strictGeometry`: the tolerance cap (`TOLERANCE_CAP`), edges on surfaces (`planeMapper`, `surfaceMapper`, `nearestUV`), loop crossings (`ringsCross`, `pinch`, `cuspShape`), slivers and lenses (`lensGap`) |
| `packages/barocss-cad/src/brep/brep-euler.ts` | `BrepEditor`: `mvfs`, `mev`, `mef`, `kemr`, `kfmrh`, `toBrep` |
| `packages/barocss-cad/src/brep/brep-sweep.ts` | `extrudeProfileWithHoles`: a profile with holes built by Euler operators |
| `packages/barocss-cad/src/numeric-policy.ts` | `linearTolerance` 10⁻⁷ mm, `relativeLinearTolerance` 10⁻¹¹ |
| `packages/barocss-cad/src/brep/analytic-boolean.ts` | `splitTouchingEdges` (D204), the self-touch refusal (D275), the final checks, cavities by signed volume |
| `packages/barocss-cad/src/brep/polyhedral-boolean.ts` | The final check and its `TOPOLOGY` refusal; cavities by signed volume |
| `packages/barocss-cad/src/features/prismatic-solid.ts` | The prismatic self-touch refusal (D275) |
| `packages/barocss-cad/src/part/part-model.ts` | `checkOutput` |

## How it is checked

- `packages/barocss-cad/test/brep-core.test.mjs`:
  - *every modeling body family converts to one valid B-rep with the right Euler–Poincaré counts*: the cube, a hex
    prism, the plate with a hole (V 10, E 15, F 7, L 9, G 1), a cylinder, an L-prism, a slot and a union;
  - *the checker catches broken topology, geometry and orientation*: a wrong `next`, an open shell, a moved vertex, a
    flipped face, a pcurve off its edge, a broken twin;
  - *the builder links next/prev and twins; shells must be connected and manifold*: two cubes as two shells are valid,
    as one shell not connected, and sharing one corner not manifold.
- `packages/barocss-cad/test/brep-check-strict.test.mjs`: an edge 0.5 mm off its face's plane, a bow-tie loop, a
  sliver and a 1 mm tolerance on a 10 mm sheet are each reported; chord-only crossings (D191) and loops through a vertex
  twice (D194) are not; an edge along a sphere patch's meridian from its pole has no false gap.
- `packages/barocss-cad/test/brep-step2.test.mjs`: *Euler operators change V, E, F, L, S as defined and keep
  Euler–Poincaré*; *profiles with holes extrude through Euler operators: genus = holes*.
- `packages/barocss-cad/test/polyhedral-boolean.test.mjs`: a through hole has genus 1 and a cavity two shells; *solids
  touching only along an edge or at a vertex are refused as non-manifold, not returned broken*.
- `packages/barocss-cad/test/analytic-boolean.test.mjs` (*ellipses, quartics, seams and merged faces*): boxes in contact
  along a line are two bodies, strictly valid, 500 + 500 mm³ (D204).
- `packages/barocss-cad/test/commute-k16-findings.test.mjs`: *a union whose parts touch along a line from outside each
  other is refused, typed* (D275), in both orders.
- `packages/barocss-cad/test/conformance.test.mjs`: every conformance case's outputs must pass `checkOutput` and match
  its expected shells and genus per body.

## Limits

- The check is local and topological plus sampled geometry. It does not test whether two different faces intersect
  each other in 3D, whether a body's volume is positive, or whether a cavity lies inside its outer shell. The Booleans
  decide the last two by signed volume when they build a result.
- Geometry is sampled, not proven: an edge against its surface at 3 or 9 points, a pcurve at 5, a curved loop's vector
  area at 16 per edge.
- Faces on surfaces with a seam or a pole are not tested for crossing loops.
- `issues` keeps the first 32 problems only.
- A sheet body (or a shell not marked closed) is not held to two uses per edge, the vertex fans or Euler–Poincaré; its
  genus is still reported, and can be a fraction.
