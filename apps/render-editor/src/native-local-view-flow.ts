import {prepareRenderNativeSceneAppearance, parseRenderNativeSceneDocument, serializeRenderNativeSceneDocument,
  prepareRenderNativeSceneGizmo, deriveRenderNativeSceneGizmoPose, deriveRenderCameraInteraction} from '@barocss/render-editor';
import type {RenderNativeSceneDocument, RenderNativeSceneAppearancePreparation} from '@barocss/render-editor';
import {prepareViewerNativeSceneAppearance} from '@barocss/viewer';
import {prepareCamera} from '@barocss/gpu';
import type {MeshCamera} from '@barocss/gpu';
import {createNativeSceneBase, createNativeSceneSeed} from './native-scene-seed';
import {createNativeSceneHost} from './native-scene-host';
import {prepareNativeViewportAppearance} from './native-viewport-presentation';

/** A private launcher owns source/emitted graph receipts, real filesystem writes and fresh file-only children. */
export interface NativeLocalViewFlowResult {
  readonly scope: string;
  readonly checks: readonly string[];
  readonly browserGlobalReads: readonly string[];
  readonly firstFileText?: string;
  readonly secondFileText?: string;
  readonly thirdFileText?: string;
  readonly firstRevision?: number;
  readonly secondRevision?: number;
  readonly thirdRevision?: number;
}
const A = 'body_preview_a', B = 'body_preview_b';
const scope = 'Actual public camera math and Viewer Native appearance preflight over original SDK requests. Private host/model presentation proves CPU protocol only; no Viewer instance, backend/Canvas/GL/pixel proof. Saved authority never contains viewport state.';
const material = {format: 'barocss-render-editor-material' as const, version: 0 as const, profile: 'mesh-opaque-fragment-v0' as const,
  documentId: 'blend-study', title: 'Blend study', revision: 0,
  shaderSource: '// Original blend study. Red and blue are authored colors.\r\n@shader #blend_study {\r\n  @uniform amount: float(0, 1, .25);\r\n  @fragment { color: mix(#ff0000, #0000ff, amount); }\r\n}\r\n', uniforms: {amount: .25}};
