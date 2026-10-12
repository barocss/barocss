import {RenderEditorError, normalizeRenderEditorError} from './errors.js';
import type {RenderMaterialDocument, RenderMaterialPreparation} from './material-document.js';
import type {RenderMaterialPreparedCandidate, RenderMaterialSession} from './material-session.js';

export type RenderMaterialPresenter = (material: RenderMaterialPreparation) => void;
export interface RenderMaterialControllerSnapshot {
  readonly displayed: RenderMaterialDocument | null;
  readonly available: boolean;
  readonly disposed: boolean;
}
export interface RenderMaterialController {
  readonly editorSession: RenderMaterialSession;
  getSnapshot(): RenderMaterialControllerSnapshot;
  subscribe(listener: () => void): () => void;
  setPresenter(presenter: RenderMaterialPresenter | null): void;
  dispose(): void;
}
const ASYNC_FUNCTION = Object.getPrototypeOf(async function () {});
function synchronous<Args extends unknown[]>(callback: (...args: Args) => void, ...args: Args): void {
  if (typeof callback !== 'function') throw new RenderEditorError('DOCUMENT_INPUT', 'Material callback must be a function.');
  if (Object.getPrototypeOf(callback) === ASYNC_FUNCTION) throw new RenderEditorError('PRESENTATION_REFUSED', 'Material presentation must be synchronous.');
  const result: unknown = callback(...args);
  if (result !== null && (typeof result === 'object' || typeof result === 'function') && 'then' in result) {
    throw new RenderEditorError('PRESENTATION_REFUSED', 'Material presentation must be synchronous.');
  }
}
function caused(cause: unknown): RenderEditorError {
  const error = normalizeRenderEditorError(cause, 'PRESENTATION_REFUSED');
  if (error !== cause) Object.defineProperty(error, 'cause', {value: cause, configurable: true});
  return error;
}

/** The caller owns the CPU session and presentation resources. Failed callbacks cannot undo arbitrary side effects. */
export function createRenderMaterialController(session: RenderMaterialSession): RenderMaterialController {
  let presenter: RenderMaterialPresenter | null = null, busy = false, disposed = false;
  let pending: {document: RenderMaterialDocument; presented: boolean} | null = null;
  let snapshot: RenderMaterialControllerSnapshot = Object.freeze({displayed: null, available: false, disposed: false});
  const listeners = new Set<() => void>(), sessionListeners = new Set<() => void>();
  const check = () => {
    if (disposed) throw new RenderEditorError('DISPOSED', 'Material controller is disposed.');
    if (busy) throw new RenderEditorError('STALE_CANDIDATE', 'Material controller transaction is active.');
    if (session.getSnapshot().disposed) throw new RenderEditorError('DISPOSED', 'Material session is disposed.');
  };
  const notify = (targets: Set<() => void>) => {
    for (const listener of [...targets]) {
      if (disposed) break;
      try { listener(); } catch { /* Observer failures do not refuse completed presentation or authoring. */ }
    }
  };
  const update = (displayed: RenderMaterialDocument | null, available: boolean) => {
    if (snapshot.displayed === displayed && snapshot.available === available && snapshot.disposed === disposed) return;
    snapshot = Object.freeze({displayed, available, disposed}); notify(listeners);
  };
  const stopSession = session.subscribe(() => {
    if (disposed) return;
    const state = session.getSnapshot();
    const displayed = state.disposed ? null : pending?.presented && pending.document === state.accepted
      ? state.accepted : snapshot.displayed === state.accepted ? snapshot.displayed : null;
    update(displayed, presenter !== null && !state.disposed);
    notify(sessionListeners);
  });
  const run = <T,>(operation: () => T): T => {
    check(); busy = true;
    try { return operation(); } catch (cause) { throw caused(cause); } finally { busy = false; }
  };
  const listen = (targets: Set<() => void>, listener: () => void) => {
    check();
    if (typeof listener !== 'function') throw new RenderEditorError('DOCUMENT_INPUT', 'Material listener must be a function.');
    targets.add(listener); return () => { targets.delete(listener); };
  };
  const editorSession: RenderMaterialSession = Object.freeze({
    getSnapshot: () => session.getSnapshot(),
    subscribe: (listener: () => void) => listen(sessionListeners, listener),
    setDraftMaterial: (source: string, uniforms: Readonly<Record<string, number>>) => run(() => session.setDraftMaterial(source, uniforms)),
    setDraftSource: (source: string) => run(() => session.setDraftSource(source)),
    setDraftUniforms: (uniforms: Readonly<Record<string, number>>) => run(() => session.setDraftUniforms(uniforms)),
    prepareDraft: () => run(() => session.prepareDraft()),
    prepareOpen: (text: string) => run(() => session.prepareOpen(text)),
    prepareUndo: () => run(() => session.prepareUndo()),
    prepareRedo: () => run(() => session.prepareRedo()),
    commitPrepared(candidate: RenderMaterialPreparedCandidate, beforeCommit?: () => void) {
      run(() => { try {
        const active = presenter;
        if (!active) throw new RenderEditorError('PRESENTATION_REFUSED', 'Attach a material presenter before applying changes.');
        session.commitPrepared(candidate, () => {
          // Only the session-owned, current candidate reaches this callback after all history checks.
          if (beforeCommit !== undefined) synchronous(beforeCommit);
          pending = {document: candidate.document, presented: false};
          synchronous(active, Object.freeze({document: candidate.document, sample: candidate.sample}));
          pending.presented = true;
        });
        const state = session.getSnapshot();
        if (state.disposed || state.accepted !== pending?.document) {
          update(null, presenter !== null && !state.disposed);
          throw new RenderEditorError('STALE_CANDIDATE', 'The accepted material changed after presentation.');
        }
      } finally { pending = null; } });
    },
    discardDraft: () => run(() => session.discardDraft()),
    markSaved: (revision: number) => run(() => session.markSaved(revision)),
    dispose: () => controller.dispose(),
  });
  const controller: RenderMaterialController = {
    editorSession,
    getSnapshot: () => snapshot,
    subscribe: listener => listen(listeners, listener),
    setPresenter(next) {
      run(() => {
        if (next === null) { presenter = null; update(null, false); return; }
        if (typeof next !== 'function') throw new RenderEditorError('DOCUMENT_INPUT', 'Material presenter must be a function or null.');
        const state = session.getSnapshot();
        synchronous(next, Object.freeze({document: state.accepted, sample: state.sample}));
        const current = session.getSnapshot();
        if (current.disposed || current.accepted !== state.accepted) {
          update(null, presenter !== null && !current.disposed);
          throw new RenderEditorError('STALE_CANDIDATE', 'The accepted material changed while attaching its presenter.');
        }
        presenter = next; update(state.accepted, true);
      });
    },
    dispose() {
      if (disposed) return;
      if (busy) throw new RenderEditorError('STALE_CANDIDATE', 'Material controller transaction is active.');
      disposed = true; presenter = null; pending = null; stopSession(); listeners.clear(); sessionListeners.clear();
      snapshot = Object.freeze({displayed: null, available: false, disposed: true});
    },
  };
  return Object.freeze(controller);
}
