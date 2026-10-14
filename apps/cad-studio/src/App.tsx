import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EngineClient } from './engine/client';
import { featureLabel, fmt, prefixDoc, starterDoc, withNode, type ModelNode, type StudioDoc } from './engine/doc';
import type { BodyResult } from './engine/evaluate';
import type { FriendlyError } from './engine/errors';
import type { Vec3 } from './engine/mesh';
import { commands, refOf, selectedBodies, type Command, type Ctx, type Selection, type Values } from './app/commands';
import { Viewport, type SketchShape, type SketchState, type SketchTool, type ViewportHandle } from './viewport/Viewport';
import { Icon, Kbd } from './ui/atoms';
import { Hud } from './ui/Hud';
import { Palette } from './ui/Palette';
import { downloadBytes, meshToStl } from './ui/files';

const emptySel: Selection = { faces: [], edges: [], bodies: [] };

interface Active { cmd: Command; values: Values; preview: 'busy' | 'ok' | 'error'; error?: FriendlyError; ctx: Ctx }

export function App() {
  const engine = useMemo(() => new EngineClient(), []);
  const viewport = useRef<ViewportHandle>(null);
  const [doc, setDoc] = useState<StudioDoc>(starterDoc);
  const [marker, setMarker] = useState<number | null>(null);
  const [undo, setUndo] = useState<{ doc: StudioDoc; marker: number | null }[]>([]);
  const [redo, setRedo] = useState<{ doc: StudioDoc; marker: number | null }[]>([]);
  const [bodies, setBodies] = useState<BodyResult[]>([]);
  const [busy, setBusy] = useState(true);
  const [selection, setSelection] = useState<Selection>(emptySel);
  const [pick, setPick] = useState<Vec3 | null>(null);
  const [active, setActive] = useState<Active | null>(null);
  const [previewBodies, setPreviewBodies] = useState<BodyResult[] | null>(null);
  const [sketch, setSketch] = useState<SketchState | null>(null);
  const [palette, setPalette] = useState(false);
  const [cursor, setCursor] = useState<Vec3 | null>(null);
  const [toast, setToast] = useState<FriendlyError | null>(null);
  const [fileName, setFileName] = useState('Bracket-01');
  const [dirty, setDirty] = useState(false);
  const [ortho, setOrtho] = useState(false);
  const [editNode, setEditNode] = useState<number | null>(null);
  const [lastMs, setLastMs] = useState(0);
  const revision = useRef(1);
  const fileInput = useRef<HTMLInputElement>(null);

  const evaluated = useMemo(() => prefixDoc(doc, marker ?? doc.nodes.length), [doc, marker]);

  // Evaluate the accepted document whenever it or the rollback marker changes.
  useEffect(() => {
    let live = true; setBusy(true);
    engine.evaluate(evaluated, revision.current++).then(result => {
      if (!live || !result) return;
      setBusy(false); setLastMs(result.ms);
      if (result.ok) { setBodies(result.bodies); setSelection(emptySel); }
      else setToast(result.error);
    });
    return () => { live = false; };
  }, [engine, evaluated]);

  const ctx: Ctx = { doc: evaluated, bodies, selection, pick: pick ?? undefined };

  const commit = useCallback((next: StudioDoc) => {
    const dropped = marker !== null ? doc.nodes.length - marker : 0;
    setUndo(u => [...u.slice(-49), { doc, marker }]); setRedo([]);
    setDoc(next); setMarker(null); setDirty(true); setEditNode(null);
    if (dropped > 0) setToast({ title: `Removed ${dropped} later feature${dropped > 1 ? 's' : ''}`, hint: 'You added a feature while rolled back. Undo restores them.', detail: '' });
  }, [doc, marker]);

  const cancel = useCallback(() => { setActive(null); setPreviewBodies(null); setSketch(null); }, []);

  // Live preview: re-evaluate the candidate whenever HUD values change.
  useEffect(() => {
    if (!active?.cmd.build) return;
    let live = true;
    const missing = (active.cmd.fields?.(active.ctx) ?? []).find(f => f.kind !== 'choice' && (active.values[f.key] === '' || !Number.isFinite(Number(active.values[f.key]))));
    if (missing) { setPreviewBodies(null); setActive(a => a && { ...a, preview: 'error', error: { title: 'Enter a value', hint: `${missing.label} is empty.`, detail: '' } }); return; }
    const t = setTimeout(() => {
      let candidate: StudioDoc;
      try { candidate = active.cmd.build!(active.ctx, active.values); } catch (e) { setActive(a => a && { ...a, preview: 'error', error: { title: 'Invalid input', hint: String(e), detail: '' } }); return; }
      engine.evaluate(candidate, revision.current++).then(result => {
        if (!live || !result) return;
        if (result.ok) { setPreviewBodies(result.bodies); setActive(a => a && { ...a, preview: 'ok', error: undefined }); }
        else { setPreviewBodies(null); setActive(a => a && { ...a, preview: 'error', error: result.error }); }
      });
    }, 140);
    return () => { live = false; clearTimeout(t); };
  }, [active?.values, active?.cmd, engine]);

  const apply = useCallback(() => {
    if (!active?.cmd.build || active.preview !== 'ok') return;
    commit(active.cmd.build(active.ctx, active.values)); setActive(null); setPreviewBodies(null); setSketch(null);
  }, [active, commit]);

  const start = useCallback((cmd: Command) => {
    setPalette(false);
    const avail = cmd.available(ctx);
    if (!avail.ok) { setToast({ title: `${cmd.label} can’t run here`, hint: avail.reason, detail: '' }); return; }
    if (cmd.action === 'sketch') {
      const f = selection.faces[0]; const face = f && bodies[f.body]?.mesh.faces[f.face];
      const planeZ = face && face.kind === 'plane' && face.normal[2] > 0.99 ? Math.round(face.centroid[2]) : 0;
      setSketch({ planeZ, tool: 'rectangle', shape: null }); setActive(null); setPreviewBodies(null);
      viewport.current?.setView('top'); return;
    }
    if (cmd.action === 'measure') { setToast({ title: 'Measure', hint: 'Select a face or an edge; its size appears in the Selection card.', detail: '' }); return; }
    if (!cmd.fields) {
      const candidate = cmd.build!(ctx, {});
      engine.evaluate(candidate, revision.current++).then(result => {
        if (!result) return;
        if (result.ok) commit(candidate); else setToast(result.error);
      });
      return;
    }
    setActive({ cmd, values: cmd.defaults?.(ctx) ?? {}, preview: 'busy', ctx: { ...ctx } });
  }, [ctx, selection, bodies, engine, commit]);

  const finishSketch = useCallback(() => {
    const s = sketch?.shape; if (!sketch || !s) { setSketch(null); return; }
    const node: ModelNode | null = s.kind === 'rectangle'
      ? (Math.abs(s.a[0] - s.b[0]) < 1 || Math.abs(s.a[1] - s.b[1]) < 1 ? null
        : { kind: 'sketch', profile: 'rectangle', min: [Math.min(s.a[0], s.b[0]), Math.min(s.a[1], s.b[1])], max: [Math.max(s.a[0], s.b[0]), Math.max(s.a[1], s.b[1])] })
      : s.kind === 'circle' ? { kind: 'sketch', profile: 'circle', center: s.c, radius: s.r }
        : s.closed && s.points.length >= 3 ? { kind: 'sketch', profile: 'polygon', points: s.points } : null;
    if (!node) { setToast({ title: 'Finish the profile first', hint: 'Draw a closed rectangle, circle or polygon on the sketch plane.', detail: '' }); return; }
    const planeZ = sketch.planeZ;
    const extrude: Command = {
      id: 'extrude', label: 'Extrude', icon: 'height', group: 'create', available: () => ({ ok: true }),
      fields: () => [{ key: 'h', label: 'Distance', kind: 'mm', min: 1 }],
      defaults: () => ({ h: 8 }),
      build: (c, v) => { const d = withNode(c.doc, node); return withNode(d, { kind: 'extrude', sketch: d.nodes.length - 1, height: Number(v.h), ...(planeZ ? { from: planeZ } : {}) }); },
    };
    setSketch(null);
    setActive({ cmd: extrude, values: { h: 8 }, preview: 'busy', ctx: { ...ctx } });
  }, [sketch, ctx]);

  const onPick = useCallback((hit: { face: { body: number; face: number } | null; edge: { body: number; edge: number } | null; point: Vec3 | null }, additive: boolean) => {
    if (active) return;
    setPick(hit.point);
    setSelection(prev => {
      if (!hit.face && !hit.edge) return emptySel;
      if (additive) {
        // Shift-click adds the whole body: used for Booleans between two bodies.
        const b = hit.face?.body ?? hit.edge!.body; const list = selectedBodies(prev);
        return { faces: [], edges: [], bodies: list.includes(b) ? list.filter(x => x !== b) : [...list, b] };
      }
      return hit.edge ? { faces: [], edges: [hit.edge], bodies: [] } : { faces: [hit.face!], edges: [], bodies: [] };
    });
  }, [active]);

  const doUndo = useCallback(() => {
    if (!undo.length) return; const last = undo[undo.length - 1];
    setRedo(r => [...r, { doc, marker }]); setUndo(u => u.slice(0, -1)); setDoc(last.doc); setMarker(last.marker); cancel();
  }, [undo, doc, marker, cancel]);
  const doRedo = useCallback(() => {
    if (!redo.length) return; const last = redo[redo.length - 1];
    setUndo(u => [...u, { doc, marker }]); setRedo(r => r.slice(0, -1)); setDoc(last.doc); setMarker(last.marker); cancel();
  }, [redo, doc, marker, cancel]);

  const save = () => { downloadBytes(new TextEncoder().encode(JSON.stringify(doc, null, 2)), `${fileName}.bcad`, 'application/json'); setDirty(false); };
  const open = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as StudioDoc;
      if (parsed.format !== 'barocss-cad-model' || !Array.isArray(parsed.nodes)) throw new Error('Not a BaroCSS model file.');
      commit({ ...parsed, outputs: prefixDoc(parsed, parsed.nodes.length).outputs }); setFileName(file.name.replace(/\.(bcad|json)$/, '')); setDirty(false);
      setTimeout(() => viewport.current?.fit(), 300);
    } catch (e) { setToast({ title: 'Could not open this file', hint: String(e instanceof Error ? e.message : e), detail: '' }); }
  };
  const exportStl = async () => {
    for (const body of bodies) {
      const kernel = await engine.stl(evaluated, body.key);
      downloadBytes(kernel ?? meshToStl(body.mesh, body.key), `${fileName}-${body.key}.stl`, 'model/stl');
    }
  };

  // Keyboard: Space palette, Enter apply, Esc cancel, letters run commands, F frames.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) doRedo(); else doUndo(); return; }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); return; }
      if (e.key === 'Escape') { if (palette) setPalette(false); else if (active || sketch) cancel(); else setSelection(emptySel); return; }
      if (e.key === 'Enter' && !palette) { if (sketch) { e.preventDefault(); finishSketch(); } else if (active) { e.preventDefault(); apply(); } return; }
      if (typing || palette) return;
      if (e.key === ' ') { e.preventDefault(); setPalette(true); return; }
      if (sketch) { const t = ({ r: 'rectangle', c: 'circle', p: 'polygon' } as Record<string, SketchTool>)[e.key.toLowerCase()]; if (t) setSketch(s => s && { ...s, tool: t, shape: null }); return; }
      if (e.key.toLowerCase() === 'f' && !e.shiftKey) { viewport.current?.fit(); return; }
      const cmd = commands.find(c => c.shortcut && c.shortcut.toLowerCase() === (e.shiftKey ? 'shift ' : '') + e.key.toLowerCase());
      if (cmd && !active) { e.preventDefault(); start(cmd); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const shownBodies = previewBodies ?? bodies;
  const shownSelection = previewBodies ? emptySel : selection;
  const gizmo = active?.cmd.id === 'move' && selectedBodies(active.ctx.selection).length === 1 ? (() => {
    const b = bodies[selectedBodies(active.ctx.selection)[0]]; const { min, max } = b.mesh.bounds;
    return { origin: [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, max[2]] as Vec3, values: [Number(active.values.x), Number(active.values.y), Number(active.values.z)] as Vec3,
      onDrag: (v: Vec3) => setActive(a => a && { ...a, values: { ...a.values, x: v[0], y: v[1], z: v[2] } }) };
  })() : null;

  const totalNodes = doc.nodes.length; const markerAt = marker ?? totalNodes;
  const sel1 = selection.faces[0] ? { kind: 'face' as const, body: bodies[selection.faces[0].body], face: bodies[selection.faces[0].body]?.mesh.faces[selection.faces[0].face] }
    : selection.edges[0] ? { kind: 'edge' as const, body: bodies[selection.edges[0].body], edge: bodies[selection.edges[0].body]?.mesh.edges[selection.edges[0].edge] } : null;
  const selBodies = selectedBodies(selection).map(i => bodies[i]).filter(Boolean);

  return (
    <div className="studio">
      <Viewport ref={viewport} bodies={shownBodies} selection={shownSelection} ghost={new Set()} sketch={sketch} gizmo={gizmo}
        onPick={onPick} onCursor={setCursor} onSketchShape={(shape: SketchShape | null) => setSketch(s => s && { ...s, shape })} />

      <header className="topbar">
        <span className="brand"><Icon name="deployed_code" className="accent" />barocss</span>
        <label className="doc-tab"><span className="sr">File name</span>
          <input value={fileName} onChange={e => setFileName(e.target.value)} size={Math.max(8, fileName.length)} />
          {dirty && <span className="dot" aria-label="Unsaved changes" />}</label>
        <div className="grow" />
        <div className="mode" role="group" aria-label="Mode">
          <button className={!sketch ? 'on' : ''} onClick={() => setSketch(null)}>Model</button>
          <button className={sketch ? 'on sketching' : ''} onClick={() => start(commands.find(c => c.id === 'sketch')!)}>{sketch ? `Sketch · Z ${sketch.planeZ}` : 'Sketch'}</button>
        </div>
        <div className="grow" />
        {sketch && <button className="finish" onClick={finishSketch}><Icon name="check" />Finish sketch <Kbd>⏎</Kbd></button>}
        <button className="tool" aria-label="Undo" title="Undo (⌘Z)" disabled={!undo.length} onClick={doUndo}><Icon name="undo" /></button>
        <button className="tool" aria-label="Redo" title="Redo (⇧⌘Z)" disabled={!redo.length} onClick={doRedo}><Icon name="redo" /></button>
        <button className="tool" aria-label="Open" title="Open .bcad" onClick={() => fileInput.current?.click()}><Icon name="folder_open" /></button>
        <button className="tool" aria-label="Save" title="Save (⌘S)" onClick={save}><Icon name="save" /></button>
        <button className="tool" aria-label="Export STL" title="Export STL" onClick={exportStl}><Icon name="download" /></button>
        <input ref={fileInput} type="file" accept=".bcad,.json" hidden onChange={e => { const f = e.target.files?.[0]; if (f) open(f); e.target.value = ''; }} />
      </header>

      <nav className="card toolbar" aria-label="Tools">
        {sketch ? (<>
          {(['rectangle', 'circle', 'polygon'] as SketchTool[]).map(t => (
            <button key={t} className={'tool' + (sketch.tool === t ? ' on' : '')} title={`${t[0].toUpperCase() + t.slice(1)} (${t[0].toUpperCase()})`} aria-label={t}
              onClick={() => setSketch(s => s && { ...s, tool: t, shape: null })}><Icon name={t === 'rectangle' ? 'rectangle' : t === 'circle' ? 'circle' : 'pentagon'} /></button>))}
          <div className="sep" />
          <button className="tool" title="Clear profile" aria-label="Clear profile" onClick={() => setSketch(s => s && { ...s, shape: null })}><Icon name="ink_eraser" /></button>
        </>) : (['create', 'modify', 'pattern', 'combine', 'inspect'] as const).map((g, gi) => (
          <div key={g} className="tool-group">
            {gi > 0 && <div className="sep" />}
            {commands.filter(c => c.group === g).map(c => {
              const a = c.available(ctx);
              return <button key={c.id} className={'tool' + (active?.cmd.id === c.id ? ' on' : '') + (a.ok ? '' : ' off')} aria-label={c.label}
                title={`${c.label}${c.shortcut ? ` (${c.shortcut})` : ''}${a.ok ? '' : ' — ' + a.reason}`} onClick={() => start(c)}><Icon name={c.icon} /></button>;
            })}
          </div>))}
      </nav>

      <aside className="card outliner" aria-label="Outliner">
        <div className="card-title">OUTLINER <span className="muted">{shownBodies.length} bod{shownBodies.length === 1 ? 'y' : 'ies'}</span></div>
        {bodies.map((b, i) => {
          const ref = refOf(b); const node = evaluated.nodes[ref.node];
          const sel = selectedBodies(selection).includes(i);
          return <button key={b.key} className={'ol' + (sel ? ' sel' : '')} onClick={e => setSelection(prev => {
            const list = selectedBodies(prev); return e.shiftKey ? { faces: [], edges: [], bodies: list.includes(i) ? list.filter(x => x !== i) : [...list, i] } : { faces: [], edges: [], bodies: [i] };
          })}><Icon name="deployed_code" small />{node ? featureLabel(node, ref.node, evaluated.nodes) : b.key}{ref.side !== 'solid' && <span className="muted"> · {ref.side}</span>}</button>;
        })}
        {!bodies.length && !busy && <div className="empty">No bodies yet. Press <Kbd>S</Kbd> to sketch or <Kbd>B</Kbd> for a box.</div>}
      </aside>

      <aside className="card props" aria-label="Selection">
        {sel1?.kind === 'face' && sel1.face ? (<>
          <div className="card-title">SELECTION · FACE</div>
          <div className="kv">Type <b>{sel1.face.kind === 'plane' ? 'Planar' : 'Curved'}</b></div>
          {sel1.face.kind === 'plane' && <div className="kv">Normal <b>{sel1.face.normal.map(v => fmt(Math.round(v * 1000) / 1000)).join(', ')}</b></div>}
          <div className="kv">Area <b>{fmt(Math.round(sel1.face.areaMM2 * 100) / 100)} mm²</b></div>
        </>) : sel1?.kind === 'edge' && sel1.edge ? (<>
          <div className="card-title">SELECTION · EDGE</div>
          <div className="kv">Type <b>{sel1.edge.straight ? 'Line' : 'Curve'}</b></div>
          {sel1.edge.straight && <div className="kv">Length <b>{fmt(Math.round(Math.hypot(...sel1.edge.b.map((v, k) => v - sel1.edge!.a[k]) as [number, number, number]) * 100) / 100)} mm</b></div>}
          {sel1.edge.axis && <div className="kv">Direction <b>{sel1.edge.axis.toUpperCase()}</b></div>}
        </>) : null}
        {selBodies.length > 0 && <>
          <div className="card-title" style={{ marginTop: sel1 ? 10 : 0 }}>BODY{selBodies.length > 1 ? ` · ${selBodies.length} selected` : ''}</div>
          {selBodies.slice(0, 1).map(b => { const { min, max } = b.mesh.bounds; return <div key={b.key}>
            <div className="kv">Bounds <b>{fmt(max[0] - min[0])} × {fmt(max[1] - min[1])} × {fmt(max[2] - min[2])}</b></div>
            {b.volumeMM3 !== null && <div className="kv">Volume <b>{fmt(Math.round(b.volumeMM3))} mm³</b></div>}
            {b.massG !== null && <div className="kv">Mass · Al 6061 <b>{fmt(Math.round(b.massG * 10) / 10)} g</b></div>}
            <div className="kv">Faces <b>{b.mesh.faces.length}</b></div>
          </div>; })}
        </>}
        {!sel1 && !selBodies.length && <div className="empty">Click a face or edge. Shift-click to pick bodies for a Boolean.</div>}
        {editNode !== null && <NodeEditor node={doc.nodes[editNode]} onApply={node => {
          const next = { ...doc, nodes: doc.nodes.map((n, i) => i === editNode ? node : n) };
          engine.evaluate(prefixDoc(next, marker ?? next.nodes.length), revision.current++).then(r => { if (!r) return; if (r.ok) commit(next); else setToast(r.error); });
        }} onClose={() => setEditNode(null)} />}
      </aside>

      {active && <Hud active={active} onChange={values => setActive(a => a && { ...a, values })} onApply={apply} onCancel={cancel} />}

      {sketch && !active && <div className="card hint-bar">
        <span className="hint-title"><Icon name={sketch.tool === 'rectangle' ? 'rectangle' : sketch.tool === 'circle' ? 'circle' : 'pentagon'} small />{sketch.tool[0].toUpperCase() + sketch.tool.slice(1)}</span>
        <span>{sketch.tool === 'rectangle' ? 'Click two corners' : sketch.tool === 'circle' ? 'Click centre, then radius' : 'Click points, click the first point to close'}</span>
        <span><Kbd>R</Kbd> <Kbd>C</Kbd> <Kbd>P</Kbd> tools</span><span><Kbd>Enter</Kbd> finish → extrude</span><span><Kbd>Esc</Kbd> exit</span>
      </div>}

      {!sketch && !active && <div className="card history" aria-label="History">
        <span className="card-title inline">HISTORY</span>
        {doc.nodes.map((n, i) => n.kind === 'sketch' ? null : (
          <button key={i} className={'hs' + (i >= markerAt ? ' rolled' : '') + (editNode === i ? ' edit' : '')} title={`${featureLabel(n, i, doc.nodes)} · click to edit · double-click to roll back here`}
            onClick={() => setEditNode(i)} onDoubleClick={() => setMarker(i + 1 >= totalNodes ? null : i + 1)}>
            <Icon name={iconFor(n)} small />{featureLabel(n, i, doc.nodes)}</button>))}
        <button className="marker" aria-label="Roll forward to the end" title="Rollback marker · click to roll forward" onClick={() => setMarker(null)} />
        {marker !== null && <span className="muted">rolled back · {totalNodes - markerAt} hidden</span>}
      </div>}

      <div className="corner-left">
        <Triad camera={viewport.current?.camera} />
        <span className="mono muted">{busy ? 'Computing…' : `${ortho ? 'Orthographic' : 'Perspective'} · ${shownBodies.length} solid${shownBodies.length === 1 ? '' : 's'} · ${Math.round(lastMs)} ms`}{cursor ? ` · ${cursor.map(v => fmt(Math.round(v * 10) / 10)).join(', ')}` : ''}</span>
      </div>

      <div className="corner-right">
        <div className="card views" role="group" aria-label="Views">
          {(['iso', 'top', 'front', 'right'] as const).map(v => <button key={v} onClick={() => viewport.current?.setView(v)}>{v === 'iso' ? 'Iso' : v[0].toUpperCase() + v.slice(1)}</button>)}
          <button onClick={() => viewport.current?.fit()} title="Frame all (F)"><Icon name="fit_screen" small /></button>
          <button onClick={() => setOrtho(viewport.current?.toggleOrtho() ?? false)} className={ortho ? 'on' : ''}>Ortho</button>
        </div>
        <span className="chip"><Icon name="adjust" small />Snap 1 mm</span>
        <span className="chip mono">mm</span>
      </div>

      {palette && <Palette ctx={ctx} onRun={start} onClose={() => setPalette(false)} />}

      {toast && <div className="toast card" role="alert">
        <Icon name="info" className="accent" />
        <div><div className="toast-title">{toast.title}</div><div className="toast-hint">{toast.hint}</div>
          {toast.detail && <details><summary>Details</summary><code>{toast.detail}</code></details>}</div>
        <button className="tool" aria-label="Dismiss" onClick={() => setToast(null)}><Icon name="close" small /></button>
      </div>}
    </div>
  );
}

