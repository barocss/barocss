import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EngineClient } from './engine/client';
import { placedDoc, type PartInstance } from './engine/doc';
import { dropStaleMade, emptyDoc, featureLabel, fmt, parentsOf, prefixDoc, starterDoc, withNode, type ModelNode, type Side, type SketchNode, type StudioDoc } from './engine/doc';
import type { BodyResult } from './engine/evaluate';
import type { FriendlyError } from './engine/errors';
import type { Vec3 } from './engine/mesh';
import { carrySelection, commands, patchValues, refOf, selectedBodies, shownFields, type Command, type Ctx, type Selection, type Values } from './app/commands';
import { measureBetween, measureItem, type MeasurePick } from './app/measure';
import { editFields } from './app/editFields';
import { DRAG_TYPE, Viewport, type FeatureHandle, type Spot, type SketchAnchor, type SketchShape, type SketchState, type SketchTool, type TransformGizmo, type ViewportHandle } from './viewport/Viewport';
import { Icon, Kbd } from './ui/atoms';
import { Hud } from './ui/Hud';
import { Palette } from './ui/Palette';
import { ContextMenu } from './ui/ContextMenu';
import { ShortcutHelp } from './ui/ShortcutHelp';
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
import { bodyNodes, deleteFeature, deleteFeatures, duplicateBody } from './chat/features';
import { defaultDrawing, readDrawing, type DrawingSettings } from './drawing/types';
import { MatePanel } from './ui/MatePanel';
import { useAssembly } from './assembly/useAssembly';
import { pickedSketches, planeOf, profileRings, unusedSketches } from './app/profiles';
import { fastenerName, fastenerThread } from './app/fasteners';
import { edgeChain } from './app/edgeChain';
import { offsetShape } from './sketch/offset';
import { extendAt, joinOpen, splitAt, trimAt } from './sketch/trim';
import { clipMesh } from './engine/clip';
import { faceProfile } from './app/faceProfile';
import { sketchShapes } from './sketch/reopen';
import { BODY_COLOURS, bodyName, bodySteps, describeChange, lastFeature, lookOf, rgbOf, rootOf, withLook } from './app/bodies';
import { extrudeProfile } from './app/profileCommands';
import { editCommand, featureOfPick } from './app/editCommand';
import { alignMove, gizmoAxes, movedInstance, previewMatrix, turnedInstance, type InstanceDrag } from './assembly/drag';
import type { Mate } from './assembly/mates';
import { directDisplay, directIGES, emptyDirect, importIGESFile, importSource, type DirectGeometry } from './engine/direct';
import { stepLengthUnit } from './engine/stepUnits';
import { bodyMass, boxOf, combined, inertiaAbout, sig3 } from './app/mass';
import { defaultRender, offsetsAt, readRender, type RenderCamera, type RenderSettings } from './engine/render';
import { downloadBytes, meshToStl } from './ui/files';
import { settleShape } from './sketch/settle';
import { boxOnPlane, isDefaultPlane, offsetPlane, planeLabel, planeOfFace, standardPlane, tiltPlane, xyPlane, type SketchPlane } from './sketch/plane';
import { profileOf, shapeNode } from './sketch/loops';
import { commitDimension, isSettled } from './sketch/rules';
import { sketchClick, startPicking } from './sketch/select';
import { SketchHistory } from './sketch/history';

const TOOLS: { tool: SketchTool; key: string; label: string; icon: string; hint: string }[] = [
  { tool: 'rectangle', key: 'R', label: 'Rectangle', icon: 'cad-sk-rect', hint: 'Click two corners' },
  { tool: 'circle', key: 'C', label: 'Circle', icon: 'cad-sk-circle', hint: 'Click centre, then radius' },
  { tool: 'polygon', key: 'L', label: 'Line', icon: 'cad-sk-line', hint: 'Click points, click the first point to close · A switches to arcs' },
  { tool: 'arc', key: 'A', label: 'Arc', icon: 'cad-sk-arc', hint: 'Click the arc end, move to bend it, click to place · L back to lines' },
  { tool: 'carc', key: 'Q', label: 'Centre arc', icon: 'cad-sk-carc', hint: 'Click the centre, then the start (the radius), then turn to the end and click · it joins lines that meet its ends' },
  { tool: 'slot', key: 'O', label: 'Slot', icon: 'cad-sk-slot', hint: 'Click both centres, then the width' },
  { tool: 'trim', key: 'T', label: 'Trim', icon: 'cad-sk-trim', hint: 'Click a piece to cut it back to where it crosses others · pieces meeting end to end join into one outline' },
  { tool: 'extend', key: 'E', label: 'Extend', icon: 'cad-sk-extend', hint: 'Click near the open end of a line or arc to run it on to the next piece it meets' },
  { tool: 'split', key: 'K', label: 'Split', icon: 'cad-sk-split', hint: 'Click a line, arc or circle to split it in two there (a new point to constrain or trim to)' },
  { tool: 'select', key: 'S', label: 'Select', icon: 'cad-sk-select', hint: 'Click points and edges (Shift adds), then constrain them in the panel' },
  { tool: 'dimension', key: 'D', label: 'Dimension', icon: 'cad-sk-dim', hint: 'Click an edge, an arc or two points, type the value, Enter · double-click to edit' },
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
  // A closed shape stays in the sketch beside the next one; so does a construction line (open or not).
  // (So do open lines and arcs: pieces meeting end to end join into an outline, and Trim works on them.)
  const keep = s.shape && (shapeNode(s.shape) || ((s.shape.construction || s.shape.kind === 'polygon') && (s.shape.kind !== 'polygon' || s.shape.points.length > 1)));
  return { ...s, tool, shape: null, ...(keep ? { done: joinOpen([...(s.done ?? []), { ...s.shape!, ...(s.shape!.kind === 'polygon' ? { pending: false } : {}) }]) } : {}) };
};

const emptySel: Selection = { faces: [], edges: [], bodies: [] };
/** What a command is about to add, in its preview. */
const PREVIEW_TINT = '#7fb2f0';

