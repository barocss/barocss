import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CadEditorError } from '../types.js';
import type { CadEditorSession, CadEditorSnapshot } from '../types.js';
import type { CadEditorDisplayReceipt } from './types.js';
import { useCadEditorSnapshot } from './use-session.js';

interface Bookmark {
  session: CadEditorSession;
  generation: number;
  displayGeneration: number;
  isolated: string[];
  previous: string[];
}
interface Operation {
  session: CadEditorSession;
  kind: 'isolate' | 'restore';
  generation: number;
  displayGeneration: number;
  target: string[];
  previous: string[];
  token: string | null;
}
interface Props {
  session: CadEditorSession;
  canvas: HTMLCanvasElement | null;
  toolbarContainer?: HTMLElement | null;
  receipt: CadEditorDisplayReceipt | null;
  isCurrentDocument: () => boolean;
  busy: boolean;
  onError: (error: CadEditorError) => void;
}

const sameIds = (a: string[], b: string[]) => a.length === b.length && a.every((id, index) => id === b[index]);
function currentBookmark(bookmark: Bookmark | null, session: CadEditorSession, state: CadEditorSnapshot): bookmark is Bookmark {
  return bookmark !== null && bookmark.session === session && !state.disposed && state.view.kind === 'document'
    && bookmark.generation === state.generation && bookmark.displayGeneration === state.displayGeneration
    && sameIds(bookmark.isolated, state.displayBodyIds);
}

