import { BarocssError } from '../../core/barocss-error.js';
import { prepareNativeSurfaceUV01MaterialBinding } from './native-surface-uv01-binding.js';
import type { PreparedNativeSurfaceUV01Binding } from './native-surface-uv01-binding.js';
import type { NativeSurfaceUV01GeometryRequest } from './native-surface-uv01-geometry.js';
import type { NativeSurfaceUV01MaterialIR } from '../../material/mesh-material.js';
import { lowerNativeSurfaceUV01ProgramWGSL } from './native-surface-uv01-program-wgsl.js';
import type { LoweredNativeSurfaceUV01ProgramWGSL } from './native-surface-uv01-program-wgsl.js';
import { preparePrimitiveSceneFrame } from '../../mesh/primitive-frame-preflight.js';
import type { PreparedPrimitiveSceneFrame } from '../../mesh/primitive-frame-preflight.js';
import type { PrimitiveSceneRef } from '../../scene/primitive-scene.js';
import { validateMeshOptions } from '../../mesh/mesh-packet.js';
import { prepareSceneTransform } from '../../mesh/mesh-scene-transform.js';
import type { MeshSceneTransform } from '../../mesh/mesh-scene-transform.js';
import { prepareCamera } from '../../mesh/camera.js';
import type { MeshCamera } from '../../mesh/camera.js';
import type { MeshLighting } from '../../mesh/mesh-lighting.js';
import type { RGB, Vec3 } from '../../scene/scene.js';
import { accountNativeSurfaceUV01Aggregate, prepareNativeSurfaceUV01PackedDraws } from './native-surface-uv01-frame-pack.js';

export const NativeSurfaceUV01FrameDiagnosticCode = Object.freeze({
  INPUT: 'INPUT', BUDGET: 'BUDGET', REFERENCE: 'REFERENCE', OPTIONS: 'OPTIONS',
  BINDING: 'BINDING', PROGRAM: 'PROGRAM', FRAME: 'FRAME', REPRESENTATION: 'REPRESENTATION',
} as const);
export type NativeSurfaceUV01FrameDiagnosticCode = typeof NativeSurfaceUV01FrameDiagnosticCode[keyof typeof NativeSurfaceUV01FrameDiagnosticCode];
export class NativeSurfaceUV01FrameError extends BarocssError {
  constructor(readonly code: NativeSurfaceUV01FrameDiagnosticCode, message: string, cause?: unknown) {
    super(code, message, { maxLength: 1024 });
    this.name = 'NativeSurfaceUV01FrameError';
    if (arguments.length >= 3) Object.defineProperty(this, 'cause', { value: cause, configurable: true, writable: true });
  }
}
export interface NativeSurfaceUV01FrameEntry {
  ref: PrimitiveSceneRef;
  geometry: NativeSurfaceUV01GeometryRequest;
  material: NativeSurfaceUV01MaterialIR;
  uniforms: Record<string, number>;
  transform: MeshSceneTransform | null;
}
export interface NativeSurfaceUV01FrameOptions {
  mmToSceneUnit: number; translate: Vec3; background: RGB; camera: MeshCamera; lighting: MeshLighting;
}
export interface NativeSurfaceUV01FrameRequest {
  format: 'barocss-gpu-native-surface-uv01-frame-request'; version: 0;
  entries: NativeSurfaceUV01FrameEntry[]; options: NativeSurfaceUV01FrameOptions;
}
export interface NativeSurfaceUV01FrameDraw {
  ref: PrimitiveSceneRef; identity: number; program: LoweredNativeSurfaceUV01ProgramWGSL; indexCount: number;
  positions: Uint8Array; normals: Uint8Array; indices: Uint8Array; uv01: Uint8Array;
  uniforms: { frame: Uint8Array; material: Uint8Array; draw: Uint8Array };
}
export interface NativeSurfaceUV01FrameResources {
  geometryBytes: number; uniformBytes: number; colorIdentityBytes: number; depthTexels: number;
  depthBudgetBytes: number; chargedBytes: number; readbackBytes: number; buffers: number;
  textures: number; bindGroups: number; pipelines: number;
}
export interface PreparedNativeSurfaceUV01Frame {
  format: 'barocss-gpu-native-surface-uv01-frame'; version: 0; profile: 'source0-native-surface-uv01-frame-v0';
  request: NativeSurfaceUV01FrameRequest; bindings: PreparedNativeSurfaceUV01Binding[];
  frame: PreparedPrimitiveSceneFrame; draws: NativeSurfaceUV01FrameDraw[];
  resources: NativeSurfaceUV01FrameResources; viewport: { width: number; height: number };
}

