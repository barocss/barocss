import { revokePersonRowFiles, isPersonRowFiles, type PersonRowFiles } from '@barocss/cad-model/engine/rowFiles';
import { Fragment, Profiler, Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';
import { EngineClient, type ProposalOverlay } from './engine/client';
import { PROPOSAL_ADDED, PROPOSAL_REMOVED, type DisplayMode, type DisplayModeStatus } from './viewport/renderer';
import { multiply } from '@barocss/gpu/viewer';
import { resolveAssociativeSketch } from '@barocss/cad-model/engine/part';
import { placedDoc, type PartInstance } from '@barocss/cad-model/engine/doc';
import { placementOf } from '@barocss/cad-model/engine/placement';
import { instanceEvaluationCurrent, instanceEvaluationSources } from './viewport/instanceEvaluation';
import { contentKey, evaluationKey } from '@barocss/cad-model/engine/evalMemo';
import type { BearingAssemblyInput } from '@barocss/cad-model/engine/bearingContext';
import { bearingEditCurrent, bearingFaceInput, captureBearingEditSession, prepareBearingEdit, type BearingEditSession } from './app/bearingEdit';
import { resolveSkeletons, SKELETON_CODES } from '@barocss/cad-model/frames/skeleton';
import { carryOver, dropStaleMade, emptyDoc, featureLabel, fmt, parentsOf, prefixDoc, starterDoc, withNode, type MeshRepairRecord, type ModelNode, type Side, type SketchNode, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { bodyKeyFor, bodyNodeOf, cutAfter, featureId, nextSerial } from '@barocss/cad-model/engine/ids';
import { MATERIALS } from '@barocss/cad-model/library/materials';
import { checkSpec, expectedOf, modelHash } from '@barocss/cad-model/chat/spec';
import type { Outcome } from '@barocss/cad-model/engine/schema/spec';
import { rejectProposal, stripHistory } from '@barocss/cad-model/chat/proposals';
import type { Proposal } from '@barocss/cad-model/engine/schema/proposals';
import type { ProposalPart } from '@barocss/cad-model/chat/tools';
import { candidatesFor, captureSignatures, confirmReference, markedReferences, referencesOf, refreshSignatures, verifyReferences, type Problem as RefProblem } from '@barocss/cad-model/engine/references';
import { matchesNativeMassPatch } from '@barocss/cad-model/engine/nativeMassWire';
import { evaluateDoc, placedMassFields, type BodyResult, type EvalResult } from '@barocss/cad-model/engine/evaluate';
import { signaturesOf, type Signature } from '@barocss/cad-model/engine/rematch';
import type { DrawingReferenceLabel, DrawingReferencePreview } from './ui/DrawingWorkspace';
import type { FriendlyError } from '@barocss/cad-model/engine/errors';
import type { Vec3 } from '@barocss/cad-model/engine/mesh';
import { carrySelection, commands, patchValues, refOf, selectedBodies, shownFields, subdNodeOf, type Command, type Ctx, type Selection, type Values } from '@barocss/cad-model/app/commands';
import { measureBetween, measureItem, pointInBody, type MeasurePick } from '@barocss/cad-model/app/measure';
import { editFields } from '@barocss/cad-model/app/editFields';
import { DRAG_TYPE, snapshotInstanceIsolation, type FeatureHandle, type Spot, type SketchAnchor, type SketchShape, type SketchState, type SketchTool, type TransformGizmo, type ViewportHandle } from './viewport/Viewport';
import { ClearancePanel } from './viewport/ClearancePanel';
import { useClearanceAnalysis } from './viewport/useClearanceAnalysis';
import { PrintPanel } from './viewport/PrintPanel';
import { CamPanel } from './viewport/CamPanel';
import { AnalysisPanel } from './viewport/AnalysisPanel';
import { Button } from '@/components/ui/button';
import { ToolIconButton } from '@/components/ui/tool-button';
import { Input } from '@/components/ui/input';
import { useGpuAccessMaps } from './viewport/useGpuMaps';
import { countRender, onBlockRender } from './devRenders';
import { OutlinerInstances } from './ui/OutlinerInstances';
import { poseKinematics, useJoints } from './state/useJoints';
import { draftPath, pathLimits, refuseMotionSweep, timedMotion } from './state/motion';
import { motionOf, timedPathOf } from '@barocss/cad-model/robot/motion';
import { createValueStore, useStoreValue } from './state/valueStore';
import { SceneViewport } from './viewport/SceneViewport';
import { JointsPanelLive } from './ui/JointsPanelLive';
import { GravityExperimentPanel } from './ui/GravityExperimentPanel';
import { ExplodeButton } from './ui/ExplodeButton';
import { useScenePoses } from './state/useScenePoses';
import { CommandButtons, CommandStrip, commandStates } from './ui/ToolButton';
import { useDrawingSheet } from './ui/useDrawingSheet';
import { pmiSelection } from './viewport/pmiGeometry';
import { useCamPreview } from './viewport/camPreview';
import type { CamOptions } from './viewport/camDisplay';
import { usePrintLayers, type PrintOptions } from './viewport/usePrintLayers';
import { printOptionsOf, printSourceMeshes, withPrintPreviewSettings, type PrintPreviewPatch } from './viewport/printSettings';
import { checkDocumentPrintPreview } from '@barocss/cad-model/engine/printPreview';
import { firstProblem, isRefusal, refusal } from '@barocss/cad-model/engine/refusal';
import { Icon, Kbd } from './ui/atoms';
import { FlatPatternDialog } from './ui/FlatPatternDialog';
import { CutListDialog } from './ui/CutListDialog';
import { ToolsTray } from './ui/ToolsTray';
import { BomPanel, bomHasLinkedHousing } from './ui/BomPanel';
import { RebuildPanel, rebuildStoreOf } from './ui/RebuildPanel';
import { useVariants } from './state/useVariants';
import { VariantsPanel } from './ui/VariantsPanel';
// (CG6: a project — a folder or one kept in this browser — its documents' versions and branches: src/storage/.)
import { useProject } from './storage/useProject';
import { VersionsPanel } from './storage/VersionsPanel';
import { linkSource } from './storage/linked';
import { partCutList } from '@barocss/cad-model/app/cutList';
import { nestCutList } from '@barocss/cad-model/frames/nesting';
import { Hud } from './ui/Hud';
import { Palette } from './ui/Palette';
import { ContextMenu } from './ui/ContextMenu';
import { ShortcutHelp } from './ui/ShortcutHelp';
import { SketchPanel } from './ui/SketchPanel';
import { Timeline } from './ui/Timeline';
import { clearRecovery, keepRecovery, offerRecovery, settleRecovery, type Recovery } from './app/recovery';
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
import { RouteBundlePanel, type RouteBundleCreateDraft, type RouteBundlePanelProps } from './ui/RouteBundlePanel';
import { assertRouteBundleDocument, createRouteBundle, detachRouteBundle, moveRouteBundle, routeBundleDocumentIdentity } from '@barocss/cad-model/engine/routeBundle';
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
import { jointTreeOf } from '@barocss/cad-model/robot/joints';
import { treeInertia } from '@barocss/cad-model/robot/inertia';
import { linkMasses } from '@barocss/cad-model/robot/dynamics';
import { exportUrdf } from '@barocss/cad-model/robot/urdf';
import { exportMjcf, type MjcfClosure } from '@barocss/cad-model/robot/mjcf';
import { sweepLinks } from '@barocss/cad-model/robot/sweep';
import { sweepTimed } from '@barocss/cad-model/robot/ccd';
import { workspaceMap } from '@barocss/cad-model/robot/workspace';
import { Lanes } from './engine/lanes';
import { exportSdf } from '@barocss/cad-model/robot/sdf';
import { exportUsd } from '@barocss/cad-model/robot/usd';
import { closureOfDoc } from '@barocss/cad-model/robot/loop';
import { writeZip } from '@barocss/cad-model/io/zip';
import { useAssembly } from './assembly/useAssembly';
import { pickedSketches, planeOf, profileRings, unusedSketches } from '@barocss/cad-model/app/profiles';
import { fastenerName, fastenerThread } from '@barocss/cad-model/app/fasteners';
import { addedHoles, holeGroup, holeRegions, type ToolRegion } from '@barocss/cad-model/app/holeRegion';
import { threadLines, threadsOf } from '@barocss/cad-model/app/threads';
import { fastenerSizesOf } from '@barocss/cad-model/engine/fastenerSizeRows';
import { sourceBytes, sourceRecord } from '@barocss/cad-model/team/source';
import type { Analysis } from './viewport/analysis';
import { poseMatrix } from './viewport/instancePose';
import { asSection, axisSection, exactBodies, hatchSpacing, planeFromFace, sectionHatch, sectionPlanes, sectionSplits, sectionedBodies, type AxisSection, type Section } from './viewport/sectionView';
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
import { applyBrief, briefMaterial, confirmField, readBrief } from '@barocss/cad-model/chat/brief';
import type { BriefKey } from '@barocss/cad-model/engine/schema/brief';
import { BriefPanel } from './ui/BriefPanel';
import { SpecifyPanel } from './ui/SpecifyPanel';
import { ReferencesPanel } from './ui/ReferencesPanel';
import { checkKeepouts, placeReference, readReferences, referenceLocal, runReferenceTool, withKeepout } from '@barocss/cad-model/chat/references';
import type { KeepoutResult, Placement } from '@barocss/cad-model/engine/schema/references';
import { acceptAssumptions, answerBatch } from '@barocss/cad-model/chat/questions';
import { confirmDimension, draftWarning, liveDrafts, runDraftTool } from '@barocss/cad-model/chat/drafts';
import { DraftsPanel } from './ui/DraftsPanel';
import { extrudeProfile } from '@barocss/cad-model/app/profileCommands';
import { editCommand, featureOfPick } from '@barocss/cad-model/app/editCommand';
import { flattenAssembly } from '@barocss/cad-model/engine/flatten';
import { acceptRevision, dismissRevision, freshPartId, makeIndependent, offerRevision, revisionOf, sharing } from '@barocss/cad-model/assembly/definitions';
import { alignMove, gizmoAxes, movedInstance, previewMatrix, turnedInstance, type InstanceDrag } from '@barocss/cad-model/assembly/drag';
import { BASE, type Mate } from '@barocss/cad-model/assembly/mates';
import type { DirectGeometry } from '@barocss/cad-model/engine/direct';
import { directNow, loadDirect } from '@barocss/cad-model/engine/directModule';
import { stepLengthUnit } from '@barocss/cad-model/engine/stepUnits';
import { FACET_EXPLODE_TRIANGLES, FACET_PREVIEW_TRIANGLES, MESH_UNITS, meshInMM, readMeshFile, type MeshUnit } from '@barocss/cad-model/engine/meshImport';
import { circleCurve, curvesSource, edgeCurve, outlineCurve } from '@barocss/cad-model/engine/curveSource';
import { BUILT_IN, removeTemplate, saveTemplate, savedTemplates } from './app/templates';
import { ROBOT_SAMPLES, robotSampleFile } from './app/samples';
import { bodyMass, combined, inertiaAbout, sig3 } from '@barocss/cad-model/app/mass';
import { boundsOf } from '@barocss/cad-model/engine/bounds';
import { defaultRender, offsetsAt, readRender, type RenderCamera, type RenderSettings } from '@barocss/cad-model/engine/render';
import { downloadBytes, lumpStls, meshToStl } from './ui/files';
import { useBottomRow, HISTORY_LEFT, HISTORY_LEFT_RAIL } from './ui/useBottomRow';
import { useFitChips } from './ui/useFitChips';
import { useLayout } from './layout/useLayout';
import { ChatColumn, columnShown } from './layout/ChatColumn';
import { Dock } from './layout/Dock';
import { PreviewSection, type PreviewMode } from './layout/PreviewSection';
import { CHAT_DEFAULT, CHAT_STRIP } from './layout/useLayout';
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
/** O11: whether a change touches anything of the document but its variability (fields compared as objects: an edit makes new ones). */
function changesBeyondVariability(a: StudioDoc, b: StudioDoc): boolean {
  const x = a as unknown as Record<string, unknown>, y = b as unknown as Record<string, unknown>;
  for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) if (k !== 'variability' && x[k] !== y[k]) return true;
  return false;
}
type MassFields = Pick<BodyResult, 'volume' | 'mass' | 'centroid' | 'inertia' | 'volumeBasis'>;
type ReferenceLabelOwner = { doc: StudioDoc; model: StudioDoc };
/** What Open reads, said when it is given another kind of file. */
const OPEN_READS = 'Open reads models (.bcad, .json), STEP (.step, .stp), STL, OBJ, IGES (.igs, .iges) and .barocad curve and surface sources. Your part is unchanged.';
/** O18: the same bodies to draw — each key and mesh as before (only masses may differ). */
function sameMeshes(a: readonly BodyResult[], b: readonly BodyResult[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i].mesh !== b[i].mesh || a[i].key !== b[i].key) return false;
  return true;
}
/** O18: bodies with the masses that came for their refs (placed by their massPlace); the same array when none did. */
function withMasses(bodies: BodyResult[], got: ReadonlyMap<number, MassFields>): BodyResult[] {
  let out: BodyResult[] | null = null;
  for (let i = 0; i < bodies.length; i++) {
    const b = bodies[i], f = b.massRef !== undefined ? got.get(b.massRef) : undefined; if (!f || !matchesNativeMassPatch(b, f)) continue;
    const { massRef: _ref, massPlace, ...rest } = b; void _ref;
    (out ??= bodies.slice())[i] = { ...rest, ...placedMassFields(f, massPlace ?? []) };
  }
  return out ?? bodies;
}
/** A mesh's content, cheaply (its counts, its bounds and a weighted sum of its positions), once a mesh: the ghost's
 *  "the same body as before" — by its key and this, as the volume told it before masses came after the reply (O18). */
const meshSigs = new WeakMap<object, string>();
function meshSig(m: BodyResult['mesh']): string {
  let sig = meshSigs.get(m);
  if (sig === undefined) {
    let sum = 0; const p = m.positions;
    for (let i = 0; i < p.length; i++) sum += p[i] * ((i % 7) + 1);
    sig = `${p.length}:${m.indices.length}:${Math.round(sum * 1e3)}`; meshSigs.set(m, sig);
  }
  return sig;
}
/** Where the Browser mounts (G12b): the dock's top section, or the stage's left as before. */
const BROWSER_PLACEMENT = 'dock' as 'dock' | 'left';

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
const NO_INSTANCES: PartInstance[] = [];
// (The rail's groups and the shapes strip's commands, made once: the button lists compare them by identity.)
const TOOL_GROUPS = ['create', 'modify', 'pattern', 'combine', 'inspect'] as const;
const GROUP_COMMANDS = TOOL_GROUPS.map(g => commands.filter(c => c.group === g && !c.place));
const PLACE_COMMANDS = commands.filter(c => c.place);
/** What a command is about to add, in its preview. */
const PREVIEW_TINT = '#7fb2f0';
/** A history entry's time, local and short (as stored, if not a time). */
const whenOf = (at: string) => { const d = new Date(at); return Number.isNaN(d.getTime()) ? at : d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }); };

/** `placing`: a new shape that follows the pointer until a click (or a drop from the rail) stands it there. */
interface Active { cmd: Command; values: Values; preview: 'busy' | 'ok' | 'error'; error?: FriendlyError; ctx: Ctx; placing?: boolean }
/** Stable numbers for objects (a command's context, its values), for the App's subscription key. */
const objectIds = new WeakMap<object, number>();
let nextObjectId = 0;
const idOf = (o: object) => { let id = objectIds.get(o); if (id === undefined) { id = ++nextObjectId; objectIds.set(o, id); } return id; };
/**
 * What of the running command the App renders for (R1d): its start and end, its command, context and placing — and its
 * values, unless the HUD typed them (`typed`, the values its last keystroke made) or the pointer is placing the shape. The
 * preview's state and error are the HUD's; a typed or placed value's preview renders the App once, with its result.
 */
const activeKey = (a: Active | null, typed: Values | null) =>
  a ? `${a.cmd.id}|${idOf(a.ctx)}|${a.placing ? 1 : 0}|${a.placing || a.values === typed ? '' : idOf(a.values)}` : '';

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
const CAD_DISPLAY_MODES: { value: DisplayMode; label: string }[] = [
  { value: 'shaded-with-edges', label: 'Shaded with edges' },
  { value: 'hidden-lines-removed', label: 'Hidden lines removed' },
  { value: 'hidden-lines-dashed', label: 'Hidden lines dashed' },
  { value: 'wireframe', label: 'Wireframe' },
  { value: 'x-ray', label: 'X-ray' },
];

const detachSketchLink = (s: SketchState): SketchState => s.association ? { ...s, association: undefined, associationDetached: true } : s;

type RouteBundleSession = {
  token: number; accepted: StudioDoc; acceptedIdentity: string;
  frozenStart: StudioDoc; frozenIdentity: string; bindings: string; bundleId: string;
  gesture: number; pointerId: number | null; sequence: number;
  purpose: 'draft' | 'preview' | 'final' | 'ready' | 'cancelled';
  delta: Vec3; gestureBase: Vec3;
  ready?: { candidate: StudioDoc; identity: string; evaluatedIdentity: string; result: Extract<EvalResult, { ok: true }>; sequence: number; gesture: number; pointerId: number | null };
};
// Optional GPU bridge contract; the GPU owner supplies these fields in the shared viewport.
type RouteTransformGizmo = TransformGizmo & {
  sessionKey: string;
  onStart(pointerId: number): void;
  onCancel(pointerId: number, reason: 'pointercancel' | 'lostpointercapture' | 'session-change' | 'unmount'): void;
  onMove(delta: Vec3, done: boolean, pointerId?: number): void;
};
const routeBindings = (doc: StudioDoc) => JSON.stringify(doc.routeBundles?.map(b => ({ id: b.id, tie: b.tie, members: b.members })) ?? []);
const routeNumbers = (values: [string, string, string]): Vec3 => {
  if (values.some(v => !v.trim() || !Number.isFinite(Number(v)))) throw new Error('Enter three finite coordinates in mm.');
  return values.map(Number) as Vec3;
};
const routeMessage = (error: unknown) => error && typeof error === 'object' && 'message' in error ? String(error.message) : String(error);

