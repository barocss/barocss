import { useCallback, useLayoutEffect, useRef, useState, type DragEvent, type MouseEvent, type PointerEvent, type RefObject, type WheelEvent } from 'react';
import { CadPartLimits, ExtrudedProfileLimits } from '@barocss/cad';
import type { ModelAnnotation } from '@barocss/cad-model/drawing/annotations3d';
import type { BodyResult } from '@barocss/cad-model/engine/evaluate';
import { insideRing, segmentDistance } from '@barocss/cad-model/engine/geom2';
import type { Vec3 } from '@barocss/cad-model/engine/mesh';
import type { RenderSettings } from '@barocss/cad-model/engine/render';
import { bandShapes } from '@barocss/cad-model/sketch/band';
import { bezierError, wellFormedBezier } from '@barocss/cad-model/sketch/bezier';
import { ellipseShape } from '@barocss/cad-model/sketch/ellipse';
import { nearestSnap, shapeSnaps, type SnapPoint } from '@barocss/cad-model/sketch/osnap';
import { currentModelSketchSnaps, modelSketchSnaps, type ModelSketchSnaps } from './modelSketchSnaps';
import { rayOnPlane, toWorld, type SketchPlane } from '@barocss/cad-model/sketch/plane';
import { bulgeThrough, slotSegments } from '@barocss/cad-model/sketch/profile';
import { pickShapeAt } from '@barocss/cad-model/sketch/select';
import { respline, splineEditError, splineOutline, type SplineDef } from '@barocss/cad-model/sketch/spline';
import { extendPreview, splitPreview, trimPreview } from '@barocss/cad-model/sketch/trim';
import type { SketchShape, SketchState } from '@barocss/cad-model/sketch/types';
import { pickCage, type CageHit } from '@barocss/cad-model/subd/cageEdit';
import { sketchCutInputs } from '../app/sketchControls';
import { showsRearEdges } from './displayPolicy';
import { meshCrossesBox } from './boxSelectionCrossing';
import { bodyEntirelyBehindEye } from './boxSelectionDepth';
import type { OrbitCamera } from './camera';
import { ellipseClick, type EllipseDraft } from './ellipseDraft';
import { DragTrimStroke, type DragTrimOwner, type DragTrimPlan } from './dragTrimStroke';
import { dragAbout, dragAlong, dragIn, dragPlane, dragScale, dragTurn, GIZMO_PX, hitTest, snapTo, type FeatureHandle, type GizmoCancelReason, type GizmoHit, type Projector, type TransformGizmo } from './gizmo';
import { pmiPick } from './pmiGeometry';
import type { PrintDisplay } from './printDisplay';
import type { EdgeRef, FaceRef, SectionClip, ViewRenderer, ViewState } from './renderer';
import { renderFocusDistance } from './renderFocus';
import type { CentreArcDraft, SketchOverlayDraft } from './sketchOverlay';
import { orthographicSketchScale, pickSketchViewport, type SketchViewportPick } from './sketchOutlinePick';
import { closedSplineOf, draggedSpline, sameSplineDef, splineDragStarted, splineHandleHit, type SplineHandleHit } from './splineHandles';
import { arcExtensionPoint, uniqueArcTerminal } from '../sketch/arcExtension';
import { enabledObjectSnaps, type ObjectSnapKinds } from '../sketch/objectSnapKinds';
import { planPathGap } from '../sketch/pathGap';
import type { ArcExtensionInput } from '../sketch/useArcExtensionSnap';
import type { CircleChordDraft, CircleChordInput } from '../sketch/useCircleFromChord';
import type { PathGapDraft, PathGapInput } from '../sketch/usePathGap';
import type { TwoPointSnapInput } from '../sketch/useTwoPointSnap';
import { placedBoxSnapPoints, type PlacedBoxSnapPoint } from './placedBoxSnap';
import type { PlacedSketchSnapInput, PlacedSketchSnapSource } from './placedSketchSnaps';
import { pickVertex } from './vertexPick';
import type { CageOverlay, Spot, ToolView, ViewportTool } from './Viewport';

export interface ViewportPointerProps {
  /** Bed-frame print display, separate from the authored/native document. */
  printDisplay?: PrintDisplay | null;
  printActive?: boolean;
  camActive?: boolean;
  /** G2: the section's clip plane keeps dot(normal, p) ≥ offset on native bodies or placed parts. */
  clip?: SectionClip | null;
  /** G24: the drawing's annotations on the model (model-annotations-v1 items), the one picked, and a pick's callback. */
  annotations?: readonly ModelAnnotation[] | null;
  onPickAnnotation?(id: string): void;
  bodies: BodyResult[];
  hiddenBodies?: Set<number>;
  /** Grid step in mm for sketch points, placing and gizmo moves (0: off). */
  snapStep?: number;
  sketch: SketchState | null;
  sketchSnaps?: { twoPoint: TwoPointSnapInput; extension: ArcExtensionInput; crossingBodies?: readonly BodyResult[]; placed?: PlacedSketchSnapInput; objectKinds?: ObjectSnapKinds };
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
  onPick(hit: { face: FaceRef | null; edge: EdgeRef | null; edgeMesh?: BodyResult['mesh']; point: Vec3 | null; direct?: string; instance?: string; instanceFace?: FaceRef; instanceCap?: { body: number }; vertex?: { body: number; at: Vec3 } }, additive: boolean): void;
  /** `fresh`: a new shape starts (the current one, if closed, is kept beside it). */
  onSketchShape(shape: SketchShape | null, fresh?: boolean, origin?: 'line-point'): void;
  onSplineDragChange?(active: boolean): void;
  onCursor(p: Vec3 | null): void;
  /** Use projected triangle overlap for crossing boxes in the idle native Model view. */
  meshBoxCrossing?: boolean;
  onBoxSelect(bodies: number[], additive: boolean): void;
  onContextMenu(at: { x: number; y: number }, hit: { face: FaceRef | null; edge: EdgeRef | null; point: Vec3 | null; instance?: string; instanceFace?: FaceRef; instanceMesh?: BodyResult['mesh']; instanceCap?: { body: number } }): void;
  /** Select / Dimension tool clicks on the outline (null: empty space); opening and committing the dimension editor. */
  onSketchPick?(hit: SketchViewportPick | null, additive: boolean): void;
  /** Band tool clicks: the index (in done, then the current shape) of the closed shape under the pointer, or null. */
  onSketchBandPick?(index: number | null): void;
  /** Trim, Extend and Split tools: a click at `at` (plane mm), `tol` mm the pick reach. */
  onSketchTrim?(op: 'trim' | 'extend' | 'split', at: [number, number], tol: number): void;
  dragTrim?: Pick<DragTrimOwner, 'doc' | 'scope'> & { apply(owner: DragTrimOwner, plan: DragTrimPlan): void };
  pathGap?: PathGapInput;
  circleChord?: CircleChordInput;
  /** What clicks pick: whatever is under the pointer, or only faces, edges or whole bodies. */
  pickFilter?: 'all' | 'face' | 'edge' | 'body';
  /** Render settings (the Render workspace), or null for the modelling look. */
  render?: RenderSettings | null;
  /** The selected direct object's poles (drawn as dots; a click near one picks it), and the picked one. */
  poles?: { key: string; at: Vec3 }[];
  onPickPole?(key: string): void;
  onHoverScalar?(value: number | null): void;
  /** Finished sketches and their selected material regions in world coordinates. */
  profiles?: { id: number; rings: Vec3[][]; picked: boolean; outerCount: number; canPickRegion: boolean; retained: boolean; pickedRegions?: number[] }[];
  onPickProfile?(id: number | null, additive: boolean, region?: number): void;
  /**
   * A SubD cage being edited (R8.2, D81): drawn over the body (edges, vertices, the selection, what its validation
   * flags), clicks pick in its mode (Shift adds), a double-click on an edge its loop (Alt: its ring).
   */
  cage?: CageOverlay | null;
  /** A tool on the pointer and the overlay (G17: the 3D skeleton sketch), or none. */
  tool?: ViewportTool | null;
  onPickCage?(hit: CageHit | null, additive: boolean, grow?: 'loop' | 'ring'): void;
}

interface PointerInput {
  canvas: RefObject<HTMLCanvasElement | null>;
  camera: RefObject<OrbitCamera>;
  propsRef: RefObject<ViewportPointerProps>;
  rendering: {
    renderer: RefObject<ViewRenderer | null>;
    rendererBodies: RefObject<readonly BodyResult[]>;
    rendererInstances: RefObject<{ renderer: ViewRenderer; instances: readonly { id: string; bodies: readonly BodyResult[] }[] } | null>;
    request(): void;
    requestRef: RefObject<() => void>;
    moving: RefObject<() => void>;
    viewState(): ViewState;
    hover: RefObject<ViewportHover>;
  };
  focus: {
    focusPick: RefObject<((focus: number | null) => void) | null>;
    finishFocusPick(focus: number | null): void;
  };
}

export interface ViewportHover {
  face: FaceRef | null;
  edge: EdgeRef | null;
  vertex?: { body: number; at: Vec3 } | null;
}

