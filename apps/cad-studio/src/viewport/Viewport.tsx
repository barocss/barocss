import { useEffect, useImperativeHandle, useRef, useState, forwardRef } from 'react';
import type { BodyResult } from '@barocss/cad-model/engine/evaluate';
import type { Vec3 } from '@barocss/cad-model/engine/mesh';
import { OrbitCamera } from './camera';
import { Renderer, type EdgeRef, type FaceRef, type InstanceItem, type MouldShown, type OverlayLabels, type OverlayLines, type OverlayPoints, type SectionClip, type ThemeName, type ViewRenderer, type ViewState } from './renderer';
import type { ScalarMap } from './scalarMaps';
import { GpuRenderer } from './gpuRenderer';
import type { RenderCamera, RenderSettings } from '@barocss/cad-model/engine/render';
import type { DirectDisplay } from '@barocss/cad-model/engine/direct';
import { regionMesh, type ToolRegion } from '@barocss/cad-model/app/holeRegion';
import { bulgeThrough, arcOf, sampleOutline, sampleSlot, type P2 } from '@barocss/cad-model/sketch/profile';
import { extendPreview, splitPreview, trimPreview } from '@barocss/cad-model/sketch/trim';
import { isDefaultPlane, rayOnPlane, toLocal, toWorld, type SketchPlane } from '@barocss/cad-model/sketch/plane';
import { shapeOutline } from '@barocss/cad-model/sketch/loops';
import { hvOf, isSettled, type SketchPick } from '@barocss/cad-model/sketch/rules';
import { pickSketch } from '@barocss/cad-model/sketch/select';
import { drivingKeys, sketchMarks } from '../ui/SketchMarks';
import { dragAbout, dragAlong, dragIn, dragPlane, dragScale, dragTurn, GIZMO_PX, hitTest, snapTo, type FeatureHandle, type GizmoHit, type Projector, type TransformGizmo } from './gizmo';
import { gizmoMarks } from './GizmoMarks';
import { ViewCube } from './ViewCube';
import { CAGE_LINE_KEYS, CageMarks, cageLines, cagePoints } from './CageMarks';
import { pickCage, type CageHit, type CageMode, type CageSelection, type StudioCage } from '@barocss/cad-model/subd/cageEdit';
import type { CageValidation } from '@barocss/cad';
import { modelSnaps, nearestSnap, shapeSnaps, type SnapPoint, type SnapShape } from '@barocss/cad-model/sketch/osnap';
import { splineOutline } from '@barocss/cad-model/sketch/spline';
import type { Analysis } from './analysis';

export type { SketchTool, SketchShape, SketchAnchor, SketchState, Make } from '@barocss/cad-model/sketch/types';
import type { SketchShape, SketchState } from '@barocss/cad-model/sketch/types';
export type { FeatureHandle, TransformGizmo } from './gizmo';

export interface ViewportHandle {
  /** Frames everything, or the box given (the picked bodies). */
  fit(box?: { min: Vec3; max: Vec3 }): void; setView(name: Parameters<OrbitCamera['setView']>[0]): void; toggleOrtho(): boolean; camera: OrbitCamera;
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
  /** The engine's overlay lines shown, segments a key (G7; WebGPU; for the flow). */
  overlayLines(): Record<string, number>;
  /** The engine's overlay labels' texts, a key (G15; WebGPU; for the flow). */
  overlayTexts(): Record<string, string[]>;
}

/** Where a new shape stands: a point on the ground or on an upward face, and that surface's normal. */
/** `hole`: placed at a round hole's rim — its diameter, its depth along the axis, and whether it runs through the body. */
export interface Spot { point: Vec3; normal: Vec3; hole?: { d: number; depth: number; through: boolean } }

interface Props {
  bodies: BodyResult[];
  selection: { faces: FaceRef[]; edges: EdgeRef[]; bodies: number[] };
  ghost: Set<number>;
  /** Bodies' own colours by index (StudioDoc.bodies). */
  bodyColors?: Map<number, [number, number, number]>;
  faceColors?: Map<number, Map<number, [number, number, number]>>;
  hiddenBodies?: Set<number>;
  hoverBody?: number | null;
  /** Grid step in mm for sketch points, placing and gizmo moves (0: off). */
  snapStep?: number;
  sketch: SketchState | null;
  /** Move / turn handles on the selection (see viewport/gizmo.ts), and arrows that drag one feature dimension. */
  gizmo: TransformGizmo | null;
  handles?: FeatureHandle[];
  /**
   * Placing a new shape: where it would stand under the pointer (an upward flat face, else the ground)
   * goes to `onSpot` as it moves, and `done` on a click or a drop (a command dragged from the rail).
   * `placeSkip`: keys of the bodies being placed (the preview), looked through.
   */
  placing?: boolean;
  placeSkip?: ReadonlySet<string>;
  onSpot?(spot: Spot | null, done: boolean): void;
  /** A double-click on a body's face: pick the whole body; on an edge: its chain (`onPickChain`). */
  onPickBody?(body: number): void;
  onPickChain?(body: number, edge: number): void;
  onPick(hit: { face: FaceRef | null; edge: EdgeRef | null; point: Vec3 | null; direct?: string; instance?: string; instanceFace?: FaceRef; vertex?: { body: number; at: Vec3 } }, additive: boolean): void;
  /** `fresh`: a new shape starts (the current one, if closed, is kept beside it). */
  onSketchShape(shape: SketchShape | null, fresh?: boolean): void;
  onCursor(p: Vec3 | null): void;
  onBoxSelect(bodies: number[], additive: boolean): void;
  onContextMenu(at: { x: number; y: number }, hit: { face: FaceRef | null; edge: EdgeRef | null }): void;
  onDimClick?(key: string): void;
  /** Select / Dimension tool clicks on the outline (null: empty space); opening and committing the dimension editor. */
  onSketchPick?(hit: SketchPick | null, additive: boolean): void;
  /** Trim, Extend and Split tools: a click at `at` (plane mm), `tol` mm the pick reach. */
  onSketchTrim?(op: 'trim' | 'extend' | 'split', at: [number, number], tol: number): void;
  onDimEdit?(key: string | null): void;
  onDimCommit?(key: string, value: number): void;
  /** A measured distance: a dimension line between the closest points. */
  measureLine?: { a: Vec3; b: Vec3; label: string } | null;
  /** Corners picked (shown as rings). */
  pickedVertices?: { body: number; at: Vec3 }[];
  /** What clicks pick: whatever is under the pointer, or only faces, edges or whole bodies. */
  pickFilter?: 'all' | 'face' | 'edge' | 'body';
  /** A box drawn dashed round what is picked (or the part), with its size. */
  boundsBox?: { min: Vec3; max: Vec3; label: string } | null;
  /** Render settings (the Render workspace), or null for the modelling look. */
  render?: RenderSettings | null;
  /** Bodies moved by an offset (the Render workspace's animation), by body index. */
  offsets?: Map<number, Vec3>;
  /** Bodies shown moved while a gizmo drags them (by body index; see ViewState.transforms). */
  transforms?: Map<number, Float64Array> | null;
  /** Direct curves and surfaces, and the selected ones. */
  direct?: DirectDisplay[];
  directSelection?: string[];
  /** Cosmetic thread rings (line segments). */
  threads?: Float32Array;
  /** A surface analysis look on the bodies (zebra stripes, curvature map), or none. */
  analysis?: Analysis | null;
  /** See-through regions of the tool being placed or edited (a hole's whole cylinder). */
  regions?: ToolRegion[];
  /** The selected direct object's poles (drawn as dots; a click near one picks it), and the picked one. */
  poles?: { key: string; at: Vec3 }[];
  /** A workspace map's voxel centres (RM9b), each with its manipulability as a share of the best, 0…1: dots coloured by it. */
  cloud?: { at: Vec3; t: number }[] | null;
  /** Drawings' reference underlays (O68), in the world: polylines and texts (each with its baseline and up directions), drawn thin and grey, not picked. */
  underlays?: { id: string; lines: Vec3[][]; texts: { at: Vec3; dir: Vec3; up: Vec3; text: string; height: number }[] }[];
  pickedPole?: string | null;
  onPickPole?(key: string): void;
  /** Placed instances of other parts, and the selected ones. */
  instances?: InstanceItem[];
  /** Instances shown moved (posed by the joints, exploded) by a matrix each (column-major 4 × 4), the rest as placed (G1). */
  instanceTransforms?: ReadonlyMap<string, Float64Array>;
  /** The section's clip plane on the GPU (G2): kept where dot(normal, p) ≥ offset; the part's bodies cut too, or only the placed parts. */
  clip?: SectionClip | null;
  /** Analysis maps on the bodies (G6), and the value under the pointer as it moves over them (null off them). */
  scalarMaps?: readonly ScalarMap[] | null;
  onHoverScalar?(value: number | null): void;
  /** The mould's parting loops and halves (G6), or none. */
  mould?: MouldShown | null;
  /** Isoclines drawn with the draft map (G6), or none. */
  isoclines?: readonly { points: readonly Vec3[]; closed: boolean }[] | null;
  /** A shown proposal's added and removed material (G12; WebGPU), or none. */
  proposal?: import('../engine/client').ProposalOverlay | null;
  instanceSelection?: string[];
  /** Faces of instances shown picked (mate faces). */
  instanceFaces?: { id: string; body: number; face: number }[];
  /** Finished sketches no feature uses yet (world outlines), picked ones highlighted; a click picks one (Shift: adds). */
  profiles?: { id: number; rings: Vec3[][]; picked: boolean }[];
  onPickProfile?(id: number | null, additive: boolean): void;
  /** An instance shown moved while the gizmo drags it (see assembly/drag.ts previewMatrix). */
  instancePreview?: { id: string; matrix: Float64Array } | null;
  /**
   * A SubD cage being edited (R8.2, D81): drawn over the body (edges, vertices, the selection, what its validation
   * flags), clicks pick in its mode (Shift adds), a double-click on an edge its loop (Alt: its ring).
   */
  cage?: CageOverlay | null;
  onPickCage?(hit: CageHit | null, additive: boolean, grow?: 'loop' | 'ring'): void;
}
/**
 * The overlay lines' looks (G7), as styles.css drew them in SVG; depth-tested now, their hidden parts faint (SVG drew them
 * all alike) — a measure line between two faces runs through the body.
 */
