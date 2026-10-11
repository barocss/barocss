# Refine a Surface along one original parameter axis

Insert a U knot into a rational Surface to refine its coefficient grid while retaining its degrees and original U/V domains. The control net gains one U row; evaluated positions at the same parameters remain close. This is representation refinement, rather than moving poles to sculpt the Surface.

![CPU-evaluated Surface grids and complete original/refined control nets](/examples/cad-surface-knot-insertion.svg)

Blue lines use 153 actual native evaluations per Surface. Orange and purple show all original 3×2 and refined 4×2 coefficient poles. Both panels share one XYZ projection and scale, with coordinates in mm. U varies around the XY quarter profile; V varies along Z. The dark line marks U = 4.5. This is a CPU data illustration, not a GPU frame, CAD editor view or global shape certificate.

The public APIs are `insertSourceSurfaceKnot` and `validateSourceSurfaceKnotInsertion`, at experimental `@barocss/cad` version `0.0.0-experimental`, source profile `705ea16d17d23492900b92b3ff1e19e07125ef01`. Use a TypeScript-capable consumer resolving this matching entry. The operation accepts complete literal Source0; it adds no Source3 expression support, live preset, file workflow or renderer.

## Complete mixed source and public request

The selected `quarter_sheet` is object index 1 in the complete three-object Model. Retain the unrelated Curve and Surface, source header, CRLF, comments, Unicode and original numeric spelling.

```ts
import {
  insertSourceSurfaceKnot, validateSourceSurfaceKnotInsertion, evaluateSurface, surfaceDomain,
  SourceSurfaceKnotInsertionError,
} from '@barocss/cad';
import type { SourceSurfaceKnotInsertionRequest } from '@barocss/cad';

export const originalSource = [
  '/* 설계 π: preserve the complete mixed source and original domains. */',
  '@model sheet_refinement { version: 0; length-unit: mm;',
  '  @curve #keep_line { type: nurbs; degree: 1;',
  '    knots: [-1.000,-1,1,1.00]; control-points: [[-0,-4,0],[10,-4,0]]; weights: [1,1]; }',
  '  @surface #quarter_sheet { type: nurbs; degree-u: 2; degree-v: 1;',
  '    knots-u: [2.000,2,2,7,7.0,7]; knots-v: [-1,-1,3,3];',
  '    control-points: [[[20,0,0],[20,0,30]],[[20,20,0],[20,20,30]],[[0,20,0],[0,20,30]]];',
  '    weights: [[1,1],[0.7071067811865476,0.7071067811865476],[1,1]]; }',
  '  @surface #keep_plane { type: nurbs; degree-u: 1; degree-v: 1;',
  '    knots-u: [0.000,0,1,1.00]; knots-v: [-1,-1,2,2];',
  '    control-points: [[[2,3,-0],[2,5,1]],[[4,3,2],[4,5,4]]]; weights: [[1,2],[3,4]]; }',
  '  /* Keep Ω, CRLF and every nonselected field. */',
  '}',
].join('\r\n') + '\r\n';
export const request: SourceSurfaceKnotInsertionRequest = {
  source:originalSource,sourceVersion:0,surfaceId:'quarter_sheet',axis:'u',knot:4.5,maximumObservations:1024,
};
/** Ordinary public complete-source Surface refinement and whole validation. */
export function refineQuarterSheet(input: SourceSurfaceKnotInsertionRequest) {
  const result = insertSourceSurfaceKnot(input);
  const validatedReport = validateSourceSurfaceKnotInsertion(result);
  return {result,validatedReport};
}

const {result,validatedReport}=refineQuarterSheet(request);
console.log(result.model.objects.map(object=>object.id));
// ['keep_line','quarter_sheet','keep_plane']
console.log(surfaceDomain(result.surface)); // {u:[2,7],v:[-1,3]}
console.log(evaluateSurface(result.surface,4.5,1));
// [14.142135623730951,14.142135623730951,15], mm.
console.log(validatedReport.grids);
// original:{u:3,v:2,total:6}, refined:{u:4,v:2,total:8}
```

The request has exactly six fields. `axis` chooses `'u'` or `'v'`; this example selects U. `knot` is an original dimensionless parameter, not an XYZ coordinate or normalized UV. `maximumObservations` must be the fixed value 1024. It is an admission budget, not a request to return 1024 points or a plotting-density control.

The result has eight fields: retained `request`, complete candidate `source`, `originalModel`, candidate `model`, `originalSurface`, candidate `surface`, `provenance` and `report`. Both Models retain `sheet_refinement`, version 0, mm units, object order and IDs. The unrelated `keep_line` and `keep_plane` retain their native bits. The selected Surface remains at index 1 with its original ID.

## Distinguish U rows, V columns and sampled lines

