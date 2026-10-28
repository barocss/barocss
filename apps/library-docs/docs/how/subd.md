<script setup>
import SubdCurve from '../.vitepress/components/algorithms/SubdCurve.vue';
import SubdSurface from '../.vitepress/components/algorithms/SubdSurface.vue';
import SubdPhantom from '../.vitepress/components/algorithms/SubdPhantom.vue';
</script>

# Subdivision surfaces as exact B-splines

A subdivision (SubD) body starts as a *cage*: a coarse mesh of quads whose vertices a person or an agent moves. The
smooth surface is what the cage becomes when it is subdivided again and again, by the Catmull–Clark rules, without end.
The kernel never keeps such a fine mesh. Where the cage is regular, it writes the limit surface down exactly, as bicubic
B-spline faces of a B-rep. Where it is not, it fits small G1 patches, called caps, close to the limit. Either way the
result is an ordinary solid or sheet: Booleans, STEP export and mass properties treat it like any other B-rep.

The studio's **SubD box**, **SubD tube** and **SubD torus** and its cage editor build on it
([SubD and the cage editor](/studio/features#subd-and-the-cage-editor)); in a part document it is the `subd` feature
([Modeling](/packages/cad/modeling)). The figures below run small cases worked out in the page with the kernel's rules;
two of them were also checked against the kernel's own faces for the same cage. All lengths are in mm.

## The cage

A cage is three lists (`SubdCage` in `features/subd.ts`):

| Field | What it holds |
|---|---|
| `positions` | x, y, z for each vertex |
| `faces` | each face as its vertex numbers, counter-clockwise seen from outside |
| `creases` | optional pairs of vertex numbers: edges that are infinitely sharp |

An edge with one face is a boundary, and is sharp like a crease. The rules for sharp edges are OpenSubdiv's, with the
"edge and corner" boundary interpolation: a boundary is a crease, and a boundary vertex with two edges is a corner, kept
where it is. A closed cage wound inward is turned outward first (its faces reversed when its signed volume is negative),
so it gives the same body.

The exact path (called SD1 in the code) needs every face to be a quad and every vertex to be *regular*:

| Vertex | Regular when |
|---|---|
| Inside, smooth | 4 edges, none sharp |
| Inside, on a crease line | 4 edges, exactly 2 sharp, running straight through it |
| On a boundary | 3 edges (2 of them the boundary), or 2 (a corner) |
| Anywhere | every edge sharp (a corner: each face's corner is its own) |

A cage with any other vertex, or any face that is not a quad, goes to the second path (SD2), [below](#_5-where-the-cage-is-not-regular).

## 1. A curve first

The idea is easiest to see on a curve. Take a polygon, put a point in the middle of every edge, move every old point to
three quarters of itself and an eighth of each neighbour, and repeat. The polygons close in on a smooth curve, and that
curve is known in closed form: it is the uniform cubic B-spline whose control polygon is the first one.

The same two rules are what Catmull–Clark does along a crease or a boundary, so this is also the curve the kernel draws
along a sharp edge.

<SubdCurve />

## 2. Catmull–Clark on a regular cage

One Catmull–Clark step (`refine` in `features/subd-sd2.ts`) makes three kinds of point and joins them into a cage of
four times the quads. Here n is the number of edges at a vertex, Q the mean of its faces' face points and R the mean of
its edges' midpoints.

| New point | Rule |
|---|---|
| Face point | the mean of the face's corners |
| Edge point, smooth edge | (a + b + f<sub>1</sub> + f<sub>2</sub>) / 4: its two ends and the face points of its two faces |
| Edge point, sharp edge | (a + b) / 2 |
| Vertex point, smooth (or the end of a crease, a dart) | (Q + 2R + (n − 3) v) / n |
| Vertex point, on a crease or boundary | (a + 6v + b) / 8, a and b its two sharp neighbours |
| Vertex point, corner | v |

Each vertex also has a *limit position*, where the endless subdivision takes it (`limitPosition`): (n² v + 4 Σ edge
ends + Σ diagonals) / (n (n + 5)) when smooth, (a + 4v + b) / 6 on a crease, v at a corner.

Where every vertex is regular, the limit surface is exactly the uniform bicubic B-spline whose control net is the cage.
The patch over one quad takes a 4 × 4 net: its own four corners and the twelve around them. The kernel uses this
directly. It builds no refined cage; it reads each quad's 4 × 4 net from the cage's topology (`netOf`), placing the
neighbours in the quad's own (u, v) frame.

<SubdSurface />

## 3. Boundaries and creases: phantom points

A quad on a boundary, or beside a crease, has no neighbour across that side. The kernel puts a *phantom* point there
instead: the point on the near side mirrored through the edge, 2·P(edge) − P(inside). With it, the limit along the
side is the cubic B-spline of the side's own vertices (the crease and boundary rule). Where both sides of a corner are
mirrored, the corner phantom is mirrored again, and the surface passes through the cage's corner point (the corner rule).

Across a crease each side mirrors its own phantoms, so the two sides meet along the crease curve with a corner between
them: position only (G0).

<SubdPhantom />

## 4. From nets to B-rep faces

One B-spline face per quad would make far too many faces. The kernel packs regular quads into blocks (`packBlocks`):
rows grown along u, then along v, up to 13 × 13 quads, which is 16 × 16 poles, the largest surface the kernel takes. A
block:

- never crosses a sharp edge, so a crease or a boundary is always an edge of the B-rep;
- never wraps onto itself (a ring of quads round a tube is cut into more than one block);
- stops at a quad turned more than a right angle from its first quad's (their normals' dot product ≤ 0), so each face
  stays a graph over its own plane, which is how the validator tells which side a face's loop runs.

Each block's nets overlap into one uniform net of (K + 3) × (L + 3) poles for K × L quads. Uniform knots are then
changed into clamped ones by Boehm knot insertion (`clamp`: the knots 3 and n + 3 each inserted twice), so the face is
the same surface with knots 0 0 0 0 1 2 … K K K K. That is the data change described in
[NURBS: changing the data, not the shape](/how/nurbs#changing-the-data-not-the-shape). The cage of the second figure,
5 × 4 quads, is one face with knots `0,0,0,0,1,2,3,4,5,5,5,5` by `0,0,0,0,1,2,3,4,4,4,4` and 8 × 7 poles.

A face's boundary is cut into runs of cage edges that end at a corner of the face or of the face across. Each run is
made once, as the limit curve along it: the net's line at that side averaged across with weights (1, 4, 1)/6, then
clamped (`runCurve`). Both faces use that one edge, so they share it exactly. Faces are named `<id>.patch<k>` after the
block's first quad. The body is a solid when the cage is closed and a sheet when it has a boundary.

## 5. Where the cage is not regular

Valence other than 4 inside (an *extraordinary* vertex), faces that are not quads, and darts (a crease that ends inside
the surface) have no exact B-spline form. The second path (SD2, `features/subd-sd2.ts`) handles them:

1. **Refine first.** One Catmull–Clark step of the whole cage. After it every face is a quad, and each irregular vertex
   sits among quads. A second step is taken when a quad would hold two irregular corners (a face point of an n-gon next
   to an irregular vertex), or when the caller asks for `steps: 2`. The step is global: refining only round a vertex
   would leave T-junctions (D78).
2. **Exact where it can be.** Every quad whose four corners are regular stays the exact B-spline of sections 2 to 4; a
   subdivision step does not change the limit surface there.
3. **A cap per quad at an irregular vertex.** Each becomes one face: a bicubic patch split once each way at τ = ¼ from
   the vertex, with knots `0 0 0 0 ¼ ¼ 1 1 1 1` both ways (6 × 6 poles, 2 × 2 Bézier pieces, C1 inside).
   - It starts from the B-spline-to-Bézier averages: interior points (4c + 2a + 2d + o)/9, edge points the mean of the
     two faces' (or (2v + a)/3 along a sharp edge), corners at their exact limit positions.
   - Held: the rows next to regular neighbours (so the cap meets them C1), the irregular vertex at its limit position,
     and crease and boundary edges as their B-spline curves.
   - G1 along every edge out of the vertex that is not sharp, written as linear conditions on the poles:
     ∂<sub>cross</sub>(left) + ∂<sub>cross</sub>(right) = α(t) · b′(t), with α = 2 cos θ (1 − t/τ)² on the half at
     the vertex and 0 beyond, and θ = 2π/n round a smooth vertex or a dart, π/k across the k faces between a crease's
     two edges or at a boundary, φ/k at a corner (φ the angle between its sharp edges). Each condition is imposed at
     five points of each half.
   - The conditions are made orthonormal (modified Gram–Schmidt, twice). A condition that depends on the others must
     already hold within 10⁻⁹ of the cage's size; otherwise the build is refused.
   - Within the conditions, the cap is fitted by least squares to the limit surface itself: samples on a 9 × 9 grid of
     each cap (its one-ring refined three times), four rounds that move each sample's parameters to its closest point
     on the cap just fitted, and a pull of μ = 10⁻⁶ toward the start for what the samples leave free.

What SD2 promises: C2 away from irregular vertices, G1 at and round them, G0 across creases; never G2. Caps are named
`<id>.cap<label>` and exact faces `<id>.patch<label>`, the label naming the cage face and corner each refined quad came
from (`0_1`, or `0_1_2` after two steps).

A plain cube cage, 10 mm, eight vertices of valence 3, measured by the kernel's report:

| Steps | Faces (caps) | Largest distance from the limit | RMS | Largest angle between normals at a shared edge |
|---|---|---|---|---|
| 1 | 24 (24) | 0.0033 mm | 0.00062 mm | 1.5 × 10⁻⁶ ° |
| 2 | 65 (24) | 0.0007 mm | 0.00013 mm | 1.5 × 10⁻⁶ ° |

(`subdReport` on `packages/barocss-cad/dist`, 2026-10-28. With two steps the 24 caps sit among 41 exact faces.)

## 6. The report

`subdReport` (`features/subd-report.ts`) measures what a build promises, independently of how it was built:

| Part | What it measures |
|---|---|
| Counts | Catmull–Clark steps taken (0: the exact path), irregular vertices, caps, B-rep faces |
| G1 | along every edge that is not sharp, both faces' normals at 9 points: the largest angle between them and the largest gap between the two surfaces |
| Caps' shape | on a 33 × 33 grid of each cap, the smallest \|S<sub>u</sub> × S<sub>v</sub>\| against its median (near 0: a degenerate point) and the largest turn between neighbouring normals (near 180°: a fold) |
| Deviation | limit samples on a 17 × 17 grid of each cap, from refining its one-ring four times: the distance to the closest point on the cap (largest and RMS), and at the same parameters |
| Exact quads | up to 4 exact quads measured the same way, as a check of the measure: it reads 0 there |

The caps' shape check exists because a fold once passed both G1 and distance: an earlier α with a kink at τ folded caps
flat while their edges stayed G1 (D78). The part model keeps a shorter summary with each SubD body (`subdSummary`).

## Where it is in the code

All paths under `packages/barocss-cad/src/`.

| File | Responsibility |
|---|---|
| `features/subd.ts` | `subdBrep`, `buildSubd`: the choice of path, regularity (`checkVertices`), each quad's net with phantoms (`netOf`), blocks (`packBlocks`), clamping by knot insertion (`clamp`), edges as limit curves (`runCurve`), the B-rep (`assemble`); `subdSummary` |
| `features/subd-sd2.ts` | The cage's topology and checks (`polyMesh`), vertex kinds and regularity, one Catmull–Clark step (`refine`), limit positions, the caps (`buildCaps`, `capsAt`, `edgeAlpha`), the limit sampled (`limitGrids`) |
| `features/subd-report.ts` | `subdReport`: G1, the caps' shape, deviation from the limit |
| `features/subd-cage.ts` | The cage editor's pure functions: topology, validation for overlays (`validateCage`), loops and rings, extrude, insert loop, delete, fill, bridge, weld, creases, mirror; `subdPreviewMesh`, the cage refined twice and taken to its limit positions, drawn while a cage is dragged (the exact B-rep is built when the drag ends) |
| `part/part-mesh.ts` | The part model's `subd` feature: checks the cage's shape and builds it |

## How it is checked

- `packages/barocss-cad/test/subd.test.mjs`:
  - regular tori of 16 × 8, 32 × 12 and 30 × 30 quads, a torus with two crease rings and a bumpy open sheet: one
    Catmull–Clark step, written apart in the test, gives a cage whose B-rep has the same volume and area to 10⁻¹²; the
    crease ring's edges stay on its plane; the open sheet passes through its four corners to 10⁻¹²;
  - exact by construction: a flat 4 × 3 grid has area 1200; a cube with every edge creased is the cube, 1000 mm³;
  - refusals: a bowtie, a face of two sides, an unknown vertex, a crease that is not an edge, a doubled face (INPUT);
    33 faces round a vertex (CAPABILITY);
  - SD2: the cube cage (24 caps, within 0.004 mm of the limit), a tetrahedron and pentagonal and hexagonal prisms (two
    steps), a cube with its top ring creased, a torus with two darts, stars round an inside vertex of 3, 5 and 6 quads
    and half stars round a boundary vertex. Each case is strictly valid, G1 within 10⁻⁵ °, gaps under 10⁻¹² mm,
    \|S<sub>u</sub> × S<sub>v</sub>\| above 0.05 of its median, normals turning under 15°, and tessellates; the closed
    cases' volumes match an independent Catmull–Clark with limit masks, extrapolated, to 2 × 10⁻³;
  - a regular torus takes no step and keeps its names; the measure reads 0 on exact quads;
  - the part model: patch names and a STEP round trip; cap caching (D82); the pipe-clamp acceptance part (D84).
- `packages/barocss-cad/test/subd-cage.test.mjs`: the cage editor's validation, selection and edits, each edited cage
  built by the kernel; the mirror across X gives the same body as the whole cage.
- `packages/barocss-cad/test/tessellate-flips.test.mjs`: a SubD box of 18 × 18 quads a side tessellates closed, in time.
- Conformance `packages/barocss-cad/conformance/r5/` (the creased cube, the 16 × 8 torus, two refusals kept as the
  record) and `conformance/r7/` (cube, creased top, tetrahedron, pentagonal prism, dart torus: volume, area and centroid
  against an independent limit; valence and bowtie refusals).

## Limits

- **Caps are close, not exact.** At irregular vertices the surface is a G1 fit to the limit, and the report gives its
  distance. The largest errors are at crease and boundary vertices, where the limit's edges are not evenly spread (four
  faces at a boundary vertex: 59.7°, 30.3°, 30.3°, 59.7°) but the caps' angles θ are; the 4-face half star in the tests
  is allowed 0.16 mm. `steps: 2` makes the caps a quarter of the area and nearer the limit, at four times the faces.
- **Never G2** at irregular vertices; C2 only on the exact faces.
- **Creases are infinitely sharp.** There are no sharpness values (semi-sharp creases).
- **Refused as CAPABILITY:** more than 32 faces round a vertex or sides on a face (`SUBD_MAX_VALENCE`); a cap whose G1
  conditions have no solution.
- **Refused as INPUT:** fewer than three vertices, a position that is not a finite number, a face of fewer than three
  sides or naming a vertex that is not there or naming one twice, an edge used twice the same way (faces wound against
  each other, or more than two faces at an edge), a face that meets itself, a crease that is not an edge of the cage,
  and a vertex whose faces are not one fan round it (not a manifold).
- **Size.** In a part document a cage has at most 100,000 vertices and 100,000 faces (`CadPartLimits.subdVertices`).
