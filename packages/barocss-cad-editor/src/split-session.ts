import {
  editSourceSurfaceControlNetWide, parseTranslatedStripPlaneSplit, serializeTranslatedStripPlaneSplit,
  splitTranslatedStripBodyByPlane, validateSourceSurfaceControlNetWideEdit, validateTranslatedStripPlaneSplit,
} from '@barocss/cad';
import type { TranslatedStripPlaneSplitResult } from '@barocss/cad';
import { CadEditorError } from './types.js';
import type {
  CadEditorSplitCandidate, CadEditorSplitPending, CadEditorSplitPresentation, CadEditorSplitSession,
  CadEditorSplitSessionOptions, CadEditorSplitSnapshot,
} from './split-types.js';

const FILE_LIMIT = 2097152;
const HISTORY_LIMIT = 20;
const HISTORY_BYTES = 64 * 1024 * 1024;
const GENERATION_LIMIT = 1000000000;
let sessionSequence = 0;
type PresentationKind = CadEditorSplitPresentation['kind'];
interface HistoryState { text: string; presentation: PresentationKind; bytesUTF8: number; bytesUTF16: number }
interface Prepared { candidate: CadEditorSplitCandidate; state: HistoryState; historyIndex?: number }

function requireSplit(value: unknown, code: CadEditorError['code'], message: string, field = 'split-session'): asserts value {
  if (!value) throw new CadEditorError(code, message, { field });
}
function copy<T>(value: T): T {
  if (Array.isArray(value)) return value.map(item => copy(item)) as T;
  if (value !== null && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, copy(item)])) as T;
  return value;
}
function native<T>(action: () => T, message: string, field = 'split-session'): T {
  try { return action(); }
  catch (cause) { throw new CadEditorError('NATIVE', message, { field }, cause); }
}
function textBudget(text: string): number {
  requireSplit(typeof text === 'string', 'INPUT', 'A complete authored Split file is required.', 'split-file');
  requireSplit(text.length <= FILE_LIMIT, 'BUDGET', 'The authored Split file exceeds its UTF16 limit.', 'split-file');
  const bytes = new TextEncoder().encode(text).length;
  requireSplit(bytes <= FILE_LIMIT, 'BUDGET', 'The authored Split file exceeds its UTF8 limit.', 'split-file');
  return bytes;
}
function initialKind(options?: CadEditorSplitSessionOptions): PresentationKind {
  if (options === undefined) return 'split';
  requireSplit(options !== null && typeof options === 'object' && !Array.isArray(options)
    && (Object.getPrototypeOf(options) === Object.prototype || Object.getPrototypeOf(options) === null),
  'INPUT', 'Split options must be a plain own-data record.');
  const keys = Reflect.ownKeys(options), descriptor = Object.getOwnPropertyDescriptor(options, 'initialPresentation');
  requireSplit(keys.length === 1 && keys[0] === 'initialPresentation' && descriptor?.enumerable === true
    && 'value' in descriptor, 'INPUT', 'Split options require only an own initialPresentation value.');
  requireSplit(descriptor.value === 'original' || descriptor.value === 'split', 'INPUT', 'Choose original or split presentation.');
  return descriptor.value;
}
function parse(text: string): TranslatedStripPlaneSplitResult {
  textBudget(text);
  return native(() => {
    const result = parseTranslatedStripPlaneSplit(text);
    validateTranslatedStripPlaneSplit(result);
    return result;
  }, 'Native authored Split reconstruction refused.', 'split-file');
}
function historyState(result: TranslatedStripPlaneSplitResult, presentation: PresentationKind): HistoryState {
  const text = native(() => serializeTranslatedStripPlaneSplit(result), 'Native authored Split serialization refused.', 'split-file');
  return { text, presentation, bytesUTF8: textBudget(text), bytesUTF16: text.length * 2 };
}

