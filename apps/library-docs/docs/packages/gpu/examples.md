# GPU examples

Start the [visual playground](/playground). It runs the real source APIs in your browser. Choose **GPU scene** to edit shapes, or **GPU material** to change the color of a CAD-derived mesh. Each example shows its input, accepted result and diagnostics.

The scene and mesh-material examples below describe the local experimental `@barocss/gpu` version0.0.0 at source snapshot `e532fc3037f9c1e13819b61d63de06164c50128f`, where the WebGPU viewer is the only renderer. The scene samples use source1; the material samples use `mesh-opaque-fragment-v0`. The images were captured from the earlier renderers at `5f5ad866205a21510ac69552e704cc162fa253b5`; the playground draws the same inputs on the viewer, so shading and framing differ.

## Procedural UV plasma

The [advanced shader example](./advanced-shader) combines UV wrapping, domain distortion, interference waves and diagonal highlights. Edit the full shader, adjust four uniforms, or use its host Play/Pause controls. Its separate API version and example WebGL2 host are stated in the guide.

The [interference caustics example](./caustics-shader) combines crossing wave fields and narrow highlights. It has its own editable source and controls and uses the same public UV material profile and example host.

## More scene and material examples

[Reuse a float easing function and a color palette](./reusable-shader) in the [new language example](/examples/language#reusable-shader). Its complete `@fn` program uses a separate newer source profile; it changes fragment color on a fixed UV quad and adds no Scene shape or clock.

Use [GPU compositions](./composition-examples) for style precedence, local rotations and a material transition window. Each source is complete and editable in the playground.

## Typed parameters, repeats and conditions

[Open Generated scene](/examples/language#generated-scene) and read [the complete Source2 input](./generated-scene). Compare equality, stable repeat IDs and a third stud at the common origin. The separate profile supplies frozen source/AST/scene/shader data; an application 2D canvas view draws diagnostic local boxes while the shader text remains unexecuted.

## Inspect material color without a display

Use the [public CPU evaluation example](./cpu-material-evaluation) to inspect linear RGB from a compiled shader, explicit uniforms and UV. It explains defaults, copied immutable results, zero handling and genuine range errors. Its numeric result is separate from a GPU frame.

### Discrete threshold palette

[Select a color at an exact threshold](./discrete-material) in the [CPU language example](/examples/language#discrete-material). The separate discrete material profile chooses dark or light colors across .5. An application 2D canvas displays three public CPU reference values and the current color; lowered GLSL remains unexecuted text.

## Run the portal

Open the [playground](/playground) and select a sample. Edit its complete source, then select **Run input**. Use **Reset example** to restore the original input. See [Use the interactive examples](/concepts/run-examples) for input selection, browser requirements and result interpretation.

The API code below belongs in a browser host with a TypeScript-capable bundler. WebGPU is required for the scene, surface and material views; `createViewer` rejects with a `ViewerError` without it. The host owns the canvas, controls and source editing. It displays compilation or rendering errors when an input cannot be adopted.

## Rotated box and sphere

![Actual GPU source1 scene: orange sphere beside rotated blue box](/examples/gpu-scene.png)

This image shows the source1 scene (captured from the earlier SDF renderer). The left object is an orange sphere. The right object is a rotated blue box. Both come from the following complete source:

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
import { createViewer, showScene } from '@barocss/gpu';

const viewer = await createViewer(canvas, { camera: { position: [2, 1.6, 3], target: [0, 0, 0], up: [0, 1, 0] } });
const view = showScene(viewer, source);
const scene = view.result.execution.kind === 'sdf' ? view.result.execution.scene : null;
console.log(scene?.objects.map(object => ({
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
3. Change its radius to0. Run the input. `view.update` refuses the candidate with its diagnostics and keeps the previously accepted scene.
4. Select **Reset example** to restore the exact original source.

A `version: 1` header alone does not change `parseScene` or `compileGpu`; pass the explicit source1 option to them. `showScene` reads the header itself. A rotation such as `20rad` is refused because this grammar requires degrees. Read the [complete scene language](./language) for all six shapes, defaults, cascade and errors.

## Compare all six source1 primitives

Open [GPU six shapes](/playground#gpu-six-shapes). This source1 scene compares all six admitted shapes:

![Actual source1 SDF scene showing six distinct primitives in two rows](/examples/gpu-six-shapes.png)

| Position | ID / shape | Color | Dimensions before rotation |
| --- | --- | --- | --- |
| Top left | `ball` / sphere | Orange | Radius`.4`, diameter`.8` |
| Top center | `block` / box | Blue | Full size`.7 × .9 × .6` |
| Top right | `post` / cylinder | Green | Radius`.35`, full height1 |
| Bottom left | `pill` / capsule | Purple | Radius`.25`, center segment length`.8`, overall Y extent1.3 |
| Bottom center | `case` / rounded-box | Pink | Full outer size`1 × .8 × .6`, rounding radius`.1` |
| Bottom right | `ring` / torus | Yellow | Major radius`.55`, minor radius`.15`, outside diameter1.4 |

The box has Y rotation25deg. The torus has X rotation90deg, which turns its ring toward the camera. These rotations change orientation, not authored dimensions. The viewer draws each shape as a tessellated mesh; this is not a native CAD geometry or Boolean certificate.

The complete input is:

```css
@scene sixShapes {
  version: 1;
  background: #101820;
  sphere #ball;
  box #block;
  cylinder #post;
  capsule #pill;
  rounded-box #case;
  torus #ring;
}
#ball { radius: .4; translate: -2 1 0; color: #F1AA55; }
#block { size: .7 .9 .6; translate: 0 1 0; rotate-y: 25deg; color: #57B4D9; }
#post { radius: .35; height: 1; translate: 2 1 0; color: #95D88B; }
#pill { radius: .25; start: 0 -.4 0; end: 0 .4 0; translate: -2 -1 0; color: #CA97E5; }
#case { size: 1 .8 .6; radius: .1; translate: 0 -1 0; color: #ED8090; }
#ring { major-radius: .55; minor-radius: .15; translate: 2 -1 0; rotate-x: 90deg; color: #F0D670; }
```

The host uses the same public call as the first scene example: `showScene(viewer, source)`. The result contains six objects in declaration order. Each reports its ID, type, translation and rotation. The source name is `sixShapes`.

1. Set the ring's `rotate-x` to0deg and run. Its plane returns to local XZ, making the camera view more edge-on.
2. Set the capsule's `end` to`0 .8 0` and run. Its center segment grows from`.8` to1.2; the two hemispherical ends retain radius`.25`.
3. Set the ring's minor radius to`.55`. Run. Equal major/minor radii are refused, because no positive ring hole remains. The live view keeps its accepted scene.
4. Reset the example to restore the exact six-shape source.

The [scene grammar](./language#source1-shapes-in-one-complete-input) explains each shape's Float32 boundary checks and the required source1 option.

## Host-controlled material blend

The two images show the same CAD-derived mesh with two admitted uniform values:

| Amount0: blue endpoint | Amount1: orange endpoint |
| --- | --- |
| ![Actual opaque mesh material with amount0](/examples/gpu-material.png) | ![Actual same opaque mesh material with amount1](/examples/gpu-material-amount1.png) |

The geometry stays the same. The WebGPU viewer draws it. The material changes its opaque fragment color:

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
import { compileMeshMaterial, validateMeshMaterialBinding, bindingShader } from '@barocss/gpu';

const compiled = compileMeshMaterial(source);
if (!compiled.ok) throw new Error(JSON.stringify(compiled.diagnostics));

function setAmount(amount: number) {
  // Throws on an unknown or out-of-range uniform; the drawn material stays.
  const binding = validateMeshMaterialBinding({ material: compiled.material, uniforms: { amount } });
  // White: the mesh colour multiplies the shader's colour.
  mesh.material = { color: [1, 1, 1], shader: bindingShader(binding) };
}
setAmount(0);
setAmount(.5);
setAmount(1);
```

This function assumes the `mesh` that `viewer.add` returned in the next section. `materialShader(source, { amount })` compiles and lowers in one call instead, but clamps the amount into its declared range. A material source creates no geometry and no timer. The host owns the uniform values and scheduling. Read the [material grammar and complete function table](./material-language).

For separate complete inputs for all11functions, read [GPU function examples](./function-examples). The cosine sample uses a complete cycle: amounts0, .5 and1 produce ratios1, 0 and1. The clamp sample limits its mix ratio to.25 through.75, so those amounts produce ratios.25, .5 and.75. Both use the same admitted mesh and host-controlled amount contract.

### Exercise errors without guessing the result

| Change | Expected result |
| --- | --- |
| Bind `{amount: .5}` | Accepted |
| Bind `{amount: 2}` | `validateMeshMaterialBinding` refuses: outside the declared0..1 range (`materialShader` clamps it to1) |
| Bind `{missing: .5}` | `validateMeshMaterialBinding` refuses: unknown uniform name |
| Bind `{}` | Uses the declared amount default0 |
| Change `mix` to `unknown` | Compile failure with `SYNTAX` code |
| Use declared range-1..1 directly as the `mix` ratio | Compile failure with `RANGE` code |
| Change output to `color: amount;` | Compile failure with `TYPE` code |

Changing amount0 to1 changes the color endpoint. A candidate containing `unknown()` is refused by the compiler and supplies no replacement material. Keep the accepted binding after a refused edit. `mesh.material = { shader: null }` returns to the plain colour.

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

Native surface coordinates use millimeters. The viewer uses scene units. Conversion occurs once, in the mesh transform (scale `mmToSceneUnit`, then translate); it does not change the source coefficients.

The following public-import code performs the compile, sample and show sequence. `canvas` must be an `HTMLCanvasElement`; `cadSource` is the complete source above. This minimal host omits the playground's sampled grid lines.

```ts
import {
  compileCadModel,
  evaluateSurface,
  tessellateSurface
} from '@barocss/cad';
import { createViewer } from '@barocss/gpu';

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

const viewer = await createViewer(canvas, {
  background: [.063,.094,.125],
  camera: { position: [2,1.6,3], target: [0,0,0], up: [0,1,0], fovY: 45 }
});
const s = .12, [x, y, z] = [-.7,-.45,0];
const mesh = viewer.add(
  { positions: sampled.packet.positions, normals: sampled.packet.normals, indices: sampled.packet.indices },
  { material: { color: [.22,.65,.85], doubleSided: true }, transform: [s,0,0,0, 0,s,0,0, 0,0,s,0, x,y,z,1] }
);
viewer.fit();
```

At U=.5 and V=.5, the weighted surface point is `[7.7,5.2,1]` millimeters. The17×17 sampling grid creates289vertices and512triangles. The report's `certified` field is false. Sampled deviation is an observation, not a proof of maximum error over the continuous surface.

The camera position, target and translation values use scene units; `fovY` is in degrees. The up vector is dimensionless. The viewer fits its clip planes to the scene each frame, and `fit()` frames the mesh along the camera's direction. A source Z value of4mm contributes`.48` scene units before translation at the scale`.12`.

Change one weight and run the surface input. The native point and packet change. Change only a material uniform and the packet geometry stays the same. Read the [CAD language](/packages/cad/language) for knots, coefficients, weights and original-domain rules.

## Compile and inspect without a browser

Compile material text before drawing it. Compilation returns typed material data, called intermediate representation (IR). Validation checks that the data still matches its source. Lowering converts that validated data into a fragment expression and a uniform layout:

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
console.log(material.shaderId); // 'wave'
console.log(lowered.uniformLayout[0]); // Declared timeSeconds and generated mat_u_0.

const candidate = compileMeshMaterial('@shader #bad { @fragment { color: unknown(); } }');
if (!candidate.ok) console.log(candidate.diagnostics); // SYNTAX: unsupported function.
```

The `timeSeconds` uniform has min0, max2 and default0. It lowers to the generated name `mat_u_0`; bindings use the declared name `timeSeconds`. The compiler and lowerer create no timer, canvas or frame. The host supplies the time value and adopts the result by assigning `mesh.material = { color: [1, 1, 1], shader: bindingShader(binding) }`. Read [caller time and cleanup](./material-language#supply-caller-time-on-demand) for that lifecycle.

Scene sources (`showScene`) and CAD mesh packets (`viewer.add`) have separate inputs and share one viewer. A CPU Engine scene prepares hierarchy and query data; add its prepared geometry to a viewer to draw it. Read [CPU Engine guide](./guides#prepare-a-general-engine-scene-on-cpu) when using that separate format.

[Scene language](./language) · [Material language](./material-language) · [Quickstart](./quickstart) · [API](./api) · [Limits](./limits)


## Repeat UV patterns with explicit controls

[Woven grid](./weave-shader), [contour bands](./contour-shader) and [halftone dots](./halftone-shader) are separate complete material programs. Each guide explains its source, controls, numerical checks and actual browser image. Open its language sample to edit the program and inspect the result.

These examples reuse the Manual's public repeating-UV material profile and its app-owned WebGL2 quad (application code, not a package renderer). The host supplies phase and Play/Pause. Compilation and CPU evaluation create no clock or renderer. The displayed patterns change color, not native geometry.
