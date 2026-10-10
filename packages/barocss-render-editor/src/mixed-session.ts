import type { MeshCamera } from '@barocss/gpu';
import { copyRenderEditorDraftCamera } from './document.js';
import { parseRenderMixedDocument, serializeRenderMixedDocument, RENDER_MIXED_DOCUMENT_LIMITS, RenderMixedDocumentError } from './mixed-document.js';
import type { RenderMixedDocumentV1, RenderMixedDocumentDisplayV1 } from './mixed-document.js';
import { prepareRenderMixedDocument } from './mixed-frame.js';
import type { PreparedRenderMixedDocument } from './mixed-frame.js';
import { prepareRenderNativeSourceImport } from './native-source-import.js';

export const RENDER_MIXED_SESSION_LIMITS = Object.freeze({ historyEntries: 32, historyBytes: 4 * 1024 * 1024 });
export type RenderMixedSessionPurpose = 'apply' | 'open' | 'undo' | 'redo';

export interface RenderMixedPreparedCandidate {
  readonly prepared: PreparedRenderMixedDocument;
  readonly purpose: RenderMixedSessionPurpose;
}

export interface RenderMixedSessionSnapshot {
  readonly accepted: RenderMixedDocumentV1;
  readonly prepared: PreparedRenderMixedDocument;
  /** Owned draft data. Numeric camera/display values can await validation. */
  readonly draft: RenderMixedDocumentV1;
  readonly dirty: boolean;
  readonly diagnostics: RenderMixedDocumentError | null;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly savedRevision: number | null;
  readonly disposed: boolean;
}

export interface RenderMixedSession {
  getSnapshot(): RenderMixedSessionSnapshot;
  subscribe(listener: () => void): () => void;
  setDraftTitle(title: string): void;
  setDraftSource(kind: 'scene' | 'asset', text: string): void;
  setDraftCamera(camera: MeshCamera): void;
  setDraftDisplay(display: RenderMixedDocumentDisplayV1): void;
  setDraftAssetReference(modelId: string, surfaceId: string): void;
  setDraftNativeAsset(source: string, modelId: string, surfaceId: string): void;
  discardDraft(): void;
  prepareDraft(): RenderMixedPreparedCandidate;
  prepareOpen(text: string): RenderMixedPreparedCandidate;
  prepareUndo(): RenderMixedPreparedCandidate | null;
  prepareRedo(): RenderMixedPreparedCandidate | null;
  commitPrepared(candidate: RenderMixedPreparedCandidate, beforeCommit?: () => void): void;
  markSaved(revision: number): void;
  dispose(): void;
}

interface HistoryEntry { readonly document: RenderMixedDocumentV1; readonly bytes: number }
interface HistoryPlan { readonly entries: readonly HistoryEntry[]; readonly index: number }
interface CandidateState { readonly generation: number; readonly plan: HistoryPlan; used: boolean }

function error(message: string): RenderMixedDocumentError { return new RenderMixedDocumentError('INPUT', message); }
function diagnostic(cause: unknown): RenderMixedDocumentError {
  return cause instanceof RenderMixedDocumentError ? cause : new RenderMixedDocumentError('INPUT', 'Mixed document preparation failed.', cause);
}
function measure(document: RenderMixedDocumentV1): number { return new TextEncoder().encode(serializeRenderMixedDocument(document)).length; }

function ownedEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  const keys = Object.keys(a), otherKeys = Object.keys(b);
  if (keys.length !== otherKeys.length) return false;
  return keys.every((key) => Object.prototype.hasOwnProperty.call(b, key)
    && ownedEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]));
}

/** Copy structural numeric draft data without invoking user accessors. */
function copyDraftDisplay(input: unknown): RenderMixedDocumentDisplayV1 {
  const keys = ['mmToSceneUnit', 'translate', 'color', 'countU', 'countV'];
  if (input === null || typeof input !== 'object' || Object.getPrototypeOf(input) !== Object.prototype) {
    throw error('Display draft must be a plain data object.');
  }
  const actual = Reflect.ownKeys(input);
  if (actual.length !== keys.length || actual.some((key) => typeof key !== 'string' || !keys.includes(key))) {
    throw error('Display draft has missing or unsupported fields.');
  }
  const data: Record<string, unknown> = {};
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) throw error(`Display.${key} must be own enumerable data.`);
    data[key] = descriptor.value;
  }
  const vector = (input: unknown, label: string): readonly [number, number, number] => {
    if (!Array.isArray(input) || Object.getPrototypeOf(input) !== Array.prototype) throw error(`${label} must be a dense numeric XYZ array.`);
    const length = Object.getOwnPropertyDescriptor(input, 'length');
    if (!length || !('value' in length) || length.value !== 3 || Reflect.ownKeys(input).length !== 4) {
      throw error(`${label} must have exactly three own elements.`);
    }
    const output: number[] = [];
    for (let i = 0; i < 3; i++) {
      const descriptor = Object.getOwnPropertyDescriptor(input, String(i));
      if (!descriptor || !('value' in descriptor) || !descriptor.enumerable || typeof descriptor.value !== 'number') {
        throw error(`${label} must contain own numeric data.`);
      }
      output.push(descriptor.value);
    }
    return Object.freeze(output) as unknown as readonly [number, number, number];
  };
  for (const key of ['mmToSceneUnit', 'countU', 'countV']) if (typeof data[key] !== 'number') throw error(`Display.${key} must be numeric draft data.`);
  return Object.freeze({ mmToSceneUnit: data.mmToSceneUnit as number,
    translate: vector(data.translate, 'Display.translate'), color: vector(data.color, 'Display.color'),
    countU: data.countU as number, countV: data.countV as number });
}

