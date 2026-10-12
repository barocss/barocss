# Concise CAD API

Import the additive `cad` namespace from `@barocss/cad`, then destructure the
profile you need. The original named exports remain available and unchanged.

```ts
import { cad } from '@barocss/cad';

const { affineXY } = cad.sketch;
const { prismXY, convex } = cad.solid;
const { sourceV1, prismV1, prismV2 } = cad.document;
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
- `document.prismV2`: `XYAffinePrismFeatureDocumentV2`, the explicit serial-part
  profile with exactly six nodes: two sketches, two coordinate-span prisms, a
  through-slab subtraction and a chamfer of its **second component**. Both
  prisms require `chartPolicy: { version: 1, kind: 'coordinate-span' }`, with
  authored `capChart`. The chamfer follows qualified original-face/use lineage
  into that component. Cardinal supports, orthogonal ends, local setback,
  representability, ownership and work-budget restrictions still apply.
  Generated component-edge identities are output-only; this is not a generic
  feature graph or a persistent-topology-naming guarantee.

**Choose v2 explicitly for the serial part.** A v1 document remains v1, including
its original-parent sibling chamfer. `prismV2` does not migrate old documents or
accept a chart-only variant of v2; changing just the version number is not a
migration. Use the matching namespace for evaluation, updates and saved files.

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

## Example: an explicit serial-part v2 document

This complete fixture uses the authored geometry and original-prism references
from the [accepted serial-part campaign](../../examples/cad-nurbs/xy-affine-prism-serial-part-demo.mjs).
The documentation check typechecks this code without evaluating geometry.
The [existing v2 verification](../../examples/cad-nurbs/xy-affine-prism-serial-part-verification.json)
remains the native modeling evidence; adding these aliases does not repeat it.

```ts
import {
  cad, type XYAffineSketchDocumentV0, type XYAffinePrismFeatureDocumentV2,
} from '@barocss/cad';

