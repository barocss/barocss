import { validateMeshCamera } from './camera.js';
import type { MeshCamera } from './camera.js';
import { validateMeshLighting } from './mesh-lighting.js';
import type { MeshLighting } from './mesh-lighting.js';

/** Host-owned CAD preview provenance. Geometry is an approximate open surface in millimetres. */
export interface PreviewPacket {
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

/** Explicit host conversion and opaque normalized RGB; no camera fitting or inferred units. */
export interface MeshOptions {
  camera?: MeshCamera;
  lighting?: MeshLighting;
  mmToSceneUnit: number;
  translate: [number, number, number];
  color: [number, number, number];
  background: [number, number, number];
}

function requireValue(condition: unknown, message: string): asserts condition {
  if (!condition) throw new RangeError(message);
}

function object(input: unknown, keys: string[], label: string): Record<string, unknown> {
  requireValue(input !== null && typeof input === 'object' && Object.getPrototypeOf(input) === Object.prototype,
    `${label} must be a plain JSON object`);
  const actual = Reflect.ownKeys(input);
  requireValue(actual.length === keys.length && actual.every((key) => typeof key === 'string' && keys.includes(key)),
    `${label} has missing or unsupported fields`);
  const result: Record<string, unknown> = {};
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    requireValue(descriptor && 'value' in descriptor && descriptor.enumerable, `${label}.${key} must be JSON data`);
    result[key] = descriptor.value;
  }
  return result;
}

function array(input: unknown, min: number, max: number, label: string): number[] {
  requireValue(Array.isArray(input) && Object.getPrototypeOf(input) === Array.prototype, `${label} must be a plain array`);
  requireValue(input.length >= min && input.length <= max, `${label} count exceeds allowed bounds`);
  // Count is bounded before inspecting elements or allocating copies.
  const keys = Reflect.ownKeys(input);
  requireValue(keys.length === input.length + 1, `${label} must be dense JSON data without additional fields`);
  // (The values checked, copied: the caller's array itself could answer differently on a later read — a Proxy — and NaN
  // would pass into an accepted, frozen result; G5, the old review's fuzz R1.)
  const out = new Array<number>(input.length);
  for (let i = 0; i < input.length; i++) {
    const descriptor = Object.getOwnPropertyDescriptor(input, String(i));
    requireValue(descriptor && 'value' in descriptor && descriptor.enumerable && typeof descriptor.value === 'number' && Number.isFinite(descriptor.value),
      `${label}[${i}] must be finite numeric JSON data`);
    out[i] = descriptor!.value as number;
  }
  return out;
}

function triple(input: unknown, label: string, limit: number, nonnegative = false): [number, number, number] {
  const value = array(input, 3, 3, label);
  requireValue(value.every((n) => Math.abs(n) <= limit && (!nonnegative || n >= 0)), `${label} values exceed allowed bounds`);
  return value as [number, number, number];
}

/** Internal shared check for native and derived execution geometry. */
export function validateMeshGeometry(positions: ArrayLike<number>, normals: ArrayLike<number>, indices: ArrayLike<number>, label: string): void {
  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t] * 3, b = indices[t + 1] * 3, c = indices[t + 2] * 3;
    requireValue(a !== b && b !== c && a !== c, `${label} triangle repeats an index`);
    const ux = positions[b] - positions[a], uy = positions[b + 1] - positions[a + 1], uz = positions[b + 2] - positions[a + 2];
    const vx = positions[c] - positions[a], vy = positions[c + 1] - positions[a + 1], vz = positions[c + 2] - positions[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    requireValue(Number.isFinite(nx) && Number.isFinite(ny) && Number.isFinite(nz) && Math.hypot(nx, ny, nz) > 0,
      `${label} triangle has zero area or unsafe geometry`);
    for (const vertex of [a, b, c]) {
      const dot = nx * normals[vertex] + ny * normals[vertex + 1] + nz * normals[vertex + 2];
      requireValue(Number.isFinite(dot) && dot > 0, `${label} triangle winding disagrees with vertex normals`);
    }
  }
}

