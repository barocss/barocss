import {
  evaluateDrivenMixedSketchLines, updateDrivenMixedSketchLines, validateDrivenMixedSketchLines,
  parseDrivenMixedSketchLines, serializeDrivenMixedSketchLines, DrivenMixedSketchLinesError,
} from '@barocss/cad';
import type { DrivenMixedSketchLinesDocumentV0, DrivenMixedSketchLinesResult, XYLinearSketchConstraintV1 } from '@barocss/cad';
import { CadEditorError } from './types.js';
import type {
  CadEditorDrivingSketchCandidate, CadEditorDrivingSketchConstraintField, CadEditorDrivingSketchPending,
  CadEditorDrivingSketchSelection, CadEditorDrivingSketchSession, CadEditorDrivingSketchSessionOptions,
  CadEditorDrivingSketchSnapshot, CadEditorDrivingSketchView,
} from './driving-types.js';

const FIELDS: CadEditorDrivingSketchConstraintField[] = ['distanceMM', 'xMM', 'yMM'];
const HISTORY_LIMIT = 20, HISTORY_BYTES = 8 * 1024 * 1024;
let sessionSequence = 0;

function check(condition: boolean, code: ConstructorParameters<typeof CadEditorError>[0], message: string,
  field: string): asserts condition {
  if (!condition) throw new CadEditorError(code, message, { field });
}
/** Only privately admitted native CPU data reaches this copy. Keep signed-zero bits. */
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
    const code = cause instanceof DrivenMixedSketchLinesError && cause.code === 'BUDGET' ? 'BUDGET' : 'NATIVE';
    throw new CadEditorError(code, message, { field }, cause);
  }
}
function ownFields(input: unknown, fields: string[], field: string): Record<string, unknown> {
  check(input !== null && typeof input === 'object' && !Array.isArray(input)
    && [Object.prototype, null].includes(Object.getPrototypeOf(input)), 'INPUT', 'Plain own data is required.', field);
  const keys = Reflect.ownKeys(input), descriptors = Object.getOwnPropertyDescriptors(input);
  check(keys.length === fields.length && fields.every(key => Object.hasOwn(descriptors, key))
    && keys.every(key => typeof key === 'string' && fields.includes(key)
      && descriptors[key].enumerable === true && 'value' in descriptors[key]),
  'INPUT', 'Exact fields without getters, symbols or hidden data are required.', field);
  return Object.fromEntries((keys as string[]).map(key => [key, descriptors[key].value]));
}
/** Copy the small caller selection receipt before comparing any nested fields. */
function selectionData(input: unknown): unknown {
  let remaining = 2048;
  const ancestors = new Set<object>(), field = 'driving-selection';
  function snapshot(value: unknown, depth: number): unknown {
    check(--remaining >= 0 && depth <= 8, 'INPUT', 'The selection receipt exceeds its own-data bounds.', field);
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'number') {
      check(Number.isFinite(value), 'INPUT', 'Selection numbers must be finite.', field); return value;
    }
    if (typeof value === 'string') {
      check(value.length <= 128, 'INPUT', 'Selection text must be bounded.', field); return value;
    }
    check(typeof value === 'object' && !ancestors.has(value), 'INPUT', 'Acyclic own selection data is required.', field);
    const array = Array.isArray(value), prototype = Object.getPrototypeOf(value);
    check(array ? prototype === Array.prototype : prototype === Object.prototype || prototype === null,
      'INPUT', 'Plain selection data is required.', field);
    const keys = Reflect.ownKeys(value), descriptors = Object.getOwnPropertyDescriptors(value) as Record<string, PropertyDescriptor>;
    check(keys.length <= 65 && keys.every(key => typeof key === 'string' && 'value' in descriptors[key]
      && (array && key === 'length' || descriptors[key].enumerable === true)),
    'INPUT', 'Selection getters, symbols and hidden fields are refused.', field);
    ancestors.add(value);
    let result: unknown;
    if (array) {
      const length = descriptors.length?.value;
      check(typeof length === 'number' && Number.isInteger(length) && length >= 0 && length <= 64
        && keys.length === length + 1, 'INPUT', 'Dense bounded selection arrays are required.', field);
      result = Array.from({ length }, (_, index) => {
        check(Object.hasOwn(descriptors, String(index)), 'INPUT', 'Sparse selection arrays are refused.', field);
        return snapshot(descriptors[String(index)].value, depth + 1);
      });
    } else result = Object.fromEntries((keys as string[]).map(key => [key, snapshot(descriptors[key].value, depth + 1)]));
    ancestors.delete(value); return result;
  }
  return snapshot(input, 0);
}
function scalar(raw: string): number | undefined {
  const text = raw.trim();
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text)) return undefined;
  const value = Number(text); return Number.isFinite(value) ? value : undefined;
}
/** This text has already passed the actual native authored codec admission. */
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
function emptyPending(): CadEditorDrivingSketchPending { return { fields: {} }; }
interface HistoryState { text: string; bytes: number }
interface Prepared { candidate: CadEditorDrivingSketchCandidate; state?: HistoryState; historyIndex?: number }

