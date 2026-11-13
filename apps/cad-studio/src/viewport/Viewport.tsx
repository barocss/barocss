import type { MarkHandlers } from '../ui/SketchMarks';
import type { ScreenBox } from '../ui/sketchConstraintMarkLayout';
import { viewportRecoveryHost, type ViewportRecoveryNotice } from './viewportRecovery';
import type { ClearanceDisplay } from './clearanceDisplay';
import { useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, forwardRef } from 'react';
import { countRender } from '../devRenders';
import type { CamDisplay } from './camDisplay';
import { camStockBounds } from './camOverlayGeometry';
import type { ModelAnnotation } from '@barocss/cad-model/drawing/annotations3d';
import { pmiDrawings, pmiFacingKey, pmiLabels } from './pmiGeometry';
import { printPointToModel, printSceneBounds, projectPrintBodies } from './printProjection';
import type { BodyResult } from '@barocss/cad-model/engine/evaluate';
import type { Vec3 } from '@barocss/cad-model/engine/mesh';
import { OrbitCamera } from './camera';
import { orthographicSketchScale } from './sketchOutlinePick';
import { modelFitArea } from './modelFitArea';
import type { FrameCost } from './frameCost';
import { PROPOSAL_ADDED, PROPOSAL_CHIP_STEP, PROPOSAL_REMOVED, Renderer, proposalChips, type DisplayMode, type DisplayModeStatus, type EdgeRef, type FaceRef, type InstanceItem, type MouldShown, type OverlayLabels, type OverlayLines, type OverlayPoints, type SectionHatch, type ThemeName, type ViewRenderer, type ViewState, type RenderPathTraceSession } from './renderer';
import type { ScalarMap } from './scalarMaps';
import { GpuRenderer } from './gpuRenderer';
import type { RenderCamera } from '@barocss/cad-model/engine/render';
import type { DirectDisplay } from '@barocss/cad-model/engine/direct';
import { regionMesh, type ToolRegion } from '@barocss/cad-model/app/holeRegion';
import { toWorld, type SketchPlane } from '@barocss/cad-model/sketch/plane';
import { handleLayout, type FeatureHandle } from './gizmo';
import { gizmoMarks } from './GizmoMarks';
import { HandleValueBox } from './HandleValueBox';
import { ViewCube } from './ViewCube';
import { CAGE_LINE_KEYS, CageMarks, cageLines, cagePoints } from './CageMarks';
import type { CageMode, CageSelection, StudioCage } from '@barocss/cad-model/subd/cageEdit';
import type { CageValidation } from '@barocss/cad';
import type { Analysis } from './analysis';
import { recordCanvas } from './recordVideo';
import { drawSketchOverlay, fmtLen, type SketchBandCache } from './sketchOverlay';
import { createConstraintInspection, type ConstraintInspectionStore } from '../sketch/constraintInspection';
import { useStoreValue } from '../state/valueStore';
import type { OverlaidLine } from '../sketch/overlaidLines';
import { banding, cutting, picking, useViewportPointerInput, type ViewportHover, type ViewportPointerProps } from './viewportPointerInput';

import type { SketchState } from '@barocss/cad-model/sketch/types';
export type { SketchTool, SketchShape, SketchAnchor, SketchState, Make } from '@barocss/cad-model/sketch/types';
export type { FeatureHandle, TransformGizmo } from './gizmo';
export { DRAG_TYPE, instancePickFields } from './viewportPointerInput';

export interface ViewportHandle {
  /** Frames everything, or the box given (the picked bodies). */
  fit(box?: { min: Vec3; max: Vec3 }): void; setView(name: Parameters<OrbitCamera['setView']>[0]): void; toggleOrtho(): boolean; camera: OrbitCamera;
  startRectangleAt(owner: SketchState, at: [number, number]): boolean;
  /** A straight view onto the sketch plane, framing its rectangle (plane coordinates) in the area not covered by `insets` (CSS px). */
  frameSketch(min: [number, number], max: [number, number], plane: SketchPlane): void;
  faceActiveSketch(): void;
  setTheme(name: ThemeName): void; setAo(on: boolean): void;
  /** The frame as a PNG (WebGPU only). */
  capture(): Promise<Blob | null>;
  /** Freeze a 640-pixel-wide still while the raster viewport stays interactive. */
  createRenderPathTrace(): Promise<RenderPathTraceSession>;
  /** A WebM of `count` frames at `fps`, frame i drawn by `draw(i)` first (RS2: a motion, the Render turntable). */
  recordVideo(count: number, fps: number, draw: (i: number) => void): Promise<Blob>;
  /** The camera as render settings keep it, and back. */
  /** Pick one visible surface for Render focus. Null means background/cancel; the return value cancels the pick. */
  pickRenderFocus(done: (focus: number | null) => void): () => void;
  getCamera(): RenderCamera;
  setCamera(c: RenderCamera): void;
  /** Which renderer draws: WebGPU, the WebGL2 fallback, or none yet. */
  readonly backend: 'webgpu' | 'webgl2' | null;
  /** Display capability diagnosis; unsupported requests retain the prior mode and section state. */
  getDisplayModeStatus(): DisplayModeStatus | null;
  /** The engine's overlay lines shown, segments a key (G7; WebGPU; for the flow). */
  overlayLines(): Record<string, number>;
  /** The engine's overlay labels' texts, a key (G15; WebGPU; for the flow). */
  overlayTexts(): Record<string, string[]>;
  /** G25: the GPU device for the analyses' compute passes (WebGPU only), else null. */
  computeDevice(): object | null;
  /** O10: count each body's draws in the frames drawn (off by default; read-only — nothing drawn changes). */
  trackFrameCost(on: boolean): void;
  /** O10: the last frame tracked in each display mode, for the bodies shown now (work counts, not time; empty before a renderer). */
  frameCosts(): Partial<Record<DisplayMode, FrameCost>>;
}

/** Where a new shape stands: a point on the ground or on an upward face, and that surface's normal. */
/** `hole`: placed at a round hole's rim — its diameter, its depth along the axis, and whether it runs through the body. */
export interface Spot { point: Vec3; normal: Vec3; hole?: { d: number; depth: number; through: boolean } }
/**
 * A robot's tool or sensor frame as the viewport draws it (G13, O12): `o` its origin (mm, assembly coordinates), `R` row-major
 * with its columns the frame's X, Y and Z (Z = [R[2], R[5], R[8]]), `kind` its label's colour.
 */
export interface FrameTriad { name: string; kind?: 'tool' | 'sensor'; o: Vec3; R: readonly number[] }

const NO_CONSTRAINT_INSPECTION = createConstraintInspection();

