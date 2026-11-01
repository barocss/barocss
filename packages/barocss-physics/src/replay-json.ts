import { canonicalEncode } from './identity.js';
import { PhysicsError } from './index.js';
import type { FailureCode } from './types.js';

export function replayError(code: FailureCode, message: string): never {
  throw new PhysicsError(code, message);
}

interface Budget { nodes: number; seen: Set<object> }

function copyValue(input: unknown, label: string, depth: number, budget: Budget): unknown {
  if (++budget.nodes > 50000 || depth > 32) replayError('INVALID_SNAPSHOT', `${label} exceeds JSON depth or size`);
  if (input === null || typeof input === 'string' || typeof input === 'boolean') return input;
  if (typeof input === 'number') {
    if (!Number.isFinite(input)) replayError('INVALID_SNAPSHOT', `${label} contains a nonfinite number`);
    return input;
  }
  if (typeof input !== 'object' || ![Object.prototype, null, Array.prototype].includes(Object.getPrototypeOf(input))) {
    replayError('INVALID_SNAPSHOT', `${label} must be plain JSON-compatible data`);
  }
  if (budget.seen.has(input)) replayError('INVALID_SNAPSHOT', `${label} has a cycle`);
  budget.seen.add(input);
  let output: unknown;
  if (Array.isArray(input)) {
    if (input.length > 4096 || Reflect.ownKeys(input).length !== input.length + 1) {
      replayError('INVALID_SNAPSHOT', `${label} must be a bounded dense array`);
    }
    const copied: unknown[] = [];
    for (let index = 0; index < input.length; index++) {
      const field = Object.getOwnPropertyDescriptor(input, String(index));
      if (!field?.enumerable || !('value' in field)) replayError('INVALID_SNAPSHOT', `${label}[${index}] must be data`);
      copied.push(copyValue(field.value, `${label}[${index}]`, depth + 1, budget));
    }
    output = copied;
  } else {
    const keys = Reflect.ownKeys(input);
    if (keys.length > 64 || keys.some((key) => typeof key !== 'string' || !/^[\x20-\x7e]+$/.test(key))) {
      replayError('INVALID_SNAPSHOT', `${label} has unsupported fields`);
    }
    const copied: Record<string, unknown> = {};
    for (const key of keys as string[]) {
      const field = Object.getOwnPropertyDescriptor(input, key);
      if (!field?.enumerable || !('value' in field)) replayError('INVALID_SNAPSHOT', `${label}.${key} must be data`);
      Object.defineProperty(copied, key, { value: copyValue(field.value, `${label}.${key}`, depth + 1, budget), enumerable: true, writable: true, configurable: true });
    }
    output = copied;
  }
  budget.seen.delete(input);
  return output;
}

export function copyReplayJson<T>(input: T, label: string): T {
  return copyValue(input, label, 0, { nodes: 0, seen: new Set() }) as T;
}

export function exactFields(value: unknown, fields: string[], label: string): asserts value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value) ||
    Reflect.ownKeys(value).length !== fields.length ||
    Reflect.ownKeys(value).some((key) => typeof key !== 'string' || !fields.includes(key))) {
    replayError('INVALID_SNAPSHOT', `${label} has missing or unsupported fields`);
  }
}

/** Exact input comparison preserves signed zero and record order independence. */
export function equivalentReplayIdentity(left: unknown, right: unknown): boolean {
  const a = canonicalEncode(left), b = canonicalEncode(right);
  return a.length === b.length && a.every((byte, index) => byte === b[index]);
}

/** BCPHSNP1 + P0 canonical typed encoding. No JSON or format migration reader. */
const SNAPSHOT_MAGIC = Uint8Array.of(66, 67, 80, 72, 83, 78, 80, 49);
export const MAX_SNAPSHOT_BYTES = 1024 * 1024;

export function encodeSnapshotData(input: unknown): Uint8Array {
  const data = canonicalEncode(copyReplayJson(input, 'snapshot'));
  if (data.length + SNAPSHOT_MAGIC.length > MAX_SNAPSHOT_BYTES) replayError('INVALID_SNAPSHOT', 'snapshot exceeds byte limit');
  const bytes = new Uint8Array(data.length + SNAPSHOT_MAGIC.length);
  bytes.set(SNAPSHOT_MAGIC); bytes.set(data, SNAPSHOT_MAGIC.length);
  return bytes;
}

export function decodeSnapshotData(input: Uint8Array): unknown {
  if (!(input instanceof Uint8Array) || input.length > MAX_SNAPSHOT_BYTES ||
    input.length <= SNAPSHOT_MAGIC.length || !SNAPSHOT_MAGIC.every((byte, index) => input[index] === byte)) {
    replayError('INVALID_SNAPSHOT', 'unsupported snapshot wire format or byte limit');
  }
  // Own the bytes: decoder must never depend on caller mutations.
  const bytes = Uint8Array.from(input);
  const view = new DataView(bytes.buffer);
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let offset = SNAPSHOT_MAGIC.length, nodes = 0;
  function take(length: number): number {
    if (length > bytes.length - offset) replayError('INVALID_SNAPSHOT', 'truncated snapshot');
    const start = offset; offset += length; return start;
  }
  function uint32(): number { return view.getUint32(take(4), true); }
  function read(depth: number): unknown {
    if (++nodes > 50000 || depth > 32) replayError('INVALID_SNAPSHOT', 'snapshot exceeds node or depth limit');
    const tag = bytes[take(1)];
    if (tag === 0) return null;
    if (tag === 1 || tag === 2) return tag === 2;
    if (tag === 3) {
      const length = uint32(), start = take(length);
      return decoder.decode(bytes.subarray(start, start + length));
    }
    if (tag === 4) {
      const value = view.getFloat64(take(8), true);
      if (!Number.isFinite(value)) replayError('INVALID_SNAPSHOT', 'snapshot contains nonfinite number');
      return value;
    }
    if (tag === 5) {
      const length = uint32();
      if (length > 4096) replayError('INVALID_SNAPSHOT', 'snapshot array exceeds limit');
      return Array.from({ length }, () => read(depth + 1));
    }
    if (tag === 6) {
      const length = uint32();
      if (length > 64) replayError('INVALID_SNAPSHOT', 'snapshot record exceeds limit');
      const result: Record<string, unknown> = {};
      let previous: string | undefined;
      for (let i = 0; i < length; i++) {
        const key = read(depth + 1);
        if (typeof key !== 'string' || !/^[\x20-\x7e]+$/.test(key) || (previous !== undefined && key <= previous)) {
          replayError('INVALID_SNAPSHOT', 'snapshot record keys must be unique canonical ASCII');
        }
        Object.defineProperty(result, key, { value: read(depth + 1), enumerable: true, writable: true, configurable: true });
        previous = key;
      }
      return result;
    }
    replayError('INVALID_SNAPSHOT', 'unknown snapshot data tag');
  }
  try {
    const result = read(0);
    if (offset !== bytes.length) replayError('INVALID_SNAPSHOT', 'snapshot has trailing bytes');
    return result;
  } catch (error) {
    if (error instanceof PhysicsError) throw error;
    replayError('INVALID_SNAPSHOT', 'invalid snapshot encoding');
  }
}
