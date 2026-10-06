# @barocss/cad (private experiment)

CSS-shaped model source becomes native rational B-spline geometry and ASCII IGES.
This package contains an original parser, local basis evaluator and writer. It has
no runtime dependencies. OCP is an independent test consumer, never a product kernel.
The private package is not registered for release or publication.

```js
import { compileCadModel, evaluateCurve, exportIGES } from '@barocss/cad';
const compiled = compileCadModel(source, { sourceVersion: 0 });
if (!compiled.ok) throw new Error(compiled.diagnostics[0].message);
const model = compiled.model;
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

`compileCadModel` returns source-associated diagnostics on invalid input. Ranges
use exclusive UTF-16 offsets and one-based line/column coordinates. A failure
contains no partial AST, IR or model. Native geometry APIs throw on invalid
geometry or requests. No failed geometry is clamped or substituted.

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

`compileCadModel(source, { sourceVersion: 1 })` accepts version 1 source. It accepts
the existing curve blocks plus `@extrude #wall { curve: #arc; vector: [0,0,30]; }`.
The required model fields are `version: 1; length-unit: mm;`. All IDs are unique
across at most 16 declarations, with the same 256 KiB source bound. Curve references
can point forward. Missing references and references to extrusion outputs fail.
Native objects retain declaration order. A curve-only model is accepted.
Other geometry blocks, operations, expressions and executable forms fail.
Selecting sourceVersion 0 rejects construction declarations.

The successful result includes `ast`, `ir`, `model` and `constructions`.
`ir.sourceVersion` is 1 and `model.version` is 0. Each construction retains
`outputId`, `inputId`, `operation: 'extrude'`, `vector`, declaration `span` and
`referenceSpan`. Diagnostics use actual source ranges. Source version, IR schema
version, native geometry version, preview packet version and exchange format
version are separate values.

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

## Structured source compiler

`compileCadModel(source, { sourceVersion: 0 | 1 | 2 })` selects the existing source
dialect explicitly. The declared `version` must match that selection. This API
preserves the original v0/v1 dialects. Source v2 adds the bounded parameter and expression forms described below.

```js
import { compileCadModel, exportIGES } from '@barocss/cad';
const result = compileCadModel(source, { sourceVersion: 1 });
if (result.ok) {
  const { ast, ir, model, constructions } = result;
  const artifact = exportIGES(model, ['wall']);
  // The host owns file selection, storage and rendering.
} else {
  console.log(result.diagnostics[0]);
}
```

Success is `{ ok: true, ast, ir, model, constructions, diagnostics: [] }`.
Failure contains only `{ ok: false, diagnostics }`; it exposes no partial model.
Each diagnostic has `code`, `severity: 'error'`, `message`, source `range` and an
optional owning `objectId`. Ranges use exclusive UTF-16 `start`/`end` offsets and
one-based `line`, `column`, `endLine` and `endColumn`. At least the first useful
error is returned. This slice does not provide general error recovery.

The parser records the actual model name, ordered fields and declarations,
numbers, arrays, identifiers and references with their original source ranges.
It calls no geometry evaluator or construction operation. The semantic stage
resolves IDs and curve dependencies, validates native literal geometry and
preflights every extrusion before lowering any derived geometry. Forward curve
references retain source declaration order. Lowering calls the original native
extrusion operation and emits the unchanged geometry `Model` version 0.

The own IR is `{ schema: 'barocss-cad-ir', schemaVersion: 1, sourceVersion,
name, lengthUnit: 'mm', nodes, dependencies }`. Literal nodes contain typed
original geometry, source span and field types. Extrusion nodes retain output
ID, curve input ID, vector, declaration span and reference span. Dependencies
are explicit `curve-input` edges. Degrees are integers; points and vectors use
millimetres; knots and weights are dimensionless. No export schema or file
pointer defines native IR semantics. Export adapters consume validated native
output separately. The returned IR is data; no public API adopts it as a
validity cache or executable feature registry.

AST, IR, model and constructions own every nested occurrence independently.
Copies preserve binary64 values and negative zero. Mutating one result cannot
change another output or a later compilation. Compiler options must contain
exactly one own enumerable data property, `sourceVersion: 0`, `1` or `2`, on a plain
or null-prototype record. Accessors, foreign options and export target/profile
options fail without invoking getters. `compileCadModel` is the single source compiler entry point. There is no
separate compatibility parser, historical error replay or virtual source wrapper.

The 256 KiB source and native geometry limits remain unchanged. The parser
checks UTF-8 size before AST allocation, array dimensions/counts before each
push, and caps allocation at 65,536 value/AST nodes and 131,072 tokens. Depth is
at most three and declaration count is at most sixteen. The maximum legal
sixteen 16×16 surface fixture uses 21,810 values, 21,941 AST nodes and 43,949
tokens. Whitespace and comments remain bounded by source bytes. The AST limits
include source metadata and are separate from native topology snapshot limits.

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
All current construction, derivative, preview and exchange gates remain mandatory.

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
override or runtime kernel is added. All current gates remain mandatory.

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

## Named parameters and expressions in source v2

`compileCadModel(source, { sourceVersion: 2 })` uses the same compiler phases.
Source v2 accepts the current curve, surface and extrusion declarations plus at
most 64 `@parameter` declarations. Parameters do not count as native geometry
objects; the native output remains Model-v0 with at most sixteen objects.

```css
@model driven {
  version: 2;
  length-unit: mm;
  @parameter #width { type: length; value: 10 cm; }
  @parameter #height { type: length; value: $width / 2; }
  @parameter #scale { type: scalar; value: 2; }
  @curve #profile {
    type: nurbs; degree: 1; knots: [0,0,1,1];
    control-points: [[0,0,0],[$width,0,0]]; weights: [1,1];
  }
  @extrude #wall { curve: #profile; vector: [0,0,$height * $scale]; }
}
```

The profile endpoint and extrusion height are 100mm. Changing width to 12cm
recompiles both values to 120mm. IDs and native output order remain stable.
Parameter IDs use `[A-Za-z_][A-Za-z0-9_]*`; geometry IDs retain their existing
rules. All IDs are globally unique. `$name` references a parameter; `#name`
references geometry. Forward references are supported. Complete parameter
reference and cycle checks run before quantity evaluation or native lowering.

Expression leaves use finite unsigned decimal literals with optional `mm`,
`cm` or `m` units, `$references`, unary signs, arithmetic and parentheses.
Unary sign has highest precedence, then multiplication/division, then
addition/subtraction. Binary operations are left associative. Parameters have
`length` or `scalar` type. Length values normalize to millimetres; scalar values
are dimensionless. Addition/subtraction requires equal types. Multiplication
requires at least one scalar. Division supports scalar/scalar, length/scalar
and length/length. Scalar divided by length and products of two lengths are unsupported.
Division by either signed zero fails. Every literal and evaluated intermediate
must be finite and have absolute value at most 1e12. No epsilon or clamping is
applied.

Coordinate and vector expressions require length; knots and weights require
scalar; degrees require scalar integers and existing native degree bounds.
A single bare decimal with signs/parentheses retains the literal-mm shorthand
in coordinate/vector fields. This rule does not turn a scalar parameter or a
compound scalar expression into length. For example, `$width/2` and
`1mm+2mm` are lengths, while a coordinate expression `1+2` is rejected.
Parameters themselves receive no implicit units. Functions, exponent literals,
member/index access, interpolation, imports and source execution are rejected.

Source v2 emits `barocss-cad-ir` schemaVersion2, sourceVersion2. Its root keeps
name, mm units, numeric geometry nodes and dependencies, and adds authored-order
`parameters` and field/index-order `bindings`. Each parameter retains its typed
normalized value, original ranged expression and declaration span. Each binding
retains owning object ID, field/indices, expression, resolved value/type/span and
all parameter reference occurrences. Dependencies preserve every reference
occurrence, including duplicates, in source order. Expression AST, parameters,
bindings, native objects and construction records own independent data.
Source v0/v1 still emit schemaVersion1 and retain their original behavior.

Limits per expression are 256 nodes and depth32, including unary/group/binary
nodes. Aggregate expression nodes are at most32,768. Every expression node also
counts toward the shared 65,536 AST node/value and 131,072 token limits. Source
remains bounded at256KiB. Counts/depth are checked before further parser growth;
evaluation uses a bounded dependency order and memoized expression values.
No public override/cache/IR-ingestion API is added. Recompile the edited source.

