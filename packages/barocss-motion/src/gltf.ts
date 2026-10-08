import { createMotionClip, type MotionClip, type MotionInterpolation, type MotionProperty } from './index.js';

export type MotionGltfErrorCode =
  'INVALID_INPUT' | 'UNSUPPORTED' | 'LIMIT_EXCEEDED' | 'INVALID_ACCESSOR' | 'INVALID_CLIP';

export class MotionGltfError extends Error {
  readonly code: MotionGltfErrorCode;

  constructor(code: MotionGltfErrorCode, message: string) {
    super(`${code}: ${message}`);
    this.name = 'MotionGltfError';
    this.code = code;
  }
}

export interface MotionGltfNodeTarget {
  readonly nodeIndex: number;
  readonly targetId: string;
}

export interface MotionGltfOptions {
  readonly animationIndex: number;
  readonly contextId: string;
  readonly nodeTargets: readonly MotionGltfNodeTarget[];
  readonly frame: 'gltf-y-up-as-part-xyz';
}

export interface MotionGltfBakeOptions extends MotionGltfOptions {
  readonly subdivisionsPerInterval: number;
}

const MAX_BYTES = 1_048_576;
const MAX_SOURCE_ITEMS = 4096;

function fail(code: MotionGltfErrorCode, path: string, reason: string): never {
  throw new MotionGltfError(code, `${path}: ${reason}`);
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail('INVALID_INPUT', path, 'expected a plain object');
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) fail('INVALID_INPUT', path, 'expected a plain object');
  return value as Record<string, unknown>;
}

function field(source: Record<string, unknown>, key: string, path: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(source, key);
  if (!descriptor) return undefined;
  if (!('value' in descriptor)) fail('INVALID_INPUT', `${path}.${key}`, 'accessors are unsupported');
  return descriptor.value;
}

function exact(value: unknown, names: readonly string[], path: string): Record<string, unknown> {
  const source = record(value, path);
  const keys = Reflect.ownKeys(source);
  if (keys.length !== names.length || keys.some((key) => typeof key !== 'string' || !names.includes(key))) {
    fail('INVALID_INPUT', path, 'fields differ from the contract');
  }
  const copy: Record<string, unknown> = Object.create(null);
  for (const key of names) copy[key] = field(source, key, path);
  return copy;
}

function array(value: unknown, max: number, path: string): unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
    fail('INVALID_INPUT', path, 'expected an array');
  }
  if (value.length > max) fail('LIMIT_EXCEEDED', path, `more than ${max} items`);
  const result: unknown[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !('value' in descriptor)) fail('INVALID_INPUT', `${path}[${index}]`, 'expected a data element');
    result.push(descriptor.value);
  }
  return result;
}

function index(value: unknown, count: number, path: string): number {
  if (!Number.isInteger(value) || (value as number) < 0 || (value as number) >= count) {
    fail('INVALID_INPUT', path, 'index is outside the source array');
  }
  return value as number;
}

function byteCount(value: unknown, maximum: number, path: string): number {
  if (!Number.isInteger(value) || (value as number) < 0 || (value as number) > maximum) {
    fail('INVALID_ACCESSOR', path, 'invalid byte count or offset');
  }
  return value as number;
}

function unsupportedExtension(source: Record<string, unknown>, path: string): void {
  if (field(source, 'extensions', path) !== undefined) fail('UNSUPPORTED', path, 'animation extensions are unsupported');
}

function sparseRecord(value: unknown, path: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail('INVALID_ACCESSOR', path, 'expected a sparse record');
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) fail('INVALID_ACCESSOR', path, 'expected a sparse record');
  return value as Record<string, unknown>;
}

