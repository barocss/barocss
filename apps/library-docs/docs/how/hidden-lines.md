<script setup>
import HlrCurves from '../.vitepress/components/algorithms/HlrCurves.vue';
import HlrSilhouette from '../.vitepress/components/algorithms/HlrSilhouette.vue';
import HlrVisibility from '../.vitepress/components/algorithms/HlrVisibility.vue';
</script>

# Hidden lines for drawings

A drawing view shows a part as lines: its edges and its outline, solid where they can be seen and dashed where
something stands in front of them. `projectBrepHiddenLines(breps, view, options)` makes such a view from one or more
B-reps. The view is orthographic: every point moves straight toward the viewer, along one direction. The result is a
list of exact 2D curves (lines, elliptic arcs and polylines), each split into visible and hidden pieces, and each named
after the edge or face it comes from.

The [Drawings](/studio/drawings) tab draws its front, top, right and isometric views this way, and sections and detail
views start from the same projection. The method is in `packages/barocss-cad/src/brep/brep-hidden-line.ts`. The figures
use a box with a round boss on top; their numbers come from the built kernel, or are worked out in the page where a
figure says so.

## The stages at a glance

| Stage | What it does | Where |
|---|---|---|
| 1. Candidates | Every edge but seams, coplanar and smooth joints; lines and circles projected exactly | the edge loop in `projectBrepHiddenLines`, `arcOut` |
| 2. Silhouettes | Where a curved face's normal turns square to the view, from the tessellation's vertex normals | the silhouette pass, `chainSegments`, `simplify` |
| 3. Occluders | Every face's triangles, in view coordinates, in a uniform grid | `triangleGrid` |
| 4. Visibility | Each curve sampled, each sample tested, the changes bisected into runs | `intervals`, `triangleGrid.covers` |
| 5. Precedence | Hidden runs lying on visible lines dropped; silhouettes along visible edges dropped | `segmentGrid`, the run passes |
| 6. Output | Edges with their pieces, names and 3D ends; the drawing's extent | the end of `projectBrepHiddenLines` |

The view is given by two directions: `toward`, from the model to the viewer, and `up`, the direction shown upwards (it
need not be square to `toward`). Most tolerances scale with *size*, the diagonal of the box around every triangle of the
B-reps.

## 1. Which curves are drawn

Each edge of the B-rep is a candidate, except:

- a **seam**, an edge whose two sides belong to one face (where a closed surface meets itself);
- an edge between two **coplanar** planar faces: |n₁·n₂| &gt; 1 − 10⁻⁹ and the planes less than 10⁻⁶ × size apart;
- a **smooth joint**: the two faces' normals at the edge's middle agree, to within 1° when both faces are planes or
  cylinders, and within 1.5 facet turns (1.5 × 90° / 12 by default) for normals read from the tessellation. Such a joint
  is drawn only where it lies on the outline (the normal square to the view, |n·toward| &lt; 10⁻⁶): it is then a
  silhouette, named `<edge>~sil`. With `tangentEdges` the other smooth joints between different surfaces (a fillet's
  boundaries) are drawn too, marked `tangent`.
- Between two facets of a mesh solid (an STL, a modelled thread) the joint counts as smooth within 20°; it is drawn
  only where one facet faces the viewer and the other faces away.

The curves are then projected. A point p goes to (p·right, p·up), with right = unit(up × toward) and the drawn up
recomputed as toward × right. Projection is linear, so a straight edge stays the straight line between its ends'
images, and a circular arc stays an exact curve:

| 3D curve | 2D curve | Exceptions |
|---|---|---|
| Line from A to B | `line` from P(A) to P(B) | image shorter than 10⁻⁹ × size (seen end-on): left out |
| Circle c + r(e₁ cos t + e₂ sin t) | `arc`: P(c) + U cos t + V sin t, U = r P(e₁), V = r P(e₂), from t₀ to t₁ | \|U × V\| ≤ 10⁻⁹ × max(\|U\|, \|V\|)²: seen edge-on, the `line` it covers |
| Any other edge | `polyline` through the tessellation's samples of the edge | — |

The arc is an ellipse unless U and V are square and equal, which is when the circle faces the viewer.

<HlrCurves />

## 2. Silhouettes

A curved face also has an outline that is no edge of the B-rep: where the surface turns away from the viewer, its normal
square to the view direction. The kernel finds it on the tessellation (`segmentsPerQuarter`, default 12 — see
[Tessellating a B-rep](/how/tessellation)), face by face:

