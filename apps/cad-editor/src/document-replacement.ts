import { CadEditorError, type CadEditorSession, type CadEditorSnapshot } from '@barocss/cad-editor';

const STATE_FIELDS = ['generation', 'displayGeneration', 'selectedBodyId', 'selection', 'pending',
  'selectionTransition', 'candidate', 'dirty', 'downloadStatus', 'disposed'] as const;
type ReplacementState = Pick<CadEditorSnapshot, typeof STATE_FIELDS[number]>;
export type ReplacementAnchor = ReplacementState & { session: CadEditorSession };
export interface ReplacementTarget {
  kind: 'open' | 'sample';
  text: string;
  filename: string;
  displayBodyIds?: string[];
}

function requireReplacement(condition: boolean, code: 'INPUT' | 'STALE' | 'LIFECYCLE', message: string): asserts condition {
  if (!condition) throw new CadEditorError(code, message, { field: 'document-replacement' });
}
function state(snapshot: CadEditorSnapshot): ReplacementState {
  return structuredClone(Object.fromEntries(STATE_FIELDS.map(field => [field, snapshot[field]]))) as ReplacementState;
}
/** Compare own data without coercion, getter calls or signed-zero normalization. */
function same(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b) || Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) return false;
  const left = Object.getOwnPropertyDescriptors(a), right = Object.getOwnPropertyDescriptors(b);
  const keys = Reflect.ownKeys(a), otherKeys = Reflect.ownKeys(b);
  return keys.length === otherKeys.length && keys.every(key => typeof key === 'string'
    && Object.hasOwn(right, key) && 'value' in left[key] && 'value' in right[key]
    && left[key].enumerable === right[key].enumerable && same(left[key].value, right[key].value));
}

export function captureReplacementAnchor(session: CadEditorSession): ReplacementAnchor {
  const snapshot = session.getSnapshot();
  requireReplacement(!snapshot.disposed, 'LIFECYCLE', 'The document session is disposed.');
  requireReplacement(Object.keys(snapshot.pending).length === 0 && snapshot.selectionTransition === null
    && snapshot.candidate === null, 'INPUT', 'Apply or discard the draft and resolve the current decision first.');
  return { session, ...state(snapshot) };
}

export function assertReplacementCurrent(session: CadEditorSession, anchor: ReplacementAnchor): void {
  requireReplacement(anchor !== null && typeof anchor === 'object' && !Array.isArray(anchor)
    && [Object.prototype, null].includes(Object.getPrototypeOf(anchor)), 'STALE', 'The replacement request is no longer current.');
  const fields = Object.getOwnPropertyDescriptors(anchor), keys = Reflect.ownKeys(anchor);
  requireReplacement(keys.length === STATE_FIELDS.length + 1 && keys.every(key => typeof key === 'string'
    && (key === 'session' || STATE_FIELDS.includes(key as typeof STATE_FIELDS[number]))
    && 'value' in fields[key] && fields[key].enumerable === true)
    && fields.session?.value === session, 'STALE', 'The replacement request belongs to another state or session.');
  const snapshot = session.getSnapshot();
  requireReplacement(!snapshot.disposed && Object.keys(snapshot.pending).length === 0
    && snapshot.selectionTransition === null && snapshot.candidate === null
    && STATE_FIELDS.every(field => same(snapshot[field], fields[field].value)),
  'STALE', 'The document changed. Start Open or New again.');
}

export function copyReplacementTarget(target: ReplacementTarget): ReplacementTarget {
  requireReplacement(target !== null && typeof target === 'object' && !Array.isArray(target)
    && [Object.prototype, null].includes(Object.getPrototypeOf(target)), 'INPUT', 'A plain replacement target is required.');
  const fields = Object.getOwnPropertyDescriptors(target), keys = Reflect.ownKeys(target);
  requireReplacement(keys.length >= 3 && keys.length <= 4
    && ['kind', 'text', 'filename'].every(key => Object.hasOwn(fields, key))
    && keys.every(key => typeof key === 'string' && ['kind', 'text', 'filename', 'displayBodyIds'].includes(key)
      && 'value' in fields[key] && fields[key].enumerable === true), 'INPUT', 'Replacement fields must be plain own data.');
  const kind = fields.kind.value, text = fields.text.value, filename = fields.filename.value;
  requireReplacement((kind === 'open' || kind === 'sample') && typeof text === 'string' && typeof filename === 'string',
    'INPUT', 'An Open or sample target with text and filename is required.');
  if (!Object.hasOwn(fields, 'displayBodyIds')) return { kind, text, filename };
  const ids: unknown = fields.displayBodyIds!.value;
  if (ids === undefined) return { kind, text, filename, displayBodyIds: undefined };
  requireReplacement(Array.isArray(ids) && Object.getPrototypeOf(ids) === Array.prototype,
    'INPUT', 'Display body IDs must be a plain array.');
  const entries = Object.getOwnPropertyDescriptors(ids), entryKeys = Reflect.ownKeys(ids);
  requireReplacement(entryKeys.length === ids.length + 1 && entryKeys.every(key => typeof key === 'string'),
    'INPUT', 'Display body IDs must be dense own data.');
  const displayBodyIds = Array.from({ length: ids.length }, (_, index) => {
    const entry = entries[String(index)];
    requireReplacement(entry !== undefined && entry.enumerable === true && 'value' in entry
      && typeof entry.value === 'string', 'INPUT', 'Display body IDs must be own strings.');
    return entry.value as string;
  });
  return { kind, text, filename, displayBodyIds };
}
