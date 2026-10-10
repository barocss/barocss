import { useEffect, useId, useRef, useState } from 'react';
import { CadEditorError } from '../types.js';
import type { CadEditorPoleField } from '../types.js';
import { cn } from '../lib/utils.js';
import { Button } from './ui/button.js';
import { Input } from './ui/input.js';
import { Label } from './ui/label.js';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog.js';
import { useCadEditorSnapshot } from './use-session.js';
import type { CadEditorInspectorProps } from './types.js';
import { CadEditorGeometryAnalysis } from './geometry-analysis.js';
import { CadEditorBodyRename } from './body-rename.js';

const FIELDS: { field: CadEditorPoleField; label: string }[] = [
  { field: 'xMM', label: 'X (mm)' }, { field: 'yMM', label: 'Y (mm)' },
  { field: 'zMM', label: 'Z (mm)' }, { field: 'weight', label: 'Weight' },
];

function numberText(value: number): string {
  return Object.is(value, -0) ? '-0' : String(value);
}

function diagnosticText(error: CadEditorError): string {
  const messages = [error.message];
  let cause: unknown = error.cause;
  for (let index = 0; index < 4 && cause instanceof Error; index++) {
    messages.push(cause.message);
    cause = cause.cause;
  }
  return messages.join('\n');
}

function actionableMessage(error: CadEditorError): string {
  const details = diagnosticText(error);
  let cause: unknown = error;
  for (let index = 0; index < 5 && cause instanceof Error; index++) {
    if (cause.name === 'SourceSurfaceControlNetError' && 'code' in cause && cause.code === 'BINDING') {
      return 'This Surface source cannot preserve this edit. Choose another Surface.';
    }
    cause = cause.cause;
  }
  if (/Weights must be in/i.test(details)) return 'Enter a weight from 0.000001 to 1000000.';
  if (/XYZ coordinates within|Coordinates must be finite and within/i.test(details)) return 'Enter coordinates from -10000 to 10000 mm.';
  const field = FIELDS.find(item => item.field === error.context.field);
  if (error.code === 'INPUT' && field) return `Enter a finite number for ${field.label}.`;
  if (error.code === 'BUDGET') return 'Use a shorter value and try again.';
  if (error.context.field === 'edit-capability') return 'Choose an editable Surface to change control points.';
  if (error.code === 'UNSUPPORTED') return 'Choose an editable Surface. Curves are read-only.';
  if (error.code === 'STALE') return 'Select the control pole again, then apply the change.';
  if (error.code === 'LIFECYCLE') return 'Reopen the document to continue editing.';
  return 'The change was not applied. Check the values and try again.';
}

