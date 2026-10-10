import {
  evaluateNurbsSourceLoftFeatureGraph, updateNurbsSourceLoftFeatureGraph,
  validateNurbsSourceLoftFeatureGraph, validateNurbsSourceLoftFeatureGraphUpdate,
  parseNurbsSourceLoftFeatureGraph, serializeNurbsSourceLoftFeatureGraph,
  NurbsSourceLoftFeatureGraphError, NurbsSourceLoftFeatureGraphDiagnosticCode,
} from '@barocss/cad';
import type {
  NurbsSourceLoftFeatureGraphV0, NurbsSourceLoftFeatureGraphResult,
  NurbsSourceLoftFeatureGraphUpdateResult,
} from '@barocss/cad';
import { CadEditorError } from './types.js';
import type {
  CadEditorLoftCandidate, CadEditorLoftPending, CadEditorLoftPoleField,
  CadEditorLoftPoleSelection, CadEditorLoftSelectedPole, CadEditorLoftSession,
  CadEditorLoftSessionOptions, CadEditorLoftSnapshot, CadEditorLoftView,
} from './loft-types.js';

const FIELDS: CadEditorLoftPoleField[] = ['xMM', 'yMM', 'zMM', 'weight'];
const REVISION_LIMIT = 1000000000;
const HISTORY_LIMIT = 20;
const HISTORY_BYTES = 8 * 1024 * 1024;
let sessionSequence = 0;

function check(condition: boolean, code: ConstructorParameters<typeof CadEditorError>[0], message: string,
  context: CadEditorError['context'] = {}): asserts condition {
  if (!condition) throw new CadEditorError(code, message, context);
}
/** Internal admitted CPU data is plain and acyclic. Preserve its negative-zero bits. */
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
function native<T>(action: () => T, message: string, context: CadEditorError['context']): T {
  try { return action(); } catch (cause) {
    if (cause instanceof CadEditorError) throw cause;
    const code = cause instanceof NurbsSourceLoftFeatureGraphError
      ? cause.code === NurbsSourceLoftFeatureGraphDiagnosticCode.REVISION ? 'REVISION'
        : cause.code === NurbsSourceLoftFeatureGraphDiagnosticCode.BUDGET ? 'BUDGET' : 'NATIVE'
      : 'NATIVE';
    throw new CadEditorError(code, message, context, cause);
  }
}
function ownFields(input: unknown, allowed: string[], required: string[], context: CadEditorError['context']): Record<string, unknown> {
  check(input !== null && typeof input === 'object' && !Array.isArray(input)
    && [Object.prototype, null].includes(Object.getPrototypeOf(input)), 'INPUT', 'Plain own data is required.', context);
  const keys = Reflect.ownKeys(input), descriptors = Object.getOwnPropertyDescriptors(input);
  check(required.every(key => Object.hasOwn(descriptors, key)) && keys.length <= allowed.length
    && keys.every(key => typeof key === 'string' && allowed.includes(key)
      && descriptors[key].enumerable === true && 'value' in descriptors[key]),
  'INPUT', 'Unsupported fields, getters, symbols and hidden data are refused.', context);
  return Object.fromEntries((keys as string[]).map(key => [key, descriptors[key].value]));
}
/** Only native-serialized admitted text reaches this byte counter. */
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
function scalar(raw: string): number | undefined {
  const value = raw.trim();
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value)) return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}
function emptyPending(): CadEditorLoftPending { return { target: null, fields: {} }; }
function logicalTarget(selection: CadEditorLoftSelectedPole | null): CadEditorLoftCandidate['selectionTarget'] {
  return selection === null ? null : { nodeId: selection.nodeId, index: selection.index };
}
interface HistoryState { document: NurbsSourceLoftFeatureGraphV0; bytes: number }
interface Prepared { candidate: CadEditorLoftCandidate; historyIndex?: number; state?: HistoryState }

