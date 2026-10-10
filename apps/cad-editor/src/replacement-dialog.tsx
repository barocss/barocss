import { useRef } from 'react';
import { Button } from './components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from './components/ui/dialog';

export interface ReplacementDialogProps {
  open: boolean;
  currentName: string;
  action: 'open' | 'sample';
  targetName: string;
  downloadStarted: boolean;
  onDownload: () => void;
  onContinue: () => void;
  onCancel: () => void;
  returnFocus: HTMLElement | null;
}

/** Task labels only. The host owns the frozen target, native checks and file actions. */
export function ReplacementDialog(props: ReplacementDialogProps) {
  const focusRef = useRef<HTMLElement | null>(props.returnFocus);
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  // Retain the trigger through the host clearing its target during dialog dismissal.
  if (props.open) focusRef.current = props.returnFocus;
  return <Dialog open={props.open} onOpenChange={open => { if (!open) props.onCancel(); }}>
    <DialogContent className="cad-editor-help-dialog document-replacement-dialog" data-testid="replacement-dialog"
      onOpenAutoFocus={event => { event.preventDefault(); cancelRef.current?.focus({ preventScroll: true }); }}
      onCloseAutoFocus={event => {
        event.preventDefault();
        const target = focusRef.current;
        if (target?.isConnected && !target.matches(':disabled') && target.getAttribute('aria-disabled') !== 'true') {
          target.focus({ preventScroll: true });
        }
      }}>
      <DialogHeader><DialogTitle>Unsaved changes</DialogTitle>
        <DialogDescription>Choose what to do before {props.action === 'open' ? 'opening' : 'starting'} {props.targetName}.</DialogDescription></DialogHeader>
      <div className="document-replacement-body">
        <p>Current document: <strong>{props.currentName}</strong></p>
        <p>Download a copy to keep these changes, or continue without downloading.</p>
        {props.downloadStarted && <p role="status" data-testid="replacement-download-status" className="replacement-download-status">
          Download started. Choose Continue or Cancel to finish this decision.
        </p>}
      </div>
      <DialogFooter>
        <Dialog><DialogTrigger asChild><Button type="button" variant="ghost" className="replacement-help-trigger" data-testid="replacement-help">Help</Button></DialogTrigger>
          <DialogContent className="cad-editor-help-dialog" data-testid="replacement-help-dialog">
            <DialogHeader><DialogTitle>Keep your current changes</DialogTitle><DialogDescription>Download a copy before replacing a document.</DialogDescription></DialogHeader>
            <div className="cad-editor-help-body">
              <p>This decision concerns the current accepted native document. Pending coordinate or weight edits must be applied or discarded before Open or New sample. This dialog does not apply or discard a draft.</p>
              <p>Download copy starts a browser download of the current accepted document. It does not verify a file was saved to disk and does not open the replacement. After Download started, choose Continue without downloading or Cancel separately.</p>
              <p>Continue without downloading replaces the current document with the prepared file or sample. Cancel, Escape or dismissing this dialog keeps the current document and clears that replacement request.</p>
              <p>A newer Open or New request, native edits, selection, display changes or another download can invalidate the prepared replacement. Camera movement alone does not change the document. The host rechecks the current state before every decision.</p>
              <p>Failed file read, download or display does not authorize a later replacement. Retry Open or New sample after resolving the error. A replacement filename becomes current only after the accepted document passes native and viewport validation.</p>
              <p>Typing, Tab and Help do not replace the document. Close Help or press Escape to return focus to Help. Cancel or Escape in the main dialog returns to the Open or File control that started the request.</p>
            </div>
            <DialogClose asChild><Button type="button" variant="outline" className="cad-editor-export-close" data-testid="replacement-help-close">Close help</Button></DialogClose>
          </DialogContent>
        </Dialog>
        <Button type="button" variant="outline" data-testid="replacement-download" onClick={props.onDownload}>Download copy</Button>
        <Button type="button" variant="outline" data-testid="replacement-continue" onClick={props.onContinue}>Continue without downloading</Button>
        <Button ref={cancelRef} type="button" data-testid="replacement-cancel" onClick={props.onCancel}>Cancel</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
