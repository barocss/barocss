import { freezeGpuData } from './gpu-data.js';
import { EngineTextureBindingsError, prepareEngineTextureBindings } from './engine-texture-bindings.js';
import type { EngineTextureBindingsV0, PreparedEngineTexture, PreparedEngineTextureBindings } from './engine-texture-bindings.js';
import type { PreparedEngineScene } from './engine-scene.js';
import { MeshMaterialError, validateEngineUVTextureMaterialIR, lowerEngineUVTextureMaterial } from './mesh-material.js';
import type { EngineUVTextureMaterialIR, LoweredEngineUVTextureMaterial } from './mesh-material.js';

export const EngineUVTextureMaterialBindingsDiagnosticCode = Object.freeze({
  INPUT: 'INPUT', VERSION: 'VERSION', BUDGET: 'BUDGET', REFERENCE: 'REFERENCE',
  UNIFORM: 'UNIFORM', MATERIAL: 'MATERIAL', TEXTURE: 'TEXTURE', SCENE: 'SCENE',
} as const);
export type EngineUVTextureMaterialBindingsDiagnosticCode =
  typeof EngineUVTextureMaterialBindingsDiagnosticCode[keyof typeof EngineUVTextureMaterialBindingsDiagnosticCode];

export class EngineUVTextureMaterialBindingsError extends Error {
  constructor(readonly code: EngineUVTextureMaterialBindingsDiagnosticCode, detail: string, ...cause: [] | [unknown]) {
    super(('Engine UV texture material bindings: ' + detail).slice(0, 1024),
      cause.length ? { cause: cause[0] } : undefined);
    this.name = 'EngineUVTextureMaterialBindingsError';
  }
}
export interface EngineUVTextureMaterialBindingV0 {
  materialId: string; material: EngineUVTextureMaterialIR; uniforms: Record<string, number>;
}
export interface EngineUVTextureMaterialBindingsV0 {
  format: 'barocss-gpu-engine-uv-texture-material-bindings'; version: 0; sceneId: string;
  bindings: EngineUVTextureMaterialBindingV0[];
}
export interface EngineUVTextureMaterialSamplerBinding {
  materialId: string; name: string; textureId: string; glslName: 'mat_s_0';
}
export interface PreparedEngineUVTextureMaterialBindings {
  readonly scene: PreparedEngineScene;
  readonly textureBindings: EngineTextureBindingsV0;
  readonly materialBindings: EngineUVTextureMaterialBindingsV0;
  readonly resolvedBindings: { materialId: string; binding: { material: EngineUVTextureMaterialIR; uniforms: Record<string, number> } }[];
  readonly loweredBindings: { materialId: string; lowered: LoweredEngineUVTextureMaterial }[];
  readonly samplerBindings: EngineUVTextureMaterialSamplerBinding[];
  readonly textures: PreparedEngineTexture[];
  readonly pixelBytes: number;
}