export function App() {
  countRender('App');
  const engine = useMemo(() => new EngineClient(), []);
  const viewport = useRef<ViewportHandle>(null);
  // (The bottom row: the view bar measured, the history bar beside it or stacked above it.)
  const cornerRight = useRef<HTMLDivElement>(null), [stripWidth, setStripWidth] = useState(0), [historyNatural, setHistoryNatural] = useState(0);
  const bottomRow = useBottomRow(cornerRight, stripWidth, BROWSER_PLACEMENT === 'dock' ? HISTORY_LEFT_RAIL : HISTORY_LEFT, historyNatural);
  const [doc, setDocState] = useState<StudioDoc>(starterDoc);
  // (O11: one guard where every edit of the document lands. While a variant is shown, a change of anything but the
  // document's variability is refused — said as start() says it — and the undo entry it asked for dropped; a whole
  // document (opened, new) is always taken. Undo, redo and the system's own updates write the state directly.)
  const docNow = useRef(doc); docNow.current = doc;
  const discardRouteRef = useRef<() => void>(() => {});
  const routeAcceptedHandoff = useRef<{ doc: StudioDoc; identity: string; evaluatedIdentity: string; revision: number; result: Extract<EvalResult, { ok: true }> } | null>(null);
  const shownVariant = useRef<string | null>(null), undoFor = useRef<{ doc: StudioDoc; marker: number | null } | null>(null);
  const setDoc = (next: StudioDoc, whole = false) => {
    const entry = undoFor.current; undoFor.current = null;
    if (!whole && shownVariant.current && changesBeyondVariability(docNow.current, next)) { setToast({ title: 'Can’t change the part now', hint: `Showing ${shownVariant.current}: show the master to edit.`, detail: '' }); return; }
    if (next !== docNow.current) discardRouteRef.current();
    if (routeAcceptedHandoff.current?.doc !== next) routeAcceptedHandoff.current = null;
    if (entry) { setUndo(u => [...u.slice(-49), entry]); setRedo([]); }
    docNow.current = next; setDocState(next);
  };
  const [marker, setMarker] = useState<number | null>(null);
  const [undo, setUndo] = useState<{ doc: StudioDoc; marker: number | null }[]>([]);
  const [redo, setRedo] = useState<{ doc: StudioDoc; marker: number | null }[]>([]);
  const [bodies, setBodies] = useState<BodyResult[]>([]);
  // The evaluated document the bodies were computed for: while a newer one evaluates (or fails), the bodies are
  // stale, and nothing pairs them with the newer document's names, facts or checks.
  const [bodiesFor, setBodiesFor] = useState<StudioDoc | null>(null);
  // Parameter candidates use the normal evaluation lane before the accepted document changes.
  const parameterRequest = useRef(0);
  const [parameterEdit, setParameterEdit] = useState<{ request: number; base: StudioDoc; baseInput: StudioDoc; input: StudioDoc; next: StudioDoc; accept(next: StudioDoc): void } | null>(null);
  const acceptedEvaluation = useRef<{ key: string; result: Extract<EvalResult, { ok: true }> } | null>(null);
  // Only a parameter transition may hand a result to the next effect once; ordinary evaluations still run.
  const parameterHandoff = useRef<{ target: StudioDoc; key: string; result: Extract<EvalResult, { ok: true }> } | null>(null);
  const parameterMass = useRef<{ request: number; result: Extract<EvalResult, { ok: true }>; target?: StudioDoc; installedFor?: StudioDoc } | null>(null);
  /** Bodies set at once for the commit about to happen (a command's preview, an emptied part): claimed by its document. */
  const claimBodies = useRef(false);
  const [busy, setBusy] = useState(true);
  const [selection, setSelection] = useState<Selection>(emptySel);
  const [pick, setPick] = useState<Vec3 | null>(null);
  // (R1d: the running command outside React state — see activeKey. The HUD subscribes to all of it.)
  const activeStore = useMemo(() => createValueStore<Active | null>(null), []), setActive = activeStore.set;
  const hudValues = useRef<Values | null>(null);
  useSyncExternalStore(activeStore.subscribe, () => activeKey(activeStore.get(), hudValues.current));
  const active = activeStore.get();
  const [previewBodies, setPreviewBodies] = useState<BodyResult[] | null>(null);
  /**
   * A Move or Rotate gizmo drag: the body follows at once by this matrix on the evaluated part; once let
   * go it stays until the preview of the values arrives (`settling`).
   */
  const [bodyDrag, setBodyDrag] = useState<{ matrix: Float64Array; settling: boolean } | null>(null);
  const previewFor = useRef<string | null>(null);
  const [sketch, setSketchState] = useState<SketchState | null>(null);
  // Invalidate an in-flight linked Finish before a queued sketch change renders (including Cancel).
  const sketchGeneration = useRef(0);
  const setSketch = useCallback((next: Parameters<typeof setSketchState>[0]) => { sketchGeneration.current++; setSketchState(next); }, []);
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
  const [instanceBodies, setInstanceBodies] = useState<Map<string, { key: string; sourceKey: string; inst: PartInstance; bodies: BodyResult[] }>>(new Map());
  // O18 (P): the worker replies without the bodies' masses and posts them after, by mass ref; each body still waiting
  // gets its own B-rep's (placed by its massPlace) — never another revision's, whose B-rep has its own ref.
  useEffect(() => engine.onMasses(masses => {
    const got = new Map(masses.map(m => [m.ref, m.fields]));
    // Retain candidate patches during reference refresh and the handoff to the accepted bodies.
    // withMasses applies the existing exact native-source/ref/field guard to both copies.
    if (parameterMass.current) parameterMass.current.result.bodies = withMasses(parameterMass.current.result.bodies, got);
    const ready = routeSession.current?.ready;
    if (ready) ready.result.bodies = withMasses(ready.result.bodies, got);
    if (routeAcceptedHandoff.current) routeAcceptedHandoff.current.result.bodies = withMasses(routeAcceptedHandoff.current.result.bodies, got);
    setRoutePreviewBodies(bs => bs && withMasses(bs, got));
    setBodies(bs => withMasses(bs, got));
    setInstanceBodies(map => { let next: typeof map | null = null; for (const [id, e] of map) { const bs = withMasses(e.bodies, got); if (bs !== e.bodies) (next ??= new Map(map)).set(id, { ...e, bodies: bs }); } return next ?? map; });
  }), [engine]);
  const massReady = useMemo(() => !bodies.some(b => b.massRef !== undefined) && ![...instanceBodies.values()].some(e => e.bodies.some(b => b.massRef !== undefined)), [bodies, instanceBodies]);
  const instanceRun = useRef(0);
  const partInput = useRef<HTMLInputElement>(null);
  /** Selected direct curves and surfaces (by object id). */
  const [directSel, setDirectSel] = useState<string[]>([]);
  const [routePanelOpen, setRoutePanelOpen] = useState(false);
  const [routeCreate, setRouteCreate] = useState<RouteBundleCreateDraft>({ id: 'bundle1', tieId: 'tie1', anchorMM: ['0', '0', '0'], members: [
    { curveObjectId: '', handleKey: '1', sweepFeatureId: '' }, { curveObjectId: '', handleKey: '1', sweepFeatureId: '' },
  ] });
  const [routeMove, setRouteMove] = useState<[string, string, string]>(['0', '0', '0']);
  const [routeSelected, setRouteSelected] = useState<string | null>(null);
  const [routePhase, setRoutePhase] = useState<RouteBundlePanelProps['phase']>('idle');
  const [routeError, setRouteError] = useState<RouteBundlePanelProps['error']>();
  const [routeViewDoc, setRouteViewDoc] = useState<StudioDoc | null>(null);
  const [routeVisualDoc, setRouteVisualDoc] = useState<StudioDoc | null>(null);
  const [routePreviewBodies, setRoutePreviewBodies] = useState<BodyResult[] | null>(null);
  const routeSession = useRef<RouteBundleSession | null>(null), routeToken = useRef(0);
  const routeContext = useRef({ blocked: true });
  const routePreviewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearRouteTimer = () => { if (routePreviewTimer.current !== null) clearTimeout(routePreviewTimer.current); routePreviewTimer.current = null; };
  const discardRoute = () => {
    clearRouteTimer(); routeToken.current++;
    if (routeSession.current) { routeSession.current.purpose = 'cancelled'; routeSession.current.sequence++; }
    routeSession.current = null;
    setRouteViewDoc(null); setRouteVisualDoc(null); setRoutePreviewBodies(null);
    setRoutePhase('idle'); setRouteError(undefined); setRouteMove(['0', '0', '0']);
  };
  discardRouteRef.current = discardRoute;
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
    setSketchError(r.error); setSketch(s => s && { ...(JSON.stringify(s.shape) === JSON.stringify(r.shape) && !keep ? s : detachSketchLink(s)), shape: r.shape, ...(keep ? { done: joinOpen([...(s.done ?? []), keep]) } : {}) });
  }, [setSketch]);
  useEffect(() => { if (!sketch) { setSketchError(null); sketchHistory.current.clear(); } }, [sketch]);
  const [palette, setPalette] = useState(false);
  // (G12a: the chat column's open state and width, kept per viewer; collapsed when the window narrows past what fits.)
  const layout = useLayout(), chat = layout.chatOpen, setChat = layout.setChatOpen;
  // Closing chat keeps pending approvals usable; a new conversation explicitly clears/revokes this ref.
  const chatRowFiles = useRef<PersonRowFiles | undefined>(undefined);
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
  const [referencePreview, setReferencePreview] = useState<DrawingReferencePreview | null>(null);
  const [referenceLabelCache, setReferenceLabelCache] = useState<{ owner: ReferenceLabelOwner; labels: readonly DrawingReferenceLabel[] } | null>(null);
  useEffect(() => { setReferencePreview(null); }, [doc]);
  const [fileName, setFileName] = useState('Bracket-01');
  // (Counts whole-document replacements: the drawing workspace's selection, drafts and notices belong to one document.)
  const [docGeneration, setDocGeneration] = useState(0);
  const [dirty, setDirty] = useState(false);
  /** Unsaved work kept from an earlier visit, offered back once. */
  // (The copy offered is set aside until answered: this session's copies do not write over it, O-log flow-39 note.)
  const [recovery, setRecovery] = useState<Recovery | null>(() => offerRecovery());
  // Keep a recovery copy a moment after each change while unsaved; none once saved. When the browser cannot keep it
  // (the document too large for its storage, or storage refused), the older copy is removed and that is said once for
  // the document (until a copy is written again).
  const recoveryOff = useRef<string | null>(null);
  // (CG6: with a project open and the document saved in it, the work is kept in the project instead: storage/project.ts.)
  const project = useProject({
    onOpened: (d, path, notes) => { replaceDoc(d, true); setFileName(path.replace(/\.bcad$/i, '').split('/').pop()!); setDirty(notes.length > 0); setTimeout(() => viewport.current?.fit(), 300); },
    onError: (title, hint) => setToast({ title, hint, detail: '' }),
    onLinked: l => {
      if (l.offered.length) commitParts(l.doc);
      setToast({ title: l.offered.length ? `Newer files for ${l.offered.length} placed part${l.offered.length > 1 ? 's' : ''}` : 'Placed parts without their files',
        hint: [l.offered.length ? `${l.offered.join(', ')}: Revision waiting in the part's panel (Accept or Keep).` : '', l.missing.length ? `Not in the project any more: ${l.missing.join(', ')}.` : ''].filter(Boolean).join(' '), detail: '' });
    },
  });
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [compareBase, setCompareBase] = useState<{ id: string; doc: StudioDoc } | null>(null);
  const [compareOverlay, setCompareOverlay] = useState<ProposalOverlay | null>(null);
  useEffect(() => { void project.loadRecent(); }, []);
  useEffect(() => {
    if (!dirty) return;
    if (project.view.part) { const t = setTimeout(() => void project.autosave(doc), 800); return () => clearTimeout(t); }
    // (A mesh's blobs to IndexedDB beside it: the localStorage copy names them, M1.)
    // (O9, REVIEW-A1: the blobs stored before the copy that names them, keepRecovery; none written once overtaken or saved.)
    let live = true;
    const t = setTimeout(() => void keepRecovery(fileName, doc, saveRecoveryBlobs, () => live).then(kept => {
      if (kept === 'overtaken') return;
      if (kept === 'ok') { recoveryOff.current = null; return; }
      if (recoveryOff.current === fileName) return;
      recoveryOff.current = fileName;
      setToast(kept === 'too-large'
        ? { title: 'Crash recovery is off for this document', hint: 'It is too large for this browser\'s storage, so no recovery copy is kept. Save to keep your work.', detail: '' }
        : { title: 'No recovery copy', hint: 'This browser does not keep one (private browsing, or its storage is full). Save to keep your work.', detail: '' });
    }), 800);
    return () => { live = false; clearTimeout(t); };
  }, [doc, fileName, dirty, project.view.part]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  const [ortho, setOrtho] = useState(false);
  // Session appearance only: no document, history, recovery or analysis input changes.
  const [displayMode, setDisplayMode] = useState<DisplayMode>('shaded-with-edges');
  // (G12c: the previews one at a time — CNC, print layers, clearance or the analysis maps — a choice, not toggles that
  // refuse each other. The dock's switch chooses it, G12e.)
  const [previewMode, setPreviewMode] = useState<PreviewMode>('none');
  const clearanceEnabled = previewMode === 'clearance';
  const [clearanceNear, setClearanceNear] = useState(1);
  const printEnabled = previewMode === 'print';
  // (G23 CNC: the material-removal preview, session only.)
  const camEnabled = previewMode === 'cnc';
  const [camOptions, setCamOptions] = useState<CamOptions>({ setup: 0, progress: 0, cellPitch: 0.5 });
  // (G24: the drawing's annotations on the model, session only, and the one picked.)
  const [pmiEnabled, setPmiEnabled] = useState(false);
  const [pmiSelected, setPmiSelected] = useState<string | null>(null);
  // (The display mode, isolate and the previews' toggles, in a popover over the Views row: open only when asked.)
  const [displayOpen, setDisplayOpen] = useState(false);
  const [isolatedInstances, setIsolatedInstances] = useState<readonly string[] | undefined>();
  const displayModeContext = useRef('');
  const [displayModeFailure, setDisplayModeFailure] = useState<{ requested: DisplayMode; reason: string; context: string } | null>(null);
  const onDisplayModeStatus = useCallback((status: DisplayModeStatus) => {
    if (status.supported || status.requested === 'shaded-with-edges' || !status.reason) return;
    setDisplayModeFailure(previous => previous?.requested === status.requested && previous.reason === status.reason && previous.context === displayModeContext.current
      ? previous : { requested: status.requested, reason: status.reason!, context: displayModeContext.current });
  }, []);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => { try { return (localStorage.getItem('cad-studio-theme') as 'dark' | 'light') || 'dark'; } catch { return 'dark'; } });
  /** A surface analysis look on the bodies (modelling view only). */
  const [analysis, setAnalysis] = useState<'zebra' | 'curvature' | 'overhang' | null>(null);
  // (G6: an analysis map on the bodies — IM4 wall thickness; IM2 draft and CNC access when their data lands — and its value under the pointer.)
  const [mapKind, setMapKind] = useState<MapKind | 'parting' | 'halves' | null>(null);
  // (G12c: the surface analysis and the analysis maps are the Analysis preview: turned on, they take its place; another
  // preview chosen, they go; both off, no preview is left.)
  useEffect(() => { if (analysis || mapKind) setPreviewMode('analysis'); else setPreviewMode(m => m === 'analysis' ? 'none' : m); }, [analysis, mapKind]);
  useEffect(() => { if (previewMode !== 'analysis') { setAnalysis(null); setMapKind(null); } }, [previewMode]);
  const choosePreview = useCallback((m: PreviewMode) => { setPreviewMode(m); if (m === 'analysis') setAnalysis(a => a ?? 'zebra'); }, []);
  /** The viewport's renderer (G10): the analysis maps and the mould's view are drawn on WebGPU only. */
  const [viewBackend, setViewBackend] = useState<'webgpu' | 'webgl2' | null>(null);
  const [mapHover, setMapHover] = useState<number | null>(null);
  // (G6: the mould's view for the parting and halves maps — built in the engine worker — and how far the halves are spread.)
  const [mouldResult, setMouldResult] = useState<Awaited<ReturnType<EngineClient['mould']>> | 'working' | null>(null);
  const [mouldSpread, setMouldSpread] = useState(0);
  const halvesShownRef = useRef(false);
  const [ao, setAo] = useState(true);
  const [editNode, setEditNode] = useState<number | null>(null);
  const [instanceEdit, setInstanceEdit] = useState<{ owner: string; index: number } | null>(null);
  const [instanceEditPending, setInstanceEditPending] = useState(false);
  // A changed selection invalidates a pending edit even if the user selects the same occurrence again.
  /** The O9 lanes App's worker requests go on (R4b): a reply overtaken on its lane comes back stale. */
  const lanes = useMemo(() => new Lanes(), []);
  const bearingEditScope = useRef({ doc, instanceSel, instanceEdit, editNode });
  if (bearingEditScope.current.doc !== doc || bearingEditScope.current.instanceSel !== instanceSel || bearingEditScope.current.instanceEdit !== instanceEdit || bearingEditScope.current.editNode !== editNode) bearingEditScope.current = { doc, instanceSel, instanceEdit, editNode };
  // (R4b: the bearing edit on its O9 lane — the document, the selection or the edit changing makes a reply on it stale.)
  useEffect(() => { lanes.cancel('bearing-edit'); setInstanceEditPending(false); }, [doc, instanceSel, instanceEdit]);
  const selectedBearingEdit = useMemo(() => {
    if (!instanceEdit || instanceSel.length !== 1 || instanceSel[0] !== instanceEdit.owner) return null;
    try { return { session: captureBearingEditSession(doc, instanceEdit.owner, instanceEdit.index), error: null }; }
    catch (error) { return { session: null, error: error instanceof Error ? error.message : String(error) }; }
  }, [doc, instanceSel, instanceEdit]);
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
  /** O147: the BOM panel. */
  const [bomOpen, setBomOpen] = useState(false);
  /** O10: the Rebuild panel, and the last evaluation it reads (a store: an evaluation renders only the open panel). */
  const [rebuildOpen, setRebuildOpen] = useState(false);
  const [variantsOpen, setVariantsOpen] = useState(false);
  const rebuildStore = useMemo(rebuildStoreOf, []);
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
  // (Dev/test: the exact section held back, and the CPU's path forced, to compare the two clips through one viewer.)
  const [sectionDebug, setSectionDebug] = useState({ hold: false, cpu: false });
  // The section as committed, and the plane being dragged (R1c (3c)): a drag sets `sectionLive`, outside React state.
  // On WebGPU only SceneViewport follows it in each frame, the App once as the drag starts. On WebGL2 the App follows it,
  // as before: its CPU copies are cut again in each frame. The release commits it.
  const [committedSection, setCommittedSection] = useState<Section | null>(null);
  const sectionLive = useMemo(() => createValueStore<Section | null>(null), []);
  const cpuSectionPath = viewBackend !== 'webgpu' || sectionDebug.cpu;
  const liveSection = useStoreValue(sectionLive, !!committedSection && cpuSectionPath);
  // (On WebGPU the App takes the plane as the drag started — its exact section waits for the release; R1c (3c).)
  const [sectionDragFrom, setSectionDragFrom] = useState<Section | null>(null);
  const section = cpuSectionPath ? liveSection ?? committedSection : sectionDragFrom ?? committedSection;
  const committedSectionRef = useRef(committedSection); committedSectionRef.current = committedSection;
  /** A section set (the toggle, the bar, a face, the hooks): committed, a drag's plane with it. */
  const setSection = useCallback((next: Section | null | ((s: Section | null) => Section | null)) => {
    const base = sectionLive.get();
    setCommittedSection(prev => typeof next === 'function' ? next(base ?? prev) : next);
    sectionLive.set(null); setSectionDragFrom(null);
  }, [sectionLive]);
  /** A section handle dragged: its plane into the store at each step, the App told once as it starts; the release commits. */
  const dragSection = useCallback((f: (s: Section | null) => Section | null, done: boolean) => {
    const was = sectionLive.get(), next = f(was ?? committedSectionRef.current);
    if (done) { setSection(() => next); return; }
    if (!was) setSectionDragFrom(next);
    sectionLive.set(next);
  }, [sectionLive, setSection]);
  const [sectionFacePick, setSectionFacePick] = useState<number | null>(null);
  const sectionFacePickRef = useRef(sectionFacePick); sectionFacePickRef.current = sectionFacePick;
  const [sectionExact, setSectionExact] = useState<{ key: string; source: StudioDoc; sourceBodies: readonly BodyResult[]; bodies: BodyResult[]; from: ReadonlyMap<string, string> } | null>(null);
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
  // (Dev/test: the bodies as evaluated for the document shown — exact volumes and centroids, for checks to their tolerance.)
  useEffect(() => { if (import.meta.env.DEV) (window as unknown as { __studioBodies: () => unknown }).__studioBodies = () => ({ fresh: bodiesFor === evaluated, bodies: bodies.map(b => ({ key: b.key, volume: b.volume, centroid: b.centroid ?? null, massRef: b.massRef ?? null })), massReady, colored: shownBodies.flatMap((b, i) => bodyColors.has(i) ? [b.key] : []) }); });
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
  // (O11: what is evaluated and shown is the shown variant — the master itself unless a variant or edited values are
  // shown — regenerated from the master, which is never written by it.)
  const variants = useVariants(doc), shownDoc = variants.shown; shownVariant.current = variants.showing;
  const followsParts = shownDoc.nodes.some(n => n.kind === 'frame' && !!n.follows && 'part' in n.follows);
  const rootContextKey = useMemo(() => {
    try { return contentKey(shownDoc); }
    // A missing/hidden housing must reach the evaluator's refusal, not throw from React render.
    catch { return shownDoc; }
  }, [shownDoc]);
  const evaluated = useMemo(() => prefixDoc(shownDoc, marker ?? shownDoc.nodes.length), [shownDoc.nodes, shownDoc.parameters, shownDoc.frames?.sections, rootContextKey, followsParts ? shownDoc.instances : null, marker]);
  // Labels outlive the Drawing view, but only for the exact accepted document and displayed model.
  // Do not bind to DrawingWorkspace's spread prop: that wrapper is new on every render.
  const referenceLabelOwner = useMemo<ReferenceLabelOwner>(() => ({ doc, model: evaluated }), [doc, evaluated]);
  const referenceLabelOwnerNow = useRef(referenceLabelOwner); referenceLabelOwnerNow.current = referenceLabelOwner;
  const receiveReferenceLabels = useCallback((labels: readonly DrawingReferenceLabel[]) => {
    if (referenceLabelOwnerNow.current !== referenceLabelOwner) return;
    setReferenceLabelCache(previous => previous?.owner === referenceLabelOwner && JSON.stringify(previous.labels) === JSON.stringify(labels) ? previous : { owner: referenceLabelOwner, labels });
  }, [referenceLabelOwner]);
  const referenceLabels = referenceLabelCache?.owner === referenceLabelOwner ? referenceLabelCache.labels : [];

  const sectionRun = useRef<{ busy: boolean; next: (() => Promise<void>) | null }>({ busy: false, next: null });
  // The section: the part with each body that crosses the plane split there (the rest kept or left out whole).
  useEffect(() => {
    if (!section) { setSectionExact(null); return; }
    if (sectionDragFrom) return;
    const key = JSON.stringify(section);
    // (G19: each body split by each plane that crosses what is left of it, the kept pieces' keys.)
    const { doc, kept, from } = sectionSplits(evaluated, bodies, section);
    // Latest wins: while one section is worked out, only the newest plane waits behind it. (R4b: on the section's O9 lane —
    // a reply overtaken by a newer plane, or by the effect's cleanup, comes back stale.)
    const run = sectionRun.current;
    run.next = async () => { const at = revision.current++, reply = await lanes.run('section', { revision: at, source: key }, () => engine.section(doc, at)), r = reply.stale ? null : reply.result; if (r?.ok) { const x = exactBodies(r.bodies, kept, from); setSectionExact({ key, source: evaluated, sourceBodies: bodies, bodies: x.bodies, from: x.from }); } };
    if (!run.busy) void (async () => { run.busy = true; try { while (run.next) { const j = run.next; run.next = null; await j(); } } finally { run.busy = false; } })();
    return () => lanes.cancel('section');
  }, [section, bodies, evaluated, engine, sectionDragFrom]);
  // At once (while the plane is dragged, until the exact section arrives): on WebGPU the bodies whole, cut and capped by
  // the viewer's clip plane (G2); on WebGL2 the meshes clipped and capped on the CPU.
  const gpuSection = viewport.current?.backend === 'webgpu' && !sectionDebug.cpu;
  const sectionClipped = useMemo(() => {
    if (!section) return null;
    // (The section's first split is the next feature: its cut faces are named after the next id, engine/ids.ts.)
    return sectionedBodies(bodies, section, gpuSection, `n${nextSerial(evaluated)}.cut`);
  }, [section, bodies, evaluated, gpuSection]);
  const sectionExactShown = !!section && !sectionDragFrom && sectionExact?.key === JSON.stringify(section) && sectionExact.source === evaluated && sectionExact.sourceBodies === bodies && !sectionDebug.hold;
  const sectionBodies = section ? (sectionExactShown ? sectionExact!.bodies : sectionClipped) : null;
  const render = useMemo(() => doc.render ?? defaultRender(), [doc.render]);

  // A parameter candidate and its BRep stay together. A refusal keeps the last accepted document and bodies.
  const parameterCurrent = !parameterEdit || (parameterEdit.base === doc && parameterEdit.baseInput === evaluated && !shownVariant.current);
  useEffect(() => {
    let live = true;
    if (parameterEdit && !parameterCurrent) {
      // A display-only edit cancels the candidate without evaluating the unchanged accepted model again.
      if (parameterEdit.baseInput === evaluated && acceptedEvaluation.current) parameterHandoff.current = { target: docNow.current, ...acceptedEvaluation.current, result: { ...acceptedEvaluation.current.result, bodies: bodiesRef.current } };
      if (parameterMass.current?.request === parameterEdit.request && !parameterMass.current.target) parameterMass.current = null;
      setParameterEdit(null); return;
    }
    const edit = parameterEdit;
    const input = edit?.input ?? evaluated;
    const current = () => live && (!edit || (parameterRequest.current === edit.request && docNow.current === edit.base && evaluatedRef.current === evaluated && !shownVariant.current));
    const refuse = (detail: string) => {
      if (!edit || !current()) return;
      const accepted = acceptedEvaluation.current;
      if (accepted) parameterHandoff.current = { target: edit.base, ...accepted, result: { ...accepted.result, bodies: bodiesRef.current } };
      if (parameterMass.current?.request === edit?.request && !parameterMass.current?.target) parameterMass.current = null;
      setParameterEdit(null); setBusy(false);
      setToast({ title: 'Parameters not changed', hint: 'The accepted part and its references are unchanged.', detail });
    };
    setBusy(true);
    const run = async () => {
      const key = evaluationKey(input), handoff = !edit ? parameterHandoff.current : null;
      const routeHandoff = !edit ? routeAcceptedHandoff.current : null;
      if (!edit) { parameterHandoff.current = null; routeAcceptedHandoff.current = null; }
      // Only the exact accepted route document can consume its final result, once.
      const routeResult = routeHandoff && routeHandoff.doc === doc && marker === null && !variants.showing
        && routeHandoff.identity === routeBundleDocumentIdentity(doc) && routeHandoff.evaluatedIdentity === routeBundleDocumentIdentity(evaluated)
        && routeHandoff.result.revision === routeHandoff.revision ? routeHandoff.result : null;
      // A configuration-only parameter edit can keep the already fresh accepted result too.
      const result = edit && acceptedEvaluation.current?.key === key ? acceptedEvaluation.current.result
        : handoff?.target === docNow.current && handoff.key === key ? handoff.result : routeResult ?? await engine.evaluate(input, revision.current++);
      if (!current()) return;
      if (!result) { if (edit) refuse('The evaluation was superseded.'); else setBusy(false); return; }
      if (edit) {
        if (!result.ok) { refuse(result.error.detail || result.error.hint); return; }
        parameterMass.current = { request: edit.request, result };
        const oldNames = { faces: new Map<string, Signature>(), edges: new Map<string, Signature>() }, nextNames = { faces: new Map<string, Signature>(), edges: new Map<string, Signature>() };
        for (const [list, names] of [[bodiesRef.current, oldNames], [result.bodies, nextNames]] as const) for (const body of list) {
          const found = signaturesOf(body);
          for (const kind of ['faces', 'edges'] as const) for (const [name, signature] of found[kind]) names[kind].set(name, signature);
        }
        // Missing names are held for an explicit choice; never choose a suffix or alias here.
        for (const ref of referencesOf(edit.next, true).refs) {
          if (ref.rematched || ref.node !== null || ref.part !== undefined) continue;
          const kind = ref.edge ? 'edges' : 'faces', before = oldNames[kind].get(ref.name), after = nextNames[kind].get(ref.name);
          if (!before || !after || before.kind !== after.kind) { refuse(`The reference at ${ref.where} needs an explicit choice.`); return; }
        }
        const next = await refreshSignatures(edit.next, result.bodies, async part => {
          const partKey = evaluationKey(part);
          if (partKey === key) return result;
          if (acceptedEvaluation.current?.key === partKey) return acceptedEvaluation.current.result;
          const parent = await engine.part(part, revision.current++, 'refs');
          if (!current() || !parent?.ok) throw new Error('A reference parent could not be evaluated for this parameter change.');
          for (const ref of referencesOf(edit.next, true).refs) {
            if (ref.rematched || ref.node !== part.nodes.length || !ref.parent) continue;
            const body = parent.bodies.find(b => b.key === bodyKeyFor(edit.next.nodes, ref.parent!.node, ref.parent!.side));
            if (!body || !signaturesOf(body)[ref.edge ? 'edges' : 'faces'].has(ref.name)) throw new Error(`The reference at ${ref.where} needs an explicit choice.`);
          }
          return parent;
        });
        if (!current()) return;
        // Compute the handoff key before accepting: a failed key cannot partially commit the candidate.
        const nextKey = evaluationKey(prefixDoc(next, next.nodes.length));
        // Reuse this exact result when installing the accepted document; do not evaluate it twice.
        edit.accept(next);
        if (docNow.current === edit.base) { refuse('The parameter change was not accepted.'); return; }
        const installed = docNow.current;
        parameterHandoff.current = { target: installed, key: nextKey, result };
        if (parameterMass.current?.request === edit.request) parameterMass.current.target = installed;
        setParameterEdit(null);
        return;
      }
      setBusy(false); setLastMs(result.wallTime * 1000);
      if (result.ok) {
        acceptedEvaluation.current = { key, result };
        const prev = bodiesRef.current;
        setBodies(result.bodies); setBodiesFor(evaluated); claimBodies.current = false; rebuildStore.set({ doc: evaluated, result });
        if (handoff && parameterMass.current?.result === result && parameterMass.current.target === docNow.current) parameterMass.current.installedFor = evaluated;
        if (chatSelection.current) setSelection(resolveNames(result.bodies, chatSelection.current).selection); else setSelection(sel => carrySelection(sel, prev, result.bodies));
        if (again.current) { setRestart(again.current); again.current = null; }
        chatSelection.current = null;
      }
      else setToast(result.error);
    };
    void run().catch(cause => { if (edit) refuse(cause instanceof Error ? cause.message : String(cause)); else if (current()) { setBusy(false); setToast({ title: 'Could not evaluate the part', hint: 'The previous part remains shown.', detail: String(cause) }); } });
    return () => { live = false; };
  }, [engine, evaluated, parameterEdit, parameterCurrent]);
  // (A command's preview is what the part becomes: its bodies belong to the document it commits.)
  useEffect(() => { if (claimBodies.current) { claimBodies.current = false; setBodiesFor(evaluated); } }, [evaluated]);
  const fresh = bodiesFor === evaluated;
  useEffect(() => {
    const pending = parameterMass.current;
    if (!pending?.target) return;
    if (pending.target !== doc || (pending.installedFor && pending.installedFor !== evaluated)) { parameterMass.current = null; return; }
    // The actual accepted array is installed and no deferred patch remains to bridge.
    if (pending.installedFor === evaluated && bodiesFor === evaluated && sameMeshes(bodies, pending.result.bodies) && !bodies.some(b => b.massRef !== undefined)) parameterMass.current = null;
  }, [doc, evaluated, bodiesFor, bodies]);
  // (Tests: the bodies shown are the current document's and nothing is computing — set in the commit that changes the
  // document, so a test never reads the last document's bodies as this one's, D109.)
  useEffect(() => { if (import.meta.env.DEV) (window as unknown as { __studioFresh: boolean }).__studioFresh = fresh && !busy; }, [fresh, busy]);
  /** The document whose names and looks go with the bodies shown (the one they were computed for). */
  const namesDoc = fresh || !bodiesFor ? doc : bodiesFor;

  const bodiesRef = useRef(bodies); bodiesRef.current = bodies;
  const ctx: Ctx = { doc: evaluated, bodies, selection, pick: pick ?? undefined, direct: directSel, bearingAssembly: { root: doc, owner: 'base' } };
  const evaluatedRef = useRef(evaluated); evaluatedRef.current = evaluated;

  /** The document as it is, kept for undo (redo is gone once something new is done). */
  const pushUndo = () => { undoFor.current = { doc, marker }; };
  // (`capture`: references this change wrote were picked on the bodies shown; a whole document replaced was not.
  // `whole`: a new or opened document, nothing of the one before carried into it.)
  const commit = useCallback((next: StudioDoc, capture = true, whole = false) => {
    // Counted as the History bar shows them: sketches are part of the feature made from them.
    const nextFeatureIds = marker !== null ? new Set(next.nodes.map((_, i) => featureId(next.nodes, i))) : null;
    const dropped = marker !== null && nextFeatureIds ? doc.nodes.slice(marker).filter((n, i) => n.kind !== 'sketch' && !nextFeatureIds.has(featureId(doc.nodes, marker + i))).length : 0;
    pushUndo();
    // Commands build on the evaluated document, which follows the model only: what they leave as it was
    // there (every field but the model's own: engine/doc.ts carryOver) is the document's newest.
    const was = evaluatedRef.current;
    if (!whole) next = carryOver(next, was, doc);
    // (References written by this change get their signatures from the bodies they were picked on, engine/references.ts.)
    if (capture) next = captureSignatures(next, bodies);
    setDoc(next, whole); setMarker(null); setDirty(true); setEditNode(null);
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
  /** Saved display controls use the existing undo/document path and preserve a rollback marker. */
  const commitPrintPreview = useCallback((patch: PrintPreviewPatch) => {
    try { const next = withPrintPreviewSettings(doc, patch); pushUndo(); setDoc(next); setDirty(true); }
    catch (error) { setToast({ title: 'Print settings not changed', hint: error instanceof Error ? error.message : String(error), detail: '' }); }
  }, [doc, marker]);
  const commitPrintDirection = useCallback((direction: Vec3 | undefined) => {
    const next = { ...doc }; if (direction) next.print = { direction }; else delete next.print;
    pushUndo(); setDoc(next); setDirty(true);
  }, [doc, marker]);
  /** One undoable change of the drawing settings (the model stays). */
  const commitDrawing = useCallback((next: DrawingSettings) => {
    pushUndo();
    setDoc({ ...doc, drawing: next }); setDirty(true);
  }, [doc, marker]);
  /** One undoable change of the direct geometry (the model stays as evaluated). */
  const commitDirect = useCallback((next: DirectGeometry, select?: string[]) => {
    try { assertRouteBundleDocument({ ...doc, direct: next }); }
    catch (error) { setToast({ title: 'Direct geometry not changed', hint: `${routeMessage(error)} Detach the route bundle before editing a bound member.`, detail: '' }); return; }
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
    if (routeVisualDoc) return D.directDisplay(routeVisualDoc.direct);
    if (poleDrag && poleHere && poleObj && doc.direct) try { return D.directDisplay(D.movePole(doc.direct, poleObj, poleHere.key, poleHere.at.map((v, k) => v + poleDrag[k]))); } catch { /* shown as it was */ }
    return D.directDisplay(doc.direct);
  }, [doc.direct, poleDrag, poleHere, poleObj, D, routeVisualDoc]);
  /** One undoable change of the placed instances. */
  const commitInstances = useCallback((next: PartInstance[], select?: string[]) => {
    pushUndo();
    setDoc({ ...doc, instances: next }); setDirty(true);
    if (select) setInstanceSel(select);
  }, [doc, marker]);
  const applyInstanceBearing = async (session: BearingEditSession, nodes: ModelNode[]) => {
    const scope = bearingEditScope.current;
    if (!bearingEditCurrent(session, scope.doc, scope.instanceSel, scope.instanceEdit)) return;
    setInstanceEditPending(true);
    // (Its refusal, thrown, comes back on the lane as its result: a stale one, like a stale reply, says nothing.)
    const at = revision.current++, reply = await lanes.run('bearing-edit', { revision: at, source: session.owner }, async () => {
      try { const prepared = prepareBearingEdit(session, nodes); return { prepared, result: await engine.part(prepared.view, at) }; }
      catch (error) { return { error }; }
    });
    if (reply.stale) return;
    setInstanceEditPending(false);
    const out = reply.result, current = bearingEditScope.current;
    if ('error' in out) { if (current === scope) setToast({ title: 'Bearing not changed', hint: out.error instanceof Error ? out.error.message : String(out.error), detail: '' }); return; }
    if (current !== scope || !bearingEditCurrent(session, current.doc, current.instanceSel, current.instanceEdit)) return;
    if (!out.result.ok) { setToast(out.result.error); return; }
    commitInstances(out.prepared.root.instances!, [session.owner]);
    setInstanceEdit(null);
  };
  // Evaluate each instance whose placed part changed (in the worker, beside the main part).
  const instanceSources = useMemo(() => instanceEvaluationSources(shownDoc), [shownDoc]);
  useEffect(() => {
    // (R4b: each placed part on its own O9 lane, `placed:<id>`; this run's lanes cancelled by its cleanup, so a reply from
    // a document since replaced comes back stale and the run stops, setting nothing.)
    const asked = (shownDoc.instances ?? []).map(i => `placed:${i.id}`);
    (async () => {
      const next = new Map<string, { key: string; sourceKey: string; inst: PartInstance; bodies: BodyResult[] }>();
      for (const inst of shownDoc.instances ?? []) {
        const source = instanceSources.get(inst.id);
        if (!source?.ok) { setToast({ title: 'The placed part could not be evaluated', hint: source && !source.ok ? source.error : 'Missing part context.', detail: '' }); continue; }
        // The same placement of the same part (objects are replaced on edit, so by reference first; a new
        // object only when its content changed, compared then).
        const have = instanceBodies.get(inst.id);
        if (have && have.sourceKey === source.key && samePlacement(have.inst, inst)) { next.set(inst.id, have.inst === inst ? have : { ...have, inst }); continue; }
        const at = revision.current++, reply = await lanes.run(`placed:${inst.id}`, { revision: at, source: source.key }, () => engine.placed(placedDoc(inst, shownDoc), source.base, placementOf(inst), at));
        if (reply.stale) return;
        const r = reply.result;
        if (r.ok) next.set(inst.id, { key: `${inst.id}#${++instanceRun.current}`, sourceKey: source.key, inst, bodies: r.bodies });
        else setToast(r.error);
      }
      setInstanceBodies(next);
    })();
    return () => { for (const lane of asked) lanes.cancel(lane); };
  }, [shownDoc.instances, instanceSources]);
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
  const readLinkedFaces = useCallback(async (owner: string, input: StudioDoc) => {
    const result = await engine.part(bearingFaceInput(doc, owner, input), revision.current++, 'read');
    return result.ok ? result.faceTable ?? null : null;
  }, [doc, engine]);
  const assembly = useAssembly({ doc, evaluated, bodies, instanceBodies, setDoc: setDocState, commit: commitAssembly, readFaces: bomHasLinkedHousing(doc) ? readLinkedFaces : undefined });
  // The assembly as a robot (RM1): its joint tree from the solved instances, the faces read, the parts' gears.
  const jointTree = useMemo(() => !doc.mates?.length || !doc.instances?.length ? null : jointTreeOf(doc, { instances: doc.instances, problems: assembly.problems }, p => assembly.tables.get(p),
    p => (p === BASE ? bodies : instanceBodies.get(p)?.bodies ?? []).flatMap(b => (b.gear ? [b.gear] : []))), [doc, assembly.problems, assembly.tables, bodies, instanceBodies]);
  // (Every placed part evaluated with its bodies: until then the robot's masses, exports and sweeps wait, RM6 — a part
  // not yet evaluated is not massless.)
  const robotReady = fresh && !busy && massReady && (doc.instances ?? []).every(i => instanceEvaluationCurrent(instanceBodies.get(i.id), i, instanceSources.get(i.id)));
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
  // (R1c (3b): the App follows the pose and the explode factor in each frame only where it uses them itself — a CPU
  // section's copies, the clearance check; elsewhere SceneViewport and the Joints card do, not the App.)
  const posesInApp = clearanceEnabled || (!!section && !sketch && !gpuSection);
  const loopMotionContext = useMemo(() => jointTree?.loops.length ? { doc, tree: jointTree } : undefined, [doc, jointTree]);
  const reportMotionError = useCallback((error: unknown) => {
    setToast({ title: 'Motion refused', hint: error instanceof Error ? error.message : String(error), detail: '' });
  }, [setToast]);
  const { poseStore, jointInputStore, readJointInputs, setJointValues, jointPlaying, setJointPlaying, pathCheck, setPathCheck, jointWaypoints, setJointWaypoints, workspace, setWorkspace, jointFk,
    motionTime, motion, motionPlaying, setMotionPlaying, motionLoop, setMotionLoop, motionSpeed, setMotionSpeed, playMotion, scrubMotion, stopMotion, motionContact, setMotionContact, contactShown,
    motionChoice, setMotionChoice, freezeMotion, showMotionAt } = useJoints(jointTree, posesInApp, doc.robot?.motions, loopMotionContext, reportMotionError);
  // (RS2: the saved motion chosen, its length before it plays — timed once per choice.)
  const chosenMotion = useMemo<{ duration?: number; problem?: string }>(() => {
    const m = motionChoice === null || !jointTree ? undefined : doc.robot?.motions?.find(x => x.name === motionChoice);
    try { return m && jointTree ? { duration: timedMotion(timedPathOf(jointTree, m.path), loopMotionContext).duration } : {}; }
    catch (error) { return { problem: error instanceof Error ? error.message : String(error) }; }
  }, [motionChoice, jointTree, doc.robot?.motions, loopMotionContext]);
  // (RS2: a motion frozen is swept once, as Check path sweeps — the links as placed — for its first contact: the time of
  // impact and the two links, tinted from that time on as it plays.)
  useEffect(() => {
    if (!motion || !jointTree || !robotReady) { setMotionContact(null); return; }
    try {
      refuseMotionSweep(jointTree);
      const links = sweepLinks(jointTree, p => p === BASE ? bodies : instanceBodies.get(p)?.bodies, pts => convexHull(pts).positions);
      const r = sweepTimed(jointTree, links, motion.path);
      setMotionContact(r.toi !== undefined && r.links ? { toi: r.toi, links: r.links } : null);
    } catch (error) {
      setMotionContact(null); setToast({ title: 'Motion contact check refused', hint: error instanceof Error ? error.message : String(error), detail: '' });
    }
  }, [motion, jointTree, robotReady, bodies, instanceBodies, setMotionContact, setToast]);
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
  // (Each with its placement, as the bodies were placed: copies of one tessellation share a geometry in the viewer, G10.)
  // The exploded view (display only): each instance pushed out from the middle by the explode factor.
  const explodeStore = useMemo(() => createValueStore(0), []);
  const explode = useStoreValue(explodeStore, posesInApp), setExplode = explodeStore.set;
  // (Whether it is exploded, followed always: the instance gizmo is not offered then.)
  const exploded = useSyncExternalStore(explodeStore.subscribe, () => explodeStore.get() !== 0);
  // (Dev/bench: any explode factor, as a drag would set it frame by frame; the button steps 0, 0.5, 1, 2.)
  useEffect(() => { if (import.meta.env.DEV) (window as unknown as { __studioSetExplode: (k: number) => void }).__studioSetExplode = setExplode; }, []);
  const [instDrag, setInstDrag] = useState<{ id: string; drag: InstanceDrag; settling: boolean; key: string } | null>(null);
  // (R1c (3a): the placed parts as they are shown — placed, posed, exploded, dragged and sectioned.)
  const { instancesPlaced, instancePoseMap, cpuInstanceSection, instancesShown } = useScenePoses(doc, instanceBodies, bodies, jointFk, explode, section, sketch, gpuSection, instDrag);
  // (`source`: what the instance names as its file — CG6: `./<path>` for a project document, storage/linked.ts.)
  const insertPart = async (file: File, source = file.name) => {
    try {
      const read = await readStudioFile(new Uint8Array(await file.arrayBuffer()));
      if ('error' in read) throw new Error(read.error);
      const parsed = read.doc;
      if (parsed.schema === 4 || Object.prototype.hasOwnProperty.call(parsed, 'routeBundles')) throw refusal('BAD_REFERENCE', 'Route bundle: inserting a linked route document as a part is not supported. Detach the bundle first.');
      const list = doc.instances ?? [], used = new Set(list.map(i => i.id));
      let n = 1; while (used.has(`inst${n}`)) n++;
      // Placed to the right of everything shown.
      const right = Math.max(0, ...bodies.map(b => b.mesh.bounds.max[0]), ...[...instanceBodies.values()].flatMap(v => v.bodies.map(b => b.mesh.bounds.max[0])));
      const inst: PartInstance = { id: `inst${n}`, name: file.name.replace(/\.(bcad|json)$/i, ''), doc: { ...parsed, render: undefined, direct: undefined }, position: [Math.ceil(right + 20), 0, 0], rotation: [0, 0, 0], part: { id: freshPartId(doc), rev: revisionOf(parsed), source } };
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
  // (By body key; put on the bodies shown — in a section the kept ones and the exact section's pieces, each moved as
  // its body is: G19.5 — further down.)
  const animatedAt = useMemo(() => !rendering || !Object.keys(render.animation.tracks).length ? null : offsetsAt(render.animation, time), [rendering, render.animation, time]);
  // (RS2's recorder: a video of the motion at its own timing, or of the Render workspace's animation over its duration.)
  const [videoBusy, setVideoBusy] = useState(false);
  const recordVideo = async (seconds: number, draw: (t: number) => void, name: string) => {
    if (!viewport.current || !(seconds > 0) || videoBusy) return;
    setVideoBusy(true);
    try {
      const FPS = 30, n = Math.ceil(seconds * FPS) + 1;
      const blob = await viewport.current.recordVideo(n, FPS, i => draw(Math.min(seconds, i / FPS)));
      downloadBytes(new Uint8Array(await blob.arrayBuffer()), name, 'video/webm');
    } catch (e) { setToast({ title: 'Could not record a video', hint: e instanceof Error ? e.message : String(e), detail: '' }); }
    finally { setVideoBusy(false); }
  };
  const exportImage = async () => {
    const png = await viewport.current?.capture();
    if (png) downloadBytes(new Uint8Array(await png.arrayBuffer()), `${fileName}.png`, 'image/png');
    else setToast({ title: 'Could not export an image', hint: 'Rendering needs a browser with WebGPU.', detail: '' });
  };

  const cancel = useCallback(() => { discardRouteRef.current(); setActive(null); setPreviewBodies(null); setSketch(null); }, [setSketch]);

  // A bundle session owns a frozen document. Preview and final replies never replace accepted bodies.
  const routeCurrent = (session: RouteBundleSession) => {
    if (routeSession.current !== session || session.token !== routeToken.current || session.purpose === 'cancelled' || routeContext.current.blocked || !!activeStore.get()) return false;
    try {
      return docNow.current === session.accepted && routeBundleDocumentIdentity(docNow.current) === session.acceptedIdentity
        && routeBundleDocumentIdentity(session.frozenStart) === session.frozenIdentity && routeBindings(session.frozenStart) === session.bindings;
    } catch { return false; }
  };
  const routeFail = (error: unknown) => {
    clearRouteTimer();
    const session = routeSession.current;
    if (session) { session.sequence++; session.ready = undefined; session.purpose = 'draft'; }
    const friendly = error && typeof error === 'object'
      && 'title' in error && typeof error.title === 'string'
      && 'hint' in error && typeof error.hint === 'string'
      && 'detail' in error && typeof error.detail === 'string'
      && (!('code' in error) || error.code === undefined || typeof error.code === 'string') ? error as FriendlyError : null;
    if (friendly) setToast(friendly);
    setRoutePreviewBodies(null); setRouteVisualDoc(null); setRoutePhase('error'); setRouteError({ message: friendly ? friendly.hint || friendly.title : routeMessage(error) });
  };
  const beginRoute = (frozenStart: StudioDoc, bundleId: string, resetMove = true) => {
    const accepted = docNow.current;
    assertRouteBundleDocument(accepted); assertRouteBundleDocument(frozenStart);
    const session: RouteBundleSession = { token: ++routeToken.current, accepted, acceptedIdentity: routeBundleDocumentIdentity(accepted),
      frozenStart, frozenIdentity: routeBundleDocumentIdentity(frozenStart), bindings: routeBindings(frozenStart), bundleId,
      gesture: 0, pointerId: null, sequence: 0, purpose: 'draft', delta: [0, 0, 0], gestureBase: [0, 0, 0] };
    routeSession.current = session; setRouteViewDoc(frozenStart); setRouteSelected(bundleId);
    if (resetMove) setRouteMove(['0', '0', '0']);
    setRouteVisualDoc(null); setRoutePreviewBodies(null); setRouteError(undefined); setRoutePhase('draft');
    return session;
  };
  const routeEvaluate = async (session: RouteBundleSession, candidate: StudioDoc, final: boolean, withPreview = true) => {
    if (!routeCurrent(session)) { discardRouteRef.current(); return; }
    clearRouteTimer();
    const identity = routeBundleDocumentIdentity(candidate), evaluationDoc = prefixDoc(candidate, candidate.nodes.length);
    const evaluatedIdentity = routeBundleDocumentIdentity(evaluationDoc), sequence = ++session.sequence;
    const gesture = session.gesture, pointerId = session.pointerId;
    session.ready = undefined; session.purpose = withPreview ? 'preview' : 'final'; setRoutePhase(withPreview ? 'preview' : 'validating'); setRouteError(undefined); setRoutePreviewBodies(null); setRouteVisualDoc(candidate);
    const current = (purpose: RouteBundleSession['purpose']) => routeCurrent(session) && session.sequence === sequence && session.gesture === gesture
      && session.pointerId === pointerId && session.purpose === purpose && routeBundleDocumentIdentity(candidate) === identity;
    try {
      if (withPreview) {
        const previewRevision = revision.current++, preview = await engine.preview(evaluationDoc, previewRevision);
        if (!current('preview')) return;
        if (preview.revision !== previewRevision) throw new Error('The preview was interrupted. Preview this draft again.');
        if (!preview.ok) { routeFail(preview.error); return; }
        setRoutePreviewBodies(preview.bodies);
        if (!final) { session.purpose = 'draft'; setRoutePhase('draft'); return; }
      }
      session.purpose = 'final'; setRoutePhase('validating');
      const finalRevision = revision.current++, result = await engine.evaluate(evaluationDoc, finalRevision);
      if (!current('final')) return;
      if (!result || result.revision !== finalRevision) throw new Error('The final check was interrupted. Preview this draft again.');
      if (!result.ok) { routeFail(result.error); return; }
      session.ready = { candidate, identity, evaluatedIdentity, result, sequence, gesture, pointerId }; session.purpose = 'ready';
      setRoutePreviewBodies(result.bodies); setRoutePhase('ready');
    } catch (error) { if (current(session.purpose)) routeFail(error); }
  };
  const selectRouteBundle = (id: string) => {
    discardRouteRef.current(); setRouteSelected(id);
    if (routeContext.current.blocked) return;
    try {
      if (!docNow.current.routeBundles?.some(b => b.id === id)) throw new Error('Select a current route bundle.');
      beginRoute(JSON.parse(JSON.stringify(docNow.current)) as StudioDoc, id);
    } catch (error) { routeFail(error); }
  };
  const openRoute = () => {
    cancel(); setRoutePanelOpen(true); setPole(null); setPoleDrag(null);
    const id = docNow.current.routeBundles?.[0]?.id;
    if (id) { selectRouteBundle(id); return; }
    setRouteSelected(null);
    setRouteCreate({ id: 'bundle1', tieId: 'tie1', anchorMM: ['0', '0', '0'], members: [0, 1].map(i => ({
      curveObjectId: directSel[i] ?? '', handleKey: '1', sweepFeatureId: '',
    })) as RouteBundleCreateDraft['members'] });
  };
  const createRoute = () => {
    if (routeContext.current.blocked) return;
    try {
      const accepted = docNow.current;
      const members = routeCreate.members.map((member, index) => {
        const sweep = accepted.nodes.find(n => n.id === member.sweepFeatureId);
        if (!sweep || sweep.kind !== 'sweep-curve') throw new Error(`Member ${index + 1}: select a current copied sweep.`);
        const profile = accepted.nodes[sweep.sketch];
        if (!profile?.id) throw new Error(`Member ${index + 1}: the copied sweep needs a current profile. Reselect the curve and copied sweep.`);
        return { ...member, id: `member${index + 1}`, profileFeatureId: profile.id };
      }) as Parameters<typeof createRouteBundle>[1]['members'];
      const candidate = createRouteBundle(accepted, { id: routeCreate.id, tieId: routeCreate.tieId, anchorMM: routeNumbers(routeCreate.anchorMM), members,
        expectedDocumentIdentity: routeBundleDocumentIdentity(accepted) });
      const session = beginRoute(candidate, routeCreate.id);
      void routeEvaluate(session, candidate, false);
    } catch (error) { routeFail(error); }
  };
  const previewRoute = () => {
    if (routeContext.current.blocked || routePhase === 'validating') return;
    try {
      let session = routeSession.current;
      if (!session && routeSelected) session = beginRoute(JSON.parse(JSON.stringify(docNow.current)) as StudioDoc, routeSelected, false);
      if (!session || !routeCurrent(session)) throw new Error('Select the current bundle again. The document changed.');
      const delta = routeNumbers(routeMove);
      const candidate = moveRouteBundle(session.frozenStart, session.bundleId, delta, session.frozenIdentity);
      session.delta = delta; session.pointerId = null; session.gesture++;
      void routeEvaluate(session, candidate, true);
    } catch (error) { routeFail(error); }
  };
  const changeRouteMove = (next: [string, string, string]) => {
    clearRouteTimer();
    const session = routeSession.current;
    if (session) { session.sequence++; session.purpose = 'draft'; session.ready = undefined; session.pointerId = null; session.delta = [0, 0, 0]; }
    setRouteMove(next); setRoutePhase('draft'); setRouteError(undefined); setRouteVisualDoc(null); setRoutePreviewBodies(null);
  };
  const applyRoute = () => {
    const session = routeSession.current, ready = session?.ready;
    if (!session || !ready || !routeCurrent(session) || session.purpose !== 'ready' || ready.sequence !== session.sequence
      || ready.gesture !== session.gesture || ready.pointerId !== session.pointerId) { routeFail(new Error('Preview the current draft before applying it.')); return; }
    try {
      assertRouteBundleDocument(ready.candidate);
      if (routeBundleDocumentIdentity(ready.candidate) !== ready.identity) throw new Error('The draft changed. Preview it again.');
      const candidate = ready.candidate, id = session.bundleId;
      discardRouteRef.current();
      routeAcceptedHandoff.current = { doc: candidate, identity: ready.identity, evaluatedIdentity: ready.evaluatedIdentity, revision: ready.result.revision, result: ready.result };
      // The full candidate was evaluated against this exact accepted document; do not rebase it.
      commit(candidate, false, true); setRouteSelected(candidate.routeBundles?.some(b => b.id === id) ? id : null);
    } catch (error) { routeFail(error); }
  };
  const detachRoute = () => {
    if (routeContext.current.blocked) return;
    try {
      const id = routeSelected;
      if (!id || !docNow.current.routeBundles?.some(b => b.id === id)) { discardRouteRef.current(); return; }
      const session = beginRoute(JSON.parse(JSON.stringify(docNow.current)) as StudioDoc, id);
      const candidate = detachRouteBundle(session.frozenStart, id, session.frozenIdentity);
      void routeEvaluate(session, candidate, true);
    } catch (error) { routeFail(error); }
  };
  useEffect(() => { if (routeSession.current && routeSession.current.accepted !== doc) discardRouteRef.current(); }, [doc]);
  useEffect(() => () => { clearRouteTimer(); routeToken.current++; if (routeSession.current) routeSession.current.purpose = 'cancelled'; }, []);

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
  const bearingRootCurrent = active?.cmd.id !== 'bearing' || active.ctx.bearingAssembly?.root === doc;
  useEffect(() => {
    // (R1d: run on each change of the command's values, followed in the store — the App does not render for a value typed
    // into the HUD or placed by the pointer.)
    let seen: Values | undefined, stop: (() => void) | undefined;
    const evaluate = (active: Active | null): (() => void) | undefined => {
      if (!active?.cmd.build) return;
      if (!bearingRootCurrent) {
        setPreviewBodies(null);
        setActive(a => a && { ...a, preview: 'error', error: { title: 'Assembly changed', hint: 'Start Bearing again to use the current housing geometry.', detail: '' } });
        return;
      }
      let live = true;
      const missing = shownFields(active.cmd.fields?.(active.ctx, active.values) ?? [], active.values).find(f => f.kind !== 'choice' && (active.values[f.key] === '' || !Number.isFinite(Number(active.values[f.key]))));
      if (missing) { setPreviewBodies(null); setActive(a => a && { ...a, preview: 'error', error: { title: 'Enter a value', hint: `${missing.label} is empty.`, detail: '' } }); return; }
      const values = active.values, cmd = active.cmd, ctx = active.ctx;
      const job = async (full = false) => {
        if (!live) return;
        let candidate: StudioDoc;
        try { candidate = cmd.build!(ctx, values); } catch (e) {
          const current = activeStore.get();
          if (live && current?.cmd === cmd && current.values === values) {
            setPreviewBodies(null);
            setActive(a => a && a.cmd === cmd && a.values === values ? { ...a, preview: 'error', error: { title: 'Invalid input', hint: String(e), detail: '' } } : a);
          }
          return;
        }
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
        if (cmd.id === 'bearing' && ctx.bearingAssembly?.root !== bearingEditScope.current.doc) return;
        if (rolled && live) fullTimer.current = window.setTimeout(() => { if (!live) return; run.next = () => job(true); if (!run.busy) void pump(); }, 220);
        // A queued update can use an intermediate result, unless this command was replaced or refused.
        const current = activeStore.get();
        if (!live && (!previewRun.current.next || !current || current.cmd !== cmd || current.ctx !== ctx || current.preview === 'error')) return;
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
    };
    const follow = () => { const a = activeStore.get(); if (a?.values === seen) return; seen = a?.values; stop?.(); stop = evaluate(a); };
    follow();
    const unsubscribe = activeStore.subscribe(follow);
    return () => { unsubscribe(); stop?.(); };
  }, [active?.cmd, engine, bearingRootCurrent, activeStore]);

  /** The command to start again once what Shift-Enter applied is the part (its bodies evaluated). */
  const again = useRef<Command | null>(null);
  const [restart, setRestart] = useState<Command | null>(null);
  // Apply while the preview is still computing (just after a drag or a typed value) waits for it.
  const applyWhenReady = useRef<Command | null>(null);
  const apply = useCallback(() => {
    // (R1d: the command as it is now, its values and preview state — the App may not have rendered since they changed.)
    const active = activeStore.get();
    if (!active?.cmd.build) return;
    if (!bearingRootCurrent) { applyWhenReady.current = null; return; }
    if (active.preview === 'busy') { applyWhenReady.current = active.cmd; return; }
    applyWhenReady.current = null;
    if (active.preview !== 'ok') return;
    // The preview is what the part becomes: shown as the part at once (no step back to the old bodies
    // while the committed document evaluates).
    const next = active.cmd.build(active.ctx, active.values);
    // (Not when it places an instance: those bodies are the instance's, shown once it is evaluated.)
    if (previewBodies && (next.instances?.length ?? 0) === (active.ctx.doc.instances?.length ?? 0)) { setBodies(previewBodies); claimBodies.current = true; }
    commit(next); setActive(null); setPreviewBodies(null); setSketch(null);
  }, [activeStore, commit, previewBodies, bearingRootCurrent, setSketch]);
  // (Only for the command it was asked for: cancelled or replaced, it is forgotten. R1d: looked at after each render — a
  // preview's result renders the App with its bodies — and as the preview's state settles without one, an error.)
  useEffect(() => {
    const check = () => {
      const a = activeStore.get();
      if (applyWhenReady.current && applyWhenReady.current !== a?.cmd) applyWhenReady.current = null;
      else if (applyWhenReady.current && a?.preview === 'error') apply();
    };
    check();
    if (applyWhenReady.current && activeStore.get()?.preview === 'ok') apply();
    return activeStore.subscribe(check);
  }, [previewBodies, active?.cmd, apply, activeStore]);

  const start = useCallback((cmd: Command) => {
    discardRouteRef.current(); setRoutePanelOpen(false);
    setPalette(false); setRendering(false); setPlaying(false); setDrawing(false);
    const avail = cmd.available(ctx);
    if (!avail.ok) { setToast({ title: `${cmd.label} can’t run here`, hint: avail.reason, detail: '' }); return; }
    if (variants.showing) { setToast({ title: `${cmd.label} can’t run here`, hint: `Showing ${variants.showing}: show the master to edit.`, detail: '' }); return; }
    if (cmd.id === SKETCH3D_COMMAND.id) { cancel(); skel.begin(null); setSelection(emptySel); setEditNode(null); return; }
    if (cmd.action === 'sketch') {
      // On a selected flat face (horizontal or vertical), joined to its body by default; else on XY.
      const f = selection.faces[0]; const face = f && bodies[f.body]?.mesh.faces[f.face];
      const plane = face ? (face.kind === 'plane' ? planeOfFace(face.normal, face.centroid) : null) : xyPlane();
      if (!plane) { setToast({ title: 'Can’t sketch on this face', hint: 'Pick a flat face, or clear the selection to sketch on XY.', detail: '' }); return; }
      const base = face ? refOf(bodies[f.body]) : null;
      const make = cmd.id === 'revolve' ? 'revolve-y' as const : cmd.id === 'pipe' ? 'pipe' as const : cmd.id === 'loft' ? 'loft' as const : undefined;
      const fp = face ? faceProfile(bodies[f.body].mesh, f.face) : null, outline = fp ? (({ shape, done }) => [...(shape ? [shape] : []), ...done])(sketchShapes(fp)) : undefined;
      const linkSource = face && base && base.side === 'solid' && !doc.instances?.length ? { kind: 'planar-face-outline-inset' as const, version: 1 as const, source: base, sourceFeature: featureId(doc.nodes, base.node), face: face.name } : undefined;
      const anchor: SketchAnchor = face ? { kind: 'face', offset: 0, face: { plane, base, ...(outline?.length ? { outline } : {}), ...(linkSource ? { linkSource } : {}) } } : { kind: 'xy', offset: 0 };
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
    // Before the first link exists, the base memo does not depend on placed parts. Bearing still needs
    // the current authored targets when it builds its candidate, as well as when it lists choices.
    // Loft also captures the shown document's current curves without changing its evaluated prefix.
    const startCtx = cmd.id === 'bearing' ? { ...ctx, doc: { ...ctx.doc, instances: doc.instances } }
      : cmd.id === 'loft' ? { ...ctx, doc: { ...ctx.doc, direct: shownDoc.direct } } : ctx;
    setActive({ cmd, values: cmd.defaults?.(startCtx) ?? {}, preview: 'busy', ctx: { ...startCtx }, ...(cmd.place ? { placing: true } : {}) });
  }, [ctx, selection, bodies, engine, commit, evaluated.nodes, shownDoc.direct, variants.showing, setSketch]);

  // Shift-Enter: once the part has its new bodies (and the selection followed them), the command again.
  useEffect(() => { if (restart && !active) { setRestart(null); start(commands.find(c => c.id === restart.id) ?? restart); } }, [restart, active, start]);
  // Placing a new shape: it follows the pointer over the ground and upward faces; a click or a drop sets
  // it there. Dragging a shape's button from the rail onto the viewport starts it as the drag comes in.
  const dragCmd = useRef<string | null>(null);
  // (R1c: the outliner's placed parts — a part picked, or one of its bearings opened to edit; setters only, so stable.)
  const pickInstanceRow = useCallback((id: string) => { setSelection(emptySel); setDirectSel([]); setInstanceSel([id]); setInstanceEdit(null); }, []);
  const editInstanceRow = useCallback((id: string, index: number) => {
    setBomOpen(false); setLibraryOpen(false); setParamsOpen(false); setSelection(emptySel); setDirectSel([]); setEditNode(null); setInstanceSel([id]); setInstanceEdit({ owner: id, index });
  }, []);
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
    setSketch({ ...(JSON.stringify(sketch.plane) === JSON.stringify(plane) ? sketch : detachSketchLink(sketch)), plane, base, anchor: { ...(sketch.anchor ?? { offset: 0 }), kind, offset, angle } });
    const [min, max] = sketchRegion(bodies, plane);
    viewport.current?.frameSketch(min, max, plane, SKETCH_INSETS);
  }, [sketch, bodies, setSketch]);

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
    setSketch(s => s && { ...detachSketchLink(s), shape: null, done: [...(s.done ?? []), ...(s.shape ? [s.shape] : []), r.shape] });
  };
  /** Trims, extends or splits the piece of the sketch at `at` (plane mm); open pieces meeting end to end join. */
  const trimSketch = (op: 'trim' | 'extend' | 'split', at: [number, number], tol: number) => {
    if (!sketch) return;
    const shapes = sketch.editNode !== undefined && sketch.shape ? [sketch.shape, ...(sketch.done ?? [])] : [...(sketch.done ?? []), ...(sketch.shape ? [sketch.shape] : [])];
    const r = (op === 'trim' ? trimAt : op === 'extend' ? extendAt : splitAt)(shapes.map(x => x.kind === 'polygon' ? { ...x, pending: false } : x), at, tol);
    if ('error' in r) { setToast({ title: op === 'trim' ? 'Nothing to trim there' : op === 'extend' ? 'Nothing to extend there' : 'Nothing to split there', hint: r.error, detail: '' }); return; }
    setSketch(s => s && { ...detachSketchLink(s), shape: null, done: r.shapes, picked: [] });
  };
  /** Reopens the sketch node `index` in the sketcher (Select tool, its kept constraints back); Finish writes it back in place. */
  const editSketch = (index: number) => {
    const stored = doc.nodes[index]; if (stored?.kind !== 'sketch') return;
    let node: SketchNode;
    try { node = stored.association !== undefined ? resolveAssociativeSketch(doc, index) : stored; }
    catch (error) { setToast({ title: 'Cannot open linked sketch', hint: error instanceof Error ? error.message : String(error), detail: '' }); return; }
    const { shape, done, positional } = sketchShapes(node), plane: SketchPlane = node.plane ? { origin: [...node.plane.origin], normal: [...node.plane.normal], xAxis: [...node.plane.xAxis] } : xyPlane();
    setEditNode(null); setActive(null); setPreviewBodies(null); setSelection(emptySel);
    setSketch(startPicking({ plane, tool: 'select', shape, done, base: node.association ? node.on ?? node.association.source : null, editNode: index, ...(node.association ? { association: node.association } : {}), ...(positional ? { positional } : {}) }, 'select'));
    const [min, max] = sketchRegion(bodies, plane); viewport.current?.frameSketch(min, max, plane, SKETCH_INSETS);
  };
  const linkSketchInset = (insetMM: number) => {
    const source = sketch?.anchor?.face?.linkSource;
    if (!sketch || !source) return;
    if (!Number.isFinite(insetMM) || insetMM <= 0) { setToast({ title: 'Cannot link face outline', hint: 'Enter a finite positive inset distance.', detail: '' }); return; }
    if (sketch.shape || sketch.done?.length) { setToast({ title: 'Cannot link face outline', hint: 'Start with an empty sketch. Existing shapes are preserved.', detail: '' }); return; }
    try {
      const association = { ...source, insetMM }, index = doc.nodes.length;
      const candidate = withNode(doc, { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [1, 1], association } as SketchNode);
      const node = resolveAssociativeSketch(candidate, index), { shape, done } = sketchShapes(node);
      const plane = planeOf(node);
      setSketch({ ...sketch, plane, shape, done, base: association.source, association, associationDetached: false });
    } catch (error) { setToast({ title: 'Cannot link face outline', hint: error instanceof Error ? error.message : String(error), detail: '' }); }
  };
  const finishSketch = useCallback(() => {
    if (!sketch || (!sketch.shape && !sketch.done?.length)) { setSketch(null); return; }
    const requestedGeneration = sketchGeneration.current;
    const linked = !!(sketch.association || sketch.associationDetached);
    const requestCurrent = () => docNow.current === doc && sketchGeneration.current === requestedGeneration;
    // A reopened sketch keeps its main profile first (the first outer shape is the main one).
    // (Open lines and arcs meeting end to end are one outline.)
    const shapes = joinOpen((sketch.editNode !== undefined && sketch.shape ? [sketch.shape, ...(sketch.done ?? [])] : [...(sketch.done ?? []), ...(sketch.shape ? [sketch.shape] : [])]).map(x => x.kind === 'polygon' && !x.closed ? { ...x, pending: false } : x));
    const profile = profileOf(shapes);
    if ('error' in profile) { setToast({ title: 'Finish the profile first', hint: profile.error, detail: '' }); return; }
    // Construction shapes are kept with the sketch (they come back when it is reopened).
    const refs = shapes.filter(x => x.construction), node = refs.length ? { ...profile.node, construction: refs } as SketchNode : profile.node;
    // The sketch keeps its plane; everything below is in the plane's own coordinates (Z along its normal).
    const placedNode: ModelNode = { ...node, ...(isDefaultPlane(sketch.plane) ? {} : { plane: { origin: [...sketch.plane.origin], normal: [...sketch.plane.normal], xAxis: [...sketch.plane.xAxis] } }), ...(sketch.association ? { association: sketch.association } : {}), ...((sketch.association || sketch.associationDetached) && sketch.base ? { on: sketch.base } : {}) } as SketchNode;
    if (sketch.editNode !== undefined) {
      const at = sketch.editNode;
      const replacement = linked && doc.nodes[at].id !== undefined ? { ...placedNode, id: doc.nodes[at].id } : placedNode;
      const edited = { ...doc, nodes: dropStaleMade(doc.nodes, doc.nodes.map((n, k) => k === at ? replacement : n)) };
      // (A sketch from before R10a getting its side ids: the features on it keep their references, by the new names.)
      const tags = (placedNode as SketchNode).sideTags, next = sketch.positional && tags && !(doc.nodes[at] as SketchNode).sideTags ? renameToTagged(edited, at, sketch.positional, tags, featureId) : edited;
      engine.evaluate(sketch.association || sketch.associationDetached ? next : prefixDoc(next, marker ?? next.nodes.length), revision.current++).then(r => { if (!r || (linked && !requestCurrent())) return; if (r.ok) { commit(next); setSketch(null); } else setToast(r.error); });
      return;
    }
    // A finished sketch is a feature of its own (it remembers the body it was drawn on): picked, ready
    // for Extrude, Revolve, Pipe or Loft.
    const base = sketch.base ?? null, next = withNode(doc, { ...placedNode, ...(base ? { on: base } : {}) } as SketchNode);
    if (sketch.association) {
      engine.evaluate(next, revision.current++).then(r => { if (!r || !requestCurrent()) return; if (r.ok) { commit(next); setSketch(null); setSelection({ ...emptySel, sketches: [next.nodes.length - 1] }); } else setToast(r.error); });
      return;
    }
    commit(next); setSketch(null);
    setSelection({ ...emptySel, sketches: [next.nodes.length - 1] });
  }, [sketch, doc, marker, commit, engine, setSketch]);

  const onPick = useCallback((hit: { face: { body: number; face: number } | null; edge: { body: number; edge: number } | null; point: Vec3 | null; direct?: string; instance?: string; instanceFace?: { body: number; face: number }; instanceCap?: { body: number }; vertex?: { body: number; at: Vec3 } }, additive: boolean) => {
    // (The section view shows cut copies of the bodies: picks wait until it is closed.)
    // (G19: a face for a section plane — its plane, the material behind it kept.)
    if (sectionRef.current && sectionFacePickRef.current !== null && hit.face) {
      const i = sectionFacePickRef.current, f = viewBodiesRef.current[hit.face.body]?.mesh.faces[hit.face.face];
      if (f && f.kind === 'plane') { const q = planeFromFace(f, sectionBoxRef.current); setSection(sc => sc && { ...sc, planes: sc.planes.map((p, j) => j === i ? q : p) }); setSectionFacePick(null); }
      else setToast({ title: 'Not a flat face', hint: 'A section plane is taken from a flat face.', detail: '' });
      return;
    }
    const validInstance = !!hit.instance && !!doc.instances?.some(inst => inst.id === hit.instance && !inst.hidden);
    if (hit.instance && !validInstance) return;
    // Section copies still block base-body edits. A current visible instance keeps its own selection route.
    if (sectionRef.current && !activeRef.current && !validInstance) return;
    // (G6: while the mould's halves show, picks reach only them — none here.)
    if (halvesShownRef.current && !activeRef.current) return;
    const cur = activeStore.get();
    if (cur) {
      // A command that takes a pick (a revolve's axis edge) gets the click; others ignore it. (R1d: its values as they are
      // now, from the store.)
      if (!cur.cmd.onPick) return;
      const r = cur.cmd.onPick(cur.ctx, cur.values, { face: hit.face, edge: hit.edge });
      if (!r) return;
      if ('error' in r && typeof r.error === 'string' && Object.keys(r).length === 1) { setToast({ title: `${cur.cmd.label}: not that one`, hint: r.error, detail: '' }); return; }
      setActive(a => a && { ...a, values: r as Values, preview: 'busy' }); return;
    }
    if (validInstance && !hit.instanceFace) {
      setPick(null); setInstanceSel([hit.instance!]); setSelection(emptySel); setDirectSel([]);
      if (hit.instanceCap) setToast({ title: 'Instance selected', hint: 'The section cap selects this instance. Use an original face for face operations.', detail: '' });
      return; // A generated cap or unknown face never enters native mate-face picking.
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
  }, [activeStore, measure, assembly, doc.instances]);
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
    setRedo(r => [...r, { doc, marker }]); setUndo(u => u.slice(0, -1)); setDocState(last.doc); setMarker(last.marker); cancel();
  }, [undo, doc, marker, cancel]);
  // (The latest undo, for a toast made before the change it takes back was committed.)
  const undoNow = useRef(doUndo); undoNow.current = doUndo;
  const doRedo = useCallback(() => {
    if (!redo.length) return; const last = redo[redo.length - 1];
    setUndo(u => [...u, { doc, marker }]); setRedo(r => r.slice(0, -1)); setDocState(last.doc); setMarker(last.marker); cancel();
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
    const exact = sectionExactShown ? sectionExact!.bodies : null;
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
      const v = r.ok ? r.volumes.find(b => b.key === bodyKeyFor(probe.nodes, probe.nodes.length - 1))?.volume ?? 0 : 0;
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
  // (CG6: from anywhere but the project, the document is no longer its open one — `fromProject` keeps it so.)
  const replaceDoc = (next: StudioDoc, fromProject = false) => { if (!fromProject) { project.detach(); setCompareBase(null); } cancel(); setDocGeneration(g => g + 1); setSelection(emptySel); setPick(null); setInstanceSel([]); setIsolatedInstances(undefined); setDirectSel([]); setMeasure(null); setEditNode(null); commit(next, false, true); };
  // (A document with mesh blobs is saved as the container, else as plain JSON: engine/container.ts. Saved, the
  // recovery copy and its blobs go.)
  const writeFile = (d: StudioDoc, name: string) => {
    try { const bytes = encodeStudioFile(d); downloadBytes(bytes, name, bytes[0] === 0x7b ? 'application/json' : 'application/octet-stream'); return true; }
    catch (e) { setToast({ title: 'Could not save', hint: e instanceof Error ? e.message : String(e), detail: '' }); return false; }
  };
  // (A copy still offered keeps its blobs: Restore can still bring it back.)
  const save = () => {
    // (CG6: into the open project — over the file it was read from, its tag expected — else downloaded, as before.)
    if (project.view.store) { void project.save(doc, fileName).then(ok => { if (ok) { setDirty(false); clearRecovery(); } }); return; }
    if (!writeFile(doc, `${fileName}.bcad`)) return; setDirty(false); clearRecovery(); void collectRecoveryBlobs(recovery?.doc ?? null);
  };
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
      {r && <button className="ol-badge" aria-label="Mesh repair" title={`Repaired: ${r.holesFilled} hole${r.holesFilled === 1 ? '' : 's'} filled (${Math.round(r.filledArea)} mm² guessed), ${r.flipped} turned, ${r.degenerateRemoved + r.duplicatesRemoved} degenerate, ${r.finsRemoved} fins, ${r.floatersRemoved} tiny pieces dropped. Click: show the filled faces and change the repair.`}
        onClick={() => { if (fills.length) setSelection({ faces: fills, edges: [], bodies: [] }); void editRepair(at!); }}>repaired{r.holesFilled ? ` · ${Math.round(r.filledArea)} mm² filled` : ''}</button>}
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
    const faces = read.bodies.reduce((n, b) => n + b.mesh.faces.length, 0), volume = read.bodies.reduce((v, b) => v + (b.volume ?? 0), 0);
    const r = repair?.report, sheet = r && !r.closed;
    // (Pieces under 1% of the largest one's volume, kept: floaters, likely — the repair drops them when asked.)
    const largest = Math.max(...read.bodies.map(b => b.volume ?? 0)), tiny = pieces > 1 ? read.bodies.filter(b => (b.volume ?? 0) < 0.01 * largest).length : 0;
    setToast({ title: `${o.format ?? 'Mesh'} opened${repair ? ', repaired' : ''}`, hint: `${pieces > 1 ? `${pieces} pieces, each a body of its own (${faces.toLocaleString('en-US')} regions in all)` : `${sheet ? 'An open sheet' : 'A mesh solid'} of ${faces.toLocaleString('en-US')} region${faces === 1 ? '' : 's'}`} — ${(o.indices.length / 3).toLocaleString('en-US')} triangles read in ${MESH_UNITS.find(u => u.value === o.unit)?.label.toLowerCase() ?? o.unit}${sheet ? '' : `; ${Math.round(volume).toLocaleString('en-US')} mm³`}.${r?.holesFilled ? ` ${r.holesFilled} hole${r.holesFilled > 1 ? 's' : ''} filled (${Math.round(r.filledArea).toLocaleString('en-US')} mm² guessed: its badge shows where).` : ''}${sheet ? ' It is not closed: no volume, no Booleans.' : ''}${tiny ? ` ${tiny} of the pieces ${tiny === 1 ? 'is' : 'are'} tiny (under 1% of the largest): stray bits, likely — delete ${tiny === 1 ? 'it' : 'them'}, or open the mesh with its repair.` : ''}${crossings ? ` It crosses itself in ${crossings} place${crossings > 1 ? 's' : ''}: Booleans will refuse it.` : ''} Splits, sections, holes and Booleans with modelled bodies work at any size (up to ${FACET_EXPLODE_TRIANGLES.toLocaleString('en-US')} triangles near the tool; ${FACET_PREVIEW_TRIANGLES.toLocaleString('en-US')} in a preview); Booleans of two meshes up to ${FACET_EXPLODE_TRIANGLES.toLocaleString('en-US')} triangles; fillets, shells and drafts on mesh faces come later.`, detail: '' });
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
          const k = stepLengthUnit(step).to, positions = new Float64Array(meshes.reduce((n, m) => n + m.positions.length, 0)), indices = new Uint32Array(meshes.reduce((n, m) => n + m.indices.length, 0));
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
        if (unit.to !== 1) for (let k = 0; k < n; k++) next = withNode(next, { kind: 'scale', parent: { node: 0, side: n > 1 ? `part${k}` as Side : 'solid' }, factor: unit.to, pivot: [0, 0, 0] });
        replaceDoc(next); setFileName(name); setDirty(true); setTimeout(() => viewport.current?.fit(), 300);
        const vol = read.bodies.reduce((t, b) => t + (b.volume ?? 0), 0) * unit.to ** 3;
        setToast({ title: 'STEP opened', hint: `${n} solid${n === 1 ? '' : 's'}, ${unit.declared ? `in ${unit.name}` : 'no length unit declared (read as millimetres)'}${unit.to !== 1 ? `, scaled ×${unit.to} to millimetres` : ''}; ${Math.round(vol).toLocaleString('en-US')} mm³ in all. Only the solids come in (no colours, names or assembly structure).`, detail: '' });
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
      // A .barocad source adds its curves and surfaces to the part as direct geometry. (Only .barocad: `.cad` is other
      // programs' extension, owner 2026-10-24.)
      if (/\.barocad$/i.test(file.name)) {
        const next = (await loadDirect()).importSource(doc.direct ?? emptyDirect(), await file.text(), file.name.replace(/\.barocad$/i, ''));
        commitDirect(next, next.objects.slice((doc.direct?.objects.length ?? 0)).map(o => o.id));
        setTimeout(() => viewport.current?.fit(), 300);
        return;
      }
      // Any other kind of file is named, with what Open reads; the part unchanged. (A file without an extension is still
      // tried as a model below.)
      if (/\.[^./\\]+$/.test(file.name) && !/\.(bcad|json)$/i.test(file.name)) { setToast({ title: `Can’t open ${file.name}`, hint: OPEN_READS, detail: '' }); return; }
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
    // (R1d: cleared only when there is something to clear — a set to the same null rendered the App again after each
    // preview result.)
    if (!doc.requirements?.length) { if (spec !== null) setSpec(null); specPassed.current = new Set(); return; }
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
  routeContext.current = { blocked: busy || !fresh || !!parameterEdit || marker !== null || !!shownVariant.current || !!active || !!sketch || rendering || drawing || !!measure || !!assembly.draft || !!cageEd.session || !!skel.session || !!ghost };
  useEffect(() => { if (routeContext.current.blocked && routeSession.current) discardRouteRef.current(); }, [busy, fresh, parameterEdit, marker, active, sketch, rendering, drawing, measure, assembly.draft, cageEd.session, skel.session, ghost, doc]);
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
    const tools = await import('@barocss/cad-model/chat/tools'), r = await tools.previewProposal({ doc: from, bodies, rowFiles: chatRowFiles.current }, p.id, partEval);
    setProposalBusy(false);
    if ('error' in r) { setToast({ title: `${p.id} does not apply to the part as it is`, hint: r.error, detail: '' }); return; }
    setGhost({ id: p.id, bodies: r.bodies, after: true, full: r.doc, shown: r.doc, parts: tools.proposalParts(from, r.doc), leaveOut: [] }); setPreviewBodies(r.bodies);
  };
  /** A stale proposal made again on the part as it is, then shown (D41): only the rebased one can be accepted. */
  const rebaseIt = async (p: Proposal) => {
    if (active || sketch || marker !== null) return;
    setProposalBusy(true);
    const r = await (await import('@barocss/cad-model/chat/tools')).rebaseProposal({ doc, bodies, rowFiles: chatRowFiles.current }, p.id, partEval);
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
    // (R4b: on the O9 'proposal-diff' lane — a reply for a proposal no longer shown comes back stale.)
    const at = revision.current++, key = `${ghost.id}|${ghost.leaveOut.join(',')}`;
    void lanes.run('proposal-diff', { revision: at, source: key }, () => engine.proposalDiff(doc, ghost.shown, at, { revision: modelHash(doc), proposal: key })).then(reply => { if (!reply.stale) setProposalOverlay('error' in reply.result ? null : reply.result); });
    return () => lanes.cancel('proposal-diff');
  }, [ghost?.id, ghost?.shown]);
  // (CG6: a version compared with the working document — its geometry's difference on the same overlay, version → working.)
  useEffect(() => {
    if (!compareBase) { setCompareOverlay(null); return; }
    const at = revision.current++, key = `version:${compareBase.id}`;
    void lanes.run('proposal-diff', { revision: at, source: key }, () => engine.proposalDiff(compareBase.doc, doc, at, { revision: modelHash(doc), proposal: key })).then(reply => { if (!reply.stale) setCompareOverlay('error' in reply.result ? null : reply.result); });
    return () => lanes.cancel('proposal-diff');
  }, [compareBase, doc]);
  const flipGhost = () => setGhost(g => { if (!g) return g; setPreviewBodies(g.after ? null : g.bodies); return { ...g, after: !g.after }; });
  const acceptIt = async (p: Proposal) => {
    if (active || sketch) return;
    if (marker !== null) { setToast({ title: 'Roll forward to accept', hint: 'A proposal applies to the whole part: drag the rollback bar to the end first.', detail: '' }); return; }
    setProposalBusy(true);
    const leaveOut = ghost?.id === p.id ? ghost.leaveOut : [];
    const r = await (await import('@barocss/cad-model/chat/tools')).acceptProposal({ doc, bodies, rowFiles: chatRowFiles.current }, p.id, partEval, { leaveOut });
    setProposalBusy(false);
    if ('error' in r) { setToast({ title: `${p.id} could not be applied`, hint: r.error, detail: 'Nothing changed; the proposal stays open.' }); return; }
    setGhost(null); setPreviewBodies(null); commit(r.state.doc, false);
  };
  const rejectIt = (p: Proposal) => { const next = rejectProposal(doc, p.id); if ('error' in next) return; if (ghost?.id === p.id) { setGhost(null); setPreviewBodies(null); } commit(next, false); };
  const volumeOf = (list: readonly BodyResult[]) => list.reduce((s, b) => s + (b.volume ?? 0), 0);
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
  const referenceDimension = (where: string) => doc.drawing?.dimensions.find(d => where === `dimension ${d.id}`);
  const referenceCaption = (where: string) => {
    const dimension = referenceDimension(where);
    if (!dimension) return where.startsWith('feature ') ? 'Feature reference' : where.startsWith('mate ') ? 'Mate reference' : 'Model reference';
    const label = referenceLabels.find(x => x.dimensionId === dimension.id);
    const kind = dimension.kind === 'pcd' ? 'Pitch circle' : dimension.kind === 'angle' ? 'Angle' : dimension.kind === 'diameter' ? 'Diameter' : dimension.kind === 'radius' ? 'Radius' : 'Linear';
    const view = dimension.view === 'front' ? 'Front' : dimension.view === 'top' ? 'Top' : dimension.view === 'right' ? 'Right' : dimension.view.startsWith('section:') ? `Section ${dimension.view.slice(8)}` : dimension.view.startsWith('detail:') ? `Detail ${dimension.view.slice(7)}` : 'Isometric';
    return `${label?.text ?? kind + ' dimension'} · ${view} view`;
  };
  const affectedDimensions = (name: string) => new Set(referencesOf(doc, true).refs.filter(r => r.name === name || r.was === name).map(r => referenceDimension(r.where)?.id).filter(Boolean)).size;
  const previewReference = (where: string, edge?: string, inModel = false) => {
    const dimension = referenceDimension(where);
    if (dimension && !inModel) {
      setReferencePreview({ dimensionId: dimension.id, ...(edge ? { edge } : {}) });
      setSketch(null); setActive(null); setMeasure(null); setRendering(false); setPlaying(false); setDrawing(true); setBrowserOpen(true);
      return;
    }
    if (!edge || !fresh || busy || section || previewBodies || sketch || mateFaces) { setToast({ title: 'Preview unavailable', hint: 'Show the current model without a section or active tool first.', detail: '' }); return; }
    const edges = bodies.flatMap((body, bodyIndex) => body.mesh.edges.flatMap((candidate, edgeIndex) => candidate.names.includes(edge) ? [{ body: bodyIndex, edge: edgeIndex }] : []));
    if (edges.length !== 1) { setToast({ title: 'Preview unavailable', hint: edges.length ? 'This name covers more than one displayed edge.' : 'This edge is not present in the current displayed model.', detail: '' }); return; }
    setReferencePreview(null); setDrawing(false); setRendering(false); setMeasure(null); setInstanceSel([]); setDirectSel([]); setSelection({ faces: [], edges, bodies: [] });
  };
  const settleRef = async (index: number, to?: string) => {
    const next = await confirmReference(doc, index, bodies, d => engine.part(d, revision.current++, 'refs'), to);
    setRefProblems(ps => ps.filter(p => p.index !== index)); setRefChoices(null);
    pushUndo(); setDoc(next); setDirty(true);
  };
  const showRefChoices = async (index: number) => setRefChoices({ index, names: await candidatesFor(doc, index, bodies, d => engine.part(d, revision.current++, 'refs')) });
  // The opened file's stored references checked against their signatures (no prior document: a newer kernel may
  // number faces otherwise, engine/references.ts); what moved is substituted, marked, and said.
  const verifyOpened = async (opened: StudioDoc) => {
    // (O19: one that does not build because a stored name moved, REFERENCE_MOVED, is checked too — its moved names matched again, or held.)
    const r = await engine.part(opened, revision.current++, 'refs'); if (!r || (!r.ok && r.error.code !== 'REFERENCE_MOVED')) return;
    const v = await verifyReferences(opened, r.ok ? r.bodies : [], d => engine.part(d, revision.current++, 'refs'));
    setRefProblems(v.problems);
    if (!v.changes.length && !v.problems.length) return;
    setDocState(cur => {
      if (cur.nodes !== opened.nodes && JSON.stringify(cur.nodes) !== JSON.stringify(opened.nodes)) return cur;
      const next = { ...v.doc, render: cur.render, ...(v.doc.drawing ? { drawing: readDrawing(v.doc.drawing) } : {}) };
      // Reference checking must not restore older print controls after a newer user change.
      if (cur.print === undefined) delete next.print; else next.print = cur.print;
      if (cur.printPreview === undefined) delete next.printPreview; else next.printPreview = cur.printPreview;
      return next;
    }); setDirty(true);

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
  const [stlAsk, setStlAsk] = useState(false), [stlQuality, setStlQuality] = useState<'automatic' | '8' | '16' | '32'>('automatic'), [stlBusy, setStlBusy] = useState(false);
  const stlGeneration = useRef(0), stlPending = useRef(false), stlCancelButton = useRef<HTMLButtonElement>(null);
  const cancelStlExport = () => { stlGeneration.current++; stlPending.current = false; setStlBusy(false); setStlAsk(false); };
  const askStlExport = () => { stlGeneration.current++; stlPending.current = false; setStlBusy(false); setStlQuality('automatic'); setStlAsk(true); };
  // (DEV, for the flow: the columns as a fresh viewer has them — the chat collapsed at its default width, no dock sheet — so
  // one step's open or drag does not carry into the next; and no toast — G12f: one left from an earlier step met the view
  // cube in the layout step. The recovery card is only hidden, its copy kept; a question's toast closed is cancelled.)
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as { __studioLayoutReset: () => void }).__studioLayoutReset = () => {
      layout.setChatOpen(false); layout.setChatWidth(CHAT_DEFAULT); layout.setDockSheet(false);
      setToast(null); setRecovery(null); setCascade(null); setMeshAsk(null); setRepairAsk(null); setStepAsk(false);
    };
  }, [layout.setChatOpen, layout.setChatWidth, layout.setDockSheet]);
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
    if (stlPending.current) return;
    if (!fresh) { setStlAsk(false); setToast({ title: 'Not written yet', hint: busy ? 'The part is still evaluating: export once it is up to date.' : 'The part did not evaluate: fix it first.', detail: '' }); return; }
    const captured = { doc, evaluated, bodies: [...bodies], quality: stlQuality, name: fileName }, explicit = captured.quality !== 'automatic';
    const refuse = (hint: string, detail = '') => { setStlAsk(false); setToast({ title: 'Could not write STL', hint, detail }); };
    if (!captured.bodies.length) { refuse('There are no root bodies to export.'); return; }
    if (explicit && captured.doc.instances?.some(i => !i.hidden)) { refuse('This STL quality cannot export a document with visible placed instances. Export the placed part from its own document.'); return; }
    if (explicit) for (const body of captured.bodies) {
      if (body.lumpTouch?.length) { refuse(`${bodyName(captured.doc, body)} needs a separate STL for each touching piece. That output uses the on-screen mesh; use Automatic.`); return; }
      if (body.family === 'faceted') { refuse(`${bodyName(captured.doc, body)} is a mesh body. The selected STL quality needs a BRep body; use Automatic.`); return; }
    }
    const generation = ++stlGeneration.current;
    stlPending.current = true; setStlBusy(true); stlCancelButton.current?.focus();
    const current = () => {
      if (stlGeneration.current !== generation) return false;
      if (docNow.current !== captured.doc || evaluatedRef.current !== captured.evaluated) { refuse('The design changed while the STL files were being prepared. Export the current design again.'); return false; }
      return true;
    };
    try {
      const fallback: string[] = [], prepared: { name: string; bytes: Uint8Array }[] = [];
      let split = 0;
      for (const body of captured.bodies) {
        // Automatic keeps the existing display-mesh split for touching pieces.
        const lumps = !explicit && body.lumpTouch?.length ? lumpStls(body.mesh, body.key) : null;
        if (lumps) { split++; for (const f of lumps) prepared.push({ name: `${captured.name}-${body.key}-lump${f.lump + 1}.stl`, bytes: f.bytes }); continue; }
        const kernel = captured.quality === 'automatic'
          ? await engine.stl(captured.evaluated, body.key)
          : await engine.stl(captured.evaluated, body.key, { segmentsPerQuarter: Number(captured.quality) });
        if (!current()) return;
        if (kernel && 'error' in kernel) { refuse(`STL export stopped for ${bodyName(captured.doc, body)}.`, kernel.error); return; }
        if (!kernel && explicit) { refuse(`The kernel could not write ${bodyName(captured.doc, body)} at the selected STL quality. No files were downloaded.`); return; }
        if (!kernel) fallback.push(bodyName(captured.doc, body));
        prepared.push({ name: `${captured.name}-${body.key}.stl`, bytes: kernel ?? meshToStl(body.mesh, body.key) });
      }
      // Prepare the sidecar before any download: a failed body or stale request writes no files.
      const names = prepared.map(f => f.name), sidecar = sourceBytes(sourceRecord(captured.doc, names));
      if (!current()) return;
      for (const file of prepared) downloadBytes(file.bytes, file.name, 'model/stl');
      downloadBytes(sidecar, `${captured.name}.source.json`, 'application/json');
      setStlAsk(false);
      setToast({ title: `STL written: ${prepared.length} file${prepared.length === 1 ? '' : 's'}`, hint: `${draftWarning(captured.doc) ? `${draftWarning(captured.doc)} ` : ''}Triangles in millimetres, one file per body; no colours, names or exact curves.${fallback.length ? ` ${fallback.join(', ')} ${fallback.length === 1 ? 'was' : 'were'} written from the on-screen mesh (the kernel’s tessellation refused ${fallback.length === 1 ? 'it' : 'them'}).` : ''}${split ? ' A body whose pieces only touch along an edge or a point is written as one STL a piece; 3MF keeps them in one file as separate objects.' : ''}`, detail: '' });
    } catch (error) {
      if (current()) refuse('STL export could not finish.', error instanceof Error ? error.message : String(error));
    } finally {
      if (stlGeneration.current === generation) { stlPending.current = false; setStlBusy(false); }
    }
  };

  /** The quote package (IM6, O82): the part as STEP, its moulding report and the request, one zip; what is open said. */
  const exportQuote = async () => {
    if (!fresh) { setToast({ title: 'Not written yet', hint: busy ? 'The part is still evaluating: export once it is up to date.' : 'The part did not evaluate: fix it first.', detail: '' }); return; }
    if (!massReady) { setToast({ title: 'Not written yet', hint: 'The part\'s masses are still being worked out: export in a moment.', detail: '' }); return; }
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
        if (back) { liveShape.current = back; setSketchError(null); setSketch(s => s && { ...detachSketchLink(s), shape: back, picked: [], editDim: null }); return; }
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
      if (e.key === 'Escape' && routePanelOpen && !active && !sketch && !assembly.draft && !measure && !cageEd.session && !skel.session) { e.preventDefault(); discardRouteRef.current(); return; }
      if (e.key === 'Escape') { if (palette) setPalette(false); else if (sketch && !active && (sketch.picked?.length || sketch.editDim)) setSketch(s => s && { ...s, picked: [], editDim: null }); else if (active || sketch) cancel(); else if (assembly.draft) assembly.cancel(); else if (measure) setMeasure(null); else { setSelection(emptySel); setInstanceSel([]); setDirectSel([]); } return; }
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
  // (R1c: the buttons memoised, their handlers stable — `start` through a ref to the latest.)
  const startRef = useRef(start); startRef.current = start;
  const startTool = useCallback((c: Command) => startRef.current(c), []);
  const toolDragStart = useCallback((c: Command, e: React.DragEvent) => { e.dataTransfer.setData(DRAG_TYPE, c.id); e.dataTransfer.effectAllowed = 'copy'; dragCmd.current = c.id; }, []);
  const toolDragEnd = useCallback((c: Command, e: React.DragEvent) => {
    if (dragCmd.current && e.dataTransfer.dropEffect === 'none') { dragCmd.current = null; setActive(x => x?.placing && x.cmd.id === c.id ? null : x); setPreviewBodies(null); }
  }, []);
  // (The commands' availability in this render: the button lists are made again only when it, or the active command, changes.)
  const placeStates = commandStates(PLACE_COMMANDS, ctx), groupStates = GROUP_COMMANDS.map(list => commandStates(list, ctx));
  activeRef.current = active;
  /** The viewport selection by name, for the chat's context chips (A4.3). */
  const chatContext = useMemo(() => [
    ...selection.faces.flatMap(f => { const n = bodies[f.body]?.mesh.faces[f.face]?.name.split('+')[0]; return n ? [{ kind: 'face' as const, name: n }] : []; }),
    ...selection.edges.flatMap(e => { const n = bodies[e.body]?.mesh.edges[e.edge]?.names[0]; return n ? [{ kind: 'edge' as const, name: n }] : []; }),
    ...selection.bodies.flatMap(b => bodies[b] ? [{ kind: 'body' as const, name: bodies[b].key }] : []),
  ].slice(0, 12).filter(() => fresh), [selection, bodies, fresh]);
  // (O18: the viewport keeps the bodies it has while only their masses come — the same meshes, the same array — so a mass
  // patch is no change of what is drawn: WebGPU rebuilt the part on a new array and left the copies sharing its shapes out.)
  const drawnRef = useRef(bodies);
  if (!sameMeshes(drawnRef.current, bodies)) drawnRef.current = bodies;
  const drawnBodies = drawnRef.current;
  const shownBodies = bodyDrag ? drawnBodies : routePreviewBodies ?? previewBodies ?? (section && sectionBodies && !sketch ? sectionBodies : drawnBodies);
  // The Render workspace's animated offsets on the bodies shown: each by its body's key — an exact section's piece by the
  // body it was cut from (G19.5: by index they fell on other bodies once the section left some out or split them).
  const animatedOffsets = useMemo(() => {
    if (!animatedAt) return undefined;
    const from = shownBodies === sectionBodies && sectionExactShown ? sectionExact!.from : null, out = new Map<number, Vec3>();
    shownBodies.forEach((b, i) => { const o = animatedAt.get(from?.get(b.key) ?? b.key); if (o) out.set(i, o); });
    return out;
  }, [animatedAt, shownBodies, sectionBodies, sectionExactShown, sectionExact]);
  // Bodies' own colours and hidden ones (StudioDoc.bodies), by index of what is shown.
  // (A command's preview: the bodies it adds — first made by one of its new features, not built on a body
  // the part has — tinted, so what is new reads at a glance.)
  const previewNodes = useMemo(() => { if (!active?.cmd.build || !previewBodies) return null; try { return active.cmd.build(active.ctx, active.values).nodes; } catch { return null; } }, [active, previewBodies]);
  const bodyColors = useMemo(() => {
    // (A proposal's ghost: the bodies it adds or changes — not tinted while the engine draws its two-colour overlay, G12.)
    const overlaid = !!ghost && proposalOverlay?.method === 'boolean';
    const had = ghost ? new Set(bodies.map(b => `${b.key}:${meshSig(b.mesh)}`)) : null;
    const fresh = (b: BodyResult) => { if (had) return !had.has(`${b.key}:${meshSig(b.mesh)}`); const at = previewNodes && bodyNodeOf(previewNodes, b.key); return !!previewNodes && !!at && rootOf(previewNodes, at.node) >= evaluated.nodes.length; };
    return new Map(shownBodies.flatMap((b, i) => { const c = shownBodies === routePreviewBodies ? PREVIEW_TINT : lookOf(doc, b).color ?? (shownBodies === previewBodies && fresh(b) && !overlaid ? PREVIEW_TINT : undefined); return c ? [[i, rgbOf(c)] as [number, [number, number, number]]] : []; }));
  }, [shownBodies, doc, previewBodies, routePreviewBodies, previewNodes, evaluated.nodes.length, ghost, bodies, proposalOverlay]);
  const hiddenBodies = useMemo(() => new Set(shownBodies.flatMap((b, i) => lookOf(doc, b).hidden ? [i] : [])), [shownBodies, doc]);
  // Faces coloured on their own, by body index and face index (their names kept with the body's look).
  // (G12: a shown proposal's faces tinted — where the Boolean refused (WebGL2 draws the overlay too, G16) — those it adds or changes
  // green on the after view, those it removes or changes red on the before view.)
  // (CG6: a compared version the same way — the working document is the after view.)
  const proposalTint = useMemo(() => {
    const o = ghost ? proposalOverlay : compareOverlay, after = ghost ? ghost.after : true; if (!o || o.method === 'boolean') return null;
    const on = new Set(o.changedFaces.filter(f => after ? f.kind !== 'removed' : f.kind !== 'added').map(f => f.name));
    return { on, color: rgbOf(after ? PROPOSAL_ADDED : PROPOSAL_REMOVED) };
  }, [proposalOverlay, compareOverlay, ghost]);
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
  // (G25b: on WebGPU the access map is the GPU's estimate, the CPU's when there is no device; the panels keep the CPU's numbers.)
  const mapsShown = (mapKind === 'thickness' || mapKind === 'draft' || mapKind === 'access') && !rendering && !sketch && !previewBodies;
  const computeDevice = useCallback(() => viewport.current?.computeDevice() ?? null, []);
  const gpuAccess = useGpuAccessMaps(mapsShown && mapKind === 'access', shownBodies, computeDevice);
  const cpuMaps = useMemo(() => mapsShown && !(mapKind === 'access' && gpuAccess.state !== 'cpu' && gpuAccess.state !== 'error') ? mapsOf(mapKind as MapKind, doc, shownBodies) : null, [mapsShown, mapKind, gpuAccess.state, shownBodies, doc]);
  const scalarMaps = mapKind === 'access' && gpuAccess.state === 'ready' ? gpuAccess.maps : mapKind === 'access' && gpuAccess.state === 'pending' ? null : cpuMaps;
  // (With the draft map, each body's isoclines n·d = 0 on its straddling faces, from the exact surface.)
  const isoclines = useMemo(() => mapKind === 'draft' && scalarMaps && doc.mould?.pull ? shownBodies.flatMap(b => isoclinePolylines(doc, b, doc.mould!.pull!)) : null, [mapKind, scalarMaps, doc, shownBodies]);
  // (The mould's view: asked again when the part, its pull or its sides change; none outside its two maps.)
  const mouldWanted = (mapKind === 'parting' || mapKind === 'halves') && !rendering && !sketch && !previewBodies && !!doc.mould?.pull;
  useEffect(() => {
    if (!mouldWanted) { setMouldResult(null); return; }
    setMouldResult('working');
    // (R4b: on the O9 'mould' lane — a reply for a part, pull or map since changed comes back stale.)
    const at = revision.current++;
    void lanes.run('mould', { revision: at, source: mapKind }, () => engine.mould(doc, at, mapKind === 'halves')).then(reply => { if (!reply.stale) setMouldResult(reply.result); });
    return () => lanes.cancel('mould');
  }, [mouldWanted, mapKind, evaluated, doc.mould, engine]);
  const mouldShown = useMemo(() => mouldResult && mouldResult !== 'working' && !('error' in mouldResult)
    ? { pull: mouldResult.pull, loops: mouldResult.loops, plus: mapKind === 'halves' ? mouldResult.plus : [], minus: mapKind === 'halves' ? mouldResult.minus : [], spread: mouldSpread } : null, [mouldResult, mapKind, mouldSpread]);
  halvesShownRef.current = !!mouldShown && (mouldShown.plus.length + mouldShown.minus.length) > 0;
  const mapLegend = scalarMaps?.[0] && viewBackend === 'webgpu' ? scalarMaps[0] : null;
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
  const sectionClip = useMemo(() => section && !sketch && gpuSection ? { planes: sectionPlanes(section), bodies: shownBodies === sectionBodies && !sectionExactShown, hatch: sectionHatchOn ? hatchStep : null, cutout: section.mode === 'cutout' } : null, [section, sketch, gpuSection, shownBodies, sectionBodies, sectionExactShown, sectionHatchOn, hatchStep]);
  // (R1c (3c): a dragged plane's clip and handles, made as the App's are — SceneViewport draws them in each frame of the
  // drag on WebGPU, the App not rendering. On WebGL2 the App does, so there is none.)
  const sectionLiveView = gpuSection && !sketch ? {
    store: sectionLive,
    clip: (s: Section) => ({ planes: sectionPlanes(s), bodies: shownBodies === sectionBodies && !sectionExactShown, hatch: sectionHatchOn ? hatchStep : null, cutout: s.mode === 'cutout' }),
    handles: (s: Section) => !active && bodies.length ? sectionHandles(s, sectionBox, dragSection) : [],
  } : null;
  const sectionHatchLines = useMemo(() => section && !sketch && sectionHatchOn && shownBodies === sectionBodies && (!gpuSection || sectionExactShown) ? sectionHatch(shownBodies, sectionPlanes(section), hatchStep) : null,
    [section, sketch, sectionHatchOn, shownBodies, sectionBodies, gpuSection, sectionExactShown, hatchStep]);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const w = window as unknown as { __studioSection: () => unknown; __studioSectionDebug: (d: { hold: boolean; cpu: boolean }) => void };
    // (G19: the mode and planes, and the exact section's kept volume once it is shown.)
    w.__studioSection = () => ({ gpu: gpuSection, exact: sectionExactShown, clip: sectionClip, hatch: sectionHatchOn ? { spacing: hatchStep, lines: sectionHatchLines?.map(h => ({ body: h.body, segments: h.segments.length / 6 })) ?? null } : null, bodies: shownBodies.length, mode: section?.mode ?? null, planes: section?.planes ?? null, volume: sectionExactShown ? sectionExact!.bodies.reduce((v, b) => v + meshVolume(b.mesh), 0) : null, shownVolume: shownBodies.reduce((v, b) => v + meshVolume(b.mesh), 0),
      // (G19.5: each shown body's own body, and the Render workspace's offsets on them, by shown body's key.)
      shownKeys: shownBodies.map(b => b.key), sources: shownBodies.map(b => (shownBodies === sectionBodies && sectionExactShown ? sectionExact!.from.get(b.key) : null) ?? b.key), offsets: animatedOffsets ? [...animatedOffsets].map(([i, o]) => [shownBodies[i]?.key, o]) : null });
    w.__studioSectionDebug = setSectionDebug;
    // (The axis form as before, or a section of planes, G19.)
    (window as unknown as { __studioSetSection: (s: Section | AxisSection | null) => void }).__studioSetSection = s => setSection(s ? asSection(s) : null);
    // (R1c (3c), for the bench: a section dragged, its steps shown and its last one, `done`, committed — as a handle drags it.)
    (window as unknown as { __studioDragSection: (s: Section | AxisSection | null, done: boolean) => void }).__studioDragSection = (s, done) => dragSection(() => s ? asSection(s) : null, done);
    (window as unknown as { __studioOverlayLines: () => Record<string, number> }).__studioOverlayLines = () => viewport.current?.overlayLines() ?? {};
    (window as unknown as { __studioOverlayTexts: () => Record<string, string[]> }).__studioOverlayTexts = () => viewport.current?.overlayTexts() ?? {};
    // (G12: the shown proposal's diff, as the overlay has it.)
    (window as unknown as { __studioProposalOverlay: () => unknown }).__studioProposalOverlay = () => proposalOverlay && { added: proposalOverlay.added?.volume ?? null, removed: proposalOverlay.removed?.volume ?? null, method: proposalOverlay.method, faces: proposalOverlay.changedFaces.length, tinted: !!proposalTint };
    // (CG6: the compared version's diff, the same way.)
    (window as unknown as { __studioCompareOverlay: () => unknown }).__studioCompareOverlay = () => compareOverlay && { added: compareOverlay.added?.volume ?? null, removed: compareOverlay.removed?.volume ?? null, method: compareOverlay.method, faces: compareOverlay.changedFaces.length, tinted: !!proposalTint };
    // (n points spread through a box, coloured by height; 0: none.)
    (window as unknown as { __studioSetCloud: (n: number, min: Vec3, max: Vec3) => void }).__studioSetCloud = (n, min, max) => setBenchCloud(n > 0 ? Array.from({ length: n }, (_, i) => {
      const u = (i * 0.61803398875) % 1, v = (i * 0.7548776662) % 1, w = (i * 0.5698402910) % 1;
      return { at: [min[0] + u * (max[0] - min[0]), min[1] + v * (max[1] - min[1]), min[2] + w * (max[2] - min[2])] as Vec3, t: w };
    }) : null);
  });
  const sectionFrom = nextSerial(evaluated);
  const shownSelection = sectioned ? { faces: shownBodies.flatMap((b, bi) => b.mesh.faces.filter(f => cutAfter(f.name, sectionFrom)).map(f => ({ body: bi, face: f.index }))), edges: [], bodies: [] }
    : routePreviewBodies || routePanelOpen || previewBodies || sketch ? emptySel : mateFaces ? { faces: assembly.highlight.faces, edges: [], bodies: [] } : measure ? { faces: measure.flatMap(m => m.face !== undefined ? [{ body: m.body, face: m.face }] : []), edges: measure.flatMap(m => m.edge !== undefined ? [{ body: m.body, edge: m.edge }] : []), bodies: [] } : selection;
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
    return index === null || (marker !== null && index >= marker) ? null : editCommand(index, evaluated.nodes, doc);
  }, [active, sketch, rendering, drawing, measure, assembly.draft, instanceSel.length, selection, editNode, bodies, evaluated.nodes, doc.fastenerSizes, marker]);
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
  // (Where the camera is: a cut-out's default corner faces it, G20.)
  const cameraEye = (): Vec3 | null => { const c = viewport.current?.getCamera(); if (!c) return null; const cp = Math.cos(c.pitch); return [c.target[0] + c.distance * cp * Math.cos(c.yaw), c.target[1] + c.distance * cp * Math.sin(c.yaw), c.target[2] + c.distance * Math.sin(c.pitch)]; };
  const sectionDrag: FeatureHandle[] = section && !active && !sketch && bodies.length ? sectionHandles(section, sectionBox, dragSection) : [];
  const dragTransforms = useMemo(() => cmdBody !== undefined && bodyDrag ? new Map([[cmdBody, bodyDrag.matrix]]) : null, [cmdBody, bodyDrag]);

  // The selected part instance's gizmo: moves along and turns about world axes through its box's centre
  // (only what its mates leave free). It follows at once on screen; let go, it is placed (mates re-solve)
  // and shown as dragged until it is evaluated where it lands.
  const selectedInst = instanceSel.length === 1 ? doc.instances?.find(i => i.id === instanceSel[0]) : undefined;
  const instGizmo: TransformGizmo | null = (() => {
    if (!selectedInst || active || sketch || rendering || drawing || measure || assembly.draft || exploded) return null;
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
  const instancePreview = useMemo(() => !cpuInstanceSection && instDrag ? { id: instDrag.id, matrix: previewMatrix(instDrag.drag) } : null, [cpuInstanceSection, instDrag]);

  // Cosmetic threads (tapped holes, bolts, nuts): rings on the part's bodies and the placed parts'
  // (not on a preview, a section or a render).
  const threads = useMemo(() => {
    if (rendering || section || previewBodies) return new Float32Array();
    const out: number[] = [], own = threadsOf(evaluated.nodes, fastenerSizesOf(doc));
    for (const b of bodies) out.push(...threadLines(own, b.mesh));
    return new Float32Array(out);
  }, [bodies, evaluated.nodes, doc.fastenerSizes, rendering, section, previewBodies]);
  // (The placed parts' rings go with their meshes, G1: posed and exploded by the same matrix.)
  const instancesDrawn = useMemo(() => {
    if (section) return cpuInstanceSection && sectionHatchOn
      ? instancesShown.map(it => ({ ...it, hatch: sectionHatch(it.bodies, sectionPlanes(section), hatchStep) }))
      : instancesShown;
    if (rendering || previewBodies) return instancesShown;
    return instancesShown.map(it => {
      const inst = doc.instances?.find(i => i.id === it.id), t = inst ? threadsOf(flattenAssembly(inst.doc).nodes, { ...fastenerSizesOf(doc), ...fastenerSizesOf(inst.doc) }) : null, out: number[] = [];
      if (t) for (const b of it.bodies) out.push(...threadLines(t, b.mesh));
      return out.length ? { ...it, threads: new Float32Array(out) } : it;
    });
  }, [instancesShown, doc.instances, rendering, section, previewBodies, cpuInstanceSection, sectionHatchOn, hatchStep]);

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

  const routeSessionShown = routeSession.current;
  const routeTie = routeSessionShown?.frozenStart.routeBundles?.find(b => b.id === routeSessionShown.bundleId)?.tie;
  const routeGizmo: RouteTransformGizmo | null = routePanelOpen && routeSessionShown && routeTie && routePhase !== 'error' && !routeContext.current.blocked && routeCurrent(routeSessionShown) ? {
    // Stable for the whole edit; a gesture has a different token and never changes this key.
    sessionKey: `route-bundle:${routeSessionShown.token}:${routeSessionShown.bundleId}`,
    origin: routeTie.anchorMM.map((v, k) => v + routeSessionShown.delta[k]) as Vec3, move: [0, 1, 2],
    onStart: pointerId => {
      const session = routeSession.current;
      if (!session || session !== routeSessionShown || !routeCurrent(session)) return;
      clearRouteTimer(); session.sequence++; session.gesture++; session.pointerId = pointerId;
      session.gestureBase = [...session.delta]; session.ready = undefined; session.purpose = 'draft';
      setRouteMove(session.delta.map(String) as [string, string, string]);
      setRoutePhase('draft'); setRouteError(undefined); setRoutePreviewBodies(null);
    },
    onMove: (delta, done, pointerId) => {
      const session = routeSession.current;
      if (!session || session !== routeSessionShown || pointerId === undefined || session.pointerId !== pointerId || !routeCurrent(session)) return;
      clearRouteTimer(); session.sequence++; session.ready = undefined; session.purpose = 'draft';
      try {
        // The viewport supplies total displacement from this gesture's captured origin.
        const total = session.gestureBase.map((v, k) => v + delta[k]) as Vec3;
        const candidate = moveRouteBundle(session.frozenStart, session.bundleId, total, session.frozenIdentity);
        session.delta = total; setRouteMove(total.map(String) as [string, string, string]);
        setRouteVisualDoc(candidate); setRoutePreviewBodies(null); setRoutePhase('draft'); setRouteError(undefined);
        if (done) { void routeEvaluate(session, candidate, true, false); return; }
        const sequence = session.sequence, gesture = session.gesture;
        routePreviewTimer.current = setTimeout(() => {
          routePreviewTimer.current = null;
          if (routeCurrent(session) && session.sequence === sequence && session.gesture === gesture && session.pointerId === pointerId) void routeEvaluate(session, candidate, false);
        }, 100);
      } catch (error) { routeFail(error); }
    },
    onCancel: (pointerId, _reason) => {
      const session = routeSession.current;
      if (session && session === routeSessionShown && session.pointerId === pointerId) discardRouteRef.current();
    },
  } : null;

  // Display-only draft guides reuse the existing non-pickable world-mm underlay channel.
  const routeGuideUnderlays = useMemo((): typeof underlaysShown => {
    const session = routeSession.current;
    if (!routePanelOpen || !session || !D || routePhase === 'error' || !routeCurrent(session)) return [];
    try {
      const candidate = routeVisualDoc ?? session.frozenStart;
      assertRouteBundleDocument(candidate);
      const bundle = candidate.routeBundles?.find(b => b.id === session.bundleId);
      if (!bundle || !candidate.direct) return [];
      const points = bundle.members.map(member => {
        const pole = D.polesOf(candidate.direct!, member.curveObjectId).find(p => p.key === member.handleKey);
        if (!pole || pole.at.some(v => !Number.isFinite(v))) throw new Error('The current member point is unavailable.');
        return { member, at: pole.at };
      });
      const tie = bundle.tie.anchorMM;
      const span = Math.max(...points.map(p => Math.hypot(...p.at.map((v, k) => v - tie[k]))));
      const height = Math.max(0.5, span * 0.05), radius = height * 0.25;
      const guides: typeof underlaysShown = [];
      const key = (kind: 'point' | 'line' | 'label', owner: 'member' | 'tie', id: string) => {
        let value = JSON.stringify(['route-bundle-draft', session.token, bundle.id, kind, owner, id]);
        while (underlaysShown.some(u => u.id === value)) value = '_' + value;
        return value;
      };
      const text = (at: Vec3, value: string) => ({ at, dir: [1, 0, 0] as Vec3, up: [0, 1, 0] as Vec3, text: value, height });
      for (const { member, at } of points) {
        const cross = [0, 1, 2].map(axis => [
          at.map((v, k) => v - (k === axis ? radius : 0)) as Vec3,
          at.map((v, k) => v + (k === axis ? radius : 0)) as Vec3,
        ]);
        const letter = member.id === bundle.members[0].id ? 'A' : 'B';
        guides.push({ id: key('line', 'member', member.id), lines: [[tie, at]], texts: [] },
          { id: key('point', 'member', member.id), lines: cross, texts: [] },
          { id: key('label', 'member', member.id), lines: [], texts: [text([at[0] + (letter === 'A' ? -height : height * 0.4), at[1] + height * 0.4, at[2]], letter)] });
      }
      const diamond: Vec3[] = [[tie[0], tie[1] + radius, tie[2]], [tie[0] + radius, tie[1], tie[2]],
        [tie[0], tie[1] - radius, tie[2]], [tie[0] - radius, tie[1], tie[2]], [tie[0], tie[1] + radius, tie[2]]];
      guides.push({ id: key('point', 'tie', bundle.tie.id), lines: [diamond], texts: [] },
        { id: key('label', 'tie', bundle.tie.id), lines: [], texts: [text([tie[0] + height * 0.4, tie[1] + height * 0.8, tie[2]], 'Tie')] });
      return guides;
    } catch { return []; } // No guessed coordinates or source repair when a binding is unavailable.
  }, [routePanelOpen, routeVisualDoc, routeViewDoc, routePhase, routeMove, doc, D, underlaysShown, busy, fresh, marker, active, sketch, rendering, drawing, measure, assembly.draft, cageEd.session, skel.session, ghost]);
  const viewportUnderlays = useMemo(() => routeGuideUnderlays.length ? [...underlaysShown, ...routeGuideUnderlays] : underlaysShown, [underlaysShown, routeGuideUnderlays]);

  // The picked pole's gizmo: drag it along an axis; let go, the curve or surface is edited (one undo step).
  const poleMode = !routePanelOpen && !active && !sketch && !rendering && !drawing && !measure && !assembly.draft;
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
  // (G12e: the history bar's whole chips — those past its room hidden, a "+n" chip opening the rest.)
  const historyBar = useRef<HTMLDivElement>(null), [historyRows, setHistoryRows] = useState(false), [historyLabels, setHistoryLabels] = useState(false);
  const historyShown = !sketch && !active && !rendering;
  const { hidden: historyHidden, natural: historyNaturalNow } = useFitChips(historyBar, historyRows, [doc.nodes, markerAt, !!sketch, !!active, rendering, historyLabels, bottomRow.stacked, bottomRow.cramped]);
  useEffect(() => setHistoryNatural(historyNaturalNow), [historyNaturalNow]);
  const sel1 = selection.faces[0] ? { kind: 'face' as const, body: bodies[selection.faces[0].body], face: bodies[selection.faces[0].body]?.mesh.faces[selection.faces[0].face] }
    : selection.edges[0] ? { kind: 'edge' as const, body: bodies[selection.edges[0].body], edge: bodies[selection.edges[0].body]?.mesh.edges[selection.edges[0].edge] } : null;
  const selBodies = selectedBodies(selection).map(i => bodies[i]).filter(Boolean);

  // Match the actual viewport props. Unsupported contexts keep the requested session mode,
  // show the safe default, and restore the request when ordinary modelling is available.
  // G22 consumes the actual Model API in its own worker; only the current evaluated pose can reach the Canvas.
  const clearanceDoc = useMemo(() => prefixDoc(doc, marker ?? doc.nodes.length), [doc, marker]);
  const clearanceMotions = useMemo(() => {
    const motions = new Map(instancePoseMap);
    if (instDrag) { const drag = previewMatrix(instDrag.drag), pose = motions.get(instDrag.id); motions.set(instDrag.id, pose ? multiply(drag, pose) : drag); }
    bodies.forEach((body, index) => { const matrix = dragTransforms?.get(index), offset = animatedOffsets?.get(shownBodies.findIndex(b => b.key === body.key)); if (matrix) motions.set(body.key, matrix); else if (offset) motions.set(body.key, poseMatrix(undefined, offset)); });
    return [...motions];
  }, [instancePoseMap, instDrag, bodies, dragTransforms, animatedOffsets, shownBodies]);
  // (O10: the root's shown bodies and every placed copy's, by the one key every producer gives a body — the worker matches them exactly.)
  const clearanceVisibleKeys = useMemo(() => [...bodies.filter(b => !lookOf(doc, b).hidden).map(b => b.key), ...instancesPlaced.flatMap(i => i.bodies.map(b => `${i.id}/${b.key}`))], [bodies, doc, instancesPlaced]);
  const clearanceVisibleInstances = useMemo(() => instancesPlaced.map(i => i.id), [instancesPlaced]);
  const clearanceLabels = useMemo(() => new Map([...bodies.map(b => [b.key, bodyName(doc, b)] as const), ...(doc.instances ?? []).map(i => [i.id + '/', i.name ?? i.id] as const)]), [bodies, doc]);
  const clearanceReady = (doc.instances ?? []).filter(i => !i.hidden).every(i => instanceEvaluationCurrent(instanceBodies.get(i.id), i, instanceSources.get(i.id)));
  const clearanceReason = rendering || drawing ? 'Assembly clearance is available in Model view.'
    : sketch || previewBodies || active || ghost || assembly.draft || cageEd.overlay || skel.tool ? 'Pending · finish the current edit to classify its geometry.'
    : viewAnalysis || scalarMaps?.length || mouldShown || directShown.length ? 'Assembly clearance requires the ordinary solid view.'
    : !fresh || !clearanceReady ? 'Pending · waiting for the current source geometry.' : undefined;
  const clearanceResult = useClearanceAnalysis(clearanceEnabled && !clearanceReason, clearanceDoc, clearanceNear, clearanceMotions, clearanceVisibleKeys, clearanceVisibleInstances);
  const clearanceClip = useMemo(() => section && !sketch ? { planes: sectionPlanes(section), cutout: section.mode === 'cutout' } : undefined, [section, sketch]);
  const clearanceDisplay = useMemo(() => {
    if (!clearanceResult) return null;
    const ids = !instancePreview && isolatedInstances?.length ? isolatedInstances : null;
    const overlays = ids ? clearanceResult.overlays.map(o => ids.some(id => o.bodyKey.startsWith(id + '/')) ? o : { ...o, opacity: o.opacity * 0.15 }) : clearanceResult.overlays;
    return { ...clearanceResult, overlays, clip: clearanceClip };
  }, [clearanceResult, clearanceClip, isolatedInstances, instancePreview]);
  useEffect(() => { if (import.meta.env.DEV) (window as unknown as { __studioClearance: () => unknown }).__studioClearance = () => clearanceDisplay; }, [clearanceDisplay]);

  const printMeshes = useMemo(() => printSourceMeshes(doc, bodies), [bodies, doc.bodies, doc.nodes]);
  const printInputProblem = useMemo(() => firstProblem(checkDocumentPrintPreview(doc)), [doc]);
  const printOptions = useMemo<PrintOptions>(() => printInputProblem ? { layer: 0, supports: true, printed: true } : printOptionsOf(doc, printing?.thresholds.maxOverhangDeg.value), [printInputProblem, doc.printPreview, doc.print, printing]);
  const printReason = printInputProblem ?? (rendering || drawing ? 'Print layers are available in Model view.'
    : doc.instances?.some(i => !i.hidden) ? 'Print layers currently support root part solids. Placed assemblies are not supported.'
    : refShown.length ? 'Hide reference parts and keep-outs to preview print layers of the root part.'
    : sketch || active || previewBodies || ghost || assembly.draft || cageEd.overlay || skel.tool || bodyDrag ? 'Finish the current edit to preview print layers.'
    : section ? 'Close Section view to preview print layers. Its settings are preserved.'
    : viewAnalysis || scalarMaps?.length || mouldShown || directShown.length ? 'Close the current analysis or direct-geometry display to preview print layers.'
    : !fresh ? 'Pending · waiting for current geometry.'
    : !printMeshes.some(m => m.indices.length) ? 'No visible solid mesh to preview.' : undefined);
  const printState = usePrintLayers(printEnabled && !printReason, printMeshes, printOptions);
  const printDisplay = printEnabled && !printReason ? printState.display : null;
  useEffect(() => { if (import.meta.env.DEV) (window as unknown as { __studioPrint: () => unknown }).__studioPrint = () => ({ reason: printReason, stage: printState.stage, display: printDisplay }); }, [printReason, printState.stage, printDisplay]);
  // (G23 CNC: the root part's program from the document's machining stock, one setup at a time; the other previews closed.)
  const camReason = rendering || drawing ? 'The CNC preview is available in Model view.'
    : doc.instances?.some(i => !i.hidden) ? 'The CNC preview supports the root part. Placed assemblies are not supported.'
    : refShown.length ? 'Hide reference parts and keep-outs to preview CNC removal of the root part.'
    : sketch || active || previewBodies || ghost || assembly.draft || cageEd.overlay || skel.tool || bodyDrag ? 'Finish the current edit to preview CNC removal.'
    : section ? 'Close Section view to preview CNC removal.'
    : viewAnalysis || scalarMaps?.length || mouldShown || directShown.length ? 'Close the current analysis or direct-geometry display to preview CNC removal.'
    : !fresh ? 'Pending · waiting for current geometry.'
    : !bodies.some(b => b.mesh.indices.length) ? 'No solid to preview.' : undefined;
  const camState = useCamPreview(camEnabled && !camReason, doc, bodies, camOptions);
  const camDisplay = camEnabled && !camReason ? camState.display : null;
  const patchCam = useCallback((patch: Partial<CamOptions>) => setCamOptions(o => ({ ...o, ...patch })), []);
  // (G24: the drawing's own sheet, built as the Drawing workspace builds it, its annotations lifted onto the model.)
  const pmiReason = rendering || drawing ? '3D annotations are shown in Model view (the Drawing workspace shows the sheet).'
    : sketch || active || cageEd.overlay || skel.tool ? 'Finish the current edit to show the 3D annotations.'
    : printEnabled || camEnabled ? 'Close the print or CNC preview to show the 3D annotations.' : undefined;
  const pmiDoc = useMemo(() => ({ ...evaluated, instances: doc.instances }), [evaluated, doc.instances]);
  const pmiSheet = useDrawingSheet(pmiEnabled && !pmiReason, { engine, doc: pmiDoc, bodies, settings: doc.drawing ?? defaultDrawing(), fileName, annotations: true });
  const pmiItems = pmiEnabled && !pmiReason ? pmiSheet.annotations?.items ?? null : null;
  const pickAnnotation = useCallback((id: string) => {
    const a = pmiItems?.find(x => x.id === id); if (!a) return;
    setPmiSelected(id); const sel = pmiSelection(a, bodies);
    setInstanceSel([]); setDirectSel([]); setSelection({ faces: sel.faces, edges: sel.edges, bodies: [] });
  }, [pmiItems, bodies]);
  useEffect(() => { if (!pmiEnabled) setPmiSelected(null); }, [pmiEnabled]);
  useEffect(() => { if (import.meta.env.DEV) (window as unknown as { __studioPmi: () => unknown }).__studioPmi = () => ({ reason: pmiReason, busy: pmiSheet.busy, error: pmiSheet.error, items: pmiItems?.map(a => ({ id: a.id, kind: a.kind, text: a.text, anchor: a.anchor, targets: a.targets })) ?? null, left: pmiSheet.annotations?.left ?? null, selected: pmiSelected }); }, [pmiReason, pmiSheet.busy, pmiSheet.error, pmiItems, pmiSheet.annotations, pmiSelected]);
  useEffect(() => { if (import.meta.env.DEV) (window as unknown as { __studioCam: () => unknown }).__studioCam = () => ({ reason: camReason, stage: camState.stage, error: camState.error, display: camDisplay }); }, [camReason, camState.stage, camState.error, camDisplay]);

  const displayScopeReason = instancePreview ? 'CAD display modes are not available while an instance is dragged.'
    : assembly.draft ? 'CAD display modes are not available during an assembly edit.'
    : rendering || drawing ? 'CAD display modes are available in Model view.'
    : viewAnalysis || scalarMaps?.length || mouldShown ? 'CAD display modes are not available with analysis or mould displays.'
    : directShown.length || ghost && proposalOverlay ? 'CAD display modes are not available with direct geometry or proposal previews.'
    : sketch || cageEd.overlay || skel.tool || active || regions.length ? 'CAD display modes are not available while a sketch, cage or tool is being edited.'
    : undefined;
  const displayContextKey = JSON.stringify([displayScopeReason ?? null, !!sectionClip, !!instancesDrawn.length]);
  displayModeContext.current = displayContextKey;
  const displayModeReason = displayScopeReason
    ?? (displayModeFailure?.requested === displayMode && displayModeFailure.context === displayContextKey ? displayModeFailure.reason : undefined);
  const displayModeNotice = displayModeReason ?? displayScopeReason;
  const effectiveDisplayMode: DisplayMode = displayModeReason ? 'shaded-with-edges' : displayMode;
  const isolationSelection = snapshotInstanceIsolation(instanceSel, instancesPlaced);
  const isolationReason = displayScopeReason ? 'Isolate selection is available with ordinary solids in Model view.'
    : !isolationSelection ? 'Select a visible placed instance to isolate.' : undefined;

  // (G12a: proposals are in the chat column; while one is open the column shows it, the chat open or not.)
  const openProposals = doc.proposals?.filter(p => p.status === 'open').length ?? 0, decidedProposals = (doc.proposals?.length ?? 0) - openProposals;
  const chatColumnShown = columnShown(chat && !rendering && !drawing, openProposals, decidedProposals, decidedShown);
  // (G12e: the chosen preview's settings in the dock's Preview & analysis section, the switch its enable; the 3D annotations
  // an overlay toggle at the section's header, their status under the panel.)
  const previewPanel = previewMode === 'print' ? <PrintPanel options={printOptions} onOptions={commitPrintPreview} onDirection={commitPrintDirection} state={printState} reason={printReason} />
    : previewMode === 'cnc' ? <CamPanel options={camOptions} onOptions={patchCam} state={camState} reason={camReason} />
    : previewMode === 'clearance' ? <ClearancePanel near={clearanceNear} onNear={setClearanceNear} display={clearanceDisplay} reason={clearanceReason} labels={clearanceLabels} />
    : previewMode === 'analysis' ? <AnalysisPanel analysis={analysis} onAnalysis={setAnalysis} map={mapKind} onMap={k => { setMapHover(null); setMouldSpread(0); setMapKind(k); }}
      printing={!!printing} pull={!!doc.mould?.pull} mapsReason={viewBackend === 'webgl2' ? 'The analysis maps are drawn with WebGPU; this browser draws with WebGL2.' : undefined} />
    : null;
  const previewOverlay = <label className="overlay-toggle" title="The drawing's annotations on the model, with any preview"><input type="checkbox" checked={pmiEnabled} aria-label="3D annotations" onChange={e => setPmiEnabled(e.target.checked)} /> 3D annotations</label>;
  const previewOverlayStatus = pmiEnabled && <div role="status" className="overlay-status">{pmiReason ?? pmiSheet.error ?? (pmiSheet.busy || !pmiSheet.annotations ? 'Pending · building the drawing\'s sheet'
            : !pmiItems?.length ? 'No annotations on the model yet: dimension the part in the Drawing workspace.'
            : `${pmiItems.length} annotation${pmiItems.length === 1 ? '' : 's'} from the drawing${pmiSheet.annotations.left.length ? ` · ${pmiSheet.annotations.left.length} only on the sheet` : ''}${pmiSelected ? ` · ${pmiItems.find(a => a.id === pmiSelected)?.text.join(' ') ?? ''}` : ''}`)}</div>;
  // (G12b: the right dock — the Browser (its mount movable: browserPlacement), the running command's HUD and the inspector;
  // the HUD floats at the stage's right as before when the dock is a strip.)
  const browserPlacement = BROWSER_PLACEMENT;
  const dockDocked = layout.dockDocked(chatColumnShown ? layout.chatShown : 0);
  // (The strips over the stage's edges, left and right: the bottom row's room is the stage less them.)
  // (What the dock takes at the stage's right edge when it is not docked: its strip, and its sheet while open — the view bar,
  // the view cube and the HUD stand clear of both.)
  const dockEdge = dockDocked ? 0 : CHAT_STRIP + (layout.dockSheet ? layout.dockWidth : 0);
  useEffect(() => setStripWidth((chatColumnShown ? 0 : CHAT_STRIP) + dockEdge), [chatColumnShown, dockEdge]);
  // (A panel opened while the dock is a strip opens its sheet: the panel is in it.)
  useEffect(() => { if (!dockDocked && (bomOpen || libraryOpen || paramsOpen || routePanelOpen)) layout.setDockSheet(true); }, [dockDocked, bomOpen, libraryOpen, paramsOpen, routePanelOpen, layout.setDockSheet]);
  // Reference decisions stay in the existing Browser panel. Preview never commits a candidate.
  const referenceRowStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6, paddingBlock: 8, minWidth: 0, maxWidth: '100%', overflowWrap: 'anywhere' };
  const referenceActionsStyle: CSSProperties = { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4, minWidth: 0, maxWidth: '100%' };
  const referenceButtonStyle: CSSProperties = { minWidth: 0, maxWidth: '100%', whiteSpace: 'normal', overflowWrap: 'anywhere', textAlign: 'left' };
  const referenceDecisions = !sketch && !active && !rendering && (refMarks.length > 0 || refProblems.length > 0) ? <section aria-label="References" style={{ minWidth: 0, maxWidth: '100%', overflowWrap: 'anywhere' }}>
    <div className="ol-head">References</div>
    <div className="muted">{refMarks.length} matched again · {refProblems.length} need a choice</div>
    {refMarks.map(m => <div key={'m' + m.index} style={referenceRowStyle}>
      <p style={{ margin: 0, whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{referenceCaption(m.where)}<br /><span className="muted">{affectedDimensions(m.now)} affected dimension(s) · Matched again</span></p>
      <div style={referenceActionsStyle}>
      {referenceDimension(m.where) && <button className="ghost small" style={referenceButtonStyle} onClick={() => previewReference(m.where)}>Show dimension</button>}
      {m.edge && <button className="ghost small" style={referenceButtonStyle} onClick={() => previewReference(m.where, m.now, true)}>Preview in model</button>}
      <button className="ghost small" style={referenceButtonStyle} onClick={() => void settleRef(m.index)}>Confirm reference</button>
      <button className="ghost small" style={referenceButtonStyle} onClick={() => void showRefChoices(m.index)}>Show alternatives</button>
      </div>
      {refChoices?.index === m.index && refChoices.names.filter(n => n !== m.now).map((n, i) => <div key={n} style={referenceActionsStyle}>
        <span>Candidate {i + 1} </span>
        <button className="ghost small" style={referenceButtonStyle} onClick={() => previewReference(m.where, n)}>Preview candidate {i + 1}</button>
        <button className="ghost small" style={referenceButtonStyle} onClick={() => void settleRef(m.index, n)}>Use candidate {i + 1}</button>
      </div>)}
      <details style={{ minWidth: 0, maxWidth: '100%' }}><summary>Technical details</summary><div className="muted" style={{ overflowWrap: 'anywhere' }}>{m.where}: {m.was} → {m.now}{refChoices?.index === m.index && refChoices.names.filter(n => n !== m.now).map((n, i) => <div key={n}>Candidate {i + 1}: {n}</div>)}</div></details>
    </div>)}
    {refProblems.map(p => <div key={'p' + p.index} style={referenceRowStyle}>
      <p style={{ margin: 0, whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{referenceCaption(p.where)}<br /><span className="muted">{affectedDimensions(p.name)} affected dimension(s) · {p.candidates.length ? 'Choose a reference' : 'Reference missing'}{p.node !== null ? ' · Feature held' : ''}</span></p>
      <div style={referenceActionsStyle}>
      {referenceDimension(p.where) && <button className="ghost small" style={referenceButtonStyle} onClick={() => previewReference(p.where)}>Show dimension</button>}
      </div>
      {p.candidates.map((n, i) => <div key={n} style={referenceActionsStyle}>
        <span>Candidate {i + 1} </span>
        <button className="ghost small" style={referenceButtonStyle} onClick={() => previewReference(p.where, n)}>Preview candidate {i + 1}</button>
        <button className="ghost small" style={referenceButtonStyle} onClick={() => previewReference(p.where, n, true)}>Preview in model</button>
        <button className="ghost small" style={referenceButtonStyle} onClick={() => void settleRef(p.index, n)}>Use candidate {i + 1}</button>
      </div>)}
      <details style={{ minWidth: 0, maxWidth: '100%' }}><summary>Technical details</summary><div className="muted" style={{ overflowWrap: 'anywhere' }}>{p.where}: {p.name}{p.candidates.map((n, i) => <div key={n}>Candidate {i + 1}: {n}</div>)}</div></details>
    </div>)}
  </section> : null;
  const browserPanel = (
      <Profiler id="outliner" onRender={onBlockRender}><aside className={'card outliner' + (browserOpen ? '' : ' closed')} aria-label="Browser">
        <div className="card-title">BROWSER <span className="muted" aria-busy={!fresh}>Base part · {fresh ? `${bodies.length} bod${bodies.length === 1 ? 'y' : 'ies'}` : busy ? 'evaluating…' : 'not up to date'}</span>
          <ToolIconButton size="tiny" aria-label={browserOpen ? 'Collapse the browser' : 'Expand the browser'} onClick={() => setBrowserOpen(o => { try { localStorage.setItem('cad-studio.browser', o ? 'closed' : 'open'); } catch { /* private mode */ } return !o; })}><Icon name={browserOpen ? 'left_panel_close' : 'left_panel_open'} small /></ToolIconButton></div>
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
        {!!doc.instances?.length && <div className="ol-head">Parts placed <span className="muted">{doc.instances.length}</span></div>}
        <OutlinerInstances instances={doc.instances ?? NO_INSTANCES} selection={instanceSel} edit={instanceEdit} locked={!!active || !!sketch || rendering || drawing}
          onPick={pickInstanceRow} onEdit={editInstanceRow} iconFor={iconFor} />
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
          <ToolIconButton size="tiny" state={failingOnly ? 'on' : 'idle'} aria-label="Failing only" data-tip={failingOnly ? 'Show all' : 'Failing only'} onClick={() => setFailingOnly(f => !f)}><Icon name="filter_list" small /></ToolIconButton></div>
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
        {!!doc.history?.length && <><div className="ol-head req-head">Design history <span className="muted">{doc.history.length}</span>
          <ToolIconButton size="tiny" state={historyOpen ? 'on' : 'idle'} aria-label="Show design history" data-tip={historyOpen ? 'Hide' : 'Show'} onClick={() => setHistoryOpen(f => !f)}><Icon name={historyOpen ? 'expand_less' : 'expand_more'} small /></ToolIconButton></div>
        <div className="empty history-note">Saved with the part, chat messages included. <button className="link" onClick={saveShared}>Save a copy without it</button> to share.</div>
        {historyOpen && doc.history.slice(-40).reverse().map(h => <div key={h.id} className={'hist ' + h.kind} title={h.prompt ?? h.plan ?? h.summary}>
          <span className="mono muted">{h.kind}</span> {h.kind === 'prompt' ? `“${(h.prompt ?? '').slice(0, 80)}${(h.prompt?.length ?? 0) > 80 ? '…' : ''}”` : h.summary}
          {h.kind === 'prompt' && h.summary && <span className="muted"> → {h.summary}</span>}
          <span className="muted"> · {h.by.agent}{h.by.model ? ` (${h.by.model})` : ''} · {whenOf(h.at)}</span></div>)}</>}
        {referenceDecisions}
        {!bodies.length && !doc.instances?.length && !busy && <div className="empty">No bodies yet.</div>}
        </>}
      </aside></Profiler>
  );
  const inspector = (
      <Profiler id="right-col" onRender={onBlockRender}><div className="right-col">

      {sketch && <SketchPanel sketch={sketch} toolLabel={TOOLS.find(t => t.tool === sketch.tool)!.label} error={sketchError} onShape={updateShape} onPlace={sketch.editNode === undefined ? placeSketch : undefined} onUi={patch => setSketch(s => s && { ...s, ...patch })} onOffset={offsetSketch} onLinkedInset={sketch.anchor?.kind === 'face' && sketch.anchor.face?.linkSource && !sketch.anchor.offset && !sketch.anchor.angle ? linkSketchInset : undefined} onToCurves={sketchToCurves} onUseOutline={sketch.anchor?.kind === 'face' && sketch.anchor.face?.outline?.length && !sketch.anchor.offset && !sketch.anchor.angle
        ? (asRefs: boolean) => setSketch(s => s && { ...detachSketchLink(s), shape: null, done: [...(s.done ?? []), ...(s.shape ? [s.shape] : []), ...(s.anchor?.face?.outline ?? []).map(x => asRefs ? { ...x, construction: true as const } : x)] }) : undefined} />}
      {bomOpen && !libraryOpen && !paramsOpen && !rendering && !drawing && !sketch && !active && <BomPanel doc={doc} name={fileName} evaluate={d => engine.part(d, revision.current++, 'read')} onCommit={next => commit(next, false)} onClose={() => setBomOpen(false)} onError={(title, hint) => setToast({ title, hint, detail: '' })} />}
      {rebuildOpen && !bomOpen && !libraryOpen && !paramsOpen && !rendering && !drawing && !sketch && !active && <RebuildPanel store={rebuildStore} problems={assembly.problems} mode={effectiveDisplayMode} viewport={viewport} onClose={() => setRebuildOpen(false)} />}
      {versionsOpen && !variantsOpen && !bomOpen && !libraryOpen && !paramsOpen && !rendering && !drawing && !sketch && !active && <VersionsPanel project={project} doc={doc} fileName={fileName} comparing={compareBase?.id ?? null} onCompare={setCompareBase}
        onInsert={path => void project.fileOf(path).then(f => { if (f) void insertPart(f, linkSource(path)); })}
        onOpen={d => { setCompareBase(null); replaceDoc(d, true); setDirty(true); setTimeout(() => viewport.current?.fit(), 300); }} />}
      {variantsOpen && !bomOpen && !libraryOpen && !paramsOpen && !rendering && !drawing && !sketch && !active && <VariantsPanel doc={doc} variants={variants} onCommit={next => commit(next, false)} onError={hint => setToast({ title: 'Variants: refused', hint, detail: '' })} onClose={() => setVariantsOpen(false)} />}
      {libraryOpen && !paramsOpen && !rendering && !drawing && !sketch && !active && <LibraryPanel doc={doc} onCommit={next => commit(next)} onClose={() => setLibraryOpen(false)} onError={(title, hint) => setToast({ title, hint, detail: '' })} onQuote={() => { void exportQuote(); }} />}
      {paramsOpen && !rendering && !drawing && !sketch && !active && <ParametersPanel doc={doc} onClose={() => setParamsOpen(false)}
        onChange={p => {
          const request = ++parameterRequest.current;
          const cancelCandidate = () => {
            if (parameterEdit?.base === doc && acceptedEvaluation.current) parameterHandoff.current = { target: doc, ...acceptedEvaluation.current, result: { ...acceptedEvaluation.current.result, bodies } };
            if (parameterMass.current && !parameterMass.current.target) parameterMass.current = null;
            setParameterEdit(null);
          };
          // (O140: the skeletons bound to a parameter re-solved with it — a conflict refused, the parameter named, nothing changed.)
          let r: ReturnType<typeof resolveSkeletons>;
          try { r = resolveSkeletons({ ...doc, ...p, ...(p.configurations ? {} : { configurations: undefined }) }); }
          catch (e) { cancelCandidate(); if (!isRefusal(e, ...SKELETON_CODES)) throw e; setToast({ title: 'That value does not hold', hint: e.message.replace(/^\[\w+\] /, ''), detail: 'The parameters are as they were.' }); return; }
          if (!fresh || !massReady || shownVariant.current || refProblems.length) { cancelCandidate(); setToast({ title: 'Parameters not changed', hint: refProblems.length ? 'Choose the unresolved references first.' : !massReady ? 'Wait for the accepted part’s mass results before changing parameters.' : 'Wait for the accepted part to finish evaluating.', detail: '' }); return; }
          // Keep deferred mass updates with the accepted result when a candidate is refused.
          if (acceptedEvaluation.current) acceptedEvaluation.current = { ...acceptedEvaluation.current, result: { ...acceptedEvaluation.current.result, bodies } };
          if (parameterMass.current && !parameterMass.current.target) parameterMass.current = null;
          setParameterEdit({ request, base: doc, baseInput: evaluated, input: prefixDoc(r.doc, r.doc.nodes.length), next: r.doc, accept: next => commit(next, false) });
        }} onError={m => setToast({ title: 'Parameters', hint: m, detail: '' })} />}
      {rendering && !sketch && <Suspense fallback={null}><RenderPanel render={render} onError={m => setToast({ title: 'Could not use that image', hint: m, detail: '' })} available={viewport.current?.backend === 'webgpu'}
        selectedKeys={[...selectedBodies(selection).map(i => bodies[i]?.key).filter((k): k is string => !!k), ...instanceSel.map(id => 'inst:' + id)]}
        onChange={commitRender} onExport={exportImage} fov={fov} onPickFocus={done => viewport.current?.pickRenderFocus(done)}
        onCreatePathTrace={() => viewport.current?.createRenderPathTrace() ?? Promise.reject(new Error('The viewport is not ready.'))} imageName={`${fileName}.png`}
        onFov={deg => { const c = viewport.current?.getCamera(); if (c) { viewport.current?.setCamera({ ...c, fovY: deg * Math.PI / 180 }); setFov(deg); } }}
        onSaveCamera={() => { const c = viewport.current?.getCamera(); if (c) commitRender({ ...render, camera: c }); }}
        onUseCamera={() => { if (render.camera) { viewport.current?.setCamera(render.camera); setFov(Math.round(render.camera.fovY * 180 / Math.PI)); } }} /></Suspense>}
      {!rendering && !sketch && measure && <aside className="card props" aria-label="Measurement">
        <div className="card-title">MEASURE <ToolIconButton size="tiny" aria-label="Done measuring" onClick={() => setMeasure(null)}><Icon name="close" small /></ToolIconButton></div>
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
        if (selectedBearingEdit) {
          if (bomOpen || libraryOpen || paramsOpen || drawing || active) return null;
          const session = selectedBearingEdit.session;
          return <aside className="card props" aria-label="Part bearing properties">
            <div className="card-title">{inst.name} <ToolIconButton size="tiny" aria-label="Back to part properties" onClick={() => setInstanceEdit(null)}><Icon name="arrow_back" small /></ToolIconButton></div>
            {session ? <NodeEditor key={`${session.owner}:${session.index}`} nodes={session.view.nodes} parameters={session.view.parameters} index={session.index}
              bearingAssembly={{ root: doc, owner: session.owner }} pending={instanceEditPending}
              onRefuse={hint => setToast({ title: 'Bearing not changed', hint, detail: '' })}
              onApply={nodes => void applyInstanceBearing(session, nodes)} onClose={() => setInstanceEdit(null)} />
              : <div className="empty warn" role="alert">{selectedBearingEdit.error}</div>}
          </aside>;
        }
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
      {!rendering && !sketch && !measure && jointTree && !assembly.draft && !instanceSel.length && <JointsPanelLive poseStore={poseStore} tree={jointTree} masses={jointMasses} instances={doc.instances ?? []}
        onValue={(k, v) => { stopMotion(); setJointPlaying(null); setJointValues(x => ({ ...x, [k]: v })); }} onHome={() => { stopMotion(); setJointPlaying(null); setJointValues({}); }} playing={jointPlaying} onPlay={k => { stopMotion(); setJointPlaying(k); }} links={linkInertias}
        motionState={{ time: motionTime, inputs: jointInputStore, context: loopMotionContext, motion, waypoints: jointWaypoints, playing: motionPlaying, loop: motionLoop, speed: motionSpeed,
          contact: contactShown && motionContact ? `Contact ${jointTree.links.find(x => x.id === motionContact.links[0])?.name ?? motionContact.links[0]} – ${jointTree.links.find(x => x.id === motionContact.links[1])?.name ?? motionContact.links[1]} at t ${motionContact.toi.toFixed(2)} s` : null,
          chosenDuration: chosenMotion.duration, chosenProblem: chosenMotion.problem,
          controls: { onPlay: playMotion, onPause: () => setMotionPlaying(false), onTime: scrubMotion, onLoop: setMotionLoop, onSpeed: setMotionSpeed,
            onExportVideo: () => { const m = freezeMotion(); if (!m) return; setMotionPlaying(false); void recordVideo(m.duration, t => showMotionAt(m, t), `${fileName}-${motionChoice ?? 'motion'}.webm`); }, exporting: videoBusy,
            saved: (doc.robot?.motions ?? []).map(m => m.name), choice: motionChoice, onChoose: setMotionChoice,
            // (The draft kept in the document: replacing one of the same name; an undo step, the file dirty.)
            onSave: name => {
              let path; try {
                const draft = draftPath(jointTree, jointWaypoints, readJointInputs());
                if (jointTree.loops.length) timedMotion(draft, loopMotionContext);
                path = motionOf(jointTree, draft);
              } catch (e) { setToast({ title: 'Could not save the motion', hint: e instanceof Error ? e.message : String(e), detail: '' }); return; }
              pushUndo(); const robot = { ...(doc.robot ?? { version: 1 as const }) };
              robot.motions = [...(robot.motions ?? []).filter(m => m.name !== name), { name, path }];
              setDoc({ ...doc, robot }); setDirty(true); setMotionChoice(name);
            } } }}
        onExportUrdf={() => {
          // (RM4: the bodies as placed, so each part's placement is the identity here; the same robot as from part coordinates.)
          const r = exportUrdf(jointTree, p => { if (p === BASE) return { doc, bodies, position: [0, 0, 0], rotation: [0, 0, 0] }; const i = doc.instances?.find(x => x.id === p), b = instanceBodies.get(p); return i && b ? { doc: i.doc, bodies: b.bodies, position: [0, 0, 0], rotation: [0, 0, 0] } : null; }, fileName);
          if (!r.ok) { setToast({ title: 'URDF refused', hint: r.refusals.map(x => x.message).join(' '), detail: r.refusals.map(x => x.code).join(', ') }); return; }
          void writeZip([{ name: 'robot.urdf', data: new TextEncoder().encode(r.urdf), deflate: true }, ...r.files.map(f => ({ name: f.path, data: f.data, deflate: true })), { name: 'robot.source.json', data: sourceBytes(sourceRecord(doc, ['robot.urdf', ...r.files.map(f => f.path)], { robot: true })), deflate: true }]).then(z => downloadBytes(z, `${fileName}-urdf.zip`, 'application/zip'));
          if (r.notes.length) setToast({ title: 'URDF written', hint: r.notes.join(' '), detail: '' });
        }}
        waypoints={jointWaypoints.length} onAddWaypoint={() => {
          const v = readJointInputs();
          try {
            if (jointTree.loops.length) timedMotion(draftPath(jointTree, jointWaypoints, v), loopMotionContext);
            const fk = jointTree.loops.length ? null : poseKinematics(jointTree, v);
            setJointWaypoints(w => [...w, { ...(fk?.values ?? v) }]);
          } catch (error) { reportMotionError(error); }
        }} onClearWaypoints={() => { setJointWaypoints([]); setPathCheck(null); }}
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
        path={pathCheck} ready={robotReady}
        onCheckPath={() => {
          try { refuseMotionSweep(jointTree); }
          catch (error) { setToast({ title: 'Path check refused', hint: error instanceof Error ? error.message : String(error), detail: '' }); return; }
          // (RM6, RM9a: the timed path from the solved pose through the waypoints to the sliders', the links as placed; each
          // segment a trapezoid within the joints' velocity limits — 1 rad/s or 100 mm/s where none is set — and twice that
          // per second's acceleration; the whole path certified, or its time of impact.)
          const links = sweepLinks(jointTree, p => p === BASE ? bodies : instanceBodies.get(p)?.bodies, pts => convexHull(pts).positions);
          const { limits, assumed } = pathLimits(jointTree);
          const r = sweepTimed(jointTree, links, { waypoints: [{}, ...jointWaypoints, poseStore.get()], profile: 'trapezoid', limits });
          const name = (l: string) => jointTree.links.find(x => x.id === l)?.name ?? l, total = r.segments.reduce((t, g) => t + g.duration, 0), n = r.segments.length;
          const note = assumed.length ? `; no velocity limit on ${assumed.join(', ')}: 1 rad/s (100 mm/s) taken` : '';
          setPathCheck(r.toi !== undefined ? { contact: true, text: `Contact ${name(r.links![0])} – ${name(r.links![1])} at ${(total > 0 ? r.toi / total * 100 : 0).toFixed(1)} % of the move, t ${r.toi.toFixed(3)} s${n > 1 ? ` (segment ${r.segment! + 1} of ${n})` : ''} (${r.samples} steps${note})` }
            : { contact: false, text: `Clear: the whole move certified, ${total.toFixed(3)} s${n > 1 ? ` over ${n} segments` : ''} (${r.samples} steps${note})${r.minClearance ? `; least clearance ${r.minClearance.mm.toFixed(2)} mm at t ${r.minClearance.t.toFixed(3)} s, ${name(r.minClearance.links[0])} – ${name(r.minClearance.links[1])}` : ''}` });
        }}
        onExportMjcf={() => {
          // (RM5: as the URDF, the same parts; robot.xml and its meshes.)
          const r = exportMjcf(jointTree, p => { if (p === BASE) return { doc, bodies, position: [0, 0, 0], rotation: [0, 0, 0] }; const i = doc.instances?.find(x => x.id === p), b = instanceBodies.get(p); return i && b ? { doc: i.doc, bodies: b.bodies, position: [0, 0, 0], rotation: [0, 0, 0] } : null; }, fileName);
          if (!r.ok) { setToast({ title: 'MJCF refused', hint: r.refusals.map(x => x.message).join(' '), detail: r.refusals.map(x => x.code).join(', ') }); return; }
          void writeZip([{ name: 'robot.xml', data: new TextEncoder().encode(r.xml), deflate: true }, ...r.files.map(f => ({ name: f.path, data: f.data, deflate: true })), { name: 'robot.source.json', data: sourceBytes(sourceRecord(doc, ['robot.xml', ...r.files.map(f => f.path)], { robot: true })), deflate: true }]).then(z => downloadBytes(z, `${fileName}-mjcf.zip`, 'application/zip'));
        }}
        onExportSdf={() => {
          // (RM9c: as the URDF and MJCF, the same parts; each planar loop closed at its pin, RM8.)
          const r = exportSdf(jointTree, robotPartOf, fileName, robotClosures());
          if (!r.ok) { setToast({ title: 'SDF refused', hint: r.refusals.map(x => x.message).join(' '), detail: r.refusals.map(x => x.code).join(', ') }); return; }
          void writeZip([{ name: 'robot.sdf', data: new TextEncoder().encode(r.sdf), deflate: true }, ...r.files.map(f => ({ name: f.path, data: f.data, deflate: true })), { name: 'robot.source.json', data: sourceBytes(sourceRecord(doc, ['robot.sdf', ...r.files.map(f => f.path)], { robot: true })), deflate: true }]).then(z => downloadBytes(z, `${fileName}-sdf.zip`, 'application/zip'));
          if (r.notes.length) setToast({ title: 'SDF written', hint: r.notes.join(' '), detail: '' });
        }}
        onExportUsd={() => {
          const r = exportUsd(jointTree, robotPartOf, fileName, robotClosures());
          if (!r.ok) { setToast({ title: 'USD refused', hint: r.refusals.map(x => x.message).join(' '), detail: r.refusals.map(x => x.code).join(', ') }); return; }
          downloadBytes(new TextEncoder().encode(r.usda), `${fileName}.usda`, 'model/vnd.usda');
          downloadBytes(sourceBytes(sourceRecord(doc, [`${fileName}.usda`], { robot: true })), `${fileName}.source.json`, 'application/json');
          if (r.notes.length) setToast({ title: 'USD written', hint: r.notes.join(' '), detail: '' });
        }}
        onBase={b => { pushUndo(); const robot = { ...(doc.robot ?? { version: 1 as const }) }; if (b === BASE) delete robot.base; else robot.base = b; setDoc({ ...doc, robot }); setDirty(true); }} />}
      {!rendering && !drawing && !sketch && !measure && !instanceSel.length && <GravityExperimentPanel doc={doc} joints={jointTree?.joints ?? []} />}
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
        <div className="card-title">INTERFERENCE <ToolIconButton size="tiny" aria-label="Close interference" onClick={() => setClashes(null)}><Icon name="close" small /></ToolIconButton></div>
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
          <div className="kv">Area <b>{fmt(Math.round(sel1.face.area * 100) / 100)} mm²</b></div>
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
            {/* (O18: a mass still being worked out reads "…", never 0 or the last revision's.) */}
            {b.volume !== null ? <div className="kv">Volume <b>{fmt(Math.round(b.volume))} mm³</b></div> : b.massRef !== undefined ? <div className="kv">Volume <b aria-label="Mass pending">…</b></div> : null}
            {/* (O179: a volume the kernel found from the mesh, said so with its bound — its mass is as good.) */}
            {b.volume !== null && b.volumeBasis && <div className="kv warn" aria-label="Volume basis" title="The kernel could not integrate this body: its volume, mass and centre of mass are from the display mesh">From the mesh <b>± {b.volumeBasis.bound === null ? '?' : fmt(Math.round(b.volumeBasis.bound * 10) / 10)} mm³</b></div>}
            {(() => { const own = MATERIALS.find(m => m.id === materialIdOf(doc, b)) ?? density; return <>
              {b.volume !== null ? <div className="kv">Mass <b>{fmt(Math.round(b.volume * own.density / 100) / 10)} g</b></div> : b.massRef !== undefined ? <div className="kv">Mass <b>…</b></div> : null}
              {/* The body's own material (the default for new bodies stays the studio's). */}
              <label className="kv"><span>Material{!look.material && <span className="muted"> · {briefMaterial(doc) ? 'from the brief' : 'default'}</span>}</span><select aria-label="Material" value={own.id} onChange={e => commit(withLook(doc, b, { material: e.target.value === (briefMaterial(doc) ?? material) ? undefined : e.target.value }))}>{MATERIALS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}</select></label>
              {own.id !== material && <div className="kv"><span /><button className="ghost small" onClick={() => setMaterial(own.id)} data-tip="Default material" data-tip-desc="Bodies without a material of their own use it">Use as default</button></div>}
            </>; })()}
            {(() => { const top = evaluated.nodes[refOf(b).node], made = top && 'made' in top ? top.made : undefined, sizes = fastenerSizesOf(doc), t = made?.command === 'fastener' ? fastenerThread(made.values, sizes) : null;
              return t ? <><div className="kv">Part <b>{fastenerName(made!.values, sizes)}</b></div><div className="kv">Thread <b>M{t.d}×{t.pitch} {t.hand} · {t.internal ? 'internal' : 'external'}</b></div><div className="kv muted">Cosmetic thread: no helical geometry; nominal sizes from your fastener rows — check the standard before manufacture.</div></> : null; })()}
            {b.centroid ? <div className="kv">Centre of mass <b>{b.centroid.map(v => fmt(Math.round(v * 100) / 100)).join(', ')}</b></div> : b.massRef !== undefined ? <div className="kv">Centre of mass <b>…</b></div> : null}
            {(() => { const own = MATERIALS.find(m => m.id === materialIdOf(doc, b)) ?? density, mp = bodyMass(b, own.density); if (!mp) return null;
              const I = inertiaAt === 'origin' ? inertiaAbout(mp.inertia, mp.mass, mp.centroid, [0, 0, 0]) : mp.inertia;
              return <>
                <label className="kv"><span>Inertia</span><select aria-label="Inertia about" value={inertiaAt} onChange={e => setInertiaAt(e.target.value as 'centre' | 'origin')}><option value="centre">about the centre of mass</option><option value="origin">about the origin</option></select></label>
                <div className="kv inertia" aria-label="Moments of inertia">Ixx Iyy Izz <b>{[0, 1, 2].map(k => sig3(I[k][k])).join(' · ')} g·mm²</b></div>
                <div className="kv inertia muted">Ixy Iyz Ixz <b>{[[0, 1], [1, 2], [0, 2]].map(([i, j]) => sig3(I[i][j], Math.max(I[0][0], I[1][1], I[2][2]))).join(' · ')}</b></div>
              </>; })()}
            {/* (The kernel's area over the exact surfaces, as mass properties; the display mesh's only where it cannot, said.) */}
            <div className="kv" title={b.areaBasis === 'display mesh' ? 'From the display mesh: the kernel could not integrate this body' : 'Over the exact surfaces'}>Surface area <b>{fmt(Math.round(b.area ?? b.mesh.faces.reduce((t, f) => t + f.area, 0)))} mm²{b.areaBasis === 'display mesh' ? ' (mesh)' : ''}</b></div>
            <div className="kv">Faces <b>{b.mesh.faces.length}</b></div>
            {b.notes?.map((n, k) => <div key={k} className={'hint' + (n.warning ? ' warn' : ' muted')} aria-label="Generator note">{n.warning && <Icon name="warning" small />} {n.text}</div>)}
            {b.sheet && <div className="kv"><span>K <b>{b.sheet.bendTable ? `bend table ${b.sheet.bendTable}` : b.sheet.kFactor}</b></span><label className="ghost small" data-tip="Bend table" data-tip-desc="Load your shop's bend table (JSON: rows of thickness, radius and angle to K, allowance or deduction, each citing a source or marked an estimate) for this sheet's bends">Bend table…<input type="file" accept=".json,application/json" aria-label="Bend table file" style={{ display: 'none' }} onChange={e => { const file = e.currentTarget.files?.[0]; e.currentTarget.value = ''; void loadBendTable(b, file); }} /></label></div>}
            {b.flat && <div className="kv"><span>Flat pattern <b>{fmt(Math.round(b.flat.box.max[0] * 100) / 100)} × {fmt(Math.round(b.flat.box.max[1] * 100) / 100)}</b></span><button className="ghost small" aria-label="Show the flat pattern" data-tip="Flat pattern" data-tip-desc="The sheet unfolded: its outline, bend lines and notes; export it as DXF" onClick={() => setFlatView(b.key)}>Flat</button></div>}
            {b.cutPiece && <div className="kv"><span>Cut list <b>{fmt(Math.round(b.cutPiece.axisLength * 100) / 100)} mm</b></span><button className="ghost small" aria-label="Show the cut list" data-tip="Cut list" data-tip-desc="The frame's members to cut: identical ones on a row, their lengths, end cuts and mass; export it as CSV" onClick={() => setCutListView(true)}>Cut list</button></div>}
            <PointTest mesh={b.mesh} />
            {b.pieces && <div className="kv"><span>Pieces <b>{b.pieces}</b></span><button className="ghost small" aria-label="Separate the pieces" data-tip="Separate" data-tip-desc="Make each piece a body of its own (to move, colour or cut on its own)" onClick={() => separate(b)}>Separate</button></div>}
          </div>; })}
          {selBodies.length > 1 && selBodies.some(b => b.massRef !== undefined) && <div className="kv">Together <b aria-label="Mass pending">…</b></div>}
          {selBodies.length > 1 && !selBodies.some(b => b.massRef !== undefined) && (() => { const parts = selBodies.flatMap(b => { const m = bodyMass(b, (MATERIALS.find(x => x.id === materialIdOf(doc, b)) ?? density).density); return m ? [m] : []; }), c = combined(parts), box = boundsOf(selBodies);
            return c && box ? <><div className="kv">Together <b>{fmt(Math.round(c.mass * 10) / 10)} g</b></div><div className="kv">Centre of mass <b>{c.centroid.map(v => fmt(Math.round(v * 100) / 100)).join(', ')}</b></div>
              <div className="kv">Bounds <b>{[0, 1, 2].map(k => fmt(Math.round((box.max[k] - box.min[k]) * 100) / 100)).join(' × ')}</b></div></> : null; })()}
        </>}
        {!sel1 && !selBodies.length && bodies.length > 0 && fresh && !sketch && !massReady && <div className="part-summary"><div className="card-title">PART · {bodies.length} {bodies.length === 1 ? 'body' : 'bodies'}</div><div className="kv">Mass <b aria-label="Mass pending">…</b></div></div>}
        {!sel1 && !selBodies.length && bodies.length > 0 && fresh && !sketch && massReady && (() => { const parts = bodies.flatMap(b => { const m = bodyMass(b, (MATERIALS.find(x => x.id === materialIdOf(doc, b)) ?? density).density); return m ? [m] : []; }), c = combined(parts), box = boundsOf(bodies);
          return c && box ? <div className="part-summary"><div className="card-title">PART · {bodies.length} {bodies.length === 1 ? 'body' : 'bodies'}</div>
            <div className="kv">Mass <b>{fmt(Math.round(c.mass * 10) / 10)} g</b></div><div className="kv">Centre of mass <b>{c.centroid.map(v => fmt(Math.round(v * 100) / 100)).join(', ')}</b></div>
            <label className="kv"><span>Bounds <b>{[0, 1, 2].map(k => fmt(Math.round((box.max[k] - box.min[k]) * 100) / 100)).join(' × ')}</b></span><span className="kv-check"><input type="checkbox" aria-label="Show the bounding box" checked={showBox} onChange={e => setShowBox(e.target.checked)} /> box</span></label></div> : null; })()}
        {editNode !== null && <NodeEditor nodes={doc.nodes} parameters={doc.parameters} bearingAssembly={{ root: doc, owner: 'base' }} onRefuse={m => setToast({ title: 'Cannot bind that value', hint: m, detail: '' })} index={editNode} onEditSketch={(() => { const n = doc.nodes[editNode]; const s = n?.kind === 'sketch' ? editNode : n && 'sketch' in n ? n.sketch : null; return s !== null && doc.nodes[s]?.kind === 'sketch' ? () => editSketch(s) : undefined; })()} onApply={nodes => {
          const scope = bearingEditScope.current;
          const next = { ...doc, nodes: dropStaleMade(doc.nodes, nodes) };
          engine.evaluate(next, revision.current++).then(r => { if (!r || bearingEditScope.current !== scope) return; if (r.ok) commit(next); else setToast({ ...r.error, hint: 'The design was not changed. Adjust the values and try again.' }); });
        }} onDelete={() => deleteNode(editNode)} onClose={() => setEditNode(null)} />}
      </aside>}
      </div></Profiler>
  );
  // (R1d: the HUD subscribes to the command; the values it types are noted, so the App does not render for them.)
  const hud = active && <Hud store={activeStore} onChange={(key, value) => { lastTyped.current = Date.now(); handleDrag.current = null;
    setActive(a => { if (!a) return a; const values = patchValues(a.cmd, a.ctx, a.values, { [key]: value }); hudValues.current = values; return { ...a, values, preview: 'busy' }; }); }} onApply={apply} onCancel={cancel} />;
  return (
    <div className={'studio' + (historyShown ? ' has-history' : '') + (bottomRow.stacked ? ' history-stacked' : '') + (bottomRow.cramped ? ' stage-cramped' : '')} style={{ '--history-left': (browserPlacement === 'dock' ? HISTORY_LEFT_RAIL : HISTORY_LEFT) + 'px', '--strip-w': chatColumnShown ? '0px' : CHAT_STRIP + 'px', '--dock-strip-w': dockEdge + 'px', '--chat-col-w': (chatColumnShown ? layout.chatShown : CHAT_STRIP) + 'px' } as CSSProperties}>
      {/* (G12b: the top bar across the centre and the dock — the window less the chat column — the dock under it.) */}
      <Profiler id="topbar" onRender={onBlockRender}><header className="topbar">
        <span className="brand"><Icon name="deployed_code" className="accent" />barocss</span>
        <label className="doc-tab"><span className="sr">File name</span>
          <input value={fileName} onChange={e => setFileName(e.target.value)} size={Math.max(8, fileName.length)} />
          {dirty && <span className="dot" aria-label="Unsaved changes" />}</label>
        {/* Shapes: click one and place it with the pointer, or drag it onto the model. */}
        {!sketch && !rendering && !drawing && <CommandStrip list={PLACE_COMMANDS} {...placeStates} activeId={active?.cmd.id ?? null} onStart={startTool} onDragStart={toolDragStart} onDragEnd={toolDragEnd} />}
        <div className="grow" />
        <div className="mode" role="group" aria-label="Mode">
          <Button size="sm" variant={!sketch && !rendering && !drawing ? 'default' : 'ghost'} className={!sketch && !rendering && !drawing ? 'on' : ''} onClick={() => { setSketch(null); setRendering(false); setPlaying(false); setDrawing(false); }}>Model</Button>
          <Button size="sm" variant={sketch ? 'default' : 'ghost'} className={sketch ? 'on sketching' : ''} onClick={() => start(commands.find(c => c.id === 'sketch')!)}>{sketch ? `Sketch · ${planeLabel(sketch.plane)}` : 'Sketch'}</Button>
          <Button size="sm" variant={rendering ? 'default' : 'ghost'} className={rendering ? 'on' : ''} onClick={() => { setSketch(null); setActive(null); setMeasure(null); setDrawing(false); setRendering(true); }}>Render</Button>
          <Button size="sm" variant={drawing ? 'default' : 'ghost'} className={drawing ? 'on' : ''} onClick={() => { setSketch(null); setActive(null); setMeasure(null); setRendering(false); setPlaying(false); setDrawing(true); }}>Drawing</Button>
        </div>
        <div className="grow" />
        {sketch && <Button variant="default" size="default" className="finish" onClick={finishSketch}><Icon name="check" />Finish sketch <Kbd>⏎</Kbd></Button>}
        {/* (The right-hand tools fold into More tools when the bar has no room for them: ui/ToolsTray.tsx.) */}
        <ToolsTray items={[
          <ToolIconButton key="tool0" state={chat ? 'on' : 'idle'} aria-label="Chat" data-tip="Chat" data-tip-desc="Model by chat" onClick={() => setChat(v => !v)}><Icon name="chat" /></ToolIconButton>,
          <ToolIconButton key="tool1" aria-label="Undo" data-tip={undo.length ? `Undo ${describeChange(undo[undo.length - 1].doc, doc)}` : 'Nothing to undo'} data-tip-key="⌘Z" disabled={!undo.length} onClick={doUndo}><Icon name="undo" /></ToolIconButton>,
          <ToolIconButton key="tool2" aria-label="Redo" data-tip={redo.length ? `Redo ${describeChange(doc, redo[redo.length - 1].doc)}` : 'Nothing to redo'} data-tip-key="⇧⌘Z" disabled={!redo.length} onClick={doRedo}><Icon name="redo" /></ToolIconButton>,
          <ToolIconButton key="tool3" aria-label="New part" data-tip="New part" onClick={() => { replaceDoc(emptyDoc()); setFileName('Untitled'); }}><Icon name="add_box" /></ToolIconButton>,
          <span key="tool4" className="tpl-anchor"><ToolIconButton state={templatesOpen ? 'on' : 'idle'} aria-label="New from a template" data-tip="Templates" data-tip-desc="Start a part from a template, or keep this one as a template" onClick={() => setTemplatesOpen(v => !v)}><Icon name="library_add" /></ToolIconButton>
          {templatesOpen && <div className="card templates" role="menu" aria-label="Templates">
            <div className="card-title">NEW FROM A TEMPLATE</div>
            {[...BUILT_IN.map(t => ({ name: t.name, doc: t.doc(), own: false })), ...savedTemplates().map(t => ({ ...t, own: true }))].map(t => <div key={(t.own ? 'own:' : '') + t.name} className="tpl-row">
              <Button variant="ghost" size="sm" className="justify-start" role="menuitem" aria-label={`New from ${t.name}`} onClick={() => { replaceDoc({ ...t.doc, outputs: prefixDoc(t.doc, t.doc.nodes.length).outputs }); setFileName('Untitled'); setTemplatesOpen(false); setTimeout(() => viewport.current?.fit(), 300); }}>{t.name}</Button>
              {t.own && <ToolIconButton size="tiny" aria-label={`Remove template ${t.name}`} onClick={() => { removeTemplate(t.name); setTemplatesOpen(false); }}><Icon name="close" small /></ToolIconButton>}
            </div>)}
            {/* (RS1: the robot samples, each with a demo motion in its Joints card; opened as Open opens a file.) */}
            {ROBOT_SAMPLES.length > 0 && <div className="card-title mt-1" aria-label="Samples">SAMPLES · ROBOTS</div>}
            {ROBOT_SAMPLES.map(r => <div key={'sample:' + r.id} className="tpl-row">
              <Button variant="ghost" size="sm" className="justify-start" role="menuitem" aria-label={`Open sample ${r.title}`} title={r.about}
                onClick={() => { setTemplatesOpen(false); void robotSampleFile(r).then(open, e => setToast({ title: 'Could not open the sample', hint: e instanceof Error ? e.message : String(e), detail: '' })); }}>{r.title}</Button>
            </div>)}
            <div className="tpl-row add"><Input className="kv-input" aria-label="Template name" placeholder="Keep this part as…" value={templateName} onChange={e => setTemplateName(e.target.value)} onKeyDown={e => e.stopPropagation()} />
              <Button variant="ghost" size="sm" aria-label="Save as a template" disabled={!templateName.trim()} onClick={() => { if (saveTemplate(templateName.trim(), doc)) setToast({ title: 'Template saved', hint: `“${templateName.trim()}” is in Templates, in this browser.`, detail: '' }); else setToast({ title: 'Could not save the template', hint: 'This browser would not keep it (private mode or no room).', detail: '' }); setTemplateName(''); setTemplatesOpen(false); }}>Save</Button></div>
          </div>}</span>,
          <ToolIconButton key="tool5" state={libraryOpen ? 'on' : 'idle'} aria-label="Library" data-tip="Library" data-tip-desc="Catalogue parts from libraries (built-in, team, yours): insert them, snap them by their interfaces" onClick={() => setLibraryOpen(v => !v)} hidden={rendering || drawing}><Icon name="menu_book" /></ToolIconButton>,
          <ToolIconButton key="tool6" state={paramsOpen ? 'on' : 'idle'} aria-label="Parameters" data-tip="Parameters" data-tip-desc="Named sizes the part depends on, and saved sets of them (configurations)" onClick={() => setParamsOpen(v => !v)} hidden={rendering || drawing}><Icon name="function" /></ToolIconButton>,
          <ToolIconButton key="tool7" aria-label="Open" data-tip="Open" data-tip-desc="A .bcad model or a STEP file; an IGES file’s or a .barocad source’s curves and surfaces" onClick={() => fileInput.current?.click()}><Icon name="folder_open" /></ToolIconButton>,
          <ToolIconButton key="tool8" aria-label="Save" data-tip="Save" data-tip-key="⌘S" data-tip-desc={project.view.store ? `Into ${project.view.store.name}` : undefined} onClick={save}><Icon name="save" /></ToolIconButton>,
          <ToolIconButton key="tool8b" state={versionsOpen ? 'on' : 'idle'} aria-label="Project and versions" data-tip="Project & versions" data-tip-desc="Open a folder (or keep a project in this browser) to save into it, keep versions, branch and compare" onClick={() => setVersionsOpen(v => !v)} hidden={rendering || drawing}><Icon name="history" /></ToolIconButton>,
          <ToolIconButton key="tool9" aria-label="Export STL" data-tip="Export STL" data-tip-desc="A mesh for printing" onClick={askStlExport}><Icon name="download" /></ToolIconButton>,
          <ToolIconButton key="tool10" aria-label="Export 3MF" data-tip="Export 3MF" data-tip-desc="For a slicer: bodies, materials, colours, the print orientation" onClick={() => void exportThreeMf()}><Icon name="print" /></ToolIconButton>,
          <ToolIconButton key="tool11" aria-label="Export STEP" data-tip="Export STEP" data-tip-desc="The exact solids, for other CAD" onClick={() => void exportStepFile()}><Icon name="deployed_code_update" /></ToolIconButton>,
          !!doc.direct?.objects.some(o => !o.hidden) && <ToolIconButton key="tool12" aria-label="Export IGES" data-tip="Export IGES" data-tip-desc="The visible curves and surfaces" onClick={async () => {
          try { downloadBytes(new TextEncoder().encode((await loadDirect()).directIGES(doc.direct!, fileName)), `${fileName}.igs`, 'model/iges'); }
          catch (e) { setToast({ title: 'Could not write IGES', hint: e instanceof Error ? e.message : String(e), detail: '' }); }
        }}><Icon name="polyline" /></ToolIconButton>,
          (!!doc.routeBundles?.length || (doc.direct?.objects.filter(object => { try { return !!D && D.geometryOf(doc.direct!, object).kind === 'curve'; } catch { return false; } }).length ?? 0) >= 2) && <ToolIconButton key="route-bundle" state={routePanelOpen ? 'on' : 'idle'} aria-label="Route bundle" data-tip="Route bundle" data-tip-desc="Link two curve control points and their copied sweeps" disabled={routeContext.current.blocked} onClick={openRoute}><Icon name="conversion_path" /></ToolIconButton>,
          <ToolIconButton key="tool13" aria-label="Insert part" data-tip="Insert part" data-tip-desc="Another part (.bcad) as an instance" onClick={() => partInput.current?.click()}><Icon name="add_to_photos" /></ToolIconButton>,
        ].filter(Boolean)} />
        <input ref={partInput} type="file" accept=".bcad,.json" hidden aria-label="Part file" onChange={e => { const f = e.target.files?.[0]; if (f) insertPart(f); e.target.value = ''; }} />
        <input ref={fileInput} aria-label="Model file" type="file" accept=".bcad,.json,.step,.stp,.stl,.obj,.igs,.iges,.barocad,.dwg" hidden onChange={e => { const f = e.target.files?.[0]; if (f) open(f); e.target.value = ''; }} />
      </header></Profiler>
      <div className="stage">
      <SceneViewport ref={viewport} contactLinks={contactShown && motionContact ? motionContact.links : undefined} poses={{ poseStore, explodeStore, jointTree, bodies: drawnBodies, instancesPlaced, cpuInstanceSection }} liveSection={sectionLiveView} displayMode={effectiveDisplayMode} requestedDisplayMode={displayMode} displayModeReason={displayModeReason} onDisplayModeStatus={onDisplayModeStatus} onBackend={setViewBackend} bodies={cageEd.session ? cageEd.shown(shownBodies) : viewBodies} selection={cageEd.session ? emptySel : shownSelection} ghost={sketchGhost} sketch={sketch} gizmo={cageEd.session ? cageEd.gizmo : routeGizmo ?? gizmo ?? instGizmo ?? poleGizmo} cage={cageEd.overlay} onPickCage={cageEd.onPick} tool={skel.tool} regions={regions} threads={threads} analysis={rendering ? null : viewAnalysis} handles={sectionDrag.length ? sectionDrag : handles} instancePreview={instancePreview} profiles={active ? [] : profiles} onPickProfile={pickProfile} render={rendering ? render : null} printDisplay={printDisplay} printActive={printEnabled && !printReason} camDisplay={camDisplay} camActive={camEnabled && !camReason} annotations={pmiItems} annotationSelected={pmiSelected} onPickAnnotation={pickAnnotation}
        direct={directShown} directSelection={directSel} poles={poleMode ? poles : undefined} cloud={benchCloud ?? workspaceCloud} underlays={viewportUnderlays} pickedPole={poleHere?.key ?? null} onPickPole={key => poleObj && setPole(pole?.id === poleObj && pole.key === key ? null : { id: poleObj, key })} offsets={animatedOffsets} transforms={dragTransforms} instances={instancesDrawn} clearance={clearanceDisplay} isolatedInstances={displayScopeReason ? undefined : isolatedInstances} clip={sectionClip} sectionHatch={sectionHatchLines} scalarMaps={scalarMaps} onHoverScalar={scalarMaps ? setMapHover : undefined} mould={mouldShown} isoclines={isoclines} proposal={ghost ? proposalOverlay : compareOverlay} instanceSelection={assembly.draft ? assembly.highlight.instances : instanceSel} instanceFaces={mateFaces ? assembly.highlight.instanceFaces : undefined}
        placing={!!active?.placing} placeSkip={placeSkip} onSpot={onSpot}
        onPickBody={b => { if (active || section) return; setDirectSel([]); setInstanceSel([]); setSelection({ faces: [], edges: [], bodies: [b] }); }}
        onPickChain={(b, e) => { if (active || section || !bodies[b]) return; setDirectSel([]); setInstanceSel([]); setSelection({ faces: [], edges: edgeChain(bodies[b].mesh, e).map(edge => ({ body: b, edge })), bodies: [] }); }} bodyColors={bodyColors} faceColors={faceColors} pickedVertices={selection.vertices} hiddenBodies={hiddenBodies} snapStep={snapStep} pickFilter={active ? 'all' : pickFilter} hoverBody={previewBodies ? null : rowHover}
        onPick={onPick} onCursor={onCursor} onSketchShape={updateShape}
        onBoxSelect={(picked, additive) => { if (active) return; setSelection(prev => {
          const base = additive ? selectedBodies(prev) : [];
          return { faces: [], edges: [], bodies: [...new Set([...base, ...picked])] };
        }); }}
        boundsBox={showBox ? (() => { const shown = selBodies.length ? selBodies : bodies, box = shown.length ? boundsOf(shown) : null; return box ? { ...box, label: [0, 1, 2].map(k => fmt(Math.round((box.max[k] - box.min[k]) * 100) / 100)).join(' × ') } : null; })() : null}
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


      <TooltipLayer />
      <Profiler id="toolbar" onRender={onBlockRender}><nav className="card toolbar" aria-label="Tools" hidden={rendering || drawing}>
        {sketch ? (<>
          {TOOLS.map(t => (
            <ToolIconButton key={t.tool} state={sketch.tool === t.tool ? 'on' : 'idle'} data-tip={t.label} data-tip-key={t.key} data-tip-desc={t.hint} aria-label={t.label}
              onClick={() => setSketch(s => s && switchTool(s, t.tool))}><Icon name={t.icon} /></ToolIconButton>))}
          <div className="sep" />
          <ToolIconButton state={sketch.construct ? 'on' : 'idle'} data-tip="Construction" data-tip-key="X" data-tip-desc="Draw references: dashed shapes to snap to, not part of the profile" aria-label="Construction"
            onClick={() => setSketch(s => s && { ...s, construct: !s.construct })}><Icon name="cad-sk-construction" /></ToolIconButton>
          {(sketch.done ?? []).some(d => d.construction) && <ToolIconButton state={sketch.hideConstruction ? 'on' : 'idle'} data-tip={sketch.hideConstruction ? 'Show construction' : 'Hide construction'} data-tip-desc="The dashed reference shapes: hidden ones are not drawn or snapped to, and stay with the sketch" aria-label={sketch.hideConstruction ? 'Show construction' : 'Hide construction'}
            onClick={() => setSketch(s => s && { ...s, hideConstruction: !s.hideConstruction })}><Icon name={sketch.hideConstruction ? 'visibility_off' : 'visibility'} /></ToolIconButton>}
          <ToolIconButton data-tip="Clear profile" data-tip-desc="Remove every shape drawn in this sketch" aria-label="Clear profile" onClick={() => setSketch(s => s && { ...detachSketchLink(s), shape: null, done: [] })}><Icon name="ink_eraser" /></ToolIconButton>
        </>) : TOOL_GROUPS.map((g, gi) => (
          <div key={g} className="tool-group">
            {gi > 0 && <div className="sep" />}
            <CommandButtons list={GROUP_COMMANDS[gi]} {...groupStates[gi]} activeId={active?.cmd.id ?? null} onStart={startTool} onDragStart={toolDragStart} onDragEnd={toolDragEnd} />
            {/* (O147: the BOM with the inspect tools, not on the top bar — O90's shapes strip keeps its room.) */}
            {g === 'inspect' && <ToolIconButton state={bomOpen ? 'on' : 'idle'} aria-label="BOM" data-tip="Bill of materials" data-tip-desc="The parts and bought elements, bought or made, and the purchase list" onClick={() => setBomOpen(v => !v)}><Icon name="cad-bom" /></ToolIconButton>}
            {g === 'inspect' && <ToolIconButton state={rebuildOpen ? 'on' : 'idle'} aria-label="Rebuild" data-tip="Rebuild" data-tip-desc="What the last rebuild cost: each feature built or reused, its time and kernel calls" onClick={() => { setBomOpen(false); setRebuildOpen(v => !v); }}><Icon name="cad-rebuild" /></ToolIconButton>}
            {g === 'inspect' && <ToolIconButton state={variantsOpen ? 'on' : 'idle'} aria-label="Variants" data-tip="Variants" data-tip-desc="The assembly's variants: its inputs and named sets of their values, one shown regenerated from the master" onClick={() => setVariantsOpen(v => !v)}><Icon name="tune" /></ToolIconButton>}
          </div>))}
      </nav></Profiler>

      {browserPlacement === 'left' && browserPanel}

      {drawing && <Suspense fallback={null}><DrawingWorkspace key={docGeneration} engine={engine} doc={{ ...evaluated, instances: doc.instances }} bodies={bodies} settings={doc.drawing ?? defaultDrawing()} fileName={fileName} onChange={commitDrawing} onToast={setToast} referencePreview={referencePreview} onReferenceLabels={receiveReferenceLabels} /></Suspense>}

      {!dockDocked && hud}

      {rendering && !sketch && (() => {
        const i = selectedBodies(selection)[0], b = i !== undefined ? bodies[i] : undefined, ref = b ? refOf(b) : null, node = ref ? evaluated.nodes[ref.node] : null;
        return <Timeline animation={render.animation} time={time} playing={playing} bodyKey={b?.key ?? null}
          bodyLabel={node && ref ? featureLabel(node, ref.node, evaluated.nodes) : b?.key ?? ''}
          onTime={t => { setPlaying(false); setTime(t); }} onPlay={play} onChange={a => commitRender({ ...render, animation: a })}
          exporting={videoBusy} onExportVideo={() => { setPlaying(false); turnFrom.current = viewport.current?.getCamera() ?? null; void recordVideo(render.animation.duration, setTime, `${fileName}-render.webm`); }} />;
      })()}
      <Profiler id="history" onRender={onBlockRender}>{historyShown && <div className={'history' + (historyRows ? ' expanded' : '') + (historyLabels ? ' show-labels' : '')} role="group" aria-label="History" ref={historyBar}>
        <button className="history-labels" aria-label="Show history step names" aria-pressed={historyLabels} title={historyLabels ? 'Hide step names' : 'Show step names'} onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') e.stopPropagation(); }} onClick={() => setHistoryLabels(shown => !shown)}><Icon name="short_text" small /></button>
        {doc.nodes.map((n, i) => innerSteps.has(i) ? null : n.kind === 'sketch' ? (freeSketches.includes(i) ? (
          // A finished sketch no feature uses yet: click picks it as a profile (Shift adds) and opens its editor.
          <button key={i} aria-label={featureLabel(n, i, doc.nodes)} className={'hs sketch' + (i >= markerAt ? ' rolled' : '') + (selection.sketches?.includes(i) ? ' picked' : '') + (editNode === i ? ' edit' : '')} title={`${featureLabel(n, i, doc.nodes)} · click to pick it as a profile (Shift: add) · double-click to roll back here`}
            onClick={e => { pickProfile(i, e.shiftKey); setEditNode(i); }} onDoubleClick={() => setMarker(i + 1 >= totalNodes ? null : i + 1)}
            onContextMenu={e => { e.preventDefault(); setHistoryMenu({ at: { x: e.clientX, y: e.clientY }, index: i }); }}>
            <Icon name="cad-sketch" small />{historyLabels && <span className="hs-label">{featureLabel(n, i, doc.nodes)}</span>}</button>) : null) : (
          <button key={i} aria-label={featureLabel(n, i, doc.nodes)} className={'hs' + (i >= markerAt ? ' rolled' : '') + (editNode === i ? ' edit' : '') + (n.suppressed ? ' suppressed' : '') + (n.rematched || n.held ? ' rematched' : '')} title={`${featureLabel(n, i, doc.nodes)}${n.held ? ` (held: ${n.held})` : n.suppressed ? ' (suppressed)' : ''}${n.rematched ? ` · matched again: ${Object.entries(n.rematched).map(([now, was]) => `${was} → ${now}`).join(', ')}` : ''} · click to edit · double-click to roll back here`}
            onClick={() => { setEditNode(i); setInstanceSel([]); setDirectSel([]); assembly.cancel(); }} onDoubleClick={() => setMarker(i + 1 >= totalNodes ? null : i + 1)}
            onContextMenu={e => { e.preventDefault(); setHistoryMenu({ at: { x: e.clientX, y: e.clientY }, index: i }); }}>
            <Icon name={iconFor(n)} small />{historyLabels && <span className="hs-label">{featureLabel(n, i, doc.nodes)}</span>}</button>))}
        {(historyHidden > 0 || historyRows) && <button className="hs-more" aria-label={historyRows ? 'Fewer history steps' : `${historyHidden} more history steps`} aria-expanded={historyRows}
          title={historyRows ? 'Show fewer steps' : 'Show every step'} onClick={() => setHistoryRows(o => !o)}>{historyRows ? 'Less' : '+' + historyHidden}</button>}
        <button className="marker" aria-label="Roll forward to the end" title="Rollback marker · click to roll forward" onClick={() => setMarker(null)} />
        {marker !== null && <span className="muted">rolled back · {totalNodes - markerAt} hidden</span>}
      </div>}</Profiler>

      {stage !== null ? <div className="card work-bar" role="status" aria-label="Working"><span className="mono">Working… {stage}</span>
        <button className="ghost small" aria-label="Cancel the computation" title="Stop it: nothing changes" onClick={stopStage}>Cancel</button></div>
      : busy && slow && <div className="card work-bar" role="status" aria-label="Working"><span className="mono">Working…</span>
        <button className="ghost small" aria-label="Cancel the computation" title="Stop this computation and take the change back" onClick={cancelWork}>Cancel</button></div>}
      <div className="corner-left">
        <span className="mono muted">{busy ? (slow ? 'Working…' : 'Computing…') : `${ortho ? 'Orthographic' : 'Perspective'} · ${shownBodies.length} solid${shownBodies.length === 1 ? '' : 's'} · ${Math.round(lastMs)} ms`}<CursorReadout sink={cursorSink} /></span>
      </div>

      <Profiler id="corner-right" onRender={onBlockRender}><div className="corner-right" ref={cornerRight}>
        {/* (What stands above the row, stacked so nothing overlaps: the maps' legends, the previews and display
            toggles, then the section bar nearest the row. None of it covers the history bar or the timeline.) */}
        <div className="corner-stack">
    {mapLegend && <MapLegend map={mapLegend} hover={mapHover} />}
    {(mapKind === 'parting' || mapKind === 'halves') && <MouldLegend kind={mapKind} result={mouldResult} pull={!!doc.mould?.pull} spread={mouldSpread} onSpread={setMouldSpread} />}
        {/* (The previews' toggles stacked above the row, at its right: never over the history bar or the timeline.) */}
        {displayOpen && <div className="previews" role="group" aria-label="Previews">
        {/* (G21's display mode and isolate, in the column too: the Views row stays as narrow as the history bar assumes.) */}
        <div className="card views display" role="group" aria-label="Display">
          <label className="cad-display-control"><span className="sr">CAD display mode</span>
            <select aria-label="CAD display mode" aria-describedby={displayModeNotice ? 'cad-display-mode-status' : undefined} value={effectiveDisplayMode} disabled={!!displayScopeReason}
              data-display-mode-requested={displayMode} data-display-mode-effective={effectiveDisplayMode} data-display-mode-supported={!displayModeReason}
              onChange={event => { setDisplayModeFailure(null); setDisplayMode(event.target.value as DisplayMode); }}>
              {CAD_DISPLAY_MODES.map(mode => <option key={mode.value} value={mode.value}>{mode.label}</option>)}
            </select>
          </label>
          <Button size="sm" variant={isolatedInstances ? 'default' : 'ghost'} aria-label={isolatedInstances ? 'Restore view' : 'Isolate selection'} aria-pressed={!!isolatedInstances} className={isolatedInstances ? 'on' : ''}
            disabled={!isolatedInstances && !!isolationReason} title={isolatedInstances ? 'Restore the ordinary view' : isolationReason ?? 'Keep the selected instances opaque and fade the other solids'}
            onClick={() => setIsolatedInstances(current => current ? undefined : isolationSelection)}>{isolatedInstances ? 'Restore view' : 'Isolate selection'}</Button>
          {/* (Why a mode cannot apply, said where the mode is chosen: never over the panels.) */}
          {displayModeNotice && <span id="cad-display-mode-status" className="cad-display-status" role="status">{displayModeNotice} Shaded with edges is active.</span>}
        </div>
        </div>}
    {section && <SectionBar section={section} setSection={setSection} hatch={sectionHatchOn} setHatch={setSectionHatchOn} box={sectionBox} facePick={sectionFacePick} setFacePick={setSectionFacePick} onSketch={sketchSection} eye={cameraEye} />}
        </div>
        <div className="card views" role="group" aria-label="Views">
          <Button size="sm" variant={displayOpen || !!isolatedInstances || displayMode !== 'shaded-with-edges' ? 'default' : 'ghost'} aria-label="Display and previews" aria-expanded={displayOpen} className={displayOpen || !!isolatedInstances || displayMode !== 'shaded-with-edges' ? 'on' : ''}
            title="The display mode and isolate (the previews are in the dock)" onClick={() => setDisplayOpen(o => !o)}>Display</Button>
          {(['iso', 'top', 'front', 'right'] as const).map(v => <Button size="sm" variant="ghost" key={v} onClick={() => viewport.current?.setView(v)}>{v === 'iso' ? 'Iso' : v[0].toUpperCase() + v.slice(1)}</Button>)}
          <Button size="sm" variant="ghost" onClick={() => viewport.current?.fit()} title="Frame all (F)"><Icon name="fit_screen" small /></Button>
          <Button size="sm" variant={section ? 'default' : 'ghost'} className={section ? 'on' : ''} aria-label="Section view" data-tip="Section view" data-tip-desc="Cut the part open along a plane to see inside (the model is not changed)"
            onClick={() => { if (section) { setSection(null); return; } const zs = [...bodies, ...instancesPlaced.flatMap(i => i.bodies)].flatMap(b => [b.mesh.bounds.min[1], b.mesh.bounds.max[1]]); setSelection(emptySel); setSectionFacePick(null); setSection(axisSection({ axis: 'y', at: zs.length ? Math.round((Math.min(...zs) + Math.max(...zs))) / 2 : 0, keep: 'positive' })); }}>
            <Icon name="cad-split" small /></Button>

          <Button size="sm" variant={ortho ? 'default' : 'ghost'} onClick={() => setOrtho(viewport.current?.toggleOrtho() ?? false)} className={ortho ? 'on' : ''}>Ortho</Button>
          <Button size="sm" variant={ao ? 'default' : 'ghost'} onClick={() => setAo(v => !v)} className={ao ? 'on' : ''} title="Ambient occlusion">AO</Button>
          {!rendering && <Button size="sm" variant={analysis ? 'default' : 'ghost'} aria-label="Surface analysis" className={analysis ? 'on' : ''} data-tip={analysis === 'zebra' ? 'Zebra stripes' : analysis === 'curvature' ? 'Curvature map' : 'Surface analysis'}
            data-tip-desc="Click: zebra stripes (a bend or break in a stripe is a joint that is not smooth), then the curvature map (flat blue, tight red), then — for a printing process — the overhang map (red past its limit), then off"
            onClick={() => setAnalysis(a => a === null ? 'zebra' : a === 'zebra' ? 'curvature' : a === 'curvature' && printing ? 'overhang' : null)}>{analysis === 'zebra' ? 'Zebra' : analysis === 'curvature' ? 'Curv' : analysis === 'overhang' ? 'Overhang' : 'Analyse'}</Button>}
          {!rendering && viewBackend === 'webgl2' && <Button size="sm" variant="ghost" aria-label="Analysis map" disabled data-tip="Analysis map" data-tip-desc="The analysis maps (wall thickness, draft, what a 3-axis mill reaches) and the mould's parting line and halves are drawn with WebGPU; this browser draws with WebGL2">Maps</Button>}
          {!rendering && viewBackend !== 'webgl2' && <Button size="sm" variant={mapKind ? 'default' : 'ghost'} aria-label="Analysis map" className={mapKind ? 'on' : ''} data-tip="Analysis map" data-tip-desc="Click: the wall thickness (thin red, nominal green, thick orange, past the thick-section limit purple); for a part with a pull, its draft (under the least draft red, + green, − blue, the isoclines white); the share a 3-axis mill does not reach (red); for a part with a pull, its parting line, then its two halves (spread apart from the legend); then off — each legend shows the value under the pointer"
            onClick={() => { setMapHover(null); setMouldSpread(0); const pull = !!doc.mould?.pull; setMapKind(k => k === null ? 'thickness' : k === 'thickness' ? (pull ? 'draft' : 'access') : k === 'draft' ? 'access' : k === 'access' ? (pull ? 'parting' : null) : k === 'parting' ? 'halves' : null); }}>{mapKind === 'thickness' ? 'Thickness' : mapKind === 'draft' ? 'Draft' : mapKind === 'access' ? 'Access' : mapKind === 'parting' ? 'Parting' : mapKind === 'halves' ? 'Halves' : 'Maps'}</Button>}
          <Button size="sm" variant="ghost" onClick={() => setTheme(v => v === 'dark' ? 'light' : 'dark')} title="Toggle light / dark" aria-label="Toggle light or dark theme"><Icon name={theme === 'dark' ? 'light_mode' : 'dark_mode'} small /></Button>
        </div>
        {(doc.instances?.length ?? 0) > 0 && <ExplodeButton store={explodeStore} />}
        <Button size="sm" variant="secondary" className="chip snap" aria-label="Selection filter" data-tip="Selection filter" data-tip-desc="What a click picks: anything, or only faces, edges or whole bodies (click for the next)"
          onClick={() => setPickFilter(f => { const all = ['all', 'face', 'edge', 'body'] as const, n = all[(all.indexOf(f) + 1) % all.length]; try { localStorage.setItem('studio.pick', n); } catch { /* private mode */ } return n; })}>
          <Icon name="ads_click" small />{({ all: 'Pick all', face: 'Faces', edge: 'Edges', body: 'Bodies' } as const)[pickFilter]}</Button>
        <Button size="sm" variant="secondary" className="chip snap" aria-label="Snap" data-tip="Grid snap" data-tip-desc="Sketch points, placing and moves land on this step: click for the next (1, 0.5, 0.1, 5, 10 mm, off)"
          onClick={() => setSnapStep(s => { const steps = [1, 0.5, 0.1, 5, 10, 0], n = steps[(steps.indexOf(s) + 1) % steps.length]; try { localStorage.setItem('studio.snap', String(n)); } catch { /* private mode */ } return n; })}>
          <Icon name="adjust" small />{snapStep ? `Snap ${fmt(snapStep)} mm` : 'Snap off'}</Button>
        <span className="chip mono">mm</span>
      </div></Profiler>

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
      {stlAsk && <div className="toast card recovery" role="dialog" aria-label="STL export" onKeyDown={e => { e.stopPropagation(); if (e.key === 'Escape') { e.preventDefault(); cancelStlExport(); } }}>
        <Icon name="download" className="accent" />
        <div><div className="toast-title">STL export</div>
          <label className="kv"><span>Quality</span><select autoFocus aria-label="STL export quality" value={stlQuality} disabled={stlBusy} onChange={e => {
            const value = e.target.value;
            if (value === 'automatic' || value === '8' || value === '16' || value === '32') { stlGeneration.current++; setStlQuality(value); }
          }}>
            <option value="automatic">Automatic</option><option value="8">Draft 8</option><option value="16">Standard 16</option><option value="32">Fine 32</option>
          </select></label>
          <div className="toast-hint">Automatic keeps the current mesh fallback. Draft, Standard and Fine export BRep bodies only. This does not change the on-screen mesh.</div>
          <div className="row-actions"><button className="primary" disabled={stlBusy} onClick={() => void exportStl()}>{stlBusy ? 'Preparing…' : 'Export'}</button><button ref={stlCancelButton} className="ghost" onClick={cancelStlExport}>Cancel</button></div>
        </div>
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
              commit(recovery.doc); setFileName(recovery.fileName); settleRecovery(); setRecovery(null); setTimeout(() => viewport.current?.fit(), 300);
            }}>Restore</button>
            <button className="ghost" onClick={() => { settleRecovery(); setRecovery(null); void collectRecoveryBlobs(dirty ? doc : null); }}>Discard</button>
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
      {toast && !cascade && !recovery && !meshAsk && !repairAsk && !stepAsk && !stlAsk && <div className="toast card" role="alert">
        <Icon name="info" className="accent" />
        <div><div className="toast-title">{toast.title}</div><div className="toast-hint">{toast.hint}</div>
          {toast.detail && <details><summary>Details</summary><code>{toast.detail}</code></details>}
          {toast.action && <div className="row-actions"><button className="ghost" onClick={toast.action.run}>{toast.action.label}</button></div>}</div>
        <ToolIconButton aria-label="Dismiss" onClick={() => setToast(null)}><Icon name="close" small /></ToolIconButton>
      </div>}
      </div>
      <Dock width={layout.dockWidth} docked={dockDocked} sheet={layout.dockSheet} onSheet={layout.setDockSheet}>
        {browserPlacement === 'dock' && browserPanel}
        {dockDocked && hud}
        {routePanelOpen ? <RouteBundlePanel doc={routeViewDoc ?? doc} directSelection={directSel} busy={routeContext.current.blocked || routePhase === 'preview' || routePhase === 'validating'} phase={routePhase}
          createDraft={routeCreate} moveDraft={routeMove} selectedBundleId={routeSelected} error={routeError}
          onCreateDraftChange={next => { discardRouteRef.current(); setRouteCreate(next); setRoutePhase('draft'); }} onMoveDraftChange={changeRouteMove}
          onBundleChange={selectRouteBundle} onCreate={createRoute} onPreview={previewRoute} onApply={applyRoute} onCancel={discardRoute}
          onDetach={detachRoute} onClose={() => { discardRouteRef.current(); setRoutePanelOpen(false); }} /> : inspector}
        <PreviewSection mode={previewMode} onMode={choosePreview} panel={previewPanel} overlay={previewOverlay} overlayStatus={previewOverlayStatus} />
      </Dock>
      {/* (G12a: the chat column, shown at the left (order: -1) and full height; after the stage in the document, so the top bar's
          Chat button stays the first [aria-label="Chat"]. The centre — top bar, viewport and its bars — is the stage.) */}
      <ChatColumn open={chat} width={layout.chatShown} onOpen={setChat} onWidth={layout.setChatWidth} openProposals={openProposals}
        decided={decidedProposals} decidedShown={decidedShown} onShowDecided={() => setDecidedShown(true)}
        proposals={!!doc.proposals?.length && <div className="chat-proposals" role="list" aria-label="Proposals"><div className="ol-head req-head">Proposals <span className="muted">{doc.proposals.filter(p => p.status === 'open').length} open</span>
          <ToolIconButton size="tiny" state={decidedShown ? 'on' : 'idle'} aria-label="Show decided proposals" data-tip={decidedShown ? 'Open only' : 'Show accepted and rejected'} onClick={() => setDecidedShown(f => !f)}><Icon name="history" small /></ToolIconButton></div>
        {doc.proposals.filter(p => decidedShown || p.status === 'open').map(p => {
          const shown = ghost?.id === p.id, stale = p.status === 'open' && p.base !== hashNow, dv = shown ? volumeOf(ghost.bodies) - volumeOf(bodies) : 0, base = volumeOf(bodies);
          return <div key={p.id} className={'proposal ' + p.status + ' risk-' + p.risk.level} role="listitem" aria-label={`Proposal ${p.id}`}>
            <div className="proposal-title"><b>{p.id}</b> {p.title} <span className={'risk-badge ' + p.risk.level} title={`${p.risk.features_touched} features touched · ${p.risk.references_broken} references broken${p.risk.hard_requirements_changed.length ? ` · hard requirements ${p.risk.hard_requirements_changed.join(', ')}` : ''}${p.risk.approval.length ? ` · always needs approval: ${p.risk.approval.join(', ')}` : ''}`}>{p.risk.level} risk</span></div>
            <div className="muted">{stale ? <b className="stale">stale · </b> : p.rebased ? 'rebased · ' : ''}{p.summary}{p.risk.references_broken ? ` · ${p.risk.references_broken} reference${p.risk.references_broken > 1 ? 's' : ''} broken` : ''}{p.risk.hard_requirements_changed.length ? ` · hard ${p.risk.hard_requirements_changed.join(', ')}` : ''}{p.risk.approval.length ? ` · needs you (${p.risk.approval.join(', ')})` : ''} · {p.by.agent}{p.by.model ? ` (${p.by.model})` : ''}</div>
            {p.plan && <div className="proposal-plan">{p.plan}</div>}
            {shown && fresh && !massReady && <div className="mono proposal-dv">{ghost.after ? 'after' : 'before'} · volume <span aria-label="Volume change">…</span></div>}
            {shown && fresh && massReady && <div className="mono proposal-dv">{ghost.after ? 'after' : 'before'} · volume <span aria-label="Volume change">{dv >= 0 ? '+' : '−'}{fmt(Math.abs(dv))} mm³{base ? ` (${dv >= 0 ? '+' : '−'}${fmt(Math.abs(dv) / base * 100)}%)` : ''}</span></div>}
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
        })}</div>}
        content={rendering || drawing ? null : <Suspense fallback={null}><ChatPanel versions={project.chat} onRowFiles={files => { if (files === chatRowFiles.current || (files && !isPersonRowFiles(files))) return; revokePersonRowFiles(chatRowFiles.current); chatRowFiles.current = files; }} base={() => prefixDoc(doc, marker ?? doc.nodes.length)} evaluate={d => engine.part(d, revision.current++, 'agent').then(r => r.ok ? r.bodies : null)} check={partEval}
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
        onSelect={sel => setSelection(resolveNames(bodies, sel).selection)} onClose={() => setChat(false)} context={chatContext} outbox={chatOutbox} onOutboxSent={id => setChatOutbox(o => (o?.id === id ? null : o))}
        proposals={doc.proposals} proposalStale={p => p.status === 'open' && p.base !== hashNow} proposalBusy={proposalBusy} onAcceptProposal={p => void acceptIt(p)} onRejectProposal={rejectIt} /></Suspense>} />
    </div>
  );
}

