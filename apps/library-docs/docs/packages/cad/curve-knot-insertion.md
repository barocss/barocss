# Refine a Curve without sculpting its shape

Insert a knot into an original rational Curve to change its coefficient representation while retaining its degree and original parameter domain. The control polygon changes; evaluated positions at the same parameters remain close. This is different from moving a pole or changing a weight to sculpt the Curve.

![CPU-evaluated illustration of original and refined Curves with different control polygons](/examples/cad-curve-knot-insertion.svg)

Both panels use the same XY view in mm, with Z = 0. Blue lines join 65 actual native evaluations per Curve; orange and purple show the original and refined control polygons. Insertion at U = 4.5 changes poles 3→4 and knots 6→7 while retaining degree 2 and domain `[2,7]`. The coincident sampled appearance is a CPU data illustration, not a GPU/editor view or global shape certificate.

This example uses public `insertSourceCurveKnot` and `validateSourceCurveKnotInsertion` from experimental `@barocss/cad` version `0.0.0-experimental`, source profile `705ea16d17d23492900b92b3ff1e19e07125ef01`. Use a TypeScript-capable consumer resolving that matching public entry. It inserts once in complete literal Source0; it does not add a source dialect, live gallery preset, editor operation or GPU renderer.

## Complete mixed source and public request

The selected `quarter` Curve is the second object in a three-object Model. Keep the complete source rather than extracting only its declaration. The source assembly below preserves CRLF, Unicode, comments and deliberate numeric spelling.

```ts
import {
  insertSourceCurveKnot, validateSourceCurveKnotInsertion, evaluateCurve, curveDomain,
  SourceCurveKnotInsertionError,
} from '@barocss/cad';
import type { SourceCurveKnotInsertionRequest } from '@barocss/cad';

export const originalSource = [
  '/* 설계 π: retain the complete mixed Model and original spelling. */',
  '@model quarter_refinement { version: 0; length-unit: mm;',
  '  @curve #keep_line { type: nurbs; degree: 1;',
  '    knots: [-1.000,-1,1,1.00]; control-points: [[-0,-4,0],[10,-4,0]]; weights: [1,1]; }',
  '  /* Insert inside the original quarter Curve domain, not normalized UV. */',
  '  @curve #quarter { type: nurbs; degree: 2;',
  '    knots: [2.000,2,2,7,7.0,7];',
  '    control-points: [[20.0,+0,0],[20,20.00,0],[0,20,0]];',
  '    weights: [1.0,0.7071067811865476,1]; }',
  '  @surface #keep_plane { type: nurbs; degree-u: 1; degree-v: 1;',
  '    knots-u: [0.000,0,1,1.00]; knots-v: [-1,-1,2,2];',
  '    control-points: [[[2,3,-0],[2,5,1]],[[4,3,2],[4,5,4]]]; weights: [[1,2],[3,4]]; }',
  '  /* Keep Ω, CRLF and both unrelated objects. */',
  '}',
].join('\r\n') + '\r\n';
export const request: SourceCurveKnotInsertionRequest = {
  source:originalSource,sourceVersion:0,curveId:'quarter',knot:4.5,maximumObservations:128,
};
/** Ordinary public source-backed refinement and complete result validation. */
export function refineQuarterCurve(input: SourceCurveKnotInsertionRequest) {
  const result = insertSourceCurveKnot(input);
  const validatedReport = validateSourceCurveKnotInsertion(result);
  return {result,validatedReport};
}

const {result,validatedReport}=refineQuarterCurve(request);
console.log(result.model.objects.map(object=>object.id));
// ['keep_line','quarter','keep_plane']; selectedObjectIndex is 1.
console.log(curveDomain(result.originalCurve),curveDomain(result.curve)); // [2,7], [2,7]
console.log(result.curve.knots); // [2,2,2,4.5,7,7,7]
console.log(evaluateCurve(result.curve,4.5));
// [14.142135623730951,14.142135623730951,0], mm.
console.log(validatedReport.poleCounts); // {original:3,refined:4}
```

The request has exactly five fields. `maximumObservations` must be the fixed value 128, not a request for 128 samples or a tunable plotting density. The knot is an original dimensionless parameter: 4.5 lies inside `[2,7]`. Passing normalized .5 would be outside this Curve's domain.

The result contains eight complete fields: `request`, candidate `source`, `originalModel`, candidate `model`, `originalCurve`, candidate `curve`, `provenance` and `report`. Both Models retain name `quarter_refinement`, native version 0, mm units and all three objects in order. The selected Curve keeps its ID and index. `keep_line` and `keep_plane` retain their native bits; the selected representation changes as requested.

## Compare coefficients with evaluated points

