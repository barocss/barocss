<script setup>
import PrismSlabs from '../.vitepress/components/algorithms/PrismSlabs.vue';
import PrismRebuild from '../.vitepress/components/algorithms/PrismRebuild.vue';
</script>

# Booleans of upright extrusions

Most parts start as sketches extruded straight up: a plate, a boss on it, a pocket, a hole. Every face of such a body is
a horizontal plane, a vertical plane or a vertical cylinder. The kernel keeps these bodies in a form of their own, the
*Z-prismatic solid*, and runs their Booleans without any 3D surface intersection: it cuts both solids at the same
heights, runs a 2D Boolean on each pair of sections, and builds the B-rep from the result.

This page opens up that path, the first row of
[How the kernel chooses the algorithm](/packages/cad/robustness#how-the-kernel-chooses-the-algorithm). The 2D Boolean
itself — crossings, faces, winding numbers, selection — is explained on [Booleans of curved solids](/how/boolean#_2-splitting-a-face)
and is not repeated here. The figures use one small pair worked out by the built kernel: a 10 × 6 box A from z = 0 to 4,
and a cylinder B of radius 2 from z = 2 to 6.

## A solid as a stack of slabs

A prismatic solid (`PrismaticSolid` in `src/features/prismatic-solid.ts`) is a list of *slabs*. A slab is a height
interval z<sub>0</sub> &lt; z<sub>1</sub> and one XY *section*: a set of regions, each an outer ring with holes. Rings are
made of line segments and circular arcs and have the material on their left. A solid may also carry *cap sources*: the
authored tops and bottoms, each a height, its regions and a tag, used only to name faces.

Every operation leaves the list in one normal form (`normalize`):

- slabs with an empty section are dropped, and the rest are sorted by z<sub>0</sub>;
- a slab without finite z<sub>0</sub> &lt; z<sub>1</sub> is refused (*every slab needs finite z0 < z1*), and so are two
  slabs that overlap in Z (*slabs overlap in Z*);
- two slabs that touch (one's z<sub>1</sub> equals the next one's z<sub>0</sub>) and have equal sections become one;
- cap sources at a height that is no longer a slab bottom or top are dropped.

An extrude makes one slab. `prismaticFromProfile` builds the section as the 2D difference of the outer loop (and any
more outer loops) minus the holes, so holes may touch or cross the outer boundary. Each segment carries a tag that names
the wall it will make: `tag.side<i>` for authored segment *i*, `tag.hole<h>.side<i>` for a hole's (`tag.side[t]`
when the sketch gives its segments tags of their own). The top and bottom
become the cap sources `tag.top` and `tag.bottom`.

## Slab by slab

`booleanPrismatic(a, b, operation)` works in three moves:

1. **Levels.** Every slab bottom and top of both solids, each height once, sorted. Between two neighbouring levels
   neither solid's section changes.
2. **Sections.** For each interval, each solid's section is the one of its slab covering the whole interval, or empty.
   An interval empty in both is skipped; otherwise the two sections go through `booleanCurveRegions` with the operation
   (union, intersection or difference). The result is that interval's section.
3. **Normal form.** The intervals become slabs and go through `normalize`: empty sections drop out, and neighbours with
   equal sections merge. Two sections are equal when their 2D *xor* (the regions inside exactly one of them) is empty.

One tolerance serves every 2D Boolean of the operation, from all rings of both solids:
ε = max(10⁻⁷ mm, 10⁻¹¹ × S), where S is the largest absolute coordinate of a line's ends, or of an arc's centre plus its
radius (`curveTolerance`). Areas are exact for lines and closed-form for arcs (½∮(x dy − y dx) per segment), so the
volume Σ area × (z<sub>1</sub> − z<sub>0</sub>) needs no quadrature (`prismaticVolume`). The
[mass properties](/how/mass-properties) of an upright body come from the slabs' area moments too.

<PrismSlabs />

The merge matters for what comes next: without it a level where nothing changes would stay in the solid, and every wall
crossing it would be cut there into two faces. With **B inside A** and **A ∪ B** in the figure, B's bottom at z = 2 lies
inside A, the sections on either side are both A's rectangle, and the level disappears.

## Rebuilding the boundary

`brepFromPrismatic(solid)` turns the stack into a B-rep with curved faces and a pcurve on every coedge. It needs no
surface intersection either: walls stand on the sections' boundaries, and caps lie where the section changes.

1. **One set of points.** At each level, the section below and the section above are arranged together
   (`curveArrangementVertices`). Every vertex goes into one set of 2D points shared by all levels; a point closer than
   ε to one already there is that point, found through a grid of cells 64 ε wide. The ends of every cap ring are added.
2. **Pieces.** Every ring of every slab, and every cap ring, is split at each point of the set lying on it (within ε).
   A piece runs between two points of the set. Two pieces with the same two ends whose midpoints lie within 4 ε are one
   piece, so all faces meeting along it share one curve.
3. **Walls.** Each piece of a slab's ring, extruded over the slab, is a *cell*. Cells of one piece, running the same
   way, in slabs that touch, make one face. A line piece makes a vertical plane; an arc piece a vertical cylinder.
4. **Caps.** At each level z, the part of the section below that is not above faces up: below(z) − above(z). The part
   above that is not below faces down: above(z) − below(z). Both are 2D differences again. A cap's surface is a plane,
   bounded by its control points' box so its pcurves stay in [0, 1]².
5. **Edges and vertices.** Every edge must be used by exactly two faces, once each way. An edge used by four (two
   solids touching along a horizontal line) is split into two *wedges*, one per lump. A vertex is made per disc of faces
   around a point, so lumps touching at a point keep vertices of their own. Vertical edges that meet only each other at
   a level, because both walls continue past it, become one edge.
6. **Shells.** Faces joined through edges are one shell. Its signed volume is Σ over its caps of ± area × z (+ for an
   up cap, − for a down cap; walls add nothing). A shell with a positive volume is a body. One with zero or negative
   volume is a cavity. It goes to the smallest body (by volume) whose caps above a point inside one of the cavity's
   caps are crossed an odd number of times; a cavity in no body is refused.

<PrismRebuild />

For A ∪ B this gives 14 faces, 32 edges and 20 vertices in one shell, and V − E + F = 20 − 32 + 14 = 2. As for
any output, `checkOutput` runs the strict B-rep check on it when asked.

## How faces are named

Names come from the authored features, not from the order in which faces were made, so a fillet or a hole that refers
to `a.side1#2` still finds it after an edit that keeps the topology.

- **Walls** take the tag of the ring segment they stand on. The tag rides on the segment through every 2D Boolean, so a
  side of A cut by B keeps A's name.
- **Caps** take the tag of the cap source at their height (within ε) whose regions contain a point inside the cap. In
  the figure, the downward cap under B's overhang at z = 2 is `b.bottom`, B's authored bottom; the top of A with B's
  notch is still `a.top`. A cap no source contains is named `<id>.top` or `<id>.bottom`.
- **Repeated names.** A name used once is the face's name. A name used by *k* faces becomes `name#1` … `name#k`, ordered
  by a point of each face: for a wall, its piece's midpoint at mid-height; for a cap, its inside point. They are
  compared by x, then y, then z. The three pieces of A's side x = 10 are `a.side1#1` (y 0 to 1), `a.side1#2` (y 1 to 5,
  under the overhang) and `a.side1#3` (y 5 to 6).
