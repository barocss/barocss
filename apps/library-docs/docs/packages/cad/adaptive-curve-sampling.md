# Change display sampling without changing the Curve

[Open CAD adaptive sampling](/examples/library#cad-adaptive-sampling) to edit a complete sampling request. Keep the weighted degree-5 Curve fixed and change only `chordToleranceMM` from .05 to .2. The [playground link](/playground#cad-adaptive-sampling) opens the same example.

![Coarse adaptive display with orange native control polygon, cyan returned points and original parameter distribution](/examples/cad-adaptive-sampling.jpg)

The actual browser image uses criterion `.2 mm`, with 14 accepted segments and 15 returned points. Orange marks the original poles/control polygon; cyan marks the returned display polyline. The lower axis shows original parameters `[-3,5]`. This is application 2D canvas drawing from CPU results, not a GPU frame or a native edge representation.

This guide uses experimental `@barocss/cad` version `0.0.0-experimental` at fixed source profile `733428030029a65797c26e3daadcae94c4762b09`. The public operations are `sampleSourceCurveAdaptive` and `validateSourceCurveAdaptive`. Use a matching TypeScript-capable consumer. Source availability is separate from the selected execution results and package publication.

The public API returns CPU data synchronously. The interactive application runs that same calculation in an application-owned Worker, then draws its returned points in a 2D canvas polyline; it allocates no BaroCSS GPU renderer and makes no shader-frame claim. The display has no new native Curve, edge, topology or Solid.

## Complete request and original source

Paste this whole JSON request into the example:

```json
{
  "source": "/* 설계 π: retain the complete source and both unrelated objects. */\r\n@model adaptive_display { version: 0; length-unit: mm;\r\n  @curve #weighted_quintic { type: nurbs; degree: 5;\r\n    knots: [-3,-3,-3,-3,-3,-3,-1,2,5,5,5,5,5,5];\r\n    control-points: [[0,1,0],[2,-2,.25],[4,3,1],[6,-4,2.25],[8,5,4],[10,-6,6.25],[12,7,9],[14,-8,12.25]];\r\n    weights: [1,3,1,3,1,3,1,3]; }\r\n  @curve #keep_line { type: nurbs; degree: 1; knots: [-1.000,-1,1,1.00];\r\n    control-points: [[-0,-4,0],[10,-4,0]]; weights: [1,1]; }\r\n  @surface #keep_plane { type: nurbs; degree-u: 1; degree-v: 1;\r\n    knots-u: [0.000,0,1,1.00]; knots-v: [-1,-1,2,2];\r\n    control-points: [[[2,3,-0],[2,5,1]],[[4,3,2],[4,5,4]]]; weights: [[1,2],[3,4]]; }\r\n  /* Keep Ω, CRLF and the original native XYZ coordinates. */\r\n}\r\n",
  "sourceVersion": 0,
  "curveId": "weighted_quintic",
  "options": {
    "chordToleranceMM": 0.05,
    "maxSegments": 128,
    "maxDepth": 12,
    "resultIdPrefix": "display"
  }
}
```

The nested `source` retains CRLF, Unicode comments and the complete three-object Model. `weighted_quintic` is the selected Curve. `keep_line` and `keep_plane` are unrelated native geometry and remain part of the owned original Model. Their numeric −0 coefficients are not discarded by selecting only the first Curve.

The selected Curve has eight poles, degree 5 and positive weights alternating 1 and 3. Its original parameter domain is `[-3,5]`, with positive spans `[-3,-1]`, `[-1,2]` and `[2,5]`. Parameter values have no length unit; poles and evaluated XYZ are in millimetres. Do not replace original parameters with normalized 0..1 values.

The JSON here is the application's text entry for a public sampling request. It is not a new CAD source dialect or a universal editable CAD document codec. JSON decoding produces the complete original Source0 string before public compilation.

## Compare a finer and coarser polyline

Choose **Finer display · 0.05 mm**, then **Coarser display · 0.2 mm**. Each action changes only the request's chord criterion and submits the complete candidate again. Wait until the busy state clears and the accepted report updates before selecting another action. It leaves the original source, Model, poles, knots, weights and sibling objects unchanged.

A looser criterion can accept larger parameter intervals, so its display can use fewer points. That is not a change to the native geometry. Inspect the actual returned `segmentCount`, `pointCount`, samples and interval domains; do not assume a universal count or ratio from the two tolerance values.

The Worker uses the same fixed provider, complete request, native kernel and admission limits. Structured cloning transports the request and complete result, preserving native numeric −0. It changes where the calculation runs, not the sampling criterion or native geometry. The direct public example below remains a synchronous consumer; the live host awaits its Worker result before staging and adopting a drawing.

The application projects original XYZ with `x + .4*z` and `y + .6*z`, then fits that projection to its canvas using the original control hull. The same projection and fit compare both requests. It keeps the original XYZ in the result. This oblique drawing is not a coordinate rewrite or a new view-dependent sampling criterion.

### Actual CPU results for this request

| Chord criterion | Segments / points | Maximum depth | Control-polygon estimate, mm | Observed chord distance, mm | Direct D0 / D1 attempts |
| --- | --- | --- | --- | --- | --- |
| .05 mm | 27 / 28 | 5 | .047021244656175534 | .03862478233125731 | 292 / 162 |
| .2 mm | 14 / 15 | 4 | .17408931003948655 | .1435515472246603 | 149 / 84 |

Both reports returned maximum arithmetic uncertainty `1.9895196601282805e-13` mm. The original complete three-object Model, source, selected Curve and sibling −0 values remained intact. Copy isolation and a precision-preserving physical result write/read also passed. These are CPU data observations; they do not establish a browser frame.

The selected flow additionally validated one complete accepted result and refused a tampered complete result as `OWNED`. Each whole-validator reconstruction is extra work. The direct counts above describe only their respective successful sampling call. Invalid tolerance and insufficient work budget supplied `INPUT` and `BUDGET` refusals while the accepted result remained intact.

### Actual Worker browser observation

The recorded Worker flow returned 27 segments and 28 points at .05 mm, then 14 segments and 15 points at .2 mm. Source, selected Curve, complete original Model and projection remained unchanged; both native sibling −0 witnesses were retained.

Tolerance 0 and `maxSegments:2` relayed genuine `INPUT` and `BUDGET` diagnostics and retained the accepted displayed report exactly. One Reset restored the .05 mm request and later reached ready with 27 segments and 28 points. The Worker calculation left the UI responsive while the result was pending. Worker replies carry copied result data and diagnostic fields; they do not change the synchronous public API's contract.

These observations apply to this Worker host and selected inputs. They do not turn earlier synchronous readiness or input-dispatch timeouts into successful deadline checks, or establish that reducing the report alone resolved those delays.

## Complete public CPU consumer

```ts
import {
  sampleSourceCurveAdaptive, validateSourceCurveAdaptive,
  SourceCurveAdaptiveSamplingError,
} from '@barocss/cad';
import type { SourceCurveAdaptiveSamplingRequest } from '@barocss/cad';

export const source = [
  "/* 설계 π: retain the complete source and both unrelated objects. */",
  "@model adaptive_display { version: 0; length-unit: mm;",
  "  @curve #weighted_quintic { type: nurbs; degree: 5;",
  "    knots: [-3,-3,-3,-3,-3,-3,-1,2,5,5,5,5,5,5];",
  "    control-points: [[0,1,0],[2,-2,.25],[4,3,1],[6,-4,2.25],[8,5,4],[10,-6,6.25],[12,7,9],[14,-8,12.25]];",
  "    weights: [1,3,1,3,1,3,1,3]; }",
  "  @curve #keep_line { type: nurbs; degree: 1; knots: [-1.000,-1,1,1.00];",
  "    control-points: [[-0,-4,0],[10,-4,0]]; weights: [1,1]; }",
  "  @surface #keep_plane { type: nurbs; degree-u: 1; degree-v: 1;",
  "    knots-u: [0.000,0,1,1.00]; knots-v: [-1,-1,2,2];",
  "    control-points: [[[2,3,-0],[2,5,1]],[[4,3,2],[4,5,4]]]; weights: [[1,2],[3,4]]; }",
  "  /* Keep Ω, CRLF and the original native XYZ coordinates. */",
  "}",
].join('\r\n') + '\r\n';

export const request: SourceCurveAdaptiveSamplingRequest = {
  source, sourceVersion: 0, curveId: 'weighted_quintic',
  options: {
    chordToleranceMM: .05, maxSegments: 128, maxDepth: 12,
    resultIdPrefix: 'display',
  },
};
export function inspectSampling(input: SourceCurveAdaptiveSamplingRequest) {
  const result = sampleSourceCurveAdaptive(input);
  const validationReport = validateSourceCurveAdaptive(result);
  return { result, validationReport };
}

const fine = inspectSampling(request);
const coarse = inspectSampling({
  ...request, options: { ...request.options, chordToleranceMM: .2 },
});
console.log(fine.result.domain, coarse.result.domain);
console.log(fine.result.samples.map(sample => ({
  parameter: sample.parameter, pointMM: sample.pointMM,
})));

let accepted = fine.result;
try {
  const candidate = sampleSourceCurveAdaptive({
    ...request, options: { ...request.options, chordToleranceMM: 0 },
  });
  accepted = candidate;
} catch (error) {
  if (!(error instanceof SourceCurveAdaptiveSamplingError)) throw error;
  console.log(error.code); // INPUT: the chord criterion must be positive and bounded.
}
console.log(accepted === fine.result); // The refused call supplied no replacement.
```

The result retains the complete `request`, `originalModel`, selected native `curve`, original `domain`, ordered `samples`, per-span `spans`, actual subdivision `operations` and `report`. A polyline alone cannot replace that whole source-qualified result. The displayed report is a selected summary: it includes the original Model, selected Curve, returned samples, complete sampling report and counts of span/subdivision records. The host retains the full accepted result, including all span and operation data, separately. The UI summary cannot replace that complete value for whole-result validation.

Each sample includes its original parameter, evaluated `pointMM`, neighboring segment IDs and original span indices. `atOriginalKnot` and `originalD1Guarded` retain native knot meaning. These generated IDs identify sampled output records; they do not become native topological Vertices or persistent editor handles.

`validateSourceCurveAdaptive` reconstructs the whole operation from its retained request and compares the complete result. It returns a new independent report. A modified point, original Model, operation or count can therefore refuse as `OWNED`. Validating only the displayed points would not check the original source association or delegated receipts.

## Read the chord criterion

The sampler extracts each positive original knot span into local rational Bézier coefficients. It reuses homogeneous subdivision to create smaller intervals as needed. Its output samples are evaluated on the original native Curve at the accepted interval endpoints.

For each candidate interval, it estimates the maximum distance of its local control polygon to the finite chord between original native endpoint evaluations. It adds an arithmetic uncertainty margin scaled by the coefficient and endpoint magnitudes. The interval is accepted only when this sum is within `chordToleranceMM`. A decision too close to the arithmetic uncertainty refuses as `REPRESENTABILITY`, rather than inventing a successful threshold comparison.

Positive rational weights support the control-hull reasoning, but the implementation's binary64 work remains qualified. Read `maximumControlPolygonBoundMM`, `maximumArithmeticUncertaintyMM` and the local point/derivative observations separately. The report declares `globalErrorCertified:false`, `globalBinary64ErrorCertified:false`, `manufacturingToleranceCertified:false` and `topologyCertified:false`. The supplied criterion is not a certified manufacturing tolerance, global error bound or native fitting operation.

## Preserve native derivative guards and count scopes

Each accepted leaf retains three observations with original/local points and D1 states. D1 is a derivative in millimetres per original parameter, not a unit tangent. Local extracted span endpoints use their native one-sided derivative behavior. An actual original C0 guard remains a native refusal state with its reason; it is not repaired to a zero derivative. Other native evaluation failures can refuse the operation.

`report.directCounts` describes one sampling call's original-source compilation, extraction invocations, subdivision helpers, visited intervals, splits, D0/D1 attempts and accepted output records. `delegatedReceipts` separately exposes extraction and coefficient-source reconstruction work. These counters are not a total runtime benchmark.

The public validator cold-reconstructs the operation again. Its work is additional to the returned producer report. The application draws returned points without treating its canvas operations as native evaluations. Keep producer counters, validator work and application drawing separate.

## Copy ownership and refusal retention

Returned CPU records are independent copied data, not live handles or deeply frozen renderer bindings. Changing a caller's request after a call does not edit an earlier result. Changing a copied sibling Model does not change another independently returned result. Keep the full result for validation and source association.

The original source string preserves numeric spelling, including −0. Original native sibling coefficients retain their numeric bits. Ordinary JSON serialization can erase numeric −0 in result arrays; storing an observation that way does not make it the native authority. The public request's nested source string preserves its spelling when the application encodes the request as JSON.

Adopt only after the complete public sampling call succeeds. A refused tolerance, budget or source input supplies no partial result to draw. The application should prepare the candidate drawing before replacing the accepted polyline and report. Release result references when finished; these public CPU operations have no renderer resource or `dispose()` method. The interactive host separately terminates its owned Worker on disposal and invalidates pending replies. A reply from an old or disposed session must not adopt a drawing. Worker termination releases an application resource; it does not add a native sampler lifecycle API.

## Limits and error boundaries

| Resource | Bound |
| --- | --- |
| Input | Complete literal Source0; at most 16 original Model objects |
| Selected Curve | Degree 1..5; at most 64 poles, 70 knots and 63 positive spans |
| Native coefficients | Coordinate magnitude at most 10000 mm; weights `1e-6..1e6` |
| Chord criterion | Finite `1e-7..1000` mm |
| Requested work | `maxSegments` 1..4096; `maxDepth` 0..16 |
| Output/work | At most 4097 points and 4095 subdivision operations |
| Local coefficients | At most 6 poles; temporary subdivision at most 11 poles and 17 knots |
| Original source | At most 262144 UTF-16 units and UTF-8 bytes |
| Complete request/result | 1MiB request; 16MiB result, measured in UTF-16 units and UTF-8 bytes |
| Own data | 4,194,304 values, depth 64, dense arrays up to 32768 entries, 64 record fields |
| Native attempts | At most 45055 D0 attempts and 24576 D1 attempts |

`INPUT` covers malformed request/options and invalid tolerance. `SOURCE` retains a complete-source compiler refusal. `REFERENCE` identifies a missing selected original Curve; `IDENTITY` handles invalid IDs or result prefixes. `SPAN`, `REPRESENTABILITY`, `BUDGET`, `NATIVE` and `BINDING` retain their actual stage meaning. `FILE` reports envelope/measurement refusal; the full-result validator reports failed ownership reconstruction as `OWNED`. Do not infer a valid coarse polyline from a budget failure.

[CAD guides](./guides) · [Curve knot refinement](./curve-knot-insertion) · [Original-domain Curve language example](./language-examples#preserve-a-nonunit-curve-domain)
