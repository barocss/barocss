# Shape a quadratic rational Surface

[Open CAD rational dome](/examples/language#cad-rational-dome) to change a central weight and a typed pole height while keeping the four boundary curves fixed. The [playground link](/playground#cad-rational-dome) opens the same complete input.

![Sampled rational Surface after the independent rise edit](/examples/cad-rational-dome.jpg)

The picture shows `rise:3.6 cm` with `centerWeight:4`, after Reset and an independent rise edit. Its native Surface center Z is `144/7≈20.571429` mm. The starting source below uses 2.4 cm and center Z = `96/7` mm. The pale lines are the 34 evaluated U/V grid paths.

This language example uses experimental `@barocss/cad` version `0.0.0-experimental` at source profile `5f5ad866205a21510ac69552e704cc162fa253b5`. It uses existing source2 declarations and the existing Surface display. It adds no source dialect, Sketch/Face declaration or new renderer.

## Complete source2 input

```css
@model domed_panel {
  version: 2; length-unit: mm;
  @parameter #rise { type: length; value: 2.4 cm; }
  @parameter #centerWeight { type: scalar; value: 4; }
  @surface #dome {
    type: nurbs; degree-u: 2; degree-v: 2;
    knots-u: [0,0,0,1,1,1]; knots-v: [0,0,0,1,1,1];
    control-points: [[[0,0,0],[0,15,0],[0,30,0]],
                     [[20,0,0],[20,15,$rise],[20,30,0]],
                     [[40,0,0],[40,15,0],[40,30,0]]];
    weights: [[1,1,1],[1,$centerWeight,1],[1,1,1]];
  }
}
```

Choose this preset before editing. It calls `compileCadModel` with `sourceVersion:2`; keep the matching header. **Run input** submits the complete candidate. **Reset example** restores the source above.

The XY footprint uses literal millimetre coordinates: X = `[0,20,40]`, Y = `[0,15,30]`. Only two Parameters are declared. `rise` is a length that resolves from 2.4 cm to 24 mm. `centerWeight` is a dimensionless scalar with value 4. It is not an opacity, scale or extra Z coordinate.

The outer pole index is U and the inner index is V. There are three poles in each direction, nine in total. Each degree is 2, so each knot vector has `N+p+1=3+2+1=6` values. The endpoint knots repeat three times. Both knot vectors are open and clamped, and both original domains are `[0,1]`. U/V are dimensionless parameters; native XYZ remains in mm.

## Distinguish a pole from a Surface point

The central pole is `[20,15,24]` mm. The Surface generally does not pass through that interior pole. At U = V = .5, the degree 2 polynomial basis in either direction is `[.25,.5,.25]`. The central tensor-product factor is therefore `.25`; the other eight factors sum to `.75`.

Let `h` be the central pole Z and `w` its weight. All other pole Z values are 0 and weights are 1. The Surface center's Z is:

```text
z = (.25 * w * h) / (.75 + .25 * w)
  = h * w / (3 + w)
```

With h = 24 mm and w = 4, z = `96/7≈13.714286` mm. Symmetry keeps the center's X/Y at `[20,15]`. This is a weighted rational blend, not the central pole's 24 mm or a simple average of nine heights.

## Compare weight and rise edits

| Rise / central weight | Surface center at U = V = .5 |
| --- | --- |
| 24 mm / 4, the original source | `[20,15,96/7]` mm, approximately Z = 13.714286 mm |
| 24 mm / 1 | `[20,15,6]` mm |
| 36 mm / 4 | `[20,15,144/7]` mm, approximately Z = 20.571429 mm |
| 36 mm / 1, if both edits are combined | `[20,15,9]` mm |

1. Change the scalar `centerWeight` value from 4 to 1, then select **Run input**. The Surface center falls to 6 mm while every pole stays at its original XYZ.
2. Select **Reset example** before testing rise independently.
3. Change `rise` from `2.4 cm` to `3.6 cm`, leaving weight 4. The central pole becomes `[20,15,36]` mm and the Surface center reaches `144/7` mm.
4. Read native values as well as the picture. Keeping weight 1 while changing rise gives 9 mm, not `144/7` mm.

The weight also changes where an off-center parameter lands in XY:

| Weight, with rise 24 mm | Surface at U = .25, V = .5 |
| --- | --- |
| 4 | `[13.6,15,11.52]` mm |
| 1 | `[10,15,4.5]` mm |

Weight 4 pulls that point toward the fixed central pole in X and Z. The effect is not merely a multiplication of Z. The symmetric center probe alone would hide this XY change.

For either edit, every point on the four boundary curves remains unchanged. The central basis factor vanishes when U or V is 0 or 1. The boundary poles and weights are fixed, so the complete edges stay on the original XY rectangle at Z = 0. Editing a boundary pole, knot or boundary weight would be a different operation.

## Inspect the native result and sampled mesh

Pass the complete source above to this application function. It uses actual public CAD imports and returns native values separately from a preview packet.

```ts
import {
  compileCadModel, surfaceDomain, evaluateSurface, tessellateSurface
} from '@barocss/cad';

function inspectDome(sourceText: string) {
  const compiled = compileCadModel(sourceText, { sourceVersion: 2 });
  if (!compiled.ok) return { ok: false, diagnostics: compiled.diagnostics };
  const surface = compiled.model.objects.find(object => object.id === 'dome');
  if (!surface || surface.kind !== 'surface') throw new Error('Expected dome Surface');
  const domain = surfaceDomain(surface);
  const preview = tessellateSurface(surface, { countU: 17, countV: 17, revision: 0 });
  return {
    ok: true, sourceText,
    modelVersion: compiled.model.version,
    parameters: compiled.ir.schemaVersion === 2
      ? compiled.ir.parameters.map(({id,value,unit}) => ({id,value,unit})) : [],
    domain, centerPoleMM: [...surface.controlPoints[1][1]],
    centerMM: evaluateSurface(surface, .5, .5),
    offCenterMM: evaluateSurface(surface, .25, .5),
    boundaryMidpointsMM: [
      evaluateSurface(surface, 0, .5), evaluateSurface(surface, 1, .5),
      evaluateSurface(surface, .5, 0), evaluateSurface(surface, .5, 1)
    ],
    packet: preview.packet, report: preview.report
  };
}
```

Source2 returns IR schemaVersion 2 and native Model version 0. The model contains one Surface, `dome`; Parameters are resolved metadata rather than additional geometry objects. Compilation returns independent native data. Editing source does not mutate a previously returned Model. Retain the exact source text with its native result.

The display samples U/V on a 17×17 grid, including domain endpoints: 289 vertices and 512 triangles. It shows 17 row lines and 17 column lines, 34 evaluated grid paths in total. These pale lines follow sampled Surface positions. They are not the nine-pole control net, trim curves or topological edges.

The packet preserves native mm coordinates. GPU display uses a separate conversion and translation based on the sampled bounds. View fitting can change placement or scale after a source edit, so screen size is not a native measurement. The Surface, sampled packet, display pose and rendered image remain distinct data.

The selected default, weight 1 and rise 36 mm variants all use a conversion of `.045` scene units per mm because the 40 mm width remains the largest sampled extent. Their sampled Z centering can still change. Read native XYZ alongside that display conversion.

The report's `maxSampledDeviationMM` observes finite probes between the sampled triangles and native Surface. It has `certified:false`. Increasing resolution supplies more display samples; it does not prove a global error bound, exact normals, regularity, trims, manufacturing quality or a closed Solid. This source describes an open Surface with boundaries.

## Read a refusal without changing the accepted model

| Candidate edit | Result |
| --- | --- |
| Set `centerWeight` to 0 | `WEIGHTS`: native weights must remain positive within their supported range |
| Replace center pole `[20,15,$rise]` with `[20,15,$centerWeight]` | `UNIT`: an XYZ component requires a length, not a scalar Parameter |
| Make a degree incompatible with its three poles or its six knots | Degree/knot diagnostic; inspect the actual reported boundary |

The literal XYZ leaves use the model's declared mm convention. A scalar Parameter reference does not acquire length units merely because it is placed in that array. Preserve declared quantity kinds and positive weights.

Setting `rise` to `0 cm` creates a valid flat Surface for this pole grid. It is a different operation from the curved-extrusion example's refused zero extrusion vector.

`compileCadModel` returns `ok:false` and diagnostics on refusal, with no partial Model, IR or AST. Diagnostics include code, message and range, with an optional object ID. Ranges are half-open UTF-16 offsets with one-based line/column locations; use them against the exact candidate text. Recompiling formatted text produces its own ranges.

The example keeps its last accepted numeric result and display while the host remains usable. The rejected draft remains available to correct. Do not silently clamp a weight or rewrite a wrong quantity. Native compilation, tessellation and renderer admission have separate refusal boundaries; context/device loss can prevent pixel restoration even when CPU data is retained.

| Resource | Existing bound |
| --- | --- |
| Source / source2 declarations | 262144 UTF-8 bytes; 64 Parameters and 16 geometry declarations |
| Native Surface | 2..16 poles per direction, at most 256 total; degree 1..5 and smaller than pole count |
| Coordinates / weights | Finite XYZ within ±1e6 mm; weights `1e-6..1e6` |
| Knots | Finite, nondecreasing, open/clamped; valid counts, multiplicities and positive original domains |
| Preview | Grid counts 2..64 per direction, at most 4096 vertices; this task uses 17×17 |

The [model-language reference](./language) gives the remaining source, expression and native bounds. Separately exported Sketch, Face and Body APIs do not add declarations to this grammar.

[CAD language practice](./language-examples) · [CAD guides](./guides) · [CAD examples](./examples) · [Limits](./limits)