interface Props extends ViewportPointerProps, MarkHandlers {
  modelUnavailable?: boolean;
  constraintInspection?: ConstraintInspectionStore;
  overlaidLine?: OverlaidLine;
  /** G23 CNC: the preview's stock, paths, remaining stock and tool (world coordinates), beside the native bodies. */
  camDisplay?: CamDisplay | null;
  annotationSelected?: string | null;
  /** Appearance only, on ordinary modelling solids; no document or selection store is created. */
  displayMode?: DisplayMode;
  /** The application's session request, before an unsupported scope falls back to the default. */
  requestedDisplayMode?: DisplayMode;
  displayModeReason?: string;
  /** Session snapshot of placed instance IDs to keep opaque; undefined restores the ordinary view. */
  isolatedInstances?: readonly string[];
  clearance?: ClearanceDisplay | null;
  /** Reports backend capability failures to the existing application controls. */
  onDisplayModeStatus?(status: DisplayModeStatus): void;
  onRecoveryNotice?(notice: ViewportRecoveryNotice): void;
  onProjectionChange?(orthographic: boolean): void;
  /** Which renderer draws, once one has started (G10: what WebGL2 does not draw is said in the app). */
  onBackend?(backend: 'webgpu' | 'webgl2'): void;
  selection: { faces: FaceRef[]; edges: EdgeRef[]; bodies: number[] };
  /** Keep the Band rail within viewport selection while other tools own model picks. */
  bandRailPicking?: boolean;
  ghost: Set<number>;
  /** Bodies' own colours by index (StudioDoc.bodies). */
  bodyColors?: Map<number, [number, number, number]>;
  faceColors?: Map<number, Map<number, [number, number, number]>>;
  hoverBody?: number | null;
  /** A measured distance: a dimension line between the closest points. */
  measureLine?: { a: Vec3; b: Vec3; label: string } | null;
  /** The robot's tool and sensor frames at the pose shown (G13): a triad each — X red, Y green, Z blue — and its name.
   *  `frameSize`: the axes' length (mm). */
  frames?: readonly FrameTriad[];
  frameSize?: number;
  /** Corners picked (shown as rings). */
  pickedVertices?: { body: number; at: Vec3 }[];
  /** A box drawn dashed round what is picked (or the part), with its size. */
  boundsBox?: { min: Vec3; max: Vec3; label: string } | null;
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
  /** A workspace map's voxel centres (RM9b), each with its manipulability as a share of the best, 0…1: dots coloured by it. */
  cloud?: { at: Vec3; t: number }[] | null;
  /** Drawings' reference underlays (O68), in the world: polylines and texts (each with its baseline and up directions), drawn thin and grey, not picked. */
  underlays?: { id: string; lines: Vec3[][]; texts: { at: Vec3; dir: Vec3; up: Vec3; text: string; height: number }[] }[];
  pickedPole?: string | null;
  /** Placed instances of other parts, and the selected ones. */
  instances?: InstanceItem[];
  /** Instances shown moved (posed by the joints, exploded) by a matrix each (column-major 4 × 4), the rest as placed (G1). */
  instanceTransforms?: ReadonlyMap<string, Float64Array>;
  /** The hatch on the cut as lines (G19.3): WebGL2's clipped caps, the exact section's cut faces. */
  sectionHatch?: SectionHatch | null;
  /** Analysis maps on the bodies (G6), and the value under the pointer as it moves over them (null off them). */
  scalarMaps?: readonly ScalarMap[] | null;
  /** The mould's parting loops and halves (G6), or none. */
  mould?: MouldShown | null;
  /** Isoclines drawn with the draft map (G6), or none. */
  isoclines?: readonly { points: readonly Vec3[]; closed: boolean }[] | null;
  /** A shown proposal's added and removed material (G12; WebGPU), or none. */
  proposal?: import('../engine/client').ProposalOverlay | null;
  instanceSelection?: string[];
  /** RS2: the links in contact as a motion plays (instance ids; BASE, the part's own bodies), marked in the error colour. */
  contactLinks?: readonly string[];
  /** Faces of instances shown picked (mate faces). */
  instanceFaces?: { id: string; body: number; face: number }[];
  /** An instance shown moved while the gizmo drags it (see assembly/drag.ts previewMatrix). */
  instancePreview?: { id: string; matrix: Float64Array } | null;
}
export function displayModeScope(props: Props): string | undefined {
  if (props.render) return 'CAD display modes are available in Model view.';
  if (props.analysis || props.scalarMaps?.length) return 'CAD display modes are not available with analysis.';
  if (props.mould) return 'CAD display modes are not available with mould displays.';
  if (props.proposal || props.direct?.length) return 'CAD display modes are not available with direct geometry or proposal previews.';
  if (props.instancePreview) return 'CAD display modes are not available while an instance is dragged.';
  if (props.sketch || props.cage || props.tool || props.regions?.length)
    return 'CAD display modes are not available while a sketch, cage or tool is being edited.';
}
/** Copy the current placed selection so later selection changes cannot change the isolated view. */
export function snapshotInstanceIsolation(selected: readonly string[], placed: readonly Pick<InstanceItem, 'id' | 'bodies'>[]): readonly string[] | undefined {
  const visible = new Set(placed.filter(item => item.bodies.length > 0).map(item => item.id));
  const snapshot = [...new Set(selected.filter(id => visible.has(id)))];
  return snapshot.length ? snapshot : undefined;
}
/** Diagnose the actual bridge, rather than rejecting a backend that now draws and picks instances. */
export function instanceDisplayStatus(status: DisplayModeStatus | null, renderer: Pick<ViewRenderer, 'setInstances' | 'pickInstanceFace'> | null, hasInstances: boolean): DisplayModeStatus | null {
  if (!status || !hasInstances) return status;
  if (typeof renderer?.setInstances !== 'function' || typeof renderer?.pickInstanceFace !== 'function')
    return { ...status, supported: false, reason: 'Instance rendering requires the renderer instance bridge.' };
  return status;
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
/** G13: a frame's axes (the view triad's red, green and blue) and its name's chip — a tool's the accent, a sensor's cyan. */
const FRAME_AXES = [['x', '#e5534b'], ['y', '#57b26b'], ['z', '#4a90e2']] as const;
const FRAME_CHIP: Record<'tool' | 'sensor', string> = { tool: '#e8c25a', sensor: '#56c8e0' };
/** A frame's axis ends: its origin and o + size · each column of R. */
export function frameAxisEnds(f: FrameTriad, size: number): { x: Vec3; y: Vec3; z: Vec3 } {
  const end = (k: number): Vec3 => [f.o[0] + size * f.R[k], f.o[1] + size * f.R[3 + k], f.o[2] + size * f.R[6 + k]];
  return { x: end(0), y: end(1), z: end(2) };
}
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
/** The viewport's frame counter (R1): the overlay subscribes to it, so a frame draws the overlay again, not the whole viewport. */
interface FrameTicker { n: number; listeners: Set<() => void>; subscribe(listener: () => void): () => void; get(): number }
function frameTicker(): FrameTicker {
  const t: FrameTicker = { n: 0, listeners: new Set(), subscribe: l => { t.listeners.add(l); return () => { t.listeners.delete(l); }; }, get: () => t.n };
  return t;
}
function bumpTicker(t: FrameTicker): void { t.n++; for (const l of t.listeners) l(); }
/** What the viewport draws over its canvas, again in each frame (R1: the frame's render is this component's alone). */
function FrameOverlay({ ticker, draw }: { ticker: FrameTicker; draw: () => React.ReactNode }) {
  useSyncExternalStore(ticker.subscribe, ticker.get);
  countRender('ViewportOverlay');
  return <>{draw()}</>;
}

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

/** What a viewport tool sees of the view (G17): pixels of world points, the ray under a pixel, the bodies' corners. */
export interface ToolView {
  w: number; h: number; camera: OrbitCamera;
  project(p: Vec3): [number, number, number];
  ray(x: number, y: number): { origin: Vec3; dir: Vec3 };
  /** The shown bodies' corners (the ends of their edges). */
  vertices(): Vec3[];
  request(): void;
}
/**
 * A tool that takes the left button before the viewport's own picking and draws its marks in the overlay (G17: the 3D
 * skeleton sketch); orbit (right, Alt-left), pan and wheel stay the viewport's. `down` true: the press is the tool's
 * (its moves and release go to it); `move` true with no press: the hover is the tool's (no face or edge hover).
 */
export interface ViewportTool {
  down(x: number, y: number, view: ToolView, e: { shiftKey: boolean; metaKey: boolean; ctrlKey: boolean }): boolean;
  move(x: number, y: number, view: ToolView, e: { buttons: number; shiftKey: boolean }): boolean;
  up(x: number, y: number, view: ToolView, e: { shiftKey: boolean }): void;
  marks(view: ToolView): React.ReactNode;
}

export interface CageOverlay {
  cage: StudioCage; mode: CageMode; sel: CageSelection; validation: CageValidation;
  /** The mirrored half (drawn faint), when the cage is one half. */
  mirrored?: StudioCage | null;
}


type InstanceFace = { id: string; body: number; face: number };
function sameInstanceFaces(a: readonly InstanceFace[], b: readonly InstanceFace[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i].id !== b[i].id || a[i].body !== b[i].body || a[i].face !== b[i].face) return false;
  return true;
}

