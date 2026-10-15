import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EngineClient } from './engine/client';
import { emptyDoc, featureLabel, fmt, prefixDoc, starterDoc, withNode, type ModelNode, type StudioDoc } from './engine/doc';
import type { BodyResult } from './engine/evaluate';
import type { FriendlyError } from './engine/errors';
import type { Vec3 } from './engine/mesh';
import { commands, refOf, selectedBodies, type Command, type Ctx, type Selection, type Values } from './app/commands';
import { Viewport, type SketchShape, type SketchState, type SketchTool, type ViewportHandle } from './viewport/Viewport';
import { Icon, Kbd } from './ui/atoms';
import { Hud } from './ui/Hud';
import { Palette } from './ui/Palette';
import { ContextMenu } from './ui/ContextMenu';
import { SketchPanel, isConvex } from './ui/SketchPanel';
import { downloadBytes, meshToStl } from './ui/files';
import { outlineSegments, slotSegments, type P2 } from './sketch/profile';
import { settleShape } from './sketch/settle';

const TOOLS: { tool: SketchTool; key: string; label: string; icon: string; hint: string }[] = [
  { tool: 'rectangle', key: 'R', label: 'Rectangle', icon: 'rectangle', hint: 'Click two corners' },
  { tool: 'circle', key: 'C', label: 'Circle', icon: 'circle', hint: 'Click centre, then radius' },
  { tool: 'polygon', key: 'L', label: 'Line', icon: 'polyline', hint: 'Click points, click the first point to close · A switches to arcs' },
  { tool: 'arc', key: 'A', label: 'Arc', icon: 'line_curve', hint: 'Click the arc end, move to bend it, click to place · L back to lines' },
  { tool: 'slot', key: 'O', label: 'Slot', icon: 'pill', hint: 'Click both centres, then the width' },
];
/** Floating panels over the viewport while sketching: toolbar on the left, sketch panel on the right (CSS px). */
const SKETCH_INSETS = { left: 64, right: 272 };
/**
 * What the sketch camera frames: the bodies' XY extent (at least 60 mm, so the 1 mm snap stays usable),
 * or a 120 × 80 mm working area with the origin near the lower left when the part is empty.
 */
