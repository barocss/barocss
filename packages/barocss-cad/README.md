# @barocss/cad (experimental)

CSS-shaped model source becomes native rational B-spline geometry and ASCII IGES.
This package contains an original parser, local basis evaluator and writer. It has
no runtime dependencies. OCP is an independent test consumer, never a product kernel.
Version `0.0.0-experimental` is configured for public scoped-package access.
This local configuration does not establish registry availability or a release.
Development main/types/import exports use `src/index.ts`. The complete
`publishConfig` maps use `dist/index.js` and `dist/index.d.ts` for the explicit
compiled checkpoint and publication.
`pnpm --filter @barocss/cad build:library` emits both with the existing TypeScript
build configuration. Published files include compiled modules/declarations,
original source, this README and the MIT LICENSE. Compiled runtime import needs no repository build scripts or TypeScript loader.

```js
import { compileCadModel, evaluateCurve, exportIGES } from '@barocss/cad';
const compiled = compileCadModel(source, { sourceVersion: 0 });
if (!compiled.ok) throw new Error(compiled.diagnostics[0].message);
const model = compiled.model;
const point = evaluateCurve(model.objects[0], 0.5);
const { iges, report } = exportIGES(model, ['arc']);
// The host retains source and report, hashes iges, and writes the bytes.
```

## Local source development

Normal workspace package main/types/import exports select
`packages/barocss-cad/src/index.ts`. Source execution requires a TypeScript-capable
bundler or runner that resolves relative `.js` imports to their source `.ts` files.
Use `pnpm dev:cad` from the repository root for the
loopback example. Installed esbuild resolves the original TypeScript module
graph in memory, including `.js` relative imports. Reload consumes source edits
without a dependency build or server restart. A plain browser cannot load raw
TypeScript; use the source host. Existing Node artifact demos explicitly import
`dist/index.js` and retain their separate `build:library` checkpoint. Source-only
native demos use the actual source entry with `--source`, without a CAD artifact
import or a per-demo build. Explicit compiled consumers select the complete `publishConfig.exports` map,
including transitive workspace imports. Plain Node cannot execute the TypeScript
source entry directly. Registry publication and the existing release workflow are separate.

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

## Editable original cutout extrusion intent

`evaluateXYPolygonPrismHoleDocument(document,{revision})` and
`updateXYPolygonPrismHoleDocument(document,edits,{revision})` return
`{document,evaluation,report}`. Evaluation exposes actual original region
results in `profiles.outer/hole`, the actual annular `face` result, the native
through-hole `shell` result and its actual world Surface/Curve `preview` result.
This is one executable feature, not a general feature graph.

```js
const document = {
  format:'barocss-xy-polygon-prism-hole-feature', version:0,
  id:'cutout_document', lengthUnit:'mm',
  profiles:{
    outer:{id:'cutout_outer',kind:'xy-polygon',points:[[0,0],[10,0],[10,10],[0,10]]},
    hole:{id:'cutout_hole',kind:'xy-polygon',points:[[3,3],[7,3],[7,7],[3,7]]}
  },
  feature:{id:'cutout_extrusion',kind:'xy-polygon-prism-with-hole',
    outerProfileId:'cutout_outer',holeProfileId:'cutout_hole',
    faceId:'cutout_face',bodyId:'cutout_body',distanceMM:6}
};
const initial = evaluateXYPolygonPrismHoleDocument(document,{revision:1});
const edited = updateXYPolygonPrismHoleDocument(initial.document,
  {holePoints:[[2,2],[8,2],[8,8],[2,8]],distanceMM:8},{revision:2});
const saved = serializeXYPolygonPrismHoleDocument(edited.document);
const reopened = parseXYPolygonPrismHoleDocument(saved);
```

Only the exact illustrated native intent fields are supported. Six authored
IDs are distinct ASCII1..64; references explicitly resolve outer/hole IDs.
Each authored loop has at least3 vertices, combinedN<=12, integer XY within
±10000mm, no repeated closing vertex, and retains order/CW/CCW/negative-zero
intent. Exactly one strictly contained hole is admitted by the original face
API; crossing, touching, overlap and invalid simple polygons reject. Height is
positive integer1..10000mm in+Z. Downstream native construction checks actual
and derived identity; display mesh ID is bodyId+'_preview' and remains separate
from all native IDs/Model names. Revision0..2147483647 affects display only.

Edits permit optional outerPoints/holePoints/distanceMM with at least one
supplied. All edits apply to one owned whole candidate before actual original
profiles→face→shell→world mesh execution. IDs stay stable. Failure adopts no
partial change and leaves caller intent/native/packet reusable. Both loops
may move together even when either edit alone would violate containment.

Save and Open both execute the complete native candidate at private revision0
before returning. Canonical JSON contains native intent only, preserves−0,
and excludes compiled source/Model/world topology/mesh/metrics/revision/camera/
history/certificates. Open bounds UTF-8 text to128KiB, performs a lexical guard
before JSON.parse to reject duplicate decoded keys, limits depth6, arrays16,
records12, strings128 and1024 lexical values/keys, then applies the owned data
snapshot1024 values/depth6 and whole native admission. Getters/symbols/hidden/
sparse/foreign data and unsupported format/version/unit/kind/field/reference
reject. Existing single-loop/Box documents and source grammar remain unchanged.
Reports retain native construction references and geometricValidity:not-certified,
topologyCertified:false,solid:false; no certified mass/Boolean/assembly claim.

```sh
pnpm --filter @barocss/cad build:library
node examples/cad-nurbs/xy-polygon-prism-hole-document-demo.mjs /tmp/barocss-through-hole-document-prototype
```

The short actual API/file demo follows square reference volume504 atheight6,
height8→672, expanded hole→512, saved/reopened intent andheight10→640. Actual
cap areas/emptyhole, top Surface/Curve height, packets and original paths update;
all six IDs remain and the initial504 result remains exact. ConcaveL gives4020
and preserves empty hole/notch. Reversed authored loops and−0 survive an actual
file round trip. Invalid edits/references/fields/versions/decoded duplicate
keys reject without changing prior good results. Affected build and this
prototype demo are bounded checks; wider validation and edit UI are deferred.

## Original through-hole shell ray query

`queryXYPolygonPrismShellWithHoleRay(shell,{originMM,direction,maxDistanceMM})`
consumes an owned, validated actual through-hole shell, including one produced
by the cutout document API. It returns status/body/query/nullable
`nearestDistanceMM`, co-nearest `hits`, all ordered finite-domain `candidates`, separate
`coplanarFaces` and a policy/native report. It uses no display triangles.

Every original cap/world or natural wall SurfaceD1 defines its actual plane,
parameter domain and oriented outward normal. Forward finite ray-plane t is
in millimetres, actual world UV is resolved without clamping and the emitted
point/normal are evaluated on that original SurfaceD1. Annular cap containment
uses directed winding of both actual world native trim loops: outer interior
minus hole interior, with both native boundaries admitted. Actual native
segment distances handle finite noninteger ray intersections without changing
the existing integer-only face classifier. Natural walls keep their actual
finite UV domains. Hole interiors never create cap hits.

Each hit names body/face/Surface, cap or outer/hole-wall role, tMM, actual
pointMM/UV/outward normal and boundary original global edge IDs. Each boundary
reference resolves the actual qualified native face/edge/Curve, native domain,
original use and original source/loop role/segment or vertex parameter. No
coordinate welding or packet identity replaces those native associations.
Candidates sort by distance then stable original face order; hits retain all
candidates within1e-7mm of the nearest distance, leaving later candidates
available separately. Boundary comparison is1e-7mm, parallel cosine1e-12,
and unit direction comparison1e-9. These are display query policies, not
construction/healing/manufacturing tolerances. Actual world values remain.

Statuses are miss,unique-hit,ambiguous-nearest,ambiguous-coplanar. Any support
plane coplanarity conservatively returns ambiguous-coplanar even if isolated
hits remain inspectable; finite coplanar overlap is unresolved and no hit is
invented. Without coplanarity, multiple co-nearest native faces are ambiguous
and retain all results. No isolated or coplanar candidates means miss.
Existing single-loop ray behavior and all native/source/document families
remain unchanged. This API adds no screen picking or generic curved kernel.

Origin is finite XYZ within±10000mm, direction is a dense finite3-vector
with norm within1e-9 of1 (never normalized), maximum distance is positive
finite<=50000mm. Actual shell bounds stay combinedN<=12, one strict integer
XY/Z0 hole, +Z height1..10000mm, <=14 faces/36 original edges. Owned snapshot
65536 values/depth20/arrays128/records16/strings128 rejects getters/symbols/
hidden/sparse/foreign data. Invalid query/native binding returns no partial
result and leaves previous caller data usable. Reports explicitly retain
geometricValidity:not-certified,topologyCertified:false,solid:false.

```sh
pnpm --filter @barocss/cad build:library
node examples/cad-nurbs/xy-polygon-prism-shell-hole-ray-demo.mjs /tmp/barocss-through-hole-ray-prototype
```

The short actual native API demo checks top annular cap t2, through-hole miss,
inner-right wall t2/normal-X, outer-left t1 with later inner candidates, top
hole-rim diagonal co-nearest cap/wall atsqrt2 and conservative coplanar rim.
ConcaveL hole[3,23] and notch[20,21] rays miss while material hits top.
Notch[20,20] lies on the original hole wall's y20 supporting plane: it has no
finite hits and remains ambiguous-coplanar. Fractional square material/hole
rays also resolve without widening the integer point API. Reversed authored loops
retain equivalent queries. Actual SurfaceD1/UV/normals and qualified boundary
Curve/global references resolve, corrupt cap/wall references and invalid
direction/range reject while previous shell/results remain reusable. Affected
build and this short prototype run are bounded checks; wider validation,
certified accuracy/solid/Boolean/interchange and screen selection are deferred.

## Native XY sketch intent and edits

`evaluateXYSketchDocument(document)` and `updateXYSketchDocument(document,edits)`
return owned `{document,profiles,report}`. Distinct version0 format
`barocss-xy-sketch` has exact root fields format/version/id/lengthUnit/workplane/
profiles; unit is mm, workplane is xy and profiles are ordered0..8. An empty
sketch is valid. This document is editable intent backed by the unchanged
original line/open-polyline/rectangle source0 builder.

```js
const sketch = {format:'barocss-xy-sketch',version:0,id:'sketch',
  lengthUnit:'mm',workplane:'xy',profiles:[]};
const created = updateXYSketchDocument(sketch,[
  {kind:'upsert',profile:{id:'A',kind:'line',points:[
    {id:'A0',xy:[0,0]},{id:'A1',xy:[10,0]}]}},
  {kind:'upsert',profile:{id:'C',kind:'rectangle',originMM:[20,0],
    widthMM:4,heightMM:3,cornerIds:['C0','C1','C2','C3']}}
]);
const edited = updateXYSketchDocument(created.document,[
  {kind:'upsert',profile:{...created.document.profiles[1],widthMM:6}}
]);
const saved = serializeXYSketchDocument(edited.document);
const reopened = parseXYSketchDocument(saved);
```

A line has exactly2 authored `{id,xy}` points; an open polyline has2..64.
A rectangle has originMM,widthMM,heightMM and exactly4cornerIds, ordered
origin,origin+[width,0],origin+[width,height],origin+[0,height]. Document,
profile and all authored point/corner IDs are globally distinct ASCII1..64;
combined authored points/corners<=128. Native Curve ID is the profile ID.
Finite XY within±10000mm, adjacent segment length>=0.001mm, open line/polyline
endpoints, rectangle dimensions0.001..10000mm and resulting corner bounds
are still checked by the actual original profile builder. Authored order and
negative-zero intent remain. No custom plane/origin/units conversion is added.

Each ordered result entry is `{profileId,evaluation,pointBindings}`.
Evaluation is the actual original buildXYProfile result with source0,Model,
Curve and report. Per-native-pole bindings name pointId/curveId/poleIndex and
parameter derived from actual Curve knots and report domain. The rectangle
has5 actual native poles:0/4 both bind its first authored corner ID at
parameters0/4. This is endpoint closure and degree1 C0 segment geometry,
not a region/face/solid certificate. Existing derivative safeguards remain.

Edits are1..8 ordered exact upsert/remove operations, each target profile ID
at most once. Existing upserts keep array position; new profiles append in
batch order; removal must resolve. Numeric edits preserve existing kind,
point count, point IDs/order or corner IDs/order. Topology replacement requires
removal in one accepted transaction and a fresh-ID profile in a later one.
All operations form one candidate, globally admitted and fully rebuilt before
return. Invalid profiles/identity/edit leave prior caller intent/native data
unchanged/reusable. No constraints/dependency graph/snap/history/UI is implied.

Save and Open both execute all actual profiles before returning. Canonical
JSON stores only exact sketch intent, preserving−0 and excluding source/Model/
evaluation/metrics/packet/revision/camera/constraints/certificates. UTF-8<=128KiB;
lexical duplicate decoded-key rejection precedes JSON.parse with4096values/keys,
depth8, arrays64, records12, strings128. The own-data snapshot has the same
local budgets. Getters/symbols/hidden/sparse/foreign data and unsupported
format/version/unit/plane/field reject. Existing documents/native profiles,
constraint/dimension APIs and source0/1/2 grammar remain unchanged.

```sh
pnpm --filter @barocss/cad build:library
node examples/cad-nurbs/xy-sketch-document-demo.mjs /tmp/barocss-xy-sketch-prototype
```

The short actual API/file demo starts empty, adds a line/open polyline/rectangle
in one batch, edits line endpoint and rectangle width together, removes the
polyline, saves/reads/parses actual intent, then edits rectangle height.
Original source/Model/Curve/native parameter bindings, rectangle closure,
stable IDs/order, prior result reuse and−0 round trip are checked. Invalid
geometry/identities/topology edits and malformed/duplicate-key/schema inputs
reject. Affected build and this short run are prototype checks; broad validation
and workplane authoring UI are deferred. regionCertified:false,face:false,
solid:false remain explicit; no commercial parity or screen authoring claim.

## Sketch rectangle feature dependency graph

`evaluateSketchRectangleFeatureGraph(document)` and
`updateSketchRectangleFeatureGraph(document,edits)` return owned
`{document,sketchEvaluation,parameters,features,report}`. Distinct version0/mm
format `barocss-sketch-rectangle-feature-graph` has exact root fields
format/version/id/lengthUnit/sketch/parameters/features. The embedded sketch is
an actual unchanged XY sketch document. This family connects existing original
rectangle profiles and source2 extrusion; it adds no parallel geometry builder.

Length parameters1..8 have exact id/type:length/definition. A definition is
literal `{kind:'literal',valueMM}` or offset `{kind:'offset',parameterId,offsetMM}`.
Literal/offset/resolved values are finite integers within±10000mm. Forward
references are allowed. Every parameter, including unused ones, resolves by a
stable topological order with authored order breaking ties. Missing/self/cyclic
dependencies reject with parameter IDs/path. No general expression grammar or
implicit unit/reference conversion is added. Definitions/order/negative-zero
intent are retained; resolved parameters separately record id/type/valueMM/
dependencyIds/zero-based order.

Features1..4 have exact id/kind:axis-rectangle-extrude/profileId/bodyId/
distanceParameterId/suppressed boolean. Profile resolves an actual sketch
rectangle with integer origin/width/height under original extrusion limits;
resolved distance is integer1..10000mm. All graph/sketch/profile/authored point/
corner/parameter/feature/body IDs are globally distinct ASCII1..64. Native
reserved/derived identity is checked by the unchanged original constructor.
One profile may feed several features; bodies remain separate original bodies,
not a combined Model/Boolean/assembly. Canonical `_rect_*` source2 parameters
remain local to each body's Model and are explicitly mapped to graph IDs.

Every feature is admitted through actual buildAxisRectangleExtrusion, including
suppressed input/geometry/reference/identity admission. Active features retain
actual source2/Model/IR/profile/FaceBundles/shell/restricted solid report;
suppressed features return evaluation:null with no active output, retaining
feature/dependency/native identity bindings. Original sketch source0 and actual
extrusion input Curve coefficients/identity/domain match exactly. Bindings
include authored point/corner pole mapping, resolved graph height and local
source2 parameter IDs, body/shell IDs and qualified shell/local face/Surface
IDs. Reports retain actual dependency edges/order/status/active body IDs and
parent-specific solid reports; wholeGraphCertified:false makes no whole-graph
geometric proof.

Atomic edits have exact optional parameterEdits/sketchEdits/featureEdits with
at least one supplied nonempty array. Parameter edits1..8 target existing IDs
once and replace only definitions; sketch edits1..8 use unchanged numeric/stable
identity sketch operations; feature edits1..4 target existing feature IDs once
and toggle suppression only. All edits form one complete candidate, then all
sketch/IDs/refs/parameter DAG/features and active outputs execute before return.
IDs and feature order remain. Shared parameter edits regenerate every dependent
body; suppressed outputs disappear from activeBodyIds and unsuppression rebuilds
the same body ID. Cycles/deleted refs/bad geometry/downstream ID failures adopt
no partial state; caller's prior document/native outputs remain reusable.

Serialize/Open both execute the entire original candidate. Canonical JSON stores
only exact graph/embedded sketch/parameter definitions/features, preserving−0,
order and booleans. No resolved cache/source/Model/IR/native output/selection/
camera/history/certificate is saved. UTF-8<=128KiB, lexical duplicate decoded-key
and budget checks precede JSON.parse. Own/parser budgets8192values/keys,depth10,
arrays64,records12,strings128 reject getters/symbols/hidden/sparse/foreign values.
Existing sketch/rectangle/Box/polygon/cutout/Model/project formats, constraints
and source0/1/2 grammar remain unchanged. No GUI/general feature expressions,
face-dependent features/stable topology naming/union/manufacturing/mates are
claimed.

```sh
pnpm --filter @barocss/cad build:library
node examples/cad-nurbs/sketch-rectangle-feature-graph-demo.mjs /tmp/barocss-feature-graph-prototype
```

The short actual graph/API-file demo uses two rectangles and forward-authored
shared height dependencies: heights6/8 and separate parent volumes72/80.
Shared height8 yields96/100; a single rectangle-width5/height9 batch yields135/110.
SuppressA keeps B active; actual saved/reopened intent then unsuppression restores
same body A/volume135. Actual source0/2 Curve/IR/Model/FaceBundle/shell/native cap
D1/identity/local parameter mappings and−0 intent are checked, with invalid
DAG/reference/height/profile/IDs/edits/JSON controls and previous output reuse.
Affected build and this run are prototype checks; wider validation and graph UI
remain deferred. Native validity is the existing exact-axis-box family only,
not arbitrary multi-body/commercial certification.

## Rectangle feature creation, removal and rebinding

`editSketchRectangleFeatureGraphFeatures(document,edits)` returns the existing
owned graph result with an additive feature transaction API. Exact edit fields
are required featureOperations and optional parameterEdits/sketchEdits. Ordered
feature operations1..8 are `{kind:'upsert',feature}` using the exact existing
feature record, or `{kind:'remove',featureId}`. Each target ID appears once.
The old suppression-only updater, graph0 format/evaluator/Save/Open, source
families, input/parser budgets and numeric semantics remain unchanged.

Existing upserts keep id/kind/bodyId and authored array slot; profileId,
distanceParameterId and suppression may change. Existing body identity cannot
be replaced. New feature/body IDs are fresh relative to the starting graph
and prior new transaction identities, with removed feature/body IDs still
reserved. New entries append in operation order. Remove resolves an existing
starting feature; no same-ID remove/readd, silent remove or implicit cascade.
Survivors keep relative order. The final graph must have1..4 features, checked
against the complete candidate: at-four add then remove a different feature
is valid. No reorder or parameter creation/deletion is added.

The starting graph first passes complete actual native admission. Feature,
optional parameter-definition and actual sketch edits then form one owned
candidate before final graph evaluation. Internal feature admission/input-edit
helpers are shared with the old updater; the public updater is not called on
an invalid intermediate graph. Profile deletion with final feature deletion
or rebinding is atomic; profile addition with new feature creation is atomic.
All parameters, profiles and remaining active/suppressed features still pass
original reference/geometry/derived-ID admission using actual graph/sketch/
rectangle builders. Invalid final candidate publishes no partial caller or
native state. Old accepted outputs remain exact/reusable.

Original source0/source2 Curve equality, authored pole/corner IDs, local source2
parameter scope and real body/FaceBundle/shell/Surface/parent validity bindings
remain. Bodies are separate original outputs, not a Boolean union or assembly;
wholeGraphCertified:false. Existing serializer/parser save final authored
feature refs/order only. No UI, undo/history, generic topology references,
format migration/cache or grammar/budget widening is introduced.

```sh
pnpm --filter @barocss/cad build:library
node examples/cad-nurbs/rectangle-feature-lifecycle-demo.mjs /tmp/barocss-feature-lifecycle-prototype
```

The short actual API/file run starts with A72/B80, adds C96 and rebinds A to
another profile/height under the same bodyID. Atomic removeB/removeprofileB/
rebindA gives A72/C96. Add a new2x2 sketch rectangle and D together→D32;
removeC/base9→A108/D44; rebind D to base→D36 with unchanged bodyID. Existing
Save/Open retain final A/D order, native bindings and108/36 volumes. A
four-feature add-before-remove transaction preserves survivors/fresh append.
Identity recycling/replacement, bad refs/geometry/suppression/final counts,
cycle and incomplete deletion reject with prior output reuse. Native curves,
source2 IR, real cap D1 and−0 intent remain. Affected build/this run are
prototype checks; broader validation and graph UI remain deferred.

## Native circle and quarter-arc sketch intent

`evaluateXYArcSketchDocument(document)` and `updateXYArcSketchDocument(document,edits)`
return owned `{document,profiles,report}`. Distinct `barocss-xy-arc-sketch`
version0/mm/xy has exact root format/version/id/lengthUnit/workplane/profiles,
ordered0..8profiles; empty is valid. Circle intent has exact id/kind:circle/
centerId/centerMM/radius/seamId. Quarter intent has id/kind:quarter-arc/centerId/
centerMM/radius/quadrant/endpointIds. Radius is exact `{id,valueMM}`;
quarter has two ordered authored start/end IDs and quadrant integer0..3 under
the unchanged original CCW definition. Circle seam is original+X. All document/
profile/centre/radius/end-or-seam IDs are globally distinct ASCII1..64.

Each entry is `{profileId,evaluation,bindings}`. Evaluation calls the unchanged
original buildXYArc with exact id/centre/radius/quadrant; actual source0/Model/
rational degree2 Curve/weights/knots/domain/report remain accessible. Finite
XY centre, radius0.001..10000mm and every computed native pole are admitted by
the original±10000mm family. Fractional centre/radius remain supported within
those limits; no parallel rational geometry constructor or sampled native data.

Bindings name curveId/nativeDomain and separately record authored centre
`{pointId,pointMM:[x,y,0],role:'center'}` and radius`{parameterId,valueMM}`.
Centre is a construction point with no native pole or parameter. Quarter
curvePoints bind authored endpoints to real pole0/2, parameter0/1 and start/end
roles. Circle curvePoints bind the same seam ID to real poles0/8, parameter0/4.
The native report retains endpointClosed separately and periodic:false;
regionCertified:false,face:false,solid:false remain explicit. Endpoint equality
does not create periodic/region/topology proof or change existing exporters.

Ordered1..8 exact upsert(profile)/remove(profileId) operations target each ID
once. Existing upsert keeps kind/id/centerId/radius.id/ordered endpoints or
seam ID and array slot; only numeric centre/radius/quadrant changes. New
profiles append; removal resolves. Kind/identity replacement uses accepted
removal then later fresh-ID authoring. The entire candidate's original native
curves and global IDs validate before return. Invalid radius/computed poles/
quadrant/IDs/operations preserve prior caller intent/native results; no partial
adoption, rounding or healing.

Serialize/Open execute the entire actual candidate. Canonical authored JSON
preserves−0/order and excludes generated poles/source/Model/cache/query/camera/
selection/periodic/certificates. UTF-8<=128KiB; lexical duplicate decoded-key/
budget guard precedes JSON.parse. Own/parser4096values/keys,depth8,arrays64,
records12,strings128 reject getters/symbols/hidden/sparse/foreign values and
unsupported format/fields. Existing XY sketch and rectangle graph documents
remain strict; arc intent is a separate format. Existing source0/1/2/native
arc/query/export behavior and degree2C0 derivative policy remain unchanged.
No general angles/solver/snap/wires/regions/trims/circle extrusion/cylinder/
Boolean/STEP/UI or generic curve-authoring claim follows.

```sh
pnpm --filter @barocss/cad build:library
node examples/cad-nurbs/xy-arc-sketch-document-demo.mjs /tmp/barocss-arc-sketch-prototype
```

The short actual API/file run starts empty and adds a quarter and circle,
checks actual original poles/weights/cardinals/point-D1 queries and authored
centre/radius/end/seam bindings. One numeric batch edits both profiles, saves/
reads/parses/rebuilds actual intent, then changes quarter quadrant3 with stable
endpoint roles and removes the circle. Native−0 centre intent round trip,
prior result reuse and geometry/identity/parser/old-format rejection are checked.
Actual numerical values are observations under existing native arithmetic,
not a new numerical quality target. Affected build/this run are prototype
checks; broad validation and arc sketch UI remain deferred.

## Typed height parameter creation and removal

`editSketchRectangleFeatureGraphParameters(document,edits)` returns the existing
owned graph result with additive typed parameter authoring. Exact edits require
parameterOperations, optional featureOperations/sketchEdits only; every present
array is nonempty1..8. No parameterEdits/featureEdits aliases are admitted here.
Each parameter target appears once: exact upsert with the complete existing
`{id,type:'length',definition}` record, or remove(parameterId). Definition
literal/offset and all integer length bounds/resolution stay unchanged.

Existing upserts retain id/type/authored slot; new IDs are fresh relative to
all starting authored graph identities and append in operation order. Remove
resolves a starting parameter; no implicit cascade/rename/same-ID readd. Removed
identities remain reserved across parameter/feature/body/new-sketch categories;
existing sketch/profile/corner identities remain legal in original roles.
Survivors retain order. Final parameter count1..8 is checked after all operations,
so add-at-eight/remove-other can succeed. No parameter reorder, arbitrary
expressions/scalar/angle/unit conversion or sketch dimension binding is added.

A starting actual graph passes full admission, then all parameter/optional
original feature and sketch operations form one owned candidate. The same
private admission/feature-operation helpers preserve old public585/586 API
behavior; no intermediate public updater or duplicated DAG/geometry engine.
Deleting a used height requires every final offset/feature reference, including
suppressed features, to be removed or rebound in that candidate. New heights
may be forward-referenced by offsets and existing/new features. All parameters,
remaining profiles and active/suppressed native features execute original full
admission before return; invalid final graph publishes no partial state.

Original source0/source2 Curve/IR, native body/FaceBundle/shell/Surface/corner/
parameter/face bindings and per-body reports remain. Separate bodies and
wholeGraphCertified:false; no union/global certificate. Existing graph0 file
format/Save/Open/parser budgets/negative-zero semantics and strict separate arc
format remain unchanged. No cache/editor state/file migration or UI extension.
Old definition/suppression and feature lifecycle APIs remain usable and reject
parameterOperations. Typed parameter Add/Delete UI is a later separate consumer.

```sh
pnpm --filter @barocss/cad build:library
node examples/cad-nurbs/rectangle-parameter-lifecycle-demo.mjs /tmp/barocss-rectangle-parameters-prototype
```

The short actual API/file flow starts A72/B80 with base6/derived+2/unused−0.
Add newHeight=base+4 and rebindB→B100. Atomically removebase/addnewBase9/repair
both offsets andAref→A108/B130; authored survivors/append and stable topo order
are retained. Remove newHeight and rebindB→110, removeunusedidle, then newBase9/
Awidth5 batch→A135/B110. Save actual intent; editbase10→150/120; read saved bytes
restores135/110. Add extraHeight11 andfreshC→165, then removeparameter+feature
together. Eight-parameter add-before-remove stays final8. Used/suppressed height,
DAG/ID/category reuse/type/definition/budget/combined sketch errors reject with
previous outputs reusable. Native original bindings and−0 file intent are
checked. Affected build/this run are prototype checks; broad validation and
parameter lifecycle UI remain deferred.

## Original rational circle planar trim face

`buildXYCirclePlanarFace(profile,{faceId})` consumes the exact original circle
request and returns owned `{profile,bundle,report}`. Profile is the actual
unchanged buildXYArc/source0/Model/rational degree2 Curve result. Distinct
xy-circle-planar-face version0 bundle has exact construction/geometry/topology;
existing natural four-boundary FaceBundle and integer polygon faces stay strict.
Circle and face IDs are ASCII1..64, deterministic generated IDs<=80 and all
source/face/Surface/loop/seam/edge/pcurve IDs distinct. Original finite XY/radius
0.001..10000mm/computed-pole±10000 admission remains; fractions supported.

World Model0/mm contains exactly the original circle Curve and new degree1×1
plane Surface with poles bounding cx±r,cy±r atZ0, unit weights andU/V0..1.
U points+X,V+Y and actual forward normal+Z. Topology has one seam vertex at
actual circle pole0/8, one closed edge using the original Curve and same seam
ID at both ends/sourceParameterRange0..4, one forward loop use. No straight
polygon edges replace the original rational boundary. Its UV pcurve lives
inside topology with explicit coordinateSystem:uv/domain0..4, degree2 original
knots/weights and actual world poles mapped by(x-x0)/(x1-x0),(y-y0)/(y1-y0)
using the actual represented Surface axes. These spans are mathematically2r;
their binary64 coefficients can differ from a separately computed2*r. This
retains strict nativeUV0..1 at actual border poles, without clamping or moving
the original world Curve/Surface.
It is dimensionless UV data, not a world-mm Model object. Rational middle
poles are control coefficients, not samples inside the disk.

`validateXYCirclePlanarFaceBundle(bundle)` owns bounded plain data and rebuilds
from retained exact construction through the actual original circle builder.
Exact canonical comparison includes world geometry/seam/edge/use/UV pcurve and
all references; no forged flags/report are trusted. Original Curve/Surface/
Model validators run. Cardinal/half-span native Curve-vs-Surface(pcurve) and
interior derivative-chain/+Z normal observations run; existing circle C0
interior-knot D1 rejection stays. Comparison1e-7mm and derivative relative1e-9
are finite consistency observations, not native construction tolerance or a
geometric certificate. Input snapshot8192values/depth10, arrays64, records12,
strings128 rejects getters/symbols/hidden/foreign/sparse/nonfinite data.

Report names original IDs/domains/centre/radius/bounds and1vertex/1edge/1use/
2worldobjects with canonical closed-use incidenceValid:true. periodic:false,
geometricValidity:not-certified,topologyCertified:false,solid:false remain.
referenceDiskAreaMM2=pi*r*r is an analytic admitted-circle reference, not the
square Surface's area or certified general trimmed area. No capped shell follows.

`classifyXYCirclePlanarFacePoint(bundle,pointMM)` first admits the entire native
bundle, then accepts exact finite XYZ within±10000mm. Fixed prototype plane and
radial-boundary tolerance1e-7mm: abs(z)>epsilon is off-plane; on-plane radial
distance<r-epsilon inside, abs(distance-r)<=epsilon boundary, otherwiseoutside.
Result names native face/Surface/source and original edge only on boundary.
Input values remain; no query snap/clamp or fabricated circle parameter. Actual
affine surfaceUV is supplied only on-plane and within exactU/V0..1, otherwise
null. A near-rim boundary point outside the plane domain may have nullUV.
No arbitrary projection/intersection/picking/inverse circle solver is added.

```sh
pnpm --filter @barocss/cad build:library
node examples/cad-nurbs/circle-planar-face-demo.mjs /tmp/barocss-circle-face-prototype
```

The short actual native construction/query/file demo checks centre[2,-3]/r4,
original rational circle/plane/UV bindings, one seam/edge/use, native cardinal/
half-span point-D1 chain, normal+Z and analytic reference16*pi. Centre/seam/
square-corner/out-of-domain/off-plane and explicit near-boundary floating points
classify without mutation/clamping. A separate actual edited arc-sketch circle
centre[30,1]/r3 is explicitly selected; earlier data remains. One ordinary
finite native bundle artifact is written/read/validated; this is not a new
product document/exchange/signed-zero file guarantee. Concrete canonical
geometry/pcurve/seam/ref/use/request/query/getter controls reject. No mesh or
renderer is added. Broad validation, generic trims/circle extrusion/cylinder/
solid/Boolean/exchange/assembly/commercial parity remain deferred or outside
this family; actual finite observations are not full numerical-quality passes.

## Original circle face display mesh and edge path

`tessellateXYCirclePlanarFace(bundle,{meshId,revision,segmentsPerQuarter})`
first owns and validates the actual original circle face and returns owned
`{packet,edgePaths,edgeProvenance,report}`. Exact options require ASCII meshID
1..64 distinct from native IDs/Model names, integerrevision0..2147483647 and
integersegmentsPerQuarter2..32. Extras/getters/symbols/nonfinite data reject.
The existing PreviewPacket0 schema/units/convention remains unchanged.

With k segments per quarter, N=4*k. Sample original world Curve and its actual
UV pcurve at native parametersj/k forj0..N-1. Each packet boundary point comes
from actual SurfaceD1(pcurveUV); centre UV comes from original construction
centre and actual represented plane inverse, with centre point from SurfaceD1.
Every normal is actual derivative cross normalized+Z. Centre plusN boundary
vertices formN CCW fan triangles[0,1+j,1+(j+1)%N]. The seam vertex occurs once
in mesh connectivity. Native UV is never clamped; no analytic/trigonometric
replacement circle or supporting-square tessellation is used. Exact bounds
come from emitted positions. Max129vertices/128triangles remain below the
unchanged packet budgets.

ONE closed path retains the original rational edge ID and original world Curve
samples0..4 inclusive,N+1points. No radial fan diagonal becomes a CAD edge.
Provenance names native face/Surface/source Curve/edge/loop/seam, loop sense,
original parameter range0..4, sampled native parameters and pcurve ID. The one
native edge is distinct from N display approximation segments. Packet positions
and edge path coordinates remain their actual independent native evaluations;
maximum observed binding difference is measured under explicit1e-7mm comparison.
Original native geometry/topology/query data remains unchanged/reusable.

Report retains admitted native report, IDs/counts/uniform-native-parameter
sampling, actual triangle-sum meshAreaMM2, analytic referenceDiskAreaMM2 and
signed area difference. observedChordDeviationMM is the maximum observed
original Curve interval-midpoint versus chord-midpoint distance at these N
intervals, including closure. It is not a certified global Hausdorff/tolerance
bound; sampling is uniform in parameter, not claimed uniform angle. No adaptive
sampling, generic trimmed area or solid certificate is added.

Existing packet admission checks finite nonzero winding against each normal.
Actual world positions also convert to Float32 for explicit collapse/reversal
refusal before return. A valid translated small native circle may be unsupported
for this display sampling; no automatic recenter/rescale/healing or triangle
deletion. Returned arrays own their data. geometricValidity:not-certified,
topologyCertified:false,solid:false remain. Input snapshot8192values/depth10/
arrays64/records12/strings128 is inherited; trusted output arrays have separately
bounded129path points/129vertices, with no packet budget change.

```sh
pnpm --filter @barocss/cad build:library
node examples/cad-nurbs/circle-planar-face-preview-demo.mjs /tmp/barocss-circle-face-preview-prototype
```

The short actual native packet/file demo uses r4/centre[2,-3] withk2:
9vertices/8triangles/one9point path, area approximately32*sqrt2 rather than64
supporting-square area. Same original bundle withk8 gives33/32/path33, lower
observed chord deviation and closer area for this seed only. Actual edited
arc-sketch circlecentre[30,1]/r3 and corrected decimalcentre[.2,.2]/r.1 retain
native Curve/Surface/UV bindings. Options/native forgeries and a demonstrably
Float32-collapsing but native-valid circle reject while prior data stays reusable.
Ordinary packet JSON read/admission is a demo artifact, not a document/exchange
format. Affected build/this run are prototype checks; broader validation,
renderer/UI/cylinder/general trim/solid/commercial claims remain deferred.

## Original circle prism candidate shell

`buildXYCirclePrismShell(profile,{shellId,heightMM})` returns owned
`{profile,baseFace,bundle,report}`. Exact circle request uses the actual original
circle profile and unmodifiedz0 planar trim face with baseFace IDshell+'_z_min'.
Authored profile/shell IDs are ASCII1..48, all native derived IDs<=80 and distinct.
Finite positive height0.001..10000mm supports fractions; original centre/radius/
computed-pole bounds remain. Existing Curve/Surface/Model/face/source schemas
stay strict. No compiled cylinder source/IR is invented.

Distinct xy-circle-prism-shell version0 bundle has construction/geometry/topology.
Construction retains exact original profile/shellID/height. World Model0 contains
six original native objects: bottom circle Curve, translated top Curve, seam
line, original bottom supporting plane, translated top plane, and actual
extrudeCurve(bottomCircle,[0,0,height]) ruled wall. Circle degree/knots/weights/
XYpoles remain, topZ translates; wall has9×2poles/U0..4/V0..1. Caps remain actual
rational disk trims, not full supporting squares or four planar walls.

Two seam vertices and three unique edges are explicit: bottom closed circle,
top closed circle, vertical seam line. Bottom/top closed edges each use their
own same seam ID at both endpoints/domain0..4; seam line has bottom/top IDs/
domain0..1. Three faces/loops contain six directed uses. Bottom face orientation
reverse and cap use reverse give outward-Z, top forward/+Z. Wall forward uses
bottomforward,seam-rightforward,topreverse,seam-leftreverse; the same unique
seam edge occurs twice on the same wall with distinct use/pcurve IDs. This is
a parameter seam with periodic:false, not a periodic or manifold certificate.

Cap UV curves retain actual original rational trim coefficients; top gets a
separate UV ID and translated supporting plane. Wall boundary UVcurves are
actual degree1native parameter lines: bottom[top]t0..4→[t,0][t,1], right[left]
v0..1→[4,v][0,v]. Use sense determines traversal, independent of increasing
native parameter. WallU remains0..4, never normalized to0..1. Pcurves are
explicit UV coordinates inside topology, not world-mm Model objects.

`validateXYCirclePrismShellBundle` owns32768values/depth14/arrays128/records24/
strings128 plain finite data, rebuilds actual base face/extrudeCurve/translated
curves-planes/seam/pcurves/topology, compares every coefficient/reference/ID/use
exactly, and runs original native validators. Directed native vertex IDs and
actual Curve/Surface endpoint/pcurve evaluations close each loop; each edge has
two opposite-sense uses, seam twice on wall. Finite1e-7mm comparison records
consistency, no construction healing or general topology proof. Actual wall
D1 uses interior halfspans; originalC0 knot D1 refusal remains.

Counts2vertices/3edges/6uses/3faces/3loops/6worldobjects are structural native
incidence. Report candidateClosedShell:true means canonical use/loop closure
only; geometricValidity:not-certified,topologyCertified:false,solid:false.
Original source/IDs/base trim report/domains/bounds/finite normals/incidence
remain. Reference volume pi*r*r*height, lateral2*pi*r*height and boundary
2*pi*r*r+2*pi*r*height are analytic family reference formulae, not integrated
certified solid properties. No ray/Boolean/STEP/document/graph/mesh/renderer
admission or generic stable topology/regularity claim is added.

```sh
pnpm --filter @barocss/cad build:library
node examples/cad-nurbs/circle-prism-shell-demo.mjs /tmp/barocss-circle-prism-shell-prototype
```

The short actual demo checks circlecentre[2,-3]/r4/height6, source0/baseFace/
actual ruled wall/top translation/seam points and every coedge UV/worldCurve/
Surface/closure/opposite-use reference. Actual wallhalfspans give radial normals,
bottom-/top+Z and references96*pi/48*pi/80*pi. Decimal[.2,.2]/r.1/height.3 and
an explicitly selected edited arc-sketch circle[30,1]/r3/height2 are admitted.
Ordinary finite native artifact read/validation is not a signed-zero product
file guarantee. Request/canonical geometry/UV/seam/use failures preserve prior
outputs. Affected build/this run are prototype checks; broader validation and
candidate curved-shell display/solid certification remain deferred.

## Original circle prism cap/wall display and seam lineage

`tessellateXYCirclePrismShell(bundle,{meshId,revision,segmentsPerQuarter})`
owns the actual circle-prism candidate and calls its unchanged canonical gate.
Exact options require distinct native-ID/Model-name ASCII meshID1..64, integer
revision0..2147483647 and k2..32. Returns owned packet/faceRanges/edgePaths/
edgeProvenance/report under unchanged PreviewPacket0/mm/right-handed-y-up/ccw.
Input bounds32768values/depth14/arrays128/records24/strings128 stay unchanged.

N=4*k native parameter samplesj/k retain original caps' world Curves and
rational UV pcurves. Each cap centre/boundary point and oriented normal comes
from its actual world plane SurfaceD1/represented inverseUV. Bottom winding/
normal reverses once by face orientation, not a second coedge reversal; top+Z.
Actual Curve/Surface binding is measured within1e-7mm, without rewriting/clamps.
Neither cap renders the supporting square or a separate analytic cylinder.

Wall points use actual ruled Surface point evaluation at U=t_j/t_{j+1},V0/1,
including valid C0 knot points. Each panel duplicates four vertices, triangles
[0,1,2]/[1,3,2], and assigns ONE actual normalized SurfaceD1 du×dv normal
sampled at its strict interior midpointU,V.5. Panel normalSampleUV/vertex and
scalar-index ranges are recorded. These are explicit faceted display normals,
not exact endpoint normals/smooth continuity/regularity. Existing D1 refusal
atU1/2/3 remains; no knot nudging/finite differences/radial substitutes.
WallU0..4 remains raw native UV, not normalized. Face ranges retain actual
face/Surface/role/orientation/domain and sampling lineage. Native faces stay3.

Vertices6*N+2,triangles4*N: k2 gives50/32, k8 gives194/128, k32 gives770/512.
All native and Float32 world triangles must remain finite/nonzero/outward with
positive dot against each assigned normal before packet adoption. Exact bounds
come from emitted positions. Native-valid Float32 collapse refuses display
with no recenter/rescale/heal/drop or caller mutation. Original native objects/
source/topology remain unchanged/reusable; cap/wall/panel duplication is display
connectivity only, no tolerance welding or native panel edges.

Exactly THREE original edge paths: bottom/top Curve0..4,N+1 samples each;
actual seam line0..1,two endpoints. Seam is drawn once. Both original uses are
retained per edge with use/face/Surface/loop/pcurve IDs/sense and actual UV
curve coefficients/sample bindings. Seam uses own the SAME wall atU4/U0 with
opposite senses; no invented second seam path or radial/panel CAD edges.
Native maximum129 circle path points at k32 exceeds existing GPU overlay's
64points/path. A later overlay consumer selects k2..15 (max61), with no split/
truncation/budget widening. Report only marks that path-budget eligibility,
not complete renderer interoperability.

Report retains original native595 candidate flags and IDs, local ranges/panel
normal provenance/sampling/bounds, actual cap/wall/total triangle area, native
reference boundary area and signed difference. Actual bottom/top Curve interval
midpoint-to-chord deviations and sampled Curve/Surface discrepancies are finite
observations, not certified maximum errors/solid mass/numerical/performance.
Uniform native parameter is not uniform angle. periodic:false,
candidateClosedShell:true as native structural observation only,
geometricValidity:not-certified,topologyCertified:false,solid:false remain.

```sh
pnpm --filter @barocss/cad build:library
node examples/cad-nurbs/circle-prism-shell-preview-demo.mjs /tmp/barocss-circle-prism-shell-preview-prototype
```

The short actual packet/provenance/file run checks maink2/k8/k32, every owning
Surface/UV/cap-normal or recorded panel-midpoint normal, native/Float32 winding,
cap area against actual disk sampling, three paths and repeated same-wall seam
uses. Original C0 D1 refusal stays. Decimal/fractional-height and edited arc
inputs retain native lineage. Ordinary packet/provenance JSON read uses numeric
JSON semantics, not signed-zero exchange. Invalid options/native references/
getters and actual native-valid Float32 collapse preserve earlier data. No
raster/GUI/cylinder grammar/document/graph/ray/Boolean/intersection/STEP/general
mesher or solid certification is claimed; broad validation is deferred.

## Original one-circle extrusion intent and native Save/Open

`evaluateXYCirclePrismDocument(document)` and
`updateXYCirclePrismDocument(document,patch)` return owned
`{document,sketchEvaluation,shell,report}`. Distinct authored format
barocss-xy-circle-prism-feature0/mm has exact root format/version/id/lengthUnit/
sketch/feature; feature exact id/kind:xy-circle-extrude/profileId/shellId/height,
height exact id/valueMM. Embedded actual arc-sketch intent must contain EXACTLY
ONE original circle matching profileId. Empty/multiple/quarter/missing references
reject in this family; standalone arc sketch remains unchanged.

Native evaluation calls actual arc-sketch evaluator, then actual circle-prism
constructor with original id/centre/radius and positiveheight. Source0/original
Curve/plane trim/candidate shell/UV/world Surfaces remain accessible with exact
native bindings; no analytic independent cylinder or compiled source/IR. Report
binds document/sketch/feature/profile/shell/centre/radius/seam/height IDs and
values/native domains/bounds/reference volume/candidate flags.

Authored slots are globally distinct ASCII1..64, with original profile/shell
1..48 under native admission. Referenced profileCurve and shell root IDs are
intentional same-entity references, not duplicate objects. Distinct authored
slots also cannot collide with native generated Curve/Surface/vertex/edge/use/
loop/pcurve IDs/Model names. No identifier rename/repair. All numeric edits/Open
retain original IDs. Radius/height finite fractional0.001..10000mm and original
centre/computed-pole bounds remain authoritative.

Patch permits one or more of EXACT centreMM,radiusMM,heightMM; centreMM is finite
XY. Whole owned candidate uses actual arc-sketch upsert of existing circle with
stable kind/slot/centre-radius-seam IDs, then actual native extrusion admission.
Failure leaves caller/native data unchanged/reusable. No IDs/lifecycle/rebind/
expression/general graph/constraint fields are added. British centreMM is the
patch name; the original arc intent retains its centerMM field unchanged.

Native evaluate/serialize/parse NEVER invokes display generation/Float32
admission. A valid distant small native circle can evaluate/save/open even when
separate preview sampling refuses display. Consumer meshID/revision/quality is
separate, excluded from intent. Display adoption remains a consumer transaction,
not a native validity condition. candidateClosedShell is structural only,
geometricValidity:not-certified,topologyCertified:false,solid:false remain.

Serialize/Open execute native candidate and save only canonical exact authored
root/sketch/feature numbers/order, preserving−0 with explicit numeric encoder.
No generated source/Model/topology/report/mesh/quality/camera/history. Own input/
patch4096values/depth10/arrays64/records12/strings128 rejects getters/symbols/
hidden/foreign/sparse/nonfinite. UTF-8<=128KiB, preparse lexical decoded-duplicate
key/depth/array/field budgets precede JSON.parse. Existing arc/linear/rectangle
Graph/cutout/project/source formats are strict and distinct, no silent migration.

```sh
pnpm --filter @barocss/cad build:library
node examples/cad-nurbs/circle-prism-document-demo.mjs /tmp/barocss-circle-prism-document-prototype
```

The short actual authored/native/file/packet demo starts centre[2,-3]/r4/h6
with reference96*pi, atomically changes centre[30,1]/r3/h2→18*pi and retains IDs.
Decimalcentre[.2,.2]/r.1/h.3 and height-only changes work. Actual saved bytes
read/parse/rebuild match native sources/coefficients/bindings; separate−0 intent
round trip stays. Separate previewk8 gives194v/128tri/three paths on admitted
seed/opened geometry. Native-valid[9000,9000]/r.001/h6 evaluates/saves/opens,
while separate high-subdivision Float32 preview actually refuses. Invalid refs/
geometry/IDs/getters/schema/text/bad combined edits preserve prior data. Affected
build/this run are prototype checks; UI/raster/solid certification and broader
validation remain deferred.

## Circle extrusion graph with shared fractional heights

`evaluateSketchCircleFeatureGraph(document)` and
`updateSketchCircleFeatureGraph(document,edits)` return owned
`{document,sketchEvaluation,parameters,features,report}`. Distinct
barocss-sketch-circle-feature-graph0/mm exact root fields are format/version/id/
lengthUnit/sketch/parameters/features. Embedded original arc-sketch retains0..8
circle/quarter profiles; used extrusion profiles must be circles. Unreferenced
valid quarters remain. No radius authority or profile coercion is introduced.

Parameters1..8 exact id/type:length/definition are finite fractional literals or
referenced offset definitions within±10000mm, including resolved values. Forward
references and all unused/suppressed dependencies resolve in deterministic
first-authored-ready topological order; missing/self/cycle/type/nonfinite/overflow
refuse with IDs/field. There is no rectangle-graph integer-height restriction,
generic expression/scalar/angle/unit conversion or external solver here.

Features1..4 exact id/kind:xy-circle-extrude/profileId/shellId/distanceParameterId/
suppressed reference an original circle and positive resolvedheight0.001..10000mm.
Shared height IDs may drive several circles; centre/radius stay original sketch
literal dimensions. Authored graph/sketch/profile/centre/radius/seam/endpoints/
parameter/feature/shell IDs are globally distinct ASCII1..64; used profile/shell
<=48 under one-circle native admission. SourceCurve/profile and shell/topology/
Model aliases reference the same entities. Generated native identities cannot
collide across distinct features/entities or unrelated authored slots. Source0
fixed Model container name profile remains scoped per original Model and may
repeat; it is not entered as a globally selectable native graph entity. Actual
one-circle projection admission still applies its own local authored/name checks.

Each feature projects an explicit derived one-circle document with graph.id,
original sketch.id and unchanged referenced circle, originalfeature IDs and
height{id:distanceParameterId,valueMM:resolved}. Actual one-circle evaluator
returns original source0/curve/trim/candidate shell/pcurves/native domains;
full sketch's original profile coefficients/source/IDs equal the projection.
Bindings label derived-one-circle-projection and retain full authored profile,
height graph dependency, local projection bindings/native geometry/face/domain
IDs. The projection is an evaluated candidate, not a persisted second authority.
Active features expose actual one-circle result; suppressedevaluation:null still
requires complete actual native candidate/identity admission. Separate original
shells, not union/assembly/mass/general solid proof; wholeGraphCertified:false.
Native evaluation/file/update never invokes preview/Float32 admission.

Exact edits optionally contain parameterEdits0..8/sketchEdits0..8/featureEdits0..4
with at least one actual operation overall. Existing parameter definitions and
feature suppression only, unique targets; no lifecycle/rebind/reorder/radius
binding. Sketch operations use the original arc updater with stable kind/IDs/
slots. All final references/dependencies/native features admit before owned
result; deleted referenced profile/malformed suppressed input refuses, leaving
prior intent/source/native outputs unchanged/reusable.

Save/Open execute native candidate and write only exact graph/sketch/authored
parameter definitions/features, preserving−0/order/booleans. No resolved cache/
projection docs/source/Model/topology/mesh/quality/camera/history/reports. Own/
parser8192values/depth10/arrays64/records12/strings128, UTF-8<=128KiB and lexical
decoded-duplicate-key/budget guard before JSON.parse. Existing standalone circle/
arc/rectangle/cutout/source formats stay strict and distinct, no migration.

```sh
pnpm --filter @barocss/cad build:library
node examples/cad-nurbs/sketch-circle-feature-graph-demo.mjs /tmp/barocss-sketch-circle-feature-graph-prototype
```

The short native/API-file/separatepacket run uses shared base6/raised+.5 giving
heights6/6.5 and references96*pi/58.5*pi. Base8 and combined original circle
centre/radius+base2 edits regenerate native shells with stable IDs; suppression/
restore, fractionaldecimal construction, unreferencedquarter and shared source
alias remain. Actual files restore authored/native/−0; separatek8packet per
active result is a consumer only. Native-valid distant small graphSave/Open
succeeds even when separate Float32 preview refuses. Limited dependency/identity/
reference/edit/schema/getter controls preserve earlier data. Affected build/this
run are prototype checks; UI/solver/Boolean/solid/commercial certification and
broader validation remain deferred.

## Original circle feature lifecycle and reference repair

`editSketchCircleFeatureGraphFeatures(document,edits)` is additive and returns
the existing circle graph result. Exact required featureOperations1..8 plus
optional parameterEdits0..8/sketchEdits0..8 reuse current native definitions/
arc sketch operations; no new graph format or public updater acceptance. Each
exact upsert(feature) or remove(featureId) target occurs once per transaction.

Existing feature upsert keeps id/kind/shellId/authored slot; only circle/height
reference and suppression change. New feature/shell IDs are fresh relative to
ALL starting/new authored slots and actual selectable starting native IDs,
including removed ones. Native source0's repeated Model containernameprofile
stays scoped, not a global reservation. Original sourceCurve/profile and shared
height aliases stay explicit. Removal resolves a STARTING feature, never an
unknown/newly added ID or same-target delete/recreate. Survivors keep relative
order, new entries append by operations. Final1..4features, bounded working<=8:
a full graph may atomically createfourfresh thenremovefourold in eightoperations.
Finalempty refuses; allsuppressed remains valid after native admission.

Starting complete native evaluation captures selectable generated identities
for active AND suppressed candidates. Only needed private feature-admission/
input-edit/identity-observation helpers are shared with unchanged public graph
behavior. Feature/parameter/sketch edits form one owned candidate; no invalid
intermediate public updater. Delete referenced circle only when every final
user is removed/rebound explicitly in that transaction. New circle and feature
can be authored together. All final dependencies/profiles/suppressed native
features admit through actual graph/one-circle/candidate-shell pipeline before
return. Previous caller/source/native output stays exact/reusable on failure;
no implicit cascade/rename/geometry repair. New sketch IDs cannot recycle a
removed starting authored/native ID or new feature/shell ID; existing original
roles stay. Source/native generated collision checks remain authoritative.

Existing graph0/native-only Save/Open preserves authored definitions/features/
order/−0/booleans, no operation/result/projection/preview cache. No preview or
Float32 admission is imported into this native transaction. Original bounded
snapshot8192values/depth10/arrays64/records12/strings128 and native frame limits
stay; existing APIs/source/file/packet versions remain strict. Limited stable
shell naming is not a generic topology-history certificate. No parameter
lifecycle/reorder/expressions/mixed graph/UI/solver/Boolean/assembly claim.

```sh
pnpm --filter @barocss/cad build:library
node examples/cad-nurbs/sketch-circle-feature-lifecycle-demo.mjs /tmp/barocss-sketch-circle-feature-lifecycle-prototype
```

The short native lifecycle/file demo adds a sharedsource C, rebinds it to another
original circle/derivedheight whilebase changes, removes now-unreferencedAfeature
andcircleA together, adds a freshcircle/feature in one candidate, and replaces
fourfeatures withfourfresh in eightoperations. Actual projected native geometry/
UV/domain/bindings, suppression, fractionalheight, saved/reopened−0 and previous
native outputs remain. One separate previewk8 call is consumer-only; tiny
native validity is independent of display. Concrete reference/identity/schema/
cycle/getter controls refuse. Affected build/this run are prototype checks;
UI/general topology/solid certification and broader validation remain deferred.

## Original circle height parameter creation and removal

`editSketchCircleFeatureGraphParameters(document, edits)` adds and removes typed
fractional length parameters in the existing circle graph0 document. It returns
the same owned `SketchCircleFeatureGraphResult`. Existing graph evaluation,
definition updates, feature lifecycle and Save/Open APIs retain their contracts.

```js
const result = cad.editSketchCircleFeatureGraphParameters(document, {
  parameterOperations: [
    { kind: 'upsert', parameter: {
      id: 'replacement_height', type: 'length',
      definition: { kind: 'literal', valueMM: 3.25 },
    } },
    { kind: 'remove', parameterId: 'base' },
    { kind: 'upsert', parameter: {
      id: 'raised', type: 'length',
      definition: { kind: 'offset', parameterId: 'replacement_height', offsetMM: 0.5 },
    } },
  ],
  featureOperations: [
    { kind: 'upsert', feature: {
      ...document.features[0], distanceParameterId: 'replacement_height',
    } },
  ],
});
```

Every remaining offset and active or suppressed feature must have a valid final
reference. If other features reference `base`, explicitly repair them in the same
batch. The function does not cascade deletion or retarget references.

Edits require1..16 parameter operations. Optional present feature operations and
sketch edits each require1..8 entries; definition-edit and suppression-edit aliases
are unsupported. Each target occurs once. Existing parameters retain their ID,
length type and authored slot; fresh parameters append. Remove resolves a starting
parameter. Final counts remain1..8 parameters and1..4 features. A bounded working
array of16 parameters permits eight fresh additions followed by eight removals.
Same-batch forward dependencies resolve only after the entire candidate is ready.

Starting authored and selectable native IDs remain reserved after removal. Fresh
parameter, feature, shell and sketch identities must be distinct, including actual
generated native IDs. Original source/shell aliases remain valid. All parameters
and suppressed features receive full native admission. Heights remain fractional
0.001..10000mm; unused negative/zero lengths remain valid under existing rules.
Circle radius stays an original sketch literal. This API adds no radius binding,
solver, Boolean, assembly or general solid certificate.

Canonical graph0 files preserve authored definitions/order/IDs/booleans/signed
zero. Operations, resolved caches, native output and preview state are not saved.
Native edit/file admission imports no preview or Float32 display gate. Failure
leaves the caller's intent and existing native outputs unchanged.

```sh
pnpm --filter @barocss/cad build:library
node examples/cad-nurbs/sketch-circle-parameter-lifecycle-demo.mjs /tmp/barocss-sketch-circle-parameter-lifecycle-prototype
```

The short prototype demo compares actual original587/599/595 lineage, atomic
reference repair, sixteen-operation replacement, fractional heights and real
file readback, with one separate596k8 display output. Broader validation remains
deferred. Candidate reports retain `wholeGraphCertified:false`,
`geometricValidity:'not-certified'`, `topologyCertified:false` and `solid:false`.

## Named parameters driving original circle radii

`evaluateDrivenSketchCircleFeatureGraph`, `updateDrivenSketchCircleFeatureGraph`,
`serializeDrivenSketchCircleFeatureGraph` and `parseDrivenSketchCircleFeatureGraph`
add a distinct authored format: `barocss-driven-sketch-circle-feature-graph`,
version1/mm. Its embedded sketch is `barocss-driven-xy-arc-sketch`, version0/xy.
Existing literal arc-sketch0 and circle feature graph0 formats remain strict.

A circle retains its original profile/centre/radius-dimension/seam IDs and literal
centre. Its radius is exactly one authority:

```js
radius: { id: 'A_radius', definition: { kind: 'parameter', parameterId: 'r' } }
// Or: radius: { id: 'A_radius', definition: { kind: 'literal', valueMM: 4 } }
```

The radius dimension ID differs from the referenced length parameter ID. There is
no sibling resolved value or fallback. Original quarter-arc profiles use the same
radius envelope with a literal definition only. Parameter-driven quarters refuse.

The result is `{document, parameters, profileDimensions, projection, nativeGraph,
report}`. The authored `document` contains the original definitions. The shared
original fractional length resolver supplies radii and heights. `projection` is
an explicitly derived old graph0/literal sketch0; actual original587/601/599/595
admission constructs every native Curve/Surface/topology/UV. `nativeGraph` is the
actual old graph result. New report bindings label `resolved-radius-projection`,
retain authored/projection versions and IDs, radius definitions/dependencies,
original profile/feature bindings and actual face/edge/loop/use/pcurve identities.
Suppressed features retain identity bindings and actual native admission.

```js
const next = cad.updateDrivenSketchCircleFeatureGraph(document, {
  parameterEdits: [
    { parameterId: 'r', definition: { kind: 'literal', valueMM: 3 } },
    { parameterId: 'base', definition: { kind: 'literal', valueMM: 8 } },
  ],
  circleEdits: [
    { profileId: 'circle_B', radiusDefinition: { kind: 'parameter', parameterId: 'rB' } },
  ],
});
```

Updates accept optional parameterEdits0..8, circleEdits0..8 and featureEdits0..4,
with at least one actual operation. Circle edits require an existing circle ID
and centre and/or radius definition; feature edits change suppression only. IDs,
kinds and authored slots stay fixed. Apply all owned edits before resolving the
final radii/native graph, so reference, centre and definition repairs are atomic.
No parameter/profile/feature lifecycle, height rebind, general formulas or solver
is added here. The old graph0 lifecycle APIs retain their original format.

Every profile, unused parameter and suppressed feature validates. Radii resolve
to0.001..10000mm and pass original coefficient/bounds checks. Original height,
identity, alias and scoped source-Model rules remain. Native input/edit/file paths
import no preview or Float32 display gate. Failed candidates retain caller data
and reusable original native outputs. Existing8192-value/depth10/array64/record12/
string128 and128KiB JSON guards apply, including decoded duplicate-key refusal.

Save/Open preserves only authored format/sketch/definitions/features/order/IDs/
booleans/signed zero. Derived radii, projections, native results, packets and view
state are excluded. Separate candidate shells retain `wholeGraphCertified:false`,
`geometricValidity:'not-certified'`, `topologyCertified:false` and `solid:false`.

```sh
pnpm --filter @barocss/cad build:library
node examples/cad-nurbs/driven-circle-radius-graph-demo.mjs /tmp/barocss-driven-circle-radius-prototype
```

The short native prototype uses shared and offset radius dependencies, atomic
radius/height/centre edits, original literal quarters, decimal native UV and actual
file readback, with one separate596k8 display packet. Broader validation and an
interactive radius-driving workspace remain separate work.

## Driven circle graph parameter and feature lifecycle

`editDrivenSketchCircleFeatureGraphParameters(document, edits)` adds/removes typed
fractional length parameters and original circle extrusion features in the existing
one-authority driven graph1. It returns the same `DrivenSketchCircleFeatureGraphResult`.

```js
const next = cad.editDrivenSketchCircleFeatureGraphParameters(document, {
  parameterOperations: [
    { kind: 'upsert', parameter: {
      id: 'replacement_radius', type: 'length',
      definition: { kind: 'literal', valueMM: 3.25 },
    } },
    { kind: 'remove', parameterId: 'r' },
  ],
  circleEdits: [
    { profileId: 'circle_A', radiusDefinition: {
      kind: 'parameter', parameterId: 'replacement_radius',
    } },
    { profileId: 'circle_B', radiusDefinition: { kind: 'literal', valueMM: 1 } },
  ],
});
```

Every remaining offset, circle radius and active or suppressed feature height must
reference an existing valid final length parameter. If other definitions/features
reference `r`, explicitly repair them in the same batch. There is no cascade or
fallback. A literal radius switch keeps the original radius dimension identity.

Edits require1..16 original parameter upsert/remove operations. Optional present
feature operations and driven circle edits each require1..8 entries. Each target
occurs once. Existing parameter IDs/types/slots and feature IDs/kinds/shells/slots
stay fixed; fresh parameters/features append. Remove resolves a starting item.
Working limits16 parameters/8 features permit eight-for-eight parameter and
four-for-four feature replacement together. Final counts remain1..8 and1..4.

The original accepted graph is admitted once to reserve every authored and actual
selectable native identity, including suppressed candidates and removed items.
Apply all owned operations and circle edits before the complete final radius,
dependency and native evaluation. No partially edited candidate is admitted.
New parameters/features/shells cannot recycle an old authored or generated ID.
Circle/profile lifecycle is unsupported; centre/radius edits retain original IDs.
All unused definitions/profiles and suppressed features validate.

Actual original601/603/604 staging rules and resolver are shared internally;
original587/599/595 geometry/UV/source bindings remain authoritative. Old graph0
and its lifecycle APIs remain strict. Driven graph1 Save/Open stays canonical
with definitions/references/order/IDs/booleans/signed zero only; operation logs,
resolved radius values and derived native/display results are not persisted.
Native file admission imports no Float32 preview gate. Reports remain uncertified.

```sh
pnpm --filter @barocss/cad build:library
node examples/cad-nurbs/driven-circle-parameter-lifecycle-demo.mjs /tmp/barocss-driven-circle-parameter-lifecycle-prototype
```

The short native demo covers fresh shared radius/height authoring, explicit atomic
reference repair/removal, full replacements, actual original projection/binding
comparisons and file readback, plus one ordinary596k8 display packet. Broader
validation, interactive lifecycle UI, general solver/topology/Boolean operations,
exchange and assemblies remain separate work.

## Original driven circle and quarter profile lifecycle

`editDrivenSketchCircleFeatureGraphProfiles(document, edits)` adds, updates and
removes original circle/quarter profiles in the existing authored driven graph1.
It returns the same owned `DrivenSketchCircleFeatureGraphResult`.

```js
const next = cad.editDrivenSketchCircleFeatureGraphProfiles(document, {
  profileOperations: [
    { kind: 'upsert', profile: {
      id: 'circle_C', kind: 'circle', centerId: 'C_center', centerMM: [30, 2],
      radius: { id: 'C_radius', definition: { kind: 'parameter', parameterId: 'r' } },
      seamId: 'C_seam',
    } },
    { kind: 'remove', profileId: 'circle_A' },
  ],
  featureOperations: [
    { kind: 'upsert', feature: { ...document.features[0], profileId: 'circle_C' } },
  ],
});
```

Explicitly repair every remaining feature using a removed circle. The API does
not clone, retarget or cascade features. New circles may reference fresh forward
length parameters and fresh features in the same complete candidate.

Required profileOperations1..16 reuse the exact original driven profile shapes.
Optional present parameterOperations1..16 and featureOperations1..8 reuse original
staging rules. Each target occurs once; remove resolves a starting profile. New
profiles append with fresh profile/centre/radius/seam/endpoint identities. Existing
profile IDs/kinds/centre IDs/radius dimension IDs/slots remain; circle seam IDs and
quarter quadrants/endpoint IDs/order remain. Existing upsert changes only literal
centre and radius definition. Circle radius has one literal-or-length authority;
quarter radius is literal-only. Kind/orientation conversion and rename refuse.

Working16 profiles/16 parameters/8 features permit complete replacements before
final0..8 profiles/1..8 parameters/1..4 features are checked. Each final feature
references an admitted circle; unused quarters do not supply extrusion caps.
All profiles/parameters/suppressed references receive complete native admission.
No intermediate count, radius, dependency or partial native candidate is adopted.

Starting authored and actual generated roles stay reserved after deletion.
New authored IDs are distinct from old and fresh transaction slots; actual final
generated descendants are checked against both original role maps, retaining
only intentional source/shell aliases and stable same-entity descendants. Actual
original587/554 rational curves and601/599/595 native outputs remain authoritative.
The canonical driven graph1 serializer/parser stays unchanged, with authored-only
IDs/order/definitions/booleans/signed zero and no projection/operation/result cache.
Native edit/file admission imports no596 or Float32 display gate. Failed candidates
retain caller data and previous whole native results.

```sh
pnpm --filter @barocss/cad build:library
node examples/cad-nurbs/driven-circle-profile-lifecycle-demo.mjs /tmp/barocss-driven-circle-profile-lifecycle-prototype
```

The short prototype demo exercises original circle/quarter authoring, shared
radius and feature reference repairs, eight-for-eight profile replacement, actual
original source/coefficient/domain/UV/binding comparisons and file readback, plus
one ordinary596k8 packet. This adds no drawing/snapping UI, general constraints,
Boolean, exchange or assembly. Reports remain not-certified/solid:false; broader
validation remains deferred.

## Full-turn Z-axis revolved NURBS surface

`buildZAxisRevolvedSurface(meridian, {surfaceId})` constructs an original tensor
product surface from a real XZ meridian Curve and the actual original554 full
circle basis. It returns owned `{meridian, source, sourceVersion:0, model, surface,
construction, report}` adopted from actual literal source0 compilation.

```js
const result = cad.buildZAxisRevolvedSurface({
  kind: 'curve', id: 'meridian', degree: 1, knots: [2, 2, 7, 7],
  controlPoints: [[2, 0, 0], [4, 0, 6]], weights: [1, 1],
}, { surfaceId: 'frustum_wall' });
```

Accept degree1..3,2..16 original poles and valid finite open-clamped knots. Every
pole is `[radius,0,z]`, radius0.001..10000mm, |z|<=10000mm. Meridian weights remain
within actual1e-6..1e6 limits; every generated product weight must also be native
valid. A lowest-bound input weight can therefore refuse after multiplication by
an angular weight. No weight normalization, snapping or healing is performed.
Curve/surface IDs are distinct ASCII1..48. Exact owned Curve/options records and
1024-value/depth6/array64/record8/string128 guards reject malformed/accessor data.
A constant meridian, axis/apex/negative radius and off-plane poles refuse.

U retains the original meridian degree, knots, weights and domain; V is the real
original quadratic circle domain0..4. With angular poles[a,b,0] and weightsq,
poles are[r*a,r*b,z] and weightsw*q. The returned source0 contains the original
meridian and constructed surface, with exact coefficients/order/IDs/signed zero
verified against the real compiler. Private angular helper IDs are not persisted.
Write/read/recompile this source as native geometry; it is not a feature-intent
Save/Open document or a new source dialect.

The report records original domains/control counts/endpoints, actual closed
angular seam coefficients, finite sampled boundary correspondence and existing
D1 guard knot parameters. Closure does not assert periodicity. Exact C0 interior
knots retain the original native D1 refusal. Report remains
`geometricValidity:'not-certified'`, `topologyCertified:false`, `solid:false`.
Only full360 degrees around global +Z at origin is supported. Partial/arbitrary
axis revolution, axis crossing, caps, trim faces, shells/solids and UI are separate.
Native construction imports no preview or Float32 path.

```sh
pnpm --filter @barocss/cad build:library
node examples/cad-nurbs/z-axis-revolve-surface-demo.mjs /tmp/barocss-z-axis-revolve-surface-prototype
```

The one native prototype demo uses real cylindrical, sloped, rational curved,
piecewise and shifted-domain meridians. It compares points and D1 product-rule
witnesses to actual original curves, preserves C0 refusals and recompiles real
source files including decimals/-0. Broader validation and original readers,
exports, display, capped part features and commercial certification remain deferred.

## Authored Z-axis revolve feature and pole edits

`evaluateZAxisRevolveFeatureDocument`, `updateZAxisRevolveFeatureDocument`,
`serializeZAxisRevolveFeatureDocument` and `parseZAxisRevolveFeatureDocument`
use distinct `barocss-z-axis-revolve-feature` version0/mm authored documents:

```js
const document = {
  format: 'barocss-z-axis-revolve-feature', version: 0,
  id: 'revolve_document', lengthUnit: 'mm',
  meridian: { kind: 'curve', id: 'meridian', degree: 1,
    knots: [2, 2, 7, 7], controlPoints: [[2, -0, -0], [4, 0, 6]], weights: [1, 1] },
  feature: { id: 'revolve_feature', kind: 'z-axis-revolve', surfaceId: 'revolved_wall' },
};
const next = cad.updateZAxisRevolveFeatureDocument(document, {
  poleEdits: [{ index: 0, radiusMM: 3 }, { index: 1, radiusMM: 5, zMM: 8, weight: 0.9 }],
});
```

Document/feature/meridian/surface IDs are distinct ASCII1..48. The original Curve
is the only geometric authority. Fixed full-turn global +Z semantics use actual
`buildZAxisRevolvedSurface` as the sole evaluator. Result is owned
`{document, native, report}`; bindings identify the authored IDs, actual source0
Model/domain and original pole-to-surface-row relationship. Native flags remain
not-certified/topologyCertified:false/solid:false.

Updates require exact poleEdits1..16. Each existing integer index occurs once,
with at least one finite radiusMM/zMM/weight scalar. Apply all owned edits before
one actual610 evaluation. IDs/kind/degree/knots/count/order and y, including -0,
stay fixed. No pole add/remove, reorder, knot/degree/axis edit, normalization,
clamp or generated Surface edit. Actual610 positive-radius XZ/native product
weight and coefficient limits apply to the whole final candidate. Failure retains
caller intent and previous document/native/source results exactly.

Canonical Save/Open persists only authored format/version/ID/mm/meridian/feature
fields, with original coefficients/order/domain/signed zero. Generated Surface,
source/angular helper/projection/report/operations/view/history are excluded.
The actual parser performs native evaluation before accepting, with4096 own
values/depth8/arrays64/records12/strings128/UTF-8 JSON128KiB and decoded duplicate
key protection. Old schemas are not guessed or migrated. Native source0 geometry
files from610 remain separate from this editable authored JSON. Neither path
imports preview or Float32 admission.

```sh
pnpm --filter @barocss/cad build:library
node examples/cad-nurbs/z-axis-revolve-document-demo.mjs /tmp/barocss-z-axis-revolve-document-prototype
```

The short prototype demo compares complete standalone610 native output, atomic
multiple-pole/full16-pole edits, shifted domains/decimals/-0 and real authored
file readback. Broader validation, readers/exports, UI, caps/topology/solid and
commercial part completion remain separate work.

## Native revolved Surface preview and parameter boundaries

`tessellateZAxisRevolvedSurface(meridian, options)` calls actual610 once, then
samples its original Surface into PreviewPacket0. Options are exact and explicit:

```js
const display = cad.tessellateZAxisRevolvedSurface(meridian, {
  surfaceId: 'revolved_wall', meshId: 'revolve_display', revision: 0,
  segmentsPerMeridianSpan: 2, segmentsPerQuarter: 8, orientation: 'forward',
});
```

Result is `{native, packet, panels, boundaryPaths, boundaryProvenance, report}`.
`native` retains the complete original610 Curve/Surface/source/Model. Packet
surfaceId is the display mesh ID; native IDs remain in explicit provenance.
No generated Surface/cache is accepted as input authority. Native IDs are ASCII48,
mesh ID64, revision0..2147483647; descriptor checks refuse unknown/getter options.

U splits at every original positive knot span with1..2 subdivisions. V splits at
original circle quarters with2..8 subdivisions. Four independent vertices and two
triangles form each panel. Original endpoint point queries include C0 boundaries;
strictly interior actual D1 supplies one faceted normal per panel. Forward uses
du cross dv; reverse flips both normals and triangle winding. Neither is labelled
globally outward. No smoothing, welding, epsilon, skipping or quality healing.
Unsafe/zero native derivatives, unrepresentable intervals and degenerate native
or world Float32 triangles refuse display while native geometry stays separate.

The full16-pole/15-span case at U2/V8 has960 panels,3840 vertices and1920 triangles,
within original CAD/GPU packet limits. Bounds are sampled extrema. Original UV,
panel ranges and smooth normalSampleUV remain explicit. Normals are
native-midpoint-faceted; no certified approximation/shape/area/volume bound.

Exactly three display paths bind Surface parameter boundaries: Umin ring, Umax
ring and one original meridian seam. Rings have<=33 points; seam<=31. Provenance
contains source surface/meridian IDs, native sample parameters and complete UV
locations. Seam points compare to Surface(U,0) and Surface(U,4) within1e-7mm.
Coincident end rings retain distinct parameter roles. These are not topology
edges/faces/loops; no grid/triangle diagonals or duplicate seam path is generated.
All paths fit existing64-point GPU overlay limits. Native coefficient closure
remains periodic:false and not-certified/topologyCertified:false/solid:false.

```sh
pnpm --filter @barocss/cad build:library
node examples/cad-nurbs/z-axis-revolve-preview-demo.mjs /tmp/barocss-z-axis-revolve-preview-prototype
```

The one actual native demo compares original points/D1/panels/UV/winding/boundary
bindings, both orientations, edited612 meridians and maximum counts. Packet and
provenance files are ordinary display artifacts, with JSON numeric-zero semantics;
native source0 read/compile remains distinct. Deeper validation, GPU pixels/UI,
physical performance, caps/topology/solid and commercial completion are separate.

## Compatible original two-curve ruled Surface

`buildCompatibleRuledSurface(first, second, {surfaceId})` connects two separately
authored original 3D Curves sharing exactly the same native basis. It returns
owned `{first, second, source, sourceVersion:0, model, surface, construction, report}`.

```js
const surface = cad.buildCompatibleRuledSurface(firstSection, secondSection, {
  surfaceId: 'ruled_sections',
});
```

Each section has degree1..3,2..16 poles, finite XYZ coordinates within10000mm,
positive native weights and original valid open-clamped knots. The three IDs are
distinct ASCII1..48. Exact degree/pole count/ordered knots/weights match, including
Object.is signed-zero knot identity. No knot/weight normalization, fitting,
resampling, reversal/alignment, degree operation or implicit compatibility repair.
There is no plane restriction; coincident/crossing/singular sections can remain
valid native parametric data without a regularity or solid certificate.

U follows the common original section parameter; V is linear interpolation0..1.
Surface row i copies first/second poles and their common weights, degreeV1 with
knotsV[0,0,1,1]. Thus original native Surface evaluation gives the Cartesian blend
of original Curve values. Construction keeps explicit row-to-section-pole IDs.
Both Curves and Surface are literal source0 compiled once; complete original
coefficients/order/IDs/domain/signed zero match before adopting the actual Model.
No generated Surface/cache is accepted as authoring authority.

The report records bounded point/blend observations at endpoints, original knots
and representable span midpoints, U guarded knots and original domains/counts.
Local1e-7mm witnesses are not a global error certificate. Existing
extractSurfaceBoundary orientation remains authoritative; v-max/u-min boundaries
use reversed parameter mappings. Four parameter boundaries are not B-Rep edges.
Flags remain periodic:false/not-certified/topologyCertified:false/solid:false.

```sh
pnpm --filter @barocss/cad build:library
node examples/cad-nurbs/compatible-ruled-surface-demo.mjs --source
```

The affected library build is an artifact checkpoint. The actual demo consumes
src/index.ts with installed esbuild in memory (write:false); it does not import
CAD dist or build dependencies on each run. Source graph evidence is retained.
Skewed lines/rational sections/shifted knots/C0/max16/coincident and translated
extrusion cases compare original points/D1/boundary mappings and actual source
file read/compile. A future editable consumer joins unified editor615. General
loft, sweep, caps/topology/solid/exchange and deeper validation remain separate.

## Original rational Curve knot insertion

`insertCurveKnot(curve, {knot, insertions})` refines the original control polygon
in homogeneous coordinates. The locally implemented convex recurrence follows
standard knot insertion, identified as A5.1 in the [official helper reference](https://nurbs-python.readthedocs.io/en/latest/module_utilities.html#geomdl.helpers.knot_insertion).
The reference describes the operation; actual native witnesses validate this code.

```js
const result = cad.insertCurveKnot(originalCurve, { knot: 0.5, insertions: 2 });
```

Result is owned `{original, refined, source, sourceVersion:0, model, provenance,
report}`. Exact Curve/options data, ASCII ID48, degree1..3, initial/final poles<=16,
XYZ±10000mm and original native knots/positive weights are required. The finite
knot is strictly inside the original domain, insertion count1..3 and final numeric
multiplicity<=degree. Mathematical +0/-0 knots count together; their original
stored bits remain. Endpoints/no-op counts/overflow/malformed data refuse.

Each requested insertion uses homogeneous[w*x,w*y,w*z,w] convex blends. Unchanged
original entries copy their Cartesian coefficients/weights directly, preserving
Object.is endpoint/unaffected bits. Homogeneous generated entries remain in that
form across repeated insertion; final generated Cartesian values use actual
binary64 projection. Original degree/ID/domain and every old knot/order remain.
Finite positive native output, denominator and strict convex coefficient checks
refuse unsafe arithmetic without clamp/snap/knot or weight normalization.

The refined source0 Curve is compiled through the actual native compiler and
adopted only after complete coefficient/ID/order/domain bit comparison. Explicit
provenance maps original unaffected poles/knots and local insertion steps. Bounded
point observations compare actual original/refined evaluators at breakpoints and
representable span interiors. Local1e-7mm admission is not a global error bound.
The existing D1 guard stays unchanged: a newly repeated knot can be guarded even
when the insertion intends unchanged geometry. No continuity certificate, fitter,
removal, degree elevation, Surface refinement or topology operation is supplied.
Flags remain not-certified/topologyCertified:false/solid:false.

```sh
pnpm --filter @barocss/cad build:library
node examples/cad-nurbs/curve-knot-insertion-demo.mjs --source
```

One final artifact build is separate from the actual in-memory src API/file demo;
no CAD dist import or per-demo dependency build. Actual554 rational quarters,
original lines/rational/cubic/shifted/repeated/max-pole inputs compare points and
smooth D1 while retaining guards and real source file identity/-0. Refined curves
feed actual610 revolve and actual616 compatible ruled consumers with observed
geometry retention. Later control-polygon tools join unified editor615; broader
validation and commercial modelling capabilities remain tracked separately.

## Atomic original Surface control-net edits

`editSurfaceControlNet(surface, {poleEdits})` changes Cartesian coordinates and
weights of a directly authored original rational Surface in one transaction.
Each edit specifies `uIndex`, `vIndex` and at least one of `xMM`, `yMM`, `zMM`
or `weight`. Between 1 and 16 unique existing poles can be requested.

```js
const edited = cad.editSurfaceControlNet(originalSurface, {
  poleEdits: [{ uIndex: 1, vIndex: 1, zMM: 2, weight: 1.5 }],
});
```

The owned result contains `{original, surface, source, sourceVersion:0, model,
provenance, report}`. Original ID, degrees, ordered knots, domains and grid size
remain. All unrequested coefficients retain their Object.is bits, including -0.
Provenance distinguishes requested fields from fields whose stored values change.
An explicitly requested equal value is valid; an empty or fieldless edit refuses.

Original native validation admits degree 1..3, rectangular grids 2..16 per axis,
positive weights 1e-6..1e6 and finite XYZ coordinates within +/-10000 mm. The ID
is ASCII 1..48. Own-data snapshots allow 4096 values, depth 8, dense arrays up to
64 elements, plain records up to 8 fields and strings up to 128 characters.
Getter, hidden, foreign, sparse, duplicate and unknown data refuse. The complete
staged net is validated before adoption; caller data and prior results are owned
and reusable after success or refusal.

Literal single-Surface source0 is compiled once through compileCadModel. The
actual Model is adopted only after full coefficient, ID, order and signed-zero
comparison. Editing a generated revolve or ruled Surface creates detached
Surface source. It does not reverse-write its original meridian or sections.
No fitting, normalization, pole insertion, boundary locking or linked-feature
repair is implied.

The report records actual domains, degrees, grid counts, changed and untouched
field counts, and finite before/after point observations. These differences show
local editing effects; they are not an error bound or a regularity certificate.
Singular nets remain valid native parametric data where native validation accepts
them. Flags remain not-certified/topologyCertified:false/solid:false.

```sh
pnpm --filter @barocss/cad build:library
node examples/cad-nurbs/surface-control-net-demo.mjs --source
```

One artifact build is separate from the in-memory installed esbuild source API
flow, which imports no CAD dist and writes no library bundle. The demo exercises
bilinear, rational quadratic/cubic, shifted C0, actual quarter-arc extrusion and
16x16 nets with atomic edits. It compares native D1, original guards, parameter
boundaries, actual source file read/compile and one existing tessellateSurface
packet with its original preview approximation semantics. Ordinary packet JSON
is display evidence. Selection and property controls belong in the unified
editor; broader validation and commercial modelling capabilities remain separate.

## Original rational Surface knot insertion

`insertSurfaceKnot(surface, {axis, knot, insertions})` refines one original U or V
parameter axis through the existing `insertCurveKnot` API on each rational strip.
U strips follow a fixed V pole; V strips follow a fixed U row. Each strip retains
homogeneous coefficients across all requested insertions through that existing
implementation. The complete refined net is staged before native adoption.

```js
const refined = cad.insertSurfaceKnot(originalSurface, {
  axis: 'u', knot: 0.5, insertions: 2,
});
```

The owned result contains `{original, refined, source, sourceVersion:0, model,
provenance, report}`. Options are exact own data. The knot is finite and strictly
inside the selected original domain. Insertions are integer 1..3, final numeric
multiplicity is at most the selected degree, and final grids are at most 16x16.
Original degree U/V is 1..3; original native open-clamped knots, positive weights
1e-6..1e6, ASCII ID 1..48 and finite XYZ within +/-10000 mm remain required.
Surface snapshots allow 4096 values, depth 8, arrays up to 64, records up to 8
fields and strings up to 128. Empty, unknown, hidden, sparse, foreign, getter,
unsafe arithmetic, multiplicity and grid overflow data refuse atomically.

All strips must agree on selected knot bits, original mappings and insertion
steps. Only private temporary Curve IDs are used; the output Model contains one
Surface with its original ID. Provenance records actual per-strip Curve results,
selected original knot mappings and directly unaffected Surface pole mappings.
Original ID/degrees/U and V domain bits, nonselected knots and directly unaffected
pole/weight bits remain, including -0. Numeric +0/-0 multiplicities count together.
Generated binary64 coefficients are calculated values; no fitting, normalization,
parameter rebase, degree operation, knot removal or output healing is provided.

The refined Surface is literal source0 compiled once at Surface level. Actual
compiled Model adoption requires complete Object.is net/ID/order/knot/weight and
domain comparison. Copied edited/revolved/ruled Surfaces are direct Surface
inputs. Refinement does not reverse-write the original linked authoring inputs.
Sequential U and V refinement uses two explicit operations.

The report contains actual axis, knot/count, domains, degrees, grid counts,
multiplicities, unchanged/generated counts and original/refined guarded knots.
Bounded native point observations cover selected breaks and representable span
interiors with at most three perpendicular parameters and 128 total samples.
Local 1e-7 mm acceptance is not a global shape error or continuity certificate.
Native D1 guards remain, including new repeated knots. Singular nets remain
native data where validators admit them. Flags remain
not-certified/topologyCertified:false/solid:false.

```sh
pnpm --filter @barocss/cad build:library
node examples/cad-nurbs/surface-knot-insertion-demo.mjs --source
```

One final artifact checkpoint is separate from the installed in-memory esbuild
source API flow, with no CAD dist import/write or dependency build inside the
demo. Bilinear, nonseparable rational quadratic/cubic, repeated/shifted/signed-zero,
near-limit, edited and existing generated inputs compare native points/D1, full
source file identity and mapped coefficient bits. One small existing preview
packet retains its native UV positions and approximation/normal admission.
Later refinement tools belong in the unified editor. General removal, degree,
fit, continuity, loft/sweep, trim/B-Rep/Boolean and broader validation remain separate.

## Original Surface parameter iso-Curve

`extractSurfaceIsoCurve(surface, {fixedAxis, parameter, curveId})` constructs an
original rational Curve at fixed U or V. Fixed U varies in original V; fixed V
varies in original U. The Curve follows increasing original parameter order.
It is a parameter construction, without trim/edge/intersection/topology meaning.

```js
const iso = cad.extractSurfaceIsoCurve(originalSurface, {
  fixedAxis: 'u', parameter: 0.5, curveId: 'section_v',
});
```

The owned result contains `{original, curve, source, sourceVersion:0, model,
provenance, report}`. Exact own original Surface/options use a 4096-value snapshot,
depth 8, arrays up to 64, records up to 8 and strings up to 128. Surface U/V degrees
are 1..3 and grids are 2..16 per axis/at most 256 poles. Original native clamped
knots, finite XYZ within +/-10000 mm and weights 1e-6..1e6 are required. IDs are
distinct ASCII 1..48. The finite parameter is inside the inclusive fixed domain.
Wrong axis, outside, unknown, getter/hidden/foreign/sparse/symbol/cyclic data,
ID collision or unsafe generated native coefficients refuse without healing.
Caller, original coefficients/domains and prior results remain reusable.

The unchanged existing local math basis function is shared internally. Package
index keeps every existing math export explicit and does not expose the basis.
For each varying pole, the interior construction sums original homogeneous
[B*w*x, B*w*y, B*w*z, B*w] terms, then divides XYZ by the positive finite W.
All basis values, factors, sums and projected coefficients must be finite and
pass native Curve/coordinate/weight validation. At fixed endpoints the original
row/column coefficients and weights copy directly, preserving Object.is signs
including -0. Varying degree, knot bits, count/order and domain bits remain.
No sampled fitting, inverse-weight dummy geometry, new evaluator, reversal,
parameter rebase, weight normalization or implicit source-feature update.

Actual compileCurveSource emits one source0 Curve and its complete compiled
Model is adopted only after Object.is coefficient/ID/degree/knot/domain comparison.
Provenance and report include fixed/varying parameters/domains, actual local basis,
per-pole original indices, homogeneous terms and endpoint copy mappings. Interior
binary64 coefficients are calculated values, not bit-exact real arithmetic.
Point observations cover varying endpoints, original breaks and representable
span interiors with at most 32 samples. Local 1e-7 mm comparison is not a global
error, normal, regularity or continuity certificate. Native Curve and Surface
D1 guards remain; a fixed C0 Surface knot can refuse Surface derivatives while
the varying iso-Curve admits a tangent. Flags remain
not-certified/topologyCertified:false/solid:false.

Existing extractSurfaceBoundary keeps its oriented convention: u-min and v-max
reverse varying parameter direction. Endpoint iso-Curves always increase. The
demo compares each using the correct original/reversed parameter mapping.

```sh
pnpm --filter @barocss/cad build:library
node examples/cad-nurbs/surface-isocurve-demo.mjs --source
```

One final artifact checkpoint is separate from installed in-memory esbuild source
API/file/downstream flow, with no CAD dist import/write or per-demo dependency
build. Both axes, interiors/endpoints, nonseparable rational/shifted/C0/full16x16,
actual edited/refined and existing generated inputs compare native points/D1,
bits, guards and real source file identity. One small interior iso-Curve feeds
existing extrusion and 5x5 preview packet validation/native UV/readback. Native
Curve success is separate from display approximation/normal admission. Later
selection/analysis belongs in the unified editor. General modelling, topology,
exchange and broader validation remain separate.

## Original Surface split at one parameter

`splitSurfaceAtParameter(surface, {axis, parameter, lowerSurfaceId, upperSurfaceId})`
creates two directly authored native patches in increasing original parameter
subdomains. This operation supplies a parameter cut, without arbitrary trim,
intersection, topology sewing or split-feature document meaning.

```js
const split = cad.splitSurfaceAtParameter(originalSurface, {
  axis: 'u', parameter: 0.5,
  lowerSurfaceId: 'lower_patch', upperSurfaceId: 'upper_patch',
});
```

The owned result contains `{original, refined, lower, upper, source,
sourceVersion:0, model, provenance, report}`. Exact original Surface/options use
Surface-sized 4096-value/depth8 snapshots, dense arrays <=64, records <=8 and
strings <=128. Three distinct ASCII IDs 1..48, original native degree U/V 1..3,
grids 2..16 per axis/max256, finite XYZ within +/-10000 mm and weights 1e-6..1e6
are required. The finite selected parameter is strictly inside its original
domain. Endpoint/outside, unknown, malformed/getter/hidden/foreign/sparse/cyclic,
ID collision, required refinement overflow or unsafe native arithmetic refuses
atomically. Caller and prior results remain reusable.

Actual insertSurfaceKnot brings the selected numeric multiplicity to its degree.
An already degree-multiplicity cut copies the admitted original net directly;
there is no unsupported zero-insertion call. Required refinement must fit the
existing 16-axis cap. No unbounded temporary net, replacement kernel, evaluator,
rebase/reversal, fitting, weight normalization or linked feature reverse-write.

The common row/column is immediately before the first repeated split knot.
Both children include it by direct copy. The lower knot vector keeps the refined
prefix through the repeated group and adds one requested clamp entry. The upper
adds one requested clamp entry before the suffix starting at that repeated group.
All retained knots/poles/weights preserve their bits and -0; both degrees and
nonselected domains stay exact. Original outer endpoint bits remain. New clamps
use the requested scalar, while inherited cut endpoint entries retain their own
zero signs. Report cut endpoint numbers and negative-zero flags show this actual
behavior without normalizing inherited data.

Both complete candidates pass native admission before one literal two-Surface
source0 Model is compiled/adopted after full Object.is Model/order/ID/degree/knot/
weight/net/domain comparison. Provenance contains actual refinement or identity
maps, child pole/knot mappings and shared coefficients. Reports contain actual
grids/domains/multiplicities, shared oriented parameter boundaries, cut signs and
bounded native original/child observations (<=128, local 1e-7 mm comparison).
This is not a global no-gap/shape error or continuity certificate. Existing D1
guards remain: original/refined C0 may refuse while a child endpoint admits a
one-sided derivative. Shared u-max/u-min or v-max/v-min boundaries have opposite
existing extractSurfaceBoundary orientations. No topology edge/wire/sew, normal,
regularity/G1/G2/solid claim. Flags remain
not-certified/topologyCertified:false/solid:false.

```sh
pnpm --filter @barocss/cad build:library
node examples/cad-nurbs/surface-parameter-split-demo.mjs --source
```

One final artifact build is separate from the installed in-memory esbuild source
API/file/packet flow, with no CAD dist import/write or per-demo dependency build.
Both axes, nonseparable rational/shifted/signed-zero/C0, direct-copy/full16x16 and
near-limit refinement inputs compare actual child points, shared bits, iso-Curves,
oriented boundaries, guards and real two-Surface source file identity. One small
curved child pair uses existing 5x5 tessellation/packet validation/native UV/JSON
readback. Native admission remains separate from downstream approximation/normal
admission. Later split controls belong in the unified editor. General trim/join/
extend/fill/B-Rep/Boolean, exchange and broader validation remain separate.

## Original Curve split at one parameter

`splitCurveAtParameter(curve, {parameter, lowerCurveId, upperCurveId})` creates
two directly authored native Curves in increasing original parameter subdomains.
The operation supplies a coefficient partition, without trim/intersection,
topology sewing or split-feature document meaning.

```js
const split = cad.splitCurveAtParameter(originalCurve, {
  parameter: 0.5, lowerCurveId: 'lower_curve', upperCurveId: 'upper_curve',
});
```

The owned result contains `{original, refined, lower, upper, source,
sourceVersion:0, model, provenance, report}`. Original exact Curve/options use
1024 own values, depth6, dense arrays <=64, records <=8 and strings <=128.
Three distinct ASCII IDs 1..48, original degree1..3/poles2..16, native open-clamped
knots, positive weights1e-6..1e6 and arbitrary3D finite XYZ within +/-10000 mm are
required. The finite parameter is strictly inside the original domain. Endpoint,
outside/nonfinite, colliding/unknown/getter/hidden/foreign/sparse/cyclic data,
refinement overflow or unsafe native arithmetic refuses the complete call.
Caller, original authored inputs and prior results remain reusable.

Actual insertCurveKnot brings numeric multiplicity to degree. Already degree-
multiplicity data directly copies the admitted original; zero-count insertion is
not called. Refinement must fit the existing16-pole cap. No unbounded temporary
net, duplicated kernel/evaluator, fit, normalization, epsilon cut or healing.

The shared pole is immediately before the first numeric repeated cut knot.
Both children include its directly copied coefficient/weight. Lower retains the
prefix through the degree-multiplicity group and adds one requested clamp. Upper
adds one requested clamp before the suffix beginning at that group. Degree,
original outer domain endpoints and every retained pole/weight/knot bit remain,
including -0. Original/refined IDs remain; children use the requested distinct
IDs. New clamps use the requested scalar, while inherited cut endpoint signs
remain. Actual report numbers/negative-zero flags expose the distinction.
No parameter rebase/reversal, topology ID or linked authoring reverse-write.

Both complete candidates pass native validation before one actual literal
source0 Model containing exactly lower and upper Curves in that order. The real
compiled Model is adopted only after full Object.is ID/degree/knot/pole/weight/
domain comparison. Provenance includes actual617 refinement or identity maps,
direct child pole/knot maps, clamp origins and the copied shared coefficient.
Report records domains/counts/multiplicities, exact cut signs, genuine endpoint
points, bounded original/refined/child observations and original/native guards.
Local1e-7 mm comparison is not a global shape error or G1/G2/no-gap certificate.
Original/refined C0 can refuse D1 while children admit one-sided endpoint D1;
existing guards remain. Singular native data follows native admission. Flags
remain not-certified/topologyCertified:false/solid:false.

```sh
pnpm --filter @barocss/cad build:library
node examples/cad-nurbs/curve-parameter-split-demo.mjs --source
```

One final artifact checkpoint is separate from installed in-memory esbuild source
API/file/consumer flow, with no CAD dist import/write or per-demo dependency build.
3D/rational/nonuniform/shifted/C0/signed-zero/near/full16 inputs and actual quarter,
iso-Curve/refined dependencies compare native bits, maps, points/D1/guards and
real two-Curve source file Model identity. One supported curved child pair feeds
existing extrusion and small5x5 packets with native UV validation/ordinary JSON
readback. Native construction remains separate from display admission. Later
split controls belong in the unified editor. General modelling/topology/exchange
and broader validation remain separate.

## Atomic original Curve control-polygon edits

`editCurveControlPolygon(curve, {poleEdits})` changes directly authored arbitrary
3D rational Curve coordinates/weights in one transaction. Each patch specifies
an existing integer `index` and at least one `xMM`, `yMM`, `zMM` or `weight`.
Between 1 and 16 distinct poles may be requested. Explicit equal-value fields
are accepted and report no changed fields; empty or fieldless patches refuse.

```js
const edited = cad.editCurveControlPolygon(originalCurve, {
  poleEdits: [{ index: 1, xMM: 4, zMM: 2, weight: 1.5 }],
});
```

The owned result contains `{original, curve, source, sourceVersion:0, model,
provenance, report}`. Exact original Curve/options use 1024 own values, depth6,
dense arrays <=64, records <=8 and strings <=128. Original ID is ASCII1..48,
degree1..3/poles2..16, with original native open/clamped/multiplicity/domain
validation, XYZ within +/-10000 mm and weights1e-6..1e6. Getter/hidden/foreign/
sparse/symbol/cyclic/unknown/duplicate/index or coordinate/weight range data
refuse. Every patch record is admitted before staging. The owned complete net
is validated after all patches, so mixed valid/invalid transactions have no
partial output. Caller and prior results remain reusable.

Original ID, degree, ordered knots/count/domain and every unrequested coordinate
or weight bit remain Object.is, including -0. Explicit authored -0 remains when
admitted. Actual compileCurveSource emits the entire staged Curve source0; its
real single-Curve Model is adopted after full native bit comparison. No fitting,
normalization, snapping, recenter/rebase, constraints, implicit pole/refinement/
degree changes, new document schema, cached geometry authority or feature repair.
Editing a copied sketch/circle/iso/meridian/boundary Curve creates detached literal
Curve authority and never reverse-writes the original linked authoring input.

Provenance records each requested pole/field, actual changed fields and before/
after coefficients. Report includes actual domain/degree/count, changed/untouched
pole/field counts, native point effects at endpoints/breaks/representable interiors
and at most three native D1 queries away from guarded knots. Native derivative
results or actual arithmetic refusals are recorded separately, without converting
coefficient validity into a tangent certificate. Existing C0/D1 guards remain.
Observed effects are not shape-preservation, global error, G1/G2, normal/length/
regularity/solid certificates. Constant/singular native data follows admission.
Flags remain not-certified/topologyCertified:false/solid:false.

```sh
pnpm --filter @barocss/cad build:library
node examples/cad-nurbs/curve-control-polygon-demo.mjs --source
```

One final artifact build is separate from installed in-memory esbuild source
API/file/consumer flow, with no CAD dist import/write or per-demo dependency build.
General3D/rational/shifted/C0/signed-zero/equal-value/constant/full16 atomic inputs
and actual quarter/iso/split Curve dependencies compare native bits/effects/D1/
guards, provenance and real source file Model identity. One supported edited
Curve feeds existing extrusion and small5x5 packet/native UV/ordinary JSON
readback. Native validity remains separate from display/normal admission. Later
control-polygon selection/editing belongs in the unified editor. Broader modelling,
validation, topology and exchange remain separate.

## One-step original rational Bezier Curve degree elevation

`elevateBezierCurveDegree(curve, {targetDegree})` raises a single-span original
rational Bezier Curve by exactly one degree:1->2 or2->3. Cubic, unchanged/skipped
targets and multi-span NURBS inputs refuse; general elevation remains separate.
The [official helper reference](https://nurbs-python.readthedocs.io/en/latest/module_utilities.html#geomdl.helpers.degree_elevation)
identifies Bezier degree elevation as Eq.5.36. This implementation uses the frozen
one-step homogeneous Bernstein formula locally, without an external library.

```js
const elevated = cad.elevateBezierCurveDegree(originalQuadratic, {
  targetDegree: 3,
});
```

The owned result contains `{original, elevated, source, sourceVersion:0, model,
provenance, report}`. Exact original Curve/options use1024 own values/depth6,
arrays <=64, records <=8 and strings <=128. Original ASCII ID1..48, degree1..2,
exactly degree+1 poles/2*(degree+1) knots, native clamped knots/weights and one
finite positive represented max-min span are required. XYZ is within +/-10000 mm,
weights1e-6..1e6. Every start/end knot is numerically equal to the corresponding
original domain endpoint. No getter/hidden/foreign/sparse/symbol/cyclic/unknown,
unsafe/nonfinite/range data, epsilon domain or multi-span fallback. Caller and
prior native results remain reusable; constant/coincident data follows admission.

For p and q=p+1, each new interior pole i uses alpha=i/q and homogeneous
H'_i=alpha*H_(i-1)+(1-alpha)*H_i, where H=(w*x,w*y,w*z,w). Finite contributions
and positive calculated W are required; new interior XYZ divides by W once.
Original endpoint Cartesian poles/weights copy directly, preserving Object.is
bits and -0 without lift-divide roundtrip. No rescale/normalization/clamp/healing,
new evaluator/derivative or parent math/serializer/kernel refactor.

Output degree q/count p+2 retains original ID/orientation/domain bits. Every old
knot remains in order with its original bits. One actual domain-min entry appends
to the start group, and one actual domain-max entry prepends to the end group.
Thus mixed-zero clamps preserve both old signs and original domain endpoints.
Provenance records direct endpoint maps, actual homogeneous contributions/new
coefficients, every retained old knot and added clamp origin. Generated binary64
interior values are calculations, without exact-real-arithmetic guarantees.

The complete elevated Curve passes native admission before actual compileCurveSource
emission and full single-Curve Model/coefficient/ID/degree/knot/domain comparison.
No linked sketch/Surface/meridian/feature reverse update or topology identity.
Report includes degree/count/domain, endpoint bits, bounded native point comparisons
(local1e-7 mm, <=5 queries) and actual native D1 values/refusal statuses (<=3).
This is not a global numerical/continuity/regularity/tangent/solid certificate.
No interior C0 knot is added. Flags remain
not-certified/topologyCertified:false/solid:false.

```sh
pnpm --filter @barocss/cad build:library
node examples/cad-nurbs/bezier-curve-degree-elevation-demo.mjs --source
```

One final artifact build is separate from installed in-memory esbuild source
API/file/consumer flow, with no CAD dist import/write or per-demo dependency build.
Line1->2 then explicit2->3, rational quarter/shifted/mixed-zero/constant and actual
edited/iso/split single-span inputs compare native endpoints/knots/points/D1 and
real source file Model bits. One supported elevated Curve feeds existing extrusion
and small5x5 packet/native UV/ordinary JSON readback; display admission remains
separate. General multi-span elevation, removal/reduction/fit/continuity and Surface
operations remain backlog. Later degree controls belong in the unified editor;
broader validation, modelling, topology and exchange remain separate.

## One-step Surface Bezier-axis degree elevation

`elevateSurfaceBezierAxisDegree(surface, {axis, targetDegree})` raises exactly one
original single-span U or V Bezier axis by one explicit step:1->2 or2->3. The other
native degree1..3 axis may remain multi-span/C0. General multi-span selected-axis
elevation, simultaneous automatic U+V elevation and degree beyond3 are unsupported.

```js
const elevated = cad.elevateSurfaceBezierAxisDegree(originalSurface, {
  axis: 'u', targetDegree: 3,
});
```

The owned result contains `{original, elevated, source, sourceVersion:0, model,
provenance, report}`. Exact original Surface/options use4096 own values/depth8,
arrays <=64, records <=8 and strings <=128. Original ASCII ID1..48, U/V degrees
1..3, native rectangular grids2..16/at most256, XYZ +/-10000 mm and weights1e-6..1e6
are required. Selected degree1..2 uses exactly degree+1 poles/2*(degree+1) knots
and one clamped span. Both original represented domain spans must be finite and
positive. Target is exactly selected degree+1. Output selected3/4 poles by other
<=16, at most64 poles. The generic16x16 input admission ceiling does not promise
selected16-pole elevation. Cubic/multi-span/no-op/skipped/wrong-axis, unknown/
accessor/hidden/foreign/sparse/cyclic/malformed/unsafe inputs refuse atomically.
No normalization/rescale/healing/fallback. Constant data follows native admission.

Actual elevateBezierCurveDegree runs once per original selected-axis strip. U
holds each original V pole; V holds each original U row. Every real strip result
stages before whole-net adoption; elevated knot bits/order/origin maps must agree.
Reassembly uses actual returned Cartesian coefficients/weights, without another
elevation kernel. Private deterministic Curve IDs remain staging provenance;
only the original-ID Surface appears in the output Model. Selected endpoint rows/
columns and weights copy bits/-0 directly. Original orientation/both domain bits,
nonselected degree/knots/order and every original selected knot remain. Added clamps
use actual domain-min/max bits as in the Curve operation. Generated Float64
interiors are calculated coefficients, without exact-real-arithmetic promises.

The complete candidate passes actual native Surface validation and one literal
source0 single-Surface compilation. Actual Model/name/ID/degrees/net/weights/knots/
domain comparison precedes adopting its real compiled data. Provenance contains
all endpoint/knot maps and actual strip homogeneous contributions/reports. No
parent math/Curve/serializer/compiler refactor, new grammar/dependency or linked
sketch/meridian/extrusion/revolve/ruled/feature reverse-write. Caller and prior
results remain reusable.

Reports contain actual degrees/grids/domains/spans/strip count, copied-bit facts,
original/elevated native points (<=9, local1e-7 mm), native SurfaceD1 statuses
(<=5) and original retained strip reports. Other-axis C0 and actual arithmetic
refusals remain native behavior, separate from coefficient/source validity. No
fabricated derivatives or epsilon parameters, global error/continuity/normal/
regularity/topology/solid certificate. Flags remain
not-certified/topologyCertified:false/solid:false.

```sh
pnpm --filter @barocss/cad build:library
node examples/cad-nurbs/surface-bezier-axis-degree-elevation-demo.mjs --source
```

One final artifact checkpoint is separate from installed in-memory esbuild source
API/file/packet flow, without CAD dist import/write or per-demo dependency build.
Weighted nonplanar U/V, explicit two-step linear axis, edited/split/ruled inputs,
other-axis C0/16 strips and actual iso-Curve orientation observations retain native
bits/provenance/guards/source file Model identity. One supported elevated patch
uses existing5x5 tessellation/packet/native UV/ordinary JSON readback. Display
approximation/normal admission remains separate. Future controls use the unified
editor; general degree/freeform/modelling/topology/exchange and broader validation
remain pending.

## Rational ruled Surface with independent section weights

`buildRationalRuledSurface(first, second, {surfaceId})` constructs an original
rational Surface between two 3D sections with equal degree/pole count/Object.is
knots, allowing independent positive weights. Existing buildCompatibleRuledSurface
keeps its exact equal-weight requirement and Cartesian interpolation unchanged.
No automatic basis matching, reversal, elevation/refinement, fitting or healing.

```js
const ruled = cad.buildRationalRuledSurface(firstSection, secondSection, {
  surfaceId: 'rational_sections',
});
```

The owned result contains `{first, second, surface, source, sourceVersion:0,
model, construction, report}`. Exact original Curve/options snapshots allow1024
values/depth6 per input, arrays <=64, records <=8 and strings <=128 without getters.
Three distinct ASCII IDs1..48, section degree1..3/poles2..16, original native finite
open-clamped/repeated knots, XYZ +/-10000 mm and weights1e-6..1e6 are required.
The common represented domain span is finite and positive. Mismatched degree,
count or original knot bits/domain, duplicate IDs, hidden/foreign/sparse/cyclic/
symbol/unknown/malformed/unsafe data refuses atomically. Caller and prior results
remain reusable. Original weights stay unscaled; no normalization or new kernel.

U follows the common original parameter. V is0..1, degree1 with knots[0,0,1,1].
Row i directly copies first/second Cartesian poles and their independent weights;
max16x2/32 poles. Every original coefficient/weight/knot bit and -0 remains.
Complete native Surface admission precedes one literal source0 three-object Model
[first, second, Surface]. Actual full Model/name/IDs/degrees/order/poles/weights/
knots/domains comparison precedes adopting the real compiled data. Construction
records original row/pole/weight/knot origins, without topology or feature identity.

Let Wj(u)=sum(N_i(u)*wj_i) from the existing internal native basis and Cj(u) from
the original evaluator. Surface(u,v)=[(1-v)*W0*C0+v*W1*C1]/[(1-v)*W0+v*W1].
For fixed U the segment fraction is v*W1/[(1-v)*W0+v*W1], generally not uniform
Cartesian v. End sections match at V0/1; equal weights reproduce the original
compatible ruled coefficients and linear blend. Denominators/fractions/expected
points are actual binary64 observations, not an independent exact-real oracle.
No inverse-weight dummy geometry, second basis/evaluator/derivative or parent refactor.

Report contains domains/degree/grid, independent-weight semantics, <=15 actual
point/blend observations and <=5 SurfaceD1 query records with actual section D1
statuses. Successfully evaluated point comparisons use local1e-7 mm only. Genuine
native observation/C0/arithmetic refusals remain separate statuses after coefficient/
source admission. No epsilon/denominator/derivative repair, global midpoint/error/
continuity/normal/regularity/solid certificate. Same/coincident sections remain
native coefficients. Existing oriented parameter boundaries stay unchanged. Flags
remain periodic:false/not-certified/topologyCertified:false/solid:false.

```sh
pnpm --filter @barocss/cad build:library
node examples/cad-nurbs/rational-ruled-surface-demo.mjs --source
```

One final artifact checkpoint is separate from installed in-memory esbuild source
API/file/packet flow, without CAD dist import/write or per-demo dependency build.
Independent/equal weights, line/quadratic/cubic/shifted/C0/full16, edited/elevated
sections and actual iso/oriented boundaries compare native bits and rational
parameter effects. One eligible ruled result feeds actual selected-axis elevation;
one supported curved result uses existing5x5 packet/native UV/ordinary JSON read.
Display approximation remains separate. General basis matching/multi-section loft,
sweep/caps/trims/B-Rep/Boolean, interactive tools and broader validation remain pending.

## Explicit degree-matched Bezier sections for rational ruled Surface

`buildDegreeMatchedBezierRuledSurface(first, second, {surfaceId, targetDegree})`
matches two original single-span Bezier section degrees through actual one-step
elevations, then calls actual buildRationalRuledSurface once. Target2/3 is explicit
and at least both original degrees. Same-target sections remain owned unchanged
copies. General multi-span matching/fitting/domain remapping stays unsupported.

```js
const ruled = cad.buildDegreeMatchedBezierRuledSurface(lineSection, quadraticSection, {
  surfaceId: 'degree_matched_sections', targetDegree: 3,
});
```

The owned result contains `{originalFirst, originalSecond, matchedFirst,
matchedSecond, steps:{first,second}, ruled, surface, source, sourceVersion:0,
model, provenance, report}`. Exact original Curve/options snapshots use1024 own
values/depth6 per input, arrays64, records8 and strings128 without getters. Three
distinct ASCII IDs1..48, original degree1..3/exactly degree+1 poles/2*(degree+1)
clamped knots, finite positive represented single spans, XYZ +/-10000 mm and
weights1e-6..1e6 are required. Original domain endpoints agree Object.is. Downward/
wrong target, multi-span/domain/ID/unknown/foreign/hidden/sparse/symbol/cyclic/
malformed/native arithmetic failures refuse without mutation or partial output.

At most two actual elevateBezierCurveDegree calls stage per section. No second
kernel, manual knot/weight rewriting, normalization or parent API refactor. Real
step results retain original IDs/domains, direct endpoints and original knot maps.
Composition tracks every original knot through actual step provenance; unchanged
sections keep complete bits. Final actual rational ruled admission requires exact
matched degree/count/Object.is knot basis. Mixed-zero clamp patterns can remain
incompatible after elevation and refuse rather than normalizing original signs.

The actual ruled result supplies the whole source0 Model [matched original-ID
Curves, Surface] in native order, complete source/coefficients/provenance/statuses.
Original lower-degree Curves stay separately owned in the result. Surface rows
refer to matched section poles, with independent original unscaled weight meaning.
V remains denominator-weighted rational segment interpolation, without a uniform
Cartesian blend guarantee. No linked feature reverse update, cached mesh authority,
new grammar or project schema.

Reports contain original/matched degree/count/domain, actual step counts and
source/endpoint/knot provenance, <=5 matching native point observations and<=3
actual CurveD1 statuses per section, plus the unchanged native ruled report.
Local1e-7 mm comparisons are observations, without global error/continuity/
regularity/solid certification. Native coefficient/file validity remains separate
from actual arithmetic refusal and display approximation. Flags remain
not-certified/topologyCertified:false/solid:false.

```sh
pnpm --filter @barocss/cad build:library
node examples/cad-nurbs/degree-matched-bezier-ruled-demo.mjs --source
```

One final artifact checkpoint is separate from installed in-memory esbuild source
API/file/packet flow, without CAD dist import/write or per-demo dependency build.
Line/quadratic/cubic/same-target/quarter/edited/shifted/mixed-zero/constant sections
check actual elevation/ruled provenance, source file full Model bits and caller
reuse. A direct prior ruled mismatch demonstrates the added explicit matching
operation. One supported matched patch uses existing5x5 packet/native UV/ordinary
JSON readback. Interactive controls use the unified editor. General matching,
multi-section loft/sweep/caps/trims/B-Rep/Boolean and broader validation remain pending.

## Own rectangular plate with a circular through-hole

`buildOwnPlateCircularHole(request)` constructs one bounded native cut candidate.
The request supplies stable body, feature and six parameter IDs, integer
`widthMM`, `heightMM`, `thicknessMM`, an absolute XY `centreMM`, and `radiusMM`.
The plate starts at XYZ0 and extends in +Z. Dimensions are 1..10000 mm.
The original circle parent admits radius .001..10000 mm. The represented circle
must have strictly positive clearance from each rectangular side. Touching,
outside, malformed or unsafe inputs refuse before a result is accepted.

```js
const native = cad.buildOwnPlateCircularHole({
  bodyId: 'plate_body', featureId: 'plate_hole',
  parameterIds: {
    width: 'plate_width', height: 'plate_height', thickness: 'plate_thickness',
    centerX: 'hole_center_x', centerY: 'hole_center_y', radius: 'hole_radius',
  },
  widthMM: 80, heightMM: 40, thicknessMM: 8,
  centreMM: [40, 20], radiusMM: 5,
});
```

The owned result contains `{bundle, report}`. Seven native Surfaces retain the
original box side and cap IDs and the original circle wall ID. The caps contain
an exact outer rectangle and rational-circle inner pcurve in each actual plane
UV frame. Bottom and top planes have different UV axes. The cavity wall uses
the reversed native face sense. Fifteen shared edges, ten vertices, nine loops
and thirty uses describe a closed-shell candidate. Each edge has two opposite
uses; the wall seam occurs twice on its wall. Native curve/surface mapping,
directed closure, incidence and D1 normals are observed with the existing own
evaluators. This operation does not implement general surface intersections or
unrestricted Boolean operations.

Seven separate source0 Models contain the real face Surface and its used native
Curves. Each source is compiled through `compileCadModel` before adoption, with
full ID/order/coefficient/weight/knot/sign equality. Explicit owned topology
remains separate from the source grammar. `validateOwnPlateCircularHoleBundle`
reconstructs this authored family and compares the full owned bundle before
observing native incidence. Cached reports and meshes have no authoring authority.

The native bundle guard permits131072 own values/depth24, arrays1024, records32
and bounded source strings. The request guard permits4096 own values/depth8.
Getters, hidden fields, foreign prototypes, sparse arrays, symbols, cycles and
unknown request fields refuse. Body IDs are ASCII1..32; feature and parameter
IDs are ASCII1..48 and all authored IDs are distinct. Derived native IDs remain
bounded. Caller requests and previous accepted results remain reusable.

The report labels volume and cap/cavity areas as analytic authored-family
formulas. They are not independently certified manufacturing measurements.
`geometricValidity:'not-certified'`, `topologyCertified:false`, and `solid:false`
remain explicit. The stricter uncut integer-box solid gate does not certify this
cut candidate. General B-Rep validation, intersections, sewing, Boolean/detail
features and commercial CAD parity remain pending.

`tessellateOwnPlateCircularHole(bundle, {context, segmentsPerQuarter})` returns
`{mesh, provenance, report}`. `mesh` follows private native-face-mesh v0: mm,
right-handed part XYZ, genuine per-face UV, local triangle indices and native
face IDs. Context contains exactly documentId/bodyId/documentRevision/
kernelResultRevision/topologyRevision/taskToken. These opaque IDs qualify a
specific accepted result; they are separate from sourceVersion0. The GPU bridge
converts positions and normals to display axes and owns qualified picking.

The preview samples the original native circle with2..8 segments per quarter
(default4). Corner-ray parameters are added through bounded native evaluations
so the outer rectangular cap retains its actual corners. Caps and the cavity
wall share the same circle parameters. Each panel uses actual SurfaceD1 at a
strict smooth midpoint, with native face sense applied once. The wall preview
uses facet normals sampled from that native surface. Positions remain actual
surface evaluations, with corresponding UV and native edge/loop provenance.
The preview approximates the curved boundary; it does not replace the authored
rational circle or add shader-only clipping.

`validateOwnNativeFaceMesh` admits the exact DTO fields and bounded plain data:
131072 values/depth12, arrays23814, records16, strings512, up to64 face chunks,
4096 aggregate vertices and7938 triangles. Finite position, unit normal, genuine
UV, local index, nondegenerate triangle and Float32 winding checks are display
admission. A display refusal does not certify or invalidate the separately built
native candidate. `validateOwnPlateHolePreviewContext` checks the context record.

```sh
pnpm --filter @barocss/cad build:library
node examples/cad-nurbs/own-plate-circular-hole-demo.mjs --source
```

The example writes real per-face source files, explicit native topology and the
actual derived DTO. It changes80x40x8/r5 to width100, then radius6, with the same
body/feature/parameter IDs and absolute centre. Invalid requests preserve the
caller's accepted native/display state. Old face references remain qualified by
their original result context. The native source flow is separate from the
artifact build and GPU browser/pixel evidence. General topology naming across
Boolean operations, a public Part grammar and commercial project serialization
remain pending.

## Own transverse affine-plane / circular-cylinder intersection

`intersectXYCirclePrismWallWithPlane(shellBundle, options)` intersects an original
`buildXYCirclePrismShell` wall with the graph
`z = slopeX*x + slopeY*y + zInterceptMM`. The plane spans the original circle's
represented XY support rectangle. Slopes are finite within[-1,1], and intercept
is within[-10000,10000] mm. Explicit curveId/planeId/planePcurveId/wallPcurveId
and evaluationId are distinct ASCII IDs1..48 and cannot collide with native shell
identities. The evaluation token qualifies one owned result; it does not provide
persistent naming across geometry changes.

```js
const shell = cad.buildXYCirclePrismShell({
  kind: 'circle', id: 'section_circle', center: [2, -3], radius: 4,
}, {shellId: 'section_shell', heightMM: 10});
const section = cad.intersectXYCirclePrismWallWithPlane(shell.bundle, {
  curveId: 'intersection_curve', planeId: 'intersection_plane',
  planePcurveId: 'intersection_plane_uv', wallPcurveId: 'intersection_wall_uv',
  evaluationId: 'evaluation_oblique', slopeX: .2, slopeY: -.1, zInterceptMM: 4.5,
});
```

The native section retains the original circle's quadratic degree, knot domain,
weights, XY coefficients and closed endpoints. Its Z coefficients are the actual
affine plane elevation. A horizontal section is a circle; an oblique section is
its planar ellipse. The original cylinder Surface and all parent data remain
unchanged. The constructed degree1 plane Surface uses actual represented support
spans. Full sections return `kind:'intersection'`, curve/plane/wallSurface,
owned shell/options, source/sourceVersion0/Model, dual UV bindings and report.

Plane UV is an affine mapping of the original rational circle coefficients.
Cylinder UV requires different algebra: its U coordinate is native parameter t,
not a circle angle. In each original quadratic Bezier span t=q+s, multiply the
original denominator W(s) by q+s to obtain a cubic U numerator. Elevate the
original denominator and the weighted section Z/height numerator to degree3.
Project those three homogeneous coefficient sets into a genuine cubic UV Curve.
Four spans share exact original endpoints, with13 poles and original quarter
boundaries at0,1,2,3,4. Interior knot multiplicity is3; original section knots and
weights are not normalized or replaced. The wall pcurve is not a naive copy of
the circle's quadratic parameter coordinates. Its seam UV endpoints0 and4 remain
distinct while the native XYZ endpoint is closed.

Admission uses a documented sufficient axial bound from the section's positive
weight control hull. A full curve requires minZ>0 and maxZ<original height.
Strict minZ>height or maxZ<0 proves a conservative disjoint result with plane/wall
source geometry and its bound. Touching, mixed or partial hulls refuse. A failed
full-containment bound never implies disjointness. Vertical planes, clipping,
other intersection branches, general NURBS intersections and topology sewing
are outside this operation.

Seventeen actual native observations include endpoints, quarter knots and span
interiors. The 3D Curve is compared with both Surface(pcurve) evaluations, and the
wall U is compared with t. Actual CurveD1/pcurve D1/SurfaceD1 states are recorded;
existing C0 quarter-knot derivative refusals remain explicit. Successful tangent
chains use the actual surface partials and pcurve derivatives. Local1e-7 mm and
1e-12 parameter comparisons are observed prototype checks, not a global error
certificate. Reports retain original IDs/domains, represented spans, sufficient
control hull bounds, each homogeneous span and separate seam representations.

`validateXYCirclePrismPlaneIntersection(result)` reconstructs this bounded family
and refuses changed geometry, UV binding, evaluation token, source or report.
Own-data limits are131072 values/depth24, arrays1024, records32 and bounded source
strings. Getter/hidden/foreign/sparse/symbol/cyclic/unknown/malformed/unsafe data
refuse without caller mutation. Actual source0 geometry contains section Curve,
plane Surface and original cylinder Surface in that order. Disjoint source has
plane and cylinder only. Source file adoption preserves complete native IDs,
coefficients/order/weights/knots/signs. UV bindings remain separate owned artifacts,
with no mm-source relabeling, fake Surface or new public Part grammar.

```sh
pnpm --filter @barocss/cad build:library
node examples/cad-nurbs/own-plane-cylinder-intersection-demo.mjs --source
```

The source example uses original circle centre[2,-3]/r4/height10, horizontal z5,
oblique slopes.2/-.1/intercept4.5 and a same-ID intercept5 rebuild with a new
explicit evaluation token. Actual files, dual-surface UV, tangents, seam, disjoint
z12, mixed/touching/invalid inputs and altered binding refusal preserve prior
results. No external backend or mesh intersection is used. GPU display and picking
remain separate. periodic:false, geometricValidity:not-certified,
topologyCertified:false and solid:false remain explicit. General intersection,
Boolean/solid certification and commercial CAD parity remain pending.

## Own finite-wall clipping of plane/cylinder sections

`intersectFiniteXYCirclePrismWallWithPlane(shellBundle, options)` uses the original
circle-cylinder shell and the same explicit plane/curve/pcurve/evaluation IDs as
the transverse-plane intersection. It admits finite wall pieces where a genuine
native rational section crosses the wall's bottom or top axial boundary. The
original public `intersectXYCirclePrismWallWithPlane` still requires a strictly
contained full section. A small internal constructor supplies the common derived
infinite-support section, plane and genuine dual UV curves before finite-wall
admission. This derived provenance is not a completed finite-wall intersection.

For each original rational quadratic quarter, the clipping equations are the
actual homogeneous Bernstein numerators Z-0*W and Z-height*W. Positive weights
make numerator zero equivalent to the axial boundary equation. Degree reduction,
all-zero equations and unsafe or ambiguous root arithmetic require explicit
outcomes. The algorithm uses bounded root refinement, with at most64 steps per
root, a parameter-width target1e-12 and local native point/binding observations
within1e-7 mm. These are finite prototype numerical policies. They are not exact
algebraic roots or certified global tolerances.

Original rational parameters remain authority. Distinct close events cannot be
silently merged; identical quarter-boundary parameters may share an event while
the seam retains separate0 and4 UV endpoints. Actual section evaluations classify
intervals. Kept native XYZ, plane UV and wall UV restrictions use the same original
parameter domain and the existing `splitCurveAtParameter` operation. Native
coefficients/weights/knots and child source/split provenance remain explicit.
Original quarter C0 derivative refusals remain visible.

A crossing endpoint can use an inward represented root-bracket endpoint only as
an explicitly labeled interval approximation. Its bracket, root residual,
parameter offset and actual dual-surface/domain observations remain recorded.
The section is not snapped to a cap, and the UV is not clamped. Returned numeric
endpoints do not establish exact cap topology or sew cap loops. Unresolved event
order, strict surface-domain admission or unsafe arithmetic refuses the candidate
atomically. At most24 pieces and24 contact events are supported.

Outputs distinguish curve segments, disjoint, isolated touch and coincident
boundary. A horizontal section exactly on a cap can be a coincident-boundary
result, without a unique trim or solid claim. Native mm piece geometry is written
as actual source0 Models with real plane/cylinder Surfaces. UV/binding artifacts
remain separate owned data and are passed back through the result validator after
file readback. Prior authored/native/source results remain reusable after edits
or invalid candidate refusal. No new public Part grammar or display renderer.

```sh
pnpm --filter @barocss/cad build:library
node examples/cad-nurbs/own-plane-cylinder-clipped-demo.mjs --source
```

The source flow uses original circle centre[2,-3]/radius4: height6 with z=x+1
crosses both axial levels; height10 with z=x+6 clips at the top. A plane edit uses
the same authored IDs and a new evaluation token. Narrow existing horizontal/
oblique witnesses preserve the original full-section family. Cardinal/seam
contact, horizontal z0 coincidence and above-wall z12 are recorded honestly.
General surface intersections, cap-loop sewing, Boolean operations, solid
certification and commercial CAD parity remain pending. External engines,
angle/mesh intersections and numeric endpoint repair are not used.

The owned result contains `kind`, shell/options, plane/wallSurface,
`derivedSupport`, events, pieces and report. The derived support labels its
unrestricted section/dual UV/homogeneous spans explicitly. Each finite piece
contains pieceId/domain, native curve/bindings, source0/model, endpoint
approximation metadata and actual observations. Each contact event records its
boundary/level, crossing or touch kind, native parameter, bracket/iterations/
residual, original homogeneous equation provenance and separate seam endpoint
representation. Per-piece source Models contain `[curve, plane, wallSurface]`;
there is no oversized aggregate Model. Isolated point contacts remain explicit
contact data rather than invented point Curves.

`validateFiniteXYCirclePrismPlaneIntersection(result)` reconstructs the staged
native result and refuses altered intervals, UV, source or contact metadata.
`endpointApproximations` distinguishes inward numeric endpoints from unchanged
original endpoints. The output keeps the original plane/curve/evaluation IDs and
native parameter intervals; derived piece IDs do not certify persistent topology.

Strictly same-sign actual Bernstein coefficients exclude roots on that quarter
before discriminant analysis. This positive-basis control-hull proof avoids a
false ambiguity from a double root outside the native quarter domain. The report
labels that exclusion policy. Mixed or zero coefficient cases still use the
explicit endpoint/root-bracket/ambiguity rules. `originalDerivativeGuards` records
three actual original section/pcurve/wall SurfaceD1 attempts at1,2,3, separately
from valid clamped derivative evaluations on restricted pieces. No guard is
relaxed merely because a quarter endpoint becomes a child Curve endpoint.

## Own rational Bezier Curve / affine Plane Surface intersection

`intersectBezierCurveWithAffinePlaneSurface(curve, plane, options)` handles one
original nonperiodic clamped Bezier span of degree1 or2 against an actual affine
rectangular degree1x1 Plane Surface. Positive rational Curve weights and the
original parameter domain remain unchanged. Plane weights must be equal represented
values, with independent finite U/V directions. Tilted and skew axes are supported;
non-affine bilinear patches, degenerate axes, unsupported bases and unsafe arithmetic
refuse. The operation evaluates original native geometry rather than a mesh.

Options contain exactly `{evaluationId, pointEventIds}`. One to four explicit
ASCII event IDs1..48 must be distinct from the original Curve/Plane/evaluation
identities and cover all actual support events. The result owns unchanged original
curve/plane/options, source0/model, events and report. Its kinds are isolated,
support-disjoint, finite-disjoint and coincident-support. Evaluation IDs qualify
individual results; approximate point events do not establish sewn topology or
persistent naming across edits.

The plane normal comes from its actual represented U/V axes. Actual homogeneous
Bernstein coefficients are n dot(P_i-planeOrigin)*w_i. A small shared own root
internal reuses the finite-cylinder quadratic arithmetic and accepts the actual
two coefficients of a linear numerator without a dummy degree elevation. Reports
retain degree reduction, strict-sign exclusion, discriminant uncertainty, original
parameter/root bracket, refinement steps and residual observations. The policy
allows at most64 refinement steps per root, an original-domain bracket-width
target1e-12 and local point/binding comparison1e-7 mm. Ambiguous ordering/count/
tangency or unrepresentable mapping refuses, without merging close distinct roots.
An exact represented endpoint remains distinct from a numerical interior estimate.

Each event evaluates the ORIGINAL Curve at its original root parameter. UV uses
the Gram system of the original independent plane axes, including skew planes;
the authored point remains unchanged. The ORIGINAL Surface is evaluated only if
that UV lies within its native rectangle. Support roots outside that rectangle
remain outside-domain events, with no finite face hit or invented Surface sample.
Numerical UV-boundary uncertainty remains explicit. Side-distance observations and
actual original CurveD1 states are separate from intersection acceptance.

All-zero homogeneous coefficients label the original whole Curve as coincident
with the plane support. Finite containment is proven only when the positive-weight
original Curve control hull maps inside the actual rectangle. Otherwise finite
clipping remains not-proven. The operation does not replace a coincident Curve
with a unique trim, or silently treat its support as a bounded face.

Actual source0 geometry is the unchanged `[Curve, Surface]` Model. Files are
compiled through `compileCadModel` with complete native coefficient/order/ID/
weight/knot/domain/sign identity. Owned event results are separate data, read back
and supplied to `validateBezierCurveAffinePlaneIntersection`. The validator
reconstructs geometry/root/UV/domain/source evidence and refuses changed events,
brackets, UV or identities. Getters must not execute. Invalid candidates retain
previous accepted native/source results.

```sh
pnpm --filter @barocss/cad build:library
node examples/cad-nurbs/own-curve-plane-intersection-demo.mjs --source
```

The source flow includes a linear Curve on a tilted/skew plane, rational quadratic
two-crossing support events, the same support against a smaller rectangle,
endpoint/tangent/coincident/disjoint semantics and a same-ID pole or plane edit
with a new evaluation token. Genuine numerical tangent uncertainty may refuse.
One narrow existing finite-cylinder clipping witness checks shared root reuse;
there is no parent replay. Original637/638 public admission semantics remain.
No UV clamping, authored point repair, new Part grammar or renderer is introduced.
geometricValidity:not-certified, topologyCertified:false and solid:false remain.
General intersections, trimming/sewing, Boolean/solid certification and commercial
CAD parity remain pending.

Curve/plane/options inputs use4096 own values/depth8, arrays64, records16 and
strings128. Native authored IDs are ASCII1..48. Result validation has its separate
131072-value/depth24, arrays1024, records32 and bounded source-string budget,
including nullable outside-domain Surface samples. Skew-axis admission refuses
Gram determinants within the64-epsilon-scaled unsafe range. Events retain original
Curve point semantics, actual bracket side observations and original D1 statuses.
A root bracket must agree on finite-rectangle admission; a bracket that straddles
a represented UV boundary refuses rather than forcing a hit.

Nonzero dot-product terms and nonzero signed-distance times positive-weight
coefficients must remain nonzero when represented. Actual underflow to zero
refuses before coincidence classification. True represented zero and cancellation
remain allowed. The source example includes one native-valid tiny-coordinate/
positive-weight input that triggers this refusal and retains prior native/source
state; it does not normalize that input into a coincident Curve.

## Own multiple-span NURBS Curve / affine Plane Surface intersection

`intersectCurveWithAffinePlaneSurface(originalCurve, originalPlane, options)`
extends the existing native Bezier/Plane primitive to an authored clamped
nonperiodic rational degree1/2 Curve. It admits at most12 original poles and8
nonzero original knot spans, with positive native weights and original parameter
domain. Existing `splitCurveAtParameter` extracts actual native Bezier spans at
represented original internal knots, through its actual knot insertion when
needed. Temporary16-pole limits remain unchanged. Unsupported degree, discontinuity,
unsafe arithmetic or an operation outside those budgets refuses without repair.

Options contain exactly evaluationId/derivedSpanIds/pointEventIds. Derived span
IDs match the actual1..8 span count. One to sixteen point IDs bound consolidated
support events. Original Curve/Plane, evaluation, span and event IDs are globally
distinct. Internal temporary identities are separate. No source ID, authored
pole/weight/knot or native domain is normalized or changed.

Every real child span calls `intersectBezierCurveWithAffinePlaneSurface` with the
actual original Plane. Its source, geometry, root evidence and native UV remain
explicit. Each event is re-evaluated on the ORIGINAL complete Curve; original
point and derivative states remain accepted authority. Original/extracted point
comparisons and actual Plane Surface binding residuals are observed. The inherited
Gram/UV-boundary/coefficient-underflow/tangent refusal policy remains unchanged.

Only exactly equal original parameters at shared internal knots consolidate into
one knot-event. Both span contributions, actual child and original points/D1,
brackets and one-sided neighboring evidence remain available. An inherited child
endpoint is not a global crossing or tangent merely by its label. Original C0
D1 refusals remain visible even when a newly clamped span endpoint differentiates.
Equal world points at different parameters do not merge; the native circle's0/4
seam remains two parameter events.

The result owns original curve/plane/options, full source0/model, actual extraction
provenance, spans, consolidated events and report. Its kinds include isolated,
support-disjoint, finite-disjoint, coincident-spans and mixed. A coincident child
span is an interval with control-hull-contained or finite-containment-not-proven
semantics. It does not make the entire original Curve coincide or establish a
unique finite trim. Outside support events remain distinct from bounded face hits.
Maximum32 contributions/16 consolidated events/8 spans are operation budgets,
not a validation matrix.

Each actual span keeps its original domain, source0/model and whole existing
Bezier/Plane intersection result. Original full Curve+Plane geometry and derived
span geometry write/read/compile complete native coefficient/order/ID/knot/domain/
weight/sign data. Owned extraction/contribution/UV results are read back and passed
to `validateCurveAffinePlaneIntersection`. Altered source/native extraction,
contribution, UV, bracket or identity refuses while previous accepted source/result
remain reusable. No invented Part grammar, resampling or authored point projection.

```sh
pnpm --filter @barocss/cad build:library
node examples/cad-nurbs/own-multispan-curve-plane-demo.mjs --source
```

The source flow uses the actual four-quarter rational circle and a true vertical
Plane Surface, including exact shared-knot consolidation, original derivative
refusal and separate0/4 seam. An authored nonuniform/nonunit-weight quadratic on
a nonzero domain and same-ID edit retain original parameter authority. Smaller
finite patches, mixed coincident/noncoincident intervals and disjoint support have
explicit outcomes. Genuine inherited tangent uncertainty may refuse atomically.
Public637/638/639 remain unchanged. Higher-degree/general intersections, exact
tangent predicates, coincident finite clipping, trimming/sewing, Boolean/solid
certification and commercial CAD parity remain pending. Flags remain
geometricValidity:not-certified/topologyCertified:false/solid:false.

`extraction` stores each actual `{parameter, result:CurveParameterSplitResult}`.
The event contributions retain the whole child Bezier event plus original/child
point and derivative states. Side observations sample a represented midpoint
between the event and nearest other span root or boundary on that side. Whole
results use131072 own values/depth24, arrays1024, records32 and bounded source
strings; inputs retain their smaller plain-data guards. Authored IDs are ASCII1..48.
Inserting or splitting beyond inherited16 temporary poles refuses. These records
are observed derivation data, not a global continuity or accuracy certificate.

## Own coincident Curve intervals clipped to a finite affine Plane

`clipCurvePlaneCoincidentIntervals(original640Result, options)` rebuilds a genuine
multiple-span Curve/Plane result and clips only its coincident-support spans to
the original affine Surface's finite UV rectangle. Noncoincident parent events
remain unchanged referenced evidence. Original positive rational degree1/2 Curve,
12-pole/8-span limits, Plane axes/domains and original identities remain authority.
Public637/638/639/640 admission and geometry remain unchanged.

Options contain exactly evaluationId/pieceIds/contactIds/spanBindingIds/
pieceBindingIds. Piece capacity is1..32 and contact capacity1..64; full-span binding
IDs match the coincident span count, and piece-binding capacity matches piece IDs.
All explicit identities are distinct from parent geometry/evaluation/span/event
identities. No capacity expansion or persistent topology name is inferred.

Each coincident span maps its original Cartesian poles through the actual Plane
Gram UV axes into a genuine dimensionless rational UV Curve. Degree, weights,
knots and native parameter domain remain unchanged. Four actual homogeneous
boundary equations locate u-min/u-max/v-min/v-max contacts with the inherited
bounded linear/quadratic root solver. All-zero equations retain boundary-overlap
span evidence instead of isolated roots. Strict-sign exclusion, nonzero-product
underflow guards, original-domain root brackets/width1e-12, at most64 refinements
and unsafe/tangent/order refusals remain explicit prototype policies.

Native span boundaries and actual roots partition intervals; original Curve/UV
samples classify them after root coverage. Exact equal original parameters can
group affected boundary contributions. Distinct close parameters and equal world
points do not merge. Unresolved corner/order/finite-domain arithmetic refuses;
the native circle's0/4 seam and original C0 derivative states remain visible.

Kept XYZ and actual UV Curves are restricted with the existing own numerical
splitting operation to the SAME original parameter interval and inherited16-pole
limits. UV reuse retains only dimensionless coefficients and selected split maps;
its temporary utility source/model and mm-labeled observations are not exposed as
physical geometry. UV shared coefficients are labeled pointUV. Actual public
source0 files contain XYZ Curve+Plane geometry only; genuine UV binding artifacts
remain separate. Native numeric coordinate/split bounds can refuse unsupported
UV ranges, without normalization or parent-budget changes.

Every admitted piece binding evaluates the ORIGINAL complete Curve, actual piece
Curve, genuine UV Curve and ORIGINAL finite Surface. Original/child differences,
actual Surface binding and original/child derivative states remain observed.
Inward numerical root-bracket endpoints require explicit estimate/bracket/offset,
dimensionless boundary residuals and mm point-binding observations. No UV clamp,
authored point projection, coordinate snap or exact sewn trim vertex is claimed.

The result owns parent/options, original source0/model, spans, grouped contacts,
finite pieces, referenced parent events and report. Piece kinds include pieces,
finite-disjoint, isolated-contacts, overlap-boundary, mixed and no-coincident-spans.
Each span records its UV Curve/four equations/overlap boundaries/outside intervals;
each piece owns native XYZ/UV/domain, binding observations, endpoint approximation,
selected XYZ/UV provenance and actual geometry source. Bounds32 pieces/64 boundary
contributions/8 spans are admission limits, not a validation matrix.

`validateCurvePlaneCoincidentClip` rebuilds the actual parent and every accepted
interval/UV/root/lineage/source record. Whole results and parent input use bounded
131072 values/depth24, arrays1024, records32 and source strings; construction and
validation share those bounds. Getter/hidden/foreign/sparse/symbol/cyclic/unknown/
unsafe or altered parent/interval/bracket/UV/identity refuses with prior accepted
parent/clip/source state reusable.

```sh
pnpm --filter @barocss/cad build:library
node examples/cad-nurbs/own-coincident-plane-clip-demo.mjs --source
```

The actual source flow uses a coplanar rational circle in a narrower rectangle,
nonuniform weighted spans with same-ID edit, a rectangle-edge overlap line,
containing/disjoint rectangles, mixed coincident/noncoincident parent evidence and
an honestly admitted or refused corner/contact seed. Original and piece XYZ/Plane
source files compile full coefficients/order/weights/knots/domains/IDs/signs;
owned dimensionless UV/root/result JSON is read back through the real validator.
Arbitrary trimmed polygons/holes, exact tangent predicates, closed-loop sewing,
Boolean/solid certification and commercial CAD parity remain pending. Flags remain
geometricValidity:not-certified/topologyCertified:false/solid:false.

## Own coplanar rational Curve / finite native Line intersection

`intersectCoplanarCurveWithLineSegment(curve, line, affinePlane, options)` uses an
actual native affine Plane UV chart to intersect a rational original Curve with a
finite native Line. Curve admission is clamped positive-weight degree1/2, at most12
original poles/8 spans; actual source splits retain16 temporary-pole limits. Line
is a nondegenerate clamped degree1/two-pole/equal-positive-weight Curve with its own
original finite native domain. Both Line endpoints must lie in the original finite
Plane rectangle. Original homogeneous support equations admit coplanarity;
unproven/noncoplanar/unsafe geometry refuses. Plane can be tilted or skew.

Options contain evaluationId/derivedSpanIds/pointEventIds/overlapIds/spanBindingIds/
overlapBindingIds/boundaryContactIds. Span and span-binding IDs match actual spans;
point capacity is1..16, overlap1..32 with matching binding capacity, boundary contact
capacity1..64. All explicit IDs are bounded distinct ASCII identities. Original
Curve/Line/Plane/source/IDs/domains remain unchanged. Actual own640 span extraction
and native Gram axes are reused, with no parent public API change.

Real rational UV Bezier coefficients solve the homogeneous signed-line equation
`(U-u0*W)*dv - (V-v0*W)*du = 0` through the existing bounded linear/quadratic solver.
Original Curve evaluation remains point authority. A dominant safely represented
UV direction maps each observed point into actual normalized Line coordinate and
then its ORIGINAL Line domain. Actual native Line/Surface binding and original
Curve/Line D1 states are observed only within their admitted domains. Beyond-segment
support roots retain original scalar evidence, with no fake finite hit, endpoint
snap or out-of-domain native Line evaluation. Shared-knot parameters consolidate
with actual contributions and neighboring sides; equal world seam0/4 remains two
Curve parameters. Inherited unsafe Gram/product/bracket/endpoint/tangent conditions
refuse without projecting the Curve point or clamping UV/Line coordinates.

An all-zero signed-line equation is a collinear support SPAN, not an isolated root.
Its actual two finite Line-coordinate boundary equations partition native intervals.
Overlap XYZ and genuine dimensionless UV restrictions use the same original Curve
domain and existing own split operations. Original Line parameter range and forward/
reverse orientation require the positive-weight rational derivative-numerator
Bernstein sign proof; endpoint order alone cannot establish monotonicity. Unresolved
turning/order/root uncertainty refuses. Repeated/reversing Curve parameters stay
separate; world proximity never welds different native intervals.

Overlap pieces own XYZ/UV/domain, actual original Line range/orientation, native
binding/D1 observations, selected XYZ/UV split provenance and source0 geometry.
Inward numerical endpoints carry bracket/estimate/used parameter/offset/dimensionless
boundary residuals. UV is owned dimensionless data; the numerical splitter's temporary
mm source/model/observation labels are omitted, as in the prior native clip operation.
Public source0 files contain real original or overlap XYZ Curve + Line + Plane.
No exact sewn vertex, trimmed face loop, shell/solid or general Boolean certificate.

The owned result has original curve/line/plane/options, actual640 parent/spans,
source0/model, point events, overlaps, overlap contacts and report. Kinds include
points/overlaps/mixed/outside-segment/finite-disjoint/isolated-contacts. Maximum16
point events/32 overlaps/64 boundary contributions/8 spans are operation budgets,
not a campaign. `validateCoplanarCurveLineIntersection` rebuilds original geometry,
root/UV/Line parameter/overlap/lineage/source evidence. Construction and rebuild
share131072-value/depth24, arrays1024, records32 and bounded source-string guards;
smaller inputs/options retain own plain-data limits. Getter/hidden/foreign/sparse/
symbol/cyclic/unknown/unsafe and changed metadata refuse with prior native/source
results reusable.

```sh
pnpm --filter @barocss/cad build:library
node examples/cad-nurbs/own-curve-line-intersection-demo.mjs --source
```

The actual source flow includes a tilted/skew Plane with weighted nonuniform Curve
and arbitrary-domain finite Line, real circle secant/shortened Line/knot/seam,
collinear overlap and same-ID pole edit, disjoint/noncoplanar/unsafe/tangent outcomes.
Original and overlap source0 geometry files compile full native Model bits,
including signed zero; UV/root/original Line parameters and lineage roundtrip as
owned data through the real validator. Public637..641 remain unchanged. General
curve-curve intersections, exact tangent predicates, arbitrary trimming/sewing,
Boolean/solid certification and commercial CAD quality remain pending. Flags remain
geometricValidity:not-certified/topologyCertified:false/solid:false.

## Own rational Curve clipped by a strict-convex native Line loop

`clipCurveWithConvexLineLoop(curve, {id, edges}, plane,
{evaluationId, resultIdPrefix})` clips an original coplanar rational Curve against
an authored ordered3..8 finite native Line loop on an actual affine Plane. Original
Curve degree1/2,12-pole/8-span bounds and inherited16 temporary-pole split limits
remain unchanged. Each Line retains its own two-pole/equal-positive-weight native
domain and direction. Represented original end/start coordinates must close
exactly. No line is snapped, reordered or substituted with a mesh boundary.

Safely represented native UV determinants prove strict convexity and authored
orientation. All nonadjacent vertices must agree with the directed halfspaces;
local turns alone do not certify a simple convex loop. CW and CCW are supported
as authored. Open/concave/self-crossing/repeated/collinear/noncoplanar/unsafe loops
refuse. Curved boundary edges and holes remain outside this operation.

Actual `intersectCoplanarCurveWithLineSegment` results are retained per native
edge. Infinite-line support roots outside that edge are not polygon contacts.
Only exactly equal original Curve parameters consolidate, retaining every finite
edge/native Line parameter/bracket/D1/overlap contribution at a vertex. Near roots
and world-equal seam0/4 never merge. Original knot limits and relevant finite roots/
overlap endpoints partition spans; original Curve evaluations and directed
halfspaces classify intervals after native root coverage.

Accepted XYZ and genuine dimensionless UV restrictions use SAME original Curve
parameter intervals and own split provenance. Original full Curve remains point/
derivative authority. Native Surface/edge bindings, authored loop orientation,
interior/boundary classification, actual Line range/overlap orientation and rational
monotonicity proof stay explicit. Inward numerical endpoints require all halfspaces
to admit, with root brackets/offsets/residuals and no UV clamp/point projection/
coordinate snap/exact sewn topology claim. Unsafe corners, reversing overlap or
unresolved order/classification refuses.

Caller prefix produces deterministic bounded span/contact/piece/UV and per-edge
parent identities after collision checks. IDs come from native context and original
parameter order, without mesh picking or a persistent topology naming promise.
Maximum8 edges/8 spans/128 contacts/128 pieces/256 boundary contributions are
aggregate admission budgets. Existing per-edge operation budgets remain unchanged.
Whole owned results retain per-edge native evidence, original source geometry,
contacts, accepted pieces, outside intervals and report under bounded own-data
construction/rebuild limits; over-budget aggregates refuse atomically.

`validateConvexLineLoopClip` reconstructs original geometry, ordered edges, authored
orientation, interval/UV/Line parameter/edge identity and lineage. Getter/hidden/
foreign/sparse/symbol/cyclic/unknown/unsafe or changed source/metadata refuses
without changing previous accepted sources/results. Actual source0 geometry is
original or piece XYZ Curve, Plane and original native Lines; UV is dimensionless
owned coefficient/binding data, not mm geometry. The inherited numerical UV
splitter's temporary mm source/model/observation labels are omitted.

```sh
pnpm --filter @barocss/cad build:library
node examples/cad-nurbs/own-convex-loop-clip-demo.mjs --source
```

The source flow consumes the prepared tilted/skew Plane Z=X, strict-convex native
triangle and weighted quadratic with original nonuniform spans[2,3]/[3,5], then
real circle/nonrectangular multiple pieces, authored orientation reversal,
contained/disjoint/edge overlap/vertex or honest uncertainty, same-ID boundary edit
and seam/shared-knot evidence. Original/piece source files preserve full native
coefficients/order/weights/knots/domains/IDs/signed zero. Raw owned numeric result
JSON is read through the actual validator. No general Boolean, arbitrary nonconvex/
hole trim, native face sewing or solid certificate. Flags remain
geometricValidity:not-certified/topologyCertified:false/solid:false.

Aggregate construction/rebuild guards use262144 own values/depth28, arrays2048,
records48 and bounded source strings; smaller inputs use4096 values/depth8,
arrays64/records16. Native per-edge limits remain unchanged. Original IDs are
ASCII1..48 and caller prefix1..20. Deterministic prefix `_e<edge>_*` roles preserve
per-edge contexts; `_c<i>`/`_p<i>`/`_b<i>` identify original-parameter-ordered contacts,
XYZ pieces and piece UV. All expanded roles are reserved/collision-checked before
native calls. Only bounded `_t<n>` names are generated for private temporary
source/split contexts.

The result exposes authored orientation, actual UV vertices, every strict convexity
determinant/unsafe threshold, actual per-edge native644 results, native spans,
consolidated contacts and finite pieces. Piece `boundaryBindings` retain original
Line domains/ranges/directions, overlap IDs, derivative-numerator signs and actual
Line/Plane/D1 observations. Piece sources are `[XYZ Curve, relevant native boundary
Lines, Plane]`; interior pieces need only actual Curve/Plane geometry. Original
sources contain the whole Curve, all original Lines and Plane. No UV source/model
is exported as millimetre geometry. Numeric inward endpoints carry all incident
brackets/estimates/offsets and actual halfspace values.

## Own affine Plane face with a convex native trim loop

`buildConvexPlanarFace(plane, loop, {faceId, evaluationId, resultIdPrefix,
orientation})` constructs an owned face from the actual affine Plane and3..8
ordered finite native Line Curves. Shared internal Plane/loop admission derives
real original Gram axes, homogeneous Line coplanarity, represented XYZ closure,
native UV rectangle membership and strict convexity. No synthetic Curve probe is
used to admit a face. Native sources retain original Plane/Line IDs/order/poles/
weights/knots/domains/signed zero. Existing511 fixed four-boundary face remains
unchanged; this face owns an actual nonrectangular convex trim.

Each generated topological vertex holds its original represented XYZ point; each
edge references its actual Line Curve ID, endpoint vertex IDs and original native
parameter interval. Edge uses retain direction and a genuine dimensionless UV
pcurve with original Line basis/domain/weights. Face references actual Surface ID
and authored outer loop. Caller face/evaluation/prefix identities are distinct from
original geometry/loop IDs, with deterministic checked vertex/edge/use/pcurve roles.

Authored CW/CCW source order remains unchanged. Canonical outer-use traversal is
CCW in native UV for forward face sense and CW for reverse. Opposite author/sense
combination reverses USE order/direction/vertex traversal, not original Line data.
Actual original Line(t)=Surface(pcurve(t)) and LineD1/SurfaceD1 chain tangents are
observed at both endpoints and interior samples, with traversal signs and oriented
face normal recorded. Cyclic vertex incidence is validated; it is not geometry,
topology or solid certification.

`classifyConvexPlanarFaceUV(face, [u,v])` returns inside/boundary/outside using the
actual native chart and strict-convex trim halfspaces. Surface point is evaluated
only in the original Plane rectangle. Outside-chart queries retain null native
Surface point. A boundary carries every applicable original edge/use/native Line
parameter; a corner retains BOTH incident edges. Exact represented zero is distinct
from ambiguous nonzero near-zero determinants, which refuse instead of snapping.
Face-sense and authored-loop reversal preserve the geometric region and explicitly
change directed pcurve/use/normal evidence. No 3D point projection, ray or mesh test.

Actual source0 Model is `[original Plane, authored native Lines]`. Owned face/loop/
vertex/edge-use/pcurve topology is separate from source grammar. Dimensionless UV
is not mm source geometry. `validateConvexPlanarFace` reconstructs the owned result
and refuses changed source/UV/domain/interval/use direction/vertex/loop/identity/
accessor data without mutating earlier accepted native/source results.

```sh
pnpm --filter @barocss/cad build:library
node examples/cad-nurbs/own-convex-planar-face-demo.mjs --source
```

The source flow uses actual tilted/skew triangle boundaries and an independent
nonrectangular quadrilateral with nonunit native Plane/Line domains, authored
CCW/CW and both face senses. Source/pcurve incidence, native point/D1, inside/
outside/boundary/corner and honest near-boundary ambiguity are measured. Exact
original source files and owned numeric topology JSON preserve lexical -0 and
roundtrip through compiler/validator. A single compatible645 consumer in this new
flow verifies the necessary shared loop admission reuse, without parent replay.
No triangulation/UI/extrusion/holes/nonconvex/curved trims/sewn B-Rep/Boolean/solid
or commercial certification. Flags remain incidenceValid for admitted loop only,
geometricValidity:not-certified/topologyCertified:false/solid:false.

Native face construction/rebuild guards32768 own values/depth16, arrays256,
records32 and bounded source strings; inputs retain4096/depth8 own-data guards.
Three to eight vertices/edges/uses/pcurves remain explicit. Prefix1..20 generates
`_v_<i>`, `_e_<i>`, `_use_<i>`, `_uv_<i>` by original authored edge index after
collision checks. Boundary classification returns use/pcurve/Curve IDs, original
native Line parameter, traversal sense and actual LineD1 binding. Outside-domain
has null point/normal and performs no native Surface evaluation; chart-admitted
outside-trim queries retain the actual Plane point without a finite face hit.

## Own two nonparallel convex trimmed affine Plane face intersection

`intersectConvexPlanarFaces(faceA, faceB, {evaluationId, resultIdPrefix})` rebuilds
two actual native convex planar-face results and computes their common support
line, clipped against BOTH original finite UV trim loops. No synthetic probe Curve,
fixed-XY flattening, mesh intersection or parent topology cache admits the faces.
Original degree1x1/equal-weight affine Plane,3..8 finite native Line loops, native
UV/Line domains, original geometry/IDs/source order and face/use orientation remain.

Support direction is the normalized cross product of the UN-ORIENTED original
Plane U/V normals in caller A→B order. Face-sense reversal changes oriented normal/
use evidence, not support geometry or existence. Original plane offsets and a
scale-aware safe nonparallel denominator determine the anchor; parallel/coincident/
ill-conditioned/nonfinite/cancellation/unsupported cases refuse. A direction/order
convention does not guarantee persistent naming across later Boolean operations.

Actual original Gram axes map the support into both native UV charts, including
nonunit domains. Linear directed halfspace inequalities clip a common scalar
interval against each actual convex loop. Root bounds, denominator/order/near-zero
uncertainty and inward numerical offsets remain explicit64-epsilon prototype
policies. Corners retain BOTH original boundary contributors; simultaneous bounds
from both faces retain ALL face/loop/edge/use/pcurve/native Line parameter evidence.
No endpoint projection, UV clamp, coordinate snap or exact sewn vertex is claimed.

A positive admitted interval yields a real degree1/two-pole/equal-weight XYZ Line
and two genuine dimensionless UV Curves on the SAME explicit native support domain.
Original Surface/derived Line/pcurve point and D1 chains at endpoints/midpoint
observe dual binding and direction. Native Surface evaluation occurs only inside
its original chart. Finite-disjoint output is successful empty evidence. An exact
isolated point requires represented parameter coincidence and actual admission of
both constraints; ambiguous zero-length/order decisions refuse instead of guessing.

Caller ASCII evaluation/prefix identities are bounded and distinct against all
input/generated roles before staging. Prefix1..20 produces `_line`, `_uv_a`,
`_uv_b`, `_point`, `_end_0`, `_end_1`; point/end roles are owned numerical metadata,
not topological sewn vertices. At most two faces/one segment or point/16 endpoint
contributors and bounded samples/data are admitted. `validateConvexPlanarFaceIntersection`
rebuilds from original faces/options and rejects altered source/dual UV/interval/
direction/contributor/native edge parameter/face lineage/accessor data while prior
accepted geometry/source results remain reusable.

Both original Plane-first/authored-Line source Models are preserved independently.
Actual derived XYZ Line may have its own source0 file; dual UV/topology/lineage stay
owned dimensionless metadata. Source/compiler/owned JSON roundtrips preserve full
original coefficient/ID/order/domain/weight/signed-zero data. Public511/637..648
and native parents remain unchanged unless a documented small internal reuse is
necessary; that concrete risk gets one source consumer, not a parent campaign.

```sh
pnpm --filter @barocss/cad build:library
node examples/cad-nurbs/own-convex-planar-face-intersection-demo.mjs --source
```

The source flow uses actual transverse tilted/skew faces and nonunit Plane/Line
domains, unequal finite trim extents, authored direction/face-sense changes,
disjoint finite faces, native corner/all-contributor endpoints, exact point when
admitted, same-ID boundary edit and concrete uncertainty/altered-data refusals.
Actual dual Surface/Curve/pcurve D1/file evidence is separate from renderer/UI.
General curved/nonconvex/hole faces, coplanar overlap regions, NURBS SurfaceSurface,
sewing/Boolean/solid/manifold/persistent naming and commercial quality remain
pending. Flags remain geometricValidity:not-certified/topologyCertified:false/
solid:false; no triangulation, UI or fully-validated claim.

The owned result exposes both unchanged native faces, original support anchor/
direction/normals/denominator threshold and dual native UV affine maps. Each actual
edge constraint records alpha/beta/uncertainty, lower/upper/parallel-inside/
coincident-boundary/parallel-outside status and original scalar root. Accepted
endpoints retain all exact tied constraints and coincident boundary contributors;
unequal root bounds within uncertainty refuse instead of merging a corner.
Original native edge parameters bind the scalar-root point, while actual inward
endpoint offsets/residuals are separately recorded.

Segment source0 contains only actual XYZ Line; dual UV Curves are dimensionless
owned bindings. Point/disjoint outcomes contain no invented degenerate Line.
Construction/rebuild guards131072 values/depth24, arrays1024, records48 and bounded
source strings; original face validators keep their limits. No parent public
contract/import changed for this leaf, so no standalone parent witness is needed.

## Own affine planar face with convex holes

`buildConvexPlanarFaceWithHoles(plane, outerLoop, holeLoops, options)` constructs
one authored affine Plane face with a strict convex outer native Line loop and
one or two strict convex native Line holes. Every loop has 3..8 edges. The total
is at most15 Lines; the original Plane plus those Lines fits the unchanged
source0 Model16-object limit. `plane` is the actual degree1x1 equal-weight
four-pole affine Surface, including its original nonunit U/V domains. Each loop
is `{id, edges}` with original equal-weight degree1/two-pole finite Curves and
original native Line domains. Hole identity is the supplied loop ID.

Options are `{faceId, evaluationId, resultIdPrefix, orientation}`; orientation
is `forward` or `reverse`, and the ASCII prefix is1..20 characters. Generated
IDs are `prefix_lN_v_I`, `prefix_lN_e_I`, `prefix_lN_use_I` and
`prefix_lN_uv_I`, where N0 is the outer loop, N1..2 are supplied hole loops,
and I is the authored native edge index. All original/context/generated IDs
are reserved as distinct before native staging.

Admission uses the genuine original Gram chart and native Line coplanarity,
represented-bit endpoint closure and every-nonadjacent vertex halfspaces.
Every hole vertex must lie strictly inside every outer halfspace. Two holes
must have a strict separating axis from their actual convex native UV edges.
Crossing, touching, overlap, nesting and unsafe near-boundary cancellation
refuse; a centroid or bounding rectangle does not establish admission.

Face-forward outer uses are CCW and inner uses CW in the original UV chart.
Face-reverse reverses those roles. Original authored Curves and source order
remain intact. Real vertices, edges, directed uses and dimensionless UV pcurves
retain loop ownership and the original Line intervals. Endpoint/midpoint
observations use actual LineD1, pcurveD1 and SurfaceD1, with face-oriented
normal and tangent evidence.

`classifyConvexPlanarFaceWithHolesUV(result, [u,v])` returns `inside` for material,
`inside-hole` for a strict hole interior with its original loop ID, `boundary`
with the actual outer/hole loop and all incident boundary contributors,
`outside`, or `outside-domain`. Exact hole corners retain both original edge
parameters. Within the Plane chart, a strict hole-interior query retains the
true Plane XYZ point and normal with `material:false`. Material interior and
admitted boundary return `material:true`. Outside-domain point and normal
are null without evaluating Surface outside its domain. Exact represented zero
identifies boundary; uncertain nonzero64-epsilon determinants refuse without
snapping.

The source0 Model contains the original Plane, then authored outer Lines, then
hole Lines in the supplied loop order. Full coefficient, knot, weight, native
domain, order, ID and signed-zero bits survive compiler adoption. UV pcurves
and topology stay separate owned numeric metadata. The result validator
rebuilds from original Plane/loops/options and rejects altered source,
loop roles, directed uses, pcurves, intervals, identity and vertex lineage.
Construction/rebuild snapshots bound65536 values, depth20, arrays512,
records48 and source strings262144 characters. Input snapshots also have
separate smaller bounds. Getters, hidden/symbol fields, foreign prototypes,
sparse/cyclic and unsupported data refuse before adoption.

```sh
node examples/cad-nurbs/own-convex-planar-face-holes-demo.mjs --source
```

This is authored planar trim construction. General Boolean Cut, automatic Hole
feature graphs, hole-aware surface intersection, tessellation/ray queries,
curved/nonconvex/touching/nested holes and sewn manifold B-Rep remain open.
Reports retain geometricValidity:not-certified, topologyCertified:false and
solid:false. Native implementation requires separate sole-GPU serial
integration and current-host consumer verification.

## Own material intersection of two affine faces with holes

`intersectConvexPlanarFacesWithHoles(faceA, faceB, options)` takes two actual
validated `ConvexPlanarFaceWithHolesResult` parents. Options are
`{evaluationId, resultIdPrefix}` with an ASCII prefix1..20. Each original face
keeps its own Plane-first source0 Model with at most16 objects. Parents are
compiled independently; the operation does not combine them into a larger
Model or create synthetic probe Curves or replacement parent faces.

The common support direction is the unit cross of un-oriented original Plane
U/V normals, in caller A-to-B order. Face sense affects directed use/normal
evidence. Support clipping uses both original convex outer native UV
halfspaces. All actual inner-loop halfspaces prove each hole's support
interval. Only OPEN hole interiors are excluded from the closed outer
material interval. Tangent inner corners and coincident inner-edge intervals
retain explicit boundary contacts without producing a false gap. Open
excluded intervals from different parents can overlap or meet; exact admitted
material points at represented ties remain points, without zero-length Lines.

The result has `kind: 'intersections' | 'disjoint'`, both original parents and
options, original support/dual UV maps, sorted `segments[]`, `points[]`, explicit
boundary contacts and excluded-hole interval provenance. It admits at most5
material components across at most4 hole intervals. Each actual segment owns
one finite native degree1/equal-weight Line and two dimensionless UV Lines on
the same original support parameter domain. Native endpoint/midpoint D1 chains
bind both original Surfaces. Isolated points retain XYZ, both original UVs and
Surface D1 evidence; points/disjoint do not emit fabricated Curve source.

Generated roles are `prefix_sN_line`, `prefix_sN_uv_a`, `prefix_sN_uv_b`,
`prefix_sN_end_0`, `prefix_sN_end_1`, `prefix_pN` and `prefix_cN`. All possible
roles are reserved against original input/context/generated IDs before result
staging. Endpoint and contact contributors retain actual face role/ID, loop
role/ID, native edge/Curve/use/pcurve IDs, original Line parameter and native D1.
These result identities are not sewn B-Rep vertices or persistent Boolean names.

Outer endpoints use explicit material-side inward offsets. Hole-cut endpoints
can require outward offsets into material. Original root bounds/uncertainty,
chosen parameter offsets/directions and actual UV/boundary residuals remain
separate. Uncertain nonzero narrow gaps, root order or collapsed intervals
refuse under the bounded64-epsilon policy without snapping. Midpoint samples
provide local binding observations rather than sole interval admission proof.

`validateConvexPlanarFaceWithHolesIntersection(result)` rebuilds from the two
original parents/options and compares original bits, all derived intervals,
roles, dual UV, native parameters and lineage. Owned snapshots are bounded
by262144 values/depth28/arrays2048/recordFields64/source strings262144; actual
combined input Lines≤30, contacts≤16 and endpoint/contact contributors≤128.
Existing650 parent/compiler limits remain intact. Getters, sparse/hidden/symbol
fields, malformed/nonfinite data and ID collisions refuse before adoption.

```sh
node examples/cad-nurbs/own-convex-planar-face-holes-intersection-demo.mjs --source
```

This computes bounded planar trim material intersections. General curved or
nonconvex holes, coplanar overlap regions, arbitrary NURBS SurfaceSurface,
sewing/manifold/Boolean Cut/union/intersection, automatic Hole/constraint
feature graphs and editor tessellation/ray queries remain open. Reports retain
geometricValidity:not-certified, topologyCertified:false and solid:false.
Native implementation requires separate sole-GPU serial integration and
current-host consumer verification.

## Own material mesh and true boundary paths for affine faces with holes

`tessellateConvexPlanarFaceWithHoles(face)` consumes one actual validated650
`ConvexPlanarFaceWithHolesResult`. The owned result retains
`{face, mesh, boundaryPaths, triangulation, report}`. The original Plane and
native outer/inner Lines remain geometry authority with full source order,
coefficient bits and arbitrary native Surface/Line domains. The existing
Plane+15Lines/Model16-object limit remains intact.

The binary64 indexed mesh contains `{id, positionsMM, normals, parametersUV,
indices, vertices}`. Positions and oriented normals are actual original
Surface D1 observations at native dimensionless UV. Native vertex records
retain original topology vertex/loop identity and Line/pcurve/Surface binding
provenance. Only the original V≤15 native vertices are used; no Steiner points
or parameter rebasing. With H1..2 holes, the admitted triangle count is
V+2H-2≤17. Array capacities are positions45, normals45, UV30 and indices51.

Constrained triangulation builds a deterministic maximal planar visibility
graph on original native UV vertices. Visible bridges and diagonals require
true original boundary and halfspace proofs without foreign crossing/touching
or passage through open hole interiors. Empty material triangles are extracted
from that graph. Bridge bookkeeping adds no native vertices. Triangle centroids
may supplement material observations; they
cannot establish whole-triangle coverage by themselves. Exact represented
zero and a64-epsilon unsafe-predicate policy distinguish admitted contacts
from unresolved nonzero cancellation. Unsupported/uncertain display inputs
refuse without changing the native parent.

Every actual original outer/inner boundary pair must occur once in mesh
incidence; every internal edge occurs twice with opposite senses. Triangle
winding follows face orientation. Nondegenerate orientation, no unintended
crossing/overlapping interiors, Euler/triangle count and guarded UV area
agreement between outer-minus-holes and triangle sum are explicit display
observations. There are at most15 true boundaries,18 internal indexed edges
and2 bridges. These observations do not certify manifold B-Rep or a solid.

True boundary paths are separate from mesh diagonals. They evaluate actual
original finite Line parameters, use senses and pcurves, retaining original
edge/Curve/use/pcurve IDs and endpoint provenance. Native Line positions and
Surface mesh positions keep their observed binding difference rather than
claiming represented coincidence. Internal display bridges/diagonals never
become original CAD boundaries or pcurves.

Bookkeeping IDs derive from the original face resultIdPrefix with `_mesh`,
`_mesh_bridge_N`, `_mesh_diag_N` and `_mesh_tri_N`. All possible roles are
reserved against original/context/generated parent identities before staging.
Native topology vertex/edge IDs remain unchanged.
`validateConvexPlanarFaceWithHolesMesh(result)` rebuilds original parent,
mesh winding/UV/positions/normals/incidence/lineage/true paths/internal roles
and compares full original source bits including lexical -0. Owned snapshots
bound131072 values/depth24/arrays512/recordFields48/source strings262144;
actual mesh capacities remain the smaller15vertex/17triangle family.

```sh
node examples/cad-nurbs/own-convex-planar-face-holes-preview-demo.mjs --source
```

This exposes native material display data. It does not change GPU packets,
Float32 conversion or source grammar. Native-valid inputs can be refused for
unsafe or unsupported display triangulation. General curved/nonconvex/nested
or touching trims, rational curved boundaries, adaptive constrained meshing,
ray/editor feature graphs, sewing/manifold/Boolean/detail/assemblies/exchange
remain open. Reports retain geometricValidity:not-certified,
topologyCertified:false and solid:false; separate sole-GPU serial integration
and current-source consumer adoption are required.

## Own ray query on an affine material face with holes

`queryConvexPlanarFaceWithHolesRay(face, {originMM, direction, maxDistanceMM})`
queries one genuine validated650 face. It uses the actual original Surface D1
basis, affine Gram chart and strict650 material classifier. Original Plane,
Lines, source order/bits/-0, loop roles and nonunit native domains remain
geometry authority. Mesh triangles, integer XY conversion and synthetic probe
Curves are not query inputs. No new native identities or source grammar are
introduced; the original Plane+15Lines/Model16 limit remains.

Origin is a finite XYZ within±10000mm. Direction is a dense finite3-vector
with norm1±1e-9. The authored direction is preserved; a nonunit input outside
that bound refuses. maxDistanceMM is positive and≤50000. Forward parameter
range is inclusive0..maxDistanceMM in `origin+t*direction`. tMM and actual
traveledLengthMM=tMM*authoredNorm are separate observations.

The result retains `{face, query, directionNorm, policy, support, candidate,
hit, status, reason, report}`. Support owns the actual original Surface basis
D1/Gram axes, un-oriented normal, signed origin distance, direction-plane
cosine, denominator and nullable plane parameter. A candidate exists only
within the forward parameter range. It records ray point/native UV/actual650
classification, native SurfaceD1 or null and ray-versus-Surface residual.
Supporting-plane candidates are not automatically finite material hits.

Status is `unique-hit`, `miss` or `ambiguous-coplanar`. Strict hole interior
misses retain the actual hole loop ID and Plane query. Actual outer/hole
boundaries are admitted material, including both incident original edges at
an exact corner. Hit bindings qualify face/Surface/loop role and IDs,
edge/Curve/use/pcurve IDs, original Line parameter and directed native vertex
IDs. Hit point/face-oriented normal derive from actual original Surface D1.
Miss reasons are `parallel-noncoplanar`, `behind`, `beyond-distance`,
`outside-domain`, `outside-outer-loop` and `inside-hole`. Outside-domain
classification retains null native point/normal without Surface evaluation
outside the chart.

The explicit display policy treats absolute direction-plane cosine≤1e-12 as
parallel and original supporting-plane origin distance≤1e-7mm as conservatively
coplanar. Coplanar status remains ambiguous even when finite trim overlap is
unresolved; no isolated finite hit is fabricated. A1e-7mm ray/Surface comparison
is local display evidence. It does not change original strict650 boundary
classification, construction/manufacturing tolerance or certification. Unsafe
nonzero64-epsilon material/inverse predicates refuse without snapping.

`validateConvexPlanarFaceWithHolesRay(result)` rebuilds the original face and
exact ray query, comparing status/reason/norm/distance/candidate/hit/native UV,
point/normal/boundary identities/ownership and full source bits. Query snapshots
bound4096 values/depth8/arrays64/records16; result/rebuild snapshots131072/
depth24/arrays512/records48/source strings262144. Original650 guards remain
unchanged. Accessors/hidden/symbol/foreign/sparse/cyclic/nonfinite or altered
data refuse while previous native face/query/source remain reusable.

```sh
node examples/cad-nurbs/own-convex-planar-face-holes-ray-demo.mjs --source
```

This is one original material-face selection foundation. General coplanar
interval solving, multi-face nearest-hit sorting, curved/nonconvex/nested or
touching trims, feature graphs, sewing/Boolean/detail/assemblies/exchange remain
open. Reports retain geometricValidity:not-certified, topologyCertified:false
and solid:false. Planner coordinates sole-GPU integration and current-source
GPU/Loader consumer adoption separately.

## Own adaptive samples of an authoritative native Curve

`sampleCurveAdaptive(curve, {chordToleranceMM, maxSegments, maxDepth,
resultIdPrefix})` returns ordered display samples of the original native Curve.
The owned result is `{curve, options, source, sourceVersion:0, model, domain,
parameters, pointsMM, samples, segments, operations, report}`. Output XYZ values
come from actual original `evaluateCurve` calls at original native parameters.
Authored XYZ and millimetres are preserved without an axis conversion or an
inferred up axis. A host resolves its explicit frame contract. Samples are
neither new native edges nor a fitted Curve.

Supported input is a positive-weight nonperiodic open-clamped degree1..3 Curve
with2..16 poles, at most8 nonzero native knot spans, finite XYZ within±10000mm,
weights1e-6..1e6 and an ASCII ID1..48. The original geometry/source order,
weights/knots/poles/domains and signed-zero bits remain authoritative. Tolerance
is1e-7..1000mm, maxSegments1..1024 and maxDepth0..16. There are at most1025
ordered points. Existing native624/61716-pole refinement capacity stays intact;
a required extraction overflow refuses rather than widening those helpers.

Actual `splitCurveAtParameter`/native knot refinement extracts genuine rational
Bezier spans, then subdivides deterministically at representable original
midpoints. Each accepted span records its actual native Bezier coefficients,
original span/domain, subdivision depth and compact actual split/refinement
provenance. Original knot/span boundaries occur once in output, with adjacent
interval lineage and original D1 guard information. C0 point continuity does
not imply D1/G1 continuity. A midpoint with no represented interior parameter,
unsafe arithmetic or exhausted segment/depth/work budget refuses atomically.
Previous native Curve/results/source remain reusable.

Positive rational Bezier curves lie in their control-point convex hull, giving
the mathematical basis for a finite-chord control-polygon distance estimate.
See the primary [rational Bezier notes](https://pages.mtu.edu/~shene/COURSES/cs3621/NOTES/spline/NURBS/RB.html)
and [NURBS properties](https://pages.mtu.edu/~shene/COURSES/cs3621/NOTES/spline/NURBS/NURBS-property.html).
The own algorithm measures distance to a FINITE segment, including endpoint
regions and an explicit degenerate-chord policy. It does not use distance to
an infinite line or midpoint samples as a global certificate. Native binary64
split coefficients can introduce arithmetic differences. Computed hull/chord
estimates, actual original point-to-output-chord observations and native
extraction residuals are separate fields. Requested flatness is a display
criterion, not a certified binary64 global manufacturing/error guarantee.

The original single-Curve source0 Model is compiled with full native bit/ID/
order/domain adoption. UV/mesh/renderer geometry and new source grammar are
not involved. Prefix is ASCII1..20. Reserved roles are `prefix_model`,
`prefix_split_N_lo`, `prefix_split_N_hi`, `prefix_seg_N` and `prefix_pt_N`.
They are display/operation identifiers, not fabricated CAD boundaries. At
maxSegments1024 there are at most4096 reserved IDs and1023 actual extraction
plus subdivision splits. Work/staging checks precede large allocation.
Owned snapshots bound262144 values/depth24/arrays4096/records64/source262144.

`validateAdaptiveCurveSamples(result)` rebuilds original Curve/source/request
and deterministic native extraction/sampling, comparing full owned point,
parameter/interval/span/provenance/report bits. Accessors/hidden/symbol fields,
foreign/sparse/cyclic/nonfinite/unknown data, ID collisions and altered owned
points/parameters/provenance refuse without replacing prior accepted data.

```sh
node examples/cad-nurbs/curve-adaptive-sampling-demo.mjs --source
```

The actual source/native-file flow also performs a short separate import of the
public manifest's declared compiled JS entry and checks emitted declarations.
Its source esbuild graph remains actual `src`, with no CAD dist inputs or
per-demo build. Renderer/Loader adoption of samples is a separate Issue.
Reports retain geometricValidity:not-certified, topologyCertified:false and
solid:false. General adaptive Surfaces, curved trims, topology/Boolean/features/
constraints/assemblies/exchange remain tracked under503/535/537 and library660.

## Own native same-degree rational Curve join

`joinCurves(left, right, {curveId, rightParameterEnd?})` constructs one actual
native C0 Curve from two original positive nonperiodic open-clamped Curves of
the same degree1..3. Each parent has2..16 poles, weights1e-6..1e6 and finite XYZ
within±10000mm. The joined count is leftCount+rightCount-1≤31, admitted through
existing native math/source64-pole/70-knot bounds. Existing617/624/66116-pole
families keep their limits. Degree conversion is a separate caller operation.

The shared authored endpoints must be exactly numerically equal componentwise.
Signed zero is geometrically equal; the joined shared control pole and weight
retain LEFT bits. Original parents retain all their own pole/weight/knot/domain/
ID/source bits. Left/right slot qualification permits equal parent Curve IDs;
the new ASCII curveId1..48 must differ from both parent IDs. No endpoint snap,
fit, healing, axis conversion or inferred up axis is performed.

The left native domain stays intact. The right domain is explicitly mapped by
a positive affine map to `[leftEnd, rightParameterEnd]`; the default target end
is leftEnd plus the original right span. Original domains, generated target
knots, parameter scale and inverse derivative scale remain in provenance.
An identity map copies original nonshared knot bits. Generated maps retain
strict ordering/finite arithmetic and the exact requested endpoint; unsafe
collapse or reversal refuses atomically. Right-side D1 in joined parameters
scales by the inverse parameter scale.

If endpoint weights differ, the entire RIGHT weight set is explicitly scaled
by leftEndWeight/rightStartWeight. A scale of1 copies original right weight
bits. Otherwise generated products, shared-start product residual and adopted
right weights are distinct from original coefficients. Shared joined weight
chooses LEFT bits. Nonfinite, unsafe or out-of-native-bound products refuse.
Constant positive weight scaling has the rational geometric basis of cancelling
from numerator and denominator; generated binary64 values still require honest
local residual observations rather than a global shape guarantee.

The actual joined coefficient/knot sequence has one shared pole and join
multiplicity equal to degree. Native D1 guard at that knot remains unchanged,
even if original one-sided endpoint derivatives look aligned. Original-versus-
joined point and scaled D1 observations use local1e-7mm/relative1e-7 policies.
They do not prove G1/G2, regularity, a closed wire, B-Rep or a solid. Numeric
closed endpoint coincidence is reported separately from topology.

The owned result is `{left, right, options, curve, source, sourceVersion:0,
model, parentSources, parentModels, provenance, report}`. Parent Curve-only
source Models `curve_join_left` and `curve_join_right` are independently adopted;
the joined Curve-only source Model uses the new curveId as its model name.
These names belong to separate model namespaces. The actual joined source0
contains genuine native coefficients, without mesh/sample fitting. DTO version0,
mm and authored XYZ semantics are explicit in the report.

`validateJoinedCurveResult(result)` rebuilds the original parents/options,
joined coefficients/source/maps/weights/bindings and compares every owned bit.
Accessors/hidden/symbol/foreign/sparse/cyclic/extra/nonfinite or altered data
refuse while originals and prior joined results remain reusable. Input snapshots
bound4096 values/depth8/arrays64/records16; results131072/depth24/arrays4096/
records64/source262144. At most128 two-slot native point/D1 observations plus
original endpoint and native join-guard evidence are staged before adoption.

```sh
node examples/cad-nurbs/curve-join-demo.mjs --source
```

The source/native-file flow includes a short separate actual declared compiled
API/declaration import. Public metadata and explicit source paths remain intact.
Reports retain geometricValidity:not-certified, topologyCertified:false and
solid:false. General degree matching, higher continuity, curved trims, topology,
constraints/features/assemblies/exchange remain tracked under503/535/537/660.

## Own native Curve reversal

`reverseCurve(curve, {curveId})` reverses an authoritative positive rational,
nonperiodic open-clamped Curve of degree1..3 with2..31 poles. XYZ within±10000mm,
weights1e-6..1e6, existing native64-pole/70-knot capacities and original16-pole
sampling/split helper family limits remain unchanged. The new ASCII ID1..48
must differ from the parent. It is a native coefficient operation for orienting
Curves before joining; topology-use traversal is a separate contract.

Control points and weights are copied in reverse order with their original
binary64 bits and signed zeros. The reversed knot sequence is reflected inside
the original native domain `[a,b]`. Clamped endpoints use exact original domain
values. Interior knots are generated arithmetic, with explicit lineage and
unchanged multiplicities. A second reversal is not promised to recreate every
original knot bit. Lost distinct knots, order, endpoint representability,
nonfinite spans or unsafe nonzero64-epsilon cancellation refuse without snapping.

The decreasing map from reversed parameter v to original u is
`u = a + (b - v)`, with original endpoint assignments and derivative factor-1.
Original versus reversed points and D1 sign are observed at native mapped
parameters. Native C0 knot refusals remain explicit, including original and
reflected guard lineage. Local1e-7mm point and relative1e-7 derivative comparison
policies are observations rather than global shape/manufacturing/G1/G2/regularity,
wire, topology or solid certification. Authored XYZ/mm are preserved without
axis conversion or a universal CAD up axis.

The owned result is `{original, options, curve, source, sourceVersion:0, model,
originalSource, originalModel, provenance, report}`. The original Curve-only
source Model is named `curve_reverse_original`; the actual reversed Curve-only
source Model uses the new ID as model name. Report DTO version0 declares
`barocss-native-reversed-curve`, mm and authored XYZ. Plain copied data belong to
the caller; no renderer resource or dispose method is introduced.

`validateReversedCurveResult(result)` rebuilds native parent/output/source,
coefficient order/bits, knot reflection/multiplicity/maps and observations.
Input snapshots bound4096 values/depth8/arrays64/records16; owned results131072/
depth24/arrays4096/records64/source262144. At most128 mapped point/D1 observations
plus original/reflected C0 guard evidence are admitted. Getter/hidden/symbol/
foreign/sparse/cyclic/extra/nonfinite or tampered data refuse atomically, preserving
previous parents/results/source.

`CurveReversalError` exposes stable diagnostic codes: `INPUT`, `IDENTITY`,
`DOMAIN`, `REPRESENTABILITY`, `NATIVE`, `BINDING` and `OWNED`. Codes identify
input/profile bounds, new ID, finite domain, generated arithmetic, native
compile/evaluation, local binding and owned rebuild failures. Error messages
provide the concrete refused operation; native derivative refusals are retained
as evidence without inventing a derivative.

```sh
node examples/cad-nurbs/curve-reversal-demo.mjs --source
```

The actual source/native-file flow also imports the declared compiled public
entry and checks emitted declarations. It demonstrates a wrong-end join refused
by #667, followed by reversal and successful native joining. Public package
metadata and explicit source-first paths stay intact. Reports remain
geometricValidity:not-certified, topologyCertified:false and solid:false.
General wire/trim/topology, degree/continuity operations, constraints/features/
assemblies/exchange remain tracked under503/535/537/660; GPU/Loader adoption and
npm publication have separate tracked states.

## Own native Curve interval extraction

`extractCurveInterval(curve, {curveId, interval: [start,end], resultIdPrefix})`
returns a genuine coefficient Curve restricted to an increasing original
parameter interval. It supports positive, nonperiodic open-clamped degree1..3
Curves with2..16 poles, weights1e-6..1e6 and XYZ within±10000mm. Parameters remain
in the original domain and units: the map is `u=t`. No fitting, normalization,
reversal, axis conversion or display-mesh reconstruction occurs.

The new ASCII Curve ID1..48 differs from the original. An explicit ASCII
prefix1..20 reserves `prefix_cut_0_lo/hi` and `prefix_cut_1_lo/hi` before staging;
these helper IDs also differ from original/output IDs. Model names have their
own source namespaces. The original Model is named `curve_interval_original`;
the extracted Curve-only Model uses the output Curve ID as its model name.

Both finite interval endpoints must be inside the original closed domain with
start<end. No sorting or clamping occurs. A requested endpoint numerically equal
to an original domain endpoint uses the original endpoint bits, including
signed zero; requested and effective choices remain explicit. Interior cut
parameters retain their requested bits. A full interval copies coefficients
under the new ID with zero splits. Otherwise the actual native split operation
cuts the start and retains the upper child, then cuts the end and retains the
lower child. At most two splits occur. Each temporary refinement must fit the
existing16-pole split/insertion family; a native-valid wider request can refuse
with `NATIVE_CAPACITY`. The31-pole join/reversal family is not admitted here.

The owned result is `{original, options, curve, source, sourceVersion:0, model,
originalSource, originalModel, provenance, report}`. Original and output source0
are independently compiled and adopted with complete coefficient, ID, order
and signed-zero checks. Provenance retains the original/requested/effective
domains, identity parameter map, selected/discarded split sides and actual
refined/shared pole, weight, knot and cut endpoint lineage. DTO schema
`barocss-native-curve-interval`, version0 declares mm/authored XYZ and native
Curve geometry. The caller owns copied plain data, with GC and no renderer
resources or dispose method.

`validateExtractedCurveInterval(result)` rebuilds from the original/options and
compares complete sources, Models, coefficient bits, provenance and reports.
Strict descriptor snapshots reject getters without calling them and reject
hidden/symbol/unknown fields, sparse arrays, foreign prototypes, cycles,
nonfinite values and tampering. Input bounds are4096 values/depth8/arrays64/
records16; owned result bounds are131072 values/depth24/arrays4096/records64/
source strings262144. Refusal preserves accepted inputs and prior results.

At most128 local point/D1 observations use retained knots and representable
quarter/midpoint parameters. Unrepresentable observation parameters refuse.
Point comparison uses1e-7mm; derivative comparison uses relative1e-7. Original
native C0 refusal and extracted one-sided endpoint D1 are separate states:
making a knot an endpoint does not establish original G1/G2 continuity.
Reports retain `geometricValidity:not-certified`, `topologyCertified:false`
and `solid:false`, with no global shape or manufacturing accuracy certificate.

`CurveIntervalExtractionError` has stable codes `INPUT`, `INTERVAL`, `IDENTITY`,
`REPRESENTABILITY`, `NATIVE_CAPACITY`, `NATIVE`, `BINDING` and `OWNED`; native
causes are retained. Its exported `CurveIntervalExtractionDiagnosticCode`
provides the runtime constants and type.

```sh
node examples/cad-nurbs/curve-interval-extraction-demo.mjs --source
```

The bounded flow writes and reopens original/output source0 and raw signed-zero
owned JSON, then separately checks the actual declared compiled public entry
and emitted declarations. GPU/Loader adoption, Integration availability and
npm publication are separate states. Wider curves and general trims/topology/
Boolean/features/constraints/assemblies/exchange remain tracked under503/537/660.

## Own native rectangular Surface regions

`extractSurfaceRegion(surface, {surfaceId, uInterval, vInterval, resultIdPrefix})`
extracts a rectangular region in the original U/V parameter domains. Positive,
nonperiodic open-clamped degreeU/V1..3 Surfaces are admitted with original and
all temporary axes2..16, total poles<=256, weights1e-6..1e6 and XYZ±10000mm.
It uses at most four actual native splits in U-start/U-end/V-start/V-end order,
retaining the upper child at a start cut and the lower child at an end cut.
A full-domain request copies all non-ID coefficients and signed zeros with zero
operations. Existing refinement/split capacities and observation refusals stay
unchanged; native-valid requests can exceed this operation's practical family.

Both intervals must be finite and strictly increasing inside their original
closed domains. There is no sorting, clamping, fitting, reparameterization or
axis conversion. The U/V maps are identity with partial derivative factors1.
A numerically equal original endpoint selects the original endpoint bits;
requested/effective bits remain explicit. Interior requests retain their bits.
An explicit ASCII output ID1..48 and prefix1..20 reserve original/output and
all eight `prefix_cut_0_lo/hi` through `prefix_cut_3_lo/hi` object roles before
staging. Model names use separate namespaces.

The returned owned data are `{original, options, surface, source,
sourceVersion:0, model, originalSource, originalModel, provenance, report}`.
Actual original/output Surface-only source0 Models are independently compiled
and adopted with complete IDs, grid order, coefficients, weights and knot bits.
Original Model name is `surface_region_original`; output Model name is the new
Surface ID. Full native split results record selected/discarded/refined grids,
shared row or column, weights, knot and cut/source lineage. DTO schema
`barocss-native-surface-region`, version0 uses mm and authored XYZ. The caller
owns copied CPU data with GC, without renderer resources or disposal.

`validateExtractedSurfaceRegion(result)` reconstructs native original/options
and compares complete source/Model/coefficient/domain/provenance/report data.
Strict descriptor snapshots reject getters without invoking them, hidden or
symbol fields, unknown fields, foreign/sparse/cyclic/nonfinite data and
alterations. Input bounds are32768 values/depth8/arrays64/records16/strings128;
owned bounds are262144 values/depth32/arrays4096/records64/source strings262144.
Refusal preserves accepted inputs and previous results.

A prechecked cartesian grid of retained knots/boundaries and representable
quarter/midpoint parameters has at most128 local point/D1 observations.
Point comparison uses1e-7mm; each evaluated U/V partial uses relative1e-7 with
an absolute floor. Original native C0/D1 refusal and extracted one-sided
endpoint states remain separate. The native combined D1 result can refuse
both partials when one axis is guarded; no unavailable partial is invented.
Endpoint extraction does not prove original G1/G2 continuity or regularity.
Reports remain not-certified, topologyCertified:false and solid:false, without
global shape or manufacturing accuracy claims. This operation produces a
coefficient Surface region; general trimmed faces, holes, Boolean and topology
remain separate capabilities.

`SurfaceRegionError` and its runtime/type `SurfaceRegionDiagnosticCode` expose
INPUT, INTERVAL, IDENTITY, REPRESENTABILITY, NATIVE_CAPACITY, NATIVE, BINDING and
OWNED codes while retaining native causes.

```sh
node examples/cad-nurbs/surface-region-demo.mjs --source
```

The bounded flow reopens actual source0 and raw signed-zero owned files and
separately imports declared compiled JS/types. Native implementation, product
integration, GPU/Loader consumer adoption and npm publication are separate
states. Later CAD capabilities remain tracked under503/537/660.

## Own wide Curve refinement

`refineCurveWide(curve, {curveId, insertions, resultIdPrefix})` closes the native
31-pole join/reversal workflow gap in knot insertion. The original Curve must
be positive, nonperiodic open-clamped degree1..3 with2..31 poles, weights1e-6..
1e6 and XYZ±10000mm. The ordered `insertions` list contains1..16 distinct,
strictly increasing interior `{parameter,count}` requests, each count1..degree
with final numerical knot multiplicity<=degree. There is no sorting, snapping,
reparameterization, axis conversion or fitting. Original parameter map is
`u=t`; domain endpoint bits and copied original knot/pole/weight bits remain.

Before staging, actual original counts plus every insertion are checked against
64 output/temporary poles and70 knots. Every temporary stage retains native
bounds. The existing own homogeneous calculation is factored within
curve-knot-insertion.ts and shared by the existing16-pole API and this separate
admission profile. The existing insertCurveKnot limits, result shape, source
namespace and arithmetic are preserved. No second insertion engine or public
internal helper alias is added to the barrel.

An explicit ASCII output ID1..48 and prefix1..20 reserve original/output and
all `prefix_step_0` through `prefix_step_15` roles before staging. Model names
are separate namespaces. Original Model name is `curve_wide_original`; output
Model name is the new Curve ID. Original, each staged result and final Curve
are adopted from actual source0 with complete coefficient/ID/order/bit checks.
Provenance retains requested/generated and copied knot slots, homogeneous
left/right/generated coefficients and alpha/parent slots, staged/shared pole
and weight lineage, and original-to-final unchanged slots.

Result data are `{original, options, curve, source, sourceVersion:0, model,
originalSource, originalModel, provenance, report}`. DTO
`barocss-native-wide-curve-refinement`, version0 uses mm/authored XYZ and native
coefficient Curve geometry. The caller owns copied CPU records with GC and no
renderer resources or dispose method. `validateWideCurveRefinement(result)`
rebuilds the complete native chain and compares every owned source/Model,
coefficient bit, provenance, observation and report field.

Descriptor input bounds are32768 values/depth8/arrays64/records16/strings128;
owned result bounds are262144 values/depth32/arrays4096/records64/source strings
262144. Getter/hidden/symbol/foreign/sparse/cyclic/unknown/nonfinite or altered
data refuse without mutating prior accepted data. `WideCurveRefinementError`
and runtime/type `WideCurveRefinementDiagnosticCode` expose INPUT, REQUEST,
IDENTITY, REPRESENTABILITY, NATIVE_CAPACITY, NATIVE, BINDING and OWNED codes,
retaining native causes.

At most128 local point/D1 observations use retained output knots and strictly
representable span midpoints, preserving original endpoint sign bits. Point
comparison uses1e-7mm and evaluated D1 uses relative1e-7 with an absolute floor.
Actual original/output derivative guard or arithmetic refusals stay separate:
a new degree-multiplicity knot does not establish original discontinuity or
G1/G2 continuity. Reports remain not-certified/topologyCertified:false/solid:
false with no global shape or manufacturing certificate. Existing16-pole
adaptive sampling remains bounded; wider adaptive display is a separate task.

```sh
node examples/cad-nurbs/curve-wide-refinement-demo.mjs --source
```

The bounded flow uses an actual31-pole native join, nonunit weighted multi-span
insertion, copied original slots/-0 and a precomputed64-capacity refusal. It
reopens source0/raw signed-zero owned files, compares one small existing-profile
witness and imports actual compiled JS/declarations. Native implementation,
serial Integration, GPU/Loader adoption and npm publication remain separate.

## Own Surface parameter-axis reversal

`reverseSurfaceAxis(surface, {surfaceId, axis, resultIdPrefix})` reverses the
native U or V parameter direction of a positive open-clamped degreeU/V1..3
Surface with axes2..16,total<=256 poles, weights1e-6..1e6 and XYZ±10000mm.
The geometric points stay in authored XYZ/mm. This changes parameter direction
rather than physically rotating the geometry. The selected grid and weights
reverse by individual bit copy, including signed zeros. Nonselected knots and
both original domains remain. Selected interior reflected knots are generated
arithmetic, with original endpoint bits and multiplicities preserved.

Actual `reverseCurve` calls reverse at most16 coefficient strips. All selected
reflected knot bits must agree across strips. These are tensor coefficient
rows/columns, not topology edges or isocurves. No second reflection evaluator,
CurveReversal rewrite, fitting, knot normalization or frame conversion occurs.
The selected decreasing parameter map and D1 factor-1 come from the native
parent; the other parameter and its D1 factor1 remain identity. Double reversal
and generated interior knot bits are not certified.

An explicit ASCII output ID1..48/prefix1..20 reserves original/output and32
`prefix_s0_src/rev` through `prefix_s15_src/rev` roles before staging. Model
names have independent namespaces. Source0 original/output Surface-only Models
are independently compiled and adopted with complete grid/weight/knot/ID/order
bit checks. Original Model name is `surface_reverse_original`; output Model
name is the new Surface ID. Per-strip actual native original/reversed Curves,
sources, Models and provenance accompany original/output coefficient mappings.

Owned result data are `{original, options, surface, source, sourceVersion:0,
model, originalSource, originalModel, provenance, report}`. DTO schema
`barocss-native-surface-axis-reversal`, version0 uses mm/authored XYZ and native
Surface coefficients. Copied CPU records belong to the caller with GC; there
are no renderer resources or disposal. `validateReversedSurfaceAxis(result)`
rebuilds actual native strips and Surface/source/Model/maps/bit/D1/guard data,
then compares all owned fields. Input bounds are32768 values/depth8/arrays64/
records16/strings128; owned bounds262144/depth32/arrays4096/records64/source
strings262144. Getter/hidden/symbol/foreign/sparse/cyclic/unknown/nonfinite or
altered data refuses without changing accepted inputs or prior results.

Selected sample parameter pairs reuse the first native Curve reversal's actual
output-to-original observations. The other axis uses original knots and
strictly representable span midpoints. Their cartesian grid is bounded to128
local point/combined D1 observations before the remaining strips are staged.
Point comparison uses1e-7mm; each evaluated expected partial uses relative1e-7
with an absolute floor. Authored original-knot, mapped-original and reflected
output guards stay distinct, without snapping. Combined native D1 refusal
cannot invent an unaffected partial or certify original G1/G2/regularity.
Unsafe reflection/mapping refuses honestly. Reports remain not-certified,
topologyCertified:false and solid:false without global/manufacturing claims.

`SurfaceAxisReversalError` and runtime/type `SurfaceAxisReversalDiagnosticCode`
expose INPUT, AXIS, IDENTITY, DOMAIN, REPRESENTABILITY, NATIVE, BINDING and OWNED,
with actual native causes preserved.

```sh
node examples/cad-nurbs/surface-axis-reversal-demo.mjs --source
```

The bounded file flow covers weighted U/nonunit V reversal, native C0/signed
zeros and same-ID edit/prior retention. Original/output/strip source0 and raw
signed-zero owned results reopen; actual declared compiled JS/types are checked
separately. General Surface joins/trims/continuity/topology/features/constraints/
assemblies/exchange and consumer adoption remain separate Issues.

## Wide original-parameter adaptive Curve samples

`sampleCurveWideAdaptive(curve, {chordToleranceMM, maxSegments, maxDepth,
resultIdPrefix})` admits positive open-clamped nonperiodic degree1..3 Curves
with2..64 poles/70 knots, weights1e-6..1e6 and authored XYZ±10000mm. Original
parameters, coefficients, weights, knot bits, IDs and source0 remain authority.
Returned points always evaluate that original Curve. Sampling DTO
`barocss-native-curve-samples` version1 explicitly declares this larger family;
geometry sourceVersion stays0. Existing version0/16-pole sampling and consumers
are not silently widened. GPU/Loader version1 adoption is a separate contract.

Each nonzero original knot span uses only degree+1 active original poles.
The own local Cox-de Boor recurrence is expanded analytically in Bernstein
coefficient form, without point fitting or global knot refinement. Native
knot-ratio levels, coefficient matrices, partition residual and homogeneous
control origins remain explicit. A one-hot column copies original pole/weight
bits; other local coefficients declare generated arithmetic. Nonfinite,
negative, unrepresentable or uncertain coefficients refuse without clipping
or renormalization. Each initial local span adopts an actual clamped Curve-only
source0/Model in its original parameter interval. Bezier extraction is a
standard spline representation concept ([Borden et al., 2011](https://doi.org/10.1002/nme.2968));
this implementation uses own coefficient algebra and the own native evaluator.

Only those small local Bezier Curves undergo actual native624 midpoint splits,
with at most7 temporary poles for degree3. The original64-pole Curve is never
globally refined beyond capacity. The existing finite-segment distance metric
is shared through an internal export, preserving the old sampler's behavior.
Positive-weight local hull distance is measured against finite chords with
original Curve endpoints, plus a64-epsilon scaled arithmetic margin. Accepted
segments require hull+margin<=tolerance. Uncertain criteria, unsafe midpoints,
depth or work exhaustion refuse atomically without partial samples.

Tolerance is1e-7..1000mm, maxSegments1..4096, maxDepth0..16 and initial nonzero
spans<=64. The segment budget must cover those initial spans. At most4097
points are returned. ASCII prefix1..20/native ID1..48 reserves context/span/
local split/display segment/display point roles before staging (<=32768roles).
Display IDs do not become native B-Rep edge identities. Adjacent intervals
preserve original shared parameter bits and original domain endpoint signs.

The copied result is `{curve, options, source, sourceVersion:0, model, domain,
parameters, pointsMM, samples, spans, segments, operations, report}`. The original
Curve-only Model is named `prefix_model`; original source and temporary span
Models adopt complete native values/order/identity. Caller ownership is plain
CPU records with GC, without renderer resources or disposal. Input bounds are
32768 values/depth8/arrays128/records16/strings128; owned bounds2097152 values/
depth32/arrays8192/records64/source strings262144. The larger input array bound
admits actual70 knots; the output bound admits4097 points.

`validateWideAdaptiveCurveSamples(result)` rebuilds complete source, analytic
span matrices, local native subdivision, returned original points and reports.
Descriptor/getter0/hidden/symbol/foreign/sparse/cyclic/unknown/nonfinite/tampered
data refuses while previous accepted parents/results remain unchanged.
`WideAdaptiveCurveSamplingError` and runtime/type
`WideAdaptiveCurveSamplingDiagnosticCode` expose INPUT, IDENTITY, SPAN,
REPRESENTABILITY, BUDGET, NATIVE, BINDING and OWNED, retaining native causes.

Accepted local endpoint/midpoint observations record original-vs-local point
residuals at1e-7mm and evaluated D1 residuals at relative1e-7 with an absolute
floor. Native original C0 guard and local one-sided D1 remain separate. Hull,
partition and floating-point margins are local computed estimates/observations,
not a global binary64 or manufacturing certificate. Reports remain
not-certified/topologyCertified:false/solid:false, with sampled display points
rather than fitted geometry, wire/topology or G1/G2 continuity certification.

```sh
node examples/cad-nurbs/curve-wide-adaptive-sampling-demo.mjs --source
```

The bounded flow uses real31-pole joins/refined64-pole source0, nonunit weighted
C0 spans, tighter tolerance, prior retention, source/raw signed-zero DTO reopening
and separate declared compiled JS/types. Native implementation, serial integration,
actual GPU/Loader version1 use and publication remain distinct Issue states.

## Reusable native Bezier spans of wide Curves

`extractCurveBezierSpans(curve, {resultIdPrefix})` obtains genuine local native
Bezier Curves without display tolerance, depth or segment options. Positive
open-clamped nonperiodic degree1..3 original Curves admit2..64 poles/70 knots,
weights1e-6..1e6 and XYZ±10000mm, with at most64 nonzero native spans. It reuses
the tested own analytic local coefficient kernel of the wide sampler, using
onlydegree+1 active original poles per span. There is no global knot refinement,
new evaluator or geometry fitted to sampled points. Existing sampling formats
and behavior stay unchanged by the kernel's internal export.

Original Curve/source0/coefficients/weights/knot/ID/domain/-0 remain authority.
Each actual clamped span Curve has at most4 poles, an explicit temporary ID,
its original parameter interval and independently adopted native source0/Model.
Active original pole/knot indices, basis levels/coefficient matrices/partition
residual, homogeneous controls and original-copy/generated-arithmetic origins
accompany every span. Unsafe coefficients/partition/projection/native bounds
refuse without clipping or repair. Prefix1..20/native ID1..48 reserves original,
context and all64 span roles before staging; Model names are separate.

Owned result is `{curve, options, source, sourceVersion:0, model, domain, spans,
observations, endpoints, report}`. Geometry DTO
`barocss-native-curve-bezier-spans`, version0 uses mm/authored XYZ and native
coefficient spans. It is distinct from the wide sampled-display DTO/version1.
The original Curve-only Model is named `prefix_model`; span Models use their
own IDs. Plain copied CPU records belong to the caller with GC and no renderer
resources or disposal. `validateCurveBezierSpans(result)` rebuilds actual
original/spans/source/Models/matrices/lineage/point/D1/endpoints/reports and
compares all fields and bits, rather than trusting cached provenance.

Input bounds32768 values/depth8/arrays128/records16/strings128; owned bounds
262144 values/depth32/arrays4096/records64/source strings262144. Descriptor
getter0/hidden/symbol/foreign/sparse/cyclic/unknown/nonfinite/tampered data
refuses while accepted parents and previous results remain unchanged.
`CurveBezierSpanExtractionError` and runtime/type
`CurveBezierSpanExtractionDiagnosticCode` expose INPUT, IDENTITY, SPAN,
REPRESENTABILITY, NATIVE, BINDING and OWNED, retaining actual kernel causes.

Each span compares actual original/local points and D1 at original endpoints
and a strictly represented midpoint, at most192 pairs. Point residual uses
1e-7mm; evaluated D1 uses relative1e-7 with an absolute floor. Original C0
refusal and local one-sided derivative stay separate. Endpoint records keep
original parameter/sign bits, original point, adjacent span IDs and original
knot/multiplicity/guard facts. Shared points are observations rather than sewn
wire topology. Reports remain not-certified/topologyCertified:false/solid:false,
without global binary64/manufacturing/G1/G2/edge certificates.

```sh
node examples/cad-nurbs/curve-bezier-spans-demo.mjs --source
```

The bounded file flow extracts actual64-pole/refined and weighted C0 source0,
checks one-hot original bit copies and same-ID edit/prior retention, reopens
actual source0/raw signed-zero results and imports declared compiled JS/types.
Geometry use in later intersections/trims, serial integration and actual
GPU/Loader adoption remain separate Issue states.

## Canonical authored CAD document v1: direct geometry

`createCadDocument(document)`, `serializeCadDocument(document)` and
`parseCadDocument(text)` implement the named first `direct-geometry` profile of
`barocss-cad-document`, version1. It follows CAN-02/CAN-05 requirements revision1
([canonical contract](https://github.com/barocss/barocss/wiki/CAD-Document-Contract)).
Source version0/native Model0 and file version1 are distinct. Existing editor
project/scene and feature-document readers are not rewritten or widened.

Authored fields are exactly schema/version/profile/documentId/revision,
`units:{length:'mm',angle:'rad'}`, `nativeFrame:'authored-xyz-no-axis-conversion'`,
assets/bodies/features/parameters/constraints/placements/derivedCaches. Assets
contain explicit stable ID/revision, role `authored-native-source`, sourceVersion0,
sourceFrame matching the document and original source text. Source text is
preserved verbatim, including numeric spelling, original IDs and literal `-0`.
Actual `compileCadModel(source,{sourceVersion:0})` creates parsed native Models;
those Models are derived result data, never replacement authored source.

Each body has stable ID/name, kind `direct-geometry-object`, assetId and original
geometryId referencing one actual Curve or Surface. The profile groups native
geometry; it does not certify a solid/B-Rep body. Document/body/asset IDs are
ASCII1..48, native geometry IDs ASCII1..128, names1..128 UTF-8 bytes. Logical
revisions are unsigned integers0..2147483647, excluding signed-zero revision;
asset revisions do not acquire an artificial ordering against document revision.
References use asset-qualified original geometry IDs. Identical geometry IDs
across different assets are legal; duplicate body/asset IDs, duplicate ownership
of the same asset/object and missing references refuse. Each asset must be used
by a body; other objects remain intact in its original source/Model.

This profile requires features, parameters, constraints, placements and
**derivedCaches** to be empty. Nonempty graph/constraint/assembly/cache data,
unknown fields, executable values, preview/mesh roles, unsupported future
versions/profiles/frames and malformed native source refuse before acceptance.
A renderer buffer or validity report cannot become authored native geometry.
The frame states raw authored XYZ without conversion; it does not retag source0
as Z-up or invent a universal CAD up axis. Only mm/rad and this frame are supported
here; qualified frame conversions belong to a separate contract.

The caller-owned copied result is `{document, compiledAssets, bodyBindings,
report}`. Actual compiled Models and resolved reference facts live in result
fields separated from the authored DTO. `validateCadDocumentResult(result)`
rebuilds every source/Model/binding/report and compares all data and bits.
CPU data uses GC without renderer resources or disposal. Reports declare
`barocss-cad-document-report`, version0/fileVersion1/profile direct-geometry,
authored source authority and supported/unsupported domains; native observations
remain not-certified/topologyCertified:false/solid:false.

One document admits1..4 assets and1..16 bodies. Individual source<=262144 UTF-8
bytes/code units, aggregate source<=1MiB; input/serialized file<=2MiB UTF-8 bytes/
code units. Serialization uses canonical authored field order and JSON escaping
without changing source strings or embedding parsed/native/display caches.
The strict bounded JSON parser refuses duplicate decoded keys, malformed escapes
and nonfinite/unbounded records; it does not evaluate data or silently overwrite
fields. Codec failure leaves input bytes and prior accepted state untouched.
Input snapshots<=65536 values/depth12/arrays64/records16; owned result<=262144/
depth24/arrays4096/records64/source strings262144. Getter0/hidden/symbol/foreign/
sparse/cyclic/extra/nonfinite or altered data refuses atomically.

`CadDocumentError` and runtime/type `CadDocumentDiagnosticCode` expose INPUT,
VERSION, PROFILE, IDENTITY, REFERENCE, SOURCE, FRAME, BUDGET, JSON and OWNED,
retaining actual source/compiler causes.

```sh
node examples/cad-nurbs/cad-document-demo.mjs --source
```

The bounded flow saves/reopens a source-backed part containing original Curve
and Surface objects, checks exact source/Model/ID/order/-0, source edit/revision
and previous-file/result retention, qualified same-ID assets and concrete invalid
records. Actual source-only and declared compiled JS/types flows are separate.
Full feature graphs, constraints, assembly placement, view/cache persistence,
migration/export profiles, renderer adoption and publication remain separately
tracked under528/712–715/660; empty arrays do not implement those capabilities.

## Qualified document geometry references and derived frame mapping

`createCadGeometryReference(documentResult,{bodyId})` captures an actual native
object's document/body/asset/geometry identity, exact document/asset revisions,
kind, sourceVersion0, authored frame and millimetre unit. Reference schema
`barocss-cad-geometry-reference`, version0 is distinct from document filev1.
`resolveCadGeometryReference(documentResult,reference)` validates/rebuilds the
source-backed712 document, then requires all qualified fields and **exact**
revisions. Missing/foreign/stale references refuse; names, triangle indices,
nearest points and guessed topology never replace authored IDs. This first
profile resolves Curve/Surface geometry only, without topological naming.
Revisions are caller-managed logical values, not content signatures. Source
edits must advance the declared revisions; strict resolution cannot detect a
caller replacing source while deliberately keeping every revision unchanged.
Explicit rebind compares both actual source-backed geometry objects.

`rebindCadGeometryReference(previousDocument,currentDocument,previousReference)`
first resolves the exact original reference against its actual old source.
Document/body/asset/geometry identity, kind, units and frame must remain stable,
and complete old/current native geometry coefficients/knots/weights/order/
signed-zero bits must be unchanged. Only then does it return a new reference
with current revisions. Editing another object or source whitespace can support
an explicit unchanged-geometry rebind; changing selected geometry with the same
ID makes it stale. It never rewrites the old reference or selects a nearby object.

`queryCadDocumentPoint(document,reference,query)` admits exactly
`{kind:'curve',parameter}` or `{kind:'surface',u,v}` for the matching resolved
native kind and original closed parameter domain. It evaluates the actual
original native geometry and returns `{reference,query,pointMM,report}`.
`validateCadDocumentPoint(document,result)` reconstructs the qualified/native
query and compares complete fields and bits. No ray/mesh/barycentric query,
normal/D1 or solid certificate is implied.

`convertCadDocumentPoint(document,pointResult,{targetFrameId,axisMap,
targetLengthUnit})` performs an explicit derived known-axis mapping.
`axisMap` is only identity or `x-z-minus-y`; targetLengthUnit is only mm or m.
The declared axis map is applied first, then exact selected scale1 or0.001.
Reports retain source authored XYZ/mm, caller target-frame ID, actual basis
rows, handedness, source/target units, scale and transform order. The numerical
mapping `(x,z,-y)` does not retag the source as part XYZ/Z-up or infer a universal
CAD up axis. It is not a native geometry edit, placement solver or frame graph.
Nonfinite/unsafe nonzero-product underflow refuses without correction.
`validateCadFrameConversion(document,result)` rebuilds the original validated
point and declared mapping before comparing every result field.

Resolve/create result is `{reference,geometry,source,report}`; explicit rebind
is `{previousReference,reference,report}`; conversion is
`{sourcePoint,options,convertedPoint,report}`. Original source/IDs/coefficient
bits remain, while geometry copies and mapping records are derived CPU data.
Caller ownership uses copied records/GC without renderer resources/disposal.
Reports `barocss-cad-reference-report` and `barocss-cad-frame-conversion-report`
are version0, with actual source authority, not-certified/topologyCertified:false/
solid:false and no global topological naming/manufacturing guarantee.

IDs/revision limits follow712 (document/body/asset1..48, geometry1..128,unsigned
revision0..2147483647). Target-frame ID is ASCII1..48. Strict own-data input
bounds262144 values/depth24/arrays4096/records64/source strings262144 admit actual
712 results; output bounds262144/depth32/4096/64/source262144. Getter0/hidden/
symbol/foreign/sparse/cyclic/unknown/nonfinite and altered records refuse while
prior documents/files/accepted points remain unchanged. `CadReferenceError` and
runtime/type `CadReferenceDiagnosticCode` expose INPUT, VERSION, REFERENCE,
STALE, QUERY, FRAME, REPRESENTABILITY, NATIVE, BINDING and OWNED with causes.

```sh
node examples/cad-nurbs/cad-document-reference-demo.mjs --source
```

The bounded file/native/compiled flow resolves original Curve/Surface points,
checks explicit identity/mm and axis-map/metre output, and observes exact stale
revision versus unchanged-geometry rebind across two revisions. Current packet,
part-XYZ/Motion contracts, authored source, old editor readers, actual renderer
adoption and publication remain separate. CAN-03/CAN-04 topology/placement and
arbitrary frame-graph capabilities remain future scope.

## Explicit document compatibility and candidate migration

Development policy: the current document has one wire version1/profile. This
does not freeze the prototype schema or require old-version compatibility.
SourceVersion0 is a separate native geometry language, not canonical documentv0.
Current specification, API and examples may change together. No legacy document
reader or automatic document-version migration layer is provided here.

`inspectCadDocumentCompatibility({format,text})` validates an explicitly named
format; it never guesses from filenames or similar JSON arrays. The first matrix
supports `canonical-document-v1` through the actual712 strict reader and
`native-source0` through the actual source0 compiler. Source0 is an existing
authored geometry file, not an invented canonical documentv0. Editor project1,
editor scene1, native feature documents and source1/2 are named unsupported here
and retain their own readers. Unknown formats/future profiles refuse rather
than silently dropping feature/constraint data into direct geometry.

`migrateCadDocument(input,options)` returns a candidate and exact preservation/
transformation/unsupported report. For a current canonicalv1 file, options are
exactly `{mode:'identity'}`. For actual source0 geometry, options are
`{mode:'source0-wrap',documentId,revision,assetId,assetRevision,sourceFrame,
bodies:[{id,name,geometryId}]}`. Caller supplies new wrapper identities explicitly;
original native geometry IDs are never guessed or renamed. SourceFrame is only
`authored-xyz-no-axis-conversion`, units stay mm/rad, and unsupported feature/
parameter/constraint/placement/derived-cache arrays stay empty in candidatev1.

Result is `{input,options,candidate,serializedCandidate,report,mappings}`.
`input.text` preserves exact original bytes/text; native source strings,
coefficients/IDs/order/domain/-0 remain. Canonical serialization may change JSON
wire formatting (key order, escaping, numeric spelling and whitespace), not
decoded authored values or native source contents. Source0 wrapping adds only
explicit new document/asset/body metadata. Actual body/asset/input/output
geometry mappings preserve native IDs. The candidate is created by actual712,
serialized, parsed afresh and fully compared/recompiled before acceptance.
No original file or previously accepted document is overwritten.

`validateCadDocumentMigration(result)` reconstructs input/options/candidate,
serialized file, original source/IDs/mappings and report. Source0 input is
bounded262144 UTF-8 bytes/code units; canonical file2MiB and actual712 asset/body/
source limits remain. Strict own snapshots<=524288 values/depth32/arrays4096/
records64/strings2MiB preserve original canonical text. Ill-formed Unicode,
getter0/hidden/symbol/foreign/sparse/cyclic/unknown/nonfinite/duplicate-key/ID/
missing-ref/frame/future-profile or altered data refuses atomically. There is
no eval, reviver, generic document service or best-effort coercion.

Report `barocss-cad-document-compatibility-report`, version0 separates actual
input format/version/profile/source and target documentfilev1/direct-geometry/
source0. Its matrix states supported/unsupported rows, preserved data and
explicit transformations. Copied CPU candidate/report data belongs to caller
with GC and no renderer resources/disposal. Not-certified/topologyCertified:
false/solid:false and no geometry quality certificate follows from migration.
`CadDocumentCompatibilityError` and runtime/type diagnostics expose INPUT,
FORMAT, VERSION, PROFILE, IDENTITY, REFERENCE, FRAME, SOURCE, BUDGET and OWNED,
retaining actual native reader/compiler causes.

```sh
node examples/cad-nurbs/cad-document-compatibility-demo.mjs --source
```

The actual older fixture is the preserved source0 file from the712 original
Curve+Surface part (`CAD_DOCUMENT_SOURCE0_FIXTURE` can select the same supported
profile explicitly). The bounded flow copies/open-wraps it, serializes a
candidate and cold-reads/recompiles the native data. Currentv1 JSON formatting,
unsupported formats/versions/fields, original/prior retention and real compiled
JS/types are checked in the same flow. Older editor/feature readers, lossy
migration, renderer adoption, full format parity and publication are separate.

## Wide native Curve and affine Plane intersections

`intersectCurveWideWithAffinePlaneSurface(curve,plane,options)` extends native
coefficient intersection to positive clamped nonperiodic degree1/2 Curves with
2..64 original poles, at most70 knots and64 nonzero spans. Plane remains an
original equal-weight, four-pole affine degree1x1 Surface with safely represented
independent axes. Degree3 is unsupported in this intersection profile.

Options are exactly `{evaluationId,resultIdPrefix,pointEventIds}`. Caller IDs are
ASCII1..48; prefix1..20 reserves the actual #723 extraction model and all64 span
roles. Supply1..128 distinct event IDs, separate from original/evaluation/span
roles. Private primitive IDs use bounded allocation and cannot collide. More
roots than declared capacity refuse atomically.

Result is `{kind,curve,plane,options,source,sourceVersion,model,extraction,spans,
events,report}`. `extraction` is the actual public `extractCurveBezierSpans`
result, with coefficient matrices, active original poles/knots, homogeneous
lineage, original domain and actual local native source files. Each local
Bezier has at most3 poles. The existing own linear/quadratic Bezier/Plane
primitive computes roots; the existing whole-original event assembly binds
points, brackets, UV and side observations. The older12-pole/8-span API uses
that same assembly with its unchanged32-contribution/16-event caps.

Original full Curve/Plane coefficients remain authoritative. No display
sampling, point fitting, global64-pole refinement or mesh intersection is used.
Exactly equal native parameters consolidate while retaining all contributions.
Distinct seam parameters remain distinct even at the same world point. Original
C0 D1 guards and local one-sided evaluations are separate. Original estimates
and bracket samples must agree on finite Plane UV classification; no clamping,
projection or snapping is applied. Coincident spans report support intervals and
control-hull containment or finite-containment-not-proven. Wide finite clipping,
sewn vertices, Curve–Curve and curved Surface intersection are separate work.

Report declares `barocss-native-wide-curve-plane-intersection`, version0, mm and
`authored-xyz-no-axis-conversion`; this is independent of canonical documentv1.
It records original/extracted roles, span/contribution/event counts, original
C0 parameters, inherited root/Gram/bracket policies, and copied CPU ownership.
Local numerical observations do not certify global binary64 error,
manufacturing tolerances, G1/G2, topology or a solid.

Limits are64 spans,128 isolated contributions/events,64 inherited root steps
per root and512 private ID-allocation attempts. Inputs allow32768 values,
depth8, arrays128, fields16 and strings128. Owned results allow1048576 values,
depth40, arrays4096, fields64 and source strings262144.
`validateWideCurveAffinePlaneIntersection(result)` snapshots and reconstructs
the full original geometry, extraction, local roots, event lineage, source and
report. Unsupported inputs, unsafe arithmetic, unresolved predicates, capacity
exhaustion and malformed or altered owned data refuse without changing a prior
accepted result. Diagnostics are INPUT, IDENTITY, SPAN, REPRESENTABILITY,
BUDGET, NATIVE, BINDING and OWNED.

The single source/native-file/compiled JS and declarations prototype is:

```sh
pnpm --filter @barocss/cad build:library
node examples/cad-nurbs/curve-wide-plane-intersection-demo.mjs --source /tmp/barocss-wide-curve-plane
```

Native implementation, Integration adoption, actual GPU/Loader use and
publication remain separate checkpoints.

## Document export capabilities and loss reports

`getCadDocumentExportCapabilities()` declares the actual writer boundaries.
Current direct-geometry documents can export native NURBS Curve126/Surface128
through the existing own IGES5.3 ASCII writer. Derived GLB belongs to
`@barocss/cad-interop` and its explicit preview-packet/frame contracts; it uses
approximate meshes and metres. It is not a direct-document CAD writer here.
General STEP and native feature/history/topology exchange remain unsupported.

`inspectCadDocumentExport(document,options)` stages selected copies through the
actual writer and returns the exact report before a caller accepts bytes.
`exportCadDocument(document,options)` returns
`{document,options,iges,writerReport,report}`. Both are CPU operations without
filesystem access. Options are exactly
`{target:'iges-5.3-ascii',exportModelId,selections:[{reference,outputId}]}`.
Supply1..16 exact current `CadGeometryReferenceV0` references in output order;
model/output IDs are distinct caller-declared ASCII identifiers1..48. Original
native IDs may be equal in different assets: their full qualified references
map to distinct output IDs. Duplicate body selections and stale/foreign/missing
references refuse; no fallback naming or nearest geometry is used.

The original document, authored source text, asset/body identities, declared
revisions and native coefficients remain intact. Output IDs apply to copies
only. The existing writer preserves rational degrees, weights, knots, control
coordinates, logical pole/grid indices and original parameter domains numerically,
with no mesh approximation or axis/unit conversion. Surface128 serializes U
fastest with V outside, while retaining the original grid index meanings. It
normalizes numeric negative zero to positive zero. The report separately counts
native occurrences and IGES numeric-field occurrences, including repeated domain
endpoints, rather than claiming bit preservation in IGES.

IGES directory labels contain only the first8 characters of output IDs; labels
may collide. The sidecar maps each full qualified source reference and explicit
output ID to entity kind, unique directory/parameter pointers, label and native
domains. It reports truncation, label collisions and signed-zero normalization.
Original authoring metadata/source and unselected geometry are not encoded in
the IGES file. Unsupported features, parameters, constraints, placements, caches, topology
and history are separate from these actual omissions. Retain the authoring file
and mapping; IGES alone does not recover the native document.

The report is `barocss-cad-document-export-report`, version0, for current document
version1/sourceVersion0, native-geometry-exchange/126-128, millimetres, raw
`authored-xyz-no-axis-conversion` and scale1. Report/format numbering does not
freeze the early document schema or introduce legacy document readers.
`validateCadDocumentExport(result)` reconstructs the original document, exact
references, selected copies, writer bytes, loss report and mappings. Altered
owned bytes, original geometry, revisions, refs or metadata refuse without
changing a previously accepted document or output.

Document inputs allow524288 values/depth32/arrays4096/fields64/strings2MiB;
options32768 values/depth12/arrays64/fields16/strings128; results2097152 values/
depth40/arrays4096/fields64/strings2MiB. Existing canonical/native source bounds
also apply. Output ASCII is at most2MiB. Diagnostics are INPUT, TARGET,
REFERENCE, IDENTITY, BUDGET, NATIVE, BINDING and OWNED. Copied CPU data uses normal
GC; no renderer resources or disposal are introduced. Local exchange evidence
does not certify solids, topology, global binary64 error or manufacturing
accuracy.

The one native/file/compiled-report flow, including a short read of its actual
new IGES through the already-installed independent test consumer, is:

```sh
pnpm --filter @barocss/cad build:library
node examples/cad-nurbs/cad-document-export-demo.mjs --source /tmp/barocss-document-export
```

The independent reader is test-only. It is not a dependency of the CAD engine.
Native readiness, Integration adoption, actual consumer support and publication
remain separate.

## Cubic Bezier Curve and affine Plane intersections

`intersectCubicBezierCurveWithAffinePlaneSurface(curve,plane,options)` admits one
positive clamped nonperiodic native cubic Bezier Curve:4 poles/8 knots/one span.
Plane is the existing safely represented affine equal-weight four-pole
Surface1x1. Coordinates are within±10000mm; native positive weight bounds and
represented parameter spans apply. Options are exactly
`{evaluationId,pointEventIds}` with1..3 explicit distinct event slots and
ASCII1..48 original/context/event IDs.

The operation retains complete original Curve/Plane IDs, control coordinates,
weights, knots, original domains and sign bits. The actual compound source0
file contains those two original objects. Root solving scales only a derived
four-coefficient homogeneous plane numerator, never the native geometry.
Nonzero underflow or collapsed distinct adjacent scalar coefficients refuse.

A safely strict same-sign cubic Bernstein hull excludes support roots directly.
The report records that exclusion and that a derivative search was not needed;
uncertain signs never become a false no-hit. An all-zero numerator likewise
needs no stationary search. Otherwise the derivative numerator is quadratic
in Bernstein form. Its roots use the
existing own quadratic solver. Actual derivative-root brackets divide the
normalized cubic domain into monotone intervals and critical brackets. Each
critical bracket must exclude a support root with a strict sign and derivative
control-hull Lipschitz margin plus a64-epsilon arithmetic guard. Interior
tangency, repeated roots, near-zero signs or unresolved derivative predicates
refuse atomically. A simple crossing is refined by sign-bracket bisection of
the original normalized cubic numerator. A near-zero midpoint can shrink its
bracket only when represented quarter points have safely opposite signs.
There is no point fit, mesh intersection or external geometry kernel.

Global endpoint roots are explicit; distinct start/end parameters stay distinct
even at the same world point. An all-zero numerator reports coincident support,
with control-hull-contained or finite-containment-not-proven semantics. No
finite coincident clipping is added. Root evidence records original/derived
coefficients and scale, actual derivative equation/roots, critical bracket
margins, monotone intervals, scalar observations and bounded work counts.

Result is `{kind,curve,plane,options,source,sourceVersion,model,events,report}`.
Events reuse original native Curve point/Plane UV/bracket binding and D1 states.
Finite Plane classification must agree at the estimate and bracket samples;
no UV clamping, point projection or sewn/exact algebraic vertex is implied.
Report DTO is `barocss-native-cubic-curve-plane-intersection`, version0, mm and
raw `authored-xyz-no-axis-conversion`. The original degree1/2 public primitive
keeps its admission, arithmetic, DTO and limits; both use the same trusted
plane-axis/projection/root-binding/support helpers.

Limits are3 isolated roots,2 derivative roots,64 bisection steps per actual
root,1024 cubic scalar evaluations,3 monotone intervals and2 critical brackets.
Original-domain bracket target is1e-12; the normalized target is the smaller of
1e-12 and1e-12 divided by original span width. Input snapshots allow4096 values,
depth8, arrays64, fields16 and strings128; owned results262144 values/depth32/
arrays4096/fields64/source262144. Numerical/order/work/identity/unsupported and
malformed or altered owned data refuse without replacing prior accepted data.

`validateCubicBezierCurveAffinePlaneIntersection(result)` reconstructs actual
original source, scalar evidence, roots, original points/UV/brackets/IDs/report.
Diagnostics are INPUT, IDENTITY, REPRESENTABILITY, BUDGET, NATIVE, BINDING and
OWNED. Data is copied CPU/GC state, with no renderer resources. Local evidence
does not certify global binary64 accuracy, manufacturing tolerances, G1/G2,
topology or solids. Wide cubic composition, Curve-Curve and curved-Surface
intersection, arbitrary trims/sewing/Boolean remain separate work.

The one source/native-file/owned-data/compiled JS and types flow is:

```sh
pnpm --filter @barocss/cad build:library
node examples/cad-nurbs/cubic-curve-plane-intersection-demo.mjs --source /tmp/barocss-cubic-curve-plane
```

Native readiness, Integration adoption, actual consumer use and publication
remain separate.

## Wide native cubic Curve and affine Plane intersections

`intersectCubicCurveWideWithAffinePlaneSurface(curve,plane,options)` composes the
actual native Bezier-span extractor with the actual cubic Curve/Plane primitive.
It admits positive clamped nonperiodic degree3 originals with4..64 poles,
at most70 knots/64 nonzero spans and XYZ±10000mm. Plane remains the safe
four-pole equal-weight affine Surface1x1. Existing native positive weight bounds
apply. Original full Curve coefficients and source0 remain authoritative.

Options are exactly `{evaluationId,resultIdPrefix,pointEventIds}`. Original/
context/event IDs are ASCII1..48; prefix1..20 reserves the actual extraction
model and all64 span roles. Supply1..192 distinct event slots in original
parameter order. Every local cubic reserves4 private roles before geometry
staging, with at most1024 allocation attempts. No automatic renaming of
original native geometry or frame conversion occurs.

Result is `{kind,curve,plane,options,source,sourceVersion,model,extraction,spans,
events,report}`. Extraction is the actual `extractCurveBezierSpans` result,
including original active coefficients/knots, analytic matrices, source lineage
and original parameter intervals. Each concrete span includes the actual cubic
primitive result and its scalar equation/derivative/search/exclusion evidence.
The same whole-original event assembly binds points, Plane UV, brackets and
native one-sided observations. Only its internal structural input type changes;
old degree1/2 public DTOs/admission/numeric code/limits remain unchanged.

Exactly equal original shared-knot parameters consolidate while retaining all
span contributions. Distinct seam parameters stay distinct even at equal world
points. Original C0 D1 guards and local one-sided D1 remain separate. Estimates
and bracket samples must agree on finite Plane UV classification; no clamping,
projection, point fit, mesh intersection or global Curve refinement is used.
Coincident support retains contained/unproved finite interval semantics, with
no wide coincident clipping or sewn topology. Any unresolved local cubic
predicate refuses the whole operation atomically.

The report DTO is `barocss-native-wide-cubic-curve-plane-intersection`, version0,
mm/raw-authored-XYZ. It records original authority, actual span/primitive/
contribution/event counts, actual aggregate scalar work, derivative searches
versus safe no-search exclusions, C0 parameters and private role allocation.
Limits are64 primitive spans,192 isolated contributions/events and65536 total
cubic scalar evaluations. Each primitive retains its3-root/2-derivative-root/
64-step-per-root/1024-evaluation bounds. Copied CPU state uses GC, with no
renderer resources or disposal.

Inputs allow32768 values/depth8/arrays256/fields16/strings128; full owned result
4194304 values/depth48/arrays4096/fields64/source262144. Original source and
extraction limits still apply. `validateWideCubicCurveAffinePlaneIntersection`
reconstructs original geometry/source, actual coefficient spans, local cubic
evidence, original point/UV contributions, IDs/brackets/report. Capacity,
unknown/getter/hidden/symbol/foreign/sparse/cyclic/nonfinite and altered owned
data refuse without replacing prior accepted input/results. Diagnostics are
INPUT, IDENTITY, SPAN, REPRESENTABILITY, BUDGET, NATIVE, BINDING and OWNED.

The single actual native/source-file/compiled JS and types flow is:

```sh
pnpm --filter @barocss/cad build:library
node examples/cad-nurbs/curve-wide-cubic-plane-intersection-demo.mjs --source /tmp/barocss-wide-cubic-plane
```

This flow uses the existing actually refined64-pole source; local observations
are not global binary64/manufacturing/G1/G2/topology/solid certification.
Generic curved Surface/Curve-Curve intersection, arbitrary trims/sewing/Boolean,
actual GPU/Loader consumption, Integration adoption and publication remain
separate work.

## Native extrusion construction volume and centroid

`measureCoplanarFaceBooleanExtrusion` measures a validated native coplanar
Boolean extrusion. It retains each component, Shell and hole identity. Signed
moments of the selected UV loops subtract hole material. The actual native
support D1 supplies the area Jacobian and maps each cap centroid to raw XYZ.
The sweep volume is cap area times distance. The homogeneous geometric centroid
lies halfway along the actual normal translation. The combined centroid uses
component volumes as weights.

```ts
const properties = cad.measureCoplanarFaceBooleanExtrusion(extrusion, {
  maximumBoundarySegments: 64,
  maximumSurfaceEvaluations: 8,
});
console.log(properties.report.volumeMM3, properties.report.centroidMM);
cad.validateCoplanarFaceBooleanExtrusionProperties(properties);
```

The caller budgets cover every selected boundary segment and component before
new D1 work. A genuine empty extrusion accepts zero budgets, returns zero area
and volume, and has a null centroid. A centroid can lie inside a hole or outside
material. It is not an interior-point witness.

These are construction metrics for the admitted affine, line-boundary normal
sweep. Canonical trim incidence and unsnapped native edge residuals retain
their existing distinction. The results do not certify general Solid volume,
sewing, manufacturing accuracy or a global floating-point error bound. Density,
mass and inertia need a separate contract. Separate graph outputs are measured
individually; this API does not combine overlapping parts into a union.

Run the saved native extrusion measurement flow after the library build:

```sh
node examples/cad-nurbs/boolean-extrusion-properties-demo.mjs --source /tmp/cad-properties --extrusion-directory /path/to/cad-extrusions
```

The flow checks tilted geometry, holes, disconnected components, empty material,
a distance edit and an off-centre hole. It preserves authentic source files and
compares derived measurements with analytic fixtures and saved cap triangles.

## Wide native Curve control-point and weight editing

`editCurveControlPolygonWide(curve,edits)` admits positive clamped nonperiodic
native Curves of degree1..3 with2..64 poles/at most70 knots/64 nonzero spans.
Coordinates stay within±10000mm; existing native weight bounds1e-6..1e6 apply.
Curve IDs are ASCII1..48. Edits reuse `CurveControlPolygonEdits`:
`{poleEdits:[{index,xMM?,yMM?,zMM?,weight?}]}` with1..64 distinct in-range indices
and at least one explicit finite requested field per record. Values are absolute
replacements. No-op requests are valid; requested negative-zero values retain
their sign. Duplicate indices and unknown fields refuse.

The existing pole-patch admission/application/provenance calculation is shared
by the older16-pole API and this explicit wider profile. Original kind/ID/degree,
knots/domain/order and all unrequested coordinate/weight bits stay unchanged.
The entire candidate must pass native admission and actual source0 compilation
before acceptance. No normalization, point fit, parameterization/topology change
or inferred persistent vertex naming is added.

Result is `{original,edits,curve,source,sourceVersion,model,originalSource,
originalModel,provenance,report}`. Original and candidate source strings are
actual regenerated canonical geometry files from the supplied native Curve;
they do not recover unavailable caller source formatting or its model name.
Caller original files remain untouched. The report DTO is
`barocss-native-wide-curve-control-polygon-edit`, version0/mm/authored XYZ.
It records requested/changed/untouched fields and poles, native point effects,
original C0 guards and bounded before/after D1 observations. Only the exact
native C0 refusal is a guard state; other actual arithmetic failures refuse
atomically. Coordinate/weight edits can change geometry and tangents; no G1/G2
or global shape accuracy is certified.

Observations use unique original knots and represented span midpoints, at
most129 point and129 D1 observations. Intervals without a represented midpoint
are recorded rather than supplied an invented point. Inputs allow32768 values,
depth8/arrays128/fields16/strings128; owned result524288 values/depth32/arrays4096/
fields64/source262144. Existing native source limits apply. Data is copied CPU
state with GC and no renderer resources/disposal.

`validateWideCurveControlPolygonEdit(result)` reconstructs original/edits,
candidate/source/models/provenance/observations/guard states/report. Capacity,
unknown/getter/hidden/symbol/foreign/sparse/cyclic/nonfinite and altered owned
data refuse without changing previous input or accepted data. Diagnostics are
INPUT, IDENTITY, BUDGET, NATIVE, BINDING and OWNED. Old public admission, output,
source, report and16-pole/16-edit limits remain unchanged.

The one actual source/native-file/owned-data/compiled JS and declarations flow is:

```sh
pnpm --filter @barocss/cad build:library
node examples/cad-nurbs/curve-wide-control-polygon-demo.mjs --source /tmp/barocss-wide-curve-edit
```

Native readiness, Integration adoption, actual consumer use and publication
remain separate. Topology/solid/manufacturing certification and a legacy
document-history layer are not added.

## Wide native Curve reversal

`reverseCurveWide(curve,{curveId})` admits positive clamped nonperiodic native
Curves of degree1..3 with2..64 poles and at most70 knots, XYZ±10000mm and
existing positive weight bounds. Explicit output ID is ASCII1..48 and differs
from the original. This profile reuses the original guarded reflection,
coefficient-copy, provenance, source and native observation calculation. The
older31-pole API keeps its admission, DTO, limits and output.

Control points and weights reverse by exact copies. Original domain endpoint
bits stay; interior knots use the existing guarded `u=a+(b-v)` reflection.
Collapsed/cancelled/unordered or unrepresented values refuse rather than snap.
Original geometry and caller files stay intact. Output source0/mm/raw authored
XYZ has a new explicitly supplied Curve ID, with no axis or unit conversion.
Generated interior knot bits and double-reversal bit equality are not certified.

Result retains `{original,options,curve,source,sourceVersion,model,originalSource,
originalModel,provenance,report}`. Report DTO is
`barocss-native-wide-reversed-curve`, version0/mm/authored XYZ, with original
parameter correspondence, point comparisons, negative D1 comparisons and
original/mapped/reversed native guard states. Source strings are regenerated
actual geometry, not recovery of unavailable caller formatting/model name.
No topology/sewn wire/solid/G1/G2/global accuracy/manufacturing certificate is
implied. Copied CPU data uses GC; no renderer resources or disposal.

At most256 knot/quarter/midpoint observations and64 guard records are admitted.
Inputs allow32768 values/depth8/arrays128/fields16/strings128; owned data524288
values/depth32/arrays4096/fields64/source262144. Native/source limits apply.
`validateWideReversedCurveResult(result)` reconstructs originals/options/source,
coefficients/reflection maps/point-D1/guards/report. Descriptor/getter/symbol/
hidden/foreign/sparse/cyclic/nonfinite/unsafe arithmetic/capacity/tamper failures
refuse atomically. Diagnostics are INPUT, IDENTITY, DOMAIN, REPRESENTABILITY,
BUDGET, NATIVE, BINDING and OWNED.

```sh
pnpm --filter @barocss/cad build:library
node examples/cad-nurbs/curve-wide-reversal-demo.mjs --source /tmp/barocss-wide-reversal
```

The single actual file/compiled flow uses the previously produced64-pole source.
Native readiness, Integration adoption, actual consumer use and publication
remain separate; no legacy document-history layer is introduced.

## Three-section homogeneous loft Surface

`buildThreeSectionLoftSurface(first, middle, last, {surfaceId})` constructs a
native rational Surface through three original Curves at V=0,0.5,1. This is
the bounded PART-05/SURF-04 child #847. The common Curve parameter remains U.
The middle section can depart from the ruled blend of the endpoints.

```js
const loft = cad.buildThreeSectionLoftSurface(first, middle, last, {
  surfaceId: 'three_section_loft',
});
cad.validateThreeSectionLoftSurface(loft);
const middlePoint = cad.evaluateSurface(loft.surface, originalU, 0.5);
```

All three sections must have the same degree, pole count and exact Object.is
knot basis, including signed zero. Admission is positive, clamped, nonperiodic
degree1..3 with2..16 poles, weights[1e-6,1e6] and authored XYZ within±10000mm.
All three Curve IDs and the new Surface ID must differ (ASCII1..48). There is
no automatic degree/knot repair, section reorientation or weight rescaling.
Independent original weights have a defined effect on the loft between sections.

The new Surface has degreeU equal to the section degree and degreeV2, with
knotsV=[0,0,0,1,1,1]. For each common pole index, original homogeneous
coefficients Hfirst,Hmiddle,Hlast produce the middle Surface coefficient
`2*Hmiddle - 0.5*(Hfirst + Hlast)`. Original endpoint pole and weight bits
are copied; generated middle coefficients need not retain original bits.
A generated weight outside[1e-6,1e6], near-zero weight cancellation, nonfinite
arithmetic or generated Cartesian coordinate outside±10000mm refuses the
whole result. Three individually valid Curves can therefore be incompatible
with this positive quadratic loft profile.

The result owns copied `sections`, `options`, `surface`, `source`,
`sourceVersion:0`, `model`, `provenance` and `report`. The regenerated
four-object Source0 Model contains all three unchanged original Curves and
the derived Surface. It preserves original coefficients and common parameter
bits; it does not recover the caller's source formatting or original Model
name. Whole-owned validation reconstructs the source/Model, generated net,
lineage, observations and report from the original sections/options. This is
a current-only DTO (`barocss-native-three-section-loft`, version0), separate
from canonical document version1.

Distinct native U breaks and representable interior span midpoints feed
V=0,0.5,1 observations (at most96). Successful section point comparisons use
1e-7mm; successful native section D1 versus Surface Du comparisons use
relative1e-7. Exact C0 knot and arithmetic refusals remain explicit native
states. These are local observations, with no global error or G1/G2 guarantee.
The authored frame remains raw XYZ/mm. Data is copied CPU data with no
renderer resource or disposal contract.

```sh
node examples/cad-nurbs/three-section-loft-demo.mjs --source /tmp/cad-three-section-loft
```

The example uses actual source imports, saved/reopened four-object Source0,
whole-owned signed-zero JSON, a small existing Surface preview and extracted
iso-curves. Its native evidence is separate from Integration adoption and
GPU/Loader consumer evidence. Arbitrary section counts/parameters, guide
curves, periodic/closed loft, caps, BRep, solid validity, general sweep and
manufacturing certification remain open.

## Native document control-hull bounds

`queryCadDocumentBounds(documentResult, reference)` resolves one exact
qualified Curve or Surface from the current canonical document. It returns
original geometry/source/reference, `boundsMM`, `extentMM`, `boxCenterMM`,
six original pole witnesses in `extrema`, and a report.

```js
const reference = cad.createCadGeometryReference(document, {bodyId}).reference;
const bounds = cad.queryCadDocumentBounds(document, reference);
cad.validateCadDocumentBounds(document, bounds);
```

The box uses all original positive rational control poles in authored XYZ/mm.
It is a conservative control-hull box, and can be wider than the geometry's
actual extrema. This distinction makes it independent of display tessellation.
The analytic enclosure is the positive rational convex-hull property in exact
arithmetic; evaluated binary64 points do not carry a global enclosure guarantee.
The native current profile remains degree1..5, Curve poles2..64 and Surface
grid axes2..16 (at most256 poles), weights[1e-6,1e6]. No geometry frame, source
coefficient, authored ID, original parameter domain or weight is changed.

Extrema order is x-min,x-max,y-min,y-max,z-min,z-max. The first Object.is
matching coefficient in Curve index or Surface row-major order is the witness.
When both zero signs occur, the minimum uses -0 and the maximum +0. A Curve
witness uses `poleIndex`; a Surface witness uses `uIndex`/`vIndex`. Each carries
a copied original point. Extents and box centre are derived values. Box centre
is not the centre of mass.

The current-only report schema is `barocss-cad-document-bounds`, version0.
Document and asset revisions must match the reference exactly. After a source
edit and revision advance, old references refuse with STALE. Whole-owned
validation requires the actual document and reconstructs source/geometry, all
box fields, witnesses and report. Copied plain CPU data has no renderer resource
lifecycle. Getter, foreign/sparse/cyclic data and owned tampering refuse.

```sh
node examples/cad-nurbs/cad-document-bounds-demo.mjs --source /tmp/cad-native-bounds \
  --loft-source /absolute/path/to/independent_weights.source0.css
```

This ENG-02 subset does not provide tight curve/surface extrema, assembly or
BRep bounds, area, volume, density, mass or inertia. Native evidence, Integration
adoption and independent GPU/Loader consumers remain separate.

## Source-qualified native Curve arc-length estimate

`queryCadDocumentCurveArcLength(documentResult, reference, options)`
integrates the original Curve derivative norm over a declared native interval.
The exact document/body/asset/native Curve reference is resolved by the existing
CAD document reference API. The result contains an `estimatedLengthMM`,
`errorEstimateMM`, copied original geometry/source/reference/options, accepted
panels and a report. It does not measure a displayed polyline or a straight
point-to-point distance.

```js
const reference = cad.createCadGeometryReference(document, {bodyId}).reference;
const estimate = cad.queryCadDocumentCurveArcLength(document, reference, {
  interval: null,
  absoluteToleranceMM: 1e-7,
  relativeTolerance: 1e-8,
  maximumEvaluations: 4096,
  maximumSubdivisions: 128,
  maximumDepth: 12,
});
cad.validateCadDocumentCurveArcLength(document, estimate);
```

`interval:null` uses the original domain and endpoint bits. An explicit finite
increasing `[a,b]` must lie inside that domain. Zero, reversed or outside
intervals refuse; parameters are never sorted, clamped or normalized. The
profile is positive clamped nonperiodic degree1..3, poles2..64, knots≤70,
XYZ±10000mm and native weights[1e-6,1e6]. Geometry/frame/source/IDs and
coefficients remain unchanged. Supported zero-speed intervals can return0.

Each original knot span uses3-point and5-point Gauss-Legendre quadrature of
the actual native D1 norm. Their common centre is reused, with seven strict
interior nodes per measured panel. Q5 is the length estimate. The panel
estimator includes the Q5/Q3 difference and64 epsilon times abs(Q5). A native
point sanity check uses the two native endpoint points and seven actual D1
node points: if their ordered chord sum exceeds Q5, the deficit also enters
the estimator. This catches obvious missed variation such as an extreme
rational weight ratio. The chord chain is a sanity check; the length result
remains the derivative integral estimate. Its floating arithmetic is not a
certified bound.

If the summed estimator exceeds max(absoluteToleranceMM,relativeTolerance
*estimatedLengthMM), the greatest-estimator panel is bisected. Ties use
increasing U order. All nodes and midpoints must remain distinct and strictly
representable. Unsafe arithmetic, native derivative refusal, exhausted depth
or work budget refuses atomically with no accepted partial result. Exact C0
knot D1 refusals are recorded separately; endpoint point evaluation remains
native D0 and no knot tangent is invented. Evaluations include discarded
parents; endpoint point and knot-guard counts are reported separately.

Absolute tolerance is[1e-9,1]mm, relative tolerance[0,1e-2], quadrature D1
budget7..16384, subdivisions0..512 and depth0..16. The convergence criterion
is a heuristic estimator criterion. It does not certify the requested global
error, manufacturing tolerance or floating containment. General area, volume,
mass and posed-world measurements remain separate.

The current-only DTO schema is `barocss-cad-curve-arc-length`, version0,
raw authored XYZ/mm. Whole-owned validation requires the actual document and
reconstructs the exact reference/options, geometry/source, all panel nodes,
subdivision trace, guards, counts and estimates. Revision mismatch remains
STALE. Copied CPU data has no renderer resource lifecycle or legacy reader.

```sh
node examples/cad-nurbs/cad-curve-arc-length-demo.mjs --source /tmp/cad-native-arc-length
```

The example uses known Line/quarter-circle/piecewise lengths, a declared
interval, zero speed, an actual source edit/revision, one native reversal
witness and saved/reopened source/document/result files. Analytic comparisons
are local prototype evidence. Integration and display consumers need their
own receipts.

## Source-qualified native Surface parametric-area estimate

`queryCadDocumentSurfaceArea(documentResult, reference, options)` estimates
the integral of `norm(cross(du,dv))` over the original Surface parameter
rectangle, in mm². It uses the current qualified document reference and
actual native Surface D1. It counts parametrized coverage, including
multiplicity of overlapping portions. It does not provide union area,
trimmed BRep face area or a mesh-area measurement.

```js
const reference = cad.createCadGeometryReference(document, {bodyId}).reference;
const area = cad.queryCadDocumentSurfaceArea(document, reference, {
  region: null,
  absoluteToleranceMM2: 1e-6,
  relativeTolerance: 1e-8,
  maximumEvaluations: 16384,
  maximumSubdivisions: 128,
  maximumDepth: 8,
});
cad.validateCadDocumentSurfaceArea(document, area);
```

`region:null` retains original U/V domains and endpoint bits. An explicit
`{u:[a,b],v:[c,d]}` must be finite, increasing and inside both original
domains. Zero, reversed and outside rectangles refuse; parameters are never
clamped, sorted, normalized or interpreted as fractional physical angles.
Admission is positive clamped nonperiodic degreeU/V1..3, axes2..16, at most256
poles and20 knots per axis, XYZ±10000mm and native weights[1e-6,1e6]. The
existing native degree4/5 profile remains separate from this numerical
subset. Source/coefficients/IDs/frame/revisions remain authoritative.

Initial cells split at all actual U/V knot breaks. Each cell compares tensor
3x3 and5x5 Gauss-Legendre quadrature. Their common centre is reused:33 native
D1 evaluations per measured cell, all strict interior representable points.
Q5 is the area estimate. The estimator uses their difference,64 epsilon
times abs(Q5), and a native point sanity check. A3x3 endpoint/midpoint grid
uses eight native D0 evaluations plus the existing centre point. Eight
fixed triangles provide a local plausibility check; any triangle-area
shortfall in Q5 also enters the estimator. This check can be conservative.
Its floating area is not a certified bound and never replaces Q5.

The greatest-estimator cell splits into four children when the aggregate
estimator exceeds max(absoluteToleranceMM2,relativeTolerance*areaEstimateMM2).
Ties follow the current deterministic cell list. Child order is lowerU/lowerV,
lowerU/upperV,upperU/lowerV,upperU/upperV. Original initial-grid order and
replacement traversal remain deterministic; local refinement does not promise
globally lexicographic cells. Measurement IDs and counts include discarded
parents. Genuine native C0 U/V derivative refusals are observed separately
using a strict other-axis interior parameter. No boundary derivative or
normal is fabricated.

Unsafe cross/product/sum arithmetic, nonzero derived underflow, insufficient
node spacing or exhausted work/depth/subdivision budgets refuse atomically.
Rank-deficient/zero native Jacobians may contribute0; this is not a surface
regularity or global zero-area certificate. Absolute tolerance is[1e-8,10]mm²,
relative[0,1e-2], D1 budget33..65536, subdivisions0..128 and depth0..10.
Estimator convergence is heuristic and does not certify requested global
error, manufacturing tolerance, topology, solid, volume or mass.

The result owns `reference`, `geometry`, `source`, `options`,
`areaEstimateMM2`, `errorEstimateMM2`, `cells` and `report`. Current-only
report schema is `barocss-cad-surface-area`, version0, current document1 and
Source0. The canonical authored frame remains exactly
`authored-xyz-no-axis-conversion`. Whole-owned validation re-resolves the
actual document and reproduces every node, native point/Jacobian, sanity
triangle, cell, subdivision, guard, count and criterion. CPU copies/GC have
no renderer resource lifecycle. Stale references keep their STALE category.

```sh
node examples/cad-nurbs/cad-surface-area-demo.mjs --source /tmp/cad-native-surface-area
```

The example uses known affine-plane/full-cylinder/subrectangle/C0-extrusion
areas, zero area, actual control-net edit/revision and one native axis
reversal witness. It saves/reopens original source, current document and
raw signed-zero results, with separate manifest JS/types checks. Analytic
comparisons are local prototype evidence. Integration and independent display
consumers require their own receipts.

## Authored assembly instances and rigid parent-child frames

`evaluateCadAssembly(wire)` accepts a genuine authored assembly domain:
`barocss-cad-assembly`, version0. It embeds1..4 accepted canonical
CadDocumentV1 documents and0..32 instances. This is separate from the
original direct-geometry document profile. Its placements:[] and unique
asset-qualified body ownership rules remain unchanged. Source0 geometry,
original local queries, native measurements and document exports remain
unposed. External part loading and assembly export are separate features.

The authored assembly fields are `schema`, `version`, `assemblyId`,
`revision`, `lengthUnit:'mm'`, `rotationUnit:'deg'`,
`frame:'assembly-space-xyz'`, `parts` and `instances`. Each instance has
`id`, `parentId` (null for root), one actual qualified `reference`, and
`placement:{translationMM,rotationDegreesXYZ}`. Different instances may
share one complete native reference. Equal geometry IDs in different
assets or documents remain distinct parts. Instance and frame IDs are
not BRep topology IDs.

```js
const partReference = cad.createCadGeometryReference(part, {bodyId}).reference;
const assembly = cad.evaluateCadAssembly({
  schema: 'barocss-cad-assembly', version: 0, assemblyId: 'assembly_demo',
  revision: 0, lengthUnit: 'mm', rotationUnit: 'deg', frame: 'assembly-space-xyz',
  parts: [part.document],
  instances: [
    {id: 'parent', parentId: null, reference: partReference,
      placement: {translationMM: [10, 0, 0], rotationDegreesXYZ: [0, 0, 90]}},
    {id: 'child', parentId: 'parent', reference: partReference,
      placement: {translationMM: [3, 0, 0], rotationDegreesXYZ: [0, 0, 0]}},
  ],
});
const point = cad.queryCadAssemblyInstancePoint(assembly, {
  assemblyId: assembly.assembly.assemblyId,
  assemblyRevision: assembly.assembly.revision, instanceId: 'child',
  reference: partReference, query: {kind: 'curve', parameter: originalParameter},
});
cad.validateCadAssemblyInstancePoint(assembly, point);
```

Local rigid rotation is Rz*Ry*Rx around authored XYZ. Matrices are flat
16-number row-major arrays applied to column vectors; translation slots
are3,7,11 and the last row is[0,0,0,1]. World matrix is parentWorld*local,
with no Euler-angle addition or display camera. The instance point contains
`originalLocalPointMM` from the actual existing native query and a derived
`assemblyPointMM`; full root-through-selected lineage includes original
refs and each local/world matrix. Source-frame authority is preserved; no
universal up-axis or numeric rigidity/global accuracy certificate is implied.

Roots have depth1, maximum depth16. Parents may appear later in the authored
array; evaluated instances retain that order. Missing/self/cyclic/over-depth
parents refuse, including deletion of a still-referenced parent. Local
translation components are within±10000mm and rotations within±360 degrees.
Nonzero radians/product underflow, nonfinite arithmetic and unsafe matrix
coefficients refuse. Original pose/source sign bits remain authored state;
generated matrix/point bits carry no global numerical guarantee. Canonical
part angles remain rad; the separate instance rotation unit is explicitly deg.

```js
const next = cad.updateCadAssembly(assembly, {
  expectedRevision: assembly.assembly.revision,
  revision: assembly.assembly.revision + 1,
  instanceEdits: [{instanceId: 'parent', translationMM: [20, 0, 0]}],
});
cad.validateCadAssemblyResult(next);
const restored = cad.parseCadAssembly(cad.serializeCadAssembly(next.assembly));
```

Updates accept1..32 unique existing instance IDs and supported placement or
explicit parent edits. The expected revision must match, and every accepted
edit, including a no-op, advances exactly1. A reparent preserves the local
placement unless explicitly edited. Add/delete/reference/source replacement
is not an implicit patch operation. Whole authored candidates can replace
parts, but every instance must carry fresh exact native revisions; stale
references refuse. A fresh authored snapshot has no hidden source hash or
external revision history; its author must advance native revisions on source
changes. Whole-owned validation checks complete evaluated data. No source is
baked, renamed or silently rebound.

Assembly Save/Open preserves canonical source text, refs, authored order,
hierarchy, placements and raw -0 JSON numbers. Existing strict JSON grammar
is reused with duplicate decoded keys/Unicode/number safeguards; original
canonical decoder/profile limits are unchanged. Files are bounded16MiB.
Whole-owned validation reconstructs the entire graph or instance query before
acceptance; copied CPU data has no renderer resources.

```sh
node examples/cad-nurbs/cad-assembly-demo.mjs --source /tmp/cad-native-assembly
```

The example uses actual canonical Curve/Surface bodies, shared references,
asset-qualified same-ID parts, nested90-degree placement, parent edits and
explicit reparenting, source/assembly/result Save/Open and focused refusal
cases. Local numeric observations do not establish professional accuracy.
Mates/DOF, external part lifecycle, scales, topology/solid assemblies, volume
and mass remain open. Integration and GPU/Loader/Viewer adoption require
separate receipts.

## Revision-checked assembly member transactions

`transactCadAssemblyMembers(previousResult, transaction)` adds and removes
explicit authored assembly instances. It uses the existing assembly evaluator
and qualified part references. The old `updateCadAssembly` remains the
placement/reparent patch API. Embedded part documents, sources and surviving
references/placement bits stay unchanged.

```js
const change = cad.transactCadAssemblyMembers(assembly, {
  expectedRevision: assembly.assembly.revision,
  revision: assembly.assembly.revision + 1,
  addInstances: [{id: 'new_member', parentId: 'parent', reference: partReference,
    placement: {translationMM: [4, 0, 0], rotationDegreesXYZ: [0, 0, 0]}}],
  removeInstanceIds: [],
  reparentInstances: [],
});
cad.validateCadAssemblyMemberTransaction(assembly, change);
const restored = cad.parseCadAssembly(cad.serializeCadAssembly(change.result.assembly));
```

The transaction has exactly these five fields. Each operation array has0..32
entries; at least one explicit operation is required. Expected revision must
match the accepted assembly, and the new revision is exactly previous+1. An
explicit reparent to the existing parent is a supported no-op that advances
revision. An all-empty transaction refuses. Unsigned revision metadata
refuses -0; authored source/pose -0 remains preserved.

Added instances reference already embedded parts and obey the existing
parent/ref/pose bounds. IDs must be new relative to every previous member,
including members removed in the same transaction. ID recycling or replacing
a member by add/remove is unsupported. Added parents may appear later in
the added array. Shared complete native references remain valid; geometry ID
alone never chooses a part.

Remove IDs must name unique existing members. No subtree is removed
implicitly. Removing a parent with any unedited surviving or newly added
child refuses. `reparentInstances` consists of exact `{instanceId,parentId}`
records for unique existing survivors only. This allows parent removal and
explicit child reparenting in one revision. Pose/reference/source changes
are not part of this transaction. Explicitly listing an entire subtree or
every instance is supported; the latter produces a genuine empty graph
while retaining the native part library.

Survivors retain their original order; new instances append in caller order.
All operations are prepared on a copied candidate, then the complete graph
is evaluated once. Final count0..32/depth16, exact qualified revisions,
cycle/self/missing-parent and numeric bounds remain the original assembly
rules. Any failure retains prior graphs, queries and files. Old revision
point tokens refuse; a removed instance cannot be queried at the new revision.
Original-local geometry queries, measurements and exports remain unposed.

The owned member result has `assemblyId`, `previousRevision`, `transaction`,
`result` (the complete evaluated assembly) and `report`. The current-only
report schema is `barocss-cad-assembly-member-transaction`, version0. It
records requested and changed member IDs, survivor/final order, revisions,
counts and explicit no-op status. Whole-owned validation reproduces the
transaction against the supplied previous accepted assembly. Source hashes
or external revision history are not introduced.

```sh
node examples/cad-nurbs/cad-assembly-members-demo.mjs --source /tmp/cad-assembly-members \
  --assembly-file /absolute/path/to/revision0.cad-assembly.json
```

The example consumes the actual #863 saved native assembly, adds shared and
asset-qualified same-ID parts, removes a leaf, explicitly reparents a child
while removing its parent, removes an explicit subtree/all instances and
checks an actual32-to33 refusal. Original sources, raw-0 files, order and
known posed points are preserved through Save/Open. Native capacity does not
promise renderer capacity. Mates, external-reference lifecycle, solid/BRep,
professional accuracy and display editing remain separate work.

## Native coplanar linear-face Boolean regions

`booleanCoplanarFaces(faceA, faceB, options)` builds union, intersection or
A-minus-B regions from two actual validated ConvexPlanarFaceResult inputs.
The new output can contain nonconvex boundaries, disconnected components
and holes. It uses a dedicated `barocss-native-coplanar-face-boolean`,
version0, format; it is not mislabelled as a convex face or solid.

```js
const region = cad.booleanCoplanarFaces(faceA, faceB, {
  operation: 'difference', evaluationId: 'planar_difference',
  resultIdPrefix: 'bool_demo', maximumPairTests: 64, maximumFragments: 64,
});
cad.validateCoplanarFaceBoolean(region);
```

Both operands must use identical actual four-pole equal-weight degree1x1
affine Surface coefficients, weights, knots and domains. Support IDs may
differ. Each original outer loop has3..8 actual equal-weight two-pole Line
edges, with no input holes or curved boundaries. Authored world coordinates
are within±10000mm; native UV coordinates are dimensionless and within
±10000. Plane and Line parameter spans must be finite and represented.
Support may be tilted or sheared with nonunit native U/V domains. Equal
geometry/face IDs in separate operands remain qualified a/b identities.

The native UV segment arrangement uses the existing determinant uncertainty
policy. Proper intersections require safely represented strict interior
parameters on both original Lines. Exact parallel separated spans are
supported. Point/vertex touching, partial overlapping/collinear boundaries,
near-parallel cancellation, near-root ordering or collapsed intervals refuse.
There is no coordinate rounding, snapping, tolerance merge or contact healing.
Exact complete cyclic/reversed polygon coincidence has an explicit branch:
union/intersection use the A boundary, difference is empty, and both original
contexts remain recorded. Different support parameterizations refuse.

Original edges split at identified proper crossing events. Strict midpoint
classification selects outside fragments for union, inside fragments for
intersection, and A-outside plus reversed B-inside for difference. Each
selected vertex must have exactly one incoming/outgoing directed fragment.
All cycles are retained; outer loops use native UV CCW and holes CW with
explicit component nesting. Nonmanifold or uncertain incidence refuses.
Original face/use orientations remain contributor data.

Every selected world fragment comes from the actual native
`extractCurveInterval` operation with its original Line parameters. The full
extraction and qualified face/loop/use/edge/curve/pcurve lineage are retained.
Derived UV pcurves evaluate the original pcurve at those native parameters;
they remain dimensionless metadata. Generated geometry is never snapped to
topological vertex coordinates. Endpoint and Curve-versus-Surface UV point
and D1 residuals are recorded with local1e-7mm/relative1e-7 comparisons.
This is a binding observation, not a sewing or global topology certificate.

`support`, selected `vertices`, `events`, `fragments`, `loops`, `components`,
`sources` and `report` accompany unchanged `faceA`, `faceB` and `options`.
Derived IDs are distinct from all original IDs. Source0 compilation uses
WORLD geometry only: copied derived support plus at most15 world Curves per
source asset. The original16-object Model limit is unchanged; larger outputs
use deterministic chunks and explicit fragment-to-asset/object mappings.
UV pcurves are never placed in a millimetre source. Empty results retain one
support-only source, with no ghost region edges or components.

Options admit pair work1..64, fragments1..64, evaluation ID1..48 and prefix
1..12. Output is bounded by64 events/fragments,16 loops,8 components/holes
and5 source assets. Own data has finite descriptor/cycle/array/field/string
budgets. Any contact, uncertainty, budget, unsafe arithmetic, getter or
tampering failure refuses atomically and preserves prior originals/results.
Whole-owned validation reconstructs the complete original inputs, arrangement,
selection, native extraction, incidence, provenance, models and observations.

```sh
node examples/cad-nurbs/coplanar-face-boolean-demo.mjs --source /tmp/cad-planar-boolean
```

The example uses crossing operations on a tilted/sheared native support,
strict containment with a hole, empty/coincident cases, a disconnected
difference and a sixteen-edge disjoint union requiring actual source chunks.
It compares local UV region masks/area and actual native point/D1/source
lineage, with raw-0 file reopening and separate manifest JS/types imports.
UV area is dimensionless metadata; it is not manufacturing world area.
Solid Boolean, shell sewing, curved trim/general supports, persistent BRep
naming, global numerical quality and display/solid consumers remain separate.


## Filled coplanar Boolean region preview

`tessellateCoplanarFaceBoolean(region, options)` accepts the complete native
Boolean result described above. It validates that result before building a
filled mesh for its selected material. Nonconvex outlines, holes, disconnected
components and the true empty result use the same API.

```ts
const preview = cad.tessellateCoplanarFaceBoolean(region, {
  meshId: 'boolean_preview',
  maximumVertices: 64,
  maximumTriangles: 80,
  maximumCandidatePairs: 2016,
  maximumPredicateTests: 2000000,
  maximumTriangleTests: 50000,
});
cad.validateCoplanarFaceBooleanMesh(preview);
```

The result owns `{region, options, mesh, boundaryPaths, triangulation, report}`.
Mesh positions use the original support's native D1 evaluations at the selected
native vertices. Units are mm in the authored XYZ frame. UV coordinates are
dimensionless. No axis conversion occurs. This is the dedicated
`barocss-native-coplanar-face-boolean-mesh` version 0 DTO. A consumer must adapt
it explicitly to its renderer contract. It is not PreviewPacket0 or a new
native Surface. True empty material has empty arrays, null bounds and no D1 calls.

A visible planar graph joins only native vertices within each component.
The mesh has no Steiner vertices, duplicate bridge vertices or snapped native
geometry. Boundary paths retain the original fragment, loop, edge, use,
source asset and Curve/pcurve provenance. Mesh bridges and diagonals are display
edges. They are never CAD boundaries. Each native boundary has one directed
triangle use. Each internal edge has two opposite triangle uses.

The producer checks triangle counts, material winding, hole exclusion,
nonoverlap, incidence and UV area for each component. Native affine Jacobians
and actual 3D triangles provide derived world-area diagnostics. These diagnostics
are separate from the native Surface area query and its error estimator.
Unsafe numeric predicates and exhausted caller budgets refuse the entire result.
The owned validator rebuilds the native region, mesh and all provenance.
The original region and its source files remain unchanged.

Run the actual saved-region consumer flow after the affected library build:

```sh
node examples/cad-nurbs/coplanar-face-boolean-mesh-demo.mjs --source /tmp/cad-boolean-mesh --boolean-directory /path/to/cad-planar-boolean
```

The flow reads saved native Boolean results and their original sources, covers
nonconvex material, a hole, two components and empty material, then rebuilds one
actual authored corner edit. It also checks one existing convex-hole mesh
consumer after the shared UV predicate extraction. GPU rendering, solid Boolean,
sewing, global triangulation and manufacturing certification remain separate work.


## Native capped extrusion from coplanar Boolean regions

`extrudeCoplanarFaceBoolean(region, options)` constructs native geometry from a
complete validated Boolean region. It preserves nonconvex outlines, holes and
all components. The extrusion follows the actual support normal in authored
XYZ coordinates. Each component has its own closed incidence Shell. It contains
two trimmed cap faces and one ruled wall per selected boundary fragment.

```ts
const part = cad.extrudeCoplanarFaceBoolean(region, {
  evaluationId: 'extrusion_eval',
  resultIdPrefix: 'extrusion',
  distanceMM: 2,
  maximumVertices: 128,
  maximumFaces: 80,
  maximumSourceChunks: 17,
  maximumBindingSamples: 1152,
});
cad.validateCoplanarFaceBooleanExtrusion(part);
```

The dedicated `barocss-native-coplanar-face-boolean-extrusion` version 0 owns
`{region, options, normal, translationMM, vertices, edges, faces, shells,
sources, report}`. Distance is finite 0.0001 through 10000 mm. Derived poles and
vertices must remain within ±10000 mm. Caller capacities can be lower than the
fixed profile; exceeding one refuses the whole result. Empty material has no
new geometry, Shells, sources or binding observations, and has null normal,
translation and bounds.

The two native cap support Surfaces preserve the original basis and domains.
Component-owned outer/hole loops trim them. Top poles translate once by
`normal * distanceMM`. Each original fragment supplies a bottom Curve, a top
Curve and an actual compatible ruled Surface. Wall U keeps the original Curve
parameter. Wall V spans 0 through 1 and means extrusion interpolation. Vertical
Curves connect canonical bottom/top vertices. The original Boolean region and
its unsnapped fragment coefficients remain unchanged.

Per-face sidecar pcurves bind actual native edges to cap and wall UV charts.
They are dimensionless and do not enter world Source0 models. World geometry
compiles in chunks of at most 16 objects, with explicit source pointers. Each
global edge has two opposite effective face uses. Cap and wall orientations
produce outward normals, including the inner-hole walls. Native point/D1
observations check pcurve chains and record endpoint residuals. Shared logical
vertices do not imply exact welding of original fragment endpoints.

Run the actual saved-region construction flow after the affected library build:

```sh
node examples/cad-nurbs/coplanar-face-boolean-extrusion-demo.mjs --source /tmp/cad-boolean-extrusion --boolean-directory /path/to/cad-planar-boolean
```

The flow consumes five saved Boolean regions on a tilted, sheared support and
rebuilds one actual distance edit. It checks native geometry, parameters,
orientations, holes, components, source chunks and cold-owned reconstruction.
The filled preview is separate from native construction. Paired incidence and
local residual checks do not certify a Solid, exact sewing, global manifold
quality, volume or manufacturing tolerance. Rendering and general curved,
draft, sweep or arbitrary-vector extrusion remain separate work.


## Filled native Boolean extrusion Shell mesh

`tessellateCoplanarFaceBooleanExtrusion(extrusion, options)` accepts the complete
owned native extrusion above. It validates that native result, then builds a
filled preview for every cap and wall in every component.

```ts
const preview = cad.tessellateCoplanarFaceBooleanExtrusion(part, {
  meshId: 'part_mesh',
  maximumVertices: 384,
  maximumTriangles: 288,
  maximumEdgePaths: 192,
  maximumNativeSamples: 1024,
});
cad.validateCoplanarFaceBooleanExtrusionMesh(preview);
```

The result owns `{extrusion, options, regionMesh, mesh, faceRanges, edgePaths,
shellRanges, report}`. Its dedicated schema is
`barocss-native-coplanar-face-boolean-extrusion-mesh` version 0. Positions use
mm in authored XYZ. Face UV values remain dimensionless native parameters.
This multi-face Shell mesh has an explicit extrusion/source binding. It is not
a single native Surface or PreviewPacket0. A renderer must adapt the DTO and
frame explicitly.

The existing Boolean-region mesh supplies material cap connectivity. Each cap
samples its actual derived bottom or top Surface D1 at original native UV.
Bottom triangles reverse winding; top triangles retain it. Each ruled wall
samples its actual four native parameter corners and outward normals. Adjacent
faces have separate vertices for hard normals. Native geometry stays unsnapped.
Empty material has empty arrays/ranges/paths, null bounds and no new D1 calls.

Face ranges keep native face, component, Shell, Surface and source pointers.
Every true face boundary has one triangle use in the effective loop direction.
Display bridges and diagonals have two opposite triangle uses. True global edge
paths retain original Curve domains, paired face/use/pcurve identities and
actual Curve D1 samples. Both adjacent faces retain their own mesh endpoint
indices and explicit native binding residuals. Mesh diagonals are display data.
They are never added to native CAD edge paths.

Fixed limits are 384 face vertices, 288 triangles, 192 true edge paths and 1024
new wrapper native samples. Mesh IDs have 1 through 12 ASCII characters. Lower
caller budgets refuse the whole result. The report separates wrapper D1 work,
reused cap-mesh work and native parent reconstruction. The owned validator
rebuilds all original data, ranges, observations and provenance.

Run the actual saved-native-result consumer after the affected library build:

```sh
node examples/cad-nurbs/coplanar-face-boolean-extrusion-mesh-demo.mjs --source /tmp/cad-shell-mesh --extrusion-directory /path/to/cad-boolean-extrusion
```

The flow consumes six native files, covering a nonconvex union, a hole, two
strip components, two octagon components, empty material and a real distance
edit from 2 to 3 mm. It checks native D1 bindings, cap material coverage, outward
winding, true edge paths, source files and cold-owned reconstruction.
Triangle UV interpolation is display data, not an exact native inverse or
picking reference. Local samples do not certify a global Surface error bound,
Solid, sewing, manifold, volume or manufacturing quality. Actual renderer
consumption remains separate.


## Editable native Boolean and extrusion intent

`evaluateBooleanExtrusionFeatureGraph(document, options)` evaluates an authored
native construction graph. Two Face input nodes feed one coplanar Boolean node,
which feeds one through four independent normal-extrusion nodes. It calls the actual native Face, Boolean
and extrusion builders. Display meshes do not supply editing authority.

The current authored format is `barocss-native-boolean-extrusion-feature-graph`,
version 0. Its eight fields are `{format, version, id, revision, lengthUnit,
sourceFrame, parameters, features}`. Units are mm in authored XYZ. Revision is
an integer from 0 through 1000000000. IDs have 1 through 48 ASCII characters.
The ordered parameter table has at most eight typed length definitions. A
literal supplies `valueMM`; an offset references `parameterId` plus `offsetMM`.
All definitions, including unused ones, resolve within ±10000 mm. The extrusion
distance uses the same definition syntax and must resolve to 0.0001–10000 mm.
The original parameter resolver retains its first-authored-ready ordering.

```ts
const options = {maximumParameterResolutions: 8, maximumFeatureEvaluations: 4};
const result = cad.evaluateBooleanExtrusionFeatureGraph(document, options);
cad.validateBooleanExtrusionFeatureGraph(result);
const text = cad.serializeBooleanExtrusionFeatureGraph(result.document, options);
const reopened = cad.parseBooleanExtrusionFeatureGraph(text, options);
```

The four through seven feature nodes can appear in any authored order. Dependency
evaluation produces the two real Faces and shared Boolean once in the graph loop,
then each real extrusion with its own resolved distance. Face
inputs own only their original Plane, native Line loop and construction options.
Boolean and extrusion nodes hold explicit feature references and native options.
The result owns `{document, options, parameters, features, report}`. Evaluated
feature rows retain their full actual native result and output-slot identity.
Nonconvex material, holes, disconnected components and empty output retain the
native construction behavior.

`updateBooleanExtrusionFeatureGraph(previousResult, edits)` validates the previous
owned result and rebuilds a copied candidate. Edits have exact fields
`{expectedRevision, revision, parameterEdits, faceEdits, booleanEdits, distanceEdits}`.
The new revision must equal the previous revision plus one. Parameter definitions,
original Face coefficients, the Boolean operation and the distance definition
can change together. IDs, original ordered Curve identities, native options,
feature kinds, dependency references and output slots remain stable. An empty
edit refuses. A nonempty same-value edit can advance revision. Any failed edit
returns no replacement result and leaves earlier data intact.

Original native IDs can repeat across the two operand contexts. Native references
therefore include graph, revision, feature and output-slot context. Each binding
lists entities defined by its owning feature. Original operand references stay
in the complete native evaluations and resolve through input dependencies. Generated
ordinal names are current native roles, not persistent topology names. Earlier
revision-qualified references become stale when the caller advances revision.
A fresh authored file is a declared snapshot; it does not prove external history.

Serialization saves authored intent only, with signed-zero preservation and a
1 MiB UTF8 limit. Parsing reuses the existing strict JSON grammar, then rebuilds
the actual native chain. This format does not widen the canonical geometry
Document or migrate another graph. Public errors retain bounded paths, failing
feature/parameter context and native causes. Caller limits bound parameter
resolutions and the three upstream plus one through four direct extrusion evaluations. Native internal
work and prior-result validation are separate. No selective rebuild is claimed.

Run the actual authored/native/source-file flow after the affected library build:

```sh
node examples/cad-nurbs/boolean-extrusion-feature-graph-demo.mjs --source /tmp/cad-boolean-intent --boolean-directory /path/to/cad-planar-boolean
```

The flow reconstructs authentic original operands on a tilted/sheared support,
then edits referenced distance, Boolean operation and one original corner. It
checks native geometry/provenance, holes/components/empty, authored and owned
save/rebuild, atomic refusals and compiled public names. General feature mixing,
suppression, lifecycle changes, persistent topology, renderer editor adoption,
Solid/sewing and manufacturing certification remain separate work.


## Native intent parameter creation and removal

`transactBooleanExtrusionFeatureGraphParameters(previousResult, transaction)`
creates, updates or removes typed length parameters in the native intent graph.
It can repair dependent offset definitions and the extrusion distance reference
in the same candidate. It returns the existing graph result format.

```ts
const next = cad.transactBooleanExtrusionFeatureGraphParameters(result, {
  expectedRevision: result.document.revision,
  revision: result.document.revision + 1,
  parameterOperations: [
    {kind: 'upsert', parameter: {
      id: 'design_height', type: 'length',
      definition: {kind: 'literal', valueMM: 3},
    }},
    {kind: 'remove', parameterId: 'height'},
    {kind: 'remove', parameterId: 'base_height'},
  ],
  distanceEdits: [{
    featureId: 'extrusion_feature',
    definition: {kind: 'offset', parameterId: 'design_height', offsetMM: 0},
  }],
});
```

The exact transaction fields are `{expectedRevision, revision,
parameterOperations, distanceEdits}`. Operations contain 1 through 16 explicit
upsert/remove entries. Each target can appear once. An existing upsert keeps its
ID, type and authored slot. A new parameter appends in operation order. A remove
must name a starting parameter. A transaction cannot remove and recreate one
ID, silently cascade a deletion or insert a replacement value.

The final table has 0 through 8 parameters. A working table can have up to 16
entries while the transaction applies; this permits an explicit replacement
that briefly has nine entries. The unchanged caller graph budgets constrain the
final table. All final definitions, including unused ones, resolve with the
original length resolver. A referenced parameter can be removed only when all
remaining dependent offsets and the distance reference are explicitly repaired.

The API copies and validates the complete prior owned result, then evaluates
one copied final authored candidate with the actual native graph evaluator.
Revision must advance by one. Original Face inputs, feature dependencies,
options, output slots and graph format 0 stay unchanged. Any failed candidate
returns no replacement result and leaves prior input, native output and files
intact. New identities reserve every starting logical/native/source identity,
including removed slots. There is no hidden history or cross-transaction
identity tombstone registry.

Existing authored serialization and whole-owned validation handle the new
result. The API adds no graph schema, parser, resolver or renderer resource.
Run the actual saved-graph flow after the affected library build:

```sh
node examples/cad-nurbs/boolean-extrusion-parameter-lifecycle-demo.mjs --source /tmp/cad-parameter-lifecycle --graph-directory /path/to/cad-boolean-intent
```

The flow creates a referenced height, removes old parameters with repairs,
changes native height through a dependency, admits a literal distance with no
parameters, and checks final eight versus temporary nine entries. It checks
actual native geometry/source ownership, authored and owned cold rebuilds,
atomic refusals and public declarations. Feature lifecycle, suppression,
selective recomputation, persistent topology/history, editor adoption and
Solid/manufacturing certification remain separate work.


## Native feature replacement and dependency repair

`transactBooleanExtrusionFeatureGraphFeatures(previousResult, transaction)`
creates, updates or removes authored feature nodes with explicit dependency
repairs in the same candidate. It returns the existing native graph result.
The current graph requires two Face inputs, one Boolean and one through four extrusions.

The exact transaction is `{expectedRevision, revision, featureOperations}`.
Operations contain 1 through 8 `{kind:'upsert', feature}` or
`{kind:'remove', featureId}` entries. Each feature target appears once. A new
feature appends in operation order. Its feature ID and output slot must be fresh
against all starting logical/native/source identities and earlier new nodes.
A remove must name a starting feature. Removed identities remain reserved for
the transaction. There is no hidden cross-transaction tombstone registry.

An existing upsert preserves ID, kind, output slot and authored position. Its
native options stay unchanged except an admitted Boolean operation. Original
Face Plane/loop/ordered Curve IDs and count remain stable. Authored coefficients,
dependency references and distance definitions can be repaired explicitly.
A new input node can retain original native names under its qualified context.
The API does not rewrite source geometry IDs.

A copied working table can contain up to eight nodes. Final admission requires
two Face inputs, one Boolean and one through four extrusions. Adding a replacement before deleting its
old node is allowed. Missing or cyclic references, invalid native inputs, stale
revisions, ID collisions and failed native evaluation return no replacement
result. No deletion cascade or automatic reference substitution occurs.

The API separately snapshots both inputs, validates the full previous owned
graph once, then evaluates the copied final authored candidate once. Parameters,
graph header, options and format 0 stay unchanged. Actual native builders,
parameter resolution, authored serde and revision-qualified feature ownership
remain the existing graph authority.

```ts
const next = cad.transactBooleanExtrusionFeatureGraphFeatures(result, {
  expectedRevision: result.document.revision,
  revision: result.document.revision + 1,
  featureOperations: [
    {kind: 'upsert', feature: replacementFace},
    {kind: 'upsert', feature: booleanWithRepairedOperand},
    {kind: 'remove', featureId: oldFaceId},
  ],
});
```

Run the saved-native-graph flow after the affected library build:

```sh
node examples/cad-nurbs/boolean-extrusion-feature-lifecycle-demo.mjs --source /tmp/cad-feature-lifecycle --parameter-directory /path/to/cad-parameter-lifecycle
```

The flow replaces input, Boolean and extrusion nodes, repairs their references,
changes a real native corner and distance, and replaces a four-node
chain through a temporary eight-node table. The transaction cap stays eight
operations; full replacement of a seven-node graph needs separate admitted steps. It checks source/native geometry,
current authored and owned cold rebuilds, qualified ownership, atomic refusals
and public declarations. General operation mixing, suppression, reorder,
selective rebuild, history/persistent topology, editor adoption and
Solid/manufacturing certification remain separate work.


## Shared native Boolean region and independent extrusion outputs

The current graph0 and existing public APIs support one through four extrusion
leaves sharing the same actual Boolean region. Each leaf owns its distance,
output slot, native options, source geometry and Shell set. Outputs can overlap
in world space. They are separately qualified native parts; no union or assembly
is inferred.

The authored document still has eight fields and the same node kinds. Caller
`maximumFeatureEvaluations` now ranges from 0 through 7 and must cover all
`3 + extrusionCount` nodes. Every leaf distance resolves before construction.
A shared parameter edit rebuilds every dependent leaf with its own offset.
Parameter lifecycle transactions can repair up to four distinct distance targets
while removing a shared parameter. Native sibling identity pools must be disjoint,
including unused derived roles, before geometry staging.

The current derived report uses `distances[]` and `summary.extrusions[]` in actual
evaluation order. Each output summary has feature/slot IDs, distance, empty state
and Shell IDs. Shared Boolean area/components/holes remain in the common summary.
The singular first-output report fields are removed. Previous authored single-leaf
files remain valid; current parsing rebuilds their native results. Previous
owned cache reports must be rebuilt from authored intent. No new format,
legacy report alias or cache migration is added.

```ts
const result = cad.parseBooleanExtrusionFeatureGraph(authoredText, {
  maximumParameterResolutions: 8,
  maximumFeatureEvaluations: 7,
});
for (const output of result.report.summary.extrusions) {
  console.log(output.featureId, output.distanceMM, output.shellIds);
}
```

Run one current fan-out source/file flow after the affected library build:

```sh
node examples/cad-nurbs/boolean-extrusion-fanout-demo.mjs --source /tmp/cad-fanout --graph-directory /path/to/cad-boolean-intent
```

The flow rebuilds a genuine single-leaf file, creates three independent leaves,
edits their shared height, repairs all distance references in one parameter
transaction, adds a fourth leaf and checks three genuine empty outputs. It
checks actual native geometry, source IDs, qualified ownership, current authored
and owned cold rebuilds, atomic failures and existing public declarations.
The feature lifecycle working/operation limit remains eight. General mixed
operations, selective rebuild, suppression/reorder/history, persistent topology,
Solid/assembly/manufacturing certification and actual target rendering remain
separate work.

## Fixed-orientation Curve path sweep

`buildTranslationalSweepSurface` moves a native profile Curve along a native
rail Curve while keeping the profile orientation fixed. The Surface uses the
original profile parameter as U and the original rail parameter as V. Its point
relation is `S(u,v) = P(u) + R(v) - R(vMin)`. The anchor comes from the actual
native rail evaluator at the original domain minimum.

The profile and rail can have different degrees, knots, domains, pole counts
and rational weights. Each supports degree 1 through 3 and 2 through 16 poles.
The tensor grid can contain up to 256 poles. Generated weights are products of
the original weights and must stay within the existing native weight bounds.
Generated coordinates must remain within the native world-coordinate bounds.

```ts
const sweep = cad.buildTranslationalSweepSurface(profile, rail, {
  surfaceId: 'path_sweep',
  maximumObservations: 961,
});
cad.validateTranslationalSweepSurface(sweep);
```

The result keeps both original Curves, the generated Surface, their three-object
Source0 Model and tensor coefficient provenance. Native point and derivative
observations use original knot boundaries and represented interval midpoints.
A C0 knot retains actual derivative refusal states. Finite local observations
do not certify the whole Surface. The caller observation budget must cover the
complete sample grid before construction.

The operation builds a Surface. Moving frames, profile rotation or twist, end
caps, trimmed Shells, Solids and self-intersection validation need separate
contracts. A collapsed rail or folded Surface does not become a certified part.
Source and owned result files can be saved and reconstructed with the current
native compiler and validator.

Run the current native sweep flow after the library build:

```sh
node examples/cad-nurbs/translational-sweep-demo.mjs --source /tmp/cad-sweep
```

## Curve interpolation through supplied points

`buildInterpolatingCurve` creates a native polynomial B-spline Curve through
2 through 16 supplied points. Each point has an explicit original parameter
and XYZ coordinates in mm. Parameters must be strictly increasing. Degree 1
through 3 is supported, with at least `degree + 1` points.

```ts
const interpolation = cad.buildInterpolatingCurve([
  {parameter: -2, pointMM: [0, 0, 0]},
  {parameter: 1, pointMM: [2, 3, 1]},
  {parameter: 5, pointMM: [5, 1, 2]},
], {
  curveId: 'through_points',
  degree: 2,
  maximumBasisEvaluations: 256,
  maximumEliminationSteps: 120,
});
cad.validateInterpolatingCurve(interpolation);
```

The native evaluator supplies the interpolation basis. Averaged clamped knots
stay in the original parameter units. A guarded linear solve determines the
control points, and actual native point evaluations check the interpolation.
The resulting weights are one. The result retains the supplied points,
parameters, native Curve, Source0 Model and solver evidence.

Caller budgets must cover the complete basis matrix and row elimination before
work starts. Uncertain pivots, nonfinite arithmetic, out-of-bounds generated
poles and failed point comparisons refuse the candidate. Earlier inputs,
geometry and files remain owned by the caller.

Changing a supplied point rebuilds the global interpolating Curve. The point
parameters affect its shape. Automatic parameter selection, least-squares
fitting, rational weight solving, tangent constraints, periodic interpolation
and whole-curve accuracy certification need separate contracts.

```sh
node examples/cad-nurbs/curve-interpolation-demo.mjs --source /tmp/cad-interpolation
```

## Surface interpolation through a point grid

`buildInterpolatingSurface` creates a native polynomial B-spline Surface
through a rectangular XYZ point grid. `points[i][j]` corresponds to the
supplied `parametersU[i]` and `parametersV[j]`. Each axis supports 2 through
16 points and degree 1 through 3. Parameters remain in their original units.

```ts
const interpolation = cad.buildInterpolatingSurface(
  [-2, 1, 5],
  [3, 6],
  [
    [[0, 0, 0], [0, 4, 1]],
    [[2, 0, 3], [2, 4, 4]],
    [[5, 0, 0], [5, 4, 1]],
  ],
  {
    surfaceId: 'through_grid', degreeU: 2, degreeV: 1,
    maximumBasisEvaluations: 8192,
    maximumEliminationSteps: 3840,
    maximumSurfaceEvaluations: 256,
  },
);
cad.validateInterpolatingSurface(interpolation);
```

The builder reuses native Curve interpolation across each U column, then
across each V row of the resulting control data. It preserves both phase
results and their solver evidence. The final Surface uses the generated
control grid, original averaged knot bases and weights of one. Its Source0
Model contains the final Surface. Intermediate Curves are construction
evidence and do not become CAD edges or trim boundaries.

Caller budgets cover the complete construction before work starts. For an
`N` by `M` grid, basis work is `N*M*(N+M)`, row elimination work is
`N*M*(N+M-2)/2`, and direct Surface point checks are `N*M`. Actual child
counts and native grid-point residuals remain in the report. Failed child
construction retains its cause and phase index and returns no partial Surface.

The result keeps original points and parameters, native geometry, sources and
owned reconstruction data. A point edit rebuilds the global Surface. Rational
weight fitting, automatic parameter selection, smoothing, tangent constraints,
trims, periodic interpolation and whole-Surface validity need separate contracts.

```sh
node examples/cad-nurbs/surface-interpolation-demo.mjs --source /tmp/cad-surface-interpolation
```

## Point-based Curve parameter selection

`buildParameterizedInterpolatingCurve` selects parameters for supplied XYZ
points, then calls the native through-point Curve builder. The caller chooses
`uniform`, `chord-length` or `centripetal` and supplies the requested domain.
These choices can produce different interpolating Curves from the same points.

```ts
const interpolation = cad.buildParameterizedInterpolatingCurve([
  [0, 0, 0], [1, 2, 0], [3, 2, 1], [9, 0, 2], [10, 4, 1],
], {
  curveId: 'point_curve', degree: 3,
  method: 'centripetal', domain: [-3, 7],
  maximumMetricEvaluations: 15,
  maximumBasisEvaluations: 256,
  maximumEliminationSteps: 120,
});
cad.validateParameterizedInterpolatingCurve(interpolation);
```

Uniform selection uses equal increments. Chord-length selection uses the
distance between consecutive authored points. Centripetal selection uses the
square root of that distance. The increments determine interior fractions,
which map to the explicit requested domain. Endpoint parameter bits remain
exact copies of the supplied domain. The report retains distances, units,
increments, fractions and actual native interpolation data.

The measured chords belong to the authored point sequence. They are not the
generated Curve's arc length. No method guarantees the best shape, regularity
or absence of loops. Repeated adjacent points refuse distance-based methods;
uniform selection can retain them. Lost cumulative contributions, collapsed
mapped parameters, uncertain native pivots and insufficient budgets return
no replacement result.

```sh
node examples/cad-nurbs/curve-parameterization-demo.mjs --source /tmp/cad-parameters
```

## Interpolation with fixed positive rational weights

`buildWeightedInterpolatingCurve` creates a native rational Curve through
supplied points and parameters. The caller supplies one positive weight per
point/control index. The weights remain fixed during the solve and are copied
to the resulting native Curve without normalization.

```ts
const interpolation = cad.buildWeightedInterpolatingCurve([
  {parameter: -2, pointMM: [2, -0, 0]},
  {parameter: 2, pointMM: [Math.SQRT2, Math.SQRT2, 0]},
  {parameter: 6, pointMM: [0, 2, 0]},
], [1, Math.SQRT1_2, 1], {
  curveId: 'weighted_quarter', degree: 2,
  maximumBasisEvaluations: 256,
  maximumEliminationSteps: 120,
});
cad.validateWeightedInterpolatingCurve(interpolation);
```

The weighted and polynomial constructors share the native basis and guarded
linear solve. Native unit-coordinate Curves with the supplied weights provide
the rational basis matrix. The solve determines control points and checks
actual native through-point residuals. Degree 1 through 3, 2 through 16 points,
and weights from `1e-6` through `1e6` are supported.

The result retains supplied points and weight bits, native geometry, Source0
Model, matrix/pivot evidence and owned reconstruction data. Changing fixed
weights can change the Curve between the same supplied points. This operation
does not optimize weights, fit arbitrary rational data or certify whole-curve
accuracy, regularity or manufacturing tolerance. Existing polynomial Curve,
Surface-grid and point-parameterization APIs keep their current contracts.

```sh
node examples/cad-nurbs/weighted-curve-interpolation-demo.mjs --source /tmp/cad-weighted-interpolation --polynomial-directory /path/to/cad-curve-interpolation
```

## Compatible multi-section loft

`buildMultiSectionLoftSurface` creates a native Surface through 2 through 15
section Curves at explicit V parameters. Sections must share the same U degree,
pole count, knot bits and weight bits. Their coordinates and IDs can differ.
No automatic compatibility repair or section reversal occurs.

```ts
const loft = cad.buildMultiSectionLoftSurface(sectionCurves, sectionParameters, {
  surfaceId: 'multi_loft', degreeV: 3,
  maximumBasisEvaluations: 3600,
  maximumEliminationSteps: 1680,
  maximumObservations: 465,
});
cad.validateMultiSectionLoftSurface(loft);
```

The builder interpolates each original U control-point row in V through the
existing native Curve kernel. The Surface preserves the original rational
U basis and repeats its weights along V. V uses the supplied section parameters
and requested degree. The first and last section coefficient bits remain
unchanged. Intermediate sections are checked against actual native Curve and
Surface evaluations.

Original Curves and the generated Surface share one Source0 Model with at most
16 objects. Temporary V interpolation Curves remain construction evidence.
Actual U and V derivative refusal states are retained at C0 guards; derivatives
are compared only where the native evaluators provide them.

The result preserves original sections, parameters, native source and control
mapping evidence. Arbitrary unmatched bases, independent section weights,
guide Curves, transported frames, caps, trimmed Shells, Solids and whole-Surface
validity require separate contracts.

```sh
node examples/cad-nurbs/multi-section-loft-demo.mjs --source /tmp/cad-multi-loft
```

## Affine Curve and Surface copies

`transformNativeGeometryAffine` creates new native geometry by transforming
the original control points. It preserves degree, knot order, parameter domains
and weight bits. The target uses an explicit new geometry ID. The input remains
unchanged.

```ts
const copy = cad.transformNativeGeometryAffine(originalCurve, [
  -1, 0, 0, 4,
   0, 1, 0, 0,
   0, 0, 1, 0,
], {
  geometryId: 'mirrored_curve',
  maximumObservations: 961,
});
cad.validateAffineGeometryTransform(copy);
```

The matrix contains three rows of four values. Each row has three dimensionless
linear coefficients and one translation in mm. The example reflects X about
the plane X = 2 mm. Translation, rotation, nonuniform scale, shear and reflection
can be expressed explicitly. Singular or cancellation-uncertain matrices refuse.

The result stores original and target geometry in a two-object Source0 Model.
Actual native point and derivative observations compare the generated geometry
with the declared affine relation. Identity axes preserve original signed-zero
control bits. Curve support reaches 64 poles and Surface support reaches
16 by 16 poles under the existing native degree and weight bounds.

Reflection parity is reported. Surface U/V order remains unchanged, and its
native oriented cross product follows the transformed derivatives. This operation
does not repair Shell face orientation or transform B-Rep topology. Assembly
placement, feature patterns, persistent naming and whole-shape validity remain
separate contracts.

```sh
node examples/cad-nurbs/affine-geometry-transform-demo.mjs --source /tmp/cad-affine-copy
```

## Linear native geometry patterns

`buildLinearGeometryPattern` retains an original Curve or Surface and creates
up to four translated native copies. `count` includes the original at index 0.
Each copy is derived directly from the original, with translation equal to
its index times `spacingMM`.

```ts
const pattern = cad.buildLinearGeometryPattern(originalCurve, {
  patternId: 'linear_parts', idPrefix: 'part_copy', count: 5,
  spacingMM: [3, 0, 0], maximumCopyObservations: 3844,
});
cad.validateLinearGeometryPattern(pattern);
```

The builder reserves all active IDs and checks translation and observation
budgets before creating copies. Each copy uses the actual native affine
transform constructor and retains its complete geometry/source/point/D1 proof.
The source Model contains the original followed by all copies in index order.
All degree, knot, weight and parameter bits remain unchanged.

A count of one creates a genuine seed-only pattern with zero copy work.
Multiple instances require nonzero spacing. If any copy fails, the builder
returns no partial pattern and reports the failing instance and native cause.
Previous caller inputs, accepted results and files remain unchanged.

These are separate baked native geometries. The operation does not union
overlapping shapes, create assembly placements or add a generic feature-tree
pattern, circular pattern, topology naming or Solid validity certificate.

```sh
node examples/cad-nurbs/linear-geometry-pattern-demo.mjs --source /tmp/cad-linear-pattern
```

## Circular native geometry patterns

`buildCircularGeometryPattern` creates native Curve or Surface copies about an
explicit axis. The original stays at index 0. Each subsequent copy rotates the
original by its index times `angleStepDegrees`. Positive angles follow the
right-hand rule along `axisDirection`.

```ts
const pattern = cad.buildCircularGeometryPattern(originalCurve, {
  patternId: 'circular_parts', idPrefix: 'rotated_part', count: 4,
  axisOriginMM: [2, 1, 0], axisDirection: [0, 0, 4],
  angleStepDegrees: 90, maximumCopyObservations: 3844,
});
cad.validateCircularGeometryPattern(pattern);
```

The direction is normalized once. The builder checks all member IDs, angles,
rotation matrices, translations and the complete observation budget before
creating a copy. Each copy retains its actual affine geometry, native point and
D1 observations, and source proof. One Source0 Model stores all members in order.
An owned result is checked by reconstructing the whole recipe.

Count is 1 through 5, including the seed. A multi-member pattern requires an
angle step of at least 0.000001 degrees in magnitude. The last member angle
must be less than 360 degrees in magnitude. The builder does not add a duplicate
closing member or infer full-circle spacing. Axis coordinates and generated
translations stay within 10000 mm. Direction components stay within 1000;
the direction norm must be at least 0.000001, and each nonzero normalized
component must be at least 0.000000000001 in magnitude.

Exact quarter-turn sine and cosine values use an explicit table. Other angles
use binary64 trigonometry. Local rotation and actual geometry checks do not
certify global shape accuracy or manufacturing tolerance. If a member fails,
no partial pattern is returned. These are baked geometries; assembly placements,
feature dependencies, Boolean union, Shell orientation and Solid validity
remain separate operations.

```sh
node examples/cad-nurbs/circular-geometry-pattern-demo.mjs --source /tmp/cad-circular-pattern
```

## Analytic native second derivatives

`evaluateCurveD2` returns `point`, `derivative` and `secondDerivative`.
`evaluateSurfaceD2` returns `point`, `du`, `dv`, `duu`, `duv` and `dvv`.
The point and first derivatives retain the exact values returned by the existing
native D1 evaluator. Each result array is independent of the caller data.

```ts
const curveQuery = cad.evaluateCurveD2(originalCurve, parameter);
const surfaceQuery = cad.evaluateSurfaceD2(originalSurface, u, v);
```

Second derivatives use analytic homogeneous derivatives and the rational
quotient rule. They retain the original knot parameter scale. The implementation
uses no finite differences or parameter nudging. A rational degree-one Curve
can have a nonzero second derivative because its parameter speed can vary.

Endpoints use the interior one-sided span. At an exact interior knot, D2 refuses
when degree minus knot multiplicity is less than two. A Surface query checks
both axes. This conservative rule also applies when particular coefficients
could cancel a discontinuity. A discontinuity elsewhere does not itself block
a query within another span. Zero derivatives and singular geometry are valid
finite results. The query does not assert a regular tangent, normal, curvature
or continuity between separate patches.

The query profile supports Curve degrees 1 through 5 with at most 64 poles,
and Surface degrees 1 through 5 with at most 16 poles per axis. Coordinates,
knots and parameters must be finite and within 10000 in magnitude; coordinates
use mm. Native positive weights retain their existing bounds. Invalid input,
insufficient local continuity or unrepresentable arithmetic throws a bounded
`NativeSecondDerivativeError`. Previous input data and results remain unchanged.

```sh
node examples/cad-nurbs/second-derivatives-demo.mjs --source /tmp/cad-native-d2
```

## Native local curvature

`evaluateCurveCurvature` reports the actual D2 query, speed, unit tangent,
curvature vector and magnitude in 1/mm, and radius in mm. A straight Curve has
zero curvature and a null radius. A zero tangent refuses curvature.

`evaluateSurfaceCurvature` reports the actual D2 query, the native U/V unit
normal, normalized metric and second form, mean and sorted principal curvatures
in 1/mm, and Gaussian curvature in 1/mm². Its normal follows `du` cross `dv`.
With the reported second form `normal` dot second partials, an outward sphere
has negative mean and principal curvatures. Reversing U changes those signs
and the normal while preserving Gaussian curvature.

```ts
const curve = cad.evaluateCurveCurvature(originalCurve, parameter);
const surface = cad.evaluateSurfaceCurvature(originalSurface, u, v);
```

Each query calls the actual native D2 API once and retains its values. D2 input,
domain and exact-knot continuity bounds still apply. Zero or uncertain Surface
metrics refuse. Finite arithmetic and nonzero product/quotient guards prevent
unrepresentable reported values. Surface principal curvature computation scales
the second form. Its discriminant includes the raw scaled value, stated local
roundoff bound and any bounded negative-to-zero clamp flag. This policy does
not repair geometry or certify global accuracy.

`NativeCurvatureError` reports DERIVATIVE, REGULARITY or ARITHMETIC. A derivative
failure preserves its actual D2 error and cause. Outputs own independent CPU
arrays. Curvature results do not certify a Solid normal, trim validity, patch
G2 continuity or manufacturing tolerance. Analysis displays require separate
consumer evidence.

## Stored curved trim UV material classification — #1098

`classifyVLinearSurfacePlaneTrimUV(trim, queries, options)` classifies original
dimensionless UV points against the two stored curved regions from #1083.
Queries contain queryId/u/v. Options contain evaluationId, maxQueries:1..4 and
maxSubdivisions:0..16. `validateVLinearSurfacePlaneTrimUVClassification(result)`
reconstructs the entire operation, retaining the complete parent trim and its
source/proofs. Caller data and previous accepted results remain unchanged.

Original chart boundaries and cut endpoints use exact represented-value
comparisons. Interior queries use homogeneous de Casteljau subdivision and the
existing strictly increasing stored U graph. Positive-weight restricted hulls
certify below or above. Exact U/V root equality or a constant exact V witness
can certify the shared cut boundary. Native floating point sample equality
does not establish exact boundary membership.

Each result reports chart status, cut relation and the classification of both
source-qualified faces. A point below the cut is inside the lower face and
outside the upper face; chart boundary status remains explicit. An exact point
on the shared cut is a boundary point of both faces. Exhausting the subdivision
limit returns `uncertain` with the retained exact bracket/hull. Hard arithmetic
budget failures remain typed atomic errors. Limits bound the work; they do not
promise that every query can be resolved.

```sh
node examples/cad-nurbs/vlinear-plane-trim-classification-demo.mjs --source EVIDENCE_DIR
```

This is material classification in the original UV chart against the stored
graph. World point projection, ideal Plane half-space membership, support
embedding, occupied Solid volume and general 3D Boolean require later features.

## Restricted integer axis-box 3D Boolean — #1101

`buildAxisBoxSolidBoolean(a, b, options)` computes a regularized union,
intersection or difference of two Source0-bound integer axis boxes. Assets
contain sourceId/sourceVersion:0/source/shell. Options contain operation,
evaluationId, resultIdPrefix, maximumCells:27 and maximumPanels:72.
`validateAxisBoxSolidBoolean(result)` rebuilds the entire result. Original source
models and actual unchanged AxisBoxSolid validation reports remain retained.

The profile supports overlapping, disjoint and face-touching integer boxes.
Source supports must match all six original shell Face Surfaces by full
coefficient bits. Existing integer bounds and exact safe-integer analysis apply.
Edge/corner-only union refuses CONTACT because the combined boundary is not
manifold. Such intersections are empty; differences retain regularized A.
Generated grid zero is +0; original caller data and source bits stay unchanged.

Original min/max planes partition at most27 open cells. The result is the
closure of occupied cells. Native outward boundary tiles appear only between
occupied and empty cells; internal faces are removed. Exact grid incidence
requires two opposed uses per edge and one oriented cycle per vertex link
before output Face construction. Each admitted tile retains an actual native
FaceBundle and compiled Source0 Model5. Coplanar tiles stay separate, avoiding
T-junctions and tolerance-based welding.

Material components, boundary Shells and exterior/cavity empty components are
separate. A cavity can have one material Body and two Shells; a cut can split
the material into two Bodies. Euler is diagnostic. Exact cell volumes, panel
areas and oriented Shell volume sums must agree. An empty difference returns
an explicit empty result with no Solid or boundary sources.

```sh
node examples/cad-nurbs/axis-box-boolean-demo.mjs --source EVIDENCE_DIR
```

The geometric proof applies to this exact integer cubical coefficient model.
Rotated, floating-coordinate and curved operands, cylindrical holes,
manufacturing tolerance and global evaluator error remain outside this profile.
Rendering, authored feature lifecycle and integrated save/recovery require
their own consumer evidence.

## Exact XYZ material queries on axis-box Boolean Solids — #1105

`classifyAxisBoxSolidBooleanPoints(boolean, queries, options)` classifies points
against a complete owned #1101 result. Queries contain queryId/pointMM:[x,y,z];
options contain evaluationId/maximumQueries:1..8. Any finite represented XYZ
point is supported in the original authored mm frame. No pose, axis or unit
conversion is applied. Query bits, including signed zero, remain retained.
`validateAxisBoxSolidBooleanPointClassification(result)` reconstructs the full
operation and compares all parent data, point proofs and references.

Exact comparisons against integer coordinate planes identify at most eight
incident cells. All occupied means inside, none occupied means outside, and a
mixed neighborhood means boundary. A cancelled internal grid plane with
occupied cells on both sides is inside. An empty Boolean is always outside.
Absent cells refer to the actual exterior empty region.

Boundary queries also match actual native panels by exact plane equality and
closed tile ranges. Results retain qualified panel/source/Body/Shell/void/local
Face/Surface references, so cavities, exterior voids and separate Bodies remain
distinct. No distance tolerance, ray, snap or floating D0 equality is used.
The work is bounded to eight queries,64 cell checks and576 panel tests.

```sh
node examples/cad-nurbs/axis-box-point-classification-demo.mjs --source EVIDENCE_DIR
```

This is exact membership in the saved restricted integer cell coefficient
model. General curved-Solid queries, point projection, manufacturing tolerance,
global evaluator error and renderer picking remain separate features.

## Disjoint and face-contact Boolean support — #1108

The same `buildAxisBoxSolidBoolean` API and result schema now accept separated
boxes and face contacts. Disjoint union returns separate Bodies, intersection
is empty, and difference retains A material. Face-touch union removes the
internal contact tile and connects the material; intersection is empty and
difference retains A. Existing positive-overlap coefficients, source strings,
IDs, order and counts remain unchanged.

Only overlap/contact admission changes. The complete occupied-cell, native
panel, manifold, component and volume proof still runs. Edge/corner-only unions
remain unsupported CONTACT errors. A negative overlap on another axis denotes
disjoint material even if other plane coordinates coincide. Empty gap cells can
be wider than a box side; emitted panels remain inside their original box bounds.

```sh
node examples/cad-nurbs/axis-box-contacts-demo.mjs --source EVIDENCE_DIR
```

The new flow checks current contact/disjoint results, saved positive-overlap
digests, exact XYZ material queries and compiled consumers. Earlier #1101
receipts keep their original restricted scope and first verification history.

## Exact cell-Solid mass, centroid and inertia — #1112

`measureAxisBoxSolidBooleanMass(boolean, options)` measures the complete owned
integer-cell Solid with an explicit uniform declared density. Options contain
densityKgPerM3 (positive finite, at most1e6) and maximumCells:27.
`validateAxisBoxSolidBooleanMass(result)` reconstructs the entire operation.
The result retains boolean/options/bodies/total/report and all parent sources,
native geometry and manifold/material proofs.

Only occupied cells contribute. Exact rational volume, first moments and second
coordinate moments give each Body's and the total mass, centroid and centroidal
inertia. Unit conversion divides by exact integers: mass uses density/1e9 and
inertia uses density/1e15. Products and translated-centre cancellation stay
exact even when a raw moment exceeds the safe integer range. Overlapping
operands are not double-counted; cavities and disconnected Bodies follow the
actual material cells.

Returned units are kg, mm and kg*m2, with density in kg/m3. Final values use
nearest-even conversion and retain exact/upward error bounds. Both the exact
and stored symmetric inertia matrices must have positive leading principal
minors for nonempty material. Nonzero underflow refuses instead of returning a
false zero. Empty material has mass0 and null centroid/tensor. The fixed exact
arithmetic budget may refuse oversized work atomically.

```sh
node examples/cad-nurbs/axis-box-solid-mass-demo.mjs --source EVIDENCE_DIR
```

These are properties of the admitted coefficient model and declared density.
Physical material certification, nonuniform density, arbitrary curved Solid
properties, principal directions, physics pose conversion, manufacturing
tolerance and integrated consumers remain separate.

## Principal moments and axes for owned Solid mass — #1118

`analyzeAxisBoxSolidPrincipalInertia(mass, options)` analyzes the stored inertia
tensor of the complete owned cell-Solid mass result. Options contain selection,
maximumRotations:0..64, scaledResidualTolerance and degeneracyToleranceRelative.
Select `{kind:'total'}` or `{kind:'body',bodyId}`. Tolerances range from256EPS
to1e-8 for residuals and1e-6 for degeneracy. The owned validator reconstructs
the full operation. Results retain mass/options/measure/principal/report.

The parent is validated once. Its exact moments, conversion errors and PD
witnesses stay unchanged. Numerical authority is the selected stored symmetric
kg*m2 tensor. Matrix scaling and bounded Jacobi rotations record pivots, raw
annihilation residuals, matrix/eigenvector traces and similarity guards. Final
eigenvector, reconstruction, orthogonality, unit and right-handed checks retain
their actual residuals. Unresolved iterations or representation failures refuse
atomically. Empty total material returns no axes or eigensystem.

Moments are sorted ascending. The first two axes use positive dominant XYZ
components with XYZ ties; the third completes a right-handed frame. Only exact
zero axis components become +0. Adjacent small moment gaps form observed
clusters and a nonunique-axis indication. These are local representatives,
not persistent or certified unique geometric axes.

```sh
node examples/cad-nurbs/axis-box-principal-inertia-demo.mjs --source EVIDENCE_DIR
```

This is observed numerical analysis of a stored tensor. It does not replace
the exact parent moment/error authority or certify exact-geometry eigenvectors,
global floating error, manufacturing tolerance, physical material or pose.
The previous normal-prism principal API remains a separate family.

```sh
node examples/cad-nurbs/local-curvature-demo.mjs --source /tmp/cad-local-curvature
```

## Transverse Curve crossings against planar Face material

`intersectCurveWithPlanarFaceMaterial` queries an original Curve against an
owned `buildConvexPlanarFaceWithHoles` result. It reports crossings in material,
holes, outside the outer trim, outside the native chart, and admitted exact
boundaries. Each event retains the actual Face classifier and its original
edge, curve, use, pcurve and Line parameter contributors.

```ts
const result = cad.intersectCurveWithPlanarFaceMaterial(curve, face, {
  evaluationId: 'crossings', resultIdPrefix: 'cross',
  pointEventIds: ['crossing_0', 'crossing_1', 'crossing_2'],
  maximumBracketRestrictions: 192, maximumClassifications: 192,
});
cad.validateCurvePlanarFaceMaterialIntersection(result);
```

The query uses the existing wide degree-one/two or cubic Curve–Plane root
operation. Actual original D1 and opposite signed side observations must
establish a transverse crossing. Coincident spans, unsupported tangencies,
unavailable derivatives or uncertain crossing data refuse atomically.

Every original root contribution keeps its parameter bracket. The builder
uses the existing interval extractor on that contribution's local Bezier and
maps its positive-weight control hull into the original dimensionless Plane UV
chart. All chart and outer/hole halfspaces must support one consistent decision.
An estimated root or three sampled positions cannot replace this hull check.
A hull that crosses or approaches a trim boundary without a safe decision
refuses. Exact boundary constraints retain the real classifier contributors.

Curve degree is 1 through 3 with at most 64 poles. The Face has one or two holes,
3 through 8 native Lines per loop and at most 15 Lines in total. This query
profile requires original XYZ within 10000 mm. It preserves the original knot
domains and native UV units. Result prefix length is at most 8 characters.
Trim budgets are checked after the actual root operation and before interval
restriction or classification. Every accepted result owns its CPU data.

The original Face Source0 Model, Curve/Plane Source0 Model and actual interval
sources stay separate. A Face can already use all 16 native Model objects.
The query creates point/provenance records. It does not sew vertices, trim the
Face or certify a Boolean result, persistent topology or Solid. The hull proof
uses the declared local extraction binding and arithmetic guards; it does not
certify a global binary64 enclosure or manufacturing tolerance.

```sh
node examples/cad-nurbs/curve-planar-face-material-demo.mjs --source /tmp/cad-face-crossings
```

## Uniform-density extrusion construction mass and inertia

`estimateCoplanarFaceBooleanExtrusionMass` extends the actual construction
volume and centroid query with uniform density and centroidal inertia.

```ts
const mass = cad.estimateCoplanarFaceBooleanExtrusionMass(extrusion, {
  densityKgPerM3: 7850,
  maximumBoundarySegments: 64, maximumSurfaceEvaluations: 8,
  maximumSurfacePointEvaluations: 64,
});
cad.validateCoplanarFaceBooleanExtrusionMass(mass);
```

Density is explicit in kg/m³. Mass uses kg, centers retain authored XYZ in mm,
and centered inertia uses kg·m². The report states both unit conversions.
Uniform density preserves the actual geometric centroid. Empty material has
mass zero, center null and centroidal inertia null.

The estimator calls the existing properties API once. It retains the complete
parent result and uses its actual support D1 for a physical plane basis.
Canonical trim vertices are queried on the original Surface. Directed outer
and hole loops provide centered physical polygon moments, and actual extrusion
translation supplies thickness moments. Separate component tensors combine
with the full parallel-axis term.

The calculation targets the declared canonical trim construction. Original
unsnapped native edges and their binding residuals remain distinct. The query
does not move geometry or certify a Solid or material density. Parent component,
source and budget bounds still apply. New canonical Surface point work is
prechecked and limited to 64 calls. Invalid density, insufficient budgets or
unrepresentable or cancellation-uncertain moments refuse atomically.

Outputs own their CPU arrays, including every tensor row. Principal inertia
axes, nonuniform density, general Solid integrals, physical consumer acceptance
and manufacturing accuracy require separate contracts.

```sh
node examples/cad-nurbs/coplanar-face-boolean-extrusion-mass-demo.mjs --source /tmp/cad-extrusion-mass
```

## Principal construction inertia and axes

`analyzeExtrusionConstructionPrincipalInertia` analyzes the actual centered
SI inertia tensor from an owned construction mass result. It validates that
result through the existing mass API and retains the full source and data.

```ts
const principal = cad.analyzeExtrusionConstructionPrincipalInertia(mass, {
  maximumRotations: 64, scaledResidualTolerance: 1e-10,
  degeneracyToleranceRelative: 1e-8,
});
cad.validateExtrusionConstructionPrincipalInertia(principal);
```

A bounded scaled symmetric Jacobi solver reports its actual rotations and
checks the eigenbasis, reconstruction and eigensystem residuals. Principal
moments are sorted ascending in kg·m². Axis vectors use authored world XYZ
and form a unit, orthogonal, right-handed representative basis. First two
axis signs follow the largest component; the third follows handedness.

Repeated or nearly repeated principal moments produce observed degeneracy
clusters. Their axis directions are not unique or persistent geometry names.
The returned representatives still satisfy the stated residual checks. Empty
mass has no principal system or phantom rotations. A diagonal tensor can use
a zero rotation budget; a nonconverged system refuses when its budget ends.

The analysis preserves the uniform-density canonical construction estimate
scope. It does not certify a general Solid, actual material, global accuracy,
stable axis naming, a physics body or a rendered engineering view.

```sh
node examples/cad-nurbs/extrusion-principal-inertia-demo.mjs --source /tmp/cad-principal-inertia
```

## Common section knot alignment and rational ruled Surface

`buildAlignedRationalRuledSurface` aligns two equal-degree sections on the same
original parameter domain, then calls the actual rational ruled constructor.

```ts
const result = cad.buildAlignedRationalRuledSurface(first, second, {
  surfaceId: 'aligned_surface', firstAlignedId: 'first_refined',
  secondAlignedId: 'second_refined', resultIdPrefix: 'align',
  maximumInsertedKnots: 14, maximumRefinementOperations: 14,
});
cad.validateAlignedRationalRuledSurface(result);
```

The ordered union uses the maximum multiplicity of each interior knot. Before
any refinement, the builder checks original/domain bits, all active IDs, both
complete insertion budgets and the final common Surface capacity of 16 U poles.
Numeric-equal knots with different bits, including mixed signed zero, refuse.
No parameter remapping, weight normalization or sampled replacement is used.

A changed section uses the existing wide refinement API once and retains its
full native/source/provenance proof. An unchanged section has refinement null,
zero insertion work and its original ID; its requested aligned ID must match
that original ID. The actual ruled Surface retains independent section weights
and denominator-weighted V interpolation. Original input, refinement and ruled
Source0 Models remain separate with their actual identities.

The profile supports degree 1 through 3 and two original sections with at most
16 poles. Original XYZ stays within 10000 mm. A new formal C0 knot can make an
aligned native D1 query refuse while the original D1 succeeded; both real states
remain in the provider proof. Alignment does not remove the multi-section loft
weight-bit guard or certify global shape, continuity, topology or Solid quality.

```sh
node examples/cad-nurbs/section-knot-alignment-demo.mjs --source /tmp/cad-section-alignment
```

## Exact common-boundary incidence for NURBS patch Faces

`buildExactBoundaryFaceAdjacency` links explicitly selected opposite full
boundaries from two through four owned parametric Faces. Each asset supplies
its source ID, actual Source0 text and FaceBundle.

```ts
const graph = cad.buildExactBoundaryFaceAdjacency([
  {sourceId: 'lower', source: lowerSource, face: lowerFace},
  {sourceId: 'upper', source: upperSource, face: upperFace},
], [{
  first: {sourceId: 'lower', boundary: 'u-max'},
  second: {sourceId: 'upper', boundary: 'u-min'},
}], {
  evaluationId: 'patch_incidence', resultIdPrefix: 'join',
  maximumCurveReversals: 8, maximumObservationPairs: 24,
});
cad.validateExactBoundaryFaceAdjacency(graph);
```

The source models are compiled and checked bit for bit, then the actual Face
validator runs. The full selected boundary coefficients must agree after an
actual reversal of the second Curve. Original domains, knots, poles and weights
are compared. Samples are diagnostic observations and cannot prove equality.
Same-direction uses, partial domains, changed weights or uncertain reversal
bits refuse. The query does not turn an original forward use into a different
Face orientation.

Shared-edge records retain both source-qualified original edges, curves, uses
and pcurves. Parent uses and pcurves have no standalone IDs; the source, Face,
boundary and local edge identify them. Only explicit endpoint associations
form graph vertex classes. Original vertices are preserved and never welded.
Unpaired boundaries remain free. Duplicate local IDs in separate source files
are valid after qualification; duplicate pairing or a third use refuses.

The profile uses degree 1 through 3, native grids at most16×16 and XYZ within
10000 mm. Parent global C1 and corner/chain checks remain. Each original Face
keeps its own five-object Model and actual comparison reversal sources remain
separate. At most8 pairs and24 direct observation pairs are admitted before
new work. A disconnected collection with no pairs performs no reversal work.

This is local incidence for an open patch collection. It does not establish
general sewing, G1/G2 continuity, manifold closure, Face trim, self-intersection
or Solid validity. Geometry, source and caller data remain unchanged.

```sh
node examples/cad-nurbs/exact-boundary-face-adjacency-demo.mjs --source /tmp/cad-patch-incidence
```

## Revision-checked embedded assembly part replacement — #1015

`replaceCadAssemblyPart(previous, transaction)` replaces one existing canonical
part document in assembly0. The transaction has expectedRevision, revision,
documentId, expectedDocumentRevision, replacementDocument and referenceRepairs.
Each repair has instanceId, previousReference and reference. The result retains
previous, transaction, result and report;
`validateCadAssemblyPartReplacement(result)` rebuilds the complete operation.
Existing `CadAssemblyError` and `CadAssemblyDiagnosticCode` provide refusals.

Assembly and target document revisions advance exactly one. A changed source
text requires that asset revision to advance exactly one; an unchanged source
asset retains all bits and its revision. At least one source text must change.
Whitespace is a textual edit and does not prove different native geometry.
Asset identity/order/metadata and all body records stay unchanged. Every
instance of the target document needs an explicit fresh qualified reference,
including instances of unchanged assets. Missing, duplicate, stale or foreign
repairs refuse the complete candidate. Changed coefficients use fresh native
references; coefficient-preserving `rebindCadGeometryReference` keeps its scope.

The existing document/assembly caps remain: up to four parts, four source assets
per part, sixteen bodies per part, thirty-two instances and hierarchy depth
sixteen. Sources are actual Source0; parts are canonical direct-geometry V1.
Unrelated documents/references, instance IDs/order/parents/local poses and world
matrices retain their bits. Reports retain old/new source revisions and explicit
reference provenance. No automatic topology matching, external watcher, mates,
Body/Solid or renderer acceptance follows.

```sh
node examples/cad-nurbs/assembly-part-replacement-demo.mjs --source EVIDENCE_DIR
```

This saved-source flow is the scoped final checkpoint with one affected CAD
build. Native completion and Integration adoption are recorded in #1015.

## Original-domain endpoint-D2 quintic Hermite Curve — #1026

`buildQuinticHermiteCurve(endpoints,options)` constructs one degree5 polynomial
Curve from exactly two ordered endpoint constraints. Each endpoint contains
parameter, pointMM, derivativeMMPerParameter and
secondDerivativeMMPerParameterSquared. Options contain curveId and
maximumEndpointEvaluations (0..2); two actual native D2 evaluations are required.
The result retains endpoints/options/curve/source/sourceVersion/model/report.
`validateQuinticHermiteCurve(owned)` reconstructs all coefficients, source,
endpoint observations and arithmetic provenance. Typed refusals use
`QuinticHermiteError` and `QuinticHermiteDiagnosticCode`.

For original span h=b-a, first offsets are (h*T)/5 and second offsets are
((h*Asecond)*h)/20. These define six centered control poles, original knots
[a,a,a,a,a,a,b,b,b,b,b,b] and six unit weights. Positions retain authored pole
bits, including signed zero. The actual Source0 compiler retains all native
coefficient bits; actual D2 checks both endpoints in original parameter units.
No tangent or parameter normalization is applied. A separately representable
h² factor is not required: a scaled second offset can be represented when h²
underflows. Nonzero product/quotient loss or a translated offset lost to rounding
refuses the request.

Endpoint parameter/point/D1/D2 components and generated poles have absolute
limits10000 in their declared units. Original span must be positive and finite.
Endpoint position distance is at most1e-7mm; D1/D2 norm residuals divided by
max(1,input norm) are at most1e-7. A nonzero supplied derivative component cannot
silently become zero. Zero tangent/second derivative and stationary or constant
native Curves are allowed if native evaluation succeeds. Supplied second
derivative vectors are parametric constraints; they are not scalar geometric
curvature constraints or a regularity/G2/global error certificate.

```sh
node examples/cad-nurbs/quintic-hermite-curve-demo.mjs --source EVIDENCE_DIR
```

One affected build and this saved-source flow establish the scoped native
checkpoint. General rational/periodic/multi-segment Hermite and fitting remain
separate tasks. The endpoint pole relations follow the Bernstein derivative
properties documented by [MIT](https://web.mit.edu/hyperbook/Patrikalakis-Maekawa-Cho/node12.html)
and [Michigan Tech](https://pages.mtu.edu/~shene/COURSES/cs3621/NOTES/surface/bezier-der.html),
with the chain rule for the original parameter domain. No external runtime is used.

## Source-qualified regular Curve endpoint continuity — #1031

`inspectCurveEndpointContinuity(first,second,options)` inspects two original
endpoints. Each input is sourceId/source/curve/endpoint (`start` or `end`).
Options contain evaluationId and maximumCurvatureEvaluations (0..2,requiring2).
The result retains first/second/options/models/native/analysis/report.
`validateCurveEndpointContinuity(owned)` rebuilds the entire operation.
`CurveEndpointContinuityError` and its diagnostic code preserve native causes.

Each original Source0 contains exactly one Curve and must match all input Curve
coefficient bits. Distinct sourceId contexts can contain the same local Curve ID.
Curves have degree1..5,2..64 poles,up to70 knots and coordinate/knot absolute
limits10000; existing positive-weight/clamped/native validation still applies.
The complete two-curvature-call budget precedes source compilation. Actual
`evaluateCurveCurvature` runs once at each original endpoint and retains its
entire native D2 result. This full query requires regular endpoints and refuses
actual singularity or unsafe arithmetic. It does not change standalone D2 rules.

First traversal approaches the selected endpoint: end+1/start-1. Second
traversal leaves it: start+1/end-1. First derivatives and unit tangents receive
these signs; second derivatives and curvature vectors stay unchanged. C0 checks
point distance; C1 also compares original-unit first derivatives; C2 also
compares second derivatives. G1 compares same-directed unit tangents; G2 also
compares inverse-mm curvature vectors. Different parameter speeds can satisfy
G1/G2 while failing C1/C2.

The observed policy uses1e-7mm point distance,1e-7 derivative/second-derivative
relative norm gap with max(1,both norms),1e-7 unit-tangent gap with positive dot,
and1e-7 curvature-vector relative gap with inverse-mm floor1. Conditions include
their lower-order prerequisites. These are local one-sided endpoint observations.
They do not raise the formal knot continuity of an existing joined Curve or
certify a whole Curve, Surface boundary, Body/Solid or manufacturing tolerance.

```sh
node examples/cad-nurbs/curve-endpoint-continuity-demo.mjs --source EVIDENCE_DIR
```

Original sources/domains/knots/weights/poles remain unchanged. Source/file/owned
rebuild and explicit published-map compiled proof belong to the scoped final
checkpoint. [MIT continuity definitions](https://web.mit.edu/hyperbook/Patrikalakis-Maekawa-Cho/node13.html)
distinguish parametric derivative matching from geometric continuity.

## Closed exact quad-patch incidence — #1057

`buildClosedExactPatchShell(assets,pairs,options)` composes unchanged exact
boundary-pair proofs into one connected closed incidence graph. Assets and pairs
use the existing source-qualified Face API. Two through six Faces require
exactly twice as many pairs; each of the four local boundaries occurs once.
Options are shellId/resultIdPrefix/maximumPairEvaluations/maximumObservationPairs.
The prefix has at most five characters; budgets cover up to twelve children and
thirty-six observation pairs before any child work.

Each actual child receives two assets and one pair. Its complete result stays
unchanged, including closed:false and its local free boundaries. Global classes
use only actual child endpoint associations and matching qualified vertex bits.
Unrelated equal coordinates are not welded. The global graph checks two
opposite uses per Edge, distinct endpoints, complete original entities, a
connected Face graph and connected degree-two vertex-link cycles. Face corners
supply the link arcs. Two-node parallel-arc cycles are allowed; Euler V-E+F is
diagnostic and is not forced to two. Original sources/pcurves/geometry/Face
orientation and existing provider limits remain unchanged.

The result retains assets/pairs/options/pairResults/graph/report.
`validateClosedExactPatchShell(owned)` rebuilds every actual child and all graph
proofs. `ClosedExactPatchShellError`/DiagnosticCode retain actual native causes.
Global closed and abstract incidence-manifold results do not certify geometric
embedding, self-intersection, inside/outside, occupied volume or Solid. Reports
keep geometricValidity:not-certified and solid:false. General 3D Boolean still
needs those checks plus original Surface intersections and native trims.

Each accepted Face retains the existing degree1..3/grid<=16x16/C1/corner/source
profile. Direct root-child calls and summed child direct compilation/Face/boundary/
reversal/D0/D1 work are reported separately from internal work. Complete proof
payloads retain the existing million-value limit and can refuse larger data.

```sh
node examples/cad-nurbs/closed-exact-patch-shell-demo.mjs --source EVIDENCE_DIR
```

The scoped native checkpoint uses one affected build and this actual
source/file/API/cold/owned/explicit compiled-map flow. Integration and renderer
acceptance remain separate.

## V-linear Surface–finite Plane section — #1069

`buildVLinearSurfacePlaneSection(surfaceAsset,planeAsset,options)` constructs a
full-strip section of an original rational Surface and a finite affine Plane.
Each asset has sourceId/source/surface, with actual whole Source0 models and
selected Surface bits retained. Options contain evaluationId/curveId/
surfacePcurveId/planePcurveId/maximumObservations, requiring five observations.
The owned validator rebuilds the complete construction and proof.

The first profile has a single U Bézier span of degree1..2 and Vdegree1. Plane
has degree1x1,2x2 poles,equal weight bits and an exact fourth-corner affine
relation. Original domains remain unchanged. Exact strict opposite signed-plane
Bernstein columns admit one full-strip parametric section. Tangent, partial,
nonlinear-V, outside-chart or unsafe inputs refuse.

Exact rational arithmetic on original binary64 data constructs the homogeneous
section and dual UV maps. Bernstein denominator scales2/12 for world and2/3 for
SurfaceUV are disclosed. Derived weights must be exactly represented and remain
within native1e-6..1e6; original weights are unchanged. This is a bounded subset
of valid weighted Surfaces. Cartesian divisions use exact nearest-even rounding.
World Curve degree is2p<=4; SurfaceUV degreep+1<=3; PlaneUV degree2p<=4. UV
pcurves are dimensionless JSON sidecars and are excluded from mm Source0 files.

Positive-weight control-hull bounds limit whole coefficient-defined model gaps.
World pole rounding plus original-unit Surface/Plane Lipschitz bounds must stay
within1e-7mm. Exact fractions and upward binary64 bounds, including subnormal
values, are retained. This proof concerns model representation. Global native
evaluator rounding, regularity, embedding, manufacturing and Solid remain
uncertified. Actual world/twoUV/twoSurface D0/D1 observations and chain residuals
are recorded separately. Finite Plane control-hull containment is required; no
clipping or snapped geometry is returned.

Source parameter/coordinate limits10000 and spans>=1e-6 apply. Exact arithmetic
has fixed operation/GCD/bit/string/search budgets and refuses oversized work.
Native causes and previous accepted files remain on failure. The result retains
original assets/options/models, worldSource0, UV sidecars, exact proof, native
observations and report. Existing source/math/Plane helpers remain unchanged.

```sh
node examples/cad-nurbs/vlinear-plane-section-demo.mjs --source EVIDENCE_DIR
```

This is an intersection foundation. General Surface–Surface, native trimming,
inside/outside and Solid Boolean remain separate. Existing adaptive Curve
samplers still cap degree3; a native degree4 result does not widen renderers.

## Complete Source0 selected-Surface control-net edit — #1071

`editSourceSurfaceControlNet(request)` edits an explicit selected Surface in its
original complete Source0 file. Request fields are source/sourceVersion:0/
surfaceId/edits, with the existing `SurfaceControlNetEdits` shape. The result
retains request/originalModel/model/source/full native edit/patches/report.
`validateSourceSurfaceControlNetEdit(owned)` reconstructs the full operation.
Typed errors preserve actual compiler and native causes.

Actual compiler AST numeric ranges bind every changed field to the selected
Surface and original coefficient bits. Actual `editSurfaceControlNet` runs once.
Only its changed fields produce scalar replacements via the existing decimal
emitter. Patches contain uIndex/vIndex/field/startUTF16/endUTF16/originalText/
replacementText, ordered by original offset; application runs in reverse order.
All other source spans, comments, whitespace, model name, object order, IDs and
sibling native fields retain their exact state. No-op preserves the original
file text; +0 to -0 is a real change. Child one-Surface source remains child
proof, while the complete candidate file is authoritative for the full model.

Original and candidate UTF-16 units and UTF-8 bytes are at most262144. Whole
Model0 has1..16 native objects; unselected degree5 Curves remain legal. Selected
Surface uses actual native619 degree1..3/grid<=16x16/coordinate10000/positive
weight limits and1..16 unique pole edits, at most64 scalar patches. Full source
compilation before and after editing verifies selected child geometry and all
untouched fields. SourceVersion2 expressions and malformed/missing/duplicate
Source0 fields refuse at their real compiler/input stages. No implicit literal
insertion or geometry-only full-file replacement is performed.

```sh
node examples/cad-nurbs/source-surface-control-net-demo.mjs --source EVIDENCE_DIR
```

The scoped native checkpoint is one affected build plus this actual mixed-file/
API/cold/owned/explicit compiled-map flow. Actual editor adoption, rendering,
source revisions, hash/history and global geometry certification stay separate.

## Original V-linear section trim candidates — #1083

`buildVLinearSurfacePlaneTrimCandidates(section, options)` uses a complete owned
V-linear Surface–Plane section to create two trim candidates on the original
Surface. `validateVLinearSurfacePlaneTrimCandidates(result)` reconstructs the
operation and compares the entire result. Options contain evaluationId,
resultIdPrefix, maximumBoundaries:4, maximumIntervals:4 and maximumObservations:21.
Failures preserve the original section and accepted files.

Four natural boundary Curves and four actual V1 interval extractions retain
their original domains and complete child receipts. Seven unique world Curves
and the original selected Support form an actual Source0 Model8. Dimensionless
UV sidecars, six logical vertices, seven edges and two four-use loops retain
source identities. The shared section has opposite uses; its degree4 world
Curve is never sent to the degree3 reversal or interval providers.

Exact positive Bernstein coefficients of the stored UV U-derivative numerator,
positive weights and strict interior V poles establish a simple UV graph.
The two candidates cover the regions below and above that stored graph. This
does not establish ideal Plane half-space classification near the rounded cut.
The left boundary decreases V. Exact inverse mapping, rounded native interval
parameter, mapped UV and residual are retained without assuming reflection
preserves every bit.

Exact homogeneous cross-product bounds compare each actual clipped V1 Curve
with its ideal restriction. Original Surface V Lipschitz bounds include the
nominal UV mapping error. All seven whole coefficient-model position gaps must
be at most1e-7mm. Local native D0/D1 and UV chain observations remain separate;
the interval child's local-only proof is unchanged.

```sh
node examples/cad-nurbs/vlinear-plane-trim-demo.mjs --source EVIDENCE_DIR
```

These are curved trim candidates. UV simplicity and bounded position model gaps
do not certify world embedding, self-intersection, global evaluator error,
manufacturing tolerance, material inside/outside, manifold Solid or general
3D Boolean. Rendering and editor/save/recovery acceptance require their own
consumer evidence.


## Explicit signed-axis mass frame — #1125

`transformAxisBoxSolidMassFrame(mass, options)` transforms the exact properties
of one complete owned axis-box Boolean mass result. Select total material with
`{kind: 'total'}` or one actual Body with `{kind: 'body', bodyId}`. Options also
contain `pose: {frameId, matrix}` and the fixed `maximumConversions: 32`.
`validateAxisBoxSolidMassFrame(result)` reconstructs the whole parent binding,
pose, exact arithmetic, conversion errors and positive-definite proofs.

The matrix uses the existing assembly convention: row-major4x4 with column
vectors. Its rotation is one of24 proper signed-axis permutations (numeric
-1/0/1, determinant+1); translations are safe integer mm with absolute value
at most1e6. The bottom row is [0,0,0,1]. The target frame is an explicit ASCII
label1..48. Reflection, scaling, shear and arbitrary-angle rotations refuse.
Original matrix bits, including signed zero, remain in the copied options.

Exact parent fractions are the authority. The target centroid is R*C+t and
centroidal inertia is R*Ic*R^T. Inertia about the target origin uses the parallel
axis theorem with the exact integer divisor1000000 for mm2 to m2. Mass and
volume remain unchanged. Final values use nearest-even binary64 conversion,
with exact absolute errors and least upward error bounds; symmetric entries
are mirrored. Generated exact zero is +0. Nonzero underflow refuses.
Both centroidal and origin tensors must have three positive exact leading
minors for the model and the stored binary64 tensor. A valid exact tensor whose
rounded representation loses positive definiteness refuses explicitly.

The six result fields retain the complete original mass and selected measure,
options, posed properties, rotation/unit proof and report. Empty total material
has mass0 and null centroid/tensors/positive-definite proof. Body selection
must identify a real Body. One parent mass owned validation precedes the new
exact computation; inherited geometry validation work is recorded separately.
There are no new root Curve/Surface evaluations or source compilations.

The profile has at most32 logical conversions (16values plus16error bounds),
2048 float-search steps and the unchanged request-local rational limits of
200000operations/200000GCD steps/8192bits. Coordinate components stay within
1e7mm. Failures return no partial result. Sources, original moments and parent
conversion/positive-definite proofs remain unchanged in independent copies.

```sh
node examples/cad-nurbs/axis-box-mass-frame-demo.mjs --source EVIDENCE_DIR
```

This API converts mass properties between explicit frames. It does not bake a
geometry pose or bind the whole multi-source Solid to an assembly instance.
Arbitrary-angle conversion, general rotated/curved Solid Boolean, physical
simulation, material certification, rendering and integrated file/recovery
acceptance remain separate requirements.


## Authored integer-box Boolean feature document — #1129

`buildAxisBoxSolidFeatureDocument(document)` evaluates two actual original
Source0 box-support assets. This additive version0 document retains authored
origin/side dimensions, six explicit support IDs per operand, local Face IDs,
Shell IDs, one union/intersection/difference feature and revision0..1000000.
It does not accept an evaluated Shell or display mesh as authored authority.
Six selected degree1/1,2x2unit-weight Surfaces must match declared integer box
corners in the established outward face order. Unrelated original geometry
remains source/compiler authority, including degree5Curves.

`editAxisBoxSolidFeatureDocument(document, edit)` accepts exact fields:

```js
const result = cad.editAxisBoxSolidFeatureDocument(document, {
  expectedRevision: document.revision,
  operandEdits: [{sourceId: document.operands[0].sourceId,
    originMM: null, sidesMM: [20, 30, 40]}],
  operation: null, // or 'union', 'intersection', 'difference'
});
const report = cad.validateAxisBoxSolidFeatureDocument(result);
const text = cad.serializeAxisBoxSolidFeatureDocument(result.document);
const reopened = cad.parseAxisBoxSolidFeatureDocument(text);
```

The complete authored parent is evaluated once before edits. Changed
coefficients use actual `editSourceSurfaceControlNet` operations in the full
original file. Each changed support keeps its complete source-edit child and
literal patch proof. Unchanged scalar spans, comments, whitespace, Model
metadata, object order, IDs, unused geometry and signed-zero bits remain.
No single-Curve generated source replaces a complete original asset.

Every dimension-changed operand rebuilds all six FaceBundles and their24
DERIVED boundary Curves, then its Shell and Solid validation. Changed material
uses the actual existing 3D Boolean provider. Unchanged operands retain their
validated base assets. Operation-only edits reevaluate Boolean; a genuine
no-op retains exact source/document/revision and the validated base Boolean.
Real authored changes increment revision once. Stale revision, source mismatch,
invalid bounds or native CONTACT failure return no partial source/document or
geometry. Inputs remain unchanged and the API performs no filesystem writes.

The request, output authored document, source-edit proofs, actual operands,
Boolean and report are retained as independent copies. Owned validation
reconstructs the original request and compares every source/proof/child bit.
The serializer validates the authored document and emits bit-faithful JSON,
including literal -0; the parser cold-evaluates its complete authored sources.
Evaluated children and edit history remain in separately saved owned results.

Limits are two operands, twelve source-edit calls,144changed coordinate scalar
patches,27cells and72panels. Sides remain integer1..10000mm and all corners
within±10000mm. Complete source files remain within262144UTF-16 units and UTF-8
bytes with1..16original objects. Authored file text remains within1048576units
and bytes. Direct orchestration counts exclude inherited parent/child work;
all existing provider reports remain available. IDs are qualified by source;
stable authored IDs do not certify persistent generated topology naming.

```sh
node examples/cad-nurbs/axis-box-solid-feature-document-demo.mjs --source EVIDENCE_DIR
```

This provides authored edits for the restricted integer-axis box family.
General rotated/cylindrical/curved Solid Boolean, arbitrary authored boundary
Curve rebinding, persistent topology naming, whole-Solid assemblies, rendering,
live document sessions and integrated file/recovery acceptance remain separate.


## Complete original Source0 Curve scalar editing — #1134

`editSourceCurveControlPolygon({source, sourceVersion: 0, curveId, edits})`
changes selected Curve coordinate/weight literals inside a complete mixed
original source. The actual native Curve profile is degree1..5,2..64poles,
knots=count+degree+1<=70, coordinateswithin±1e6mm and weights1e-6..1e6.
`edits: {poleEdits}` accepts1..64unique indices with a nonempty subset of
xMM/yMM/zMM/weight, up to256requested fields. Degree, knots, original domain,
ID, count and pole order are immutable. Existing normal/Wide editors and their
own degree/pole/report profiles remain unchanged.

```js
const result = cad.editSourceCurveControlPolygon({
  source: originalWholeSource,
  sourceVersion: 0,
  curveId: 'selected_curve',
  edits: {poleEdits: [{index: 1, xMM: 12, weight: 2}]},
});
const report = cad.validateSourceCurveControlPolygonEdit(result);
// result.source is the complete accepted candidate, including all siblings.
```

Original whole Source0 compilation binds the selected Curve, actual AST/IR
identity, exclusive UTF-16 numeric ranges and native coefficient bits. A new
copied Curve receives the requested scalar edits and passes actual native
validation. Every requested scalar, including no-op, binds its original
lexeme/AST/coefficient. Only Object.is changed fields produce sorted literal
patches using the existing decimal emitter. Private patch application and full
candidate compilation verify original Model metadata/name/object order/IDs,
all unrelated Curve+Surface geometry and the exact edited selected Curve.
Unchanged spans, Unicode/CRLF/comments and untouched signed-zero bits remain.
No-op keeps original unusual decimal spelling; +0/-0 is a real edit.

Exactly three represented original parameters are left, left/2+right/2 and
right. Narrow domains can repeat a parameter; the exact parameters are retained
without perturbation. Native D0 before/after must succeed, or the operation
refuses atomically. Native D1 before/after is attempted at each parameter and
returns actual evaluated data or a labelled native refusal. C0 and arithmetic
refusal messages remain; no zero derivative is fabricated. The maximum observed
point change is a sample observation, not a global geometry/error bound.

The eight result fields retain request/originalModel/model/source/curve/
provenance/patches/report. Every caller occurrence is independently copied.
The owned validator repeats the complete original operation and compares all
numeric bits, source bytes, patches, observations and reports. Failures publish
no partial source/result and do not mutate caller data or write files.

Bounds are source262144UTF-16 units and UTF-8 bytes, Model1..16objects,
256patches/64edits, replacementliteral512characters, copied1Mvalues/depth64.
Direct work is originalCompile1/candidateCompile1/nativeEditedCurveValidation1/
domainQuery1/nativeD0calls6/nativeD1attempts6 and one decimal emission per changed
field. D1 success/refusal counts are explicit; inherited validations are separate.

```sh
node examples/cad-nurbs/source-curve-control-polygon-demo.mjs --source EVIDENCE_DIR
```

This is a source-preserving authoring operation. Live document revisions,
qualified topology rebinding, global evaluator bounds, self-intersection/Solid,
manufacturing, renderer/consumer adoption and integrated file recovery remain
separate requirements. Source0 expressions retain actual compiler refusal.


## Independent-weight piecewise rational loft — #1139

`buildPiecewiseRationalLoftSurface(sections, parametersV, options)` constructs an
explicit piecewise ruled native Surface from2..15original Curves. Sections use
common original Udegree1..5/count2..16/knot/domain bits; each keeps its own
positive native weights. The resulting Surface has Vdegree1 and clamped linear
Vknots at the original strictly increasing finite stations. All adjacent and
full parameter spans must be finite and positive. Caller order, IDs, Cartesian
poles, weights, original Uknots and signed-zero bits are retained without repair.
The native Surface axis16 bound is separate from the general Curve64pole cap.

```js
const loft = cad.buildPiecewiseRationalLoftSurface(sections, [2, 4, 8, 12], {
  surfaceId: 'piecewise_surface',
  modelName: 'new_loft_model',
  maximumSections: 15,
  maximumUPoles: 16,
  maximumPointObservations: 87,
  maximumDerivativeObservations: 87,
});
const report = cad.validatePiecewiseRationalLoftSurface(loft);
```

Rows correspond to original U poles; columns correspond to original sections.
Native validation and an actual Source0 compiler confirm every copied section
and constructed Surface bit. The emitted NEW Model contains ordered sections
plus the Surface, at most16objects. This new construction source does not
replace a caller's unseen complete mixed original file. The full request,
sections, stations, compiled geometry, source, coefficient provenance and report
remain independently copied; owned validation reconstructs the whole operation.

Between stations, the Surface blends homogeneous numerators and denominators.
Independent weights generally change the Cartesian interpolation fraction.
Actual native basis/section denominators and point evaluators provide the
observed homogeneous comparison; a naive Cartesian blend difference is a
sample witness. Three represented original Uparameters at each station and
adjacent Vmidpoint generate at most87point comparisons. Every comparison must
pass the declared local1e-7mm guard. This observation is not a global error bound.
Narrow parameter ranges can repeat a represented midpoint; no perturbation or
reparameterization is performed.

Actual native SurfaceD1 is attempted at every point query. Interior Vstations
have formal C0 basis continuity; inherited U C0 and arithmetic refusals also
remain as labelled native evaluated/refused unions. No derivative is fabricated
and no smooth/G1/G2 loft is certified. D0 or observation arithmetic failure is
atomic and returns no partial Surface/source. The API performs no file writes.

Fixed limits sections15/Uaxis16/Udegree5/Vdegree1/point87/D1attempt87,
CurveD0calls129/SurfaceD0calls87/basis84/decimalemissions2306, source262144UTF-16
and UTF-8 bytes, copied1Mvalues/depth64. Original native coordinates remain
within±1e6mm and weights1e-6..1e6. IDs are distinct under native/source rules.
Direct construction/source/observation counts exclude inherited validations.

```sh
node examples/cad-nurbs/piecewise-rational-loft-demo.mjs --source EVIDENCE_DIR
```

Existing two/three-section independent-weight constructors and the matching-
weight multi-section loft remain unchanged. General unlike bases, smooth
independent-weight lofts, guides, transported frames, caps/Solid, topology,
manufacturing/global binary64 enclosure, live document/consumer rendering and
release acceptance remain separate requirements.
