# Edit and reopen a Line-width extrusion graph

Keep one original source0 asset, a literal width and a literal height as authored intent. Evaluate the width Face and its dependent +Z extrusion, then update only the affected construction. Suppress the extrusion without deleting its width Face, resume it, save the authored recipe and reopen it for another edit.

![CPU Face-corner projections through graph edits and suppression](/examples/cad-line-width-extrusion-graph.svg)

The four panels project actual returned degree-1 Surface corners with one common scale and projection: initial width 5 / height 10, updated width 8 / height 12, suppressed width Face only, and reopened then re-edited width 8 / height 14. This is a CPU native-data illustration, not a GPU frame, CAD editor view or geometric/Solid certificate.

This guide uses public `@barocss/cad` version `0.0.0-experimental` at the separate source profile `705ea16d17d23492900b92b3ff1e19e07125ef01`. Use a TypeScript-capable consumer resolving this matching public entry. The earlier [direct Line-width extrusion guide](./line-width-extrusion) keeps its `fd0def8e1a2c55ecfa66daf5116347c37185ba4b` APIs and complete source. Local availability does not establish registry publication.

## Complete source, document and options

This is the complete mixed source: one selected degree-1 Line, one unrelated rational Curve and one unrelated weighted Surface. The graph retains every object and the original text, including CRLF line endings, comments, numeric spellings and `-0` text. It does not substitute a selected-only model.

```ts
import {
  evaluateSourceLineWidthExtrusionGraph, updateSourceLineWidthExtrusionGraph,
  serializeSourceLineWidthExtrusionGraph, parseSourceLineWidthExtrusionGraph,
  SourceLineWidthExtrusionGraphError,
} from '@barocss/cad';
import type {
  SourceLineWidthExtrusionGraphV0, SourceLineWidthExtrusionGraphOptions,
} from '@barocss/cad';

export const originalSource = [
  '/* 설계: retain the complete original Model and unselected geometry. */',
  '@model width_surface { version: 0; length-unit: mm;',
  '  @curve #untouched_curve { type: nurbs; degree: 2;',
  '    knots: [-2.000,-2,-2,3,3,3]; control-points: [[-0,2,1],[3,4,2],[6,2,1]]; weights: [1,2,1]; }',
  '  @curve #original_line { type: nurbs; degree: 1;',
  '    knots: [0,0,1,1]; control-points: [[0,-0,0],[100,0,0]]; weights: [1,1]; }',
  '  @surface #untouched_surface { type: nurbs; degree-u: 1; degree-v: 1;',
  '    knots-u: [0.000,0,1,1.00]; knots-v: [-1,-1,2,2];',
  '    control-points: [[[2,3,-0],[2,5,1]],[[4,3,2],[4,5,4]]]; weights: [[1,2],[3,4]]; }',
  '}',
].join('\r\n') + '\r\n';

export const document: SourceLineWidthExtrusionGraphV0 = {
  format: 'barocss-source-line-width-extrusion-graph', version: 0,
  id: 'LineWidthGraph', revision: 0, lengthUnit: 'mm',
  sourceFrame: 'authored-xyz-no-axis-conversion',
  asset: { sourceId: 'LineSource', sourceVersion: 0, source: originalSource, curveId: 'original_line' },
  parameters: [
    { id: 'Width', kind: 'length', unit: 'mm', valueMM: 5 },
    { id: 'Height', kind: 'length', unit: 'mm', valueMM: 10 },
  ],
  nodes: [
    { id: 'WidthFeature', kind: 'source-line-width-face', sourceId: 'LineSource', widthParameterId: 'Width',
      options: { lowerCurveId: 'width_lower', upperCurveId: 'width_upper', surfaceId: 'width_surface',
        loopId: 'width_loop', boundaryCurveIds: ['width_b0','width_b1','width_b2','width_b3'],
        face: { faceId: 'width_face', evaluationId: 'width_evaluation', resultIdPrefix: 'width_result', orientation: 'forward' } } },
    { id: 'ExtrusionFeature', kind: 'convex-planar-face-extrusion', faceNodeId: 'WidthFeature',
      heightParameterId: 'Height', suppressed: false,
      options: { evaluationId: 'direct_prism_shell', resultIdPrefix: 'dpx', direction: 'positive-z' } },
  ],
};
export const options: SourceLineWidthExtrusionGraphOptions = {
  maximumFeatureNodes: 2, maximumWidthEvaluations: 1,
  maximumExtrusionEvaluations: 1, maximumProducerEvaluations: 2,
};
```

The document has exactly nine top-level fields. It contains one source asset, exactly two Parameters ordered `[width,height]`, and exactly two nodes ordered `[width,extrusion]`. Both Parameters use `kind:'length'`, `unit:'mm'` and a finite numeric `valueMM`. These literal values are not source2 expressions. There is no new CSS Face block, source3 dialect or general-purpose feature graph.

