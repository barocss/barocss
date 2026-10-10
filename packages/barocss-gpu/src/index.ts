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
export {compileEngineUVMaterial,validateEngineUVMaterialIR,lowerEngineUVMaterial} from './mesh-material.js';
export type {EngineUVMaterialExpression,EngineUVMaterialIR,LoweredEngineUVMaterial} from './mesh-material.js';

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

export {prepareEngineSceneFrustum,EngineSceneFrustumError,EngineSceneFrustumDiagnosticCode} from './engine-scene-frustum.js';
export type {EngineSceneFrustumRequestV0,EngineSceneFrustumEntryV0,PreparedEngineSceneFrustum} from './engine-scene-frustum.js';

export {prepareEngineTextureBindings,EngineTextureBindingsError,EngineTextureBindingsDiagnosticCode} from './engine-texture-bindings.js';
export type {EngineTextureV0,EngineTextureBindingV0,EngineTextureBindingsV0,PreparedEngineTexture,PreparedEngineTextureBindings} from './engine-texture-bindings.js';

export {sampleEngineRotationClip,EngineRotationClipError,EngineRotationClipDiagnosticCode} from './engine-rotation-clip.js';
export type {EngineRotationClipV0,EngineRotationTrackV0,EngineRotationKeyV0,EngineRotationClipRequestV0,SampledEngineRotationClip} from './engine-rotation-clip.js';

export {sampleEngineScaleClip,EngineScaleClipError,EngineScaleClipDiagnosticCode} from './engine-scale-clip.js';
export type {EngineScaleClipV0,EngineScaleTrackV0,EngineScaleKeyV0,EngineScaleClipRequestV0,SampledEngineScaleClip} from './engine-scale-clip.js';
export {prepareEngineOpacityBindings,EngineOpacityBindingsError,EngineOpacityBindingsDiagnosticCode} from './engine-opacity-bindings.js';
export type {EngineOpacityBindingV0,EngineOpacityBindingsV0,PreparedEngineOpacityBindings} from './engine-opacity-bindings.js';
export {prepareEngineLightingBindings,EngineLightingBindingsError,EngineLightingBindingsDiagnosticCode} from './engine-lighting-bindings.js';
export type {EngineLightingBindingV0,EngineLightingBindingsV0,PreparedEngineLightingBindings} from './engine-lighting-bindings.js';
export {prepareEngineMaterialBindings,EngineMaterialBindingsError,EngineMaterialBindingsDiagnosticCode} from './engine-material-bindings.js';
export type {EngineMaterialBindingV0,EngineMaterialBindingsV0,PreparedEngineMaterialBindings} from './engine-material-bindings.js';

export {prepareEngineUVMaterialBindings} from './engine-material-bindings.js';
export type {EngineUVMaterialBindingV0,EngineUVMaterialBindingsV0,PreparedEngineUVMaterialBindings} from './engine-material-bindings.js';
export type {EngineUVMaterialBinding} from './mesh-material.js';

export {compileEngineUVRepeatingMaterial,validateEngineUVRepeatingMaterialIR,lowerEngineUVRepeatingMaterial} from './mesh-material.js';
export type {EngineUVRepeatingMaterialExpression,EngineUVRepeatingMaterialIR} from './mesh-material.js';

export {prepareEngineUVRepeatingMaterialBindings} from './engine-material-bindings.js';
export type {EngineUVRepeatingMaterialBindingV0,EngineUVRepeatingMaterialBindingsV0,PreparedEngineUVRepeatingMaterialBindings} from './engine-material-bindings.js';
export type {EngineUVRepeatingMaterialBinding} from './mesh-material.js';

export { prepareTriangleGeometryWithNormals } from './triangle-normal-generation.js';
export type { TriangleNormalSourceV0, PreparedTriangleGeometryWithNormals } from './triangle-normal-generation.js';

export { sampleEngineTransformClip, EngineTransformClipError, EngineTransformClipDiagnosticCode } from './engine-transform-clip.js';
export type { EngineTransformKeyV0, EngineTransformTrackV0, EngineTransformClipV0, EngineTransformClipRequestV0, SampledEngineTransformClip } from './engine-transform-clip.js';

export { compileAffineSceneSource } from './affine-scene-source.js';
export type { AffineSceneObject2, AffineScene2, CompiledAffineSceneSource } from './affine-scene-source.js';

export {prepareSourceSceneBounds,SourceSceneBoundsError,SourceSceneBoundsDiagnosticCode} from './source-scene-bounds.js';
export type {SourceSceneBoundsRequest,SourceSceneBoundsBox,SourceSceneObjectBounds,PreparedSourceSceneBounds} from './source-scene-bounds.js';

export { evaluateAuthoredMaterial, AuthoredMaterialEvaluationError, AuthoredMaterialEvaluationDiagnosticCode } from './material-evaluation.js';
export type { AuthoredMaterialRequest, AuthoredMaterialSample } from './material-evaluation.js';

export { PrimitiveSceneRecoveryError } from './primitive-scene-renderer.js';
