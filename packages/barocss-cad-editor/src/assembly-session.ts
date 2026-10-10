import {
  evaluateCadAssembly, updateCadAssembly, validateCadAssemblyResult,
  parseCadAssembly, serializeCadAssembly, serializeCadDocument,
  CadAssemblyError, CadDocumentError,
} from '@barocss/cad';
import type { CadAssemblyV0, CadAssemblyResult } from '@barocss/cad';
import { CadEditorError } from './types.js';
import type {
  CadEditorAssemblyCandidate, CadEditorAssemblyDisplay, CadEditorAssemblyPending,
  CadEditorAssemblyPoseField, CadEditorAssemblySelectedInstance, CadEditorAssemblySelection,
  CadEditorAssemblySession, CadEditorAssemblySessionOptions, CadEditorAssemblySnapshot,
} from './assembly-types.js';

const FIELDS: CadEditorAssemblyPoseField[] = ['xMM', 'yMM', 'zMM', 'rxDeg', 'ryDeg', 'rzDeg', 'parentId'];
const REFERENCE_FIELDS = ['schema', 'version', 'documentId', 'documentRevision', 'bodyId', 'assetId',
  'assetRevision', 'geometryId', 'geometryKind', 'sourceVersion', 'sourceFrame', 'lengthUnit'];
const HISTORY_LIMIT = 20, HISTORY_BYTES = 64 * 1024 * 1024;
let sessionSequence = 0;

function check(condition: boolean, code: ConstructorParameters<typeof CadEditorError>[0], message: string,
  field: string): asserts condition {
  if (!condition) throw new CadEditorError(code, message, { field });
}
/** Only admitted private native CPU data reaches this copier. Preserve signed zero. */
function copy<T>(value: T): T {
  if (Array.isArray(value)) return value.map(child => copy(child)) as T;
  if (value !== null && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, copy(child)])) as T;
  return value;
}
function same(left: unknown, right: unknown): boolean {
  if (Array.isArray(left) || Array.isArray(right)) return Array.isArray(left) && Array.isArray(right)
    && left.length === right.length && left.every((value, index) => same(value, right[index]));
  if (left !== null && right !== null && typeof left === 'object' && typeof right === 'object') {
    const a = left as Record<string, unknown>, b = right as Record<string, unknown>;
    return Object.keys(a).length === Object.keys(b).length
      && Object.keys(a).every(key => Object.hasOwn(b, key) && same(a[key], b[key]));
  }
  return Object.is(left, right);
}
function native<T>(action: () => T, message: string, field: string): T {
  try { return action(); } catch (cause) {
    if (cause instanceof CadEditorError) throw cause;
    const actual = cause instanceof CadAssemblyError || cause instanceof CadDocumentError ? cause.code : null;
    const code = actual === 'STALE' ? 'STALE' : actual === 'BUDGET' ? 'BUDGET'
      : actual === 'REVISION' ? 'REVISION' : 'NATIVE';
    throw new CadEditorError(code, message, { field }, cause);
  }
}
function ownFields(input: unknown, allowed: string[], required: string[], field: string): Record<string, unknown> {
  check(input !== null && typeof input === 'object' && !Array.isArray(input)
    && [Object.prototype, null].includes(Object.getPrototypeOf(input)), 'INPUT', 'Plain own data is required.', field);
  const keys = Reflect.ownKeys(input), descriptors = Object.getOwnPropertyDescriptors(input);
  check(required.every(key => Object.hasOwn(descriptors, key)) && keys.length <= allowed.length
    && keys.every(key => typeof key === 'string' && allowed.includes(key)
      && descriptors[key].enumerable === true && 'value' in descriptors[key]),
  'INPUT', 'Unsupported fields, getters, symbols and hidden data are refused.', field);
  return Object.fromEntries((keys as string[]).map(key => [key, descriptors[key].value]));
}
function scalar(raw: string): number | undefined {
  const text = raw.trim();
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text)) return undefined;
  const value = Number(text);
  return Number.isFinite(value) ? value : undefined;
}
/** Native serialized text has already passed its own UTF-8 admission. */
function serializedBytes(text: string): number {
  let bytes = 0;
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index);
    if (code < 0x80) bytes++;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff) { index++; bytes += 4; }
    else bytes += 3;
  }
  return bytes;
}
function emptyPending(): CadEditorAssemblyPending { return { target: null, fields: {} }; }
interface HistoryState { text: string; bytes: number }
interface Prepared { candidate: CadEditorAssemblyCandidate; state?: HistoryState; historyIndex?: number }

