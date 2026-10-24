export { parseScene, SceneError } from './scene/scene.js';
export type { Scene, Scene1, SceneObject, SceneObject1, RotatedSceneObject, CylinderSceneObject, CapsuleSceneObject, RoundedBoxSceneObject, TorusSceneObject, AnyScene, SceneSourceOptions, RGB, Vec3 } from './scene/scene.js';
export { compileScene, GPU_LIMITS } from './mesh/compiler.js';
export type { SceneShaders } from './mesh/compiler.js';
export { GPUError } from './core/gpu-error.js';
export { BarocssError, type Problem } from './core/barocss-error.js';
export type { GpuErrorCode } from './core/error-codes.js';
export type { UpdateResult } from './core/gpu-error.js';
export { validatePreviewPacket, validateMeshOptions, prepareMesh } from './mesh/mesh-packet.js';
export type { PreviewPacket, MeshOptions } from './mesh/mesh-packet.js';
export type {MeshLighting} from './mesh/mesh-lighting.js';
export type { MeshEdgeOverlay } from './mesh/edge-overlay.js';
export { validateMeshCamera, prepareCamera } from './mesh/camera.js';
export type { MeshCamera } from './mesh/camera.js';

export {compileGpu} from './mesh/gpu-compiler.js';
export type {GpuCompileInput,GpuCompileResult,GpuDiagnostic,GpuRenderIR,GpuExecution} from './mesh/gpu-compiler.js';
export type {SceneAst,SourceRange} from './scene/scene-front.js';

export type {MeshFaceHighlight} from './mesh/face-highlight.js';

export type {MeshObjectHighlight} from './mesh/object-highlight.js';


export {prepareKernelFacePreview,resolveKernelFaceReference} from './mesh/kernel-face-preview.js';
export type {KernelFaceContext,KernelNormalSource,KernelFaceReference,KernelFaceBinding,KernelFacePreview,KernelFacePreviewOptions} from './mesh/kernel-face-preview.js';

export type {MeshSceneOptions} from './scene/primitive-scene.js';
export type {MeshSceneTransform,MeshSceneBounds} from './mesh/mesh-scene-transform.js';
export type {PrimitiveSceneEntry,PrimitiveSceneOptions,PrimitiveSceneEntryV1,PrimitiveSceneInputV1,PrimitiveSceneRef,PrimitiveSceneMaterial,PrimitiveSceneFrameV0,PrimitiveSceneFrameV1,PrimitiveSceneEntryV2,PrimitiveSceneInputV2} from './scene/primitive-scene.js';
export {compileMeshMaterial,validateMeshMaterialIR,validateMeshMaterialBinding,lowerMeshMaterial,MeshMaterialError} from './material/mesh-material.js';
export type {MeshMaterialCode,MeshMaterialDiagnostic,MeshMaterialUniform,MeshMaterialExpression,MeshMaterialIR,MeshMaterialBinding,LoweredMeshMaterial} from './material/mesh-material.js';
export {compileEngineUVMaterial,validateEngineUVMaterialIR,lowerEngineUVMaterial} from './material/mesh-material.js';
export type {EngineUVMaterialExpression,EngineUVMaterialIR,LoweredEngineUVMaterial} from './material/mesh-material.js';

export type {ParticleLayerV0} from './mesh/particle-layer.js';
export {prepareClothLayer} from './mesh/cloth-layer.js';
export type {ClothLayerV0,PreparedClothLayer} from './mesh/cloth-layer.js';

export {prepareCoplanarBooleanBuffers} from './boolean/coplanar-boolean-buffers.js';
export type {CoplanarBooleanBufferOptions,PreparedCoplanarBooleanBuffers} from './boolean/coplanar-boolean-buffers.js';

export {prepareBooleanShellBuffers} from './boolean/boolean-shell-buffers.js';
export type {PreparedBooleanShellBuffers} from './boolean/boolean-shell-buffers.js';


