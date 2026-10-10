import { useEffect, useRef, useState } from 'react';
import { Button } from './components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from './components/ui/dialog';

export interface RecoveryDialogProps {
  open: boolean;
  currentName: string;
  copy: { name: string; savedAtText: string; savedWithPending: boolean } | null;
  status: 'loading' | 'ready' | 'empty' | 'failed';
  /** Non-dismissible storage mutation; cancellable Open verification uses action permissions instead. */
  busy: boolean;
  canSave: boolean;
  canOpen: boolean;
  canDelete: boolean;
  confirmation: 'replace' | 'delete' | null;
  message: string | null;
  onSave: () => void;
  onOpen: () => void;
  onDelete: () => void;
  onConfirm: () => void;
  onCancelConfirmation: () => void;
  onCancel: () => void;
  returnFocus: HTMLElement | null;
  suppressReturnFocus: boolean;
}

/** The host owns storage, validation and replacement policy. This dialog receives task summaries only. */
export function RecoveryDialog(props: RecoveryDialogProps) {
  const [helpOpen,setHelpOpen]=useState(false);
  const returnRef = useRef(props.returnFocus), suppressRef = useRef(props.suppressReturnFocus);
  const saveRef = useRef<HTMLButtonElement | null>(null), deleteRef = useRef<HTMLButtonElement | null>(null);
  const cancelRef = useRef<HTMLButtonElement | null>(null), confirmationCancelRef = useRef<HTMLButtonElement | null>(null);
  const actionRef = useRef<'save' | 'delete' | null>(null);
  const pendingFocusRef = useRef<'cancel' | 'confirmation' | 'action' | null>(null);
  const previousRef = useRef<{ open: boolean; confirmation: RecoveryDialogProps['confirmation'] }>({ open: false, confirmation: null });
  if (props.open) { returnRef.current = props.returnFocus; suppressRef.current = props.suppressReturnFocus; }
  else if (props.suppressReturnFocus) suppressRef.current = true;
  function focus(element: HTMLButtonElement | null): boolean {
    if (!element?.isConnected || element.disabled) return false;
    element.focus({ preventScroll: true }); return true;
  }
  useEffect(() => {
    const previous = previousRef.current;
    if (props.open) {
      if (!previous.open) pendingFocusRef.current = props.confirmation === null ? 'cancel' : 'confirmation';
      else if (previous.confirmation !== props.confirmation) {
        if (props.confirmation !== null) pendingFocusRef.current = 'confirmation';
        else if (previous.confirmation !== null) {
          actionRef.current ??= previous.confirmation === 'delete' ? 'delete' : 'save';
          pendingFocusRef.current = 'action';
        }
      }
      if (!props.busy && !helpOpen && pendingFocusRef.current !== null) {
        if (pendingFocusRef.current === 'confirmation') focus(confirmationCancelRef.current);
        else if (pendingFocusRef.current === 'cancel') focus(cancelRef.current);
        else {
          const action = actionRef.current;
          if (!focus(action === 'delete' ? deleteRef.current : saveRef.current) && !focus(saveRef.current)) focus(cancelRef.current);
          actionRef.current = null;
        }
        pendingFocusRef.current = null;
      }
    }
    if (!props.open) { actionRef.current = null; pendingFocusRef.current = null; }
    previousRef.current = { open: props.open, confirmation: props.confirmation };
  }, [props.open, props.confirmation, props.busy,helpOpen]);
  function dismiss() {
    if (props.busy) return;
    if (props.confirmation !== null) props.onCancelConfirmation();
    else props.onCancel();
  }
  const title = props.confirmation === 'replace' ? 'Replace recovery copy?' : props.confirmation === 'delete' ? 'Delete recovery copy?' : 'Recovery copies';
  const statusText = props.busy ? 'Updating recovery copy…' : props.status === 'loading' ? 'Reading recovery copy…'
    : props.status === 'empty' ? 'No recovery copy' : props.status === 'failed' ? 'Recovery unavailable' : 'Recovery copy ready';
  return <Dialog open={props.open} onOpenChange={open => { if (!open) dismiss(); }}>
    <DialogContent className="cad-editor-help-dialog recovery-dialog" data-testid="recovery-dialog" showCloseButton={!props.busy}
      onOpenAutoFocus={event => { event.preventDefault(); focus(props.confirmation === null ? cancelRef.current : confirmationCancelRef.current); }}
      onCloseAutoFocus={event => {
        event.preventDefault(); if (suppressRef.current) return;
        const target = returnRef.current;
        if (target?.isConnected && !target.matches(':disabled') && target.getAttribute('aria-disabled') !== 'true') target.focus({ preventScroll: true });
      }}
      onEscapeKeyDown={event => { event.preventDefault(); dismiss(); }}
      onPointerDownOutside={event => { if (props.busy) event.preventDefault(); }}>
      <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>
        {props.confirmation === 'replace' ? 'Store the current document in place of the existing copy.'
          : props.confirmation === 'delete' ? 'Remove the stored copy from this browser.' : 'Keep one applied document copy in this browser.'}
      </DialogDescription></DialogHeader>
      <div className="recovery-dialog-body">
        <p role="status" data-testid="recovery-status" className="recovery-status">{statusText}</p>
        {props.copy && <section className="recovery-copy-summary" aria-label="Stored recovery copy">
          <h3>{props.copy.name}</h3><p>{props.copy.savedAtText}</p>
          {props.copy.savedWithPending && <p className="recovery-copy-warning">Pending edits were not included in this copy.</p>}
        </section>}
        {props.confirmation === 'replace' ? <p>Replace the stored copy with <strong>{props.currentName}</strong>? The previous copy will be removed.</p>
          : props.confirmation === 'delete' ? <p>Delete the stored recovery copy? Your current document will remain open.</p>
          : <><p>Current document: <strong>{props.currentName}</strong></p><p>Only applied changes are stored. Pending edits are not included.</p></>}
        {props.status === 'failed' && !props.copy && <p>{props.canSave || props.canDelete
          ? 'The stored copy cannot be read. You can explicitly replace or delete it.'
          : 'Recovery storage cannot be used for these actions. The current document is retained.'}</p>}
        {props.message && <p className="recovery-message" data-testid="recovery-message" role="status">{props.message}</p>}
      </div>
      <DialogFooter>
        <Dialog open={helpOpen} onOpenChange={open=>{setHelpOpen(open);if(!open)pendingFocusRef.current=null;}}><DialogTrigger asChild><Button type="button" variant="ghost" disabled={props.busy} className="recovery-help-trigger" data-testid="recovery-help">Help</Button></DialogTrigger>
          <DialogContent className="cad-editor-help-dialog recovery-help-dialog" data-testid="recovery-help-dialog">
            <DialogHeader><DialogTitle>Manual recovery copies</DialogTitle><DialogDescription>What is stored in this browser.</DialogDescription></DialogHeader>
            <div className="cad-editor-help-body">
              <p>Save current copy stores one accepted native document at the time you choose Save. It is manual, not autosave. Later edits are newer than that copy. Pending coordinate or weight edits are excluded and are not applied, discarded or restored.</p>
              <p>Replacing or deleting an existing copy requires a separate confirmation. These actions do not change the current native document, its history, unsaved state or download status. A storage error keeps the current document. It does not authorize a blind overwrite or silently delete or restore a copy. Another tab can still change the stored record.</p>
              <p>Open copy first checks the stored record and current document. Resolve drafts and selection decisions before opening. Unsaved current changes use the existing Download copy, Continue without downloading or Cancel decision. Download copy does not automatically open the recovery copy.</p>
              <p>The copy keeps complete original native source, object names, IDs, units and displayed body subset. Camera, selection, history, pending drafts, analyses and derived meshes are excluded. A copy made with unsaved accepted changes remains unsaved after reopening until a native Download or another ordinary Open.</p>
              <p>Storage uses one validated versioned IndexedDB slot in this browser and origin. Native document text is limited to 2 MiB in UTF-8 bytes and code units; the JSON recovery envelope is limited to 16 MiB because escaping can expand it. Unsupported or invalid records are retained without silent repair or migration. Unsupported non-string slot values cannot be replaced or deleted by this version.</p>
              <p>Another tab can replace or delete the copy. Notifications are hints; the host rereads storage and checks the expected record before actions. A stale confirmation is cancelled. Storage and viewport acceptance are not one atomic lock across tabs.</p>
              <p>Busy storage changes must settle before this dialog can close. Open verification can be cancelled; late results do not authorize a replacement. Cancel or Escape in a confirmation returns to its Save or Delete action. Close Help or press Escape to return to Help without clearing the decision.</p>
              <p>A successful browser transaction can keep a copy across a normal browser close and restart with the same profile and origin. Browser storage can still be cleared, blocked, unavailable or evicted. This is not a native file download, disk save, crash or power-loss guarantee, cloud backup or durable recovery certificate. Use native Download for a separate file copy.</p>
            </div>
            <DialogClose asChild><Button type="button" variant="outline" className="cad-editor-export-close" data-testid="recovery-help-close">Close help</Button></DialogClose>
          </DialogContent>
        </Dialog>
        {props.confirmation === null ? <>
          <Button ref={saveRef} type="button" variant="outline" disabled={props.busy || !props.canSave} data-testid="recovery-save"
            onClick={() => { actionRef.current = 'save'; props.onSave(); }}>Save current copy</Button>
          <Button type="button" variant="outline" disabled={props.busy || !props.canOpen} data-testid="recovery-open" onClick={props.onOpen}>Open copy</Button>
          <Button ref={deleteRef} type="button" variant="outline" disabled={props.busy || !props.canDelete} data-testid="recovery-delete"
            onClick={() => { actionRef.current = 'delete'; props.onDelete(); }}>Delete copy</Button>
          <Button ref={cancelRef} type="button" disabled={props.busy} data-testid="recovery-cancel" onClick={props.onCancel}>Cancel</Button>
        </> : <>
          <Button ref={confirmationCancelRef} type="button" variant="outline" disabled={props.busy} data-testid="recovery-confirmation-cancel" onClick={props.onCancelConfirmation}>Cancel</Button>
          <Button type="button" disabled={props.busy || (props.confirmation === 'replace' ? !props.canSave : !props.canDelete)}
            data-testid="recovery-confirm" onClick={props.onConfirm}>{props.confirmation === 'replace' ? 'Replace copy' : 'Delete copy'}</Button>
        </>}
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
