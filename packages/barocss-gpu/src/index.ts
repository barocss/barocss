export { parseScene, SceneError } from './scene.js';
export type { Scene, Scene1, SceneObject, SceneObject1, RotatedSceneObject, CylinderSceneObject, CapsuleSceneObject, RoundedBoxSceneObject, TorusSceneObject, AnyScene, SceneSourceOptions, RGB, Vec3 } from './scene.js';
export { compileScene, GPU_LIMITS } from './compiler.js';
export type { SceneShaders } from './compiler.js';
export { mountScene, SceneRenderer, GPUError } from './renderer.js';
export type { UpdateResult } from './renderer.js';
export { validatePreviewPacket, validateMeshOptions, prepareMesh } from './mesh-packet.js';
export type { PreviewPacket, MeshOptions } from './mesh-packet.js';
export type {MeshLighting} from './mesh-lighting.js';
export { mountMesh, MeshRenderer } from './mesh-renderer.js';
export type { MeshEdgeOverlay } from './edge-overlay.js';
export { validateMeshCamera, prepareCamera } from './camera.js';
export type { MeshCamera } from './camera.js';

export {compileGpu} from './gpu-compiler.js';
export type {GpuCompileInput,GpuCompileResult,GpuDiagnostic,GpuRenderIR,GpuExecution} from './gpu-compiler.js';
export type {SceneAst,SourceRange} from './scene-front.js';

export type {MeshFaceHighlight} from './face-highlight.js';

export type {MeshObjectHighlight} from './object-highlight.js';

export { mountMeshViewport, MeshViewport } from './mesh-viewport.js';
export type { MeshViewportState, MeshViewportSelection } from './mesh-viewport.js';

export {prepareKernelFacePreview,resolveKernelFaceReference} from './kernel-face-preview.js';
export type {KernelFaceContext,KernelNormalSource,KernelFaceReference,KernelFaceBinding,KernelFacePreview,KernelFacePreviewOptions} from './kernel-face-preview.js';

export {mountMeshScene,MeshSceneRenderer} from './mesh-scene-renderer.js';
export type {MeshSceneEntry,MeshSceneOptions,MeshSceneTransform,MeshSceneBounds} from './mesh-scene-renderer.js';
export {mountPrimitiveViewport,PrimitiveViewport,mountPrimitiveScene,PrimitiveSceneRenderer,mountPrimitiveSceneV1,PrimitiveSceneRendererV1,mountPrimitiveSceneV2,PrimitiveSceneRendererV2} from './primitive-scene-renderer.js';
export type {PrimitiveSceneEntry,PrimitiveSceneOptions,PrimitiveSceneEntryV1,PrimitiveSceneInputV1,PrimitiveSceneRef,PrimitiveSceneMaterial,PrimitiveSceneFrameV0,PrimitiveSceneFrameV1,PrimitiveSceneEntryV2,PrimitiveSceneInputV2} from './primitive-scene-renderer.js';
export {compileMeshMaterial,validateMeshMaterialIR,lowerMeshMaterial,MeshMaterialError} from './mesh-material.js';
export type {MeshMaterialCode,MeshMaterialDiagnostic,MeshMaterialUniform,MeshMaterialExpression,MeshMaterialIR,MeshMaterialBinding,LoweredMeshMaterial} from './mesh-material.js';

export type {ParticleLayerV0} from './particle-layer.js';
export type {ClothLayerV0} from './cloth-layer.js';

export {prepareCoplanarBooleanBuffers} from './coplanar-boolean-buffers.js';
export type {CoplanarBooleanBufferOptions,PreparedCoplanarBooleanBuffers} from './coplanar-boolean-buffers.js';

export {prepareBooleanShellBuffers} from './boolean-shell-buffers.js';
export type {PreparedBooleanShellBuffers} from './boolean-shell-buffers.js';

export {mountBooleanShell,BooleanShellRenderer} from './boolean-shell-renderer.js';
export type {BooleanShellOptions,BooleanShellResourceCounts} from './boolean-shell-renderer.js';

export {mountBooleanShellScene,BooleanShellSceneRenderer} from './boolean-shell-scene-renderer.js';
export type {BooleanShellSceneInputV0,BooleanShellSceneEntry,BooleanShellLeafRef,BooleanShellSceneOptions} from './boolean-shell-scene-input.js';

export {prepareUniformCurvePreview,validateUniformCurvePreview,UniformCurvePreviewError} from './uniform-curve-preview.js';
export type {UniformCurvePreview,UniformCurvePreviewInput,UniformCurvePreviewDiagnosticCode} from './uniform-curve-preview.js';
export {prepareSelectedUniformCurvePreview,validateSelectedUniformCurvePreview} from './uniform-curve-preview.js';
export type {SelectedUniformCurvePreview,SelectedUniformCurvePreviewInput} from './uniform-curve-preview.js';

export {prepareMixedDepthFrame,MixedDepthError} from './mixed-depth-frame.js';
export type {MixedDepthFrameV0,MixedDepthSurfaceV0,MixedDepthDiagnosticCode} from './mixed-depth-frame.js';
export {mountMixedDepthScene,MixedDepthRenderer} from './mixed-depth-renderer.js';

export {prepareQualifiedFaceScene,QualifiedFaceSceneError} from './qualified-face-scene.js';
export type {QualifiedFaceSceneV0,QualifiedFaceAssetV0,QualifiedFaceSceneDiagnosticCode} from './qualified-face-scene.js';
export {mountQualifiedFaceScene,QualifiedFaceSceneRenderer} from './qualified-face-scene-renderer.js';

export {prepareAxisBoxBooleanBuffers,AxisBoxBooleanBufferError} from './axis-box-boolean-buffers.js';
export type {AxisBoxBooleanBufferOptions,PreparedAxisBoxBooleanBuffers,AxisBoxBooleanPanelRange,AxisBoxBooleanBufferDiagnosticCode} from './axis-box-boolean-buffers.js';

export {prepareTriangleGeometry,TriangleGeometryError,TriangleGeometryDiagnosticCode} from './triangle-geometry.js';
export type {TriangleGeometryV0,PreparedTriangleGeometry} from './triangle-geometry.js';

export {prepareEngineScene,EngineSceneError,EngineSceneDiagnosticCode} from './engine-scene.js';
export type {EngineSceneV0,EngineSceneMaterialV0,EngineSceneNodeV0,PreparedEngineSceneNode,PreparedEngineSceneDraw,PreparedEngineScene} from './engine-scene.js';

export {raycastEngineScene,EngineRaycastError,EngineRaycastDiagnosticCode} from './engine-raycast.js';
export type {EngineRayV0,EngineRayHitV0} from './engine-raycast.js';
export {prepareEngineCameraRay,EngineCameraRayError,EngineCameraRayDiagnosticCode} from './engine-camera-ray.js';
export type {EngineCameraRayRequestV0,PreparedEngineCameraRay} from './engine-camera-ray.js';

export {sampleEngineTranslationClip,EngineTranslationClipError,EngineTranslationClipDiagnosticCode} from './engine-translation-clip.js';
export type {EngineTranslationClipV0,EngineTranslationTrackV0,EngineTranslationKeyV0,EngineTranslationClipRequestV0,SampledEngineTranslationClip} from './engine-translation-clip.js';

export {prepareEngineTextureBindings,EngineTextureBindingsError,EngineTextureBindingsDiagnosticCode} from './engine-texture-bindings.js';
export type {EngineTextureV0,EngineTextureBindingV0,EngineTextureBindingsV0,PreparedEngineTexture,PreparedEngineTextureBindings} from './engine-texture-bindings.js';