const BBOX_LOOK = { color: '#7fb2f0', width: 1.2, opacity: 0.85, dash: [5, 4] as const, hidden: 0.6 };
const MEASURE_LOOK = { width: 1.5, dash: [5, 3] as const, hidden: 0.75 };
const ACCENT_OF: Record<ThemeName, string> = { dark: '#e8c25a', light: '#c9961e' };
const UNDERLAY_LOOK = { color: '#8a93a3', width: 0.75, opacity: 0.7, hidden: 0.35 };
/** G15: the readout chips (styles.css .dim-chip and .dim-text a theme), and the underlays' texts (.underlay-text). */
const CHIP_LOOKS: Record<ThemeName, Pick<OverlayLabels, 'color' | 'chip'>> = {
  dark: { color: '#ffffff', chip: { fill: '#121315', border: '#e8c25a', padding: 4 } },
  light: { color: '#1b232c', chip: { fill: '#ffffff', border: '#c9961e', padding: 4 } },
};
const chipLook = (theme: ThemeName) => CHIP_LOOKS[theme];
const UNDERLAY_TEXT_LOOK = { color: '#8a93a3', opacity: 0.8, hidden: 0.35 };
/** An underlay text as a plane label: its height the em, the anchor its first line's baseline-left (as the SVG text had it). */
function underlayLabel(t: { at: Vec3; dir: Vec3; up: Vec3; text: string; height: number }): OverlayLabels['labels'][number] {
  const lines = Math.max(1, t.text.split('\n').length), n = (v: Vec3): Vec3 => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  // (The first baseline sits 0.925 em below the box's top of 1.25 em a line — glyphs.ts' layout.)
  return { text: t.text, at: t.at, size: t.height, align: [0, 0.74 / lines], plane: { right: n(t.dir), up: n(t.up) } };
}
const BOX_EDGES = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
/** A box's 12 edges as segments, from min and max (six numbers). */
/** The workspace map's band colours (sRGB 0–1), as the SVG's hsl(240 − 34k, 80 %, 55 %). */
const CLOUD_BANDS = Array.from({ length: 8 }, (_, k) => hslRgb(240 - k * 34, 0.8, 0.55));
function hslRgb(h: number, s: number, l: number): [number, number, number] {
  const a = s * Math.min(l, 1 - l), f = (n: number) => { const k = (n + h / 30) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
  return [f(0), f(8), f(4)];
}
/** A workspace map as overlay points (G8): a square of 3 a voxel, its band's colour, three quarters opaque. */
function cloudPoints(cloud: readonly { at: Vec3; t: number }[]): OverlayPoints {
  const P = new Float32Array(3 * cloud.length), C = new Float32Array(3 * cloud.length);
  for (let i = 0; i < cloud.length; i++) {
    const c = cloud[i], b = CLOUD_BANDS[Math.min(7, Math.floor(c.t * 8))];
    P[3 * i] = c.at[0]; P[3 * i + 1] = c.at[1]; P[3 * i + 2] = c.at[2]; C[3 * i] = b[0]; C[3 * i + 1] = b[1]; C[3 * i + 2] = b[2];
  }
  return { positions: P, colors: C, size: 3, shape: 'square', opacity: 0.75, hidden: 0.35 };
}
function boxSegments(b: readonly number[]): OverlayLines['segments'] {
  const out = new Float32Array(72);
  BOX_EDGES.forEach(([i, j], e) => { for (const [k, c] of [[0, i], [1, j]]) for (let a = 0; a < 3; a++) out[6 * e + 3 * k + a] = c & (1 << a) ? b[3 + a] : b[a]; });
  return out;
}
/** Polylines as segments. */
function polylineSegments(lines: readonly (readonly Vec3[])[]): OverlayLines['segments'] {
  let n = 0; for (const l of lines) n += Math.max(0, l.length - 1);
  const out = new Float32Array(6 * n); let o = 0;
  for (const l of lines) for (let i = 0; i + 1 < l.length; i++) { const p = l[i], q = l[i + 1]; out[o++] = p[0]; out[o++] = p[1]; out[o++] = p[2]; out[o++] = q[0]; out[o++] = q[1]; out[o++] = q[2]; }
  return out;
}

export interface CageOverlay {
  cage: StudioCage; mode: CageMode; sel: CageSelection; validation: CageValidation;
  /** The mirrored half (drawn faint), when the cage is one half. */
  mirrored?: StudioCage | null;
}


type InstanceFace = { id: string; body: number; face: number };
type Hover = { face: FaceRef | null; edge: EdgeRef | null; vertex?: { body: number; at: readonly number[] } | null };
const sameRef = (a: { body: number; face?: number; edge?: number } | null | undefined, b: { body: number; face?: number; edge?: number } | null | undefined) =>
  a === b || (!!a && !!b && a.body === b.body && a.face === b.face && a.edge === b.edge);
/** Whether two hover states pick the same face, edge and vertex (they are compared on every pointer move). */
function sameHover(a: Hover, b: Hover): boolean {
  if (!sameRef(a.face, b.face) || !sameRef(a.edge, b.edge)) return false;
  const p = a.vertex ?? null, q = b.vertex ?? null;
  return p === q || (!!p && !!q && p.body === q.body && p.at[0] === q.at[0] && p.at[1] === q.at[1] && p.at[2] === q.at[2]);
}
/** Whether two gizmo hits are the same part of the gizmo. */
function sameGizmoHit(a: GizmoHit | null, b: GizmoHit | null): boolean {
  if (a === b) return true;
  if (!a || !b || a.kind !== b.kind) return false;
  if (a.kind === 'handle') return a.index === (b as typeof a).index;
  if (a.kind === 'plane') return a.axes[0] === (b as typeof a).axes[0] && a.axes[1] === (b as typeof a).axes[1];
  return a.axis === (b as typeof a).axis;
}
function sameInstanceFaces(a: readonly InstanceFace[], b: readonly InstanceFace[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i].id !== b[i].id || a[i].body !== b[i].body || a[i].face !== b[i].face) return false;
  return true;
}

