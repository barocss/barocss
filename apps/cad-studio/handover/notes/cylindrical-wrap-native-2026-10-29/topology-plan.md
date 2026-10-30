# D298 private wrapped-solid topology plan

Status: read-only design, 2026-10-29. No provider code, new test, probe, build, or runtime execution was made for this plan. The source was read in `/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b`, whose HEAD was `06c33222a46520bef7d3191a4d4eb7614fde7a83`. The D297 map/curve files were present as current working-tree source. Parent-owned running checks are outside this report.

## Decision and required corrections

Direct topology is a suitable next private construction for this narrow family. It does not need a Boolean, sewing, geometric welding, or larger entity tolerances. Three conditions must be added to the proposed outline before a solid can be accepted:

1. A glyph counter needs a separate exposed basal island face on the original carrier. Adding only holes to the selected wall drops that material boundary. Each B-rep face has exactly one outer loop. Counter-internal ink islands also require the boundary containment tree described below.
2. The curve helper proves a global positional binding residual. It does not yet prove stored-edge injectivity, ruled-side regularity, or the absence of new intersections. These require coefficient/interval guards. Strict B-rep checks use samples and cannot replace those proofs.
3. The existing mass path is numerical quadrature or tessellation. Its returned positive volume is a regression observation, not a certified positive per-component material change. A bounded volume/support receipt must precede acceptance.

The record assembly can be small. The second and third items are mathematical acceptance work, not missing ID plumbing. If their proof budget is exhausted, the private provider must refuse atomically. This design does not establish general wrap or a finished text feature.

## Source symbols and exact record contract

All source paths below are relative to the worktree above.

| Source | Reusable contract |
| --- | --- |
| `packages/barocss-cad/src/brep/brep-core.ts:18` | `BrepVertex`, `BrepEdge`, `BrepCoedge`, `BrepLoop`, `BrepFace`, `BrepShell`, `BrepBody`, `Brep`; flat JSON-compatible records |
| `packages/barocss-cad/src/brep/brep-core.ts:179` | `checkBrep`; references, one outer per face, ordered cycles, twins, vertex links, connected shell, Euler, geometry; use `{strict:true}` on input and final candidate |
| `packages/barocss-cad/src/brep/brep-core.ts:368` | `buildBrep`; useful as a format example, unsuitable for preserving old IDs and tolerances |
| `packages/barocss-cad/src/brep/brep-core.ts:408` | `lineCurve`; exact endpoint records for radial edges and side pcurves, domain `[0,1]` |
| `packages/barocss-cad/src/features/prismatic-solid.ts:171` | `brepFromPrismatic`; native wall and cap records, canonical piece orientation, stored original pcurves |
| `packages/barocss-cad/src/features/prismatic-solid.ts:375` | `nameFaces`/`nameEdges`; explains existing names; do not run these on the complete result |
| `packages/barocss-cad/src/features/extruded-profile-solid.ts:192` | `segmentCurve`; trig-generated original rational arc coefficients; do not regenerate or snap these |
| `packages/barocss-cad/src/features/extruded-profile-solid.ts:211` | `extrudedSurface`; U follows the original arc; V follows extrusion |
| `packages/barocss-cad/src/nurbs/surfaces/surface-parameter-split.ts:101` | `splitSurfaceAtParameter`; require the original internal degree-multiplicity knot and `direct-copy` provenance, with zero insertions |
| `packages/barocss-cad/src/nurbs/surfaces/surface-isocurve.ts:88` | `extractSurfaceIsoCurve`; endpoint V row is an original pole/weight copy, not a new fit |
| `packages/barocss-cad/src/features/cylindrical-wrap-map.ts:200` | `admit`, `sourceProof`, `buildCylindricalWrapMap`; native-weight first quadrant, nominal `s=R*theta`, exact affine stored-node certificate, separate radial/arclength bounds |
| `packages/barocss-cad/src/features/cylindrical-wrap-curve.ts:265` | `composeCylindricalWrapCurve`; original-native UV line to cubic world edge and degree-one pcurve; shared endpoint-table option, positive denominator, global stored-model binding bound |
| `packages/barocss-cad/src/features/profile-relief.ts:125` | `inRing`, `inPolygon`, `separated`, `boundariesApart`; exact stored-number boundary admission patterns; private planar helpers, not drop-in cylindrical metrics |
| `packages/barocss-cad/src/brep/planar-arrangement.ts` | `exactPoint2FromXY`, `exactOrient2`; exact binary64 line predicates for stored UV topology |
| `packages/barocss-cad/src/numeric-policy.ts` | Existing native coordinate, linear and UV policies; the affine planar `chartRoundingBoundMM` does not by itself bound a nonlinear cylinder chart |
| `packages/barocss-cad/src/section-rational-internal.ts:4` | `SectionRationalContext`; original operation/GCD/8192-bit/fraction/float-search limits remain in force |
| `packages/barocss-cad/src/brep/solid-mass.ts:120` | `brepMassProperties`; numerical observation only for these new curved trims |

