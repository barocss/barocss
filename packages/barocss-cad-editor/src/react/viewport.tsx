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
  const ref = bodyId === null ? null
    : viewer.getState().documentBodies.find(body => body.binding.bodyId === bodyId)?.ref;
  if (ref === undefined) throw new CadEditorError('DISPLAY', 'The selected body has no admitted native display binding.');
  viewer.selectGeometry(ref);
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  function report(cause: unknown, detail: string) {
    const error = cause instanceof CadEditorError ? cause
      : new CadEditorError('DISPLAY', `${detail}: ${cause instanceof Error ? cause.message : 'operation refused'}`, {}, cause);
    setErrorMessage(detail === 'Restoring the accepted frame failed' || error.context.field === 'restore-frame'
      ? 'Cannot restore the current view. Reopen the viewport.'
      : detail === 'Opening the Viewer failed'
        ? 'Cannot open the viewport. Check the document and display settings.'
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
    setReady(false);
    setErrorMessage(null);
    readIndexRef.current = 0;
    try {
      const options = structuredClone(propsRef.current.displayOptions);
      const initial = session.getSnapshot();
      viewer = createViewer(canvas, options.viewer);
      lifecycleRef.current.mounts++;
      mountedRef.current = { viewer, options, generation: initial.generation, admitting: false, optionsRefused: false };
      resize();
      viewer.loadDocument(initial.accepted, options.document);
      selectBody(viewer, initial.selection?.bodyId ?? null);
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
      if (!sameOptions(next.document, mounted.options.document)) {
        const before = mounted.viewer.getState();
        const accepted = session.getSnapshot();
        let displayed = false;
        try {
          mounted.viewer.loadDocument(accepted.accepted, next.document);
          displayed = true;
          selectBody(mounted.viewer, accepted.selection?.bodyId ?? null);
          const receipt = displayReceipt(mounted.viewer, canvas, next.viewer.background, lifecycleRef.current, readIndexRef);
          mounted.options = next;
          mounted.generation = accepted.generation;
          mounted.optionsRefused = false;
          setErrorMessage(null);
          notify(receipt);
        } catch (cause) {
          mounted.optionsRefused = true;
          // loadDocument is transactional; restore only if readPixels failed after admission.
          if (displayed) {
            try {
              mounted.viewer.loadDocument(accepted.accepted, mounted.options.document);
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
      mounted.viewer.loadDocument(candidate.result, mounted.options.document);
      displayed = true;
      selectBody(mounted.viewer, candidate.kind === 'open' ? null : current.selection?.bodyId ?? null);
      const receipt = displayReceipt(mounted.viewer, canvas, mounted.options.viewer.background, lifecycleRef.current, readIndexRef);
      const accepted = session.acceptCandidate(candidate.token);
      mounted.generation = accepted.generation;
      setErrorMessage(null);
      notify(receipt);
      try { propsRef.current.onAccepted?.(accepted); }
      catch (cause) { report(cause, 'Accepted callback failed'); }
    } catch (cause) {
      let restoreFailure: { cause: unknown } | null = null;
      if (displayed) {
        try {
          const accepted = session.getSnapshot();
          mounted.viewer.loadDocument(accepted.accepted, mounted.options.document);
          // A stale candidate must not reset the previous accepted camera.
          mounted.viewer.setView(before.camera);
          restoreSelection(mounted.viewer, before);
          mounted.generation = accepted.generation;
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
      selectBody(mounted.viewer, current.selection?.bodyId ?? null);
      notify(displayReceipt(mounted.viewer, canvas, mounted.options.viewer.background, lifecycleRef.current, readIndexRef));
    } catch (cause) { report(cause, 'Selecting the native body failed'); }
  }, [snapshot.selection?.bodyId, snapshot.generation, session, ready]);

  useEffect(() => {
    const mounted = mountedRef.current;
    const canvas = canvasRef.current;
    if (!mounted || !canvas || mounted.admitting || props.fitRequest === undefined) return;
    try {
      mounted.viewer.fit();
      notify(displayReceipt(mounted.viewer, canvas, mounted.options.viewer.background, lifecycleRef.current, readIndexRef));
    } catch (cause) { report(cause, 'Fitting the viewport failed'); }
  }, [props.fitRequest, session, ready]);

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
      data-testid="cad-editor-canvas" aria-label="CAD viewport. Drag to orbit. Shift drag to pan. Scroll to zoom. Press F to fit." />
    {errorMessage && <p className="cad-editor-error" role="alert">{errorMessage}</p>}
  </div>;
}