function readSparseRegion(
  entry: Record<string, unknown>, views: unknown[], declaredBuffers: unknown[],
  buffers: readonly Uint8Array[], length: number, alignment: number, path: string,
): DataView {
  unsupportedExtension(entry, path);
  const rawViewIndex = field(entry, 'bufferView', path);
  if (!Number.isInteger(rawViewIndex) || (rawViewIndex as number) < 0 || (rawViewIndex as number) >= views.length) {
    fail('INVALID_ACCESSOR', `${path}.bufferView`, 'index is outside the source array');
  }
  const viewIndex = rawViewIndex as number;
  const viewPath = `bufferViews[${viewIndex}]`;
  const view = sparseRecord(views[viewIndex], viewPath);
  unsupportedExtension(view, viewPath);
  if (field(view, 'byteStride', viewPath) !== undefined || field(view, 'target', viewPath) !== undefined) {
    fail('UNSUPPORTED', viewPath, 'sparse view stride or target is unsupported');
  }
  const rawBufferIndex = field(view, 'buffer', viewPath);
  if (!Number.isInteger(rawBufferIndex) || (rawBufferIndex as number) < 0 || (rawBufferIndex as number) >= buffers.length) {
    fail('INVALID_ACCESSOR', `${viewPath}.buffer`, 'index is outside the supplied buffers');
  }
  const bufferIndex = rawBufferIndex as number;
  const declared = record(declaredBuffers[bufferIndex], `buffers[${bufferIndex}]`);
  const declaredLength = byteCount(field(declared, 'byteLength', `buffers[${bufferIndex}]`), MAX_BYTES,
    `buffers[${bufferIndex}].byteLength`);
  if (declaredLength !== buffers[bufferIndex].byteLength) {
    fail('INVALID_ACCESSOR', `buffers[${bufferIndex}]`, 'supplied byte length differs from glTF');
  }
  const viewOffset = byteCount(field(view, 'byteOffset', viewPath) ?? 0, declaredLength, `${viewPath}.byteOffset`);
  const viewLength = byteCount(field(view, 'byteLength', viewPath), declaredLength, `${viewPath}.byteLength`);
  const entryOffset = byteCount(field(entry, 'byteOffset', path) ?? 0, viewLength, `${path}.byteOffset`);
  if (viewOffset % alignment !== 0 || entryOffset % alignment !== 0 ||
      entryOffset + length > viewLength || viewOffset + viewLength > declaredLength) {
    fail('INVALID_ACCESSOR', path, 'sparse region is misaligned or outside its buffer view');
  }
  const bytes = buffers[bufferIndex];
  return new DataView(bytes.buffer, bytes.byteOffset + viewOffset + entryOffset, length);
}

