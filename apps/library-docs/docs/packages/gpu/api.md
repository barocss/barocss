# GPU API

Import public values/types from `@barocss/gpu`. `/source` names the same root entry at this parent. Do not deep-import an internal source file merely because it has an `export` statement. Workspace entries select TypeScript source; complete publication maps select built JS/declarations.

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
| [scene](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-gpu/src/scene.ts) | `parseScene`, `SceneError`, `Scene`, `Scene1`, `SceneObject`, `SceneObject1`, `RotatedSceneObject`, `CylinderSceneObject`, `CapsuleSceneObject`, `RoundedBoxSceneObject`, `TorusSceneObject`, `AnyScene`, `SceneSourceOptions`, `RGB`, `Vec3` |
| [compiler](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-gpu/src/compiler.ts) | `compileScene`, `GPU_LIMITS`, `SceneShaders` |
| [renderer](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-gpu/src/renderer.ts) | `mountScene`, `SceneRenderer`, `GPUError`, `UpdateResult` |
| [mesh-packet](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-gpu/src/mesh-packet.ts) | `validatePreviewPacket`, `validateMeshOptions`, `prepareMesh`, `PreviewPacket`, `MeshOptions` |
| [mesh-lighting](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-gpu/src/mesh-lighting.ts) | `MeshLighting` |
| [mesh-renderer](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-gpu/src/mesh-renderer.ts) | `mountMesh`, `MeshRenderer` |
| [edge-overlay](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-gpu/src/edge-overlay.ts) | `MeshEdgeOverlay` |
| [camera](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-gpu/src/camera.ts) | `validateMeshCamera`, `prepareCamera`, `MeshCamera` |
| [gpu-compiler](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-gpu/src/gpu-compiler.ts) | `compileGpu`, `GpuCompileInput`, `GpuCompileResult`, `GpuDiagnostic`, `GpuRenderIR`, `GpuExecution` |
| [scene-front](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-gpu/src/scene-front.ts) | `SceneAst`, `SourceRange` |
| [face-highlight](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-gpu/src/face-highlight.ts) | `MeshFaceHighlight` |
| [object-highlight](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-gpu/src/object-highlight.ts) | `MeshObjectHighlight` |
| [mesh-viewport](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-gpu/src/mesh-viewport.ts) | `mountMeshViewport`, `MeshViewport`, `MeshViewportState`, `MeshViewportSelection` |
| [kernel-face-preview](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-gpu/src/kernel-face-preview.ts) | `prepareKernelFacePreview`, `resolveKernelFaceReference`, `KernelFaceContext`, `KernelNormalSource`, `KernelFaceReference`, `KernelFaceBinding`, `KernelFacePreview`, `KernelFacePreviewOptions` |
| [mesh-scene-renderer](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-gpu/src/mesh-scene-renderer.ts) | `mountMeshScene`, `MeshSceneRenderer`, `MeshSceneEntry`, `MeshSceneOptions`, `MeshSceneTransform`, `MeshSceneBounds` |
| [primitive-scene-renderer](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-gpu/src/primitive-scene-renderer.ts) | `mountPrimitiveViewport`, `PrimitiveViewport`, `mountPrimitiveScene`, `PrimitiveSceneRenderer`, `mountPrimitiveSceneV1`, `PrimitiveSceneRendererV1`, `mountPrimitiveSceneV2`, `PrimitiveSceneRendererV2`, `PrimitiveSceneEntry`, `PrimitiveSceneOptions`, `PrimitiveSceneEntryV1`, `PrimitiveSceneInputV1`, `PrimitiveSceneRef`, `PrimitiveSceneMaterial`, `PrimitiveSceneFrameV0`, `PrimitiveSceneFrameV1`, `PrimitiveSceneEntryV2`, `PrimitiveSceneInputV2` |
| [mesh-material](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-gpu/src/mesh-material.ts) | `compileMeshMaterial`, `validateMeshMaterialIR`, `lowerMeshMaterial`, `MeshMaterialError`, `MeshMaterialCode`, `MeshMaterialDiagnostic`, `MeshMaterialUniform`, `MeshMaterialExpression`, `MeshMaterialIR`, `MeshMaterialBinding`, `LoweredMeshMaterial` |
| [particle-layer](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-gpu/src/particle-layer.ts) | `ParticleLayerV0` |
| [cloth-layer](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-gpu/src/cloth-layer.ts) | `ClothLayerV0` |
| [coplanar-boolean-buffers](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-gpu/src/coplanar-boolean-buffers.ts) | `prepareCoplanarBooleanBuffers`, `CoplanarBooleanBufferOptions`, `PreparedCoplanarBooleanBuffers` |
| [boolean-shell-buffers](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-gpu/src/boolean-shell-buffers.ts) | `prepareBooleanShellBuffers`, `PreparedBooleanShellBuffers` |
| [boolean-shell-renderer](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-gpu/src/boolean-shell-renderer.ts) | `mountBooleanShell`, `BooleanShellRenderer`, `BooleanShellOptions`, `BooleanShellResourceCounts` |
| [boolean-shell-scene-renderer](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-gpu/src/boolean-shell-scene-renderer.ts) | `mountBooleanShellScene`, `BooleanShellSceneRenderer` |
| [boolean-shell-scene-input](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-gpu/src/boolean-shell-scene-input.ts) | `BooleanShellSceneInputV0`, `BooleanShellSceneEntry`, `BooleanShellLeafRef`, `BooleanShellSceneOptions` |
| [uniform-curve-preview](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-gpu/src/uniform-curve-preview.ts) | `prepareUniformCurvePreview`, `validateUniformCurvePreview`, `UniformCurvePreviewError`, `UniformCurvePreview`, `UniformCurvePreviewInput`, `UniformCurvePreviewDiagnosticCode`, `prepareSelectedUniformCurvePreview`, `validateSelectedUniformCurvePreview`, `SelectedUniformCurvePreview`, `SelectedUniformCurvePreviewInput` |
| [mixed-depth-frame](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-gpu/src/mixed-depth-frame.ts) | `prepareMixedDepthFrame`, `MixedDepthError`, `MixedDepthFrameV0`, `MixedDepthSurfaceV0`, `MixedDepthDiagnosticCode` |
| [mixed-depth-renderer](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-gpu/src/mixed-depth-renderer.ts) | `mountMixedDepthScene`, `MixedDepthRenderer` |
| [qualified-face-scene](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-gpu/src/qualified-face-scene.ts) | `prepareQualifiedFaceScene`, `QualifiedFaceSceneError`, `QualifiedFaceSceneV0`, `QualifiedFaceAssetV0`, `QualifiedFaceSceneDiagnosticCode` |
| [qualified-face-scene-renderer](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-gpu/src/qualified-face-scene-renderer.ts) | `mountQualifiedFaceScene`, `QualifiedFaceSceneRenderer` |
| [axis-box-boolean-buffers](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-gpu/src/axis-box-boolean-buffers.ts) | `prepareAxisBoxBooleanBuffers`, `AxisBoxBooleanBufferError`, `AxisBoxBooleanBufferOptions`, `PreparedAxisBoxBooleanBuffers`, `AxisBoxBooleanPanelRange`, `AxisBoxBooleanBufferDiagnosticCode` |
| [triangle-geometry](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-gpu/src/triangle-geometry.ts) | `prepareTriangleGeometry`, `TriangleGeometryError`, `TriangleGeometryDiagnosticCode`, `TriangleGeometryV0`, `PreparedTriangleGeometry` |
| [engine-scene](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-gpu/src/engine-scene.ts) | `prepareEngineScene`, `EngineSceneError`, `EngineSceneDiagnosticCode`, `EngineSceneV0`, `EngineSceneMaterialV0`, `EngineSceneNodeV0`, `PreparedEngineSceneNode`, `PreparedEngineSceneDraw`, `PreparedEngineScene` |
| [engine-raycast](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-gpu/src/engine-raycast.ts) | `raycastEngineScene`, `EngineRaycastError`, `EngineRaycastDiagnosticCode`, `EngineRayV0`, `EngineRayHitV0` |
| [engine-camera-ray](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-gpu/src/engine-camera-ray.ts) | `prepareEngineCameraRay`, `EngineCameraRayError`, `EngineCameraRayDiagnosticCode`, `EngineCameraRayRequestV0`, `PreparedEngineCameraRay` |
| [engine-translation-clip](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-gpu/src/engine-translation-clip.ts) | `sampleEngineTranslationClip`, `EngineTranslationClipError`, `EngineTranslationClipDiagnosticCode`, `EngineTranslationClipV0`, `EngineTranslationTrackV0`, `EngineTranslationKeyV0`, `EngineTranslationClipRequestV0`, `SampledEngineTranslationClip` |
| [engine-scene-frustum](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-gpu/src/engine-scene-frustum.ts) | `prepareEngineSceneFrustum`, `EngineSceneFrustumError`, `EngineSceneFrustumDiagnosticCode`, `EngineSceneFrustumRequestV0`, `EngineSceneFrustumEntryV0`, `PreparedEngineSceneFrustum` |
| [engine-texture-bindings](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-gpu/src/engine-texture-bindings.ts) | `prepareEngineTextureBindings`, `EngineTextureBindingsError`, `EngineTextureBindingsDiagnosticCode`, `EngineTextureV0`, `EngineTextureBindingV0`, `EngineTextureBindingsV0`, `PreparedEngineTexture`, `PreparedEngineTextureBindings` |
| [engine-rotation-clip](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-gpu/src/engine-rotation-clip.ts) | `sampleEngineRotationClip`, `EngineRotationClipError`, `EngineRotationClipDiagnosticCode`, `EngineRotationClipV0`, `EngineRotationTrackV0`, `EngineRotationKeyV0`, `EngineRotationClipRequestV0`, `SampledEngineRotationClip` |
| [engine-scale-clip](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-gpu/src/engine-scale-clip.ts) | `sampleEngineScaleClip`, `EngineScaleClipError`, `EngineScaleClipDiagnosticCode`, `EngineScaleClipV0`, `EngineScaleTrackV0`, `EngineScaleKeyV0`, `EngineScaleClipRequestV0`, `SampledEngineScaleClip` |
| [engine-opacity-bindings](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-gpu/src/engine-opacity-bindings.ts) | `prepareEngineOpacityBindings`, `EngineOpacityBindingsError`, `EngineOpacityBindingsDiagnosticCode`, `EngineOpacityBindingV0`, `EngineOpacityBindingsV0`, `PreparedEngineOpacityBindings` |
| [engine-lighting-bindings](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-gpu/src/engine-lighting-bindings.ts) | `prepareEngineLightingBindings`, `EngineLightingBindingsError`, `EngineLightingBindingsDiagnosticCode`, `EngineLightingBindingV0`, `EngineLightingBindingsV0`, `PreparedEngineLightingBindings` |

---

Source snapshot: local Git `5f5ad866205a21510ac69552e704cc162fa253b5`. [Manifest](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-gpu/package.json), [public root](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-gpu/src/index.ts), [package README](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-gpu/README.md). Fixed-SHA links identify that snapshot; this native local commit may not yet be available on the remote. Local source is the authority for this manual.

[Overview](./) · [Quickstart](./quickstart) · [Guides](./guides) · [API](./api) · [Examples](./examples) · [Limits](./limits)