export const Viewport = forwardRef<ViewportHandle, Props>(function Viewport(props, ref) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<ViewRenderer | null>(null);
  const [backend, setBackend] = useState<'webgpu' | 'webgl2' | null>(null);
  const theme = useRef<ThemeName>('dark'), ao = useRef(true);
  /** The theme as state, for the overlay lines whose colour follows it (G7). */
  const [themeName, setThemeName] = useState<ThemeName>('dark');
  const camera = useRef(new OrbitCamera());
  const frame = useRef(0);
  const hover = useRef<{ face: FaceRef | null; edge: EdgeRef | null; vertex?: { body: number; at: Vec3 } | null }>({ face: null, edge: null });
  /** A corner of the body under the pointer within 7 px (an end of one of its edges), when the filter takes corners. */
  const vertexAt = (x: number, y: number, w: number, h: number, hit: { face: FaceRef | null; edge: EdgeRef | null }): { body: number; at: Vec3 } | null => {
    const f = propsRef.current.pickFilter ?? 'all', bi = hit.edge?.body ?? hit.face?.body;
    if (bi === undefined || f === 'face' || f === 'body') return null;
    const mesh = propsRef.current.bodies[bi]?.mesh; if (!mesh) return null;
    let best: Vec3 | null = null, d0 = 7;
    // (Each edge's two ends in turn: no pair array an edge, a pointer move at a time; PERF3 C17.)
    for (const e of mesh.edges) for (let k = 0; k < 2; k++) { const p = k ? e.b : e.a, q = camera.current.project(p as Vec3, w, h), d = Math.hypot(q[0] - x, q[1] - y); if (d < d0) { d0 = d; best = [...p] as Vec3; } }
    return best ? { body: bi, at: best } : null;
  };
  const drag = useRef<{ mode: 'orbit' | 'pan' | 'gizmo' | 'box' | null; x: number; y: number; moved: boolean; x0?: number; y0?: number;
    /** A gizmo drag: what was hit, the pointer's start and last points, and what it means so far. */
    hit?: GizmoHit; from?: [number, number]; last?: [number, number]; turned?: number; delta?: Vec3; degrees?: number; value?: number; start?: number; value2?: number; start2?: number; origin?: Vec3; factor?: number }>({ mode: null, x: 0, y: 0, moved: false });
  /** The gizmo handle under the pointer, drawn brighter. */
  const gizmoHot = useRef<GizmoHit | null>(null);
  // While the camera moves (orbit, pan, zoom), frames leave out ambient occlusion; 180 ms after the last
  // move a full frame is drawn with it, the same as before. (One function, kept for the component's life.)
  const settle = useRef(0), requestRef = useRef<() => void>(() => undefined);
  const moving = useRef(() => {
    const r = renderer.current; if (!r) return;
    r.interacting = true; window.clearTimeout(settle.current);
    settle.current = window.setTimeout(() => { if (renderer.current) { renderer.current.interacting = false; requestRef.current(); } }, 180);
  });
  const sketchDraft = useRef<{ cursor: [number, number] | null; hover?: SketchPick | null; snap?: SnapPoint | null; trim?: { kind: 'trim' | 'extend' | 'split'; points: [number, number][] } | null }>({ cursor: null });
  /** The model's snap points in the sketch plane (kept while the bodies and the plane stay). */
  const modelSnapCache = useRef<{ bodies: BodyResult[]; plane: string; points: SnapPoint[] } | null>(null);
  /** The sketch point for the pointer: an object snap within 8 px (ends, middles, centres, the origin), else the 1 mm grid. */
  const sketchSnap = (x: number, y: number, w: number, h: number, sk: SketchState, p: [number, number]): { at: [number, number]; snap: SnapPoint | null } => {
    const key = JSON.stringify(sk.plane), bodies = propsRef.current.bodies;
    if (!modelSnapCache.current || modelSnapCache.current.bodies !== bodies || modelSnapCache.current.plane !== key) modelSnapCache.current = { bodies, plane: key, points: modelSnaps(bodies.map(b => b.mesh), sk.plane) };
    const live = liveShape.current as SnapShape | null;
    const points: SnapPoint[] = [{ at: [0, 0], kind: 'origin' }, ...modelSnapCache.current.points, ...(sk.done ?? []).filter(d => !(sk.hideConstruction && d.construction)).flatMap(d => shapeSnaps(d as SnapShape)), ...(live ? shapeSnaps(live, drafting.current) : [])];
    const hit = nearestSnap(points, q => { const v = camera.current.project(toWorld(sk.plane, q), w, h); return [v[0], v[1]]; }, [x, y]);
    return hit ? { at: [Math.round(hit.at[0] * 1e4) / 1e4, Math.round(hit.at[1] * 1e4) / 1e4], snap: hit } : { at: [snap(p[0]), snap(p[1])], snap: null };
  };
  /** Plane coordinates of the sketch → canvas pixels. */
  const sketchProject = (plane: SketchPlane) => { const w = canvas.current!.clientWidth, h = canvas.current!.clientHeight; return (u: number, v: number) => camera.current.project(toWorld(plane, [u, v]), w, h); };
  const picking = (sk: SketchState | null) => sk?.tool === 'select' || sk?.tool === 'dimension';
  /** Trim, Extend and Split: a click edits the piece under it (no snapping). */
  const cutting = (sk: SketchState | null) => sk?.tool === 'trim' || sk?.tool === 'extend' || sk?.tool === 'split';
  /** The trim tool's reach: 8 pixels on the sketch plane, in mm. */
  const trimReach = (x: number, y: number, w: number, h: number, sk: SketchState) => { const a = sketchPoint(x, y, w, h, sk.plane), b = sketchPoint(x + 8, y, w, h, sk.plane); return a && b ? Math.hypot(b[0] - a[0], b[1] - a[1]) : 1; };
  const sketchShapesOf = (sk: SketchState) => [...(sk.done ?? []), ...(sk.shape ? [sk.shape] : [])];
  const [, setTick] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const propsRef = useRef(props); propsRef.current = props;
  /** The grid step (mm) points snap to: the studio's setting (0: off, to a micrometre). */
  const snap = (v: number) => { const st = propsRef.current.snapStep ?? 1; return st > 0 ? Math.round(Math.round(v / st) * st * 1000) / 1000 : Math.round(v * 1000) / 1000; };
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
    transforms: propsRef.current.transforms ?? undefined, ghostBodies: propsRef.current.ghost, bodyColors: propsRef.current.bodyColors, faceColors: propsRef.current.faceColors, hiddenBodies: propsRef.current.hiddenBodies, hoverBody: propsRef.current.hoverBody ?? undefined,
  });

  /** Turns the camera (eased, about a quarter second) to look at the target from direction `from`. */
  const turning = useRef(0);
  const lookFrom = (from: Vec3) => {
    const c = camera.current, y0 = c.yaw, p0 = c.pitch, lim = Math.PI / 2 - 0.0002;
    const pitch = Math.max(-lim, Math.min(lim, Math.asin(Math.max(-1, Math.min(1, from[2]))))), flat = Math.hypot(from[0], from[1]);
    let dy = (flat > 1e-6 ? Math.atan2(from[1], from[0]) : y0) - y0; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    const t0 = performance.now(), id = ++turning.current;
    const step = () => {
      if (id !== turning.current) return;
      const t = Math.min(1, (performance.now() - t0) / 260), e = 1 - (1 - t) ** 3;
      c.yaw = y0 + dy * e; c.pitch = p0 + (pitch - p0) * e; request();
      if (t < 1) requestAnimationFrame(step);
    };
    step();
  };
  const request = () => {
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      const r = renderer.current; if (!r) return;
      r.render(camera.current, viewState());
      setTick(t => t + 1);
    });
  };
  requestRef.current = request;

  // WebGPU (the @barocss/gpu viewer) when the browser has it, else WebGL2; ?renderer=webgl2 forces the latter.
  useEffect(() => {
    let live = true, observer: ResizeObserver | null = null;
    const start = (r: ViewRenderer, name: 'webgpu' | 'webgl2') => {
      if (!live) { r.dispose?.(); return; }
      renderer.current = r; r.setTheme(theme.current); r.aoEnabled = ao.current; r.setRequestHost?.(() => requestRef.current());
      observer = new ResizeObserver(request); observer.observe(canvas.current!);
      setBackend(name);
    };
    const webgl = () => { try { start(new Renderer(canvas.current!), 'webgl2'); } catch (e) { setError(String(e)); } };
    const forced = new URLSearchParams(location.search).get('renderer');
    if (forced !== 'webgl2' && 'gpu' in navigator) GpuRenderer.create(canvas.current!).then(r => start(r, 'webgpu'), webgl);
    else webgl();
    return () => { live = false; observer?.disconnect(); renderer.current?.dispose?.(); renderer.current = null; };
  }, []);
  // A new pixel ratio (the window on another screen, the page zoomed) draws again at the new resolution.
  useEffect(() => {
    let query: MediaQueryList | null = null;
    const watch = () => { query?.removeEventListener('change', changed); query = matchMedia(`(resolution: ${devicePixelRatio}dppx)`); query.addEventListener('change', changed); };
    const changed = () => { watch(); request(); };
    watch(); addEventListener('resize', request);
    return () => { query?.removeEventListener('change', changed); removeEventListener('resize', request); };
  }, []);

  useEffect(() => {
    const r = renderer.current; if (!r) return;
    r.setBodies(props.bodies);
    if (!fitted.current && props.bodies.length) { const b = r.bounds(); if (b) { camera.current.aspect = canvas.current!.clientWidth / Math.max(1, canvas.current!.clientHeight); camera.current.fit(b.min, b.max); fitted.current = true; } }
    r.setState(viewState()); request();
  }, [props.bodies, backend]);

  useEffect(() => { renderer.current?.setState(viewState()); request(); }, [props.selection, props.ghost, props.offsets, props.transforms, props.bodyColors, props.faceColors, props.hiddenBodies, props.hoverBody]);
  // (Handles and gizmos are new objects on every render of the app: drawn again only when they move.)
  const shapeOf = (v: unknown) => JSON.stringify(v, (_k, x) => typeof x === 'function' ? undefined : x);
  const overlayKey = shapeOf([props.gizmo, props.handles]);
  useEffect(() => { request(); }, [props.sketch, overlayKey]);
  useEffect(() => { renderer.current?.setRender?.(props.render ?? null); request(); }, [props.render, backend]);
  useEffect(() => { renderer.current?.setAnalysis?.(props.analysis ?? null); request(); }, [typeof props.analysis === 'object' && props.analysis ? `${props.analysis.sinLimit}:${props.analysis.bedZ}` : props.analysis, backend]);
  useEffect(() => { renderer.current?.setThreads?.(props.threads ?? new Float32Array()); request(); }, [props.threads, backend]);
  useEffect(() => { renderer.current?.setRegions?.(props.regions?.length ? regionMesh(props.regions) : null); request(); }, [props.regions, backend]);
  useEffect(() => { renderer.current?.setDirect?.(props.direct ?? [], props.directSelection ?? []); request(); }, [props.direct, props.directSelection, backend]);
  useEffect(() => { renderer.current?.setInstances?.(props.instances ?? [], props.instanceSelection ?? []); request(); }, [props.instances, props.instanceSelection, backend]);
  useEffect(() => { renderer.current?.setInstancePreview?.(props.instancePreview ?? null); request(); }, [props.instancePreview, backend]);
  useEffect(() => { renderer.current?.setInstanceTransforms?.(props.instanceTransforms ?? null); request(); }, [props.instanceTransforms, backend]);
  useEffect(() => { renderer.current?.setClip?.(props.clip ?? null); request(); }, [props.clip, backend]);
  useEffect(() => { renderer.current?.setScalarMaps?.(props.scalarMaps ?? null); request(); }, [props.scalarMaps, backend]);
  useEffect(() => { renderer.current?.setMould?.(props.mould ?? null); request(); }, [props.mould, backend]);
  useEffect(() => { renderer.current?.setIsoclines?.(props.isoclines ?? null); request(); }, [props.isoclines, backend]);
  useEffect(() => { renderer.current?.setProposalOverlay?.(props.proposal ?? null); request(); }, [props.proposal, backend]);
  // G7: the bounding box, the measure line, the underlays' polylines and the SubD cage's edges as engine lines on WebGPU —
  // made when they change (keyed by their content: the App hands new objects each render), not projected every frame;
  // WebGL2 keeps them SVG. Their looks as styles.css drew them.
  const sketching = !!props.sketch, bb = props.boundsBox, bbKey = bb && !sketching ? [...bb.min, ...bb.max].join(',') : '';
  useEffect(() => {
    const r = renderer.current; if (!r?.setOverlayLines) return;
    r.setOverlayLines('bbox', bbKey ? { segments: boxSegments(bbKey.split(',').map(Number)), ...BBOX_LOOK } : null); request();
  }, [bbKey, backend]);
  const ml = props.measureLine, mlKey = ml ? [...ml.a, ...ml.b].join(',') : '';
  useEffect(() => {
    const r = renderer.current; if (!r?.setOverlayLines) return;
    r.setOverlayLines('measure', mlKey ? { segments: mlKey.split(',').map(Number), ...MEASURE_LOOK, color: ACCENT_OF[themeName] } : null); request();
  }, [mlKey, themeName, backend]);
  // G15: the box's size and the measure's readout as chips (the SVG's colours a theme), engine labels on WebGPU — over the
  // scene at full strength, as the SVG drew them (G15-D2: a readout anchored between two faces is inside the body).
  const bbLabel = bb && !sketching ? bb.label : '';
  useEffect(() => {
    const r = renderer.current; if (!r?.setOverlayLabels) return;
    const b = bbKey ? bbKey.split(',').map(Number) : null;
    // (Above the box in the world — 0.4 of its diagonal over its top's centre, clear of its far corner — as the SVG chip sat above it on screen.)
    const lift = b ? 0.4 * Math.hypot(b[3] - b[0], b[4] - b[1], b[5] - b[2]) : 0;
    r.setOverlayLabels('bbox:label', b ? { labels: [{ text: bbLabel, at: [(b[0] + b[3]) / 2, (b[1] + b[4]) / 2, b[5] + lift], size: 12, align: [0.5, 1], offset: [0, -4] }], ...chipLook(themeName), over: true } : null); request();
  }, [bbKey, bbLabel, themeName, backend]);
  const mlLabel = ml ? ml.label : '';
  useEffect(() => {
    const r = renderer.current; if (!r?.setOverlayLabels) return;
    const m = mlKey ? mlKey.split(',').map(Number) : null;
    r.setOverlayLabels('measure:label', m ? { labels: [{ text: mlLabel, at: [(m[0] + m[3]) / 2, (m[1] + m[4]) / 2, (m[2] + m[5]) / 2], size: 12, align: [0.5, 1], offset: [0, -8] }], ...chipLook(themeName), over: true } : null); request();
  }, [mlKey, mlLabel, themeName, backend]);
  const underlayKeys = useRef<string[]>([]);
  useEffect(() => {
    const r = renderer.current; if (!r?.setOverlayLines) return;
    const keys: string[] = [];
    if (!sketching) for (const u of props.underlays ?? []) {
      keys.push('underlay:' + u.id); r.setOverlayLines('underlay:' + u.id, { segments: polylineSegments(u.lines), ...UNDERLAY_LOOK });
      // (Its texts on the drawing's plane at their height, G15: anchored at the first line's baseline-left, as SVG set them.)
      if (r.setOverlayLabels && u.texts.length) { keys.push('underlay:text:' + u.id); r.setOverlayLabels('underlay:text:' + u.id, { labels: u.texts.map(underlayLabel), ...UNDERLAY_TEXT_LOOK }); }
    }
    for (const k of underlayKeys.current) if (!keys.includes(k)) { if (k.startsWith('underlay:text:')) r.setOverlayLabels?.(k, null); else r.setOverlayLines(k, null); }
    underlayKeys.current = keys; request();
  }, [props.underlays, sketching, backend]);
  useEffect(() => {
    const r = renderer.current; if (!r?.setOverlayLines) return;
    const lines = props.cage && !sketching ? cageLines(props.cage) : [], points = props.cage && !sketching && r.setOverlayPoints ? cagePoints(props.cage) : [];
    for (const k of CAGE_LINE_KEYS) if (!lines.some(l => l[0] === k) && !points.some(p => p[0] === k)) r.setOverlayLines(k, null);
    for (const [k, l] of lines) r.setOverlayLines(k, l);
    for (const [k, p] of points) r.setOverlayPoints!(k, p);
    request();
  }, [props.cage, sketching, backend]);
  // G8: the workspace map's voxels as engine points (squares of 3, their band's colour), depth-tested with their hidden
  // ones faint, made when the map changes; SVG on WebGL2.
  useEffect(() => {
    const r = renderer.current; if (!r?.setOverlayPoints) return;
    r.setOverlayPoints('cloud', props.cloud?.length && !sketching ? cloudPoints(props.cloud) : null); request();
  }, [props.cloud, sketching, backend]);
  // (By content: the list is rebuilt on every render; the last one is kept while its content is the same.)
  const instanceFacesRef = useRef<readonly InstanceFace[]>([]);
  if (!sameInstanceFaces(instanceFacesRef.current, props.instanceFaces ?? [])) instanceFacesRef.current = props.instanceFaces ?? [];
  const instanceFaces = instanceFacesRef.current;
  useEffect(() => { renderer.current?.setInstanceFaces?.([...instanceFaces]); request(); }, [instanceFaces, props.instances, backend]);

  useImperativeHandle(ref, () => ({
    camera: camera.current,
    fit(box) { const b = box ?? renderer.current?.bounds(); if (b) camera.current.fit(b.min, b.max); request(); },
    setView(name) { camera.current.setView(name); const b = renderer.current?.bounds(); if (b) camera.current.fit(b.min, b.max); request(); },
    frameSketch(min, max, plane, insets = { left: 0, right: 0 }) {
      const w = Math.max(1, canvas.current!.clientWidth), h = Math.max(1, canvas.current!.clientHeight);
      camera.current.aspect = w / h; camera.current.faceNormal(plane.normal);
      camera.current.frameAt(toWorld(plane, [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2]), [max[0] - min[0], max[1] - min[1]], insets.left / w, insets.right / w); request();
    },
    toggleOrtho() { camera.current.ortho = !camera.current.ortho; request(); return camera.current.ortho; },
    setTheme(name) { theme.current = name; setThemeName(name); renderer.current?.setTheme(name); request(); },
    setAo(on) { ao.current = on; if (renderer.current) renderer.current.aoEnabled = on; request(); },
    capture() { return renderer.current?.capture ? renderer.current.capture() : Promise.resolve(null); },
    getCamera() { const c = camera.current; return { target: [...c.target] as [number, number, number], distance: c.distance, yaw: c.yaw, pitch: c.pitch, fovY: c.fovY, ortho: c.ortho }; },
    setCamera(v) { const c = camera.current; c.target = [...v.target] as Vec3; c.distance = v.distance; c.yaw = v.yaw; c.pitch = v.pitch; c.fovY = v.fovY; c.ortho = v.ortho; request(); },
    get backend() { return backend; },
    overlayLines() { return renderer.current?.overlayLines?.() ?? {}; },
    overlayTexts() { return renderer.current?.overlayTexts?.() ?? {}; },
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
    const under = r.pickFace(x, y, camera.current, viewState()), filter = propsRef.current.pickFilter ?? 'all';
    // The selection filter: faces (or bodies) only, edges only, or whichever is under the pointer.
    if (filter === 'face' || filter === 'body') return { face: under, edge: null };
    const edge = r.pickEdge(x, y, camera.current, viewState(), under ? 4 : 6);
    return filter === 'edge' ? { face: null, edge } : { face: edge ? null : under, edge };
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
  /** The nearest face under a pixel among the bodies not in `skip` (a ray through their triangles). */
  const pickThrough = (x: number, y: number, w: number, h: number, skip: ReadonlySet<string>): FaceRef | null => {
    const { origin: o, dir: d } = camera.current.ray((x / w) * 2 - 1, 1 - (y / h) * 2);
    let best: FaceRef | null = null, tBest = Infinity;
    propsRef.current.bodies.forEach((b, bi) => {
      if (skip.has(b.key) || propsRef.current.hiddenBodies?.has(bi)) return;
      const { min, max } = b.mesh.bounds; let t0 = 0, t1 = tBest;
      for (let k = 0; k < 3; k++) { if (Math.abs(d[k]) < 1e-12) { if (o[k] < min[k] || o[k] > max[k]) return; continue; } let a = (min[k] - o[k]) / d[k], c = (max[k] - o[k]) / d[k]; if (a > c) [a, c] = [c, a]; t0 = Math.max(t0, a); t1 = Math.min(t1, c); if (t0 > t1) return; }
      const P = b.mesh.positions, I = b.mesh.indices;
      for (let t = 0; t < I.length; t += 3) {
        const i0 = I[t] * 3, i1 = I[t + 1] * 3, i2 = I[t + 2] * 3;
        const e1 = [P[i1] - P[i0], P[i1 + 1] - P[i0 + 1], P[i1 + 2] - P[i0 + 2]], e2 = [P[i2] - P[i0], P[i2 + 1] - P[i0 + 1], P[i2 + 2] - P[i0 + 2]];
        const q = [d[1] * e2[2] - d[2] * e2[1], d[2] * e2[0] - d[0] * e2[2], d[0] * e2[1] - d[1] * e2[0]], det = e1[0] * q[0] + e1[1] * q[1] + e1[2] * q[2];
        if (Math.abs(det) < 1e-12) continue;
        const sv = [o[0] - P[i0], o[1] - P[i0 + 1], o[2] - P[i0 + 2]], u = (sv[0] * q[0] + sv[1] * q[1] + sv[2] * q[2]) / det; if (u < 0 || u > 1) continue;
        const r2 = [sv[1] * e1[2] - sv[2] * e1[1], sv[2] * e1[0] - sv[0] * e1[2], sv[0] * e1[1] - sv[1] * e1[0]], v = (d[0] * r2[0] + d[1] * r2[1] + d[2] * r2[2]) / det; if (v < 0 || u + v > 1) continue;
        const tt = (e2[0] * r2[0] + e2[1] * r2[1] + e2[2] * r2[2]) / det;
        if (tt > 1e-6 && tt < tBest) { tBest = tt; best = { body: bi, face: b.mesh.faceOfVertex[I[t]] }; }
      }
    });
    return best;
  };
  /** Where a shape being placed stands under a pixel (to 1 mm): an upward face, else the plane last stood on, else the ground. */
  const lastSpot = useRef<Spot | null>(null);
  const spotAt = (x: number, y: number, w: number, h: number): Spot | null => {
    const r = renderer.current; if (!r) return null;
    const p = propsRef.current;
    let face = r.pickFace(x, y, camera.current, viewState());
    // The shape being placed is looked through (to the hole or face behind it), unless it is fitted to a hole.
    if (face && p.placeSkip?.has(p.bodies[face.body]?.key) && !lastSpot.current?.hole) face = pickThrough(x, y, w, h, p.placeSkip) ?? face;
    const body = face ? p.bodies[face.body] : undefined, f = body?.mesh.faces[face!.face];
    const mm = snap;
    let spot: Spot | null = null;
    if (f && body && !p.placeSkip?.has(body.key)) {
      // A flat face facing along X, Y or Z: the point on it (to 1 mm across it), and its normal.
      const k = f.kind === 'plane' ? [0, 1, 2].find(i => Math.abs(Math.abs(f.normal[i]) - 1) < 1e-6) : undefined;
      if (k !== undefined) { const q = surfacePoint(x, y, w, h, face); if (q) { const n: Vec3 = [0, 0, 0]; n[k] = Math.sign(f.normal[k]); spot = { point: q.map((v, i) => i === k ? Math.round(v * 1000) / 1000 : mm(v)) as Vec3, normal: n }; } }
      // Over an upright round hole (or boss): its axis, at its upper rim — a bolt goes straight in.
      // Over a round hole (or boss) along X, Y or Z: its axis, at the rim nearer the eye, facing out — a bolt goes straight in.
      else if (f.kind === 'curved' && f.radius !== undefined) {
        const c = roundAxis(body.mesh, face!.face, f.radius);
        if (c) {
          const eye = camera.current.eye(), mid = [0, 1, 2].map(i => (c.lo[i] + c.hi[i]) / 2) as Vec3, up = eye[c.k] >= mid[c.k] ? 1 : -1;
          const point = [...mid] as Vec3; point[c.k] = up > 0 ? c.hi[c.k] : c.lo[c.k];
          const n: Vec3 = [0, 0, 0]; n[c.k] = up; spot = { point, normal: n, ...(c.hole ? { hole: { d: Math.round(f.radius * 2000) / 1000, depth: Math.round((c.hi[c.k] - c.lo[c.k]) * 1000) / 1000, through: up > 0 ? c.through.lo : c.through.hi } } : {}) };
        }
      }
    } else if (f && lastSpot.current?.hole) {
      // Over the shape fitted to a hole: it stays in that hole (moving off the shape lets it go).
      spot = lastSpot.current;
    } else if (f && lastSpot.current) {
      // Over the shape itself: stay on the surface it stands on (no jumping between it and what is behind).
      const ls = lastSpot.current, k = ls.normal.findIndex(v => v !== 0), { origin, dir } = camera.current.ray((x / w) * 2 - 1, 1 - (y / h) * 2);
      if (Math.abs(dir[k]) > 1e-6) { const t = (ls.point[k] - origin[k]) / dir[k]; if (t > 0) spot = { point: [0, 1, 2].map(i => i === k ? ls.point[k] : mm(origin[i] + dir[i] * t)) as Vec3, normal: ls.normal }; }
    }
    if (!spot) { const q = planePoint(x, y, w, h, 0); if (q) spot = { point: [mm(q[0]), mm(q[1]), 0], normal: [0, 0, 1] }; }
    lastSpot.current = spot;
    return spot;
  };
  /**
   * A round hole's (or boss's) axis along X, Y or Z, when its vertices span a full circle of `r` across it:
   * its middle, both ends along the axis, and which axis.
   */
  type RoundAxis = { lo: Vec3; hi: Vec3; k: number; hole: boolean; through: { lo: boolean; hi: boolean } };
  const roundAxes = useRef(new WeakMap<object, Map<number, RoundAxis | null>>());
  const roundAxis = (mesh: BodyResult['mesh'], face: number, r: number): RoundAxis | null => {
    let byFace = roundAxes.current.get(mesh); if (!byFace) roundAxes.current.set(mesh, byFace = new Map());
    if (byFace.has(face)) return byFace.get(face)!;
    const lo: Vec3 = [Infinity, Infinity, Infinity], hi: Vec3 = [-Infinity, -Infinity, -Infinity];
    for (let v = 0; v < mesh.faceOfVertex.length; v++) if (mesh.faceOfVertex[v] === face) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], mesh.positions[v * 3 + k]); hi[k] = Math.max(hi[k], mesh.positions[v * 3 + k]); }
    const across = (k: number) => Math.abs(hi[k] - lo[k] - 2 * r) < 0.02 * r + 1e-3;
    const k = [2, 0, 1].find(a => [0, 1, 2].filter(i => i !== a).every(across)), round = (v: number) => Math.round(v * 1000) / 1000;
    if (k === undefined) { byFace.set(face, null); return null; }
    const P = mesh.positions, mid = [0, 1, 2].map(i => (lo[i] + hi[i]) / 2);
    // A hole, not a boss: its wall's normals point in to the axis.
    let v0 = 0; while (v0 < mesh.faceOfVertex.length && mesh.faceOfVertex[v0] !== face) v0++;
    const hole = [0, 1, 2].reduce((t, i) => i === k ? t : t + mesh.normals[v0 * 3 + i] * (P[v0 * 3 + i] - mid[i]), 0) < 0;
    // Through at an end when no face of the body closes it there: no triangle across the axis at that end.
    const closed = (at: number) => {
      const [a, b] = [0, 1, 2].filter(i => i !== k), I = mesh.indices, q = [mid[a], mid[b]];
      for (let t = 0; t < I.length; t += 3) {
        const tri = [I[t], I[t + 1], I[t + 2]];
        if (!tri.every(v => Math.abs(P[v * 3 + k] - at) < 1e-4)) continue;
        const [p0, p1, p2] = tri.map(v => [P[v * 3 + a], P[v * 3 + b]]), side = (u: number[], w: number[]) => (w[0] - u[0]) * (q[1] - u[1]) - (w[1] - u[1]) * (q[0] - u[0]);
        const s0 = side(p0, p1), s1 = side(p1, p2), s2 = side(p2, p0);
        if ((s0 >= 0 && s1 >= 0 && s2 >= 0) || (s0 <= 0 && s1 <= 0 && s2 <= 0)) return true;
      }
      return false;
    };
    const out = { lo: lo.map(round) as Vec3, hi: hi.map(round) as Vec3, k, hole, through: { lo: hole && !closed(lo[k]), hi: hole && !closed(hi[k]) } };
    byFace.set(face, out); return out;
  };
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
      // An arc adds up the angle swept round its centre step by step; an arrow measures mm along it.
      if (hd.plane) { const [u, v] = dragIn(d.from!, [x, y], hd.at, hd.dir, hd.plane.dir2, P); d.value = hd.toValue(d.start!, u); d.value2 = hd.plane.toValue2(d.start2!, v); hd.onDrag(d.value, done, d.value2); return; }
      if (hd.arc) { d.turned = (d.turned ?? 0) + dragAbout(d.last!, [x, y], hd.arc.centre, hd.arc.axis, P); d.last = [x, y]; d.value = hd.toValue(d.start!, d.turned); }
      else d.value = hd.toValue(d.start!, dragAlong(d.from!, [x, y], hd.at, hd.dir, P));
      hd.onDrag(d.value, done); return;
    }
    if (!g) return;
    if (hit.kind === 'move' || hit.kind === 'plane') {
      const grid = propsRef.current.snapStep ?? 1, delta: Vec3 = [0, 0, 0], step = shift ? Math.max(0.001, (grid || 1) / 10) : grid || 0.001;
      // (Measured from the gizmo where the drag began: it moves with the selection meanwhile.)
      const o = d.origin ?? g.origin;
      if (hit.kind === 'plane') { const [u, v] = dragPlane(d.from!, [x, y], o, hit.axes, P); delta[hit.axes[0]] = snapTo(u, step); delta[hit.axes[1]] = snapTo(v, step); }
      else { const dir: Vec3 = [0, 0, 0]; dir[hit.axis] = 1; delta[hit.axis] = snapTo(dragAlong(d.from!, [x, y], o, dir, P), step); }
      d.delta = delta; g.onMove?.(delta, done); return;
    }
    if (hit.kind === 'scale') {
      const k = dragScale(d.from!, [x, y], d.origin ?? g.origin, hit.axis, P), step = shift ? 0.01 : 0.05;
      d.factor = Math.max(step, Math.round(k / step) * step); g.onScale?.(d.factor, done); return;
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
      const hd = hit.kind === 'handle' ? propsRef.current.handles![hit.index] : undefined;
      drag.current = { mode: 'gizmo', x, y, moved: false, hit, from: [x, y], last: [x, y], turned: 0, start: hd?.value, start2: hd?.plane?.value2, origin: propsRef.current.gizmo ? [...propsRef.current.gizmo.origin] as Vec3 : undefined };
      return;
    }
    if (e.button === 2 && !e.shiftKey) drag.current = { mode: 'orbit', x, y, moved: false };
    else if (e.button === 1 || (e.button === 2 && e.shiftKey)) drag.current = { mode: 'pan', x, y, moved: false };
    else if (e.button === 0 && e.altKey) drag.current = { mode: 'orbit', x, y, moved: false };
    else drag.current = { mode: null, x, y, moved: false, x0: x, y0: y };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const { x, y, w, h } = local(e); const d = drag.current; const r = renderer.current; if (!r) return;
    if (d.mode === 'orbit') { camera.current.orbit(x - d.x, y - d.y); d.x = x; d.y = y; d.moved = true; moving.current(); request(); return; }
    if (d.mode === 'pan') { camera.current.pan(x - d.x, y - d.y, h); d.x = x; d.y = y; d.moved = true; moving.current(); request(); return; }
    if (d.mode === 'gizmo') { gizmoDrag(x, y, e.shiftKey, false); d.moved = true; request(); return; }
    if (!d.mode && !sk0()) {
      const hot = gizmoHit(x, y);
      if (!sameGizmoHit(hot, gizmoHot.current)) { gizmoHot.current = hot; request(); }
      if (hot) { canvas.current!.style.cursor = 'grab'; return; }
      canvas.current!.style.cursor = '';
    }
    const sk = propsRef.current.sketch;
    if (!sk && e.buttons === 1 && d.x0 !== undefined && (d.mode === 'box' || Math.hypot(x - d.x0, y - d.y0!) > 5)) {
      d.mode = 'box'; d.x = x; d.y = y; d.moved = true; request(); return;
    }
    if (sk) {
      const p = sketchPoint(x, y, w, h, sk.plane), at = p && !picking(sk) && !cutting(sk) ? sketchSnap(x, y, w, h, sk, p) : null;
      sketchDraft.current.cursor = at ? at.at : p ? [snap(p[0]), snap(p[1])] : null; sketchDraft.current.snap = at?.snap ?? null;
      propsRef.current.onCursor(sketchDraft.current.cursor ? toWorld(sk.plane, sketchDraft.current.cursor) : null);
      const s = liveShape.current; const c = sketchDraft.current.cursor;
      if (sk.tool !== 'carc') carc.current = null;
      if (sk.tool !== 'spline') splineFit.current = null;
      else if (splineFit.current?.length && c) { const o = splineOutline([...splineFit.current, c], false); emit({ kind: 'polygon', points: o.points, bulges: o.bulges, closed: false }); }
      if (picking(sk)) sketchDraft.current.hover = isSettled(s) ? pickSketch(s, sketchProject(sk.plane), x, y, sk.done) : null;
      else if (sk.tool === 'carc') {
        const d = carc.current;
        if (d && c) {
          d.cursor = c;
          if (d.a) {
            // How far it has turned: the pointer's angle about the centre, followed step by step (either way round).
            const t = Math.atan2(c[1] - d.c[1], c[0] - d.c[0]); let dt = t - (d.last ?? t);
            if (dt > Math.PI) dt -= 2 * Math.PI; if (dt < -Math.PI) dt += 2 * Math.PI;
            d.sweep = Math.max(-2 * Math.PI + 1e-3, Math.min(2 * Math.PI - 1e-3, d.sweep + dt)); d.last = t;
          }
        }
      }
      else if (cutting(sk)) {
        const all = sketchShapesOf(sk), q: [number, number] | null = p ? [p[0], p[1]] : null, tol = trimReach(x, y, w, h, sk), kind = sk.tool as 'trim' | 'extend' | 'split';
        const points = !q ? null : kind === 'trim' ? trimPreview(all, q, tol) : kind === 'extend' ? extendPreview(all, q, tol) : (pt => pt ? [pt] : null)(splitPreview(all, q, tol));
        sketchDraft.current.trim = points ? { kind, points } : null;
      }
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
    if (propsRef.current.placing && !d.mode) { propsRef.current.onSpot?.(spotAt(x, y, w, h), false); return; }
    const { face, edge } = pickAt(r, x, y);
    const prev = hover.current;
    const vertex = vertexAt(x, y, w, h, { face, edge });
    const next = { face: edge || vertex ? null : face, edge: vertex ? null : edge, vertex };
    if (!sameHover(prev, next)) { hover.current = next; r.setState(viewState()); request(); }
    const point = surfacePoint(x, y, w, h, face) ?? planePoint(x, y, w, h, 0);
    propsRef.current.onCursor(point);
    // (G6: the map's value under the pointer, for its legend.)
    if (propsRef.current.onHoverScalar) propsRef.current.onHoverScalar(r.scalarAt?.(x, y, camera.current) ?? null);
  };

  const drafting = useRef(false);
  const slotStage = useRef(0);
  /** The centre arc being drawn: its centre, then its start and how far it has turned (signed, radians). */
  /** The Spline tool's points so far (the curve through them is drawn as tangent arcs). */
  const splineFit = useRef<[number, number][] | null>(null);
  const carc = useRef<{ c: [number, number]; a?: [number, number]; last?: number; sweep: number; cursor?: [number, number] } | null>(null);
  const carcEnd = (d: NonNullable<typeof carc.current>): [number, number] => {
    const r = Math.hypot(d.a![0] - d.c[0], d.a![1] - d.c[1]), t = Math.atan2(d.a![1] - d.c[1], d.a![0] - d.c[0]) + d.sweep, r6 = (v: number) => Math.round(v * 1e6) / 1e6;
    return [r6(d.c[0] + r * Math.cos(t)), r6(d.c[1] + r * Math.sin(t))];
  };
  /** The pointer left the canvas (for a panel or the toolbar, say): what it hovered is no longer hovered. */
  const onPointerLeave = () => {
    const r = renderer.current, prev = hover.current;
    if (!r || drag.current.mode || (!prev.face && !prev.edge && !prev.vertex)) return;
    hover.current = { face: null, edge: null, vertex: null }; r.setState(viewState()); request();
  };
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
    if (propsRef.current.placing) { propsRef.current.onSpot?.(spotAt(x, y, w, h), true); return; }
    // A cage being edited takes the click (a miss clears its selection; the body under it is not picked).
    const cg = propsRef.current.cage;
    if (cg) { propsRef.current.onPickCage?.(pickCage(cg.cage, p => camera.current.project(p as Vec3, w, h), x, y, cg.mode), e.shiftKey); request(); return; }
    const sk = propsRef.current.sketch;
    if (sk) {
      const p = sketchPoint(x, y, w, h, sk.plane); if (!p) return;
      const c: [number, number] = picking(sk) ? [snap(p[0]), snap(p[1])] : sketchSnap(x, y, w, h, sk, p).at;
      const s = liveShape.current;
      if (picking(sk)) { propsRef.current.onSketchPick?.(isSettled(s) ? pickSketch(s, sketchProject(sk.plane), x, y, sk.done) : null, e.shiftKey); return; }
      if (cutting(sk)) { propsRef.current.onSketchTrim?.(sk.tool as 'trim' | 'extend' | 'split', [p[0], p[1]], trimReach(x, y, w, h, sk)); sketchDraft.current.trim = null; return; }
      if (sk.tool === 'spline') {
        // Its points so far, the curve through them redrawn (closed when the first point is clicked again).
        const fit = splineFit.current ?? [], fresh = !fit.length;
        if (fit.length >= 3 && c[0] === fit[0][0] && c[1] === fit[0][1]) { const o = splineOutline(fit, true); emit({ kind: 'polygon', points: o.points, bulges: o.bulges, closed: true }); splineFit.current = null; request(); return; }
        if (fit.length && c[0] === fit[fit.length - 1][0] && c[1] === fit[fit.length - 1][1]) return;
        splineFit.current = [...fit, c];
        const o = splineOutline(splineFit.current, false); emit({ kind: 'polygon', points: o.points, bulges: o.bulges, closed: false }, fresh); request(); return;
      }
      if (sk.tool === 'carc') {
        const d = carc.current;
        if (!d) carc.current = { c, sweep: 0, cursor: c };
        else if (!d.a) { if (c[0] !== d.c[0] || c[1] !== d.c[1]) carc.current = { ...d, a: c, last: Math.atan2(c[1] - d.c[1], c[0] - d.c[0]), sweep: 0 }; }
        else if (Math.abs(d.sweep) > 1e-3) {
          // The end where clicked (on the circle at its angle), turned the way the pointer went round.
          const a0 = Math.atan2(d.a[1] - d.c[1], d.a[0] - d.c[0]), t = Math.atan2(c[1] - d.c[1], c[0] - d.c[0]), sg = Math.sign(d.sweep);
          let sw = ((sg * (t - a0)) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
          while (sw + 2 * Math.PI < Math.abs(d.sweep) + Math.PI) sw += 2 * Math.PI;
          if (sw < 1e-3 || sw > 2 * Math.PI - 1e-3) { request(); return; }
          d.sweep = sg * sw;
          const e = carcEnd(d); carc.current = null;
          emit({ kind: 'polygon', points: [d.a, e], bulges: [Math.round(Math.tan(d.sweep / 4) * 1e9) / 1e9, 0], closed: false }, true);
        }
        request(); return;
      }
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
    const poles = propsRef.current.poles;
    if (poles?.length) {
      let best: string | null = null, d0 = 8;
      for (const p of poles) { const q = camera.current.project(p.at, w, h), d = Math.hypot(q[0] - x, q[1] - y); if (d < d0) { d0 = d; best = p.key; } }
      if (best !== null) { propsRef.current.onPickPole?.(best); return; }
    }
    const direct = r.pickDirect?.(x, y, camera.current) ?? null;
    if (direct) { propsRef.current.onPick({ face: null, edge: null, point: null, direct }, e.shiftKey); return; }
    const instance = r.pickInstanceFace?.(x, y, camera.current) ?? null;
    if (instance) { propsRef.current.onPick({ face: null, edge: null, point: null, instance: instance.id, instanceFace: instance.face >= 0 ? { body: instance.body, face: instance.face } : undefined }, e.shiftKey); return; }
    const { face, edge } = pickAt(r, x, y), vertex = vertexAt(x, y, w, h, { face, edge });
    if (vertex) { propsRef.current.onPick({ face: null, edge: null, point: vertex.at, vertex }, e.shiftKey); return; }
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
    camera.current.zoom(Math.exp(e.deltaY * 0.0015), (x / w) * 2 - 1, 1 - (y / h) * 2); moving.current(); request();
  };

  // Overlay: sketch preview, dimension labels and the move gizmo, projected each frame.
  const overlay = () => {
    /** The overlay lines are the engine's (G7): only their labels, points and texts stay SVG. */
    const engineLines = !!renderer.current?.setOverlayLines;
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
      // (Open pieces — a trimmed shape's rest — as lines with their ends.)
      (sk.done ?? []).forEach((d, i) => {
        if (sk.hideConstruction && d.construction) return;
        const cls = 'sk-shape done' + (d.construction ? ' construction' : '');
        if (d.kind === 'polygon' && !d.closed) {
          items.push(<polyline key={'done' + i} points={sampleOutline(d.points, d.bulges, false).map(q => { const p = P(q[0], q[1]); return p[0] + ',' + p[1]; }).join(' ')} className={cls + ' open'} />);
          for (const [k, q] of [d.points[0], d.points[d.points.length - 1]].entries()) { const p = P(q[0], q[1]); items.push(<circle key={'de' + i + '.' + k} cx={p[0]} cy={p[1]} r={3} className="sk-end" />); }
        } else items.push(<polygon key={'done' + i} points={shapeOutline(d).map(q => { const p = P(q[0], q[1]); return p[0] + ',' + p[1]; }).join(' ')} className={cls} />);
      });
      const s = sk.shape;
      if (s?.kind === 'rectangle') {
        const [x0, x1] = [Math.min(s.a[0], s.b[0]), Math.max(s.a[0], s.b[0])], [y0, y1] = [Math.min(s.a[1], s.b[1]), Math.max(s.a[1], s.b[1])];
        const pts = [P(x0, y0), P(x1, y0), P(x1, y1), P(x0, y1)];
        items.push(<polygon key="r" points={pts.map(p => p[0] + ',' + p[1]).join(' ')} className={'sk-shape' + (s.construction ? ' construction' : '')} />);
        pts.forEach((p, i) => items.push(<circle key={'rp' + i} cx={p[0]} cy={p[1]} r={3} className="sk-point" />));
        if (x1 > x0 && y1 > y0) { glyph([x0, y0], [x1, y0], 'b'); glyph([x1, y0], [x1, y1], 'r'); }
        const top = P((x0 + x1) / 2, y0), side = P(x1, (y0 + y1) / 2);
        items.push(label(top[0], top[1] + 20, String(x1 - x0), 'width'), label(side[0] + 36, side[1], String(y1 - y0), 'height'));
      } else if (s?.kind === 'circle') {
        const pts = Array.from({ length: 72 }, (_, i) => P(s.c[0] + s.r * Math.cos(i / 36 * Math.PI), s.c[1] + s.r * Math.sin(i / 36 * Math.PI)));
        items.push(<polygon key="c" points={pts.map(p => p[0] + ',' + p[1]).join(' ')} className={'sk-shape' + (s.construction ? ' construction' : '')} />);
        const cc = P(s.c[0], s.c[1]); items.push(<circle key="cc" cx={cc[0]} cy={cc[1]} r={3} className="sk-point" />);
        const e = P(s.c[0] + s.r, s.c[1]); items.push(<line key="rl" x1={cc[0]} y1={cc[1]} x2={e[0]} y2={e[1]} className="sk-guide" />, label((cc[0] + e[0]) / 2, (cc[1] + e[1]) / 2 - 16, 'Ø' + s.r * 2, 'diameter'));
      } else if (s?.kind === 'slot') {
        const ring = s.r > 0 ? sampleSlot(s.a, s.b, s.r).map(p => P(p[0], p[1])) : [P(s.a[0], s.a[1]), P(s.b[0], s.b[1])];
        items.push(s.r > 0 ? <polygon key="sl" points={ring.map(p => p[0] + ',' + p[1]).join(' ')} className={'sk-shape' + (s.construction ? ' construction' : '')} />
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
        items.push(s.closed ? <polygon key="pg" points={line.map(p => p[0] + ',' + p[1]).join(' ')} className={'sk-shape' + (s.construction ? ' construction' : '')} />
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
      // The trim tool's target: the piece a click removes.
      // The centre arc being drawn: its circle while the start is chosen, then the arc so far and its radii.
      const ca = sk.tool === 'carc' ? carc.current : null;
      if (ca) {
        const C = P(ca.c[0], ca.c[1]); items.push(<circle key="ca-c" cx={C[0]} cy={C[1]} r={3} className="sk-point" />);
        if (!ca.a && ca.cursor) {
          const r = Math.hypot(ca.cursor[0] - ca.c[0], ca.cursor[1] - ca.c[1]), ring = Array.from({ length: 73 }, (_, k) => P(ca.c[0] + r * Math.cos(k * Math.PI / 36), ca.c[1] + r * Math.sin(k * Math.PI / 36)));
          const q = P(ca.cursor[0], ca.cursor[1]);
          items.push(<polyline key="ca-r" points={ring.map(p => p[0] + ',' + p[1]).join(' ')} className="sk-guide" fill="none" />, <line key="ca-l" x1={C[0]} y1={C[1]} x2={q[0]} y2={q[1]} className="sk-guide" />);
          if (r > 0) items.push(label((C[0] + q[0]) / 2, (C[1] + q[1]) / 2 - 18, 'R' + fmtLen(r), 'live-carc-r'));
        } else if (ca.a) {
          const r = Math.hypot(ca.a[0] - ca.c[0], ca.a[1] - ca.c[1]), t0 = Math.atan2(ca.a[1] - ca.c[1], ca.a[0] - ca.c[0]), n = Math.max(2, Math.ceil(Math.abs(ca.sweep) / (Math.PI / 36)));
          const arc = Array.from({ length: n + 1 }, (_, k) => P(ca.c[0] + r * Math.cos(t0 + ca.sweep * k / n), ca.c[1] + r * Math.sin(t0 + ca.sweep * k / n)));
          const A = P(ca.a[0], ca.a[1]), E = arc[arc.length - 1];
          items.push(<polyline key="ca-arc" points={arc.map(p => p[0] + ',' + p[1]).join(' ')} className="sk-shape open" />,
            <line key="ca-a" x1={C[0]} y1={C[1]} x2={A[0]} y2={A[1]} className="sk-guide" />, <line key="ca-e" x1={C[0]} y1={C[1]} x2={E[0]} y2={E[1]} className="sk-guide" />,
            <circle key="ca-ap" cx={A[0]} cy={A[1]} r={3.5} className="sk-point" />);
          if (Math.abs(ca.sweep) > 1e-3) items.push(label(E[0] + 30, E[1] - 14, (Math.round(Math.abs(ca.sweep) * 1800 / Math.PI) / 10) + '°', 'live-carc-a'));
        }
      }
      const trim = cutting(sk) && sketchDraft.current.trim?.kind === sk.tool ? sketchDraft.current.trim : null;
      if (trim?.kind === 'split') { const p = P(trim.points[0][0], trim.points[0][1]); items.push(<circle key="split" cx={p[0]} cy={p[1]} r={5} className="sk-split" />); }
      else if (trim) items.push(<polyline key="trim" points={trim.points.map(q => { const p = P(q[0], q[1]); return p[0] + ',' + p[1]; }).join(' ')} className={trim.kind === 'extend' ? 'sk-extend' : 'sk-trim'} />);
      const cur = picking(sk) ? null : sketchDraft.current.cursor;
      if (cur) { const p = P(cur[0], cur[1]); items.push(<g key="cur"><line x1={p[0] - 8} y1={p[1]} x2={p[0] + 8} y2={p[1]} className="sk-cursor" /><line x1={p[0]} y1={p[1] - 8} x2={p[0]} y2={p[1] + 8} className="sk-cursor" /></g>); }
      // The object snap the pointer is on: its mark (square end, triangle middle, circle centre, diamond quarter) and name.
      const sn = picking(sk) ? null : sketchDraft.current.snap;
      if (cur && sn) {
        const p = P(cur[0], cur[1]), r = 6, mark = sn.kind === 'end' || sn.kind === 'origin' ? <rect x={p[0] - r} y={p[1] - r} width={2 * r} height={2 * r} />
          : sn.kind === 'mid' ? <polygon points={`${p[0]},${p[1] - r - 1} ${p[0] + r + 1},${p[1] + r} ${p[0] - r - 1},${p[1] + r}`} />
          : sn.kind === 'centre' ? <circle cx={p[0]} cy={p[1]} r={r} /> : <polygon points={`${p[0]},${p[1] - r - 1} ${p[0] + r + 1},${p[1]} ${p[0]},${p[1] + r + 1} ${p[0] - r - 1},${p[1]}`} />;
        items.push(<g key="osnap" className="sk-osnap">{mark}<text x={p[0] + 11} y={p[1] - 9}>{({ end: 'End', mid: 'Middle', centre: 'Centre', quadrant: 'Quadrant', origin: 'Origin' } as const)[sn.kind]}</text></g>);
      }
    }
    const bb = props.boundsBox;
    if (bb && !sk) {
      const c = (i: number): Vec3 => [i & 1 ? bb.max[0] : bb.min[0], i & 2 ? bb.max[1] : bb.min[1], i & 4 ? bb.max[2] : bb.min[2]], q = Array.from({ length: 8 }, (_, i) => cam.project(c(i), w, h));
      const edges = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
      const top = q.reduce((b, p) => p[1] < b[1] ? p : b, q[0]), tw = Math.max(60, bb.label.length * 7 + 14);
      items.push(<g key="bbox" data-engine-lines={engineLines ? 12 : undefined}>{!engineLines && edges.map(([a, b]) => <line key={a + '-' + b} x1={q[a][0]} y1={q[a][1]} x2={q[b][0]} y2={q[b][1]} className="bbox-line" />)}
        {!engineLines && <><rect x={top[0] - tw / 2} y={top[1] - 30} width={tw} height={20} rx={4} className="dim-chip" /><text x={top[0]} y={top[1] - 16} textAnchor="middle" className="dim-text">{bb.label}</text></>}</g>);
    }
    // The cage being edited: the mirrored half faint, faces picked (n-gons tinted), edges (creases heavier, open
    // and non-manifold ones marked), vertices (poles ringed), all over the body.
    if (!sk && props.cage) items.push(<CageMarks key="cage" overlay={props.cage} project={q => cam.project(q as Vec3, w, h)} lines={!engineLines} />);
    // Drawings' underlays (O68): their polylines one path each, their texts placed and turned as projected.
    if (!sk) for (const u of props.underlays ?? []) {
      const d: string[] = [];
      if (!engineLines) for (const l of u.lines) l.forEach((p, k) => { const q = cam.project(p, w, h); d.push(`${k ? 'L' : 'M'}${q[0].toFixed(1)} ${q[1].toFixed(1)}`); });
      items.push(<g key={'ul' + u.id} aria-label={`Underlay drawing ${u.id}`} className="underlay" data-engine-lines={engineLines ? u.lines.length : undefined}>{!engineLines && <path d={d.join('')} className="underlay-line" fill="none" />}
        {!engineLines && u.texts.map((t, k) => { const a = cam.project(t.at, w, h), b = cam.project([t.at[0] + t.dir[0], t.at[1] + t.dir[1], t.at[2] + t.dir[2]], w, h), c = cam.project([t.at[0] + t.up[0] * t.height, t.at[1] + t.up[1] * t.height, t.at[2] + t.up[2] * t.height], w, h);
          const size = Math.hypot(c[0] - a[0], c[1] - a[1]); return size >= 2 ? <text key={k} x={a[0]} y={a[1]} fontSize={size} className="underlay-text" transform={`rotate(${(Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI).toFixed(2)} ${a[0].toFixed(1)} ${a[1].toFixed(1)})`}>{t.text.split('\n').map((ln, i) => <tspan key={i} x={a[0]} dy={i ? size * 1.25 : 0}>{ln}</tspan>)}</text> : null; })}</g>);
    }
    // A workspace map (RM9b): its voxels as small squares, one path a band of manipulability (blue low, red high).
    if (!sk && props.cloud?.length && engineLines) items.push(<g key="cloud" aria-label="Workspace map" data-engine-points={props.cloud.length} />);
    else if (!sk && props.cloud?.length) {
      const bands = Array.from({ length: 8 }, () => [] as string[]);
      for (const c of props.cloud) { const q = cam.project(c.at, w, h); bands[Math.min(7, Math.floor(c.t * 8))].push(`M${(q[0] - 1.5).toFixed(1)} ${(q[1] - 1.5).toFixed(1)}h3v3h-3z`); }
      items.push(<g key="cloud" aria-label="Workspace map">{bands.map((d, k) => d.length ? <path key={k} d={d.join('')} fill={`hsl(${240 - k * 34} 80% 55%)`} fillOpacity={0.75} /> : null)}</g>);
    }
    // The selected curve's or surface's poles, the picked one ringed.
    if (!sk) (props.poles ?? []).forEach(p => {
      const q = cam.project(p.at, w, h), on = p.key === props.pickedPole;
      items.push(<circle key={'pole' + p.key} cx={q[0]} cy={q[1]} r={on ? 5.5 : 3.5} className={on ? 'pole-mark picked' : 'pole-mark'} />);
    });
    // The corner under the pointer, and the picked ones.
    [...(props.pickedVertices ?? []), ...(hover.current.vertex && !sk ? [hover.current.vertex] : [])].forEach((v, k) => {
      const q = cam.project(v.at, w, h); items.push(<circle key={'vx' + k} cx={q[0]} cy={q[1]} r={5} className="vertex-mark" />);
    });
    const ml = props.measureLine;
    if (ml) {
      const a = cam.project(ml.a, w, h), b = cam.project(ml.b, w, h), mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, tw = Math.max(52, ml.label.length * 7 + 14);
      items.push(<g key="measure" className="measure" data-engine-lines={engineLines ? 1 : undefined}>{!engineLines && <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} className="measure-line" />}
        <circle cx={a[0]} cy={a[1]} r={3.5} className="measure-point" /><circle cx={b[0]} cy={b[1]} r={3.5} className="measure-point" />
        {!engineLines && <><rect x={mx - tw / 2} y={my - 24} width={tw} height={20} rx={4} className="dim-chip" /><text x={mx} y={my - 10} textAnchor="middle" className="dim-text">{ml.label}</text></>}</g>);
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
      const readout = !g || !hit ? null : { at: [g.x, g.y] as [number, number], text: hit.kind === 'handle' ? (props.handles?.[hit.index] ? `${props.handles[hit.index].label} ${props.handles[hit.index].format(g.value ?? g.start ?? 0)}${props.handles[hit.index].plane ? ', ' + props.handles[hit.index].format(g.value2 ?? g.start2 ?? 0) : ''}` : '')
        : hit.kind === 'move' ? `Δ${'XYZ'[hit.axis]} ${fmtLen(g.delta?.[hit.axis] ?? 0)} mm`
        : hit.kind === 'plane' ? hit.axes.map(a => `Δ${'XYZ'[a]} ${fmtLen(g.delta?.[a] ?? 0)}`).join('  ') + ' mm'
        : hit.kind === 'scale' ? `× ${String(Math.round((g.factor ?? 1) * 100) / 100)}` : `${'XYZ'[hit.axis]} ${fmtLen(g.degrees ?? 0)}°` };
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
    const basis = cam.basis();
    return <><svg className="vp-overlay" width={w} height={h} aria-hidden="true">{items}</svg>{editor}
      {!propsRef.current.sketch && <ViewCube right={basis.right} up={basis.up} forward={basis.forward} onLook={lookFrom} onOrbit={(dx, dy) => { camera.current.orbit(dx, dy); request(); }} />}</>;
  };

  return (
    <div className="viewport" data-renderer={backend ?? undefined}
      onDragOver={e => { if (!e.dataTransfer.types.includes(DRAG_TYPE)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; const l = local(e); propsRef.current.onSpot?.(spotAt(l.x, l.y, l.w, l.h), false); }}
      onDrop={e => { if (!e.dataTransfer.types.includes(DRAG_TYPE)) return; e.preventDefault(); const l = local(e); propsRef.current.onSpot?.(spotAt(l.x, l.y, l.w, l.h), true); }}>
      <canvas ref={canvas} className="vp-canvas" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerLeave={onPointerLeave}
        onDoubleClick={e => { const p = propsRef.current, r = renderer.current; if (!r || p.sketch || p.placing) return;
          if (p.cage) { const { x, y, w, h } = local(e), hit = pickCage(p.cage.cage, q => camera.current.project(q as Vec3, w, h), x, y, 'edge'); if (hit) p.onPickCage?.(hit, e.shiftKey, e.altKey ? 'ring' : 'loop'); return; } const { x, y } = local(e), { face, edge } = pickAt(r, x, y); if (edge && p.onPickChain) p.onPickChain(edge.body, edge.edge); else if (face) p.onPickBody?.(face.body); }}
        onWheel={onWheel} onContextMenu={e => e.preventDefault()} aria-label="3D viewport. Right-drag to orbit, middle-drag to pan, wheel to zoom." />
      {overlay()}
      {error && <div className="vp-error" role="alert">{error}</div>}
    </div>
  );
});

/** The drag-and-drop type of a command dragged from the rail (its id is the data). */
export const DRAG_TYPE = 'application/x-cad-command';
const fmtLen = (v: number) => String(Math.round(v * 10) / 10);
