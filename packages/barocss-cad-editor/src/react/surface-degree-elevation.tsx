import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { createCadGeometryReference } from '@barocss/cad';
import { CadEditorError, type CadEditorSession } from '../types.js';
import type { CadEditorDisplayReceipt } from './types.js';
import { useCadEditorSnapshot } from './use-session.js';
import { sameIntervalData as same } from './curve-interval.js';
import { Button } from './ui/button.js';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog.js';

interface Props {
  toolbarContainer?: HTMLElement | null;
  session: CadEditorSession;
  canvas: HTMLCanvasElement | null;
  receipt: CadEditorDisplayReceipt | null;
  isCurrentSurface: (receipt: CadEditorDisplayReceipt, ownCandidateToken?: string) => boolean;
  busy: boolean;
  onError: (error: CadEditorError) => void;
}
function selectedSurface(session: CadEditorSession) {
  const snapshot = session.getSnapshot();
  if (snapshot.disposed || snapshot.view.kind !== 'document' || snapshot.selectedBodyId === null) return null;
  const resolved = createCadGeometryReference(snapshot.accepted, { bodyId: snapshot.selectedBodyId });
  return resolved.geometry.kind === 'surface' ? { snapshot, ...resolved, surface: resolved.geometry } : null;
}
function details(error: CadEditorError) {
  const messages = [error.message]; let cause: unknown = error.cause;
  for (let count = 0; count < 6 && cause instanceof Error; count++) { messages.push(cause.message); cause = cause.cause; }
  return messages.join('\n');
}
/** Immediate original-source command; only the existing Viewer bridge accepts its candidate. */
export function SurfaceDegreeElevationControls(props: Props) {
  const { session } = props, snapshot = useCadEditorSnapshot(session);
  const owner = useRef(props); owner.current = props;
  const pointers = useRef(new Set<number>()), composing = useRef(false), help = useRef(false);
  const helpTrigger = useRef<HTMLButtonElement | null>(null);
  const [helpOpen, setHelpOpen] = useState(false), [error, setError] = useState<CadEditorError | null>(null);
  let selected: ReturnType<typeof selectedSurface> = null; try { selected = selectedSurface(session); } catch {}
  const displayed = selected && props.receipt?.state.documentBodies.some(body => body.binding.bodyId === selected!.reference.bodyId);
  function captured(id: number) { return [document.documentElement, ...document.querySelectorAll('*')].some(element => element.hasPointerCapture(id)); }
  function visible() {
    const canvas = owner.current.canvas, rect = canvas?.getBoundingClientRect();
    return canvas?.isConnected === true && canvas.getClientRects().length > 0 && !!rect && rect.width > 0 && rect.height > 0
      && canvas.width > 0 && canvas.height > 0 && !['hidden', 'collapse'].includes(getComputedStyle(canvas).visibility)
      && !canvas.closest('[data-direct-host-busy="true"],[data-panel-resizing="true"]');
  }
  function available(receipt: CadEditorDisplayReceipt, token?: string) {
    const current = owner.current;
    return current.session === session && !help.current && !composing.current && visible()
      && ![...pointers.current].some(captured) && document.querySelector('[role="menu"],[role="dialog"][data-state="open"]') === null
      && current.receipt !== null && same(current.receipt.state, receipt.state)
      && current.isCurrentSurface(receipt, token);
  }
  function fail(cause: unknown) {
    const fault = cause instanceof CadEditorError ? cause : new CadEditorError('NATIVE', 'Surface degree elevation was refused.', { field: 'surface-degree-elevation' }, cause);
    setError(fault); try { owner.current.onError(fault); } catch {}
  }
  function raise(axis: 'u' | 'v') {
    let token: string | null = null;
    try {
      const before = selectedSurface(session), canvas = owner.current.canvas, receipt = owner.current.receipt;
      if (!before || !canvas || !receipt || !available(receipt) || owner.current.busy || before.snapshot.candidate
        || before.snapshot.selectionTransition || Object.keys(before.snapshot.pending).length || !selected
        || !same(before.reference, selected.reference) || before.source !== selected.source
        || before.snapshot.generation !== snapshot.generation || before.snapshot.displayGeneration !== snapshot.displayGeneration
        || !same(before.snapshot.selection, snapshot.selection) || !same(before.snapshot.curveSelection, snapshot.curveSelection)
        || before.snapshot.editTarget !== snapshot.editTarget || before.snapshot.rotationAxis !== snapshot.rotationAxis
        || before.snapshot.scaleAxis !== snapshot.scaleAxis) return;
      const degree = axis === 'u' ? before.surface.degreeU : before.surface.degreeV; if (degree >= 5) return;
      const rect = canvas.getBoundingClientRect(), size = [canvas.width, canvas.height];
      const matches = (ownToken: string) => {
        const after = selectedSurface(session), currentRect = canvas.getBoundingClientRect();
        return owner.current.session === session && owner.current.canvas === canvas && available(receipt, ownToken)
          && !!after && after.snapshot.candidate?.token === ownToken && !after.snapshot.selectionTransition
          && Object.keys(after.snapshot.pending).length === 0 && after.snapshot.generation === before.snapshot.generation
          && after.snapshot.displayGeneration === before.snapshot.displayGeneration && same(after.snapshot.view, before.snapshot.view)
          && after.snapshot.editTarget === before.snapshot.editTarget && after.snapshot.rotationAxis === before.snapshot.rotationAxis
          && after.snapshot.scaleAxis === before.snapshot.scaleAxis && same(after.snapshot.selection, before.snapshot.selection)
          && same(after.snapshot.curveSelection, before.snapshot.curveSelection) && same(after.reference, before.reference)
          && after.source === before.source && same(after.surface, before.surface) && same(after.snapshot.accepted, before.snapshot.accepted)
          && canvas.width === size[0] && canvas.height === size[1] && currentRect.left === rect.left && currentRect.top === rect.top
          && currentRect.width === rect.width && currentRect.height === rect.height;
      };
      const candidate = session.prepareSurfaceDegreeElevation(axis); token = candidate.token;
      if (candidate.kind !== 'surface-degree-elevation' || candidate.baseGeneration !== before.snapshot.generation
        || candidate.baseDisplayGeneration !== before.snapshot.displayGeneration || !matches(token))
        throw new CadEditorError('STALE', 'The Surface command context changed during preparation.', { field: 'surface-degree-elevation' });
      setError(null);
    } catch (cause) {
      if (token && session.getSnapshot().candidate?.token === token) { try { session.cancelCandidate(token); } catch {} }
      fail(cause);
    }
  }
  useEffect(() => {
    let listening = true;
    const down = (event: PointerEvent) => { pointers.current.add(event.pointerId); };
    const release = (event: PointerEvent) => { if (!captured(event.pointerId)) pointers.current.delete(event.pointerId);
      setTimeout(() => { if (listening && !captured(event.pointerId)) pointers.current.delete(event.pointerId); }, 0); };
    const start = () => { composing.current = true; }, end = () => { composing.current = false; };
    window.addEventListener('pointerdown', down, true); window.addEventListener('pointerup', release, true); window.addEventListener('pointercancel', release, true);
    window.addEventListener('lostpointercapture', release, true); window.addEventListener('compositionstart', start, true); window.addEventListener('compositionend', end, true);
    return () => { listening = false; pointers.current.clear(); composing.current = false;
      window.removeEventListener('pointerdown', down, true); window.removeEventListener('pointerup', release, true); window.removeEventListener('pointercancel', release, true);
      window.removeEventListener('lostpointercapture', release, true); window.removeEventListener('compositionstart', start, true); window.removeEventListener('compositionend', end, true); };
  }, [session]);
  useEffect(() => { setError(null); help.current = false; setHelpOpen(false); }, [session, snapshot.generation, snapshot.selectedBodyId, snapshot.view.kind]);
  useEffect(() => {
    const canvas = props.canvas; if (!canvas || !helpOpen) return;
    const check = () => { if (!visible()) { help.current = false; setHelpOpen(false); } };
    const resize = new ResizeObserver(check), mutation = new MutationObserver(check); resize.observe(canvas);
    mutation.observe(document.documentElement, { attributes: true, childList: true, subtree: true });
    return () => { resize.disconnect(); mutation.disconnect(); };
  }, [props.canvas, helpOpen]);
  if (!selected || !displayed || snapshot.view.kind !== 'document') return null;
  const busy = props.busy || helpOpen || snapshot.disposed || !!snapshot.candidate || !!snapshot.selectionTransition || Object.keys(snapshot.pending).length > 0;
  const toolbar = <div className="cad-editor-native-tools" style={props.toolbarContainer === undefined ? { top: 88 } : undefined} role="toolbar" aria-label="Surface degree">
    {(['u', 'v'] as const).map(axis => { const degree = axis === 'u' ? selected!.surface.degreeU : selected!.surface.degreeV;
      return <Button key={axis} type="button" variant="ghost" size="sm" style={props.toolbarContainer === undefined ? { width: 'auto', fontSize: 10, padding: '3px 7px' } : undefined}
        aria-label={'Raise ' + axis.toUpperCase() + ' degree'} data-testid={'surface-degree-' + axis} disabled={busy || degree >= 5}
        onKeyDown={event => { if ((event.key === 'Enter' || event.key === ' ') && (event.nativeEvent.isComposing || event.keyCode === 229
          || event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)) { event.preventDefault(); event.stopPropagation(); } }}
        onClick={() => raise(axis)}>{axis.toUpperCase()} {degree}{degree < 5 ? ' → ' + (degree + 1) : ''}</Button>; })}
    <Dialog open={helpOpen} onOpenChange={value => { if (value && (busy || !props.receipt || !available(props.receipt))) return; help.current = value; setHelpOpen(value); }}>
      <DialogTrigger asChild><Button ref={helpTrigger} type="button" variant="ghost" size="sm" style={props.toolbarContainer === undefined ? { width: 'auto', fontSize: 10, padding: '3px 7px' } : undefined}
        data-testid="surface-degree-help" disabled={props.busy}>Help</Button></DialogTrigger>
      <DialogContent className="cad-editor-help-dialog" data-testid="surface-degree-help-dialog"
        onCloseAutoFocus={event => { event.preventDefault(); if (helpTrigger.current?.isConnected && !helpTrigger.current.disabled) helpTrigger.current.focus({ preventScroll: true }); }}>
        <DialogHeader><DialogTitle>Raise Surface degree</DialogTitle><DialogDescription>Raise one original axis by one degree. Keep the Surface shape.</DialogDescription></DialogHeader>
        <div className="cad-editor-help-body"><p>U and V use the original Surface parameters. The native operation changes its control net in the complete original Source and keeps the same Surface ID, domains and siblings. After acceptance, select a new control point explicitly. Undo and Redo also clear the affected old point selection.</p>
          <p>The current provider supports degree 1–4 to 2–5 on one axis, with the opposite degree at most 5. It requires open-clamped Bezier or C0 Bernstein chains. A generic C1 basis can be refused. Current source, knot, pole and observation capacities still apply; these limits describe this provider, not the final editor scope.</p>
          <p>Degree elevation requires XYZ within ±10000 mm and weights from 0.000001 to 1000000. Original point editing has a separate ±1000000 mm profile. The command uses the native whole-source result and the existing whole-document viewport admission before one history entry. A refusal retains the accepted source, frame and point selection.</p>
          <p>Download stores the resulting native document, not an elevation recipe or history. Local native observations do not certify global error, topology or a Solid.</p>
          {error && <details><summary>Technical error details</summary><pre>{details(error)}</pre></details>}
        </div><DialogClose asChild><Button type="button" variant="outline" className="cad-editor-export-close" data-testid="surface-degree-help-close">Close help</Button></DialogClose>
      </DialogContent>
    </Dialog>
    {error && <span role="alert" data-testid="surface-degree-error" style={{ alignSelf: 'center', fontSize: 10 }}>Cannot raise this degree. Open Help.</span>}
  </div>;
  return props.toolbarContainer === undefined ? toolbar
    : props.toolbarContainer === null ? null : createPortal(toolbar, props.toolbarContainer);
}
