# Compile and evaluate a native Curve

Describe geometry in millimetres, select its language version, then evaluate it in the original parameter domain. This complete example uses public `@barocss/cad` APIs and source0. For development source entries, use a TypeScript-capable bundler; built ESM entries provide compiled JavaScript.

```ts
import { compileCadModel, evaluateCurve, curveDomain, exportIGES } from '@barocss/cad';

const source = `
@model line_example {
  version: 0;
  length-unit: mm;
  @curve #edge {
    type: nurbs;
    degree: 1;
    knots: [0,0,1,1];
    control-points: [[0,0,0],[20,0,0]];
    weights: [1,1];
  }
}
`;
const result = compileCadModel(source, { sourceVersion: 0 });
if (!result.ok) throw new Error(result.diagnostics[0].message);
const curve = result.model.objects[0];
if (curve.kind !== 'curve') throw new Error('Expected the authored Curve');
console.log(curveDomain(curve)); // [0,1]
console.log(evaluateCurve(curve, 0.5)); // [10,0,0], in mm
const artifact = exportIGES(result.model, ['edge']);
console.log(artifact.report.objects[0].entity); // 126
```

## Keep source and output together

Success includes `ast`, `ir`, `model`, `constructions` and an empty diagnostics array. Failure includes diagnostics and no partial model. Keep the original source and owning IDs with any output. The compiler owns each nested output occurrence independently; modifying AST or IR data does not edit the model or source.

A source0 model requires `version:0`, `length-unit:mm` and 1..16 unique Curve/Surface declarations. Arrays use commas without trailing commas. Each field ends in `;`; a geometry block ends in `}`. Finite decimal literals are accepted. Arbitrary functions, exponent spelling in authored numeric literals, file imports and scripts are outside this dialect.

## Export geometry explicitly

`exportIGES(model, ids)` takes selected native IDs in caller order and returns bytes as a string plus a report. Your application chooses where to save the returned geometry text. It performs no filesystem call. Curves use entity126; Surfaces use entity128. This geometry export excludes editable source and a closed Solid serialization. Retain the source and full-ID report for later edits.

## Edit and display geometry

Open [the CAD Curve example](/playground#cad-curve) to change native poles or weights and inspect the evaluated shape. Use [the Surface example](./examples#sample-a-plane-and-prepare-gpu-buffers) to sample a control net into a display packet.

Native geometry, sampled mesh and image have separate roles. Keep the original source and Model for edits. Select explicit display units and dispose display resources when the view closes. Failed compilation provides diagnostics without a partial Model; retain the last accepted application state.

The compiler examples use experimental CAD source0/1/2. The [qualified translated-strip Body](./body-1301) requires its separate newer Body API; compiling a Curve or Surface alone does not certify a Body.

[Overview](./) · [Language](./language) · [Guides](./guides) · [API](./api) · [Examples](./examples) · [Limits](./limits)
