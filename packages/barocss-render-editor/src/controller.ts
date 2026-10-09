import {RenderEditorError} from './errors.js';
import type {RenderSceneDocumentV0} from './document.js';
import type {RenderEditorApplyMode, RenderEditorPreparedCandidate, RenderEditorSession} from './session.js';

export type PresentationResult = {ok: true} | {ok: false; error: Error; recovered: boolean};
export interface RenderEditorPresenter {
  present(candidate: RenderEditorPreparedCandidate, previous: RenderSceneDocumentV0): PresentationResult;
  recover(document: RenderSceneDocumentV0): PresentationResult;
  dispose(): void;
}
export interface RenderEditorControllerSnapshot {
  readonly presentedRevision: number | null;
  readonly presentationError: RenderEditorError | null;
  readonly disposed: boolean;
}
export type RenderEditorActionResult = {ok: true} | {ok: false; error: RenderEditorError};
export interface RenderEditorController {
  readonly session: RenderEditorSession;
  getSnapshot(): RenderEditorControllerSnapshot;
  subscribe(listener: () => void): () => void;
  attachPresenter(presenter: RenderEditorPresenter): RenderEditorActionResult;
  detachPresenter(presenter: RenderEditorPresenter): void;
  apply(mode?: RenderEditorApplyMode): RenderEditorActionResult;
  open(text: string): RenderEditorActionResult;
  undo(): RenderEditorActionResult;
  redo(): RenderEditorActionResult;
  recover(): RenderEditorActionResult;
  presentationUnavailable(error: Error): void;
  dispose(): void;
}

/** Pure synchronous orchestration. Hosts inject their presentation resources. */
export function createRenderEditorController(session: RenderEditorSession, initialPresenter?: RenderEditorPresenter): RenderEditorController {
  let presenter: RenderEditorPresenter | null = null;
  let presentedDocument: RenderSceneDocumentV0 | null = null;
  let transactionActive = false;
  let snapshot: RenderEditorControllerSnapshot = Object.freeze({presentedRevision: null, presentationError: null, disposed: false});
  const listeners = new Set<() => void>();
  const emit = (next: RenderEditorControllerSnapshot) => {
    snapshot = Object.freeze(next);
    for (const listener of [...listeners]) { try { listener(); } catch { /* An observer cannot invalidate an accepted frame. */ } }
  };
  const check = () => { if (snapshot.disposed) throw new RenderEditorError('DISPOSED', 'The editor controller is disposed.'); if (transactionActive) throw new RenderEditorError('STALE_CANDIDATE', 'A presentation transaction is active.'); };
  const failure = (error: unknown): RenderEditorActionResult => ({ok: false, error: error instanceof RenderEditorError ? error : new RenderEditorError('PRESENTATION_REFUSED', error instanceof Error ? error.message : 'Presentation failed.')});
  const run = (prepare: () => RenderEditorPreparedCandidate | null): RenderEditorActionResult => {
    try {
      check();
      if (!presenter || snapshot.presentedRevision === null || presentedDocument !== session.getSnapshot().accepted) throw new RenderEditorError('PRESENTATION_REFUSED', 'Recover the viewport before applying an edit.');
      const candidate = prepare();
      if (!candidate) return {ok: true};
      const previous = session.getSnapshot().accepted;
      transactionActive = true;
      try { session.commitPrepared(candidate, () => {
        let result: PresentationResult;
        try { result = presenter!.present(candidate, previous); }
        catch (cause) { presentedDocument = null; const error = new RenderEditorError('PRESENTATION_REFUSED', cause instanceof Error ? cause.message : 'Presenter threw.'); emit({...snapshot, presentedRevision: null, presentationError: error}); throw error; }
        if (!result.ok) {
          const error = new RenderEditorError('PRESENTATION_REFUSED', result.error.message);
          if (!result.recovered) presentedDocument = null;
          emit({...snapshot, presentedRevision: result.recovered ? snapshot.presentedRevision : null, presentationError: error});
          throw error;
        }
      }); } finally { transactionActive = false; }
      presentedDocument = candidate.document;
      emit({...snapshot, presentedRevision: candidate.document.revision, presentationError: null});
      return {ok: true};
    } catch (error) { return failure(error); }
  };
  const controller: RenderEditorController = {
    session,
    getSnapshot: () => snapshot,
    subscribe(listener) { check(); listeners.add(listener); return () => { listeners.delete(listener); }; },
    attachPresenter(next) {
      try { check(); if (presenter && presenter !== next) throw new RenderEditorError('PRESENTATION_REFUSED', 'A viewport is already attached.'); presenter = next; return controller.recover(); }
      catch (error) { return failure(error); }
    },
    detachPresenter(previous) {
      if (presenter !== previous) return;
      check();
      presenter = null; presentedDocument = null; previous.dispose();
      emit({...snapshot, presentedRevision: null});
    },
    apply: (mode = 'both') => run(() => session.prepareDraft(mode)),
    open: (text) => run(() => session.prepareOpen(text)),
    undo: () => run(() => session.prepareUndo()),
    redo: () => run(() => session.prepareRedo()),
    recover() {
      try {
        check(); if (!presenter) throw new RenderEditorError('PRESENTATION_REFUSED', 'No viewport is attached.');
        const document = session.getSnapshot().accepted;
        const result = presenter.recover(document);
        if (!result.ok) { presentedDocument = null; const error = new RenderEditorError('PRESENTATION_REFUSED', result.error.message); emit({...snapshot, presentedRevision: null, presentationError: error}); return {ok: false, error}; }
        presentedDocument = document;
        emit({...snapshot, presentedRevision: document.revision, presentationError: null});
        return {ok: true};
      } catch (cause) { presentedDocument = null; const result = failure(cause); if (!result.ok) emit({...snapshot, presentedRevision: null, presentationError: result.error}); return result; }
    },
    presentationUnavailable(error) { if (!snapshot.disposed) { presentedDocument = null; emit({...snapshot, presentedRevision: null, presentationError: new RenderEditorError('PRESENTATION_REFUSED', error.message)}); } },
    dispose() { if (snapshot.disposed) return; check(); const previous = presenter; presenter = null; presentedDocument = null; previous?.dispose(); emit({presentedRevision: null, presentationError: null, disposed: true}); listeners.clear(); }
  };
  if (initialPresenter) controller.attachPresenter(initialPresenter);
  return controller;
}
