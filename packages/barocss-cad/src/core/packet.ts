import type { Point } from '../types.js';

/** Approximate open-surface preview geometry. Coordinates stay in millimetres. */
export interface PreviewPacket {
  version: 0;
  surfaceId: string;
  revision: number;
  lengthUnit: 'mm';
  coordinateSystem: 'right-handed-z-up';
  winding: 'ccw';
  positions: number[];
  normals: number[];
  indices: number[];
  parameters: number[];
  bounds: { min: Point; max: Point };
}

function requireValue(condition: boolean, message: string): asserts condition {
  if (!condition) throw new RangeError(`Invalid preview packet: ${message}`);
}

// Read descriptors instead of invoking host getters. JavaScript cannot detect
// arbitrary Proxies without invoking their reflection traps. This boundary is
// intended for JSON data; Proxy traps remain the host's responsibility.
function field(object: object, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  requireValue(descriptor !== undefined && 'value' in descriptor && descriptor.enumerable === true,
    `${key} must be an own enumerable data property`);
  return descriptor.value;
}

function plainObject(value: unknown, keys: readonly string[], name: string): asserts value is object {
  requireValue(typeof value === 'object' && value !== null && !Array.isArray(value), `${name} must be a plain object`);
  const prototype = Object.getPrototypeOf(value);
  requireValue(prototype === Object.prototype || prototype === null, `${name} must be a plain object`);
  const actual = Reflect.ownKeys(value);
  requireValue(actual.length === keys.length && actual.every(key => typeof key === 'string' && keys.includes(key)),
    `${name} has missing or unsupported fields`);
  for (const key of keys) field(value, key);
}

// Check lengths before own-key enumeration or copied output allocation.
function arraySize(value: unknown, minimum: number, maximum: number, multiple: number, name: string): asserts value is number[] {
  requireValue(Array.isArray(value) && Object.getPrototypeOf(value) === Array.prototype, `${name} must be a plain array`);
  const length: unknown = Object.getOwnPropertyDescriptor(value, 'length')?.value;
  requireValue(typeof length === 'number' && Number.isInteger(length) && length >= minimum && length <= maximum
    && length % multiple === 0, `${name} has an invalid length`);
}

function finiteArray(array: number[], name: string): void {
  const length = Object.getOwnPropertyDescriptor(array, 'length')!.value as number;
  requireValue(Reflect.ownKeys(array).length === length + 1, `${name} must be dense without extra fields`);
  for (let index = 0; index < length; index++) {
    const value = field(array, String(index));
    requireValue(typeof value === 'number' && Number.isFinite(value), `${name} must contain finite numbers`);
  }
}

function at(array: number[], index: number): number {
  return field(array, String(index)) as number;
}

