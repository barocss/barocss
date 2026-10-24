import { BarocssError } from '../core/barocss-error.js';
import { ownRecord } from '../mesh/gpu-data.js';
import { prepareEngineScene } from './engine-scene.js';
import type { PreparedEngineScene } from './engine-scene.js';

export const EngineTextureBindingsDiagnosticCode = Object.freeze({
  INPUT: 'INPUT', VERSION: 'VERSION', BUDGET: 'BUDGET',
  REFERENCE: 'REFERENCE', TEXTURE: 'TEXTURE', SCENE: 'SCENE',
} as const);
export type EngineTextureBindingsDiagnosticCode =
  typeof EngineTextureBindingsDiagnosticCode[keyof typeof EngineTextureBindingsDiagnosticCode];

export class EngineTextureBindingsError extends BarocssError {
  readonly code: EngineTextureBindingsDiagnosticCode;
  constructor(code: EngineTextureBindingsDiagnosticCode, detail: string, cause?: unknown) {
    super(code, ('Engine texture bindings: ' + detail).slice(0, 1024),
      cause === undefined ? undefined : { cause });
    this.name = 'EngineTextureBindingsError'; this.code = code;
  }
}

/** Original opaque bytes. The first row is v=0; UVs remain dimensionless. */
export interface EngineTextureV0 {
  id: string; width: number; height: number; format: 'rgba8'; colorSpace: 'srgb';
  rowOrigin: 'bottom-left'; filter: 'nearest'; wrapS: 'clamp-to-edge'; wrapT: 'clamp-to-edge';
  pixels: number[];
}
export interface EngineTextureBindingV0 { materialId: string; textureId: string }
export interface EngineTextureBindingsV0 {
  format: 'barocss-gpu-engine-texture-bindings'; version: 0; sceneId: string;
  textures: EngineTextureV0[]; bindings: EngineTextureBindingV0[];
}
export interface PreparedEngineTexture {
  readonly texture: EngineTextureV0;
  /** Separately owned mutable upload data; never original source authority. */
  readonly pixels: Uint8Array;
}
export interface PreparedEngineTextureBindings {
  readonly scene: PreparedEngineScene;
  readonly textureBindings: EngineTextureBindingsV0;
  readonly textures: PreparedEngineTexture[];
  readonly pixelBytes: number;
}

const CODE = EngineTextureBindingsDiagnosticCode;
const MAX_PIXEL_SLOTS = 4194304;
const ROOT = ['format', 'version', 'sceneId', 'textures', 'bindings'];
const TEXTURE = ['id', 'width', 'height', 'format', 'colorSpace', 'rowOrigin',
  'filter', 'wrapS', 'wrapT', 'pixels'];
function check(value: unknown, code: EngineTextureBindingsDiagnosticCode, detail: string): asserts value {
  if (!value) throw new EngineTextureBindingsError(code, detail);
}
function record(input: unknown, fields: string[], label: string): Record<string, unknown> {
  try { return ownRecord(input, fields, fields, label); }
  catch (cause) { throw new EngineTextureBindingsError(CODE.INPUT, label + ' requires exact own plain data', cause); }
}
function identifier(value: unknown, label: string): string {
  check(typeof value === 'string' && /^[A-Za-z_][A-Za-z0-9_.:-]{0,63}$/.test(value),
    CODE.INPUT, label + ' requires an ASCII identifier of1..64 characters');
  return value;
}
function length(input: unknown, maximum: number, label: string): number {
  check(Array.isArray(input) && Object.getPrototypeOf(input) === Array.prototype,
    CODE.INPUT, label + ' requires a plain array');
  const descriptor = Object.getOwnPropertyDescriptor(input, 'length');
  check(descriptor && 'value' in descriptor && Number.isInteger(descriptor.value)
    && descriptor.value >= 0, CODE.INPUT, label + ' requires an own array length');
  check(descriptor.value <= maximum, CODE.BUDGET, label + ' exceeds its cardinality limit');
  return descriptor.value;
}
function dense(input: unknown, count: number, label: string): void {
  const keys = Reflect.ownKeys(input as object);
  check(keys.length === count + 1, CODE.INPUT, label + ' must be dense without extra or hidden fields');
  for (const key of keys) if (key !== 'length') {
    check(typeof key === 'string' && /^(0|[1-9]\d*)$/.test(key) && Number(key) < count,
      CODE.INPUT, label + ' has unsupported array keys');
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    check(descriptor && 'value' in descriptor && descriptor.enumerable,
      CODE.INPUT, label + ' elements must be own enumerable data');
  }
}
function element(input: unknown, index: number): unknown {
  return Object.getOwnPropertyDescriptor(input, String(index))!.value;
}
interface TexturePlan { data: Record<string, unknown>; count: number }

