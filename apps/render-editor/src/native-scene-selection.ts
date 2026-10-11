import {RenderEditorError, normalizeRenderEditorError} from '@barocss/render-editor';
import type {ViewerState, ViewerGeometryPick, ViewerGeometryPoint} from '@barocss/viewer';
import type {NativeSceneHost, NativeSceneHostSnapshot} from './native-scene-host';

export interface NativeSceneSelectionBridge {
  getState(): ViewerState;
  getEpoch(): number;
  getAppearanceToken(): object;
  pickNativeSurface(point: ViewerGeometryPoint): ViewerGeometryPick | null;
  beginTransition(): void;
  endTransition(): void;
}
export interface NativeSceneSelectionOptions {
  canSelect(): boolean;
  onTarget(bodyId: string): void;
  onStatus(text: string): void;
  onError(cause: unknown): void;
}
const PINS = ['documentId', 'documentRevision', 'nativeFrame', 'bodyId', 'assetId', 'assetRevision',
  'sourceFrame', 'modelId', 'geometryKind', 'geometryId'] as const;
function check(value: unknown, message: string): asserts value {
  if (!value) throw new RenderEditorError('DOCUMENT_INPUT', message);
}
function record(input: unknown, label: string, maximum = 64): Record<string, unknown> {
  check(input !== null && typeof input === 'object' && !Array.isArray(input)
    && [Object.prototype, null].includes(Object.getPrototypeOf(input)), label + ' requires ordinary own data.');
  const keys = Reflect.ownKeys(input);
  check(keys.length <= maximum, label + ' exceeds its field limit.');
  return Object.fromEntries(keys.map(key => {
    check(typeof key === 'string' && key.length <= 512 && new TextEncoder().encode(key).length <= 512, label + ' has an unsupported key.');
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    check(descriptor && 'value' in descriptor && descriptor.enumerable, label + ' refuses hidden fields and accessors.');
    return [key, descriptor.value];
  }));
}
function list(input: unknown, maximum: number, label: string): unknown[] {
  check(Array.isArray(input) && Object.getPrototypeOf(input) === Array.prototype, label + ' requires an ordinary array.');
  const length = Object.getOwnPropertyDescriptor(input, 'length');
  check(length && 'value' in length && Number.isInteger(length.value) && length.value >= 0 && length.value <= maximum, label + ' exceeds its count limit.');
  const keys = Reflect.ownKeys(input);
  check(keys.length === length.value + 1 && keys.every(key => key === 'length' || typeof key === 'string'
    && /^(0|[1-9]\d*)$/.test(key) && Number(key) < length.value), label + ' must be dense without extra fields.');
  return Array.from({length: length.value}, (_, index) => {
    const descriptor = Object.getOwnPropertyDescriptor(input, String(index));
    check(descriptor && 'value' in descriptor && descriptor.enumerable, label + ' refuses array accessors.');
    return descriptor.value;
  });
}
function text(input: unknown, label: string): string {
  check(typeof input === 'string' && input.length > 0 && input.length <= 512
    && new TextEncoder().encode(input).length <= 512, label + ' requires a bounded original string.');
  return input;
}
function pins(input: unknown): Record<string, unknown> {
  const data = record(input, 'Native body binding', 10), keys = Object.keys(data);
  check(keys.length === 10 && keys.every(key => PINS.includes(key as typeof PINS[number])), 'Native body binding requires all ten original pins.');
  for (const key of PINS) {
    if (key === 'documentRevision' || key === 'assetRevision') check(typeof data[key] === 'number'
      && Number.isInteger(data[key]) && (data[key] as number) >= 0 && (data[key] as number) <= 2147483647, 'Native binding revision is invalid.');
    else text(data[key], 'Native binding ' + key);
  }
  check(data.nativeFrame === 'authored-xyz-no-axis-conversion' && data.sourceFrame === data.nativeFrame && data.geometryKind === 'surface', 'Native binding must name an original Surface frame.');
  return data;
}
function samePins(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  return PINS.every(key => Object.is(a[key], b[key]));
}
/** Compare bounded original CAD data, never a generated model/packet or getter value. */
function cadCopy(input: unknown): unknown {
  let values = 0; const active = new Set<object>();
  const copy = (value: unknown, depth: number): unknown => {
    check(++values <= 65536 && depth <= 24, 'Original CAD mapping exceeds its value or depth limit.');
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'number') {check(Number.isFinite(value), 'Original CAD mapping requires finite numbers.'); return value;}
    if (typeof value === 'string') {check(value.length <= 2097152 && new TextEncoder().encode(value).length <= 2097152, 'Original CAD mapping string exceeds its byte limit.'); return value;}
    check(typeof value === 'object' && !active.has(value), 'Original CAD mapping refuses cyclic or unsupported values.');
    active.add(value);
    try {
      return Array.isArray(value) ? list(value, 64, 'Original CAD array').map(item => copy(item, depth + 1))
        : Object.fromEntries(Object.entries(record(value, 'Original CAD record', 32)).map(([key, item]) => [key, copy(item, depth + 1)]));
    } finally {active.delete(value);}
  };
  return copy(input, 0);
}
function equal(a: unknown, b: unknown): boolean {
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return Object.is(a, b);
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b)
    && a.length === b.length && a.every((item, index) => equal(item, b[index]));
  const left = Object.keys(a), right = Object.keys(b);
  return left.length === right.length && left.every(key => Object.hasOwn(b, key)
    && equal((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]));
}
function selectable(snapshot: NativeSceneHostSnapshot): boolean {
  return !snapshot.disposed && snapshot.available && !snapshot.nativeDirty && !snapshot.materialDirty
    && !snapshot.invalidLighting && !snapshot.poseGestureActive && snapshot.posePreview === null;
}

