import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Route, CircleHelp } from 'lucide-react';
import { createCadGeometryReference, curveDomain } from '@barocss/cad';
import { CadEditorError, type CadEditorSession } from '../types.js';
import type { CadEditorDisplayReceipt } from './types.js';
import { sameIntervalData as same } from './curve-interval.js';
import { useCadEditorSnapshot } from './use-session.js';
import { Button } from './ui/button.js';
import { Label } from './ui/label.js';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog.js';

interface Props {
  session: CadEditorSession; canvas: HTMLCanvasElement | null; receipt: CadEditorDisplayReceipt | null;
  isCurrentCurve: (receipt: CadEditorDisplayReceipt, ownCandidateToken?: string) => boolean;
  busy: boolean; onError: (error: CadEditorError) => void; toolbarContainer?: HTMLElement | null;
}
function originalCurve(session: CadEditorSession, bodyId: string) {
  const snapshot = session.getSnapshot(), resolved = createCadGeometryReference(snapshot.accepted, { bodyId });
  if (resolved.geometry.kind !== 'curve') throw new CadEditorError('INPUT', 'Choose an original Curve.', { field: 'surface-sweep' });
  return { snapshot, reference: resolved.reference, source: resolved.source, curve: resolved.geometry, domain: curveDomain(resolved.geometry) };
}
interface Draft {
  session: CadEditorSession; profile: ReturnType<typeof originalCurve>; profileName: string; railBodyId: string;
  canvas: HTMLCanvasElement; frame: CadEditorDisplayReceipt; rect: { left: number; top: number; width: number; height: number };
  width: number; height: number;
}
function details(error: CadEditorError) {
  const messages = [error.message]; let cause: unknown = error.cause;
  for (let i = 0; i < 6 && cause instanceof Error; i++) { messages.push(cause.message); cause = cause.cause; }
  return messages.join('\n');
}
function message(error: CadEditorError) {
  if (error.code === 'STALE') return 'The Curves or view changed. Cancel and open this command again.';
  if (error.code === 'BUDGET') return 'Make room for another Surface, or choose Curves within the native capacity.';
  return 'Cannot sweep this profile along the Rail. Choose another Rail Curve. Open Help for the native error.';
}
/** The existing whole-document bridge owns native candidate admission. */
export function TranslationalSweepControls(props: Props) {
  const { session } = props, snapshot = useCadEditorSnapshot(session), id = useId();
  const latest = useRef(props); latest.current = props;
  const currentDraft = useRef<Draft | null>(null), content = useRef<HTMLDivElement | null>(null), trigger = useRef<HTMLButtonElement | null>(null);
  const railField = useRef<HTMLSelectElement | null>(null), helpTrigger = useRef<HTMLButtonElement | null>(null);
  const pointers = useRef(new Set<number>()), composing = useRef(false), help = useRef(false);
  const [draft, setDraft] = useState<Draft | null>(null), [error, setError] = useState<CadEditorError | null>(null), [helpOpen, setHelpOpen] = useState(false);
  function captured(pointerId: number) { return [document.documentElement, ...document.querySelectorAll('*')].some(node => node.hasPointerCapture(pointerId)); }
  function visible() {
    const canvas = latest.current.canvas, rect = canvas?.getBoundingClientRect();
    return canvas?.isConnected === true && canvas.getClientRects().length > 0 && !!rect && rect.width > 0 && rect.height > 0
      && canvas.width > 0 && canvas.height > 0 && !['hidden', 'collapse'].includes(getComputedStyle(canvas).visibility)
      && !canvas.closest('[data-direct-host-busy="true"],[data-panel-resizing="true"]');
  }
  function available(frame: CadEditorDisplayReceipt, allowDialog: boolean, token?: string) {
    const now = latest.current;
    return now.session === session && !composing.current && !help.current && visible()
      && ![...pointers.current].some(captured) && document.querySelector('[role="menu"]') === null
      && [...document.querySelectorAll('[role="dialog"][data-state="open"]')].every(dialog => allowDialog && dialog === content.current)
      && now.receipt !== null && same(now.receipt.state, frame.state) && now.isCurrentCurve(frame, token);
  }
  function close() { currentDraft.current = null; setDraft(null); setError(null); help.current = false; setHelpOpen(false); }
  function fail(cause: unknown) {
    const fault = cause instanceof CadEditorError ? cause : new CadEditorError('NATIVE', 'Native Surface construction was refused.', { field: 'surface-sweep' }, cause);
    setError(fault); try { latest.current.onError(fault); } catch {}
  }
  function assertDraft(value: Draft, token?: string) {
    const state = session.getSnapshot(), before = value.profile.snapshot, canvas = latest.current.canvas, rect = canvas?.getBoundingClientRect();
    if (currentDraft.current !== value || latest.current.session !== value.session || value.session !== session || canvas !== value.canvas
      || (token === undefined && latest.current.busy) || !available(value.frame, true, token) || !rect || rect.left !== value.rect.left || rect.top !== value.rect.top
      || rect.width !== value.rect.width || rect.height !== value.rect.height || canvas.width !== value.width || canvas.height !== value.height
      || state.disposed || state.view.kind !== 'document' || !same(state.view, before.view) || state.selectedBodyId !== value.profile.reference.bodyId
      || state.generation !== before.generation || state.displayGeneration !== before.displayGeneration || !same(state.accepted, before.accepted)
      || !same(state.selection, before.selection) || !same(state.curveSelection, before.curveSelection)
      || state.editTarget !== before.editTarget || state.rotationAxis !== before.rotationAxis || state.scaleAxis !== before.scaleAxis
      || state.selectionTransition || Object.keys(state.pending).length || (token === undefined ? state.candidate !== null : state.candidate?.token !== token))
      throw new CadEditorError('STALE', 'The original Curve construction context changed.', { field: 'surface-sweep' });
    const profile = originalCurve(session, value.profile.reference.bodyId);
    if (!same(profile.reference, value.profile.reference) || profile.source !== value.profile.source || !same(profile.curve, value.profile.curve) || !same(profile.domain, value.profile.domain))
      throw new CadEditorError('STALE', 'The complete original Profile Curve changed.', { field: 'surface-sweep' });
    return state;
  }
  function open() {
    try {
      const state = session.getSnapshot(), canvas = latest.current.canvas, frame = latest.current.receipt;
      if (!canvas || !frame || latest.current.busy || !available(frame, false) || state.disposed || state.view.kind !== 'document'
        || !state.selectedBodyId || state.candidate || state.selectionTransition || Object.keys(state.pending).length
        || state.generation !== snapshot.generation || state.displayGeneration !== snapshot.displayGeneration
        || state.selectedBodyId !== snapshot.selectedBodyId || !same(state.selection, snapshot.selection) || !same(state.curveSelection, snapshot.curveSelection)
        || state.editTarget !== snapshot.editTarget || state.rotationAxis !== snapshot.rotationAxis || state.scaleAxis !== snapshot.scaleAxis) return;
      const profile = originalCurve(session, state.selectedBodyId), rect = canvas.getBoundingClientRect();
      const rail = state.accepted.bodyBindings.find(body => body.geometryKind === 'curve' && body.bodyId !== state.selectedBodyId)?.bodyId ?? '';
      const value: Draft = { session, profile, profileName: state.accepted.document.bodies.find(body => body.id === state.selectedBodyId)!.name,
        railBodyId: rail, canvas, frame: structuredClone(frame), rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height }, width: canvas.width, height: canvas.height };
      currentDraft.current = value; setDraft(value); setError(null); help.current = false; setHelpOpen(false);
    } catch (cause) { fail(cause); }
  }
  function chooseRail(bodyId: string) {
    const value = currentDraft.current; if (!value) return;
    try { assertDraft(value);
      if (bodyId === value.profile.reference.bodyId) throw new CadEditorError('INPUT', 'Choose a different Rail Curve.', { field: 'surface-sweep' });
      originalCurve(session, bodyId);
      const next = { ...value, railBodyId: bodyId }; currentDraft.current = next; setDraft(next); setError(null);
    } catch (cause) { fail(cause); }
  }
  function create() {
    const value = currentDraft.current; if (!value || !value.railBodyId || help.current) return;
    let token: string | null = null;
    try {
      assertDraft(value); const rail = originalCurve(session, value.railBodyId);
      if (rail.reference.bodyId === value.profile.reference.bodyId) throw new CadEditorError('INPUT', 'Choose a different Rail Curve.', { field: 'surface-sweep' });
      const proposed = session.prepareTranslationalSweep(value.railBodyId); token = proposed.token;
      assertDraft(value, token); const afterRail = originalCurve(session, value.railBodyId);
      if (proposed.kind !== 'surface-sweep' || proposed.baseGeneration !== value.profile.snapshot.generation || proposed.baseDisplayGeneration !== value.profile.snapshot.displayGeneration
        || !same(afterRail.reference, rail.reference) || afterRail.source !== rail.source || !same(afterRail.curve, rail.curve) || !same(afterRail.domain, rail.domain))
        throw new CadEditorError('STALE', 'The complete original Rail Curve changed during preparation.', { field: 'surface-sweep' });
      assertDraft(value, token); close();
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
  useEffect(() => {
    const value = currentDraft.current; if (!value) return;
    const state = session.getSnapshot(), before = value.profile.snapshot;
    if (value.session !== session || state.disposed || state.generation !== before.generation || state.displayGeneration !== before.displayGeneration
      || state.selectedBodyId !== value.profile.reference.bodyId || !same(state.view, before.view) || !same(state.selection, before.selection)
      || !same(state.curveSelection, before.curveSelection) || state.editTarget !== before.editTarget || state.rotationAxis !== before.rotationAxis
      || state.scaleAxis !== before.scaleAxis || !visible() || !props.receipt || !same(props.receipt.state, value.frame.state)
      || !props.isCurrentCurve(value.frame)) close();
  }, [session, snapshot, props.receipt]);
  useEffect(() => {
    const canvas = props.canvas; if (!canvas || !draft) return; const check = () => {
      const value = currentDraft.current, rect = canvas.getBoundingClientRect();
      if (value && (!visible() || !rect || rect.left !== value.rect.left || rect.top !== value.rect.top || rect.width !== value.rect.width
        || rect.height !== value.rect.height || canvas.width !== value.width || canvas.height !== value.height)) close();
    };
    const resize = new ResizeObserver(check), mutation = new MutationObserver(check); resize.observe(canvas);
    mutation.observe(document.documentElement, { attributes: true, childList: true, subtree: true });
    return () => { resize.disconnect(); mutation.disconnect(); };
  }, [props.canvas, draft]);
  const isCurve = snapshot.accepted.bodyBindings.some(body => body.bodyId === snapshot.selectedBodyId && body.geometryKind === 'curve');
  if (!isCurve || snapshot.view.kind !== 'document') return null;
  const busy = props.busy || snapshot.disposed || !!snapshot.candidate || !!snapshot.selectionTransition || Object.keys(snapshot.pending).length > 0;
  const choices = snapshot.accepted.document.bodies.filter(body => body.id !== snapshot.selectedBodyId
    && snapshot.accepted.bodyBindings.some(binding => binding.bodyId === body.id && binding.geometryKind === 'curve'));
  const toolbar = <div className="sweep-tools" role="toolbar" aria-label="Surface construction"><DialogTrigger asChild>
    <Button ref={trigger} type="button" variant="ghost" size="icon-sm" className="sweep-create" data-testid="sweep-open" aria-label="Sweep along Curve" title="Sweep along Curve" disabled={busy}
      onKeyDown={event => { if ((event.key === 'Enter' || event.key === ' ') && (event.repeat || event.nativeEvent.isComposing || event.keyCode === 229
        || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)) { event.preventDefault(); event.stopPropagation(); } }}><Route size={16} aria-hidden="true" /></Button>
  </DialogTrigger></div>;
  return <Dialog open={draft !== null} onOpenChange={value => { if (value) open(); else close(); }}>
    {props.toolbarContainer === undefined ? toolbar : props.toolbarContainer === null ? null : createPortal(toolbar, props.toolbarContainer)}
    <DialogContent ref={content} className="cad-editor-help-dialog" data-testid="sweep-dialog"
      onOpenAutoFocus={event => { event.preventDefault(); railField.current?.focus({ preventScroll: true }); }}
      onCloseAutoFocus={event => { event.preventDefault(); if (visible() && trigger.current?.isConnected && !trigger.current.disabled) trigger.current.focus({ preventScroll: true }); }}>
      <DialogHeader><DialogTitle>Sweep along Curve</DialogTitle><DialogDescription className="sr-only">Keep both original Curves.</DialogDescription></DialogHeader>
      {draft && <div className="cad-editor-help-body"><p>Profile: {draft.profileName}</p><div className="cad-editor-field"><Label htmlFor={id + '-rail'}>Rail</Label>
        <select ref={railField} id={id + '-rail'} data-testid="sweep-rail" value={draft.railBodyId} disabled={busy} onChange={event => chooseRail(event.target.value)}>
          {!choices.length && <option value="">No other Curve</option>}{choices.map(body => <option key={body.id} value={body.id}>{body.name}</option>)}
        </select></div>{error && <p className="sweep-error" role="alert" data-testid="sweep-error">{message(error)}</p>}</div>}
      <DialogFooter><Dialog open={helpOpen} onOpenChange={value => { if (value) { const proposal = currentDraft.current; if (!proposal) return;
        try { assertDraft(proposal); } catch (cause) { fail(cause); return; } } help.current = value; setHelpOpen(value); }}>
        <DialogTrigger asChild><Button ref={helpTrigger} type="button" variant="ghost" size="icon-sm" data-testid="sweep-help" aria-label="Surface construction help" title="Surface construction help" disabled={busy}><CircleHelp size={16} aria-hidden="true" /></Button></DialogTrigger>
        <DialogContent className="cad-editor-help-dialog" data-testid="sweep-help-dialog" onCloseAutoFocus={event => { event.preventDefault();
          if (visible() && helpTrigger.current?.isConnected && !helpTrigger.current.disabled) helpTrigger.current.focus({ preventScroll: true }); }}>
          <DialogHeader><DialogTitle>Sweep along Curve</DialogTitle><DialogDescription>Independent saved geometry from two original sections.</DialogDescription></DialogHeader>
          <div className="cad-editor-help-body"><p>Profile is the selected original Curve. Rail is another Curve from the complete document inventory, including hidden Curves. Their original domains and knot bases may differ.</p>
            <p>The native construction keeps the profile orientation fixed. At original parameters U and V, the Surface equals the profile point plus the rail point minus the actual rail start point. It does not turn the profile to follow the rail tangent, use a moving frame, cap the ends or construct a Solid.</p>
            <p>The current native operation supports degree 1–3 and 2–16 poles on each Curve, up to 16×16 Surface poles, XYZ within ±10000 mm and positive input and product weights from 0.000001 to 1000000. Native representability and observation limits apply. The operation preserves independent original parameters and weights without matching bases, remapping domains or fitting samples.</p>
            <p>The new asset keeps the complete generated three-object Source: profile, rail and Surface. All original complete Sources, siblings, IDs and revisions remain. Whole viewport admission precedes one history entry. Hide a body when four display places are used.</p>
            <p>Undo removes the new Surface; Redo restores its IDs with fresh references. Download saves independent geometry, not a live sweep recipe or history. Select the new Surface explicitly to edit its original control points. Local native checks do not certify global shape error, G1/G2, topology or a Solid.</p>
            {error && <details><summary>Native error details</summary><pre>{details(error)}</pre></details>}
          </div><DialogClose asChild><Button type="button" variant="outline" className="cad-editor-export-close" data-testid="sweep-help-close">Close help</Button></DialogClose>
        </DialogContent></Dialog>
        <Button type="button" variant="outline" data-testid="sweep-cancel" onClick={close}>Cancel</Button>
        <Button type="button" data-testid="sweep-create" disabled={busy || !draft?.railBodyId || helpOpen} onClick={create}>Create</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
