import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Crop } from 'lucide-react';
import { createCadGeometryReference, surfaceDomain } from '@barocss/cad';
import { CadEditorError, type CadEditorSession, type CadEditorSurfaceRegionField } from '../types.js';
import type { CadEditorDisplayReceipt } from './types.js';
import { useCadEditorSnapshot } from './use-session.js';
import { sameIntervalData as same } from './curve-interval.js';
import { Button } from './ui/button.js';
import { Input } from './ui/input.js';
import { Label } from './ui/label.js';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog.js';

export type RegionField = CadEditorSurfaceRegionField;
export const regionFields: RegionField[] = ['uMin', 'uMax', 'vMin', 'vMax'];
export const regionKey = (field: RegionField) => ({ uMin: 'surfaceRegionUMin', uMax: 'surfaceRegionUMax', vMin: 'surfaceRegionVMin', vMax: 'surfaceRegionVMax' } as const)[field];
export const regionNumber = (value: number) => Object.is(value, -0) ? '-0' : String(value);
export function surfaceRegionSurface(session: CadEditorSession) {
  const snapshot = session.getSnapshot();
  if (snapshot.disposed || snapshot.selectedBodyId === null || snapshot.view.kind !== 'document' || snapshot.editTarget !== 'pole') return null;
  const resolved = createCadGeometryReference(snapshot.accepted, { bodyId: snapshot.selectedBodyId });
  return resolved.geometry.kind === 'surface' ? { snapshot, reference: resolved.reference, source: resolved.source,
    surface: resolved.geometry, domain: surfaceDomain(resolved.geometry) } : null;
}
type Data = NonNullable<ReturnType<typeof surfaceRegionSurface>>;
export function regionRaw(data: Data, field: RegionField) {
  return data.snapshot.pending[regionKey(field)] ?? regionNumber(data.domain[field[0] === 'u' ? 'u' : 'v'][field.endsWith('Min') ? 0 : 1]);
}
interface Mode {
  session: CadEditorSession; active: boolean; isActive: () => boolean; raw: Record<RegionField, string>; currentRaw: (field: RegionField) => string;
  open: () => void; stage: (field: RegionField, raw: string) => void; create: () => void; discard: () => void; done: () => void;
  error: string | null; report: (cause: unknown) => void; noteError: (error: CadEditorError) => void; allowed: (fieldComposition?: boolean, ownCandidateToken?: string) => boolean;
  gesture: { current: boolean }; onGestureChange: (active: boolean) => void;
  viewport: { current: { canvas: HTMLCanvasElement | null; receipt: CadEditorDisplayReceipt | null;
    isCurrentSurface: (receipt?: CadEditorDisplayReceipt, ownCandidateToken?: string) => boolean } | null };
}
const Context = createContext<Mode | null>(null);
export function useSurfaceRegion() { return useContext(Context); }
function message(error: CadEditorError) {
  if (error.context.field === 'restore-frame') return 'Cannot restore the view. Reopen the viewport.';
  if (error.code === 'STALE') return 'The Surface or draft changed. Review the bounds.';
  if (error.code === 'BUDGET') return 'This region exceeds current capacity. Open Help.';
  if (error.code === 'DISPLAY') return 'Cannot display the region. The accepted document is retained.';
  return 'Use increasing bounds inside the original domains. Open Help for details.';
}
export function SurfaceRegionProvider({ session, onError, onGestureChange, children }: {
  session: CadEditorSession; onError?: (error: CadEditorError) => void; onGestureChange?: (active: boolean) => void; children: ReactNode;
}) {
  const snapshot = useCadEditorSnapshot(session), [bodyId, setBodyId] = useState<string | null>(null), [error, setError] = useState<string | null>(null), [, refresh] = useState(0);
  const current = useRef({ session, bodyId, onError, onGestureChange }); current.current = { session, bodyId, onError, onGestureChange };
  const gesture = useRef(false), viewport = useRef<Mode['viewport']['current']>(null), pointers = useRef(new Set<number>()), composition = useRef<EventTarget | null>(null);
  const diagnostic = useRef<CadEditorError | null>(null);
  let selected: ReturnType<typeof surfaceRegionSurface> = null; try { selected = surfaceRegionSurface(session); } catch {}
  const raw = Object.fromEntries(regionFields.map(field => [field, selected ? regionRaw(selected, field) : ''])) as Record<RegionField, string>;
  function captured(id: number) { return [document.documentElement, ...document.querySelectorAll('*')].some(element => element.hasPointerCapture(id)); }
  function allowed(fieldComposition = false, ownCandidateToken?: string) {
    const frame = viewport.current, canvas = frame?.canvas, rect = canvas?.getBoundingClientRect();
    const ownComposition = composition.current instanceof Element && composition.current.closest('.surface-region-fields') !== null
      && composition.current.closest('.cad-editor') === canvas?.closest('.cad-editor');
    return current.current.session === session && !gesture.current && (!composition.current || fieldComposition && ownComposition)
      && !!frame?.receipt && frame.isCurrentSurface(frame.receipt, ownCandidateToken) && canvas?.isConnected === true && canvas.getClientRects().length > 0
      && !!rect && rect.width > 0 && rect.height > 0 && !['hidden', 'collapse'].includes(getComputedStyle(canvas).visibility)
      && !canvas.closest('[data-direct-host-busy="true"],[data-panel-resizing="true"]') && ![...pointers.current].some(captured)
      && document.querySelector('[role="dialog"][data-state="open"],[role="menu"]') === null;
  }
  function isActive() { return current.current.session === session && current.current.bodyId !== null
    && surfaceRegionSurface(session)?.reference.bodyId === current.current.bodyId; }
  function currentRaw(field: RegionField) { const selected = surfaceRegionSurface(session); return selected ? regionRaw(selected, field) : ''; }
  function report(cause: unknown) {
    const fault = cause instanceof CadEditorError ? cause : new CadEditorError('INPUT', cause instanceof Error ? cause.message : 'Region extraction was refused.', { field: 'surface-region' }, cause);
    diagnostic.current = fault; setError(message(fault)); try { current.current.onError?.(fault); } catch {}
  }
  function clearError() { diagnostic.current = null; setError(null); }
  function target(fieldComposition = false, entering = false) {
    const data = surfaceRegionSurface(session);
    if (!allowed(fieldComposition) || !data || data.snapshot.candidate || data.snapshot.selectionTransition
      || (entering ? current.current.bodyId !== null : !isActive()) || Object.keys(data.snapshot.pending).some(key => !regionFields.some(field => regionKey(field) === key)))
      throw new CadEditorError('STALE', 'The original Surface presentation or draft changed.', { field: 'surface-region' });
    return data;
  }
  function sameContext(a: Data, b: Data) {
    return same(a.reference, b.reference) && a.source === b.source && same(a.surface, b.surface) && same(a.domain, b.domain)
      && a.snapshot.generation === b.snapshot.generation && a.snapshot.displayGeneration === b.snapshot.displayGeneration
      && same(a.snapshot.view, b.snapshot.view) && same(a.snapshot.selection, b.snapshot.selection) && same(a.snapshot.curveSelection, b.snapshot.curveSelection)
      && a.snapshot.editTarget === b.snapshot.editTarget && a.snapshot.rotationAxis === b.snapshot.rotationAxis && a.snapshot.scaleAxis === b.snapshot.scaleAxis;
  }
  function open() { try { const data = target(false, true); current.current.bodyId = data.reference.bodyId; setBodyId(data.reference.bodyId); clearError(); } catch (cause) { report(cause); } }
  function stageRaw(field: RegionField, text: string) {
    try {
      const before = target(true), frame = viewport.current?.receipt, canvas = viewport.current?.canvas, rect = canvas?.getBoundingClientRect(), expected = { ...before.snapshot.pending };
      const size = [canvas?.width, canvas?.height];
      if (text === '') delete expected[regionKey(field)]; else expected[regionKey(field)] = text;
      session.stageSurfaceRegionField(field, text); const after = target(true);
      const nextRect = canvas?.getBoundingClientRect();
      if (!sameContext(before, after) || !same(after.snapshot.pending, expected) || !frame || !canvas || !rect || !nextRect
        || viewport.current?.canvas !== canvas || !viewport.current.isCurrentSurface(frame)
        || canvas.width !== size[0] || canvas.height !== size[1] || rect.left !== nextRect.left || rect.top !== nextRect.top || rect.width !== nextRect.width || rect.height !== nextRect.height)
        throw new CadEditorError('STALE', 'The region bounds changed during staging.', { field: 'surface-region' });
      clearError(); return true;
    } catch (cause) { report(cause); return false; }
  }
  function create() {
    let token: string | null = null;
    try {
      let before = target(); if (!Object.keys(before.snapshot.pending).length) {
        if (!stageRaw('uMin', regionRaw(before, 'uMin'))) return; before = target();
      }
      const frame = viewport.current, canvas = frame?.canvas, receipt = frame?.receipt, rect = canvas?.getBoundingClientRect();
      if (!canvas || !receipt || !rect) throw new CadEditorError('STALE', 'The Canvas is unavailable.', { field: 'surface-region' });
      const size = [canvas.width, canvas.height], proposed = session.prepareApply(); token = proposed?.token ?? null;
      const after = surfaceRegionSurface(session), nextRect = canvas.getBoundingClientRect();
      if (!proposed || proposed.kind !== 'surface-region' || !after || !sameContext(before, after) || !same(before.snapshot.pending, after.snapshot.pending)
        || after.snapshot.candidate?.token !== proposed.token || after.snapshot.selectionTransition || !isActive()
        || current.current.session !== session || viewport.current?.canvas !== canvas || !viewport.current.isCurrentSurface(receipt, proposed.token)
        || !allowed(false, proposed.token) || canvas.width !== size[0] || canvas.height !== size[1]
        || rect.left !== nextRect.left || rect.top !== nextRect.top || rect.width !== nextRect.width || rect.height !== nextRect.height)
        throw new CadEditorError('STALE', 'The region changed during preparation. Review the draft.', { field: 'surface-region' });
      clearError();
    } catch (cause) { if (token && session.getSnapshot().candidate?.token === token) { try { session.cancelCandidate(token); } catch {} } report(cause); }
  }
  function discard() { try { const before = target(); session.discardPending(); const after = target();
    if (!sameContext(before, after) || Object.keys(after.snapshot.pending).length) throw new CadEditorError('STALE', 'The draft changed during Discard.', { field: 'surface-region' }); clearError(); } catch (cause) { report(cause); } }
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
  return <Context.Provider value={{ session, active: bodyId !== null, isActive, raw, currentRaw, open, stage: (field, raw) => { stageRaw(field, raw); }, create, discard, done,
    error, allowed, report, noteError: fault => { diagnostic.current = fault; setError(message(fault)); }, gesture,
    onGestureChange: active => { gesture.current = active; current.current.onGestureChange?.(active); refresh(value => value + 1); }, viewport }}>{children}</Context.Provider>;
}
export function SurfaceRegionControls({ session }: { session: CadEditorSession }) {
  const mode = useSurfaceRegion(), snapshot = useCadEditorSnapshot(session), id = useId(), composing = useRef(false), [helpOpen, setHelpOpen] = useState(false);
  const canvas = mode?.viewport.current?.canvas;
  useEffect(() => { setHelpOpen(false); }, [session, snapshot.generation, snapshot.selectedBodyId, snapshot.view.kind, mode?.active]);
  useEffect(() => { if (!canvas) return; const check = () => { if (!canvas.isConnected || !canvas.getClientRects().length || canvas.getBoundingClientRect().width <= 0
    || ['hidden', 'collapse'].includes(getComputedStyle(canvas).visibility)) setHelpOpen(false); };
    const resize = new ResizeObserver(check), mutation = new MutationObserver(check); resize.observe(canvas); mutation.observe(document.documentElement, { attributes: true, childList: true, subtree: true });
    return () => { resize.disconnect(); mutation.disconnect(); }; }, [canvas]);
  let selected: ReturnType<typeof surfaceRegionSurface> = null; try { selected = surfaceRegionSurface(session); } catch {}
  if (!mode || mode.session !== session || !selected) return null;
  const foreign = Object.keys(snapshot.pending).some(key => !regionFields.some(field => regionKey(field) === key));
  const busy = snapshot.disposed || !!snapshot.candidate || !!snapshot.selectionTransition || mode.gesture.current || !mode.allowed(true);
  function action(run: () => void, fieldComposition = false, entering = false) {
    try { const data = surfaceRegionSurface(session);
      if (!mode!.allowed(fieldComposition) || !data || (entering ? mode!.isActive() : !mode!.isActive())
        || data.snapshot.generation !== snapshot.generation || data.snapshot.displayGeneration !== snapshot.displayGeneration
        || !same(data.snapshot.pending, snapshot.pending) || !same(data.reference, selected!.reference) || data.source !== selected!.source
        || !same(data.snapshot.selection, snapshot.selection) || !same(data.snapshot.curveSelection, snapshot.curveSelection))
        throw new CadEditorError('STALE', 'The Surface or displayed bounds changed.', { field: 'surface-region' });
      run();
    } catch (cause) { mode!.report(cause); }
  }
  return <div className="surface-region-panel">{!mode.active ? <Button type="button" variant="outline" size="sm" data-testid="surface-region-open" className="cad-editor-operation-icon" aria-label="Extract region" title="Extract region" disabled={busy || foreign}
    onClick={() => action(mode.open, false, true)}><Crop size={16} aria-hidden="true" /></Button> : <div className="surface-region-mode" data-testid="surface-region-mode">
      <div className="cad-editor-inspector-title"><h3 className="cad-editor-heading">Extract region</h3><Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogTrigger asChild><Button type="button" variant="ghost" size="xs" data-testid="surface-region-help" disabled={mode.gesture.current}>Help</Button></DialogTrigger>
        <DialogContent className="cad-editor-help-dialog" data-testid="surface-region-help-dialog"><DialogHeader><DialogTitle>Surface region</DialogTitle><DialogDescription>Create an independent Surface. Keep the original.</DialogDescription></DialogHeader>
          <div className="cad-editor-help-body"><p>Use increasing U and V bounds inside the original parameter domains. No sorting, clamping or parameter normalization occurs. A full-domain region is a new copy, not a no-op.</p>
            <p>Each grip chooses among 65 original-domain Surface D0 stations at the midpoint of the other bounds. The four guides use original Surface D0. These approximate placements do not pick control coefficients or certify visibility; use exact fields when stations overlap.</p>
            <p>During drag only the owned boundary text and guide change. Release prepares one native candidate. Escape restores only the still-owned boundary. Foreign draft or candidate changes are retained.</p>
            <p>The new native Surface Source enters a new independent asset and body. The original complete Source, all siblings, IDs, asset revision and selected control point remain. Native originalSource is a regenerated comparison Model; it never replaces the original asset.</p>
            <p>Current native extraction supports both degrees 1–3, axes of 2–16 poles, at most 256 poles, XYZ within ±10000 mm, positive bounded weights and at most four splits with 128 observations. Temporary refinement capacity can also refuse. Document, displayed-body, Source, file and history budgets apply; creation never evicts an object.</p>
            <p>Undo removes the new inventory; Redo restores its IDs with fresh references. Download saves independent geometry, not a parent recipe or history. Local D0/D1 observations do not certify global error, Face trimming, topology, G1/G2 or a Solid.</p>
            <details><summary>Native details</summary><pre>{JSON.stringify({ reference: selected.reference, domains: selected.domain, pending: snapshot.pending, creation: snapshot.lastSurfaceRegion, error: mode.error }, null, 2)}</pre></details>
          </div><DialogClose asChild><Button type="button" variant="outline" className="cad-editor-export-close" data-testid="surface-region-help-close">Close help</Button></DialogClose>
        </DialogContent></Dialog></div>
      <div className="surface-region-fields">{regionFields.map(field => <div key={field} className="cad-editor-field"><Label htmlFor={id + field}>{field[0].toUpperCase()} {field.endsWith('Min') ? 'start' : 'end'}</Label>
        <Input id={id + field} type="text" inputMode="decimal" data-testid={'surface-region-' + field} value={mode.raw[field]} disabled={busy || foreign}
          onChange={event => action(() => mode.stage(field, event.target.value), true)} onCompositionStart={() => { composing.current = true; }} onCompositionEnd={() => { composing.current = false; }}
          onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); }
            if (event.key === 'Enter' && !composing.current && !event.nativeEvent.isComposing && event.keyCode !== 229 && !event.repeat
              && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) { event.preventDefault(); event.stopPropagation(); action(mode.create); } }} />
      </div>)}</div>
      {mode.error && <p className="surface-region-error" role="alert" data-testid="surface-region-error">{mode.error}</p>}
      <div className="surface-region-toolbar"><Button type="button" data-testid="surface-region-create" disabled={busy || foreign} onClick={() => action(mode.create)}>Create</Button>
        <Button type="button" variant="outline" data-testid="surface-region-discard" disabled={busy || foreign || !Object.keys(snapshot.pending).length} onClick={() => action(mode.discard)}>Discard</Button>
        <Button type="button" variant="ghost" data-testid="surface-region-done" disabled={busy || !!Object.keys(snapshot.pending).length} onClick={() => action(mode.done)}>Done</Button></div>
    </div>}</div>;
}
