import { Fragment, Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EngineClient, type ProposalOverlay } from './engine/client';
import { PROPOSAL_ADDED, PROPOSAL_REMOVED } from './viewport/renderer';
import { placedBase, placedDoc, placementOf, type PartInstance } from '@barocss/cad-model/engine/doc';
import { resolveSkeletons } from '@barocss/cad-model/frames/skeleton';
import { carryOver, dropStaleMade, emptyDoc, featureLabel, fmt, parentsOf, prefixDoc, starterDoc, withNode, type MeshRepairRecord, type ModelNode, type Side, type SketchNode, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { bodyKeyFor, bodyNodeOf, cutAfter, featureId, nextSerial } from '@barocss/cad-model/engine/ids';
import { MATERIALS } from '@barocss/cad-model/app/materials';
import { checkSpec, expectedOf, modelHash, type Outcome } from '@barocss/cad-model/chat/spec';
import { rejectProposal, stripHistory, type Proposal } from '@barocss/cad-model/chat/proposals';
import type { ProposalPart } from '@barocss/cad-model/chat/tools';
import { candidatesFor, captureSignatures, confirmReference, markedReferences, verifyReferences, type Problem as RefProblem } from '@barocss/cad-model/engine/references';
import { evaluateDoc, type BodyResult } from '@barocss/cad-model/engine/evaluate';
import type { FriendlyError } from '@barocss/cad-model/engine/errors';
import type { Vec3 } from '@barocss/cad-model/engine/mesh';
import { carrySelection, commands, patchValues, refOf, selectedBodies, shownFields, subdNodeOf, type Command, type Ctx, type Selection, type Values } from '@barocss/cad-model/app/commands';
import { measureBetween, measureItem, pointInBody, type MeasurePick } from '@barocss/cad-model/app/measure';
import { editFields } from '@barocss/cad-model/app/editFields';
import { DRAG_TYPE, Viewport, type FeatureHandle, type Spot, type SketchAnchor, type SketchShape, type SketchState, type SketchTool, type TransformGizmo, type ViewportHandle } from './viewport/Viewport';
import { Icon, Kbd } from './ui/atoms';
import { FlatPatternDialog } from './ui/FlatPatternDialog';
import { CutListDialog } from './ui/CutListDialog';
import { ToolsTray } from './ui/ToolsTray';
import { partCutList } from '@barocss/cad-model/app/cutList';
import { nestCutList } from '@barocss/cad-model/frames/nesting';
import { Hud } from './ui/Hud';
import { Palette } from './ui/Palette';
import { ShapesStrip } from './ui/ShapesStrip';
import { ContextMenu } from './ui/ContextMenu';
import { ShortcutHelp } from './ui/ShortcutHelp';
import { SketchPanel } from './ui/SketchPanel';
import { Timeline } from './ui/Timeline';
import { clearRecovery, readRecovery, writeRecovery, type Recovery } from './app/recovery';
import { blobStats, collectRecoveryBlobs, evictBlobs, getBlob, loadRecoveryBlobs, meshNodeBlobs, positionsArray, putBlob, saveRecoveryBlobs, setBlobStore } from '@barocss/cad-model/engine/blobs';
import { indexedDbBlobStore } from './ui/blobStore';
// (The recovery copy's blobs kept in this browser's IndexedDB: the store set before the studio reads or writes one — PKG-g2.)
setBlobStore(indexedDbBlobStore());
import { MeshRepairPanel } from './ui/MeshRepairPanel';
import { DEFAULT_REPAIR, MESH_PLANAR_TRIANGLES, bendTableProblem, convexHull, type BendTable, type MeshDiagnosis, type MeshRepairResult, type MeshRepairSteps } from '@barocss/cad';
import { encodeStudioFile, readStudioFile } from '@barocss/cad-model/engine/container';
import { ParametersPanel } from './ui/ParametersPanel';
import { LibraryPanel } from './ui/LibraryPanel';
import { CagePanel } from './ui/CagePanel';
import { useCageEditor } from './subd/useCageEditor';
import { SKETCH3D_COMMAND, useSkeletonEditor } from './skeleton/useSkeletonEditor';
import { SkeletonPanel } from './ui/SkeletonPanel';
import { loadUserLibraries, setLibraryStore } from '@barocss/cad-model/library/libraries';
import { browserStore } from './ui/browserStore';
import { processProfile } from '@barocss/cad-model/library/materials';
import type { BindableField } from '@barocss/cad-model/app/editFields';
import { InstancePanel } from './ui/InstancePanel';
import { TooltipLayer } from './ui/Tooltip';
import { resolveNames, type NameSelection } from '@barocss/cad-model/chat/names';
import { bodyNodes, deleteFeature, deleteFeatures, duplicateBody, featureDependents, moveFeature } from '@barocss/cad-model/chat/features';
import { defaultDrawing, readDrawing, type DrawingSettings } from '@barocss/cad-model/drawing/types';
import { MatePanel } from './ui/MatePanel';
import { JointsPanel } from './ui/JointsPanel';
import { jointTreeOf } from '@barocss/cad-model/robot/joints';
import { forwardKinematics, gearPairAt, sliderRange } from '@barocss/cad-model/robot/fk';
import { treeInertia } from '@barocss/cad-model/robot/inertia';
import { gravityTorques, linkMasses } from '@barocss/cad-model/robot/dynamics';
import { exportUrdf } from '@barocss/cad-model/robot/urdf';
import { exportMjcf, type MjcfClosure } from '@barocss/cad-model/robot/mjcf';
import { sweepLinks } from '@barocss/cad-model/robot/sweep';
import { sweepTimed, type JointLimits } from '@barocss/cad-model/robot/ccd';
import { workspaceMap, type WorkspaceMap } from '@barocss/cad-model/robot/workspace';
import { exportSdf } from '@barocss/cad-model/robot/sdf';
import { exportUsd } from '@barocss/cad-model/robot/usd';
import { closureOfDoc } from '@barocss/cad-model/robot/loop';
import { writeZip } from '@barocss/cad-model/io/zip';
import { useAssembly } from './assembly/useAssembly';
import { pickedSketches, planeOf, profileRings, unusedSketches } from '@barocss/cad-model/app/profiles';
import { fastenerName, fastenerThread } from '@barocss/cad-model/app/fasteners';
import { addedHoles, holeGroup, holeRegions, type ToolRegion } from '@barocss/cad-model/app/holeRegion';
import { threadLines, threadsOf } from '@barocss/cad-model/app/threads';
import type { Analysis } from './viewport/analysis';
import { boundsUnder, instancePoses, poseMatrix } from './viewport/instancePose';
import { asSection, axisSection, hatchSpacing, planeFromFace, sectionHatch, sectionPlanes, sectionSplits, sectionedBodies, sectionedInstances, type AxisSection, type Section } from './viewport/sectionView';
import { SectionBar, sectionHandles } from './ui/SectionBar';
import { mapsOf, type MapKind } from './viewport/scalarMaps';
import { isoclinePolylines } from '@barocss/cad-model/mould/parting';
import { MapLegend, MouldLegend } from './ui/MapLegend';
import { edgeChain } from '@barocss/cad-model/app/edgeChain';
import { offsetShape } from '@barocss/cad-model/sketch/offset';
import { extendAt, joinOpen, splitAt, trimAt } from '@barocss/cad-model/sketch/trim';
import { faceProfile } from '@barocss/cad-model/app/faceProfile';
import { sketchShapes } from '@barocss/cad-model/sketch/reopen';
import { renameToTagged } from '@barocss/cad-model/sketch/entityIds';
import { BODY_COLOURS, bodyName, bodySteps, describeChange, lastFeature, lookOf, materialIdOf, rgbOf, rootOf, withLook } from '@barocss/cad-model/app/bodies';
import { applyBrief, briefMaterial, confirmField, readBrief, type BriefKey } from '@barocss/cad-model/chat/brief';
import { BriefPanel } from './ui/BriefPanel';
import { SpecifyPanel } from './ui/SpecifyPanel';
import { ReferencesPanel } from './ui/ReferencesPanel';
import { checkKeepouts, placeReference, readReferences, referenceLocal, runReferenceTool, withKeepout, type KeepoutResult, type Placement } from '@barocss/cad-model/chat/references';
import { acceptAssumptions, answerBatch } from '@barocss/cad-model/chat/questions';
import { confirmDimension, draftWarning, liveDrafts, runDraftTool } from '@barocss/cad-model/chat/drafts';
import { DraftsPanel } from './ui/DraftsPanel';
import { extrudeProfile } from '@barocss/cad-model/app/profileCommands';
import { editCommand, featureOfPick } from '@barocss/cad-model/app/editCommand';
import { flattenAssembly } from '@barocss/cad-model/assembly/flatten';
import { acceptRevision, dismissRevision, freshPartId, makeIndependent, offerRevision, revisionOf, sharing } from '@barocss/cad-model/assembly/definitions';
import { alignMove, gizmoAxes, movedInstance, previewMatrix, turnedInstance, type InstanceDrag } from '@barocss/cad-model/assembly/drag';
import { BASE, type Mate } from '@barocss/cad-model/assembly/mates';
import type { DirectGeometry } from '@barocss/cad-model/engine/direct';
import { directNow, loadDirect } from '@barocss/cad-model/engine/directModule';
import { stepLengthUnit } from '@barocss/cad-model/engine/stepUnits';
import { FACET_EXPLODE_TRIANGLES, FACET_PREVIEW_TRIANGLES, MESH_UNITS, meshInMM, readMeshFile, type MeshUnit } from '@barocss/cad-model/engine/meshImport';
import { circleCurve, curvesSource, edgeCurve, outlineCurve } from '@barocss/cad-model/engine/curveSource';
import { BUILT_IN, removeTemplate, saveTemplate, savedTemplates } from './app/templates';
import { bodyMass, boxOf, combined, inertiaAbout, sig3 } from '@barocss/cad-model/app/mass';
import { defaultRender, offsetsAt, readRender, type RenderCamera, type RenderSettings } from '@barocss/cad-model/engine/render';
import { downloadBytes, meshToStl } from './ui/files';
import { write3mf } from '@barocss/cad-model/print/threemf';
import { threeMfModelOf } from '@barocss/cad-model/print/export3mf';
import { quotePackage } from '@barocss/cad-model/mould/quote';
import { sketchDxf } from '@barocss/cad-model/sketch/dxf';
import { DWG_ROUTES, dwgRefusal } from '@barocss/cad-model/sketch/dxfRead';
import { settleShape } from '@barocss/cad-model/sketch/settle';
import { boxOnPlane, isDefaultPlane, offsetPlane, planeLabel, planeOfFace, standardPlane, tiltPlane, xyPlane, type SketchPlane } from '@barocss/cad-model/sketch/plane';
import { profileOf, shapeNode } from '@barocss/cad-model/sketch/loops';
import { commitDimension, isSettled } from '@barocss/cad-model/sketch/rules';
import { sketchClick, startPicking } from '@barocss/cad-model/sketch/select';
import { SketchHistory } from '@barocss/cad-model/sketch/history';

// Workspaces off the first screen load when first opened (the chat's tools, the drawing and the render panel).
const ChatPanel = lazy(() => import('./ui/ChatPanel').then(m => ({ default: m.ChatPanel })));
const DrawingWorkspace = lazy(() => import('./ui/DrawingWorkspace').then(m => ({ default: m.DrawingWorkspace })));
const RenderPanel = lazy(() => import('./ui/RenderPanel').then(m => ({ default: m.RenderPanel })));
const DirectPanel = lazy(() => import('./ui/DirectPanel').then(m => ({ default: m.DirectPanel })));
const emptyDirect = (): DirectGeometry => ({ sources: {}, objects: [] });

const TOOLS: { tool: SketchTool; key: string; label: string; icon: string; hint: string }[] = [
  { tool: 'rectangle', key: 'R', label: 'Rectangle', icon: 'cad-sk-rect', hint: 'Click two corners' },
  { tool: 'circle', key: 'C', label: 'Circle', icon: 'cad-sk-circle', hint: 'Click centre, then radius' },
  { tool: 'polygon', key: 'L', label: 'Line', icon: 'cad-sk-line', hint: 'Click points, click the first point to close · A switches to arcs' },
  { tool: 'arc', key: 'A', label: 'Arc', icon: 'cad-sk-arc', hint: 'Click the arc end, move to bend it, click to place · L back to lines' },
  { tool: 'carc', key: 'Q', label: 'Centre arc', icon: 'cad-sk-carc', hint: 'Click the centre, then the start (the radius), then turn to the end and click · it joins lines that meet its ends' },
  { tool: 'slot', key: 'O', label: 'Slot', icon: 'cad-sk-slot', hint: 'Click both centres, then the width' },
  { tool: 'spline', key: 'P', label: 'Spline', icon: 'cad-sk-spline', hint: 'Click points the curve runs smoothly through · click the first point to close it · it is kept as tangent arcs' },
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
/** A history entry's time, local and short (as stored, if not a time). */
const whenOf = (at: string) => { const d = new Date(at); return Number.isNaN(d.getTime()) ? at : d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }); };

/** `placing`: a new shape that follows the pointer until a click (or a drop from the rail) stands it there. */
interface Active { cmd: Command; values: Values; preview: 'busy' | 'ok' | 'error'; error?: FriendlyError; ctx: Ctx; placing?: boolean }

/** The pointer's point to 0.1 mm (it renders again only when that text changes). */
function CursorReadout({ sink }: { sink: React.MutableRefObject<((p: Vec3 | null) => void) | null> }) {
  const [text, setText] = useState('');
  useEffect(() => { sink.current = p => setText(p ? ` · ${p.map(v => fmt(Math.round(v * 10) / 10)).join(', ')}` : ''); return () => { sink.current = null; }; }, [sink]);
  return <>{text}</>;
}

/** Whether an instance places the same part the same way (what its evaluation depends on). */
function samePlacement(a: PartInstance, b: PartInstance): boolean {
  if (a === b) return true;
  if (a.position.some((v, k) => v !== b.position[k]) || a.rotation.some((v, k) => v !== b.rotation[k])) return false;
  return a.doc === b.doc || JSON.stringify(a.doc) === JSON.stringify(b.doc);
}

/** A closed mesh's volume by its triangles (the divergence theorem), for the flow's section check (G19). */
function meshVolume(m: { positions: Float32Array; indices: Uint32Array }): number {
  let v = 0;
  for (let t = 0; t < m.indices.length; t += 3) {
    const a = 3 * m.indices[t], b = 3 * m.indices[t + 1], c = 3 * m.indices[t + 2], P = m.positions;
    v += P[a] * (P[b + 1] * P[c + 2] - P[b + 2] * P[c + 1]) - P[a + 1] * (P[b] * P[c + 2] - P[b + 2] * P[c]) + P[a + 2] * (P[b] * P[c + 1] - P[b + 1] * P[c]);
  }
  return v / 6;
}
/** The studio's own commands in the palette, after the model's (G17's 3D sketch). */
const PALETTE_EXTRA = [SKETCH3D_COMMAND];

