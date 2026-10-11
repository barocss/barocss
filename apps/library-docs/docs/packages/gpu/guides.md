# GPU guides

## Replace a scene safely

Keep the accepted source in host state. Treat an edit as a candidate:

```ts
const result = renderer.update(candidateSource);
if (result.ok) {
  acceptedSource = candidateSource;
} else {
  errorText = result.error.message;
}
```

Here `renderer` is the live `SceneRenderer` from the [quickstart](./quickstart), and the three host variables belong to your editor. An invalid source or failed candidate program leaves accepted scene state usable. A failed candidate draw attempts to restore the last accepted frame. Context loss can prevent that restoration; mount a new renderer after loss. Do not label every failure as a parser error.

`setCamera(camera)` returns the same `{ok:true}` or `{ok:false,error}` shape. Camera changes affect presentation. They do not edit source or native CAD geometry. `resize(width,height)` throws on invalid dimensions or failed allocation. Stop calls after `dispose()`.

## Display a CAD Surface

Use CAD to sample the native Surface. Keep the original model and the tessellation report. Pass the resulting packet to GPU with one explicit conversion:

```ts
import { compileCadModel, tessellateSurface } from '@barocss/cad';
import { prepareMesh, mountMesh } from '@barocss/gpu';

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
const display = mountMesh(canvas, packet, options);
// On teardown: display.dispose();
```

`surfaceSource` is an authored source0 string; `canvas` is a host-owned canvas. The [CAD example](../cad/examples#sample-a-plane-and-prepare-gpu-buffers) supplies a complete plane literal for this path.

The packet preserves authored XYZ in millimetres and declares right-handed Y-up. `mmToSceneUnit:0.001` converts mm to metres once. GPU then adds `translate` in scene units. The packet's U/V parameters are native evaluation coordinates, not texture UVs. Do not scale the packet first and then scale it again in GPU. Do not silently rotate a Z-up model by changing metadata.

`prepareMesh` is a CPU operation. Its Float32 positions/normals and Uint16 indices are owned output buffers. It validates conversion, triangle area and winding. A successful CPU preparation does not establish a successful draw. The report's sampled deviation is an observation, not a certified tolerance.

## Bind a material and retain accepted state

For pure reusable expressions, follow [the easing and palette shader](./reusable-shader) and [open its language example](/examples/language#reusable-shader). Its separate newer source profile admits bounded `@fn` float/color results while retaining the existing public material APIs. The caller supplies UV, uniforms and time; the older examples below keep their stated profiles.

Compile the material before mounting its mesh. If the first `setMaterial` call fails, dispose that newly mounted renderer before reporting the setup error. For a later uniform edit, update host state only when `setMaterial` succeeds. A refused candidate keeps the accepted binding while the context remains live.

The [material setup recipe](./material-language#complete-blend-material) includes a named slider listener and cleanup. The [caller-time recipe](./material-language#supply-caller-time-on-demand) maps elapsed seconds into the declared0..2 range and samples only on a button click. Both remove caller-owned listeners before renderer disposal. These source-backed host recipes are separate from the recorded playground browser checks.

## Select a larger preview profile

Use `mountMeshScene` for its bounded mesh scene; use `mountPrimitiveSceneV2` for its qualified native references and explicit versioned input. Read the exact public types in [API](./api) before constructing these records. They are separate from source0 SDF, general Engine Scene data and a native CAD document. A frame version does not change the native model version.

Face, object and edge selections are display metadata. Preserve qualified owning IDs. A naked local face ID can collide between assets. The native face-mesh `part-xyz` display adapter has a separate `(x,z,-y)` mapping; the Surface packet path above performs no such mapping.

## Prepare a general Engine scene on CPU

Choose `prepareTriangleGeometry` for indexed original triangle geometry and `prepareEngineScene` for a version0 hierarchy, materials and camera. That scene uses right-handed Y-up and `positionUnit:'scene'`; it is not a CAD millimetre packet. Parent IDs, geometry IDs and material IDs must resolve in the original record. Prepared world matrices, bounds and draws are derived records.

Use `prepareEngineCameraRay` and `raycastEngineScene` for their bounded CPU query path. `prepareEngineSceneFrustum` classifies against the admitted camera. Translation, quaternion rotation and positive local-scale clips have separate samplers. They return data; the host controls time, adoption and rendering. Texture, opacity and lighting binding APIs prepare bounded CPU companions. None of these preparers mounts the unmerged renderer from #1183/#1184.

## Teardown and recovery

Call the selected renderer's `dispose()` when its view is removed. It is idempotent. Do not destroy a caller-owned canvas, camera controller or unrelated host object as part of package cleanup. On WebGL context loss, stop mutations and remount with retained source and options. Retain native models and packets independently from GPU resources.

---

Source snapshot: local Git `5f5ad866205a21510ac69552e704cc162fa253b5`. `packages/barocss-gpu/package.json` (Manifest; local source), [public root](/packages/gpu/reference#declarations-5523de18ed63), `packages/barocss-gpu/README.md` (package README; local source). Source references identify that fixed snapshot. This native source commit is local-only; public declaration references open in this portal. Local source is the authority for this manual.

[Overview](./) · [Quickstart](./quickstart) · [Guides](./guides) · [API](./api) · [Examples](./examples) · [Limits](./limits)


## Repeat UV patterns with explicit controls

[Woven grid](./weave-shader), [contour bands](./contour-shader) and [halftone dots](./halftone-shader) are separate complete material programs. Each guide explains its source, controls, numerical checks and actual browser image. Open its language sample to edit the program and inspect the result.

These examples reuse the Manual's public repeating-UV material profile and its app-owned WebGL2 quad. The host supplies phase and Play/Pause. Compilation and CPU evaluation create no clock or renderer. The displayed patterns change color, not native geometry.
