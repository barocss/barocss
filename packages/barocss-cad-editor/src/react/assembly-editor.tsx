import { useEffect, useId, useRef, useState } from 'react';
import { createViewer, type Viewer, type ViewerOptions, type ViewerState, type ViewerAssemblyLoadOptions,
  type ViewerAssemblyInstanceBinding, type ViewerAssemblyPoint, type ViewerPointerControls, type ViewerKeyboardControls } from '@barocss/viewer';
import { resolveCadGeometryReference, curveDomain, surfaceDomain, validateCadAssemblyInstancePoint, type CadAssemblyResult } from '@barocss/cad';
import type { CadEditorAssemblySession, CadEditorAssemblySnapshot, CadEditorAssemblyCandidate,
  CadEditorAssemblySelection, CadEditorAssemblyPoseField } from '../assembly-types.js';
import { CadEditorError } from '../types.js';
import { Button } from './ui/button.js';
import { Input } from './ui/input.js';
import { Label } from './ui/label.js';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog.js';
import { CadEditorViewNavigator, VIEW_SIDES, type NativeViewSide } from './view-navigator.js';
import { AssemblyTranslationHandles, sameAssemblyData as same } from './assembly-translation-handles.js';

export interface CadEditorAssemblyDisplayOptions { viewer: ViewerOptions; native: ViewerAssemblyLoadOptions['native'] }
export interface CadEditorAssemblyDisplayReceipt {
  state: ViewerState;
  assemblyId: string; assemblyRevision: number; generation: number; displayGeneration: number;
  instanceIds: string[]; bindings: ViewerAssemblyInstanceBinding[];
  selectedInstanceId: string | null; selectedBinding: ViewerAssemblyInstanceBinding | null;
  point: ViewerAssemblyPoint | null; lifecycle: { mounts: number; disposals: number };
}
export interface CadEditorAssemblyFrameReceipt extends CadEditorAssemblyDisplayReceipt {
  readIndex: number; width: number; height: number; pixelBytes: number; pixelHash: string;
  nonBackgroundPixels: number; backgroundRGB: [number, number, number];
}
export interface CadEditorAssemblyEditorProps {
  session: CadEditorAssemblySession;
  displayOptions?: CadEditorAssemblyDisplayOptions;
  onError?: (error: CadEditorError) => void;
  onAccepted?: (snapshot: CadEditorAssemblySnapshot, candidate: CadEditorAssemblyCandidate) => void;
  onDisplay?: (receipt: CadEditorAssemblyDisplayReceipt | null) => void;
  readRequest?: number;
  onFrame?: (receipt: CadEditorAssemblyFrameReceipt | null) => void;
  fitRequest?: number;
}
const DEFAULT_OPTIONS: CadEditorAssemblyDisplayOptions = {
  viewer: { mmToSceneUnit: 0.01, background: [0.07, 0.08, 0.10] },
  native: { sourceVersion: 0, countU: 17, countV: 17, curveDisplay: { chordToleranceMM: 0.1, maxSegments: 64, maxDepth: 8 } },
};
const positionFields = ['xMM', 'yMM', 'zMM'] as const, rotationFields = ['rxDeg', 'ryDeg', 'rzDeg'] as const;
const numberText = (value: number) => Object.is(value, -0) ? '-0' : String(value);
interface Mounted {
  viewer: Viewer; options: CadEditorAssemblyDisplayOptions; result: CadAssemblyResult;
  instanceIds: string[]; selection: CadEditorAssemblySelection | null;
  generation: number; displayGeneration: number;
  admitting: boolean; optionsRefused: boolean; unavailable: boolean;
}
function fault(message: string, field = 'assembly-display', cause?: unknown) { return new CadEditorError('DISPLAY', message, { field }, cause); }
function querySelected(viewer: Viewer, result: CadAssemblyResult, binding: ViewerAssemblyInstanceBinding): ViewerAssemblyPoint {
  const document = result.documents.find(value => value.document.documentId === binding.reference.documentId);
  if (!document) throw fault('The complete selected part document is missing.');
  const resolved = resolveCadGeometryReference(document, binding.reference), geometry = resolved.geometry;
  const midpoint = (domain: [number, number]) => domain[0] + (domain[1] - domain[0]) / 2;
  const query = geometry.kind === 'curve' ? { kind: 'curve' as const, parameter: midpoint(curveDomain(geometry)) }
    : { kind: 'surface' as const, u: midpoint(surfaceDomain(geometry).u), v: midpoint(surfaceDomain(geometry).v) };
  const point = viewer.queryAssemblyInstancePoint({ assemblyId: binding.assemblyId, assemblyRevision: binding.assemblyRevision,
    instanceId: binding.instanceId, reference: structuredClone(binding.reference), query });
  validateCadAssemblyInstancePoint(result, point);
  if (point.assemblyId !== binding.assemblyId || point.assemblyRevision !== binding.assemblyRevision
    || point.instanceId !== binding.instanceId || !same(point.reference, binding.reference)
    || !same(point.localMatrix, binding.localMatrix) || !same(point.worldMatrix, binding.worldMatrix))
    throw fault('The displayed instance query differs from its qualified native binding.', 'assembly-query');
  return point;
}
function inspect(viewer: Viewer, result: CadAssemblyResult, ids: string[], selection: CadEditorAssemblySelection | null) {
  const state = viewer.getState();
  if (state.status !== (ids.length ? 'ready' : 'empty') || state.native !== null || state.document !== null || state.documentBodies.length)
    throw fault('The actual Viewer state differs from the declared Assembly display.');
  if (!ids.length) {
    if (state.assembly !== null || state.assemblyInstances.length || state.visibleGeometry.length || state.selectedGeometry !== null)
      throw fault('The empty Assembly display retains an old displayed instance.');
    return { state, selectedBinding: null, point: null };
  }
  if (!same(state.assembly, result) || state.assemblyInstances.length !== ids.length || state.visibleGeometry.length !== ids.length
    || new Set(state.assemblyInstances.map(value => value.ref.modelId)).size !== ids.length)
    throw fault('The complete native Assembly or its instance namespaces differ from the current display.');
  for (let index = 0; index < ids.length; index++) {
    const binding = state.assemblyInstances[index], native = result.instances.find(value => value.instanceId === ids[index]);
    if (!native || binding.instanceId !== ids[index] || binding.assemblyId !== result.assembly.assemblyId
      || binding.assemblyRevision !== result.assembly.revision || binding.parentId !== native.parentId
      || !same(binding.reference, native.reference) || !same(binding.ancestors, native.ancestors)
      || !same(binding.localMatrix, native.localMatrix) || !same(binding.worldMatrix, native.worldMatrix)
      || !state.visibleGeometry.some(ref => same(ref, binding.ref))) throw fault('A displayed instance differs from its current original part binding.');
  }
  if (selection && (selection.assemblyId !== result.assembly.assemblyId || selection.assemblyRevision !== result.assembly.revision
    || !same(result.instances.find(value => value.instanceId === selection.instanceId)?.reference, selection.reference)))
    throw new CadEditorError('STALE', 'The selected instance binding is no longer current.', { field: 'assembly-selection' });
  const selectedBinding = selection ? state.assemblyInstances.find(value => value.instanceId === selection.instanceId) ?? null : null;
  if (!same(state.selectedGeometry, selectedBinding?.ref ?? null)) throw fault('The actual Viewer selection differs from the logical instance selection.');
  return { state, selectedBinding, point: selectedBinding ? querySelected(viewer, result, selectedBinding) : null };
}
function present(viewer: Viewer, result: CadAssemblyResult, ids: string[], selection: CadEditorAssemblySelection | null,
  options: CadEditorAssemblyDisplayOptions, camera: ViewerState['camera'] | null) {
  if (ids.length) viewer.loadAssembly(result, { native: options.native, basis: 'authored-xyz-matches-rhyup', instanceIds: [...ids] });
  else viewer.clear();
  if (camera) viewer.setView(camera);
  const binding = selection ? viewer.getState().assemblyInstances.find(value => value.instanceId === selection.instanceId) : null;
  viewer.selectGeometry(binding?.ref ?? null);
  return inspect(viewer, result, ids, selection);
}
function errorDetails(error: Error): string {
  const lines: string[] = [], seen = new Set<unknown>();
  function visit(value: unknown) {
    if (!(value instanceof Error) || seen.has(value)) return; seen.add(value); lines.push(value.name + ': ' + value.message);
    if (value instanceof AggregateError) value.errors.forEach(visit); visit(value.cause);
  }
  visit(error); return lines.join('\n');
}
function actionable(error: CadEditorError) {
  const detail = errorDetails(error);
  if (error.context.field === 'assembly-restore') return 'Cannot restore the current view. Reopen the Assembly view.';
  if (error.code === 'DISPLAY') return 'Cannot display this change. The current view is retained.';
  if (/cycle|ancestor|hierarchy|parent/i.test(detail)) return 'Choose a valid parent that does not create a cycle.';
  if (/rotation|360/i.test(detail)) return 'Keep each rotation from -360 to 360 degrees.';
  if (/translation|10000/i.test(detail)) return 'Keep local position from -10000 to 10000 mm.';
  if (error.code === 'STALE') return 'The instance or view changed. Review the pending values.';
  return 'The change was not applied. Review the local position, rotation and parent.';
}

