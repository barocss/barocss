# @barocss/cad (private experiment)

CSS-shaped model source becomes native rational B-spline geometry and ASCII IGES.
This package contains an original parser, local basis evaluator and writer. It has
no runtime dependencies. OCP is an independent test consumer, never a product kernel.
The private package is not registered for release or publication.

```js
import { parseModel, evaluateCurve, exportIGES } from '@barocss/cad';
const model = parseModel(source);
const point = evaluateCurve(model.objects[0], 0.5);
const { iges, report } = exportIGES(model, ['arc']);
// The host retains source and report, hashes iges, and writes the bytes.
```

## Exact language v0

One `@model name { ... }` contains required `version: 0;` and `length-unit: mm;`
declarations, plus 1..16 `@curve #id { ... }` or `@surface #id { ... }` blocks.
Field/block order is free. Fields and IDs cannot repeat. Names/IDs use
`[A-Za-z_][A-Za-z0-9_-]*`. Whitespace and `/* comments */` are accepted.
Every field declaration ends with `;`. Arrays use commas, with no trailing comma.
Numbers are signed finite decimal literals (`10`, `-1.25`, `.5`, `1.`);
exponents, strings, expressions, imports, selectors and arbitrary functions fail.

Curves require `type: nurbs; degree: <integer>; knots: [numbers];
control-points: [[x,y,z],...]; weights: [numbers];`.
Surfaces require `type: nurbs; degree-u: <integer>; degree-v: <integer>;
knots-u: [numbers]; knots-v: [numbers]; control-points: [[[x,y,z],...],...];
weights: [[numbers],...];`. The grid is `controlPoints[uIndex][vIndex]`.
Coordinates are millimetres; knots, parameters and weights are dimensionless.
No other fields, units, object kinds, periodic forms or trim definitions are accepted.
See the three fixtures in `examples/cad-nurbs`.

`parseModel` throws `CadSyntaxError` with code, offset (UTF-16 source index), line
and column (1-based). Geometry errors point to the object's declaration.
The parsed result includes each object's source span. Other public APIs throw on
invalid geometry or requests. No failed geometry is clamped or substituted.

## Fixed bounds and mathematical semantics

| Input | Bound |
| --- | --- |
| Source | 256 KiB UTF-8 |
| Objects | 1..16, unique IDs |
| Degree | 1..5 and smaller than pole count |
| Curve poles | 2..64 |
| Surface poles | 2..16 per direction, at most 256 |
| XYZ coordinate | finite, absolute value at most 1e6 mm |
| Weight | finite, in [1e-6, 1e6] |
| Requested samples | 2..4096; surface countU × countV at most 4096 |

Array nesting and element counts are checked while parsing, before additional
array allocation. Source bytes are checked before tokenization. No `eval`, file
access, network call or executable expression is driven by model source.

For N poles and degree p, knots have N+p+1 entries. They are finite,
nondecreasing, with exactly p+1 equal entries at each endpoint, interior
multiplicity at most p, and positive domain `[knots[p], knots[N]]`.
The local Cox–de Boor basis uses zero contributions for zero denominators.
An exact right endpoint selects the final span. Outside-domain parameters fail.
Rational evaluation weights both coordinates and denominator. Surface evaluation
uses the product of U and V bases. Sampling is uniform in parameter space,
includes endpoints and is deterministic; it is not arc-length sampling.

`validateCurve`, `validateSurface`, `validateModel`, `curveDomain`, `surfaceDomain`,
`evaluateCurve`, `evaluateSurface`, `sampleCurve` and `sampleSurface` are exported.
Curve samples are `{parameter, point}`. Surface samples are U rows of `{u,v,point}`.
Typed native objects can be used directly without parsing.

## Additive construction source v1

`compileConstruction(source)` accepts a separate version 1 language. It accepts
the existing curve blocks plus `@extrude #wall { curve: #arc; vector: [0,0,30]; }`.
The required model fields are `version: 1; length-unit: mm;`. All IDs are unique
across at most 16 declarations, with the same 256 KiB source bound. Curve references
can point forward. Missing references and references to extrusion outputs fail.
Native objects retain declaration order. A curve-only model is accepted.
Other geometry blocks, operations, expressions and executable forms fail.
`parseModel` remains strict v0 and rejects construction source.

The result is `{ sourceVersion: 1, model, constructions }`. Resolved `model.version`
is 0. Each construction retains `outputId`, `inputId`, `operation: 'extrude'`,
`vector`, declaration `span` and `referenceSpan`. Errors use `ConstructionSyntaxError`,
a `CadSyntaxError` subclass with code and source span. Spans use UTF-16 indices and
1-based line/column. Source version, native geometry version, preview packet version
and IGES format version are separate values.

`extrudeCurve(curve, { id, vector })` creates the rational affine surface
`S(u,v)=C(u)+vD`, with V domain [0,1]. Each pole becomes [Pi,Pi+D], each weight
becomes [wi,wi], U degree/knots are copied, and V degree/knots are 1/[0,0,1,1].
The API owns its output arrays and preserves inputs. Output IDs must differ from
the input ID; hosts enforce uniqueness against other native objects. At most 16
curve poles fit the existing surface bounds. The vector must be finite and nonzero,
and every translated coordinate must remain within 1e6 mm. Coordinates use binary64
addition. A translation that vanishes at every represented pole fails. Exact binary64
determinants reject wholly collinear collapsed constructions without an epsilon.
Other folds or singularities have no regularity certificate and can fail preview.
This operation creates an open surface, with no caps, solid topology or STEP.

