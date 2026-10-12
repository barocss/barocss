import {copyRenderMaterialUniforms, parseRenderMaterialDocument, prepareRenderMaterialDocument,
  RENDER_MATERIAL_LIMITS, serializeRenderMaterialDocument, validateRenderMaterialSourceInput} from './material-document.js';
import type {RenderMaterialDocument, RenderMaterialPreparation} from './material-document.js';
import {RenderEditorError} from './errors.js';

export type RenderMaterialPurpose = 'apply' | 'open' | 'undo' | 'redo';
export interface RenderMaterialPreparedCandidate {
  readonly document: RenderMaterialDocument;
  readonly sample: RenderMaterialPreparation['sample'];
  readonly purpose: RenderMaterialPurpose;
}
export interface RenderMaterialSessionSnapshot {
  readonly accepted: RenderMaterialDocument;
  readonly sample: RenderMaterialPreparation['sample'];
  readonly draftSource: string;
  readonly draftUniforms: Readonly<Record<string, number>>;
  readonly diagnostics: RenderEditorError['diagnostics'];
  readonly dirty: boolean;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly savedRevision: number | null;
  readonly disposed: boolean;
}
export interface RenderMaterialSession {
  getSnapshot(): RenderMaterialSessionSnapshot;
  subscribe(listener: () => void): () => void;
  setDraftMaterial(source: string, uniforms: Readonly<Record<string, number>>): void;
  setDraftSource(source: string): void;
  setDraftUniforms(uniforms: Readonly<Record<string, number>>): void;
  prepareDraft(): RenderMaterialPreparedCandidate;
  prepareOpen(text: string): RenderMaterialPreparedCandidate;
  prepareUndo(): RenderMaterialPreparedCandidate | null;
  prepareRedo(): RenderMaterialPreparedCandidate | null;
  commitPrepared(candidate: RenderMaterialPreparedCandidate, beforeCommit?: () => void): void;
  discardDraft(): void;
  markSaved(revision: number): void;
  dispose(): void;
}
interface HistoryEntry {readonly document: RenderMaterialDocument; readonly bytes: number}
interface CandidateState {readonly generation: number; readonly historyIndex: number | null; readonly bytes: number; used: boolean}
const EMPTY_DIAGNOSTICS: RenderEditorError['diagnostics'] = Object.freeze([]);
const ASYNC_FUNCTION = Object.getPrototypeOf(async function () {});
function equalUniforms(a: Readonly<Record<string, number>>, b: Readonly<Record<string, number>>): boolean {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every(key => Object.hasOwn(b, key) && Object.is(a[key], b[key]));
}
const documentBytes = (document: RenderMaterialDocument) => new TextEncoder().encode(serializeRenderMaterialDocument(document)).length;

