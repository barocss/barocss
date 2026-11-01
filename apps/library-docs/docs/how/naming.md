<script setup>
import NamingFeatures from '../.vitepress/components/algorithms/NamingFeatures.vue';
import NamingRounding from '../.vitepress/components/algorithms/NamingRounding.vue';
import NamingCoplanar from '../.vitepress/components/algorithms/NamingCoplanar.vue';
</script>

# Names that survive edits

A part is a list of features. Later features point at faces and edges of earlier results: a fillet names the edges it
rounds, a face fillet, a draft or a thread names faces, a face split names the face it divides. After every edit (a
radius, a position, a boss added earlier in the list) the whole list is evaluated again and every B-rep is built anew. So
a reference cannot be an id or a place in a list. It is a name worked out from the features each time, the same way.

This page shows how those names are made and how a reference is resolved. The short rules are on
[Modeling API → Names](/packages/cad/modeling#names). Use **Play**/**Pause**, the arrows or a step's number to go
through each figure.

## The rules at a glance

| What | Name | Example | Made in |
|---|---|---|---|
| A face of a feature | `<id>.<role>`: `top`, `bottom`, `side<i>` (i: the authored segment), `hole<h>.side<i>` | `p.top`, `c0.side0` | `features/prismatic-solid.ts` (`prismaticFromProfile`) |
| A wall of a tagged sketch segment | `<id>.side[<tag>]` | `ce.side[w]` | `document/side-names.ts` (`sideName`) |
| Several faces of one name | `#1`, `#2`, … by a point inside each | `p.top#1` | `nameFaces`, the Booleans' stitch |
| An edge | its two faces' names, sorted, joined by `\|` | `c0.side0#1\|p.top#1` | every builder |
| Several edges of one name | `#1`, `#2`, … by a middle point | `c0.side0#1\|c0.side0#2#1` | `nameEdges` |
| A fillet's or chamfer's surface | `<id>.face` | `f.face` | `blend/edge-finish.ts` |
| Copies | `@k` (pattern copy k), `@m` (kept mirror) | `p.top@1` | `part/part-model.ts` |

## 1. Faces and edges from features

A feature names the faces it makes from its own id and each face's role. An extrude's walls take the index of the sketch
segment they come from; a loop drawn clockwise is reversed first, and the index still counts the segments as drawn. An
edge has no role of its own: it is named by the two faces it joins.

<NamingFeatures />

## 2. Numbering a repeated name

A name can belong to several faces: a circle's wall is two half faces, a cut splits a top in two. Each Boolean first drops
the `#k` from its inputs' names (`baseName`), so pieces are always numbered afresh from the feature's name, never
`#1#2`. Faces of one name are then sorted by a key, a point of each face, by x, then y, then z:

| Builder | Key of a face | Comparison |
|---|---|---|
| Upright (prismatic) solids | a wall: its segment's middle at half height; a cap: a point inside its region | exact |
| Planar polyhedra | the mean of its outer loop's vertices | exact |
| Analytic Boolean (planes, cylinders, NURBS) | a point inside its region, mapped onto its surface | a coordinate within 100 t counts as equal |

The point inside a region (`regionInteriorPoint`) is found on lines across it at ½, 0.382, 0.618, 0.236, 0.764, … of its
height: the middle of each inside interval is a candidate, and the candidate farthest from the boundary wins.

Edges of one name, such as the two seams between a cylinder's halves, are numbered by `nameEdges` the same way. The point
is the mean of the curve's first, middle and last control points, and the comparison is exact.

## 3. The rounding trap

The analytic Boolean reads its inputs back from the last result, so a key is computed again at every step. Two keys that
are equal in exact arithmetic can then differ by an ulp or two, and an exact comparison ends up ordering them by rounding
(D282).

<NamingRounding />

t here is the analytic Boolean's tolerance, 10 × max(10⁻⁷ mm, 10⁻¹¹ × s), where s is the largest coordinate of the two
inputs (at least 1). It is 10⁻⁶ mm for any part within 10 m.

## 4. Pieces apart keep their names

After a Boolean, kept pieces on one plane (or one cylinder) facing one way may be joined into one face. Before D281 they
were all joined, and all took one name. Now only pieces that meet are joined.

A cylinder's face needs a seam, so pieces that go all the way round cannot become one face. Since D287 they are cut
at two seams half a turn apart and become two faces, the way an extruded circle's wall is two faces. Each half takes
the name of the first piece lying in it. Restoring a corner left a pipe's wall in eight pieces; now it is two, under
the pipe's own name.

<NamingCoplanar />

## 5. Through fillets and rounds

A fillet or chamfer is made as a tool body subtracted from the part. The tool's rounding surface is named `<id>.face`,
and its other faces `<id>.tool`; in the result below none of them is left. Every other face keeps its name, and so its edges keep
theirs. A radius change alters the fillet's size but no names. For a rod lying along a plate, rounded with `f` where it
meets the top, the kernel gives the same lists at r = 1, 2, 3 and 7.5:

| | |
|---|---|
| Faces (9) | `ce.bottom` `ce.side0` `ce.top` `f.face` `pe.bottom` `pe.side0` `pe.side2` `pe.top#1` `pe.top#2` |
| Some of the 21 edges | `ce.side0\|f.face`, `f.face\|pe.top#2`, `ce.side0\|pe.top#1`, `pe.side2\|pe.top#2` |

Position names (`side<i>`) change when a sketch segment is inserted or removed: every later index moves. A sketch can
give its segments tags instead (`sideTags`: letters, digits, `_` or `-`, 1 to 32 of them, unique in the sketch). The
walls are then `<id>.side[<tag>]`, and an inserted segment takes a new tag while the others keep theirs. A corner
rounded on `extrude1.side[e2]|extrude1.side[e3]` stays the same corner after a point is added to another side.

## 6. Resolving a reference

References are checked when the feature that uses them is evaluated. A reference that finds nothing is refused with a
typed error (its `code`); none is moved to a nearby face or edge.

| Reference | How it is matched | Refusal |
|---|---|---|
| A feature: `id`, or `id/k` for part k | an earlier feature's result | `REFERENCE`: `no earlier feature …`, `… is not a part`, `… is a sketch, not a solid` |
| Finishing one part | the target must be one part | `REFERENCE`: `… one part at a time (name it as id/k)` |
| Edges of a fillet or chamfer | the exact name | `SELECTION`: `no edge named …; edges: …` (the first 12) |
| Edges of sheet-metal flanges and corner reliefs | the exact name, else the two faces' base names | `SELECTION`: `… names 2 edges: …` when that matches more than one |
| Faces of a face fillet or thread | the name, or a base name meaning all its `#k` pieces | `REFERENCE`: `no face … on the target` |
| Faces of a draft, a full round, a hole's start face | the name, or the first face of that base name | `REFERENCE`: `no face … on the target` |
| The face of a `split-face` | an id, a name, or a base name meaning exactly one face | `REFERENCE`: `[NO_FACE]`, `[AMBIGUOUS] p.top names 2 faces (p.top#1, p.top#2): name one` |

A split face's pieces are `<face>#1`, `#2`, …, the pieces with the pull first for an isocline split, then by position.
The pieces can also be named in the feature (`names`); a name already used by another face is refused (`NAMES`). The
split keeps every other face's name exactly as it was (D149).

## Where it is in the code

| File | Responsibility |
|---|---|
| `packages/barocss-cad/src/features/prismatic-solid.ts` | `prismaticFromProfile` (roles, holes, regions, caps); `nameFaces` and `byPosition`; `nameEdges` |
| `packages/barocss-cad/src/document/side-names.ts` | `sideName`, `SIDE_TAG`: positional and tagged wall names |
| `packages/barocss-cad/src/brep/curved-arrangement.ts` | `halves` (an arc over π + 10⁻¹² is split in two); `regionInteriorPoint` |
| `packages/barocss-cad/src/brep/analytic-boolean.ts` | `stitchWith` (face names by `keyOrder`, edge names); `keyOrder`; `mergePieces` and `clustersOf` (D281); `splitFace` (D149) |
| `packages/barocss-cad/src/brep/polyhedral-boolean.ts` | `baseName`; face names by loop centre; edge names |
| `packages/barocss-cad/src/blend/edge-finish.ts` | the tool's `<id>.face` and `<id>.tool` |
| `packages/barocss-cad/src/part/part-model.ts` | references (`ref`, `solids`), `edgeNamed`, face lookups, `@k` and `@m` copies |
| `packages/barocss-cad/src/part/part-finish.ts` | fillet and chamfer features: their edge list and target checks, and `finishEdges` |

## How it is checked

- `packages/barocss-cad/test/boolean-boss-row.test.mjs`: eight bosses on a rounded plate. Each adds 6 edges and 4
  vertices, and `c0.side0#1` is the same half after every Boolean. It fails on the build before D282.
- `packages/barocss-cad/test/r10-1.test.mjs` ("R10.1 names"): the fillet face is `f.face`, and every face and edge name
  is the same at radii 1, 2, 3 and 7.5. A tagged rod keeps `ce.side[w]` through the fillet.
- `packages/barocss-cad/test/api-stability.test.mjs`: a vertex inserted upstream with the side tags kept rounds the same
  edge. An edit that takes the named edges away is refused, typed, and never moved to another edge.
- `packages/barocss-cad/test/d149-split-face.test.mjs`: split pieces `b.top#1`, `b.top#2` or the given names, every
  other face's name kept, and the refusals mapped to the document's codes.
- `packages/barocss-cad/test/part-model.test.mjs`: names through the part model's features.

## Limits

- A name is as stable as the topology. An edit that adds a split renames the pieces (`p.top` becomes `p.top#1` and
  `p.top#2`), and with them their edges: a fillet on `c0.side0#1|p.top`, written before a groove was cut across the
  top, is refused afterwards (`no edge named c0.side0#1|p.top`).
- `#k` follows position, not history. When pieces move past each other along x, their numbers swap.
- Only the analytic Boolean orders with a margin. The prismatic and polyhedral builders and `nameEdges` compare exactly.
  Their keys are computed from the authored geometry each time rather than read back from the last result.
- When coplanar pieces that meet are joined, the face takes the name of the first piece lying in it, in the Boolean's
  order of pieces. The kernel gives `k.top` for a plate's top and a block's top joined in `r ∪ k`, and `p.top` in `k ∪ r`.