/** Resolve a qualified display ref to one current original body without highlighting or authoring. */
export function resolveNativeSceneBodyPick(snapshot: NativeSceneHostSnapshot, state: ViewerState,
  hit: ViewerGeometryPick | null): string | null {
  try {
    if (hit === null) return null;
    const picked = record(hit, 'Native Surface pick');
    if (picked.kind !== 'surface' || picked.ambiguous === true) return null;
    const fields = ['kind', 'ref', 'triangleIndex', 'distanceScene', 'positionScene', 'parameterUV', 'approximate', 'ambiguous'];
    check(Object.keys(picked).length === fields.length && Object.keys(picked).every(key => fields.includes(key)), 'The Surface pick has unsupported fields.');
    check(picked.approximate === true && picked.ambiguous === false, 'The Surface pick identity is unsupported.');
    check(typeof picked.triangleIndex === 'number' && Number.isInteger(picked.triangleIndex) && picked.triangleIndex >= 0
      && typeof picked.distanceScene === 'number' && Number.isFinite(picked.distanceScene) && picked.distanceScene >= 0, 'The Surface pick distance or triangle is invalid.');
    for (const [key, length] of [['positionScene', 3], ['parameterUV', 2]] as const) {
      const vector = list(picked[key], length, 'Picked Surface ' + key);
      check(vector.length === length && vector.every(value => typeof value === 'number' && Number.isFinite(value)), 'The Surface pick contains invalid coordinates.');
    }
    const ref = record(picked.ref, 'Picked Surface ref', 2);
    const modelId = text(ref.modelId, 'Display model ID'), surfaceId = text(ref.surfaceId, 'Original Surface ID');
    const current = record(snapshot, 'Native host snapshot'), viewer = record(state, 'Viewer state');
    check(current.disposed === false && current.available === true && current.nativeDirty === false
      && current.materialDirty === false && current.invalidLighting === false && current.poseGestureActive === false
      && current.posePreview === null && viewer.status === 'ready', 'Resolve authored drafts or the current operation before selecting a body.');
    const accepted = record(current.accepted, 'Accepted native scene', 10), preparation = record(current.preparation, 'Native preparation');
    check(preparation.document === current.accepted, 'The native preparation is not the accepted scene.');
    const document = record(viewer.document, 'Displayed native document');
    check(equal(cadCopy(document.document), cadCopy(accepted.nativeDocument)), 'The displayed original CAD document does not match the current scene.');
    const entries = list(preparation.entries, 4, 'Qualified native entries').map(value => record(value, 'Qualified native entry'));
    const matching = entries.filter(entry => {
      if (entry.kind !== 'surface') return false;
      const qualified = record(entry.ref, 'Qualified Surface ref', 2);
      return qualified.modelId === modelId && qualified.geometryId === surfaceId;
    });
    check(matching.length === 1, 'The picked Surface does not identify one current original body.');
    const binding = pins(matching[0]!.binding), bodyId = text(binding.bodyId, 'Original body ID');
    const bodies = list(viewer.documentBodies, 4, 'Displayed native body bindings').map(value => record(value, 'Displayed native body'));
    const displayed = bodies.filter(body => {
      const qualified = record(body.ref, 'Displayed geometry ref', 3);
      return qualified.kind === 'surface' && qualified.modelId === modelId && qualified.surfaceId === surfaceId;
    });
    check(displayed.length === 1 && samePins(binding, pins(displayed[0]!.binding)), 'The displayed body does not match all ten original pins.');
    const display = record(accepted.display, 'Native display');
    check(list(display.visibleBodyIds, 4, 'Visible original bodies').includes(bodyId)
      && list(viewer.visibleGeometry, 4, 'Displayed visible geometry').some(value => {
        const visible = record(value, 'Visible geometry ref', 3);
        return visible.kind === 'surface' && visible.modelId === modelId && visible.surfaceId === surfaceId;
      }), 'The picked original body is not visible.');
    const materials = list(preparation.materials, 4, 'Qualified Surface materials').map(value => record(value, 'Qualified Surface material'));
    const bound = materials.filter(material => {
      const target = record(material.target, 'Original Surface material target', 7), qualified = record(material.ref, 'Material display ref', 2);
      return target.bodyId === bodyId && qualified.modelId === modelId && qualified.surfaceId === surfaceId
        && ['documentId', 'documentRevision', 'bodyId', 'assetId', 'assetRevision', 'modelId', 'geometryId'].every(key => Object.is(target[key], binding[key]));
    });
    check(bound.length === 1, 'The picked body has no unique current Surface material.');
    return bodyId;
  } catch (cause) {
    const error = normalizeRenderEditorError(cause);
    if (error !== cause) Object.defineProperty(error, 'cause', {value: cause, configurable: true});
    throw error;
  }
}

