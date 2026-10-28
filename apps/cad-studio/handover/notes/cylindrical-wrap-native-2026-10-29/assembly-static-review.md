# Private rectilinear wrap assembly: independent static review

Date:2026-10-29. Read current cylindrical-wrap-assembly.ts (446 lines) and its186-line test source,
plus the source map's Bernstein meaning. No source edit, probe, AST execution, build or test was run.
Root owns any execution evidence. This review does not qualify a physical solid or product feature.

## Finding

No blocking material defect was found within the explicitly marked private rectilinear topology-diagnostic
scope. `solidQualified:false`, `globalEvaluatorErrorCertified:false`, `representedVolumeCertified:false`
and `generalTextSupported:false` must remain. The actual stored new side family has stronger analytic
regularity than a sampled check, but this does not close the complete represented boundary or mass proof.

## Native-U chord lower bound

metric() reads the original map's exact homogeneous Bernstein polynomials D=X^2+Y^2 and
K=X*Y_share'-Y*X_share', whose derivatives use normalized original full-span share. Bernstein hull
bounds give D≤Dmax and K≥Kmin>0. Thus

    dtheta/d(native U) ≥ Kmin/(Dmax * nativeSpan).

For two points in the admitted quarter, both actual radii are at least R/2 and angular separation is
at most pi/2. The XY distance is at least2*rmin*sin(deltaTheta/2), which is at least
rmin*deltaTheta/2≥R*deltaTheta/4. Therefore metric's

    angular = R*Kmin/(4*Dmax*nativeSpan)

is a valid conservative lower Lipschitz bound for chord distance, not a mistaken upper derivative bound.
The axial factor is the positive actual Z span divided by the retained native V span. Native-U scaling
appears once. It must not be removed or applied a second time. Math min/max only selects stored endpoints;
the gap differences and metric products/comparisons are then exact rational operations.

apart() conservatively requires a positive scaled AABB gap on at least one UV axis. For axis-aligned
segments this excludes intersection/contact and provides a world separation lower bound for the ideal
original carrier images. It can refuse separated inputs whose boxes do not prove that gap; it does not
accept an unresolved crossing. Nonadjacent edges, rings, holes and separate component boundaries all pass
this check. Exact winding plus boundary separation establishes containment. Nested components, even an
island inside a counter, are intentionally refused. No general glyph-polygon claim is warranted.

## Exact stored-curve and side regularity

The horizontal guard forms the exact homogeneous degree5 polynomial X*Y'-Y*X', and requires all signed
Bernstein coefficients strictly positive. All stored XY Cartesian poles and weights are positive, so
radius never vanishes and angle stays in the first quadrant. Constant Z is checked by Object.is across
all four poles. The represented horizontal cubic therefore has strictly monotone angle, including the
whole open span rather than a few observed points.

The vertical guard requires constant stored XY at every pole and uses the exact homogeneous derivative
Z'*W-Z*W' with strict signed Bernstein positivity. Hence its angle/radius are constant and its represented
Z is strictly monotone. Positive weights keep the denominator nonzero in both cases.

Raised poles must be bit-identical to[2*x,2*y,z] with the same weights/basis. Doubling is exact in the
admitted finite range. The4x2 side copies those pole pairs and duplicates weights across radial V. Its
exact represented map is

    H(t,r)=[(1+r)*C_x(t),(1+r)*C_y(t),C_z(t)], 0≤r≤1.

For a horizontal edge the angular derivative is nonzero; for a vertical edge the axial derivative is
nonzero. In each case the two side tangent directions are independent, and the area element has strictly
positive magnitude. This is **nonzero surface Jacobian**, not a claim that an arbitrary signed3x3 determinant
is positive. Side sense and material-left boundary orientation determine the outward orientation. Each
individual side is injective: different t has a different angle or Z, and at fixed t the radial scale is
strictly increasing with positive radius.

endpointOrder() strengthens the local guards: every repeated original U has identical stored XY, every
different U has strictly ordered exact first-quadrant angle, repeated V has identical stored Z, and every
different V has strictly ordered Z. Thus the finite unique U/V coordinates induce global strictly ordered
angle/Z coordinates. Projected horizontal and vertical side boundaries retain the admitted rectilinear
embedding. New nonadjacent side faces cannot intersect in the exact stored model if their projected
segments are disjoint; adjacent faces meet along the one shared radial edge. Collinear continued edges
remain allowed, while adjacent retracing and collapsed edges are refused.

This argument covers the **new ruled-side family**. It must not be expanded into a proof that all original,
outer and basal faces form one exact embedded physical solid: their independently stored trim/world edges
have only the composer's tolerance-bounded carrier agreement, not equality.

## Incidence, UV trim winding and protected records

Input orientation is normalized material-left: outer CCW, holes CW in original(U,V). baseUses reverses
both order and senses; original selected wall receives CW inner loops from each component outer. The
counter basal island receives the reversed hole as one CCW outer loop on the original carrier, preserving
its original face sense. Raised component faces use outer CCW/holes CW. This correctly handles one outer
loop per BrepFace instead of leaving a counter island without a face.

A side's four coedges are base forward, end radial forward, outer reversed, start radial reversed. Pcurves
remain canonical edge-t direction, including reversed coedges. Long edges copy the represented cubic
basis; radial struts share one exact endpoint pair per ring corner. Each new edge is required to have two
opposite uses and mutual twins. The explicit2n vertices/3n edges/n+c+h faces/n+2(c+h) loops/6n coedges
incidence oracle is independent of checkBrep's traversal checks. The ring-plus-stroke test source asserts
those counts and dyadic UV areas; these are not physical-volume or nominal-arclength-area oracles.

Original input Part/PrismaticSolid/cached Brep is snapshotted by the source adapter. Assembly appends to
arrays of those private copied records. Only the selected face's loops and selected shell's face list are
replaced with appended arrays; old vertices/edges/loops/coedges and their twins are untouched by inspected
mutation paths. protect() compares every old record and the precisely allowed face/shell expansions.
Note that those local copied old records are shared between source.brep and result; protect() is not a
future-proof mutation detector if later code mutates both aliases. In this current implementation no such
mutation path was found, and caller data is a separate own snapshot. Failure exits publish no result and
preserve caller objects. Returned data remains mutable; this review does not claim deep freezing.

## Exact remaining limits

- The tol/8 exact coefficient receipt bounds source carrier versus stored base/outer edge, but finite
  gaps do not establish exact trim/surface closure. Complete boundary embedding, contact/overlap near
  old/outer/basal trim borders and represented mass remain unproved. Strict checkBrep is a finite necessary
  check, not that missing global proof.
- No numeric D0/evaluator reservation is currently adopted in this source. The separate conditional
  evaluator report cannot change the false flag or by itself certify Newton/normal/strict-check branches.
- Factor2 XY homothety only; requested height must equal source radius. Only rectilinear original native
  UV rings strictly inside one actual native quarter, not a font/arclength mapping or general text wrap.
- Boundary separation and local monotonicity are exact represented-data facts. Aggregate helper and root
  rational operations are charged against200000; source map work is included. This receipt does not claim
  a common GCD-step counter across all helper contexts or a wall-time bound. Count/work/bit exhaustion is
  a typed refusal, not permission to enlarge limits.
- Tests were read only. The first execution, failures, corrected fixture outcomes and source pin remain
  root's responsibility. No new test PASS or hardware claim is supplied by this review.
