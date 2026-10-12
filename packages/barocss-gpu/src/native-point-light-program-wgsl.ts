import { copyGpuData, freezeGpuData } from './gpu-data.js';
import { prepareNativePointLights } from './native-point-lights.js';
import type { NativePointLightsV0 } from './native-point-lights.js';
import { validateMeshMaterialBinding } from './mesh-material.js';
import type { MeshMaterialBinding } from './mesh-material.js';
import { lowerMeshMaterialWGSL } from './mesh-material-wgsl.js';
import type { LoweredMeshMaterialWGSL } from './mesh-material-wgsl.js';
import { pointLightProgramWGSLBody } from './point-light-program-wgsl-body.js';
import type { Vec3, RGB } from './scene-types.js';

export type NativePointLightProgramWGSLCode = 'INPUT' | 'LIGHTS' | 'MATERIAL' | 'REPRESENTATION' | 'BUDGET';
export class NativePointLightProgramWGSLError extends Error {
  constructor(readonly code: NativePointLightProgramWGSLCode, detail: string, cause?: unknown) {
    super(('Native point light WGSL program: ' + detail).slice(0, 1024),
      arguments.length > 2 ? { cause } : undefined);
    this.name = 'NativePointLightProgramWGSLError';
  }
}
export interface NativePointLightProgramWGSLRequest {
  lights: NativePointLightsV0;
  material: MeshMaterialBinding | null;
}
export interface NativePointLightProgramWGSLSlot {
  nodeId: string; index: number; positionRangeOffset: number; colorIntensityOffset: number;
}
export interface NativePointLightProgramWGSLExecution {
  ambientStrength: number;
  lights: { nodeId: string; index: number; positionScene: Vec3; rangeScene: number; colorLinearRGB: RGB; intensity: number }[];
  materialUniforms: { name: string; index: number; byteOffset: number; value: number }[];
}
export interface NativePointLightProgramWGSLABI {
  vertexBuffers: { slot: number; shaderLocation: number; arrayStride: 12; format: 'float32x3' }[];
  bindings: { group: 0; binding: number; byteLength: number; visibility: 'vertex-fragment' | 'fragment' }[];
  lightSlots: NativePointLightProgramWGSLSlot[];
  materialUniforms: { name: string; index: number; byteOffset: number }[];
  colorTargets: ['rgba8unorm', 'r32uint'];
  depth: { format: 'depth24plus'; writeEnabled: true; compare: 'less' };
}
export interface NativePointLightProgramWGSLProgram {
  code: string; vertexEntryPoint: 'vertexMain'; fragmentEntryPoint: 'fragmentMain';
}
export interface NativePointLightProgramWGSLUniforms {
  /** Fresh caller-owned mutable upload artifacts, never trusted inputs. */
  readonly material: Uint8Array;
  readonly lights: Uint8Array;
}
export interface PreparedNativePointLightProgramWGSL {
  readonly format: 'barocss-gpu-native-point-light-program-wgsl';
  readonly version: 0;
  readonly profile: 'native-world-point-linear-mesh-opaque-wgsl-v0';
  readonly originals: NativePointLightProgramWGSLRequest;
  readonly execution: NativePointLightProgramWGSLExecution;
  readonly abi: NativePointLightProgramWGSLABI;
  readonly program: NativePointLightProgramWGSLProgram;
  readonly uniforms: NativePointLightProgramWGSLUniforms;
}

