import { validateCoplanarFaceBooleanMesh } from '@barocss/cad';
import type { CoplanarFaceBooleanMeshResult } from '@barocss/cad';
import { ownRecord, freezeGpuData } from './gpu-data.js';
import { validateMeshGeometry } from './mesh-packet.js';

export interface CoplanarBooleanBufferOptions {
  mmToSceneUnit: number;
  translate: [number, number, number];
}
/** CPU preparation only. Original native data and mutable display buffers have separate ownership. */
export interface PreparedCoplanarBooleanBuffers {
  schema: 'barocss-gpu-coplanar-boolean-buffers';
  version: 0;
  coordinateSystem: 'right-handed-authored-xyz';
  native: CoplanarFaceBooleanMeshResult;
  options: CoplanarBooleanBufferOptions;
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint16Array;
  boundaryIndices: Uint16Array;
  bounds: { min: [number, number, number]; max: [number, number, number] } | null;
}
function requireValue(condition: unknown, message: string): asserts condition {
  if (!condition) throw new RangeError('Boolean buffers: ' + message);
}
/** Match the producer's bounded own-data envelope before reading authored fields. */
function snapshot(input: unknown): unknown {
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
function options(input: unknown): CoplanarBooleanBufferOptions {
  let data: Record<string, unknown>;
  try { data = ownRecord(snapshot(input), ['mmToSceneUnit', 'translate']); }
  catch (cause) { throw new RangeError('Boolean buffers: invalid own options', { cause }); }
  requireValue(typeof data.mmToSceneUnit === 'number' && Number.isFinite(data.mmToSceneUnit) && data.mmToSceneUnit > 0,
    'mmToSceneUnit must be finite and positive');
  requireValue(Array.isArray(data.translate) && data.translate.length === 3 &&
    data.translate.every(n => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 1000), 'translate requires three finite values within ±1000');
  return freezeGpuData({ mmToSceneUnit: data.mmToSceneUnit, translate: data.translate as [number, number, number] });
}
/** Validate the complete native region/mesh, then convert raw XYZ once; never fabricate packet0/Surface identity. */
export function prepareCoplanarBooleanBuffers(input: unknown, optionsInput: CoplanarBooleanBufferOptions): PreparedCoplanarBooleanBuffers {
  const settings = options(optionsInput);
  const native = snapshot(input) as CoplanarFaceBooleanMeshResult;
  try { validateCoplanarFaceBooleanMesh(native); }
  catch (cause) { throw new RangeError('Boolean buffers: complete native mesh validation refused', { cause }); }
  const mesh = native.mesh;
  requireValue(mesh.positionsMM.length <= 64 * 3 && mesh.indices.length <= 80 * 3 && native.boundaryPaths.length <= 64,
    'native mesh exceeds GPU CPU profile capacity');
  // Native validation precedes all GPU typed-array allocation.
  const positions = new Float32Array(mesh.positionsMM.length);
  for (let i = 0; i < positions.length; i++) {
    const scaled = mesh.positionsMM[i] * settings.mmToSceneUnit;
    requireValue(Number.isFinite(scaled) && (mesh.positionsMM[i] === 0 || scaled !== 0), 'unsafe scale overflow/underflow');
    const converted = scaled + settings.translate[i % 3];
    requireValue(Number.isFinite(converted) && Math.abs(converted) <= 1000, 'position exceeds finite scene bounds');
    positions[i] = converted;
    requireValue(Number.isFinite(positions[i]) && (converted === 0 || positions[i] !== 0), 'unsafe Float32 conversion');
  }
  const normals = new Float32Array(mesh.normals), indices = new Uint16Array(mesh.indices);
  validateMeshGeometry(positions, normals, indices, 'Boolean display');
  const boundaryIndices = new Uint16Array(native.boundaryPaths.length * 2);
  for (let i = 0; i < native.boundaryPaths.length; i++) {
    const [a, b] = native.boundaryPaths[i].vertexIndices;
    requireValue([0, 1, 2].some(axis => positions[a * 3 + axis] !== positions[b * 3 + axis]), 'Float32 boundary collapsed');
    boundaryIndices.set([a, b], i * 2);
  }
  let bounds: PreparedCoplanarBooleanBuffers['bounds'] = null;
  if (positions.length) {
    const min: [number, number, number] = [Infinity, Infinity, Infinity], max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < positions.length; i++) { const axis = i % 3; min[axis] = Math.min(min[axis], positions[i]); max[axis] = Math.max(max[axis], positions[i]); }
    bounds = freezeGpuData({ min, max });
  }
  return Object.freeze({ schema: 'barocss-gpu-coplanar-boolean-buffers', version: 0,
    coordinateSystem: 'right-handed-authored-xyz', native: freezeGpuData(native), options: settings,
    positions, normals, indices, boundaryIndices, bounds });
}
