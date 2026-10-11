import { useEffect, useRef, useState } from 'react';
import { createCadGeometryReference, curveDomain, evaluateCurve } from '@barocss/cad';
import { CadEditorError, type CadEditorSession } from '../types.js';
import type { CadEditorDisplayReceipt } from './types.js';
import { useCadEditorSnapshot } from './use-session.js';
import { sameIntervalData as same } from './curve-interval.js';
import { projectCurvePole } from './curve-pole-projection.js';
import { Button } from './ui/button.js';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog.js';

interface Props {
  session: CadEditorSession; canvas: HTMLCanvasElement | null; receipt: CadEditorDisplayReceipt | null;
  isCurrentCurve: (receipt: CadEditorDisplayReceipt, ownCandidateToken?: string) => boolean;
  busy: boolean; onError: (error: CadEditorError) => void;
}
function selectedCurve(session: CadEditorSession) {
  const snapshot = session.getSnapshot();
  if (snapshot.disposed || snapshot.view.kind !== 'document' || snapshot.selectedBodyId === null) return null;
  const resolved = createCadGeometryReference(snapshot.accepted, { bodyId: snapshot.selectedBodyId });
  return resolved.geometry.kind === 'curve' ? { snapshot, reference: resolved.reference, source: resolved.source,
    curve: resolved.geometry, domain: curveDomain(resolved.geometry) } : null;
}
function details(error: CadEditorError) {
  const messages = [error.message]; let cause: unknown = error.cause;
  for (let count = 0; count < 6 && cause instanceof Error; count++) { messages.push(cause.message); cause = cause.cause; }
  return messages.join('\n');
}
/** A discrete native construction; the existing whole-document bridge owns acceptance. */
export function CurveReversalControls(props: Props) {
  const { session } = props, snapshot = useCadEditorSnapshot(session);
  const owner = useRef(props); owner.current = props;
  const pointers = useRef(new Set<number>()), composing = useRef(false), help = useRef(false), helpTrigger = useRef<HTMLButtonElement | null>(null);
  const [helpOpen, setHelpOpen] = useState(false), [error, setError] = useState<CadEditorError | null>(null);
  let selected: ReturnType<typeof selectedCurve> = null; try { selected = selectedCurve(session); } catch {}
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
      && current.receipt !== null && same(current.receipt.state, receipt.state) && current.isCurrentCurve(receipt, token);
  }
  function fail(cause: unknown) {
    const fault = cause instanceof CadEditorError ? cause : new CadEditorError('NATIVE', 'Native Curve reversal was refused.', { field: 'curve-reversal' }, cause);
    setError(fault); try { owner.current.onError(fault); } catch {}
  }
  function create() {
    let token: string | null = null;
    try {
      const before = selectedCurve(session), canvas = owner.current.canvas, receipt = owner.current.receipt;
      if (!before || !canvas || !receipt || !available(receipt) || owner.current.busy || before.snapshot.candidate
        || before.snapshot.selectionTransition || Object.keys(before.snapshot.pending).length || !selected
        || !same(before.reference, selected.reference) || before.source !== selected.source || !same(before.curve, selected.curve) || !same(before.domain, selected.domain)
        || before.snapshot.generation !== snapshot.generation || before.snapshot.displayGeneration !== snapshot.displayGeneration
        || !same(before.snapshot.view, snapshot.view) || !same(before.snapshot.selection, snapshot.selection) || !same(before.snapshot.curveSelection, snapshot.curveSelection)
        || before.snapshot.editTarget !== snapshot.editTarget || before.snapshot.rotationAxis !== snapshot.rotationAxis || before.snapshot.scaleAxis !== snapshot.scaleAxis) return;
      const rect = canvas.getBoundingClientRect(), size = [canvas.width, canvas.height];
      const matches = (ownToken: string) => {
        const after = selectedCurve(session), currentRect = canvas.getBoundingClientRect();
        return owner.current.session === session && owner.current.canvas === canvas && available(receipt, ownToken)
          && !!after && after.snapshot.candidate?.token === ownToken && !after.snapshot.selectionTransition
          && same(after.snapshot.pending, before.snapshot.pending) && after.snapshot.generation === before.snapshot.generation
          && after.snapshot.displayGeneration === before.snapshot.displayGeneration && same(after.snapshot.view, before.snapshot.view)
          && after.snapshot.editTarget === before.snapshot.editTarget && after.snapshot.rotationAxis === before.snapshot.rotationAxis
          && after.snapshot.scaleAxis === before.snapshot.scaleAxis && same(after.snapshot.selection, before.snapshot.selection)
          && same(after.snapshot.curveSelection, before.snapshot.curveSelection) && same(after.reference, before.reference)
          && after.source === before.source && same(after.curve, before.curve) && same(after.domain, before.domain) && same(after.snapshot.accepted, before.snapshot.accepted)
          && canvas.width === size[0] && canvas.height === size[1] && currentRect.left === rect.left && currentRect.top === rect.top
          && currentRect.width === rect.width && currentRect.height === rect.height;
      };
      const candidate = session.prepareCurveReversal(); token = candidate.token;
      if (candidate.kind !== 'curve-reversal' || candidate.baseGeneration !== before.snapshot.generation
        || candidate.baseDisplayGeneration !== before.snapshot.displayGeneration || !matches(token))
        throw new CadEditorError('STALE', 'The Curve command context changed during preparation.', { field: 'curve-reversal' });
      setError(null);
    } catch (cause) { if (token && session.getSnapshot().candidate?.token === token) { try { session.cancelCandidate(token); } catch {} } fail(cause); }
  }
  useEffect(() => {
    let listening = true; const down = (event: PointerEvent) => { pointers.current.add(event.pointerId); };
    const release = (event: PointerEvent) => { if (!captured(event.pointerId)) pointers.current.delete(event.pointerId);
      setTimeout(() => { if (listening && !captured(event.pointerId)) pointers.current.delete(event.pointerId); }, 0); };
    const start = () => { composing.current = true; }, end = () => { composing.current = false; };
    window.addEventListener('pointerdown', down, true); window.addEventListener('pointerup', release, true); window.addEventListener('pointercancel', release, true);
    window.addEventListener('lostpointercapture', release, true); window.addEventListener('compositionstart', start, true); window.addEventListener('compositionend', end, true);
    return () => { listening = false; pointers.current.clear(); composing.current = false;
      window.removeEventListener('pointerdown', down, true); window.removeEventListener('pointerup', release, true); window.removeEventListener('pointercancel', release, true);
      window.removeEventListener('lostpointercapture', release, true); window.removeEventListener('compositionstart', start, true); window.removeEventListener('compositionend', end, true); };
  }, [session]);
  useEffect(() => { setError(null); help.current = false; setHelpOpen(false); }, [session, snapshot.generation, snapshot.displayGeneration,
    snapshot.selectedBodyId, snapshot.view.kind, snapshot.curveSelection?.index, snapshot.editTarget, snapshot.rotationAxis, snapshot.scaleAxis]);
  useEffect(() => {
    const canvas = props.canvas; if (!canvas || !helpOpen) return;
    const check = () => { if (!visible()) { help.current = false; setHelpOpen(false); } };
    const resize = new ResizeObserver(check), mutation = new MutationObserver(check); resize.observe(canvas);
    mutation.observe(document.documentElement, { attributes: true, childList: true, subtree: true });
    return () => { resize.disconnect(); mutation.disconnect(); };
  }, [props.canvas, helpOpen]);
  if (!selected || !displayed || snapshot.view.kind !== 'document') return null;
  const busy = props.busy || helpOpen || snapshot.disposed || !!snapshot.candidate || !!snapshot.selectionTransition || Object.keys(snapshot.pending).length > 0;
  const canvas = props.canvas, frame = props.receipt, rect = canvas?.getBoundingClientRect();
  let markers: { start: NonNullable<ReturnType<typeof projectCurvePole>> | null; end: NonNullable<ReturnType<typeof projectCurvePole>> | null;
    direction: { x: number; y: number; tipX: number; tipY: number; arrow: string } | null } | null = null;
  if (canvas && frame && rect && rect.width > 0 && rect.height > 0 && visible() && props.isCurrentCurve(frame)) try {
    const [min, max] = selected.domain;
    const project = (parameter: number) => projectCurvePole(evaluateCurve(selected!.curve, parameter), frame.state.camera, frame.state.mmToSceneUnit,
      rect.width, rect.height, canvas.width, canvas.height);
    const start = project(min), end = project(max), next = project(min + (max - min) / 64);
    let direction: { x: number; y: number; tipX: number; tipY: number; arrow: string } | null = null;
    if (start && next) { const dx = next.xCss - start.xCss, dy = next.yCss - start.yCss, length = Math.hypot(dx, dy);
      if (length >= 0.5 && Number.isFinite(length)) {
        const ux = dx / length, uy = dy / length, size = Math.min(length, 24), tipX = start.xCss + ux * size, tipY = start.yCss + uy * size;
        const head = Math.min(4, size / 2), backX = tipX - ux * head, backY = tipY - uy * head;
        direction = { x: start.xCss, y: start.yCss, tipX, tipY,
          arrow: `${tipX},${tipY} ${backX - uy * head / 2},${backY + ux * head / 2} ${backX + uy * head / 2},${backY - ux * head / 2}` };
      }
    }
    markers = { start, end, direction };
  } catch { /* Native D0 or projection refusal leaves the discrete command available. */ }
  return <>
    {markers && rect && <div className="curve-reversal-overlay"><svg className="curve-reversal-svg" width={rect.width} height={rect.height} viewBox={`0 0 ${rect.width} ${rect.height}`} aria-hidden="true">
      {markers.direction && <g><line className="curve-reversal-direction" data-testid="curve-reversal-direction" x1={markers.direction.x} y1={markers.direction.y} x2={markers.direction.tipX} y2={markers.direction.tipY} />
        <polygon className="curve-reversal-arrow" points={markers.direction.arrow} /></g>}
      {(['start', 'end'] as const).map(endpoint => { const point = markers![endpoint]; return point && <g key={endpoint}>
        <circle className="curve-reversal-point" data-endpoint={endpoint} data-testid={'curve-reversal-' + endpoint} cx={point.xCss} cy={point.yCss} r={4} />
        <text className="curve-reversal-label" x={point.xCss + 8} y={point.yCss + (endpoint === 'start' ? -8 : 14)}>{endpoint === 'start' ? 'Start' : 'End'}</text>
      </g>; })}
    </svg></div>}
    <div className="curve-reversal-tools" role="toolbar" aria-label="Curve direction">
      <Button type="button" variant="ghost" size="sm" className="curve-reversal-create" data-testid="curve-reversal-create" disabled={busy} onClick={create}
        onKeyDown={event => { if ((event.key === 'Enter' || event.key === ' ') && (event.nativeEvent.isComposing || event.keyCode === 229
          || event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)) { event.preventDefault(); event.stopPropagation(); } }}>Make reversed copy</Button>
      <Dialog open={helpOpen} onOpenChange={value => { if (value && (busy || !props.receipt || !available(props.receipt))) return; help.current = value; setHelpOpen(value); }}>
        <DialogTrigger asChild><Button ref={helpTrigger} type="button" variant="ghost" size="sm" data-testid="curve-reversal-help" disabled={props.busy}>Help</Button></DialogTrigger>
        <DialogContent className="cad-editor-help-dialog" data-testid="curve-reversal-help-dialog" onCloseAutoFocus={event => {
          event.preventDefault(); if (visible() && helpTrigger.current?.isConnected && !helpTrigger.current.disabled) helpTrigger.current.focus({ preventScroll: true }); }}>
          <DialogHeader><DialogTitle>Reversed Curve copy</DialogTitle><DialogDescription>Swap the copy’s start and end. Keep the original.</DialogDescription></DialogHeader>
          <div className="cad-editor-help-body"><p>Start and End mark the accepted original Curve at its domain endpoints. The short arrow follows the chord toward the first of 64 equal parameter steps. These native D0 observations are display-only, not point selection, a continuous inverse or an occlusion certificate. Clipped or degenerate arrows are omitted.</p>
            <p>The copy retains the original domain with a decreasing native parameter map. Native coefficient and weight copies, reflected knots and whole-result validation define its geometry. The original complete Sources, siblings, revisions and selected point or absence remain.</p>
            <p>The generated singleton Source enters a new independent asset and body named Reversed Curve. Regenerated originalSource is comparison data and never replaces the original asset. This does not reverse the original mixed Source in place. Select the saved copy explicitly to edit it or use it in Join; Join still requires its actual ordered endpoint and domain conditions.</p>
            <p>Current native reversal supports degree 1–3, 2–64 poles, at most 70 knots, XYZ within ±10000 mm and positive weights from 0.000001 to 1000000. Clamped nonperiodic data, representability, 256 local observations and 64 guard limits apply. Existing document, display, Source, file and history capacity remains; no object is evicted.</p>
            <p>Whole viewport admission precedes one history entry. Refusal retains accepted Source/frame/history. Undo removes the copy; Redo restores its IDs with fresh references. Download saves geometry, not a reversal recipe or history. Local observations do not certify double-reversal bits, global error, G1/G2, topology, manufacturing tolerance or a Solid.</p>
            {error && <details><summary>Technical error details</summary><pre>{details(error)}</pre></details>}
          </div><DialogClose asChild><Button type="button" variant="outline" className="cad-editor-export-close" data-testid="curve-reversal-help-close">Close help</Button></DialogClose>
        </DialogContent>
      </Dialog>
      {error && <span className="curve-reversal-error" role="alert" data-testid="curve-reversal-error">Cannot make this copy. Open Help.</span>}
    </div>
  </>;
}
