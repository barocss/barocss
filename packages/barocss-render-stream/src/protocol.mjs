export const PROTOCOL_VERSION = 1;
export const STREAM_LIMITS = Object.freeze({ inputBytes: 256 * 1024, inputLineBytes: 32 * 1024,
  inputRecords: 256, nodes: 32, snapshots: 8, cssBytes: 128 * 1024,
  outputBytes: 2 * 1024 * 1024, outputLineBytes: 256 * 1024 });
const encoder = new TextEncoder();
const common = ['version', 'streamId', 'revision', 'seq', 'type'];
const unsafe = new Set(['__proto__', 'prototype', 'constructor']);
const idPattern = /^[a-zA-Z0-9_-]{1,64}$/;
const fail = (message) => { throw new Error(message); };
export function assertJsonData(value, depth = 0) {
  if (depth > 16) fail('Record nesting limit');
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number' && Number.isFinite(value)) return;
  if (typeof value !== 'object') fail('Expected JSON data');
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
    fail('Expected a plain JSON object');
  if (Array.isArray(value) && (Object.keys(value).length !== value.length
    || Object.keys(value).some((key, index) => key !== String(index)))) fail('Expected a JSON array');
  for (const key of Reflect.ownKeys(value)) {
    if (Array.isArray(value) && key === 'length') continue;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (typeof key !== 'string' || unsafe.has(key) || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value'))
      fail('Unsafe JSON field');
    assertJsonData(descriptor.value, depth + 1);
  }
}
export function exactFields(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Reflect.ownKeys(value).length !== keys.length || keys.some((key) => !Object.hasOwn(value, key)))
    fail('Unexpected record fields');
}
export function validateIdentity(identity) {
  assertJsonData(identity); exactFields(identity, ['streamId', 'revision']);
  if (!idPattern.test(identity.streamId) || typeof identity.streamId !== 'string'
    || !Number.isSafeInteger(identity.revision) || identity.revision <= 0) fail('Invalid stream identity');
}
function envelope(record, identity, expectedSeq) {
  assertJsonData(record); validateIdentity(identity);
  if (record.version !== PROTOCOL_VERSION || record.streamId !== identity.streamId || record.revision !== identity.revision)
    fail('Stream identity changed');
  if (!Number.isSafeInteger(record.seq) || record.seq !== expectedSeq || expectedSeq < 1) fail('Stream sequence changed');
}
export function validateInputRecord(record, identity, expectedSeq) {
  envelope(record, identity, expectedSeq);
  const fields = { node: [...common, 'id', 'node'], root: [...common, 'id'], checkpoint: common, commit: common };
  if (!Object.hasOwn(fields, record.type)) fail('Unknown input record');
  exactFields(record, fields[record.type]);
  if (['node', 'root'].includes(record.type) && (typeof record.id !== 'string' || !/^[a-z][a-z0-9-]{0,31}$/.test(record.id)))
    fail('Invalid node ID');
  if (record.type === 'node' && (!record.node || typeof record.node !== 'object' || Array.isArray(record.node)))
    fail('Expected node data');
  if (encoder.encode(JSON.stringify(record)).length > STREAM_LIMITS.inputLineBytes) fail('Input line limit');
  return record;
}
export function validateOutputRecord(record, identity, expectedSeq) {
  envelope(record, identity, expectedSeq);
  exactFields(record, [...common, 'sourceSeq', 'phase', 'spec', 'css']);
  if (record.type !== 'snapshot' || !['preview', 'committed'].includes(record.phase)
    || !Number.isSafeInteger(record.sourceSeq) || record.sourceSeq < 1 || record.sourceSeq > STREAM_LIMITS.inputRecords
    || !record.spec || typeof record.spec !== 'object' || Array.isArray(record.spec) || typeof record.css !== 'string')
    fail('Invalid output snapshot');
  if (encoder.encode(record.css).length > STREAM_LIMITS.cssBytes) fail('CSS limit');
  if (encoder.encode(JSON.stringify(record)).length > STREAM_LIMITS.outputLineBytes) fail('Output line limit');
  return record;
}
export function encodeRecord(record) { assertJsonData(record); return encoder.encode(`${JSON.stringify(record)}\n`); }

