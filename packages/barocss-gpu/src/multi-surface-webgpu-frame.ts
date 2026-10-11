import { preparePrimitiveSceneFrame } from './primitive-frame-preflight.js';
import type { PrimitiveSceneCpuFrameV0 } from './primitive-frame-preflight.js';
import type { PrimitiveSceneRef } from './primitive-scene-renderer.js';
import { prepareCamera } from './camera.js';
import { MeshMaterialError } from './mesh-material.js';
import { lowerMeshMaterialWGSL } from './mesh-material-wgsl.js';
import type { LoweredMeshMaterialWGSL } from './mesh-material-wgsl.js';
import { copyGpuData } from './gpu-data.js';

export const MultiSurfaceWebGPUDiagnosticCode = Object.freeze({
  INPUT: 'INPUT', PROFILE: 'PROFILE', BUDGET: 'BUDGET', REPRESENTATION: 'REPRESENTATION',
  UNSUPPORTED: 'UNSUPPORTED', INIT: 'INIT', DEVICE_LOST: 'DEVICE_LOST', RENDER: 'RENDER', STATE: 'STATE', BUSY: 'BUSY',
} as const);
export type MultiSurfaceWebGPUDiagnosticCode = typeof MultiSurfaceWebGPUDiagnosticCode[keyof typeof MultiSurfaceWebGPUDiagnosticCode];
export class MultiSurfaceWebGPUError extends Error {
  constructor(readonly code: MultiSurfaceWebGPUDiagnosticCode, detail: string, ...cause: [] | [unknown]) {
    super(('Multi Surface WebGPU: ' + detail).slice(0, 1024), cause.length ? { cause: cause[0] } : undefined);
    this.name = 'MultiSurfaceWebGPUError';
  }
}
export interface MultiSurfaceWebGPUOptions { readonly width: number; readonly height: number }
export interface MultiSurfaceWebGPULimits {
  readonly maxTextureDimension2D: number; readonly maxBufferSize: number; readonly maxUniformBufferBindingSize: number;
  readonly maxColorAttachments: number; readonly maxColorAttachmentBytesPerSample: number;
  readonly maxVertexBuffers: number; readonly maxVertexAttributes: number; readonly maxBindGroups: number;
  readonly maxVertexBufferArrayStride: number;
}
/** Conservative logical charges, not measured driver memory or depth storage. */
export interface MultiSurfaceWebGPUResources {
  readonly geometryBytes: number; readonly uniformBytes: number; readonly colorIdentityBytes: number;
  readonly depthTexels: number; readonly depthBudgetBytes: number; readonly chargedBytes: number;
  readonly readbackBytes: number; readonly buffers: number; readonly textures: number;
  readonly bindGroups: number; readonly pipelines: number;
}
export interface MultiSurfaceWebGPUStatus {
  readonly backend: 'webgpu'; readonly profile: 'qualified-multiple-surface-wgsl-v0';
  readonly state: 'ready' | 'lost' | 'failed' | 'disposed'; readonly generation: number;
  readonly width: number; readonly height: number; readonly limits: MultiSurfaceWebGPULimits;
  readonly resources: MultiSurfaceWebGPUResources;
}
export interface MultiSurfaceWebGPUPick { readonly generation: number; readonly ref: PrimitiveSceneRef | null }
/** Internal CPU staging, never a public trusted-token input. */
export interface PreparedMultiSurfaceWebGPUFrame {
  readonly frame: PrimitiveSceneCpuFrameV0; readonly width: number; readonly height: number;
  readonly draws: {
    readonly ref: PrimitiveSceneRef; readonly identity: number; readonly wgsl: string;
    readonly positions: Uint8Array; readonly normals: Uint8Array; readonly indices: Uint8Array;
    readonly indexCount: number; readonly frameUniforms: Uint8Array; readonly materialUniforms: Uint8Array;
    readonly material: LoweredMeshMaterialWGSL | null;
  }[];
  readonly resources: MultiSurfaceWebGPUResources;
  readonly background: [number, number, number, number];
}
function check(condition: unknown, code: MultiSurfaceWebGPUDiagnosticCode, detail: string): asserts condition {
  if (!condition) throw new MultiSurfaceWebGPUError(code, detail);
}
function reflect<T>(action: () => T): T {
  try { return action(); } catch (cause) { throw new MultiSurfaceWebGPUError('INPUT', 'Own data reflection refused', cause); }
}
function record(input: unknown, fields: readonly string[]): Record<string, unknown> {
  check(input !== null && typeof input === 'object', 'INPUT', 'Exact own plain data is required');
  check(reflect(() => Object.getPrototypeOf(input)) === Object.prototype, 'INPUT', 'Exact own plain data is required');
  const names = reflect(() => Reflect.ownKeys(input));
  check(names.length === fields.length && names.every(name => typeof name === 'string' && fields.includes(name)),
    'INPUT', 'Fields must exactly match the contract');
  return Object.fromEntries(fields.map(name => {
    const descriptor = reflect(() => Object.getOwnPropertyDescriptor(input, name));
    check(descriptor && 'value' in descriptor && descriptor.enumerable, 'INPUT', 'Fields require own enumerable data');
    return [name, descriptor.value];
  }));
}
export function validateMultiSurfaceWebGPUOptions(input: unknown): MultiSurfaceWebGPUOptions {
  const data = record(input, ['width', 'height']);
  for (const size of [data.width, data.height]) {
    check(typeof size === 'number' && Number.isInteger(size), 'INPUT', 'Dimensions require integer data');
    check(size >= 1 && size <= 1024, 'BUDGET', 'Dimensions exceed1..1024');
  }
  const width = data.width as number, height = data.height as number;
  check(width * height <= 1048576, 'BUDGET', 'Canvas pixel count exceeds1048576');
  return Object.freeze({ width, height });
}
export function validateMultiSurfaceWebGPURef(input: unknown): PrimitiveSceneRef {
  const data = record(input, ['modelId', 'geometryId']);
  for (const value of Object.values(data)) check(typeof value === 'string' && /^[A-Za-z_][A-Za-z0-9_.:-]{0,63}$/.test(value),
    'INPUT', 'Qualified references require ASCII identifiers1..64');
  return Object.freeze({ modelId: data.modelId as string, geometryId: data.geometryId as string });
}
function freezePlain<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !ArrayBuffer.isView(value)) {
    for (const child of Object.values(value)) freezePlain(child);
    Object.freeze(value);
  }
  return value;
}
export function copyMultiSurfaceWebGPUFrame(prepared: PreparedMultiSurfaceWebGPUFrame): PrimitiveSceneCpuFrameV0 {
  return freezePlain(copyGpuData(prepared.frame));
}
export function assertMultiSurfaceWebGPUResidency(accepted: PreparedMultiSurfaceWebGPUFrame | null, candidate: PreparedMultiSurfaceWebGPUFrame): void {
  check(candidate.resources.chargedBytes + (accepted?.resources.chargedBytes ?? 0)
    + Math.max(candidate.resources.readbackBytes, accepted?.resources.readbackBytes ?? 0) <= 67108864,
  'BUDGET', 'Accepted and candidate resource charges plus readback exceed64MiB');
}
function executed(value: number): number {
  const derived = Math.fround(value);
  check(Number.isFinite(value) && Number.isFinite(derived) && (value === 0 || derived !== 0),
    'REPRESENTATION', 'Execution coefficient loses finite nonzero Float32 representation');
  return derived;
}
function setFloat(bytes: Uint8Array, offset: number, value: number): void {
  new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).setFloat32(offset, executed(value), true);
}
function packed(values: Float32Array | Uint16Array): Uint8Array {
  const bytes = new Uint8Array(Math.ceil(values.byteLength / 4) * 4), view = new DataView(bytes.buffer);
  for (let index = 0; index < values.length; index++) {
    if (values instanceof Float32Array) view.setFloat32(index * 4, executed(values[index]), true);
    else view.setUint16(index * 2, values[index], true);
  }
  return bytes;
}
const DEFAULT_DECLARATIONS = 'struct MaterialParams { slot: array<vec4<f32>, 4>, }\n';
function program(material: LoweredMeshMaterialWGSL | null, identity: number): string {
  const declarations = material?.declarations ?? DEFAULT_DECLARATIONS;
  const expression = material?.expression ?? 'pow(frameParams.style.xyz, vec3<f32>(2.2))';
  const code = `struct FrameParams { view: mat4x4<f32>, projection: mat4x4<f32>, light: vec4<f32>, style: vec4<f32>, }
${declarations}
@group(0) @binding(0) var<uniform> frameParams: FrameParams;
@group(0) @binding(1) var<uniform> materialParams: MaterialParams;
struct VertexOutput { @builtin(position) position: vec4<f32>, @location(0) normal: vec3<f32>, }
@vertex fn vertexMain(@location(0) position: vec3<f32>, @location(1) normal: vec3<f32>) -> VertexOutput {
  var output: VertexOutput;
  let clip = frameParams.projection * frameParams.view * vec4<f32>(position, 1.0);
  output.position = vec4<f32>(clip.xy, (clip.z + clip.w) * 0.5, clip.w);
  output.normal = normal; return output;
}
fn material_mix(a: vec3<f32>, b: vec3<f32>, ratio: f32) -> vec3<f32> {
  let t = clamp(ratio, 0.0, 1.0); return a * (1.0 - t) + b * t;
}
struct FragmentOutput { @location(0) color: vec4<f32>, @location(1) identity: u32, }
@fragment fn fragmentMain(input: VertexOutput) -> FragmentOutput {
  let base = ${expression};
  let light = frameParams.style.w + frameParams.light.w * max(dot(normalize(input.normal), frameParams.light.xyz), 0.0);
  var output: FragmentOutput;
  output.color = vec4<f32>(pow(base * light, vec3<f32>(1.0 / 2.2)), 1.0);
  output.identity = ${identity}u; return output;
}
`;
  check(code.length <= 65536 && new TextEncoder().encode(code).length <= 65536, 'BUDGET', 'Complete Surface WGSL exceeds64KiB UTF16 or UTF8');
  return code;
}
/** Exact ordinary projection: repeated source paths are charged every time. */
function projectionBudget(value: { frame: PrimitiveSceneCpuFrameV0; programs: { ref: PrimitiveSceneRef; material: LoweredMeshMaterialWGSL | null; wgsl: string }[] }): void {
  let visits = 0, utf16 = 0, utf8 = 0;
  const encoder = new TextEncoder();
  const append = (chunk: string): void => {
    utf16 += chunk.length; check(utf16 <= 2097152, 'BUDGET', 'Aggregate original frame/programs exceed2MiB UTF16');
    utf8 += encoder.encode(chunk).length; check(utf8 <= 2097152, 'BUDGET', 'Aggregate original frame/programs exceed2MiB UTF8');
  };
  const visit = (item: unknown, depth: number): void => {
    check(++visits <= 262144 && depth <= 48, 'BUDGET', 'Aggregate original frame/program traversal exceeds its work or depth limit');
    if (typeof item === 'number') { check(Number.isFinite(item), 'BUDGET', 'Owned projection requires finite numbers'); append(Object.is(item, -0) ? '-0' : JSON.stringify(item)); return; }
    if (item === null || typeof item === 'string' || typeof item === 'boolean') { append(JSON.stringify(item)); return; }
    check(item && typeof item === 'object' && !ArrayBuffer.isView(item), 'BUDGET', 'Owned projection requires ordinary data');
    if (Array.isArray(item)) { append('['); item.forEach((child, index) => { if (index) append(','); visit(child, depth + 1); }); append(']'); return; }
    append('{'); Object.entries(item).forEach(([name, child], index) => { if (index) append(','); append(JSON.stringify(name)); append(':'); visit(child, depth + 1); }); append('}');
  };
  visit(value, 0);
}

