# Edit section sources and regenerate a NURBS loft

A source loft graph keeps complete authored CAD source, section-edit recipes and an ordered loft dependency together. Changing a section regenerates its dependent loft while retaining unaffected section results. Suppression removes the evaluated loft without deleting its recipe.

This page describes graph version 0 in experimental `@barocss/cad` provider `7e96b959`. The earlier `5f5ad866` provider used by the general reference and existing geometry playground does not include this graph API. Source inputs use the existing source0 language; this graph adds no new `@model` declaration or automatic renderer.

## Keep authored source and derived geometry separate

The graph contains three `source-curve-edit` nodes and one `piecewise-rational-loft` node. Each section identifies its node, source namespace and Curve ID. A node can edit its original complete source or depend on an earlier edit in the same source namespace.

The original mixed source below contains three degree-5 Curves and an unrelated Surface. Each selected Curve has six poles, the same original U basis over `[0,2]`, and its own positive weights. The unrelated Surface remains in the original and complete source-edit results.

The loft is a **new construction Model** containing the three selected section Curves and a new Surface. It does not silently include the unrelated Surface or replace the original mixed source.

## Create the complete graph

Use a CAD build containing the graph API. Development source entries require a TypeScript-capable bundler; built ESM entries provide compiled JavaScript.

```ts
import {
  evaluateNurbsSourceLoftFeatureGraph,
  updateNurbsSourceLoftFeatureGraph,
  validateNurbsSourceLoftFeatureGraph,
  validateNurbsSourceLoftFeatureGraphUpdate,
  serializeNurbsSourceLoftFeatureGraph,
  parseNurbsSourceLoftFeatureGraph,
  evaluateSurface,
} from '@barocss/cad';
import type {
  NurbsSourceLoftFeatureGraphV0,
  NurbsSourceLoftFeatureGraphOptions,
} from '@barocss/cad';

const originalSource = `@model authored_mixed_model {
  version: 0;
  length-unit: mm;
  @curve #section_first {
    type: nurbs; degree: 5;
    knots: [-0,-0,-0,-0,-0,-0,2,2,2,2,2,2];
    control-points: [[-0,-0,-0],[2,1,0],[4,-1,1],[6,2,1],[8,1,2],[10,0,2]];
    weights: [1,2,1,3,1,2];
  }
  /* This Surface is unrelated to the loft. */
  @surface #unrelated_original_surface {
    type: nurbs; degree-u: 1; degree-v: 1;
    knots-u: [-2,-2,3,3]; knots-v: [0,0,1,1];
    control-points: [[[-0,0,7],[-0,2,7]],[[4,0,7],[4,2,7]]];
    weights: [[1,1],[1,1]];
  }
  @curve #section_middle {
    type: nurbs; degree: 5;
    knots: [-0,-0,-0,-0,-0,-0,2,2,2,2,2,2];
    control-points: [[0,4,1],[2,5,1],[4,3,2],[6,6,2],[8,5,3],[10,4,3]];
    weights: [2,1,4,2,3,1];
  }
  @curve #section_last {
    type: nurbs; degree: 5;
    knots: [-0,-0,-0,-0,-0,-0,2,2,2,2,2,2];
    control-points: [[0,8,2],[2,9,2],[4,7,3],[6,10,3],[8,9,4],[10,8,4]];
    weights: [1,3,2,1,2,4];
  }
}`;

const options: NurbsSourceLoftFeatureGraphOptions = {
  maximumSources: 3,
  maximumSourceEdits: 3,
  maximumFeatureEvaluations: 4,
  maximumLoftSections: 3,
};

const graph: NurbsSourceLoftFeatureGraphV0 = {
  format: 'barocss-nurbs-source-loft-feature-graph',
  version: 0,
  id: 'section_graph',
  revision: 0,
  lengthUnit: 'mm',
  sourceFrame: 'authored-xyz-no-axis-conversion',
  sources: [{ sourceId: 'source_main', sourceVersion: 0, source: originalSource }],
  nodes: [
    {
      id: 'edit_first', kind: 'source-curve-edit',
      input: { sourceId: 'source_main', previousNodeId: null },
      curveId: 'section_first',
      edits: { poleEdits: [{ index: 0, yMM: -0 }] },
    },
    {
      id: 'edit_middle', kind: 'source-curve-edit',
      input: { sourceId: 'source_main', previousNodeId: null },
      curveId: 'section_middle',
      edits: { poleEdits: [{ index: 0, yMM: 4 }] },
    },
    {
      id: 'edit_last', kind: 'source-curve-edit',
      input: { sourceId: 'source_main', previousNodeId: null },
      curveId: 'section_last',
      edits: { poleEdits: [{ index: 0, yMM: 8 }] },
    },
    {
      id: 'loft_feature', kind: 'piecewise-rational-loft',
      outputSourceId: 'source_generated_loft',
      sections: [
        { nodeId: 'edit_first', sourceId: 'source_main', curveId: 'section_first' },
        { nodeId: 'edit_middle', sourceId: 'source_main', curveId: 'section_middle' },
        { nodeId: 'edit_last', sourceId: 'source_main', curveId: 'section_last' },
      ],
      parametersV: [2,4,8],
      suppressed: false,
      options: {
        surfaceId: 'generated_loft_surface',
        modelName: 'generated_loft_model',
        maximumSections: 15,
        maximumUPoles: 16,
        maximumPointObservations: 87,
        maximumDerivativeObservations: 87,
      },
    },
  ],
};

const initial = evaluateNurbsSourceLoftFeatureGraph(graph, options);
const initialReport = validateNurbsSourceLoftFeatureGraph(initial);
console.log(initialReport.loftStatus); // active
```

