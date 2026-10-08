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