`WidthFeature` references `LineSource` and `Width`. `ExtrusionFeature` references `WidthFeature` and `Height`; it consumes the complete generated convex Face. All references must resolve the exact fixed roles. Graph, asset, Parameter and node IDs are distinct within their logical namespace. Generated geometry/topology roles have additional provider collision rules.

The four option values are the required fixed budgets `2/1/1/2`, not tunable limits for a larger graph. Supply them again on fresh Open. They are not part of the authored file.

## Evaluate, edit, suppress and resume

Use the declarations above with this continuation. Every update supplies the expected current revision and exactly the next revision. It returns a new current `result` plus a `transaction`; pass that `result` to the next update, not the entire update wrapper.

```ts
const initial=evaluateSourceLineWidthExtrusionGraph(document,options);
const height12=updateSourceLineWidthExtrusionGraph(initial,{
  expectedRevision:0,revision:1,
  parameterEdits:[{parameterId:'Height',valueMM:12}],extrusionSuppressed:null,
});
const width8=updateSourceLineWidthExtrusionGraph(height12.result,{
  expectedRevision:1,revision:2,
  parameterEdits:[{parameterId:'Width',valueMM:8}],extrusionSuppressed:null,
});
const suppressed=updateSourceLineWidthExtrusionGraph(width8.result,{
  expectedRevision:2,revision:3,
  parameterEdits:[],extrusionSuppressed:true,
});
const resumed=updateSourceLineWidthExtrusionGraph(suppressed.result,{
  expectedRevision:3,revision:4,
  parameterEdits:[],extrusionSuppressed:false,
});

const authoredText=serializeSourceLineWidthExtrusionGraph(
  resumed.result.document,resumed.result.options,
);
const reopened=parseSourceLineWidthExtrusionGraph(authoredText,options);
const height14=updateSourceLineWidthExtrusionGraph(reopened,{
  expectedRevision:4,revision:5,
  parameterEdits:[{parameterId:'Height',valueMM:14}],extrusionSuppressed:null,
});
console.log(initial.width.originalModel.objects.map(object=>object.id));
// ['untouched_curve','original_line','untouched_surface']
console.log(suppressed.result.extrusion); // null; width Face remains present.
console.log(height14.result.extrusion?.report.boundsMM);
// {min:[0,-4,0],max:[100,4,14]}, mm.
console.log(height12.transaction.report.directCounts);
// widthBuildCallCount:0, extrusionBuildCallCount:1, producerEvaluationCount:1.
```

An empty `parameterEdits` array changes no Parameter. `extrusionSuppressed:null` retains the previous suppression state; explicit `true` or `false` requests that state. At most two setters may name the existing Parameters, without duplicates. Updates cannot change the asset, source, node order, construction IDs or fixed options.

Suppression removes the current extrusion receipt and Shell from the result: `extrusion:null`, status `suppressed`, Shell ID null. The authored extrusion node, height intent and complete width Face remain. Resume constructs the extrusion from the current width Face and current height. It does not restore an archived native result or an operation-history snapshot.

| Stage | Revision | Width / height | Current bounds in mm | Axis-product diagnostic |
| --- | --- | --- | --- | --- |
| Initial | 0 | 5 / 10 | `[0,-2.5,0]` to `[100,2.5,10]` | 5000 mm³ |
| Height edit | 1 | 5 / 12 | `[0,-2.5,0]` to `[100,2.5,12]` | 6000 mm³ |
| Width edit | 2 | 8 / 12 | `[0,-4,0]` to `[100,4,12]` | 9600 mm³ |
| Suppressed | 3 | 8 / 12 | Width Face at Z = 0; no extrusion bounds | No current extrusion diagnostic |
| Resumed / reopened | 4 | 8 / 12 | `[0,-4,0]` to `[100,4,12]` | 9600 mm³ |
| Re-edit after Open | 5 | 8 / 14 | `[0,-4,0]` to `[100,4,14]` | 11200 mm³ |

Width changes the centered Y offsets; height changes +Z distance. The selected Line retains X = 0..100 and its original coefficients. The width Face's represented area is 500 mm² at width 5, then 800 mm² at width 8. Axis products are diagnostics, not certified native areas or Solid volumes.

## Read selective counts without hiding validation work

Every update first cold-reconstructs and checks the complete previous graph once. It then runs the affected constructors for the new state. These two phases are reported separately.

| Update | Selective width builds | Selective extrusion builds | Previous-state cold validation |
| --- | --- | --- | --- |
| Height 10→12 | 0 | 1 | Active previous graph: width 1, extrusion 1 |
| Width 5→8 | 1 | 1 | Active previous graph: width 1, extrusion 1 |
| Suppress extrusion | 0 | 0 | Active previous graph: width 1, extrusion 1 |
| Resume extrusion | 0 | 1 | Suppressed previous graph: width 1, extrusion 0 |
| Height 12→14 after Open | 0 | 1 | Active reopened graph: width 1, extrusion 1 |

