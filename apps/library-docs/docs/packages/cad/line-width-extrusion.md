# Give an original Line a width, then extrude its Face

Build a centered rectangular Face from one selected Line in a complete source0 model. Then extrude that Face along +Z. Width changes Y; extrusion distance changes Z. Keep the original Curve and every unrelated object available for later edits.

This guide uses public `@barocss/cad` APIs at the separate experimental source profile `fd0def8e1a2c55ecfa66daf5116347c37185ba4b`, version `0.0.0-experimental`. These operations are not part of the older `5f5ad866205a21510ac69552e704cc162fa253b5` examples. A TypeScript-capable consumer must resolve the matching public source entry. Package configuration does not establish registry publication.

For a dependent width/height recipe with suppression and authored Save/Open, follow [the separate Line-width extrusion graph guide](./line-width-extrusion-graph). Its newer graph provider composes these complete producers; this direct example's original source and API calls remain unchanged.

## Follow the two construction steps

`buildSourceLineWidthFace(request)` accepts complete original source0 text, a selected Curve ID, a width in mm and explicit generated IDs. It compiles the whole source, retains the whole original Model and creates two centered section Curves. Their compatible ruled Surface supplies the four natural boundary Curves for a native convex planar Face.

`extrudeConvexPlanarFace(width.face, options)` takes the complete Face result from that first step. Pass `width.face`, not the whole width result or a selected Surface. It validates the complete parent, constructs four ruled walls and six native Faces, then joins their twelve qualified boundary pairs into a closed abstract Shell.

The selected Line runs from `[0,-0,0]` to `[100,0,0]` mm. Width 5 mm places its sections at Y = −2.5 and +2.5 mm, without editing the original source. Distance 10 mm places the top at Z = 10 mm. Changing only distance to 12 mm leaves the parent Face and its 5 mm width unchanged.

## Complete public TypeScript example

Place this module in a TypeScript-capable application that resolves the matching `@barocss/cad` public entry. It requires no browser canvas. The application function below composes public operations; it is not an additional package API.

The original source includes an unrelated rational Curve and weighted Surface. Keep the whole input. Its CRLF line endings, comment, numeric spellings and signed-zero text are intentional. Source0 permits these literal Curve/Surface declarations; it does not express the derived Face topology or Shell in new language declarations.

```ts
import {
  buildSourceLineWidthFace, extrudeConvexPlanarFace,
  validateConvexPlanarFaceExtrusion, ConvexPlanarFaceExtrusionError,
} from '@barocss/cad';
import type {
  SourceLineWidthFaceRequest, ConvexPlanarFaceExtrusionOptions,
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

export const widthRequest: SourceLineWidthFaceRequest = {
  source: originalSource, sourceVersion: 0, curveId: 'original_line', widthMM: 5,
  options: {
    lowerCurveId: 'width_lower', upperCurveId: 'width_upper',
    surfaceId: 'width_surface', loopId: 'width_loop',
    boundaryCurveIds: ['width_b0', 'width_b1', 'width_b2', 'width_b3'],
    face: { faceId: 'width_face', evaluationId: 'width_evaluation',
      resultIdPrefix: 'width_result', orientation: 'forward' },
  },
};
export const extrusionOptions: ConvexPlanarFaceExtrusionOptions = {
  evaluationId: 'direct_prism_shell', resultIdPrefix: 'dpx',
  distanceMM: 10, direction: 'positive-z',
};

/** Complete public application composition; the input Face is not a wrapper cast. */
export function makeLineWidthShell(
  request: SourceLineWidthFaceRequest,
  options: ConvexPlanarFaceExtrusionOptions,
) {
  const width = buildSourceLineWidthFace(request);
  const extrusion = extrudeConvexPlanarFace(width.face, options);
  return { width, extrusion };
}

const initial = makeLineWidthShell(widthRequest, extrusionOptions);
const height12 = extrudeConvexPlanarFace(initial.width.face, {
  ...extrusionOptions, distanceMM: 12,
});
console.log(initial.width.originalModel.objects.map(object => object.id));
// ['untouched_curve', 'original_line', 'untouched_surface']
console.log(initial.width.report.widthIntent.lowerYMM,
  initial.width.report.widthIntent.upperYMM); // -2.5, 2.5
console.log(initial.extrusion.report.boundsMM);
// {min:[0,-2.5,0], max:[100,2.5,10]}
console.log(height12.report.boundsMM);
// {min:[0,-2.5,0], max:[100,2.5,12]}
console.log(height12.shell.assets.length, height12.shell.pairs.length); // 6, 12
console.log(validateConvexPlanarFaceExtrusion(height12).quality.solid); // false

// Application-owned accepted state: assignment happens only after success.
let accepted = height12;
try {
  const candidate = extrudeConvexPlanarFace(initial.width.face, {
    ...extrusionOptions, distanceMM: 0,
  });
  accepted = candidate;
} catch (error) {
  if (!(error instanceof ConvexPlanarFaceExtrusionError)) throw error;
  console.log(error.code); // DISTANCE
}
console.log(accepted === height12); // true
```