The result retains `format:'barocss-brep'`, `version:0`, and `lengthUnit:'mm'`. No schema, public union, option, or index export is proposed here.

Exact record fields are:

- Vertex: `{id, point:[x,y,z], tolerance}`.
- Edge: `{id, curve, vertices:[startId,endId], tolerance, name?}`. The whole curve domain runs from the first vertex to the second.
- Coedge: `{id, edge, sense:'forward'|'reversed', loop, next, prev, twin, pcurve}`.
- Loop: `{id, face, kind:'outer'|'inner', coedges:[orderedCoedgeIds...]}`.
- Face: `{id, shell, surface, sense:'forward'|'reversed', loops:[loopIds...], name?}`. Forward normal means `Su cross Sv`.
- Shell: `{id, body, faces:[faceIds...], closed:true}`.
- Body: `{id, kind:'solid', shells:[shellId]}`.

The pcurve always follows the canonical world edge's increasing t, with the same t domain. It is **not** reversed when the coedge is reversed (`brep-core.ts:19,257`; `cylindrical-wrap-curve.ts:27`).

## Native cylinder admission and face selection

Use caller-owned current native construction data plus the original source B-rep. A `source.family` string or tolerance-based `faceGeometry==='cylinder'` observation is not sufficient authority. The caller must retain the actual one-circle, one-upright-slab state and its radius/height/axis relation, then establish consistency with the full original B-rep. This proves a current construction relation, not historical producer provenance. The separately assigned `cylindrical-wrap-source.ts` adapter is intended to provide that admission receipt; it is WIP and was not executed by this review. Generic imported B-rep-only and geometrically finished states outside the current native relation refuse.

The first family is one centered +Z physical cylinder: radius from that construction, no bore, no steps, no earlier feature, one solid body, one closed shell, two planar caps, and two original rational half-wall faces. The simple native topology normally has V4/E6/F4/L4/C12. Check the actual incidence pattern, not just those counts. Cap loops and both wall loops must form this one closed cylinder; there must be no unused or hidden records. Keep all coordinates in the existing range, finite positive height/radius, no collapsed native domains, and strict-valid input. Source caps, bounds, name and signature expectations must correspond to the same admitted native value.

Read all wall surfaces. Require degree `(2,1)`, a 5x2 half-arc grid with a degree-multiplicity angular knot, original identical XY in both V columns, equal weights between those columns, and a common strictly increasing Z span. Use exact stored homogeneous coefficients to establish the Y sign and angular orientation; `K=XY'-YX'` must be strictly positive on each positive-Y half span. For this first family require the selected half's face sense forward. More general reversed V/carrier parameterization can refuse instead of normalizing it.