Parameter source2 examples feed actual packed ESM/types and independent IGES
read-back checks through the existing consumer/exchange commands. Set
`BAROCSS_CAD_PARAMETER_EVIDENCE` to a fresh directory for the exact committed
HEAD. The current project-v1 example envelope supports source0/1 only; source2
project saving, parameter UI and history require their own document/host work.

## Bounded XY profile builders

`buildXYProfile(request)` creates one original source0/native Curve:

```js
import { buildXYProfile, exportIGES } from '@barocss/cad';
const line = buildXYProfile({ kind: 'line', id: 'edge', points: [[0, 0], [120, 0]] });
const rectangle = buildXYProfile({ kind: 'rectangle', id: 'outline', origin: [4, -3], width: 7, height: 5 });
const artifact = exportIGES(rectangle.model, ['outline']);
```

Requests use exactly one plain own-data shape. Line requires two XY points.
Polyline requires2..64 points in their original order, with different first/last
positions. Rectangle requires an XY origin and positive width/height. IDs are
supported native ASCII identifiers within128 characters. All coordinates are
finite millimetres within±10000. Rectangle dimensions are0.001..10000mm;
computed corners also satisfy coordinate bounds. Each actual binary64 adjacent
segment must be at least0.001mm. Rounded/short/coincident segments fail without
snapping or epsilon. A crossing open polyline is not rejected as a region:
this API supplies an uncertified curve, not a simple-region validator.

Return fields are `{ source, sourceVersion: 0, model, curve, report }`. The
fixed generated current source contains round-trippable plain decimal literals,
including signed zero and tiny scientific-form binary64 values. The actual
`compileCadModel` source0 output is authoritative. Model and curve have separate
owned arrays; caller data and previous results are preserved. Getters, symbols,
foreign prototypes, sparse arrays and extra fields fail before compilation.
Snapshots have at most1024 values,depth4 and64-entry arrays.

Every curve has degree1, unit weights and poles `[x,y,0]`. WithN poles, its
original parameter domain is `[0,N-1]` and knots are
`[0,0,1,...,N-2,N-1,N-1]`. A span between consecutive vertices is a native
linear segment; its parameter derivative is that segment vector. Public D1
rejects exact internal C0 knots and accepts span interiors and global endpoints,
using the existing original derivative rules. No seam smoothing or periodic
curve is produced.

The rectangle has five fresh poles in CCW order:
`[x,y]`, `[x+w,y]`, `[x+w,y+h]`, `[x,y+h]`, `[x,y]`. Report fields are kind,
plane:`xy`,lengthUnit:`mm`,vertexCount,segmentCount,parameterDomain:{min,max},
endpointClosed,regionCertified:false,solid:false. Endpoint closure is true only
for rectangle. Equal endpoints do not certify a topological wire, planar region
or solid. The existing IGES126 adapter still writes general/open/nonperiodic
flags; this helper does not redefine them.

The profile packed consumer and independent actual-byte reader run through the
existing consumer/exchange commands. Set `BAROCSS_CAD_XY_PROFILE_EVIDENCE` to
fresh exact-head evidence. Sketch UI, workplane snapping/document/history,
constraints and curve rendering remain separately scoped features.

## Rational XY quarter arcs and circles

`buildXYArc(request)` creates one original source0/native rational Curve:

```js
import { buildXYArc, exportIGES } from '@barocss/cad';
const quarter = buildXYArc({ kind: 'quarter-arc', id: 'arc', center: [0, 0], radius: 10, quadrant: 0 });
const circle = buildXYArc({ kind: 'circle', id: 'rim', center: [4, -3], radius: 10 });
const file = exportIGES(circle.model, ['rim']);
```

A quarter request has exactly `kind`, `id`, `center`, `radius` and `quadrant`.
A circle omits `quadrant`. ID and strict own-data snapshot bounds match the XY
profile builder. Center and every computed pole use finite XY millimetres
within±10000; radius is0.001..10000mm and local quarter poles remain distinct.
Ordinary binary64 addition computes translated poles. There is no coordinate
snapping, angle fitting or radius clamping. Unsupported planes, angles,
clockwise orientation and foreign options fail.

Quarters run CCW in quadrants0..3. Each has degree2, three poles,
weights`[1,Math.SQRT1_2,1]`, knots`[0,0,0,1,1,1]` and original domain`[0,1]`.
A circle joins all four quarters: nine poles, alternating unit/diagonal weights,
knots`[0,0,0,1,1,2,2,3,3,4,4,4]` and domain`[0,4]`. Shared quarter endpoints
occur once inside the pole list; the last pole repeats the first coordinates
in a fresh array. These are rational control poles, not a polygonal sample.

A span parameter is the original rational-quadratic parameter, not a linear
angular coordinate. Circle spanq uses`u=q+t`. Public D1 still rejects exact
interior knots1/2/3 under the existing degree/multiplicity C0 rule; point queries
at those knots work and global endpoints keep one-sided D1. The builder makes
no G1/C1, periodicity or smooth-seam certificate.

Return is `{ source, sourceVersion: 0, model, curve, report }`. Common bounded
source formatting and actual compiler adoption preserve profile source bytes.
Each model/curve/report occurrence owns data independently. Report keeps
provided `centerMM` bits (including signed zero), `radiusMM`, `startQuadrant`,
`spanCount`, `controlPointCount` and `parameterDomain`, plus `kind`, plane`xy`,
lengthUnit`mm`, `endpointClosed`, `periodic:false`, `regionCertified:false` and
`solid:false`. Endpoint closure is true only for circle and means coordinate
equality, not a closed wire/region/solid. Native representation remains
open-clamped/nonperiodic; IGES126 retains its existing general/open/nonperiodic
flags. No new native Curve type or export profile is introduced.

Actual packed runtime/types and independent authored-file reader cases run in
`test:consumer` and `test:exchange`. Set `BAROCSS_CAD_XY_ARC_EVIDENCE` to fresh
exact-head evidence. Interactive circle tools, curve rendering, project/history
and wider angular/periodic/trim scope are separate features.

## Parameter-bound rectangle solid extrusion

`buildAxisRectangleExtrusion(request)` creates a capped box from one canonical
XY rectangle and a positive Z distance:

```js
import { buildAxisRectangleExtrusion, compileCadModel, exportIGES } from '@barocss/cad';
const part = buildAxisRectangleExtrusion({
  bodyId: 'part',
  profile: { kind: 'rectangle', id: 'footprint', origin: [4, -3], width: 7, height: 5 },
  distance: 6,
});
// part.solidReport: volumeMM3 210, areaMM2 214.
const file = exportIGES(part.model, part.model.objects.map(object => object.id));
const edited = compileCadModel(
  part.source.replace('value:7mm;', 'value:8mm;'), { sourceVersion: 2 },
);
```

The request has exactly `bodyId`, `profile` and `distance`. The profile has exactly
`kind`, `id`, `origin`, `width` and `height`. Origin coordinates are integer mm.
Width, height and distance are integers in1..10000mm. Every represented box
corner must remain within±10000mm. Strict own-data validation rejects getters,
foreign prototypes, symbols, sparse arrays, unsupported fields and ID collisions.
The body ID is ASCII with at most80 characters; all derived IDs and the profile ID
have at most128 characters. Request snapshots use the existing1024-value,
depth4 and64-element array limits.

The result contains `source`, `sourceVersion:2`, native `model`, schema2 `ir`,
the original `profile`, six `faces`, `shell`, `solidReport` and `construction`.
The generated source has five length parameters: `_rect_ox`, `_rect_oy`,
`_rect_w`, `_rect_h` and `_rect_d`. Its actual compiler result contains the
input Curve and six outward degree1 planar Surfaces. Parameter declarations
do not count as geometric objects. Initial mm literals retain signed zero.
Each returned nested occurrence owns its data independently.

The original profile remains source0 with `regionCertified:false`. The shell
validator keeps its separate `solid:false` report. The solid report proves only
the existing `exact-axis-box-solid-v0` family. Construction metadata records
profile/body IDs, direction `[0,0,1]`, distance, parameter IDs and four original
profile ranges with their global edge IDs and forward/reverse senses. Interior
D1 and point comparisons verify those mappings. Exact C0 corner D1 still fails.

