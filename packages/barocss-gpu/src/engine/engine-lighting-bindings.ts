import { BarocssError } from '../core/barocss-error.js';
import { ownRecord } from '../mesh/gpu-data.js';
import { prepareEngineScene } from './engine-scene.js';
import type { PreparedEngineScene } from './engine-scene.js';
import { validateMeshLighting } from '../mesh/mesh-lighting.js';
import type { MeshLighting } from '../mesh/mesh-lighting.js';
import type { Vec3 } from '../scene/scene-types.js';

export const EngineLightingBindingsDiagnosticCode = Object.freeze({
  INPUT: 'INPUT', VERSION: 'VERSION', BUDGET: 'BUDGET', REFERENCE: 'REFERENCE',
  LIGHTING: 'LIGHTING', SCENE: 'SCENE', NUMERICAL: 'NUMERICAL',
} as const);
export type EngineLightingBindingsDiagnosticCode =
  typeof EngineLightingBindingsDiagnosticCode[keyof typeof EngineLightingBindingsDiagnosticCode];
export class EngineLightingBindingsError extends BarocssError {
  constructor(readonly code: EngineLightingBindingsDiagnosticCode, detail: string, cause?: unknown) {
    super(code, 'Engine lighting bindings: ' + detail,
      cause === undefined ? { maxLength: 1024 } : { cause, maxLength: 1024 });
    this.name = 'EngineLightingBindingsError';
  }
}
export interface EngineLightingBindingV0 { materialId: string; response: 'lambert' }
export interface EngineLightingBindingsV0 {
  format: 'barocss-gpu-engine-lighting-bindings'; version: 0; sceneId: string;
  lighting: MeshLighting; bindings: EngineLightingBindingV0[];
}
export interface PreparedEngineLightingBindings {
  readonly scene: PreparedEngineScene;
  readonly lightingBindings: EngineLightingBindingsV0;
  readonly lightDirection: Vec3;
  readonly litMaterialIds: string[];
}

const CODE = EngineLightingBindingsDiagnosticCode;
function check(value: unknown, code: EngineLightingBindingsDiagnosticCode, detail: string): asserts value {
  if (!value) throw new EngineLightingBindingsError(code, detail);
}
function identifier(value: unknown, label: string): string {
  check(typeof value === 'string' && /^[A-Za-z_][A-Za-z0-9_.:-]{0,63}$/.test(value),
    CODE.INPUT, label + ' requires an ASCII identifier of 1..64 characters');
  return value;
}
function count(input: unknown, maximum: number, label: string): number {
  check(Array.isArray(input) && Object.getPrototypeOf(input) === Array.prototype,
    CODE.INPUT, label + ' requires a plain array');
  const descriptor = Object.getOwnPropertyDescriptor(input, 'length');
  check(descriptor && 'value' in descriptor && Number.isInteger(descriptor.value) && descriptor.value >= 0,
    CODE.INPUT, label + ' requires an own array length');
  check(descriptor.value <= maximum, CODE.BUDGET, label + ' exceeds its cardinality limit');
  return descriptor.value as number;
}
function dense(input: unknown, length: number, label: string): unknown[] {
  const keys = Reflect.ownKeys(input as object);
  check(keys.length === length + 1, CODE.INPUT, label + ' requires dense own data without extra fields');
  for (const key of keys) if (key !== 'length') {
    check(typeof key === 'string' && /^(0|[1-9]\d*)$/.test(key) && Number(key) < length,
      CODE.INPUT, label + ' has unsupported array keys');
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    check(descriptor && 'value' in descriptor && descriptor.enumerable,
      CODE.INPUT, label + ' elements must be own enumerable data');
  }
  return Array.from({ length }, (_, i) => Object.getOwnPropertyDescriptor(input, String(i))!.value);
}
function normalized(direction: Vec3): Vec3 {
  const scale = Math.max(...direction.map(Math.abs));
  check(Number.isFinite(scale) && scale > 0, CODE.NUMERICAL, 'Light direction scale is unsafe');
  const scaled = direction.map(n => n / scale), length = Math.hypot(...scaled);
  check(Number.isFinite(length) && length > 0, CODE.NUMERICAL, 'Light direction length is unsafe');
  const result = scaled.map(n => n / length) as [number, number, number];
  check(result.every(Number.isFinite), CODE.NUMERICAL, 'Unit light direction is nonfinite');
  Object.freeze(result);
  return result;
}

/** Original world-light companion and derived unit direction; no shader or pixel support. */
export function prepareEngineLightingBindings(sceneInput: unknown, lightingInput: unknown): PreparedEngineLightingBindings {
  try {
    const root = ownRecord(lightingInput, ['format', 'version', 'sceneId', 'lighting', 'bindings']);
    check(root.format === 'barocss-gpu-engine-lighting-bindings' && root.version === 0,
      CODE.VERSION, 'Only engine lighting bindings0 is supported');
    const sceneId = identifier(root.sceneId, 'sceneId');
    const bindingCount = count(root.bindings, 32, 'Bindings');
    const light = ownRecord(root.lighting, ['ambientStrength', 'directionalStrength', 'direction']);
    const directionCount = count(light.direction, 3, 'Light direction');
    check(directionCount === 3, CODE.INPUT, 'Light direction requires exactly three components');
    // Both array lengths are admitted before key reflection or scene allocation.
    const direction = dense(light.direction, directionCount, 'Light direction');
    const entries = dense(root.bindings, bindingCount, 'Bindings');
    let lighting: MeshLighting;
    try {
      lighting = validateMeshLighting({ ambientStrength: light.ambientStrength,
        directionalStrength: light.directionalStrength, direction });
    } catch (cause) {
      throw new EngineLightingBindingsError(CODE.LIGHTING, 'Actual mesh lighting admission refused', cause);
    }
    const bindings: EngineLightingBindingV0[] = entries.map(input => {
      const data = ownRecord(input, ['materialId', 'response']);
      const materialId = identifier(data.materialId, 'materialId');
      check(data.response === 'lambert', CODE.VERSION, 'Only explicit Lambert binding response is supported');
      return { materialId, response: 'lambert' };
    });
    let scene: PreparedEngineScene;
    try { scene = prepareEngineScene(sceneInput); }
    catch (cause) { throw new EngineLightingBindingsError(CODE.SCENE, 'Complete original scene admission refused', cause); }
    check(sceneId === scene.scene.id, CODE.REFERENCE, 'Companion sceneId must match original scene identity');
    const materialIds = new Set(scene.scene.materials.map(material => material.id)), usedIds = new Set<string>();
    for (const binding of bindings) {
      check(materialIds.has(binding.materialId) && !usedIds.has(binding.materialId),
        CODE.REFERENCE, 'Bindings require unique existing material IDs');
      usedIds.add(binding.materialId);
    }
    const lightDirection = normalized(lighting.direction);
    for (const binding of bindings) Object.freeze(binding);
    Object.freeze(bindings);
    const lightingBindings: EngineLightingBindingsV0 = Object.freeze({
      format: 'barocss-gpu-engine-lighting-bindings', version: 0, sceneId, lighting, bindings,
    });
    const litMaterialIds = bindings.map(binding => binding.materialId);
    Object.freeze(litMaterialIds);
    return Object.freeze({ scene, lightingBindings, lightDirection, litMaterialIds });
  } catch (cause) {
    if (cause instanceof EngineLightingBindingsError) throw cause;
    throw new EngineLightingBindingsError(CODE.INPUT, 'Own lighting data reflection refused', cause);
  }
}
