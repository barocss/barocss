import {createRenderNativeSceneSession, createRenderMaterialSession, prepareRenderMaterialDocument,
  validateRenderNativeSceneDocument, serializeRenderNativeSceneDocument, prepareRenderNativeSceneAppearance,
  commitRenderNativeSceneAppearanceCandidate, RenderEditorError, normalizeRenderEditorError} from '@barocss/render-editor';
import type {RenderNativeSceneDocument, RenderNativeScenePreparation, RenderNativeScenePreparedCandidate,
  RenderNativeSceneAppearancePreparation, RenderMaterialSession, RenderMaterialSessionSnapshot,
  RenderMaterialPreparedCandidate, RenderNativeScenePose} from '@barocss/render-editor';
import {validateMeshCamera} from '@barocss/gpu';
import type {MeshCamera, MeshLighting} from '@barocss/gpu';

export type NativeScenePresenter = (prepared: RenderNativeSceneAppearancePreparation) => void;
export interface NativeSceneHostSnapshot {
  readonly accepted: RenderNativeSceneDocument;
  readonly preparation: RenderNativeScenePreparation;
  readonly draftDocument: RenderNativeSceneDocument;
  readonly selectedBodyId: string;
  readonly targets: readonly {readonly bodyId: string; readonly modelId: string; readonly surfaceId: string; readonly title: string}[];
  readonly dirty: boolean;
  readonly nativeDirty: boolean;
  readonly materialDirty: boolean;
  readonly invalidLighting: boolean;
  readonly invalidBodyPose: boolean;
  readonly invalidBodyPoseBodyId: string | null;
  readonly bodyPoseInputResetEpoch: number;
  readonly viewCamera: MeshCamera | null;
  readonly viewDirty: boolean;
  readonly poseGestureActive: boolean;
  readonly posePreview: Readonly<{bodyId: string; pose: RenderNativeScenePose}> | null;
  readonly available: boolean;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly savedRevision: number | null;
  readonly disposed: boolean;
}
export interface NativeSceneHost {
  readonly materialSession: RenderMaterialSession;
  getSnapshot(): NativeSceneHostSnapshot;
  subscribe(listener: () => void): () => void;
  selectTarget(bodyId: string): void;
  setPresenter(presenter: NativeScenePresenter | null, ownershipReader?: () => object): void;
  setAvailable(available: boolean): void;
  stageSceneDocument(document: RenderNativeSceneDocument): void;
  stageBodyPose(bodyId: string, patch: {readonly translationMM: readonly [number, number, number]; readonly scale: readonly [number, number, number]}): void;
  setBodyPoseInputInvalid(bodyId: string): void;
  stageLighting(lighting: MeshLighting): void;
  setLightingInputInvalid(invalid: boolean): void;
  prepareDraft(): RenderNativeScenePreparedCandidate;
  prepareOpen(text: string): RenderNativeScenePreparedCandidate;
  prepareUndo(): RenderNativeScenePreparedCandidate | null;
  prepareRedo(): RenderNativeScenePreparedCandidate | null;
  commitPrepared(candidate: RenderNativeScenePreparedCandidate, beforeCommit?: NativeScenePresenter): RenderNativeSceneAppearancePreparation;
  discardDraft(): void;
  markSaved(revision: number): void;
  observeView(camera: MeshCamera): void;
  applyCamera(): RenderNativeSceneAppearancePreparation;
  restoreAccepted(): RenderNativeSceneAppearancePreparation;
  beginBodyPosePreview(bodyId: string): object;
  previewBodyPose(token: object, pose: RenderNativeScenePose): void;
  applyBodyPosePreview(token: object): RenderNativeSceneAppearancePreparation | null;
  cancelBodyPosePreview(token: object): RenderNativeSceneAppearancePreparation | null;
  dispose(): void;
}

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new RenderEditorError('DOCUMENT_INPUT', message);
}
function caused(cause: unknown): RenderEditorError {
  const error = normalizeRenderEditorError(cause, 'PRESENTATION_REFUSED');
  if (error !== cause) Object.defineProperty(error, 'cause', {value: cause, configurable: true});
  return error;
}
const ASYNC_FUNCTION = Object.getPrototypeOf(async function () {});
const ASYNC_GENERATOR = Object.getPrototypeOf(async function* () {});
function synchronous<Args extends unknown[]>(callback: (...args: Args) => void, ...args: Args): void {
  check(typeof callback === 'function', 'Native scene callback must be synchronous.');
  const prototype = Object.getPrototypeOf(callback), source = Function.prototype.toString.call(callback);
  check(prototype !== ASYNC_FUNCTION && prototype !== ASYNC_GENERATOR && !/^async(?:\s|\(|\/)/.test(source), 'Async native scene callbacks are not supported.');
  const result: unknown = callback(...args);
  check(result === null || typeof result !== 'object' && typeof result !== 'function'
    || typeof Reflect.get(result, 'then') !== 'function', 'Native scene callback must not return a thenable.');
}
function sameCamera(a: MeshCamera, b: MeshCamera): boolean {
  return a.eye.every((value, index) => value === b.eye[index])
    && a.target.every((value, index) => value === b.target[index])
    && a.up.every((value, index) => value === b.up[index])
    && a.fovYDegrees === b.fovYDegrees && a.near === b.near && a.far === b.far;
}
function cameraCopy(input: MeshCamera): MeshCamera {
  const camera = validateMeshCamera(input);
  Object.freeze(camera.eye); Object.freeze(camera.target); Object.freeze(camera.up);
  return Object.freeze(camera);
}
function samePose(a: RenderNativeScenePose, b: RenderNativeScenePose): boolean {
  return a.bodyId === b.bodyId && a.translationMM.every((value, index) => value === b.translationMM[index])
    && a.rotationXYZW.every((value, index) => value === b.rotationXYZW[index])
    && a.scale.every((value, index) => value === b.scale[index]);
}
function bodyPoseFields(input: unknown): {translationMM: readonly [number, number, number]; scale: readonly [number, number, number]} {
  check(input !== null && typeof input === 'object' && !Array.isArray(input)
    && [Object.prototype, null].includes(Object.getPrototypeOf(input)), 'Body fields require ordinary own data.');
  const keys = Reflect.ownKeys(input);
  check(keys.length === 2 && keys.every(key => key === 'translationMM' || key === 'scale'), 'Body fields require Position and Scale only.');
  const vector = (key: 'translationMM' | 'scale', minimum: number, maximum: number): readonly [number, number, number] => {
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    check(descriptor && 'value' in descriptor && descriptor.enumerable, 'Body fields refuse hidden fields and accessors.');
    const value: unknown = descriptor.value;
    check(Array.isArray(value) && Object.getPrototypeOf(value) === Array.prototype, 'Body fields require ordinary XYZ arrays.');
    const length = Object.getOwnPropertyDescriptor(value, 'length');
    check(length && 'value' in length && length.value === 3, 'Body fields require three XYZ values.');
    const fields = Reflect.ownKeys(value);
    check(fields.length === 4 && fields.every(field => field === 'length' || field === '0' || field === '1' || field === '2'), 'Body fields refuse extra array fields.');
    return Object.freeze([0, 1, 2].map(index => {
      const item = Object.getOwnPropertyDescriptor(value, String(index));
      check(item && 'value' in item && item.enumerable && typeof item.value === 'number'
        && Number.isFinite(item.value) && item.value >= minimum && item.value <= maximum, 'Check the finite Position or positive Scale values.');
      return item.value as number;
    }) as [number, number, number]);
  };
  return {translationMM: vector('translationMM', -10000, 10000), scale: vector('scale', .001, 100)};
}
function selectedMaterial(preparation: RenderNativeScenePreparation, bodyId: string) {
  const material = preparation.materials.find(item => item.target.bodyId === bodyId) ?? preparation.materials[0];
  check(material, 'This editor requires an authored material on a visible native Surface.');
  return material;
}

/** Viewer background is constructor-owned; numeric zero and negative zero share the same display context. */
export function assertNativeScenePreviewContext(context: RenderNativeSceneAppearancePreparation['context'],
  actualScale: number, actualBackground: readonly number[]): void {
  if (context.mmToSceneUnit !== actualScale || actualBackground.length !== 3
    || context.background.length !== 3 || !context.background.every((value, index) => value === actualBackground[index])) {
    throw new RenderEditorError('PRESENTATION_REFUSED', 'This scene uses a different preview scale or background. The current scene is kept.');
  }
}

/** App composition only. Whole native candidates and history remain the SDK session's authority. */
export function createNativeSceneHost(base: RenderNativeSceneDocument): NativeSceneHost {
  const native = createRenderNativeSceneSession(base);
  let selectedBodyId = selectedMaterial(native.getSnapshot().preparation, '').target.bodyId;
  let local = createRenderMaterialSession(selectedMaterial(native.getSnapshot().preparation, selectedBodyId).preparation.document);
  let draftDocument = native.getSnapshot().accepted, invalidLighting = false;
  let invalidBodyPoseBodyId: string | null = null, bodyPoseInputResetEpoch = 0;
  let viewCamera: MeshCamera | null = null, presenter: NativeScenePresenter | null = null, available = false;
  let disposed = false, locked = false, reentered = false, generation = 0;
  let ownershipReader: (() => object) | undefined, fallbackOwner: object = Object.freeze({});
  let acceptedOwner: object = fallbackOwner;
  interface BodyPoseState {
    token: object;
    native: ReturnType<typeof native.getSnapshot>;
    material: RenderMaterialSessionSnapshot;
    accepted: RenderNativeSceneDocument;
    bodyId: string;
    original: RenderNativeScenePose;
    presenter: NativeScenePresenter;
    reader: (() => object) | undefined;
    owner: object;
    generation: number;
    gestureActive: boolean;
    preview: Readonly<{bodyId: string; pose: RenderNativeScenePose}> | null;
    document: RenderNativeSceneDocument | null;
    failure: RenderEditorError | null;
    used: boolean;
  }
  const poseTokens = new WeakMap<object, BodyPoseState>();
  let bodyPose: BodyPoseState | null = null;
  const listeners = new Set<() => void>();
  const candidates = new WeakMap<object, {generation: number; used: boolean}>();
  const materialCandidates = new WeakMap<object, {candidate: RenderNativeScenePreparedCandidate; generation: number; used: boolean}>();
  let snapshot: NativeSceneHostSnapshot, materialSnapshot: RenderMaterialSessionSnapshot;
  const assertMutable = () => {
    if (disposed) throw new RenderEditorError('DISPOSED', 'Native scene host is disposed.');
    if (locked) {reentered = true; throw new RenderEditorError('STALE_CANDIDATE', 'Native scene host is busy.');}
  };
  const noView = () => {
    if (bodyPose) throw new RenderEditorError('STALE_CANDIDATE', 'Finish or cancel the body transform before editing the scene.');
    if (viewCamera) throw new RenderEditorError('STALE_CANDIDATE', 'Use or Restore the view before editing the scene.');
  };
  const readSnapshots = () => {
    const state = native.getSnapshot(), raw = local.getSnapshot();
    const selected = selectedMaterial(state.preparation, selectedBodyId);
    const dirty = state.dirty || raw.dirty || invalidLighting || invalidBodyPoseBodyId !== null || viewCamera !== null || bodyPose !== null;
    materialSnapshot = Object.freeze({...raw, accepted: selected.preparation.document, sample: selected.preparation.sample,
      dirty, canUndo: state.canUndo, canRedo: state.canRedo, disposed,
      savedRevision: state.savedRevision === state.accepted.revision ? selected.preparation.document.revision : null});
    snapshot = Object.freeze({accepted: state.accepted, preparation: state.preparation, draftDocument, selectedBodyId,
      targets: Object.freeze(state.preparation.materials.map(item => Object.freeze({bodyId: item.target.bodyId,
        modelId: item.ref.modelId, surfaceId: item.ref.surfaceId,
        title: state.accepted.nativeDocument.bodies.find(body => body.id === item.target.bodyId)?.name ?? item.preparation.document.title}))),
      dirty, nativeDirty: state.dirty, materialDirty: raw.dirty, invalidLighting, viewCamera, viewDirty: viewCamera !== null,
      invalidBodyPose: invalidBodyPoseBodyId !== null, invalidBodyPoseBodyId, bodyPoseInputResetEpoch,
      poseGestureActive: bodyPose?.gestureActive ?? false, posePreview: bodyPose?.preview ?? null,
      available, canUndo: state.canUndo, canRedo: state.canRedo, savedRevision: state.savedRevision, disposed});
  };
  const changed = (ownPose?: BodyPoseState) => {
    generation++; if (ownPose) ownPose.generation = generation; readSnapshots();
    for (const listener of [...listeners]) {try {listener();} catch { /* Completed state is not rolled back by observers. */ }}
  };
  const run = <T,>(operation: () => T): T => {
    assertMutable(); locked = true; reentered = false;
    try {return operation();} catch (cause) {throw caused(cause);} finally {locked = false;}
  };
  const subscribe = (listener: () => void) => {
    assertMutable(); check(typeof listener === 'function', 'Native scene listener must be a function.');
    listeners.add(listener);
    return () => {if (locked) {reentered = true; throw new RenderEditorError('STALE_CANDIDATE', 'Native scene listener changes are locked.');} listeners.delete(listener);};
  };
  const clean = () => {check(!snapshot.dirty, 'Apply or Discard scene changes before this action.');};
  const readOwner = (reader: (() => object) | undefined, fallback: object): object => {
    if (!reader) return fallback;
    const prototype = Object.getPrototypeOf(reader), source = Function.prototype.toString.call(reader);
    check(prototype !== ASYNC_FUNCTION && prototype !== ASYNC_GENERATOR && !/^async(?:\s|\(|\/)/.test(source), 'Preview ownership must be synchronous.');
    let result: object | undefined;
    synchronous(() => {result = reader();});
    check(result !== null && typeof result === 'object' && typeof Reflect.get(result, 'then') !== 'function', 'Preview ownership requires a synchronous object token.');
    return result;
  };
  const owner = (): object => readOwner(ownershipReader, fallbackOwner);
  const presented = (active: NativeScenePresenter, prepared: RenderNativeSceneAppearancePreparation) => {
    synchronous(active, prepared); fallbackOwner = Object.freeze({});
  };
  const closePose = (state: BodyPoseState) => {
    state.used = true; state.gestureActive = false; if (bodyPose === state) bodyPose = null;
  };
  const invalidatePose = () => {if (bodyPose) closePose(bodyPose);};
  const currentPose = (input: object): BodyPoseState => {
    const state = input !== null && typeof input === 'object' ? poseTokens.get(input) : undefined;
    if (!state || state.used || bodyPose !== state) throw new RenderEditorError('STALE_CANDIDATE', 'The body transform token is stale, foreign, forged, or already used.');
    const fresh = !disposed && available && presenter === state.presenter && ownershipReader === state.reader
      && native.getSnapshot() === state.native && local.getSnapshot() === state.material
      && native.getSnapshot().accepted === state.accepted && selectedBodyId === state.bodyId
      && generation === state.generation && viewCamera === null;
    if (!fresh || owner() !== state.owner) {
      closePose(state); changed();
      throw new RenderEditorError('STALE_CANDIDATE', 'The scene or preview owner changed. Start a new body transform.');
    }
    if (reentered) throw new RenderEditorError('STALE_CANDIDATE', 'Preview ownership reentry was refused.');
    return state;
  };
  const poseDocument = (state: BodyPoseState, pose: RenderNativeScenePose): RenderNativeSceneDocument => {
    const descriptor = pose !== null && typeof pose === 'object' ? Object.getOwnPropertyDescriptor(pose, 'bodyId') : undefined;
    check(descriptor && 'value' in descriptor && descriptor.enumerable && descriptor.value === state.bodyId, 'Transform only the captured original body.');
    const original = state.accepted, poses = original.display.poses.length ? original.display.poses
      : state.native.preparation.entries.map(entry => ({bodyId: entry.binding.bodyId,
        translationMM: [0, 0, 0] as const, rotationXYZW: [0, 0, 0, 1] as const, scale: [1, 1, 1] as const}));
    return {...original, display: {...original.display, poses: poses.map(value => value.bodyId === state.bodyId ? pose : value)}};
  };
  const restorePose = (state: BodyPoseState): RenderNativeSceneAppearancePreparation | null => {
    if (!state.preview) return null;
    const prepared = prepareRenderNativeSceneAppearance(state.accepted);
    currentPose(state.token);
    presented(state.presenter, prepared);
    state.owner = owner();
    if (reentered) throw new RenderEditorError('STALE_CANDIDATE', 'Native body presenter reentry was refused.');
    acceptedOwner = state.owner;
    state.preview = null; state.document = null; state.failure = null;
    return prepared;
  };
  const cancelPose = (input: object): RenderNativeSceneAppearancePreparation | null => {
    const state = currentPose(input); state.gestureActive = false;
    try {const result = restorePose(state); closePose(state); changed(); return result;}
    catch (cause) {
      if (bodyPose === state) changed(state);
      throw cause;
    }
  };
  const stage = (input: RenderNativeSceneDocument) => {
    const document = validateRenderNativeSceneDocument(input), accepted = native.getSnapshot().accepted;
    check(document.documentId === accepted.documentId && document.revision === accepted.revision, 'The draft must keep the current scene ID and revision.');
    const text = serializeRenderNativeSceneDocument(document);
    native.setDraftText(text); draftDocument = document;
  };
  const withMaterial = (document: RenderMaterialSessionSnapshot['accepted']) => {
    check(draftDocument.surfaceMaterials.some(item => item.target.bodyId === selectedBodyId), 'The selected Surface is absent from the staged scene.');
    return {...draftDocument, surfaceMaterials: draftDocument.surfaceMaterials.map(item => item.target.bodyId === selectedBodyId
      ? {...item, material: document} : item)};
  };
  const stageValidMaterial = () => {
    const raw = local.getSnapshot();
    if (raw.diagnostics.length) return;
    const material = prepareRenderMaterialDocument({...raw.accepted, shaderSource: raw.draftSource, uniforms: raw.draftUniforms});
    stage(withMaterial(material.document));
  };
  const issue = (candidate: RenderNativeScenePreparedCandidate | null) => {
    if (candidate) candidates.set(candidate, {generation, used: false});
    return candidate;
  };
  const prepareDraft = () => {
    check(invalidBodyPoseBodyId === null, 'Correct the body Position and Scale values before Apply.');
    check(!invalidLighting, 'Correct the lighting values before Apply.');
    const raw = local.getSnapshot();
    if (raw.dirty) {stage(withMaterial(local.prepareDraft().document)); changed();}
    return issue(native.prepareDraft())!;
  };
  const materialCandidate = (candidate: RenderNativeScenePreparedCandidate | null): RenderMaterialPreparedCandidate | null => {
    if (!candidate) return null;
    const selected = selectedMaterial(candidate.preparation, selectedBodyId);
    const result = Object.freeze({document: selected.preparation.document, sample: selected.preparation.sample, purpose: candidate.purpose});
    materialCandidates.set(result, {candidate, generation, used: false}); return result;
  };
  const commit = (candidate: RenderNativeScenePreparedCandidate, beforeCommit?: NativeScenePresenter) => {
    const token = candidate !== null && typeof candidate === 'object' ? candidates.get(candidate) : undefined;
    if (!token || token.used || token.generation !== generation) throw new RenderEditorError('STALE_CANDIDATE', 'The scene candidate is stale, foreign, forged, or already used.');
    check(available && presenter, 'The native preview is unavailable.');
    const active = presenter;
    const nextStore: {local: RenderMaterialSession | null; owner: object | null} = {local: null, owner: null};
    let nextBody = selectedBodyId;
    try {
      const result = commitRenderNativeSceneAppearanceCandidate(native, candidate, prepared => {
        const selected = selectedMaterial(prepared.authored, selectedBodyId);
        nextBody = selected.target.bodyId;
        nextStore.local = createRenderMaterialSession(selected.preparation.document);
        if (beforeCommit) synchronous(beforeCommit, prepared);
        if (reentered) throw new RenderEditorError('STALE_CANDIDATE', 'Native scene callback reentry was refused.');
        presented(active, prepared);
        nextStore.owner = owner();
        if (reentered) throw new RenderEditorError('STALE_CANDIDATE', 'Native scene presenter reentry was refused.');
      });
      token.used = true;
      acceptedOwner = nextStore.owner!;
      local.dispose(); local = nextStore.local!; nextStore.local = null;
      selectedBodyId = nextBody; draftDocument = native.getSnapshot().accepted;
      invalidLighting = false; invalidBodyPoseBodyId = null; bodyPoseInputResetEpoch++; viewCamera = null; changed(); return result;
    } finally {nextStore.local?.dispose();}
  };
  const restore = () => {
    check(available && presenter, 'The native preview is unavailable.');
    const result = prepareRenderNativeSceneAppearance(native.getSnapshot().accepted);
    presented(presenter, result);
    const nextOwner = owner();
    if (reentered) throw new RenderEditorError('STALE_CANDIDATE', 'Native scene presenter reentry was refused.');
    acceptedOwner = nextOwner;
    viewCamera = null; return result;
  };
  const materialSession: RenderMaterialSession = Object.freeze({
    getSnapshot: () => materialSnapshot,
    subscribe,
    setDraftSource(source: string) {run(() => {noView(); local.setDraftSource(source); try {stageValidMaterial();} finally {changed();}});},
    setDraftUniforms(uniforms: Readonly<Record<string, number>>) {run(() => {noView(); local.setDraftUniforms(uniforms); try {stageValidMaterial();} finally {changed();}});},
    prepareDraft: () => run(() => {noView(); return materialCandidate(prepareDraft())!;}),
    prepareOpen: (text: string) => run(() => {noView(); clean(); return materialCandidate(issue(native.prepareOpen(text)))!;}),
    prepareUndo: () => run(() => {noView(); clean(); return materialCandidate(issue(native.prepareUndo()));}),
    prepareRedo: () => run(() => {noView(); clean(); return materialCandidate(issue(native.prepareRedo()));}),
    commitPrepared(candidate: RenderMaterialPreparedCandidate, beforeCommit?: () => void) {
      run(() => {noView();
        const token = candidate !== null && typeof candidate === 'object' ? materialCandidates.get(candidate) : undefined;
        if (!token || token.used || token.generation !== generation) throw new RenderEditorError('STALE_CANDIDATE', 'The material view candidate is stale, foreign, forged, or already used.');
        commit(token.candidate, beforeCommit === undefined ? undefined : () => synchronous(beforeCommit)); token.used = true;
      });
    },
    discardDraft: () => host.discardDraft(),
    markSaved(revision: number) {run(() => {noView(); check(revision === materialSnapshot.accepted.revision, 'The saved material revision changed.'); native.markSaved(native.getSnapshot().accepted.revision); changed();});},
    dispose: () => host.dispose(),
  });
  const host: NativeSceneHost = {
    materialSession, getSnapshot: () => snapshot, subscribe,
    selectTarget(bodyId) {run(() => {
      check(!bodyPose && available, 'Finish the body transform or restore the preview before changing the active body.');
      check(!native.getSnapshot().dirty && !local.getSnapshot().dirty && !invalidLighting && invalidBodyPoseBodyId === null, 'Apply or Discard authored drafts before changing the active body.');
      check(typeof bodyId === 'string' && snapshot.targets.some(item => item.bodyId === bodyId), 'Choose an authored visible Surface material.');
      if (bodyId === selectedBodyId) return;
      const selected = selectedMaterial(native.getSnapshot().preparation, bodyId);
      const next = createRenderMaterialSession(selected.preparation.document); local.dispose(); local = next; selectedBodyId = bodyId; changed();});},
    setPresenter(next, reader) {run(() => {check(next === null || typeof next === 'function', 'Native presenter must be a function or null.'); check(reader === undefined || typeof reader === 'function', 'Preview ownership reader must be a function.');
      if (next !== null && bodyPose) noView(); else if (next === null) invalidatePose();
      const nextFallback = Object.freeze({}), nextOwner = next === null ? nextFallback : readOwner(reader, nextFallback);
      if (reentered) throw new RenderEditorError('STALE_CANDIDATE', 'Preview ownership reentry was refused.');
      presenter = next; ownershipReader = reader; fallbackOwner = nextFallback; acceptedOwner = nextOwner; available = next !== null; changed();});},
    setAvailable(value) {run(() => {check(typeof value === 'boolean', 'Native availability must be a boolean.'); if (!value) invalidatePose(); if (available !== value) {available = value; changed();}});},
    stageSceneDocument(document) {run(() => {noView(); clean(); stage(document); changed();});},
    stageBodyPose(bodyId, patch) {run(() => {
      noView(); check(available, 'The native preview is unavailable.');
      check(typeof bodyId === 'string' && bodyId === selectedBodyId
        && snapshot.preparation.materials.some(value => value.target.bodyId === bodyId)
        && snapshot.preparation.entries.some(value => value.kind === 'surface' && value.binding.bodyId === bodyId)
        && draftDocument.display.visibleBodyIds.includes(bodyId), 'Edit the selected visible Surface body.');
      check(invalidBodyPoseBodyId === null || invalidBodyPoseBodyId === bodyId, 'Correct the body with incomplete Position or Scale values.');
      const fields = bodyPoseFields(patch), original = draftDocument.display.poses.find(value => value.bodyId === bodyId)
        ?? {bodyId, translationMM: [0, 0, 0] as const, rotationXYZW: [0, 0, 0, 1] as const, scale: [1, 1, 1] as const};
      const sameValue = draftDocument.display.poses.length === 0
        ? (value: number, current: number) => value === current : Object.is;
      const unchanged = fields.translationMM.every((value, index) => sameValue(value, original.translationMM[index]!))
        && fields.scale.every((value, index) => sameValue(value, original.scale[index]!));
      const poses = unchanged ? draftDocument.display.poses : (draftDocument.display.poses.length ? draftDocument.display.poses
        : snapshot.preparation.entries.map(entry => ({bodyId: entry.binding.bodyId, translationMM: [0, 0, 0] as const,
          rotationXYZW: [0, 0, 0, 1] as const, scale: [1, 1, 1] as const}))).map(value => value.bodyId === bodyId
          ? {...value, translationMM: fields.translationMM, scale: fields.scale} : value);
      const document = unchanged ? draftDocument : {...draftDocument, display: {...draftDocument.display, poses}};
      prepareRenderNativeSceneAppearance(document);
      if (reentered) throw new RenderEditorError('STALE_CANDIDATE', 'Body field preparation reentry was refused.');
      if (!unchanged) stage(document);
      const corrected = invalidBodyPoseBodyId === bodyId;
      if (corrected) invalidBodyPoseBodyId = null;
      if (!unchanged || corrected) changed();
    });},
    setBodyPoseInputInvalid(bodyId) {run(() => {
      noView(); check(available, 'The native preview is unavailable.');
      check(typeof bodyId === 'string' && bodyId === selectedBodyId
        && snapshot.preparation.materials.some(value => value.target.bodyId === bodyId)
        && snapshot.preparation.entries.some(value => value.kind === 'surface' && value.binding.bodyId === bodyId)
        && draftDocument.display.visibleBodyIds.includes(bodyId), 'Correct the selected visible Surface body.');
      check(invalidBodyPoseBodyId === null || invalidBodyPoseBodyId === bodyId, 'Correct the body with incomplete Position or Scale values.');
      if (invalidBodyPoseBodyId !== bodyId) {invalidBodyPoseBodyId = bodyId; changed();}
    });},
    stageLighting(lighting) {run(() => {noView(); stage({...draftDocument, display: {...draftDocument.display, lighting}}); invalidLighting = false; changed();});},
    setLightingInputInvalid(value) {run(() => {noView(); check(typeof value === 'boolean', 'Lighting validity requires a boolean.'); if (invalidLighting !== value) {invalidLighting = value; changed();}});},
    prepareDraft: () => run(() => {noView(); return prepareDraft();}),
    prepareOpen: text => run(() => {noView(); clean(); return issue(native.prepareOpen(text))!;}),
    prepareUndo: () => run(() => {noView(); clean(); return issue(native.prepareUndo());}),
    prepareRedo: () => run(() => {noView(); clean(); return issue(native.prepareRedo());}),
    commitPrepared: (candidate, beforeCommit) => run(() => {noView(); return commit(candidate, beforeCommit);}),
    discardDraft() {run(() => {if (bodyPose) noView(); if (viewCamera) restore(); native.discardDraft(); local.discardDraft(); draftDocument = native.getSnapshot().accepted; invalidLighting = false; invalidBodyPoseBodyId = null; bodyPoseInputResetEpoch++; changed();});},
    markSaved(revision) {run(() => {noView(); native.markSaved(revision); changed();});},
    observeView(camera) {run(() => {const next = cameraCopy(camera), accepted = native.getSnapshot().accepted.display.camera;
      check(invalidBodyPoseBodyId === null || sameCamera(next, accepted), 'Correct the body Position and Scale values before changing the view.');
      if (bodyPose) {check(sameCamera(next, accepted), 'The camera changed during the body transform. Cancel the transform first.'); return;}
      const pending = sameCamera(next, accepted) ? null : next;
      if (pending === null ? viewCamera !== null : viewCamera === null || !sameCamera(pending, viewCamera)) {viewCamera = pending; changed();}});},
    applyCamera() {return run(() => {if (bodyPose) noView(); check(invalidBodyPoseBodyId === null, 'Correct the body Position and Scale values before using the view.'); check(viewCamera, 'There is no view change to use.'); stage({...draftDocument, display: {...draftDocument.display, camera: viewCamera}}); changed(); return commit(prepareDraft());});},
    restoreAccepted() {return run(() => {if (bodyPose) {const result = cancelPose(bodyPose.token); if (result) return result;} const result = restore(); changed(); return result;});},
    beginBodyPosePreview(bodyId) {return run(() => {
      noView(); clean(); check(available && presenter, 'The native preview is unavailable.');
      const baseline = native.getSnapshot(), material = local.getSnapshot();
      check(typeof bodyId === 'string' && bodyId === selectedBodyId && baseline.preparation.materials.some(value => value.target.bodyId === bodyId)
        && baseline.preparation.entries.some(value => value.kind === 'surface' && value.binding.bodyId === bodyId)
        && baseline.accepted.display.visibleBodyIds.includes(bodyId), 'Transform the selected applied visible Surface body.');
      const original = baseline.accepted.display.poses.find(value => value.bodyId === bodyId) ?? Object.freeze({bodyId,
        translationMM: Object.freeze([0, 0, 0] as const), rotationXYZW: Object.freeze([0, 0, 0, 1] as const), scale: Object.freeze([1, 1, 1] as const)});
      const token = Object.freeze({});
      const currentOwner = owner();
      if (currentOwner !== acceptedOwner) throw new RenderEditorError('STALE_CANDIDATE', 'The applied preview belongs to another scene. Restore the current scene before transforming.');
      const state: BodyPoseState = {token, native: baseline, material, accepted: baseline.accepted, bodyId, original,
        presenter, reader: ownershipReader, owner: currentOwner, generation, gestureActive: true, preview: null, document: null, failure: null, used: false};
      if (reentered) throw new RenderEditorError('STALE_CANDIDATE', 'Preview ownership reentry was refused.');
      bodyPose = state; poseTokens.set(token, state); changed(state); return token;
    });},
    previewBodyPose(input, pose) {run(() => {
      const state = currentPose(input); check(state.gestureActive, 'The body gesture has ended. Cancel the pending preview.');
      try {
        const prepared = prepareRenderNativeSceneAppearance(poseDocument(state, pose));
        const actual = prepared.authored.document.display.poses.find(value => value.bodyId === state.bodyId)!;
        const original = samePose(actual, state.original);
        currentPose(input);
        if (reentered) throw new RenderEditorError('STALE_CANDIDATE', 'Body pose preparation reentry was refused.');
        if (original) {
          restorePose(state); state.failure = null; changed(state); return;
        }
        presented(state.presenter, prepared); state.owner = owner();
        if (reentered) throw new RenderEditorError('STALE_CANDIDATE', 'Native body presenter reentry was refused.');
        state.preview = Object.freeze({bodyId: state.bodyId, pose: actual}); state.document = prepared.authored.document; state.failure = null;
        changed(state);
      } catch (cause) {state.failure = caused(cause); throw cause;}
    });},
    applyBodyPosePreview(input) {return run(() => {
      const state = currentPose(input); state.gestureActive = false;
      if (state.failure) {if (!state.preview) closePose(state); changed(bodyPose === state ? state : undefined); throw state.failure;}
      if (!state.document) {closePose(state); changed(); return null;}
      const document = state.document;
      try {restorePose(state);} catch (cause) {if (bodyPose === state) changed(state); throw cause;}
      closePose(state);
      try {stage(document); changed(); return commit(prepareDraft());}
      catch (cause) {changed(); throw cause;}
    });},
    cancelBodyPosePreview: input => run(() => cancelPose(input)),
    dispose() {if (disposed) return; run(() => {invalidatePose(); native.dispose(); local.dispose(); presenter = null; ownershipReader = undefined; available = false; disposed = true; viewCamera = null; changed(); listeners.clear();});},
  };
  readSnapshots(); return Object.freeze(host);
}