Manual parameter edits compile to new geometry. Build new FaceBundles and a
new AxisBoxShell from those compiled Surfaces, then call `validateAxisBoxSolid`
to prove that geometry. An8×5×6 edit has volume240mm³ and area236mm². The
original result cannot certify edited geometry. Noninteger edited geometry
can compile, but the integer box-family guard rejects it.

The selected IGES export contains one Curve126 and six Surface128 entities.
It does not serialize a closed solid or STEP body. `test:consumer` checks the
packed runtime and external TypeScript declarations. `test:exchange` reads
the original files with the installed independent reader and checks poles,
weights, domains, points, D1, outward normals and footprint associations. Set
`BAROCSS_CAD_RECTANGLE_EXTRUSION_EVIDENCE` to a fresh evidence directory. The
example is `examples/cad-nurbs/axis-rectangle-extrusion-demo.mjs`.

## Editable rectangle extrusion feature document

The native `barocss-axis-rectangle-feature` document v0 retains one XY rectangle,
five ordered length parameters and one positive-Z extrusion feature. It is
separate from source2, native Model0 and the application's project1 format.

```js
import { evaluateAxisRectangleFeatureDocument, editAxisRectangleFeatureDocument,
  serializeAxisRectangleFeatureDocument } from '@barocss/cad';
const accepted = evaluateAxisRectangleFeatureDocument(document);
const edited = editAxisRectangleFeatureDocument(accepted.document, [
  { parameterId: '_rect_w', valueMM: 8 },
]);
const json = serializeAxisRectangleFeatureDocument(edited.document);
const reopened = evaluateAxisRectangleFeatureDocument(JSON.parse(json));
```

The complete input example is
`examples/cad-nurbs/axis-rectangle-feature-document.json`. Its exact fields are
`format`, `version`, `id`, `lengthUnit`, `parameters`, `profile` and `feature`.
Parameters are the reserved `_rect_ox`, `_rect_oy`, `_rect_w`, `_rect_h`, `_rect_d`
in that order, each `{ id, type:'length', valueMM }`. The profile has `id`,
`kind:'xy-rectangle'`, and the four matching origin/size parameter references.
The feature has `id`, `kind:'axis-rectangle-extrude'`, matching `profileId`,
`bodyId` and `distance:'_rect_d'`. Runtime admission resolves these records and
references before generating geometry. Numeric values are mm, with the original
integer axis-box family restrictions. Document/feature/body IDs have at most80
ASCII characters; profile IDs have at most128. All are distinct from reserved
parameters and every deterministic derived geometry/topology ID.

Each input snapshot has at most512 own values, depth4, arrays of at most5
elements, records of at most8 fields and strings of at most128 characters.
Ordinary/null-prototype records and ordinary dense arrays are supported.
Accessors, symbols, nonenumerable/extra fields, foreign prototypes, malformed
references and reordered/missing parameters fail without geometry adoption.
Diagnostics carry document/feature identity and the offending input path.
These local budgets do not alter parent builder or compiler limits.

Evaluation returns exactly `{ document, evaluation, bindings }`. Evaluation
is the actual `buildAxisRectangleExtrusion` result: source2/compiler IR2/native
Model0/profile/six FaceBundles/shell/fresh solid report. Bindings name the actual
document, feature, profile, output body and five parameters; the actual source2
IR values and construction references are checked before success. Every nested
output occurrence owns its data independently of inputs and previous results.

Edits accept1..5 exact `{ parameterId, valueMM }` records. Duplicate/unknown
parameters fail. All edits are prepared in one owned candidate and its completed
geometry is evaluated once. No intermediate geometry is adopted. A failed edit
throws and leaves caller/prior source, IR, topology and report unchanged. Width8
on the example produces volume240/area236; a subsequent distance10 edit produces
volume400/area340. IDs and semantic box roles remain stable within this family.
There is no global accepted state or implicit history stack.

Serialization validates the complete document/family and writes authoring data
only, in canonical key order, with a lossless decimal number encoder preserving
`-0`. Output is deterministic ASCII JSON of at most8192 UTF-8 bytes. Actual
`JSON.parse` and reevaluation reconstruct the same native identities/values.
Source/IR/meshes/reports/file pointers are never persisted as authoring proof.
This API supplies no arbitrary-text loader or duplicate-key/migration/GUI file
admission policy. Multiple features/bodies, general constraint graphs, topology
splits/merges, source3 grammar and current project migration remain separate.

`test:consumer` uses the actual built archive and external TypeScript.
`test:exchange` reads original initial/edited/reopened selected Curve126/Surface128
files and checks original geometry, normals, domains and identity associations,
with corrupt-file controls. Set `BAROCSS_CAD_RECTANGLE_FEATURE_EVIDENCE` to fresh
exact-head evidence. The files contain separate curve/surface geometry, not a
whole-solid interchange or feature history.

## Bounded XY linear sketch constraints

`solveXYLinearSketch(document)` solves one original
`barocss-xy-linear-sketch` document v0. The complete example is
`examples/cad-nurbs/xy-linear-sketch.json`. It contains `format`, `version`,
`id`, `lengthUnit:'mm'`, `points`, `segments` and `constraints`. Points are
`{ id, position:[x,y] }`; segments are `{ id, startPointId, endPointId }`.

```js
import { solveXYLinearSketch } from '@barocss/cad';
const result = solveXYLinearSketch(document);
if (result.ok) {
  console.log(result.report.degreesOfFreedom, result.solution.model);
} else {
  console.log(result.diagnostics);
}
```

The supported constraints are exactly `{ id, kind:'horizontal', segmentId }`,
`{ id, kind:'vertical', segmentId }`,
`{ id, kind:'coincident', pointA, pointB }`, and
`{ id, kind:'fixed', pointId, target:[x,y] }`. The sketch has2..16 points,
1..8 segments and0..32 constraints. Coordinates/targets are finite XY mm
within±10000. Every point belongs to a segment; segment endpoint and coincidence
references name distinct points. Document IDs have at most80 ASCII characters;
all point/segment/constraint IDs have at most128. All IDs are globally distinct.
All references resolve before any constraint solving or native geometry work.

Admission snapshots the entire input once, with512 own values, depth4, arrays32,
records8 and strings128. Ordinary/null-prototype records and ordinary dense
arrays are accepted. Getters are never evaluated. Foreign prototypes, symbols,
hidden/extra fields, sparse arrays and invalid references/counts fail atomically.
Parent builder/compiler budgets and source dialects remain unchanged.

Each allowed equation identifies two scalar coordinates or pins one coordinate.
Horizontal joins Y; vertical joins X; coincidence joins both; fixed anchors both.
Anchors compare with exact numeric equality: distinct close values conflict,
while +0/-0 agree. The first fixed target in input order determines a compatible
zero anchor's representation. A free component uses the arithmetic mean of its
original seeds, summed in original point order starting with the first seed.
Singleton seeds retain their exact bits, including -0. Members receive one
identical value, so represented equation residuals are exactly0.

Remaining unanchored scalar components count as degrees of freedom. Rank is
2N minus DOF; fullyConstrained is exactly DOF0. Constraints are processed in
input order. A constraint is redundant only if it adds no independent scalar
condition; one redundant axis does not make a two-axis constraint redundant.
Conflict diagnostics include the actual component anchors/equalities in input
order, without unrelated components. Minimal irreducible conflict sets are not
claimed. No iterative/nonlinear/general matrix solver is introduced.

Success is `{ ok:true, document, solution, report }`. The document retains
authoring seeds; solution.points retain point IDs/order with derived positions.
Actual solved segments become original `buildXYProfile` lines, then one complete
source0 is compiled through `compileCadModel`. Native Model0 contains the same
1..8 degree1/two-pole/unit-weight Curves in segment order, original domain0..1,
and schema1 IR. Every nested returned occurrence owns its data independently.
A horizontal line from seedsA(0,1),B(4,3) solves toA(0,2),B(4,2), rank1/DOF3.
Adding fixedA(0,5) producesA(0,5),B(4,5), rank3/DOF1.

Failure is exactly `{ ok:false, diagnostics }`, with bounded `code`, `message`,
`path` and `constraintIds`. Codes distinguish INVALID_DOCUMENT, UNSUPPORTED,
LIMIT, REFERENCE, CONFLICT, DEGENERATE_GEOMETRY and COMPILATION. Collapsed or
sub0.001mm solved segments fail; initially invalid-length seeds may still solve
to valid lines. No partial source/Model/report or caller/prior result mutation
is adopted. The API has no global state, history stack or new file loader.