const camera: MeshCamera = {eye: [2, 1.45, 2], target: [0, -.55, 0], up: [0, 1, 0], fovYDegrees: 45, near: .01, far: 100};
const light = {ambientStrength: .4, directionalStrength: .6, direction: [.3, 1, .4] as [number, number, number]};
const viewport = {width: 900, height: 600, backingWidth: 1024, backingHeight: 768};
function check(value: unknown, message: string): asserts value {if (!value) throw new Error(message);}
function clone<T>(value: T): T {return structuredClone(value);}
function equal(actual: unknown, expected: unknown, label = 'value'): void {
  if (Object.is(actual, expected)) return;
  check(actual !== null && expected !== null && typeof actual === 'object' && typeof expected === 'object', label + ' differs.');
  const keys = Object.keys(actual), other = Object.keys(expected);
  check(keys.length === other.length && keys.every(key => other.includes(key)), label + ' fields differ.');
  for (const key of keys) equal((actual as Record<string, unknown>)[key], (expected as Record<string, unknown>)[key], label + '.' + key);
}
function close(a: number, b: number, tolerance = 1e-9): void {check(Number.isFinite(a) && Math.abs(a - b) <= tolerance, `${a} differs from ${b}`);}
function refuses(operation: () => unknown): unknown {try {operation();} catch (error) {return error;} throw new Error('Expected refusal.');}
function guarded<T>(reads: string[], operation: () => T): T {
  const saved = new Map<string, PropertyDescriptor | undefined>();
  try {
    for (const key of ['window', 'document', 'HTMLCanvasElement', 'WebGL2RenderingContext', 'requestAnimationFrame']) {
      saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
      Object.defineProperty(globalThis, key, {configurable: true, get() {reads.push(key); throw new Error('CPU flow read browser global ' + key);}});
    }
    return operation();
  } finally {for (const [key, descriptor] of saved) {if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);}}
}
function base(source: string, identity?: {documentId: string; title: string}) {
  check(source.length === 322 && source.includes('cloth_reference_981') && source.includes('reference_panel'), 'Use genuine unchanged322B source; private launcher verifies original SHA.');
  return createNativeSceneBase(source, clone(material), clone(camera), clone(light), identity);
}
function seed(source: string, identity?: {documentId: string; title: string}) {return createNativeSceneSeed(base(source, identity));}
function retained(host: ReturnType<typeof createNativeSceneHost>) {
  const state = host.getSnapshot(), raw = host.materialSession.getSnapshot();
  return {accepted: state.accepted, draftDocument: state.draftDocument, nativeDirty: state.nativeDirty, materialDirty: state.materialDirty,
    invalidLighting: state.invalidLighting, invalidBodyPose: state.invalidBodyPose, bodyPoseInputResetEpoch: state.bodyPoseInputResetEpoch,
    canUndo: state.canUndo, canRedo: state.canRedo, savedRevision: state.savedRevision,
    source: raw.draftSource, uniforms: raw.draftUniforms, diagnostics: raw.diagnostics};
}
function authority(document: RenderNativeSceneDocument, original: RenderNativeSceneDocument, keepCamera = true): void {
  for (const key of ['format', 'version', 'profile', 'documentId', 'title', 'nativeDocument', 'nativeOptions'] as const) equal(document[key], original[key], key);
  for (const key of ['mmToSceneUnit', 'background', 'visibleBodyIds', 'basis'] as const) equal(document.display[key], original.display[key], 'display.' + key);
  if (keepCamera) equal(document.display.camera, original.display.camera, 'authored camera');
  equal(document.display.poses.find(item => item.bodyId === A), original.display.poses.find(item => item.bodyId === A), 'A pose');
  equal(document.display.poses.find(item => item.bodyId === B)!.rotationXYZW, original.display.poses.find(item => item.bodyId === B)!.rotationXYZW, 'original B quaternion');
  equal(document.surfaceMaterials.find(item => item.target.bodyId === A), original.surfaceMaterials.find(item => item.target.bodyId === A), 'A complete material');
  const current = document.surfaceMaterials.find(item => item.target.bodyId === B)!, before = original.surfaceMaterials.find(item => item.target.bodyId === B)!;
  equal(current.target, before.target); for (const key of ['format', 'version', 'profile', 'documentId', 'title', 'shaderSource'] as const) equal(current.material[key], before.material[key]);
  const prepared = prepareRenderNativeSceneAppearance(document); check(prepared.authored.entries.length === 2 && prepared.viewer.prepared.primitives.length === 2, 'Original native inventory changed.');
  equal(parseRenderNativeSceneDocument(serializeRenderNativeSceneDocument(document)), document, 'complete codec and numeric signed zero');
}
function helperSanity(prepared: RenderNativeSceneAppearancePreparation, actualCamera: MeshCamera): void {
  const bytes = serializeRenderNativeSceneDocument(prepared.authored.document), originalRequest = clone(prepared.request), request = prepareNativeViewportAppearance(prepared, actualCamera);
  equal(request.source, originalRequest.source, 'original source/TEN'); equal(request.appearance, originalRequest.appearance, 'original materials/light');
  equal(request.display.motion, originalRequest.display.motion, 'original poses'); equal(request.display.visibleGeometry, originalRequest.display.visibleGeometry, 'original visibility');
  equal(request.display.camera, actualCamera); equal(prepared.request, originalRequest, 'unmodified SDK request');
  const display = prepareViewerNativeSceneAppearance(request, prepared.context); equal(display.prepared.frame.options.camera, actualCamera);
  equal(display.prepared.primitives.map(item => ({positions: Array.from(item.positions), normals: item.normals && Array.from(item.normals)})),
    prepared.viewer.prepared.primitives.map(item => ({positions: Array.from(item.positions), normals: item.normals && Array.from(item.normals)})), 'camera-only exact execution geometry');
  check(serializeRenderNativeSceneDocument(prepared.authored.document) === bytes, 'Viewport helper changed authored JSON.');
  request.display.camera.eye[0] += .1; equal(prepared.request, originalRequest, 'owned returned request isolation');
}
function harness(document: RenderNativeSceneDocument, initialCamera = document.display.camera, publish = true) {
  const host = createNativeSceneHost(document);
  const model = {camera: clone(initialCamera), owner: {} as object, calls: 0, failAt: -1, shown: host.getSnapshot().accepted,
    during: null as (() => void) | null, readerDuring: null as (() => void) | null};
  host.setPresenter((prepared, cameraOverride) => {
    model.calls++; const request = prepareNativeViewportAppearance(prepared, cameraOverride), actual = prepareViewerNativeSceneAppearance(request, prepared.context);
    model.during?.(); if (model.calls === model.failAt) throw new Error('Declared CPU presentation refusal');
    model.camera = clone(actual.display.camera); model.shown = prepared.authored.document; model.owner = {};
  }, () => model.owner, () => {model.readerDuring?.(); return clone(model.camera);});
  if (publish) host.commitPrepared(host.prepareOpen(serializeRenderNativeSceneDocument(document)));
  const navigate = (next: MeshCamera) => {
    const prepared = prepareRenderNativeSceneAppearance(host.getSnapshot().accepted), actual = prepareViewerNativeSceneAppearance(prepareNativeViewportAppearance(prepared, next), prepared.context);
    model.camera = clone(actual.display.camera); host.observeView(model.camera);
  };
  return {host, model, navigate, close: () => host.dispose()};
}
function orbit(camera: MeshCamera) {return deriveRenderCameraInteraction(camera, {kind: 'orbit', deltaX: 38, deltaY: -22, width: viewport.width, height: viewport.height});}
function move(host: ReturnType<typeof createNativeSceneHost>): void {
  host.selectTarget(B); const document = host.getSnapshot().accepted, displayed = host.getDisplayCamera(), before = document.revision;
  const prepared = prepareRenderNativeSceneGizmo(document, B, displayed, viewport, 'translate', 'world'), handle = prepared.handles.find(item => item.key === 'x'); check(handle, 'Actual-view B Move X unavailable.');
  const origin = document.display.poses.find(item => item.bodyId === B)!.translationMM.map(value => value * document.display.mmToSceneUnit);
  const matrices = prepareCamera(displayed, viewport.backingWidth / viewport.backingHeight);
  const viewed = [0, 1, 2, 3].map(row => matrices.view[row]! * origin[0]! + matrices.view[row + 4]! * origin[1]! + matrices.view[row + 8]! * origin[2]! + matrices.view[row + 12]!);
  const clip = [0, 1, 2, 3].map(row => [0, 1, 2, 3].reduce((sum, column) => sum + matrices.projection[column * 4 + row]! * viewed[column]!, 0));
  close(prepared.pivot[0], (1 + clip[0]! / clip[3]!) * viewport.width / 2); close(prepared.pivot[1], (1 - clip[1]! / clip[3]!) * viewport.height / 2);
  const token = host.beginBodyPosePreview(B), next = deriveRenderNativeSceneGizmoPose(document, B, displayed, viewport, 'translate', 'world', 'x', handle.anchor, [handle.anchor[0] + 7, handle.anchor[1]]);
  host.previewBodyPose(token, next); check(host.getSnapshot().accepted === document, 'Preview accepted early.'); equal(host.getDisplayCamera(), displayed);
  host.applyBodyPosePreview(token); check(host.getSnapshot().accepted.revision === before + 1, 'Move release must accept one history entry.'); equal(host.getDisplayCamera(), displayed);
}
function compose(host: ReturnType<typeof createNativeSceneHost>, second = false): void {
  host.selectTarget(B); host.stageBodyPose(B, {translationMM: second ? [1120, -35, 95] : [1050, -25, 80], scale: second ? [1.3, .9, 1.15] : [1.2, .8, 1.1]});
  host.materialSession.setDraftUniforms({amount: second ? .35 : .5});
  host.stageLighting({ambientStrength: second ? .6 : .65, directionalStrength: second ? .4 : .35, direction: second ? [.2, .9, -.3] : [-.4, .8, .2]});
  host.commitPrepared(host.prepareDraft());
}