function readAccessor(
  accessorIndex: number, expectedType: 'SCALAR' | 'VEC3' | 'VEC4',
  accessors: unknown[], views: unknown[], declaredBuffers: unknown[], buffers: readonly Uint8Array[],
  path: string, maximum = 256,
): number[][] {
  const accessor = record(accessors[index(accessorIndex, accessors.length, path)], path);
  unsupportedExtension(accessor, path);
  if (field(accessor, 'normalized', path) === true) fail('UNSUPPORTED', path, 'normalized accessors are unsupported');
  if (field(accessor, 'componentType', path) !== 5126 || field(accessor, 'type', path) !== expectedType) {
    fail('UNSUPPORTED', path, `expected float32 ${expectedType}`);
  }
  const rawCount = field(accessor, 'count', path);
  if (!Number.isInteger(rawCount) || (rawCount as number) < 1 || (rawCount as number) > maximum) {
    fail('LIMIT_EXCEEDED', `${path}.count`, `expected 1..${maximum} values`);
  }
  const count = rawCount as number;
  const components = expectedType === 'SCALAR' ? 1 : expectedType === 'VEC3' ? 3 : 4;
  const size = count * components * 4;
  const sparseField = field(accessor, 'sparse', path);
  const hasBase = field(accessor, 'bufferView', path) !== undefined;
  if (!hasBase && sparseField === undefined) index(undefined, views.length, `${path}.bufferView`);
  if (!hasBase && field(accessor, 'byteOffset', path) !== undefined) {
    fail('INVALID_ACCESSOR', `${path}.byteOffset`, 'base offset requires a buffer view');
  }
  const values: number[][] = Array.from({ length: count }, () => Array<number>(components).fill(0));
  if (hasBase) {
    const viewIndex = index(field(accessor, 'bufferView', path), views.length, `${path}.bufferView`);
    const viewPath = `bufferViews[${viewIndex}]`;
    const view = record(views[viewIndex], viewPath);
    unsupportedExtension(view, viewPath);
    if (field(view, 'byteStride', viewPath) !== undefined) fail('UNSUPPORTED', viewPath, 'strided accessors are unsupported');
    const bufferIndex = index(field(view, 'buffer', viewPath), buffers.length, `${viewPath}.buffer`);
    const declared = record(declaredBuffers[bufferIndex], `buffers[${bufferIndex}]`);
    const declaredLength = byteCount(field(declared, 'byteLength', `buffers[${bufferIndex}]`), MAX_BYTES,
      `buffers[${bufferIndex}].byteLength`);
    if (declaredLength !== buffers[bufferIndex].byteLength) {
      fail('INVALID_ACCESSOR', `buffers[${bufferIndex}]`, 'supplied byte length differs from glTF');
    }
    const viewOffset = byteCount(field(view, 'byteOffset', viewPath) ?? 0, declaredLength, `${viewPath}.byteOffset`);
    const viewLength = byteCount(field(view, 'byteLength', viewPath), declaredLength, `${viewPath}.byteLength`);
    const accessorOffset = byteCount(field(accessor, 'byteOffset', path) ?? 0, viewLength, `${path}.byteOffset`);
    if ((viewOffset + accessorOffset) % 4 !== 0 || accessorOffset + size > viewLength ||
        viewOffset + viewLength > declaredLength) {
      fail('INVALID_ACCESSOR', path, 'float32 region is misaligned or outside its buffer view');
    }
    const bytes = buffers[bufferIndex];
    const data = new DataView(bytes.buffer, bytes.byteOffset + viewOffset + accessorOffset, size);
    for (let item = 0; item < count; item += 1) {
      for (let component = 0; component < components; component += 1) {
        values[item][component] = data.getFloat32((item * components + component) * 4, true);
      }
    }
  }
  if (sparseField !== undefined) {
    const sparse = sparseRecord(sparseField, `${path}.sparse`);
    unsupportedExtension(sparse, `${path}.sparse`);
    const rawSparseCount = field(sparse, 'count', `${path}.sparse`);
    if (!Number.isInteger(rawSparseCount) || (rawSparseCount as number) < 1 || (rawSparseCount as number) > count) {
      fail('INVALID_ACCESSOR', `${path}.sparse.count`, 'expected 1..accessor count');
    }
    const sparseCount = rawSparseCount as number;
    const indices = sparseRecord(field(sparse, 'indices', `${path}.sparse`), `${path}.sparse.indices`);
    const componentType = field(indices, 'componentType', `${path}.sparse.indices`);
    const indexSize = componentType === 5121 ? 1 : componentType === 5123 ? 2 : componentType === 5125 ? 4 : 0;
    if (indexSize === 0) fail('INVALID_ACCESSOR', `${path}.sparse.indices.componentType`, 'expected unsigned index type');
    const indexData = readSparseRegion(indices, views, declaredBuffers, buffers,
      sparseCount * indexSize, indexSize, `${path}.sparse.indices`);
    const replacement = sparseRecord(field(sparse, 'values', `${path}.sparse`), `${path}.sparse.values`);
    const replacementData = readSparseRegion(replacement, views, declaredBuffers, buffers,
      sparseCount * components * 4, 4, `${path}.sparse.values`);
    let previous = -1;
    for (let item = 0; item < sparseCount; item += 1) {
      const sparseIndex = indexSize === 1 ? indexData.getUint8(item) :
        indexSize === 2 ? indexData.getUint16(item * 2, true) : indexData.getUint32(item * 4, true);
      if (sparseIndex <= previous || sparseIndex >= count) {
        fail('INVALID_ACCESSOR', `${path}.sparse.indices[${item}]`, 'indices must strictly increase within accessor count');
      }
      previous = sparseIndex;
      for (let component = 0; component < components; component += 1) {
        values[sparseIndex][component] = replacementData.getFloat32((item * components + component) * 4, true);
      }
    }
  }
  for (let item = 0; item < count; item += 1) {
    if (values[item].some((scalar) => !Number.isFinite(scalar))) {
      fail('INVALID_ACCESSOR', `${path}[${item}]`, 'nonfinite scalar');
    }
  }
  return values;
}

