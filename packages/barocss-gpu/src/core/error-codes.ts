// gpu's refusal codes as one union (api-conventions.md §6, R7.3a): each error class's `code`, so the docs' refusal table
// can be read from types, every one upper-snake (R7.3a batch 2).
import type { AxisBoxBooleanBufferError } from '../boolean/axis-box-boolean-buffers.js';
import type { GPUError } from './gpu-error.js';
import type { EngineCameraRayError } from '../engine/engine-camera-ray.js';
import type { EngineLightingBindingsError } from '../engine/engine-lighting-bindings.js';
import type { EngineMaterialBindingsError } from '../engine/engine-material-bindings.js';
import type { EngineOpacityBindingsError } from '../engine/engine-opacity-bindings.js';
import type { EngineRaycastError } from '../engine/engine-raycast.js';
import type { EngineRotationClipError } from '../engine/engine-rotation-clip.js';
import type { EngineScaleClipError } from '../engine/engine-scale-clip.js';
import type { EngineSceneFrustumError } from '../engine/engine-scene-frustum.js';
import type { EngineSceneError } from '../engine/engine-scene.js';
import type { EngineTextureBindingsError } from '../engine/engine-texture-bindings.js';
import type { EngineTransformClipError } from '../engine/engine-transform-clip.js';
import type { EngineTranslationClipError } from '../engine/engine-translation-clip.js';
import type { TriangleGeometryError } from '../geometry/triangle-geometry.js';
import type { EngineUVTextureMaterialBindingsError } from '../material/engine-uv-texture-material-bindings.js';
import type { AuthoredMaterialEvaluationError } from '../material/material-evaluation.js';
import type { MeshMaterialError } from '../material/mesh-material.js';
import type { MixedDepthError } from '../mesh/mixed-depth-frame.js';
import type { UniformCurvePreviewError } from '../mesh/uniform-curve-preview.js';
import type { NativeDirectionalLightProgramWGSLError } from '../native/lights/native-directional-light-program-wgsl.js';
import type { NativeDirectionalLightWebGPUError } from '../native/lights/native-directional-light-webgpu-frame.js';
import type { NativeDirectionalLightsError } from '../native/lights/native-directional-lights.js';
import type { NativePointLightProgramWGSLError } from '../native/lights/native-point-light-program-wgsl.js';
import type { NativePointLightWebGPUError } from '../native/lights/native-point-light-webgpu-frame.js';
import type { NativePointLightsError } from '../native/lights/native-point-lights.js';
import type { NativeSurfaceUV01BindingError } from '../native/uv01/native-surface-uv01-binding.js';
import type { NativeSurfaceUV01FrameError } from '../native/uv01/native-surface-uv01-frame.js';
import type { NativeSurfaceUV01GeometryError } from '../native/uv01/native-surface-uv01-geometry.js';
import type { QualifiedFaceSceneError } from '../scene/qualified-face-scene.js';
import type { SceneParameterSourceError } from '../scene/scene-parameter-source.js';
import type { SceneError } from '../scene/scene-types.js';
import type { SceneViewError } from '../scene/scene-viewer.js';
import type { SourceSceneBoundsError } from '../scene/source-scene-bounds.js';
import type { ViewerError } from '../viewer/scene.js';

export type GpuErrorCode =
  | InstanceType<typeof AxisBoxBooleanBufferError>['code']
  | InstanceType<typeof GPUError>['code']
  | InstanceType<typeof EngineCameraRayError>['code']
  | InstanceType<typeof EngineLightingBindingsError>['code']
  | InstanceType<typeof EngineMaterialBindingsError>['code']
  | InstanceType<typeof EngineOpacityBindingsError>['code']
  | InstanceType<typeof EngineRaycastError>['code']
  | InstanceType<typeof EngineRotationClipError>['code']
  | InstanceType<typeof EngineScaleClipError>['code']
  | InstanceType<typeof EngineSceneFrustumError>['code']
  | InstanceType<typeof EngineSceneError>['code']
  | InstanceType<typeof EngineTextureBindingsError>['code']
  | InstanceType<typeof EngineTransformClipError>['code']
  | InstanceType<typeof EngineTranslationClipError>['code']
  | InstanceType<typeof TriangleGeometryError>['code']
  | InstanceType<typeof EngineUVTextureMaterialBindingsError>['code']
  | InstanceType<typeof AuthoredMaterialEvaluationError>['code']
  | InstanceType<typeof MeshMaterialError>['code']
  | InstanceType<typeof MixedDepthError>['code']
  | InstanceType<typeof UniformCurvePreviewError>['code']
  | InstanceType<typeof NativeDirectionalLightProgramWGSLError>['code']
  | InstanceType<typeof NativeDirectionalLightWebGPUError>['code']
  | InstanceType<typeof NativeDirectionalLightsError>['code']
  | InstanceType<typeof NativePointLightProgramWGSLError>['code']
  | InstanceType<typeof NativePointLightWebGPUError>['code']
  | InstanceType<typeof NativePointLightsError>['code']
  | InstanceType<typeof NativeSurfaceUV01BindingError>['code']
  | InstanceType<typeof NativeSurfaceUV01FrameError>['code']
  | InstanceType<typeof NativeSurfaceUV01GeometryError>['code']
  | InstanceType<typeof QualifiedFaceSceneError>['code']
  | InstanceType<typeof SceneParameterSourceError>['code']
  | InstanceType<typeof SceneError>['code']
  | InstanceType<typeof SceneViewError>['code']
  | InstanceType<typeof SourceSceneBoundsError>['code']
  | InstanceType<typeof ViewerError>['code']
  | 'MESH_INVALID' | 'LIGHT_INVALID';

/** The codes that are not upper-snake: `never`, which tsc checks below (a lower-case or hyphenated code fails the build). */
export type NonUpperSnakeGpuErrorCode<T extends string = GpuErrorCode> =
  T extends Uppercase<T> ? (T extends `${string}-${string}` | `${string} ${string}` ? T : never) : T;
const everyCodeUpperSnake: [NonUpperSnakeGpuErrorCode] extends [never] ? true : NonUpperSnakeGpuErrorCode = true;
void everyCodeUpperSnake;
