import { useEffect, useId, useRef, useState } from 'react';
import { createCadEditorPrismFeatureController, prismFeatureFieldText } from '../prism-feature-controller.js';
import type { CadEditorPrismFeatureController } from '../prism-feature-controller.js';
import type { CadEditorPrismFeatureSnapshot } from '../prism-feature-types.js';
import { createPrismFeatureDisplay } from '../prism-feature-display.js';
import { Button } from './ui/button.js';
import { Input } from './ui/input.js';
import { Label } from './ui/label.js';

export interface CadEditorPrismFeatureProps { initialAuthoredText: string; version?: 0 | 2 }
/** Native worker inspector with atomic trimmed-solid display candidates. */
export function CadEditorPrismFeature({ initialAuthoredText, version = 0 }: CadEditorPrismFeatureProps) {
  const controlId = useId();
  const viewport = useRef<HTMLDivElement | null>(null);
  const displayRef = useRef<ReturnType<typeof createPrismFeatureDisplay> | null>(null);
  const controller = useRef<CadEditorPrismFeatureController | null>(null);
  const [snapshot, setSnapshot] = useState<CadEditorPrismFeatureSnapshot | null>(null);
  const [fileText, setFileText] = useState(''), [replaceConfirmed, setReplaceConfirmed] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  useEffect(() => {
    if (!viewport.current) return;
    const display = createPrismFeatureDisplay(viewport.current); displayRef.current = display;
    const session = createCadEditorPrismFeatureController(display, () => display.aspect(), version); controller.current = session;
    const observer = new ResizeObserver(() => { try { display.resize(); } catch (error) { setLocalError(String(error)); } });
    observer.observe(viewport.current);
    const unsubscribe = session.subscribe(() => setSnapshot(session.getSnapshot()));
    setSnapshot(session.getSnapshot());
    void session.open(initialAuthoredText).catch(error => setLocalError(String(error)));
    return () => { observer.disconnect(); unsubscribe(); session.dispose(); display.dispose(); if (displayRef.current === display) displayRef.current = null; if (controller.current === session) controller.current = null; };
  }, [initialAuthoredText, version]);
  const action = (operation: (session: CadEditorPrismFeatureController) => unknown) => {
    setLocalError(null);
    try { if (controller.current) Promise.resolve(operation(controller.current)).catch(error => setLocalError(String(error))); }
    catch (error) { setLocalError(String(error)); }
  };
  const accepted = snapshot?.accepted, busy = snapshot?.busy ?? false;
  const draft = Object.keys(snapshot?.drafts ?? {}).length > 0;
  const selected = accepted?.document.nodes.find(node => node.id === snapshot?.selection?.nodeId);
  return <section className="barocss-cad-editor" aria-label="Affine prism feature inspector" style={{ padding: 24, overflow: 'auto', height: '100%' }}>
    <header><h1>{version === 2 ? 'Serial prism part v2' : 'Prism dimensions'}</h1><p>Authored sketches → prisms → through-slab subtraction{version === 2 ? ' → second-component chamfer' : ''} · mm</p></header>
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
    <div ref={viewport} style={{ position: 'relative', width: '100%', height: 400, marginTop: 16, background: '#06090d' }}
      onClick={event => {
        const display = displayRef.current, element = viewport.current;
        if (!display || !element || !snapshot?.accepted || busy) return;
        const rect = element.getBoundingClientRect(), size = display.dimensions();
        if (!rect.width || !rect.height) return;
        const x = Math.min(size.width - 1, Math.max(0, Math.floor((event.clientX - rect.left) * size.width / rect.width)));
        const y = Math.min(size.height - 1, Math.max(0, size.height - 1 - Math.floor((event.clientY - rect.top) * size.height / rect.height)));
        action(s => s.pick(size.width, size.height, x, y, snapshot.accepted!.document.revision));
      }} />
    {accepted && <>
      <div style={{ display: 'flex', gap: 8 }}>
        <Button disabled={busy} aria-pressed={snapshot?.view === 'source'} onClick={() => action(s => s.setView('source'))}>Source prism</Button>
        <Button disabled={busy} aria-pressed={snapshot?.view === 'result'} onClick={() => action(s => s.setView('result'))}>{version === 2 ? 'Finished part results' : 'Subtraction results'}</Button>
        <Button disabled={busy} onClick={() => action(s => s.setView(snapshot!.view))}>Fit</Button>
      </div>
      <p>{snapshot?.display?.scene.geometries.length === 0 ? 'Empty result: no remaining solid triangles.' : 'Trimmed native boundary triangles · 1 scene unit = 1 mm · approximate face selection'}</p>
      {snapshot?.faceSelection && <p>Selected {snapshot.faceSelection.role} / {snapshot.faceSelection.face.sourceId} / {snapshot.faceSelection.face.faceId}
        {' · '}Solid {snapshot.faceSelection.solidId}{' · '}{'kind' in snapshot.faceSelection.lineage && snapshot.faceSelection.lineage.kind === 'serial-part-v2' ? `finished chamfer from intermediate ${snapshot.faceSelection.lineage.parentSolidId}` : 'native component'}{' · '}document revision {snapshot.faceSelection.revision}. Fan diagonals are display-only, not BRep edges.</p>}
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
          <small>{parameter.bindings.map(binding => 'kind' in binding && binding.kind === 'prism-height' ? `${binding.prismNodeId} / prism height` : 'kind' in binding && binding.kind === 'chamfer-distance' ? `${binding.chamferNodeId} / chamfer distance` : `${binding.sketchNodeId}/${binding.constraintId}.${binding.axis}`).join(', ')}</small>
        </div>)}</div>
      </div>
      <h2>Native results</h2>
      {accepted.serial && <section aria-label="Serial component provenance">
        {accepted.document.version === 2 && <p>Original reference: {accepted.document.nodes[5].reference.sourceId} / {accepted.document.nodes[5].reference.sketchId} / {accepted.document.nodes[5].reference.segmentId} · source revision {accepted.document.nodes[5].reference.sourceRevision} · top edge</p>}
        <p>Intermediate second component: {accepted.serial.parentSolidId}. Finished retained Solid: {accepted.serial.finalSolidId}.</p>
        <p>Read-only original top edge: {accepted.serial.resolution.originalPrismNodeId} / {accepted.serial.resolution.originalTopEdgeId}. Current resolved component edge: {accepted.serial.resolution.componentEdgeId}. Rebuilt from complete source-use provenance; persistent naming is not certified.</p>
        <p>Finished volume: {accepted.serial.volumes.negative.numerator} / {accepted.serial.volumes.negative.denominator} mm³. Removed wedge: {accepted.serial.volumes.positive.numerator} / {accepted.serial.volumes.positive.denominator} mm³.</p>
      </section>}
      <p>These values come from the accepted native Solid result. Display meshes retain complete native face/source lineage; screen pixels and native OS file workflows are not verified by this flow.</p>
      {accepted.serial && <h3>Pre-chamfer subtraction-stage volumes</h3>}
      <dl style={{ overflowWrap: 'anywhere' }}>{Object.entries(accepted.volumes).map(([name, value]) => <div key={name}><dt>{name} volume (exact mm³)</dt><dd>{value.numerator} / {value.denominator}</dd></div>)}</dl>
      <ul>{accepted.components.map((component, index) => <li key={component.role}>
        {component.role}: {component.solidId} · {component.status} · selected wall {accepted.selectedWalls[index].sourceId}/{accepted.selectedWalls[index].sketchId}/{accepted.selectedWalls[index].segmentId} · source revision {accepted.selectedWalls[index].sourceRevision}
      </li>)}</ul>
      <p>History {snapshot!.history.index + 1} / {snapshot!.history.count}. Undo and Redo rebuild current qualified native geometry at a fresh revision.</p>
    </>}
    <details style={{ marginTop: 24 }}><summary>Authored source import / export</summary>
      <p>This source-only v{version} document preserves sketch constraints and feature recipes. Geometry and display caches are regenerated. Only this explicitly selected version is accepted. Copy/paste is available here; native file Save/Open is not validated by this inspector.</p>
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