Native/packed/external TypeScript tests include independent exact rational
matrix-rank and incremental redundancy controls. `test:exchange` reads actual
selected IGES126 line files and independently checks equations, coefficient/
augmented matrix ranks, domains, IDs, points and D1, with corrupt-pointer/readable
shifted-geometry controls. Set `BAROCSS_CAD_LINEAR_SKETCH_EVIDENCE` to fresh
exact-head evidence. This adds no GUI, driving distances/angles/radii/tangency,
source syntax/project admission, region/wire/solid certificate or history export.

## Anchored signed XY driving dimensions

The same `solveXYLinearSketch` API accepts `XYLinearSketchDocumentV1`. Its
format, points, segments, original constraints, IDs/units and admission bounds
match document v0. Version1 adds exactly `{ id, kind:'distance-x', pointA,
pointB, distanceMM }` and the analogous `distance-y` record. The signed relation
is B.x-A.x or B.y-A.y, not Euclidean line length. Targets are integer mm in
[-10000,10000], including0/-0. References name distinct admitted points.

```js
import { solveXYLinearSketch } from '@barocss/cad';
const initial = solveXYLinearSketch(document);
const candidate = structuredClone(document);
candidate.constraints.find(c => c.kind === 'distance-x').distanceMM = 8;
const edited = solveXYLinearSketch(candidate);
// Example endpoints: A(0,0), B(8,0), with actual source0/native D1[8,0,0].
```

The complete document is `examples/cad-nurbs/xy-axis-dimensions.json`.
Positive7 gives B(7,0);8 gives B(8,0); negative7 gives B(-7,0), preserving
point/segment IDs and endpoint order. A rectangle with width7/height5 becomes
width8/height5 by changing its actual driving target. New native geometry,
source and reports are recomputed; the prior result remains independently owned.

Complete reference/data admission precedes relative affine-cycle checks. Every
final scalar component containing a distance record needs a fixed target on
that axis; every fixed target on that axis must be integer. Missing anchors or
fractional fixed-axis targets return UNSUPPORTED. A fixed anchor declared after
the dimension is valid. Unrelated components with no distance preserve old
floating seed means/anchors and exact close-target conflicts. No centroid
rounding, fuzzy residual tolerance or arbitrary free-floating offset placement
is performed. Relative cycles are checked before anchor-family admission,
then exact fixed-anchor consistency and final bounded geometry are checked.

Relative potentials use exact safe-integer offsets bounded by310000mm. Solved
distance-component coordinates must be safe integers within±10000mm. Compatible
zero anchors retain the first fixed representation; zero relative displacement
copies that value without unnecessary +0 addition. Inconsistent offset cycles
return CONFLICT even when unanchored. Relevant equality/dimension/anchor IDs
are reported without unrelated scalar components. Chronological whole/partial
redundancy and rank/DOF follow actual independent scalar conditions.

V1 reports add authored-order `dimensions`: `{ id, axis:'x'|'y', pointA, pointB,
requestedMM, actualMM }`. Requested values retain authoring bits, including -0.
Actual values are computed from returned solved endpoints and agree numerically
exactly; actual zero may have a different sign. V1 without dimensions matches
V0 source/geometry/rank/diagnostics and adds only dimensions[]/document version.
V0 types/reports keep their original members and no dimensions field; V0 rejects
new distance kinds. The former unsupported-version1 test now targets unsupported
version2 because1 is explicitly admitted.

Native sourceVersion remains0, geometry Model0 and compiler IR1. Document1 is
a separately versioned native input, not source1 or application project1. Actual
profile/source compiler adoption and the0.001mm line minimum remain unchanged.
Failures return diagnostics only, without partial geometry or prior-state
mutation. Additive public types are XYLinearSketchConstraintV1,
XYLinearSketchDocumentV1, XYLinearSketchResultV1 and XYLinearSketchDimensionReport.

Packed runtime/external TypeScript and independent exact rational coefficient/
augmented/prefix-rank tests cover edits, signed/zero targets, cycles, late pins,
restricted family and V0 parity. `test:exchange` reads original initial/edited
IGES126 files, computes distances from reader endpoints and checks points/D1,
IDs/domains/units and original equations, with pointer/length/endpoint corrupt
controls. Set `BAROCSS_CAD_AXIS_DIMENSION_EVIDENCE` to fresh exact-head evidence.
Interactive tools, fractional/unanchored dimensions, nonlinear distance/angle/
radius/tangent constraints and source/project/wire/region/solid/history-export
extensions remain separately scoped.

## Exact simple XY polygon regions

`buildXYPolygonRegion({ id, points })` creates one original closed-coordinate
degree1 Curve and certifies its simple integer XY mathematical region.
`validateXYPolygonRegion(curve)` separately validates that canonical Curve
family. The input example is `examples/cad-nurbs/xy-polygon-region.json`.

```js
import { buildXYPolygonRegion, validateXYPolygonRegion } from '@barocss/cad';
const polygon = buildXYPolygonRegion({ id: 'triangle', points: [[0,0],[3,0],[0,3]] });
// polygon.region.areaMM2 === 4.5; parameter domain0..3.
const region = validateXYPolygonRegion(polygon.curve);
```

Input has exactly `id` and3..63 distinct integer XY points within±10000mm,
in authored order, without repeating the first endpoint. The ASCII ID has at
most128 characters. A fresh closing pole repeats the first coordinates, with
degree1, unit weights, uniform clamped knots and original domain0..N. Actual
source0 compiles through the existing compiler; sourceVersion remains0 and
native Model0 contains only that Curve. Signedzero coordinates are preserved;
geometric duplicate/closure predicates treat+0/-0 as the same location.

Both APIs snapshot bounded own data:4096 values/depth4/arrays70/records8/
strings128. Getters/symbols/hidden/extra fields, foreign prototypes, sparse
arrays and unsupported families reject. The validator requires4..64 poles,
canonical knots, integer XY/Z0, unit weights, degree1 and exact endpoint closure.
It accepts an existing integer rectangle Curve without changing the original
profile's regionCertified:false report or global Curve validation semantics.

Every segment pair is checked by exact bounded integer orientation/on-segment
predicates. Nonadjacent crossings, touches and overlaps reject. Adjacent edges
may share only their common vertex; forward collinear continuation is retained,
while backtracking overlap rejects, including the cyclic first/last pair.
Shoelace signed area is computed only afterward, with explicit safe arithmetic
bounds. Clockwise order is preserved and returns negative signedAreaMM2;
areaMM2 is positive. Concave L area is7; forward-collinear rectangle area is8.
No epsilon, snapping, healing or sampling-based simplicity decision is used.

The region report includes orientation, vertex/segment counts, original domain,
signed/absolute area, XY bounds and every original span/vertex-index association.
It has regionCertified:true only for exact-simple-integer-xy-polygon-v0, with
topologicalWire:false, face:false and solid:false. It constructs no B-Rep wire,
trimmed face, cap or body and accepts no holes/multiple rings. Existing C0 D1
refusals remain. IGES126 retains its general/open/nonperiodic flags even when
coordinates close. Every output occurrence owns data; malformed input throws
a bounded contextual Error without partial region adoption or caller mutation.

Run the native prototype:

```sh
node examples/cad-nurbs/xy-polygon-region-demo.mjs examples/cad-nurbs/xy-polygon-region.json /tmp/polygon-region-demo
```

Native/packed/typed/independent-reader control scripts are prepared in the
existing test:consumer/test:exchange drivers for later verification. Under the
current prototype policy, the completion gate is affected-package build plus
a short actual positive/rejection smoke; broader validation is deferred.

## Filled XY polygon preview packets

`tessellateXYPolygonRegion(curve, { meshId, revision })` converts an actual
validated integer polygon region into the existing PreviewPacket0. Options are
exact own-data fields; meshId is bounded ASCII and differs from the source
Curve ID, revision is an integer0..2147483647. The curve/options are snapshotted
before use, and actual region validity is recomputed rather than trusting a report.

```js
import { buildXYPolygonRegion, tessellateXYPolygonRegion } from '@barocss/cad';
const native = buildXYPolygonRegion({ id:'triangle', points:[[0,0],[3,0],[0,3]] });
const preview = tessellateXYPolygonRegion(native.curve, { meshId:'triangle_mesh', revision:1 });
```

