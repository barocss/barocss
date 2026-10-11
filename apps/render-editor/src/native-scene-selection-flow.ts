import {prepareRenderNativeSceneAppearance, serializeRenderNativeSceneDocument, parseRenderNativeSceneDocument,
  prepareRenderNativeSceneGizmo, deriveRenderNativeSceneGizmoPose} from '@barocss/render-editor';
import type {RenderNativeSceneDocument, RenderNativeSceneAppearancePreparation} from '@barocss/render-editor';
import type {ViewerState, ViewerGeometryPick} from '@barocss/viewer';
import type {MeshCamera} from '@barocss/gpu';
import {createNativeSceneHost} from './native-scene-host';
import {createNativeSceneBase, createNativeSceneSeed} from './native-scene-seed';
import {resolveNativeSceneBodyPick, createNativeSceneSelectionInput} from './native-scene-selection';
import type {NativeSceneSelectionBridge} from './native-scene-selection';
import {prepareNativeViewportAppearance} from './native-viewport-presentation';

/** A private launcher owns five-package maps, first failures, actual files and fresh emitted processes. */
export interface NativeSceneSelectionFlowResult {
  readonly scope: string;
  readonly checks: readonly string[];
  readonly browserGlobalReads: readonly string[];
  readonly firstFileText?: string;
  readonly secondFileText?: string;
  readonly firstRevision?: number;
  readonly secondRevision?: number;
  readonly protocolEvents?: readonly string[];
}
const A = 'body_preview_a', B = 'body_preview_b';
const scope = 'Real SDK Native seed/preparation/TEN and private host/input protocol. EventTarget/canvas/Viewer-hit models are explicit CPU evidence, never Viewer.pickGeometry/backend/GL/browser pixels. Authored files contain no cached IR.';
const material = {format: 'barocss-render-editor-material' as const, version: 0 as const, profile: 'mesh-opaque-fragment-v0' as const,
  documentId: 'blend-study', title: 'Blend study', revision: 0,
  shaderSource: '// Original blend study. Red and blue are authored colors.\r\n@shader #blend_study {\r\n  @uniform amount: float(0, 1, .25);\r\n  @fragment { color: mix(#ff0000, #0000ff, amount); }\r\n}\r\n', uniforms: {amount: .25}};
