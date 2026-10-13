import {deriveRenderCameraInteraction, RenderEditorError} from '@barocss/render-editor';
import type {RenderCameraInteraction, RenderNativeLightSession} from '@barocss/render-editor';
import type {MeshCamera} from '@barocss/gpu';
import {deriveNativeLightViewPreset, type NativeLightViewPreset} from './native-light-view-presets';

/** Private async DOM transport. Camera math and presentation remain owned public services. */
export function createNativeLightNavigation(canvas: HTMLCanvasElement, session: RenderNativeLightSession, options: {
  mode(): 'orbit' | 'pan'; canNavigate(): boolean; onBusy(busy: boolean): void; onError(cause: unknown): void;
  onPicked(bodyId: string): void;
}) {
  let disposed = false, sending = false, picking = false, queued = false, frame: number | null = null, epoch = 0, announced = false;
  let desired: MeshCamera | null = null, document = session.getSnapshot().accepted;
  let pickingPointer: number | null = null;
  let expected = session.getSnapshot().version;
  let inputRect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'> | null = null;
  let drag: {id: number; x: number; y: number; originX: number; originY: number; moved: boolean; eligible: boolean;
    backingWidth: number; backingHeight: number; width: number; height: number; left: number; top: number} | null = null;
  const active = () => !!drag || sending || picking || queued || frame !== null;
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
    if (picking) return;
    if (!alive()) {cancel(); return;}
    const snapshot = session.getSnapshot();
    if (!active()) {document = snapshot.accepted; expected = snapshot.version; desired = snapshot.viewportCamera ?? snapshot.accepted.display.camera; inputRect = canvas.getBoundingClientRect();}
    if (!current() || snapshot.pending !== null && !(sending && snapshot.pending === 'view') || sending && desired === null) {cancel(); return;}
    try {
      desired = deriveRenderCameraInteraction(desired ?? snapshot.viewportCamera ?? snapshot.accepted.display.camera, interaction);
      queued = true; if (!sending && frame === null) frame = requestAnimationFrame(() => {void flush();}); announce();
    } catch (cause) {refused(cause);}
  };
  const selectPreset = (preset: NativeLightViewPreset) => {
    if (!alive() || active()) return false;
    const snapshot = session.getSnapshot();
    if (snapshot.pending !== null || snapshot.disposed || !Number.isInteger(canvas.width)
      || !Number.isInteger(canvas.height) || canvas.width <= 0 || canvas.height <= 0) return false;
    const rect = canvas.getBoundingClientRect();
    if (![rect.left, rect.top, rect.width, rect.height].every(Number.isFinite)
      || rect.width <= 0 || rect.height <= 0) return false;
    document = snapshot.accepted; expected = snapshot.version;
    inputRect = rect;
    try {
      desired = deriveNativeLightViewPreset(snapshot.viewportCamera ?? snapshot.accepted.display.camera,
        preset, canvas.width / canvas.height);
      queued = true;
      frame = requestAnimationFrame(() => {void flush();});
      announce();
      return true;
    } catch (cause) {refused(cause); return false;}
  };
  const down = (event: PointerEvent) => {
    if (event.button !== 0 || event.isPrimary === false || event.ctrlKey || event.metaKey || event.altKey
      || active() || !alive() || session.getSnapshot().pending !== null) return;
    const rect = canvas.getBoundingClientRect();
    if (![rect.left, rect.top, rect.width, rect.height, event.clientX, event.clientY].every(Number.isFinite)
      || rect.width <= 0 || rect.height <= 0 || event.clientX < rect.left || event.clientY < rect.top
      || event.clientX >= rect.left + rect.width || event.clientY >= rect.top + rect.height) return;
    if (!active()) {const snapshot = session.getSnapshot(); document = snapshot.accepted; expected = snapshot.version; desired = snapshot.viewportCamera ?? snapshot.accepted.display.camera; inputRect = rect;}
    if (!current()) {cancel(); return;}
    try {canvas.focus({preventScroll: true}); canvas.setPointerCapture(event.pointerId);}
    catch (cause) {refused(cause); return;}
    drag = {id: event.pointerId, x: event.clientX, y: event.clientY, originX: event.clientX, originY: event.clientY,
      moved: false, eligible: !event.shiftKey, backingWidth: canvas.width, backingHeight: canvas.height,
      left: rect.left, top: rect.top, width: rect.width, height: rect.height};
    event.preventDefault(); announce();
  };
  const move = (event: PointerEvent) => {
    if (!drag || event.pointerId !== drag.id) return;
    const rect = canvas.getBoundingClientRect();
    if (!current() || rect.left !== drag.left || rect.top !== drag.top || rect.width !== drag.width || rect.height !== drag.height
      || canvas.width !== drag.backingWidth || canvas.height !== drag.backingHeight
      || !Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) {cancel(); return;}
    if (event.shiftKey || event.ctrlKey || event.metaKey || event.altKey || event.isPrimary === false) drag.eligible = false;
    if (!drag.moved) {
      if (Math.hypot(event.clientX - drag.originX, event.clientY - drag.originY) <= 3) {event.preventDefault(); return;}
      drag.moved = true;
    }
    const deltaX = event.clientX - drag.x, deltaY = event.clientY - drag.y;
    drag.x = event.clientX; drag.y = event.clientY;
    if (deltaX || deltaY) interact({kind: event.shiftKey ? 'pan' : options.mode(), deltaX, deltaY, width: rect.width, height: rect.height});
    event.preventDefault();
  };
  const pick = async (event: PointerEvent, pointer: NonNullable<typeof drag>) => {
    const started = epoch, before = session.getSnapshot(), width = canvas.width, height = canvas.height;
    const status = session.getStatus();
    const x = Math.floor((event.clientX - pointer.left) * width / pointer.width);
    const y = Math.floor((event.clientY - pointer.top) * height / pointer.height);
    const unchanged = () => current() && session.getSnapshot() === before
      && canvas.width === width && canvas.height === height
      && session.getStatus().width === width && session.getStatus().height === height;
    if (!unchanged() || !Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0
      || width !== pointer.backingWidth || height !== pointer.backingHeight || status.state !== 'ready'
      || !Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= width || y >= height) {
      refused(new RenderEditorError('STALE_CANDIDATE', 'Canvas pick requires unchanged bounded viewport coordinates.')); return;
    }
    picking = true; pickingPointer = pointer.id; announce();
    try {
      const bodyId = await session.pickViewportBody(x, y, before.version);
      if (!disposed && epoch === started && unchanged() && bodyId !== null) options.onPicked(bodyId);
    } catch (cause) {if (!disposed && epoch === started) refused(cause);}
    finally {picking = false; pickingPointer = null; if (!disposed && epoch === started) {desired = null; inputRect = null;} announce();}
  };
  const up = (event: PointerEvent) => {
    if (!drag || drag.id !== event.pointerId) return;
    move(event); const pointer = drag; release();
    if (pointer && !pointer.moved && pointer.eligible && event.button === 0) void pick(event, pointer);
    announce();
  };
  // Normal pointerup releases capture before querying. Its delayed loss event is
  // expected, not cancellation of the already released click. Loss during drag is different.
  const lost = (event: PointerEvent) => {if (drag?.id === event.pointerId) cancel();};
  const pointerCancel = (event: PointerEvent) => {if (drag?.id === event.pointerId || pickingPointer === event.pointerId) cancel();};
  const wheel = (event: WheelEvent) => {
    if (drag) drag.eligible = false;
    if (!alive() || event.ctrlKey || event.metaKey) return;
    event.preventDefault(); const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? canvas.getBoundingClientRect().height : 1;
    const delta = event.deltaY * unit;
    if (!Number.isFinite(delta)) {refused(new RenderEditorError('DOCUMENT_INPUT', 'Wheel input must be finite.')); return;}
    interact({kind: 'zoom', factor: Math.exp(-Math.max(-1000, Math.min(1000, delta)) * .001)});
  };
  const key = (event: KeyboardEvent) => {
    if (drag) drag.eligible = false;
    if (event.key === 'Escape' && active()) {event.preventDefault(); cancel(); return;}
    if (event.target !== canvas || canvas.ownerDocument.activeElement !== canvas
      || event.isComposing || event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
    const preset = event.key === '1' ? 'front' : event.key === '3' ? 'right'
      : event.key === '7' ? 'top' : null;
    if (preset && selectPreset(preset)) event.preventDefault();
  };
  canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', pointerCancel); canvas.addEventListener('lostpointercapture', lost); canvas.addEventListener('wheel', wheel, {passive: false});
  canvas.addEventListener('keydown', key); canvas.addEventListener('blur', cancel); window.addEventListener('blur', cancel);
  return {interact, cancel, isActive: active, dispose() {
    if (disposed) return; cancel(); disposed = true;
    canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerup', up);
    canvas.removeEventListener('pointercancel', pointerCancel); canvas.removeEventListener('lostpointercapture', lost); canvas.removeEventListener('wheel', wheel);
    canvas.removeEventListener('keydown', key); canvas.removeEventListener('blur', cancel); window.removeEventListener('blur', cancel);
  }};
}
