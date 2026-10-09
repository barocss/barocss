import type { GpuDiagnostic, MeshCamera } from '@barocss/gpu';
import { compileRenderEditorSource, copyRenderEditorDraftCamera, parseRenderEditorDocument,
  RENDER_EDITOR_LIMITS, renderEditorUtf8Bytes, serializeRenderEditorDocument,
  validateRenderEditorDocument, validateRenderEditorSourceInput } from './document.js';
import type { RenderEditorMetadata, RenderSceneDocumentV0 } from './document.js';
import { RenderEditorError } from './errors.js';

export type RenderEditorApplyMode = 'source' | 'camera' | 'both';
export type RenderEditorPurpose = 'apply' | 'open' | 'undo' | 'redo';
export interface RenderEditorPreparedCandidate {
  readonly document: RenderSceneDocumentV0;
  readonly metadata: RenderEditorMetadata;
  readonly mode: RenderEditorApplyMode;
  readonly purpose: RenderEditorPurpose;
}
export interface RenderEditorSessionSnapshot {
  readonly accepted: RenderSceneDocumentV0;
  readonly metadata: RenderEditorMetadata;
  readonly draftSource: string;
  readonly draftCamera: MeshCamera;
  readonly sourceDirty: boolean;
  readonly cameraDirty: boolean;
  readonly activeObjectId: string | null;
  readonly diagnostics: readonly GpuDiagnostic[];
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly savedRevision: number | null;
  readonly disposed: boolean;
}
export interface RenderEditorSession {
  getSnapshot(): RenderEditorSessionSnapshot;
  subscribe(listener: () => void): () => void;
  setDraftSource(source: string): void;
  setDraftCamera(camera: MeshCamera): void;
  setActiveObject(id: string | null): void;
  prepareDraft(mode?: RenderEditorApplyMode): RenderEditorPreparedCandidate;
  prepareOpen(text: string): RenderEditorPreparedCandidate;
  prepareUndo(): RenderEditorPreparedCandidate | null;
  prepareRedo(): RenderEditorPreparedCandidate | null;
  commitPrepared(candidate: RenderEditorPreparedCandidate, beforeCommit?: () => void): void;
  discardDraft(): void;
  markSaved(revision: number): void;
  dispose(): void;
}
interface HistoryEntry { readonly document: RenderSceneDocumentV0; readonly bytes: number }
interface CandidateState { readonly generation: number; readonly historyIndex: number | null; readonly bytes: number; used: boolean }
const EMPTY_DIAGNOSTICS: readonly GpuDiagnostic[] = Object.freeze([]);

function camerasEqual(a: MeshCamera, b: MeshCamera): boolean {
  return ['eye', 'target', 'up'].every((key) => {
    const vector = key as 'eye' | 'target' | 'up';
    return a[vector].every((value, i) => Object.is(value, b[vector][i]));
  }) && Object.is(a.fovYDegrees, b.fovYDegrees) && Object.is(a.near, b.near) && Object.is(a.far, b.far);
}

