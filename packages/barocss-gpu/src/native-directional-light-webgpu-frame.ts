import { preparePrimitiveSceneFrame } from './primitive-frame-preflight.js';
import type { PrimitiveSceneCpuFrameV0 } from './primitive-frame-preflight.js';
import { prepareNativeDirectionalLightProgramWGSL } from './native-directional-light-program-wgsl.js';
import type { PreparedNativeDirectionalLightProgramWGSL, NativeDirectionalLightProgramWGSLProgram,
  NativeDirectionalLightProgramWGSLABI } from './native-directional-light-program-wgsl.js';
import type { NativeDirectionalLightsV0 } from './native-directional-lights.js';
import type { PrimitiveSceneRef } from './primitive-scene-renderer.js';
import { prepareCamera } from './camera.js';
import type { MeshCamera } from './camera.js';
import type { RGB, Vec3 } from './scene-types.js';
import type { UpdateResult } from './renderer.js';

export const NativeDirectionalLightWebGPUDiagnosticCode = Object.freeze({
  INPUT: 'INPUT', PROFILE: 'PROFILE', FRAME: 'FRAME', PROGRAM: 'PROGRAM', REPRESENTATION: 'REPRESENTATION',
  BUDGET: 'BUDGET', UNSUPPORTED: 'UNSUPPORTED', INIT: 'INIT', DEVICE_LOST: 'DEVICE_LOST',
  RENDER: 'RENDER', STATE: 'STATE', BUSY: 'BUSY',
} as const);
export type NativeDirectionalLightWebGPUDiagnosticCode = typeof NativeDirectionalLightWebGPUDiagnosticCode[keyof typeof NativeDirectionalLightWebGPUDiagnosticCode];
export class NativeDirectionalLightWebGPUError extends Error {
  constructor(readonly code: NativeDirectionalLightWebGPUDiagnosticCode, message: string, ...cause: [] | [unknown]) {
    super(message.slice(0, 1024), cause.length ? { cause: cause[0] } : undefined);
    this.name = 'NativeDirectionalLightWebGPUError';
  }
}
export interface NativeDirectionalLightWebGPUFrameOptions {
  mmToSceneUnit: number; translate: Vec3; background: RGB; camera: MeshCamera;
}
export interface NativeDirectionalLightWebGPURequest {
  format: 'barocss-gpu-native-directional-light-webgpu-request'; version: 0;
  frame: Omit<PrimitiveSceneCpuFrameV0, 'options'> & { options: NativeDirectionalLightWebGPUFrameOptions };
  lights: NativeDirectionalLightsV0;
}
export interface NativeDirectionalLightWebGPUOptions { readonly width: number; readonly height: number }
export interface NativeDirectionalLightWebGPULimits {
  readonly maxTextureDimension2D: number; readonly maxBufferSize: number; readonly maxUniformBufferBindingSize: number;
  readonly maxColorAttachments: number; readonly maxColorAttachmentBytesPerSample: number;
  readonly maxVertexBuffers: number; readonly maxVertexAttributes: number; readonly maxBindGroups: number;
  readonly maxVertexBufferArrayStride: number; readonly maxUniformBuffersPerShaderStage: number;
  readonly maxBindingsPerBindGroup: number;
}
export interface NativeDirectionalLightWebGPUResources {
  readonly geometryBytes: number; readonly uniformBytes: number; readonly colorIdentityBytes: number;
  readonly depthTexels: number; readonly depthBudgetBytes: number; readonly chargedBytes: number;
  readonly readbackBytes: number; readonly buffers: number; readonly textures: number;
  readonly bindGroups: number; readonly pipelines: number;
}
export interface NativeDirectionalLightWebGPUStatus {
  readonly backend: 'webgpu'; readonly profile: 'qualified-surface-authored-directional-webgpu-v0';
  readonly state: 'ready' | 'lost' | 'failed' | 'disposed'; readonly generation: number;
  readonly width: number; readonly height: number; readonly limits: NativeDirectionalLightWebGPULimits;
  readonly resources: NativeDirectionalLightWebGPUResources;
}
export interface NativeDirectionalLightWebGPUPick { readonly generation: number; readonly ref: PrimitiveSceneRef | null }
export interface NativeDirectionalLightWebGPUViewport {
  readonly canvas: HTMLCanvasElement; readonly originals: NativeDirectionalLightWebGPURequest;
  readonly selected: PrimitiveSceneRef | null; readonly status: NativeDirectionalLightWebGPUStatus;
  updateFrame(input: unknown): Promise<UpdateResult>;
  resize(width: number, height: number): Promise<UpdateResult>;
  readPixels(): Promise<Uint8Array>;
  pick(x: number, y: number): Promise<NativeDirectionalLightWebGPUPick>;
  select(ref: PrimitiveSceneRef | null): UpdateResult;
  dispose(): void;
}

