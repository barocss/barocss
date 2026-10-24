// Our own ZIP writer (AM5, D76) for packages such as 3MF: CRC-32 and the archive's headers written here, the deflate
// by the web-standard CompressionStream (Node and browsers; no dependency). No ZIP64: an entry or archive past 4 GiB,
// or more than 65 535 entries, is refused.
import { refusal } from '../engine/refusal';

const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
/** CRC-32 (ISO-HDLC, as ZIP and PNG use) of the bytes. */
export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** A part a Blob is made of, read off the Blob constructor itself (PKG-g2: the same under the DOM's lib and Node's). */
type BlobPiece = NonNullable<ConstructorParameters<typeof Blob>[0]> extends Iterable<infer P> ? P : never;
async function compress(raw: Uint8Array, format: 'deflate' | 'deflate-raw'): Promise<Uint8Array> {
  const stream = new Blob([raw as unknown as BlobPiece]).stream().pipeThrough(new CompressionStream(format));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
/** zlib deflate (a 2-byte header and an Adler-32 trailer around the raw stream), as PNG's IDAT holds. */
export const deflateZlib = (raw: Uint8Array): Promise<Uint8Array> => compress(raw, 'deflate');
/** Raw deflate, as ZIP holds; where 'deflate-raw' is not supported, the zlib stream without its header and trailer. */
export async function deflateRaw(raw: Uint8Array): Promise<Uint8Array> {
  let raw0: boolean;
  try { new CompressionStream('deflate-raw'); raw0 = true; } catch { raw0 = false; }
  if (raw0) return compress(raw, 'deflate-raw');
  const z = await compress(raw, 'deflate');
  return z.subarray(2, z.length - 4);
}

export interface ZipEntry { readonly name: string; readonly data: Uint8Array; /** Deflate it (kept stored when that is not smaller). */ readonly deflate?: boolean }
const MAX32 = 0xffffffff;
/** The entries as one ZIP archive (UTF-8 names, deflated or stored), stamped with `date` (DOS time, 2-second steps). */
export async function writeZip(entries: readonly ZipEntry[], date: Date = new Date()): Promise<Uint8Array> {
  if (entries.length > 0xffff) throw refusal('ZIP_LIMIT', `zip: ${entries.length} entries (at most 65 535 without ZIP64)`);
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
  const day = (Math.max(0, date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  const enc = new TextEncoder(), parts: Uint8Array[] = [], central: Uint8Array[] = [];
  let offset = 0;
  for (const e of entries) {
    if (e.data.length > MAX32) throw refusal('ZIP_LIMIT', `zip: ${e.name} is past 4 GiB (no ZIP64)`);
    const name = enc.encode(e.name), crc = crc32(e.data);
    let body = e.data, method = 0;
    if (e.deflate) { const d = await deflateRaw(e.data); if (d.length < e.data.length) { body = d; method = 8; } }
    const local = new Uint8Array(30 + name.length), lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true); lv.setUint16(4, 20, true); lv.setUint16(6, 0x0800, true); lv.setUint16(8, method, true);
    lv.setUint16(10, time, true); lv.setUint16(12, day, true); lv.setUint32(14, crc, true); lv.setUint32(18, body.length, true);
    lv.setUint32(22, e.data.length, true); lv.setUint16(26, name.length, true); lv.setUint16(28, 0, true); local.set(name, 30);
    const dir = new Uint8Array(46 + name.length), cv = new DataView(dir.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0x0800, true); cv.setUint16(10, method, true);
    cv.setUint16(12, time, true); cv.setUint16(14, day, true); cv.setUint32(16, crc, true); cv.setUint32(20, body.length, true); cv.setUint32(24, e.data.length, true);
    cv.setUint16(28, name.length, true); cv.setUint32(42, offset, true); dir.set(name, 46);
    parts.push(local, body); central.push(dir);
    offset += local.length + body.length;
    if (offset > MAX32) throw refusal('ZIP_LIMIT', 'zip: the archive is past 4 GiB (no ZIP64)');
  }
  const dirSize = central.reduce((n, d) => n + d.length, 0), end = new Uint8Array(22), ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, entries.length, true); ev.setUint16(10, entries.length, true); ev.setUint32(12, dirSize, true); ev.setUint32(16, offset, true);
  const out = new Uint8Array(offset + dirSize + 22);
  let at = 0;
  for (const p of [...parts, ...central, end]) { out.set(p, at); at += p.length; }
  return out;
}
