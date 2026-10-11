import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createCadGeometryReference, surfaceDomain } from '@barocss/cad';
import { CadEditorError, type CadEditorSession, type CadEditorSurfaceIsoCurveAxis } from '../types.js';
import type { CadEditorDisplayReceipt } from './types.js';
import { useCadEditorSnapshot } from './use-session.js';
import { sameIntervalData as same, useCurveInterval } from './curve-interval.js';
import { useSurfaceKnot } from './surface-knot.js';
import { useCurveKnot } from './curve-knot.js';
import { Button } from './ui/button.js';
import { Input } from './ui/input.js';
import { Label } from './ui/label.js';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog.js';

type Axis = CadEditorSurfaceIsoCurveAxis;
const keyFor = (axis: Axis) => axis === 'u' ? 'surfaceIsoU' : 'surfaceIsoV';
const keys = ['surfaceIsoU', 'surfaceIsoV'];
export const isoNumberText = (value: number) => Object.is(value, -0) ? '-0' : String(value);
export function surfaceIsoCurveSurface(session: CadEditorSession) {
  const snapshot = session.getSnapshot();
  if (snapshot.disposed || snapshot.selectedBodyId === null || snapshot.view.kind !== 'document' || snapshot.editTarget !== 'pole') return null;
  const resolved = createCadGeometryReference(snapshot.accepted, { bodyId: snapshot.selectedBodyId });
  if (resolved.geometry.kind !== 'surface') return null;
  return { snapshot, reference: resolved.reference, surface: resolved.geometry, source: resolved.source, domain: surfaceDomain(resolved.geometry) };
}
type Data = NonNullable<ReturnType<typeof surfaceIsoCurveSurface>>;
function displayedRaw(data: Data, axis: Axis): string {
  const staged = data.snapshot.pending[keyFor(axis)]; if (staged !== undefined) return staged;
  const previous = data.snapshot.lastSurfaceIsoCurve;
  if (previous && previous.sourceReference.bodyId === data.reference.bodyId
    && previous.sourceReference.assetId === data.reference.assetId && previous.sourceReference.assetRevision === data.reference.assetRevision
    && previous.result.provenance.fixedAxis === axis && same(previous.result.original, data.surface))
    return isoNumberText(previous.result.provenance.parameter);
  return isoNumberText(data.domain[axis][0] / 2 + data.domain[axis][1] / 2);
}
interface Mode {
  session: CadEditorSession; active: boolean; isActive: () => boolean; axis: Axis; currentAxis: () => Axis; raw: string; error: string | null;
  setAxis: (axis: Axis) => void; stage: (raw: string) => void; create: () => void; discard: () => void; done: () => void; open: () => void;
  allowed: (allowFieldComposition?: boolean) => boolean; report: (cause: unknown) => void; noteError: (error: CadEditorError) => void;
  gesture: { current: boolean }; onGestureChange: (active: boolean) => void;
  viewport: { current: { canvas: HTMLCanvasElement | null; receipt: CadEditorDisplayReceipt | null; isCurrentSurface: (receipt?: CadEditorDisplayReceipt) => boolean } | null };
}
const Context = createContext<Mode | null>(null);
export function useSurfaceIsoCurve() { return useContext(Context); }
function message(error: CadEditorError) {
  if (error.context.field === 'restore-frame') return 'Cannot restore the current view. Reopen the viewport.';
  if (error.code === 'DISPLAY') return 'Cannot display this Curve. The current document is retained.';
  if (error.code === 'STALE') return 'The Surface or draft changed. Review the parameter.';
  if (error.code === 'BUDGET') return 'Hide a displayed object or use a document with available capacity. Open Help for details.';
  return 'Choose a parameter inside the original domain. Open Help for current native limits.';
}
/** Shared Root fields are the only editable parameter authority. */
export function SurfaceIsoCurveProvider({ session, onError, onGestureChange, children }: {
  session: CadEditorSession; onError?: (error: CadEditorError) => void; onGestureChange?: (active: boolean) => void; children: ReactNode;
}) {
  const snapshot = useCadEditorSnapshot(session), interval = useCurveInterval(), knot = useSurfaceKnot(), curveKnot = useCurveKnot();
  const [bodyId, setBodyId] = useState<string | null>(null), [idleAxis, setIdleAxis] = useState<Axis>('u'), [error, setError] = useState<string | null>(null), [, refresh] = useState(0);
  const gesture = useRef(false), pointers = useRef(new Set<number>()), composition = useRef<EventTarget | null>(null), viewport = useRef<Mode['viewport']['current']>(null);
  const diagnostic = useRef<CadEditorError | null>(null), current = useRef({ session, onError, onGestureChange, bodyId, idleAxis }); current.current = { session, onError, onGestureChange, bodyId, idleAxis };
  const axis: Axis = Object.hasOwn(snapshot.pending, 'surfaceIsoV') ? 'v' : Object.hasOwn(snapshot.pending, 'surfaceIsoU') ? 'u' : idleAxis;
  let selected: ReturnType<typeof surfaceIsoCurveSurface> = null; try { selected = surfaceIsoCurveSurface(session); } catch {}
  const raw = selected ? displayedRaw(selected, axis) : '';
  function captured(id: number) { return [document.documentElement, ...document.querySelectorAll('*')].some(element => element.hasPointerCapture(id)); }
  function allowed(allowFieldComposition = false) {
    const owner = current.current, frame = viewport.current, canvas = frame?.canvas, rect = canvas?.getBoundingClientRect();
    const composingField = composition.current instanceof Element && composition.current.closest('[data-testid="surface-isocurve-parameter"]') !== null
      && composition.current.closest('.cad-editor') === canvas?.closest('.cad-editor');
    return owner.session === session && !gesture.current && (!composition.current || allowFieldComposition && composingField)
      && !interval?.active && !knot?.active && !curveKnot?.active && !!frame?.receipt && frame.isCurrentSurface(frame.receipt)
      && canvas?.isConnected === true && canvas.getClientRects().length > 0 && !!rect && rect.width > 0 && rect.height > 0
      && !['hidden', 'collapse'].includes(getComputedStyle(canvas).visibility) && !canvas.closest('[data-direct-host-busy="true"],[data-panel-resizing="true"]')
      && ![...pointers.current].some(captured) && document.querySelector('[role="dialog"][data-state="open"],[role="menu"]') === null;
  }
  function report(cause: unknown) { const fault = cause instanceof CadEditorError ? cause : new CadEditorError('INPUT',
    cause instanceof Error ? cause.message : 'Curve creation was refused.', { field: 'surface-isocurve' }, cause);
    diagnostic.current = fault; setError(message(fault)); try { current.current.onError?.(fault); } catch {} }
  function clearError() { diagnostic.current = null; setError(null); }
  function isActive() { return current.current.session === session && current.current.bodyId !== null && surfaceIsoCurveSurface(session)?.reference.bodyId === current.current.bodyId; }
  function currentAxis(): Axis { const pending = session.getSnapshot().pending;
    return Object.hasOwn(pending, 'surfaceIsoV') ? 'v' : Object.hasOwn(pending, 'surfaceIsoU') ? 'u' : current.current.idleAxis; }
  function target(allowComposition = false, entering = false) {
    const data = surfaceIsoCurveSurface(session), owner = current.current;
    if (!allowed(allowComposition) || !data || data.snapshot.candidate || data.snapshot.selectionTransition
      || (entering ? owner.bodyId !== null : !isActive()) || owner.bodyId !== null && data.reference.bodyId !== owner.bodyId)
      throw new CadEditorError('STALE', 'The original Surface or its presentation changed.', { field: 'surface-isocurve' });
    return data;
  }
  function open() { try { const data = target(false, true); if (Object.keys(data.snapshot.pending).some(key => !keys.includes(key))) return;
    current.current.bodyId = data.reference.bodyId; setBodyId(data.reference.bodyId); clearError(); } catch (cause) { report(cause); } }
  function setAxis(value: Axis) { try { const data = target(); if (value !== 'u' && value !== 'v' || Object.keys(data.snapshot.pending).length) return;
    current.current.idleAxis = value; setIdleAxis(value); clearError(); } catch (cause) { report(cause); } }
  function stageRaw(value: string): boolean {
    try { const before = target(true), chosen: Axis = Object.hasOwn(before.snapshot.pending, 'surfaceIsoV') ? 'v'
      : Object.hasOwn(before.snapshot.pending, 'surfaceIsoU') ? 'u' : current.current.idleAxis;
      const key = keyFor(chosen), expected = { ...before.snapshot.pending };
      if (Object.keys(expected).some(field => field !== key)) throw new CadEditorError('INPUT', 'Resolve other fields before creating a Curve.', { field: 'surface-isocurve' });
      if (value === '') delete expected[key]; else expected[key] = value;
      session.stageSurfaceIsoCurveField(chosen, value); const after = target(true);
      if (after.snapshot.generation !== before.snapshot.generation || after.snapshot.displayGeneration !== before.snapshot.displayGeneration
        || !same(after.reference, before.reference) || after.source !== before.source || !same(after.snapshot.pending, expected)
        || !same(after.snapshot.selection, before.snapshot.selection) || !same(after.snapshot.curveSelection, before.snapshot.curveSelection))
        throw new CadEditorError('STALE', 'The parameter changed during staging. Review the draft.', { field: 'surface-isocurve' });
      clearError(); return true;
    } catch (cause) { report(cause); return false; }
  }
  function create() {
    try { let before = target(); const chosen: Axis = Object.hasOwn(before.snapshot.pending, 'surfaceIsoV') ? 'v'
      : Object.hasOwn(before.snapshot.pending, 'surfaceIsoU') ? 'u' : current.current.idleAxis;
      if (!Object.keys(before.snapshot.pending).length) { if (!stageRaw(displayedRaw(before, chosen))) return; before = target(); }
      const proposed = session.prepareApply(), after = surfaceIsoCurveSurface(session);
      if (!proposed || !after || after.snapshot.candidate?.token !== proposed.token || after.snapshot.generation !== before.snapshot.generation
        || after.snapshot.displayGeneration !== before.snapshot.displayGeneration || !same(after.reference, before.reference) || after.source !== before.source
        || !same(after.snapshot.pending, before.snapshot.pending) || !same(after.snapshot.view, before.snapshot.view)
        || !same(after.snapshot.selection, before.snapshot.selection) || !same(after.snapshot.curveSelection, before.snapshot.curveSelection)
        || after.snapshot.selectionTransition !== null || !isActive() || !allowed()) {
        if (proposed && session.getSnapshot().candidate?.token === proposed.token) session.cancelCandidate(proposed.token);
        throw new CadEditorError('STALE', 'Curve creation changed during preparation. Review the draft.', { field: 'surface-isocurve' });
      }
      clearError();
    } catch (cause) { report(cause); }
  }
  function discard() { try { const before = target(); if (Object.keys(before.snapshot.pending).some(key => !keys.includes(key))) return;
    session.discardPending(); const after = target(); if (Object.keys(after.snapshot.pending).length || !same(after.reference, before.reference) || after.source !== before.source)
      throw new CadEditorError('STALE', 'The draft changed during Discard.', { field: 'surface-isocurve' }); clearError(); } catch (cause) { report(cause); } }
  function done() { try { if (Object.keys(target().snapshot.pending).length) return; current.current.bodyId = null; setBodyId(null); clearError(); } catch (cause) { report(cause); } }
  useEffect(() => {
    let live = true; const down = (event: PointerEvent) => { pointers.current.add(event.pointerId); };
    const release = (event: PointerEvent) => { if (!captured(event.pointerId)) pointers.current.delete(event.pointerId);
      setTimeout(() => { if (live && !captured(event.pointerId)) pointers.current.delete(event.pointerId); }, 0); };
    const start = (event: Event) => { composition.current = event.target; refresh(value => value + 1); }, end = () => { composition.current = null; refresh(value => value + 1); };
    window.addEventListener('pointerdown', down, true); window.addEventListener('pointerup', release, true); window.addEventListener('pointercancel', release, true);
    window.addEventListener('lostpointercapture', release, true); window.addEventListener('compositionstart', start, true); window.addEventListener('compositionend', end, true);
    return () => { live = false; pointers.current.clear(); composition.current = null; window.removeEventListener('pointerdown', down, true);
      window.removeEventListener('pointerup', release, true); window.removeEventListener('pointercancel', release, true); window.removeEventListener('lostpointercapture', release, true);
      window.removeEventListener('compositionstart', start, true); window.removeEventListener('compositionend', end, true); };
  }, [session]);
  useEffect(() => { if (bodyId !== null && (!selected || selected.reference.bodyId !== bodyId)) { current.current.bodyId = null; setBodyId(null); clearError(); } }, [bodyId, snapshot.selectedBodyId, snapshot.view, snapshot.editTarget, snapshot.disposed]);
  useEffect(() => { clearError(); }, [snapshot.generation]);
  useEffect(() => { current.current.bodyId = null; setBodyId(null); gesture.current = false; current.current.onGestureChange?.(false); setIdleAxis('u'); clearError(); }, [session]);
  return <Context.Provider value={{ session, active: bodyId !== null, isActive, axis, currentAxis, raw, error, setAxis, stage: value => { stageRaw(value); }, create, discard, done, open, allowed, report,
    noteError: fault => { diagnostic.current = fault; setError(message(fault)); }, gesture,
    onGestureChange: active => { gesture.current = active; current.current.onGestureChange?.(active); refresh(value => value + 1); }, viewport }}>{children}</Context.Provider>;
}
export function SurfaceIsoCurveControls({ session }: { session: CadEditorSession }) {
  const mode = useSurfaceIsoCurve(), snapshot = useCadEditorSnapshot(session), id = useId(), composing = useRef(false);
  const [helpOpen, setHelpOpen] = useState(false), canvas = mode?.viewport.current?.canvas;
  useEffect(() => { setHelpOpen(false); }, [session, snapshot.generation, snapshot.selectedBodyId, snapshot.view.kind, mode?.active]);
  useEffect(() => { if (!canvas) return; const visible = () => { if (!canvas.isConnected || !canvas.getClientRects().length || canvas.getBoundingClientRect().width <= 0
    || ['hidden', 'collapse'].includes(getComputedStyle(canvas).visibility)) setHelpOpen(false); };
    const resize = new ResizeObserver(visible), mutation = new MutationObserver(visible); resize.observe(canvas);
    mutation.observe(document.documentElement, { attributes: true, childList: true, subtree: true }); return () => { resize.disconnect(); mutation.disconnect(); }; }, [canvas]);
  let selected: ReturnType<typeof surfaceIsoCurveSurface> = null; try { selected = surfaceIsoCurveSurface(session); } catch {}
  if (!mode || mode.session !== session || !selected) return null;
  const foreign = Object.keys(snapshot.pending).some(key => !keys.includes(key));
  const busy = snapshot.disposed || snapshot.candidate !== null || snapshot.selectionTransition !== null || mode.gesture.current || !mode.allowed(true);
  function action(run: () => void, allowComposition = false, entering = false) {
    try { const now = surfaceIsoCurveSurface(session);
      if (!mode!.allowed(allowComposition) || !now || mode!.currentAxis() !== mode!.axis || (entering ? mode!.isActive() : !mode!.isActive())
        || now.snapshot.generation !== snapshot.generation || now.snapshot.displayGeneration !== snapshot.displayGeneration
        || !same(now.snapshot.pending, snapshot.pending) || !same(now.reference, selected!.reference) || now.source !== selected!.source
        || !same(now.domain, selected!.domain) || !same(now.snapshot.selection, snapshot.selection) || !same(now.snapshot.curveSelection, snapshot.curveSelection))
        throw new CadEditorError('STALE', 'The Surface changed. Review the parameter.', { field: 'surface-isocurve' });
      run();
    } catch (cause) { mode!.report(cause); }
  }
  return <div className="surface-isocurve-panel">{!mode.active
    ? <Button type="button" variant="outline" size="sm" data-testid="surface-isocurve-open" disabled={busy || foreign} onClick={() => action(mode.open, false, true)}>Create iso-Curve</Button>
    : <div data-testid="surface-isocurve-mode" className="surface-isocurve-mode">
      <div className="cad-editor-inspector-title"><h3 className="cad-editor-heading">Create iso-Curve</h3><Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogTrigger asChild><Button type="button" variant="ghost" size="xs" data-testid="surface-isocurve-help" disabled={mode.gesture.current}>Help</Button></DialogTrigger>
        <DialogContent className="cad-editor-help-dialog" data-testid="surface-isocurve-help-dialog"><DialogHeader><DialogTitle>Surface iso-Curve</DialogTitle><DialogDescription>Create an independent Curve from an original Surface.</DialogDescription></DialogHeader>
          <div className="cad-editor-help-body"><p>U fixes the U parameter and creates a Curve along V. V fixes V and creates a Curve along U. Choose inside the inclusive original domain, including either endpoint.</p>
            <p>Drag chooses among 65 original Surface D0 stations at the opposite-axis midpoint. The guide uses 65 D0 observations along the iso-Curve. Placement is approximate, with no occlusion or adaptive accuracy certificate; use the field for exact values or overlapping stations.</p>
            <p>Only guides and pending text change during drag. Release creates one native candidate. Escape restores only the owned parameter; foreign raw or candidates are retained. Create again makes another independent Curve even at the same parameter.</p>
            <p>The original complete Surface Source, siblings, IDs and asset revision remain unchanged. Generated native Curve Source is stored in a new asset and body. The Curve is a saved snapshot, not a live parent-dependent feature. Hide a body when all four display places are used; creation never evicts one.</p>
            <p>Current native extraction requires both degrees 1–3, a grid of 2–16 per axis and at most 256 poles, XYZ within ±10000 mm, and weights from 0.000001 to 1000000. Wide degree 4/5 point editing does not imply iso-Curve support. Native document, source, file and history budgets still apply. Local observations do not certify global equivalence, topology, a Face or a Solid.</p>
            <details className="cad-editor-source"><summary className="cad-editor-source-title">Native and source details</summary><pre>{JSON.stringify({ reference: selected.reference, domain: selected.domain, pending: snapshot.pending,
              creation: snapshot.lastSurfaceIsoCurve, history: snapshot.history, error: mode.error }, null, 2)}</pre></details>
          </div><DialogClose asChild><Button type="button" variant="outline" className="cad-editor-export-close" data-testid="surface-isocurve-help-close">Close help</Button></DialogClose>
        </DialogContent></Dialog></div>
      <div className="cad-editor-field"><Label htmlFor={id + '-axis'}>Axis</Label><select id={id + '-axis'} data-testid="surface-isocurve-axis" value={mode.axis}
        disabled={busy || foreign || Object.keys(snapshot.pending).length > 0} onChange={event => action(() => mode.setAxis(event.target.value as Axis))}><option value="u">U</option><option value="v">V</option></select></div>
      <div className="cad-editor-field"><Label htmlFor={id + '-parameter'}>Parameter</Label><Input id={id + '-parameter'} data-testid="surface-isocurve-parameter" type="text" inputMode="decimal"
        value={mode.raw} disabled={busy || foreign} onChange={event => action(() => mode.stage(event.target.value), true)}
        onCompositionStart={() => { composing.current = true; }} onCompositionEnd={() => { composing.current = false; }}
        onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); }
          if (event.key === 'Enter' && !composing.current && !event.nativeEvent.isComposing && event.keyCode !== 229 && !event.repeat
            && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) { event.preventDefault(); event.stopPropagation(); action(mode.create); } }} /></div>
      {mode.error && <p role="alert" data-testid="surface-isocurve-error">{mode.error}</p>}
      <div className="cad-editor-actions"><Button type="button" data-testid="surface-isocurve-create" disabled={busy || foreign} onClick={() => action(mode.create)}>Create</Button>
        <Button type="button" variant="outline" data-testid="surface-isocurve-discard" disabled={busy || foreign || !Object.keys(snapshot.pending).length} onClick={() => action(mode.discard)}>Discard</Button>
        <Button type="button" variant="ghost" data-testid="surface-isocurve-done" disabled={busy || Object.keys(snapshot.pending).length > 0} onClick={() => action(mode.done)}>Done</Button></div>
    </div>}</div>;
}
