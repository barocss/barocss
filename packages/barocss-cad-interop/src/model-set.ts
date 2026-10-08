import { loadBaroCadSource, validateBaroCadParseOptions } from './native.js';
import type { BaroCadNativeResult, BaroCadParseOptions } from './native.js';
import { BaroCadLoadAbortError, throwIfBaroCadAborted } from './transport.js';

export interface BaroCadModelSetManifest {
  format: 'barocad-model-set';
  version: 0;
  entries: Array<{ aliasId: string; url: string; options: BaroCadParseOptions }>;
}

export interface BaroCadModelSetProgress {
  readonly aliasId: string;
  readonly url: string;
  readonly loadedBytes: number;
  readonly aggregateLoadedBytes: number;
  readonly declaredTotalBytes?: number;
}

export interface BaroCadModelSetLoadOptions {
  baseURL?: string;
  signal?: AbortSignal;
  onProgress?: (event: BaroCadModelSetProgress) => void | false;
}

export interface BaroCadModelSetEntry {
  readonly aliasId: string;
  readonly url: string;
  readonly result: BaroCadNativeResult;
}

export interface BaroCadModelSetResult {
  readonly format: 'barocad-model-set';
  readonly version: 0;
  readonly entries: ReadonlyArray<BaroCadModelSetEntry>;
  readonly totalLoadedBytes: number;
}

function record(input: unknown, keys: readonly string[], label: string): Record<string, unknown> {
  if (input === null || typeof input !== 'object' || Array.isArray(input) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(input))) {
    throw new TypeError(`${label} must be a plain object`);
  }
  const actual = Reflect.ownKeys(input);
  if (actual.length !== keys.length || !actual.every(key => typeof key === 'string' && keys.includes(key))) {
    throw new TypeError(`${label} requires ${keys.join(', ')} only`);
  }
  const output: Record<string, unknown> = {};
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (!descriptor?.enumerable || !('value' in descriptor)) throw new TypeError(`${label} ${key} must be data`);
    output[key] = descriptor.value;
  }
  return output;
}

function loadOptions(input: unknown): Required<Pick<BaroCadModelSetLoadOptions, 'onProgress'>> &
  Pick<BaroCadModelSetLoadOptions, 'baseURL' | 'signal'> {
  if (input === null || typeof input !== 'object' || Array.isArray(input) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(input))) {
    throw new TypeError('BaroCAD model-set load options must be a plain object');
  }
  const keys = Reflect.ownKeys(input);
  if (!keys.every(key => typeof key === 'string' && ['baseURL', 'signal', 'onProgress'].includes(key))) {
    throw new TypeError('BaroCAD model-set load accepts baseURL, signal and onProgress only');
  }
  const values: Record<string, unknown> = {};
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (!descriptor?.enumerable || !('value' in descriptor)) throw new TypeError(`BaroCAD model-set ${String(key)} must be data`);
    values[key as string] = descriptor.value;
  }
  if (values.baseURL !== undefined && typeof values.baseURL !== 'string') throw new TypeError('baseURL must be a URL string');
  if (values.signal !== undefined && !(values.signal instanceof AbortSignal)) throw new TypeError('signal must be an AbortSignal');
  if (values.onProgress !== undefined && typeof values.onProgress !== 'function') throw new TypeError('onProgress must be a function');
  return {
    baseURL: values.baseURL as string | undefined,
    signal: values.signal as AbortSignal | undefined,
    onProgress: (values.onProgress as BaroCadModelSetLoadOptions['onProgress']) ?? (() => {}),
  };
}

function httpURL(value: string, base?: string): string {
  const url = base === undefined ? new URL(value) : new URL(value, base);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new RangeError('BaroCAD model-set requires HTTP(S) source URLs');
  return url.href;
}

/** Load separate native sources atomically without renaming their authoritative Models. */
export async function loadBaroCadModelSet(
  manifest: BaroCadModelSetManifest,
  options: BaroCadModelSetLoadOptions = {},
): Promise<BaroCadModelSetResult> {
  const request = loadOptions(options);
  const input = record(manifest, ['format', 'version', 'entries'], 'BaroCAD model-set manifest');
  if (input.format !== 'barocad-model-set' || input.version !== 0) throw new RangeError('Only BaroCAD model-set version 0 is supported');
  const rawEntries = input.entries;
  if (!Array.isArray(rawEntries) || Object.getPrototypeOf(rawEntries) !== Array.prototype ||
      rawEntries.length < 1 || rawEntries.length > 4) {
    throw new RangeError('BaroCAD model-set requires 1..4 entries');
  }
  const baseURL = request.baseURL === undefined ? undefined : httpURL(request.baseURL);
  const aliases = new Set<string>();
  const entries = Array.from({ length: rawEntries.length }, (_, index) => {
    const descriptor = Object.getOwnPropertyDescriptor(rawEntries, String(index));
    if (!descriptor?.enumerable || !('value' in descriptor)) throw new TypeError('BaroCAD model-set entry must be data');
    const entry = record(descriptor.value, ['aliasId', 'url', 'options'], 'BaroCAD model-set entry');
    if (typeof entry.aliasId !== 'string' || !/^[A-Za-z_][A-Za-z0-9_-]{0,63}$/.test(entry.aliasId) || aliases.has(entry.aliasId)) {
      throw new RangeError('BaroCAD model-set aliasId must be unique ASCII identifier');
    }
    aliases.add(entry.aliasId);
    if (typeof entry.url !== 'string') throw new TypeError('BaroCAD model-set URL must be a string');
    return {
      aliasId: entry.aliasId,
      url: httpURL(entry.url, baseURL),
      options: validateBaroCadParseOptions(entry.options),
    };
  });
  throwIfBaroCadAborted(request.signal);

  const accepted: BaroCadModelSetEntry[] = [];
  let totalLoadedBytes = 0;
  for (const entry of entries) {
    throwIfBaroCadAborted(request.signal);
    const child = new AbortController();
    const forwardAbort = () => child.abort();
    request.signal?.addEventListener('abort', forwardAbort, { once: true });
    if (request.signal?.aborted) child.abort();
    let memberLoadedBytes = 0;
    try {
      const result = await loadBaroCadSource(entry.url, entry.options, {
        signal: child.signal,
        onProgress(progress) {
          memberLoadedBytes = progress.loadedBytes;
          const decision = request.onProgress(Object.freeze({
            aliasId: entry.aliasId, url: entry.url, loadedBytes: progress.loadedBytes,
            aggregateLoadedBytes: totalLoadedBytes + progress.loadedBytes,
            ...(progress.declaredTotalBytes === undefined ? {} : { declaredTotalBytes: progress.declaredTotalBytes }),
          }));
          if (decision === false) throw new BaroCadLoadAbortError();
        },
      });
      throwIfBaroCadAborted(request.signal);
      totalLoadedBytes += memberLoadedBytes;
      if (totalLoadedBytes > 1048576) throw new RangeError('BaroCAD model-set exceeds 1048576 bytes');
      accepted.push(Object.freeze({ aliasId: entry.aliasId, url: entry.url, result }));
    } catch (error) {
      child.abort();
      throw error;
    } finally {
      request.signal?.removeEventListener('abort', forwardAbort);
    }
  }
  await Promise.resolve();
  throwIfBaroCadAborted(request.signal);
  return Object.freeze({ format: 'barocad-model-set', version: 0, entries: Object.freeze(accepted), totalLoadedBytes });
}
