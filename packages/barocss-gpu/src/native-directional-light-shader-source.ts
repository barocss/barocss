import { copyGpuData, freezeGpuData } from './gpu-data.js';
import { prepareNativeDirectionalLights } from './native-directional-lights.js';
import type { NativeDirectionalLightsV0 } from './native-directional-lights.js';
import { validateMeshMaterialBinding, lowerMeshMaterial } from './mesh-material.js';
import type { MeshMaterialBinding, LoweredMeshMaterial } from './mesh-material.js';
import { directionalLightMeshShaderSource } from './directional-light-shader-body.js';
import type { SceneShaders } from './compiler.js';
import type { Vec3, RGB } from './scene-types.js';

export type DirectionalLightShaderSourceCode = 'INPUT' | 'LIGHTS' | 'MATERIAL' | 'BUDGET';
export class DirectionalLightShaderSourceError extends Error {
  constructor(readonly code: DirectionalLightShaderSourceCode, detail: string, cause?: unknown) {
    super(('Directional light shader source: ' + detail).slice(0, 1024),
      arguments.length > 2 ? { cause } : undefined);
    this.name = 'DirectionalLightShaderSourceError';
  }
}
export interface DirectionalLightShaderSlot {
  nodeId: string;
  index: number;
  directionUniform: string;
  colorUniform: string;
  intensityUniform: string;
}
export interface DirectionalLightShaderExecutionLight {
  nodeId: string;
  index: number;
  unitDirection: Vec3;
  colorLinearRGB: RGB;
  intensity: number;
}
export interface DirectionalLightShaderExecution {
  ambientStrength: number;
  lights: DirectionalLightShaderExecutionLight[];
  materialUniforms: { name: string; glslName: string; value: number }[];
}
export interface DirectionalLightShaderABI {
  ambientUniform: 'nativeAmbientStrength';
  colorUniform: 'color' | null;
  lights: DirectionalLightShaderSlot[];
  materialUniforms: { name: string; glslName: string }[];
}
export interface PreparedDirectionalLightShaderSource {
  readonly format: 'barocss-gpu-native-directional-light-shader-source';
  readonly version: 0;
  readonly profile: 'native-world-directional-linear-mesh-opaque-v0';
  readonly catalog: NativeDirectionalLightsV0;
  readonly material: MeshMaterialBinding | null;
  readonly execution: DirectionalLightShaderExecution;
  readonly abi: DirectionalLightShaderABI;
  readonly shaders: SceneShaders;
}

function check(value: unknown, code: DirectionalLightShaderSourceCode, detail: string): asserts value {
  if (!value) throw new DirectionalLightShaderSourceError(code, detail);
}
function reflect<T>(operation: () => T): T {
  try { return operation(); }
  catch (cause) { throw new DirectionalLightShaderSourceError('INPUT', 'Request own-data reflection refused', cause); }
}
function request(input: unknown): { lights: unknown; material: unknown } {
  check(input !== null && typeof input === 'object', 'INPUT', 'Request requires an own data record');
  const prototype = reflect(() => Object.getPrototypeOf(input));
  check(prototype === Object.prototype || prototype === null, 'INPUT', 'Request requires a plain record');
  const keys = reflect(() => Reflect.ownKeys(input as object));
  check(keys.length === 2 && keys.every(key => key === 'lights' || key === 'material'),
    'INPUT', 'Request requires exactly lights and material');
  const lights = reflect(() => Object.getOwnPropertyDescriptor(input, 'lights'));
  const material = reflect(() => Object.getOwnPropertyDescriptor(input, 'material'));
  check(lights && 'value' in lights && lights.enumerable &&
    material && 'value' in material && material.enumerable,
  'INPUT', 'Request fields must be own enumerable data');
  return { lights: lights.value, material: material.value };
}
function shaderBudget(shaders: SceneShaders): void {
  const encoder = new TextEncoder();
  for (const source of [shaders.vertex, shaders.fragment]) {
    check(source.length <= 65536 && encoder.encode(source).length <= 65536,
      'BUDGET', 'Complete shader source exceeds64KiB UTF16 or UTF8');
  }
}
/** Stream the complete signed finite representation before final graph copying. */
function resultBudget(result: PreparedDirectionalLightShaderSource): void {
  const encoder = new TextEncoder();
  let utf16 = 0, utf8 = 0;
  const append = (text: string): void => {
    utf16 += text.length;
    check(utf16 <= 262144, 'BUDGET', 'Complete shader-source result exceeds256KiB UTF16');
    utf8 += encoder.encode(text).length;
    check(utf8 <= 262144, 'BUDGET', 'Complete shader-source result exceeds256KiB UTF8');
  };
  const visit = (value: unknown): void => {
    if (typeof value === 'number') {
      check(Number.isFinite(value), 'BUDGET', 'Complete result requires finite Number data');
      append(Object.is(value, -0) ? '-0' : JSON.stringify(value)); return;
    }
    if (value === null || typeof value === 'string' || typeof value === 'boolean') {
      append(JSON.stringify(value)); return;
    }
    check(typeof value === 'object', 'BUDGET', 'Complete result requires finite primitive data');
    if (Array.isArray(value)) {
      append('['); value.forEach((child, index) => { if (index) append(','); visit(child); }); append(']'); return;
    }
    append('{'); Object.entries(value).forEach(([key, child], index) => {
      if (index) append(','); append(JSON.stringify(key)); append(':'); visit(child);
    }); append('}');
  };
  visit(result);
}

