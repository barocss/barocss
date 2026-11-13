import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';

interface DeleteDependentsDialogProps {
  request: { label: string; deps: string[]; opener: HTMLElement | null } | null;
  onCancel(): void;
  onDelete(): void;
}

export function DeleteDependentsDialog({ request, onCancel, onDelete }: DeleteDependentsDialogProps) {
  const cancel = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  return <Dialog open={!!request} onOpenChange={open => { if (!open) onCancel(); }}>
    <DialogContent className="w-[440px] max-w-[90vw] p-4" aria-label="Delete with dependents" aria-labelledby={undefined}
      onOpenAutoFocus={event => {
        event.preventDefault();
        opener.current = request?.opener ?? null;
        cancel.current?.focus();
      }}
      onEscapeKeyDown={event => event.stopPropagation()}
      onCloseAutoFocus={event => {
        event.preventDefault();
        if (opener.current?.isConnected) opener.current.focus({ preventScroll: true });
        opener.current = null;
      }}>
      {request && <>
        <DialogTitle className="m-0 text-sm font-semibold">Delete {request.label} and what is built on it?</DialogTitle>
        <DialogDescription className="mt-2 text-sm text-muted-foreground">
          {request.deps.length === 1 ? 'This feature uses it and goes too' : `These ${request.deps.length} features use it and go too`}: {request.deps.join(', ')}. Undo restores them.
        </DialogDescription>
        <div className="mt-4 flex justify-end gap-2">
          <Button ref={cancel} variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
          <Button variant="destructive" size="sm" onClick={onDelete}>Delete {request.deps.length + 1}</Button>
        </div>
      </>}
    </DialogContent>
  </Dialog>;
}
