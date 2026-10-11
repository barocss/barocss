import {parseRenderNativeSceneDocument, serializeRenderNativeSceneDocument, prepareRenderNativeSceneAppearance} from '@barocss/render-editor';
import type {RenderNativeSceneDocument, RenderNativeSceneAppearancePreparation} from '@barocss/render-editor';
import type {ViewerState} from '@barocss/viewer';
import type {MeshCamera} from '@barocss/gpu';
import {createNativeSceneHost} from './native-scene-host';
import {resolveNativeSelectedFrame} from './native-scene-selection';
import {prepareNativeViewportAppearance} from './native-viewport-presentation';

const scope = 'Actual public Native codec/preparation/host with an explicitly declared Viewer-state CPU model. No Viewer instance, fit call, bounds, DOM, backend or pixels are qualified by this flow.';
function check(value: unknown, message: string): asserts value {if (!value) throw new Error(message);}
const copy = <T,>(value: T): T => structuredClone(value);
function equal(actual: unknown, expected: unknown, label = 'value'): void {
  if (Object.is(actual, expected)) return;
  check(actual !== null && expected !== null && typeof actual === 'object' && typeof expected === 'object', label + ' differs.');
  const keys = Object.keys(actual), other = Object.keys(expected);
  check(keys.length === other.length && keys.every(key => other.includes(key)), label + ' fields differ.');
  for (const key of keys) equal((actual as Record<string, unknown>)[key], (expected as Record<string, unknown>)[key], label + '.' + key);
}
function refuse(operation: () => unknown): void {try {operation();} catch {return;} throw new Error('Expected selected-frame refusal.');}
function guarded<T>(reads: string[], operation: () => T): T {
  const saved = new Map<string, PropertyDescriptor | undefined>();
  try {
    for (const key of ['window', 'document', 'HTMLCanvasElement', 'WebGL2RenderingContext', 'requestAnimationFrame']) {
      saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
      Object.defineProperty(globalThis, key, {configurable: true, get() {reads.push(key); throw new Error('Pure metadata read browser global ' + key);}});
    }
    return operation();
  } finally {for (const [key, descriptor] of saved) {if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);}}
}
/** State values come from actual SDK preflight; the object itself is a declared CPU protocol model. */
function viewerModel(prepared: RenderNativeSceneAppearancePreparation, cameraOverride?: MeshCamera): ViewerState {
  const actual = prepared.authored, display = prepared.viewer.display, request = prepareNativeViewportAppearance(prepared, cameraOverride);
  return {
    status: 'ready', frame: 'right-handed-y-up', sourceUnit: 'mm', mmToSceneUnit: actual.document.display.mmToSceneUnit,
    camera: copy(request.display.camera), lighting: copy(actual.document.display.lighting),
    surfaces: actual.entries.map(entry => ({modelId: entry.ref.modelId, surfaceId: entry.ref.geometryId})), curves: [],
    visibleGeometry: copy(display.visibleGeometry), curveSampleVersion: null, uniformCurve: null, selectedUniformCurve: null,
    mixedDepth: null, qualifiedFaceScene: null, packets: actual.entries.map(entry => {check(entry.kind === 'surface', 'Fixture must contain real Surfaces.'); return {modelId: entry.ref.modelId, packet: copy(entry.packet)};}),
    selected: null, selectedGeometry: null, native: null, modelSet: null, document: copy(actual.native),
    documentBodies: actual.entries.map(entry => ({ref: {kind: 'surface', modelId: entry.ref.modelId, surfaceId: entry.ref.geometryId}, binding: copy(entry.binding)})),
    assembly: null, assemblyInstances: [], shell: null, measurement: null, motion: null, geometryMotion: copy(display.motion),
    curveMeasurement: null, surfaceCurveMeasurement: null, nativeMeasurement: null, fluidFrame: null, clothFrame: null,
    surfaceMaterial: null, surfaceMaterials: prepared.viewer.prepared.frame.materials.map(item => ({ref: {modelId: item.ref.modelId, surfaceId: item.ref.geometryId}, binding: copy(item.binding)})),
  };
}
function importedBody(document: RenderNativeSceneDocument): string {
  const bodies = document.nativeDocument.bodies.filter(body => !['body_preview_a', 'body_preview_b'].includes(body.id));
  check(bodies.length === 1, 'Supply genuine saved three-body user scene.'); return bodies[0]!.id;
}

