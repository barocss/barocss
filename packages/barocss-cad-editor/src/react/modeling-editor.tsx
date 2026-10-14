import { buildModelingStructure, getModelingStructureCapabilities } from '../modeling-structure.js';
import type { ModelingStructureCommand } from '../modeling-structure.js';
import { useEffect, useId, useRef, useState } from 'react';
import { isModelingCompositionGraph } from '../modeling-composition.js';
import { createCadEditorModelingController } from '../modeling-controller.js';
import type { CadEditorModelingController, CadEditorModelingSnapshot } from '../modeling-controller.js';
import type { CadEditorModelingExample, CadEditorModelingSplitAxis } from '../modeling-engine.js';
import { createPrismFeatureDisplay } from '../prism-feature-display.js';
import { readModelingFileText } from '../modeling-file.js';
import { downloadModelingStl } from '../modeling-stl.js';
import type { CadEditorStlExport } from '../modeling-stl.js';
import { ModelingWorkspace } from './modeling-workspace.js';
import type { ModelingWorkspacePanel } from './modeling-workspace.js';
import { modelingDimensionCommand } from '../modeling-dimension-key.js';
import { extrusionCommandCurrent, projectExtrusionCommand } from '../modeling-extrusion-command.js';
import type { ExtrusionCommandTarget } from '../modeling-extrusion-command.js';
import { projectSketchCommand, sketchCommandCurrent } from '../modeling-sketch-command.js';
import type { SketchCommandTarget } from '../modeling-sketch-command.js';
import { createRectangularPartSource } from '../modeling-rectangular-part.js';
import type { RectangularPartInput } from '../modeling-rectangular-part.js';
import { createCircularPartSource } from '../modeling-circular-part.js';
import type { CircularPartInput } from '../modeling-circular-part.js';
import { Button } from './ui/button.js';
import { Input } from './ui/input.js';
import { Label } from './ui/label.js';

