import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { SplinePointer } from 'lucide-react';
import { createCadGeometryReference, curveDomain } from '@barocss/cad';
import { CadEditorError, type CadEditorSession } from '../types.js';
import type { CadEditorDisplayReceipt, CadEditorCurvePresentationReceipt } from './types.js';
import { useCadEditorSnapshot } from './use-session.js';
import { sameIntervalData, useCurveInterval } from './curve-interval.js';
import { useSurfaceKnot } from './surface-knot.js';
import { Button } from './ui/button.js';
import { Input } from './ui/input.js';
import { Label } from './ui/label.js';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog.js';

const knotKeys = ['curveKnot'];
const numberText = (value: number) => Object.is(value, -0) ? '-0' : String(value);
export function curveKnotCurve(session: CadEditorSession) {
  const snapshot = session.getSnapshot();
  if (snapshot.disposed || snapshot.selectedBodyId === null || snapshot.editTarget !== 'pole' || snapshot.view.kind === 'curve-focus' && snapshot.view.bodyId !== snapshot.selectedBodyId) return null;
  const resolved = createCadGeometryReference(snapshot.accepted, { bodyId: snapshot.selectedBodyId });
  if (resolved.geometry.kind !== 'curve') return null;
  return { snapshot, reference: resolved.reference, curve: resolved.geometry, source: resolved.source, domain: curveDomain(resolved.geometry) };
}
interface Mode {
  session: CadEditorSession; active: boolean; isActive: () => boolean; raw: string; error: string | null;
  stage: (raw: string) => void; insert: () => void; discard: () => void; done: () => void;
  open: () => void; allowed: (allowFieldComposition?: boolean) => boolean; report: (cause: unknown) => void; noteError: (error: CadEditorError) => void;
  gesture: { current: boolean }; onGestureChange: (active: boolean) => void;
  viewport: { current: { canvas: HTMLCanvasElement | null; documentReceipt: CadEditorDisplayReceipt | null; focusReceipt: CadEditorCurvePresentationReceipt | null; isCurrentCurve: () => boolean } | null };
}
const Context = createContext<Mode | null>(null);
export function useCurveKnot() { return useContext(Context); }
function message(error: CadEditorError) {
  if (error.context.field === 'restore-frame') return 'Cannot restore the current view. Reopen the viewport.';
  if (error.code === 'DISPLAY') return 'Cannot display this insertion. The current Curve is retained.';
  if (error.code === 'STALE') return 'The Curve or draft changed. Review the parameter.';
  if (error.code === 'BUDGET') return 'This insertion exceeds current native or display capacity. Choose another parameter or Curve.';
  return 'Choose an interior parameter with available knot multiplicity. Open Help for details.';
}
/** UI mode only. The shared session owns every staged parameter and its native binding. */
export function CurveKnotProvider({ session, onError, onGestureChange, children }: { session: CadEditorSession; onError?: (error: CadEditorError) => void; onGestureChange?: (active: boolean) => void; children: ReactNode }) {
  const interval = useCurveInterval(), surfaceMode = useSurfaceKnot();
  const snapshot = useCadEditorSnapshot(session), [bodyId, setBodyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null), [, refresh] = useState(0);
  const gesture = useRef(false), viewport = useRef<Mode['viewport']['current']>(null), pointers = useRef(new Set<number>());
  const composition = useRef<EventTarget | null>(null), diagnostic = useRef<CadEditorError | null>(null);
  const current = useRef({ session, onError, onGestureChange, bodyId }); current.current = { session, onError, onGestureChange, bodyId };
  let selected: ReturnType<typeof curveKnotCurve> = null; try { selected = curveKnotCurve(session); } catch {}
  const bounds = selected?.domain, raw = snapshot.pending.curveKnot ?? (bounds ? numberText(bounds[0] / 2 + bounds[1] / 2) : '');
  function captured(id: number) { return [document.documentElement, ...document.querySelectorAll('*')].some(element => element.hasPointerCapture(id)); }
  function allowed(allowFieldComposition = false) {
    const owner = current.current, frame = viewport.current, canvas = frame?.canvas, rect = canvas?.getBoundingClientRect();
    const composingField = composition.current instanceof Element && composition.current.closest('[data-testid="curve-knot-parameter"]') !== null
      && composition.current.closest('.cad-editor') === canvas?.closest('.cad-editor');
    return owner.session === session && !gesture.current && (!composition.current || allowFieldComposition && composingField)
      && !interval?.active && !surfaceMode?.active && !!(frame?.documentReceipt || frame?.focusReceipt) && frame.isCurrentCurve() && canvas?.isConnected === true && canvas.getClientRects().length > 0
      && !!rect && rect.width > 0 && rect.height > 0 && !['hidden', 'collapse'].includes(getComputedStyle(canvas).visibility)
      && !canvas.closest('[data-direct-host-busy="true"],[data-panel-resizing="true"]') && ![...pointers.current].some(captured)
      && document.querySelector('[role="dialog"][data-state="open"],[role="menu"]') === null;
  }
  function report(cause: unknown) {
    const fault = cause instanceof CadEditorError ? cause : new CadEditorError('INPUT', cause instanceof Error ? cause.message : 'The insertion was refused.', { field: 'curve-knot' }, cause);
    diagnostic.current = fault; setError(message(fault)); try { current.current.onError?.(fault); } catch {}
  }
  function clearError() { diagnostic.current = null; setError(null); }
  function target(allowComposition = false, allowInactive = false) {
    const data = curveKnotCurve(session), owner = current.current;
    if (!allowed(allowComposition) || !data || data.snapshot.candidate || data.snapshot.selectionTransition
      || !allowInactive && owner.bodyId === null
      || owner.bodyId !== null && data.reference.bodyId !== owner.bodyId)
      throw new CadEditorError('STALE', 'The current Curve presentation changed.', { field: 'curve-knot' });
    return data;
  }
  function open() {
    try { const data = target(false, true); if (current.current.bodyId !== null || Object.keys(data.snapshot.pending).some(key => !knotKeys.includes(key))) return;
      current.current.bodyId = data.reference.bodyId; setBodyId(data.reference.bodyId); clearError(); } catch (cause) { report(cause); }
  }
  function stageRaw(text: string): boolean {
    try {
      const before = target(true), key = 'curveKnot', expected = { ...before.snapshot.pending };
      if (Object.keys(expected).some(field => field !== key)) throw new CadEditorError('INPUT', 'Resolve other fields before inserting a knot.', { field: 'curve-knot' });
      if (text === '') delete expected[key]; else expected[key] = text;
      session.stageCurveKnotField(text);
      const after = target(true);
      if (after.snapshot.generation !== before.snapshot.generation || after.snapshot.displayGeneration !== before.snapshot.displayGeneration
        || !sameIntervalData(after.reference, before.reference) || after.source !== before.source || !sameIntervalData(after.snapshot.pending, expected))
        throw new CadEditorError('STALE', 'The parameter changed during staging. Review the draft.', { field: 'curve-knot' });
      clearError(); return true;
    } catch (cause) { report(cause); return false; }
  }
  function insert() {
    try {
      let before = target();
      if (!Object.keys(before.snapshot.pending).length) {
        const range = before.domain;
        if (!stageRaw(numberText(range[0] / 2 + range[1] / 2))) return;
        before = target();
      }
      const proposed = session.prepareApply(), after = session.getSnapshot();
      if (after.generation !== before.snapshot.generation || after.displayGeneration !== before.snapshot.displayGeneration
        || proposed && after.candidate?.token !== proposed.token || !sameIntervalData(after.pending, before.snapshot.pending)
        || after.selectedBodyId !== before.snapshot.selectedBodyId || after.editTarget !== before.snapshot.editTarget
        || after.selectionTransition !== null || !sameIntervalData(after.curveSelection, before.snapshot.curveSelection) || !allowed()) {
        if (proposed && session.getSnapshot().candidate?.token === proposed.token) session.cancelCandidate(proposed.token);
        throw new CadEditorError('STALE', 'The insertion changed during preparation. Review the draft.', { field: 'curve-knot' });
      }
      clearError();
    } catch (cause) { report(cause); }
  }
  function discard() {
    try { const before = target(); if (Object.keys(before.snapshot.pending).some(key => !knotKeys.includes(key))) return;
      session.discardPending(); const after = target();
      if (Object.keys(after.snapshot.pending).length) throw new CadEditorError('STALE', 'The draft changed during Discard.', { field: 'curve-knot' });
      clearError(); } catch (cause) { report(cause); }
  }
  function done() { try { const data = target(); if (Object.keys(data.snapshot.pending).length) return; current.current.bodyId = null; setBodyId(null); clearError(); } catch (cause) { report(cause); } }
  useEffect(() => {
    let live = true;
    const down = (event: PointerEvent) => { pointers.current.add(event.pointerId); };
    const release = (event: PointerEvent) => { if (!captured(event.pointerId)) pointers.current.delete(event.pointerId);
      setTimeout(() => { if (live && !captured(event.pointerId)) pointers.current.delete(event.pointerId); }, 0); };
    const start = (event: Event) => { composition.current = event.target; refresh(value => value + 1); }, end = () => { composition.current = null; refresh(value => value + 1); };
    window.addEventListener('pointerdown', down, true); window.addEventListener('pointerup', release, true); window.addEventListener('pointercancel', release, true);
    window.addEventListener('lostpointercapture', release, true); window.addEventListener('compositionstart', start, true); window.addEventListener('compositionend', end, true);
    return () => { live = false; pointers.current.clear(); composition.current = null;
      window.removeEventListener('pointerdown', down, true); window.removeEventListener('pointerup', release, true); window.removeEventListener('pointercancel', release, true);
      window.removeEventListener('lostpointercapture', release, true); window.removeEventListener('compositionstart', start, true); window.removeEventListener('compositionend', end, true); };
  }, [session]);
  useEffect(() => { if (bodyId !== null && (!selected || selected.reference.bodyId !== bodyId)) { setBodyId(null); clearError(); } }, [bodyId, snapshot.selectedBodyId, snapshot.view, snapshot.editTarget, snapshot.disposed]);
  useEffect(() => { clearError(); }, [snapshot.generation]);
  useEffect(() => { setBodyId(null); gesture.current = false; current.current.onGestureChange?.(false); clearError(); }, [session]);
  return <Context.Provider value={{ session, active: bodyId !== null, isActive: () => current.current.bodyId !== null, raw, error, stage: text => { stageRaw(text); }, insert, discard, done, open, allowed, report,
    noteError: fault => { diagnostic.current = fault; setError(message(fault)); }, gesture,
    onGestureChange: active => { gesture.current = active; current.current.onGestureChange?.(active); refresh(value => value + 1); }, viewport }}>{children}</Context.Provider>;
}

