import { useEffect, useImperativeHandle, useRef, useState, forwardRef } from 'react';
import type { BodyResult } from '../engine/evaluate';
import type { Vec3 } from '../engine/mesh';
import { OrbitCamera } from './camera';
import { Renderer, type EdgeRef, type FaceRef, type ThemeName, type ViewRenderer, type ViewState } from './renderer';
import { GpuRenderer } from './gpuRenderer';
import type { RenderCamera, RenderSettings } from '../engine/render';
import type { DirectDisplay } from '../engine/direct';
import { bulgeThrough, arcOf, sampleOutline, sampleSlot, type P2 } from '../sketch/profile';
import { isDefaultPlane, rayOnPlane, toLocal, toWorld, type PlaneKind, type SketchPlane } from '../sketch/plane';
import { shapeOutline } from '../sketch/loops';
import type { SketchRule } from '../sketch/terms';
import { hvOf, isSettled, type SketchPick } from '../sketch/rules';
import { pickSketch } from '../sketch/select';
import { drivingKeys, sketchMarks } from '../ui/SketchMarks';
import { dragAlong, dragPlane, dragTurn, GIZMO_PX, hitTest, snapTo, type FeatureHandle, type GizmoHit, type Projector, type TransformGizmo } from './gizmo';
import { gizmoMarks } from './GizmoMarks';

/** `select` picks outline points and edges for constraints; `dimension` adds and edits dimensions. */
export type SketchTool = 'rectangle' | 'circle' | 'polygon' | 'arc' | 'slot' | 'select' | 'dimension';
/** Polygon segment i runs from point i to i+1; bulges[i] ≠ 0 makes it an arc. `pending`: the newest arc follows the cursor. */
export type SketchShape =
  | { kind: 'rectangle'; a: [number, number]; b: [number, number] }
  | { kind: 'circle'; c: [number, number]; r: number }
  | { kind: 'polygon'; points: [number, number][]; closed: boolean; bulges?: number[]; pending?: boolean;
      /** Locked edge lengths and arc radii by segment index; tangent joints by point index. */
      lengths?: Record<number, number>; radii?: Record<number, number>; tangents?: number[];
      /** Arc pairs [lower, higher segment index] with the same radius / the same centre. */
      equalRadii?: [number, number][]; concentric?: [number, number][];
      /** Horizontal / vertical edges (kept from closing on), explicit constraints and point distances (sketch/rules.ts). */
      hv?: { h: number[]; v: number[] }; rules?: SketchRule[];
      /** Drawn with the Rectangle tool: saved as a rectangle again while it still is one (see sketch/loops.ts). */
      fromRectangle?: true;
      /** Circles attached to the outline: dimensioned from its points and solved with it (holes or bosses of the profile). */
      circles?: { c: [number, number]; r: number }[] }
  | { kind: 'slot'; a: [number, number]; b: [number, number]; r: number };

/** What a sketch plane is placed from: the face it was started on or a coordinate plane, moved by `offset` along its normal. */
export interface SketchAnchor { kind: 'face' | PlaneKind; offset: number; /** Degrees tipped about the plane's X axis (before the offset). */ angle?: number; face?: { plane: SketchPlane; base: { node: number; side: string } | null } }
export interface SketchState { plane: SketchPlane; anchor?: SketchAnchor; /** Closed shapes drawn before the current one. */ done?: SketchShape[]; tool: SketchTool; shape: SketchShape | null; base?: { node: number; side: string } | null; /** What the finished profile makes by default. */ make?: Make;
  /** Outline points and edges picked with the Select tool; the dimension open in the viewport editor (len<i>, rad<i>, dist<a>_<b>). */
  picked?: SketchPick[]; editDim?: string | null;
  /** Set when a finished sketch is reopened: Finish replaces this node instead of adding a feature. */
  editNode?: number }
export type Make = 'extrude' | 'revolve-y' | 'revolve-x' | 'pipe' | 'loft';
export type { FeatureHandle, TransformGizmo } from './gizmo';

export interface ViewportHandle {
  fit(): void; setView(name: Parameters<OrbitCamera['setView']>[0]): void; toggleOrtho(): boolean; camera: OrbitCamera;
  /** A straight view onto the sketch plane, framing its rectangle (plane coordinates) in the area not covered by `insets` (CSS px). */
  frameSketch(min: [number, number], max: [number, number], plane: SketchPlane, insets?: { left: number; right: number }): void;
  setTheme(name: ThemeName): void; setAo(on: boolean): void;
  /** The frame as a PNG (WebGPU only). */
  capture(): Promise<Blob | null>;
  /** The camera as render settings keep it, and back. */
  getCamera(): RenderCamera;
  setCamera(c: RenderCamera): void;
  /** Which renderer draws: WebGPU, the WebGL2 fallback, or none yet. */
  readonly backend: 'webgpu' | 'webgl2' | null;
}