1. At each vertex of the face's triangles, s = n·toward / |n|; a value within 10⁻⁹ of zero is zero.
2. A triangle with one or two corners where s &lt; 0 is crossed by the silhouette. On each of its two sides that change
   sign, the crossing is at the zero of s taken as linear: p = pᵢ + (pⱼ − pᵢ) sᵢ / (sᵢ − sⱼ). Each side's two ends are
   put in one order (by position) first, so the two triangles sharing a side compute the same point.
3. The short segments are chained end to end (ends within 10⁻⁷ × size join), repeated and collinear points are dropped,
   and the chains are sorted by their middle point's place in the view. A face's chains are named `<face>~sil0`,
   `~sil1`, ….

On a **cylinder** the vertex normals are used as the face's tessellation gives them, and each chain's points are moved onto the exact generator
line c + a t ± r w, with w = unit(a × toward). The chain then has two points: an exact `line`. A cylinder seen along its
axis (|a × toward| &lt; 10⁻⁶) has no silhouette. Planar faces have none.

On **other surfaces** (spheres, tori, fillets, NURBS patches) a vertex's normal is first replaced by the sum of the normals of
every vertex at the same point (on this face or a neighbouring one) that turns from it by at most 3 facet turns
(3 × 90° / 12 = 22.5° by default). A
silhouette crossing from one face to the next then meets itself at the shared edge. The result stays a polyline through
the crossings. The groups of vertices at one point are found once per B-rep, keyed by their exact coordinates.

<HlrSilhouette />

## 3. Visible or hidden

**What hides a point.** The occluders are every face's triangles, at the same tessellation, in view coordinates: x, y
and a depth d = p·toward, larger nearer the viewer. Triangles seen edge-on (the cross product of two projected sides
≤ 10⁻¹² × size²) cover nothing and are left out. The rest go in a uniform grid of G × G cells over the view, G = round(√(n / 2)) kept between
4 and 128 for n triangles. A point p of a curve is hidden when some triangle in its cell covers P(p) (barycentric
coordinates all ≥ −10⁻⁷) and the triangle's depth there, interpolated from its corners, is greater than p·toward + ε.
This is a ray from p toward the viewer meeting a face: in the view the ray is one point, so the test is a point in a
triangle and a depth comparison. ε is 10⁻⁵ × size.

Two exceptions keep a curve from being hidden by the facets it lies on. An arc is tested where the tessellation draws
it, on its chord, not on the exact circle. A silhouette is not hidden by its own face's triangles close to it: on a
cylinder, those less than 4 × the face's sag (plus ε) nearer; on other surfaces, those whose centre is within 2.5 ×
the face's longest facet side. A face's sag is the most its facets stand off the surface, estimated per facet side as
length × normal turn / 8.

**Where the answer changes.** Each curve is sampled about every h = size / 300 along its image (a line: ⌈L / h⌉
steps; an arc: also at least one step per π/32 of its turn; at most 4000 steps). Between two samples whose answers
differ, the change is found by bisection, at most 30 halvings or until the interval is 10⁻¹² of the parameter wide.
The cuts divide the curve into runs. A run shorter than 2 × 10⁻³ × size in the view is joined to its neighbour; it is
numerical noise at a tangency.

**Visible lines take precedence.** The passes run in an order. Visible runs of edges come first; then the silhouettes'
visible runs, less any part lying on a visible edge; last, the hidden runs, less any part lying on visible ink. "On ink"
means within 10⁻⁵ × size of a visible piece running the same way, to within 5°; a curve that merely crosses a visible
one keeps its piece there. An edge all of whose runs are dropped comes back with no pieces: in a front view, the back
edges of a box lie behind the front ones.

<HlrVisibility />

## 4. What comes out

| Field | What it holds |
|---|---|
| `right`, `up`, `toward` | The view's unit vectors; a 2D point (x, y) is x·right + y·up in the model |
| `edges[].name` | The edge's persistent name (`n1.side0\|n1.top`), or `<face>~sil<k>` for a face's silhouette, `<edge>~sil` for a joint on the outline; `prefixes[i]` goes before each name of the i-th B-rep |
| `edges[].kind` | `line`, `circle`, `curve` or `silhouette`; `tangent: true` for a smooth joint drawn with `tangentEdges` |
| `edges[].ends` | Its 3D end points (none for a whole circle) |
| `edges[].circle` | A circular edge's centre, radius, normal, whether it is whole, and its sweep |
| `edges[].pieces` | `{ curve, visible }`: the curve a `line`, `arc` (centre, u, v, t₀, t₁) or `polyline` |
| `min`, `max` | The box around every piece in the view |