See `examples/cad-nurbs/construction-demo.mjs` for a built-package host that maps
feature output ID to native surface, preview packet and explicit IGES selection.
The input curve is exported only if selected separately.

Run `test:consumer` on the current committed HEAD before `test:exchange`.
The extracted archive produces three construction exports and retained source,
features, native models, packets, reports and hashes. `BAROCSS_CAD_CONSTRUCTION_EVIDENCE`
selects the separate construction directory (default: isolated environment's
`evidence-505/construction`). OCP reads each actual entity 128 and compares 17×9
positions with independent formulas and the affine identity. Pole and source-parameter
corruptions must reach geometric comparison and fail. Legacy exchange gates remain.
The degree-one asymmetric fixture intentionally has C0 continuity: its exact OCP
continuity warning is retained and expected only for that fixture. The reader also
checks transferred U degree 1, knots [2,3,7], multiplicities [2,1,2] and U continuity
C0; the interior multiplicity gives continuity degree minus multiplicity = 0. Every transfer
failure and any other diagnostic fails. No healing or tolerance override is added.

## Analytic first derivatives

`evaluateCurveD1(curve, parameter)` returns `CurveD1Result` with `{ point, derivative }`.
`evaluateSurfaceD1(surface, u, v)` returns `SurfaceD1Result` with `{ point, du, dv }`.
All results own independent finite XYZ arrays. Existing point APIs are unchanged.
The new queries reuse strict native geometry bounds and input validation. Each
scalar query uses bounded local basis storage with at most six values per direction.

Derivatives use **original knot parameters**, in mm per dimensionless parameter.
They are not normalized. The implementation analytically differentiates the local
B-spline basis, then uses the rational quotient `(A' - W' * point) / W` in each
direction. Basis ratios use stabilized knot differences; derivative denominators
restore original scale. Zero knot denominators contribute zero. Unrepresentable
nonzero knot distances and nonfinite arithmetic fail. No finite differences,
parameter nudging, external kernel or runtime dependency implements these APIs.

Endpoints select the interior one-sided span. A non-knot parameter uses its containing
span even if another knot is C0. At an exact interior knot with multiplicity m and
degree p, D1 rejects when p-m < 1, including a surface query if either direction
fails. This conservative rule applies even if particular poles cancel a kink.
C1 or higher knots are accepted. There is no public left/right selector. Finite
zero derivatives are valid and do not certify regularity or define a unit normal.
No version, source grammar, preview normals or exchange format changes follow.