All lengths passed as API numbers are mm. The first step's request has exactly five fields. Its options have six fields and a nested four-field Face option record. The second step's options have exactly four fields. Do not add UI metadata to those records. Keep application metadata separately.

`evaluationId` in the direct options becomes the Shell ID. `resultIdPrefix` reserves its generated geometry, topology, asset and pair namespaces. For example, `dpx_src_0` identifies the bottom asset and `dpx_src_1` the top asset. The required generated roles must be distinct from reserved parent roles. A Model name is not an object ID reservation.

## Read source-qualified geometry

The width result has three complete source contexts. An ID alone cannot identify a member across them.

| Context | Source and native Model | Contents |
| --- | --- | --- |
| Original | `width.request.source`, `width.originalModel` | The selected Line and both unrelated objects |
| Ruled | `width.ruled.source`, `width.ruled.model` | Lower Curve, upper Curve and support Surface |
| Face | `width.face.source`, `width.face.model` | The same support coefficients and four natural boundary Curves |

Here the original Model name and generated support Surface ID are both `width_surface`. This is an allowed alias across different roles. The ruled Model name is also `width_surface`; the Face Model name is `width_evaluation`. Use `width.bindings.sources` and each reference's context, Model name and object index to resolve the actual retained member. Do not merge these Models or rename the original Curve to make their IDs appear global.

Canonical boundary order is `v-min`, `u-max`, `v-max`, `u-min`. `width.bindings.boundaries` records each boundary's World Curve, topological Edge, UV pcurve, Use, traversal index, sense and interval. A canonical boundary index is not necessarily its traversal rank. UV values are dimensionless; World XYZ values are mm.

The direct result keeps its complete parent under `direct.request.face`. Each of its four `walls` retains both section Curves, its Surface and its own source/Model. `direct.shell.assets` contains six complete source-qualified Face assets: bottom, top and four walls. Each asset has its own `sourceId`, source text and `face.geometry` Model. The six Face Models may share the name `parametric_face`; use the asset's `sourceId` and the references in `direct.bindings.assets` to distinguish them.

The bottom chart transposes the parent's U/V directions to produce the outward bottom Face. The top retains the parent chart and adds the positive Z distance. Each wall uses the original boundary parameter as U and extrusion interpolation as V. These mappings are construction data, not an axis conversion or a modification of original coefficients.

## Interpret the result

| Quantity | Distance 10 mm | Distance 12 mm |
| --- | --- | --- |
| Bounds minimum | `[0,-2.5,0]` mm | `[0,-2.5,0]` mm |
| Bounds maximum | `[100,2.5,10]` mm | `[100,2.5,12]` mm |
| Translation | `[0,0,10]` mm | `[0,0,12]` mm |
| Axis-product diagnostic | 5000 mm³ | 6000 mm³ |
| Face assets / qualified pairs | 6 / 12 | 6 / 12 |
| Vertex classes / shared Edges / Faces | 8 / 12 / 6 | 8 / 12 / 6 |

The axis-product diagnostic is `100 × 5 × distance`. Its field is named `report.diagnostics.volumeMM3`, but its authority is explicitly `axis-range-product-diagnostic-not-volume-certificate`. Do not present 5000 or 6000 as a certified native Solid volume.

The Shell has 8 vertex links, 24 corner arcs and no global free boundaries. Its accepted flags are `closed:true`, `orientedClosedIncidence:true` and `abstractIncidenceManifold:true`. These establish the qualified abstract incidence structure. They do not establish embedding, self-intersection freedom, inside/outside classification or a Solid. The direct report retains `solid:false`, `geometricValidity:'not-certified'` and `volumeCertified:false`.

The six assets are genuine native Face results with complete geometry and topology. They are not a display mesh or six selected-only summaries. A rendered picture, graphics adapter, CAD editor operation or manufacturing tolerance is outside this example.

## Preserve accepted state on refusal

Both builders are synchronous CPU operations. They return independent copied data, including retained parent occurrences and reports. Returned arrays and records are mutable; they are not deeply frozen. Mutating one output does not edit its caller's input or another independent construction. No GPU resource or explicit `dispose()` is involved; release application references when the data is no longer needed.

Build the complete candidate in local variables. Assign it to accepted application state only after every required operation and validation succeeds. A thrown error supplies no partial construction to adopt. The package does not manage accepted state, undo history or file replacement for the caller.

`validateSourceLineWidthFace` reconstructs the complete width family from its retained request and compares the whole result. `validateConvexPlanarFaceExtrusion` does the same for the complete direct result. They return copied reports. A changed source, parent coefficient, binding, asset, pair proof or report can cause `OWNED`; passing only selected geometry cannot substitute for the complete owned result.

