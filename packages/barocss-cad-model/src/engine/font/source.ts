import { BarocssError } from '@barocss/cad/api';
import { getBlob, putBlob, type BlobArray } from '../blobs';
import { readTrueTypeFont, type TrueTypeFont } from './trueType';

/** Authored source metadata. The content key names the original bytes, never an OS font lookup. */
export interface FontSource {
  readonly blob: string;
  readonly filename: string;
  readonly source?: string;
  readonly license?: string;
}
export type FontSourceMetadata = Omit<FontSource, 'blob'>;
export type FontSourceErrorCode = 'FONT_SOURCE_INPUT' | 'FONT_SOURCE_MISSING' | 'FONT_SOURCE_CONFLICT';
export type FontSourceError = BarocssError & { readonly code: FontSourceErrorCode };

const SOURCE_KEYS = new Set(['blob', 'filename', 'source', 'license']);
const METADATA_KEYS = new Set(['filename', 'source', 'license']);
const HASH = /^[a-f0-9]{64}$/;
type Data = Record<string, unknown>;

function fail(code: FontSourceErrorCode, message: string): never {
  throw new BarocssError(code, message, undefined, { source: 'font-source' });
}
export function isFontSourceError(error: unknown): error is FontSourceError {
  return error instanceof BarocssError && error.details?.source === 'font-source';
}
function dataOf(value: unknown): Data | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  try {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value), data: Data = Object.create(null);
    for (const key of Reflect.ownKeys(descriptors)) {
      if (typeof key !== 'string') return null;
      const descriptor = descriptors[key];
      if (!descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) return null;
      data[key] = descriptor.value;
    }
    return data;
  } catch { return null; }
}
function issue(data: Data | null, source: boolean): string | null {
  if (!data) return 'Font metadata must be a plain data record.';
  const keys = source ? SOURCE_KEYS : METADATA_KEYS;
  for (const key of Object.keys(data)) if (!keys.has(key)) return 'Font metadata has an unsupported field.';
  if (source && (typeof data.blob !== 'string' || !HASH.test(data.blob))) return 'A lowercase SHA-256 font content key is required.';
  if (typeof data.filename !== 'string' || !data.filename.trim() || data.filename.length > 256 || data.filename.includes('\0')) return 'A bounded original font filename is required.';
  if (data.source !== undefined && (typeof data.source !== 'string' || data.source.length > 4096 || data.source.includes('\0'))) return 'The font source description exceeds its text bound.';
  if (data.license !== undefined && (typeof data.license !== 'string' || data.license.length > 65536 || data.license.includes('\0'))) return 'The supplied font license exceeds its text bound.';
  return null;
}
/** Shape validation only. This does not load bytes, check a license, or inspect glyph coverage. */
export function fontSourceError(value: unknown): string | null { return issue(dataOf(value), true); }
function metadataOf(data: Data): FontSourceMetadata {
  return { filename: data.filename as string, ...(data.source === undefined ? {} : { source: data.source as string }), ...(data.license === undefined ? {} : { license: data.license as string }) };
}
function byteView(array: BlobArray): Uint8Array | null {
  try { return new Uint8Array(array.buffer, array.byteOffset, array.byteLength); }
  catch { return null; }
}
function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** Validates and copies before the first await. Original metadata is preserved without normalization. */
export async function fontFromBytes(bytes: Uint8Array, metadata: FontSourceMetadata): Promise<FontSource> {
  const data = dataOf(metadata), error = issue(data, false);
  if (error) fail('FONT_SOURCE_INPUT', error);
  const authored = metadataOf(data!), own = readTrueTypeFont(bytes).copyBytes();
  const blob = await putBlob(own), stored = getBlob(blob), actual = stored ? byteView(stored) : null;
  if (!actual || !equalBytes(own, actual)) {
    fail('FONT_SOURCE_CONFLICT', 'The stored font content does not match the imported bytes.');
  }
  return Object.freeze({ blob, ...authored });
}

/** The store may retain another array class for identical bytes; the font reader always takes a byte view. */
export function readFontSource(source: FontSource): TrueTypeFont {
  const data = dataOf(source), error = issue(data, true);
  if (error) fail('FONT_SOURCE_INPUT', error);
  const stored = getBlob(data!.blob as string);
  if (!stored) fail('FONT_SOURCE_MISSING', 'The original font bytes are not loaded.');
  const bytes = byteView(stored);
  if (!bytes) fail('FONT_SOURCE_INPUT', 'The stored font bytes are not readable.');
  return readTrueTypeFont(bytes);
}
