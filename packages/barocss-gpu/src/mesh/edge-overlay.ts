import { validatePreviewPacket } from './mesh-packet.js';
import type { PreviewPacket, MeshOptions } from './mesh-packet.js';

export interface MeshEdgeOverlay {
  version: 0;
  packet: PreviewPacket;
  paths: { id: string; points: [number, number, number][] }[];
  color: [number, number, number];
}
export interface PreparedMeshEdges {
  overlay: MeshEdgeOverlay;
  positions: Float32Array;
  ranges: { start: number; count: number }[];
}
function requireValue(condition: unknown, message: string): asserts condition {
  if (!condition) throw new RangeError(message);
}
function record(input: unknown, fields: string[], label: string): Record<string, unknown> {
  requireValue(input !== null && typeof input === 'object' && Object.getPrototypeOf(input) === Object.prototype, label + ' must be ordinary JSON data');
  const keys = Reflect.ownKeys(input);
  requireValue(keys.length === fields.length && keys.every(key => typeof key === 'string' && fields.includes(key)), label + ' has missing or extra fields');
  const result: Record<string, unknown> = {};
  for (const key of fields) {
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    requireValue(descriptor && 'value' in descriptor && descriptor.enumerable, label + ' must not contain accessors');
    result[key] = descriptor.value;
  }
  return result;
}
function dense(input: unknown, min: number, max: number, label: string): unknown[] {
  requireValue(Array.isArray(input) && Object.getPrototypeOf(input) === Array.prototype, label + ' must be an ordinary array');
  requireValue(input.length >= min && input.length <= max, label + ' count exceeds limits');
  requireValue(Reflect.ownKeys(input).length === input.length + 1, label + ' must be dense without extra fields');
  const result: unknown[] = [];
  for (let i = 0; i < input.length; i++) {
    const descriptor = Object.getOwnPropertyDescriptor(input, String(i));
    requireValue(descriptor && 'value' in descriptor && descriptor.enumerable, label + ' must be own data');
    result.push(descriptor.value);
  }
  return result;
}
function triple(input: unknown, limit: number, nonnegative: boolean, label: string): [number, number, number] {
  const values = dense(input, 3, 3, label);
  requireValue(values.every(value => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= limit && (!nonnegative || value >= 0)), label + ' has invalid coordinates');
  return values as [number, number, number];
}
/** Both packets have already passed the original bounded packet validator. */
export function sameMeshPacket(a: PreviewPacket, b: PreviewPacket): boolean {
  const equal = (left: unknown, right: unknown): boolean => {
    if (typeof left !== 'object' || left === null || typeof right !== 'object' || right === null) return Object.is(left, right);
    const lk = Object.keys(left), rk = Object.keys(right);
    if (lk.length !== rk.length || Array.isArray(left) !== Array.isArray(right)) return false;
    return lk.every(key => Object.hasOwn(right, key) && equal((left as Record<string, unknown>)[key], (right as Record<string, unknown>)[key]));
  };
  return equal(a, b);
}
/** Display paths are derived data, not a CAD topology or authored compiler input. */
export function prepareEdgeOverlay(input: unknown, packet: PreviewPacket, options: MeshOptions): PreparedMeshEdges | null {
  if (input === null) return null;
  const value = record(input, ['version', 'packet', 'paths', 'color'], 'Edge overlay');
  requireValue(value.version === 0, 'Unsupported edge overlay version');
  const boundPacket = validatePreviewPacket(value.packet);
  requireValue(sameMeshPacket(boundPacket, packet), 'Edge overlay packet does not match the complete accepted mesh');
  const paths = dense(value.paths, 1, 64, 'Edge paths'), ids = new Set<string>();
  const owned: MeshEdgeOverlay['paths'] = [], ranges: PreparedMeshEdges['ranges'] = [];
  let pointCount = 0;
  for (const inputPath of paths) {
    const path = record(inputPath, ['id', 'points'], 'Edge path');
    requireValue(typeof path.id === 'string' && path.id.length >= 1 && path.id.length <= 128 && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(path.id) && !ids.has(path.id), 'Edge path IDs must be unique bounded ASCII identifiers');
    ids.add(path.id);
    const points = dense(path.points, 2, 64, 'Edge points');
    requireValue(pointCount + points.length <= 4096, 'Total edge point count exceeds limits');
    const copied = points.map(point => triple(point, 1e6, false, 'Edge point'));
    ranges.push({ start: pointCount, count: copied.length }); pointCount += copied.length;
    owned.push({ id: path.id, points: copied });
  }
  const color = triple(value.color, 1, true, 'Edge color');
  const positions = new Float32Array(pointCount * 3);
  let offset = 0;
  for (const path of owned) {
    let previous: [number, number, number] | undefined;
    let previousFloat: number[] | undefined;
    for (const point of path.points) {
      requireValue(!previous || point.some((value, axis) => value !== previous![axis]), 'Consecutive native edge points coincide');
      const converted = point.map((value, axis) => value * options.mmToSceneUnit + options.translate[axis]);
      requireValue(converted.every(value => Number.isFinite(value) && Math.abs(value) <= 1000), 'Converted edge points exceed scene limits');
      const floats = converted.map(Math.fround);
      requireValue(!previousFloat || floats.some((value, axis) => value !== previousFloat![axis]), 'Consecutive Float32 edge points collapse');
      positions.set(floats, offset); offset += 3; previous = point; previousFloat = floats;
    }
  }
  return { overlay: { version: 0, packet: boundPacket, paths: owned, color }, positions, ranges };
}
