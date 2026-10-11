import { useEffect, useId, useRef, useState } from 'react';
import { PencilLine } from 'lucide-react';
import { CadEditorError } from '../types.js';
import type { CadEditorSession } from '../types.js';
import { Button } from './ui/button.js';
import { Input } from './ui/input.js';
import { Label } from './ui/label.js';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog.js';
import { useCadEditorSnapshot } from './use-session.js';

export interface CadEditorBodyRenameProps {
  session: CadEditorSession;
  onError?: (error: CadEditorError) => void;
}
interface NameDraft { session: CadEditorSession; generation: number; bodyId: string; currentName: string; raw: string }
interface RenameAttempt { token: string; generation: number; bodyId: string; name: string }
function details(error: CadEditorError): string {
  const messages = [error.message]; let cause: unknown = error.cause;
  for (let i = 0; i < 6 && cause instanceof Error; i++) { messages.push(cause.message); cause = cause.cause; }
  return messages.join('\n');
}
function guidance(error: CadEditorError, raw: string): string {
  if (error.code === 'DISPLAY') return 'Cannot display this name change. Your entered name is retained. Retry or cancel.';
  if (error.code === 'REVISION') return 'This document reached its edit limit. Open a new document.';
  if (error.code === 'STALE') return 'The object changed. Cancel and open Rename again.';
  if (error.code === 'LIFECYCLE') return 'Reopen the viewport before renaming this object.';
  if (/surrogate/i.test(details(error))) return 'Enter a name with valid text characters.';
  if (raw.length === 0) return 'Enter a name for this object.';
  return 'This name cannot be used. Enter a shorter name with valid text characters.';
}

