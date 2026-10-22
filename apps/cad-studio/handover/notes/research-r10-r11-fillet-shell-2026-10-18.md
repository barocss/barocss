# R10 general fillet / R11 general shell — design input (coordinator research, 2026-10-18)

Design input only; the roadmap order is unchanged. From a read-only survey of the kernel at `eb8a49241`
and published sources (marked *unverified* where not confirmed).

## 1. Where the kernel stands
- **Surfaces**: every face is a rational NURBS or a facet patch; analytic kinds are recognised at run time
  (`analytic-boolean.ts` `surfaceOf`/`faceGeometry`: plane, cylinder; `surface-revolution.ts` `revolutionOf`:
  cone, sphere, torus — used by the shell, not by fillets).
- **Intersections**: exact plane×plane, plane×cylinder (lines, circles, ellipse), parallel and crossing
  cylinders (quartic; partial crossings, equal radii, grazing refused), plane/cone cases; general faces are
  marched (`march()`, `surface-intersection.ts`: coarse-grid seeds, Newton, trace along n₁×n₂, C¹ cubic
  Bézier chains). Limits: grid seeding can miss small loops; no tangential-contact handling.
- **Fillets/chamfers** (`edge-finish.ts` `finishBrepEdges`, rolling-ball tool + `booleanAnalytic`): straight
  edges between two planes; circular plane∩cylinder edges with the cylinder square to the plane (torus or
  cone tool); tangent chains; tools running past body ends; mitred convex corners; exact three-plane corner
  blends (`solve3`, D18/D22). `part-model.ts` `finishEdges` routes vertical corners of upright bodies to an
  exact 2D `cornerFinish`, straight chamfers to `wedgeChamfer`.
- **Refused today**: mesh faces ("general fillet and chamfer arrive with R10"); any pair other than
  plane/plane or plane∩square-cylinder; inside corners of two finished edges; sizes too large (walls,
  setbacks, full round, reaching the axis); chamfers cutting curved faces at an angle; variable radius,
  conic/G2 sections, setback vertex blends, mixed-convexity or ≥4-edge corners.
- **Known weakness**: `faceReach` (the 2026-10-16 W2 check) uses the farthest control point, an upper bound, so
  it can admit a fillet that does not actually fit on a curved-bounded face. Replace with a true reach in R10.1.
- **Shell** (`general-shell.ts`): body ∩ union of per-face slabs (depth t inside to 1.37t outside). Accepts planes
  bounded by lines/arcs, rectangular-domain cylinders, surfaces of revolution trimmed by circles/meridians.
  Refuses facet faces, freeform faces joined to others, other trims, all faces opened; plus `part-model.ts`
  limits (full-turn revolves only, swept bodies whose hollow section falls apart, finished edges bordering an
  open face). `thicken-solid.ts` is a faceted grid offset with no fold-over check; `section-offset.ts` is an
  exact 2D line/arc erosion.
- **Roadmap text** (README §4, ~l.427–440): an S0 feasibility checkpoint before R10; R10 = any edge incl.
  B-spline and cylinder/cylinder, constant then variable radius, vertex blends and setbacks, NURBS
  approximations with reported deviation, refusal codes; R11 = shell/offset for B-spline and facet faces,
  then self-intersection trimming, failures diagnosed per face.