export interface CadEditorModelingProps {
  initialAuthoredText?: string;
  /** Mount-time layout choice. Changing this prop does not replace the active document or viewport. */
  workspace?: boolean;
}
/** Named dimensions over the single modeling API, using the existing native display. */
export function CadEditorModeling({ initialAuthoredText, workspace: initialWorkspace = false }: CadEditorModelingProps) {
  const workspace = useRef(initialWorkspace).current;
  const id = useId(), viewport = useRef<HTMLDivElement | null>(null);
  const controller = useRef<CadEditorModelingController | null>(null);
  const displayRef = useRef<ReturnType<typeof createPrismFeatureDisplay> | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null), fileReadEpoch = useRef(0), fileActionEpoch = useRef(0);
  const [snapshot, setSnapshot] = useState<CadEditorModelingSnapshot | null>(null);
  const [workspacePanel, setWorkspacePanel] = useState<ModelingWorkspacePanel | null>(null);
  const [extrusionTarget, setExtrusionTarget] = useState<(ExtrusionCommandTarget & { session: CadEditorModelingController; instance: number }) | null>(null);
  const extrusionCommandInstance = useRef(0);
  const [sketchTarget, setSketchTarget] = useState<(SketchCommandTarget & { session: CadEditorModelingController; instance: number }) | null>(null);
  const sketchCommandInstance = useRef(0);
  const workspaceCommandEpoch = useRef(0);
  const structureInstance = useRef(0), structureFieldVersion = useRef(0);
  const [structureTarget, setStructureTarget] = useState<{ session: CadEditorModelingController; text: string; generation: number; instance: number; command: ModelingStructureCommand } | null>(null);
  const [structureInput, setStructureInput] = useState({ x: '0', y: '0', width: '8', height: '24', radius: '5', wall: '8', floor: '4', distance: '1', z: '0', axis: 'x', angleDegrees: '90' });
  const newPartCommandInstance = useRef(0), newPartOperationEpoch = useRef(0);
  const [newPartTarget, setNewPartTarget] = useState<{ session: CadEditorModelingController; authoredText: string | null; generation: number; instance: number; kind: 'rectangle' | 'circle' } | null>(null);
  const [newPartInput, setNewPartInput] = useState<RectangularPartInput>({ width: '32', height: '24', thickness: '8' });
  const [circularPartInput, setCircularPartInput] = useState<CircularPartInput>({ diameter: '17.5', thickness: '5' });
  const [example, setExample] = useState<CadEditorModelingExample>('cut-chamfer');
  const [splitAxis, setSplitAxis] = useState<CadEditorModelingSplitAxis>('z');
  const [stlOutput, setStlOutput] = useState('');
  const [stlResult, setStlResult] = useState<CadEditorStlExport | null>(null);
  const [replaceExample, setReplaceExample] = useState(false);
  const [source, setSource] = useState(''), [confirmed, setConfirmed] = useState(false), [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!viewport.current) return;
    structureInstance.current++; structureFieldVersion.current++; setStructureTarget(null);
    newPartOperationEpoch.current++; newPartCommandInstance.current++; setNewPartTarget(null);
    extrusionCommandInstance.current++; setExtrusionTarget(null); sketchCommandInstance.current++; setSketchTarget(null); setWorkspacePanel(null);
    const display = createPrismFeatureDisplay(viewport.current); displayRef.current = display;
    const session = createCadEditorModelingController(display, () => display.aspect()); controller.current = session;
    const observer = new ResizeObserver(() => { try { display.resize(); } catch (cause) { setError(String(cause)); } });
    observer.observe(viewport.current);
    const unsubscribe = session.subscribe(() => { fileActionEpoch.current++; setSnapshot(session.getSnapshot()); }); setSnapshot(session.getSnapshot());
    void (initialAuthoredText === undefined ? session.example() : session.open(initialAuthoredText)).catch(cause => setError(String(cause)));
    return () => { structureInstance.current++; structureFieldVersion.current++; newPartOperationEpoch.current++; newPartCommandInstance.current++; workspaceCommandEpoch.current++; extrusionCommandInstance.current++; sketchCommandInstance.current++; fileReadEpoch.current++; observer.disconnect(); unsubscribe(); session.dispose(); display.dispose(); if (controller.current === session) controller.current = null; if (displayRef.current === display) displayRef.current = null; };
  }, [initialAuthoredText]);
  const stageModelFile = async (file?: File) => {
    if (!file || snapshot?.busy) return;
    const readEpoch = ++fileReadEpoch.current;
    // A physical file selection never authorizes a model replacement.
    setConfirmed(false); setError(null);
    try {
      const text = await readModelingFileText(file);
      if (readEpoch !== fileReadEpoch.current || !controller.current) return;
      setConfirmed(false); // Consent granted while a read was pending never applies to newly staged bytes.
      setSource(text);
    } catch (cause) {
      if (readEpoch === fileReadEpoch.current && controller.current) {
        setError(`Cannot read model file: ${String(cause)}`);
      }
    }
  };
  const action = (operation: (session: CadEditorModelingController) => unknown) => {
    setError(null); try { if (controller.current) Promise.resolve(operation(controller.current)).catch(cause => setError(String(cause))); }
    catch (cause) { setError(String(cause)); }
  };
  const viewSession = controller.current;
  const changeView = (orientation: 'isometric' | 'top') => {
    const current = viewSession?.getSnapshot();
    if (!viewSession || controller.current !== viewSession || !snapshot || !current
      || current.generation !== snapshot.generation || current.authoredText !== snapshot.authoredText) return;
    action(session => session.setView(orientation, snapshot.generation));
  };
  const extrusionCommandLive = () => extrusionTarget !== null && extrusionTarget.session === controller.current
    && extrusionTarget.instance === extrusionCommandInstance.current;
  const sketchCommandLive = () => sketchTarget !== null && sketchTarget.session === controller.current
    && sketchTarget.instance === sketchCommandInstance.current;
  const sketchRenderCurrent = () => {
    const current = controller.current?.getSnapshot();
    return sketchCommandLive() && !!current && current.generation === snapshot?.generation
      && current.authoredText === snapshot?.authoredText;
  };
  const newPartCommandLive = () => newPartTarget !== null && newPartTarget.session === controller.current
    && newPartTarget.instance === newPartCommandInstance.current;
  const newPartCommandCurrent = () => {
    const current = controller.current?.getSnapshot();
    return newPartCommandLive() && !!current && !current.disposed && current.authoredText === newPartTarget!.authoredText
      && current.generation === newPartTarget!.generation;
  };
  const newPartRenderCurrent = () => {
    const current = controller.current?.getSnapshot();
    return newPartCommandLive() && !!current && current.generation === snapshot?.generation
      && current.authoredText === snapshot?.authoredText;
  };
  const structureCommandCurrent = () => {
    const current = controller.current?.getSnapshot();
    return !!structureTarget && structureTarget.session === controller.current
      && structureTarget.instance === structureInstance.current && !!current && !current.disposed
      && current.authoredText === structureTarget.text && current.generation === structureTarget.generation
      && (!['add-hole', 'cut-pocket', 'chamfer', 'rotate-part', 'move-part'].includes(structureTarget.command.kind) || (structureTarget.command.kind !== 'union' && current.selection === structureTarget.command.target.node));
  };
  const structureRenderVersion = structureFieldVersion.current, structureRenderState = fileActionEpoch.current;
  const structureRenderCurrent = () => structureCommandCurrent() && structureRenderVersion === structureFieldVersion.current && structureRenderState === fileActionEpoch.current;
  const structureRenderLive = () => {
    const current = controller.current?.getSnapshot();
    return !!structureTarget && structureTarget.session === controller.current && structureTarget.instance === structureInstance.current
      && structureRenderVersion === structureFieldVersion.current && structureRenderState === fileActionEpoch.current && !!current && !current.disposed
      && current.generation === snapshot?.generation && current.authoredText === snapshot?.authoredText;
  };
  const structureCommand = (): ModelingStructureCommand => {
    if (!structureTarget) throw Error('Choose a current structural command.');
    if (structureTarget.command.kind === 'union') return structureTarget.command;
    const decimal = structureTarget.command.kind === 'add-hole' || structureTarget.command.kind === 'chamfer' || structureTarget.command.kind === 'move-part';
    const value = (raw: string) => {
      if (raw.length > 64 || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(raw.trim())) throw Error(decimal ? 'Enter finite decimal millimetres.' : 'Enter finite integer millimetres.');
      const number = Number(raw);
      if (!(decimal ? Number.isFinite(number) : Number.isSafeInteger(number)) || Math.abs(number) > 10000 || (number === 0 && /[1-9]/.test(raw.trim().split(/[eE]/)[0]))) throw Error(decimal ? 'Use finite millimetres between -10000 and 10000.' : 'Use integer millimetres between -10000 and 10000.');
      return number;
    };
    if (structureTarget.command.kind === 'rotate-part') {
      if (!['x', 'y', 'z'].includes(structureInput.axis) || !['90', '-90', '180', '-180', '270', '-270'].includes(structureInput.angleDegrees)) throw Error('Choose a cardinal axis and angle.');
      return { ...structureTarget.command, axis: structureInput.axis as 'x' | 'y' | 'z', angleDegrees: Number(structureInput.angleDegrees) as 90 | -90 | 180 | -180 | 270 | -270 };
    }
    if (structureTarget.command.kind === 'move-part') return { ...structureTarget.command, x: value(structureInput.x), y: value(structureInput.y), z: value(structureInput.z) };
    if (structureTarget.command.kind === 'chamfer') return { ...structureTarget.command, distance: value(structureInput.distance) };
    if (structureTarget.command.kind === 'cut-pocket') return { ...structureTarget.command, wall: value(structureInput.wall), floor: value(structureInput.floor) };
    if (structureTarget.command.kind === 'add-hole') return { ...structureTarget.command, x: value(structureInput.x), y: value(structureInput.y), radius: value(structureInput.radius) };
    return { ...structureTarget.command, x: value(structureInput.x), y: value(structureInput.y), width: value(structureInput.width), height: value(structureInput.height) };
  };
  const invalidateCommandPreview = () => {
    const session = controller.current, current = session?.getSnapshot();
    if (current?.preview) { if (current.busy) session!.cancel(); else session!.clearPreview(); }
  };
  const openWorkspacePanel = (panel: ModelingWorkspacePanel | null) => {
    if (panel !== workspacePanel) invalidateCommandPreview();
    // A same-panel action with no replacement target keeps its live callbacks.
    if ((panel === 'files' || panel === 'dimensions') && workspacePanel === panel) return;
    if (panel === 'rotate-part' || panel === 'move-part' || panel === 'add-arm' || panel === 'union' || panel === 'cut-slot' || panel === 'add-hole' || panel === 'cut-pocket' || panel === 'chamfer') {
      const session = controller.current, current = session?.getSnapshot();
      if (!session || !current?.authoredText || current.busy || current.disposed) return;
      const capabilities = getModelingStructureCapabilities(current.authoredText, current.accepted);
      const target = panel === 'rotate-part' ? capabilities.rotatePart : panel === 'move-part' ? capabilities.movePart : panel === 'chamfer' ? capabilities.chamfer : panel === 'cut-pocket' ? capabilities.cutPocket : panel === 'add-hole' ? capabilities.addHole : panel === 'add-arm' ? capabilities.addArm : panel === 'cut-slot' ? capabilities.cutSlot : capabilities.union;
      const selectedTarget = panel === 'rotate-part' ? capabilities.rotatePart : panel === 'move-part' ? capabilities.movePart : panel === 'chamfer' ? capabilities.chamfer : panel === 'add-hole' ? capabilities.addHole : panel === 'cut-pocket' ? capabilities.cutPocket : null;
      if (!target || (['add-hole', 'cut-pocket', 'chamfer', 'rotate-part', 'move-part'].includes(panel) && current.selection !== selectedTarget?.node)) { setError(panel === 'rotate-part' || panel === 'move-part' ? capabilities.placementReason : panel === 'chamfer' ? capabilities.chamferReason : panel === 'cut-pocket' ? capabilities.pocketReason : panel === 'add-hole' ? capabilities.holeReason : capabilities.reason); return; }
      invalidateCommandPreview();
      const command: ModelingStructureCommand = panel === 'union'
        ? { kind: 'union', targets: capabilities.union! }
        : panel === 'rotate-part' ? { kind: 'rotate-part', target: capabilities.rotatePart!, axis: 'x', angleDegrees: 90 }
        : panel === 'move-part' ? { kind: 'move-part', target: capabilities.movePart!, x: 40, y: 16, z: 0 }
        : panel === 'chamfer' ? { kind: 'chamfer', target: capabilities.chamfer!, distance: capabilities.chamfer!.node === 2 ? 2 : 1 }
        : panel === 'cut-pocket' ? { kind: 'cut-pocket', target: capabilities.cutPocket!, wall: capabilities.pocketDefaults!.wall, floor: capabilities.pocketDefaults!.floor }
        : panel === 'add-hole' ? { kind: 'add-hole', target: capabilities.addHole!, x: 40, y: 20, radius: 5 }
        : { kind: panel, target: panel === 'add-arm' ? capabilities.addArm! : capabilities.cutSlot!, x: panel === 'add-arm' ? 0 : 16, y: panel === 'add-arm' ? 0 : 2, width: 8, height: panel === 'add-arm' ? 24 : 4 };
      setStructureTarget({ session, text: current.authoredText, generation: current.generation, instance: structureInstance.current + 1, command });
      setStructureInput({ ...(panel === 'move-part' ? { x: '40', y: '16', width: '8', height: '4', radius: '5' } : panel === 'add-hole' ? { x: '40', y: '20', width: '8', height: '4', radius: '5' }
        : panel === 'add-arm' ? { x: '0', y: '0', width: '8', height: '24', radius: '5' } : { x: '16', y: '2', width: '8', height: '4', radius: '5' }),
        wall: String(capabilities.pocketDefaults?.wall ?? 8), floor: String(capabilities.pocketDefaults?.floor ?? 4), distance: panel === 'chamfer' && capabilities.chamfer?.node === 2 ? '2' : '1', z: '0', axis: 'x', angleDegrees: '90' });
      setError(null);
    }
    if (panel === 'new-part' || panel === 'new-circular-part') {
      const session = controller.current, current = session?.getSnapshot();
      if (!session || !current || current.busy || current.disposed) return;
      if (workspacePanel === panel && newPartCommandCurrent()) return;
      if (panel === 'new-circular-part') setCircularPartInput({ diameter: '17.5', thickness: '5' });
      else setNewPartInput({ width: '32', height: '24', thickness: '8' });
      setNewPartTarget({ session, authoredText: current.authoredText, generation: current.generation,
        instance: newPartCommandInstance.current + 1, kind: panel === 'new-circular-part' ? 'circle' : 'rectangle' });
      setError(null);
    }
    if (panel === 'sketch') {
      const current = controller.current?.getSnapshot();
      const projection = current && projectSketchCommand(current, current.selection);
      if (!current || current.busy || !projection || !current.authoredText) return;
      invalidateCommandPreview(); // Even the same panel creates a new pinned command instance.
      if (Object.keys(current.drafts).some(name => !projection.parameters.includes(name))) {
        setError('Other model dimensions are pending. Review all pending dimensions before editing this sketch.');
        structureInstance.current++; structureFieldVersion.current++;
        workspaceCommandEpoch.current++; extrusionCommandInstance.current++; sketchCommandInstance.current++; newPartCommandInstance.current++; setWorkspacePanel('dimensions'); return;
      }
      setError(null);
      setSketchTarget({ index: projection.index, authoredText: current.authoredText, generation: current.generation,
        session: controller.current!, instance: sketchCommandInstance.current + 1 });
    }
    if (panel === 'extrusion') {
      const current = controller.current?.getSnapshot();
      const projection = current && projectExtrusionCommand(current, current.selection);
      if (!current || current.busy || !projection || !current.authoredText) return;
      invalidateCommandPreview(); // Even the same panel creates a new pinned command instance.
      if (Object.keys(current.drafts).some(name => !projection.parameters.includes(name))) {
        setError('Other model dimensions are pending. Review all pending dimensions before editing this extrusion.');
        structureInstance.current++; structureFieldVersion.current++;
        workspaceCommandEpoch.current++; extrusionCommandInstance.current++; sketchCommandInstance.current++; newPartCommandInstance.current++; setWorkspacePanel('dimensions'); return;
      }
      setError(null);
      setExtrusionTarget({ index: projection.index, authoredText: current.authoredText, generation: current.generation,
        session: controller.current!, instance: extrusionCommandInstance.current + 1 });
    }
    structureInstance.current++; structureFieldVersion.current++;
    workspaceCommandEpoch.current++; extrusionCommandInstance.current++; sketchCommandInstance.current++; newPartCommandInstance.current++; setWorkspacePanel(panel);
  };
  const cancelStructure = () => {
    if (!structureRenderLive() || controller.current?.getSnapshot().busy) return;
    // Temporary structural options never discard unrelated named model drafts.
    invalidateCommandPreview(); openWorkspacePanel(null);
  };
  const previewStructure = () => {
    const session = controller.current, current = session?.getSnapshot();
    if (!structureRenderCurrent() || !session || !current || current.busy || Object.keys(current.drafts).length) return;
    const commandEpoch = workspaceCommandEpoch.current;
    try {
      const command = structureCommand();
      setError(null);
      void session.previewStructure(command, current.generation, !current.workerReady).catch(cause => {
        if (controller.current === session && commandEpoch === workspaceCommandEpoch.current) setError(String(cause));
      });
    } catch (cause) { setError(String(cause)); }
  };
  const applyStructure = () => {
    const session = controller.current, current = session?.getSnapshot();
    if (!structureRenderCurrent() || !session || !current || current.busy || Object.keys(current.drafts).length
      || current.preview?.operation !== 'structure' || current.preview.status !== 'ready') return;
    const commandEpoch = workspaceCommandEpoch.current, fieldVersion = structureFieldVersion.current;
    try {
      const command = structureCommand(); setError(null);
      void session.applyStructure(command, current.generation).then(() => {
        const after = session.getSnapshot();
        if (controller.current === session && commandEpoch === workspaceCommandEpoch.current && fieldVersion === structureFieldVersion.current
          && after.generation === current.generation + 1 && !after.busy && !after.error && !after.disposed) openWorkspacePanel(null);
      }).catch(cause => {
        if (controller.current === session && commandEpoch === workspaceCommandEpoch.current) setError(String(cause));
      });
    } catch (cause) { setError(String(cause)); }
  };
  const cancelNewPart = () => {
    const current = controller.current?.getSnapshot();
    // Only the currently rendered close action may dismiss stale document options.
    if (!newPartRenderCurrent() || !current || current.busy) return;
    openWorkspacePanel(null);
  };
  const createNewPart = () => {
    if ((workspacePanel !== 'new-part' && workspacePanel !== 'new-circular-part') || !newPartCommandCurrent()) return;
    const session = controller.current!, current = session.getSnapshot();
    if (current.busy || Object.keys(current.drafts).length) return;
    let text: string;
    try { text = newPartTarget!.kind === 'circle' ? createCircularPartSource(circularPartInput) : createRectangularPartSource(newPartInput); } catch (cause) { setError(String(cause)); return; }
    const commandEpoch = ++workspaceCommandEpoch.current, generation = current.generation;
    const operationEpoch = ++newPartOperationEpoch.current;
    const fileEpoch = ++fileReadEpoch.current; // Old reads cannot stage bytes into a new document.
    action(async active => {
      if (active !== session) return;
      await active.open(text);
      const after = active.getSnapshot();
      const replaced = operationEpoch === newPartOperationEpoch.current && controller.current === active
        && after.generation === generation + 1
        && !after.busy && !after.error && !after.disposed;
      // Document replacement invalidates old file consent even if the user opened another panel.
      // A newer explicit file action owns its own staged text and must not be cleared here.
      if (replaced && fileReadEpoch.current === fileEpoch) { setSource(''); setConfirmed(false); }
      if (replaced && commandEpoch === workspaceCommandEpoch.current && newPartCommandLive()) {
        openWorkspacePanel(null);
      }
    });
  };
  const applyDimensions = () => {
    if (workspacePanel === 'extrusion' && !extrusionCommandLive()) return;
    if (workspacePanel === 'sketch' && (!sketchRenderCurrent() || !sketchCommandCurrent(controller.current?.getSnapshot() ?? null, sketchTarget))) return;
    const commandEpoch = ++workspaceCommandEpoch.current;
    action(async session => {
      if (workspacePanel === 'extrusion') {
        const projection = extrusionCommandCurrent(session.getSnapshot(), extrusionTarget);
        if (!projection?.parameters.length) throw Error('This extrusion command is stale or other dimensions are pending. Reopen it or review model dimensions.');
      }
      if (workspacePanel === 'sketch') {
        const projection = sketchCommandCurrent(session.getSnapshot(), sketchTarget);
        if (!projection?.parameters.length) throw Error('This sketch command is stale or other dimensions are pending. Reopen it or review model dimensions.');
      }
      await session.apply();
      const current = session.getSnapshot();
      if (workspace && controller.current === session && commandEpoch === workspaceCommandEpoch.current
        && !current.disposed && !current.busy && !current.error && !Object.keys(current.drafts).length) {
        extrusionCommandInstance.current++; sketchCommandInstance.current++; setWorkspacePanel(null);
      }
    });
  };
  const previewSession = controller.current, previewRenderEpoch = fileActionEpoch.current, previewCommandEpoch = workspaceCommandEpoch.current;
  const previewDimensions = () => {
    const session = controller.current, current = session?.getSnapshot();
    if (!session || session !== previewSession || !current || current.busy || current.disposed
      || previewRenderEpoch !== fileActionEpoch.current || previewCommandEpoch !== workspaceCommandEpoch.current
      || current.generation !== snapshot?.generation || current.authoredText !== snapshot?.authoredText) return;
    if (workspace && !['dimensions', 'sketch', 'extrusion'].includes(workspacePanel ?? '')) return;
    if (workspacePanel === 'extrusion' && (!extrusionCommandLive() || !extrusionCommandCurrent(current, extrusionTarget)?.parameters.length)) return;
    if (workspacePanel === 'sketch' && (!sketchRenderCurrent() || !sketchCommandCurrent(current, sketchTarget)?.parameters.length)) return;
    setError(null);
    void session.preview(!current.workerReady).catch(cause => {
      if (controller.current === session && workspaceCommandEpoch.current === previewCommandEpoch) setError(String(cause));
    });
  };
  const cancelDimensions = () => {
    if (workspacePanel === 'extrusion' && !extrusionCommandLive()) return;
    if (workspacePanel === 'sketch' && !sketchRenderCurrent()) return;
    action(session => {
      // A stale command never discards a newer model's drafts or hidden unrelated fields.
      if (workspacePanel === 'sketch' ? sketchCommandCurrent(session.getSnapshot(), sketchTarget)
        : workspacePanel !== 'extrusion' || extrusionCommandCurrent(session.getSnapshot(), extrusionTarget)) session.discard();
      openWorkspacePanel(null);
    });
  };
  useEffect(() => { setReplaceExample(false); setStlOutput(''); setStlResult(null); }, [snapshot?.generation]);
  const accepted = snapshot?.accepted, busy = snapshot?.busy ?? false, draft = Object.keys(snapshot?.drafts ?? {}).length > 0;
  const structureCapabilities = getModelingStructureCapabilities(snapshot?.authoredText ?? null, accepted ?? null);
  const pocketNotice = structureCapabilities.pocketAuthored ? 'Global parameter edits can remove the tray floor or walls. Keep pocketFloor and pocketWall positive to retain a tray; native geometry remains authoritative.' : null;
  const selectedExtrusion = projectExtrusionCommand(snapshot, snapshot?.selection ?? null);
  const selectedSketch = projectSketchCommand(snapshot, snapshot?.selection ?? null);
  const currentSketch = sketchCommandLive() ? sketchCommandCurrent(snapshot, sketchTarget) : null;
  const sketchSourceCurrent = sketchCommandLive() && !!snapshot && !!sketchTarget && snapshot.authoredText === sketchTarget.authoredText
    && snapshot.generation === sketchTarget.generation;
  const pinnedSketch = sketchSourceCurrent ? projectSketchCommand(snapshot, sketchTarget!.index) : null;
  const currentExtrusion = extrusionCommandLive() ? extrusionCommandCurrent(snapshot, extrusionTarget) : null;
  const extrusionSourceCurrent = extrusionCommandLive() && !!snapshot && !!extrusionTarget && snapshot.authoredText === extrusionTarget.authoredText
    && snapshot.generation === extrusionTarget.generation;
  const pinnedExtrusion = extrusionSourceCurrent ? projectExtrusionCommand(snapshot, extrusionTarget!.index) : null;
  const selectedStlOutput = accepted?.outputs.find(output => output.name === stlOutput);
  const canExportStl = accepted?.source === 'model' && selectedStlOutput
    && (selectedStlOutput.family === undefined || selectedStlOutput.family === 'convex-planar');
  const exportStl = async () => {
    const session = controller.current, generation = snapshot?.generation;
    if (!session || generation === undefined || !canExportStl || busy || draft) return;
    setError(null); setStlResult(null);
    try {
      const result = await session.exportStl(stlOutput, generation, !snapshot?.workerReady);
      const current = session.getSnapshot();
      if (!result || controller.current !== session || current.generation !== generation || current.disposed || current.busy
        || Object.keys(current.drafts).length || current.accepted?.revision !== result.revision
        || !current.accepted.outputs.some(output => output.name === result.outputName && output.solidId === result.solidId)) return;
      downloadModelingStl(result); setStlResult(result);
    } catch (cause) { if (controller.current === session) setError(String(cause)); }
  };
  const chamferChain = accepted?.source === 'model' && accepted.features.map(feature => feature.kind).join(',') === 'sketch,extrude,chamfer,chamfer'
    && ['frontDistance', 'backDistance', 'backY'].every(name => Object.hasOwn(accepted.parameters, name));
  const chamferSplit = accepted?.source === 'model' && accepted.features.map(feature => feature.kind).join(',') === 'sketch,extrude,chamfer,chamfer,split'
    && ['frontDistance', 'backDistance', 'splitAt'].every(name => Object.hasOwn(accepted.parameters, name));
  const derivedSplit = accepted?.source === 'model' && accepted.features.map(feature => feature.kind).join(',') === 'sketch,extrude,chamfer,chamfer,split'
    && ['width', 'offset', 'frontDistance', 'backDistance'].every(name => Object.hasOwn(accepted.parameters, name));
  const miterSplit = accepted?.source === 'model' && accepted.features.map(feature => feature.kind).join(',') === 'sketch,extrude,split'
    && Object.keys(accepted.parameters).length === 1 && Object.hasOwn(accepted.parameters, 'cutPosition')
    && JSON.parse(snapshot?.authoredText ?? '{}').nodes?.at(-1)?.plane === 'x+y';
  const bodyView = snapshot?.display && 'selectedOutput' in snapshot.display ? snapshot.display : null;
  const authored = accepted?.source === 'model' ? JSON.parse(snapshot?.authoredText ?? '{}') : null;
  const orthogonalKinds = Object.values(authored?.outputs ?? {}).map(output => authored.nodes[(output as { node: number }).node]?.kind);
  const unionModel = orthogonalKinds.includes('union'), differenceModel = orthogonalKinds.includes('difference');
  const unionDrivers = unionModel && (() => {
    const n = JSON.parse(snapshot?.authoredText ?? '{}').nodes;
    return n?.length === 5 && n[0].kind === 'sketch' && n[0].profile === 'rectangle'
      && JSON.stringify(n[0].min) === '[0,0]' && JSON.stringify(n[0].max) === '[32,8]'
      && n[1].kind === 'extrude' && n[1].sketch === 0 && n[1].height === 8
      && n[2].kind === 'sketch' && n[2].profile === 'rectangle' && n[2].min?.[0]?.parameter === 'legMinX' && n[2].min?.[1]?.parameter === 'legMinY'
      && n[2].max?.[0]?.op === 'add' && n[2].max[0].left?.parameter === 'legMinX' && n[2].max[0].right?.parameter === 'legWidth' && n[2].max[1] === 24
      && n[3].kind === 'extrude' && n[3].sketch === 2 && n[3].height?.parameter === 'legHeight'
      && n[4].kind === 'union' && n[4].left?.node === 1 && n[4].right?.node === 3 && n[4].left.side === 'solid' && n[4].right.side === 'solid';
  })();
  const pocketDrivers = differenceModel && (() => {
    const n = authored?.nodes;
    return n?.length === 5 && n[0].kind === 'sketch' && n[0].profile === 'rectangle'
      && JSON.stringify(n[0].min) === '[0,0]' && JSON.stringify(n[0].max) === '[32,24]'
      && n[1].kind === 'extrude' && n[1].sketch === 0 && n[1].height === 8 && !Object.hasOwn(n[1], 'from')
      && n[2].kind === 'sketch' && n[2].profile === 'rectangle' && n[2].min?.[0]?.parameter === 'toolX' && n[2].min?.[1]?.parameter === 'toolY'
      && n[2].max?.[0]?.op === 'add' && n[2].max[0].left?.parameter === 'toolX' && n[2].max[0].right?.parameter === 'toolWidth'
      && n[2].max?.[1]?.op === 'add' && n[2].max[1].left?.parameter === 'toolY' && n[2].max[1].right?.parameter === 'toolSpanY'
      && n[3].kind === 'extrude' && n[3].sketch === 2 && n[3].height?.parameter === 'depth' && !Object.hasOwn(n[3], 'from')
      && n[4].kind === 'difference' && n[4].parent?.node === 1 && n[4].tool?.node === 3 && n[4].parent.side === 'solid' && n[4].tool.side === 'solid';
  })();
  const pocketSavedOutputs = pocketDrivers && Object.keys(authored.outputs).join(',') === 'part,plate,tool'
    && authored.outputs.part.node === 4 && authored.outputs.plate.node === 1 && authored.outputs.tool.node === 3
    && ['part', 'plate', 'tool'].every(name => authored.outputs[name].side === 'solid');
  const topPocketDrivers = differenceModel && accepted?.source === 'model'
    && Object.keys(accepted.parameters).sort().join(',') === 'depth,toolSpanY,toolY'
    && JSON.stringify(authored?.nodes) === JSON.stringify([
      { kind: 'sketch', max: [32, 24], min: [-0, 0], profile: 'rectangle' },
      { height: 8, kind: 'extrude', sketch: 0 },
      { kind: 'sketch', max: [24, { left: { parameter: 'toolY' }, op: 'add', right: { parameter: 'toolSpanY' } }],
        min: [8, { parameter: 'toolY' }], profile: 'rectangle' },
      { from: { left: 8, op: 'add', right: { factor: -1, op: 'scale', value: { parameter: 'depth' } } },
        height: { parameter: 'depth' }, kind: 'extrude', sketch: 2 },
      { kind: 'difference', parent: { node: 1, side: 'solid' }, tool: { node: 3, side: 'solid' } },
    ]) && JSON.stringify(authored?.outputs) === JSON.stringify({ part: { node: 4, side: 'solid' }, plate: { node: 1, side: 'solid' }, tool: { node: 3, side: 'solid' } });
  const constrainedPlateDrivers = accepted?.source === 'model'
    && Object.keys(accepted.parameters).sort().join(',') === 'height,lockY,width' && accepted.parameters.lockY === 0
    && JSON.stringify(authored?.nodes) === JSON.stringify([
      { constraints: [{ kind: 'fixed', point: 0 }, { kind: 'fixed', point: 2 },
        { kind: 'horizontal', points: [0, 1] }, { kind: 'vertical', points: [1, 2] },
        { kind: 'horizontal', points: [2, 3] }, { kind: 'vertical', points: [3, 0] }, { kind: 'fixed', point: 1 }],
      kind: 'sketch', points: [[-0, 0], [{ parameter: 'width' }, { parameter: 'lockY' }],
        [{ parameter: 'width' }, { parameter: 'height' }], [1, { parameter: 'height' }]], profile: 'constrained-polygon' },
      { height: 8, kind: 'extrude', sketch: 0 },
    ]) && Object.is(authored.nodes[0].points[0][0], -0)
    && JSON.stringify(authored.outputs) === JSON.stringify({ part: { node: 1, side: 'solid' } });
  const holeModel = accepted?.outputs.some(output => output.family === 'stored-rational-plate-hole') ?? false;
  const circleModel = accepted?.outputs.some(output => output.family === 'stored-rational-circle-prism') ?? false;
  const roundPostDrivers = circleModel && accepted?.source === 'model'
    && Object.keys(accepted.parameters).sort().join(',') === 'centerX,centerY,diameter,height'
    && JSON.stringify(authored?.nodes) === JSON.stringify([
      { center: [{ parameter: 'centerX' }, { parameter: 'centerY' }], kind: 'sketch', profile: 'circle',
        radius: { factor: 0.5, op: 'scale', value: { parameter: 'diameter' } } },
      { height: { parameter: 'height' }, kind: 'extrude', sketch: 0 },
    ]) && JSON.stringify(authored?.outputs) === JSON.stringify({ post: { node: 1, side: 'solid' } });
  const composedModel = isModelingCompositionGraph(authored);
  const slotDrivers = composedModel && Object.keys(accepted!.parameters).sort().join(',') === 'legWidth,slotSpanY,slotWidth,slotX,slotY'
    && JSON.stringify(authored.nodes) === JSON.stringify([
      { kind: 'sketch', max: [32, 8], min: [0, 0], profile: 'rectangle' }, { height: 8, kind: 'extrude', sketch: 0 },
      { kind: 'sketch', max: [{ parameter: 'legWidth' }, 24], min: [-0, 0], profile: 'rectangle' }, { height: 8, kind: 'extrude', sketch: 2 },
      { kind: 'union', left: { node: 1, side: 'solid' }, right: { node: 3, side: 'solid' } },
      { kind: 'sketch', max: [{ left: { parameter: 'slotX' }, op: 'add', right: { parameter: 'slotWidth' } },
        { left: { parameter: 'slotY' }, op: 'add', right: { parameter: 'slotSpanY' } }], min: [{ parameter: 'slotX' }, { parameter: 'slotY' }], profile: 'rectangle' },
      { height: 8, kind: 'extrude', sketch: 5 }, { kind: 'difference', parent: { node: 4, side: 'solid' }, tool: { node: 6, side: 'solid' } },
    ]) && Object.is(authored.nodes[2].min[0], -0)
    && JSON.stringify(authored.outputs) === JSON.stringify({ bracket: { node: 4, side: 'solid' }, slotted: { node: 7, side: 'solid' } });
  const configurableFinishes = accepted?.source === 'model' && accepted.suppression !== undefined
    && Object.keys(accepted.suppression).length === 2 && ['frontFinish', 'backFinish'].every(name => Object.hasOwn(accepted.suppression!, name))
    && accepted.features.filter(feature => feature.name !== undefined).every(feature => feature.kind === 'chamfer');
  const dimensionInput = ([name, value]: [string, number], extrusionLabel?: string, command: 'extrusion' | 'sketch' = 'extrusion') => <div key={name} style={{ marginBottom: 16 }}>
          <Label htmlFor={`${id}-${extrusionLabel ? `${command}-` : ''}${name}`}>{extrusionLabel ?? (constrainedPlateDrivers && name === 'width' ? 'Profile X width' : constrainedPlateDrivers && name === 'height' ? 'Profile Y height' : topPocketDrivers && name === 'depth' ? 'Pocket depth downward from top Z=8' : topPocketDrivers && name === 'toolY' ? 'Tool Y origin' : topPocketDrivers && name === 'toolSpanY' ? 'Tool Y span' : slotDrivers && name === 'legWidth' ? 'legWidth · leg X width' : slotDrivers && name === 'slotX' ? 'slotX · slot origin X' : slotDrivers && name === 'slotY' ? 'slotY · slot origin Y' : slotDrivers && name === 'slotWidth' ? 'slotWidth · slot X width' : slotDrivers && name === 'slotSpanY' ? 'slotSpanY · slot Y span' : roundPostDrivers && name === 'diameter' ? 'Diameter' : roundPostDrivers && name === 'height' ? 'Extrusion height' : roundPostDrivers && name === 'centerX' ? 'Center X' : roundPostDrivers && name === 'centerY' ? 'Center Y' : pocketDrivers && name === 'toolX' ? 'toolX · tool origin X' : pocketDrivers && name === 'toolY' ? 'toolY · tool origin Y' : pocketDrivers && name === 'toolWidth' ? 'toolWidth · tool X width' : pocketDrivers && name === 'toolSpanY' ? 'toolSpanY · tool Y span' : pocketDrivers && name === 'depth' ? 'depth · positive Z depth from underside Z=0' : unionDrivers && name === 'legMinX' ? 'legMinX · leg origin X' : unionDrivers && name === 'legMinY' ? 'legMinY · leg origin Y' : unionDrivers && name === 'legWidth' ? 'legWidth · leg X width' : unionDrivers && name === 'legHeight' ? 'legHeight · extrusion height' : (chamferChain || configurableFinishes) && name === 'backY' ? 'backY · edge-selection Y coordinate' : (chamferChain || chamferSplit || derivedSplit || configurableFinishes) && name === 'frontDistance' ? 'frontDistance · front bevel distance' : (chamferChain || chamferSplit || derivedSplit || configurableFinishes) && name === 'backDistance' ? 'backDistance · back bevel distance' : chamferSplit && name === 'splitAt' ? 'splitAt · selected-axis split coordinate' : derivedSplit && name === 'width' ? 'width · rail X size' : derivedSplit && name === 'offset' ? 'offset · X displacement from center' : miterSplit && name === 'cutPosition' ? 'cutPosition · X + Y threshold' : name)} (mm)</Label>
          <Input id={`${id}-${extrusionLabel ? `${command}-` : ''}${name}`} disabled={busy || (!!extrusionLabel && !(command === 'sketch' ? currentSketch : currentExtrusion))} inputMode="decimal"
            value={Object.hasOwn(snapshot?.drafts ?? {}, name) ? snapshot!.drafts[name] : Object.is(value, -0) ? '-0' : String(value)}
            onChange={event => {
              if (extrusionLabel && (command === 'sketch' ? !sketchRenderCurrent() : !extrusionCommandLive())) return;
              action(s => {
              if (extrusionLabel && (workspacePanel !== command || !(command === 'sketch'
                ? sketchCommandCurrent(s.getSnapshot(), sketchTarget) : extrusionCommandCurrent(s.getSnapshot(), extrusionTarget))?.parameters.includes(name)))
                throw Error(`Reopen the ${command} command before changing this driver. Pending model dimensions are retained.`);
              s.stage(name, event.target.value);
              });
            }}
            onKeyDown={event => {
              if (extrusionLabel && (workspacePanel !== command || (command === 'sketch' ? !sketchRenderCurrent() : !extrusionCommandLive()))) return;
              const current = controller.current?.getSnapshot();
              if (!current) return;
              const keyCommand = modelingDimensionCommand({
                key: event.key, repeat: event.repeat, isComposing: event.nativeEvent.isComposing,
                keyCode: event.keyCode, altKey: event.altKey, ctrlKey: event.ctrlKey,
                metaKey: event.metaKey, shiftKey: event.shiftKey,
              }, {
                accepted: current.accepted !== null, draftCount: Object.keys(current.drafts).length,
                busy: current.busy, disposed: current.disposed,
              });
              if (workspace && event.key === 'Escape' && !event.repeat && !event.nativeEvent.isComposing && event.keyCode !== 229
                && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey && !current.busy && !current.disposed) {
                event.preventDefault(); event.stopPropagation(); cancelDimensions(); return;
              }
              if (keyCommand === null) return;
              event.preventDefault(); event.stopPropagation();
              if (workspace) { if (keyCommand === 'apply') applyDimensions(); else cancelDimensions(); }
              else action(s => keyCommand === 'apply' ? s.apply() : s.discard());
            }} />
        </div>;
  const examplesPanel = <details open={workspace || undefined} style={{ marginTop: 16 }}><summary>Modeling examples</summary>
      <Label htmlFor={`${id}-example`}>Choose an example</Label>
      <select id={`${id}-example`} value={example} disabled={busy}
        onChange={event => { setExample(event.target.value as CadEditorModelingExample); setReplaceExample(false); if (event.target.value === 'chamfer-split') setSplitAxis('x'); }}>
        <option value="cut-chamfer">Cut and chamfer a part</option>
        <option value="intersection">Intersect two extrusions</option>
        <option value="horizontal-split">Split a part</option>
        <option value="two-chamfer">Two chamfers on a part</option>
        <option value="chamfer-split">Split a beveled part</option>
        <option value="derived-split">Keep a beveled split centered</option>
        <option value="miter-split">Split a 45° XY miter</option>
        <option value="configurable-finishes">Configure rail finishes</option>
        <option value="slotted-bracket">Cut a slot in a bracket</option>
        <option value="round-post">Create a round post</option>
        <option value="underside-pocket">Cut an underside pocket</option>
        <option value="constrained-plate">Resize a constrained plate</option>
        <option value="top-entry-pocket">Cut a top-entry pocket</option>
        <option value="union-bracket">Fuse an L-bracket</option>
        <option value="mounting-plate">Mounting plate with a through-hole</option>
      </select>
      {(example === 'horizontal-split' || example === 'chamfer-split') && <>
        <Label htmlFor={`${id}-split-axis`}>Split axis for the new example</Label>
        <select id={`${id}-split-axis`} value={splitAxis} disabled={busy}
          onChange={event => { setSplitAxis(event.target.value as CadEditorModelingSplitAxis); setReplaceExample(false); }}>
          <option value="z">{example === 'chamfer-split' ? 'Z · negative / positive' : 'Z · lower / upper'}</option>
          <option value="x">X · negative / positive</option>
          {example === 'horizontal-split' && <option value="y">Y · negative / positive</option>}
        </select>
        <p>Axis choice loads a new example after replacement acknowledgment; it does not edit the accepted part.</p>
      </>}
      <p>{example === 'constrained-plate'
        ? 'Resize an 8 mm thick plate through its constrained XY profile. Width and profile height drive fixed corners; horizontal and vertical edges remain constrained.'
        : example === 'slotted-bracket'
        ? 'Fuse the base and leg, then cut a through-slot in that owned bracket. Edit leg width and slot X/Y origin, width and span. Both saved outputs remain available; this preset selects slotted.'
        : example === 'round-post'
        ? 'Create a diameter-driven round post from an owned rational circle. Edit diameter and extrusion height in millimetres; optional center coordinates locate the post. Exact native qualification can refuse dimensions without replacing the accepted part. Certified volume is unavailable.'
        : example === 'top-entry-pocket'
        ? 'Cut downward from the top Z=8 of a 32 × 24 × 8 mm plate. Depth drives the lower tool origin 8 − depth; tool Y origin and Y span are editable. Tool X stays 8..24. Depth8 makes a through-window. The preset selects part while plate and tool remain saved.'
        : example === 'underside-pocket'
        ? 'Cut an underside pocket into a 32 × 24 × 8 mm plate. Tool X/Y origin, width, Y span and depth are numeric drivers. Both extrusions start at Z=0; depth8 makes a through-window. The preset selects part while plate and tool remain saved.'
        : example === 'union-bracket'
        ? 'Fuse two owned rectangular extrusions into one connected L-bracket. Edit the leg origin, width and height in integer millimetres. Base, leg and bracket remain saved; bracket is selected for this preset. Edge-only contact and disconnected material are refused.'
        : example === 'mounting-plate'
        ? 'Create an 80 × 40 × 8 mm rectangular mounting plate with one qualified stored-rational through-hole. Radius and center coordinates are editable; both blank and plate remain saved outputs, with plate selected for display. Exact native qualification can refuse otherwise plausible dimensions.'
        : example === 'configurable-finishes'
        ? 'Give the two result-owned chamfers names, then switch their finishing states on the accepted rail. The fixed X split keeps negative and positive outputs. Disabled operations still validate their candidate geometry.'
        : example === 'miter-split'
        ? 'Split a plain rectangular rail on the fixed 45° plane X + Y = cutPosition. The driver is a coordinate-sum threshold in mm, not perpendicular distance. Negative is below the sum; positive is above it. Both sides must remain nonempty.'
        : example === 'derived-split'
        ? 'Keep the X split at width × 0.5 + offset after both bevels. Edit width and offset as numeric drivers; the formula and negative/positive outputs stay fixed. No separate splitAt field is needed.'
        : example === 'chamfer-split'
        ? 'Split the finished two-chamfer rectangle into negative and positive bodies. X starts at 16 mm; Z starts at 4 mm. Both sides must have positive volume. This preset offers the measured X/Z cases; the plain split example still offers Y.'
        : example === 'horizontal-split'
        ? splitAxis === 'z' ? 'Split one direct XY extrusion at a Z height into lower and upper bodies. Both named sides must have positive volume.'
          : 'Split one direct XY extrusion at an X or Y coordinate into negative and positive bodies. Negative is the lower-coordinate side.'
        : example === 'intersection'
          ? 'Intersection keeps only the positive-volume overlap of two direct convex XY extrusions. Empty or touching-only results are refused.'
          : example === 'two-chamfer'
            ? 'Chamfer opposite top edges of a rectangular part in sequence. The second edge belongs to the first result. frontDistance and backDistance are bevel distances; backY selects the second edge by its Y coordinate.'
            : 'Cut a through-slab from a part, then chamfer one supported edge. Both outside components remain named outputs.'}</p>
      {accepted && <Label><input type="checkbox" checked={replaceExample} disabled={busy}
        onChange={event => setReplaceExample(event.target.checked)} /> Replace accepted model and discard its history and pending dimensions</Label>}
      <div><Button disabled={busy || (!!accepted && !replaceExample)} onClick={() => action(async s => {
        fileReadEpoch.current++; // Supersede pending file reads before replacing the accepted example.
        await s.example(example, example === 'horizontal-split' || example === 'chamfer-split' ? splitAxis : undefined); if (!s.getSnapshot().error) setReplaceExample(false);
      })}>Load example</Button></div>
    </details>;
  const viewportElement = <div ref={viewport} data-testid="modeling-viewport" className={workspace ? 'modeling-viewport-host' : undefined}
      style={workspace ? undefined : { position: 'relative', width: '100%', height: 400, marginTop: 16, background: '#06090d' }}
      onClick={event => {
        const element = viewport.current, display = displayRef.current;
        if (!element || !display || !snapshot?.accepted || busy || snapshot.preview?.status === 'ready') return;
        const rect = element.getBoundingClientRect(), size = display.dimensions(); if (!rect.width || !rect.height) return;
        const x = Math.min(size.width - 1, Math.max(0, Math.floor((event.clientX - rect.left) * size.width / rect.width)));
        const y = Math.min(size.height - 1, Math.max(0, size.height - 1 - Math.floor((event.clientY - rect.top) * size.height / rect.height)));
        action(s => s.pick(size.width, size.height, x, y, snapshot.generation));
      }} />;
  const exportPanel = accepted && (<fieldset disabled={busy || draft} style={{ marginTop: 16 }}>
        <legend>Export accepted geometry</legend>
        <Label htmlFor={`${id}-stl-output`}>STL output</Label>
        <select id={`${id}-stl-output`} value={stlOutput} disabled={busy || draft || accepted.source !== 'model'}
          onChange={event => { setStlOutput(event.target.value); setStlResult(null); }}>
          <option value="">Choose an accepted output</option>
          {accepted.outputs.map(output => <option key={output.name} value={output.name}
            disabled={accepted.source !== 'model' || (output.family !== undefined && output.family !== 'convex-planar')}>
            {output.name} · {accepted.source === 'legacy' ? 'legacy (unavailable)' : output.family ?? 'convex-planar'}
          </option>)}
        </select>
        <Button disabled={busy || draft || !canExportStl} onClick={() => void exportStl()}>
          {snapshot?.workerReady ? 'Download STL' : 'Recover accepted model and export STL'}
        </Button>
        {!snapshot?.workerReady && <p>The native worker is unavailable. This action rebuilds the accepted saved model, verifies matching source and summary, then exports the selected output. It does not change model history or the accepted display.</p>}
        <p>Choose the output independently of visible bodies or a selected face. Only primary convex outputs are supported. Apply or discard pending dimensions first. Export validates and encodes the accepted native body.</p>
        <p>Binary STL uses approximate Float32 facets and an mm convention (STL stores no unit). At most40 facets; no coordinate conversion. Save the model separately to retain editable intent. Manufacturing and slicer acceptance require separate checks.</p>
        {stlResult && <p role="status">{stlResult.outputName}.stl · {stlResult.byteLength} bytes · {stlResult.triangleCount} facets · maximum vertex displacement {stlResult.maximumVertexDisplacementMM} mm. Browser download requested.</p>}
      </fieldset>);
  const visibilityPanel = accepted && <><p>Named output bodies · trimmed native triangles · 1 scene unit = 1 mm · approximate face selection</p>
      {bodyView && <fieldset disabled={busy}>
        <legend>Visible output body</legend>
        <Label htmlFor={`${id}-visible-output`}>Choose one output to inspect</Label>
        <select id={`${id}-visible-output`} value={bodyView.selectedOutput} disabled={busy}
          onChange={event => action(s => s.viewOutput(event.target.value, snapshot!.generation))}>
          {accepted.outputs.map(output => <option key={output.name} value={output.name}>{output.name} · {output.family}</option>)}
        </select>
        <p role="status">Visible: {bodyView.selectedOutput} · {accepted.outputs.find(output => output.name === bodyView.selectedOutput)?.family}. Other outputs are hidden, not removed.</p>
        <p>Changing this view preserves saved outputs, pending dimensions and model history. Opening a file selects its last saved output. The mounting-plate, union and pocket presets explicitly select plate, bracket and part respectively. The chooser changes only the view, not authored outputs.</p>
      </fieldset>}</>;
  const limitsPanel = accepted && <>{(pocketSavedOutputs || topPocketDrivers) && <p>This preset file initially selects tool when opened, because tool is the last canonical saved output. Choose part to inspect the pocket; hidden plate and tool outputs remain saved.</p>}
      {constrainedPlateDrivers && <p>Width and profile height drive the constrained sketch. Extrusion thickness remains 8 mm; the fixed lower corner stays at Y=0.</p>}
      {topPocketDrivers && <p>Depth is measured downward from top Z=8. The positive-height cutter starts at Z=8 − depth; its fixed X extent is 8..24 mm. Native qualification may refuse dimensions that look plausible.</p>}
      {differenceModel && !composedModel && <p>The difference retains one restricted integer-cell body and exact integer volume. Complete preview requires at most64 panels (native limit72). Empty or multiple-body results are refused. Tool-contributed cavity walls retain inward relative orientation and original operand lineage; no mesh arrays are repaired.</p>}
      {composedModel && <p>The eight-step union → slot workflow retains exact integer-cell volume and both original-box and immediate-parent panel lineage. This preview supports a common Z=0..8 slab, at most5 X/Y coordinate planes,16 cells and64 complete panels per body. Empty or disconnected results are refused. Opening selects the last saved output; the preset explicitly selects slotted.</p>}
      {unionModel && <p>The union has restricted integer-cell material and exact integer volume. Its complete source-qualified panel preview is limited to64 panels (the native provider permits72). Face picks identify generated panels and their contributing native operand faces; they do not preserve the original convex face IDs.</p>}
      {circleModel && <p>The circle extrusion has a qualified stored-rational boundary. Its three-face preview is sampled with faceted wall normals; the preview retains its original uncertified flags. Certified volume is unavailable.</p>}
      {roundPostDrivers && <p>Diameter is the numeric driver for radius = diameter × 0.5 in this preset.</p>}
      {holeModel && <p>The plate has a qualified stored-rational genus-one boundary. Its seven-face preview is sampled and faceted; the preview itself retains uncertified geometry/topology flags. Certified volume is unavailable.</p>}
    {accepted.source === 'legacy' && <p>This file uses its original compatibility reader. Saving preserves its authored format and modeling semantics.</p>}
  </>;
  const finishesPanel = configurableFinishes && <fieldset disabled={busy || draft}>
        <legend>Rail finishes</legend>
        <p>Front: {accepted.suppression!.frontFinish ? 'off' : 'on'} · Back: {accepted.suppression!.backFinish ? 'off' : 'on'}</p>
        {draft && <p>Apply or discard pending dimensions before configuring finishes.</p>}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[['Both on', false, false], ['Front only', false, true], ['Back only', true, false], ['Both off', true, true]].map(([label, front, back]) =>
            <Button key={String(label)} disabled={busy || draft} aria-pressed={accepted.suppression!.frontFinish === front && accepted.suppression!.backFinish === back}
              onClick={() => action(s => s.configureFinishes({ frontFinish: front as boolean, backFinish: back as boolean }))}>{label}</Button>)}
        </div>
        <p>Disabled chamfers still validate. Invalid edge selection or geometry is refused without replacing this model.</p>
      </fieldset>;
  const circularCreation = newPartTarget?.kind === 'circle';
  const creationPanel = circularCreation ? 'new-circular-part' : 'new-part';
  const creationName = circularCreation ? 'New circular part' : 'New rectangular part';
  let newPartSource = '', newPartValidation = '';
  try { newPartSource = circularCreation ? createCircularPartSource(circularPartInput) : createRectangularPartSource(newPartInput); } catch (cause) { newPartValidation = cause instanceof Error ? cause.message : String(cause); }
  const newPartCurrent = newPartCommandCurrent();
  const newPartPanel = <div>
    <p>{circularCreation ? 'Create your own XY circle centered at [0,0] and extrusion from Z=0. Diameter and thickness become named editable model parameters.' : 'Create your own origin-zero rectangular sketch and extrusion. All three sizes become named editable model parameters.'}</p>
    <p>These are temporary creation settings. The accepted viewport stays unchanged until Create succeeds.</p>
    {(circularCreation ? [['diameter', 'Diameter'], ['thickness', 'Thickness']] as const : [['width', 'Width'], ['height', 'Profile height'], ['thickness', 'Thickness']] as const).map(([name, label]) => <div key={name} style={{ marginBottom: 16 }}>
      <Label htmlFor={`${id}-${creationPanel}-${name}`}>{label} (mm)</Label>
      <Input id={`${id}-${creationPanel}-${name}`} inputMode="decimal" maxLength={64} value={circularCreation ? circularPartInput[name as keyof CircularPartInput] : newPartInput[name as keyof RectangularPartInput]} disabled={busy || !newPartCurrent}
        onChange={event => {
          if (workspacePanel !== creationPanel || !newPartCommandCurrent() || controller.current?.getSnapshot().busy) return;
          const value = event.target.value;
          if (circularCreation) setCircularPartInput(values => ({ ...values, [name]: value }));
          else setNewPartInput(values => ({ ...values, [name]: value }));
        }}
        onKeyDown={event => {
          if (!newPartCommandLive() || event.repeat || event.nativeEvent.isComposing || event.keyCode === 229
            || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
          if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); cancelNewPart(); }
          else if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); createNewPart(); }
        }} />
    </div>)}
    {newPartValidation && <p role="status">{newPartValidation}</p>}
    <p>The native loader may refuse unsupported precision or geometry. A refusal keeps the current document and history.</p>
    {circularCreation && <p>Diameter: 0.002–10000 mm; thickness: 0.001–10000 mm. Native and display limits can be tighter. Circular volume, mass and STL are unavailable; this command creates a blank without a bore, threads or a hole pattern.</p>}
    {accepted && <p><strong>Replace current model:</strong> creating this part replaces the accepted document and resets its Undo history. Download the accepted model first if you need to keep it. No file is saved automatically.</p>}
    {draft && <p role="status">Existing model dimensions are pending. Apply or cancel them in their own editor before replacing the document. These creation settings do not apply or discard those drafts.</p>}
    {!newPartCurrent && <p role="status">The target document changed. Reopen {creationName} before replacing it.</p>}
    {draft && <Button variant="outline" disabled={busy} onClick={() => { if (newPartRenderCurrent()) openWorkspacePanel('dimensions'); }}>Review pending dimensions</Button>}
    <details><summary>Authored model source</summary><pre>{newPartSource || 'Enter valid creation dimensions.'}</pre></details>
  </div>;
  let structureValidation = '', structureExpected: ReturnType<typeof buildModelingStructure> | null = null;
  try {
    if (structureCommandCurrent() && accepted && snapshot?.authoredText) structureExpected = buildModelingStructure(snapshot.authoredText, accepted, structureCommand());
  } catch (cause) { structureValidation = cause instanceof Error ? cause.message : String(cause); }
  const placement = structureCapabilities.placementAuthored;
  const placementReadout = placement && <section data-testid="modeling-accepted-placement">
    <h3>Accepted authored rail coordinates</h3>
    <p>{placement.rotation ? `World-origin ${placement.rotation.axis.toUpperCase()} rotation ${placement.rotation.angleDegrees}°` : 'Original rail orientation'} · native XYZ offsets [{placement.offset.join(', ')}] mm</p>
    <p>Authored rail envelope: [{placement.envelope.min.join(', ')}] to [{placement.envelope.max.join(', ')}] mm</p>
    <p>Derived from accepted source only, not certified native bounds. Preview does not change this readout. The camera auto-refits each result; Move may appear stationary. Six-node placement is terminal; edit existing placement dimensions instead of appending another transform.</p>
  </section>;
  const structurePanel = <div>
    <p>Preview evaluates a complete candidate with the native model loader. Apply adds one editable history step; Cancel retains the accepted part.</p>
    {structureTarget && <><h2>{structureTarget.command.kind === 'rotate-part' ? 'Rotate part' : structureTarget.command.kind === 'move-part' ? 'Move part' : structureTarget.command.kind === 'chamfer' ? structureTarget.command.target.node === 2 ? 'Chamfer opposite top edge' : 'Chamfer front top edge' : structureTarget.command.kind === 'cut-pocket' ? 'Cut rectangular pocket' : structureTarget.command.kind === 'add-hole' ? 'Add through-hole' : structureTarget.command.kind === 'add-arm' ? 'Add rectangular arm' : structureTarget.command.kind === 'union' ? 'Union bodies' : 'Cut rectangular through-slot'}</h2>
      <p>Bound accepted outputs: {(structureTarget.command.kind === 'union' ? structureTarget.command.targets : [structureTarget.command.target]).map(target => `${target.name} · ${target.solidId} · feature ${target.node + 1}`).join('; ')}</p>
      {structureTarget.command.kind === 'rotate-part'
        ? <p>Rotate the selected finished two-bevel rail around the native XYZ world origin. Only cardinal angles are supported. The sole part output changes to the rotated result; original features remain in source and Undo history. Apply requires a ready preview.</p>
        : structureTarget.command.kind === 'move-part'
        ? <p>Place the selected rotated rail using native model XYZ offsets in mm, after rotation. This is one part, not a copy or assembly. Apply adds placementX, placementY and placementZ; edit those named drivers later. Native exact representability can refuse decimal offsets without rounding. The camera refits the part, so translation may appear stationary; inspect the accepted authored coordinates below.</p>
        : structureTarget.command.kind === 'chamfer'
        ? structureTarget.command.target.node === 2
          ? <p>Bevel the opposite model-coordinate X-parallel edge at Y=the original profile maximum, Z=max of the selected first chamfer result. The Y target follows the original sketch expression, not a camera direction. Both bevel distances must stay below thickness and their sum below the profile Y span; native exact geometry may still refuse. Apply retains the first bevelDistance and adds independent backBevelDistance. Use Edit model dimensions to edit either driver; shared global dimensions can invalidate either edge or bevel.</p>
          : <p>Bevel the model-coordinate X-parallel edge at Y=0, Z=max of the selected rectangular extrusion. This is not a camera-relative target. Decimal distance must be positive and smaller than both the profile Y span and thickness; native exact geometry may still refuse it. The original features remain in source and Undo history. After Apply, select Chamfer 01 and use Edit model dimensions for bevelDistance or Chamfer opposite top edge; shared global edits can invalidate the edge or bevel.</p>
        : structureTarget.command.kind === 'cut-pocket'
        ? <p>Cut an open-top rectangular pocket into the selected part. The tool and subtraction are one atomic operation; the original extrusion stays in the source and Undo history. Wall and floor thickness must initially be positive integers. Edit pocketWall and pocketFloor later with Model dimensions; global edits can remove the floor or walls. Native geometry remains authoritative. Orthogonal-cell STL is unavailable, and the current flat-color view may not visibly distinguish cavity depth.</p>
        : structureTarget.command.kind === 'add-hole'
        ? <p>One through-hole in the selected origin-zero rectangular plate. The part output becomes the holed result; the original extrusion remains in the source and Undo history. Center coordinates and radius may be decimal. Native volume and mass are unavailable, and this hole family cannot export STL. Change holeRadius later with Edit model dimensions.</p>
        : structureTarget.command.kind === 'union'
        ? <p>Union consumes these two output names into part. Their original feature nodes remain authored and recoverable with Undo.</p>
        : structureTarget.command.kind === 'cut-slot'
          ? <p>The slot tool and subtraction are one atomic operation. Only the existing omitted-start Z=0..8 mm slab is supported. The current output becomes part; this orthogonal result cannot export STL.</p>
          : <p>The arm shares the base extrusion's thickness term. Editing a shared named thickness later changes both bodies. Union can support other integer thicknesses, but the through-slot command requires exactly 8 mm.</p>}
      {structureTarget.command.kind === 'rotate-part' && (['axis', 'angleDegrees'] as const).map(name => <div key={name}>
        <Label htmlFor={`${id}-structure-${name}`}>{name === 'axis' ? 'World axis' : 'Cardinal angle (degrees)'}</Label>
        <select id={`${id}-structure-${name}`} value={structureInput[name]} disabled={busy || !structureCommandCurrent()}
          onChange={event => { if (!structureRenderCurrent() || controller.current?.getSnapshot().busy) return; invalidateCommandPreview(); structureFieldVersion.current++; setStructureInput(values => ({ ...values, [name]: event.target.value })); }}
          onKeyDown={event => {
            if (!structureRenderCurrent() || event.repeat || event.nativeEvent.isComposing || event.keyCode === 229 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
            if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); cancelStructure(); }
            else if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); previewStructure(); }
          }}>
          {(name === 'axis' ? ['x', 'y', 'z'] : ['90', '-90', '180', '-180', '270', '-270']).map(value => <option key={value} value={value}>{name === 'axis' ? value.toUpperCase() : Number(value) > 0 ? '+' + value : value}</option>)}
        </select>
      </div>)}
      {structureTarget.command.kind !== 'union' && structureTarget.command.kind !== 'rotate-part' && (structureTarget.command.kind === 'move-part' ? ['x', 'y', 'z'] as const : structureTarget.command.kind === 'chamfer' ? ['distance'] as const : structureTarget.command.kind === 'cut-pocket' ? ['wall', 'floor'] as const : structureTarget.command.kind === 'add-hole' ? ['x', 'y', 'radius'] as const : ['x', 'y', 'width', 'height'] as const).map(name => <div key={name}>
        <Label htmlFor={`${id}-structure-${name}`}>{structureTarget.command.kind === 'move-part' ? `Native ${name.toUpperCase()} offset` : name === 'distance' ? 'Bevel distance' : name === 'wall' ? 'Wall thickness' : name === 'floor' ? 'Floor thickness' : name === 'radius' ? 'Radius' : name === 'x' ? structureTarget.command.kind === 'add-hole' ? 'Center X' : 'Min X' : name === 'y' ? structureTarget.command.kind === 'add-hole' ? 'Center Y' : 'Min Y' : name === 'width' ? 'Width' : 'Profile height'} (mm)</Label>
        <Input id={`${id}-structure-${name}`} inputMode="decimal" maxLength={64} value={structureInput[name]} disabled={busy || !structureCommandCurrent()}
          onChange={event => {
            if (!structureRenderCurrent() || controller.current?.getSnapshot().busy) return;
            invalidateCommandPreview(); structureFieldVersion.current++;
            setStructureInput(values => ({ ...values, [name]: event.target.value }));
          }} onKeyDown={event => {
            if (!structureRenderCurrent() || event.repeat || event.nativeEvent.isComposing || event.keyCode === 229 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
            if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); cancelStructure(); }
            else if (event.key === 'Enter' && (structureTarget.command.kind === 'chamfer' || structureTarget.command.kind === 'move-part')) { event.preventDefault(); event.stopPropagation(); previewStructure(); }
          }} />
      </div>)}
    </>}
    {!structureCommandCurrent() && <p role="status">The accepted target changed. Reopen the structural command for the current part.</p>}
    {draft && <p role="status">Model dimensions are pending. Review and apply or cancel them before structural editing; these temporary options do not discard them.</p>}
    {draft && <Button disabled={busy} onClick={() => { if (structureRenderCurrent()) openWorkspacePanel('dimensions'); }}>Review pending dimensions</Button>}
    {structureValidation && <p role="status">{structureValidation}</p>}
    <p>{structureTarget?.command.kind === 'rotate-part' || structureTarget?.command.kind === 'move-part' ? 'Cardinal rotation and finite native XYZ offsets' : structureTarget?.command.kind === 'chamfer' ? 'Finite decimal bevel dimensions' : structureTarget?.command.kind === 'add-hole' ? 'Contained hole dimensions' : 'Integer dimensions'} may still be refused by native geometry or complete preview limits. Accepted source and history remain unchanged on refusal.</p>
    {placementReadout}
    <details><summary>Candidate authored source</summary><pre>{structureExpected?.text ?? 'Enter a supported structural command.'}</pre></details>
  </div>;
  const dimensionsPanel = accepted && (<div><h2>Named dimensions</h2>{pocketNotice && <p data-testid="modeling-pocket-warning">{pocketNotice}</p>}{constrainedPlateDrivers ? (['width', 'height'] as const).map(name => dimensionInput([name, accepted.parameters[name]])) : roundPostDrivers ? <>
          {(['diameter', 'height'] as const).map(name => dimensionInput([name, accepted.parameters[name]]))}
          <details><summary>Optional center coordinates</summary>
            {(['centerX', 'centerY'] as const).map(name => dimensionInput([name, accepted.parameters[name]]))}
          </details>
        </> : Object.entries(accepted.parameters).map(entry => dimensionInput(entry))}</div>);
  const extrusionPanel = accepted && <div>
    {pinnedExtrusion ? <>
      <h2>{pinnedExtrusion.label}</h2>
      <p>Editing this pinned feature. Browser selection does not retarget these options.</p>
      <p>Changes update each named model parameter wherever it is used, including other fields and dependent features.</p>
      {pinnedExtrusion.fields.filter(field => field.kind !== 'parameter').map(field => <p key={field.label}>
        <strong>{field.label}: </strong>{field.kind === 'literal'
          ? `${Object.is(field.value, -0) ? '-0' : field.value} mm · read-only authored value`
          : 'Derived expression · read-only; use Edit model dimensions'}
      </p>)}
      {pinnedExtrusion.parameters.map(name => dimensionInput([name, accepted.parameters[name]],
        `${pinnedExtrusion.fields.filter(field => field.kind === 'parameter' && field.parameter === name).map(field => field.label).join(' / ')} · ${name}`))}
      {!pinnedExtrusion.parameters.length && <p>No editable extrusion drivers. Literal values and expressions cannot be rewritten here.</p>}
      {!currentExtrusion && <p role="status">Other model dimensions are pending. This command cannot apply or discard them. Review model dimensions; Cancel only closes these options.</p>}
    </> : <p role="status">This extrusion command is stale because the accepted model or output view changed. Reopen Edit extrusion for the current selection. Pending dimensions are retained.</p>}
    <Button variant="outline" disabled={busy} onClick={() => openWorkspacePanel('dimensions')}>Review model dimensions</Button>
  </div>;
  const sketchPanel = accepted && <div>
    {pinnedSketch ? <>
      <h2>{pinnedSketch.label} · rectangle</h2>
      <p>Editing this pinned sketch. Browser selection does not retarget these options.</p>
      <p>Min and Max are signed profile coordinates in mm, not width or height. The native model validates their ordering and supported bounds.</p>
      <p>Changes update each named model parameter wherever it is used, including other coordinates and dependent features.</p>
      {pinnedSketch.fields.filter(field => field.kind !== 'parameter').map(field => <p key={field.label}>
        <strong>{field.label}: </strong>{field.kind === 'literal'
          ? `${Object.is(field.value, -0) ? '-0' : field.value} mm · read-only authored value`
          : 'Derived expression · read-only; use Edit model dimensions'}
      </p>)}
      {pinnedSketch.parameters.map(name => dimensionInput([name, accepted.parameters[name]],
        `${pinnedSketch.fields.filter(field => field.kind === 'parameter' && field.parameter === name).map(field => field.label).join(' / ')} · ${name}`, 'sketch'))}
      {!pinnedSketch.parameters.length && <p>No editable sketch drivers. Literal coordinates and expressions cannot be rewritten here.</p>}
      {!currentSketch && <p role="status">Other model dimensions are pending. This command cannot apply or discard them. Review model dimensions; Cancel only closes these options.</p>}
    </> : <p role="status">This sketch command is stale because the accepted model or output view changed. Reopen Edit sketch dimensions for the current selection. Pending dimensions are retained.</p>}
    <Button variant="outline" disabled={busy} onClick={() => { if (sketchRenderCurrent()) openWorkspacePanel('dimensions'); }}>Review model dimensions</Button>
  </div>;
  const inspectionPanel = accepted && <>{placementReadout}{pocketNotice && <p>{pocketNotice}</p>}{snapshot?.selection !== null && snapshot?.selection !== undefined && accepted.features[snapshot.selection] && <>
    <h2>Selected feature</h2><p>{accepted.features[snapshot.selection].kind} · step {snapshot.selection + 1}
      {accepted.features[snapshot.selection].name ? ` · ${accepted.features[snapshot.selection].name}` : ''}</p>
    <p>{accepted.features[snapshot.selection].dependencies.length
      ? `Uses earlier steps ${accepted.features[snapshot.selection].dependencies.map(index => index + 1).join(', ')}` : 'Original sketch intent'}</p>
  </>}<h2>Output bodies</h2><dl>{accepted.outputs.map(output => <div key={output.name}><dt>{output.name}</dt>
        <dd>{output.family === 'stored-rational-plate-hole' || output.family === 'stored-rational-circle-prism' ? 'Certified volume unavailable' : output.volumeMM3 ? `${output.volumeMM3.numerator} / ${output.volumeMM3.denominator} mm³` : 'Empty'}</dd></div>)}</dl>
      {snapshot?.faceSelection && <details><summary>Selected {snapshot.faceSelection.role} face</summary>
        {'family' in snapshot.faceSelection && snapshot.faceSelection.family === 'stored-rational-circle-prism'
          ? <p>Native circle body {snapshot.faceSelection.solidId}; face {snapshot.faceSelection.provenance.faceId}; surface {snapshot.faceSelection.provenance.surfaceId}; role {snapshot.faceSelection.provenance.role}. This approximate sampled-triangle hit retains the original cap/wall range and closed-ring/seam lineage. It is not a certified measurement.</p>
          : 'family' in snapshot.faceSelection && snapshot.faceSelection.family === 'orthogonal-cell'
          ? <p>Native orthogonal body {snapshot.faceSelection.solidId}; generated panel {snapshot.faceSelection.provenance.id}; source {snapshot.faceSelection.provenance.query.sourceId}, model {snapshot.faceSelection.provenance.query.modelId}, surface {snapshot.faceSelection.provenance.query.surfaceId}. Contributing operand faces: {snapshot.faceSelection.provenance.lineage.map(link => `${'originalIndex' in link ? `original ${link.originalIndex}` : link.operand}: ${link.sourceId}/${link.globalFaceId} (${link.localFaceId}, ${link.surfaceId})`).join('; ')}. {'parentPanels' in snapshot.faceSelection.provenance && <>Immediate parent panels: {snapshot.faceSelection.provenance.parentPanels.map(link => `${link.evaluationId}/${link.panelId} (${link.sourceId})`).join('; ') || 'none: third-box wall'}. </>}This is an approximate triangle hit with copied native lineage.</p>
          : 'reference' in snapshot.faceSelection
          ? <p>Native body {snapshot.faceSelection.solidId}; face {snapshot.faceSelection.reference.nativeFaceId}; surface {snapshot.faceSelection.provenance.nativeSurfaceId}. Loops: {snapshot.faceSelection.provenance.nativeLoopIds.join(', ')}. Edges: {snapshot.faceSelection.provenance.nativeEdgeIds.join(', ')}. This is an approximate sampled-triangle hit with original native face provenance, not a Solid certificate or a new BRep edge.</p>
          : <p>Native Solid {snapshot.faceSelection.solidId}; face {snapshot.faceSelection.face.sourceId}/{snapshot.faceSelection.face.faceId}. Fan diagonals are display-only, not BRep edges. Selection belongs to this accepted model.</p>}
      </details>}
      <p>History {snapshot!.history.index + 1} / {snapshot!.history.count}. Unsupported geometry or ambiguous edge selection is refused; the accepted model stays intact.</p></>;
  const fileSession = controller.current, fileCommandEpoch = workspaceCommandEpoch.current, fileStateEpoch = fileActionEpoch.current;
  const currentFileSnapshot = () => {
    if (!snapshot || !fileSession || controller.current !== fileSession || fileActionEpoch.current !== fileStateEpoch
      || (workspace && (workspacePanel !== 'files' || workspaceCommandEpoch.current !== fileCommandEpoch))) return null;
    const current = fileSession.getSnapshot();
    if (current.busy || current.disposed || !current.authoredText || current.generation !== snapshot.generation
      || current.authoredText !== snapshot.authoredText
      || Object.keys(current.drafts).length !== Object.keys(snapshot.drafts).length
      || Object.entries(snapshot.drafts).some(([name, raw]) => current.drafts[name] !== raw)) return null;
    return current;
  };
  const downloadAcceptedModel = () => {
    const current = currentFileSnapshot();
    if (!current) return;
    setError(null);
    let anchor: HTMLAnchorElement | undefined, url: string | undefined, requested = false, failure = '';
    try {
      anchor = document.createElement('a');
      url = URL.createObjectURL(new Blob([current.authoredText!], { type: 'application/json' }));
      anchor.href = url; anchor.download = 'part.cad.json'; document.body.append(anchor);
      anchor.click(); requested = true;
    } catch (cause) { failure = `Could not request the accepted model download: ${String(cause)}`; }
    finally {
      const cleanupFailures: string[] = [];
      try { anchor?.remove(); } catch (cause) { cleanupFailures.push(String(cause)); }
      try { if (url !== undefined) URL.revokeObjectURL(url); } catch (cause) { cleanupFailures.push(String(cause)); }
      if (cleanupFailures.length) failure += `${failure ? ' ' : ''}${requested ? 'Download was requested, but' : 'Download'} cleanup failed: ${cleanupFailures.join('; ')}`;
    }
    // A browser request is not proof that a file was persisted. Never attach errors to a newer document.
    if (failure && currentFileSnapshot()) setError(failure);
  };
  const filesPanel = <details open={workspace || undefined} style={{ marginTop: 24 }}><summary>Save or open a model</summary>
      <p>Save authored dimensions and modeling intent. Native geometry and display caches are rebuilt on open. Supported old files are detected internally; unsupported formats are refused without conversion.</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input ref={fileInput} type="file" accept=".json,.cad.json,application/json" aria-label="Choose saved model file"
          style={{ display: 'none' }} onChange={event => {
            const file = event.target.files?.[0]; event.target.value = '';
            void stageModelFile(file);
          }} />
        <Button type="button" variant="outline" disabled={busy} onClick={() => fileInput.current?.click()}>Choose model file</Button>
        <Button disabled={busy || !snapshot?.authoredText} onClick={() => { fileReadEpoch.current++; setSource(snapshot!.authoredText!); setConfirmed(false); }}>Show saved model</Button>
        <Button disabled={busy || !snapshot?.authoredText} onClick={downloadAcceptedModel}>{draft ? 'Download accepted model' : 'Download model'}</Button>
      </div>
      <div data-testid="modeling-save-state">
        <p>{draft ? 'Pending dimensions are excluded from this download. Apply them first if you want an updated model file.' : 'Download contains the accepted authored model.'} Staged file text below is not included.</p>
        {draft && <table aria-label="Accepted and pending dimensions"><thead><tr><th>Dimension</th><th>Accepted (mm)</th><th>Pending input</th></tr></thead>
          <tbody>{Object.entries(snapshot!.drafts).map(([name, raw]) => <tr key={name}><th scope="row">{name}</th>
            <td>{Object.is(accepted?.parameters[name], -0) ? '-0' : String(accepted?.parameters[name] ?? '—')}</td><td>{raw}</td></tr>)}</tbody></table>}
        {draft && workspace && <Button variant="outline" disabled={busy} onClick={() => {
          if (currentFileSnapshot()) openWorkspacePanel('dimensions');
        }}>Review dimensions before saving</Button>}
      </div>
      <Label htmlFor={`${id}-model`}>Saved model data</Label>
      <textarea id={`${id}-model`} rows={12} spellCheck={false} disabled={busy} maxLength={262144}
        style={{ width: '100%', fontFamily: 'monospace' }} value={source} onChange={event => { fileReadEpoch.current++; setSource(event.target.value); setConfirmed(false); }} />
      <Label><input type="checkbox" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} /> Replace accepted model and discard its history and pending dimensions</Label>
      <div><Button disabled={busy || !source.trim() || (!!accepted && !confirmed)}
        onClick={() => { fileReadEpoch.current++; action(async s => { await s.open(source); setConfirmed(false); }); }}>Open saved model</Button></div>
      <p>Choose model file stages its UTF-8 text for inspection; it does not replace the accepted model. Review the contents and explicitly confirm Open. Invalid files still go through native validation on Open. Actual file-picker, browser and GPU acceptance require separate device verification.</p>
    </details>;
  if (workspace) return <ModelingWorkspace snapshot={snapshot} viewport={viewportElement} panel={workspacePanel} error={error}
    onView={changeView} modelNotice={pocketNotice ? 'Pocket edits can remove walls or floor · review Model dimensions' : undefined}
    panels={{ 'rotate-part': workspacePanel === 'rotate-part' ? structurePanel : null, 'move-part': workspacePanel === 'move-part' ? structurePanel : null, chamfer: workspacePanel === 'chamfer' ? structurePanel : null, 'cut-pocket': workspacePanel === 'cut-pocket' ? structurePanel : null, 'add-hole': workspacePanel === 'add-hole' ? structurePanel : null, 'add-arm': workspacePanel === 'add-arm' ? structurePanel : null, union: workspacePanel === 'union' ? structurePanel : null, 'cut-slot': workspacePanel === 'cut-slot' ? structurePanel : null, 'new-part': circularCreation ? null : newPartPanel, 'new-circular-part': circularCreation ? newPartPanel : null, examples: examplesPanel, dimensions: dimensionsPanel, extrusion: extrusionPanel, sketch: sketchPanel, outputs: <>{visibilityPanel}{exportPanel}</>, files: filesPanel,
      inspect: inspectionPanel, limits: limitsPanel, configuration: finishesPanel }}
    dimensionLabel={constrainedPlateDrivers ? 'Edit dimensions' : 'Edit model dimensions'}
    canEditDimensions={!!accepted && (!constrainedPlateDrivers || snapshot?.selection === null || accepted.features[snapshot?.selection ?? -1]?.kind === 'sketch')}
    canEditSketch={!!selectedSketch} canApplySketch={!!currentSketch?.parameters.length}
    canEditExtrusion={!!selectedExtrusion} canApplyExtrusion={!!currentExtrusion?.parameters.length}
    configurableFinishes={!!configurableFinishes} onPanel={openWorkspacePanel}
    onSelect={index => {
      if ((workspacePanel === 'add-hole' || workspacePanel === 'cut-pocket' || workspacePanel === 'chamfer' || workspacePanel === 'rotate-part' || workspacePanel === 'move-part') && !structureRenderLive()) return;
      action(session => {
        if ((workspacePanel === 'add-hole' || workspacePanel === 'cut-pocket' || workspacePanel === 'chamfer' || workspacePanel === 'rotate-part' || workspacePanel === 'move-part') && (structureTarget?.command.kind === 'add-hole' || structureTarget?.command.kind === 'cut-pocket' || structureTarget?.command.kind === 'chamfer' || structureTarget?.command.kind === 'rotate-part' || structureTarget?.command.kind === 'move-part') && index !== structureTarget.command.target.node) openWorkspacePanel(null);
        session.select(index, session.getSnapshot().generation);
      });
    }}
    onApply={applyDimensions} onPreview={previewDimensions}
    previewContext={workspacePanel === 'extrusion' ? pinnedExtrusion?.label ?? 'Extrusion command' : workspacePanel === 'sketch' ? pinnedSketch?.label ?? 'Sketch command' : 'Model dimensions'}
    onCancelDimensions={cancelDimensions} onCancelNewPart={cancelNewPart} onCreatePart={createNewPart}
    canRotatePart={!!structureCapabilities.rotatePart && snapshot?.selection === structureCapabilities.rotatePart.node} canMovePart={!!structureCapabilities.movePart && snapshot?.selection === structureCapabilities.movePart.node}
    canChamfer={!!structureCapabilities.chamfer && snapshot?.selection === structureCapabilities.chamfer.node} canCutPocket={!!structureCapabilities.cutPocket && snapshot?.selection === structureCapabilities.cutPocket.node} canAddHole={!!structureCapabilities.addHole && snapshot?.selection === structureCapabilities.addHole.node} canAddArm={!!structureCapabilities.addArm} canUnion={!!structureCapabilities.union} canCutSlot={!!structureCapabilities.cutSlot}
    structureReason={`${structureCapabilities.reason} ${structureCapabilities.holeReason} ${structureCapabilities.pocketReason} ${structureCapabilities.chamferReason} ${structureCapabilities.placementReason}`} canPreviewStructure={structureCommandCurrent() && !draft && !!structureExpected}
    canApplyStructure={structureCommandCurrent() && !draft && !!structureExpected && snapshot?.preview?.operation === 'structure' && snapshot.preview.status === 'ready'}
    onPreviewStructure={previewStructure} onApplyStructure={applyStructure} onCancelStructure={cancelStructure}
    canCreatePart={!draft && newPartCurrent && !newPartValidation}
    onCancelComputation={() => { workspaceCommandEpoch.current++; newPartOperationEpoch.current++; action(session => session.cancel()); }}
    onUndo={() => action(session => session.undo())} onRedo={() => action(session => session.redo())}
    onRetry={() => { fileReadEpoch.current++; action(session => initialAuthoredText === undefined ? session.example() : session.open(initialAuthoredText)); }} />;
  return <section className="barocss-cad-editor" aria-label="CAD model editor" style={{ padding: 24, overflow: 'auto', height: '100%' }}>
    <header><h1>Model a part</h1><p>Sketch a polygon or circle → extrude → supported cut, intersect, split, chamfer, fuse, pocket or hole · named dimensions in mm</p></header>
    <p role="status" aria-live="polite">{busy ? 'Computing native geometry in a dedicated worker… You can cancel.' : accepted ? draft ? 'Dimension changes pending' : 'Accepted model' : 'No accepted model'}</p>
    {(error || snapshot?.error) && <p role="alert">{error ?? snapshot?.error}</p>}
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {accepted?.source === 'model' && <Button disabled={busy || !draft} onClick={previewDimensions}>{snapshot?.workerReady ? 'Preview dimensions' : 'Recover accepted model and preview'}</Button>}
      <Button disabled={busy || !draft} onClick={() => action(s => s.apply())}>Apply dimensions</Button>
      <Button disabled={busy || !draft} onClick={() => action(s => s.discard())}>Discard draft</Button>
      <Button disabled={busy || draft || !snapshot?.history.canUndo} onClick={() => action(s => s.undo())}>Undo</Button>
      <Button disabled={busy || draft || !snapshot?.history.canRedo} onClick={() => action(s => s.redo())}>Redo</Button>
      <Button disabled={!busy} onClick={() => action(s => s.cancel())}>Cancel computation</Button>
      <span style={{ alignSelf: 'center', fontSize: 12, opacity: 0.75 }}>In a dimension field: Enter to apply · Esc to discard</span>
      {!accepted && !busy && <Button onClick={() => { fileReadEpoch.current++; action(s => initialAuthoredText === undefined ? s.example() : s.open(initialAuthoredText)); }}>Retry model</Button>}
    </div>
    {snapshot?.preview && <p role="status">{snapshot.preview.status === 'ready' ? 'Unapplied draft preview. Apply or Cancel before selecting a face.' : snapshot.preview.status === 'unchanged' ? 'No geometric changes. Apply clears equivalent input without a history entry.' : snapshot.preview.status === 'computing' ? 'Preparing draft preview… Accepted model retained.' : `Preview refused: ${snapshot.preview.diagnostic?.message ?? snapshot.error}`}</p>}
    {accepted?.source === 'model' && !snapshot?.workerReady && <p>Recovering before preview reconstructs the accepted model, then evaluates pending dimensions.</p>}
    {accepted?.source === 'legacy' && <p>Legacy files support Apply; reversible preview currently requires a primary model.</p>}
    {examplesPanel}
    {viewportElement}
    {accepted && <>
      {exportPanel}
      {visibilityPanel}
      {limitsPanel}
      {finishesPanel}
      {accepted.source === 'legacy' && <p>This file uses its original compatibility reader. Saving preserves its authored format and modeling semantics.</p>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 24 }}>
        {dimensionsPanel}
        <aside><h2>Feature sequence</h2><ol>{accepted.features.map(feature => <li key={feature.index}>
          <Button variant="ghost" disabled={busy} aria-pressed={snapshot?.selection === feature.index}
            onClick={() => action(s => s.select(feature.index, snapshot!.generation))}>{feature.kind}{feature.name === undefined ? '' : ` · ${feature.name} (${feature.suppressed ? 'off' : 'on'})`}</Button>
          {snapshot?.selection === feature.index && <p>{feature.dependencies.length ? `Uses earlier steps ${feature.dependencies.map(i => i + 1).join(', ')}` : 'Original sketch intent'}</p>}
        </li>)}</ol></aside>
      </div>
      {inspectionPanel}
    </>}
    {filesPanel}
  </section>;
}
