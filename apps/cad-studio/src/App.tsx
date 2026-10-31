import { useSpecificationActions } from './state/useSpecificationActions';
import { useViewportPicking } from './viewport/useViewportPicking';
import { sewPreviewDirect } from './viewport/sewPreviewDirect';
import { useSectionState } from './viewport/useSectionState';
import { useSectionEvaluation } from './viewport/useSectionEvaluation';
import { useSectionDisplay } from './viewport/useSectionDisplay';
import { useAnalysisMaps } from './viewport/useAnalysisMaps';
import { useClearancePreview, useManufacturingPreviews, usePmiPreview } from './viewport/useWorkspacePreviews';
import { ViewDisplayControls } from './ui/ViewDisplayControls';
import { isImportedFile, openImportedFile } from './files/importedFile';
import { FeatureHistoryBar } from './ui/FeatureHistoryBar';
import { FeatureHistoryMenu } from './ui/FeatureHistoryMenu';
import { useRenderPlayback } from './viewport/useRenderPlayback';
import { useModelChecks } from './state/useModelChecks';
import { ViewContextMenu } from './ui/ViewContextMenu';
import { TemplatePicker } from './ui/TemplatePicker';
import { useCommandPreview } from './state/useCommandPreview';
import { DirectInspector } from './ui/DirectInspector';
import { ModelTools, useToolColumns } from './ui/ModelTools';
import { useCommandGizmos } from './viewport/useCommandGizmos';
import { useModelAppearance } from './viewport/useModelAppearance';
import { useSketchActions } from './sketch/useSketchActions';
import { useProposalPreview } from './state/useProposalPreview';
import { ProposalBrowser } from './ui/ProposalBrowser';
import { useFeatureHistory } from './state/useFeatureHistory';
import { BodyBrowserRows } from './ui/BodyBrowserRows';
import { RequirementsBrowser } from './ui/RequirementsBrowser';
import { DesignHistory } from './ui/DesignHistory';
import { MeasurementInspector, InterferenceInspector } from './ui/MeasurementInspector';
import { SelectionInspector } from './ui/SelectionInspector';
import { useMeshImport } from './files/useMeshImport';
import { MeshFileDialogs } from './files/MeshFileDialogs';
import { useRouteBundleEditor } from './state/useRouteBundleEditor';
import { curvePatternInputKey, curvePatternDocumentProblem, directCommandDocument, insertedCurvePartProblem, prepareDirectCurveCandidate, preparePatternNodeCandidate } from './app/directCurveCandidate';
import { ReferenceDecisions } from './ui/ReferenceDecisions';
import { useRobotExports } from './robot/useRobotExports';
import { RobotInspector } from './robot/RobotInspector';
import { useModelExports } from './files/useModelExports';
import { ModelExportDialogs } from './files/ModelExportDialogs';
import { readDocumentFile, verifyDocumentFile, writeDocumentFile } from './files/documentFile';
import { changesBeyondVariability } from './app/documentChanges';
import { sameMeshes, withMasses, samePlacement, meshVolume } from './app/bodyResults';
import { bandEdit, bandRemove } from './app/bandControls';
import { toggleBandPick } from '@barocss/cad-model/sketch/band';
import { bandPicksOf } from '@barocss/cad-model/app/bandSurfaceCommand';
import { bandHighlight } from './app/bandHighlight';
import { TOOLS, SKETCH_INSETS, sketchRegion, switchTool, detachSketchLink, bezierEdit } from './app/sketchControls';
import { ellipseError } from '@barocss/cad-model/sketch/ellipse';
import { activeKey, type Active } from './app/commandState';
import { emptySel, NO_CUTS, NO_INSTANCES, GROUP_COMMANDS, PLACE_COMMANDS, BROWSER_PLACEMENT, PALETTE_EXTRA } from './app/studioConstants';
import { routeMessage } from './app/routeSession';
import { CursorReadout } from './ui/CursorReadout';
import { iconFor } from './ui/featureIcon';
import { NodeEditor } from './ui/NodeEditor';
import { revokePersonRowFiles, isPersonRowFiles, type PersonRowFiles } from '@barocss/cad-model/engine/rowFiles';
import { Profiler, Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';
import { EngineClient, type ProposalOverlay } from './engine/client';
import { beginWork, createWorkOwnership, finishWork, invalidateWork, reserveAcceptedChange, settleWorkReservation, stopOwnedWork, workEditRefusal, type WorkHistory } from './state/workOwnership';
import { currentDocumentSave } from './state/saveOwnership';
import type { OpenScope } from './state/openOwnership';
import { type DisplayMode, type DisplayModeStatus } from './viewport/renderer';
import { placedDoc, type PartInstance } from '@barocss/cad-model/engine/doc';
import { placementOf } from '@barocss/cad-model/engine/placement';
import { instanceEvaluationSources } from './viewport/instanceEvaluation';
import { contentKey, evaluationKey } from '@barocss/cad-model/engine/evalMemo';
import { bearingEditCurrent, bearingFaceInput, captureBearingEditSession, prepareBearingEdit, type BearingEditSession } from './app/bearingEdit';
import { resolveSkeletons, SKELETON_CODES } from '@barocss/cad-model/frames/skeleton';
import { carryOver, dropStaleMade, emptyDoc, featureLabel, fmt, prefixDoc, starterDoc, withNode, type ModelNode, type SketchNode, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { bodyKeyFor, cutAfter, featureId, nextSerial } from '@barocss/cad-model/engine/ids';
import { modelHash } from '@barocss/cad-model/chat/spec';
import { stripHistory } from '@barocss/cad-model/chat/proposals';
import { candidatesFor, captureSignatures, confirmReference, markedReferences, referencesOf, refreshSignatures, type Problem as RefProblem } from '@barocss/cad-model/engine/references';
import { type BodyResult, type EvalResult } from '@barocss/cad-model/engine/evaluate';
import { signaturesOf, type Signature } from '@barocss/cad-model/engine/rematch';
import type { DrawingReferenceLabel, DrawingReferencePreview } from './ui/DrawingWorkspace';
import type { FriendlyError } from '@barocss/cad-model/engine/errors';
import type { Vec3 } from '@barocss/cad-model/engine/mesh';
import { carrySelection, commands, patchValues, refOf, selectedBodies, subdNodeOf, type Command, type Ctx, type Selection, type Values } from '@barocss/cad-model/app/commands';
import { measureBetween, type MeasurePick } from '@barocss/cad-model/app/measure';
import { hostsOf, nestedCard, renderKeysOf, singleNested, singleTop, viewportInstanceSelection } from './assembly/nestedSelection';
import { NestedPartPanel } from './ui/NestedPartPanel';
import { DRAG_TYPE, snapshotInstanceIsolation, type FeatureHandle, type Spot, type SketchAnchor, type SketchShape, type SketchState, type TransformGizmo, type ViewportHandle } from './viewport/Viewport';
import { ClearancePanel } from './viewport/ClearancePanel';
import { PrintPanel } from './viewport/PrintPanel';
import { CamPanel } from './viewport/CamPanel';
import { AnalysisPanel } from './viewport/AnalysisPanel';
import { Button } from '@/components/ui/button';
import { ToolIconButton } from '@/components/ui/tool-button';
import { countRender, onBlockRender } from './devRenders';
import { OutlinerInstances } from './ui/OutlinerInstances';
import { OutlinerCuts } from './ui/OutlinerCuts';
import { AssemblyCutHud } from './ui/AssemblyCutHud';
import { nextInstanceId } from '@barocss/cad-model/assembly/takenIds';
import { AssemblyStepsPanel } from './ui/AssemblyStepsPanel';
import { STEPS_COMMAND, cameraOfView, shownSelection as litSelection, stepAfter, stepOffer, stepsDisplay, viewOfCamera } from './app/assemblySteps';
import { addAssemblyStep, assemblyStepProblems, deleteAssemblyStep, editAssemblyStep, moveAssemblyStep, stepsOf, type EditAssemblyStepOptions } from '@barocss/cad-model/assembly/steps';
import { cutOfDraft, cuttableOf, defaultCutAt, draftOfCut, draftProblem, draftTrialProblem, newCutDraft, withAddedTargets, withDraftCut, type CutDraft } from './app/assemblyCutDraft';
import { addAssemblyCut, deleteAssemblyCut, editAssemblyCut } from '@barocss/cad-model/assembly/cuts';
import { useJoints } from './state/useJoints';
import { refuseMotionSweep, timedMotion } from './state/motion';
import { timedPathOf } from '@barocss/cad-model/robot/motion';
import { createValueStore, useStoreValue } from './state/valueStore';
import { SceneViewport } from './viewport/SceneViewport';
import { GravityExperimentPanel } from './ui/GravityExperimentPanel';
import { useScenePoses } from './state/useScenePoses';
import { commandStates } from './ui/ToolButton';
import type { CamOptions } from './viewport/camDisplay';
import { withPrintPreviewSettings, type PrintPreviewPatch } from './viewport/printSettings';
import { isRefusal, refusal } from '@barocss/cad-model/engine/refusal';
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
import { ShortcutHelp } from './ui/ShortcutHelp';
import { SketchPanel } from './ui/SketchPanel';
import { Timeline } from './ui/Timeline';
import { clearRecovery, keepRecovery, offerRecovery, settleRecovery, type Recovery } from './app/recovery';
import { blobStats, collectRecoveryBlobs, evictBlobs, loadRecoveryBlobs, saveRecoveryBlobs, setBlobStore } from '@barocss/cad-model/engine/blobs';
import { indexedDbBlobStore } from './ui/blobStore';
// (The recovery copy's blobs kept in this browser's IndexedDB: the store set before the studio reads or writes one — PKG-g2.)
setBlobStore(indexedDbBlobStore());
import { bendTableProblem, convexHull, type BendTable } from '@barocss/cad';
import { readStudioFile } from '@barocss/cad-model/engine/container';
import { ParametersPanel } from './ui/ParametersPanel';
import { LibraryPanel } from './ui/LibraryPanel';
import { CagePanel } from './ui/CagePanel';
import { useCageEditor } from './subd/useCageEditor';
import { SKETCH3D_COMMAND, useSkeletonEditor } from './skeleton/useSkeletonEditor';
import { SkeletonPanel } from './ui/SkeletonPanel';
import { RouteBundlePanel } from './ui/RouteBundlePanel';
import { assertRouteBundleDocument, routeBundleDocumentIdentity } from '@barocss/cad-model/engine/routeBundle';
import { loadUserLibraries, setLibraryStore } from '@barocss/cad-model/library/libraries';
import { browserStore } from './ui/browserStore';
import { processProfile } from '@barocss/cad-model/library/materials';
import { InstancePanel } from './ui/InstancePanel';
import { InstanceJointsControls } from './ui/InstanceJoints';
import { InstanceLooksControls } from './ui/InstanceLooks';
import { instanceLookRows, useInstanceLooks } from './state/useInstanceLooks';
import { heldByRevision, heldLooks, resetInstanceLook, setInstanceLook } from '@barocss/cad-model/assembly/looks';
import { setInstanceJoints } from '@barocss/cad-model/assembly/flexible';
import { InstancePatternControls } from './ui/InstancePattern';
import { addInstancePattern, deleteInstancePattern, editInstancePattern, expandPatterns, patternDeleteRefusal, skipOccurrence } from '@barocss/cad-model/assembly/patterns';
/** The document with its instance patterns' occurrences made again from their seeds (roadmap 10 ③): every instance edit keeps them in step. */
const withPatterns = (d: StudioDoc): StudioDoc => d.instancePatterns?.length ? expandPatterns(d) : d;
import { TooltipLayer } from './ui/Tooltip';
import { resolveNames, type NameSelection } from '@barocss/cad-model/chat/names';
import { duplicateBody } from '@barocss/cad-model/chat/features';
import { defaultDrawing, readDrawing, type DrawingSettings } from '@barocss/cad-model/drawing/types';
import { MatePanel } from './ui/MatePanel';
import { sweepLinks } from '@barocss/cad-model/robot/sweep';
import { sweepTimed } from '@barocss/cad-model/robot/ccd';
import { Lanes } from './engine/lanes';
import { useAssembly } from './assembly/useAssembly';
import { pickedSketches, planeOf, profileRings, unusedSketches } from '@barocss/cad-model/app/profiles';
import { addedHoles, holeGroup, holeRegions, type ToolRegion } from '@barocss/cad-model/app/holeRegion';
import { threadLines, threadsOf } from '@barocss/cad-model/app/threads';
import { fastenerSizesOf } from '@barocss/cad-model/engine/fastenerSizeRows';
import type { Analysis } from './viewport/analysis';
import { asSection, sectionHatch, sectionPlanes, type AxisSection, type Section } from './viewport/sectionView';
import { sectionHandles } from './ui/SectionBar';
import { type MapKind } from './viewport/scalarMaps';
import { edgeChain } from '@barocss/cad-model/app/edgeChain';
import { joinOpen } from '@barocss/cad-model/sketch/trim';
import { faceProfile } from '@barocss/cad-model/app/faceProfile';
import { sketchShapes } from '@barocss/cad-model/sketch/reopen';
import { bodyName, describeChange, rootOf } from '@barocss/cad-model/app/bodies';
import { readBrief } from '@barocss/cad-model/chat/brief';
import { BriefPanel } from './ui/BriefPanel';
import { SpecifyPanel } from './ui/SpecifyPanel';
import { ReferencesPanel } from './ui/ReferencesPanel';
import { placeReference, readReferences } from '@barocss/cad-model/chat/references';
import { confirmDimension, liveDrafts } from '@barocss/cad-model/chat/drafts';
import { DraftsPanel } from './ui/DraftsPanel';
import { extrudeProfile } from '@barocss/cad-model/app/profileCommands';
import { editCommand } from '@barocss/cad-model/app/editCommand';
import { flattenAssembly } from '@barocss/cad-model/engine/flatten';
import { resolveShopRows } from '@barocss/cad-model/engine/shopRows';
import { elsewhereOf, openAccepted, beginInPlace, editInPlaceRefusal, finishInPlace, inPlaceBlock, sessionChanged, stacksAfter, type InPlaceSession } from './app/editInPlace';
import { acceptRevision, dismissRevision, freshPartId, makeIndependent, offerRevision, revisionOf, sharing } from '@barocss/cad-model/assembly/definitions';
import { alignMove, gizmoAxes, movedInstance, previewMatrix, turnedInstance, type InstanceDrag } from '@barocss/cad-model/assembly/drag';
import { BASE, type Mate } from '@barocss/cad-model/assembly/mates';
import type { DirectGeometry } from '@barocss/cad-model/engine/direct';
import { directNow, loadDirect } from '@barocss/cad-model/engine/directModule';
import { FontUpload } from './app/fontUpload';
import { boundsOf } from '@barocss/cad-model/engine/bounds';
import { defaultRender, readRender, type RenderCamera, type RenderSettings } from '@barocss/cad-model/engine/render';
import { downloadBytes } from './ui/files';
import { useBottomRow, HISTORY_LEFT, HISTORY_LEFT_RAIL } from './ui/useBottomRow';
import { useFitChips } from './ui/useFitChips';
import { useLayout } from './layout/useLayout';
import { ChatColumn, columnShown } from './layout/ChatColumn';
import { Dock } from './layout/Dock';
import { PreviewSection, type PreviewMode } from './layout/PreviewSection';
import { CHAT_DEFAULT, CHAT_STRIP } from './layout/useLayout';
import { sketchDxf } from '@barocss/cad-model/sketch/dxf';
import { settleShape } from '@barocss/cad-model/sketch/settle';
import { planeLabel, planeOfFace, xyPlane } from '@barocss/cad-model/sketch/plane';
import { shapeNode } from '@barocss/cad-model/sketch/loops';
import { commitDimension, isSettled } from '@barocss/cad-model/sketch/rules';
import { sketchClick } from '@barocss/cad-model/sketch/select';
import { SketchHistory } from '@barocss/cad-model/sketch/history';

// A free sketch's outlines at the document's parameter values; none when a parameter it uses is missing.
const ringsOf = (n: SketchNode, params: StudioDoc['parameters']) => { try { return profileRings(n, params); } catch (e) { if (!isRefusal(e, 'PARAMETER_UNKNOWN') && !(n.profile === 'band' && isRefusal(e, 'VALUE'))) throw e; return []; } }; // (A band that cannot be made shows no outline; the evaluation error says why.)

// Workspaces off the first screen load when first opened (the chat's tools, the drawing and the render panel).
const ChatPanel = lazy(() => import('./ui/ChatPanel').then(m => ({ default: m.ChatPanel })));
const DrawingWorkspace = lazy(() => import('./ui/DrawingWorkspace').then(m => ({ default: m.DrawingWorkspace })));
const RenderPanel = lazy(() => import('./ui/RenderPanel').then(m => ({ default: m.RenderPanel })));
type ReferenceLabelOwner = { doc: StudioDoc; model: StudioDoc };
/** What Open reads, said when it is given another kind of file. */
const OPEN_READS = 'Open reads models (.bcad, .json), STEP (.step, .stp), STL, OBJ, IGES (.igs, .iges) and .barocad curve and surface sources. Your part is unchanged.';
export function App() {
  countRender('App');
  const engine = useMemo(() => new EngineClient(), []);
  const workerFailureHandler = useRef<((error: FriendlyError) => void) | null>(null);
  useEffect(() => {
    const unsubscribe = engine.onFailure(error => workerFailureHandler.current?.(error));
    return () => { unsubscribe(); engine.dispose(); };
  }, [engine]);
  const viewport = useRef<ViewportHandle>(null);
  // (The bottom row: the view bar measured, the history bar beside it or stacked above it.)
  const cornerRight = useRef<HTMLDivElement>(null), [stripWidth, setStripWidth] = useState(0), [historyNatural, setHistoryNatural] = useState(0);
  const bottomRow = useBottomRow(cornerRight, stripWidth, BROWSER_PLACEMENT === 'dock' ? HISTORY_LEFT_RAIL : HISTORY_LEFT, historyNatural);
  const [doc, setDocStateRaw] = useState<StudioDoc>(starterDoc);
  // (O11: one guard where every edit of the document lands. While a variant is shown, a change of anything but the
  // document's variability is refused — said as start() says it — and the undo entry it asked for dropped; a whole
  // document (opened, new) is always taken. Undo, redo and the system's own updates write the state directly.)
  const docNow = useRef(doc); docNow.current = doc;
  // Save completion belongs to a document dispatch, independently of evaluation/Stop ownership.
  // Even a no-op dispatch invalidates an older receipt; functional updates retain React's queued semantics.
  const saveDocumentToken = useRef<object>({});
  const openIntent = useRef<OpenScope>({});
  const discardDirectCandidateRef = useRef<() => void>(() => {});
  const beginOpenIntent = useCallback((): OpenScope => { discardDirectCandidateRef.current(); const scope = {}; openIntent.current = scope; return scope; }, []);
  const currentOpenScope = useCallback(() => openIntent.current, []);
  const isOpenCurrent = useCallback((scope: OpenScope) => openIntent.current === scope, []);
  useEffect(() => () => { openIntent.current = {}; }, []);
  const saveAcceptanceScope = saveDocumentToken.current;
  const setDocState = useCallback((update: StudioDoc | ((previous: StudioDoc) => StudioDoc)) => {
    saveDocumentToken.current = {};
    openIntent.current = {};
    if (typeof update === 'function') setDocStateRaw(update);
    else { docNow.current = update; setDocStateRaw(update); }
  }, []);
  const discardRouteRef = useRef<() => void>(() => {});
  const routeAcceptedHandoff = useRef<{ doc: StudioDoc; identity: string; evaluatedIdentity: string; revision: number; result: Extract<EvalResult, { ok: true }> } | null>(null);
  const workOwnership = useRef(createWorkOwnership<StudioDoc, StudioDoc>());
  const acceptanceScope = workOwnership.current.scope;
  const replacementScope = useRef<object | null>(null), workCompletion = useRef<object | null>(null);
  const shownVariant = useRef<string | null>(null);
  const undoFor = useRef<{ entry: WorkHistory<StudioDoc>; scope: object; base: StudioDoc; beforeInput: StudioDoc } | null>(null);
  const canChangeDocument = () => {
    const why = !replacementScope.current && doc !== docNow.current ? 'stale' : workEditRefusal(workOwnership.current, replacementScope.current ?? acceptanceScope, workCompletion.current);
    if (!why) return true;
    undoFor.current = null;
    setToast({ title: 'Change not applied', hint: why === 'pending' ? 'Wait for the computation to finish, or stop it, before changing the document.' : 'The document or operation changed. Try this edit again.', detail: '' });
    return false;
  };
  const setDoc = (next: StudioDoc, whole = false): boolean => {
    const intent = undoFor.current; undoFor.current = null;
    const why = !replacementScope.current && (intent?.base ?? doc) !== docNow.current ? 'stale' : workEditRefusal(workOwnership.current, replacementScope.current ?? intent?.scope ?? acceptanceScope, workCompletion.current);
    if (why) { setToast({ title: 'Change not applied', hint: why === 'pending' ? 'Wait for the computation to finish, or stop it, before changing the document.' : 'The document or operation changed. Try this edit again.', detail: '' }); return false; }
    const pathProblem = curvePatternDocumentProblem(next);
    if (pathProblem) { setToast({ title: 'Change not applied', hint: pathProblem, detail: 'The document is unchanged.' }); return false; }
    if (!whole && shownVariant.current && changesBeyondVariability(docNow.current, next)) { setToast({ title: 'Can’t change the part now', hint: `Showing ${shownVariant.current}: show the master to edit.`, detail: '' }); return false; }
    if (next !== docNow.current) discardRouteRef.current();
    if (routeAcceptedHandoff.current?.doc !== next) routeAcceptedHandoff.current = null;
    if (intent) {
      setUndo(u => [...u.slice(-49), intent.entry]); setRedo([]);
      workOwnership.current = reserveAcceptedChange(workOwnership.current, intent.entry, next, intent.beforeInput);
    }
    docNow.current = next; setDocState(next);
    return true;
  };
  const [marker, setMarker] = useState<number | null>(null);
  const markerNow = useRef(marker); markerNow.current = marker;
  const [undo, setUndo] = useState<{ doc: StudioDoc; marker: number | null }[]>([]);
  const [redo, setRedo] = useState<{ doc: StudioDoc; marker: number | null }[]>([]);
  // Roadmap 10 ⑧: a part edited in place inside its assembly. While it is set, the working document is the part's own (the assembly waits in the session,
  // with its undo and redo stacks); nothing of the assembly is saved, recovered or opened over until Finish or Cancel.
  const [inPlace, setInPlace] = useState<InPlaceSession | null>(null), [askDiscard, setAskDiscard] = useState(false), [chatRunning, setChatRunning] = useState(false);
  const inPlaceNow = useRef(inPlace); inPlaceNow.current = inPlace;
  const [bodies, setBodies] = useState<BodyResult[]>([]);
  // The evaluated document the bodies were computed for: while a newer one evaluates (or fails), the bodies are
  // stale, and nothing pairs them with the newer document's names, facts or checks.
  const [bodiesFor, setBodiesFor] = useState<StudioDoc | null>(null);
  // Parameter candidates use the normal evaluation lane before the accepted document changes.
  const parameterRequest = useRef(0);
  const [parameterEdit, setParameterEdit] = useState<{ kind?: 'direct'; failureTitle?: string; request: number; base: StudioDoc; baseInput: StudioDoc; input: StudioDoc; next: StudioDoc; accept(next: StudioDoc): void } | null>(null);
  const parameterEditNow = useRef(parameterEdit); parameterEditNow.current = parameterEdit;
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
  const fontUpload = useMemo(() => new FontUpload(), []);
  useEffect(() => {
    const sync = () => fontUpload.sync(activeStore.get()?.ctx ?? null);
    sync();
    const unsubscribe = activeStore.subscribe(sync);
    return () => { unsubscribe(); fontUpload.sync(null); };
  }, [activeStore, fontUpload]);
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
  // Roadmap 10 ⑤: the Assembly cut's HUD values while it is open (null: closed). The viewport shows the cut parts as the draft leaves them.
  const [cutDraft, setCutDraft] = useState<CutDraft | null>(null);
  // (Each entry keeps the instance it was evaluated for; `key` changes whenever its bodies are evaluated anew.)
  const [instanceBodies, setInstanceBodies] = useState<Map<string, { key: string; sourceKey: string; inst: PartInstance; bodies: BodyResult[] }>>(new Map());
  const [workerSession, setWorkerSession] = useState(0);
  const [importWorkerRecovery, setImportWorkerRecovery] = useState(0);
  const workerSessionNow = useRef(0);
  // O18 (P): the worker replies without the bodies' masses and posts them after, by mass ref; each body still waiting
  // gets its own B-rep's (placed by its massPlace) — never another revision's, whose B-rep has its own ref.
  useEffect(() => engine.onMasses(masses => {
    const got = new Map(masses.map(m => [m.ref, m.fields]));
    // Retain candidate patches during reference refresh and the handoff to the accepted bodies.
    // withMasses applies the existing exact native-source/ref/field guard to both copies.
    if (parameterMass.current) parameterMass.current.result.bodies = withMasses(parameterMass.current.result.bodies, got);
    routeEditor.patchMasses(got);
    if (routeAcceptedHandoff.current) routeAcceptedHandoff.current.result.bodies = withMasses(routeAcceptedHandoff.current.result.bodies, got);
    setBodies(bs => withMasses(bs, got));
    setInstanceBodies(map => { let next: typeof map | null = null; for (const [id, e] of map) { const bs = withMasses(e.bodies, got); if (bs !== e.bodies) (next ??= new Map(map)).set(id, { ...e, bodies: bs }); } return next ?? map; });
  }), [engine]);
  const massReady = useMemo(() => !bodies.some(b => b.massRef !== undefined) && ![...instanceBodies.values()].some(e => e.bodies.some(b => b.massRef !== undefined)), [bodies, instanceBodies]);
  const instanceRun = useRef(0);
  const partInput = useRef<HTMLInputElement>(null);
  /** Selected direct curves and surfaces (by object id). */
  const [directSel, setDirectSel] = useState<string[]>([]);
  const routeContext = useRef({ blocked: true });
  const routeEditor = useRouteBundleEditor({ owner: { docNow, blocked: routeContext, commandActive: () => !!activeStore.get() }, worker: { engine, nextRevision: () => revision.current++ }, onNotice: notice => setToast(notice),
    acceptValidated: ready => {
      const candidate = ready.candidate;
      if (!canChangeDocument()) return false;
      discardRouteRef.current();
      routeAcceptedHandoff.current = { doc: candidate, identity: ready.identity, evaluatedIdentity: ready.evaluatedIdentity, revision: ready.result.revision, result: ready.result };
      // The full candidate was evaluated against this exact accepted document; do not rebase it.
      return commit(candidate, false, true);
    } });
  const { routePanelOpen, setRoutePanelOpen, routeCreate, setRouteCreate, routeMove, routeSelected, routePhase, setRoutePhase, routeError, routeViewDoc, routeVisualDoc, routePreviewBodies,
    discardRoute, selectRouteBundle, createRoute, previewRoute, changeRouteMove, applyRoute, detachRoute } = routeEditor;
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
    const prev = liveShape.current, keep = fresh && prev && (shapeNode(prev) || prev.construction || prev.kind === 'bezier' || (prev.kind === 'polygon' && !prev.closed && !prev.pending && prev.points.length >= 2)) ? prev : null;
    // A new shape is construction while the mode is on; the one being drawn stays what it began as.
    // A Bézier curve with no usable curve is refused (the reason shows in the panel), and is never construction: it stays the curve it is (D354).
    // An ellipse the model cannot build (no narrower than 1 : 5, within the kernel's range) is refused with the reason and the sketch stays.
    if (shape?.kind === 'polygon' && shape.ellipse) { const why = ellipseError(shape.ellipse); if (why) { setSketchError(why); return; } }
    if (shape?.kind === 'bezier') { const b = bezierEdit(shape); if ('error' in b) { setSketchError(b.error); return; } shape = b.shape; }
    else if (shape) { const c = !prev || fresh ? constructRef.current : !!prev.construction; shape = c ? { ...shape, construction: true } : shape.construction ? (({ construction: _c, ...rest }) => rest as SketchShape)(shape) : shape; }
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
  // (A message the studio sends to the chat as the user's: the Specify panel's answers, A6.2.)
  const [chatOutbox, setChatOutbox] = useState<{ id: number; text: string } | null>(null);
  /** What a chat turn asked to show selected once its part is evaluated. */
  const chatSelection = useRef<NameSelection | null>(null);
  // The pointer's model point, shown in the status bar by its own component (a move re-renders only it).
  const cursorSink = useRef<((p: Vec3 | null) => void) | null>(null);
  const onCursor = useCallback((p: Vec3 | null) => cursorSink.current?.(p), []);
  // (`action`: one button on the toast, e.g. Undo after the agent applied a change directly, D41.)
  const [workerFailure, setWorkerFailure] = useState<FriendlyError | null>(null);
  const [notice, setToast] = useState<(FriendlyError & { action?: { label: string; run(): void } }) | null>(null);
  // References an opened file stores that could not be told (engine/references.ts), and the candidates on show.
  const [refProblems, setRefProblems] = useState<RefProblem[]>([]);
  const [refChoices, setRefChoices] = useState<{ index: number; names: string[] } | null>(null);
  const [referencePreview, setReferencePreview] = useState<DrawingReferencePreview | null>(null);
  const [referenceLabelCache, setReferenceLabelCache] = useState<{ owner: ReferenceLabelOwner; labels: readonly DrawingReferenceLabel[] } | null>(null);
  useEffect(() => { setReferencePreview(null); }, [doc]);
  const [fileName, setFileNameRaw] = useState('Bracket-01');
  const fileNameNow = useRef(fileName); fileNameNow.current = fileName;
  const setFileName = useCallback((next: string) => { fileNameNow.current = next; setFileNameRaw(next); }, []);
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
    onOpenIntent: beginOpenIntent,
    currentOpenScope,
    isOpenCurrent,
    onOpened: (d, path, notes) => {
      if (!openAccepted(inPlaceNow.current)) return openIntent.current;
      replaceDoc(d, true);
      const accepted = openIntent.current;
      setFileName(path.replace(/\.bcad$/i, '').split('/').pop()!); setDirty(notes.length > 0);
      setTimeout(() => { if (isOpenCurrent(accepted)) viewport.current?.fit(); }, 300);
      return accepted;
    },
    onError: (title, hint) => setToast({ title, hint, detail: '' }),
    canOpen: () => { if (openAccepted(inPlaceNow.current)) return true; setToast({ title: 'A part is being edited', hint: 'Finish or cancel it before opening a project file.', detail: '' }); return false; },
    onLinked: l => {
      if (!openAccepted(inPlaceNow.current)) return;
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
    if (!dirty || inPlace) return;
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
  }, [doc, fileName, dirty, project.view.part, inPlace]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirty || inPlaceNow.current) e.preventDefault(); };
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
  // Roadmap 10 ⑥: the Steps panel and its session state — the step shown and whether waiting parts are faded (neither is saved, nor an undo step).
  const [stepsOpen, setStepsOpen] = useState(false), [stepIndex, setStepIndex] = useState(0), [stepsFaded, setStepsFaded] = useState(false);
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
  const { sectionDragFrom, sectionDebug, setSectionDebug, sectionLive, section, setSection, dragSection, sectionFacePick, setSectionFacePick,
    sectionFacePickRef, sectionExact, setSectionExact, sectionRef } = useSectionState(viewBackend);
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
  // (The tool rail's columns for the window height; the notices sit beside its width: roadmap 21.)
  const rail = useToolColumns();
  // (The same time for the drag preview's whole-part cost, read while dragging: roadmap 20 ①.)
  const lastEvalMs = useRef(0);
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

  // (Render settings do not change the model: nodes, parameters and consumed direct paths re-evaluate it.)
  // (FRc, O117: the section library is model input too — a frame on a row is built from it.)
  // (FRf2, O125: and the placed parts, when a frame follows a part's sketch — not otherwise, so moving parts does not re-evaluate the base.)
  // (O11: what is evaluated and shown is the shown variant — the master itself unless a variant or edited values are
  // shown — regenerated from the master, which is never written by it.)
  // (Roadmap 10 ⑧: an edited part evaluates with the rows it inherits from its assembly, as a placed part does; the authored document is unchanged, carryOver keeps its own rows.)
  const evalDoc = useMemo(() => inPlace ? resolveShopRows(doc, inPlace.assembly).doc : doc, [doc, inPlace?.assembly]);
  const variants = useVariants(evalDoc), shownDoc = variants.shown; shownVariant.current = variants.showing;
  const followsParts = shownDoc.nodes.some(n => n.kind === 'frame' && !!n.follows && 'part' in n.follows);
  const rootContextKey = useMemo(() => {
    try { return contentKey(shownDoc); }
    // A missing/hidden housing must reach the evaluator's refusal, not throw from React render.
    catch { return shownDoc; }
  }, [shownDoc]);
  const curvePathKey = useMemo(() => {
    try { return curvePatternInputKey(shownDoc, marker ?? shownDoc.nodes.length); }
    // Let the evaluator report an invalid live source without throwing from React render.
    catch { return shownDoc; }
  }, [shownDoc.nodes, shownDoc.direct, marker]);
  const evaluated = useMemo(() => prefixDoc(shownDoc, marker ?? shownDoc.nodes.length), [shownDoc.nodes, shownDoc.parameters, shownDoc.frames?.sections, rootContextKey, curvePathKey, followsParts ? shownDoc.instances : null, marker]);
  const commandDoc = useMemo(() => directCommandDocument(evaluated, shownDoc), [evaluated, shownDoc.direct]);
  // Labels outlive the Drawing view, but only for the exact accepted document and displayed model.
  // Do not bind to DrawingWorkspace's spread prop: that wrapper is new on every render.
  const referenceLabelOwner = useMemo<ReferenceLabelOwner>(() => ({ doc, model: evaluated }), [doc, evaluated]);
  const referenceLabelOwnerNow = useRef(referenceLabelOwner); referenceLabelOwnerNow.current = referenceLabelOwner;
  const receiveReferenceLabels = useCallback((labels: readonly DrawingReferenceLabel[]) => {
    if (referenceLabelOwnerNow.current !== referenceLabelOwner) return;
    setReferenceLabelCache(previous => previous?.owner === referenceLabelOwner && JSON.stringify(previous.labels) === JSON.stringify(labels) ? previous : { owner: referenceLabelOwner, labels });
  }, [referenceLabelOwner]);
  const referenceLabels = referenceLabelCache?.owner === referenceLabelOwner ? referenceLabelCache.labels : [];

  const { gpuSection, sectionExactShown, sectionBodies } = useSectionEvaluation({ section, sectionDragFrom, sectionDebug, sectionExact,
    setSectionExact, evaluated, bodies, viewport, engine, revision, lanes });
  const render = useMemo(() => doc.render ?? defaultRender(), [doc.render]);

  // A display-only commit does not rerun the main effect: release its reservation on the same exact input.
  useEffect(() => { workOwnership.current = settleWorkReservation(workOwnership.current, doc, evaluated); }, [doc, evaluated, acceptanceScope]);
  // A parameter candidate and its BRep stay together. A refusal keeps the last accepted document and bodies.
  const parameterCurrent = !parameterEdit || (parameterEdit.base === doc && parameterEdit.baseInput === evaluated && !shownVariant.current);
  useEffect(() => {
    let live = true;
    if (parameterEdit && !parameterCurrent) {
      // A display-only edit cancels the candidate without evaluating the unchanged accepted model again.
      if (parameterEdit.baseInput === evaluated && acceptedEvaluation.current) parameterHandoff.current = { target: docNow.current, ...acceptedEvaluation.current, result: { ...acceptedEvaluation.current.result, bodies: bodiesRef.current } };
      if (parameterMass.current?.request === parameterEdit.request && !parameterMass.current.target) parameterMass.current = null;
      if (parameterEdit.kind === 'direct') parameterEditNow.current = null;
      setParameterEdit(null); return;
    }
    const edit = parameterEdit;
    const input = edit?.input ?? evaluated;
    const started = beginWork(workOwnership.current, doc, input, !!edit || !!variants.showing || marker !== null);
    workOwnership.current = started;
    const work = started.run!;
    const current = () => live && workOwnership.current.run?.token === work.token && (!edit || (parameterRequest.current === edit.request && docNow.current === edit.base && evaluatedRef.current === evaluated && !shownVariant.current));
    const refuse = (detail: string) => {
      if (!edit || !current()) return;
      const accepted = acceptedEvaluation.current;
      if (accepted) parameterHandoff.current = { target: edit.base, ...accepted, result: { ...accepted.result, bodies: bodiesRef.current } };
      if (parameterMass.current?.request === edit?.request && !parameterMass.current?.target) parameterMass.current = null;
      if (edit.kind === 'direct') parameterEditNow.current = null;
      setParameterEdit(null); setBusy(false);
      setToast({ title: edit.failureTitle ?? (edit.kind === 'direct' ? 'Direct geometry not changed' : 'Parameters not changed'), hint: 'The accepted part and its references are unchanged.', detail });
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
        workCompletion.current = work.token;
        try { edit.accept(next); } finally { workCompletion.current = null; }
        if (docNow.current === edit.base) { refuse('The parameter change was not accepted.'); return; }
        const installed = docNow.current;
        parameterHandoff.current = { target: installed, key: nextKey, result };
        if (parameterMass.current?.request === edit.request) parameterMass.current.target = installed;
        if (edit.kind === 'direct') parameterEditNow.current = null;
        setParameterEdit(null);
        return;
      }
      setBusy(false); setLastMs(lastEvalMs.current = result.wallTime * 1000);
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
    void run().catch(cause => { if (edit) refuse(cause instanceof Error ? cause.message : String(cause)); else if (current()) { setBusy(false); setToast({ title: 'Could not evaluate the part', hint: 'The previous part remains shown.', detail: String(cause) }); } }).finally(() => { workOwnership.current = finishWork(workOwnership.current, work.token); });
    return () => { live = false; workOwnership.current = finishWork(workOwnership.current, work.token); };
  }, [engine, evaluated, parameterEdit, parameterCurrent, importWorkerRecovery]);
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
  const ctx: Ctx = { doc: commandDoc, bodies, selection, pick: pick ?? undefined, direct: directSel, bearingAssembly: { root: doc, owner: 'base' } };
  const evaluatedRef = useRef(evaluated); evaluatedRef.current = evaluated;
  discardDirectCandidateRef.current = () => {
    const pending = parameterEditNow.current;
    if (pending?.kind !== 'direct') return;
    parameterRequest.current++; parameterEditNow.current = null;
    if (acceptedEvaluation.current) parameterHandoff.current = { target: docNow.current, ...acceptedEvaluation.current, result: { ...acceptedEvaluation.current.result, bodies: bodiesRef.current } };
    if (parameterMass.current && !parameterMass.current.target) parameterMass.current = null;
    const run = workOwnership.current.run;
    if (run?.candidate) workOwnership.current = finishWork(workOwnership.current, run.token);
    setParameterEdit(null); setBusy(false);
  };

  /** The document as it is, kept for undo (redo is gone once something new is done). */
  const pushUndo = () => { undoFor.current = { entry: { doc: docNow.current, marker: markerNow.current }, scope: replacementScope.current ?? acceptanceScope, base: doc, beforeInput: evaluatedRef.current }; };
  // (`capture`: references this change wrote were picked on the bodies shown; a whole document replaced was not.
  // `whole`: a new or opened document, nothing of the one before carried into it.)
  const commit = useCallback((next: StudioDoc, capture = true, whole = false) => {
    if (!canChangeDocument()) return false;
    // Counted as the History bar shows them: sketches are part of the feature made from them.
    const nextFeatureIds = marker !== null ? new Set(next.nodes.map((_, i) => featureId(next.nodes, i))) : null;
    const dropped = !whole && marker !== null && nextFeatureIds ? doc.nodes.slice(marker).filter((n, i) => n.kind !== 'sketch' && !nextFeatureIds.has(featureId(doc.nodes, marker + i))).length : 0;
    // Commands build on the evaluated document, which follows the model only: what they leave as it was
    // there (every field but the model's own: engine/doc.ts carryOver) is the document's newest.
    const was = evaluatedRef.current;
    if (!whole) next = carryOver(next, was, doc);
    // (References written by this change get their signatures from the bodies they were picked on, engine/references.ts.)
    if (capture) next = captureSignatures(next, bodies);
    pushUndo();
    if (!setDoc(next, whole)) return false;
    setMarker(null); setDirty(true); setEditNode(null);
    // An empty document has no bodies; clear them now so defaults are not computed from the old model.
    if (!Object.keys(next.outputs).length) { setBodies([]); claimBodies.current = true; setSelection(emptySel); }
    if (dropped > 0) setToast({ title: `Removed ${dropped} later feature${dropped > 1 ? 's' : ''}`, hint: 'You added a feature while rolled back. Undo restores them.', detail: '' });
    return true;
  }, [doc, marker, bodies, acceptanceScope]);
  commitRef.current = commit; cageEdRef.current = cageEd;
  /** One undoable change of the render settings (the model and the rollback marker stay). */
  const commitRender = useCallback((next: RenderSettings) => {
    if (!canChangeDocument()) return;
    pushUndo();
    if (!setDoc({ ...doc, render: next })) return; setDirty(true);
  }, [doc, marker, acceptanceScope]);
  /** Saved display controls use the existing undo/document path and preserve a rollback marker. */
  const commitPrintPreview = useCallback((patch: PrintPreviewPatch) => {
    if (!canChangeDocument()) return;
    try { const next = withPrintPreviewSettings(doc, patch); pushUndo(); if (!setDoc(next)) return; setDirty(true); }
    catch (error) { setToast({ title: 'Print settings not changed', hint: error instanceof Error ? error.message : String(error), detail: '' }); }
  }, [doc, marker, acceptanceScope]);
  const commitPrintDirection = useCallback((direction: Vec3 | undefined) => {
    if (!canChangeDocument()) return;
    const next = { ...doc }; if (direction) next.print = { direction }; else delete next.print;
    pushUndo(); if (!setDoc(next)) return; setDirty(true);
  }, [doc, marker, acceptanceScope]);
  /** One undoable change of the drawing settings (the model stays). */
  const commitDrawing = useCallback((next: DrawingSettings) => {
    if (!canChangeDocument()) return;
    pushUndo();
    if (!setDoc({ ...doc, drawing: next })) return; setDirty(true);
  }, [doc, marker, acceptanceScope]);
  const stageCurveCandidate = useCallback((candidate: { next: StudioDoc; input: StudioDoc; failureTitle?: string }, select?: string[]) => {
    if (bodiesFor !== evaluatedRef.current || !massReady || shownVariant.current) { setToast({ title: candidate.failureTitle ?? 'Direct geometry not changed', hint: 'Wait for the accepted part and its mass results to finish evaluating.', detail: '' }); return; }
    const edit = { ...candidate, kind: 'direct' as const, request: ++parameterRequest.current, base: doc, baseInput: evaluatedRef.current,
      accept: (accepted: StudioDoc) => { if (commit(accepted, false) && select) setDirectSel(select); } };
    // Reserve before React renders so a second edit cannot change the accepted input.
    workOwnership.current = beginWork(workOwnership.current, doc, candidate.input, true);
    parameterEditNow.current = edit; setParameterEdit(edit); setBusy(true);
  }, [doc, bodiesFor, massReady, commit]);
  /** One undoable change of the direct geometry (the model stays as evaluated). */
  const commitDirect = useCallback((next: DirectGeometry, select?: string[]) => {
    if (!canChangeDocument()) return false;
    try { assertRouteBundleDocument({ ...doc, direct: next }); }
    catch (error) { setToast({ title: 'Direct geometry not changed', hint: `${routeMessage(error)} Detach the route bundle before editing a bound member.`, detail: '' }); return false; }
    try {
      const candidate = prepareDirectCurveCandidate(doc, next);
      if (candidate) {
        stageCurveCandidate(candidate, select);
        return false;
      }
    } catch (error) { setToast({ title: 'Direct geometry not changed', hint: routeMessage(error), detail: '' }); return false; }
    pushUndo();
    if (!setDoc({ ...doc, direct: next })) return false; setDirty(true);
    if (select) setDirectSel(select);
    return true;
  }, [doc, marker, acceptanceScope, stageCurveCandidate]);
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
    if (!canChangeDocument()) return false;
    pushUndo();
    if (!setDoc(withPatterns({ ...doc, instances: next }))) return false; setDirty(true);
    if (select) setInstanceSel(select);
    return true;
  }, [doc, marker, acceptanceScope]);
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
    if (!commitInstances(out.prepared.root.instances!, [session.owner])) return;
    setInstanceEdit(null);
  };
  // Evaluate each instance whose placed part changed (in the worker, beside the main part).
  const instanceSources = useMemo(() => instanceEvaluationSources(shownDoc), [shownDoc]);
  useEffect(() => {
    // (R4b: each placed part on its own O9 lane, `placed:<id>`; this run's lanes cancelled by its cleanup, so a reply from
    // a document since replaced comes back stale and the run stops, setting nothing.)
    const asked = (shownDoc.instances ?? []).map(i => `placed:${i.id}`), generation = workerSessionNow.current;
    (async () => {
      const next = new Map<string, { key: string; sourceKey: string; inst: PartInstance; bodies: BodyResult[] }>();
      for (const inst of shownDoc.instances ?? []) {
        if (generation !== workerSessionNow.current) return;
        const source = instanceSources.get(inst.id);
        if (!source?.ok) { setToast({ title: 'The placed part could not be evaluated', hint: source && !source.ok ? source.error : 'Missing part context.', detail: '' }); continue; }
        // The same placement of the same part (objects are replaced on edit, so by reference first; a new
        // object only when its content changed, compared then).
        const have = instanceBodies.get(inst.id);
        if (have && have.sourceKey === source.key && samePlacement(have.inst, inst)) { next.set(inst.id, have.inst === inst ? have : { ...have, inst }); continue; }
        const at = revision.current++, reply = await lanes.run(`placed:${inst.id}`, { revision: at, source: source.key }, () => engine.placed(placedDoc(inst, shownDoc), source.base, placementOf(inst), at));
        if (reply.stale || generation !== workerSessionNow.current) return;
        const r = reply.result;
        if (r.ok) next.set(inst.id, { key: `${inst.id}#${++instanceRun.current}`, sourceKey: source.key, inst, bodies: r.bodies });
        else setToast(r.error);
      }
      if (generation === workerSessionNow.current) setInstanceBodies(next);
    })();
    return () => { for (const lane of asked) lanes.cancel(lane); };
  }, [shownDoc.instances, instanceSources, workerSession]);
  // Roadmap 10 ⑤: the Assembly cut HUD's preview. It is the viewport's only: the parts the draft changes are evaluated apart from the
  // committed ones (`instanceBodies`), so no export, robot calculation or looks panel reads an unapplied draft.
  const cutPreviewDoc = useMemo(() => withDraftCut(shownDoc, cutDraft), [shownDoc, cutDraft]);
  const [cutPreview, setCutPreview] = useState<Map<string, { key: string; sourceKey: string; inst: PartInstance; bodies: BodyResult[] }>>(new Map());
  useEffect(() => {
    if (cutPreviewDoc === shownDoc) { setCutPreview(was => was.size ? new Map() : was); return; }
    const sources = instanceEvaluationSources(cutPreviewDoc), generation = workerSessionNow.current;
    const changed = (shownDoc.instances ?? []).filter(i => { const a = sources.get(i.id), b = instanceSources.get(i.id); return a?.ok && (!b?.ok || a.key !== b.key); });
    const asked = changed.map(i => `placed-preview:${i.id}`);
    (async () => {
      const next = new Map<string, { key: string; sourceKey: string; inst: PartInstance; bodies: BodyResult[] }>();
      for (const inst of changed) {
        const source = sources.get(inst.id); if (!source?.ok) continue;
        const at = revision.current++, reply = await lanes.run(`placed-preview:${inst.id}`, { revision: at, source: source.key }, () => engine.placed(placedDoc(inst, cutPreviewDoc), source.base, placementOf(inst), at));
        if (reply.stale || generation !== workerSessionNow.current) return;
        if (reply.result.ok) next.set(inst.id, { key: `${inst.id}#p${++instanceRun.current}`, sourceKey: source.key, inst, bodies: reply.result.bodies });
      }
      setCutPreview(next);
    })();
    return () => { for (const lane of asked) lanes.cancel(lane); };
  }, [cutPreviewDoc, shownDoc, instanceSources, workerSession]);
  const sceneInstanceBodies = useMemo(() => cutPreviewDoc !== shownDoc && cutPreview.size ? new Map([...instanceBodies, ...cutPreview]) : instanceBodies, [instanceBodies, cutPreview, cutPreviewDoc, shownDoc]);
  /** One undoable change of the instances and their mates together. */
  /** One undoable change of the placed parts and their waiting revisions (shared definitions). */
  const commitParts = useCallback((next: Pick<StudioDoc, 'instances' | 'pendingParts'>) => {
    if (!canChangeDocument()) return;
    pushUndo();
    if (!setDoc(withPatterns({ ...doc, instances: next.instances, pendingParts: next.pendingParts }))) return; setDirty(true);
  }, [doc, marker, acceptanceScope]);
  const commitAssembly = useCallback((instances: PartInstance[], mates: Mate[]) => {
    if (!canChangeDocument()) return false;
    pushUndo();
    if (!setDoc(withPatterns({ ...doc, instances, mates }))) return false; setDirty(true);
    return true;
  }, [doc, marker, acceptanceScope]);
  // Roadmap 10 ③: a pattern edit through the model (its refusal as a notice), committed with its occurrences.
  const patternEdit = (run: () => { doc: StudioDoc }, refused = 'Pattern not changed') => {
    let next: StudioDoc;
    try { next = run().doc; } catch (e) { setToast({ title: refused, hint: e instanceof Error ? e.message : String(e), detail: '' }); return; }
    commit(next);
  };
  // Roadmap 10 ⑤: Apply makes (or changes) the cut through the model, one undo step; a cut deleted, or undone, closes its HUD.
  const applyCut = () => {
    if (!cutDraft) return;
    const o = cutOfDraft(cutDraft), why = draftProblem(doc, cutDraft);
    if (typeof o === 'string' || why) { setToast({ title: 'Cut not made', hint: why ?? String(o), detail: '' }); return; }
    let next: StudioDoc;
    try { next = (cutDraft.editing ? editAssemblyCut(doc, { id: cutDraft.editing, ...o, name: o.name ?? null }) : addAssemblyCut(doc, o)).doc; }
    catch (e) { setToast({ title: 'Cut not made', hint: e instanceof Error ? e.message : String(e), detail: '' }); return; }
    if (commit(next)) setCutDraft(null);
  };
  // (The build trial of the draft — whether every cut part still builds — a pause after the last change, never on the typing path; Apply runs it again and refuses in words.)
  const cutKey = cutDraft ? JSON.stringify(cutDraft) : '', [cutTrial, setCutTrial] = useState<{ key: string; problem: string | undefined } | null>(null);
  useEffect(() => {
    if (!cutDraft || draftProblem(doc, cutDraft)) { setCutTrial(null); return; }
    const timer = setTimeout(() => setCutTrial({ key: cutKey, problem: draftTrialProblem(doc, cutDraft) }), 250);
    return () => clearTimeout(timer);
  }, [doc, cutKey]);
  const deleteCut = (id: string) => patternEdit(() => deleteAssemblyCut(doc, id), 'Cut not deleted');
  useEffect(() => { if (cutDraft?.editing && !doc.assemblyCuts?.some(c => c.id === cutDraft.editing)) setCutDraft(null); }, [doc.assemblyCuts, cutDraft?.editing]);
  const readLinkedFaces = useCallback(async (owner: string, input: StudioDoc) => {
    const result = await engine.part(bearingFaceInput(doc, owner, input), revision.current++, 'read');
    return result.ok ? result.faceTable ?? null : null;
  }, [doc, engine]);
  const assembly = useAssembly({ doc, evaluated, bodies, instanceBodies, setDoc: setDocState, commit: commitAssembly, readFaces: bomHasLinkedHousing(doc) ? readLinkedFaces : undefined });
  const robotExports = useRobotExports({ model: { doc, bodies, instanceBodies, instanceSources, fresh, busy, massReady }, assembly, fileName, onNotice: setToast });
  const { jointTree, robotReady, reportMotionError } = robotExports;
  // The joint-slider pose (RM2): a preview only — the instances shown moved by forward kinematics, nothing saved.
  // (R1c (3b): the App follows the pose and the explode factor in each frame only where it uses them itself — a CPU
  // section's copies, the clearance check; elsewhere SceneViewport and the Joints card do, not the App.)
  const posesInApp = clearanceEnabled || (!!section && !sketch && !gpuSection);
  const loopMotionContext = useMemo(() => jointTree?.loops.length ? { doc, tree: jointTree } : undefined, [doc, jointTree]);
  const joints = useJoints(jointTree, posesInApp, doc.robot?.motions, loopMotionContext, reportMotionError);
  const { poseStore, workspace, jointFk, motion, motionContact, setMotionContact, contactShown, motionChoice } = joints;
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
      // (#2229: a sweep that ran out of its sample budget is not a contact and not clear: say so, tint nothing.)
      if (r.exhausted) setToast({ title: 'Motion contact check not certified', hint: `The sweep ran out of its sample budget at t ${r.exhausted.t.toFixed(3)} s: the motion is neither clear nor in contact.`, detail: '' });
    } catch (error) {
      setMotionContact(null); setToast({ title: 'Motion contact check refused', hint: error instanceof Error ? error.message : String(error), detail: '' });
    }
  }, [motion, jointTree, robotReady, bodies, instanceBodies, setMotionContact, setToast]);
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
  const { instancesPlaced, instancePoseMap, cpuInstanceSection, instancesShown } = useScenePoses(doc, sceneInstanceBodies, bodies, jointFk, explode, section, sketch, gpuSection, instDrag);
  // Roadmap 10 ⑥: the Steps panel. While it is shown the viewport leaves the waiting parts out (or draws them faded), highlights the step's own
  // parts and takes the step's explode scale and view; closing it puts the display back (all parts, the explode it had, the camera as it is).
  const stepsShown = stepsOpen && !bomOpen && !libraryOpen && !paramsOpen && !variantsOpen && !rebuildOpen && !rendering && !drawing && !sketch && !active;
  const stepCount = stepsOf(doc).length, stepAt = stepCount ? Math.min(stepIndex, stepCount - 1) : 0;
  const stepsDisp = useMemo(() => stepsShown ? stepsDisplay(doc, stepAt, stepsFaded) : null, [stepsShown, doc.assemblySteps, doc.instances, stepAt, stepsFaded]);
  const explodeBefore = useRef<number | null>(null), stepExplode = stepsDisp?.explode;
  useEffect(() => {
    if (stepExplode === undefined) { if (explodeBefore.current !== null) { setExplode(explodeBefore.current); explodeBefore.current = null; } return; }
    if (explodeBefore.current === null) explodeBefore.current = explodeStore.get();
    setExplode(stepExplode);
  }, [stepExplode]);
  const stepView = stepsDisp?.state.step.view, stepViewRef = useRef(stepView), stepId = stepsDisp?.state.step.id;
  stepViewRef.current = stepView;
  const applyStepView = useCallback(() => { const v = stepViewRef.current, vp = viewport.current; if (v && vp) vp.setCamera(cameraOfView(v, vp.getCamera())); }, []);
  // (On entering a step only: an edit of the step's explode scale or note does not take the camera back.)
  useEffect(() => { if (stepId) applyStepView(); }, [stepId, applyStepView]);
  const stepEdit = (run: () => { doc: StudioDoc }, then?: () => void) => {
    let next: StudioDoc;
    try { next = run().doc; } catch (e) { setToast({ title: 'Step not changed', hint: e instanceof Error ? e.message : String(e), detail: '' }); return; }
    if (commit(next)) then?.();
  };
  const stepChange = (o: EditAssemblyStepOptions) => stepEdit(() => editAssemblyStep(doc, o));
  const stepParts = () => hostsOf(instanceSel).filter(id => doc.instances?.some(i => i.id === id));
  const newStep = () => {
    const add = stepParts();
    if (!add.length) { setToast({ title: 'Step not added', hint: 'Select the parts the step adds first, in the Browser or the view.', detail: '' }); return; }
    stepEdit(() => addAssemblyStep(doc, { add }), () => setStepIndex(stepCount));
  };
  const stepsProblems = useMemo(() => assemblyStepProblems(doc).map(p => p.message), [doc.assemblySteps, doc.instances]);
  const stepsOffer = stepsShown ? stepOffer(doc, instanceSel, stepAt) : null;
  // (`source`: what the instance names as its file — CG6: `./<path>` for a project document, storage/linked.ts.)
  const insertPart = async (file: File, source = file.name) => {
    try {
      const read = await readStudioFile(new Uint8Array(await file.arrayBuffer()));
      if ('error' in read) throw new Error(read.error);
      const parsed = read.doc;
      const pathProblem = insertedCurvePartProblem(parsed);
      if (pathProblem) throw new Error(pathProblem);
      if (parsed.schema === 4 || Object.prototype.hasOwnProperty.call(parsed, 'routeBundles')) throw refusal('BAD_REFERENCE', 'Route bundle: inserting a linked route document as a part is not supported. Detach the bundle first.');
      const list = doc.instances ?? [], newId = nextInstanceId(doc, 'inst');
      // Placed to the right of everything shown.
      const right = Math.max(0, ...bodies.map(b => b.mesh.bounds.max[0]), ...[...instanceBodies.values()].flatMap(v => v.bodies.map(b => b.mesh.bounds.max[0])));
      const inst: PartInstance = { id: newId, name: file.name.replace(/\.(bcad|json)$/i, ''), doc: { ...parsed, render: undefined, direct: undefined }, position: [Math.ceil(right + 20), 0, 0], rotation: [0, 0, 0], part: { id: freshPartId(doc), rev: revisionOf(parsed), source } };
      if (!commitInstances([...list, inst], [inst.id])) return; setSelection(emptySel); setDirectSel([]);
      setTimeout(() => viewport.current?.fit(), 600);
    } catch (e) { setToast({ title: 'Could not insert this part', hint: e instanceof Error ? e.message : String(e), detail: '' }); }
  };
  const { play, animatedAt, videoBusy, recordVideo, exportImage } = useRenderPlayback({ render, rendering, state: { time, setTime, playing, setPlaying, turnFrom }, viewport, fileName, onNotice: setToast });

  const cancel = useCallback(() => { discardDirectCandidateRef.current(); discardRouteRef.current(); setActive(null); setPreviewBodies(null); setSketch(null); }, [setSketch]);

  const openRoute = () => {
    cancel(); setPole(null); setPoleDrag(null); routeEditor.open(directSel);
  };

  useEffect(() => routeEditor.cancelIfChanged(doc), [doc]);
  useEffect(() => () => routeEditor.dispose(), []);

  const bearingRootCurrent = active?.cmd.id !== 'bearing' || active.ctx.bearingAssembly?.root === doc;
  const commandPreview = useCommandPreview({ command: { activeStore, bearingRootCurrent }, worker: { engine, nextRevision: () => revision.current++, currentBearingDoc: () => bearingEditScope.current.doc, wholeMs: () => lastEvalMs.current },
    result: { setPreviewBodies, previewFor } });
  const { handleDrag, lastTyped } = commandPreview;
  useEffect(() => commandPreview.watch(), [active?.cmd, engine, bearingRootCurrent, activeStore]);

  /** The command to start again once what Shift-Enter applied is the part (its bodies evaluated). */
  const again = useRef<Command | null>(null);
  const [restart, setRestart] = useState<Command | null>(null);
  // Apply while the preview is still computing (just after a drag or a typed value) waits for it.
  const applyWhenReady = useRef<Command | null>(null);
  const apply = useCallback(() => {
    // (R1d: the command as it is now, its values and preview state — the App may not have rendered since they changed.)
    const active = activeStore.get();
    if (!active?.cmd.build || !canChangeDocument()) return;
    if ((active.cmd.id === 'thicken' || active.cmd.id === 'sew' || active.cmd.id === 'offset-face') && active.ctx.doc !== commandDoc) {
      applyWhenReady.current = null;
      setToast({ title: 'Source changed', hint: active.cmd.id === 'offset-face' ? 'Start Offset face again on the current body and face.' : `Start ${active.cmd.label} again to copy the current surfaces.`, detail: '' });
      return;
    }
    if (active.upload) { applyWhenReady.current = null; return; }
    if (!bearingRootCurrent) { applyWhenReady.current = null; return; }
    if (active.preview === 'busy') { applyWhenReady.current = active.cmd; return; }
    applyWhenReady.current = null;
    if (active.preview !== 'ok') return;
    // The preview is what the part becomes: shown as the part at once (no step back to the old bodies
    // while the committed document evaluates).
    const next = active.cmd.build(active.ctx, active.values);
    // (Not when it places an instance: those bodies are the instance's, shown once it is evaluated.)
    if (!commit(next)) return;
    if (active.cmd.id === 'offset-face' || active.cmd.id === 'fill-feature-pattern' || active.cmd.id === 'curve-feature-pattern') setSelection(emptySel);
    if (active.cmd.id === 'thicken' || active.cmd.id === 'sew') setDirectSel([]);
    if (previewBodies && Object.keys(next.outputs).length && (next.instances?.length ?? 0) === (active.ctx.doc.instances?.length ?? 0)) { setBodies(previewBodies); claimBodies.current = true; }
    setActive(null); setPreviewBodies(null); setSketch(null);
  }, [activeStore, commit, previewBodies, bearingRootCurrent, commandDoc, setSketch, acceptanceScope]);
  const uploadFont = useCallback(async (key: string, file: File) => {
    const captured = activeStore.get();
    if (!captured || key !== 'font') return;
    const { cmd, ctx } = captured;
    applyWhenReady.current = null;
    lastTyped.current = Date.now(); handleDrag.current = null;
    setPreviewBodies(null);
    setActive(a => {
      if (!a || a.cmd !== cmd || a.ctx !== ctx) return a;
      const values = { ...a.values, [key]: '' }; hudValues.current = values;
      return { ...a, values, upload: 'busy', preview: 'busy', error: undefined };
    });
    try {
      const source = await fontUpload.load(ctx, file);
      if (!source) return;
      setActive(a => {
        if (!a || a.cmd !== cmd || a.ctx !== ctx) return a;
        const values = patchValues(a.cmd, a.ctx, a.values, { [key]: JSON.stringify(source) }); hudValues.current = values;
        return { ...a, values, upload: undefined, preview: 'busy', error: undefined };
      });
    } catch (error) {
      setActive(a => a && a.cmd === cmd && a.ctx === ctx ? { ...a, upload: 'error', preview: 'error', error: {
        title: 'Could not read the font', hint: error instanceof Error ? error.message : String(error), detail: '',
      } } : a);
    }
  }, [activeStore, fontUpload]);
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

  // Roadmap 10 ⑤: the Assembly cut HUD — new (on the selected parts, at the middle of their top, going down) or editing a cut of the Browser.
  const openCut = useCallback((id: string | null) => {
    const cut = id ? doc.assemblyCuts?.find(c => c.id === id) : undefined;
    if (id && !cut) return;
    const targets = cuttableOf(doc, instanceSel), boxes = targets.flatMap(t => (instanceBodies.get(t)?.bodies ?? []).map(b => b.mesh.bounds));
    setInstanceEdit(null); setCutDraft(cut ? draftOfCut(cut) : newCutDraft(targets, defaultCutAt(boxes)));
  }, [doc, instanceSel, instanceBodies]);
  const start = useCallback((cmd: Command, initial?: Values) => {
    if ((cmd.build || cmd.action === 'sketch' || cmd.action === 'cage' || cmd.action === 'assembly-cut' || cmd.id === SKETCH3D_COMMAND.id) && !canChangeDocument()) return;
    discardRouteRef.current(); setRoutePanelOpen(false);
    if (cmd.action !== 'assembly-cut') setCutDraft(null);
    setPalette(false); setRendering(false); setPlaying(false); setDrawing(false);
    const avail = cmd.available(ctx);
    if (!avail.ok) { setToast({ title: `${cmd.label} can’t run here`, hint: avail.reason, detail: '' }); return; }
    if (variants.showing) { setToast({ title: `${cmd.label} can’t run here`, hint: `Showing ${variants.showing}: show the master to edit.`, detail: '' }); return; }
    if (cmd.id === SKETCH3D_COMMAND.id) { cancel(); skel.begin(null); setSelection(emptySel); setEditNode(null); return; }
    if (cmd.id === STEPS_COMMAND.id) { cancel(); setBomOpen(false); setRebuildOpen(false); setVariantsOpen(false); setLibraryOpen(false); setParamsOpen(false); setStepsOpen(true); return; }
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
    if (cmd.action === 'assembly-cut') { cancel(); openCut(null); return; }
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
    setActive({ cmd, values: { ...(cmd.defaults?.(startCtx) ?? {}), ...initial }, preview: 'busy', ctx: { ...startCtx }, ...(cmd.place ? { placing: true } : {}) });
  }, [ctx, selection, bodies, engine, commit, evaluated.nodes, shownDoc.direct, variants.showing, setSketch, acceptanceScope, openCut]);

  const openHistoryFeature = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    const raw = event.currentTarget.dataset.nodeIndex;
    if (raw === undefined) return;
    const index = Number(raw), node = doc.nodes[index];
    if (!Number.isInteger(index) || index < 0 || !node) return;
    setInstanceSel([]); setDirectSel([]); assembly.cancel();
    if (node.kind === 'text' || node.kind === 'text-relief' || node.kind === 'cylindrical-wrap' || node.kind === 'band-surface') {
      const command = editCommand(index, doc.nodes, doc);
      if (command) {
        // Roll forward before the deferred start, so editing retains all later authored features.
        setMarker(null); setEditNode(null); setActive(null); setPreviewBodies(null); setRestart(command);
        return;
      }
    }
    setEditNode(index);
  }, [doc, assembly]);

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

  const sketchActions = useSketchActions({ model: { doc, bodies, selection, marker }, editor: { sketch, setSketch, sketchGeneration }, owner: { docNow, acceptanceScope },
    worker: { engine, nextRevision: () => revision.current++ }, viewport, changes: { canChangeDocument, commit, commitDirect, setSelection, setEditNode, setActive, setPreviewBodies }, onNotice: setToast });
  const { makeSketchBand, placeSketch, sketchToCurves, edgesToCurves, offsetSketch, trimSketch, editSketch, linkSketchInset, finishSketch } = sketchActions;

  const viewBodiesRef = useRef<BodyResult[]>(null!);
  const sectionBoxRef = useRef<{ min: Vec3; max: Vec3 }>(null!);
  const { onPick } = useViewportPicking({ doc, activeStore, setActive, measure, assembly, sectionRef, sectionFacePickRef, viewBodiesRef,
    sectionBoxRef, setSection, setSectionFacePick, setToast, activeRef, halvesShownRef, setPick, setInstanceSel, setSelection, setDirectSel, setMeasure, pickFilterRef });
  pickRef.current = onPick;
  // Finished sketches waiting for a feature, drawn and picked in the viewport and the History.
  const freeSketches = useMemo(() => unusedSketches(evaluated.nodes), [evaluated.nodes]);
  // The steps inside a part made in several (a bolt's head, shank and their union): one history entry, the last.
  const innerSteps = useMemo(() => new Set(doc.nodes.flatMap((n, i) => 'made' in n && n.made?.nodes ? Array.from({ length: n.made.nodes - 1 }, (_, k) => i - n.made!.nodes! + 1 + k) : [])), [doc.nodes]);
  const profiles = useMemo(() => sketch ? [] : freeSketches.map(i => ({ id: i, rings: ringsOf(evaluated.nodes[i] as SketchNode, shownDoc.parameters), picked: !!selection.sketches?.includes(i) })), [freeSketches, evaluated.nodes, shownDoc.parameters, selection.sketches, sketch]);
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
  const invalidateDocumentWork = () => {
    workOwnership.current = invalidateWork(workOwnership.current); undoFor.current = null; workCompletion.current = null;
    parameterRequest.current++; parameterEditNow.current = null; setParameterEdit(null); parameterHandoff.current = null;
    if (parameterMass.current && !parameterMass.current.target) parameterMass.current = null;
    setBusy(false);
  };
  // A failed or restarted worker cannot supply current caches or finish an older import.
  const invalidateWorkerResults = () => {
    // A content match cannot carry worker provenance across restart. Keep old pixels stale until recomputed.
    acceptedEvaluation.current = null; parameterHandoff.current = null; routeAcceptedHandoff.current = null; parameterMass.current = null;
    claimBodies.current = false; setBodiesFor(null); discardRouteRef.current();
    setInstanceBodies(new Map()); workerSessionNow.current++; setWorkerSession(workerSessionNow.current);
    setBusy(false); setSlow(false); setPreviewBodies(null);
  };
  const restartDocumentWorker = () => {
    invalidateWorkerResults();
    const ready = engine.restart();
    if (ready) setWorkerFailure(null);
    return ready;
  };
  workerFailureHandler.current = error => {
    beginOpenIntent(); invalidateDocumentWork(); invalidateWorkerResults(); setWorkerFailure(error);
  };
  const retryWorker = () => {
    beginOpenIntent(); invalidateDocumentWork();
    if (restartDocumentWorker()) { setToast(null); setImportWorkerRecovery(value => value + 1); }
  };
  const toast = workerFailure ? { ...workerFailure, action: { label: 'Retry engine', run: retryWorker } } : notice;
  const cancelWork = () => {
    if (!workOwnership.current.run) { setBusy(false); setSlow(false); return; }
    const stopped = stopOwnedWork(workOwnership.current, docNow.current, evaluatedRef.current, undo[undo.length - 1]);
    workOwnership.current = stopped.state; undoFor.current = null; workCompletion.current = null;
    // Invalidate before restart resolves pending promises. An unaccepted candidate has no history to undo.
    parameterRequest.current++;
    parameterEditNow.current = null; setParameterEdit(null);
    restartDocumentWorker();
    const target = stopped.target;
    if (target) {
      const redoEntry = { doc: docNow.current, marker: markerNow.current };
      setRedo(r => [...r, redoEntry]); setUndo(u => u.slice(0, -1));
      docNow.current = target.doc; setDocState(target.doc); setMarker(target.marker); setDirty(true); cancel();
      setToast({ title: 'Stopped', hint: 'The computation was stopped and its change taken back.', detail: '' });
    } else setToast({ title: 'Stopped', hint: 'The computation was stopped; no unrelated change was taken back.', detail: 'The document is unchanged. The view is not up to date.' });
  };
  const doUndo = useCallback(() => {
    if (!undo.length) return; const last = undo[undo.length - 1];
    invalidateDocumentWork(); docNow.current = last.doc;
    setRedo(r => [...r, { doc, marker }]); setUndo(u => u.slice(0, -1)); setDocState(last.doc); setMarker(last.marker); cancel();
  }, [undo, doc, marker, cancel]);
  // (The latest undo, for a toast made before the change it takes back was committed.)
  const undoNow = useRef(doUndo); undoNow.current = doUndo;
  const doRedo = useCallback(() => {
    if (!redo.length) return; const last = redo[redo.length - 1];
    invalidateDocumentWork(); docNow.current = last.doc;
    setUndo(u => [...u, { doc, marker }]); setRedo(r => r.slice(0, -1)); setDocState(last.doc); setMarker(last.marker); cancel();
  }, [redo, doc, marker, cancel]);

  const featureHistory = useFeatureHistory({ model: { doc, marker, bodies, selection }, worker: { engine, nextRevision: () => revision.current++ },
    changes: { canChangeDocument, commit, setSelection }, onNotice: setToast });
  const { deleteNode, separate, reorder, toggleSuppress, cascade, setCascade, deleteCascade, deleteSelection } = featureHistory;
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
  // A new or opened part replaces the document: an open sketch or tool would carry the old part's shapes
  // and face references into it, so they close first (U4).
  // (What was picked in the old part goes too: instances, direct-edit faces, measurements.)
  // (CG6: from anywhere but the project, the document is no longer its open one — `fromProject` keeps it so.)
  const replaceDoc = (next: StudioDoc, fromProject = false) => {
    invalidateDocumentWork(); replacementScope.current = workOwnership.current.scope;
    try {
      if (!commit(next, false, true)) return;
      if (!fromProject) { project.detach(); setCompareBase(null); }
      cancel(); setCutDraft(null); setDocGeneration(g => g + 1); setSelection(emptySel); setPick(null); setInstanceSel([]); setIsolatedInstances(undefined); setDirectSel([]); setMeasure(null); setEditNode(null);
    } finally { replacementScope.current = null; }
  };
  // Roadmap 10 ⑧: a part edited in place. The session swaps the working document for the part's own and back; the other parts are drawn around it
  // (inPlace.context). Begin: the assembly's undo and redo stacks are set aside and the session's own start empty. Finish: one commit of the assembly
  // (one undo step, the whole previous assembly), or none when nothing changed. Cancel: the assembly exactly as it was.
  const sessionBlocked = (doing: string) => {
    const why = inPlaceBlock(inPlaceNow.current, doing);
    if (why) setToast({ title: 'A part is being edited', hint: why, detail: '' });
    return !!why;
  };
  const toolOpen = () => !!active || !!sketch || rendering || drawing || !!measure || !!assembly.draft || !!cageEd.session || !!skel.session || !!parameterEdit || !!shownVariant.current || !!ghost, toolRunning = () => busy || toolOpen();
  const startInPlace = (owner: string) => {
    const elsewhere = elsewhereOf({ chat: chatRunning, importing: stage !== null || !!meshAsk || !!repairAsk, projectOpening: project.opening() });
    const why = editInPlaceRefusal(doc, owner, { session: !!inPlace, working: toolRunning(), fresh, elsewhere });
    if (why) { setToast({ title: 'Can’t edit this part now', hint: why, detail: '' }); return; }
    const session = beginInPlace(doc, owner, bodies, instanceBodies, { undo, redo, marker, dirty });
    if (!session) return;
    beginOpenIntent();
    replaceDoc(session.base, true); if (docNow.current !== session.base) return;
    setUndo([]); setRedo([]); setInPlace(session); setAskDiscard(false); setCompareBase(null); setVersionsOpen(false);
    setTimeout(() => viewport.current?.fit(), 300);
  };
  const leaveInPlace = (s: InPlaceSession, next: StudioDoc, changed: boolean) => {
    beginOpenIntent();
    replaceDoc(next, true); if (docNow.current !== next) return false;
    const stacks = stacksAfter(s, changed);
    setUndo(stacks.undo); setRedo(stacks.redo); setMarker(changed ? null : s.saved.marker); setDirty(changed || s.saved.dirty);
    setInPlace(null); setAskDiscard(false); setInstanceSel([s.owner]);
    return true;
  };
  const finishInPlaceSession = () => {
    const s = inPlaceNow.current; if (!s) return;
    const why = editInPlaceRefusal(s.assembly, s.owner, { session: false, working: toolOpen(), fresh });
    if (why) { setToast({ title: 'Can’t finish yet', hint: why, detail: '' }); return; }
    const r = finishInPlace(s, docNow.current);
    if ('error' in r) { setToast({ title: 'The part was not taken', hint: r.error, detail: 'You are still editing it.' }); return; }
    if (!leaveInPlace(s, r.doc, r.changed)) return;
    if (r.held.length) setToast({ title: `${r.held.length} look${r.held.length > 1 ? 's' : ''} held`, hint: r.held.map(h => h.problem).join(' '), detail: '' });
    else if (r.changed) setToast({ title: `${s.name} updated`, hint: s.shared > 1 ? `All ${s.shared} instances share it. Undo restores the assembly as it was.` : 'Undo restores the assembly as it was.', detail: '' });
  };
  const cancelInPlaceSession = () => {
    const s = inPlaceNow.current; if (!s) return;
    // (A session with changes asks first; nothing cancels it by itself, Esc included.)
    if (!askDiscard && sessionChanged(s, docNow.current)) { setAskDiscard(true); return; }
    leaveInPlace(s, s.assembly, false);
  };
  // (A document with mesh blobs is saved as the container, else as plain JSON: engine/container.ts. Saved, the
  // recovery copy and its blobs go.)
  const writeFile = (d: StudioDoc, name: string) => {
    try { writeDocumentFile(d, name); return true; }
    catch (e) { setToast({ title: 'Could not save', hint: e instanceof Error ? e.message : String(e), detail: '' }); return false; }
  };
  // (A copy still offered keeps its blobs: Restore can still bring it back.)
  const save = () => {
    if (sessionBlocked('saving')) return;
    // (CG6: into the open project — over the file it was read from, its tag expected — else downloaded, as before.)
    if (project.view.store) {
      const savedDoc = doc, owner = { token: saveAcceptanceScope, doc: savedDoc, name: fileNameNow.current };
      void project.save(savedDoc, owner.name, () => {
        if (!currentDocumentSave(owner, saveDocumentToken.current, docNow.current, fileNameNow.current)) return;
        setDirty(false); clearRecovery();
      });
      return;
    }
    if (!writeFile(doc, `${fileName}.bcad`)) return; setDirty(false); clearRecovery(); void collectRecoveryBlobs(recovery?.doc ?? null);
  };
  /** A copy to share: without the design history, nor the proposals' prompts and plans (chat/proposals.ts). */
  const saveShared = () => { if (sessionBlocked('saving')) return; writeFile(stripHistory(doc), `${fileName}-shared.bcad`); };
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
  const captureImportOwner = () => {
    const scope = openIntent.current, dispatch = saveDocumentToken.current, session = workerSessionNow.current;
    return { isCurrent: () => isOpenCurrent(scope) && saveDocumentToken.current === dispatch && workerSessionNow.current === session };
  };
  const fitImportedLater = () => {
    const accepted = captureImportOwner();
    setTimeout(() => { if (accepted.isCurrent()) viewport.current?.fit(); }, 300);
  };
  const openedImport = (next: StudioDoc, name: string) => {
    if (!openAccepted(inPlaceNow.current)) { sessionBlocked('opening an import'); return false; }
    replaceDoc(next); if (docNow.current !== next) return false;
    setFileName(name); setDirty(true); fitImportedLater(); return true;
  };
  const meshImport = useMeshImport({ doc, engine, captureOwner: captureImportOwner,
    onStop: () => { beginOpenIntent(); invalidateDocumentWork(); if (restartDocumentWorker()) setImportWorkerRecovery(value => value + 1); },
    nextRevision: () => revision.current++, onNotice: setToast, onOpened: openedImport, onCommit: commit });
  const { meshAsk, setMeshAsk, stage, repairAsk, setRepairAsk, stopStage } = meshImport;
  const editRepair = (index: number) => { beginOpenIntent(); setMeshAsk(null); setRepairAsk(null); return meshImport.editRepair(index); };
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
  // (PERF3 B13, O135: the mesh blobs no step reaches dropped at an idle point — two seconds after the last change, no
  // repair asked; a chat turn holds sweeps while it runs. The roots: the document, every undo and redo step. DEV: the
  // bytes each sweep freed, window.__studioBlobs.)
  useEffect(() => {
    if (repairAsk) return;
    const t = setTimeout(() => {
      const s = evictBlobs([doc, ...undo.map(u => u.doc), ...redo.map(r => r.doc), ...(evaluatedRef.current ? [evaluatedRef.current] : []), ...(inPlace ? [inPlace.assembly, ...inPlace.saved.undo.map(u => u.doc), ...inPlace.saved.redo.map(r => r.doc)] : [])]);
      if (s && import.meta.env.DEV) (window as unknown as { __studioBlobs: unknown }).__studioBlobs = { ...blobStats, kept: s.kept, graced: s.graced.length };
    }, 2000);
    return () => clearTimeout(t);
  }, [doc, undo, redo, repairAsk, inPlace]);
  const open = async (file: File) => {
    if (sessionBlocked('opening a file')) return;
    const scope = beginOpenIntent(), owner = captureImportOwner();
    setMeshAsk(null); setRepairAsk(null);
    try {
      if (isImportedFile(file.name)) {
        await openImportedFile(file, { doc, ownership: owner, worker: { engine, nextRevision: () => revision.current++ }, mesh: meshImport, onNotice: setToast,
          changes: { commitDirect, fitLater: fitImportedLater, onOpened: openedImport } });
        return;
      }
      // Any other kind of file is named, with what Open reads; the part unchanged. (A file without an extension is still
      // tried as a model below.)
      if (/\.[^./\\]+$/.test(file.name) && !/\.(bcad|json)$/i.test(file.name)) { setToast({ title: `Can’t open ${file.name}`, hint: OPEN_READS, detail: '' }); return; }
      // Checked and, for an older file, brought up to date (said what was filled in); the file is left as it is.
      const read = await readDocumentFile(file, () => isOpenCurrent(scope));
      if (!read || !isOpenCurrent(scope)) return;
      if ('error' in read) { setToast({ title: 'Could not open this file', hint: `${read.error} Your part is unchanged.`, detail: '' }); return; }
      const parsed = read.doc;
      const acceptedDoc = { ...parsed, ...(parsed.render ? { render: readRender(parsed.render) } : {}), ...(parsed.drawing ? { drawing: readDrawing(parsed.drawing) } : {}) };
      replaceDoc(acceptedDoc); setFileName(file.name.replace(/\.(bcad|json)$/, '')); setDirty(read.notes.length > 0);
      const accepted = openIntent.current, dispatch = saveDocumentToken.current;
      if (read.notes.length) setToast({ title: 'Opened an older model', hint: `${read.notes.join('; ')}. Save to keep it in the current form (the file is unchanged until then).`, detail: '' });
      setTimeout(() => { if (isOpenCurrent(accepted)) viewport.current?.fit(); }, 300);
      void verifyOpened(acceptedDoc, accepted, dispatch);
    } catch (e) { if (owner.isCurrent()) { meshImport.setStage(null); setToast({ title: 'Could not open this file', hint: String(e instanceof Error ? e.message : e), detail: '' }); } }
  };
  const { refLocal, keepoutBodies, keepoutVerdicts, spec, specRunning } = useModelChecks({ model: { doc, evaluated, bodies, fresh, busy, active, sketch, previewBodies },
    worker: { engine, nextRevision: () => revision.current++ }, onNotice: setToast });
  const [failingOnly, setFailingOnly] = useState(false);
  const proposals = useProposalPreview({ model: { doc, bodies, marker, active: !!active, sketch: !!sketch }, worker: { engine, lanes, nextRevision: () => revision.current++ },
    changes: { commit, setPreviewBodies }, chatRowFiles, onNotice: setToast });
  const { ghost, proposalOverlay, proposalBusy, hashNow, partEval, acceptIt, rejectIt } = proposals;
  const [decidedShown, setDecidedShown] = useState(false), [historyOpen, setHistoryOpen] = useState(false);
  routeContext.current = { blocked: busy || !fresh || !!parameterEdit || marker !== null || !!shownVariant.current || !!active || !!sketch || rendering || drawing || !!measure || !!assembly.draft || !!cageEd.session || !!skel.session || !!ghost };
  useEffect(() => routeEditor.discardBlocked(), [busy, fresh, parameterEdit, marker, active, sketch, rendering, drawing, measure, assembly.draft, cageEd.session, skel.session, ghost, doc]);
  useEffect(() => proposals.resetForModelChange(), [doc.nodes, doc.parameters]);
  useEffect(() => proposals.updateDiff(), [ghost?.id, ghost?.shown]);
  // (CG6: a version compared with the working document — its geometry's difference on the same overlay, version → working.)
  useEffect(() => {
    if (!compareBase) { setCompareOverlay(null); return; }
    const at = revision.current++, key = `version:${compareBase.id}`;
    void lanes.run('proposal-diff', { revision: at, source: key }, () => engine.proposalDiff(compareBase.doc, doc, at, { revision: modelHash(doc), proposal: key })).then(reply => { if (!reply.stale) setCompareOverlay('error' in reply.result ? null : reply.result); });
    return () => lanes.cancel('proposal-diff');
  }, [compareBase, doc]);
  const { setRequirement, answerQuestions, acceptAll, refTool, addDrawingFile, addReferenceFile, placeRef, removeRef, confirmBrief } =
    useSpecificationActions({ doc, bodies, commit, engine, revision, setToast, setChat, setChatOutbox });
  // The references marked matched again (until confirmed), and the user's say on them and on the problems.
  const refMarks = useMemo(() => markedReferences(doc), [doc]);
  const referenceDimension = (where: string) => doc.drawing?.dimensions.find(d => where === `dimension ${d.id}`);
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
    if (!canChangeDocument()) return;
    pushUndo(); if (!setDoc(next)) return;
    setRefProblems(ps => ps.filter(p => p.index !== index)); setRefChoices(null); setDirty(true);
  };
  const showRefChoices = async (index: number) => setRefChoices({ index, names: await candidatesFor(doc, index, bodies, d => engine.part(d, revision.current++, 'refs')) });
  // The opened file's stored references checked against their signatures (no prior document: a newer kernel may
  // number faces otherwise, engine/references.ts); what moved is substituted, marked, and said.
  const verifyOpened = async (opened: StudioDoc, scope: OpenScope, dispatch: object) => {
    const current = () => isOpenCurrent(scope) && saveDocumentToken.current === dispatch && docNow.current === opened;
    // (O19: one that does not build because a stored name moved, REFERENCE_MOVED, is checked too — its moved names matched again, or held.)
    const v = await verifyDocumentFile(opened, d => engine.part(d, revision.current++, 'refs'), current);
    if (!v || !current()) return;
    setRefProblems(v.problems);
    if (!v.changes.length && !v.problems.length) return;
    const cur = docNow.current;
    const next = { ...v.doc, render: cur.render, ...(v.doc.drawing ? { drawing: readDrawing(v.doc.drawing) } : {}) };
    // Apply only to this accepted dispatch, before any later edit or replacement.
    if (cur.print === undefined) delete next.print; else next.print = cur.print;
    if (cur.printPreview === undefined) delete next.printPreview; else next.printPreview = cur.printPreview;
    setDocState(next); setDirty(true);

  };
  /** A sketch's profile as DXF, 1:1 in its plane (R11b, O1). */
  const exportSketchDxf = (index: number) => {
    const n = doc.nodes[index];
    if (n?.kind !== 'sketch') return;
    try { downloadBytes(sketchDxf(n, doc.parameters).bytes, `${fileName}-sketch-${index + 1}.dxf`, 'image/vnd.dxf'); }
    catch (e) { setToast({ title: 'Could not write the DXF', hint: e instanceof Error ? e.message : String(e), detail: '' }); }
  };
  const modelExports = useModelExports({ model: { doc, evaluated, bodies, fresh, busy, massReady, instanceBodies },
    engine, fileName: inPlace ? inPlace.name : fileName, current: { doc: docNow, evaluated: evaluatedRef }, onNotice: setToast });
  const { stepAsk, stlAsk, askStlExport, exportStepFile, exportQuote, exportThreeMf, clearStepAsk } = modelExports;
  // (DEV, for the flow: the columns as a fresh viewer has them — the chat collapsed at its default width, no dock sheet — so
  // one step's open or drag does not carry into the next; and no toast — G12f: one left from an earlier step met the view
  // cube in the layout step. The recovery card is only hidden, its copy kept; a question's toast closed is cancelled.)
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as { __studioLayoutReset: () => void }).__studioLayoutReset = () => {
      layout.setChatOpen(false); layout.setChatWidth(CHAT_DEFAULT); layout.setDockSheet(false);
      setToast(null); setRecovery(null); setCascade(null); setMeshAsk(null); setRepairAsk(null); clearStepAsk();
    };
  }, [layout.setChatOpen, layout.setChatWidth, layout.setDockSheet]);
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
      if (e.isComposing) return;
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
      if (e.key === 'Escape' && parameterEditNow.current?.kind === 'direct') { e.preventDefault(); discardDirectCandidateRef.current(); return; }
      if (e.key === 'Escape' && routePanelOpen && !active && !sketch && !assembly.draft && !measure && !cageEd.session && !skel.session) { e.preventDefault(); discardRouteRef.current(); return; }
      if (e.key === 'Escape') { if (palette) setPalette(false); else if (sketch && !active && (sketch.picked?.length || sketch.editDim)) setSketch(s => s && { ...s, picked: [], editDim: null }); else if (active || sketch) cancel(); else if (assembly.draft) assembly.cancel(); else if (measure) setMeasure(null); else { setSelection(emptySel); setInstanceSel([]); setDirectSel([]); } return; }
      // Enter applies; Shift-Enter applies and starts the same command again (another hole, another shape).
      if (e.key === 'Enter' && !palette && !(e.target instanceof HTMLInputElement && e.target.type === 'file')) { if (sketch) { e.preventDefault(); finishSketch(); } else if (active) { e.preventDefault(); if (e.shiftKey && active.cmd.id !== 'edit') again.current = active.cmd; apply(); } return; }
      // A sketch tool key still works from a number box (letters are no numbers): it leaves the box.
      const numberBox = e.target instanceof HTMLInputElement && e.target.type === 'number' && !e.target.classList.contains('dim-edit');
      if (palette || (typing && !(sketch && numberBox && !e.metaKey && !e.ctrlKey && !e.altKey && /^[a-z]$/i.test(e.key)))) return;
      if (e.key === ' ') { e.preventDefault(); setPalette(true); return; }
      // Nudge the picked body: arrows 1 mm along X and Y (Shift: 10 mm), Page Up / Down along Z.
      if (/^(Arrow(Left|Right|Up|Down)|PageUp|PageDown)$/.test(e.key) && !active && !sketch && !measure) { const one = selectedBodies(selection); if (one.length === 1 && bodies[one[0]]) { e.preventDefault(); nudge(one[0], e.key, e.shiftKey ? 10 : 1); return; } }
      if (e.key === '?') { e.preventDefault(); setHelp(true); return; }
      if ((e.key === 'Delete' || e.key === 'Backspace') && !sketch && !active && !measure) {
        e.preventDefault();
        if (directSel.length && doc.direct) commitDirect({ ...doc.direct, objects: doc.direct.objects.filter(object => !directSel.includes(object.id)) }, []);
        else deleteSelection();
        return;
      }
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
  const appearance = useModelAppearance({ model: { doc, evaluated, bodies }, preview: { active, previewBodies, routePreviewBodies, ghost, proposalOverlay, compareOverlay },
    display: { bodyDrag: !!bodyDrag, section: !!section, sketch: !!sketch, sectionBodies, sectionExactShown, sectionExact, animatedAt } });
  const { drawnBodies, shownBodies, animatedOffsets, bodyColors, hiddenBodies, faceColors, proposalTint, placeSkip } = appearance;
  // Mate faces show while a mate is being added, or while one is selected in the shown mates list.
  const mateFaces = !!assembly.draft || (!!assembly.selected && !!singleTop(instanceSel));
  const sectioned = !!(section && sectionBodies && !sketch && !previewBodies);
  // (G2: the viewer's clip plane while the section is open on WebGPU — on the bodies until their exact section is shown,
  // on the placed parts always; none in a sketch, where the section is not shown.)
  const { scalarMaps, isoclines, mouldShown, mapLegend } = useAnalysisMaps({ doc, evaluated, shownBodies, mapKind, rendering, sketch,
    previewBodies, viewport, engine, revision, lanes, mouldResult, setMouldResult, mouldSpread, halvesShownRef, viewBackend });
  const { sectionBox, sectionHatchOn, setSectionHatchOn, hatchStep, sectionClip, sectionLiveView, sectionHatchLines } = useSectionDisplay({
    bodies, instancesPlaced, section, sketch, gpuSection, shownBodies, sectionBodies, sectionExactShown, sectionLive, active, dragSection });
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
  // (The Band surface command highlights what it has picked — A and B — while it runs, also when its preview hides the selection.)
  const bandShown = active?.cmd.id === 'band-surface' ? bandHighlight(bodies, bandPicksOf(active.values)) : null;
  const shownSelection = sectioned ? { faces: shownBodies.flatMap((b, bi) => b.mesh.faces.filter(f => cutAfter(f.name, sectionFrom)).map(f => ({ body: bi, face: f.index }))), edges: [], bodies: [] }
    : bandShown ? bandShown
    : routePreviewBodies || routePanelOpen || previewBodies || sketch ? emptySel : mateFaces ? { faces: assembly.highlight.faces, edges: [], bodies: [] } : measure ? { faces: measure.flatMap(m => m.face !== undefined ? [{ body: m.body, face: m.face }] : []), edges: measure.flatMap(m => m.edge !== undefined ? [{ body: m.body, edge: m.edge }] : []), bodies: [] } : selection;
  const measured = measure?.length === 2 && bodies[measure[0].body] && bodies[measure[1].body] ? measureBetween(bodies[measure[0].body].mesh, measure[0], bodies[measure[1].body].mesh, measure[1]) : null;
  // (The locked references and the keep-outs, A6.3: drawn ghosted after the part's bodies, never picked.)
  const refShown = useMemo(() => { const set = readReferences(doc.references); return [...set.references.flatMap(r => placeReference(refLocal.get(r.id) ?? [], r.at)), ...keepoutBodies]; }, [doc.references, refLocal, keepoutBodies]);
  // (An in-place edit's surroundings, roadmap 10 ⑧: ghosted the same way, after the references.)
  const ghostExtra = useMemo(() => inPlace ? [...refShown, ...inPlace.context] : refShown, [refShown, inPlace?.context]);
  const viewBodies = useMemo(() => (ghostExtra.length ? [...shownBodies, ...ghostExtra] : shownBodies), [shownBodies, ghostExtra]);
  const sewCandidateShown = !!previewBodies?.length && shownBodies === previewBodies && !cageEd.session;
  const viewportDirect = useMemo(() => sewPreviewDirect(directShown, active?.cmd.id, active?.ctx, sewCandidateShown), [directShown, active?.cmd.id, active?.ctx, sewCandidateShown]);
  viewBodiesRef.current = viewBodies;
  const sketchGhost = useMemo(() => new Set([...(sketch ? shownBodies.map((_, i) => i) : []), ...ghostExtra.map((_, i) => shownBodies.length + i)]), [sketch, shownBodies, ghostExtra]);
  const commandGizmos = useCommandGizmos({ model: { doc, evaluated, bodies, selection, marker, editNode }, command: { active, ctx, setActive, handleDrag, previewFor },
    context: { sketch, rendering, drawing, measure, assemblyDraft: assembly.draft, instanceCount: instanceSel.length, snapStep }, drag: { bodyDrag, setBodyDrag } });
  const { gizmo, handles, cmdBody } = commandGizmos;
  useEffect(() => commandGizmos.settleDrag(), [previewBodies, bodyDrag, active]);
  useEffect(() => commandGizmos.resetDrag(), [active?.cmd.id]);
  sectionBoxRef.current = sectionBox;
  // (Where the camera is: a cut-out's default corner faces it, G20.)
  const cameraEye = (): Vec3 | null => { const c = viewport.current?.getCamera(); if (!c) return null; const cp = Math.cos(c.pitch); return [c.target[0] + c.distance * cp * Math.cos(c.yaw), c.target[1] + c.distance * cp * Math.sin(c.yaw), c.target[2] + c.distance * Math.sin(c.pitch)]; };
  const sectionDrag: FeatureHandle[] = section && !active && !sketch && bodies.length ? sectionHandles(section, sectionBox, dragSection) : [];
  const dragTransforms = useMemo(() => cmdBody !== undefined && bodyDrag ? new Map([[cmdBody, bodyDrag.matrix]]) : null, [cmdBody, bodyDrag]);

  // The selected part instance's gizmo: moves along and turns about world axes through its box's centre
  // (only what its mates leave free). It follows at once on screen; let go, it is placed (mates re-solve)
  // and shown as dragged until it is evaluated where it lands.
  // (Roadmap 10 ②c: a nested occurrence path has no gizmo: its sub-assembly's definition places it.)
  const selectedTopId = singleTop(instanceSel), selectedInst = selectedTopId ? doc.instances?.find(i => i.id === selectedTopId) : undefined;
  const nestedSelected = singleNested(instanceSel);
  // (A nested path lights only the host's bodies from that part; a top-level id, the whole placed part.)
  const viewportInstanceSel = useMemo(() => viewportInstanceSelection(instanceSel, host => instanceBodies.get(host)), [instanceSel, instanceBodies]) as string[];
  const instGizmo: TransformGizmo | null = (() => {
    // (An occurrence of a pattern is placed by its seed: no gizmo of its own.)
    if (!selectedInst || stepsDisp?.hidden.has(selectedInst.id) || selectedInst.pattern || active || sketch || rendering || drawing || measure || assembly.draft || exploded) return null;
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
  // Roadmap 10 ①: each placed part's bodies in the definition's colours (or this occurrence's own), face colours and hidden bodies.
  const instanceLooks = useInstanceLooks(doc, instanceBodies);
  const instancesDrawn = useMemo(() => {
    if (section) return cpuInstanceSection && sectionHatchOn
      ? instancesShown.map(it => ({ ...it, hatch: sectionHatch(it.bodies, sectionPlanes(section), hatchStep) }))
      : instancesShown;
    if (rendering || previewBodies) return instancesShown;
    return instancesShown.map(it => {
      const inst = doc.instances?.find(i => i.id === it.id), t = inst ? threadsOf(flattenAssembly(inst.doc).nodes, { ...fastenerSizesOf(doc), ...fastenerSizesOf(inst.doc) }) : null, out: number[] = [];
      if (t) for (const b of it.bodies) if (!instanceLooks.get(it.id)?.get(b.key)?.hidden) out.push(...threadLines(t, b.mesh));
      return out.length ? { ...it, threads: new Float32Array(out) } : it;
    });
  }, [instancesShown, doc.instances, rendering, section, previewBodies, cpuInstanceSection, sectionHatchOn, hatchStep, instanceLooks]);

  const instancesLooked = useMemo(() => instancesDrawn.map(it => { const looks = instanceLooks.get(it.id); return looks ? { ...it, looks } : it; }), [instancesDrawn, instanceLooks]);
  // (Roadmap 10 ⑥: the parts the shown step has not introduced yet are left out of the view — display only, the document is untouched.)
  const instancesStepped = useMemo(() => stepsDisp?.hidden.size ? instancesLooked.filter(it => !stepsDisp.hidden.has(it.id)) : instancesLooked, [instancesLooked, stepsDisp]);
  const steppedSelection = useMemo(() => { const own = stepsDisp ? [...litSelection(viewportInstanceSel, stepsDisp.hidden)] : viewportInstanceSel; return stepsDisp?.highlight.length ? [...new Set([...own, ...stepsDisp.highlight])] : own; }, [viewportInstanceSel, stepsDisp]);

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

  const routeGizmo = routeEditor.makeGizmo();
  const routeGuideUnderlays = useMemo(() => routeEditor.makeGuides(D, underlaysShown), [routePanelOpen, routeVisualDoc, routeViewDoc, routePhase, routeMove, doc, D, underlaysShown, busy, fresh, marker, active, sketch, rendering, drawing, measure, assembly.draft, cageEd.session, skel.session, ghost]);
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
  // (Roadmap 21: the bar stays while a command runs or a sketch is open, dimmed and taking no clicks, instead of vanishing.)
  const historyShown = !rendering, historyBusy = !!sketch || !!active;
  const { hidden: historyHidden, natural: historyNaturalNow } = useFitChips(historyBar, historyRows, [doc.nodes, markerAt, !!sketch, !!active, rendering, historyLabels, bottomRow.stacked, bottomRow.cramped]);
  useEffect(() => setHistoryNatural(historyNaturalNow), [historyNaturalNow]);
  const selBodies = selectedBodies(selection).map(i => bodies[i]).filter(Boolean);

  const { clearanceReason, clearanceDisplay, clearanceLabels } = useClearancePreview({
    model: { doc, bodies, marker, fresh, instanceBodies, instanceSources }, editing: { rendering, drawing, sketch, active, previewBodies, ghost, assembly, cageEd, skel },
    display: { viewAnalysis, scalarMaps, mouldShown, directShown, section, instancePreview },
    pose: { instancePoseMap, instDrag, dragTransforms, animatedOffsets, shownBodies, instancesPlaced }, settings: { clearanceEnabled, clearanceNear, isolatedInstances } });
  const { printOptions, printReason, printState, printDisplay, camReason, camState, camDisplay, patchCam } = useManufacturingPreviews({
    model: { doc, bodies, fresh, refShown }, editing: { rendering, drawing, sketch, active, previewBodies, ghost, assembly, cageEd, skel, bodyDrag },
    display: { viewAnalysis, scalarMaps, mouldShown, directShown, section }, print: { printEnabled, printing }, cam: { camEnabled, camOptions, setCamOptions } });
  const { pmiReason, pmiSheet, pmiItems, pickAnnotation } = usePmiPreview({ model: { doc, evaluated, bodies, engine, fileName },
    editing: { rendering, drawing, sketch, active, cageEd, skel }, settings: { printEnabled, camEnabled, pmiEnabled, pmiSelected, setPmiSelected },
    selection: { setInstanceSel, setDirectSel, setSelection } });
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
  const isolationSelection = snapshotInstanceIsolation(hostsOf(instanceSel), instancesPlaced);
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
  const referenceDecisions = !sketch && !active && !rendering && (refMarks.length > 0 || refProblems.length > 0)
    ? <ReferenceDecisions doc={doc} referenceLabels={referenceLabels} refMarks={refMarks} refProblems={refProblems} refChoices={refChoices}
      previewReference={previewReference} settleRef={settleRef} showRefChoices={showRefChoices} /> : null;
  const browserPanel = (
      <Profiler id="outliner" onRender={onBlockRender}><aside className={'card outliner' + (browserOpen ? '' : ' closed')} aria-label="Browser">
        <div className="card-title">BROWSER <span className="muted" aria-busy={!fresh}>Base part · {fresh ? `${bodies.length} bod${bodies.length === 1 ? 'y' : 'ies'}` : busy ? 'evaluating…' : 'not up to date'}</span>
          <ToolIconButton size="tiny" aria-label={browserOpen ? 'Collapse the browser' : 'Expand the browser'} onClick={() => setBrowserOpen(o => { try { localStorage.setItem('cad-studio.browser', o ? 'closed' : 'open'); } catch { /* private mode */ } return !o; })}><Icon name={browserOpen ? 'left_panel_close' : 'left_panel_open'} small /></ToolIconButton></div>
        {browserOpen && <>
        <BodyBrowserRows model={{ doc, evaluated, namesDoc, bodies, fresh, busy }} selection={selection}
          rows={{ expanded, setExpanded, renaming, setRenaming, editNode, setEditNode, setRowHover }} changes={{ commit, setSelection, setDirectSel, setInstanceSel }} meshBadges={meshBadges} />
        {freeSketches.length > 0 && <div className="ol-head">Sketches</div>}
        {freeSketches.map(k => <div key={'s' + k} className={'ol-row' + (selection.sketches?.includes(k) ? ' sel' : '')}>
          <span className="ol-eye"><Icon name="cad-sketch" small /></span>
          <button className={'ol' + (selection.sketches?.includes(k) ? ' sel' : '')} onClick={e => pickProfile(k, e.shiftKey)}>Sketch {k + 1}</button></div>)}
        {!!doc.instances?.length && <div className="ol-head">Parts placed <span className="muted">{doc.instances.length}</span></div>}
        <OutlinerInstances instances={doc.instances ?? NO_INSTANCES} selection={instanceSel} edit={instanceEdit} locked={!!active || !!sketch || rendering || drawing}
          onPick={pickInstanceRow} onEdit={editInstanceRow} iconFor={iconFor} />
        {!!doc.assemblyCuts?.length && <div className="ol-head">Cuts <span className="muted">{doc.assemblyCuts.length}</span></div>}
        <OutlinerCuts cuts={doc.assemblyCuts ?? NO_CUTS} instances={doc.instances ?? NO_INSTANCES} editing={cutDraft?.editing ?? null} locked={!!active || !!sketch || rendering || drawing} onEdit={openCut} onDelete={deleteCut} />
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
        <RequirementsBrowser doc={doc} evaluated={evaluated} bodies={bodies} spec={spec} specRunning={specRunning} failingOnly={failingOnly}
          setFailingOnly={setFailingOnly} setSelection={setSelection} setRequirement={setRequirement} />
        <DesignHistory doc={doc} historyOpen={historyOpen} setHistoryOpen={setHistoryOpen} saveShared={saveShared} />
        {referenceDecisions}
        {!bodies.length && !doc.instances?.length && !busy && <div className="empty">No bodies yet.</div>}
        </>}
      </aside></Profiler>
  );
  const inspector = (
      <Profiler id="right-col" onRender={onBlockRender}><div className="right-col">

      {sketch && <SketchPanel sketch={sketch} toolLabel={TOOLS.find(t => t.tool === sketch.tool)!.label} error={sketchError} onShape={updateShape} onPlace={sketch.editNode === undefined ? placeSketch : undefined} onUi={patch => setSketch(s => s && { ...s, ...patch })} onOffset={offsetSketch} onLinkedInset={sketch.anchor?.kind === 'face' && sketch.anchor.face?.linkSource && !sketch.anchor.offset && !sketch.anchor.angle ? linkSketchInset : undefined} onToCurves={sketchToCurves} onBand={{ make: makeSketchBand, edit: patch => setSketch(s => s && bandEdit(s, patch)), remove: () => setSketch(s => s && bandRemove(s)) }} onUseOutline={sketch.anchor?.kind === 'face' && sketch.anchor.face?.outline?.length && !sketch.anchor.offset && !sketch.anchor.angle
        ? (asRefs: boolean) => setSketch(s => s && { ...detachSketchLink(s), shape: null, done: [...(s.done ?? []), ...(s.shape ? [s.shape] : []), ...(s.anchor?.face?.outline ?? []).map(x => asRefs ? { ...x, construction: true as const } : x)] }) : undefined} />}
      {bomOpen && !libraryOpen && !paramsOpen && !rendering && !drawing && !sketch && !active && <BomPanel doc={doc} name={fileName} evaluate={d => engine.part(d, revision.current++, 'read')} onCommit={next => commit(next, false)} onClose={() => setBomOpen(false)} onError={(title, hint) => setToast({ title, hint, detail: '' })} />}
      {rebuildOpen && !bomOpen && !libraryOpen && !paramsOpen && !rendering && !drawing && !sketch && !active && <RebuildPanel store={rebuildStore} problems={assembly.problems} mode={effectiveDisplayMode} viewport={viewport} onClose={() => setRebuildOpen(false)} />}
      {versionsOpen && !variantsOpen && !bomOpen && !libraryOpen && !paramsOpen && !rendering && !drawing && !sketch && !active && <VersionsPanel project={project} doc={doc} fileName={fileName} comparing={compareBase?.id ?? null} onCompare={setCompareBase}
        onInsert={path => void project.fileOf(path).then(f => { if (f) void insertPart(f, linkSource(path)); })}
        onOpen={d => { setCompareBase(null); replaceDoc(d, true); setDirty(true); setTimeout(() => viewport.current?.fit(), 300); }} />}
      {stepsShown && <AssemblyStepsPanel doc={doc} index={stepAt} offer={stepsOffer} faded={stepsFaded} problems={stepsProblems}
        onGo={k => setStepIndex(stepAfter(k, 0, stepCount))} onFaded={setStepsFaded} onNew={newStep}
        onRename={(id, name) => stepChange({ id, name })} onNote={(id, note) => stepChange({ id, note: note.trim() ? note : null })} onExplode={(id, explode) => stepChange({ id, explode: explode || null })}
        onAddSelected={id => { const add = stepParts(), step = stepsOf(doc).find(s => s.id === id); if (!step) return; if (!add.length) { setToast({ title: 'Step not changed', hint: 'Select the parts to add first, in the Browser or the view.', detail: '' }); return; } stepChange({ id, add: [...step.add, ...add.filter(a => !step.add.includes(a))] }); }}
        onTakeOut={(id, part) => { const step = stepsOf(doc).find(s => s.id === id); if (step) stepChange({ id, add: step.add.filter(a => a !== part) }); }}
        onCaptureView={id => { const c = viewport.current?.getCamera(); if (c) stepChange({ id, view: viewOfCamera(c) }); }} onResetView={applyStepView}
        onMove={(id, to) => stepEdit(() => moveAssemblyStep(doc, id, to), () => setStepIndex(to))} onDelete={id => stepEdit(() => deleteAssemblyStep(doc, id), () => setStepIndex(k => Math.max(0, Math.min(k, stepCount - 2))))} onClose={() => setStepsOpen(false)} />}
      {variantsOpen && !bomOpen && !libraryOpen && !paramsOpen && !rendering && !drawing && !sketch && !active && <VariantsPanel doc={doc} variants={variants} onCommit={next => commit(next, false)} onError={hint => setToast({ title: 'Variants: refused', hint, detail: '' })} onClose={() => setVariantsOpen(false)} />}
      {libraryOpen && !paramsOpen && !rendering && !drawing && !sketch && !active && <LibraryPanel doc={doc} onCommit={next => commit(next)} onClose={() => setLibraryOpen(false)} onError={(title, hint) => setToast({ title, hint, detail: '' })} onQuote={() => { void exportQuote(); }} />}
      {paramsOpen && !rendering && !drawing && !sketch && !active && <ParametersPanel doc={doc} onClose={() => setParamsOpen(false)}
        onChange={p => {
          const ownCandidate = workOwnership.current.run?.candidate && parameterEdit?.base === doc && parameterEdit.baseInput === evaluated && docNow.current === doc && acceptanceScope === workOwnership.current.scope;
          if (!ownCandidate && !canChangeDocument()) return;
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
      {rendering && !sketch && <Suspense fallback={null}><RenderPanel render={render} lookDisabled={renderKeysOf(instanceSel).mode === 'disabled' && !selectedBodies(selection).length} note={renderKeysOf(instanceSel).nested ? 'A part inside a sub-assembly is styled through its sub-assembly: select the sub-assembly.' : undefined} onError={m => setToast({ title: 'Could not use that image', hint: m, detail: '' })} available={viewport.current?.backend === 'webgpu'}
        selectedKeys={[...selectedBodies(selection).map(i => bodies[i]?.key).filter((k): k is string => !!k), ...renderKeysOf(instanceSel).keys]}
        onChange={commitRender} onExport={exportImage} fov={fov} onPickFocus={done => viewport.current?.pickRenderFocus(done)}
        onCreatePathTrace={() => viewport.current?.createRenderPathTrace() ?? Promise.reject(new Error('The viewport is not ready.'))} imageName={`${fileName}.png`}
        onFov={deg => { const c = viewport.current?.getCamera(); if (c) { viewport.current?.setCamera({ ...c, fovY: deg * Math.PI / 180 }); setFov(deg); } }}
        onSaveCamera={() => { const c = viewport.current?.getCamera(); if (c) commitRender({ ...render, camera: c }); }}
        onUseCamera={() => { if (render.camera) { viewport.current?.setCamera(render.camera); setFov(Math.round(render.camera.fovY * 180 / Math.PI)); } }} /></Suspense>}
      {!rendering && !sketch && measure && <MeasurementInspector bodies={bodies} measure={measure} measured={measured} setMeasure={setMeasure} />}
      {cutDraft && !rendering && !sketch && !measure && <AssemblyCutHud draft={cutDraft} instances={doc.instances ?? NO_INSTANCES} problem={draftProblem(doc, cutDraft) ?? (cutTrial?.key === cutKey ? cutTrial.problem : undefined)}
        onChange={patch => setCutDraft(d => d && { ...d, ...patch })} onAddSelected={() => setCutDraft(d => d && { ...d, targets: withAddedTargets(d.targets, cuttableOf(doc, instanceSel)) })}
        onApply={applyCut} onCancel={() => setCutDraft(null)} />}
      {!rendering && !sketch && !measure && !!nestedSelected && (() => {
        const card = nestedCard(doc, nestedSelected, instanceBodies.get(hostsOf(instanceSel)[0]));
        return card ? <NestedPartPanel card={card} /> : null;
      })()}
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
          onDuplicate={() => { const newId = nextInstanceId(doc, 'inst');
            // (A copy of an occurrence is a free part: not the pattern's, not fixed by it.)
            const copy: PartInstance = inst.pattern ? { ...inst, pattern: undefined, grounded: undefined } : inst;
            commitInstances([...list, { ...copy, id: newId, name: `${inst.name} copy`, position: [inst.position[0] + 20, inst.position[1] + 20, inst.position[2]] }], [newId]); }}
          onGround={on => { const why = assembly.ground(inst.id, on); if (why) setToast({ title: 'Can’t fix this part in place', hint: why, detail: '' }); }}
          shared={inst.part ? sharing(doc, inst.part.id).length : 0} pending={inst.part ? doc.pendingParts?.[inst.part.id] : undefined}
          onEditPart={() => startInPlace(inst.id)} onIndependent={() => commitParts(makeIndependent(doc, inst.id))}
          pattern={<InstancePatternControls inst={inst} pattern={doc.instancePatterns?.find(p => p.seed === inst.id)} occurrenceOf={inst.pattern ? doc.instancePatterns?.find(p => p.id === inst.pattern!.id) : undefined}
            onAdd={o => patternEdit(() => addInstancePattern(doc, o))} onEdit={o => patternEdit(() => editInstancePattern(doc, o))}
            onDelete={id => patternEdit(() => deleteInstancePattern(doc, id))} onSkip={() => { patternEdit(() => skipOccurrence(doc, inst.id)); setInstanceSel([]); }} />}
          looks={<InstanceLooksControls rows={instanceLookRows(inst, instanceBodies.get(inst.id), doc)} readOnly={!!inst.pattern}
            held={[...heldLooks(doc).filter(h => h.part === inst.id), ...(inst.part ? heldByRevision(doc, inst.part.id).filter(h => h.part === inst.id) : [])].map(h => h.problem)}
            onSet={(key, patch) => patternEdit(() => setInstanceLook(doc, { part: inst.id, body: key, patch }), 'Look not changed')}
            onReset={(key, field) => patternEdit(() => resetInstanceLook(doc, { part: inst.id, body: key, field }), 'Look not changed')} />}
          joints={inst.doc.instances?.length ? <InstanceJointsControls inst={inst}
            onSet={values => patternEdit(() => setInstanceJoints(doc, { part: inst.id, joints: values }), 'Joints not changed')}
            onReset={() => patternEdit(() => setInstanceJoints(doc, { part: inst.id, joints: {}, replace: true }), 'Joints not changed')} /> : undefined}
          onRevision={async file => {
            const read = await readStudioFile(new Uint8Array(await file.arrayBuffer()));
            if ('error' in read) { setToast({ title: 'Could not read that part', hint: read.error, detail: '' }); return; }
            const r = offerRevision(doc, inst.part!.id, read.doc, file.name);
            if ('error' in r) setToast({ title: 'Nothing to update', hint: r.error, detail: '' }); else {
              commitParts(r.doc);
              // (Roadmap 10 ①: the occurrences' own looks stay; those whose body the revision lacks are named now, held when it is accepted.)
              if (r.held.length) setToast({ title: `${r.held.length} look${r.held.length > 1 ? 's' : ''} would be held`, hint: r.held.map(h => h.problem).join(' '), detail: '' });
            }
          }}
          onAccept={() => { let next: StudioDoc; try { next = acceptRevision(doc, inst.part!.id); } catch (e) { setToast({ title: 'Revision not accepted', hint: e instanceof Error ? e.message : String(e), detail: '' }); return; } const held = heldLooks(next); commitParts(next);
            if (held.length) setToast({ title: `${held.length} look${held.length > 1 ? 's' : ''} held`, hint: held.map(h => h.problem).join(' '), detail: '' }); }} onDismiss={() => commitParts(dismissRevision(doc, inst.part!.id))}
          onRemove={() => {
            const held = patternDeleteRefusal(doc, inst.id); if (held) { setToast({ title: 'Can’t remove this part', hint: held.message, detail: '' }); return; }
            if (!commitAssembly(list.filter(i => i.id !== inst.id), assembly.without(inst.id))) return; setInstanceSel([]); }} />;
      })()}
      {!rendering && !sketch && !measure && jointTree && !assembly.draft && !instanceSel.length && <RobotInspector controller={robotExports} motion={joints} loopMotionContext={loopMotionContext} chosenMotion={chosenMotion}
        video={{ busy: videoBusy, record: recordVideo }} changes={{ canChangeDocument, pushUndo, setDoc, setDirty }} />}
      {!rendering && !drawing && !sketch && !measure && !instanceSel.length && <GravityExperimentPanel doc={doc} joints={jointTree?.joints ?? []} />}
      {!rendering && !sketch && !measure && !!doc.instances?.length && (assembly.draft || !!singleTop(instanceSel)) && <MatePanel assembly={assembly} instances={doc.instances} instance={singleTop(instanceSel)}
        onRefused={why => setToast({ title: 'The mate was refused', hint: why, detail: '' })} />}
      {!rendering && !active && !sketch && !measure && !instanceSel.length && directSel.length > 0 && doc.direct && <DirectInspector doc={doc} directSel={directSel}
        changes={{ commitDirect }} onThicken={(id, t, side) => {
          if (directSel.length === 1 && directSel[0] === id) start(commands.find(c => c.id === 'thicken')!, { t, side });
        }} onSew={(ids, tol) => {
          if (ids.length === directSel.length && ids.every((id, i) => id === directSel[i])) start(commands.find(c => c.id === 'sew')!, { tol });
        }} onNotice={setToast} />}
      {clashes && !rendering && !sketch && <InterferenceInspector doc={doc} bodies={bodies} clashes={clashes} setClashes={setClashes} setSelection={setSelection} />}
      {/* (A running command's HUD takes this place at the right.) */}
      {cageEd.session && doc.nodes[cageEd.session.node] && !rendering && !drawing && <CagePanel editor={cageEd} name={featureLabel(doc.nodes[cageEd.session.node], cageEd.session.node, doc.nodes)} />}
      {skel.session && !rendering && !drawing && <SkeletonPanel editor={skel} name={skel.session.node === null ? 'new skeleton' : featureLabel(doc.nodes[skel.session.node], skel.session.node, doc.nodes)} />}
      {!cageEd.session && !skel.session && !rendering && !sketch && !measure && !active && !directSel.length && !instanceSel.length && !assembly.draft && <SelectionInspector model={{ doc, evaluated, bodies, fresh, busy, massReady }} selection={selection} materialSettings={{ material, setMaterial }}
        display={{ showBox, setShowBox, inertiaAt, setInertiaAt }} changes={{ commit, setSelection, edgesToCurves, loadBendTable, setFlatView, setCutListView, separate }}>
        {editNode !== null && <NodeEditor nodes={doc.nodes} parameters={doc.parameters} doc={doc} pending={parameterEdit?.kind === 'direct'} pendingLabel={doc.nodes[editNode]?.kind === 'fill-feature-pattern' ? 'Checking the fill cut pattern…' : 'Checking the path cut pattern…'} bearingAssembly={{ root: doc, owner: 'base' }} onRefuse={m => setToast({ title: 'Cannot bind that value', hint: m, detail: '' })} index={editNode} onEditSketch={(() => { const n = doc.nodes[editNode]; const s = n?.kind === 'sketch' ? editNode : n && 'sketch' in n ? n.sketch : null; return s !== null && doc.nodes[s]?.kind === 'sketch' ? () => editSketch(s) : undefined; })()} onApply={nodes => {
          if (!canChangeDocument()) return;
          const scope = bearingEditScope.current;
          const next = { ...doc, nodes: dropStaleMade(doc.nodes, nodes) };
          const candidate = preparePatternNodeCandidate(doc, next, editNode);
          if (candidate) { stageCurveCandidate(candidate); return; }
          engine.evaluate(next, revision.current++).then(r => { if (!r || bearingEditScope.current !== scope) return; if (r.ok) commit(next); else setToast({ ...r.error, hint: 'The design was not changed. Adjust the values and try again.' }); });
        }} onDelete={() => deleteNode(editNode)} onClose={() => { discardDirectCandidateRef.current(); setEditNode(null); }} />}
      </SelectionInspector>}
      </div></Profiler>
  );
  // (R1d: the HUD subscribes to the command; the values it types are noted, so the App does not render for them.)
  const hud = active && <Hud store={activeStore} onChange={(key, value) => { lastTyped.current = Date.now(); handleDrag.current = null;
    setActive(a => { if (!a) return a; const values = patchValues(a.cmd, a.ctx, a.values, { [key]: value }); hudValues.current = values; return { ...a, values, preview: a.upload === 'error' ? 'error' : 'busy' }; }); }} onFile={uploadFont} onApply={apply} onCancel={cancel} />;
  return (
    <div className={'studio' + (historyShown ? ' has-history' : '') + (bottomRow.stacked ? ' history-stacked' : '') + (bottomRow.cramped ? ' stage-cramped' : '')} style={{ '--history-left': (browserPlacement === 'dock' ? HISTORY_LEFT_RAIL : HISTORY_LEFT) + 'px', '--strip-w': chatColumnShown ? '0px' : CHAT_STRIP + 'px', '--dock-strip-w': dockEdge + 'px', '--chat-col-w': (chatColumnShown ? layout.chatShown : CHAT_STRIP) + 'px', '--rail-w': (sketch || rendering || drawing ? 44 : rail.width) + 'px' } as CSSProperties}>
      {/* (G12b: the top bar across the centre and the dock — the window less the chat column — the dock under it.) */}
      <Profiler id="topbar" onRender={onBlockRender}><header className="topbar">
        <span className="brand"><Icon name="deployed_code" className="accent" />barocss</span>
        <label className="doc-tab"><span className="sr">File name</span>
          <input value={fileName} onChange={e => setFileName(e.target.value)} size={Math.max(8, fileName.length)} />
          {dirty && <span className="dot" aria-label="Unsaved changes" />}</label>
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
          <ToolIconButton key="tool3" aria-label="New part" data-tip="New part" onClick={() => { if (sessionBlocked('starting a new part')) return; replaceDoc(emptyDoc()); setFileName('Untitled'); }}><Icon name="add_box" /></ToolIconButton>,
          <TemplatePicker key="tool4" doc={doc} state={{ templatesOpen, setTemplatesOpen, templateName, setTemplateName }} open={open} onNotice={setToast}
            onTemplate={next => { if (sessionBlocked('starting from a template')) return; replaceDoc(next); setFileName('Untitled'); }} fitLater={() => setTimeout(() => viewport.current?.fit(), 300)} />,
          <ToolIconButton key="tool5" state={libraryOpen ? 'on' : 'idle'} aria-label="Library" data-tip="Library" data-tip-desc="Catalogue parts from libraries (built-in, team, yours): insert them, snap them by their interfaces" onClick={() => setLibraryOpen(v => !v)} hidden={rendering || drawing}><Icon name="menu_book" /></ToolIconButton>,
          <ToolIconButton key="tool6" state={paramsOpen ? 'on' : 'idle'} aria-label="Parameters" data-tip="Parameters" data-tip-desc="Named sizes the part depends on, and saved sets of them (configurations)" onClick={() => setParamsOpen(v => !v)} hidden={rendering || drawing}><Icon name="function" /></ToolIconButton>,
          <ToolIconButton key="tool7" aria-label="Open" data-tip="Open" data-tip-desc="A .bcad model or a STEP file; an IGES file’s or a .barocad source’s curves and surfaces" onClick={() => fileInput.current?.click()}><Icon name="folder_open" /></ToolIconButton>,
          <ToolIconButton key="tool8" aria-label="Save" data-tip="Save" data-tip-key="⌘S" data-tip-desc={project.view.store ? `Into ${project.view.store.name}` : undefined} onClick={save}><Icon name="save" /></ToolIconButton>,
          <ToolIconButton key="tool8b" state={versionsOpen ? 'on' : 'idle'} aria-label="Project and versions" data-tip="Project & versions" data-tip-desc="Open a folder (or keep a project in this browser) to save into it, keep versions, branch and compare" onClick={() => { if (!sessionBlocked('opening the project')) setVersionsOpen(v => !v); }} hidden={rendering || drawing}><Icon name="history" /></ToolIconButton>,
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
        direct={viewportDirect} directSelection={directSel} poles={poleMode ? poles : undefined} cloud={benchCloud ?? workspaceCloud} underlays={viewportUnderlays} pickedPole={poleHere?.key ?? null} onPickPole={key => poleObj && setPole(pole?.id === poleObj && pole.key === key ? null : { id: poleObj, key })} offsets={animatedOffsets} transforms={dragTransforms} instances={instancesStepped} clearance={clearanceDisplay} isolatedInstances={displayScopeReason ? undefined : stepsDisp?.opaque ?? isolatedInstances} clip={sectionClip} sectionHatch={sectionHatchLines} scalarMaps={scalarMaps} onHoverScalar={scalarMaps ? setMapHover : undefined} mould={mouldShown} isoclines={isoclines} proposal={ghost ? proposalOverlay : compareOverlay} instanceSelection={assembly.draft ? assembly.highlight.instances : steppedSelection} instanceFaces={mateFaces ? assembly.highlight.instanceFaces : undefined}
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
        onSketchBandPick={index => setSketch(s => s && index !== null ? toggleBandPick(s, index) : s)}
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
        <ModelTools columns={rail.columns} sketch={sketch} setSketch={setSketch} command={{ placeStates, groupStates, activeId: active?.cmd.id ?? null, startTool, toolDragStart, toolDragEnd }}
          panels={{ bomOpen, setBomOpen, rebuildOpen, setRebuildOpen, variantsOpen, setVariantsOpen }} />
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
      <Profiler id="history" onRender={onBlockRender}>{historyShown && <FeatureHistoryBar busy={historyBusy} doc={doc} selection={selection} editNode={editNode} marker={marker} source={{ innerSteps, freeSketches }}
        layout={{ historyBar, historyRows, setHistoryRows, historyLabels, setHistoryLabels, historyHidden }} actions={{ pickProfile, setEditNode, setMarker, setHistoryMenu, openHistoryFeature }} />}</Profiler>

      {inPlace && <div className="card in-place-bar" role="status" aria-label="Editing a part in place">
        <span>Editing <b>{inPlace.name}</b>{inPlace.shared > 1 ? ` · shared by ${inPlace.shared}` : ''}</span>
        {askDiscard ? <>
          <span className="muted">Discard your changes?</span>
          <Button size="sm" variant="default" onClick={cancelInPlaceSession}>Discard</Button>
          <Button size="sm" variant="ghost" onClick={() => setAskDiscard(false)}>Keep editing</Button>
        </> : <>
          <Button size="sm" variant="default" onClick={finishInPlaceSession}>Finish</Button>
          <Button size="sm" variant="ghost" onClick={cancelInPlaceSession}>Cancel</Button>
        </>}
        <details className="in-place-details"><summary>Details</summary>
          <div className="muted small">The other parts are shown see-through where they are relative to this one. Finish updates {inPlace.shared > 1 ? `all ${inPlace.shared} instances` : 'the part'} in one step (Undo restores the assembly). Saving and opening are off until then.</div></details>
      </div>}
      {stage !== null ? <div className="card work-bar" role="status" aria-label="Working"><span className="mono">Working… {stage}</span>
        <button className="ghost small" aria-label="Cancel the computation" title="Stop it: nothing changes" onClick={stopStage}>Cancel</button></div>
      : busy && slow && <div className="card work-bar" role="status" aria-label="Working"><span className="mono">Working…</span>
        <button className="ghost small" aria-label="Cancel the computation" title="Stop this computation and take the change back" onClick={cancelWork}>Cancel</button></div>}
      <div className="corner-left">
        <span className="mono muted">{busy ? (slow ? 'Working…' : 'Computing…') : `${ortho ? 'Orthographic' : 'Perspective'} · ${shownBodies.length} solid${shownBodies.length === 1 ? '' : 's'} · ${Math.round(lastMs)} ms`}<CursorReadout sink={cursorSink} /></span>
      </div>

      <ViewDisplayControls model={{ doc, bodies, instancesPlaced }} viewport={viewport} cornerRight={cornerRight}
        display={{ displayOpen, setDisplayOpen, displayMode, setDisplayMode, effectiveDisplayMode, displayScopeReason, displayModeReason, displayModeNotice,
          clearDisplayModeFailure: () => setDisplayModeFailure(null), isolatedInstances, setIsolatedInstances, isolationReason, isolationSelection }}
        view={{ ortho, setOrtho, ao, setAo, theme, setTheme, rendering, printing: !!printing, viewBackend }}
        section={{ section, setSection, sectionHatchOn, setSectionHatchOn, sectionBox, sectionFacePick, setSectionFacePick, sketchSection, cameraEye }}
        analysis={{ analysis, setAnalysis, mapKind, setMapKind, mapLegend, mapHover, setMapHover, mouldResult, mouldSpread, setMouldSpread }}
        picking={{ pickFilter, setPickFilter, snapStep, setSnapStep, setSelection }} explodeStore={explodeStore} />

      {palette && <Palette ctx={ctx} onRun={start} onClose={() => setPalette(false)} extra={PALETTE_EXTRA} />}
      {help && <ShortcutHelp onClose={() => setHelp(false)} />}
      <FeatureHistoryMenu doc={doc} ctx={ctx} marker={marker} historyMenu={historyMenu} close={() => setHistoryMenu(null)}
        editors={{ setEditNode, setInstanceSel, setDirectSel, editSketch, exportSketchDxf, cancel, beginSkeleton: skel.begin, setSelection }} history={{ toggleSuppress, reorder, setMarker, deleteNode }} />
      <ViewContextMenu model={{ doc, bodies, ctx }} menu={menu} setMenu={setMenu} viewport={viewport} changes={{ commit, start, deleteSelection, setSelection, setMeasure, setEditNode }} />

      {cutListView && (() => { const list = partCutList(doc, bodies, material); return list ? <CutListDialog list={list} nesting={nestCutList(doc, list)} name={fileName.replace(/[^\w.-]+/g, '_')} onClose={() => setCutListView(false)} /> : null; })()}
      {flatView && (() => { const fb = bodies.find(x => x.key === flatView); return fb?.flat ? <FlatPatternDialog flat={fb.flat} name={`${fileName}-${bodyName(doc, fb)}`.replace(/[^\w.-]+/g, '_')} onClose={() => setFlatView(null)} /> : null; })()}
      {!workerFailure && <MeshFileDialogs controller={meshImport}><ModelExportDialogs controller={modelExports} /></MeshFileDialogs>}
      {/* (Notices stack in one column: an Open failure still shows while a recovery copy waits for its answer.) */}
      <div className="toast-stack">
      {recovery && <div className="toast card recovery" role="dialog" aria-label="Recover unsaved work">
        <Icon name="history" className="accent" />
        <div><div className="toast-title">Unsaved work from {new Date(recovery.savedAt).toLocaleString()}</div>
          <div className="toast-hint">“{recovery.fileName}” was not saved. Restore it, or discard the copy.</div>
          <div className="row-actions">
            <button className="primary" onClick={async () => {
              if (sessionBlocked('restoring unsaved work')) return;
              const missing = await loadRecoveryBlobs(recovery.doc);
              if (missing.length) { setToast({ title: 'Could not restore', hint: `The copy's mesh data is gone from this browser (${missing.length} array${missing.length > 1 ? 's' : ''}). Open the mesh file again.`, detail: '' }); clearRecovery(); setRecovery(null); return; }
              // (A whole document replaced, as New and Open do: a running command, its preview and the picks of the
              // document shown before do not carry into the restored one. The project link is kept, as before.)
              replaceDoc(recovery.doc, true); setFileName(recovery.fileName); settleRecovery(); setRecovery(null); setTimeout(() => viewport.current?.fit(), 300);
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
      {toast && (workerFailure || (!cascade && !meshAsk && !repairAsk && !stepAsk && !stlAsk)) && <div className="toast card" role="alert">
        <Icon name="info" className="accent" />
        <div><div className="toast-title">{toast.title}</div><div className="toast-hint">{toast.hint}</div>
          {toast.detail && <details><summary>Details</summary><code>{toast.detail}</code></details>}
          {toast.action && <div className="row-actions"><button className="ghost" onClick={toast.action.run}>{toast.action.label}</button></div>}</div>
        {!workerFailure && <ToolIconButton aria-label="Dismiss" onClick={() => setToast(null)}><Icon name="close" small /></ToolIconButton>}
      </div>}
      </div>
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
        proposals={<ProposalBrowser controller={proposals} doc={doc} bodies={bodies} fresh={fresh} massReady={massReady} decidedShown={decidedShown} setDecidedShown={setDecidedShown} />}
        content={rendering || drawing ? null : <Suspense fallback={null}><ChatPanel versions={inPlace ? undefined : project.chat} scope={inPlace} onRunning={setChatRunning} onRowFiles={files => { if (files === chatRowFiles.current || (files && !isPersonRowFiles(files))) return; revokePersonRowFiles(chatRowFiles.current); chatRowFiles.current = files; }} base={() => prefixDoc(doc, marker ?? doc.nodes.length)} evaluate={d => engine.part(d, revision.current++, 'agent').then(r => r.ok ? r.bodies : null)} check={partEval}
        blocked={sketch ? 'Finish or leave the sketch to chat.' : active ? `Apply or cancel ${active.cmd.label} to chat.` : null}
        onPreview={setPreviewBodies} onCommit={(next, sel, merged) => {
          // (Merged onto the edits made while it ran, O133: what applied, and what waits as a proposal and why.)
          if (merged) {
            if (!commit(next, true, true)) return;
            chatSelection.current = sel ?? null;
            const n = merged.applied.length + merged.deferred.length, why = merged.deferred[0]?.reason;
            setToast({ title: 'Chat turn merged with your edits', hint: `${merged.applied.length} of ${n} change${n > 1 ? 's' : ''} applied${merged.proposal ? `; ${merged.deferred.length} wait${merged.deferred.length > 1 ? '' : 's'} as ${merged.proposal}${why ? ` (${why})` : ''}` : ''}.`, detail: '', action: { label: 'Undo', run: () => { undoNow.current(); setToast(null); } } });
            return;
          }
          // (Applied directly by the agent — at L2 only value edits — said so with an undo, D41.)
          const direct = JSON.stringify(next.nodes) !== JSON.stringify(doc.nodes) || JSON.stringify(next.parameters) !== JSON.stringify(doc.parameters), what = direct ? describeChange(doc, next) : '';
          if (!commit(next)) return;
          chatSelection.current = sel ?? null;
          if (direct) setToast({ title: 'Applied by the agent', hint: `${what[0]?.toUpperCase() ?? ''}${what.slice(1)}.`, detail: '', action: { label: 'Undo', run: () => { undoNow.current(); setToast(null); } } });
        }}
        onSelect={sel => setSelection(resolveNames(bodies, sel).selection)} onClose={() => setChat(false)} context={chatContext} outbox={chatOutbox} onOutboxSent={id => setChatOutbox(o => (o?.id === id ? null : o))}
        proposals={doc.proposals} proposalStale={p => p.status === 'open' && p.base !== hashNow} proposalBusy={proposalBusy} onAcceptProposal={p => void acceptIt(p)} onRejectProposal={rejectIt} /></Suspense>} />
    </div>
  );
}