const camera: MeshCamera = {eye: [2, 1.45, 2], target: [0, -.55, 0], up: [0, 1, 0], fovYDegrees: 45, near: .01, far: 100};
const lighting = {ambientStrength: .4, directionalStrength: .6, direction: [.3, 1, .4] as [number, number, number]};
function check(value: unknown, message: string): asserts value {if (!value) throw new Error(message);}
function clone<T>(value: T): T {return structuredClone(value);}
function equal(actual: unknown, expected: unknown, label = 'value'): void {
  if (Object.is(actual, expected)) return;
  check(actual !== null && expected !== null && typeof actual === 'object' && typeof expected === 'object', label + ' differs.');
  const keys = Object.keys(actual), other = Object.keys(expected);
  check(keys.length === other.length && keys.every(key => other.includes(key)), label + ' fields differ.');
  for (const key of keys) equal((actual as Record<string, unknown>)[key], (expected as Record<string, unknown>)[key], label + '.' + key);
}
function refuses(operation: () => unknown): unknown {try {operation();} catch (error) {return error;} throw new Error('Expected refusal.');}
function guarded<T>(reads: string[], operation: () => T): T {
  const saved = new Map<string, PropertyDescriptor | undefined>();
  try {
    for (const key of ['window', 'document', 'HTMLCanvasElement', 'WebGL2RenderingContext', 'requestAnimationFrame']) {
      saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
      Object.defineProperty(globalThis, key, {configurable: true, get() {reads.push(key); throw new Error('CPU flow read real browser global ' + key);}});
    }
    return operation();
  } finally {for (const [key, descriptor] of saved) {if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);}}
}
function seed(source: string, identity?: {documentId: string; title: string}): RenderNativeSceneDocument {
  check(source.length === 322 && source.includes('cloth_reference_981') && source.includes('reference_panel'), 'Supply genuine unchanged 322-byte CAD reference; launcher verifies original SHA.');
  return createNativeSceneSeed(createNativeSceneBase(source, clone(material), clone(camera), clone(lighting), identity));
}
function viewerModel(preparation: RenderNativeSceneAppearancePreparation, cameraOverride?: MeshCamera): ViewerState {
  const actual = preparation.authored, display = preparation.viewer.display;
  const request = prepareNativeViewportAppearance(preparation, cameraOverride);
  const entries = actual.entries;
  check(entries.length === 2 && entries.every(entry => entry.kind === 'surface'), 'Real seed must retain two Surface bodies.');
  return {
    status: 'ready', frame: 'right-handed-y-up', sourceUnit: 'mm', mmToSceneUnit: actual.document.display.mmToSceneUnit,
    camera: clone(request.display.camera), lighting: clone(actual.document.display.lighting),
    surfaces: entries.map(entry => ({modelId: entry.ref.modelId, surfaceId: entry.ref.geometryId})), curves: [],
    visibleGeometry: clone(display.visibleGeometry), curveSampleVersion: null,
    uniformCurve: null, selectedUniformCurve: null, mixedDepth: null, qualifiedFaceScene: null,
    packets: entries.map(entry => {check(entry.kind === 'surface', 'Surface packet required.'); return {modelId: entry.ref.modelId, packet: clone(entry.packet)};}),
    selected: null, selectedGeometry: null, native: null, modelSet: null, document: clone(actual.native),
    documentBodies: entries.map(entry => ({ref: {kind: 'surface', modelId: entry.ref.modelId, surfaceId: entry.ref.geometryId}, binding: clone(entry.binding)})),
    assembly: null, assemblyInstances: [], shell: null, measurement: null, motion: null, geometryMotion: clone(display.motion),
    curveMeasurement: null, surfaceCurveMeasurement: null, nativeMeasurement: null, fluidFrame: null, clothFrame: null,
    surfaceMaterial: null, surfaceMaterials: preparation.viewer.prepared.frame.materials.map(item => ({ref: {modelId: item.ref.modelId, surfaceId: item.ref.geometryId}, binding: clone(item.binding)})),
  };
}
function hit(state: ViewerState, bodyId: string): ViewerGeometryPick {
  const entry = state.documentBodies.find(item => item.binding.bodyId === bodyId); check(entry?.ref.kind === 'surface', 'Original modeled Surface body missing.');
  return {kind: 'surface', ref: {modelId: entry.ref.modelId, surfaceId: entry.ref.surfaceId}, triangleIndex: 0,
    distanceScene: 4, positionScene: [bodyId === A ? -.9 : .9, -.55, 0], parameterUV: [2.5, 15], approximate: true, ambiguous: false};
}
function authorship(document: RenderNativeSceneDocument, original: RenderNativeSceneDocument): void {
  for (const key of ['format', 'version', 'profile', 'documentId', 'title', 'nativeDocument', 'nativeOptions'] as const) equal(document[key], original[key], key);
  for (const key of ['mmToSceneUnit', 'background', 'camera', 'lighting', 'basis', 'visibleBodyIds'] as const) equal(document.display[key], original.display[key], 'display.' + key);
  equal(document.display.poses.find(item => item.bodyId === A), original.display.poses.find(item => item.bodyId === A), 'A pose');
  equal(document.surfaceMaterials.find(item => item.target.bodyId === A), original.surfaceMaterials.find(item => item.target.bodyId === A), 'A material');
  const currentB = document.surfaceMaterials.find(item => item.target.bodyId === B), originalB = original.surfaceMaterials.find(item => item.target.bodyId === B);
  check(currentB && originalB, 'Original B material missing.'); equal(currentB.target, originalB.target, 'B TEN target');
  for (const key of ['format', 'version', 'profile', 'documentId', 'title', 'shaderSource'] as const) equal(currentB.material[key], originalB.material[key], 'B material.' + key);
  const text = serializeRenderNativeSceneDocument(document); check(text.includes('-0'), 'Original authored signed zero lost.');
  const keys = Object.keys(document); check(keys.length === 10 && !keys.some(key => ['viewer', 'request', 'context', 'compiled', 'sample', 'cache'].includes(key)), 'Runtime data appeared in file authority.');
  const prepared = prepareRenderNativeSceneAppearance(document); check(prepared.authored.entries.length === 2 && prepared.viewer.prepared.primitives.length === 2, 'Reopened real frame lost a body.');
}