interface PointerDrag {
  mode: 'orbit' | 'pan' | 'gizmo' | 'box' | 'tool' | 'spline' | null;
  x: number;
  y: number;
  moved: boolean;
  x0?: number;
  y0?: number;
  pointerId?: number;

  circleChord?: { pointer: number; draft: CircleChordDraft; frame: string };
  splineArm?: { hit: SplineHandleHit; pointerId: number };
  splineHit?: SplineHandleHit;
  splineStart?: SketchShape;
  splineLast?: SketchShape;
  splineLastDef?: SplineDef;

  // A gizmo drag starts at `from` and keeps its latest point and values.
  hit?: GizmoHit;
  from?: [number, number];
  last?: [number, number];
  turned?: number;
  delta?: Vec3;
  degrees?: number;
  value?: number;
  start?: number;
  value2?: number;
  start2?: number;
  origin?: Vec3;
  handleAt?: Vec3;
  handleToValue?: FeatureHandle['toValue'];
  factor?: number;
  gizmo?: TransformGizmo;
  sessionKey?: string | number;
}

const sameRef = (a: { body: number; face?: number; edge?: number } | null | undefined, b: { body: number; face?: number; edge?: number } | null | undefined) =>
  a === b || (!!a && !!b && a.body === b.body && a.face === b.face && a.edge === b.edge);
