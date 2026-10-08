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

function readAccessor(
  accessorIndex: number, expectedType: 'SCALAR' | 'VEC3' | 'VEC4',
  accessors: unknown[], views: unknown[], declaredBuffers: unknown[], buffers: readonly Uint8Array[],
  path: string,
): number[][] {
  const accessor = record(accessors[index(accessorIndex, accessors.length, path)], path);
  unsupportedExtension(accessor, path);
  if (field(accessor, 'sparse', path) !== undefined || field(accessor, 'normalized', path) === true) {
    fail('UNSUPPORTED', path, 'sparse or normalized accessors are unsupported');
  }
  if (field(accessor, 'componentType', path) !== 5126 || field(accessor, 'type', path) !== expectedType) {
    fail('UNSUPPORTED', path, `expected float32 ${expectedType}`);
  }
  const rawCount = field(accessor, 'count', path);
  if (!Number.isInteger(rawCount) || (rawCount as number) < 1 || (rawCount as number) > 256) {
    fail('LIMIT_EXCEEDED', `${path}.count`, 'expected 1..256 keys');
  }
  const count = rawCount as number;
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
  const components = expectedType === 'SCALAR' ? 1 : expectedType === 'VEC3' ? 3 : 4;
  const size = count * components * 4;
  if ((viewOffset + accessorOffset) % 4 !== 0 || accessorOffset + size > viewLength ||
      viewOffset + viewLength > declaredLength) {
    fail('INVALID_ACCESSOR', path, 'float32 region is misaligned or outside its buffer view');
  }
  const bytes = buffers[bufferIndex];
  const data = new DataView(bytes.buffer, bytes.byteOffset + viewOffset + accessorOffset, size);
  const values: number[][] = [];
  for (let item = 0; item < count; item += 1) {
    const tuple: number[] = [];
    for (let component = 0; component < components; component += 1) {
      const scalar = data.getFloat32((item * components + component) * 4, true);
      if (!Number.isFinite(scalar)) fail('INVALID_ACCESSOR', `${path}[${item}]`, 'nonfinite scalar');
      tuple.push(scalar);
    }
    values.push(tuple);
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

/** Import one bounded glTF 2.0 animation from caller-loaded JSON and binary buffers. */
export function importMotionGltfAnimation(
  gltf: unknown, inputBuffers: readonly Uint8Array[], inputOptions: MotionGltfOptions,
): MotionClip {
  const options = exact(inputOptions, ['animationIndex', 'contextId', 'nodeTargets', 'frame'], 'options');
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
    if (method !== 'STEP' && method !== 'LINEAR') {
      fail('UNSUPPORTED', `${samplerPath}.interpolation`, 'only STEP and LINEAR are supported');
    }
    const input = readAccessor(field(sampler, 'input', samplerPath) as number, 'SCALAR',
      accessors, views, declaredBuffers, buffers as Uint8Array[], `${samplerPath}.input`);
    const output = readAccessor(field(sampler, 'output', samplerPath) as number,
      property === 'rotation' ? 'VEC4' : 'VEC3', accessors, views, declaredBuffers, buffers as Uint8Array[],
      `${samplerPath}.output`);
    if (input.length !== output.length) fail('INVALID_ACCESSOR', samplerPath, 'input/output key counts differ');
    totalKeys += input.length;
    if (totalKeys > 4096) fail('LIMIT_EXCEEDED', 'animation', 'more than 4096 keys');
    const keys = input.map(([timeSeconds], keyIndex) => ({
      timeSeconds,
      value: property === 'translation' ? output[keyIndex].map((component) => component * 1000)
        : property === 'rotation' ? quaternion(output[keyIndex], `${samplerPath}.output[${keyIndex}]`)
          : output[keyIndex],
    }));
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