Select exactly one positive-Y half whose domain begins on +X and contains the increasing +X-to-+Y first quarter. Do not select by `name#2`, array position, shared start point, or equality of upper/lower weight arrays. The native prismatic canonicalization can make **both half curves start at +X**. The other half can have a middle weight one ulp different. Inspect its actual coefficients, preserve them, and validate it against its own native construction relation. Do not copy selected-half weights onto it. A private native-half ID/name in the adapter receipt must agree with this independently admitted face. Future display selection has a different boundary: Studio merges the two `#k` walls into a full-wall display group, so an authored group/signature cannot be stored as an arbitrary half name. A body-only future contract or a full-group expansion can precede this internal unique-quarter selection; see parent-owned `/tmp/barocss-wrap-source-reference-plan.md`. No product reference connection is implemented here.

Extract the first quarter at the original internal U knot. Require zero-insertion direct-copy pole/knot mappings and preserve the original quarter U range (commonly `[0,.5]`), V range, coordinates, weights, and common nonzero Z origin. The quarter only supports math and the new outer carrier; do not split/rebuild the existing half-wall topology. The new base pcurves use those original U/V values on the untouched 5x2 selected carrier. Direct-copy coefficient/domain equality is the binding link from the quarter to that half.

Current map admission is narrower than generic curve composition: first pole Y is exactly zero and native weights are `[1,Math.SQRT1_2,1]`. A selected native quarter outside that contract refuses; do not broaden it by snapping. The helper's near-quarter coefficient checks still do not prove the native producer.

## Chart admission, splits, and region ownership

Input is line-only chart ink components `{outer,holes}` in `(s,z)` with `s` nominal `R*theta`; it is not actual stored-carrier arclength. Original text and font stay above Kernel. Require nonzero exact signed area, continuous closed loops, no retracing, simple rings, valid holes, disjoint ink interiors, strict distances from all other boundary rings, and strict containment inside the first-quarter chart and between the two caps. Raw overlapping/touching ink refuses. Each original edge must meet the existing native minimum line length; split segments must also remain representable and nondegenerate.

Normalize a copied boundary direction only: outer CCW, holes CW, so ink is on the left of every canonical boundary edge. Preserve the original component/counter identities. A separate ink island inside another component's counter remains a separate component.

Build one exact containment tree for **all** original rings, with the selected half's uncut rectangular UV domain as the root background. Boundaries are strictly separate, so each non-root ring has one nearest containing parent. Check that each declared hole is an immediate boundary of its declared component and that all cross-component relationships agree with disjoint ink. Ink and exposed-base roles alternate. A counter may contain a separate component; that component is a hole of the counter's basal face, not a hole of the original main wall. If this tree cannot be established uniquely within budget, refuse. A deliberately smaller implementation may refuse nested components, but must state that restriction.

Split every chart edge at every crossed stored s-grid boundary using exact rational comparisons/interpolation. A vertical edge exactly on a grid boundary gets one consistent cell convention and one shared u-node. Sort split fractions exactly, include each endpoint once, and reject zero pieces. Each piece is wholly within one affine inverse cell. Compute the original-native UV endpoints exactly; Z-to-V is the original native affine Z relation. Round each stored UV vertex once with a receipt, or require exact representability. Do not use unreceipted Number interpolation from the map.

After conversion, run exact simple-ring, orientation, containment-tree, contact and gap checks on the **stored UV line polygons**, as well as the chart predicates. This prevents a very small hole/gap from disappearing during parameter storage. Derive a positive native-to-world metric lower bound for this quarter and use it for world gap requirements; the planar relief's chart margin is not already a world-cylinder margin. Charge all pair work before allocating/iterating.

## Shared tables and geometry

Use topological authored identities, not geometric proximity, as table keys. An original cyclic ring vertex has one key. A new split vertex uses `(component,ring,originalEdge,gridBoundary)`. Reuse the first/last cyclic key. Do not weld two different ring vertices or components even when coordinates happen to match; such input should have already refused.

