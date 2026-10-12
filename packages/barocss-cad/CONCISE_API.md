# Concise CAD API

Import the additive `cad` namespace from `@barocss/cad`, then destructure the
profile you need. The original named exports remain available and unchanged.

```ts
import { cad } from '@barocss/cad';

const { affineXY } = cad.sketch;
const { prismXY, convex } = cad.solid;
const { sourceV1, prismV1 } = cad.document;
```

Each leaf is the **same function object** as its descriptive export, rather than
a wrapper. Types, overloads, required options, return values, error classes,
diagnostics, validation costs and refusal behavior are identical. Namespace
records are frozen and readonly; the facade does not freeze provider functions
or caller data, introduce defaults, convert units, repair geometry or infer a
profile. Importing it does not run a geometry operation or allocate renderer
resources. Existing named imports remain useful when importing one operation.

## Choose the supported profile

- `sketch.affineXY`: the existing version-0 exact-affine binary64 XY **line**
  sketch in millimetres. Its typed constraint set includes fixed, coincident,
  horizontal/vertical, midpoint, point-on-authored-line and parallel-to-fixed-
  direction constraints. It is not the circular/numerical sketch solver.
  `solve` returns the existing success/diagnostics union; `build` throws on
  refusal. `validate` reconstructs a successful result.
- `solid.prismXY`: a single explicit 3..8-segment strictly convex XY cycle,
  extruded in +Z with positive height at most 10000 mm. The caller supplies
  source/revision, ordered segment identities, cap chart and output identities.
  Existing exact representability, topology and work limits still apply.
  `wall` resolves a source-qualified segment wall and retains the original
  `preserved`, `deleted` and `stale` statuses.
- `solid.convex`: existing source-qualified **closed convex planar** Solids,
  accepted as `ConvexPlanarSolidResult`. `split` uses the existing supported
  affine-plane cutter; `intersect` uses the bounded convex intersection profile.
  `subtractSlab` requires the admitted through slab and two explicitly selected
  opposite tool supports. `chamferCardinal` handles one complete supported
  cardinal edge, with equal physical distance on the two faces. `mass` requires
  explicit density in kg/m³ and a fan-triangle budget. These methods do not
  accept arbitrary B-reps, curved solids or unrestricted Boolean/chamfer inputs.
- `document.sourceV1`: `CadDocumentV1`, the **document format** version 1 with
  source-version-0 curve/surface assets and qualified body bindings. This name
  does not mean Source grammar version 1 or an editable Solid feature graph.
- `document.prismV1`: `XYAffinePrismFeatureDocumentV1`, the fixed-role graph with
  two sketches, two prisms, one slab subtraction and an optional chamfer. The
  chamfer is a sibling operation on the **original parent prism**, not a chamfer
  of a subtraction component. This is not an arbitrary feature DAG or a v2 API.

All native units, source bytes, revisions, ownership rules, exact-or-refuse
arithmetic and operation-specific budgets remain those of the original API.
The original parameter/result types are exported from `@barocss/cad`; the facade
adds no substitute `Solid` type and no weaker validation path. A short name does
not broaden support or certify manufacturing tolerance or historical identity.

## Example: an explicit square sketch and prism

The focused facade tests do not execute this modeling example. It composes the
existing typed providers; geometry behavior is still governed by their checks.

```ts
import { cad, type XYAffineSketchDocumentV0 } from '@barocss/cad';

const { affineXY } = cad.sketch;
const { prismXY, convex } = cad.solid;
const document: XYAffineSketchDocumentV0 = {
  format: 'barocss-xy-affine-sketch', version: 0,
  profile: 'exact-affine-binary64', id: 'square', lengthUnit: 'mm',
  points: [
    { id: 'a', position: [0, 0] }, { id: 'b', position: [8, 0] },
    { id: 'c', position: [8, 8] }, { id: 'd', position: [0, 8] },
  ],
  segments: [
    { id: 'ab', startPointId: 'a', endPointId: 'b' },
    { id: 'bc', startPointId: 'b', endPointId: 'c' },
    { id: 'cd', startPointId: 'c', endPointId: 'd' },
    { id: 'da', startPointId: 'd', endPointId: 'a' },
  ],
  referenceLines: [],
  constraints: [
    { id: 'fix_a', kind: 'fixed', pointId: 'a', target: [0, 0] },
    { id: 'fix_b', kind: 'fixed', pointId: 'b', target: [8, 0] },
    { id: 'fix_c', kind: 'fixed', pointId: 'c', target: [8, 8] },
    { id: 'fix_d', kind: 'fixed', pointId: 'd', target: [0, 8] },
  ],
};
const sketch = affineXY.build(document);
const prism = prismXY.build(sketch, {
  sourceId: 'square_source', sourceRevision: 0,
  orderedSegmentIds: ['ab', 'bc', 'cd', 'da'], heightMM: 4,
  capChart: { originXY: [0, 0], spanXY: [8, 8] },
  solidId: 'square_solid', resultIdPrefix: 'square',
});
const properties = convex.mass(prism.solid, {
  densityKgPerM3: 1000, maximumFanTriangles: 40,
});
// The existing validators reconstruct their complete results; they are not free.
convex.validateMass(properties);
```