function check(value: unknown, code: NativePointLightProgramWGSLCode, detail: string): asserts value {
  if (!value) throw new NativePointLightProgramWGSLError(code, detail);
}
/** Only caller reflection belongs in this catch, never a local guard. */
function reflect<T>(code: 'INPUT' | 'MATERIAL', operation: () => T): T {
  try { return operation(); }
  catch (cause) { throw new NativePointLightProgramWGSLError(code, 'Own data reflection refused', cause); }
}
function request(input: unknown): { lights: unknown; material: unknown } {
  check(input !== null && typeof input === 'object', 'INPUT', 'Request requires an own data record');
  const prototype = reflect('INPUT', () => Object.getPrototypeOf(input));
  check(prototype === Object.prototype || prototype === null, 'INPUT', 'Request requires a current-realm plain record');
  const keys = reflect('INPUT', () => Reflect.ownKeys(input as object));
  check(keys.length === 2 && keys.every(key => key === 'lights' || key === 'material'),
    'INPUT', 'Request requires exactly lights and material');
  const lights = reflect('INPUT', () => Object.getOwnPropertyDescriptor(input, 'lights'));
  const material = reflect('INPUT', () => Object.getOwnPropertyDescriptor(input, 'material'));
  check(lights && 'value' in lights && lights.enumerable && material && 'value' in material && material.enumerable,
    'INPUT', 'Request fields must be own enumerable data');
  return { lights: lights.value, material: material.value };
}
/** Preserve signed Numbers and omitted overrides before the legacy binder normalizes them. */
function materialSnapshot(input: unknown): unknown {
  let visits = 0;
  const active = new WeakSet<object>();
  const copy = (value: unknown, depth: number): unknown => {
    check(++visits <= 8192 && depth <= 24, 'MATERIAL', 'Material snapshot value/depth limit');
    if (typeof value === 'number') {
      check(Number.isFinite(value), 'MATERIAL', 'Material snapshot requires finite Numbers'); return value;
    }
    if (typeof value === 'string') {
      check(value.length <= 65536, 'MATERIAL', 'Material snapshot string limit'); return value;
    }
    if (value === null || typeof value === 'boolean') return value;
    check(typeof value === 'object' && !active.has(value), 'MATERIAL', 'Material snapshot requires acyclic plain data');
    const array = reflect('MATERIAL', () => Array.isArray(value));
    const prototype = reflect('MATERIAL', () => Object.getPrototypeOf(value));
    check(prototype === (array ? Array.prototype : Object.prototype), 'MATERIAL', 'Material snapshot foreign prototype');
    const keys = reflect('MATERIAL', () => Reflect.ownKeys(value));
    check(keys.length <= (array ? 257 : 16), 'MATERIAL', 'Material snapshot field limit');
    const descriptors = keys.map(key => {
      check(typeof key === 'string', 'MATERIAL', 'Material snapshot refuses symbols');
      const descriptor = reflect('MATERIAL', () => Object.getOwnPropertyDescriptor(value, key));
      check(descriptor && 'value' in descriptor && (descriptor.enumerable || array && key === 'length'),
        'MATERIAL', 'Material snapshot refuses accessors or hidden fields');
      return [key, descriptor.value] as const;
    });
    active.add(value);
    let output: unknown;
    if (array) {
      const length = descriptors.find(([key]) => key === 'length')?.[1];
      check(typeof length === 'number' && Number.isInteger(length) && length >= 0 && length <= 256 &&
        descriptors.length === length + 1 && descriptors.every(([key]) => key === 'length' ||
          /^(0|[1-9]\d*)$/.test(key) && Number(key) < length),
      'MATERIAL', 'Material snapshot requires dense bounded arrays');
      const indexed = new Map(descriptors);
      output = Array.from({ length }, (_, index) => {
        check(indexed.has(String(index)), 'MATERIAL', 'Material snapshot refuses sparse arrays');
        return copy(indexed.get(String(index)), depth + 1);
      });
    } else output = Object.fromEntries(descriptors.map(([key, child]) => [key, copy(child, depth + 1)]));
    active.delete(value);
    return output;
  };
  return copy(input, 0);
}
function executed(value: number): number {
  const rounded = Math.fround(value);
  check(Number.isFinite(value) && Number.isFinite(rounded) && !(value !== 0 && rounded === 0),
    'REPRESENTATION', 'Executed Number must remain finite and nonzero as f32');
  return rounded;
}
/** Stream the signed ordinary projection; charge binary storage separately, before allocating it. */
function resultBudget(result: Omit<PreparedNativePointLightProgramWGSL, 'uniforms'>): void {
  const encoder = new TextEncoder();
  check(result.program.code.length <= 65536 && encoder.encode(result.program.code).length <= 65536,
    'BUDGET', 'Complete WGSL exceeds64KiB UTF16 or UTF8');
  let utf16 = 0, utf8 = 0, visits = 0;
  const append = (text: string): void => {
    utf16 += text.length;
    check(utf16 <= 2097152, 'BUDGET', 'Complete ordinary result exceeds2MiB UTF16');
    utf8 += encoder.encode(text).length;
    check(utf8 <= 2097152, 'BUDGET', 'Complete ordinary result exceeds2MiB UTF8');
  };
  const visit = (value: unknown, depth: number): void => {
    check(++visits <= 32768 && depth <= 48, 'BUDGET', 'Complete ordinary result value/depth limit');
    if (typeof value === 'number') {
      check(Number.isFinite(value), 'BUDGET', 'Complete result requires finite Numbers');
      append(Object.is(value, -0) ? '-0' : JSON.stringify(value)); return;
    }
    if (value === null || typeof value === 'string' || typeof value === 'boolean') {
      append(JSON.stringify(value)); return;
    }
    check(typeof value === 'object', 'BUDGET', 'Complete result requires ordinary data');
    if (Array.isArray(value)) {
      append('['); value.forEach((child, index) => { if (index) append(','); visit(child, depth + 1); }); append(']'); return;
    }
    append('{'); Object.entries(value).forEach(([key, child], index) => {
      if (index) append(','); append(JSON.stringify(key)); append(':'); visit(child, depth + 1);
    }); append('}');
  };
  visit(result, 0);
  // Exactly64 material +144 light bytes, apart from the ordinary projection caps.
  const binaryBytes = 64 + 144;
  check(binaryBytes === 208, 'BUDGET', 'Unexpected upload byte budget');
}