export type {BooleanShellSceneInputV0,BooleanShellSceneEntry,BooleanShellLeafRef,BooleanShellSceneOptions} from './boolean/boolean-shell-scene-input.js';

export {prepareUniformCurvePreview,validateUniformCurvePreview,UniformCurvePreviewError} from './mesh/uniform-curve-preview.js';
export type {UniformCurvePreview,UniformCurvePreviewInput,UniformCurvePreviewDiagnosticCode} from './mesh/uniform-curve-preview.js';
export {prepareSelectedUniformCurvePreview,validateSelectedUniformCurvePreview} from './mesh/uniform-curve-preview.js';
export type {SelectedUniformCurvePreview,SelectedUniformCurvePreviewInput} from './mesh/uniform-curve-preview.js';

export {prepareMixedDepthFrame,resolveMixedDepthFrame,MixedDepthError} from './mesh/mixed-depth-frame.js';
export type {MixedDepthFrameV0,MixedDepthSurfaceV0,MixedDepthDiagnosticCode} from './mesh/mixed-depth-frame.js';

export {prepareQualifiedFaceScene,resolveQualifiedFaceScene,QualifiedFaceSceneError} from './scene/qualified-face-scene.js';
export type {QualifiedFaceSceneV0,QualifiedFaceAssetV0,QualifiedFaceSceneDiagnosticCode} from './scene/qualified-face-scene.js';

export {prepareAxisBoxBooleanBuffers,AxisBoxBooleanBufferError} from './boolean/axis-box-boolean-buffers.js';
export type {AxisBoxBooleanBufferOptions,PreparedAxisBoxBooleanBuffers,AxisBoxBooleanPanelRange,AxisBoxBooleanBufferDiagnosticCode} from './boolean/axis-box-boolean-buffers.js';

export {prepareTriangleGeometry,TriangleGeometryError,TriangleGeometryDiagnosticCode} from './geometry/triangle-geometry.js';
export type {TriangleGeometryV0,PreparedTriangleGeometry} from './geometry/triangle-geometry.js';

export {prepareEngineScene,EngineSceneError,EngineSceneDiagnosticCode} from './engine/engine-scene.js';
export {prepareEngineDrawBatches} from './engine/engine-draw-batches.js';
export type {EngineDrawBatch,EngineDrawBatchPlan} from './engine/engine-draw-batches.js';
export type {EngineSceneV0,EngineSceneMaterialV0,EngineSceneNodeV0,PreparedEngineSceneNode,PreparedEngineSceneDraw,PreparedEngineScene} from './engine/engine-scene.js';

export {raycastEngineScene,EngineRaycastError,EngineRaycastDiagnosticCode} from './engine/engine-raycast.js';
export type {EngineRayV0,EngineRayHitV0} from './engine/engine-raycast.js';
export {prepareEngineCameraRay,EngineCameraRayError,EngineCameraRayDiagnosticCode} from './engine/engine-camera-ray.js';
export type {EngineCameraRayRequestV0,PreparedEngineCameraRay} from './engine/engine-camera-ray.js';

export {sampleEngineTranslationClip,EngineTranslationClipError,EngineTranslationClipDiagnosticCode} from './engine/engine-translation-clip.js';
export type {EngineTranslationClipV0,EngineTranslationTrackV0,EngineTranslationKeyV0,EngineTranslationClipRequestV0,SampledEngineTranslationClip} from './engine/engine-translation-clip.js';

export {prepareEngineSceneFrustum,EngineSceneFrustumError,EngineSceneFrustumDiagnosticCode} from './engine/engine-scene-frustum.js';
export type {EngineSceneFrustumRequestV0,EngineSceneFrustumEntryV0,PreparedEngineSceneFrustum} from './engine/engine-scene-frustum.js';

export {prepareEngineTextureBindings,EngineTextureBindingsError,EngineTextureBindingsDiagnosticCode} from './engine/engine-texture-bindings.js';
export type {EngineTextureV0,EngineTextureBindingV0,EngineTextureBindingsV0,PreparedEngineTexture,PreparedEngineTextureBindings} from './engine/engine-texture-bindings.js';