export function validatePreviewPacket(input: unknown): PreviewPacket {
  const value = object(input, ['version', 'surfaceId', 'revision', 'lengthUnit', 'coordinateSystem', 'winding',
    'positions', 'normals', 'indices', 'parameters', 'bounds'], 'Packet');
  requireValue(value.version === 0, 'Only preview packet version 0 is supported');
  requireValue(typeof value.surfaceId === 'string' && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(value.surfaceId), 'surfaceId must be a CAD ASCII identifier');
  requireValue(typeof value.revision === 'number' && Number.isInteger(value.revision) && value.revision >= 0 && value.revision <= 2147483647,
    'revision must be an integer in 0..2147483647');
  requireValue(value.lengthUnit === 'mm' && value.coordinateSystem === 'right-handed-y-up' && value.winding === 'ccw',
    'Packet units, coordinate system and winding must match preview v0');
  const positions = array(value.positions, 12, 4096 * 3, 'positions');
  requireValue(positions.length % 3 === 0, 'positions requires XYZ triples');
  const count = positions.length / 3;
  const normals = array(value.normals, count * 3, count * 3, 'normals');
  const parameters = array(value.parameters, count * 2, count * 2, 'parameters');
  const indices = array(value.indices, 6, 7938 * 3, 'indices');
  requireValue(indices.length % 3 === 0, 'indices requires triangle triples');
  const boundsValue = object(value.bounds, ['min', 'max'], 'bounds');
  const min = triple(boundsValue.min, 'bounds.min', 1e6), max = triple(boundsValue.max, 'bounds.max', 1e6);
  requireValue(positions.every((n) => Math.abs(n) <= 1e6), 'positions exceeds 1e6 mm');
  for (let i = 0; i < normals.length; i += 3) {
    requireValue(Math.abs(Math.hypot(normals[i], normals[i + 1], normals[i + 2]) - 1) <= 1e-5, 'normals must have unit length within 1e-5');
  }
  requireValue(indices.every((n) => Number.isInteger(n) && n >= 0 && n < count), 'indices must address an existing vertex');
  for (let axis = 0; axis < 3; axis++) {
    let low = Infinity, high = -Infinity;
    for (let i = axis; i < positions.length; i += 3) { low = Math.min(low, positions[i]); high = Math.max(high, positions[i]); }
    requireValue(min[axis] === low && max[axis] === high, 'bounds must equal exact component-wise position extrema');
  }
  validateMeshGeometry(positions, normals, indices, 'Packet');
  // Freeze only owned copies, never caller arrays or objects.
  const result: PreviewPacket = {
    version: 0, surfaceId: value.surfaceId, revision: value.revision, lengthUnit: 'mm',
    coordinateSystem: 'right-handed-y-up', winding: 'ccw',
    positions: positions.slice(), normals: normals.slice(), indices: indices.slice(), parameters: parameters.slice(),
    bounds: { min: [...min], max: [...max] },
  };
  for (const owned of [result.positions, result.normals, result.indices, result.parameters, result.bounds.min, result.bounds.max, result.bounds, result]) Object.freeze(owned);
  return result;
}

export function validateMeshOptions(input: unknown): MeshOptions {
  const keys = ['mmToSceneUnit', 'translate', 'color', 'background'];
  if (input !== null && typeof input === 'object' && Object.hasOwn(input, 'camera')) keys.push('camera');
  if (input !== null && typeof input === 'object' && Object.hasOwn(input, 'lighting')) keys.push('lighting');
  const value = object(input, keys, 'Mesh options');
  requireValue(typeof value.mmToSceneUnit === 'number' && Number.isFinite(value.mmToSceneUnit) && value.mmToSceneUnit > 0,
    'mmToSceneUnit must be finite and positive');
  const translate = triple(value.translate, 'translate', 1000);
  const color = triple(value.color, 'color', 1, true), background = triple(value.background, 'background', 1, true);
  const result: MeshOptions = { mmToSceneUnit: value.mmToSceneUnit, translate: [...translate], color: [...color], background: [...background] };
  if (keys.includes('camera')) result.camera = validateMeshCamera(value.camera);
  if (keys.includes('lighting')) result.lighting = validateMeshLighting(value.lighting);
  for (const owned of [result.translate, result.color, result.background, result]) Object.freeze(owned);
  return result;
}

export function prepareMesh(packetInput: unknown, optionsInput: unknown): {
  packet: PreviewPacket; options: MeshOptions; positions: Float32Array; normals: Float32Array; indices: Uint16Array;
} {
  const {packet,options}=resolveMeshIntent(packetInput,optionsInput);
  return lowerMesh(packet,options);
}
export function resolveMeshIntent(packetInput:unknown,optionsInput:unknown):{packet:PreviewPacket;options:MeshOptions}{return{packet:validatePreviewPacket(packetInput),options:validateMeshOptions(optionsInput)};}
/** Internal display conversion shared by original and posed Surface packets. */
export function convertMeshCoordinate(millimeters:number,scale:number,translation:number,boundsMessage:string):number {
  const scaled=millimeters*scale;
  requireValue(Number.isFinite(scaled)&&(millimeters===0||scaled!==0),'Native Surface coordinate overflows or underflows during scene scaling');
  const converted=scaled+translation;
  requireValue(Number.isFinite(converted)&&Math.abs(converted)<=1000,boundsMessage);
  const f32=Math.fround(converted);
  requireValue(Number.isFinite(f32)&&(converted===0||f32!==0),'Native Surface coordinate underflows in Float32 display');
  return converted;
}
export function lowerMesh(packet:PreviewPacket,options:MeshOptions):{packet:PreviewPacket;options:MeshOptions;positions:Float32Array;normals:Float32Array;indices:Uint16Array}{
  // All structural ceilings are validated before typed GPU buffers are allocated.
  for (let i = 0; i < packet.positions.length; i++) {
    convertMeshCoordinate(packet.positions[i],options.mmToSceneUnit,options.translate[i%3],
      'Converted GPU positions must be finite and within 1000 scene units');
  }
  const positions = Float32Array.from(packet.positions, (n, i) => n * options.mmToSceneUnit + options.translate[i % 3]);
  const normals = Float32Array.from(packet.normals), indices = Uint16Array.from(packet.indices);
  validateMeshGeometry(positions, normals, indices, 'Float32 GPU');
  return { packet, options, positions, normals, indices };
}
