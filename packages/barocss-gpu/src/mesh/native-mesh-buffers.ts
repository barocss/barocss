import { ownRecord, freezeGpuData } from './gpu-data.js';
import { validateMeshGeometry } from './mesh-packet.js';
import type { CoplanarBooleanBufferOptions } from '../boolean/coplanar-boolean-buffers.js';

export function requireValue(condition: unknown, message: string): asserts condition {
  if (!condition) throw new RangeError('Boolean buffers: ' + message);
}
/** Match the producer's bounded own-data envelope before reading authored fields. */
export function snapshotNativeMesh(input: unknown): unknown {
  let remaining = 1048576;
  const ancestors = new Set<object>();
  function copy(value: unknown, depth: number): unknown {
    requireValue(--remaining >= 0 && depth <= 40, 'own-value/depth budget exceeded');
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'number') { requireValue(Number.isFinite(value), 'finite numbers required'); return value; }
    if (typeof value === 'string') { requireValue(value.length <= 262144, 'string budget exceeded'); return value; }
    requireValue(value !== null && typeof value === 'object', 'plain own data required');
    requireValue(!ancestors.has(value), 'ancestor cycles refused');
    const array = Array.isArray(value), prototype = Object.getPrototypeOf(value);
    requireValue(array ? prototype === Array.prototype : prototype === Object.prototype || prototype === null, 'foreign prototype refused');
    const keys = Reflect.ownKeys(value);
    requireValue(keys.length <= (array ? 8193 : 64), 'field/array budget exceeded');
    const descriptors = Object.getOwnPropertyDescriptors(value) as Record<string, PropertyDescriptor>;
    requireValue(keys.every(key => typeof key === 'string' && 'value' in descriptors[key] &&
      (array && key === 'length' || descriptors[key].enumerable)), 'accessors/symbols/hidden fields refused');
    ancestors.add(value);
    try {
      if (array) {
        const length = descriptors.length.value as number;
        requireValue(Number.isInteger(length) && length >= 0 && length <= 8192 && keys.length === length + 1, 'bounded dense array required');
        const result: unknown[] = [];
        for (let i = 0; i < length; i++) {
          requireValue(Object.hasOwn(descriptors, String(i)), 'sparse/extra array fields refused');
          result.push(copy(descriptors[String(i)].value, depth + 1));
        }
        return result;
      }
      return Object.fromEntries((keys as string[]).map(key => [key, copy(descriptors[key].value, depth + 1)]));
    } finally { ancestors.delete(value); }
  }
  return copy(input, 0);
}
export function nativeMeshBufferOptions(input: unknown): CoplanarBooleanBufferOptions {
  let data: Record<string, unknown>;
  try { data = ownRecord(snapshotNativeMesh(input), ['mmToSceneUnit', 'translate']); }
  catch (cause) { throw new RangeError('Boolean buffers: invalid own options', { cause }); }
  requireValue(typeof data.mmToSceneUnit === 'number' && Number.isFinite(data.mmToSceneUnit) && data.mmToSceneUnit > 0,
    'mmToSceneUnit must be finite and positive');
  requireValue(Array.isArray(data.translate) && data.translate.length === 3 &&
    data.translate.every(n => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 1000), 'translate requires three finite values within ±1000');
  return freezeGpuData({ mmToSceneUnit: data.mmToSceneUnit, translate: data.translate as [number, number, number] });
}

export type NativeBufferBounds = { min: [number, number, number]; max: [number, number, number] } | null;
export function nativeXYZBuffers(values: number[], settings: CoplanarBooleanBufferOptions): Float32Array {
  const positions = new Float32Array(values.length);
  for (let i = 0; i < positions.length; i++) {
    const scaled = values[i] * settings.mmToSceneUnit;
    requireValue(Number.isFinite(scaled) && (values[i] === 0 || scaled !== 0), 'unsafe scale overflow/underflow');
    const converted = scaled + settings.translate[i % 3];
    requireValue(Number.isFinite(converted) && Math.abs(converted) <= 1000, 'position exceeds finite scene bounds');
    positions[i] = converted;
    requireValue(Number.isFinite(positions[i]) && (converted === 0 || positions[i] !== 0), 'unsafe Float32 conversion');
  }
  return positions;
}
export function nativeBufferBounds(positions: Float32Array): NativeBufferBounds {
  if (!positions.length) return null;
  const min: [number, number, number] = [Infinity, Infinity, Infinity], max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i++) { const axis = i % 3; min[axis] = Math.min(min[axis], positions[i]); max[axis] = Math.max(max[axis], positions[i]); }
  return freezeGpuData({ min, max });
}
export function nativeMeshGeometryBuffers(mesh: {positionsMM: number[]; normals: number[]; indices: number[]}, settings: CoplanarBooleanBufferOptions) {
  const positions = nativeXYZBuffers(mesh.positionsMM, settings);
  const normals = new Float32Array(mesh.normals), indices = new Uint16Array(mesh.indices);
  validateMeshGeometry(positions, normals, indices, 'Boolean display');
  return { positions, normals, indices, bounds: nativeBufferBounds(positions) };
}
export function requireDistinctBufferPoints(positions: Float32Array, a: number, b: number): void {
  requireValue([0, 1, 2].some(axis => positions[a * 3 + axis] !== positions[b * 3 + axis]), 'Float32 boundary collapsed');
}