export function runNativeLocalViewFlow(referenceSource: string): NativeLocalViewFlowResult {
  const reads: string[] = [], checks: string[] = [];
  return guarded(reads, () => {
    const original = seed(referenceSource), authoredBytes = serializeRenderNativeSceneDocument(original), oblique = orbit(original.display.camera);
    helperSanity(prepareRenderNativeSceneAppearance(original), oblique);
    const pan = deriveRenderCameraInteraction(oblique, {kind: 'pan', deltaX: 8, deltaY: -5, width: viewport.width, height: viewport.height}), zoom = deriveRenderCameraInteraction(oblique, {kind: 'zoom', factor: 1.1});
    for (let axis = 0; axis < 3; axis++) close(pan.eye[axis]! - oblique.eye[axis]!, pan.target[axis]! - oblique.target[axis]!);
    close(Math.hypot(...zoom.eye.map((value, i) => value - zoom.target[i]!)), Math.hypot(...oblique.eye.map((value, i) => value - oblique.target[i]!)) / 1.1);
    for (const key of ['fovYDegrees', 'near', 'far'] as const) equal(zoom[key], oblique[key]);
    let getters = 0; const badCamera = clone(oblique); Object.defineProperty(badCamera, 'eye', {enumerable: true, get() {getters++; throw new Error('Accessor');}});
    refuses(() => prepareNativeViewportAppearance(prepareRenderNativeSceneAppearance(original), badCamera)); check(getters === 0, 'Override camera getter invoked.');
    checks.push('Actual public camera orbit/pan/zoom and camera-only Viewer request preflight; source/TEN/poses/material/light and exact execution positions/normals retained; owned request isolation/getter0.');

    const firstCreate = harness(base(referenceSource), oblique, false); firstCreate.host.stageSceneDocument(original); firstCreate.host.commitPrepared(firstCreate.host.prepareDraft());
    equal(firstCreate.model.camera, original.display.camera, 'Initial Create incoming camera policy'); firstCreate.close();
    const h = harness(original), baseline = retained(h.host), calls = h.model.calls; h.navigate(oblique);
    equal(retained(h.host), baseline, 'navigation authority/history/raw'); check(!h.host.getSnapshot().dirty && h.host.getSnapshot().viewDirty && h.model.calls === calls, 'Local view became an authoring transaction.');
    check(serializeRenderNativeSceneDocument(h.host.getSnapshot().accepted) === authoredBytes, 'Orbit changed saved camera/file.');
    const copy = h.host.getDisplayCamera(); check(copy !== h.model.camera && Object.isFrozen(copy.eye), 'Display camera is not an owned validated copy.');
    h.host.selectTarget(B); equal(h.host.getDisplayCamera(), oblique); move(h.host);
    const afterMove = h.host.getSnapshot().accepted; compose(h.host); check(h.host.getSnapshot().accepted.revision === afterMove.revision + 1, 'Numeric/material/light must compose ONE Apply.');
    equal(h.model.camera, oblique); authority(h.host.getSnapshot().accepted, original); const finalPose = clone(h.host.getSnapshot().accepted.display.poses);
    h.host.commitPrepared(h.host.prepareUndo()!); equal(h.model.camera, oblique); h.host.commitPrepared(h.host.prepareRedo()!); equal(h.model.camera, oblique); equal(h.host.getSnapshot().accepted.display.poses, finalPose);
    checks.push('Initial unpublished Create uses incoming camera; local Orbit is clean/history/file-neutral; actual-view selection and projected Move/preview/release, numeric/material/light ONE Apply, Undo/Redo all preserve display view and original saved camera.');

    h.host.setBodyPoseInputInvalid(B); h.host.materialSession.setDraftSource('@shader #unfinished {'); h.host.setLightingInputInvalid(true);
    const raw = retained(h.host), epoch = h.host.getSnapshot().bodyPoseInputResetEpoch; h.navigate(pan); equal(retained(h.host), raw, 'invalid raw navigation');
    h.host.resetViewportCamera(); equal(retained(h.host), raw, 'reset raw preservation'); equal(h.model.camera, original.display.camera); check(h.host.getSnapshot().bodyPoseInputResetEpoch === epoch, 'View reset consumed raw reset epoch.');
    refuses(() => h.host.applyCamera()); h.host.discardDraft(); h.navigate(oblique); const beforeDiscard = h.host.getSnapshot().accepted;
    h.host.materialSession.setDraftUniforms({amount: .42}); h.host.discardDraft(); check(h.host.getSnapshot().accepted === beforeDiscard, 'Discard accepted source changed.'); equal(h.model.camera, oblique);
    h.model.failAt = h.model.calls + 1; const resetBefore = h.host.getSnapshot(), resetCalls = h.model.calls;
    refuses(() => h.host.resetViewportCamera()); check(h.host.getSnapshot() === resetBefore && h.model.calls === resetCalls + 1, 'Failed Reset cleared last local view.'); equal(h.model.camera, oblique);
    h.model.failAt = -1; h.host.resetViewportCamera(); equal(h.model.camera, original.display.camera); h.navigate(oblique);
    checks.push('Valid/invalid authoring raw permits local navigation; Reset/Discard retain raw or local view under their separate policies; Reset does not reset body binding; failed Reset preserves prior view and is retryable.');

    const token = h.host.beginBodyPosePreview(B), source = h.host.getSnapshot().accepted, body = source.display.poses.find(item => item.bodyId === B)!;
    const next = {...body, translationMM: [body.translationMM[0] + 40, body.translationMM[1], body.translationMM[2]] as const};
    h.host.previewBodyPose(token, next); const good = h.host.getSnapshot().posePreview, local = clone(h.model.camera);
    h.model.failAt = h.model.calls + 1; refuses(() => h.host.cancelBodyPosePreview(token)); check(h.host.getSnapshot().posePreview === good, 'Failed cancel abandoned retained pose.'); equal(h.model.camera, local);
    h.model.failAt = -1; h.host.cancelBodyPosePreview(token); equal(h.model.shown, source); equal(h.model.camera, oblique);
    const stale = h.host.beginBodyPosePreview(B), beforeStale = h.model.calls; h.model.camera = pan;
    refuses(() => h.host.previewBodyPose(stale, next)); check(h.model.calls === beforeStale && h.host.getSnapshot().accepted === source, 'External camera mismatch presented or authored.');
    h.navigate(oblique);
    const lost = harness(original); lost.host.selectTarget(B); lost.navigate(oblique); const lostToken = lost.host.beginBodyPosePreview(B), lostBefore = lost.host.getSnapshot().accepted;
    const lostPose = {...lostBefore.display.poses.find(item => item.bodyId === B)!, translationMM: [940, -0, 0] as const}; lost.host.previewBodyPose(lostToken, lostPose);
    const lostCalls = lost.model.calls; lost.model.owner = {}; refuses(() => lost.host.cancelBodyPosePreview(lostToken));
    check(!lost.host.getSnapshot().available && lost.model.calls === lostCalls && lost.host.getSnapshot().accepted === lostBefore, 'Retained preview mismatch falsely restored/claimed availability.'); lost.close();
    checks.push('Captured actual camera frozen independently of delayed observation; unchanged failed Cancel remains retryable; external camera before preview performs no old restore; retained-preview external owner mismatch is unavailable and preserves CPU authority.');

    const callback = harness(original); callback.host.selectTarget(B); callback.navigate(oblique); callback.host.stageLighting({...light, ambientStrength: .5, directionalStrength: .5});
    const candidate = callback.host.prepareDraft(), callbackBefore = retained(callback.host), callbackCalls = callback.model.calls;
    refuses(() => callback.host.commitPrepared(candidate, () => {refuses(() => callback.host.observeView(pan));})); equal(retained(callback.host), callbackBefore); check(callback.model.calls === callbackCalls, 'Caught reentry reached presenter.');
    callback.model.readerDuring = () => {refuses(() => callback.host.observeView(pan));}; refuses(() => callback.host.commitPrepared(candidate)); callback.model.readerDuring = null;
    check(callback.host.getSnapshot().accepted === callbackBefore.accepted && callback.model.calls === callbackCalls, 'Camera-reader reentry reached presentation/acceptance.'); callback.close();
    checks.push('Whole Apply and actual-camera reader caught reentry refuse before model presentation/CPU acceptance, preserving original corrective authoring.');

    const first = h.host.getSnapshot().accepted; authority(first, original); const firstFileText = serializeRenderNativeSceneDocument(first); equal(first.display.camera, original.display.camera); h.host.markSaved(first.revision);
    h.host.commitPrepared(h.host.prepareOpen(firstFileText)); equal(h.model.camera, first.display.camera); check(!h.host.getSnapshot().viewDirty && !h.host.getSnapshot().canUndo, 'Open did not reset to incoming camera/history.');
    h.close(); checks.push('Genuine CPU FIRST codec text saves original authored camera under User view; successful Open resets local camera/history to incoming file, without viewport data in schema.');
    return {scope, checks, browserGlobalReads: reads, firstFileText, firstRevision: first.revision};
  });
}