Read `transaction.report.directCounts` for actual selective root calls. Read `validationCounts.directCounts` and `validationCounts.providers` for the prior cold-validation phase. `changedProviderCounts` describes newly executed producers and their child work. The current graph's `report.retainedProviderCounts` describes the complete retained producer receipts; it is not the update's selective-call count.

Thus “width retained” means its complete semantic values were carried into the returned state without a selective width build. It does not mean the whole update ran no width construction, and it does not preserve JavaScript object identity. Both retained and changed values are independently copied. A no-op still requires a new revision and prior cold validation, while its selective producer counts are zero.

These are bounded operation counts, not timing or performance claims. Root compilation/query counters do not include all descendant work; use the separately retained provider counters for their actual scope.

## Retain qualified native contexts and quality

`result.width` retains the complete original Model, the selected Curve, the ruled source/Model and the convex Face source/Model. `result.bindings.sources` distinguishes original, ruled and Face contexts by source field, Model field, actual Model name and source asset ID. The original Model name and generated support ID can both be `width_surface`; they are different qualified roles.

When active, `result.extrusion` contains the complete direct request, four wall constructions and six source-qualified native Face assets with twelve pair proofs. The Shell has 8 vertex classes, 12 Edges, 6 Faces and no global free boundaries. Its accepted flags describe closed oriented abstract incidence. They do not certify geometric embedding, self-intersection freedom, inside/outside classification or a Solid.

The graph retains `solid:false`, `geometricValidity:'not-certified'`, `embeddedManifoldCertified:false` and `volumeCertified:false`. In suppression state, `closedAbstractShellProduced` is false because no current Shell is present. Graph composition does not upgrade the producer's quality flags or establish renderer/editor acceptance, manufacturing tolerance or general persistent naming.

Outputs are mutable independent CPU copies, not deep-frozen live handles. Release references when no longer needed; there is no graph `dispose()` or GPU allocation. Source text, native Models, topology, graph intent and any illustration have separate roles.

## Save authored intent and reopen a fresh result

<a :href="withBase('/examples/cad-line-width-extrusion-graph.authored.json')" download>Download the authored Line-width extrusion graph</a>.

The file is the public codec's authored document, not a wrapper containing budgets or evaluated results. It contains source text, fixed feature recipes, literal Parameters, suppression state and current revision. It contains no generated Models, width/extrusion receipts, Shell proofs, transaction, undo history or app display state.

`serializeSourceLineWidthExtrusionGraph(document,options)` performs one complete graph evaluation for admission before returning canonical authored JSON with one final newline. It preserves the complete source string and supports literal numeric negative zero where the schema allows it. The current specimen's `-0` spellings are inside its source string. Do not replace this named codec with a JSON rewrite and assume identical signed-bit behavior.

`parseSourceLineWidthExtrusionGraph(text,options)` uses strict authored JSON admission, then evaluates the real current producers. It returns a full current graph result, not merely a decoded DTO. Supply the same fixed options explicitly; file revision 4 remains revision 4 until the next admitted update. A fresh result has independent copies and no reconstructed operation history.

In a browser application, save the public codec text as a physical file:

```ts
function downloadAuthored(text:string) {
  const url=URL.createObjectURL(new Blob([text],{type:'application/json'}));
  const link=globalThis.document.createElement('a');
  link.href=url;link.download='line-width-extrusion-graph.authored.json';
  globalThis.document.body.append(link);link.click();link.remove();
  // Caller cleanup after download dispatch, not a completion certificate.
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
downloadAuthored(authoredText);

async function openAuthored(file:File) {
  if (file.size>2_097_152) throw new Error('Authored graph file exceeds its UTF-8 bound');
  return parseSourceLineWidthExtrusionGraph(await file.text(),options);
}
// Pass a File from a real file input to openAuthored.
// Adopt its returned result only if the caller's Open operation is still current.
```

There is no canvas or renderer prerequisite for these synchronous native graph operations. File reading and download dispatch are caller operations. A host must prevent overlapping adoption or discard stale Open results. Keep its previously accepted complete result until fresh parse/evaluation succeeds. Reset the file input after capturing its selected File so the same file can be selected again.

## Validate the right complete shape

