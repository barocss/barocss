# GPU API

Use the task contracts below to check inputs, ownership, errors and lifecycle. Follow [Examples](./examples) for complete application inputs.


Import public values/types from `@barocss/gpu`. `/source` names the same root entry at this parent. Do not deep-import an internal source file merely because it has an `export` statement. Workspace entries select TypeScript source; complete publication maps select built JS/declarations.

## Evaluate authored material color on the CPU

The [CPU material guide](./cpu-material-evaluation) explains `evaluateAuthoredMaterial(input: unknown): AuthoredMaterialSample`, `AuthoredMaterialRequest`, `AuthoredMaterialEvaluationError` and its diagnostic codes. Supply a complete admitted material, uniform values and UV when required. It returns an independent, deeply frozen linear RGB sample. This newer API has a separate availability note; the general contracts below retain the earlier snapshot.

## Scene compiler

| Call | Result / failure |
| --- | --- |
| `compileGpu({kind:'scene',source,sourceVersion?:1})` | `GpuCompileResult`; failure diagnostics, no GPU call |
| `compileGpu({kind:'mesh',packet,options})` | Indexed-mesh IR/execution or diagnostics |
| `parseScene(source,options?)` | Validated Scene; `SceneError` on refusal |
| `compileScene(scene)` | `{vertex,fragment}` shader strings (data; nothing draws them) |

## Viewer

The WebGPU viewer core is the package's only renderer. It is exported from the root and from `@barocss/gpu/viewer`.

| Call | Result / failure |
| --- | --- |
| `createViewer(canvas,options?)` | `Promise<Viewer>`; rejects with `ViewerError` (`webgpu-unavailable`, `no-adapter`, `no-context`) |
| `viewer.add(geometry,{material,transform,instances,name,visible,pickable})` | `Mesh`; `geometry` is a `GeometryInput` or a shared `viewer.createGeometry(input)` |
| `viewer.remove(mesh)`, `mesh.remove()`, `viewer.clear()` | Removes one mesh, or every mesh and geometry |
| `viewer.fit(box?)`, `viewer.camera`, `viewer.controls` | Frames the scene (or a box); camera state; orbit controls (`null` with `controls:false`) |
| `viewer.pick(x,y)` | `Promise<PickHit \| null>` from the GPU id/depth targets (CSS pixels) |
| `viewer.raycast(x,y)`, `viewer.pickLine(x,y,radius?)` | `PickHit \| null` / `LineHit \| null` at once on the CPU |
| `viewer.frame()`, `viewer.capture()` | Next drawn frame; `Promise<{width,height,data}>` RGBA rows from the top |
| `viewer.lights`, `viewer.environment`, `viewer.grid`, `viewer.setBackground(b)` | Directional/point/spot lights, hemisphere ambient, exposure, tone mapping, ambient occlusion, ground grid |
| `viewer.dispose()` | Releases the device, buffers, textures and listeners; later calls throw `ViewerError('disposed')` |

`GeometryInput` holds `positions` and optional `normals` (computed when left out), `uvs`, sRGB `colors`, `indices`, `topology:'triangles'|'lines'`, and per-triangle `faces` or per-segment `edges` ids that picking reports. A `Material` has `color` (it multiplies a map's texel and a shader's colour), `opacity`, `metallic`, `roughness`, `emissive`, `unlit`, `doubleSided`, `lineWidth` (CSS pixels), `shadowOnly`, `map` (`viewer.createTexture`) and `shader`. Assigning `mesh.material = {...}` merges the fields and redraws. `mesh.transform` is 16 column-major numbers; `translation`, `rotation`, `multiply`, `lookAt` and `invert` build them.

A lost device is replaced and the scene re-uploaded; `viewer.onRecover` runs after that and `viewer.stats.deviceLosses` counts it. GPU errors the browser reports outside any check go to `options.onError` (default `console.error`).

## Scene language and authored materials on the viewer

| Call | Result / failure |
| --- | --- |
| `showScene(viewer,source,{segments,fit,background,transform}?)` | `SceneView` with `meshes` by object id, `result`, `update(source)`, `dispose()`; a first source that does not compile throws `SceneViewError` |
| `view.update(source)` | `{ok:true}` or `{ok:false,diagnostics}`; a refused source keeps the shown scene |
| `materialShader(source,params?)` | `{ok:true,shader,uniforms,usesUV}` or `{ok:false,diagnostics}`; params override uniform defaults and are clamped to their ranges |
| `bindingShader(binding)` | `ShaderMaterial` for a `MeshMaterialBinding` (validate it first with `validateMeshMaterialBinding`) |
| `uv01Shader(material,uniforms)` | `ShaderMaterial` for a native Surface UV01 material; reads the geometry's `uvs` |

`showScene` reads the source version from its header (`version: 1;` selects source1). It tessellates each primitive with the package's geometry builders and shares a geometry between objects of the same shape.

## Mesh preparation and camera

`prepareMesh(packet:unknown,options:unknown)` returns copied validated packet/options, Float32 positions/normals and Uint16 indices. Its arrays can be passed to `viewer.add`. `MeshOptions` requires positive `mmToSceneUnit`, XYZ `translate`, normalized opaque RGB `color` and `background`; optional `camera` and `lighting` add their separate contracts. `MeshCamera` requires XYZ `eye`, `target`, `up`, `fovYDegrees`, `near`, `far`. Eye/target/clipping values use scene units; up is dimensionless. These validated records remain data contracts (for example for `@barocss/viewer`); the viewer's own `Camera` uses `position`, `target`, `up` and `fovY` in degrees.

The earlier `mountScene`/`SceneRenderer`, `mountMesh`/`MeshRenderer`, `mountMeshScene`, `mountPrimitiveScene*`, `mountPrimitiveViewport`, `mountBooleanShell*`, `mountMixedDepthScene` and `mountQualifiedFaceScene` renderers are removed. Draw with `createViewer` and `showScene` instead.

---

Source snapshot: local Git `c79d752cb3463a34e6c93cb64e3693bc493c271f` (the WebGPU viewer; the earlier renderers were removed after `5f5ad866205a21510ac69552e704cc162fa253b5`). `packages/barocss-gpu/package.json` (Manifest; local source), `packages/barocss-gpu/src/index.ts` (public root; local source), `packages/barocss-gpu/README.md` (package README; local source). Source paths identify that fixed local snapshot. Local source is the authority for this manual.

[Overview](./) · [Quickstart](./quickstart) · [Guides](./guides) · [API](./api) · [Examples](./examples) · [Limits](./limits)
