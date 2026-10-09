import { useId, useState } from 'react';
import { CadEditorError } from '../types.js';
import type { CadEditorPoleField } from '../types.js';
import { cn } from '../lib/utils.js';
import { Button } from './ui/button.js';
import { Input } from './ui/input.js';
import { Label } from './ui/label.js';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog.js';
import { useCadEditorSnapshot } from './use-session.js';
import type { CadEditorInspectorProps } from './types.js';

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
  if (/Weights must be in/i.test(details)) return 'Enter a weight from 0.000001 to 1000000.';
  if (/XYZ coordinates within|Coordinates must be finite and within/i.test(details)) return 'Enter coordinates from -10000 to 10000 mm.';
  const field = FIELDS.find(item => item.field === error.context.field);
  if (error.code === 'INPUT' && field) return `Enter a finite number for ${field.label}.`;
  if (error.code === 'BUDGET') return 'Use a shorter value and try again.';
  if (error.code === 'UNSUPPORTED') return 'Select a Surface. The reference Curve is read-only.';
  if (error.code === 'STALE') return 'Select the control pole again, then apply the change.';
  if (error.code === 'LIFECYCLE') return 'Reopen the document to continue editing.';
  return 'The change was not applied. Check the values and try again.';
}

export function CadEditorInspector({ session, onError, className }: CadEditorInspectorProps) {
  const snapshot = useCadEditorSnapshot(session);
  const id = useId();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastError, setLastError] = useState<CadEditorError | null>(null);
  const { selection, accepted, pending, candidate } = snapshot;
  const busy = candidate !== null || snapshot.disposed;
  const surfaces = accepted.bodyBindings.filter(binding => binding.geometryKind === 'surface');
  function action(run: () => void) {
    try { run(); setErrorMessage(null); setLastError(null); }
    catch (cause) {
      const error = cause instanceof CadEditorError ? cause
        : new CadEditorError('INPUT', cause instanceof Error ? cause.message : 'The editor action was refused.', {}, cause);
      setErrorMessage(actionableMessage(error));
      setLastError(error);
      try { onError?.(error); } catch { /* Host callbacks do not change the session. */ }
    }
  }
  function select(uIndex: number, vIndex: number) {
    if (selection) action(() => session.selectSurfacePole({ bodyId: selection.bodyId, uIndex, vIndex }));
  }
  return <aside className={cn('cad-editor-inspector', className)} aria-label="Surface control pole inspector">
    <div className="cad-editor-inspector-title">
      <h2 className="cad-editor-heading">Control point</h2>
      <Dialog>
        <DialogTrigger asChild><Button type="button" variant="ghost" size="xs" data-testid="cad-editor-help"
          aria-label="Surface editing help">Help</Button></DialogTrigger>
        <DialogContent className="cad-editor-help-dialog">
          <DialogHeader><DialogTitle>Surface editing help</DialogTitle>
            <DialogDescription>Editing limits and document details.</DialogDescription></DialogHeader>
          <div className="cad-editor-help-body">
            <section><h3>Editing limits</h3>
              <p>This workflow uses one editable Surface and one reference Curve. The editor can operate on at most two bodies. The reference Curve is read-only.</p>
              <p>Coordinates use authored X, Y and Z in mm. They map directly to the display axes. The editor does not silently swap or convert axes.</p>
              <p>U and V select an original Surface control pole. Coordinates and weight edit its native coefficients. Display samples are separate from these coefficients.</p>
            </section>
            <section><h3>Draft and current values</h3>
              <p>Changed fields remain pending until you select Apply. Discard restores the current values.</p>
              <p>Apply prepares a native source candidate. The candidate becomes accepted after native validation and successful display. Download writes the accepted document.</p>
              {Object.keys(pending).length > 0 && <dl className="cad-editor-reference">
                {FIELDS.filter(({ field }) => Object.hasOwn(pending, field)).map(({ field, label }) => <div key={field}>
                  <dt>Draft {label}</dt><dd>{pending[field]}</dd>
                </div>)}
              </dl>}
              {!candidate && <p>No native source candidate is waiting for display.</p>}
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
            {candidate && <details className="cad-editor-source" open>
              <summary className="cad-editor-source-title">Pending native source · awaiting display</summary>
              {candidate.result.document.assets.map(asset => <section key={asset.id}>
                <h4>{asset.id} · revision {asset.revision}</h4><pre>{asset.source}</pre>
              </section>)}
            </details>}
            <details className="cad-editor-source">
              <summary className="cad-editor-source-title">Accepted history</summary>
              <p>State {snapshot.history.index + 1} of {snapshot.history.count} · {snapshot.history.bytes} bytes</p>
              <p>Document revision {accepted.document.revision} · {snapshot.downloadStatus}</p>
            </details>
            {lastError && <details className="cad-editor-source">
              <summary className="cad-editor-source-title">Last error details</summary>
              <p>{lastError.code}</p><pre>{diagnosticText(lastError)}</pre>
            </details>}
          </div>
        </DialogContent>
      </Dialog>
    </div>
    <div className="cad-editor-field">
      <Label htmlFor={`${id}-body`}>Object</Label>
      <select id={`${id}-body`} value={selection?.bodyId ?? ''} disabled={busy || surfaces.length === 0}
        data-testid="cad-editor-body" onChange={event => action(() => session.selectSurfacePole({ bodyId: event.target.value, uIndex: 0, vIndex: 0 }))}>
        {!selection && <option value="">Select a Surface</option>}
        {surfaces.map(binding => <option key={binding.bodyId} value={binding.bodyId}>
          {accepted.document.bodies.find(body => body.id === binding.bodyId)?.name ?? binding.bodyId}
        </option>)}
      </select>
    </div>
    {selection ? <>
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
        <Input id={`${id}-${field}`} type="text" inputMode="decimal" disabled={busy}
          value={pending[field] ?? numberText(selection.accepted[field])} data-testid={`cad-editor-${field}`}
          onChange={event => action(() => session.stageSurfacePoleField(field, event.target.value))}
          aria-describedby={Object.hasOwn(pending, field) ? `${id}-${field}-accepted` : undefined} />
        {Object.hasOwn(pending, field) && <span id={`${id}-${field}-accepted`} className="cad-editor-accepted">Current: {numberText(selection.accepted[field])}</span>}
      </div>)}
      <div className="cad-editor-actions">
        <Button type="button" disabled={busy || Object.keys(pending).length === 0} data-testid="cad-editor-apply"
          onClick={() => action(() => { session.prepareApply(); })}>{candidate ? 'Applying…' : 'Apply'}</Button>
        <Button type="button" variant="outline" disabled={busy || Object.keys(pending).length === 0}
          data-testid="cad-editor-discard" onClick={() => action(() => session.discardPending())}>Discard</Button>
      </div>
    </> : <p>Select a Surface to edit its control points.</p>}
    {errorMessage && <p className="cad-editor-error" role="alert">{errorMessage}</p>}
  </aside>;
}
