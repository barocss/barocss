<script setup>
import BooleanWalkthrough from '../../.vitepress/components/BooleanWalkthrough.vue';
import BooleanStages from '../../.vitepress/components/BooleanStages.vue';
</script>

# B-rep, robustness and refusals

## Booleans, fillets and offsets on exact surfaces

Each solid output is a B-rep: surfaces, boundary curves and the topology that joins them. Native faces retain their
surfaces; mesh inputs retain faceted faces. The Boolean algorithm depends on that representation.

- **Booleans.** `union`, `difference` and `intersect` use a prismatic, polyhedral, analytic or mixed mesh path, as
  described below.
- **Fillets and chamfers** roll a ball along the named edges, or cut them back, on the exact faces either side.
- **Offsets.** `shell`, `thicken` and `draft` offset or tilt faces on their surfaces.

## Guided conic lofts

A `loft` document feature can use one `guide` with `kind: 'quadratic-bezier'` and exactly three world-space
`controlPoints`, in mm. Each section must be a full circle or an inline ellipse. Use exactly two explicit frames
with identical `xAxis` and `yAxis`, and positive separation along their common normal.

Put `guide` on the `loft` feature beside `id`, `kind` and `sections`. Each section needs its own `frame` with
`origin`, `xAxis` and `yAxis`. The axes must be perpendicular unit vectors. For a circle, use `sketch` to reference
an existing circle sketch. For an inline ellipse, use `profile` with `kind: 'ellipse'`, `center` and two positive
`radii`. Use either `sketch` or `profile` in each section, never both. These sections do not use `z`.

The guide object accepts only `kind` and `controlPoints`. Each control point must contain exactly three finite numbers.

The guide starts and ends at the sections' positive local X seams. Both endpoints must match exactly. Its middle
control point must lie exactly on the plane halfway between the section planes. The kernel does not snap or project
these points.

The guide adds a quadratic transverse displacement to each intermediate section. The section stays circular or
elliptical, with radii that vary linearly between the caps. The side surfaces retain exact rational conic curves and
quadratic control points along the guide. Mass properties use section integrals, not the display mesh.

For example, unit circles at Z = 0 and Z = 3 can use guide controls `[[1, 0, 0], [3, 0, 1.5], [1, 0, 3]]`.
At the middle section, the circle centre is `[1, 0, 1.5]`. The guide's middle control point is not a point that
the curve passes through.

This option rejects polygon or mixed profiles, legacy `z` sections, differing frame axes, `smooth: true`, more than
two sections, and multiple or general rails. All controls and generated surface controls must remain within the
existing modeling coordinate range.

### Candidate: three-section conic lofts

A source candidate extends the unguided conic loft to three sections. It is not yet integrated into the product
or verified by execution. The two-section guided contract above is unchanged.

Each section is a full circle or inline ellipse on an explicit frame. All three frames must have identical
`xAxis` and `yAxis`, with positive separation between each adjacent pair of planes. The candidate joins each
adjacent pair with ruled sides. Both spans share the middle section's boundary; only the first and last sections
have caps, forming one solid rather than two separately capped bodies.

The three-section path rejects a guide, `smooth: true`, polygon or mixed profiles, and legacy `z` sections.
It does not provide a general multi-section or smooth loft. In particular, adding a third section does not extend
the quadratic guide to three sections.

## Boolean operations

Let A be the target body and B the tool body. The operation selects the solid material to keep:

| Document feature | Object API method | Material kept |
|---|---|---|
| `union` | `union(tool)` | Material in A or B, counting the overlap once |
| `difference` | `subtract(tool)` | Material in A that is outside B; reversing A and B changes the result |
| `intersect` | `intersect(tool)` | Material common to A and B |

### From numbers to a solid result

Start with a box whose X, Y and Z coordinates each run from 0 to 10 mm. Its six plane boundaries enclose 1000 mm³.
The tool is another box, or a cylinder defined by its XY centre, radius and height. Move B along X and choose an
operation. The solid view shows the inputs; the XY view shows the material selected by the operation.