export function CadEditorBodyRename({ session, onError }: CadEditorBodyRenameProps) {
  const snapshot = useCadEditorSnapshot(session), id = useId();
  const body = snapshot.accepted.document.bodies.find(item => item.id === snapshot.selectedBodyId);
  const [draft, setDraft] = useState<NameDraft | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<CadEditorError | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null), inputRef = useRef<HTMLInputElement | null>(null);
  const attemptRef = useRef<RenameAttempt | null>(null), composingRef = useRef(false);
  const busy = snapshot.candidate !== null || snapshot.selectionTransition !== null || snapshot.disposed || Object.keys(snapshot.pending).length > 0;
  const currentDraft = draft?.session === session && draft.generation === snapshot.generation
    && draft.bodyId === snapshot.selectedBodyId && !snapshot.disposed ? draft : null;
  function close() { attemptRef.current = null; composingRef.current = false; setDraft(null); setMessage(null); setError(null); }
  useEffect(() => {
    if (!draft) return;
    const attempt = attemptRef.current;
    if (attempt && draft.session === session && snapshot.generation === attempt.generation + 1
      && snapshot.accepted.document.bodies.find(item => item.id === attempt.bodyId)?.name === attempt.name) {
      close(); return;
    }
    if (draft.session !== session || snapshot.generation !== draft.generation || snapshot.selectedBodyId !== draft.bodyId || snapshot.disposed) {
      close(); return;
    }
    if (attempt && snapshot.candidate === null) {
      attemptRef.current = null;
      setMessage('The name change was not accepted. Your entered name is retained. Retry or cancel.');
    }
  }, [session, snapshot.generation, snapshot.selectedBodyId, snapshot.disposed, snapshot.candidate?.token, draft]);
  function open() {
    const current = session.getSnapshot(), selected = current.accepted.document.bodies.find(item => item.id === current.selectedBodyId);
    if (!selected || current.candidate || current.selectionTransition || current.disposed || Object.keys(current.pending).length > 0) return;
    attemptRef.current = null; composingRef.current = false; setMessage(null); setError(null);
    setDraft({ session, generation: current.generation, bodyId: selected.id, currentName: selected.name, raw: selected.name });
  }
  function rename() {
    if (!currentDraft || busy) return;
    try {
      const current = session.getSnapshot();
      if (current.generation !== currentDraft.generation || current.selectedBodyId !== currentDraft.bodyId) {
        throw new CadEditorError('STALE', 'The selected rename object changed.', { field: 'body-name' });
      }
      const candidate = session.prepareRenameBody(currentDraft.bodyId, currentDraft.raw);
      setError(null); setMessage(null);
      if (candidate === null) { close(); return; }
      attemptRef.current = { token: candidate.token, generation: candidate.baseGeneration, bodyId: currentDraft.bodyId, name: currentDraft.raw };
    } catch (cause) {
      const failure = cause instanceof CadEditorError ? cause : new CadEditorError('NATIVE', 'The object name change failed.', { field: 'body-name' }, cause);
      attemptRef.current = null; setError(failure); setMessage(guidance(failure, currentDraft.raw));
      try { onError?.(failure); } catch { /* Host diagnostics do not modify the accepted name. */ }
    }
  }
  return <Dialog open={currentDraft !== null} onOpenChange={next => { if (next) open(); else if (!busy) close(); }}>
    <DialogTrigger asChild><Button ref={triggerRef} type="button" variant="outline" size="sm" disabled={!body || busy}
      className="cad-editor-body-rename-trigger cad-editor-operation-icon" aria-label="Rename object" title="Rename object" data-testid="body-rename-open"><PencilLine size={16} aria-hidden="true" /></Button></DialogTrigger>
    <DialogContent className="cad-editor-help-dialog cad-editor-body-rename-dialog" data-testid="body-rename-dialog" showCloseButton={!busy}
      onOpenAutoFocus={event => { event.preventDefault(); inputRef.current?.focus({ preventScroll: true }); }}
      onCloseAutoFocus={event => { event.preventDefault(); if (triggerRef.current?.isConnected && !triggerRef.current.disabled) triggerRef.current.focus({ preventScroll: true }); }}
      onEscapeKeyDown={event => { if (busy) event.preventDefault(); }} onPointerDownOutside={event => { if (busy) event.preventDefault(); }}>
      <DialogHeader><DialogTitle>Rename object</DialogTitle><DialogDescription>Change the name shown in the object list.</DialogDescription></DialogHeader>
      {currentDraft && <div className="cad-editor-body-rename-body">
        <p>Current name: {currentDraft.currentName}</p>
        <Label htmlFor={id + '-name'}>New name</Label>
        <Input ref={inputRef} id={id + '-name'} data-testid="body-rename-name" type="text" value={currentDraft.raw} disabled={busy}
          onChange={event => setDraft({ ...currentDraft, raw: event.target.value })}
          onCompositionStart={() => { composingRef.current = true; }} onCompositionEnd={() => { composingRef.current = false; }}
          onKeyDown={event => {
            if (event.key !== 'Enter' || event.nativeEvent.isComposing || event.keyCode === 229 || composingRef.current || event.repeat
              || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
            event.preventDefault(); event.stopPropagation(); rename();
          }}/>
        {message && <p role="alert" className="cad-editor-error" data-testid="body-rename-error">{message}</p>}
      </div>}
      <DialogFooter>
        <Dialog><DialogTrigger asChild><Button type="button" variant="ghost" disabled={busy} data-testid="body-rename-help" className="cad-editor-body-rename-help">Help</Button></DialogTrigger>
          <DialogContent className="cad-editor-help-dialog" data-testid="body-rename-help-dialog">
            <DialogHeader><DialogTitle>Object names</DialogTitle><DialogDescription>Name changes and editing limits.</DialogDescription></DialogHeader>
            <div className="cad-editor-help-body">
              <p>Rename changes the human name in the native document. It does not rename body, asset or geometry IDs, change original coordinates, or replace authored Source0 text, comments or sibling objects. Hidden and read-only geometry can have its object name changed.</p>
              <p>The native name must be nonempty, contain valid Unicode text and use at most 128 UTF-8 bytes. A character can use several bytes. Names may repeat. The editor does not trim, normalize, truncate or repair your input.</p>
              <p>Apply or discard pending control-point edits before opening Rename. Resolve any selection decision or display candidate first. Rename does not apply or discard those edits for you.</p>
              <p>Select Rename, or press Enter in the name field outside text composition. Typing, Tab and composing Enter do not commit. Cancel or Escape returns focus to Rename object.</p>
              <p>The changed name is accepted after full native validation, viewport admission and a fresh pixel read. Your camera and selected object remain. A refused name or display keeps the current native name and your entered text so you can repair it.</p>
              <p>An accepted name change adds one history entry and requires a new native Download. Undo/Redo restores names with the existing source-edit history. Native Download and Open carry the name with the complete original document. An exact same-name Rename is a no-op.</p>
              <p>Changing selection or accepted native content outside this dialog invalidates it. Close Help or press Escape to return to Help without changing the input.</p>
              {error && <details><summary>Technical error details</summary><pre>{details(error)}</pre></details>}
            </div>
            <DialogClose asChild><Button type="button" variant="outline" className="cad-editor-export-close" data-testid="body-rename-help-close">Close help</Button></DialogClose>
          </DialogContent>
        </Dialog>
        <Button type="button" variant="outline" disabled={busy} data-testid="body-rename-cancel" onClick={close}>Cancel</Button>
        <Button type="button" disabled={busy} data-testid="body-rename-confirm" onClick={rename}>{attemptRef.current !== null && snapshot.candidate?.token === attemptRef.current.token ? 'Renaming…' : 'Rename'}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