Each initial edit supplies one existing scalar value. Those recipes preserve the selected geometry while establishing the three edit nodes. Empty pole-edit recipes are not admitted.

The graph budgets are exactly `3/3/4/3`. Its loft node retains the constructor's separate fixed budgets `15/16/87/87`; those values do not expand this graph beyond three sections.

## Edit the middle pole and its weight

The middle Curve's pole at index 2 is `[4,3,2]` mm with weight 4. Replace Z with 3 mm and weight with 4.5:

```ts
const changed = updateNurbsSourceLoftFeatureGraph(initial, {
  expectedRevision: 0,
  revision: 1,
  nodeEdits: [{
    nodeId: 'edit_middle',
    edits: { poleEdits: [{ index: 2, zMM: 3, weight: 4.5 }] },
  }],
  loftSuppressed: null,
});
const edited = changed.result;
const transaction = validateNurbsSourceLoftFeatureGraphUpdate(changed);
console.log(transaction.affectedSourceEditNodeIds); // ['edit_middle']
console.log(transaction.reusedSourceEditNodeIds); // ['edit_first','edit_last']
console.log(transaction.loftAction); // rebuilt

if (initial.loft.evaluation && edited.loft.evaluation) {
  console.log(evaluateSurface(initial.loft.evaluation.surface, 1, 4));
  console.log(evaluateSurface(edited.loft.evaluation.surface, 1, 4));
}
```

For this unchained graph, the selective phase evaluates one source edit and one loft. The first and last complete edit results are reused as copied data. Prior-result validation can reconstruct the whole graph; selective counts do not describe all validation work or a performance guarantee.

`nodeEdits` replaces the targeted node's complete edit recipe. It does not append changes to its previous recipe. `loftSuppressed:null` retains the current suppression state. A successful update returns `{result,transaction}`; use `result` as the new accepted graph.

![Numeric X/Z projection of the middle section before and after the pole and weight edit](/examples/nurbs-loft-graph.svg)

The image plots 41 actual numeric samples at V=4 across original U `[0,2]`, projected into X/Z millimetres. It is a sampled section projection, not a rendered loft surface or a smoothness certificate. At U=1/V=4, the native center changes approximately:

| State | XYZ in mm, rounded for reading |
| --- | --- |
| Before | `[5.0602,4.2410,2.1084]` |
| After | `[5.0000,4.1705,2.6136]` |

The public evaluation calls print the returned numbers without this table's rounding. A weight change affects rational influence as well as position.

## Preserve parameter and namespace meaning

The sections must have exactly the same U degree, pole count, knots and original domain bits. This example uses degree 5, six poles and U `[0,2]`. The original weights can differ between sections.

V stations are explicit, finite and strictly increasing in caller order. This example uses `[2,4,8]`; the API does not sort or normalize them. At a station, the Surface matches its corresponding rational section. Between stations, interpolation is homogeneous rational blending. It is generally not the arithmetic average of the section points when their rational denominators differ.

The loft has degree V=1 with a C0 interior station at V=4. Point evaluation there is valid; a native D1 query can refuse at that exact C0 knot. This construction provides no G1/G2 or smooth-loft guarantee.

A section reference includes `nodeId`, `sourceId` and `curveId`. All three must match the actual edit node. The three used Curve IDs and new Surface ID must be distinct. Different source namespaces can retain equal unused object/Model names; selected IDs are not silently renamed.

With `previousNodeId:null`, each edit reads its original complete source. A predecessor links source edits only within the same root source namespace. In a chain, changing a middle edit also affects downstream source-edit nodes. Unrelated source objects and untouched text remain in the retained complete source results.

## Suppress and resume the loft

```ts
const suppressed = updateNurbsSourceLoftFeatureGraph(edited, {
  expectedRevision: 1, revision: 2,
  nodeEdits: [], loftSuppressed: true,
}).result;
console.log(suppressed.loft.status); // suppressed
console.log(suppressed.loft.evaluation); // null

const resumed = updateNurbsSourceLoftFeatureGraph(suppressed, {
  expectedRevision: 2, revision: 3,
  nodeEdits: [], loftSuppressed: false,
}).result;
console.log(resumed.loft.status); // active
```

Suppression retains the original sources and authored loft recipe while exposing no evaluated loft geometry. You can edit a section while suppressed: the affected source edit is evaluated, and the loft remains null until resumed. Resume uses the current edited sections and rebuilds the loft.

An update requires `expectedRevision` to equal the accepted revision and `revision` to equal that value plus one. A semantic no-op can still advance the revision and refresh bindings. An empty update with no node edits and `loftSuppressed:null` refuses.