/** Whole original common admission once; no CAD reconstruction, DOM or device. */
export function prepareMultiSurfaceWebGPUFrame(input: unknown, width: number, height: number): PreparedMultiSurfaceWebGPUFrame {
  const options = validateMultiSurfaceWebGPUOptions({ width, height });
  const outer = record(input, ['version', 'scene', 'options', 'particles', 'materials']);
  let admitted: ReturnType<typeof preparePrimitiveSceneFrame>;
  try { admitted = preparePrimitiveSceneFrame(outer, 'qualified-v2'); }
  catch (cause) { throw new MultiSurfaceWebGPUError('INPUT', 'Actual complete native frame admission refused', cause); }
  check(admitted.primitives.length >= 1 && admitted.primitives.length <= 4
    && admitted.primitives.every(primitive => primitive.entry.kind === 'surface')
    && admitted.frame.options.camera !== undefined, 'PROFILE', 'Profile requires1..4 qualified Surfaces and explicit camera');
  const camera = prepareCamera(admitted.frame.options.camera, options.width / options.height);
  const lighting = admitted.frame.options.lighting ?? { direction: [-0.6, 0.8, 1], ambientStrength: 0.35, directionalStrength: 0.65 };
  const maximum = Math.max(...lighting.direction.map(Math.abs)), scaled = lighting.direction.map(value => value / maximum);
  const length = Math.hypot(...scaled), direction = scaled.map(value => value / length);
  const programs = admitted.primitives.map((primitive, index) => {
    let material: LoweredMeshMaterialWGSL | null = null;
    if (primitive.material) {
      try { material = lowerMeshMaterialWGSL(primitive.material.material); }
      catch (cause) {
        const code = cause instanceof MeshMaterialError ? cause.code === 'BUDGET' ? 'BUDGET' : cause.code === 'RANGE' ? 'REPRESENTATION' : 'PROFILE' : 'PROFILE';
        throw new MultiSurfaceWebGPUError(code, 'Actual legacy material WGSL reconstruction refused', cause);
      }
    }
    return { ref: primitive.entry.ref, material, wgsl: program(material, index + 1) };
  });
  projectionBudget({ frame: admitted.frame, programs });
  const frame = freezePlain(copyGpuData(admitted.frame));
  const draws = admitted.primitives.map((primitive, index) => {
    const normals = primitive.normals, indices = primitive.indices;
    check(normals && indices, 'PROFILE', 'Qualified Surfaces require admitted normals and U16 indices');
    const frameUniforms = new Uint8Array(160), materialUniforms = new Uint8Array(64), source = programs[index];
    for (let i = 0; i < 16; i++) { setFloat(frameUniforms, i * 4, camera.view[i]); setFloat(frameUniforms, 64 + i * 4, camera.projection[i]); }
    direction.forEach((value, axis) => setFloat(frameUniforms, 128 + axis * 4, value));
    setFloat(frameUniforms, 140, lighting.directionalStrength);
    primitive.entry.color.forEach((value, axis) => setFloat(frameUniforms, 144 + axis * 4, value));
    setFloat(frameUniforms, 156, lighting.ambientStrength);
    if (source.material) for (const slot of source.material.uniformLayout) {
      const descriptor = reflect(() => Object.getOwnPropertyDescriptor(primitive.material!.uniforms, slot.name));
      check(descriptor && 'value' in descriptor && typeof descriptor.value === 'number' && Number.isFinite(descriptor.value)
        && descriptor.value >= slot.min && descriptor.value <= slot.max, 'PROFILE', 'Resolved uniform requires an own finite declared Number');
      setFloat(materialUniforms, slot.byteOffset, descriptor.value);
    }
    return Object.freeze({ ref: Object.freeze({ ...source.ref }), identity: index + 1, wgsl: source.wgsl,
      positions: packed(primitive.positions), normals: packed(normals), indices: packed(indices), indexCount: indices.length,
      frameUniforms, materialUniforms, material: source.material === null ? null : freezePlain(copyGpuData(source.material)) });
  });
  const pixels = options.width * options.height;
  const geometryBytes = draws.reduce((total, draw) => total + draw.positions.byteLength + draw.normals.byteLength + draw.indices.byteLength, 0);
  const uniformBytes = 224 * draws.length;
  const resources: MultiSurfaceWebGPUResources = Object.freeze({ geometryBytes, uniformBytes, colorIdentityBytes: 8 * pixels,
    depthTexels: pixels, depthBudgetBytes: 4 * pixels, chargedBytes: geometryBytes + uniformBytes + 12 * pixels,
    readbackBytes: Math.ceil(4 * options.width / 256) * 256 * options.height,
    buffers: 5 * draws.length, textures: 3, bindGroups: draws.length, pipelines: draws.length });
  check(resources.chargedBytes <= 33554432, 'BUDGET', 'Candidate logical charges exceed32MiB');
  const background = Object.freeze([...frame.options.background, 1]) as unknown as [number, number, number, number];
  Object.freeze(draws);
  const prepared = Object.freeze({ frame, width: options.width, height: options.height, draws, resources, background });
  assertMultiSurfaceWebGPUResidency(null, prepared); return prepared;
}
