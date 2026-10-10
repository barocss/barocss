# CAD examples

Compile original geometry, query it, then prepare a separate display mesh. These examples use actual `@barocss/cad` public exports at version `0.0.0-experimental`. Use [the language reference](./language) to edit source0/1/2 correctly.

[Open the live playground](/playground) · [Compiler signature](./reference#compilecadmodel) · [Surface sampling signature](./reference#tessellatesurface)

## Run the complete CPU examples

The saved module contains all four selected language/native flows and the Surface→GPU buffer preparation below. From the repository root with Node22+ and existing dependencies:

```sh
node apps/library-docs/scripts/run-example.mjs apps/library-docs/scripts/snippets/cad-example.ts
```

`apps/library-docs/scripts/snippets/cad-example.ts` is the complete runnable input. The shared runner checks the pinned package source, uses ordinary public imports and transforms TypeScript with the existing esbuild dependency. It evaluates the bundle in Node without a WebGL context or network call.

The actual selected run passed on its first execution with 222 own source inputs and 0 own dist inputs. Its source pin was `5f5ad866205a21510ac69552e704cc162fa253b5`.

| Case | Actual result |
| --- | --- |
| Original Curve | Domain `[2,7]`; point at4.5=`[10,0,0]` mm |
| Weighted Surface | Point at(.5,.5)=`[7.7,5.2,1]` mm |
| Surface grid17×17 | 289 vertices,512 triangles,867 position components,1536 indices |
| Surface preview report | maxSampledDeviationMM `0.02878837032366707`; certified `false` |
| Selected IGES Surface export | Entity128; solid `false` |
| Source1 extrusion | Point at(.5,.5)=`[10,0,15]` mm; native Model version 0 |
| Source2 parameters | width100mm,height50mm,scale2; wall midpoint `[50,0,50]` mm |
| Source2 edit10cm→12 cm | Wall midpoint `[60,0,60]` mm |
| Refused candidates | KIND,VERSION,UNIT,DIVISION_ZERO as described below |

These are a bounded CPU example receipt. They do not establish a graphics draw, emitted declaration coverage, a packed installation or global geometry certification.

## View the weighted Surface

![Sampled display of the original weighted CAD Surface](/examples/cad-surface.png)

This display comes from four authored poles and four weights. The rendered triangles are sampled output. Pale U/V lines show the sampled grid, not the control net or topological edges. The original poles/weights below remain the editable native definition. The native midpoint follows the rational Surface evaluation, not an average of the four corner coordinates.

Start the documentation app:

```sh
pnpm --filter @barocss/library-docs dev --host 127.0.0.1
```

Open `/playground` on the URL printed by the host. Select **CAD surface**, replace its source with the text below and select **Run input**. Inspect the native midpoint, mesh counts and report beside the canvas. Edit a pole or weight, then run the candidate again. Preserve accepted native/display state when a candidate refuses.

### Full source0 input

```css
@model preview_weighted {
  version: 0;
  length-unit: mm;
  @surface #weighted {
    type: nurbs;
    degree-u: 1;
    degree-v: 1;
    knots-u: [0,0,1,1];
    knots-v: [0,0,1,1];
    control-points: [[[0,0,0],[1,7,3]],[[9,2,4],[12,8,-2]]];
    weights: [[1,2],[3,4]];
  }
}
```

The control grid is U then V. Its weights are not colors or opacities. At U=V=.5, every bilinear basis product is.25. Weighted coordinate sums divided by the weight sum give `[7.7,5.2,1]` mm.

### Complete public-API module

```ts
import { compileCadModel, evaluateSurface, tessellateSurface, exportIGES } from '@barocss/cad';
import { prepareMesh } from '@barocss/gpu';

const source = `@model preview_weighted {
  version: 0; length-unit: mm;
  @surface #weighted {
    type: nurbs; degree-u: 1; degree-v: 1;
    knots-u: [0,0,1,1]; knots-v: [0,0,1,1];
    control-points: [[[0,0,0],[1,7,3]],[[9,2,4],[12,8,-2]]];
    weights: [[1,2],[3,4]];
  }
}`;
const compiled = compileCadModel(source, { sourceVersion: 0 });
if (!compiled.ok) throw new Error(JSON.stringify(compiled.diagnostics));
const surface = compiled.model.objects[0];
if (surface.kind !== 'surface') throw new Error('Expected a Surface');
const centerMM = evaluateSurface(surface, 0.5, 0.5);
const { packet, report } = tessellateSurface(surface, {
  countU: 17, countV: 17, revision: 0,
});
const buffers = prepareMesh(packet, {
  mmToSceneUnit: 0.1, translate: [0,0,0],
  color: [0.2,0.6,0.9], background: [0.04,0.06,0.1],
});
const exchange = exportIGES(compiled.model, ['weighted']);
console.log(centerMM, report.vertexCount, report.triangleCount);
console.log(report.maxSampledDeviationMM, report.certified);
console.log(buffers.positions.length, buffers.indices.length);
console.log(exchange.report.objects[0].entity, exchange.report.solid);
```

