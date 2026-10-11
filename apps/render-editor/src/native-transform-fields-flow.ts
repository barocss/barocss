import {prepareRenderNativeSceneAppearance, validateRenderNativeSceneDocument,
  serializeRenderNativeSceneDocument, parseRenderNativeSceneDocument} from '@barocss/render-editor';
import type {RenderNativeSceneDocument, RenderNativeScenePose} from '@barocss/render-editor';
import type {MeshCamera} from '@barocss/gpu';
import {createNativeSceneHost} from './native-scene-host';
import {createNativeSceneBase, createNativeSceneSeed} from './native-scene-seed';
import {prepareNativeViewportAppearance} from './native-viewport-presentation';

/** A private launcher owns fresh source/emitted graphs, failures, actual file writes and cold processes. */
export interface NativeTransformFieldsFlowResult {
  readonly scope: string;
  readonly checks: readonly string[];
  readonly browserGlobalReads: readonly string[];
  readonly providerOutcome?: {readonly refused: boolean; readonly structuralAdmission: boolean; readonly error: unknown};
  readonly firstFileText?: string;
  readonly secondFileText?: string;
  readonly firstRevision?: number;
  readonly secondRevision?: number;
}
const A = 'body_preview_a', B = 'body_preview_b';
const scope = 'Real SDK original Native document/appearance and private host numeric staging. Model presentation callbacks prove CPU protocol only, not Viewer/Canvas/GL/pixels. Cold process receives authored JSON only.';
const material = {format: 'barocss-render-editor-material' as const, version: 0 as const, profile: 'mesh-opaque-fragment-v0' as const,
  documentId: 'blend-study', title: 'Blend study', revision: 0,
  shaderSource: '// Original blend study. Red and blue are authored colors.\r\n@shader #blend_study {\r\n  @uniform amount: float(0, 1, .25);\r\n  @fragment { color: mix(#ff0000, #0000ff, amount); }\r\n}\r\n', uniforms: {amount: .25}};