## Save authored intent and open it again

```ts
const authoredText = serializeNurbsSourceLoftFeatureGraph(resumed.document, options);
// Your application stores authoredText.
const reopened = parseNurbsSourceLoftFeatureGraph(authoredText, options);
console.log(reopened.document.revision); // 3
console.log(reopened.loft.status); // active
```

Serialization accepts the authored document and options. It validates them and writes only the current authored graph: complete source text, current recipes, references, revision and suppression. It preserves numeric negative zero. Your application owns file or storage operations.

Parsing uses strict authored JSON, then reevaluates the sources and loft. It returns a new `NurbsSourceLoftFeatureGraphResult`; it does not trust saved meshes, reports or operation history. Keep the fixed graph options with the application because they are supplied separately on Open.

`validateNurbsSourceLoftFeatureGraph` checks a whole evaluated result. `validateNurbsSourceLoftFeatureGraphUpdate` checks both the next result and its transaction against the preceding authored document/options/edits. These validators return copied reports. They are different from opening an authored graph.

The new loft's construction source is also different from this authored graph. Saving only that generated Model loses the original mixed-source context, edit dependencies and suppression recipe. For consuming evaluated loft data, read [Loft graph ingestion](../cad-interop/loft-graph-ingestion).

## Public API signatures

```ts
evaluateNurbsSourceLoftFeatureGraph(document: NurbsSourceLoftFeatureGraphV0,
  options: NurbsSourceLoftFeatureGraphOptions): NurbsSourceLoftFeatureGraphResult
updateNurbsSourceLoftFeatureGraph(previous: NurbsSourceLoftFeatureGraphResult,
  edits: NurbsSourceLoftFeatureGraphEdits): NurbsSourceLoftFeatureGraphUpdateResult
validateNurbsSourceLoftFeatureGraph(result: NurbsSourceLoftFeatureGraphResult): NurbsSourceLoftFeatureGraphReport
validateNurbsSourceLoftFeatureGraphUpdate(update: NurbsSourceLoftFeatureGraphUpdateResult): NurbsSourceLoftFeatureGraphTransactionReport
serializeNurbsSourceLoftFeatureGraph(document: NurbsSourceLoftFeatureGraphV0,
  options: NurbsSourceLoftFeatureGraphOptions): string
parseNurbsSourceLoftFeatureGraph(text: string,
  options: NurbsSourceLoftFeatureGraphOptions): NurbsSourceLoftFeatureGraphResult
```

The root also exports the eight named graph/document/options/edits/result/report/transaction types, `NurbsSourceLoftFeatureGraphError` and `NurbsSourceLoftFeatureGraphDiagnosticCode`.

## Errors, copies and limits

Failed or stale updates preserve the prior accepted graph, complete sources and evaluated results. Adopt `update.result` only after success. Public results own independent copied CPU data; unchanged results are copied without sharing caller or prior-result objects.

| Code | Refused boundary |
| --- | --- |
| `INPUT`, `VERSION`, `IDENTITY`, `REVISION` | Data shape, version, IDs or revision request |
| `REFERENCE`, `DEPENDENCY` | Section binding, missing/wrong-source predecessor or cycle |
| `BASIS`, `STATIONS` | Incompatible original U basis or invalid V stations |
| `BUDGET`, `REPRESENTABILITY`, `SOURCE`, `NATIVE` | Resource limits, represented data, source compilation or native operation |
| `CODEC`, `OWNED` | Authored JSON or evaluated-result/update reconstruction |

Error messages are bounded to 1024 characters and retain actual causes when wrapped. Coordinates use mm; weights and original U/V parameters are dimensionless. Native coordinates remain within ±1e6 mm and weights within 1e-6..1e6.

| Resource | Bound |
| --- | --- |
| Complete original sources | 1..3; aggregate 262144 UTF-16 units and UTF-8 bytes |
| Nodes / ordered loft sections | Exactly three source edits plus one loft / three sections |
| Selected Curve degree / poles | 1..5 / 2..16 |
| Objects per native Model | 16; derived loft Model contains three sections and one Surface |
| Revision | Integer 0..1000000000, excluding negative zero |
| Pole edits per recipe / requested scalars | 1..64 / at most 256 |
| Aggregate wrapper pole edits / scalars | 192 / 768 |
| Authored graph text | 1048576 UTF-16 units and UTF-8 bytes |
| Complete evaluated graph/update | 2097152 UTF-16 units and UTF-8 bytes |
| Own values / depth / arrays / record fields | 1048576 / 64 / 8192 / 64 |
| IDs | ASCII 1..48 characters |

The complete-source writer's wider pole admission does not enlarge this loft wrapper's 16-pole profile. Use dense plain own data; accessors, cycles, hidden/symbol fields and foreign prototypes refuse. The graph creates native geometry, not persistent topology, a Body/Solid, an editor display or a renderer. Global numerical/manufacturing and smoothness qualifications remain separate.

[CAD API](./api) · [Geometry examples](./examples) · [Model language](./language) · [Loft graph ingestion](../cad-interop/loft-graph-ingestion)