/** Native source/recipe authority only. No DOM, renderer, clock or event resources are created. */
export function createCadEditorLoftSession(initialDocument: NurbsSourceLoftFeatureGraphV0,
  options: CadEditorLoftSessionOptions): CadEditorLoftSession {
  const initialOptions = ownFields(options, ['native', 'initialView'], ['native'], { field: 'loft-options' });
  let accepted = native(() => evaluateNurbsSourceLoftFeatureGraph(initialDocument,
    initialOptions.native as CadEditorLoftSessionOptions['native']), 'Initial native Loft graph refused.', { field: 'loft-options' });
  const context = (field: string): CadEditorError['context'] => ({ documentId: accepted.document.id, field });
  const admit = (result: NurbsSourceLoftFeatureGraphResult, field: string) => {
    native(() => validateNurbsSourceLoftFeatureGraph(result), 'Whole native Loft graph validation refused.', context(field));
    return result;
  };
  admit(accepted, 'loft-options');
  function serialize(result: NurbsSourceLoftFeatureGraphResult): string {
    return native(() => serializeNurbsSourceLoftFeatureGraph(result.document, result.options),
      'Native authored Loft serialization refused.', { documentId: result.document.id, field: 'loft-file' });
  }
  function selectedPole(input: CadEditorLoftPoleSelection, result = accepted): CadEditorLoftSelectedPole {
    const ctx = { documentId: result.document.id, field: 'loft-selection' };
    const data = ownFields(input, ['nodeId', 'index', 'binding'], ['nodeId', 'index'], ctx);
    check(typeof data.nodeId === 'string', 'INPUT', 'Choose an existing source edit node.', ctx);
    const binding = result.bindings.nodes.find(value => value.nodeId === data.nodeId);
    const node = result.evaluatedNodes.find(value => value.nodeId === data.nodeId);
    check(binding !== undefined && node !== undefined, 'INPUT', 'The original section node is missing.', ctx);
    if (data.binding !== undefined) {
      const keys = ['graphId', 'revision', 'nodeId', 'sourceId', 'sourceModelName', 'curveId', 'previousNodeId'];
      const supplied = ownFields(data.binding, keys, keys, ctx);
      check(same(supplied, binding), 'STALE', 'The source-qualified section binding is no longer current.', ctx);
    }
    check(binding.graphId === result.document.id && binding.revision === result.document.revision
      && node.sourceId === binding.sourceId && node.curveId === binding.curveId
      && node.previousNodeId === binding.previousNodeId && node.evaluation.model.name === binding.sourceModelName,
    'NATIVE', 'The whole-source section binding differs from the native graph.', ctx);
    const curve = node.evaluation.model.objects.find(value => value.id === binding.curveId);
    check(curve?.kind === 'curve', 'NATIVE', 'The selected original Curve is missing from its complete native Model.', ctx);
    check(typeof data.index === 'number' && Number.isInteger(data.index) && data.index >= 0 && data.index < curve.controlPoints.length,
      'INPUT', 'Choose a point inside the original Curve control polygon.', ctx);
    const point = curve.controlPoints[data.index];
    return { nodeId: binding.nodeId, index: data.index, binding: copy(binding), poleCount: curve.controlPoints.length,
      accepted: { xMM: point[0], yMM: point[1], zMM: point[2], weight: curve.weights[data.index] } };
  }
  function validateView(input: unknown, result = accepted): CadEditorLoftView {
    const ctx = { documentId: result.document.id, field: 'loft-view' };
    const data = ownFields(input, ['kind', 'nodeId'], ['kind'], ctx);
    if (data.kind === 'loft') {
      check(Object.keys(data).length === 1, 'INPUT', 'Loft view accepts kind only.', ctx);
      return { kind: 'loft' };
    }
    check(data.kind === 'section' && typeof data.nodeId === 'string' && Object.keys(data).length === 2,
      'INPUT', 'Section focus requires one existing source edit node.', ctx);
    selectedPole({ nodeId: data.nodeId, index: 0 }, result);
    return { kind: 'section', nodeId: data.nodeId };
  }
  const initialView = validateView(initialOptions.initialView === undefined ? { kind: 'loft' } : initialOptions.initialView);
  let view = copy(initialView);
  let selection: CadEditorLoftSelectedPole | null = view.kind === 'section' ? selectedPole({ nodeId: view.nodeId, index: 0 }) : null;
  let pending = emptyPending();
  let prepared: Prepared | null = null;
  let history: HistoryState[] = [{ document: copy(accepted.document), bytes: serializedBytes(serialize(accepted)) }];
  let historyIndex = 0, generation = 0, displayGeneration = 0;
  let dirty = true, disposed = false;
  let downloadStatus: CadEditorLoftSnapshot['downloadStatus'] = 'Not downloaded';
  let lastTransaction: CadEditorLoftCandidate['transaction'] = null;
  let download: { token: string; generation: number } | null = null;
  const sessionId = ++sessionSequence;
  let tokenSequence = 0;
  const listeners = new Set<(snapshot: CadEditorLoftSnapshot) => void>();
  const live = () => check(!disposed, 'LIFECYCLE', 'The Loft session is disposed.', context('loft-session'));
  const historyBytes = () => history.reduce((total, state) => total + state.bytes, 0);
  const snapshot = (): CadEditorLoftSnapshot => copy({ mode: 'nurbs-source-loft', accepted, generation, displayGeneration,
    view, selection, pending, candidate: prepared?.candidate ?? null,
    history: { count: history.length, index: historyIndex, bytes: historyBytes(), canUndo: historyIndex > 0, canRedo: historyIndex < history.length - 1 },
    dirty, downloadStatus, disposed, lastTransaction });
  const emit = () => {
    for (const listener of [...listeners]) {
      try { listener(snapshot()); } catch { /* Subscriber failures cannot reject an accepted native commit. */ }
    }
  };
  const newToken = () => `cad-editor-loft-${sessionId}-${++tokenSequence}`;
  const noCandidate = () => check(prepared === null, 'INPUT', 'Resolve the current Loft candidate first.', context('loft-candidate'));
  const resolvedDraft = () => check(pending.target === null && Object.keys(pending.fields).length === 0,
    'INPUT', 'Apply or discard the pending original pole fields first.', context('loft-draft'));
  const nextRevision = () => {
    check(accepted.document.revision < REVISION_LIMIT, 'REVISION', 'Native Loft revision limit reached.', context('loft-revision'));
    return accepted.document.revision + 1;
  };
  const clearDraft = () => { pending = emptyPending(); prepared = null; emit(); };
  const prepare = (kind: CadEditorLoftCandidate['kind'], result: NurbsSourceLoftFeatureGraphResult,
    candidateView: CadEditorLoftView, target: CadEditorLoftCandidate['selectionTarget'],
    transaction: CadEditorLoftCandidate['transaction'] = null, targetIndex?: number): CadEditorLoftCandidate => {
    const legalView = validateView(candidateView, result);
    const refreshed = target === null ? null : logicalTarget(selectedPole(target, result));
    const state = kind === 'view' ? undefined : { document: copy(result.document), bytes: serializedBytes(serialize(result)) };
    prepared = { candidate: { kind, token: newToken(), baseGeneration: generation, baseDisplayGeneration: displayGeneration,
      result, transaction: copy(transaction), view: legalView, selectionTarget: refreshed }, historyIndex: targetIndex, state };
    const returned = copy(prepared.candidate); emit(); return returned;
  };
  const update = (nodeEdits: Parameters<typeof updateNurbsSourceLoftFeatureGraph>[1]['nodeEdits'],
    loftSuppressed: boolean | null): NurbsSourceLoftFeatureGraphUpdateResult => {
    const result = native(() => updateNurbsSourceLoftFeatureGraph(accepted, {
      expectedRevision: accepted.document.revision, revision: nextRevision(), nodeEdits, loftSuppressed,
    }), 'Native complete-source Loft update refused.', context('loft-update'));
    native(() => validateNurbsSourceLoftFeatureGraphUpdate(result), 'Whole native Loft update validation refused.', context('loft-update'));
    return result;
  };
  const restore = (direction: -1 | 1): CadEditorLoftCandidate => {
    live(); resolvedDraft(); noCandidate();
    const targetIndex = historyIndex + direction;
    check(targetIndex >= 0 && targetIndex < history.length, 'INPUT', 'This Loft history direction is unavailable.', context('loft-history'));
    const document = copy(history[targetIndex].document);
    document.revision = nextRevision();
    const result = admit(native(() => evaluateNurbsSourceLoftFeatureGraph(document, accepted.options),
      'Native complete authored Loft history reconstruction refused.', context('loft-history')), 'loft-history');
    return prepare(direction < 0 ? 'undo' : 'redo', result, view, logicalTarget(selection), null, targetIndex);
  };
  return {
    getSnapshot: snapshot,
    subscribe(listener) {
      live(); check(typeof listener === 'function', 'INPUT', 'A Loft snapshot listener is required.', context('loft-session'));
      listeners.add(listener); return () => { listeners.delete(listener); };
    },
    selectPole(input) {
      live(); const selected = selectedPole(input);
      if (selection?.nodeId === selected.nodeId && selection.index === selected.index) return snapshot();
      resolvedDraft(); noCandidate();
      check(view.kind === 'section' && view.nodeId === selected.nodeId || selection?.nodeId === selected.nodeId,
        'INPUT', 'Focus this original section before selecting its pole.', context('loft-selection'));
      selection = selected; const returned = snapshot(); emit(); return returned;
    },
    stagePoleField(field, raw) {
      live(); check(FIELDS.includes(field), 'INPUT', 'Choose an original XYZ or weight field.', context('loft-pole'));
      check(typeof raw === 'string' && raw.length <= 128, 'INPUT', 'Pole input must be text with at most 128 characters.', context('loft-pole'));
      check(selection !== null, 'INPUT', 'Focus and select an original section pole first.', context('loft-selection'));
      const fields = { ...pending.fields };
      if (Object.is(scalar(raw), selection.accepted[field])) delete fields[field];
      else fields[field] = raw;
      pending = Object.keys(fields).length === 0 ? emptyPending() : { target: { nodeId: selection.nodeId, index: selection.index,
        binding: copy(selection.binding) }, fields };
      prepared = null; const returned = snapshot(); emit(); return returned;
    },
    discardPending() {
      live(); pending = emptyPending(); prepared = null; const returned = snapshot(); emit(); return returned;
    },
    prepareApply() {
      live(); noCandidate();
      if (pending.target === null || Object.keys(pending.fields).length === 0) return null;
      const selected = selectedPole(pending.target);
      const replacements: Partial<Record<CadEditorLoftPoleField, number>> = {};
      for (const field of FIELDS) if (Object.hasOwn(pending.fields, field)) {
        const number = scalar(pending.fields[field]!);
        check(number !== undefined, 'INPUT', 'Pole input must be a finite decimal or exponent number.', context('loft-pole'));
        if (!Object.is(number, selected.accepted[field])) replacements[field] = number;
      }
      if (Object.keys(replacements).length === 0) { clearDraft(); return null; }
      const node = accepted.document.nodes.find(value => value.id === selected.nodeId);
      check(node?.kind === 'source-curve-edit', 'NATIVE', 'The original source edit recipe is missing.', context('loft-update'));
      const edits = copy(node.edits);
      const index = edits.poleEdits.findIndex(pole => pole.index === selected.index);
      if (index < 0) edits.poleEdits.push({ index: selected.index, ...replacements });
      else edits.poleEdits[index] = { ...edits.poleEdits[index], ...replacements };
      const updated = update([{ nodeId: node.id, edits }], null);
      if (updated.transaction.report.noOp) { clearDraft(); return null; }
      return prepare('apply', updated.result, view, logicalTarget(selection), updated.transaction);
    },
    prepareSuppression(suppressed) {
      live(); check(typeof suppressed === 'boolean', 'INPUT', 'Choose a boolean Loft suppression value.', context('loft-suppression'));
      resolvedDraft(); noCandidate();
      if (suppressed === (accepted.loft.status === 'suppressed')) return null;
      const updated = update([], suppressed);
      if (updated.transaction.report.noOp) return null;
      return prepare('suppress', updated.result, { kind: 'loft' }, logicalTarget(selection), updated.transaction);
    },
    prepareView(input) {
      live(); const proposed = validateView(input); resolvedDraft(); noCandidate();
      if (same(view, proposed)) return null;
      const target = proposed.kind === 'section' ? { nodeId: proposed.nodeId,
        index: selection?.nodeId === proposed.nodeId ? selection.index : 0 } : logicalTarget(selection);
      return prepare('view', accepted, proposed, target);
    },
    prepareOpen(text) {
      live();
      const result = admit(native(() => parseNurbsSourceLoftFeatureGraph(text, accepted.options),
        'Native authored Loft Open refused.', context('loft-open')), 'loft-open');
      const proposed = validateView(initialView, result); resolvedDraft(); noCandidate();
      const target = proposed.kind === 'section' ? { nodeId: proposed.nodeId, index: 0 } : null;
      return prepare('open', result, proposed, target);
    },
    prepareUndo() { return restore(-1); },
    prepareRedo() { return restore(1); },
    acceptCandidate(token) {
      live(); check(prepared !== null && prepared.candidate.token === token && prepared.candidate.baseGeneration === generation
        && prepared.candidate.baseDisplayGeneration === displayGeneration, 'STALE', 'The Loft candidate is no longer current.', context('loft-candidate'));
      const current = prepared, candidate = current.candidate;
      const selected = candidate.selectionTarget === null ? null : selectedPole(candidate.selectionTarget, candidate.result);
      const changedView = !same(view, candidate.view);
      if (candidate.kind === 'view') {
        view = copy(candidate.view); selection = selected;
        if (changedView) displayGeneration++;
        prepared = null; const returned = snapshot(); emit(); return returned;
      }
      check(current.state !== undefined, 'NATIVE', 'The prepared native authored history state is missing.', context('loft-history'));
      if (candidate.kind === 'open') { history = [copy(current.state)]; historyIndex = 0; }
      else if (candidate.kind === 'apply' || candidate.kind === 'suppress') {
        history = [...history.slice(0, historyIndex + 1), copy(current.state)];
        while (history.length > HISTORY_LIMIT || historyBytes() > HISTORY_BYTES) history.shift();
        historyIndex = history.length - 1;
      } else historyIndex = current.historyIndex!;
      accepted = candidate.result; view = copy(candidate.view); selection = selected;
      generation++; if (changedView || candidate.kind === 'open') displayGeneration++;
      pending = emptyPending(); prepared = null; lastTransaction = copy(candidate.transaction);
      dirty = candidate.kind !== 'open'; downloadStatus = 'Not downloaded'; download = null;
      const returned = snapshot(); emit(); return returned;
    },
    cancelCandidate(token) {
      live(); check(prepared !== null && prepared.candidate.token === token, 'STALE', 'The Loft candidate is no longer current.', context('loft-candidate'));
      prepared = null; emit();
    },
    serializeAccepted() {
      live(); const text = serialize(accepted), token = newToken(); download = { token, generation };
      return { token, text, suggestedFilename: accepted.document.id + '.nurbs-loft.graph.json' };
    },
    markDownloaded(token) {
      live(); check(download !== null && download.token === token && download.generation === generation,
        'STALE', 'The accepted Loft graph changed after download capture.', context('loft-file'));
      dirty = false; downloadStatus = 'Download started'; emit();
    },
    dispose() {
      if (disposed) return;
      disposed = true; pending = emptyPending(); prepared = null; download = null; emit(); listeners.clear();
    },
  };
}
