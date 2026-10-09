import { useEffect, useId, useRef, useState } from 'react';
import { mountBooleanShellScene, validateMeshCamera } from '@barocss/gpu';
import type { BooleanShellResourceCounts, BooleanShellSceneInputV0, BooleanShellSceneOptions,
  BooleanShellSceneRenderer, BooleanShellLeafRef, MeshCamera } from '@barocss/gpu';
import type { CadEditorFeatureDisplay, CadEditorFeatureParameterDraft,
  CadEditorFeatureSession, CadEditorFeatureSnapshot } from '../feature-types.js';
import { CadEditorError } from '../types.js';
import { cn } from '../lib/utils.js';
import { Button } from './ui/button.js';
import { Input } from './ui/input.js';
import { Label } from './ui/label.js';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog.js';
import { useCadEditorFeatureSnapshot } from './use-feature-session.js';

export interface CadEditorFeatureDisplayReceipt {
  status: 'ready' | 'disposed';
  binding: CadEditorFeatureDisplay['binding'];
  selection: CadEditorFeatureDisplay['selection'];
  displays: CadEditorFeatureDisplay[];
  qualifiedOutputs: { binding: CadEditorFeatureDisplay['binding']; selection: CadEditorFeatureDisplay['selection'];
    ref: BooleanShellLeafRef; empty: boolean }[];
  displayGeneration: number;
  scene: BooleanShellSceneInputV0;
  graphId: string; graphRevision: number; featureId: string; outputSlotId: string;
  pixelHash: string; nonBackgroundPixels: number; pixelCount: number;
  width: number; height: number; backgroundRGB: [number, number, number]; readIndex: number;
  camera: MeshCamera; options: BooleanShellSceneOptions;
  resourceCounts: BooleanShellResourceCounts;
  lifecycle: { mounts: number; disposals: number };
  empty: boolean;
}

export interface CadEditorFeatureProps {
  session: CadEditorFeatureSession;
  displayOptions?: BooleanShellSceneOptions;
  onError?: (error: CadEditorError) => void;
  onAccepted?: (snapshot: CadEditorFeatureSnapshot) => void;
  onDisplay?: (receipt: CadEditorFeatureDisplayReceipt) => void;
  readRequest?: number;
  fitRequest?: number;
  /** Frame only the displayed nonempty selected extrusion; this does not change native geometry. */
  fitSelectedRequest?: number;
  className?: string;
}

const DEFAULT_OPTIONS: BooleanShellSceneOptions = {
  mmToSceneUnit: 0.01, translate: [0, 0, 0], background: [0.07, 0.08, 0.10],
  camera: { eye: [1.8, 1.5, 2.8], target: [0, 0, 0], up: [0, 1, 0],
    fovYDegrees: 45, near: 0.001, far: 100 },
};

function numberText(value: number) { return Object.is(value, -0) ? '-0' : String(value); }

function displayName(value: string): string {
  const names: Record<string, string> = { face_a_feature: 'Face A', face_b_feature: 'Face B',
    boolean_feature: 'Combine faces', extrusion_feature: 'Extrusion', base_height: 'Base height',
    design_height: 'Extrusion height', unused: 'Reference length', leaf_middle: 'Extrusion 2',
    leaf_high: 'Extrusion 3', leaf_top: 'Extrusion 4' };
  return names[value] ?? value.replace(/_/g, ' ').replace(/^./, first => first.toUpperCase());
}

function sameData(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object'
    || Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) return false;
  const keys = Reflect.ownKeys(a), others = Reflect.ownKeys(b);
  return keys.length === others.length && keys.every(key => others.includes(key)
    && sameData(Reflect.get(a, key), Reflect.get(b, key)));
}