/** The private launcher supplies actual preserved7370B user31 text and owns source/emitted graph receipts. */
export function runNativeSceneFramingFlow(userText: string) {
  const browserGlobalReads: string[] = [];
  return guarded(browserGlobalReads, () => {
    const document = parseRenderNativeSceneDocument(userText); check(document.revision === 31 && document.nativeDocument.revision === 4, 'Use genuine user31/native4.');
    check(serializeRenderNativeSceneDocument(document) === userText, 'Genuine file must remain canonical and byte exact.');
    const host = createNativeSceneHost(document); let state = viewerModel(prepareRenderNativeSceneAppearance(document)), owner: object = {}, presentations = 0;
    host.setPresenter((prepared, camera) => {presentations++; state = viewerModel(prepared, camera); owner = {};}, () => owner, () => state.camera);
    const bodyId = importedBody(document); host.selectTarget(bodyId);
    const snapshot = host.getSnapshot(), entry = snapshot.preparation.entries.find(item => item.binding.bodyId === bodyId);
    check(entry?.kind === 'surface', 'Selected original entry missing.');
    const expected = {ref: {kind: 'surface', modelId: entry.ref.modelId, surfaceId: entry.ref.geometryId}, documentRevision: 4};
    check(entry.ref.modelId !== entry.binding.modelId, 'Fixture must distinguish display namespace from original model.');
    const stateBefore = copy(state), snapshotBefore = host.getSnapshot(), textBefore = serializeRenderNativeSceneDocument(snapshot.accepted), presentedBefore = presentations;
    const request = resolveNativeSelectedFrame(snapshot, state); equal(request, expected);
    check(Object.isFrozen(request) && Object.isFrozen(request.ref), 'Frame request must be copied/frozen.');
    equal(state, stateBefore); check(host.getSnapshot() === snapshotBefore && presentations === presentedBefore, 'Resolution must not mutate host or present.');
    check(serializeRenderNativeSceneDocument(snapshot.accepted) === textBefore, 'Resolution must preserve complete file.');
    const checks = ['Selected real entry produces display-qualified Surface ref and native revision4 rather than authored31; copied frozen request and no input/host/presentation mutation.'];
    let refusals = 0;
    const badState = (change: (draft: ViewerState) => void) => {const draft = copy(state); change(draft); refuse(() => resolveNativeSelectedFrame(snapshot, draft)); refusals++;};
    for (const key of Object.keys(entry.binding)) badState(draft => {
      const bound = draft.documentBodies.find(item => item.binding.bodyId === bodyId)!;
      const binding = bound.binding as unknown as Record<string, unknown>;
      binding[key] = typeof binding[key] === 'number' ? (binding[key] as number) + 1 : String(binding[key]) + '_foreign';
    });
    badState(draft => {draft.status = 'unavailable';});
    badState(draft => {draft.document!.document.revision++;});
    badState(draft => {draft.document!.document.assets[0]!.source += '\n/* stale original */';});
    badState(draft => {draft.documentBodies.find(item => item.binding.bodyId === bodyId)!.ref.modelId += '_foreign';});
    badState(draft => {draft.documentBodies.push(copy(draft.documentBodies.find(item => item.binding.bodyId === bodyId)!));});
    badState(draft => {draft.visibleGeometry = draft.visibleGeometry.filter(ref => ref.modelId !== entry.ref.modelId);});
    badState(draft => {draft.surfaceMaterials = draft.surfaceMaterials.filter(item => item.ref.modelId !== entry.ref.modelId);});
    badState(draft => {draft.surfaceMaterials.push(copy(draft.surfaceMaterials.find(item => item.ref.modelId === entry.ref.modelId)!));});
    const staleIdentity = {...snapshot, preparation: {...snapshot.preparation, document: copy(snapshot.accepted)}};
    refuse(() => resolveNativeSelectedFrame(staleIdentity, state)); refusals++;
    for (const altered of [{available: false}, {disposed: true}, {poseGestureActive: true}, {posePreview: {bodyId, pose: document.display.poses.find(pose => pose.bodyId === bodyId)!}}]) {
      refuse(() => resolveNativeSelectedFrame({...snapshot, ...altered}, state)); refusals++;
    }
    let getters = 0; const accessor = {...state}; Object.defineProperty(accessor, 'document', {enumerable: true, get() {getters++; return state.document;}});
    refuse(() => resolveNativeSelectedFrame(snapshot, accessor)); check(getters === 0, 'Own-data refusal invoked getter.'); refusals++;
    checks.push('Every original TEN field plus stale source/document/ref, duplicate body, hidden visibility, absent material, unavailable/disposed/pose state and foreign preparation identity refuse; accessor reads0.');
    const raw = (stage: () => void) => {
      host.discardDraft(); stage(); const pending = host.getSnapshot(), rawSnapshot = host.materialSession.getSnapshot();
      check(pending.dirty, 'Corrective raw must remain dirty.'); equal(resolveNativeSelectedFrame(pending, state), expected);
      check(host.getSnapshot() === pending && host.materialSession.getSnapshot() === rawSnapshot, 'Frame metadata cleared corrective raw.');
      check(pending.accepted === snapshot.accepted && serializeRenderNativeSceneDocument(pending.accepted) === textBefore, 'Raw framing changed accepted authority.');
    };
    raw(() => host.materialSession.setDraftSource('@shader #incomplete {'));
    raw(() => host.materialSession.setDraftUniforms({amount: NaN}));
    raw(() => host.materialSession.setDraftUniforms({amount: .5}));
    raw(() => host.setLightingInputInvalid(true));
    raw(() => host.stageLighting({...document.display.lighting, ambientStrength: .3}));
    raw(() => host.setBodyPoseInputInvalid(bodyId));
    const appliedPose = document.display.poses.find(pose => pose.bodyId === bodyId)!;
    raw(() => host.stageBodyPose(bodyId, {translationMM: [appliedPose.translationMM[0] + 1, appliedPose.translationMM[1], appliedPose.translationMM[2]], scale: appliedPose.scale}));
    host.discardDraft(); const nextCamera = copy(state.camera); nextCamera.eye[0] += .2; state.camera = nextCamera; host.observeView(nextCamera);
    equal(resolveNativeSelectedFrame(host.getSnapshot(), state), expected); check(host.getSnapshot().viewDirty, 'Local view should remain informational.');
    checks.push('Actual host invalid Source/uniform/light/body-position drafts and local view are admitted without clearing raw, authored camera/history or presentation.');
    check(browserGlobalReads.length === 0, 'CPU metadata used browser globals.'); host.dispose();
    return {scope, checks, refusals, getterReads: getters, browserGlobalReads, selectedBodyId: bodyId, request};
  });
}