The outer control-point index is U and the inner index is V. The original grid has three U rows and two V columns. Inserting U = 4.5 increases only the U pole count, producing four rows and two columns. Degree U = 2 and degree V = 1 remain unchanged.

| Property | Original | Refined |
| --- | --- | --- |
| U / V domains | `[2,7]` / `[-1,3]` | Same |
| Pole grid | 3×2, six poles | 4×2, eight poles |
| U knots | `[2,2,2,7,7,7]` | `[2,2,2,4.5,7,7,7]` |
| V knots | `[-1,-1,3,3]` | Same values and bits |
| Selected knot multiplicity | 0 | 1 |
| Parameter map | Original U/V | Identity `u=s;v=t`, both D1 factors 1 |

The producer refines one U coefficient Curve for each fixed V pole index: two strips here. These are coefficient strips, not arbitrary sampled V sections. In this clamped degree-1 V example, their endpoint columns correspond to the two boundary layers at Z = 0 and 30 mm.

The displayed evaluation grid is different: 17 U stations × 9 V stations gives 153 points per Surface. Nine plotted lines vary U at fixed V; seventeen vary V at fixed U. These sampled lines are not the control net or native topological Edges. A U row/column index is not itself a parameter value.

For this specific sheet, XY follows the rational quarter profile and Z is `30*(v+1)/4`. The unchanged original V domain therefore places V = 1 at Z = 15 mm. Domain units are dimensionless; XYZ remains mm. No axis normalization or coordinate-frame conversion is performed.

## Refine the rational coefficients together

Each strip uses homogeneous poles `H=[w*x,w*y,w*z,w]`. With the inserted knot halfway inside `[2,7]`, the two generated interior coefficients blend neighboring homogeneous poles with factor .5. Divide their XYZ components by the new weight to recover Cartesian poles. Unweighted XYZ averaging is not rational knot insertion.

With original middle weight `w=.7071067811865476`, each new interior weight is `(1+w)/2=.8535533905932737`. The interior XY coordinates become `[20,8.284271247461902]` and `[8.284271247461902,20]`. Each occurs at Z = 0 and 30 mm. Original end rows retain `[20,0]` and `[0,20]` with unit weights.

Thus the complete control net changes while the center at U/V = 4.5/1 remains `[14.142135623730951,14.142135623730951,15]` mm in both selected results. A new knot does not require a coefficient pole at that evaluated point.

In exact arithmetic, insertion represents the same mathematical Surface. The implementation produces binary64 coefficients and bounded local observations. Coincident samples at display precision do not establish a global binary64 or shape-error certificate.

## Read source patches and coefficient provenance

Only three selected array-value spans change: `knots-u`, `control-points` and `weights`. The V knot field, degrees, header, other source spans and unrelated declarations remain unchanged. The candidate source retains every original object rather than emitting a selected-only Surface model.

`provenance.patches` records sorted original UTF-16 offsets with exclusive ends, original text and replacement text. The positions refer to `result.request.source`, not the longer candidate string. Use the already complete `result.source`; do not apply old offsets again to it. Within replaced spans, decimal text represents actual candidate coefficients. Outside them, original spelling, comments and CRLF remain intact. This input grows from 807 UTF-16 units / 813 UTF-8 bytes to 928 / 934.

`unchangedPoles` maps retained U/V pole indices; `unchangedKnots` maps retained selected-axis knot occurrences. `strips` records each fixed V pole index, its original coefficient Curve and its homogeneous insertion calculation. These are data mappings, not persistent editor handles or new topology. The parameter map keeps both original axes and derivative units unchanged.

## Separate native observations, application sampling and validation

The producer's 15 observation pairs use U stations `[2,3.25,4.5,5.75,7]` and V stations `[-1,1,3]`. Its direct report counts two compilations, two coefficient-strip insertions, one inserted axis knot, three patches and 39 decimal emissions. It calls native Surface D0 thirty times and attempts Surface D1 thirty times, all evaluated in this selected operation.

The maximum observed point difference is about `8.88e-16` mm. Maximum relative Du difference is about `6.07e-16`, and relative Dv difference is 0. The admission thresholds are `1e-7` mm and `1e-7` for relative derivative comparison. These are local observations, not global tolerance certificates.

The application uses separate public queries for the illustration:

```ts
const plotSamples=Array.from({length:17},(_,uIndex)=>
  Array.from({length:9},(_,vIndex)=>{
    const u=2+5*uIndex/16,v=-1+4*vIndex/8;
    return {
      u,v,
      originalPointMM:evaluateSurface(result.originalSurface,u,v),
      refinedPointMM:evaluateSurface(result.surface,u,v),
    };
  }),
).flat();
// U-major/V-minor: 153 pairs, requiring 306 application D0 calls.
```