Original boundary positions/order are preserved. A separate CCW working index
order clips strictly positive exact integer ears containing no other active
vertex inside or on their closed triangle. Concave regions and original
collinear boundary vertices are retained. Attempts are bounded; failed/collapsed
generated geometry throws instead of adopting a partial packet.

N>=4 uses N vertices/N-2 triangles. Triangle3 adds one deterministic display
centroid to meet the existing four-vertex packet minimum and emits three
positive-Z triangles. No packet schema/minimum change is made. Normals are+Z,
units stay mm/right-handed-y-up/ccw and bounds come from actual output positions.
The completed actual packet passes the original native packet validator.

The report names source Curve/derived mesh/revision, source/output counts and
each curve index/original parameter or triangle-centroid source. UV is the
explicit affine XY bounding-plane map, with origin/uAxis/vAxis; it is not a
Curve parameter or authored NURBS Surface domain. The derived packet surfaceId
contains meshId and must not be treated as a source Surface/project/export ID.
Packet/region/report occurrences own data independently. Report retains
certified:false, face:false and solid:false; this creates display geometry,
not a B-Rep trimmed face, cap interchange or solid.

Run the real prototype:

```sh
node examples/cad-nurbs/xy-polygon-preview-demo.mjs /tmp/barocss-polygon-preview-prototype
```

It invokes the actual region builder and tessellator for triangle/L profiles,
writes source/Curve/packet/report files, checks counts/positive winding/area
and missing-quadrant behavior, retains CW source order, and prints a crossed
region rejection. Prototype completion uses affected CAD build plus this short
real demo. Broader unit/rational/raster/reader/compatibility verification is
deferred; actual GPU consumption is a separate integration step.

## Capped XY polygon prism preview

`buildXYPolygonPrismPreview({ bodyId, profile, distanceMM, revision })` builds
actual top/bottom cap triangles and outward flat side quads from the original
validated XY region and polygon tessellator. The canonical Curve is retained
unchanged; CW order is preserved while packet winding follows outward normals.

```js
import { buildXYPolygonRegion, buildXYPolygonPrismPreview } from '@barocss/cad';
const profile = buildXYPolygonRegion({ id:'L', points:[[0,0],[4,0],[4,1],[1,1],[1,4],[0,4]] });
const prism = buildXYPolygonPrismPreview({ bodyId:'part', profile:profile.curve, distanceMM:6, revision:1 });
// prism.report.volumeMM3 === 42; areaMM2 === 110.
```

The request contains exactly those four fields and strict own bounded data.
bodyId is ASCII1..80, distinct from source/derived role IDs; revision is
integer0..2147483647. Positive integer distance1..10000 extrudes fromZ0 in+Z,
with every generated position within±10000mm. Curve/options/report caches are
not accepted as geometry proof. The original region is recomputed and the
actual existing polygon preview supplies its caps.

Bottom cap triangles reverse toward-Z, top triangles face+Z. Each actual
boundary segment adds four hard-normal vertices and two outward triangles.
The cap's triangle centroid remains a display vertex. Counts remain bounded
by378 vertices/248 triangles; a triangular prism uses20 vertices/12 triangles.
The original PreviewPacket0 validator checks the completed native mm/y-up/ccw
packet. surfaceId is derived bodyId+'_preview', not an authored Surface ID.

Return is `{ profile, region, packet, construction, report }`, with every
nested occurrence independently owned. Construction records the actual Curve/
body IDs, +Z direction and distance. Report includes cap/side vertex and index
ranges (exclusive ends), normals, cap-plane/side-segment affine UV axes,
original segment parameter ranges, bounds and source/output counts. Caps retain
the actual polygon-preview vertex-source records; sides mapu along the original
segment andv along extrusion.

Volume is region.areaMM2*distance; area is2*region.areaMM2 plus original boundary
perimeter*distance. Perimeter/area use explicit floating arithmetic. Report
closedMesh:true describes generated geometric closure with duplicated vertices
for hard normals; topologyCertified:false and solid:false remain truthful.
This creates no generic B-Rep wire/trimmed cap/kernel solid or STEP/whole-solid
IGES certificate, and leaves axis-box/FaceBundle validators unchanged.

```sh
node examples/cad-nurbs/xy-polygon-prism-demo.mjs /tmp/barocss-polygon-prism-prototype
```

The real demo invokes native region construction and prism assembly for L and
triangle profiles atdistance6, checks metrics/bounds/CW source retention and
zero-distance rejection, and writes actual source/Curve/region/packet/role data
for GPU consumption. Completion uses affected build plus this short real run.
Broad tests/readers/raster/parity/resource validation remain deferred.

## Editable polygon-prism intent document

The native `barocss-xy-polygon-prism-feature` document0 owns one polygon profile
and one prism-preview feature. Exact fields are `format`, `version`, `id`,
`lengthUnit:'mm'`, `profile:{id,kind:'xy-polygon',points}` and
`feature:{id,kind:'xy-polygon-prism-preview',profileId,bodyId,distanceMM}`.
Document/feature/profile/body IDs are distinct ASCII1..80, including every
actual derived prism role ID. Integer/simple XY and positive height restrictions
remain those of the original region/prism constructors.

```js
import { evaluateXYPolygonPrismDocument, updateXYPolygonPrismDocument,
  serializeXYPolygonPrismDocument, parseXYPolygonPrismDocument } from '@barocss/cad';
const initial = evaluateXYPolygonPrismDocument(document, { revision:1 });
const changed = updateXYPolygonPrismDocument(initial.document, { distanceMM:8 }, { revision:2 });
const reopened = parseXYPolygonPrismDocument(serializeXYPolygonPrismDocument(changed.document));
const fresh = evaluateXYPolygonPrismDocument(reopened, { revision:3 });
```

Evaluation resolves actual profile references, calls the original region builder
and prism preview, and checks construction IDs/height. Result contains owned
document/evaluation/bindings; evaluation retains original source/Model, actual
profile/region/prism and the actual packet. Every nested occurrence owns data.
It does not recover intent from triangles or introduce another source compiler.

Updates accept at least one exact `points`/`distanceMM` edit. All edits are
prepared in one owned candidate, then the complete candidate is admitted and
evaluated before returning. Stable authoring IDs remain. Failed crossing/zero
height/mismatched reference edits throw bounded document/feature errors and
never mutate caller or prior accepted source/packet. Winding and forward
collinear vertices are preserved; this is one feature, not a general graph.

Serialization writes canonical ordered intent fields only, using lossless native
decimal spelling including -0. No source/IR/geometry/packet/metrics/camera/proof
is stored. Revision belongs only to display options. Parse accepts at most128KiB
UTF-8 JSON and rebuilds through actual constructors before returning owned intent.
A bounded admission scan before JSON.parse rejects duplicate decoded object keys,
overdeep containers, excessive arrays/fields and oversized strings.
Own snapshots bound4096 values/depth4/arrays70/records8/strings128 and reject
foreign/accessor/sparse/hidden/extra/malformed data before adoption. This new
native file format does not migrate the application's existing project files.

```sh
node examples/cad-nurbs/xy-polygon-prism-document-demo.mjs /tmp/barocss-polygon-prism-document-prototype
```

The real demo evaluates L atheight6 (42/110 volume/area), height8 (56/142),
profile replacement4x3 atheight8 (96/136), intent Save/Open and fresh reedit,
plus CW/signedzero and actual invalid-edit retention. Affected build and this
short native run are the prototype gate; broader suites remain deferred.

## Original XY polygon planar trim face

`buildXYPolygonPlanarFace(profile,{faceId})` builds a distinct native
`XYPolygonPlanarFaceBundle` with actual Model0 geometry and explicit trim-loop
incidence. Input is the existing canonical integer polygon Curve, narrowed to
3..12 vertices. Geometry holds the unchanged source Curve, one actual degree1
unit-weight bounding-plane Surface and N authored-direction edge Curves.
The N+2 object count stays within the existing Model0 maximum16.

```js
import { buildXYPolygonRegion, buildXYPolygonPlanarFace,
  classifyXYPolygonPlanarFacePoint } from '@barocss/cad';
const source = buildXYPolygonRegion({ id:'L', points:[[0,0],[4,0],[4,1],[1,1],[1,4],[0,4]] });
const face = buildXYPolygonPlanarFace(source.curve, { faceId:'L_face' });
const notch = classifyXYPolygonPlanarFacePoint(face.bundle, [2,2,0]); // outside
```