// (R1b: the print views' empty lists, one each — new ones in every App render ran the effects keyed on them again.)
const NO_BODIES: BodyResult[] = [], NO_HANDLES: FeatureHandle[] = [], NO_PROFILES: NonNullable<Props['profiles']> = [];
const NO_SELECTION: Props['selection'] = { faces: [], edges: [], bodies: [] };
/** The selection as the print view's bodies number their faces and edges. */
function printSelection(selection: Props['selection'], projection: ReturnType<typeof projectPrintBodies>): Props['selection'] {
  const faces = selection.faces.flatMap(ref => { const index = projection.faceSources[ref.body]?.indexOf(ref.face) ?? -1; return index >= 0 ? [{ body: ref.body, face: index }] : []; });
  const edges = selection.edges.flatMap(ref => { const index = projection.edgeSources[ref.body]?.indexOf(ref.edge) ?? -1; return index >= 0 ? [{ body: ref.body, edge: index }] : []; });
  return { ...selection, faces, edges };
}
/** The face colours as the print view's bodies number their faces. */
function printFaceColors(faceColors: Props['faceColors'], projection: ReturnType<typeof projectPrintBodies>): Props['faceColors'] {
  return faceColors && new Map([...faceColors].map(([body, colors]) => [body, new Map((projection.faceSources[body] ?? []).flatMap((native, shown) => colors.has(native) ? [[shown, colors.get(native)!] as const] : []))]));
}
function printViewportProps(source: Props, projection: ReturnType<typeof projectPrintBodies>, selection: Props['selection'], faceColors: Props['faceColors']): Props {
  const face = (ref: FaceRef | null): FaceRef | null => { const index = ref && projection.faceSources[ref.body]?.[ref.face]; return ref && index !== undefined && index !== null && index >= 0 ? { body: ref.body, face: index } : null; };
  const edge = (ref: EdgeRef | null): EdgeRef | null => { const index = ref && projection.edgeSources[ref.body]?.[ref.edge]; return ref && index !== undefined && index !== null && index >= 0 ? { body: ref.body, edge: index } : null; };
  const point = (p: Vec3 | null) => p ? printPointToModel(p, source.printDisplay!.summary.modelToBed) : null;
  return { ...source, bodies: projection.bodies, selection, faceColors,
    gizmo: null, handles: NO_HANDLES, offsets: undefined, transforms: null, pickedVertices: undefined, measureLine: null, boundsBox: null, profiles: NO_PROFILES,
    clip: null, sectionHatch: null, clearance: null, threads: undefined, underlays: undefined, cloud: null, poles: undefined,
    onPick: (hit, additive) => {
      const nativeFace = face(hit.face), nativeEdge = edge(hit.edge);
      if (hit.face && !nativeFace) { source.onPickBody?.(hit.face.body); return; }
      if (hit.edge && !nativeEdge) { source.onPickBody?.(hit.edge.body); return; }
      source.onPick({ ...hit, face: nativeFace, edge: nativeEdge, point: point(hit.point), ...(hit.vertex ? { vertex: { ...hit.vertex, at: point(hit.vertex.at)! } } : {}) }, additive);
    },
    onPickChain: (body, shown) => { const ref = edge({ body, edge: shown }); if (ref) source.onPickChain?.(ref.body, ref.edge); },
    onCursor: p => source.onCursor(point(p)),
    onContextMenu: (at, hit) => {
      const nativeFace = face(hit.face);
      source.onContextMenu(at, { face: nativeFace, edge: edge(hit.edge), point: nativeFace ? point(hit.point) : null });
    },
  };
}

