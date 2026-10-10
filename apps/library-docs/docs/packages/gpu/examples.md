# GPU examples

Start the [visual playground](/playground). It runs the real source APIs in your browser. Choose **GPU scene** to edit shapes, or **GPU material** to change the color of a CAD-derived mesh. Each example shows its input, accepted result and diagnostics.

These examples use local source snapshot `5f5ad866205a21510ac69552e704cc162fa253b5`. The screenshots record the portal's actual browser output. They establish the recorded SDF/mesh paths. They do not establish a general Engine renderer, currentRoot integration, emitted-package or npm acceptance.

## Run the portal

Use Node22+ and the existing repository dependencies:

```sh
pnpm --filter @barocss/library-docs dev --host 127.0.0.1
```

Open the printed URL and select **Run examples**. The host owns the canvas, source editor and report. `apps/library-docs/scripts/snippets/visual.mjs` contains the exact inputs and public API calls. The app bundles its own package TypeScript source, with zero own package dist inputs.

WebGL2 is required for the scene, surface and material examples. If context creation fails, the host reports that failure; it does not replace the renderer with a simulated image.

## Rotated box and sphere

![Actual GPU source1 scene: orange sphere beside rotated blue box](/examples/gpu-scene.png)

This image shows the source1 SDF renderer. The left object is an orange sphere. The right object is a rotated blue box. Both come from the following complete source:

```css
@scene shapes {
  version: 1;
  background: #101820;
  sphere #ball;
  box #block;
}
sphere { radius: .65; color: #F1AA55; }
#ball { translate: -1.1 0 0; }
#block {
  size: 1 1.5 .8;
  translate: 1 0 0;
  rotate-x: 20deg;
  rotate-y: 35deg;
  rotate-z: -10deg;
  color: #57B4D9;
}
```

The declaration block creates `ball` and `block`. Style blocks change their properties. The box size is its full XYZ extent, not half extent. The three rotations apply in X-Y-Z order. Numbers without `deg` use scene units.

The portal makes this call:

```ts
import { mountScene } from '@barocss/gpu';

const renderer = mountScene(canvas, source, undefined, { sourceVersion: 1 });
console.log(renderer.scene.objects.map(object => ({
  id: object.id,
  type: object.type,
  translate: object.translate,
  rotateDegrees: object.rotateDegrees
})));
```

Expected accepted data:

```json
[
  { "id": "ball", "type": "sphere", "translate": [-1.1,0,0], "rotateDegrees": [0,0,0] },
  { "id": "block", "type": "box", "translate": [1,0,0], "rotateDegrees": [20,35,-10] }
]
```

### Change the input and explain the result

1. Change `rotate-y: 35deg` to `rotate-y: 0deg`. Run the input. The box's orientation changes, while its size and translation stay the same.
2. Change the sphere radius from`.65` to`.9`. Run the input. The sphere grows; its center stays at `[-1.1,0,0]`.
3. Change its radius to0. Run the input. The renderer refuses the candidate and retains the previously accepted scene while the context is live.
4. Select **Reset example** to restore the exact original source.

The actual browser flow also changed an accepted scene and observed changed pixels. It then submitted `20rad` as a rotation, observed refusal, and checked that the accepted frame remained. A `version: 1` header alone does not change a source0 parser. Read the [complete scene language](./language) for all six shapes, defaults, cascade and errors.

## Host-controlled material blend

The two images show the same CAD-derived mesh with two admitted uniform values:

| Amount0: blue endpoint | Amount1: orange endpoint |
| --- | --- |
| ![Actual opaque mesh material with amount0](/examples/gpu-material.png) | ![Actual same opaque mesh material with amount1](/examples/gpu-material-amount1.png) |

The geometry stays the same. A real MeshRenderer draws it. The material changes its opaque fragment color:

```css
@shader #blend {
  @uniform amount: float(0,1,0);
  @let ratio: float(smoothstep(0,1,amount));
  @fragment {
    color: mix(#2060D0,#F09030,ratio);
  }
}
```

The portal supplies amount0 initially. The **Material amount** slider supplies a value from0 to1; the visible label shows `amount=value`. At.5, the easing ratio is.5. Color mixing happens in linear color, so the displayed midpoint need not equal the arithmetic mean of the input RGB bytes.

