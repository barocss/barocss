<script setup>
import MeshBRegion from '../.vitepress/components/algorithms/MeshBRegion.vue';
import MeshBBuild from '../.vitepress/components/algorithms/MeshBBuild.vue';
import MeshBQuery from '../.vitepress/components/algorithms/MeshBQuery.vue';
</script>

# Meshes, native tools and the BVH

An STL, OBJ or scanned part comes into the kernel as a *mesh body*: a closed triangle mesh kept as triangles, its
faces regions of the mesh (*facet faces*), not one face per triangle and not a smooth surface. A designer then wants
to drill it, add a boss to it or cut it with a native tool: a cylinder, a sphere or a sketch extruded into exact faces.
Turning the whole mesh into planar B-rep faces would cost time for every triangle, even those far from the tool.

This page opens up two pieces of the kernel that make such work cheap:

- the **mixed Boolean** of a mesh target with a native tool. Only the mesh near the tool goes through the exact
  Boolean, and the tool's faces stay exact. [B-rep, robustness and refusals](/packages/cad/robustness#_4-mesh-with-a-native-tool-process-the-nearby-mesh)
  summarises it; here each stage is shown on a real run;
- the **triangle hierarchy** (a BVH, bounding-volume hierarchy). It answers two questions about a mesh fast: where a
  ray first meets it, and how far a point is from it. Facet point classification, the mesh distance and the studio's
  print, mould and machining checks all use it.