| Native property | Original | Refined |
| --- | --- | --- |
| Degree / domain | 2 / `[2,7]` | 2 / `[2,7]` |
| Poles / knots | 3 / 6 | 4 / 7 |
| Multiplicity at 4.5 | 0 | 1 |
| Knots | `[2,2,2,7,7,7]` | `[2,2,2,4.5,7,7,7]` |
| Parameter mapping | Original U | Identity `u=t`, D1 factor 1 |

The actual refined poles and weights are:

```text
poles, mm:
  [20,0,0]
  [20,8.284271247461902,0]
  [8.284271247461902,20,0]
  [0,20,0]
weights:
  [1,0.8535533905932737,0.8535533905932737,1]
```

The original control polygon has its interior corner at `[20,20,0]`. The refined polygon has two different interior poles closer to the Curve. Neither polygon is the sampled Curve. At U = 4.5, both evaluated positions are `[14.142135623730951,14.142135623730951,0]` mm. The inserted knot does not require a new control pole to lie at that point.

### Why weights must change with poles

Rational insertion blends homogeneous coefficients. Convert each pole `P=[x,y,z]` with weight `w` to `H=[w*x,w*y,w*z,w]`. At the midpoint insertion here, the two generated coefficients are `.5*H0+.5*H1` and `.5*H1+.5*H2`. Divide their XYZ components by their new weight to recover Cartesian poles.

Let the original middle weight be `w=.7071067811865476`. Each new interior weight is `(1+w)/2`. The new interior Cartesian coordinate is `20*w/(1+w)`, approximately 8.284271 mm. Averaging the unweighted XYZ poles would give 10 mm and a different rational representation. Poles and weights must be changed together.

In exact arithmetic, knot insertion represents the same mathematical Curve. This implementation emits and evaluates binary64 coefficients. Its local point/derivative observations qualify the returned operation within bounded comparison rules; they do not certify global binary64 or shape error.

## Read mappings and source patches

`provenance.unchangedPoles` maps original endpoint pole indices 0→0 and 2→3 with their weights unchanged. `unchangedKnots` maps the retained original knot occurrences around the inserted value. These are coefficient-index mappings, not new topological Vertices or persistent editor handles.

`steps` records the original span, prior multiplicity and generated-pole interpolation factors. `homogeneousSteps` retains the actual left/right/generated homogeneous coefficients. `parameterMap` is explicitly identity, so D1 comparisons use the same original parameter units rather than a normalized or rescaled derivative.

The producer recompiles the complete source and replaces only the selected `knots`, `control-points` and `weights` array-value spans. Each sorted patch contains an original-source `startUTF16`, exclusive `endUTF16`, `originalText` and `replacementText`. These offsets belong to `result.request.source`, not the longer candidate source. The example's original spans are `[395,414)`, `[437,472)` and `[488,514)`.

Use the returned `result.source` as the complete patched candidate. Do not reapply its original offsets directly to an already patched string. Outside those three array spans, the header, comments, whitespace, CRLF, unselected declarations and original spelling remain unchanged. Inside them, replacement decimal text represents the actual new coefficients; old text remains available in the patch records. Original source length 778 UTF-16 units / 784 UTF-8 bytes becomes 827 / 833 for this result.

The candidate Model is the complete original Model with only its selected Curve replaced. The public validator reconstructs the whole operation from the retained request and checks source, Models, coefficients, patches, observations, counts and sizes. A selected Curve or report cannot replace that full owned result.

## Separate producer observations from illustration samples

The producer observed native parameters `[2,3.25,4.5,5.75,7]`. Its direct report contains one original and one candidate compilation, one coefficient insertion, three patches, 23 decimal emissions, ten D0 calls and ten D1 attempts. All ten D1 attempts evaluated; there were no C0 refusals for this first simple degree-2 insertion.

The largest observed point difference was about `8.88e-16` mm; the largest relative derivative difference was about `1.90e-16`. Admission limits are `1e-7` mm and `1e-7`, respectively. These five observations are not a global error bound or a performance measurement.

The application can generate its separate fixed illustration grid with public evaluation:

```ts
const [a,b]=curveDomain(result.originalCurve);
const plotParameters=Array.from({length:65},(_,index)=>a+(b-a)*index/64);
const originalPointsMM=plotParameters.map(u=>evaluateCurve(result.originalCurve,u));
const refinedPointsMM=plotParameters.map(u=>evaluateCurve(result.curve,u));
// 65 original + 65 refined = 130 application D0 calls, separate from report.directCounts.
// These data points can be projected to common XY axes; no renderer is allocated here.
```

For the selected 65-station grid, the largest paired point difference was about `3.97e-15` mm. U = 4.5 is grid index 32. These samples supply a CPU data illustration, not a new native Curve, fitted topology, GPU frame or editor admission.