Bundle fields are exactly geometry/topology. Topology records version0, kind
xy-polygon-planar-face, sourceCurveId, face, vertices, edges and loop. The face
names actual Surface/outer-loop IDs with forward orientation. Edge records
retain authored vertex IDs, source segment indices/ranges and actual unit-domain
line Curves. Directed loop uses areCCW/+Z; CW source stays unchanged but runs
reverse edge order/sense. Pcurve UV endpoints follow that directed use over the
actual U-major bounding Surface. No natural-boundary name or cap triangle is
substituted for a trim edge. Face/source/derived IDs are bounded and distinct.

`validateXYPolygonPlanarFaceBundle(bundle)` snapshots8192 own values/depth10/
arrays128/records16/strings128, validates actual native geometry and source
region, reconstructs canonical family and checks all Surface/Curve/vertex/
reference/loop/sense/pcurve data, directed incidence and finite affine bindings.
Changed pcurves/endpoints reject. The report declares incidence/trim-family
status, geometricValidity:not-certified, topologyCertified:false, solid:false.
Old four-natural-boundary FaceBundle0 remains unchanged and distinct.

`classifyXYPolygonPlanarFacePoint(bundle,pointMM)` validates first, then uses
exact safe-integer winding/on-segment predicates over actual source boundaries,
not display triangles. Queries are integer XY within±10000 atZ0. Results name
inside/outside/boundary, actual face/Surface IDs, affine UV and boundary edge IDs/
original ranges. Outside UV may lie beyond the underlying plane's unit domain.
The bounding Surface alone covers the rectangle; the trim loop defines the
actual region. Untrimmed tessellation/export is not a trimmed-face certificate.

```sh
node examples/cad-nurbs/xy-polygon-planar-face-demo.mjs /tmp/barocss-polygon-planar-face-prototype
```

The real demo builds concaveL, CW-L, triangle and10x-L native models/trim data,
queries notch/corners/interior and rejects pcurve/edge endpoint corruption.
Original Curves and topology files are retained. Affected build and this native
run are the prototype gate; deeper trim/numerical/readers/full certification
is deferred. Generic curved trims, holes, Boolean, sewing/solid and existing
file/renderer migrations remain separate.

## Original capped polygon prism shell incidence

`buildXYPolygonPrismShell(profile,{bodyId,distanceMM})` constructs original
placed polygon trim caps, lateral NURBS FaceBundles and qualified shared edges.
`validateXYPolygonPrismShell(shell)` admits bounded own data and canonically
reconstructs the actual family before checking oriented incidence.

```js
import { buildXYPolygonRegion, buildXYPolygonPrismShell } from '@barocss/cad';
const profile = buildXYPolygonRegion({ id:'L', points:[[0,0],[4,0],[4,1],[1,1],[1,4],[0,4]] });
const body = buildXYPolygonPrismShell(profile.curve, { bodyId:'part', distanceMM:6 });
// body.report:8 faces,12 global vertices,18 edges,36 uses; solid:false.
```

Source is the actual canonical3..12 vertex integer XY Curve. bodyId is
ASCII1..64 so cap IDs remain within the original80-character face ID bound;
derived/source IDs remain at most128. Positive integer distance1..10000
translates to+Z within original represented bounds±10000mm. IDs are checked
across original/global/qualified local roles before construction.

Each cap keeps its validated local XY planar-face bundle and explicit
translation/orientation. Actual world Models/Surfaces/edge Curves/vertices
retain provenance, with derived world source-Curve IDs. Top is atdistance and
forward/+Z, bottom is0/reverse/-Z. Placed/reversed world topology is a distinct
family, not an unchanged Z0/forward-only planar-face bundle. CW authoring stays
intact. Side U followsCCW traversal and each actual5-object natural FaceBundle
is built by the original buildParametricFace. Cap Models haveN+2<=14 objects;
no aggregation widens Model0's16-object bound.

Global vertices are2N and shared edges3N (bottom/top/vertical). Incidence comes
from original segment/vertex identity rather than coordinate welding. Every
qualified reference resolves an actual owning face/edge/Curve. Native Curve
direction, edge sense and face orientation compose into exactly two opposite
global uses. Actual endpoints bind global vertices. Cap pcurve bindings and
local/side validation remain original; malformed qualified/missing/opposed
uses reject without caller/prior mutation.

Report includes source/body/orientation/face IDs, actual counts/normals/bounds
and explicit limits:65536 own values, depth20, arrays128, records16, strings128.
Every output occurrence owns data. incidenceValid:true/closed:true describe
complete oriented combinatorial shell incidence only; geometricValidity remains
not-certified, topologyCertified:false and solid:false. No generic B-Rep sewing,
intersections/Boolean/solid/STEP certificate or manufacturing tolerance is claimed.

```sh
node examples/cad-nurbs/xy-polygon-prism-shell-demo.mjs /tmp/barocss-polygon-prism-shell-prototype
```

The short real demo writes source/profile/cap placements/actual face Models/
shell/report, checks triangle/L/CW counts and actual outward normals/Z6 cap,
uses the native local cap to classify the notch, and rejects qualified-reference/
missing/opposed-use corruption. Affected build/run is the prototype gate;
broader suites/readers/full/graphics certification remain deferred.

### Preview from the original polygon prism shell

`tessellateXYPolygonPrismShell(shell, { meshId, revision })` consumes the
validated original shell above. It returns the unchanged `PreviewPacket0`
shape as `packet`, separate `faceRanges`, unique `edgePaths`,
`edgeProvenance` and a report. This is a native shell consumer for GPU display.

Cap triangulation reuses the local polygon trim only for connectivity, UVs
and original boundary/triangle-centroid provenance. Each emitted position
comes from the actual placed world Surface; each normal comes from its
actual SurfaceD1 derivatives composed with face orientation. Bottom winding
and normals reverse; the top uses its real translated Surface. Lateral
faces use the actual Surface with a2-by-2 tessellation and actual derivative
normals. Face vertices remain separate for hard normals. Packet UVs belong
to the owning face; half-open vertex/scalar-index ranges identify its real
face ID, Surface ID and parameter domain. Cap metadata records local/world
source IDs and placement.

Each original global edge supplies exactly one `{ id, points }` overlay
path. Points are evaluated at the canonical qualified native Curve domain
ends and aligned with the original global vertex direction. Provenance
records the canonical face/edge/Curve, both adjacent faces, original source
segment range or vertex parameter, domain and native Curve direction. Paths
never come from triangulation adjacency; diagonals and centroid spokes are
not original edges.

Mesh ID is ASCII1..128 and must differ from every native ID and Model name.
Revision is integer0..2147483647. The unchanged native3..12-vertex family has
at most72 display vertices,44 triangles and36 two-point original edge paths.
The triangle family uses20vertices/12triangles/9paths, including its cap
centroids; L uses36/20/18. Own snapshots retain the native65536-value,
depth20,array128,record16,string128 limits. Shell/options corruption rejects
before output and does not mutate prior input/output. Every returned data
occurrence is owned.

Report retains the actual native incidence report, display identities,
counts and evaluated bounds. geometricValidity remains not-certified,
topologyCertified:false and solid:false. No GPU raster, generic solid,
curved trim, Boolean, hidden-line or exchange certification is implied.

```sh
node examples/cad-nurbs/xy-polygon-prism-shell-preview-demo.mjs /tmp/barocss-polygon-shell-preview-prototype
```

The short actual demo resolves original shell Models, evaluates their
Surfaces/derivatives and qualified Curves, checks cap placement/outward
winding, original path counts and the L notch, and rejects a corrupt native
reference. The affected build and demo are the prototype checks; broader
regression, packed and independent-reader campaigns remain deferred.

### Original polygon shell face ray query

`queryXYPolygonPrismShellRay(shell, { originMM, direction, maxDistanceMM })`
queries the unchanged original3..12-vertex polygon prism shell. It validates
an owned snapshot before resolving each world cap or lateral Model/Surface.
No packet triangle participates in selection.