```ts
import { compileMeshMaterial } from '@barocss/gpu';

const compiled = compileMeshMaterial(source);
if (!compiled.ok) throw new Error(JSON.stringify(compiled.diagnostics));

function setAmount(amount: number) {
  const result = renderer.setMaterial({
    material: compiled.material,
    uniforms: { amount }
  });
  if (!result.ok) throw result.error;
}
setAmount(0);
setAmount(.5);
setAmount(1);
```

This function assumes the mesh renderer from the next section. A material source creates no geometry and no timer. The host owns the uniform values and scheduling. Read the [material grammar and complete function table](./material-language).

### Exercise errors without guessing the result

| Change | Expected result |
| --- | --- |
| Bind `{amount: .5}` | Accepted |
| Bind `{amount: 2}` | Refused: outside the declared0..1 range |
| Bind `{missing: .5}` | Refused: unknown uniform name |
| Bind `{}` | Uses the declared amount default0 |
| Change `mix` to `unknown` | Compile failure with `SYNTAX` code |
| Use declared range-1..1 directly as the `mix` ratio | Compile failure with `RANGE` code |
| Change output to `color: amount;` | Compile failure with `TYPE` code |

The actual browser flow changed amount0 to1 and observed changed pixels. It then submitted `unknown()` and observed refusal with the accepted frame retained. `setMaterial(null)` clears the material. Clear overlays and face/object selections before adopting an opaque material.

## CAD surface to a rendered mesh

![Actual GPU mesh rendering of a weighted CAD NURBS surface](/examples/cad-surface.png)

The surface and material examples use the same source geometry. The packet is a sampled preview of the native CAD surface. The surface view adds sampled U/V grid paths as a host visual aid. That grid is not native topology or a Solid certificate.

```css
@model patch {
  version: 0;
  length-unit: mm;
  @surface #weighted {
    type: nurbs;
    degree-u: 1; degree-v: 1;
    knots-u: [0,0,1,1]; knots-v: [0,0,1,1];
    control-points: [[[0,0,0],[1,7,3]],[[9,2,4],[12,8,-2]]];
    weights: [[1,2],[3,4]];
  }
}
```

Native surface coordinates use millimeters. The renderer uses scene units. Conversion occurs once in `MeshOptions.mmToSceneUnit`; it does not change the source coefficients.

The following public-import code performs the compile, sample and mount sequence. `canvas` must be an `HTMLCanvasElement`; `cadSource` is the complete source above. This minimal mount omits the host's optional sampled grid overlay.

```ts
import {
  compileCadModel,
  evaluateSurface,
  tessellateSurface
} from '@barocss/cad';
import { mountMesh } from '@barocss/gpu';

const compiled = compileCadModel(cadSource, { sourceVersion: 0 });
if (!compiled.ok) throw new Error(JSON.stringify(compiled.diagnostics));
const surface = compiled.model.objects.find(object => object.kind === 'surface');
if (!surface) throw new Error('Expected a Surface');

const sampled = tessellateSurface(surface, {
  countU: 17,
  countV: 17,
  revision: 0
});
console.log(evaluateSurface(surface, .5, .5));
console.log(sampled.report.vertexCount, sampled.report.triangleCount);
console.log(sampled.report.certified);

canvas.width = 800;
canvas.height = 500;
const renderer = mountMesh(canvas, sampled.packet, {
  mmToSceneUnit: .12,
  translate: [-.7,-.45,0],
  color: [.22,.65,.85],
  background: [.063,.094,.125],
  camera: {
    eye: [2,1.6,3],
    target: [0,0,0],
    up: [0,1,0],
    fovYDegrees: 45,
    near: .01,
    far: 100
  }
});
```

At U=.5 and V=.5, the weighted surface point is `[7.7,5.2,1]` millimeters. The17×17 sampling grid creates289vertices and512triangles. The report's `certified` field is false. Sampled deviation is an observation, not a proof of maximum error over the continuous surface.

The eye, target, clipping and translation values use scene units. The up vector is dimensionless. A source Z value of4mm contributes`.48` scene units before translation at the scale`.12`.

