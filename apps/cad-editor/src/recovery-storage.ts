import { parseCadDocument, serializeCadDocument } from '@barocss/cad';
import type { CadEditorSnapshot } from '@barocss/cad-editor';

export const RECOVERY_DB_NAME = 'barocss-cad-editor-recovery-v1';
export const RECOVERY_STORE_NAME = 'copies';
export const RECOVERY_SLOT_KEY = 'accepted';
export const RECOVERY_CHANGE_CHANNEL = RECOVERY_DB_NAME;
const ENVELOPE_LIMIT = 16 * 1024 * 1024;
const RECORD_FIELDS = ['schema', 'version', 'text', 'filename', 'displayBodyIds',
  'wasDirty', 'hadPending', 'savedAtUTC'];

export interface RecoveryRecord {
  schema: 'barocss-cad-editor-accepted-recovery';
  version: 1;
  text: string;
  filename: string;
  displayBodyIds: string[];
  wasDirty: boolean;
  hadPending: boolean;
  savedAtUTC: string;
}
export class RecoveryError extends Error {
  readonly code: 'INVALID' | 'STALE' | 'STORAGE';
  constructor(code: RecoveryError['code'], message: string, cause?: unknown) {
    super(message.slice(0, 1024), cause === undefined ? undefined : { cause });
    this.name = 'RecoveryError'; this.code = code;
  }
}
export interface RecoverySlot {
  raw: string | undefined;
  record: RecoveryRecord | null;
  error: RecoveryError | null;
}

function requireRecord(condition: boolean, message: string): asserts condition {
  if (!condition) throw new RecoveryError('INVALID', message);
}
function plain(input: unknown): asserts input is Record<string, unknown> {
  requireRecord(input !== null && typeof input === 'object' && !Array.isArray(input)
    && [Object.prototype, null].includes(Object.getPrototypeOf(input)), 'Recovery data must be a plain record.');
}
function ownField<T extends object, K extends keyof T>(input: T, key: K): T[K] {
  plain(input);
  const descriptor = Object.getOwnPropertyDescriptor(input, key);
  requireRecord(descriptor !== undefined && descriptor.enumerable === true && 'value' in descriptor,
    'Recovery input fields must be own data.');
  return descriptor.value as T[K];
}
function invalid(cause: unknown, message: string): RecoveryError {
  return cause instanceof RecoveryError ? cause : new RecoveryError('INVALID', message, cause);
}
function envelopeBudget(raw: string): void {
  requireRecord(raw.length <= ENVELOPE_LIMIT, 'Recovery envelope exceeds 16 MiB code units.');
  for (let index = 0; index < raw.length; index++) {
    const code = raw.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = raw.charCodeAt(++index);
      requireRecord(next >= 0xdc00 && next <= 0xdfff, 'Recovery envelope has an unpaired surrogate.');
    } else requireRecord(code < 0xdc00 || code > 0xdfff, 'Recovery envelope has an unpaired surrogate.');
  }
  requireRecord(new TextEncoder().encode(raw).length <= ENVELOPE_LIMIT, 'Recovery envelope exceeds 16 MiB UTF-8 bytes.');
}