Origin is finite XYZ within±10000mm. Direction is an authored finite vector
whose norm differs from1 by at most1e-9; it is never normalized. Maximum
positive distance is at most50000mm. `tMM` is the original ray parameter for
that accepted unit-vector query. The report retains its actual direction
norm. Native65536-value/depth20/array128/record16/string128 input budgets
remain explicit, with at most14 faces and36 original global edges.

The actual SurfaceD1 basis provides the supporting plane, affine inverse UV
and outward normal. Candidate distance is strictly0..maxDistanceMM; owning
Surface UV domains remain strict, with no clamping. Actual Surface evaluation
must agree with the ray-plane point within1e-7mm. A cap additionally queries
its actual local trim-loop edge Curves through explicit placement, using
floating winding and linear near-edge distance. This does not widen the
existing integer-only planar-face classifier. Lateral natural UV bounds
provide their finite face region.

`hits` contains all isolated faces within1e-7mm of the nearest distance,
sorted by distance then native face order. Each hit records body/face/Surface
IDs, `tMM`, actual evaluated `pointMM`, owning-face UV, outward normal and
original global `edgeIds`. Boundary association resolves qualified native
Curves through actual shell incidence and compares their endpoint segments
within1e-7mm. It does not match display indices or triangulation diagonals.

Status is `miss`, `unique-hit`, `ambiguous-nearest` or `ambiguous-coplanar`.
A direction-plane cosine at most1e-12 is parallel and produces no isolated
plane hit. Supporting planes within1e-7mm of the origin are reported in
`coplanarFaces`, separately from finite hits. This prototype deliberately
uses a conservative supporting-plane policy: any coplanar record prevents
a unique status, including when the ray's finite-face overlap is unresolved.
No fabricated finite coplanar distance is returned. With isolated hits this
is `ambiguous-nearest`; without them it is `ambiguous-coplanar` and
`nearestDistanceMM:null`. Multiple co-nearest isolated faces are also
`ambiguous-nearest`. Other misses have no hits and null nearest distance.

Invalid/nonunit/corrupt input rejects atomically; previous shell/results stay
usable. Query output owns all data. Boundary/coincident/parallel tolerances
are display-query policy, not manufacturing tolerances or native geometry
certificates. Reports retain geometricValidity:not-certified,
topologyCertified:false and solid:false. This is neither a general curved
intersection nor an inside/outside solid classifier.

```sh
node examples/cad-nurbs/xy-polygon-prism-ray-query-demo.mjs /tmp/barocss-polygon-shell-ray-query-prototype
```

The short actual native demo exercises original triangle/L/CW shells,
top-cap and lateral hits, concave notch misses, boundary/coplanar ambiguity,
native identities and invalid-input retention. Affected build/run is the
prototype checkpoint; numerical robustness and broad regression campaigns
remain deferred.

### Original planar polygon face with one hole

`buildXYPolygonPlanarFaceWithHole(outerProfile, holeProfile, { faceId })`
returns a distinct native `xy-polygon-planar-face-with-hole` bundle/report.
`validateXYPolygonPlanarFaceWithHoleBundle(bundle)` validates that family;
`classifyXYPolygonPlanarFaceWithHolePoint(bundle, pointMM)` queries integer
XY points at Z0. Existing single-loop faces, prism shells, previews and ray
queries retain their original separate schemas and validators.

Both inputs are actual canonical degree1/unit-weight closed integer XY
Curves from the original polygon region API. Each has at least3 vertices;
their combined count is at most12. Coordinates remain within±10000mm. Exactly
one hole is supported. All outer/hole segment pairs use exact safe-integer
orientation and on-segment predicates, at most36 cross-loop pairs. Any
crossing, touch, shared endpoint or collinear overlap rejects. Every hole
vertex must also be strictly inside the actual outer polygon. This rejects
an edge crossing a concave missing region even when its endpoints are inside.
No centroid/bounding-box assumption, snapping, healing or tolerance-based
construction is used. Source self-intersection/degeneracy remains subject to
the original polygon validator.

The actual Model contains both unchanged source Curves, one shared degree1
by-degree1 +Z supporting Surface over the outer bounds, and one native
segment Curve per original edge. N+3<=15 objects preserve Model0's16-object
limit. Native vertices/edges retain source Curve, segment index/parameter
range, loop ID and role. Outer uses runCCW and hole uses runCW with respect to
the forward+Z face, reversing topology order/sense as needed while preserving
authored source order/orientation. Both directed loops have their actual
affine pcurves in the shared Surface. The face names outerLoopId and exactly
one innerLoopId.

Validation reconstructs the complete bounded canonical family from its
actual source references. Directed endpoints/source/role bindings and
actual Surface/edge evaluations at endpoints/midpoints are checked;
1e-9mm is an evaluation comparison, not a construction/manufacturing
tolerance. Changed pcurves, references, coefficients or loop incidence
reject atomically. Areas are exact safe-integer half-shoelace values: outer,
hole and positive net area. Every output occurrence owns data.

Point queries accept integer XYZ within±10000mm atZ0. Any original boundary
wins `boundary`; a hole-interior point or point outside the outer loop is
`outside`; only the remaining outer interior is `inside`. At a vertex all
qualifying original edges are returned in native edge order, with edge ID,
source Curve/segment range and outer/hole loop identity. Native face/Surface
IDs and affine UV are retained, including outside-domain UV for outside
points; the query does not clamp or evaluate an out-of-domain Surface point.

Face ID is ASCII1..80 and all original/derived IDs are distinct and at
most128. Own snapshot limits are16384 values/depth12/arrays128/records16/
strings128; getters, hidden/symbol/sparse fields and foreign prototypes
reject. Report limits and geometricValidity:not-certified,
topologyCertified:false,solid:false remain explicit. No tessellation,
hole extrusion, multiple holes, curved trim, Boolean/solid or exchange
certificate is included.

```sh
node examples/cad-nurbs/xy-polygon-planar-face-hole-demo.mjs /tmp/barocss-planar-face-hole-prototype
```

The actual square10x10/hole4x4 demo reports net area84mm2 with8vertices,
8edges,2loops and11Model objects, tests all four authored orientations and
native boundary identities, and builds a concave outer with a contained
triangle. Crossing/touch/outside holes and corrupted inner pcurves/references
reject while prior data remain usable. Affected build and this short actual
demo are the prototype checks; broader validation remains deferred.

### Preview of the actual one-hole planar face

`tessellateXYPolygonPlanarFaceWithHole(bundle, { meshId, revision })` consumes
the validated original one-hole face and returns unchanged `PreviewPacket0`
as `packet`, original `edgePaths`, separate `edgeProvenance` and a report.
Mesh identity differs from all native IDs/Model name; report preserves the
actual forward face/Surface identity and sourceVersion0. Original sources,
two-loop topology and prior face/preview/query schemas remain unchanged.

The original segment Curves define vertical slabs between sorted distinct
native vertex X coordinates. Exact rational midpoint intersections are
sorted with checked safe-integer cross products and paired by even/odd fill.
Each interval is a trapezoid supported by two original edges, evaluated at
both slab ends. Original vertical edges remain native paths even though they
do not support interior slab intersections. Native strict containment and
non-crossing ensure supporting order cannot swap inside a slab.

Connectivity never uses floating near-equality. A collapsed rational corner
omits only its exactly zero-area triangle, explicitly recorded in the
interval report. Other pieces must have positive evaluated CCW area and
positive area after world-coordinate Float32 conversion; collapse/reversal
rejects with an actionable unsupported-preview error. No epsilon deletion,
snapping, native edge invention or coordinate welding occurs. Four local
vertices per trapezoid retain hard+Z normals and provenance; display seams
and an unused duplicate collapsed corner are permitted.

Each sampled corner records its supporting native edge/Curve/source/loop,
exact parameter fraction and rational planar point, native/source parameter
and actual pcurve-derived Surface UV. Emitted positions and unit outward
normals come from the owning SurfaceD1 evaluation. Actual native Curve and
rational cut agree within evaluation comparison1e-9mm, not a construction
or manufacturing tolerance. Paths evaluate each original native Curve's
ends once in native edge order; slab splits/diagonals are never paths.

Budgets: combined12 native vertices, at most11 slabs,6 intervals per slab,
66trapezoids,264display vertices,132triangles and12two-point paths. Reduced
rational numerator absolute value is at most1.2e9, denominator at most40000;
all intermediate products/sums/comparisons require safe integers. Existing
packet limits remain unchanged. Mesh ID is ASCII1..128 and revision is an
integer0..2147483647. Own native snapshot budgets16384values/depth12/
arrays128/records16/strings128 are retained; output arrays have their own
explicit display budgets. Invalid input/options/binding/parity/arithmetic/
Float32 pieces reject without modifying prior accepted data.