Use a TypeScript-capable workspace host or save this module under the app's `scripts/snippets` directory and pass its path to `run-example.mjs`. A plain browser cannot run the raw TypeScript entry; plain Node alone does not resolve internal `.js` imports to `.ts`.

Here scale 0.1 converts each native mm to 0.1 scene units once. The packet retains native mm/Y-up declaration and original U/V parameters. GPU owns the derived Float32 positions/normals and Uint16 indices. This CPU code mounts no renderer. The playground host uses its own explicit display scale and placement; its current scale is 0.12 scene units/mm. It owns the canvas, camera, view updates and resource disposal.

The observed deviation samples five points per cell. It is not a global error bound. Native Source, Model, packet, display pose and image must remain separate records.

## Read a rational quarter-circle result

![CAD evaluated quarter circle with its control polygon](/examples/cad-curve.png)

Open [the live Curve input](/playground#cad-curve). The cyan line is the actual CAD evaluation. Orange points and dashed lines show the three control poles. The middle pole `[20,20,0]` is outside the curve; a NURBS pole is not generally a point on the curve.

```css
@model arc {
  version: 0; length-unit: mm;
  @curve #quarter {
    type: nurbs; degree: 2;
    knots: [0,0,0,1,1,1];
    control-points: [[20,0,0],[20,20,0],[0,20,0]];
    weights: [1,0.7071067811865476,1];
  }
}
```

The original domain is `[0,1]`. The host evaluates101 uniformly spaced parameters. At `u=.5`, the actual point is approximately `[14.142135623730951,14.142135623730951,0]` mm. The middle rational weight produces the quarter circle of radius20; replacing it with1 changes the shape. This is CAD evaluation followed by host Canvas2D drawing, not a BaroCSS Canvas2D renderer receipt.

## Query a Curve with an original domain

This complete module uses source0 with knot domain 2..7:

```ts
import { compileCadModel, curveDomain, evaluateCurve } from '@barocss/cad';

const source = `@model original_domain {
  version: 0; length-unit: mm;
  @curve #edge {
    type: nurbs; degree: 1; knots: [2,2,7,7];
    control-points: [[0,0,0],[20,0,0]]; weights: [1,1];
  }
}`;
const result = compileCadModel(source, { sourceVersion: 0 });
if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
const curve = result.model.objects[0];
if (curve.kind !== 'curve') throw new Error('Expected a Curve');
console.log(curveDomain(curve)); // [2,7]
console.log(evaluateCurve(curve, 4.5)); // [10,0,0], mm
```

The public evaluator takes an original native parameter. Do not normalize4.5 to 0.5 before this call. Sampling is uniform in that native parameter, not automatically uniform in arc length. For a rational arc, that parameter is not necessarily angle.

## Construct an open Surface in source1

Source1 admits a Curve and its extrusion. It excludes literal Surface blocks:

```ts
import { compileCadModel, evaluateSurface } from '@barocss/cad';

const source = `@model raised_edge {
  version: 1; length-unit: mm;
  @curve #profile {
    type: nurbs; degree: 1; knots: [0,0,1,1];
    control-points: [[0,0,0],[20,0,0]]; weights: [1,1];
  }
  @extrude #wall { curve: #profile; vector: [0,0,30]; }
}`;
const result = compileCadModel(source, { sourceVersion: 1 });
if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
const wall = result.model.objects.find(object => object.id === 'wall');
if (!wall || wall.kind !== 'surface') throw new Error('Expected wall Surface');
console.log(result.model.objects.map(object => object.id)); // ['profile','wall']
console.log(evaluateSurface(wall, 0.5, 0.5)); // [10,0,15], mm
console.log(result.ir.schemaVersion, result.ir.sourceVersion, result.model.version);
// 1,1,0
```

The Surface is `C(u)+v[0,0,30]`, with V domain 0..1. This is an open Surface with no caps or Solid topology. Retain the construction's output/input IDs and source spans. Displaying the result does not make it a closed native body.

## Recompile a parameter edit in source2

Source2 quantities distinguish length and scalar:

```ts
import { compileCadModel, evaluateSurface } from '@barocss/cad';

const source = `@model driven {
  version: 2; length-unit: mm;
  @parameter #width { type: length; value: 10 cm; }
  @parameter #height { type: length; value: $width / 2; }
  @parameter #scale { type: scalar; value: 2; }
  @curve #profile {
    type: nurbs; degree: 1; knots: [0,0,1,1];
    control-points: [[0,0,0],[$width,0,0]]; weights: [1,1];
  }
  @extrude #wall { curve: #profile; vector: [0,0,$height * $scale]; }
}`;
for (const input of [source, source.replace('10 cm', '12 cm')]) {
  const result = compileCadModel(input, { sourceVersion: 2 });
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  if (result.ir.schemaVersion !== 2) throw new Error('Expected schema2');
  const wall = result.model.objects.find(object => object.id === 'wall');
  if (!wall || wall.kind !== 'surface') throw new Error('Expected wall Surface');
  console.log(result.ir.parameters.map(p => [p.id, p.value, p.unit]));
  console.log(evaluateSurface(wall, 0.5, 0.5));
}
// First: width100mm,height50mm,scale2; midpoint[50,0,50]mm.
// Edited: width120mm,height60mm,scale2; midpoint[60,0,60]mm.
```

