import { NativeSurfaceUV01FrameError } from './native-surface-uv01-frame.js';
import type {
  NativeSurfaceUV01FrameRequest, NativeSurfaceUV01FrameDraw, NativeSurfaceUV01FrameResources,
} from './native-surface-uv01-frame.js';
import type { PreparedNativeSurfaceUV01Binding } from './native-surface-uv01-binding.js';
import type { LoweredNativeSurfaceUV01ProgramWGSL } from './native-surface-uv01-program-wgsl.js';
import type { PreparedPrimitiveSceneFrame } from './primitive-frame-preflight.js';
import type { prepareCamera } from './camera.js';

const MAX_BYTES = 2097152;
function reject(code: 'BUDGET' | 'BINDING' | 'REPRESENTATION', message: string): never {
  throw new NativeSurfaceUV01FrameError(code, message);
}

/** Charge every owned path, including typed observations as ordinary numeric arrays.
 * This intentionally does not stringify the aggregate, discount aliases, or copy views.
 */
export function accountNativeSurfaceUV01Aggregate(
  request: NativeSurfaceUV01FrameRequest,
  bindings: readonly PreparedNativeSurfaceUV01Binding[],
  frame: PreparedPrimitiveSceneFrame,
  programs: readonly LoweredNativeSurfaceUV01ProgramWGSL[],
): void {
  const encoder = new TextEncoder(), active = new WeakSet<object>();
  let utf16 = 0, utf8 = 0, visits = 0;
  const append = (chunk: string): void => {
    utf16 += chunk.length;
    if (utf16 > MAX_BYTES) reject('BUDGET', 'Complete native Surface UV01 frame aggregate exceeds2MiB UTF16');
    utf8 += encoder.encode(chunk).length;
    if (utf8 > MAX_BYTES) reject('BUDGET', 'Complete native Surface UV01 frame aggregate exceeds2MiB UTF8');
  };
  const visit = (value: unknown, depth: number): void => {
    if (++visits > 262144 || depth > 48)
      reject('BUDGET', 'Complete native Surface UV01 frame aggregate exceeds262144 visits or depth48');
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) reject('BUDGET', 'Owned frame aggregate requires finite Number data');
      append(Object.is(value, -0) ? '-0' : JSON.stringify(value)); return;
    }
    if (value === null || typeof value === 'string' || typeof value === 'boolean') {
      append(JSON.stringify(value)); return;
    }
    if (typeof value !== 'object' || active.has(value))
      reject('BUDGET', 'Owned frame aggregate requires acyclic data');
    active.add(value);
    if (Array.isArray(value) || value instanceof Float32Array || value instanceof Uint16Array) {
      append('[');
      for (let index = 0; index < value.length; index++) {
        if (index) append(',');
        visit(value[index], depth + 1);
      }
      append(']');
    } else {
      if (ArrayBuffer.isView(value) || Object.getPrototypeOf(value) !== Object.prototype)
        reject('BUDGET', 'Owned frame aggregate has an unsupported observation');
      append('{');
      const keys = Object.keys(value);
      for (let index = 0; index < keys.length; index++) {
        if (index) append(',');
        const key = keys[index];
        append(JSON.stringify(key)); append(':');
        visit((value as Record<string, unknown>)[key], depth + 1);
      }
      append('}');
    }
    active.delete(value);
  };
  // EXACT4 is the accounting envelope, not an additional public result field.
  visit({ request, bindings, frame, programs }, 1);
}

function sameNumbers(left: ArrayLike<number>, right: ArrayLike<number>): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index++) {
    if (!Object.is(left[index], right[index])) return false;
  }
  return true;
}
function represented(value: number): number {
  const result = Math.fround(value);
  if (!Number.isFinite(value) || !Number.isFinite(result) || value !== 0 && result === 0)
    reject('REPRESENTATION', 'Native Surface UV01 upload value must remain finite and nonzero as F32');
  return result;
}
function packF32(values: ArrayLike<number>): Uint8Array {
  const bytes = new Uint8Array(values.length * 4), view = new DataView(bytes.buffer);
  for (let index = 0; index < values.length; index++) view.setFloat32(index * 4, represented(values[index]), true);
  return bytes;
}
function paddedIndexBytes(count: number): number { return Math.ceil(count * 2 / 4) * 4; }
function packIndices(values: Uint16Array): Uint8Array {
  const bytes = new Uint8Array(paddedIndexBytes(values.length)), view = new DataView(bytes.buffer);
  for (let index = 0; index < values.length; index++) view.setUint16(index * 2, values[index], true);
  return bytes;
}

