import { useEffect, useId, useRef, useState } from 'react';
import { createCadEditorModelingController } from '../modeling-controller.js';
import type { CadEditorModelingController, CadEditorModelingSnapshot } from '../modeling-controller.js';
import type { CadEditorModelingExample, CadEditorModelingSplitAxis } from '../modeling-engine.js';
import { createPrismFeatureDisplay } from '../prism-feature-display.js';
import { Button } from './ui/button.js';
import { Input } from './ui/input.js';
import { Label } from './ui/label.js';

export interface CadEditorModelingProps { initialAuthoredText?: string }
/** Named dimensions over the single modeling API, using the existing native display. */
export function CadEditorModeling({ initialAuthoredText }: CadEditorModelingProps) {
  const id = useId(), viewport = useRef<HTMLDivElement | null>(null);
  const controller = useRef<CadEditorModelingController | null>(null);
  const displayRef = useRef<ReturnType<typeof createPrismFeatureDisplay> | null>(null);
  const [snapshot, setSnapshot] = useState<CadEditorModelingSnapshot | null>(null);
  const [example, setExample] = useState<CadEditorModelingExample>('cut-chamfer');
  const [splitAxis, setSplitAxis] = useState<CadEditorModelingSplitAxis>('z');
  const [replaceExample, setReplaceExample] = useState(false);
  const [source, setSource] = useState(''), [confirmed, setConfirmed] = useState(false), [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!viewport.current) return;
    const display = createPrismFeatureDisplay(viewport.current); displayRef.current = display;
    const session = createCadEditorModelingController(display, () => display.aspect()); controller.current = session;
    const observer = new ResizeObserver(() => { try { display.resize(); } catch (cause) { setError(String(cause)); } });
    observer.observe(viewport.current);
    const unsubscribe = session.subscribe(() => setSnapshot(session.getSnapshot())); setSnapshot(session.getSnapshot());
    void (initialAuthoredText === undefined ? session.example() : session.open(initialAuthoredText)).catch(cause => setError(String(cause)));
    return () => { observer.disconnect(); unsubscribe(); session.dispose(); display.dispose(); if (controller.current === session) controller.current = null; if (displayRef.current === display) displayRef.current = null; };
  }, [initialAuthoredText]);
  const action = (operation: (session: CadEditorModelingController) => unknown) => {
    setError(null); try { if (controller.current) Promise.resolve(operation(controller.current)).catch(cause => setError(String(cause))); }
    catch (cause) { setError(String(cause)); }
  };
  useEffect(() => { setReplaceExample(false); }, [snapshot?.generation]);
  const accepted = snapshot?.accepted, busy = snapshot?.busy ?? false, draft = Object.keys(snapshot?.drafts ?? {}).length > 0;
  return <section className="barocss-cad-editor" aria-label="CAD model editor" style={{ padding: 24, overflow: 'auto', height: '100%' }}>
    <header><h1>Model a part</h1><p>Sketch → extrude → cut, intersect, split or chamfer · named dimensions in mm</p></header>
    <p role="status" aria-live="polite">{busy ? 'Computing native geometry in a dedicated worker… You can cancel.' : accepted ? draft ? 'Dimension changes pending' : 'Accepted model' : 'No accepted model'}</p>
    {(error || snapshot?.error) && <p role="alert">{error ?? snapshot?.error}</p>}
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <Button disabled={busy || !draft} onClick={() => action(s => s.apply())}>Apply dimensions</Button>
      <Button disabled={busy || !draft} onClick={() => action(s => s.discard())}>Discard draft</Button>
      <Button disabled={busy || draft || !snapshot?.history.canUndo} onClick={() => action(s => s.undo())}>Undo</Button>
      <Button disabled={busy || draft || !snapshot?.history.canRedo} onClick={() => action(s => s.redo())}>Redo</Button>
      <Button disabled={!busy} onClick={() => action(s => s.cancel())}>Cancel computation</Button>
      {!accepted && !busy && <Button onClick={() => action(s => initialAuthoredText === undefined ? s.example() : s.open(initialAuthoredText))}>Retry model</Button>}
    </div>
    <details style={{ marginTop: 16 }}><summary>Modeling examples</summary>
      <Label htmlFor={`${id}-example`}>Choose an example</Label>
      <select id={`${id}-example`} value={example} disabled={busy}
        onChange={event => { setExample(event.target.value as CadEditorModelingExample); setReplaceExample(false); }}>
        <option value="cut-chamfer">Cut and chamfer a part</option>
        <option value="intersection">Intersect two extrusions</option>
        <option value="horizontal-split">Split a part</option>
      </select>
      {example === 'horizontal-split' && <>
        <Label htmlFor={`${id}-split-axis`}>Split axis for the new example</Label>
        <select id={`${id}-split-axis`} value={splitAxis} disabled={busy}
          onChange={event => { setSplitAxis(event.target.value as CadEditorModelingSplitAxis); setReplaceExample(false); }}>
          <option value="z">Z · lower / upper</option>
          <option value="x">X · negative / positive</option>
          <option value="y">Y · negative / positive</option>
        </select>
        <p>Axis choice loads a new example after replacement acknowledgment; it does not edit the accepted part.</p>
      </>}
      <p>{example === 'horizontal-split'
        ? splitAxis === 'z' ? 'Split one direct XY extrusion at a Z height into lower and upper bodies. Both named sides must have positive volume.'
          : 'Split one direct XY extrusion at an X or Y coordinate into negative and positive bodies. Negative is the lower-coordinate side.'
        : example === 'intersection'
          ? 'Intersection keeps only the positive-volume overlap of two direct convex XY extrusions. Empty or touching-only results are refused.'
          : 'Cut a through-slab from a part, then chamfer one supported edge. Both outside components remain named outputs.'}</p>
      {accepted && <Label><input type="checkbox" checked={replaceExample} disabled={busy}
        onChange={event => setReplaceExample(event.target.checked)} /> Replace accepted model and discard its history and pending dimensions</Label>}
      <div><Button disabled={busy || (!!accepted && !replaceExample)} onClick={() => action(async s => {
        await s.example(example, example === 'horizontal-split' ? splitAxis : undefined); if (!s.getSnapshot().error) setReplaceExample(false);
      })}>Load example</Button></div>
    </details>
    <div ref={viewport} style={{ position: 'relative', width: '100%', height: 400, marginTop: 16, background: '#06090d' }}
      onClick={event => {
        const element = viewport.current, display = displayRef.current;
        if (!element || !display || !snapshot?.accepted || busy) return;
        const rect = element.getBoundingClientRect(), size = display.dimensions(); if (!rect.width || !rect.height) return;
        const x = Math.min(size.width - 1, Math.max(0, Math.floor((event.clientX - rect.left) * size.width / rect.width)));
        const y = Math.min(size.height - 1, Math.max(0, size.height - 1 - Math.floor((event.clientY - rect.top) * size.height / rect.height)));
        action(s => s.pick(size.width, size.height, x, y, snapshot.generation));
      }} />
    {accepted && <>
      <p>Named output bodies · trimmed native triangles · 1 scene unit = 1 mm · approximate face selection</p>
      {accepted.source === 'legacy' && <p>This file uses its original compatibility reader. Saving preserves its authored format and modeling semantics.</p>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 24 }}>
        <div><h2>Named dimensions</h2>{Object.entries(accepted.parameters).map(([name, value]) => <div key={name} style={{ marginBottom: 16 }}>
          <Label htmlFor={`${id}-${name}`}>{name} (mm)</Label>
          <Input id={`${id}-${name}`} disabled={busy} inputMode="decimal"
            value={Object.hasOwn(snapshot?.drafts ?? {}, name) ? snapshot!.drafts[name] : Object.is(value, -0) ? '-0' : String(value)}
            onChange={event => action(s => s.stage(name, event.target.value))}
            onKeyDown={event => { if (event.key === 'Escape') action(s => s.discard()); }} />
        </div>)}</div>
        <aside><h2>Feature sequence</h2><ol>{accepted.features.map(feature => <li key={feature.index}>
          <Button variant="ghost" disabled={busy} aria-pressed={snapshot?.selection === feature.index}
            onClick={() => action(s => s.select(feature.index, snapshot!.generation))}>{feature.kind}</Button>
          {snapshot?.selection === feature.index && <p>{feature.dependencies.length ? `Uses earlier steps ${feature.dependencies.map(i => i + 1).join(', ')}` : 'Original sketch intent'}</p>}
        </li>)}</ol></aside>
      </div>
      <h2>Output bodies</h2><dl>{accepted.outputs.map(output => <div key={output.name}><dt>{output.name}</dt>
        <dd>{output.volumeMM3 ? `${output.volumeMM3.numerator} / ${output.volumeMM3.denominator} mm³` : 'Empty'}</dd></div>)}</dl>
      {snapshot?.faceSelection && <details><summary>Selected {snapshot.faceSelection.role} face</summary>
        <p>Native Solid {snapshot.faceSelection.solidId}; face {snapshot.faceSelection.face.sourceId}/{snapshot.faceSelection.face.faceId}. Fan diagonals are display-only, not BRep edges. Selection belongs to this accepted model.</p>
      </details>}
      <p>History {snapshot!.history.index + 1} / {snapshot!.history.count}. Unsupported geometry or ambiguous edge selection is refused; the accepted model stays intact.</p>
    </>}
    <details style={{ marginTop: 24 }}><summary>Save or open a model</summary>
      <p>Save authored dimensions and modeling intent. Native geometry and display caches are rebuilt on open. Supported old files are detected internally; unsupported formats are refused without conversion.</p>
      <div style={{ display: 'flex', gap: 8 }}>
        <Button disabled={busy || !snapshot?.authoredText} onClick={() => { setSource(snapshot!.authoredText!); setConfirmed(false); }}>Show saved model</Button>
        <Button disabled={busy || !snapshot?.authoredText} onClick={() => {
          const url = URL.createObjectURL(new Blob([snapshot!.authoredText!], { type: 'application/json' }));
          const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'part.cad.json'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
        }}>Download model</Button>
      </div>
      <Label htmlFor={`${id}-model`}>Saved model data</Label>
      <textarea id={`${id}-model`} rows={12} spellCheck={false} disabled={busy} maxLength={262144}
        style={{ width: '100%', fontFamily: 'monospace' }} value={source} onChange={event => { setSource(event.target.value); setConfirmed(false); }} />
      <Label><input type="checkbox" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} /> Replace accepted model and discard its history and pending dimensions</Label>
      <div><Button disabled={busy || !source.trim() || (!!accepted && !confirmed)}
        onClick={() => action(async s => { await s.open(source); setConfirmed(false); })}>Open saved model</Button></div>
      <p>Browser rendering and physical file dialogs need separate device verification.</p>
    </details>
  </section>;
}
