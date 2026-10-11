import { useEffect, useRef, useState } from 'react';
import { createViewer } from '@barocss/viewer';
import type { Viewer, ViewerKeyboardControls, ViewerPointerControls, ViewerState } from '@barocss/viewer';
import { CadEditorError } from '../types.js';
import type { CadEditorSession, CadEditorView } from '../types.js';
import { createCadGeometryReference, type CadDocumentResult } from '@barocss/cad';
import { cn } from '../lib/utils.js';
import { useCadEditorSnapshot } from './use-session.js';
import type { CadEditorDisplayOptions, CadEditorDisplayReceipt, CadEditorCurveFocusReceipt, CadEditorCurvePresentationReceipt, CadEditorViewportProps } from './types.js';
import { prepareFocusedCurve } from './curve-focus.js';
import type { FocusedCurveBinding } from './curve-focus.js';
import { CurveIntervalHandles } from './curve-interval-handles.js';
import { useCurveInterval } from './curve-interval.js';
import { CurvePoleHandles } from './curve-pole-handles.js';
import { SurfacePoleHandles } from './surface-pole-handles.js';
import { PoleAxisGizmo } from './pole-axis-gizmo.js';
import { CadEditorViewNavigator, VIEW_SIDES, type NativeViewSide } from './view-navigator.js';
import { SelectionIsolation } from './selection-isolation.js';
import { SurfaceDegreeElevationControls } from './surface-degree-elevation.js';
import { useSurfaceRegion } from './surface-region.js';
import { SurfaceRegionHandles } from './surface-region-handles.js';
import { useCurveSplit, curveSplitCurve } from './curve-split.js';
import { CurveSplitHandles } from './curve-split-handles.js';
import { useSurfaceSplit } from './surface-split.js';
import { SurfaceSplitHandles } from './surface-split-handles.js';
import { CurveReversalControls } from './curve-reversal.js';
import { SurfaceReversalControls } from './surface-reversal.js';
import { useSurfaceKnot, surfaceKnotSurface } from './surface-knot.js';
import { SurfaceKnotHandles } from './surface-knot-handles.js';
import { useCurveKnot, curveKnotCurve } from './curve-knot.js';
import { CurveKnotHandles } from './curve-knot-handles.js';
import { resolveCurveControlPresentation, type CurveControlPresentation } from './curve-control-presentation.js';
import { SurfaceIsoCurveHandles } from './surface-isocurve-handles.js';
import { useSurfaceIsoCurve } from './surface-isocurve.js';
import { resolveBodyMovePresentation, type BodyMovePresentation } from './body-move-presentation.js';

interface MountedViewer {
  session: CadEditorSession;
  viewer: Viewer;
  options: CadEditorDisplayOptions;
  generation: number;
  displayGeneration: number;
  admitting: boolean;
  optionsRefused: boolean;
  view: CadEditorView;
  focus: FocusedCurveBinding | null;
  documentCamera: ViewerState['camera'] | null;
  unavailable: boolean;
}

function sameOptions(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) return false;
  const keys = Reflect.ownKeys(a);
  const otherKeys = Reflect.ownKeys(b);
  return keys.length === otherKeys.length && keys.every(key => otherKeys.includes(key)
    && sameOptions(Reflect.get(a, key), Reflect.get(b, key)));
}

function selectBody(viewer: Viewer, bodyId: string | null) {
  const current = viewer.getState();
  const ref = bodyId === null ? null
    : current.documentBodies.find(body => body.binding.bodyId === bodyId)?.ref ?? null;
  if (sameOptions(current.selectedGeometry, ref)) return;
  viewer.selectGeometry(ref);
}

function selectView(viewer: Viewer, bodyId: string | null, focus: FocusedCurveBinding | null) {
  if (!focus) { selectBody(viewer, bodyId); return; }
  const ref = bodyId === focus.reference.bodyId ? { kind: 'curve' as const, modelId: focus.sourceModelName, curveId: focus.curveId } : null;
  if (!sameOptions(viewer.getState().selectedGeometry, ref)) viewer.selectGeometry(ref);
}

function loadView(viewer: Viewer, result: CadDocumentResult, view: CadEditorView,
  options: CadEditorDisplayOptions, bodyIds: string[], camera?: ViewerState['camera'] | null,
  loaded?: () => void): FocusedCurveBinding | null {
  let focus: FocusedCurveBinding | null = null;
  if (view.kind === 'curve-focus') {
    focus = prepareFocusedCurve(result, view.bodyId, view.count);
    viewer.loadSelectedUniformCurvePreview(focus.preview, { basis: options.document.basis });
  } else viewer.loadDocument(result, documentOptions(options.document, bodyIds));
  loaded?.();
  if (camera) viewer.setView(camera);
  return focus;
}

function documentOptions(options: CadEditorDisplayOptions['document'], bodyIds: string[]) {
  return { ...options, bodyIds: [...bodyIds] };
}

function fitDisplayed(viewer: Viewer) {
  const state = viewer.getState();
  if (state.selectedUniformCurve) { viewer.fit(); return; }
  const documentRevision = state.document?.document.revision;
  const refs = state.documentBodies.map(body => body.ref).filter(ref =>
    state.visibleGeometry.some(visible => sameOptions(visible, ref)));
  if (documentRevision === undefined || refs.length === 0) {
    throw new CadEditorError('DISPLAY', 'A displayed native document body is required for fitting.');
  }
  if (refs.length === 1) viewer.fitNativeDocumentBody({ ref: refs[0], documentRevision });
  else viewer.fitNativeDocumentBodies({ refs, documentRevision });
}

function restoreSelection(viewer: Viewer, state: ViewerState) {
  const previous = state.selectedGeometry;
  const current = viewer.getState();
  viewer.selectGeometry(previous !== null && (current.documentBodies.some(body => sameOptions(body.ref, previous))
    || current.selectedUniformCurve !== null && current.visibleGeometry.some(ref => sameOptions(ref, previous)))
    ? previous : null);
}

function displayReceipt(viewer: Viewer, canvas: HTMLCanvasElement,
  background: [number, number, number], lifecycle: CadEditorDisplayReceipt['lifecycle'],
  readIndex: { current: number }): CadEditorDisplayReceipt {
  const pixels = viewer.readPixels();
  if (pixels.length !== canvas.width * canvas.height * 4) {
    throw new CadEditorError('DISPLAY', 'Viewer returned an incomplete pixel frame.');
  }
  let hash = 2166136261;
  let nonBackgroundPixels = 0;
  const backgroundRGB = background.map(value => Math.round(value * 255)) as [number, number, number];
  for (let index = 0; index < pixels.length; index += 4) {
    if (Math.abs(pixels[index] - backgroundRGB[0]) > 2
      || Math.abs(pixels[index + 1] - backgroundRGB[1]) > 2
      || Math.abs(pixels[index + 2] - backgroundRGB[2]) > 2) nonBackgroundPixels++;
    for (let channel = 0; channel < 4; channel++) hash = Math.imul(hash ^ pixels[index + channel], 16777619) >>> 0;
  }
  return { state: viewer.getState(), pixelHash: hash.toString(16).padStart(8, '0'), readIndex: ++readIndex.current,
    nonBackgroundPixels, pixelCount: canvas.width * canvas.height,
    width: canvas.width, height: canvas.height, backgroundRGB, lifecycle: { ...lifecycle } };
}

function checkFocusFrame(receipt: Pick<CadEditorDisplayReceipt, 'state'>, focus: FocusedCurveBinding | null) {
  if (focus && (receipt.state.status !== 'ready' || receipt.state.native !== null || receipt.state.document !== null || receipt.state.documentBodies.length !== 0
    || receipt.state.visibleGeometry.length !== 1 || !receipt.state.visibleGeometry.some(ref => ref.kind === 'curve' && ref.modelId === focus.sourceModelName && ref.curveId === focus.curveId)
    || receipt.state.curveSampleVersion !== 3 || !sameOptions(receipt.state.selectedUniformCurve, focus.preview))) {
    throw new CadEditorError('DISPLAY', 'The actual Curve frame does not match its qualified focus binding.', { field: 'curve-focus' });
  }
}

function checkDocumentFrame(receipt: Pick<CadEditorDisplayReceipt, 'state'>, result: CadDocumentResult, bodyIds: string[]) {
  if (!sameOptions(receipt.state.document, result) || receipt.state.selectedUniformCurve !== null
    || receipt.state.documentBodies.length !== bodyIds.length || receipt.state.documentBodies.some(body =>
      !bodyIds.includes(body.binding.bodyId) || body.binding.documentId !== result.document.documentId
      || body.binding.documentRevision !== result.document.revision)) {
    throw new CadEditorError('DISPLAY', 'The actual document frame does not match the admitted native candidate.', { field: 'document-frame' });
  }
}