/** Private producer result. Never accepted as a caller token or exported from the barrel. */
export interface PreparedNativeDirectionalLightWebGPUFrame {
  readonly request: NativeDirectionalLightWebGPURequest;
  readonly viewport: { readonly width: number; readonly height: number };
  readonly background: RGB;
  readonly draws: readonly {
    readonly ref: PrimitiveSceneRef; readonly identity: number; readonly indexCount: number;
    readonly program: NativeDirectionalLightProgramWGSLProgram; readonly abi: NativeDirectionalLightProgramWGSLABI;
    readonly positions: Uint8Array; readonly normals: Uint8Array; readonly indices: Uint8Array;
    readonly uniforms: { readonly frame: Uint8Array; readonly material: Uint8Array; readonly lights: Uint8Array; readonly draw: Uint8Array };
  }[];
  readonly resources: NativeDirectionalLightWebGPUResources;
}
function fail(code: NativeDirectionalLightWebGPUDiagnosticCode, message: string): never {
  throw new NativeDirectionalLightWebGPUError(code, message);
}
function reflect<T>(operation: () => T): T {
  try { return operation(); }
  catch (cause) { throw new NativeDirectionalLightWebGPUError('INPUT', 'Own data reflection refused', cause); }
}
type Role = 'root' | 'frame' | 'scene' | 'options' | 'entries' | 'entry' | 'materials' | 'material' | 'catalog' | 'lights' | 'ref' | 'data';
const fields: Partial<Record<Role, readonly string[]>> = {
  root: ['format', 'version', 'frame', 'lights'], frame: ['version', 'scene', 'options', 'particles', 'materials'],
  scene: ['version', 'entries'], options: ['mmToSceneUnit', 'translate', 'background', 'camera'],
  material: ['ref', 'binding'], ref: ['modelId', 'geometryId'],
};
/** Count before reflecting elements, even for adversarial array proxies. */
function arrayLength(value: object, maximum: number, minimum: number): number {
  const descriptor = reflect(() => Object.getOwnPropertyDescriptor(value, 'length'));
  if (!descriptor || !('value' in descriptor) || !Number.isInteger(descriptor.value) || descriptor.value < 0)
    fail('INPUT', 'Arrays require an own integer length');
  if (descriptor.value < minimum || descriptor.value > maximum) fail('BUDGET', 'Array cardinality exceeds this profile');
  return descriptor.value as number;
}
/** Signed ordinary streaming charge, never deduplicating repeated paths. */
function accounting(maxBytes: number, maxVisits: number, maxDepth: number) {
  const encoder = new TextEncoder(); let utf16 = 0, utf8 = 0, visits = 0;
  return {
    visit(depth: number) { if (++visits > maxVisits || depth > maxDepth) fail('BUDGET', 'Ordinary data exceeds value/depth budget'); },
    append(text: string) {
      utf16 += text.length; if (utf16 > maxBytes) fail('BUDGET', 'Signed ordinary data exceeds UTF16 budget');
      utf8 += encoder.encode(text).length; if (utf8 > maxBytes) fail('BUDGET', 'Signed ordinary data exceeds UTF8 budget');
    },
    string(text: string) {
      if (text.length > 65536 || encoder.encode(text).length > 65536) fail('BUDGET', 'String/key exceeds64KiB');
      this.append(JSON.stringify(text));
    },
  };
}
function snapshot(input: unknown): NativeDirectionalLightWebGPURequest {
  const account = accounting(2097152, 262144, 48), active = new WeakSet<object>();
  const visit = (value: unknown, depth: number, role: Role): unknown => {
    account.visit(depth);
    if (value === null || typeof value !== 'object') {
      if (role !== 'data') fail('INPUT', 'Required own data container missing');
      if (typeof value === 'number') {
        if (!Number.isFinite(value)) fail('INPUT', 'Raw data requires finite Numbers');
        account.append(Object.is(value, -0) ? '-0' : JSON.stringify(value)); return value;
      }
      if (typeof value === 'string') { account.string(value); return value; }
      if (value === null || typeof value === 'boolean') { account.append(JSON.stringify(value)); return value; }
      fail('INPUT', 'Raw data refuses unsupported values');
    }
    if (active.has(value)) fail('INPUT', 'Raw data refuses cycles');
    const array = reflect(() => Array.isArray(value));
    if (reflect(() => Object.getPrototypeOf(value)) !== (array ? Array.prototype : Object.prototype))
      fail('INPUT', 'Current-realm plain own data required');
    const list = role === 'entries' || role === 'materials' || role === 'lights';
    if (role !== 'data' && array !== list) fail('INPUT', 'Incorrect container shape');
    const length = array ? arrayLength(value, list ? 4 : 24576, role === 'entries' ? 1 : 0) : 0;
    const keys = reflect(() => Reflect.ownKeys(value));
    if (array) {
      if (keys.length !== length + 1 || keys.some(key => key !== 'length' &&
        (typeof key !== 'string' || !/^(0|[1-9]\d*)$/.test(key) || Number(key) >= length)))
        fail('INPUT', 'Arrays must be dense without extra fields');
    } else {
      if (keys.length > 64) fail('BUDGET', 'Record exceeds64 fields');
      if (keys.some(key => typeof key !== 'string')) fail('INPUT', 'Raw records refuse symbols');
      if (role === 'options' && keys.includes('lighting')) fail('PROFILE', 'Legacy singleton lighting is outside this authored-light profile');
      const exact = fields[role];
      if (exact && (keys.length !== exact.length || keys.some(key => !exact.includes(key as string))))
        fail('INPUT', 'Missing or unsupported ' + role + ' fields');
    }
    const names = array ? Array.from({ length }, (_, index) => String(index)) : keys as string[];
    const descriptors = names.map(name => reflect(() => Object.getOwnPropertyDescriptor(value, name)));
    if (descriptors.some(descriptor => !descriptor || !descriptor.enumerable || !('value' in descriptor)))
      fail('INPUT', 'Only own enumerable data fields are admitted');
    const own = Object.fromEntries(names.map((name, index) => [name, descriptors[index]!.value]));
    if (role === 'root' && (own.format !== 'barocss-gpu-native-directional-light-webgpu-request' || own.version !== 0))
      fail('INPUT', 'Expected complete authored-light request format/version0');
    if (role === 'frame' && (own.version !== 0 || own.particles !== null)
      || role === 'scene' && own.version !== 2 || role === 'entry' && own.kind !== 'surface')
      fail('PROFILE', 'Only complete qualified-v2 native Surface frames without particles are admitted');
    if (role === 'catalog' && own.profile !== 'native-world-directional-linear-v0') fail('PROFILE', 'Incorrect authored directional catalog profile');
    active.add(value); account.append(array ? '[' : '{');
    const children = names.map((name, index) => {
      if (index) account.append(','); if (!array) { account.string(name); account.append(':'); }
      const childRole: Role = role === 'root' ? name === 'frame' ? 'frame' : name === 'lights' ? 'catalog' : 'data'
        : role === 'frame' && (name === 'scene' || name === 'options' || name === 'materials') ? name
        : role === 'scene' && name === 'entries' ? 'entries' : role === 'entries' ? 'entry'
        : role === 'materials' ? 'material' : role === 'catalog' && name === 'lights' ? 'lights'
        : (role === 'entry' || role === 'material') && name === 'ref' ? 'ref' : 'data';
      return visit(own[name], depth + 1, childRole);
    });
    account.append(array ? ']' : '}'); active.delete(value);
    return array ? children : Object.fromEntries(names.map((name, index) => [name, children[index]]));
  };
  return visit(input, 0, 'root') as NativeDirectionalLightWebGPURequest;
}
function freezePlain<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !ArrayBuffer.isView(value)) {
    Object.values(value).forEach(freezePlain); Object.freeze(value);
  }
  return value;
}
function aggregateBudget(input: unknown): void {
  const account = accounting(8388608, 524288, 64);
  const visit = (value: unknown, depth: number): void => {
    account.visit(depth);
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) fail('BUDGET', 'Owned projection requires finite Numbers');
      account.append(Object.is(value, -0) ? '-0' : JSON.stringify(value)); return;
    }
    if (value === null || typeof value === 'string' || typeof value === 'boolean') { account.append(JSON.stringify(value)); return; }
    if (typeof value !== 'object') fail('BUDGET', 'Owned projection requires ordinary data');
    const array = Array.isArray(value); account.append(array ? '[' : '{');
    Object.entries(value).forEach(([key, child], index) => {
      if (index) account.append(','); if (!array) { account.append(JSON.stringify(key)); account.append(':'); }
      visit(child, depth + 1);
    }); account.append(array ? ']' : '}');
  };
  visit(input, 0);
}
function represented(value: number): number {
  const rounded = Math.fround(value);
  if (!Number.isFinite(value) || !Number.isFinite(rounded) || value !== 0 && rounded === 0)
    fail('REPRESENTATION', 'Upload coefficient must remain finite and nonzero as f32');
  return rounded;
}
function packF32(values: ArrayLike<number>): Uint8Array {
  const bytes = new Uint8Array(values.length * 4), view = new DataView(bytes.buffer);
  for (let index = 0; index < values.length; index++) view.setFloat32(index * 4, represented(values[index]), true);
  return bytes;
}
function packIndices(values: Uint16Array): Uint8Array {
  const bytes = new Uint8Array(Math.ceil(values.byteLength / 4) * 4), view = new DataView(bytes.buffer);
  values.forEach((value, index) => view.setUint16(index * 2, value, true)); return bytes;
}
/** Actual providers run once per request / once per draw. No cached or caller-prepared authority. */
export function prepareNativeDirectionalLightWebGPUFrame(input: unknown, width: number, height: number): PreparedNativeDirectionalLightWebGPUFrame {
  for (const value of [width, height]) {
    if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isInteger(value)) fail('INPUT', 'Dimensions require finite integers');
    if (value < 1 || value > 1024) fail('BUDGET', 'Dimensions exceed1..1024');
  }
  if (width * height > 1048576) fail('BUDGET', 'Pixel budget exceeded');
  const request = snapshot(input);
  let common: ReturnType<typeof preparePrimitiveSceneFrame>, camera: ReturnType<typeof prepareCamera>;
  try { common = preparePrimitiveSceneFrame(request.frame, 'qualified-v2'); }
  catch (cause) { throw new NativeDirectionalLightWebGPUError('FRAME', 'Actual common native frame admission refused', cause); }
  try { camera = prepareCamera(request.frame.options.camera, width / height); }
  catch (cause) { throw new NativeDirectionalLightWebGPUError('FRAME', 'Actual camera admission refused', cause); }
  const programs: PreparedNativeDirectionalLightProgramWGSL[] = common.primitives.map(primitive => {
    const ref = primitive.entry.ref;
    const raw = request.frame.materials.find(item => item.ref.modelId === ref.modelId && item.ref.geometryId === ref.geometryId);
    try { return prepareNativeDirectionalLightProgramWGSL({ lights: request.lights, material: raw?.binding ?? null }); }
    catch (cause) { throw new NativeDirectionalLightWebGPUError('PROGRAM', 'Actual authored-light program provider refused', cause); }
  });
  // Program-owned binary bytes are charged below, not in the signed ordinary projection.
  aggregateBudget({ request, commonFrame: common.frame, programs: programs.map(program => ({
    format: program.format, version: program.version, profile: program.profile,
    originals: program.originals, execution: program.execution, abi: program.abi, program: program.program,
  })) });
  let geometryBytes = 0;
  for (const primitive of common.primitives) {
    if (!(primitive.normals instanceof Float32Array) || !(primitive.indices instanceof Uint16Array))
      fail('FRAME', 'Admitted Surface requires normal and index execution arrays');
    geometryBytes += primitive.positions.byteLength + primitive.normals.byteLength + Math.ceil(primitive.indices.byteLength / 4) * 4;
  }
  const count = common.primitives.length, texels = width * height, uniformBytes = 368 * count;
  const resources: NativeDirectionalLightWebGPUResources = { geometryBytes, uniformBytes,
    colorIdentityBytes: 8 * texels, depthTexels: texels, depthBudgetBytes: 4 * texels,
    chargedBytes: geometryBytes + uniformBytes + 12 * texels, readbackBytes: Math.ceil(4 * width / 256) * 256 * height,
    buffers: 7 * count, textures: 3, bindGroups: count, pipelines: count };
  if (!Number.isSafeInteger(resources.chargedBytes) || resources.chargedBytes > 33554432) fail('BUDGET', 'Candidate exceeds32MiB logical resources');
  const draws = common.primitives.map((primitive, index) => {
    const program = programs[index], frame = new Uint8Array(144), draw = new Uint8Array(16), view = new DataView(frame.buffer);
    camera.view.forEach((value, offset) => view.setFloat32(offset * 4, represented(value), true));
    camera.projection.forEach((value, offset) => view.setFloat32(64 + offset * 4, represented(value), true));
    primitive.entry.color.forEach((value, offset) => view.setFloat32(128 + offset * 4, represented(value), true));
    new DataView(draw.buffer).setUint32(0, index + 1, true);
    return { ref: { ...primitive.entry.ref }, identity: index + 1, indexCount: primitive.indices!.length,
      program: program.program, abi: program.abi, positions: packF32(primitive.positions), normals: packF32(primitive.normals!),
      indices: packIndices(primitive.indices!), uniforms: { frame, material: program.uniforms.material.slice(), lights: program.uniforms.lights.slice(), draw } };
  });
  return freezePlain({ request, viewport: { width, height }, background: [...common.frame.options.background] as RGB, draws, resources });
}
