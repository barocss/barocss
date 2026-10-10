import { useEffect, useId, useRef, useState } from 'react';
import { createViewer, type Viewer, type ViewerOptions, type ViewerState, type ViewerPointerControls, type ViewerKeyboardControls } from '@barocss/viewer';
import { prepareSelectedUniformCurvePreview, type SelectedUniformCurvePreview } from '@barocss/gpu';
import type { NurbsSourceLoftFeatureGraphResult } from '@barocss/cad';
import type { CadEditorLoftSession, CadEditorLoftSnapshot, CadEditorLoftCandidate, CadEditorLoftView, CadEditorLoftPoleField } from '../loft-types.js';
import { CadEditorError } from '../types.js';
import { cn } from '../lib/utils.js';
import { Button } from './ui/button.js';
import { Input } from './ui/input.js';
import { Label } from './ui/label.js';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog.js';
import { LoftSectionHandles, sameLoftData as same } from './loft-section-handles.js';
import { CadEditorViewNavigator, VIEW_SIDES, type NativeViewSide } from './view-navigator.js';

type NativeOptions = NonNullable<Parameters<Viewer['loadNative']>[1]>;
type NodeBinding = NurbsSourceLoftFeatureGraphResult['bindings']['nodes'][number];
type LoftBinding = NurbsSourceLoftFeatureGraphResult['bindings']['loft'];
export interface CadEditorLoftDisplayReceipt {
  view: CadEditorLoftView; binding: NodeBinding | LoftBinding; generation: number; displayGeneration: number;
  source: string | null; preview: SelectedUniformCurvePreview | null; state: ViewerState;
  pixelHash: string; nonBackgroundPixels: number; width: number; height: number; readIndex: number;
  lifecycle: { mounts: number; disposals: number };
}
export interface CadEditorNurbsLoftProps {
  session: CadEditorLoftSession;
  displayOptions?: { viewer: ViewerOptions; native: NativeOptions };
  onDisplay?: (receipt: CadEditorLoftDisplayReceipt) => void;
  onError?: (error: CadEditorError) => void;
  onAccepted?: (snapshot: CadEditorLoftSnapshot, candidate: CadEditorLoftCandidate) => void;
  fitRequest?: number; readRequest?: number;
}
const DEFAULT_OPTIONS: NonNullable<CadEditorNurbsLoftProps['displayOptions']> = {
  viewer: { mmToSceneUnit: 0.01, background: [0.07, 0.08, 0.10] },
  native: { sourceVersion: 0, countU: 17, countV: 17, curveDisplay: { chordToleranceMM: 0.1, maxSegments: 64, maxDepth: 8 } },
};
const fields: CadEditorLoftPoleField[] = ['xMM', 'yMM', 'zMM', 'weight'];
const numberText = (value: number) => Object.is(value, -0) ? '-0' : String(value);
interface LoadedView { view: CadEditorLoftView; binding: NodeBinding | LoftBinding; source: string | null; preview: SelectedUniformCurvePreview | null }
interface Mounted {
  viewer: Viewer; options: NonNullable<CadEditorNurbsLoftProps['displayOptions']>; loaded: LoadedView;
  result: NurbsSourceLoftFeatureGraphResult; generation: number; displayGeneration: number;
  admitting: boolean; optionsRefused: boolean; unavailable: boolean; loftCamera: ViewerState['camera'] | null;
}
function loadView(viewer: Viewer, graph: NurbsSourceLoftFeatureGraphResult, view: CadEditorLoftView,
  options: NativeOptions, camera: ViewerState['camera'] | null, admitted?: () => void): LoadedView {
  let loaded: LoadedView;
  if (view.kind === 'section') {
    const node = graph.evaluatedNodes.find(value => value.nodeId === view.nodeId);
    const binding = graph.bindings.nodes.find(value => value.nodeId === view.nodeId);
    if (!node || !binding || binding.graphId !== graph.document.id || binding.revision !== graph.document.revision
      || binding.sourceId !== node.sourceId || binding.curveId !== node.curveId || binding.sourceModelName !== node.evaluation.model.name)
      throw new CadEditorError('STALE', 'The section source binding is no longer current.', { field: 'loft-view' });
    const preview = prepareSelectedUniformCurvePreview({ source: node.evaluation.source, curveId: node.curveId, count: 65 });
    if (!same(preview.model, node.evaluation.model) || !same(preview.model.objects.find(value => value.id === node.curveId), node.evaluation.curve))
      throw new CadEditorError('DISPLAY', 'The complete section preview differs from its native source.', { field: 'loft-view' });
    viewer.loadSelectedUniformCurvePreview(preview, { basis: 'authored-xyz-matches-rhyup' });
    loaded = { view: structuredClone(view), binding: structuredClone(binding), source: node.evaluation.source, preview };
  } else {
    const binding = graph.bindings.loft, evaluation = graph.loft.evaluation;
    if (binding.graphId !== graph.document.id || binding.revision !== graph.document.revision
      || binding.nodeId !== graph.loft.nodeId || binding.outputSourceId !== graph.loft.outputSourceId || binding.status !== graph.loft.status)
      throw new CadEditorError('STALE', 'The loft output binding is no longer current.', { field: 'loft-view' });
    if (graph.loft.status === 'suppressed') {
      if (evaluation !== null) throw new CadEditorError('DISPLAY', 'The suppressed loft contains an old evaluation.', { field: 'loft-view' });
      viewer.clear();
      loaded = { view: { kind: 'loft' }, binding: structuredClone(binding), source: null, preview: null };
    } else {
      if (!evaluation || binding.modelName !== evaluation.model.name || binding.surfaceId !== evaluation.surface.id)
        throw new CadEditorError('DISPLAY', 'The active loft has no current native output.', { field: 'loft-view' });
      viewer.loadNative(evaluation.source, options);
      loaded = { view: { kind: 'loft' }, binding: structuredClone(binding), source: evaluation.source, preview: null };
    }
  }
  admitted?.();
  if (camera) viewer.setView(camera);
  viewer.selectGeometry(loaded.preview ? { kind: 'curve', modelId: loaded.preview.model.name, curveId: loaded.preview.curveId }
    : loaded.source !== null ? { kind: 'surface', modelId: graph.bindings.loft.modelName, surfaceId: graph.bindings.loft.surfaceId } : null);
  return loaded;
}
function checkFrame(state: ViewerState, loaded: LoadedView, graph: NurbsSourceLoftFeatureGraphResult, nonBackgroundPixels: number) {
  const expectedStatus = loaded.source === null ? 'empty' : 'ready';
  if (state.status !== expectedStatus || state.document !== null || state.documentBodies.length !== 0)
    throw new CadEditorError('DISPLAY', 'The actual frame differs from the native loft view.', { field: 'loft-frame' });
  if (loaded.preview) {
    if (state.native !== null || state.curveSampleVersion !== 3 || !same(state.selectedUniformCurve, loaded.preview)
      || state.visibleGeometry.length !== 1 || !state.visibleGeometry.some(ref => ref.kind === 'curve'
        && ref.modelId === loaded.preview!.model.name && ref.curveId === loaded.preview!.curveId))
      throw new CadEditorError('DISPLAY', 'The actual section frame differs from the complete native preview.', { field: 'loft-frame' });
  } else if (loaded.source === null) {
    if (graph.loft.status !== 'suppressed' || graph.loft.evaluation !== null || state.native !== null
      || state.selectedUniformCurve !== null || state.visibleGeometry.length !== 0 || nonBackgroundPixels !== 0)
      throw new CadEditorError('DISPLAY', 'The suppressed loft is not an empty displayed frame.', { field: 'loft-frame' });
  } else {
    const evaluation = graph.loft.evaluation!;
    const refs = evaluation.model.objects.map(object => object.kind === 'curve'
      ? { kind: 'curve' as const, modelId: evaluation.model.name, curveId: object.id }
      : { kind: 'surface' as const, modelId: evaluation.model.name, surfaceId: object.id });
    if (state.native?.source !== loaded.source || !same(state.native?.model, evaluation.model) || state.selectedUniformCurve !== null
      || refs.length !== state.visibleGeometry.length || refs.some(ref => !state.visibleGeometry.some(actual => same(actual, ref))))
      throw new CadEditorError('DISPLAY', 'The actual generated source frame differs from its qualified loft output.', { field: 'loft-frame' });
  }
}
function details(error: CadEditorError): string {
  const messages: string[] = []; let cause: unknown = error;
  for (let depth = 0; depth < 6 && cause instanceof Error; depth++) { messages.push(cause.message); cause = cause.cause; }
  return messages.join('\n');
}
function actionable(error: CadEditorError): string {
  if (error.context.field === 'restore-frame') return 'Cannot restore the current view. Reopen the loft view.';
  if (error.code === 'DISPLAY') return 'Cannot display this change. The current view is retained.';
  if (error.code === 'STALE') return 'The section or view changed. Review the pending values.';
  if (/weight/i.test(details(error))) return 'Enter a weight from 0.000001 to 1000000.';
  if (/finite|decimal|exponent/i.test(details(error))) return 'Enter finite coordinates and weight.';
  if (/coordinate|1000000/i.test(details(error))) return 'Keep X, Y and Z from -1000000 to 1000000 mm.';
  return 'The change was not applied. Review the point values or current view.';
}

