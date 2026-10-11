import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ScissorsLineDashed } from 'lucide-react';
import { createCadGeometryReference, curveDomain } from '@barocss/cad';
import { CadEditorError, type CadEditorSession } from '../types.js';
import type { CadEditorDisplayReceipt } from './types.js';
import { useCadEditorSnapshot } from './use-session.js';
import { sameIntervalData as same } from './curve-interval.js';
import { Button } from './ui/button.js';
import { Input } from './ui/input.js';
import { Label } from './ui/label.js';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog.js';

export const splitNumber = (value: number) => Object.is(value, -0) ? '-0' : String(value);
export function curveSplitCurve(session: CadEditorSession) {
  const snapshot = session.getSnapshot();
  if (snapshot.disposed || snapshot.selectedBodyId === null || snapshot.view.kind !== 'document' || snapshot.editTarget !== 'pole') return null;
  const resolved = createCadGeometryReference(snapshot.accepted, { bodyId: snapshot.selectedBodyId });
  return resolved.geometry.kind === 'curve' ? { snapshot, reference: resolved.reference, source: resolved.source,
    curve: resolved.geometry, domain: curveDomain(resolved.geometry) } : null;
}
type Data = NonNullable<ReturnType<typeof curveSplitCurve>>;
export const splitRaw = (data: Data) => data.snapshot.pending.curveSplit ?? splitNumber(data.domain[0] / 2 + data.domain[1] / 2);
interface Mode {
  session: CadEditorSession; active: boolean; isActive: () => boolean; raw: string; currentRaw: () => string;
  open: () => void; stage: (raw: string) => void; create: () => void; discard: () => void; done: () => void;
  error: string | null; diagnostic: CadEditorError | null; report: (cause: unknown) => void; noteError: (error: CadEditorError) => void;
  allowed: (fieldComposition?: boolean, ownCandidateToken?: string) => boolean; gesture: { current: boolean }; onGestureChange: (active: boolean) => void;
  viewport: { current: { canvas: HTMLCanvasElement | null; receipt: CadEditorDisplayReceipt | null;
    isCurrentCurve: (receipt?: CadEditorDisplayReceipt, ownCandidateToken?: string) => boolean } | null };
}
const Context = createContext<Mode | null>(null);
export function useCurveSplit() { return useContext(Context); }
function message(error: CadEditorError) {
  if (error.context.field === 'restore-frame') return 'Cannot restore the view. Reopen the viewport.';
  if (error.code === 'STALE') return 'The Curve or draft changed. Review the parameter.';
  if (error.code === 'BUDGET') return 'This split exceeds current capacity. Open Help.';
  if (error.code === 'DISPLAY') return 'Cannot display both Curves. The accepted document is retained.';
  return 'Use an interior parameter. Open Help for native requirements.';
}
function details(error: CadEditorError) {
  const messages = [error.message]; let cause: unknown = error.cause;
  for (let i = 0; i < 6 && cause instanceof Error; i++) { messages.push(cause.message); cause = cause.cause; }
  return messages.join('\n');
}
/** Shared Root raw is the parameter authority; the existing whole Viewer admits the pair. */
export function CurveSplitProvider({ session, onError, onGestureChange, children }: {
  session: CadEditorSession; onError?: (error: CadEditorError) => void; onGestureChange?: (active: boolean) => void; children: ReactNode;
}) {
  const snapshot = useCadEditorSnapshot(session), [bodyId, setBodyId] = useState<string | null>(null), [error, setError] = useState<string | null>(null), [, refresh] = useState(0);
  const current = useRef({ session, bodyId, onError, onGestureChange }); current.current = { session, bodyId, onError, onGestureChange };
  const gesture = useRef(false), viewport = useRef<Mode['viewport']['current']>(null), pointers = useRef(new Set<number>()), composition = useRef<EventTarget | null>(null);
  const diagnostic = useRef<CadEditorError | null>(null);
  let selected: ReturnType<typeof curveSplitCurve> = null; try { selected = curveSplitCurve(session); } catch {}
  const raw = selected ? splitRaw(selected) : '';
  function captured(id: number) { return [document.documentElement, ...document.querySelectorAll('*')].some(element => element.hasPointerCapture(id)); }
  function allowed(fieldComposition = false, ownCandidateToken?: string) {
    const frame = viewport.current, canvas = frame?.canvas, rect = canvas?.getBoundingClientRect();
    const ownComposition = composition.current instanceof Element && composition.current.closest('[data-testid="curve-split-parameter"]') !== null
      && composition.current.closest('.cad-editor') === canvas?.closest('.cad-editor');
    return current.current.session === session && !gesture.current && (!composition.current || fieldComposition && ownComposition)
      && !!frame?.receipt && frame.isCurrentCurve(frame.receipt, ownCandidateToken) && canvas?.isConnected === true && canvas.getClientRects().length > 0
      && !!rect && rect.width > 0 && rect.height > 0 && !['hidden', 'collapse'].includes(getComputedStyle(canvas).visibility)
      && !canvas.closest('[data-direct-host-busy="true"],[data-panel-resizing="true"]') && ![...pointers.current].some(captured)
      && document.querySelector('[role="dialog"][data-state="open"],[role="menu"]') === null;
  }
  function isActive() { return current.current.session === session && current.current.bodyId !== null
    && curveSplitCurve(session)?.reference.bodyId === current.current.bodyId; }
  function currentRaw() { const selected = curveSplitCurve(session); return selected ? splitRaw(selected) : ''; }
  function report(cause: unknown) {
    const fault = cause instanceof CadEditorError ? cause : new CadEditorError('INPUT', cause instanceof Error ? cause.message : 'Curve split was refused.', { field: 'curve-split' }, cause);
    diagnostic.current = fault; setError(message(fault)); try { current.current.onError?.(fault); } catch {}
  }
  function clearError() { diagnostic.current = null; setError(null); }
  function target(fieldComposition = false, entering = false) {
    const data = curveSplitCurve(session);
    if (!allowed(fieldComposition) || !data || data.snapshot.candidate || data.snapshot.selectionTransition
      || (entering ? current.current.bodyId !== null : !isActive()) || Object.keys(data.snapshot.pending).some(key => key !== 'curveSplit'))
      throw new CadEditorError('STALE', 'The original Curve presentation or draft changed.', { field: 'curve-split' });
    return data;
  }
  function sameContext(a: Data, b: Data) {
    return same(a.reference, b.reference) && a.source === b.source && same(a.curve, b.curve) && same(a.domain, b.domain)
      && a.snapshot.generation === b.snapshot.generation && a.snapshot.displayGeneration === b.snapshot.displayGeneration
      && same(a.snapshot.view, b.snapshot.view) && same(a.snapshot.selection, b.snapshot.selection) && same(a.snapshot.curveSelection, b.snapshot.curveSelection)
      && a.snapshot.editTarget === b.snapshot.editTarget && a.snapshot.rotationAxis === b.snapshot.rotationAxis && a.snapshot.scaleAxis === b.snapshot.scaleAxis;
  }
  function open() { try { const data = target(false, true); current.current.bodyId = data.reference.bodyId; setBodyId(data.reference.bodyId); clearError(); } catch (cause) { report(cause); } }
  function stageRaw(text: string) {
    try {
      const before = target(true), frame = viewport.current?.receipt, canvas = viewport.current?.canvas, rect = canvas?.getBoundingClientRect(), expected = { ...before.snapshot.pending };
      const size = [canvas?.width, canvas?.height]; if (text === '') delete expected.curveSplit; else expected.curveSplit = text;
      session.stageCurveSplitField(text); const after = target(true), nextRect = canvas?.getBoundingClientRect();
      if (!sameContext(before, after) || !same(after.snapshot.pending, expected) || !frame || !canvas || !rect || !nextRect
        || viewport.current?.canvas !== canvas || !viewport.current.isCurrentCurve(frame)
        || canvas.width !== size[0] || canvas.height !== size[1] || rect.left !== nextRect.left || rect.top !== nextRect.top || rect.width !== nextRect.width || rect.height !== nextRect.height)
        throw new CadEditorError('STALE', 'The split parameter changed during staging.', { field: 'curve-split' });
      clearError(); return true;
    } catch (cause) { report(cause); return false; }
  }
  function create() {
    let token: string | null = null;
    try {
      let before = target(); if (!Object.keys(before.snapshot.pending).length) { if (!stageRaw(splitRaw(before))) return; before = target(); }
      const frame = viewport.current, canvas = frame?.canvas, receipt = frame?.receipt, rect = canvas?.getBoundingClientRect();
      if (!canvas || !receipt || !rect) throw new CadEditorError('STALE', 'The Canvas is unavailable.', { field: 'curve-split' });
      const size = [canvas.width, canvas.height], proposed = session.prepareApply(); token = proposed?.token ?? null;
      const after = curveSplitCurve(session), nextRect = canvas.getBoundingClientRect();
      if (!proposed || proposed.kind !== 'curve-split' || proposed.baseGeneration !== before.snapshot.generation || proposed.baseDisplayGeneration !== before.snapshot.displayGeneration
        || !after || !sameContext(before, after) || !same(before.snapshot.pending, after.snapshot.pending)
        || after.snapshot.candidate?.token !== proposed.token || after.snapshot.selectionTransition || !isActive()
        || current.current.session !== session || viewport.current?.canvas !== canvas || !viewport.current.isCurrentCurve(receipt, proposed.token)
        || !allowed(false, proposed.token) || canvas.width !== size[0] || canvas.height !== size[1]
        || rect.left !== nextRect.left || rect.top !== nextRect.top || rect.width !== nextRect.width || rect.height !== nextRect.height)
        throw new CadEditorError('STALE', 'The split changed during preparation. Review the draft.', { field: 'curve-split' });
      clearError();
    } catch (cause) { if (token && session.getSnapshot().candidate?.token === token) { try { session.cancelCandidate(token); } catch {} } report(cause); }
  }
  function discard() { try { const before = target(); session.discardPending(); const after = target();
    if (!sameContext(before, after) || Object.keys(after.snapshot.pending).length) throw new CadEditorError('STALE', 'The draft changed during Discard.', { field: 'curve-split' }); clearError(); } catch (cause) { report(cause); } }
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
  useEffect(() => { current.current.bodyId = null; setBodyId(null); gesture.current = false; current.current.onGestureChange?.(false); clearError(); }, [session]);
  return <Context.Provider value={{ session, active: bodyId !== null, isActive, raw, currentRaw, open, stage: text => { stageRaw(text); }, create, discard, done,
    error, diagnostic: diagnostic.current, allowed, report, noteError: fault => { diagnostic.current = fault; setError(message(fault)); }, gesture,
    onGestureChange: active => { gesture.current = active; current.current.onGestureChange?.(active); refresh(value => value + 1); }, viewport }}>{children}</Context.Provider>;
}
export function CurveSplitControls({ session }: { session: CadEditorSession }) {
  const mode = useCurveSplit(), snapshot = useCadEditorSnapshot(session), id = useId(), composing = useRef(false), [helpOpen, setHelpOpen] = useState(false);
  const canvas = mode?.viewport.current?.canvas;
  useEffect(() => { setHelpOpen(false); }, [session, snapshot.generation, snapshot.selectedBodyId, snapshot.view.kind, mode?.active]);
  useEffect(() => { if (!canvas) return; const check = () => { if (!canvas.isConnected || !canvas.getClientRects().length || canvas.getBoundingClientRect().width <= 0
    || ['hidden', 'collapse'].includes(getComputedStyle(canvas).visibility)) setHelpOpen(false); };
    const resize = new ResizeObserver(check), mutation = new MutationObserver(check); resize.observe(canvas); mutation.observe(document.documentElement, { attributes: true, childList: true, subtree: true });
    return () => { resize.disconnect(); mutation.disconnect(); }; }, [canvas]);
  let selected: ReturnType<typeof curveSplitCurve> = null; try { selected = curveSplitCurve(session); } catch {}
  if (!mode || mode.session !== session || !selected) return null;
  const foreign = Object.keys(snapshot.pending).some(key => key !== 'curveSplit');
  const busy = snapshot.disposed || !!snapshot.candidate || !!snapshot.selectionTransition || mode.gesture.current || !mode.allowed(true);
  function action(run: () => void, fieldComposition = false, entering = false) {
    try { const data = curveSplitCurve(session);
      if (!mode!.allowed(fieldComposition) || !data || (entering ? mode!.isActive() : !mode!.isActive())
        || data.snapshot.generation !== snapshot.generation || data.snapshot.displayGeneration !== snapshot.displayGeneration
        || !same(data.snapshot.pending, snapshot.pending) || !same(data.reference, selected!.reference) || data.source !== selected!.source
        || !same(data.snapshot.view, snapshot.view) || !same(data.snapshot.selection, snapshot.selection) || !same(data.snapshot.curveSelection, snapshot.curveSelection)
        || data.snapshot.editTarget !== snapshot.editTarget || data.snapshot.rotationAxis !== snapshot.rotationAxis || data.snapshot.scaleAxis !== snapshot.scaleAxis)
        throw new CadEditorError('STALE', 'The Curve or displayed parameter changed.', { field: 'curve-split' });
      run();
    } catch (cause) { mode!.report(cause); }
  }
  return <div className="curve-split-panel">{!mode.active ? <Button type="button" variant="outline" size="sm" data-testid="curve-split-open" className="cad-editor-operation-icon" aria-label="Split Curve" title="Split Curve" disabled={busy || foreign}
    onClick={() => action(mode.open, false, true)}><ScissorsLineDashed size={16} aria-hidden="true" /></Button> : <div className="curve-split-mode" data-testid="curve-split-mode">
      <div className="cad-editor-inspector-title"><h3 className="cad-editor-heading">Split Curve</h3><Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogTrigger asChild><Button type="button" variant="ghost" size="xs" data-testid="curve-split-help" disabled={mode.gesture.current}>Help</Button></DialogTrigger>
        <DialogContent className="cad-editor-help-dialog" data-testid="curve-split-help-dialog"><DialogHeader><DialogTitle>Curve split</DialogTitle><DialogDescription>Make two new Curves. Keep the original.</DialogDescription></DialogHeader>
          <div className="cad-editor-help-body"><p>Choose a finite parameter strictly inside the original domain. The two child domains retain original parameters and meet at this cut. The editor does not clamp, normalize or move the seed geometry.</p>
            <p>The grip chooses among 65 actual original Curve D0 stations. This is approximate parameter placement, not a coefficient pick or continuous inverse. Overlapping nonadjacent stations require the exact field. During drag only the owned raw and guide change; release prepares one candidate. Escape restores only still-owned raw and retains foreign changes.</p>
            <p>The complete native two-Curve Source enters one new asset and two bodies. Original complete Sources, siblings, IDs, asset revisions and selected original point remain. Editing one child preserves the other Curve as a sibling; both qualified references share the pair asset revision.</p>
            <p>Current native split supports degree 1–3, original/refined/child pole counts 2–16 and XYZ within ±10000 mm. Temporary knot refinement and positive-weight requirements can refuse. Two display places and one asset place are required; no existing object is evicted. Document, Source, file and history budgets remain current provider limits.</p>
            <p>The native constructor checks the complete pair Source/Model, coefficient mappings, shared bits and bounded local D0. No separate public split-result validator is claimed. Native document construction and its whole validator precede the existing whole Viewer admission and one accepted history entry.</p>
            <p>Undo removes both new bodies atomically. Redo restores their IDs with fresh references. Download saves independent geometry, not a live split recipe or history. Local observations and a shared coefficient do not certify global error, sewn topology, G1/G2 or a Solid.</p>
            <details><summary>Native details</summary><pre>{JSON.stringify({ reference: selected.reference, domain: selected.domain, pending: snapshot.pending, creation: snapshot.lastCurveSplit }, null, 2)}</pre>
              {mode.diagnostic && <pre>{details(mode.diagnostic)}</pre>}</details>
          </div><DialogClose asChild><Button type="button" variant="outline" className="cad-editor-export-close" data-testid="curve-split-help-close">Close help</Button></DialogClose>
        </DialogContent></Dialog></div>
      <div className="cad-editor-field curve-split-field"><Label htmlFor={id}>Parameter</Label><Input id={id} type="text" inputMode="decimal" data-testid="curve-split-parameter" value={mode.raw} disabled={busy || foreign}
        onChange={event => action(() => mode.stage(event.target.value), true)} onCompositionStart={() => { composing.current = true; }} onCompositionEnd={() => { composing.current = false; }}
        onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); }
          if (event.key === 'Enter' && !composing.current && !event.nativeEvent.isComposing && event.keyCode !== 229 && !event.repeat
            && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) { event.preventDefault(); event.stopPropagation(); action(mode.create); } }} /></div>
      {mode.error && <p className="curve-split-error" role="alert" data-testid="curve-split-error">{mode.error}</p>}
      <div className="curve-split-toolbar"><Button type="button" data-testid="curve-split-create" disabled={busy || foreign} onClick={() => action(mode.create)}>Split</Button>
        <Button type="button" variant="outline" data-testid="curve-split-discard" disabled={busy || foreign || !Object.keys(snapshot.pending).length} onClick={() => action(mode.discard)}>Discard</Button>
        <Button type="button" variant="ghost" data-testid="curve-split-done" disabled={busy || !!Object.keys(snapshot.pending).length} onClick={() => action(mode.done)}>Done</Button></div>
    </div>}</div>;
}