export {sampleEngineRotationClip,EngineRotationClipError,EngineRotationClipDiagnosticCode} from './engine/engine-rotation-clip.js';
export type {EngineRotationClipV0,EngineRotationTrackV0,EngineRotationKeyV0,EngineRotationClipRequestV0,SampledEngineRotationClip} from './engine/engine-rotation-clip.js';

export {sampleEngineScaleClip,EngineScaleClipError,EngineScaleClipDiagnosticCode} from './engine/engine-scale-clip.js';
export type {EngineScaleClipV0,EngineScaleTrackV0,EngineScaleKeyV0,EngineScaleClipRequestV0,SampledEngineScaleClip} from './engine/engine-scale-clip.js';
export {prepareEngineOpacityBindings,EngineOpacityBindingsError,EngineOpacityBindingsDiagnosticCode} from './engine/engine-opacity-bindings.js';
export type {EngineOpacityBindingV0,EngineOpacityBindingsV0,PreparedEngineOpacityBindings} from './engine/engine-opacity-bindings.js';
export {prepareEngineLightingBindings,EngineLightingBindingsError,EngineLightingBindingsDiagnosticCode} from './engine/engine-lighting-bindings.js';
export type {EngineLightingBindingV0,EngineLightingBindingsV0,PreparedEngineLightingBindings} from './engine/engine-lighting-bindings.js';
export {prepareEngineMaterialBindings,EngineMaterialBindingsError,EngineMaterialBindingsDiagnosticCode} from './engine/engine-material-bindings.js';
export type {EngineMaterialBindingV0,EngineMaterialBindingsV0,PreparedEngineMaterialBindings} from './engine/engine-material-bindings.js';

export {prepareEngineUVMaterialBindings} from './engine/engine-material-bindings.js';
export type {EngineUVMaterialBindingV0,EngineUVMaterialBindingsV0,PreparedEngineUVMaterialBindings} from './engine/engine-material-bindings.js';
export type {EngineUVMaterialBinding} from './material/mesh-material.js';

export {compileEngineUVRepeatingMaterial,validateEngineUVRepeatingMaterialIR,lowerEngineUVRepeatingMaterial} from './material/mesh-material.js';
export type {EngineUVRepeatingMaterialExpression,EngineUVRepeatingMaterialIR} from './material/mesh-material.js';

export {prepareEngineUVRepeatingMaterialBindings} from './engine/engine-material-bindings.js';
export type {EngineUVRepeatingMaterialBindingV0,EngineUVRepeatingMaterialBindingsV0,PreparedEngineUVRepeatingMaterialBindings} from './engine/engine-material-bindings.js';
export type {EngineUVRepeatingMaterialBinding} from './material/mesh-material.js';

export { prepareTriangleGeometryWithNormals } from './geometry/triangle-normal-generation.js';
export type { TriangleNormalSourceV0, PreparedTriangleGeometryWithNormals } from './geometry/triangle-normal-generation.js';

export { sampleEngineTransformClip, EngineTransformClipError, EngineTransformClipDiagnosticCode } from './engine/engine-transform-clip.js';
export type { EngineTransformKeyV0, EngineTransformTrackV0, EngineTransformClipV0, EngineTransformClipRequestV0, SampledEngineTransformClip } from './engine/engine-transform-clip.js';

export { compileAffineSceneSource } from './scene/affine-scene-source.js';
export type { AffineSceneObject2, AffineScene2, CompiledAffineSceneSource } from './scene/affine-scene-source.js';

export {prepareSourceSceneBounds,SourceSceneBoundsError,SourceSceneBoundsDiagnosticCode} from './scene/source-scene-bounds.js';
export type {SourceSceneBoundsRequest,SourceSceneBoundsBox,SourceSceneObjectBounds,PreparedSourceSceneBounds} from './scene/source-scene-bounds.js';

export { evaluateAuthoredMaterial, AuthoredMaterialEvaluationError, AuthoredMaterialEvaluationDiagnosticCode } from './material/material-evaluation.js';
export type { AuthoredMaterialRequest, AuthoredMaterialSample } from './material/material-evaluation.js';