export function CadEditorInspector({ session, onError, onAnalysis, onLength, className }: CadEditorInspectorProps) {
  const snapshot = useCadEditorSnapshot(session);
  const id = useId();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastError, setLastError] = useState<CadEditorError | null>(null);
  const [transitionError, setTransitionError] = useState<string | null>(null);
  const lastFieldRef = useRef<HTMLInputElement | null>(null);
  const composingFieldsRef = useRef(new Set<CadEditorPoleField>());
  const restoreFieldFocusRef = useRef(false);
  const attemptedTransitionRef = useRef<string | null>(null);
  const { selection, accepted, pending, candidate } = snapshot;
  const transition = snapshot.selectionTransition;
  const busy = candidate !== null || snapshot.disposed;
  const capability = snapshot.bodyCapabilities.find(body => body.bodyId === snapshot.selectedBodyId);
  const canEdit = selection !== null && capability?.canEditSurfacePole === true;
  useEffect(() => {
    if (!transition) {
      attemptedTransitionRef.current = null;
      setTransitionError(null);
    } else if (attemptedTransitionRef.current === transition.token && !candidate) {
      setTransitionError('Cannot apply this change. Your draft is retained. Cancel to revise the values.');
    }
  }, [transition?.token, candidate?.token]);
  function action(run: () => void, inTransition = false) {
    try { run(); setErrorMessage(null); setLastError(null); if (inTransition) setTransitionError(null); }
    catch (cause) {
      const error = cause instanceof CadEditorError ? cause
        : new CadEditorError('INPUT', cause instanceof Error ? cause.message : 'The editor action was refused.', {}, cause);
      setErrorMessage(actionableMessage(error));
      setLastError(error);
      if (inTransition) setTransitionError(actionableMessage(error));
      try { onError?.(error); } catch { /* Host callbacks do not change the session. */ }
    }
  }
  function select(uIndex: number, vIndex: number) {
    if (selection) action(() => session.requestSelection({ bodyId: selection.bodyId, uIndex, vIndex }));
  }
  function resolveTransition(decision: 'apply' | 'discard' | 'cancel') {
    const current = session.getSnapshot().selectionTransition;
    if (!current) return;
    if (decision === 'cancel') restoreFieldFocusRef.current = true;
    action(() => {
      const prepared = session.resolveSelectionTransition(current.token, decision);
      if (prepared) attemptedTransitionRef.current = current.token;
    }, true);
  }
  return <aside className={cn('cad-editor-inspector', className)} aria-label="Surface control pole inspector">
    <div className="cad-editor-inspector-title">
      <h2 className="cad-editor-heading">{selection ? 'Control point' : 'Object'}</h2>
      <Dialog>
        <DialogTrigger asChild><Button type="button" variant="ghost" size="xs" data-testid="cad-editor-help"
          aria-label="Surface editing help">Help</Button></DialogTrigger>
        <DialogContent className="cad-editor-help-dialog">
          <DialogHeader><DialogTitle>Surface editing help</DialogTitle>
            <DialogDescription>Editing limits and document details.</DialogDescription></DialogHeader>
          <div className="cad-editor-help-body">
            <section><h3>Editing limits</h3>
              <p>The native document can contain 1–4 source assets and up to 16 bodies. The viewport displays 1–4 chosen bodies at a time.</p>
              <p>Choose the displayed bodies in the object list. You can select and inspect a hidden body. Show it before using Fit Selected.</p>
              <p>Curves are read-only. A supported Surface can be edited even when its source contains other objects or its Model name differs from its Surface ID.</p>
              <p>The selected Surface must have degree 1–3, 2–16 control poles on each grid axis and at most 256 poles. Coordinates must stay within ±10000 mm, weights within 0.000001–1000000 and the native Surface ID within 48 characters.</p>
              <p>Source0 assets support 1–16 objects and at most 262144 UTF-16 code units and UTF-8 bytes. Pole edits require directly authored numeric coefficient bindings. The native provider can refuse unsupported bindings or source budgets during Apply.</p>
              <p>Display parsing reads the whole source asset, including hidden sibling objects. Hiding bodies does not remove those siblings from the source or bypass parsing limits.</p>
              <p>A native source edit does not prove display support. A degree 5 Curve in the displayed Surface's asset still reaches the actual Viewer sampling refusal. A degree 5 Curve in a separate hidden asset is preserved without a sampling or display claim.</p>
              <p>Coordinates use authored X, Y and Z in mm. They map directly to the display axes. The editor does not silently swap or convert axes.</p>
              <p>U and V select an original Surface control pole. Coordinates and weight edit its native coefficients. Display samples are separate from these coefficients.</p>
            </section>
            <section><h3>Complete source preservation</h3>
              <p>Apply uses the native source-preserving edit provider's complete result.source and result.model. The source keeps untouched spelling, whitespace and comments. The Model keeps its name, object order, native IDs and sibling objects. Only the requested coordinate or weight literals change.</p>
              <p>The selected single-Surface result.edit is a child proof. Its source and model do not replace the complete asset. The editor adopts the complete result.source in the selected asset and rebuilds the document through the native API.</p>
              <p>Only the document and edited asset revisions advance. Canonical asset, body and geometry IDs keep their associations. Other asset revisions and hidden source bytes remain unchanged. An exact native no-op keeps the original source, revisions and history.</p>
              <p>Successful native validation is followed by complete selected-asset Viewer admission and a fresh RGBA frame read. A refused source, binding or display keeps the accepted source, history, draft, selection and current view.</p>
            </section>
            <section><h3>Draft and current values</h3>
              <p>Changed fields remain pending until you select Apply. Discard restores the current values.</p>
              <p>When you select another object or control pole with a draft, choose Apply, Discard or Cancel. Cancel keeps the draft and returns focus to the last coordinate or weight field.</p>
              <p>Apply prepares a native source candidate. The candidate becomes accepted after native validation and successful display. Download writes the accepted document.</p>
              <p>Changing the displayed set does not edit the source, clear a draft or add a history entry. A rejected display change keeps the current view and displayed set.</p>
              {Object.keys(pending).length > 0 && <dl className="cad-editor-reference">
                {FIELDS.filter(({ field }) => Object.hasOwn(pending, field)).map(({ field, label }) => <div key={field}>
                  <dt>Draft {label}</dt><dd>{pending[field]}</dd>
                </div>)}
              </dl>}
              {!candidate && <p>No native source candidate is waiting for display.</p>}
            </section>
            <section><h3>Keyboard</h3>
              <p>Enter in a coordinate or weight field applies the draft. During text composition, Enter commits text only. Escape in the field keeps its draft and focus.</p>
              <p>Outside text fields, Cmd/Ctrl+Z undoes a change. Shift+Cmd/Ctrl+Z and Ctrl+Y redo it. Apply or discard pending values before using these shortcuts. Text fields keep the browser text undo.</p>
              <p>Escape in the selection decision cancels the selection change. Escape in the viewport keeps the selected object and camera.</p>
              <p>Click a displayed object to select it. Drag to orbit or Shift-drag to pan without changing selection. Fit Document uses the native bounds of the displayed set; Fit Selected uses the displayed selected body's native bounds.</p>
            </section>
            {selection && <details className="cad-editor-source">
              <summary className="cad-editor-source-title">Original native coefficients and binding</summary>
              <dl className="cad-editor-reference">
                <dt>Object</dt><dd>{selection.reference.geometryId}</dd>
                <dt>Asset</dt><dd>{selection.reference.assetId} · revision {selection.reference.assetRevision}</dd>
                <dt>Document</dt><dd>{selection.reference.documentId} · revision {selection.reference.documentRevision}</dd>
                <dt>Control pole</dt><dd>U {selection.uIndex}, V {selection.vIndex}</dd>
                {FIELDS.map(({ field, label }) => <div key={field}><dt>Current {label}</dt><dd>{numberText(selection.accepted[field])}</dd></div>)}
              </dl>
            </details>}
            <details className="cad-editor-source">
              <summary className="cad-editor-source-title">Accepted native source</summary>
              {accepted.document.assets.map(asset => <section key={asset.id}>
                <h4>{asset.id} · revision {asset.revision}</h4><pre>{asset.source}</pre>
              </section>)}
            </details>
            {candidate?.kind === 'display' && <details className="cad-editor-source" open>
              <summary className="cad-editor-source-title">Pending display set</summary>
              <p>{candidate.displayBodyIds.map(bodyId => accepted.document.bodies.find(body => body.id === bodyId)?.name ?? bodyId).join(', ')}</p>
              <p>The accepted native source is unchanged.</p>
            </details>}
            {candidate && candidate.kind !== 'display' && <details className="cad-editor-source" open>
              <summary className="cad-editor-source-title">Pending native source · awaiting display</summary>
              {candidate.result.document.assets.map(asset => <section key={asset.id}>
                <h4>{asset.id} · revision {asset.revision}</h4><pre>{asset.source}</pre>
              </section>)}
            </details>}
            <details className="cad-editor-source">
              <summary className="cad-editor-source-title">Accepted history</summary>
              <p>State {snapshot.history.index + 1} of {snapshot.history.count} · {snapshot.history.bytes} bytes</p>
              <p>Document revision {accepted.document.revision} · {snapshot.downloadStatus}</p>
              <p>Displayed bodies {snapshot.displayBodyIds.length} · display generation {snapshot.displayGeneration}</p>
            </details>
            {lastError && <details className="cad-editor-source">
              <summary className="cad-editor-source-title">Last error details</summary>
              <p>{lastError.code}</p><pre>{diagnosticText(lastError)}</pre>
            </details>}
          </div>
        </DialogContent>
      </Dialog>
    </div>
    <Dialog open={transition !== null} onOpenChange={open => { if (!open) resolveTransition('cancel'); }}>
      <DialogContent className="cad-editor-help-dialog cad-editor-transition-dialog" showCloseButton={false}
        data-testid="cad-editor-transition"
        onPointerDownOutside={event => event.preventDefault()}
        onEscapeKeyDown={event => { event.preventDefault(); resolveTransition('cancel'); }}
        onCloseAutoFocus={event => {
          if (!restoreFieldFocusRef.current) return;
          event.preventDefault();
          restoreFieldFocusRef.current = false;
          const field = lastFieldRef.current;
          if (field?.isConnected && !field.disabled) field.focus({ preventScroll: true });
        }}>
        <DialogHeader><DialogTitle>Keep your changes?</DialogTitle>
          <DialogDescription>Apply or discard the draft before changing selection. Cancel keeps your current selection.</DialogDescription></DialogHeader>
        {transitionError && <p className="cad-editor-error" role="alert">{transitionError}</p>}
        <div className="cad-editor-transition-actions">
          <Button type="button" disabled={busy} data-testid="cad-editor-transition-apply" onClick={() => resolveTransition('apply')}>Apply</Button>
          <Button type="button" variant="outline" disabled={busy} data-testid="cad-editor-transition-discard" onClick={() => resolveTransition('discard')}>Discard</Button>
          <Button type="button" variant="ghost" disabled={snapshot.disposed} data-testid="cad-editor-transition-cancel" onClick={() => resolveTransition('cancel')}>Cancel</Button>
        </div>
      </DialogContent>
    </Dialog>
    <div className="cad-editor-field">
      <Label htmlFor={`${id}-body`}>Object</Label>
      <select id={`${id}-body`} value={snapshot.selectedBodyId ?? ''} disabled={busy || accepted.document.bodies.length === 0}
        data-testid="cad-editor-body" onChange={event => action(() => session.requestSelection({ bodyId: event.target.value }))}>
        {snapshot.selectedBodyId === null && <option value="">Select an object</option>}
        {accepted.document.bodies.map(body => <option key={body.id} value={body.id}>
          {body.name}{snapshot.bodyCapabilities.find(capability => capability.bodyId === body.id)?.canEditSurfacePole === false ? ' · read-only' : ''}
        </option>)}
      </select>
    </div>
    <CadEditorBodyRename session={session} onError={onError} />
    {selection ? <>
      {!canEdit && <p className="cad-editor-readonly" role="status" data-testid="cad-editor-readonly-surface">
        These control points are read-only. Choose an editable Surface to change them.
      </p>}
      {snapshot.selectedBodyId !== null && !snapshot.displayBodyIds.includes(snapshot.selectedBodyId)
        && <p className="cad-editor-hidden-body" role="status">This object is not displayed. Show it to fit or select it in the viewport.</p>}
      <div className="cad-editor-selection">
        <div className="cad-editor-field"><Label htmlFor={`${id}-u`}>U index</Label>
          <select id={`${id}-u`} value={selection.uIndex} disabled={busy} data-testid="cad-editor-u"
            onChange={event => select(Number(event.target.value), selection.vIndex)}>
            {Array.from({ length: selection.countU }, (_, index) => <option key={index} value={index}>{index}</option>)}
          </select>
        </div>
        <div className="cad-editor-field"><Label htmlFor={`${id}-v`}>V index</Label>
          <select id={`${id}-v`} value={selection.vIndex} disabled={busy} data-testid="cad-editor-v"
            onChange={event => select(selection.uIndex, Number(event.target.value))}>
            {Array.from({ length: selection.countV }, (_, index) => <option key={index} value={index}>{index}</option>)}
          </select>
        </div>
      </div>
      <h3 className="cad-editor-heading">Coordinates and weight</h3>
      {Object.keys(pending).length > 0 && <p className="cad-editor-draft-status">Unapplied changes</p>}
      {FIELDS.map(({ field, label }) => <div className="cad-editor-field" key={field}>
        <Label htmlFor={`${id}-${field}`}>{label}</Label>
        <Input id={`${id}-${field}`} type="text" inputMode="decimal" disabled={busy || !canEdit}
          value={pending[field] ?? numberText(selection.accepted[field])} data-testid={`cad-editor-${field}`}
          onFocus={event => { lastFieldRef.current = event.currentTarget; }}
          onCompositionStart={() => { composingFieldsRef.current.add(field); }}
          onCompositionEnd={() => { composingFieldsRef.current.delete(field); }}
          onKeyDown={event => {
            if (event.key === 'Escape') {
              event.preventDefault();
              event.stopPropagation();
              return;
            }
            if (!canEdit || event.key !== 'Enter' || event.nativeEvent.isComposing || event.keyCode === 229
              || composingFieldsRef.current.has(field) || event.repeat
              || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
            event.preventDefault();
            event.stopPropagation();
            action(() => { session.prepareApply(); });
          }}
          onChange={event => action(() => session.stageSurfacePoleField(field, event.target.value))}
          aria-describedby={Object.hasOwn(pending, field) ? `${id}-${field}-accepted` : undefined} />
        {Object.hasOwn(pending, field) && <span id={`${id}-${field}-accepted`} className="cad-editor-accepted">Current: {numberText(selection.accepted[field])}</span>}
      </div>)}
      {canEdit && <div className="cad-editor-actions">
        <Button type="button" disabled={busy || Object.keys(pending).length === 0} data-testid="cad-editor-apply"
          onClick={() => action(() => { session.prepareApply(); })}>{candidate ? 'Applying…' : 'Apply'}</Button>
        <Button type="button" variant="outline" disabled={busy || Object.keys(pending).length === 0}
          data-testid="cad-editor-discard" onClick={() => action(() => session.discardPending())}>Discard</Button>
      </div>}
    </> : <p role="status" data-testid={snapshot.selectedBodyId === null ? undefined : 'cad-editor-readonly-curve'}>{snapshot.selectedBodyId === null
      ? 'Select a Surface to edit its control points.' : 'This Curve is read-only.'}</p>}
    {errorMessage && <p className="cad-editor-error" role="alert">{errorMessage}</p>}
    <CadEditorGeometryAnalysis session={session} onAnalysis={onAnalysis} onLength={onLength} onError={onError} />
  </aside>;
}