The native example is `examples/cad-nurbs/derivative-demo.mjs`. Packed consumers
retain eleven actual selected exports in `BAROCSS_CAD_DERIVATIVE_EVIDENCE` (default:
isolated environment's `evidence-507/derivatives`). Independent formulas cover the
rational circle, original-domain rescaling, both weighted bilinear partials and
extrusion du=C'(u), dv=D, and an exact repeated C1 cubic knot. Unit tests additionally cover degrees 1..5, continuity,
ownership, degeneracy and arithmetic rejection.

Run the current-head packed consumer before exchange. Installed OCP reads actual
IGES entities and checks original/transferred degrees, knots, domains and positions.
The derivative reader uses documented LocalD1 on the declared distinct-knot interval
for local C0 geometry away from the kink, and D1 at exact C1-or-higher interior knots.
Endpoints use first/last intervals. No epsilon, healing or tolerance override hides
the kink. The existing fixture-specific C0 warning policy remains mandatory.
Reports retain parameters, span indices, derivatives, hashes and exact task SHA.
Wrong original-domain scale, swapped partials and negated tangents must fail vector
comparison. Selected-fixture analytic error is at most `1e-9 * max(1, expected norm)`;
exchange derivative error is at most `1e-7 * max(1, expected norm)`. Existing position
tolerances stay unchanged. These are finite fixture checks, without a universal
accuracy, topology, certified normal or manufacturing claim.

## Oriented native surface boundaries

`extractSurfaceBoundary(surface, { boundary, id })` returns an owned native `Curve`.
`SurfaceBoundary` is `'v-min' | 'u-max' | 'v-max' | 'u-min'`;
`SurfaceBoundaryOptions` requires both selector and explicit native ID. Options
must have Object.prototype or null prototype and exactly two own data properties.
Unknown keys, symbols, accessors, inherited fields and unsupported selectors fail.
Accessors are not called. Proxy reflection traps remain the host's responsibility.
The existing surface validator is unchanged. Callers manage IDs when assembling
Models; duplicate IDs still fail the existing model/export checks.

The traversal is the positive parameter rectangle: v-min follows increasing U,
u-max follows increasing V, v-max follows decreasing U, u-min follows decreasing V.
Open-clamped endpoints select the first/last pole column or row with matching
weights, degree and directional knots. Decreasing boundaries reverse poles and
weights and reflect knots about the original endpoints. For original domain [a,b],
curve parameter t maps to surface parameter a+b-t. Stable subtraction/addition
avoids an overflowing a+b. Unrepresentable reflected interior knots, reordered
knots or collapsed distinct knots fail rather than changing geometry or domain.
Every output owns its pole arrays, weights and knots, including across calls.

This is exact endpoint extraction, without sampling, fitting or degree reduction.
Tangents retain original units: increasing edges use surface du/dv; decreasing
edges use their negatives at the reflected parameter. Existing D1 rules still
reject exact C0 knots and accept local spans, one-sided endpoints and C1 knots.
Floating reflection need not be bitwise involutive; selected double-reversal tests
use 1e-12 knot tolerance, identical recovered poles/weights and independent
geometry checks at the stated native tolerances. A constant
boundary is retained with finite zero derivative. It is not a regular edge, and
its parent surface is not certified regular. Endpoint agreement is geometry only,
without a trim loop, topological wire, sewing, face/shell, solid or STEP claim.

`examples/cad-nurbs/boundary-demo.mjs` uses built ESM to create four explicit IDs,
retain source/feature/native mapping, and export only four entity126 curves in
one native Model. The packed consumer covers flat, rational, weighted, asymmetric
and constructed surfaces. `BAROCSS_CAD_BOUNDARY_EVIDENCE` selects a separate path,
defaulting to the isolated environment's `evidence-509/boundaries`. Retained files
include actual four-root IGES, poles/weights/knots, source/surface/feature data,
oriented sample parameters, mapping and hashes. Run current-head packed consumer
before exchange. Installed OCP verifies explicit export-directory mapping, four
intended roots and original/transferred domains without assuming name retention.
Wrong edge, sign/scale and corrupt pole controls must fail geometric/vector checks.
Selected position limits are 1e-9 mm native and 1e-7 mm reader; derivative limits
are 1e-9 and 1e-7 times max(1, expected vector norm), in original parameter units.
All legacy construction, derivative, preview and exchange gates remain mandatory.

The additive index export loads `dist/boundary.js`, whose only runtime dependency
is existing `dist/math.js`; the types import is erased. The preview host needs the
exact static `/boundary.js` route. CAD records a proposed registration patch;
the GPU integrator applies it and verifies the actual host serially.

## Fixed parametric face incidence v0

`buildParametricFace(surface, ids)` returns a `FaceBundle`. `FaceIds` requires
explicit faceId, loopId and four-item vertexIds/edgeIds/curveIds tuples. All fifteen
geometry/topology IDs, including surface.id, must be distinct ASCII identifiers
of at most 128 characters. `Four<T>`, `UV`, `FaceVertex`, `FaceEdge`, `FaceUse` and
`FaceValidationReport` are exported. No identifier is inferred by the native API.

The bundle separates `geometry` (an existing version0 millimetre Model with one
copied source surface and four actual boundary curves) from `topology` (version0).
Topology contains one forward face with surfaceId/outerLoopId, four vertices with
native corner points, four edges with curveId and cyclic start/end vertex IDs, and
one loop with four forward uses. Uses are ordered v-min,u-max,v-max,u-min. Each
use retains its boundary selector and a linear pcurve `{ domain, uv0, uv1 }`.
Domains are original directional knot intervals; decreasing uses keep increasing
curve parameter while their UV endpoints traverse the opposite surface direction.
The builder's Model name is `parametric_face`; valid Model names are metadata,
separate from the fifteen reference IDs.

`validateFaceBundle(unknown)` checks the complete fixed incidence subset and
returns exactly `{ incidenceValid: true, geometricValidity: 'not-certified',
solid: false }`. It rejects unsupported fields/versions/senses, duplicate or
unreachable references, broken cyclic order, wrong exact boundary data and pcurve
mapping. It never repairs or reorders input. All records must be own plain data
(Object.prototype or null); arrays must have Array.prototype, exact dense schema
lengths and no foreign fields. Symbols, accessors and executable values reject
without calling getters. A snapshot uses at most8192 values, depth10 and128 items
per array and sixteen fields per record before strict schema/native validation.
Cycles fail these bounds. Proxy
reflection traps remain the host's responsibility. Valid source aliases are copied
per occurrence; returned nested geometry/topology arrays do not share input data.

This new subset requires C1-or-higher interior knots in both directions and four
pairwise distinct corner points separated by at least1e-6mm. C0, seams/repeated
corners and constant boundaries reject here. General #509 boundary extraction
and existing native validators remain unchanged. Nineteen fixed parameters per
edge include endpoints and seventeen nonuniform interior queries. Native curve,
vertex and surface-pcurve positions must agree within1e-9mm; signed original-domain
tangents within1e-9*max(1,expected norm). Equal UV components and endpoints retain
their exact values during interpolation, without nudging or clamping parameters.
These structural/selected mapping checks do not prove absence of internal folds
or self-intersection. A smooth folded quadratic counterexample passes incidence
while remaining not-certified. No regular face, shell, solid or manufacturing
guarantee follows, and finite zero interior derivatives do not become a normal.

The built-package example `examples/cad-nurbs/face-demo.mjs` reads explicit IDs
from `face-ids.json` and retains original source/features, bundle and report.
The unchanged IGES writer exports only native geometry: one entity128 surface
and four entity126 curves. It does not serialize the separate incidence IDs/graph.
`BAROCSS_CAD_FACE_EVIDENCE` selects retained packed/reader evidence, defaulting to
the isolated environment's `evidence-511/faces`. Run the current-head packed consumer
before exchange. Independent OCP checks actual directory mapping, graph corner
references, pcurves, original knots/domains and signed tangents. Reader limits remain
1e-7mm position and1e-7*max(1,expected norm) derivative. Wrong graph association,
missing vertex, reversed pcurve and corrupt exported pole controls must fail.

For four smooth representative flat/oblique-plane/quarter-cylinder fixtures only,
the reader also uses BRepCheck_Analyzer with geometry controls, counts one wire,
four edges and four distinct vertices using IsSame, and records reader face/wire/
edge orientations. SurfaceProperties area is checked against independent analytic
area within1e-7*max(1,area)mm². Requested quadrature precision and its estimated
error are separate report fields, without a certified quadrature error claim.
Reader-generated valid faces are selected independent consumer evidence, not
validation of every native input or interchange of our graph. No healing/tolerance
override or runtime kernel is added. All legacy gates remain mandatory.

The additive `dist/face.js` export imports only existing `dist/derivatives.js`,
`dist/boundary.js` and `dist/math.js` at runtime; type imports are erased. GPU alone
registers exact `/face.js` and verifies native plus actual-host final merged heads.

## Exact two-rectangle adjacency v0

`buildRectangleAdjacency(leftBundle, rightBundle, ids)` returns owned
`RectangleAdjacency`. `validateRectangleAdjacency(unknown)` returns exactly
`{ incidenceValid: true, geometryFamily: 'exact-axis-rectangles-v0', sharedEdges: 1,
closed: false, solid: false }`. Exported types include `RectangleAdjacencyIds`,
`RectangleAdjacencyValidationReport`, `QualifiedEdgeReference` and face/vertex/
edge/use records. The API does not change either local `FaceBundle` or its existing
`geometricValidity: 'not-certified'` status.

The new family is degree1×1,2×2 unit weights, exact U/V knots [0,0,1,1], integer
poles in [-10000,10000]mm, two nonzero signed sides A=P10-P00 and B=P01-P00 on
different axes with magnitudes1..10000mm, and exact P11=P00+A+B. Both faces have
the same signed A axis and exactly equal B; right.P00=left.P00+left.A. A lengths
may differ. These represented coefficient conditions give S=P00+uA+vB, constant
independent tangents, a full common edge, equal signed normal and disjoint interiors.
Only left u-max/right u-min association is supported. Curved/weighted/twisted/folded,
reversed-normal, partial/corner-only/overlapping/coincident/disjoint pairs are outside
this new API. Existing native geometry APIs retain their previous acceptance.
No samples, reader IsValid, epsilon matching, snapping, fitting or edge search
establish this exact family. Selected floating position/D1 comparisons are separate.

IDs are caller-supplied `{ adjacencyId, faceIds:[2], vertexIds:[6], edgeIds:[7] }`.
All sixteen descriptor IDs are distinct ASCII identifiers<=128characters. Each
wrapper `{ id, bundle }` defines its own local namespace; local IDs can repeat
between the two unchanged bundles. Qualified references are records
`{ faceId, edgeId, curveId }`, never concatenated strings. They resolve only inside
their owning wrapper bundle. All records are strict own enumerable plain data;
arrays are exact dense tuples. Snapshots preserve scalar values including signed
zeros, duplicate aliases and use at most32768 values/depth18,128items per array
and16fields per record. Accessors/symbols/nonenumerable/foreign/sparse/nonfinite/
oversized/cyclic data reject without executing getters. Proxy reflection traps
remain the host's responsibility.

Global vertices are [left0,left1,left2,left3,right1,right2] in native corner order
P00,P10,P11,P01; right0=left1 and right3=left2. Global edges are left0..3 then right0..2.
Their endpoint indices are [(0,1),(1,2),(2,3),(3,0),(1,4),(4,5),(5,2)]. Edge1 has
left1 forward and right3 reverse uses relative to its left canonical curve. All
other edges have one canonical forward use. Each qualified local edge occurs once
across eight uses. Local curves/pcurves/loops stay forward and unchanged; common
parameters follow tRight=1-tLeft with opposite D1. Local/global vertices must be
numerically EXACTLY equal to recognized pole corners, not merely within the old
face tolerance. A1e-10mm global point change fails. Snapshots do not normalize signed
zero data; geometric equality uses strict numeric equality.

Named data/IDs/family/vertices/references/shared-geometry gates recompute the fixed
descriptor and reject cached proof fields, wrong owners/curves/order/senses/counts,
mutated copies and unsupported families. Every returned point/ref/use/array owns
its data independently. Native selected position limit1e-9mm and D1 error
1e-9*max(1,expected norm) do not relax exact graph coincidence.

The built ESM demo uses rectangle-left/right.css plus explicit local/global ID files.
It deliberately repeats local IDs, stores the global descriptor separately, and
exports two original five-object geometry Models to two IGES files. Existing
Model16 bounds are unchanged. IGES does not serialize global incidence or create
shared IsSame topology, a sewn shell, solid or STEP.

`BAROCSS_CAD_ADJACENCY_EVIDENCE` selects packed/OCP artifacts, defaulting to the
isolated environment's `evidence-515/adjacency`. Seven signed XY/YZ/ZX/translated
pairs retain authored data, IDs, owned bundles, exact references, native queries,
actual per-face exports and directory mapping. Independent OCP compares both faces,
signed normals/areas, qualified ownership and common positions/D1 at reversed
parameters. Reader position/scaled D1 limits stay1e-7; area limit1e-7*max(1,area)mm².
Quadrature request/estimate is separate. Wrong owner/sense/global point/curve controls
must fail even when both original exported faces are valid. Folded/collapsed reader
acceptance is retained as a limitation, never a general native certificate. All old
point/source/preview/IGES/D1/boundary/face gates remain mandatory.

New `dist/adjacency.js` imports existing `dist/face.js` and `dist/derivatives.js`.
Type imports are erased. GPU alone registers exact `/adjacency.js` and runs serial
native plus current actual-host/browser/captured-export final-head postchecks.

## Additive orthogonal rectangle adjacency v0

`buildOrthogonalRectangleAdjacency(leftBundle, rightBundle, ids)` and
`validateOrthogonalRectangleAdjacency(unknown)` add a separate operation.
`OrthogonalRectangleAdjacencyIds` and `OrthogonalRectangleAdjacency` retain the
existing ID/descriptor layouts; `OrthogonalRectangleAdjacencyValidationReport`
is exactly `{ incidenceValid: true, geometryFamily: 'exact-orthogonal-axis-rectangles-v0',
sharedEdges: 1, closed: false, solid: false }`. Existing coplanar functions, report,
acceptance and native bytes are unchanged. Old coplanar APIs reject orthogonal
pairs; the new functions reject coplanar pairs rather than silently widening them.

Each surface is the same restricted unit-weight canonical integer axis rectangle.
The fixed maps are left `O+uA+vB` and right `O+A+uC+vB`, with A,B,C on three
mutually different coordinate axes. The existing degree1×1/2×2, [0,0,1,1] knots,
integer pole range±10000mm and signed side magnitudes1..10000mm are required.
Coefficients establish regular injective individual maps and perpendicular signed
normals. Equal A/C components force leftU1/rightU0; B then gives equal V, so the
bounded planes intersect only on the full common segment. Perpendicular normals
describe an orthogonal crease, not shared smooth-normal continuity.

The exact two-face/6vertex/7edge/8use/16explicit-global-ID namespace and fixed
qualified references match the coplanar descriptor. Common left u-max/right u-min
uses are forward/reverse, with tRight=1-tLeft in original canonical parameters.
Local five-object FaceBundles, geometry, pcurves, loops, repeated local IDs and
not-certified/solidfalse reports remain unchanged and independently owned.
Snapshot guards remain32768values/depth18/array128/record16, own enumerable plain
data, dense tuples and finite scalars. Getter/symbol/foreign/nonenumerable/cyclic/
sparse/cached-proof data reject without execution. Scalar signed zeros are preserved.
Exact local/global corner/reference association never uses a comparison epsilon.
Weighted/rotated/folded/collapsed, partial/reversed-B/near/disjoint/noncanonical
sources and malformed graphs reject without fitting, guessing or repair.

`orthogonal-demo.mjs` pairs rectangle-left.css with orthogonal-right.css and explicit
local/global IDs. `BAROCSS_CAD_ORTHOGONAL_EVIDENCE` selects fresh actual product
archive evidence, defaulting to the isolated environment's `evidence-519/orthogonal`.
The packed ESM/types consumer calls the new builder and validator, not private
research graphs. Twelve signed-axis/translated pairs retain24actual per-face
surface+four-boundary IGES files,228common and1824boundary queries and the named
source/graph controls. `test:exchange` requires current-head packed evidence and
runs the new independent reader alongside every old suite. Original domains,
qualified file/directory ownership, signed normals and areas are checked separately.
Native position/scaledD1 limits are1e-9, reader1e-7; area1e-7*max(1,area)mm² with
quadrature request/estimate retained separately. A valid exported pair cannot hide
a wrong owner/sense/edge/vertex/missing-or-duplicate use or1e-10mm global point change.
Actual folded/collapsed reader acceptance remains a limitation, not a product proof.

Two separate five-object Models preserve Model16. No sewing, shared IsSame edge,
serialized global graph, closed shell/solid/STEP, general geometric certificate or
manufacturing result follows. New `dist/orthogonal-adjacency.js` imports only existing
`dist/face.js` and `dist/derivatives.js` at runtime; type-only adjacency/types imports
are erased. GPU alone registers exact `/orthogonal-adjacency.js`, integrates and
runs same-head native/current-host/browser/captured-export postchecks.

## Exact outward axis-box shell v0

`buildAxisBoxShell(origin, sides, bundles, ids)` and `validateAxisBoxShell(unknown)`
add a separate bounded closed-boundary operation. Exported `AxisBoxShellIds`,
`AxisBoxShell` and `AxisBoxShellValidationReport` use the frozen descriptor contract.
The report is exactly `{ incidenceValid: true, geometryFamily: 'exact-axis-box-shell-v0',
closed: true, solid: false, solidProductImplemented: false }`. There is no public
volume/area field or general solid certificate. Local FaceBundle reports remain
not-certified/solidfalse. Existing face/coplanar/orthogonal code and bytes are unchanged.

Origin is a three-item integer-mm tuple; sides are positive integer lengths1..10000.
All eight represented corners lie in[-10000,10000]mm. Six valid owned FaceBundles
must exactly match the outward min/max planes, clamped degree1×1/2×2 unit-weight
canonical rectangles and full original-domain extents. Faces are ordered x-min,
x-max,y-min,y-max,z-min,z-max. Corner i=xbit+2*ybit+4*zbit. Local P00/P10/P11/P01
indices are [0,4,6,2],[1,3,7,5],[0,1,5,4],[2,6,7,3],[0,2,3,1],[4,5,7,6]. U-major
poles are [P00,P01]/[P10,P11]. Outward coefficients/half-space conditions establish
this exact box boundary; counts/Euler/positive volume/reader IsValid alone do not.

Descriptor own fields are version0,id,origin,sides,faces,vertices,edges. IDs are
explicit `{ shellId, faceIds:[6], vertexIds:[8], edgeIds:[12] }`,27globally distinct
ASCII identifiers<=128characters. Local IDs may repeat inside qualified wrappers.
Canonical directed segments are (0,1),(0,2),(0,4),(1,3),(1,5),(2,3),(2,6),(3,7),
(4,5),(4,6),(5,7),(6,7). Each has exactly two opposite qualified boundary uses,
forward then reverse; canonical is the fixed actual forward local curve. Every
local edge use is reached once; face and vertex graphs must be connected. Each
actual boundary/pcurve/pole/weight/knot/endpoint matches its full segment exactly,
with original parameter reversal1-t and separately measured D1/positions.
There is no arbitrary edge discovery, fitting, snapping or reparameterization.

Snapshot guards remain32768visited values/depth18/array128/record16, own enumerable
plain records and dense exact tuples, with finite scalar/signed-zero preservation.
Every output occurrence is independently owned. Getters are not called; symbols,
foreign/hidden/nonenumerable/sparse/cyclic/nonfinite/oversized/cached-proof data
and fake numeric-key records in place of arrays reject. Proxy reflection traps
remain the host's responsibility. Exact global/local coordinates never use epsilon
matching. Missing/duplicate/inward/near/partial faces, reversed/missing/duplicate
uses, wrong qualified owner/vertex,1e-10mm point changes,zero sides and unsupported
weighted/non-axis/folded/collapsed inputs reject before claiming closed incidence.

Six separate Models each contain one surface/four boundary curves. Thirty local
geometry objects stay distributed under unchanged Model16. This new27-ID shell
subset does not widen the two-face16-ID contract. Current fixed orthogonal pair
functions directly accept only3of12outward box pairs; local faces are not mutated
to force the remaining pairs through them. A distinct original solid-validity/
volume operation and STEP are future scopes, not this shell API.

The actual packed product consumer freshly builds four pinned boxes/24native face
files/120IGESentities,912common and1824boundary queries. `BAROCSS_CAD_BOX_SHELL_EVIDENCE`
selects fresh evidence, defaulting to the isolated environment's `evidence-523/box-shell`.
Run current-head packed consumer before exchange. `test:exchange` necessarily runs
the new installed-reader suite plus all old suites. It verifies exact coefficients,
qualified original-byte/directory/native-ID association, outward signs, areas and
separate numerical signed face-flux volumes1,30,216,6mm³. Flux/area are evidence only,
never report fields. Native position/scaledD1 limit1e-9, reader1e-7; area/selected
volume1e-7*max(1,expected), quadrature1e-10 request/estimate separately recorded.
Twelve actual product controls and thirteen reader graph/actual-pole controls fail.
Readable valid individual faces cannot hide incorrect global references. Existing
folded/collapsed reader acceptance/defaultfuzzy limitations are retained. No sewing,
healing/tolerance override, shared IsSame, serialized global shell, original solid,
STEP/manufacturing/hardware claim follows.

New `dist/box-shell.js` imports only existing `dist/face.js` and `dist/derivatives.js`
at runtime. Native/adjacency type references are erased. GPU alone registers the
exact static `/box-shell.js` route and performs serial same-head native/current
project-host/browser/selected-export/CSP/module postchecks before closure.

## Restricted axis-box solid validity and analysis

`validateAxisBoxSolid(unknown)` is a distinct additive operation returning
`AxisBoxSolidValidationReport`: `{ valid: true, geometryFamily: 'exact-axis-box-solid-v0',
closed: true, solid: true, volumeMM3, areaMM2, boundsMM: { min, max } }`.
It consumes only the current exact outward `AxisBoxShell` family. The actual shell
validator establishes the six complete distinct min/max planes, outward regular
coefficients, original boundaries/pcurves and qualified closed incidence before
any volume calculation. Their half-space intersection is the restricted filled box.
Counts/Euler/positive flux/reader IsValid or caller-supplied proof fields are not
the recognition rule. Generic/rotated/weighted/trimmed B-Rep data stays unsupported.

The function takes ONE strict independently owned caller snapshot first, calls
actual `validateAxisBoxShell` on it, checks the real unchanged shell report and
calculates from that SAME validated copy. It never rereads the caller after the
guard. Shell validation can safely copy the owned plain data internally. Existing
module-private snapshot code is not exposed or changed. Guards remain32768values/
depth18/array128/record16, finite scalars, own enumerable plain data/dense tuples;
getters/symbols/foreign/hidden/cyclic/sparse/oversized/cached-proof data reject.
Reflection traps remain the host's responsibility. Validated copy consistency is
tested even when caller data changes during initial reflection. Signed-zero data
is preserved. Report/min/max arrays own data independently of input and other reports.

Positive integer lengths<=10000 and represented corner bounds±10000mm imply exact
safe binary64 integers: `volumeMM3=dx*dy*dz<=1e12`,
`areaMM2=2*(dx*dy+dy*dz+dz*dx)<=6e8`. Bounds are copied origin and exact origin+sides.
No rounding or absolute-value repair of bad signed volume is used. Maximum accepted
lengths/bounds and malformed/unsupported inputs are explicitly tested. A positive
numeric volume with a missing/inward/partial/wrongly associated face still fails.
Existing shell report stays closed:true/solid:false/solidProductImplemented:false;
all local face reports remain not-certified/solidfalse. No old API/version/Model
limit or generic local face validity is promoted by this separate restricted report.

The actual packed consumer builds four new shells through the real product builder,
then calls both solid and shell validators. `BAROCSS_CAD_BOX_SOLID_EVIDENCE` selects
fresh evidence, defaulting to the isolated environment's `evidence-524/box-solid`.
The exact reports give volumes1,30,216,6mm³, areas6,62,228,22mm² and authored bounds.
Independent native D1/centroid-flux and actual installed-reader per-face area/flux
are separate selected numerical evidence. Reader checks24original per-face files/
120entities/912common+1824boundary queries before comparing the derived report.
Native1e-9/reader1e-7 point/scaledD1 limits and area/flux-volume1e-7*max(1,expected)
remain unchanged; requested quadrature and estimated error are separate. Thirteen
independent graph/actual exported-pole controls fail after readable geometry checks.
Folded/collapsed reader acceptance is retained as a limitation, not native proof.

`test:exchange` necessarily runs this new suite plus all old gates. The retained
actual archive is replayed to regenerate reports/geometry and independent reader
evidence. The built demo writes shell and derived solid reports separately. No
reader sewing/shared IsSame/global topology serialization or mutable kernel solid
is created. Original bounded STEP, arbitrary solid/manufacturing/hardware claims
remain outside this exact operation.

New `dist/box-solid.js` imports ONLY existing `dist/box-shell.js` at runtime;
native types are erased. GPU alone registers exact static `/box-solid.js` and
runs same-head native/current project/browser/save-open/selected-IGES postchecks.

## IGES delivery

`exportIGES(model, ids)` requires explicit unique IDs. It writes deterministic
IGES 5.3 ASCII S/G/D/P/T records, entity 126 or 128 only, model scale 1 and MM units.
U varies fastest in surface weights and XYZ poles. The final 128 parameters are
U0,U1,V0,V1. Open/nonperiodic flags remain open; there is no solid claim.
Metadata uses printable ASCII, at most 256 characters per string. Directory
labels retain the first eight ID characters; the report retains the full ID map.
Timestamps are fixed at `20000101.000000`. The report includes domains,
record counts/pointers, selected IDs, format, units, and no geometric loss.
Native source/history is separate from exchange bytes. The test harness retains
source, parsed model, evaluated samples, IGES bytes and SHA-256 provenance.

## Reproducible independent consumer

Use modern bundled Node and pnpm. Run `pnpm --filter @barocss/cad` followed by
`lint`, `type-check`, `build:library`, `test`, or `test:consumer`.
Build first before unit/consumer/exchange tests. The packed-consumer test extracts
an actual tarball outside the workspace and checks ESM and TypeScript imports.
The existing release package checker still covers the four release packages.
No shared workspace registration patch is needed: `packages/*` already includes CAD.
No root manifest or lockfile edit is required because CAD adds no dependencies.

The test-only environment is `/Users/user/.barocss-ai/v3/verify-cad-ocp-8.0.1.1.0`.
Create it with Homebrew Python 3.13. Binary-only macOS arm64 wheel versions and
SHA-256 hashes are pinned in `test/consumer-requirements.txt`. To replay setup:

```sh
/opt/homebrew/bin/python3.13 -m venv /Users/user/.barocss-ai/v3/verify-cad-ocp-8.0.1.1.0
/Users/user/.barocss-ai/v3/verify-cad-ocp-8.0.1.1.0/bin/python -m pip install --only-binary=:all: --require-hashes -r packages/barocss-cad/test/consumer-requirements.txt
/Users/user/.barocss-ai/v3/verify-cad-ocp-8.0.1.1.0/bin/python -m pip check
BAROCSS_CAD_PYTHON=/Users/user/.barocss-ai/v3/verify-cad-ocp-8.0.1.1.0/bin/python pnpm --filter @barocss/cad test:exchange
```

Missing Python/OCP fails the gate. There is no skip or alternate self-reader path.
`scripts/read-ocp.py` reads actual bytes, checks complete model diagnostics,
transfers one intended root, checks edge/face B-spline kinds, MM/scale, and samples
17 curve parameters and 9×9 grids for both surfaces, including boundaries.
It independently checks circle/cylinder and asymmetric bilinear formulas.
The named healing sequence is disabled. Precision mode stays file-derived;
no tolerance override is used. Serialized domains and transferred BRep domains
must match. Two negative controls break a pointer and a real pole. The latter
passes structural checks and must fail OCCT geometric comparison.

**Consumer limitation:** OCP 8.0.1.1.0's raw IGES128 entity accessors swap U1/V0
when reading the standard U0,U1,V0,V1 fields. This is also visible in the
[OCCT reader source](https://github.com/Open-Cascade-SAS/OCCT/blob/V7_9_0/src/IGESGeom/IGESGeom_ToolBSplineSurface.cxx).
The report records serialized, raw and transferred domains separately. Actual
transferred BRep domains and all geometric samples are checked against the
source. The writer does not change the standard order to mask this discrepancy.
This establishes the transferred geometry path, not correctness of that raw
consumer metadata API or all CAD consumers.

Default evidence is outside the checkout in the consumer environment's
`evidence/`; `BAROCSS_CAD_EVIDENCE` selects another directory. Reports retain
versions, settings, diagnostics, hashes, task/base SHA and measured maxima.
The tolerances (1e-9 mm analytic, 1e-7 mm exchange) apply only to bounded fixtures.
No universal accuracy, manufacturing, watertight-solid, STEP, trimming, B-Rep
operation, GPU compatibility, performance or AI-authoring claim follows.

## Source and license boundaries

Product source is original MIT code. The independent test consumer is
[cadquery-ocp 8.0.1.1.0](https://pypi.org/project/cadquery-ocp/8.0.1.1.0/) and its
proxy (Apache-2.0 metadata), with VTK 9.6.2 (BSD metadata). OCCT itself uses LGPL
2.1 with the OCCT exception; see [OCCT license](https://github.com/Open-Cascade-SAS/OCCT/blob/V7_9_0/LICENSE_LGPL_21.txt).
Consumer wheels and their license files remain in the isolated environment.
No consumer implementation is included in the product bundle.

## Surface preview packet v0

`tessellateSurface(surface, { countU, countV, revision })` is an additive host API.
It returns `{ packet, report }`; it does not change source grammar, authoritative
NURBS data, sampled geometry APIs or IGES. No GPU dependency is added.
Counts are integers 2..64 in each direction. The product is at most 4096 vertices,
3969 cells, 7938 triangles and 19845 distance probes. Revision is an integer
0..2147483647 supplied by the host; it records provenance, not freshness.
All counts and native geometry are validated before mesh allocation.

The packet is a plain JSON-compatible object with version 0, surfaceId, revision,
lengthUnit `mm`, coordinateSystem `right-handed-y-up`, winding `ccw`, flat numeric
positions/normals/indices/parameters, and bounds `{ min, max }`. No axis conversion
is applied: XYZ values retain the native coordinates. The host must interpret
those coordinates under the declared convention; this API does not infer a CAD
up axis or closed-solid outward direction.
Positions are in mm, at uniform U/V parameters including endpoints. Parameters
retain the actual native domain; the angular parameter of a rational circle is
not uniform angle. Vertices use U-major rows: `index(i,j)=i*countV+j`. Each cell
uses triangles `(a,b,c),(b,d,c)` for a=(i,j), b=(i+1,j), c=(i,j+1), d=(i+1,j+1).
Bounds are exact component-wise minima/maxima of sampled positions, not poles.

Each triangle's `(b-a) × (c-a)` is summed into its incident vertices in cell/
triangle order and normalized once per vertex. These are area-weighted averaged
triangle preview normals, not exact NURBS derivative normals. The orientation
retains the U/V cross-product direction. Collapsed/nonfinite triangles, zero or
cancelling sums, and triangles whose direction disagrees with any incident
vertex normal fail. No triangles are dropped, repaired or reversed. Cusps,
folds and self-intersections have no general acceptance guarantee.

The separate report retains grid, counts, domain, normal method,
`maxSampledDeviationMM` and `certified: false`. For each cell it evaluates its
center and four quarter-cell points at actual NURBS positions, then measures
the closest Euclidean distance to that cell's two triangles. The maximum is
**observed finite-sample deviation**, never a certified global bound, requested
tolerance or guarantee between samples. Uniform grids can miss high curvature.
The distance computation checks vertex/edge/face regions of each triangle.
Arithmetic failures return errors rather than silent clamping or substitutes.

`validatePreviewPacket(unknown)` and `copyPreviewPacket(unknown)` are exported.
They check the shared v0 fields, dense plain arrays and bounds before allocating
copied output: 4..4096 vertices, 2..7938 triangles, matching XYZ/UV lengths,
finite values, XYZ magnitude at most 1e6 mm, unit normals within 1e-5, valid
nonrepeated indices, positive-area CCW triangles, and exact position bounds.
Winding must agree with each of a triangle's vertex normals. Unsupported fields,
versions, units or conventions fail. Typed arrays, subclasses, sparse arrays,
accessor properties and non-plain metadata are rejected. Host getters are not
called. JavaScript Proxy reflection traps remain the host's responsibility.
Each returned packet owns its arrays and bounds. Callers retain input ownership.

`examples/cad-nurbs/preview-flat-packet.json` is a deterministic asymmetric plane
literal for independent GPU replay; its matching source is `preview-flat.css`.
`preview-weighted.css` is a rational nonplanar fixture. Packed-consumer checks
invoke tessellation from an actual extracted ESM/types package and retain source,
native model, IGES, samples, packet, report, revision, task SHA and SHA-256 hashes.
Default preview evidence is the isolated test environment's `evidence-502/preview`.
`BAROCSS_CAD_PREVIEW_EVIDENCE` changes that path. Set `BAROCSS_CAD_AUDIT_EVIDENCE`
for retained independent dense audit JSON from unit tests; its extra non-probe
samples are reported separately, not folded into the API's fixed five probes.

The existing OCP test remains mandatory and proves the IGES path. When checking
this task, set `BAROCSS_CAD_EVIDENCE` to `evidence-502/iges` to preserve the original
#500 files. No preview normals/triangles replace native curves/surfaces or their
exchange evidence. No pixel, GPU consumer, watertight-solid, manufacturing or
certified-tolerance result is implied by this independent CAD stage.
