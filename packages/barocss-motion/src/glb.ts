import { bakeMotionGltfAnimation, importMotionGltfAnimation, MotionGltfError, type MotionGltfBakeOptions, type MotionGltfErrorCode, type MotionGltfOptions } from './gltf.js';
import type { MotionClip } from './index.js';

declare const TextDecoder: {
  new (label: string, options: { fatal: boolean }): { decode(input: Uint8Array): string };
};

const MAX_JSON_BYTES = 65_536;
const MAX_BIN_BYTES = 1_048_576;
const MAX_GLB_BYTES = 1_114_144;
const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;

export interface MotionGlbAnimationChannel {
  readonly nodeIndex: number;
  readonly path: 'translation' | 'rotation' | 'scale' | 'weights';
  readonly interpolation: 'STEP' | 'LINEAR' | 'CUBICSPLINE';
}

export interface MotionGlbAnimationSummary {
  readonly animationIndex: number;
  readonly name: string | null;
  readonly channels: readonly MotionGlbAnimationChannel[];
}

function fail(code: MotionGltfErrorCode, path: string, reason: string): never {
  throw new MotionGltfError(code, `${path}: ${reason}`);
}

function readChunk(view: DataView, offset: number, path: string): { type: number; start: number; end: number; length: number } {
  if (offset > view.byteLength - 8) fail('INVALID_INPUT', path, 'truncated chunk header');
  const length = view.getUint32(offset, true);
  const type = view.getUint32(offset + 4, true);
  if (length % 4 !== 0 || length > view.byteLength - offset - 8) {
    fail('INVALID_INPUT', path, 'chunk is unaligned or outside the GLB');
  }
  return { type, start: offset + 8, end: offset + 8 + length, length };
}

function metadataRecord(value: unknown, path: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail('INVALID_INPUT', path, 'expected a record');
  }
  return value as Record<string, unknown>;
}

function metadataArray(value: unknown, maximum: number, path: string): unknown[] {
  if (!Array.isArray(value)) fail('INVALID_INPUT', path, 'expected an array');
  if (value.length > maximum) fail('LIMIT_EXCEEDED', path, `more than ${maximum} items`);
  return value;
}

function metadataIndex(value: unknown, length: number, path: string): number {
  if (!Number.isInteger(value) || (value as number) < 0 || (value as number) >= length) {
    fail('INVALID_INPUT', path, 'index is outside the source array');
  }
  return value as number;
}

function noMetadataExtension(value: Record<string, unknown>, path: string): void {
  if (Object.hasOwn(value, 'extensions')) fail('UNSUPPORTED', `${path}.extensions`, 'metadata extensions are unsupported');
}

function decodeMotionGlb(bytes: Uint8Array): { gltf: Record<string, unknown>; binary: Uint8Array } {
  if (!(bytes instanceof Uint8Array)) fail('INVALID_INPUT', 'glb', 'expected Uint8Array');
  if (bytes.byteLength > MAX_GLB_BYTES) fail('LIMIT_EXCEEDED', 'glb', 'more than 1114144 bytes');
  if (bytes.byteLength < 28 || bytes.byteLength % 4 !== 0) {
    fail('INVALID_INPUT', 'glb', 'invalid GLB length or alignment');
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== 0x46546c67) fail('INVALID_INPUT', 'glb.magic', 'expected glTF');
  if (view.getUint32(4, true) !== 2) fail('UNSUPPORTED', 'glb.version', 'expected GLB v2');
  if (view.getUint32(8, true) !== bytes.byteLength) fail('INVALID_INPUT', 'glb.length', 'header length differs from supplied bytes');

  const jsonChunk = readChunk(view, 12, 'glb.JSON');
  if (jsonChunk.type !== JSON_CHUNK) fail('INVALID_INPUT', 'glb.JSON', 'first chunk must be JSON');
  if (jsonChunk.length > MAX_JSON_BYTES) fail('LIMIT_EXCEEDED', 'glb.JSON', 'more than 64 KiB');
  if (typeof TextDecoder !== 'function') fail('UNSUPPORTED', 'glb.JSON', 'strict UTF-8 decoder unavailable');
  let parsed: unknown;
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(jsonChunk.start, jsonChunk.end));
    parsed = JSON.parse(text);
  } catch {
    fail('INVALID_INPUT', 'glb.JSON', 'invalid UTF-8 or JSON');
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    fail('INVALID_INPUT', 'glb.JSON', 'expected a glTF object');
  }
  const gltf = parsed as Record<string, unknown>;
  if (!Array.isArray(gltf.buffers) || gltf.buffers.length !== 1) {
    fail('UNSUPPORTED', 'glb.JSON.buffers', 'exactly one embedded buffer is required');
  }
  const declared = gltf.buffers[0];
  if (declared === null || typeof declared !== 'object' || Array.isArray(declared)) {
    fail('INVALID_INPUT', 'glb.JSON.buffers[0]', 'expected a buffer record');
  }
  const buffer = declared as Record<string, unknown>;
  if (Object.hasOwn(buffer, 'uri')) fail('UNSUPPORTED', 'glb.JSON.buffers[0].uri', 'external buffers are unsupported');
  if (!Number.isInteger(buffer.byteLength) || (buffer.byteLength as number) < 0) {
    fail('INVALID_ACCESSOR', 'glb.JSON.buffers[0].byteLength', 'invalid byte length');
  }
  const declaredLength = buffer.byteLength as number;
  if (declaredLength > MAX_BIN_BYTES) fail('LIMIT_EXCEEDED', 'glb.BIN', 'more than 1 MiB');

  const binChunk = readChunk(view, jsonChunk.end, 'glb.BIN');
  if (binChunk.type !== BIN_CHUNK) fail('UNSUPPORTED', 'glb.BIN', 'second chunk must be BIN');
  if (binChunk.length > MAX_BIN_BYTES + 3) fail('LIMIT_EXCEEDED', 'glb.BIN', 'more than 1 MiB plus padding');
  const padding = binChunk.length - declaredLength;
  if (padding < 0 || padding > 3) fail('INVALID_ACCESSOR', 'glb.BIN', 'length differs from declared buffer');
  for (let offset = binChunk.end - padding; offset < binChunk.end; offset += 1) {
    if (bytes[offset] !== 0) fail('INVALID_ACCESSOR', 'glb.BIN', 'nonzero padding byte');
  }
  let offset = binChunk.end;
  while (offset < bytes.byteLength) {
    const later = readChunk(view, offset, 'glb.extensionChunk');
    if (later.type === JSON_CHUNK || later.type === BIN_CHUNK) {
      fail('INVALID_INPUT', 'glb.extensionChunk', 'duplicate known chunk');
    }
    offset = later.end;
  }
  const binary = bytes.subarray(binChunk.start, binChunk.start + declaredLength);
  return { gltf, binary };
}