export function runNativeLocalViewColdFlow(referenceSource: string, firstText: string): NativeLocalViewFlowResult {
  const reads: string[] = [];
  return guarded(reads, () => {
    const first = parseRenderNativeSceneDocument(firstText), original = seed(referenceSource, {documentId: first.documentId, title: first.title}); authority(first, original);
    check(serializeRenderNativeSceneDocument(first) === firstText, 'FIRST must be actual canonical codec output.');
    const h = harness(original); h.navigate(orbit(original.display.camera)); h.host.commitPrepared(h.host.prepareOpen(firstText));
    equal(h.model.camera, first.display.camera); check(!h.host.getSnapshot().canUndo && h.host.getSnapshot().savedRevision === first.revision, 'Fresh Open reset policy failed.');
    const view = orbit(first.display.camera); h.navigate(view); h.host.selectTarget(B); compose(h.host, true);
    const second = h.host.getSnapshot().accepted; authority(second, first); equal(h.model.camera, view); check(second.revision === first.revision + 1, 'Fresh combined reedit must accept once.');
    const secondFileText = serializeRenderNativeSceneDocument(second), cameraBeforeSet = clone(h.model.camera); h.host.applyCamera(); const third = h.host.getSnapshot().accepted;
    check(third.revision === second.revision + 1 && !h.host.getSnapshot().viewDirty, 'Explicit Set scene camera must accept once and bind Scene view.');
    authority(third, second, false); equal(third.display.camera, cameraBeforeSet); equal(third.display.poses, second.display.poses); equal(third.display.lighting, second.display.lighting); equal(third.surfaceMaterials, second.surfaceMaterials);
    const thirdFileText = serializeRenderNativeSceneDocument(third); h.close();
    return {scope, checks: ['Fresh emitted process receives FIRST JSON only; Open resets camera/history; local Orbit then numeric/material/light ONE reedit keeps original camera in SECOND; explicit clean Set scene camera ONE history changes only authored camera in optional THIRD.'], browserGlobalReads: reads, secondFileText, thirdFileText, firstRevision: first.revision, secondRevision: second.revision, thirdRevision: third.revision};
  });
}