/** A source-qualified Loft family. Its native graph is never represented as a canonical document or Boolean graph. */
export function CadEditorNurbsLoftEditor(props: CadEditorNurbsLoftProps) {
  const { session } = props, id = useId();
  const [snapshot, setSnapshot] = useState(() => session.getSnapshot());
  useEffect(() => { const stop = session.subscribe(setSnapshot); setSnapshot(session.getSnapshot()); return stop; }, [session]);
  const propsRef = useRef(props); propsRef.current = props;
  const canvasRef = useRef<HTMLCanvasElement>(null), viewportRef = useRef<HTMLDivElement>(null), mountedRef = useRef<Mounted | null>(null);
  const readIndex = useRef(0), lifecycle = useRef({ mounts: 0, disposals: 0 }), gestureRef = useRef(false);
  const pointers = useRef(new Set<number>()), composing = useRef(new Set<CadEditorLoftPoleField>());
  const lastFitRequest = useRef(props.fitRequest);
  const [ready, setReady] = useState(false), [captured, setCaptured] = useState(false);
  const [gestureActive, setGestureActive] = useState(false), [receipt, setReceipt] = useState<CadEditorLoftDisplayReceipt | null>(null);
  const [error, setError] = useState<CadEditorError | null>(null);
  function captureFor(pointerId: number) { return [document.documentElement, ...document.querySelectorAll('*')].some(element => element.hasPointerCapture(pointerId)); }
  function hasCapture() { return [...pointers.current].some(captureFor); }
  function hostBlocked() { return gestureRef.current || hasCapture() || !!canvasRef.current?.closest('[data-loft-host-busy="true"]'); }
  function unsafeViewCommand() {
    const mounted = mountedRef.current, current = session.getSnapshot(), canvas = canvasRef.current, rect = canvas?.getBoundingClientRect();
    return hostBlocked() || !mounted || mounted.admitting || mounted.unavailable || mounted.optionsRefused || !canvas?.isConnected
      || !rect || rect.width <= 0 || rect.height <= 0 || current.disposed || !!current.candidate || Object.keys(current.pending.fields).length > 0
      || viewportRef.current?.getAttribute('data-loft-ready') !== 'true'
      || document.querySelector('[role="dialog"][data-state="open"],[role="menu"]') !== null;
  }
  function navigationBlocked() {
    if (unsafeViewCommand()) return true;
    const mounted = mountedRef.current!, current = session.getSnapshot();
    return mounted.viewer.getState().status !== 'ready' || mounted.generation !== current.generation
      || mounted.displayGeneration !== current.displayGeneration || !same(mounted.loaded.view, current.view);
  }
  useEffect(() => {
    let listening = true;
    const down = (event: PointerEvent) => { pointers.current.add(event.pointerId); setTimeout(() => { if (listening) setCaptured(hasCapture()); }, 0); };
    const release = (event: PointerEvent) => {
      if (!captureFor(event.pointerId)) pointers.current.delete(event.pointerId);
      setTimeout(() => { if (listening) { if (!captureFor(event.pointerId)) pointers.current.delete(event.pointerId); setCaptured(hasCapture()); } }, 0);
    };
    window.addEventListener('pointerdown', down, true); window.addEventListener('pointerup', release, true);
    window.addEventListener('pointercancel', release, true); window.addEventListener('lostpointercapture', release, true);
    return () => { listening = false; pointers.current.clear(); window.removeEventListener('pointerdown', down, true);
      window.removeEventListener('pointerup', release, true); window.removeEventListener('pointercancel', release, true); window.removeEventListener('lostpointercapture', release, true); };
  }, [session]);
  function read(mounted: Mounted, loaded = mounted.loaded, graph = mounted.result): CadEditorLoftDisplayReceipt {
    const canvas = canvasRef.current!, pixels = mounted.viewer.readPixels(), state = mounted.viewer.getState();
    if (pixels.length !== canvas.width * canvas.height * 4) throw new CadEditorError('DISPLAY', 'The loft RGBA read is incomplete.', { field: 'pixel-read' });
    const background = (mounted.options.viewer.background ?? DEFAULT_OPTIONS.viewer.background!).map(value => Math.round(value * 255));
    let hash = 2166136261, nonBackgroundPixels = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      if ([0, 1, 2].some(channel => Math.abs(pixels[index + channel] - background[channel]) > 2)) nonBackgroundPixels++;
      for (let channel = 0; channel < 4; channel++) hash = Math.imul(hash ^ pixels[index + channel], 16777619) >>> 0;
    }
    checkFrame(state, loaded, graph, nonBackgroundPixels);
    return { ...structuredClone(loaded), generation: mounted.generation, displayGeneration: mounted.displayGeneration,
      state, pixelHash: hash.toString(16).padStart(8, '0'), nonBackgroundPixels, width: canvas.width, height: canvas.height,
      readIndex: ++readIndex.current, lifecycle: { ...lifecycle.current } };
  }
  function publish(value: CadEditorLoftDisplayReceipt) {
    const mounted = mountedRef.current;
    if (mounted && value.view.kind === 'loft') mounted.loftCamera = structuredClone(value.state.camera);
    setReceipt(structuredClone(value));
    try { propsRef.current.onDisplay?.(structuredClone(value)); }
    catch (cause) { report(new CadEditorError('DISPLAY', 'Loft display callback failed.', { field: 'display-callback' }, cause), false); }
  }
  function report(cause: unknown, freshRead = true) {
    const diagnostic = cause instanceof CadEditorError ? cause : new CadEditorError('DISPLAY', cause instanceof Error ? cause.message : 'The loft display operation was refused.', { field: 'loft-display' }, cause);
    setError(diagnostic);
    const mounted = mountedRef.current;
    if (mounted && (diagnostic.context.field === 'restore-frame' || ['context-lost', 'unavailable'].includes(mounted.viewer.getState().status))) {
      mounted.unavailable = true; setReady(false);
    }
    try { propsRef.current.onError?.(diagnostic); } catch { /* Observers cannot accept or discard native work. */ }
    if (mounted && freshRead && !mounted.unavailable) try { publish(read(mounted)); }
    catch (readCause) { report(new CadEditorError('DISPLAY', 'Reading the current loft frame failed.', { field: 'pixel-read' }, readCause), false); }
  }
  function action(run: () => unknown) {
    const current = session.getSnapshot(); if (hostBlocked() || current.disposed || current.candidate) return;
    try { run(); setError(null); } catch (cause) { report(cause); }
  }
  function currentHandleFrame(frame: CadEditorLoftDisplayReceipt) {
    const mounted = mountedRef.current, current = session.getSnapshot();
    if (!mounted || mounted.admitting || mounted.unavailable || mounted.optionsRefused || mounted.viewer.getState().status !== 'ready'
      || mounted.generation !== current.generation || mounted.displayGeneration !== current.displayGeneration
      || !same(mounted.loaded.view, current.view) || !same(frame.binding, mounted.loaded.binding)
      || viewportRef.current?.getAttribute('data-loft-ready') !== 'true') return false;
    const state = mounted.viewer.getState();
    return same(state.camera, frame.state.camera) && Object.is(state.mmToSceneUnit, frame.state.mmToSceneUnit)
      && same(state.selectedUniformCurve, frame.preview) && state.document === null && state.documentBodies.length === 0;
  }
  useEffect(() => {
    const canvas = canvasRef.current!; let viewer: Viewer | null = null, observer: ResizeObserver | null = null;
    let pointer: ViewerPointerControls | null = null, keyboard: ViewerKeyboardControls | null = null, published = false;
    setReady(false); setReceipt(null); setError(null); readIndex.current = 0;
    function publishCamera() { const mounted = mountedRef.current; if (published && mounted && !mounted.admitting && !mounted.unavailable) try { publish(read(mounted)); } catch (cause) { report(cause); } }
    function resize() {
      const mounted = mountedRef.current, rect = canvas.getBoundingClientRect(); if (!mounted || mounted.unavailable || rect.width <= 0 || rect.height <= 0) return;
      const ratio = Math.min(window.devicePixelRatio || 1, 2), width = Math.min(4096, Math.max(1, Math.round(rect.width * ratio))), height = Math.min(4096, Math.max(1, Math.round(rect.height * ratio)));
      const scale = Math.min(1, Math.sqrt(4194304 / (width * height)));
      const nextWidth = Math.max(1, Math.floor(width * scale)), nextHeight = Math.max(1, Math.floor(height * scale));
      if (canvas.width === nextWidth && canvas.height === nextHeight) return;
      try { mounted.viewer.resize(nextWidth, nextHeight); publishCamera(); } catch (cause) { report(cause); }
    }
    try {
      const current = session.getSnapshot(), options = structuredClone(propsRef.current.displayOptions ?? DEFAULT_OPTIONS);
      viewer = createViewer(canvas, options.viewer); lifecycle.current.mounts++;
      const loaded: LoadedView = { view: current.view, binding: current.accepted.bindings.loft, source: null, preview: null };
      const mounted: Mounted = { viewer, options, loaded, result: current.accepted, generation: current.generation, displayGeneration: current.displayGeneration,
        admitting: false, optionsRefused: false, unavailable: false, loftCamera: null };
      mountedRef.current = mounted; resize(); mounted.loaded = loadView(viewer, current.accepted, current.view, options.native, null);
      const first = read(mounted); published = true; setReady(true); publish(first);
      pointer = viewer.attachPointerControls({ onError: report }); keyboard = viewer.attachKeyboardControls({ onError: report });
      canvas.addEventListener('pointerup', publishCamera); canvas.addEventListener('wheel', publishCamera); canvas.addEventListener('keydown', publishCamera);
      observer = new ResizeObserver(resize); observer.observe(canvas);
    } catch (cause) { report(cause, false); observer?.disconnect(); pointer?.dispose(); keyboard?.dispose();
      if (viewer) { viewer.dispose(); lifecycle.current.disposals++; viewer = null; } mountedRef.current = null; }
    return () => {
      observer?.disconnect(); canvas.removeEventListener('pointerup', publishCamera); canvas.removeEventListener('wheel', publishCamera); canvas.removeEventListener('keydown', publishCamera);
      pointer?.dispose(); keyboard?.dispose();
      if (viewer) { const mounted = mountedRef.current; viewer.dispose(); lifecycle.current.disposals++;
        if (mounted) try { propsRef.current.onDisplay?.({ ...structuredClone(mounted.loaded), generation: mounted.generation, displayGeneration: mounted.displayGeneration,
          state: viewer.getState(), pixelHash: '', nonBackgroundPixels: 0, width: canvas.width, height: canvas.height, readIndex: readIndex.current, lifecycle: { ...lifecycle.current } }); } catch {} }
      mountedRef.current = null;
    };
  }, [session]);
  useEffect(() => {
    const mounted = mountedRef.current; if (!mounted || mounted.admitting || mounted.unavailable) return;
    const next = structuredClone(props.displayOptions ?? DEFAULT_OPTIONS);
    try {
      if (!same(next.viewer, mounted.options.viewer)) { mounted.optionsRefused = true; throw new CadEditorError('DISPLAY', 'Viewer options require reopening the loft view.', { field: 'loft-options' }); }
      if (same(next.native, mounted.options.native)) { mounted.optionsRefused = false; return; }
      const before = mounted.viewer.getState(), current = session.getSnapshot(); let displayed = false;
      try {
        const loaded = loadView(mounted.viewer, current.accepted, current.view, next.native, before.camera, () => { displayed = true; });
        const value = read(mounted, loaded, current.accepted);
        mounted.loaded = loaded; mounted.result = current.accepted; mounted.generation = current.generation; mounted.displayGeneration = current.displayGeneration;
        value.generation = current.generation; value.displayGeneration = current.displayGeneration;
        mounted.options = next; mounted.optionsRefused = false; setError(null); publish(value);
      } catch (cause) {
        mounted.optionsRefused = true;
        if (displayed) try { mounted.loaded = loadView(mounted.viewer, mounted.result, mounted.loaded.view, mounted.options.native, before.camera); }
        catch (restoreCause) { report(new CadEditorError('DISPLAY', 'Restoring the loft frame failed.', { field: 'restore-frame' }, restoreCause), false); return; }
        throw cause;
      }
    } catch (cause) { report(cause); }
  }, [props.displayOptions, session, ready]);
  useEffect(() => {
    const mounted = mountedRef.current; if (!mounted || mounted.admitting) return;
    const current = session.getSnapshot(), candidate = current.candidate; if (!candidate) return;
    const before = mounted.viewer.getState(), priorLoaded = mounted.loaded, priorResult = mounted.result, priorCamera = mounted.loftCamera;
    mounted.admitting = true; let displayed = false;
    try {
      if (mounted.unavailable || mounted.optionsRefused) throw new CadEditorError('DISPLAY', 'Resolve the display error before applying.', { field: 'loft-display' });
      if (candidate.baseGeneration !== current.generation || candidate.baseDisplayGeneration !== current.displayGeneration
        || mounted.generation !== current.generation || mounted.displayGeneration !== current.displayGeneration)
        throw new CadEditorError('STALE', 'The prepared loft display is no longer current.', { field: 'loft-view' });
      const camera = candidate.kind === 'open' ? null : candidate.view.kind === priorLoaded.view.kind ? before.camera
        : candidate.view.kind === 'loft' ? priorCamera : null;
      const loaded = loadView(mounted.viewer, candidate.result, candidate.view, mounted.options.native, camera, () => { displayed = true; });
      const value = read(mounted, loaded, candidate.result), latest = session.getSnapshot();
      if (latest.candidate?.token !== candidate.token || latest.generation !== candidate.baseGeneration || latest.displayGeneration !== candidate.baseDisplayGeneration)
        throw new CadEditorError('STALE', 'The prepared loft candidate changed before admission.', { field: 'loft-view' });
      const accepted = session.acceptCandidate(candidate.token);
      mounted.loaded = loaded; mounted.result = accepted.accepted; mounted.generation = accepted.generation; mounted.displayGeneration = accepted.displayGeneration;
      if (candidate.kind === 'open') mounted.loftCamera = null;
      value.generation = accepted.generation; value.displayGeneration = accepted.displayGeneration; setError(null); publish(value);
      try { propsRef.current.onAccepted?.(structuredClone(accepted), structuredClone(candidate)); }
      catch (cause) { report(new CadEditorError('DISPLAY', 'Loft acceptance callback failed.', { field: 'accepted-callback' }, cause)); }
    } catch (cause) {
      let restoreFailure: unknown;
      if (displayed) try {
        mounted.loaded = loadView(mounted.viewer, priorResult, priorLoaded.view, mounted.options.native, before.camera);
        mounted.result = priorResult; mounted.loftCamera = priorCamera; publish(read(mounted));
      } catch (restoreCause) { restoreFailure = restoreCause; }
      try { session.cancelCandidate(candidate.token); } catch { /* Another private candidate owns the current token. */ }
      report(cause, restoreFailure === undefined);
      if (restoreFailure !== undefined) report(new CadEditorError('DISPLAY', 'Restoring the loft frame failed.', { field: 'restore-frame' }, restoreFailure), false);
    } finally { mounted.admitting = false; }
  }, [snapshot.candidate?.token, session, ready]);
  useEffect(() => {
    const mounted = mountedRef.current; if (!mounted || mounted.admitting || mounted.unavailable || props.readRequest === undefined) return;
    try { publish(read(mounted)); } catch (cause) { report(cause, false); }
  }, [props.readRequest, session, ready]);
  useEffect(() => {
    const request = props.fitRequest; if (request === lastFitRequest.current) return; lastFitRequest.current = request;
    const mounted = mountedRef.current; if (!mounted || request === undefined || unsafeViewCommand()) return;
    const before = mounted.viewer.getState().camera;
    try { mounted.viewer.fit(); publish(read(mounted)); }
    catch (cause) { try { mounted.viewer.setView(before); publish(read(mounted)); }
      catch (restoreCause) { report(new CadEditorError('DISPLAY', 'Restoring the loft camera failed.', { field: 'restore-frame' }, restoreCause), false); return; } report(cause); }
  }, [props.fitRequest, session, ready]);
  function changeView(view: NativeViewSide) {
    if (navigationBlocked()) return;
    const mounted = mountedRef.current!, before = mounted.viewer.getState().camera;
    const generation = mounted.generation, displayGeneration = mounted.displayGeneration, controlledView = structuredClone(mounted.loaded.view);
    const savedLoftCamera = mounted.loftCamera === null ? null : structuredClone(mounted.loftCamera);
    const side = VIEW_SIDES.find(value => value.side === view); if (!side) return;
    const distance = Math.hypot(...before.eye.map((value, index) => value - before.target[index])), length = Math.hypot(...side.direction);
    try {
      mounted.viewer.setView({ ...before, eye: before.target.map((value, index) => value + side.direction[index] * distance / length) as [number, number, number], up: [...side.up] });
      const value = read(mounted), current = session.getSnapshot();
      if (navigationBlocked() || current.generation !== generation || current.displayGeneration !== displayGeneration || !same(current.view, controlledView))
        throw new CadEditorError('STALE', 'The loft or view changed before the camera frame was published.', { field: 'loft-camera' });
      setError(null); publish(value);
    } catch (cause) {
      try { mounted.viewer.setView(before); publish(read(mounted)); }
      catch (restoreCause) { mounted.loftCamera = savedLoftCamera;
        report(new CadEditorError('DISPLAY', 'Restoring the loft camera failed.', { field: 'restore-frame' }, restoreCause), false); return; }
      report(cause);
    }
  }
  const selection = snapshot.selection, hasPending = Object.keys(snapshot.pending.fields).length > 0;
  const busy = snapshot.disposed || !!snapshot.candidate || captured || gestureActive || !ready;
  const mounted = mountedRef.current;
  const navigationBusy = busy || hasPending || !receipt || receipt.state.status !== 'ready' || !mounted
    || mounted.unavailable || mounted.optionsRefused || mounted.admitting || mounted.viewer.getState().status !== 'ready'
    || mounted.generation !== snapshot.generation || mounted.displayGeneration !== snapshot.displayGeneration || !same(mounted.loaded.view, snapshot.view);
  const sectionIndex = selection ? snapshot.accepted.bindings.loft.sections.findIndex(value => value.nodeId === selection.nodeId) : -1;
  return <div className={cn('cad-editor cad-editor-loft')} onClickCapture={event => { if (hostBlocked()) { event.preventDefault(); event.stopPropagation(); } }}
    onKeyDownCapture={event => { if (gestureRef.current && event.key !== 'Escape') { event.preventDefault(); event.stopPropagation(); } }}>
    <div ref={viewportRef} className="cad-editor-viewport" data-loft-ready={ready}>
      <canvas ref={canvasRef} width={640} height={480} tabIndex={0} className="cad-editor-canvas" data-testid="cad-editor-loft-canvas"
        aria-label="Native NURBS loft view. Focus an original section to edit its points."
        onPointerDownCapture={event => { if (unsafeViewCommand()) { event.preventDefault(); event.stopPropagation(); } }}
        onWheelCapture={event => { if (unsafeViewCommand()) { event.preventDefault(); event.stopPropagation(); } }}
        onKeyDownCapture={event => { if (event.key === 'Escape' || unsafeViewCommand()) { event.preventDefault(); event.stopPropagation(); } }} />
      <CadEditorViewNavigator camera={ready ? receipt?.state.camera ?? null : null} disabled={navigationBusy} onChoose={changeView} />
      <LoftSectionHandles session={session} canvas={canvasRef.current} receipt={receipt} isCurrentFrame={currentHandleFrame} onError={report}
        onGestureChange={active => { gestureRef.current = active; setGestureActive(active); }} />
      {error && <p className="cad-editor-viewport-error" role="alert">{actionable(error)}</p>}
    </div>
    <aside className="cad-editor-inspector" aria-label="Original section point inspector">
      <div className="cad-editor-inspector-title"><h2 className="cad-editor-heading">{selection ? 'Section ' + (sectionIndex + 1) : 'Loft'}</h2>
        <Dialog><DialogTrigger asChild><Button type="button" variant="ghost" size="xs" disabled={captured || gestureActive} data-testid="loft-help">Help</Button></DialogTrigger>
          <DialogContent className="cad-editor-help-dialog" data-testid="loft-help-dialog"><DialogHeader><DialogTitle>NURBS section and loft help</DialogTitle>
            <DialogDescription>Original section points and their dependent loft.</DialogDescription></DialogHeader>
            <div className="cad-editor-help-body">
              <p>Focus Section 1, 2 or 3 to edit its original control points. Point numbers start at 1. X, Y and Z use authored millimetres; weight is dimensionless. Apply updates the complete retained node recipe and regenerates the dependent loft.</p>
              <p>Drag a point in the camera-facing plane. The pending control polygon is a guide; the accepted Curve and Loft stay unchanged until release, native evaluation, real Viewer admission and a complete RGBA read. One accepted release adds one history entry. Escape or pointer cancellation restores only a still-owned draft and its previous point selection. A changed section, camera, size or foreign draft keeps corrective values.</p>
              <p>Enter applies fields outside composition. Tab changes focus only. Escape in a field keeps the draft. Apply or discard before selecting another point or view. Equal native values are a true no-op without a new revision or history state.</p>
              <p>Coordinates must stay within -1000000 to 1000000 mm, and weights from 0.000001 to 1000000. Native representability, source and display limits can refuse a smaller change. Raw fields retain full precision and signed zero.</p>
              <p>The output is an independent generated Model containing three construction Curves and one piecewise rational Surface. It is not the original mixed source. Original complete source files and unrelated objects remain accepted authority. The loft is C0 between its explicit stations; smoothness, G1, G2, topology, Solid and manufacturing are not certified.</p>
              <p>Section focus admits the complete current edited source, never an extracted Curve. The current preview supports at most four original Model objects and 65536 UTF-8 bytes and code units, with 65 uniform observations. A broader original source remains native data but can refuse display. Generated output display has its own actual native and GPU admission.</p>
              <p>Return to Loft restores its saved camera and current exact generated source. Suppress returns to Loft and clears the actual Viewer; it does not display an old Surface as suppressed. Resume rebuilds the native output. A supported original section can remain available for focus while the Loft is suppressed. Fit uses the existing display recipe and can change orientation.</p>
              <p>The view buttons keep perspective, camera target, distance, field of view and clipping planes. Front looks from +Z, Back from -Z, Right from +X, Left from -X, Top from +Y, Bottom from -Y and Iso from +XYZ. The status follows the actual camera; orbit can show Custom. Empty suppressed output disables these controls; a displayed original section remains available. A side can hide geometry or points edge-on. Camera choices do not change sources, selection, native history or display generation.</p>
              <p>Downloads contain accepted authored sources and complete recipes, not generated-only meshes, pending text, camera or gestures. Undo and Redo rebuild saved authored states at fresh native revisions and rebind the original section selection. View changes use a separate display generation and do not add native history.</p>
              <details className="cad-editor-source"><summary className="cad-editor-source-title">Source and native details</summary>
                <pre>{JSON.stringify({ binding: receipt?.binding, view: snapshot.view, pending: snapshot.pending,
                  history: snapshot.history, transaction: snapshot.lastTransaction?.report, quality: snapshot.accepted.report.quality }, null, 2)}</pre>
                {snapshot.accepted.originalSources.map(source => <details key={source.sourceId}><summary>{source.sourceId} · {source.model.name}</summary><pre>{source.source}</pre></details>)}
                {receipt?.source && <details><summary>Current displayed source</summary><pre>{receipt.source}</pre></details>}
                {error && <pre>{error.code + '\n' + details(error)}</pre>}
              </details>
            </div><DialogClose asChild><Button type="button" variant="outline" className="cad-editor-export-close" data-testid="loft-help-close">Close help</Button></DialogClose>
          </DialogContent>
        </Dialog>
      </div>
      {!selection ? <p>Focus a section to edit its original points.</p> : <>
        <p className="cad-editor-properties-note">Original point · XYZ / mm</p>
        <div className="cad-editor-field"><Label htmlFor={id + '-point'}>Point</Label>
          <select id={id + '-point'} data-testid="loft-point" value={selection.index} disabled={busy || hasPending}
            onChange={event => action(() => session.selectPole({ nodeId: selection.nodeId, index: Number(event.target.value), binding: selection.binding }))}>
            {Array.from({ length: selection.poleCount }, (_, index) => <option key={index} value={index}>Point {index + 1}</option>)}
          </select>
        </div>
        {fields.map(field => <div className="cad-editor-field" key={field}><Label htmlFor={id + '-' + field}>{field === 'weight' ? 'Weight' : field[0].toUpperCase() + ' (mm)'}</Label>
          <Input id={id + '-' + field} data-testid={'loft-' + field} type="text" inputMode="decimal" disabled={busy}
            value={snapshot.pending.fields[field] ?? numberText(selection.accepted[field])}
            onCompositionStart={() => { composing.current.add(field); }} onCompositionEnd={() => { composing.current.delete(field); }}
            onChange={event => action(() => session.stagePoleField(field, event.target.value))}
            onKeyDown={event => {
              if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); return; }
              if (event.key !== 'Enter' || event.nativeEvent.isComposing || composing.current.has(field) || event.keyCode === 229 || event.repeat
                || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
              event.preventDefault(); event.stopPropagation(); action(() => session.prepareApply());
            }} />
          {snapshot.pending.fields[field] !== undefined && <span className="cad-editor-accepted">Current: {numberText(selection.accepted[field])}</span>}
        </div>)}
        <div className="cad-editor-actions"><Button type="button" data-testid="loft-apply" disabled={busy || !hasPending} onClick={() => action(() => session.prepareApply())}>Apply</Button>
          <Button type="button" variant="outline" data-testid="loft-discard" disabled={busy || !hasPending} onClick={() => action(() => session.discardPending())}>Discard</Button></div>
      </>}
    </aside>
  </div>;
}
