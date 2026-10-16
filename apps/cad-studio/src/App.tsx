import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EngineClient } from './engine/client';
import { placedDoc, type PartInstance } from './engine/doc';
import { emptyDoc, featureLabel, fmt, prefixDoc, starterDoc, withNode, type ModelNode, type SketchNode, type StudioDoc } from './engine/doc';
import type { BodyResult } from './engine/evaluate';
import type { FriendlyError } from './engine/errors';
import type { Vec3 } from './engine/mesh';
import { commands, patchValues, refOf, selectedBodies, shownFields, type Command, type Ctx, type Selection, type Values } from './app/commands';
import { measureBetween, measureItem, type MeasurePick } from './app/measure';
import { editFields } from './app/editFields';
import { Viewport, type FeatureHandle, type SketchAnchor, type SketchShape, type SketchState, type SketchTool, type TransformGizmo, type ViewportHandle } from './viewport/Viewport';
import { Icon, Kbd } from './ui/atoms';
import { Hud } from './ui/Hud';
import { Palette } from './ui/Palette';
import { ContextMenu } from './ui/ContextMenu';
import { SketchPanel } from './ui/SketchPanel';
import { RenderPanel } from './ui/RenderPanel';
import { Timeline } from './ui/Timeline';
import { clearRecovery, readRecovery, writeRecovery, type Recovery } from './app/recovery';
import { DirectPanel } from './ui/DirectPanel';
import { InstancePanel } from './ui/InstancePanel';
import { DrawingWorkspace } from './ui/DrawingWorkspace';
import { ChatPanel } from './ui/ChatPanel';
import { TooltipLayer } from './ui/Tooltip';
import { resolveNames, type NameSelection } from './chat/tools';
import { deleteFeature } from './chat/features';
import { defaultDrawing, readDrawing, type DrawingSettings } from './drawing/types';
import { MatePanel } from './ui/MatePanel';
import { useAssembly } from './assembly/useAssembly';
import { pickedSketches, planeOf, profileRings, unusedSketches } from './app/profiles';
import { editCommand } from './app/editCommand';
import { gizmoAxes, movedInstance, previewMatrix, turnedInstance, type InstanceDrag } from './assembly/drag';
import type { Mate } from './assembly/mates';
import { directDisplay, directIGES, emptyDirect, importSource, type DirectGeometry } from './engine/direct';
import { defaultRender, offsetsAt, readRender, type RenderCamera, type RenderSettings } from './engine/render';
import { downloadBytes, meshToStl } from './ui/files';
import { settleShape } from './sketch/settle';
import { boxOnPlane, isDefaultPlane, offsetPlane, planeLabel, planeOfFace, standardPlane, tiltPlane, xyPlane, type SketchPlane } from './sketch/plane';
import { profileOf, shapeNode } from './sketch/loops';
import { commitDimension, isSettled } from './sketch/rules';
import { sketchClick, startPicking } from './sketch/select';
import { SketchHistory } from './sketch/history';
import { sketchShapes } from './sketch/reopen';

const TOOLS: { tool: SketchTool; key: string; label: string; icon: string; hint: string }[] = [
  { tool: 'rectangle', key: 'R', label: 'Rectangle', icon: 'rectangle', hint: 'Click two corners' },
  { tool: 'circle', key: 'C', label: 'Circle', icon: 'circle', hint: 'Click centre, then radius' },
  { tool: 'polygon', key: 'L', label: 'Line', icon: 'polyline', hint: 'Click points, click the first point to close · A switches to arcs' },
  { tool: 'arc', key: 'A', label: 'Arc', icon: 'line_curve', hint: 'Click the arc end, move to bend it, click to place · L back to lines' },
  { tool: 'slot', key: 'O', label: 'Slot', icon: 'pill', hint: 'Click both centres, then the width' },
  { tool: 'select', key: 'S', label: 'Select', icon: 'arrow_selector_tool', hint: 'Click points and edges (Shift adds), then constrain them in the panel' },
  { tool: 'dimension', key: 'D', label: 'Dimension', icon: 'straighten', hint: 'Click an edge, an arc or two points, type the value, Enter · double-click to edit' },
];
/** Floating panels over the viewport while sketching: toolbar on the left, sketch panel on the right (CSS px). */
const SKETCH_INSETS = { left: 64, right: 272 };
/**
 * What the sketch camera frames: the bodies' XY extent (at least 60 mm, so the 1 mm snap stays usable),
 * or a 120 × 80 mm working area with the origin near the lower left when the part is empty.
 */