- **Edges** are named by their two faces, `a.side0|a.top`, sorted; several edges between the same two faces are
  numbered the same way, by their midpoints.

The same rules, for every path, are on [Modeling API: names](/packages/cad/modeling#names) and [Names that survive edits](/how/naming).

## When the part evaluator takes this path

A part feature's body is an *upright* solid as long as every operation on it keeps it upright; its output then reports
`representation: 'upright'`. The Boolean dispatch (`boolean` in `src/part/part-model.ts`) checks the two operands in
this order:

| Operands | What runs | Result |
|---|---|---|
| One is empty | No Boolean: A ∪ ∅ = A, A ∩ ∅ = ∅, A − ∅ = A, ∅ − B = ∅ | as it was |
| Both upright | `booleanPrismatic` | upright |
| A mesh body with an exact one | The mesh near the tool through the exact Boolean | general B-rep |
| Both planar (an upright one counts when its sections are lines only) | The exact rational polyhedral Boolean | general B-rep |
| Anything else | `brepFromPrismatic` for an upright operand, then the analytic Boolean of planes, cylinders and traced curves | general B-rep |

What keeps a body upright:

- **Made upright.** An extrude without draft on a sketch plane with a vertical normal makes an upright body; on any
  other plane it is a general B-rep, and a drafted extrude has slanted walls.
- **Moved upright.** A move whose matrix does not mix Z with X or Y goes through `transformPrismatic`. It accepts a
  similarity in XY (rotation or reflection times a uniform scale; a reflection reverses each ring so the material stays
  on its left) and a nonzero Z scale, and refuses anything else. A move that mixes them, such as a rotation about X,
  turns the body into a general B-rep for good.
- **Features that stay.** A hole along Z and the shell of an upright body are made with prismatic tools, so the body
  stays upright; a fillet of a vertical edge does as well. A hole along X or Y and a chamfer on a top edge do not: their
  faces are not vertical.

Once a body has left the upright form, every later Boolean on it takes one of the other paths.

## Where it is in the code

| File | Responsibility |
|---|---|
| `packages/barocss-cad/src/features/prismatic-solid.ts` | `PrismaticSolid`, `normalize`, `prismaticFromProfile`, `transformPrismatic`, `booleanPrismatic`, `prismaticVolume`, `prismaticContains`; `brepFromPrismatic` (points, pieces, walls, caps, edges, vertices, shells) and `nameFaces` / `nameEdges` |
| `packages/barocss-cad/src/brep/curved-arrangement.ts` | `booleanCurveRegions` (the 2D Boolean, including `xor`), `curveArrangementVertices`, `curveTolerance`, `regionArea`, `regionInteriorPoint` |
| `packages/barocss-cad/src/numeric-policy.ts` | `linearToleranceMM`: 10⁻⁷ mm and 10⁻¹¹ relative |
| `packages/barocss-cad/src/brep/solid-mass.ts` | `prismaticMassProperties`: volume, centroid and inertia from the slabs' area moments |
| `packages/barocss-cad/src/part/part-model.ts` | The `Solid` kinds `upright` and `brep`; `boolean` (the dispatch above), `affine` (moves), `representation` |

## How it is checked

- `packages/barocss-cad/test/prismatic-solid.test.mjs`
  - *prismatic Booleans give valid B-reps with exact volumes, curved walls and pcurves*: a through hole, a boss, a
    counterbore, a slot pocket, a box and a cylinder cavity, an island in a cavity, a tube, an internally tangent
    crescent, a cut into two bodies, stacked equal sections that merge, boxes touching along an edge or at a point,
    tangent cylinders. Each has a closed-form volume and expected shells, faces and genus per body; each B-rep passes
    the B-rep check with its pcurves sampled, and its mesh is watertight with a volume that converges.
  - *random prismatic Booleans*: 90 seeded random pairs of boxes, cylinders and slots (some already a Boolean). For
    each, V(A ∪ B) + V(A ∩ B) = V(A) + V(B) and V(A − B) + V(A ∩ B) = V(A) within 10⁻⁸, a random point is
    inside A ∪ B exactly when it is inside A or B and inside A ∩ B exactly when it is inside both, and every result is
    a valid, watertight B-rep.
  - *line + arc Booleans* and the tangency cases found by fuzzing check the 2D Boolean under the slabs.
- `packages/barocss-cad/test/part-model.test.mjs`
  - *features evaluate on the B-rep with exact volumes*: a plate with a hole, a blind hole, a boss union, patterns,
    mirrors and moves report `upright`; a body rotated about X and then united reports `planar` (the polyhedral path).
  - *persistent names follow the authored features and survive parameter edits*: the same face and edge names after
    the width, thickness and hole position change.
- `packages/barocss-cad/test/rb.test.mjs`: a prismatic crescent (a disc tangent inside a disc) is a known state, not an
  invalid one (D195).

## Limits

- **Lines and arcs only.** A section with any other curve is refused (*prismatic sections are made of lines and arcs*).
  Splines, ellipses and slanted faces take the general paths.
- **Floating point.** Crossings of circles are irrational, so the arrangement runs in binary64 with the tolerance ε
  above; the path avoids 3D surface intersection, not rounding.
- **Exact heights.** Levels are compared exactly: two heights that differ by any amount are two levels, and slabs merge
  only where one's top is exactly the next one's bottom.
- **A body touching itself.** Where two walls of one body meet along a vertical line from outside each other (two
  discs touching, a figure eight), the solid is refused: *the solid touches itself along the vertical line*. A disc
  tangent inside a disc, the crescent, is kept as one body (D195). The test samples 16 points on a small circle round
  the line, radius max(10⁻⁴ × extent, 1000 ε).
- **Touching along a line or at a point.** Lumps that touch only along a horizontal edge or at a point stay separate
  bodies of one output (D204), through the wedge split above.
