import {deriveRenderCameraInteraction, RenderEditorError} from '@barocss/render-editor';
import type {RenderCameraInteraction, RenderNativeLightSession} from '@barocss/render-editor';
import type {MeshCamera} from '@barocss/gpu';

/** Private async DOM transport. Camera math and presentation remain owned public services. */
export function createNativeLightNavigation(canvas: HTMLCanvasElement, session: RenderNativeLightSession, options: {
  mode(): 'orbit' | 'pan'; canNavigate(): boolean; onBusy(busy: boolean): void; onError(cause: unknown): void;
}) {
  let disposed = false, sending = false, queued = false, frame: number | null = null, epoch = 0, announced = false;
  let desired: MeshCamera | null = null, document = session.getSnapshot().accepted;
  let expected = session.getSnapshot().version;
  let inputRect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'> | null = null;
  let drag: {id: number; x: number; y: number; width: number; height: number; left: number; top: number} | null = null;
  const active = () => !!drag || sending || queued || frame !== null;
  const announce = () => {const busy = active(); if (!disposed && busy !== announced) {announced = busy; options.onBusy(busy);}};
  const alive = () => !disposed && options.canNavigate() && !session.getSnapshot().disposed && session.getStatus().state === 'ready';
  const release = () => {const previous = drag; drag = null; if (previous && canvas.hasPointerCapture(previous.id)) {try {canvas.releasePointerCapture(previous.id);} catch {/* Capture can already be gone. */}}};
  const cancel = () => {
    epoch++; queued = false; desired = null; inputRect = null;
    if (frame !== null) {cancelAnimationFrame(frame); frame = null;}
    release(); announce();
  };
  const current = () => {
    const snapshot = session.getSnapshot();
    const rect = canvas.getBoundingClientRect();
    return alive() && snapshot.accepted === document && (sending || snapshot.version.generation === expected.generation)
      && (!inputRect || (['left', 'top', 'width', 'height'] as const).every(key => rect[key] === inputRect![key]));
  };
  const refused = (cause: unknown) => {cancel(); if (!disposed) options.onError(cause);};
  const flush = async () => {
    frame = null;
    if (sending || !queued || !desired) {announce(); return;}
    if (!current()) {cancel(); return;}
    const target = desired, started = epoch;
    queued = false; sending = true; announce();
    try {
      const operation = session.navigateViewportCamera(target, expected), pending = session.getSnapshot();
      const finalGeneration = pending.version.generation + (pending.pending === 'view' ? 1 : 0);
      await operation;
      if (disposed || epoch !== started) return;
      const after = session.getSnapshot();
      if (!alive() || after.accepted !== document || after.version.generation !== finalGeneration)
        throw new RenderEditorError('STALE_CANDIDATE', 'The workspace changed during viewport navigation.');
      expected = after.version;
      if (!queued) desired = after.viewportCamera ?? after.accepted.display.camera;
    } catch (cause) {if (!disposed && epoch === started) refused(cause);}
    finally {
      sending = false;
      if (!disposed && epoch === started && queued) {
        if (current()) frame = requestAnimationFrame(() => {void flush();}); else cancel();
      }
      announce();
    }
  };
  const interact = (interaction: RenderCameraInteraction) => {
    if (!alive()) {cancel(); return;}
    const snapshot = session.getSnapshot();
    if (!active()) {document = snapshot.accepted; expected = snapshot.version; desired = snapshot.viewportCamera ?? snapshot.accepted.display.camera; inputRect = canvas.getBoundingClientRect();}
    if (!current() || snapshot.pending !== null && !(sending && snapshot.pending === 'view') || sending && desired === null) {cancel(); return;}
    try {
      desired = deriveRenderCameraInteraction(desired ?? snapshot.viewportCamera ?? snapshot.accepted.display.camera, interaction);
      queued = true; if (!sending && frame === null) frame = requestAnimationFrame(() => {void flush();}); announce();
    } catch (cause) {refused(cause);}
  };
  const down = (event: PointerEvent) => {
    if (event.button !== 0 || drag || !alive() || session.getSnapshot().pending !== null) return;
    const rect = canvas.getBoundingClientRect();
    if (![rect.left, rect.top, rect.width, rect.height].every(Number.isFinite) || rect.width <= 0 || rect.height <= 0) return;
    if (!active()) {const snapshot = session.getSnapshot(); document = snapshot.accepted; expected = snapshot.version; desired = snapshot.viewportCamera ?? snapshot.accepted.display.camera; inputRect = rect;}
    if (!current()) {cancel(); return;}
    try {canvas.focus({preventScroll: true}); canvas.setPointerCapture(event.pointerId);}
    catch (cause) {refused(cause); return;}
    drag = {id: event.pointerId, x: event.clientX, y: event.clientY, left: rect.left, top: rect.top, width: rect.width, height: rect.height};
    event.preventDefault(); announce();
  };
  const move = (event: PointerEvent) => {
    if (!drag || event.pointerId !== drag.id) return;
    const rect = canvas.getBoundingClientRect();
    if (!current() || rect.left !== drag.left || rect.top !== drag.top || rect.width !== drag.width || rect.height !== drag.height) {cancel(); return;}
    const deltaX = event.clientX - drag.x, deltaY = event.clientY - drag.y;
    drag.x = event.clientX; drag.y = event.clientY;
    if (deltaX || deltaY) interact({kind: event.shiftKey ? 'pan' : options.mode(), deltaX, deltaY, width: rect.width, height: rect.height});
    event.preventDefault();
  };
  const up = (event: PointerEvent) => {if (!drag || drag.id !== event.pointerId) return; move(event); release(); announce();};
  const lost = (event: PointerEvent) => {if (drag?.id === event.pointerId) cancel();};
  const wheel = (event: WheelEvent) => {
    if (!alive() || event.ctrlKey || event.metaKey) return;
    event.preventDefault(); const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? canvas.getBoundingClientRect().height : 1;
    const delta = event.deltaY * unit;
    if (!Number.isFinite(delta)) {refused(new RenderEditorError('DOCUMENT_INPUT', 'Wheel input must be finite.')); return;}
    interact({kind: 'zoom', factor: Math.exp(-Math.max(-1000, Math.min(1000, delta)) * .001)});
  };
  const key = (event: KeyboardEvent) => {if (event.key === 'Escape' && active()) {event.preventDefault(); cancel();}};
  canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', lost); canvas.addEventListener('lostpointercapture', lost); canvas.addEventListener('wheel', wheel, {passive: false});
  canvas.addEventListener('keydown', key); canvas.addEventListener('blur', cancel); window.addEventListener('blur', cancel);
  return {interact, cancel, isActive: active, dispose() {
    if (disposed) return; cancel(); disposed = true;
    canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerup', up);
    canvas.removeEventListener('pointercancel', lost); canvas.removeEventListener('lostpointercapture', lost); canvas.removeEventListener('wheel', wheel);
    canvas.removeEventListener('keydown', key); canvas.removeEventListener('blur', cancel); window.removeEventListener('blur', cancel);
  }};
}
