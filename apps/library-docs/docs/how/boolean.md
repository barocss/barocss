<script setup>
import AlgoHull from '../.vitepress/components/algorithms/AlgoHull.vue';
import AlgoMarch from '../.vitepress/components/algorithms/AlgoMarch.vue';
import AlgoArrangement from '../.vitepress/components/algorithms/AlgoArrangement.vue';
import AlgoPointInRegion from '../.vitepress/components/algorithms/AlgoPointInRegion.vue';
import AlgoClassify from '../.vitepress/components/algorithms/AlgoClassify.vue';
import AlgoStitch from '../.vitepress/components/algorithms/AlgoStitch.vue';
</script>

# Booleans of curved solids

This page opens up the Boolean of two curved B-reps — the path [B-rep, robustness and refusals](/packages/cad/robustness#_3-curved-b-reps-intersect-the-surfaces-and-trim-their-face-domains)
names *intersect the surfaces and trim their face domains*. Each stage has a figure that plays its steps as you reach it.
Use **Play**/**Pause**, the arrows or a step's number to go through it at your own pace; with reduced motion turned on in
your system, each step is shown still.

The figures use small cases worked out in the page: two cylinders, a rectangle and a circle, a plate and a boss. The
methods, the formulas and the constants are the kernel's, in `packages/barocss-cad/src/`.

## The stages at a glance

| Stage | What it does | Source |
|---|---|---|
| 1. Cut | For each pair of faces that can meet, the curves where their surfaces cross | `intersect/surface-intersection.ts`, `brep/analytic-boolean.ts` |
| 2. Split | Each face's 2D domain divided by its cuts into pieces | `brep/curved-arrangement.ts` |
| 3. Classify | Each piece: inside or outside the other solid | `brep/analytic-boolean.ts` (`classify`) |
| 4. Select | Pieces kept by the operation; the tool's turned over for a difference | `brep/analytic-boolean.ts` |
| 5. Merge | Kept pieces on one plane or cylinder that touch, joined into one face | `brep/analytic-boolean.ts` (`mergePieces`) |
| 6. Stitch | Vertices, edges, loops, shells and bodies of the result, then a strict check | `brep/analytic-boolean.ts` (`stitch`) |

Every length test uses one tolerance, ε = max(10⁻⁷ mm, 10⁻¹¹ × the size of the coordinates), and multiples of it.

## 1. Where two surfaces meet

Most face pairs are dismissed before any intersection is computed. First their 3D boxes must overlap. Then, for a NURBS
face against a plane or a cylinder, the face's control net must reach the other surface: a patch can never leave the
convex hull of its control points.

<AlgoHull />

A pair that may meet is intersected. Plane/plane pairs and the supported plane/cylinder and cylinder/cylinder pairs
have closed-form curves: lines, circles, ellipses, parametrised branches. Any other pair is traced by marching: start on the curve, step along its tangent, pull back onto
both surfaces, repeat.

<AlgoMarch />

## 2. Splitting a face

Each cut curve is mapped into the 2D domain of both faces it lies on: a plane in a frame of its own, a cylinder by angle
× radius and height, a NURBS face by its scaled (u, v). The face's domain is then divided by its cuts in a 2D
*arrangement*: every curve split where it crosses another, every crossing a vertex, every closed walk a region.

The figure runs the arrangement as a 2D Boolean, which the kernel uses for prismatic bodies and to merge coplanar pieces.
Splitting a face is the same arrangement with the cuts given no material: the regions inside the face's own boundary
are its pieces.

<AlgoArrangement />

## 3. Inside or outside a region

Many steps ask whether a 2D point lies in a face's region: whether a ray's hit lands on the face, whether a sample is
inside a piece, which face a piece of a merge falls in. The answer is the parity of a ray's crossings.

<AlgoPointInRegion />

## 4. Which pieces to keep

A piece no cut passes through lies wholly inside or wholly outside the other solid, so one point of it decides. Far
faces are decided by their boxes alone; the rest by rays from a point inside them, in 3D against the other solid's
planes, cylinders and patches. The operation then chooses:

| Operation | Kept from A | Kept from B |
|---|---|---|
| A ∪ B | outside B | outside A |
| A ∩ B | inside B | inside A |
| A − B | outside B | inside A, turned over |

A piece lying on a face of the other solid (a coincident patch) is classified by whether the two face the same way or
opposite ways, so a shared patch is kept once or not at all.

<AlgoClassify />

## 5. Joining coplanar pieces

Kept pieces on one plane facing one way — or one cylinder, facing one way — are joined only where they meet. They are
grouped by their 2D boxes (padded by 10 ε, meeting directly or through others); a group of one whose rings close is kept
as it is, with its own name; a larger group goes through the 2D union above and each face it makes takes the name of the
first piece lying in it. A row of bosses on a plate keeps `c0.top`, `c1.top`, … rather than all taking the latest
boss's name (D281).

## 6. Stitching the result

The kept pieces' boundaries become one B-rep: shared vertices, shared edges, loops, shells and bodies. The result is
then checked strictly (every edge used once each way, loops closed, surfaces and curves agreeing within tolerance)
before it is returned.

<AlgoStitch />

## Numbers that must not flip

Some quantities are re-derived at every Boolean from the last result. A test that compares one with an exact constant,
or orders by it exactly, can change its answer on the last bit after a few steps. Two such tests were found by
comparing the incremental stitch with the full rebuild (D282):

| Quantity | Exact test | What happened | Now |
|---|---|---|---|
| An arc's sweep | split if \|sweep\| &gt; π | a half circle read back as −3.141592653589794 (one ulp past π) after six Booleans was split at its top: an extra vertex and edge | split if \|sweep\| &gt; π + 10⁻¹² |
| Repeated face names `f#1`, `f#2` | ordered by inside point x, then y, then z | a cylinder's two halves share one x to within 4 × 10⁻¹⁵, so `#1` and `#2` swapped from one Boolean to the next | a coordinate within 100 ε counts as equal; the next one decides |

The general rule: compare a re-derived value with the margin the code already uses for that quantity, never exactly.

## Keeping it fast

Each shortcut below skips work only where the answer is already known; the full test still runs everywhere else.

| Shortcut | What is skipped | Why the answer is the same |
|---|---|---|
| Box overlap of segments, faces and rays | intersecting two pieces whose boxes are apart | curves inside disjoint boxes cannot meet |
| Control-net hull | marching a NURBS face against a plane or cylinder it cannot reach | a patch lies in its control points' hull |
| Ring boxes in point-in-region | reading rings whose box does not hold the point | outside its box a ring adds an even number of crossings |
| Ray hit outside the region's box | locating that hit in the region | it is outside the region |
| Far uncut faces | rays for faces 1000 ε clear of the other solid | nothing of the other solid is near them |
| Lazy inside points | finding a point inside a piece nobody asks about | it is found, the same, when first asked for |
| Vertex grids | reading cells no match can be in | a point farther than 2 r from a side has no match beyond it |
| One shared cache of curve maps | recomputing a pure function of a parameter | a slot taken by another value only costs a recomputation |
| Frozen faces (D283) | rebuilding faces that came through a step unchanged | their loops are taken only where the rebuild would make the same edges |

The measurements behind these, and the methods used to check that results stayed the same, are in the handover note
`apps/cad-studio/handover/notes/report-kernel-performance-2026-10-28.md`.