The back top edge of the figure's box, for instance, comes back as three lines:

```json
{ "name": "b.side2|b.top", "kind": "line", "ends": [[40, 30, 10], [0, 30, 10]],
  "pieces": [
    { "visible": true,  "curve": { "kind": "line", "a": [49.497, 4.082],  "b": [32.749, 13.752] } },
    { "visible": false, "curve": { "kind": "line", "a": [32.749, 13.752], "b": [21.629, 20.172] } },
    { "visible": true,  "curve": { "kind": "line", "a": [21.629, 20.172], "b": [21.213, 20.412] } } ] }
```

## Keeping it fast

| Shortcut | What is skipped | Why the answer is the same |
|---|---|---|
| One tessellation per B-rep and quality | tessellating the part again for each of a drawing's views | the mesh depends only on the B-rep and `segmentsPerQuarter` |
| Face geometry read once per face | recognising a face's plane or cylinder at every view | it depends only on the face |
| Triangle grid | testing a sample against triangles in other cells | a triangle outside a cell does not cover a point in it |
| Segment grid for visible ink | comparing a run with far visible pieces | only pieces within the cover distance count |
| Vertex groups found once | regrouping a face's vertices by position while averaging normals | the groups are the same for every vertex; a copy per insert made it O(k²) (commit `29c323346`, projection −11 %) |

The bench case `hidden-lines-tee` in `packages/barocss-cad/scripts/perf-bench.mjs` projects a filleted pipe tee; the
kernel performance report (`apps/cad-studio/handover/notes/report-kernel-performance-2026-10-28.md`) lists "hidden
lines of a filleted tee" at 2.14 s before and 1.26 s after that round of changes.

## Where it is in the code

| File | Responsibility |
|---|---|
| `packages/barocss-cad/src/brep/brep-hidden-line.ts` | `projectBrepHiddenLines`: candidates, silhouettes, occluders, runs, output; `arcOut`, `intervals`, `chainSegments`, `simplify`, `triangleGrid`, `segmentGrid`, `sameSurface` |
| `packages/barocss-cad/src/brep/brep-tessellate.ts` | `tessellateBrep` (the triangles, vertex normals and edge polylines), `circleOf` (an edge's exact circle) |
| `packages/barocss-cad/src/brep/analytic-boolean.ts` | `faceGeometry`: a face's plane or cylinder |
| `packages/barocss-cad-model/src/drawing/project.ts` | `projectViews`: the drawing's standard views of the part |
| `packages/barocss-cad-model/src/drawing/section.ts` | Section views, projected from the cut part |

## How it is checked

`packages/barocss-cad/test/brep-hidden-line.test.mjs` runs the built kernel on small parts:

- a plate with a through hole in the front view: the outline visible, the hole as two exact hidden lines, the back
  edges and rims dropped on the outline;
- the top view: the hole as an exact circle of radius 4 at its centre, and the persistent edge names with their 3D ends;
- a cylinder seen at an angle: two exact silhouette generators the full height, and its base turning hidden at ±45°
  from the X axis, where the silhouettes meet it (to within 10⁻⁴ rad);
- through a wide hole, the far rim of its bottom visible exactly where the sight line clears the top (to 0.01 rad);
- a cylinder seen along its axis has no silhouette; side on, its rims are lines;
- a torus seen along its axis: both silhouette circles visible, on the inner and outer equators to 0.05 mm;
- one body hiding another behind it; prefixes telling copies apart; tangent edges on request; and the refusal of an
  `up` along `toward`.

In `packages/barocss-cad-model/test/`, `drawing-detail.test.ts` checks a detail view's hidden line of a hole at 5:1 and
`drawing-section-kinds.test.ts` the visible and hidden walls of a half section.

## Limits

- **Orthographic only.** There is no perspective view.
- **Visibility comes from the tessellation.** Cuts are exact where the occluding outline is a silhouette or an edge the
  facets meet, and otherwise within a facet's sag: in the figure the exact cut is at x = 21.626, the kernel's at 21.629,
  because the boss's top rim facets sit just inside the circle. A finer `segmentsPerQuarter` narrows it.
- **Only lines and circles are exact.** Other edges and the silhouettes of non-cylindrical faces are polylines through
  the tessellation's points.
- **Changes between samples.** Visibility is compared from one sample to the next, so a hidden or visible stretch
  shorter than the sample spacing h can be missed, and one shorter than 2 × 10⁻³ × size is joined to its neighbour.
- **Refused.** An `up` parallel to `toward` (|unit(up × toward)| &lt; 0.5) throws *The view up direction is parallel to
  the view direction.*