Recompile the complete candidate. The previous native result does not change. Source2 IR retains parameter expressions and field bindings; native Model version remains 0. The [language guide](./language#quantity-rules) explains why `1mm+2mm` is valid but a coordinate `1+2` refuses.

The direct Loader source path accepts source0 only. A compiler source2 result does not establish that every Loader, editor file envelope or Save/Open host accepts that dialect.

## Inspect a real refusal

The saved CPU module checks four candidates against their actual diagnostics:

| Change | Result |
| --- | --- |
| Weighted Surface model changed to source1/header1 | KIND: source1 excludes literal Surfaces |
| Original Curve header0 with compiler sourceVersion 1 | VERSION |
| Source2 profile endpoint changed from `$width` to `1+2` | UNIT: scalar expression in a length field |
| Source2 height changed from `$width/2` to `$width/0` | DIVISION_ZERO |

Compilation failure returns diagnostics only. It has no partial Model to adopt. Keep accepted source/model/display state in the host; show code/message and the actual UTF-16 source range. Do not use geometry substitution or unit retagging to hide a refused edit.

## Sample a plane and prepare GPU buffers

This smaller complete control retains the existing plane→GPU task:

```ts
import { compileCadModel, tessellateSurface, evaluateSurface } from '@barocss/cad';
import { prepareMesh } from '@barocss/gpu';

const source = `@model plane_example {
  version: 0; length-unit: mm;
  @surface #plane {
    type: nurbs; degree-u: 1; degree-v: 1;
    knots-u: [0,0,1,1]; knots-v: [0,0,1,1];
    control-points: [[[0,0,0],[0,10,0]],[[20,0,0],[20,10,0]]];
    weights: [[1,1],[1,1]];
  }
}`;
const compiled = compileCadModel(source, { sourceVersion: 0 });
if (!compiled.ok) throw new Error(JSON.stringify(compiled.diagnostics));
const surface = compiled.model.objects[0];
if (surface.kind !== 'surface') throw new Error('Expected plane Surface');
const { packet, report } = tessellateSurface(surface, {
  countU: 3, countV: 3, revision: 0,
});
const buffers = prepareMesh(packet, {
  mmToSceneUnit: 0.001, translate: [0,0,0],
  color: [0.2,0.6,0.9], background: [0.06,0.09,0.12],
});
console.log(evaluateSurface(surface, 0.5, 0.5)); // [10,5,0], mm
console.log(report.vertexCount, report.triangleCount); // 9,8
console.log(buffers.positions[6], buffers.positions[7]);
// [0,0.01] approximately as Float32: a native [0,10,0] vertex.
```

Increasing U follows+X and V follows+Y, so this plane preview's normal follows+Z. This path applies no axis rotation. Scale0.001 means metres per mm. The selected current CPU receipt at the top exercises the weighted Surface; this separate plane control is documented code, not an additional current execution claim.

## Existing native files and further tasks

| Task | Repository input/example |
| --- | --- |
| Exact underlying weighted-patch fixture | `examples/cad-nurbs/preview-weighted.css`; same poles/weights, historical ID `weighted_patch` |
| Parameter-driven line and wall | `examples/cad-nurbs/parameter-line-v2.css` |
| Rational parameter-driven quarter and wall | `examples/cad-nurbs/parameter-curved-v2.css` |
| Original derivative query | `examples/cad-nurbs/derivative-demo.mjs` |
| Bounded native rectangle construction | `examples/cad-nurbs/axis-rectangle-extrusion-demo.mjs` |
| Native mass calculation | `examples/cad-nurbs/axis-box-solid-mass-demo.mjs` |

Read each existing demo's import and flags. Artifact demos can require a separate emitted package build; source-mode examples retain their own documented flags. A historical exchange-reader receipt proves its selected historical files, not every new model.

Keep source bytes, Model name, complete native IDs, options and actual reports with stored artifacts. IGES contains selected geometry and a separate identity report; it excludes editable native source and closed Solid serialization. Native source, sampled mesh, pose and image serve different tasks.

---

Source snapshot:`5f5ad866205a21510ac69552e704cc162fa253b5`. Docs task parent:`83d3ceede9b97df1ec6bbd4da7feab9757f0f75d`. The current selected CPU runner checks pinned source and ordinary public imports. Graphics/image evidence belongs to the separate actual playground run. [Public declarations](./reference) are readable in this portal.

[Overview](./) · [Quickstart](./quickstart) · [Language](./language) · [Guides](./guides) · [API](./api) · [Limits](./limits)