/** Original shader text and supplied overrides are the history authority; CPU samples are derived. */
export function createRenderMaterialSession(initial: RenderMaterialDocument): RenderMaterialSession {
  const prepared = prepareRenderMaterialDocument(initial);
  let accepted = prepared.document, sample = prepared.sample;
  let draftSource = accepted.shaderSource, draftUniforms = accepted.uniforms;
  let diagnostics = EMPTY_DIAGNOSTICS, savedRevision: number | null = null;
  let disposed = false, locked = false, generation = 0, historyIndex = 0;
  let history: HistoryEntry[] = [{document: accepted, bytes: documentBytes(accepted)}];
  const candidates = new WeakMap<object, CandidateState>(), listeners = new Set<() => void>();
  const makeSnapshot = (): RenderMaterialSessionSnapshot => Object.freeze({accepted, sample, draftSource, draftUniforms, diagnostics,
    dirty: draftSource !== accepted.shaderSource || !equalUniforms(draftUniforms, accepted.uniforms),
    canUndo: !disposed && historyIndex > 0, canRedo: !disposed && historyIndex < history.length - 1, savedRevision, disposed});
  let snapshot = makeSnapshot();
  const assertMutable = () => {
    if (disposed) throw new RenderEditorError('DISPOSED', 'Material session is disposed.');
    if (locked) throw new RenderEditorError('STALE_CANDIDATE', 'Material session mutation is locked during qualification.');
  };
  const qualify = <T,>(operation: () => T): T => {
    assertMutable(); locked = true;
    try { return operation(); } finally { locked = false; }
  };
  const changed = () => {
    generation++; snapshot = makeSnapshot();
    for (const listener of [...listeners]) { try { listener(); } catch { /* Observer failures do not refuse completed CPU authoring. */ } }
  };
  const draftDiagnostics = (source: string, uniforms: Readonly<Record<string, number>>): RenderEditorError['diagnostics'] => {
    try { prepareRenderMaterialDocument({...accepted, shaderSource: source, uniforms}); return EMPTY_DIAGNOSTICS; }
    catch (cause) { if (cause instanceof RenderEditorError) return cause.diagnostics; throw cause; }
  };
  const nextRevision = () => {
    if (accepted.revision === 2147483647) throw new RenderEditorError('DOCUMENT_INPUT', 'Material revision is at its maximum.');
    return accepted.revision + 1;
  };
  const prepare = (input: RenderMaterialDocument, purpose: RenderMaterialPurpose, targetIndex: number | null = null): RenderMaterialPreparedCandidate => {
    const result = prepareRenderMaterialDocument(input), bytes = documentBytes(result.document);
    if (bytes > RENDER_MATERIAL_LIMITS.historyBytes) throw new RenderEditorError('HISTORY_LIMIT', 'Material cannot fit the history byte limit.');
    const candidate = Object.freeze({document: result.document, sample: result.sample, purpose});
    candidates.set(candidate, {generation, historyIndex: targetIndex, bytes, used: false});
    return candidate;
  };
  const session: RenderMaterialSession = {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      assertMutable();
      if (typeof listener !== 'function') throw new RenderEditorError('DOCUMENT_INPUT', 'Material listener must be a function.');
      listeners.add(listener); return () => { listeners.delete(listener); };
    },
    setDraftMaterial(source, uniforms) {
      qualify(() => {
        const next = prepareRenderMaterialDocument({...accepted, shaderSource: source, uniforms}).document;
        draftSource = next.shaderSource; draftUniforms = next.uniforms; diagnostics = EMPTY_DIAGNOSTICS;
      }); changed();
    },
    setDraftSource(source) {
      qualify(() => {
        validateRenderMaterialSourceInput(source);
        const nextDiagnostics = draftDiagnostics(source, draftUniforms);
        draftSource = source; diagnostics = nextDiagnostics;
      }); changed();
    },
    setDraftUniforms(uniforms) {
      qualify(() => {
        const copied = copyRenderMaterialUniforms(uniforms), nextDiagnostics = draftDiagnostics(draftSource, copied);
        draftUniforms = copied; diagnostics = nextDiagnostics;
      }); changed();
    },
    prepareDraft() { return qualify(() => prepare({...accepted, revision: nextRevision(), shaderSource: draftSource, uniforms: draftUniforms}, 'apply')); },
    prepareOpen(text) { return qualify(() => prepare(parseRenderMaterialDocument(text), 'open')); },
    prepareUndo() { return qualify(() => historyIndex === 0 ? null : prepare({...history[historyIndex - 1]!.document, revision: nextRevision()}, 'undo', historyIndex - 1)); },
    prepareRedo() { return qualify(() => historyIndex === history.length - 1 ? null : prepare({...history[historyIndex + 1]!.document, revision: nextRevision()}, 'redo', historyIndex + 1)); },
    commitPrepared(candidate, beforeCommit) {
      qualify(() => {
        const state = candidate !== null && typeof candidate === 'object' ? candidates.get(candidate) : undefined;
        if (!state || state.used || state.generation !== generation) throw new RenderEditorError('STALE_CANDIDATE', 'Material candidate is stale, foreign, forged, or already used.');
        const entry = {document: candidate.document, bytes: state.bytes};
        let nextHistory: HistoryEntry[], nextIndex: number;
        if (candidate.purpose === 'open') { nextHistory = [entry]; nextIndex = 0; }
        else if (state.historyIndex !== null) { nextHistory = history.slice(); nextIndex = state.historyIndex; nextHistory[nextIndex] = entry; }
        else { nextHistory = [...history.slice(0, historyIndex + 1), entry]; nextIndex = nextHistory.length - 1; }
        if (nextHistory.length > RENDER_MATERIAL_LIMITS.historyEntries
          || nextHistory.reduce((sum, item) => sum + item.bytes, 0) > RENDER_MATERIAL_LIMITS.historyBytes) {
          throw new RenderEditorError('HISTORY_LIMIT', 'Material history exceeds its entry or byte limit.');
        }
        if (beforeCommit !== undefined) {
          if (typeof beforeCommit !== 'function') throw new RenderEditorError('DOCUMENT_INPUT', 'Material presentation callback must be a function.');
          if (Object.getPrototypeOf(beforeCommit) === ASYNC_FUNCTION) throw new RenderEditorError('PRESENTATION_REFUSED', 'Material presentation callback must be synchronous.');
          const result: unknown = beforeCommit();
          if (result !== null && (typeof result === 'object' || typeof result === 'function') && 'then' in result) {
            throw new RenderEditorError('PRESENTATION_REFUSED', 'Material presentation callback must be synchronous.');
          }
        }
        accepted = candidate.document; sample = candidate.sample;
        history = nextHistory; historyIndex = nextIndex; state.used = true;
        draftSource = accepted.shaderSource; draftUniforms = accepted.uniforms; diagnostics = EMPTY_DIAGNOSTICS;
        if (candidate.purpose === 'open') savedRevision = accepted.revision;
      }); changed();
    },
    discardDraft() { assertMutable(); draftSource = accepted.shaderSource; draftUniforms = accepted.uniforms; diagnostics = EMPTY_DIAGNOSTICS; changed(); },
    markSaved(revision) {
      assertMutable();
      if (revision !== accepted.revision) throw new RenderEditorError('STALE_CANDIDATE', 'Saved revision does not match the accepted material.');
      savedRevision = revision; changed();
    },
    dispose() { if (disposed) return; assertMutable(); disposed = true; changed(); listeners.clear(); },
  };
  return Object.freeze(session);
}