/** The bodies' extent seen on a sketch plane (plane coordinates), at least 60 mm across. */
function sketchRegion(bodies: BodyResult[], plane: SketchPlane): [[number, number], [number, number]] {
  if (!bodies.length) return [[-20, -20], [100, 60]];
  const min: [number, number] = [Infinity, Infinity], max: [number, number] = [-Infinity, -Infinity];
  for (const b of bodies) { const [lo, hi] = boxOnPlane(plane, b.mesh.bounds.min, b.mesh.bounds.max); for (const k of [0, 1]) { min[k] = Math.min(min[k], lo[k]); max[k] = Math.max(max[k], hi[k]); } }
  for (const k of [0, 1]) { const c = (min[k] + max[k]) / 2, half = Math.max(30, (max[k] - min[k]) / 2); min[k] = c - half; max[k] = c + half; }
  return [min, max];
}
/** Line and arc tools share one open chain; switching between them keeps it. */
const switchTool = (s: SketchState, tool: SketchTool): SketchState => {
  if (tool === 'select' || tool === 'dimension') return startPicking(s, tool);
  s = { ...s, picked: [], editDim: null };
  const chain = s.shape?.kind === 'polygon' && !s.shape.closed && (tool === 'polygon' || tool === 'arc') && (s.tool === 'polygon' || s.tool === 'arc');
  if (chain && s.shape?.kind === 'polygon') return { ...s, tool, shape: { ...s.shape, pending: false } };
  // A closed shape stays in the sketch beside the next one.
  return { ...s, tool, shape: null, ...(s.shape && shapeNode(s.shape) ? { done: [...(s.done ?? []), s.shape] } : {}) };
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
  /**
   * A Move or Rotate gizmo drag: the body follows at once by this matrix on the evaluated part; once let
   * go it stays until the preview of the values arrives (`settling`).
   */
  const [bodyDrag, setBodyDrag] = useState<{ matrix: Float64Array; settling: boolean } | null>(null);
  const previewFor = useRef<string | null>(null);
  const [sketch, setSketch] = useState<SketchState | null>(null);
  /** The Render workspace: the part with its appearances, lights and environment. */
  const [rendering, setRendering] = useState(false);
  /** The Drawing workspace: the part's dimensioned 2D views on a sheet. */
  const [drawing, setDrawing] = useState(false);
  /** The Render workspace's animation: the time shown, whether it plays, and the camera the turntable turns from. */
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const turnFrom = useRef<RenderCamera | null>(null);
  /** Selected part instances (by id), and their evaluated bodies (by id, with the placed document they are of). */
  const [instanceSel, setInstanceSel] = useState<string[]>([]);
  const [instanceBodies, setInstanceBodies] = useState<Map<string, { key: string; bodies: BodyResult[] }>>(new Map());
  const partInput = useRef<HTMLInputElement>(null);
  /** Selected direct curves and surfaces (by object id). */
  const [directSel, setDirectSel] = useState<string[]>([]);
  const [sketchError, setSketchError] = useState<string | null>(null);
  // The last shape handed to the sketch, ahead of React's batched re-render (rapid pointer events).
  const liveShape = useRef<SketchShape | null>(null);
  useEffect(() => { liveShape.current = sketch?.shape ?? null; }, [sketch?.shape]);
  /** Every profile edit (viewport or panel) is settled against its constraints before it is shown. */
  // A new shape keeps the current one beside it when that one is closed (one profile of several loops).
  const sketchHistory = useRef(new SketchHistory());
  const updateShape = useCallback((shape: SketchShape | null, fresh = false) => {
    const prev = liveShape.current, keep = fresh && prev && shapeNode(prev) ? prev : null;
    const r = settleShape(shape, keep ? null : prev); liveShape.current = r.shape;
    if (!keep && isSettled(prev) && isSettled(r.shape)) sketchHistory.current.push(prev, r.shape);
    setSketchError(r.error); setSketch(s => s && { ...s, shape: r.shape, ...(keep ? { done: [...(s.done ?? []), keep] } : {}) });
  }, []);
  useEffect(() => { if (!sketch) { setSketchError(null); sketchHistory.current.clear(); } }, [sketch]);
  const [palette, setPalette] = useState(false);
  const [chat, setChat] = useState(false);
  /** What a chat turn asked to show selected once its part is evaluated. */
  const chatSelection = useRef<NameSelection | null>(null);
  const [cursor, setCursor] = useState<Vec3 | null>(null);
  const [toast, setToast] = useState<FriendlyError | null>(null);
  const [fileName, setFileName] = useState('Bracket-01');
  const [dirty, setDirty] = useState(false);
  /** Unsaved work kept from an earlier visit, offered back once. */
  const [recovery, setRecovery] = useState<Recovery | null>(() => readRecovery());
  // Keep a recovery copy a moment after each change while unsaved; none once saved.
  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(() => writeRecovery(fileName, doc), 800);
    return () => clearTimeout(t);
  }, [doc, fileName, dirty]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  const [ortho, setOrtho] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => { try { return (localStorage.getItem('cad-studio-theme') as 'dark' | 'light') || 'dark'; } catch { return 'dark'; } });
  const [ao, setAo] = useState(true);
  const [editNode, setEditNode] = useState<number | null>(null);
  // Measuring: up to two picked faces or edges (null: not measuring).
  const [measure, setMeasure] = useState<MeasurePick[] | null>(null);
  const [material, setMaterial] = useState<string>(() => { try { return localStorage.getItem('studio.material') ?? 'al6061'; } catch { return 'al6061'; } });
  useEffect(() => { try { localStorage.setItem('studio.material', material); } catch { /* storage unavailable */ } }, [material]);
  const [lastMs, setLastMs] = useState(0);
  const [menu, setMenu] = useState<{ at: { x: number; y: number }; selection: Selection; title: string } | null>(null);
  const revision = useRef(1);
  const fileInput = useRef<HTMLInputElement>(null);
  const pickRef = useRef<(hit: { face: { body: number; face: number } | null; edge: { body: number; edge: number } | null; point: Vec3 | null }, additive: boolean) => void>(() => {});

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
    // A click on a named face, as the viewport reports it (measure picks go through it).
    (window as unknown as { __studioPickFace: (name: string) => boolean }).__studioPickFace = name => {
      for (const [b, body] of bodies.entries()) { const i = body.mesh.faces.findIndex(f => f.name.split('+').includes(name)); if (i >= 0) { pickRef.current({ face: { body: b, face: i }, edge: null, point: null }, false); return true; } }
      return false;
    };
    // A click on a named edge (`a|b`), as the viewport reports it.
    (window as unknown as { __studioPickEdge: (name: string, additive?: boolean) => boolean }).__studioPickEdge = (name, additive = false) => {
      for (const [b, body] of bodies.entries()) { const i = body.mesh.edges.findIndex(e => e.names.includes(name)); if (i >= 0) { pickRef.current({ face: null, edge: { body: b, edge: i }, point: null }, additive); return true; } }
      return false;
    };
  }, [bodies]);

  // (Render settings do not change the model: only its nodes and parameters re-evaluate it.)
  const evaluated = useMemo(() => prefixDoc(doc, marker ?? doc.nodes.length), [doc.nodes, doc.parameters, marker]);
  const render = useMemo(() => doc.render ?? defaultRender(), [doc.render]);

  // Evaluate the accepted document whenever it or the rollback marker changes.
  useEffect(() => {
    let live = true; setBusy(true);
    engine.evaluate(evaluated, revision.current++).then(result => {
      if (!live || !result) return;
      setBusy(false); setLastMs(result.ms);
      if (result.ok) {
        // (The same bodies again — a preview that became the part — keep what is selected on them.)
        const prev = bodiesRef.current, same = prev.length === result.bodies.length && result.bodies.every((b, i) => b.key === prev[i].key && b.mesh.faces.length === prev[i].mesh.faces.length && b.mesh.edges.length === prev[i].mesh.edges.length);
        setBodies(result.bodies);
        if (chatSelection.current) setSelection(resolveNames(result.bodies, chatSelection.current).selection); else if (!same) setSelection(emptySel);
        chatSelection.current = null;
      }
      else setToast(result.error);
    });
    return () => { live = false; };
  }, [engine, evaluated]);

  const bodiesRef = useRef(bodies); bodiesRef.current = bodies;
  const ctx: Ctx = { doc: evaluated, bodies, selection, pick: pick ?? undefined };

  const commit = useCallback((next: StudioDoc) => {
    // Counted as the History bar shows them: sketches are part of the feature made from them.
    const dropped = marker !== null ? doc.nodes.slice(marker).filter(n => n.kind !== 'sketch').length : 0;
    setUndo(u => [...u.slice(-49), { doc, marker }]); setRedo([]);
    setDoc(next); setMarker(null); setDirty(true); setEditNode(null);
    // An empty document has no bodies; clear them now so defaults are not computed from the old model.
    if (!Object.keys(next.outputs).length) { setBodies([]); setSelection(emptySel); }
    if (dropped > 0) setToast({ title: `Removed ${dropped} later feature${dropped > 1 ? 's' : ''}`, hint: 'You added a feature while rolled back. Undo restores them.', detail: '' });
  }, [doc, marker]);
  /** One undoable change of the render settings (the model and the rollback marker stay). */
  const commitRender = useCallback((next: RenderSettings) => {
    setUndo(u => [...u.slice(-49), { doc, marker }]); setRedo([]);
    setDoc({ ...doc, render: next }); setDirty(true);
  }, [doc, marker]);
  /** One undoable change of the drawing settings (the model stays). */
  const commitDrawing = useCallback((next: DrawingSettings) => {
    setUndo(u => [...u.slice(-49), { doc, marker }]); setRedo([]);
    setDoc({ ...doc, drawing: next }); setDirty(true);
  }, [doc, marker]);
  /** One undoable change of the direct geometry (the model stays as evaluated). */
  const commitDirect = useCallback((next: DirectGeometry, select?: string[]) => {
    setUndo(u => [...u.slice(-49), { doc, marker }]); setRedo([]);
    setDoc({ ...doc, direct: next }); setDirty(true);
    if (select) setDirectSel(select);
  }, [doc, marker]);
  const directShown = useMemo(() => directDisplay(doc.direct), [doc.direct]);
  /** One undoable change of the placed instances. */
  const commitInstances = useCallback((next: PartInstance[], select?: string[]) => {
    setUndo(u => [...u.slice(-49), { doc, marker }]); setRedo([]);
    setDoc({ ...doc, instances: next }); setDirty(true);
    if (select) setInstanceSel(select);
  }, [doc, marker]);
  // Evaluate each instance whose placed part changed (in the worker, beside the main part).
  useEffect(() => {
    let live = true;
    (async () => {
      const next = new Map<string, { key: string; bodies: BodyResult[] }>();
      for (const inst of doc.instances ?? []) {
        const placed = placedDoc(inst), key = JSON.stringify(placed.nodes), have = instanceBodies.get(inst.id);
        if (have && have.key === key) { next.set(inst.id, have); continue; }
        const r = await engine.part(placed, revision.current++);
        if (!live) return;
        if (r.ok) next.set(inst.id, { key, bodies: r.bodies });
        else setToast(r.error);
      }
      if (live) setInstanceBodies(next);
    })();
    return () => { live = false; };
  }, [doc.instances]);
  /** One undoable change of the instances and their mates together. */
  const commitAssembly = useCallback((instances: PartInstance[], mates: Mate[]) => {
    setUndo(u => [...u.slice(-49), { doc, marker }]); setRedo([]);
    setDoc({ ...doc, instances, mates }); setDirty(true);
  }, [doc, marker]);
  const assembly = useAssembly({ doc, evaluated, bodies, instanceBodies, setDoc, commit: commitAssembly });
  const instancesShown = useMemo(() => (doc.instances ?? []).filter(i => !i.hidden && instanceBodies.has(i.id)).map(i => ({ id: i.id, bodies: instanceBodies.get(i.id)!.bodies })), [doc.instances, instanceBodies]);
  const insertPart = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as StudioDoc;
      if (parsed.format !== 'barocss-cad-model' || !Array.isArray(parsed.nodes)) throw new Error('Not a BaroCSS model file.');
      const list = doc.instances ?? [], used = new Set(list.map(i => i.id));
      let n = 1; while (used.has(`inst${n}`)) n++;
      // Placed to the right of everything shown.
      const right = Math.max(0, ...bodies.map(b => b.mesh.bounds.max[0]), ...[...instanceBodies.values()].flatMap(v => v.bodies.map(b => b.mesh.bounds.max[0])));
      const inst: PartInstance = { id: `inst${n}`, name: file.name.replace(/\.(bcad|json)$/i, ''), doc: { ...parsed, render: undefined, direct: undefined }, position: [Math.ceil(right + 20), 0, 0], rotation: [0, 0, 0] };
      commitInstances([...list, inst], [inst.id]); setSelection(emptySel); setDirectSel([]);
      setTimeout(() => viewport.current?.fit(), 600);
    } catch (e) { setToast({ title: 'Could not insert this part', hint: e instanceof Error ? e.message : String(e), detail: '' }); }
  };
  // Playing: time runs (looping), the bodies follow their keys and a turntable turns the camera.
  useEffect(() => {
    if (!playing) return;
    let raf = 0, last = performance.now();
    const step = (now: number) => {
      const dt = (now - last) / 1000; last = now;
      setTime(t => (t + dt) % Math.max(0.1, render.animation.duration));
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing, render.animation.duration]);
  useEffect(() => {
    if (!rendering || !render.animation.turntable || !turnFrom.current) return;
    viewport.current?.setCamera({ ...turnFrom.current, yaw: turnFrom.current.yaw + (2 * Math.PI * time) / render.animation.duration });
  }, [time, rendering, render.animation.turntable, render.animation.duration]);
  const play = (on: boolean) => {
    if (on) turnFrom.current = viewport.current?.getCamera() ?? null;
    else if (turnFrom.current && render.animation.turntable) { viewport.current?.setCamera(turnFrom.current); }
    setPlaying(on);
  };
  const animatedOffsets = useMemo(() => {
    if (!rendering || !Object.keys(render.animation.tracks).length) return undefined;
    const at = offsetsAt(render.animation, time), out = new Map<number, Vec3>();
    bodies.forEach((b, i) => { const o = at.get(b.key); if (o) out.set(i, o); });
    return out;
  }, [rendering, render.animation, time, bodies]);
  const exportImage = async () => {
    const png = await viewport.current?.capture();
    if (png) downloadBytes(new Uint8Array(await png.arrayBuffer()), `${fileName}.png`, 'image/png');
    else setToast({ title: 'Could not export an image', hint: 'Rendering needs a browser with WebGPU.', detail: '' });
  };

  const cancel = useCallback(() => { setActive(null); setPreviewBodies(null); setSketch(null); }, []);

  // Live preview: re-evaluate the candidate whenever HUD values change. One evaluation at a time, the
  // newest values next (a drag sends many): the preview keeps up as fast as the kernel does, with no
  // wait before it starts; values typed into a box wait a moment so each keystroke is not evaluated.
  const previewRun = useRef<{ busy: boolean; next: (() => Promise<void>) | null }>({ busy: false, next: null });
  /**
   * A dimension handle being dragged: its last value the kernel accepted, and once a value fails, the side
   * it failed on. The value goes back to the last good one and the drag stops there (no flicking between
   * a broken and a good preview).
   */
  const handleDrag = useRef<{ key: string; lastOk: number; wall: number; dragging: boolean } | null>(null);
  const lastTyped = useRef(0);
  useEffect(() => {
    if (!active?.cmd.build) return;
    let live = true;
    const missing = shownFields(active.cmd.fields?.(active.ctx, active.values) ?? [], active.values).find(f => f.kind !== 'choice' && (active.values[f.key] === '' || !Number.isFinite(Number(active.values[f.key]))));
    if (missing) { setPreviewBodies(null); setActive(a => a && { ...a, preview: 'error', error: { title: 'Enter a value', hint: `${missing.label} is empty.`, detail: '' } }); return; }
    const values = active.values, cmd = active.cmd, ctx = active.ctx;
    const job = async () => {
      let candidate: StudioDoc;
      try { candidate = cmd.build!(ctx, values); } catch (e) { setActive(a => a && { ...a, preview: 'error', error: { title: 'Invalid input', hint: String(e), detail: '' } }); return; }
      const result = await engine.part(candidate, revision.current++);
      // (A newer job is queued: its result supersedes this one, unless this command is gone.)
      if (!live && !previewRun.current.next) return;
      const hd = handleDrag.current, hv = hd ? Number(values[hd.key]) : NaN;
      if (hd && Number.isFinite(hv)) {
        if (result.ok) { if (hd.wall === 0 || Math.sign(hv - hd.lastOk) !== hd.wall) hd.lastOk = hv; }
        else if (hv !== hd.lastOk) {
          hd.wall = Math.sign(hv - hd.lastOk);
          setActive(a => a && a.cmd === cmd ? { ...a, values: patchValues(a.cmd, a.ctx, a.values, { [hd.key]: hd.lastOk }), preview: 'busy' } : a);
          return;
        }
      }
      if (result.ok) { previewFor.current = JSON.stringify(values); setPreviewBodies(result.bodies); setActive(a => a && a.cmd === cmd ? { ...a, preview: JSON.stringify(a.values) === JSON.stringify(values) ? 'ok' : 'busy', error: undefined } : a); }
      else if (live) { setPreviewBodies(null); setActive(a => a && { ...a, preview: 'error', error: result.error }); }
    };
    const run = previewRun.current;
    const pump = async () => { while (run.next) { const j = run.next; run.next = null; run.busy = true; try { await j(); } finally { run.busy = false; } } };
    const typed = Date.now() - lastTyped.current < 50;
    const t = setTimeout(() => { run.next = job; if (!run.busy) void pump(); }, typed ? 140 : 0);
    return () => { live = false; clearTimeout(t); };
  }, [active?.values, active?.cmd, engine]);

  // Apply while the preview is still computing (just after a drag or a typed value) waits for it.
  const applyWhenReady = useRef<Command | null>(null);
  const apply = useCallback(() => {
    if (!active?.cmd.build) return;
    if (active.preview === 'busy') { applyWhenReady.current = active.cmd; return; }
    applyWhenReady.current = null;
    if (active.preview !== 'ok') return;
    // The preview is what the part becomes: shown as the part at once (no step back to the old bodies
    // while the committed document evaluates).
    if (previewBodies) setBodies(previewBodies);
    commit(active.cmd.build(active.ctx, active.values)); setActive(null); setPreviewBodies(null); setSketch(null);
  }, [active, commit, previewBodies]);
  // (Only for the command it was asked for: cancelled or replaced, it is forgotten.)
  useEffect(() => {
    if (applyWhenReady.current && applyWhenReady.current !== active?.cmd) applyWhenReady.current = null;
    else if (applyWhenReady.current && active?.preview !== 'busy') apply();
  }, [active?.preview, active?.cmd, apply]);

  const start = useCallback((cmd: Command) => {
    setPalette(false); setRendering(false); setPlaying(false); setDrawing(false);
    const avail = cmd.available(ctx);
    if (!avail.ok) { setToast({ title: `${cmd.label} can’t run here`, hint: avail.reason, detail: '' }); return; }
    if (cmd.action === 'sketch') {
      // On a selected flat face (horizontal or vertical), joined to its body by default; else on XY.
      const f = selection.faces[0]; const face = f && bodies[f.body]?.mesh.faces[f.face];
      const plane = face ? (face.kind === 'plane' ? planeOfFace(face.normal, face.centroid) : null) : xyPlane();
      if (!plane) { setToast({ title: 'Can’t sketch on this face', hint: 'Pick a flat face, or clear the selection to sketch on XY.', detail: '' }); return; }
      const base = face ? refOf(bodies[f.body]) : null;
      const make = cmd.id === 'revolve' ? 'revolve-y' as const : cmd.id === 'pipe' ? 'pipe' as const : cmd.id === 'loft' ? 'loft' as const : undefined;
      const anchor: SketchAnchor = face ? { kind: 'face', offset: 0, face: { plane, base } } : { kind: 'xy', offset: 0 };
      setSketch({ plane, anchor, tool: make && make !== 'loft' ? 'circle' : 'rectangle', shape: null, base, ...(make ? { make } : {}) }); setActive(null); setPreviewBodies(null);
      const [min, max] = sketchRegion(base && f ? [bodies[f.body]] : bodies, plane);
      viewport.current?.frameSketch(min, max, plane, SKETCH_INSETS); return;
    }
    if (cmd.action === 'measure') {
      // Start from what is selected (one face or edge), then click what to measure to.
      const first: MeasurePick[] = selection.faces[0] ? [{ body: selection.faces[0].body, face: selection.faces[0].face }] : selection.edges[0] ? [{ body: selection.edges[0].body, edge: selection.edges[0].edge }] : [];
      setMeasure(first); setSelection(emptySel); setEditNode(null); return;
    }
    if (!cmd.fields) {
      const candidate = cmd.build!(ctx, {});
      engine.evaluate(candidate, revision.current++).then(result => {
        if (!result) return;
        if (result.ok) commit(candidate); else setToast(result.error);
      });
      return;
    }
    // A profile seen straight on (just after sketching on it) is turned to an angle, so its pull shows.
    if (['extrude', 'revolve', 'pipe', 'loft'].includes(cmd.id)) {
      const [i] = pickedSketches(evaluated.nodes, selection.sketches), n = i !== undefined ? planeOf(evaluated.nodes[i] as SketchNode).normal : null, cam = viewport.current?.camera;
      if (n && cam) { const f = cam.basis().forward; if (Math.abs(f[0] * n[0] + f[1] * n[1] + f[2] * n[2]) > 0.95) viewport.current?.setView('iso'); }
    }
    setActive({ cmd, values: cmd.defaults?.(ctx) ?? {}, preview: 'busy', ctx: { ...ctx } });
  }, [ctx, selection, bodies, engine, commit, evaluated.nodes]);

  /** Moves the sketch to another plane (its shapes keep their plane coordinates) and faces it. */
  const placeSketch = useCallback((kind: SketchAnchor['kind'], offset: number, angle = 0) => {
    if (!sketch) return;
    const face = sketch.anchor?.face, base = kind === 'face' ? face?.base ?? null : null;
    const plane = offsetPlane(tiltPlane(kind === 'face' && face ? face.plane : standardPlane(kind === 'face' ? 'xy' : kind), angle), offset);
    setSketch({ ...sketch, plane, base, anchor: { ...(sketch.anchor ?? { offset: 0 }), kind, offset, angle } });
    const [min, max] = sketchRegion(bodies, plane);
    viewport.current?.frameSketch(min, max, plane, SKETCH_INSETS);
  }, [sketch, bodies]);

  /** Reopens the sketch node `index` in the sketcher (Select tool, its kept constraints back); Finish writes it back in place. */
  const editSketch = (index: number) => {
    const node = doc.nodes[index]; if (node?.kind !== 'sketch') return;
    const { shape, done } = sketchShapes(node), plane: SketchPlane = node.plane ? { origin: [...node.plane.origin], normal: [...node.plane.normal], xAxis: [...node.plane.xAxis] } : xyPlane();
    setEditNode(null); setActive(null); setPreviewBodies(null); setSelection(emptySel);
    setSketch(startPicking({ plane, tool: 'select', shape, done, base: null, editNode: index }, 'select'));
    const [min, max] = sketchRegion(bodies, plane); viewport.current?.frameSketch(min, max, plane, SKETCH_INSETS);
  };
  const finishSketch = useCallback(() => {
    if (!sketch || (!sketch.shape && !sketch.done?.length)) { setSketch(null); return; }
    // A reopened sketch keeps its main profile first (the first outer shape is the main one).
    const shapes = sketch.editNode !== undefined && sketch.shape ? [sketch.shape, ...(sketch.done ?? [])] : [...(sketch.done ?? []), ...(sketch.shape ? [sketch.shape] : [])];
    const profile = profileOf(shapes);
    if ('error' in profile) { setToast({ title: 'Finish the profile first', hint: profile.error, detail: '' }); return; }
    const node = profile.node;
    // The sketch keeps its plane; everything below is in the plane's own coordinates (Z along its normal).
    const placedNode: ModelNode = isDefaultPlane(sketch.plane) ? node : { ...node, plane: { origin: [...sketch.plane.origin], normal: [...sketch.plane.normal], xAxis: [...sketch.plane.xAxis] } } as SketchNode;
    if (sketch.editNode !== undefined) {
      const at = sketch.editNode, next = { ...doc, nodes: doc.nodes.map((n, k) => k === at ? placedNode : n) };
      engine.evaluate(prefixDoc(next, marker ?? next.nodes.length), revision.current++).then(r => { if (!r) return; if (r.ok) { commit(next); setSketch(null); } else setToast(r.error); });
      return;
    }
    // A finished sketch is a feature of its own (it remembers the body it was drawn on): picked, ready
    // for Extrude, Revolve, Pipe or Loft.
    const base = sketch.base ?? null, next = withNode(doc, { ...placedNode, ...(base ? { on: base } : {}) } as SketchNode);
    commit(next); setSketch(null);
    setSelection({ ...emptySel, sketches: [next.nodes.length - 1] });
  }, [sketch, doc, marker, commit, engine]);

  const onPick = useCallback((hit: { face: { body: number; face: number } | null; edge: { body: number; edge: number } | null; point: Vec3 | null; direct?: string; instance?: string; instanceFace?: { body: number; face: number } }, additive: boolean) => {
    if (active) {
      // A command that takes a pick (a revolve's axis edge) gets the click; others ignore it.
      if (!active.cmd.onPick) return;
      const r = active.cmd.onPick(active.ctx, active.values, { face: hit.face, edge: hit.edge });
      if (!r) return;
      if ('error' in r && typeof r.error === 'string' && Object.keys(r).length === 1) { setToast({ title: `${active.cmd.label}: not that one`, hint: r.error, detail: '' }); return; }
      setActive(a => a && { ...a, values: r as Values, preview: 'busy' }); return;
    }
    if (assembly.pick(hit)) return;
    setPick(hit.point);
    if (hit.direct) {
      const id = hit.direct;
      setDirectSel(prev => additive ? (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]) : [id]);
      setSelection(emptySel); setInstanceSel([]); return;
    }
    if (hit.instance) { setInstanceSel([hit.instance]); setSelection(emptySel); setDirectSel([]); return; }
    if (!additive) { setDirectSel([]); setInstanceSel([]); }
    if (measure) {
      if (!hit.face && !hit.edge) return;
      const p: MeasurePick = hit.edge ? { body: hit.edge.body, edge: hit.edge.edge } : { body: hit.face!.body, face: hit.face!.face };
      setMeasure(m => !m || m.length >= 2 ? [p] : [...m, p]); return;
    }
    setSelection(prev => {
      if (!hit.face && !hit.edge) return emptySel;
      if (additive) {
        // Shift-click adds (or takes back) another of what is selected: edges to round or chamfer, faces to
        // open in a shell; with bodies picked (or a mix), the clicked body (two for a Boolean).
        const toggle = <T,>(list: T[], x: T, same: (a: T, b: T) => boolean) => list.some(y => same(x, y)) ? list.filter(y => !same(x, y)) : [...list, x];
        const none = !prev.faces.length && !prev.edges.length && !prev.bodies.length;
        if (hit.edge && !prev.faces.length && !prev.bodies.length) return { ...emptySel, edges: toggle(prev.edges, hit.edge, (a, b) => a.body === b.body && a.edge === b.edge) };
        if (hit.face && !prev.edges.length && !prev.bodies.length && (none || prev.faces.length)) return { ...emptySel, faces: toggle(prev.faces, hit.face, (a, b) => a.body === b.body && a.face === b.face) };
        const b = hit.face?.body ?? hit.edge!.body; const list = selectedBodies(prev);
        return { faces: [], edges: [], bodies: list.includes(b) ? list.filter(x => x !== b) : [...list, b] };
      }
      return hit.edge ? { faces: [], edges: [hit.edge], bodies: [] } : { faces: [hit.face!], edges: [], bodies: [] };
    });
  }, [active, measure, assembly]);
  pickRef.current = onPick;
  // Finished sketches waiting for a feature, drawn and picked in the viewport and the History.
  const freeSketches = useMemo(() => unusedSketches(evaluated.nodes), [evaluated.nodes]);
  const profiles = useMemo(() => sketch ? [] : freeSketches.map(i => ({ id: i, rings: profileRings(evaluated.nodes[i] as SketchNode), picked: !!selection.sketches?.includes(i) })), [freeSketches, evaluated.nodes, selection.sketches, sketch]);
  const pickProfile = useCallback((id: number | null, additive: boolean) => {
    if (id === null) return;
    setDirectSel([]); setInstanceSel([]);
    setSelection(prev => {
      const list = prev.sketches ?? [];
      return { ...emptySel, sketches: additive ? (list.includes(id) ? list.filter(x => x !== id) : [...list, id]) : [id] };
    });
  }, []);

  const doUndo = useCallback(() => {
    if (!undo.length) return; const last = undo[undo.length - 1];
    setRedo(r => [...r, { doc, marker }]); setUndo(u => u.slice(0, -1)); setDoc(last.doc); setMarker(last.marker); cancel();
  }, [undo, doc, marker, cancel]);
  const doRedo = useCallback(() => {
    if (!redo.length) return; const last = redo[redo.length - 1];
    setUndo(u => [...u, { doc, marker }]); setRedo(r => r.slice(0, -1)); setDoc(last.doc); setMarker(last.marker); cancel();
  }, [redo, doc, marker, cancel]);

  // Deleting a feature (with the sketches only it used): later features, mates and drawing dimensions follow.
  const deleteNode = (index: number) => {
    if (marker !== null) { setToast({ title: 'Roll forward to delete', hint: 'Features are deleted from the whole history: roll forward to the end first.', detail: '' }); return; }
    const label = featureLabel(doc.nodes[index], index, doc.nodes), r = deleteFeature(doc, index);
    if ('error' in r) { setToast({ title: `Cannot delete ${label}`, hint: r.error, detail: '' }); return; }
    engine.evaluate(prefixDoc(r.doc, r.doc.nodes.length), revision.current++).then(e => {
      if (!e) return;
      if (!e.ok) { setToast({ ...e.error, title: `Cannot delete ${label}: ${e.error.title}` }); return; }
      commit(r.doc);
      if (r.droppedDimensions) setToast({ title: `Removed ${r.droppedDimensions} drawing dimension${r.droppedDimensions > 1 ? 's' : ''}`, hint: `They measured ${label}. Undo restores them.`, detail: '' });
    });
  };
  // A new or opened part replaces the document: an open sketch or tool would carry the old part's shapes
  // and face references into it, so they close first (U4).
  const replaceDoc = (next: StudioDoc) => { cancel(); commit(next); };
  const save = () => { downloadBytes(new TextEncoder().encode(JSON.stringify(doc, null, 2)), `${fileName}.bcad`, 'application/json'); setDirty(false); clearRecovery(); };
  const open = async (file: File) => {
    try {
      // A STEP file starts a new part from its solids.
      if (/\.(step|stp)$/i.test(file.name)) {
        const name = file.name.replace(/\.(step|stp)$/i, ''), step = await file.text();
        // Read it before replacing the current part: a file the kernel cannot read keeps the part. Read
        // solid by solid, so that a file holding several opens as that many bodies.
        const read = await engine.part(withNode(emptyDoc(), { kind: 'import', name, step, solids: 2 }), revision.current++);
        if (!read.ok) { setToast({ title: 'Could not open this file', hint: `The kernel can’t read it as STEP: ${read.error.detail}. Your part is unchanged.`, detail: read.error.detail }); return; }
        const next = withNode(emptyDoc(), { kind: 'import', name, step, ...(read.bodies.length > 1 ? { solids: read.bodies.length } : {}) });
        replaceDoc(next); setFileName(name); setDirty(true); setTimeout(() => viewport.current?.fit(), 300);
        return;
      }
      // A CAD source adds its curves and surfaces to the part as direct geometry.
      if (/\.(barocad|cad)$/i.test(file.name)) {
        const next = importSource(doc.direct ?? emptyDirect(), await file.text(), file.name.replace(/\.(barocad|cad)$/i, ''));
        commitDirect(next, next.objects.slice((doc.direct?.objects.length ?? 0)).map(o => o.id));
        setTimeout(() => viewport.current?.fit(), 300);
        return;
      }
      const parsed = JSON.parse(await file.text()) as StudioDoc;
      if (parsed.format !== 'barocss-cad-model' || !Array.isArray(parsed.nodes)) throw new Error('Not a BaroCSS model file.');
      replaceDoc({ ...parsed, outputs: prefixDoc(parsed, parsed.nodes.length).outputs, ...(parsed.render ? { render: readRender(parsed.render) } : {}), ...(parsed.drawing ? { drawing: readDrawing(parsed.drawing) } : {}) }); setFileName(file.name.replace(/\.(bcad|json)$/, '')); setDirty(false);
      setTimeout(() => viewport.current?.fit(), 300);
    } catch (e) { setToast({ title: 'Could not open this file', hint: String(e instanceof Error ? e.message : e), detail: '' }); }
  };
  const exportStepFile = async () => {
    // (The evaluated model, with the instances placed beside it now.)
    const r = await engine.step({ ...evaluated, instances: doc.instances }, fileName);
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
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        // While sketching, ⌘Z steps through the outline's edits (constraints, dimensions, values).
        const back = sketch ? (e.shiftKey ? sketchHistory.current.redo(liveShape.current) : sketchHistory.current.undo(liveShape.current)) : null;
        if (back) { liveShape.current = back; setSketchError(null); setSketch(s => s && { ...s, shape: back, picked: [], editDim: null }); return; }
        if (!sketch) { if (e.shiftKey) doRedo(); else doUndo(); }
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); return; }
      if (drawing) return; // (the Drawing workspace has its own keys)
      if (e.key === 'Escape') { if (palette) setPalette(false); else if (sketch && !active && (sketch.picked?.length || sketch.editDim)) setSketch(s => s && { ...s, picked: [], editDim: null }); else if (active || sketch) cancel(); else if (assembly.draft) assembly.cancel(); else if (measure) setMeasure(null); else setSelection(emptySel); return; }
      if (e.key === 'Enter' && !palette) { if (sketch) { e.preventDefault(); finishSketch(); } else if (active) { e.preventDefault(); apply(); } return; }
      // A sketch tool key still works from a number box (letters are no numbers): it leaves the box.
      const numberBox = e.target instanceof HTMLInputElement && e.target.type === 'number' && !e.target.classList.contains('dim-edit');
      if (palette || (typing && !(sketch && numberBox && !e.metaKey && !e.ctrlKey && !e.altKey && /^[a-z]$/i.test(e.key)))) return;
      if (e.key === ' ') { e.preventDefault(); setPalette(true); return; }
      if (sketch) {
        const t = TOOLS.find(x => x.key.toLowerCase() === e.key.toLowerCase() || (x.tool === 'polygon' && e.key.toLowerCase() === 'p'))?.tool;
        if (t) { if (typing) { e.preventDefault(); (e.target as HTMLElement).blur(); } setSketch(s => s && switchTool(s, t)); }
        return;
      }
      if (e.key.toLowerCase() === 'f' && !e.shiftKey) { viewport.current?.fit(); return; }
      const cmd = commands.find(c => c.shortcut && c.shortcut.toLowerCase() === (e.shiftKey ? 'shift ' : '') + e.key.toLowerCase());
      if (cmd && !active) { e.preventDefault(); start(cmd); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const shownBodies = bodyDrag ? bodies : previewBodies ?? bodies;
  // Mate faces show while a mate is being added, or while one is selected in the shown mates list.
  const mateFaces = !!assembly.draft || (!!assembly.selected && instanceSel.length === 1);
  const shownSelection = previewBodies || sketch ? emptySel : mateFaces ? { faces: assembly.highlight.faces, edges: [], bodies: [] } : measure ? { faces: measure.flatMap(m => m.face !== undefined ? [{ body: m.body, face: m.face }] : []), edges: measure.flatMap(m => m.edge !== undefined ? [{ body: m.body, edge: m.edge }] : []), bodies: [] } : selection;
  const measured = measure?.length === 2 && bodies[measure[0].body] && bodies[measure[1].body] ? measureBetween(bodies[measure[0].body].mesh, measure[0], bodies[measure[1].body].mesh, measure[1]) : null;
  const density = MATERIALS.find(m => m.id === material) ?? MATERIALS[0];
  const ghost = useMemo(() => new Set(sketch ? shownBodies.map((_, i) => i) : []), [sketch, shownBodies]);
  // Move and Rotate gizmos on the selected body: while dragged it follows at once (a renderer transform
  // of the evaluated body); let go, the kernel preview of the values runs.
  const dragFrom = useRef<Values | null>(null);
  const cmdBody = active && (active.cmd.id === 'move' || active.cmd.id === 'rotate') && selectedBodies(active.ctx.selection).length === 1 ? selectedBodies(active.ctx.selection)[0] : undefined;
  const gizmo: TransformGizmo | null = active && cmdBody !== undefined && bodies[cmdBody] ? (() => {
    const { min, max } = bodies[cmdBody].mesh.bounds, values = active.values;
    const begin = () => dragFrom.current ?? (dragFrom.current = values);
    const show = (next: Values, matrix: Float64Array, done: boolean) => {
      setBodyDrag({ matrix, settling: done });
      setActive(a => a && { ...a, values: patchValues(a.cmd, a.ctx, a.values, next), preview: 'busy' });
      if (done) dragFrom.current = null;
    };
    if (active.cmd.id === 'move') {
      const v: Vec3 = [Number(values.x), Number(values.y), Number(values.z)];
      return { origin: [(min[0] + max[0]) / 2 + v[0], (min[1] + max[1]) / 2 + v[1], max[2] + v[2]], move: [0, 1, 2],
        onMove: (delta, done) => {
          const from = begin(), next: Vec3 = [Number(from.x) + delta[0], Number(from.y) + delta[1], Number(from.z) + delta[2]];
          show({ x: next[0], y: next[1], z: next[2] }, previewMatrix({ kind: 'move', delta: next }), done);
        } };
    }
    // Rotate: about the pivot, in 15° steps (Shift: 1°).
    const pivot: Vec3 = [Number(values.px), Number(values.py), Number(values.pz)];
    return { origin: pivot, turn: [0, 1, 2],
      onTurn: (axis, degrees, done) => {
        const from = begin(), name = 'xyz'[axis], angle = from.axis === name ? Number(from.angle) + degrees : degrees;
        show({ axis: name, angle }, previewMatrix({ kind: 'turn', axis, degrees: angle, centre: pivot }), done);
      } };
  })() : null;
  // Let go: the dragged look stays until the preview of the final values is in, then the preview shows.
  useEffect(() => { if (bodyDrag?.settling && active && previewFor.current === JSON.stringify(active.values)) setBodyDrag(null); }, [previewBodies, bodyDrag, active]);
  useEffect(() => { setBodyDrag(null); dragFrom.current = null; handleDrag.current = null; }, [active?.cmd.id]);
  // The active command's dimension handles: dragging one sets that value (the preview follows).
  // With nothing running, the selected body's feature (or the one open in the feature editor) offers its
  // dimensions as handles: dragging one starts editing that feature.
  const idleEdit = useMemo(() => {
    if (active || sketch || rendering || drawing || measure || assembly.draft || instanceSel.length) return null;
    const one = selectedBodies(selection), index = editNode ?? (one.length === 1 && bodies[one[0]] ? refOf(bodies[one[0]]).node : null);
    return index === null || (marker !== null && index >= marker) ? null : editCommand(index, evaluated.nodes);
  }, [active, sketch, rendering, drawing, measure, assembly.draft, instanceSel.length, selection, editNode, bodies, evaluated.nodes, marker]);
  const handleCmd = active?.cmd ?? idleEdit, handleValues = active ? active.values : idleEdit?.defaults?.(ctx) ?? {}, handleCtx = active?.ctx ?? ctx;
  const handles: FeatureHandle[] = handleCmd?.handles && !sketch ? handleCmd.handles(handleCtx, handleValues).flatMap(h => {
    const field = (handleCmd.fields?.(handleCtx, handleValues) ?? []).find(f => f.key === h.key), value = Number(handleValues[h.key]);
    if (!field || !Number.isFinite(value)) return [];
    const step = h.step ?? 1;
    return [{ id: h.key, at: h.at, dir: h.dir, label: field.label, value, ...(h.arc ? { arc: h.arc } : {}),
      toValue: (start: number, mm: number) => Math.min(h.max ?? Infinity, Math.max(h.min ?? -Infinity, Math.round((start + mm * (h.scale ?? 1)) / step) * step)),
      format: (v: number) => h.arc ? `${fmt(v)}°` : `${fmt(v)} mm`,
      onDrag: (v: number, done: boolean) => {
        let hd = handleDrag.current;
        if (!hd || hd.key !== h.key || !hd.dragging) hd = handleDrag.current = { key: h.key, lastOk: value, wall: 0, dragging: true };
        // Past the side where a value failed: held at the last good one.
        if (hd.wall && Math.sign(v - hd.lastOk) === hd.wall) v = hd.lastOk;
        if (done) hd.dragging = false;
        // An idle handle opens its feature's edit as the drag starts.
        setActive(a => a ? (a.values[h.key] !== v ? { ...a, values: patchValues(a.cmd, a.ctx, a.values, { [h.key]: v }), preview: 'busy' } : a)
          : { cmd: handleCmd, values: patchValues(handleCmd, handleCtx, handleValues, { [h.key]: v }), preview: 'busy', ctx: { ...handleCtx } });
      } }];
  }) : [];
  const dragTransforms = useMemo(() => cmdBody !== undefined && bodyDrag ? new Map([[cmdBody, bodyDrag.matrix]]) : null, [cmdBody, bodyDrag]);

  // The selected part instance's gizmo: moves along and turns about world axes through its box's centre
  // (only what its mates leave free). It follows at once on screen; let go, it is placed (mates re-solve)
  // and shown as dragged until it is evaluated where it lands.
  const [instDrag, setInstDrag] = useState<{ id: string; drag: InstanceDrag; settling: boolean; key: string } | null>(null);
  const selectedInst = instanceSel.length === 1 ? doc.instances?.find(i => i.id === instanceSel[0]) : undefined;
  const instGizmo: TransformGizmo | null = (() => {
    if (!selectedInst || active || sketch || rendering || drawing || measure || assembly.draft) return null;
    const ib = instanceBodies.get(selectedInst.id), axes = gizmoAxes(selectedInst, assembly.freedom[selectedInst.id]);
    if (!ib?.bodies.length || !axes) return null;
    const lo = [0, 1, 2].map(k => Math.min(...ib.bodies.map(b => b.mesh.bounds.min[k]))), hi = [0, 1, 2].map(k => Math.max(...ib.bodies.map(b => b.mesh.bounds.max[k])));
    const centre = [0, 1, 2].map(k => (lo[k] + hi[k]) / 2) as Vec3, d = instDrag?.id === selectedInst.id && instDrag.drag.kind === 'move' ? instDrag.drag.delta : [0, 0, 0];
    const place = (next: (i: PartInstance) => PartInstance, drag: InstanceDrag, done: boolean, nothing: boolean) => {
      if (done && nothing) { setInstDrag(null); return; }
      setInstDrag({ id: selectedInst.id, drag, settling: done, key: ib.key });
      if (done) commitInstances((doc.instances ?? []).map(i => i.id === selectedInst.id ? next(i) : i));
    };
    return { origin: [centre[0] + d[0], centre[1] + d[1], centre[2] + d[2]], move: axes.move, turn: axes.turn,
      onMove: (delta, done) => place(i => movedInstance(i, delta), { kind: 'move', delta }, done, delta.every(v => v === 0)),
      onTurn: (axis, degrees, done) => place(i => turnedInstance(i, axis, degrees, centre), { kind: 'turn', axis, degrees, centre }, done, degrees === 0) };
  })();
  // Placed: the preview goes once the instance is evaluated where it landed (or after a moment, when the mates put it back).
  useEffect(() => {
    if (!instDrag?.settling) return;
    if (instanceBodies.get(instDrag.id)?.key !== instDrag.key) { setInstDrag(null); return; }
    const t = setTimeout(() => setInstDrag(null), 3000); return () => clearTimeout(t);
  }, [instDrag, instanceBodies]);
  const instancePreview = useMemo(() => instDrag ? { id: instDrag.id, matrix: previewMatrix(instDrag.drag) } : null, [instDrag]);

  const totalNodes = doc.nodes.length; const markerAt = marker ?? totalNodes;
  const sel1 = selection.faces[0] ? { kind: 'face' as const, body: bodies[selection.faces[0].body], face: bodies[selection.faces[0].body]?.mesh.faces[selection.faces[0].face] }
    : selection.edges[0] ? { kind: 'edge' as const, body: bodies[selection.edges[0].body], edge: bodies[selection.edges[0].body]?.mesh.edges[selection.edges[0].edge] } : null;
  const selBodies = selectedBodies(selection).map(i => bodies[i]).filter(Boolean);

  return (
    <div className="studio">
      <Viewport ref={viewport} bodies={shownBodies} selection={shownSelection} ghost={ghost} sketch={sketch} gizmo={gizmo ?? instGizmo} handles={handles} instancePreview={instancePreview} profiles={active ? [] : profiles} onPickProfile={pickProfile} render={rendering ? render : null}
        direct={directShown} directSelection={directSel} offsets={animatedOffsets} transforms={dragTransforms} instances={instancesShown} instanceSelection={assembly.draft ? assembly.highlight.instances : instanceSel} instanceFaces={mateFaces ? assembly.highlight.instanceFaces : undefined}
        onPick={onPick} onCursor={setCursor} onSketchShape={updateShape}
        onBoxSelect={(picked, additive) => { if (active) return; setSelection(prev => {
          const base = additive ? selectedBodies(prev) : [];
          return { faces: [], edges: [], bodies: [...new Set([...base, ...picked])] };
        }); }}
        measureLine={measured && measured.distance > 1e-9 ? { a: measured.a, b: measured.b, label: fmt(Math.round(measured.distance * 100) / 100) + ' mm' } : null}
        onDimClick={key => { const el = document.getElementById('sk-' + key) as HTMLInputElement | null; el?.focus(); el?.select(); }}
        onSketchPick={(hit, additive) => setSketch(s => s && sketchClick(s, hit, additive))}
        onDimEdit={editDim => setSketch(s => s && { ...s, editDim })}
        onDimCommit={(key, value) => {
          const shape = liveShape.current; setSketch(s => s && { ...s, editDim: null });
          if (!isSettled(shape)) return;
          const r = commitDimension(shape, key, value);
          if (r.ok) updateShape(r.shape); else setSketchError(r.reason);
        }}
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
          <button className={!sketch && !rendering && !drawing ? 'on' : ''} onClick={() => { setSketch(null); setRendering(false); setPlaying(false); setDrawing(false); }}>Model</button>
          <button className={sketch ? 'on sketching' : ''} onClick={() => start(commands.find(c => c.id === 'sketch')!)}>{sketch ? `Sketch · ${planeLabel(sketch.plane)}` : 'Sketch'}</button>
          <button className={rendering ? 'on' : ''} onClick={() => { setSketch(null); setActive(null); setMeasure(null); setDrawing(false); setRendering(true); }}>Render</button>
          <button className={drawing ? 'on' : ''} onClick={() => { setSketch(null); setActive(null); setMeasure(null); setRendering(false); setPlaying(false); setDrawing(true); }}>Drawing</button>
        </div>
        <div className="grow" />
        {sketch && <button className="finish" onClick={finishSketch}><Icon name="check" />Finish sketch <Kbd>⏎</Kbd></button>}
        <button className={'tool' + (chat ? ' on' : '')} aria-label="Chat" title="Model by chat" onClick={() => setChat(v => !v)}><Icon name="chat" /></button>
        <button className="tool" aria-label="Undo" title="Undo (⌘Z)" disabled={!undo.length} onClick={doUndo}><Icon name="undo" /></button>
        <button className="tool" aria-label="Redo" title="Redo (⇧⌘Z)" disabled={!redo.length} onClick={doRedo}><Icon name="redo" /></button>
        <button className="tool" aria-label="New part" title="New part" onClick={() => { replaceDoc(emptyDoc()); setFileName('Untitled'); }}><Icon name="add_box" /></button>
        <button className="tool" aria-label="Open" title="Open a .bcad model or a STEP file, or add a .barocad source's curves and surfaces" onClick={() => fileInput.current?.click()}><Icon name="folder_open" /></button>
        <button className="tool" aria-label="Save" title="Save (⌘S)" onClick={save}><Icon name="save" /></button>
        <button className="tool" aria-label="Export STL" title="Export STL" onClick={exportStl}><Icon name="download" /></button>
        <button className="tool" aria-label="Export STEP" title="Export STEP (exact solid for other CAD)" onClick={exportStepFile}><Icon name="deployed_code_update" /></button>
        {!!doc.direct?.objects.some(o => !o.hidden) && <button className="tool" aria-label="Export IGES" title="Export the visible curves and surfaces as IGES" onClick={() => {
          try { downloadBytes(new TextEncoder().encode(directIGES(doc.direct!, fileName)), `${fileName}.igs`, 'model/iges'); }
          catch (e) { setToast({ title: 'Could not write IGES', hint: e instanceof Error ? e.message : String(e), detail: '' }); }
        }}><Icon name="polyline" /></button>}
        <button className="tool" aria-label="Insert part" title="Insert another part (.bcad) as an instance" onClick={() => partInput.current?.click()}><Icon name="add_to_photos" /></button>
        <input ref={partInput} type="file" accept=".bcad,.json" hidden aria-label="Part file" onChange={e => { const f = e.target.files?.[0]; if (f) insertPart(f); e.target.value = ''; }} />
        <input ref={fileInput} aria-label="Model file" type="file" accept=".bcad,.json,.step,.stp,.barocad,.cad" hidden onChange={e => { const f = e.target.files?.[0]; if (f) open(f); e.target.value = ''; }} />
      </header>

      <TooltipLayer />
      <nav className="card toolbar" aria-label="Tools" hidden={rendering}>
        {sketch ? (<>
          {TOOLS.map(t => (
            <button key={t.tool} className={'tool' + (sketch.tool === t.tool ? ' on' : '')} data-tip={t.label} data-tip-key={t.key} aria-label={t.label}
              onClick={() => setSketch(s => s && switchTool(s, t.tool))}><Icon name={t.icon} /></button>))}
          <div className="sep" />
          <button className="tool" data-tip="Clear profile" data-tip-desc="Remove every shape drawn in this sketch" aria-label="Clear profile" onClick={() => setSketch(s => s && { ...s, shape: null, done: [] })}><Icon name="ink_eraser" /></button>
        </>) : (['create', 'modify', 'pattern', 'combine', 'inspect'] as const).map((g, gi) => (
          <div key={g} className="tool-group">
            {gi > 0 && <div className="sep" />}
            {commands.filter(c => c.group === g).map(c => {
              const a = c.available(ctx);
              return <button key={c.id} className={'tool' + (active?.cmd.id === c.id ? ' on' : '') + (a.ok ? '' : ' off')} aria-label={c.label}
                data-tip={c.label} data-tip-key={c.shortcut ?? ''} data-tip-desc={c.hint ?? ''} data-tip-off={a.ok ? '' : a.reason} onClick={() => start(c)}><Icon name={c.icon} /></button>;
            })}
          </div>))}
      </nav>

      <div className="right-col">
      <aside className="card outliner" aria-label="Outliner">
        <div className="card-title">OUTLINER <span className="muted">{shownBodies.length} bod{shownBodies.length === 1 ? 'y' : 'ies'}</span></div>
        {bodies.map((b, i) => {
          const ref = refOf(b); const node = evaluated.nodes[ref.node];
          const sel = selectedBodies(selection).includes(i);
          return <button key={b.key} className={'ol' + (sel ? ' sel' : '')} onClick={e => { setDirectSel([]); setSelection(prev => {
            const list = selectedBodies(prev); return e.shiftKey ? { faces: [], edges: [], bodies: list.includes(i) ? list.filter(x => x !== i) : [...list, i] } : { faces: [], edges: [], bodies: [i] };
          }); }}><Icon name="deployed_code" small />{node ? featureLabel(node, ref.node, evaluated.nodes) : b.key}{ref.side !== 'solid' && <span className="muted"> · {ref.side.startsWith('part') ? `solid ${Number(ref.side.slice(4)) + 1}` : ref.side}</span>}</button>;
        })}
        {(doc.instances ?? []).map(inst => <button key={inst.id} className={'ol instance' + (instanceSel.includes(inst.id) ? ' sel' : '') + (inst.hidden ? ' hidden-obj' : '')}
          onClick={() => { setSelection(emptySel); setDirectSel([]); setInstanceSel([inst.id]); }}><Icon name={inst.hidden ? 'visibility_off' : 'widgets'} small />{inst.name}</button>)}
        {(doc.direct?.objects ?? []).map(o => <button key={o.id} className={'ol direct' + (directSel.includes(o.id) ? ' sel' : '') + (o.hidden ? ' hidden-obj' : '')}
          title={o.hidden ? 'Hidden: click to show' : o.name}
          onClick={e => {
            if (o.hidden) { commitDirect({ ...doc.direct!, objects: doc.direct!.objects.map(x => x.id === o.id ? { ...x, hidden: false } : x) }, [o.id]); return; }
            setSelection(emptySel); setDirectSel(prev => e.shiftKey ? (prev.includes(o.id) ? prev.filter(x => x !== o.id) : [...prev, o.id]) : [o.id]);
          }}><Icon name={o.hidden ? 'visibility_off' : 'gesture'} small />{o.name}</button>)}
        {!!doc.direct?.objects.length && viewport.current?.backend === 'webgl2' && <div className="empty">Curves and surfaces show in browsers with WebGPU.</div>}
        {!bodies.length && !busy && <div className="empty">No bodies yet. Press <Kbd>S</Kbd> to sketch or <Kbd>B</Kbd> for a box.</div>}
      </aside>

      {sketch && <SketchPanel sketch={sketch} error={sketchError} onShape={updateShape} onPlace={sketch.editNode === undefined ? placeSketch : undefined} onUi={patch => setSketch(s => s && { ...s, ...patch })} />}
      {rendering && !sketch && <RenderPanel render={render} available={viewport.current?.backend === 'webgpu'}
        selectedKeys={[...selectedBodies(selection).map(i => bodies[i]?.key).filter((k): k is string => !!k), ...instanceSel.map(id => 'inst:' + id)]}
        onChange={commitRender} onExport={exportImage}
        onSaveCamera={() => { const c = viewport.current?.getCamera(); if (c) commitRender({ ...render, camera: c }); }}
        onUseCamera={() => { if (render.camera) viewport.current?.setCamera(render.camera); }} />}
      {!rendering && !sketch && measure && <aside className="card props" aria-label="Measurement">
        <div className="card-title">MEASURE <button className="tool tiny" aria-label="Done measuring" onClick={() => setMeasure(null)}><Icon name="close" small /></button></div>
        {measure.map((m, k) => { const b = bodies[m.body]; if (!b) return null; const it = measureItem(b.mesh, m); return <div key={k} className="measure-item">
          <div className="kv">{k ? 'To' : 'From'} <b>{it.label}</b></div>
          {it.length !== undefined && <div className="kv">Length <b>{fmt(Math.round(it.length * 100) / 100)} mm</b></div>}
          {it.area !== undefined && <div className="kv">Area <b>{fmt(Math.round(it.area * 100) / 100)} mm²</b></div>}
          {it.radius !== undefined && <div className="kv">Radius <b>{fmt(Math.round(it.radius * 1000) / 1000)} mm</b></div>}
        </div>; })}
        {measured && <>
          <div className="card-title" style={{ marginTop: 10 }}>BETWEEN</div>
          <div className="kv">Distance <b>{fmt(Math.round(measured.distance * 1000) / 1000)} mm</b></div>
          {measured.normalDistance !== undefined && <div className="kv">Normal distance <b>{fmt(Math.round(measured.normalDistance * 1000) / 1000)} mm</b></div>}
          {measured.angle !== undefined && <div className="kv">Angle <b>{fmt(Math.round(measured.angle * 100) / 100)}°</b></div>}
          <div className="kv">ΔX ΔY ΔZ <b>{measured.b.map((v, k) => fmt(Math.round((v - measured.a[k]) * 100) / 100)).join(', ')}</b></div>
        </>}
        <div className="empty">{measure.length < 2 ? `Click a face or an edge to measure ${measure.length ? 'to' : 'from'}.` : 'Click again to start over.'} <Kbd>Esc</Kbd> done</div>
      </aside>}
      {!rendering && !sketch && !measure && instanceSel.length === 1 && (() => {
        const inst = doc.instances?.find(i => i.id === instanceSel[0]);
        if (!inst) return null;
        const list = doc.instances!;
        return <InstancePanel inst={inst} bodies={instanceBodies.get(inst.id)?.bodies}
          onChange={next => commitInstances(list.map(i => i.id === inst.id ? next : i))}
          onDuplicate={() => { const used = new Set(list.map(i => i.id)); let n = 1; while (used.has(`inst${n}`)) n++;
            commitInstances([...list, { ...inst, id: `inst${n}`, name: `${inst.name} copy`, position: [inst.position[0] + 20, inst.position[1] + 20, inst.position[2]] }], [`inst${n}`]); }}
          onGround={on => { const why = assembly.ground(inst.id, on); if (why) setToast({ title: 'Can’t fix this part in place', hint: why, detail: '' }); }}
          onRemove={() => { commitAssembly(list.filter(i => i.id !== inst.id), assembly.without(inst.id)); setInstanceSel([]); }} />;
      })()}
      {!rendering && !sketch && !measure && !!doc.instances?.length && (assembly.draft || instanceSel.length === 1) && <MatePanel assembly={assembly} instances={doc.instances} instance={instanceSel.length === 1 ? instanceSel[0] : undefined}
        onRefused={why => setToast({ title: 'The mate was refused', hint: why, detail: '' })} />}
      {!rendering && !sketch && !measure && !instanceSel.length && directSel.length > 0 && doc.direct && <DirectPanel direct={doc.direct} selected={directSel}
        onChange={commitDirect} onError={m => setToast({ title: 'The operation was refused', hint: m, detail: '' })}
        onHide={ids => { commitDirect({ ...doc.direct!, objects: doc.direct!.objects.map(o => ids.includes(o.id) ? { ...o, hidden: true } : o) }, []); }} />}
      {!rendering && !sketch && !measure && !directSel.length && !instanceSel.length && !assembly.draft && <aside className="card props" aria-label="Selection">
        {sel1?.kind === 'face' && sel1.face ? (<>
          <div className="card-title">SELECTION · FACE</div>
          <div className="kv">Type <b>{sel1.face.kind === 'plane' ? 'Planar' : 'Curved'}</b></div>
          {sel1.face.kind === 'plane' && <div className="kv">Normal <b>{sel1.face.normal.map(v => fmt(Math.round(v * 1000) / 1000)).join(', ')}</b></div>}
          <div className="kv">Area <b>{fmt(Math.round(sel1.face.areaMM2 * 100) / 100)} mm²</b></div>
          {sel1.face.radius !== undefined && <div className="kv">Radius <b>{fmt(Math.round(sel1.face.radius * 1000) / 1000)} mm</b></div>}
        </>) : sel1?.kind === 'edge' && sel1.edge ? (<>
          <div className="card-title">SELECTION · EDGE</div>
          {(() => { const it = measureItem(sel1.body.mesh, { body: selection.edges[0].body, edge: selection.edges[0].edge }); return <>
            <div className="kv">Type <b>{it.label}</b></div>
            {it.length !== undefined && <div className="kv">Length <b>{fmt(Math.round(it.length * 100) / 100)} mm</b></div>}
            {it.radius !== undefined && <div className="kv">Radius <b>{fmt(Math.round(it.radius * 1000) / 1000)} mm</b></div>}
          </>; })()}
          {sel1.edge.axis && <div className="kv">Direction <b>{sel1.edge.axis.toUpperCase()}</b></div>}
        </>) : null}
        {selBodies.length > 0 && <>
          <div className="card-title" style={{ marginTop: sel1 ? 10 : 0 }}>BODY{selBodies.length > 1 ? ` · ${selBodies.length} selected` : ''}</div>
          {selBodies.slice(0, 1).map(b => { const { min, max } = b.mesh.bounds; return <div key={b.key}>
            <div className="kv">Bounds <b>{fmt(max[0] - min[0])} × {fmt(max[1] - min[1])} × {fmt(max[2] - min[2])}</b></div>
            {b.volumeMM3 !== null && <div className="kv">Volume <b>{fmt(Math.round(b.volumeMM3))} mm³</b></div>}
            {b.volumeMM3 !== null && <div className="kv">Mass <b>{fmt(Math.round(b.volumeMM3 * density.gPerCm3 / 100) / 10)} g</b></div>}
            <label className="kv">Material <select aria-label="Material" value={material} onChange={e => setMaterial(e.target.value)}>{MATERIALS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}</select></label>
            <div className="kv">Faces <b>{b.mesh.faces.length}</b></div>
          </div>; })}
        </>}
        {!sel1 && !selBodies.length && <div className="empty">Click a face or edge; Shift-click adds more of the same (edges to round, faces to open). For a Boolean, Shift-click a second body in the Outliner.</div>}
        {editNode !== null && <NodeEditor nodes={doc.nodes} index={editNode} onEditSketch={(() => { const n = doc.nodes[editNode]; const s = n?.kind === 'sketch' ? editNode : n && 'sketch' in n ? n.sketch : null; return s !== null && doc.nodes[s]?.kind === 'sketch' ? () => editSketch(s) : undefined; })()} onApply={nodes => {
          const next = { ...doc, nodes };
          engine.evaluate(prefixDoc(next, marker ?? next.nodes.length), revision.current++).then(r => { if (!r) return; if (r.ok) commit(next); else setToast(r.error); });
        }} onDelete={() => deleteNode(editNode)} onClose={() => setEditNode(null)} />}
      </aside>}
      </div>

      {drawing && <DrawingWorkspace engine={engine} doc={{ ...evaluated, instances: doc.instances }} settings={doc.drawing ?? defaultDrawing()} fileName={fileName} onChange={commitDrawing} onToast={setToast} />}

      {active && <Hud active={active} onChange={(key, value) => { lastTyped.current = Date.now(); handleDrag.current = null; setActive(a => a && { ...a, values: patchValues(a.cmd, a.ctx, a.values, { [key]: value }), preview: 'busy' }); }} onApply={apply} onCancel={cancel} />}

      {sketch && !active && <div className="card hint-bar">
        {(() => { const t = TOOLS.find(x => x.tool === sketch.tool)!; return <><span className="hint-title"><Icon name={t.icon} small />{t.label}</span><span>{t.hint}</span></>; })()}
        <span>{TOOLS.map(t => <Kbd key={t.key}>{t.key}</Kbd>)} tools</span><span><Kbd>Enter</Kbd> finish → extrude</span><span><Kbd>Esc</Kbd> exit</span>
      </div>}

      {rendering && !sketch && (() => {
        const i = selectedBodies(selection)[0], b = i !== undefined ? bodies[i] : undefined, ref = b ? refOf(b) : null, node = ref ? evaluated.nodes[ref.node] : null;
        return <Timeline animation={render.animation} time={time} playing={playing} bodyKey={b?.key ?? null}
          bodyLabel={node && ref ? featureLabel(node, ref.node, evaluated.nodes) : b?.key ?? ''}
          onTime={t => { setPlaying(false); setTime(t); }} onPlay={play} onChange={a => commitRender({ ...render, animation: a })} />;
      })()}
      {!sketch && !active && !rendering && <div className="card history" aria-label="History">
        <span className="card-title inline">HISTORY</span>
        {doc.nodes.map((n, i) => n.kind === 'sketch' ? (freeSketches.includes(i) ? (
          // A finished sketch no feature uses yet: click picks it as a profile (Shift adds) and opens its editor.
          <button key={i} className={'hs sketch' + (i >= markerAt ? ' rolled' : '') + (selection.sketches?.includes(i) ? ' picked' : '') + (editNode === i ? ' edit' : '')} title={`${featureLabel(n, i, doc.nodes)} · click to pick it as a profile (Shift: add) · double-click to roll back here`}
            onClick={e => { pickProfile(i, e.shiftKey); setEditNode(i); }} onDoubleClick={() => setMarker(i + 1 >= totalNodes ? null : i + 1)}>
            <Icon name="cad-sketch" small />{featureLabel(n, i, doc.nodes)}</button>) : null) : (
          <button key={i} className={'hs' + (i >= markerAt ? ' rolled' : '') + (editNode === i ? ' edit' : '')} title={`${featureLabel(n, i, doc.nodes)} · click to edit · double-click to roll back here`}
            onClick={() => { setEditNode(i); setInstanceSel([]); setDirectSel([]); assembly.cancel(); }} onDoubleClick={() => setMarker(i + 1 >= totalNodes ? null : i + 1)}>
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

      {chat && !rendering && !drawing && <ChatPanel base={() => evaluated} evaluate={d => engine.part(d, revision.current++).then(r => r.ok ? r.bodies : null)}
        blocked={sketch ? 'Finish or leave the sketch to chat.' : active ? `Apply or cancel ${active.cmd.label} to chat.` : null}
        onPreview={setPreviewBodies} onCommit={(next, sel) => { chatSelection.current = sel ?? null; commit(next); }}
        onSelect={sel => setSelection(resolveNames(bodies, sel).selection)} onClose={() => setChat(false)} />}
      {palette && <Palette ctx={ctx} onRun={start} onClose={() => setPalette(false)} />}
      {menu && <ContextMenu at={menu.at} title={menu.title} ctx={{ ...ctx, selection: menu.selection }} onClose={() => setMenu(null)}
        onRun={c => { setMenu(null); start(c); }}
        actions={[
          { label: 'Frame all', icon: 'fit_screen', shortcut: 'F', run: () => viewport.current?.fit() },
          { label: 'Isometric view', icon: 'view_in_ar', run: () => viewport.current?.setView('iso') },
          { label: 'Top view', icon: 'crop_square', run: () => viewport.current?.setView('top') },
          { label: 'Clear selection', icon: 'deselect', shortcut: 'Esc', run: () => setSelection(emptySel) },
        ]} />}

      {recovery && <div className="toast card recovery" role="dialog" aria-label="Recover unsaved work">
        <Icon name="history" className="accent" />
        <div><div className="toast-title">Unsaved work from {new Date(recovery.savedAt).toLocaleString()}</div>
          <div className="toast-hint">“{recovery.fileName}” was not saved. Restore it, or discard the copy.</div>
          <div className="row-actions">
            <button className="primary" onClick={() => { commit(recovery.doc); setFileName(recovery.fileName); setRecovery(null); setTimeout(() => viewport.current?.fit(), 300); }}>Restore</button>
            <button className="ghost" onClick={() => { clearRecovery(); setRecovery(null); }}>Discard</button>
          </div></div>
      </div>}
      {toast && <div className="toast card" role="alert">
        <Icon name="info" className="accent" />
        <div><div className="toast-title">{toast.title}</div><div className="toast-hint">{toast.hint}</div>
          {toast.detail && <details><summary>Details</summary><code>{toast.detail}</code></details>}</div>
        <button className="tool" aria-label="Dismiss" onClick={() => setToast(null)}><Icon name="close" small /></button>
      </div>}
    </div>
  );
}

/** Densities in g/cm³ for the mass shown with a body. */
const MATERIALS = [
  { id: 'al6061', label: 'Aluminium 6061', gPerCm3: 2.70 }, { id: 'steel', label: 'Steel (mild)', gPerCm3: 7.85 }, { id: 'ss304', label: 'Stainless 304', gPerCm3: 8.00 },
  { id: 'brass', label: 'Brass', gPerCm3: 8.50 }, { id: 'ti64', label: 'Titanium Ti-6Al-4V', gPerCm3: 4.43 }, { id: 'abs', label: 'ABS', gPerCm3: 1.04 },
  { id: 'pla', label: 'PLA', gPerCm3: 1.24 }, { id: 'pa12', label: 'Nylon PA12', gPerCm3: 1.01 },
];

function iconFor(n: ModelNode) {
  return ({ extrude: 'height', revolve: 'autorenew', shell: 'inventory_2', import: 'file_open', sweep: 'conversion_path', loft: 'filter_list', hole: 'radio_button_checked', chamfer: 'change_history', fillet: 'rounded_corner', union: 'join_full', difference: 'join_left', intersect: 'join_inner',
    translate: 'open_with', rotate: '3d_rotation', mirror: 'flip', scale: 'open_in_full', 'linear-pattern': 'view_week', 'circular-pattern': 'motion_photos_on', split: 'vertical_split', sketch: 'draw' } as Record<string, string>)[n.kind] ?? 'category';
}

function NodeEditor({ nodes, index, onApply, onClose, onEditSketch, onDelete }: { nodes: ModelNode[]; index: number; onApply(nodes: ModelNode[]): void; onClose(): void; onEditSketch?(): void; onDelete(): void }) {
  // The draft is the whole node list: a sketch dimension changes the sketch the feature is made from.
  const [draft, setDraft] = useState<ModelNode[]>(nodes);
  // What is typed in a number box until it reads as a number (so a box can be cleared and retyped).
  const [typed, setTyped] = useState<Record<string, string>>({});
  useEffect(() => { setDraft(nodes); setTyped({}); }, [nodes, index]);
  const fields = editFields(draft, index).filter(f => f.kind !== 'number' || !Number.isNaN(f.get(draft)));
  const changed = draft !== nodes;
  return (
    <div className="node-editor" onKeyDown={e => { if (e.key === 'Enter' && changed) onApply(draft); else if (e.key === 'Escape') onClose(); else if (e.key === 'Delete' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement)) onDelete(); }}>
      <div className="card-title" style={{ marginTop: 10 }}>EDIT FEATURE <button className="tool tiny" aria-label="Close editor" onClick={onClose}><Icon name="close" small /></button></div>
      {onEditSketch && <button className="ghost" aria-label="Edit sketch" title="Reopen the sketch this feature is made from, with its constraints" onClick={onEditSketch}><Icon name="draw" small /> Edit sketch</button>}
      {fields.length ? fields.map(f => (
        <label key={f.key} className="field"><span>{f.label}</span>
          {f.kind === 'number' ? <span className="num"><input type="number" step="any" aria-label={f.label} value={typed[f.key] ?? f.get(draft)} onChange={e => { const t = e.target.value, v = Number(t); setTyped(m => ({ ...m, [f.key]: t })); if (t.trim() !== '' && Number.isFinite(v)) setDraft(d => f.set(d, v)); }} />{f.unit && <em>{f.unit}</em>}</span>
            : f.kind === 'choice' ? <select aria-label={f.label} value={f.get(draft)} onChange={e => setDraft(d => f.set(d, e.target.value))}>{f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
            : <input type="checkbox" className="check" aria-label={f.label} checked={f.get(draft)} onChange={e => setDraft(d => f.set(d, e.target.checked))} />}
        </label>
      )) : <div className="empty">This feature has no editable dimensions.</div>}
      <button className="ghost danger" aria-label="Delete feature" title="Delete this feature (and the sketch only it uses) · Undo restores it" onClick={onDelete}><Icon name="delete" small /> Delete feature</button>
      {fields.length > 0 && <div className="row-actions"><button className="primary" disabled={!changed} onClick={() => onApply(draft)}>Apply</button><button className="ghost" disabled={!changed} onClick={() => { setDraft(nodes); setTyped({}); }}>Reset</button></div>}
    </div>
  );
}