export { prepareBoxGeometry } from './geometry/box-geometry.js';
export type { BoxGeometrySourceV0, PreparedBoxGeometry } from './geometry/box-geometry.js';

export { preparePlaneGeometry } from './geometry/plane-geometry.js';
export type { PlaneGeometrySourceV0, PreparedPlaneGeometry } from './geometry/plane-geometry.js';

export { prepareSphereGeometry } from './geometry/sphere-geometry.js';
export type { SphereGeometrySourceV0, PreparedSphereGeometry } from './geometry/sphere-geometry.js';

export { preparePrimitiveSceneFrame } from './mesh/primitive-frame-preflight.js';
export type { PrimitiveSceneFrameProfile, PrimitiveSceneCpuFrameV0, PreparedPrimitiveSceneFrameEntry, PreparedPrimitiveSceneFrame } from './mesh/primitive-frame-preflight.js';


export { prepareTorusGeometry } from './geometry/torus-geometry.js';
export type { TorusGeometrySourceV0, PreparedTorusGeometry } from './geometry/torus-geometry.js';

export { prepareCylinderGeometry } from './geometry/cylinder-geometry.js';
export type { CylinderGeometrySourceV0, PreparedCylinderGeometry } from './geometry/cylinder-geometry.js';

export { prepareConeGeometry } from './geometry/cone-geometry.js';
export type { ConeGeometrySourceV0, PreparedConeGeometry } from './geometry/cone-geometry.js';

export { prepareCapsuleGeometry } from './geometry/capsule-geometry.js';
export type { CapsuleGeometrySourceV0, PreparedCapsuleGeometry } from './geometry/capsule-geometry.js';

export { prepareRoundedBoxGeometry } from './geometry/rounded-box-geometry.js';
export type { RoundedBoxGeometrySourceV0, PreparedRoundedBoxGeometry } from './geometry/rounded-box-geometry.js';

export {compileNativeSurfaceUV01Material,validateNativeSurfaceUV01MaterialIR,lowerNativeSurfaceUV01Material} from './material/mesh-material.js';
export type {NativeSurfaceUV01MaterialExpression,NativeSurfaceUV01MaterialIR,LoweredNativeSurfaceUV01Material} from './material/mesh-material.js';

export {prepareNativeSurfaceUV01Geometry,NativeSurfaceUV01GeometryError} from './native/uv01/native-surface-uv01-geometry.js';
export type {NativeSurfaceUV01GeometryRequest,PreparedNativeSurfaceUV01Geometry,NativeSurfaceUV01GeometryCode} from './native/uv01/native-surface-uv01-geometry.js';

export {prepareNativeSurfaceUV01MaterialBinding,NativeSurfaceUV01BindingError} from './native/uv01/native-surface-uv01-binding.js';
export type {NativeSurfaceUV01BindingRequest,PreparedNativeSurfaceUV01Binding,NativeSurfaceUV01BindingCode} from './native/uv01/native-surface-uv01-binding.js';


export {compileParameterizedAffineSceneSource,SceneParameterSourceError} from './scene/scene-parameter-source.js';
export type {SceneParameterCode,SceneParameterDiagnostic,SceneParameterDeclaration,ParameterizedAffineSceneAst,SceneParameter,CompiledParameterizedAffineSceneSource} from './scene/scene-parameter-source.js';

export {compileMultiplicativeAffineSceneSource} from './scene/scene-product-source.js';
export type {MultiplicativeAffineSceneAst,CompiledMultiplicativeAffineSceneSource} from './scene/scene-product-source.js';

export {compileArithmeticAffineSceneSource} from './scene/scene-arithmetic-source.js';
export type {ArithmeticAffineSceneAst,CompiledArithmeticAffineSceneSource} from './scene/scene-arithmetic-source.js';

