# CAD examples

## Sample a plane and prepare GPU buffers

This complete public-API source snippet runs in a TypeScript-capable workspace transformer. It creates no WebGL context. The source, model, packet, report and derived buffers remain distinct:

```ts
import { compileCadModel, tessellateSurface, evaluateSurface } from '@barocss/cad';
import { prepareMesh } from '@barocss/gpu';

const source = `
@model plane_example {
  version: 0;
  length-unit: mm;
  @surface #plane {
    type: nurbs;
    degree-u: 1;
    degree-v: 1;
    knots-u: [0,0,1,1];
    knots-v: [0,0,1,1];
    control-points: [[[0,0,0],[0,10,0]],[[20,0,0],[20,10,0]]];
    weights: [[1,1],[1,1]];
  }
}
`;
const compiled = compileCadModel(source, { sourceVersion: 0 });
if (!compiled.ok) throw new Error(compiled.diagnostics[0].message);
const surface = compiled.model.objects[0];
if (surface.kind !== 'surface') throw new Error('Expected plane Surface');
const centerMM = evaluateSurface(surface, 0.5, 0.5); // [10,5,0]
const { packet, report } = tessellateSurface(surface, {
  countU: 3, countV: 3, revision: 0,
});
const buffers = prepareMesh(packet, {
  mmToSceneUnit: 0.001, translate: [0,0,0],
  color: [0.2,0.6,0.9], background: [0.06,0.09,0.12],
});
console.log(centerMM, report.vertexCount, report.triangleCount);
// [10,5,0], 9, 8
console.log(buffers.positions[6], buffers.positions[7]);
// Native vertex [0,10,0] converted to approximately [0,0.01,0] as Float32.
```

The surface net is indexed U then V. Here increasing U follows +X and increasing V follows +Y, so preview normals follow +Z. The packet does not rotate authored axes. Conversion applies millimetres→scene units once. A positive CPU result does not certify graphics, native topology or a global approximation bound.

## Use a saved repository task

| Task | Fixed repository example |
| --- | --- |
| Original parameter derivatives | [derivative demo](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/examples/cad-nurbs/derivative-demo.mjs) |
| Native rectangle construction | [rectangle extrusion demo](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/examples/cad-nurbs/axis-rectangle-extrusion-demo.mjs) |
| Plane packet input | [preview-flat.css](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/examples/cad-nurbs/preview-flat.css) |
| Rational nonplanar Surface | [preview-weighted.css](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/examples/cad-nurbs/preview-weighted.css) |
| Editable native sketch | [XY sketch document demo](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/examples/cad-nurbs/xy-sketch-document-demo.mjs) |
| Native mass calculation | [axis-box mass demo](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/examples/cad-nurbs/axis-box-solid-mass-demo.mjs) |

Read a demo's import and flags before running it. Existing artifact demos may use explicit dist and require an affected library build. Source-mode demos use their documented `--source` mode. Source and emitted checkpoints are separate. Do not rerun every exchange reader or gallery to learn one task.

## File and identity retention

Store source bytes, Model name, full native object IDs, options and actual reports with an artifact. Keep IGES and display packets as separate exports. An external-reader receipt from a selected historical fixture does not prove an untested current model. The host decides paths, hashes, revisions and accepted-file replacement.

---

Source snapshot: local Git `5f5ad866205a21510ac69552e704cc162fa253b5`. [Manifest](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-cad/package.json), [public root](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-cad/src/index.ts), [package README](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-cad/README.md). Fixed-SHA links identify that snapshot; this native local commit may not yet be available on the remote. Local source is the authority for this manual.

[Overview](./) · [Quickstart](./quickstart) · [Guides](./guides) · [API](./api) · [Examples](./examples) · [Limits](./limits)