One table row holds stored UV, exact pre-storage UV and residual, one base world point/vertex ID, one outer world point/vertex ID, and one radial edge ID. Each piece row holds its start/end table keys, one base cubic edge, one outer cubic edge, and one side face. Construct endpoint values once by exact rational surface evaluation and nearest conversion; alternatively the first deterministic edge composition can establish the value. Every subsequent helper call supplies those exact stored points through `endpoints`, and retains the returned whole-edge residual proof. Endpoints from adjacent curves must compare by `Object.is` after sharing, not merely by tolerance.

The outer carrier keeps original quarter U/V knots and weights. Its intended XY poles are the exact rational product by `lambda=(R+h)/R`; Z stays unchanged. Store finite coefficients once and record conversion residual. Do not compute a new ideal trigonometric quarter. Prove the rounded outer carrier is regular, outside the original quarter by a strictly positive radial amount, and within the declared homothety error budget. A Number `lambda*x` without a coefficient receipt is insufficient.

Compose base and outer cubic edges from the **same stored UV endpoints**. Check equal degree, knots and stored weights bit for bit, as supported by the existing same-weights test. A mismatch refuses; no basis fitting or tolerance increase. Preserve each returned pcurve. Base binding is checked against the original 5x2 half carrier through the direct-copy relation; outer binding is against the new quarter carrier.

For an edge e(t), make a degree `(3,1)` 4x2 radial ruled side with rows `[basePole[i],outerPole[i]]`, repeated stored edge weights in both columns, U equal to the cubic edge knots, and V `[0,0,1,1]`. Its two U-varying boundaries are the stored cubics by identical coefficients. At either U endpoint the equal two V weights make its radial boundary the line joining the shared base/outer vertex. Check these identities exactly over stored coefficients. New radial edge curves are `lineCurve`, from base to outer, domain `[0,1]`.

Position error alone does not prove these sides cannot fold. For each stored rational curve/side derive denominator-positive polynomial numerators for tangential progress, radial separation and the oriented side Jacobian. Use exact Bernstein sign bounds, fixed bounded subdivision if needed, and pairwise separation outside shared boundaries. Within this quarter, a positive angle coordinate plus height provides an injective chart for the intended map. Extend that to stored geometry using derivative bounds and certified separation. Adjacent-side vertex sectors also need the correct orientation; a global error tube protects separated edges but cannot alone settle a fold at their shared endpoint. Refuse uncertain skinny features or an unresolved derivative sign.

## Direct record assembly and orientation

Deep-copy the admitted source's plain data into a candidate. Do not serialize through JSON, which can lose signed zero. Do not call `buildBrep`: it prefixes IDs and reconstructs loops/coedges, and `Math.max(globalTolerance,storedTolerance)` can change old tolerances (`brep-core.ts:379-403`).

Keep the original body ID, shell ID, all old face/loop/coedge/edge/vertex IDs, array order, persistent names, optional field presence, pcurves, senses, next/prev/twins, and entity tolerances. The only old-record changes are appending new loop IDs to the selected wall face and appending new face IDs to its existing shell. The selected wall's surface and sense remain exact original copies. Append new flat records. New top-level `source` may identify the new private construction; retain the original source relation in the construction receipt, not by mutating original geometry.

Allocate a bounded private namespace, collision-check against **all** existing record, curve and surface IDs/names, and refuse collisions. Keep new Curve/Surface identifiers within the helper's 64-character native ID limit. Do not grow a 64-character caller ID with unchecked suffixes. Use stable component/ring/edge/split ordinals from the admitted authored order. Give new faces/edges feature-owned persistent names (for example `feature.base.c0.h0`, `feature.outer.c0`, `feature.side.c0.r0.e0.p0`); preserve original names exactly. Do not run global `nameFaces`/`nameEdges`, or renumber the old `#1/#2` names. An original selected wall name continues to denote its main residual face; new counter faces have new names and an explicit source-carrier relation.

Let E_i run along an ink boundary with material on the left, and let R_i run from its base vertex to its outer vertex. The following table assumes admitted U-angle increase and V-height increase; all side faces are forward after their exact orientation guard passes.