export { prepareNativeDirectionalLights, NativeDirectionalLightsError, NativeDirectionalLightsDiagnosticCode } from './native/lights/native-directional-lights.js';
export type { NativeDirectionalLightV0, NativeDirectionalLightsV0, NativeDirectionalLightExecution, PreparedNativeDirectionalLights } from './native/lights/native-directional-lights.js';

export { compileFiniteRepeatAffineSceneSource } from './scene/scene-finite-repeat-source.js';
export type { SceneRepeatDeclaration, SceneGenerationRecord, FiniteRepeatAffineSceneAst, CompiledFiniteRepeatAffineSceneSource } from './scene/scene-finite-repeat-source.js';


export { compileConditionalAffineSceneSource } from './scene/scene-conditional-source.js';
export type { SceneConditionalDeclaration, SceneConditionalDecision, ConditionalAffineSceneAst, CompiledConditionalAffineSceneSource } from './scene/scene-conditional-source.js';

export { compileGeneratedAffineSceneSource } from './scene/scene-generated-source.js';
export type { GeneratedAffineSceneAst, CompiledGeneratedAffineSceneSource } from './scene/scene-generated-source.js';

export { compileOptionalRepeatedAffineSceneSource } from './scene/scene-optional-repeat-source.js';
export type { OptionalRepeatedAffineSceneAst, CompiledOptionalRepeatedAffineSceneSource } from './scene/scene-optional-repeat-source.js';

export { compileDiscreteMeshMaterial, validateDiscreteMeshMaterialIR, lowerDiscreteMeshMaterial } from './material/mesh-material.js';
export type { DiscreteMeshMaterialExpression, DiscreteMeshMaterialIR, LoweredDiscreteMeshMaterial } from './material/mesh-material.js';

export { evaluateDiscreteAuthoredMaterial } from './material/material-evaluation.js';
export type { DiscreteAuthoredMaterialRequest, DiscreteAuthoredMaterialSample } from './material/material-evaluation.js';

export { compileEngineUVTextureMaterial, validateEngineUVTextureMaterialIR, lowerEngineUVTextureMaterial } from './material/mesh-material.js';
export type { EngineMaterialSampler, EngineUVTextureMaterialExpression, EngineUVTextureMaterialIR, LoweredEngineUVTextureMaterial } from './material/mesh-material.js';

export { lowerMeshMaterialWGSL } from './material/mesh-material-wgsl.js';
export type { LoweredMeshMaterialWGSL } from './material/mesh-material-wgsl.js';

export { prepareEngineUVTextureMaterialBindings, EngineUVTextureMaterialBindingsError, EngineUVTextureMaterialBindingsDiagnosticCode } from './material/engine-uv-texture-material-bindings.js';
export type { EngineUVTextureMaterialBindingV0, EngineUVTextureMaterialBindingsV0, EngineUVTextureMaterialSamplerBinding, PreparedEngineUVTextureMaterialBindings } from './material/engine-uv-texture-material-bindings.js';

export { lowerEngineUVTextureMaterialWGSL } from './material/engine-uv-texture-material-wgsl.js';
export type { LoweredEngineUVTextureMaterialWGSL } from './material/engine-uv-texture-material-wgsl.js';

export { lowerEngineUVTextureProgramWGSL } from './material/engine-uv-texture-program-wgsl.js';
export type { LoweredEngineUVTextureProgramWGSL } from './material/engine-uv-texture-program-wgsl.js';


// Trusted WGSL expression for original native Surface normalized UV01.
export { lowerNativeSurfaceUV01MaterialWGSL } from './native/uv01/native-surface-uv01-material-wgsl.js';
export type { LoweredNativeSurfaceUV01MaterialWGSL } from './native/uv01/native-surface-uv01-material-wgsl.js';
export { lowerEngineUVRepeatingMaterialWGSL } from './material/engine-uv-repeating-material-wgsl.js';
export type { LoweredEngineUVRepeatingMaterialWGSL } from './material/engine-uv-repeating-material-wgsl.js';


