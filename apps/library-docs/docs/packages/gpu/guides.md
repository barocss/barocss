# GPU guides

## Replace a scene safely

Keep the accepted source in host state. Treat an edit as a candidate:

```ts
const result = view.update(candidateSource);
if (result.ok) {
  acceptedSource = candidateSource;
} else {
  errorText = result.diagnostics.map(d => `${d.code}: ${d.message}`).join('\n');
}
```

Here `view` is the `SceneView` that `showScene` returned in the [quickstart](./quickstart), and the three host variables belong to your editor. A source that does not compile leaves the shown meshes and `view.result` unchanged. An accepted source replaces every mesh of the view; shapes no longer used release their geometry. Diagnostics carry a code (`SYNTAX`, `VALIDATION`, `LIMIT`, `VERSION`, …) and a source range; do not label every failure as a parser error.

The camera is viewer state, not scene source: `viewer.camera` (position, target, up, `fovY` in degrees, projection), `viewer.fit()` and the orbit controls change presentation only. They do not edit source or native CAD geometry. With the default `autoResize`, the viewer follows the canvas's CSS size; with `autoResize: false` call `viewer.setSize(width, height)`. Stop calls after `dispose()`; a disposed view throws `SceneViewError` and a disposed viewer throws `ViewerError('disposed')`.

## Compile typed generation before displaying it

The [generated scene guide](./generated-scene) preserves complete authored Source2, typed values, repeat IDs and conditional decisions alongside its selected scene. Re-find public token ranges after every accepted source edit. Its 2D canvas diagnostic host stages a drawing before adoption; no Source2 `showScene` support, shader execution or public bounds result is implied. `showScene` above shows Source0/1 only.

## Display a CAD Surface

Use CAD to sample the native Surface. Keep the original model and the tessellation report. Pass the resulting packet to the viewer with one explicit conversion:

```ts
import { compileCadModel, tessellateSurface } from '@barocss/cad';
import { prepareMesh, createViewer } from '@barocss/gpu';

const native = compileCadModel(surfaceSource, { sourceVersion: 0 });
if (!native.ok) throw new Error(native.diagnostics[0].message);
const surface = native.model.objects.find(object => object.kind === 'surface');
if (!surface || surface.kind !== 'surface') throw new Error('A Surface is required');
const { packet, report } = tessellateSurface(surface, {
  countU: 8, countV: 8, revision: 0,
});
const options = {
  mmToSceneUnit: 0.001,
  translate: [0, 0, 0] as [number, number, number],
  color: [0.25, 0.6, 0.9] as [number, number, number],
  background: [0.06, 0.09, 0.12] as [number, number, number],
};
const cpu = prepareMesh(packet, options);
console.log(cpu.positions.length, report.maxSampledDeviationMM);
const viewer = await createViewer(canvas, { background: options.background, camera: { up: [0, 1, 0], position: [0, 0, 1] } });
const s = options.mmToSceneUnit, [x, y, z] = options.translate;
const mesh = viewer.add(
  { positions: packet.positions, normals: packet.normals, indices: packet.indices },
  { material: { color: options.color, doubleSided: true }, transform: [s,0,0,0, 0,s,0,0, 0,0,s,0, x,y,z,1] },
);
viewer.fit();
// On teardown: viewer.dispose();
```