| Face/use | Coedge sense | Pcurve in canonical edge t |
| --- | --- | --- |
| Exposed base face, E_i base | reversed | Original native UV line, unchanged by coedge reversal |
| Side i, E_i base | forward | `(t,0)` |
| Side i, R_(i+1) | forward | `(1,t)` |
| Side i, E_i outer | reversed | `(t,1)` |
| Side i, R_i | reversed | `(0,t)` |
| Glyph outer face, E_i outer | forward | Original native UV line on the outer carrier |

Each side has one outer loop, ordered `[base_i forward, radial_next forward, outer_i reversed, radial_i reversed]`. Since `T cross radial` points to the right of an ink material-left boundary in the cylinder chart, this is outward. The same rule works on CW counter boundaries.

For each component create one outer glyph face on the outer quarter carrier, sense forward, with one CCW outer loop and its CW counter loops. Base edge and outer edge arrays follow each canonical ring order.

For the original selected wall, keep its original outer loop and add reversed **top-level component outer** rings as inner loops. For each counter create one new basal face using an exact copy of the original selected half carrier and its forward sense: reverse the canonical CW counter ring to form that basal face's CCW outer loop. Its child component outer rings become reversed inner loops. This is the containment-tree walk. Every base boundary is used exactly once on its exposed-base face and once on its side. Do not add a second outer loop to the original face.

All new coedges get explicit next/prev from the listed cyclic order and the matching loop pointer. New edge twins are paired by the shared edge identity only:

- Base edge: exposed-base reversed <-> side forward.
- Outer edge: side reversed <-> glyph face forward.
- Radial edge: preceding side's end forward <-> following side's start reversed.

No old coedge or twin needs a change, because no new footprint touches an old boundary. Populate both ends of each new twin pair before exposing the candidate.

## Support, counts, and final acceptance

This direct construction has no tool bottom or artificial seat Boolean. It replaces the exposed cylinder patch with its outward cap and sides. Positive basal support means each component has strictly positive two-dimensional ink area on the admitted material-filled source cylinder and a certified strictly positive inward source collar. A virtual inward collar of depth b can witness support if `0<b<R` and it stays within the source and between caps; it is proof data, not a new external bottom face or removed source material. Every distinct stroke must satisfy this, rather than only the total lettering area. Radial height must exceed all construction/binding uncertainty by a positive lower bound. Very small positive h that cannot meet this lower bound refuses.

For N total split boundary pieces, C ink components and H counters, with no identified vertices except cyclic ring closure, the construction adds V=2N, E=3N, F=N+C+H, L=N+2(C+H), and coedges=6N. Thus `delta(V-E+2F-L)=0`. Starting with the admitted cylinder shell, genus stays zero. This formula includes the H separate basal island faces and remains valid with the containment tree. Verify actual counts and incidences, all two-use opposite twins, vertex links, shell connectivity, one body/one closed shell, and exact coverage of every admitted piece. A total mass match cannot excuse a missing small component.

Before return, compare every old protected record with its deep source snapshot, including Number bits (`Object.is`), full curve/surface coefficients, knots/weights, field presence, tolerance and names. Check the allowed selected-face/shell append-only deltas explicitly. Old caps, the opposite half, old boundary curves, pcurves and representative vertices remain unchanged. Check all new curves/surfaces with native validators and run strict `checkBrep` on the private candidate. It must pass without changing a single tolerance. Existing checker orientation/binding tolerances can be looser than the provider receipt, so the provider's analytic bounds remain a separate required check.

Use a new entity tolerance no larger than the existing absolute native policy and the admitted source tolerance budget. Allocate separate parts of it to UV storage, outer-carrier storage, curve composition, shared-point overrides, and side binding; their sum must fit the existing binding policy. Keep font flatness, nominal map error, source circle defect/arclength drift, height error and native-evaluator error separate. No automatic relaxation, larger sewing default, or silent flattening is allowed.