## Bounds and refusal codes

Width and distance each require a finite value in `[1e-6,10000]` mm. This interval is a first admission rule, not a promise that every combination succeeds. Native coefficient limits, exact represented offsets, full-data budgets and child-provider limits still apply.

| Rule | Bound or supported shape |
| --- | --- |
| Selected Line | Degree 1; two poles; knots `[0,0,1,1]`; weights `[1,1]`; Y/Z numerically 0; natural +X span at least `1e-6` mm |
| Width placement | Centered Y offsets; represented width must equal the requested width |
| Direct parent | Forward natural XY rectangle at Z = 0; degree 1 in U/V, two poles per axis, unit weights, domains `[0,1]`, and four full natural boundary Curves |
| Direct direction | Exactly `'positive-z'`; translated coefficients and actual offsets must satisfy the bounded profile |
| Selected / derived coordinates | Absolute coefficient value at most 10000 mm |
| Original Model | Complete 1..16 objects; unrelated objects remain subject to source0 validation |
| Each source | At most 262144 UTF-16 units and 262144 UTF-8 bytes |
| Width request / result | At most 1,048,576 / 2,097,152 UTF-16 code units and UTF-8 bytes, counted separately over the full serialized data |
| Direct request / result | At most 2,097,152 / 4,194,304 UTF-16 code units and UTF-8 bytes, counted separately over the full serialized data |
| IDs | Supported ASCII identifier syntax; 48 characters maximum; width Face prefix at most 20, direct root prefix at most 5 |
| Own-data envelope | Acyclic plain records and dense arrays; finite numbers; no getters, symbols or hidden fields; bounded depth, values and array sizes |

Reverse Face orientation, arbitrary frames, negative directions, holes, trimmed boundary substitutes and general Curve offsets are unsupported by this direct profile. The wider convex Face API's accepted inputs do not automatically become accepted extrusion inputs. No geometry repair, endpoint welding or silent reversal broadens this profile.

| Failure | Relevant code |
| --- | --- |
| Wrong record shape or unsupported own data | `INPUT` |
| Width source version other than numeric positive zero, `sourceVersion:0` | `VERSION` |
| Missing selected Curve | `TARGET` |
| Invalid original source | Width `SOURCE`, with compilation cause |
| Width outside the finite range | `WIDTH` |
| Distance outside the finite range | `DISTANCE` |
| Unsupported Line, Face chart, orientation or direction | `PROFILE` |
| Duplicate or reserved generated IDs | `IDENTITY` |
| Offsets or translated coefficients fail represented-value rules | `REPRESENTABILITY` |
| Complete data exceeds bounded work or envelope sizes | `BUDGET` or `FILE` |
| Child construction refuses | Width `RULED`, `BOUNDARY` or `FACE`; direct `PARENT`, `RULED`, `FACE`, `SOURCE` or `SHELL`, with cause |
| Complete result disagrees with reconstruction | `OWNED` |

Read the public error's `code`, `message` and `cause`. A zero width or zero distance is a genuine refusal, not an instruction to collapse geometry. Keep the last accepted source and complete results available for correction.

## Keep the complete native context

<a :href="withBase('/examples/cad-line-width-shell.json')" download>Download the complete Line-width and Shell context</a>. It retains the original mixed source and Model, authored width intent, complete width construction, final 12 mm direct request/result and their separate generated sources. It is native example data, not a universal CAD document format or a certified Solid file.

The application container has `format:'barocss-docs-line-width-extrusion-context'`, `version:0` and the fixed `sourceProfile`, followed by `widthResult`, `extrusionRequest`, `extrusionResult` and `heightComparison`. The complete direct result uses the 12 mm distance. `heightComparison` contains separate readouts for 10 and 12 mm; those readouts do not replace either complete construction. These container fields are application conventions, not a package file schema.

Keep the original source text as text, including its `-0` spelling. In-memory copies preserve numeric signed zeros. Ordinary `JSON.stringify` changes numeric `-0` to `0`; retaining source text does not recover signed bits lost from separate numeric fields. The supplied context uses a signed-zero-preserving JSON representation. Parsing that JSON preserves numeric `-0`, but a later ordinary JSON rewrite can lose it. No custom signed-zero serializer is supplied by these four public construction/validation functions.

For a height edit, retain the width result and rebuild the direct result with the new distance. For a width edit, rebuild the width result from the complete original source, then build the direct result from the new `face`. Revalidate complete stored families when adopting them; do not reuse an old report as authority for changed geometry.

Read [source0/1/2 language rules](./language) for the original input, [the bounded rectangle Solid example](./guides#build-a-bounded-rectangle-extrusion) for its different certification domain, and [complete Body data](./body-1301) for the separate qualified Body workflow.

<script setup>
import { withBase } from 'vitepress'
</script>
