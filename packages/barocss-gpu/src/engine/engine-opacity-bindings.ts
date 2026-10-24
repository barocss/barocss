import { BarocssError } from '../core/barocss-error.js';
import { ownRecord } from '../mesh/gpu-data.js';
import { prepareEngineScene } from './engine-scene.js';
import type { PreparedEngineScene } from './engine-scene.js';
import type { Vec3 } from '../scene/scene-types.js';

export const EngineOpacityBindingsDiagnosticCode = Object.freeze({
  INPUT: 'INPUT', VERSION: 'VERSION', BUDGET: 'BUDGET', REFERENCE: 'REFERENCE',
  RANGE: 'RANGE', SCENE: 'SCENE', NUMERICAL: 'NUMERICAL',
} as const);
export type EngineOpacityBindingsDiagnosticCode =
  typeof EngineOpacityBindingsDiagnosticCode[keyof typeof EngineOpacityBindingsDiagnosticCode];

export class EngineOpacityBindingsError extends BarocssError {
  constructor(readonly code: EngineOpacityBindingsDiagnosticCode, detail: string, cause?: unknown) {
    super(code, 'Engine opacity bindings: ' + detail,
      cause === undefined ? { maxLength: 1024 } : { cause, maxLength: 1024 });
    this.name = 'EngineOpacityBindingsError';
  }
}

export interface EngineOpacityBindingV0 { materialId: string; opacity: number }
export interface EngineOpacityBindingsV0 {
  format: 'barocss-gpu-engine-opacity-bindings'; version: 0; sceneId: string;
  bindings: EngineOpacityBindingV0[];
}
export interface PreparedEngineOpacityBindings {
  readonly scene: PreparedEngineScene;
  readonly opacityBindings: EngineOpacityBindingsV0;
  readonly opaqueNodeIds: string[];
  readonly transparentNodeIds: string[];
  readonly omittedNodeIds: string[];
}

const CODE = EngineOpacityBindingsDiagnosticCode;
function check(value: unknown, code: EngineOpacityBindingsDiagnosticCode, detail: string): asserts value {
  if (!value) throw new EngineOpacityBindingsError(code, detail);
}
function identifier(value: unknown, label: string): string {
  check(typeof value === 'string' && /^[A-Za-z_][A-Za-z0-9_.:-]{0,63}$/.test(value),
    CODE.INPUT, label + ' requires an ASCII identifier of 1..64 characters');
  return value;
}
function bindings(input: unknown): EngineOpacityBindingV0[] {
  check(Array.isArray(input) && Object.getPrototypeOf(input) === Array.prototype,
    CODE.INPUT, 'Bindings require a plain array');
  const length = Object.getOwnPropertyDescriptor(input, 'length');
  check(length && 'value' in length && Number.isInteger(length.value) && length.value >= 0,
    CODE.INPUT, 'Bindings require an own array length');
  const count = length.value as number;
  // Bound reflection and copies before enumerating array keys or preparing a scene.
  check(count <= 32, CODE.BUDGET, 'Bindings exceed 32 entries');
  const keys = Reflect.ownKeys(input);
  check(keys.length === count + 1, CODE.INPUT, 'Bindings must be dense without additional fields');
  for (const key of keys) if (key !== 'length') {
    check(typeof key === 'string' && /^(0|[1-9]\d*)$/.test(key) && Number(key) < count,
      CODE.INPUT, 'Bindings have unsupported array keys');
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    check(descriptor && 'value' in descriptor && descriptor.enumerable,
      CODE.INPUT, 'Binding elements must be own enumerable data');
  }
  const result: EngineOpacityBindingV0[] = [];
  for (let i = 0; i < count; i++) {
    const data = ownRecord(Object.getOwnPropertyDescriptor(input, String(i))!.value,
      ['materialId', 'opacity'], ['materialId', 'opacity'], 'opacity binding');
    const materialId = identifier(data.materialId, 'materialId');
    check(typeof data.opacity === 'number' && Number.isFinite(data.opacity)
      && data.opacity >= 0 && data.opacity <= 1, CODE.RANGE, 'Opacity must be finite within 0..1');
    result.push({ materialId, opacity: data.opacity });
  }
  return result;
}
function forward(target: Vec3, eye: Vec3): Vec3 {
  const direction = target.map((n, i) => n - eye[i]);
  const scale = Math.max(...direction.map(Math.abs));
  check(Number.isFinite(scale) && scale > 0, CODE.NUMERICAL, 'Camera forward scale is unsafe');
  const scaled = direction.map(n => n / scale), length = Math.hypot(...scaled);
  check(Number.isFinite(length) && length > 0, CODE.NUMERICAL, 'Camera forward length is unsafe');
  const result = scaled.map(n => n / length) as [number, number, number];
  check(result.every(Number.isFinite), CODE.NUMERICAL, 'Camera forward is nonfinite');
  return result;
}

