import type {RenderEditorController} from './controller.js';
import type {SceneViewportPresenter} from './scene-viewport.js';
import {normalizeRenderEditorError, type RenderEditorError} from './errors.js';

interface SelectionOptions {
  canSelect: () => boolean;
  onSelection: (objectId: string | null) => void;
  onError: (error: RenderEditorError) => void;
  /** Stop the separate camera transport before a click query, including background. */
  onClick?: () => void;
}
interface ContentBox {
  left: number; top: number; width: number; height: number;
  outerLeft: number; outerTop: number; outerWidth: number; outerHeight: number;
  backingWidth: number; backingHeight: number;
}
const sameBox = (a: ContentBox, b: ContentBox) => (Object.keys(a) as Array<keyof ContentBox>).every(key => a[key] === b[key]);
const unmodified = (event: PointerEvent) => event.isPrimary && event.button === 0
  && !event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey;

/** Private DOM transport. The presenter retains original Source1 geometry authority. */
export function createSceneSelectionInput(canvas: HTMLCanvasElement, controller: RenderEditorController,
  presenter: Pick<SceneViewportPresenter, 'pickObject'>, options: SelectionOptions) {
  const view = canvas.ownerDocument.defaultView;
  if (!view) throw new Error('Canvas selection requires its own document window.');
  let disposed = false;
  type Gesture = {
    pointer: number; x: number; y: number; box: ContentBox;
    session: ReturnType<typeof controller.session.getSnapshot>;
    frame: ReturnType<typeof controller.getSnapshot>;
  };
  let gesture: Gesture | null = null;
  const reset = () => { gesture = null; };
  const report = (cause: unknown) => {
    const error = normalizeRenderEditorError(cause, 'PRESENTATION_REFUSED');
    if (error !== cause) Object.defineProperty(error, 'cause', {value: cause, configurable: true});
    try { options.onError(error); } catch { /* A host notification cannot change selection authority. */ }
  };
  const measure = (): ContentBox => {
    for (let element: Element | null = canvas; element; element = element.parentElement) {
      const style = view.getComputedStyle(element);
      for (const transform of [style.transform, style.rotate, style.scale, style.translate]) {
        if (transform && transform !== 'none') throw new Error('Canvas selection does not support transformed display elements.');
      }
      const zoom = style.getPropertyValue('zoom');
      if (zoom && zoom !== 'normal' && Number(zoom) !== 1) throw new Error('Canvas selection does not support CSS zoom.');
    }
    const style = view.getComputedStyle(canvas), rect = canvas.getBoundingClientRect();
    const number = (text: string, label: string) => {
      const value = Number.parseFloat(text);
      if (!Number.isFinite(value) || value < 0) throw new Error(`Canvas selection requires a finite ${label}.`);
      return value;
    };
    const left = number(style.borderLeftWidth, 'left border') + number(style.paddingLeft, 'left padding');
    const right = number(style.borderRightWidth, 'right border') + number(style.paddingRight, 'right padding');
    const top = number(style.borderTopWidth, 'top border') + number(style.paddingTop, 'top padding');
    const bottom = number(style.borderBottomWidth, 'bottom border') + number(style.paddingBottom, 'bottom padding');
    let width = number(style.width, 'CSS width'), height = number(style.height, 'CSS height');
    if (style.boxSizing === 'border-box') { width -= left + right; height -= top + bottom; }
    if (width <= 0 || height <= 0 || width > 16384 || height > 16384
      || ![rect.left, rect.top, rect.width, rect.height].every(Number.isFinite)
      || Math.abs(rect.width - width - left - right) > .02 || Math.abs(rect.height - height - top - bottom) > .02
      || !Number.isInteger(canvas.width) || !Number.isInteger(canvas.height) || canvas.width <= 0 || canvas.height <= 0) {
      throw new Error('Canvas selection requires an unchanged, unscaled content rectangle and backing frame.');
    }
    return {left: rect.left + left, top: rect.top + top, width, height,
      outerLeft: rect.left, outerTop: rect.top, outerWidth: rect.width, outerHeight: rect.height,
      backingWidth: canvas.width, backingHeight: canvas.height};
  };
  const allowed = () => {
    const frame = controller.getSnapshot(), state = controller.session.getSnapshot();
    return !disposed && options.canSelect() && !frame.disposed && !state.disposed
      && frame.presentedRevision !== null && frame.presentedRevision === state.accepted.revision
      && !frame.cameraPreview && !frame.transformPreview && !frame.animationPreview;
  };
  const current = (candidate: Gesture) => allowed()
    && controller.session.getSnapshot() === candidate.session && controller.getSnapshot() === candidate.frame
    && sameBox(measure(), candidate.box);
  const inside = (box: ContentBox, x: number, y: number) => x >= box.left && y >= box.top
    && x < box.left + box.width && y < box.top + box.height;
  const down = (event: PointerEvent) => {
    reset();
    if (event.target !== canvas || !unmodified(event)) return;
    try {
      if (!allowed()) return;
      const box = measure(); if (!inside(box, event.clientX, event.clientY)) return;
      // Installed after camera down: focus/field blur has already published any raw draft change.
      gesture = {pointer: event.pointerId, x: event.clientX, y: event.clientY, box,
        session: controller.session.getSnapshot(), frame: controller.getSnapshot()};
    } catch (cause) { reset(); report(cause); }
  };
  const move = (event: PointerEvent) => {
    const candidate = gesture;
    if (!candidate || event.pointerId !== candidate.pointer) return;
    try {
      if (!current(candidate) || !event.isPrimary || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey
        || Math.hypot(event.clientX - candidate.x, event.clientY - candidate.y) > 3) {
        reset(); return;
      }
      // Camera has its original down point; the first excursion above3 reaches it with the complete delta.
      event.preventDefault(); event.stopImmediatePropagation();
    } catch (cause) { reset(); report(cause); }
  };
  const up = (event: PointerEvent) => {
    const candidate = gesture;
    if (!candidate || event.pointerId !== candidate.pointer) return;
    reset();
    try {
      if (!unmodified(event) || Math.hypot(event.clientX - candidate.x, event.clientY - candidate.y) > 3
        || !current(candidate)) return;
      event.preventDefault(); event.stopImmediatePropagation();
      options.onClick?.();
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      if (!current(candidate) || !inside(candidate.box, event.clientX, event.clientY)) return;
      const accepted = candidate.session.accepted, camera = candidate.frame.viewportCamera ?? accepted.camera;
      const result = presenter.pickObject({xCss: event.clientX - candidate.box.left, yCss: event.clientY - candidate.box.top}, accepted, camera);
      if (!current(candidate)) return;
      let objectId: string | null = null;
      if (result !== null) {
        if (!result || typeof result !== 'object' || Object.getPrototypeOf(result) !== Object.prototype) throw new Error('Canvas selection returned an unsupported identity.');
        const keys = ['sceneName', 'sourceVersion', 'objectId', 'approximate'], actual = Reflect.ownKeys(result);
        if (actual.length !== keys.length || actual.some(key => typeof key !== 'string' || !keys.includes(key))) throw new Error('Canvas selection returned an incomplete identity.');
        const data: Record<string, unknown> = {};
        for (const key of keys) {
          const descriptor = Object.getOwnPropertyDescriptor(result, key);
          if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) throw new Error('Canvas selection requires own identity data.');
          data[key] = descriptor.value;
        }
        if (data.sourceVersion !== accepted.sourceVersion || data.sourceVersion !== 1 || data.sceneName !== candidate.session.metadata.name
          || data.approximate !== true || typeof data.objectId !== 'string'
          || !candidate.session.metadata.objects.some(object => object.id === data.objectId)) throw new Error('Canvas selection does not match the original applied scene.');
        objectId = data.objectId;
      }
      if (!current(candidate)) return;
      if (candidate.session.activeObjectId !== objectId) controller.session.setActiveObject(objectId);
      options.onSelection(objectId);
    } catch (cause) { report(cause); }
  };
  const cancelPointer = (event: PointerEvent) => { if (gesture?.pointer === event.pointerId) reset(); };
  const key = (event: KeyboardEvent) => {
    if (event.key === 'Escape') { reset(); return; }
    if (event.target === canvas && !event.isComposing && !event.ctrlKey && !event.metaKey && !event.altKey
      && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', '_'].includes(event.key)) reset();
  };
  const stopSession = controller.session.subscribe(reset), stopController = controller.subscribe(reset);
  const Resize = (view as Window & {ResizeObserver?: typeof ResizeObserver}).ResizeObserver;
  const observer = Resize ? new Resize(reset) : null; observer?.observe(canvas);
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move, true);
  canvas.addEventListener('pointerup', up, true);
  canvas.addEventListener('pointercancel', cancelPointer, true);
  canvas.addEventListener('lostpointercapture', cancelPointer, true);
  canvas.addEventListener('wheel', reset, {capture: true, passive: true});
  canvas.addEventListener('blur', reset);
  canvas.addEventListener('webglcontextlost', reset);
  view.addEventListener('blur', reset);
  view.addEventListener('resize', reset);
  view.addEventListener('keydown', key, true);
  return {reset, dispose() {
    if (disposed) return;
    disposed = true; reset(); observer?.disconnect(); stopSession(); stopController();
    canvas.removeEventListener('pointerdown', down);
    canvas.removeEventListener('pointermove', move, true);
    canvas.removeEventListener('pointerup', up, true);
    canvas.removeEventListener('pointercancel', cancelPointer, true);
    canvas.removeEventListener('lostpointercapture', cancelPointer, true);
    canvas.removeEventListener('wheel', reset, true);
    canvas.removeEventListener('blur', reset);
    canvas.removeEventListener('webglcontextlost', reset);
    view.removeEventListener('blur', reset); view.removeEventListener('resize', reset); view.removeEventListener('keydown', key, true);
  }};
}