function validateRecord(input: unknown): RecoveryRecord {
  plain(input);
  const descriptors = Object.getOwnPropertyDescriptors(input), keys = Reflect.ownKeys(input);
  requireRecord(keys.length === RECORD_FIELDS.length && RECORD_FIELDS.every(key => Object.hasOwn(descriptors, key))
    && keys.every(key => typeof key === 'string' && RECORD_FIELDS.includes(key)
      && 'value' in descriptors[key] && descriptors[key].enumerable === true), 'Recovery fields do not match version 1.');
  const data = Object.fromEntries(RECORD_FIELDS.map(key => [key, descriptors[key].value]));
  requireRecord(data.schema === 'barocss-cad-editor-accepted-recovery' && data.version === 1,
    'This recovery schema or version is unsupported.');
  requireRecord(typeof data.text === 'string', 'Recovery native text is required.');
  requireRecord(typeof data.filename === 'string' && data.filename.length >= 1 && data.filename.length <= 512,
    'Recovery filename must contain 1 through 512 code units.');
  requireRecord(typeof data.wasDirty === 'boolean' && typeof data.hadPending === 'boolean', 'Recovery flags must be booleans.');
  requireRecord(typeof data.savedAtUTC === 'string' && data.savedAtUTC.length <= 27
    && Number.isFinite(Date.parse(data.savedAtUTC)) && new Date(data.savedAtUTC).toISOString() === data.savedAtUTC,
  'Recovery time must be a canonical UTC ISO string.');
  let parsed;
  try { parsed = parseCadDocument(data.text); }
  catch (cause) { throw new RecoveryError('INVALID', 'The recovery native document is invalid.', cause); }
  const ids: unknown = data.displayBodyIds;
  requireRecord(Array.isArray(ids) && Object.getPrototypeOf(ids) === Array.prototype
    && ids.length >= 1 && ids.length <= 4, 'Recovery display must contain 1 through 4 body IDs.');
  const entries = Object.getOwnPropertyDescriptors(ids), entryKeys = Reflect.ownKeys(ids);
  requireRecord(entryKeys.length === ids.length + 1 && entryKeys.every(key => typeof key === 'string'),
    'Recovery display IDs must be dense own data.');
  const displayBodyIds = Array.from({ length: ids.length }, (_, index) => {
    const entry = entries[String(index)];
    requireRecord(entry !== undefined && entry.enumerable === true && 'value' in entry && typeof entry.value === 'string'
      && entry.value.length >= 1 && entry.value.length <= 512, 'Recovery display IDs must be bounded own strings.');
    return entry.value as string;
  });
  requireRecord(new Set(displayBodyIds).size === displayBodyIds.length
    && displayBodyIds.every(id => parsed.document.bodies.some(body => body.id === id)),
  'Recovery display IDs must be unique bodies in the native document.');
  return { schema: 'barocss-cad-editor-accepted-recovery', version: 1, text: data.text,
    filename: data.filename, displayBodyIds, wasDirty: data.wasDirty, hadPending: data.hadPending, savedAtUTC: data.savedAtUTC };
}

/** Capture accepted authored content without touching native Download capture or raw drafts. */
export function buildRecoveryRecord(snapshot: CadEditorSnapshot, filename: string, effectiveWasDirty: boolean): RecoveryRecord {
  requireRecord(ownField(snapshot, 'disposed') === false, 'The document session is disposed.');
  const accepted = ownField(snapshot, 'accepted'), pending = ownField(snapshot, 'pending');
  plain(pending);
  let text;
  try { text = serializeCadDocument(ownField(accepted, 'document')); }
  catch (cause) { throw new RecoveryError('INVALID', 'The accepted document cannot be serialized.', cause); }
  return validateRecord({ schema: 'barocss-cad-editor-accepted-recovery', version: 1, text, filename,
    displayBodyIds: ownField(snapshot, 'displayBodyIds'), wasDirty: effectiveWasDirty,
    hadPending: Object.keys(pending).length > 0 || ownField(snapshot, 'selectionTransition') !== null,
    savedAtUTC: new Date().toISOString() });
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const fail = (cause: unknown, message: string) => {
      if (settled) return;
      settled = true; clearTimeout(timer);
      reject(new RecoveryError('STORAGE', message, cause));
    };
    const timer = setTimeout(() => fail(undefined, 'Opening recovery storage timed out.'), 5000);
    let request: IDBOpenDBRequest;
    try { request = indexedDB.open(RECOVERY_DB_NAME, 1); }
    catch (cause) { fail(cause, 'Recovery storage is unavailable.'); return; }
    request.onblocked = () => fail(undefined, 'Recovery storage is blocked by another browser connection.');
    request.onerror = () => fail(request.error, 'Opening recovery storage failed.');
    request.onupgradeneeded = () => {
      if (settled) { request.transaction?.abort(); return; }
      try { request.result.createObjectStore(RECOVERY_STORE_NAME); }
      catch (cause) { request.transaction?.abort(); fail(cause, 'Creating recovery storage failed.'); }
    };
    request.onsuccess = () => {
      const database = request.result;
      if (settled) { database.close(); return; }
      settled = true; clearTimeout(timer);
      database.onversionchange = () => database.close();
      resolve(database);
    };
  });
}