function sceneFor(displays: CadEditorFeatureDisplay[], graph: CadEditorFeatureSnapshot['accepted']): BooleanShellSceneInputV0 {
  if (displays.length < 1 || displays.length > 4) throw new CadEditorError('DISPLAY', 'Choose 1–4 qualified extrusion outputs.');
  const leaves = graph.document.features.filter(feature => feature.kind === 'normal-extrusion');
  return { schema: 'barocss-gpu-boolean-shell-scene', version: 0, entries: displays.map(display => {
    const { binding, selection, nativeMesh } = display;
    const actualBinding = graph.report.qualifiedBindings.find(value => value.graphId === selection.graphId
      && value.revision === selection.revision && value.featureId === selection.featureId
      && value.outputSlotId === selection.outputSlotId);
    if (binding.kind !== 'normal-extrusion' || binding.graphId !== selection.graphId
      || binding.revision !== selection.revision || binding.featureId !== selection.featureId
      || binding.outputSlotId !== selection.outputSlotId || graph.document.id !== selection.graphId
      || graph.document.revision !== selection.revision || !sameData(actualBinding, binding)) {
      throw new CadEditorError('DISPLAY', 'The native feature mesh binding differs from its qualified selection.');
    }
    const index = leaves.findIndex(feature => feature.id === binding.featureId);
    if (index < 0) throw new CadEditorError('DISPLAY', 'The displayed output has no native extrusion feature.');
    return { ref: { graphId: binding.graphId, graphRevision: binding.revision,
      featureId: binding.featureId, outputSlotId: binding.outputSlotId },
      native: nativeMesh, color: [0.18, 0.58, 0.84] as [number, number, number], edges: { color: [0.62, 0.74, 0.83] as [number, number, number] } };
  }) };
}

function fittedOptions(renderer: BooleanShellSceneRenderer, aspect: number,
  bounds: { min: [number, number, number]; max: [number, number, number] } | null = renderer.bounds): BooleanShellSceneOptions {
  const options = renderer.options;
  if (!bounds) return options; // A real empty Boolean result is a valid background frame.
  const target = bounds.min.map((value, axis) => (value + bounds.max[axis]) / 2) as [number, number, number];
  const radius = Math.max(0.01, Math.hypot(...bounds.max.map((value, axis) => value - bounds.min[axis])) / 2);
  const vertical = options.camera.fovYDegrees * Math.PI / 360;
  const angle = Math.min(vertical, Math.atan(Math.tan(vertical) * Math.max(0.01, aspect)));
  const distance = radius / Math.sin(angle) * 1.15;
  const direction = options.camera.eye.map((value, axis) => value - options.camera.target[axis]);
  const norm = Math.hypot(...direction);
  const camera = validateMeshCamera({ ...options.camera, target,
    eye: direction.map((value, axis) => target[axis] + value / norm * distance),
    near: Math.max(0.0001, distance - radius * 2), far: Math.min(10000, distance + radius * 4 + 1) });
  return { ...options, camera };
}

function diagnosticText(error: CadEditorError): string {
  const messages = [error.message];
  let cause: unknown = error.cause;
  for (let index = 0; index < 4 && cause instanceof Error; index++) {
    messages.push(cause.message); cause = cause.cause;
  }
  return messages.join('\n');
}

function actionable(error: CadEditorError): string {
  if (error.context.field === 'restore-frame') return 'Cannot restore the current view. Reopen the feature view.';
  if (error.context.field === 'fit-selected-output') return 'Select a displayed, nonempty extrusion to fit.';
  if (error.code === 'DISPLAY') return 'Cannot display this change. The current view is retained.';
  if (error.code === 'STALE') return 'The document changed. Try Apply again.';
  const details = diagnosticText(error);
  if (/cycle|cyclic|dependency|missing.*parameter|unknown.*parameter/i.test(details)) {
    return 'Choose existing parameters and remove circular references.';
  }
  if (/contact|touch|coincident/i.test(details)) return 'This boundary contact is not supported. Choose another operation or graph.';
  if (/finite|decimal|exponent/i.test(details)) return 'Enter a finite length in mm.';
  return 'The change was not applied. Check the lengths and operation.';
}