/** Own native Split authority without renderer resources. Original presentation is not a native file state. */
export function createCadEditorSplitSession(authoredText: string, options?: CadEditorSplitSessionOptions): CadEditorSplitSession {
  let kind = initialKind(options);
  let accepted = parse(authoredText);
  let history = [historyState(accepted, kind)], historyIndex = 0;
  let pending: CadEditorSplitPending = {};
  let prepared: Prepared | null = null;
  let generation = 0, displayGeneration = 0, disposed = false, dirty = true;
  let downloadStatus: CadEditorSplitSnapshot['downloadStatus'] = 'Not downloaded';
  let download: { token: string; generation: number } | null = null;
  const sessionId = ++sessionSequence;
  let tokenSequence = 0;
  const listeners = new Set<() => void>();
  const live = () => requireSplit(!disposed, 'LIFECYCLE', 'The Split session is disposed.');
  const emit = () => {
    for (const listener of [...listeners]) {
      // Subscriber failures cannot turn an already committed CPU operation into a refusal.
      try { listener(); } catch { /* The subscriber owns its failure. */ }
    }
  };
  const token = () => {
    requireSplit(tokenSequence < Number.MAX_SAFE_INTEGER, 'BUDGET', 'The Split token limit was reached.');
    return `cad-editor-split-${sessionId}-${++tokenSequence}`;
  };
  const presentation = (result: TranslatedStripPlaneSplitResult, value: PresentationKind): CadEditorSplitPresentation =>
    value === 'original' ? { kind: 'original', body: result.request.body } : { kind: 'split', result };
  const totals = () => history.reduce((sum, state) => ({
    bytesUTF8: sum.bytesUTF8 + state.bytesUTF8, bytesUTF16: sum.bytesUTF16 + state.bytesUTF16,
  }), { bytesUTF8: 0, bytesUTF16: 0 });
  const snapshot = (): CadEditorSplitSnapshot => copy({
    accepted, presentation: presentation(accepted, kind), generation, displayGeneration,
    pending, candidate: prepared?.candidate ?? null,
    history: { index: historyIndex, count: history.length, ...totals(), canUndo: historyIndex > 0, canRedo: historyIndex < history.length - 1 },
    dirty, downloadStatus, disposed,
  });
  const resolvedDraft = () => requireSplit(!Object.hasOwn(pending, 'cutY') && prepared === null,
    'INPUT', 'Apply or discard the draft and resolve the candidate before Open or history.');
  const generationBudget = () => requireSplit(generation < GENERATION_LIMIT && displayGeneration < GENERATION_LIMIT,
    'REVISION', 'The Split session generation limit was reached.');
  const prepare = (candidateKind: CadEditorSplitCandidate['kind'], result: TranslatedStripPlaneSplitResult,
    nextKind: PresentationKind, targetIndex?: number): CadEditorSplitCandidate => {
    generationBudget();
    const state = historyState(result, nextKind);
    const candidate: CadEditorSplitCandidate = { token: token(), kind: candidateKind,
      baseGeneration: generation, baseDisplayGeneration: displayGeneration,
      result, presentation: presentation(result, nextKind) };
    prepared = { candidate, state, historyIndex: targetIndex };
    emit();
    requireSplit(!disposed && prepared?.candidate.token === candidate.token
      && generation === candidate.baseGeneration && displayGeneration === candidate.baseDisplayGeneration,
    'STALE', 'The Split candidate changed during notification.');
    return copy(candidate);
  };
  const restore = (direction: -1 | 1): CadEditorSplitCandidate => {
    live(); resolvedDraft();
    const index = historyIndex + direction;
    requireSplit(index >= 0 && index < history.length, 'INPUT', 'No Split history exists in that direction.');
    const target = history[index], result = parse(target.text);
    return prepare(direction < 0 ? 'undo' : 'redo', result, target.presentation, index);
  };
  return {
    getSnapshot: snapshot,
    subscribe(listener) {
      live(); requireSplit(typeof listener === 'function', 'INPUT', 'A Split subscription listener is required.');
      listeners.add(listener); return () => { listeners.delete(listener); };
    },
    stageCutYField(rawText) {
      live();
      requireSplit(typeof rawText === 'string' && rawText.length <= 128, 'BUDGET', 'Cut Y input must fit 128 characters.', 'split-cut-y');
      pending = rawText === '' ? {} : { cutY: rawText };
      prepared = null;
      emit(); return snapshot();
    },
    discardPending() { live(); pending = {}; prepared = null; emit(); return snapshot(); },
    prepareApply() {
      live(); requireSplit(prepared === null, 'INPUT', 'Resolve the current Split candidate before Apply.');
      if (!Object.hasOwn(pending, 'cutY')) return kind === 'original' ? prepare('apply', accepted, 'split') : null;
      const raw = pending.cutY!.trim();
      requireSplit(/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(raw),
        'INPUT', 'Cut Y must be a decimal or exponent number.', 'split-cut-y');
      const cutY = Number(raw);
      requireSplit(Number.isFinite(cutY), 'INPUT', 'Cut Y must be finite.', 'split-cut-y');
      const asset = accepted.request.cutAsset;
      const edited = native(() => {
        const result = editSourceSurfaceControlNetWide({ source: asset.source, sourceVersion: 0,
          surfaceId: asset.surface.id, edits: { poleEdits: [
            { uIndex: 0, vIndex: 0, yMM: cutY }, { uIndex: 0, vIndex: 1, yMM: cutY },
            { uIndex: 1, vIndex: 0, yMM: cutY }, { uIndex: 1, vIndex: 1, yMM: cutY },
          ] } });
        validateSourceSurfaceControlNetWideEdit(result);
        return result;
      }, 'Native complete cut Surface edit refused.', 'split-cut-y');
      if (edited.report.noOp) {
        if (kind === 'original') return prepare('apply', accepted, 'split');
        pending = {}; emit(); return null;
      }
      const result = native(() => {
        const next = splitTranslatedStripBodyByPlane({ body: accepted.request.body,
          cutAsset: { sourceId: asset.sourceId, source: edited.source, surface: edited.surface },
          options: accepted.request.options });
        validateTranslatedStripPlaneSplit(next);
        return next;
      }, 'Native conserved Plane Split reconstruction refused.', 'split-cut-y');
      return prepare('apply', result, 'split');
    },
    prepareOpen(text) { live(); resolvedDraft(); return prepare('open', parse(text), 'split'); },
    prepareUndo() { return restore(-1); },
    prepareRedo() { return restore(1); },
    acceptCandidate(value) {
      live();
      requireSplit(prepared !== null && prepared.candidate.token === value
        && prepared.candidate.baseGeneration === generation && prepared.candidate.baseDisplayGeneration === displayGeneration,
      'STALE', 'The Split candidate is no longer current.');
      generationBudget();
      const current = prepared;
      if (current.candidate.kind === 'open') { history = [current.state]; historyIndex = 0; }
      else if (current.candidate.kind === 'apply') {
        history = [...history.slice(0, historyIndex + 1), current.state];
        while (history.length > HISTORY_LIMIT || totals().bytesUTF8 > HISTORY_BYTES || totals().bytesUTF16 > HISTORY_BYTES) history.shift();
        historyIndex = history.length - 1;
      } else historyIndex = current.historyIndex!;
      accepted = current.candidate.result; kind = current.state.presentation;
      generation++; displayGeneration++; pending = {}; prepared = null;
      dirty = current.candidate.kind !== 'open'; downloadStatus = 'Not downloaded'; download = null;
      emit(); return snapshot();
    },
    cancelCandidate(value) {
      live(); requireSplit(prepared !== null && prepared.candidate.token === value, 'STALE', 'The Split candidate is no longer current.');
      prepared = null; emit();
    },
    serializeAccepted() {
      live(); requireSplit(kind === 'split', 'UNSUPPORTED', 'Original presentation has no original-only native authored file.', 'split-file');
      const text = native(() => serializeTranslatedStripPlaneSplit(accepted), 'Native accepted Split serialization refused.', 'split-file');
      textBudget(text);
      const value = token(); download = { token: value, generation };
      return { token: value, text, suggestedFilename: `${accepted.report.evaluationId}.translated-strip-plane-split.json` };
    },
    markDownloaded(value) {
      live(); requireSplit(download !== null && download.token === value && download.generation === generation,
        'STALE', 'The accepted Split changed after the download capture.', 'split-file');
      dirty = false; downloadStatus = 'Download started'; emit();
    },
    dispose() {
      if (disposed) return;
      disposed = true; prepared = null; pending = {}; download = null; emit(); listeners.clear();
    },
  };
}
