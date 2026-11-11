import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from 'react';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import type { SketchState } from '@barocss/cad-model/sketch/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

type Request = {
  owner: StudioDoc;
  sketch: SketchState;
  switchMode(): void;
  keepFocus: HTMLElement | null;
  trigger: HTMLElement | null;
};

const activeElement = () => document.activeElement instanceof HTMLElement ? document.activeElement : null;

export function useSketchModeExit(sketch: SketchState | null, owner: StudioDoc) {
  const [request, setRequest] = useState<Request | null>(null);
  const pointer = useRef<{ trigger: HTMLButtonElement; focus: HTMLElement | null } | null>(null);
  const focusAfterClose = useRef<HTMLElement | null>(null);
  const keepButton = useRef<HTMLButtonElement>(null);
  const current = request?.owner === owner && request.sketch === sketch ? request : null;
  useEffect(() => {
    if (request && !current) setRequest(null);
  }, [request, current]);

  const rememberFocus = (event: PointerEvent<HTMLButtonElement>) => {
    pointer.current = { trigger: event.currentTarget, focus: activeElement() };
  };
  const switchWhenReady = (switchMode: () => void, event?: MouseEvent<HTMLButtonElement>) => {
    const previous = pointer.current;
    pointer.current = null;
    if (!sketch || (!sketch.shape && !sketch.done?.length)) {
      switchMode();
      return;
    }
    const trigger = event?.currentTarget ?? activeElement();
    const focus = event?.detail && previous?.trigger === trigger ? previous.focus : trigger;
    setRequest({ owner, sketch, switchMode, trigger, keepFocus: focus?.isConnected && focus !== document.body ? focus : trigger });
  };
  const settle = (discard: boolean) => {
    if (!current) return;
    focusAfterClose.current = discard ? current.trigger : current.keepFocus;
    setRequest(null);
    if (discard) current.switchMode();
  };

  const dialog = <Dialog open={!!current} onOpenChange={open => { if (!open) settle(false); }}>
    <DialogContent className="w-[360px] max-w-[90vw] p-4" aria-describedby={undefined}
      onOpenAutoFocus={event => { event.preventDefault(); keepButton.current?.focus(); }}
      onEscapeKeyDown={event => event.stopPropagation()}
      onCloseAutoFocus={event => {
        event.preventDefault();
        if (focusAfterClose.current?.isConnected) focusAfterClose.current.focus({ preventScroll: true });
        focusAfterClose.current = null;
      }}>
      <DialogTitle className="m-0 text-sm font-semibold">Discard sketch changes?</DialogTitle>
      <div className="mt-4 flex justify-end gap-2">
        <Button ref={keepButton} variant="outline" size="sm" onClick={() => settle(false)}>Keep editing</Button>
        <Button variant="destructive" size="sm" onClick={() => settle(true)}>Discard changes</Button>
      </div>
    </DialogContent>
  </Dialog>;

  return { pending: !!current, rememberFocus, switchWhenReady, dialog };
}