For the cylinder at its initial centre (8, 5) with radius 3, the wall meets the box's X = 10 plane where
`(10 − 8)² + (y − 5)² = 9`: at Y = 5 ± √5, or about 2.764 and 7.236 mm. These crossing points split the boundaries.
The inside/outside rule then selects regions, and their 10 mm height turns the selected area into volume.

<BooleanWalkthrough />

### Build the result in 3D, one stage at a time

Choose a fixed 3D example and an operation below. Start at **Input solids**, then follow the five pictures to the final
shape. Drag the large view to rotate it. The same camera direction is used for every picture, so you can compare the cuts.
These fixed cases have separate dimensions from the moving section example above.

<BooleanStages />

### A checked code example

For two 10 × 10 × 10 mm cubes offset 5 mm along X, the overlap is 5 × 10 × 10 = 500 mm³. The union is
1000 + 1000 − 500 = 1500 mm³; the difference and intersection are each 500 mm³. This example runs with the site's
samples and checks the three resulting bodies' validity:

<<< @/../samples/cad-robust.test.mjs#boolean-import

The helper below is an independent volume oracle for these boxes. Their planar display triangles have integer
coordinates. Summing signed tetrahedra with integer arithmetic checks the volumes without a floating-point equality
test on the mass result. It is not a general volume method for curved bodies or non-integer meshes.

<<< @/../samples/cad-robust.test.mjs#integer-mesh-volume

<<< @/../samples/cad-robust.test.mjs#boolean-operations