/** Original opacity source and deterministic object order. No renderer or raster admission. */
export function prepareEngineOpacityBindings(sceneInput: unknown, opacityInput: unknown): PreparedEngineOpacityBindings {
  try {
    const root = ownRecord(opacityInput, ['format', 'version', 'sceneId', 'bindings'],
      ['format', 'version', 'sceneId', 'bindings'], 'opacity bindings');
    check(root.format === 'barocss-gpu-engine-opacity-bindings' && root.version === 0,
      CODE.VERSION, 'Only engine opacity bindings0 is supported');
    const sceneId = identifier(root.sceneId, 'sceneId'), originals = bindings(root.bindings);
    let scene: PreparedEngineScene;
    try { scene = prepareEngineScene(sceneInput); }
    catch (cause) { throw new EngineOpacityBindingsError(CODE.SCENE, 'Complete original scene admission refused', cause); }
    check(sceneId === scene.scene.id, CODE.REFERENCE, 'Companion sceneId must match original scene identity');
    const materialIds = new Set(scene.scene.materials.map(material => material.id));
    const opacityByMaterial = new Map<string, number>();
    for (const binding of originals) {
      check(materialIds.has(binding.materialId) && !opacityByMaterial.has(binding.materialId),
        CODE.REFERENCE, 'Bindings require unique existing material IDs');
      opacityByMaterial.set(binding.materialId, binding.opacity);
    }
    const nodes = new Map(scene.nodes.map(node => [node.id, node]));
    const direction = forward(scene.scene.camera.target, scene.scene.camera.eye);
    const opaqueNodeIds: string[] = [], omittedNodeIds: string[] = [];
    const transparent: { id: string; depth: number }[] = [];
    for (const source of scene.scene.nodes) if (source.type === 'mesh') {
      const node = nodes.get(source.id)!, opacity = opacityByMaterial.get(source.materialId) ?? 1;
      if (!node.effectiveVisible || opacity === 0) omittedNodeIds.push(source.id);
      else if (opacity === 1) opaqueNodeIds.push(source.id);
      else {
        check(node.bounds, CODE.NUMERICAL, 'Admitted mesh requires original world bounds');
        const relative = node.bounds.min.map((n, i) =>
          (n + node.bounds!.max[i]) / 2 - scene.scene.camera.eye[i]);
        const depth = direction[0] * relative[0] + direction[1] * relative[1] + direction[2] * relative[2];
        check(relative.every(Number.isFinite) && Number.isFinite(depth), CODE.NUMERICAL,
          'Original world AABB camera depth is nonfinite');
        // At most 32 keys and 496 pair comparisons. Strict comparison retains
        // original source order for exact ties, including signed-zero depths.
        let index = transparent.length;
        while (index > 0 && depth > transparent[index - 1].depth) index--;
        transparent.splice(index, 0, { id: source.id, depth });
      }
    }
    for (const binding of originals) Object.freeze(binding);
    Object.freeze(originals);
    const opacityBindings: EngineOpacityBindingsV0 = Object.freeze({
      format: 'barocss-gpu-engine-opacity-bindings', version: 0, sceneId, bindings: originals,
    });
    const transparentNodeIds = transparent.map(entry => entry.id);
    Object.freeze(opaqueNodeIds); Object.freeze(transparentNodeIds); Object.freeze(omittedNodeIds);
    return Object.freeze({ scene, opacityBindings, opaqueNodeIds, transparentNodeIds, omittedNodeIds });
  } catch (cause) {
    if (cause instanceof EngineOpacityBindingsError) throw cause;
    throw new EngineOpacityBindingsError(CODE.INPUT, 'Own opacity data reflection refused', cause);
  }
}