/** GET, existence check and optional mutation stay in one actual transaction event chain. */
async function transactSlot(mode: 'readonly' | 'readwrite', action: (store: IDBObjectStore, raw: string | undefined) => void): Promise<string | undefined> {
  const database = await openDatabase();
  try {
    return await new Promise<string | undefined>((resolve, reject) => {
      let transaction: IDBTransaction;
      try { transaction = database.transaction(RECOVERY_STORE_NAME, mode); }
      catch (cause) { reject(new RecoveryError('STORAGE', 'Recovery storage transaction could not start.', cause)); return; }
      let raw: string | undefined, failure: RecoveryError | null = null;
      transaction.oncomplete = () => resolve(raw);
      transaction.onabort = () => reject(failure ?? new RecoveryError('STORAGE', 'Recovery storage transaction aborted.', transaction.error));
      transaction.onerror = () => { failure ??= new RecoveryError('STORAGE', 'Recovery storage transaction failed.', transaction.error); };
      const abort = (cause: unknown) => {
        failure = cause instanceof RecoveryError ? cause : new RecoveryError('STORAGE', 'Recovery storage operation failed.', cause);
        try { transaction.abort(); } catch { reject(failure); }
      };
      try {
        const store = transaction.objectStore(RECOVERY_STORE_NAME);
        const valueRequest = store.get(RECOVERY_SLOT_KEY), keyRequest = store.getKey(RECOVERY_SLOT_KEY);
        let remaining = 2;
        const received = () => {
          if (--remaining !== 0) return;
          try {
            const value: unknown = valueRequest.result;
            if (keyRequest.result !== undefined && typeof value !== 'string')
              throw new RecoveryError('STORAGE', 'This recovery slot contains unreadable non-string data.');
            raw = keyRequest.result === undefined ? undefined : value as string;
            action(store, raw);
          } catch (cause) { abort(cause); }
        };
        valueRequest.onsuccess = received; keyRequest.onsuccess = received;
      } catch (cause) { abort(cause); }
    });
  } finally { database.close(); }
}

export async function readRecoverySlot(): Promise<RecoverySlot> {
  const raw = await transactSlot('readonly', () => {});
  if (raw === undefined) return { raw, record: null, error: null };
  try {
    envelopeBudget(raw);
    return { raw, record: validateRecord(JSON.parse(raw)), error: null };
  } catch (cause) { return { raw, record: null, error: invalid(cause, 'This recovery copy is unreadable.') }; }
}

function expectedValue(raw: string | undefined): void {
  if (raw !== undefined && typeof raw !== 'string') throw new RecoveryError('INVALID', 'Expected recovery identity must be absent or a raw string.');
}
function changeHint(): void {
  // A hint failure cannot undo a committed transaction or authorize a blind retry.
  let channel: BroadcastChannel | null = null;
  try { channel = new BroadcastChannel(RECOVERY_CHANGE_CHANNEL); channel.postMessage({ changed: true }); }
  catch { /* Hosts also reread on focus and before every action. */ }
  finally { try { channel?.close(); } catch { /* The transaction already committed. */ } }
}
export async function writeRecoveryCopy(expectedRaw: string | undefined, record: RecoveryRecord): Promise<void> {
  expectedValue(expectedRaw);
  let raw: string;
  try { raw = JSON.stringify(validateRecord(record)); envelopeBudget(raw); }
  catch (cause) { throw invalid(cause, 'The recovery copy cannot be encoded.'); }
  await transactSlot('readwrite', (store, current) => {
    if (!Object.is(current, expectedRaw)) throw new RecoveryError('STALE', 'The stored recovery copy changed. Read it again.');
    store.put(raw, RECOVERY_SLOT_KEY);
  });
  changeHint();
}
export async function deleteRecoveryCopy(expectedRaw: string | undefined): Promise<void> {
  expectedValue(expectedRaw);
  await transactSlot('readwrite', (store, current) => {
    if (!Object.is(current, expectedRaw)) throw new RecoveryError('STALE', 'The stored recovery copy changed. Read it again.');
    store.delete(RECOVERY_SLOT_KEY);
  });
  changeHint();
}