const CODE = EngineUVTextureMaterialBindingsDiagnosticCode;
const FORMAT = 'barocss-gpu-engine-uv-texture-material-bindings';
const IR_FIELDS = ['format', 'version', 'profile', 'source', 'shaderId', 'uniforms', 'samplers', 'expression'];
function check(value: unknown, code: EngineUVTextureMaterialBindingsDiagnosticCode, detail: string): asserts value {
  if (!value) throw new EngineUVTextureMaterialBindingsError(code, detail);
}
// Only raw reflection is caught. Local refusals retain their own classification.
function reflect<T>(operation: () => T): T {
  try { return operation(); }
  catch (cause) { throw new EngineUVTextureMaterialBindingsError(CODE.INPUT, 'Own data reflection refused', cause); }
}
function prototype(value: unknown): void {
  check(value !== null && typeof value === 'object', CODE.INPUT, 'A plain own record is required');
  check(reflect(() => Object.getPrototypeOf(value)) === Object.prototype,
    CODE.INPUT, 'A plain own record is required');
}
function keys(value: object): string[] {
  const names = reflect(() => Reflect.ownKeys(value));
  check(names.every(name => typeof name === 'string'), CODE.INPUT, 'Symbol fields are unsupported');
  return names as string[];
}
function data(value: object, name: string): unknown {
  const descriptor = reflect(() => Object.getOwnPropertyDescriptor(value, name));
  check(descriptor && 'value' in descriptor && descriptor.enumerable,
    CODE.INPUT, 'Fields require own enumerable data');
  return descriptor.value;
}
function record(value: unknown, fields: string[]): Record<string, unknown> {
  prototype(value);
  const names = keys(value as object);
  check(names.length === fields.length && names.every(name => fields.includes(name)),
    CODE.INPUT, 'Record fields must exactly match the contract');
  return Object.fromEntries(names.map(name => [name, data(value as object, name)]));
}
function count(value: unknown, maximum: number): number {
  check(reflect(() => Array.isArray(value)), CODE.INPUT, 'A plain own array is required');
  check(reflect(() => Object.getPrototypeOf(value)) === Array.prototype, CODE.INPUT, 'A plain own array is required');
  const descriptor = reflect(() => Object.getOwnPropertyDescriptor(value, 'length'));
  check(descriptor && 'value' in descriptor && Number.isInteger(descriptor.value) && descriptor.value >= 0,
    CODE.INPUT, 'An own integer array length is required');
  check(descriptor.value <= maximum, CODE.BUDGET, 'Array cardinality exceeds its limit');
  return descriptor.value as number;
}
function dense(value: unknown, length: number): unknown[] {
  const names = keys(value as object);
  check(names.length === length + 1 && names.includes('length') && names.every(name => name === 'length'
    || /^(0|[1-9]\d*)$/.test(name) && Number(name) < length), CODE.INPUT, 'Arrays must be dense without extra fields');
  return Array.from({ length }, (_, index) => data(value as object, String(index)));
}
function identifier(value: unknown): string {
  check(typeof value === 'string' && /^[A-Za-z_][A-Za-z0-9_.:-]{0,63}$/.test(value),
    CODE.INPUT, 'IDs require ASCII identifiers of 1..64 characters');
  return value;
}
function uniformNames(value: unknown): string[] {
  prototype(value);
  const names = keys(value as object);
  check(names.length <= 16, CODE.BUDGET, 'Supplied uniforms exceed 16 entries');
  return names;
}
function snapshot(input: unknown): EngineUVTextureMaterialBindingV0 {
  let remaining = 8192;
  const active = new WeakSet<object>();
  function copy(value: unknown, depth: number): unknown {
    check(--remaining >= 0 && depth <= 24, CODE.BUDGET, 'Entry snapshot exceeds its value or depth limit');
    if (typeof value === 'number') {
      check(Number.isFinite(value), CODE.INPUT, 'Own numeric data must be finite');
      return value;
    }
    if (typeof value === 'string') {
      check(value.length <= 65536, CODE.BUDGET, 'Own text exceeds 64 KiB units');
      return value;
    }
    if (typeof value === 'boolean' || value === null) return value;
    check(value && typeof value === 'object' && !active.has(value), CODE.INPUT, 'Own data must be acyclic');
    const array = reflect(() => Array.isArray(value));
    let children: unknown[], names: string[] = [];
    if (array) children = dense(value, count(value, 256));
    else {
      prototype(value);
      names = keys(value);
      check(names.length <= 16, CODE.BUDGET, 'Own record exceeds 16 fields');
      children = names.map(name => data(value, name));
    }
    active.add(value);
    const result = array ? children.map(child => copy(child, depth + 1))
      : Object.fromEntries(names.map((name, index) => [name, copy(children[index], depth + 1)]));
    active.delete(value);
    return result;
  }
  return copy(input, 0) as EngineUVTextureMaterialBindingV0;
}
function textBudget(value: unknown, maximum: number, label: string): void {
  const text = JSON.stringify(value);
  check(text.length <= maximum && new TextEncoder().encode(text).length <= maximum,
    CODE.BUDGET, label + ' exceeds its JSON text limit');
}
function materialCall<T>(operation: () => T): T {
  try { return operation(); }
  catch (cause) {
    throw new EngineUVTextureMaterialBindingsError(cause instanceof MeshMaterialError && cause.code === 'BUDGET'
      ? CODE.BUDGET : CODE.MATERIAL, 'Actual material reconstruction or lowering refused', cause);
  }
}