/** Reject malformed data, ambiguous normals and unsupported fields before copying. */
export function validatePreviewPacket(packet: unknown): asserts packet is PreviewPacket {
  plainObject(packet, ['version', 'surfaceId', 'revision', 'lengthUnit', 'coordinateSystem', 'winding',
    'positions', 'normals', 'indices', 'parameters', 'bounds'], 'packet');
  requireValue(field(packet, 'version') === 0, 'unsupported version');
  const id = field(packet, 'surfaceId');
  requireValue(typeof id === 'string' && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(id), 'surfaceId must be a supported ASCII identifier');
  const revision = field(packet, 'revision');
  requireValue(typeof revision === 'number' && Number.isInteger(revision) && revision >= 0 && revision <= 2147483647,
    'revision must be an integer in 0..2147483647');
  requireValue(field(packet, 'lengthUnit') === 'mm', 'lengthUnit must be mm');
  requireValue(field(packet, 'coordinateSystem') === 'right-handed-z-up', 'unsupported coordinate system');
  requireValue(field(packet, 'winding') === 'ccw', 'winding must be ccw');
  const positions = field(packet, 'positions');
  const normals = field(packet, 'normals');
  const indices = field(packet, 'indices');
  const parameters = field(packet, 'parameters');
  const bounds = field(packet, 'bounds');
  arraySize(positions, 12, 12288, 3, 'positions');
  arraySize(normals, 12, 12288, 3, 'normals');
  arraySize(indices, 6, 23814, 3, 'indices');
  arraySize(parameters, 8, 8192, 2, 'parameters');
  const vertices = positions.length / 3;
  requireValue(normals.length === positions.length && parameters.length === vertices * 2, 'vertex arrays do not match');
  plainObject(bounds, ['min', 'max'], 'bounds');
  const minimum = field(bounds, 'min');
  const maximum = field(bounds, 'max');
  arraySize(minimum, 3, 3, 3, 'bounds.min');
  arraySize(maximum, 3, 3, 3, 'bounds.max');
  finiteArray(positions, 'positions');
  finiteArray(normals, 'normals');
  finiteArray(indices, 'indices');
  finiteArray(parameters, 'parameters');
  finiteArray(minimum, 'bounds.min');
  finiteArray(maximum, 'bounds.max');
  for (let vertex = 0; vertex < vertices; vertex++) {
    for (let component = 0; component < 3; component++) {
      requireValue(Math.abs(at(positions, vertex * 3 + component)) <= 1e6, 'position exceeds the coordinate bound');
    }
    const length = Math.hypot(at(normals, vertex * 3), at(normals, vertex * 3 + 1), at(normals, vertex * 3 + 2));
    requireValue(Number.isFinite(length) && Math.abs(length - 1) <= 1e-5, 'normal must have unit length within 1e-5');
  }
  for (let component = 0; component < 3; component++) {
    let low = Infinity;
    let high = -Infinity;
    for (let vertex = 0; vertex < vertices; vertex++) {
      const value = at(positions, vertex * 3 + component);
      low = Math.min(low, value);
      high = Math.max(high, value);
    }
    requireValue(at(minimum, component) === low && at(maximum, component) === high, 'bounds must exactly match positions');
  }
  for (let index = 0; index < indices.length; index += 3) {
    const a = at(indices, index);
    const b = at(indices, index + 1);
    const c = at(indices, index + 2);
    requireValue(Number.isInteger(a) && a >= 0 && a < vertices
      && Number.isInteger(b) && b >= 0 && b < vertices
      && Number.isInteger(c) && c >= 0 && c < vertices, 'triangle index is outside the vertex range');
    requireValue(a !== b && b !== c && a !== c, 'triangle repeats a vertex index');
    const ux = at(positions, b * 3) - at(positions, a * 3);
    const uy = at(positions, b * 3 + 1) - at(positions, a * 3 + 1);
    const uz = at(positions, b * 3 + 2) - at(positions, a * 3 + 2);
    const vx = at(positions, c * 3) - at(positions, a * 3);
    const vy = at(positions, c * 3 + 1) - at(positions, a * 3 + 1);
    const vz = at(positions, c * 3 + 2) - at(positions, a * 3 + 2);
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const area = Math.hypot(nx, ny, nz);
    requireValue(Number.isFinite(area) && area > 0, 'triangle must have finite nonzero area');
    for (let corner = 0; corner < 3; corner++) {
      const vertex = at(indices, index + corner);
      const dot = nx * at(normals, vertex * 3) + ny * at(normals, vertex * 3 + 1) + nz * at(normals, vertex * 3 + 2);
      requireValue(Number.isFinite(dot) && dot > 0, 'triangle winding must agree with each vertex normal');
    }
  }
}

function copyArray(array: number[]): number[] {
  const output = new Array<number>(array.length);
  for (let index = 0; index < output.length; index++) output[index] = at(array, index);
  return output;
}

/** Return owned plain arrays and metadata after complete validation succeeds. */
export function copyPreviewPacket(packet: unknown): PreviewPacket {
  validatePreviewPacket(packet);
  const bounds = field(packet, 'bounds') as PreviewPacket['bounds'];
  return {
    version: 0,
    surfaceId: field(packet, 'surfaceId') as string,
    revision: field(packet, 'revision') as number,
    lengthUnit: 'mm',
    coordinateSystem: 'right-handed-z-up',
    winding: 'ccw',
    positions: copyArray(field(packet, 'positions') as number[]),
    normals: copyArray(field(packet, 'normals') as number[]),
    indices: copyArray(field(packet, 'indices') as number[]),
    parameters: copyArray(field(packet, 'parameters') as number[]),
    bounds: { min: copyArray(field(bounds, 'min') as number[]) as Point,
      max: copyArray(field(bounds, 'max') as number[]) as Point },
  };
}