const { prismV2 } = cad.document; // Explicit v2 mode, never an implicit v1 upgrade.
function fixedSketch(id: string, positions: [number, number][]): XYAffineSketchDocumentV0 {
  return {
    format: 'barocss-xy-affine-sketch', version: 0,
    profile: 'exact-affine-binary64', id, lengthUnit: 'mm',
    points: positions.map((position, i) => ({ id: `p${i}`, position })),
    segments: positions.map((_, i) => ({
      id: `s${i}`, startPointId: `p${i}`, endPointId: `p${(i + 1) % positions.length}`,
    })),
    referenceLines: [],
    constraints: positions.map((target, i) => ({
      id: `fix_p${i}`, kind: 'fixed', pointId: `p${i}`, target,
    })),
  };
}
const document: XYAffinePrismFeatureDocumentV2 = {
  format: 'barocss-xy-affine-prism-feature-document', version: 2,
  id: 'part_document', revision: 0, lengthUnit: 'mm',
  nodes: [
    {
      id: 'aa_sketch_node', kind: 'sketch', sourceId: 'aa_source', revision: 0,
      document: fixedSketch('aa_sketch', [[-0, 0], [32, 0], [32, 16], [16, 32], [0, 32]]),
    },
    {
      id: 'bb_sketch_node', kind: 'sketch', sourceId: 'bb_source', revision: 0,
      document: fixedSketch('bb_sketch', [[8, -16], [16, -16], [16, 48], [8, 48]]),
    },
    {
      id: 'aa_prism_node', kind: 'prism', sketchNodeId: 'aa_sketch_node',
      options: {
        orderedSegmentIds: ['s0', 's1', 's2', 's3', 's4'], heightMM: 8,
        capChart: { originXY: [0, 0], spanXY: [32, 32] },
        chartPolicy: { version: 1, kind: 'coordinate-span' },
        solidId: 'aa_solid', resultIdPrefix: 'aa',
      },
    },
    {
      id: 'bb_prism_node', kind: 'prism', sketchNodeId: 'bb_sketch_node',
      options: {
        orderedSegmentIds: ['s0', 's1', 's2', 's3'], heightMM: 8,
        capChart: { originXY: [0, -16], spanXY: [32, 64] },
        chartPolicy: { version: 1, kind: 'coordinate-span' },
        solidId: 'bb_solid', resultIdPrefix: 'bb',
      },
    },
    {
      id: 'subtraction_feature', kind: 'subtraction', operationId: 'remove_slab',
      parentPrismId: 'aa_prism_node', toolPrismId: 'bb_prism_node',
      first: {
        reference: { sourceId: 'bb_source', sketchId: 'bb_sketch', sourceRevision: 0, segmentId: 's3' },
        solidId: 'left_part', resultIdPrefix: 'left',
      },
      second: {
        reference: { sourceId: 'bb_source', sketchId: 'bb_sketch', sourceRevision: 0, segmentId: 's1' },
        solidId: 'right_part', resultIdPrefix: 'right',
      },
    },
    {
      id: 'front_detail', kind: 'chamfer', distanceMM: 1,
      parent: {
        kind: 'subtraction-component', subtractionNodeId: 'subtraction_feature',
        componentRole: 'second', solidId: 'right_part',
      },
      reference: {
        sourceId: 'aa_source', sketchId: 'aa_sketch', sourceRevision: 0, segmentId: 's0', role: 'top',
        // These complete references belong to this fixture's original prism.
        // Do not guess a derived component edge ID or select one by array index.
        a: {
          sourceId: 'aa_t', faceId: 'aa_t_f', surfaceId: 'aa_t_s', loopId: 'aa_t_l',
          useId: 'aa_t_use_0', curveId: 's0', pcurveId: 'aa_t_uv_0',
        },
        b: {
          sourceId: 'aa_w_0', faceId: 'aa_w_0_f', surfaceId: 'aa_w_0_s', loopId: 'aa_w_0_l',
          useId: 'aa_w_0_use_2', curveId: 'aa_w_0_c_2', pcurveId: 'aa_w_0_uv_2',
        },
      },
      options: {
        operationId: 'front_chamfer', resultIdPrefix: 'ch',
        retainedSolidId: 'detailed_part', removedSolidId: 'front_wedge',
      },
    },
  ],
  parameters: [
    {
      id: 'setback', unit: 'mm', valueMM: 1,
      bindings: [{ kind: 'chamfer-distance', chamferNodeId: 'front_detail' }],
    },
  ],
};
const initial = prismV2.evaluate(document);
prismV2.validate(initial); // Reconstructs the complete result.
const edit = prismV2.update(initial, {
  expectedRevision: initial.document.revision, revision: initial.document.revision + 1,
  parameterEdits: [{ parameterId: 'setback', valueMM: 2 }],
});
prismV2.validateUpdate(edit); // Validates the complete transaction, including prior state.
const text = prismV2.serialize(edit.result.document); // Authored state, not the result.
const reopened = prismV2.parse(text); // Cold evaluation; never a JSON-only parse.
const retained = reopened.chamfer.split.negative;
if (retained.kind !== 'solid') throw new Error('Expected the retained serial-part component');
const finishedComponent = retained.solid;
const otherComponent = reopened.subtraction.first;
// reopened.subtraction.second is the selected component BEFORE its chamfer.
```

The fixture exposes only the setback parameter; all other geometry is explicitly
fixed. `finishedComponent` is the chamfered selected part, while the first slab
component remains separate. The API does not combine them into an assembly.

## Documents and errors

Keep the source document and versioned feature-document profiles separate. `sourceV1.create` accepts an authored
`CadDocumentV1`; `prismV1.evaluate` accepts an authored
`XYAffinePrismFeatureDocumentV1`; `prismV2.evaluate` accepts an authored
`XYAffinePrismFeatureDocumentV2`. All three `parse` functions return their original
**evaluated result**, while `serialize` takes the original **authored document**,
not a derived result or mesh. `prismV1.update` retains the existing atomic edit
request and returns the original result/transaction record. Use
`prismV1.validateUpdate` for that complete update record. The corresponding
`prismV2.update` and `prismV2.validateUpdate` use the original v2 result and
transaction types. Updates fully validate the prior result before selective
rebuilds; a same-value edit still incurs that validation. Failed updates preserve
the original request and result. The facade does not add a faster validation path.

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
| `document.prismV2.evaluate` | `evaluateXYAffinePrismFeatureDocumentV2` |
| `document.prismV2.update` | `updateXYAffinePrismFeatureDocumentV2` |
| `document.prismV2.parse` | `parseXYAffinePrismFeatureDocumentV2` |
| `document.prismV2.serialize` | `serializeXYAffinePrismFeatureDocumentV2` |
| `document.prismV2.validate` | `validateXYAffinePrismFeatureDocumentV2` |
| `document.prismV2.validateUpdate` | `validateXYAffinePrismFeatureDocumentUpdateV2` |

Use the matching operation validator for a derived result. For example,
`convex.validateSlab(result)` validates the entire subtraction operation;
`convex.validate(result)` expects a single qualified Solid instead.

## Compatibility check

After the existing package build, run:

```sh
node --test packages/barocss-cad/test/public-api.test.mjs
node packages/barocss-cad/test/public-api-types.mjs
```

The focused test checks all 33 function identities and all ten frozen namespace
records without invoking a geometry operation. It can also check a separately
bundled source barrel by setting `CAD_PUBLIC_API_TEST_MODULE` to that module's
absolute path. Function identity proves aliases use the same implementation;
it does not constitute a new geometry, renderer, browser or file-UI test.

The separate typecheck extracts every TypeScript example above and checks the
original parameter/result types, readonly aliases and v1/v2 incompatibility.
It emits no code and executes no modeling operations. Set `CAD_PUBLIC_API_TYPES_ENTRY`
to an emitted `dist/index.d.ts` to check the same examples against built declarations;
`REPO_DEPS_ROOT` optionally selects an existing dependency installation.