/** Complete CPU source/resource join. No image decoding, graphics, cache or live handles. */
export function prepareEngineUVTextureMaterialBindings(
  sceneInput: unknown, textureInput: unknown, materialInput: unknown,
): PreparedEngineUVTextureMaterialBindings {
  const root = record(materialInput, ['format', 'version', 'sceneId', 'bindings']);
  check(root.format === FORMAT && root.version === 0, CODE.VERSION, 'Only authored EngineUV texture bindings version 0 is supported');
  const sceneId = identifier(root.sceneId);
  const entries = dense(root.bindings, count(root.bindings, 8));
  let sourceUnits = 0, sourceBytes = 0, declared = 0, supplied = 0;
  // Admit every header/cardinality before recursively copying an entry or calling providers.
  const headers = entries.map(input => {
    const entry = record(input, ['materialId', 'material', 'uniforms']);
    const materialId = identifier(entry.materialId);
    const material = record(entry.material, IR_FIELDS);
    check(typeof material.source === 'string', CODE.INPUT, 'Complete original material source is required');
    sourceUnits += material.source.length;
    check(sourceUnits <= 65536, CODE.BUDGET, 'Aggregate source exceeds 64 KiB units');
    declared += count(material.uniforms, 16);
    supplied += uniformNames(entry.uniforms).length;
    check(declared <= 128 && supplied <= 128, CODE.BUDGET, 'Aggregate uniforms exceed 128 entries');
    return { materialId, material, uniforms: entry.uniforms };
  });
  for (const header of headers) {
    sourceBytes += new TextEncoder().encode(header.material.source as string).length;
    check(sourceBytes <= 65536, CODE.BUDGET, 'Aggregate source exceeds 64 KiB UTF8 bytes');
  }
  for (const header of headers) {
    for (const name of uniformNames(header.uniforms)) {
      const value = data(header.uniforms as object, name);
      check(name !== '__proto__' && /^[A-Za-z_][A-Za-z0-9_]{0,31}$/.test(name)
        && typeof value === 'number' && Number.isFinite(value), CODE.UNIFORM, 'Supplied uniforms require safe finite scalar entries');
    }
  }
  const bindings = headers.map(header => snapshot(header));
  // Recheck the accepted snapshot: stateful proxies can change descriptors between reads.
  for (const entry of bindings) {
    for (const [name, value] of Object.entries(entry.uniforms)) {
      check(name !== '__proto__' && /^[A-Za-z_][A-Za-z0-9_]{0,31}$/.test(name)
        && typeof value === 'number' && Number.isFinite(value), CODE.UNIFORM, 'Snapshotted uniforms require safe finite scalar entries');
    }
  }
  const materialBindings: EngineUVTextureMaterialBindingsV0 = { format: FORMAT, version: 0, sceneId, bindings };
  textBudget(materialBindings, 2097152, 'Original material companion');
  const resolvedBindings: PreparedEngineUVTextureMaterialBindings['resolvedBindings'] = [];
  const loweredBindings: PreparedEngineUVTextureMaterialBindings['loweredBindings'] = [];
  for (const entry of bindings) {
    const material = materialCall(() => validateEngineUVTextureMaterialIR(entry.material));
    check(material.uniforms.every(uniform => uniform.name !== '__proto__'), CODE.UNIFORM, 'Declared __proto__ uniforms are unsupported');
    const allowed = new Set(material.uniforms.map(uniform => uniform.name));
    check(Object.keys(entry.uniforms).every(name => allowed.has(name)), CODE.UNIFORM, 'Supplied uniforms must be declared');
    const uniforms = Object.fromEntries(material.uniforms.map(uniform => {
      const value = Object.hasOwn(entry.uniforms, uniform.name) ? entry.uniforms[uniform.name] : uniform.default;
      check(typeof value === 'number' && Number.isFinite(value) && value >= uniform.min && value <= uniform.max,
        CODE.UNIFORM, 'Uniform value exceeds its finite declared range');
      return [uniform.name, value === 0 ? 0 : value];
    }));
    const lowered = materialCall(() => lowerEngineUVTextureMaterial(material));
    resolvedBindings.push({ materialId: entry.materialId, binding: { material, uniforms } });
    loweredBindings.push({ materialId: entry.materialId, lowered });
  }
  textBudget(loweredBindings, 1048576, 'Lowered material wrappers');
  let provider: PreparedEngineTextureBindings;
  try { provider = prepareEngineTextureBindings(sceneInput, textureInput); }
  catch (cause) {
    const code = cause instanceof EngineTextureBindingsError
      && (cause.code === 'SCENE' || cause.code === 'BUDGET' || cause.code === 'REFERENCE') ? cause.code : CODE.TEXTURE;
    throw new EngineUVTextureMaterialBindingsError(code, 'Actual scene or texture catalog admission refused', cause);
  }
  // The admitted texture provider has already allocated independent CPU upload bytes.
  check(sceneId === provider.scene.scene.id && sceneId === provider.textureBindings.sceneId,
    CODE.REFERENCE, 'Companions must identify the admitted original scene');
  const materialIds = new Set(provider.scene.scene.materials.map(material => material.id));
  const textureByMaterial = new Map(provider.textureBindings.bindings.map(binding => [binding.materialId, binding.textureId]));
  const seen = new Set<string>();
  const samplerBindings: EngineUVTextureMaterialSamplerBinding[] = [];
  for (const resolved of resolvedBindings) {
    check(materialIds.has(resolved.materialId) && !seen.has(resolved.materialId), CODE.REFERENCE, 'Authored entries require unique existing material IDs');
    seen.add(resolved.materialId);
    const textureId = textureByMaterial.get(resolved.materialId);
    check(textureId !== undefined, CODE.REFERENCE, 'Every authored material requires an actual texture binding, even with an unused alias');
    samplerBindings.push({ materialId: resolved.materialId, name: resolved.binding.material.samplers[0].name,
      textureId, glslName: 'mat_s_0' });
  }
  freezeGpuData(materialBindings); freezeGpuData(resolvedBindings); freezeGpuData(loweredBindings); freezeGpuData(samplerBindings);
  return Object.freeze({ scene: provider.scene, textureBindings: provider.textureBindings, materialBindings,
    resolvedBindings, loweredBindings, samplerBindings, textures: provider.textures, pixelBytes: provider.pixelBytes });
}
