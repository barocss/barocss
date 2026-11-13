import { useEffect, useRef, useState, type MouseEvent, type PointerEvent, type RefObject } from 'react';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import type { SketchState } from '@barocss/cad-model/sketch/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

type Request = {
  owner: StudioDoc;
  sketch: SketchState | null;
  sketchVersion: number;
  feature: object | null;
  featureDraft(): object | null;
  switchMode(): void;
  keepFocus: HTMLElement | null;
  discardFocus: HTMLElement | null;
  trigger: HTMLElement | null;
  title?: string;
};

const activeElement = () => document.activeElement instanceof HTMLElement ? document.activeElement : null;

export function useWorkspaceModeExit(sketch: SketchState | null, sketchGeneration: RefObject<number>,
  doc: RefObject<StudioDoc>, featureDraft: () => object | null) {
  const [request, setRequest] = useState<Request | null>(null);
  const pointer = useRef<{ trigger: HTMLButtonElement; focus: HTMLElement | null } | null>(null);
  const focusAfterClose = useRef<HTMLElement | null>(null);
  const keepButton = useRef<HTMLButtonElement>(null);
  const sketchDraft = sketch && (sketch.shape || sketch.done?.length) ? sketch : null;
  const owns = (entry: Request) => entry.owner === doc.current && entry.sketch === sketchDraft
    && entry.sketchVersion === sketchGeneration.current
    && entry.feature === entry.featureDraft();
  const current = request && owns(request) ? request : null;
  useEffect(() => {
    if (request && !current) {
      focusAfterClose.current = request.trigger;
      setRequest(null);
    }
  }, [request, current]);

  const rememberFocus = (event: PointerEvent<HTMLButtonElement>) => {
    pointer.current = { trigger: event.currentTarget, focus: activeElement() };
  };
  const takeFocus = (event: MouseEvent<HTMLButtonElement>) => {
    const previous = pointer.current;
    pointer.current = null;
    return event.detail && previous?.trigger === event.currentTarget ? previous.focus : activeElement();
  };
  const switchWhenReady = (switchMode: () => void, { event, readFeature = featureDraft, destinationFocus, originFocus, title }: {
    event?: MouseEvent<HTMLButtonElement>; readFeature?: () => object | null; destinationFocus?: HTMLElement | null;
    originFocus?: HTMLElement | null; title?: string;
  } = {}) => {
    const previous = pointer.current;
    pointer.current = null;
    const feature = readFeature();
    if (!sketchDraft && !feature) {
      switchMode();
      destinationFocus?.focus({ preventScroll: true });
      return;
    }
    const trigger = event?.currentTarget ?? activeElement();
    const focus = originFocus ?? (event?.detail && previous?.trigger === trigger ? previous.focus : trigger);
    setRequest({ owner: doc.current, sketch: sketchDraft, sketchVersion: sketchGeneration.current, feature, featureDraft: readFeature, switchMode, trigger, title,
      discardFocus: destinationFocus ?? trigger,
      keepFocus: focus?.isConnected && focus !== document.body ? focus : trigger });
  };
  const settle = (discard: boolean) => {
    if (!current) return;
    const stillOwned = owns(current);
    focusAfterClose.current = stillOwned ? (discard ? current.discardFocus : current.keepFocus) : current.trigger;
    setRequest(null);
    if (discard && stillOwned) current.switchMode();
  };

  const title = current?.title ?? (current?.feature
    ? current.sketch ? 'Discard sketch and feature changes?' : 'Discard feature changes?'
    : 'Discard sketch changes?');
  const dialog = <Dialog open={!!current} onOpenChange={open => { if (!open) settle(false); }}>
    <DialogContent className="w-[360px] max-w-[90vw] p-4" aria-describedby={undefined}
      onOpenAutoFocus={event => { event.preventDefault(); keepButton.current?.focus(); }}
      onEscapeKeyDown={event => event.stopPropagation()}
      onCloseAutoFocus={event => {
        event.preventDefault();
        if (focusAfterClose.current?.isConnected) focusAfterClose.current.focus({ preventScroll: true });
        focusAfterClose.current = null;
      }}>
      <DialogTitle className="m-0 text-sm font-semibold">{title}</DialogTitle>
      <div className="mt-4 flex justify-end gap-2">
        <Button ref={keepButton} variant="outline" size="sm" onClick={() => settle(false)}>Keep editing</Button>
        <Button variant="destructive" size="sm" onClick={() => settle(true)}>Discard changes</Button>
      </div>
    </DialogContent>
  </Dialog>;

  return { pending: !!current, hasDraft: () => !!(sketchDraft || featureDraft()), rememberFocus, takeFocus, switchWhenReady, dialog };
}
