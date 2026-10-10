import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { mountBooleanShellScene, validateMeshCamera } from '@barocss/gpu';
import type { BooleanShellResourceCounts, BooleanShellSceneInputV0, BooleanShellSceneOptions,
  BooleanShellSceneRenderer, BooleanShellLeafRef, MeshCamera } from '@barocss/gpu';
import type { CadEditorFeatureDisplay, CadEditorFeatureParameterDraft,
  CadEditorFeatureSession, CadEditorFeatureSnapshot, CadEditorFaceCorner,
  CadEditorFeatureProperties, CadEditorFeaturePropertiesOptions } from '../feature-types.js';
import { CadEditorError } from '../types.js';
import { cn } from '../lib/utils.js';
import { Button } from './ui/button.js';
import { Input } from './ui/input.js';
import { Label } from './ui/label.js';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog.js';
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
  /** Open a host-owned raw XYZ dialog for an exact current native Face corner. */
  onEditFaceCorner?: (corner: CadEditorFaceCorner, trigger: HTMLButtonElement) => void;
  propertiesOptions?: CadEditorFeaturePropertiesOptions;
  onProperties?: (properties: CadEditorFeatureProperties | null) => void;
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
const DEFAULT_PROPERTIES_OPTIONS: CadEditorFeaturePropertiesOptions = {maximumBoundarySegments:64,maximumSurfaceEvaluations:8};

function numberText(value: number) { return Object.is(value, -0) ? '-0' : String(value); }
function propertyNumberText(value: number): string {
  if(Object.is(value,-0))return '-0';
  return value.toFixed(6).replace(/(\.\d*?[1-9])0+$|\.0+$/,'$1');
}