/** Authoring/history only. The host supplies synchronous presentation at commit. */
export function createRenderMixedSession(initial: RenderMixedDocumentV1): RenderMixedSession {
  let prepared = prepareRenderMixedDocument(initial), accepted = prepared.document, draft = accepted;
  let diagnostics: RenderMixedDocumentError | null = null, savedRevision: number | null = null;
  let disposed = false, locked = false, generation = 0, historyIndex = 0;
  let history: readonly HistoryEntry[] = Object.freeze([Object.freeze({ document: accepted, bytes: measure(accepted) })]);
  const candidates = new WeakMap<object, CandidateState>(), listeners = new Set<() => void>();
  const makeSnapshot = (): RenderMixedSessionSnapshot => Object.freeze({ accepted, prepared, draft,
    dirty: !ownedEqual(draft, accepted), diagnostics, canUndo: !disposed && historyIndex > 0,
    canRedo: !disposed && historyIndex < history.length - 1, savedRevision, disposed });
  let snapshot = makeSnapshot();
  const assertMutable = (): void => {
    if (disposed) throw error('Mixed document session is disposed.');
    if (locked) throw error('Mixed document session mutations are locked during presentation.');
  };
  const changed = (): void => {
    generation++;
    snapshot = makeSnapshot();
    for (const listener of [...listeners]) {
      // Observer errors cannot change the result of an accepted transaction.
      try { listener(); } catch { /* The host owns its observer errors. */ }
    }
  };
  const setDraft = (next: RenderMixedDocumentV1): void => {
    let nextDiagnostics: RenderMixedDocumentError | null = null;
    try { prepareRenderMixedDocument(next); } catch (cause) { nextDiagnostics = Object.freeze(diagnostic(cause)); }
    draft = Object.freeze(next); diagnostics = nextDiagnostics; changed();
  };
  const nextRevision = (): number => {
    if (accepted.revision === 2147483647) throw error('Accepted document revision is at its maximum.');
    return accepted.revision + 1;
  };
  const historyPlan = (entry: HistoryEntry, purpose: RenderMixedSessionPurpose, targetIndex: number | null): HistoryPlan => {
    if (entry.bytes > RENDER_MIXED_SESSION_LIMITS.historyBytes) throw error('The authored document cannot fit the history byte limit.');
    let entries: HistoryEntry[], index: number;
    if (purpose === 'open') { entries = [entry]; index = 0; }
    else if (targetIndex !== null) { entries = [...history]; index = targetIndex; entries[index] = entry; }
    else { entries = [...history.slice(0, historyIndex + 1), entry]; index = entries.length - 1; }
    let totalBytes = entries.reduce((total, item) => total + item.bytes, 0);
    while (entries.length > RENDER_MIXED_SESSION_LIMITS.historyEntries || totalBytes > RENDER_MIXED_SESSION_LIMITS.historyBytes) {
      if (index === 0) throw error('The restored history cannot fit its byte limit.');
      totalBytes -= entries.shift()!.bytes; index--;
    }
    return Object.freeze({ entries: Object.freeze(entries), index });
  };
  const prepare = (input: RenderMixedDocumentV1, purpose: RenderMixedSessionPurpose, targetIndex: number | null = null): RenderMixedPreparedCandidate => {
    assertMutable();
    const nextPrepared = prepareRenderMixedDocument(input);
    const entry = Object.freeze({ document: nextPrepared.document, bytes: measure(nextPrepared.document) });
    const plan = historyPlan(entry, purpose, targetIndex);
    const candidate = Object.freeze({ prepared: nextPrepared, purpose });
    candidates.set(candidate, { generation, plan, used: false });
    return candidate;
  };
  const session: RenderMixedSession = {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      assertMutable();
      if (typeof listener !== 'function') throw error('Session listener must be a function.');
      listeners.add(listener);
      return () => {
        if (locked) throw error('Session listener mutations are locked during presentation.');
        listeners.delete(listener);
      };
    },
    setDraftTitle(title) {
      assertMutable();
      if (typeof title !== 'string' || title.length > 256 || [...title].length > 128 || title.trim() === '') {
        throw error('Title must contain text and have at most 128 code points.');
      }
      setDraft({ ...draft, title });
    },
    setDraftSource(kind, text) {
      assertMutable();
      if (kind !== 'scene' && kind !== 'asset') throw error('Source draft kind must be scene or asset.');
      if (typeof text !== 'string') throw error('Source draft must be a string.');
      if (text.length > RENDER_MIXED_DOCUMENT_LIMITS.sourceCodeUnits
        || new TextEncoder().encode(text).length > RENDER_MIXED_DOCUMENT_LIMITS.sourceBytes) {
        throw new RenderMixedDocumentError('BYTES', 'Source draft exceeds 65536 UTF-8 bytes or code units.');
      }
      if (kind === 'scene') setDraft({ ...draft, sceneSource: text });
      else {
        const changedSource = text !== accepted.asset.source;
        if (changedSource && accepted.asset.revision === 2147483647) throw error('Accepted asset revision is at its maximum.');
        setDraft({ ...draft, asset: Object.freeze({ ...draft.asset, source: text,
          revision: changedSource ? accepted.asset.revision + 1 : accepted.asset.revision }) });
      }
    },
    setDraftCamera(camera) {
      assertMutable();
      let owned: MeshCamera;
      try { owned = copyRenderEditorDraftCamera(camera); }
      catch (cause) { throw new RenderMixedDocumentError('INPUT', 'Camera draft must contain exact own numeric data.', cause); }
      setDraft({ ...draft, camera: owned });
    },
    setDraftDisplay(display) { assertMutable(); setDraft({ ...draft, display: copyDraftDisplay(display) }); },
    setDraftAssetReference(modelId, surfaceId) {
      assertMutable();
      if (typeof modelId !== 'string' || typeof surfaceId !== 'string' || modelId.length > 128 || surfaceId.length > 128) {
        throw error('Asset reference drafts must be strings of at most 128 characters.');
      }
      setDraft({ ...draft, asset: Object.freeze({ ...draft.asset, modelId, surfaceId }) });
    },
    setDraftNativeAsset(source, modelId, surfaceId) {
      assertMutable();
      const referencePattern = /^[A-Za-z_][A-Za-z0-9_.:-]{0,127}$/;
      if (typeof modelId !== 'string' || typeof surfaceId !== 'string'
        || !referencePattern.test(modelId) || !referencePattern.test(surfaceId)) {
        throw error('Native model and Surface references must be ASCII identifiers of 1..128 characters.');
      }
      const imported = prepareRenderNativeSourceImport(source);
      if (modelId !== imported.modelId) {
        throw new RenderMixedDocumentError('QUALIFICATION', 'Native model reference does not match the imported original source.');
      }
      if (!imported.surfaces.some((surface) => surface.id === surfaceId)) {
        throw new RenderMixedDocumentError('QUALIFICATION', 'Selected Surface does not exist in the imported original model.');
      }
      const changedSource = imported.source !== accepted.asset.source;
      if (changedSource && accepted.asset.revision === 2147483647) throw error('Accepted asset revision is at its maximum.');
      // Stage source and its qualified references together; unrelated drafts stay.
      setDraft({ ...draft, asset: Object.freeze({ ...draft.asset, source: imported.source, modelId, surfaceId,
        revision: changedSource ? accepted.asset.revision + 1 : accepted.asset.revision }) });
    },
    discardDraft() { assertMutable(); draft = accepted; diagnostics = null; changed(); },
    prepareDraft() { assertMutable(); return prepare({ ...draft, revision: nextRevision() }, 'apply'); },
    prepareOpen(text) { assertMutable(); return prepare(parseRenderMixedDocument(text), 'open'); },
    prepareUndo() {
      assertMutable();
      return historyIndex === 0 ? null : prepare({ ...history[historyIndex - 1]!.document, revision: nextRevision() }, 'undo', historyIndex - 1);
    },
    prepareRedo() {
      assertMutable();
      return historyIndex === history.length - 1 ? null : prepare({ ...history[historyIndex + 1]!.document, revision: nextRevision() }, 'redo', historyIndex + 1);
    },
    commitPrepared(candidate, beforeCommit) {
      assertMutable();
      const state = candidate !== null && typeof candidate === 'object' ? candidates.get(candidate) : undefined;
      if (!state || state.used || state.generation !== generation) throw error('Prepared candidate is stale, foreign, forged, or already used.');
      if (beforeCommit !== undefined && typeof beforeCommit !== 'function') throw error('Presentation callback must be a function.');
      locked = true;
      try {
        const result: unknown = beforeCommit?.();
        if (result !== null && (typeof result === 'object' || typeof result === 'function') && 'then' in result) {
          throw error('Presentation callback must be synchronous.');
        }
        // All native/frame construction, bytes and eviction were prepared first.
        prepared = candidate.prepared; accepted = prepared.document; draft = accepted; diagnostics = null;
        history = state.plan.entries; historyIndex = state.plan.index; state.used = true;
        if (candidate.purpose === 'open') savedRevision = accepted.revision;
      } finally { locked = false; }
      changed();
    },
    markSaved(revision) {
      assertMutable();
      if (!Object.is(revision, accepted.revision)) throw error('Saved revision does not match the accepted document.');
      savedRevision = revision; changed();
    },
    dispose() {
      if (disposed) return;
      assertMutable(); disposed = true; changed(); listeners.clear();
    },
  };
  return Object.freeze(session);
}
