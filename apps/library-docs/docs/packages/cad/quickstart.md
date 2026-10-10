# Compile and evaluate a native Curve

Use Node 22+ and a TypeScript-capable workspace transformer. Ordinary `@barocss/cad` imports select source; plain Node alone cannot resolve the internal `.js` imports to `.ts`. This example uses the actual root exports and source dialect0.

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

A source0 model requires `version:0`, `length-unit:mm` and 1..16 unique Curve/Surface declarations. Arrays use commas without trailing commas. Each declaration ends in `;`. Finite decimal literals are accepted. Arbitrary functions, exponent spelling in authored numeric literals, file imports and scripts are outside this dialect.

## Export geometry explicitly

`exportIGES(model, ids)` takes selected native IDs in caller order and returns bytes as a string plus a report. The host chooses a path, hashes bytes and writes the file. It performs no filesystem call. Curves use entity126; Surfaces use entity128. This geometry export excludes editable source and a closed Solid serialization. Retain the source and full-ID report for later edits.

## Start a repository source consumer

```sh
pnpm dev:cad
```

Run from the repository root with its existing dependencies. This starts the existing private CAD preview/editor example through Vite. Use the URL printed by that host. `examples/cad-preview/package.json` (Its manifest; local source) declares the actual dependencies and command. For a separate emitted JS/type checkpoint:

```sh
pnpm --filter @barocss/cad build:library
```

This build is not a source-host prerequisite and does not publish a package. Continue with [native task guides](./guides), [API signatures](./api), or the [complete Surface example](./examples#sample-a-plane-and-prepare-gpu-buffers).

---

Source snapshot: local Git `5f5ad866205a21510ac69552e704cc162fa253b5`. `packages/barocss-cad/package.json` (Manifest; local source), [public root](/packages/cad/reference#declarations-f921e035f2c3), `packages/barocss-cad/README.md` (package README; local source). Source references identify that fixed snapshot. This native source commit is local-only; public declaration references open in this portal. Local source is the authority for this manual.

[Overview](./) · [Quickstart](./quickstart) · [Guides](./guides) · [API](./api) · [Examples](./examples) · [Limits](./limits)