/** Complete original scene/texture admission. No DOM, GL, image decoder or renderer. */
export function prepareEngineTextureBindings(sceneInput: unknown, bindingsInput: unknown): PreparedEngineTextureBindings {
  const root = record(bindingsInput, ROOT, 'texture bindings');
  check(root.format === 'barocss-gpu-engine-texture-bindings' && root.version === 0,
    CODE.VERSION, 'Only engine texture bindings0 is supported');
  const sceneId = identifier(root.sceneId, 'sceneId');
  const textureCount = length(root.textures, 8, 'textures');
  const bindingCount = length(root.bindings, 32, 'bindings');
  dense(root.textures, textureCount, 'textures'); dense(root.bindings, bindingCount, 'bindings');

  // Every dimension and aggregate length is checked before any pixel copy,
  // typed upload allocation, pixel key enumeration or scene provider call.
  let pixelBytes = 0;
  const plans: TexturePlan[] = [];
  for (let i = 0; i < textureCount; i++) {
    const data = record(element(root.textures, i), TEXTURE, 'texture');
    check(typeof data.width === 'number' && Number.isInteger(data.width) && data.width >= 1 && data.width <= 1024
      && typeof data.height === 'number' && Number.isInteger(data.height) && data.height >= 1 && data.height <= 1024,
    CODE.TEXTURE, 'Texture dimensions must be integers1..1024');
    const count = length(data.pixels, MAX_PIXEL_SLOTS, 'pixels');
    check(count === data.width * data.height * 4, CODE.INPUT, 'Pixels must exactly match width*height*4');
    pixelBytes += count;
    check(pixelBytes <= MAX_PIXEL_SLOTS, CODE.BUDGET, 'Catalog exceeds1048576 texels/4194304 pixel slots');
    plans.push({ data, count });
  }
  let scene: PreparedEngineScene;
  try { scene = prepareEngineScene(sceneInput); }
  catch (cause) { throw new EngineTextureBindingsError(CODE.SCENE, 'Complete original scene admission refused', cause); }

  const validated: { plan: TexturePlan; id: string }[] = [];
  for (const { data, count } of plans) {
    check(data.format === 'rgba8' && data.colorSpace === 'srgb' && data.rowOrigin === 'bottom-left'
      && data.filter === 'nearest' && data.wrapS === 'clamp-to-edge' && data.wrapT === 'clamp-to-edge',
    CODE.VERSION, 'Only opaque rgba8/srgb/bottom-left/nearest/clamp-to-edge texture0 is supported');
    const id = identifier(data.id, 'texture.id');
    dense(data.pixels, count, 'pixels');
    // Validate the entire catalog (including unused textures) before upload copies.
    for (let i = 0; i < count; i++) {
      const value = element(data.pixels, i);
      check(typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 255
        && (i % 4 !== 3 || value === 255), CODE.TEXTURE, 'Pixels require integer bytes0..255 and alpha255');
    }
    validated.push({ plan: { data, count }, id });
  }
  check(sceneId === scene.scene.id, CODE.REFERENCE, 'Companion sceneId must match original scene identity');
  const textureIds = new Set<string>();
  for (const { id } of validated) {
    check(!textureIds.has(id), CODE.REFERENCE, 'Duplicate texture identity'); textureIds.add(id);
  }
  const materialIds = new Set(scene.scene.materials.map(m => m.id)), usedMaterials = new Set<string>();
  const bindings: EngineTextureBindingV0[] = [];
  for (let i = 0; i < bindingCount; i++) {
    const data = record(element(root.bindings, i), ['materialId', 'textureId'], 'binding');
    const materialId = identifier(data.materialId, 'materialId'), textureId = identifier(data.textureId, 'textureId');
    check(materialIds.has(materialId) && textureIds.has(textureId) && !usedMaterials.has(materialId),
      CODE.REFERENCE, 'Bindings require existing texture/material IDs and unique material IDs');
    usedMaterials.add(materialId); bindings.push(Object.freeze({ materialId, textureId }));
  }
  // Copy only after all original texture values and references have passed.
  // Number sign bits remain independent of the derived Uint8 encoding.
  const textures: EngineTextureV0[] = validated.map(({ plan: { data, count }, id }) => {
    const pixels = Array.from({ length: count }, (_, i) => element(data.pixels, i) as number);
    Object.freeze(pixels);
    return Object.freeze({ id, width: data.width as number, height: data.height as number,
      format: 'rgba8', colorSpace: 'srgb', rowOrigin: 'bottom-left', filter: 'nearest',
      wrapS: 'clamp-to-edge', wrapT: 'clamp-to-edge', pixels });
  });
  Object.freeze(textures); Object.freeze(bindings);
  const textureBindings: EngineTextureBindingsV0 = Object.freeze({
    format: 'barocss-gpu-engine-texture-bindings', version: 0, sceneId, textures, bindings,
  });
  const prepared = textures.map(texture => Object.freeze({ texture, pixels: Uint8Array.from(texture.pixels) }));
  Object.freeze(prepared);
  return Object.freeze({ scene, textureBindings, textures: prepared, pixelBytes });
}