/** Prepare trusted CPU shader strings and name associations, never a linked native frame. */
export function prepareNativeDirectionalLightShaderSource(input: unknown): PreparedDirectionalLightShaderSource {
  const raw = request(input);
  let lights: ReturnType<typeof prepareNativeDirectionalLights>;
  try { lights = prepareNativeDirectionalLights(raw.lights); }
  catch (cause) { throw new DirectionalLightShaderSourceError('LIGHTS', 'Actual directional catalog admission refused', cause); }
  let material: MeshMaterialBinding | null = null;
  let lowered: LoweredMeshMaterial | null = null;
  if (raw.material !== null) {
    try {
      material = validateMeshMaterialBinding(raw.material);
      lowered = lowerMeshMaterial(material.material);
    } catch (cause) {
      throw new DirectionalLightShaderSourceError('MATERIAL', 'Actual legacy material admission or lowering refused', cause);
    }
  }
  // This is a local invariant of the admitted provider result, outside its
  // failure catch. Never resolve execution values through inherited properties.
  const resolvedMaterialUniforms = lowered === null ? [] : lowered.uniformLayout.map(uniform => {
    const descriptor = Object.getOwnPropertyDescriptor(material!.uniforms, uniform.name);
    check(descriptor && 'value' in descriptor && typeof descriptor.value === 'number' &&
      Number.isFinite(descriptor.value) && descriptor.value >= uniform.min && descriptor.value <= uniform.max,
    'MATERIAL', 'Resolved material uniform requires an own finite Number within its declared range');
    return { name: uniform.name, glslName: uniform.glslName, value: descriptor.value as number };
  });
  const slots: DirectionalLightShaderSlot[] = lights.catalog.lights.map((light, index) => ({
    nodeId: light.nodeId, index,
    directionUniform: 'nativeLightDirection_' + index,
    colorUniform: 'nativeLightColor_' + index,
    intensityUniform: 'nativeLightIntensity_' + index,
  }));
  const materialUniforms = resolvedMaterialUniforms.map(uniform => ({
    name: uniform.name, glslName: uniform.glslName,
  }));
  const execution: DirectionalLightShaderExecution = {
    ambientStrength: lights.catalog.ambientStrength,
    lights: lights.execution.map((light, index) => ({
      nodeId: light.nodeId, index, unitDirection: [...light.unitDirection] as Vec3,
      colorLinearRGB: [...light.colorLinearRGB] as RGB, intensity: light.enabled ? light.intensity : 0,
    })),
    materialUniforms: resolvedMaterialUniforms.map(uniform => ({ ...uniform })),
  };
  const abi: DirectionalLightShaderABI = {
    ambientUniform: 'nativeAmbientStrength', colorUniform: material === null ? 'color' : null,
    lights: slots, materialUniforms,
  };
  const shaders = directionalLightMeshShaderSource(slots.length, lowered);
  shaderBudget(shaders);
  const result: PreparedDirectionalLightShaderSource = {
    format: 'barocss-gpu-native-directional-light-shader-source', version: 0,
    profile: 'native-world-directional-linear-mesh-opaque-v0', catalog: lights.catalog,
    material, execution, abi, shaders,
  };
  resultBudget(result);
  return freezeGpuData(copyGpuData(result));
}
