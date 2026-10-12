import { useEffect, useId, useRef, useState } from 'react';
import { createCadEditorPrismFeatureController, prismFeatureFieldText } from '../prism-feature-controller.js';
import type { CadEditorPrismFeatureController } from '../prism-feature-controller.js';
import type { CadEditorPrismFeatureSnapshot } from '../prism-feature-types.js';
import { Button } from './ui/button.js';
import { Input } from './ui/input.js';
import { Label } from './ui/label.js';

export interface CadEditorPrismFeatureProps { initialAuthoredText: string }
/** Real native model inspector; whole convex Solid viewport admission is a separate provider. */
export function CadEditorPrismFeature({ initialAuthoredText }: CadEditorPrismFeatureProps) {
  const controlId = useId();
  const controller = useRef<CadEditorPrismFeatureController | null>(null);
  const [snapshot, setSnapshot] = useState<CadEditorPrismFeatureSnapshot | null>(null);
  const [fileText, setFileText] = useState(''), [replaceConfirmed, setReplaceConfirmed] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  useEffect(() => {
    const session = createCadEditorPrismFeatureController(); controller.current = session;
    const unsubscribe = session.subscribe(() => setSnapshot(session.getSnapshot()));
    setSnapshot(session.getSnapshot());
    void session.open(initialAuthoredText).catch(error => setLocalError(String(error)));
    return () => { unsubscribe(); session.dispose(); if (controller.current === session) controller.current = null; };
  }, [initialAuthoredText]);
  const action = (operation: (session: CadEditorPrismFeatureController) => unknown) => {
    setLocalError(null);
    try { if (controller.current) Promise.resolve(operation(controller.current)).catch(error => setLocalError(String(error))); }
    catch (error) { setLocalError(String(error)); }
  };
  const accepted = snapshot?.accepted, busy = snapshot?.busy ?? false;
  const draft = Object.keys(snapshot?.drafts ?? {}).length > 0;
  const selected = accepted?.document.nodes.find(node => node.id === snapshot?.selection?.nodeId);
  return <section className="barocss-cad-editor" aria-label="Affine prism feature inspector" style={{ padding: 24, overflow: 'auto', height: '100%' }}>
    <header><h1>Prism dimensions</h1><p>Authored sketches → prisms → through-slab subtraction · mm</p></header>
    <p role="status" aria-live="polite">{busy ? 'Computing native geometry in a dedicated worker… You can cancel.'
      : accepted ? `${accepted.document.id} · revision ${accepted.document.revision} · ${draft ? 'Dimension draft pending' : 'Accepted model'}` : 'No accepted model'}</p>
    {(localError || snapshot?.error) && <p role="alert">{localError ?? snapshot?.error}</p>}
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <Button disabled={busy || !draft} onClick={() => action(s => s.apply())}>Apply dimensions</Button>
      <Button disabled={busy || !draft} onClick={() => action(s => s.discard())}>Discard draft</Button>
      <Button disabled={busy || draft || !snapshot?.history.canUndo} onClick={() => action(s => s.undo())}>Undo</Button>
      <Button disabled={busy || draft || !snapshot?.history.canRedo} onClick={() => action(s => s.redo())}>Redo</Button>
      <Button disabled={!busy} onClick={() => action(s => s.cancel())}>Cancel computation</Button>
      {!accepted && !busy && <Button onClick={() => action(s => s.open(initialAuthoredText))}>Retry initial model</Button>}
    </div>
    {accepted && <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 24, marginTop: 24 }}>
        <aside><h2>Feature tree</h2><ul>{accepted.document.nodes.map(node => <li key={node.id}>
          <Button variant="ghost" disabled={busy} aria-pressed={selected?.id === node.id}
            onClick={() => action(s => s.select(node.id, accepted.document.revision))}>{node.id} · {node.kind}</Button>
        </li>)}</ul>
          {selected && <p>Selected {selected.id}. Depends on: {accepted.dependencies.find(item => item.nodeId === selected.id)?.dependsOn.join(', ') || 'original sketch intent'}</p>}
          <p>Selection is qualified by document {snapshot?.selection?.documentId}, revision {snapshot?.selection?.revision}</p>
        </aside>
        <div><h2>Named dimensions</h2>{accepted.document.parameters.map(parameter => <div key={parameter.id} style={{ marginBottom: 16 }}>
          <Label htmlFor={`${controlId}-${parameter.id}`}>{parameter.id} (mm)</Label>
          <Input id={`${controlId}-${parameter.id}`} disabled={busy} inputMode="decimal"
            value={prismFeatureFieldText(snapshot?.drafts ?? {}, parameter)}
            onChange={event => action(s => s.stage(parameter.id, event.target.value))}
            onKeyDown={event => { if (event.key === 'Escape') action(s => s.discard()); }} />
          <small>{parameter.bindings.map(binding => `${binding.sketchNodeId}/${binding.constraintId}.${binding.axis}`).join(', ')}</small>
        </div>)}</div>
      </div>
      <h2>Native results</h2>
      <p>3D preview is unavailable for this profile. A source-qualified convex-loop tessellation and whole-component display adapter is still required. These values come from the accepted native Solid result.</p>
      <dl style={{ overflowWrap: 'anywhere' }}>{Object.entries(accepted.volumes).map(([name, value]) => <div key={name}><dt>{name} volume (exact mm³)</dt><dd>{value.numerator} / {value.denominator}</dd></div>)}</dl>
      <ul>{accepted.components.map((component, index) => <li key={component.role}>
        {component.role}: {component.solidId} · {component.status} · selected wall {accepted.selectedWalls[index].sourceId}/{accepted.selectedWalls[index].sketchId}/{accepted.selectedWalls[index].segmentId} · source revision {accepted.selectedWalls[index].sourceRevision}
      </li>)}</ul>
      <p>History {snapshot!.history.index + 1} / {snapshot!.history.count}. Undo and Redo rebuild current qualified native geometry at a fresh revision.</p>
    </>}
    <details style={{ marginTop: 24 }}><summary>Authored source import / export</summary>
      <p>This source-only v0 document preserves sketch constraints and feature recipes. Geometry and display caches are regenerated. Copy/paste is available here; native file Save/Open is not validated by this inspector.</p>
      <Label htmlFor={`${controlId}-source`}>Authored JSON draft (may differ from the accepted model)</Label>
      <textarea id={`${controlId}-source`} rows={12} spellCheck={false} disabled={busy} maxLength={262144}
        style={{ width: '100%', fontFamily: 'monospace' }} value={fileText}
        onChange={event => { setFileText(event.target.value); setReplaceConfirmed(false); }} />
      <div><Button disabled={busy || !snapshot?.authoredText} onClick={() => { setFileText(snapshot!.authoredText!); setReplaceConfirmed(false); }}>Show accepted source</Button></div>
      <Label><input type="checkbox" checked={replaceConfirmed} disabled={busy} onChange={event => setReplaceConfirmed(event.target.checked)} /> Replace accepted model and discard its history and pending dimensions</Label>
      <div><Button disabled={busy || !fileText.trim() || (!!accepted && !replaceConfirmed)}
        onClick={() => action(async s => { await s.open(fileText); setReplaceConfirmed(false); })}>Open authored source</Button></div>
    </details>
  </section>;
}