interface MountedFeature {
  renderer: BooleanShellSceneRenderer;
  display: CadEditorFeatureDisplay;
  displays: CadEditorFeatureDisplay[];
  displayGeneration: number;
  requestedOptions: BooleanShellSceneOptions;
  admitting: boolean;
}

export function CadEditorFeature(props: CadEditorFeatureProps) {
  const { session, className } = props;
  const snapshot = useCadEditorFeatureSnapshot(session);
  const id = useId();
  const propsRef = useRef(props); propsRef.current = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mountedRef = useRef<MountedFeature | null>(null);
  const readIndexRef = useRef(0);
  const lifecycleRef = useRef({ mounts: 0, disposals: 0 });
  const lastFitSelectedRequestRef = useRef(props.fitSelectedRequest);
  const composingRef = useRef(new Set<string>());
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<CadEditorError | null>(null);

  function receipt(mounted: MountedFeature, displays = mounted.displays): CadEditorFeatureDisplayReceipt {
    const display = displays[0];
    const canvas = canvasRef.current!, options = mounted.renderer.options;
    const pixels = mounted.renderer.readPixels();
    if (pixels.length !== canvas.width * canvas.height * 4) throw new CadEditorError('DISPLAY', 'The feature frame RGBA read is incomplete.');
    const backgroundRGB = options.background.map(value => Math.round(value * 255)) as [number, number, number];
    let hash = 2166136261, nonBackgroundPixels = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      if ([0, 1, 2].some(channel => Math.abs(pixels[index + channel] - backgroundRGB[channel]) > 2)) nonBackgroundPixels++;
      for (let channel = 0; channel < 4; channel++) hash = Math.imul(hash ^ pixels[index + channel], 16777619) >>> 0;
    }
    return { status: 'ready', binding: structuredClone(display.binding), selection: structuredClone(display.selection),
      displays: structuredClone(displays), displayGeneration: mounted.displayGeneration,
      qualifiedOutputs: displays.map(output => ({ binding: structuredClone(output.binding), selection: structuredClone(output.selection),
        ref: { graphId: output.binding.graphId, graphRevision: output.binding.revision,
          featureId: output.binding.featureId, outputSlotId: output.binding.outputSlotId }, empty: output.nativeMesh.mesh.indices.length === 0 })),
      scene: mounted.renderer.scene,
      graphId: display.binding.graphId, graphRevision: display.binding.revision,
      featureId: display.binding.featureId, outputSlotId: display.binding.outputSlotId,
      pixelHash: hash.toString(16).padStart(8, '0'), nonBackgroundPixels, pixelCount: canvas.width * canvas.height,
      width: canvas.width, height: canvas.height, backgroundRGB, readIndex: ++readIndexRef.current,
      camera: structuredClone(options.camera), options, resourceCounts: mounted.renderer.resourceCounts,
      lifecycle: { ...lifecycleRef.current }, empty: mounted.renderer.empty };
  }

  function notify(value: CadEditorFeatureDisplayReceipt) {
    try { propsRef.current.onDisplay?.(value); }
    catch (cause) { report(new CadEditorError('DISPLAY', 'Feature display callback failed.', { field: 'display-callback' }, cause), false); }
  }

  function report(cause: unknown, freshRead = true) {
    const diagnostic = cause instanceof CadEditorError ? cause
      : new CadEditorError('DISPLAY', cause instanceof Error ? cause.message : 'The feature view operation was refused.', {}, cause);
    setError(diagnostic);
    try { propsRef.current.onError?.(diagnostic); } catch { /* Host callbacks do not change native admission. */ }
    const mounted = mountedRef.current;
    if (mounted && freshRead) {
      try { notify(receipt(mounted)); }
      catch (readCause) { report(new CadEditorError('DISPLAY', 'Reading the current feature frame failed.', { field: 'pixel-read' }, readCause), false); }
    }
  }

  function action(run: () => void) {
    try { run(); setError(null); }
    catch (cause) { report(cause instanceof CadEditorError ? cause
      : new CadEditorError('NATIVE', 'The native feature operation was refused.', {}, cause)); }
  }

  useEffect(() => {
    const canvas = canvasRef.current!;
    let mounted: MountedFeature | null = null;
    let observer: ResizeObserver | null = null;
    setReady(false); setError(null); readIndexRef.current = 0;
    function resize() {
      if (!mounted) return;
      const bounds = canvas.getBoundingClientRect();
      if (bounds.width <= 0 || bounds.height <= 0) return;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.min(4096, Math.max(1, Math.round(bounds.width * ratio)));
      const height = Math.min(4096, Math.max(1, Math.round(bounds.height * ratio)));
      const scale = Math.min(1, Math.sqrt(4194304 / (width * height)));
      const nextWidth = Math.max(1, Math.floor(width * scale)), nextHeight = Math.max(1, Math.floor(height * scale));
      if (canvas.width === nextWidth && canvas.height === nextHeight) return;
      try { mounted.renderer.resize(nextWidth, nextHeight); notify(receipt(mounted)); }
      catch (cause) { report(cause); }
    }
    try {
      const current = session.getSnapshot();
      const options = structuredClone(propsRef.current.displayOptions ?? DEFAULT_OPTIONS);
      const renderer = mountBooleanShellScene(canvas, sceneFor(current.displays, current.accepted), options);
      lifecycleRef.current.mounts++;
      mounted = { renderer, display: current.display, displays: current.displays,
        displayGeneration: current.displayGeneration, requestedOptions: options, admitting: false };
      mountedRef.current = mounted;
      resize();
      if (!propsRef.current.displayOptions) {
        const fitted = renderer.setOptions(fittedOptions(renderer, canvas.width / canvas.height));
        if (!fitted.ok) throw fitted.error;
      }
      notify(receipt(mounted));
      observer = new ResizeObserver(resize); observer.observe(canvas);
      setReady(true);
    } catch (cause) {
      report(cause, false);
      if (mounted) { mounted.renderer.dispose(); lifecycleRef.current.disposals++; mounted = null; }
      mountedRef.current = null;
    }
    return () => {
      observer?.disconnect();
      if (mounted) {
        const options = mounted.renderer.options, empty = mounted.renderer.empty, scene = mounted.renderer.scene;
        mounted.renderer.dispose(); lifecycleRef.current.disposals++;
        try { propsRef.current.onDisplay?.({ status: 'disposed',
          binding: structuredClone(mounted.display.binding), selection: structuredClone(mounted.display.selection),
          displays: structuredClone(mounted.displays), displayGeneration: mounted.displayGeneration, scene,
          qualifiedOutputs: mounted.displays.map(output => ({ binding: structuredClone(output.binding), selection: structuredClone(output.selection),
            ref: { graphId: output.binding.graphId, graphRevision: output.binding.revision,
              featureId: output.binding.featureId, outputSlotId: output.binding.outputSlotId }, empty: output.nativeMesh.mesh.indices.length === 0 })),
          graphId: mounted.display.binding.graphId, graphRevision: mounted.display.binding.revision,
          featureId: mounted.display.binding.featureId, outputSlotId: mounted.display.binding.outputSlotId,
          pixelHash: '', nonBackgroundPixels: 0, pixelCount: 0, width: canvas.width, height: canvas.height,
          backgroundRGB: options.background.map(value => Math.round(value * 255)) as [number, number, number],
          readIndex: readIndexRef.current, camera: structuredClone(options.camera), options,
          resourceCounts: mounted.renderer.resourceCounts, lifecycle: { ...lifecycleRef.current }, empty }); }
        catch { /* Disposed diagnostics cannot alter the host session. */ }
      }
      mounted = null; mountedRef.current = null;
    };
  }, [session]);

  useEffect(() => {
    const mounted = mountedRef.current;
    if (!mounted || mounted.admitting) return;
    let next: BooleanShellSceneOptions;
    try { next = structuredClone(props.displayOptions ?? mounted.renderer.options); }
    catch (cause) { report(cause); return; }
    if (sameData(next, mounted.requestedOptions)) return;
    mounted.requestedOptions = next;
    const priorScene = mounted.renderer.scene, priorOptions = mounted.renderer.options;
    let displayed = false;
    try {
      const updated = mounted.renderer.update(priorScene, next);
      if (!updated.ok) throw updated.error;
      displayed = true;
      const read = receipt(mounted); setError(null); notify(read);
    } catch (cause) {
      if (displayed) {
        const restored = mounted.renderer.update(priorScene, priorOptions);
        if (!restored.ok) { report(new CadEditorError('DISPLAY', 'Restoring the feature frame failed.', { field: 'restore-frame' }, restored.error)); return; }
      }
      report(cause);
    }
  }, [props.displayOptions, session, ready]);

  useEffect(() => {
    const mounted = mountedRef.current;
    if (!mounted || mounted.admitting) return;
    const current = session.getSnapshot(), candidate = current.candidate;
    if (!candidate) return;
    mounted.admitting = true;
    const priorScene = mounted.renderer.scene, priorOptions = mounted.renderer.options;
    let displayed = false;
    try {
      const requested = structuredClone(propsRef.current.displayOptions ?? mounted.renderer.options);
      const updated = mounted.renderer.update(sceneFor(candidate.displays, candidate.result), requested);
      if (!updated.ok) throw updated.error;
      displayed = true;
      const read = receipt(mounted, candidate.displays);
      const accepted = session.acceptCandidate(candidate.token);
      mounted.display = accepted.display;
      mounted.displays = accepted.displays;
      mounted.displayGeneration = accepted.displayGeneration;
      read.displayGeneration = accepted.displayGeneration;
      setError(null); notify(read);
      try { propsRef.current.onAccepted?.(accepted); }
      catch (cause) { report(new CadEditorError('DISPLAY', 'Feature acceptance callback failed.', { field: 'accepted-callback' }, cause)); }
    } catch (cause) {
      let restoreFailure: Error | null = null;
      if (displayed) {
        const restored = mounted.renderer.update(priorScene, priorOptions);
        if (!restored.ok) restoreFailure = restored.error;
      }
      try { session.cancelCandidate(candidate.token); } catch { /* A newer candidate owns the token. */ }
      report(cause);
      if (restoreFailure) report(new CadEditorError('DISPLAY', 'Restoring the feature frame failed.', { field: 'restore-frame' }, restoreFailure), false);
    } finally { mounted.admitting = false; }
  }, [snapshot.candidate?.token, session, ready]);

  useEffect(() => {
    const mounted = mountedRef.current;
    if (!mounted || mounted.admitting || props.readRequest === undefined) return;
    try { notify(receipt(mounted)); } catch (cause) { report(cause, false); }
  }, [props.readRequest, session, ready]);

  useEffect(() => {
    const mounted = mountedRef.current;
    const canvas = canvasRef.current;
    if (!mounted || !canvas || mounted.admitting || props.fitRequest === undefined) return;
    try {
      const fitted = mounted.renderer.setOptions(fittedOptions(mounted.renderer, canvas.width / canvas.height));
      if (!fitted.ok) throw fitted.error;
      notify(receipt(mounted));
    } catch (cause) { report(cause); }
  }, [props.fitRequest, session, ready]);

  useEffect(() => {
    const requested = props.fitSelectedRequest;
    if (requested === lastFitSelectedRequestRef.current) return;
    lastFitSelectedRequestRef.current = requested;
    const mounted = mountedRef.current, canvas = canvasRef.current;
    if (!mounted || !canvas || mounted.admitting || requested === undefined) return;
    try {
      const current = session.getSnapshot();
      const feature = current.accepted.document.features.find(value => value.id === current.selectedFeatureId);
      const output = mounted.displays.find(value => value.binding.featureId === current.selectedFeatureId);
      const boundsMM = output?.nativeMesh.mesh.boundsMM;
      if (feature?.kind !== 'normal-extrusion' || !output || !boundsMM || output.nativeMesh.mesh.indices.length === 0
        || output.binding.graphId !== current.accepted.document.id || output.binding.revision !== current.accepted.document.revision
        || output.binding.outputSlotId !== feature.outputSlotId) {
        throw new CadEditorError('DISPLAY', 'Selected Fit requires a displayed nonempty normal-extrusion output.', { field: 'fit-selected-output' });
      }
      const options = mounted.renderer.options;
      const bounds = { min: boundsMM.min.map((value, axis) => value * options.mmToSceneUnit + options.translate[axis]) as [number, number, number],
        max: boundsMM.max.map((value, axis) => value * options.mmToSceneUnit + options.translate[axis]) as [number, number, number] };
      const fitted = mounted.renderer.setOptions(fittedOptions(mounted.renderer, canvas.width / canvas.height, bounds));
      if (!fitted.ok) throw fitted.error;
      notify(receipt(mounted));
    } catch (cause) { report(cause instanceof CadEditorError ? cause
      : new CadEditorError('DISPLAY', 'Selected output framing was refused.', { field: 'fit-selected-output' }, cause)); }
  }, [props.fitSelectedRequest, session, ready]);

  const { accepted, pending } = snapshot;
  const selected = accepted.document.features.find(feature => feature.id === snapshot.selectedFeatureId);
  const busy = snapshot.candidate !== null || snapshot.disposed;
  const hasPending = Object.keys(pending.parameters).length + Object.keys(pending.booleanOperations).length > 0;

  return <div className={cn('cad-editor cad-editor-feature', className)}>
    <div className="cad-editor-viewport" data-feature-ready={ready}>
      <canvas ref={canvasRef} width={640} height={480} tabIndex={0} className="cad-editor-canvas"
        data-testid="cad-editor-feature-canvas" aria-label="Native Boolean extrusion feature view. Use Fit to frame the result." />
    </div>
    <aside className="cad-editor-inspector" aria-label="Boolean extrusion feature inspector">
      <div className="cad-editor-inspector-title"><h2 className="cad-editor-heading">Feature properties</h2>
        <Dialog><DialogTrigger asChild><Button type="button" variant="ghost" size="xs" data-testid="cad-editor-feature-help">Help</Button></DialogTrigger>
          <DialogContent className="cad-editor-help-dialog"><DialogHeader><DialogTitle>Feature editing help</DialogTitle>
            <DialogDescription>Boolean operations, shared lengths and editing limits.</DialogDescription></DialogHeader>
            <div className="cad-editor-help-body">
              <p>This profile evaluates two authored planar face inputs, one coplanar Boolean operation and 1–4 normal extrusions. You can add, edit and remove extrusion leaves.</p>
              <p>Adding or removing length parameters, reordering features, native suppression and general Face or Boolean creation/removal are unavailable. Existing shared length definitions remain editable.</p>
              <p>The extrusions can share the same Boolean region and length parameters. A shared edit rebuilds every native output.</p>
              <h3>Extrusion changes</h3>
              <p>Add extrusion uses the current Boolean region. Choose a literal height in mm or an existing length parameter plus an offset. Edit extrusion keeps its existing identity and output slot.</p>
              <p>When removing a displayed extrusion, choose the complete retained output set explicitly. The editor does not silently replace a removed output. At least one extrusion must remain.</p>
              <p>Apply or discard shared length and Boolean drafts before an extrusion change. The dialog values remain pending if native evaluation or display admission fails. Cancel or Escape discards only the dialog values and returns focus to its trigger.</p>
              <p>Undo and Redo keep the current displayed output choice. If a displayed leaf does not exist in the target history, choose a surviving displayed output and retry. There is no automatic history fallback.</p>
              <h3>Displayed outputs</h3>
              <p>Show, hide and solo change only the displayed outputs. They do not suppress or delete native features. One GPU scene uses depth to combine the displayed meshes. Nested extrusions with the same footprint can cover each other.</p>
              <p>Outputs share one display material. Use Show only selected to inspect overlapping leaves. The editor does not move outputs apart or change their authored coordinates.</p>
              <p>Literal lengths use their entered value. An offset uses an existing parameter plus the entered offset. All parameters, including unused ones, must resolve without circular references.</p>
              <p>Union combines the regions. Intersection keeps their overlap. Difference subtracts the second operand from the first. Some boundary contacts are unsupported and are refused by the native provider.</p>
              <p>Enter applies a draft outside text composition. During composition, Enter commits text only. Escape keeps the draft. Discard restores the current definitions.</p>
              <p>Apply evaluates the complete native graph and derives the currently displayed extrusion meshes. The document changes only after native evaluation, GPU admission and an actual frame read succeed.</p>
              <p>The native graph is editing authority. The displayed mesh is derived data and is not a solid or manufacturing certificate. A real empty Boolean result is valid and displays the background.</p>
              <p>Fit frames the displayed mesh bounds. Fit Selected frames only a displayed, nonempty extrusion chosen in the feature list. Hidden, empty, Face and Boolean selections are refused. These are display framing operations, not native BRep Fit.</p>
              <p>Select outputs in the feature list. Pointer picking of extrusion outputs is unavailable.</p>
              <p>Authored X, Y and Z remain unchanged. The default display uses one positive scale of 0.01 scene units per mm and no translation.</p>
              <details className="cad-editor-source"><summary className="cad-editor-source-title">Accepted native graph and history</summary>
                <p>Graph {accepted.document.id} · revision {accepted.document.revision}</p>
                <p>State {snapshot.history.index + 1} of {snapshot.history.count} · {snapshot.downloadStatus}</p>
                <p>Displayed outputs {snapshot.displays.length} · display generation {snapshot.displayGeneration}</p>
                <p>This inspection JSON can display signed zero as 0. The input fields and native download preserve signed zero.</p>
                <pre>{JSON.stringify(accepted.document, null, 2)}</pre>
              </details>
              {hasPending && <details className="cad-editor-source"><summary className="cad-editor-source-title">Pending definitions</summary><pre>{JSON.stringify(pending, null, 2)}</pre></details>}
              {error && <details className="cad-editor-source"><summary className="cad-editor-source-title">Last error details</summary><pre>{diagnosticText(error)}</pre></details>}
            </div>
          </DialogContent>
        </Dialog>
      </div>
      {selected && <p className="cad-editor-feature-selection">{displayName(selected.id)}</p>}
      {selected?.kind === 'coplanar-boolean' && <div className="cad-editor-field">
        <Label htmlFor={`${id}-operation`}>Operation</Label>
        <select id={`${id}-operation`} disabled={busy} data-testid={`boolean-operation-${selected.id}`}
          value={pending.booleanOperations[selected.id] ?? selected.options.operation}
          onChange={event => action(() => session.stageBooleanOperation(selected.id, event.target.value as 'union' | 'intersection' | 'difference'))}>
          <option value="union">Union</option><option value="intersection">Intersection</option><option value="difference">Difference</option>
        </select>
        {pending.booleanOperations[selected.id] && <span className="cad-editor-accepted">Current: {selected.options.operation}</span>}
      </div>}
      {selected?.kind === 'normal-extrusion' && <p>Current height: {numberText(accepted.report.distances.find(row => row.featureId === selected.id)!.valueMM)} mm</p>}
      <h3 className="cad-editor-heading">Shared lengths</h3>
      {accepted.document.parameters.map(parameter => {
        const current = parameter.definition;
        const draft: CadEditorFeatureParameterDraft = pending.parameters[parameter.id] ?? (current.kind === 'literal'
          ? { kind: 'literal', rawValueMM: numberText(current.valueMM) }
          : { kind: 'offset', parameterId: current.parameterId, rawOffsetMM: numberText(current.offsetMM) });
        const raw = draft.kind === 'literal' ? draft.rawValueMM : draft.rawOffsetMM;
        const resolved = accepted.parameters.find(value => value.id === parameter.id);
        return <section key={parameter.id} className="cad-editor-feature-parameter">
          <h4>{displayName(parameter.id)}</h4>
          <div className="cad-editor-field"><Label htmlFor={`${id}-${parameter.id}-kind`}>Definition</Label>
            <select id={`${id}-${parameter.id}-kind`} value={draft.kind} disabled={busy}
              data-testid={`parameter-kind-${parameter.id}`} onChange={event => action(() => session.stageLengthParameter(parameter.id,
                event.target.value === 'literal' ? { kind: 'literal', rawValueMM: raw }
                  : { kind: 'offset', parameterId: current.kind === 'offset' ? current.parameterId
                    : accepted.document.parameters.find(value => value.id !== parameter.id)?.id ?? parameter.id, rawOffsetMM: raw }))}>
              <option value="literal">Literal</option><option value="offset">Parameter + offset</option>
            </select>
          </div>
          {draft.kind === 'offset' && <div className="cad-editor-field"><Label htmlFor={`${id}-${parameter.id}-reference`}>Parameter</Label>
            <select id={`${id}-${parameter.id}-reference`} disabled={busy} value={draft.parameterId}
              data-testid={`parameter-reference-${parameter.id}`} onChange={event => action(() => session.stageLengthParameter(parameter.id,
                { ...draft, parameterId: event.target.value }))}>
              {accepted.document.parameters.map(value => <option key={value.id} value={value.id}>{displayName(value.id)}</option>)}
            </select>
          </div>}
          <div className="cad-editor-field"><Label htmlFor={`${id}-${parameter.id}-value`}>{draft.kind === 'literal' ? 'Value (mm)' : 'Offset (mm)'}</Label>
            <Input id={`${id}-${parameter.id}-value`} type="text" inputMode="decimal" value={raw} disabled={busy}
              data-testid={`parameter-value-${parameter.id}`}
              onCompositionStart={() => { composingRef.current.add(parameter.id); }}
              onCompositionEnd={() => { composingRef.current.delete(parameter.id); }}
              onKeyDown={event => {
                if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); return; }
                if (event.key !== 'Enter' || event.nativeEvent.isComposing || composingRef.current.has(parameter.id)
                  || event.keyCode === 229 || event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
                event.preventDefault(); event.stopPropagation(); action(() => { session.prepareApply(); });
              }}
              onChange={event => action(() => session.stageLengthParameter(parameter.id, draft.kind === 'literal'
                ? { ...draft, rawValueMM: event.target.value } : { ...draft, rawOffsetMM: event.target.value }))} />
            {pending.parameters[parameter.id] && <span className="cad-editor-accepted">Current: {resolved ? numberText(resolved.valueMM) : '—'} mm</span>}
          </div>
        </section>;
      })}
      <div className="cad-editor-actions"><Button type="button" disabled={busy || !hasPending} data-testid="feature-apply"
        onClick={() => action(() => { session.prepareApply(); })}>{snapshot.candidate ? 'Applying…' : 'Apply'}</Button>
        <Button type="button" variant="outline" disabled={busy || !hasPending} data-testid="feature-discard"
          onClick={() => action(() => session.discardPending())}>Discard</Button></div>
      {error && <p className="cad-editor-error" role="alert">{actionable(error)}</p>}
    </aside>
  </div>;
}
