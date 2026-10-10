import { Canvas2DError } from './schema.js';
import type { ImageAssetInput } from './schema.js';
import { decodeImageBlob } from './image-decode.js';

export type ImageURLLoadOptions = { signal?: AbortSignal; fetcher?: typeof fetch };

const maxEncodedBytes = 8 * 1024 * 1024;
const rasterTypes = new Set(['image/png', 'image/jpeg', 'image/webp']);

function invalid(message: string): never { throw new Canvas2DError('INVALID_ASSET', message); }
function abortError(): Error {
  if (typeof DOMException === 'function') return new DOMException('Image load aborted', 'AbortError');
  const error = new Error('Image load aborted'); error.name = 'AbortError'; return error;
}
function checkAbort(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw abortError();
}
function isAbort(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}
function cancelBody(response: Response): void {
  if (response.body && typeof response.body.cancel === 'function') {
    try { void response.body.cancel().catch(() => {}); } catch { /* Best-effort cleanup. */ }
  }
}

export async function loadImageURL(url: string, options: ImageURLLoadOptions = {}): Promise<ImageAssetInput> {
  if (typeof url !== 'string' || !url || url.trim() !== url) invalid('image URL must be an absolute HTTP(S) URL');
  let parsed: URL;
  try { parsed = new URL(url); }
  catch { return invalid('image URL must be an absolute HTTP(S) URL'); }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    invalid('image URL must be HTTP(S) without credentials');
  }
  if (options === null || typeof options !== 'object' ||
      (Object.getPrototypeOf(options) !== Object.prototype && Object.getPrototypeOf(options) !== null) ||
      Reflect.ownKeys(options).some(key => key !== 'signal' && key !== 'fetcher')) {
    invalid('image load options are invalid');
  }
  const { signal, fetcher = globalThis.fetch } = options;
  if (signal !== undefined &&
      (typeof AbortSignal !== 'function' || !(signal instanceof AbortSignal))) {
    invalid('image load signal must be an AbortSignal');
  }
  if (typeof fetcher !== 'function') {
    throw new Canvas2DError('UNSUPPORTED_FEATURE', 'fetch is unavailable');
  }
  checkAbort(signal);
  let response: Response;
  try {
    response = await fetcher(parsed.href, { method: 'GET', mode: 'cors', credentials: 'omit',
      cache: 'no-store', redirect: 'follow', signal });
  } catch (error) {
    if (signal?.aborted || isAbort(error)) throw abortError();
    throw new Canvas2DError('INVALID_ASSET', 'image fetch failed');
  }
  if (signal?.aborted) {
    if (response) cancelBody(response);
    throw abortError();
  }
  if (!response || !response.ok || !response.headers || typeof response.headers.get !== 'function') {
    if (response) cancelBody(response);
    invalid('image response is not OK');
  }
  const mime = response.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase();
  if (!mime || !rasterTypes.has(mime)) {
    cancelBody(response);
    throw new Canvas2DError('UNSUPPORTED_FEATURE', 'image response MIME type is unsupported');
  }
  const lengthHeader = response.headers.get('content-length')?.trim();
  if (lengthHeader && /^\d+$/.test(lengthHeader) && Number(lengthHeader) > maxEncodedBytes) {
    cancelBody(response);
    throw new Canvas2DError('ASSET_LIMIT', 'encoded image exceeds 8 MiB');
  }
  if (!response.body || typeof response.body.getReader !== 'function') {
    throw new Canvas2DError('UNSUPPORTED_FEATURE', 'streaming image response is unavailable');
  }
  let reader: ReadableStreamDefaultReader<Uint8Array>;
  try { reader = response.body.getReader(); }
  catch { throw new Canvas2DError('INVALID_ASSET', 'image response stream is unavailable'); }
  let cancellationRequested = false;
  const cancelReader = () => {
    if (cancellationRequested) return;
    cancellationRequested = true;
    try { void reader.cancel().catch(() => {}); } catch { /* Keep the original refusal. */ }
  };
  const onAbort = cancelReader;
  signal?.addEventListener('abort', onAbort, { once: true });
  const chunks: ArrayBuffer[] = [];
  let size = 0;
  try {
    while (true) {
      checkAbort(signal);
      let result: ReadableStreamReadResult<Uint8Array>;
      try { result = await reader.read(); }
      catch (error) {
        if (signal?.aborted || isAbort(error)) throw abortError();
        throw new Canvas2DError('INVALID_ASSET', 'image response stream failed');
      }
      checkAbort(signal);
      if (result.done) break;
      if (!(result.value instanceof Uint8Array)) invalid('image response chunk is invalid');
      size += result.value.byteLength;
      if (size > maxEncodedBytes) {
        cancelReader();
        throw new Canvas2DError('ASSET_LIMIT', 'encoded image exceeds 8 MiB');
      }
      const copy = new Uint8Array(result.value.byteLength);
      copy.set(result.value);
      chunks.push(copy.buffer);
    }
  } catch (error) {
    cancelReader();
    throw error;
  } finally {
    signal?.removeEventListener('abort', onAbort);
    reader.releaseLock();
  }
  checkAbort(signal);
  try {
    const asset = await decodeImageBlob(new Blob(chunks, { type: mime }));
    checkAbort(signal);
    return asset;
  } catch (error) {
    checkAbort(signal);
    throw error;
  }
}