function reject(code: NativeSurfaceUV01FrameDiagnosticCode, message: string): never {
  throw new NativeSurfaceUV01FrameError(code, message);
}
// Only the reflection operation is caught: local guards never acquire a fake cause.
function reflect<T>(operation: () => T): T {
  try { return operation(); }
  catch (cause) { throw new NativeSurfaceUV01FrameError('INPUT', 'Native Surface UV01 frame reflection refused', cause); }
}
type Role = 'root' | 'entries' | 'entry' | 'ref' | 'geometry' | 'options' | 'uniforms' | 'data';
const FIELDS: Partial<Record<Role, string[]>> = {
  root: ['format', 'version', 'entries', 'options'], entry: ['ref', 'geometry', 'material', 'uniforms', 'transform'],
  ref: ['modelId', 'geometryId'], geometry: ['format', 'version', 'sourceVersion', 'source', 'surfaceId', 'countU', 'countV', 'revision'],
  options: ['mmToSceneUnit', 'translate', 'background', 'camera', 'lighting'],
};
/** Snapshot and charge every raw path, retaining signed Number data before providers run. */
function snapshot(input: unknown): NativeSurfaceUV01FrameRequest {
  const encoder = new TextEncoder(), ancestors = new WeakSet<object>();
  let visits = 0, utf16 = 0, utf8 = 0;
  const append = (text: string): void => {
    utf16 += text.length;
    if (utf16 > 2097152) reject('BUDGET', 'Native UV01 raw request exceeds 2MiB UTF16');
    utf8 += encoder.encode(text).length;
    if (utf8 > 2097152) reject('BUDGET', 'Native UV01 raw request exceeds 2MiB UTF8');
  };
  const string = (text: string): void => {
    if (text.length > 65536 || encoder.encode(text).length > 65536) reject('BUDGET', 'Native UV01 string exceeds 64KiB');
    append(JSON.stringify(text));
  };
  const visit = (value: unknown, depth: number, role: Role): unknown => {
    if (++visits > 262144 || depth > 48) reject('BUDGET', 'Native UV01 raw request exceeds work/depth budget');
    if (value === null || typeof value !== 'object') {
      if (role !== 'data') reject('INPUT', 'Native UV01 request requires structured own data');
      if (typeof value === 'number') {
        if (!Number.isFinite(value)) reject('INPUT', 'Native UV01 request requires finite Numbers');
        append(Object.is(value, -0) ? '-0' : JSON.stringify(value)); return value;
      }
      if (typeof value === 'string') { string(value); return value; }
      if (value === null || typeof value === 'boolean') { append(JSON.stringify(value)); return value; }
      return reject('INPUT', 'Native UV01 request refuses unsupported values');
    }
    if (ancestors.has(value)) reject('INPUT', 'Native UV01 request refuses cycles');
    const array = reflect(() => Array.isArray(value)), prototype = reflect(() => Object.getPrototypeOf(value));
    if (prototype !== (array ? Array.prototype : Object.prototype)) reject('INPUT', 'Native UV01 request requires current-realm plain data');
    if ((role === 'entries') !== array && role !== 'data') reject('INPUT', 'Native UV01 request has incorrect container shape');
    let length = 0;
    if (array) {
      const descriptor = reflect(() => Object.getOwnPropertyDescriptor(value, 'length'));
      if (!descriptor || !('value' in descriptor) || !Number.isInteger(descriptor.value) || descriptor.value < 0)
        reject('INPUT', 'Native UV01 arrays require an own integer length');
      length = descriptor.value as number;
      if (length > (role === 'entries' ? 4 : 24576) || (role === 'entries' && length < 1))
        reject('BUDGET', 'Native UV01 array or entry count exceeds limits');
    }
    const keys = reflect(() => Reflect.ownKeys(value));
    if (array) {
      if (keys.length !== length + 1 || keys.some(key => key !== 'length' &&
        (typeof key !== 'string' || !/^(0|[1-9]\d*)$/.test(key) || Number(key) >= length)))
        reject('INPUT', 'Native UV01 arrays must be dense without extra fields');
    } else {
      if (keys.length > 16) reject('BUDGET', 'Native UV01 record exceeds 16 fields');
      if (keys.some(key => typeof key !== 'string')) reject('INPUT', 'Native UV01 records refuse symbols');
      const required = FIELDS[role];
      if (required && (keys.length !== required.length || keys.some(key => !required.includes(key as string))))
        reject('INPUT', 'Native UV01 ' + role + ' has missing or unsupported fields');
      if (role === 'uniforms' && keys.some(key => !/^[A-Za-z_][A-Za-z0-9_]{0,31}$/.test(key as string)))
        reject('INPUT', 'Native UV01 overrides require bounded identifiers');
    }
    // All own descriptors are checked before traversing descendants.
    const names = array ? Array.from({ length }, (_, index) => String(index)) : keys as string[];
    const descriptors = names.map(name => reflect(() => Object.getOwnPropertyDescriptor(value, name)));
    if (descriptors.some(descriptor => !descriptor || !descriptor.enumerable || !('value' in descriptor)))
      reject('INPUT', 'Native UV01 request refuses accessors or hidden fields');
    const own = Object.fromEntries(names.map((name, index) => [name, descriptors[index]!.value]));
    if (role === 'root' && (own.format !== 'barocss-gpu-native-surface-uv01-frame-request' || own.version !== 0))
      reject('INPUT', 'Native UV01 frame requires format/version0');
    if (role === 'root') {
      // Count admission precedes every descendant even when caller key order puts options first.
      const entries: unknown = own.entries;
      if (!reflect(() => Array.isArray(entries)) || reflect(() => Object.getPrototypeOf(entries)) !== Array.prototype)
        reject('INPUT', 'Native UV01 entries require a current-realm dense array');
      const descriptor = reflect(() => Object.getOwnPropertyDescriptor(entries, 'length'));
      if (!descriptor || !('value' in descriptor) || !Number.isInteger(descriptor.value))
        reject('INPUT', 'Native UV01 entries require an own integer length');
      if (descriptor.value < 1 || descriptor.value > 4) reject('BUDGET', 'Native UV01 entries require 1..4');
    }
    if (role === 'ref' && names.some(name => typeof own[name] !== 'string' || !/^[A-Za-z_][A-Za-z0-9_.:-]{0,63}$/.test(own[name])))
      reject('INPUT', 'Native UV01 references require bounded ASCII identifiers');
    if (role === 'uniforms' && names.some(name => typeof own[name] !== 'number' || !Number.isFinite(own[name])))
      reject('INPUT', 'Native UV01 override values require finite Numbers');
    ancestors.add(value);
    append(array ? '[' : '{');
    const children = names.map((name, index) => {
      if (index) append(',');
      if (!array) { string(name); append(':'); }
      const childRole: Role = role === 'entries' ? 'entry' : role === 'root' && name === 'entries' ? 'entries'
        : role === 'root' && name === 'options' ? 'options'
        : role === 'entry' && (name === 'ref' || name === 'geometry' || name === 'uniforms') ? name : 'data';
      return visit(own[name], depth + 1, childRole);
    });
    append(array ? ']' : '}'); ancestors.delete(value);
    return array ? children : Object.fromEntries(names.map((name, index) => [name, children[index]]));
  };
  return visit(input, 0, 'root') as NativeSurfaceUV01FrameRequest;
}
function freezePlain<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !ArrayBuffer.isView(value)) {
    Object.values(value).forEach(freezePlain); Object.freeze(value);
  }
  return value;
}