export function createRenderEditorSession(initial: RenderSceneDocumentV0): RenderEditorSession {
  let accepted = validateRenderEditorDocument(initial), metadata = compileRenderEditorSource(accepted.sceneSource);
  let draftSource = accepted.sceneSource, draftCamera = accepted.camera;
  let diagnostics = EMPTY_DIAGNOSTICS, activeObjectId: string | null = null, savedRevision: number | null = null;
  let disposed = false, locked = false, generation = 0, historyIndex = 0;
  let history: HistoryEntry[] = [{ document: accepted, bytes: renderEditorUtf8Bytes(serializeRenderEditorDocument(accepted)) }];
  const candidates = new WeakMap<object, CandidateState>(), listeners = new Set<() => void>();
  const makeSnapshot = (): RenderEditorSessionSnapshot => Object.freeze({ accepted, metadata, draftSource, draftCamera,
    sourceDirty: draftSource !== accepted.sceneSource, cameraDirty: !camerasEqual(draftCamera, accepted.camera),
    activeObjectId, diagnostics, canUndo: !disposed && historyIndex > 0, canRedo: !disposed && historyIndex < history.length - 1,
    savedRevision, disposed });
  let snapshot = makeSnapshot();
  const assertAlive = (): void => { if (disposed) throw new RenderEditorError('DISPOSED', 'Render editor session is disposed'); };
  const assertMutable = (): void => {
    assertAlive();
    if (locked) throw new RenderEditorError('STALE_CANDIDATE', 'Session mutation is locked during presentation');
  };
  const changed = (): void => {
    generation++;
    snapshot = makeSnapshot();
    for (const listener of [...listeners]) {
      // Observers cannot turn a completed authoring transaction into a refusal.
      try { listener(); } catch { /* Observer errors belong to their host. */ }
    }
  };
  const nextRevision = (): number => {
    if (accepted.revision === 2147483647) throw new RenderEditorError('DOCUMENT_INPUT', 'Accepted revision is at its maximum');
    return accepted.revision + 1;
  };
  const prepare = (input: RenderSceneDocumentV0, mode: RenderEditorApplyMode, purpose: RenderEditorPurpose,
    targetIndex: number | null = null): RenderEditorPreparedCandidate => {
    assertMutable();
    const document = validateRenderEditorDocument(input), bytes = renderEditorUtf8Bytes(serializeRenderEditorDocument(document));
    if (bytes > RENDER_EDITOR_LIMITS.historyBytes) throw new RenderEditorError('HISTORY_LIMIT', 'Document cannot fit the history byte limit');
    const candidate = Object.freeze({ document, metadata: compileRenderEditorSource(document.sceneSource), mode, purpose });
    candidates.set(candidate, { generation, historyIndex: targetIndex, bytes, used: false });
    return candidate;
  };
  const requireCandidate = (candidate: RenderEditorPreparedCandidate): CandidateState => {
    const state = candidate !== null && typeof candidate === 'object' ? candidates.get(candidate) : undefined;
    if (!state || state.used || state.generation !== generation) {
      throw new RenderEditorError('STALE_CANDIDATE', 'Prepared candidate is stale, foreign, forged, or already used');
    }
    return state;
  };
  const session: RenderEditorSession = {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      assertMutable();
      if (typeof listener !== 'function') throw new RenderEditorError('DOCUMENT_INPUT', 'Session listener must be a function');
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    setDraftSource(source) {
      assertMutable();
      validateRenderEditorSourceInput(source);
      let nextDiagnostics = EMPTY_DIAGNOSTICS;
      try { compileRenderEditorSource(source); } catch (error) {
        if (!(error instanceof RenderEditorError) || error.code !== 'SOURCE_REFUSED') throw error;
        nextDiagnostics = error.diagnostics;
      }
      draftSource = source;
      diagnostics = nextDiagnostics;
      changed();
    },
    setDraftCamera(camera) {
      assertMutable();
      draftCamera = copyRenderEditorDraftCamera(camera);
      changed();
    },
    setActiveObject(id) {
      assertMutable();
      if (id !== null && !metadata.objects.some((object) => object.id === id)) {
        throw new RenderEditorError('DOCUMENT_INPUT', 'Active object ID must exist in accepted scene metadata');
      }
      activeObjectId = id;
      changed();
    },
    prepareDraft(mode = 'both') {
      assertMutable();
      if (mode !== 'source' && mode !== 'camera' && mode !== 'both') throw new RenderEditorError('DOCUMENT_INPUT', 'Unknown Apply mode');
      return prepare({ ...accepted, revision: nextRevision(),
        sceneSource: mode === 'camera' ? accepted.sceneSource : draftSource,
        camera: mode === 'source' ? accepted.camera : draftCamera }, mode, 'apply');
    },
    prepareOpen(text) { assertMutable(); return prepare(parseRenderEditorDocument(text), 'both', 'open'); },
    prepareUndo() {
      assertMutable();
      return historyIndex === 0 ? null : prepare({ ...history[historyIndex - 1]!.document, revision: nextRevision() }, 'both', 'undo', historyIndex - 1);
    },
    prepareRedo() {
      assertMutable();
      return historyIndex === history.length - 1 ? null : prepare({ ...history[historyIndex + 1]!.document, revision: nextRevision() }, 'both', 'redo', historyIndex + 1);
    },
    commitPrepared(candidate, beforeCommit) {
      assertMutable();
      const state = requireCandidate(candidate);
      if (beforeCommit !== undefined && typeof beforeCommit !== 'function') throw new RenderEditorError('DOCUMENT_INPUT', 'Presentation callback must be a function');
      // Plan history before touching presentation. Eviction becomes visible only on success.
      let nextHistory: HistoryEntry[], nextIndex: number;
      const entry = { document: candidate.document, bytes: state.bytes };
      if (candidate.purpose === 'open') { nextHistory = [entry]; nextIndex = 0; }
      else if (state.historyIndex !== null) {
        nextHistory = history.slice(); nextIndex = state.historyIndex; nextHistory[nextIndex] = entry;
      } else {
        nextHistory = [...history.slice(0, historyIndex + 1), entry]; nextIndex = nextHistory.length - 1;
      }
      let bytes = nextHistory.reduce((sum, item) => sum + item.bytes, 0);
      while (nextHistory.length > RENDER_EDITOR_LIMITS.historyEntries || bytes > RENDER_EDITOR_LIMITS.historyBytes) {
        if (nextIndex === 0) throw new RenderEditorError('HISTORY_LIMIT', 'Current history cannot fit its limits');
        bytes -= nextHistory.shift()!.bytes; nextIndex--;
      }
      locked = true;
      try {
        const result: unknown = beforeCommit?.();
        if (result !== null && (typeof result === 'object' || typeof result === 'function') && 'then' in result) {
          throw new RenderEditorError('PRESENTATION_REFUSED', 'Presentation callback must be synchronous');
        }
        // A callback cannot reenter setters, commit, preparation, save, or disposal.
        accepted = candidate.document; metadata = candidate.metadata;
        history = nextHistory; historyIndex = nextIndex; state.used = true;
        if (candidate.purpose !== 'apply' || candidate.mode !== 'camera') { draftSource = accepted.sceneSource; diagnostics = EMPTY_DIAGNOSTICS; }
        if (candidate.purpose !== 'apply' || candidate.mode !== 'source') draftCamera = accepted.camera;
        if (activeObjectId !== null && !metadata.objects.some((object) => object.id === activeObjectId)) activeObjectId = null;
        if (candidate.purpose === 'open') savedRevision = accepted.revision;
      } finally { locked = false; }
      changed();
    },
    discardDraft() {
      assertMutable(); draftSource = accepted.sceneSource; draftCamera = accepted.camera; diagnostics = EMPTY_DIAGNOSTICS; changed();
    },
    markSaved(revision) {
      assertMutable();
      if (revision !== accepted.revision) throw new RenderEditorError('STALE_CANDIDATE', 'Saved revision does not match accepted data');
      savedRevision = revision; changed();
    },
    dispose() {
      if (disposed) return;
      assertMutable(); disposed = true; changed(); listeners.clear();
    },
  };
  return Object.freeze(session);
}