The selected 17×9 grid's largest paired point difference is about `7.99e-15` mm. Its points supply the static XYZ projection; they are not a new Surface, fitted mesh or renderer result. Application sampling does not change `report.directCounts` or its observation schedule.

The `refineQuarterSheet` helper also cold-validates the whole result, which reconstructs the operation once. A tampered-result check has its own reconstruction. Reported direct counts describe one producer's wrapper work, excluding these additional validations, the 306 application queries and inherited compiler/helper work. They are not elapsed time or a whole-consumer call total.

## Keep actual derivative guards

D1 returns a point, Du and Dv in mm per original dimensionless U/V. It does not normalize a tangent, certify regularity or create a unit normal. At an exact C0 interior knot, the native D1 guard can refuse; this wrapper records `status:'refused-c0'` instead of inventing a zero derivative. Other native errors refuse the operation. Relative Du/Dv comparisons are null when either original or refined D1 tuple is unavailable.

The first simple degree-2 U insertion has multiplicity 1, and V has no interior knot. All thirty selected D1 attempts therefore evaluated, with no C0 refusal. This result does not widen the native guard or certify G1/G2 continuity at every parameter.

## Reject a complete candidate before replacing accepted data

```ts
let accepted=result;
try {
  const candidate=insertSourceSurfaceKnot({...request,knot:2});
  accepted=candidate;
} catch(error) {
  if (!(error instanceof SourceSurfaceKnotInsertionError)) throw error;
  console.log(error.code); // REQUEST: U endpoint is not strictly interior.
}
console.log(accepted===result); // true.

const tampered=structuredClone(result);
Reflect.set(tampered.report,'patchCount',2);
try {validateSourceSurfaceKnotInsertion(tampered);}
catch(error) {
  if (!(error instanceof SourceSurfaceKnotInsertionError)) throw error;
  console.log(error.code); // OWNED: full reconstructed receipt differs.
}
```

These are genuine selected refusals; accepted reference and complete values remained retained. The validator checks all eight result fields against a complete reconstruction, including Models, source, patches, coefficients, observations, counts and sizes. A selected Surface or report cannot replace the complete owned result.

Caller inputs and returned occurrences are independently copied. Outputs remain mutable CPU data, not deeply frozen live handles. Changing a copied receipt does not alter another result or the original Model. Release references when finished; there is no Surface-insertion `dispose()` or GPU allocation.

## Limits and errors

| Resource | Bound |
| --- | --- |
| Input | Complete literal Source0, up to 16 original Model objects |
| Selected direction | Degree 1..5; original selected-axis poles at most 15, refined at most 16 |
| Other direction | At most 16 poles; total grid at most 256; knots per axis at most 22 |
| Insertion | One finite strict-interior knot; final selected multiplicity at most its degree |
| Coefficients | Selected coordinate magnitude at most 10000 mm; positive weights `1e-6..1e6` |
| Observation schedule | Fixed budget 1024; at most 32 selected-axis × 31 other-axis stations, 992 observations and 3968 D0/D1 attempts |
| Strips / patches | At most 16 strips and three array patches; each replacement decimal literal at most 512 characters |
| Source | Each original/candidate at most 262144 UTF-16 units and UTF-8 bytes, counted separately |
| Full request/result | Each at most 4,194,304 UTF-16 units and UTF-8 bytes across retained occurrences |
| Own data | At most 1,048,576 values, depth 64, dense array length 8192, record fields 64, keys 128 and strings 262144 characters |

Native degree/count, clamped-knot, positive-weight and representability rules still apply. A source within its text limit can exceed a full result or observation bound; the operation refuses rather than returning partial native data.

| Refusal | Code |
| --- | --- |
| Wrong exact record, cyclic/sparse/foreign own data | `INPUT` |
| Wrong source version or selected ID | `VERSION` / `IDENTITY` / `TARGET` |
| Original/candidate compilation refusal | `SOURCE`, with cause |
| Invalid axis, nonfinite/outside/endpoint knot or excessive multiplicity | `REQUEST` |
| Fixed observation, source or coefficient capacity exceeded | `BUDGET` |
| Unsafe arithmetic, station or emitted decimal representation | `REPRESENTABILITY` |
| Source/native/patch mapping or observed comparison disagrees | `BINDING` |
| Native validation/query failure outside the admitted C0 case | `NATIVE` |
| Complete result differs from reconstruction | `OWNED` |
| Serialized request/result envelope exceeds its bound | `FILE` |

The report retains `geometricValidity:'not-certified'`, `topologyCertified:false`, `solid:false` and `globalShapeErrorCertified:false`. Refinement creates no trim, Face, Shell or Solid and proves no renderer/editor admission, manufacturing tolerance or general persistent naming.

[Curve knot insertion](./curve-knot-insertion) · [CAD guides](./guides) · [CAD examples](./examples)