const camera: MeshCamera = {eye: [2, 1.45, 2], target: [0, -.55, 0], up: [0, 1, 0], fovYDegrees: 45, near: .01, far: 100};
const lighting = {ambientStrength: .4, directionalStrength: .6, direction: [.3, 1, .4] as [number, number, number]};
type Patch = {translationMM: readonly [number, number, number]; scale: readonly [number, number, number]};
const firstPatch: Patch = {translationMM: [1050, -25, 80], scale: [1.2, .8, 1.1]};
const secondPatch: Patch = {translationMM: [1120, -35, 95], scale: [1.3, .9, 1.15]};
const firstLight = {ambientStrength: .65, directionalStrength: .35, direction: [-.4, .8, .2] as [number, number, number]};
const secondLight = {ambientStrength: .6, directionalStrength: .4, direction: [.2, .9, -.3] as [number, number, number]};
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
function errorTree(error: unknown, depth = 0): unknown {
  if (!error || depth > 6 || typeof error !== 'object') return error === undefined ? null : String(error);
  const value = error as {name?: string; message?: string; code?: string; cause?: unknown};
  return {name: value.name, message: value.message, code: value.code, cause: value.cause === undefined ? null : errorTree(value.cause, depth + 1)};
}
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
function seed(source: string, identity?: {documentId: string; title: string}) {
  check(source.length === 322 && source.includes('cloth_reference_981') && source.includes('reference_panel'), 'Supply genuine unchanged322B reference; private launcher verifies original SHA.');
  return createNativeSceneSeed(createNativeSceneBase(source, clone(material), clone(camera), clone(lighting), identity));
}
function pose(document: RenderNativeSceneDocument, bodyId = B): RenderNativeScenePose {
  return document.display.poses.find(item => item.bodyId === bodyId) ?? {bodyId, translationMM: [0, 0, 0], rotationXYZW: [0, 0, 0, 1], scale: [1, 1, 1]};
}
function patch(document: RenderNativeSceneDocument): Patch {const current = pose(document); return {translationMM: current.translationMM, scale: current.scale};}
function authority(document: RenderNativeSceneDocument, original: RenderNativeSceneDocument): void {
  for (const key of ['format', 'version', 'profile', 'documentId', 'title', 'nativeDocument', 'nativeOptions'] as const) equal(document[key], original[key], key);
  for (const key of ['mmToSceneUnit', 'background', 'camera', 'visibleBodyIds', 'basis'] as const) equal(document.display[key], original.display[key], 'display.' + key);
  equal(pose(document, A), pose(original, A), 'unselected A pose'); equal(pose(document).rotationXYZW, pose(original).rotationXYZW, 'original B quaternion');
  equal(document.surfaceMaterials.find(item => item.target.bodyId === A), original.surfaceMaterials.find(item => item.target.bodyId === A), 'A complete material');
  const current = document.surfaceMaterials.find(item => item.target.bodyId === B), before = original.surfaceMaterials.find(item => item.target.bodyId === B); check(current && before, 'B material missing.');
  equal(current.target, before.target, 'original B material target');
  for (const key of ['format', 'version', 'profile', 'documentId', 'title', 'shaderSource'] as const) equal(current.material[key], before.material[key], 'B shader.' + key);
  const appearance = prepareRenderNativeSceneAppearance(document); check(appearance.authored.entries.length === 2 && appearance.viewer.prepared.primitives.length === 2, 'Actual complete appearance lost an original Surface.');
  for (const entry of appearance.authored.entries) check(entry.binding.modelId === 'cloth_reference_981' && entry.binding.geometryId === 'reference_panel' && entry.binding.documentRevision === 1 && entry.binding.assetRevision === (entry.binding.bodyId === A ? 2 : 7), 'Original native/TEN pins changed.');
  check(serializeRenderNativeSceneDocument(document).includes('-0'), 'Original signed zero lost.');
}
function harness(document: RenderNativeSceneDocument) {
  const host = createNativeSceneHost(document), model = {calls: 0, owner: {} as object, shown: host.getSnapshot().accepted,
    camera: clone(document.display.camera), failure: null as Error | null};
  host.setPresenter((prepared, cameraOverride) => {
    model.calls++; const request = prepareNativeViewportAppearance(prepared, cameraOverride);
    if (model.failure) {const error = model.failure; model.failure = null; throw error;}
    model.shown = prepared.authored.document; model.camera = clone(request.display.camera); model.owner = {};
  }, () => model.owner, () => model.camera);
  host.selectTarget(B); return {host, model};
}
function compose(host: ReturnType<typeof createNativeSceneHost>, numeric: Patch, amount: number, light: typeof firstLight): void {
  const accepted = host.getSnapshot().accepted, originalQ = pose(accepted).rotationXYZW;
  host.stageBodyPose(B, {translationMM: numeric.translationMM, scale: pose(accepted).scale});
  host.materialSession.setDraftUniforms({amount}); host.stageLighting(light);
  host.stageBodyPose(B, numeric);
  equal(pose(host.getSnapshot().draftDocument).rotationXYZW, originalQ); check(host.getSnapshot().accepted === accepted, 'Numeric staging accepted or previewed early.');
}
function numericRaw(host: ReturnType<typeof createNativeSceneHost>) {
  let text = [...pose(host.getSnapshot().draftDocument).translationMM, ...pose(host.getSnapshot().draftDocument).scale].map(value => Object.is(value, -0) ? '-0' : String(value));
  const decimal = /^[\t\n\v\f\r ]*[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?[\t\n\v\f\r ]*$/;
  return {get: () => [...text], set(index: number, value: string) {
    check(value.length <= 256, 'Raw model byte policy exceeded.'); text = text.map((item, i) => i === index ? value : item);
    const numbers = text.map(value => decimal.test(value) && Number.isFinite(Number(value)) ? Number(value) : NaN);
    if (numbers.some((value, i) => !Number.isFinite(value) || (i < 3 ? Math.abs(value) > 10000 : value < .001 || value > 100))) {
      host.setBodyPoseInputInvalid(B); return;
    }
    try {host.stageBodyPose(B, {translationMM: [numbers[0]!, numbers[1]!, numbers[2]!], scale: [numbers[3]!, numbers[4]!, numbers[5]!]});}
    catch {host.setBodyPoseInputInvalid(B);}
  }};
}

export function runNativeTransformFieldsFlow(referenceSource: string): NativeTransformFieldsFlowResult {
  const reads: string[] = [], checks: string[] = [];
  return guarded(reads, () => {
    const original = seed(referenceSource), {host, model} = harness(original), initial = host.getSnapshot(), initialRaw = host.materialSession.getSnapshot();
    host.stageBodyPose(B, patch(initial.accepted)); check(host.getSnapshot() === initial && host.materialSession.getSnapshot() === initialRaw && model.calls === 0, 'Typed no-op created draft/notification/presentation.');
    let getters = 0; const accessor = {translationMM: [900, -0, 0] as const, scale: [1, 1, 1] as const};
    Object.defineProperty(accessor, 'translationMM', {enumerable: true, get() {getters++; throw new Error('Unsafe getter');}});
    refuses(() => host.stageBodyPose(A, accessor)); refuses(() => host.stageBodyPose(B, accessor)); check(getters === 0, 'Own patch getter invoked.');
    refuses(() => host.stageBodyPose('foreign_body', accessor));
    const extra = {...patch(initial.accepted), rotationXYZW: [0, 0, 0, 1]}; refuses(() => host.stageBodyPose(B, extra));
    const symbolic = {...patch(initial.accepted), [Symbol('unsupported')]: 1}; refuses(() => host.stageBodyPose(B, symbolic));
    const coordinateAccessor: Patch = {translationMM: [900, -0, 0], scale: [1, 1, 1]};
    Object.defineProperty(coordinateAccessor.translationMM, '0', {enumerable: true, get() {getters++; throw new Error('Unsafe coordinate');}});
    refuses(() => host.stageBodyPose(B, coordinateAccessor)); check(getters === 0, 'Array coordinate getter invoked.');
    for (const invalid of [{translationMM: [10001, 0, 0], scale: [1, 1, 1]}, {translationMM: [900, 0, 0], scale: [0, 1, 1]},
      {translationMM: [900, 0, 0], scale: [.0009, 1, 1]}, {translationMM: [900, 0, 0], scale: [101, 1, 1]}, {translationMM: [NaN, 0, 0], scale: [1, 1, 1]}]) {
      const before = host.getSnapshot(); refuses(() => host.stageBodyPose(B, invalid as unknown as Patch)); check(host.getSnapshot() === before, 'Malformed/range stage mutated snapshot.');
    }
    const raw = numericRaw(host), reset = host.getSnapshot().bodyPoseInputResetEpoch;
    for (const [index, value] of [[0, '-'], [0, ''], [0, '1e'], [0, 'bad'], [0, 'Infinity'], [0, '10001'], [3, '0'], [3, '.0009'], [3, '101']] as const) {
      raw.set(index, value); check(raw.get()[index] === value && host.getSnapshot().invalidBodyPose && host.getSnapshot().invalidBodyPoseBodyId === B, 'Incomplete/range raw was discarded or unguarded.');
      check(host.getSnapshot().accepted === initial.accepted && host.getSnapshot().bodyPoseInputResetEpoch === reset, 'Invalid flag reset/accepted authority changed.');
    }
    host.materialSession.setDraftUniforms({amount: .6}); host.stageLighting(firstLight);
    const guardedSnapshot = host.getSnapshot(), guardedMaterial = host.materialSession.getSnapshot(), blockedCalls = model.calls;
    for (const operation of [() => host.prepareDraft(), () => host.materialSession.prepareDraft(), () => host.selectTarget(A), () => host.beginBodyPosePreview(B),
      () => host.applyCamera(), () => host.prepareUndo(), () => host.prepareOpen(serializeRenderNativeSceneDocument(original))]) refuses(operation);
    check(host.getSnapshot() === guardedSnapshot && host.materialSession.getSnapshot() === guardedMaterial && model.calls === blockedCalls, 'Invalid-body guard mutated local prepare or presented.');
    // #1477 permits local navigation during raw authoring; it never clears that raw guard.
    model.camera = {...clone(original.display.camera), eye: [.1, 2.6, 4]}; host.observeView(model.camera);
    check(host.getSnapshot().invalidBodyPose, 'Local navigation cleared invalid body flag.');
    model.camera = clone(original.display.camera); host.observeView(model.camera); refuses(() => host.applyCamera()); check(host.getSnapshot().invalidBodyPose, 'Set scene camera cleared invalid body flag.');
    host.restoreAccepted(); check(host.getSnapshot().invalidBodyPose, 'Restore view cleared invalid body flag.');
    host.setAvailable(false); check(host.getSnapshot().invalidBodyPose, 'Loss cleared raw body flag.'); host.setAvailable(true);
    raw.set(0, '900'); raw.set(3, '1');
    check(!host.getSnapshot().invalidBodyPose && host.getSnapshot().bodyPoseInputResetEpoch === reset, 'Same-value correction implicitly reset raw binding.');
    check(host.materialSession.getSnapshot().draftUniforms.amount === .6, 'Pose correction erased material draft.');
    host.discardDraft(); check(host.getSnapshot().bodyPoseInputResetEpoch === reset + 1 && !host.getSnapshot().invalidBodyPose, 'Discard did not explicitly reset body binding.');
    checks.push('Six bounded raw model strings retain incomplete/nonfinite/range input; mark-only flag blocks whole/local prepare before material mutation, selection/gizmo/File/history/Use; Restore/loss preserve; valid same-value correction preserves epoch; Discard resets. Own getter0/range refusals retain identity.');

    const structural = validateRenderNativeSceneDocument({...original, display: {...original.display, poses: original.display.poses.map(item => item.bodyId === B ? {...item, translationMM: [1e-50, -0, 0]} : item)}});
    check(pose(structural).translationMM[0] === 1e-50, 'Authentic provider witness failed document structural admission.');
    host.setBodyPoseInputInvalid(B); const providerBefore = host.getSnapshot(), providerRaw = host.materialSession.getSnapshot(), providerCalls = model.calls;
    let providerError: unknown = null;
    try {host.stageBodyPose(B, {translationMM: [1e-50, -0, 0], scale: [1, 1, 1]});} catch (error) {providerError = error;}
    const providerOutcome = {refused: providerError !== null, structuralAdmission: true, error: errorTree(providerError)};
    if (providerError === null) {const error = new Error('Predicted authentic X=1e-50 provider witness was admitted; inspect actual outcome, do not fabricate underflow.'); Object.assign(error, {providerOutcome}); throw error;}
    if (!(JSON.stringify(providerOutcome.error) ?? '').toLowerCase().includes('underflow')) {
      const error = new Error('Actual provider refused for a different cause; preserve first outcome.'); Object.assign(error, {providerOutcome, cause: providerError}); throw error;
    }
    check(host.getSnapshot() === providerBefore && host.materialSession.getSnapshot() === providerRaw && model.calls === providerCalls, 'Provider preflight refusal changed stage/raw/authority or presented.');
    host.stageBodyPose(B, patch(host.getSnapshot().draftDocument));
    checks.push('Actual identity-q X OVERWRITE1e-50: genuine structural admission then real whole appearance/provider outcome and cause recorded; last accepted/draft/raw/flag/history/frame retained, no Y=-550 tiny-addition witness.');
    host.materialSession.setDraftSource('@shader #unfinished {'); host.stageBodyPose(B, firstPatch);
    const incomplete = host.getSnapshot(), incompleteMaterial = host.materialSession.getSnapshot(), incompleteCalls = model.calls;
    refuses(() => host.prepareDraft()); check(host.getSnapshot() === incomplete && host.materialSession.getSnapshot() === incompleteMaterial && model.calls === incompleteCalls, 'Valid numeric pose erased/refused incomplete Source draft incorrectly.');
    check(host.materialSession.getSnapshot().draftSource === '@shader #unfinished {', 'Incomplete Source text was discarded.'); equal(patch(host.getSnapshot().draftDocument), firstPatch);
    host.discardDraft();

    const q = [0, Math.sin(.2) * (1 + 2e-10), 0, Math.cos(.2) * (1 + 2e-10)] as const;
    const quaternionDocument = validateRenderNativeSceneDocument({...original, display: {...original.display, poses: original.display.poses.map(item => item.bodyId === B ? {...item, rotationXYZW: q} : item)}});
    const nonidentity = harness(quaternionDocument); nonidentity.host.stageBodyPose(B, firstPatch);
    equal(pose(nonidentity.host.getSnapshot().draftDocument).rotationXYZW, q, 'No implicit quaternion normalization/Euler conversion'); nonidentity.host.dispose();
    const empty = validateRenderNativeSceneDocument({...original, display: {...original.display, poses: [], visibleBodyIds: [B]},
      surfaceMaterials: original.surfaceMaterials.filter(item => item.target.bodyId === B)}), hidden = harness(empty), emptyAccepted = hidden.host.getSnapshot().accepted;
    hidden.host.stageBodyPose(B, patch(emptyAccepted)); check(hidden.host.getSnapshot().accepted === emptyAccepted && hidden.host.getSnapshot().draftDocument.display.poses.length === 0 && !hidden.host.getSnapshot().nativeDirty, 'No-op expanded empty identity poses.');
    hidden.host.stageBodyPose(B, {translationMM: [50, -0, 0], scale: [1.1, 1, 1]}); check(hidden.host.getSnapshot().draftDocument.display.poses.length === 2, 'Typed edit did not expand EVERY entry including hidden A.');
    equal(pose(hidden.host.getSnapshot().draftDocument, A), pose(emptyAccepted, A), 'Hidden identity pose'); hidden.host.dispose();
    checks.push('Original nonexact-unit-within-tolerance quaternion copied bit-for-bit; original identity poses[] reads/no-op stay empty; real edit expands both actual entries including hidden A. No native geometry/source change.');

    compose(host, firstPatch, .5, firstLight); const acceptedBefore = host.getSnapshot().accepted, preflightCalls = model.calls;
    check(model.calls === providerCalls, 'Numeric/material/light staging presented a frame.');
    const stale = host.prepareDraft(); host.stageBodyPose(B, {...firstPatch, translationMM: [1060, -25, 80]}); refuses(() => host.commitPrepared(stale));
    compose(host, firstPatch, .5, firstLight); const candidate = host.prepareDraft(), snapshot = host.getSnapshot(), materialSnapshot = host.materialSession.getSnapshot();
    const foreign = harness(original); const calls = foreign.model.calls; refuses(() => foreign.host.commitPrepared(candidate)); check(foreign.model.calls === calls, 'Foreign candidate presented.'); foreign.host.dispose();
    const forged = {}; for (const key of ['preparation', 'purpose']) Object.defineProperty(forged, key, {enumerable: true, get() {getters++; throw new Error('Forged candidate getter');}});
    refuses(() => host.commitPrepared(forged as Parameters<typeof host.commitPrepared>[0])); check(getters === 0, 'Forged candidate getter invoked.');
    const failure = new Error('Declared CPU presenter refusal'); model.failure = failure; refuses(() => host.commitPrepared(candidate));
    check(host.getSnapshot() === snapshot && host.materialSession.getSnapshot() === materialSnapshot, 'Failed whole Apply lost corrective drafts.');
    const callsAfterRefusal = model.calls; refuses(() => host.commitPrepared(candidate, () => {refuses(() => host.stageBodyPose(B, firstPatch));}));
    check(host.getSnapshot() === snapshot && host.materialSession.getSnapshot() === materialSnapshot && model.calls === callsAfterRefusal, 'Caught reentry accepted or presented.');
    const epoch = snapshot.bodyPoseInputResetEpoch; host.commitPrepared(candidate);
    const applied = host.getSnapshot(); check(applied.accepted.revision === acceptedBefore.revision + 1 && applied.bodyPoseInputResetEpoch === epoch + 1 && !applied.invalidBodyPose && !applied.dirty, 'Composed fields must accept once and reset binding once.');
    equal(patch(applied.accepted), firstPatch); equal(applied.accepted.display.lighting, firstLight); check(applied.accepted.surfaceMaterials.find(item => item.target.bodyId === B)!.material.uniforms.amount === .5, 'B material was not composed.'); authority(applied.accepted, original);
    refuses(() => host.commitPrepared(candidate)); host.commitPrepared(host.prepareUndo()!); const undone = host.getSnapshot();
    equal(patch(undone.accepted), patch(original)); equal(undone.accepted.display.lighting, original.display.lighting); check(undone.accepted.surfaceMaterials.find(item => item.target.bodyId === B)!.material.uniforms.amount === .75, 'Whole Undo lost original B material.');
    host.commitPrepared(host.prepareRedo()!); const first = host.getSnapshot().accepted; equal(patch(first), firstPatch); equal(first.display.lighting, firstLight); authority(first, original);
    check(model.calls === preflightCalls + 4, 'Expected one refused presenter call plus Apply/Undo/Redo, without numeric preview.');
    const firstFileText = serializeRenderNativeSceneDocument(first); equal(parseRenderNativeSceneDocument(firstFileText), first); host.dispose();
    checks.push('Repeated pose/material/light stage ONE whole Apply; stale/foreign/forged/getter0/reentry/presenter refusal retain all corrective state; same candidate retry then single-use; full Undo/Redo restores complete authoring; FIRST codec JSON.');
    return {scope, checks, browserGlobalReads: reads, providerOutcome, firstFileText, firstRevision: first.revision};
  });
}

export function runNativeTransformFieldsColdFlow(referenceSource: string, firstText: string): NativeTransformFieldsFlowResult {
  const reads: string[] = [];
  return guarded(reads, () => {
    const first = parseRenderNativeSceneDocument(firstText), original = seed(referenceSource, {documentId: first.documentId, title: first.title}); authority(first, original);
    check(serializeRenderNativeSceneDocument(first) === firstText, 'FIRST must be real canonical complete codec JSON.');
    const {host, model} = harness(original); host.commitPrepared(host.prepareOpen(firstText)); const opened = host.getSnapshot();
    check(!opened.canUndo && !opened.canRedo && opened.savedRevision === first.revision, 'Fresh Open did not reset complete history/saved baseline.');
    const epoch = opened.bodyPoseInputResetEpoch, calls = model.calls; compose(host, secondPatch, .35, secondLight); check(model.calls === calls, 'Cold numeric staging presented.');
    host.commitPrepared(host.prepareDraft()); const second = host.getSnapshot().accepted;
    check(second.revision === first.revision + 1 && host.getSnapshot().bodyPoseInputResetEpoch === epoch + 1, 'Fresh composed reedit must accept/reset once.');
    equal(patch(second), secondPatch); equal(second.display.lighting, secondLight); authority(second, first);
    check(second.surfaceMaterials.find(item => item.target.bodyId === B)!.material.uniforms.amount === .35, 'Cold B material reedit missing.');
    const secondFileText = serializeRenderNativeSceneDocument(second); equal(parseRenderNativeSceneDocument(secondFileText), second); host.dispose();
    return {scope, checks: ['Fresh emitted process receives FIRST FILE JSON only; genuine Open/reset/reconstruction; numeric B+material+light compose ONE whole accepted candidate; SECOND codec file retains original source/TEN/q/A/camera and signed zero.'], browserGlobalReads: reads, firstRevision: first.revision, secondRevision: second.revision, secondFileText};
  });
}

export function verifyNativeTransformFieldsFiles(referenceSource: string, firstText: string, secondText: string): NativeTransformFieldsFlowResult {
  const reads: string[] = [];
  return guarded(reads, () => {
    const first = parseRenderNativeSceneDocument(firstText), second = parseRenderNativeSceneDocument(secondText), original = seed(referenceSource, {documentId: first.documentId, title: first.title});
    authority(first, original); authority(second, first);
    check(serializeRenderNativeSceneDocument(first) === firstText && serializeRenderNativeSceneDocument(second) === secondText, 'Genuine files must be canonical authoring codec output.');
    check(second.revision > first.revision, 'Genuine SECOND revision did not advance.');
    const firstB = first.surfaceMaterials.find(item => item.target.bodyId === B)!, secondB = second.surfaceMaterials.find(item => item.target.bodyId === B)!;
    check(firstB.material.uniforms.amount !== original.surfaceMaterials.find(item => item.target.bodyId === B)!.material.uniforms.amount && secondB.material.uniforms.amount !== firstB.material.uniforms.amount && secondB.material.revision > firstB.material.revision, 'Genuine complete B material edits missing.');
    check(JSON.stringify(patch(first)) !== JSON.stringify(patch(original)) && JSON.stringify(patch(second)) !== JSON.stringify(patch(first)), 'Genuine numeric pose edits missing.');
    check(JSON.stringify(first.display.lighting) !== JSON.stringify(original.display.lighting) && JSON.stringify(second.display.lighting) !== JSON.stringify(first.display.lighting), 'Genuine light composition missing.');
    return {scope, checks: ['Supplied genuine GUI FIRST/SECOND only: complete original two-asset sources/TEN/q/A material+pose/camera and numeric -0 preserved; actual complete preflight and canonical files; B numeric/material/light reedit and monotonic revisions. GUI pixels remain separate primary evidence.'], browserGlobalReads: reads, firstRevision: first.revision, secondRevision: second.revision};
  });
}