Keep source admission and candidate state request-local. Copy before assembling; never modify the input or publish a partial candidate. A single typed refusal must report the failed input/support/budget/representability/binding/topology condition. It must not return the base alone as a successful wrap.

## Certified volume boundary and independent fixture plan

For the unrounded homothetic carrier, set `C(u)=(X/W,Y/W)` and `K=XY'-YX'`. In original `(u,z)` coordinates the added-volume density is

`((lambda^2-1)/2) * K(u)/W(u)^2`.

This follows from cylindrical volume Jacobian `r*dr*dtheta*dz`, `r^2=D/W^2`, and `theta'=K/D`. If using native V, multiply by its exact positive Z derivative. Exact positive ink area, `K>0`, `W>0` and `lambda>1` give a positive lower bound **for every component**. Counters subtract their domains, never their unqualified absolute areas. A certified cell decomposition/interval integral over the actual simple UV regions can provide a numerical enclosure; do not subtract two unrelated loose outer/hole volume bounds and call a negative result positive.

The stored outer carrier and sides have coefficient conversion residuals, so that formula alone does not certify their represented volume. Either prove equality to a representable homothety or carry derivative/coefficient error into a conservative interval volume audit. Exact Bernstein denominator bounds and a bounded subdivision/integration budget are a possible implementation route. The existing `brepMassProperties` quadrature is useful as an independent numerical comparison; its quadrature convergence and tessellation `volumeBound` do not supply a rigorous general certificate. If this audit is absent, the first runtime result must remain unqualified provider evidence.

The hand-authored next fixture, not implemented here, is R10/H30/h1, chart ring outer `[2,8]..[10,16]`, counter `[4,10]..[8,14]`, plus stroke `[12,8]..[14,12]`. Ink area is56 and ideal nominal-map added volume is58.8. A virtual seat b=.5 has ideal support overlap27.3. Use independent pi/arithmetic and a derived source/map/storage-volume error bound. Verify the counter basal face and both strokes individually; preserve native opposite-half weight bits and all caps/old edges. Additional future cases should cover nonzero Z origin, reversed caller face selection, both halves starting +X, nested counter ink island, hole/contact/seam/cap proximity, map-grid splits, tiny height, ID collisions, source mutation, and each budget refusal. This is a test plan only; no new tests were written or run.

## Budgets and next implementation boundary

Reuse the scale of existing native profile admission where practical: at most64 components, at most64 holes per component, at most1024 original edges per ring, and4096 total admitted source/profile edges (`profile-relief.ts:31`, native line minimum `1e-4`). These are ceilings, not guaranteed throughput. Grid splitting can multiply output drastically, so apply a separate pre-allocation cap of4096 total split pieces and a charged pair-work cap no larger than1048576. Check `6N` coedge and `N+C+H` face counts before allocation. Charge exact containment/intersection pairs, degree-based coefficient work, all subdivisions and output construction, not just input edge counts.

Each map/curve helper retains its existing rational and work limits. A provider also needs a finite aggregate charge over helper receipts; do not evade the operation budget by making one uncounted fresh context per edge. Keep each original SectionRationalContext limit unchanged (200000 operations/GCD steps,8192 bits,5000 fraction characters,64 float-search steps per conversion). A stricter aggregate private limit can refuse large text; choose and expose that limit in the implementation receipt before running. Do not increase these limits to make a font fixture pass. Use module-level helpers and no new closure inside element/curve/coefficient loops.

The smallest next implementation owns a private solid provider, its private proof records, and hand-authored Kernel fixtures. It reuses the existing map/curve helpers and native validators. It does not change Part/Model/Studio, the text recipe, exports, font loading, wrap UI, generic Booleans, existing cylinder interpretation, or public JSON. Admission, the counter-face tree, stored-geometry regularity and per-component positive-volume proof are required before claiming one physical wrapped solid. General wrap remains refused.

## Smallest implementable assembly slice