export function verifyNativeLocalViewFiles(referenceSource: string, firstText: string, secondText: string, thirdText?: string): NativeLocalViewFlowResult {
  const reads: string[] = [];
  return guarded(reads, () => {
    const first = parseRenderNativeSceneDocument(firstText), second = parseRenderNativeSceneDocument(secondText), original = seed(referenceSource, {documentId: first.documentId, title: first.title});
    authority(first, original); authority(second, first); check(second.revision > first.revision, 'Genuine SECOND revision did not advance.');
    check(serializeRenderNativeSceneDocument(first) === firstText && serializeRenderNativeSceneDocument(second) === secondText, 'Genuine files must retain canonical codec bytes.');
    check(JSON.stringify(first.display.poses.find(item => item.bodyId === B)) !== JSON.stringify(original.display.poses.find(item => item.bodyId === B)) && JSON.stringify(second.display.poses.find(item => item.bodyId === B)) !== JSON.stringify(first.display.poses.find(item => item.bodyId === B)), 'B numeric reedit missing.');
    check(second.surfaceMaterials.find(item => item.target.bodyId === B)!.material.uniforms.amount !== first.surfaceMaterials.find(item => item.target.bodyId === B)!.material.uniforms.amount, 'B material reedit missing.');
    check(JSON.stringify(second.display.lighting) !== JSON.stringify(first.display.lighting), 'Global light reedit missing.');
    let thirdRevision: number | undefined;
    if (thirdText !== undefined) {
      const third = parseRenderNativeSceneDocument(thirdText); authority(third, second, false); equal(third.display.poses, second.display.poses); equal(third.display.lighting, second.display.lighting); equal(third.surfaceMaterials, second.surfaceMaterials);
      check(third.revision === second.revision + 1 && JSON.stringify(third.display.camera) !== JSON.stringify(second.display.camera), 'Explicit THIRD must change only Scene camera once.');
      check(serializeRenderNativeSceneDocument(third) === thirdText, 'THIRD codec bytes changed.'); thirdRevision = third.revision;
    }
    return {scope, checks: ['Supplied genuine GUI files only: FIRST/SECOND preserve original authored camera/source/TEN/q/A; actual native/material/pose preflight and canonical JSON; optional THIRD explicit camera-only accepted change. Observed viewport/pixels remain separate GUI evidence.'], browserGlobalReads: reads, firstRevision: first.revision, secondRevision: second.revision, thirdRevision};
  });
}