export function CurveKnotControls({ session }: { session: CadEditorSession }) {
  const mode = useCurveKnot(), snapshot = useCadEditorSnapshot(session), id = useId(), composing = useRef(false);
  const [helpOpen, setHelpOpen] = useState(false), canvas = mode?.viewport.current?.canvas;
  useEffect(() => { setHelpOpen(false); }, [session, snapshot.generation, snapshot.selectedBodyId, snapshot.view.kind, mode?.active]);
  useEffect(() => {
    if (!canvas) return;
    const visible = () => { if (!canvas.isConnected || !canvas.getClientRects().length || canvas.getBoundingClientRect().width <= 0
      || ['hidden', 'collapse'].includes(getComputedStyle(canvas).visibility)) setHelpOpen(false); };
    const observer = new ResizeObserver(visible); observer.observe(canvas);
    const mutation = new MutationObserver(visible); mutation.observe(document.documentElement, { attributes: true, childList: true, subtree: true });
    return () => { observer.disconnect(); mutation.disconnect(); };
  }, [canvas]);
  let selected: ReturnType<typeof curveKnotCurve> = null; try { selected = curveKnotCurve(session); } catch {}
  if (!mode || mode.session !== session || !selected) return null;
  const foreign = Object.keys(snapshot.pending).some(key => !knotKeys.includes(key));
  const busy = snapshot.disposed || snapshot.candidate !== null || snapshot.selectionTransition !== null || mode.gesture.current || !mode.allowed(true);
  function action(run: () => void, allowComposition = false, entering = false) {
    try { const now = curveKnotCurve(session);
      if (!mode!.allowed(allowComposition) || !now || !entering && !mode!.active
        || now.snapshot.generation !== snapshot.generation || now.snapshot.displayGeneration !== snapshot.displayGeneration
        || !sameIntervalData(now.snapshot.pending, snapshot.pending)
        || !sameIntervalData(now.reference, selected!.reference) || now.source !== selected!.source || !sameIntervalData(now.domain, selected!.domain))
        throw new CadEditorError('STALE', 'The Curve changed. Review the current parameter.', { field: 'curve-knot' });
      run(); } catch (cause) { mode!.report(cause); }
  }
  return <div className="curve-knot-panel">
    {!mode.active ? <Button type="button" variant="outline" size="sm" data-testid="curve-knot-open" className="cad-editor-operation-icon" aria-label="Insert knot" title="Insert knot" disabled={busy || foreign}
      onClick={() => action(mode.open, false, true)}><SplinePointer size={16} aria-hidden="true" /></Button> : <div data-testid="curve-knot-mode">
      <div className="cad-editor-inspector-title"><h3 className="cad-editor-heading">Insert knot</h3><Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogTrigger asChild><Button type="button" variant="ghost" size="xs" data-testid="curve-knot-help" disabled={mode.gesture.current}>Help</Button></DialogTrigger>
        <DialogContent className="cad-editor-help-dialog" data-testid="curve-knot-help-dialog"><DialogHeader><DialogTitle>Original Curve knot</DialogTitle>
          <DialogDescription>Refine the original Curve without editing a display mesh.</DialogDescription></DialogHeader>
          <div className="cad-editor-help-body"><p data-testid="curve-knot-domain">Original domain: {numberText(selected.domain[0])} to {numberText(selected.domain[1])}</p>
            <p>Choose an original parameter. Drag selects among 65 forward-projected native D0 stations; this is approximate placement. Type an exact value for refinement. Overlapping or offscreen stations need the field. The marker is a parameter guide, not a control coefficient or certified pick.</p>
            <p>Native insertion uses a strict interior parameter and adds one knot. Existing knot equality requests another multiplicity; it is not a no-op. The current provider supports degree 1–5, at most 63 original poles, 64 refined poles and 70 knots. Final multiplicity cannot exceed degree. Its coordinate profile is ±10000 mm, separately from wider point editing.</p>
            <p>The complete Source0, up to 16 objects and 262144 UTF-8 bytes and code units, remains authority. The native writer and whole validator preserve names, IDs, siblings, degree and original domain. Successful native data still needs actual full-source display admission. These current requirements do not define the final modeling scope.</p>
            <p>Current document Curve display uses degree 1–3 adaptive sampling. Optional focus supports degree 1–5 with a complete Model of 1–4 objects and at most 65536 UTF-8 bytes and code units. These display profiles are separate from native insertion. No smaller source or synthetic focus receipt is used to bypass them.</p>
            <p>Held movement changes only the pending guide. Release prepares one insertion. Escape or pointer cancellation restores only the gesture-owned field. Foreign raw is retained. Apply or discard before changing selection; Enter inserts only outside text composition. Tab does not insert.</p>
            <p>Insertion and its Undo/Redo boundary clear the affected original point selection because the coefficients change. Done keeps the body selected. Use Select a point to choose a new original point explicitly. Document view retains its actual qualified body binding. Optional focus retains its actual complete-source uniform preview; no focused receipt is manufactured for document view. The file contains refined coefficients, not the pending guide, recipe or editor history. Native local observations are not a global geometry, topology or Solid certificate.</p>
            <details className="cad-editor-source"><summary className="cad-editor-source-title">Native details</summary><pre>{JSON.stringify({ reference: selected.reference, domain: selected.domain,
              pending: snapshot.pending, insertion: snapshot.lastCurveKnot }, null, 2)}</pre></details>
          </div><DialogClose asChild><Button type="button" variant="outline" className="cad-editor-export-close" data-testid="curve-knot-help-close">Close help</Button></DialogClose>
        </DialogContent></Dialog></div>
      <div className="cad-editor-field"><Label htmlFor={id}>Parameter</Label><Input id={id} type="text" inputMode="decimal" data-testid="curve-knot-parameter"
        value={mode.raw} disabled={busy || foreign} onChange={event => action(() => mode.stage(event.target.value), true)}
        onCompositionStart={() => { composing.current = true; }} onCompositionEnd={() => { composing.current = false; }}
        onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); }
          if (event.key === 'Enter' && !event.repeat && !event.nativeEvent.isComposing && event.keyCode !== 229 && !composing.current
            && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) { event.preventDefault(); event.stopPropagation(); action(mode.insert); } }} /></div>
      {mode.error && <p role="alert" data-testid="curve-knot-error">{mode.error}</p>}
      <div className="cad-editor-actions"><Button type="button" data-testid="curve-knot-confirm" disabled={busy || foreign || !mode.allowed()} onClick={() => action(mode.insert)}>Insert</Button>
        <Button type="button" variant="outline" data-testid="curve-knot-discard" disabled={busy || foreign || !Object.keys(snapshot.pending).length} onClick={() => action(mode.discard)}>Discard</Button>
        <Button type="button" variant="ghost" data-testid="curve-knot-done" disabled={busy || Object.keys(snapshot.pending).length > 0} onClick={() => action(mode.done)}>Done</Button></div>
    </div>}
  </div>;
}