Change one weight and run the surface input. The native point and packet change. Change only a material uniform and the packet geometry stays the same. Read the [CAD language](/packages/cad/language) for knots, coefficients, weights and original-domain rules.

## Compile and inspect without a browser

The portal also has an executed CPU-only material example. It compiles the fragment language, validates owned IR, lowers the uniform layout and refuses an unsupported function:

```ts
import {
  compileMeshMaterial,
  validateMeshMaterialIR,
  lowerMeshMaterial
} from '@barocss/gpu';

const result = compileMeshMaterial(`
@shader #wave {
  @uniform timeSeconds: float(0,2,0);
  @fragment {
    color: mix(#204080,#E08020,sin(timeSeconds*1.5707963267948966)*0.5+0.5);
  }
}`);
if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
const material = validateMeshMaterialIR(result.material);
const lowered = lowerMeshMaterial(material);
if (lowered.uniformLayout.length !== 1 ||
    lowered.uniformLayout[0].name !== 'timeSeconds') {
  throw new Error('Uniform layout mismatch');
}
const refused = compileMeshMaterial('@shader #bad { @fragment { color: unknown(); } }');
if (refused.ok) throw new Error('Unsupported function was accepted');
console.log(material.shaderId, lowered.uniformLayout[0], refused.diagnostics);
```

Run the saved app-local consumer:

```sh
node apps/library-docs/scripts/run-snippet.mjs
```

The saved module is `apps/library-docs/scripts/snippets/material.mjs`. Its receipt is `apps/library-docs/evidence/material-snippet.json`: shader ID `wave`, uniform `timeSeconds` min0/max2/default0, generated name `mat_u_0`, refused code `SYNTAX`,222own source inputs and0own dist inputs. This CPU flow draws nothing.

The detailed language examples were also executed through a bounded source bundle: the cascade produced radii`.5` and2; the six-shape scene compiled; the blend, pulse, easing, power/min/max and radians/abs programs compiled and lowered. The wrong box property and out-of-range declared mix ratio were refused. This check covers those exact CPU inputs. It does not establish drawing every shape or every material expression.

Run the saved exact language inputs with the portal's source runner:

```sh
node apps/library-docs/scripts/run-example.mjs apps/library-docs/scripts/snippets/gpu-language-example.ts
```

The command checks its assertions and prints the accepted values and refusal codes. Its recorded receipt is `apps/library-docs/evidence/examples-gpu-language.md`.

## Existing repository hosts and focused fixtures

For the existing GPU source host, run from the repository root:

```sh
pnpm dev:gpu
```

This host transforms explicit original source entries in memory. Its default port is5180; use its printed URL. The ordinary-public-import consumer is described in `examples/workspace-source/README.md`. These hosts have different entry-selection evidence.

| Task | Repository file | What to inspect |
| --- | --- | --- |
| Source parser/compiler | `packages/barocss-gpu/src/scene-front.ts` | Original ranges, versions and cascade |
| Rotated source scene | `examples/gpu-scene/rotation-smoke.mjs` | Source1, camera, invalid-update retention |
| CAD Surface conversion | `examples/cad-nurbs/preview-flat.css` | Original mm coordinates and packet parameters |
| Coordinate refusal | `examples/gpu-scene/surface-coordinate-admission-flow.mjs` | CPU conversion and intentional null-context boundary |
| General CPU Engine | [Public Engine declarations](./reference#declarations-6908f7b659fc) | Original hierarchy versus derived bounds/draws |

Historical receipts describe their actual executed scope. A fixture's presence does not prove it passed on your machine. Select a task-specific fixture when you need more evidence.

## Separate compiled checkpoint

```sh
pnpm --filter @barocss/gpu build:library
```

This emits built JS and declarations. A compiled consumer needs complete publication maps of every transitive workspace package; a direct GPU dist import can still mix source dependencies. The portal source examples are separate from an emitted consumer test.

At this snapshot, use the admitted SDF or mesh renderer. Prepared #1183/#1184 fixtures do not establish an available general Engine renderer.

[Scene language](./language) · [Material language](./material-language) · [Quickstart](./quickstart) · [API](./api) · [Limits](./limits)