function quaternion(value: number[], path: string): number[] {
  const norm = Math.hypot(...value);
  if (!Number.isFinite(norm) || norm === 0 || Math.abs(norm - 1) > 0.001) {
    fail('INVALID_CLIP', path, 'rotation is farther than 0.001 from unit norm');
  }
  return Math.abs(norm - 1) <= 1e-9 ? value : value.map((component) => component / norm);
}

function endpoint(value: number[], property: MotionProperty, path: string): number[] {
  if (property === 'translation') return value.map((component) => component * 1000);
  if (property === 'rotation') return quaternion(value, path);
  return value;
}

function cubicValue(
  left: number[], leftOut: number[], right: number[], rightIn: number[],
  fraction: number, deltaSeconds: number, property: MotionProperty, path: string,
): number[] {
  const squared = fraction * fraction;
  const cubed = squared * fraction;
  const leftWeight = 2 * cubed - 3 * squared + 1;
  const outWeight = deltaSeconds * (cubed - 2 * squared + fraction);
  const rightWeight = -2 * cubed + 3 * squared;
  const inWeight = deltaSeconds * (cubed - squared);
  const value = left.map((component, index) =>
    leftWeight * component + outWeight * leftOut[index] +
    rightWeight * right[index] + inWeight * rightIn[index]);
  if (value.some((component) => !Number.isFinite(component))) {
    fail('INVALID_CLIP', path, 'nonfinite cubic result');
  }
  if (property === 'rotation') {
    const norm = Math.hypot(...value);
    if (!Number.isFinite(norm) || norm === 0) fail('INVALID_CLIP', path, 'invalid cubic quaternion');
    return value.map((component) => component / norm);
  }
  return property === 'translation' ? value.map((component) => component * 1000) : value;
}

function cubicKeys(
  input: number[][], output: number[][], subdivisions: number, property: MotionProperty, path: string,
): Array<{ timeSeconds: number; value: number[] }> {
  if (input.length < 2 || output.length !== input.length * 3) {
    fail('INVALID_ACCESSOR', path, 'cubic output needs three records per input and at least two keys');
  }
  const outputCount = 1 + (input.length - 1) * subdivisions;
  if (outputCount > 256) fail('LIMIT_EXCEEDED', path, 'bake exceeds 256 output keys');
  const keys = [{ timeSeconds: input[0][0], value: endpoint(output[1], property, `${path}.output[1]`) }];
  for (let interval = 0; interval < input.length - 1; interval += 1) {
    const start = input[interval][0];
    const end = input[interval + 1][0];
    if (start < 0 || !Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      fail('INVALID_CLIP', `${path}.input[${interval}]`, 'key times must strictly increase from zero');
    }
    const delta = end - start;
    for (let step = 1; step <= subdivisions; step += 1) {
      const timeSeconds = step === subdivisions ? end : start + delta * (step / subdivisions);
      const value = step === subdivisions
        ? endpoint(output[3 * (interval + 1) + 1], property, `${path}.output[${3 * (interval + 1) + 1}]`)
        : cubicValue(output[3 * interval + 1], output[3 * interval + 2],
          output[3 * (interval + 1) + 1], output[3 * (interval + 1)],
          step / subdivisions, delta, property, `${path}.interval[${interval}]`);
      keys.push({ timeSeconds, value });
    }
  }
  return keys;
}