interface ModelEvent extends Record<string, unknown> {
  type: string; target: unknown; currentTarget: unknown; defaultPrevented: boolean; stopped: boolean; immediate: boolean;
  preventDefault(): void; stopPropagation(): void; stopImmediatePropagation(): void;
}
type Listener = EventListenerOrEventListenerObject;
class Target {
  private listeners = new Map<string, {listener: Listener; capture: boolean}[]>();
  addEventListener(type: string, listener: Listener, options?: boolean | AddEventListenerOptions): void {
    const capture = typeof options === 'boolean' ? options : !!options?.capture;
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), {listener, capture}]);
  }
  removeEventListener(type: string, listener: Listener, options?: boolean | EventListenerOptions): void {
    const capture = typeof options === 'boolean' ? options : !!options?.capture;
    this.listeners.set(type, (this.listeners.get(type) ?? []).filter(row => row.listener !== listener || row.capture !== capture));
  }
  phase(event: ModelEvent, capture: boolean): void {
    event.currentTarget = this;
    for (const row of [...(this.listeners.get(event.type) ?? [])].filter(item => item.capture === capture)) {
      if (event.immediate) break;
      if (typeof row.listener === 'function') row.listener(event as unknown as Event); else row.listener.handleEvent(event as unknown as Event);
    }
  }
}
function event(type: string, target: unknown, data: Record<string, unknown> = {}): ModelEvent {
  return {type, target, currentTarget: target, defaultPrevented: false, stopped: false, immediate: false, ...data,
    preventDefault() {this.defaultPrevented = true;}, stopPropagation() {this.stopped = true;}, stopImmediatePropagation() {this.stopped = true; this.immediate = true;}};
}
function harness(document: RenderNativeSceneDocument) {
  const host = createNativeSceneHost(document), view = new Target(), canvas = new Target();
  const model = {state: viewerModel(prepareRenderNativeSceneAppearance(host.getSnapshot().accepted)), epoch: 0, owner: {} as object,
    calls: 0, transitions: 0, presented: 0, enabled: true, result: null as ViewerGeometryPick | null,
    errors: [] as unknown[], statuses: [] as string[], targets: [] as string[], events: [] as string[], queries: [] as {xCss: number; yCss: number}[],
    duringPick: null as (() => void) | null, cameraDeltas: [] as number[], capture: new Set<number>()};
  const style = {width: '900px', height: '600px', boxSizing: 'content-box', borderLeftWidth: '0px', borderRightWidth: '0px', borderTopWidth: '0px', borderBottomWidth: '0px',
    paddingLeft: '0px', paddingRight: '0px', paddingTop: '0px', paddingBottom: '0px', transform: 'none', perspective: 'none', rotate: 'none', translate: 'none', scale: 'none', zoom: '1', display: 'block', visibility: 'visible',
    getPropertyValue(name: string): string {return (this as unknown as Record<string, string>)[name.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())] ?? '';}};
  const rect = {left: 10, top: 20, width: 900, height: 600, right: 910, bottom: 620, x: 10, y: 20};
  class Observer {constructor(private callback: () => void) {} observe(): void {} disconnect(): void {} fire(): void {this.callback();}}
  Object.assign(view, {getComputedStyle: () => style, ResizeObserver: Observer, devicePixelRatio: 2, visualViewport: {scale: 1}});
  const dispatch = (type: string, data: Record<string, unknown> = {}) => {
    const input = event(type, canvas, data); view.phase(input, true); if (!input.stopped) canvas.phase(input, true);
    if (!input.stopped) canvas.phase(input, false); if (!input.stopped) view.phase(input, false); return input;
  };
  Object.assign(canvas, {width: 1800, height: 1200, clientWidth: 900, clientHeight: 600, isConnected: true, parentElement: null,
    ownerDocument: {defaultView: view, hidden: false}, getBoundingClientRect: () => ({...rect}), focus() {},
    hasPointerCapture: (id: number) => model.capture.has(id), setPointerCapture: (id: number) => {model.capture.add(id); model.events.push('capture');},
    releasePointerCapture: (id: number) => {if (model.capture.delete(id)) {model.events.push('release'); dispatch('lostpointercapture', {pointerId: id});}}});
  const fakeCanvas = canvas as unknown as HTMLCanvasElement;
  host.setPresenter((prepared, cameraOverride) => {model.presented++; model.state = viewerModel(prepared, cameraOverride); model.owner = {};}, () => model.owner, () => model.state.camera);
  let downX: number | null = null;
  const navigate = (amount: number) => {const next = clone(model.state.camera); next.eye[0] += amount; model.state.camera = next; host.observeView(next);};
  canvas.addEventListener('pointerdown', ((input: PointerEvent) => {
    if (!input.isPrimary || input.button !== 0) return;
    downX = input.clientX; fakeCanvas.setPointerCapture(input.pointerId); model.events.push('camera-down');
  }) as EventListener);
  canvas.addEventListener('pointermove', ((input: PointerEvent) => {
    if (downX === null || !model.capture.has(input.pointerId)) return;
    const delta = input.clientX - downX; model.cameraDeltas.push(delta); model.events.push('camera-move');
    const next = clone(host.getSnapshot().accepted.display.camera); next.eye[0] += delta / 100; model.state.camera = next; host.observeView(next);
  }) as EventListener);
  canvas.addEventListener('pointerup', ((input: PointerEvent) => {downX = null; fakeCanvas.releasePointerCapture(input.pointerId);}) as EventListener);
  canvas.addEventListener('wheel', (() => navigate(.05)) as EventListener);
  canvas.addEventListener('keydown', ((input: KeyboardEvent) => {if (input.key === 'ArrowRight') navigate(.05);}) as EventListener);
  const bridge: NativeSceneSelectionBridge = {
    getState: () => clone(model.state), getEpoch: () => model.epoch, getAppearanceToken: () => model.owner,
    beginTransition() {model.transitions++; model.events.push('begin'); downX = null; for (const id of [...model.capture]) fakeCanvas.releasePointerCapture(id);},
    endTransition() {model.events.push('end'); model.transitions--;},
    pickNativeSurface(point) {model.events.push('pick'); check(model.capture.size === 0 && model.transitions === 1, 'Query must follow camera release inside a transition.');
      model.calls++; model.queries.push({...point}); model.duringPick?.(); return clone(model.result);},
  };
  const selection = createNativeSceneSelectionInput(fakeCanvas, host, bridge, {canSelect: () => model.enabled,
    onTarget(bodyId) {host.selectTarget(bodyId); model.targets.push(bodyId);}, onStatus: text => model.statuses.push(text), onError: cause => model.errors.push(cause)});
  const pointer = (type: string, extra: Record<string, unknown> = {}) => dispatch(type, {pointerId: 1, pointerType: 'mouse', isPrimary: true, button: type === 'pointermove' ? -1 : 0,
    buttons: type === 'pointerup' ? 0 : 1, clientX: 160, clientY: 180, shiftKey: false, altKey: false, ctrlKey: false, metaKey: false, ...extra});
  const click = (extra: Record<string, unknown> = {}) => {pointer('pointerdown', extra); pointer('pointerup', extra);};
  return {host, model, bridge, selection, canvas, view, style, rect, dispatch, pointer, click,
    close() {selection.dispose(); selection.dispose(); for (const id of [...model.capture]) fakeCanvas.releasePointerCapture(id); host.dispose();}};
}
function retained(host: ReturnType<typeof createNativeSceneHost>, includeRaw = true) {
  const snapshot = host.getSnapshot(), raw = host.materialSession.getSnapshot();
  return {accepted: snapshot.accepted, draftDocument: snapshot.draftDocument, nativeDirty: snapshot.nativeDirty, materialDirty: snapshot.materialDirty,
    invalidLighting: snapshot.invalidLighting, viewCamera: snapshot.viewCamera, viewDirty: snapshot.viewDirty, canUndo: snapshot.canUndo, canRedo: snapshot.canRedo,
    savedRevision: snapshot.savedRevision, disposed: snapshot.disposed,
    ...(includeRaw ? {rawSource: raw.draftSource, rawUniforms: raw.draftUniforms} : {})};
}
function editB(host: ReturnType<typeof createNativeSceneHost>, amount: number): void {
  host.selectTarget(B); const before = host.getSnapshot().accepted, view = {width: 900, height: 600, backingWidth: 1024, backingHeight: 768};
  const oblique: MeshCamera = {eye: [5, 4, 7], target: [0, 0, 0], up: [0, 1, 0], fovYDegrees: 45, near: .01, far: 100};
  const prepared = prepareRenderNativeSceneGizmo(before, B, oblique, view, 'translate', 'world'), handle = prepared.handles.find(item => item.key === 'x'); check(handle, 'Actual B Move X unavailable.');
  const next = deriveRenderNativeSceneGizmoPose(before, B, oblique, view, 'translate', 'world', 'x', handle.anchor, [handle.anchor[0] + 6, handle.anchor[1]]);
  const token = host.beginBodyPosePreview(B); host.previewBodyPose(token, next); check(host.getSnapshot().accepted === before, 'Pose preview changed authority.'); host.applyBodyPosePreview(token);
  check(host.getSnapshot().accepted.revision === before.revision + 1, 'Gizmo finish must commit once.');
  host.materialSession.setDraftUniforms({amount}); host.materialSession.commitPrepared(host.materialSession.prepareDraft());
  check(host.getSnapshot().accepted.revision === before.revision + 2, 'Selected B material Apply must commit once.');
}