interface Props {
  bodies: BodyResult[];
  selection: { faces: FaceRef[]; edges: EdgeRef[]; bodies: number[] };
  ghost: Set<number>;
  sketch: SketchState | null;
  /** Move / turn handles on the selection (see viewport/gizmo.ts), and arrows that drag one feature dimension. */
  gizmo: TransformGizmo | null;
  handles?: FeatureHandle[];
  onPick(hit: { face: FaceRef | null; edge: EdgeRef | null; point: Vec3 | null; direct?: string; instance?: string; instanceFace?: FaceRef }, additive: boolean): void;
  /** `fresh`: a new shape starts (the current one, if closed, is kept beside it). */
  onSketchShape(shape: SketchShape | null, fresh?: boolean): void;
  onCursor(p: Vec3 | null): void;
  onBoxSelect(bodies: number[], additive: boolean): void;
  onContextMenu(at: { x: number; y: number }, hit: { face: FaceRef | null; edge: EdgeRef | null }): void;
  onDimClick?(key: string): void;
  /** Select / Dimension tool clicks on the outline (null: empty space); opening and committing the dimension editor. */
  onSketchPick?(hit: SketchPick | null, additive: boolean): void;
  onDimEdit?(key: string | null): void;
  onDimCommit?(key: string, value: number): void;
  /** A measured distance: a dimension line between the closest points. */
  measureLine?: { a: Vec3; b: Vec3; label: string } | null;
  /** Render settings (the Render workspace), or null for the modelling look. */
  render?: RenderSettings | null;
  /** Bodies moved by an offset (the Render workspace's animation), by body index. */
  offsets?: Map<number, Vec3>;
  /** Bodies shown moved while a gizmo drags them (by body index; see ViewState.transforms). */
  transforms?: Map<number, Float64Array> | null;
  /** Direct curves and surfaces, and the selected ones. */
  direct?: DirectDisplay[];
  directSelection?: string[];
  /** Placed instances of other parts, and the selected ones. */
  instances?: { id: string; bodies: BodyResult[] }[];
  instanceSelection?: string[];
  /** Faces of instances shown picked (mate faces). */
  instanceFaces?: { id: string; body: number; face: number }[];
  /** Finished sketches no feature uses yet (world outlines), picked ones highlighted; a click picks one (Shift: adds). */
  profiles?: { id: number; rings: Vec3[][]; picked: boolean }[];
  onPickProfile?(id: number | null, additive: boolean): void;
  /** An instance shown moved while the gizmo drags it (see assembly/drag.ts previewMatrix). */
  instancePreview?: { id: string; matrix: Float64Array } | null;
}

const snap = (v: number) => Math.round(v);