The example makes every authored input explicit. The facade does not insert
source IDs, select edges, choose charts or supply a default density.

## Documents and errors

Keep the two document families separate. `sourceV1.create` accepts an authored
`CadDocumentV1`; `prismV1.evaluate` accepts an authored
`XYAffinePrismFeatureDocumentV1`. Both `parse` functions return their original
**evaluated result**, while `serialize` takes the original **authored document**,
not a derived result or mesh. `prismV1.update` retains the existing atomic edit
request and returns the original result/transaction record. Use
`prismV1.validateUpdate` for that complete update record.

Catch the original exported error classes, such as `XYAffineSketchError`,
`XYAffineSketchPrismError`, `ConvexPlanarSolidChamferError`, `CadDocumentError`
and `XYAffinePrismFeatureError`. The facade does not catch or relabel them:
original codes, stages, causes and diagnostics remain available. In particular,
`affineXY.solve` still returns diagnostic data on failure; it has not been made
into a throwing `build` alias.

## Complete alias map

| Concise path (after `cad.`) | Existing export |
| --- | --- |
| `sketch.affineXY.solve` | `solveXYAffineSketch` |
| `sketch.affineXY.build` | `buildXYAffineSketch` |
| `sketch.affineXY.validate` | `validateXYAffineSketch` |
| `solid.prismXY.build` | `buildXYAffineSketchPrism` |
| `solid.prismXY.validate` | `validateXYAffineSketchPrism` |
| `solid.prismXY.wall` | `resolveXYAffineSketchPrismWall` |
| `solid.convex.split` | `splitConvexPlanarSolid` |
| `solid.convex.intersect` | `intersectConvexPlanarSolids` |
| `solid.convex.subtractSlab` | `subtractConvexPlanarSlab` |
| `solid.convex.chamferCardinal` | `chamferConvexPlanarSolid` |
| `solid.convex.mass` | `measureConvexPlanarSolidMass` |
| `solid.convex.validate` | `validateConvexPlanarSolid` |
| `solid.convex.validateSplit` | `validateConvexPlanarSolidSplit` |
| `solid.convex.validateIntersection` | `validateConvexPlanarSolidIntersection` |
| `solid.convex.validateSlab` | `validateConvexPlanarSlabSubtraction` |
| `solid.convex.validateChamfer` | `validateConvexPlanarSolidChamfer` |
| `solid.convex.validateMass` | `validateConvexPlanarSolidMass` |
| `document.sourceV1.create` | `createCadDocument` |
| `document.sourceV1.parse` | `parseCadDocument` |
| `document.sourceV1.serialize` | `serializeCadDocument` |
| `document.sourceV1.validate` | `validateCadDocumentResult` |
| `document.prismV1.evaluate` | `evaluateXYAffinePrismFeatureDocumentV1` |
| `document.prismV1.update` | `updateXYAffinePrismFeatureDocumentV1` |
| `document.prismV1.parse` | `parseXYAffinePrismFeatureDocumentV1` |
| `document.prismV1.serialize` | `serializeXYAffinePrismFeatureDocumentV1` |
| `document.prismV1.validate` | `validateXYAffinePrismFeatureDocumentV1` |
| `document.prismV1.validateUpdate` | `validateXYAffinePrismFeatureDocumentUpdateV1` |

Use the matching operation validator for a derived result. For example,
`convex.validateSlab(result)` validates the entire subtraction operation;
`convex.validate(result)` expects a single qualified Solid instead.

## Compatibility check

After the existing package build, run:

```sh
node --test packages/barocss-cad/test/public-api.test.mjs
```

The focused test checks all 27 function identities and all nine frozen namespace
records without invoking a geometry operation. It can also check a separately
bundled source barrel by setting `CAD_PUBLIC_API_TEST_MODULE` to that module's
absolute path. Function identity proves aliases use the same implementation;
it does not constitute a new geometry, renderer, browser or file-UI test.