export function CadEditorViewport(props: CadEditorViewportProps) {
  const { session, className } = props;
  const snapshot = useCadEditorSnapshot(session);
  const interval = useCurveInterval();
  const knot = useSurfaceKnot();
  const curveKnot = useCurveKnot();
  const isoCurve = useSurfaceIsoCurve();
  const region = useSurfaceRegion();
  const split = useCurveSplit();
  const surfaceSplit = useSurfaceSplit();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [editingContainer, setEditingContainer] = useState<HTMLDivElement | null>(null);
  const [visibilityContainer, setVisibilityContainer] = useState<HTMLDivElement | null>(null);
  const [constructionContainer, setConstructionContainer] = useState<HTMLDivElement | null>(null);
  const mountedRef = useRef<MountedViewer | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;
  const lifecycleRef = useRef({ mounts: 0, disposals: 0 });
  const readIndexRef = useRef(0);
  const lastFitSelectedRequestRef = useRef(props.fitSelectedRequest);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [focusedReceipt, setFocusedReceipt] = useState<CadEditorCurvePresentationReceipt | null>(null);

  const axisGestureRef = useRef(false);
  const [axisGestureActive,setAxisGestureActive] = useState(false);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const viewportPointersRef = useRef(new Map<number, Element>());
  const [viewportCaptured, setViewportCaptured] = useState(false);
  const hasViewportCapture = () => [...viewportPointersRef.current].some(([id, target]) =>
    target.isConnected && target.hasPointerCapture(id));
  const [documentReceipt, setDocumentReceipt] = useState<CadEditorDisplayReceipt | null>(null);
  const documentReceiptRef = useRef<CadEditorDisplayReceipt | null>(null);

  useEffect(() => {
    let listening = true;
    const down = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element) || !viewportRef.current?.contains(target)) return;
      viewportPointersRef.current.set(event.pointerId, target);
      // Native controls and React overlays capture later in this event turn.
      setTimeout(() => { if (listening) setViewportCaptured(hasViewportCapture()); }, 0);
    };
    const release = (event: PointerEvent) => {
      if (!viewportPointersRef.current.has(event.pointerId)) return;
      viewportPointersRef.current.delete(event.pointerId);
      setViewportCaptured(hasViewportCapture());
    };
    window.addEventListener('pointerdown', down, true);
    window.addEventListener('pointerup', release, true);
    window.addEventListener('pointercancel', release, true);
    window.addEventListener('lostpointercapture', release, true);
    return () => {
      listening = false; viewportPointersRef.current.clear();
      window.removeEventListener('pointerdown', down, true);
      window.removeEventListener('pointerup', release, true);
      window.removeEventListener('pointercancel', release, true);
      window.removeEventListener('lostpointercapture', release, true);
    };
  }, [session]);
  useEffect(() => { if (viewportCaptured && !hasViewportCapture()) setViewportCaptured(false); });

  function report(cause: unknown, detail: string) {
    const error = cause instanceof CadEditorError ? cause
      : new CadEditorError('DISPLAY', `${detail}: ${cause instanceof Error ? cause.message : 'operation refused'}`, {}, cause);
    const mounted = mountedRef.current;
    const status = mounted?.viewer.getState().status;
    const unavailable = status === 'context-lost' || status === 'unavailable' || detail === 'Restoring the accepted frame failed' || error.context.field === 'restore-frame';
    if (mounted && unavailable) {
      mounted.unavailable = true; setReady(false); setFocusedReceipt(null); setDocumentReceipt(null);
      documentReceiptRef.current = null;
      invalidate(); try { propsRef.current.onCurvePresentation?.(null); } catch {}
    }
    setErrorMessage(unavailable
      ? 'Cannot restore the current view. Reopen the viewport.'
      : detail === 'Opening the Viewer failed'
        ? 'Cannot open the viewport. Check the document and display settings.'
        : detail === 'Selecting the picked body failed'
          ? 'Select the object from the list. This display point cannot be selected.'
          : detail === 'Fitting the selected body failed'
            ? 'Select a displayed object before fitting it.'
        : detail === 'Surface point gesture failed' || detail === 'Curve point gesture failed' || detail === 'Axis point gesture failed'
          ? error.message
        : 'Cannot display this change. The current view is retained.');
    if (interval?.active) interval.noteError(error);
    if (knot?.active) knot.noteError(error);
    if (curveKnot?.isActive()) curveKnot.noteError(error);
    if (isoCurve?.isActive()) isoCurve.noteError(error);
    if (region?.isActive()) region.noteError(error);
    if (split?.isActive()) split.noteError(error);
    if (surfaceSplit?.isActive()) surfaceSplit.noteError(error);
    try { propsRef.current.onError?.(error); } catch { /* Host callbacks do not change admission. */ }
  }

  function captureReceipt(viewer: Viewer, canvas: HTMLCanvasElement, background: [number, number, number],
    lifecycle: CadEditorDisplayReceipt['lifecycle'], readIndex: { current: number },
    focus = mountedRef.current?.focus ?? null, forcePixels = false): CadEditorDisplayReceipt | CadEditorCurvePresentationReceipt {
    if (!focus || propsRef.current.curvePresentationPolicy !== 'native-state' || forcePixels)
      return displayReceipt(viewer, canvas, background, lifecycle, readIndex);
    const state = viewer.getState(); checkFocusFrame({ state }, focus);
    return { ...structuredClone(focus), state, generation: mountedRef.current?.generation ?? 0,
      displayGeneration: mountedRef.current?.displayGeneration ?? 0, width: canvas.width, height: canvas.height, lifecycle: { ...lifecycle } };
  }
  function invalidate() {
    try { propsRef.current.onDisplayInvalidated?.(); } catch {}
    try { propsRef.current.onCurveDisplay?.(null); } catch {}
  }
  function notify(receipt: CadEditorDisplayReceipt | CadEditorCurvePresentationReceipt) {
    try {
      const mounted = mountedRef.current;
      if (mounted?.focus) {
        const focus = mounted.focus; checkFocusFrame(receipt, focus);
        const metadata: CadEditorCurvePresentationReceipt = structuredClone({ state: receipt.state, ...focus,
          generation: mounted.generation, displayGeneration: mounted.displayGeneration,
          width: receipt.width, height: receipt.height, lifecycle: receipt.lifecycle });
        documentReceiptRef.current = null; setDocumentReceipt(null); setFocusedReceipt(metadata);
        if (propsRef.current.curvePresentationPolicy === 'native-state' || !('pixelHash' in receipt)) invalidate();
        propsRef.current.onCurvePresentation?.(structuredClone(metadata));
        if ('pixelHash' in receipt) {
          const measured: CadEditorCurveFocusReceipt = structuredClone({ ...receipt, ...metadata });
          propsRef.current.onCurveDisplay?.(measured);
        }
      } else {
        if (!('pixelHash' in receipt)) throw new CadEditorError('DISPLAY', 'Canonical presentation requires its existing measured receipt.');
        documentReceiptRef.current = structuredClone(receipt); setDocumentReceipt(structuredClone(receipt)); setFocusedReceipt(null);
        propsRef.current.onCurvePresentation?.(null); propsRef.current.onCurveDisplay?.(null);
        if (mounted) mounted.documentCamera = structuredClone(receipt.state.camera);
        propsRef.current.onDisplay?.(structuredClone(receipt));
      }
    } catch (cause) { report(new CadEditorError('DISPLAY', 'Display callback failed.', { field: 'display-callback' }, cause), 'Display callback failed'); }
  }

  useEffect(() => {
    const canvas = canvasRef.current!;
    let viewer: Viewer | null = null;
    let pointer: ViewerPointerControls | null = null;
    let keyboard: ViewerKeyboardControls | null = null;
    let observer: ResizeObserver | null = null;
    let disposed = false;
    let published = false;
    type FitStamp = { id: number; pointerType: string; x: number; y: number; time: number;
      generation: number; displayGeneration: number; view: CadEditorView };
    let clickGesture: { id: number; x: number; y: number; moved: boolean; fit?: FitStamp } | null = null;
    let fitClicks: FitStamp[] = [];
    const observedPointers = new Set<number>();
    const normalReleases = new Set<number>();
    function interruptFit() { fitClicks = []; if (clickGesture) clickGesture.fit = undefined; }
    function observeDown(event: PointerEvent) {
      observedPointers.add(event.pointerId); normalReleases.clear();
      if (event.target !== canvas) interruptFit();
    }
    function observeRelease(event: PointerEvent) {
      observedPointers.delete(event.pointerId);
      if (event.type === 'pointerup' && event.isTrusted) normalReleases.add(event.pointerId);
      else { normalReleases.delete(event.pointerId); interruptFit(); }
    }
    function lostCapture(event: PointerEvent) {
      // Native controls release inside pointerup; earlier capture loss cannot authorize Fit.
      if (!normalReleases.has(event.pointerId)) interruptFit();
    }
    function anyCapture() {
      return [...observedPointers].some(id => [document.documentElement, ...document.querySelectorAll('*')]
        .some(element => element.hasPointerCapture(id)));
    }
    function fitAllowed() {
      const mounted = mountedRef.current, current = session.getSnapshot(), bounds = canvas.getBoundingClientRect();
      return viewer !== null && !disposed && canvas.isConnected && canvas.getClientRects().length > 0
        && bounds.width > 0 && bounds.height > 0 && viewportRef.current?.getAttribute('data-viewer-ready') === 'true'
        && mounted?.viewer === viewer && !mounted.admitting && !mounted.unavailable && !mounted.optionsRefused
        && mounted.generation === current.generation && mounted.displayGeneration === current.displayGeneration
        && sameOptions(mounted.view, current.view) && viewer.getState().status === 'ready'
        && !current.disposed && !current.candidate && !current.selectionTransition && Object.keys(current.pending).length === 0
        && !axisGestureRef.current && !anyCapture()
        && document.querySelector('[role="dialog"][data-state="open"],[role="menu"]') === null;
    }
    function stampFit(event: PointerEvent, gesture: NonNullable<typeof clickGesture>) {
      const start = gesture.fit, current = session.getSnapshot();
      if (!start || !event.isTrusted || !event.isPrimary || event.button !== 0 || event.shiftKey || event.altKey
        || event.ctrlKey || event.metaKey || !normalReleases.has(event.pointerId) || !fitAllowed()
        || start.generation !== current.generation || start.displayGeneration !== current.displayGeneration
        || !sameOptions(start.view, current.view)) { interruptFit(); return; }
      const completed = { ...start, x: event.clientX, y: event.clientY, time: event.timeStamp };
      const previous = fitClicks.at(-1);
      const samePair = previous && previous.id === completed.id && previous.pointerType === completed.pointerType
        && previous.generation === completed.generation && previous.displayGeneration === completed.displayGeneration
        && sameOptions(previous.view, completed.view);
      fitClicks = samePair ? [previous, completed] : [completed];
    }
    function publish() {
      if (!viewer || disposed || !published || mountedRef.current?.unavailable || mountedRef.current?.admitting) return;
      try { notify(captureReceipt(viewer, canvas, mountedRef.current!.options.viewer.background, lifecycleRef.current, readIndexRef)); }
      catch (cause) { report(cause, 'Reading the displayed frame failed'); }
    }
    function resize() {
      if (!viewer || disposed || mountedRef.current?.unavailable) return;
      const bounds = canvas.getBoundingClientRect();
      if (bounds.width <= 0 || bounds.height <= 0) return;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.min(4096, Math.round(bounds.width * ratio)));
      const height = Math.max(1, Math.min(4096, Math.round(bounds.height * ratio)));
      const scale = Math.min(1, Math.sqrt(4194304 / (width * height)));
      try {
        viewer.resize(Math.max(1, Math.floor(width * scale)), Math.max(1, Math.floor(height * scale)));
        publish();
      } catch (cause) { report(cause, 'Resizing the Viewer failed'); }
    }
    function down(event: PointerEvent) {
      clickGesture = null;
      if (disposed || !event.isPrimary || event.button !== 0 || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) { interruptFit(); return; }
      const current = session.getSnapshot();
      clickGesture = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
      if (event.isTrusted) clickGesture.fit = { id: event.pointerId, pointerType: event.pointerType,
        x: event.clientX, y: event.clientY, time: event.timeStamp, generation: current.generation,
        displayGeneration: current.displayGeneration, view: structuredClone(current.view) };
      else interruptFit();
    }
    function move(event: PointerEvent) {
      if (clickGesture?.id === event.pointerId
        && Math.hypot(event.clientX - clickGesture.x, event.clientY - clickGesture.y) > 3) { clickGesture.moved = true; interruptFit(); }
    }
    function cancel() { clickGesture = null; interruptFit(); }
    function picked(event: PointerEvent) {
      const gesture = clickGesture;
      clickGesture = null;
      if (!viewer || disposed || !gesture || gesture.id !== event.pointerId || gesture.moved
        || Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 3) { interruptFit(); return; }
      const mounted = mountedRef.current;
      const current = session.getSnapshot();
      if (!mounted || mounted.admitting || mounted.unavailable || current.candidate || current.selectionTransition || current.disposed) { interruptFit(); return; }
      try {
        const bounds = canvas.getBoundingClientRect();
        const pick = viewer.pickGeometry({ xCss: event.clientX - bounds.left, yCss: event.clientY - bounds.top });
        if (!pick) { stampFit(event, gesture); return; }
        if (pick.ambiguous) throw new CadEditorError('DISPLAY', 'The display pick is ambiguous. Select the object from the object list.');
        const state = viewer.getState();
        if (mounted.focus) {
          const focus = mounted.focus;
          if (pick.kind !== 'curve' || pick.ref.modelId !== focus.sourceModelName || pick.ref.curveId !== focus.curveId
            || focus.reference.documentId !== current.accepted.document.documentId
            || focus.reference.documentRevision !== current.accepted.document.revision) {
            throw new CadEditorError('STALE', 'The picked focused Curve does not match its qualified native document.', { field: 'curve-focus' });
          }
          session.requestSelection({ bodyId: focus.reference.bodyId }); stampFit(event, gesture); return;
        }
        const body = state.documentBodies.find(body => body.ref.kind === pick.kind
          && body.ref.modelId === pick.ref.modelId
          && (body.ref.kind === 'surface' && pick.kind === 'surface'
            ? body.ref.surfaceId === pick.ref.surfaceId
            : body.ref.kind === 'curve' && pick.kind === 'curve' && body.ref.curveId === pick.ref.curveId));
        if (!body || body.binding.documentId !== current.accepted.document.documentId
          || body.binding.documentRevision !== current.accepted.document.revision) {
          throw new CadEditorError('STALE', 'The picked display body does not match the current native document.');
        }
        session.requestSelection({ bodyId: body.binding.bodyId });
        stampFit(event, gesture);
      } catch (cause) { interruptFit(); report(cause, 'Selecting the picked body failed'); }
    }
    function fitPicked(event: MouseEvent) {
      const pair = fitClicks; fitClicks = [];
      if (!event.isTrusted || event.button !== 0 || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey
        || pair.length !== 2 || !fitAllowed() || !viewer) return;
      const mounted = mountedRef.current!, current = session.getSnapshot(), last = pair[1];
      if (pair.some(click => click.generation !== current.generation || click.displayGeneration !== current.displayGeneration
        || !sameOptions(click.view, current.view)) || last.time > event.timeStamp
        || Math.hypot(event.clientX - last.x, event.clientY - last.y) > 3) return;
      const before = viewer.getState();
      let fitting = false;
      try {
        const bounds = canvas.getBoundingClientRect();
        const pick = viewer.pickGeometry({ xCss: event.clientX - bounds.left, yCss: event.clientY - bounds.top });
        if (!pick) return;
        if (pick.ambiguous) throw new CadEditorError('DISPLAY', 'The display pick is ambiguous. Select the object from the object list.', { field: 'canvas-fit' });
        const pickedRef = pick.kind === 'curve' ? { kind: 'curve' as const, ...pick.ref }
          : { kind: 'surface' as const, ...pick.ref };
        if (mounted.focus) {
          const focus = mounted.focus;
          if (pick.kind !== 'curve' || pick.ref.modelId !== focus.sourceModelName || pick.ref.curveId !== focus.curveId
            || current.view.kind !== 'curve-focus' || current.view.bodyId !== focus.reference.bodyId
            || focus.reference.documentId !== current.accepted.document.documentId
            || focus.reference.documentRevision !== current.accepted.document.revision
            || before.document !== null || before.documentBodies.length !== 0 || before.curveSampleVersion !== 3
            || !sameOptions(before.selectedUniformCurve, focus.preview)
            || !before.visibleGeometry.some(ref => sameOptions(ref, pickedRef)))
            throw new CadEditorError('STALE', 'The picked focused Curve does not match the current native view.', { field: 'canvas-fit' });
          fitting = true; viewer.fitGeometry({ kind: 'curve', modelId: focus.sourceModelName, curveId: focus.curveId });
        } else {
          const body = before.documentBodies.find(body => sameOptions(body.ref, pickedRef));
          const nativeBody = current.accepted.document.bodies.find(value => value.id === body?.binding.bodyId);
          const nativeAsset = current.accepted.document.assets.find(value => value.id === nativeBody?.assetId);
          if (!body || !nativeBody || current.view.kind !== 'document' || !sameOptions(before.document, current.accepted)
            || body.binding.documentId !== current.accepted.document.documentId || body.binding.documentRevision !== current.accepted.document.revision
            || body.binding.assetId !== nativeBody.assetId || body.binding.geometryId !== nativeBody.geometryId
            || !nativeAsset || body.binding.assetRevision !== nativeAsset.revision || body.binding.geometryKind !== pick.kind
            || !current.displayBodyIds.includes(body.binding.bodyId) || !before.visibleGeometry.some(ref => sameOptions(ref, body.ref)))
            throw new CadEditorError('STALE', 'The picked body does not match the current displayed native document.', { field: 'canvas-fit' });
          fitting = true; viewer.fitNativeDocumentBody({ ref: body.ref, documentRevision: current.accepted.document.revision });
        }
        const receipt = captureReceipt(viewer, canvas, mounted.options.viewer.background, lifecycleRef.current, readIndexRef);
        checkFocusFrame(receipt, mounted.focus);
        if (!mounted.focus) checkDocumentFrame(receipt, current.accepted, current.displayBodyIds);
        notify(receipt);
      } catch (cause) {
        if (fitting) {
          try {
            viewer.setView(before.camera);
            const restored = captureReceipt(viewer, canvas, mounted.options.viewer.background, lifecycleRef.current, readIndexRef);
            checkFocusFrame(restored, mounted.focus);
            if (!mounted.focus) checkDocumentFrame(restored, current.accepted, current.displayBodyIds);
            notify(restored);
          } catch (restoreCause) { report(restoreCause, 'Restoring the accepted frame failed'); return; }
        }
        report(cause, 'Fitting the picked body failed');
      }
    }
    let fitContext = session.getSnapshot();
    const unsubscribeFit = session.subscribe(() => {
      const next = session.getSnapshot();
      if (next.generation !== fitContext.generation || next.displayGeneration !== fitContext.displayGeneration
        || !sameOptions(next.view, fitContext.view) || next.candidate || next.selectionTransition || next.disposed
        || Object.keys(next.pending).length > 0) interruptFit();
      fitContext = next;
    });
    setReady(false);
    setFocusedReceipt(null);
    setErrorMessage(null);
    readIndexRef.current = 0;
    try {
      const options = structuredClone(propsRef.current.displayOptions);
      const initial = session.getSnapshot();
      viewer = createViewer(canvas, options.viewer);
      lifecycleRef.current.mounts++;
      mountedRef.current = { session, viewer, options, generation: initial.generation,
        displayGeneration: initial.displayGeneration, admitting: false, optionsRefused: false,
        view: structuredClone(initial.view), focus: null, documentCamera: null, unavailable: false };
      resize();
      mountedRef.current.focus = loadView(viewer, initial.accepted, initial.view, options, initial.displayBodyIds);
      selectView(viewer, initial.selectedBodyId, mountedRef.current.focus);
      const receipt = captureReceipt(viewer, canvas, options.viewer.background, lifecycleRef.current, readIndexRef);
      checkFocusFrame(receipt, mountedRef.current.focus);
      if (!mountedRef.current.focus) checkDocumentFrame(receipt, initial.accepted, initial.displayBodyIds);
      pointer = viewer.attachPointerControls({ onError: cause => report(cause, 'Pointer control failed') });
      keyboard = viewer.attachKeyboardControls({ onError: cause => report(cause, 'Keyboard control failed') });
      observer = new ResizeObserver(resize);
      observer.observe(canvas);
      published = true;
      setReady(true);
      notify(receipt);
      // Controls render synchronously before these copied diagnostics run.
      canvas.addEventListener('pointerup', publish);
      canvas.addEventListener('wheel', publish);
      canvas.addEventListener('keydown', publish);
      canvas.addEventListener('pointerdown', down);
      canvas.addEventListener('pointermove', move);
      canvas.addEventListener('pointerup', picked);
      canvas.addEventListener('pointercancel', cancel);
      canvas.addEventListener('wheel', cancel);
      canvas.addEventListener('dblclick', fitPicked);
      window.addEventListener('pointerdown', observeDown, true);
      window.addEventListener('pointerup', observeRelease, true);
      window.addEventListener('pointercancel', observeRelease, true);
      window.addEventListener('lostpointercapture', lostCapture, true);
      window.addEventListener('wheel', interruptFit, true);
      window.addEventListener('keydown', interruptFit, true);
    } catch (cause) {
      mountedRef.current = null;
      invalidate(); try { propsRef.current.onCurvePresentation?.(null); } catch {}
      report(cause, 'Opening the Viewer failed');
      observer?.disconnect();
      pointer?.dispose();
      keyboard?.dispose();
      pointer = null;
      keyboard = null;
      if (viewer) {
        viewer.dispose();
        lifecycleRef.current.disposals++;
        viewer = null;
      }
    }
    return () => {
      disposed = true;
      observer?.disconnect();
      canvas.removeEventListener('pointerup', publish);
      canvas.removeEventListener('wheel', publish);
      canvas.removeEventListener('keydown', publish);
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', picked);
      canvas.removeEventListener('pointercancel', cancel);
      canvas.removeEventListener('wheel', cancel);
      canvas.removeEventListener('dblclick', fitPicked);
      window.removeEventListener('pointerdown', observeDown, true);
      window.removeEventListener('pointerup', observeRelease, true);
      window.removeEventListener('pointercancel', observeRelease, true);
      window.removeEventListener('lostpointercapture', lostCapture, true);
      window.removeEventListener('wheel', interruptFit, true);
      window.removeEventListener('keydown', interruptFit, true);
      observedPointers.clear(); normalReleases.clear(); fitClicks = [];
      unsubscribeFit();
      pointer?.dispose();
      keyboard?.dispose();
      if (viewer) {
        viewer.dispose();
        lifecycleRef.current.disposals++;
        const state: ViewerState = viewer.getState();
        try {
          invalidate(); propsRef.current.onCurvePresentation?.(null);
          if (!mountedRef.current?.focus) propsRef.current.onDisplay?.({ state, pixelHash: '', readIndex: readIndexRef.current, nonBackgroundPixels: 0, pixelCount: 0,
            width: canvas.width, height: canvas.height,
            backgroundRGB: propsRef.current.displayOptions.viewer.background.map(value => Math.round(value * 255)) as [number, number, number],
            lifecycle: { ...lifecycleRef.current } });
        } catch { /* Cleanup does not call disposed resources or the session. */ }
      }
      mountedRef.current = null;
    };
  }, [session]);

  useEffect(() => {
    const mounted = mountedRef.current, canvas = canvasRef.current;
    if (!mounted || !canvas || !mounted.focus || mounted.admitting || mounted.unavailable) return;
    try { notify(captureReceipt(mounted.viewer, canvas, mounted.options.viewer.background, lifecycleRef.current, readIndexRef)); }
    catch (cause) { report(cause, 'Reading the focused presentation failed'); }
  }, [props.curvePresentationPolicy]);

  // Options updates are real Viewer admissions. Immutable Viewer options require a fresh mount.
  useEffect(() => {
    const mounted = mountedRef.current;
    const canvas = canvasRef.current;
    if (!mounted || !canvas || mounted.admitting || mounted.unavailable) return;
    try {
      const next = structuredClone(props.displayOptions);
      if (!sameOptions(next.viewer, mounted.options.viewer)) {
        mounted.optionsRefused = true;
        throw new CadEditorError('DISPLAY', 'Viewer scale, background and lighting cannot change while mounted. Reopen the viewport to use new options.');
      }
      if (!sameOptions(documentOptions(next.document, []), documentOptions(mounted.options.document, []))) {
        const before = mounted.viewer.getState();
        const accepted = session.getSnapshot();
        let displayed = false;
        try {
          const focus = loadView(mounted.viewer, accepted.accepted, accepted.view, next, accepted.displayBodyIds, before.camera, () => { displayed = true; });
          selectView(mounted.viewer, accepted.selectedBodyId, focus);
          const receipt = captureReceipt(mounted.viewer, canvas, next.viewer.background, lifecycleRef.current, readIndexRef, focus);
          checkFocusFrame(receipt, focus);
          if (!focus) checkDocumentFrame(receipt, accepted.accepted, accepted.displayBodyIds);
          mounted.options = next;
          mounted.generation = accepted.generation;
          mounted.displayGeneration = accepted.displayGeneration;
          mounted.view = structuredClone(accepted.view); mounted.focus = focus;
          mounted.optionsRefused = false;
          setErrorMessage(null);
          notify(receipt);
        } catch (cause) {
          mounted.optionsRefused = true;
          // loadDocument is transactional; restore only if readPixels failed after admission.
          if (displayed) {
            try {
              mounted.focus = loadView(mounted.viewer, accepted.accepted, accepted.view, mounted.options, accepted.displayBodyIds, before.camera);
              mounted.view = structuredClone(accepted.view);
              restoreSelection(mounted.viewer, before);
            } catch (restoreCause) {
              throw new CadEditorError('DISPLAY', 'Restoring the accepted frame failed.', { field: 'restore-frame' }, new AggregateError([cause, restoreCause]));
            }
          }
          throw cause;
        }
      } else {
        if (mounted.optionsRefused) setErrorMessage(null);
        mounted.optionsRefused = false;
      }
    } catch (cause) { report(cause, 'Display options were refused'); }
  }, [props.displayOptions, session, ready]);

  useEffect(() => {
    const mounted = mountedRef.current;
    const canvas = canvasRef.current;
    if (!mounted || !canvas || mounted.admitting) return;
    const current = session.getSnapshot();
    const candidate = current.candidate;
    if (!candidate) return;
    mounted.admitting = true;
    const before = mounted.viewer.getState();
    let displayed = false;
    try {
      if (mounted.unavailable) throw new CadEditorError('DISPLAY', 'The viewport is unavailable. Reopen it before applying.', { field: 'restore-frame' });
      if (mounted.optionsRefused) throw new CadEditorError('DISPLAY', 'The display options were refused. The pending values remain available.');
      const structural = candidate.kind === 'duplicate' || candidate.presentation === 'structural';
      const priorDocumentCamera = mounted.view.kind === 'document' ? structuredClone(before.camera) : mounted.documentCamera;
      const camera = candidate.kind === 'open' ? null
        : structural && candidate.view.kind === mounted.view.kind ? before.camera
        : candidate.view.kind === 'curve-focus' ? mounted.view.kind === 'curve-focus' && mounted.view.bodyId === candidate.view.bodyId ? before.camera : null
          : mounted.view.kind === 'curve-focus' ? priorDocumentCamera : before.camera;
      const focus = loadView(mounted.viewer, candidate.result, candidate.view, mounted.options, candidate.displayBodyIds, camera, () => { displayed = true; });
      const selectedBodyId = structural && candidate.selectionTarget !== undefined
        ? candidate.selectionTarget?.bodyId ?? null
        : candidate.kind === 'open' ? null : current.selectionTransition?.target.bodyId ?? current.selectedBodyId;
      selectView(mounted.viewer, selectedBodyId, focus);
      const receipt = captureReceipt(mounted.viewer, canvas, mounted.options.viewer.background, lifecycleRef.current, readIndexRef, focus);
      checkFocusFrame(receipt, focus);
      if (!focus) checkDocumentFrame(receipt, candidate.result, candidate.displayBodyIds);
      const latest = session.getSnapshot();
      if (latest.candidate?.token !== candidate.token || latest.generation !== candidate.baseGeneration || latest.displayGeneration !== candidate.baseDisplayGeneration)
        throw new CadEditorError('STALE', 'The candidate changed before presentation admission.');
      const accepted = session.acceptCandidate(candidate.token);
      mounted.generation = accepted.generation;
      mounted.displayGeneration = accepted.displayGeneration;
      mounted.view = structuredClone(accepted.view); mounted.focus = focus;
      mounted.documentCamera = candidate.kind === 'open' ? null : priorDocumentCamera;
      setErrorMessage(null);
      notify(receipt);
      try { propsRef.current.onAccepted?.(accepted, structuredClone(candidate)); }
      catch (cause) { report(cause, 'Accepted callback failed'); }
    } catch (cause) {
      let restoreFailure: { cause: unknown } | null = null;
      if (displayed) {
        try {
          const accepted = session.getSnapshot();
          mounted.focus = loadView(mounted.viewer, accepted.accepted, accepted.view, mounted.options, accepted.displayBodyIds, before.camera);
          mounted.view = structuredClone(accepted.view);
          restoreSelection(mounted.viewer, before);
          mounted.generation = accepted.generation;
          mounted.displayGeneration = accepted.displayGeneration;
          notify(captureReceipt(mounted.viewer, canvas, mounted.options.viewer.background, lifecycleRef.current, readIndexRef));
        } catch (restoreCause) { restoreFailure = { cause: restoreCause }; }
      }
      try { session.cancelCandidate(candidate.token); }
      catch { /* Another candidate owns the current token. Its pending data is preserved. */ }
      report(cause, 'The candidate was not accepted');
      if (restoreFailure) report(new CadEditorError('DISPLAY', 'Restoring the accepted frame failed.', { field: 'restore-frame' }, new AggregateError([cause, restoreFailure.cause])), 'Restoring the accepted frame failed');
    } finally {
      mounted.admitting = false;
    }
  }, [snapshot.candidate?.token, session, ready]);

  useEffect(() => {
    const mounted = mountedRef.current;
    const canvas = canvasRef.current;
    if (!mounted || !canvas || mounted.admitting || mounted.unavailable) return;
    const current = session.getSnapshot();
    if (current.candidate || current.disposed) return;
    try {
      selectView(mounted.viewer, current.selectedBodyId, mounted.focus);
      setErrorMessage(null);
      notify(captureReceipt(mounted.viewer, canvas, mounted.options.viewer.background, lifecycleRef.current, readIndexRef));
    } catch (cause) { report(cause, 'Selecting the native body failed'); }
  }, [snapshot.selectedBodyId, snapshot.generation, snapshot.displayGeneration, session, ready]);

  useEffect(() => {
    const mounted = mountedRef.current;
    const canvas = canvasRef.current;
    if (!mounted || !canvas || axisGestureRef.current || mounted.admitting || mounted.unavailable || props.fitRequest === undefined) return;
    try {
      fitDisplayed(mounted.viewer);
      notify(captureReceipt(mounted.viewer, canvas, mounted.options.viewer.background, lifecycleRef.current, readIndexRef));
    } catch (cause) { report(cause, 'Fitting the viewport failed'); }
  }, [props.fitRequest, session, ready]);

  useEffect(() => {
    const requested = props.fitSelectedRequest;
    if (requested === lastFitSelectedRequestRef.current) return;
    lastFitSelectedRequestRef.current = requested;
    const mounted = mountedRef.current;
    const canvas = canvasRef.current;
    if (!mounted || !canvas || axisGestureRef.current || mounted.admitting || mounted.unavailable || requested === undefined) return;
    try {
      const current = session.getSnapshot();
      const state = mounted.viewer.getState();
      if (mounted.focus) {
        if (current.selectedBodyId !== mounted.focus.reference.bodyId) throw new CadEditorError('DISPLAY', 'Select the focused Curve before fitting it.', { field: 'fit-selection' });
        mounted.viewer.fitGeometry({ kind: 'curve', modelId: mounted.focus.sourceModelName, curveId: mounted.focus.curveId });
        notify(captureReceipt(mounted.viewer, canvas, mounted.options.viewer.background, lifecycleRef.current, readIndexRef)); return;
      }
      const body = state.documentBodies.find(body => body.binding.bodyId === current.selectedBodyId);
      if (!body) throw new CadEditorError('DISPLAY', 'Select a displayed body before fitting it.', { field: 'fit-selection' });
      mounted.viewer.fitNativeDocumentBody({ ref: body.ref, documentRevision: current.accepted.document.revision });
      notify(captureReceipt(mounted.viewer, canvas, mounted.options.viewer.background, lifecycleRef.current, readIndexRef));
    } catch (cause) { report(cause, 'Fitting the selected body failed'); }
  }, [props.fitSelectedRequest, session, ready]);

  useEffect(() => {
    const mounted = mountedRef.current;
    const canvas = canvasRef.current;
    if (!mounted || !canvas || mounted.admitting || mounted.unavailable || props.readRequest === undefined
      || mounted.focus && props.curvePresentationPolicy === 'native-state') return;
    try {
      notify(captureReceipt(mounted.viewer, canvas, mounted.options.viewer.background, lifecycleRef.current, readIndexRef));
    } catch (cause) {
      report(new CadEditorError('DISPLAY', 'Reading the current displayed frame failed.', { field: 'pixel-read' }, cause),
        'Reading the current displayed frame failed');
    }
  }, [props.readRequest, session, ready]);

  useEffect(() => {
    const mounted = mountedRef.current, canvas = canvasRef.current;
    if (!mounted || !canvas || !mounted.focus || mounted.admitting || mounted.unavailable || props.curveReadRequest === undefined) return;
    try { notify(captureReceipt(mounted.viewer, canvas, mounted.options.viewer.background, lifecycleRef.current, readIndexRef, mounted.focus, true)); }
    catch (cause) { report(new CadEditorError('DISPLAY', 'Reading the focused Curve pixels failed.', { field: 'pixel-read' }, cause), 'Reading the focused Curve pixels failed'); }
  }, [props.curveReadRequest, session, ready]);

  function changeView(view: NativeViewSide) {
    const state = session.getSnapshot(), mounted = mountedRef.current, canvas = canvasRef.current;
    if (!mounted || !canvas || axisGestureRef.current || hasViewportCapture() || mounted.unavailable || mounted.admitting || state.disposed || state.candidate
      || state.selectionTransition || Object.keys(state.pending).length
      || mounted.generation !== state.generation || mounted.displayGeneration !== state.displayGeneration) return;
    const displayed = mounted.viewer.getState();
    if (displayed.status !== 'ready') return;
    const before = displayed.camera;
    const distance = Math.hypot(...before.eye.map((value,index)=>value-before.target[index]));
    const side = VIEW_SIDES.find(side => side.side === view);
    if (!side) return;
    const direction = side.direction;
    const length = Math.hypot(...direction);
    try {
      mounted.viewer.setView({...before,eye:before.target.map((value,index)=>value+direction[index]*distance/length) as [number,number,number],up:[...side.up]});
      notify(captureReceipt(mounted.viewer,canvas,mounted.options.viewer.background,lifecycleRef.current,readIndexRef));
      setErrorMessage(null);
    } catch (cause) {
      try { mounted.viewer.setView(before); notify(captureReceipt(mounted.viewer,canvas,mounted.options.viewer.background,lifecycleRef.current,readIndexRef)); }
      catch (restoreCause) { report(new CadEditorError('DISPLAY','Restoring the accepted frame failed.',{field:'restore-frame'},restoreCause),'Restoring the accepted frame failed'); return; }
      report(cause,'Changing the view failed');
    }
  }
  function isCurrentDocument() {
    try {
      const mounted = mountedRef.current, canvas = canvasRef.current, receipt = documentReceiptRef.current;
      if (!mounted || mounted.session !== session || propsRef.current.session !== session || !canvas || !receipt
        || !ready || mounted.focus || mounted.admitting || mounted.unavailable || mounted.optionsRefused
        || !canvas.isConnected || !canvas.getClientRects().length || canvas.width <= 0 || canvas.height <= 0
        || viewportRef.current?.dataset.viewerReady !== 'true') return false;
      const rect = canvas.getBoundingClientRect(), visibility = getComputedStyle(canvas).visibility;
      if (rect.width <= 0 || rect.height <= 0 || visibility === 'hidden' || visibility === 'collapse'
        || canvas.width !== receipt.width || canvas.height !== receipt.height) return false;
      const current = session.getSnapshot();
      if (current.disposed || mounted.view.kind !== 'document' || current.view.kind !== 'document'
        || mounted.generation !== current.generation || mounted.displayGeneration !== current.displayGeneration
        || !sameOptions(propsRef.current.displayOptions.viewer, mounted.options.viewer)
        || !sameOptions(documentOptions(propsRef.current.displayOptions.document, []), documentOptions(mounted.options.document, []))) return false;
      const state = mounted.viewer.getState();
      if (state.status !== 'ready' || !sameOptions(state, receipt.state)
        || !Object.is(state.mmToSceneUnit, mounted.options.viewer.mmToSceneUnit)) return false;
      checkDocumentFrame({ state }, current.accepted, current.displayBodyIds);
      return sameOptions(state.documentBodies.map(body => body.binding.bodyId), current.displayBodyIds)
        && state.documentBodies.every(body => {
          const binding = current.accepted.bodyBindings.find(value => value.bodyId === body.binding.bodyId);
          const asset = current.accepted.document.assets.find(value => value.id === binding?.assetId);
          const compiled = current.accepted.compiledAssets.find(value => value.assetId === binding?.assetId);
          return !!binding && !!asset && !!compiled && sameOptions(body.binding, {
            ...binding, documentId: current.accepted.document.documentId, documentRevision: current.accepted.document.revision,
            nativeFrame: current.accepted.document.nativeFrame, assetRevision: asset.revision,
            sourceFrame: asset.sourceFrame, modelId: compiled.model.name,
          });
        })
        && state.visibleGeometry.length === state.documentBodies.length
        && state.documentBodies.every(body => state.visibleGeometry.some(ref => sameOptions(ref, body.ref)));
    } catch { return false; }
  }
  function isCurrentSurface() {
    return !region?.isActive() && !split?.isActive() && !surfaceSplit?.isActive() && isCurrentSurfaceBase();
  }
  function isCurrentSurfaceBase() {
    try {
      if (!isCurrentDocument()) return false;
      const selected = surfaceKnotSurface(session), mounted = mountedRef.current;
      if (!selected || !mounted) return false;
      const state = mounted.viewer.getState(), binding = state.document?.bodyBindings.find(body => body.bodyId === selected.reference.bodyId);
      if (!binding || binding.geometryKind !== 'surface' || binding.geometryId !== selected.reference.geometryId
        || binding.assetId !== selected.reference.assetId || !sameOptions(state.document, selected.snapshot.accepted)) return false;
      const displayed = state.documentBodies.find(body => body.binding.bodyId === selected.reference.bodyId);
      return sameOptions(state.selectedGeometry, displayed?.ref ?? null)
        && (!displayed || displayed.binding.documentRevision === selected.reference.documentRevision
          && displayed.binding.assetRevision === selected.reference.assetRevision);
    } catch { return false; }
  }
  function isCurrentCurvePresentation(presentation: CurveControlPresentation) {
    try {
      if (curveKnot?.isActive() || region?.isActive() || split?.isActive() || surfaceSplit?.isActive()) return false;
      const mounted = mountedRef.current, canvas = canvasRef.current, current = session.getSnapshot();
      if (!mounted || mounted.session !== session || propsRef.current.session !== session || !canvas || !ready
        || mounted.admitting || mounted.unavailable || mounted.optionsRefused || current.disposed
        || mounted.generation !== current.generation || mounted.displayGeneration !== current.displayGeneration
        || presentation.generation !== current.generation || presentation.displayGeneration !== current.displayGeneration
        || !sameOptions(presentation.view, current.view) || !sameOptions(mounted.view, current.view)
        || !sameOptions(propsRef.current.displayOptions.viewer, mounted.options.viewer)
        || !sameOptions(documentOptions(propsRef.current.displayOptions.document, []), documentOptions(mounted.options.document, []))
        || !canvas.isConnected || !canvas.getClientRects().length || canvas.width !== presentation.receipt.width || canvas.height !== presentation.receipt.height
        || viewportRef.current?.dataset.viewerReady !== 'true') return false;
      const rect = canvas.getBoundingClientRect(), visibility = getComputedStyle(canvas).visibility;
      if (rect.width <= 0 || rect.height <= 0 || visibility === 'hidden' || visibility === 'collapse') return false;
      const state = mounted.viewer.getState();
      if (state.status !== 'ready' || !sameOptions(state, presentation.receipt.state)
        || !Object.is(state.mmToSceneUnit, mounted.options.viewer.mmToSceneUnit)) return false;
      const actual = resolveCurveControlPresentation(current,
        presentation.kind === 'document' ? presentation.receipt : null,
        presentation.kind === 'focus' ? presentation.receipt : null);
      return !!actual && actual.kind === presentation.kind && actual.source === presentation.source
        && sameOptions(actual.reference, presentation.reference) && sameOptions(actual.curve, presentation.curve)
        && (actual.kind === 'document' ? !mounted.focus && isCurrentDocument()
          : !!mounted.focus && sameOptions(mounted.focus.reference, actual.reference) && sameOptions(mounted.focus.preview, actual.receipt.preview));
    } catch { return false; }
  }
  function isCurrentKnotCurve() {
    if (region?.isActive() || split?.isActive() || surfaceSplit?.isActive()) return false;
    try {
      const selected = curveKnotCurve(session), mounted = mountedRef.current, canvas = canvasRef.current;
      if (!selected || !mounted || mounted.session !== session || propsRef.current.session !== session || !canvas || !ready
        || mounted.admitting || mounted.unavailable || mounted.optionsRefused
        || mounted.generation !== selected.snapshot.generation || mounted.displayGeneration !== selected.snapshot.displayGeneration
        || !sameOptions(mounted.view, selected.snapshot.view)
        || !sameOptions(propsRef.current.displayOptions.viewer, mounted.options.viewer)
        || !sameOptions(documentOptions(propsRef.current.displayOptions.document, []), documentOptions(mounted.options.document, []))) return false;
      const state = mounted.viewer.getState();
      if (state.status !== 'ready') return false;
      if (selected.snapshot.view.kind === 'document') {
        if (!isCurrentDocument() || mounted.focus) return false;
        const body = state.document?.bodyBindings.find(value => value.bodyId === selected.reference.bodyId);
        const displayed = state.documentBodies.find(value => value.binding.bodyId === selected.reference.bodyId);
        return !!body && body.geometryKind === 'curve' && body.assetId === selected.reference.assetId && body.geometryId === selected.reference.geometryId
          && sameOptions(state.selectedGeometry, displayed?.ref ?? null)
          && (!displayed || displayed.ref.kind === 'curve' && displayed.ref.curveId === selected.reference.geometryId
            && displayed.binding.documentRevision === selected.reference.documentRevision && displayed.binding.assetRevision === selected.reference.assetRevision);
      }
      const focus = mounted.focus, receipt = focusedReceipt, rect = canvas.getBoundingClientRect();
      return !!focus && !!receipt && canvas.isConnected && canvas.getClientRects().length > 0 && rect.width > 0 && rect.height > 0
        && !['hidden', 'collapse'].includes(getComputedStyle(canvas).visibility) && viewportRef.current?.dataset.viewerReady === 'true'
        && sameOptions(focus.reference, selected.reference) && focus.preview.source === selected.source
        && sameOptions(focus.preview.model.objects.find(value => value.id === focus.curveId), selected.curve)
        && sameOptions(receipt.reference, selected.reference) && receipt.generation === selected.snapshot.generation
        && receipt.displayGeneration === selected.snapshot.displayGeneration && sameOptions(state, receipt.state)
        && state.native === null && state.document === null && state.documentBodies.length === 0 && state.curveSampleVersion === 3
        && sameOptions(state.selectedUniformCurve, focus.preview) && sameOptions(receipt.preview, focus.preview)
        && state.visibleGeometry.length === 1 && sameOptions(state.visibleGeometry[0], { kind: 'curve', modelId: focus.sourceModelName, curveId: focus.curveId })
        && sameOptions(state.selectedGeometry, state.visibleGeometry[0]) && Object.is(state.mmToSceneUnit, mounted.options.viewer.mmToSceneUnit)
        && canvas.width === receipt.width && canvas.height === receipt.height;
    } catch { return false; }
  }
  if (curveKnot?.session === session) curveKnot.viewport.current = { canvas: canvasRef.current, documentReceipt, focusReceipt: focusedReceipt, isCurrentCurve: isCurrentKnotCurve };
  if (knot?.session === session) knot.viewport.current = { canvas: canvasRef.current, receipt: documentReceipt, isCurrentSurface };
  function isCurrentIntervalCurve(receipt?: CadEditorDisplayReceipt | CadEditorCurvePresentationReceipt) {
    try {
      if (curveKnot?.isActive() || !isCurrentKnotCurve()) return false;
      const mounted = mountedRef.current, canvas = canvasRef.current, current = session.getSnapshot();
      const frame = receipt ?? (current.view.kind === 'document' ? documentReceipt : focusedReceipt);
      return !!mounted && !!canvas && !!frame && sameOptions(mounted.viewer.getState(), frame.state)
        && canvas.width === frame.width && canvas.height === frame.height;
    } catch { return false; }
  }
  function isCurrentIsoSurface(receipt?: CadEditorDisplayReceipt) {
    try {
      if (!isCurrentSurface()) return false;
      const mounted = mountedRef.current, canvas = canvasRef.current, frame = receipt ?? documentReceipt;
      return !!mounted && !!canvas && !!frame && sameOptions(mounted.viewer.getState(), frame.state)
        && canvas.width === frame.width && canvas.height === frame.height;
    } catch { return false; }
  }
  function isCurrentDegreeSurface(receipt: CadEditorDisplayReceipt, ownCandidateToken?: string) {
    try {
      const current = session.getSnapshot(), mounted = mountedRef.current, canvas = canvasRef.current;
      if (!isCurrentDocument() || !mounted || !canvas || axisGestureRef.current || hasViewportCapture()
        || interval?.isActive() || knot?.active || curveKnot?.isActive() || isoCurve?.isActive() || region?.isActive() || split?.isActive() || surfaceSplit?.isActive()
        || current.selectionTransition || Object.keys(current.pending).length
        || (ownCandidateToken === undefined ? current.candidate !== null : current.candidate?.token !== ownCandidateToken)
        || current.selectedBodyId === null || !sameOptions(mounted.viewer.getState(), receipt.state)
        || canvas.width !== receipt.width || canvas.height !== receipt.height) return false;
      const selected = createCadGeometryReference(current.accepted, { bodyId: current.selectedBodyId });
      if (selected.geometry.kind !== 'surface') return false;
      const state = mounted.viewer.getState(), body = state.documentBodies.find(value => value.binding.bodyId === selected.reference.bodyId);
      return !!body && sameOptions(state.document, current.accepted) && sameOptions(state.selectedGeometry, body.ref)
        && body.binding.assetId === selected.reference.assetId && body.binding.geometryKind === 'surface'
        && body.binding.geometryId === selected.reference.geometryId && body.binding.documentRevision === selected.reference.documentRevision
        && body.binding.assetRevision === selected.reference.assetRevision;
    } catch { return false; }
  }
  function isCurrentReversalCurve(receipt: CadEditorDisplayReceipt, ownCandidateToken?: string) {
    try {
      const current = session.getSnapshot(), mounted = mountedRef.current, canvas = canvasRef.current;
      if (!isCurrentDocument() || !mounted || !canvas || axisGestureRef.current || hasViewportCapture()
        || interval?.isActive() || knot?.active || curveKnot?.isActive() || isoCurve?.isActive() || region?.isActive() || split?.isActive() || surfaceSplit?.isActive()
        || current.selectionTransition || Object.keys(current.pending).length
        || (ownCandidateToken === undefined ? current.candidate !== null : current.candidate?.token !== ownCandidateToken)
        || current.selectedBodyId === null || !sameOptions(mounted.viewer.getState(), receipt.state)
        || canvas.width !== receipt.width || canvas.height !== receipt.height) return false;
      const selected = createCadGeometryReference(current.accepted, { bodyId: current.selectedBodyId });
      if (selected.geometry.kind !== 'curve') return false;
      const state = mounted.viewer.getState(), body = state.documentBodies.find(value => value.binding.bodyId === selected.reference.bodyId);
      return !!body && body.ref.kind === 'curve' && body.ref.curveId === selected.geometry.id && sameOptions(state.document, current.accepted)
        && sameOptions(state.selectedGeometry, body.ref) && body.binding.assetId === selected.reference.assetId && body.binding.geometryKind === 'curve'
        && body.binding.geometryId === selected.reference.geometryId && body.binding.documentRevision === selected.reference.documentRevision
        && body.binding.assetRevision === selected.reference.assetRevision;
    } catch { return false; }
  }
  function isCurrentBodyMovePresentation(presentation: BodyMovePresentation, ownCandidateToken?: string) {
    try {
      const mounted=mountedRef.current,canvas=canvasRef.current,current=session.getSnapshot();
      if(region?.isActive()||split?.isActive()||surfaceSplit?.isActive()||!mounted||mounted.session!==session||propsRef.current.session!==session||!canvas||!ready||mounted.admitting||mounted.unavailable||mounted.optionsRefused
        ||current.disposed||current.selectionTransition||(ownCandidateToken===undefined?current.candidate!==null:current.candidate?.token!==ownCandidateToken)
        ||mounted.generation!==current.generation||mounted.displayGeneration!==current.displayGeneration||presentation.generation!==current.generation||presentation.displayGeneration!==current.displayGeneration
        ||!sameOptions(mounted.view,current.view)||!sameOptions(presentation.view,current.view)
        ||!sameOptions(propsRef.current.displayOptions.viewer,mounted.options.viewer)
        ||!sameOptions(documentOptions(propsRef.current.displayOptions.document,[]),documentOptions(mounted.options.document,[]))
        ||!canvas.isConnected||!canvas.getClientRects().length||canvas.width!==presentation.receipt.width||canvas.height!==presentation.receipt.height
        ||viewportRef.current?.dataset.viewerReady!=='true')return false;
      const rect=canvas.getBoundingClientRect();if(rect.width<=0||rect.height<=0||['hidden','collapse'].includes(getComputedStyle(canvas).visibility))return false;
      const state=mounted.viewer.getState();if(state.status!=='ready'||!sameOptions(state,presentation.receipt.state)||!Object.is(state.mmToSceneUnit,mounted.options.viewer.mmToSceneUnit))return false;
      const actual=resolveBodyMovePresentation(current,presentation.kind==='document'?presentation.receipt:null,presentation.kind==='focus'?presentation.receipt:null);
      return!!actual&&actual.kind===presentation.kind&&sameOptions(actual.reference,presentation.reference)&&actual.source===presentation.source
        &&sameOptions(actual.geometry,presentation.geometry)&&sameOptions(actual.anchorMM,presentation.anchorMM)
        &&(actual.kind==='document'?!mounted.focus&&isCurrentDocument():!!mounted.focus&&sameOptions(mounted.focus.reference,actual.reference)&&sameOptions(mounted.focus.preview,actual.receipt.preview));
    }catch{return false;}
  }
  function isCurrentRegionSurface(receipt?: CadEditorDisplayReceipt, ownCandidateToken?: string) {
    try {
      const current = session.getSnapshot(), mounted = mountedRef.current, canvas = canvasRef.current, frame = receipt ?? documentReceipt;
      if (surfaceSplit?.isActive() || split?.isActive() || interval?.isActive() || knot?.active || curveKnot?.isActive() || isoCurve?.isActive() || !isCurrentSurfaceBase()
        || current.selectionTransition || (ownCandidateToken === undefined ? current.candidate !== null : current.candidate?.token !== ownCandidateToken)) return false;
      return !!mounted && !!canvas && !!frame && sameOptions(mounted.viewer.getState(), frame.state)
        && canvas.width === frame.width && canvas.height === frame.height;
    } catch { return false; }
  }
  function isCurrentSplitCurve(receipt?: CadEditorDisplayReceipt, ownCandidateToken?: string) {
    try {
      const selected = curveSplitCurve(session), mounted = mountedRef.current, canvas = canvasRef.current, frame = receipt ?? documentReceipt;
      if (!selected || !mounted || !canvas || !frame || !isCurrentDocument() || mounted.focus
        || surfaceSplit?.isActive() || interval?.isActive() || knot?.active || curveKnot?.isActive() || isoCurve?.isActive() || region?.isActive()
        || selected.snapshot.selectionTransition || Object.keys(selected.snapshot.pending).some(key => key !== 'curveSplit')
        || (ownCandidateToken === undefined ? selected.snapshot.candidate !== null : selected.snapshot.candidate?.token !== ownCandidateToken)
        || !sameOptions(mounted.viewer.getState(), frame.state) || canvas.width !== frame.width || canvas.height !== frame.height) return false;
      const state = mounted.viewer.getState(), binding = state.document?.bodyBindings.find(body => body.bodyId === selected.reference.bodyId);
      const displayed = state.documentBodies.find(body => body.binding.bodyId === selected.reference.bodyId);
      return !!binding && binding.geometryKind === 'curve' && binding.assetId === selected.reference.assetId && binding.geometryId === selected.reference.geometryId
        && sameOptions(state.document, selected.snapshot.accepted) && sameOptions(state.selectedGeometry, displayed?.ref ?? null)
        && (!displayed || displayed.ref.kind === 'curve' && displayed.ref.curveId === selected.curve.id
          && displayed.binding.documentRevision === selected.reference.documentRevision && displayed.binding.assetRevision === selected.reference.assetRevision);
    } catch { return false; }
  }
  function isCurrentSplitSurface(receipt?: CadEditorDisplayReceipt, ownCandidateToken?: string) {
    try {
      const current = session.getSnapshot(), mounted = mountedRef.current, canvas = canvasRef.current, frame = receipt ?? documentReceipt;
      if (split?.isActive() || interval?.isActive() || knot?.active || curveKnot?.isActive() || isoCurve?.isActive() || region?.isActive()
        || !isCurrentSurfaceBase() || current.selectionTransition
        || Object.keys(current.pending).some(key => key !== 'surfaceSplitU' && key !== 'surfaceSplitV')
        || (ownCandidateToken === undefined ? current.candidate !== null : current.candidate?.token !== ownCandidateToken)) return false;
      return !!mounted && !!canvas && !!frame && sameOptions(mounted.viewer.getState(), frame.state)
        && canvas.width === frame.width && canvas.height === frame.height;
    } catch { return false; }
  }
  if (surfaceSplit?.session === session) surfaceSplit.viewport.current = { canvas: canvasRef.current, receipt: documentReceipt, isCurrentSurface: isCurrentSplitSurface };
  if (split?.session === session) split.viewport.current = { canvas: canvasRef.current, receipt: documentReceipt, isCurrentCurve: isCurrentSplitCurve };
  if (region?.session === session) region.viewport.current = { canvas: canvasRef.current, receipt: documentReceipt, isCurrentSurface: isCurrentRegionSurface };
  if (isoCurve?.session === session) isoCurve.viewport.current = { canvas: canvasRef.current, receipt: documentReceipt, isCurrentSurface: isCurrentIsoSurface };
  if (interval?.session === session) interval.viewport.current = { canvas: canvasRef.current, documentReceipt, focusReceipt: focusedReceipt, isCurrentCurve: isCurrentIntervalCurve };
  const camera = focusedReceipt?.state.camera ?? documentReceipt?.state.camera;
  const viewBusy=!ready||viewportCaptured||axisGestureActive||snapshot.disposed||snapshot.candidate!==null||snapshot.selectionTransition!==null||Object.keys(snapshot.pending).length>0;
  return <div ref={viewportRef} className={cn('cad-editor-viewport', className)} data-viewer-ready={ready}
    onKeyDownCapture={event=>{const target=event.target;
      if(axisGestureRef.current&&(session.getSnapshot().curveSelection!==null||session.getSnapshot().editTarget==='object'&&session.getSnapshot().selection===null||curveKnot?.gesture.current||isoCurve?.gesture.current||region?.gesture.current||split?.gesture.current||surfaceSplit?.gesture.current)&&event.key!=='Escape'
        &&!event.nativeEvent.isComposing&&event.keyCode!==229&&!(target instanceof Element&&target.closest('input,textarea,select,[contenteditable]'))){
        event.preventDefault();event.stopPropagation();
      }}}
    onWheelCapture={event=>{if(axisGestureRef.current){event.preventDefault();event.stopPropagation();}}}
    onPointerDownCapture={event=>{if(axisGestureRef.current&&event.target===canvasRef.current){event.preventDefault();event.stopPropagation();}}}>
    <canvas ref={canvasRef} width={640} height={480} tabIndex={0} className="cad-editor-canvas"
      onKeyDownCapture={event => {
        const fitKey = (event.key === 'f' || event.key === 'F') && !event.repeat
          && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey
          && !event.nativeEvent.isComposing && event.keyCode !== 229;
        if (event.key !== 'Escape' && !fitKey) return;
        event.preventDefault();
        event.stopPropagation();
        const mounted = mountedRef.current;
        const canvas = canvasRef.current;
        if (!mounted || !canvas || mounted.unavailable) return;
        try {
          if (fitKey && !axisGestureRef.current) fitDisplayed(mounted.viewer);
          notify(captureReceipt(mounted.viewer, canvas, mounted.options.viewer.background, lifecycleRef.current, readIndexRef));
        }
        catch (cause) { report(cause, 'Reading the displayed frame failed'); }
      }}
      data-testid="cad-editor-canvas" aria-label="CAD viewport. Drag to orbit. Shift drag to pan. Scroll to zoom. Press F to fit." />
    <div className="cad-editor-canvas-command-rail" role="group" aria-label="Canvas modeling commands" data-view-kind={snapshot.view.kind}>
      <div ref={setEditingContainer} className="cad-editor-command-group" data-command-group="editing" role="group" aria-label="Editing" />
      <div ref={setVisibilityContainer} className="cad-editor-command-group" data-command-group="visibility" role="group" aria-label="Visibility" />
      <div ref={setConstructionContainer} className="cad-editor-command-group" data-command-group="construct" role="group" aria-label="Construct" />
    </div>
    <CadEditorViewNavigator camera={ready ? camera : null} disabled={viewBusy} onChoose={changeView} />
    {snapshot.view.kind === 'document' && <SelectionIsolation session={session} canvas={canvasRef.current} toolbarContainer={visibilityContainer}
      receipt={ready ? documentReceipt : null} isCurrentDocument={isCurrentDocument} busy={viewBusy}
      onError={error => report(error, 'Changing document visibility failed')} />}
    {snapshot.view.kind === 'document' && !interval?.active && !knot?.active && !curveKnot?.active && !isoCurve?.active && !region?.active && !split?.active && !surfaceSplit?.active
      && <SurfaceDegreeElevationControls session={session} canvas={canvasRef.current} toolbarContainer={constructionContainer} receipt={ready ? documentReceipt : null}
        isCurrentSurface={isCurrentDegreeSurface} busy={viewBusy} onError={cause => report(cause, 'Raising Surface degree failed')} />}
    {snapshot.view.kind === 'document' && !interval?.active && !knot?.active && !curveKnot?.active && !isoCurve?.active && !region?.active && !split?.active && !surfaceSplit?.active
      && <SurfaceReversalControls session={session} canvas={canvasRef.current} toolbarContainer={constructionContainer} receipt={ready ? documentReceipt : null}
        isCurrentSurface={isCurrentDegreeSurface} busy={viewBusy} onError={cause => report(cause, 'Making a reversed Surface copy failed')} />}
    {snapshot.view.kind === 'document' && !interval?.active && !knot?.active && !curveKnot?.active && !isoCurve?.active && !region?.active && !split?.active && !surfaceSplit?.active
      && <CurveReversalControls session={session} canvas={canvasRef.current} toolbarContainer={constructionContainer} receipt={ready ? documentReceipt : null}
        isCurrentCurve={isCurrentReversalCurve} busy={viewBusy} onError={cause => report(cause, 'Making a reversed Curve copy failed')} />}
    {!interval?.active && !knot?.active && !curveKnot?.active && !isoCurve?.active && !region?.active && !split?.active && !surfaceSplit?.active && <SurfacePoleHandles session={session} receipt={ready?documentReceipt:null} canvas={canvasRef.current} onError={error=>report(error,'Surface point gesture failed')} />}
    {!interval?.active && !knot?.active && !curveKnot?.active && !isoCurve?.active && !region?.active && !split?.active && !surfaceSplit?.active && <PoleAxisGizmo session={session} toolbarContainer={editingContainer} documentReceipt={ready?documentReceipt:null} curveReceipt={ready?focusedReceipt:null} canvas={canvasRef.current}
      isCurrentCurvePresentation={isCurrentCurvePresentation}
      isCurrentBodyMovePresentation={isCurrentBodyMovePresentation}
      onGestureChange={active=>{axisGestureRef.current=active;setAxisGestureActive(active);}}
      onError={error=>report(error,'Axis point gesture failed')}/>}
    {focusedReceipt&&<p className="cad-editor-curve-view-label" data-testid="curve-view-label">Curve focus · {focusedReceipt.bodyName}<span>Other objects remain in document view.</span></p>}
    {!interval?.active && !knot?.active && !curveKnot?.active && !isoCurve?.active && !region?.active && !split?.active && !surfaceSplit?.active && <CurvePoleHandles session={session} receipt={ready?focusedReceipt:null} documentReceipt={ready?documentReceipt:null}
      canvas={canvasRef.current} isCurrentPresentation={isCurrentCurvePresentation}
      onGestureChange={active=>{axisGestureRef.current=active;setAxisGestureActive(active);}} onError={error => report(error, 'Curve point gesture failed')} />}
    {!curveKnot?.active && !isoCurve?.active && !region?.active && !split?.active && !surfaceSplit?.active && <SurfaceKnotHandles session={session} receipt={ready ? documentReceipt : null} canvas={canvasRef.current} isCurrentSurface={isCurrentSurface}
      onError={error => report(error, 'Surface knot gesture failed')} onGestureChange={active => { axisGestureRef.current = active; setAxisGestureActive(active); }} />}
    {!curveKnot?.active && !isoCurve?.active && !region?.active && !split?.active && !surfaceSplit?.active && <CurveIntervalHandles session={session} documentReceipt={ready ? documentReceipt : null} focusReceipt={ready ? focusedReceipt : null} canvas={canvasRef.current} isCurrentCurve={isCurrentIntervalCurve}
      onError={error => report(error, 'Curve interval gesture failed')} onGestureChange={active => { axisGestureRef.current = active; setAxisGestureActive(active); }} />}
    {!isoCurve?.active && !region?.active && !split?.active && !surfaceSplit?.active && <CurveKnotHandles session={session} documentReceipt={ready ? documentReceipt : null} focusReceipt={ready ? focusedReceipt : null}
      canvas={canvasRef.current} isCurrentCurve={isCurrentKnotCurve} onError={error => report(error, 'Curve knot gesture failed')}
      onGestureChange={active => { axisGestureRef.current = active; setAxisGestureActive(active); }} />}
    {!region?.active && !split?.active && !surfaceSplit?.active && <SurfaceIsoCurveHandles session={session} receipt={ready ? documentReceipt : null} canvas={canvasRef.current} isCurrentSurface={isCurrentIsoSurface}
      onError={error => report(error, 'Surface iso-Curve gesture failed')} onGestureChange={active => { axisGestureRef.current = active; setAxisGestureActive(active); }} />}
    {!split?.active && !surfaceSplit?.active && <SurfaceRegionHandles session={session} receipt={ready ? documentReceipt : null} canvas={canvasRef.current} isCurrentSurface={isCurrentRegionSurface}
      onError={error => report(error, 'Surface region gesture failed')} onGestureChange={active => { axisGestureRef.current = active; setAxisGestureActive(active); }} />}
    {!surfaceSplit?.active && <CurveSplitHandles session={session} receipt={ready ? documentReceipt : null} canvas={canvasRef.current} isCurrentCurve={isCurrentSplitCurve}
      onError={error => report(error, 'Curve split gesture failed')} onGestureChange={active => { axisGestureRef.current = active; setAxisGestureActive(active); }} />}
    <SurfaceSplitHandles session={session} receipt={ready ? documentReceipt : null} canvas={canvasRef.current} isCurrentSurface={isCurrentSplitSurface}
      onError={error => report(error, 'Surface split gesture failed')} onGestureChange={active => { axisGestureRef.current = active; setAxisGestureActive(active); }} />
    {errorMessage && <p className="cad-editor-error" role="alert">{errorMessage}</p>}
  </div>;
}
