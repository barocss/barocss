import { prepareEngineUVTextureMaterialBindings, EngineUVTextureMaterialBindingsError } from './engine-uv-texture-material-bindings.js';
import type { PreparedEngineUVTextureMaterialBindings, EngineUVTextureMaterialBindingsV0 } from './engine-uv-texture-material-bindings.js';
import type { EngineSceneV0 } from './engine-scene.js';
import type { EngineTextureBindingsV0 } from './engine-texture-bindings.js';
import { lowerEngineUVTextureProgramWGSL } from './engine-uv-texture-program-wgsl.js';
import type { LoweredEngineUVTextureProgramWGSL } from './engine-uv-texture-program-wgsl.js';
import { MeshMaterialError } from './mesh-material.js';
import { prepareCamera } from './camera.js';
import { copyGpuData, freezeGpuData } from './gpu-data.js';

export const EngineUVWebGPUDiagnosticCode = Object.freeze({
  INPUT: 'INPUT', VERSION: 'VERSION', BUDGET: 'BUDGET', REFERENCE: 'REFERENCE',
  UNIFORM: 'UNIFORM', MATERIAL: 'MATERIAL', TEXTURE: 'TEXTURE', SCENE: 'SCENE',
  CAMERA: 'CAMERA', REPRESENTATION: 'REPRESENTATION', UNSUPPORTED: 'UNSUPPORTED',
  INIT: 'INIT', DEVICE_LOST: 'DEVICE_LOST', RENDER: 'RENDER', STATE: 'STATE', BUSY: 'BUSY',
} as const);
export type EngineUVWebGPUDiagnosticCode = typeof EngineUVWebGPUDiagnosticCode[keyof typeof EngineUVWebGPUDiagnosticCode];
export class EngineUVWebGPUError extends Error {
  constructor(readonly code: EngineUVWebGPUDiagnosticCode, detail: string, ...cause: [] | [unknown]) {
    super(('Engine UV WebGPU: ' + detail).slice(0, 1024), cause.length ? { cause: cause[0] } : undefined);
    this.name = 'EngineUVWebGPUError';
  }
}
export interface EngineUVWebGPUOptions { readonly width: number; readonly height: number }
export interface EngineUVWebGPURef { readonly sceneId: string; readonly nodeId: string; readonly geometryId: string }
export interface EngineUVWebGPUOriginals {
  readonly scene: EngineSceneV0;
  readonly textureBindings: EngineTextureBindingsV0;
  readonly materialBindings: EngineUVTextureMaterialBindingsV0;
}
/** Logical charges and counts. Depth charge is not actual depth24plus storage. */
export interface EngineUVWebGPUResources {
  readonly geometryBytes: number; readonly textureBytes: number; readonly uniformBytes: number;
  readonly colorIdentityBytes: number; readonly depthTexels: number; readonly depthBudgetBytes: number;
  readonly chargedBytes: number; readonly readbackBytes: number; readonly buffers: number;
  readonly textures: number; readonly bindGroups: number; readonly pipelines: number;
}
export interface EngineUVWebGPUStatus {
  readonly backend: 'webgpu'; readonly profile: 'engine-opaque-unlit-uv-texture-program-wgsl-v0';
  readonly state: 'ready' | 'lost' | 'failed' | 'disposed'; readonly generation: number;
  readonly width: number; readonly height: number; readonly limits: Record<string, number>;
  readonly resources: EngineUVWebGPUResources;
}
/** Internal owned staging data. No public prepared-input or GPU injection API. */
export interface PreparedEngineUVWebGPUFrame {
  readonly joined: PreparedEngineUVTextureMaterialBindings;
  readonly width: number; readonly height: number; readonly frameUniforms: Uint8Array;
  readonly materials: { materialId: string; textureId: string; program: LoweredEngineUVTextureProgramWGSL; uniforms: Uint8Array }[];
  readonly draws: { ref: EngineUVWebGPURef; materialId: string; geometryId: string; identity: number; uniforms: Uint8Array }[];
  readonly geometries: { geometryId: string; positions: Uint8Array; uvs: Uint8Array; indices: Uint8Array;
    indexFormat: 'uint16' | 'uint32'; indexCount: number }[];
  readonly background: [number, number, number, number]; readonly resources: EngineUVWebGPUResources;
}
function requireValue(value: unknown, code: EngineUVWebGPUDiagnosticCode, detail: string): asserts value {
  if (!value) throw new EngineUVWebGPUError(code, detail);
}
function reflected<T>(action: () => T): T {
  try { return action(); }
  catch (cause) { throw new EngineUVWebGPUError('INPUT', 'Own data reflection refused', cause); }
}
function record(input: unknown, fields: readonly string[]): Record<string, unknown> {
  requireValue(input !== null && typeof input === 'object', 'INPUT', 'Exact plain own data is required');
  requireValue(reflected(() => Object.getPrototypeOf(input)) === Object.prototype, 'INPUT', 'Exact plain own data is required');
  const keys = reflected(() => Reflect.ownKeys(input));
  requireValue(keys.length === fields.length && keys.every(key => typeof key === 'string' && fields.includes(key)),
    'INPUT', 'Fields must exactly match the contract');
  const result: Record<string, unknown> = {};
  for (const key of fields) {
    const descriptor = reflected(() => Object.getOwnPropertyDescriptor(input, key));
    requireValue(descriptor && 'value' in descriptor && descriptor.enumerable, 'INPUT', 'Own enumerable data fields are required');
    result[key] = descriptor.value;
  }
  return result;
}
export function validateEngineUVWebGPUOptions(input: unknown): EngineUVWebGPUOptions {
  const value = record(input, ['width', 'height']);
  for (const size of [value.width, value.height]) {
    requireValue(typeof size === 'number' && Number.isInteger(size), 'INPUT', 'Dimensions require integer data');
    requireValue(size >= 1 && size <= 1024, 'BUDGET', 'Dimensions exceed1..1024');
  }
  const width = value.width as number, height = value.height as number;
  requireValue(width * height <= 1048576, 'BUDGET', 'Pixel work exceeds1048576');
  return Object.freeze({ width, height });
}
export function validateEngineUVWebGPURef(input: unknown): EngineUVWebGPURef {
  const value = record(input, ['sceneId', 'nodeId', 'geometryId']);
  for (const item of Object.values(value)) requireValue(typeof item === 'string'
    && /^[A-Za-z_][A-Za-z0-9_.:-]{0,63}$/.test(item), 'INPUT', 'References require ASCII identifiers1..64');
  return Object.freeze(value) as unknown as EngineUVWebGPURef;
}
function executed(value: number): number {
  const packed = Math.fround(value);
  requireValue(Number.isFinite(packed) && (value === 0 || packed !== 0), 'REPRESENTATION',
    'Coefficients must remain finite and nonzero asFloat32');
  return packed;
}
function matrix(target: Uint8Array, offset: number, values: ArrayLike<number>): void {
  const view = new DataView(target.buffer, target.byteOffset, target.byteLength);
  for (let index = 0; index < 16; index++) view.setFloat32(offset + index * 4, executed(values[index]), true);
}
function packed(values: Float32Array | Uint16Array | Uint32Array): Uint8Array {
  const bytes = new Uint8Array(Math.ceil(values.byteLength / 4) * 4);
  const view = new DataView(bytes.buffer);
  values.forEach((value, index) => {
    if (values instanceof Float32Array) view.setFloat32(index * 4, value, true);
    else if (values instanceof Uint16Array) view.setUint16(index * 2, value, true);
    else view.setUint32(index * 4, value, true);
  });
  return bytes;
}
function encoded(linear: number): number {
  return linear <= .0031308 ? 12.92 * linear : 1.055 * Math.pow(linear, 1 / 2.4) - .055;
}
export function copyEngineUVWebGPUOriginals(frame: PreparedEngineUVWebGPUFrame): EngineUVWebGPUOriginals {
  return freezeGpuData(copyGpuData({ scene: frame.joined.scene.scene,
    textureBindings: frame.joined.textureBindings, materialBindings: frame.joined.materialBindings }));
}
export function assertEngineUVWebGPUResidency(
  accepted: PreparedEngineUVWebGPUFrame | null, candidate: PreparedEngineUVWebGPUFrame,
): void {
  const prior = accepted?.resources;
  requireValue(candidate.resources.chargedBytes + (prior?.chargedBytes ?? 0)
    + Math.max(candidate.resources.readbackBytes, prior?.readbackBytes ?? 0) <= 67108864,
  'BUDGET', 'Accepted and candidate charges plus readback exceed64MiB');
}

