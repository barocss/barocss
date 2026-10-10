import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createCadGeometryReference, curveDomain, type Curve } from '@barocss/cad';
import { CadEditorError, type CadEditorSession } from '../types.js';
import type { CadEditorCurvePresentationReceipt } from './types.js';
import { useCadEditorSnapshot } from './use-session.js';
import { Button } from './ui/button.js';
import { Input } from './ui/input.js';
import { Label } from './ui/label.js';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog.js';

export function sameIntervalData(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const x = a as Record<string, unknown>, y = b as Record<string, unknown>, keys = Object.keys(x);
  return keys.length === Object.keys(y).length && keys.every(key => Object.hasOwn(y, key) && sameIntervalData(x[key], y[key]));
}
export const intervalNumberText = (value: number) => Object.is(value, -0) ? '-0' : String(value);
export function intervalValue(raw: string | undefined, fallback: number): number | null {
  if (raw === undefined) return fallback;
  const value = raw.trim();
  return raw.length <= 128 && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value) && Number.isFinite(Number(value)) ? Number(value) : null;
}
interface Controller {
  session: CadEditorSession; bodyId: string | null; active: boolean; gesturing: boolean;
  gesture: { current: boolean }; error: string | null;
  viewport: { current: { canvas: HTMLCanvasElement | null; presentation: CadEditorCurvePresentationReceipt | null; isCurrent: (receipt: CadEditorCurvePresentationReceipt) => boolean } | null };
  allowed: () => boolean;
  open: () => void; done: () => void; clearError: () => void; noteError: (error: CadEditorError) => void; setGesture: (active: boolean) => void; report: (cause: unknown) => void;
}
const IntervalContext = createContext<Controller | null>(null);
export function useCurveInterval() { return useContext(IntervalContext); }
function message(error: CadEditorError) {
  if (error.context.field === 'restore-frame') return 'Cannot restore the current view. Reopen the viewport.';
  if (error.code === 'DISPLAY') return 'Cannot display this interval. The current Curve is retained.';
  if (error.code === 'STALE') return 'The Curve or draft changed. Review the interval values.';
  if (error.code === 'BUDGET') return 'This interval exceeds the native or display limits. Choose another interval.';
  return 'Choose increasing parameters inside the current domain, with at least one endpoint restricted.';
}
export function intervalCurve(session: CadEditorSession, bodyId: string | null) {
  const snapshot = session.getSnapshot();
  if (!bodyId || snapshot.selectedBodyId !== bodyId || snapshot.disposed || snapshot.editTarget !== 'pole'
    || snapshot.view.kind !== 'curve-focus' || snapshot.view.bodyId !== bodyId) return null;
  const resolved = createCadGeometryReference(snapshot.accepted, { bodyId });
  if (resolved.geometry.kind !== 'curve') return null;
  return { snapshot, reference: resolved.reference, curve: resolved.geometry as Curve, source: resolved.source, domain: curveDomain(resolved.geometry) };
}
/** The mode is UI intent only. All interval text belongs to the shared Root pending record. */
export function CurveIntervalProvider({ session, onError, children }: { session: CadEditorSession; onError?: (error: CadEditorError) => void; children: ReactNode }) {
  const snapshot = useCadEditorSnapshot(session), [bodyId, setBodyId] = useState<string | null>(null), [gesturing, setGesturing] = useState(false), [error, setError] = useState<string | null>(null);
  const gesture = useRef(false), viewport = useRef<Controller['viewport']['current']>(null), pointers = useRef(new Set<number>()), current = useRef({ session, onError }); current.current = { session, onError };
  function report(cause: unknown) { const fault = cause instanceof CadEditorError ? cause : new CadEditorError('INPUT', cause instanceof Error ? cause.message : 'The interval action was refused.', { field: 'curve-interval' }, cause);
    setError(message(fault)); try { current.current.onError?.(fault); } catch {} }
  function captured(id: number) { return [document.documentElement, ...document.querySelectorAll('*')].some(element => element.hasPointerCapture(id)); }
  function allowed() {
    const frame = viewport.current, canvas = frame?.canvas, rect = canvas?.getBoundingClientRect();
    return !gesture.current && current.current.session === session && !!frame?.presentation && frame.isCurrent(frame.presentation)
      && canvas?.isConnected === true && canvas.getClientRects().length > 0 && !!rect && rect.width > 0 && rect.height > 0
      && !['hidden', 'collapse'].includes(getComputedStyle(canvas).visibility)
      && !canvas.closest('[data-direct-host-busy="true"],[data-panel-resizing="true"]')
      && ![...pointers.current].some(captured) && document.querySelector('[role="dialog"][data-state="open"],[role="menu"]') === null;
  }
  useEffect(() => {
    let live = true;
    const down = (event: PointerEvent) => { pointers.current.add(event.pointerId); };
    const release = (event: PointerEvent) => { if (!captured(event.pointerId)) pointers.current.delete(event.pointerId);
      setTimeout(() => { if (live && !captured(event.pointerId)) pointers.current.delete(event.pointerId); }, 0); };
    window.addEventListener('pointerdown', down, true); window.addEventListener('pointerup', release, true); window.addEventListener('pointercancel', release, true); window.addEventListener('lostpointercapture', release, true);
    return () => { live = false; pointers.current.clear(); window.removeEventListener('pointerdown', down, true); window.removeEventListener('pointerup', release, true);
      window.removeEventListener('pointercancel', release, true); window.removeEventListener('lostpointercapture', release, true); };
  }, [session]);
  function open() {
    const now = session.getSnapshot();
    if (!allowed() || now.disposed || now.candidate || now.selectionTransition || gesture.current
      || Object.keys(now.pending).some(key => key !== 'intervalMin' && key !== 'intervalMax')) return;
    try {
      const selected = intervalCurve(session, now.selectedBodyId); if (!selected) return;
      if (now.view.kind === 'curve-focus' && now.view.count !== 65) session.prepareCurveFocus(selected.reference.bodyId, 65);
      setBodyId(selected.reference.bodyId); setError(null);
    } catch (cause) { report(cause); }
  }
  function done() { const now = session.getSnapshot(); if (!allowed() || now.candidate || gesture.current || Object.keys(now.pending).length) return; setBodyId(null); setError(null); }
  useEffect(() => {
    if (bodyId && (snapshot.disposed || snapshot.selectedBodyId !== bodyId || snapshot.view.kind !== 'curve-focus'
      || snapshot.view.bodyId !== bodyId || snapshot.editTarget !== 'pole')) { setBodyId(null); setError(null); }
  }, [session, snapshot.selectedBodyId, snapshot.view, snapshot.editTarget, snapshot.disposed, bodyId]);
  useEffect(() => { setError(null); }, [snapshot.generation]);
  useEffect(() => { setBodyId(null); gesture.current = false; setGesturing(false); setError(null); }, [session]);
  return <IntervalContext.Provider value={{ session, bodyId, active: bodyId !== null, gesturing, gesture, viewport, allowed, error, open, done, clearError: () => setError(null), noteError: error => setError(message(error)),
    setGesture: active => { gesture.current = active; setGesturing(active); }, report }}>{children}</IntervalContext.Provider>;
}
export function CurveIntervalControls({ session }: { session: CadEditorSession }) {
  const controller = useCurveInterval(), snapshot = useCadEditorSnapshot(session), id = useId(), composing = useRef(new Set<string>());
  const [diagnostic, setDiagnostic] = useState<CadEditorError | null>(null), lastAttempt = useRef<string | null>(null);
  useEffect(() => { setDiagnostic(null); }, [session, snapshot.generation]);
  if (!controller || controller.session !== session) return null;
  let selected: ReturnType<typeof intervalCurve> = null;
  try { selected = intervalCurve(session, controller.active ? controller.bodyId : snapshot.selectedBodyId); } catch { /* Native refusal is shown on explicit entry. */ }
  const disabled = snapshot.disposed || !!snapshot.candidate || !!snapshot.selectionTransition || controller.gesturing;
  const foreign = Object.keys(snapshot.pending).some(key => key !== 'intervalMin' && key !== 'intervalMax');
  function fail(cause: unknown) { const fault = cause instanceof CadEditorError ? cause : new CadEditorError('INPUT', 'The interval action was refused.', { field: 'curve-interval' }, cause); setDiagnostic(fault); controller!.report(fault); }
  function assertCurrent() {
    const current = intervalCurve(session, controller!.active ? controller!.bodyId : snapshot.selectedBodyId);
    if (!controller!.allowed() || !selected || !current || snapshot.generation !== current.snapshot.generation
      || snapshot.displayGeneration !== current.snapshot.displayGeneration || !sameIntervalData(selected.reference, current.reference)
      || selected.source !== current.source || !sameIntervalData(selected.domain, current.domain))
      throw new CadEditorError('STALE', 'The Curve or current presentation changed. Review the interval.', { field: 'curve-interval' });
    return current;
  }
  function stage(field: 'min' | 'max', raw: string) {
    try { const before = assertCurrent(), key = field === 'min' ? 'intervalMin' : 'intervalMax', expected = { ...before.snapshot.pending };
      if (Object.is(intervalValue(raw, before.domain[field === 'min' ? 0 : 1]), before.domain[field === 'min' ? 0 : 1])) delete expected[key]; else expected[key] = raw;
      session.stageCurveIntervalField(field, raw);
      const after = intervalCurve(session, controller!.bodyId);
      if (!after || !controller!.allowed() || !sameIntervalData(after.reference, before.reference)
        || after.snapshot.generation !== before.snapshot.generation || after.snapshot.displayGeneration !== before.snapshot.displayGeneration
        || !sameIntervalData(after.snapshot.pending, expected))
        throw new CadEditorError('STALE', 'The interval changed during staging. Review the values.', { field: 'curve-interval' });
      setDiagnostic(null); controller!.clearError();
    } catch (cause) { fail(cause); }
  }
  function apply() {
    const now = session.getSnapshot(); if (controller!.gesture.current || now.candidate || now.selectionTransition || now.disposed || foreign) return;
    try { assertCurrent(); const candidate = session.prepareApply(); lastAttempt.current = candidate?.token ?? null; setDiagnostic(null); controller!.clearError(); }
    catch (cause) { fail(cause); }
  }
  return <div className="curve-interval-panel">
    {!controller.active ? <Button type="button" variant="outline" size="sm" data-testid="curve-interval-open" disabled={disabled || foreign || !selected}
      onClick={() => { try { assertCurrent(); controller.open(); setDiagnostic(null); } catch (cause) { fail(cause); } }}>Restrict interval</Button>
      : <div data-testid="curve-interval-mode" className="curve-interval-toolbar">
        <div className="cad-editor-inspector-title"><h3 className="cad-editor-heading">Curve interval</h3><Dialog>
          <DialogTrigger asChild><Button type="button" variant="ghost" size="xs" data-testid="curve-interval-help" disabled={controller.gesturing}>Help</Button></DialogTrigger>
          <DialogContent className="cad-editor-help-dialog" data-testid="curve-interval-help-dialog"><DialogHeader><DialogTitle>Original Curve interval</DialogTitle><DialogDescription>Restrict the current Curve using its original parameters.</DialogDescription></DialogHeader>
            <div className="cad-editor-help-body"><p>Drag among 65 sampled original parameters, or type exact values. Screen-nearest choices are approximate; overlapping or hidden samples need the fields. Samples are native D0 observations, not control coefficients or an adaptive accuracy certificate.</p>
              <p>Use increasing values inside the current native domain. At least one endpoint must be restricted. Full-domain requests are refused by the native operation. An unchanged empty editor draft sends no command.</p>
              <p>Only pending endpoint guides change while held. Release prepares one actual interval change. Escape or pointer cancellation restores only its owned endpoint text and preserves the other interval field and unrelated drafts.</p>
              <p>The native operation retains complete Source0, IDs, Models and siblings. Its temporary insertion and output limits can refuse a request even if the final interval is small. Native degree 1–5, 64 poles, 70 knots, selected coordinates within ±10000 mm and native source bounds are independent of the narrower focused display.</p>
              <p>Undo restores the old extent while live history exists. Pole selections are cleared across interval history because coefficients and counts change. Save contains the current restricted canonical source; fresh Open does not restore discarded extent or a parametric trim recipe. This is not a trimmed Face or Solid operation.</p>
              <details className="cad-editor-source"><summary className="cad-editor-source-title">Native and source details</summary><pre>{JSON.stringify({ reference: selected?.reference, domain: selected?.domain, pending: snapshot.pending,
                extraction: snapshot.lastCurveInterval, history: snapshot.history, error: diagnostic?.message }, null, 2)}</pre></details>
            </div><DialogClose asChild><Button type="button" variant="outline" className="cad-editor-export-close" data-testid="curve-interval-help-close">Close help</Button></DialogClose>
          </DialogContent></Dialog></div>
        {selected && <p className="curve-interval-domain" data-testid="curve-interval-domain">Current domain: {intervalNumberText(selected.domain[0])} to {intervalNumberText(selected.domain[1])}</p>}
        {selected && (['min', 'max'] as const).map((field, index) => {
          const key = field === 'min' ? 'intervalMin' : 'intervalMax', label = field === 'min' ? 'Start parameter' : 'End parameter';
          return <div className="cad-editor-field" key={field}><Label htmlFor={id + '-' + field}>{label}</Label>
            <Input id={id + '-' + field} data-testid={field === 'min' ? 'curve-interval-start' : 'curve-interval-end'} type="text" inputMode="decimal"
              value={snapshot.pending[key] ?? intervalNumberText(selected.domain[index])} disabled={disabled || foreign}
              onCompositionStart={() => { composing.current.add(field); }} onCompositionEnd={() => { composing.current.delete(field); }}
              onChange={event => stage(field, event.target.value)}
              onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); return; }
                if (event.key === 'Enter' && !event.nativeEvent.isComposing && !composing.current.has(field) && event.keyCode !== 229 && !event.repeat
                  && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) { event.preventDefault(); event.stopPropagation(); apply(); } }} />
          </div>;
        })}
        {(diagnostic || controller.error) && <p role="alert" data-testid="curve-interval-error">{diagnostic ? message(diagnostic) : controller.error}</p>}
        <p className="cad-editor-properties-note">Drag among 65 sampled parameters. Type exact values for refinement.</p>
        <div className="cad-editor-actions"><Button type="button" data-testid="curve-interval-confirm" disabled={disabled || foreign || Object.keys(snapshot.pending).length === 0} onClick={apply}>Apply</Button>
          <Button type="button" variant="outline" data-testid="curve-interval-discard" disabled={disabled || foreign || !Object.keys(snapshot.pending).length}
            onClick={() => { try { const before = assertCurrent(); if (Object.keys(before.snapshot.pending).some(key => key !== 'intervalMin' && key !== 'intervalMax')) return;
              session.discardPending(); const after = assertCurrent();
              if (Object.keys(after.snapshot.pending).length) throw new CadEditorError('STALE', 'The draft changed during Discard. Review the values.', { field: 'curve-interval' });
              setDiagnostic(null); controller!.clearError(); } catch (cause) { fail(cause); } }}>Discard</Button>
          <Button type="button" variant="ghost" data-testid="curve-interval-done" disabled={disabled || Object.keys(snapshot.pending).length > 0}
            onClick={() => { try { assertCurrent(); controller.done(); } catch (cause) { fail(cause); } }}>Done</Button></div>
      </div>}
  </div>;
}
