import { useEffect, useRef, useState } from 'react';
import { createViewer } from '@barocss/viewer';
import type { Viewer, ViewerKeyboardControls, ViewerPointerControls, ViewerState } from '@barocss/viewer';
import { CadEditorError } from '../types.js';
import type { CadEditorView } from '../types.js';
import type { CadDocumentResult } from '@barocss/cad';
import { cn } from '../lib/utils.js';
import { useCadEditorSnapshot } from './use-session.js';
import type { CadEditorDisplayOptions, CadEditorDisplayReceipt, CadEditorCurveFocusReceipt, CadEditorViewportProps } from './types.js';
import { prepareFocusedCurve } from './curve-focus.js';
import type { FocusedCurveBinding } from './curve-focus.js';
import { CurvePoleHandles } from './curve-pole-handles.js';
import { SurfacePoleHandles } from './surface-pole-handles.js';

interface MountedViewer {
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

function checkFocusFrame(receipt: CadEditorDisplayReceipt, focus: FocusedCurveBinding | null) {
  if (focus && (receipt.state.document !== null || receipt.state.documentBodies.length !== 0
    || receipt.state.curveSampleVersion !== 3 || !sameOptions(receipt.state.selectedUniformCurve, focus.preview))) {
    throw new CadEditorError('DISPLAY', 'The actual Curve frame does not match its qualified focus binding.', { field: 'curve-focus' });
  }
}

function checkDocumentFrame(receipt: CadEditorDisplayReceipt, result: CadDocumentResult, bodyIds: string[]) {
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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mountedRef = useRef<MountedViewer | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;
  const lifecycleRef = useRef({ mounts: 0, disposals: 0 });
  const readIndexRef = useRef(0);
  const lastFitSelectedRequestRef = useRef(props.fitSelectedRequest);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [focusedReceipt, setFocusedReceipt] = useState<CadEditorCurveFocusReceipt | null>(null);

  const [documentReceipt, setDocumentReceipt] = useState<CadEditorDisplayReceipt | null>(null);

  function report(cause: unknown, detail: string) {
    const error = cause instanceof CadEditorError ? cause
      : new CadEditorError('DISPLAY', `${detail}: ${cause instanceof Error ? cause.message : 'operation refused'}`, {}, cause);
    const mounted = mountedRef.current;
    const status = mounted?.viewer.getState().status;
    const unavailable = status === 'context-lost' || status === 'unavailable' || detail === 'Restoring the accepted frame failed' || error.context.field === 'restore-frame';
    if (mounted && unavailable) {
      mounted.unavailable = true; setReady(false); setFocusedReceipt(null); setDocumentReceipt(null);
      try { propsRef.current.onCurveDisplay?.(null); } catch { /* No stale focused frame is published. */ }
    }
    setErrorMessage(unavailable
      ? 'Cannot restore the current view. Reopen the viewport.'
      : detail === 'Opening the Viewer failed'
        ? 'Cannot open the viewport. Check the document and display settings.'
        : detail === 'Selecting the picked body failed'
          ? 'Select the object from the list. This display point cannot be selected.'
          : detail === 'Fitting the selected body failed'
            ? 'Select a displayed object before fitting it.'
        : detail === 'Surface point gesture failed' || detail === 'Curve point gesture failed'
          ? error.message
        : 'Cannot display this change. The current view is retained.');
    try { propsRef.current.onError?.(error); } catch { /* Host callbacks do not change admission. */ }
  }

  function notify(receipt: CadEditorDisplayReceipt) {
    try {
      const mounted = mountedRef.current;
      if (mounted?.focus) {
        const focus = mounted.focus;
        checkFocusFrame(receipt, focus);
        const copied: CadEditorCurveFocusReceipt = structuredClone({ ...receipt, ...focus,
          generation: mounted.generation, displayGeneration: mounted.displayGeneration });
        setDocumentReceipt(null); setFocusedReceipt(copied); propsRef.current.onCurveDisplay?.(structuredClone(copied));
      } else {
        setDocumentReceipt(structuredClone(receipt)); setFocusedReceipt(null); propsRef.current.onCurveDisplay?.(null);
        if (mounted) mounted.documentCamera = structuredClone(receipt.state.camera);
        propsRef.current.onDisplay?.(structuredClone(receipt));
      }
    }
    catch (cause) {
      report(new CadEditorError('DISPLAY', 'Display callback failed.', { field: 'display-callback' }, cause),
        'Display callback failed');
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current!;
    let viewer: Viewer | null = null;
    let pointer: ViewerPointerControls | null = null;
    let keyboard: ViewerKeyboardControls | null = null;
    let observer: ResizeObserver | null = null;
    let disposed = false;
    let published = false;
    let clickGesture: { id: number; x: number; y: number; moved: boolean } | null = null;
    function publish() {
      if (!viewer || disposed || !published || mountedRef.current?.unavailable || mountedRef.current?.admitting) return;
      try { notify(displayReceipt(viewer, canvas, mountedRef.current!.options.viewer.background, lifecycleRef.current, readIndexRef)); }
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
      if (disposed || !event.isPrimary || event.button !== 0 || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return;
      clickGesture = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
    }
    function move(event: PointerEvent) {
      if (clickGesture?.id === event.pointerId
        && Math.hypot(event.clientX - clickGesture.x, event.clientY - clickGesture.y) > 3) clickGesture.moved = true;
    }
    function cancel() { clickGesture = null; }
    function picked(event: PointerEvent) {
      const gesture = clickGesture;
      clickGesture = null;
      if (!viewer || disposed || !gesture || gesture.id !== event.pointerId || gesture.moved
        || Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 3) return;
      const mounted = mountedRef.current;
      const current = session.getSnapshot();
      if (!mounted || mounted.admitting || mounted.unavailable || current.candidate || current.selectionTransition || current.disposed) return;
      try {
        const bounds = canvas.getBoundingClientRect();
        const pick = viewer.pickGeometry({ xCss: event.clientX - bounds.left, yCss: event.clientY - bounds.top });
        if (!pick) return;
        if (pick.ambiguous) throw new CadEditorError('DISPLAY', 'The display pick is ambiguous. Select the object from the object list.');
        const state = viewer.getState();
        if (mounted.focus) {
          const focus = mounted.focus;
          if (pick.kind !== 'curve' || pick.ref.modelId !== focus.sourceModelName || pick.ref.curveId !== focus.curveId
            || focus.reference.documentId !== current.accepted.document.documentId
            || focus.reference.documentRevision !== current.accepted.document.revision) {
            throw new CadEditorError('STALE', 'The picked focused Curve does not match its qualified native document.', { field: 'curve-focus' });
          }
          session.requestSelection({ bodyId: focus.reference.bodyId }); return;
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
      } catch (cause) { report(cause, 'Selecting the picked body failed'); }
    }
    setReady(false);
    setFocusedReceipt(null);
    setErrorMessage(null);
    readIndexRef.current = 0;
    try {
      const options = structuredClone(propsRef.current.displayOptions);
      const initial = session.getSnapshot();
      viewer = createViewer(canvas, options.viewer);
      lifecycleRef.current.mounts++;
      mountedRef.current = { viewer, options, generation: initial.generation,
        displayGeneration: initial.displayGeneration, admitting: false, optionsRefused: false,
        view: structuredClone(initial.view), focus: null, documentCamera: null, unavailable: false };
      resize();
      mountedRef.current.focus = loadView(viewer, initial.accepted, initial.view, options, initial.displayBodyIds);
      selectView(viewer, initial.selectedBodyId, mountedRef.current.focus);
      const receipt = displayReceipt(viewer, canvas, options.viewer.background, lifecycleRef.current, readIndexRef);
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
    } catch (cause) {
      mountedRef.current = null;
      try { propsRef.current.onCurveDisplay?.(null); } catch { /* No focused frame was admitted. */ }
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
      pointer?.dispose();
      keyboard?.dispose();
      if (viewer) {
        viewer.dispose();
        lifecycleRef.current.disposals++;
        const state: ViewerState = viewer.getState();
        try {
          propsRef.current.onCurveDisplay?.(null);
          if (!mountedRef.current?.focus) propsRef.current.onDisplay?.({ state, pixelHash: '', readIndex: readIndexRef.current, nonBackgroundPixels: 0, pixelCount: 0,
            width: canvas.width, height: canvas.height,
            backgroundRGB: propsRef.current.displayOptions.viewer.background.map(value => Math.round(value * 255)) as [number, number, number],
            lifecycle: { ...lifecycleRef.current } });
        } catch { /* Cleanup does not call disposed resources or the session. */ }
      }
      mountedRef.current = null;
    };
  }, [session]);

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
          const receipt = displayReceipt(mounted.viewer, canvas, next.viewer.background, lifecycleRef.current, readIndexRef);
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
              throw new CadEditorError('DISPLAY', 'Restoring the accepted frame failed.', { field: 'restore-frame' }, restoreCause);
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
      const priorDocumentCamera = mounted.view.kind === 'document' ? structuredClone(before.camera) : mounted.documentCamera;
      const camera = candidate.kind === 'open' ? null
        : candidate.view.kind === 'curve-focus' ? mounted.view.kind === 'curve-focus' && mounted.view.bodyId === candidate.view.bodyId ? before.camera : null
          : mounted.view.kind === 'curve-focus' ? priorDocumentCamera : before.camera;
      const focus = loadView(mounted.viewer, candidate.result, candidate.view, mounted.options, candidate.displayBodyIds, camera, () => { displayed = true; });
      selectView(mounted.viewer, candidate.kind === 'open' ? null : current.selectionTransition?.target.bodyId ?? current.selectedBodyId, focus);
      const receipt = displayReceipt(mounted.viewer, canvas, mounted.options.viewer.background, lifecycleRef.current, readIndexRef);
      checkFocusFrame(receipt, focus);
      if (!focus) checkDocumentFrame(receipt, candidate.result, candidate.displayBodyIds);
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
          notify(displayReceipt(mounted.viewer, canvas, mounted.options.viewer.background, lifecycleRef.current, readIndexRef));
        } catch (restoreCause) { restoreFailure = { cause: restoreCause }; }
      }
      try { session.cancelCandidate(candidate.token); }
      catch { /* Another candidate owns the current token. Its pending data is preserved. */ }
      report(cause, 'The candidate was not accepted');
      if (restoreFailure) report(restoreFailure.cause, 'Restoring the accepted frame failed');
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
      notify(displayReceipt(mounted.viewer, canvas, mounted.options.viewer.background, lifecycleRef.current, readIndexRef));
    } catch (cause) { report(cause, 'Selecting the native body failed'); }
  }, [snapshot.selectedBodyId, snapshot.generation, snapshot.displayGeneration, session, ready]);

  useEffect(() => {
    const mounted = mountedRef.current;
    const canvas = canvasRef.current;
    if (!mounted || !canvas || mounted.admitting || mounted.unavailable || props.fitRequest === undefined) return;
    try {
      fitDisplayed(mounted.viewer);
      notify(displayReceipt(mounted.viewer, canvas, mounted.options.viewer.background, lifecycleRef.current, readIndexRef));
    } catch (cause) { report(cause, 'Fitting the viewport failed'); }
  }, [props.fitRequest, session, ready]);

  useEffect(() => {
    const requested = props.fitSelectedRequest;
    if (requested === lastFitSelectedRequestRef.current) return;
    lastFitSelectedRequestRef.current = requested;
    const mounted = mountedRef.current;
    const canvas = canvasRef.current;
    if (!mounted || !canvas || mounted.admitting || mounted.unavailable || requested === undefined) return;
    try {
      const current = session.getSnapshot();
      const state = mounted.viewer.getState();
      if (mounted.focus) {
        if (current.selectedBodyId !== mounted.focus.reference.bodyId) throw new CadEditorError('DISPLAY', 'Select the focused Curve before fitting it.', { field: 'fit-selection' });
        mounted.viewer.fitGeometry({ kind: 'curve', modelId: mounted.focus.sourceModelName, curveId: mounted.focus.curveId });
        notify(displayReceipt(mounted.viewer, canvas, mounted.options.viewer.background, lifecycleRef.current, readIndexRef)); return;
      }
      const body = state.documentBodies.find(body => body.binding.bodyId === current.selectedBodyId);
      if (!body) throw new CadEditorError('DISPLAY', 'Select a displayed body before fitting it.', { field: 'fit-selection' });
      mounted.viewer.fitNativeDocumentBody({ ref: body.ref, documentRevision: current.accepted.document.revision });
      notify(displayReceipt(mounted.viewer, canvas, mounted.options.viewer.background, lifecycleRef.current, readIndexRef));
    } catch (cause) { report(cause, 'Fitting the selected body failed'); }
  }, [props.fitSelectedRequest, session, ready]);

  useEffect(() => {
    const mounted = mountedRef.current;
    const canvas = canvasRef.current;
    if (!mounted || !canvas || mounted.admitting || mounted.unavailable || props.readRequest === undefined) return;
    try {
      notify(displayReceipt(mounted.viewer, canvas, mounted.options.viewer.background, lifecycleRef.current, readIndexRef));
    } catch (cause) {
      report(new CadEditorError('DISPLAY', 'Reading the current displayed frame failed.', { field: 'pixel-read' }, cause),
        'Reading the current displayed frame failed');
    }
  }, [props.readRequest, session, ready]);

  function changeView(view: 'front'|'right'|'top'|'isometric') {
    const state = session.getSnapshot(), mounted = mountedRef.current, canvas = canvasRef.current;
    if (!mounted || !canvas || mounted.unavailable || mounted.admitting || state.candidate
      || state.selectionTransition || Object.keys(state.pending).length) return;
    const before = mounted.viewer.getState().camera;
    const distance = Math.hypot(...before.eye.map((value,index)=>value-before.target[index]));
    const direction: [number,number,number] = view==='front'?[0,0,1]:view==='right'?[1,0,0]:view==='top'?[0,1,0]:[1,1,1];
    const length = Math.hypot(...direction);
    try {
      mounted.viewer.setView({...before,eye:before.target.map((value,index)=>value+direction[index]*distance/length) as [number,number,number],up:view==='top'?[0,0,-1]:[0,1,0]});
      notify(displayReceipt(mounted.viewer,canvas,mounted.options.viewer.background,lifecycleRef.current,readIndexRef));
      setErrorMessage(null);
    } catch (cause) {
      try { mounted.viewer.setView(before); notify(displayReceipt(mounted.viewer,canvas,mounted.options.viewer.background,lifecycleRef.current,readIndexRef)); }
      catch (restoreCause) { report(new CadEditorError('DISPLAY','Restoring the accepted frame failed.',{field:'restore-frame'},restoreCause),'Restoring the accepted frame failed'); return; }
      report(cause,'Changing the view failed');
    }
  }
  const camera = focusedReceipt?.state.camera ?? documentReceipt?.state.camera;
  let orientation = 'Custom';
  if (camera) {
    const delta = camera.eye.map((value,index)=>value-camera.target[index]);
    const length = Math.hypot(...delta), d=delta.map(value=>value/length),eps=1e-6;
    if(Math.abs(d[0])<eps&&Math.abs(d[1])<eps&&d[2]>1-eps)orientation='Front';
    else if(d[0]>1-eps&&Math.abs(d[1])<eps&&Math.abs(d[2])<eps)orientation='Right';
    else if(Math.abs(d[0])<eps&&d[1]>1-eps&&Math.abs(d[2])<eps)orientation='Top';
    else if(d.every(value=>Math.abs(value-1/Math.sqrt(3))<eps))orientation='Isometric';
  }
  const viewBusy=!ready||snapshot.candidate!==null||snapshot.selectionTransition!==null||Object.keys(snapshot.pending).length>0;
  return <div className={cn('cad-editor-viewport', className)} data-viewer-ready={ready}>
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
          if (fitKey) fitDisplayed(mounted.viewer);
          notify(displayReceipt(mounted.viewer, canvas, mounted.options.viewer.background, lifecycleRef.current, readIndexRef));
        }
        catch (cause) { report(cause, 'Reading the displayed frame failed'); }
      }}
      data-testid="cad-editor-canvas" aria-label="CAD viewport. Drag to orbit. Shift drag to pan. Scroll to zoom. Press F to fit." />
    <div className="cad-editor-view-tools" role="group" aria-label="Viewport orientation">
      <span data-testid="viewport-view-status">{orientation} · Perspective</span>
      {(['front','right','top','isometric'] as const).map(view=><button key={view} type="button" data-view={view} data-testid={'view-'+view} aria-label={view[0].toUpperCase()+view.slice(1)+' view'} aria-pressed={orientation.toLowerCase()===view} disabled={viewBusy} onClick={()=>changeView(view)}>{view==='isometric'?'Iso':view[0].toUpperCase()+view.slice(1)}</button>)}
    </div>
    <SurfacePoleHandles session={session} receipt={ready?documentReceipt:null} canvas={canvasRef.current} onError={error=>report(error,'Surface point gesture failed')} />
    {focusedReceipt&&<p className="cad-editor-curve-view-label" data-testid="curve-view-label">Curve focus · {focusedReceipt.bodyName}<span>Other objects remain in document view.</span></p>}
    <CurvePoleHandles session={session} receipt={focusedReceipt} canvas={canvasRef.current} onError={error => report(error, 'Curve point gesture failed')} />
    {errorMessage && <p className="cad-editor-error" role="alert">{errorMessage}</p>}
  </div>;
}