The next isolated worker can implement **private assembly diagnostics** for hand-authored rectilinear chart components and counters, initially `h=R` (`lambda=2`). It can return the assembled B-rep and explicit qualification flags to its private caller. It must not be a public successful wrap feature. Ordinary flattened TTF contours with diagonals or curved-outline chords are outside this first diagnostic admission. The ring-plus-stroke fixture above needs its height adjusted to R for this exact-scaling slice; retain h1/58.8 as the later independent arbitrary-height oracle.

This restriction has a useful mathematical reason. Scaling every finite binary64 XY pole by two is exact when the original and result stay in the native range. With unchanged Z, weights and knots, require exact rational equality of every stored outer edge pole to `(2*baseX,2*baseY,baseZ)`, rather than assuming two separate compositions will agree. The same check covers supplied endpoint-table values. Failure refuses. The source outer carrier must have the corresponding exact coefficient relation. This avoids an unproved rounded non-homothetic radial side in the first slice.

Use these whole-span stored-cubic guards. Write its homogeneous cubic coordinates `(X,Y,Z,W)`, with a positive denominator lower bound. Their proof polynomials are private; the native Curve remains degree3.

- Horizontal chart edge: all stored Cartesian Z poles must be exactly the same. Prove every Bernstein coefficient of `sign(deltaS)*(X*Y'-Y*X')` is strictly positive, or obtain a strict positive lower bound by fixed bounded exact subdivision. No endpoints or midpoint substitute for this condition. The stored curve then has strictly monotone angle and no self-intersection.
- Vertical chart edge: all stored Cartesian XY poles must be exactly equal, their squared radius strictly positive, and all coefficients of `sign(deltaZ)*(Z'*W-Z*W')` must be strictly positive, under the same bounded proof rule. The stored curve is a vertical injective segment, even if represented as a rational cubic.
- Use the actual stored endpoints for angular ordering, with exact homogeneous XY cross signs in this first quadrant. Common authored U/Z boundaries must retain their shared order across all edges. Exact chart/stored-UV disjointness is still required. Horizontal and vertical piece intersections can then be classified by angle interval and Z interval, including shared endpoint sectors, instead of a general rational-curve intersection routine. Do not accept unresolved angle-order equality for different vertices.

With exact homothety, a side is `H(t,r)=((1+r)*Bx(t),(1+r)*By(t),Bz(t))`. Its parametric normal is

`(-By*Bz', Bx*Bz', -(1+r)*(Bx*By'-By*Bx'))`.

For a horizontal edge only the third component is nonzero, with a fixed certified sign. For a vertical edge the first two components have a nonzero certified direction, because radius and the axial derivative are positive. This proves each side's full-span rank/orientation and, with the monotone angle or vertical coordinate and radial factor, its injectivity. It is not a sample check. Distinct sides still need the exact endpoint/order/separation proof above. Adjacent collinear grid pieces share only their one radial edge; original corners retain a nonzero orientation in the corresponding chart sectors. There must be no extra intersection or unidentified duplicate radial edge.

These guards make the rectilinear/homothetic side-embedding problem much smaller. They do not yet prove a literal gap-free analytic surface complex: the stored base/outer cubics remain within the certified native binding tolerance of their carrier pcurves. Keep that existing tolerance model explicit. Nor do they provide the missing rigorous volume bound for all represented trimmed faces. Thus an initial actual assembly implementation may report `topologyChecked:true`, individual regularity receipts and `solidQualified:false` while volume/whole-complex binding qualification remains open. It must not silently upgrade that diagnostic into physical-solid or text acceptance.

After this slice, arbitrary h needs an exact stored homothety test or a complete rounded-side Jacobian/separation certificate. Diagonal polygon edges need a general stored projected-boundary embedding proof. One possible guard starts with positive angular-derivative Bernstein coefficients; that proves an individual edge's injectivity, but does not prove two different angle-monotone edges cannot cross. That remaining pair/adjacent-sector problem must be solved or refused before ordinary text is supported. No runtime implementation or execution is included in this plan.
