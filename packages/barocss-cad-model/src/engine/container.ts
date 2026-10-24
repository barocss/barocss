// The .bcad file (M1, R3.3). A document naming no mesh blobs is written as plain JSON, as always. One that does is
// written as a small chunked binary container of our own:
//
//   "BCADPACK" (8 bytes) · u32 version (1) · u32 chunk count
//   chunk: u32 header bytes · u32 payload bytes · header (UTF-8 JSON) · zeros to a multiple of 8
//          · payload · zeros to a multiple of 8           (all little-endian; payloads 8-aligned, so arrays map in place)
//   chunk 0: {"kind":"document"} · the document as JSON (naming its blobs by hash)
//   chunk k: {"kind":"blob","sha256":…,"dtype":"f64"|"f32"|"u32","count":…} · the array's bytes
//
// Reading checks each blob's SHA-256 against its name before it is used. Files of either kind open; a plain JSON
// file's inline mesh arrays stay as they are.
import { arrayOf, blobRefs, blobTypeOf, getBlob, missingBlobs, putKnownBlob, sha256, type BlobArray, type BlobType } from './blobs';
import { readStudioDoc } from './migrate';
import type { StudioDoc } from './doc';
import { isRefusal, refusal } from './refusal';

const MAGIC = 'BCADPACK', VERSION = 1;
const pad8 = (n: number) => (n + 7) & ~7;


/** The file's bytes: plain JSON (indented, as before) without blobs; the container with them. Throws when a named blob is missing. */
export function encodeStudioFile(doc: StudioDoc): Uint8Array {
  const refs = [...blobRefs(doc)];
  if (!refs.length) return new TextEncoder().encode(JSON.stringify(doc, null, 2));
  const enc = new TextEncoder(), chunks: { header: Uint8Array; payload: Uint8Array }[] = [];
  chunks.push({ header: enc.encode(JSON.stringify({ kind: 'document' })), payload: enc.encode(JSON.stringify(doc)) });
  for (const h of refs) {
    const a = getBlob(h);
    if (!a) throw refusal('MESH_NOT_LOADED', `the mesh data ${h.slice(0, 12)}… is not loaded: it cannot be saved`);
    chunks.push({ header: enc.encode(JSON.stringify({ kind: 'blob', sha256: h, dtype: blobTypeOf(a), count: a.length })), payload: new Uint8Array(a.buffer, a.byteOffset, a.byteLength) });
  }
  let size = 16; for (const c of chunks) size += 8 + pad8(c.header.length) + pad8(c.payload.length);
  const out = new Uint8Array(size), view = new DataView(out.buffer);
  out.set(enc.encode(MAGIC), 0); view.setUint32(8, VERSION, true); view.setUint32(12, chunks.length, true);
  let at = 16;
  for (const c of chunks) {
    view.setUint32(at, c.header.length, true); view.setUint32(at + 4, c.payload.length, true); at += 8;
    out.set(c.header, at); at += pad8(c.header.length);
    out.set(c.payload, at); at += pad8(c.payload.length);
  }
  return out;
}

/** Whether the bytes are a container (else plain JSON text). */
export const isContainer = (bytes: Uint8Array) => bytes.length >= 16 && new TextDecoder().decode(bytes.subarray(0, 8)) === MAGIC;

/**
 * A file's document text, its blobs checked and put in the store (a container), or the text as it is (plain
 * JSON). Refused when a blob's bytes do not hash to its name, or the container is cut short or from a newer studio.
 */
export async function decodeStudioFile(bytes: Uint8Array): Promise<{ text: string; blobs: number }> {
  if (!isContainer(bytes)) return { text: new TextDecoder().decode(bytes), blobs: 0 };
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), dec = new TextDecoder();
  const version = view.getUint32(8, true), count = view.getUint32(12, true);
  if (version > VERSION) throw refusal('CONTAINER_NEWER', `this file was saved by a newer cad-studio (container version ${version}; this one reads ${VERSION})`);
  let at = 16, text: string | null = null, blobs = 0;
  for (let k = 0; k < count; k++) {
    if (at + 8 > bytes.length) throw refusal('CONTAINER_DAMAGED', 'the file is cut short');
    const hl = view.getUint32(at, true), pl = view.getUint32(at + 4, true); at += 8;
    if (at + pad8(hl) + pl > bytes.length) throw refusal('CONTAINER_DAMAGED', 'the file is cut short');
    const header = JSON.parse(dec.decode(bytes.subarray(at, at + hl))) as { kind: string; sha256?: string; dtype?: BlobType; count?: number };
    at += pad8(hl);
    const payload = bytes.subarray(at, at + pl); at += pad8(pl);
    if (header.kind === 'document') { text = dec.decode(payload); continue; }
    if (header.kind !== 'blob') continue;
    const width = header.dtype === 'f64' ? 8 : header.dtype === 'u32' || header.dtype === 'f32' || header.dtype === 'i32' ? 4 : 0;
    if (!width || header.count! * width !== pl || typeof header.sha256 !== 'string') throw refusal('CONTAINER_DAMAGED', 'a mesh chunk is malformed');
    // (Copied into its own buffer: aligned, and not holding the whole file alive.)
    const own = payload.slice(), array: BlobArray = arrayOf(header.dtype!, own.buffer);
    if (await sha256(array) !== header.sha256) throw refusal('CONTAINER_DAMAGED', `a mesh chunk does not match its hash (${header.sha256.slice(0, 12)}…): the file is damaged`);
    putKnownBlob(header.sha256, array); blobs++;
  }
  if (text === null) throw refusal('CONTAINER_DAMAGED', 'the file has no document');
  return { text, blobs };
}

/** A .bcad file read: its blobs into the store, its document checked (engine/migrate.ts); a missing blob refused. */
export async function readStudioFile(bytes: Uint8Array): Promise<ReturnType<typeof readStudioDoc>> {
  let text: string;
  try { text = (await decodeStudioFile(bytes)).text; }
  catch (e) {
    // (A container's own refusal keeps its code in front: "[CONTAINER_DAMAGED] This model file could not be read: …".)
    if (isRefusal(e)) return { error: `[${e.code}] This model file could not be read: ${e.message.slice(e.code.length + 3)}.` };
    return { error: `This model file could not be read: ${e instanceof Error ? e.message : String(e)}.` };
  }
  const read = readStudioDoc(text);
  if ('error' in read) return read;
  const missing = missingBlobs(read.doc);
  if (missing.length) return { error: `This model names mesh data it does not hold (${missing.length} array${missing.length > 1 ? 's' : ''}): it was saved incompletely.` };
  return read;
}