/** Snapshot and qualify one original triple synchronously, before device work. */
export function prepareEngineUVWebGPUFrame(
  sceneInput: unknown, textureInput: unknown, materialInput: unknown, width: number, height: number,
): PreparedEngineUVWebGPUFrame {
  validateEngineUVWebGPUOptions({ width, height });
  let joined: PreparedEngineUVTextureMaterialBindings;
  try { joined = prepareEngineUVTextureMaterialBindings(sceneInput, textureInput, materialInput); }
  catch (cause) {
    throw new EngineUVWebGPUError(cause instanceof EngineUVTextureMaterialBindingsError ? cause.code : 'INPUT',
      'Actual original frame admission refused', cause);
  }
  const materialsById = new Map(joined.resolvedBindings.map(entry => [entry.materialId, entry]));
  requireValue(joined.scene.draws.every(draw => materialsById.has(draw.materialId)), 'REFERENCE',
    'Every visible draw requires an authored texture material');
  let units = 0, textBytes = 0;
  const materials = joined.resolvedBindings.map(entry => {
    let program: LoweredEngineUVTextureProgramWGSL;
    try { program = lowerEngineUVTextureProgramWGSL(entry.binding.material); }
    catch (cause) {
      throw new EngineUVWebGPUError(cause instanceof MeshMaterialError && cause.code === 'BUDGET' ? 'BUDGET'
        : cause instanceof MeshMaterialError && cause.code === 'RANGE' ? 'REPRESENTATION' : 'MATERIAL',
      'Actual complete authored program admission refused', cause);
    }
    units += program.code.length; textBytes += new TextEncoder().encode(program.code).length;
    requireValue(units <= 524288 && textBytes <= 524288, 'BUDGET', 'Aggregate complete programs exceed512KiB');
    const uniforms = new Uint8Array(64), view = new DataView(uniforms.buffer);
    for (const slot of program.lowered.uniformLayout)
      view.setFloat32(slot.byteOffset, executed(entry.binding.uniforms[slot.name]), true);
    const sampler = joined.samplerBindings.find(binding => binding.materialId === entry.materialId)!;
    return { materialId: entry.materialId, textureId: sampler.textureId, program, uniforms };
  });
  let camera: ReturnType<typeof prepareCamera>;
  try { camera = prepareCamera(joined.scene.scene.camera, width / height); }
  catch (cause) { throw new EngineUVWebGPUError('CAMERA', 'Actual camera matrices refused', cause); }
  const geometryBytes = joined.scene.geometries.reduce((sum, geometry) => sum + geometry.positions.byteLength
    + geometry.uvs.byteLength + Math.ceil(geometry.indices.byteLength / 4) * 4, 0);
  const uniformBytes = 128 + materials.length * 64 + joined.scene.draws.length * 80;
  const pixelCount = width * height;
  const resources: EngineUVWebGPUResources = Object.freeze({
    geometryBytes, textureBytes: joined.pixelBytes, uniformBytes,
    colorIdentityBytes: pixelCount * 8, depthTexels: pixelCount, depthBudgetBytes: pixelCount * 4,
    chargedBytes: geometryBytes + joined.pixelBytes + uniformBytes + pixelCount * 12,
    readbackBytes: Math.ceil(width * 4 / 256) * 256 * height,
    buffers: joined.scene.geometries.length * 3 + 1 + materials.length + joined.scene.draws.length,
    textures: joined.textures.length + 3, bindGroups: materials.length * 2 + joined.scene.draws.length,
    pipelines: materials.length,
  });
  requireValue(resources.chargedBytes <= 33554432, 'BUDGET', 'Candidate logical resource charges exceed32MiB');
  const frameUniforms = new Uint8Array(128);
  matrix(frameUniforms, 0, camera.view); matrix(frameUniforms, 64, camera.projection);
  const geometries = joined.scene.geometries.map(geometry => ({ geometryId: geometry.geometry.id,
    positions: packed(geometry.positions), uvs: packed(geometry.uvs), indices: packed(geometry.indices),
    indexFormat: geometry.indexType, indexCount: geometry.indices.length }));
  const draws = joined.scene.draws.map((draw, index) => {
    const identity = index + 1, uniforms = new Uint8Array(80);
    matrix(uniforms, 0, draw.node.worldMatrixF32);
    new DataView(uniforms.buffer).setUint32(64, identity, true);
    const ref = Object.freeze({ sceneId: joined.scene.scene.id, nodeId: draw.id, geometryId: draw.geometryId });
    return { ref, materialId: draw.materialId, geometryId: draw.geometryId, identity, uniforms };
  });
  const color = joined.scene.scene.background.map(encoded);
  const frame = Object.freeze({ joined, width, height, frameUniforms, materials, geometries, draws,
    background: [color[0], color[1], color[2], 1] as [number, number, number, number], resources });
  assertEngineUVWebGPUResidency(null, frame);
  return frame;
}