interface Box {left: number; top: number; width: number; height: number; backingWidth: number; backingHeight: number}
const sameBox = (a: Box, b: Box) => (Object.keys(a) as Array<keyof Box>).every(key => a[key] === b[key]);
function camera(state: ViewerState): unknown {
  const value = record(record(state, 'Viewer state').camera, 'Displayed camera', 6);
  return Object.fromEntries(['eye', 'target', 'up', 'fovYDegrees', 'near', 'far'].map(key => {
    const field = value[key];
    const result = ['eye', 'target', 'up'].includes(key) ? list(field, 3, 'Displayed camera vector') : field;
    check(Array.isArray(result) ? result.length === 3 && result.every(item => typeof item === 'number' && Number.isFinite(item))
      : typeof result === 'number' && Number.isFinite(result), 'Displayed camera requires finite values.');
    return [key, result];
  }));
}

/** Canvas clicks share camera capture; this adapter never creates a second pointer capture. */
export function createNativeSceneSelectionInput(canvas: HTMLCanvasElement, host: NativeSceneHost,
  bridge: NativeSceneSelectionBridge, options: NativeSceneSelectionOptions): {reset(): void; dispose(): void} {
  const view = canvas.ownerDocument.defaultView;
  check(view, 'Native selection requires the Canvas document window.');
  let disposed = false;
  type Gesture = {pointer: number; x: number; y: number; box: Box; snapshot: NativeSceneHostSnapshot; camera: unknown; epoch: number; owner: object};
  let gesture: Gesture | null = null;
  const reset = () => {gesture = null;};
  const status = (message: string) => {try {options.onStatus(message);} catch { /* Notifications cannot change pick admission. */ }};
  const report = (cause: unknown) => {const error = normalizeRenderEditorError(cause, 'PRESENTATION_REFUSED');
    if (error !== cause) Object.defineProperty(error, 'cause', {value: cause, configurable: true});
    status('Selection was refused. Use the body list or click a clear Surface area.');
    try {options.onError(error);} catch { /* Keep the current editing target. */ }
  };
  const measure = (): Box => {
    let ancestors = 0;
    for (let element: Element | null = canvas; element; element = element.parentElement) {
      check(++ancestors <= 64, 'Canvas selection exceeds its ancestor limit.');
      const style = view.getComputedStyle(element);
      for (const transform of [style.transform, style.rotate, style.scale, style.translate, style.perspective]) check(!transform || transform === 'none', 'Canvas selection does not support transformed or perspective CSS.');
      const zoom = style.getPropertyValue('zoom'); check(!zoom || zoom === 'normal' || Number(zoom) === 1, 'Canvas selection does not support CSS zoom.');
    }
    const style = view.getComputedStyle(canvas);
    for (const edge of [style.borderLeftWidth, style.borderRightWidth, style.borderTopWidth, style.borderBottomWidth,
      style.paddingLeft, style.paddingRight, style.paddingTop, style.paddingBottom]) check(Number.parseFloat(edge) === 0, 'Canvas selection requires zero border and padding.');
    const rect = canvas.getBoundingClientRect(), width = canvas.width, height = canvas.height;
    check([rect.left, rect.top, rect.width, rect.height].every(Number.isFinite) && rect.width > 0 && rect.height > 0
      && rect.width <= 4096 && rect.height <= 4096 && Number.isInteger(width) && Number.isInteger(height)
      && width > 0 && height > 0 && width <= 4096 && height <= 4096 && width * height <= 4194304, 'Canvas selection requires bounded CSS and backing dimensions.');
    return {left: rect.left, top: rect.top, width: rect.width, height: rect.height, backingWidth: width, backingHeight: height};
  };
  const allowed = () => !disposed && options.canSelect() && selectable(host.getSnapshot()) && bridge.getState().status === 'ready';
  const current = (candidate: Gesture) => allowed() && host.getSnapshot() === candidate.snapshot
    && host.getSnapshot().accepted === candidate.snapshot.accepted && host.getSnapshot().preparation === candidate.snapshot.preparation
    && bridge.getEpoch() === candidate.epoch && bridge.getAppearanceToken() === candidate.owner
    && sameBox(measure(), candidate.box) && equal(camera(bridge.getState()), candidate.camera);
  const unmodified = (event: PointerEvent) => event.isPrimary && event.button === 0 && !event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey;
  const inside = (box: Box, x: number, y: number) => Number.isFinite(x) && Number.isFinite(y)
    && x >= box.left && y >= box.top && x < box.left + box.width && y < box.top + box.height;
  const down = (event: PointerEvent) => {
    reset(); if (event.target !== canvas || !unmodified(event)) return;
    try {if (!allowed()) return; const box = measure(); if (!inside(box, event.clientX, event.clientY)) return;
      gesture = {pointer: event.pointerId, x: event.clientX, y: event.clientY, box, snapshot: host.getSnapshot(),
        camera: camera(bridge.getState()), epoch: bridge.getEpoch(), owner: bridge.getAppearanceToken()};
    } catch (cause) {report(cause);}
  };
  const move = (event: PointerEvent) => {
    const candidate = gesture; if (!candidate || event.pointerId !== candidate.pointer) return;
    try {if (!event.isPrimary || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey
      || Math.hypot(event.clientX - candidate.x, event.clientY - candidate.y) > 3 || !current(candidate)) {reset(); return;}
      event.preventDefault(); event.stopImmediatePropagation();
    } catch (cause) {reset(); report(cause);}
  };
  const up = (event: PointerEvent) => {
    const candidate = gesture; if (!candidate || event.pointerId !== candidate.pointer) return;
    reset(); let transition = false;
    try {
      if (!unmodified(event) || Math.hypot(event.clientX - candidate.x, event.clientY - candidate.y) > 3 || !current(candidate)) return;
      event.preventDefault(); event.stopImmediatePropagation();
      bridge.beginTransition(); transition = true;
      if (!current(candidate) || !inside(candidate.box, event.clientX, event.clientY)) return;
      const before = bridge.getState(), hit = bridge.pickNativeSurface({xCss: event.clientX - candidate.box.left, yCss: event.clientY - candidate.box.top});
      if (!current(candidate)) return;
      const bodyId = resolveNativeSceneBodyPick(candidate.snapshot, before, hit);
      if (!current(candidate)) return;
      if (bodyId === null) {status('Selection kept. Click a clear Surface area or use the body list.'); return;}
      if (bodyId === candidate.snapshot.selectedBodyId) return;
      options.onTarget(bodyId);
      status(host.getSnapshot().selectedBodyId === bodyId ? 'Active body changed.' : 'Selection kept.');
    } catch (cause) {report(cause);}
    finally {if (transition) {try {bridge.endTransition();} catch (cause) {report(cause);}}}
  };
  const cancel = (event: PointerEvent) => {if (gesture?.pointer === event.pointerId) reset();};
  const key = (event: KeyboardEvent) => {if (event.key === 'Escape' || !event.isComposing
    && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', '_', 'f', 'F'].includes(event.key)) reset();};
  const unsubscribe = host.subscribe(reset);
  const Resize = (view as Window & {ResizeObserver?: typeof ResizeObserver}).ResizeObserver;
  const observer = Resize ? new Resize(reset) : null; observer?.observe(canvas);
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move, true); canvas.addEventListener('pointerup', up, true);
  canvas.addEventListener('pointercancel', cancel, true); canvas.addEventListener('lostpointercapture', cancel, true);
  canvas.addEventListener('wheel', reset, {capture: true, passive: true}); canvas.addEventListener('blur', reset); canvas.addEventListener('webglcontextlost', reset);
  view.addEventListener('blur', reset); view.addEventListener('resize', reset); view.addEventListener('keydown', key, true);
  return {reset, dispose() {if (disposed) return; disposed = true; reset(); observer?.disconnect(); unsubscribe();
    canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move, true); canvas.removeEventListener('pointerup', up, true);
    canvas.removeEventListener('pointercancel', cancel, true); canvas.removeEventListener('lostpointercapture', cancel, true);
    canvas.removeEventListener('wheel', reset, true); canvas.removeEventListener('blur', reset); canvas.removeEventListener('webglcontextlost', reset);
    view.removeEventListener('blur', reset); view.removeEventListener('resize', reset); view.removeEventListener('keydown', key, true);
  }};
}