export function App() {
  const engine = useMemo(() => new EngineClient(), []);
  const viewport = useRef<ViewportHandle>(null);
  const [doc, setDoc] = useState<StudioDoc>(starterDoc);
  const [marker, setMarker] = useState<number | null>(null);
  const [undo, setUndo] = useState<{ doc: StudioDoc; marker: number | null }[]>([]);
  const [redo, setRedo] = useState<{ doc: StudioDoc; marker: number | null }[]>([]);
  const [bodies, setBodies] = useState<BodyResult[]>([]);
  // The evaluated document the bodies were computed for: while a newer one evaluates (or fails), the bodies are
  // stale, and nothing pairs them with the newer document's names, facts or checks.
  const [bodiesFor, setBodiesFor] = useState<StudioDoc | null>(null);
  /** Bodies set at once for the commit about to happen (a command's preview, an emptied part): claimed by its document. */
  const claimBodies = useRef(false);
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
  // (Each entry keeps the instance it was evaluated for; `key` changes whenever its bodies are evaluated anew.)
  const [instanceBodies, setInstanceBodies] = useState<Map<string, { key: string; inst: PartInstance; bodies: BodyResult[] }>>(new Map());
  const instanceRun = useRef(0);
  const partInput = useRef<HTMLInputElement>(null);
  /** Selected direct curves and surfaces (by object id). */
  const [directSel, setDirectSel] = useState<string[]>([]);
  /** The picked pole of the one selected direct object, and how far its gizmo has dragged it. */
  const [pole, setPole] = useState<{ id: string; key: string } | null>(null);
  const [poleDrag, setPoleDrag] = useState<Vec3 | null>(null);
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
  // (The references' bodies in their own coordinates, the keep-outs' solids, and the keep-outs' verdicts, A6.3.)
  const [refLocal, setRefLocal] = useState<ReadonlyMap<string, BodyResult[]>>(new Map());
  const [keepoutBodies, setKeepoutBodies] = useState<BodyResult[]>([]);
  const [keepoutVerdicts, setKeepoutVerdicts] = useState<KeepoutResult[] | null>(null);
  // (A message the studio sends to the chat as the user's: the Specify panel's answers, A6.2.)
  const [chatOutbox, setChatOutbox] = useState<{ id: number; text: string } | null>(null);
  /** What a chat turn asked to show selected once its part is evaluated. */
  const chatSelection = useRef<NameSelection | null>(null);
  // The pointer's model point, shown in the status bar by its own component (a move re-renders only it).
  const cursorSink = useRef<((p: Vec3 | null) => void) | null>(null);
  const onCursor = useCallback((p: Vec3 | null) => cursorSink.current?.(p), []);
  // (`action`: one button on the toast, e.g. Undo after the agent applied a change directly, D41.)
  const [toast, setToast] = useState<(FriendlyError & { action?: { label: string; run(): void } }) | null>(null);
  // References an opened file stores that could not be told (engine/references.ts), and the candidates on show.
  const [refProblems, setRefProblems] = useState<RefProblem[]>([]);
  const [refChoices, setRefChoices] = useState<{ index: number; names: string[] } | null>(null);
  const [fileName, setFileName] = useState('Bracket-01');
  const [dirty, setDirty] = useState(false);
  /** Unsaved work kept from an earlier visit, offered back once. */
  const [recovery, setRecovery] = useState<Recovery | null>(() => readRecovery());
  // Keep a recovery copy a moment after each change while unsaved; none once saved. When the browser cannot keep it
  // (the document too large for its storage, or storage refused), the older copy is removed and that is said once for
  // the document (until a copy is written again).
  const recoveryOff = useRef<string | null>(null);
  useEffect(() => {
    if (!dirty) return;
    // (A mesh's blobs to IndexedDB beside it: the localStorage copy names them, M1.)
    const t = setTimeout(() => {
      const kept = writeRecovery(fileName, doc);
      if (kept === 'ok') { recoveryOff.current = null; void saveRecoveryBlobs(doc); return; }
      if (recoveryOff.current === fileName) return;
      recoveryOff.current = fileName;
      setToast(kept === 'too-large'
        ? { title: 'Crash recovery is off for this document', hint: 'It is too large for this browser\'s storage, so no recovery copy is kept. Save to keep your work.', detail: '' }
        : { title: 'No recovery copy', hint: 'This browser does not keep one (private browsing, or its storage is full). Save to keep your work.', detail: '' });
    }, 800);
    return () => clearTimeout(t);
  }, [doc, fileName, dirty]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  const [ortho, setOrtho] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => { try { return (localStorage.getItem('cad-studio-theme') as 'dark' | 'light') || 'dark'; } catch { return 'dark'; } });
  /** A surface analysis look on the bodies (modelling view only). */
  const [analysis, setAnalysis] = useState<'zebra' | 'curvature' | 'overhang' | null>(null);
  // (G6: an analysis map on the bodies — IM4 wall thickness; IM2 draft and CNC access when their data lands — and its value under the pointer.)
  const [mapKind, setMapKind] = useState<MapKind | 'parting' | 'halves' | null>(null);
  const [mapHover, setMapHover] = useState<number | null>(null);
  // (G6: the mould's view for the parting and halves maps — built in the engine worker — and how far the halves are spread.)
  const [mouldResult, setMouldResult] = useState<Awaited<ReturnType<EngineClient['mould']>> | 'working' | null>(null);
  const [mouldSpread, setMouldSpread] = useState(0);
  const halvesShownRef = useRef(false);
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
  /** The templates menu and the name a template is saved under. */
  const [templatesOpen, setTemplatesOpen] = useState(false), [templateName, setTemplateName] = useState('');
  /** The Parameters panel. */
  const [paramsOpen, setParamsOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  // (AM2: the overhang map along +Z for the part's printing process, the bed at the bodies' lowest point.)
  const printing = processProfile(doc.process)?.additive ? processProfile(doc.process)! : null;
  const viewAnalysis: Analysis | null = analysis === 'overhang'
    ? (printing ? { kind: 'overhang', sinLimit: Math.sin(printing.thresholds.maxOverhangDeg.value * Math.PI / 180), bedZ: bodies.reduce((m, b) => Math.min(m, b.mesh.bounds.min[2]), Infinity) } : null)
    : analysis;
  // (The user's own libraries kept in this browser, once.)
  // (The user's libraries kept in this browser: the store set before they are read — PKG-b, B4.)
  useEffect(() => { setLibraryStore(browserStore()); loadUserLibraries(); }, []);
  /** The view's field of view (degrees; the Render panel sets it, a saved view keeps it). */
  const [fov, setFov] = useState(32);
  // (G19: one plane, a box or two or three planes — the kept region their intersection; the next face click sets plane `sectionFacePick`.)
  const [section, setSection] = useState<Section | null>(null);
  const [sectionFacePick, setSectionFacePick] = useState<number | null>(null);
  const sectionFacePickRef = useRef(sectionFacePick); sectionFacePickRef.current = sectionFacePick;
  const [sectionExact, setSectionExact] = useState<{ key: string; bodies: BodyResult[] } | null>(null);
  const sectionRef = useRef(section); sectionRef.current = section;
  const activeRef = useRef<Active | null>(null);
  /** The body whose browser row the pointer is on (lit in the viewport). */
  const [rowHover, setRowHover] = useState<number | null>(null);
  const [browserOpen, setBrowserOpen] = useState(() => { try { return localStorage.getItem('cad-studio.browser') !== 'closed'; } catch { return true; } });
  // Measuring: up to two picked faces or edges (null: not measuring).
  const [measure, setMeasure] = useState<MeasurePick[] | null>(null);
  // The SubD cage editor (R8.2, D81): a session on one subd node; Done commits it (see commitRef: commit is defined below).
  const commitRef = useRef<(next: StudioDoc) => void>(() => {});
  const cageEdRef = useRef<ReturnType<typeof useCageEditor>>(null!);
  const cageEd = useCageEditor(doc, useCallback((d: StudioDoc) => engine.preview(d, revision.current++), [engine]), useCallback((next: StudioDoc) => commitRef.current(next), []), useCallback((title: string, hint: string) => setToast({ title, hint, detail: '' }), []));
  // (G17: the 3D sketch's session — points, segments, FRg's constraints — written as one skeleton feature on Apply.)
  const skel = useSkeletonEditor(doc, useCallback((next: StudioDoc) => commitRef.current(next), []), useCallback((title: string, hint: string) => setToast({ title, hint, detail: '' }), []), snapStep);
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
    // The cage editor's session for tests: what is picked (and the picked faces' mean heights: which face a click
    // took), the cage, its creases, mirror and undo depth (R8.3's browser flow).
    (window as unknown as { __studioCage: () => unknown }).__studioCage = () => {
      const s = cageEdRef.current.session; if (!s) return null;
      const z = s.sel.faces.map(f => s.cage.faces[f].reduce((t, v) => t + s.cage.positions[3 * v + 2], 0) / s.cage.faces[f].length);
      return { faces: s.sel.faces.length, edges: s.sel.edges.length, vertices: s.sel.vertices.length, z, cageFaces: s.cage.faces.length, creases: s.cage.creases?.length ?? 0, mirror: s.mirror ?? null, undo: s.undo.length, mode: s.mode, sel: s.sel, cage: s.cage };
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
  // (FRc, O117: the section library is model input too — a frame on a row is built from it.)
  // (FRf2, O125: and the placed parts, when a frame follows a part's sketch — not otherwise, so moving parts does not re-evaluate the base.)
  const followsParts = doc.nodes.some(n => n.kind === 'frame' && !!n.follows && 'part' in n.follows);
  const evaluated = useMemo(() => prefixDoc(doc, marker ?? doc.nodes.length), [doc.nodes, doc.parameters, doc.frames?.sections, followsParts ? doc.instances : null, marker]);
  const sectionRun = useRef<{ busy: boolean; next: (() => Promise<void>) | null }>({ busy: false, next: null });
  // The section: the part with each body that crosses the plane split there (the rest kept or left out whole).
  useEffect(() => {
    if (!section) { setSectionExact(null); return; }
    let live = true; const key = JSON.stringify(section);
    // (G19: each body split by each plane that crosses what is left of it, the kept pieces' keys.)
    const { doc, kept } = sectionSplits(evaluated, bodies, section);
    // Latest wins: while one section is worked out, only the newest plane waits behind it.
    const run = sectionRun.current;
    run.next = async () => { const r = await engine.section(doc, revision.current++); if (live && r.ok) setSectionExact({ key, bodies: r.bodies.filter(b => kept.includes(b.key)) }); };
    if (!run.busy) void (async () => { run.busy = true; try { while (run.next) { const j = run.next; run.next = null; await j(); } } finally { run.busy = false; } })();
    return () => { live = false; };
  }, [section, bodies, evaluated, engine]);
  // At once (while the plane is dragged, until the exact section arrives): on WebGPU the bodies whole, cut and capped by
  // the viewer's clip plane (G2); on WebGL2 the meshes clipped and capped on the CPU.
  // (Dev/test: the exact section held back, and the CPU's path forced, to compare the two clips through one viewer.)
  const [sectionDebug, setSectionDebug] = useState({ hold: false, cpu: false });
  const gpuSection = viewport.current?.backend === 'webgpu' && !sectionDebug.cpu;
  const sectionClipped = useMemo(() => {
    if (!section) return null;
    // (The section's first split is the next feature: its cut faces are named after the next id, engine/ids.ts.)
    return sectionedBodies(bodies, section, gpuSection, `n${nextSerial(evaluated)}.cut`);
  }, [section, bodies, evaluated, gpuSection]);
  const sectionExactShown = !!section && sectionExact?.key === JSON.stringify(section) && !sectionDebug.hold;
  const sectionBodies = section ? (sectionExactShown ? sectionExact!.bodies : sectionClipped) : null;
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
        setBodies(result.bodies); setBodiesFor(evaluated); claimBodies.current = false;
        if (chatSelection.current) setSelection(resolveNames(result.bodies, chatSelection.current).selection); else setSelection(sel => carrySelection(sel, prev, result.bodies));
        if (again.current) { setRestart(again.current); again.current = null; }
        chatSelection.current = null;
      }
      else setToast(result.error);
    });
    return () => { live = false; };
  }, [engine, evaluated]);
  // (A command's preview is what the part becomes: its bodies belong to the document it commits.)
  useEffect(() => { if (claimBodies.current) { claimBodies.current = false; setBodiesFor(evaluated); } }, [evaluated]);
  const fresh = bodiesFor === evaluated;
  // (Tests: the bodies shown are the current document's and nothing is computing — set in the commit that changes the
  // document, so a test never reads the last document's bodies as this one's, D109.)
  useEffect(() => { if (import.meta.env.DEV) (window as unknown as { __studioFresh: boolean }).__studioFresh = fresh && !busy; }, [fresh, busy]);
  /** The document whose names and looks go with the bodies shown (the one they were computed for). */
  const namesDoc = fresh || !bodiesFor ? doc : bodiesFor;

  const bodiesRef = useRef(bodies); bodiesRef.current = bodies;
  const ctx: Ctx = { doc: evaluated, bodies, selection, pick: pick ?? undefined, direct: directSel };
  const evaluatedRef = useRef(evaluated); evaluatedRef.current = evaluated;

  /** The document as it is, kept for undo (redo is gone once something new is done). */
  const pushUndo = () => { setUndo(u => [...u.slice(-49), { doc, marker }]); setRedo([]); };
  // (`capture`: references this change wrote were picked on the bodies shown; a whole document replaced was not.
  // `whole`: a new or opened document, nothing of the one before carried into it.)
  const commit = useCallback((next: StudioDoc, capture = true, whole = false) => {
    // Counted as the History bar shows them: sketches are part of the feature made from them.
    const dropped = marker !== null ? doc.nodes.slice(marker).filter(n => n.kind !== 'sketch').length : 0;
    pushUndo();
    // Commands build on the evaluated document, which follows the model only: what they leave as it was
    // there (every field but the model's own: engine/doc.ts carryOver) is the document's newest.
    const was = evaluatedRef.current;
    if (!whole) next = carryOver(next, was, doc);
    // (References written by this change get their signatures from the bodies they were picked on, engine/references.ts.)
    if (capture) next = captureSignatures(next, bodies);
    setDoc(next); setMarker(null); setDirty(true); setEditNode(null);
    // An empty document has no bodies; clear them now so defaults are not computed from the old model.
    if (!Object.keys(next.outputs).length) { setBodies([]); claimBodies.current = true; setSelection(emptySel); }
    if (dropped > 0) setToast({ title: `Removed ${dropped} later feature${dropped > 1 ? 's' : ''}`, hint: 'You added a feature while rolled back. Undo restores them.', detail: '' });
  }, [doc, marker, bodies]);
  commitRef.current = commit; cageEdRef.current = cageEd;
  /** One undoable change of the render settings (the model and the rollback marker stay). */
  const commitRender = useCallback((next: RenderSettings) => {
    pushUndo();
    setDoc({ ...doc, render: next }); setDirty(true);
  }, [doc, marker]);
  /** One undoable change of the drawing settings (the model stays). */
  const commitDrawing = useCallback((next: DrawingSettings) => {
    pushUndo();
    setDoc({ ...doc, drawing: next }); setDirty(true);
  }, [doc, marker]);
  /** One undoable change of the direct geometry (the model stays as evaluated). */
  const commitDirect = useCallback((next: DirectGeometry, select?: string[]) => {
    pushUndo();
    setDoc({ ...doc, direct: next }); setDirty(true);
    if (select) setDirectSel(select);
  }, [doc, marker]);
  const poleObj = directSel.length === 1 ? directSel[0] : null;
  // The direct tools load when the document first has direct geometry (state: re-render once they are in).
  const [directReady, setDirectReady] = useState(() => !!directNow());
  useEffect(() => { if (doc.direct?.objects.length && !directReady) void loadDirect().then(() => setDirectReady(true)); }, [doc.direct, directReady]);
  const D = directReady ? directNow() : null;
  const poles = useMemo(() => { if (!poleObj || !doc.direct || !D) return []; try { return D.polesOf(doc.direct, poleObj); } catch { return []; } }, [doc.direct, poleObj, D]);
  const poleHere = pole && pole.id === poleObj ? poles.find(p => p.key === pole.key) ?? null : null;
  const poleMoved = (delta: readonly number[]) => poleHere!.at.map((v, k) => v + delta[k]);
  // While a pole is dragged, its object is shown re-evaluated with the pole where the gizmo has it.
  const directShown = useMemo(() => {
    if (!D) return [];
    if (poleDrag && poleHere && poleObj && doc.direct) try { return D.directDisplay(D.movePole(doc.direct, poleObj, poleHere.key, poleHere.at.map((v, k) => v + poleDrag[k]))); } catch { /* shown as it was */ }
    return D.directDisplay(doc.direct);
  }, [doc.direct, poleDrag, poleHere, poleObj, D]);
  /** One undoable change of the placed instances. */
  const commitInstances = useCallback((next: PartInstance[], select?: string[]) => {
    pushUndo();
    setDoc({ ...doc, instances: next }); setDirty(true);
    if (select) setInstanceSel(select);
  }, [doc, marker]);
  // Evaluate each instance whose placed part changed (in the worker, beside the main part).
  useEffect(() => {
    let live = true;
    (async () => {
      const next = new Map<string, { key: string; inst: PartInstance; bodies: BodyResult[] }>();
      for (const inst of doc.instances ?? []) {
        // The same placement of the same part (objects are replaced on edit, so by reference first; a new
        // object only when its content changed, compared then).
        const have = instanceBodies.get(inst.id);
        if (have && samePlacement(have.inst, inst)) { next.set(inst.id, have.inst === inst ? have : { ...have, inst }); continue; }
        const r = await engine.placed(placedDoc(inst), placedBase(inst), placementOf(inst), revision.current++);
        if (!live) return;
        if (r.ok) next.set(inst.id, { key: `${inst.id}#${++instanceRun.current}`, inst, bodies: r.bodies });
        else setToast(r.error);
      }
      if (live) setInstanceBodies(next);
    })();
    return () => { live = false; };
  }, [doc.instances]);
  /** One undoable change of the instances and their mates together. */
  /** One undoable change of the placed parts and their waiting revisions (shared definitions). */
  const commitParts = useCallback((next: Pick<StudioDoc, 'instances' | 'pendingParts'>) => {
    pushUndo();
    setDoc({ ...doc, instances: next.instances, pendingParts: next.pendingParts }); setDirty(true);
  }, [doc, marker]);
  const commitAssembly = useCallback((instances: PartInstance[], mates: Mate[]) => {
    pushUndo();
    setDoc({ ...doc, instances, mates }); setDirty(true);
  }, [doc, marker]);
  const assembly = useAssembly({ doc, evaluated, bodies, instanceBodies, setDoc, commit: commitAssembly });
  // The assembly as a robot (RM1): its joint tree from the solved instances, the faces read, the parts' gears.
  const jointTree = useMemo(() => !doc.mates?.length || !doc.instances?.length ? null : jointTreeOf(doc, { instances: doc.instances, problems: assembly.problems }, p => assembly.tables.get(p),
    p => (p === BASE ? bodies : instanceBodies.get(p)?.bodies ?? []).flatMap(b => (b.gear ? [b.gear] : []))), [doc, assembly.problems, assembly.tables, bodies, instanceBodies]);
  // (Every placed part evaluated with its bodies: until then the robot's masses, exports and sweeps wait, RM6 — a part
  // not yet evaluated is not massless.)
  const robotReady = (doc.instances ?? []).every(i => instanceBodies.get(i.id)?.inst === i);
  // Each link's mass properties (RM3): the bodies as placed (world), so each part's placement is the identity here.
  const linkInertias = useMemo(() => !jointTree || !robotReady ? undefined : treeInertia(jointTree, p => {
    if (p === BASE) return { doc, bodies, position: [0, 0, 0], rotation: [0, 0, 0] };
    const i = doc.instances?.find(x => x.id === p), b = instanceBodies.get(p);
    return i && b ? { doc: i.doc, bodies: b.bodies, position: [0, 0, 0], rotation: [0, 0, 0] } : null;
  }), [jointTree, doc, bodies, instanceBodies, robotReady]);
  // What each joint holds against gravity at the pose shown (RD1): the masses as placed (world), identity placements.
  const jointMasses = useMemo(() => !jointTree || !robotReady ? null : linkMasses(jointTree, p => {
    if (p === BASE) return { doc, bodies, position: [0, 0, 0], rotation: [0, 0, 0] };
    const i = doc.instances?.find(x => x.id === p), b = instanceBodies.get(p);
    return i && b ? { doc: i.doc, bodies: b.bodies, position: [0, 0, 0], rotation: [0, 0, 0] } : null;
  }), [jointTree, robotReady, doc, bodies, instanceBodies]);
  // The joint-slider pose (RM2): a preview only — the instances shown moved by forward kinematics, nothing saved.
  const [jointValues, setJointValues] = useState<Record<string, number>>({});
  const [jointPlaying, setJointPlaying] = useState<string | null>(null);
  const [pathCheck, setPathCheck] = useState<{ text: string; contact: boolean } | null>(null);
  // (RM9a: the waypoints recorded for Check path, a preview like the pose; nothing saved.)
  const [jointWaypoints, setJointWaypoints] = useState<Record<string, number>[]>([]);
  // (RM9b: the workspace map shown, a preview; nothing saved.)
  const [workspace, setWorkspace] = useState<WorkspaceMap | null>(null);
  /** A robot part for the exports (RM4–RM9c): the bodies as placed, so each part's placement is the identity here. */
  const robotPartOf = (p: string) => { if (p === BASE) return { doc, bodies, position: [0, 0, 0], rotation: [0, 0, 0] }; const i = doc.instances?.find(x => x.id === p), b = instanceBodies.get(p); return i && b ? { doc: i.doc, bodies: b.bodies, position: [0, 0, 0], rotation: [0, 0, 0] } : null; };
  /** The tree's planar loops closed at their pins (RM8), those that are not left out (the exports note them). */
  const robotClosures = (): MjcfClosure[] => { const out: MjcfClosure[] = []; if (jointTree) for (const l of jointTree.loops) { try { out.push(closureOfDoc(doc, jointTree, l)); } catch { /* not planar: noted */ } } return out; };
  // (O68: the drawings' underlays not hidden, from their planes into the world — the XY plane by default.)
  const underlaysShown = useMemo(() => (doc.underlays ?? []).filter(u => !u.hidden).map(u => {
    const p = u.plane ?? { origin: [0, 0, 0], normal: [0, 0, 1], xAxis: [1, 0, 0] }, n = p.normal, x = p.xAxis, y: Vec3 = [n[1] * x[2] - n[2] * x[1], n[2] * x[0] - n[0] * x[2], n[0] * x[1] - n[1] * x[0]];
    const at = (q: readonly number[]): Vec3 => [p.origin[0] + q[0] * x[0] + q[1] * y[0], p.origin[1] + q[0] * x[1] + q[1] * y[1], p.origin[2] + q[0] * x[2] + q[1] * y[2]];
    const dirOf = (deg: number, quarter: number): Vec3 => { const t = (deg + quarter) * Math.PI / 180; return [Math.cos(t) * x[0] + Math.sin(t) * y[0], Math.cos(t) * x[1] + Math.sin(t) * y[1], Math.cos(t) * x[2] + Math.sin(t) * y[2]]; };
    return { id: u.id, lines: u.polylines.map(l => l.map(at)), texts: u.texts.map(t => ({ at: at(t.at), dir: dirOf(t.angle, 0), up: dirOf(t.angle, 90), text: t.text, height: t.height })) };
  }), [doc.underlays]);
  /** A synthetic workspace map for the bench (G8, DEV: `__studioSetCloud`), shown in place of the arm's. */
  const [benchCloud, setBenchCloud] = useState<{ at: Vec3; t: number }[] | null>(null);
  const workspaceCloud = useMemo(() => { if (!workspace) return null; const best = Math.max(0, ...workspace.voxels.map(v => v.w)); return workspace.voxels.map(v => ({ at: v.c as Vec3, t: best > 0 ? v.w / best : 0 })); }, [workspace]);
  // (A path checked is for the pose it was checked to: moving a joint clears it.)
  useEffect(() => setPathCheck(null), [jointValues, jointTree]);
  useEffect(() => { setJointWaypoints([]); setWorkspace(null); }, [jointTree]);
  const jointFk = useMemo(() => jointTree && Object.values(jointValues).some(v => v !== 0) ? forwardKinematics(jointTree, jointValues) : null, [jointTree, jointValues]);
  const gearLines = useMemo(() => (jointTree?.couplings ?? []).map(c => { const at = gearPairAt(c, jointFk?.values ?? {}), home = gearPairAt(c, {}), d = Math.abs(at.phaseDeg - home.phaseDeg); return { leader: c.leader, follower: c.follower, multiplier: c.multiplier, held: Math.min(d, 360 / c.g2.spec.teeth - d) < 1e-6, backlashMM: at.backlashMM }; }), [jointTree, jointFk]);
  // (Joints gone from the tree lose their values; a joint played swings through its range, a period of 4 s.)
  useEffect(() => { const keys = new Set(jointTree?.joints.map(j => j.key) ?? []); setJointValues(v => Object.keys(v).every(k => keys.has(k)) ? v : Object.fromEntries(Object.entries(v).filter(([k]) => keys.has(k)))); if (jointPlaying && !keys.has(jointPlaying)) setJointPlaying(null); }, [jointTree]);
  useEffect(() => {
    const j = jointPlaying ? jointTree?.joints.find(x => x.key === jointPlaying) : undefined;
    if (!j) return;
    const r = sliderRange(j), mid = (r.min + r.max) / 2, amp = (r.max - r.min) / 2, t0 = performance.now();
    let frame = requestAnimationFrame(function step(now) { setJointValues(v => ({ ...v, [j.key]: mid + amp * Math.sin(2 * Math.PI * (now - t0) / 4000) })); frame = requestAnimationFrame(step); });
    return () => cancelAnimationFrame(frame);
  }, [jointPlaying, jointTree]);
  // (Each with its placement, as the bodies were placed: copies of one tessellation share a geometry in the viewer, G10.)
  const instancesPlaced = useMemo(() => (doc.instances ?? []).filter(i => !i.hidden && instanceBodies.has(i.id)).map(i => { const b = instanceBodies.get(i.id)!, p = placementOf(b.inst); return { id: i.id, bodies: b.bodies, placement: poseMatrix({ R: Float64Array.from(p.m), t: Float64Array.from(p.t) }, undefined) }; }), [doc.instances, instanceBodies]);
  // The exploded view (display only): each instance pushed out from the middle by the explode factor.
  const [explode, setExplode] = useState(0);
  // (Dev/bench: any explode factor, as a drag would set it frame by frame; the button steps 0, 0.5, 1, 2.)
  useEffect(() => { if (import.meta.env.DEV) (window as unknown as { __studioSetExplode: (k: number) => void }).__studioSetExplode = setExplode; }, []);
  // (G1: posed and exploded by a matrix per instance on its meshes, not by moved copies of them: the meshes are made once.)
  const instancePoseMap = useMemo(() => instancePoses(bodies, instancesPlaced, jointFk, explode), [instancesPlaced, explode, bodies, jointFk]);
  // (The flow's view of what is shown, RM2: each instance's bounds as placed, posed or exploded.)
  useEffect(() => { if (import.meta.env.DEV) (window as unknown as { __studioInstanceBounds: () => unknown }).__studioInstanceBounds = () => instancesPlaced.map(i => { const b = i.bodies[0]?.mesh, M = instancePoseMap.get(i.id), box = b && M ? boundsUnder(b.positions, M) : b?.bounds; return { id: i.id, min: box?.min, max: box?.max }; }); }, [instancesPlaced, instancePoseMap]);
  // The section view cuts the placed parts too: on WebGPU by the clip plane where their matrices put them (G2), on WebGL2
  // as moved copies clipped and capped.
  const instancesShown = useMemo(() => !section || sketch ? instancesPlaced : sectionedInstances(instancesPlaced, instancePoseMap, section, gpuSection), [instancesPlaced, instancePoseMap, section, sketch, gpuSection]);
  // (The CPU's clipped copies are already moved; otherwise the meshes take the matrices.)
  const instanceTransforms = section && !sketch && !gpuSection ? undefined : instancePoseMap;
  const insertPart = async (file: File) => {
    try {
      const read = await readStudioFile(new Uint8Array(await file.arrayBuffer()));
      if ('error' in read) throw new Error(read.error);
      const parsed = read.doc;
      const list = doc.instances ?? [], used = new Set(list.map(i => i.id));
      let n = 1; while (used.has(`inst${n}`)) n++;
      // Placed to the right of everything shown.
      const right = Math.max(0, ...bodies.map(b => b.mesh.bounds.max[0]), ...[...instanceBodies.values()].flatMap(v => v.bodies.map(b => b.mesh.bounds.max[0])));
      const inst: PartInstance = { id: `inst${n}`, name: file.name.replace(/\.(bcad|json)$/i, ''), doc: { ...parsed, render: undefined, direct: undefined }, position: [Math.ceil(right + 20), 0, 0], rotation: [0, 0, 0], part: { id: freshPartId(doc), rev: revisionOf(parsed), source: file.name } };
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
      // A part it places as an instance (a fastener inserted as its own part) shows folded in as features.
      const placed = (candidate.instances ?? []).filter(i => !(ctx.doc.instances ?? []).some(j => j.id === i.id));
      if (placed.length) shown = flattenAssembly({ ...candidate, instances: placed });
      if (!full && handleDrag.current?.dragging && candidate.nodes.length === ctx.doc.nodes.length) {
        // (The last node the drag changed: nodes it left are the same objects, compared by content only if not.)
        let k = -1; for (let i = 0; i < candidate.nodes.length; i++) { const n = candidate.nodes[i], o = ctx.doc.nodes[i]; if (n !== o && JSON.stringify(n) !== JSON.stringify(o)) k = i; }
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
    const next = active.cmd.build(active.ctx, active.values);
    // (Not when it places an instance: those bodies are the instance's, shown once it is evaluated.)
    if (previewBodies && (next.instances?.length ?? 0) === (active.ctx.doc.instances?.length ?? 0)) { setBodies(previewBodies); claimBodies.current = true; }
    commit(next); setActive(null); setPreviewBodies(null); setSketch(null);
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
    if (cmd.id === SKETCH3D_COMMAND.id) { cancel(); skel.begin(null); setSelection(emptySel); setEditNode(null); return; }
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
    if (cmd.action === 'cage') { const n = subdNodeOf(ctx); if (n !== null) { cageEd.begin(n); setSelection(emptySel); setEditNode(null); } return; }
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

  /** The sketch's shapes as curves of the direct geometry (one per shape, through the sketch plane); the sketch is left. */
  const sketchToCurves = async () => {
    if (!sketch) return;
    const shapes = [...(sketch.done ?? []), ...(sketch.shape ? [sketch.shape] : [])], P = sketch.plane;
    const curves = shapes.flatMap(s => s.kind === 'circle' ? [circleCurve(P, s.c, s.r)]
      : s.kind === 'rectangle' ? [outlineCurve(P, [s.a, [s.b[0], s.a[1]], s.b, [s.a[0], s.b[1]]], undefined, true)]
        : s.kind === 'slot' ? (() => { const l = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]) || 1, n: [number, number] = [-(s.b[1] - s.a[1]) / l * s.r, (s.b[0] - s.a[0]) / l * s.r]; return [outlineCurve(P, [[s.a[0] - n[0], s.a[1] - n[1]], [s.b[0] - n[0], s.b[1] - n[1]], [s.b[0] + n[0], s.b[1] + n[1]], [s.a[0] + n[0], s.a[1] + n[1]]], [0, 1, 0, 1], true)]; })()
          : s.points.length >= 2 ? [outlineCurve(P, s.points, s.bulges, s.closed)] : []);
    if (!curves.length) { setToast({ title: 'Nothing to make curves of', hint: 'Draw lines, arcs or circles in the sketch first.', detail: '' }); return; }
    if (curves.length > 16) { setToast({ title: 'Too many shapes', hint: 'Make curves of at most 16 shapes at a time.', detail: '' }); return; }
    const { importSource } = await loadDirect();
    const made = (doc.direct?.objects ?? []).filter(o => o.name.startsWith('Sketch curve')).length, next = importSource(doc.direct ?? emptyDirect(), curvesSource('sketch', curves), `Sketch curve ${made + 1}`);
    setSketch(null); commitDirect(next, next.objects.slice(doc.direct?.objects.length ?? 0).map(o => o.id));
  };
  /** The picked edges as curves of the direct geometry. */
  const edgesToCurves = async () => {
    const curves = selection.edges.flatMap(e => { const c = bodies[e.body] ? edgeCurve(bodies[e.body].mesh, e.edge) : null; return c ? [c] : []; });
    if (!curves.length) return;
    const { importSource } = await loadDirect();
    const made = (doc.direct?.objects ?? []).filter(o => o.name.startsWith('Edge curve')).length, next = importSource(doc.direct ?? emptyDirect(), curvesSource('edges', curves.slice(0, 16)), `Edge curve ${made + 1}`);
    commitDirect(next, next.objects.slice(doc.direct?.objects.length ?? 0).map(o => o.id));
  };
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
    const { shape, done, positional } = sketchShapes(node), plane: SketchPlane = node.plane ? { origin: [...node.plane.origin], normal: [...node.plane.normal], xAxis: [...node.plane.xAxis] } : xyPlane();
    setEditNode(null); setActive(null); setPreviewBodies(null); setSelection(emptySel);
    setSketch(startPicking({ plane, tool: 'select', shape, done, base: null, editNode: index, ...(positional ? { positional } : {}) }, 'select'));
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
      const at = sketch.editNode, edited = { ...doc, nodes: dropStaleMade(doc.nodes, doc.nodes.map((n, k) => k === at ? placedNode : n)) };
      // (A sketch from before R10a getting its side ids: the features on it keep their references, by the new names.)
      const tags = (placedNode as SketchNode).sideTags, next = sketch.positional && tags && !(doc.nodes[at] as SketchNode).sideTags ? renameToTagged(edited, at, sketch.positional, tags, featureId) : edited;
      engine.evaluate(prefixDoc(next, marker ?? next.nodes.length), revision.current++).then(r => { if (!r) return; if (r.ok) { commit(next); setSketch(null); } else setToast(r.error); });
      return;
    }
    // A finished sketch is a feature of its own (it remembers the body it was drawn on): picked, ready
    // for Extrude, Revolve, Pipe or Loft.
    const base = sketch.base ?? null, next = withNode(doc, { ...placedNode, ...(base ? { on: base } : {}) } as SketchNode);
    commit(next); setSketch(null);
    setSelection({ ...emptySel, sketches: [next.nodes.length - 1] });
  }, [sketch, doc, marker, commit, engine]);

  const onPick = useCallback((hit: { face: { body: number; face: number } | null; edge: { body: number; edge: number } | null; point: Vec3 | null; direct?: string; instance?: string; instanceFace?: { body: number; face: number }; vertex?: { body: number; at: Vec3 } }, additive: boolean) => {
    // (The section view shows cut copies of the bodies: picks wait until it is closed.)
    // (G19: a face for a section plane — its plane, the material behind it kept.)
    if (sectionRef.current && sectionFacePickRef.current !== null && hit.face) {
      const i = sectionFacePickRef.current, f = viewBodiesRef.current[hit.face.body]?.mesh.faces[hit.face.face];
      if (f && f.kind === 'plane') { const q = planeFromFace(f, sectionBoxRef.current); setSection(sc => sc && { ...sc, planes: sc.planes.map((p, j) => j === i ? q : p) }); setSectionFacePick(null); }
      else setToast({ title: 'Not a flat face', hint: 'A section plane is taken from a flat face.', detail: '' });
      return;
    }
    if (sectionRef.current && !activeRef.current) return;
    // (G6: while the mould's halves show, picks reach only them — none here.)
    if (halvesShownRef.current && !activeRef.current) return;
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
      if (!hit.face && !hit.edge && !hit.vertex) return;
      const p: MeasurePick = hit.vertex ? { body: hit.vertex.body, vertex: hit.vertex.at } : hit.edge ? { body: hit.edge.body, edge: hit.edge.edge } : { body: hit.face!.body, face: hit.face!.face };
      setMeasure(m => !m || m.length >= 2 ? [p] : [...m, p]); return;
    }
    // A corner: picked on its own (Shift adds or takes back another).
    if (hit.vertex) { const v = hit.vertex; setPick(null); setSelection(prev => { const list = prev.vertices ?? [], same = (a: typeof v) => a.body === v.body && a.at.every((x, k) => Math.abs(x - v.at[k]) < 1e-9); return { ...emptySel, vertices: additive ? (list.some(same) ? list.filter(a => !same(a)) : [...list, v]) : [v] }; }); return; }
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

  // A computation running past a second can be stopped (D42: a committed Boolean on a mesh of up to 20000
  // triangles takes a few seconds): the worker restarts and the change that started it is taken back.
  const [slow, setSlow] = useState(false);
  useEffect(() => { if (!busy) { setSlow(false); return; } const t = setTimeout(() => setSlow(true), 1000); return () => clearTimeout(t); }, [busy]);
  const cancelWork = () => {
    engine.restart(); setBusy(false); setSlow(false); setPreviewBodies(null);
    if (undo.length) { doUndo(); setToast({ title: 'Stopped', hint: 'The computation was stopped and the change taken back.', detail: '' }); }
    else setToast({ title: 'Stopped', hint: 'The computation was stopped; the part shows as it was last computed.', detail: '' });
  };
  const doUndo = useCallback(() => {
    if (!undo.length) return; const last = undo[undo.length - 1];
    setRedo(r => [...r, { doc, marker }]); setUndo(u => u.slice(0, -1)); setDoc(last.doc); setMarker(last.marker); cancel();
  }, [undo, doc, marker, cancel]);
  // (The latest undo, for a toast made before the change it takes back was committed.)
  const undoNow = useRef(doUndo); undoNow.current = doUndo;
  const doRedo = useCallback(() => {
    if (!redo.length) return; const last = redo[redo.length - 1];
    setUndo(u => [...u, { doc, marker }]); setRedo(r => r.slice(0, -1)); setDoc(last.doc); setMarker(last.marker); cancel();
  }, [redo, doc, marker, cancel]);

  // Deleting a feature (with the sketches only it used): later features, mates and drawing dimensions follow.
  const deleteNode = (index: number) => {
    if (marker !== null) { setToast({ title: 'Roll forward to delete', hint: 'Features are deleted from the whole history: roll forward to the end first.', detail: '' }); return; }
    const label = featureLabel(doc.nodes[index], index, doc.nodes), r = deleteFeature(doc, index);
    if ('error' in r) {
      // Others build on it: offer to delete them with it, after listing them.
      const deps = featureDependents(doc, index);
      if (deps.length && 'doc' in deleteFeatures(doc, [index, ...deps])) { setCascade({ index, label, deps: deps.map(k => featureLabel(doc.nodes[k], k, doc.nodes)), all: [index, ...deps] }); return; }
      setToast({ title: `Cannot delete ${label}`, hint: r.error, detail: '' }); return;
    }
    engine.evaluate(prefixDoc(r.doc, r.doc.nodes.length), revision.current++).then(e => {
      if (!e) return;
      if (!e.ok) { setToast({ ...e.error, title: `Cannot delete ${label}: ${e.error.title}` }); return; }
      commit(r.doc);
      if (r.droppedDimensions) setToast({ title: `Removed ${r.droppedDimensions} drawing dimension${r.droppedDimensions > 1 ? 's' : ''}`, hint: `They measured ${label}. Undo restores them.`, detail: '' });
    });
  };
  /** A sketch on the section plane holding the exact section's cut outlines (its cut faces' outlines), the section closed. */
  const sketchSection = () => {
    // (One plane only: a sketch lies on one.)
    if (!section || section.planes.length !== 1) return;
    const exact = sectionExact?.key === JSON.stringify(section) ? sectionExact.bodies : null;
    if (!exact) { setToast({ title: 'The section is still being cut', hint: 'Wait a moment for the exact section, then try again.', detail: '' }); return; }
    const from = nextSerial(evaluated), faces = exact.flatMap(b => b.mesh.faces.filter(f => f.kind === 'plane' && cutAfter(f.name, from)).map(f => ({ b, f })));
    if (!faces.length) { setToast({ title: 'Nothing is cut there', hint: 'Move the section plane through the part first.', detail: '' }); return; }
    const plane = planeOfFace(faces[0].f.normal, faces[0].f.centroid); if (!plane) return;
    const shapes = faces.flatMap(({ b, f }) => { const fp = faceProfile(b.mesh, f.index); return fp ? (({ shape, done }) => [...(shape ? [shape] : []), ...done])(sketchShapes(fp)) : []; });
    if (!shapes.length) { setToast({ title: 'The section’s outline could not be read', hint: 'Its edges are not lines and arcs yet.', detail: '' }); return; }
    setSection(null); setSelection(emptySel);
    setSketch({ plane, anchor: { kind: 'face', offset: 0, face: { plane, base: null } }, tool: 'rectangle', shape: null, done: shapes, base: null });
    const [min, max] = sketchRegion(bodies, plane); viewport.current?.frameSketch(min, max, plane, SKETCH_INSETS);
  };
  /** A body in several pieces made one body per piece (a Separate step), checked by evaluating first. */
  const separate = (b: BodyResult) => {
    if (marker !== null) { setToast({ title: 'Roll forward first', hint: 'New steps go at the end of the history.', detail: '' }); return; }
    const next = withNode(doc, { kind: 'separate', parent: refOf(b) });
    engine.evaluate(prefixDoc(next, next.nodes.length), revision.current++).then(e => {
      if (!e) return;
      if (!e.ok) { setToast({ ...e.error, title: `Cannot separate it: ${e.error.title}` }); return; }
      commit(next); setSelection(emptySel);
    });
  };
  /** Moves a history step one earlier or later (refused before what it is built on), checked by evaluating first. */
  const reorder = (i: number, dir: -1 | 1) => {
    if (marker !== null) { setToast({ title: 'Roll forward to reorder', hint: 'Steps are moved in the whole history: roll forward to the end first.', detail: '' }); return; }
    const label = featureLabel(doc.nodes[i], i, doc.nodes), r = moveFeature(doc, i, dir);
    if ('error' in r) { setToast({ title: `Cannot move ${label}`, hint: r.error, detail: '' }); return; }
    engine.evaluate(prefixDoc(r.doc, r.doc.nodes.length), revision.current++).then(e => {
      if (!e) return;
      if (!e.ok) { setToast({ ...e.error, title: `Cannot move ${label} there: ${e.error.title}` }); return; }
      commit(r.doc);
    });
  };
  /** Leaves a feature out of the model (or brings it back): checked by evaluating first, like any edit. */
  const toggleSuppress = (i: number) => {
    const n = doc.nodes[i]; if (!n) return;
    const next = { ...doc, nodes: doc.nodes.map((x, k) => k !== i ? x : x.suppressed ? (({ suppressed: _s, ...rest }) => rest as ModelNode)(x) : { ...x, suppressed: true as const }) };
    const label = featureLabel(n, i, doc.nodes);
    engine.evaluate(prefixDoc(next, marker ?? next.nodes.length), revision.current++).then(e => {
      if (!e) return;
      if (!e.ok) { setToast({ ...e.error, title: `Cannot ${n.suppressed ? 'unsuppress' : 'suppress'} ${label}: ${e.error.title}` }); return; }
      commit(next);
    });
  };
  /** A delete waiting on its review: the feature, and the ones built on it that would go with it. */
  const [cascade, setCascade] = useState<{ index: number; label: string; deps: string[]; all: number[] } | null>(null);
  const deleteCascade = () => {
    if (!cascade) return;
    const r = deleteFeatures(doc, cascade.all), label = cascade.label; setCascade(null);
    if ('error' in r) { setToast({ title: `Cannot delete ${label}`, hint: r.error, detail: '' }); return; }
    engine.evaluate(prefixDoc(r.doc, r.doc.nodes.length), revision.current++).then(e => {
      if (!e) return;
      if (!e.ok) { setToast({ ...e.error, title: `Cannot delete ${label}: ${e.error.title}` }); return; }
      commit(r.doc);
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
    chatSelection.current = { faces: [], edges: [], bodies: [grow ? b.key : bodyKeyFor(next.nodes, next.nodes.length - 1)] };
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
      // (Only the intersection's volume: no mesh made or sent.)
      const r = await engine.volumes(probe);
      const v = r.ok ? r.volumes.find(b => b.key === bodyKeyFor(probe.nodes, probe.nodes.length - 1))?.volumeMM3 ?? 0 : 0;
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
  const replaceDoc = (next: StudioDoc) => { cancel(); setSelection(emptySel); setPick(null); setInstanceSel([]); setDirectSel([]); setMeasure(null); setEditNode(null); commit(next, false, true); };
  // (A document with mesh blobs is saved as the container, else as plain JSON: engine/container.ts. Saved, the
  // recovery copy and its blobs go.)
  const writeFile = (d: StudioDoc, name: string) => {
    try { const bytes = encodeStudioFile(d); downloadBytes(bytes, name, bytes[0] === 0x7b ? 'application/json' : 'application/octet-stream'); return true; }
    catch (e) { setToast({ title: 'Could not save', hint: e instanceof Error ? e.message : String(e), detail: '' }); return false; }
  };
  const save = () => { if (!writeFile(doc, `${fileName}.bcad`)) return; setDirty(false); clearRecovery(); void collectRecoveryBlobs(null); };
  /** A copy to share: without the design history, nor the proposals' prompts and plans (chat/proposals.ts). */
  const saveShared = () => { writeFile(stripHistory(doc), `${fileName}-shared.bcad`); };
  // A mesh file waiting for its unit, and opening it as a part in that unit.
  // (A sheet's bend table from a file (R12.4, D120): checked, then set on the sheet feature its body starts from.)
  const loadBendTable = async (b: BodyResult, file?: File) => {
    if (!file) return;
    let table: unknown;
    try { table = JSON.parse(await file.text()); } catch { setToast({ title: 'Not a bend table', hint: `${file.name} is not JSON.`, detail: '' }); return; }
    const problem = bendTableProblem(table);
    if (problem) { setToast({ title: 'Bend table refused', hint: problem, detail: '' }); return; }
    const i = rootOf(doc.nodes, refOf(b).node), n = doc.nodes[i];
    if (!n || (n.kind !== 'sheet-base' && n.kind !== 'sheet-contour')) { setToast({ title: 'No sheet feature', hint: 'This body does not start from a sheet plate or profile.', detail: '' }); return; }
    const rest = { ...n } as Record<string, unknown>; delete rest.kFactor;
    commit({ ...doc, nodes: doc.nodes.map((x, j) => j === i ? { ...rest, bendTable: table as BendTable } as ModelNode : x) });
  };
  // (A sheet-metal body's flat pattern shown: its body key; R12.2, D117.)
  const [flatView, setFlatView] = useState<string | null>(null);
  // (FR4a: the part's cut list, open or not.)
  const [cutListView, setCutListView] = useState(false);
  const [meshAsk, setMeshAsk] = useState<{ name: string; format: 'STL' | 'OBJ'; mesh: ReturnType<typeof readMeshFile>; unit: MeshUnit } | null>(null);
  const meshInUnit = useMemo(() => meshAsk && meshInMM(meshAsk.mesh, meshAsk.unit), [meshAsk]);
  /**
   * A mesh body's badges (M3, D47): repaired (its filled area; shows the fill faces and opens the repair again), an
   * open sheet (no volume, no Booleans), and where it crosses itself (marked in the viewport).
   */
  const meshBadges = (i: number, b: BodyResult, steps: readonly number[]) => {
    const at = [refOf(b).node, ...steps].find(k => evaluated.nodes[k]?.kind === 'mesh');
    const n = at === undefined ? undefined : evaluated.nodes[at];
    if (!n || n.kind !== 'mesh' || (!n.repair && !n.crossings)) return null;
    const r = n.repair?.report, fills = b.mesh.faces.flatMap((f, k) => /\.fill\d+\.region\d+/.test(f.name) ? [{ body: i, face: k }] : []);
    return <span className="ol-badges">
      {r && <button className="ol-badge" aria-label="Mesh repair" title={`Repaired: ${r.holesFilled} hole${r.holesFilled === 1 ? '' : 's'} filled (${Math.round(r.filledAreaMM2)} mm² guessed), ${r.flipped} turned, ${r.degenerateRemoved + r.duplicatesRemoved} degenerate, ${r.finsRemoved} fins, ${r.floatersRemoved} tiny pieces dropped. Click: show the filled faces and change the repair.`}
        onClick={() => { if (fills.length) setSelection({ faces: fills, edges: [], bodies: [] }); void editRepair(at!); }}>repaired{r.holesFilled ? ` · ${Math.round(r.filledAreaMM2)} mm² filled` : ''}</button>}
      {r && !r.closed && <span className="ol-badge warn" title="Not closed after repair: an open sheet — no volume, no Booleans">open sheet</span>}
      {n.crossings && <button className="ol-badge warn" aria-label="Mesh crossings" title={`It crosses itself in ${n.crossings.count} place${n.crossings.count > 1 ? 's' : ''}: Booleans refuse it (repair does not fix that). Click: mark where.`}
        onClick={() => setSelection({ faces: [], edges: [], bodies: [], vertices: n.crossings!.at.map(p => ({ body: i, at: p })) })}>crosses itself · {n.crossings.count}</button>}
    </span>;
  };
  // ---- Opening a mesh: checked in the worker, repaired as a recorded step when it needs it (M3, D47) ----------
  /** What the worker is doing that the user waits on (checking or repairing a mesh): shown with its stage, stoppable. */
  const [stage, setStage] = useState<string | null>(null);
  const [repairAsk, setRepairAsk] = useState<{ mode: 'import' | 'edit'; node?: number; name: string; format?: string; unit: string; positions: ArrayLike<number>; indices: ArrayLike<number>; diagnosis: MeshDiagnosis; steps: MeshRepairSteps; result: MeshRepairResult | null } | null>(null);
  // (PERF3 B13, O135: the mesh blobs no step reaches dropped at an idle point — two seconds after the last change, no
  // repair asked; a chat turn holds sweeps while it runs. The roots: the document, every undo and redo step. DEV: the
  // bytes each sweep freed, window.__studioBlobs.)
  useEffect(() => {
    if (repairAsk) return;
    const t = setTimeout(() => {
      const s = evictBlobs([doc, ...undo.map(u => u.doc), ...redo.map(r => r.doc), ...(evaluatedRef.current ? [evaluatedRef.current] : [])]);
      if (s && import.meta.env.DEV) (window as unknown as { __studioBlobs: unknown }).__studioBlobs = { ...blobStats, kept: s.kept, graced: s.graced.length };
    }, 2000);
    return () => clearTimeout(t);
  }, [doc, undo, redo, repairAsk]);
  const stopStage = () => { engine.restart(); setStage(null); setToast({ title: 'Stopped', hint: 'The mesh check or repair was stopped; nothing changed.', detail: '' }); };
  const openMesh = async () => {
    if (!meshAsk || !meshInUnit) return;
    const { name, format, unit } = meshAsk;
    setStage('checking the mesh');
    const d = await engine.diagnose(meshInUnit.positions, meshInUnit.indices);
    setStage(null);
    if ('error' in d) { if (d.error !== 'stopped') setToast({ title: 'Could not read this mesh', hint: d.error, detail: '' }); return; }
    setMeshAsk(null);
    // (Anything a step would change, or crossings to say: the gate; else straight in.)
    if (!d.closed || d.degenerate || d.duplicates || d.floaters || d.selfIntersections) { setRepairAsk({ mode: 'import', name, format, unit, positions: meshInUnit.positions, indices: meshInUnit.indices, diagnosis: d, steps: DEFAULT_REPAIR, result: null }); return; }
    await openMeshNode({ name, format, unit, positions: meshInUnit.positions, indices: meshInUnit.indices, diagnosis: d });
  };
  /** The mesh node made (its import's blobs, a repair's beside them) and opened as the part. */
  const openMeshNode = async (o: { name: string; format?: string; unit: string; positions: ArrayLike<number>; indices: ArrayLike<number>; diagnosis: MeshDiagnosis; repair?: { steps: MeshRepairSteps; result: MeshRepairResult } }) => {
    // (Its arrays as blobs, by their SHA-256: the document names them, M1.)
    const base = await meshNodeBlobs({ kind: 'mesh' as const, name: o.name, unit: o.unit, representation: 'facets' as const }, o.positions, o.indices);
    const repair = o.repair ? await repairRecord(o.repair.steps, o.repair.result) : undefined;
    const crossings = o.repair ? o.repair.result.report.selfIntersections : o.diagnosis.selfIntersections;
    const node = { ...base, ...(repair ? { repair } : {}), ...(crossings ? { crossings: { count: crossings, at: o.diagnosis.selfIntersectionAt.map(p => [...p] as [number, number, number]) } } : {}) };
    // Read before replacing the current part: a mesh that does not build keeps the part. Read piece by piece, so a
    // file of several closed pieces (a kit, separate eyes) opens as that many bodies (D42).
    const read = await engine.part(withNode(emptyDoc(), { ...node, pieces: 2 }), revision.current++, 'read');
    if (!read.ok) { setToast({ title: 'Could not open this mesh', hint: `${read.error.detail || read.error.hint}. Your part is unchanged.`, detail: read.error.detail }); return; }
    const pieces = read.bodies.length, next = withNode(emptyDoc(), { ...node, ...(pieces > 1 ? { pieces } : {}) });
    setRepairAsk(null); replaceDoc(next); setFileName(o.name); setDirty(true); setTimeout(() => viewport.current?.fit(), 300);
    const faces = read.bodies.reduce((n, b) => n + b.mesh.faces.length, 0), volume = read.bodies.reduce((v, b) => v + (b.volumeMM3 ?? 0), 0);
    const r = repair?.report, sheet = r && !r.closed;
    // (Pieces under 1% of the largest one's volume, kept: floaters, likely — the repair drops them when asked.)
    const largest = Math.max(...read.bodies.map(b => b.volumeMM3 ?? 0)), tiny = pieces > 1 ? read.bodies.filter(b => (b.volumeMM3 ?? 0) < 0.01 * largest).length : 0;
    setToast({ title: `${o.format ?? 'Mesh'} opened${repair ? ', repaired' : ''}`, hint: `${pieces > 1 ? `${pieces} pieces, each a body of its own (${faces.toLocaleString('en-US')} regions in all)` : `${sheet ? 'An open sheet' : 'A mesh solid'} of ${faces.toLocaleString('en-US')} region${faces === 1 ? '' : 's'}`} — ${(o.indices.length / 3).toLocaleString('en-US')} triangles read in ${MESH_UNITS.find(u => u.value === o.unit)?.label.toLowerCase() ?? o.unit}${sheet ? '' : `; ${Math.round(volume).toLocaleString('en-US')} mm³`}.${r?.holesFilled ? ` ${r.holesFilled} hole${r.holesFilled > 1 ? 's' : ''} filled (${Math.round(r.filledAreaMM2).toLocaleString('en-US')} mm² guessed: its badge shows where).` : ''}${sheet ? ' It is not closed: no volume, no Booleans.' : ''}${tiny ? ` ${tiny} of the pieces ${tiny === 1 ? 'is' : 'are'} tiny (under 1% of the largest): stray bits, likely — delete ${tiny === 1 ? 'it' : 'them'}, or open the mesh with its repair.` : ''}${crossings ? ` It crosses itself in ${crossings} place${crossings > 1 ? 's' : ''}: Booleans will refuse it.` : ''} Splits, sections, holes and Booleans with modelled bodies work at any size (up to ${FACET_EXPLODE_TRIANGLES.toLocaleString('en-US')} triangles near the tool; ${FACET_PREVIEW_TRIANGLES.toLocaleString('en-US')} in a preview); Booleans of two meshes up to ${FACET_EXPLODE_TRIANGLES.toLocaleString('en-US')} triangles; fillets, shells and drafts on mesh faces come later.`, detail: '' });
  };
  /** A repair's arrays as blobs, and the record the node keeps. */
  const repairRecord = async (steps: MeshRepairSteps, r: MeshRepairResult): Promise<MeshRepairRecord> => {
    const [positions, indices, fill] = await Promise.all([putBlob(positionsArray(r.positions)), putBlob(r.indices), putBlob(r.fill)]);
    return { steps, result: { positions, indices, fill }, report: r.report };
  };
  /** The checked repair (in the worker, its stages shown, stoppable). */
  const checkRepair = async () => {
    if (!repairAsk) return;
    setStage('weld');
    const r = await engine.repair(repairAsk.positions, repairAsk.indices, repairAsk.steps, st => setStage(st));
    setStage(null);
    if ('error' in r) { if (r.error !== 'stopped') setToast({ title: 'Could not repair this mesh', hint: r.error, detail: '' }); return; }
    setRepairAsk(a => a && { ...a, result: r });
  };
  const applyRepair = async () => {
    const a = repairAsk; if (!a?.result) return;
    if (a.mode === 'import') { await openMeshNode({ ...a, repair: { steps: a.steps, result: a.result } }); return; }
    const n = doc.nodes[a.node!]; if (n?.kind !== 'mesh') return;
    const repair = await repairRecord(a.steps, a.result), crossings = a.result.report.selfIntersections;
    const rest = { ...n }; delete rest.crossings;
    setRepairAsk(null);
    commit({ ...doc, nodes: doc.nodes.map((x, i) => i === a.node ? { ...rest, repair, ...(crossings ? { crossings: { count: crossings, at: a.diagnosis.selfIntersectionAt.map(p => [...p] as [number, number, number]) } } : {}) } : x) }, false);
  };
  /** A mesh node's repair opened again: its import checked anew, its steps as they were. */
  const editRepair = async (index: number) => {
    const n = doc.nodes[index]; if (n?.kind !== 'mesh') return;
    const positions = n.blob ? getBlob(n.blob.positions) : n.positions, indices = n.blob ? getBlob(n.blob.indices) : n.indices;
    if (!positions || !indices) return;
    setStage('checking the mesh');
    const d = await engine.diagnose(positions, indices);
    setStage(null);
    if ('error' in d) return;
    setRepairAsk({ mode: 'edit', node: index, name: n.name, unit: n.unit, positions, indices, diagnosis: d, steps: n.repair?.steps ?? DEFAULT_REPAIR, result: null });
  };
  const removeRepair = () => {
    const a = repairAsk; if (!a || a.mode !== 'edit') return;
    const n = doc.nodes[a.node!]; if (n?.kind !== 'mesh') return;
    const rest = { ...n }; delete rest.repair;
    setRepairAsk(null);
    commit({ ...doc, nodes: doc.nodes.map((x, i) => i === a.node ? rest : x) }, false);
  };
  const open = async (file: File) => {
    try {
      // A DWG is not read (O61): its routes named, the part unchanged.
      if (/\.dwg$/i.test(file.name)) { const e = dwgRefusal(new TextDecoder('latin1').decode(new Uint8Array(await file.slice(0, 6).arrayBuffer()))); setToast({ title: 'DWG files are not read', hint: e ? e.message.replace(/^\[[A-Z_]+\] /, '') : `This is not a DWG file the studio knows. ${DWG_ROUTES}`, detail: '' }); return; }
      // A STEP file starts a new part from its solids.
      if (/\.(step|stp)$/i.test(file.name)) {
        const name = file.name.replace(/\.(step|stp)$/i, ''), step = await file.text();
        // A file of meshes only (AP242 tessellated: scans, other systems' exports) is checked like an STL: closed and
        // clean it imports as it is (its faces' names kept), else through the repair gate as a mesh (R3.5, D48).
        setStage('reading the file');
        const meshes = await engine.stepMeshes(step);
        setStage(null);
        if (meshes && 'error' in meshes) { if (meshes.error !== 'stopped') setToast({ title: 'Could not open this file', hint: `${meshes.error[0].toUpperCase()}${meshes.error.slice(1)}. Your part is unchanged.`, detail: meshes.error }); return; }
        if (meshes) {
          // (Typed arrays, not number lists: posted to the worker by copying bytes, not element by element; PERF3 B13.)
          const k = stepLengthUnit(step).toMM, positions = new Float64Array(meshes.reduce((n, m) => n + m.positions.length, 0)), indices = new Uint32Array(meshes.reduce((n, m) => n + m.indices.length, 0));
          let pv = 0, pi = 0;
          for (const m of meshes) { const base = pv / 3; for (let i = 0; i < m.positions.length; i++) positions[pv++] = m.positions[i] * k; for (let i = 0; i < m.indices.length; i++) indices[pi++] = base + m.indices[i]; }
          setStage('checking the mesh');
          const d = await engine.diagnose(positions, indices);
          setStage(null);
          if ('error' in d) { if (d.error !== 'stopped') setToast({ title: 'Could not read this mesh', hint: d.error, detail: '' }); return; }
          if (!d.closed || d.degenerate || d.duplicates || d.selfIntersections) { setRepairAsk({ mode: 'import', name, format: 'STEP', unit: 'mm', positions, indices, diagnosis: d, steps: DEFAULT_REPAIR, result: null }); return; }
        }
        // Read it before replacing the current part: a file the kernel cannot read keeps the part. Read
        // solid by solid, so that a file holding several opens as that many bodies.
        const read = await engine.part(withNode(emptyDoc(), { kind: 'import', name, step, solids: 2 }), revision.current++, 'read');
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
      // An STL or OBJ file starts a new part from its closed mesh, once its unit is chosen (the files say none).
      if (/\.(stl|obj)$/i.test(file.name)) {
        const name = file.name.replace(/\.(stl|obj)$/i, '');
        try { setMeshAsk({ name, format: /\.obj$/i.test(file.name) ? 'OBJ' : 'STL', mesh: readMeshFile(file.name, new Uint8Array(await file.arrayBuffer())), unit: 'mm' }); }
        catch (e) { setToast({ title: 'Could not open this file', hint: `${e instanceof Error ? e.message : String(e)}. Your part is unchanged.`, detail: '' }); }
        return;
      }
      // An IGES file adds its curves and surfaces as direct geometry too, saying what came in.
      if (/\.(igs|iges)$/i.test(file.name)) {
        const r = (await loadDirect()).importIGESFile(doc.direct ?? emptyDirect(), await file.text(), file.name.replace(/\.(igs|iges)$/i, ''));
        commitDirect(r.direct, r.direct.objects.slice((doc.direct?.objects.length ?? 0)).map(o => o.id));
        setToast({ title: 'IGES opened', hint: `${r.curves} curve${r.curves === 1 ? '' : 's'} and ${r.surfaces} surface${r.surfaces === 1 ? '' : 's'} added as curves and surfaces (Direct), in mm.`, detail: '' });
        setTimeout(() => viewport.current?.fit(), 300);
        return;
      }
      // A CAD source adds its curves and surfaces to the part as direct geometry.
      if (/\.(barocad|cad)$/i.test(file.name)) {
        const next = (await loadDirect()).importSource(doc.direct ?? emptyDirect(), await file.text(), file.name.replace(/\.(barocad|cad)$/i, ''));
        commitDirect(next, next.objects.slice((doc.direct?.objects.length ?? 0)).map(o => o.id));
        setTimeout(() => viewport.current?.fit(), 300);
        return;
      }
      // Checked and, for an older file, brought up to date (said what was filled in); the file is left as it is.
      const read = await readStudioFile(new Uint8Array(await file.arrayBuffer()));
      if ('error' in read) { setToast({ title: 'Could not open this file', hint: `${read.error} Your part is unchanged.`, detail: '' }); return; }
      const parsed = read.doc;
      replaceDoc({ ...parsed, ...(parsed.render ? { render: readRender(parsed.render) } : {}), ...(parsed.drawing ? { drawing: readDrawing(parsed.drawing) } : {}) }); setFileName(file.name.replace(/\.(bcad|json)$/, '')); setDirty(read.notes.length > 0);
      if (read.notes.length) setToast({ title: 'Opened an older model', hint: `${read.notes.join('; ')}. Save to keep it in the current form (the file is unchanged until then).`, detail: '' });
      setTimeout(() => viewport.current?.fit(), 300);
      void verifyOpened(parsed);
    } catch (e) { setToast({ title: 'Could not open this file', hint: String(e instanceof Error ? e.message : e), detail: '' }); }
  };
  // The references read (each on its own, in its own coordinates) and the keep-outs' solids made, when they change.
  useEffect(() => {
    const set = readReferences(doc.references); let live = true;
    const read = (d: StudioDoc) => engine.part(d, revision.current++, 'read');
    void (async () => {
      const local = new Map<string, BodyResult[]>();
      for (const r of set.references) { try { local.set(r.id, await referenceLocal(r, read)); } catch { local.set(r.id, []); } }
      const solids: BodyResult[] = [];
      for (const k of set.keepouts) { const p = withKeepout(emptyDoc(), k), e = await read(p.doc); if (e?.ok) solids.push(...e.bodies.map(b => ({ ...b, key: k.id }))); }
      if (live) { setRefLocal(local); setKeepoutBodies(solids); }
    })();
    return () => { live = false; };
  }, [doc.references, engine]);
  // The keep-outs checked against the part as it stands.
  useEffect(() => {
    const set = readReferences(doc.references);
    if (!set.keepouts.length || !fresh || busy) { if (!set.keepouts.length) setKeepoutVerdicts(null); return; }
    let live = true;
    const t = setTimeout(() => { void checkKeepouts({ ...evaluated, references: doc.references }, bodies, d => engine.part(d, revision.current++, 'check')).then(v => { if (live) setKeepoutVerdicts(v); }).catch(() => { if (live) setKeepoutVerdicts(null); }); }, 350);
    return () => { live = false; clearTimeout(t); };
  }, [doc.references, bodies, evaluated, fresh, busy, engine]);
  // The requirements checked against the part as it stands (chat/spec.ts), whenever either changes.
  // (After evaluation settles: debounced, a stale run dropped, none while a command previews or a sketch is open.
  // A person's edit is never refused for breaking a requirement — a hard one that passed and now fails is said.)
  const [spec, setSpec] = useState<{ summary: { pass: number; fail: number; unknown: number }; outcomes: Record<string, Outcome>; of: readonly unknown[] } | null>(null);
  const [specRunning, setSpecRunning] = useState(false), [failingOnly, setFailingOnly] = useState(false);
  const specPassed = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!doc.requirements?.length) { setSpec(null); specPassed.current = new Set(); return; }
    if (busy || !fresh || active || sketch || previewBodies) return;
    let live = true;
    const t = setTimeout(() => {
      setSpecRunning(true);
      // (The evaluated model follows model edits only: the requirements are the document's own.)
      void checkSpec({ ...evaluated, requirements: doc.requirements, ...(doc.references ? { references: doc.references } : {}) }, bodies, d => engine.part(d, revision.current++, 'check')).then(r => {
        if (!live) return;
        const broke = (doc.requirements ?? []).filter(q => q.hard && specPassed.current.has(q.id) && r.outcomes.get(q.id)?.status === 'fail').map(q => q.id);
        specPassed.current = new Set([...r.outcomes].filter(([, o]) => o.status === 'pass').map(([id]) => id));
        setSpec({ summary: r.summary, outcomes: Object.fromEntries(r.outcomes), of: evaluated.nodes });
        if (broke.length) setToast({ title: `${broke.join(', ')} now fail${broke.length === 1 ? 's' : ''}`, hint: `A hard requirement that held no longer does: ${broke.map(id => { const o = r.outcomes.get(id); return `${id} measures ${String(o?.measured)}`; }).join('; ')}. Your change is kept; undo it or change the part.`, detail: '' });
      }).finally(() => { if (live) setSpecRunning(false); });
    }, 350);
    return () => { live = false; clearTimeout(t); };
  }, [doc.requirements, doc.references, bodies, evaluated, fresh, busy, active, sketch, previewBodies]);
  // Proposals (A4.2): one shown as a ghost — the part it would leave, its changed bodies tinted — with a
  // before/after toggle and the volume it adds or takes off; accepted (its ops replayed) or rejected (kept).
  // (`full`: the part the whole proposal leaves; `parts`: its features, `leaveOut` those unticked, A4.3.)
  // (`shown`: the part as previewed — the whole proposal's, or without what is left out; G12 diffs it with the part.)
  const [ghost, setGhost] = useState<{ id: string; bodies: BodyResult[]; after: boolean; full: StudioDoc; shown: StudioDoc; parts: ProposalPart[]; leaveOut: string[] } | null>(null);
  /** G12: what the shown proposal adds and takes away (worked out in the engine worker), for the viewport's overlay. */
  const [proposalOverlay, setProposalOverlay] = useState<ProposalOverlay | null>(null);
  const [proposalBusy, setProposalBusy] = useState(false), [decidedShown, setDecidedShown] = useState(false), [historyOpen, setHistoryOpen] = useState(false);
  const partEval = (d: StudioDoc) => engine.part(d, revision.current++, 'agent');
  useEffect(() => { setGhost(g => { if (g) setPreviewBodies(null); return null; }); }, [doc.nodes, doc.parameters]);
  // (Only wanted to show an open proposal stale.)
  const hashNow = useMemo(() => doc.proposals?.some(p => p.status === 'open') ? modelHash(doc) : '', [doc]);
  const showProposal = async (p: Proposal, from: StudioDoc = doc) => {
    if (ghost?.id === p.id && from === doc) { setGhost(null); setPreviewBodies(null); return; }
    if (active || sketch || marker !== null) return;
    setProposalBusy(true);
    const tools = await import('@barocss/cad-model/chat/tools'), r = await tools.previewProposal({ doc: from, bodies }, p.id, partEval);
    setProposalBusy(false);
    if ('error' in r) { setToast({ title: `${p.id} does not apply to the part as it is`, hint: r.error, detail: '' }); return; }
    setGhost({ id: p.id, bodies: r.bodies, after: true, full: r.doc, shown: r.doc, parts: tools.proposalParts(from, r.doc), leaveOut: [] }); setPreviewBodies(r.bodies);
  };
  /** A stale proposal made again on the part as it is, then shown (D41): only the rebased one can be accepted. */
  const rebaseIt = async (p: Proposal) => {
    if (active || sketch || marker !== null) return;
    setProposalBusy(true);
    const r = await (await import('@barocss/cad-model/chat/tools')).rebaseProposal({ doc, bodies }, p.id, partEval);
    setProposalBusy(false);
    if ('error' in r) { setToast({ title: `${p.id} could not be rebased`, hint: r.error, detail: 'Nothing changed; the proposal stays open.' }); return; }
    commit(r.state.doc, false);
    await showProposal(r.state.doc.proposals!.find(q => q.id === p.id)!, r.state.doc);
  };
  /** A feature of the shown proposal ticked or unticked: the ghost rebuilt without what is left out. */
  const tickPart = async (id: string, on: boolean) => {
    if (!ghost) return;
    const tools = await import('@barocss/cad-model/chat/tools'), leaveOut = tools.toggledLeaveOut(ghost.parts, ghost.leaveOut, id, on);
    const partial = tools.partialDoc(doc, ghost.full, ghost.parts, leaveOut);
    if ('error' in partial) { setToast({ title: 'Cannot leave that out', hint: partial.error, detail: '' }); return; }
    setProposalBusy(true);
    const r = await partEval(partial.doc);
    setProposalBusy(false);
    if (!r.ok) { setToast({ title: `Without ${leaveOut.join(', ')} the part does not build`, hint: `${r.error.title}. ${r.error.hint}`, detail: '' }); return; }
    setGhost(g => g && { ...g, leaveOut, bodies: r.bodies, shown: partial.doc, after: true }); setPreviewBodies(r.bodies);
  };
  // (G12: the diff of the part as it is and the proposal as shown, again when what is shown changes; none without one.)
  useEffect(() => {
    if (!ghost) { setProposalOverlay(null); return; }
    let live = true;
    void engine.proposalDiff(doc, ghost.shown, revision.current++, { revision: modelHash(doc), proposal: `${ghost.id}|${ghost.leaveOut.join(',')}` }).then(r => { if (live) setProposalOverlay('error' in r ? null : r); });
    return () => { live = false; };
  }, [ghost?.id, ghost?.shown]);
  const flipGhost = () => setGhost(g => { if (!g) return g; setPreviewBodies(g.after ? null : g.bodies); return { ...g, after: !g.after }; });
  const acceptIt = async (p: Proposal) => {
    if (active || sketch) return;
    if (marker !== null) { setToast({ title: 'Roll forward to accept', hint: 'A proposal applies to the whole part: drag the rollback bar to the end first.', detail: '' }); return; }
    setProposalBusy(true);
    const leaveOut = ghost?.id === p.id ? ghost.leaveOut : [];
    const r = await (await import('@barocss/cad-model/chat/tools')).acceptProposal({ doc, bodies }, p.id, partEval, { leaveOut });
    setProposalBusy(false);
    if ('error' in r) { setToast({ title: `${p.id} could not be applied`, hint: r.error, detail: 'Nothing changed; the proposal stays open.' }); return; }
    setGhost(null); setPreviewBodies(null); commit(r.state.doc, false);
  };
  const rejectIt = (p: Proposal) => { const next = rejectProposal(doc, p.id); if ('error' in next) return; if (ghost?.id === p.id) { setGhost(null); setPreviewBodies(null); } commit(next, false); };
  const volumeOf = (list: readonly BodyResult[]) => list.reduce((s, b) => s + (b.volumeMM3 ?? 0), 0);
  /** An assumed (or ambiguous) requirement's value set by the user, and confirmed: stated from now on, with who and when. */
  const setRequirement = (id: string, value: number) => {
    if (!Number.isFinite(value)) return;
    commit({ ...doc, requirements: doc.requirements!.map(q => q.id !== id ? q : { ...q, basis: 'stated' as const, confirmed: { by: 'user', at: new Date().toISOString() }, check: q.check.op === 'between' ? q.check : { ...q.check, value } }) }, false);
  };
  /** The user's answers to the agent's questions, or all its assumptions accepted (A6.2): written as the user's, and
   * sent to the chat as their message. */
  const answerQuestions = (answers: Record<string, string | number | null>) => {
    const r = answerBatch(doc, answers, new Date().toISOString());
    if ('error' in r) { setToast({ title: 'Answer not taken', hint: r.error, detail: '' }); return; }
    commit(applyBrief(r.doc, readBrief(r.doc.brief)), false); setChat(true); setChatOutbox({ id: Date.now(), text: r.message });
  };
  const acceptAll = () => {
    const r = acceptAssumptions(doc, new Date().toISOString()); if (!r.count) return;
    commit(applyBrief(r.doc, readBrief(r.doc.brief)), false); setChat(true); setChatOutbox({ id: Date.now(), text: r.message });
  };
  /** The References card's actions (A6.3): through the same tool code the agent uses; a reference itself is the user's. */
  const refTool = async (name: string, args: Record<string, unknown>) => {
    const out = await runReferenceTool(doc, bodies, name, args, d => engine.part(d, revision.current++, 'read'));
    if ('error' in out) { setToast({ title: 'Reference not changed', hint: out.error.replace(/^\[[A-Z_]+\] /, ''), detail: out.error }); return; }
    if (out.changed) commit(out.doc, false);
  };
  /** A DXF drawing added to the part as a sketch draft (A6.4): its dimensions the user's to confirm. */
  const addDrawingFile = async (file: File) => {
    const out = runDraftTool(doc, 'import_drawing', { dxf: await file.text(), name: file.name.replace(/\.dxf$/i, '') });
    if ('error' in out) { setToast({ title: 'Could not read this drawing', hint: out.error.replace(/^\[[A-Z_]+\] /, ''), detail: out.error }); return; }
    commit(out.doc);
    const c = out.content as { draft: string | null; dims?: { key: string }[]; unit: string; underlay?: Record<string, number>; left_out?: Record<string, number> };
    // (O68: what came in as the underlay, to trace over — never geometry.)
    const list = (r: Record<string, number>) => Object.entries(r).map(([t, n]) => `${n} ${t}`).join(', '), under = c.underlay ? ` Shown as an underlay: ${list(c.underlay)}.` : '';
    setToast(c.draft ? { title: 'Drawing added as a draft', hint: `A sketch in ${c.unit}; ${c.dims!.length} dimensions to confirm in Drafts.${under}${c.left_out ? ` Left out: ${list(c.left_out)}.` : ''}`, detail: '' }
      : { title: 'Drawing added as an underlay', hint: `No closed profile to make a sketch of: the drawing is shown to trace over, in ${c.unit}.${under}${c.left_out ? ` Left out: ${list(c.left_out)}.` : ''}`, detail: '' });
  };
  const addReferenceFile = async (file: File) => {
    const name = file.name.replace(/\.[^.]+$/, '');
    if (/\.(step|stp)$/i.test(file.name)) return refTool('add_reference', { name, step: await file.text() });
    const m = meshInMM(readMeshFile(file.name, new Uint8Array(await file.arrayBuffer())), 'mm');
    return refTool('add_reference', { name, mesh: { positions: m.positions, indices: m.indices } });
  };
  const placeRef = (id: string, at: Placement) => { const set = readReferences(doc.references); commit({ ...doc, references: { ...set, references: set.references.map(r => (r.id === id ? { ...r, at } : r)) } }, false); };
  const removeRef = (id: string) => {
    if (!/^ref\d+$/.test(id)) { void refTool('delete_reference_item', { id }); return; }
    // (The user's: the reference, with the datums taken from it and the keep-outs around it.)
    const set = readReferences(doc.references);
    commit({ ...doc, references: { ...set, references: set.references.filter(r => r.id !== id), datums: set.datums.filter(d => d.of?.reference !== id), keepouts: set.keepouts.filter(k => k.around?.reference !== id) } }, false);
  };
  /** A brief field confirmed by the user as it is (A6.1): stated from now on; a stated process becomes the part's. */
  const confirmBrief = (key: BriefKey) => { const b = readBrief(doc.brief); if (!b) return; const next = confirmField(b, key, new Date().toISOString()); if ('error' in next) return; commit(applyBrief(doc, next), false); };
  // The references marked matched again (until confirmed), and the user's say on them and on the problems.
  const refMarks = useMemo(() => markedReferences(doc), [doc]);
  const settleRef = async (index: number, to?: string) => {
    const next = await confirmReference(doc, index, bodies, d => engine.part(d, revision.current++, 'refs'), to);
    setRefProblems(ps => ps.filter(p => p.index !== index)); setRefChoices(null);
    pushUndo(); setDoc(next); setDirty(true);
  };
  const showRefChoices = async (index: number) => setRefChoices({ index, names: await candidatesFor(doc, index, bodies, d => engine.part(d, revision.current++, 'refs')) });
  // The opened file's stored references checked against their signatures (no prior document: a newer kernel may
  // number faces otherwise, engine/references.ts); what moved is substituted, marked, and said.
  const verifyOpened = async (opened: StudioDoc) => {
    const r = await engine.part(opened, revision.current++, 'refs'); if (!r?.ok) return;
    const v = await verifyReferences(opened, r.bodies, d => engine.part(d, revision.current++, 'refs'));
    setRefProblems(v.problems);
    if (!v.changes.length && !v.problems.length) return;
    setDoc(cur => cur.nodes === opened.nodes || JSON.stringify(cur.nodes) === JSON.stringify(opened.nodes) ? { ...v.doc, render: cur.render, ...(v.doc.drawing ? { drawing: readDrawing(v.doc.drawing) } : {}) } : cur); setDirty(true);

  };
  /** A sketch's profile as DXF, 1:1 in its plane (R11b, O1). */
  const exportSketchDxf = (index: number) => {
    const n = doc.nodes[index];
    if (n?.kind !== 'sketch') return;
    try { downloadBytes(sketchDxf(n, doc.parameters).bytes, `${fileName}-sketch-${index + 1}.dxf`, 'image/vnd.dxf'); }
    catch (e) { setToast({ title: 'Could not write the DXF', hint: e instanceof Error ? e.message : String(e), detail: '' }); }
  };
  /** Asked how mesh bodies go out when the part has any (R3.5, D48): its answer kept in this browser. */
  const [stepAsk, setStepAsk] = useState(false);
  const exportStepFile = async (meshes?: 'auto' | 'tessellated' | 'planar') => {
    // (An infill body is left out of STEP, O60: it asks nothing.)
    if (!meshes && bodies.some(b => b.family === 'faceted' && b.role !== 'infill')) { setStepAsk(true); return; }
    setStepAsk(false);
    if (meshes) { try { localStorage.setItem('studio.stepMeshes', meshes); } catch { /* private mode */ } }
    // (The evaluated model, with the instances placed beside it now.)
    const r = await engine.step({ ...evaluated, instances: doc.instances }, fileName, meshes);
    if ('text' in r) { downloadBytes(new TextEncoder().encode(r.text), `${fileName}.step`, 'model/step'); const w = draftWarning(doc); if (w) setToast({ title: 'STEP written as a draft', hint: [w, ...(r.omitted ?? [])].join(' '), detail: '' }); else if (r.omitted) setToast({ title: 'STEP written', hint: r.omitted.join(' '), detail: '' }); }
    else setToast({ title: 'Could not write STEP', hint: 'Fix the model’s errors first, then export again.', detail: r.error });
  };
  const exportStl = async () => {
    if (!fresh) { setToast({ title: 'Not written yet', hint: busy ? 'The part is still evaluating: export once it is up to date.' : 'The part did not evaluate: fix it first.', detail: '' }); return; }
    const fallback: string[] = [];
    for (const body of bodies) {
      const kernel = await engine.stl(evaluated, body.key);
      if (!kernel) fallback.push(bodyName(doc, body));
      downloadBytes(kernel ?? meshToStl(body.mesh, body.key), `${fileName}-${body.key}.stl`, 'model/stl');
    }
    // (STL is facets only: no units, colours or exact curves; say when the display mesh had to stand in.)
    setToast({ title: `STL written: ${bodies.length} file${bodies.length === 1 ? '' : 's'}`, hint: `${draftWarning(doc) ? `${draftWarning(doc)} ` : ''}Triangles in millimetres, one file per body; no colours, names or exact curves.${fallback.length ? ` ${fallback.join(', ')} ${fallback.length === 1 ? 'was' : 'were'} written from the on-screen mesh (the kernel’s tessellation refused ${fallback.length === 1 ? 'it' : 'them'}).` : ''}`, detail: '' });
  };

  /** The quote package (IM6, O82): the part as STEP, its moulding report and the request, one zip; what is open said. */
  const exportQuote = async () => {
    if (!fresh) { setToast({ title: 'Not written yet', hint: busy ? 'The part is still evaluating: export once it is up to date.' : 'The part did not evaluate: fix it first.', detail: '' }); return; }
    const q = await quotePackage(doc, bodies, async d => evaluateDoc(d, 0), { name: fileName });
    if ('error' in q) { setToast({ title: 'No quote package', hint: q.error, detail: '' }); return; }
    downloadBytes(q.zip, `${fileName}-quote.zip`, 'application/zip');
    setToast({ title: q.manifest.complete ? 'Quote package written' : `Quote package written: ${q.manifest.open.length} open`, hint: q.manifest.complete ? 'STEP, the moulding report and the request — no price: the moulder quotes it.' : q.manifest.open.join(' · '), detail: '' });
  };

  /** 3MF (AM5, D76): every shown body and instance, its material and colours, turned the way it prints when chosen. */
  const exportThreeMf = async () => {
    if (!fresh) { setToast({ title: 'Not written yet', hint: busy ? 'The part is still evaluating: export once it is up to date.' : 'The part did not evaluate: fix it first.', detail: '' }); return; }
    const parts = [{ doc, bodies }, ...(doc.instances ?? []).filter(i => !i.hidden && instanceBodies.has(i.id)).map(i => ({ doc: i.doc, bodies: instanceBodies.get(i.id)!.bodies, name: i.name }))];
    const model = threeMfModelOf(doc, parts, fileName);
    const r = typeof model === 'string' ? { error: model } : await write3mf(model);
    if ('error' in r) { setToast({ title: 'Could not write 3MF', hint: r.error, detail: '' }); return; }
    downloadBytes(r.bytes, `${fileName}.3mf`, 'model/3mf');
    const s = r.stats, open = s.openEdges + s.repeatedEdges;
    setToast({ title: `3MF written: ${s.objects} bod${s.objects === 1 ? 'y' : 'ies'}, ${s.triangles.toLocaleString()} triangles`, hint: `${draftWarning(doc) ? `${draftWarning(doc)} ` : ''}${doc.print ? 'Turned the way it prints and set on the bed. ' : 'As modelled (choose a print direction to have it turned for printing). '}The on-screen mesh, in millimetres, with materials and colours.${open ? ` ${open} edges are not closed: the slicer may repair it.` : ''}`, detail: '' });
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
      if (cageEd.onKey(e)) return;
      if (skel.onKey(e)) return;
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
        chatSelection.current = { faces: [], edges: [], bodies: [bodyKeyFor(r.doc.nodes, r.top)] }; commit(r.doc); return;
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
        const t = (TOOLS.find(x => x.key.toLowerCase() === e.key.toLowerCase()) ?? TOOLS.find(x => x.tool === 'polygon' && e.key.toLowerCase() === 'p'))?.tool;
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
  /** The viewport selection by name, for the chat's context chips (A4.3). */
  const chatContext = useMemo(() => [
    ...selection.faces.flatMap(f => { const n = bodies[f.body]?.mesh.faces[f.face]?.name.split('+')[0]; return n ? [{ kind: 'face' as const, name: n }] : []; }),
    ...selection.edges.flatMap(e => { const n = bodies[e.body]?.mesh.edges[e.edge]?.names[0]; return n ? [{ kind: 'edge' as const, name: n }] : []; }),
    ...selection.bodies.flatMap(b => bodies[b] ? [{ kind: 'body' as const, name: bodies[b].key }] : []),
  ].slice(0, 12).filter(() => fresh), [selection, bodies, fresh]);
  const shownBodies = bodyDrag ? bodies : previewBodies ?? (section && sectionBodies && !sketch ? sectionBodies : bodies);
  // Bodies' own colours and hidden ones (StudioDoc.bodies), by index of what is shown.
  // (A command's preview: the bodies it adds — first made by one of its new features, not built on a body
  // the part has — tinted, so what is new reads at a glance.)
  const previewNodes = useMemo(() => { if (!active?.cmd.build || !previewBodies) return null; try { return active.cmd.build(active.ctx, active.values).nodes; } catch { return null; } }, [active, previewBodies]);
  const bodyColors = useMemo(() => {
    // (A proposal's ghost: the bodies it adds or changes — not tinted while the engine draws its two-colour overlay, G12.)
    const overlaid = !!ghost && proposalOverlay?.method === 'boolean';
    const had = ghost ? new Set(bodies.map(b => `${b.key}:${Math.round(b.volumeMM3 ?? 0)}`)) : null;
    const fresh = (b: BodyResult) => { if (had) return !had.has(`${b.key}:${Math.round(b.volumeMM3 ?? 0)}`); const at = previewNodes && bodyNodeOf(previewNodes, b.key); return !!previewNodes && !!at && rootOf(previewNodes, at.node) >= evaluated.nodes.length; };
    return new Map(shownBodies.flatMap((b, i) => { const c = lookOf(doc, b).color ?? (shownBodies === previewBodies && fresh(b) && !overlaid ? PREVIEW_TINT : undefined); return c ? [[i, rgbOf(c)] as [number, [number, number, number]]] : []; }));
  }, [shownBodies, doc, previewBodies, previewNodes, evaluated.nodes.length, ghost, bodies, proposalOverlay]);
  const hiddenBodies = useMemo(() => new Set(shownBodies.flatMap((b, i) => lookOf(doc, b).hidden ? [i] : [])), [shownBodies, doc]);
  // Faces coloured on their own, by body index and face index (their names kept with the body's look).
  // (G12: a shown proposal's faces tinted — where the Boolean refused (WebGL2 draws the overlay too, G16) — those it adds or changes
  // green on the after view, those it removes or changes red on the before view.)
  const proposalTint = useMemo(() => {
    const o = proposalOverlay; if (!o || !ghost || o.method === 'boolean') return null;
    const on = new Set(o.changedFaces.filter(f => ghost.after ? f.kind !== 'removed' : f.kind !== 'added').map(f => f.name));
    return { on, color: rgbOf(ghost.after ? PROPOSAL_ADDED : PROPOSAL_REMOVED) };
  }, [proposalOverlay, ghost]);
  const faceColors = useMemo(() => new Map(shownBodies.flatMap((b, i) => {
    const own = lookOf(doc, b).faces; if (!own && !proposalTint) return [];
    const m = new Map(b.mesh.faces.flatMap(f => { const c = proposalTint?.on.has(f.name) ? proposalTint.color : own?.[f.name] ? rgbOf(own[f.name]) : null; return c ? [[f.index, c] as [number, [number, number, number]]] : []; }));
    return m.size ? [[i, m] as [number, Map<number, [number, number, number]>]] : [];
  })), [shownBodies, doc, proposalTint]);
  // (While placing, the pointer looks through the shape being placed: the preview's new bodies.)
  const placeSkip = useMemo(() => { const have = new Set(bodies.map(b => b.key)); return new Set((previewBodies ?? []).filter(b => !have.has(b.key)).map(b => b.key)); }, [bodies, previewBodies]);
  // Mate faces show while a mate is being added, or while one is selected in the shown mates list.
  const mateFaces = !!assembly.draft || (!!assembly.selected && instanceSel.length === 1);
  const sectioned = !!(section && sectionBodies && !sketch && !previewBodies);
  // (G2: the viewer's clip plane while the section is open on WebGPU — on the bodies until their exact section is shown,
  // on the placed parts always; none in a sketch, where the section is not shown.)
  const scalarMaps = useMemo(() => (mapKind === 'thickness' || mapKind === 'draft' || mapKind === 'access') && !rendering && !sketch && !previewBodies ? mapsOf(mapKind, doc, shownBodies) : null, [mapKind, rendering, sketch, previewBodies, shownBodies, doc]);
  // (With the draft map, each body's isoclines n·d = 0 on its straddling faces, from the exact surface.)
  const isoclines = useMemo(() => mapKind === 'draft' && scalarMaps && doc.mould?.pull ? shownBodies.flatMap(b => isoclinePolylines(doc, b, doc.mould!.pull!)) : null, [mapKind, scalarMaps, doc, shownBodies]);
  // (The mould's view: asked again when the part, its pull or its sides change; none outside its two maps.)
  const mouldWanted = (mapKind === 'parting' || mapKind === 'halves') && !rendering && !sketch && !previewBodies && !!doc.mould?.pull;
  useEffect(() => {
    if (!mouldWanted) { setMouldResult(null); return; }
    let live = true; setMouldResult('working');
    void engine.mould(doc, revision.current++, mapKind === 'halves').then(r => { if (live) setMouldResult(r); });
    return () => { live = false; };
  }, [mouldWanted, mapKind, evaluated, doc.mould, engine]);
  const mouldShown = useMemo(() => mouldResult && mouldResult !== 'working' && !('error' in mouldResult)
    ? { pull: mouldResult.pull, loops: mouldResult.loops, plus: mapKind === 'halves' ? mouldResult.plus : [], minus: mapKind === 'halves' ? mouldResult.minus : [], spread: mouldSpread } : null, [mouldResult, mapKind, mouldSpread]);
  halvesShownRef.current = !!mouldShown && (mouldShown.plus.length + mouldShown.minus.length) > 0;
  const mapLegend = scalarMaps?.[0] && viewport.current?.backend === 'webgpu' ? scalarMaps[0] : null;
  // The part's and its placed parts' box: the section's handles and planes in it (G19), its hatch's spacing (G19.3).
  const sectionBox = useMemo(() => {
    const all = [...bodies, ...instancesPlaced.flatMap(i => i.bodies)];
    if (!all.length) return { min: [0, 0, 0] as Vec3, max: [0, 0, 0] as Vec3 };
    return { min: [0, 1, 2].map(i => Math.min(...all.map(b => b.mesh.bounds.min[i]))) as Vec3, max: [0, 1, 2].map(i => Math.max(...all.map(b => b.mesh.bounds.max[i]))) as Vec3 };
  }, [bodies, instancesPlaced]);
  // The hatch on the cut (G19.3; on by default): on the GPU in the caps' shader while the planes move; as lines on
  // WebGL2's clipped caps and on the exact section's cut faces (either renderer).
  const [sectionHatchOn, setSectionHatchOn] = useState(true);
  const hatchStep = useMemo(() => hatchSpacing(sectionBox), [sectionBox]);
  const sectionClip = useMemo(() => section && !sketch && gpuSection ? { planes: sectionPlanes(section), bodies: shownBodies === sectionBodies && !sectionExactShown, hatch: sectionHatchOn ? hatchStep : null } : null, [section, sketch, gpuSection, shownBodies, sectionBodies, sectionExactShown, sectionHatchOn, hatchStep]);
  const sectionHatchLines = useMemo(() => section && !sketch && sectionHatchOn && shownBodies === sectionBodies && (!gpuSection || sectionExactShown) ? sectionHatch(shownBodies, sectionPlanes(section), hatchStep) : null,
    [section, sketch, sectionHatchOn, shownBodies, sectionBodies, gpuSection, sectionExactShown, hatchStep]);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const w = window as unknown as { __studioSection: () => unknown; __studioSectionDebug: (d: { hold: boolean; cpu: boolean }) => void };
    // (G19: the mode and planes, and the exact section's kept volume once it is shown.)
    w.__studioSection = () => ({ gpu: gpuSection, exact: sectionExactShown, clip: sectionClip, hatch: sectionHatchOn ? { spacing: hatchStep, lines: sectionHatchLines?.map(h => ({ body: h.body, segments: h.segments.length / 6 })) ?? null } : null, bodies: shownBodies.length, mode: section?.mode ?? null, planes: section?.planes ?? null, volume: sectionExactShown ? sectionExact!.bodies.reduce((v, b) => v + meshVolume(b.mesh), 0) : null });
    w.__studioSectionDebug = setSectionDebug;
    // (The axis form as before, or a section of planes, G19.)
    (window as unknown as { __studioSetSection: (s: Section | AxisSection | null) => void }).__studioSetSection = s => setSection(s ? asSection(s) : null);
    (window as unknown as { __studioOverlayLines: () => Record<string, number> }).__studioOverlayLines = () => viewport.current?.overlayLines() ?? {};
    (window as unknown as { __studioOverlayTexts: () => Record<string, string[]> }).__studioOverlayTexts = () => viewport.current?.overlayTexts() ?? {};
    // (G12: the shown proposal's diff, as the overlay has it.)
    (window as unknown as { __studioProposalOverlay: () => unknown }).__studioProposalOverlay = () => proposalOverlay && { added: proposalOverlay.added?.volumeMM3 ?? null, removed: proposalOverlay.removed?.volumeMM3 ?? null, method: proposalOverlay.method, faces: proposalOverlay.changedFaces.length, tinted: !!proposalTint };
    // (n points spread through a box, coloured by height; 0: none.)
    (window as unknown as { __studioSetCloud: (n: number, min: Vec3, max: Vec3) => void }).__studioSetCloud = (n, min, max) => setBenchCloud(n > 0 ? Array.from({ length: n }, (_, i) => {
      const u = (i * 0.61803398875) % 1, v = (i * 0.7548776662) % 1, w = (i * 0.5698402910) % 1;
      return { at: [min[0] + u * (max[0] - min[0]), min[1] + v * (max[1] - min[1]), min[2] + w * (max[2] - min[2])] as Vec3, t: w };
    }) : null);
  });
  const sectionFrom = nextSerial(evaluated);
  const shownSelection = sectioned ? { faces: shownBodies.flatMap((b, bi) => b.mesh.faces.filter(f => cutAfter(f.name, sectionFrom)).map(f => ({ body: bi, face: f.index }))), edges: [], bodies: [] }
    : previewBodies || sketch ? emptySel : mateFaces ? { faces: assembly.highlight.faces, edges: [], bodies: [] } : measure ? { faces: measure.flatMap(m => m.face !== undefined ? [{ body: m.body, face: m.face }] : []), edges: measure.flatMap(m => m.edge !== undefined ? [{ body: m.body, edge: m.edge }] : []), bodies: [] } : selection;
  const measured = measure?.length === 2 && bodies[measure[0].body] && bodies[measure[1].body] ? measureBetween(bodies[measure[0].body].mesh, measure[0], bodies[measure[1].body].mesh, measure[1]) : null;
  const density = MATERIALS.find(m => m.id === material) ?? MATERIALS[0];
  // (The locked references and the keep-outs, A6.3: drawn ghosted after the part's bodies, never picked.)
  const refShown = useMemo(() => { const set = readReferences(doc.references); return [...set.references.flatMap(r => placeReference(refLocal.get(r.id) ?? [], r.at)), ...keepoutBodies]; }, [doc.references, refLocal, keepoutBodies]);
  const viewBodies = useMemo(() => (refShown.length ? [...shownBodies, ...refShown] : shownBodies), [shownBodies, refShown]);
  const viewBodiesRef = useRef(viewBodies); viewBodiesRef.current = viewBodies;
  const sketchGhost = useMemo(() => new Set([...(sketch ? shownBodies.map((_, i) => i) : []), ...refShown.map((_, i) => shownBodies.length + i)]), [sketch, shownBodies, refShown]);
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
  const sectionBoxRef = useRef(sectionBox); sectionBoxRef.current = sectionBox;
  const sectionDrag: FeatureHandle[] = section && !active && !sketch && bodies.length ? sectionHandles(section, sectionBox, setSection) : [];
  const dragTransforms = useMemo(() => cmdBody !== undefined && bodyDrag ? new Map([[cmdBody, bodyDrag.matrix]]) : null, [cmdBody, bodyDrag]);

  // The selected part instance's gizmo: moves along and turns about world axes through its box's centre
  // (only what its mates leave free). It follows at once on screen; let go, it is placed (mates re-solve)
  // and shown as dragged until it is evaluated where it lands.
  const [instDrag, setInstDrag] = useState<{ id: string; drag: InstanceDrag; settling: boolean; key: string } | null>(null);
  const selectedInst = instanceSel.length === 1 ? doc.instances?.find(i => i.id === instanceSel[0]) : undefined;
  const instGizmo: TransformGizmo | null = (() => {
    if (!selectedInst || active || sketch || rendering || drawing || measure || assembly.draft || explode) return null;
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

  // Cosmetic threads (tapped holes, bolts, nuts): rings on the part's bodies and the placed parts'
  // (not on a preview, a section or a render).
  const threads = useMemo(() => {
    if (rendering || section || previewBodies) return new Float32Array();
    const out: number[] = [], own = threadsOf(evaluated.nodes);
    for (const b of bodies) out.push(...threadLines(own, b.mesh));
    return new Float32Array(out);
  }, [bodies, evaluated.nodes, rendering, section, previewBodies]);
  // (The placed parts' rings go with their meshes, G1: posed and exploded by the same matrix.)
  const instancesDrawn = useMemo(() => {
    if (rendering || section || previewBodies) return instancesShown;
    return instancesShown.map(it => {
      const inst = doc.instances?.find(i => i.id === it.id), t = inst ? threadsOf(flattenAssembly(inst.doc).nodes) : null, out: number[] = [];
      if (t) for (const b of it.bodies) out.push(...threadLines(t, b.mesh));
      return out.length ? { ...it, threads: new Float32Array(out) } : it;
    });
  }, [instancesShown, doc.instances, rendering, section, previewBodies]);

  // A hole's whole region, see-through, while it is placed or edited: where it runs off the part's edge
  // only a notch shows of it otherwise.
  const regions = useMemo((): ToolRegion[] => {
    if (rendering || drawing || sketch) return [];
    if (active?.cmd.id === 'hole' && active.cmd.build && active.ctx.selection.faces[0]) {
      try {
        const next = active.cmd.build(active.ctx, active.values), b = active.ctx.bodies[active.ctx.selection.faces[0].body];
        return b ? holeRegions(next.nodes, addedHoles(next.nodes, active.ctx.doc.nodes.length), b.mesh.bounds) : [];
      } catch { return []; }
    }
    if (active || editNode === null || doc.nodes[editNode]?.kind !== 'hole') return [];
    const group = holeGroup(doc.nodes, editNode), cut = new RegExp(`\\bn(${group.join('|')})\\.side`);
    const b = bodies.find(x => x.mesh.faces.some(f => cut.test(f.name))) ?? bodies[selection.bodies[0] ?? -1];
    return b ? holeRegions(doc.nodes, group, b.mesh.bounds) : [];
  }, [active, editNode, doc.nodes, bodies, selection.bodies, rendering, drawing, sketch]);

  // The picked pole's gizmo: drag it along an axis; let go, the curve or surface is edited (one undo step).
  const poleMode = !active && !sketch && !rendering && !drawing && !measure && !assembly.draft;
  const poleGizmo: TransformGizmo | null = poleMode && poleHere && poleObj && doc.direct ? {
    origin: poleMoved(poleDrag ?? [0, 0, 0]) as Vec3, move: [0, 1, 2],
    onMove: (delta, done) => {
      if (!done) { setPoleDrag(delta); return; }
      setPoleDrag(null); if (delta.every(v => v === 0)) return;
      try { commitDirect(D!.movePole(doc.direct!, poleObj, poleHere.key, poleMoved(delta)), [poleObj]); }
      catch (e) { setToast({ title: 'The pole could not be moved', hint: e instanceof Error ? e.message : String(e), detail: '' }); }
    },
  } : null;

  const totalNodes = doc.nodes.length; const markerAt = marker ?? totalNodes;
  const sel1 = selection.faces[0] ? { kind: 'face' as const, body: bodies[selection.faces[0].body], face: bodies[selection.faces[0].body]?.mesh.faces[selection.faces[0].face] }
    : selection.edges[0] ? { kind: 'edge' as const, body: bodies[selection.edges[0].body], edge: bodies[selection.edges[0].body]?.mesh.edges[selection.edges[0].edge] } : null;
  const selBodies = selectedBodies(selection).map(i => bodies[i]).filter(Boolean);

  return (
    <div className="studio">
      <Viewport ref={viewport} bodies={cageEd.session ? cageEd.shown(shownBodies) : viewBodies} selection={cageEd.session ? emptySel : shownSelection} ghost={sketchGhost} sketch={sketch} gizmo={cageEd.session ? cageEd.gizmo : gizmo ?? instGizmo ?? poleGizmo} cage={cageEd.overlay} onPickCage={cageEd.onPick} tool={skel.tool} regions={regions} threads={threads} analysis={rendering ? null : viewAnalysis} handles={sectionDrag.length ? sectionDrag : handles} instancePreview={instancePreview} profiles={active ? [] : profiles} onPickProfile={pickProfile} render={rendering ? render : null}
        direct={directShown} directSelection={directSel} poles={poleMode ? poles : undefined} cloud={benchCloud ?? workspaceCloud} underlays={underlaysShown} pickedPole={poleHere?.key ?? null} onPickPole={key => poleObj && setPole(pole?.id === poleObj && pole.key === key ? null : { id: poleObj, key })} offsets={animatedOffsets} transforms={dragTransforms} instances={instancesDrawn} instanceTransforms={instanceTransforms} clip={sectionClip} sectionHatch={sectionHatchLines} scalarMaps={scalarMaps} onHoverScalar={scalarMaps ? setMapHover : undefined} mould={mouldShown} isoclines={isoclines} proposal={ghost ? proposalOverlay : null} instanceSelection={assembly.draft ? assembly.highlight.instances : instanceSel} instanceFaces={mateFaces ? assembly.highlight.instanceFaces : undefined}
        placing={!!active?.placing} placeSkip={placeSkip} onSpot={onSpot}
        onPickBody={b => { if (active || section) return; setDirectSel([]); setInstanceSel([]); setSelection({ faces: [], edges: [], bodies: [b] }); }}
        onPickChain={(b, e) => { if (active || section || !bodies[b]) return; setDirectSel([]); setInstanceSel([]); setSelection({ faces: [], edges: edgeChain(bodies[b].mesh, e).map(edge => ({ body: b, edge })), bodies: [] }); }} bodyColors={bodyColors} faceColors={faceColors} pickedVertices={selection.vertices} hiddenBodies={hiddenBodies} snapStep={snapStep} pickFilter={active ? 'all' : pickFilter} hoverBody={previewBodies ? null : rowHover}
        onPick={onPick} onCursor={onCursor} onSketchShape={updateShape}
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
        {!sketch && !rendering && !drawing && <ShapesStrip buttons={commands.filter(c => c.place).map(toolButton)} />}
        <div className="grow" />
        <div className="mode" role="group" aria-label="Mode">
          <button className={!sketch && !rendering && !drawing ? 'on' : ''} onClick={() => { setSketch(null); setRendering(false); setPlaying(false); setDrawing(false); }}>Model</button>
          <button className={sketch ? 'on sketching' : ''} onClick={() => start(commands.find(c => c.id === 'sketch')!)}>{sketch ? `Sketch · ${planeLabel(sketch.plane)}` : 'Sketch'}</button>
          <button className={rendering ? 'on' : ''} onClick={() => { setSketch(null); setActive(null); setMeasure(null); setDrawing(false); setRendering(true); }}>Render</button>
          <button className={drawing ? 'on' : ''} onClick={() => { setSketch(null); setActive(null); setMeasure(null); setRendering(false); setPlaying(false); setDrawing(true); }}>Drawing</button>
        </div>
        <div className="grow" />
        {sketch && <button className="finish" onClick={finishSketch}><Icon name="check" />Finish sketch <Kbd>⏎</Kbd></button>}
        {/* (The right-hand tools fold into More tools when the bar has no room for them: ui/ToolsTray.tsx.) */}
        <ToolsTray items={[
          <button key="tool0" className={'tool' + (chat ? ' on' : '')} aria-label="Chat" data-tip="Chat" data-tip-desc="Model by chat" onClick={() => setChat(v => !v)}><Icon name="chat" /></button>,
          <button key="tool1" className="tool" aria-label="Undo" data-tip={undo.length ? `Undo ${describeChange(undo[undo.length - 1].doc, doc)}` : 'Nothing to undo'} data-tip-key="⌘Z" disabled={!undo.length} onClick={doUndo}><Icon name="undo" /></button>,
          <button key="tool2" className="tool" aria-label="Redo" data-tip={redo.length ? `Redo ${describeChange(doc, redo[redo.length - 1].doc)}` : 'Nothing to redo'} data-tip-key="⇧⌘Z" disabled={!redo.length} onClick={doRedo}><Icon name="redo" /></button>,
          <button key="tool3" className="tool" aria-label="New part" data-tip="New part" onClick={() => { replaceDoc(emptyDoc()); setFileName('Untitled'); }}><Icon name="add_box" /></button>,
          <span key="tool4" className="tpl-anchor"><button className={'tool' + (templatesOpen ? ' on' : '')} aria-label="New from a template" data-tip="Templates" data-tip-desc="Start a part from a template, or keep this one as a template" onClick={() => setTemplatesOpen(v => !v)}><Icon name="library_add" /></button>
          {templatesOpen && <div className="card templates" role="menu" aria-label="Templates">
            <div className="card-title">NEW FROM A TEMPLATE</div>
            {[...BUILT_IN.map(t => ({ name: t.name, doc: t.doc(), own: false })), ...savedTemplates().map(t => ({ ...t, own: true }))].map(t => <div key={(t.own ? 'own:' : '') + t.name} className="tpl-row">
              <button className="ghost" role="menuitem" aria-label={`New from ${t.name}`} onClick={() => { replaceDoc({ ...t.doc, outputs: prefixDoc(t.doc, t.doc.nodes.length).outputs }); setFileName('Untitled'); setTemplatesOpen(false); setTimeout(() => viewport.current?.fit(), 300); }}>{t.name}</button>
              {t.own && <button className="tool tiny" aria-label={`Remove template ${t.name}`} onClick={() => { removeTemplate(t.name); setTemplatesOpen(false); }}><Icon name="close" small /></button>}
            </div>)}
            <div className="tpl-row add"><input className="kv-input" aria-label="Template name" placeholder="Keep this part as…" value={templateName} onChange={e => setTemplateName(e.target.value)} onKeyDown={e => e.stopPropagation()} />
              <button className="ghost small" aria-label="Save as a template" disabled={!templateName.trim()} onClick={() => { if (saveTemplate(templateName.trim(), doc)) setToast({ title: 'Template saved', hint: `“${templateName.trim()}” is in Templates, in this browser.`, detail: '' }); else setToast({ title: 'Could not save the template', hint: 'This browser would not keep it (private mode or no room).', detail: '' }); setTemplateName(''); setTemplatesOpen(false); }}>Save</button></div>
          </div>}</span>,
          <button key="tool5" className={'tool' + (libraryOpen ? ' on' : '')} aria-label="Library" data-tip="Library" data-tip-desc="Catalogue parts from libraries (built-in, team, yours): insert them, snap them by their interfaces" onClick={() => setLibraryOpen(v => !v)} hidden={rendering || drawing}><Icon name="menu_book" /></button>,
          <button key="tool6" className={'tool' + (paramsOpen ? ' on' : '')} aria-label="Parameters" data-tip="Parameters" data-tip-desc="Named sizes the part depends on, and saved sets of them (configurations)" onClick={() => setParamsOpen(v => !v)} hidden={rendering || drawing}><Icon name="function" /></button>,
          <button key="tool7" className="tool" aria-label="Open" data-tip="Open" data-tip-desc="A .bcad model or a STEP file; an IGES file’s or a .barocad source’s curves and surfaces" onClick={() => fileInput.current?.click()}><Icon name="folder_open" /></button>,
          <button key="tool8" className="tool" aria-label="Save" data-tip="Save" data-tip-key="⌘S" onClick={save}><Icon name="save" /></button>,
          <button key="tool9" className="tool" aria-label="Export STL" data-tip="Export STL" data-tip-desc="A mesh for printing" onClick={exportStl}><Icon name="download" /></button>,
          <button key="tool10" className="tool" aria-label="Export 3MF" data-tip="Export 3MF" data-tip-desc="For a slicer: bodies, materials, colours, the print orientation" onClick={() => void exportThreeMf()}><Icon name="print" /></button>,
          <button key="tool11" className="tool" aria-label="Export STEP" data-tip="Export STEP" data-tip-desc="The exact solids, for other CAD" onClick={() => void exportStepFile()}><Icon name="deployed_code_update" /></button>,
          !!doc.direct?.objects.some(o => !o.hidden) && <button key="tool12" className="tool" aria-label="Export IGES" data-tip="Export IGES" data-tip-desc="The visible curves and surfaces" onClick={async () => {
          try { downloadBytes(new TextEncoder().encode((await loadDirect()).directIGES(doc.direct!, fileName)), `${fileName}.igs`, 'model/iges'); }
          catch (e) { setToast({ title: 'Could not write IGES', hint: e instanceof Error ? e.message : String(e), detail: '' }); }
        }}><Icon name="polyline" /></button>,
          <button key="tool13" className="tool" aria-label="Insert part" data-tip="Insert part" data-tip-desc="Another part (.bcad) as an instance" onClick={() => partInput.current?.click()}><Icon name="add_to_photos" /></button>,
        ].filter(Boolean)} />
        <input ref={partInput} type="file" accept=".bcad,.json" hidden aria-label="Part file" onChange={e => { const f = e.target.files?.[0]; if (f) insertPart(f); e.target.value = ''; }} />
        <input ref={fileInput} aria-label="Model file" type="file" accept=".bcad,.json,.step,.stp,.stl,.obj,.igs,.iges,.barocad,.cad,.dwg" hidden onChange={e => { const f = e.target.files?.[0]; if (f) open(f); e.target.value = ''; }} />
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
          {(sketch.done ?? []).some(d => d.construction) && <button className={'tool' + (sketch.hideConstruction ? ' on' : '')} data-tip={sketch.hideConstruction ? 'Show construction' : 'Hide construction'} data-tip-desc="The dashed reference shapes: hidden ones are not drawn or snapped to, and stay with the sketch" aria-label={sketch.hideConstruction ? 'Show construction' : 'Hide construction'}
            onClick={() => setSketch(s => s && { ...s, hideConstruction: !s.hideConstruction })}><Icon name={sketch.hideConstruction ? 'visibility_off' : 'visibility'} /></button>}
          <button className="tool" data-tip="Clear profile" data-tip-desc="Remove every shape drawn in this sketch" aria-label="Clear profile" onClick={() => setSketch(s => s && { ...s, shape: null, done: [] })}><Icon name="ink_eraser" /></button>
        </>) : (['create', 'modify', 'pattern', 'combine', 'inspect'] as const).map((g, gi) => (
          <div key={g} className="tool-group">
            {gi > 0 && <div className="sep" />}
            {commands.filter(c => c.group === g && !c.place).map(toolButton)}
          </div>))}
      </nav>

      <aside className={'card outliner' + (browserOpen ? '' : ' closed')} aria-label="Outliner">
        <div className="card-title">BROWSER <span className="muted" aria-busy={!fresh}>{fresh ? `${bodies.length} bod${bodies.length === 1 ? 'y' : 'ies'}` : busy ? 'evaluating…' : 'not up to date'}</span>
          <button className="tool tiny" aria-label={browserOpen ? 'Collapse the browser' : 'Expand the browser'} onClick={() => setBrowserOpen(o => { try { localStorage.setItem('cad-studio.browser', o ? 'closed' : 'open'); } catch { /* private mode */ } return !o; })}><Icon name={browserOpen ? 'left_panel_close' : 'left_panel_open'} small /></button></div>
        {browserOpen && <>
        {bodies.length > 0 && <div className="ol-head">Bodies</div>}
        {!fresh && bodies.map(b => <div key={b.key} className="ol-row stale" aria-busy="true" title={busy ? 'Evaluating the part: this is the body before the change' : 'The part did not evaluate: this is the last good body'}>
          <span className="ol-eye" /><span className="ol-swatch" /><span className="ol">{bodyName(namesDoc, b)}</span></div>)}
        {fresh && bodies.map((b, i) => {
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
            {meshBadges(i, b, steps)}
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
        <SpecifyPanel doc={doc} onAnswer={answerQuestions} onAcceptAll={acceptAll} />
        <DraftsPanel drafts={liveDrafts(doc)} underlays={doc.underlays ?? []} onUnderlay={(id, hidden) => commit({ ...doc, underlays: (doc.underlays ?? []).map(u => u.id === id ? { ...u, hidden } : u) }, false)} onAddDrawing={f => void addDrawingFile(f)} onConfirm={(key, value) => { try { commit(confirmDimension(doc, key, value, new Date().toISOString())); } catch (e) { setToast({ title: 'Dimension not changed', hint: e instanceof Error ? e.message.replace(/^\[[A-Z_]+\] /, '') : String(e), detail: '' }); } }} />
        <ReferencesPanel set={readReferences(doc.references)} local={refLocal} verdicts={keepoutVerdicts} onAddFile={f => void addReferenceFile(f)} onPlace={placeRef}
          onDatum={(reference, face, kind) => void refTool('add_datum', { reference, face, kind })} onEnvelope={(reference, offset, clearance) => void refTool('add_keepout', { around: reference, offset, shape: 'box', clearance })} onRemove={removeRef} />
        {(() => { const b = readBrief(doc.brief); return b ? <BriefPanel brief={b} onConfirm={confirmBrief} /> : null; })()}
        {!!doc.requirements?.length && <><div className="ol-head req-head">Requirements <span className="muted">{spec ? `${spec.summary.pass} ✓ · ${spec.summary.fail} ✗ · ${spec.summary.unknown} ?` : ''}{specRunning ? ' · checking…' : spec && spec.of !== evaluated.nodes ? ' · stale' : ''}</span>
          <button className={'tool tiny' + (failingOnly ? ' on' : '')} aria-label="Failing only" data-tip={failingOnly ? 'Show all' : 'Failing only'} onClick={() => setFailingOnly(f => !f)}><Icon name="filter_list" small /></button></div>
        {doc.requirements.map(q => {
          const o = spec?.outcomes[q.id], st = o?.status ?? 'unknown';
          if (failingOnly && st === 'pass') return null;
          const editable = q.basis === 'assumed' || q.basis === 'ambiguous';
          return <div key={q.id} className={'req ' + st} role="listitem" aria-label={`Requirement ${q.id}`}>
            <button className="req-row" title={o?.why ?? (o?.hint ? `${o.hint}` : q.source)} onClick={() => { if (o?.entities?.length) setSelection(resolveNames(bodies, { faces: o.entities, edges: o.entities }).selection); }}>
              <span className="req-mark">{st === 'pass' ? '✓' : st === 'fail' ? '✗' : '?'}</span><b>{q.id}</b> {q.source}
              {st === 'fail' && <span className="muted"> · {String(o?.measured)} (want {expectedOf(q.check)})</span>}
              {st === 'unknown' && o?.why && <span className="muted"> · {o.why}</span>}
              <span className="muted"> · {q.hard ? 'hard' : 'soft'} · {q.basis ?? 'stated'}{q.confirmed ? ` (confirmed by ${q.confirmed.by})` : ''}</span></button>
            {editable && <span className="req-edit"><span className="muted">{q.basis}</span>
              <input aria-label={`${q.id} value`} type="number" step="any" defaultValue={q.check.value ?? q.check.max ?? q.check.min}
                onKeyDown={e => { if (e.key === 'Enter') setRequirement(q.id, Number(e.currentTarget.value)); e.stopPropagation(); }} />
              <button className="ghost small" aria-label={`Confirm ${q.id}`} onClick={e => { const v = (e.currentTarget.previousSibling as HTMLInputElement).value; setRequirement(q.id, Number(v)); }}>Confirm</button></span>}
          </div>;
        })}</>}
        {!!doc.proposals?.length && <><div className="ol-head req-head">Proposals <span className="muted">{doc.proposals.filter(p => p.status === 'open').length} open</span>
          <button className={'tool tiny' + (decidedShown ? ' on' : '')} aria-label="Show decided proposals" data-tip={decidedShown ? 'Open only' : 'Show accepted and rejected'} onClick={() => setDecidedShown(f => !f)}><Icon name="history" small /></button></div>
        {doc.proposals.filter(p => decidedShown || p.status === 'open').map(p => {
          const shown = ghost?.id === p.id, stale = p.status === 'open' && p.base !== hashNow, dv = shown ? volumeOf(ghost.bodies) - volumeOf(bodies) : 0, base = volumeOf(bodies);
          return <div key={p.id} className={'proposal ' + p.status + ' risk-' + p.risk.level} role="listitem" aria-label={`Proposal ${p.id}`}>
            <div className="proposal-title"><b>{p.id}</b> {p.title} <span className={'risk-badge ' + p.risk.level} title={`${p.risk.features_touched} features touched · ${p.risk.references_broken} references broken${p.risk.hard_requirements_changed.length ? ` · hard requirements ${p.risk.hard_requirements_changed.join(', ')}` : ''}${p.risk.approval.length ? ` · always needs approval: ${p.risk.approval.join(', ')}` : ''}`}>{p.risk.level} risk</span></div>
            <div className="muted">{stale ? <b className="stale">stale · </b> : p.rebased ? 'rebased · ' : ''}{p.summary}{p.risk.references_broken ? ` · ${p.risk.references_broken} reference${p.risk.references_broken > 1 ? 's' : ''} broken` : ''}{p.risk.hard_requirements_changed.length ? ` · hard ${p.risk.hard_requirements_changed.join(', ')}` : ''}{p.risk.approval.length ? ` · needs you (${p.risk.approval.join(', ')})` : ''} · {p.by.agent}{p.by.model ? ` (${p.by.model})` : ''}</div>
            {p.plan && <div className="proposal-plan">{p.plan}</div>}
            {shown && fresh && <div className="mono proposal-dv">{ghost.after ? 'after' : 'before'} · volume <span aria-label="Volume change">{dv >= 0 ? '+' : '−'}{fmt(Math.abs(dv))} mm³{base ? ` (${dv >= 0 ? '+' : '−'}${fmt(Math.abs(dv) / base * 100)}%)` : ''}</span></div>}
            {shown && ghost.parts.length > 1 && <div className="proposal-parts" role="group" aria-label={`${p.id} features`}>{ghost.parts.map(q => <label key={q.id} className={'proposal-part ' + q.kind}>
              <input type="checkbox" aria-label={`Keep ${q.id}`} disabled={q.kind === 'deleted' || proposalBusy} checked={!ghost.leaveOut.includes(q.id)} onChange={e => void tickPart(q.id, e.currentTarget.checked)} />
              <span className="mono">{q.id}</span> {q.kind === 'added' ? '+' : q.kind === 'changed' ? '~' : '−'} {q.label}</label>)}</div>}
            {p.status === 'open' ? <div className="proposal-actions">
              <button className={'ghost small' + (shown ? ' on' : '')} disabled={proposalBusy || stale} onClick={() => void showProposal(p)}>{shown ? 'Hide' : 'Preview'}</button>
              {shown && <button className="ghost small" aria-label="Before or after" onClick={flipGhost}>{ghost.after ? 'After' : 'Before'}</button>}
              <span className="grow" />
              <button className="ghost small" disabled={proposalBusy} onClick={() => rejectIt(p)}>Reject</button>
              {stale ? <button className="primary small" disabled={proposalBusy} title="The part changed since this was proposed: make it again on the part as it is, and look before accepting" onClick={() => void rebaseIt(p)}>Rebase &amp; preview</button>
                : <button className="primary small" disabled={proposalBusy} onClick={() => void acceptIt(p)}>{shown && ghost.leaveOut.length ? `Accept ${ghost.parts.length - ghost.leaveOut.length} of ${ghost.parts.length}` : 'Accept'}</button>}
            </div> : <div className="muted">{p.status} by {p.decided?.by}{p.decided?.note ? ` · ${p.decided.note}` : ''}</div>}
          </div>;
        })}</>}
        {!!doc.history?.length && <><div className="ol-head req-head">Design history <span className="muted">{doc.history.length}</span>
          <button className={'tool tiny' + (historyOpen ? ' on' : '')} aria-label="Show design history" data-tip={historyOpen ? 'Hide' : 'Show'} onClick={() => setHistoryOpen(f => !f)}><Icon name={historyOpen ? 'expand_less' : 'expand_more'} small /></button></div>
        <div className="empty history-note">Saved with the part, chat messages included. <button className="link" onClick={saveShared}>Save a copy without it</button> to share.</div>
        {historyOpen && doc.history.slice(-40).reverse().map(h => <div key={h.id} className={'hist ' + h.kind} title={h.prompt ?? h.plan ?? h.summary}>
          <span className="mono muted">{h.kind}</span> {h.kind === 'prompt' ? `“${(h.prompt ?? '').slice(0, 80)}${(h.prompt?.length ?? 0) > 80 ? '…' : ''}”` : h.summary}
          {h.kind === 'prompt' && h.summary && <span className="muted"> → {h.summary}</span>}
          <span className="muted"> · {h.by.agent}{h.by.model ? ` (${h.by.model})` : ''} · {whenOf(h.at)}</span></div>)}</>}
        {!bodies.length && !busy && <div className="empty">No bodies yet. Press <Kbd>S</Kbd> to sketch or <Kbd>B</Kbd> for a box.</div>}
        </>}
      </aside>
      <div className="right-col">

      {sketch && <SketchPanel sketch={sketch} error={sketchError} onShape={updateShape} onPlace={sketch.editNode === undefined ? placeSketch : undefined} onUi={patch => setSketch(s => s && { ...s, ...patch })} onOffset={offsetSketch} onToCurves={sketchToCurves} onUseOutline={sketch.anchor?.kind === 'face' && sketch.anchor.face?.outline?.length && !sketch.anchor.offset && !sketch.anchor.angle
        ? (asRefs: boolean) => setSketch(s => s && { ...s, shape: null, done: [...(s.done ?? []), ...(s.shape ? [s.shape] : []), ...(s.anchor?.face?.outline ?? []).map(x => asRefs ? { ...x, construction: true as const } : x)] }) : undefined} />}
      {libraryOpen && !paramsOpen && !rendering && !drawing && !sketch && !active && <LibraryPanel doc={doc} onCommit={next => commit(next)} onClose={() => setLibraryOpen(false)} onError={(title, hint) => setToast({ title, hint, detail: '' })} onQuote={() => { void exportQuote(); }} />}
      {paramsOpen && !rendering && !drawing && !sketch && !active && <ParametersPanel doc={doc} onClose={() => setParamsOpen(false)}
        onChange={p => {
          // (O140: the skeletons bound to a parameter re-solved with it — a conflict refused, the parameter named, nothing changed.)
          const r = resolveSkeletons({ ...doc, ...p, ...(p.configurations ? {} : { configurations: undefined }) });
          if ('error' in r) { setToast({ title: 'That value does not hold', hint: r.error.replace(/^\[\w+\] /, ''), detail: 'The parameters are as they were.' }); return; }
          commit(r.doc);
        }} onError={m => setToast({ title: 'Parameters', hint: m, detail: '' })} />}
      {rendering && !sketch && <Suspense fallback={null}><RenderPanel render={render} onError={m => setToast({ title: 'Could not use that image', hint: m, detail: '' })} available={viewport.current?.backend === 'webgpu'}
        selectedKeys={[...selectedBodies(selection).map(i => bodies[i]?.key).filter((k): k is string => !!k), ...instanceSel.map(id => 'inst:' + id)]}
        onChange={commitRender} onExport={exportImage} fov={fov}
        onFov={deg => { const c = viewport.current?.getCamera(); if (c) { viewport.current?.setCamera({ ...c, fovY: deg * Math.PI / 180 }); setFov(deg); } }}
        onSaveCamera={() => { const c = viewport.current?.getCamera(); if (c) commitRender({ ...render, camera: c }); }}
        onUseCamera={() => { if (render.camera) { viewport.current?.setCamera(render.camera); setFov(Math.round(render.camera.fovY * 180 / Math.PI)); } }} /></Suspense>}
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
          {measured.axes && <div className="kv" aria-label="Axes">Axes <b>{measured.axes.coaxial ? 'coaxial' : `${fmt(Math.round(measured.axes.angle * 1000) / 1000)}° apart, ${fmt(Math.round(measured.axes.offset * 1000) / 1000)} mm off`}</b></div>}
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
          shared={inst.part ? sharing(doc, inst.part.id).length : 0} pending={inst.part ? doc.pendingParts?.[inst.part.id] : undefined}
          onIndependent={() => commitParts(makeIndependent(doc, inst.id))}
          onRevision={async file => {
            const read = await readStudioFile(new Uint8Array(await file.arrayBuffer()));
            if ('error' in read) { setToast({ title: 'Could not read that part', hint: read.error, detail: '' }); return; }
            const r = offerRevision(doc, inst.part!.id, read.doc, file.name);
            if ('error' in r) setToast({ title: 'Nothing to update', hint: r.error, detail: '' }); else commitParts(r.doc);
          }}
          onAccept={() => commitParts(acceptRevision(doc, inst.part!.id))} onDismiss={() => commitParts(dismissRevision(doc, inst.part!.id))}
          onRemove={() => { commitAssembly(list.filter(i => i.id !== inst.id), assembly.without(inst.id)); setInstanceSel([]); }} />;
      })()}
      {!rendering && !sketch && !measure && jointTree && !assembly.draft && !instanceSel.length && <JointsPanel tree={jointTree} instances={doc.instances ?? []}
        values={jointFk?.values ?? jointValues} onValue={(k, v) => { setJointPlaying(null); setJointValues(x => ({ ...x, [k]: v })); }} onHome={() => { setJointPlaying(null); setJointValues({}); }} playing={jointPlaying} onPlay={setJointPlaying} gears={gearLines} links={linkInertias}
        onExportUrdf={() => {
          // (RM4: the bodies as placed, so each part's placement is the identity here; the same robot as from part coordinates.)
          const r = exportUrdf(jointTree, p => { if (p === BASE) return { doc, bodies, position: [0, 0, 0], rotation: [0, 0, 0] }; const i = doc.instances?.find(x => x.id === p), b = instanceBodies.get(p); return i && b ? { doc: i.doc, bodies: b.bodies, position: [0, 0, 0], rotation: [0, 0, 0] } : null; }, fileName);
          if (!r.ok) { setToast({ title: 'URDF refused', hint: r.refusals.map(x => x.message).join(' '), detail: r.refusals.map(x => x.code).join(', ') }); return; }
          void writeZip([{ name: 'robot.urdf', data: new TextEncoder().encode(r.urdf), deflate: true }, ...r.files.map(f => ({ name: f.path, data: f.data, deflate: true }))]).then(z => downloadBytes(z, `${fileName}-urdf.zip`, 'application/zip'));
          if (r.notes.length) setToast({ title: 'URDF written', hint: r.notes.join(' '), detail: '' });
        }}
        waypoints={jointWaypoints.length} onAddWaypoint={() => setJointWaypoints(w => [...w, { ...(jointFk?.values ?? jointValues) }])} onClearWaypoints={() => { setJointWaypoints([]); setPathCheck(null); }}
        onWorkspace={(n, h, free) => {
          // (RM9b: the deepest link's joint point over the joints' ranges; a slide without limits refused, said so.)
          const depth = (l: string): number => { const j = jointTree.joints.find(x => x.child === l); return j ? 1 + depth(j.parent) : 0; }, end = jointTree.links.reduce((b, l) => depth(l.id) > depth(b.id) ? l : b, jointTree.links[0]).id;
          try {
            // (The tool point: the end link's farthest hull point from its joint at the solved pose — its tip.)
            const links = sweepLinks(jointTree, p => p === BASE ? bodies : instanceBodies.get(p)?.bodies, pts => convexHull(pts).positions), own = jointTree.joints.find(j => j.child === end)?.origin ?? [0, 0, 0];
            const hull = links.find(l => l.link === end)?.hull; let tool: number[] | undefined, far = -1;
            if (hull) for (let i = 0; i < hull.length; i += 3) { const d = Math.hypot(hull[i] - own[0], hull[i + 1] - own[1], hull[i + 2] - own[2]); if (d > far) { far = d; tool = [hull[i], hull[i + 1], hull[i + 2]]; } }
            setWorkspace(workspaceMap(jointTree, { link: end, samples: n, h, ...(tool ? { tool } : {}), ...(free ? { links } : {}) }));
          } catch (e) { setToast({ title: 'Workspace not mapped', hint: e instanceof Error ? e.message.replace(/^\[[A-Z_]+\] /, '') : String(e), detail: '' }); }
        }}
        workspace={workspace ? `Workspace of ${workspace.samples} poses${workspace.excluded ? ` (${workspace.excluded} in self-contact left out)` : ''}: ${workspace.voxels.length} voxels of ${workspace.h} mm, reach ${workspace.reach.toFixed(1)} mm, best manipulability ${Math.max(0, ...workspace.voxels.map(v => v.w)).toExponential(3)}` : null}
        onWorkspaceDownload={() => workspace && downloadBytes(new TextEncoder().encode(JSON.stringify(workspace)), `${fileName}-workspace.json`, 'application/json')}
        onWorkspaceHide={() => setWorkspace(null)}
        path={pathCheck} ready={robotReady} holding={jointMasses && jointTree ? gravityTorques(jointTree, jointMasses, jointFk?.values ?? jointValues).torques : undefined}
        onCheckPath={() => {
          // (RM6, RM9a: the timed path from the solved pose through the waypoints to the sliders', the links as placed; each
          // segment a trapezoid within the joints' velocity limits — 1 rad/s or 100 mm/s where none is set — and twice that
          // per second's acceleration; the whole path certified, or its time of impact.)
          const links = sweepLinks(jointTree, p => p === BASE ? bodies : instanceBodies.get(p)?.bodies, pts => convexHull(pts).positions);
          const limits: Record<string, JointLimits> = {}, assumed: string[] = [];
          for (const j of jointTree.joints) { if (j.type === 'fixed' || j.mimic) continue; const v = j.limit?.velocity ?? (j.type === 'prismatic' ? 100 : 1); if (j.limit?.velocity === undefined) assumed.push(j.key); limits[j.key] = { v, a: 2 * v }; }
          const r = sweepTimed(jointTree, links, { waypoints: [{}, ...jointWaypoints, jointValues], profile: 'trapezoid', limits });
          const name = (l: string) => jointTree.links.find(x => x.id === l)?.name ?? l, total = r.segments.reduce((t, g) => t + g.duration, 0), n = r.segments.length;
          const note = assumed.length ? `; no velocity limit on ${assumed.join(', ')}: 1 rad/s (100 mm/s) taken` : '';
          setPathCheck(r.toi !== undefined ? { contact: true, text: `Contact ${name(r.links![0])} – ${name(r.links![1])} at ${(total > 0 ? r.toi / total * 100 : 0).toFixed(1)} % of the move, t ${r.toi.toFixed(3)} s${n > 1 ? ` (segment ${r.segment! + 1} of ${n})` : ''} (${r.samples} steps${note})` }
            : { contact: false, text: `Clear: the whole move certified, ${total.toFixed(3)} s${n > 1 ? ` over ${n} segments` : ''} (${r.samples} steps${note})${r.minClearance ? `; least clearance ${r.minClearance.mm.toFixed(2)} mm at t ${r.minClearance.t.toFixed(3)} s, ${name(r.minClearance.links[0])} – ${name(r.minClearance.links[1])}` : ''}` });
        }}
        onExportMjcf={() => {
          // (RM5: as the URDF, the same parts; robot.xml and its meshes.)
          const r = exportMjcf(jointTree, p => { if (p === BASE) return { doc, bodies, position: [0, 0, 0], rotation: [0, 0, 0] }; const i = doc.instances?.find(x => x.id === p), b = instanceBodies.get(p); return i && b ? { doc: i.doc, bodies: b.bodies, position: [0, 0, 0], rotation: [0, 0, 0] } : null; }, fileName);
          if (!r.ok) { setToast({ title: 'MJCF refused', hint: r.refusals.map(x => x.message).join(' '), detail: r.refusals.map(x => x.code).join(', ') }); return; }
          void writeZip([{ name: 'robot.xml', data: new TextEncoder().encode(r.xml), deflate: true }, ...r.files.map(f => ({ name: f.path, data: f.data, deflate: true }))]).then(z => downloadBytes(z, `${fileName}-mjcf.zip`, 'application/zip'));
        }}
        onExportSdf={() => {
          // (RM9c: as the URDF and MJCF, the same parts; each planar loop closed at its pin, RM8.)
          const r = exportSdf(jointTree, robotPartOf, fileName, robotClosures());
          if (!r.ok) { setToast({ title: 'SDF refused', hint: r.refusals.map(x => x.message).join(' '), detail: r.refusals.map(x => x.code).join(', ') }); return; }
          void writeZip([{ name: 'robot.sdf', data: new TextEncoder().encode(r.sdf), deflate: true }, ...r.files.map(f => ({ name: f.path, data: f.data, deflate: true }))]).then(z => downloadBytes(z, `${fileName}-sdf.zip`, 'application/zip'));
          if (r.notes.length) setToast({ title: 'SDF written', hint: r.notes.join(' '), detail: '' });
        }}
        onExportUsd={() => {
          const r = exportUsd(jointTree, robotPartOf, fileName, robotClosures());
          if (!r.ok) { setToast({ title: 'USD refused', hint: r.refusals.map(x => x.message).join(' '), detail: r.refusals.map(x => x.code).join(', ') }); return; }
          downloadBytes(new TextEncoder().encode(r.usda), `${fileName}.usda`, 'model/vnd.usda');
          if (r.notes.length) setToast({ title: 'USD written', hint: r.notes.join(' '), detail: '' });
        }}
        onBase={b => { pushUndo(); const robot = { ...(doc.robot ?? { version: 1 as const }) }; if (b === BASE) delete robot.base; else robot.base = b; setDoc({ ...doc, robot }); setDirty(true); }} />}
      {!rendering && !sketch && !measure && !!doc.instances?.length && (assembly.draft || instanceSel.length === 1) && <MatePanel assembly={assembly} instances={doc.instances} instance={instanceSel.length === 1 ? instanceSel[0] : undefined}
        onRefused={why => setToast({ title: 'The mate was refused', hint: why, detail: '' })} />}
      {!rendering && !sketch && !measure && !instanceSel.length && directSel.length > 0 && doc.direct && <Suspense fallback={null}><DirectPanel direct={doc.direct} selected={directSel}
        onChange={commitDirect} onError={m => setToast({ title: 'The operation was refused', hint: m, detail: '' })}
        onHide={ids => { commitDirect({ ...doc.direct!, objects: doc.direct!.objects.map(o => ids.includes(o.id) ? { ...o, hidden: true } : o) }, []); }}
        onThicken={(id, thickness, side) => {
          const o = doc.direct!.objects.find(x => x.id === id)!, g = D!.geometryOf(doc.direct!, o);
          if (g.kind !== 'surface') return;
          if (o.trims?.length) { setToast({ title: 'Untrim it first', hint: 'Thicken uses the whole surface; a trimmed one is not thickened along its trim yet.', detail: '' }); return; }
          if (!(thickness > 0)) { setToast({ title: 'Give it a thickness', hint: 'A wall is thicker than 0 mm.', detail: '' }); return; }
          const surface = { degreeU: g.degreeU, degreeV: g.degreeV, knotsU: [...g.knotsU], knotsV: [...g.knotsV], controlPoints: g.controlPoints.map(r => r.map(p => [p[0], p[1], p[2]] as [number, number, number])), weights: g.weights.map(r => [...r]) };
          setDirectSel([]); commit(withNode(evaluated, { kind: 'thicken', name: o.name, surface, thickness, ...(side !== 'normal' ? { side } : {}) }));
        }}
        onSew={(ids, tolerance) => {
          const objs = ids.map(id => doc.direct!.objects.find(x => x.id === id)!), gs = objs.map(o => D!.geometryOf(doc.direct!, o));
          const surfaces = gs.flatMap(g => g.kind === 'surface' ? [{ degreeU: g.degreeU, degreeV: g.degreeV, knotsU: [...g.knotsU], knotsV: [...g.knotsV], controlPoints: g.controlPoints.map(r => r.map(p => [p[0], p[1], p[2]] as [number, number, number])), weights: g.weights.map(r => [...r]) }] : []);
          if (surfaces.length !== ids.length) return;
          if (objs.some(o => o.trims?.length)) { setToast({ title: 'Untrim them first', hint: 'Sewing joins surfaces along their own edges; trimmed ones do not sew yet.', detail: '' }); return; }
          // (The surfaces hidden as they become the body's faces, in the same undoable step.)
          const direct = { ...doc.direct!, objects: doc.direct!.objects.map(o => ids.includes(o.id) ? { ...o, hidden: true } : o) };
          setDirectSel([]); commit({ ...withNode(evaluated, { kind: 'sew', names: objs.map(o => o.name), surfaces, ...(tolerance > 0 ? { tolerance: Math.min(1, tolerance) } : {}) }), direct });
        }} /></Suspense>}
      {clashes && !rendering && !sketch && <aside className="card props" aria-label="Interference">
        <div className="card-title">INTERFERENCE <button className="tool tiny" aria-label="Close interference" onClick={() => setClashes(null)}><Icon name="close" small /></button></div>
        {clashes === 'busy' ? <div className="empty">Checking…</div> : !clashes.length ? <div className="empty">No bodies overlap.</div>
          : clashes.map(c => { const ia = bodies.findIndex(b => b.key === c.a), ib = bodies.findIndex(b => b.key === c.b); return (
            <button key={c.a + c.b} className="ol clash" onClick={() => { if (ia >= 0 && ib >= 0) setSelection({ faces: [], edges: [], bodies: [ia, ib] }); }}>
              <Icon name="warning" small />{ia >= 0 ? bodyName(doc, bodies[ia]) : c.a} ∩ {ib >= 0 ? bodyName(doc, bodies[ib]) : c.b}<span className="muted"> · {fmt(Math.round(c.volume * 10) / 10)} mm³</span></button>); })}
      </aside>}
      {/* (A running command's HUD takes this place at the right.) */}
      {cageEd.session && doc.nodes[cageEd.session.node] && !rendering && !drawing && <CagePanel editor={cageEd} name={featureLabel(doc.nodes[cageEd.session.node], cageEd.session.node, doc.nodes)} />}
      {skel.session && !rendering && !drawing && <SkeletonPanel editor={skel} name={skel.session.node === null ? 'new skeleton' : featureLabel(doc.nodes[skel.session.node], skel.session.node, doc.nodes)} />}
      {!cageEd.session && !skel.session && !rendering && !sketch && !measure && !active && !directSel.length && !instanceSel.length && !assembly.draft && <aside className="card props" aria-label="Selection">
        {selection.vertices?.length ? (<>
          <div className="card-title">SELECTION · {selection.vertices.length === 1 ? 'POINT' : `${selection.vertices.length} POINTS`}</div>
          {selection.vertices.map((v, k) => <div key={k} className="kv">{selection.vertices!.length > 1 ? `Point ${k + 1}` : 'X Y Z'} <b>{v.at.map(x => fmt(Math.round(x * 1000) / 1000)).join(', ')}</b></div>)}
          {selection.vertices.length === 2 && (() => { const [a, b] = selection.vertices!.map(v => v.at), d = [0, 1, 2].map(k => b[k] - a[k]); return <><div className="kv">Distance <b>{fmt(Math.round(Math.hypot(d[0], d[1], d[2]) * 1000) / 1000)} mm</b></div><div className="kv">ΔX ΔY ΔZ <b>{d.map(x => fmt(Math.round(x * 1000) / 1000)).join(', ')}</b></div></>; })()}
        </>) : sel1?.kind === 'face' && sel1.face ? (<>
          <div className="card-title">SELECTION · FACE</div>
          <div className="kv">Type <b>{sel1.face.kind === 'plane' ? 'Planar' : 'Curved'}</b></div>
          {sel1.face.kind === 'plane' && <div className="kv">Normal <b>{sel1.face.normal.map(v => fmt(Math.round(v * 1000) / 1000)).join(', ')}</b></div>}
          <div className="kv">Area <b>{fmt(Math.round(sel1.face.areaMM2 * 100) / 100)} mm²</b></div>
          {sel1.face.radius !== undefined && <div className="kv">Radius <b>{fmt(Math.round(sel1.face.radius * 1000) / 1000)} mm</b></div>}
          {(() => { const b = bodies[selection.faces[0]?.body], name = sel1.face.name, faces = b ? lookOf(doc, b).faces ?? {} : {}, cur = faces[name];
            const set = (c?: string) => { if (!b) return; const next = { ...faces }; if (c) next[name] = c; else delete next[name]; commit(withLook(doc, b, { faces: Object.keys(next).length ? next : undefined })); };
            return b ? <div className="kv">Face colour <span className="swatches" role="group" aria-label="Face colour">
              <button className={'swatch none' + (cur ? '' : ' on')} aria-label="No face colour" data-tip="The body's colour" onClick={() => set()} />
              {BODY_COLOURS.map(c => <button key={c} className={'swatch' + (cur === c ? ' on' : '')} style={{ background: c }} aria-label={'Face colour ' + c} onClick={() => set(c)} />)}
            </span></div> : null; })()}
        </>) : sel1?.kind === 'edge' && sel1.edge ? (<>
          <div className="card-title">SELECTION · EDGE</div>
          {(() => { const it = measureItem(sel1.body.mesh, { body: selection.edges[0].body, edge: selection.edges[0].edge }); return <>
            <div className="kv">Type <b>{it.label}</b></div>
            {it.length !== undefined && <div className="kv">Length <b>{fmt(Math.round(it.length * 100) / 100)} mm</b></div>}
            {it.radius !== undefined && <div className="kv">Radius <b>{fmt(Math.round(it.radius * 1000) / 1000)} mm</b></div>}
          </>; })()}
          {sel1.edge.axis && <div className="kv">Direction <b>{sel1.edge.axis.toUpperCase()}</b></div>}
          <div className="kv"><span /><button className="ghost small" aria-label="Edge as a curve" data-tip="As a curve" data-tip-desc="A copy of this edge as a curve in space (a line, an arc or the polyline), for surfaces" onClick={() => edgesToCurves()}>As a curve</button></div>
        </>) : null}
        {selBodies.length > 0 && !fresh && <><div className="card-title" style={{ marginTop: sel1 ? 10 : 0 }}>BODY</div>
          <div className="empty" aria-busy="true">{busy ? 'Evaluating… its values show once the part is up to date.' : 'The part did not evaluate: fix it, or undo, to see this body\'s values.'}</div></>}
        {selBodies.length > 0 && fresh && <>
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
            {(() => { const own = MATERIALS.find(m => m.id === materialIdOf(doc, b)) ?? density; return <>
              {b.volumeMM3 !== null && <div className="kv">Mass <b>{fmt(Math.round(b.volumeMM3 * own.gPerCm3 / 100) / 10)} g</b></div>}
              {/* The body's own material (the default for new bodies stays the studio's). */}
              <label className="kv"><span>Material{!look.material && <span className="muted"> · {briefMaterial(doc) ? 'from the brief' : 'default'}</span>}</span><select aria-label="Material" value={own.id} onChange={e => commit(withLook(doc, b, { material: e.target.value === (briefMaterial(doc) ?? material) ? undefined : e.target.value }))}>{MATERIALS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}</select></label>
              {own.id !== material && <div className="kv"><span /><button className="ghost small" onClick={() => setMaterial(own.id)} data-tip="Default material" data-tip-desc="Bodies without a material of their own use it">Use as default</button></div>}
            </>; })()}
            {(() => { const top = evaluated.nodes[refOf(b).node], made = top && 'made' in top ? top.made : undefined, t = made?.command === 'fastener' ? fastenerThread(made.values) : null;
              return t ? <><div className="kv">Part <b>{fastenerName(made!.values)}</b></div><div className="kv">Thread <b>M{t.d}×{t.pitch} {t.hand} · {t.internal ? 'internal' : 'external'}</b></div><div className="kv muted">Cosmetic thread: no helical geometry; nominal ISO sizes — check the standard before manufacture.</div></> : null; })()}
            {b.centroid && <div className="kv">Centre of mass <b>{b.centroid.map(v => fmt(Math.round(v * 100) / 100)).join(', ')}</b></div>}
            {(() => { const own = MATERIALS.find(m => m.id === materialIdOf(doc, b)) ?? density, mp = bodyMass(b, own.gPerCm3); if (!mp) return null;
              const I = inertiaAt === 'origin' ? inertiaAbout(mp.inertia, mp.massG, mp.centroid, [0, 0, 0]) : mp.inertia;
              return <>
                <label className="kv"><span>Inertia</span><select aria-label="Inertia about" value={inertiaAt} onChange={e => setInertiaAt(e.target.value as 'centre' | 'origin')}><option value="centre">about the centre of mass</option><option value="origin">about the origin</option></select></label>
                <div className="kv inertia" aria-label="Moments of inertia">Ixx Iyy Izz <b>{[0, 1, 2].map(k => sig3(I[k][k])).join(' · ')} kg·mm²</b></div>
                <div className="kv inertia muted">Ixy Iyz Ixz <b>{[[0, 1], [1, 2], [0, 2]].map(([i, j]) => sig3(I[i][j], Math.max(I[0][0], I[1][1], I[2][2]))).join(' · ')}</b></div>
              </>; })()}
            {/* (The kernel's area over the exact surfaces, as mass properties; the display mesh's only where it cannot, said.) */}
            <div className="kv" title={b.areaBasis === 'display mesh' ? 'From the display mesh: the kernel could not integrate this body' : 'Over the exact surfaces'}>Surface area <b>{fmt(Math.round(b.areaMM2 ?? b.mesh.faces.reduce((t, f) => t + f.areaMM2, 0)))} mm²{b.areaBasis === 'display mesh' ? ' (mesh)' : ''}</b></div>
            <div className="kv">Faces <b>{b.mesh.faces.length}</b></div>
            {b.notes?.map((n, k) => <div key={k} className={'hint' + (n.warning ? ' warn' : ' muted')} aria-label="Generator note">{n.warning && <Icon name="warning" small />} {n.text}</div>)}
            {b.sheet && <div className="kv"><span>K <b>{b.sheet.bendTable ? `bend table ${b.sheet.bendTable}` : b.sheet.kFactor}</b></span><label className="ghost small" data-tip="Bend table" data-tip-desc="Load your shop's bend table (JSON: rows of thickness, radius and angle to K, allowance or deduction, each citing a source or marked an estimate) for this sheet's bends">Bend table…<input type="file" accept=".json,application/json" aria-label="Bend table file" style={{ display: 'none' }} onChange={e => { const file = e.currentTarget.files?.[0]; e.currentTarget.value = ''; void loadBendTable(b, file); }} /></label></div>}
            {b.flat && <div className="kv"><span>Flat pattern <b>{fmt(Math.round(b.flat.box.max[0] * 100) / 100)} × {fmt(Math.round(b.flat.box.max[1] * 100) / 100)}</b></span><button className="ghost small" aria-label="Show the flat pattern" data-tip="Flat pattern" data-tip-desc="The sheet unfolded: its outline, bend lines and notes; export it as DXF" onClick={() => setFlatView(b.key)}>Flat</button></div>}
            {b.cutPiece && <div className="kv"><span>Cut list <b>{fmt(Math.round(b.cutPiece.axisLengthMM * 100) / 100)} mm</b></span><button className="ghost small" aria-label="Show the cut list" data-tip="Cut list" data-tip-desc="The frame's members to cut: identical ones on a row, their lengths, end cuts and mass; export it as CSV" onClick={() => setCutListView(true)}>Cut list</button></div>}
            <PointTest mesh={b.mesh} />
            {b.pieces && <div className="kv"><span>Pieces <b>{b.pieces}</b></span><button className="ghost small" aria-label="Separate the pieces" data-tip="Separate" data-tip-desc="Make each piece a body of its own (to move, colour or cut on its own)" onClick={() => separate(b)}>Separate</button></div>}
          </div>; })}
          {selBodies.length > 1 && (() => { const parts = selBodies.flatMap(b => { const m = bodyMass(b, (MATERIALS.find(x => x.id === materialIdOf(doc, b)) ?? density).gPerCm3); return m ? [m] : []; }), c = combined(parts), box = boxOf(selBodies);
            return c && box ? <><div className="kv">Together <b>{fmt(Math.round(c.massG * 10) / 10)} g</b></div><div className="kv">Centre of mass <b>{c.centroid.map(v => fmt(Math.round(v * 100) / 100)).join(', ')}</b></div>
              <div className="kv">Bounds <b>{[0, 1, 2].map(k => fmt(Math.round((box.max[k] - box.min[k]) * 100) / 100)).join(' × ')}</b></div></> : null; })()}
        </>}
        {!sel1 && !selBodies.length && bodies.length > 0 && fresh && !sketch && (() => { const parts = bodies.flatMap(b => { const m = bodyMass(b, (MATERIALS.find(x => x.id === materialIdOf(doc, b)) ?? density).gPerCm3); return m ? [m] : []; }), c = combined(parts), box = boxOf(bodies);
          return c && box ? <div className="part-summary"><div className="card-title">PART · {bodies.length} {bodies.length === 1 ? 'body' : 'bodies'}</div>
            <div className="kv">Mass <b>{fmt(Math.round(c.massG * 10) / 10)} g</b></div><div className="kv">Centre of mass <b>{c.centroid.map(v => fmt(Math.round(v * 100) / 100)).join(', ')}</b></div>
            <label className="kv"><span>Bounds <b>{[0, 1, 2].map(k => fmt(Math.round((box.max[k] - box.min[k]) * 100) / 100)).join(' × ')}</b></span><span className="kv-check"><input type="checkbox" aria-label="Show the bounding box" checked={showBox} onChange={e => setShowBox(e.target.checked)} /> box</span></label></div> : null; })()}
        {!sel1 && !selBodies.length && <div className="empty">Click a face or edge; Shift-click adds more of the same (edges to round, faces to open). For a Boolean, Shift-click a second body in the Outliner.</div>}
        {editNode !== null && <NodeEditor nodes={doc.nodes} parameters={doc.parameters} onRefuse={m => setToast({ title: 'Cannot bind that value', hint: m, detail: '' })} index={editNode} onEditSketch={(() => { const n = doc.nodes[editNode]; const s = n?.kind === 'sketch' ? editNode : n && 'sketch' in n ? n.sketch : null; return s !== null && doc.nodes[s]?.kind === 'sketch' ? () => editSketch(s) : undefined; })()} onApply={nodes => {
          const next = { ...doc, nodes: dropStaleMade(doc.nodes, nodes) };
          engine.evaluate(prefixDoc(next, marker ?? next.nodes.length), revision.current++).then(r => { if (!r) return; if (r.ok) commit(next); else setToast(r.error); });
        }} onDelete={() => deleteNode(editNode)} onClose={() => setEditNode(null)} />}
      </aside>}
      </div>

      {drawing && <Suspense fallback={null}><DrawingWorkspace engine={engine} doc={{ ...evaluated, instances: doc.instances }} bodies={bodies} settings={doc.drawing ?? defaultDrawing()} fileName={fileName} onChange={commitDrawing} onToast={setToast} /></Suspense>}

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
      {!sketch && !active && !rendering && (refMarks.length > 0 || refProblems.length > 0) && <aside className="card refs" aria-label="References">
        <div className="card-title">REFERENCES <span className="muted">{[refMarks.length && `${refMarks.length} matched again`, refProblems.length && `${refProblems.length} need${refProblems.length === 1 ? 's' : ''} a choice`].filter(Boolean).join(', ')}</span></div>
        {refMarks.map(m => <div key={'m' + m.index} className="ref"><span className="what">{m.where}: <b>{m.was}</b> → <b>{m.now}</b></span>
          <button className="ghost small" aria-label={`Confirm ${m.now}`} onClick={() => void settleRef(m.index)}>Confirm</button>
          <button className="ghost small" aria-label={`Pick another for ${m.was}`} onClick={() => void showRefChoices(m.index)}>Pick another</button>
          {refChoices?.index === m.index && refChoices.names.filter(n => n !== m.now).map(n => <button key={n} className="ghost small" onClick={() => void settleRef(m.index, n)}>{n}</button>)}</div>)}
        {refProblems.map(p => <div key={'p' + p.index} className="ref"><span className="what">{p.where}: <b>{p.name}</b> {p.candidates.length ? 'could be any of these' : 'is gone; pick it again on the feature'}{p.node !== null ? ' (held until then)' : ''}</span>
          {p.candidates.map(n => <button key={n} className="ghost small" aria-label={`Use ${n}`} onClick={() => void settleRef(p.index, n)}>{n}</button>)}</div>)}
      </aside>}
      {!sketch && !active && !rendering && <div className="card history" aria-label="History">
        <span className="card-title inline">HISTORY</span>
        {doc.nodes.map((n, i) => innerSteps.has(i) ? null : n.kind === 'sketch' ? (freeSketches.includes(i) ? (
          // A finished sketch no feature uses yet: click picks it as a profile (Shift adds) and opens its editor.
          <button key={i} className={'hs sketch' + (i >= markerAt ? ' rolled' : '') + (selection.sketches?.includes(i) ? ' picked' : '') + (editNode === i ? ' edit' : '')} title={`${featureLabel(n, i, doc.nodes)} · click to pick it as a profile (Shift: add) · double-click to roll back here`}
            onClick={e => { pickProfile(i, e.shiftKey); setEditNode(i); }} onDoubleClick={() => setMarker(i + 1 >= totalNodes ? null : i + 1)}
            onContextMenu={e => { e.preventDefault(); setHistoryMenu({ at: { x: e.clientX, y: e.clientY }, index: i }); }}>
            <Icon name="cad-sketch" small />{featureLabel(n, i, doc.nodes)}</button>) : null) : (
          <button key={i} className={'hs' + (i >= markerAt ? ' rolled' : '') + (editNode === i ? ' edit' : '') + (n.suppressed ? ' suppressed' : '') + (n.rematched || n.held ? ' rematched' : '')} title={`${featureLabel(n, i, doc.nodes)}${n.held ? ` (held: ${n.held})` : n.suppressed ? ' (suppressed)' : ''}${n.rematched ? ` · matched again: ${Object.entries(n.rematched).map(([now, was]) => `${was} → ${now}`).join(', ')}` : ''} · click to edit · double-click to roll back here`}
            onClick={() => { setEditNode(i); setInstanceSel([]); setDirectSel([]); assembly.cancel(); }} onDoubleClick={() => setMarker(i + 1 >= totalNodes ? null : i + 1)}
            onContextMenu={e => { e.preventDefault(); setHistoryMenu({ at: { x: e.clientX, y: e.clientY }, index: i }); }}>
            <Icon name={iconFor(n)} small />{featureLabel(n, i, doc.nodes)}</button>))}
        <button className="marker" aria-label="Roll forward to the end" title="Rollback marker · click to roll forward" onClick={() => setMarker(null)} />
        {marker !== null && <span className="muted">rolled back · {totalNodes - markerAt} hidden</span>}
      </div>}

      {stage !== null ? <div className="card work-bar" role="status" aria-label="Working"><span className="mono">Working… {stage}</span>
        <button className="ghost small" aria-label="Cancel the computation" title="Stop it: nothing changes" onClick={stopStage}>Cancel</button></div>
      : busy && slow && <div className="card work-bar" role="status" aria-label="Working"><span className="mono">Working…</span>
        <button className="ghost small" aria-label="Cancel the computation" title="Stop this computation and take the change back" onClick={cancelWork}>Cancel</button></div>}
      <div className="corner-left">
        <span className="mono muted">{busy ? (slow ? 'Working…' : 'Computing…') : `${ortho ? 'Orthographic' : 'Perspective'} · ${shownBodies.length} solid${shownBodies.length === 1 ? '' : 's'} · ${Math.round(lastMs)} ms`}<CursorReadout sink={cursorSink} /></span>
      </div>

      <div className="corner-right">
  {mapLegend && <MapLegend map={mapLegend} hover={mapHover} />}
  {(mapKind === 'parting' || mapKind === 'halves') && <MouldLegend kind={mapKind} result={mouldResult} pull={!!doc.mould?.pull} spread={mouldSpread} onSpread={setMouldSpread} />}
  {section && <SectionBar section={section} setSection={setSection} hatch={sectionHatchOn} setHatch={setSectionHatchOn} box={sectionBox} facePick={sectionFacePick} setFacePick={setSectionFacePick} onSketch={sketchSection} />}
        <div className="card views" role="group" aria-label="Views">
          {(['iso', 'top', 'front', 'right'] as const).map(v => <button key={v} onClick={() => viewport.current?.setView(v)}>{v === 'iso' ? 'Iso' : v[0].toUpperCase() + v.slice(1)}</button>)}
          <button onClick={() => viewport.current?.fit()} title="Frame all (F)"><Icon name="fit_screen" small /></button>
          <button className={section ? 'on' : ''} aria-label="Section view" data-tip="Section view" data-tip-desc="Cut the part open along a plane to see inside (the model is not changed)"
            onClick={() => { if (section) { setSection(null); return; } const zs = [...bodies, ...instancesPlaced.flatMap(i => i.bodies)].flatMap(b => [b.mesh.bounds.min[1], b.mesh.bounds.max[1]]); setSelection(emptySel); setSectionFacePick(null); setSection(axisSection({ axis: 'y', at: zs.length ? Math.round((Math.min(...zs) + Math.max(...zs))) / 2 : 0, keep: 'positive' })); }}>
            <Icon name="cad-split" small /></button>

          <button onClick={() => setOrtho(viewport.current?.toggleOrtho() ?? false)} className={ortho ? 'on' : ''}>Ortho</button>
          <button onClick={() => setAo(v => !v)} className={ao ? 'on' : ''} title="Ambient occlusion">AO</button>
          {!rendering && <button aria-label="Surface analysis" className={analysis ? 'on' : ''} data-tip={analysis === 'zebra' ? 'Zebra stripes' : analysis === 'curvature' ? 'Curvature map' : 'Surface analysis'}
            data-tip-desc="Click: zebra stripes (a bend or break in a stripe is a joint that is not smooth), then the curvature map (flat blue, tight red), then — for a printing process — the overhang map (red past its limit), then off"
            onClick={() => setAnalysis(a => a === null ? 'zebra' : a === 'zebra' ? 'curvature' : a === 'curvature' && printing ? 'overhang' : null)}>{analysis === 'zebra' ? 'Zebra' : analysis === 'curvature' ? 'Curv' : analysis === 'overhang' ? 'Overhang' : 'Analyse'}</button>}
          {!rendering && <button aria-label="Analysis map" className={mapKind ? 'on' : ''} data-tip="Analysis map" data-tip-desc="Click: the wall thickness (thin red, nominal green, thick orange, past the thick-section limit purple); for a part with a pull, its draft (under the least draft red, + green, − blue, the isoclines white); the share a 3-axis mill does not reach (red); for a part with a pull, its parting line, then its two halves (spread apart from the legend); then off — each legend shows the value under the pointer"
            onClick={() => { setMapHover(null); setMouldSpread(0); const pull = !!doc.mould?.pull; setMapKind(k => k === null ? 'thickness' : k === 'thickness' ? (pull ? 'draft' : 'access') : k === 'draft' ? 'access' : k === 'access' ? (pull ? 'parting' : null) : k === 'parting' ? 'halves' : null); }}>{mapKind === 'thickness' ? 'Thickness' : mapKind === 'draft' ? 'Draft' : mapKind === 'access' ? 'Access' : mapKind === 'parting' ? 'Parting' : mapKind === 'halves' ? 'Halves' : 'Maps'}</button>}
          <button onClick={() => setTheme(v => v === 'dark' ? 'light' : 'dark')} title="Toggle light / dark" aria-label="Toggle light or dark theme"><Icon name={theme === 'dark' ? 'light_mode' : 'dark_mode'} small /></button>
        </div>
        {(doc.instances?.length ?? 0) > 0 && <button className={'chip snap' + (explode ? ' on' : '')} aria-label="Explode" data-tip="Exploded view" data-tip-desc="Spread the parts out from the middle to see how they go together (display only): click for more, then off"
          onClick={() => setExplode(e => [0, 0.5, 1, 2][([0, 0.5, 1, 2].indexOf(e) + 1) % 4])}><Icon name="open_with" small />{explode ? `Explode ×${explode}` : 'Explode'}</button>}
        <button className="chip snap" aria-label="Selection filter" data-tip="Selection filter" data-tip-desc="What a click picks: anything, or only faces, edges or whole bodies (click for the next)"
          onClick={() => setPickFilter(f => { const all = ['all', 'face', 'edge', 'body'] as const, n = all[(all.indexOf(f) + 1) % all.length]; try { localStorage.setItem('studio.pick', n); } catch { /* private mode */ } return n; })}>
          <Icon name="ads_click" small />{({ all: 'Pick all', face: 'Faces', edge: 'Edges', body: 'Bodies' } as const)[pickFilter]}</button>
        <button className="chip snap" aria-label="Snap" data-tip="Grid snap" data-tip-desc="Sketch points, placing and moves land on this step: click for the next (1, 0.5, 0.1, 5, 10 mm, off)"
          onClick={() => setSnapStep(s => { const steps = [1, 0.5, 0.1, 5, 10, 0], n = steps[(steps.indexOf(s) + 1) % steps.length]; try { localStorage.setItem('studio.snap', String(n)); } catch { /* private mode */ } return n; })}>
          <Icon name="adjust" small />{snapStep ? `Snap ${fmt(snapStep)} mm` : 'Snap off'}</button>
        <span className="chip mono">mm</span>
      </div>

      {chat && !rendering && !drawing && <Suspense fallback={null}><ChatPanel base={() => prefixDoc(doc, marker ?? doc.nodes.length)} evaluate={d => engine.part(d, revision.current++, 'agent').then(r => r.ok ? r.bodies : null)} check={partEval}
        blocked={sketch ? 'Finish or leave the sketch to chat.' : active ? `Apply or cancel ${active.cmd.label} to chat.` : null}
        onPreview={setPreviewBodies} onCommit={(next, sel, merged) => {
          chatSelection.current = sel ?? null;
          // (Merged onto the edits made while it ran, O133: what applied, and what waits as a proposal and why.)
          if (merged) {
            commit(next, true, true);
            const n = merged.applied.length + merged.deferred.length, why = merged.deferred[0]?.reason;
            setToast({ title: 'Chat turn merged with your edits', hint: `${merged.applied.length} of ${n} change${n > 1 ? 's' : ''} applied${merged.proposal ? `; ${merged.deferred.length} wait${merged.deferred.length > 1 ? '' : 's'} as ${merged.proposal}${why ? ` (${why})` : ''}` : ''}.`, detail: '', action: { label: 'Undo', run: () => { undoNow.current(); setToast(null); } } });
            return;
          }
          // (Applied directly by the agent — at L2 only value edits — said so with an undo, D41.)
          const direct = JSON.stringify(next.nodes) !== JSON.stringify(doc.nodes) || JSON.stringify(next.parameters) !== JSON.stringify(doc.parameters), what = direct ? describeChange(doc, next) : '';
          commit(next);
          if (direct) setToast({ title: 'Applied by the agent', hint: `${what[0]?.toUpperCase() ?? ''}${what.slice(1)}.`, detail: '', action: { label: 'Undo', run: () => { undoNow.current(); setToast(null); } } });
        }}
        onSelect={sel => setSelection(resolveNames(bodies, sel).selection)} onClose={() => setChat(false)} context={chatContext} outbox={chatOutbox} onOutboxSent={id => setChatOutbox(o => (o?.id === id ? null : o))} /></Suspense>}
      {palette && <Palette ctx={ctx} onRun={start} onClose={() => setPalette(false)} extra={PALETTE_EXTRA} />}
      {help && <ShortcutHelp onClose={() => setHelp(false)} />}
      {historyMenu && doc.nodes[historyMenu.index] && (() => {
        const i = historyMenu.index, n = doc.nodes[i], sk = n.kind === 'sketch' ? i : 'sketch' in n && typeof n.sketch === 'number' && doc.nodes[n.sketch]?.kind === 'sketch' ? n.sketch : null;
        return <ContextMenu at={historyMenu.at} title={featureLabel(n, i, doc.nodes).toUpperCase()} ctx={ctx} commands={false} onClose={() => setHistoryMenu(null)} onRun={() => {}}
          actions={[
            { label: 'Edit', icon: 'edit', run: () => { setEditNode(i); setInstanceSel([]); setDirectSel([]); } },
            ...(sk !== null ? [{ label: 'Edit sketch', icon: 'cad-sketch', run: () => editSketch(sk) }, { label: 'Export sketch DXF', icon: 'download', run: () => exportSketchDxf(sk) }] : []),
            ...(n.kind === 'skeleton' ? [{ label: 'Edit in 3D sketch', icon: 'polyline', run: () => { cancel(); skel.begin(i); setSelection(emptySel); setEditNode(null); } }] : []),
            // (A split's halves are separate bodies the model refers to: it stays.)
            ...(n.kind !== 'sketch' && n.kind !== 'split' && n.kind !== 'separate' ? [{ label: n.suppressed ? 'Unsuppress' : 'Suppress', icon: n.suppressed ? 'visibility' : 'visibility_off', run: () => toggleSuppress(i) }] : []),
            { label: 'Move earlier', icon: 'arrow_back', run: () => reorder(i, -1) },
            { label: 'Move later', icon: 'arrow_forward', run: () => reorder(i, 1) },
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

      {cutListView && (() => { const list = partCutList(doc, bodies, material); return list ? <CutListDialog list={list} nesting={nestCutList(doc, list)} name={fileName.replace(/[^\w.-]+/g, '_')} onClose={() => setCutListView(false)} /> : null; })()}
      {flatView && (() => { const fb = bodies.find(x => x.key === flatView); return fb?.flat ? <FlatPatternDialog flat={fb.flat} name={`${fileName}-${bodyName(doc, fb)}`.replace(/[^\w.-]+/g, '_')} onClose={() => setFlatView(null)} /> : null; })()}
      {meshAsk && meshInUnit && <div className="toast card recovery" role="dialog" aria-label="Mesh units">
        <Icon name="straighten" className="accent" />
        <div><div className="toast-title">Open {meshAsk.name}.{meshAsk.format.toLowerCase()}: in what unit?</div>
          <div className="toast-hint">{meshAsk.format} files carry no unit. In {meshAsk.unit} it is {meshInUnit.size.map(fmt).join(' × ')} mm.</div>
          <div className="row-actions">
            <select aria-label="Mesh unit" value={meshAsk.unit} onChange={e => setMeshAsk(m => m && { ...m, unit: e.target.value as MeshUnit })}>
              {MESH_UNITS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
            </select>
            <button className="primary" onClick={() => void openMesh()}>Open</button>
            <button className="ghost" onClick={() => setMeshAsk(null)}>Cancel</button>
          </div></div>
      </div>}
      {stepAsk && (() => {
        const last = (() => { try { return localStorage.getItem('studio.stepMeshes'); } catch { return null; } })() ?? 'auto';
        return <div className="toast card recovery" role="dialog" aria-label="STEP mesh bodies">
          <Icon name="deployed_code_update" className="accent" />
          <div><div className="toast-title">Mesh bodies in the STEP file as…</div>
            <div className="toast-hint">Tessellated (AP242) is compact, but older CAD, CAM and slicer readers may not take it. Planar faces are read by any reader, but large. Auto: planar up to {MESH_PLANAR_TRIANGLES.toLocaleString('en-US')} triangles a body, tessellated above.</div>
            <div className="row-actions">
              {(['auto', 'tessellated', 'planar'] as const).map(m => <button key={m} className={m === last ? 'primary' : 'ghost'} onClick={() => void exportStepFile(m)}>{m === 'auto' ? 'Auto' : m === 'tessellated' ? 'Tessellated (AP242, compact)' : 'Planar faces (compatible)'}</button>)}
              <button className="ghost" onClick={() => setStepAsk(false)}>Cancel</button>
            </div></div>
        </div>;
      })()}
      {repairAsk && <MeshRepairPanel title={repairAsk.mode === 'import' ? `Open ${repairAsk.name}${repairAsk.format ? `.${repairAsk.format.toLowerCase()}` : ''}: it needs repair` : `Repair of ${repairAsk.name}`}
        diagnosis={repairAsk.diagnosis} steps={repairAsk.steps} onSteps={steps => setRepairAsk(a => a && { ...a, steps, result: null })} report={repairAsk.result?.report ?? null} busy={stage !== null}
        onCheck={() => void checkRepair()} onApply={() => void applyRepair()}
        {...(repairAsk.diagnosis.closed ? { onAsIs: repairAsk.mode === 'import' ? () => void openMeshNode(repairAsk) : removeRepair } : {})}
        asIsLabel={repairAsk.mode === 'import' ? 'Open as it is' : 'Remove the repair'} onCancel={() => setRepairAsk(null)} />}
      {recovery && <div className="toast card recovery" role="dialog" aria-label="Recover unsaved work">
        <Icon name="history" className="accent" />
        <div><div className="toast-title">Unsaved work from {new Date(recovery.savedAt).toLocaleString()}</div>
          <div className="toast-hint">“{recovery.fileName}” was not saved. Restore it, or discard the copy.</div>
          <div className="row-actions">
            <button className="primary" onClick={async () => {
              const missing = await loadRecoveryBlobs(recovery.doc);
              if (missing.length) { setToast({ title: 'Could not restore', hint: `The copy's mesh data is gone from this browser (${missing.length} array${missing.length > 1 ? 's' : ''}). Open the mesh file again.`, detail: '' }); clearRecovery(); setRecovery(null); return; }
              commit(recovery.doc); setFileName(recovery.fileName); setRecovery(null); setTimeout(() => viewport.current?.fit(), 300);
            }}>Restore</button>
            <button className="ghost" onClick={() => { clearRecovery(); setRecovery(null); void collectRecoveryBlobs(null); }}>Discard</button>
          </div></div>
      </div>}
      {cascade && <div className="toast card recovery" role="dialog" aria-label="Delete with dependents">
        <Icon name="account_tree" className="accent" />
        <div><div className="toast-title">Delete {cascade.label} and what is built on it?</div>
          <div className="toast-hint">{cascade.deps.length === 1 ? 'This feature uses it and goes too' : `These ${cascade.deps.length} features use it and go too`}: {cascade.deps.join(', ')}. Undo restores them.</div>
          <div className="row-actions">
            <button className="primary" onClick={deleteCascade}>Delete {cascade.deps.length + 1}</button>
            <button className="ghost" onClick={() => setCascade(null)}>Cancel</button>
          </div></div>
      </div>}
      {toast && !cascade && !recovery && !meshAsk && !repairAsk && !stepAsk && <div className="toast card" role="alert">
        <Icon name="info" className="accent" />
        <div><div className="toast-title">{toast.title}</div><div className="toast-hint">{toast.hint}</div>
          {toast.detail && <details><summary>Details</summary><code>{toast.detail}</code></details>}
          {toast.action && <div className="row-actions"><button className="ghost" onClick={toast.action.run}>{toast.action.label}</button></div>}</div>
        <button className="tool" aria-label="Dismiss" onClick={() => setToast(null)}><Icon name="close" small /></button>
      </div>}
    </div>
  );
}

/** Densities in g/cm³ for the mass shown with a body. */

/** A feature's icon in the history: the CAD icon of the command that makes it (a shape's own). */
function iconFor(n: ModelNode) {
  if ('made' in n && n.made) return 'cad-' + n.made.command;
  return ({ extrude: 'cad-extrude', revolve: 'cad-revolve', shell: 'cad-shell', import: 'file_open', sweep: 'cad-sweep', loft: 'cad-loft', hole: 'cad-hole', chamfer: 'cad-chamfer', fillet: 'cad-fillet', union: 'cad-union', difference: 'cad-subtract', intersect: 'cad-intersect',
    translate: 'cad-move', rotate: 'cad-rotate', mirror: 'cad-mirror', scale: 'cad-scale', 'linear-pattern': 'cad-pattern-linear', 'circular-pattern': 'cad-pattern-circular', split: 'cad-split', sketch: 'cad-sketch', 'sheet-base': 'cad-sheet-plate', 'sheet-contour': 'cad-sheet-profile', 'sheet-flange': 'cad-sheet-flange', 'sheet-corner-relief': 'cad-sheet-corner', 'frame-member': 'cad-frame-member', frame: 'cad-frame' } as Record<string, string>)[n.kind] ?? 'category';
}

/** A point tried against a body: inside, outside or on it. */
function PointTest({ mesh }: { mesh: BodyResult['mesh'] }) {
  const [p, setP] = useState<[number, number, number]>([0, 0, 0]), [res, setRes] = useState<string | null>(null);
  useEffect(() => setRes(null), [mesh, p]);
  return <div className="point-test">
    <div className="kv"><span>Point test</span><span className="pt-xyz">{(['X', 'Y', 'Z'] as const).map((a, k) => <input key={a} type="number" step="any" aria-label={`Point ${a}`} value={p[k]} onChange={e => { const v = Number(e.target.value); if (Number.isFinite(v)) setP(q => q.map((x, j) => j === k ? v : x) as typeof q); }} onKeyDown={e => e.stopPropagation()} />)}
      <button className="ghost small" aria-label="Test the point" onClick={() => setRes(pointInBody(mesh, p))}>Test</button></span></div>
    {res && <div className="kv"><span /><b aria-label="Point is">{res === 'inside' ? 'inside the body' : res === 'outside' ? 'outside the body' : 'on its surface'}</b></div>}
  </div>;
}

function NodeEditor({ nodes, index, onApply, onClose, onEditSketch, onDelete, parameters, onRefuse }: { nodes: ModelNode[]; index: number; onApply(nodes: ModelNode[]): void; onClose(): void; onEditSketch?(): void; onDelete(): void; parameters: Record<string, number>; onRefuse(message: string): void }) {
  // The draft is the whole node list: a sketch dimension changes the sketch the feature is made from.
  const [draft, setDraft] = useState<ModelNode[]>(nodes);
  // What is typed in a number box until it reads as a number (so a box can be cleared and retyped).
  const [typed, setTyped] = useState<Record<string, string>>({});
  useEffect(() => { setDraft(nodes); setTyped({}); }, [nodes, index]);
  const fields = editFields(draft, index, parameters).filter(f => f.kind !== 'number' || !Number.isNaN(f.get(draft)));
  const names = Object.keys(parameters);
  const changed = draft !== nodes;
  return (
    <div className="node-editor" onKeyDown={e => { if (e.key === 'Enter' && changed) onApply(draft); else if (e.key === 'Escape') onClose(); else if (e.key === 'Delete' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement)) onDelete(); }}>
      <div className="card-title" style={{ marginTop: 10 }}>EDIT FEATURE <button className="tool tiny" aria-label="Close editor" onClick={onClose}><Icon name="close" small /></button></div>
      {onEditSketch && <button className="ghost" aria-label="Edit sketch" title="Reopen the sketch this feature is made from, with its constraints" onClick={onEditSketch}><Icon name="draw" small /> Edit sketch</button>}
      {fields.length ? fields.map(f => (
        <label key={f.key} className="field"><span>{f.label}</span>
          {f.kind === 'number' ? <span className="num"><input type="number" step="any" aria-label={f.label} value={typed[f.key] ?? f.get(draft)} disabled={!!(f as BindableField).param?.(draft)} onChange={e => { const t = e.target.value, v = Number(t); setTyped(m => ({ ...m, [f.key]: t })); if (t.trim() !== '' && Number.isFinite(v)) setDraft(d => f.set(d, v)); }} />{f.unit && <em>{f.unit}</em>}
            {names.length > 0 && 'bind' in f && <select className="param-bind" aria-label={`${f.label} parameter`} data-tip="Parameter" data-tip-desc="Bind this value to a named parameter (Parameters panel)" value={(f as BindableField).param(draft) ?? ''}
              onChange={e => { const b = f as BindableField, name = e.target.value; if (!name) { setDraft(d => b.set(d, b.get(d))); return; } const next = b.bind(draft, name); if (next) { setDraft(next); setTyped(m => Object.fromEntries(Object.entries(m).filter(([k]) => k !== f.key))); } else onRefuse(`${f.label} is not stored as it is shown, so it cannot take a parameter.`); }}>
              <option value="">ƒ</option>{names.map(n => <option key={n} value={n}>{n}</option>)}</select>}</span>
            : f.kind === 'choice' ? <select aria-label={f.label} value={f.get(draft)} onChange={e => setDraft(d => f.set(d, e.target.value))}>{f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
            : <input type="checkbox" className="check" aria-label={f.label} checked={f.get(draft)} onChange={e => setDraft(d => f.set(d, e.target.checked))} />}
        </label>
      )) : <div className="empty">This feature has no editable dimensions.</div>}
      <button className="ghost danger" aria-label="Delete feature" title="Delete this feature (and the sketch only it uses) · Undo restores it" onClick={onDelete}><Icon name="delete" small /> Delete feature</button>
      {fields.length > 0 && <div className="row-actions"><button className="primary" disabled={!changed} onClick={() => onApply(draft)}>Apply</button><button className="ghost" disabled={!changed} onClick={() => { setDraft(nodes); setTyped({}); }}>Reset</button></div>}
    </div>
  );
}