export const Viewport = forwardRef<ViewportHandle, Props>(function Viewport(props, ref) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<ViewRenderer | null>(null);
  const [backend, setBackend] = useState<'webgpu' | 'webgl2' | null>(null);
  const theme = useRef<ThemeName>('dark'), ao = useRef(true);
  const camera = useRef(new OrbitCamera());
  const frame = useRef(0);
  const hover = useRef<{ face: FaceRef | null; edge: EdgeRef | null }>({ face: null, edge: null });
  const drag = useRef<{ mode: 'orbit' | 'pan' | 'gizmo' | 'box' | null; x: number; y: number; moved: boolean; x0?: number; y0?: number;
    /** A gizmo drag: what was hit, the pointer's start and last points, and what it means so far. */
    hit?: GizmoHit; from?: [number, number]; last?: [number, number]; turned?: number; delta?: Vec3; degrees?: number; value?: number; start?: number; origin?: Vec3 }>({ mode: null, x: 0, y: 0, moved: false });
  /** The gizmo handle under the pointer, drawn brighter. */
  const gizmoHot = useRef<GizmoHit | null>(null);
  const sketchDraft = useRef<{ cursor: [number, number] | null; hover?: SketchPick | null }>({ cursor: null });
  /** Plane coordinates of the sketch → canvas pixels. */
  const sketchProject = (plane: SketchPlane) => { const w = canvas.current!.clientWidth, h = canvas.current!.clientHeight; return (u: number, v: number) => camera.current.project(toWorld(plane, [u, v]), w, h); };
  const picking = (sk: SketchState | null) => sk?.tool === 'select' || sk?.tool === 'dimension';
  const [, setTick] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const propsRef = useRef(props); propsRef.current = props;
  // Pointer events can arrive before React re-renders with the shape we just emitted, so handlers read
  // the latest emitted shape; a new shape from the app (panel edit, solver settle) replaces it.
  const liveShape = useRef<SketchShape | null>(props.sketch?.shape ?? null), seenShape = useRef(props.sketch?.shape);
  if (props.sketch?.shape !== seenShape.current) { seenShape.current = props.sketch?.shape; liveShape.current = props.sketch?.shape ?? null; }
  const emit = (shape: SketchShape | null, fresh = false) => { liveShape.current = shape; propsRef.current.onSketchShape(shape, fresh); };
  const fitted = useRef(false);

  const viewState = (): ViewState => ({
    hoverFace: hover.current.face, hoverEdge: hover.current.edge,
    selectedFaces: propsRef.current.selection.faces, selectedEdges: propsRef.current.selection.edges, selectedBodies: propsRef.current.selection.bodies,
    // (The WebGL2 renderer draws offsets only: a dragged body there shows its move, not its turn.)
    offsets: propsRef.current.transforms ? new Map([...propsRef.current.transforms].map(([k, m]) => [k, [m[12], m[13], m[14]] as Vec3])) : propsRef.current.offsets ?? new Map(),
    transforms: propsRef.current.transforms ?? undefined, ghostBodies: propsRef.current.ghost,
  });

  const request = () => {
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      const r = renderer.current; if (!r) return;
      r.render(camera.current, viewState());
      setTick(t => t + 1);
    });
  };

  // WebGPU (the @barocss/gpu viewer) when the browser has it, else WebGL2; ?renderer=webgl2 forces the latter.
  useEffect(() => {
    let live = true, observer: ResizeObserver | null = null;
    const start = (r: ViewRenderer, name: 'webgpu' | 'webgl2') => {
      if (!live) { r.dispose?.(); return; }
      renderer.current = r; r.setTheme(theme.current); r.aoEnabled = ao.current;
      observer = new ResizeObserver(request); observer.observe(canvas.current!);
      setBackend(name);
    };
    const webgl = () => { try { start(new Renderer(canvas.current!), 'webgl2'); } catch (e) { setError(String(e)); } };
    const forced = new URLSearchParams(location.search).get('renderer');
    if (forced !== 'webgl2' && 'gpu' in navigator) GpuRenderer.create(canvas.current!).then(r => start(r, 'webgpu'), webgl);
    else webgl();
    return () => { live = false; observer?.disconnect(); renderer.current?.dispose?.(); renderer.current = null; };
  }, []);

  useEffect(() => {
    const r = renderer.current; if (!r) return;
    r.setBodies(props.bodies);
    if (!fitted.current && props.bodies.length) { const b = r.bounds(); if (b) { camera.current.aspect = canvas.current!.clientWidth / Math.max(1, canvas.current!.clientHeight); camera.current.fit(b.min, b.max); fitted.current = true; } }
    r.setState(viewState()); request();
  }, [props.bodies, backend]);

  useEffect(() => { renderer.current?.setState(viewState()); request(); }, [props.selection, props.ghost, props.offsets, props.transforms]);
  useEffect(() => { request(); }, [props.sketch, props.gizmo, props.handles]);
  useEffect(() => { renderer.current?.setRender?.(props.render ?? null); request(); }, [props.render, backend]);
  useEffect(() => { renderer.current?.setDirect?.(props.direct ?? [], props.directSelection ?? []); request(); }, [props.direct, props.directSelection, backend]);
  useEffect(() => { renderer.current?.setInstances?.(props.instances ?? [], props.instanceSelection ?? []); request(); }, [props.instances, props.instanceSelection, backend]);
  useEffect(() => { renderer.current?.setInstancePreview?.(props.instancePreview ?? null); request(); }, [props.instancePreview, backend]);
  // (By content: the list is rebuilt on every render.)
  const instanceFacesKey = JSON.stringify(props.instanceFaces ?? []);
  useEffect(() => { renderer.current?.setInstanceFaces?.(JSON.parse(instanceFacesKey)); request(); }, [instanceFacesKey, props.instances, backend]);

  useImperativeHandle(ref, () => ({
    camera: camera.current,
    fit() { const b = renderer.current?.bounds(); if (b) camera.current.fit(b.min, b.max); request(); },
    setView(name) { camera.current.setView(name); const b = renderer.current?.bounds(); if (b) camera.current.fit(b.min, b.max); request(); },
    frameSketch(min, max, plane, insets = { left: 0, right: 0 }) {
      const w = Math.max(1, canvas.current!.clientWidth), h = Math.max(1, canvas.current!.clientHeight);
      camera.current.aspect = w / h; camera.current.faceNormal(plane.normal);
      camera.current.frameAt(toWorld(plane, [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2]), [max[0] - min[0], max[1] - min[1]], insets.left / w, insets.right / w); request();
    },
    toggleOrtho() { camera.current.ortho = !camera.current.ortho; request(); return camera.current.ortho; },
    setTheme(name) { theme.current = name; renderer.current?.setTheme(name); request(); },
    setAo(on) { ao.current = on; if (renderer.current) renderer.current.aoEnabled = on; request(); },
    capture() { return renderer.current?.capture ? renderer.current.capture() : Promise.resolve(null); },
    getCamera() { const c = camera.current; return { target: [...c.target] as [number, number, number], distance: c.distance, yaw: c.yaw, pitch: c.pitch, fovY: c.fovY, ortho: c.ortho }; },
    setCamera(v) { const c = camera.current; c.target = [...v.target] as Vec3; c.distance = v.distance; c.yaw = v.yaw; c.pitch = v.pitch; c.fovY = v.fovY; c.ortho = v.ortho; request(); },
    get backend() { return backend; },
  }));

  const local = (e: { clientX: number; clientY: number }) => {
    const rect = canvas.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top, w: rect.width, h: rect.height };
  };
  const planePoint = (x: number, y: number, w: number, h: number, z: number): Vec3 | null => {
    const { origin, dir } = camera.current.ray((x / w) * 2 - 1, 1 - (y / h) * 2);
    if (Math.abs(dir[2]) < 1e-6) return null;
    const t = (z - origin[2]) / dir[2]; if (t < 0) return null;
    return [origin[0] + dir[0] * t, origin[1] + dir[1] * t, z];
  };
  /**
   * The edge or else the face under a pixel. Over a face an edge must be within 4 px (a thin face such as
   * a plate's side stays pickable); elsewhere within 6 px.
   */
  const pickAt = (r: ViewRenderer, x: number, y: number): { face: FaceRef | null; edge: EdgeRef | null } => {
    const under = r.pickFace(x, y, camera.current, viewState());
    const edge = r.pickEdge(x, y, camera.current, viewState(), under ? 4 : 6);
    return { face: edge ? null : under, edge };
  };
  /** The sketch plane's coordinates under a pixel. */
  const sketchPoint = (x: number, y: number, w: number, h: number, plane: SketchPlane): [number, number] | null => {
    const { origin, dir } = camera.current.ray((x / w) * 2 - 1, 1 - (y / h) * 2);
    return rayOnPlane(plane, origin, dir);
  };
  const surfacePoint = (x: number, y: number, w: number, h: number, face: FaceRef | null): Vec3 | null => {
    if (!face) return null;
    const f = propsRef.current.bodies[face.body]?.mesh.faces[face.face]; if (!f || f.kind !== 'plane') return null;
    const { origin, dir } = camera.current.ray((x / w) * 2 - 1, 1 - (y / h) * 2);
    const denom = f.normal[0] * dir[0] + f.normal[1] * dir[1] + f.normal[2] * dir[2]; if (Math.abs(denom) < 1e-9) return null;
    const t = ((f.centroid[0] - origin[0]) * f.normal[0] + (f.centroid[1] - origin[1]) * f.normal[1] + (f.centroid[2] - origin[2]) * f.normal[2]) / denom;
    return [origin[0] + dir[0] * t, origin[1] + dir[1] * t, origin[2] + dir[2] * t];
  };

  /** Canvas pixels of world points, for the gizmo and handles: they keep one size on screen (GIZMO_PX at their origin). */
  const projector = (): Projector => {
    const w = canvas.current!.clientWidth, h = canvas.current!.clientHeight, cam = camera.current, { right, forward } = cam.basis();
    const project = (p: Vec3): [number, number] => { const q = cam.project(p, w, h); return [q[0], q[1]]; };
    const o = propsRef.current.gizmo?.origin ?? propsRef.current.handles?.[0]?.at ?? cam.target, a = project(o), b = project([o[0] + right[0], o[1] + right[1], o[2] + right[2]]);
    const perMm = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return { project, forward, size: GIZMO_PX / perMm };
  };
  const sk0 = () => propsRef.current.sketch;
  /** The finished sketch under a canvas point: within 6 px of an outline, or inside a main loop. */
  const profileAt = (x: number, y: number, w: number, h: number): number | null => {
    const list = propsRef.current.profiles; if (!list?.length) return null;
    let best: number | null = null, bestD = 6;
    for (const p of list) for (const [k, ring] of p.rings.entries()) {
      const q = ring.map(v => camera.current.project(v, w, h));
      let inside = false;
      for (let i = 0, j = q.length - 1; i < q.length; j = i++) {
        const a = q[i], b = q[j], dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy, t = l2 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / l2)) : 0;
        const d = Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy); if (d < bestD) { bestD = d; best = p.id; }
        if ((a[1] > y) !== (b[1] > y) && x < a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1])) inside = !inside;
      }
      if (k === 0 && inside && best === null) best = p.id;
    }
    return best;
  };
  const gizmoHit = (x: number, y: number) => { const p = propsRef.current; return (p.gizmo || p.handles?.length) && canvas.current ? hitTest([x, y], p.gizmo, p.handles ?? [], projector()) : null; };
  /** A gizmo drag from its start to (x, y): calls the handler with the whole move, turn or value so far. */
  const gizmoDrag = (x: number, y: number, shift: boolean, done: boolean) => {
    const d = drag.current, p = propsRef.current, g = p.gizmo, P = projector(), hit = d.hit!;
    d.x = x; d.y = y;
    if (hit.kind === 'handle') {
      const hd = p.handles?.[hit.index]; if (!hd) return;
      const mm = dragAlong(d.from!, [x, y], hd.at, hd.dir, P);
      d.value = hd.toValue(d.start!, mm); hd.onDrag(d.value, done); return;
    }
    if (!g) return;
    if (hit.kind === 'move' || hit.kind === 'plane') {
      const delta: Vec3 = [0, 0, 0], step = shift ? 0.1 : 1;
      // (Measured from the gizmo where the drag began: it moves with the selection meanwhile.)
      const o = d.origin ?? g.origin;
      if (hit.kind === 'plane') { const [u, v] = dragPlane(d.from!, [x, y], o, hit.axes, P); delta[hit.axes[0]] = snapTo(u, step); delta[hit.axes[1]] = snapTo(v, step); }
      else { const dir: Vec3 = [0, 0, 0]; dir[hit.axis] = 1; delta[hit.axis] = snapTo(dragAlong(d.from!, [x, y], o, dir, P), step); }
      d.delta = delta; g.onMove?.(delta, done); return;
    }
    // A turn adds up the sweep step by step, so it can go past half a turn.
    d.turned = (d.turned ?? 0) + dragTurn(d.last!, [x, y], g.origin, hit.axis, P); d.last = [x, y];
    const step = shift ? 1 : g.turnSnap?.(hit.axis) ?? 15;
    d.degrees = snapTo(d.turned, step); g.onTurn?.(hit.axis, d.degrees, done);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    canvas.current!.setPointerCapture(e.pointerId);
    const { x, y } = local(e);
    const hit = e.button === 0 && !propsRef.current.sketch ? gizmoHit(x, y) : null;
    if (hit) {
      const start = hit.kind === 'handle' ? propsRef.current.handles![hit.index].value : undefined;
      drag.current = { mode: 'gizmo', x, y, moved: false, hit, from: [x, y], last: [x, y], turned: 0, start, origin: propsRef.current.gizmo ? [...propsRef.current.gizmo.origin] as Vec3 : undefined };
      return;
    }
    if (e.button === 2 && !e.shiftKey) drag.current = { mode: 'orbit', x, y, moved: false };
    else if (e.button === 1 || (e.button === 2 && e.shiftKey)) drag.current = { mode: 'pan', x, y, moved: false };
    else if (e.button === 0 && e.altKey) drag.current = { mode: 'orbit', x, y, moved: false };
    else drag.current = { mode: null, x, y, moved: false, x0: x, y0: y };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const { x, y, w, h } = local(e); const d = drag.current; const r = renderer.current; if (!r) return;
    if (d.mode === 'orbit') { camera.current.orbit(x - d.x, y - d.y); d.x = x; d.y = y; d.moved = true; request(); return; }
    if (d.mode === 'pan') { camera.current.pan(x - d.x, y - d.y, h); d.x = x; d.y = y; d.moved = true; request(); return; }
    if (d.mode === 'gizmo') { gizmoDrag(x, y, e.shiftKey, false); d.moved = true; request(); return; }
    if (!d.mode && !sk0()) {
      const hot = gizmoHit(x, y);
      if (JSON.stringify(hot) !== JSON.stringify(gizmoHot.current)) { gizmoHot.current = hot; request(); }
      if (hot) { canvas.current!.style.cursor = 'grab'; return; }
      canvas.current!.style.cursor = '';
    }
    const sk = propsRef.current.sketch;
    if (!sk && e.buttons === 1 && d.x0 !== undefined && (d.mode === 'box' || Math.hypot(x - d.x0, y - d.y0!) > 5)) {
      d.mode = 'box'; d.x = x; d.y = y; d.moved = true; request(); return;
    }
    if (sk) {
      const p = sketchPoint(x, y, w, h, sk.plane);
      sketchDraft.current.cursor = p ? [snap(p[0]), snap(p[1])] : null;
      propsRef.current.onCursor(p ? toWorld(sk.plane, [snap(p[0]), snap(p[1])]) : null);
      const s = liveShape.current; const c = sketchDraft.current.cursor;
      if (picking(sk)) sketchDraft.current.hover = isSettled(s) ? pickSketch(s, sketchProject(sk.plane), x, y, sk.done) : null;
      else if (s && c) {
        if (s.kind === 'rectangle' && drafting.current) emit({ ...s, b: c });
        if (s.kind === 'circle' && drafting.current) emit({ ...s, r: Math.max(1, Math.round(Math.hypot(c[0] - s.c[0], c[1] - s.c[1]))) });
        if (s.kind === 'slot' && drafting.current) {
          if (slotStage.current === 1) emit({ ...s, b: c });
          else {
            const l = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]) || 1;
            const off = Math.abs((c[0] - s.a[0]) * (s.b[1] - s.a[1]) - (c[1] - s.a[1]) * (s.b[0] - s.a[0])) / l;
            emit({ ...s, r: Math.max(0.5, Math.round(off * 2) / 2) });
          }
        }
        if (s.kind === 'polygon' && s.pending && p) {
          const n = s.points.length, i = s.closed ? n - 1 : n - 2;
          if (i >= 0) { const bulges = [...(s.bulges ?? s.points.map(() => 0))]; bulges[i] = bulgeThrough(s.points[i], s.points[(i + 1) % n], [p[0], p[1]]); emit({ ...s, bulges }); }
        }
      }
      request(); return;
    }
    const { face, edge } = pickAt(r, x, y);
    const prev = hover.current;
    const next = { face: edge ? null : face, edge };
    if (JSON.stringify(prev) !== JSON.stringify(next)) { hover.current = next; r.setState(viewState()); request(); }
    const point = surfacePoint(x, y, w, h, face) ?? planePoint(x, y, w, h, 0);
    propsRef.current.onCursor(point);
  };

  const drafting = useRef(false);
  const slotStage = useRef(0);
  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current; drag.current = { mode: null, x: 0, y: 0, moved: false };
    const { x, y, w, h } = local(e);
    if (d.mode === 'gizmo') { drag.current = d; gizmoDrag(x, y, e.shiftKey, true); drag.current = { mode: null, x: 0, y: 0, moved: false }; request(); return; }
    if (d.mode === 'box') { boxSelect(d.x0!, d.y0!, x, y, e.shiftKey); request(); return; }
    if (e.button === 2 && d.mode === 'orbit' && !d.moved && !propsRef.current.sketch) {
      const { face, edge } = pickAt(renderer.current!, x, y);
      propsRef.current.onContextMenu({ x: e.clientX, y: e.clientY }, { face, edge }); return;
    }
    if (d.mode || d.moved || e.button !== 0) return;
    const sk = propsRef.current.sketch;
    if (sk) {
      const p = sketchPoint(x, y, w, h, sk.plane); if (!p) return;
      const c: [number, number] = [snap(p[0]), snap(p[1])];
      const s = liveShape.current;
      if (picking(sk)) { propsRef.current.onSketchPick?.(isSettled(s) ? pickSketch(s, sketchProject(sk.plane), x, y, sk.done) : null, e.shiftKey); return; }
      if (sk.tool === 'rectangle') {
        if (!drafting.current) { drafting.current = true; emit({ kind: 'rectangle', a: c, b: c }, true); }
        else { drafting.current = false; if (s && s.kind === 'rectangle') emit({ ...s, b: c }); }
      } else if (sk.tool === 'circle') {
        if (!drafting.current) { drafting.current = true; emit({ kind: 'circle', c, r: 1 }, true); }
        else drafting.current = false;
      } else if (sk.tool === 'slot') {
        if (!drafting.current) { drafting.current = true; slotStage.current = 1; emit({ kind: 'slot', a: c, b: c, r: 0 }, true); }
        else if (slotStage.current === 1) { if (s?.kind === 'slot' && (s.b[0] !== s.a[0] || s.b[1] !== s.a[1])) { slotStage.current = 2; emit({ ...s, b: c, r: 1 }); } }
        else { drafting.current = false; slotStage.current = 0; }
      } else {
        // Line (polygon) and arc tools share one open chain; an arc's bulge follows the cursor until the next click.
        const open = s && s.kind === 'polygon' && !s.closed ? s : null;
        if (s?.kind === 'polygon' && s.pending) { emit({ ...s, pending: false }); return; }
        const pts = open ? open.points : [], bulges = open?.bulges ?? pts.map(() => 0);
        const arc = sk.tool === 'arc' && pts.length > 0;
        const closing = pts.length >= 2 && pts[0][0] === c[0] && pts[0][1] === c[1];
        if (closing && (pts.length >= 3 || arc || bulges.some(Boolean))) emit({ kind: 'polygon', points: pts, closed: true, bulges, pending: arc });
        else if (!closing) emit({ kind: 'polygon', points: [...pts, c], closed: false, bulges: [...bulges, 0], pending: arc }, !open);
      }
      return;
    }
    const r = renderer.current!;
    // A finished sketch's outline (or inside its main loop) comes before the bodies behind it.
    const prof = profileAt(x, y, w, h);
    if (prof !== null) { propsRef.current.onPickProfile?.(prof, e.shiftKey); return; }
    const direct = r.pickDirect?.(x, y, camera.current) ?? null;
    if (direct) { propsRef.current.onPick({ face: null, edge: null, point: null, direct }, e.shiftKey); return; }
    const instance = r.pickInstanceFace?.(x, y, camera.current) ?? null;
    if (instance) { propsRef.current.onPick({ face: null, edge: null, point: null, instance: instance.id, instanceFace: instance.face >= 0 ? { body: instance.body, face: instance.face } : undefined }, e.shiftKey); return; }
    const { face, edge } = pickAt(r, x, y);
    propsRef.current.onPick({ face, edge, point: surfacePoint(x, y, w, h, face) }, e.shiftKey);
  };

  /** Window selection left→right (fully inside), crossing right→left (touching). */
  const boxSelect = (x0: number, y0: number, x1: number, y1: number, additive: boolean) => {
    const c = canvas.current!; const w = c.clientWidth, h = c.clientHeight;
    const [lx, hx, ly, hy] = [Math.min(x0, x1), Math.max(x0, x1), Math.min(y0, y1), Math.max(y0, y1)];
    const crossing = x1 < x0; const picked: number[] = [];
    propsRef.current.bodies.forEach((b, i) => {
      const P = b.mesh.positions; let inside = 0, total = 0;
      const step = Math.max(3, Math.floor(P.length / 3 / 400) * 3);
      for (let k = 0; k < P.length; k += step) {
        const q = camera.current.project([P[k], P[k + 1], P[k + 2]], w, h); total++;
        if (q[0] >= lx && q[0] <= hx && q[1] >= ly && q[1] <= hy) inside++;
      }
      if (crossing ? inside > 0 : inside === total && total > 0) picked.push(i);
    });
    propsRef.current.onBoxSelect(picked, additive);
  };

  const onWheel = (e: React.WheelEvent) => {
    const { x, y, w, h } = local(e);
    camera.current.zoom(Math.exp(e.deltaY * 0.0015), (x / w) * 2 - 1, 1 - (y / h) * 2); request();
  };

  // Overlay: sketch preview, dimension labels and the move gizmo, projected each frame.
  const overlay = () => {
    const c = canvas.current; if (!c) return null;
    const w = c.clientWidth, h = c.clientHeight; const cam = camera.current;
    const items: React.ReactNode[] = [];
    let editor: React.ReactNode = null;
    const sk = props.sketch;
    if (sk) {
      const P = (u: number, v: number) => cam.project(toWorld(sk.plane, [u, v]), w, h);
      // The sketch plane's grid (the ground grid shows XY at Z 0): lines a round step apart around the
      // view centre, the plane's own axes brighter.
      if (!isDefaultPlane(sk.plane)) {
        const centre = toLocal(sk.plane, cam.target), half = cam.distance * Math.tan(cam.fovY / 2) * Math.max(1, cam.aspect) * 1.2;
        const step = [1, 2, 5, 10, 20, 50, 100, 200].find(k => half * 2 / k <= 40) ?? 500;
        const u0 = Math.floor((centre[0] - half) / step) * step, u1 = Math.ceil((centre[0] + half) / step) * step;
        const v0 = Math.floor((centre[1] - half) / step) * step, v1 = Math.ceil((centre[1] + half) / step) * step;
        const seg = (a: [number, number], b: [number, number], key: string, axis: boolean) => {
          const p = P(a[0], a[1]), q = P(b[0], b[1]);
          items.push(<line key={key} x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} className={axis ? 'sk-grid axis' : 'sk-grid'} />);
        };
        for (let u = u0; u <= u1; u += step) seg([u, v0], [u, v1], 'gu' + u, u === 0);
        for (let v = v0; v <= v1; v += step) seg([u0, v], [u1, v], 'gv' + v, v === 0);
      }
      const label = (x: number, y: number, text: string, key: string) => (
        <g key={'d' + key} className={key.startsWith('live') ? 'dim live' : 'dim'} onPointerDown={e => { if (key.startsWith('live')) return; e.stopPropagation(); e.preventDefault(); props.onDimClick?.(key); }}
          onDoubleClick={e => { if (key.startsWith('len') || key.startsWith('rad')) { e.stopPropagation(); props.onDimEdit?.(key); } }}>
          <rect x={x - 26} y={y - 11} width={52} height={22} rx={4} className="dim-chip" /><text x={x} y={y + 4} textAnchor="middle" className="dim-text">{text}</text></g>);
      // A closed outline shows its kept H/V edges; while drawing, the edges that are H/V as drawn.
      const hv = isSettled(sk.shape) ? hvOf(sk.shape) : null, driving = isSettled(sk.shape) ? drivingKeys(sk.shape) : new Set<string>();
      const glyph = (a: [number, number], b: [number, number], key: string, edge?: number) => {
        const kind = hv && edge !== undefined ? (hv.h.includes(edge) ? 'H' : hv.v.includes(edge) ? 'V' : null) : a[1] === b[1] ? 'H' : a[0] === b[0] ? 'V' : null; if (!kind) return;
        const m = P((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
        items.push(<g key={'g' + key}><rect x={m[0] - 8} y={m[1] - 26} width={16} height={15} rx={3} className="cons-chip" /><text x={m[0]} y={m[1] - 15} textAnchor="middle" className="cons-text">{kind}</text></g>);
      };
      // Shapes finished earlier in this sketch (regions and holes of one profile).
      (sk.done ?? []).forEach((d, i) => items.push(<polygon key={'done' + i} points={shapeOutline(d).map(q => { const p = P(q[0], q[1]); return p[0] + ',' + p[1]; }).join(' ')} className="sk-shape done" />));
      const s = sk.shape;
      if (s?.kind === 'rectangle') {
        const [x0, x1] = [Math.min(s.a[0], s.b[0]), Math.max(s.a[0], s.b[0])], [y0, y1] = [Math.min(s.a[1], s.b[1]), Math.max(s.a[1], s.b[1])];
        const pts = [P(x0, y0), P(x1, y0), P(x1, y1), P(x0, y1)];
        items.push(<polygon key="r" points={pts.map(p => p[0] + ',' + p[1]).join(' ')} className="sk-shape" />);
        pts.forEach((p, i) => items.push(<circle key={'rp' + i} cx={p[0]} cy={p[1]} r={3} className="sk-point" />));
        if (x1 > x0 && y1 > y0) { glyph([x0, y0], [x1, y0], 'b'); glyph([x1, y0], [x1, y1], 'r'); }
        const top = P((x0 + x1) / 2, y0), side = P(x1, (y0 + y1) / 2);
        items.push(label(top[0], top[1] + 20, String(x1 - x0), 'width'), label(side[0] + 36, side[1], String(y1 - y0), 'height'));
      } else if (s?.kind === 'circle') {
        const pts = Array.from({ length: 72 }, (_, i) => P(s.c[0] + s.r * Math.cos(i / 36 * Math.PI), s.c[1] + s.r * Math.sin(i / 36 * Math.PI)));
        items.push(<polygon key="c" points={pts.map(p => p[0] + ',' + p[1]).join(' ')} className="sk-shape" />);
        const cc = P(s.c[0], s.c[1]); items.push(<circle key="cc" cx={cc[0]} cy={cc[1]} r={3} className="sk-point" />);
        const e = P(s.c[0] + s.r, s.c[1]); items.push(<line key="rl" x1={cc[0]} y1={cc[1]} x2={e[0]} y2={e[1]} className="sk-guide" />, label((cc[0] + e[0]) / 2, (cc[1] + e[1]) / 2 - 16, 'Ø' + s.r * 2, 'diameter'));
      } else if (s?.kind === 'slot') {
        const ring = s.r > 0 ? sampleSlot(s.a, s.b, s.r).map(p => P(p[0], p[1])) : [P(s.a[0], s.a[1]), P(s.b[0], s.b[1])];
        items.push(s.r > 0 ? <polygon key="sl" points={ring.map(p => p[0] + ',' + p[1]).join(' ')} className="sk-shape" />
          : <polyline key="sl" points={ring.map(p => p[0] + ',' + p[1]).join(' ')} className="sk-shape open" />);
        const a = P(s.a[0], s.a[1]), b = P(s.b[0], s.b[1]);
        items.push(<line key="slc" x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} className="sk-guide" />,
          <circle key="sa" cx={a[0]} cy={a[1]} r={3} className="sk-point" />, <circle key="sb" cx={b[0]} cy={b[1]} r={3} className="sk-point" />);
        const l = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]);
        if (l > 0) items.push(label((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 18, fmtLen(l), 'slot-length'));
        if (s.r > 0) { const e = P(s.b[0], s.b[1] + s.r); items.push(label(e[0] + 34, e[1], 'W ' + fmtLen(s.r * 2), 'slot-width')); }
      } else if (s?.kind === 'polygon') {
        const pts = s.points.map(p => P(p[0], p[1])); const cur = sketchDraft.current.cursor;
        const marks = isSettled(s) ? sketchMarks({ shape: s, done: sk.done, project: (u, v) => P(u, v), picked: sk.picked ?? [], hover: picking(sk) ? sketchDraft.current.hover ?? null : null, editDim: sk.editDim,
          onDimClick: props.onDimClick, onDimEdit: props.onDimEdit, onDimCommit: props.onDimCommit }) : null;
        const ring = sampleOutline(s.points as P2[], s.bulges, s.closed).map(p => P(p[0], p[1]));
        const line = s.closed || s.pending ? ring : cur ? [...ring, P(cur[0], cur[1])] : ring;
        items.push(s.closed ? <polygon key="pg" points={line.map(p => p[0] + ',' + p[1]).join(' ')} className="sk-shape" />
          : <polyline key="pl" points={line.map(p => p[0] + ',' + p[1]).join(' ')} className="sk-shape open" />);
        if (marks) items.push(...marks.under);
        pts.forEach((p, i) => items.push(<circle key={'p' + i} cx={p[0]} cy={p[1]} r={3.5} className="sk-point" />));
        (s.tangents ?? []).forEach(j => { const p = pts[j]; if (p) items.push(<g key={'tg' + j}><rect x={p[0] + 6} y={p[1] - 22} width={16} height={15} rx={3} className="cons-chip" /><text x={p[0] + 14} y={p[1] - 11} textAnchor="middle" className="cons-text">T</text></g>); });
        const n = s.points.length;
        for (let i = 0; i < (s.closed ? n : n - 1); i++) {
          const a = s.points[i], b = s.points[(i + 1) % n], bulge = s.bulges?.[i] ?? 0;
          if (bulge) {
            const arc = arcOf(a, b, bulge), t = arc.start + arc.sweep / 2, m = P(arc.center[0] + arc.radius * Math.cos(t), arc.center[1] + arc.radius * Math.sin(t));
            const cc = P(arc.center[0], arc.center[1]); items.push(<circle key={'ac' + i} cx={cc[0]} cy={cc[1]} r={2} className="sk-point" />);
            if (s.closed && !s.pending && !driving.has('rad' + i)) items.push(label(m[0], m[1] - 18, 'R' + fmtLen(arc.radius), 'rad' + i));
            if ((s.equalRadii ?? []).some(p => p.includes(i))) items.push(<g key={'eq' + i}><rect x={m[0] + 30} y={m[1] - 26} width={16} height={15} rx={3} className="cons-chip" /><text x={m[0] + 38} y={m[1] - 15} textAnchor="middle" className="cons-text">=</text></g>);
            if ((s.concentric ?? []).some(p => p.includes(i))) items.push(<circle key={'oc' + i} cx={cc[0]} cy={cc[1]} r={6} className="sk-guide" fill="none" />);
            continue;
          }
          glyph(a, b, 'p' + i, i);
          if (s.closed && !s.pending && !driving.has('len' + i)) { const m = P((a[0] + b[0]) / 2, (a[1] + b[1]) / 2); items.push(label(m[0], m[1] + 20, fmtLen(Math.hypot(b[0] - a[0], b[1] - a[1])), 'len' + i)); }
        }
        if (!s.closed && !s.pending && cur && n) {
          const last = s.points[n - 1];
          if (cur[0] === last[0] || cur[1] === last[1]) glyph(last, cur, 'live');
          const len = Math.hypot(cur[0] - last[0], cur[1] - last[1]); const m = P((cur[0] + last[0]) / 2, (cur[1] + last[1]) / 2);
          if (len > 0) items.push(label(m[0], m[1] + 20, (Math.round(len * 10) / 10).toString(), 'live-len'));
        }
        if (marks) { items.push(...marks.svg); editor = marks.html; }
      }
      const cur = picking(sk) ? null : sketchDraft.current.cursor;
      if (cur) { const p = P(cur[0], cur[1]); items.push(<g key="cur"><line x1={p[0] - 8} y1={p[1]} x2={p[0] + 8} y2={p[1]} className="sk-cursor" /><line x1={p[0]} y1={p[1] - 8} x2={p[0]} y2={p[1] + 8} className="sk-cursor" /></g>); }
    }
    const ml = props.measureLine;
    if (ml) {
      const a = cam.project(ml.a, w, h), b = cam.project(ml.b, w, h), mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, tw = Math.max(52, ml.label.length * 7 + 14);
      items.push(<g key="measure"><line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} className="measure-line" />
        <circle cx={a[0]} cy={a[1]} r={3.5} className="measure-point" /><circle cx={b[0]} cy={b[1]} r={3.5} className="measure-point" />
        <rect x={mx - tw / 2} y={my - 24} width={tw} height={20} rx={4} className="dim-chip" /><text x={mx} y={my - 10} textAnchor="middle" className="dim-text">{ml.label}</text></g>);
    }
    const dr = drag.current;
    if (dr.mode === 'box' && dr.x0 !== undefined) {
      const crossing = dr.x < dr.x0;
      items.push(<rect key="box" x={Math.min(dr.x0, dr.x)} y={Math.min(dr.y0!, dr.y)} width={Math.abs(dr.x - dr.x0)} height={Math.abs(dr.y - dr.y0!)} className={crossing ? 'marquee crossing' : 'marquee'} />);
    }
    // Finished sketches waiting for a feature: their outlines, the picked ones filled.
    if (!sk && props.profiles?.length) for (const p of props.profiles) {
      const rings = p.rings.map(r => r.map(v => cam.project(v, w, h)));
      items.push(<g key={'pf' + p.id} className={'profile' + (p.picked ? ' picked' : '')} data-profile={p.id}>
        {p.picked && <path d={rings.map(r => 'M' + r.map(q => q[0].toFixed(1) + ',' + q[1].toFixed(1)).join('L') + 'Z').join('')} fillRule="evenodd" className="profile-fill" />}
        {rings.map((r, k) => <polygon key={k} points={r.map(q => q[0].toFixed(1) + ',' + q[1].toFixed(1)).join(' ')} className="profile-line" />)}</g>);
    }
    // The gizmo and feature handles, and while one is dragged what the drag means.
    if (props.gizmo || props.handles?.length) {
      const g = drag.current.mode === 'gizmo' ? drag.current : null, hit = g?.hit;
      const readout = !g || !hit ? null : { at: [g.x, g.y] as [number, number], text: hit.kind === 'handle' ? (props.handles?.[hit.index] ? `${props.handles[hit.index].label} ${props.handles[hit.index].format(g.value ?? g.start ?? 0)}` : '')
        : hit.kind === 'move' ? `Δ${'XYZ'[hit.axis]} ${fmtLen(g.delta?.[hit.axis] ?? 0)} mm`
        : hit.kind === 'plane' ? hit.axes.map(a => `Δ${'XYZ'[a]} ${fmtLen(g.delta?.[a] ?? 0)}`).join('  ') + ' mm' : `${'XYZ'[hit.axis]} ${fmtLen(g.degrees ?? 0)}°` };
      items.push(...gizmoMarks(props.gizmo, props.handles ?? [], projector(), g ? hit ?? null : gizmoHot.current, readout));
    }
    // Axis triad, bottom-left, following the camera.
    const { right, up } = cam.basis(); const tx = 92, ty = h - 64;
    ['#e5534b', '#57b26b', '#4f8ff7'].forEach((color, k) => {
      const a: Vec3 = [0, 0, 0]; a[k] = 1;
      const x = a[0] * right[0] + a[1] * right[1] + a[2] * right[2], y = -(a[0] * up[0] + a[1] * up[1] + a[2] * up[2]);
      items.push(<g key={'t' + k}><line x1={tx} y1={ty} x2={tx + x * 20} y2={ty + y * 20} stroke={color} strokeWidth={2.5} strokeLinecap="round" />
        <text x={tx + x * 27} y={ty + y * 27 + 3} fontSize={9} textAnchor="middle" fill={color} fontFamily="IBM Plex Mono">{'XYZ'[k]}</text></g>);
    });
    return <><svg className="vp-overlay" width={w} height={h} aria-hidden="true">{items}</svg>{editor}</>;
  };

  return (
    <div className="viewport" data-renderer={backend ?? undefined}>
      <canvas ref={canvas} className="vp-canvas" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
        onWheel={onWheel} onContextMenu={e => e.preventDefault()} aria-label="3D viewport. Right-drag to orbit, middle-drag to pan, wheel to zoom." />
      {overlay()}
      {error && <div className="vp-error" role="alert">{error}</div>}
    </div>
  );
});

const fmtLen = (v: number) => String(Math.round(v * 10) / 10);