/** Whether two hover states pick the same face, edge and vertex (they are compared on every pointer move). */
function sameHover(a: ViewportHover, b: ViewportHover): boolean {
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
/** A cap is an instance/body hit, with no native face operation authority. Unknown faces are not caps. */
export function instancePickFields(hit: { id: string; body: number; face: number; cap?: true }): { instance: string; instanceFace?: FaceRef; instanceCap?: { body: number } } {
  if (hit.cap === true) return { instance: hit.id, instanceCap: { body: hit.body } };
  return hit.face >= 0 ? { instance: hit.id, instanceFace: { body: hit.body, face: hit.face } } : { instance: hit.id };
}
/** The drag-and-drop type of a command dragged from the rail (its id is the data). */
export const DRAG_TYPE = 'application/x-cad-command';

export const picking = (sk: SketchState | null) => sk?.tool === 'select' || sk?.tool === 'dimension';
/** Trim, Extend and Split: a click edits the piece under it (no snapping). */
export const cutting = (sk: SketchState | null) => sk?.tool === 'trim' || sk?.tool === 'extend' || sk?.tool === 'split';
/** Band tool: a click picks a whole closed shape (no snapping). */
export const banding = (sk: SketchState | null) => sk?.tool === 'band';

function circleRadiusAt(centre: readonly number[], point: readonly number[], snapped: boolean): number {
  const radius = Math.hypot(point[0] - centre[0], point[1] - centre[1]);
  return snapped ? radius : Math.max(1, Math.round(radius));
}

const authoredSnapPoint = ([x, y]: [number, number]): [number, number] =>
  [Math.round(x * 1e4) / 1e4, Math.round(y * 1e4) / 1e4];

function slotRadiusAt(a: readonly number[], b: readonly number[], point: readonly number[], snapped: boolean): number {
  const x = b[0] - a[0], y = b[1] - a[1];
  const length = Math.hypot(x, y) || 1;
  const offset = Math.abs((point[0] - a[0]) * y - (point[1] - a[1]) * x) / length;
  return snapped ? offset : Math.max(0.5, Math.round(offset * 2) / 2);
}

export function useViewportPointerInput({ canvas, camera, propsRef, rendering, focus }: PointerInput) {
  const { renderer, rendererBodies, rendererInstances, request, requestRef, moving, viewState, hover } = rendering;
  const { focusPick, finishFocusPick } = focus;
  const sketch = propsRef.current.sketch;

  /** A corner of the body under the pointer within 7 px (an end of one of its edges), when the filter takes corners. */
  const vertexAt = (x: number, y: number, w: number, h: number, hit: { face: FaceRef | null; edge: EdgeRef | null }): { body: number; at: Vec3 } | null => {
    const f = propsRef.current.pickFilter ?? 'all';
    if (f !== 'all') return null;
    const bi = hit.edge?.body ?? hit.face?.body;
    if (bi === undefined) return null;
    const mesh = propsRef.current.bodies[bi]?.mesh; if (!mesh) return null;
    const print = propsRef.current.printDisplay;
    if (print && hit.face && mesh.faces.some(face => face.index === hit.face!.face && face.id === 'section-cap')) return null;
    const view = viewState();
    const native = !print && !propsRef.current.camActive && !propsRef.current.clip && !view.offsets.has(bi) && !view.transforms?.has(bi) && !view.ghostBodies.has(bi);
    const source = native ? hit.edge ? { mesh, edge: hit.edge.edge } : hit.face ? { mesh, face: hit.face.face } : undefined : undefined;
    return pickVertex(f, bi, mesh.edges, x, y, p => camera.current.project(p as Vec3, w, h), print?.printed ? print.top : undefined, source, camera.current.ortho);
  };
  const drag = useRef<PointerDrag>({ mode: null, x: 0, y: 0, moved: false });
  /** The gizmo handle under the pointer, drawn brighter. */
  const gizmoHot = useRef<GizmoHit | null>(null);
  /** The feature handle last let go and its command: its value box shows while that command runs (roadmap 20 ⑥). */
  const valueBox = useRef<{ id: string; owner: unknown } | null>(null);
  const drafting = useRef(false);
  const slotStage = useRef(0);
  /** The Spline tool's points so far (the curve through them is drawn as tangent arcs). */
  const splineFit = useRef<[number, number][] | null>(null);
  /** The Bézier tool's control points before they make a shape (fewer than three); `open`: the current shape is a quadratic a fourth click makes cubic (D354). */
  const bezierDraft = useRef<{ poles: [number, number][]; open: boolean }>({ poles: [], open: false });
  /** The Ellipse tool's clicks so far: the centre, then the end of the first axis (the ellipse follows the pointer until the third). */
  const ellipseDraft = useRef<EllipseDraft | null>(null);
  /** The centre arc being drawn: its centre, then its start and how far it has turned (signed, radians). */
  const carc = useRef<CentreArcDraft | null>(null);
  const carcEnd = (d: NonNullable<typeof carc.current>): [number, number] => {
    const r = Math.hypot(d.a![0] - d.c[0], d.a![1] - d.c[1]), t = Math.atan2(d.a![1] - d.c[1], d.a![0] - d.c[0]) + d.sweep, r6 = (v: number) => Math.round(v * 1e6) / 1e6;
    return [r6(d.c[0] + r * Math.cos(t)), r6(d.c[1] + r * Math.sin(t))];
  };
  // Keep the emitted shape current until the app sends a different shape.
  const liveShape = useRef<SketchShape | null>(sketch?.shape ?? null), seenShape = useRef(sketch?.shape);
  if (sketch?.shape !== seenShape.current) {
    seenShape.current = sketch?.shape;
    liveShape.current = sketch?.shape ?? null;
    if (!sketch?.shape) { drafting.current = false; slotStage.current = 0; }
  }
  const emit = (shape: SketchShape | null, fresh = false, origin?: 'line-point') => { liveShape.current = shape; propsRef.current.onSketchShape(shape, fresh, origin); };
  /** The grid step (mm) points snap to: the studio's setting (0: off, to a micrometre). */
  const snap = (v: number) => { const st = propsRef.current.snapStep ?? 1; return st > 0 ? Math.round(Math.round(v / st) * st * 1000) / 1000 : Math.round(v * 1000) / 1000; };
  const sketchDraft = useRef<SketchOverlayDraft>({ cursor: null });
  const sketchHoverPointer = useRef<{ clientX: number; clientY: number } | null>(null);
  const [trimStroke] = useState(() => new DragTrimStroke());
  const pointerFrame = () => {
    const cam = camera.current, rect = canvas.current!.getBoundingClientRect();
    return [...cam.target, cam.distance, cam.yaw, cam.pitch, cam.fovY, cam.ortho,
      cam.aspect, rect.left, rect.top, rect.width, rect.height].join(':');
  };
  const trimOwner = (event?: { shiftKey: boolean; altKey: boolean }): DragTrimOwner | null => {
    const { sketch, dragTrim, pathGap } = propsRef.current;
    return !event?.shiftKey && !event?.altKey && sketch?.tool === 'trim' && dragTrim && !pathGap?.read(sketch)
      ? { sketch, doc: dragTrim.doc, scope: dragTrim.scope } : null;
  };
  const cancelDragTrim = (pointer?: number) => {
    if (!trimStroke.cancel(pointer)) return false;
    sketchDraft.current.trim = null;
    requestRef.current();
    return true;
  };
  const trimRail = (left: number, top: number) => {
    const rail = canvas.current?.closest('.studio')?.querySelector('nav.toolbar');
    const rect = rail?.getBoundingClientRect();
    return rect && rect.width > 0 && rect.height > 0
      ? { left: rect.left - left, right: rect.right - left, top: rect.top - top, bottom: rect.bottom - top }
      : undefined;
  };
  const livePolygonMiddle = useRef(false);
  const twoPointHover = useRef<{ points: readonly SnapPoint[]; hit: SnapPoint | null } | null>(null);
  const modelSnapCache = useRef<ModelSketchSnaps | null>(null);
  const placedSnapCache = useRef<{ sources: readonly PlacedSketchSnapSource[]; plane: SketchState['plane']; points: PlacedBoxSnapPoint[] } | null>(null);
  const { bodies: snapBodies, hiddenBodies: snapHidden } = propsRef.current;
  const snapPlaneKey = sketch ? JSON.stringify(sketch.plane) : null;
  const { crossingBodies, objectKinds, placed } = propsRef.current.sketchSnaps ?? {};
  const placedSources = placed?.current() ? placed.sources : undefined;
  const extensionDraft = propsRef.current.sketchSnaps?.extension.read(sketch);
  const chordActive = !!propsRef.current.circleChord?.read(sketch);
  const clearSketchSnap = useCallback(() => {
    const draft = sketchDraft.current;
    if (!draft.snap) return;
    draft.snap = null;
    draft.cursor = null;
    draft.extension = false;
    livePolygonMiddle.current = false;
    propsRef.current.onCursor(null);
    requestRef.current();
  }, [propsRef, requestRef]);
  useLayoutEffect(clearSketchSnap, [clearSketchSnap, snapPlaneKey, sketch?.plane, sketch?.done, sketch?.hideConstruction, sketch?.tool, extensionDraft]);
  useLayoutEffect(() => {
    if (chordActive && sketchDraft.current.snap?.kind === 'crossing') clearSketchSnap();
  }, [chordActive, clearSketchSnap]);
  useLayoutEffect(() => {
    const snap = sketchDraft.current.snap;
    if (!livePolygonMiddle.current || !snap) return;
    const shape = sketch?.shape;
    // A pointer move can update a pending arc and leave earlier segments intact.
    // Keep the cue only while its point is still a midpoint of the live chain.
    if (shape?.kind === 'polygon' && shapeSnaps(shape).some(point =>
      point.kind === 'mid' && point.at[0] === snap.at[0] && point.at[1] === snap.at[1])) return;
    clearSketchSnap();
  }, [sketch?.shape, clearSketchSnap]);
  useLayoutEffect(() => {
    const cached = modelSnapCache.current;
    if (!cached || currentModelSketchSnaps(cached, snapBodies, snapHidden, snapPlaneKey, crossingBodies)) return;
    modelSnapCache.current = null;
    const snap = sketchDraft.current.snap;
    if (snap && (cached.points.includes(snap) || cached.crossings.includes(snap))) clearSketchSnap();
  }, [snapBodies, snapHidden, snapPlaneKey, crossingBodies, clearSketchSnap]);
  useLayoutEffect(() => {
    const cached = placedSnapCache.current;
    if (!cached || (cached.sources === placedSources && cached.plane === sketch?.plane)) return;
    placedSnapCache.current = null;
    const snap = sketchDraft.current.snap;
    if (snap && cached.points.some(point => point === snap)) clearSketchSnap();
  }, [placedSources, sketch?.plane, clearSketchSnap]);
  const currentPlacedPoints = (sketch: SketchState): readonly PlacedBoxSnapPoint[] => {
    const input = propsRef.current.sketchSnaps?.placed;
    if (sketch.tool !== 'rectangle' || !input?.current()) return [];
    const { sources } = input, { plane } = sketch, cached = placedSnapCache.current;
    if (cached?.sources === sources && cached.plane === plane) return cached.points;
    const points = sources.flatMap(({ instance, body }) => placedBoxSnapPoints(instance, body, plane));
    placedSnapCache.current = { sources, plane, points };
    return points;
  };
  /** The sketch point for the pointer: an eligible object snap within 8 px, then grid fallback. */
  const sketchSnap = (x: number, y: number, w: number, h: number, sk: SketchState, p: [number, number]): { at: [number, number]; snap: SnapPoint | null; liveMiddle?: boolean; extension?: boolean; terminal?: boolean } => {
    const { bodies, hiddenBodies, sketchSnaps, circleChord } = propsRef.current;
    const model = modelSnapCache.current = modelSketchSnaps(modelSnapCache.current, bodies, hiddenBodies, sk.plane, sketchSnaps?.crossingBodies);
    const live = liveShape.current;
    const livePoints = live ? shapeSnaps(live, drafting.current) : [];
    const guide = sketchSnaps?.extension.read(sk);
    const circleRadiusOrChord = sk.tool === 'circle' && (drafting.current || circleChord?.read(sk));
    const arcBend = sk.tool === 'arc' && live?.kind === 'polygon' && live.pending;
    const centreArcSize = sk.tool === 'carc' && carc.current !== null;
    const crossings = guide || circleRadiusOrChord || arcBend || centreArcSize ? [] : model.crossings;
    const placed = guide ? [] : currentPlacedPoints(sk);
    const done = (sk.done ?? []).filter(shape => !(sk.hideConstruction && shape.construction));
    const exactEnds = new Set<SnapPoint>();
    const draftPoints = done.flatMap(shape => {
      const snaps = shapeSnaps(shape);
      if (sk.tool === 'polygon' && shape.kind === 'polygon' && !shape.closed && !shape.pending
        && !shape.construction && shape.points.length === 2 && shape.bulges?.[0]) {
        for (const point of snaps) if (point.kind === 'end') exactEnds.add(point);
      }
      return snaps;
    });
    const points: SnapPoint[] = [{ at: [0, 0], kind: 'origin' }, ...model.points, ...draftPoints, ...livePoints, ...crossings, ...placed];
    const project = (q: [number, number]): [number, number] => { const v = camera.current.project(toWorld(sk.plane, q), w, h); return [v[0], v[1]]; };
    let candidates = guide ? points : enabledObjectSnaps(points, sketchSnaps?.objectKinds);
    if (sk.tool === 'circle' && drafting.current && live?.kind === 'circle') {
      candidates = candidates.filter(point => {
        const radius = circleRadiusAt(live.c, authoredSnapPoint(point.at), true);
        const startX = live.c[0] + radius;
        return radius <= CadPartLimits.length && Math.abs(startX) <= ExtrudedProfileLimits.coordinateMM
          && startX - live.c[0] >= ExtrudedProfileLimits.minimumRadiusMM;
      });
    }
    if (sk.tool === 'slot' && slotStage.current === 2 && live?.kind === 'slot') {
      const [ax, ay] = live.a, dx = live.b[0] - ax, dy = live.b[1] - ay;
      const lengthSquared = dx * dx + dy * dy;
      candidates = candidates.filter(point => {
        const at = authoredSnapPoint(point.at);
        const along = (at[0] - ax) * dx + (at[1] - ay) * dy;
        if (along < 0 || along > lengthSquared) return false;
        const radius = slotRadiusAt(live.a, live.b, at, true);
        const { coordinateMM, minimumRadiusMM, minimumLengthMM } = ExtrudedProfileLimits;
        if (!(radius >= minimumRadiusMM)) return false;
        const segments = slotSegments(live.a, live.b, radius);
        return segments.every((segment, index) => {
          const [x, y] = segment.start;
          const end = segments[(index + 1) % segments.length].start;
          if (Math.abs(x) > coordinateMM || Math.abs(y) > coordinateMM) return false;
          return segment.kind === 'arc'
            ? Math.hypot(x - segment.center[0], y - segment.center[1]) >= minimumRadiusMM
            : Math.hypot(x - end[0], y - end[1]) >= minimumLengthMM;
        });
      });
    }
    const ordinary = nearestSnap(candidates, project, [x, y]);
    const extensionPoint = !ordinary && guide?.stage === 'guide' ? arcExtensionPoint(guide.arc, p) : null;
    const extension = extensionPoint && nearestSnap([{ at: extensionPoint, kind: 'calculated' }], project, [x, y]);
    const hit = ordinary ?? extension;
    return hit ? {
      at: exactEnds.has(hit) ? hit.at : authoredSnapPoint(hit.at),
      snap: hit, liveMiddle: live?.kind === 'polygon' && hit.kind === 'mid' && livePoints.includes(hit), extension: !!extension,
      terminal: guide?.stage === 'end' && uniqueArcTerminal(guide.arc.end, ordinary, points, project, [x, y]),
    } : { at: [snap(p[0]), snap(p[1])], snap: null };
  };
  /** Plane coordinates of the sketch → canvas pixels. */
  const sketchProject = (plane: SketchPlane) => { const w = canvas.current!.clientWidth, h = canvas.current!.clientHeight; return (u: number, v: number) => camera.current.project(toWorld(plane, [u, v]), w, h); };
  const sketchHit = (sketch: SketchState, shape: SketchShape | null, x: number, y: number) => {
    const view = canvas.current!;
    const scale = orthographicSketchScale(camera.current, view.clientWidth, view.clientHeight);
    return pickSketchViewport(sketch, shape, sketchProject(sketch.plane), x, y, scale);
  };
  const pathGapAt = (draft: PathGapDraft, sk: SketchState, point: [number, number], x: number, y: number) => {
    const plan = planPathGap(draft.source, point, Number(draft.length));
    if (!plan) return null;
    const [px, py] = sketchProject(sk.plane)(...plan.hit);
    return Math.hypot(px - x, py - y) < 8 ? plan : null;
  };
  const referenceSnap = (points: readonly SnapPoint[], plane: SketchPlane, x: number, y: number) => {
    const project = sketchProject(plane);
    return nearestSnap(points, ([u, v]) => { const [sx, sy] = project(u, v); return [sx, sy]; }, [x, y]);
  };
  const startRectangleAt = (owner: SketchState, at: [number, number]) => {
    if (propsRef.current.sketch !== owner || owner.tool !== 'rectangle' || drafting.current) return false;
    drafting.current = true;
    emit({ kind: 'rectangle', a: at, b: at }, true);
    request();
    return true;
  };
  /** The trim tool's reach: 8 pixels on the sketch plane, in mm. */
  const trimReach = (x: number, y: number, w: number, h: number, sk: SketchState) => { const a = sketchPoint(x, y, w, h, sk.plane), b = sketchPoint(x + 8, y, w, h, sk.plane); return a && b ? Math.hypot(b[0] - a[0], b[1] - a[1]) : 1; };
  const cancelGizmo = (reason: GizmoCancelReason, pointerId?: number) => {
    const d = drag.current;
    if (d.mode !== 'gizmo' || (pointerId !== undefined && d.pointerId !== pointerId)) return;
    drag.current = { mode: null, x: 0, y: 0, moved: true };
    if (d.pointerId !== undefined && canvas.current?.hasPointerCapture(d.pointerId)) canvas.current.releasePointerCapture(d.pointerId);
    requestRef.current();
    if (d.pointerId !== undefined) d.gizmo?.onCancel?.(d.pointerId, reason);
  };
  const splineCancelRef = useRef<() => void>(() => undefined);
  const listenForSketchKeys = () => {
    // (Capture phase: the drag's Escape is not also the app's.)
    // The pointer owns the gesture from the press. Escape cancels it without leaving the sketch.
    let trimEscaped = false;
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (!e.repeat) trimEscaped = cancelDragTrim();
        if (trimEscaped) { e.stopImmediatePropagation(); e.preventDefault(); return; }
      }
      if (drag.current.mode !== 'spline' && !drag.current.splineArm) return;
      e.stopImmediatePropagation();
      e.preventDefault();
      if (e.key === 'Escape') splineCancelRef.current();
    };
    // An Ellipse draft's Escape drops the draft only (not the whole sketch, which is the app's Escape).
    const esc = (e: KeyboardEvent) => { if (e.key !== 'Escape' || !ellipseDraft.current) return; e.stopImmediatePropagation(); e.preventDefault(); ellipseDraft.current = null; requestRef.current(); };
    const blur = () => { cancelDragTrim(); };
    const visibility = () => { if (document.hidden) blur(); };
    window.addEventListener('keydown', key, true); window.addEventListener('keydown', esc, true);
    window.addEventListener('blur', blur); document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('keydown', key, true); window.removeEventListener('keydown', esc, true);
      window.removeEventListener('blur', blur); document.removeEventListener('visibilitychange', visibility);
    };
  };

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
  const pickAt = (r: ViewRenderer, x: number, y: number, face?: FaceRef | null): { face: FaceRef | null; edge: EdgeRef | null; front?: { face: FaceRef | null; edge: EdgeRef | null } } => {
    const view = viewState(), cameraNow = camera.current;
    const under = face === undefined ? r.pickFace(x, y, cameraNow, view) : face, filter = propsRef.current.pickFilter ?? 'all';
    if (filter === 'face' || filter === 'body') return { face: under, edge: null };
    const radius = under ? 4 : 6;
    const edge = r.pickEdge(x, y, cameraNow, view, radius);
    if (filter === 'edge') return { face: null, edge };
    if (!edge) return { face: under, edge: null };
    // The front face owns its corners when the closest edge belongs to a different body.
    if (under && under.body !== edge.body) return { face: null, edge, front: { face: under, edge: null } };
    if (showsRearEdges(r.getDisplayModeStatus?.().effective ?? view.displayMode ?? 'shaded-with-edges')) {
      // Preserve the shaded edge hit for vertex provenance in the through-line modes.
      const frontEdge = r.pickEdge(x, y, cameraNow, view, radius, true);
      return { face: null, edge, front: { face: frontEdge ? null : under, edge: frontEdge } };
    }
    return { face: null, edge };
  };
  /** The sketch plane's coordinates under a pixel. */
  const sketchPoint = (x: number, y: number, w: number, h: number, plane: SketchPlane): [number, number] | null => {
    const { origin, dir } = camera.current.ray((x / w) * 2 - 1, 1 - (y / h) * 2);
    return rayOnPlane(plane, origin, dir);
  };
  const showSketchSnap = (sk: SketchState, target: ReturnType<typeof sketchSnap> | null, point: [number, number] | null) => {
    const draft = sketchDraft.current;
    draft.cursor = target?.at ?? (point ? [snap(point[0]), snap(point[1])] : null);
    draft.snap = target?.snap ?? null;
    draft.extension = !!target?.extension;
    livePolygonMiddle.current = !!target?.liveMiddle;
    propsRef.current.onCursor(draft.cursor ? toWorld(sk.plane, draft.cursor) : null);
  };
  const previousObjectKinds = useRef(objectKinds);
  useLayoutEffect(() => {
    const previous = previousObjectKinds.current;
    previousObjectKinds.current = objectKinds;
    if (previous === objectKinds) return;
    const pointer = sketchHoverPointer.current;
    if (previous?.has('crossing') === objectKinds?.has('crossing') || !pointer || !sketch || extensionDraft || chordActive
      || !crossingBodies || picking(sketch) || cutting(sketch) || banding(sketch) || drag.current.mode
      || propsRef.current.sketchSnaps?.twoPoint.read()
      || document.elementFromPoint(pointer.clientX, pointer.clientY) !== canvas.current) {
      clearSketchSnap();
      return;
    }
    const { x, y, w, h } = local(pointer);
    const point = sketchPoint(x, y, w, h, sketch.plane);
    if (!point) { clearSketchSnap(); return; }
    const target = sketchSnap(x, y, w, h, sketch, point);
    showSketchSnap(sketch, target, point);
    const shape = liveShape.current;
    if (sketch.tool === 'rectangle' && drafting.current && shape?.kind === 'rectangle'
      && (shape.b[0] !== target.at[0] || shape.b[1] !== target.at[1])) emit({ ...shape, b: target.at });
    requestRef.current();
  }, [objectKinds, sketch, extensionDraft, chordActive, crossingBodies, canvas, clearSketchSnap, propsRef, requestRef]);
  const surfacePoint = (x: number, y: number, w: number, h: number, face: FaceRef | null): Vec3 | null => {
    if (!face) return null;
    const f = propsRef.current.bodies[face.body]?.mesh.faces[face.face]; if (!f || f.kind !== 'plane') return null;
    const { origin, dir } = camera.current.ray((x / w) * 2 - 1, 1 - (y / h) * 2);
    const denom = f.normal[0] * dir[0] + f.normal[1] * dir[1] + f.normal[2] * dir[2]; if (Math.abs(denom) < 1e-9) return null;
    const t = ((f.centroid[0] - origin[0]) * f.normal[0] + (f.centroid[1] - origin[1]) * f.normal[1] + (f.centroid[2] - origin[2]) * f.normal[2]) / denom;
    return [origin[0] + dir[0] * t, origin[1] + dir[1] * t, origin[2] + dir[2] * t];
  };

  /** The view as a tool sees it (G17). */
  const toolView = (): ToolView => {
    const c = canvas.current!, w = Math.max(1, c.clientWidth), h = Math.max(1, c.clientHeight), cam = camera.current;
    cam.aspect = w / h;
    return {
      w, h, camera: cam, project: p => cam.project(p, w, h), ray: (x, y) => cam.ray((x / w) * 2 - 1, 1 - (y / h) * 2), request,
      vertices: () => { const out: Vec3[] = []; propsRef.current.bodies.forEach((b, i) => { if (propsRef.current.hiddenBodies?.has(i)) return; for (const e of b.mesh.edges) out.push(e.a as Vec3, e.b as Vec3); }); return out; },
    };
  };
  /** Canvas pixels of world points, for the gizmo and handles: they keep one size on screen (GIZMO_PX at their origin). */
  const projector = (): Projector => {
    const w = canvas.current!.clientWidth, h = canvas.current!.clientHeight, cam = camera.current, { right, forward } = cam.basis();
    const project = (p: Vec3): [number, number] => { const q = cam.project(p, w, h); return [q[0], q[1]]; };
    const o = propsRef.current.gizmo?.origin ?? propsRef.current.handles?.[0]?.at ?? cam.target, a = project(o), b = project([o[0] + right[0], o[1] + right[1], o[2] + right[2]]);
    const perMm = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return { project, forward, size: GIZMO_PX / perMm };
  };
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
  const lastSpot = useRef<Spot | null>(null);
  /** Where a shape being placed stands under a pixel (to 1 mm): an upward face, else the plane last stood on, else the ground. */
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
  /** Pick the nearest sketch outline or any filled part of a finished sketch. */
  const profileAt = (x: number, y: number, w: number, h: number): { id: number; retained: boolean; region?: number } | null => {
    let edge: { id: number; retained: boolean } | null = null, fill: { id: number; retained: boolean; region?: number } | null = null, nearest = 6;
    const point = [x, y];
    for (const profile of propsRef.current.profiles ?? []) {
      let inside = false;
      const regions: number[] = [];
      for (const [index, ring] of profile.rings.entries()) {
        const projected = ring.map(vertex => camera.current.project(vertex, w, h));
        // Use the same even-odd rule as the sketch overlay, including holes.
        if (insideRing(point, projected)) {
          inside = !inside;
          if (index < profile.outerCount) regions.push(index);
        }
        for (let i = 0, j = projected.length - 1; i < projected.length; j = i++) {
          const distance = segmentDistance(point, projected[i], projected[j]);
          if (distance < nearest) { nearest = distance; edge = { id: profile.id, retained: profile.retained }; }
        }
      }
      if (inside && fill === null) {
        fill = { id: profile.id, retained: profile.retained, ...(profile.canPickRegion && regions.length === 1 ? { region: regions[0] } : {}) };
      }
    }
    return edge ?? fill;
  };
  const gizmoHit = (x: number, y: number) => { const p = propsRef.current; return (p.gizmo || p.handles?.length) && canvas.current ? hitTest([x, y], p.gizmo, p.handles ?? [], projector()) : null; };
  /** A gizmo drag from its start to (x, y): calls the handler with the whole move, turn or value so far. */
  const gizmoDrag = (x: number, y: number, shift: boolean, done: boolean, d = drag.current) => {
    const p = propsRef.current, g = d.gizmo ?? p.gizmo, P = projector(), hit = d.hit!;
    d.x = x; d.y = y;
    if (hit.kind === 'handle') {
      const hd = p.handles?.[hit.index]; if (!hd) return;
      // An arc adds up the angle swept round its centre step by step; an arrow measures mm along it — from the handle where
      // the drag began (G14: a handle drawn where its value now is, as SceneViewport's section handles are in each frame,
      // would measure each step from a moved point, and the release from another: its value one snap off the last shown).
      const at0 = d.handleAt ?? hd.at;
      if (hd.plane) { const [u, v] = dragIn(d.from!, [x, y], at0, hd.dir, hd.plane.dir2, P); d.value = hd.toValue(d.start!, u); d.value2 = hd.plane.toValue2(d.start2!, v); hd.onDrag(d.value, done, d.value2); return; }
      if (hd.arc) { d.turned = (d.turned ?? 0) + dragAbout(d.last!, [x, y], hd.arc.centre, hd.arc.axis, P); d.last = [x, y]; d.value = hd.toValue(d.start!, d.turned); }
      else d.value = (d.handleToValue ?? hd.toValue)(d.start!, dragAlong(d.from!, [x, y], at0, hd.dir, P));
      hd.onDrag(d.value, done);
      // (Roadmap 20 ⑥: the handle let go offers its value in a box beside it while the command runs.)
      if (done) valueBox.current = { id: hd.id, owner: hd.owner };
      return;
    }
    if (!g) return;
    if (hit.kind === 'move' || hit.kind === 'plane') {
      const grid = propsRef.current.snapStep ?? 1, delta: Vec3 = [0, 0, 0], step = shift ? Math.max(0.001, (grid || 1) / 10) : grid || 0.001;
      // (Measured from the gizmo where the drag began: it moves with the selection meanwhile.)
      const o = d.origin ?? g.origin;
      if (hit.kind === 'plane') { const [u, v] = dragPlane(d.from!, [x, y], o, hit.axes, P); delta[hit.axes[0]] = snapTo(u, step); delta[hit.axes[1]] = snapTo(v, step); }
      else { const dir: Vec3 = [0, 0, 0]; dir[hit.axis] = 1; delta[hit.axis] = snapTo(dragAlong(d.from!, [x, y], o, dir, P), step); }
      d.delta = delta; g.onMove?.(delta, done, d.pointerId); return;
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

  /** A spline drag at the pointer: the valid definition previews live (no history step); an unbuildable one keeps the last valid preview. */
  const splineDragTo = (d: PointerDrag, x: number, y: number, w: number, h: number, fine: boolean) => {
    const sk = propsRef.current.sketch, start = d.splineStart; if (!sk || !start || start.kind !== 'polygon' || !d.splineHit) return;
    const p = sketchPoint(x, y, w, h, sk.plane); if (!p) return;
    const def = draggedSpline(start.spline!, d.splineHit, p, { fine, step: propsRef.current.snapStep });
    if (splineEditError(def)) return;
    d.splineLast = respline(start, def); d.splineLastDef = def; liveShape.current = d.splineLast; request();
  };
  /** Ends an armed or active spline drag without emitting: an active one restores the start shape. `moved` keeps the pick click away. */
  const splineDragCancel = () => {
    const d = drag.current; if (d.mode !== 'spline' && !d.splineArm) return;
    if (d.mode === 'spline') liveShape.current = d.splineStart ?? null;
    drag.current = { mode: null, x: 0, y: 0, moved: true };
    propsRef.current.onSplineDragChange?.(false);
    if (canvas.current) canvas.current.style.cursor = '';
    request();
  };
  splineCancelRef.current = splineDragCancel;
  /** A cancelled or lost pointer ends its own armed or active spline drag only. */
  const splineCancelOf = (pointerId: number) => { const d = drag.current; if ((d.splineArm?.pointerId ?? (d.mode === 'spline' ? d.pointerId : undefined)) === pointerId) splineDragCancel(); };
  /** A tool change or the end of the sketch cancels the drag and clears the drafts. */
  const resetSketchTool = () => {
    cancelDragTrim();
    drafting.current = false;
    slotStage.current = 0;
    splineCancelRef.current();
    if (canvas.current) canvas.current.style.cursor = '';
    bezierDraft.current = { poles: [], open: false };
    ellipseDraft.current = null;
    carc.current = null;
  };

  const onPointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    sketchHoverPointer.current = null;
    const held = drag.current;
    if (held.circleChord && !held.moved && held.circleChord.pointer !== e.pointerId) { held.moved = true; return; }
    if (trimStroke.interceptDown(e.pointerId)) { sketchDraft.current.trim = null; request(); return; }
    if (drag.current.mode === 'gizmo') return;
    if (drag.current.splineArm || drag.current.mode === 'spline') return; // (another pointer while a spline drag is armed or active)
    canvas.current!.setPointerCapture(e.pointerId);
    const { x, y, w, h } = local(e);
    if (focusPick.current && e.button === 0 && !e.altKey) { drag.current = { mode: null, x, y, moved: false }; return; }
    const tool = propsRef.current.tool;
    if (tool && e.button === 0 && !e.altKey && tool.down(x, y, toolView(), e)) { drag.current = { mode: 'tool', x, y, moved: false }; request(); return; }
    const chord = e.button === 0 && !e.altKey ? propsRef.current.circleChord?.read(propsRef.current.sketch ?? null) : null;
    if (chord) {
      drag.current = { mode: null, x, y, moved: false, circleChord: { pointer: e.pointerId, draft: chord, frame: pointerFrame() } };
      return;
    }
    const trim = e.button === 0 ? trimOwner(e) : null;
    if (trim) {
      const point = sketchPoint(x, y, w, h, trim.sketch.plane);
      if (point) trimStroke.begin(trim, e.pointerId, pointerFrame(), [x, y], point);
      else trimStroke.ignore(e.pointerId);
    }
    // (D353: a down on a closed spline's handle end or fit point arms a drag; a release before it starts is the ordinary click.)
    const sk1 = propsRef.current.sketch, sd = e.button === 0 && !e.altKey && sk1?.tool === 'select' ? closedSplineOf(liveShape.current) : null;
    const sh = sd ? splineHandleHit(sd, sketchProject(sk1!.plane), x, y) : null;
    if (sh) {
      drag.current = { mode: null, x, y, moved: false, x0: x, y0: y, splineArm: { hit: sh, pointerId: e.pointerId } };
      propsRef.current.onSplineDragChange?.(true);
      return;
    }
    const hit = e.button === 0 && !propsRef.current.sketch ? gizmoHit(x, y) : null;
    if (hit) {
      const hd = hit.kind === 'handle' ? propsRef.current.handles![hit.index] : undefined;
      const g = hit.kind === 'handle' ? undefined : propsRef.current.gizmo ?? undefined;
      drag.current = { mode: 'gizmo', x, y, moved: false, hit, from: [x, y], last: [x, y], turned: 0, start: hd?.value, start2: hd?.plane?.value2,
        handleAt: hd ? [...hd.at] as Vec3 : undefined, handleToValue: hd?.toValue,
        origin: propsRef.current.gizmo ? [...propsRef.current.gizmo.origin] as Vec3 : undefined, gizmo: g, pointerId: e.pointerId, sessionKey: g?.sessionKey };
      g?.onStart?.(e.pointerId);
      return;
    }
    if (e.button === 2 && !e.shiftKey) drag.current = { mode: 'orbit', x, y, moved: false };
    else if (e.button === 1 || (e.button === 2 && e.shiftKey)) drag.current = { mode: 'pan', x, y, moved: false };
    else if (e.button === 0 && e.altKey) drag.current = { mode: 'orbit', x, y, moved: false };
    else drag.current = { mode: null, x, y, moved: false, x0: x, y0: y };
  };

  const onPointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    const d = drag.current; if (d.mode === 'gizmo' && d.pointerId !== e.pointerId) return;
    const { x, y, w, h } = local(e); const r = renderer.current; if (!r) return;
    sketchHoverPointer.current = propsRef.current.sketch && !e.buttons && !d.mode ? { clientX: e.clientX, clientY: e.clientY } : null;
    if (d.circleChord?.pointer === e.pointerId && (!(e.buttons & 1) || Math.hypot(x - d.x, y - d.y) > 5
      || d.circleChord.frame !== pointerFrame())) d.moved = true;
    if (trimStroke.owns(e.pointerId)) {
      const owner = e.buttons === 1 ? trimOwner(e) : null;
      if (trimStroke.advance(e.pointerId, owner, pointerFrame(), [x, y], owner && sketchPoint(x, y, w, h, owner.sketch.plane), trimRail(e.clientX - x, e.clientY - y))) {
        sketchDraft.current.trim = null;
        request();
        return;
      }
    }
    if (d.splineArm || d.mode === 'spline') {
      if ((d.splineArm?.pointerId ?? d.pointerId) !== e.pointerId) return;
      if (!(e.buttons & 1)) { splineDragCancel(); return; } // (released outside: hover never moves a drag)
      if (d.splineArm) {
        if (!splineDragStarted(x - d.x, y - d.y)) return;
        // Activate: the start is the current shape (after any blur-commit re-render), and must still hold the armed handle.
        const start = liveShape.current, def = closedSplineOf(start), hit = d.splineArm.hit;
        if (!start || !def || hit.i >= def.fit.length) { splineDragCancel(); return; }
        drag.current = { mode: 'spline', x: d.x, y: d.y, moved: true, splineHit: hit, splineStart: start, pointerId: e.pointerId };
        canvas.current!.style.cursor = 'grabbing';
      }
      splineDragTo(drag.current, x, y, w, h, e.shiftKey); return;
    }
    if (d.mode === 'orbit') { camera.current.orbit(x - d.x, y - d.y); d.x = x; d.y = y; d.moved = true; moving.current(); request(); return; }
    if (d.mode === 'pan') { camera.current.pan(x - d.x, y - d.y, h); d.x = x; d.y = y; d.moved = true; moving.current(); request(); return; }
    if (d.mode === 'gizmo') { gizmoDrag(x, y, e.shiftKey, false); d.moved = true; request(); return; }
    if (d.mode === 'tool') { propsRef.current.tool?.move(x, y, toolView(), e); d.moved = true; request(); return; }
    if (focusPick.current && !d.mode) { if (e.buttons === 1 && Math.hypot(x - d.x, y - d.y) > 5) d.moved = true; canvas.current!.style.cursor = 'crosshair'; return; }
    if (!d.mode && propsRef.current.tool?.move(x, y, toolView(), e)) { request(); return; }
    if (!d.mode && !propsRef.current.sketch) {
      const hot = gizmoHit(x, y);
      if (!sameGizmoHit(hot, gizmoHot.current)) { gizmoHot.current = hot; request(); }
      if (hot) { canvas.current!.style.cursor = 'grab'; return; }
      canvas.current!.style.cursor = '';
    }
    const sk = propsRef.current.sketch;
    if (!d.mode && sk?.tool === 'select' && e.buttons === 0) {
      // (D353: a closed spline's handle end or fit point under the pointer.)
      const sp = closedSplineOf(liveShape.current), over = sp ? splineHandleHit(sp, sketchProject(sk.plane), x, y) : null;
      canvas.current!.style.cursor = over ? 'grab' : '';
    }
    if (!sk && e.buttons === 1 && d.x0 !== undefined && (d.mode === 'box' || Math.hypot(x - d.x0, y - d.y0!) > 5)) {
      d.mode = 'box'; d.x = x; d.y = y; d.moved = true; request(); return;
    }
    if (sk) {
      const reference = propsRef.current.sketchSnaps?.twoPoint.read();
      if (reference) {
        twoPointHover.current = { points: reference.points, hit: reference.picking ? referenceSnap(reference.points, sk.plane, x, y) : null };
        request();
        return;
      }
      const p = sketchPoint(x, y, w, h, sk.plane), at = p && !picking(sk) && !cutting(sk) && !banding(sk) ? sketchSnap(x, y, w, h, sk, p) : null;
      showSketchSnap(sk, at, p);
      if (propsRef.current.circleChord?.read(sk)) { request(); return; }
      const s = liveShape.current; const c = sketchDraft.current.cursor;
      if (sk.tool !== 'carc') carc.current = null;
      if (sk.tool !== 'spline') splineFit.current = null;
      else if (splineFit.current?.length && c) { const o = splineOutline([...splineFit.current, c], false); emit({ kind: 'polygon', points: o.points, bulges: o.bulges, closed: false, fromSpline: true, spline: { fit: [...splineFit.current, c], closed: false } }); }
      if (banding(sk)) sketchDraft.current.bandHover = pickShapeAt(bandShapes(sk), sketchProject(sk.plane), x, y);
      if (picking(sk)) sketchDraft.current.hover = sketchHit(sk, s, x, y);
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
        const gap = propsRef.current.pathGap?.read(sk);
        if (gap) {
          const plan = p && pathGapAt(gap, sk, [p[0], p[1]], x, y);
          sketchDraft.current.trim = plan ? { kind: 'trim', points: plan.removed, owner: sk, gap, ends: [plan.cutA, plan.cutB] } : null;
          request();
          return;
        }
        const { shapes, protectedShapes } = sketchCutInputs(sk);
        const q: [number, number] | null = p ? [p[0], p[1]] : null, tol = trimReach(x, y, w, h, sk), kind = sk.tool as 'trim' | 'extend' | 'split';
        const points = !q ? null : kind === 'trim' ? trimPreview(shapes, q, tol, protectedShapes)
          : kind === 'extend' ? extendPreview(shapes, q, tol, protectedShapes) : (pt => pt ? [pt] : null)(splitPreview(shapes, q, tol, protectedShapes));
        sketchDraft.current.trim = points ? { kind, points, owner: sk } : null;
      }
      else if (s && c) {
        if (s.kind === 'rectangle' && drafting.current) emit({ ...s, b: c });
        if (s.kind === 'circle' && drafting.current) emit({ ...s, r: circleRadiusAt(s.c, c, !!at?.snap) });
        if (s.kind === 'slot' && drafting.current) {
          if (slotStage.current === 1) emit({ ...s, b: c });
          else emit({ ...s, r: slotRadiusAt(s.a, s.b, c, !!at?.snap) });
        }
        if (s.kind === 'polygon' && s.pending && p) {
          const n = s.points.length, i = s.closed ? n - 1 : n - 2;
          if (i >= 0) { const bulges = [...(s.bulges ?? s.points.map(() => 0))]; bulges[i] = bulgeThrough(s.points[i], s.points[(i + 1) % n], [p[0], p[1]]); emit({ ...s, bulges }); }
        }
      }
      request(); return;
    }
    if (propsRef.current.placing && !d.mode) { propsRef.current.onSpot?.(spotAt(x, y, w, h), false); return; }
    const hit = pickAt(r, x, y), { face, edge } = hit;
    const prev = hover.current;
    const vertex = vertexAt(x, y, w, h, hit.front ?? hit);
    const next = { face: edge || vertex ? null : face, edge: vertex ? null : edge, vertex };
    if (!sameHover(prev, next)) { hover.current = next; r.setState(viewState()); request(); }
    const point = surfacePoint(x, y, w, h, face) ?? planePoint(x, y, w, h, 0);
    propsRef.current.onCursor(point);
    // (G6: the map's value under the pointer, for its legend.)
    if (propsRef.current.onHoverScalar) propsRef.current.onHoverScalar(r.scalarAt?.(x, y, camera.current) ?? null);
  };

  /** The pointer left the canvas (for a panel or the toolbar, say): what it hovered is no longer hovered. */
  const onPointerLeave = () => {
    sketchHoverPointer.current = null;
    clearSketchSnap();
    if (sketchDraft.current.trim?.gap) { sketchDraft.current.trim = null; request(); }
    if (twoPointHover.current) { twoPointHover.current = null; request(); }
    const r = renderer.current, prev = hover.current;
    if (!r || drag.current.mode || (!prev.face && !prev.edge && !prev.vertex)) return;
    hover.current = { face: null, edge: null, vertex: null }; r.setState(viewState()); request();
  };
  const onPointerUp = (e: PointerEvent<HTMLCanvasElement>) => {
    if (trimStroke.owns(e.pointerId)) {
      const { x, y, w, h } = local(e), owner = e.button === 0 ? trimOwner(e) : null;
      const result = trimStroke.release(e.pointerId, owner, pointerFrame(), [x, y], owner && sketchPoint(x, y, w, h, owner.sketch.plane), trimRail(e.clientX - x, e.clientY - y));
      if (result.kind !== 'click') {
        sketchDraft.current.trim = null;
        if (result.kind === 'plan') propsRef.current.dragTrim?.apply(result.owner, result.plan);
        request();
        return;
      }
    }
    const d = drag.current; if (d.mode === 'gizmo' && d.pointerId !== e.pointerId) return;
    if ((d.splineArm || d.mode === 'spline') && (d.splineArm?.pointerId ?? d.pointerId) !== e.pointerId) return;
    if (d.circleChord && d.circleChord.pointer !== e.pointerId) return;
    drag.current = { mode: null, x: 0, y: 0, moved: false };
    if (d.splineArm) propsRef.current.onSplineDragChange?.(false);
    const { x, y, w, h } = local(e);
    if (d.circleChord) {
      const { circleChord, sketch } = propsRef.current;
      if (d.moved || e.button !== 0 || e.altKey || Math.hypot(x - d.x, y - d.y) > 5
        || d.circleChord.frame !== pointerFrame() || !sketch || circleChord?.read(sketch) !== d.circleChord.draft) return;
      const point = sketchPoint(x, y, w, h, sketch.plane);
      if (!point) return;
      const at = sketchSnap(x, y, w, h, sketch, point)?.at ?? [snap(point[0]), snap(point[1])];
      circleChord.pick(sketch, d.circleChord.draft, at);
      request();
      return;
    }
    if (d.mode === 'gizmo') { gizmoDrag(x, y, e.shiftKey, true, d); request(); return; }
    if (d.mode === 'tool') { propsRef.current.tool?.up(x, y, toolView(), e); request(); return; }
    if (d.mode === 'spline') {
      // One history step for the whole drag (only when the definition changed, and the sketch is still the one dragged), never also a pick click.
      canvas.current!.style.cursor = '';
      const now = propsRef.current.sketch, cur = now?.tool === 'select' ? now.shape : null, st = d.splineStart;
      const same = !!cur && !!st && (cur === st || JSON.stringify(cur) === JSON.stringify(st));
      const changed = d.splineLastDef && st?.kind === 'polygon' && !sameSplineDef(st.spline!, d.splineLastDef);
      if (same && changed && d.splineLast) emit(d.splineLast); else liveShape.current = cur ?? null;
      propsRef.current.onSplineDragChange?.(false);
      request(); return;
    }
    if (d.mode === 'box') { boxSelect(d.x0!, d.y0!, x, y, e.shiftKey, e.pointerType === 'mouse'); request(); return; }
    if (e.button === 2 && d.mode === 'orbit' && !d.moved && !propsRef.current.sketch) {
      const r = renderer.current;
      if (!r) return;
      const at = { x: e.clientX, y: e.clientY };
      const props = propsRef.current;
      const instance = props.printDisplay || props.printActive ? null : r.pickInstanceFace?.(x, y, camera.current);
      if (instance && !r.pickDirect?.(x, y, camera.current)) {
        const packet = rendererInstances.current;
        const instanceMesh = packet?.renderer === r
          ? packet.instances.find(item => item.id === instance.id)?.bodies[instance.body]?.mesh : undefined;
        props.onContextMenu(at, { face: null, edge: null, point: null, ...instancePickFields(instance), instanceMesh });
        return;
      }
      const { face, edge } = pickAt(r, x, y);
      props.onContextMenu(at, { face, edge, point: surfacePoint(x, y, w, h, face) }); return;
    }
    if (d.mode || d.moved || e.button !== 0) return;
    if (focusPick.current) {
      const point = propsRef.current.render && !propsRef.current.sketch ? renderer.current?.pickSurfacePoint?.(x, y, camera.current) ?? null : null;
      finishFocusPick(point ? renderFocusDistance(camera.current, point) : null);
      if (canvas.current) canvas.current.style.cursor = '';
      request(); return;
    }
    if (propsRef.current.placing) { propsRef.current.onSpot?.(spotAt(x, y, w, h), true); return; }
    // A cage being edited takes the click (a miss clears its selection; the body under it is not picked).
    const cg = propsRef.current.cage;
    if (cg) { propsRef.current.onPickCage?.(pickCage(cg.cage, p => camera.current.project(p as Vec3, w, h), x, y, cg.mode), e.shiftKey); request(); return; }
    // (G24: a click on an annotation's text or lines picks it, before the model under it.)
    const pm = propsRef.current.annotations;
    if (pm?.length && propsRef.current.onPickAnnotation) {
      const id = pmiPick(pm, p => { const q = camera.current.project(p, w, h); return Number.isFinite(q[0]) && Number.isFinite(q[1]) ? [q[0], q[1]] : null; }, x, y);
      if (id) { propsRef.current.onPickAnnotation(id); request(); return; }
    }
    const sk = propsRef.current.sketch;
    if (sk) {
      if (propsRef.current.circleChord?.read(sk)) return;
      const snaps = propsRef.current.sketchSnaps, input = snaps?.twoPoint, reference = input?.read();
      if (input && reference) { input.pick(referenceSnap(reference.points, sk.plane, x, y)); return; }
      const guide = snaps?.extension.read(sk);
      const p = sketchPoint(x, y, w, h, sk.plane); if (!p) return;
      const target = picking(sk) ? null : sketchSnap(x, y, w, h, sk, p);
      if (guide?.stage === 'end') {
        if (target?.terminal) snaps?.extension.arm(sk);
        return;
      }
      const c: [number, number] = target?.at ?? [snap(p[0]), snap(p[1])];
      if (guide?.stage === 'guide') snaps?.extension.consume(sk);
      const s = liveShape.current;
      if (picking(sk)) { propsRef.current.onSketchPick?.(sketchHit(sk, s, x, y), e.shiftKey); return; }
      if (banding(sk)) { propsRef.current.onSketchBandPick?.(pickShapeAt(bandShapes(sk), sketchProject(sk.plane), x, y)); return; }
      if (cutting(sk)) {
        const input = propsRef.current.pathGap, gap = input?.read(sk);
        if (input && gap) input.apply(sk, gap, pathGapAt(gap, sk, [p[0], p[1]], x, y));
        else propsRef.current.onSketchTrim?.(sk.tool as 'trim' | 'extend' | 'split', [p[0], p[1]], trimReach(x, y, w, h, sk));
        sketchDraft.current.trim = null;
        request();
        return;
      }
      if (sk.tool === 'spline') {
        // Its points so far, the curve through them redrawn (closed when the first point is clicked again).
        const fit = splineFit.current ?? [], fresh = !fit.length;
        if (fit.length >= 3 && c[0] === fit[0][0] && c[1] === fit[0][1]) { const o = splineOutline(fit, true); emit({ kind: 'polygon', points: o.points, bulges: o.bulges, closed: true, fromSpline: true, spline: { fit: [...fit], closed: true } }); splineFit.current = null; request(); return; }
        if (fit.length && c[0] === fit[fit.length - 1][0] && c[1] === fit[fit.length - 1][1]) return;
        splineFit.current = [...fit, c];
        const o = splineOutline(splineFit.current, false); emit({ kind: 'polygon', points: o.points, bulges: o.bulges, closed: false, fromSpline: true, spline: { fit: [...splineFit.current], closed: false } }, fresh); request(); return;
      }
      if (sk.tool === 'bezier') {
        // Control points: the third makes a quadratic (a shape), a fourth a cubic and ends it (the next click starts another curve).
        // (A click on the previous point is ignored; poles that make no curve are refused with the reason, and the draft stays.)
        const bd = bezierDraft.current, same = (q: [number, number] | undefined) => !!q && q[0] === c[0] && q[1] === c[1];
        if (bd.open && wellFormedBezier(s) && s.poles.length === 3) {
          if (same(s.poles[2])) return;
          const next: SketchShape = { ...s, poles: [...s.poles, c] };
          if (bezierError(next.poles)) { propsRef.current.onSketchShape(next); return; }
          bezierDraft.current = { poles: [], open: false }; emit(next); request(); return;
        }
        if (same(bd.poles[bd.poles.length - 1])) return;
        const poles = [...bd.poles, c];
        if (poles.length < 3) { bezierDraft.current = { poles, open: false }; request(); return; }
        const made: SketchShape = { kind: 'bezier', poles };
        if (bezierError(poles)) { propsRef.current.onSketchShape(made, true); return; }
        bezierDraft.current = { poles: [], open: true }; emit(made, true); request(); return;
      }
      if (sk.tool === 'ellipse') {
        // Centre, end of the first axis, then a point whose distance from that axis is the other semi-axis (the draft is cleared when the ellipse is made; a refusal is then shown in the panel and the sketch keeps its shape).
        const r = ellipseClick(ellipseDraft.current, c); ellipseDraft.current = r.draft;
        if (r.def) { ellipseDraft.current = null; propsRef.current.onSketchShape(ellipseShape(r.def), true); }
        request(); return;
      }
      if (sk.tool === 'carc') {
        const d = carc.current;
        if (!d) {
          carc.current = { c, sweep: 0, cursor: c };
          if (sketchDraft.current.snap?.kind === 'crossing') clearSketchSnap();
        }
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
        if (!drafting.current) startRectangleAt(sk, c);
        else { drafting.current = false; if (s && s.kind === 'rectangle') emit({ ...s, b: c }); }
      } else if (sk.tool === 'circle') {
        if (!drafting.current) {
          drafting.current = true;
          clearSketchSnap();
          emit({ kind: 'circle', c, r: 1 }, true);
        }
        else {
          drafting.current = false;
          if (s?.kind === 'circle') {
            const r = circleRadiusAt(s.c, c, !!target?.snap);
            if (r !== s.r) emit({ ...s, r });
          }
        }
      } else if (sk.tool === 'slot') {
        if (!drafting.current) { drafting.current = true; slotStage.current = 1; emit({ kind: 'slot', a: c, b: c, r: 0 }, true); }
        else if (slotStage.current === 1) {
          if (s?.kind === 'slot' && (c[0] !== s.a[0] || c[1] !== s.a[1])) {
            slotStage.current = 2;
            clearSketchSnap();
            emit({ ...s, b: c, r: 1 });
          }
        } else {
          drafting.current = false;
          slotStage.current = 0;
          if (s?.kind === 'slot') {
            const r = slotRadiusAt(s.a, s.b, c, !!target?.snap);
            if (r !== s.r) emit({ ...s, r });
          }
        }
      } else {
        // Line (polygon) and arc tools share one open chain; an arc's bulge follows the cursor until the next click.
        const open = s && s.kind === 'polygon' && !s.closed ? s : null;
        if (s?.kind === 'polygon' && s.pending) { emit({ ...s, pending: false }); return; }
        const pts = open ? open.points : [], bulges = open?.bulges ?? pts.map(() => 0);
        const arc = sk.tool === 'arc' && pts.length > 0;
        const closing = pts.length >= 2 && pts[0][0] === c[0] && pts[0][1] === c[1];
        const origin = sk.tool === 'polygon' ? 'line-point' : undefined;
        if (arc && sketchDraft.current.snap?.kind === 'crossing') clearSketchSnap();
        if (closing && (pts.length >= 3 || arc || bulges.some(Boolean))) emit({ kind: 'polygon', points: pts, closed: true, bulges, pending: arc }, false, origin);
        else if (!closing) emit({ kind: 'polygon', points: [...pts, c], closed: false, bulges: [...bulges, 0], pending: arc }, !open, origin);
      }
      return;
    }
    // Finished sketch outlines and filled areas come before the bodies behind them.
    const filter = propsRef.current.pickFilter ?? 'all';
    const prof = filter === 'all' ? profileAt(x, y, w, h) : null;
    if (prof && !prof.retained) { propsRef.current.onPickProfile?.(prof.id, e.shiftKey, prof.region); return; }
    const poles = propsRef.current.poles;
    if (poles?.length) {
      let best: string | null = null, d0 = 8;
      for (const p of poles) { const q = camera.current.project(p.at, w, h), d = Math.hypot(q[0] - x, q[1] - y); if (d < d0) { d0 = d; best = p.key; } }
      if (best !== null) { propsRef.current.onPickPole?.(best); return; }
    }
    const r = renderer.current;
    if (!r) return;
    const direct = r.pickDirect?.(x, y, camera.current) ?? null;
    if (direct) { propsRef.current.onPick({ face: null, edge: null, point: null, direct }, e.shiftKey); return; }
    const instance = r.pickInstanceFace?.(x, y, camera.current) ?? null;
    if (instance) { propsRef.current.onPick({ face: null, edge: null, point: null, ...instancePickFields(instance) }, e.shiftKey); return; }
    const frontFace = prof ? r.pickFace(x, y, camera.current, viewState()) : undefined;
    if (prof && !frontFace) { propsRef.current.onPickProfile?.(prof.id, e.shiftKey, prof.region); return; }
    const hit = pickAt(r, x, y, frontFace), { face, edge } = hit, vertex = vertexAt(x, y, w, h, hit.front ?? hit);
    if (vertex) { propsRef.current.onPick({ face: null, edge: null, point: vertex.at, vertex }, e.shiftKey); return; }
    const edgeMesh = edge ? rendererBodies.current[edge.body]?.mesh : undefined;
    propsRef.current.onPick({ face, edge, edgeMesh, point: surfacePoint(x, y, w, h, face) }, e.shiftKey);
  };

  /** Window selection left→right (fully inside), crossing right→left (touching). */
  const boxSelect = (x0: number, y0: number, x1: number, y1: number, additive: boolean, mouse: boolean) => {
    const c = canvas.current!; const w = c.clientWidth, h = c.clientHeight;
    const [lx, hx, ly, hy] = [Math.min(x0, x1), Math.max(x0, x1), Math.min(y0, y1), Math.max(y0, y1)];
    const crossing = x1 < x0; const picked: number[] = [];
    const p = propsRef.current, cam = camera.current;
    const ordinaryModel = !p.printActive && !p.camActive && !p.clip && !p.render;
    const basis = ordinaryModel && !cam.ortho ? cam.basis() : null;
    const crossingViewport = crossing && mouse && ordinaryModel && cam.ortho && p.meshBoxCrossing ? c.getBoundingClientRect() : null;
    const box = { left: lx, right: hx, top: ly, bottom: hy };
    p.bodies.forEach((b, i) => {
      if ((ordinaryModel || p.printActive) && p.hiddenBodies?.has(i)) return;
      const P = b.mesh.positions; let inside = 0, total = 0;
      if (p.printActive) {
        // G19 can retain unused original vertices; only the displayed triangles can enter this box.
        for (const index of new Set(b.mesh.indices)) {
          const k = index * 3, q = cam.project([P[k], P[k + 1], P[k + 2]], w, h); total++;
          if (q[0] >= lx && q[0] <= hx && q[1] >= ly && q[1] <= hy) inside++;
        }
        if (crossing ? inside > 0 : inside === total && total > 0) picked.push(i);
        return;
      }
      if (basis && bodyEntirelyBehindEye(b.mesh, basis.eye, basis.forward)) return;
      if (crossingViewport) {
        if (meshCrossesBox(b.mesh, box, point => cam.project(point, crossingViewport.width, crossingViewport.height))) picked.push(i);
        return;
      }
      const step = Math.max(3, Math.floor(P.length / 3 / 400) * 3);
      for (let k = 0; k < P.length; k += step) {
        const q = cam.project([P[k], P[k + 1], P[k + 2]], w, h); total++;
        if (q[0] >= lx && q[0] <= hx && q[1] >= ly && q[1] <= hy) inside++;
      }
      if (crossing ? inside > 0 : inside === total && total > 0) picked.push(i);
    });
    p.onBoxSelect(picked, additive);
  };

  const onWheel = (e: WheelEvent<HTMLCanvasElement>) => {
    cancelDragTrim();
    if (drag.current.circleChord) drag.current.moved = true;
    const { x, y, w, h } = local(e);
    camera.current.zoom(Math.exp(e.deltaY * 0.0015), (x / w) * 2 - 1, 1 - (y / h) * 2); moving.current(); request();
  };

  const endDragTrim = (pointer: number) => {
    if (!trimStroke.terminate(pointer)) return;
    sketchDraft.current.trim = null;
    request();
  };
  const cancelSketchPress = (pointer: number) => {
    endDragTrim(pointer);
    if (drag.current.circleChord?.pointer === pointer) drag.current.moved = true;
  };
  const onPointerCancel = (e: PointerEvent<HTMLCanvasElement>) => { cancelSketchPress(e.pointerId); splineCancelOf(e.pointerId); cancelGizmo('pointercancel', e.pointerId); };
  const onLostPointerCapture = (e: PointerEvent<HTMLCanvasElement>) => { cancelSketchPress(e.pointerId); splineCancelOf(e.pointerId); cancelGizmo('lostpointercapture', e.pointerId); };
  const onDoubleClick = (e: MouseEvent<HTMLCanvasElement>) => {
    const p = propsRef.current, r = renderer.current; if (!r || p.sketch || p.placing) return;
    if (p.cage) {
      const { x, y, w, h } = local(e), hit = pickCage(p.cage.cage, q => camera.current.project(q as Vec3, w, h), x, y, 'edge');
      if (hit) p.onPickCage?.(hit, e.shiftKey, e.altKey ? 'ring' : 'loop');
      return;
    }
    const { x, y } = local(e), { face, edge } = pickAt(r, x, y);
    if (edge && p.onPickChain) p.onPickChain(edge.body, edge.edge); else if (face) p.onPickBody?.(face.body);
  };
  const onContextMenu = (e: MouseEvent<HTMLCanvasElement>) => e.preventDefault();

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
    e.preventDefault(); e.dataTransfer.dropEffect = 'copy';
    const l = local(e); propsRef.current.onSpot?.(spotAt(l.x, l.y, l.w, l.h), false);
  };
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
    e.preventDefault();
    const l = local(e); propsRef.current.onSpot?.(spotAt(l.x, l.y, l.w, l.h), true);
  };

  return {
    canvasHandlers: { onPointerDown, onPointerMove, onPointerLeave, onPointerUp, onPointerCancel, onLostPointerCapture, onDoubleClick, onWheel, onContextMenu },
    placementHandlers: { onDragOver, onDrop },
    overlay: { drag, gizmoHot, valueBox, sketchDraft, twoPointHover, bezierDraft, ellipseDraft, carc, liveShape, toolView, projector },
    cancelGizmo, listenForSketchKeys, resetSketchTool, startRectangleAt,
    dragTrimPreview: () => canvas.current ? trimStroke.preview(trimOwner(), pointerFrame) : null,
  };
}
