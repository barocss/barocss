const MAX_SOURCE_BYTES = 262144;
const MAX_DOCUMENT_BYTES = 2097152;
const MAX_FEATURE_GRAPH_BYTES = 1048576;
const MAX_BODY_CHUNKS = 4096;

export interface BaroCadLoadProgress {
  readonly url: string;
  readonly loadedBytes: number;
  /** HTTP Content-Length, when present and valid. It is a hint, not a byte limit. */
  readonly declaredTotalBytes?: number;
}

export interface BaroCadLoadTransportOptions {
  signal?: AbortSignal;
  /** Return false to stop with AbortError. A thrown error is passed to the caller. */
  onProgress?: (event: BaroCadLoadProgress) => void | false;
}

export class BaroCadLoadAbortError extends Error {
  readonly code = 'ABORT_ERR';

  constructor() {
    super('BaroCAD source load aborted');
    this.name = 'AbortError';
  }
}

export interface ValidatedBaroCadTransport {
  url: string;
  signal: AbortSignal | undefined;
  onProgress: BaroCadLoadTransportOptions['onProgress'];
}

export function validateBaroCadTransport(url: string, input: BaroCadLoadTransportOptions): ValidatedBaroCadTransport {
  if (typeof url !== 'string' || url.length === 0) throw new TypeError('A BaroCAD source URL is required');
  if (input === null || typeof input !== 'object' || Array.isArray(input) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(input))) {
    throw new TypeError('BaroCAD transport options must be a plain object');
  }
  const keys = Reflect.ownKeys(input);
  if (keys.length > 2 || !keys.every(key => key === 'signal' || key === 'onProgress')) {
    throw new TypeError('BaroCAD transport accepts signal and onProgress only');
  }
  const values: Record<string, unknown> = {};
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
      throw new TypeError(`BaroCAD transport ${String(key)} must be data`);
    }
    values[key as string] = descriptor.value;
  }
  if (values.signal !== undefined && !(values.signal instanceof AbortSignal)) {
    throw new TypeError('BaroCAD transport signal must be an AbortSignal');
  }
  if (values.onProgress !== undefined && typeof values.onProgress !== 'function') {
    throw new TypeError('BaroCAD onProgress must be a function');
  }
  return { url, signal: values.signal as AbortSignal | undefined, onProgress: values.onProgress as BaroCadLoadTransportOptions['onProgress'] };
}

export function throwIfBaroCadAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new BaroCadLoadAbortError();
}

async function cancelBody(body: ReadableStream<Uint8Array> | null): Promise<void> {
  try { await body?.cancel(); } catch { /* Preserve the original transport error. */ }
}

/** Read bounded UTF-8 text. A stream is required so a lying server cannot force an unbounded fallback buffer. */
async function readBoundedBaroCadText(
  transport: ValidatedBaroCadTransport, maximumBytes: number, label: 'source' | 'document' | 'feature graph',
): Promise<string> {
  const { url, signal, onProgress } = transport;
  throwIfBaroCadAborted(signal);
  let response: Response;
  try {
    response = await fetch(url, { signal });
  } catch (error) {
    throwIfBaroCadAborted(signal);
    throw error;
  }
  if (signal?.aborted) {
    await cancelBody(response.body);
    throw new BaroCadLoadAbortError();
  }
  if (!response.ok) {
    await cancelBody(response.body);
    throw new Error(`BaroCAD ${label} request failed: HTTP ${response.status}`);
  }
  const lengthHeader = response.headers.get('content-length');
  let declaredTotalBytes: number | undefined;
  if (lengthHeader !== null) {
    if (!/^(0|[1-9][0-9]*)$/.test(lengthHeader)) {
      await cancelBody(response.body);
      throw new RangeError('BaroCAD Content-Length must be a finite nonnegative decimal integer');
    }
    declaredTotalBytes = Number(lengthHeader);
    if (!Number.isSafeInteger(declaredTotalBytes)) {
      await cancelBody(response.body);
      throw new RangeError('BaroCAD Content-Length must be a finite safe integer');
    }
    if (declaredTotalBytes > maximumBytes) {
      await cancelBody(response.body);
      throw new RangeError(`BaroCAD ${label} exceeds ${maximumBytes} bytes`);
    }
  }
  if (!response.body) throw new TypeError('BaroCAD abortable loading requires a readable response body');
  const reader = response.body.getReader();
  const bytes = new Uint8Array(maximumBytes);
  let loadedBytes = 0;
  let chunks = 0;
  try {
    for (;;) {
      throwIfBaroCadAborted(signal);
      const { done, value } = await reader.read();
      throwIfBaroCadAborted(signal);
      if (done) break;
      if (!(value instanceof Uint8Array) || ++chunks > MAX_BODY_CHUNKS) {
        throw new RangeError(`BaroCAD ${label} stream must contain at most 4096 byte chunks`);
      }
      if (loadedBytes + value.byteLength > maximumBytes) {
        throw new RangeError(`BaroCAD ${label} exceeds ${maximumBytes} bytes`);
      }
      bytes.set(value, loadedBytes);
      loadedBytes += value.byteLength;
      if (value.byteLength && onProgress) {
        const decision = onProgress(Object.freeze({ url, loadedBytes, ...(declaredTotalBytes === undefined ? {} : { declaredTotalBytes }) }));
        throwIfBaroCadAborted(signal);
        if (decision === false) throw new BaroCadLoadAbortError();
      }
    }
  } catch (error) {
    try { await reader.cancel(); } catch { /* Preserve the original read or callback error. */ }
    throwIfBaroCadAborted(signal);
    throw error;
  } finally {
    reader.releaseLock();
  }
  throwIfBaroCadAborted(signal);
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, loadedBytes));
}

export function readAbortableBaroCadSource(transport: ValidatedBaroCadTransport): Promise<string> {
  return readBoundedBaroCadText(transport, MAX_SOURCE_BYTES, 'source');
}

export function readAbortableBaroCadDocument(transport: ValidatedBaroCadTransport): Promise<string> {
  return readBoundedBaroCadText(transport, MAX_DOCUMENT_BYTES, 'document');
}

export function readAbortableBaroCadFeatureGraph(transport: ValidatedBaroCadTransport): Promise<string> {
  return readBoundedBaroCadText(transport, MAX_FEATURE_GRAPH_BYTES, 'feature graph');
}
