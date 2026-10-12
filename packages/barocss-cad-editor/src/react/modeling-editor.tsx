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
  const chamferChain = accepted?.source === 'model' && accepted.features.map(feature => feature.kind).join(',') === 'sketch,extrude,chamfer,chamfer'
    && ['frontDistance', 'backDistance', 'backY'].every(name => Object.hasOwn(accepted.parameters, name));
  const chamferSplit = accepted?.source === 'model' && accepted.features.map(feature => feature.kind).join(',') === 'sketch,extrude,chamfer,chamfer,split'
    && ['frontDistance', 'backDistance', 'splitAt'].every(name => Object.hasOwn(accepted.parameters, name));
  const derivedSplit = accepted?.source === 'model' && accepted.features.map(feature => feature.kind).join(',') === 'sketch,extrude,chamfer,chamfer,split'
    && ['width', 'offset', 'frontDistance', 'backDistance'].every(name => Object.hasOwn(accepted.parameters, name));
  const miterSplit = accepted?.source === 'model' && accepted.features.map(feature => feature.kind).join(',') === 'sketch,extrude,split'
    && Object.keys(accepted.parameters).length === 1 && Object.hasOwn(accepted.parameters, 'cutPosition')
    && JSON.parse(snapshot?.authoredText ?? '{}').nodes?.at(-1)?.plane === 'x+y';
  const bodyView = snapshot?.display && 'selectedOutput' in snapshot.display ? snapshot.display : null;
  const unionModel = accepted?.outputs.some(output => output.family === 'orthogonal-cell') ?? false;
  const unionDrivers = unionModel && (() => {
    const n = JSON.parse(snapshot?.authoredText ?? '{}').nodes;
    return n?.length === 5 && n[0].kind === 'sketch' && n[0].profile === 'rectangle'
      && JSON.stringify(n[0].min) === '[0,0]' && JSON.stringify(n[0].max) === '[32,8]'
      && n[1].kind === 'extrude' && n[1].sketch === 0 && n[1].height === 8
      && n[2].kind === 'sketch' && n[2].profile === 'rectangle' && n[2].min?.[0]?.parameter === 'legMinX' && n[2].min?.[1]?.parameter === 'legMinY'
      && n[2].max?.[0]?.op === 'add' && n[2].max[0].left?.parameter === 'legMinX' && n[2].max[0].right?.parameter === 'legWidth' && n[2].max[1] === 24
      && n[3].kind === 'extrude' && n[3].sketch === 2 && n[3].height?.parameter === 'legHeight'
      && n[4].kind === 'union' && n[4].left?.node === 1 && n[4].right?.node === 3 && n[4].left.side === 'solid' && n[4].right.side === 'solid';
  })();
  const holeModel = accepted?.outputs.some(output => output.family === 'stored-rational-plate-hole') ?? false;
  const configurableFinishes = accepted?.source === 'model' && accepted.suppression !== undefined
    && Object.keys(accepted.suppression).length === 2 && ['frontFinish', 'backFinish'].every(name => Object.hasOwn(accepted.suppression!, name))
    && accepted.features.filter(feature => feature.name !== undefined).every(feature => feature.kind === 'chamfer');
  return <section className="barocss-cad-editor" aria-label="CAD model editor" style={{ padding: 24, overflow: 'auto', height: '100%' }}>
    <header><h1>Model a part</h1><p>Sketch → extrude → cut, intersect, split, chamfer union or a qualified hole · named dimensions in mm</p></header>
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
        onChange={event => { setExample(event.target.value as CadEditorModelingExample); setReplaceExample(false); if (event.target.value === 'chamfer-split') setSplitAxis('x'); }}>
        <option value="cut-chamfer">Cut and chamfer a part</option>
        <option value="intersection">Intersect two extrusions</option>
        <option value="horizontal-split">Split a part</option>
        <option value="two-chamfer">Two chamfers on a part</option>
        <option value="chamfer-split">Split a beveled part</option>
        <option value="derived-split">Keep a beveled split centered</option>
        <option value="miter-split">Split a 45° XY miter</option>
        <option value="configurable-finishes">Configure rail finishes</option>
        <option value="union-bracket">Fuse an L-bracket</option>
        <option value="mounting-plate">Mounting plate with a through-hole</option>
      </select>
      {(example === 'horizontal-split' || example === 'chamfer-split') && <>
        <Label htmlFor={`${id}-split-axis`}>Split axis for the new example</Label>
        <select id={`${id}-split-axis`} value={splitAxis} disabled={busy}
          onChange={event => { setSplitAxis(event.target.value as CadEditorModelingSplitAxis); setReplaceExample(false); }}>
          <option value="z">{example === 'chamfer-split' ? 'Z · negative / positive' : 'Z · lower / upper'}</option>
          <option value="x">X · negative / positive</option>
          {example === 'horizontal-split' && <option value="y">Y · negative / positive</option>}
        </select>
        <p>Axis choice loads a new example after replacement acknowledgment; it does not edit the accepted part.</p>
      </>}
      <p>{example === 'union-bracket'
        ? 'Fuse two owned rectangular extrusions into one connected L-bracket. Edit the leg origin, width and height in integer millimetres. Base, leg and bracket remain saved; bracket is selected for this preset. Edge-only contact and disconnected material are refused.'
        : example === 'mounting-plate'
        ? 'Create an 80 × 40 × 8 mm rectangular mounting plate with one qualified stored-rational through-hole. Radius and center coordinates are editable; both blank and plate remain saved outputs, with plate selected for display. Exact native qualification can refuse otherwise plausible dimensions.'
        : example === 'configurable-finishes'
        ? 'Give the two result-owned chamfers names, then switch their finishing states on the accepted rail. The fixed X split keeps negative and positive outputs. Disabled operations still validate their candidate geometry.'
        : example === 'miter-split'
        ? 'Split a plain rectangular rail on the fixed 45° plane X + Y = cutPosition. The driver is a coordinate-sum threshold in mm, not perpendicular distance. Negative is below the sum; positive is above it. Both sides must remain nonempty.'
        : example === 'derived-split'
        ? 'Keep the X split at width × 0.5 + offset after both bevels. Edit width and offset as numeric drivers; the formula and negative/positive outputs stay fixed. No separate splitAt field is needed.'
        : example === 'chamfer-split'
        ? 'Split the finished two-chamfer rectangle into negative and positive bodies. X starts at 16 mm; Z starts at 4 mm. Both sides must have positive volume. This preset offers the measured X/Z cases; the plain split example still offers Y.'
        : example === 'horizontal-split'
        ? splitAxis === 'z' ? 'Split one direct XY extrusion at a Z height into lower and upper bodies. Both named sides must have positive volume.'
          : 'Split one direct XY extrusion at an X or Y coordinate into negative and positive bodies. Negative is the lower-coordinate side.'
        : example === 'intersection'
          ? 'Intersection keeps only the positive-volume overlap of two direct convex XY extrusions. Empty or touching-only results are refused.'
          : example === 'two-chamfer'
            ? 'Chamfer opposite top edges of a rectangular part in sequence. The second edge belongs to the first result. frontDistance and backDistance are bevel distances; backY selects the second edge by its Y coordinate.'
            : 'Cut a through-slab from a part, then chamfer one supported edge. Both outside components remain named outputs.'}</p>
      {accepted && <Label><input type="checkbox" checked={replaceExample} disabled={busy}
        onChange={event => setReplaceExample(event.target.checked)} /> Replace accepted model and discard its history and pending dimensions</Label>}
      <div><Button disabled={busy || (!!accepted && !replaceExample)} onClick={() => action(async s => {
        await s.example(example, example === 'horizontal-split' || example === 'chamfer-split' ? splitAxis : undefined); if (!s.getSnapshot().error) setReplaceExample(false);
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
      {bodyView && <fieldset disabled={busy}>
        <legend>Visible output body</legend>
        <Label htmlFor={`${id}-visible-output`}>Choose one output to inspect</Label>
        <select id={`${id}-visible-output`} value={bodyView.selectedOutput} disabled={busy}
          onChange={event => action(s => s.viewOutput(event.target.value, snapshot!.generation))}>
          {accepted.outputs.map(output => <option key={output.name} value={output.name}>{output.name} · {output.family}</option>)}
        </select>
        <p role="status">Visible: {bodyView.selectedOutput} · {accepted.outputs.find(output => output.name === bodyView.selectedOutput)?.family}. Other outputs are hidden, not removed.</p>
        <p>Changing this view preserves saved outputs, pending dimensions and model history. Opening a file selects its last saved output; the mounting-plate example selects plate and the union preset selects bracket. Reopen this union file, then choose bracket to view its fused result.</p>
      </fieldset>}
      {unionModel && <p>The union has restricted integer-cell material and exact integer volume. Its complete source-qualified panel preview is limited to64 panels (the native provider permits72). Face picks identify generated panels and their contributing native operand faces; they do not preserve the original convex face IDs.</p>}
      {holeModel && <p>The plate has a qualified stored-rational genus-one boundary. Its seven-face preview is sampled and faceted; the preview itself retains uncertified geometry/topology flags. Certified volume is unavailable.</p>}
      {configurableFinishes && <fieldset disabled={busy || draft}>
        <legend>Rail finishes</legend>
        <p>Front: {accepted.suppression!.frontFinish ? 'off' : 'on'} · Back: {accepted.suppression!.backFinish ? 'off' : 'on'}</p>
        {draft && <p>Apply or discard pending dimensions before configuring finishes.</p>}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[['Both on', false, false], ['Front only', false, true], ['Back only', true, false], ['Both off', true, true]].map(([label, front, back]) =>
            <Button key={String(label)} disabled={busy || draft} aria-pressed={accepted.suppression!.frontFinish === front && accepted.suppression!.backFinish === back}
              onClick={() => action(s => s.configureFinishes({ frontFinish: front as boolean, backFinish: back as boolean }))}>{label}</Button>)}
        </div>
        <p>Disabled chamfers still validate. Invalid edge selection or geometry is refused without replacing this model.</p>
      </fieldset>}
      {accepted.source === 'legacy' && <p>This file uses its original compatibility reader. Saving preserves its authored format and modeling semantics.</p>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 24 }}>
        <div><h2>Named dimensions</h2>{Object.entries(accepted.parameters).map(([name, value]) => <div key={name} style={{ marginBottom: 16 }}>
          <Label htmlFor={`${id}-${name}`}>{unionDrivers && name === 'legMinX' ? 'legMinX · leg origin X' : unionDrivers && name === 'legMinY' ? 'legMinY · leg origin Y' : unionDrivers && name === 'legWidth' ? 'legWidth · leg X width' : unionDrivers && name === 'legHeight' ? 'legHeight · extrusion height' : (chamferChain || configurableFinishes) && name === 'backY' ? 'backY · edge-selection Y coordinate' : (chamferChain || chamferSplit || derivedSplit || configurableFinishes) && name === 'frontDistance' ? 'frontDistance · front bevel distance' : (chamferChain || chamferSplit || derivedSplit || configurableFinishes) && name === 'backDistance' ? 'backDistance · back bevel distance' : chamferSplit && name === 'splitAt' ? 'splitAt · selected-axis split coordinate' : derivedSplit && name === 'width' ? 'width · rail X size' : derivedSplit && name === 'offset' ? 'offset · X displacement from center' : miterSplit && name === 'cutPosition' ? 'cutPosition · X + Y threshold' : name} (mm)</Label>
          <Input id={`${id}-${name}`} disabled={busy} inputMode="decimal"
            value={Object.hasOwn(snapshot?.drafts ?? {}, name) ? snapshot!.drafts[name] : Object.is(value, -0) ? '-0' : String(value)}
            onChange={event => action(s => s.stage(name, event.target.value))}
            onKeyDown={event => { if (event.key === 'Escape') action(s => s.discard()); }} />
        </div>)}</div>
        <aside><h2>Feature sequence</h2><ol>{accepted.features.map(feature => <li key={feature.index}>
          <Button variant="ghost" disabled={busy} aria-pressed={snapshot?.selection === feature.index}
            onClick={() => action(s => s.select(feature.index, snapshot!.generation))}>{feature.kind}{feature.name === undefined ? '' : ` · ${feature.name} (${feature.suppressed ? 'off' : 'on'})`}</Button>
          {snapshot?.selection === feature.index && <p>{feature.dependencies.length ? `Uses earlier steps ${feature.dependencies.map(i => i + 1).join(', ')}` : 'Original sketch intent'}</p>}
        </li>)}</ol></aside>
      </div>
      <h2>Output bodies</h2><dl>{accepted.outputs.map(output => <div key={output.name}><dt>{output.name}</dt>
        <dd>{output.family === 'stored-rational-plate-hole' ? 'Certified volume unavailable' : output.volumeMM3 ? `${output.volumeMM3.numerator} / ${output.volumeMM3.denominator} mm³` : 'Empty'}</dd></div>)}</dl>
      {snapshot?.faceSelection && <details><summary>Selected {snapshot.faceSelection.role} face</summary>
        {'family' in snapshot.faceSelection && snapshot.faceSelection.family === 'orthogonal-cell'
          ? <p>Native union body {snapshot.faceSelection.solidId}; generated panel {snapshot.faceSelection.provenance.id}; source {snapshot.faceSelection.provenance.query.sourceId}, model {snapshot.faceSelection.provenance.query.modelId}, surface {snapshot.faceSelection.provenance.query.surfaceId}. Contributing operand faces: {snapshot.faceSelection.provenance.lineage.map(link => `${link.operand}: ${link.sourceId}/${link.globalFaceId} (${link.localFaceId}, ${link.surfaceId})`).join('; ')}. This is an approximate triangle hit with copied native lineage.</p>
          : 'reference' in snapshot.faceSelection
          ? <p>Native body {snapshot.faceSelection.solidId}; face {snapshot.faceSelection.reference.nativeFaceId}; surface {snapshot.faceSelection.provenance.nativeSurfaceId}. Loops: {snapshot.faceSelection.provenance.nativeLoopIds.join(', ')}. Edges: {snapshot.faceSelection.provenance.nativeEdgeIds.join(', ')}. This is an approximate sampled-triangle hit with original native face provenance, not a Solid certificate or a new BRep edge.</p>
          : <p>Native Solid {snapshot.faceSelection.solidId}; face {snapshot.faceSelection.face.sourceId}/{snapshot.faceSelection.face.faceId}. Fan diagonals are display-only, not BRep edges. Selection belongs to this accepted model.</p>}
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