/** Source-derived CPU admission only: no device, DOM, accepted state or future trusted token. */
export function prepareNativeSurfaceUV01Frame(input: unknown, width: number, height: number): PreparedNativeSurfaceUV01Frame {
  for (const value of [width, height]) {
    if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isInteger(value)) reject('INPUT', 'Viewport scalars require finite integers');
    if (value < 1 || value > 1024) reject('BUDGET', 'Viewport dimensions require 1..1024');
  }
  if (width * height > 1048576) reject('BUDGET', 'Viewport pixel budget exceeded');
  const request = snapshot(input), pairs = new Set<string>();
  for (const entry of request.entries) {
    const pair = JSON.stringify([entry.ref.modelId, entry.ref.geometryId]);
    if (pairs.has(pair) || entry.ref.geometryId !== entry.geometry.surfaceId)
      reject('REFERENCE', 'Native UV01 full reference is duplicated or disagrees with its Surface selector');
    pairs.add(pair);
  }
  try {
    validateMeshOptions({ ...request.options, color: [1, 1, 1] });
    for (const entry of request.entries) if (entry.transform !== null) prepareSceneTransform(entry.transform);
  } catch (cause) { throw new NativeSurfaceUV01FrameError('OPTIONS', 'Native UV01 options or pose refused', cause); }
  const bindings: PreparedNativeSurfaceUV01Binding[] = [], programs: LoweredNativeSurfaceUV01ProgramWGSL[] = [];
  for (const entry of request.entries) {
    let binding: PreparedNativeSurfaceUV01Binding;
    try { binding = prepareNativeSurfaceUV01MaterialBinding({ format: 'barocss-gpu-native-surface-uv01-binding-request', version: 0,
      geometry: entry.geometry, material: entry.material, uniforms: entry.uniforms }); }
    catch (cause) { throw new NativeSurfaceUV01FrameError('BINDING', 'Native UV01 source binding refused', cause); }
    if (binding.geometry.preview.packet.surfaceId !== entry.ref.geometryId)
      reject('REFERENCE', 'Native UV01 rebuilt Surface disagrees with the qualified reference');
    bindings.push(binding);
    try { programs.push(lowerNativeSurfaceUV01ProgramWGSL(binding.material)); }
    catch (cause) { throw new NativeSurfaceUV01FrameError('PROGRAM', 'Native UV01 complete WGSL program refused', cause); }
  }
  let frame: PreparedPrimitiveSceneFrame;
  try { frame = preparePrimitiveSceneFrame({ version: 0, scene: { version: 2, entries: bindings.map((binding, index) => {
    const entry = request.entries[index];
    return { kind: 'surface', ref: entry.ref, packet: binding.geometry.preview.packet, color: [1, 1, 1],
      ...(entry.transform === null ? {} : { transform: entry.transform }) };
  }) }, options: request.options, particles: null, materials: [] }, 'qualified-v2'); }
  catch (cause) { throw new NativeSurfaceUV01FrameError('FRAME', 'Native UV01 common frame refused', cause); }
  let camera: ReturnType<typeof prepareCamera>;
  try { camera = prepareCamera(request.options.camera, width / height); }
  catch (cause) { throw new NativeSurfaceUV01FrameError('OPTIONS', 'Native UV01 camera refused', cause); }
  accountNativeSurfaceUV01Aggregate(request, bindings, frame, programs);
  const { draws, resources } = prepareNativeSurfaceUV01PackedDraws(request, bindings, frame, programs, camera, width, height);
  return freezePlain({ format: 'barocss-gpu-native-surface-uv01-frame', version: 0, profile: 'source0-native-surface-uv01-frame-v0',
    request, bindings, frame, draws, resources, viewport: { width, height } });
}