Report retains exact native net area and evaluated mesh triangle-area sum.
Their display comparison is `1e-8 + 1e-12 * max(1, nativeArea)` mm2. Actual
bounds are computed from emitted positions. Every output data occurrence is
owned. geometricValidity:not-certified,topologyCertified:false,solid:false
remain explicit; no GPU raster, hole extrusion, curved/multiple-hole trim,
Boolean/solid/exchange or general triangulation certificate is implied.

```sh
node examples/cad-nurbs/xy-polygon-planar-face-hole-preview-demo.mjs /tmp/barocss-hole-face-preview-prototype
```

The one short actual demo checks all four authored square-loop orientations
with net84mm2/eight original paths, concaveL/triangle-hole net670mm2/nine
paths, uncovered cutout/notch/outside points and actual SurfaceD1/Curve
bindings. A triangular outer/hole net70mm2 exercises exact collapsed-piece
omission. Corrupt inner pcurves/references and native mesh-ID collisions
reject while prior native/packet data stay usable. Affected CAD build and
this actual demo are the prototype checks; broader validation remains
deferred.

### Original through-hole polygon prism shell

`buildXYPolygonPrismShellWithHole(faceBundle, { bodyId, distanceMM })` consumes
the actual validated one-hole planar face and returns a distinct version0
`xy-polygon-prism-shell-with-hole` shell/report.
`validateXYPolygonPrismShellWithHole(shell)` validates that exact family.
Original source face, Curves, loop roles/order and native identities remain
in `sourceFace` and construction provenance. Existing single-loop shell,
planar preview, ray query and original hole-face validators stay unchanged.

Bottom and top keep validated local one-hole faces plus explicit placement
and orientation. Actual world cap Models translate both source Curves,
Surface poles, segment Curves and vertices alongZ, with derived world source
IDs reflected in source/edge/loop references. Outer/inner trim loops and
pcurves remain bound to the actual world Surface. Bottom isZ0/reverse/-Z;
top isdistance/forward/+Z. These distinct placed/reversed records are never
passed as unchanged Z0/forward572 bundles. No bounding plane substitutes for
an annular cap.

Every original outer/hole segment owns a real five-object natural lateral
FaceBundle. Outer U followsCCW; inner U followsCW so hole-wall normals point
into the void. Original authoring is preserved for all four orientation
combinations. Two-loop cap Models ownN+3<=15objects, N+2<=14faces preserve
parent Model0 limits, and actual SurfaceD1 normals/Curve endpoints are
resolved from each owning Model.

TwoN global vertices,threeN original shared edges andsixN qualified uses
come from original face/Curve/loop/segment/vertex identities, not coordinate
welding. Each edge has exactly two opposite uses after native Curve
direction, edge sense and face orientation compose. Global provenance keeps
original source segment ranges or vertex parameters and outer/hole roles.
Validation reconstructs the bounded family from its actual original face,
body and distance, checks world pcurve/source parameter evaluations within
1e-9mm, native endpoint/global binding and actual composed orientation.
Corrupt references, missing/duplicate/same-direction uses and misplaced caps
reject atomically; returned occurrences own their data.

Both caps have one inner loop and contribute0 to the weighted face Euler
sum; each wall contributes1. `weightedEuler` is V-E+sum(1-innerLoopCount)=0
for this through-hole shell. It is bounded combinatorial evidence, never a
naive disk-face V-E+F=2 or solid/manifold certificate. `closed:true` and
`incidenceValid:true` describe oriented shared-edge completeness only.
`referenceSweptVolumeMM3` is exact net planar area times height, a mathematical
construction reference rather than a certified solid mass property.

Exactly one original strictly contained integerXY/Z0 hole, at least3points
per loop and combinedN<=12 remain supported. +Z height is integer1..10000mm;
body ID ASCII1..64. All generated qualified/global IDs are distinct,
<=128characters and checked against every original face ID/Model name.
Own input budgets65536values/depth20/arrays128/records16/strings128 reject
getters/hidden/symbol/sparse/foreign data. No snapping/healing/construction
tolerance or source mutation occurs. Report retains source orientation,
real counts/normals/bounds, weighted contributions and explicit limits;
geometricValidity:not-certified,topologyCertified:false,solid:false remain.

```sh
node examples/cad-nurbs/xy-polygon-prism-shell-hole-demo.mjs /tmp/barocss-through-hole-shell-prototype
```

The short actual square-hole height6 demo checks10faces/16vertices/24edges/
48uses, weightedEuler0, cutout cap exclusion, inner-left+X and outer-left-X,
and mathematical reference504mm3. ConcaveL/triangle-hole gives11/18/27/54
and reference4020mm3 with the notch/hole excluded. All four authored square
orientations retain original source data. Affected build and actual native
demo are the prototype checks; broader validation remains deferred. No
mesh/raster/ray/UI/Boolean/solid/exchange functionality is added by this
shell construction.

## Actual through-hole shell display consumer

`tessellateXYPolygonPrismShellWithHole(shell, { meshId, revision })` consumes
an owned, validated original through-hole shell and returns
`{ packet, faceRanges, edgePaths, edgeProvenance, report }`. Its preview kind is
`xy-polygon-prism-shell-with-hole-preview`; PreviewPacket0 remains unchanged.
The local annular face consumer supplies only accepted slab connectivity,
UVs and original parameter provenance. Every cap vertex is re-evaluated on
its actual placed world Surface with SurfaceD1, including world pcurve,
native edge Curve and translated source Curve associations within1e-9mm.
Bottom face orientation reverses normals and winding. Top and bottom keep
the empty hole. Each actual outer/inner natural wall emits four SurfaceD1
vertices and two outward triangles; hole-wall normals face into the void.

Face ranges have contiguous half-open vertex/scalar-index offsets and name
the owning face, Surface, Model and original source face. Cap provenance
separates original/local/world source IDs, placement, unchanged local slab
parameters and corresponding world vertex bindings. Wall provenance retains
original Curve, loop role and segment index. Native and Float32 world triangles
must retain positive outward winding; unusable geometry rejects without
snapping, welding or dropping near-collapsed triangles. The inherited exact
slab collapse policy remains unchanged. Each cap's actual world triangle area
agrees with native net area within1e-8+1e-12*max(1,area)mm2.

Each original global edge appears once, using its canonical qualified actual
Curve endpoints. Provenance includes both adjacent qualified native uses,
original source/loop role and segment or vertex parameter. No slab seam or
triangle diagonal becomes a CAD edge. Evaluated endpoints retain their actual
values and are compared with global native vertex references within1e-9mm.

Input remains exactly one strict integer XY/Z0 hole, combinedN<=12 and integer
+Z height1..10000mm. Snapshot bounds remain65536 values/depth20/arrays128/
records16/strings128. meshId is ASCII1..128 and differs from all native IDs and
Model names; revision is integer0..2147483647. Output is bounded by14 faces,
576 vertices,288 triangles and36 two-point original paths. Actual evaluated
positions define exact packet bounds. Invalid shell/identity/revision/reference
fails before output and leaves previous caller data usable. WeightedEuler0,
reference swept volume and closed incidence remain native construction reports;
geometricValidity:not-certified, topologyCertified:false and solid:false remain.
This consumer adds no solid certification, Boolean, exchange, query or grammar.

```sh
pnpm --filter @barocss/cad build:library
node examples/cad-nurbs/xy-polygon-prism-shell-hole-preview-demo.mjs /tmp/barocss-through-hole-shell-preview-prototype
```

The short actual API demo uses four authored square orientation combinations
at height6:64 display vertices,32 triangles,24 original edge paths,84mm2 per
cap and bounds[0,0,0]..[10,10,6]. Actual concaveL/triangle-hole gives76/38/27
and670mm2 per cap. It checks actual world SurfaceD1 bindings, normals, Float32
winding, cap hole/notch coverage, original paths and opposite adjacent uses;
corrupted placement/inner Curve/use, native-ID collision and invalid revision
reject while prior shell/preview remain usable. Affected build and this demo
are prototype checks; broader validation and visible rendering remain deferred.