The figures play their steps as you reach them. Use **Play**/**Pause**, the arrows or a step's number to go through
them at your own pace; with reduced motion turned on in your system, each step is shown still.

## The mixed Boolean at a glance

| Stage | What it does | Source |
|---|---|---|
| 1. Dispatch | A Boolean with mesh faces on one side and none on the other takes this path | `part/part-model.ts` (`boolean`, `facetWith`) |
| 2. Check | The mesh must be closed and must not cross itself | `mesh/facet-boolean.ts`, `mesh/mesh-repair.ts` (`selfIntersections`) |
| 3. Cut | The mesh split by each plane of a padded box round the tool; the far parts set aside, the near part capped | `mesh/facet-split.ts` (`splitSoup`) |
| 4. Boolean | The near part as planar faces, through the exact analytic Boolean with the tool | `mesh/mesh-brep.ts` (`brepFromTriangles`), `brep/analytic-boolean.ts` |
| 5. Rejoin | The near result tessellated, its caps dropped, the far triangles added back, T-junctions mended | `mesh/facet-boolean.ts` (`mendTJunctions`) |
| 6. Restore | A facet body again; the tool's faces given their exact surfaces back, the rim's tolerance recorded | `mesh/facet-brep.ts`, `mesh/facet-boolean.ts` (`restore`) |

## 1. Which Booleans take this path

The part model's Boolean dispatcher looks at both operands (D52):

| Target | Tool | Operation | Path |
|---|---|---|---|
| mesh faces | no mesh faces | union, difference, intersection | the mixed Boolean |
| no mesh faces | mesh faces | union, intersection | the mixed Boolean, operands swapped (both operations are symmetric) |
| no mesh faces | mesh faces | difference | the planar path: the mesh expanded to one planar face per triangle |
| mesh faces | mesh faces | any | the planar path, both expanded |

The planar path takes at most 16,000 triangles per expanded mesh (`FACET_EXPLODE_TRIANGLES`), fewer when an
evaluation asks for less (a preview, 5,000). Above that it is refused with `CAPABILITY`. The mixed path has no limit on
the whole mesh; its limit counts only the triangles near the tool (section 3).

A body that already holds exact faces from an earlier mixed Boolean (a drilled scan drilled again) takes the mixed
path the same way: its exact faces are tessellated into the triangles, their surfaces noted, and given back at the end.

## 2. Two checks first

A Boolean needs an inside, so two meshes are refused before any work:

- an open mesh, kept as a sheet body: `GEOMETRY`, *Booleans need a closed solid: this mesh is open (a sheet)*;
- a mesh that crosses itself: `GEOMETRY`, with the number of crossings and where the first one is (D46). The check runs
  once a body and is remembered, so later Booleans on the same body do not pay for it again.

## 3. Cut out the near part

The figure runs the whole path on a small case: a plate of 176 triangles, 40 × 20 × 4 mm, drilled through by a
cylinder of radius 3.5 mm. The triangles in it are the kernel's own, from a run of these stages.

<MeshBRegion />

**The padded box.** The tool is tessellated coarsely, at 4 segments a quarter, only to find its box. The box is made
larger on every side by

`pad = 0.1 × (the tool's smallest extent) + 10⁻³ mm`

For the cylinder, 7 × 7 × 15 mm, the pad is 0.701 mm. Outside this box the mesh cannot meet the tool, and the caps
made at its planes stay far from the tool's faces, more than any tolerance.

**Plane by plane.** The mesh is welded into one triangle soup, each triangle tagged with the face it came from. The
soup is split by the box's planes in turn: x low, x high, y low, y high, z low, z high. A plane that does not pass
strictly through the mesh's box is skipped; on the plate both z planes are. Each split is the one the mesh plane cut
uses (`splitSoup`, D50):

- each vertex's side is decided once. A vertex within 2 × weld of the plane is moved onto it and counted above, with
  weld = max(10⁻⁹, 10⁻⁶ × size) and size the largest coordinate's magnitude;
- each crossed edge is cut once, keyed by its two vertices, so the two triangles at that edge share the new point;
- a plane square to an axis gets the plane's coordinate exactly at its cut points, so the cap's points are exactly
  coplanar;
- the side kept is closed by a cap. Its open edges on the plane are chained into loops (where loops touch at a corner,
  the turn furthest to the left), holes found by containment, and the loops triangulated from those very points.

The side cut away stays plain triangles: no body is built for it. After the last plane the near part is a closed
solid. On the plate it has 36 mesh triangles and 126 cap triangles. If more than 16,000 mesh triangles are near
the tool, the Boolean is refused with `CAPABILITY`, saying how many and suggesting a smaller tool or a coarser mesh.
An evaluation can lower the limit, as it can for the planar path.

If no part of the mesh is inside the box, the two do not meet: a difference returns the mesh as it was, an
intersection returns nothing, and a union returns both bodies side by side.

## 4. The exact Boolean, then one soup again

**Planar faces.** The near triangles become a planar B-rep: the coplanar triangles of one source face join into one
face, named by a token for that source (`t<k>`), and the cap triangles become faces named `cap`. The tool's faces are
renamed with tokens the same way. The analytic Boolean (the one in [Booleans of curved solids](/how/boolean)) then
runs on this small body and the tool. Its refusals come back as the mixed Boolean's: `CAPABILITY` for what it does
not support, `GEOMETRY` otherwise.

**Rejoin.** The near result is tessellated at 32 segments a quarter (the option `segmentsPerQuarter`), see
[Tessellating a B-rep](/how/tessellation). Its faces named `cap` are left out, and the triangles set aside are added
back. An intersection leaves them out instead: nothing outside the box is inside the tool.

**T-junctions.** The cuts ran one after another. A piece set aside by an early cut does not have the corners that
later cuts added on its cut line, so a later corner lies inside one of its edges: the mesh has a crack of zero width
there. The soup is welded again (the same weld), and the open edges are found: directed edges a → b with both ends on
one cut plane (within 4 × weld) and no edge b → a. For each, the open-edge ends lying inside it are collected:

`p lies on a → b when 0 < s < 1 and |p − (a + s·(b − a))| ≤ 4 × weld`

with s the position of p along the edge. A triangle split on one edge is fanned from its corner opposite that edge; a
triangle split on more is fanned from its centre. The plate has six such corners, four on the top and two on the
bottom, at the box's corners where the y cuts met the x cuts' lines.

## 5. The tool's surfaces back

The soup becomes a facet body again. Its faces are grouped by their source token and not by angle (no crease
splitting), so a mesh face keeps its name even when it is cut. A source split into two regions names the second
`#2`, and so on. A face from the tool, or an exact face of the input, gets its exact surface back. Its orientation is
chosen by a vote of its five largest triangles: does the surface's normal there point the way the triangle faces?

The *rim*, where an exact face meets the mesh, stays a polyline whose corners lie on both. Each edge on an exact face
records how far its chords can be from the surface, doubled, as its tolerance. A chord of length L on a curve that
bends by κ (taken from three corners in a row) is at most its sagitta from it:

`sagitta = L² κ / 8`

An edge of one chord has no three corners: the distance of its midpoint from the surface is measured instead, at most
half the chord. On the plate, at the default 32 segments a quarter, the rim's tolerance is 2.108 × 10⁻³ mm, twice
3.5 (1 − cos(π/128)). Last, the result is checked strictly; an invalid result is refused with `GEOMETRY`.

The mesh part of the result is the same mesh: the path does not smooth a scanned surface or recover exact shapes from
it. Only the tool's faces are exact.

## 6. The triangle hierarchy

Five searches over triangle meshes had grown apart in the kernel and the studio: the facet classification's tree, the
mesh distance's tree, the studio's print, mould and machining tree, a uniform grid for wall rays, and a ray tested
against every triangle. D141 replaced them with one: `triangleBvh` in `mesh/triangle-bvh.ts`.

A BVH is a binary tree of boxes. Each node holds a box round some triangles; its two children split those triangles
between them; a leaf holds a few triangles. A query starts at the root and skips every node whose box shows that it
cannot matter.

<MeshBBuild />

**Building.** The tree is built once from a mesh's positions and its three vertex indices a triangle:

- each triangle's centre is the mean of its three corners;
- a node's box holds every corner of its triangles, so sibling boxes can overlap;
- a node with more than 4 triangles (`leafSize`) is split along its box's longest side, x first on a tie, then y;
- the split is at the median by centre. Quickselect, with Hoare's partition, moves the triangle that belongs at
  place ⌊count / 2⌋ into it, smaller centres before and larger after, without sorting either half. The first half
  goes to the first child and the rest to the second.

The build uses a stack of (node, start, count) triples instead of recursion. Its result is a set of flat typed arrays:
six numbers of box per node, its first child (the second is the next slot) or −1 for a leaf, and the start and
count of a leaf's run in `order`, the triangle numbers in leaf order. A tree over n triangles has at most 2n − 1 nodes,
so the arrays are sized 2n once. Positions given as a `Float64Array` and indices as a `Uint32Array` are used as they
are, without a copy. D141 measured a bumpy sphere of 100,352 triangles: the build took 62 ms, against 228 ms for the
studio's earlier tree, which sorted every node in full.

## 7. Two queries

<MeshBQuery />

**The nearest ray hit**, `rayHit(bvh, o, d, minT = 10⁻⁶, skip = −1, detTol = 10⁻¹⁴)`, returns the least t > minT with
o + t d on the mesh, or Infinity. d need not be unit: t is in d's lengths.

- **Box test.** For each axis, t = (box − o) / d at the box's two planes. lo is the largest of the entries, hi the
  smallest of the exits. A box is entered when hi ≥ max(lo, 0) and lo ≤ best; otherwise the box and everything
  under it is skipped.
- **An axis the ray does not move along** (d = 0 there) is tested by comparing o with the box. The slab form would
  compute 0 × ∞ = NaN when o lies on a box's face and drop the box. D141 found this miss in the studio's earlier
  tree: a ray straight down a 10 mm box's own face plane found nothing, where 10 was right.
- **Order.** An entered node puts both children on the stack, and the second is taken first. Nothing sorts them
  along the ray.
- **Leaf.** Each triangle is tested by Möller–Trumbore. A hit on an edge counts. A triangle whose determinant is within
  detTol of zero (the ray in its plane) is passed, and `skip` leaves out one triangle: the one a wall ray starts on.

**The nearest point**, `nearestDistance2(bvh, x, y, z, bound2 = ∞)`, returns the squared distance from the point to
the mesh's surface when it is below bound2, and bound2 otherwise.

- **Lower bound.** A box's squared distance from the point, Σ max(lo − p, 0, p − hi)² over the axes, is 0 inside the
  box. No triangle in the box can be nearer than this.
- **Prune.** A node whose box is no nearer than the best so far is skipped. Of two children, the nearer is pushed
  last, so it is searched first, and a child no nearer than the best is not pushed at all.
- **Leaf.** The exact distance to each triangle: its closest point by the triangle's Voronoi regions (corners, edges,
  inside; Ericson, *Real-Time Collision Detection* 5.1.5), `pointTriangleDistance2`.

Neither query allocates. Both share one stack, a typed array kept in the module and doubled only when it runs out.

## 8. What uses it

| User | Query | Source |
|---|---|---|
| Facet point classification: inside, outside or on a mesh body, by the parity of a ray's crossings (all of them, through its own descent of the same tree); a ray that grazes an edge or a vertex says nothing and the next of 8 fixed directions is tried; two clean rays that agree decide | its own ray descent | `mesh/facet-bvh.ts` (`classifyPointInFacets`; STEP import uses it to tell a cavity's shell) |
| Mesh distance: from each vertex and triangle centre of one mesh to the other's surface | nearest point | `mesh/mesh-distance.ts` (`meshDistance`, `meshDistanceRange`) |
| Mesh clearance: the least distance between two meshes, by a descent of both trees at once, nearest pair of boxes first | pairs of boxes | `mesh/mesh-clearance.ts` |
| Voxel depth for hollowing and lattices | nearest point | `mesh/voxel-field.ts` |
| A hole's free space above its face (rays along its axis against the body's tessellation) | ray | `part/part-model.ts` (`clearanceAbove`) |
| The studio: print orientation, mould undercuts and walls, machining access, holes and cavities, the wall analysis, a library part's thickness | ray, nearest point | `packages/barocss-cad-model/src/print/orient.ts`, `mould/`, `machining/`, `analysis/analysis.ts`, `library/libraries.ts` |

The hierarchy of a facet body is built once per B-rep and kept with it, so many classifications of one body share it.

## Where it is in the code

Paths under `packages/barocss-cad/src/`:

| File | Responsibility |
|---|---|
| `part/part-model.ts` | `boolean` (dispatch), `facetWith` (the mixed path, its refusals typed), `explodeFacets` and `FACET_EXPLODE_TRIANGLES` (the planar path) |
| `mesh/facet-boolean.ts` | `facetBoolean`: the checks, the padded box, the cuts, `planarOf`, `addTessellated`, `mendTJunctions`, `restore` (names, exact surfaces, rim tolerances); `splitMixedBrep`, `facetedCopy` |
| `mesh/facet-split.ts` | `splitSoup`: one plane's split with its caps (`capOf`); `facetSoup`; `splitFacetBrep` |
| `mesh/mesh-brep.ts` | `brepFromTriangles`: the near part as planar faces |
| `mesh/facet-brep.ts` | `facetBrepsFromTriangles`, `weldVertices`: a soup back to a facet body |
| `mesh/triangle-bvh.ts` | `triangleBvh`, `rayHit`, `nearestDistance2`, `pointTriangleDistance2`, `closestPointOnTriangle` |
| `mesh/facet-bvh.ts` | `facetBvh` (one tree per B-rep), `classifyPointInFacets` |

## How it is checked

- `packages/barocss-cad/test/facet-boolean.test.mjs`:
  - *a facet cube with a cylinder and a sphere*: a through hole, a blind hole, a boss, a sphere bite and an
    intersection, each valid, each volume within 10⁻⁹ of the closed form, relative (the bite within 1.5 × 10⁻⁵), an exact face
    in each result, the mesh faces' names kept, the rim's tolerance at most 1.01 × twice the sagitta 3 (1 − cos(π/128));
  - *holes and Booleans on a mesh of 25,600 triangles*, past the planar path's 16,000: a second hole and a split go on
    from the result, and a box minus the mesh is still refused there;
  - *refusals*: too many triangles near the tool is `CAPABILITY`, saying how many; a sheet is `GEOMETRY`;
  - a mixed body out to STEP as a mesh body and back.
- `packages/barocss-cad/test/facet-split.test.mjs`: the split's tie rule, caps with holes (a torus's annulus), open
  meshes, and cut points exactly on a plane square to an axis (PERF3 B10).
- `packages/barocss-cad/test/k2-triangle-bvh.test.mjs` (D141): every triangle in exactly one leaf, every box holding its
  triangles, leaves of at most `leafSize`, depth at most ⌈log₂(n / leaf)⌉ + 1; 1500 rays and 600 nearest points equal
  to a brute force over every triangle, exactly; axis-parallel rays on a box's face planes; facet classification and
  the mesh distance through the shared tree; 100,000 triangles built and 20,000 rays well under their time bounds.
- Conformance, `packages/barocss-cad/conformance/r6/`: `facet-cube-hole`, `facet-cube-blind-hole`, `facet-cube-boss`
  and `facet-cube-sphere-intersect`; `conformance/r3/mesh-crossing-hole-refused` and `mesh-sheet-hole-refused` for the
  refusals.

## Limits

- **Refused**, with `GEOMETRY`: an open mesh; a mesh that crosses itself (repair does not fix crossings yet); a near
  part or result that does not close; a result that fails the strict check. With `CAPABILITY`: more than 16,000 mesh
  triangles near the tool (fewer when an evaluation asks), and what the analytic Boolean does not support.
- **Only one side may have mesh faces.** Two meshes, or a native body minus a mesh, take the planar path, limited to
  16,000 triangles per mesh; a body mixing mesh and exact faces is refused there.
- **Approximate**: the rim is a polyline on the exact surface, its chord error recorded as its edges' tolerance; the
  mesh faces stay the triangles they were.
- **The hierarchy is static.** It is built once over a mesh; a changed mesh needs a new tree.

Simplifying, repairing and offsetting meshes: [Mesh processing](/how/mesh-processing).