function displayName(value: string): string {
  const generatedLength = /^ce_length_(\d+)$/.exec(value);
  if (generatedLength) return 'Length ' + generatedLength[1];
  const faceReplacement = /^rf(\d+)_face$/.exec(value), booleanReplacement = /^rb(\d+)_combine$/.exec(value);
  if (faceReplacement) return 'Face replacement ' + faceReplacement[1];
  if (booleanReplacement) return 'Combine faces ' + booleanReplacement[1];
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
  if (error.context.field === 'face-corner' && error.code === 'UNSUPPORTED') return 'Adjacent Line endpoints must match exactly to edit this Face.';
  if (error.context.field === 'extrusion-properties') return 'Cannot inspect these properties. Check the selected extrusion and try again.';
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
  const [properties,setProperties]=useState<{session:CadEditorFeatureSession;generation:number;result:CadEditorFeatureProperties}|null>(null);
  const [propertiesError,setPropertiesError]=useState<CadEditorError|null>(null);

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
  function notifyProperties(value:CadEditorFeatureProperties|null) {
    try {propsRef.current.onProperties?.(value===null?null:structuredClone(value));}
    catch(cause){report(new CadEditorError('LIFECYCLE','Native properties callback failed.',{field:'extrusion-properties-callback'},cause));}
  }
  function queryProperties() {
    const current=session.getSnapshot();
    const feature=current.accepted.document.features.find(value=>value.id===current.selectedFeatureId);
    try {
      if(current.candidate)throw new CadEditorError('INPUT','Wait for the current candidate before inspecting native properties.',{field:'extrusion-properties'});
      if(feature?.kind!=='normal-extrusion')throw new CadEditorError('INPUT','Select a normal extrusion to inspect native properties.',{field:'extrusion-properties'});
      const result=session.inspectExtrusionProperties({graphId:current.accepted.document.id,revision:current.accepted.document.revision,
        featureId:feature.id,outputSlotId:feature.outputSlotId},propsRef.current.propertiesOptions??DEFAULT_PROPERTIES_OPTIONS);
      setProperties({session,generation:current.generation,result});setPropertiesError(null);
      setError(previous=>previous?.context.field==='extrusion-properties'?null:previous);notifyProperties(result);
    } catch(cause) {
      const diagnostic=cause instanceof CadEditorError?cause:new CadEditorError('NATIVE','Native extrusion properties inspection failed.',{field:'extrusion-properties'},cause);
      setPropertiesError(diagnostic);report(diagnostic);
    }
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
  const cornerView = useMemo(() => {
    if (selected?.kind !== 'face-input' || snapshot.disposed) return {corners:[] as CadEditorFaceCorner[],error:null};
    try { return {corners:session.getFaceCorners(selected.id),error:null}; }
    catch (cause) { return {corners:[] as CadEditorFaceCorner[],error:cause instanceof CadEditorError ? cause
      : new CadEditorError('NATIVE','The authored Face corners could not be read.',{field:'face-corner'},cause)}; }
  }, [session,snapshot.generation,snapshot.selectedFeatureId,snapshot.disposed]);
  useEffect(() => {if (cornerView.error) report(cornerView.error);}, [cornerView.error]);
  const selectedSlot=selected?.kind==='normal-extrusion'?selected.outputSlotId:null;
  const currentProperties=properties!==null && properties.session===session && properties.generation===snapshot.generation && !snapshot.disposed && selectedSlot!==null
    && properties.result.binding.graphId===accepted.document.id && properties.result.binding.revision===accepted.document.revision
    && properties.result.binding.featureId===snapshot.selectedFeatureId && properties.result.binding.outputSlotId===selectedSlot
    ? properties.result : null;
  useEffect(()=>{
    setProperties(null);setPropertiesError(null);
    setError(previous=>previous?.context.field==='extrusion-properties'?null:previous);notifyProperties(null);
  },[session,snapshot.generation,accepted.document.id,accepted.document.revision,snapshot.selectedFeatureId,selectedSlot,snapshot.disposed]);
  useEffect(()=>()=>{try{propsRef.current.onProperties?.(null);}catch{/* Unmount invalidates a copied receipt without touching the native session. */}},[session]);

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
              <p>You can add, edit and remove shared lengths. Referenced Face and Boolean features can be replaced through explicit repairs. Reordering, native suppression and general Face or Boolean creation/removal remain unavailable.</p>
              <p>The extrusions can share the same Boolean region and length parameters. A shared edit rebuilds every native output.</p>
              <h3>Native extrusion properties</h3>
              <p>Inspect native properties reads one selected normal extrusion from the accepted graph revision. Scalar drafts are not measured. The action does not change source, selection, history, save capture or camera.</p>
              <p>Section area uses mm2. Construction volume estimate uses mm3. Centroid uses authored XYZ/mm. Display numbers are rounded to six decimal places; the typed onProperties result retains full native values.</p>
              <p>ConstructionEstimateOnly remains true. Topology, solid, manifold, sewing, manufacturing, density, mass and inertia certifications remain false. The geometric centroid is not an interior witness and can lie outside the material or in a hole.</p>
              <p>Each query measures one qualified output, not a total or union of overlapping extrusion leaves. Meshes, displayed pose, display scale and pixels are not measurement authority.</p>
              <p>The actual native limits allow 0–64 boundary segments and 0–8 new component support evaluations. Those counts exclude parent reconstruction, which native helpers can perform more than once.</p>
              <p>A real empty output has area 0, volume 0, no components and no centroid. Its query needs no new support samples. A failed query keeps the previous report only while its graph, revision, feature and slot remain current.</p>
              <p>Native edits, selection changes and unmount clear the previous report. Camera or visibility changes keep a current report. Inspect again after a native change; no automatic query or draft preview is made.</p>
              <p>Manual topics: Native extrusion properties in the package README; Inspect native extrusion properties in the app README.</p>
              <h3>Face corner editing</h3>
              <p>Select a Face to inspect its original ordered corners in native XYZ/mm. Edit opens a host dialog for one exact corner binding.</p>
              <p>Apply changes the previous degree 1 Line's endpoint pole and the next Line's start pole to the same explicit XYZ point. Coordinates must be from -10000 to 10000 mm. The native provider checks coplanarity, finite authored Plane domains, closure, convexity and unsupported boundary contact.</p>
              <p>No projection, snapping, solver, live preview or mesh-derived authoring is used. Enter, Tab and composition do not apply the host dialog; use its Apply button. Closing Help preserves raw coordinates and returns to Help. Cancel or Escape drops only dialog values and restores the corner trigger.</p>
              <p>prepareFaceCornerEdit uses one actual existing-Face native upsert and rebuilds the Boolean and all current extrusion displays. IDs, ordered Lines, knots, weights, options, sibling Face, parameters and display choice remain intact. Accepted edits return focus to the same corner control after the existing GPU and fresh-frame gate.</p>
              <p>Native or GPU refusal retains the raw XYZ fields, accepted native graph, history, selection, camera and current frame. This is bounded planar Face-Line coefficient editing, not general Curve authoring, drag or solid modeling.</p>
              <h3>Extrusion changes</h3>
              <p>Add extrusion uses the current Boolean region. Choose a literal height in mm or an existing length parameter plus an offset. Edit extrusion keeps its existing identity and output slot.</p>
              <p>When removing a displayed extrusion, choose the complete retained output set explicitly. The editor does not silently replace a removed output. At least one extrusion must remain.</p>
              <p>Apply or discard shared length and Boolean drafts before an extrusion change. The dialog values remain pending if native evaluation or display admission fails. Cancel or Escape discards only the dialog values and returns focus to its trigger.</p>
              <p>Undo and Redo keep the current displayed output choice. If a displayed leaf does not exist in the target history, choose a surviving displayed output and retry. There is no automatic history fallback.</p>
              <h3>Shared length changes</h3>
              <p>Add length creates a fresh native length identity. Edit keeps the existing ID, type and authored table position. Choose a literal value in mm or an existing length parameter plus an offset.</p>
              <p>Remove lists direct dependent length definitions and extrusion heights. Enable and choose each replacement individually. Disabled rows are not repaired. The editor does not delete dependents or replace them with evaluated values automatically.</p>
              <p>Missing or circular repairs reach the actual native provider refusal. Dialog values and enabled repairs remain pending after native or GPU rejection. Cancel or Escape discards only these dialog values and restores trigger focus. Accepted removal returns focus to Add length when the old trigger is gone.</p>
              <p>Parameter lifecycle uses prepareParameterTransaction and the actual transactBooleanExtrusionFeatureGraphParameters provider. One transaction contains 1–16 unique parameter operations and 0–4 explicit extrusion distance repairs. Temporary table capacity is 16; the final authored table contains 0–8 parameters.</p>
              <p>Parameter and extrusion lifecycle transactions stay separate. Apply or discard existing scalar drafts first. Every accepted parameter transaction follows the native revision policy, adds one native history entry and rebuilds all displayed output references. The logical display choice and selected feature remain unchanged.</p>
              <p>Undo and Redo restore the complete authored parameter table and distance definitions. Downloads contain accepted native data, not pending dialog values, repairs, camera or visibility.</p>
              <h3>Referenced feature replacement</h3>
              <p>Use Replace in a Face or combination row. Face replacement keeps the actual authored Plane and ordered Line input and creates a fresh logical feature and output slot. It does not edit coordinates or use mesh-derived geometry.</p>
              <p>Combination replacement copies the original operands and budgets, uses Union, Intersection or Difference, and creates a fresh logical/native evaluation context.</p>
              <p>Direct dependent Boolean operands and extrusion regions start unchecked. Only chosen repairs enter the same transaction before the old target is removed. Missing repairs reach the actual native dependency refusal. There is no cascade or automatic replacement.</p>
              <p>The current accepted scene stays in place while you choose. Help closes to its trigger without changing operation, repair choices or errors. Cancel or Escape drops only dialog choices and restores the original Replace trigger.</p>
              <p>Acceptance follows full native evaluation, all selected qualified meshes, one complete GPU scene admission and a fresh RGBA read. It focuses the new Replace row without selecting that feature. Native or GPU refusal retains dialog choices, accepted graph, history, view and raw drafts.</p>
              <p>prepareReferencedFeatureTransaction consumes the actual transactBooleanExtrusionFeatureGraphFeatures provider. The request has 1–8 unique targets, a working table of at most 8 and a final two-Face/one-Boolean/1–4-extrusion graph.</p>
              <p>Existing extrusion repairs change only their region reference. This workflow does not create/remove extrusions, edit their distances or options, change parameters, reorder or suppress features. Undo and Redo restore complete authored identities, references and operation.</p>
              <p>Manual topics: Referenced feature transactions in the package README; Replace referenced features in the app README.</p>
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
      {selected?.kind === 'face-input' && <section className="cad-editor-face-corners" aria-label="Authored Face corners">
        <h3 className="cad-editor-heading">Corners · XYZ/mm</h3>
        {cornerView.error && <p role="status">{cornerView.error.code==='UNSUPPORTED'
          ? 'Adjacent Line endpoints must match exactly to edit this Face.' : 'Corner editing is unavailable for this Face.'}</p>}
        {cornerView.corners.map(corner => <div className="cad-editor-face-corner" key={corner.binding.cornerIndex}>
          <div><h4>Corner {corner.binding.cornerIndex+1}</h4><p>{corner.pointMM.map(numberText).join(', ')} mm</p></div>
          <Button type="button" variant="outline" size="xs" disabled={busy || hasPending || !props.onEditFaceCorner}
            data-testid={`face-corner-edit-${corner.binding.featureId}-${corner.binding.cornerIndex}`}
            onClick={event => action(() => propsRef.current.onEditFaceCorner?.(structuredClone(corner),event.currentTarget))}>Edit</Button>
        </div>)}
      </section>}
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
      {selected?.kind==='normal-extrusion' && <section className="cad-editor-native-properties" aria-label="Selected native extrusion properties">
        <div className="cad-editor-inspector-title"><h3 className="cad-editor-heading">Native properties</h3>
          <Dialog><DialogTrigger asChild><Button type="button" variant="ghost" size="xs" data-testid="feature-properties-help">Help</Button></DialogTrigger>
            <DialogContent className="cad-editor-help-dialog" data-testid="feature-properties-help-dialog">
              <DialogHeader><DialogTitle>Native extrusion properties</DialogTitle><DialogDescription>Accepted construction estimates for one selected output.</DialogDescription></DialogHeader>
              <p>Inspect reads the accepted native graph revision, even while scalar fields have pending values. It does not use a draft, mesh, camera, display scale or scene pose.</p>
              <p data-testid="feature-properties-revision">Accepted revision {currentProperties?.binding.revision ?? accepted.document.revision}</p>
              <p>Area is in mm2, construction volume estimate in mm3, and geometric centroid in authored XYZ/mm. Display values are rounded to six decimal places. The typed properties callback retains the complete native result.</p>
              <p>ConstructionEstimateOnly is true. These values are not certified topology, Solid, manifold, sewing, manufacturing, density, mass or inertia properties. A centroid can lie in a hole or outside the material; it is not an interior witness.</p>
              <p>The query measures one selected output. It does not union or total overlapping leaves. Empty geometry returns 0 area, 0 volume, no components and centroid unavailable.</p>
              <p>Budgets count up to 64 boundary segments and 8 new component support evaluations. Parent reconstruction work is excluded and can happen more than once. A refused query keeps a still-current earlier report; changed graph/revision/feature/slot or unmount clears it.</p>
              <p>Closing Help returns focus to Help without querying or modifying the graph. Use Inspect again after an accepted native edit. Camera and display-only changes keep a current report.</p>
              <p>Manual topics: Native extrusion properties in the package README; Inspect native extrusion properties in the app README.</p>
              {propertiesError && <details><summary>Technical details</summary><pre>{diagnosticText(propertiesError)}</pre></details>}
              {currentProperties && <details><summary>Native quality and work report</summary><pre>{JSON.stringify(currentProperties.nativeProperties.report,null,2)}</pre></details>}
              {currentProperties && <details><summary>Current output binding</summary><pre>{JSON.stringify(currentProperties.binding,null,2)}</pre></details>}
              <DialogClose asChild><Button type="button" variant="outline" className="cad-editor-export-close" data-testid="feature-properties-help-close">Close help</Button></DialogClose>
            </DialogContent>
          </Dialog>
        </div>
        <Button type="button" variant="outline" disabled={busy} data-testid="feature-properties-query" onClick={queryProperties}>Inspect native properties</Button>
        {currentProperties ? <div data-testid="feature-properties-summary">
          <p>Current properties</p>
          {currentProperties.nativeProperties.report.empty && <p role="status" data-testid="feature-properties-empty">Empty extrusion. Geometric centroid unavailable.</p>}
          <dl className="cad-editor-properties-values">
            <dt>Section area (mm²)</dt><dd><span data-testid="feature-properties-area">{propertyNumberText(currentProperties.nativeProperties.report.areaMM2)}</span></dd>
            <dt>Construction volume estimate (mm³)</dt><dd><span data-testid="feature-properties-volume">{propertyNumberText(currentProperties.nativeProperties.report.volumeMM3)}</span></dd>
            {(['X','Y','Z'] as const).map((axis,index)=><div key={axis}><dt>Geometric centroid {axis} (mm)</dt><dd><span data-testid={'feature-properties-centroid-'+axis.toLowerCase()}>
              {currentProperties.nativeProperties.report.centroidMM===null?'Unavailable':propertyNumberText(currentProperties.nativeProperties.report.centroidMM[index])}
            </span></dd></div>)}
          </dl>
        </div> : <p className="cad-editor-properties-note">Inspect to read or refresh values.</p>}
        {propertiesError && <p className="cad-editor-error" role="alert">Cannot inspect these properties. Check the selected extrusion and try again.</p>}
      </section>}
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
