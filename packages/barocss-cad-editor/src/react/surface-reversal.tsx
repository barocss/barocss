import { useEffect, useRef, useState } from 'react';
import { createCadGeometryReference, surfaceDomain, evaluateSurface } from '@barocss/cad';
import { CadEditorError, type CadEditorSession } from '../types.js';
import type { CadEditorDisplayReceipt } from './types.js';
import { useCadEditorSnapshot } from './use-session.js';
import { sameIntervalData as same } from './curve-interval.js';
import { projectCurvePole } from './curve-pole-projection.js';
import { Button } from './ui/button.js';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog.js';

interface Props {
  session: CadEditorSession; canvas: HTMLCanvasElement | null; receipt: CadEditorDisplayReceipt | null;
  isCurrentSurface: (receipt: CadEditorDisplayReceipt, ownCandidateToken?: string) => boolean;
  busy: boolean; onError: (error: CadEditorError) => void;
}
function selectedSurface(session: CadEditorSession) {
  const snapshot = session.getSnapshot();
  if (snapshot.disposed || snapshot.view.kind !== 'document' || snapshot.selectedBodyId === null) return null;
  const resolved = createCadGeometryReference(snapshot.accepted, { bodyId: snapshot.selectedBodyId });
  return resolved.geometry.kind === 'surface' ? { snapshot, reference: resolved.reference, source: resolved.source,
    surface: resolved.geometry, domain: surfaceDomain(resolved.geometry) } : null;
}
function details(error: CadEditorError) {
  const messages = [error.message]; let cause: unknown = error.cause;
  for (let count = 0; count < 6 && cause instanceof Error; count++) { messages.push(cause.message); cause = cause.cause; }
  return messages.join('\n');
}
/** A discrete native construction; the existing whole-document bridge owns acceptance. */
export function SurfaceReversalControls(props: Props) {
  const { session } = props, snapshot = useCadEditorSnapshot(session);
  const owner = useRef(props); owner.current = props;
  const pointers = useRef(new Set<number>()), composing = useRef(false), help = useRef(false), helpTrigger = useRef<HTMLButtonElement | null>(null);
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
      && current.receipt !== null && same(current.receipt.state, receipt.state) && current.isCurrentSurface(receipt, token);
  }
  function fail(cause: unknown) {
    const fault = cause instanceof CadEditorError ? cause : new CadEditorError('NATIVE', 'Native Surface reversal was refused.', { field: 'surface-reversal' }, cause);
    setError(fault); try { owner.current.onError(fault); } catch {}
  }
  function create(axis: 'u' | 'v') {
    let token: string | null = null;
    try {
      const before = selectedSurface(session), canvas = owner.current.canvas, receipt = owner.current.receipt;
      if (!before || !canvas || !receipt || !available(receipt) || owner.current.busy || before.snapshot.candidate
        || before.snapshot.selectionTransition || Object.keys(before.snapshot.pending).length || !selected
        || !same(before.reference, selected.reference) || before.source !== selected.source || !same(before.surface, selected.surface) || !same(before.domain, selected.domain)
        || before.snapshot.generation !== snapshot.generation || before.snapshot.displayGeneration !== snapshot.displayGeneration
        || !same(before.snapshot.view, snapshot.view) || !same(before.snapshot.selection, snapshot.selection) || !same(before.snapshot.curveSelection, snapshot.curveSelection)
        || before.snapshot.editTarget !== snapshot.editTarget || before.snapshot.rotationAxis !== snapshot.rotationAxis || before.snapshot.scaleAxis !== snapshot.scaleAxis) return;
      const rect = canvas.getBoundingClientRect(), size = [canvas.width, canvas.height];
      const matches = (ownToken: string) => {
        const after = selectedSurface(session), currentRect = canvas.getBoundingClientRect();
        return owner.current.session === session && owner.current.canvas === canvas && available(receipt, ownToken)
          && !!after && after.snapshot.candidate?.token === ownToken && !after.snapshot.selectionTransition
          && same(after.snapshot.pending, before.snapshot.pending) && after.snapshot.generation === before.snapshot.generation
          && after.snapshot.displayGeneration === before.snapshot.displayGeneration && same(after.snapshot.view, before.snapshot.view)
          && after.snapshot.editTarget === before.snapshot.editTarget && after.snapshot.rotationAxis === before.snapshot.rotationAxis
          && after.snapshot.scaleAxis === before.snapshot.scaleAxis && same(after.snapshot.selection, before.snapshot.selection)
          && same(after.snapshot.curveSelection, before.snapshot.curveSelection) && same(after.reference, before.reference)
          && after.source === before.source && same(after.surface, before.surface) && same(after.domain, before.domain) && same(after.snapshot.accepted, before.snapshot.accepted)
          && canvas.width === size[0] && canvas.height === size[1] && currentRect.left === rect.left && currentRect.top === rect.top
          && currentRect.width === rect.width && currentRect.height === rect.height;
      };
      const candidate = session.prepareSurfaceReversal(axis); token = candidate.token;
      if (candidate.kind !== 'surface-reversal' || candidate.baseGeneration !== before.snapshot.generation
        || candidate.baseDisplayGeneration !== before.snapshot.displayGeneration || !matches(token))
        throw new CadEditorError('STALE', 'The Surface command context changed during preparation.', { field: 'surface-reversal' });
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
    snapshot.selectedBodyId, snapshot.view.kind, snapshot.selection?.uIndex, snapshot.selection?.vIndex, snapshot.editTarget, snapshot.rotationAxis, snapshot.scaleAxis]);
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
  type Marker = { axis: 'u' | 'v'; start: NonNullable<ReturnType<typeof projectCurvePole>> | null;
    end: NonNullable<ReturnType<typeof projectCurvePole>> | null;
    direction: { x: number; y: number; tipX: number; tipY: number; arrow: string } | null };
  const markers: Marker[] = [];
  if (canvas && frame && rect && rect.width > 0 && rect.height > 0 && visible() && props.isCurrentSurface(frame)) {
    for (const axis of ['u', 'v'] as const) try {
      const [min, max] = selected.domain[axis], other = selected.domain[axis === 'u' ? 'v' : 'u'];
      const middle = other[0] / 2 + other[1] / 2;
      const project = (parameter: number) => projectCurvePole(evaluateSurface(selected!.surface,
        axis === 'u' ? parameter : middle, axis === 'v' ? parameter : middle), frame.state.camera, frame.state.mmToSceneUnit,
        rect.width, rect.height, canvas.width, canvas.height);
      const start = project(min), end = project(max), next = project(min + (max - min) / 64);
      let direction: Marker['direction'] = null;
      if (start && next) { const dx = next.xCss - start.xCss, dy = next.yCss - start.yCss, length = Math.hypot(dx, dy);
        if (length >= 0.5 && Number.isFinite(length)) {
          const ux = dx / length, uy = dy / length, size = Math.min(length, 24), tipX = start.xCss + ux * size, tipY = start.yCss + uy * size;
          const head = Math.min(4, size / 2), backX = tipX - ux * head, backY = tipY - uy * head;
          direction = { x: start.xCss, y: start.yCss, tipX, tipY,
            arrow: `${tipX},${tipY} ${backX - uy * head / 2},${backY + ux * head / 2} ${backX + uy * head / 2},${backY - ux * head / 2}` };
        }
      }
      markers.push({ axis, start, end, direction });
    } catch { /* Native D0 or projection refusal omits this axis guide, not the discrete command. */ }
  }
  return <>
    {markers.length > 0 && rect && <div className="surface-reversal-overlay"><svg className="surface-reversal-svg" width={rect.width} height={rect.height} viewBox={`0 0 ${rect.width} ${rect.height}`} aria-hidden="true">
      {markers.map(marker => <g key={marker.axis} data-axis={marker.axis}>
        {marker.direction && <g><line className="surface-reversal-direction" data-axis={marker.axis} data-testid={`surface-reversal-${marker.axis}-direction`}
          x1={marker.direction.x} y1={marker.direction.y} x2={marker.direction.tipX} y2={marker.direction.tipY} />
          <polygon className="surface-reversal-arrow" data-axis={marker.axis} points={marker.direction.arrow} /></g>}
        {(['start', 'end'] as const).map(endpoint => { const point = marker[endpoint]; return point && <g key={endpoint}>
          <circle className="surface-reversal-point" data-axis={marker.axis} data-endpoint={endpoint} data-testid={`surface-reversal-${marker.axis}-${endpoint}`} cx={point.xCss} cy={point.yCss} r={4} />
          <text className="surface-reversal-label" data-axis={marker.axis} x={point.xCss + 8} y={point.yCss + (endpoint === 'start' ? -8 : 14)}>{marker.axis.toUpperCase()} {endpoint}</text>
        </g>; })}
      </g>)}
    </svg></div>}
    <div className="surface-reversal-tools" role="toolbar" aria-label="Surface parameter direction">
      {(['u', 'v'] as const).map(axis => <Button key={axis} type="button" variant="ghost" size="sm" className="surface-reversal-create" data-testid={`surface-reversal-${axis}`} disabled={busy} onClick={() => create(axis)}
        onKeyDown={event => { if ((event.key === 'Enter' || event.key === ' ') && (event.nativeEvent.isComposing || event.keyCode === 229
          || event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)) { event.preventDefault(); event.stopPropagation(); } }}>Reverse {axis.toUpperCase()} copy</Button>)}
      <Dialog open={helpOpen} onOpenChange={value => { if (value && (busy || !props.receipt || !available(props.receipt))) return; help.current = value; setHelpOpen(value); }}>
        <DialogTrigger asChild><Button ref={helpTrigger} type="button" variant="ghost" size="sm" data-testid="surface-reversal-help" disabled={props.busy}>Help</Button></DialogTrigger>
        <DialogContent className="cad-editor-help-dialog" data-testid="surface-reversal-help-dialog" onCloseAutoFocus={event => {
          event.preventDefault(); if (visible() && helpTrigger.current?.isConnected && !helpTrigger.current.disabled) helpTrigger.current.focus({ preventScroll: true }); }}>
          <DialogHeader><DialogTitle>Reversed Surface copy</DialogTitle><DialogDescription>Reverse one parameter direction in a copy. Keep the original.</DialogDescription></DialogHeader>
          <div className="cad-editor-help-body"><p>Reverse U copy or Reverse V copy creates an independent Surface. The original complete Source, siblings, revisions and selected point or absence remain. Select the copy explicitly to edit it.</p>
            <p>U and V start and end marks use the accepted original Surface at the opposite domain midpoint. Each short arrow follows the chord toward the first equal parameter station and is capped at 24 pixels. Clipped or degenerate guides are omitted. They show parameter direction only, not a Surface normal, Face orientation, pivot or visibility certificate.</p>
            <p>The copy keeps both domains. The chosen parameter is reflected across its original domain; native pole and weight ordering, reflected knots and result validation define the geometry. The generated singleton Source enters a new independent asset. Regenerated originalSource is comparison data and never replaces the original mixed asset.</p>
            <p>The current native operation supports degree 1–3 on both axes, up to 16 poles per axis and 256 total poles, XYZ within ±10000 mm, positive weights and clamped nonperiodic data. Representability, 128 local observations and 256 guard records apply. Existing document, display, Source, file and history limits remain; no object is evicted.</p>
            <p>Whole viewport admission precedes one history entry. Refusal retains the accepted Source, frame and history. Undo removes the copy; Redo restores its IDs with fresh references. Download saves geometry, not a reversal recipe or history. Local checks do not certify global error, double-reversal bits, normals, G1/G2, topology or a Solid.</p>
            {error && <details><summary>Technical error details</summary><pre>{details(error)}</pre></details>}
          </div><DialogClose asChild><Button type="button" variant="outline" className="cad-editor-export-close" data-testid="surface-reversal-help-close">Close help</Button></DialogClose>
        </DialogContent>
      </Dialog>
      {error && <span className="surface-reversal-error" role="alert" data-testid="surface-reversal-error">Cannot make this copy. Open Help.</span>}
    </div>
  </>;
}