## 2. How others do it (sources)
- **Rolling-ball fillets**: spine = intersection of the two base surfaces offset by r; circular cross-sections
  swept along it (rational quadratics). Choi & Ju, CAD 21(4) 1989; survey Vida, Martin & Várady, CAD 26(5) 1994
  (https://eprints.sztaki.hu/682/).
- **OCCT** `BRepFilletAPI_MakeFillet`/ChFi3d: two-face edges, tangent propagation, variable radius as
  (parameter, radius) pairs, section types Rational/QuasiAngular/Polynomial, faults per vertex;
  `PerformMoreThreeCorner` regressions (https://tracker.dev.opencascade.org/view.php?id=31023); FreeCAD notes
  OCCT is weak at several edges meeting at an inward vertex (https://tracker.freecad.org/view.php?id=2110).
- **Overflow** (fillet runs into neighbouring faces): NX options roll over smooth edges / roll onto edges
  (cliff edge) / maintain blend and move sharp edges (NXOpen EdgeBlendBuilder docs).
- **Sections**: SOLIDWORKS circular, conic (rho), conic radius, curvature-continuous; circular is only G1.
- **Vertex blends**: setbacks + spring curves + n-sided patches (Várady & Rockwood 1995/1997; Várady &
  Hoffmann "Vertex blending: problems and solutions"; transfinite patches Várady, Rockwood & Salvi 2011;
  survey Várady, Salvi & Vaitkus, CAGD 110, 2024). Three-plane suitcase corner = sphere octant.
- **Offsets**: NURBS offsets are not NURBS; approximate with error control (Piegl & Tiller, CAD 31, 1999;
  Elber, Lee & Kim, IEEE CG&A 1997). OCCT `MakeThickSolid` `PerformByJoin` (Arc/Intersection joins) vs
  `BySimple`; users report faults when the offset exceeds a narrow gap. Volumetric offsets for meshes:
  Pavić & Kobbelt, EG 2008; feature-preserving offset meshing (arXiv 2412.15564).

## 3. Recommended stages
**R10.1 — two closed-form classes, same tool + Boolean method, exact:**
- (a) *Translational*: straight edges along d between faces extruded along d (planes ∥ d, cylinders with axis d):
  solve the fillet in the 2D cross-section (line/circle tangent to circle) and extrude. Adds plane×cylinder
  along a ruling and parallel cylinder×cylinder.
- (b) *Coaxial*: any edge between surfaces of revolution about one axis (plane ⊥ axis, cylinder, cone, sphere,
  torus via `revolutionOf`): solve in the meridian plane and revolve (as `arcTool` does).
- New typed refusals: `TANGENT_FACES`, `RADIUS_EXCEEDS_FACE`, `RADIUS_EXCEEDS_CURVATURE`, `NOT_ANALYTIC_PAIR`
  (→ R10.2). Replace control-point `faceReach` with a true reach.

**R10.2 — general constant radius:** march `offset(A,±r) ∩ offset(B,±r)` or the rolling-ball system directly
(centre c, contacts on A and B, |c−p| = r, normals parallel); fillet = rational quadratic across × cubic
B-spline along, refined until within tolerance; report max |c−x|−r, contact distances, normal angle.
**Trim neighbours along the contact pcurves (uv from the solve), not by a NURBS-tool Boolean** — tangential
contact is the marcher's worst case. Refusals: `SPINE_BRANCH`, `CONTACT_LEAVES_FACE`, `APPROX_TOLERANCE_NOT_MET`.

**R10.3 — vertex blends:** generalise `solve3` to any three faces (numeric offset intersection → sphere-patch
corner); mixed convexity or ≥4 edges → setback n-sided patch (Coons/Gregory-type), G0 exact and G1 within a
stated angle; refuse `VERTEX_BLEND_UNSUPPORTED(valence, convexity)`.

**R10.4 — overflow** (roll onto an adjacent edge): refuse with a named reason first, add later.
**R10.5 — variable radius** r(s), refused when r′ is too steep for the face curvature; conic/G2 sections last.

**Accuracy contract:** analytic classes 1e-9 relative (as now); approximations deviation ≤ 1e-6 × size and
≤ the linear tolerance, always reported; G1 at contacts ≤ 1e-6 rad (analytic) / 1e-4 rad (approximate);
`checkBrep({strict:true})` on every result.

**Oracles/fixtures:** 90° straight fillet removes (1−π/4)r²L; coaxial fillets by Pappus; suitcase corner =
sphere octant; an implementation-independent ball check (x + r·n projects onto both faces at distance r);
OCCT goldens generated once with OCP in test tooling only, committed as JSON; extend RB4's fillet
monotone/Lipschitz property.

**R11.1** — extend slabs: plane/cylinder/cone/sphere/torus offsets stay in family; refuse `WALL_EXCEEDS_RADIUS`
per face or drop a collapsing slab; fillet radius < wall gives a correctly sharp inner corner (closed-form test).
**R11.2** — NURBS slab = face + approximate offset (sample and fit, checked at dense midpoints); local fold-over
by principal curvature (`local-curvature.ts`, `second-derivatives.ts`): t·κmax ≥ 1 on the concave side →
`OFFSET_FOLDS(face, u, v, minRadius)` or trim; global self-intersection is absorbed by the slab union (keep it).
**R11.3** — facet bodies: exact union of per-triangle prisms, edge cylinders, vertex spheres, or an SDF/voxel
offset for printing with the resolution reported; replace `thicken-solid.ts`'s unchecked fold-over with a refusal.
**Tests:** hollow sphere 4/3π(R³−(R−t)³); hole radius < t; torus minor radius < t; NURBS bump with curvature
radius < t; walls thinner than 2t; the enclosure-lip offset waiting on R11; OCCT `MakeThickSolid` goldens.

## 4. Risks → tests
Tangential Boolean on NURBS tools → compare the analytic and approximate path on the same edge; missed spine
branches from grid seeding → cylinder–cylinder tee with an equal-radius branch point (must refuse); name
reshuffling (D16, D22) → name stability across a radius change; seam crossing on a full-turn cylinder;
pole at the corner ball (D22 quadrature) → mass at r near the limit; fit tolerance creep → 20-edge tangent
chain, gaps ≤ tolerance.

## 5. The pipe-clamp lug as a B-rep part
Lug faces ⊥ tube axis meet the tube in arcs (plane∩square cylinder, supported today); the narrow side faces
∥ axis meet it along rulings (refused today). **R10.1(a)** makes the blend: an exact cylinder along the ruling,
a torus along the arc, a concave mitre between them. Rounding the lug's own convex edges in the same feature
needs **R10.3** (mixed-convexity corner); a tapered or off-axis lug (elliptic edges) needs **R10.2**; a lug
tangent to the tube is `TANGENT_FACES`. (The D84 clamp is the SubD route.)
