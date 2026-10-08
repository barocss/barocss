/** The shared CAD/GPU preview packet v0. It is an approximate triangle mesh in mm. */
export interface CadPreviewPacket {
  version: 0;
  surfaceId: string;
  revision: number;
  lengthUnit: 'mm';
  coordinateSystem: 'right-handed-y-up';
  winding: 'ccw';
  positions: number[];
  normals: number[];
  indices: number[];
  parameters: number[];
  bounds: { min: [number, number, number]; max: [number, number, number] };
}

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new RangeError(`Invalid CAD preview packet: ${message}`);
}

export function record(input: unknown, keys: readonly string[], label: string): Record<string, unknown> {
  check(input !== null && typeof input === 'object' && !Array.isArray(input), `${label} must be a plain object`);
  const prototype = Object.getPrototypeOf(input);
  check(prototype === Object.prototype || prototype === null, `${label} must be a plain object`);
  const actual = Reflect.ownKeys(input);
  check(actual.length === keys.length && actual.every(key => typeof key === 'string' && keys.includes(key)),
    `${label} has missing or unsupported fields`);
  const output: Record<string, unknown> = {};
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    check(descriptor && 'value' in descriptor && descriptor.enumerable, `${label}.${key} must be data`);
    output[key] = descriptor.value;
  }
  return output;
}

export function numbers(input: unknown, min: number, max: number, multiple: number, label: string): number[] {
  check(Array.isArray(input) && Object.getPrototypeOf(input) === Array.prototype, `${label} must be a plain array`);
  const length = Object.getOwnPropertyDescriptor(input, 'length')?.value;
  check(typeof length === 'number' && length >= min && length <= max && length % multiple === 0,
    `${label} has an invalid length`);
  check(Reflect.ownKeys(input).length === length + 1, `${label} must be dense without extra fields`);
  const output: number[] = [];
  for (let index = 0; index < length; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(input, String(index));
    check(descriptor && 'value' in descriptor && descriptor.enumerable
      && typeof descriptor.value === 'number' && Number.isFinite(descriptor.value),
    `${label}[${index}] must be a finite number`);
    output.push(descriptor.value);
  }
  return output;
}

/** Validate and copy a packet without calling property getters on ordinary objects. */
export function copyCadPreviewPacket(input: unknown): CadPreviewPacket {
  const value = record(input, ['version', 'surfaceId', 'revision', 'lengthUnit', 'coordinateSystem',
    'winding', 'positions', 'normals', 'indices', 'parameters', 'bounds'], 'packet');
  check(value.version === 0, 'unsupported version');
  check(typeof value.surfaceId === 'string' && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(value.surfaceId),
    'surfaceId must be an ASCII identifier');
  check(typeof value.revision === 'number' && Number.isInteger(value.revision)
    && value.revision >= 0 && value.revision <= 2147483647, 'revision is out of range');
  check(value.lengthUnit === 'mm' && value.coordinateSystem === 'right-handed-y-up' && value.winding === 'ccw',
    'unsupported units, axes, or winding');
  const positions = numbers(value.positions, 12, 12288, 3, 'positions');
  const vertexCount = positions.length / 3;
  const normals = numbers(value.normals, positions.length, positions.length, 3, 'normals');
  const indices = numbers(value.indices, 6, 23814, 3, 'indices');
  const parameters = numbers(value.parameters, vertexCount * 2, vertexCount * 2, 2, 'parameters');
  const bounds = record(value.bounds, ['min', 'max'], 'bounds');
  const min = numbers(bounds.min, 3, 3, 3, 'bounds.min') as [number, number, number];
  const max = numbers(bounds.max, 3, 3, 3, 'bounds.max') as [number, number, number];
  for (let axis = 0; axis < 3; axis++) {
    let low = Infinity, high = -Infinity;
    for (let vertex = 0; vertex < vertexCount; vertex++) {
      const position = positions[vertex * 3 + axis];
      check(Math.abs(position) <= 1e6, 'position exceeds 1e6 mm');
      low = Math.min(low, position);
      high = Math.max(high, position);
    }
    check(min[axis] === low && max[axis] === high, 'bounds do not match positions');
  }
  for (let vertex = 0; vertex < vertexCount; vertex++) {
    const offset = vertex * 3;
    check(Math.abs(Math.hypot(normals[offset], normals[offset + 1], normals[offset + 2]) - 1) <= 1e-5,
      'normal must have unit length');
  }
  for (let index = 0; index < indices.length; index += 3) {
    const a = indices[index], b = indices[index + 1], c = indices[index + 2];
    check([a, b, c].every(n => Number.isInteger(n) && n >= 0 && n < vertexCount), 'index is out of range');
    check(a !== b && b !== c && c !== a, 'triangle repeats a vertex');
    const ab = [0, 1, 2].map(axis => positions[b * 3 + axis] - positions[a * 3 + axis]);
    const ac = [0, 1, 2].map(axis => positions[c * 3 + axis] - positions[a * 3 + axis]);
    const face = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2],
      ab[0] * ac[1] - ab[1] * ac[0]];
    check(Number.isFinite(Math.hypot(...face)) && Math.hypot(...face) > 0, 'triangle has zero or unsafe area');
    for (const vertex of [a, b, c]) {
      const dot = face[0] * normals[vertex * 3] + face[1] * normals[vertex * 3 + 1]
        + face[2] * normals[vertex * 3 + 2];
      check(Number.isFinite(dot) && dot > 0, 'triangle winding disagrees with its normals');
    }
  }
  return {
    version: 0, surfaceId: value.surfaceId, revision: value.revision,
    lengthUnit: 'mm', coordinateSystem: 'right-handed-y-up', winding: 'ccw',
    positions, normals, indices, parameters, bounds: { min, max },
  };
}

export interface PreparedCadMesh {
  surfaceId: string;
  revision: number;
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint16Array;
  /** Native CAD U/V values, not normalized texture coordinates. */
  parameters: Float32Array;
}

/** Produce owned buffers for a host renderer. The host selects scene units explicitly. */
export function prepareCadPreviewMesh(input: unknown, unitsPerMillimeter: number): PreparedCadMesh {
  check(Number.isFinite(unitsPerMillimeter) && unitsPerMillimeter > 0,
    'unitsPerMillimeter must be finite and positive');
  const packet = copyCadPreviewPacket(input);
  const positions = Float32Array.from(packet.positions, value => value * unitsPerMillimeter);
  const normals = Float32Array.from(packet.normals);
  const parameters = Float32Array.from(packet.parameters);
  const indices = Uint16Array.from(packet.indices);
  check(positions.every(Number.isFinite) && parameters.every(Number.isFinite), 'Float32 conversion is not finite');
  for (let index = 0; index < indices.length; index += 3) {
    const a = indices[index] * 3, b = indices[index + 1] * 3, c = indices[index + 2] * 3;
    const ux = positions[b] - positions[a], uy = positions[b + 1] - positions[a + 1], uz = positions[b + 2] - positions[a + 2];
    const vx = positions[c] - positions[a], vy = positions[c + 1] - positions[a + 1], vz = positions[c + 2] - positions[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    check(Number.isFinite(Math.hypot(nx, ny, nz)) && Math.hypot(nx, ny, nz) > 0,
      'triangle collapses after Float32 conversion');
    for (const offset of [a, b, c]) {
      check(nx * normals[offset] + ny * normals[offset + 1] + nz * normals[offset + 2] > 0,
        'triangle winding changes after Float32 conversion');
    }
  }
  return { surfaceId: packet.surfaceId, revision: packet.revision, positions, normals, indices, parameters };
}