The `refineQuarterCurve` helper above also calls the validator, which cold-reconstructs the complete operation once. A later tampered-result validation performs its own reconstruction. The returned producer report describes one operation's direct wrapper work; it does not include all validation work, the application's 130 D0 calls, or every inherited compiler/helper call.

## Keep derivative guards distinct from shape observations

D0 evaluates a point. D1 returns point and a derivative in mm per original dimensionless parameter. The derivative is not a unit tangent or an arc-length parameterization. Endpoints use the existing interior one-sided rule.

At a guarded exact interior knot, the native D1 API can refuse when degree minus multiplicity is less than one. This wrapper records only that actual C0 refusal as `status:'refused-c0'`; it does not invent a zero derivative or repair the knot. Other native D1 errors refuse the operation. If either side refuses at a station, its relative derivative comparison is null.

Here degree 2 with inserted multiplicity 1 stays outside that C0 guard, so U = 4.5 has evaluated D1 on both sides. This does not certify G1/G2 continuity, regularity or every derivative query. Retain the actual D1 state, point observations and report quality separately.

## Reject a candidate without replacing accepted data

```ts
let accepted=result;
try {
  const candidate=insertSourceCurveKnot({...request,knot:2});
  accepted=candidate;
} catch(error) {
  if (!(error instanceof SourceCurveKnotInsertionError)) throw error;
  console.log(error.code); // REQUEST: endpoint insertion is outside the strict interior.
}
console.log(accepted===result); // true.

const tampered=structuredClone(result);
Reflect.set(tampered.report,'patchCount',2); // Deliberately corrupt a complete copied receipt.
try {validateSourceCurveKnotInsertion(tampered);}
catch(error) {
  if (!(error instanceof SourceCurveKnotInsertionError)) throw error;
  console.log(error.code); // OWNED: reconstruction does not match this full result.
}
```

Both are genuine selected refusals. The accepted result's reference and complete values remained intact. A thrown operation supplies no partial result to adopt. Caller inputs and independently returned records are copied; outputs are mutable CPU data rather than deep-frozen live handles. Altering a returned copy does not edit a separate original Model or another result. Release references when finished; these functions allocate no GPU resource and have no `dispose()` operation.

| Failure | Public code |
| --- | --- |
| Wrong exact request or non-plain/cyclic/sparse own data | `INPUT` |
| Source version other than 0 | `VERSION` |
| Missing or invalid selected Curve ID | `TARGET` / `IDENTITY` |
| Original or candidate source compilation refuses | `SOURCE`, with compiler cause |
| Nonfinite knot, endpoint/outside knot or excessive final interior multiplicity | `REQUEST` |
| Fixed observation, source or coefficient capacity exceeded | `BUDGET` |
| Unsafe span/midpoint arithmetic or decimal representation | `REPRESENTABILITY` |
| Source/native/patch binding or observed comparison disagrees | `BINDING` |
| Native point/derivative validation refuses outside the admitted C0 case | `NATIVE` |
| Complete result differs from request reconstruction | `OWNED` |
| Complete request/result serialized envelope exceeds its bound | `FILE` |

## Respect the source-qualified limits

| Resource | Bound |
| --- | --- |
| Dialect / Model | Complete literal Source0, at most 16 objects; unrelated geometry must also compile |
| Selected Curve | Degree 1..5; original poles at most 63 and knots at most 69, with normal degree/count rules |
| Candidate | Exactly one insertion; at most 64 poles and 70 knots |
| Knot | Finite strict interior parameter; final numeric multiplicity at most degree; existing numeric zero knots must agree with requested zero bits |
| Coefficients | Selected coordinate magnitude at most 10000 mm; positive weights `1e-6..1e6` |
| Source | Each original/candidate at most 262144 UTF-16 units and UTF-8 bytes, counted separately |
| Observation / patch limits | Fixed maximum 128 observations, three array patches, replacement decimal literal at most 512 characters |
| Request/result envelope | Each at most 2,097,152 UTF-16 units and UTF-8 bytes, including all retained occurrences |
| Own data | 1,048,576 values, depth 64, dense array length 8192, record fields 64, key length 128 and string length 262144 |

The source-qualified operation has its own admission profile. Its limits do not widen the older bare-Curve `insertCurveKnot` API or make Source2/3 function expressions admissible in this Source0 request. No Shape, Wire, Face, Shell or Solid is constructed. The report keeps `geometricValidity:'not-certified'`, `topologyCertified:false`, `solid:false` and `globalShapeErrorCertified:false`.

[CAD guides](./guides) · [CAD examples](./examples) · [Original-domain Curve example](./language-examples#preserve-a-nonunit-curve-domain)