/** A private display bookmark. Native data and history stay in the existing session. */
export function SelectionIsolation(props: Props) {
  const { session } = props;
  const snapshot = useCadEditorSnapshot(session);
  const current = useRef(props); current.current = props;
  const operation = useRef<Operation | null>(null);
  const [bookmark, setBookmark] = useState<Bookmark | null>(null);
  const bookmarkRef = useRef(bookmark); bookmarkRef.current = bookmark;
  const pointers = useRef(new Set<number>());
  const composing = useRef(false);
  const [, refresh] = useState(0);

  function captured(id: number) {
    return [document.documentElement, ...document.querySelectorAll('*')].some(element => element.hasPointerCapture(id));
  }
  function safePresentation() {
    const live = current.current, canvas = live.canvas;
    return live.session === session && !live.busy && !composing.current && live.isCurrentDocument()
      && canvas?.isConnected === true && canvas.getClientRects().length > 0
      && !['hidden', 'collapse'].includes(getComputedStyle(canvas).visibility)
      && !canvas.closest('[data-direct-host-busy="true"],[data-panel-resizing="true"]')
      && ![...pointers.current].some(captured)
      && document.querySelector('[role="dialog"][data-state="open"],[role="menu"]') === null;
  }
  function available() {
    const state = session.getSnapshot();
    return safePresentation() && !state.disposed && state.view.kind === 'document'
      && !state.candidate && !state.selectionTransition && Object.keys(state.pending).length === 0;
  }

  useEffect(() => {
    let live = true;
    const down = (event: PointerEvent) => {
      pointers.current.add(event.pointerId);
      setTimeout(() => { if (live) refresh(value => value + 1); }, 0);
    };
    const release = (event: PointerEvent) => {
      if (!captured(event.pointerId)) pointers.current.delete(event.pointerId);
      setTimeout(() => {
        if (!live) return;
        if (!captured(event.pointerId)) pointers.current.delete(event.pointerId);
        refresh(value => value + 1);
      }, 0);
    };
    const startComposition = () => { composing.current = true; };
    const endComposition = () => { composing.current = false; };
    window.addEventListener('pointerdown', down, true);
    window.addEventListener('pointerup', release, true);
    window.addEventListener('pointercancel', release, true);
    window.addEventListener('lostpointercapture', release, true);
    window.addEventListener('compositionstart', startComposition, true);
    window.addEventListener('compositionend', endComposition, true);
    return () => {
      live = false; pointers.current.clear(); composing.current = false;
      window.removeEventListener('pointerdown', down, true);
      window.removeEventListener('pointerup', release, true);
      window.removeEventListener('pointercancel', release, true);
      window.removeEventListener('lostpointercapture', release, true);
      window.removeEventListener('compositionstart', startComposition, true);
      window.removeEventListener('compositionend', endComposition, true);
      const owned = operation.current;
      if (owned?.session === session) {
        operation.current = null;
        try { if (owned.token && session.getSnapshot().candidate?.token === owned.token) session.cancelCandidate(owned.token); } catch {}
      }
    };
  }, [session]);

  useEffect(() => {
    const state = session.getSnapshot(), owned = operation.current;
    if (owned?.session === session) {
      const sameNative = !state.disposed && state.generation === owned.generation && state.view.kind === 'document';
      const preparing = sameNative && state.displayGeneration === owned.displayGeneration
        && state.candidate?.token === owned.token && state.candidate.kind === 'display'
        && state.candidate.view.kind === 'document' && sameIds(state.candidate.displayBodyIds, owned.target);
      if (preparing) return;
      const admitted = sameNative && state.displayGeneration === owned.displayGeneration + 1
        && !state.candidate && sameIds(state.displayBodyIds, owned.target);
      if (admitted && props.receipt !== null && !props.isCurrentDocument()) return; // Wait for the actual presentation, not just the Root notification.
      operation.current = null;
      if (admitted && props.receipt !== null) {
        setBookmark(owned.kind === 'isolate' ? { session, generation: state.generation,
          displayGeneration: state.displayGeneration, isolated: [...owned.target], previous: [...owned.previous] } : null);
        return;
      }
      refresh(value => value + 1);
    }
    if (bookmark && (!currentBookmark(bookmark, session, state) || props.receipt === null
      || state.candidate?.kind === 'display')) setBookmark(null);
  }, [session, snapshot, props.receipt]);

  function submit(kind: Operation['kind']) {
    const state = session.getSnapshot(), previous = bookmarkRef.current;
    if (!available() || operation.current) return;
    if (kind === 'restore' ? !currentBookmark(previous, session, state)
      : !state.selectedBodyId || !state.displayBodyIds.includes(state.selectedBodyId) || state.displayBodyIds.length < 2) return;
    const target = kind === 'restore' ? [...previous!.previous] : [state.selectedBodyId!];
    const owned: Operation = { session, kind, generation: state.generation, displayGeneration: state.displayGeneration,
      target, previous: [...state.displayBodyIds], token: null };
    operation.current = owned;
    try {
      const candidate = session.prepareDisplayBodies(target);
      owned.token = candidate.token;
      const latest = session.getSnapshot();
      if (latest.candidate?.token !== owned.token || latest.generation !== owned.generation
        || latest.displayGeneration !== owned.displayGeneration || latest.candidate.kind !== 'display'
        || latest.candidate.view.kind !== 'document' || !sameIds(latest.candidate.displayBodyIds, target)
        || Object.keys(latest.pending).length !== 0 || latest.selectionTransition !== null
        || latest.selectedBodyId !== state.selectedBodyId || latest.editTarget !== state.editTarget
        || latest.selection?.uIndex !== state.selection?.uIndex || latest.selection?.vIndex !== state.selection?.vIndex
        || latest.curveSelection?.index !== state.curveSelection?.index || !safePresentation()) {
        operation.current = null;
        if (latest.candidate?.token === owned.token) session.cancelCandidate(owned.token);
        const retained = session.getSnapshot();
        setBookmark(kind === 'restore' && currentBookmark(previous, session, retained)
          && retained.candidate?.kind !== 'display' ? previous : null);
        refresh(value => value + 1);
        return; // A synchronous subscriber owns the current state; do not cancel its candidate.
      }
    } catch (cause) {
      operation.current = null;
      const error = cause instanceof CadEditorError ? cause
        : new CadEditorError('DISPLAY', 'The visibility change was refused.', { field: 'display-body-set' }, cause);
      current.current.onError(error);
    }
    refresh(value => value + 1);
  }

  const blocked = !available() || operation.current !== null;
  const canIsolate = snapshot.selectedBodyId !== null && snapshot.displayBodyIds.includes(snapshot.selectedBodyId)
    && snapshot.displayBodyIds.length > 1;
  const toolbar = <div className="cad-editor-visibility-tools" role="group" aria-label="Document visibility" data-testid="document-visibility-tools">
    {(['isolate', 'restore'] as const).map(kind => <button key={kind} type="button" className="cad-editor-visibility-button"
      data-testid={kind === 'isolate' ? 'document-isolate-selected' : 'document-restore-visibility'}
      aria-label={kind === 'isolate' ? 'Isolate selected body' : 'Restore previous visibility'}
      title={kind === 'isolate' ? 'Show only the selected body' : 'Restore the previous displayed bodies'}
      disabled={blocked || (kind === 'isolate' ? !canIsolate : !currentBookmark(bookmark, session, snapshot))}
      onKeyDown={event => {
        if ((event.key === 'Enter' || event.key === ' ') && (event.repeat || event.nativeEvent.isComposing
          || event.keyCode === 229 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)) {
          event.preventDefault(); event.stopPropagation();
        }
      }}
      onClick={event => { if (!event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) submit(kind); }}>
      {kind === 'isolate' ? 'Isolate' : 'Restore'}
    </button>)}
  </div>;
  return props.toolbarContainer === undefined ? toolbar : props.toolbarContainer === null ? null : createPortal(toolbar, props.toolbarContainer);
}
