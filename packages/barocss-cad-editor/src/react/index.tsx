import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { CadEditorError } from '../types.js';
import { cn } from '../lib/utils.js';
import { CadEditorViewport } from './viewport.js';
import { CadEditorInspector } from './inspector.js';
import type { CadEditorProps } from './types.js';
import { useCadEditorSnapshot } from './use-session.js';

export function CadEditor({ className, ...props }: CadEditorProps) {
  const [displayReadRequest, setDisplayReadRequest] = useState(0);
  const [keyboardError, setKeyboardError] = useState<string | null>(null);
  const composingRef = useRef(false);
  const snapshot = useCadEditorSnapshot(props.session);
  useEffect(() => {
    if (Object.keys(snapshot.pending).length === 0 && !snapshot.selectionTransition && !snapshot.candidate) {
      setKeyboardError(null);
    }
  }, [snapshot.generation, Object.keys(snapshot.pending).length, snapshot.selectionTransition?.token, snapshot.candidate?.token]);
  const onError = useCallback((error: CadEditorError) => {
    // A failed diagnostic read must not cause an endless read/error cycle.
    if (error.context.field !== 'pixel-read' && error.context.field !== 'display-callback') {
      setDisplayReadRequest(value => value + 1);
    }
    props.onError?.(error);
  }, [props.onError]);
  function historyKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.repeat || event.altKey || event.nativeEvent.isComposing || event.keyCode === 229 || composingRef.current) return;
    const target = event.target;
    if (target instanceof HTMLElement && (target.isContentEditable
      || target.closest('input, textarea, select, [role="textbox"]'))) return;
    const key = event.key.toLowerCase();
    const undo = key === 'z' && (event.metaKey || event.ctrlKey) && !event.shiftKey;
    const redo = (key === 'z' && (event.metaKey || event.ctrlKey) && event.shiftKey)
      || (key === 'y' && event.ctrlKey && !event.metaKey);
    if (!undo && !redo) return;
    event.preventDefault();
    event.stopPropagation();
    const current = props.session.getSnapshot();
    if (Object.keys(current.pending).length > 0 || current.selectionTransition || current.candidate) {
      setKeyboardError('Apply or discard your draft before using history.');
      onError(new CadEditorError('INPUT', 'History shortcuts require no pending draft, selection decision or candidate.', { field: 'history' }));
      return;
    }
    if (undo ? !current.history.canUndo : !current.history.canRedo) {
      setKeyboardError(undo ? 'There is no earlier change to undo.' : 'There is no later change to redo.');
      onError(new CadEditorError('INPUT', undo ? 'Undo history is unavailable.' : 'Redo history is unavailable.', { field: 'history' }));
      return;
    }
    try {
      if (undo) props.session.prepareUndo();
      else props.session.prepareRedo();
      setKeyboardError(null);
    } catch (cause) {
      setKeyboardError('This history change cannot be applied. The current document is retained.');
      onError(cause instanceof CadEditorError ? cause
        : new CadEditorError('NATIVE', 'Native history preparation failed.', { field: 'history' }, cause));
    }
  }
  return <div className={cn('cad-editor', className)} onKeyDown={historyKey}
    onCompositionStartCapture={() => { composingRef.current = true; }}
    onCompositionEndCapture={() => { composingRef.current = false; }}>
    <CadEditorViewport {...props} onError={onError} readRequest={displayReadRequest + (props.readRequest ?? 0)} />
    <CadEditorInspector session={props.session} onError={onError} />
    {keyboardError && <p className="cad-editor-history-error" role="alert">{keyboardError}</p>}
  </div>;
}

export { CadEditorViewport } from './viewport.js';
export { CadEditorInspector } from './inspector.js';
export { useCadEditorSnapshot } from './use-session.js';
export type { CadEditorDisplayOptions, CadEditorDisplayReceipt, CadEditorViewportProps,
  CadEditorInspectorProps, CadEditorProps } from './types.js';
export { CadEditorFeature } from './feature-editor.js';
export type { CadEditorFeatureProps, CadEditorFeatureDisplayReceipt } from './feature-editor.js';
export { useCadEditorFeatureSnapshot } from './use-feature-session.js';