export function runNativeSceneSelectionFlow(referenceSource: string): NativeSceneSelectionFlowResult {
  const reads: string[] = [], checks: string[] = [], events: string[] = [];
  return guarded(reads, () => {
    const original = seed(referenceSource), mapping = harness(original), baseline = mapping.host.getSnapshot(), state = mapping.model.state;
    check(state.surfaces[0]!.surfaceId === state.surfaces[1]!.surfaceId && state.surfaces[0]!.modelId !== state.surfaces[1]!.modelId, 'Composite duplicate-original-ID witness missing.');
    check(resolveNativeSceneBodyPick(baseline, state, hit(state, A)) === A && resolveNativeSceneBodyPick(baseline, state, hit(state, B)) === B, 'Qualified composite mapping failed.');
    check(resolveNativeSceneBodyPick(baseline, state, null) === null && resolveNativeSceneBodyPick(baseline, state, {...hit(state, B), ambiguous: true}) === null, 'Background/ambiguous must retain target.');
    const pinKeys = ['documentId', 'documentRevision', 'nativeFrame', 'bodyId', 'assetId', 'assetRevision', 'sourceFrame', 'modelId', 'geometryKind', 'geometryId'];
    for (const field of pinKeys) {const bad = clone(state), pin = bad.documentBodies[1]!.binding as unknown as Record<string, unknown>; pin[field] = typeof pin[field] === 'number' ? Number(pin[field]) + 1 : 'foreign_' + String(pin[field]); refuses(() => resolveNativeSceneBodyPick(baseline, bad, hit(state, B)));}
    const foreign = hit(state, B); check(foreign.kind === 'surface', 'Surface fixture required.'); foreign.ref.modelId = 'foreign'; refuses(() => resolveNativeSceneBodyPick(baseline, state, foreign));
    const stale = clone(state); check(stale.document, 'Real compiled Native document missing.');
    const wrongRevision = stale.document.document as unknown as {revision: number}; wrongRevision.revision++;
    refuses(() => resolveNativeSceneBodyPick(baseline, stale, hit(state, B)));
    let getters = 0; const malformed = {...hit(state, B)}; Object.defineProperty(malformed, 'ref', {enumerable: true, get() {getters++; throw new Error('Accessor');}});
    refuses(() => resolveNativeSceneBodyPick(baseline, state, malformed)); check(getters === 0, 'Pick result getter executed.');
    mapping.close(); checks.push('Actual public seed/appearance/TEN: composite duplicate Surface IDs, original body mapping, null/ambiguous, all TEN-field foreign/stale refusals and getter0. No Viewer query execution.');

    const primary = harness(original); primary.model.result = hit(primary.model.state, B); const before = retained(primary.host, false), presented = primary.model.presented;
    primary.click(); check(primary.host.getSnapshot().selectedBodyId === B && primary.model.calls === 1, 'Primary click did not route B.');
    equal(primary.model.queries[0], {xCss: 150, yCss: 160}, 'continuous local CSS without DPR multiplication'); equal(retained(primary.host, false), before, 'selection authoring');
    check(primary.model.events.indexOf('release') < primary.model.events.indexOf('pick') && primary.model.presented === presented, 'Camera release/presentation invariant failed.');
    const same = primary.host.getSnapshot(), sameRaw = primary.host.materialSession.getSnapshot(); primary.click();
    check(primary.host.getSnapshot() === same && primary.host.materialSession.getSnapshot() === sameRaw && primary.model.targets.length === 1, 'Same body replaced local store or emitted history.');
    primary.model.result = null; primary.click(); check(primary.host.getSnapshot() === same, 'Background cleared mandatory target.');
    primary.model.result = hit(primary.model.state, A); primary.pointer('pointerdown'); primary.pointer('pointermove', {clientX: 162.9}); primary.pointer('pointerup', {clientX: 162.9});
    check(primary.host.getSnapshot().selectedBodyId === A && primary.model.cameraDeltas.length === 0, 'Subthreshold jitter leaked into camera.');
    check(primary.model.queries.at(-1)?.xCss === 152.9, 'Fractional CSS point was quantized or multiplied by DPR.');
    primary.model.result = hit(primary.model.state, B); primary.pointer('pointerdown'); primary.pointer('pointerup', {clientX: 163});
    check(primary.host.getSnapshot().selectedBodyId === B && primary.model.cameraDeltas.length === 0, 'Exact3 CSS click boundary refused or moved camera.');
    primary.model.result = hit(primary.model.state, A); primary.click();
    const pending = clone(primary.model.state.camera); pending.eye[0] += .1; primary.model.state.camera = pending; primary.host.observeView(pending); const local = retained(primary.host, false);
    primary.model.result = hit(primary.model.state, B); primary.click(); check(primary.host.getSnapshot().selectedBodyId === B, 'Pending view must allow local target.');
    equal(retained(primary.host, false), local, 'selection preserves pending camera/authority'); check(primary.model.presented === presented, 'Selection adopted/presented camera.');
    primary.host.resetViewportCamera();
    const raw = primary.host.materialSession; raw.setDraftUniforms({amount: NaN}); const rawBefore = retained(primary.host), rawCalls = primary.model.calls;
    primary.model.result = hit(primary.model.state, A); primary.click(); check(primary.model.calls === rawCalls, 'Dirty material queried Native pick.');
    refuses(() => primary.host.selectTarget(A)); equal(retained(primary.host), rawBefore); check(Number.isNaN(raw.getSnapshot().draftUniforms.amount), 'Raw NaN was discarded.'); primary.host.discardDraft();
    events.push(...primary.model.events); primary.close(); checks.push('Primary <=3 CSS click releases camera before model query; same-body/no-background no-op; jitter consumed; pending view retained through target switch; raw invalid selection blocked; no authoring/history/presentation mutation.');

    for (const kind of ['excursion-return', 'modifier', 'wrong-pointer', 'cancel', 'lostcapture', 'blur', 'Escape', 'wheel', 'ArrowRight', 'resize', 'backing', 'disable', 'camera', 'epoch', 'owner', 'loss', 'during-disable', 'during-owner', 'query-throw'] as const) {
      const h = harness(original); h.model.result = hit(h.model.state, B); const accepted = h.host.getSnapshot().accepted;
      h.pointer('pointerdown');
      if (kind === 'excursion-return') {h.pointer('pointermove', {clientX: 180}); h.pointer('pointermove', {clientX: 160}); check(h.model.cameraDeltas[0] === 20, 'Camera did not receive full initial excursion.');}
      else if (kind === 'modifier') h.pointer('pointermove', {shiftKey: true});
      else if (kind === 'wrong-pointer') {h.pointer('pointerup', {pointerId: 2}); h.pointer('pointercancel');}
      else if (kind === 'cancel') h.pointer('pointercancel');
      else if (kind === 'lostcapture') h.pointer('lostpointercapture');
      else if (kind === 'blur') h.dispatch('blur');
      else if (kind === 'Escape') h.dispatch('keydown', {key: 'Escape'});
      else if (kind === 'wheel') h.dispatch('wheel', {deltaMode: 0, deltaY: 120, deltaX: 0, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false});
      else if (kind === 'ArrowRight') h.dispatch('keydown', {key: 'ArrowRight', isComposing: false, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false});
      else if (kind === 'resize') h.rect.width = 899;
      else if (kind === 'backing') Object.assign(h.canvas, {width: 1798});
      else if (kind === 'disable') h.model.enabled = false;
      else if (kind === 'camera') h.model.state.camera.eye[0] += .1;
      else if (kind === 'epoch') h.model.epoch++;
      else if (kind === 'owner') h.model.owner = {};
      else if (kind === 'loss') h.model.state.status = 'context-lost';
      else if (kind === 'during-disable') h.model.duringPick = () => {h.model.enabled = false;};
      else if (kind === 'during-owner') h.model.duringPick = () => {h.model.owner = {};};
      else if (kind === 'query-throw') h.model.duringPick = () => {throw new Error('Declared model query refusal');};
      h.pointer('pointerup');
      check(h.model.calls === (kind.startsWith('during-') || kind === 'query-throw' ? 1 : 0) && h.model.targets.length === 0 && h.host.getSnapshot().selectedBodyId === A, kind + ' incorrectly selected.');
      check(h.host.getSnapshot().accepted === accepted && h.model.transitions === 0, kind + ' changed authority or leaked transition.'); h.close();
    }
    const poseCase = harness(original); poseCase.model.result = hit(poseCase.model.state, B); const poseToken = poseCase.host.beginBodyPosePreview(A);
    poseCase.click(); check(poseCase.model.calls === 0, 'Body gesture queried selection.'); poseCase.host.cancelBodyPosePreview(poseToken); poseCase.close();
    for (const kind of ['native-draft', 'light-invalid', 'unavailable'] as const) {
      const h = harness(original); h.model.result = hit(h.model.state, B);
      if (kind === 'native-draft') h.host.stageSceneDocument({...h.host.getSnapshot().accepted, title: 'Retained authored draft'});
      else if (kind === 'light-invalid') h.host.setLightingInputInvalid(true);
      else h.host.setAvailable(false);
      const before = retained(h.host); h.click(); check(h.model.calls === 0 && h.model.targets.length === 0, kind + ' incorrectly queried.'); equal(retained(h.host), before, kind + ' retention'); h.close();
    }
    checks.push('One bounded event matrix: maximum excursion/return, modifiers/wrong pointer/cancel/lost capture/blur/Escape, wheel/key navigation, rectangle/backing/disable/camera/epoch/owner/loss and query-induced invalidation; pose capture blocked.');
    const authored = harness(original); authored.model.result = hit(authored.model.state, B); authored.click(); editB(authored.host, .5);
    const first = authored.host.getSnapshot().accepted; authorship(first, original); const firstFileText = serializeRenderNativeSceneDocument(first);
    equal(parseRenderNativeSceneDocument(firstFileText), first); authored.close(); checks.push('Selected B actual gizmo pose + full B material Apply; actual authored FIRST JSON, two complete original assets/TEN/camera/A pose/material and signed zero retained.');
    return {scope, checks, browserGlobalReads: reads, protocolEvents: events, firstFileText, firstRevision: first.revision};
  });
}