// JSON.parse keeps only one value for duplicate names. Check the original line
// before any parsed record reaches the host, including names written with escapes.
function assertUniqueMembers(text) {
  let index = 0;
  const skipSpace = () => { while (/[\t\n\r ]/.test(text[index] ?? '')) index++; };
  const readString = (key) => {
    const start = index++;
    while (text[index] !== '"') {
      if (text[index] === '\\') index += 2;
      else index++;
    }
    index++;
    return key ? JSON.parse(text.slice(start, index)) : undefined;
  };
  const walk = (depth) => {
    if (depth > 16) fail('Record nesting limit');
    skipSpace();
    if (text[index] === '{') {
      index++;
      const names = new Set();
      skipSpace();
      if (text[index] === '}') { index++; return; }
      while (true) {
        const name = readString(true);
        if (names.has(name)) fail('Duplicate JSON member');
        names.add(name);
        skipSpace(); index++; // colon; JSON.parse already checked the grammar
        walk(depth + 1);
        skipSpace();
        if (text[index] === '}') { index++; return; }
        index++; // comma
        skipSpace();
      }
    }
    if (text[index] === '[') {
      index++;
      skipSpace();
      if (text[index] === ']') { index++; return; }
      while (true) {
        walk(depth + 1);
        skipSpace();
        if (text[index] === ']') { index++; return; }
        index++; // comma
      }
    }
    if (text[index] === '"') { readString(false); return; }
    while (index < text.length && !/[\t\n\r ,}\]]/.test(text[index])) index++;
  };
  walk(0);
  skipSpace();
  if (index !== text.length) fail('Invalid JSON member scan');
}

export function createJsonlDecoder({ identity, kind = 'input', onRecord }) {
  validateIdentity(identity); identity = structuredClone(identity);
  if (!['input', 'output'].includes(kind) || typeof onRecord !== 'function') fail('Invalid decoder options');
  const maxBytes = kind === 'input' ? STREAM_LIMITS.inputBytes : STREAM_LIMITS.outputBytes;
  const maxLine = kind === 'input' ? STREAM_LIMITS.inputLineBytes : STREAM_LIMITS.outputLineBytes;
  const maxRecords = kind === 'input' ? STREAM_LIMITS.inputRecords : STREAM_LIMITS.snapshots;
  const validate = kind === 'input' ? validateInputRecord : validateOutputRecord;
  let pending = new Uint8Array(0), bytes = 0, records = 0, terminal = false, finished = false, halted = false, lastSourceSeq = 0;
  const guarded = (operation) => {
    if (halted || finished) fail('Decoder stopped');
    try { return operation(); } catch (error) { halted = true; throw error; }
  };
  return {
    push(chunk) { return guarded(() => {
      if (!(chunk instanceof Uint8Array)) fail('Expected stream bytes');
      if (bytes + chunk.length > maxBytes) fail('Stream byte limit');
      bytes += chunk.length;
      const joined = new Uint8Array(pending.length + chunk.length); joined.set(pending); joined.set(chunk, pending.length);
      let start = 0;
      for (let index = 0; index < joined.length; index++) {
        if (joined[index] !== 10) continue;
        if (terminal) fail('Record after terminal');
        if (index - start > maxLine) fail('Stream line limit');
        if (records >= maxRecords) fail('Stream record limit');
        const line = new TextDecoder('utf-8', { fatal: true }).decode(joined.subarray(start, index));
        const record = JSON.parse(line);
        assertUniqueMembers(line);
        validate(record, identity, records + 1);
        if (kind === 'output' && record.sourceSeq <= lastSourceSeq) fail('Source sequence changed');
        lastSourceSeq = record.sourceSeq ?? lastSourceSeq; records++;
        terminal = kind === 'input' ? record.type === 'commit' : record.phase === 'committed';
        onRecord(record); start = index + 1;
      }
      pending = joined.slice(start);
      if (pending.length > maxLine) fail('Stream line limit');
      if (terminal && pending.length) fail('Bytes after terminal');
    }); },
    finish() { return guarded(() => {
      if (pending.length) fail('Incomplete JSONL line');
      if (!terminal) fail('Missing terminal record');
      finished = true; return { bytes, records };
    }); },
  };
}