/** A typed native Assembly consumer. Presentation succeeds before acceptance; pixel reads are requested verification only. */
export function CadEditorAssemblyEditor(props: CadEditorAssemblyEditorProps) {
  const { session } = props, id = useId();
  const [snapshot, setSnapshot] = useState(() => session.getSnapshot());
  useEffect(() => { const stop = session.subscribe(setSnapshot); setSnapshot(session.getSnapshot()); return stop; }, [session]);
  const latest = useRef(props); latest.current = props;
  const canvasRef = useRef<HTMLCanvasElement>(null), viewportRef = useRef<HTMLDivElement>(null), mountedRef = useRef<Mounted | null>(null);
  const lifecycle = useRef({ mounts: 0, disposals: 0 }), readIndex = useRef(0), gestureRef = useRef(false), pointers = useRef(new Set<number>());
  const composing = useRef(new Set<CadEditorAssemblyPoseField>()), lastFit = useRef(props.fitRequest);
  const [ready, setReady] = useState(false), [captured, setCaptured] = useState(false), [gesturing, setGesturing] = useState(false);
  const [, refreshCommands] = useState(0);
  const [receipt, setReceipt] = useState<CadEditorAssemblyDisplayReceipt | null>(null), [error, setError] = useState<CadEditorError | null>(null);
  function captureFor(pointerId: number) { return [document.documentElement, ...document.querySelectorAll('*')].some(element => element.hasPointerCapture(pointerId)); }
  function hasCapture() { return [...pointers.current].some(captureFor); }
  function hostBlocked() { return gestureRef.current || hasCapture() || !!canvasRef.current?.closest('[data-assembly-host-busy="true"]'); }
  function report(cause: unknown) {
    const diagnostic = cause instanceof CadEditorError ? cause : fault(cause instanceof Error ? cause.message : 'The Assembly display was refused.', 'assembly-display', cause);
    setError(diagnostic); const mounted = mountedRef.current;
    if (mounted && (diagnostic.context.field === 'assembly-restore' || ['unavailable', 'context-lost'].includes(mounted.viewer.getState().status))) {
      mounted.unavailable = true; setReady(false); setReceipt(null);
      try { latest.current.onDisplay?.(null); } catch {}
      try { latest.current.onFrame?.(null); } catch {}
    }
    try { latest.current.onError?.(diagnostic); } catch { /* Observers cannot alter native admission. */ }
  }
  function makeReceipt(mounted: Mounted, selection = mounted.selection): CadEditorAssemblyDisplayReceipt {
    const actual = inspect(mounted.viewer, mounted.result, mounted.instanceIds, selection);
    return { ...actual, assemblyId: mounted.result.assembly.assemblyId, assemblyRevision: mounted.result.assembly.revision,
      generation: mounted.generation, displayGeneration: mounted.displayGeneration, instanceIds: [...mounted.instanceIds],
      bindings: structuredClone(actual.state.assemblyInstances), selectedInstanceId: selection?.instanceId ?? null, lifecycle: { ...lifecycle.current } };
  }
  function publish(value: CadEditorAssemblyDisplayReceipt) {
    setReceipt(structuredClone(value));
    try { latest.current.onDisplay?.(structuredClone(value)); } catch (cause) { report(fault('Assembly display callback failed.', 'assembly-display-callback', cause)); }
  }
  function aligned(mounted: Mounted) {
    const current = session.getSnapshot();
    return !current.disposed && mounted.generation === current.generation && mounted.displayGeneration === current.displayGeneration
      && same(mounted.instanceIds, current.display.instanceIds) && same(mounted.result, current.accepted);
  }
  function controlledOptionsCurrent(mounted: Mounted) { return same(latest.current.displayOptions ?? DEFAULT_OPTIONS, mounted.options); }
  function commandBlocked() {
    const mounted = mountedRef.current, current = session.getSnapshot(), canvas = canvasRef.current, rect = canvas?.getBoundingClientRect();
    return hostBlocked() || !mounted || mounted.admitting || mounted.optionsRefused || mounted.unavailable || !aligned(mounted) || !controlledOptionsCurrent(mounted)
      || current.candidate !== null || Object.keys(current.pending.fields).length > 0 || !canvas?.isConnected
      || !rect || rect.width <= 0 || rect.height <= 0 || viewportRef.current?.getAttribute('data-assembly-ready') !== 'true'
      || mounted.viewer.getState().status !== 'ready' || document.querySelector('[role="dialog"][data-state="open"],[role="menu"]') !== null;
  }
  function isCurrentFrame(value: CadEditorAssemblyDisplayReceipt) {
    const mounted = mountedRef.current, current = session.getSnapshot();
    if (!mounted || mounted.admitting || mounted.optionsRefused || mounted.unavailable || !aligned(mounted) || !controlledOptionsCurrent(mounted) || current.candidate || current.disposed
      || value.generation !== current.generation || value.displayGeneration !== current.displayGeneration
      || !same(value.instanceIds, current.display.instanceIds) || !same(value.selectedInstanceId, current.selection?.binding.instanceId ?? null)
      || !same(mounted.selection, current.selection?.binding ?? null) || viewportRef.current?.getAttribute('data-assembly-ready') !== 'true') return false;
    const state = mounted.viewer.getState();
    return state.status === 'ready' && same(state.camera, value.state.camera) && same(state.assemblyInstances, value.bindings)
      && same(state.selectedGeometry, value.selectedBinding?.ref ?? null) && Object.is(state.mmToSceneUnit, value.state.mmToSceneUnit);
  }
  function action(run: () => unknown) {
    const current = session.getSnapshot(), mounted = mountedRef.current;
    if (hostBlocked() || current.disposed || current.candidate || mounted?.admitting) return;
    try { run(); setError(null); } catch (cause) { report(cause); }
  }
  function restore(mounted: Mounted, prior: { result: CadAssemblyResult; ids: string[]; selection: CadEditorAssemblySelection | null; camera: ViewerState['camera'] }, cause: unknown) {
    try {
      present(mounted.viewer, prior.result, prior.ids, prior.selection, mounted.options, prior.camera);
      mounted.result = prior.result; mounted.instanceIds = prior.ids; mounted.selection = prior.selection;
      publish(makeReceipt(mounted));
    } catch (restoreCause) { report(fault('Restoring the accepted Assembly presentation failed.', 'assembly-restore',
      new AggregateError([cause, restoreCause], 'Assembly operation and compensation failed.'))); return false; }
    return true;
  }
  useEffect(() => {
    let live = true;
    const down = (event: PointerEvent) => { pointers.current.add(event.pointerId); setTimeout(() => { if (live) setCaptured(hasCapture()); }, 0); };
    const release = (event: PointerEvent) => {
      if (!captureFor(event.pointerId)) pointers.current.delete(event.pointerId);
      setTimeout(() => { if (live) { if (!captureFor(event.pointerId)) pointers.current.delete(event.pointerId); setCaptured(hasCapture()); } }, 0);
    };
    window.addEventListener('pointerdown', down, true); window.addEventListener('pointerup', release, true);
    window.addEventListener('pointercancel', release, true); window.addEventListener('lostpointercapture', release, true);
    return () => { live = false; pointers.current.clear(); window.removeEventListener('pointerdown', down, true);
      window.removeEventListener('pointerup', release, true); window.removeEventListener('pointercancel', release, true); window.removeEventListener('lostpointercapture', release, true); };
  }, [session]);
  useEffect(() => {
    const canvas = canvasRef.current!; let viewer: Viewer | null = null, observer: ResizeObserver | null = null;
    let pointer: ViewerPointerControls | null = null, keyboard: ViewerKeyboardControls | null = null, published = false;
    setReady(false); setReceipt(null); setError(null); readIndex.current = 0;
    function publishCamera() { const mounted = mountedRef.current; if (published && mounted && !mounted.admitting && !mounted.unavailable && aligned(mounted))
      try { publish(makeReceipt(mounted)); } catch (cause) { report(cause); } }
    function resize() {
      const mounted = mountedRef.current, rect = canvas.getBoundingClientRect(); if (!mounted || mounted.unavailable || rect.width <= 0 || rect.height <= 0) return;
      const ratio = Math.min(window.devicePixelRatio || 1, 2), width = Math.min(4096, Math.max(1, Math.round(rect.width * ratio))), height = Math.min(4096, Math.max(1, Math.round(rect.height * ratio)));
      const scale = Math.min(1, Math.sqrt(4194304 / (width * height))), nextWidth = Math.max(1, Math.floor(width * scale)), nextHeight = Math.max(1, Math.floor(height * scale));
      if (canvas.width === nextWidth && canvas.height === nextHeight) return;
      try { mounted.viewer.resize(nextWidth, nextHeight); publishCamera(); } catch (cause) { report(cause); }
    }
    try {
      const current = session.getSnapshot(), options = structuredClone(latest.current.displayOptions ?? DEFAULT_OPTIONS);
      if (current.disposed) throw new CadEditorError('LIFECYCLE', 'The Assembly session is disposed.', { field: 'assembly-display' });
      viewer = createViewer(canvas, options.viewer); lifecycle.current.mounts++;
      const mounted: Mounted = { viewer, options, result: current.accepted, instanceIds: [...current.display.instanceIds],
        selection: structuredClone(current.selection?.binding ?? null), generation: current.generation, displayGeneration: current.displayGeneration,
        admitting: false, optionsRefused: false, unavailable: false };
      mountedRef.current = mounted; resize(); present(viewer, mounted.result, mounted.instanceIds, mounted.selection, options, null);
      published = true; setReady(true); publish(makeReceipt(mounted));
      pointer = viewer.attachPointerControls({ onError: report }); keyboard = viewer.attachKeyboardControls({ onError: report });
      canvas.addEventListener('pointerup', publishCamera); canvas.addEventListener('wheel', publishCamera); canvas.addEventListener('keydown', publishCamera);
      observer = new ResizeObserver(resize); observer.observe(canvas);
    } catch (cause) { report(cause); observer?.disconnect(); pointer?.dispose(); keyboard?.dispose();
      if (viewer) { viewer.dispose(); lifecycle.current.disposals++; viewer = null; } mountedRef.current = null; }
    return () => {
      observer?.disconnect(); canvas.removeEventListener('pointerup', publishCamera); canvas.removeEventListener('wheel', publishCamera); canvas.removeEventListener('keydown', publishCamera);
      pointer?.dispose(); keyboard?.dispose();
      if (viewer) { viewer.dispose(); lifecycle.current.disposals++; }
      mountedRef.current = null; gestureRef.current = false;
      try { latest.current.onDisplay?.(null); } catch {} try { latest.current.onFrame?.(null); } catch {}
    };
  }, [session]);
  useEffect(() => {
    const mounted = mountedRef.current; if (!mounted || mounted.admitting || mounted.unavailable) return;
    const next = structuredClone(props.displayOptions ?? DEFAULT_OPTIONS);
    if (!same(next.viewer, mounted.options.viewer)) { mounted.optionsRefused = true; report(fault('Viewer option changes require reopening the Assembly view.', 'assembly-options')); return; }
    if (same(next.native, mounted.options.native)) {
      if (mounted.optionsRefused) { mounted.optionsRefused = false; refreshCommands(value => value + 1);
        setError(value => value?.context.field === 'assembly-options' ? null : value); }
      return;
    }
    const prior = { result: mounted.result, ids: [...mounted.instanceIds], selection: structuredClone(mounted.selection), camera: mounted.viewer.getState().camera };
    mounted.admitting = true;
    try {
      present(mounted.viewer, mounted.result, mounted.instanceIds, mounted.selection, next, prior.camera);
      mounted.options = next; mounted.optionsRefused = false; setError(null); publish(makeReceipt(mounted));
    } catch (cause) { mounted.optionsRefused = true; if (restore(mounted, prior, cause)) report(cause); }
    finally { mounted.admitting = false; }
  }, [props.displayOptions, session, ready]);
  useEffect(() => {
    const mounted = mountedRef.current; if (!mounted || mounted.admitting) return;
    const current = session.getSnapshot(), candidate = current.candidate; if (!candidate) return;
    const prior = { result: mounted.result, ids: [...mounted.instanceIds], selection: structuredClone(mounted.selection), camera: mounted.viewer.getState().camera };
    mounted.admitting = true; let attempted = false, committed = false;
    try {
      if (mounted.unavailable || mounted.optionsRefused || !controlledOptionsCurrent(mounted)) throw fault('Resolve the display error before applying this change.');
      if (!aligned(mounted) || candidate.baseGeneration !== current.generation || candidate.baseDisplayGeneration !== current.displayGeneration)
        throw new CadEditorError('STALE', 'The prepared Assembly candidate is no longer current.', { field: 'assembly-display' });
      attempted = true;
      const actual = present(mounted.viewer, candidate.result, candidate.display.instanceIds, candidate.selectionTarget, mounted.options,
        candidate.kind === 'open' ? null : prior.camera);
      const now = session.getSnapshot();
      if (now.candidate?.token !== candidate.token || now.generation !== candidate.baseGeneration || now.displayGeneration !== candidate.baseDisplayGeneration)
        throw new CadEditorError('STALE', 'The prepared Assembly changed before admission.', { field: 'assembly-display' });
      const accepted = session.acceptCandidate(candidate.token); committed = true;
      mounted.result = candidate.result; mounted.instanceIds = [...candidate.display.instanceIds]; mounted.selection = structuredClone(candidate.selectionTarget);
      mounted.generation = accepted.generation; mounted.displayGeneration = accepted.displayGeneration;
      const value: CadEditorAssemblyDisplayReceipt = { ...actual, assemblyId: candidate.result.assembly.assemblyId, assemblyRevision: candidate.result.assembly.revision,
        generation: accepted.generation, displayGeneration: accepted.displayGeneration, instanceIds: [...candidate.display.instanceIds],
        bindings: structuredClone(actual.state.assemblyInstances), selectedInstanceId: candidate.selectionTarget?.instanceId ?? null, lifecycle: { ...lifecycle.current } };
      setError(null); publish(value);
      try { latest.current.onAccepted?.(structuredClone(accepted), structuredClone(candidate)); }
      catch (cause) { report(fault('Assembly acceptance callback failed.', 'assembly-accepted-callback', cause)); }
    } catch (cause) {
      if (committed) { report(cause); return; }
      try { session.cancelCandidate(candidate.token); } catch { /* Another private token may own the pending work. */ }
      if (!attempted || restore(mounted, prior, cause)) report(cause);
    } finally { mounted.admitting = false; }
  }, [snapshot.candidate?.token, session, ready]);
  useEffect(() => {
    const mounted = mountedRef.current, current = session.getSnapshot();
    if (!mounted || mounted.admitting || mounted.unavailable || !aligned(mounted) || current.candidate
      || same(mounted.selection, current.selection?.binding ?? null)) return;
    const old = structuredClone(mounted.selection), before = mounted.viewer.getState().selectedGeometry;
    try {
      const selection = current.selection?.binding ?? null, binding = selection ? mounted.viewer.getState().assemblyInstances.find(value => value.instanceId === selection.instanceId) : null;
      mounted.viewer.selectGeometry(binding?.ref ?? null); inspect(mounted.viewer, mounted.result, mounted.instanceIds, selection);
      mounted.selection = structuredClone(selection); publish(makeReceipt(mounted));
    } catch (cause) {
      try { mounted.viewer.selectGeometry(before); mounted.selection = old; } catch (restoreCause) {
        report(fault('Restoring the selected Assembly instance failed.', 'assembly-restore', new AggregateError([cause, restoreCause]))); return;
      }
      report(cause);
    }
  }, [snapshot.selection?.binding.instanceId, snapshot.generation, snapshot.displayGeneration, session, ready]);
  useEffect(() => {
    const mounted = mountedRef.current;
    if (!mounted || mounted.admitting || mounted.unavailable || props.readRequest === undefined || !aligned(mounted)) return;
    try {
      const value = makeReceipt(mounted), canvas = canvasRef.current!, pixels = mounted.viewer.readPixels();
      if (pixels.length !== canvas.width * canvas.height * 4) throw fault('The Assembly RGBA read is incomplete.', 'assembly-pixel-read');
      const backgroundRGB = mounted.options.viewer.background.map(value => Math.round(value * 255)) as [number, number, number];
      let hash = 2166136261, nonBackgroundPixels = 0;
      for (let index = 0; index < pixels.length; index += 4) {
        if ([0, 1, 2].some(channel => Math.abs(pixels[index + channel] - backgroundRGB[channel]) > 2)) nonBackgroundPixels++;
        for (let channel = 0; channel < 4; channel++) hash = Math.imul(hash ^ pixels[index + channel], 16777619) >>> 0;
      }
      const frame: CadEditorAssemblyFrameReceipt = { ...value, readIndex: ++readIndex.current, width: canvas.width, height: canvas.height,
        pixelBytes: pixels.length, pixelHash: hash.toString(16).padStart(8, '0'), nonBackgroundPixels, backgroundRGB };
      latest.current.onFrame?.(structuredClone(frame));
    } catch (cause) { report(fault('Reading the current Assembly frame failed.', 'assembly-pixel-read', cause)); }
  }, [props.readRequest, session, ready]);
  function cameraAction(run: (viewer: Viewer) => void) {
    if (commandBlocked()) return;
    const mounted = mountedRef.current!, before = mounted.viewer.getState().camera, generation = mounted.generation, displayGeneration = mounted.displayGeneration;
    try {
      run(mounted.viewer);
      if (!aligned(mounted) || generation !== mounted.generation || displayGeneration !== mounted.displayGeneration || commandBlocked())
        throw new CadEditorError('STALE', 'The Assembly changed before the camera was published.', { field: 'assembly-camera' });
      setError(null); publish(makeReceipt(mounted));
    } catch (cause) {
      try { mounted.viewer.setView(before); publish(makeReceipt(mounted)); }
      catch (restoreCause) { report(fault('Restoring the Assembly camera failed.', 'assembly-restore', new AggregateError([cause, restoreCause]))); return; }
      report(cause);
    }
  }
  useEffect(() => { if (props.fitRequest === lastFit.current) return; lastFit.current = props.fitRequest;
    if (props.fitRequest !== undefined) cameraAction(viewer => viewer.fit()); }, [props.fitRequest, session, ready]);
  function changeView(view: NativeViewSide) {
    const side = VIEW_SIDES.find(value => value.side === view); if (!side) return;
    cameraAction(viewer => { const camera = viewer.getState().camera, distance = Math.hypot(...camera.eye.map((value, index) => value - camera.target[index])), length = Math.hypot(...side.direction);
      viewer.setView({ ...camera, eye: camera.target.map((value, index) => value + side.direction[index] * distance / length) as [number, number, number], up: [...side.up] }); });
  }
  const selection = snapshot.selection, pending = Object.keys(snapshot.pending.fields).length > 0, mounted = mountedRef.current;
  const busy = snapshot.disposed || !!snapshot.candidate || captured || gesturing || !ready || mounted?.admitting === true;
  const navigationBusy = busy || pending || !receipt || receipt.state.status !== 'ready' || !mounted || mounted.unavailable || mounted.optionsRefused || !aligned(mounted);
  function field(field: CadEditorAssemblyPoseField, value: number, label: string) {
    return <div className="cad-editor-field" key={field}><Label htmlFor={id + '-' + field}>{label}</Label>
      <Input id={id + '-' + field} data-testid={'assembly-' + field} inputMode="decimal" type="text" disabled={busy}
        value={snapshot.pending.fields[field] ?? numberText(value)}
        onCompositionStart={() => { composing.current.add(field); }} onCompositionEnd={() => { composing.current.delete(field); }}
        onChange={event => action(() => session.stagePoseField(field, event.target.value))}
        onKeyDown={event => {
          if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); return; }
          if (event.key !== 'Enter' || event.repeat || event.nativeEvent.isComposing || composing.current.has(field) || event.keyCode === 229
            || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
          event.preventDefault(); event.stopPropagation(); action(() => session.prepareApply());
        }} />
      {snapshot.pending.fields[field] !== undefined && <span className="cad-editor-accepted">Current: {numberText(value)}</span>}
    </div>;
  }
  return <div className="cad-editor cad-editor-assembly" onClickCapture={event => { if (hostBlocked()) { event.preventDefault(); event.stopPropagation(); } }}
    onKeyDownCapture={event => { if (gestureRef.current && event.key !== 'Escape') { event.preventDefault(); event.stopPropagation(); } }}>
    <div ref={viewportRef} className="cad-editor-viewport" data-assembly-ready={ready}>
      <canvas ref={canvasRef} width={640} height={480} tabIndex={0} className="cad-editor-canvas" data-testid="cad-editor-assembly-canvas"
        aria-label="Assembly instances. Drag a local axis to change the selected instance position."
        onPointerDownCapture={event => { if (commandBlocked()) { event.preventDefault(); event.stopPropagation(); } }}
        onWheelCapture={event => { if (commandBlocked()) { event.preventDefault(); event.stopPropagation(); } }}
        onKeyDownCapture={event => { if (event.key === 'Escape' || commandBlocked()) { event.preventDefault(); event.stopPropagation(); } }} />
      <CadEditorViewNavigator camera={ready ? receipt?.state.camera ?? null : null} disabled={navigationBusy} onChoose={changeView} />
      <AssemblyTranslationHandles session={session} canvas={ready ? canvasRef.current : null} receipt={ready ? receipt : null}
        isCurrentFrame={isCurrentFrame} onError={report} onGestureChange={active => { gestureRef.current = active; setGesturing(active); }} />
      {error && <p className="cad-editor-viewport-error" role="alert">{actionable(error)}</p>}
    </div>
    <aside className="cad-editor-inspector" aria-label="Assembly properties">
      <div className="cad-editor-inspector-title"><h2 className="cad-editor-heading">{selection?.binding.instanceId ?? 'Assembly'}</h2>
        <Dialog><DialogTrigger asChild><Button type="button" variant="ghost" size="xs" data-testid="assembly-help" disabled={gesturing}>Help</Button></DialogTrigger>
          <DialogContent className="cad-editor-help-dialog" data-testid="assembly-help-dialog"><DialogHeader><DialogTitle>Assembly placement</DialogTitle>
            <DialogDescription>Move shared parts by changing an instance position and parent.</DialogDescription></DialogHeader>
            <div className="cad-editor-help-body">
              <p>Local position uses the parent frame. Drag X, Y or Z to change one local coordinate. Release applies one change; Escape or pointer cancellation cancels owned movement. Use the fields when an axis is hidden by this view.</p>
              <p>Rotation uses local XYZ degrees, applied as Z × Y × X. Changing a parent keeps the local position and rotation and can change the world position. A parent cannot create a cycle.</p>
              <p>Instances share complete original part documents. Placement does not change original geometry, comments, coefficients or asset references. All native instances remain in the file; the display set contains zero to four selected instances. Hidden selection has fields but no canvas handle.</p>
              <p>The handle uses an actual original-domain midpoint query and the parent world rotation. It does not edit a control point or certify topology, a Solid, manufacturing precision or complete mesh visibility.</p>
              <p>Front looks from +Z, Back from −Z, Right from +X, Left from −X, Top from +Y with −Z up, Bottom from −Y with +Z up, and Iso from +XYZ. These perspective choices preserve target, distance, FOV and clipping. Fit uses the displayed instances.</p>
              <p>Local position is limited to ±10000 mm and each rotation to ±360 degrees. Native Assembly supports four parts, 32 instances and depth 16; Viewer has narrower source, display and world-position limits. Refused changes retain pending text and the accepted view.</p>
              <p>Downloads contain accepted authored Assembly data and complete original parts. Pending values, camera and gestures are excluded. Undo and Redo restore accepted authored poses at fresh Assembly revisions.</p>
              <details className="cad-editor-source"><summary className="cad-editor-source-title">Native and display details</summary>
                <pre>{JSON.stringify({ selection: snapshot.selection, display: receipt, pending: snapshot.pending, history: snapshot.history, report: snapshot.accepted.report }, null, 2)}</pre>
                {error && <pre>{error.code + '\n' + errorDetails(error)}</pre>}
              </details>
            </div><DialogClose asChild><Button type="button" variant="outline" className="cad-editor-export-close" data-testid="assembly-help-close">Close help</Button></DialogClose>
          </DialogContent></Dialog>
      </div>
      {!selection ? <p>Select an instance to edit its local placement.</p> : <>
        <h3>Local position</h3>{positionFields.map((name, axis) => field(name, selection.instance.placement.translationMM[axis], name[0].toUpperCase() + ' (mm)'))}
        <h3>Rotation</h3>{rotationFields.map((name, axis) => field(name, selection.instance.placement.rotationDegreesXYZ[axis], ['X', 'Y', 'Z'][axis] + ' (deg)'))}
        <div className="cad-editor-field"><Label htmlFor={id + '-parent'}>Parent</Label>
          <select id={id + '-parent'} data-testid="assembly-parentId" disabled={busy} value={snapshot.pending.fields.parentId ?? selection.instance.parentId ?? ''}
            onChange={event => action(() => session.stagePoseField('parentId', event.target.value))}>
            <option value="">Assembly root</option>{snapshot.accepted.assembly.instances.map(instance => <option key={instance.id} value={instance.id}>{instance.id}</option>)}
          </select>{snapshot.pending.fields.parentId !== undefined && <span className="cad-editor-accepted">Current: {selection.instance.parentId ?? 'Assembly root'}</span>}
        </div><div className="cad-editor-actions"><Button type="button" data-testid="assembly-apply" disabled={busy || !pending} onClick={() => action(() => session.prepareApply())}>Apply</Button>
          <Button type="button" variant="outline" data-testid="assembly-discard" disabled={busy || !pending} onClick={() => action(() => session.discardPending())}>Discard</Button></div>
      </>}
    </aside>
  </div>;
}
