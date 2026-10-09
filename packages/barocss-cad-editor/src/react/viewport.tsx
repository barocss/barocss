import { useEffect, useRef, useState } from 'react';
import { createViewer } from '@barocss/viewer';
import type { Viewer, ViewerKeyboardControls, ViewerPointerControls, ViewerState } from '@barocss/viewer';
import { CadEditorError } from '../types.js';
import { cn } from '../lib/utils.js';
import { useCadEditorSnapshot } from './use-session.js';
import type { CadEditorDisplayOptions, CadEditorDisplayReceipt, CadEditorViewportProps } from './types.js';

interface MountedViewer {
  viewer: Viewer;
  options: CadEditorDisplayOptions;
  generation: number;
  displayGeneration: number;
  admitting: boolean;
  optionsRefused: boolean;
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

function documentOptions(options: CadEditorDisplayOptions['document'], bodyIds: string[]) {
  return { ...options, bodyIds: [...bodyIds] };
}

function fitDisplayed(viewer: Viewer) {
  const state = viewer.getState();
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
  viewer.selectGeometry(previous !== null && current.documentBodies.some(body => sameOptions(body.ref, previous))
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

  function report(cause: unknown, detail: string) {
    const error = cause instanceof CadEditorError ? cause
      : new CadEditorError('DISPLAY', `${detail}: ${cause instanceof Error ? cause.message : 'operation refused'}`, {}, cause);
    setErrorMessage(detail === 'Restoring the accepted frame failed' || error.context.field === 'restore-frame'
      ? 'Cannot restore the current view. Reopen the viewport.'
      : detail === 'Opening the Viewer failed'
        ? 'Cannot open the viewport. Check the document and display settings.'
        : detail === 'Selecting the picked body failed'
          ? 'Select the object from the list. This display point cannot be selected.'
          : detail === 'Fitting the selected body failed'
            ? 'Select a displayed object before fitting it.'
        : 'Cannot display this change. The current view is retained.');
    try { propsRef.current.onError?.(error); } catch { /* Host callbacks do not change admission. */ }
  }

  function notify(receipt: CadEditorDisplayReceipt) {
    try { propsRef.current.onDisplay?.(receipt); }
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
      if (!viewer || disposed || !published) return;
      try { notify(displayReceipt(viewer, canvas, mountedRef.current!.options.viewer.background, lifecycleRef.current, readIndexRef)); }
      catch (cause) { report(cause, 'Reading the displayed frame failed'); }
    }
    function resize() {
      if (!viewer || disposed) return;
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
      if (!mounted || mounted.admitting || current.candidate || current.selectionTransition || current.disposed) return;
      try {
        const bounds = canvas.getBoundingClientRect();
        const pick = viewer.pickGeometry({ xCss: event.clientX - bounds.left, yCss: event.clientY - bounds.top });
        if (!pick) return;
        if (pick.ambiguous) throw new CadEditorError('DISPLAY', 'The display pick is ambiguous. Select the object from the object list.');
        const state = viewer.getState();
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
    setErrorMessage(null);
    readIndexRef.current = 0;
    try {
      const options = structuredClone(propsRef.current.displayOptions);
      const initial = session.getSnapshot();
      viewer = createViewer(canvas, options.viewer);
      lifecycleRef.current.mounts++;
      mountedRef.current = { viewer, options, generation: initial.generation,
        displayGeneration: initial.displayGeneration, admitting: false, optionsRefused: false };
      resize();
      viewer.loadDocument(initial.accepted, documentOptions(options.document, initial.displayBodyIds));
      selectBody(viewer, initial.selectedBodyId);
      const receipt = displayReceipt(viewer, canvas, options.viewer.background, lifecycleRef.current, readIndexRef);
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
          propsRef.current.onDisplay?.({ state, pixelHash: '', readIndex: readIndexRef.current, nonBackgroundPixels: 0, pixelCount: 0,
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
    if (!mounted || !canvas || mounted.admitting) return;
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
          mounted.viewer.loadDocument(accepted.accepted, documentOptions(next.document, accepted.displayBodyIds));
          displayed = true;
          selectBody(mounted.viewer, accepted.selectedBodyId);
          const receipt = displayReceipt(mounted.viewer, canvas, next.viewer.background, lifecycleRef.current, readIndexRef);
          mounted.options = next;
          mounted.generation = accepted.generation;
          mounted.displayGeneration = accepted.displayGeneration;
          mounted.optionsRefused = false;
          setErrorMessage(null);
          notify(receipt);
        } catch (cause) {
          mounted.optionsRefused = true;
          // loadDocument is transactional; restore only if readPixels failed after admission.
          if (displayed) {
            try {
              mounted.viewer.loadDocument(accepted.accepted, documentOptions(mounted.options.document, accepted.displayBodyIds));
              mounted.viewer.setView(before.camera);
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
      if (mounted.optionsRefused) throw new CadEditorError('DISPLAY', 'The display options were refused. The pending values remain available.');
      mounted.viewer.loadDocument(candidate.result, documentOptions(mounted.options.document, candidate.displayBodyIds));
      displayed = true;
      if (candidate.kind === 'display') mounted.viewer.setView(before.camera);
      selectBody(mounted.viewer, candidate.kind === 'open' ? null : current.selectionTransition?.target.bodyId ?? current.selectedBodyId);
      const receipt = displayReceipt(mounted.viewer, canvas, mounted.options.viewer.background, lifecycleRef.current, readIndexRef);
      const accepted = session.acceptCandidate(candidate.token);
      mounted.generation = accepted.generation;
      mounted.displayGeneration = accepted.displayGeneration;
      setErrorMessage(null);
      notify(receipt);
      try { propsRef.current.onAccepted?.(accepted); }
      catch (cause) { report(cause, 'Accepted callback failed'); }
    } catch (cause) {
      let restoreFailure: { cause: unknown } | null = null;
      if (displayed) {
        try {
          const accepted = session.getSnapshot();
          mounted.viewer.loadDocument(accepted.accepted, documentOptions(mounted.options.document, accepted.displayBodyIds));
          // A stale candidate must not reset the previous accepted camera.
          mounted.viewer.setView(before.camera);
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
    if (!mounted || !canvas || mounted.admitting) return;
    const current = session.getSnapshot();
    if (current.candidate || current.disposed) return;
    try {
      selectBody(mounted.viewer, current.selectedBodyId);
      setErrorMessage(null);
      notify(displayReceipt(mounted.viewer, canvas, mounted.options.viewer.background, lifecycleRef.current, readIndexRef));
    } catch (cause) { report(cause, 'Selecting the native body failed'); }
  }, [snapshot.selectedBodyId, snapshot.generation, snapshot.displayGeneration, session, ready]);

  useEffect(() => {
    const mounted = mountedRef.current;
    const canvas = canvasRef.current;
    if (!mounted || !canvas || mounted.admitting || props.fitRequest === undefined) return;
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
    if (!mounted || !canvas || mounted.admitting || requested === undefined) return;
    try {
      const current = session.getSnapshot();
      const state = mounted.viewer.getState();
      const body = state.documentBodies.find(body => body.binding.bodyId === current.selectedBodyId);
      if (!body) throw new CadEditorError('DISPLAY', 'Select a displayed body before fitting it.', { field: 'fit-selection' });
      mounted.viewer.fitNativeDocumentBody({ ref: body.ref, documentRevision: current.accepted.document.revision });
      notify(displayReceipt(mounted.viewer, canvas, mounted.options.viewer.background, lifecycleRef.current, readIndexRef));
    } catch (cause) { report(cause, 'Fitting the selected body failed'); }
  }, [props.fitSelectedRequest, session, ready]);

  useEffect(() => {
    const mounted = mountedRef.current;
    const canvas = canvasRef.current;
    if (!mounted || !canvas || mounted.admitting || props.readRequest === undefined) return;
    try {
      notify(displayReceipt(mounted.viewer, canvas, mounted.options.viewer.background, lifecycleRef.current, readIndexRef));
    } catch (cause) {
      report(new CadEditorError('DISPLAY', 'Reading the current displayed frame failed.', { field: 'pixel-read' }, cause),
        'Reading the current displayed frame failed');
    }
  }, [props.readRequest, session, ready]);

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
        if (!mounted || !canvas) return;
        try {
          if (fitKey) fitDisplayed(mounted.viewer);
          notify(displayReceipt(mounted.viewer, canvas, mounted.options.viewer.background, lifecycleRef.current, readIndexRef));
        }
        catch (cause) { report(cause, 'Reading the displayed frame failed'); }
      }}
      data-testid="cad-editor-canvas" aria-label="CAD viewport. Drag to orbit. Shift drag to pan. Scroll to zoom. Press F to fit." />
    {errorMessage && <p className="cad-editor-error" role="alert">{errorMessage}</p>}
  </div>;
}