`surfaceSource` is an authored source0 string; `canvas` is a host-owned canvas. The [CAD example](../cad/examples#sample-a-plane-and-prepare-gpu-buffers) supplies a complete plane literal for this path.

The packet preserves authored XYZ in millimetres and declares right-handed Y-up. Here the mesh transform (16 column-major numbers) scales mm to metres once and then adds `translate` in scene units; `prepareMesh` returns the same conversion as Float32 `positions` (already in scene units) if you prefer to add those with an identity transform. The packet's U/V parameters are native evaluation coordinates, not texture UVs. Do not scale the packet first and then scale it again in the transform. Do not silently rotate a Z-up model by changing metadata.

`prepareMesh` is a CPU operation. Its Float32 positions/normals and Uint16 indices are owned output buffers. It validates conversion, triangle area and winding. A successful CPU preparation does not establish a successful draw. The report's sampled deviation is an observation, not a certified tolerance. For U/V grid lines over the patch, add a second mesh with `topology: 'lines'` and segment-pair `indices` over the same positions, as the [playground surface](/playground#cad-surface) does.

## Bind a material and retain accepted state

For pure reusable expressions, follow [the easing and palette shader](./reusable-shader) and [open its language example](/examples/language#reusable-shader). Its separate newer source profile admits bounded `@fn` float/color results while retaining the existing public material APIs. The caller supplies UV, uniforms and time; the older examples below keep their stated profiles.

Compile the material before you add its mesh. Lower an accepted binding to a viewer shader material and assign it with a white colour: `mesh.material = { color: [1, 1, 1], shader: bindingShader(validateMeshMaterialBinding({ material, uniforms })) }`. The viewer multiplies the shader's colour by the mesh colour (and any `map`), so any other colour tints the material. `validateMeshMaterialBinding` throws on an unknown or out-of-range uniform, so a refused candidate never reaches the mesh and the accepted shader stays drawn; update host state only after the assignment. `materialShader(source, params)` compiles and lowers in one call but clamps params into their declared ranges instead of refusing them.

The [material setup recipe](./material-language#complete-blend-material) includes a named slider listener and cleanup. The [caller-time recipe](./material-language#supply-caller-time-on-demand) maps elapsed seconds into the declared0..2 range and samples only on a button click. Both remove caller-owned listeners before viewer disposal. These source-backed host recipes are separate from the recorded playground browser checks.

## Evaluate a discrete palette

Use [Discrete threshold selection](./discrete-material) for `select(value, literalThreshold, below, otherwise)`. Strict `<` chooses the first branch; equality chooses the second. Compile and validate the whole material before public CPU evaluation, then adopt the new result only on success. Its separate profile has no UV, public mesh binding or GPU execution in this example. Keep a current explicit uniform override after source edits; a narrowed range can refuse it instead of silently adopting a new default.

## Show several meshes and select them

There is one renderer: add every mesh to the same viewer. Share a geometry between meshes with `viewer.createGeometry(input)`, or draw many copies in one call with `instances: { transforms, colors? }`. Give each mesh a `name`, and pass `faces` (one id per triangle) or `edges` (one id per segment) in its geometry when picking should report CAD face or edge ids.

`viewer.raycast(x, y)` answers at once on the CPU; `await viewer.pick(x, y)` reads the GPU's id and depth targets. Both take canvas CSS pixels and return the mesh, world point, triangle, `face` id and instance, or null. `viewer.pickLine(x, y, radius)` finds the nearest drawn segment and its `edge` id. Set `mesh.outline = '#e8c25a'` to outline a selection and `mesh.outline = null` to clear it.

The removed `mountMeshScene`, `mountPrimitiveScene*`, `mountBooleanShell*`, `mountMixedDepthScene` and `mountQualifiedFaceScene` renderers have no replacement mount: their CPU preparers (`preparePrimitiveSceneFrame`, `prepareBooleanShellBuffers`, `prepareMixedDepthFrame`, `prepareQualifiedFaceScene`, …) still return data, and `@barocss/viewer` draws its native scenes on this viewer. Face, object and edge selections are display metadata. Preserve qualified owning IDs. A naked local face ID can collide between assets.

## Prepare a general Engine scene on CPU

Choose `prepareTriangleGeometry` for indexed original triangle geometry and `prepareEngineScene` for a version0 hierarchy, materials and camera. That scene uses right-handed Y-up and `positionUnit:'scene'`; it is not a CAD millimetre packet. Parent IDs, geometry IDs and material IDs must resolve in the original record. Prepared world matrices, bounds and draws are derived records.

Use `prepareEngineCameraRay` and `raycastEngineScene` for their bounded CPU query path. `prepareEngineSceneFrustum` classifies against the admitted camera. Translation, quaternion rotation and positive local-scale clips have separate samplers. They return data; the host controls time, adoption and rendering. Texture, opacity and lighting binding APIs prepare bounded CPU companions. None of these preparers draws anything; add their geometry to a viewer yourself.

## Teardown and recovery

Call `view.dispose()` and `viewer.dispose()` when the view is removed. Both are idempotent. Do not destroy a caller-owned canvas or unrelated host object as part of package cleanup; the viewer removes its own controls and resize observer. When the GPU device is lost, the viewer requests a new device and re-uploads its scene itself; `viewer.onRecover` runs afterwards and `viewer.stats.deviceLosses` counts the losses. Retain native models and packets independently from GPU resources.

---

Source snapshot: local Git `e532fc3037f9c1e13819b61d63de06164c50128f` (the WebGPU viewer; the earlier renderers were removed after `5f5ad866205a21510ac69552e704cc162fa253b5`). `packages/barocss-gpu/package.json` (Manifest; local source), `packages/barocss-gpu/src/index.ts` (public root; local source), `packages/barocss-gpu/README.md` (package README; local source). Source paths identify that fixed local snapshot. Local source is the authority for this manual.

[Overview](./) · [Quickstart](./quickstart) · [Guides](./guides) · [API](./api) · [Examples](./examples) · [Limits](./limits)


## Repeat UV patterns with explicit controls

[Woven grid](./weave-shader), [contour bands](./contour-shader) and [halftone dots](./halftone-shader) are separate complete material programs. Each guide explains its source, controls, numerical checks and actual browser image. Open its language sample to edit the program and inspect the result.

These examples reuse the Manual's public repeating-UV material profile and its app-owned WebGL2 quad (application code, not a package renderer). The host supplies phase and Play/Pause. Compilation and CPU evaluation create no clock or renderer. The displayed patterns change color, not native geometry.