function sketchRegion(bodies: BodyResult[]): [[number, number], [number, number]] {
  if (!bodies.length) return [[-20, -20], [100, 60]];
  const min: [number, number] = [Infinity, Infinity], max: [number, number] = [-Infinity, -Infinity];
  for (const b of bodies) for (const k of [0, 1]) { min[k] = Math.min(min[k], b.mesh.bounds.min[k]); max[k] = Math.max(max[k], b.mesh.bounds.max[k]); }
  for (const k of [0, 1]) { const c = (min[k] + max[k]) / 2, half = Math.max(30, (max[k] - min[k]) / 2); min[k] = c - half; max[k] = c + half; }
  return [min, max];
}
/** Line and arc tools share one open chain; switching between them keeps it. */
const switchTool = (s: SketchState, tool: SketchTool): SketchState => {
  const chain = s.shape?.kind === 'polygon' && (tool === 'polygon' || tool === 'arc') && (s.tool === 'polygon' || s.tool === 'arc');
  return { ...s, tool, shape: chain && s.shape?.kind === 'polygon' ? { ...s.shape, pending: false } : null };
};

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
  const [sketchError, setSketchError] = useState<string | null>(null);
  // The last shape handed to the sketch, ahead of React's batched re-render (rapid pointer events).
  const liveShape = useRef<SketchShape | null>(null);
  useEffect(() => { liveShape.current = sketch?.shape ?? null; }, [sketch?.shape]);
  /** Every profile edit (viewport or panel) is settled against its constraints before it is shown. */
  const updateShape = useCallback((shape: SketchShape | null) => {
    const r = settleShape(shape, liveShape.current); liveShape.current = r.shape;
    setSketchError(r.error); setSketch(s => s && { ...s, shape: r.shape });
  }, []);
  useEffect(() => { if (!sketch) setSketchError(null); }, [sketch]);
  const [palette, setPalette] = useState(false);
  const [cursor, setCursor] = useState<Vec3 | null>(null);
  const [toast, setToast] = useState<FriendlyError | null>(null);
  const [fileName, setFileName] = useState('Bracket-01');
  const [dirty, setDirty] = useState(false);
  const [ortho, setOrtho] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => { try { return (localStorage.getItem('cad-studio-theme') as 'dark' | 'light') || 'dark'; } catch { return 'dark'; } });
  const [ao, setAo] = useState(true);
  const [editNode, setEditNode] = useState<number | null>(null);
  const [lastMs, setLastMs] = useState(0);
  const [menu, setMenu] = useState<{ at: { x: number; y: number }; selection: Selection; title: string } | null>(null);
  const revision = useRef(1);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => { document.documentElement.dataset.theme = theme; viewport.current?.setTheme(theme); try { localStorage.setItem('cad-studio-theme', theme); } catch { /* storage unavailable */ } }, [theme]);
  useEffect(() => { viewport.current?.setAo(ao); }, [ao]);

  // Dev/test hook: the flow test reads the accepted document.
  useEffect(() => { if (import.meta.env.DEV) (window as unknown as { __studioDoc: StudioDoc }).__studioDoc = doc; }, [doc]);
  // Dev/test hooks: select an edge or a face by its persistent name (canvas picks are not reproducible).
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as { __studioSelectEdge: (name: string) => boolean }).__studioSelectEdge = name => {
      for (const [b, body] of bodies.entries()) { const i = body.mesh.edges.findIndex(e => e.names.includes(name)); if (i >= 0) { setSelection({ faces: [], edges: [{ body: b, edge: i }], bodies: [] }); return true; } }
      return false;
    };
    (window as unknown as { __studioSelectFace: (name: string) => boolean }).__studioSelectFace = name => {
      for (const [b, body] of bodies.entries()) { const i = body.mesh.faces.findIndex(f => f.name.split('+').includes(name)); if (i >= 0) { setSelection({ faces: [{ body: b, face: i }], edges: [], bodies: [] }); return true; } }
      return false;
    };
  }, [bodies]);

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
    // An empty document has no bodies; clear them now so defaults are not computed from the old model.
    if (!Object.keys(next.outputs).length) { setBodies([]); setSelection(emptySel); }
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
      const base = face && planeZ > 0 ? refOf(bodies[f.body]) : null;
      setSketch({ planeZ, tool: cmd.id === 'revolve' ? 'circle' : 'rectangle', shape: null, base, ...(cmd.id === 'revolve' ? { make: 'revolve-y' as const } : {}) }); setActive(null); setPreviewBodies(null);
      const [min, max] = sketchRegion(base && f ? [bodies[f.body]] : bodies);
      viewport.current?.frameSketch(min, max, planeZ, SKETCH_INSETS); return;
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
        : s.kind === 'slot' ? (s.r > 0 && (s.a[0] !== s.b[0] || s.a[1] !== s.b[1]) ? { kind: 'sketch', profile: 'loop', segments: slotSegments(s.a, s.b, s.r) } : null)
          : !s.closed || s.pending ? null
            // Straight convex outlines keep the polygon path (all features); concave or curved ones become a line + arc loop.
            : !(s.bulges ?? []).some(Boolean) && s.points.length >= 3 && s.points.length <= 8 && isConvex(s.points) ? { kind: 'sketch', profile: 'polygon', points: s.points }
              : { kind: 'sketch', profile: 'loop', segments: outlineSegments(s.points as P2[], s.bulges) };
    if (!node) { setToast({ title: 'Finish the profile first', hint: 'Draw a closed rectangle, circle, slot or outline on the sketch plane.', detail: '' }); return; }
    const planeZ = sketch.planeZ;
    const base = sketch.base ?? null;
    const extrude: Command = {
      id: 'extrude', label: 'Extrude', icon: 'height', group: 'create', available: () => ({ ok: true }),
      fields: () => [{ key: 'make', label: 'Make', kind: 'choice', options: [{ value: 'extrude', label: 'Extrude' }, { value: 'revolve-y', label: 'Revolve about Y' }, { value: 'revolve-x', label: 'Revolve about X' }] },
        { key: 'h', label: 'Distance', kind: 'mm', min: 1 }, { key: 'draft', label: 'Draft', kind: 'deg', min: -60, max: 60, step: 1 }, { key: 'deg', label: 'Revolve angle', kind: 'deg', min: 1, max: 360, step: 15 },
        ...(base ? [{ key: 'op', label: 'Operation', kind: 'choice' as const, options: [{ value: 'join', label: 'Join to body' }, { value: 'new', label: 'New body' }, { value: 'cut', label: 'Cut from body' }] }] : [])],
      defaults: () => ({ make: sketch.make ?? 'extrude', h: 8, draft: 0, deg: 360, ...(base ? { op: 'join' } : {}) }),
      build: (c, v) => {
        const cut = v.op === 'cut'; const d = withNode(c.doc, node);
        // A cut extrudes down into the body from the face; join/new extrude up from it. A revolve turns
        // the profile about the sketch axis (the sketch plane is lifted onto the face afterwards).
        const height = Number(v.h); const from = cut ? planeZ - height : planeZ;
        let e = String(v.make).startsWith('revolve')
          ? withNode(d, { kind: 'revolve', sketch: d.nodes.length - 1, axis: v.make === 'revolve-x' ? 'x' : 'y', angleDegrees: Number(v.deg) })
          // With a draft a cut goes down from the face, so its walls lean in away from the opening.
          : Number(v.draft) && cut ? withNode(d, { kind: 'extrude', sketch: d.nodes.length - 1, height: -height, ...(planeZ ? { from: planeZ } : {}), draft: Number(v.draft) })
          : withNode(d, { kind: 'extrude', sketch: d.nodes.length - 1, height, ...(from ? { from } : {}), ...(Number(v.draft) ? { draft: Number(v.draft) } : {}) });
        if (String(v.make).startsWith('revolve') && planeZ) e = withNode(e, { kind: 'translate', parent: { node: e.nodes.length - 1, side: 'solid' }, offset: [0, 0, planeZ] });
        const tool = { node: e.nodes.length - 1, side: 'solid' as const };
        if (base && v.op === 'join') e = withNode(e, { kind: 'union', left: base as { node: number; side: 'solid' }, right: tool });
        if (base && cut) e = withNode(e, { kind: 'difference', parent: base as { node: number; side: 'solid' }, tool });
        return e;
      },
    };
    setSketch(null);
    setActive({ cmd: extrude, values: extrude.defaults!(ctx), preview: 'busy', ctx: { ...ctx } });
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
  const exportStepFile = async () => {
    const r = await engine.step(evaluated, fileName);
    if ('text' in r) downloadBytes(new TextEncoder().encode(r.text), `${fileName}.step`, 'model/step');
    else setToast({ title: 'Could not write STEP', hint: 'Fix the model’s errors first, then export again.', detail: r.error });
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
      if (sketch) { const t = TOOLS.find(x => x.key.toLowerCase() === e.key.toLowerCase() || (x.tool === 'polygon' && e.key.toLowerCase() === 'p'))?.tool; if (t) setSketch(s => s && switchTool(s, t)); return; }
      if (e.key.toLowerCase() === 'f' && !e.shiftKey) { viewport.current?.fit(); return; }
      const cmd = commands.find(c => c.shortcut && c.shortcut.toLowerCase() === (e.shiftKey ? 'shift ' : '') + e.key.toLowerCase());
      if (cmd && !active) { e.preventDefault(); start(cmd); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const shownBodies = previewBodies ?? bodies;
  const shownSelection = previewBodies || sketch ? emptySel : selection;
  const ghost = useMemo(() => new Set(sketch ? shownBodies.map((_, i) => i) : []), [sketch, shownBodies]);
  const gizmo = active?.cmd.id === 'move' && selectedBodies(active.ctx.selection).length === 1 ? (() => {
    const b = bodies[selectedBodies(active.ctx.selection)[0]]; const { min, max } = b.mesh.bounds;
    return { origin: [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, max[2]] as Vec3, values: [Number(active.values.x), Number(active.values.y), Number(active.values.z)] as Vec3,
      onDrag: (v: Vec3) => setActive(a => a && { ...a, values: { ...a.values, x: v[0], y: v[1], z: v[2] }, preview: 'busy' }) };
  })() : null;

  const totalNodes = doc.nodes.length; const markerAt = marker ?? totalNodes;
  const sel1 = selection.faces[0] ? { kind: 'face' as const, body: bodies[selection.faces[0].body], face: bodies[selection.faces[0].body]?.mesh.faces[selection.faces[0].face] }
    : selection.edges[0] ? { kind: 'edge' as const, body: bodies[selection.edges[0].body], edge: bodies[selection.edges[0].body]?.mesh.edges[selection.edges[0].edge] } : null;
  const selBodies = selectedBodies(selection).map(i => bodies[i]).filter(Boolean);

  return (
    <div className="studio">
      <Viewport ref={viewport} bodies={shownBodies} selection={shownSelection} ghost={ghost} sketch={sketch} gizmo={gizmo}
        onPick={onPick} onCursor={setCursor} onSketchShape={updateShape}
        onBoxSelect={(picked, additive) => { if (active) return; setSelection(prev => {
          const base = additive ? selectedBodies(prev) : [];
          return { faces: [], edges: [], bodies: [...new Set([...base, ...picked])] };
        }); }}
        onDimClick={key => { const el = document.getElementById('sk-' + key) as HTMLInputElement | null; el?.focus(); el?.select(); }}
        onContextMenu={(at, hit) => {
          if (active || sketch) return;
          const next: Selection = hit.edge ? { faces: [], edges: [hit.edge], bodies: [] } : hit.face ? { faces: [hit.face], edges: [], bodies: [] } : selection;
          if (hit.edge || hit.face) setSelection(next);
          const title = hit.edge ? 'EDGE' : hit.face ? 'FACE' : selectedBodies(next).length ? `${selectedBodies(next).length} BOD${selectedBodies(next).length > 1 ? 'IES' : 'Y'}` : 'VIEW';
          setMenu({ at, selection: next, title });
        }} />

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
        <button className="tool" aria-label="New part" title="New part" onClick={() => { commit(emptyDoc()); setFileName('Untitled'); }}><Icon name="add_box" /></button>
        <button className="tool" aria-label="Open" title="Open .bcad" onClick={() => fileInput.current?.click()}><Icon name="folder_open" /></button>
        <button className="tool" aria-label="Save" title="Save (⌘S)" onClick={save}><Icon name="save" /></button>
        <button className="tool" aria-label="Export STL" title="Export STL" onClick={exportStl}><Icon name="download" /></button>
        <button className="tool" aria-label="Export STEP" title="Export STEP (exact solid for other CAD)" onClick={exportStepFile}><Icon name="deployed_code_update" /></button>
        <input ref={fileInput} type="file" accept=".bcad,.json" hidden onChange={e => { const f = e.target.files?.[0]; if (f) open(f); e.target.value = ''; }} />
      </header>

      <nav className="card toolbar" aria-label="Tools">
        {sketch ? (<>
          {TOOLS.map(t => (
            <button key={t.tool} className={'tool' + (sketch.tool === t.tool ? ' on' : '')} title={`${t.label} (${t.key})`} aria-label={t.label}
              onClick={() => setSketch(s => s && switchTool(s, t.tool))}><Icon name={t.icon} /></button>))}
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

      <div className="right-col">
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

      {sketch && <SketchPanel sketch={sketch} error={sketchError} onShape={updateShape} />}
      {!sketch && <aside className="card props" aria-label="Selection">
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
      </aside>}
      </div>

      {active && <Hud active={active} onChange={(key, value) => setActive(a => a && { ...a, values: { ...a.values, [key]: value }, preview: 'busy' })} onApply={apply} onCancel={cancel} />}

      {sketch && !active && <div className="card hint-bar">
        {(() => { const t = TOOLS.find(x => x.tool === sketch.tool)!; return <><span className="hint-title"><Icon name={t.icon} small />{t.label}</span><span>{t.hint}</span></>; })()}
        <span>{TOOLS.map(t => <Kbd key={t.key}>{t.key}</Kbd>)} tools</span><span><Kbd>Enter</Kbd> finish → extrude</span><span><Kbd>Esc</Kbd> exit</span>
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
        <span className="mono muted">{busy ? 'Computing…' : `${ortho ? 'Orthographic' : 'Perspective'} · ${shownBodies.length} solid${shownBodies.length === 1 ? '' : 's'} · ${Math.round(lastMs)} ms`}{cursor ? ` · ${cursor.map(v => fmt(Math.round(v * 10) / 10)).join(', ')}` : ''}</span>
      </div>

      <div className="corner-right">
        <div className="card views" role="group" aria-label="Views">
          {(['iso', 'top', 'front', 'right'] as const).map(v => <button key={v} onClick={() => viewport.current?.setView(v)}>{v === 'iso' ? 'Iso' : v[0].toUpperCase() + v.slice(1)}</button>)}
          <button onClick={() => viewport.current?.fit()} title="Frame all (F)"><Icon name="fit_screen" small /></button>
          <button onClick={() => setOrtho(viewport.current?.toggleOrtho() ?? false)} className={ortho ? 'on' : ''}>Ortho</button>
          <button onClick={() => setAo(v => !v)} className={ao ? 'on' : ''} title="Ambient occlusion">AO</button>
          <button onClick={() => setTheme(v => v === 'dark' ? 'light' : 'dark')} title="Toggle light / dark" aria-label="Toggle light or dark theme"><Icon name={theme === 'dark' ? 'light_mode' : 'dark_mode'} small /></button>
        </div>
        <span className="chip"><Icon name="adjust" small />Snap 1 mm</span>
        <span className="chip mono">mm</span>
      </div>

      {palette && <Palette ctx={ctx} onRun={start} onClose={() => setPalette(false)} />}
      {menu && <ContextMenu at={menu.at} title={menu.title} ctx={{ ...ctx, selection: menu.selection }} onClose={() => setMenu(null)}
        onRun={c => { setMenu(null); start(c); }}
        actions={[
          { label: 'Frame all', icon: 'fit_screen', shortcut: 'F', run: () => viewport.current?.fit() },
          { label: 'Isometric view', icon: 'view_in_ar', run: () => viewport.current?.setView('iso') },
          { label: 'Top view', icon: 'crop_square', run: () => viewport.current?.setView('top') },
          { label: 'Clear selection', icon: 'deselect', shortcut: 'Esc', run: () => setSelection(emptySel) },
        ]} />}

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
  return ({ extrude: 'height', revolve: 'autorenew', shell: 'inventory_2', hole: 'radio_button_checked', chamfer: 'change_history', fillet: 'rounded_corner', union: 'join_full', difference: 'join_left', intersect: 'join_inner',
    translate: 'open_with', rotate: '3d_rotation', mirror: 'flip', scale: 'open_in_full', 'linear-pattern': 'view_week', 'circular-pattern': 'motion_photos_on', split: 'vertical_split', sketch: 'draw' } as Record<string, string>)[n.kind] ?? 'category';
}

function NodeEditor({ node, onApply, onClose }: { node: ModelNode; onApply(n: ModelNode): void; onClose(): void }) {
  const [draft, setDraft] = useState<ModelNode>(node);
  useEffect(() => setDraft(node), [node]);
  const fields: { label: string; get(n: ModelNode): number; set(n: ModelNode, v: number): ModelNode }[] = [];
  const num = (v: unknown) => typeof v === 'number' ? v : NaN;
  if ('height' in draft) fields.push({ label: 'Distance', get: n => num((n as { height: number }).height), set: (n, v) => ({ ...n, height: v }) as ModelNode });
  if (draft.kind === 'extrude') fields.push({ label: 'Draft °', get: n => (n as { draft?: number }).draft ?? 0, set: (n, v) => ({ ...n, draft: v }) as ModelNode });
  if ('from' in draft) fields.push({ label: 'Start Z', get: n => num((n as { from: number }).from), set: (n, v) => ({ ...n, from: v }) as ModelNode });
  if (draft.kind === 'fillet') fields.push({ label: 'Radius', get: n => num((n as { radius: number }).radius), set: (n, v) => ({ ...n, radius: v }) as ModelNode });
  if (draft.kind === 'shell') fields.push({ label: 'Wall', get: n => num((n as { thickness: number }).thickness), set: (n, v) => ({ ...n, thickness: v }) as ModelNode });
  if (draft.kind === 'rotate' || draft.kind === 'revolve') fields.push({ label: 'Angle °', get: n => num((n as { angleDegrees: number }).angleDegrees), set: (n, v) => ({ ...n, angleDegrees: v }) as ModelNode });
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
