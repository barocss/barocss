<script setup>
import MeshPQuadric from '../.vitepress/components/algorithms/MeshPQuadric.vue';
import MeshPFill from '../.vitepress/components/algorithms/MeshPFill.vue';
import MeshPOffset from '../.vitepress/components/algorithms/MeshPOffset.vue';
</script>

# Mesh processing: simplify, repair, offset

An STL, OBJ or scanned part reaches the kernel as a triangle mesh, and it is rarely ready to use. A scan has far more
triangles than its shape needs. An exported file can have cracks between triangles, triangles wound the wrong way and
holes. A part to be printed hollow needs an inner wall. This page opens up the kernel's tools for this work, in
`packages/barocss-cad/src/mesh/`. All of them work on plain arrays: positions (three numbers a vertex) and indices
(three vertex numbers a triangle).

The figures play their steps as you reach them. Use **Play**/**Pause**, the arrows or a step's number to go through
them at your own pace; with reduced motion turned on in your system, each step is shown still. The figures work on
small cases in 2D, or on a small sheet, with the kernel's methods; each one's note says what it simplifies.

## The tools at a glance

| Tool | What it does | Source | Used by |
|---|---|---|---|
| Decimate | Fewer triangles, the shape and its feature lines kept, the error measured | `mesh-decimate.ts` (`decimateMesh`) | the `decimate` part feature; the hollowing's cavity |
| Diagnose, repair | What is wrong with a mesh, and its repair as explicit steps | `mesh-repair.ts` (`diagnoseMesh`, `repairMesh`) | the studio's mesh repair (its engine worker) |
| Inner offset | A closed mesh's cavity: its triangles moved in by the wall | `mesh-offset.ts` (`meshInnerOffset`) | `shell` of a mesh body |
| Voxel field | Inside flags, depth and a zero surface on a grid | `voxel-field.ts` | the hollowing and lattices in `@barocss/cad-model` (`print/`) |
| Distance | From one mesh's samples to another's surface, one way | `mesh-distance.ts` (`meshDistance`, `meshDistanceRange`) | decimation's report; the shell's wall |
| Clearance | The least distance between two meshes, exactly | `mesh-clearance.ts` (`meshClearance`) | clearance checks in `@barocss/cad-model` |

All but `meshInnerOffset` and `meshDistanceRange` are exported from `@barocss/cad`. The distance, clearance and voxel depth all run on the
triangle hierarchy (BVH) described in [Meshes, native tools and the BVH](/how/mesh-boolean#_6-the-triangle-hierarchy).

## 1. Simplifying: edge collapse under the quadric error metric

`decimateMesh` follows Garland and Heckbert (1997). An *edge collapse* merges an edge's two vertices into one; the
triangles on that edge disappear (two in a closed mesh). The question is which edge to collapse next and where to put
the merged vertex. The answer comes from a *quadric* per vertex:

- Each triangle's plane is p = (a, b, c, d) with a unit normal (a, b, c). The squared distance of a point x̄ = (x, y, z, 1)
  to it is x̄ᵀ (p pᵀ) x̄.
- A vertex starts with Q, the sum of p pᵀ over its triangles, unweighted. x̄ᵀ Q x̄ is the sum of the squared distances
  from x̄ to all those planes, in mm².
- Collapsing u and v gives the merged vertex Q<sub>u</sub> + Q<sub>v</sub>. It is placed where that quadric is least,
  when its 3 × 3 part is well conditioned (|det| > 10⁻⁹ tr³) and the least point lies within two edge lengths of the
  edge's middle. Otherwise it is placed at the better of the two ends and the middle. The *cost* is the quadric there.
- Each vertex's cheapest collapse sits in an indexed min-heap, ordered by cost and then by vertex number, so the result
  is the same on every run. A collapse is priced again when it reaches the top. One that has become dearer goes back
  into the heap; one the checks below refuse is replaced by the vertex's cheapest collapse they allow.
- After a collapse, the kept vertex is priced again, and so is each neighbour whose cheapest collapse was with either
  vertex. Any other neighbour is offered its collapse with the kept vertex if that is cheaper.

<MeshPQuadric />

### What is kept

Meshes here carry no normals, UVs or colours, only positions. What they say about their shape is kept as *feature lines*
(D85):

| Feature line | What makes an edge one |
|---|---|
| Open boundary | it has one triangle |
| Group seam | its two triangles are in different groups (`groups`: one integer a triangle; a repair's fill patch, a facet body's face) |
| Crease | its two triangles turn by more than `feature` degrees (default 40) |

A vertex on a feature line moves only along it: both ends on lines and the edge itself a feature, placed on the edge
segment where the quadric is least. A vertex off the lines collapses onto a feature vertex and takes its place. Corners
and the ends of lines never move: a vertex with one feature edge, three or more, or two that turn by more than the
crease angle. Penalty planes, weight 100 against a triangle's 1, run through each feature edge square to its triangles
and hold the line where it was. A group seam where the surface turns by less than 20° (cos 0.94) gets no penalty: it
still slides only along itself, but straightens as cheaply as the surface allows. Every triangle keeps its winding and
its group.

A collapse is refused when it would break the mesh:

- the *link condition*: the neighbours common to both vertices must be exactly one per shared triangle, or the surface
  is pinched;
- two vertices of three triangles each that share two (a tetrahedron's edge) are not merged;
- no triangle may turn by more than 75° (cos 0.26), lose its area, or face away from the summed area-weighted normals of
  the original triangles its corners stand for.

The report counts these refusals (`refused.flip`, `refused.topology`).

### The budget and the measured error

Decimation stops at `targetTriangles`, at `ratio` × the triangle count, or before the first collapse whose √cost passes
`maxError`, whichever comes first. With none of these it goes on until nothing more may be collapsed. The report says
which (`stoppedBy`: `target`, `error` or `exhausted`) and gives `bound`, the largest √cost of a collapse made. √cost
bounds the distance from the merged vertex to each plane it gathered; it is not the distance from the original surface.

That distance is measured. `meshDistance` takes each vertex and each triangle centre of one mesh to the nearest point of
the other's surface. It runs from the original to the result (`toResultMax`) and back (`toOriginalMax`). The larger is
the Hausdorff distance, reported with the RMS of both sets of samples. These are samples, not a bound: a point between
samples can be farther.

The built kernel on a sphere of radius 10 mm, 20 480 triangles (five times subdivided):

| `ratio` | Triangles | √cost bound | To the result | Back | RMS |
|---|---|---|---|---|---|
| 0.5 | 10 240 | 0.016 mm | 0.0049 mm | 0.0052 mm | 0.0024 mm |
| 0.1 | 2 048 | 0.14 mm | 0.029 mm | 0.027 mm | 0.0105 mm |
| 0.02 | 408 | 1.35 mm | 0.15 mm | 0.15 mm | 0.055 mm |
| 0.01 | 204 | 3.71 mm | 0.31 mm | 0.30 mm | 0.10 mm |

`maxError: 0.05` on the same sphere stops at 4 546 triangles (`stoppedBy: 'error'`, bound 0.0496 mm) with a measured
Hausdorff distance of 0.014 mm. The bound grows faster than the distance because it sums squared distances to every
plane gathered.

The `decimate` part feature (`{ target, triangles? | ratio? | maxError?, featureAngle? }`) runs this on a mesh body.
Each of the body's faces is a group, named as before, so references to its faces still resolve. Its crease angle
defaults to 180°, regions only: on a noisy scan a 40° crease angle reads the noise as creases and stops early (D85).

## 2. Repairing an imported mesh

`diagnoseMesh` reports what is wrong and changes nothing. `repairMesh` runs explicit steps, all on by default
(`DEFAULT_REPAIR`), and returns new arrays, a report of what each step did, and for each output triangle the fill patch it
belongs to (`fill`, −1 for the mesh's own). The caller keeps the original (D46).

| Step | What it does |
|---|---|
| `weld` | Corners closer than the weld size w are one vertex, through a hash of cells of size w. w defaults to 10⁻⁶ of the largest coordinate, at least 10⁻⁹ mm |
| `degenerate` | Drops triangles with a repeated corner or no area at the weld size, and the same three corners a second time, either winding |
| `fins` | At each edge of more than two triangles, drops the pieces meeting there other than the largest, when they are open or enclose no volume (a fin, a doubled sheet) |
| `orient` | Winds every piece one way, breadth first across two-triangle edges, then turns each closed piece outward (positive volume) |
| `fill` | Closes each hole (a loop of one-triangle edges) with Liepa's fill; `skip` leaves chosen holes open, `coarseness` makes the patch coarser than its rim |
| `floaters` | Drops closed pieces under a share of the largest one's volume (default 0.01) |

<MeshPFill />

Two triangles that cross each other without sharing a corner are a *self-intersection*. The diagnosis and the report
count them and say where (the midpoint of each pair's centres, up to 64), through a uniform grid of cells about twice a
mean edge. Repair does not fix them, and a Boolean on such a mesh is refused, saying where.

## 3. Inner offsets: a mesh body's wall

Shelling a mesh body (`shell` on a body of facet faces) makes its cavity with `meshInnerOffset`. The cavity has the
mesh's own triangles, each vertex moved to the least-squares point of its triangles' planes moved in by the wall t, each
plane weighted by its triangle's angle at the vertex (D114). The wall it achieves is measured: the least and largest
distance from the offset's vertices and triangle centres to the mesh. It is returned as `wallMin` and `wallMax` beside the
wall asked for.

The studio's hollowing for 3D printing (`print/hollow.ts` in `@barocss/cad-model`) tries the kernel's exact shell first.
When the shell refuses, it builds the cavity on a voxel grid with the kernel's voxel field (D145) and says why it took
that route. The figure shows both on one section.

<MeshPOffset />

## 4. Distance and clearance

Two questions about how far apart meshes are have different answers:

- **How far is one mesh from another?** `meshDistance(A, B)` takes A's vertices and triangle centres to B's surface, each
  by the hierarchy's nearest query (branch and bound, nearer child first). It returns the largest distance, where it is,
  the sum of squares and the sample count. It is one way: a Hausdorff distance needs both directions.
  `meshDistanceRange` gives the least and the largest; the shell's wall check uses it.
- **How close do two meshes come?** `meshClearance(A, B)` is the least distance between the two surfaces over every
  pair of triangles, exact up to rounding, with the two closest points and their triangles. It descends both meshes'
  hierarchies together, nearest pair of boxes first, and skips any pair of boxes at least as far apart as the best found
  (D142). Two triangles are 0 apart when an edge of one crosses the other. Otherwise their distance is the least of six
  corner-to-triangle and nine edge-to-edge distances (Ericson, *Real-Time Collision Detection*, 5.1.5 and 5.1.9). It
  stops at the first 0.

The hierarchy itself, how it is built and how its two queries search it, is on
[Meshes, native tools and the BVH](/how/mesh-boolean#_6-the-triangle-hierarchy).

## Where it is in the code

| File | Responsibility |
|---|---|
| `packages/barocss-cad/src/mesh/mesh-decimate.ts` | `decimateMesh`: quadrics, feature lines and penalties, pricing and placement, the heap, the link and turn checks, the report |
| `packages/barocss-cad/src/mesh/mesh-distance.ts` | `meshDistance` (one way: max, sum of squares, where), `meshDistanceRange` (least and largest) |
| `packages/barocss-cad/src/mesh/mesh-repair.ts` | `diagnoseMesh`, `repairMesh` (weld, degenerate, fins, orient, fill: `minimumArea`, `projected`, `refine`, `relax`, `fair`; floaters), `selfIntersections` |
| `packages/barocss-cad/src/mesh/facet-brep.ts` | `weldVertices`: the cell hash the weld uses |
| `packages/barocss-cad/src/mesh/mesh-offset.ts` | `meshInnerOffset`: the least-squares offset, its four refusals, the measured wall |
| `packages/barocss-cad/src/mesh/voxel-field.ts` | `voxelInsideFlags`, `voxelDepth`, `marchingTetrahedra` |
| `packages/barocss-cad/src/mesh/mesh-clearance.ts` | `meshClearance`: the dual descent and the triangle–triangle distance |
| `packages/barocss-cad/src/mesh/triangle-bvh.ts` | the hierarchy and its nearest query (`triangleBvh`, `nearestDistance2`) |
| `packages/barocss-cad/src/part/part-mesh.ts` | the `decimate` feature: its inputs, refusals and naming |
| `packages/barocss-cad/src/part/part-shell.ts` | `shellOf`: a mesh body's shell through `meshInnerOffset` |
| `packages/barocss-cad-model/src/print/hollow.ts` | the hollowing: exact shell first, else the voxel cavity, decimated and subtracted, with drains |

## How it is checked

- **Decimation:** `packages/barocss-cad/test/mesh-decimate.test.mjs`. A gridded box of 1 200 triangles goes to its 12,
  corners exact, volume 1000. A sphere of 20 480 triangles goes to a tenth and a fiftieth: closed, wound as before, within
  0.05 and 0.25 mm, its report's distances equal to `meshDistance`'s, the same result on every run. A noisy sphere is
  decimated as a scan and with creases. A group patch keeps its square and area. An open sheet keeps its boundary. The
  test also covers the error bound and the part feature with its refusals. Conformance: `conformance/r9/decimate-grid-box`
  and `conformance/r9/decimate-sphere`.
- **Repair:** `packages/barocss-cad/test/mesh-repair.test.mjs`. A clean box is left as it was. A square hole is filled
  flat, restoring the volume exactly. A sphere's cap is filled by refinement and fairing. The tests also cover flipped and
  inside-out meshes, fins, degenerate and duplicate triangles, floaters, self-intersections (reported, Booleans refused),
  open sheets and fill coarseness. Conformance: `conformance/r3/mesh-filled`, `mesh-crossing-hole-refused`,
  `mesh-sheet-hole-refused`.
- **Mesh shell:** `packages/barocss-cad/test/r11-3.test.mjs`. Polyhedra come out exactly as their sharp-join insets. A
  mesh sphere's wall lies within its normals' spread. A hollow mesh goes through STEP and back. The refusals are tested by
  name. Conformance: `conformance/r11/shell-mesh-octahedron`, `shell-mesh-pocketed-box`, `refuse-shell-mesh-wall-too-thin`.
- **Voxel field:** `packages/barocss-cad/test/k6-voxel-field.test.mjs`. A box's inside and depth are checked exactly, and
  a sphere mesh's within its chord error. Marching tetrahedra meet a plane's field exactly, and an analytic sphere comes
  out closed, outward, genus 0, its volume converging as h². The hollowing:
  `packages/barocss-cad-model/test/hollow.test.ts`, both routes; two thick lumps on a thin bridge get two cavities and
  two drains.
- **Clearance:** `packages/barocss-cad/test/k3-mesh-clearance.test.mjs`. Random triangle soups, apart and crossing,
  match an all-pairs brute force written differently. Closed forms: two boxes, two crossed edges 16 − 10√2 apart, a box
  inside a box. Spheres are checked apart, and the result is told apart from the one-way `meshDistance`.

## Limits

- **Decimation:** the measured distance is a sample of vertices and triangle centres, not a bound. The `decimate`
  feature takes only a mesh body (`CAPABILITY` otherwise) and needs `triangles` (a whole number, 4 or more), `ratio`
  (between 0 and 1) or `maxError` (`INPUT` otherwise).
- **Repair:** self-intersections are reported, not fixed. A patch's refinement stops after 32 rounds or at 192 × its
  first triangle count + 20 000 triangles, coarser than its rim. A hole the fill cannot close (a long rim whose
  projection cannot be ear-clipped) is left open and counted in `holesLeft`. Floaters are only closed pieces; an open
  piece is never dropped as one.
- **Mesh shell:** the mesh must be closed, wound one way, with no triangle of no area (`[SHELL_MESH_NOT_CLOSED]`). It is
  refused by name when an offset triangle turns over or the whole offset turns inside out (`[OFFSET_FOLDS]`), when the
  offset meets itself or the mesh (`[WALL_TOO_THIN]`), and when the wall achieved is more than 1 % thinner than asked
  (`[MESH_WALL_THIN]`). Opening a face of a mesh body is not supported yet; a mesh sheet is refused ("thicken it
  instead").
- **Hollowing (voxel route):** the grid spacing must be at most t/2, and a grid of more than 4 × 10⁶ nodes is refused
  (`GRID_TOO_FINE`). A curved body is refused on this route (`CURVED_BODY`) until the kernel's mixed facet–analytic
  Booleans arrive. The kernel's mesh Boolean takes up to 16 000 triangles, which is why each cavity piece is decimated
  first.