function importAnimation(
  gltf: unknown, inputBuffers: readonly Uint8Array[], inputOptions: MotionGltfOptions | MotionGltfBakeOptions,
  bake: boolean,
): MotionClip {
  const optionNames = bake
    ? ['animationIndex', 'contextId', 'nodeTargets', 'frame', 'subdivisionsPerInterval']
    : ['animationIndex', 'contextId', 'nodeTargets', 'frame'];
  const options = exact(inputOptions, optionNames, 'options');
  const subdivisions = options.subdivisionsPerInterval;
  if (bake && (!Number.isInteger(subdivisions) || (subdivisions as number) < 1 || (subdivisions as number) > 16)) {
    fail('INVALID_INPUT', 'options.subdivisionsPerInterval', 'expected integer 1..16');
  }
  if (options.frame !== 'gltf-y-up-as-part-xyz') {
    fail('UNSUPPORTED', 'options.frame', 'explicit glTF axis preservation is required');
  }
  const source = record(gltf, 'gltf');
  const asset = record(field(source, 'asset', 'gltf'), 'gltf.asset');
  if (field(asset, 'version', 'gltf.asset') !== '2.0') fail('UNSUPPORTED', 'gltf.asset.version', 'expected glTF 2.0');
  if (field(source, 'extensionsRequired', 'gltf') !== undefined &&
      array(field(source, 'extensionsRequired', 'gltf'), MAX_SOURCE_ITEMS, 'gltf.extensionsRequired').length > 0) {
    fail('UNSUPPORTED', 'gltf.extensionsRequired', 'required extensions are unsupported');
  }
  if (field(source, 'skins', 'gltf') !== undefined) fail('UNSUPPORTED', 'gltf.skins', 'skin animation is unsupported');
  const nodes = array(field(source, 'nodes', 'gltf'), MAX_SOURCE_ITEMS, 'gltf.nodes');
  const animations = array(field(source, 'animations', 'gltf'), MAX_SOURCE_ITEMS, 'gltf.animations');
  const animationIndex = index(options.animationIndex, animations.length, 'options.animationIndex');
  const animation = record(animations[animationIndex], `gltf.animations[${animationIndex}]`);
  unsupportedExtension(animation, `gltf.animations[${animationIndex}]`);
  const samplers = array(field(animation, 'samplers', 'animation'), 192, 'animation.samplers');
  const channels = array(field(animation, 'channels', 'animation'), 192, 'animation.channels');
  if (channels.length === 0) fail('INVALID_INPUT', 'animation.channels', 'expected at least one channel');
  const declaredBuffers = array(field(source, 'buffers', 'gltf'), 16, 'gltf.buffers');
  const buffers = array(inputBuffers, 16, 'buffers');
  if (buffers.length !== declaredBuffers.length) fail('INVALID_INPUT', 'buffers', 'count differs from glTF');
  let totalBytes = 0;
  for (const [bufferIndex, value] of buffers.entries()) {
    if (!(value instanceof Uint8Array)) fail('INVALID_INPUT', `buffers[${bufferIndex}]`, 'expected Uint8Array');
    totalBytes += value.byteLength;
    if (totalBytes > MAX_BYTES) fail('LIMIT_EXCEEDED', 'buffers', 'more than 1 MiB supplied');
  }
  const views = array(field(source, 'bufferViews', 'gltf'), MAX_SOURCE_ITEMS, 'gltf.bufferViews');
  const accessors = array(field(source, 'accessors', 'gltf'), MAX_SOURCE_ITEMS, 'gltf.accessors');
  const mappings = array(options.nodeTargets, 64, 'options.nodeTargets');
  const targets = new Map<number, string>();
  const usedIds = new Set<string>();
  for (const [mappingIndex, item] of mappings.entries()) {
    const mapping = exact(item, ['nodeIndex', 'targetId'], `options.nodeTargets[${mappingIndex}]`);
    const nodeIndex = index(mapping.nodeIndex, nodes.length, `options.nodeTargets[${mappingIndex}].nodeIndex`);
    if (typeof mapping.targetId !== 'string' || targets.has(nodeIndex) || usedIds.has(mapping.targetId)) {
      fail('INVALID_INPUT', `options.nodeTargets[${mappingIndex}]`, 'target mapping must be unique');
    }
    targets.set(nodeIndex, mapping.targetId);
    usedIds.add(mapping.targetId);
  }

  const usedNodes = new Set<number>();
  const usedPairs = new Set<string>();
  const tracks: Array<{ targetId: string; property: MotionProperty; interpolation: MotionInterpolation;
    keys: Array<{ timeSeconds: number; value: number[] }> }> = [];
  let durationSeconds = 0;
  let totalKeys = 0;
  for (const [channelIndex, item] of channels.entries()) {
    const path = `animation.channels[${channelIndex}]`;
    const channel = record(item, path);
    unsupportedExtension(channel, path);
    const target = record(field(channel, 'target', path), `${path}.target`);
    unsupportedExtension(target, `${path}.target`);
    const nodeIndex = index(field(target, 'node', `${path}.target`), nodes.length, `${path}.target.node`);
    const property = field(target, 'path', `${path}.target`);
    if (property !== 'translation' && property !== 'rotation' && property !== 'scale') {
      fail('UNSUPPORTED', `${path}.target.path`, 'only node TRS channels are supported');
    }
    const node = record(nodes[nodeIndex], `gltf.nodes[${nodeIndex}]`);
    if (field(node, 'matrix', `gltf.nodes[${nodeIndex}]`) !== undefined) {
      fail('UNSUPPORTED', `gltf.nodes[${nodeIndex}].matrix`, 'animated matrix nodes are unsupported');
    }
    const targetId = targets.get(nodeIndex);
    if (!targetId) fail('INVALID_INPUT', `${path}.target.node`, 'missing exact target mapping');
    usedNodes.add(nodeIndex);
    const pair = `${nodeIndex}\0${property}`;
    if (usedPairs.has(pair)) fail('INVALID_INPUT', path, 'duplicate node/property channel');
    usedPairs.add(pair);
    const samplerIndex = index(field(channel, 'sampler', path), samplers.length, `${path}.sampler`);
    const samplerPath = `animation.samplers[${samplerIndex}]`;
    const sampler = record(samplers[samplerIndex], samplerPath);
    unsupportedExtension(sampler, samplerPath);
    const method = field(sampler, 'interpolation', samplerPath) ?? 'LINEAR';
    if (method !== 'STEP' && method !== 'LINEAR' && !(bake && method === 'CUBICSPLINE')) {
      fail('UNSUPPORTED', `${samplerPath}.interpolation`, 'interpolation is outside this API profile');
    }
    const input = readAccessor(field(sampler, 'input', samplerPath) as number, 'SCALAR',
      accessors, views, declaredBuffers, buffers as Uint8Array[], `${samplerPath}.input`);
    const output = readAccessor(field(sampler, 'output', samplerPath) as number,
      property === 'rotation' ? 'VEC4' : 'VEC3', accessors, views, declaredBuffers, buffers as Uint8Array[],
      `${samplerPath}.output`, method === 'CUBICSPLINE' ? 768 : 256);
    if (method !== 'CUBICSPLINE' && input.length !== output.length) {
      fail('INVALID_ACCESSOR', samplerPath, 'input/output key counts differ');
    }
    const keys = method === 'CUBICSPLINE'
      ? cubicKeys(input, output, subdivisions as number, property, samplerPath)
      : input.map(([timeSeconds], keyIndex) => ({
        timeSeconds, value: endpoint(output[keyIndex], property, `${samplerPath}.output[${keyIndex}]`),
      }));
    totalKeys += keys.length;
    if (totalKeys > 4096) fail('LIMIT_EXCEEDED', 'animation', 'more than 4096 output keys');
    durationSeconds = Math.max(durationSeconds, keys[keys.length - 1].timeSeconds);
    tracks.push({ targetId, property, interpolation: method === 'STEP' ? 'STEP' : property === 'rotation' ? 'SLERP' : 'LINEAR', keys });
  }
  if (usedNodes.size !== targets.size) fail('INVALID_INPUT', 'options.nodeTargets', 'unused target mapping');
  try {
    return createMotionClip({ version: 0, contextId: options.contextId, durationSeconds, tracks });
  } catch {
    fail('INVALID_CLIP', 'animation', 'converted keys exceed the v0 Motion clip contract');
  }
}

/** Import STEP/LINEAR channels without changing the v0 glTF contract. */
export function importMotionGltfAnimation(
  gltf: unknown, inputBuffers: readonly Uint8Array[], inputOptions: MotionGltfOptions,
): MotionClip {
  return importAnimation(gltf, inputBuffers, inputOptions, false);
}

/** Bake selected glTF CUBICSPLINE channels onto a caller-chosen finite v0 key grid. */
export function bakeMotionGltfAnimation(
  gltf: unknown, inputBuffers: readonly Uint8Array[], inputOptions: MotionGltfBakeOptions,
): MotionClip {
  return importAnimation(gltf, inputBuffers, inputOptions, true);
}