export function runNativeSceneSelectionColdFlow(referenceSource: string, firstText: string): NativeSceneSelectionFlowResult {
  const reads: string[] = [];
  return guarded(reads, () => {
    const first = parseRenderNativeSceneDocument(firstText), original = seed(referenceSource, {documentId: first.documentId, title: first.title}); authorship(first, original);
    check(serializeRenderNativeSceneDocument(first) === firstText, 'FIRST file must be canonical actual authoring codec output.');
    const h = harness(original); h.host.commitPrepared(h.host.prepareOpen(firstText)); check(!h.host.getSnapshot().canUndo && !h.host.getSnapshot().canRedo && h.host.getSnapshot().savedRevision === first.revision, 'Cold Open did not reset history/saved baseline.');
    h.model.result = hit(h.model.state, B); h.click(); editB(h.host, .35); const second = h.host.getSnapshot().accepted; authorship(second, first);
    check(second.revision === first.revision + 2, 'Cold B gizmo/material must advance exactly two complete commits.');
    const secondFileText = serializeRenderNativeSceneDocument(second); equal(parseRenderNativeSceneDocument(secondFileText), second); h.close();
    return {scope, checks: ['Fresh emitted process takes FIRST JSON only; genuine Open/reconstruction/reset; modeled B click then actual B gizmo+material commits; SECOND authored JSON preserves full originals and A/camera/light. No runtime caches passed.'], browserGlobalReads: reads, firstRevision: first.revision, secondRevision: second.revision, secondFileText};
  });
}