/** Original authored seed and active constraint authority; no renderer, DOM or clock. */
export function createCadEditorDrivingSketchSession(document: DrivenMixedSketchLinesDocumentV0,
  options: CadEditorDrivingSketchSessionOptions): CadEditorDrivingSketchSession {
  const initialOptions = ownFields(options, ['initialProfileId'], 'driving-view');
  let accepted = native(() => evaluateDrivenMixedSketchLines(document), 'Initial native Driving Sketch refused.', 'driving-file');
  function serialize(result: DrivenMixedSketchLinesResult): string {
    return native(() => serializeDrivenMixedSketchLines(result.document), 'Native authored Driving Sketch file refused.', 'driving-file');
  }
  function admit(result: DrivenMixedSketchLinesResult, field: string): HistoryState {
    native(() => validateDrivenMixedSketchLines(result), 'Whole native Driving Sketch validation refused.', field);
    const text = serialize(result); return { text, bytes: serializedBytes(text) };
  }
  const initialState = admit(accepted, 'driving-file');
  function viewFor(profileId: unknown, result = accepted): CadEditorDrivingSketchView {
    check(typeof profileId === 'string' && result.target.profiles.some(profile => profile.profileId === profileId),
      'INPUT', 'Choose an explicit existing complete Sketch profile.', 'driving-view');
    return { profileId };
  }
  const initialView = viewFor(initialOptions.initialProfileId);
  let view = copy(initialView), selection: CadEditorDrivingSketchSelection | null = null;
  let pending = emptyPending(), prepared: Prepared | null = null;
  let history: HistoryState[] = [initialState], historyIndex = 0, generation = 0, displayGeneration = 0;
  let dirty = true, disposed = false;
  let downloadStatus: CadEditorDrivingSketchSnapshot['downloadStatus'] = 'Not downloaded';
  let download: { token: string; generation: number } | null = null;
  const listeners = new Set<(snapshot: CadEditorDrivingSketchSnapshot) => void>();
  const sessionId = ++sessionSequence;
  let tokenSequence = 0;
  function selectedPoint(profileId: string, pointId: string, result = accepted,
    epoch = generation, binding?: CadEditorDrivingSketchSelection): CadEditorDrivingSketchSelection {
    const field = 'driving-selection';
    check(typeof profileId === 'string' && typeof pointId === 'string', 'INPUT', 'Choose an original selected-scope point.', field);
    check(result.document.selectedProfileIds.includes(profileId), 'UNSUPPORTED', 'Only the selected Line and Polyline scope is editable.', field);
    const profile = result.document.seed.profiles.find(value => value.id === profileId);
    check(profile !== undefined && (profile.kind === 'line' || profile.kind === 'polyline'),
      'UNSUPPORTED', 'Only original Line and Polyline points are editable.', field);
    const point = result.target.worldPointBindings.find(value => value.profileId === profileId && value.pointId === pointId);
    check(point !== undefined && point.role === 'vertex' && !point.isClosing,
      'INPUT', 'The selected original Sketch point is missing.', field);
    const selected = { generation: epoch, native: copy(point) };
    if (binding !== undefined) {
      const supplied = ownFields(selectionData(binding), ['generation', 'native'], field);
      check(same(supplied, selected), 'STALE', 'The original local/world Sketch point binding is no longer current.', field);
    }
    return selected;
  }
  const live = () => check(!disposed, 'LIFECYCLE', 'The Driving Sketch session is disposed.', 'driving-session');
  const historyBytes = () => history.reduce((total, state) => total + state.bytes, 0);
  const snapshot = (): CadEditorDrivingSketchSnapshot => copy({ mode: 'driven-mixed-sketch-lines', accepted, generation,
    displayGeneration, selectedScopeIds: accepted.document.selectedProfileIds, view, selection, pending,
    candidate: prepared?.candidate ?? null,
    history: { index: historyIndex, count: history.length, bytes: historyBytes(),
      canUndo: historyIndex > 0, canRedo: historyIndex < history.length - 1 }, dirty, downloadStatus, disposed });
  const emit = () => {
    for (const listener of [...listeners]) {
      try { listener(snapshot()); } catch { /* Subscriber faults cannot reject native acceptance. */ }
    }
  };
  const newToken = () => `cad-editor-driving-${sessionId}-${++tokenSequence}`;
  const noCandidate = () => check(prepared === null, 'INPUT', 'Resolve the prepared Driving Sketch candidate first.', 'driving-candidate');
  const resolvedDraft = () => check(Object.keys(pending.fields).length === 0, 'INPUT',
    'Apply or discard the pending driving fields first.', 'driving-constraint');
  const logicalTarget = (): CadEditorDrivingSketchCandidate['selectionTarget'] => selection === null ? null
    : { profileId: selection.native.profileId, pointId: selection.native.pointId };
  function prepare(kind: CadEditorDrivingSketchCandidate['kind'], result: DrivenMixedSketchLinesResult,
    proposedView: CadEditorDrivingSketchView, target: CadEditorDrivingSketchCandidate['selectionTarget'],
    state?: HistoryState, targetIndex?: number): CadEditorDrivingSketchCandidate {
    const legalView = viewFor(proposedView.profileId, result);
    if (target !== null) selectedPoint(target.profileId, target.pointId, result);
    prepared = { candidate: { kind, token: newToken(), baseGeneration: generation, baseDisplayGeneration: displayGeneration,
      result, view: legalView, selectionTarget: copy(target) }, state, historyIndex: targetIndex };
    const returned = copy(prepared.candidate); emit(); return returned;
  }
  function update(constraints: XYLinearSketchConstraintV1[]): DrivenMixedSketchLinesResult {
    const result = native(() => updateDrivenMixedSketchLines(accepted.document, { seedEdit: null, constraints }),
      'Native driving constraint recipe refused.', 'driving-constraint');
    native(() => validateDrivenMixedSketchLines(result), 'Whole native driving recipe validation refused.', 'driving-constraint');
    return result;
  }
  function authoredState(result: DrivenMixedSketchLinesResult): HistoryState {
    const text = serialize(result); return { text, bytes: serializedBytes(text) };
  }
  function restore(direction: -1 | 1): CadEditorDrivingSketchCandidate {
    live(); resolvedDraft(); noCandidate();
    const targetIndex = historyIndex + direction;
    check(targetIndex >= 0 && targetIndex < history.length, 'INPUT', 'This Sketch history direction is unavailable.', 'driving-history');
    const authored = native(() => parseDrivenMixedSketchLines(history[targetIndex].text),
      'Saved authored Driving Sketch history refused.', 'driving-history');
    check(same({ ...authored, constraints: [] }, { ...accepted.document, constraints: [] }),
      'NATIVE', 'Driving history must retain the complete original seed and selected scope.', 'driving-history');
    const result = native(() => evaluateDrivenMixedSketchLines(authored), 'Native Driving Sketch history reconstruction refused.', 'driving-history');
    const state = admit(result, 'driving-history');
    return prepare(direction < 0 ? 'undo' : 'redo', result, view, logicalTarget(), state, targetIndex);
  }
  return {
    getSnapshot: snapshot,
    subscribe(listener) {
      live(); check(typeof listener === 'function', 'INPUT', 'A Sketch snapshot listener is required.', 'driving-session');
      listeners.add(listener); return () => { listeners.delete(listener); };
    },
    selectPoint(profileId, pointId, binding) {
      live(); const next = selectedPoint(profileId, pointId, accepted, generation, binding);
      if (selection?.native.profileId === profileId && selection.native.pointId === pointId) return snapshot();
      resolvedDraft(); noCandidate(); selection = next;
      const returned = snapshot(); emit(); return returned;
    },
    stageConstraintField(constraintId, field, raw) {
      live(); check(typeof constraintId === 'string' && FIELDS.includes(field), 'INPUT', 'Choose an existing driving scalar field.', 'driving-constraint');
      check(typeof raw === 'string' && raw.length <= 128, 'INPUT', 'Driving input must be text with at most 128 characters.', 'driving-constraint');
      const constraint = accepted.document.constraints.find(value => value.id === constraintId);
      check(constraint !== undefined, 'INPUT', 'The authored driving constraint is missing.', 'driving-constraint');
      let current: number;
      if (field === 'distanceMM') {
        check(constraint.kind === 'distance-x' || constraint.kind === 'distance-y', 'UNSUPPORTED', 'Only an existing distance has this scalar field.', 'driving-constraint');
        current = constraint.distanceMM;
      } else {
        check(constraint.kind === 'fixed', 'UNSUPPORTED', 'Only an existing fixed target has XY scalar fields.', 'driving-constraint');
        current = constraint.target[field === 'xMM' ? 0 : 1];
      }
      const own: Partial<Record<CadEditorDrivingSketchConstraintField, string>> =
        Object.hasOwn(pending.fields, constraintId) ? { ...pending.fields[constraintId] } : {};
      if (Object.is(scalar(raw), current)) delete own[field]; else own[field] = raw;
      const fields = Object.fromEntries([...Object.entries(pending.fields), [constraintId, own]]);
      if (Object.keys(own).length === 0) delete fields[constraintId];
      pending = { fields }; prepared = null; const returned = snapshot(); emit(); return returned;
    },
    discardPending() {
      live(); pending = emptyPending(); prepared = null; const returned = snapshot(); emit(); return returned;
    },
    prepareApply() {
      live(); noCandidate(); if (Object.keys(pending.fields).length === 0) return null;
      const constraints = copy(accepted.document.constraints);
      for (const constraint of constraints) if (Object.hasOwn(pending.fields, constraint.id)) {
        const fields = pending.fields[constraint.id];
        for (const field of FIELDS) if (Object.hasOwn(fields, field)) {
          const value = scalar(fields[field]!);
          check(value !== undefined, 'INPUT', 'Driving input must be a finite decimal or exponent number.', 'driving-constraint');
          if (field === 'distanceMM' && (constraint.kind === 'distance-x' || constraint.kind === 'distance-y')) constraint.distanceMM = value;
          else {
            check(constraint.kind === 'fixed' && field !== 'distanceMM', 'UNSUPPORTED', 'The authored driving field kind changed.', 'driving-constraint');
            constraint.target[field === 'xMM' ? 0 : 1] = value;
          }
        }
      }
      const result = update(constraints);
      if (result.report.noOp) { pending = emptyPending(); emit(); return null; }
      return prepare('apply', result, view, logicalTarget(), authoredState(result));
    },
    prepareConstraintAddition(constraint) {
      live(); resolvedDraft(); noCandidate();
      // The native own-data snapshot copies the caller definition before reading it.
      // Do not pre-read getters, invent constraint schemas, or narrow the native union.
      const result = update([...copy(accepted.document.constraints), constraint]);
      check(!result.report.noOp, 'NATIVE', 'A native addition must append an authored constraint definition.', 'driving-constraint');
      return prepare('add', result, view, logicalTarget(), authoredState(result));
    },
    prepareConstraintRemoval(constraintId) {
      live(); resolvedDraft(); noCandidate();
      check(typeof constraintId === 'string' && accepted.document.constraints.some(value => value.id === constraintId),
        'INPUT', 'Choose an existing authored constraint to remove.', 'driving-constraint');
      const result = update(copy(accepted.document.constraints.filter(value => value.id !== constraintId)));
      check(!result.report.noOp, 'NATIVE', 'A native removal must delete an authored constraint definition.', 'driving-constraint');
      return prepare('remove', result, view, logicalTarget(), authoredState(result));
    },
    prepareView(profileId) {
      live(); const proposed = viewFor(profileId); noCandidate();
      if (same(proposed, view)) return null;
      const target = selection?.native.profileId === proposed.profileId ? logicalTarget() : null;
      return prepare('view', accepted, proposed, target);
    },
    prepareOpen(text, openOptions) {
      live(); const authored = native(() => parseDrivenMixedSketchLines(text), 'Native authored Driving Sketch Open refused.', 'driving-file');
      const result = native(() => evaluateDrivenMixedSketchLines(authored), 'Native Driving Sketch Open evaluation refused.', 'driving-file');
      const state = admit(result, 'driving-file');
      const profileId = openOptions === undefined ? initialView.profileId : ownFields(openOptions, ['initialProfileId'], 'driving-view').initialProfileId;
      const proposed = viewFor(profileId, result); resolvedDraft(); noCandidate();
      return prepare('open', result, proposed, null, state);
    },
    prepareUndo() { return restore(-1); },
    prepareRedo() { return restore(1); },
    acceptCandidate(token) {
      live(); check(prepared !== null && prepared.candidate.token === token && prepared.candidate.baseGeneration === generation
        && prepared.candidate.baseDisplayGeneration === displayGeneration, 'STALE', 'The Driving Sketch candidate is no longer current.', 'driving-candidate');
      const current = prepared, candidate = current.candidate;
      const epoch = candidate.kind === 'view' ? generation : generation + 1;
      const refreshed = candidate.selectionTarget === null ? null
        : selectedPoint(candidate.selectionTarget.profileId, candidate.selectionTarget.pointId, candidate.result, epoch);
      if (candidate.kind === 'view') {
        view = copy(candidate.view); selection = refreshed; displayGeneration++;
        prepared = null; const returned = snapshot(); emit(); return returned;
      }
      check(current.state !== undefined, 'NATIVE', 'The prepared authored Sketch history state is missing.', 'driving-history');
      if (candidate.kind === 'open') { history = [current.state]; historyIndex = 0; }
      else if (candidate.kind === 'apply' || candidate.kind === 'add' || candidate.kind === 'remove') {
        const states = [...history.slice(0, historyIndex + 1), current.state];
        let bytes = states.reduce((total, state) => total + state.bytes, 0);
        while (states.length > HISTORY_LIMIT || bytes > HISTORY_BYTES) bytes -= states.shift()!.bytes;
        history = states; historyIndex = history.length - 1;
      } else {
        check(current.historyIndex !== undefined && current.historyIndex >= 0 && current.historyIndex < history.length,
          'NATIVE', 'The prepared Sketch history position is missing.', 'driving-history');
        historyIndex = current.historyIndex;
      }
      accepted = candidate.result; view = copy(candidate.view); selection = refreshed;
      generation++; if (candidate.kind === 'open') displayGeneration++;
      pending = emptyPending(); prepared = null; download = null;
      dirty = candidate.kind !== 'open'; downloadStatus = 'Not downloaded';
      const returned = snapshot(); emit(); return returned;
    },
    cancelCandidate(token) {
      live(); check(prepared !== null && prepared.candidate.token === token,
        'STALE', 'The Driving Sketch candidate is no longer current.', 'driving-candidate');
      prepared = null; emit();
    },
    serializeAccepted() {
      live(); const text = serialize(accepted), token = newToken(); download = { token, generation };
      return { token, text, suggestedFilename: accepted.document.id + '.driving-sketch.json' };
    },
    markDownloaded(token) {
      live(); check(download !== null && download.token === token && download.generation === generation,
        'STALE', 'The accepted Driving Sketch changed after download capture.', 'driving-file');
      dirty = false; downloadStatus = 'Download started'; emit();
    },
    dispose() {
      if (disposed) return;
      disposed = true; pending = emptyPending(); prepared = null; download = null; emit(); listeners.clear();
    },
  };
}