function iconFor(n: ModelNode) {
  return ({ extrude: 'height', hole: 'radio_button_checked', chamfer: 'change_history', union: 'join_full', difference: 'join_left', intersect: 'join_inner',
    translate: 'open_with', rotate: '3d_rotation', mirror: 'flip', scale: 'open_in_full', 'linear-pattern': 'view_week', 'circular-pattern': 'motion_photos_on', split: 'vertical_split', sketch: 'draw' } as Record<string, string>)[n.kind] ?? 'category';
}

function NodeEditor({ node, onApply, onClose }: { node: ModelNode; onApply(n: ModelNode): void; onClose(): void }) {
  const [draft, setDraft] = useState<ModelNode>(node);
  useEffect(() => setDraft(node), [node]);
  const fields: { label: string; get(n: ModelNode): number; set(n: ModelNode, v: number): ModelNode }[] = [];
  const num = (v: unknown) => typeof v === 'number' ? v : NaN;
  if ('height' in draft) fields.push({ label: 'Distance', get: n => num((n as { height: number }).height), set: (n, v) => ({ ...n, height: v }) as ModelNode });
  if ('from' in draft) fields.push({ label: 'Start Z', get: n => num((n as { from: number }).from), set: (n, v) => ({ ...n, from: v }) as ModelNode });
  if ('radius' in draft && draft.kind === 'hole') fields.push({ label: 'Diameter', get: n => num((n as { radius: number }).radius) * 2, set: (n, v) => ({ ...n, radius: v / 2 }) as ModelNode });
  if ('center' in draft && draft.kind === 'hole') ['X', 'Y'].forEach((a, k) => fields.push({ label: 'Centre ' + a, get: n => num((n as { center: number[] }).center[k]), set: (n, v) => { const c = [...(n as { center: number[] }).center]; c[k] = v; return { ...n, center: c } as ModelNode; } }));
  if ('distance' in draft) fields.push({ label: 'Distance', get: n => num((n as { distance: number }).distance), set: (n, v) => ({ ...n, distance: v }) as ModelNode });
  if ('spacing' in draft) fields.push({ label: 'Spacing', get: n => num((n as { spacing: number }).spacing), set: (n, v) => ({ ...n, spacing: v }) as ModelNode });
  if ('offset' in draft) ['ΔX', 'ΔY', 'ΔZ'].forEach((a, k) => fields.push({ label: a, get: n => num((n as { offset: number[] }).offset[k]), set: (n, v) => { const o = [...(n as { offset: number[] }).offset]; o[k] = v; return { ...n, offset: o } as ModelNode; } }));
  if ('at' in draft && draft.kind === 'split') fields.push({ label: 'At', get: n => num((n as { at: number }).at), set: (n, v) => ({ ...n, at: v }) as ModelNode });
  return (
    <div className="node-editor">
      <div className="card-title" style={{ marginTop: 10 }}>EDIT FEATURE <button className="tool tiny" aria-label="Close editor" onClick={onClose}><Icon name="close" small /></button></div>
      {fields.length ? fields.map(f => (
        <label key={f.label} className="field"><span>{f.label}</span>
          <input type="number" step="any" value={Number.isNaN(f.get(draft)) ? '' : f.get(draft)} onChange={e => setDraft(d => f.set(d, Number(e.target.value)))} /></label>
      )) : <div className="empty">This feature has no editable dimensions.</div>}
      {fields.length > 0 && <button className="primary" onClick={() => onApply(draft)}>Apply</button>}
    </div>
  );
}

function Triad({ camera }: { camera?: ViewportHandle['camera'] }) {
  const { right, up } = camera ? camera.basis() : { right: [0.6, -0.8, 0] as Vec3, up: [0.3, 0.2, 0.9] as Vec3 };
  const axes = [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map(a => [a[0] * right[0] + a[1] * right[1] + a[2] * right[2], -(a[0] * up[0] + a[1] * up[1] + a[2] * up[2])]);
  const colors = ['#e5534b', '#57b26b', '#4f8ff7'];
  return <svg width="56" height="56" viewBox="-28 -28 56 56" role="img" aria-label="Axis triad">
    {axes.map(([x, y], k) => <g key={k}><line x1={0} y1={0} x2={x * 20} y2={y * 20} stroke={colors[k]} strokeWidth={2.5} /><text x={x * 25} y={y * 25 + 3} fontSize={9} textAnchor="middle" fill={colors[k]} fontFamily="IBM Plex Mono">{'XYZ'[k]}</text></g>)}
  </svg>;
}
