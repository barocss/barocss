# GPU API

Use the task contracts below to check inputs, ownership, errors and lifecycle. Follow [Examples](./examples) for complete application inputs.


Import public values/types from `@barocss/gpu`. `/source` names the same root entry at this parent. Do not deep-import an internal source file merely because it has an `export` statement. Workspace entries select TypeScript source; complete publication maps select built JS/declarations.

## Evaluate authored material color on the CPU

The [CPU material guide](./cpu-material-evaluation) explains `evaluateAuthoredMaterial(input: unknown): AuthoredMaterialSample`, `AuthoredMaterialRequest`, `AuthoredMaterialEvaluationError` and its diagnostic codes. Supply a complete admitted material, uniform values and UV when required. It returns an independent, deeply frozen linear RGB sample. This newer API has a separate availability note; the general contracts below retain the earlier snapshot.

## Scene compiler and live renderer

| Call | Result / failure |
| --- | --- |
| `compileGpu({kind:'scene',source,sourceVersion?:1})` | `GpuCompileResult`; failure diagnostics, no WebGL |
| `compileGpu({kind:'mesh',packet,options})` | Indexed-mesh IR/execution or diagnostics |
| `parseScene(source,options?)` | Validated Scene; `SceneError` on refusal |
| `compileScene(scene)` | `{vertex,fragment}` shader strings |
| `mountScene(canvas,source,camera?)` | Live source0 `SceneRenderer` |
| `mountScene(canvas,source,camera,{sourceVersion:1})` | Live source1 `SceneRenderer<1>` |

A live SceneRenderer exposes `scene`, `shaders`, `camera`, `update(source)`, `setCamera(camera)`, `resize(width,height)`, `readPixels()` and `dispose()`. Update/camera returns `{ok:true}` or `{ok:false,error}`. Resize/read operations may throw. Context loss requires a new mount. ReadPixels returns owned RGBA8 data in WebGL readback order.

## Mesh preparation and camera

`prepareMesh(packet:unknown,options:unknown)` returns copied validated packet/options, Float32 positions/normals and Uint16 indices. `mountMesh(canvas,packet,options,overlay?,highlight?)` returns MeshRenderer. Optional overlay/highlight arguments have their own public types and validation; `null` explicitly clears a selection where the live method requires it.

`MeshOptions` requires positive `mmToSceneUnit`, XYZ `translate`, normalized opaque RGB `color` and `background`; optional `camera` and `lighting` add their separate contracts. `MeshCamera` requires XYZ `eye`, `target`, `up`, `fovYDegrees`, `near`, `far`. Eye/target/clipping values use scene units; up is dimensionless.


---

Source snapshot: local Git `5f5ad866205a21510ac69552e704cc162fa253b5`. `packages/barocss-gpu/package.json` (Manifest; local source), `packages/barocss-gpu/src/index.ts` (public root; local source), `packages/barocss-gpu/README.md` (package README; local source). Source paths identify that fixed local snapshot. Local source is the authority for this manual.

[Overview](./) · [Quickstart](./quickstart) · [Guides](./guides) · [API](./api) · [Examples](./examples) · [Limits](./limits)
