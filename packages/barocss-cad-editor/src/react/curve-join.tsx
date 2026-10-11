import { useEffect, useId, useRef, useState } from 'react';
import { Combine } from 'lucide-react';
import { createCadGeometryReference, type CadGeometryReferenceV0 } from '@barocss/cad';
import { CadEditorError, type CadEditorSession } from '../types.js';
import { sameIntervalData as same } from './curve-interval.js';
import { useCadEditorSnapshot } from './use-session.js';
import { Button } from './ui/button.js';
import { Label } from './ui/label.js';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog.js';

interface Draft {
  session: CadEditorSession; generation: number; displayGeneration: number;
  leftBodyId: string; leftName: string; leftReference: CadGeometryReferenceV0; leftSource: string;
  rightBodyId: string; view: ReturnType<CadEditorSession['getSnapshot']>['view'];
  selection: ReturnType<CadEditorSession['getSnapshot']>['selection'];
  curveSelection: ReturnType<CadEditorSession['getSnapshot']>['curveSelection'];
}
function detail(error: CadEditorError): string {
  const messages = [error.message]; let cause: unknown = error.cause;
  for (let i = 0; i < 5 && cause instanceof Error; i++) { messages.push(cause.message); cause = cause.cause; }
  return messages.join('\n');
}
function message(error: CadEditorError) {
  if (error.code === 'STALE') return 'The Curves or selection changed. Cancel and open Join Curves again.';
  if (error.code === 'BUDGET') return 'Make room for another Curve. Hide a displayed object or use a document with available capacity.';
  if (error.code === 'DISPLAY') return 'Return to document view before joining Curves.';
  if (error.code === 'LIFECYCLE') return 'Reopen the viewport to continue.';
  return 'Choose a Next Curve whose start matches the end of First. Open Help for native requirements.';
}
/** Explicit ordered originals; the generated Curve is admitted by the existing whole-document bridge. */
export function CurveJoinControls({ session, onError }: { session: CadEditorSession; onError?: (error: CadEditorError) => void }) {
  const snapshot = useCadEditorSnapshot(session), id = useId();
  const [draft, setDraft] = useState<Draft | null>(null), [error, setError] = useState<CadEditorError | null>(null), [helpOpen, setHelpOpen] = useState(false);
  const currentDraft = useRef<Draft | null>(null), trigger = useRef<HTMLButtonElement | null>(null), content = useRef<HTMLDivElement | null>(null);
  const nextField = useRef<HTMLSelectElement | null>(null), pointers = useRef(new Set<number>()), composing = useRef(false);
  const owner = useRef({ session, onError }); owner.current = { session, onError };
  const canvas = trigger.current?.closest('.cad-editor')?.querySelector<HTMLCanvasElement>('[data-testid="cad-editor-canvas"]') ?? null;
  const selectedBody = snapshot.accepted.document.bodies.find(body => body.id === snapshot.selectedBodyId);
  const leftIsCurve = snapshot.accepted.bodyBindings.some(body => body.bodyId === snapshot.selectedBodyId && body.geometryKind === 'curve');
  const busy = snapshot.disposed || snapshot.candidate !== null || snapshot.selectionTransition !== null || Object.keys(snapshot.pending).length > 0;
  function captured(id: number) { return [document.documentElement, ...document.querySelectorAll('*')].some(element => element.hasPointerCapture(id)); }
  function visibleCanvas() {
    const actual = trigger.current?.closest('.cad-editor')?.querySelector<HTMLCanvasElement>('[data-testid="cad-editor-canvas"]'), rect = actual?.getBoundingClientRect();
    return actual?.isConnected === true && actual.getClientRects().length > 0 && !!rect && rect.width > 0 && rect.height > 0
      && actual.width > 0 && actual.height > 0 && !['hidden', 'collapse'].includes(getComputedStyle(actual).visibility)
      && actual.closest('.cad-editor-viewport')?.getAttribute('data-viewer-ready') === 'true'
      && !actual.closest('[data-direct-host-busy="true"],[data-panel-resizing="true"]');
  }
  function available(allowOwnDialog: boolean) {
    return owner.current.session === session && !composing.current && visibleCanvas() && ![...pointers.current].some(captured)
      && document.querySelector('[role="menu"]') === null
      && [...document.querySelectorAll('[role="dialog"][data-state="open"]')].every(dialog => allowOwnDialog && dialog === content.current);
  }
  function close() { currentDraft.current = null; setDraft(null); setError(null); setHelpOpen(false); }
  function fail(cause: unknown) {
    const fault = cause instanceof CadEditorError ? cause : new CadEditorError('NATIVE', 'Native Curve join refused.', { field: 'curve-join' }, cause);
    setError(fault); try { owner.current.onError?.(fault); } catch {}
  }
  function assertDraft(value: Draft, ownCandidateToken?: string) {
    const now = session.getSnapshot();
    if (currentDraft.current !== value || owner.current.session !== value.session || value.session !== session || !available(true)
      || now.disposed || now.view.kind !== 'document' || !same(now.view, value.view)
      || now.generation !== value.generation || now.displayGeneration !== value.displayGeneration || now.selectedBodyId !== value.leftBodyId
      || !same(now.selection, value.selection) || !same(now.curveSelection, value.curveSelection)
      || now.selectionTransition || Object.keys(now.pending).length > 0
      || (ownCandidateToken === undefined ? now.candidate !== null : now.candidate?.token !== ownCandidateToken))
      throw new CadEditorError('STALE', 'The ordered join context changed.', { field: 'curve-join' });
    const left = createCadGeometryReference(now.accepted, { bodyId: value.leftBodyId });
    if (left.geometry.kind !== 'curve' || !same(left.reference, value.leftReference) || left.source !== value.leftSource)
      throw new CadEditorError('STALE', 'The complete original First Curve changed.', { field: 'curve-join' });
    return { now, left };
  }
  function open() {
    try {
      const now = session.getSnapshot();
      if (!available(false) || now.disposed || now.view.kind !== 'document' || !now.selectedBodyId
        || now.candidate || now.selectionTransition || Object.keys(now.pending).length) return;
      const left = createCadGeometryReference(now.accepted, { bodyId: now.selectedBodyId }); if (left.geometry.kind !== 'curve') return;
      const body = now.accepted.document.bodies.find(body => body.id === now.selectedBodyId)!;
      const next = now.accepted.bodyBindings.find(body => body.geometryKind === 'curve' && body.bodyId !== now.selectedBodyId)?.bodyId ?? '';
      const value: Draft = { session, generation: now.generation, displayGeneration: now.displayGeneration, leftBodyId: body.id,
        leftName: body.name, leftReference: left.reference, leftSource: left.source, rightBodyId: next,
        view: now.view, selection: now.selection, curveSelection: now.curveSelection };
      currentDraft.current = value; setDraft(value); setError(null); setHelpOpen(false);
    } catch (cause) { fail(cause); }
  }
  function chooseRight(bodyId: string) {
    const value = currentDraft.current; if (!value) return;
    try { const { now } = assertDraft(value);
      if (bodyId === value.leftBodyId || !now.accepted.bodyBindings.some(body => body.bodyId === bodyId && body.geometryKind === 'curve'))
        throw new CadEditorError('INPUT', 'Choose a different existing Curve.', { field: 'curve-join' });
      const next = { ...value, rightBodyId: bodyId }; currentDraft.current = next; setDraft(next); setError(null);
    } catch (cause) { fail(cause); }
  }
  function join() {
    const value = currentDraft.current; if (!value || !value.rightBodyId || helpOpen) return;
    let token: string | null = null;
    try {
      const { now } = assertDraft(value), right = createCadGeometryReference(now.accepted, { bodyId: value.rightBodyId });
      if (value.rightBodyId === value.leftBodyId || right.geometry.kind !== 'curve') throw new CadEditorError('INPUT', 'Choose a different existing Curve.', { field: 'curve-join' });
      const proposed = session.prepareCurveJoin(value.rightBodyId); token = proposed.token;
      const after = assertDraft(value, token), currentRight = createCadGeometryReference(after.now.accepted, { bodyId: value.rightBodyId });
      if (proposed.kind !== 'curve-join' || proposed.baseGeneration !== value.generation || proposed.baseDisplayGeneration !== value.displayGeneration
        || !same(currentRight.reference, right.reference) || currentRight.source !== right.source)
        throw new CadEditorError('STALE', 'The complete original Next Curve changed during preparation.', { field: 'curve-join' });
      close();
    } catch (cause) {
      if (token && session.getSnapshot().candidate?.token === token) session.cancelCandidate(token);
      fail(cause);
    }
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
  useEffect(() => { const value = currentDraft.current; if (value && (value.session !== session || snapshot.disposed || snapshot.generation !== value.generation
    || snapshot.displayGeneration !== value.displayGeneration || snapshot.selectedBodyId !== value.leftBodyId || snapshot.view.kind !== 'document')) close(); },
  [session, snapshot.disposed, snapshot.generation, snapshot.displayGeneration, snapshot.selectedBodyId, snapshot.view.kind]);
  useEffect(() => {
    if (!canvas || !draft) return; const check = () => { if (!visibleCanvas()) close(); };
    const resize = new ResizeObserver(check), mutation = new MutationObserver(check); resize.observe(canvas);
    mutation.observe(document.documentElement, { attributes: true, childList: true, subtree: true });
    return () => { resize.disconnect(); mutation.disconnect(); };
  }, [canvas, draft]);
  const choices = snapshot.accepted.document.bodies.filter(body => body.id !== draft?.leftBodyId
    && snapshot.accepted.bodyBindings.some(binding => binding.bodyId === body.id && binding.geometryKind === 'curve'));
  return <Dialog open={draft !== null} onOpenChange={next => { if (next) open(); else close(); }}>
    <DialogTrigger asChild><Button ref={trigger} type="button" variant="outline" size="sm" className="cad-editor-operation-icon" aria-label="Join Curves" title="Join Curves" data-testid="curve-join-open"
      disabled={busy || !leftIsCurve || !selectedBody || snapshot.view.kind !== 'document'}><Combine size={16} aria-hidden="true" /></Button></DialogTrigger>
    <DialogContent ref={content} className="cad-editor-help-dialog" data-testid="curve-join-dialog"
      onOpenAutoFocus={event => { event.preventDefault(); nextField.current?.focus({ preventScroll: true }); }}
      onCloseAutoFocus={event => { event.preventDefault(); if (trigger.current?.isConnected && !trigger.current.disabled) trigger.current.focus({ preventScroll: true }); else canvas?.focus({ preventScroll: true }); }}>
      <DialogHeader><DialogTitle>Join Curves</DialogTitle><DialogDescription>End of First → Start of Next. Keep both originals.</DialogDescription></DialogHeader>
      {draft && <div className="cad-editor-help-body"><p>First Curve: {draft.leftName}</p>
        <div className="cad-editor-field"><Label htmlFor={id + '-right'}>Next Curve</Label><select ref={nextField} id={id + '-right'} data-testid="curve-join-right"
          value={draft.rightBodyId} disabled={busy} onChange={event => chooseRight(event.target.value)}>
          {!choices.length && <option value="">No other Curve</option>}{choices.map(body => <option key={body.id} value={body.id}>{body.name}</option>)}
        </select></div>{error && <p role="alert" className="cad-editor-error" data-testid="curve-join-error">{message(error)}</p>}
      </div>}
      <DialogFooter><Dialog open={helpOpen} onOpenChange={setHelpOpen}><DialogTrigger asChild><Button type="button" variant="ghost" data-testid="curve-join-help" disabled={busy}>Help</Button></DialogTrigger>
        <DialogContent className="cad-editor-help-dialog" data-testid="curve-join-help-dialog"><DialogHeader><DialogTitle>Curve join</DialogTitle><DialogDescription>Original endpoints and independent saved geometry.</DialogDescription></DialogHeader>
          <div className="cad-editor-help-body"><p>First uses the selected original Curve. Next is a different Curve from the complete document inventory, including hidden Curves. Their order is explicit: the last endpoint of First must exactly match the first endpoint of Next. The editor does not reverse, snap, bridge or sew them.</p>
            <p>Current native join requires the same degree 1–3, 2–16 poles per parent, positive weights from 0.000001 to 1000000 and XYZ within ±10000 mm. The result has at most 31 poles. Its right domain and right weights are mapped by the native operation; no additional UI parameter changes that policy.</p>
            <p>Both original complete Sources, Models, siblings, IDs and asset revisions remain. Only the generated Curve Source enters a new independent asset and body. Native parentSources are regenerated comparison Models, not substitutes for the original whole assets.</p>
            <p>Join prepares one candidate and closes this dialog after checking ownership. The existing whole viewport admission must succeed before the new Curve enters the document and history. Native refusal keeps this Next choice; display refusal retains the accepted document. Hide a body when four display places are used. Native asset, body, source and file capacities still apply.</p>
            <p>Undo removes the new inventory and Redo restores its logical IDs with fresh references. Download stores the current independent Curve, not a live join recipe or history. The result is a native C0 Curve; join D1 refusal can be valid. Local observations do not certify G1/G2, global shape error, wire topology or a Solid.</p>
            {error && <details><summary>Technical error details</summary><pre>{detail(error)}</pre></details>}
          </div><DialogClose asChild><Button type="button" variant="outline" className="cad-editor-export-close" data-testid="curve-join-help-close">Close help</Button></DialogClose>
        </DialogContent></Dialog>
        <Button type="button" variant="outline" data-testid="curve-join-cancel" onClick={close}>Cancel</Button>
        <Button type="button" data-testid="curve-join-confirm" disabled={busy || !draft?.rightBodyId} onClick={join}>Join</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
