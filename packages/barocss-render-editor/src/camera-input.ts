import type {MeshCamera} from '@barocss/gpu';
import {deriveRenderCameraInteraction} from './mixed-camera-navigation.js';

type Interaction = Parameters<typeof deriveRenderCameraInteraction>[1];
interface CameraInputSnapshot {accepted: {camera: MeshCamera}; disposed: boolean}
export interface CameraInputController<S extends CameraInputSnapshot, E extends Error> {
  session: {getSnapshot: () => S; subscribe: (listener: () => void) => () => void};
  getSnapshot: () => {cameraPreview: MeshCamera | null; presentationError: E | null; presentedRevision: number | null; disposed: boolean};
  subscribe: (listener: () => void) => () => void;
  previewCamera: (camera: MeshCamera) => {ok: true} | {ok: false; error: E};
  cancelCameraPreview: () => {ok: true} | {ok: false; error: E};
}
export interface CameraInputOptions<E extends Error> {
  mode: () => 'orbit' | 'pan';
  onError: (error: E) => void;
  normalizeError: (cause: unknown) => E;
  canNavigate?: () => boolean;
}

/** Private DOM transport. Source, preview admission, and authoring stay in the controller. */
export function createCameraInput<S extends CameraInputSnapshot, E extends Error>(canvas: HTMLCanvasElement, controller: CameraInputController<S, E>, options: CameraInputOptions<E>) {
  let disposed = false, presenting = false, frame = 0;
  let queued: Interaction[] = [];
  let baseline = controller.session.getSnapshot();
  let expectedPreview = controller.getSnapshot().cameraPreview;
  let drag: {id: number; x: number; y: number} | null = null;

  const reset = () => {
    if (frame) cancelAnimationFrame(frame);
    frame = 0; queued = [];
    const previous = drag; drag = null;
    if (previous && canvas.hasPointerCapture(previous.id)) {
      try { canvas.releasePointerCapture(previous.id); } catch { /* Capture may end during loss. */ }
    }
    baseline = controller.session.getSnapshot();
    expectedPreview = controller.getSnapshot().cameraPreview;
  };
  const alive = () => {
    const view = controller.getSnapshot();
    return (options.canNavigate?.() ?? true) && !disposed && !view.disposed && !controller.session.getSnapshot().disposed && view.presentedRevision !== null;
  };
  const current = () => alive() && baseline === controller.session.getSnapshot() && expectedPreview === controller.getSnapshot().cameraPreview;
  const refused = (cause: unknown) => {
    reset();
    const error = controller.getSnapshot().presentationError;
    options.onError(cause === error && error !== null ? error : options.normalizeError(cause));
  };
  const flush = () => {
    frame = 0;
    const interactions = queued; queued = [];
    if (!current()) { reset(); return; }
    try {
      let camera: MeshCamera = expectedPreview ?? baseline.accepted.camera;
      for (const interaction of interactions) camera = deriveRenderCameraInteraction(camera, interaction);
      presenting = true;
      try {
        const result = controller.previewCamera(camera);
        expectedPreview = controller.getSnapshot().cameraPreview;
        if (!result.ok) refused(result.error);
      } finally { presenting = false; }
    } catch (cause) { refused(cause); }
  };
  const enqueue = (interaction: Interaction) => {
    if (!alive()) { reset(); return; }
    if (!drag && queued.length === 0) {
      baseline = controller.session.getSnapshot();
      expectedPreview = controller.getSnapshot().cameraPreview;
    }
    if (!current()) { reset(); return; }
    queued.push(interaction);
    if (!frame) frame = requestAnimationFrame(flush);
  };
  const move = (kind: 'orbit' | 'pan', deltaX: number, deltaY: number) => {
    const {width, height} = canvas.getBoundingClientRect();
    enqueue({kind, deltaX, deltaY, width, height});
  };
  const down = (event: PointerEvent) => {
    if (event.button !== 0 || !alive()) return;
    reset();
    canvas.focus();
    drag = {id: event.pointerId, x: event.clientX, y: event.clientY};
    try { canvas.setPointerCapture(event.pointerId); } catch { drag = null; return; }
    event.preventDefault();
  };
  const motion = (event: PointerEvent) => {
    if (!drag || drag.id !== event.pointerId) return;
    if (!current()) { reset(); return; }
    const deltaX = event.clientX - drag.x, deltaY = event.clientY - drag.y;
    drag.x = event.clientX; drag.y = event.clientY;
    if (deltaX !== 0 || deltaY !== 0) move(event.shiftKey ? 'pan' : options.mode(), deltaX, deltaY);
    event.preventDefault();
  };
  const up = (event: PointerEvent) => {
    if (!drag || drag.id !== event.pointerId) return;
    if (!current()) { reset(); return; }
    const previous = drag;
    const deltaX = event.clientX - previous.x, deltaY = event.clientY - previous.y;
    if (deltaX !== 0 || deltaY !== 0) move(event.shiftKey ? 'pan' : options.mode(), deltaX, deltaY);
    drag = null;
    if (canvas.hasPointerCapture(previous.id)) canvas.releasePointerCapture(previous.id);
  };
  const canceled = () => reset();
  const lost = () => { if (drag) reset(); };
  const wheel = (event: WheelEvent) => {
    if (!alive() || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? canvas.getBoundingClientRect().height : 1;
    const delta = event.deltaY * unit;
    if (!Number.isFinite(delta)) { refused(new Error('Wheel input must be finite.')); return; }
    enqueue({kind: 'zoom', factor: Math.exp(-Math.max(-1000, Math.min(1000, delta)) * .001)});
  };
  const key = (event: KeyboardEvent) => {
    if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey || !alive()) return;
    if (event.key === 'Escape') {
      event.preventDefault(); reset();
      const result = controller.cancelCameraPreview();
      if (!result.ok) options.onError(result.error);
      return;
    }
    const arrows: Record<string, [number, number]> = {ArrowLeft: [-16, 0], ArrowRight: [16, 0], ArrowUp: [0, -16], ArrowDown: [0, 16]};
    if (arrows[event.key]) {
      event.preventDefault();
      move(event.shiftKey ? 'pan' : options.mode(), ...arrows[event.key]);
    } else if (['+', '=', '-', '_'].includes(event.key)) {
      event.preventDefault(); enqueue({kind: 'zoom', factor: event.key === '+' || event.key === '=' ? 1.15 : 1 / 1.15});
    }
  };

  const stopSession = controller.session.subscribe(reset);
  const stopController = controller.subscribe(() => {
    if (!presenting && (!alive() || expectedPreview !== controller.getSnapshot().cameraPreview)) reset();
  });
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', motion);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', canceled);
  canvas.addEventListener('lostpointercapture', lost);
  canvas.addEventListener('wheel', wheel, {passive: false});
  canvas.addEventListener('keydown', key);
  canvas.addEventListener('blur', canceled);
  canvas.addEventListener('webglcontextlost', canceled);
  return {
    reset,
    dispose() {
      if (disposed) return;
      reset(); disposed = true; stopSession(); stopController();
      canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', motion);
      canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointercancel', canceled);
      canvas.removeEventListener('lostpointercapture', lost); canvas.removeEventListener('wheel', wheel);
      canvas.removeEventListener('keydown', key); canvas.removeEventListener('blur', canceled);
      canvas.removeEventListener('webglcontextlost', canceled);
    },
  };
}
