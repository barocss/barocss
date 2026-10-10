# GPU API

Read the [complete public signature reference](./reference) for exact exported functions, types and public class members. This task page explains their support, ownership, errors and lifecycle.


Import public values/types from `@barocss/gpu`. `/source` names the same root entry at this parent. Do not deep-import an internal source file merely because it has an `export` statement. Workspace entries select TypeScript source; complete publication maps select built JS/declarations.

## Evaluate authored material color on the CPU

The [CPU material guide](./cpu-material-evaluation) explains `evaluateAuthoredMaterial(input: unknown): AuthoredMaterialSample`, `AuthoredMaterialRequest`, `AuthoredMaterialEvaluationError` and its diagnostic codes. Supply a complete admitted material, uniform values and UV when required. It returns an independent, deeply frozen linear RGB sample. This newer API has a separate availability note; the general reference below retains the earlier snapshot.

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

## Public root inventory

The following table lists actual re-exported symbols by declaration module. Links pin the manual's local source snapshot. Symbols in internal files that are absent from this root are excluded. This inventory establishes export presence, not execution of every API or general Engine rendering.

| Declaration group | Public names |
| --- | --- |
| [scene](/packages/gpu/reference#declarations-21b9b53efbc1) | `parseScene`, `SceneError`, `Scene`, `Scene1`, `SceneObject`, `SceneObject1`, `RotatedSceneObject`, `CylinderSceneObject`, `CapsuleSceneObject`, `RoundedBoxSceneObject`, `TorusSceneObject`, `AnyScene`, `SceneSourceOptions`, `RGB`, `Vec3` |
| [compiler](/packages/gpu/reference#declarations-a4c566884065) | `compileScene`, `GPU_LIMITS`, `SceneShaders` |
| [renderer](/packages/gpu/reference#declarations-e4bfc940eb6d) | `mountScene`, `SceneRenderer`, `GPUError`, `UpdateResult` |
| [mesh-packet](/packages/gpu/reference#declarations-1d58f59fb026) | `validatePreviewPacket`, `validateMeshOptions`, `prepareMesh`, `PreviewPacket`, `MeshOptions` |
| [mesh-lighting](/packages/gpu/reference#declarations-c5019b37f293) | `MeshLighting` |
| [mesh-renderer](/packages/gpu/reference#declarations-2ae7803ecdf5) | `mountMesh`, `MeshRenderer` |
| [edge-overlay](/packages/gpu/reference#declarations-b18108d63efb) | `MeshEdgeOverlay` |
| [camera](/packages/gpu/reference#declarations-de1514d874d8) | `validateMeshCamera`, `prepareCamera`, `MeshCamera` |
| [gpu-compiler](/packages/gpu/reference#declarations-26111c43dbbc) | `compileGpu`, `GpuCompileInput`, `GpuCompileResult`, `GpuDiagnostic`, `GpuRenderIR`, `GpuExecution` |
| [scene-front](/packages/gpu/reference#declarations-74ae62dc8bb9) | `SceneAst`, `SourceRange` |
| [face-highlight](/packages/gpu/reference#declarations-9b257931e841) | `MeshFaceHighlight` |
| [object-highlight](/packages/gpu/reference#declarations-f91698f81b3e) | `MeshObjectHighlight` |
| [mesh-viewport](/packages/gpu/reference#declarations-16371793d7bd) | `mountMeshViewport`, `MeshViewport`, `MeshViewportState`, `MeshViewportSelection` |
| [kernel-face-preview](/packages/gpu/reference#declarations-c106822907af) | `prepareKernelFacePreview`, `resolveKernelFaceReference`, `KernelFaceContext`, `KernelNormalSource`, `KernelFaceReference`, `KernelFaceBinding`, `KernelFacePreview`, `KernelFacePreviewOptions` |
| [mesh-scene-renderer](/packages/gpu/reference#declarations-3771f2af5e9e) | `mountMeshScene`, `MeshSceneRenderer`, `MeshSceneEntry`, `MeshSceneOptions`, `MeshSceneTransform`, `MeshSceneBounds` |
| [primitive-scene-renderer](/packages/gpu/reference#declarations-fedea37bff32) | `mountPrimitiveViewport`, `PrimitiveViewport`, `mountPrimitiveScene`, `PrimitiveSceneRenderer`, `mountPrimitiveSceneV1`, `PrimitiveSceneRendererV1`, `mountPrimitiveSceneV2`, `PrimitiveSceneRendererV2`, `PrimitiveSceneEntry`, `PrimitiveSceneOptions`, `PrimitiveSceneEntryV1`, `PrimitiveSceneInputV1`, `PrimitiveSceneRef`, `PrimitiveSceneMaterial`, `PrimitiveSceneFrameV0`, `PrimitiveSceneFrameV1`, `PrimitiveSceneEntryV2`, `PrimitiveSceneInputV2` |
| [mesh-material](/packages/gpu/reference#declarations-0b26a7625574) | `compileMeshMaterial`, `validateMeshMaterialIR`, `lowerMeshMaterial`, `MeshMaterialError`, `MeshMaterialCode`, `MeshMaterialDiagnostic`, `MeshMaterialUniform`, `MeshMaterialExpression`, `MeshMaterialIR`, `MeshMaterialBinding`, `LoweredMeshMaterial` |
| [particle-layer](/packages/gpu/reference#declarations-493dbef3dcb1) | `ParticleLayerV0` |
| [cloth-layer](/packages/gpu/reference#declarations-1a421a23182c) | `ClothLayerV0` |
| [coplanar-boolean-buffers](/packages/gpu/reference#declarations-786ac892201a) | `prepareCoplanarBooleanBuffers`, `CoplanarBooleanBufferOptions`, `PreparedCoplanarBooleanBuffers` |
| [boolean-shell-buffers](/packages/gpu/reference#declarations-3446ebc624f5) | `prepareBooleanShellBuffers`, `PreparedBooleanShellBuffers` |
| [boolean-shell-renderer](/packages/gpu/reference#declarations-f91673fe04db) | `mountBooleanShell`, `BooleanShellRenderer`, `BooleanShellOptions`, `BooleanShellResourceCounts` |
| [boolean-shell-scene-renderer](/packages/gpu/reference#declarations-0643e785f147) | `mountBooleanShellScene`, `BooleanShellSceneRenderer` |
| [boolean-shell-scene-input](/packages/gpu/reference#declarations-fa2b47d56d28) | `BooleanShellSceneInputV0`, `BooleanShellSceneEntry`, `BooleanShellLeafRef`, `BooleanShellSceneOptions` |
| [uniform-curve-preview](/packages/gpu/reference#declarations-ea7f7e9c1f76) | `prepareUniformCurvePreview`, `validateUniformCurvePreview`, `UniformCurvePreviewError`, `UniformCurvePreview`, `UniformCurvePreviewInput`, `UniformCurvePreviewDiagnosticCode`, `prepareSelectedUniformCurvePreview`, `validateSelectedUniformCurvePreview`, `SelectedUniformCurvePreview`, `SelectedUniformCurvePreviewInput` |
| [mixed-depth-frame](/packages/gpu/reference#declarations-35255b9c7e81) | `prepareMixedDepthFrame`, `MixedDepthError`, `MixedDepthFrameV0`, `MixedDepthSurfaceV0`, `MixedDepthDiagnosticCode` |
| [mixed-depth-renderer](/packages/gpu/reference#declarations-e609a466d455) | `mountMixedDepthScene`, `MixedDepthRenderer` |
| [qualified-face-scene](/packages/gpu/reference#declarations-93f31392960c) | `prepareQualifiedFaceScene`, `QualifiedFaceSceneError`, `QualifiedFaceSceneV0`, `QualifiedFaceAssetV0`, `QualifiedFaceSceneDiagnosticCode` |
| [qualified-face-scene-renderer](/packages/gpu/reference#declarations-f1c58f703db0) | `mountQualifiedFaceScene`, `QualifiedFaceSceneRenderer` |
| [axis-box-boolean-buffers](/packages/gpu/reference#declarations-416b8acf1787) | `prepareAxisBoxBooleanBuffers`, `AxisBoxBooleanBufferError`, `AxisBoxBooleanBufferOptions`, `PreparedAxisBoxBooleanBuffers`, `AxisBoxBooleanPanelRange`, `AxisBoxBooleanBufferDiagnosticCode` |
| [triangle-geometry](/packages/gpu/reference#declarations-99c76566044a) | `prepareTriangleGeometry`, `TriangleGeometryError`, `TriangleGeometryDiagnosticCode`, `TriangleGeometryV0`, `PreparedTriangleGeometry` |
| [engine-scene](/packages/gpu/reference#declarations-6908f7b659fc) | `prepareEngineScene`, `EngineSceneError`, `EngineSceneDiagnosticCode`, `EngineSceneV0`, `EngineSceneMaterialV0`, `EngineSceneNodeV0`, `PreparedEngineSceneNode`, `PreparedEngineSceneDraw`, `PreparedEngineScene` |
| [engine-raycast](/packages/gpu/reference#declarations-049c843edf98) | `raycastEngineScene`, `EngineRaycastError`, `EngineRaycastDiagnosticCode`, `EngineRayV0`, `EngineRayHitV0` |
| [engine-camera-ray](/packages/gpu/reference#declarations-0eb730f9b381) | `prepareEngineCameraRay`, `EngineCameraRayError`, `EngineCameraRayDiagnosticCode`, `EngineCameraRayRequestV0`, `PreparedEngineCameraRay` |
| [engine-translation-clip](/packages/gpu/reference#declarations-fe166e853c3c) | `sampleEngineTranslationClip`, `EngineTranslationClipError`, `EngineTranslationClipDiagnosticCode`, `EngineTranslationClipV0`, `EngineTranslationTrackV0`, `EngineTranslationKeyV0`, `EngineTranslationClipRequestV0`, `SampledEngineTranslationClip` |
| [engine-scene-frustum](/packages/gpu/reference#declarations-b982149066f1) | `prepareEngineSceneFrustum`, `EngineSceneFrustumError`, `EngineSceneFrustumDiagnosticCode`, `EngineSceneFrustumRequestV0`, `EngineSceneFrustumEntryV0`, `PreparedEngineSceneFrustum` |
| [engine-texture-bindings](/packages/gpu/reference#declarations-43050d9d7d27) | `prepareEngineTextureBindings`, `EngineTextureBindingsError`, `EngineTextureBindingsDiagnosticCode`, `EngineTextureV0`, `EngineTextureBindingV0`, `EngineTextureBindingsV0`, `PreparedEngineTexture`, `PreparedEngineTextureBindings` |
| [engine-rotation-clip](/packages/gpu/reference#declarations-167a9717a554) | `sampleEngineRotationClip`, `EngineRotationClipError`, `EngineRotationClipDiagnosticCode`, `EngineRotationClipV0`, `EngineRotationTrackV0`, `EngineRotationKeyV0`, `EngineRotationClipRequestV0`, `SampledEngineRotationClip` |
| [engine-scale-clip](/packages/gpu/reference#declarations-f3cdcfb10865) | `sampleEngineScaleClip`, `EngineScaleClipError`, `EngineScaleClipDiagnosticCode`, `EngineScaleClipV0`, `EngineScaleTrackV0`, `EngineScaleKeyV0`, `EngineScaleClipRequestV0`, `SampledEngineScaleClip` |
| [engine-opacity-bindings](/packages/gpu/reference#declarations-d06cdd5c717d) | `prepareEngineOpacityBindings`, `EngineOpacityBindingsError`, `EngineOpacityBindingsDiagnosticCode`, `EngineOpacityBindingV0`, `EngineOpacityBindingsV0`, `PreparedEngineOpacityBindings` |
| [engine-lighting-bindings](/packages/gpu/reference#declarations-f63e3f11be6e) | `prepareEngineLightingBindings`, `EngineLightingBindingsError`, `EngineLightingBindingsDiagnosticCode`, `EngineLightingBindingV0`, `EngineLightingBindingsV0`, `PreparedEngineLightingBindings` |

---

Source snapshot: local Git `5f5ad866205a21510ac69552e704cc162fa253b5`. `packages/barocss-gpu/package.json` (Manifest; local source), [public root](/packages/gpu/reference#declarations-5523de18ed63), `packages/barocss-gpu/README.md` (package README; local source). Source references identify that fixed snapshot. This native source commit is local-only; public declaration references open in this portal. Local source is the authority for this manual.

[Overview](./) · [Quickstart](./quickstart) · [Guides](./guides) · [API](./api) · [Examples](./examples) · [Limits](./limits)
