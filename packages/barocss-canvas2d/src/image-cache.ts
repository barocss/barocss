import { Canvas2DError, copyImageAsset } from './schema.js';
import type { ImageAssetInput } from './schema.js';
import { loadImageURL } from './image-url.js';

export type ImageAssetCacheOptions = {
  maxEntries?: number;
  maxBytes?: number;
  fetcher?: typeof fetch;
};

export type ImageAssetCache = {
  load(url: string): Promise<ImageAssetInput>;
  get(url: string): ImageAssetInput | null;
  delete(url: string): boolean;
  clear(): void;
  dispose(): void;
  readonly size: number;
  readonly byteLength: number;
};

type Pending = {
  controller: AbortController;
  reject: (reason: unknown) => void;
  promise: Promise<ImageAssetInput>;
};

const maximumEntries = 16;
const maximumBytes = 32 * 1024 * 1024;

function invalid(message: string): never { throw new Canvas2DError('INVALID_ASSET', message); }
function abortError(): Error {
  if (typeof DOMException === 'function') return new DOMException('Image load aborted', 'AbortError');
  const error = new Error('Image load aborted'); error.name = 'AbortError'; return error;
}
function cacheKey(url: string): string {
  if (typeof url !== 'string' || !url || url.trim() !== url) invalid('image URL must be an absolute HTTP(S) URL');
  let parsed: URL;
  try { parsed = new URL(url); }
  catch { return invalid('image URL must be an absolute HTTP(S) URL'); }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    invalid('image URL must be HTTP(S) without credentials');
  }
  parsed.hash = '';
  return parsed.href;
}
function bound(value: unknown, maximum: number, name: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1 || value > maximum) {
    invalid(`${name} must be a positive safe integer at most ${maximum}`);
  }
  return value;
}

export function createImageAssetCache(options: ImageAssetCacheOptions = {}): ImageAssetCache {
  if (options === null || typeof options !== 'object' ||
      (Object.getPrototypeOf(options) !== Object.prototype && Object.getPrototypeOf(options) !== null) ||
      Reflect.ownKeys(options).some(key =>
        (key !== 'maxEntries' && key !== 'maxBytes' && key !== 'fetcher') ||
        !Object.prototype.hasOwnProperty.call(Object.getOwnPropertyDescriptor(options, key), 'value'))) {
    invalid('image cache options are invalid');
  }
  const maxEntries = options.maxEntries === undefined ? maximumEntries : bound(options.maxEntries, maximumEntries, 'maxEntries');
  const maxBytes = options.maxBytes === undefined ? maximumBytes : bound(options.maxBytes, maximumBytes, 'maxBytes');
  const fetcher = options.fetcher;
  if (fetcher !== undefined && typeof fetcher !== 'function') invalid('image cache fetcher must be callable');

  const entries = new Map<string, ImageAssetInput>(); // Insertion order is least to most recently used.
  const pending = new Map<string, Pending>();
  let bytes = 0;
  let disposed = false;

  function checkLive(): void {
    if (disposed) throw new Canvas2DError('DISPOSED', 'image cache is disposed');
  }
  function touch(key: string, asset: ImageAssetInput): void {
    entries.delete(key);
    entries.set(key, asset);
  }
  function cancel(record: Pending): void {
    record.reject(abortError());
    record.controller.abort();
  }
  function clearAll(): void {
    for (const record of pending.values()) cancel(record);
    pending.clear();
    entries.clear();
    bytes = 0;
  }

  return {
    async load(url) {
      checkLive();
      const key = cacheKey(url);
      const resident = entries.get(key);
      if (resident) {
        touch(key, resident);
        return copyImageAsset(resident);
      }
      const running = pending.get(key);
      if (running) return copyImageAsset(await running.promise);
      if (pending.size >= maxEntries) {
        throw new Canvas2DError('ASSET_LIMIT', 'too many concurrent image cache loads');
      }
      if (typeof AbortController !== 'function') {
        throw new Canvas2DError('UNSUPPORTED_FEATURE', 'request cancellation is unavailable');
      }

      const controller = new AbortController();
      let rejectCancellation: (reason: unknown) => void = () => {};
      const cancellation = new Promise<never>((_resolve, reject) => { rejectCancellation = reject; });
      let record: Pending;
      // Publish the complete pending record before caller-controlled fetcher reentry.
      const fetched = Promise.resolve().then(() => loadImageURL(key, { signal: controller.signal, fetcher }));
      const promise = Promise.race([fetched, cancellation]).then(asset => {
        if (disposed || pending.get(key) !== record) throw abortError();
        const owned = copyImageAsset(asset);
        const cost = owned.pixels.byteLength;
        if (cost > maxBytes) throw new Canvas2DError('ASSET_LIMIT', 'decoded image exceeds cache byte limit');
        while (entries.size >= maxEntries || bytes + cost > maxBytes) {
          const oldest = entries.keys().next().value;
          if (oldest === undefined) break;
          const removed = entries.get(oldest)!;
          entries.delete(oldest);
          bytes -= removed.pixels.byteLength;
        }
        entries.set(key, owned);
        bytes += cost;
        return owned;
      }).finally(() => {
        if (pending.get(key) === record) pending.delete(key);
      });
      record = { controller, reject: rejectCancellation, promise };
      pending.set(key, record);
      return copyImageAsset(await record.promise);
    },
    get(url) {
      checkLive();
      const key = cacheKey(url);
      const resident = entries.get(key);
      if (!resident) return null;
      touch(key, resident);
      return copyImageAsset(resident);
    },
    delete(url) {
      checkLive();
      const key = cacheKey(url);
      const record = pending.get(key);
      if (record) {
        pending.delete(key);
        cancel(record);
      }
      const resident = entries.get(key);
      if (resident) {
        entries.delete(key);
        bytes -= resident.pixels.byteLength;
      }
      return !!record || !!resident;
    },
    clear() { checkLive(); clearAll(); },
    dispose() {
      if (disposed) return;
      clearAll();
      disposed = true;
    },
    get size() { checkLive(); return entries.size; },
    get byteLength() { checkLive(); return bytes; },
  };
}
