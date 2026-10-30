import { useCallback, useEffect, useMemo, type Dispatch, type SetStateAction } from 'react';
import { prefixDoc, type StudioDoc } from '@barocss/cad-model/engine/doc';
import type { BodyResult } from '@barocss/cad-model/engine/evaluate';
import type { Vec3 } from '@barocss/cad-model/engine/mesh';
import type { Selection } from '@barocss/cad-model/app/commands';
import { bodyName, lookOf } from '@barocss/cad-model/app/bodies';
import { previewMatrix } from '@barocss/cad-model/assembly/drag';
import { defaultDrawing } from '@barocss/cad-model/drawing/types';
import { checkDocumentPrintPreview } from '@barocss/cad-model/engine/printPreview';
import { firstProblem } from '@barocss/cad-model/engine/refusal';
import type { processProfile } from '@barocss/cad-model/library/materials';
import { multiply } from '@barocss/gpu/viewer';
import type { EngineClient } from '../engine/client';
import type { useScenePoses } from '../state/useScenePoses';
import type { useAssembly } from '../assembly/useAssembly';
import type { useCageEditor } from '../subd/useCageEditor';
import type { useSkeletonEditor } from '../skeleton/useSkeletonEditor';
import type { Active } from '../app/commandState';
import type { useProposalPreview } from '../state/useProposalPreview';
import { useDrawingSheet } from '../ui/useDrawingSheet';
import type { SketchState } from './Viewport';
import { instanceEvaluationCurrent, type instanceEvaluationSources } from './instanceEvaluation';
import { poseMatrix } from './instancePose';
import { useClearanceAnalysis } from './useClearanceAnalysis';
import { usePrintLayers, type PrintOptions } from './usePrintLayers';
import { printOptionsOf, printSourceMeshes } from './printSettings';
import { useCamPreview } from './camPreview';
import type { CamOptions } from './camDisplay';
import { pmiSelection } from './pmiGeometry';
import { sectionPlanes, type Section } from './sectionView';
import type { Analysis } from './analysis';
import type { useAnalysisMaps } from './useAnalysisMaps';
import type { directNow } from '@barocss/cad-model/engine/directModule';

interface PreviewEditing {
  rendering: boolean; drawing: boolean; sketch: SketchState | null; active: Active | null; previewBodies: BodyResult[] | null;
  ghost: ReturnType<typeof useProposalPreview>['ghost']; assembly: Pick<ReturnType<typeof useAssembly>, 'draft'>;
  cageEd: Pick<ReturnType<typeof useCageEditor>, 'overlay'>; skel: Pick<ReturnType<typeof useSkeletonEditor>, 'tool'>;
}
interface PreviewDisplay {
  viewAnalysis: Analysis | null; scalarMaps: ReturnType<typeof useAnalysisMaps>['scalarMaps'];
  mouldShown: ReturnType<typeof useAnalysisMaps>['mouldShown']; directShown: ReturnType<NonNullable<ReturnType<typeof directNow>>['directDisplay']>;
}

/** Classify the current displayed assembly pose and prepare its clearance overlay. */
export function useClearancePreview({ model, editing, display, pose, settings }: {
  model: { doc: StudioDoc; bodies: BodyResult[]; marker: number | null; fresh: boolean;
    instanceBodies: Parameters<typeof useScenePoses>[1]; instanceSources: ReturnType<typeof instanceEvaluationSources> };
  editing: PreviewEditing; display: PreviewDisplay & { section: Section | null; instancePreview: { id: string; matrix: Float64Array } | null };
  pose: { instancePoseMap: ReturnType<typeof useScenePoses>['instancePoseMap']; instDrag: Parameters<typeof useScenePoses>[8];
    dragTransforms: Map<number, Float64Array> | null; animatedOffsets: Map<number, Vec3> | undefined; shownBodies: BodyResult[];
    instancesPlaced: ReturnType<typeof useScenePoses>['instancesPlaced'] };
  settings: { clearanceEnabled: boolean; clearanceNear: number; isolatedInstances: readonly string[] | undefined };
}) {
  const { doc, bodies, marker, fresh, instanceBodies, instanceSources } = model;
  const { rendering, drawing, sketch, active, previewBodies, ghost, assembly, cageEd, skel } = editing;
  const { viewAnalysis, scalarMaps, mouldShown, directShown, section, instancePreview } = display;
  const { instancePoseMap, instDrag, dragTransforms, animatedOffsets, shownBodies, instancesPlaced } = pose;
  const { clearanceEnabled, clearanceNear, isolatedInstances } = settings;
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

  return { clearanceReason, clearanceResult, clearanceDisplay, clearanceLabels };
}

/** Root-part print layers and CNC removal share the same solid-view admission boundary. */
export function useManufacturingPreviews({ model, editing, display, print, cam }: {
  model: { doc: StudioDoc; bodies: BodyResult[]; fresh: boolean; refShown: BodyResult[] };
  editing: PreviewEditing & { bodyDrag: { matrix: Float64Array; settling: boolean } | null };
  display: PreviewDisplay & { section: Section | null };
  print: { printEnabled: boolean; printing: NonNullable<ReturnType<typeof processProfile>> | null };
  cam: { camEnabled: boolean; camOptions: CamOptions; setCamOptions: Dispatch<SetStateAction<CamOptions>> };
}) {
  const { doc, bodies, fresh, refShown } = model;
  const { rendering, drawing, sketch, active, previewBodies, ghost, assembly, cageEd, skel, bodyDrag } = editing;
  const { viewAnalysis, scalarMaps, mouldShown, directShown, section } = display;
  const { printEnabled, printing } = print;
  const { camEnabled, camOptions, setCamOptions } = cam;
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
  return { printOptions, printReason, printState, printDisplay, camReason, camState, camDisplay, patchCam };
}

/** Build the drawing annotations for the model and route a picked annotation to model selection. */
export function usePmiPreview({ model, editing, settings, selection }: {
  model: { doc: StudioDoc; evaluated: StudioDoc; bodies: BodyResult[]; engine: EngineClient; fileName: string };
  editing: Pick<PreviewEditing, 'rendering' | 'drawing' | 'sketch' | 'active' | 'cageEd' | 'skel'>;
  settings: { printEnabled: boolean; camEnabled: boolean; pmiEnabled: boolean; pmiSelected: string | null; setPmiSelected: Dispatch<SetStateAction<string | null>> };
  selection: { setInstanceSel: Dispatch<SetStateAction<string[]>>; setDirectSel: Dispatch<SetStateAction<string[]>>; setSelection: Dispatch<SetStateAction<Selection>> };
}) {
  const { doc, evaluated, bodies, engine, fileName } = model;
  const { rendering, drawing, sketch, active, cageEd, skel } = editing;
  const { printEnabled, camEnabled, pmiEnabled, pmiSelected, setPmiSelected } = settings;
  const { setInstanceSel, setDirectSel, setSelection } = selection;
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
  return { pmiReason, pmiSheet, pmiItems, pickAnnotation };
}
