import { ViewerError } from './viewer-error.js';

/** The largest GLB accepted by this bounded reader, including its header and padding. */
export const GLB_MAX_BYTES = 64 * 1024 * 1024;

const MAGIC = 0x46546c67; // glTF
const JSON_CHUNK = 0x4e4f534a; // JSON
const BIN_CHUNK = 0x004e4942; // BIN\0

function invalid(message: string): never { throw new ViewerError('GEOMETRY_INVALID', `Invalid GLB: ${message}`); }

/**
 * Decode a self-contained GLB 2.0 container. JSON must be first; at most one
 * BIN chunk may follow. Other chunk types are outside this reader's scope.
 * The returned BIN bytes are independent of the caller's input.
 */
export function decodeGlb(source: ArrayBuffer | Uint8Array): { json: unknown; bin: Uint8Array } {
  if (!(source instanceof ArrayBuffer) && !(source instanceof Uint8Array && source.buffer instanceof ArrayBuffer)) {
    return invalid('expected an ArrayBuffer or a non-shared Uint8Array');
  }
  let bytes: Uint8Array;
  try {
    if (source instanceof ArrayBuffer) bytes = new Uint8Array(source);
    else bytes = source;
  } catch {
    return invalid('the input buffer is unavailable');
  }
  const size = bytes.byteLength;
  if (size < 20 || size > GLB_MAX_BYTES) return invalid('the container size is outside the supported range');
  const view = new DataView(bytes.buffer, bytes.byteOffset, size);
  if (view.getUint32(0, true) !== MAGIC) return invalid('the magic is not glTF');
  if (view.getUint32(4, true) !== 2) return invalid('only version 2 is supported');
  if (view.getUint32(8, true) !== size || size % 4 !== 0) return invalid('the declared length or alignment does not match the input');

  let offset = 12, json: unknown = undefined, haveJson = false, haveBin = false;
  let bin = new Uint8Array(0);
  while (offset < size) {
    if (size - offset < 8) return invalid('a chunk header is truncated');
    const length = view.getUint32(offset, true), type = view.getUint32(offset + 4, true);
    offset += 8;
    if (length % 4 !== 0 || length > size - offset) return invalid('a chunk has an invalid length or alignment');
    if (!haveJson) {
      if (type !== JSON_CHUNK || length === 0) return invalid('the first chunk must contain JSON');
      try { json = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(bytes.buffer, bytes.byteOffset + offset, length))); }
      catch { return invalid('the JSON chunk must contain valid UTF-8 and JSON'); }
      haveJson = true;
    } else if (type === BIN_CHUNK) {
      if (haveBin) return invalid('a BIN chunk is duplicated');
      // Buffer is a Uint8Array subclass whose slice() is a view, not a copy.
      bin = new Uint8Array(new Uint8Array(bytes.buffer, bytes.byteOffset + offset, length));
      haveBin = true;
    } else if (type === JSON_CHUNK) return invalid('a JSON chunk is duplicated');
    else return invalid('the chunk type is not supported');
    offset += length;
  }
  if (!haveJson) return invalid('the JSON chunk is missing');
  return { json, bin };
}