export function verifyNativeSceneFramingFiles(userText: string, firstText: string, secondText: string) {
  const browserGlobalReads: string[] = [];
  return guarded(browserGlobalReads, () => {
    check(firstText === userText, 'Frame-selected/all FIRST31 must preserve genuine user file bytes.');
    const original = parseRenderNativeSceneDocument(userText), first = parseRenderNativeSceneDocument(firstText), second = parseRenderNativeSceneDocument(secondText);
    check(original.revision === 31 && first.revision === 31 && second.revision === 32, 'Record genuine expected31/31/32 authority.');
    const bodyId = importedBody(first), material = first.surfaceMaterials.find(item => item.target.bodyId === bodyId);
    check(material, 'Selected imported material missing.');
    const expected = {...first, revision: 32, surfaceMaterials: first.surfaceMaterials.map(item => item.target.bodyId === bodyId
      ? {...item, material: {...item.material, revision: item.material.revision + 1, uniforms: {...item.material.uniforms, amount: .5}}} : item)};
    equal(second, expected, 'SECOND only selected amount/material revision/outer revision');
    for (const [doc, text] of [[original, userText], [first, firstText], [second, secondText]] as const) {
      check(serializeRenderNativeSceneDocument(doc) === text, 'Real file canonical serialization differs.');
      const actual = prepareRenderNativeSceneAppearance(doc); check(actual.authored.entries.length === 3 && actual.stage === 'cpu-frame-prepared' && actual.rendererAdmission === 'not-presented', 'Reopened whole real appearance lost authority.');
    }
    return {scope: 'Genuine file-only actual public codec/appearance proof; no fit or graphics claim.', checks: ['FIRST31 byte exact to user31.', 'SECOND32 only selected amount.5 and material/outer revision; whole source/TEN/poses/quaternions/scales/camera/light unchanged.'], browserGlobalReads, selectedBodyId: bodyId, firstRevision: first.revision, secondRevision: second.revision};
  });
}