/** Densities in g/cm³ for the mass shown with a body. */

/** A feature's icon in the history: the CAD icon of the command that makes it (a shape's own). */
function iconFor(n: ModelNode) {
  if ('made' in n && n.made) return 'cad-' + n.made.command;
  return ({ extrude: 'cad-extrude', revolve: 'cad-revolve', shell: 'cad-shell', import: 'file_open', sweep: 'cad-sweep', loft: 'cad-loft', hole: 'cad-hole', chamfer: 'cad-chamfer', fillet: 'cad-fillet', union: 'cad-union', difference: 'cad-subtract', intersect: 'cad-intersect',
    translate: 'cad-move', rotate: 'cad-rotate', mirror: 'cad-mirror', scale: 'cad-scale', 'linear-pattern': 'cad-pattern-linear', 'linear-feature-pattern': 'cad-pattern-linear', 'circular-pattern': 'cad-pattern-circular', split: 'cad-split', sketch: 'cad-sketch', 'sheet-base': 'cad-sheet-plate', 'sheet-contour': 'cad-sheet-profile', 'sheet-flange': 'cad-sheet-flange', 'sheet-corner-relief': 'cad-sheet-corner', 'frame-member': 'cad-frame-member', frame: 'cad-frame' } as Record<string, string>)[n.kind] ?? 'category';
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

function NodeEditor({ nodes, index, onApply, onClose, onEditSketch, onDelete, parameters, onRefuse, bearingAssembly, pending = false }: { nodes: ModelNode[]; index: number; onApply(nodes: ModelNode[]): void; onClose(): void; onEditSketch?(): void; onDelete?(): void; parameters: Record<string, number>; onRefuse(message: string): void; bearingAssembly?: BearingAssemblyInput; pending?: boolean }) {
  // The draft is the whole node list: a sketch dimension changes the sketch the feature is made from.
  const [draft, setDraft] = useState<ModelNode[]>(nodes);
  // What is typed in a number box until it reads as a number (so a box can be cleared and retyped).
  const [typed, setTyped] = useState<Record<string, string>>({});
  useEffect(() => { setDraft(nodes); setTyped({}); }, [nodes, index]);
  const fields = editFields(draft, index, parameters, bearingAssembly).filter(f => f.kind !== 'number' || !Number.isNaN(f.get(draft)));
  const names = Object.keys(parameters);
  const changed = draft !== nodes;
  return (
    <div className="node-editor" onKeyDown={e => { if (e.key === 'Enter' && changed && !pending) onApply(draft); else if (e.key === 'Escape') onClose(); else if (e.key === 'Delete' && !pending && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement)) onDelete?.(); }}>
      <div className="card-title" style={{ marginTop: 10 }}>EDIT FEATURE <ToolIconButton size="tiny" aria-label="Close editor" onClick={onClose}><Icon name="close" small /></ToolIconButton></div>
      {onEditSketch && <button className="ghost" aria-label="Edit sketch" title="Reopen the sketch this feature is made from, with its constraints" onClick={onEditSketch}><Icon name="draw" small /> Edit sketch</button>}
      {fields.length ? fields.map(f => (
        <label key={f.key} className="field"><span>{f.label}</span>
          {f.kind === 'number' ? <span className="num"><input type="number" step="any" aria-label={f.label} value={typed[f.key] ?? f.get(draft)} disabled={pending || !!(f as BindableField).param?.(draft)} onChange={e => { const t = e.target.value, v = Number(t); setTyped(m => ({ ...m, [f.key]: t })); if (t.trim() !== '' && Number.isFinite(v)) setDraft(d => f.set(d, v)); }} />{f.unit && <em>{f.unit}</em>}
            {names.length > 0 && 'bind' in f && <select className="param-bind" disabled={pending} aria-label={`${f.label} parameter`} data-tip="Parameter" data-tip-desc="Bind this value to a named parameter (Parameters panel)" value={(f as BindableField).param(draft) ?? ''}
              onChange={e => { const b = f as BindableField, name = e.target.value; if (!name) { setDraft(d => b.set(d, b.get(d))); return; } const next = b.bind(draft, name); if (next) { setDraft(next); setTyped(m => Object.fromEntries(Object.entries(m).filter(([k]) => k !== f.key))); } else onRefuse(`${f.label} is not stored as it is shown, so it cannot take a parameter.`); }}>
              <option value="">ƒ</option>{names.map(n => <option key={n} value={n}>{n}</option>)}</select>}</span>
            : f.kind === 'choice' ? <select disabled={pending} aria-label={f.label} value={f.get(draft)} onChange={e => setDraft(d => f.set(d, e.target.value))}>{f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
            : <input type="checkbox" className="check" disabled={pending} aria-label={f.label} checked={f.get(draft)} onChange={e => setDraft(d => f.set(d, e.target.checked))} />}
        </label>
      )) : <div className="empty">This feature has no editable dimensions.</div>}
      {onDelete && <button className="ghost danger" disabled={pending} aria-label="Delete feature" title="Delete this feature (and the sketch only it uses) · Undo restores it" onClick={onDelete}><Icon name="delete" small /> Delete feature</button>}
      {pending && <div className="empty" role="status">Checking the current bearing and housing…</div>}
      {fields.length > 0 && <div className="row-actions"><button className="primary" disabled={!changed || pending} onClick={() => onApply(draft)}>Apply</button><button className="ghost" disabled={!changed || pending} onClick={() => { setDraft(nodes); setTyped({}); }}>Reset</button></div>}
    </div>
  );
}
