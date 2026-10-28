<script setup>
import TessSharedEdge from '../.vitepress/components/algorithms/TessSharedEdge.vue';
import TessDensity from '../.vitepress/components/algorithms/TessDensity.vue';
import TessEarClip from '../.vitepress/components/algorithms/TessEarClip.vue';
</script>

# Tessellating a B-rep for display

A B-rep stores exact geometry: planes, cylinders and NURBS patches, bounded by exact curves. A screen, an STL file
or a mesh Boolean needs triangles instead. `tessellateBrep(brep, { segmentsPerQuarter })` makes them. It returns one
triangle mesh for the whole B-rep, with each face's triangles marked and each model edge as a polyline. This is the
mesh the viewer draws and the mesh that [`exportStl`](/packages/cad/formats) writes. Measurements use the exact
geometry where they can (see [Tessellation](/packages/cad/modeling#tessellation)).

The method is in `packages/barocss-cad/src/brep/brep-tessellate.ts`. The figures run small cases worked out in the page
with the kernel's methods, and their numbers come from the built kernel.

## The stages at a glance

| Stage | What it does | Function |
|---|---|---|
| 1. Sample edges | Every edge divided once into points; each end set to its vertex's point | `edgeParameters`, `sampled` in `tessellate` |
| 2. Planar faces | Loops projected to the plane, holes bridged, ears clipped | `triangulatePolygonWithHoles` |
| 3. Ruled faces | Two curved rails joined by a strip of triangles | the zipper in `tessellate` |
| 4. Trimmed cylinders | Loops triangulated in (r·θ, height), wide triangles bisected | `cylinderTriangles` |
| 5. Other surfaces | Loops triangulated in the surface's (u, v), grid points added, bent edges bisected | `surfaceTriangles` |
| 6. Tilted chords | An edge whose chord a curved face's triangles tilt from gets a midpoint; up to two more rounds | the round loop in `tessellate` |
| 7. Output | Faces' meshes joined; edges' samples written as polylines | `joined` |

## 1. Every edge sampled once

Each face is triangulated on its own. Two faces can only meet without a crack if they agree exactly on the points along
their common edge. So the kernel samples every edge once, before any face, and both faces build their boundary rings
from those samples. The mesh is closed because the points are the same numbers, not because they are close; there
is no welding step and no welding tolerance.

<TessSharedEdge />

A face's loop becomes a ring of points: each coedge contributes its edge's samples in its own direction (reversed for
a reversed coedge), without its last point, since the next coedge starts there. Each edge's first and last samples are
replaced by its two vertices' stored points. Without that, two curves evaluated at their ends could differ in the last
bits at a corner and crack the mesh there.

Every face keeps its own block of vertices in the output, so each face can have its own normals. Across faces the
positions along a shared edge are bitwise equal, and every mesh segment there is used once in each direction.

## 2. How many samples

One setting controls the density: `segmentsPerQuarter`, written q here. The kernel takes its whole part and clamps it
to 1 … 64; it is 8 when not given. `exportStl` passes 16 when not given. What q means depends on the curve:

| Edge curve | Samples |
|---|---|
| Line | Its two ends |
| Polyline (an edge of a faceted face) | Exactly its corners, which are the facets' own vertices |
| Circular arc (a rational quadratic) | One angular grid with step π / (2q), in a frame fixed by the arc's plane; grid angles within a quarter step of the arc's ends are skipped |
| Any other curve | n = max(2, ⌈τ / (π/2) · q⌉) equal parameter steps, where τ is the total turning angle of its control polygon |

All circles in one plane share one angular grid. Two circles tangent inside each other then sample as scaled copies
of each other about the tangent point, so their polylines never cross. The straight rails of a curved ruled face (a
loft's side) are resampled to pair point for point with the opposite rail.

The chord between two samples of a circle misses the arc by at most its sagitta, s = r(1 − cos(π / (4q))). This
shrinks about 4 times each time q doubles.

<TessDensity />

q counts segments. It is not a tolerance: at the same q a circle 10 times larger is off by 10 times more.

## 3. Planar faces: bridge the hole, clip the ears

A face on a plane is the simplest case. Its rings are projected into the plane's frame (e<sub>1</sub> along the
surface's first direction, e<sub>2</sub> = n × e<sub>1</sub>, with n turned over for a reversed face). That makes the
outer ring counter-clockwise and the holes clockwise. Then `triangulatePolygonWithHoles` runs ear clipping:

- **Holes join the ring**, rightmost first. A hole that touches the ring at a point is joined there. Otherwise a bridge
  runs from its rightmost point M to the nearest ring point V that passes three tests: M lies in V's inner wedge, V lies
  in M's, and the bridge crosses no segment of the ring, of this hole or of a hole still waiting. A hole no ring point
  passes for is refused: *A hole is not inside its face boundary*.
- **Ears are clipped**, the first that passes in ring order each time: three consecutive points that turn left, with no
  other ring point inside or on the triangle. Orientation tests allow ε = 10⁻¹² × (box diagonal)².
- **Spikes** (a point whose two segments fold back onto each other, left where two curves touch) are cut off as
  degenerate triangles, so every boundary segment stays in the mesh. A ring with no ear and no degenerate point left is
  refused: *Planar face could not be triangulated*.

<TessEarClip />

The ear test looks only at the ring points in the grid cells under each ear, not at every point. A planar face gets one
normal, the plane's, turned with the face's sense.

## 4. Curved faces

A face that is not planar goes down the first of these paths that fits it.

### Ruled faces

A face whose outer loop is two curved rails joined by straight sides is a strip. Its loop has either four sides with
two opposite ones straight, or more than four sides of which exactly two are curved. Extruded sides and the walls of
an extruded circle (a seam line on each side) are faces of this kind. The two rails are zipped together: the next
triangle advances whichever rail is behind. Points are paired by their parameter across the face when it is a ruled
patch between two of its iso-lines, so the triangles follow its rulings; otherwise by their share of each rail. A side
made of several collinear lines becomes a fan. A twisted side, whose normal turns along its rulings, is also cut
across into rows: one per angular step of its twist, at least 2 and at most 2q. Its straight sides are sampled at the
rows, so its neighbours share those points too.

### Trimmed cylinders

Any other face on a circular cylinder (with holes, notches, or trimmed by an ellipse or another cylinder) is
triangulated in its unrolled domain (U, V) = (r·θ, height), from the shared edge samples. Ears are tried narrowest in
U first, which gives strips across the face rather than slivers along it. Triangles whose corners all lie on one
smooth run of the boundary are turned over with a neighbour, since the planar face beside them would otherwise have the
same triangles (D193). Then Rivara's longest-edge bisection splits every triangle wider in U than one angular step,
r·π/(2q), together with its neighbour, so the mesh stays conforming. Lengths for that are measured in (U, V/20),
because the surface is straight along V. A full-turn wall's seam is placed on the domain's two sides.

### Other smooth surfaces

Tori, cones, spheres and general NURBS patches are triangulated in their own (u, v) domain. The surface must be regular
(S<sub>u</sub> × S<sub>v</sub> not zero at a 5 × 5 grid of test points) except at a pole, a side of the domain that
collapses to one point:

1. Each boundary sample is mapped to (u, v) by Newton's method from the four nearest points of a 25 × 25 grid. A sample
   farther from the surface than 10⁻⁵ × (L<sub>u</sub> + L<sub>v</sub>) + 10⁻⁶, with L<sub>u</sub>, L<sub>v</sub> the
   surface's mean extents along u and v (or its edge's own tolerance, where that is more), is refused:
   *an edge of face … does not lie on its surface*.
2. The rings are ear-clipped in (u, v) scaled to arc length, the ear with the shortest longest side first.
3. A grid of interior points about one angular step apart is inserted Delaunay-wise. Its size along each direction is
   the surface's normal turning along it divided by the step, at most 256; points within half a cell of the boundary
   are left out.
4. Interior edges across which the surface normal turns by more than 1.5 steps are bisected along longest-edge paths.
   Then Lawson flips make the triangulation Delaunay in the scaled domain, and bisection runs again.
5. A sliver whose facet is off the surface's normal by more than 1.5 steps is flipped toward the surface when that
   improves it (D180).

Their vertex normals are the surface's own, along S<sub>u</sub> × S<sub>v</sub>, so shading matches across a smooth
edge between two faces (D79). A point at a pole (a cone's tip) is kept on the boundary; the triangles collapsed there
are dropped. On cylinders and ruled faces, the vertex normals are averaged from the face's triangles instead.

A faceted face (from an imported STL, OBJ or tessellated STEP mesh) keeps its own triangles; its edges are polylines through their
corners, so its neighbours meet it there.

### Chords a face tilts from

A chord of a curved edge lies inside the surface by its sagitta. The triangles of a curved face next to it can then
tilt, which shows as a dent where two faces meet (D79). After the faces are made, each triangle of a face from path 5
is compared with its corners' surface normals. If it tilts by more than one angular step, every edge chord among its
sides gets its midpoint added, in the edge's shared samples. The faces on those edges are then tessellated again; the
others are kept. This runs for at most three rounds in all.

## 5. What comes out

| Field | Content |
|---|---|
| `positions`, `normals` | 3 numbers per vertex; every face has its own vertices |
| `indices` | 3 per triangle, counter-clockwise seen from outside |
| `faces` | per B-rep face: `faceId`, `kind` (`planar`, `ruled`, `trimmed`, `facet`), and its range of vertices and indices |
| `edges` | per B-rep edge: `edgeId` and its samples as a polyline |

The edge polylines are the same samples the faces used. A viewer can draw the real model edges, exactly on the
triangles' sides, instead of guessing creases from the triangles.

## Exact and approximate

| Quantity | Exact or approximate |
|---|---|
| Vertices | On the exact curves and surfaces, to rounding: edge samples evaluate the curve, interior points the surface |
| Edges and triangles between vertices | Straight chords: off the exact geometry by up to the sagitta, about r·π²/(32 q²) on a circle |
| Joins between faces | Exact: shared points, bitwise equal, every segment used once each way |
| Normals | The plane's on planar faces; the surface's own on path 5; averaged from triangles on cylinders and ruled faces |
| Volume and area of the mesh | Short of the solid's; for a cylinder at q = 8, its volume by 0.64 % |

Measurements use the exact geometry where they can. A mass result computed from a mesh says `method: 'tessellated'`
and carries `volumeBound`, its estimated volume error ([Outputs](/packages/cad/modeling#outputs)).

## Where it is in the code

| File | Responsibility |
|---|---|
| `packages/barocss-cad/src/brep/brep-tessellate.ts` | `tessellateBrep`, `tessellateBrepWithParameters`; edge sampling (`edgeParameters`, `circleOf`), the round loop, the ruled zipper, `joined` |
| same file, `triangulatePolygonWithHoles` | Bridging holes and ear clipping, for planar faces and the parameter domains of curved ones |
| same file, `cylinderTriangles`, `unfoldRunTriangles` | Trimmed cylinder faces in (r·θ, height) |
| same file, `surfaceTriangles`, `splitTakenDiagonals` | Other smooth surfaces in (u, v); diagonals another face has too, bisected (D246) |
| same file, `withoutSpurs`, `emitFacets` | Spur edges that bound nothing left out (D247); faceted faces' own triangles |
| `packages/barocss-cad/src/part/part-model.ts` | `exportStl`: the same mesh as binary STL, q = 16 by default |

## How it is checked

- `packages/barocss-cad/test/brep-step2.test.mjs`:
  - *B-rep tessellation is watertight, outward and converges to the exact volume — for every family*: every directed
    mesh segment once with its opposite, and the cylinder's volume error falls more than 12 times from q = 8 to 32.
  - *planar triangulation with many holes covers exactly the face area*: 20 holes, area exact to 10⁻⁹, no inverted
    triangle.
  - *faces whose edges leave their surface are refused, not guessed*.
- `packages/barocss-cad/test/prismatic-solid.test.mjs`:
  - curves tangent inside each other stay watertight at q = 2, 8, 16 and 64, and crescents of any extent;
  - *triangulation accepts holes touching the boundary and zero-width spikes*.
- `packages/barocss-cad/test/tessellate-cylinder-ears.test.mjs`: no cylinder triangle on one smooth run of its
  boundary; no open mesh edge on fuzz-found cases and the notch tees (D193).
- `packages/barocss-cad/test/tessellate-flips.test.mjs`: a SubD box of 18 × 18 quads a side tessellates in under 3.5 s,
  closed.
- `packages/barocss-cad/test/conformance.test.mjs`: conformance cases that ask for `tessellation.watertight` are
  tessellated at their own q and must have no open edge.

## Limits

- Refused (`BrepError`, code `GEOMETRY`): a surface singular away from its poles, or a degenerate loop; an edge not
  lying on its face's surface; a hole not inside its face boundary; a planar ring with no ear
  left. A loop that names a missing coedge or edge is refused with code `TOPOLOGY`.
- The error is not bounded in millimetres: q sets the angular step, and the chord error grows with the radius.
- The edge-midpoint rounds stop after three, whatever is left.