The callback adds the tool to the target's document. Each operation returns a new part. See
[Several bodies](/packages/api#several-bodies) for tools by body name and the callback rules.

An intersection of disjoint solids is empty. Empty operands keep the set rules: union with empty keeps the other
operand, subtracting empty keeps A, and intersection with empty is empty. An empty target minus B stays empty.

## How the kernel chooses the algorithm

The part evaluator chooses from the current representations, rather than from the feature's name alone. A rotated
or imported body can therefore take a different path from an upright extrusion.

| Inputs | Path |
|---|---|
| Both represented as Z-prismatic solids | Split into height intervals; run a 2D Boolean on each pair of sections |
| Both have planar faces with straight edges | Try the exact rational polyhedral Boolean |
| Other native B-reps | Intersect surface pairs, split their face domains, classify and stitch the retained pieces |
| A mesh target with a native tool | Cut out the mesh region near the tool, process it with the native tool and rejoin the far mesh |

The mixed path also handles union and intersection with the mesh on the tool side, by swapping operands. Subtraction
keeps operand order. A native target minus a mesh tool, or two mesh operands, instead expands facet faces into planar
triangles before the remaining dispatch. This expansion is limited to 16,000 triangles per expanded operand in a
normal evaluation; a preview can set a lower limit. Larger cases are refused.

### 1. Z-prismatic solids: Boolean sections, then rebuild the boundary

A prismatic solid is a stack of height intervals. Each interval has a constant XY section made of lines and circular
arcs, including holes.

1. Collect every bottom and top height from both operands and sort the distinct levels.
2. For each interval between adjacent levels, read A's and B's sections. Run the requested 2D Boolean on them.
3. In the 2D arrangement, split curves at their crossings and merge coincident pieces. Order the directed edges around
   each vertex, trace regions and propagate winding counts from the outside region. Select regions by the operation.
4. Merge adjacent height intervals with equal sections. Build walls from their boundary curves, and horizontal caps
   where the section changes. Join shared edges into shells and assign cavity shells to their containing solids.

Circular boundaries stay circular. Their intersections can be irrational numbers, so the 2D arrangement uses
binary64 arithmetic and the scale-dependent numeric tolerance. This reduction avoids a general 3D surface-intersection
search; it does not make every coordinate calculation rational or error-free.

### 2. Planar polyhedra: split, classify and stitch with rational arithmetic

This path works on planar faces bounded by straight edges, including non-convex faces, holes and cavities.

1. For each pair of faces that meet, compute the intersection of their planes. Clip that line to both faces to obtain
   cut segments. Coplanar faces cut each other along their boundary edges.
2. Split each face by its cut segments using a planar arrangement.
3. Classify an interior point of each face piece against the other solid. Ray-crossing parity decides inside or
   outside; a degenerate ray is retried. Coincident pieces are also classified by their orientation.
4. Keep the pieces selected by the operation. Reverse retained tool-side pieces for subtraction, so cavity walls face
   the right way. Split T-junctions, join matching edges and form shells. Negative-volume shells become cavities of
   the smallest containing shell.

Coordinates enter as their exact binary64 values, converted to integer fractions with `BigInt`. The polyhedral path
uses exact rational predicates and intersections for those values. Results return to stored numeric coordinates;
this does not recover precision already lost before the operation.

A nominally planar face rotated in floating-point arithmetic can have corners that are no longer exactly coplanar.
Only the `NOT_PLANAR_WITHIN_FLOAT` failure retries the pair through the analytic path. Other polyhedral failures are
passed through.

### 3. Curved B-reps: intersect the surfaces and trim their face domains

The analytic path retains each face's surface and changes the boundary that trims it. It first rejects face pairs
whose bounding boxes do not meet, then computes cuts for the remaining pairs.

- Plane/plane and supported plane/cylinder or cylinder/cylinder pairs use their geometric intersection formulas.
  Their curves can be lines, circles, ellipses or parametrised branches.
- General surface pairs use a surface-intersection search. Coarse patch triangles supply candidate starting points.
  Each point is refined onto both surfaces. A predictor follows the intersection tangent, the cross product of the
  two surface normals; a Newton corrector returns the point to both surfaces. Tracing continues in both directions
  until it reaches a domain boundary or closes a loop.
- Each cut is mapped into both faces' 2D parameter domains. A plane uses a local plane frame; a cylinder uses angle
  scaled by radius and axial height; a general surface uses scaled U/V coordinates. The curve arrangement splits each
  trimmed domain into pieces.
- The pieces are classified against the other solid and selected as below. Matching boundary pieces are joined into
  shells. The code handles coincident surfaces separately, so their boundaries are not kept twice.

| Operation | Pieces away from coincident boundaries |
|---|---|
| Union | Keep each operand's pieces outside the other |
| Intersection | Keep each operand's pieces inside the other |
| Difference A − B | Keep A's outside pieces and B's inside pieces; reverse B's pieces |

For a same-oriented coincident patch, union and intersection retain one copy. Difference removes that shared patch;
an oppositely oriented contact on A is handled separately. Tangencies need additional classification and manifold checks.

The surface remains a native surface, but a general intersection edge can be a fitted cubic Bézier chain. The path
uses binary64 calculations, Newton iteration and numeric tolerances; it is not an exact-arithmetic solution for every
NURBS pair. A tighter requested edge fit is checked and can refuse the result; it does not relax topology tolerances.

### 4. Mesh with a native tool: process the nearby mesh

For a mesh target with a native tool, the mixed algorithm limits the expensive face operation to the affected region:

1. Split the mesh against a padded box around the tool. Keep the far triangles aside and cap the nearby region for
   the Boolean.
2. Convert the nearby triangles to planar faces and run the analytic Boolean with the native tool. A normal evaluation
   admits at most 16,000 nearby mesh triangles; the total mesh can be larger. Open or self-intersecting meshes are refused.
3. Tessellate the nearby result, remove temporary caps and join it to the far mesh. Intersection discards the far mesh.
4. Repair boundary T-junctions and rebuild the facet body. Restore native tool surfaces on the faces that came from
   them; the rim against the mesh remains a polyline with recorded chord-deviation tolerances.

This path preserves the mesh representation of the input. It does not turn a scanned surface into an exact smooth
surface. The nearby-triangle limit and the facet-expansion limit above apply to different stages.

### More complex shapes: what changes

The five 3D examples show three sources of complexity:

- **Different height ranges.** Two offset boxes do not use one shared section for the whole height. In the first 3D
  example the levels are 0, 2, 10 and 12 mm. Only the middle interval contains both solids. Its overlap is
  5 × 7 × 8 = 280 mm³. Rebuilding the boundary must also close the steps at Z = 2 and Z = 10.
- **Several loops and bodies.** The plate example uses `A − (B₁ ∪ B₂)`. Its cap is one outer rectangle with two inner
  circles. The hole walls must connect the two caps with reversed cutter-side orientation. The plate remains one body;
  its intersection with the two cutters has two bodies. A single feature result can therefore contain several bodies.
- **A section that changes continuously.** Tilting a circular cutter makes elliptical cuts on the plate caps. For the
  30° cutter shown above, each ellipse has semiaxes 2 / cos 30° ≈ 2.309 mm and 2 mm. Its centre is at
  X = (Z − 4) tan 30°: about −2.309 mm on the bottom and +2.309 mm on the top. One constant XY section is insufficient.

The **crossing cylinders** example goes further. Their wall equations are `x² + y² = 16` and `y² + z² = 6.25`.
Subtracting them gives `x² − z² = 9.75`. Points on their common curve must satisfy both original equations.
The curve runs through space on two curved faces. Each cylinder needs its own angle/height coordinates to split its
face domain. The final model retains cylindrical surfaces bounded by these spatial curves; the viewer displays triangles.

For a general pair of smooth B-spline or NURBS faces, a single circle or ellipse formula may not exist. The kernel uses
candidate patches, refinement and tracing as described in [Curved B-reps](#_3-curved-b-reps-intersect-the-surfaces-and-trim-their-face-domains).
A surface intersection point must lie on both surfaces: `Sₐ(u,v) = Sᵦ(s,t)`. Tracing uses both parameter pairs.
The cross product of their surface normals gives a tangent direction when those normals are not parallel.
Tangencies, small loops, seams and a curve leaving a trimmed domain need separate handling. Unsupported cases can refuse.

For scanned or faceted shapes, use the [mixed mesh path](#_4-mesh-with-a-native-tool-process-the-nearby-mesh).
A dense scan has many candidate triangles; clipping the nearby region limits the work. A mesh cutter still has planar
facets. Adding display triangles does not recover an exact cylinder or smooth surface from that mesh.

Boolean order also matters. `A − (B ∪ C)` cuts both tools from A. `(A − B) ∪ C` adds C after the first cut.
An empty result, a disconnected result, a cavity and an invalid self-touching boundary are different outcomes.
A successful picture for one fixed case does not establish support for all inputs of that surface family.

### Result names, contact and tolerances

Retained faces keep their source names. Split pieces receive `#k` suffixes, and edges are named from their two faces.
These names let later operations refer to the result, subject to the reference checks described under
[Names](/packages/cad/modeling#names).

Separate lumps that meet only at an edge or point can remain separate bodies in one output. A single boundary that
touches itself and cannot form a manifold solid is refused. A tolerance used to compare points is different from a
recorded edge-fit error; neither is a licence to accept an unsupported topology.

Display tessellation density controls the display and STL. It does not select the native Boolean algorithm. The mesh
path has its own sampling and tolerance work because a mesh is already part of its input.

### Implementation map

These are the current source paths under `packages/barocss-cad/src/`:

| Source | Responsibility |
|---|---|
| `part/part-model.ts` | Dispatch, empty operands, planar retry and mixed mesh operand order |
| `features/prismatic-solid.ts` | Height intervals and B-rep reconstruction |
| `brep/curved-arrangement.ts` | Line, arc and parametric-curve arrangements in 2D |
| `brep/polyhedral-boolean.ts` | Rational planar intersections, classification and shell assembly |
| `brep/analytic-boolean.ts` | Surface cuts, face-domain splitting, classification and stitching |
| `intersect/surface-intersection.ts` | Predictor/corrector intersection tracing |
| `mesh/facet-boolean.ts` | Nearby mesh/native processing and reconstruction |

## Candidate: small-cap conical chamfer

A source candidate adds a chamfer to the complete outer rim where the smaller planar cap meets the conical wall
of one solid frustum. It is not integrated into the product, and its execution checks have not been completed.
Select a named edge on that closed circular rim. If the rim is represented by joined edge pieces, selecting one
piece applies the finish around the complete circle; it does not request a partial chamfer.

The distance is in mm, measured from the original corner along each adjoining face in the axial section. It must
be finite and positive. Both contact points must stay strictly inside their faces, with clearance from the other
cap and the rotation axis. A distance equal to a support limit is refused; reaching the axis is not allowed.

This candidate excludes partial revolutions, the larger bottom rim, concave corners, hollow bodies and bodies that
are not one closed solid frustum. Here “top” means the smaller cap relative to the frustum's axis, not world Z.
The direct finishing operation reports an unsupported scope as `GEOMETRY` with `CONE_TOP_CHAMFER_SCOPE` in its
message, and an inadmissible distance as `INPUT` with `CONE_TOP_CHAMFER_SIZE` in its message. These message tags do
not replace the error's `code`. Other conical edges remain outside this candidate's supported scope.

## Strict validity and typed refusals

`checkOutput(output)` runs the strict check on an output. It checks:

- the topology: closed shells, each edge used twice;
- that edges lie on their surfaces;
- that loops don't cross;
- that there are no slivers;
- that tolerances stay under their cap.

The report gives `valid`, the first issues, the counts, each body's topology (shells and genus) and the largest gaps.

An operation the kernel can't complete correctly throws a `CadPartError` instead. It has:

- **`code`**: the specific code its message starts with in brackets, such as `RADIUS_EXCEEDS_FACE`, or, when it has
  none, its category;
- **`details.category`**: one of `FORMAT`, `INPUT`, `PARAMETER`, `REFERENCE`, `SELECTION`, `CAPABILITY` or `GEOMETRY`;
- **`feature`**: the id of the feature it comes from;
- **a message** saying what went wrong, and what would work.

<<< @/../samples/cad-robust.test.mjs#refusals

An unsupported native operation is refused instead of silently replacing the body with a display mesh. Supported
curve fitting and mesh operations keep their own numeric tolerances, as described above.

## Touching lumps as separate bodies

When a Boolean leaves pieces that touch only along an edge or at a point, they stay separate bodies of one output.
They aren't welded into a body whose edge is shared by four faces, and they aren't refused.

<<< @/../samples/cad-robust.test.mjs#touching

The studio carries this through: such a body exports as one STL file per piece, or as separate 3MF objects.

## How it is checked

- **Conformance.** `conformance/` holds over 400 cases in folders named by the roadmap step that added them. A case
  that a later step superseded is kept as the record, but not run.
  - Each case is a part document and what any correct implementation must produce: volume, centroid, area, bodies,
    topology, face names, a watertight tessellation, a STEP round trip, sheet-metal and frame reports, or the error it
    is refused with.
  - Each case says where its expected values come from: closed form, an independent tool, or this kernel.
  - `test/conformance.test.mjs` checks every case.
- **The robustness runner** (`pnpm rb`) puts every conformance case and the seed corpus (`robustness/corpus/`)
  through the kernel. Each case runs in a worker under a time limit. The runner prints pass rates by stage and
  category, marks known failures as TODO, and fails on any failure that is new.
- **Properties** (`pnpm rb:props`): generated inputs checked against stated properties, with the smallest
  counterexample when one fails.
- **The fuzz** (`pnpm rb:fuzz`):
  - It runs seeded random CSG trees, each checked against an independent ray-casting oracle: valid, watertight, and
    with its volume and centroid within the oracle's bounds.
  - Each case is OK, KNOWN or REFUSED (counted by code). Anything else is a finding: WRONG, INVALID, CRASH or TIMEOUT.
  - A finding is shrunk to its smallest tree and can be saved as a replayable case.

These need the built package (`pnpm build:library`). [How it is verified](/reference/verification) covers the
studio's checks too.