/** Internal join of authenticated producer outputs only; callers cannot submit observations here. */
export function prepareNativeSurfaceUV01PackedDraws(
  request: NativeSurfaceUV01FrameRequest,
  bindings: readonly PreparedNativeSurfaceUV01Binding[],
  frame: PreparedPrimitiveSceneFrame,
  programs: readonly LoweredNativeSurfaceUV01ProgramWGSL[],
  camera: ReturnType<typeof prepareCamera>,
  width: number,
  height: number,
): { draws: NativeSurfaceUV01FrameDraw[]; resources: NativeSurfaceUV01FrameResources } {
  const count = request.entries.length;
  if (count !== bindings.length || count !== frame.primitives.length || count !== programs.length)
    reject('BINDING', 'Authenticated native Surface frame entries must have matching order and count');
  let geometryBytes = 0;
  for (let index = 0; index < count; index++) {
    const binding = bindings[index], geometry = binding.geometry, packet = geometry.preview.packet;
    const primitive = frame.primitives[index], entry = request.entries[index], common = primitive.entry;
    const vertexCount = geometry.request.countU * geometry.request.countV;
    if (common.kind !== 'surface' || common.ref.modelId !== entry.ref.modelId
      || common.ref.geometryId !== entry.ref.geometryId || packet.surfaceId !== entry.ref.geometryId
      || common.packet.surfaceId !== packet.surfaceId || common.packet.revision !== packet.revision
      || packet.revision !== entry.geometry.revision || packet.version !== common.packet.version
      || packet.lengthUnit !== common.packet.lengthUnit || packet.coordinateSystem !== common.packet.coordinateSystem
      || packet.winding !== common.packet.winding
      || !sameNumbers(common.packet.positions, packet.positions) || !sameNumbers(common.packet.normals, packet.normals)
      || !sameNumbers(common.packet.parameters, packet.parameters) || !sameNumbers(common.packet.indices, packet.indices)
      || !sameNumbers(common.packet.bounds.min, packet.bounds.min) || !sameNumbers(common.packet.bounds.max, packet.bounds.max)
      || packet.positions.length !== vertexCount * 3 || packet.normals.length !== vertexCount * 3
      || packet.parameters.length !== vertexCount * 2 || geometry.normalizedParameters.length !== vertexCount * 2
      || geometry.uv01.length !== vertexCount * 2 || primitive.positions.length !== vertexCount * 3
      || !(primitive.normals instanceof Float32Array) || primitive.normals.length !== vertexCount * 3
      || !(primitive.indices instanceof Uint16Array) || !sameNumbers(primitive.indices, packet.indices)
      || packet.indices.length !== (geometry.request.countU - 1) * (geometry.request.countV - 1) * 6)
      reject('BINDING', 'Native Surface UV01 upload must match the authenticated producer and common primitive');
    for (let offset = 0; offset < geometry.uv01.length; offset++) {
      if (!Object.is(geometry.uv01[offset], Math.fround(geometry.normalizedParameters[offset])))
        reject('BINDING', 'Native Surface UV01 upload order differs from authenticated normalized parameters');
    }
    const layout = programs[index].lowered.uniformLayout;
    if (Object.keys(binding.uniforms).length !== layout.length || layout.length !== binding.material.uniforms.length)
      reject('BINDING', 'Resolved native Surface uniforms must match the program source-order layout');
    for (let offset = 0; offset < layout.length; offset++) {
      const slot = layout[offset], declaration = binding.material.uniforms[offset];
      if (slot.index !== offset || slot.byteOffset !== offset * 4 || slot.name !== declaration.name
        || !Object.is(slot.min, declaration.min) || !Object.is(slot.max, declaration.max)
        || !Object.hasOwn(binding.uniforms, slot.name))
        reject('BINDING', 'Resolved native Surface uniforms differ from the program source-order layout');
      const value = binding.uniforms[slot.name];
      if (typeof value !== 'number' || !Number.isFinite(value) || value < slot.min || value > slot.max)
        reject('BINDING', 'Resolved native Surface uniform is missing, nonfinite or outside its declared range');
      represented(value);
    }
    geometryBytes += primitive.positions.length * 4 + primitive.normals.length * 4
      + paddedIndexBytes(primitive.indices.length) + geometry.uv01.length * 4;
  }
  const texels = width * height, uniformBytes = 240 * count;
  const resources: NativeSurfaceUV01FrameResources = {
    geometryBytes, uniformBytes, colorIdentityBytes: 8 * texels, depthTexels: texels,
    depthBudgetBytes: 4 * texels, chargedBytes: geometryBytes + uniformBytes + 12 * texels,
    readbackBytes: Math.ceil(4 * width / 256) * 256 * height,
    buffers: 7 * count, textures: 3, bindGroups: count, pipelines: count,
  };
  if (!Number.isSafeInteger(resources.chargedBytes) || resources.chargedBytes > 32 * 1024 * 1024)
    reject('BUDGET', 'Native Surface UV01 prospective candidate exceeds32MiB logical resources');

  // No packed draw allocation occurs until the complete aggregate and resource
  // charge have passed. Each invocation and each draw gets independent buffers.
  const lighting = request.options.lighting, maximum = Math.max(...lighting.direction.map(Math.abs));
  if (lighting.direction.length !== 3 || !lighting.direction.every(Number.isFinite)
    || !Number.isFinite(maximum) || maximum <= 0)
    reject('REPRESENTATION', 'Native Surface UV01 light direction requires three finite nonzero-vector components');
  const direction = lighting.direction.map(value => {
    const scaled = value / maximum;
    if (value !== 0 && scaled === 0)
      reject('REPRESENTATION', 'Native Surface UV01 light direction underflows during robust normalization');
    return scaled;
  }), magnitude = Math.hypot(...direction);
  const light = direction.map(value => {
    const normalized = value / magnitude;
    if (value !== 0 && normalized === 0)
      reject('REPRESENTATION', 'Native Surface UV01 light direction underflows during robust normalization');
    return represented(normalized);
  });
  represented(lighting.directionalStrength); represented(lighting.ambientStrength);
  if (camera.view.length !== 16 || camera.projection.length !== 16)
    reject('REPRESENTATION', 'Native Surface UV01 frame requires two complete camera matrices');
  const draws: NativeSurfaceUV01FrameDraw[] = [];
  for (let index = 0; index < count; index++) {
    const binding = bindings[index], primitive = frame.primitives[index], program = programs[index];
    const frameBytes = new Uint8Array(160), frameView = new DataView(frameBytes.buffer);
    for (let offset = 0; offset < 16; offset++) {
      frameView.setFloat32(offset * 4, represented(camera.view[offset]), true);
      frameView.setFloat32(64 + offset * 4, represented(camera.projection[offset]), true);
    }
    for (let axis = 0; axis < 3; axis++) frameView.setFloat32(128 + axis * 4, light[axis], true);
    frameView.setFloat32(140, represented(lighting.directionalStrength), true);
    frameView.setFloat32(156, represented(lighting.ambientStrength), true);
    const materialBytes = new Uint8Array(64), materialView = new DataView(materialBytes.buffer);
    for (const slot of program.lowered.uniformLayout)
      materialView.setFloat32(slot.byteOffset, represented(binding.uniforms[slot.name]), true);
    const drawBytes = new Uint8Array(16), identity = index + 1;
    new DataView(drawBytes.buffer).setUint32(0, identity, true);
    draws.push({
      ref: { ...request.entries[index].ref }, identity, program, indexCount: primitive.indices!.length,
      positions: packF32(primitive.positions), normals: packF32(primitive.normals!),
      indices: packIndices(primitive.indices!), uv01: packF32(binding.geometry.uv01),
      uniforms: { frame: frameBytes, material: materialBytes, draw: drawBytes },
    });
  }
  return { draws, resources };
}