export const Viewport = forwardRef<ViewportHandle, Props>(function Viewport(sourceProps, ref) {
  countRender('Viewport');
  const constraintInspection = useStoreValue(sourceProps.constraintInspection ?? NO_CONSTRAINT_INSPECTION);
  const projection = useMemo(() => sourceProps.printDisplay ? projectPrintBodies(sourceProps.bodies, sourceProps.printDisplay) : null,
    [sourceProps.bodies, sourceProps.printDisplay?.summaryKey, sourceProps.printDisplay?.top, sourceProps.printDisplay?.printed]);
  const printSel = useMemo(() => projection ? printSelection(sourceProps.selection, projection) : null, [sourceProps.selection, projection]);
  const printColors = useMemo(() => projection ? printFaceColors(sourceProps.faceColors, projection) : undefined, [sourceProps.faceColors, projection]);
  const props = useMemo(() => projection ? printViewportProps(sourceProps, projection, printSel!, printColors) : sourceProps.printActive ? { ...sourceProps, bodies: NO_BODIES, selection: NO_SELECTION, gizmo: null, handles: NO_HANDLES, profiles: NO_PROFILES, threads: undefined, underlays: undefined, cloud: null, poles: undefined } : sourceProps, [sourceProps, projection, printSel, printColors]);
  const canvas = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<ViewRenderer | null>(null);
  // (O10: tracking asked for before the renderer is made applies to it once it is.)
  const frameCostOn = useRef(false);
  const [backend, setBackend] = useState<'webgpu' | 'webgl2' | null>(null);
  const [startupBackend, setStartupBackend] = useState<'webgpu' | 'webgl2'>(() =>
    new URLSearchParams(location.search).get('renderer') === 'webgl2' || !('gpu' in navigator) ? 'webgl2' : 'webgpu');
  const [displayStatus, setDisplayStatus] = useState<DisplayModeStatus | null>(null);
  const theme = useRef<ThemeName>('dark'), ao = useRef(true);
  /** The theme as state, for the overlay lines whose colour follows it (G7). */
  const [themeName, setThemeName] = useState<ThemeName>('dark');
  const camera = useRef(new OrbitCamera());
  const printCamera = useRef<{ original: RenderCamera; summary: number | null } | null>(null);
  const frame = useRef(0);
  const rendererBodies = useRef<BodyResult[]>(NO_BODIES);
  const uploadedBodies = useRef<{ renderer: ViewRenderer; source: BodyResult[]; bodies: BodyResult[]; index: number; tier: number } | null>(null);
  const selectedBandRail = useRef<{ hit: EdgeRef; mesh: BodyResult['mesh']; selection: Props['selection'] } | null>(null);
  const rendererInstances = useRef<{ renderer: ViewRenderer; instances: NonNullable<Props['instances']> } | null>(null);
  const hover = useRef<ViewportHover>({ face: null, edge: null });
  // While the camera moves (orbit, pan, zoom), frames leave out ambient occlusion; 180 ms after the last
  // move a full frame is drawn with it, the same as before. (One function, kept for the component's life.)
  const settle = useRef(0), requestRef = useRef<() => void>(() => undefined);
  const moving = useRef(() => {
    const r = renderer.current; if (!r) return;
    r.interacting = true; window.clearTimeout(settle.current);
    settle.current = window.setTimeout(() => { if (renderer.current) { renderer.current.interacting = false; requestRef.current(); } }, 180);
  });
  /** The band's derived outline, recomputed only when the band or the shapes change. */
  const bandCache = useRef<SketchBandCache | null>(null);
  const ticker = useMemo(frameTicker, []);
  const [error, setError] = useState<string | null>(null);
  const [printError, setPrintError] = useState<string | null>(null);
  const [camError, setCamError] = useState<string | null>(null);
  const propsRef = useRef(props); propsRef.current = props;
  const setOrthographic = (orthographic: boolean) => {
    const c = camera.current;
    if (c.ortho === orthographic) return;
    c.ortho = orthographic;
    propsRef.current.onProjectionChange?.(orthographic);
  };
  const focusPick = useRef<((focus: number | null) => void) | null>(null);
  const [pickingFocus, setPickingFocus] = useState(false);
  const finishFocusPick = (focus: number | null) => {
    const done = focusPick.current; focusPick.current = null; setPickingFocus(false);
    if (canvas.current) canvas.current.style.cursor = '';
    done?.(focus);
  };
  const fitted = useRef(false);
  const fitBounds = (bounds: { min: Vec3; max: Vec3 }) => {
    const view = canvas.current, c = camera.current;
    if (!view) return;
    c.aspect = view.clientWidth / Math.max(1, view.clientHeight);
    const area = props.sketch || props.render || sourceProps.printActive || sourceProps.camActive ? undefined : modelFitArea(view);
    c.fit(bounds.min, bounds.max, area);
  };

  // (R1b: the bodies' offsets made once for the transforms or offsets they come from — viewState runs in each frame and hover.)
  const offsetsMemo = useRef<{ from: unknown; map: ViewState['offsets'] } | null>(null);
  const offsetsOf = (p: Props): ViewState['offsets'] => {
    const from = p.transforms ?? p.offsets, had = offsetsMemo.current;
    if (had && had.from === from) return had.map;
    const map = p.transforms ? new Map([...p.transforms].map(([k, m]) => [k, [m[12], m[13], m[14]] as Vec3])) : p.offsets ?? new Map();
    offsetsMemo.current = { from, map };
    return map;
  };
  const bandRail = (hit: EdgeRef | null) => {
    const upload = uploadedBodies.current, props = propsRef.current;
    if (!hit || !props.bandRailPicking || props.modelUnavailable || props.pickFilter === 'face' || props.pickFilter === 'body' || upload?.source !== props.bodies
      || upload.index !== hit.body || upload.bodies === upload.source || props.hiddenBodies?.has(hit.body)) return undefined;
    return upload.source[hit.body]?.mesh.bandDetail?.rails[hit.edge];
  };
  const readSelectedBandRail = () => {
    const selected = selectedBandRail.current, p = propsRef.current;
    return selected && selected.selection === p.selection && p.bodies[selected.hit.body]?.mesh === selected.mesh && bandRail(selected.hit)
      ? selected.hit : null;
  };
  const renderedEdgeSelection = () => {
    const rail = readSelectedBandRail();
    return rail ? [rail] : propsRef.current.selection.edges;
  };
  const selectBandRail = (hit: EdgeRef | null) => {
    const rail = bandRail(hit), p = propsRef.current;
    if (!hit || !rail) {
      if (selectedBandRail.current) { selectedBandRail.current = null; requestRef.current(); }
      return false;
    }
    selectedBandRail.current = { hit, mesh: p.bodies[hit.body].mesh, selection: p.selection };
    requestRef.current();
    return true;
  };
  const viewState = (): ViewState => ({
    displayMode: propsRef.current.displayMode,
    displayModeUnsupported: displayModeScope(propsRef.current),
    isolatedInstances: displayModeScope(propsRef.current) ? undefined : propsRef.current.isolatedInstances,
    hoverFace: propsRef.current.modelUnavailable ? null : hover.current.face,
    hoverEdge: propsRef.current.modelUnavailable ? null : hover.current.edge,
    selectedFaces: propsRef.current.selection.faces, selectedEdges: renderedEdgeSelection(), selectedBodies: propsRef.current.selection.bodies,
    // (Both renderers draw a dragged body by its matrix, its turn too — G16 for WebGL2; the offsets keep its move.)
    offsets: offsetsOf(propsRef.current),
    transforms: propsRef.current.transforms ?? undefined, ghostBodies: propsRef.current.ghost, bodyColors: propsRef.current.bodyColors, faceColors: propsRef.current.faceColors, hiddenBodies: propsRef.current.hiddenBodies, hoverBody: propsRef.current.modelUnavailable ? undefined : propsRef.current.hoverBody ?? undefined,
  });
  const syncDisplayedBodies = (r: ViewRenderer, p = propsRef.current) => {
    const source = p.bodies, view = canvas.current, cam = camera.current;
    let tier = -1, index = -1, packet;
    if (view && cam.ortho && Math.PI / 2 - cam.pitch < 0.001
      && (p.displayMode ?? 'shaded-with-edges') === 'shaded-with-edges'
      && !displayModeScope(p) && !p.clip && !p.offsets?.size && !p.transforms?.size
      && !p.instances?.length && !p.ghost.size && !p.printActive && !p.camActive) {
      const scale = orthographicSketchScale(cam, view.clientWidth, view.clientHeight);
      const cylinder = source.length === 1 ? source[0].mesh.cylinderDetail : undefined;
      const bandIndex = p.bandRailPicking && !p.modelUnavailable ? source.findIndex((body, i) => body.mesh.bandDetail && !p.hiddenBodies?.has(i)) : -1;
      const detail = bandIndex >= 0 ? source[bandIndex].mesh.bandDetail : cylinder;
      if (scale !== undefined && detail && (!cylinder || cylinder.baseChordErrorMM * scale > 0.25)) {
        index = bandIndex >= 0 ? bandIndex : 0;
        const found = detail.tiers.findIndex(candidate => candidate.chordErrorMM * scale <= 0.25);
        tier = found >= 0 ? found : detail.tiers.length - 1;
        packet = detail.tiers[tier];
      }
    }
    const current = uploadedBodies.current;
    if (current?.renderer === r && current.source === source && current.index === index && current.tier === tier) {
      if (selectedBandRail.current && !readSelectedBandRail()) selectedBandRail.current = null;
      return;
    }
    const bodies = packet ? source.map((body, i) => i === index ? { ...body, mesh: { ...body.mesh, ...packet } } : body) : source;
    const previousEdge = hover.current.edge;
    const priorRail = previousEdge && current?.index === previousEdge.body && current.bodies !== current.source
      && current.source[previousEdge.body]?.mesh.bandDetail?.rails[previousEdge.edge];
    r.setBodies(bodies);
    rendererBodies.current = source;
    uploadedBodies.current = { renderer: r, source, bodies, index, tier };
    if (selectedBandRail.current && !readSelectedBandRail()) selectedBandRail.current = null;
    if (priorRail && !bandRail(hover.current.edge)) hover.current = { ...hover.current, edge: null };
    r.setState(viewState());
  };

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
      // (The annotations' texts as facing the eye: set again in the frame which ones face it changes.)
      const p = propsRef.current;
      syncDisplayedBodies(r, p);
      if (p.annotations?.length && r.setOverlayLabels && pmiFacingKey(p.annotations, camera.current.basis().forward) !== pmiFacing.current) applyPmiLabels();
      r.render(camera.current, viewState());
      bumpTicker(ticker);
    });
  };
  requestRef.current = request;

  const input = useViewportPointerInput({
    canvas, camera, propsRef,
    rendering: { renderer, rendererBodies, rendererInstances, syncDisplayedBodies, isBandRail: hit => !!bandRail(hit), selectBandRail, request, requestRef, moving, viewState, hover },
    focus: { focusPick, finishFocusPick },
  });
  const { cancelGizmo } = input;
  const { drag, gizmoHot, valueBox, sketchDraft, twoPointHover, bezierDraft, ellipseDraft, carc, liveShape, toolView, projector } = input.overlay;
  const gizmoSessionKey = props.gizmo?.sessionKey, gizmoPresent = !!props.gizmo;
  useLayoutEffect(() => {
    const d = drag.current;
    if (d.mode === 'gizmo' && d.gizmo && (!gizmoPresent || !Object.is(gizmoSessionKey, d.sessionKey))) cancelGizmo('session-change');
  }, [gizmoPresent, gizmoSessionKey]);
  useEffect(() => () => cancelGizmo('unmount'), []);
  const renderActive = !!props.render && !props.sketch;
  useEffect(() => { if (!renderActive) { const done = focusPick.current; focusPick.current = null; setPickingFocus(false); if (canvas.current) canvas.current.style.cursor = ''; done?.(null); } }, [renderActive]);
  useEffect(() => () => { const done = focusPick.current; focusPick.current = null; done?.(null); }, []);
  useEffect(input.listenForSketchKeys, []);

  // WebGPU (the @barocss/gpu viewer) when the browser has it, else WebGL2; ?renderer=webgl2 forces the latter.
  useEffect(() => {
    const target = canvas.current!;
    let live = true, observer: ResizeObserver | null = null, recoveryOwner: object | null = null;
    let ownedRenderer: ViewRenderer | null = null;
    const start = (r: ViewRenderer, name: 'webgpu' | 'webgl2') => {
      if (!live) { r.dispose?.(); return; }
      const owner = recoveryOwner = {};
      ownedRenderer = renderer.current = r;
      r.setRecoveryHost?.(viewportRecoveryHost(() => live && recoveryOwner === owner, notice => propsRef.current.onRecoveryNotice?.(notice)));
      r.setTheme(theme.current); r.aoEnabled = ao.current; r.trackFrameCost(frameCostOn.current); r.setRequestHost?.(() => requestRef.current());
      observer = new ResizeObserver(request); observer.observe(target);
      setBackend(name);
    };
    if (startupBackend === 'webgpu') {
      void GpuRenderer.create(target).then(r => start(r, 'webgpu'), () => {
        // A canvas that has acquired a WebGPU context cannot acquire WebGL2.
        if (live) setStartupBackend('webgl2');
      });
    } else {
      try { start(new Renderer(target), 'webgl2'); } catch (e) { setError(String(e)); }
    }
    return () => {
      live = false; recoveryOwner = null; observer?.disconnect(); ownedRenderer?.dispose?.();
      if (renderer.current === ownedRenderer) renderer.current = null;
    };
  }, [startupBackend]);
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
    syncDisplayedBodies(r);
    if (!sourceProps.printActive && !fitted.current && props.bodies.length) {
      const b = r.bounds();
      if (b) { fitBounds(b); fitted.current = true; }
    }
    r.setState(viewState()); request();
  }, [props.bodies, backend]);

  useEffect(() => {
    const c = camera.current;
    if (sourceProps.printActive) {
      if (!printCamera.current) printCamera.current = { original: { target: [...c.target], distance: c.distance, yaw: c.yaw, pitch: c.pitch, fovY: c.fovY, ortho: c.ortho }, summary: null };
      if (sourceProps.printDisplay && printCamera.current.summary !== sourceProps.printDisplay.summaryKey) {
        const box = printSceneBounds(sourceProps.bodies, sourceProps.printDisplay.summary.modelToBed, sourceProps.hiddenBodies);
        if (box) { c.aspect = canvas.current!.clientWidth / Math.max(1, canvas.current!.clientHeight); c.fit(box.min, box.max); printCamera.current.summary = sourceProps.printDisplay.summaryKey; }
      }
    } else if (printCamera.current) {
      const old = printCamera.current.original; c.target = [...old.target] as Vec3; c.distance = old.distance; c.yaw = old.yaw; c.pitch = old.pitch; c.fovY = old.fovY; setOrthographic(old.ortho); printCamera.current = null;
    }
    request();
  }, [sourceProps.printActive, sourceProps.printDisplay?.summaryKey, backend]);
  // (G23 CNC: the stock and the part framed once per package and setup; the camera as it was when the preview closes.)
  const camCamera = useRef<{ original: RenderCamera; key: string | null } | null>(null);
  const camKey = props.camDisplay ? `${props.camDisplay.packageKey}:${props.camDisplay.setupIndex}` : null;
  useEffect(() => {
    const c = camera.current;
    if (props.camActive) {
      if (!camCamera.current) camCamera.current = { original: { target: [...c.target], distance: c.distance, yaw: c.yaw, pitch: c.pitch, fovY: c.fovY, ortho: c.ortho }, key: null };
      const stock = props.camDisplay?.package.stock;
      if (camKey && camCamera.current.key !== camKey && stock && !('refused' in stock)) {
        const box = camStockBounds(stock), body = renderer.current?.bounds();
        if (body) for (let k = 0; k < 3; k++) { box.min[k] = Math.min(box.min[k], body.min[k]); box.max[k] = Math.max(box.max[k], body.max[k]); }
        c.aspect = canvas.current!.clientWidth / Math.max(1, canvas.current!.clientHeight); c.fit(box.min, box.max); camCamera.current.key = camKey;
      }
    } else if (camCamera.current) {
      const old = camCamera.current.original; c.target = [...old.target] as Vec3; c.distance = old.distance; c.yaw = old.yaw; c.pitch = old.pitch; c.fovY = old.fovY; setOrthographic(old.ortho); camCamera.current = null;
    }
    request();
  }, [props.camActive, camKey, backend]);

  const displayScope = displayModeScope(props), hasInstances = !!props.instances?.length;
  useEffect(() => { if (backend) props.onBackend?.(backend); }, [backend, props.onBackend]);
  useEffect(() => { renderer.current?.setState(viewState()); request(); }, [props.modelUnavailable, props.selection, props.ghost, props.offsets, props.transforms, props.bodyColors, props.faceColors, props.hiddenBodies, props.hoverBody, props.displayMode, props.isolatedInstances, displayScope, hasInstances, backend]);
  // (Handles and gizmos are new objects on every render of the app: drawn again only when they move.)
  const shapeOf = (v: unknown) => JSON.stringify(v, (_k, x) => typeof x === 'function' ? undefined : x);
  const overlayKey = shapeOf([props.gizmo, props.handles]);
  useEffect(() => { request(); }, [props.sketch, overlayKey]);
  useEffect(() => { renderer.current?.setRender?.(props.render ?? null); request(); }, [props.render, backend]);
  useEffect(() => { renderer.current?.setAnalysis?.(props.analysis ?? null); request(); }, [typeof props.analysis === 'object' && props.analysis ? `${props.analysis.sinLimit}:${props.analysis.bedZ}` : props.analysis, backend]);
  useEffect(() => { renderer.current?.setThreads?.(props.threads ?? new Float32Array()); request(); }, [props.threads, backend]);
  useEffect(() => { renderer.current?.setRegions?.(props.regions?.length ? regionMesh(props.regions) : null); request(); }, [props.regions, backend]);
  useEffect(() => { renderer.current?.setDirect?.(props.direct ?? [], props.directSelection ?? []); request(); }, [props.direct, props.directSelection, backend]);
  useEffect(() => { renderer.current?.setClearanceDisplay?.(props.clearance ?? null); request(); }, [props.clearance, backend]);
  useEffect(() => {
    const r = renderer.current; if (!r) return;
    try {
      if (props.printDisplay && !r.setPrintDisplay) throw new Error('This renderer does not support print layers.');
      r.setPrintDisplay?.(props.printDisplay ?? null); setPrintError(null);
    } catch (error) { setPrintError(`Print layers (${backend ?? 'renderer'}) unavailable: ${error instanceof Error ? error.message : String(error)}`); }
    request();
  }, [props.printDisplay, backend]);
  useEffect(() => {
    const r = renderer.current; if (!r) return;
    try {
      if (props.camDisplay && !r.setCamDisplay) throw new Error('This renderer does not support the CNC preview.');
      r.setCamDisplay?.(props.camDisplay ?? null); setCamError(null);
    } catch (error) { setCamError(`CNC preview (${backend ?? 'renderer'}) unavailable: ${error instanceof Error ? error.message : String(error)}`); }
    request();
  }, [props.camDisplay, backend]);
  // (G24: the annotations' lines and heads on either renderer; their texts as WebGPU's planar labels, facing the eye when a
  // plane is nearly edge-on — rebuilt only when which ones face it changes. WebGL2 draws the texts in the SVG overlay.)
  useEffect(() => { renderer.current?.setAnnotationDrawings?.(props.annotations?.length ? pmiDrawings(props.annotations, props.annotationSelected ?? null) : null); request(); }, [props.annotations, props.annotationSelected, backend]);
  // (R1: which texts face the eye is checked in each frame — it was in each render, the viewport rendering every frame.)
  const pmiFacing = useRef('');
  const applyPmiLabels = () => {
    const r = renderer.current, p = propsRef.current; if (!r?.setOverlayLabels) return;
    const forward = camera.current.basis().forward;
    pmiFacing.current = p.annotations?.length ? pmiFacingKey(p.annotations, forward) : '';
    const l = p.annotations?.length ? pmiLabels(p.annotations, forward, p.annotationSelected ?? null) : null;
    r.setOverlayLabels('pmi:text', l?.plain.labels.length ? l.plain : null); r.setOverlayLabels('pmi:text:selected', l?.selected ?? null);
  };
  useEffect(() => { applyPmiLabels(); request(); }, [props.annotations, props.annotationSelected, backend]);
  useEffect(() => {
    const r = renderer.current, instances = props.instances ?? [];
    r?.setInstances?.(instances, props.instanceSelection ?? []);
    rendererInstances.current = r ? { renderer: r, instances } : null;
    request();
  }, [props.instances, props.instanceSelection, backend]);
  useEffect(() => { renderer.current?.setContactLinks?.(props.contactLinks ?? []); request(); }, [props.contactLinks, backend]);
  useEffect(() => { renderer.current?.setInstancePreview?.(props.instancePreview ?? null); request(); }, [props.instancePreview, backend]);
  useEffect(() => { renderer.current?.setInstanceTransforms?.(props.instanceTransforms ?? null); request(); }, [props.instanceTransforms, backend]);
  useEffect(() => { renderer.current?.setClip?.(props.clip ?? null); request(); }, [props.clip, backend]);
  useEffect(() => { renderer.current?.setSectionHatch?.(props.sectionHatch ?? null); request(); }, [props.sectionHatch, backend]);
  useEffect(() => { renderer.current?.setScalarMaps?.(props.scalarMaps ?? null); request(); }, [props.scalarMaps, backend]);
  useEffect(() => { renderer.current?.setMould?.(props.mould ?? null); request(); }, [props.mould, backend]);
  useEffect(() => { renderer.current?.setIsoclines?.(props.isoclines ?? null); request(); }, [props.isoclines, backend]);
  useEffect(() => { renderer.current?.setProposalOverlay?.(props.proposal ?? null); request(); }, [props.proposal, backend]);
  useEffect(() => {
    const r = renderer.current; if (!r || !props.onDisplayModeStatus) return;
    // Read after the render/analysis/clip setters above, before the requested frame.
    r.setState(viewState());
    const status = r.getDisplayModeStatus?.();
    if (status) {
      const next = instanceDisplayStatus(status, r, hasInstances)!;
      setDisplayStatus(previous => previous?.requested === next.requested && previous.effective === next.effective && previous.supported === next.supported && previous.reason === next.reason ? previous : next);
      props.onDisplayModeStatus(next);
    }
  }, [props.displayMode, displayScope, props.clip, hasInstances, props.onDisplayModeStatus, backend]);
  // (G16, for the flow: the same probes on either renderer — the frame's pixels at world points or over a grid, the edge and
  // the direct object a pick finds at a world point.)
  useEffect(() => {
    if (!import.meta.env?.DEV) return;
    const grab = async () => {
      const blob = await renderer.current?.capture?.(); if (!blob) return null;
      const bmp = await createImageBitmap(blob), c = new OffscreenCanvas(bmp.width, bmp.height), g = c.getContext('2d')!;
      g.drawImage(bmp, 0, 0);
      return { data: g.getImageData(0, 0, bmp.width, bmp.height).data, width: bmp.width, height: bmp.height };
    };
    const at = (img: { data: Uint8ClampedArray; width: number; height: number }, x: number, y: number) => {
      const i = (Math.min(img.height - 1, Math.max(0, Math.round(y))) * img.width + Math.min(img.width - 1, Math.max(0, Math.round(x)))) * 4;
      return [img.data[i], img.data[i + 1], img.data[i + 2]];
    };
    const screen = (p: Vec3) => camera.current.project(p, canvas.current!.clientWidth, canvas.current!.clientHeight);
    const w = window as unknown as Record<string, unknown>;
    w.__studioPixels = async (points: Vec3[]) => {
      const img = await grab(); if (!img) return null;
      const k = img.width / Math.max(1, canvas.current!.clientWidth);
      return points.map(p => { const q = screen(p); return at(img, q[0] * k, q[1] * k); });
    };
    w.__studioFrame = async (n: number) => {
      const img = await grab(); if (!img) return null;
      const out: number[] = [];
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) out.push(...at(img, ((i + 0.5) / n) * img.width, ((j + 0.5) / n) * img.height));
      return out;
    };
    w.__studioEdgeAt = (p: Vec3, radius = 6) => {
      const r = renderer.current; if (!r) return null;
      const q = screen(p), hit = r.pickEdge(q[0], q[1], camera.current, viewState(), radius);
      if (!hit) return null;
      const m = uploadedBodies.current?.bodies[hit.body]?.mesh, segs: number[][] = [];
      if (m) for (let s = 0; s < m.edgeLines.length; s += 6) if (m.edgeOfSegment[s / 3] === hit.edge) segs.push([...m.edgeLines.subarray(s, s + 6)]);
      return { ...hit, segments: segs, ...(bandRail(hit) ? { rail: bandRail(hit)!.name } : {}) };
    };
    w.__studioSelectedBandRail = () => bandRail(readSelectedBandRail())?.name ?? null;
    w.__studioCylinderDisplayBytes = () => propsRef.current.bodies[0]?.mesh.cylinderDetail?.tiers.map(packet =>
      packet.positions.byteLength + packet.normals.byteLength + packet.faceOfVertex.byteLength + packet.indices.byteLength + packet.edgeLines.byteLength + packet.edgeOfSegment.byteLength);
    w.__studioEye = () => camera.current.eye();
    // (O10, for the flow: tracking on or off, and the last frame tracked in each display mode.)
    w.__studioFrameCost = (on?: boolean) => { if (on !== undefined) { frameCostOn.current = on; renderer.current?.trackFrameCost(on); requestRef.current(); } return renderer.current?.frameCosts() ?? {}; };
    w.__studioDirectAt = (p: Vec3) => { const q = screen(p); return renderer.current?.pickDirect?.(q[0], q[1], camera.current) ?? null; };
    w.__studioInstanceAt = (p: Vec3) => { const q = screen(p); return renderer.current?.pickInstanceFace?.(q[0], q[1], camera.current) ?? null; };
    w.__studioInstanceEdgeAt = (p: Vec3) => { const q = screen(p); return renderer.current?.pickInstanceEdge?.(q[0], q[1], camera.current) ?? null; };
    w.__studioProject = (p: Vec3) => screen(p);
    // (RS2, for the flow: the links marked in contact as a motion plays.)
    w.__studioContactLinks = () => [...(propsRef.current.contactLinks ?? [])];
  }, [backend]);
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
  // G13: the frames' triads and names as engine lines and labels on WebGPU, over the scene; made when the pose moves them
  // (keyed by their content).
  const frames = props.frames, frameSize = props.frameSize ?? 25;
  const framesKey = frames?.length && !sketching ? JSON.stringify([frameSize, frames.map(f => [f.name, f.kind ?? '', ...f.o, ...f.R])]) : '';
  useEffect(() => {
    const r = renderer.current; if (!r?.setOverlayLines || !r.setOverlayLabels) return;
    const list = framesKey ? (JSON.parse(framesKey)[1] as (string | number)[][]).map(a => ({ name: a[0] as string, kind: (a[1] || undefined) as FrameTriad['kind'], o: a.slice(2, 5) as Vec3, R: a.slice(5) as number[] })) : [];
    // (The names first, the axes after them: drawn later, an axis that turns under its name stays seen over the chip.)
    for (const kind of ['tool', 'sensor'] as const) {
      const labels = list.filter(f => (f.kind ?? 'tool') === kind).map(f => ({ text: f.name, at: f.o, size: 11, align: [0, 1] as const, offset: [8, -6] as const }));
      r.setOverlayLabels('frames:' + kind, labels.length ? { labels, color: '#121315', chip: { fill: FRAME_CHIP[kind], padding: 3 }, over: true } : null);
    }
    for (const [axis, color] of FRAME_AXES) {
      const segments = list.flatMap(f => [...f.o, ...frameAxisEnds(f, frameSize)[axis]]);
      r.setOverlayLines('frames:' + axis, segments.length ? { segments, color, width: 2, over: true } : null);
    }
    request();
  }, [framesKey, frameSize, backend]);
  // (DEV, for the flow: the frames drawn, each's origin and axis ends in the world.)
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as { __studioFrameTriads: () => unknown }).__studioFrameTriads = () => (framesKey ? props.frames ?? [] : []).map(f => ({ name: f.name, kind: f.kind ?? 'tool', o: f.o, ...frameAxisEnds(f, frameSize) }));
  });
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

  const sketchRail = useRef<ScreenBox | undefined>(undefined);
  useLayoutEffect(() => {
    const view = canvas.current, rail = view?.closest('.stage')?.querySelector('nav.toolbar');
    if (!sketching || !view || !rail) return;
    const read = () => {
      const canvasBox = view.getBoundingClientRect(), railBox = rail.getBoundingClientRect();
      sketchRail.current = { x: railBox.left - canvasBox.left, y: railBox.top - canvasBox.top,
        width: railBox.width, height: railBox.height };
      requestRef.current();
    };
    const observer = new ResizeObserver(read);
    observer.observe(view);
    observer.observe(rail);
    read();
    return () => { observer.disconnect(); sketchRail.current = undefined; };
  }, [sketching]);

  // The sketch rail replaces the Model rail in the same commit as the sketch.
  const pendingSketchFrame = useRef<{ min: [number, number]; max: [number, number]; plane: SketchPlane } | null>(null);
  useLayoutEffect(() => {
    const frame = pendingSketchFrame.current, view = canvas.current;
    pendingSketchFrame.current = null;
    if (!frame || !view || frame.plane !== props.sketch?.plane) return;
    const { min, max, plane } = frame;
    const w = Math.max(1, view.clientWidth), h = Math.max(1, view.clientHeight);
    const area = modelFitArea(view), c = camera.current;
    c.aspect = w / h;
    c.faceNormal(plane.normal);
    c.frameAt(toWorld(plane, [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2]),
      [max[0] - min[0], max[1] - min[1]], area?.left ?? 0, area ? 1 - area.right : 0);
    request();
  }, [props.sketch?.plane]);

  const boundsForFit = () => sourceProps.printActive
    ? sourceProps.printDisplay && printSceneBounds(sourceProps.bodies, sourceProps.printDisplay.summary.modelToBed, sourceProps.hiddenBodies)
    : renderer.current?.bounds(!props.sketch && !props.render && !sourceProps.camActive);

  useImperativeHandle(ref, () => ({
    camera: camera.current,
    startRectangleAt: input.startRectangleAt,
    fit(box) { const b = sourceProps.printActive ? boundsForFit() : box ?? boundsForFit(); if (b) fitBounds(b); request(); },
    setView(name) { camera.current.setView(name); const b = boundsForFit(); if (b) fitBounds(b); request(); },
    frameSketch(min, max, plane) { pendingSketchFrame.current = { min, max, plane }; },
    faceActiveSketch() {
      const plane = propsRef.current.sketch?.plane;
      if (!plane) return;
      camera.current.faceNormal(plane.normal);
      request();
    },
    toggleOrtho() { setOrthographic(!camera.current.ortho); request(); return camera.current.ortho; },
    getDisplayModeStatus() {
      const status = renderer.current?.getDisplayModeStatus?.() ?? null;
      return instanceDisplayStatus(status, renderer.current, !!propsRef.current.instances?.length);
    },
    setTheme(name) { theme.current = name; setThemeName(name); renderer.current?.setTheme(name); request(); },
    setAo(on) { ao.current = on; if (renderer.current) renderer.current.aoEnabled = on; request(); },
    capture() { return renderer.current?.capture ? renderer.current.capture() : Promise.resolve(null); },
    async createRenderPathTrace() {
      const r = renderer.current, c = canvas.current;
      if (!propsRef.current.render || !r?.createPathTrace || !c) throw new Error('Path tracing needs the Render workspace and WebGPU.');
      r.render(camera.current, viewState());
      const width = 640, height = Math.max(1, Math.round(width * c.clientHeight / Math.max(1, c.clientWidth)));
      const session = await r.createPathTrace(camera.current, { width, height });
      if (renderer.current !== r || !propsRef.current.render) { session.dispose(); throw new Error('The Render workspace closed before the still was ready.'); }
      return session;
    },
    recordVideo(count, fps, draw) { return recordCanvas(canvas.current!, count, fps, draw, request, renderer.current?.drawNow ? () => renderer.current?.drawNow?.() : undefined); },
    pickRenderFocus(done) {
      finishFocusPick(null);
      if (!propsRef.current.render || propsRef.current.sketch || !renderer.current?.pickSurfacePoint) { done(null); return () => undefined; }
      focusPick.current = done; setPickingFocus(true);
      return () => { if (focusPick.current === done) finishFocusPick(null); };
    },
    getCamera() { const c = camera.current; return { target: [...c.target] as [number, number, number], distance: c.distance, yaw: c.yaw, pitch: c.pitch, fovY: c.fovY, ortho: c.ortho }; },
    setCamera(v) { const c = camera.current; c.target = [...v.target] as Vec3; c.distance = v.distance; c.yaw = v.yaw; c.pitch = v.pitch; c.fovY = v.fovY; setOrthographic(v.ortho); request(); },
    get backend() { return backend; },
    overlayLines() { return renderer.current?.overlayLines?.() ?? {}; },
    overlayTexts() { return renderer.current?.overlayTexts?.() ?? {}; },
    computeDevice() { return renderer.current?.computeDevice?.() ?? null; },
    trackFrameCost(on) { frameCostOn.current = on; renderer.current?.trackFrameCost(on); request(); },
    frameCosts() { return renderer.current?.frameCosts() ?? {}; },
  }));

  const sketchTool = props.sketch?.tool;
  useEffect(input.resetSketchTool, [sketchTool, !!props.sketch]);

  // Overlay: sketch preview, dimension labels and the move gizmo, projected each frame.
  /** G24 on WebGL2 (no engine labels): each annotation text at its point, facing the eye, in the SVG overlay. */
  const pmiSvg = (items: readonly ModelAnnotation[], selected: string | null) => {
    const c = canvas.current; if (!c) return null;
    const w = c.clientWidth, h = c.clientHeight, texts: React.ReactNode[] = [];
    for (const a of items) for (const [k, t] of a.texts.entries()) {
      const q = camera.current.project(t.at as Vec3, w, h);
      if (!Number.isFinite(q[0]) || !Number.isFinite(q[1])) continue;
      texts.push(<text key={a.id + ':' + k} x={q[0]} y={q[1]} textAnchor={t.align} className={'pmi-text' + (a.id === selected ? ' sel' : '')}>{t.text}</text>);
    }
    return <svg className="vp-overlay pmi" width={w} height={h} aria-hidden="true">{texts}</svg>;
  };
  const overlay = () => {
    /** The overlay lines are the engine's (G7): only their labels, points and texts stay SVG. */
    const engineLines = !!renderer.current?.setOverlayLines;
    const c = canvas.current; if (!c) return null;
    const w = c.clientWidth, h = c.clientHeight; const cam = camera.current;
    const items: React.ReactNode[] = [];
    const sk = props.sketch;
    const workArea = sk?.editDim ? modelFitArea(c) : undefined;
    const dimensionArea = sk?.editDim ? workArea ? {
      x: workArea.left * w, y: workArea.top * h,
      width: (workArea.right - workArea.left) * w, height: (workArea.bottom - workArea.top) * h,
    } : { x: 4, y: 4, width: w - 8, height: h - 8 } : undefined;
    const inspection = constraintInspection?.owner === sk && drag.current.mode !== 'spline' ? constraintInspection : null;
    const reference = props.sketchSnaps?.twoPoint.read();
    const extension = props.sketchSnaps?.extension.read(sk);
    const referenceHit = reference?.preview ? { at: reference.preview, kind: 'calculated' as const }
      : reference?.picking && twoPointHover.current?.points === reference.points ? twoPointHover.current.hit : null;
    const editor = sk ? drawSketchOverlay({
      sk, shape: drag.current.mode === 'spline' ? liveShape.current : sk.shape, cam, w, h, rail: sketchRail.current, dimensionArea,
      draft: reference ? { cursor: referenceHit?.at ?? null, snap: referenceHit } : sketchDraft.current, bezierPoles: bezierDraft.current.poles, ellipse: ellipseDraft.current, centreArc: carc.current,
      extensionGuide: extension?.stage === 'guide' ? extension.guide : undefined,
      pathGap: props.pathGap?.read(sk) ?? undefined,
      circleChord: props.circleChord?.read(sk) ?? undefined,
      overlaidLine: props.overlaidLine,
      dragTrim: input.dragTrimPreview(),
      inspected: inspection?.target === 'row' ? inspection.entry.involves
        : inspection?.target === 'mobility' ? [inspection.entity] : undefined,
      constraintComparison: inspection?.target === 'comparison' && inspection.result.ok ? inspection.result.display : undefined,
      bandCache, picking: picking(sk), cutting: cutting(sk), banding: banding(sk), items,
      dimensions: { onDimClick: props.onDimClick, onDimEdit: props.onDimEdit, onDimCommit: props.onDimCommit },
    }) : null;
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
    for (const [k, vertex] of (props.pickedVertices ?? []).entries()) {
      const q = cam.project(vertex.at, w, h); items.push(<circle key={'vx' + k} cx={q[0]} cy={q[1]} r={6} className="vertex-mark selected" />);
    }
    const hoveredVertex = propsRef.current.modelUnavailable ? null : hover.current.vertex;
    let vertexSelected = false;
    if (hoveredVertex) for (const vertex of props.pickedVertices ?? []) {
      if (vertex.body === hoveredVertex.body && vertex.at[0] === hoveredVertex.at[0] && vertex.at[1] === hoveredVertex.at[1] && vertex.at[2] === hoveredVertex.at[2]) { vertexSelected = true; break; }
    }
    if (hoveredVertex && !sk && !vertexSelected) {
      const q = cam.project(hoveredVertex.at, w, h); items.push(<circle key="vertex-hover" cx={q[0]} cy={q[1]} r={4} className="vertex-mark hover" />);
    }
    const ml = props.measureLine;
    if (ml) {
      const a = cam.project(ml.a, w, h), b = cam.project(ml.b, w, h), mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, tw = Math.max(52, ml.label.length * 7 + 14);
      items.push(<g key="measure" className="measure" data-engine-lines={engineLines ? 1 : undefined}>{!engineLines && <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} className="measure-line" />}
        <circle cx={a[0]} cy={a[1]} r={3.5} className="measure-point" /><circle cx={b[0]} cy={b[1]} r={3.5} className="measure-point" />
        {!engineLines && <><rect x={mx - tw / 2} y={my - 24} width={tw} height={20} rx={4} className="dim-chip" /><text x={mx} y={my - 10} textAnchor="middle" className="dim-text">{ml.label}</text></>}</g>);
    }
    // A proposal's volume chips (G12), where the renderer draws no labels (WebGL2, G16): at each material's box top, as the GPU's.
    const pr = props.proposal;
    // (Stacked over the two boxes' top, as the GPU's: they never meet.)
    if (pr && !sk && !renderer.current?.setOverlayLabels) for (const { side, at, stack, text } of proposalChips(pr)) {
      const q = cam.project(at, w, h), y = q[1] - 26 - stack * PROPOSAL_CHIP_STEP;
      const tw = text.length * 7 + 12, fill = side === 'added' ? PROPOSAL_ADDED : PROPOSAL_REMOVED;
      items.push(<g key={'proposal:' + side} aria-label={side === 'added' ? 'Material added' : 'Material removed'}><rect x={q[0] - tw / 2} y={y} width={tw} height={20} rx={4} style={{ fill }} />
        <text x={q[0]} y={y + 14} textAnchor="middle" className="dim-text" style={{ fill: '#ffffff' }}>{text}</text></g>);
    }
    // G13: frame axes stay at their projected origins; names occupy separate screen-space chips (WebGL2).
    if (props.frames?.length && !sk && !engineLines) {
      const placed: { x: number; y: number; width: number }[] = [], leaders: React.ReactNode[] = [], labels: React.ReactNode[] = [];
      const margin = 4, gap = 2, height = 16;
      for (const f of props.frames) {
        const q = cam.project(f.o, w, h), ends = frameAxisEnds(f, props.frameSize ?? 25), kind = f.kind ?? 'tool';
        const width = f.name.length * 7 + 8, preferredX = q[0] + 8, preferredY = q[1] - 22;
        const x = Math.max(margin, Math.min(Math.max(margin, w - margin - width), preferredX));
        const clampY = (y: number) => Math.max(margin, Math.min(Math.max(margin, h - margin - height), y));
        const overlappingX = placed.filter(b => x < b.x + b.width + gap && x + width + gap > b.x);
        const candidates = [...new Set([clampY(preferredY), ...overlappingX.flatMap(b => [clampY(b.y - height - gap), clampY(b.y + height + gap)])])];
        candidates.sort((a, b) => Math.abs(a - preferredY) - Math.abs(b - preferredY) || a - b);
        // If the viewport cannot hold every chip, retain every name; no collision-free guarantee in that case.
        const y = candidates.find(y => overlappingX.every(b => y + height + gap <= b.y || y >= b.y + height + gap)) ?? clampY(preferredY);
        placed.push({ x, y, width });
        items.push(<g key={'frame:' + f.name} aria-label={`Frame triad ${f.name}`}>
          {FRAME_AXES.map(([axis, color]) => { const e = cam.project(ends[axis], w, h); return <line key={axis} x1={q[0]} y1={q[1]} x2={e[0]} y2={e[1]} style={{ stroke: color, strokeWidth: 2 }} />; })}</g>);
        if (x !== preferredX || y !== preferredY) leaders.push(<line key={'frame-label-leader:' + f.name} aria-label={`Frame label leader ${f.name}`} x1={q[0]} y1={q[1]} x2={Math.max(x, Math.min(x + width, q[0]))} y2={Math.max(y, Math.min(y + height, q[1]))} style={{ stroke: FRAME_CHIP[kind], strokeWidth: 1 }} />);
        labels.push(<g key={'frame-label:' + f.name} aria-label={`Frame label ${f.name}`}>
          <rect x={x} y={y} width={width} height={height} rx={3} style={{ fill: FRAME_CHIP[kind] }} />
          <text x={x + 4} y={y + 12} className="dim-text" style={{ fill: '#121315' }}>{f.name}</text>
        </g>);
      }
      // All axes and leaders precede every opaque chip and text, so no line can paint over a frame name.
      items.push(...leaders, ...labels);
    }
    if (props.tool) items.push(<g key="tool" className="vp-tool">{props.tool.marks(toolView())}</g>);
    const dr = drag.current;
    if (dr.mode === 'box' && dr.x0 !== undefined) {
      const crossing = dr.x < dr.x0;
      items.push(<rect key="box" x={Math.min(dr.x0, dr.x)} y={Math.min(dr.y0!, dr.y)} width={Math.abs(dr.x - dr.x0)} height={Math.abs(dr.y - dr.y0!)} className={crossing ? 'marquee crossing' : 'marquee'} />);
    }
    // Finished sketches waiting for a feature: their outlines, the picked ones filled.
    if (!sk && props.profiles?.length) for (const p of props.profiles) {
      const rings = p.rings.map(r => r.map(v => cam.project(v, w, h)));
      const fills = p.pickedRegions ? p.pickedRegions.flatMap(index => rings[index] ? [rings[index]] : []) : rings;
      items.push(<g key={'pf' + p.id} className={'profile' + (p.picked ? ' picked' : '')} data-profile={p.id} data-picked-regions={p.pickedRegions?.join(',')}>
        {p.picked && <path d={fills.map(r => 'M' + r.map(q => q[0].toFixed(1) + ',' + q[1].toFixed(1)).join('L') + 'Z').join('')} fillRule="evenodd" className="profile-fill" />}
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
    // The last handle let go, while its command runs and no drag is on: its value in a box beside its tip (roadmap 20 ④ ⑥).
    // (Only the command whose handle was let go: another command started over it, with a handle of the same id, gets none.)
    const vb = valueBox.current, mine = (hd: FeatureHandle) => !!vb && hd.id === vb.id && hd.owner === vb.owner && !!hd.editing;
    const boxed = !drag.current.mode && vb ? props.handles?.find(hd => mine(hd) && hd.onType && !hd.plane) : undefined;
    if (vb && !boxed && !props.handles?.some(mine)) valueBox.current = null;
    const valueEditor = boxed ? <HandleValueBox key={boxed.id} label={boxed.label} value={boxed.value} unit={boxed.unit ?? ''} at={handleLayout(boxed, projector()).to} width={w} height={h} onType={boxed.onType!} /> : null;
    // Axis triad, bottom-left, following the camera.
    const { right, up } = cam.basis(); const tx = 92, ty = h - 64;
    ['#e5534b', '#57b26b', '#4f8ff7'].forEach((color, k) => {
      const a: Vec3 = [0, 0, 0]; a[k] = 1;
      const x = a[0] * right[0] + a[1] * right[1] + a[2] * right[2], y = -(a[0] * up[0] + a[1] * up[1] + a[2] * up[2]);
      items.push(<g key={'t' + k}><line x1={tx} y1={ty} x2={tx + x * 20} y2={ty + y * 20} stroke={color} strokeWidth={2.5} strokeLinecap="round" />
        <text x={tx + x * 27} y={ty + y * 27 + 3} fontSize={9} textAnchor="middle" fill={color} fontFamily="IBM Plex Mono">{'XYZ'[k]}</text></g>);
    });
    const basis = cam.basis();
    return <><svg className="vp-overlay" width={w} height={h} aria-hidden="true">{items}</svg>{editor}{valueEditor}
      {!propsRef.current.sketch && <ViewCube right={basis.right} up={basis.up} forward={basis.forward} onLook={lookFrom} onOrbit={(dx, dy) => { camera.current.orbit(dx, dy); request(); }} />}</>;
  };

  const drawOverlay = () => <>{overlay()}{!renderer.current?.setOverlayLabels && !!props.annotations?.length && pmiSvg(props.annotations, props.annotationSelected ?? null)}</>;
  return (
    <div className="viewport" data-renderer={backend ?? undefined} data-focus-picking={pickingFocus || undefined}
      data-display-mode-requested={props.requestedDisplayMode ?? props.displayMode ?? 'shaded-with-edges'}
      data-display-mode-effective={displayStatus?.effective ?? props.displayMode ?? 'shaded-with-edges'}
      data-display-mode-supported={props.displayModeReason ? false : displayStatus?.supported}
      data-display-mode-reason={props.displayModeReason ?? displayStatus?.reason}
      {...input.placementHandlers}>
      <canvas key={startupBackend} ref={canvas} className="vp-canvas" {...input.canvasHandlers} aria-label="3D viewport. Right-drag to orbit, middle-drag to pan, wheel to zoom." />
      <FrameOverlay ticker={ticker} draw={drawOverlay} />
      {error && <div className="vp-error" role="alert">{error}</div>}
      {printError && <div className="vp-error" role="alert">{printError}</div>}
      {camError && <div className="vp-error" role="alert">{camError}</div>}
    </div>
  );
});
