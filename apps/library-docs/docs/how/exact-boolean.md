<script setup>
import ExactOrient from '../.vitepress/components/algorithms/ExactOrient.vue';
import ExactCut from '../.vitepress/components/algorithms/ExactCut.vue';
import ExactRational from '../.vitepress/components/algorithms/ExactRational.vue';
</script>

# Exact arithmetic for planar solids

When both bodies of a Boolean have only planar faces and straight edges, the kernel uses the polyhedral path of
[B-rep, robustness and refusals](/packages/cad/robustness#_2-planar-polyhedra-split-classify-and-stitch-with-rational-arithmetic):
`booleanPolyhedra` in `packages/barocss-cad/src/brep/polyhedral-boolean.ts`. A turned box, a frame of sharp tubes on
oblique lines or a planar chamfer's wedge goes this way (two upright prisms take the prismatic path first). This page shows
how the polyhedral path computes. The decisions that shape the result are made on exact fractions. Binary64 numbers
(JavaScript's ordinary 64-bit floating point) serve quick tests that skip work when the answer is already certain, and a
few choices named below.

The figures run small cases in the page with the kernel's own steps, copied from its sources. Where the built kernel
exposes the result (the signs, the pieces a Boolean keeps, the refusals), it was run on the same case and agrees.

## The stages at a glance

| Stage | What is exact | Source |
|---|---|---|
| 1. Read the inputs | Every corner coordinate as an integer over a power of two | `core/dyadic.ts` `binary64Dyadic`, `qf` |
| 2. Planes | Each face's normal in integers; a face whose corners are not on one plane is refused | `newellNormal`, `facesOf` |
| 3. Cut | The line of two planes, the parts of it inside both faces | `cutPair`, `intervals`, `overlap` |
| 4. Split | Each face divided by its cuts in its own plane | `brep/planar-arrangement.ts` `arrangementRegions` |
| 5. Classify | One interior point of each piece: inside, outside, or on a face of the other solid | `classify`, `pointInFace` |
| 6. Stitch | Equal points merged, T-junctions split, shells and cavities | `stitch` |
| 7. Back to numbers | Each coordinate converted once, at the end | `vnum` |

## Why a sign must be exact

Almost every decision in the Boolean is the sign of a small determinant. *Orientation* is the basic one: given points a,
b and c in a plane, is a to the left of the line from b to c, to the right, or on it? Two edges cross when each one's
ends lie on opposite sides of the other; a point is on an edge when its orientation is zero.

In binary64 this sign can be wrong when the three points are almost on one line. The subtractions in the formula round
first, and the small true value is lost under the rounding of the products. The figure runs the test on 1 024
neighbouring doubles near a line.

<ExactOrient />

A wrong sign is worse than an imprecise number. Two tests asked about the same three points can disagree: one finds that
two edges cross, the other that a point is not on either edge. The pieces built from those answers then do not fit
together. With exact signs every test agrees with every other.

## Numbers as fractions

A binary64 number is an integer times a power of two. `binary64Dyadic` reads its bits and returns that pair, with the
power as small as possible (`core/dyadic.ts`):

- a coordinate v becomes m / 2<sup>k</sup>, with m a `BigInt` and k ≥ 0;
- in the polyhedral Boolean a value is a fraction `{ n, d }` of two `BigInt`s, the denominator kept positive and the pair
  reduced by its greatest common divisor (`q` in `polyhedral-boolean.ts`);
- in the planar arrangement a point is three integers (x, y, w) with w > 0, standing for (x/w, y/w), likewise reduced
  (`planar-arrangement.ts`).

Nothing is rounded between reading the inputs and writing the result. The exactness is that of the input doubles: a
corner that was already rounded before the Boolean stays rounded (as the robustness page says).

### A plane in integers

A face's plane is n · x = d. The normal n is the Newell sum over the face's outer ring, computed after scaling every
coordinate of the face by the largest power of two among their denominators, so every term is an integer. The three
components are then divided by their greatest common divisor, and d is n times the first corner.

The same pass checks that every corner of every ring of the face satisfies n · x = d exactly. One that does not makes the
face *bent*: the Boolean stops with `GEOMETRY` and the reason `NOT_PLANAR_WITHIN_FLOAT` (see the last section). A face
whose Newell sum is zero has no area and is refused with `GEOMETRY`. An edge that is not a straight line is refused with
`GEOMETRY` ("is not straight") before any of this.

## Cutting two faces

For each face of A and each face of B whose boxes meet, `cutPair` finds the segments where the two faces cross. If the
normals are parallel (their cross product is zero), the faces either lie apart, and nothing happens, or on one plane, and
then each face's edges become cuts of the other. Otherwise:

1. The planes meet in the line P<sub>0</sub> + t D, with D = n<sub>A</sub> × n<sub>B</sub> and P<sub>0</sub> the point of
   the line with D · P<sub>0</sub> = 0, found by Cramer's rule.
2. For each face, `intervals` walks its edges in the face's 2D frame (next section). An edge whose two ends lie on
   opposite sides of the line gives the t where it crosses. The rule is half-open (one end strictly to the left, the
   other not), so a corner lying on the line is counted once.
3. The sorted crossings, taken in pairs, are the line's intervals inside the face. `overlap` intersects A's intervals
   with B's; each overlap is a cut segment, added to both faces.

<ExactCut />

## Splitting a face in its own plane

A face is split in 2D. Its frame drops the coordinate in which its normal is largest and keeps the other two, swapped
when that component is negative, so the face's rings keep their turning sense (`axis`, `i`, `j` in `facesOf`). A 2D point
is lifted back exactly by solving the plane equation for the dropped coordinate (`lift`).

The face's rings and its cuts go to `arrangementRegions` in `planar-arrangement.ts`, the exact planar arrangement that
[Booleans of curved solids](/how/boolean#_2-splitting-a-face) shows running:

- every pair of segments is intersected exactly, by four orientations: a proper crossing gets its point from homogeneous
  cross products (the line through two points, then the point of two lines), and an end lying on the other segment
  splits it there;
- segments are split at those points, and overlapping parts become one edge;
- around each vertex the edges are sorted by exact angle (half-plane first, then the sign of a cross product), and the
  faces are traced;
- the inside of each ring is found by propagating windings from the unbounded face. The cuts belong to no polygon
  (index −1): they divide regions without changing any winding.

Every region inside the face's outer ring is a piece. The piece is triangulated (`triangulatePolygonWithHoles`), and the
centroid of its largest triangle (largest by binary64 area) is computed in exact fractions and lifted onto the plane:
a point strictly inside the piece. A region with no triangles, a sliver where cuts meet at a corner, makes no face.

## Inside or outside, exactly

No cut crosses a piece, so one interior point decides the whole piece. `classify` takes that point p against every face
of the other solid:

1. **On a face.** If p lies exactly on the plane of a face g, and strictly inside it (`pointInFace` returns 1), the piece
   is coincident with g: *same* if their normals point the same way (n<sub>g</sub> · n &gt; 0), *opposite* otherwise.
2. **A ray.** Otherwise a ray goes out from p in a fixed direction, and its crossings are counted. For each face, the
   crossing parameter t = (d − n · p) / (n · r) is exact (for the faces the binary64 shortcuts below leave open); only
   t &gt; 0 counts, and the hit point is tested with the
   exact `pointInFace` (on an edge, inside by the parity of crossings in the face's frame, or outside). An odd count is
   inside.
3. **A degenerate ray.** If the ray lies in a face's plane, or hits a face exactly on its boundary, the count is
   abandoned and the next direction is tried. There are five directions:
   (0.5773, 0.3419, 0.7413), (−0.2183, 0.8817, 0.4127), (0.6631, −0.5279, 0.3011), (−0.4421, −0.3137, 0.8401) and
   (0.1931, 0.7349, −0.6503), each read as its exact binary64 value. If all five are degenerate the Boolean stops with
   `GEOMETRY` ("every classification ray was degenerate").

The pieces kept:

| Operation | Pieces of A kept | Pieces of B kept |
|---|---|---|
| A ∪ B | outside B, or *same* | outside A |
| A ∩ B | inside B, or *same* | inside A |
| A − B | outside B, or *opposite* | inside A, turned over |

A coincident patch facing the same way is kept once (A's copy) by a union or an intersection; facing opposite ways, a
difference keeps A's copy and a union keeps neither.

## Keeping the fractions small

Exact arithmetic has a cost: every multiplication adds the sizes of its factors. The kernel reduces every value it keeps
and skips the reduction for values it only compares. The figure measures one real cut, between a box and a box turned
30° about z.

<ExactRational />

The rules in `polyhedral-boolean.ts`:

- `add`, `sub`, `mul` and `div` end in `q`, which divides the pair by its gcd and makes the denominator positive. Every
  stored value (normals, offsets, P<sub>0</sub>, interval ends, cut points, interior points) goes through them.
- `cmp(a, b)` is the sign of nₐ d<sub>b</sub> − n<sub>b</sub> dₐ, computed as two products and a comparison: with
  positive denominators it orders a and b exactly. `sgn` reads the numerator's sign.
- `radd`, `rsub`, `rmul` and `rdiv` are the same operations without the gcd, the denominator still kept positive. They
  serve values that are only signed or compared, then dropped: which side of the line a corner is on (`intervals`),
  whether a point is on an edge, and where an edge crosses a horizontal line through the point (`pointInFace`).

Before commit `0457891e8` (P1.2), `cmp` subtracted and reduced the difference just to read its sign, and those one-shot
values were reduced too. The change left every result bit-identical (a hash of every result compared on the P1 benchmark) and
took the cad-model drawing and manufacturing test from 16.2 s to 6.7 s.

## Binary64 in front of the exact tests

Exact tests on `BigInt`s are slow, so cheap binary64 tests run first. Each one decides only when its answer cannot be
changed by rounding, with a margin far larger than the rounding error; every close case goes on to the exact test.

| Where | Binary64 shortcut | Left to the exact test |
|---|---|---|
| Face pairs (`near`) | B's faces sorted by lowest x; pairs whose boxes are apart by more than 10⁻⁹ (1 + \|x\|) skipped | every pair whose boxes meet |
| Segment pairs in the arrangement | the same box test, margin 10⁻⁹ (1 + \|x\|) | every pair whose boxes meet |
| Coincidence in `classify` | faces whose plane is farther from p than the slack 10⁻⁹ (\|n\| max(reach, \|p\|) + \|d\|) skipped | p within the slack of the plane |
| Ray against a face (`crossing`) | a hit clearly behind p, or outside the face's box, or inside or outside the face by more than m = 10⁻⁷ (1 + t) max(\|p\|, reach) from every edge, decided in binary64 | a ray nearly in the plane (\|n · r\| &lt; 10⁻⁶ \|n\|), p within the slack of the plane, or a hit within m of an edge |
| T-junctions in `stitch` | vertices sorted by x; only those in an edge's box (margin 10⁻⁹ (1 + \|p\| + \|r\|)) and not clearly off its line (`offLine`, 10⁻⁹ × size²) are tested | the remaining candidates: exactly collinear and strictly between the ends |

## Stitching and the stored result

The kept pieces become one B-rep (`stitch`):

- Points are merged by their exact fractions (the key is the text of n/d for each coordinate), so two pieces meet at
  exactly the same vertex or not at all.
- An edge with another piece's vertex strictly inside it, exactly collinear, is split there (a T-junction).
- Edges are matched by their two vertices; faces sharing edges form shells. Each shell's signed volume is summed in
  binary64 (one of the few binary64 choices): positive shells are outer, the others cavities, each placed in the smallest outer shell that `classify`
  finds one of its vertices inside.
- The result is checked with `checkBrep`. Solids that touch only along an edge or at a vertex give a non-manifold result,
  refused with `TOPOLOGY` ("the result is not a manifold solid").

Only now does each coordinate become a number again: `vnum` takes Number(n) / Number(d). A coordinate equal to an input
double comes back unchanged (its reduced numerator has at most 53 bits and its denominator is a power of two). A new
point, where a cut met an edge, is rounded once to binary64, and the next Boolean reads that rounded value. Each face's
plane is stored as a planar patch built from these numbers (`planeSurface`). The pieces of one face stay separate faces:
the header of `polyhedral-boolean.ts` records that coplanar pieces are not merged yet.

## When a face is planar only to binary64

Exact planarity is easy to lose. A box turned about z keeps exactly planar faces: z is not touched, and each side has
two corners straight above two others. Turned about two axes, its corners are rounded independently, and four of them no
longer lie on one plane. Measured on the built kernel, a box [−4, 4]³ turned 30° about z and then 36° about x has five of
its six faces off: the fourth corner of each lies 1.2 × 10⁻¹⁶ to 7.2 × 10⁻¹⁶ mm from the plane of the other three.
`booleanPolyhedra` refuses such a body with `NOT_PLANAR_WITHIN_FLOAT`.

The part model does not stop there (`planarBoolean` in `src/part/part-model.ts`, D125):

1. `boolean` sends a pair to `planarBoolean` when both bodies are planar B-reps: every face a flat 2 × 2 patch, every
   edge a straight line (`planarBrep`). Two upright prisms and faceted meshes are handled before this test. The planar
   chamfer's wedge goes the same way when neither of its ends lies on an end face's plane (`wedgeChamfer`, D98).
2. `planarBoolean` calls `booleanPolyhedra`. If it throws a `BrepError` whose reason is `NOT_PLANAR_WITHIN_FLOAT`, and
   only then, the pair goes to `booleanAnalytic`, which works on the planes in binary64 with tolerances
   ([Booleans of curved solids](/how/boolean)). Every other refusal passes through unchanged.

The doubly turned box above, united with or subtracted from an axis-aligned box, is refused by the polyhedral path and
gives a valid result through the analytic one. The dispatch reads the reason, not the message (D126).

## Two orientation modules the Boolean does not use

`src/exact-proof/` holds two orientation predicates with the idea of the first figure. Neither is called by the
polyhedral Boolean, which has its own exact predicates above.

| Module | What it returns | Used by |
|---|---|---|
| `robust-orientation-v1.ts` `orient2dQualified` | The exact sign in `BigInt` when all six coordinates are safe integers; otherwise the binary64 determinant's sign only if its magnitude exceeds a bound of 32 ε times the terms' size (plus any uncertainty the caller declares), else `indeterminate`. Coordinates beyond 10 000 mm by default are refused | no source module; its own test |
| `exact-binary64-orientation-v1.ts` `orient2dExactBinary64V1` | The exact sign of the six doubles: each read as an integer times a power of two, all shifted to the smallest exponent, the determinant in `BigInt`. Coordinates up to 10 000 mm | the exact-proof segment modules (`exact-segment-crossing-v1.ts`, `exact-collinear-segment-overlap-v1.ts`, `native-planar-loop-qualification-v1.ts`) |

On the first figure's 1 024 points, `orient2dExactBinary64V1` gives the same signs as the arrangement's `orient`, and
`orient2dQualified` answers `indeterminate` (within its error bound) for all of them: it never gives a wrong sign there,
and never a sign at all.

## Where it is in the code

| File | Responsibility |
|---|---|
| `packages/barocss-cad/src/core/dyadic.ts` | `binary64Dyadic`: a double as m / 2<sup>k</sup>, exactly |
| `packages/barocss-cad/src/brep/polyhedral-boolean.ts` | `booleanPolyhedra`; fractions (`q`, `cmp`, raw ops); `newellNormal`, `facesOf`; `cutPair`, `intervals`, `overlap`; `classify`, `pointInFace`, `crossing`; `stitch` |
| `packages/barocss-cad/src/brep/planar-arrangement.ts` | Homogeneous integer points, `orient`, segment intersection, the arrangement and its windings; `arrangementRegions` for face splitting |
| `packages/barocss-cad/src/brep/brep-tessellate.ts` | `triangulatePolygonWithHoles`, for each piece's interior point |
| `packages/barocss-cad/src/part/part-model.ts` | `boolean` (dispatch), `planarBrep`, `planarBoolean` (the `NOT_PLANAR_WITHIN_FLOAT` retry), `wedgeChamfer` |
| `packages/barocss-cad/src/exact-proof/robust-orientation-v1.ts`, `exact-binary64-orientation-v1.ts` | The two separate orientation predicates |

## How it is checked

- `packages/barocss-cad/test/polyhedral-boolean.test.mjs`:
  - boxes overlapping, stacked, with a through hole, a cavity, identical, touching on part of a face and notched: volumes
    to 10⁻⁹, body counts, genus and shell counts;
  - 120 pairs of seeded random tetrahedra: every result valid, volume(A ∪ B) + volume(A ∩ B) = volume(A) + volume(B),
    volume(A − B) + volume(A ∩ B) = volume(A), and 30 random points per pair classified against each result by an
    independent ray test;
  - an L-shaped prism minus a tilted tetrahedron, and a plate with a hole united with a bar (the hole stays open,
    genus 1);
  - curved inputs refused ("not straight"); boxes touching along an edge or at a corner refused as non-manifold for a
    union, while intersection and difference of the same pairs succeed;
  - the general path matches the special orthogonal-cell union and convex intersection.
- `packages/barocss-cad/test/planar-arrangement.test.mjs`: touching, shared edges, T-junctions and identical inputs as
  ordinary cases; 300 seeded random star polygons, half on an integer grid, with area identities and point classification
  for union, intersection, difference and xor; prism Booleans as valid B-reps.
- `packages/barocss-cad/test/fr-3b.test.mjs`: two sharp tubes on oblique lines are refused by `booleanPolyhedra` with
  the reason `NOT_PLANAR_WITHIN_FLOAT`, and the same pair unites through the part.
- `packages/barocss-cad/test/fr-3a.test.mjs`: a sharp tube split on a 120° corner and two mitred tubes united through the
  part's features, refused "not planar" before the retry existed.
- `packages/barocss-cad/test/exact-binary64-orientation-v1.test.mjs` and `robust-orientation-v1.test.mjs`: the two
  separate predicates, against independent integer determinants.

## Limits

- Only planar faces bounded by straight edges. A curved edge is refused (`GEOMETRY`, "not straight"); through the part
  model such pairs go to the analytic Boolean instead.
- A face whose corners are coplanar only within binary64 is refused with `NOT_PLANAR_WITHIN_FLOAT`. Through the part model
  the analytic Boolean takes the pair; a direct caller of `booleanPolyhedra` gets the error.
- Inputs touching only along an edge or at a vertex give a non-manifold union, refused with `TOPOLOGY`.
- If all five ray directions are degenerate for one piece, the Boolean stops with `GEOMETRY`.
- Exact is exact for the input doubles. It does not undo rounding that happened before (in a rotation, say), and new
  points are rounded once when the result is stored.
- Pieces of one face stay separate faces in the result; coplanar pieces are not merged.
- Cost grows with the size of the fractions and with the number of segment pairs in each face's arrangement (every pair
  whose boxes meet is intersected exactly).