/** `placing`: a new shape that follows the pointer until a click (or a drop from the rail) stands it there. */
interface Active { cmd: Command; values: Values; preview: 'busy' | 'ok' | 'error'; error?: FriendlyError; ctx: Ctx; placing?: boolean }

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
  const constructRef = useRef(false); constructRef.current = !!sketch?.construct;
  const updateShape = useCallback((shape: SketchShape | null, fresh = false) => {
    // (An open line or arc stays too: pieces meeting end to end join, and close into an outline.)
    const prev = liveShape.current, keep = fresh && prev && (shapeNode(prev) || prev.construction || (prev.kind === 'polygon' && !prev.closed && !prev.pending && prev.points.length >= 2)) ? prev : null;
    // A new shape is construction while the mode is on; the one being drawn stays what it began as.
    if (shape) { const c = !prev || fresh ? constructRef.current : !!prev.construction; shape = c ? { ...shape, construction: true } : shape.construction ? (({ construction: _c, ...rest }) => rest as SketchShape)(shape) : shape; }
    const r = settleShape(shape, keep ? null : prev); liveShape.current = r.shape;
    if (!keep && isSettled(prev) && isSettled(r.shape)) sketchHistory.current.push(prev, r.shape);
    setSketchError(r.error); setSketch(s => s && { ...s, shape: r.shape, ...(keep ? { done: joinOpen([...(s.done ?? []), keep]) } : {}) });
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
  /** The body whose name is being typed in the browser (its key). */
  const [renaming, setRenaming] = useState<string | null>(null);
  /** Bodies whose features the browser lists under them (by key). */
  const [expanded, setExpanded] = useState<string[]>([]);
  const [help, setHelp] = useState(false);
  /** The grid step (mm): sketch points, placing, gizmo moves and dimension arrows (0: off). */
  /** The selection filter (kept between visits). */
  const [pickFilter, setPickFilter] = useState<'all' | 'face' | 'edge' | 'body'>(() => { try { const v = localStorage.getItem('studio.pick'); return v === 'face' || v === 'edge' || v === 'body' ? v : 'all'; } catch { return 'all'; } });
  const pickFilterRef = useRef(pickFilter); pickFilterRef.current = pickFilter;
  const [snapStep, setSnapStep] = useState(() => { try { const v = Number(localStorage.getItem('studio.snap') ?? '1'); return [1, 0.5, 0.1, 5, 10, 0].includes(v) ? v : 1; } catch { return 1; } });
  /** The history chip right-clicked: its menu (edit, edit sketch, roll back here, delete). */
  const [historyMenu, setHistoryMenu] = useState<{ at: { x: number; y: number }; index: number } | null>(null);
  /** The last interference check: each overlapping pair of bodies (by key) and its overlap, or 'busy'. */
  const [clashes, setClashes] = useState<{ a: string; b: string; volume: number }[] | 'busy' | null>(null);
  // (A check is of the part as it was: any change to the part closes it.)
  useEffect(() => { setClashes(c => c === 'busy' ? c : null); }, [doc.nodes]);
  /**
   * The section view: every body cut by a plane across `axis` at `at`, the `keep` side shown with its cut
   * faces lit (the kernel's split, display only — the model is not changed).
   */
  /** The Body panel: inertia about the centre of mass or the origin; the bounding box drawn. */
  const [inertiaAt, setInertiaAt] = useState<'centre' | 'origin'>('centre');
  const [showBox, setShowBox] = useState(false);
  const [section, setSection] = useState<{ axis: 'x' | 'y' | 'z'; at: number; keep: 'negative' | 'positive' } | null>(null);
  const [sectionExact, setSectionExact] = useState<{ key: string; bodies: BodyResult[] } | null>(null);
  const sectionRef = useRef(section); sectionRef.current = section;
  const activeRef = useRef<Active | null>(null);
  /** The body whose browser row the pointer is on (lit in the viewport). */
  const [rowHover, setRowHover] = useState<number | null>(null);
  const [browserOpen, setBrowserOpen] = useState(() => { try { return localStorage.getItem('cad-studio.browser') !== 'closed'; } catch { return true; } });
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
  // (Dev/test: what is picked, as the commands see it.)
  useEffect(() => { if (import.meta.env.DEV) (window as unknown as { __studioSelection: unknown }).__studioSelection = { selection, bodies: bodies.length, active: active?.cmd.id ?? null, sketch: !!sketch, measure: !!measure }; });
  // Dev/test hooks: select an edge or a face by its persistent name (canvas picks are not reproducible).
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as { __studioSelectEdge: (name: string) => boolean }).__studioSelectEdge = name => {
      for (const [b, body] of bodies.entries()) { const i = body.mesh.edges.findIndex(e => e.names.includes(name)); if (i >= 0) { setSelection({ faces: [], edges: [{ body: b, edge: i }], bodies: [] }); return true; } }
      return false;
    };
    (window as unknown as { __studioSelectFace: (name: string) => boolean }).__studioSelectFace = name => {
      for (const [b, body] of bodies.entries()) { const i = body.mesh.faces.findIndex(f => f.name.split('+').includes(name)); if (i >= 0) { setInstanceSel([]); setDirectSel([]); setSelection({ faces: [{ body: b, face: i }], edges: [], bodies: [] }); return true; } }
      return false;
    };
    // A click on a named face, as the viewport reports it (measure picks go through it).
    (window as unknown as { __studioPickFace: (name: string) => boolean }).__studioPickFace = name => {
      for (const [b, body] of bodies.entries()) { const i = body.mesh.faces.findIndex(f => f.name.split('+').includes(name)); if (i >= 0) { pickRef.current({ face: { body: b, face: i }, edge: null, point: null }, false); return true; } }
      return false;
    };
    // Where a model point is on the page (CSS px), for clicks that must land on a face.
    (window as unknown as { __studioScreenOf: (p: Vec3) => [number, number] | null }).__studioScreenOf = p => {
      const c = document.querySelector('.vp-canvas') as HTMLCanvasElement | null, cam = viewport.current?.camera; if (!c || !cam) return null;
      const r = c.getBoundingClientRect(), q = cam.project(p, r.width, r.height); return [r.left + q[0], r.top + q[1]];
    };
    // A double-click on the first top edge of the first body, as the viewport reports it: how many edges it picks.
    (window as unknown as { __studioChainTop: () => number }).__studioChainTop = () => {
      const m = bodies[0]?.mesh, e = m ? m.edges.findIndex(x => x.straight && x.a[2] >= m.bounds.max[2] - 1e-6 && x.b[2] >= m.bounds.max[2] - 1e-6) : -1;
      if (!m || e < 0) return 0;
      const chain = edgeChain(m, e); setSelection({ faces: [], edges: chain.map(edge => ({ body: 0, edge })), bodies: [] }); return chain.length;
    };
    // A click on a named edge (`a|b`), as the viewport reports it.
    (window as unknown as { __studioPickEdge: (name: string, additive?: boolean) => boolean }).__studioPickEdge = (name, additive = false) => {
      for (const [b, body] of bodies.entries()) { const i = body.mesh.edges.findIndex(e => e.names.includes(name)); if (i >= 0) { pickRef.current({ face: null, edge: { body: b, edge: i }, point: null }, additive); return true; } }
      return false;
    };
  }, [bodies]);

  // (Render settings do not change the model: only its nodes and parameters re-evaluate it.)
  const evaluated = useMemo(() => prefixDoc(doc, marker ?? doc.nodes.length), [doc.nodes, doc.parameters, marker]);
  // The section: the part with each body that crosses the plane split there (the rest kept or left out whole).
  useEffect(() => {
    if (!section) { setSectionExact(null); return; }
    let live = true; const key = JSON.stringify(section);
    const k = 'xyz'.indexOf(section.axis), keep = section.keep, nodes = [...evaluated.nodes], kept: string[] = [];
    let doc: StudioDoc = { ...evaluated, nodes };
    for (const b of bodies) {
      const { min, max } = b.mesh.bounds, ref = refOf(b);
      if (min[k] < section.at - 1e-6 && max[k] > section.at + 1e-6) { doc = withNode(doc, { kind: 'split', parent: ref, axis: section.axis, at: section.at }); kept.push(`b${doc.nodes.length - 1}_${keep}`); }
      else if (keep === 'negative' ? max[k] <= section.at + 1e-6 : min[k] >= section.at - 1e-6) kept.push(b.key);
    }
    engine.preview(doc, revision.current++).then(r => { if (live && r.ok) setSectionExact({ key, bodies: r.bodies.filter(b => kept.includes(b.key)) }); });
    return () => { live = false; };
  }, [section, bodies, evaluated, engine]);
  // At once (while the plane is dragged, until the exact section arrives): the meshes clipped and capped.
  const sectionClipped = useMemo(() => {
    if (!section) return null;
    const k = 'xyz'.indexOf(section.axis) as 0 | 1 | 2, cap = `n${evaluated.nodes.length}.cut`;
    return bodies.flatMap(b => { const mesh = clipMesh(b.mesh, k, section.at, section.keep, cap); return mesh ? [{ ...b, mesh }] : []; });
  }, [section, bodies, evaluated.nodes.length]);
  const sectionBodies = section ? (sectionExact?.key === JSON.stringify(section) ? sectionExact.bodies : sectionClipped) : null;
  const render = useMemo(() => doc.render ?? defaultRender(), [doc.render]);

  // Evaluate the accepted document whenever it or the rollback marker changes.
  useEffect(() => {
    let live = true; setBusy(true);
    engine.evaluate(evaluated, revision.current++).then(result => {
      if (!live || !result) return;
      setBusy(false); setLastMs(result.ms);
      if (result.ok) {
        // What is selected stays selected where it still is: faces, edges and bodies by their persistent names.
        const prev = bodiesRef.current;
        setBodies(result.bodies);
        if (chatSelection.current) setSelection(resolveNames(result.bodies, chatSelection.current).selection); else setSelection(sel => carrySelection(sel, prev, result.bodies));
        if (again.current) { setRestart(again.current); again.current = null; }
        chatSelection.current = null;
      }
      else setToast(result.error);
    });
    return () => { live = false; };
  }, [engine, evaluated]);

  const bodiesRef = useRef(bodies); bodiesRef.current = bodies;
  const ctx: Ctx = { doc: evaluated, bodies, selection, pick: pick ?? undefined };
  const evaluatedRef = useRef(evaluated); evaluatedRef.current = evaluated;

  const commit = useCallback((next: StudioDoc) => {
    // Counted as the History bar shows them: sketches are part of the feature made from them.
    const dropped = marker !== null ? doc.nodes.slice(marker).filter(n => n.kind !== 'sketch').length : 0;
    setUndo(u => [...u.slice(-49), { doc, marker }]); setRedo([]);
    // Commands build on the evaluated document, which follows the model only: what they leave as it was
    // there (render, drawing, direct geometry, instances) is the document's newest.
    const was = evaluatedRef.current;
    next = { ...next, ...Object.fromEntries((['render', 'drawing', 'direct', 'instances'] as const).filter(k => next[k] === was[k] && doc[k] !== was[k]).map(k => [k, doc[k]])) };
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
  /**
   * While a handle is dragged on a feature that later ones build on (a box under fillets), the preview
   * is the part up to that feature — quick, so the body keeps up with the pointer — and the whole part
   * follows when the drag pauses or ends (`fullTimer`).
   */
  const fullTimer = useRef(0);
  useEffect(() => {
    if (!active?.cmd.build) return;
    let live = true;
    const missing = shownFields(active.cmd.fields?.(active.ctx, active.values) ?? [], active.values).find(f => f.kind !== 'choice' && (active.values[f.key] === '' || !Number.isFinite(Number(active.values[f.key]))));
    if (missing) { setPreviewBodies(null); setActive(a => a && { ...a, preview: 'error', error: { title: 'Enter a value', hint: `${missing.label} is empty.`, detail: '' } }); return; }
    const values = active.values, cmd = active.cmd, ctx = active.ctx;
    const job = async (full = false) => {
      let candidate: StudioDoc;
      try { candidate = cmd.build!(ctx, values); } catch (e) { setActive(a => a && { ...a, preview: 'error', error: { title: 'Invalid input', hint: String(e), detail: '' } }); return; }
      let shown = candidate, rolled = false;
      if (!full && handleDrag.current?.dragging && candidate.nodes.length === ctx.doc.nodes.length) {
        let k = -1; candidate.nodes.forEach((n, i) => { if (JSON.stringify(n) !== JSON.stringify(ctx.doc.nodes[i])) k = i; });
        if (k >= 0 && k < candidate.nodes.length - 1) { shown = prefixDoc(candidate, k + 1); rolled = true; }
      }
      window.clearTimeout(fullTimer.current);
      const result = await engine.preview(shown, revision.current++);
      if (rolled && live) fullTimer.current = window.setTimeout(() => { if (!live) return; run.next = () => job(true); if (!run.busy) void pump(); }, 220);
      // (A newer job is queued: its result supersedes this one, unless this command is gone.)
      if (!live && !previewRun.current.next) return;
      const hd = handleDrag.current, hv = hd ? Number(values[hd.key]) : NaN;
      if (hd && Number.isFinite(hv)) {
        // (Only the whole part decides the wall: the part up to the feature may take what its later features refuse.)
        if (result.ok) { if (!rolled && (hd.wall === 0 || Math.sign(hv - hd.lastOk) !== hd.wall)) hd.lastOk = hv; }
        else if (hv !== hd.lastOk) {
          hd.wall = Math.sign(hv - hd.lastOk);
          setActive(a => a && a.cmd === cmd ? { ...a, values: patchValues(a.cmd, a.ctx, a.values, { [hd.key]: hd.lastOk }), preview: 'busy' } : a);
          return;
        }
      }
      if (result.ok) { previewFor.current = rolled ? '' : JSON.stringify(values); setPreviewBodies(result.bodies); setActive(a => a && a.cmd === cmd ? { ...a, preview: !rolled && JSON.stringify(a.values) === JSON.stringify(values) ? 'ok' : 'busy', error: undefined } : a); }
      else if (live) { setPreviewBodies(null); setActive(a => a && { ...a, preview: 'error', error: result.error }); }
    };
    const run = previewRun.current;
    const pump = async () => { while (run.next) { const j = run.next; run.next = null; run.busy = true; try { await j(); } finally { run.busy = false; } } };
    const typed = Date.now() - lastTyped.current < 50;
    const t = setTimeout(() => { run.next = job; if (!run.busy) void pump(); }, typed ? 140 : 0);
    return () => { live = false; clearTimeout(t); };
  }, [active?.values, active?.cmd, engine]);

  /** The command to start again once what Shift-Enter applied is the part (its bodies evaluated). */
  const again = useRef<Command | null>(null);
  const [restart, setRestart] = useState<Command | null>(null);
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
      const fp = face ? faceProfile(bodies[f.body].mesh, f.face) : null, outline = fp ? (({ shape, done }) => [...(shape ? [shape] : []), ...done])(sketchShapes(fp)) : undefined;
      const anchor: SketchAnchor = face ? { kind: 'face', offset: 0, face: { plane, base, ...(outline?.length ? { outline } : {}) } } : { kind: 'xy', offset: 0 };
      setSketch({ plane, anchor, tool: make && make !== 'loft' ? 'circle' : 'rectangle', shape: null, base, ...(make ? { make } : {}) }); setActive(null); setPreviewBodies(null);
      const [min, max] = sketchRegion(base && f ? [bodies[f.body]] : bodies, plane);
      viewport.current?.frameSketch(min, max, plane, SKETCH_INSETS); return;
    }
    if (cmd.action === 'interference') { void checkInterference(); return; }
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
      const [i] = pickedSketches(evaluated.nodes, selection.sketches), face = cmd.id === 'extrude' ? extrudeProfile(ctx) : null;
      const n = face ? planeOf(face.node).normal : i !== undefined ? planeOf(evaluated.nodes[i] as SketchNode).normal : null, cam = viewport.current?.camera;
      if (n && cam) { const f = cam.basis().forward; if (Math.abs(f[0] * n[0] + f[1] * n[1] + f[2] * n[2]) > 0.95) viewport.current?.setView('iso'); }
    }
    setActive({ cmd, values: cmd.defaults?.(ctx) ?? {}, preview: 'busy', ctx: { ...ctx }, ...(cmd.place ? { placing: true } : {}) });
  }, [ctx, selection, bodies, engine, commit, evaluated.nodes]);

  // Shift-Enter: once the part has its new bodies (and the selection followed them), the command again.
  useEffect(() => { if (restart && !active) { setRestart(null); start(commands.find(c => c.id === restart.id) ?? restart); } }, [restart, active, start]);
  // Placing a new shape: it follows the pointer over the ground and upward faces; a click or a drop sets
  // it there. Dragging a shape's button from the rail onto the viewport starts it as the drag comes in.
  const dragCmd = useRef<string | null>(null);
  const onSpot = useCallback((spot: Spot | null, done: boolean) => {
    const dragged = dragCmd.current ? commands.find(c => c.id === dragCmd.current) : undefined;
    if (done) dragCmd.current = null;
    setActive(a => {
      let cur = a;
      if (!cur?.placing) {
        if (cur || !dragged?.place || !dragged.available(ctx).ok) return a;
        cur = { cmd: dragged, values: dragged.defaults?.(ctx) ?? {}, preview: 'busy', ctx: { ...ctx }, placing: true };
      }
      if (!spot || !cur.cmd.place) return done ? { ...cur, placing: false } : cur;
      const placed = cur.cmd.place(cur.values, spot.point, spot.normal, spot.hole), same = Object.keys(placed).every(k => placed[k] === cur.values[k]);
      if (same) return done ? { ...cur, placing: false } : cur;
      return { ...cur, values: patchValues(cur.cmd, cur.ctx, cur.values, placed), preview: 'busy', ...(done ? { placing: false } : {}) };
    });
  }, [ctx]);

  /** Moves the sketch to another plane (its shapes keep their plane coordinates) and faces it. */
  const placeSketch = useCallback((kind: SketchAnchor['kind'], offset: number, angle = 0) => {
    if (!sketch) return;
    const face = sketch.anchor?.face, base = kind === 'face' ? face?.base ?? null : null;
    const plane = offsetPlane(tiltPlane(kind === 'face' && face ? face.plane : standardPlane(kind === 'face' ? 'xy' : kind), angle), offset);
    setSketch({ ...sketch, plane, base, anchor: { ...(sketch.anchor ?? { offset: 0 }), kind, offset, angle } });
    const [min, max] = sketchRegion(bodies, plane);
    viewport.current?.frameSketch(min, max, plane, SKETCH_INSETS);
  }, [sketch, bodies]);

  /** Offsets the newest closed shape of the sketch by `d` (out when positive) as a shape beside it. */
  const offsetSketch = (d: number) => {
    if (!sketch) return;
    const target = sketch.shape && shapeNode(sketch.shape) ? sketch.shape : [...(sketch.done ?? [])].reverse().find(x => !x.construction && shapeNode(x));
    if (!target) { setToast({ title: 'Nothing to offset', hint: 'Draw a closed shape first.', detail: '' }); return; }
    const r = offsetShape(target, d);
    if ('error' in r) { setToast({ title: 'Cannot offset', hint: r.error, detail: '' }); return; }
    setSketch(s => s && { ...s, shape: null, done: [...(s.done ?? []), ...(s.shape ? [s.shape] : []), r.shape] });
  };
  /** Trims, extends or splits the piece of the sketch at `at` (plane mm); open pieces meeting end to end join. */
  const trimSketch = (op: 'trim' | 'extend' | 'split', at: [number, number], tol: number) => {
    if (!sketch) return;
    const shapes = sketch.editNode !== undefined && sketch.shape ? [sketch.shape, ...(sketch.done ?? [])] : [...(sketch.done ?? []), ...(sketch.shape ? [sketch.shape] : [])];
    const r = (op === 'trim' ? trimAt : op === 'extend' ? extendAt : splitAt)(shapes.map(x => x.kind === 'polygon' ? { ...x, pending: false } : x), at, tol);
    if ('error' in r) { setToast({ title: op === 'trim' ? 'Nothing to trim there' : op === 'extend' ? 'Nothing to extend there' : 'Nothing to split there', hint: r.error, detail: '' }); return; }
    setSketch(s => s && { ...s, shape: null, done: r.shapes, picked: [] });
  };
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
    // (Open lines and arcs meeting end to end are one outline.)
    const shapes = joinOpen((sketch.editNode !== undefined && sketch.shape ? [sketch.shape, ...(sketch.done ?? [])] : [...(sketch.done ?? []), ...(sketch.shape ? [sketch.shape] : [])]).map(x => x.kind === 'polygon' && !x.closed ? { ...x, pending: false } : x));
    const profile = profileOf(shapes);
    if ('error' in profile) { setToast({ title: 'Finish the profile first', hint: profile.error, detail: '' }); return; }
    // Construction shapes are kept with the sketch (they come back when it is reopened).
    const refs = shapes.filter(x => x.construction), node = refs.length ? { ...profile.node, construction: refs } as SketchNode : profile.node;
    // The sketch keeps its plane; everything below is in the plane's own coordinates (Z along its normal).
    const placedNode: ModelNode = isDefaultPlane(sketch.plane) ? node : { ...node, plane: { origin: [...sketch.plane.origin], normal: [...sketch.plane.normal], xAxis: [...sketch.plane.xAxis] } } as SketchNode;
    if (sketch.editNode !== undefined) {
      const at = sketch.editNode, next = { ...doc, nodes: dropStaleMade(doc.nodes, doc.nodes.map((n, k) => k === at ? placedNode : n)) };
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
    // (The section view shows cut copies of the bodies: picks wait until it is closed.)
    if (sectionRef.current && !activeRef.current) return;
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
      // Bodies only: the body under the click (Shift adds or takes it back).
      if (pickFilterRef.current === 'body') { const b = hit.face?.body ?? hit.edge!.body, list = selectedBodies(prev); return { faces: [], edges: [], bodies: additive ? (list.includes(b) ? list.filter(x => x !== b) : [...list, b]) : [b] }; }
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
  // The steps inside a part made in several (a bolt's head, shank and their union): one history entry, the last.
  const innerSteps = useMemo(() => new Set(doc.nodes.flatMap((n, i) => 'made' in n && n.made?.nodes ? Array.from({ length: n.made.nodes - 1 }, (_, k) => i - n.made!.nodes! + 1 + k) : [])), [doc.nodes]);
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
  /** Copied body (⌘C) and how many copies were pasted (⌘V). */
  const clipboard = useRef<{ key: string; pastes: number } | null>(null);
  /**
   * Arrow keys move the picked body: a move of its own, added once and then grown while the body's newest
   * feature is that move (one history step for a run of nudges).
   */
  const nudge = (index: number, key: string, step: number) => {
    const b = bodies[index], ref = refOf(b), top = evaluated.nodes[ref.node];
    const d: [number, number, number] = [key === 'ArrowRight' ? step : key === 'ArrowLeft' ? -step : 0, key === 'ArrowUp' ? step : key === 'ArrowDown' ? -step : 0, key === 'PageUp' ? step : key === 'PageDown' ? -step : 0];
    const grow = top?.kind === 'translate' && ref.node === evaluated.nodes.length - 1 && marker === null;
    const next: StudioDoc = grow
      ? { ...doc, nodes: doc.nodes.map((n, i) => i === ref.node && n.kind === 'translate' ? { ...n, offset: n.offset.map((v, k) => Math.round((Number(v) + d[k]) * 1000) / 1000) as [number, number, number] } : n) }
      : withNode(evaluated, { kind: 'translate', parent: ref, offset: d });
    chatSelection.current = { faces: [], edges: [], bodies: [grow ? b.key : `b${next.nodes.length - 1}`] };
    commit(next);
  };
  /**
   * Interference: for each pair of the picked bodies (all, when fewer than two are picked) whose boxes
   * overlap, the kernel's intersection of the two; a positive volume is a clash.
   */
  const checkInterference = async () => {
    const picked = selectedBodies(selection), list = (picked.length > 1 ? picked : bodies.map((_, i) => i)).map(i => bodies[i]).filter(Boolean);
    setClashes('busy'); setEditNode(null);
    const found: { a: string; b: string; volume: number }[] = [];
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const A = list[i].mesh.bounds, B = list[j].mesh.bounds;
      if ([0, 1, 2].some(k => A.max[k] <= B.min[k] + 1e-6 || B.max[k] <= A.min[k] + 1e-6)) continue;
      const probe = withNode(evaluated, { kind: 'intersect', left: refOf(list[i]), right: refOf(list[j]) });
      const r = await engine.part(probe, revision.current++);
      const v = r.ok ? r.bodies.find(b => b.key === `b${probe.nodes.length - 1}`)?.volumeMM3 ?? 0 : 0;
      if (v > 1e-6) found.push({ a: list[i].key, b: list[j].key, volume: v });
    }
    setClashes(found);
  };
  /**
   * Delete (the key): picked sketches; a picked face or edge of a feature added to a body (a hole, a
   * fillet …) takes that feature; picked bodies, or a face of what a body was first made as, take the body
   * with all it was built from.
   */
  const deleteSelection = () => {
    if (marker !== null) { setToast({ title: 'Roll forward to delete', hint: 'Features are deleted from the whole history: roll forward to the end first.', detail: '' }); return; }
    const nodes = doc.nodes, body = (k: number) => bodies[k] ? bodyNodes(nodes, refOf(bodies[k]).node) : [];
    let indices: number[] = [], what = '';
    if (selection.sketches?.length) { indices = selection.sketches; what = indices.length === 1 ? `Sketch ${indices[0] + 1}` : `${indices.length} sketches`; }
    else if (selection.bodies.length) { indices = [...new Set(selection.bodies.flatMap(body))]; what = selection.bodies.length === 1 ? 'the body' : `${selection.bodies.length} bodies`; }
    else if (selection.faces.length || selection.edges.length) {
      const owner = featureOfPick(selection, bodies, nodes), k = (selection.faces[0] ?? selection.edges[0]).body;
      const base = owner !== null && parentsOf(nodes[owner]).every(p => nodes[p]?.kind === 'sketch');
      if (owner === null || base) { indices = body(k); what = 'the body'; } else { indices = [owner]; what = featureLabel(nodes[owner], owner, nodes); }
    }
    if (!indices.length) return;
    const r = deleteFeatures(doc, indices);
    if ('error' in r) { setToast({ title: `Cannot delete ${what}`, hint: r.error, detail: '' }); return; }
    engine.evaluate(prefixDoc(r.doc, r.doc.nodes.length), revision.current++).then(e => {
      if (!e) return;
      if (!e.ok) { setToast({ ...e.error, title: `Cannot delete ${what}: ${e.error.title}` }); return; }
      setSelection(emptySel); commit(r.doc);
      if (r.droppedDimensions) setToast({ title: `Removed ${r.droppedDimensions} drawing dimension${r.droppedDimensions > 1 ? 's' : ''}`, hint: `They measured ${what}. Undo restores them.`, detail: '' });
    });
  };
  // A new or opened part replaces the document: an open sketch or tool would carry the old part's shapes
  // and face references into it, so they close first (U4).
  // (What was picked in the old part goes too: instances, direct-edit faces, measurements.)
  const replaceDoc = (next: StudioDoc) => { cancel(); setSelection(emptySel); setInstanceSel([]); setDirectSel([]); setMeasure(null); setEditNode(null); commit(next); };
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
        let next = withNode(emptyDoc(), { kind: 'import', name, step, ...(read.bodies.length > 1 ? { solids: read.bodies.length } : {}) });
        // In other units than millimetres: each solid scaled about the origin to its true size.
        const unit = stepLengthUnit(step), n = read.bodies.length;
        if (unit.toMM !== 1) for (let k = 0; k < n; k++) next = withNode(next, { kind: 'scale', parent: { node: 0, side: n > 1 ? `part${k}` as Side : 'solid' }, factor: unit.toMM, pivot: [0, 0, 0] });
        replaceDoc(next); setFileName(name); setDirty(true); setTimeout(() => viewport.current?.fit(), 300);
        const vol = read.bodies.reduce((t, b) => t + (b.volumeMM3 ?? 0), 0) * unit.toMM ** 3;
        setToast({ title: 'STEP opened', hint: `${n} solid${n === 1 ? '' : 's'}, ${unit.declared ? `in ${unit.name}` : 'no length unit declared (read as millimetres)'}${unit.toMM !== 1 ? `, scaled ×${unit.toMM} to millimetres` : ''}; ${Math.round(vol).toLocaleString('en-US')} mm³ in all. Only the solids come in (no colours, names or assembly structure).`, detail: '' });
        return;
      }
      // An IGES file adds its curves and surfaces as direct geometry too, saying what came in.
      if (/\.(igs|iges)$/i.test(file.name)) {
        const r = importIGESFile(doc.direct ?? emptyDirect(), await file.text(), file.name.replace(/\.(igs|iges)$/i, ''));
        commitDirect(r.direct, r.direct.objects.slice((doc.direct?.objects.length ?? 0)).map(o => o.id));
        setToast({ title: 'IGES opened', hint: `${r.curves} curve${r.curves === 1 ? '' : 's'} and ${r.surfaces} surface${r.surfaces === 1 ? '' : 's'} added as curves and surfaces (Direct), in mm.`, detail: '' });
        setTimeout(() => viewport.current?.fit(), 300);
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
    const fallback: string[] = [];
    for (const body of bodies) {
      const kernel = await engine.stl(evaluated, body.key);
      if (!kernel) fallback.push(bodyName(doc, body));
      downloadBytes(kernel ?? meshToStl(body.mesh, body.key), `${fileName}-${body.key}.stl`, 'model/stl');
    }
    // (STL is facets only: no units, colours or exact curves; say when the display mesh had to stand in.)
    setToast({ title: `STL written: ${bodies.length} file${bodies.length === 1 ? '' : 's'}`, hint: `Triangles in millimetres, one file per body; no colours, names or exact curves.${fallback.length ? ` ${fallback.join(', ')} ${fallback.length === 1 ? 'was' : 'were'} written from the on-screen mesh (the kernel’s tessellation refused ${fallback.length === 1 ? 'it' : 'them'}).` : ''}`, detail: '' });
  };

  // Keyboard: Space palette, Enter apply, Esc cancel, letters run commands, F frames. The listener is
  // added once and calls the newest handler (set each render), so a key pressed right after a click sees
  // that click's selection, not the one before it (effects run only after the frame is painted).
  const onKeyRef = useRef<(e: KeyboardEvent) => void>(() => {});
  useEffect(() => {
    const listen = (e: KeyboardEvent) => onKeyRef.current(e);
    window.addEventListener('keydown', listen);
    return () => window.removeEventListener('keydown', listen);
  }, []);
  {
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
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd' && !active && !sketch) { e.preventDefault(); start(commands.find(c => c.id === 'duplicate')!); return; }
      // Copy a body, paste copies of it beside (each paste a little further on).
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'c' && !active && !sketch && !typing) { const one = selectedBodies(selection); if (one.length === 1 && bodies[one[0]]) { clipboard.current = { key: bodies[one[0]].key, pastes: 0 }; setToast({ title: 'Copied', hint: `${bodyName(doc, bodies[one[0]])} — ⌘V pastes a copy beside it.`, detail: '' }); } return; }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'v' && !active && !sketch && !typing && clipboard.current) {
        const src = bodies.find(b => b.key === clipboard.current!.key); if (!src) return;
        e.preventDefault(); const k = ++clipboard.current.pastes, w = src.mesh.bounds.max[0] - src.mesh.bounds.min[0] + 10;
        const r = duplicateBody(evaluated, refOf(src), [Math.round(w * k), 0, 0]);
        chatSelection.current = { faces: [], edges: [], bodies: [`b${r.top}`] }; commit(r.doc); return;
      }
      if (drawing) return; // (the Drawing workspace has its own keys)
      if (e.key === 'Escape') { if (palette) setPalette(false); else if (sketch && !active && (sketch.picked?.length || sketch.editDim)) setSketch(s => s && { ...s, picked: [], editDim: null }); else if (active || sketch) cancel(); else if (assembly.draft) assembly.cancel(); else if (measure) setMeasure(null); else setSelection(emptySel); return; }
      // Enter applies; Shift-Enter applies and starts the same command again (another hole, another shape).
      if (e.key === 'Enter' && !palette) { if (sketch) { e.preventDefault(); finishSketch(); } else if (active) { e.preventDefault(); if (e.shiftKey && active.cmd.id !== 'edit') again.current = active.cmd; apply(); } return; }
      // A sketch tool key still works from a number box (letters are no numbers): it leaves the box.
      const numberBox = e.target instanceof HTMLInputElement && e.target.type === 'number' && !e.target.classList.contains('dim-edit');
      if (palette || (typing && !(sketch && numberBox && !e.metaKey && !e.ctrlKey && !e.altKey && /^[a-z]$/i.test(e.key)))) return;
      if (e.key === ' ') { e.preventDefault(); setPalette(true); return; }
      // Nudge the picked body: arrows 1 mm along X and Y (Shift: 10 mm), Page Up / Down along Z.
      if (/^(Arrow(Left|Right|Up|Down)|PageUp|PageDown)$/.test(e.key) && !active && !sketch && !measure) { const one = selectedBodies(selection); if (one.length === 1 && bodies[one[0]]) { e.preventDefault(); nudge(one[0], e.key, e.shiftKey ? 10 : 1); return; } }
      if (e.key === '?') { e.preventDefault(); setHelp(true); return; }
      if ((e.key === 'Delete' || e.key === 'Backspace') && !sketch && !active && !measure) { e.preventDefault(); deleteSelection(); return; }
      if (sketch) {
        if (e.key.toLowerCase() === 'x' && !e.metaKey && !e.ctrlKey) { if (typing) { e.preventDefault(); (e.target as HTMLElement).blur(); } setSketch(s => s && { ...s, construct: !s.construct }); return; }
        const t = TOOLS.find(x => x.key.toLowerCase() === e.key.toLowerCase() || (x.tool === 'polygon' && e.key.toLowerCase() === 'p'))?.tool;
        if (t) { if (typing) { e.preventDefault(); (e.target as HTMLElement).blur(); } setSketch(s => s && switchTool(s, t)); }
        return;
      }
      // F frames what is picked (its bodies), or everything when nothing is.
      if (e.key.toLowerCase() === 'f' && !e.shiftKey) {
        const picked = selectedBodies(selection).map(i => bodies[i]).filter(Boolean);
        viewport.current?.fit(picked.length ? { min: [0, 1, 2].map(k => Math.min(...picked.map(b => b.mesh.bounds.min[k]))) as Vec3, max: [0, 1, 2].map(k => Math.max(...picked.map(b => b.mesh.bounds.max[k]))) as Vec3 } : undefined); return;
      }
      const cmd = commands.find(c => c.shortcut && c.shortcut.toLowerCase() === (e.shiftKey ? 'shift ' : '') + e.key.toLowerCase());
      if (cmd && !active) { e.preventDefault(); start(cmd); }
    };
    onKeyRef.current = onKey;
  }

  /** A command's button (the rail, the shapes bar): its tooltip says what it does or why it cannot run; shapes drag onto the model. */
  const toolButton = (c: Command) => {
    const a = c.available(ctx);
    return <button key={c.id} className={'tool' + (active?.cmd.id === c.id ? ' on' : '') + (a.ok ? '' : ' off')} aria-label={c.label}
      data-tip={c.label} data-tip-key={c.shortcut ?? ''} data-tip-desc={c.hint ?? ''} data-tip-off={a.ok ? '' : a.reason} onClick={() => start(c)}
      {...(c.place && a.ok ? { draggable: true, onDragStart: (e: React.DragEvent) => { e.dataTransfer.setData(DRAG_TYPE, c.id); e.dataTransfer.effectAllowed = 'copy'; dragCmd.current = c.id; },
        onDragEnd: (e: React.DragEvent) => { if (dragCmd.current && e.dataTransfer.dropEffect === 'none') { dragCmd.current = null; setActive(x => x?.placing && x.cmd.id === c.id ? null : x); setPreviewBodies(null); } } } : {})}><Icon name={c.icon} /></button>;
  };
  activeRef.current = active;
  const shownBodies = bodyDrag ? bodies : previewBodies ?? (section && sectionBodies && !sketch ? sectionBodies : bodies);
  // Bodies' own colours and hidden ones (StudioDoc.bodies), by index of what is shown.
  // (A command's preview: the bodies it adds — first made by one of its new features, not built on a body
  // the part has — tinted, so what is new reads at a glance.)
  const previewNodes = useMemo(() => { if (!active?.cmd.build || !previewBodies) return null; try { return active.cmd.build(active.ctx, active.values).nodes; } catch { return null; } }, [active, previewBodies]);
  const bodyColors = useMemo(() => {
    const fresh = (b: BodyResult) => { const m = /^b(\d+)/.exec(b.key); return !!previewNodes && !!m && rootOf(previewNodes, Number(m[1])) >= evaluated.nodes.length; };
    return new Map(shownBodies.flatMap((b, i) => { const c = lookOf(doc, b).color ?? (shownBodies === previewBodies && fresh(b) ? PREVIEW_TINT : undefined); return c ? [[i, rgbOf(c)] as [number, [number, number, number]]] : []; }));
  }, [shownBodies, doc, previewBodies, previewNodes, evaluated.nodes.length]);
  const hiddenBodies = useMemo(() => new Set(shownBodies.flatMap((b, i) => lookOf(doc, b).hidden ? [i] : [])), [shownBodies, doc]);
  // (While placing, the pointer looks through the shape being placed: the preview's new bodies.)
  const placeSkip = useMemo(() => { const have = new Set(bodies.map(b => b.key)); return new Set((previewBodies ?? []).filter(b => !have.has(b.key)).map(b => b.key)); }, [bodies, previewBodies]);
  // Mate faces show while a mate is being added, or while one is selected in the shown mates list.
  const mateFaces = !!assembly.draft || (!!assembly.selected && instanceSel.length === 1);
  const sectioned = !!(section && sectionBodies && !sketch && !previewBodies);
  const shownSelection = sectioned ? { faces: shownBodies.flatMap((b, bi) => b.mesh.faces.filter(f => f.name.split('+').some(n => { const m = /^n(\d+)\.cut/.exec(n); return !!m && Number(m[1]) >= evaluated.nodes.length; })).map(f => ({ body: bi, face: f.index }))), edges: [], bodies: [] }
    : previewBodies || sketch ? emptySel : mateFaces ? { faces: assembly.highlight.faces, edges: [], bodies: [] } : measure ? { faces: measure.flatMap(m => m.face !== undefined ? [{ body: m.body, face: m.face }] : []), edges: measure.flatMap(m => m.edge !== undefined ? [{ body: m.body, edge: m.edge }] : []), bodies: [] } : selection;
  const measured = measure?.length === 2 && bodies[measure[0].body] && bodies[measure[1].body] ? measureBetween(bodies[measure[0].body].mesh, measure[0], bodies[measure[1].body].mesh, measure[1]) : null;
  const density = MATERIALS.find(m => m.id === material) ?? MATERIALS[0];
  const ghost = useMemo(() => new Set(sketch ? shownBodies.map((_, i) => i) : []), [sketch, shownBodies]);
  // Move and Rotate gizmos on the selected body: while dragged it follows at once (a renderer transform
  // of the evaluated body); let go, the kernel preview of the values runs.
  const dragFrom = useRef<Values | null>(null);
  const cmdBody = active && (active.cmd.id === 'move' || active.cmd.id === 'rotate' || active.cmd.id === 'scale') && selectedBodies(active.ctx.selection).length === 1 ? selectedBodies(active.ctx.selection)[0] : undefined;
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
          const from = begin(), raw: Vec3 = [Number(from.x) + delta[0], Number(from.y) + delta[1], Number(from.z) + delta[2]];
          // Lined up with the other bodies' sides and middles when it comes close (2 % of its size, at least 1 mm).
          const size = Math.max(...[0, 1, 2].map(k => max[k] - min[k])), others = bodies.filter((_, i) => i !== cmdBody).map(b => b.mesh.bounds);
          const next = alignMove({ min, max }, others, raw, delta.map(v => v !== 0), Math.max(1, size * 0.02)).move;
          show({ x: next[0], y: next[1], z: next[2] }, previewMatrix({ kind: 'move', delta: next }), done);
        } };
    }
    if (active.cmd.id === 'scale') {
      // Scale: the cubes grow or shrink the body about the pivot (its centre by default).
      const pivot: Vec3 = [Number(values.px), Number(values.py), Number(values.pz)];
      return { origin: pivot, scale: true,
        onScale: (factor, done) => {
          const from = begin(), k = Math.round(Number(from.factor) * factor * 100) / 100, m = new Float64Array(16);
          m[0] = m[5] = m[10] = k; m[15] = 1; m[12] = pivot[0] * (1 - k); m[13] = pivot[1] * (1 - k); m[14] = pivot[2] * (1 - k);
          show({ factor: k }, m, done);
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
    // The feature open in the editor, else the one the picked face or edge comes from, else the body's last.
    const one = selectedBodies(selection), index = editNode ?? featureOfPick(selection, bodies, evaluated.nodes) ?? (one.length === 1 && bodies[one[0]] ? refOf(bodies[one[0]]).node : null);
    return index === null || (marker !== null && index >= marker) ? null : editCommand(index, evaluated.nodes);
  }, [active, sketch, rendering, drawing, measure, assembly.draft, instanceSel.length, selection, editNode, bodies, evaluated.nodes, marker]);
  const handleCmd = active?.cmd ?? idleEdit, handleValues = active ? active.values : idleEdit?.defaults?.(ctx) ?? {}, handleCtx = active?.ctx ?? ctx;
  // (None while a new shape is still being placed: the click that places it must not grab one.)
  const handles: FeatureHandle[] = handleCmd?.handles && !sketch && !active?.placing ? handleCmd.handles(handleCtx, handleValues).flatMap(h => {
    const fields = handleCmd.fields?.(handleCtx, handleValues) ?? [], field = fields.find(f => f.key === h.key), value = Number(handleValues[h.key]);
    if (!field || !Number.isFinite(value)) return [];
    // (Lengths follow the grid step: half of it for half-step arrows; angles and counts keep their own.)
    const step = h.arc || h.unit !== undefined ? h.step ?? 1 : Math.max(0.001, (h.step ?? 1) * (snapStep || 0.01)), snap = (start: number, mm: number) => Math.min(h.max ?? Infinity, Math.max(h.min ?? -Infinity, Math.round((start + mm * (h.scale ?? 1)) / step) * step));
    const pair = h.pair, value2 = pair ? Number(handleValues[pair.key]) : NaN;
    if (pair && !Number.isFinite(value2)) return [];
    return [{ id: pair ? `${h.key}+${pair.key}` : h.key, at: h.at, dir: h.dir, label: pair ? field.label.replace(/ \w$/, '') : field.label, value, ...(h.arc ? { arc: h.arc } : {}),
      ...(pair ? { plane: { dir2: pair.dir, value2, toValue2: snap } } : {}),
      toValue: snap,
      format: (v: number) => h.arc ? `${fmt(v)}°` : h.unit !== undefined ? `${fmt(v)}${h.unit ? ' ' + h.unit : ''}` : `${fmt(v)} mm`,
      onDrag: (v: number, done: boolean, v2?: number) => {
        if (pair) {
          // (Both coordinates at once; a refused spot shows as the preview's error, no wall.)
          handleDrag.current = null;
          const patch = { [h.key]: v, [pair.key]: v2 ?? value2 };
          setActive(a => a ? (a.values[h.key] === patch[h.key] && a.values[pair.key] === patch[pair.key] ? a : { ...a, values: patchValues(a.cmd, a.ctx, a.values, patch), preview: 'busy' }) : { cmd: handleCmd, values: patchValues(handleCmd, handleCtx, handleValues, patch), preview: 'busy', ctx: { ...handleCtx } });
          return;
        }
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
  // The section plane: an arrow across it through the middle of the part.
  const sectionHandle: FeatureHandle | null = section && !active && !sketch && bodies.length ? (() => {
    const k = 'xyz'.indexOf(section.axis), min = [0, 1, 2].map(i => Math.min(...bodies.map(b => b.mesh.bounds.min[i]))), max = [0, 1, 2].map(i => Math.max(...bodies.map(b => b.mesh.bounds.max[i])));
    const at = [0, 1, 2].map(i => (min[i] + max[i]) / 2) as Vec3, dir: Vec3 = [0, 0, 0]; dir[k] = section.keep === 'negative' ? 1 : -1; at[k] = section.at;
    return { id: 'section', at, dir, label: `Section ${section.axis.toUpperCase()}`, value: section.at,
      toValue: (start: number, mm: number) => Math.min(max[k] - 0.5, Math.max(min[k] + 0.5, Math.round((start + mm * dir[k]) * 2) / 2)),
      format: (v: number) => `${fmt(v)} mm`, onDrag: (v: number) => setSection(s => s && s.at !== v ? { ...s, at: v } : s) };
  })() : null;
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
      onMove: (raw, done) => {
        // Lined up with the part's bodies and the other placed parts when it comes close (as bodies are).
        const others = [...bodies.map(b => b.mesh.bounds), ...[...instanceBodies.entries()].filter(([id]) => id !== selectedInst.id).flatMap(([, v]) => v.bodies.map(b => b.mesh.bounds))];
        const delta = alignMove({ min: lo, max: hi }, others, raw, raw.map(v => v !== 0), Math.max(1, Math.max(...[0, 1, 2].map(k => hi[k] - lo[k])) * 0.02)).move;
        place(i => movedInstance(i, delta), { kind: 'move', delta }, done, delta.every(v => v === 0));
      },
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
      <Viewport ref={viewport} bodies={shownBodies} selection={shownSelection} ghost={ghost} sketch={sketch} gizmo={gizmo ?? instGizmo} handles={sectionHandle ? [sectionHandle] : handles} instancePreview={instancePreview} profiles={active ? [] : profiles} onPickProfile={pickProfile} render={rendering ? render : null}
        direct={directShown} directSelection={directSel} offsets={animatedOffsets} transforms={dragTransforms} instances={instancesShown} instanceSelection={assembly.draft ? assembly.highlight.instances : instanceSel} instanceFaces={mateFaces ? assembly.highlight.instanceFaces : undefined}
        placing={!!active?.placing} placeSkip={placeSkip} onSpot={onSpot}
        onPickBody={b => { if (active || section) return; setDirectSel([]); setInstanceSel([]); setSelection({ faces: [], edges: [], bodies: [b] }); }}
        onPickChain={(b, e) => { if (active || section || !bodies[b]) return; setDirectSel([]); setInstanceSel([]); setSelection({ faces: [], edges: edgeChain(bodies[b].mesh, e).map(edge => ({ body: b, edge })), bodies: [] }); }} bodyColors={bodyColors} hiddenBodies={hiddenBodies} snapStep={snapStep} pickFilter={active ? 'all' : pickFilter} hoverBody={previewBodies ? null : rowHover}
        onPick={onPick} onCursor={setCursor} onSketchShape={updateShape}
        onBoxSelect={(picked, additive) => { if (active) return; setSelection(prev => {
          const base = additive ? selectedBodies(prev) : [];
          return { faces: [], edges: [], bodies: [...new Set([...base, ...picked])] };
        }); }}
        boundsBox={showBox ? (() => { const box = boxOf(selBodies.length ? selBodies : bodies); return box ? { ...box, label: [0, 1, 2].map(k => fmt(Math.round((box.max[k] - box.min[k]) * 100) / 100)).join(' × ') } : null; })() : null}
        measureLine={measured && measured.distance > 1e-9 ? { a: measured.a, b: measured.b, label: fmt(Math.round(measured.distance * 100) / 100) + ' mm' } : null}
        onDimClick={key => { const el = document.getElementById('sk-' + key) as HTMLInputElement | null; el?.focus(); el?.select(); }}
        onSketchPick={(hit, additive) => setSketch(s => s && sketchClick(s, hit, additive))}
        onSketchTrim={trimSketch}
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
        {/* Shapes: click one and place it with the pointer, or drag it onto the model. */}
        {!sketch && !rendering && !drawing && <div className="shapes" role="toolbar" aria-label="Shapes">{commands.filter(c => c.place).map(toolButton)}</div>}
        <div className="grow" />
        <div className="mode" role="group" aria-label="Mode">
          <button className={!sketch && !rendering && !drawing ? 'on' : ''} onClick={() => { setSketch(null); setRendering(false); setPlaying(false); setDrawing(false); }}>Model</button>
          <button className={sketch ? 'on sketching' : ''} onClick={() => start(commands.find(c => c.id === 'sketch')!)}>{sketch ? `Sketch · ${planeLabel(sketch.plane)}` : 'Sketch'}</button>
          <button className={rendering ? 'on' : ''} onClick={() => { setSketch(null); setActive(null); setMeasure(null); setDrawing(false); setRendering(true); }}>Render</button>
          <button className={drawing ? 'on' : ''} onClick={() => { setSketch(null); setActive(null); setMeasure(null); setRendering(false); setPlaying(false); setDrawing(true); }}>Drawing</button>
        </div>
        <div className="grow" />
        {sketch && <button className="finish" onClick={finishSketch}><Icon name="check" />Finish sketch <Kbd>⏎</Kbd></button>}
        <button className={'tool' + (chat ? ' on' : '')} aria-label="Chat" data-tip="Chat" data-tip-desc="Model by chat" onClick={() => setChat(v => !v)}><Icon name="chat" /></button>
        <button className="tool" aria-label="Undo" data-tip={undo.length ? `Undo ${describeChange(undo[undo.length - 1].doc, doc)}` : 'Nothing to undo'} data-tip-key="⌘Z" disabled={!undo.length} onClick={doUndo}><Icon name="undo" /></button>
        <button className="tool" aria-label="Redo" data-tip={redo.length ? `Redo ${describeChange(doc, redo[redo.length - 1].doc)}` : 'Nothing to redo'} data-tip-key="⇧⌘Z" disabled={!redo.length} onClick={doRedo}><Icon name="redo" /></button>
        <button className="tool" aria-label="New part" data-tip="New part" onClick={() => { replaceDoc(emptyDoc()); setFileName('Untitled'); }}><Icon name="add_box" /></button>
        <button className="tool" aria-label="Open" data-tip="Open" data-tip-desc="A .bcad model or a STEP file; an IGES file’s or a .barocad source’s curves and surfaces" onClick={() => fileInput.current?.click()}><Icon name="folder_open" /></button>
        <button className="tool" aria-label="Save" data-tip="Save" data-tip-key="⌘S" onClick={save}><Icon name="save" /></button>
        <button className="tool" aria-label="Export STL" data-tip="Export STL" data-tip-desc="A mesh for printing" onClick={exportStl}><Icon name="download" /></button>
        <button className="tool" aria-label="Export STEP" data-tip="Export STEP" data-tip-desc="The exact solids, for other CAD" onClick={exportStepFile}><Icon name="deployed_code_update" /></button>
        {!!doc.direct?.objects.some(o => !o.hidden) && <button className="tool" aria-label="Export IGES" data-tip="Export IGES" data-tip-desc="The visible curves and surfaces" onClick={() => {
          try { downloadBytes(new TextEncoder().encode(directIGES(doc.direct!, fileName)), `${fileName}.igs`, 'model/iges'); }
          catch (e) { setToast({ title: 'Could not write IGES', hint: e instanceof Error ? e.message : String(e), detail: '' }); }
        }}><Icon name="polyline" /></button>}
        <button className="tool" aria-label="Insert part" data-tip="Insert part" data-tip-desc="Another part (.bcad) as an instance" onClick={() => partInput.current?.click()}><Icon name="add_to_photos" /></button>
        <input ref={partInput} type="file" accept=".bcad,.json" hidden aria-label="Part file" onChange={e => { const f = e.target.files?.[0]; if (f) insertPart(f); e.target.value = ''; }} />
        <input ref={fileInput} aria-label="Model file" type="file" accept=".bcad,.json,.step,.stp,.igs,.iges,.barocad,.cad" hidden onChange={e => { const f = e.target.files?.[0]; if (f) open(f); e.target.value = ''; }} />
      </header>

      <TooltipLayer />
      <nav className="card toolbar" aria-label="Tools" hidden={rendering || drawing}>
        {sketch ? (<>
          {TOOLS.map(t => (
            <button key={t.tool} className={'tool' + (sketch.tool === t.tool ? ' on' : '')} data-tip={t.label} data-tip-key={t.key} aria-label={t.label}
              onClick={() => setSketch(s => s && switchTool(s, t.tool))}><Icon name={t.icon} /></button>))}
          <div className="sep" />
          <button className={'tool' + (sketch.construct ? ' on' : '')} data-tip="Construction" data-tip-key="X" data-tip-desc="Draw references: dashed shapes to snap to, not part of the profile" aria-label="Construction"
            onClick={() => setSketch(s => s && { ...s, construct: !s.construct })}><Icon name="cad-sk-construction" /></button>
          <button className="tool" data-tip="Clear profile" data-tip-desc="Remove every shape drawn in this sketch" aria-label="Clear profile" onClick={() => setSketch(s => s && { ...s, shape: null, done: [] })}><Icon name="ink_eraser" /></button>
        </>) : (['create', 'modify', 'pattern', 'combine', 'inspect'] as const).map((g, gi) => (
          <div key={g} className="tool-group">
            {gi > 0 && <div className="sep" />}
            {commands.filter(c => c.group === g && !c.place).map(toolButton)}
          </div>))}
      </nav>

      <aside className={'card outliner' + (browserOpen ? '' : ' closed')} aria-label="Outliner">
        <div className="card-title">BROWSER <span className="muted">{bodies.length} bod{bodies.length === 1 ? 'y' : 'ies'}</span>
          <button className="tool tiny" aria-label={browserOpen ? 'Collapse the browser' : 'Expand the browser'} onClick={() => setBrowserOpen(o => { try { localStorage.setItem('cad-studio.browser', o ? 'closed' : 'open'); } catch { /* private mode */ } return !o; })}><Icon name={browserOpen ? 'left_panel_close' : 'left_panel_open'} small /></button></div>
        {browserOpen && <>
        {bodies.length > 0 && <div className="ol-head">Bodies</div>}
        {bodies.map((b, i) => {
          const sel = selectedBodies(selection).includes(i), look = lookOf(doc, b);
          const pick = (e: React.MouseEvent) => { setDirectSel([]); setInstanceSel([]); setSelection(prev => {
            const list = selectedBodies(prev); return e.shiftKey ? { faces: [], edges: [], bodies: list.includes(i) ? list.filter(x => x !== i) : [...list, i] } : { faces: [], edges: [], bodies: [i] };
          }); };
          const steps = bodySteps(evaluated.nodes, refOf(b).node), open = expanded.includes(b.key);
          return <Fragment key={b.key}><div className={'ol-row' + (sel ? ' sel' : '') + (look.hidden ? ' hidden-obj' : '')} onMouseEnter={() => setRowHover(i)} onMouseLeave={() => setRowHover(h => h === i ? null : h)}>
            <button className="ol-caret" aria-label={open ? 'Hide its features' : 'Show its features'} disabled={steps.length < 2} onClick={() => setExpanded(x => open ? x.filter(k => k !== b.key) : [...x, b.key])}><Icon name={open ? 'expand_more' : 'chevron_right'} small /></button>
            <button className="ol-eye" aria-label={look.hidden ? 'Show body' : 'Hide body'} data-tip={look.hidden ? 'Show' : 'Hide'}
              onClick={() => { commit(withLook(doc, b, { hidden: !look.hidden })); if (!look.hidden) setSelection(emptySel); }}><Icon name={look.hidden ? 'visibility_off' : 'visibility'} small /></button>
            <span className="ol-swatch" style={look.color ? { background: look.color } : undefined} />
            {renaming === b.key
              ? <input className="ol-name-edit" autoFocus defaultValue={bodyName(doc, b)} aria-label="Body name"
                onKeyDown={e => { if (e.key === 'Enter') { commit(withLook(doc, b, { name: e.currentTarget.value.trim() })); setRenaming(null); } else if (e.key === 'Escape') setRenaming(null); e.stopPropagation(); }}
                onBlur={e => { if (e.currentTarget.value.trim() !== bodyName(doc, b)) commit(withLook(doc, b, { name: e.currentTarget.value.trim() })); setRenaming(null); }} />
              : <button className={'ol' + (sel ? ' sel' : '')} onClick={pick} onDoubleClick={() => setRenaming(b.key)} title="Double-click to rename">
                {bodyName(doc, b)}{(() => { const last = lastFeature(doc, b); return last ? <span className="muted"> · {last}</span> : null; })()}</button>}
          </div>
          {open && steps.map(k => <button key={k} className={'ol ol-step' + (editNode === k ? ' sel' : '')} onClick={() => { setEditNode(k); setSelection({ faces: [], edges: [], bodies: [i] }); }}>
            <Icon name={iconFor(evaluated.nodes[k])} small />{featureLabel(evaluated.nodes[k], k, evaluated.nodes)}</button>)}
          </Fragment>;
        })}
        {freeSketches.length > 0 && <div className="ol-head">Sketches</div>}
        {freeSketches.map(k => <div key={'s' + k} className={'ol-row' + (selection.sketches?.includes(k) ? ' sel' : '')}>
          <span className="ol-eye"><Icon name="cad-sketch" small /></span>
          <button className={'ol' + (selection.sketches?.includes(k) ? ' sel' : '')} onClick={e => pickProfile(k, e.shiftKey)}>Sketch {k + 1}</button></div>)}
        {!!doc.instances?.length && <div className="ol-head">Parts placed</div>}
        {(doc.instances ?? []).map(inst => <button key={inst.id} className={'ol instance' + (instanceSel.includes(inst.id) ? ' sel' : '') + (inst.hidden ? ' hidden-obj' : '')}
          onClick={() => { setSelection(emptySel); setDirectSel([]); setInstanceSel([inst.id]); }}><Icon name={inst.hidden ? 'visibility_off' : 'widgets'} small />{inst.name}</button>)}
        {!!doc.direct?.objects.length && <div className="ol-head">Curves and surfaces</div>}
        {(doc.direct?.objects ?? []).map(o => <button key={o.id} className={'ol direct' + (directSel.includes(o.id) ? ' sel' : '') + (o.hidden ? ' hidden-obj' : '')}
          title={o.hidden ? 'Hidden: click to show' : o.name}
          onClick={e => {
            if (o.hidden) { commitDirect({ ...doc.direct!, objects: doc.direct!.objects.map(x => x.id === o.id ? { ...x, hidden: false } : x) }, [o.id]); return; }
            setSelection(emptySel); setDirectSel(prev => e.shiftKey ? (prev.includes(o.id) ? prev.filter(x => x !== o.id) : [...prev, o.id]) : [o.id]);
          }}><Icon name={o.hidden ? 'visibility_off' : 'gesture'} small />{o.name}</button>)}
        {!!doc.direct?.objects.length && viewport.current?.backend === 'webgl2' && <div className="empty">Curves and surfaces show in browsers with WebGPU.</div>}
        {!bodies.length && !busy && <div className="empty">No bodies yet. Press <Kbd>S</Kbd> to sketch or <Kbd>B</Kbd> for a box.</div>}
        </>}
      </aside>
      <div className="right-col">

      {sketch && <SketchPanel sketch={sketch} error={sketchError} onShape={updateShape} onPlace={sketch.editNode === undefined ? placeSketch : undefined} onUi={patch => setSketch(s => s && { ...s, ...patch })} onOffset={offsetSketch} onUseOutline={sketch.anchor?.kind === 'face' && sketch.anchor.face?.outline?.length && !sketch.anchor.offset && !sketch.anchor.angle
        ? (asRefs: boolean) => setSketch(s => s && { ...s, shape: null, done: [...(s.done ?? []), ...(s.shape ? [s.shape] : []), ...(s.anchor?.face?.outline ?? []).map(x => asRefs ? { ...x, construction: true as const } : x)] }) : undefined} />}
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
      {clashes && !rendering && !sketch && <aside className="card props" aria-label="Interference">
        <div className="card-title">INTERFERENCE <button className="tool tiny" aria-label="Close interference" onClick={() => setClashes(null)}><Icon name="close" small /></button></div>
        {clashes === 'busy' ? <div className="empty">Checking…</div> : !clashes.length ? <div className="empty">No bodies overlap.</div>
          : clashes.map(c => { const ia = bodies.findIndex(b => b.key === c.a), ib = bodies.findIndex(b => b.key === c.b); return (
            <button key={c.a + c.b} className="ol clash" onClick={() => { if (ia >= 0 && ib >= 0) setSelection({ faces: [], edges: [], bodies: [ia, ib] }); }}>
              <Icon name="warning" small />{ia >= 0 ? bodyName(doc, bodies[ia]) : c.a} ∩ {ib >= 0 ? bodyName(doc, bodies[ib]) : c.b}<span className="muted"> · {fmt(Math.round(c.volume * 10) / 10)} mm³</span></button>); })}
      </aside>}
      {/* (A running command's HUD takes this place at the right.) */}
      {!rendering && !sketch && !measure && !active && !directSel.length && !instanceSel.length && !assembly.draft && <aside className="card props" aria-label="Selection">
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
          {selBodies.slice(0, 1).map(b => { const { min, max } = b.mesh.bounds, look = lookOf(doc, b); return <div key={b.key}>
            <label className="kv">Name <input className="kv-input" aria-label="Name" key={b.key + bodyName(doc, b)} defaultValue={bodyName(doc, b)}
              onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); e.stopPropagation(); }}
              onBlur={e => { const v = e.currentTarget.value.trim(); if (v !== bodyName(doc, b)) commit(withLook(doc, b, { name: v })); }} /></label>
            <div className="kv">Colour <span className="swatches" role="group" aria-label="Colour">
              <button className={'swatch none' + (look.color ? '' : ' on')} aria-label="No colour" data-tip="Default grey" onClick={() => commit(withLook(doc, b, { color: undefined }))} />
              {BODY_COLOURS.map(c => <button key={c} className={'swatch' + (look.color === c ? ' on' : '')} style={{ background: c }} aria-label={'Colour ' + c} onClick={() => commit(withLook(doc, b, { color: c }))} />)}
              <label className="swatch pick" data-tip="Any colour" style={look.color && !(BODY_COLOURS as readonly string[]).includes(look.color) ? { background: look.color } : undefined}>
                <input type="color" aria-label="Any colour" value={look.color ?? '#bcc0c7'} onChange={e => commit(withLook(doc, b, { color: e.target.value }))} /></label>
            </span></div>
            <label className="kv">Visible <input type="checkbox" checked={!look.hidden} onChange={e => { commit(withLook(doc, b, { hidden: !e.target.checked })); if (!e.target.checked) setSelection(emptySel); }} /></label>
            <label className="kv"><span>Bounds <b>{fmt(max[0] - min[0])} × {fmt(max[1] - min[1])} × {fmt(max[2] - min[2])}</b></span><span className="kv-check"><input type="checkbox" aria-label="Show the bounding box" checked={showBox} onChange={e => setShowBox(e.target.checked)} /> box</span></label>
            {b.volumeMM3 !== null && <div className="kv">Volume <b>{fmt(Math.round(b.volumeMM3))} mm³</b></div>}
            {(() => { const own = MATERIALS.find(m => m.id === look.material) ?? density; return <>
              {b.volumeMM3 !== null && <div className="kv">Mass <b>{fmt(Math.round(b.volumeMM3 * own.gPerCm3 / 100) / 10)} g</b></div>}
              {/* The body's own material (the default for new bodies stays the studio's). */}
              <label className="kv"><span>Material{!look.material && <span className="muted"> · default</span>}</span><select aria-label="Material" value={own.id} onChange={e => commit(withLook(doc, b, { material: e.target.value === material ? undefined : e.target.value }))}>{MATERIALS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}</select></label>
              {own.id !== material && <div className="kv"><span /><button className="ghost small" onClick={() => setMaterial(own.id)} data-tip="Default material" data-tip-desc="Bodies without a material of their own use it">Use as default</button></div>}
            </>; })()}
            {(() => { const top = evaluated.nodes[refOf(b).node], made = top && 'made' in top ? top.made : undefined, t = made?.command === 'fastener' ? fastenerThread(made.values) : null;
              return t ? <><div className="kv">Part <b>{fastenerName(made!.values)}</b></div><div className="kv">Thread <b>M{t.d}×{t.pitch} {t.hand} · {t.internal ? 'internal' : 'external'}</b></div><div className="kv muted">Cosmetic thread: no helical geometry; nominal ISO sizes — check the standard before manufacture.</div></> : null; })()}
            {b.centroid && <div className="kv">Centre of mass <b>{b.centroid.map(v => fmt(Math.round(v * 100) / 100)).join(', ')}</b></div>}
            {(() => { const own = MATERIALS.find(m => m.id === look.material) ?? density, mp = bodyMass(b, own.gPerCm3); if (!mp) return null;
              const I = inertiaAt === 'origin' ? inertiaAbout(mp.inertia, mp.massG, mp.centroid, [0, 0, 0]) : mp.inertia;
              return <>
                <label className="kv"><span>Inertia</span><select aria-label="Inertia about" value={inertiaAt} onChange={e => setInertiaAt(e.target.value as 'centre' | 'origin')}><option value="centre">about the centre of mass</option><option value="origin">about the origin</option></select></label>
                <div className="kv inertia" aria-label="Moments of inertia">Ixx Iyy Izz <b>{[0, 1, 2].map(k => sig3(I[k][k])).join(' · ')} kg·mm²</b></div>
                <div className="kv inertia muted">Ixy Iyz Ixz <b>{[[0, 1], [1, 2], [0, 2]].map(([i, j]) => sig3(I[i][j])).join(' · ')}</b></div>
              </>; })()}
            <div className="kv">Surface area <b>{fmt(Math.round(b.mesh.faces.reduce((t, f) => t + f.areaMM2, 0)))} mm²</b></div>
            <div className="kv">Faces <b>{b.mesh.faces.length}</b></div>
          </div>; })}
          {selBodies.length > 1 && (() => { const parts = selBodies.flatMap(b => { const m = bodyMass(b, (MATERIALS.find(x => x.id === lookOf(doc, b).material) ?? density).gPerCm3); return m ? [m] : []; }), c = combined(parts), box = boxOf(selBodies);
            return c && box ? <><div className="kv">Together <b>{fmt(Math.round(c.massG * 10) / 10)} g</b></div><div className="kv">Centre of mass <b>{c.centroid.map(v => fmt(Math.round(v * 100) / 100)).join(', ')}</b></div>
              <div className="kv">Bounds <b>{[0, 1, 2].map(k => fmt(Math.round((box.max[k] - box.min[k]) * 100) / 100)).join(' × ')}</b></div></> : null; })()}
        </>}
        {!sel1 && !selBodies.length && bodies.length > 0 && !sketch && (() => { const parts = bodies.flatMap(b => { const m = bodyMass(b, (MATERIALS.find(x => x.id === lookOf(doc, b).material) ?? density).gPerCm3); return m ? [m] : []; }), c = combined(parts), box = boxOf(bodies);
          return c && box ? <div className="part-summary"><div className="card-title">PART · {bodies.length} {bodies.length === 1 ? 'body' : 'bodies'}</div>
            <div className="kv">Mass <b>{fmt(Math.round(c.massG * 10) / 10)} g</b></div><div className="kv">Centre of mass <b>{c.centroid.map(v => fmt(Math.round(v * 100) / 100)).join(', ')}</b></div>
            <label className="kv"><span>Bounds <b>{[0, 1, 2].map(k => fmt(Math.round((box.max[k] - box.min[k]) * 100) / 100)).join(' × ')}</b></span><span className="kv-check"><input type="checkbox" aria-label="Show the bounding box" checked={showBox} onChange={e => setShowBox(e.target.checked)} /> box</span></label></div> : null; })()}
        {!sel1 && !selBodies.length && <div className="empty">Click a face or edge; Shift-click adds more of the same (edges to round, faces to open). For a Boolean, Shift-click a second body in the Outliner.</div>}
        {editNode !== null && <NodeEditor nodes={doc.nodes} index={editNode} onEditSketch={(() => { const n = doc.nodes[editNode]; const s = n?.kind === 'sketch' ? editNode : n && 'sketch' in n ? n.sketch : null; return s !== null && doc.nodes[s]?.kind === 'sketch' ? () => editSketch(s) : undefined; })()} onApply={nodes => {
          const next = { ...doc, nodes: dropStaleMade(doc.nodes, nodes) };
          engine.evaluate(prefixDoc(next, marker ?? next.nodes.length), revision.current++).then(r => { if (!r) return; if (r.ok) commit(next); else setToast(r.error); });
        }} onDelete={() => deleteNode(editNode)} onClose={() => setEditNode(null)} />}
      </aside>}
      </div>

      {drawing && <DrawingWorkspace engine={engine} doc={{ ...evaluated, instances: doc.instances }} settings={doc.drawing ?? defaultDrawing()} fileName={fileName} onChange={commitDrawing} onToast={setToast} />}

      {active && <Hud active={active} onChange={(key, value) => { lastTyped.current = Date.now(); handleDrag.current = null; setActive(a => a && { ...a, values: patchValues(a.cmd, a.ctx, a.values, { [key]: value }), preview: 'busy' }); }} onApply={apply} onCancel={cancel} />}

      {sketch && !active && <div className="card hint-bar">
        {(() => { const t = TOOLS.find(x => x.tool === sketch.tool)!; return <><span className="hint-title"><Icon name={t.icon} small />{t.label}</span><span>{t.hint}</span></>; })()}
        <span>{TOOLS.map(t => <Kbd key={t.key}>{t.key}</Kbd>)} tools</span><span><Kbd>X</Kbd> construction</span><span><Kbd>Enter</Kbd> finish</span><span><Kbd>Esc</Kbd> exit</span>
      </div>}

      {rendering && !sketch && (() => {
        const i = selectedBodies(selection)[0], b = i !== undefined ? bodies[i] : undefined, ref = b ? refOf(b) : null, node = ref ? evaluated.nodes[ref.node] : null;
        return <Timeline animation={render.animation} time={time} playing={playing} bodyKey={b?.key ?? null}
          bodyLabel={node && ref ? featureLabel(node, ref.node, evaluated.nodes) : b?.key ?? ''}
          onTime={t => { setPlaying(false); setTime(t); }} onPlay={play} onChange={a => commitRender({ ...render, animation: a })} />;
      })()}
      {!sketch && !active && !rendering && <div className="card history" aria-label="History">
        <span className="card-title inline">HISTORY</span>
        {doc.nodes.map((n, i) => innerSteps.has(i) ? null : n.kind === 'sketch' ? (freeSketches.includes(i) ? (
          // A finished sketch no feature uses yet: click picks it as a profile (Shift adds) and opens its editor.
          <button key={i} className={'hs sketch' + (i >= markerAt ? ' rolled' : '') + (selection.sketches?.includes(i) ? ' picked' : '') + (editNode === i ? ' edit' : '')} title={`${featureLabel(n, i, doc.nodes)} · click to pick it as a profile (Shift: add) · double-click to roll back here`}
            onClick={e => { pickProfile(i, e.shiftKey); setEditNode(i); }} onDoubleClick={() => setMarker(i + 1 >= totalNodes ? null : i + 1)}
            onContextMenu={e => { e.preventDefault(); setHistoryMenu({ at: { x: e.clientX, y: e.clientY }, index: i }); }}>
            <Icon name="cad-sketch" small />{featureLabel(n, i, doc.nodes)}</button>) : null) : (
          <button key={i} className={'hs' + (i >= markerAt ? ' rolled' : '') + (editNode === i ? ' edit' : '')} title={`${featureLabel(n, i, doc.nodes)} · click to edit · double-click to roll back here`}
            onClick={() => { setEditNode(i); setInstanceSel([]); setDirectSel([]); assembly.cancel(); }} onDoubleClick={() => setMarker(i + 1 >= totalNodes ? null : i + 1)}
            onContextMenu={e => { e.preventDefault(); setHistoryMenu({ at: { x: e.clientX, y: e.clientY }, index: i }); }}>
            <Icon name={iconFor(n)} small />{featureLabel(n, i, doc.nodes)}</button>))}
        <button className="marker" aria-label="Roll forward to the end" title="Rollback marker · click to roll forward" onClick={() => setMarker(null)} />
        {marker !== null && <span className="muted">rolled back · {totalNodes - markerAt} hidden</span>}
      </div>}

      <div className="corner-left">
        <span className="mono muted">{busy ? 'Computing…' : `${ortho ? 'Orthographic' : 'Perspective'} · ${shownBodies.length} solid${shownBodies.length === 1 ? '' : 's'} · ${Math.round(lastMs)} ms`}{cursor ? ` · ${cursor.map(v => fmt(Math.round(v * 10) / 10)).join(', ')}` : ''}</span>
      </div>

      <div className="corner-right">
  {section && <div className="card section-bar" role="group" aria-label="Section"><span className="muted">Section</span>{(['x', 'y', 'z'] as const).map(a => <button key={a} className={section.axis === a ? 'on' : ''} aria-label={`Section across ${a.toUpperCase()}`}
            onClick={() => { const k = 'xyz'.indexOf(a), vs = bodies.flatMap(b => [b.mesh.bounds.min[k], b.mesh.bounds.max[k]]); setSection(s => s && { ...s, axis: a, at: vs.length ? Math.round(Math.min(...vs) + Math.max(...vs)) / 2 : 0 }); }}>{a.toUpperCase()}</button>)}
            <button aria-label="Flip the section" data-tip="Show the other side" onClick={() => setSection(s => s && { ...s, keep: s.keep === 'negative' ? 'positive' : 'negative' })}><Icon name="swap_horiz" small /></button></div>}
        <div className="card views" role="group" aria-label="Views">
          {(['iso', 'top', 'front', 'right'] as const).map(v => <button key={v} onClick={() => viewport.current?.setView(v)}>{v === 'iso' ? 'Iso' : v[0].toUpperCase() + v.slice(1)}</button>)}
          <button onClick={() => viewport.current?.fit()} title="Frame all (F)"><Icon name="fit_screen" small /></button>
          <button className={section ? 'on' : ''} aria-label="Section view" data-tip="Section view" data-tip-desc="Cut the part open along a plane to see inside (the model is not changed)"
            onClick={() => { if (section) { setSection(null); return; } const zs = bodies.flatMap(b => [b.mesh.bounds.min[1], b.mesh.bounds.max[1]]); setSelection(emptySel); setSection({ axis: 'y', at: zs.length ? Math.round((Math.min(...zs) + Math.max(...zs))) / 2 : 0, keep: 'positive' }); }}>
            <Icon name="cad-split" small /></button>

          <button onClick={() => setOrtho(viewport.current?.toggleOrtho() ?? false)} className={ortho ? 'on' : ''}>Ortho</button>
          <button onClick={() => setAo(v => !v)} className={ao ? 'on' : ''} title="Ambient occlusion">AO</button>
          <button onClick={() => setTheme(v => v === 'dark' ? 'light' : 'dark')} title="Toggle light / dark" aria-label="Toggle light or dark theme"><Icon name={theme === 'dark' ? 'light_mode' : 'dark_mode'} small /></button>
        </div>
        <button className="chip snap" aria-label="Selection filter" data-tip="Selection filter" data-tip-desc="What a click picks: anything, or only faces, edges or whole bodies (click for the next)"
          onClick={() => setPickFilter(f => { const all = ['all', 'face', 'edge', 'body'] as const, n = all[(all.indexOf(f) + 1) % all.length]; try { localStorage.setItem('studio.pick', n); } catch { /* private mode */ } return n; })}>
          <Icon name="ads_click" small />{({ all: 'Pick all', face: 'Faces', edge: 'Edges', body: 'Bodies' } as const)[pickFilter]}</button>
        <button className="chip snap" aria-label="Snap" data-tip="Grid snap" data-tip-desc="Sketch points, placing and moves land on this step: click for the next (1, 0.5, 0.1, 5, 10 mm, off)"
          onClick={() => setSnapStep(s => { const steps = [1, 0.5, 0.1, 5, 10, 0], n = steps[(steps.indexOf(s) + 1) % steps.length]; try { localStorage.setItem('studio.snap', String(n)); } catch { /* private mode */ } return n; })}>
          <Icon name="adjust" small />{snapStep ? `Snap ${fmt(snapStep)} mm` : 'Snap off'}</button>
        <span className="chip mono">mm</span>
      </div>

      {chat && !rendering && !drawing && <ChatPanel base={() => evaluated} evaluate={d => engine.part(d, revision.current++).then(r => r.ok ? r.bodies : null)}
        blocked={sketch ? 'Finish or leave the sketch to chat.' : active ? `Apply or cancel ${active.cmd.label} to chat.` : null}
        onPreview={setPreviewBodies} onCommit={(next, sel) => { chatSelection.current = sel ?? null; commit(next); }}
        onSelect={sel => setSelection(resolveNames(bodies, sel).selection)} onClose={() => setChat(false)} />}
      {palette && <Palette ctx={ctx} onRun={start} onClose={() => setPalette(false)} />}
      {help && <ShortcutHelp onClose={() => setHelp(false)} />}
      {historyMenu && doc.nodes[historyMenu.index] && (() => {
        const i = historyMenu.index, n = doc.nodes[i], sk = n.kind === 'sketch' ? i : 'sketch' in n && typeof n.sketch === 'number' && doc.nodes[n.sketch]?.kind === 'sketch' ? n.sketch : null;
        return <ContextMenu at={historyMenu.at} title={featureLabel(n, i, doc.nodes).toUpperCase()} ctx={ctx} commands={false} onClose={() => setHistoryMenu(null)} onRun={() => {}}
          actions={[
            { label: 'Edit', icon: 'edit', run: () => { setEditNode(i); setInstanceSel([]); setDirectSel([]); } },
            ...(sk !== null ? [{ label: 'Edit sketch', icon: 'cad-sketch', run: () => editSketch(sk) }] : []),
            { label: 'Roll back to here', icon: 'undo', run: () => setMarker(i + 1 >= totalNodes ? null : i + 1) },
            ...(marker !== null ? [{ label: 'Roll to the end', icon: 'redo', run: () => setMarker(null) }] : []),
            { label: 'Delete', icon: 'delete', shortcut: 'Del', run: () => deleteNode(i) },
          ]} />;
      })()}
      {menu && <ContextMenu at={menu.at} title={menu.title} ctx={{ ...ctx, selection: menu.selection }} onClose={() => setMenu(null)}
        onRun={c => { setMenu(null); start(c); }}
        actions={[
          { label: 'Frame all', icon: 'fit_screen', shortcut: 'F', run: () => viewport.current?.fit() },
          { label: 'Isometric view', icon: 'view_in_ar', run: () => viewport.current?.setView('iso') },
          { label: 'Top view', icon: 'crop_square', run: () => viewport.current?.setView('top') },
          ...(() => {
            // On a body: hide it, show it alone, delete it; with something hidden: show everything again.
            const picked = selectedBodies(menu.selection).filter(i => bodies[i]), anyHidden = bodies.some(b => lookOf(doc, b).hidden);
            const hideAll = (keep: (i: number) => boolean) => commit(bodies.reduce((d, b, i) => withLook(d, b, { hidden: !keep(i) }), doc));
            const at = menu.selection.faces[0] ? { body: menu.selection.faces[0].body, face: menu.selection.faces[0].face } : menu.selection.edges[0] ? { body: menu.selection.edges[0].body, edge: menu.selection.edges[0].edge } : null;
            return [
              ...(at ? [{ label: 'Measure from here', icon: 'cad-measure', shortcut: '⇧M', run: () => { setMeasure([at]); setSelection(emptySel); setEditNode(null); } }] : []),
              ...(picked.length ? [{ label: picked.length > 1 ? 'Hide bodies' : 'Hide body', icon: 'visibility_off', run: () => { hideAll(i => !picked.includes(i) && !lookOf(doc, bodies[i]).hidden); setSelection(emptySel); } },
                { label: 'Show only this', icon: 'filter_center_focus', run: () => hideAll(i => picked.includes(i)) },
                { label: 'Delete', icon: 'delete', shortcut: 'Del', run: () => deleteSelection() }] : []),
              ...(anyHidden ? [{ label: 'Show all bodies', icon: 'visibility', run: () => hideAll(() => true) }] : []),
            ];
          })(),
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

/** A feature's icon in the history: the CAD icon of the command that makes it (a shape's own). */
function iconFor(n: ModelNode) {
  if ('made' in n && n.made) return 'cad-' + n.made.command;
  return ({ extrude: 'cad-extrude', revolve: 'cad-revolve', shell: 'cad-shell', import: 'file_open', sweep: 'cad-sweep', loft: 'cad-loft', hole: 'cad-hole', chamfer: 'cad-chamfer', fillet: 'cad-fillet', union: 'cad-union', difference: 'cad-subtract', intersect: 'cad-intersect',
    translate: 'cad-move', rotate: 'cad-rotate', mirror: 'cad-mirror', scale: 'cad-scale', 'linear-pattern': 'cad-pattern-linear', 'circular-pattern': 'cad-pattern-circular', split: 'cad-split', sketch: 'cad-sketch' } as Record<string, string>)[n.kind] ?? 'category';
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
