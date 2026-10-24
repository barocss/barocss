import { BarocssError } from '../core/barocss-error.js';
import { ownRecord, freezeGpuData } from '../mesh/gpu-data.js';
import { prepareEngineScene } from './engine-scene.js';
import type { PreparedEngineScene } from './engine-scene.js';
import { validateMeshMaterialBinding, lowerMeshMaterial, validateEngineUVMaterialBinding, lowerEngineUVMaterial, validateEngineUVRepeatingMaterialBinding, lowerEngineUVRepeatingMaterial } from '../material/mesh-material.js';
import type { MeshMaterialIR, MeshMaterialBinding, LoweredMeshMaterial, EngineUVMaterialIR, EngineUVMaterialBinding, LoweredEngineUVMaterial, EngineUVRepeatingMaterialIR, EngineUVRepeatingMaterialBinding } from '../material/mesh-material.js';

export const EngineMaterialBindingsDiagnosticCode = Object.freeze({
  INPUT: 'INPUT', VERSION: 'VERSION', BUDGET: 'BUDGET', REFERENCE: 'REFERENCE',
  MATERIAL: 'MATERIAL', SCENE: 'SCENE',
} as const);
export type EngineMaterialBindingsDiagnosticCode =
  typeof EngineMaterialBindingsDiagnosticCode[keyof typeof EngineMaterialBindingsDiagnosticCode];
export class EngineMaterialBindingsError extends BarocssError {
  constructor(readonly code: EngineMaterialBindingsDiagnosticCode, detail: string, cause?: unknown) {
    super(code, ('Engine material bindings: ' + detail).slice(0, 1024),
      cause === undefined ? undefined : { cause });
    this.name = 'EngineMaterialBindingsError';
  }
}
export interface EngineMaterialBindingV0 {
  materialId: string; material: MeshMaterialIR; uniforms: Record<string, number>;
}
export interface EngineMaterialBindingsV0 {
  format: 'barocss-gpu-engine-material-bindings'; version: 0; sceneId: string;
  bindings: EngineMaterialBindingV0[];
}
export interface PreparedEngineMaterialBindings {
  readonly scene: PreparedEngineScene;
  readonly materialBindings: EngineMaterialBindingsV0;
  readonly resolvedBindings: { materialId: string; binding: MeshMaterialBinding }[];
  readonly loweredBindings: { materialId: string; lowered: LoweredMeshMaterial }[];
}

export interface EngineUVMaterialBindingV0 {
  materialId: string; material: EngineUVMaterialIR; uniforms: Record<string, number>;
}
export interface EngineUVMaterialBindingsV0 {
  format: 'barocss-gpu-engine-uv-material-bindings'; version: 0; sceneId: string;
  bindings: EngineUVMaterialBindingV0[];
}
export interface PreparedEngineUVMaterialBindings {
  readonly scene: PreparedEngineScene;
  readonly materialBindings: EngineUVMaterialBindingsV0;
  readonly resolvedBindings: { materialId: string; binding: EngineUVMaterialBinding }[];
  readonly loweredBindings: { materialId: string; lowered: LoweredEngineUVMaterial }[];
}

export interface EngineUVRepeatingMaterialBindingV0 {
  materialId: string; material: EngineUVRepeatingMaterialIR; uniforms: Record<string, number>;
}
export interface EngineUVRepeatingMaterialBindingsV0 {
  format: 'barocss-gpu-engine-uv-repeating-material-bindings'; version: 0; sceneId: string;
  bindings: EngineUVRepeatingMaterialBindingV0[];
}
export interface PreparedEngineUVRepeatingMaterialBindings {
  readonly scene: PreparedEngineScene;
  readonly materialBindings: EngineUVRepeatingMaterialBindingsV0;
  readonly resolvedBindings: { materialId: string; binding: EngineUVRepeatingMaterialBinding }[];
  readonly loweredBindings: { materialId: string; lowered: LoweredEngineUVMaterial }[];
}

// Trusted profiles reuse the catalog guards. Callers cannot supply a profile or providers.
type MaterialIR = MeshMaterialIR | EngineUVMaterialIR | EngineUVRepeatingMaterialIR;
type MaterialBinding = MeshMaterialBinding | EngineUVMaterialBinding | EngineUVRepeatingMaterialBinding;
type LoweredMaterial = LoweredMeshMaterial | LoweredEngineUVMaterial;
type CatalogEntry<M extends MaterialIR> = { materialId: string; material: M; uniforms: Record<string, number> };
interface PreparedCatalog<M extends MaterialIR, F extends string, B extends MaterialBinding, L extends LoweredMaterial> {
  readonly scene: PreparedEngineScene;
  readonly materialBindings: { format: F; version: 0; sceneId: string; bindings: CatalogEntry<M>[] };
  readonly resolvedBindings: { materialId: string; binding: B }[];
  readonly loweredBindings: { materialId: string; lowered: L }[];
}
interface CatalogProfile<M extends MaterialIR, F extends string, B extends MaterialBinding, L extends LoweredMaterial> {
  format: F;
  bind(input: unknown): B;
  lower(input: M): L;
}
const legacyProfile: CatalogProfile<MeshMaterialIR, 'barocss-gpu-engine-material-bindings', MeshMaterialBinding, LoweredMeshMaterial> = {
  format: 'barocss-gpu-engine-material-bindings', bind: validateMeshMaterialBinding, lower: lowerMeshMaterial,
};
const uvProfile: CatalogProfile<EngineUVMaterialIR, 'barocss-gpu-engine-uv-material-bindings', EngineUVMaterialBinding, LoweredEngineUVMaterial> = {
  format: 'barocss-gpu-engine-uv-material-bindings', bind: validateEngineUVMaterialBinding, lower: lowerEngineUVMaterial,
};