/** Native Assembly authority only; no renderer, DOM, clock or implicit subscriptions. */
export function createCadEditorAssemblySession(document: CadAssemblyV0,
  options: CadEditorAssemblySessionOptions): CadEditorAssemblySession {
  const initialOptions = ownFields(options, ['displayInstanceIds'], ['displayInstanceIds'], 'assembly-display');
  let accepted = native(() => evaluateCadAssembly(document), 'Initial native Assembly refused.', 'assembly-file');
  function serialize(result: CadAssemblyResult): string {
    for (const part of result.assembly.parts) native(() => serializeCadDocument(part),
      'Embedded canonical part file admission refused.', 'assembly-file');
    return native(() => serializeCadAssembly(result.assembly), 'Native Assembly file admission refused.', 'assembly-file');
  }
  function admit(result: CadAssemblyResult, field: string): HistoryState {
    native(() => validateCadAssemblyResult(result), 'Whole native Assembly validation refused.', field);
    const text = serialize(result);
    return { text, bytes: serializedBytes(text) };
  }
  const initialState = admit(accepted, 'assembly-file');
  function displayFor(input: unknown, result = accepted): CadEditorAssemblyDisplay {
    const field = 'assembly-display';
    check(Array.isArray(input) && Object.getPrototypeOf(input) === Array.prototype,
      'INPUT', 'Choose an own array of displayed instance IDs.', field);
    const keys = Reflect.ownKeys(input), descriptors = Object.getOwnPropertyDescriptors(input) as Record<string, PropertyDescriptor>;
    const length = descriptors.length?.value;
    check(typeof length === 'number' && Number.isInteger(length) && length >= 0 && length <= 4
      && keys.length === length + 1 && keys.every(key => key === 'length'
        || typeof key === 'string' && /^(0|[1-9]\d*)$/.test(key) && Number(key) < length
          && descriptors[key].enumerable === true && 'value' in descriptors[key]),
    'INPUT', 'Display accepts 0..4 dense own instance IDs.', field);
    const ids: string[] = [];
    for (let index = 0; index < length; index++) {
      const descriptor = descriptors[String(index)];
      check(descriptor !== undefined && 'value' in descriptor && typeof descriptor.value === 'string',
        'INPUT', 'Displayed instance IDs must be own text values.', field);
      const id = descriptor.value;
      check(!ids.includes(id) && result.assembly.instances.some(instance => instance.id === id),
        'INPUT', 'Display IDs must be unique existing Assembly instances.', field);
      ids.push(id);
    }
    return { instanceIds: result.assembly.instances.filter(instance => ids.includes(instance.id)).map(instance => instance.id) };
  }
  function selected(instanceId: string, result = accepted, supplied?: CadEditorAssemblySelection): CadEditorAssemblySelectedInstance {
    const field = 'assembly-selection';
    check(typeof instanceId === 'string', 'INPUT', 'Choose an existing Assembly instance.', field);
    const instance = result.instances.find(value => value.instanceId === instanceId);
    check(instance !== undefined, 'INPUT', 'The selected Assembly instance is missing.', field);
    const binding: CadEditorAssemblySelection = { assemblyId: result.assembly.assemblyId,
      assemblyRevision: result.assembly.revision, instanceId, reference: copy(instance.reference) };
    if (supplied !== undefined) {
      const tuple = ownFields(supplied, ['assemblyId', 'assemblyRevision', 'instanceId', 'reference'],
        ['assemblyId', 'assemblyRevision', 'instanceId', 'reference'], field);
      const reference = ownFields(tuple.reference, REFERENCE_FIELDS, REFERENCE_FIELDS, field);
      check(same({ ...tuple, reference }, binding), 'STALE', 'The qualified Assembly instance binding is no longer current.', field);
    }
    return { binding, instance: copy(instance) };
  }
  let display = displayFor(initialOptions.displayInstanceIds);
  let selection: CadEditorAssemblySelectedInstance | null = null;
  let pending = emptyPending(), prepared: Prepared | null = null;
  let history: HistoryState[] = [initialState], historyIndex = 0;
  let generation = 0, displayGeneration = 0, dirty = true, disposed = false;
  let downloadStatus: CadEditorAssemblySnapshot['downloadStatus'] = 'Not downloaded';
  let download: { token: string; generation: number; revision: number } | null = null;
  const sessionId = ++sessionSequence;
  let tokenSequence = 0;
  const listeners = new Set<(snapshot: CadEditorAssemblySnapshot) => void>();
  const live = () => check(!disposed, 'LIFECYCLE', 'The Assembly session is disposed.', 'assembly-session');
  const historyBytes = () => history.reduce((total, state) => total + state.bytes, 0);
  const snapshot = (): CadEditorAssemblySnapshot => copy({ mode: 'assembly', accepted, generation, displayGeneration,
    display, selection, pending, candidate: prepared?.candidate ?? null,
    history: { index: historyIndex, count: history.length, bytes: historyBytes(),
      canUndo: historyIndex > 0, canRedo: historyIndex < history.length - 1 }, dirty, downloadStatus, disposed });
  const emit = () => {
    for (const listener of [...listeners]) {
      try { listener(snapshot()); } catch { /* A subscriber cannot reject native acceptance. */ }
    }
  };
  const newToken = () => `cad-editor-assembly-${sessionId}-${++tokenSequence}`;
  const noCandidate = () => check(prepared === null, 'INPUT', 'Resolve the prepared Assembly candidate first.', 'assembly-candidate');
  const resolvedDraft = () => check(pending.target === null && Object.keys(pending.fields).length === 0,
    'INPUT', 'Apply or discard the pending Assembly pose first.', 'assembly-pose');
  function prepare(kind: CadEditorAssemblyCandidate['kind'], result: CadAssemblyResult,
    proposedDisplay: CadEditorAssemblyDisplay, target: CadEditorAssemblySelectedInstance | null,
    state?: HistoryState, targetIndex?: number): CadEditorAssemblyCandidate {
    const legalDisplay = displayFor(proposedDisplay.instanceIds, result);
    const refreshed = target === null ? null : selected(target.binding.instanceId, result).binding;
    prepared = { candidate: { token: newToken(), kind, baseGeneration: generation, baseDisplayGeneration: displayGeneration,
      result, display: legalDisplay, selectionTarget: refreshed }, state, historyIndex: targetIndex };
    const returned = copy(prepared.candidate); emit(); return returned;
  }
  function restore(direction: -1 | 1): CadEditorAssemblyCandidate {
    live(); resolvedDraft(); noCandidate();
    const targetIndex = historyIndex + direction;
    check(targetIndex >= 0 && targetIndex < history.length, 'INPUT', 'This Assembly history direction is unavailable.', 'assembly-history');
    const saved = native(() => parseCadAssembly(history[targetIndex].text), 'Saved native Assembly history refused.', 'assembly-history');
    check(same(saved.assembly.parts, accepted.assembly.parts), 'NATIVE', 'History must preserve every complete embedded part.', 'assembly-history');
    const authored = copy(saved.assembly);
    authored.revision = accepted.assembly.revision + 1;
    const result = native(() => evaluateCadAssembly(authored), 'Native Assembly history reconstruction refused.', 'assembly-history');
    const state = admit(result, 'assembly-history');
    return prepare(direction < 0 ? 'undo' : 'redo', result, display, selection, state, targetIndex);
  }
  return {
    getSnapshot: snapshot,
    subscribe(listener) {
      live(); check(typeof listener === 'function', 'INPUT', 'An Assembly snapshot listener is required.', 'assembly-session');
      listeners.add(listener); return () => { listeners.delete(listener); };
    },
    selectInstance(instanceId, binding) {
      live(); const next = selected(instanceId, accepted, binding);
      if (selection?.binding.instanceId === instanceId) return snapshot();
      resolvedDraft(); noCandidate(); selection = next;
      const returned = snapshot(); emit(); return returned;
    },
    stagePoseField(field, raw) {
      live(); check(FIELDS.includes(field), 'INPUT', 'Choose a local pose or parent field.', 'assembly-pose');
      check(typeof raw === 'string' && raw.length <= 128, 'INPUT', 'Pose input must be text with at most 128 characters.', 'assembly-pose');
      check(selection !== null, 'INPUT', 'Select an Assembly instance first.', 'assembly-selection');
      const fields = { ...pending.fields }, instance = selection.instance;
      const fieldIndex = FIELDS.indexOf(field);
      const equal = field === 'parentId' ? (raw === '' ? null : raw) === instance.parentId
        : Object.is(scalar(raw), fieldIndex < 3 ? instance.placement.translationMM[fieldIndex]
          : instance.placement.rotationDegreesXYZ[fieldIndex - 3]);
      if (equal) delete fields[field]; else fields[field] = raw;
      pending = Object.keys(fields).length === 0 ? emptyPending() : { target: copy(selection.binding), fields };
      prepared = null; const returned = snapshot(); emit(); return returned;
    },
    discardPending() {
      live(); pending = emptyPending(); prepared = null; const returned = snapshot(); emit(); return returned;
    },
    prepareApply() {
      live(); noCandidate();
      if (pending.target === null || Object.keys(pending.fields).length === 0) return null;
      const current = selected(pending.target.instanceId, accepted, pending.target);
      const placement = copy(current.instance.placement);
      let parentId = current.instance.parentId;
      for (const field of FIELDS) if (Object.hasOwn(pending.fields, field)) {
        const raw = pending.fields[field]!;
        if (field === 'parentId') parentId = raw === '' ? null : raw;
        else {
          const value = scalar(raw);
          check(value !== undefined, 'INPUT', 'Pose input must be a finite decimal or exponent number.', 'assembly-pose');
          const index = FIELDS.indexOf(field);
          if (index < 3) placement.translationMM[index] = value;
          else placement.rotationDegreesXYZ[index - 3] = value;
        }
      }
      if (parentId === current.instance.parentId && same(placement, current.instance.placement)) {
        pending = emptyPending(); emit(); return null;
      }
      const result = native(() => updateCadAssembly(accepted, { expectedRevision: accepted.assembly.revision,
        revision: accepted.assembly.revision + 1, instanceEdits: [{ instanceId: current.binding.instanceId,
          parentId, translationMM: placement.translationMM, rotationDegreesXYZ: placement.rotationDegreesXYZ }] }),
      'Native Assembly pose update refused.', 'assembly-pose');
      const state = admit(result, 'assembly-pose');
      return prepare('apply', result, display, current, state);
    },
    prepareDisplayInstances(instanceIds) {
      live(); const proposed = displayFor(instanceIds); noCandidate();
      if (same(proposed, display)) return null;
      return prepare('display', accepted, proposed, selection);
    },
    prepareOpen(text, openOptions) {
      live();
      const result = native(() => parseCadAssembly(text), 'Native authored Assembly Open refused.', 'assembly-file');
      const state = admit(result, 'assembly-file');
      let ids: unknown;
      if (openOptions !== undefined) ids = ownFields(openOptions, ['displayInstanceIds'], ['displayInstanceIds'], 'assembly-display').displayInstanceIds;
      else {
        check(result.assembly.instances.length <= 4, 'INPUT', 'Choose an explicit 0..4 instance display set for this Assembly.', 'assembly-display');
        ids = result.assembly.instances.map(instance => instance.id);
      }
      const proposed = displayFor(ids, result); resolvedDraft(); noCandidate();
      return prepare('open', result, proposed, null, state);
    },
    prepareUndo() { return restore(-1); },
    prepareRedo() { return restore(1); },
    acceptCandidate(token) {
      live(); check(prepared !== null && prepared.candidate.token === token
        && prepared.candidate.baseGeneration === generation && prepared.candidate.baseDisplayGeneration === displayGeneration,
      'STALE', 'The Assembly candidate is no longer current.', 'assembly-candidate');
      const current = prepared, candidate = current.candidate;
      const refreshed = candidate.selectionTarget === null ? null
        : selected(candidate.selectionTarget.instanceId, candidate.result, candidate.selectionTarget);
      if (candidate.kind === 'display') {
        display = copy(candidate.display); selection = refreshed; displayGeneration++;
        prepared = null; const returned = snapshot(); emit(); return returned;
      }
      check(current.state !== undefined, 'NATIVE', 'The prepared authored Assembly history state is missing.', 'assembly-history');
      if (candidate.kind === 'open') { history = [current.state]; historyIndex = 0; }
      else if (candidate.kind === 'apply') {
        const states = [...history.slice(0, historyIndex + 1), current.state];
        let bytes = states.reduce((total, state) => total + state.bytes, 0);
        while (states.length > HISTORY_LIMIT || bytes > HISTORY_BYTES) bytes -= states.shift()!.bytes;
        history = states; historyIndex = history.length - 1;
      } else {
        check(current.historyIndex !== undefined && current.historyIndex >= 0 && current.historyIndex < history.length,
          'NATIVE', 'The prepared Assembly history position is missing.', 'assembly-history');
        historyIndex = current.historyIndex;
      }
      accepted = candidate.result; display = copy(candidate.display); selection = refreshed;
      generation++; if (candidate.kind === 'open') displayGeneration++;
      pending = emptyPending(); prepared = null; download = null;
      dirty = candidate.kind !== 'open'; downloadStatus = 'Not downloaded';
      const returned = snapshot(); emit(); return returned;
    },
    cancelCandidate(token) {
      live(); check(prepared !== null && prepared.candidate.token === token,
        'STALE', 'The Assembly candidate is no longer current.', 'assembly-candidate');
      prepared = null; emit();
    },
    serializeAccepted() {
      live(); const text = serialize(accepted), token = newToken();
      download = { token, generation, revision: accepted.assembly.revision };
      return { token, text, suggestedFilename: accepted.assembly.assemblyId + '.cad-assembly.json' };
    },
    markDownloaded(token) {
      live(); check(download !== null && download.token === token && download.generation === generation
        && download.revision === accepted.assembly.revision, 'STALE', 'The accepted Assembly changed after download capture.', 'assembly-file');
      dirty = false; downloadStatus = 'Download started'; emit();
    },
    dispose() {
      if (disposed) return;
      disposed = true; pending = emptyPending(); prepared = null; download = null; emit(); listeners.clear();
    },
  };
}