/** Trusted CPU WGSL + bytes only; no shader compilation, device, frame or backend admission. */
export function prepareNativePointLightProgramWGSL(input: unknown): PreparedNativePointLightProgramWGSL {
  const raw = request(input);
  let lights: ReturnType<typeof prepareNativePointLights>;
  try { lights = prepareNativePointLights(raw.lights); }
  catch (cause) { throw new NativePointLightProgramWGSLError('LIGHTS', 'Actual point catalog admission refused', cause); }
  let originalMaterial: MeshMaterialBinding | null = null;
  let material: MeshMaterialBinding | null = null;
  let lowered: LoweredMeshMaterialWGSL | null = null;
  if (raw.material !== null) {
    const snapshot = materialSnapshot(raw.material);
    try {
      material = validateMeshMaterialBinding(snapshot);
      lowered = lowerMeshMaterialWGSL(material.material);
    } catch (cause) {
      throw new NativePointLightProgramWGSLError('MATERIAL', 'Actual legacy material admission or WGSL lowering refused', cause);
    }
    originalMaterial = snapshot as MeshMaterialBinding;
  }
  // Provider output only; complete all resolution invariants before representation checks.
  const resolved = lowered === null ? [] : lowered.uniformLayout.map(uniform => {
    const descriptor = Object.getOwnPropertyDescriptor(material!.uniforms, uniform.name);
    check(descriptor && 'value' in descriptor && typeof descriptor.value === 'number' &&
      Number.isFinite(descriptor.value) && descriptor.value >= uniform.min && descriptor.value <= uniform.max,
    'MATERIAL', 'Resolved material uniform requires an own finite Number within its declared range');
    return { name: uniform.name, index: uniform.index, byteOffset: uniform.byteOffset, value: descriptor.value as number };
  });
  const execution: NativePointLightProgramWGSLExecution = {
    ambientStrength: executed(lights.catalog.ambientStrength),
    lights: lights.execution.map((light, index) => ({
      nodeId: light.nodeId, index, positionScene: light.positionScene.map(executed) as Vec3, rangeScene: executed(light.rangeScene),
      colorLinearRGB: light.colorLinearRGB.map(executed) as RGB, intensity: light.enabled ? executed(light.intensity) : 0,
    })),
    materialUniforms: resolved.map(uniform => ({ ...uniform, value: executed(uniform.value) })),
  };
  const abi: NativePointLightProgramWGSLABI = {
    vertexBuffers: [0, 1].map(slot => ({ slot, shaderLocation: slot, arrayStride: 12, format: 'float32x3' })),
    bindings: [
      { group: 0, binding: 0, byteLength: 144, visibility: 'vertex-fragment' },
      { group: 0, binding: 1, byteLength: 64, visibility: 'fragment' },
      { group: 0, binding: 2, byteLength: 144, visibility: 'fragment' },
      { group: 0, binding: 3, byteLength: 16, visibility: 'fragment' },
    ],
    lightSlots: lights.catalog.lights.map((light, index) => ({
      nodeId: light.nodeId, index, positionRangeOffset: 16 + 32 * index, colorIntensityOffset: 32 + 32 * index,
    })),
    materialUniforms: resolved.map(({ name, index, byteOffset }) => ({ name, index, byteOffset })),
    colorTargets: ['rgba8unorm', 'r32uint'], depth: { format: 'depth24plus', writeEnabled: true, compare: 'less' },
  };
  const result: Omit<PreparedNativePointLightProgramWGSL, 'uniforms'> = {
    format: 'barocss-gpu-native-point-light-program-wgsl', version: 0,
    profile: 'native-world-point-linear-mesh-opaque-wgsl-v0',
    originals: { lights: lights.catalog, material: originalMaterial }, execution, abi,
    program: { code: pointLightProgramWGSLBody(lights.catalog.lights.length, lowered),
      vertexEntryPoint: 'vertexMain', fragmentEntryPoint: 'fragmentMain' },
  };
  resultBudget(result);
  const owned = freezeGpuData(copyGpuData(result));
  const materialBytes = new Uint8Array(64), lightBytes = new Uint8Array(144);
  const materialView = new DataView(materialBytes.buffer), lightView = new DataView(lightBytes.buffer);
  for (const uniform of owned.execution.materialUniforms) materialView.setFloat32(uniform.byteOffset, uniform.value, true);
  lightView.setFloat32(0, owned.execution.ambientStrength, true);
  for (const light of owned.execution.lights) {
    const offset = 16 + 32 * light.index;
    light.positionScene.forEach((value, axis) => lightView.setFloat32(offset + 4 * axis, value, true));
    lightView.setFloat32(offset + 12, light.rangeScene, true);
    lightView.setFloat32(offset + 28, light.intensity, true);
    light.colorLinearRGB.forEach((value, axis) => lightView.setFloat32(offset + 16 + 4 * axis, value, true));
  }
  return Object.freeze({ ...owned, uniforms: Object.freeze({ material: materialBytes, lights: lightBytes }) });
}