export function verifyNativeSceneSelectionFiles(referenceSource: string, firstText: string, secondText: string): NativeSceneSelectionFlowResult {
  const reads: string[] = [];
  return guarded(reads, () => {
    const first = parseRenderNativeSceneDocument(firstText), second = parseRenderNativeSceneDocument(secondText), original = seed(referenceSource, {documentId: first.documentId, title: first.title});
    authorship(first, original); authorship(second, first); check(second.revision > first.revision, 'SECOND genuine revision must advance.');
    check(serializeRenderNativeSceneDocument(first) === firstText && serializeRenderNativeSceneDocument(second) === secondText, 'Genuine files must be canonical complete codec output.');
    const firstB = first.surfaceMaterials.find(item => item.target.bodyId === B)!, secondB = second.surfaceMaterials.find(item => item.target.bodyId === B)!;
    check(firstB.material.uniforms.amount !== original.surfaceMaterials.find(item => item.target.bodyId === B)!.material.uniforms.amount && secondB.material.uniforms.amount !== firstB.material.uniforms.amount, 'B material edits missing from genuine files.');
    check(secondB.material.revision > firstB.material.revision, 'B nested material revision must advance.');
    check(JSON.stringify(second.display.poses.find(item => item.bodyId === B)) !== JSON.stringify(first.display.poses.find(item => item.bodyId === B)), 'Genuine B pose reedit missing.');
    return {scope, checks: ['Supplied genuine FIRST/SECOND only: original322B CAD twice, complete TEN/frame/material source, A pose/material/camera/light fixed; actual recompile/reconstruction, monotonic B material/outer revisions and B pose reedit. Actual clicks and pixels are separate GUI evidence.'], browserGlobalReads: reads, firstRevision: first.revision, secondRevision: second.revision};
  });
}