// Complete trusted WebGPU program for original native Surface normalized UV01.
export { lowerNativeSurfaceUV01ProgramWGSL } from './native/uv01/native-surface-uv01-program-wgsl.js';
export type { LoweredNativeSurfaceUV01ProgramWGSL } from './native/uv01/native-surface-uv01-program-wgsl.js';

// Source-derived native UV01 frame admission and checked CPU upload bytes; no GPU allocation.
export { prepareNativeSurfaceUV01Frame, NativeSurfaceUV01FrameError, NativeSurfaceUV01FrameDiagnosticCode } from './native/uv01/native-surface-uv01-frame.js';
export type { NativeSurfaceUV01FrameRequest, NativeSurfaceUV01FrameEntry, NativeSurfaceUV01FrameOptions, NativeSurfaceUV01FrameDraw, NativeSurfaceUV01FrameResources, PreparedNativeSurfaceUV01Frame } from './native/uv01/native-surface-uv01-frame.js';

// Explicit required-WebGPU viewport for source-derived native Surface UV01 requests.

export { prepareNativeDirectionalLightProgramWGSL, NativeDirectionalLightProgramWGSLError } from './native/lights/native-directional-light-program-wgsl.js';
export type { NativeDirectionalLightProgramWGSLCode, NativeDirectionalLightProgramWGSLRequest, NativeDirectionalLightProgramWGSLSlot, NativeDirectionalLightProgramWGSLExecution, NativeDirectionalLightProgramWGSLABI, NativeDirectionalLightProgramWGSLProgram, NativeDirectionalLightProgramWGSLUniforms, PreparedNativeDirectionalLightProgramWGSL } from './native/lights/native-directional-light-program-wgsl.js';

export { NativeDirectionalLightWebGPUError, NativeDirectionalLightWebGPUDiagnosticCode } from './native/lights/native-directional-light-webgpu-frame.js';
export type { NativeDirectionalLightWebGPURequest, NativeDirectionalLightWebGPUFrameOptions } from './native/lights/native-directional-light-webgpu-frame.js';


// CPU-only native point-light catalog and trusted WGSL/ABI upload preparation (#1583).
export { prepareNativePointLights, NativePointLightsError, NativePointLightsDiagnosticCode } from './native/lights/native-point-lights.js';
export type { NativePointLightV0, NativePointLightsV0, NativePointLightExecution, PreparedNativePointLights } from './native/lights/native-point-lights.js';
export { prepareNativePointLightProgramWGSL, NativePointLightProgramWGSLError } from './native/lights/native-point-light-program-wgsl.js';
export type { NativePointLightProgramWGSLCode, NativePointLightProgramWGSLRequest, NativePointLightProgramWGSLSlot, NativePointLightProgramWGSLExecution, NativePointLightProgramWGSLABI, NativePointLightProgramWGSLProgram, NativePointLightProgramWGSLUniforms, PreparedNativePointLightProgramWGSL } from './native/lights/native-point-light-program-wgsl.js';

// The native point-light request: a frame and its light catalog (drawn by @barocss/viewer).
export { NativePointLightWebGPUError, NativePointLightWebGPUDiagnosticCode } from './native/lights/native-point-light-webgpu-frame.js';
export type { NativePointLightWebGPURequest, NativePointLightWebGPUFrameOptions } from './native/lights/native-point-light-webgpu-frame.js';


// The unified WebGPU viewer: one device and canvas context, persistent buffers, on-demand frames,
// orbit camera, metal–roughness lighting, picking and device-loss recovery.
export * from './viewer/index.js';

// The CSS-shaped scene language shown on the viewer.
export { showScene, SceneViewError } from './scene/scene-viewer.js';
export type { SceneView, SceneViewOptions } from './scene/scene-viewer.js';
export { materialShader, bindingShader, uv01Shader, uvRepeatingShader } from './material/material-viewer.js';
export type { MaterialShaderResult, MaterialUniform } from './material/material-viewer.js';
// EXPERIMENTAL (G25): GPU compute for analyses; may change without a version bump.
export * as computeExperimental from './compute/index.js';