const repeatingUVProfile: CatalogProfile<EngineUVRepeatingMaterialIR, 'barocss-gpu-engine-uv-repeating-material-bindings', EngineUVRepeatingMaterialBinding, LoweredEngineUVMaterial> = {
  format: 'barocss-gpu-engine-uv-repeating-material-bindings', bind: validateEngineUVRepeatingMaterialBinding, lower: lowerEngineUVRepeatingMaterial,
};

const CODE = EngineMaterialBindingsDiagnosticCode;
const IR_FIELDS = ['format', 'version', 'profile', 'source', 'shaderId', 'uniforms', 'expression'];
function check(value: unknown, code: EngineMaterialBindingsDiagnosticCode, detail: string): asserts value {
  if (!value) throw new EngineMaterialBindingsError(code, detail);
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
function uniformKeys(input: unknown): PropertyKey[] {
  check(input && typeof input === 'object' && Object.getPrototypeOf(input) === Object.prototype,
    CODE.INPUT, 'Supplied uniforms require a plain own record');
  const keys = Reflect.ownKeys(input);
  check(keys.length <= 16, CODE.BUDGET, 'Supplied uniform count exceeds16');
  return keys;
}

/** Independent own snapshots preserve original signs before the trusted binders normalize zero. */
function snapshot(input: unknown): unknown {
  let remaining = 8192;
  const active = new WeakSet<object>();
  function copy(value: unknown, depth: number): unknown {
    check(--remaining >= 0 && depth <= 24, CODE.BUDGET, 'Material own-data value/depth limit');
    if (typeof value === 'number') {
      check(Number.isFinite(value), CODE.INPUT, 'Material own data requires finite numbers');
      return value;
    }
    if (typeof value === 'string') {
      check(value.length <= 65536, CODE.BUDGET, 'Material own-data string limit');
      return value;
    }
    if (typeof value === 'boolean' || value === null) return value;
    check(value && typeof value === 'object' && !active.has(value),
      CODE.INPUT, 'Material requires acyclic plain own data');
    const array = Array.isArray(value);
    let length = 0;
    if (array) length = count(value, 256, 'Material own-data array');
    else check(Object.getPrototypeOf(value) === Object.prototype, CODE.INPUT, 'Material foreign prototype');
    const keys = Reflect.ownKeys(value);
    check(keys.length <= (array ? 257 : 16), array ? CODE.INPUT : CODE.BUDGET, 'Material excess own fields');
    const descriptors = Object.getOwnPropertyDescriptors(value);
    check(keys.every(key => typeof key === 'string' && 'value' in descriptors[key]
      && (array && key === 'length' || descriptors[key].enumerable)),
    CODE.INPUT, 'Material getter/hidden/symbol fields');
    active.add(value);
    let result: unknown;
    if (array) {
      check(keys.length === length + 1 && Array.from({ length }, (_, i) =>
        Object.hasOwn(descriptors, String(i))).every(Boolean), CODE.INPUT, 'Material requires dense arrays');
      result = Array.from({ length }, (_, i) => copy(descriptors[String(i)].value, depth + 1));
    } else result = Object.fromEntries((keys as string[]).map(key =>
      [key, copy(descriptors[key].value, depth + 1)]));
    active.delete(value);
    return result;
  }
  return copy(input, 0);
}

/** Full original authored source and independent resolved/lowered catalogs; no graphics support. */
export function prepareEngineMaterialBindings(sceneInput: unknown, materialInput: unknown): PreparedEngineMaterialBindings {
  return prepareBindings(sceneInput, materialInput, legacyProfile);
}
/** Explicit UV source companion; the legacy profile is not upgraded or mixed. */
export function prepareEngineUVMaterialBindings(sceneInput: unknown, materialInput: unknown): PreparedEngineUVMaterialBindings {
  return prepareBindings(sceneInput, materialInput, uvProfile);
}
/** Explicit repeating UV companion; existing profiles and source catalogs stay separate. */
export function prepareEngineUVRepeatingMaterialBindings(sceneInput: unknown, materialInput: unknown): PreparedEngineUVRepeatingMaterialBindings {
  return prepareBindings(sceneInput, materialInput, repeatingUVProfile);
}
function prepareBindings<M extends MaterialIR, F extends string, B extends MaterialBinding, L extends LoweredMaterial>(
  sceneInput: unknown, materialInput: unknown, profile: CatalogProfile<M, F, B, L>,
): PreparedCatalog<M, F, B, L> {
  try {
    const root = ownRecord(materialInput, ['format', 'version', 'sceneId', 'bindings']);
    check(root.format === profile.format && root.version === 0,
      CODE.VERSION, 'Only engine material bindings0 is supported');
    const sceneId = identifier(root.sceneId, 'sceneId');
    const length = count(root.bindings, 8, 'Bindings');
    const entries = dense(root.bindings, length, 'Bindings');
    let sourceUnits = 0, sourceBytes = 0, declarations = 0, values = 0;
    // All headers/cardinalities and source bytes admit before full IR snapshots or providers.
    const headers = entries.map(input => {
      const data = ownRecord(input, ['materialId', 'material', 'uniforms']);
      const materialId = identifier(data.materialId, 'materialId');
      check(data.material && typeof data.material === 'object'
        && Object.getPrototypeOf(data.material) === Object.prototype,
      CODE.INPUT, 'Material IR requires a plain own record');
      const material = ownRecord(data.material, IR_FIELDS);
      check(typeof material.source === 'string', CODE.INPUT, 'Full original material source required');
      sourceUnits += material.source.length;
      check(sourceUnits <= 65536, CODE.BUDGET, 'Aggregate material source exceeds64KiB code units');
      declarations += count(material.uniforms, 16, 'Material uniform declarations');
      values += uniformKeys(data.uniforms).length;
      check(declarations <= 128 && values <= 128, CODE.BUDGET, 'Aggregate uniform count exceeds128');
      return { materialId, material, uniforms: data.uniforms };
    });
    for (const header of headers) {
      sourceBytes += new TextEncoder().encode(header.material.source as string).length;
      check(sourceBytes <= 65536, CODE.BUDGET, 'Aggregate UTF8 material source exceeds64KiB');
    }
    const bindings = headers.map(header => snapshot(header) as CatalogEntry<M>);
    for (const entry of bindings) {
      count(entry.material.uniforms, 16, 'Snapshot material uniform declarations');
      uniformKeys(entry.uniforms);
      check(Object.values(entry.uniforms).every(value => typeof value === 'number' && Number.isFinite(value)),
        CODE.INPUT, 'Supplied uniforms require finite scalar numbers');
      check(!Object.hasOwn(entry.uniforms, '__proto__')
        && entry.material.uniforms.every(uniform => !uniform || typeof uniform !== 'object'
          || uniform.name !== '__proto__'), CODE.INPUT, 'Uniform name __proto__ is unsupported by this service');
    }
    const resolvedBindings: PreparedCatalog<M, F, B, L>['resolvedBindings'] = [];
    const loweredBindings: PreparedCatalog<M, F, B, L>['loweredBindings'] = [];
    for (const entry of bindings) {
      try {
        const binding = profile.bind({ material: entry.material, uniforms: entry.uniforms });
        const lowered = profile.lower(binding.material as M);
        resolvedBindings.push({ materialId: entry.materialId, binding });
        loweredBindings.push({ materialId: entry.materialId, lowered });
      } catch (cause) {
        throw new EngineMaterialBindingsError(CODE.MATERIAL, 'Actual material reconstruction/binding/lowering refused', cause);
      }
    }
    let scene: PreparedEngineScene;
    try { scene = prepareEngineScene(sceneInput); }
    catch (cause) { throw new EngineMaterialBindingsError(CODE.SCENE, 'Complete original scene admission refused', cause); }
    check(sceneId === scene.scene.id, CODE.REFERENCE, 'Companion sceneId must match original scene identity');
    const materialIds = new Set(scene.scene.materials.map(material => material.id)), used = new Set<string>();
    for (const entry of bindings) {
      check(materialIds.has(entry.materialId) && !used.has(entry.materialId),
        CODE.REFERENCE, 'Bindings require unique existing material IDs');
      used.add(entry.materialId);
    }
    const materialBindings: PreparedCatalog<M, F, B, L>['materialBindings'] = { format: profile.format,
      version: 0, sceneId, bindings };
    freezeGpuData(materialBindings); freezeGpuData(resolvedBindings); freezeGpuData(loweredBindings);
    return Object.freeze({ scene, materialBindings, resolvedBindings, loweredBindings });
  } catch (cause) {
    if (cause instanceof EngineMaterialBindingsError) throw cause;
    throw new EngineMaterialBindingsError(CODE.INPUT, 'Own material data reflection refused', cause);
  }
}