| Public operation | Input | Return |
| --- | --- | --- |
| `evaluateSourceLineWidthExtrusionGraph` | Authored document and explicit fixed options | Full current result |
| `updateSourceLineWidthExtrusionGraph` | Full previous result and exact edit record | `{result,transaction}` |
| `validateSourceLineWidthExtrusionGraph` | Complete current result | Copied graph report after full reconstruction |
| `validateSourceLineWidthExtrusionGraphUpdate` | Complete update wrapper | Copied transaction report after baseline reconstruction and selective replay |
| `serializeSourceLineWidthExtrusionGraph` | Authored document and explicit options | Authored JSON text |
| `parseSourceLineWidthExtrusionGraph` | Complete authored JSON text and explicit options | Fresh evaluated current result |

The current-result validator compares the complete document, options, native sources/Models/proofs, bindings, counts and sizes. The update validator also checks the nonrecursive authored baseline, exact edits, resulting state and selective transaction. A selected Face, report or summary cannot substitute for either full shape. The transaction stores `previousDocument`, options and edits rather than recursively embedding the previous native result.

## Refuse a candidate before replacing accepted state

```ts
let accepted=height14.result;
try {
  const candidate=updateSourceLineWidthExtrusionGraph(accepted,{
    expectedRevision:5,revision:6,
    parameterEdits:[{parameterId:'Width',valueMM:0}],extrusionSuppressed:null,
  });
  accepted=candidate.result;
} catch(error) {
  if (!(error instanceof SourceLineWidthExtrusionGraphError)) throw error;
  console.log(error.code,error.context.stage,error.context.nodeId,error.cause);
  // Width 0 is PARAMETER; accepted still contains the last complete result.
}
```

All graph operations either return the complete bounded result or throw; they do not return partial native data to adopt. The caller's assignment above occurs only after success. Errors expose `code`, `message`, a copied `context` with stage/graph/node/revision/direct counts, and an optional delegated cause.

| Failure | Code / scope |
| --- | --- |
| Wrong exact record, sparse/cyclic data, getters or unsupported own fields | `INPUT` |
| Wrong graph/source version | `VERSION`; version and sourceVersion require positive zero |
| Incorrect current/next revision | `REVISION`; next must equal previous + 1 |
| Width/height outside the finite mm range | `PARAMETER` |
| Unknown Parameter or incorrect fixed dependency/order/reference | `REFERENCE` |
| Duplicate setters or conflicting generated IDs | `IDENTITY` |
| Reverse Face, arbitrary direction or unsupported fixed feature profile | `PROFILE`, or a delegated producer cause |
| Original source refuses compilation | `SOURCE` |
| Width Face or direct extrusion construction refuses | `WIDTH` / `EXTRUSION`, with cause |
| Native receipt presence or qualified bindings disagree with the current recipe | `BINDING` |
| Changed complete owned result or transaction | `OWNED` |
| Malformed strict authored JSON, parser-bound refusal or invalid Unicode | `CODEC`, with the parser cause where applicable |
| Work/own-data or serialized envelope exceeds its bound | `BUDGET` / `FILE` |

Suppression does not bypass width construction, source validation or planned role-collision checks. All original unrelated geometry must remain valid. A height edit while suppressed updates the stored intent without a selective extrusion build; the eventual resume must still admit its full current request.

## Bounds remain fixed

| Limit | Bound |
| --- | --- |
| Structure | One asset, two Parameters, width/extrusion nodes only; fixed options `2/1/1/2` |
| Width / height | Finite literal mm values `[1e-6,10000]`, subject to unchanged producer coefficient/representability limits |
| Revision | Integer 0..1,000,000,000; every update advances exactly one |
| Original Model / source | At most 16 objects; source at most 262144 UTF-16 code units and UTF-8 bytes, counted separately |
| Authored document / request | At most 2,097,152 UTF-16 code units and UTF-8 bytes each |
| Current result / update wrapper | At most 8,388,608 / 16,777,216 UTF-16 code units and UTF-8 bytes each |
| Retained producer envelopes | Width request/result at most 1,048,576 / 2,097,152; extrusion request/result at most 2,097,152 / 4,194,304 UTF-16 code units and UTF-8 bytes each |
| IDs | Supported ASCII identifiers at most 48 characters; width Face prefix at most 20, extrusion prefix at most 5 |
| Runtime own data | Depth at most 64; dense arrays at most 8192 elements; records at most 64 fields; value budgets 2,097,152 or 4,194,304 for updates |
| Authored parser | Depth at most 12, 65,536 values, 16 fields per record, 64 elements per array, keys at most 128 characters and strings at most 262144 characters |

Parent Line/Face constraints remain the forward natural XY rectangle and positive-Z profile explained in [direct extrusion](./line-width-extrusion). No general frames, reversed inputs, holes, boolean operation, automatic pole substitution or tolerance repair is added by the graph.

[Direct Line-width extrusion](./line-width-extrusion) · [CAD guides](./guides) · [CAD examples](./examples) · [Language rules](./language)

<script setup>
import { withBase } from 'vitepress'
</script>