/** Import one selected animation from a bounded, caller-loaded GLB v2 container. */
export function importMotionGlbAnimation(bytes: Uint8Array, options: MotionGltfOptions): MotionClip {
  const { gltf, binary } = decodeMotionGlb(bytes);
  return importMotionGltfAnimation(gltf, [binary], options);
}

/** Bake one selected GLB animation onto a caller-chosen finite v0 key grid. */
export function bakeMotionGlbAnimation(bytes: Uint8Array, options: MotionGltfBakeOptions): MotionClip {
  const { gltf, binary } = decodeMotionGlb(bytes);
  return bakeMotionGltfAnimation(gltf, [binary], options);
}

/** List bounded GLB animation selection metadata without reading keyframe accessors. */
export function listMotionGlbAnimations(bytes: Uint8Array): MotionGlbAnimationSummary[] {
  const { gltf } = decodeMotionGlb(bytes);
  const asset = metadataRecord(gltf.asset, 'gltf.asset');
  if (asset.version !== '2.0') fail('UNSUPPORTED', 'gltf.asset.version', 'expected glTF 2.0');
  if (Object.hasOwn(gltf, 'extensionsRequired') &&
      metadataArray(gltf.extensionsRequired, 4096, 'gltf.extensionsRequired').length > 0) {
    fail('UNSUPPORTED', 'gltf.extensionsRequired', 'required extensions are unsupported');
  }
  if (!Object.hasOwn(gltf, 'animations')) return [];
  const animations = metadataArray(gltf.animations, 64, 'gltf.animations');
  if (animations.length === 0) return [];
  const nodes = metadataArray(gltf.nodes, 4096, 'gltf.nodes');
  const summaries: MotionGlbAnimationSummary[] = [];
  let totalChannels = 0;
  for (const [animationIndex, item] of animations.entries()) {
    const path = `gltf.animations[${animationIndex}]`;
    const animation = metadataRecord(item, path);
    noMetadataExtension(animation, path);
    const name = Object.hasOwn(animation, 'name') ? animation.name : null;
    if (name !== null && (typeof name !== 'string' || name.length > 128)) {
      fail('INVALID_INPUT', `${path}.name`, 'expected a string of at most 128 code units');
    }
    if (name === null && Object.hasOwn(animation, 'name')) {
      fail('INVALID_INPUT', `${path}.name`, 'expected a string');
    }
    const samplers = metadataArray(animation.samplers, 192, `${path}.samplers`);
    const channels = metadataArray(animation.channels, 192, `${path}.channels`);
    if (samplers.length === 0 || channels.length === 0) fail('INVALID_INPUT', path, 'expected samplers and channels');
    totalChannels += channels.length;
    if (totalChannels > 4096) fail('LIMIT_EXCEEDED', 'gltf.animations', 'more than 4096 channels');
    const methods = samplers.map((samplerItem, samplerIndex) => {
      const samplerPath = `${path}.samplers[${samplerIndex}]`;
      const sampler = metadataRecord(samplerItem, samplerPath);
      noMetadataExtension(sampler, samplerPath);
      const method = Object.hasOwn(sampler, 'interpolation') ? sampler.interpolation : 'LINEAR';
      if (method !== 'STEP' && method !== 'LINEAR' && method !== 'CUBICSPLINE') {
        fail('UNSUPPORTED', `${samplerPath}.interpolation`, 'unsupported interpolation');
      }
      return method;
    });
    const channelSummaries = channels.map((channelItem, channelIndex): MotionGlbAnimationChannel => {
      const channelPath = `${path}.channels[${channelIndex}]`;
      const channel = metadataRecord(channelItem, channelPath);
      noMetadataExtension(channel, channelPath);
      const samplerIndex = metadataIndex(channel.sampler, samplers.length, `${channelPath}.sampler`);
      const target = metadataRecord(channel.target, `${channelPath}.target`);
      noMetadataExtension(target, `${channelPath}.target`);
      const nodeIndex = metadataIndex(target.node, nodes.length, `${channelPath}.target.node`);
      const targetPath = target.path;
      if (targetPath !== 'translation' && targetPath !== 'rotation' &&
          targetPath !== 'scale' && targetPath !== 'weights') {
        fail('UNSUPPORTED', `${channelPath}.target.path`, 'unsupported animation target');
      }
      return { nodeIndex, path: targetPath, interpolation: methods[samplerIndex] };
    });
    summaries.push({ animationIndex, name: name as string | null, channels: channelSummaries });
  }
  return summaries;
}
