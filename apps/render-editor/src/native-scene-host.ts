import {createRenderNativeSceneSession, createRenderMaterialSession, prepareRenderMaterialDocument,
  validateRenderNativeSceneDocument, serializeRenderNativeSceneDocument, prepareRenderNativeSceneAppearance,
  commitRenderNativeSceneAppearanceCandidate, deriveRenderNativeSceneBodyDuplicate, deriveRenderNativeSceneBodyRemoval, deriveRenderNativeSceneSurfaceAddition, deriveRenderNativeSceneSurfacePoleEdit, RenderEditorError, normalizeRenderEditorError} from '@barocss/render-editor';
import type {RenderNativeSceneDocument, RenderNativeScenePreparation, RenderNativeScenePreparedCandidate,
  RenderNativeSceneAppearancePreparation, RenderMaterialSession, RenderMaterialSessionSnapshot,
  RenderMaterialPreparedCandidate, RenderNativeScenePose, RenderNativeSceneSurfacePolePatch} from '@barocss/render-editor';
import {validateMeshCamera} from '@barocss/gpu';
import type {MeshCamera, MeshLighting} from '@barocss/gpu';

export type NativeScenePresenter = (prepared: RenderNativeSceneAppearancePreparation, cameraOverride?: MeshCamera) => void;
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
  readonly invalidSurfacePole: boolean;
  readonly surfacePoleBodyId: string | null;
  readonly surfacePoleDraftActive: boolean;
  readonly surfacePoleInputResetEpoch: number;
  readonly selectedSurfacePole: Readonly<{bodyId: string; uIndex: number; vIndex: number}>;
  readonly surfacePoleGestureActive: boolean;
  readonly surfacePolePreview: Readonly<{bodyId: string; patch: RenderNativeSceneSurfacePolePatch}> | null;
  readonly surfacePoleDraftPatch: RenderNativeSceneSurfacePolePatch | null;
  readonly viewCamera: MeshCamera | null;
  readonly viewDirty: boolean;
  readonly poseGestureActive: boolean;
  readonly posePreview: Readonly<{bodyId: string; pose: RenderNativeScenePose}> | null;
  readonly materialPreview: Readonly<{bodyId: string; materialDocumentId: string}> | null;
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
  setPresenter(presenter: NativeScenePresenter | null, ownershipReader?: () => object, actualCameraReader?: () => MeshCamera): void;
  setAvailable(available: boolean): void;
  stageSceneDocument(document: RenderNativeSceneDocument): void;
  addSurface(source: string, surfaceId: string): RenderNativeSceneAppearancePreparation;
  duplicateSelectedBody(): RenderNativeSceneAppearancePreparation;
  removeSelectedBody(): RenderNativeSceneAppearancePreparation;
  stageBodyPose(bodyId: string, patch: {readonly translationMM: readonly [number, number, number]; readonly scale: readonly [number, number, number]}): void;
  setBodyPoseInputInvalid(bodyId: string): void;
  stageSurfacePoleEdit(bodyId: string, patch: RenderNativeSceneSurfacePolePatch): void;
  setSurfacePoleInputInvalid(bodyId: string, uIndex: number, vIndex: number): void;
  selectSurfacePole(uIndex: number, vIndex: number): void;
  beginSurfacePoleDrag(bodyId: string, uIndex: number, vIndex: number): object;
  previewSurfacePoleDrag(token: object, patch: RenderNativeSceneSurfacePolePatch): RenderNativeSceneAppearancePreparation;
  finishSurfacePoleDrag(token: object, patch: RenderNativeSceneSurfacePolePatch): RenderNativeSceneAppearancePreparation | null;
  cancelSurfacePoleDrag(token: object): void;
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
  getDisplayCamera(): MeshCamera;
  resetViewportCamera(): void;
  applyCamera(): RenderNativeSceneAppearancePreparation;
  restoreAccepted(): RenderNativeSceneAppearancePreparation;
  beginBodyPosePreview(bodyId: string): object;
  previewBodyPose(token: object, pose: RenderNativeScenePose): void;
  applyBodyPosePreview(token: object): RenderNativeSceneAppearancePreparation | null;
  cancelBodyPosePreview(token: object): RenderNativeSceneAppearancePreparation | null;
  beginMaterialPreview(): object;
  cancelMaterialPreview(token: object): void;
  applyMaterialPreview(token: object): RenderNativeSceneAppearancePreparation;
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
function documentIds(document: RenderNativeSceneDocument): Set<string> {
  return new Set([...document.nativeDocument.assets.map(asset => asset.id),
    ...document.nativeDocument.bodies.map(body => body.id),
    ...document.surfaceMaterials.map(binding => binding.material.documentId)]);
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
  let retainedIds = documentIds(native.getSnapshot().accepted);
  let selectedBodyId = selectedMaterial(native.getSnapshot().preparation, '').target.bodyId;
  let local = createRenderMaterialSession(selectedMaterial(native.getSnapshot().preparation, selectedBodyId).preparation.document);
  let draftDocument = native.getSnapshot().accepted, invalidLighting = false;
  let invalidBodyPoseBodyId: string | null = null, bodyPoseInputResetEpoch = 0;
  let invalidSurfacePole = false, surfacePoleInputResetEpoch = 0;
  let surfacePole: {bodyId: string; uIndex: number; vIndex: number} | null = null;
  let selectedPole = {bodyId: selectedBodyId, uIndex: 0, vIndex: 0};
  let surfacePoleDraftPatch: RenderNativeSceneSurfacePolePatch | null = null;
  interface PoleDrag {
    token: object; native: ReturnType<typeof native.getSnapshot>; material: RenderMaterialSessionSnapshot;
    selection: typeof selectedPole; camera: MeshCamera; owner: object; generation: number; used: boolean;
    presenter: NativeScenePresenter; reader: (() => object) | undefined; cameraReader: (() => MeshCamera) | undefined;
    gestureActive: boolean; document: RenderNativeSceneDocument | null;
    patch: RenderNativeSceneSurfacePolePatch | null; failure: RenderEditorError | null;
  }
  let poleDrag: PoleDrag | null = null;
  const poleDragTokens = new WeakMap<object, PoleDrag>();
  let viewCamera: MeshCamera | null = null, presenter: NativeScenePresenter | null = null, available = false;
  let disposed = false, locked = false, reentered = false, generation = 0;
  let ownershipReader: (() => object) | undefined, fallbackOwner: object = Object.freeze({});
  let actualCameraReader: (() => MeshCamera) | undefined, nativePresented = false;
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
    cameraReader: (() => MeshCamera) | undefined;
    camera: MeshCamera;
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
  interface MaterialPreviewState {
    token: object; native: ReturnType<typeof native.getSnapshot>; material: RenderMaterialSessionSnapshot;
    draft: RenderNativeSceneDocument; document: RenderNativeSceneDocument; bodyId: string; materialDocumentId: string;
    camera: MeshCamera; localCamera: MeshCamera | null; owner: object; generation: number; used: boolean; presented: boolean;
    presenter: NativeScenePresenter; reader: (() => object) | undefined; cameraReader: (() => MeshCamera) | undefined;
  }
  let materialPreview: MaterialPreviewState | null = null;
  const materialPreviewTokens = new WeakMap<object, MaterialPreviewState>();
  const listeners = new Set<() => void>();
  const candidates = new WeakMap<object, {generation: number; used: boolean}>();
  const materialCandidates = new WeakMap<object, {candidate: RenderNativeScenePreparedCandidate; generation: number; used: boolean}>();
  let snapshot: NativeSceneHostSnapshot, materialSnapshot: RenderMaterialSessionSnapshot;
  const assertMutable = () => {
    if (disposed) throw new RenderEditorError('DISPOSED', 'Native scene host is disposed.');
    if (locked) {reentered = true; throw new RenderEditorError('STALE_CANDIDATE', 'Native scene host is busy.');}
  };
  const noView = () => {
    if (bodyPose || poleDrag || materialPreview) throw new RenderEditorError('STALE_CANDIDATE', 'Finish or cancel the Canvas transform before editing the scene.');
  };
  const readSnapshots = () => {
    const state = native.getSnapshot(), raw = local.getSnapshot();
    const selected = selectedMaterial(state.preparation, selectedBodyId);
    const dirty = state.dirty || raw.dirty || invalidLighting || invalidBodyPoseBodyId !== null || invalidSurfacePole || bodyPose !== null || poleDrag !== null || materialPreview !== null;
    materialSnapshot = Object.freeze({...raw, accepted: selected.preparation.document, sample: selected.preparation.sample,
      dirty, canUndo: state.canUndo, canRedo: state.canRedo, disposed,
      savedRevision: state.savedRevision === state.accepted.revision ? selected.preparation.document.revision : null});
    snapshot = Object.freeze({accepted: state.accepted, preparation: state.preparation, draftDocument, selectedBodyId,
      targets: Object.freeze(state.preparation.materials.map(item => Object.freeze({bodyId: item.target.bodyId,
        modelId: item.ref.modelId, surfaceId: item.ref.surfaceId,
        title: state.accepted.nativeDocument.bodies.find(body => body.id === item.target.bodyId)?.name ?? item.preparation.document.title}))),
      dirty, nativeDirty: state.dirty, materialDirty: raw.dirty, invalidLighting, viewCamera, viewDirty: viewCamera !== null,
      invalidBodyPose: invalidBodyPoseBodyId !== null, invalidBodyPoseBodyId, bodyPoseInputResetEpoch,
      invalidSurfacePole, surfacePoleBodyId: surfacePole?.bodyId ?? null, surfacePoleDraftActive: surfacePole !== null, surfacePoleInputResetEpoch,
      selectedSurfacePole: Object.freeze({...selectedPole}), surfacePoleGestureActive: poleDrag?.gestureActive ?? false,
      surfacePolePreview: poleDrag?.document && poleDrag.patch ? Object.freeze({bodyId: poleDrag.selection.bodyId, patch: poleDrag.patch}) : null, surfacePoleDraftPatch,
      poseGestureActive: bodyPose?.gestureActive ?? false, posePreview: bodyPose?.preview ?? null,
      materialPreview: materialPreview?.presented ? Object.freeze({bodyId: materialPreview.bodyId, materialDocumentId: materialPreview.materialDocumentId}) : null,
      available, canUndo: state.canUndo, canRedo: state.canRedo, savedRevision: state.savedRevision, disposed});
  };
  const changed = (ownPose?: {generation: number}) => {
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
  const retainedPlan = (document: RenderNativeSceneDocument, reset = false): Set<string> => {
    const plan = reset ? new Set<string>() : new Set(retainedIds);
    for (const id of documentIds(document)) plan.add(id);
    check(plan.size <= 2048, 'Native body ID reservations exceed the 2048-ID limit. Open a scene to start a new reservation scope.');
    return plan;
  };
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
  const displayCamera = (): MeshCamera => {
    if (!actualCameraReader) return cameraCopy(viewCamera ?? native.getSnapshot().accepted.display.camera);
    const prototype = Object.getPrototypeOf(actualCameraReader), source = Function.prototype.toString.call(actualCameraReader);
    check(prototype !== ASYNC_FUNCTION && prototype !== ASYNC_GENERATOR && !/^async(?:\s|\(|\/)/.test(source), 'Display camera reading must be synchronous.');
    let result: MeshCamera | undefined;
    synchronous(() => {result = actualCameraReader!();});
    const camera = cameraCopy(result!);
    if (reentered) throw new RenderEditorError('STALE_CANDIDATE', 'Display camera reader reentry was refused.');
    return camera;
  };
  const localView = (camera: MeshCamera) => {
    viewCamera = sameCamera(camera, native.getSnapshot().accepted.display.camera) ? null : camera;
  };
  const presented = (active: NativeScenePresenter, prepared: RenderNativeSceneAppearancePreparation, camera: MeshCamera) => {
    synchronous(active, prepared, camera); fallbackOwner = Object.freeze({});
  };
  const closePose = (state: BodyPoseState) => {
    state.used = true; state.gestureActive = false; if (bodyPose === state) bodyPose = null;
  };
  const invalidatePose = () => {if (bodyPose) closePose(bodyPose);};
  const currentPose = (input: object): BodyPoseState => {
    const state = input !== null && typeof input === 'object' ? poseTokens.get(input) : undefined;
    if (!state || state.used || bodyPose !== state) throw new RenderEditorError('STALE_CANDIDATE', 'The body transform token is stale, foreign, forged, or already used.');
    const fresh = !disposed && available && presenter === state.presenter && ownershipReader === state.reader && actualCameraReader === state.cameraReader
      && native.getSnapshot() === state.native && local.getSnapshot() === state.material
      && native.getSnapshot().accepted === state.accepted && selectedBodyId === state.bodyId
      && generation === state.generation;
    let cameraCurrent = false, ownerCurrent = false;
    try {cameraCurrent = sameCamera(displayCamera(), state.camera); ownerCurrent = owner() === state.owner;}
    catch (cause) {if (state.preview) available = false; closePose(state); changed(); throw cause;}
    if (!fresh || !cameraCurrent || !ownerCurrent) {
      if (state.preview) available = false;
      closePose(state); changed();
      throw new RenderEditorError('STALE_CANDIDATE', 'The scene, display camera, or preview owner changed. Reload or reopen the scene before transforming.');
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
    presented(state.presenter, prepared, state.camera);
    state.owner = owner();
    if (reentered) throw new RenderEditorError('STALE_CANDIDATE', 'Native body presenter reentry was refused.');
    acceptedOwner = state.owner;
    nativePresented = true; localView(state.camera);
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
  const poleSelection = (bodyId: string, uIndex: number, vIndex: number) => {
    noView(); check(available && !disposed, 'The original Surface preview is unavailable.');
    check(typeof bodyId === 'string' && bodyId === selectedBodyId
      && snapshot.preparation.materials.some(value => value.target.bodyId === bodyId)
      && snapshot.preparation.entries.some(value => value.kind === 'surface' && value.binding.bodyId === bodyId)
      && draftDocument.display.visibleBodyIds.includes(bodyId), 'Edit the selected visible original Surface.');
    check(Number.isInteger(uIndex) && !Object.is(uIndex, -0) && uIndex >= 0 && uIndex < 16
      && Number.isInteger(vIndex) && !Object.is(vIndex, -0) && vIndex >= 0 && vIndex < 16, 'Choose bounded original control-point indices.');
    check(surfacePole === null || surfacePole.bodyId === bodyId && surfacePole.uIndex === uIndex && surfacePole.vIndex === vIndex,
      'Apply or Discard the current control-point draft before changing points.');
    return {bodyId, uIndex, vIndex};
  };
  // These are already validated owned document snapshots, not arbitrary caller objects.
  const sameNative = (a: unknown, b: unknown): boolean => {
    if (Object.is(a, b)) return true;
    if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
    const left = Object.keys(a), right = Object.keys(b);
    return left.length === right.length && left.every(key => Object.hasOwn(b, key)
      && sameNative((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]));
  };
  const closeMaterialPreview = (state: MaterialPreviewState) => {
    state.used = true; if (materialPreview === state) materialPreview = null;
  };
  const invalidateMaterialPreview = () => {if (materialPreview) closeMaterialPreview(materialPreview);};
  const currentMaterialPreview = (token: object): MaterialPreviewState => {
    const state = token !== null && typeof token === 'object' ? materialPreviewTokens.get(token) : undefined;
    if (!state || state.used || materialPreview !== state) throw new RenderEditorError('STALE_CANDIDATE', 'The material preview token is stale, foreign, or already used.');
    try {
      check(!disposed && available && presenter === state.presenter && ownershipReader === state.reader
        && actualCameraReader === state.cameraReader && native.getSnapshot() === state.native
        && local.getSnapshot() === state.material && draftDocument === state.draft && viewCamera === state.localCamera
        && selectedBodyId === state.bodyId && generation === state.generation
        && sameCamera(displayCamera(), state.camera) && owner() === state.owner && !reentered,
      'The material draft, scene, camera, or displayed owner changed. Reopen the scene before previewing.');
      return state;
    } catch (cause) {if (state.presented) available = false; closeMaterialPreview(state); changed(); throw cause;}
  };
  const presentMaterialPreview = (state: MaterialPreviewState, prepared: RenderNativeSceneAppearancePreparation, preview: boolean) => {
    let returned = false;
    try {
      const prototype = Object.getPrototypeOf(state.presenter), source = Function.prototype.toString.call(state.presenter);
      check(prototype !== ASYNC_FUNCTION && prototype !== ASYNC_GENERATOR && !/^async(?:\s|\(|\/)/.test(source), 'Material presenter must be synchronous.');
      synchronous(() => {
        const result = state.presenter(prepared, state.camera);
        returned = true; state.presented = preview;
        return result;
      });
      fallbackOwner = Object.freeze({});
    } catch (cause) {
      let uncertain = returned || reentered;
      if (!uncertain) {
        try {uncertain = owner() !== state.owner || !sameCamera(displayCamera(), state.camera);}
        catch {uncertain = true;}
      }
      if (uncertain) {available = false; closeMaterialPreview(state); changed();}
      throw cause;
    }
  };
  const restoreMaterialPreview = (state: MaterialPreviewState) => {
    currentMaterialPreview(state.token);
    const prepared = prepareRenderNativeSceneAppearance(state.native.accepted);
    currentMaterialPreview(state.token);
    // An atomic presenter refusal leaves the original token and preview available for Cancel retry.
    presentMaterialPreview(state, prepared, false);
    try {
      state.owner = owner();
      check(sameCamera(displayCamera(), state.camera) && !reentered, 'Material restoration ownership or camera reentry was refused.');
    } catch (cause) {available = false; closeMaterialPreview(state); changed(); throw cause;}
    acceptedOwner = state.owner;
    nativePresented = true;
    return prepared;
  };
  const cancelMaterialPreview = (token: object) => {
    const state = currentMaterialPreview(token);
    try {restoreMaterialPreview(state); closeMaterialPreview(state); changed();}
    catch (cause) {if (materialPreview === state) changed(state); throw cause;}
  };
  const poleAt = (bodyId: string, uIndex: number, vIndex: number) => {
    const selection = poleSelection(bodyId, uIndex, vIndex), accepted = native.getSnapshot().accepted;
    const body = accepted.nativeDocument.bodies.find(item => item.id === bodyId)!;
    const asset = snapshot.preparation.native.compiledAssets.find(item => item.assetId === body.assetId);
    const surface = asset?.model.objects.find(item => item.id === body.geometryId);
    check(surface?.kind === 'surface' && !!surface.controlPoints[uIndex]?.[vIndex], 'Choose an original Surface control point.');
    return {selection, body};
  };
  const closePoleDrag = (state: PoleDrag) => {state.used = true; state.gestureActive = false; if (poleDrag === state) poleDrag = null;};
  const invalidatePoleDrag = () => {if (poleDrag) closePoleDrag(poleDrag);};
  const currentPoleDrag = (token: object): PoleDrag => {
    const state = token !== null && typeof token === 'object' ? poleDragTokens.get(token) : undefined;
    if (!state || state.used || poleDrag !== state) throw new RenderEditorError('STALE_CANDIDATE', 'The control-point drag token is stale, foreign, or already used.');
    try {
      const fresh = !disposed && available && presenter === state.presenter && ownershipReader === state.reader
        && actualCameraReader === state.cameraReader && native.getSnapshot() === state.native && local.getSnapshot() === state.material
        && selectedBodyId === state.selection.bodyId && selectedPole.bodyId === state.selection.bodyId
        && selectedPole.uIndex === state.selection.uIndex && selectedPole.vIndex === state.selection.vIndex
        && generation === state.generation && sameCamera(displayCamera(), state.camera) && owner() === state.owner;
      if (!fresh || reentered) throw new RenderEditorError('STALE_CANDIDATE', 'The control point, scene, camera, or display owner changed. Start a new drag.');
      return state;
    } catch (cause) {if (state.document) available = false; closePoleDrag(state); changed(); throw cause;}
  };
  const polePatchCopy = (input: RenderNativeSceneSurfacePolePatch): RenderNativeSceneSurfacePolePatch => {
      check(input !== null && typeof input === 'object' && Object.getPrototypeOf(input) === Object.prototype, 'Control-point fields require plain own data.');
      const keys = ['uIndex', 'vIndex', 'xMM', 'yMM', 'zMM', 'weight'] as const;
      const actual = Reflect.ownKeys(input);
      check(actual.length === keys.length && actual.every(key => typeof key === 'string' && keys.includes(key as typeof keys[number])), 'Control-point fields require the exact six values.');
      const values = Object.fromEntries(keys.map(key => {
        const field = Object.getOwnPropertyDescriptor(input, key);
        check(field && 'value' in field && field.enumerable && typeof field.value === 'number' && Number.isFinite(field.value), 'Control-point fields require finite own numbers.');
        return [key, field.value];
      })) as unknown as RenderNativeSceneSurfacePolePatch;
      return Object.freeze(values);
  };
  const restorePole = (state: PoleDrag): RenderNativeSceneAppearancePreparation | null => {
    if (!state.document) return null;
    currentPoleDrag(state.token);
    const prepared = prepareRenderNativeSceneAppearance(state.native.accepted);
    currentPoleDrag(state.token);
    presented(state.presenter, prepared, state.camera);
    try {
      state.owner = owner();
      if (reentered) throw new RenderEditorError('STALE_CANDIDATE', 'Surface restoration presenter reentry was refused.');
    } catch (cause) {available = false; closePoleDrag(state); changed(); throw cause;}
    acceptedOwner = state.owner; nativePresented = true; localView(state.camera);
    state.document = null; state.patch = null; state.failure = null;
    return prepared;
  };
  const previewPole = (state: PoleDrag, patch: RenderNativeSceneSurfacePolePatch): RenderNativeSceneAppearancePreparation => {
    check(state.gestureActive, 'The point gesture has ended. Cancel the pending Surface preview.');
    try {
      const owned = polePatchCopy(patch);
      check(owned.uIndex === state.selection.uIndex && owned.vIndex === state.selection.vIndex, 'Preview the captured original point only.');
      currentPoleDrag(state.token);
      const document = deriveRenderNativeSceneSurfacePoleEdit(state.native.accepted, state.selection.bodyId, owned);
      const prepared = prepareRenderNativeSceneAppearance(document);
      currentPoleDrag(state.token);
      if (sameNative(prepared.authored.document, state.native.accepted)) {
        restorePole(state); state.failure = null; changed(state); return prepared;
      }
      presented(state.presenter, prepared, state.camera);
      // Successful pixels are recorded before the owned reader can throw.
      state.document = prepared.authored.document; state.patch = owned;
      try {
        state.owner = owner();
        if (reentered) throw new RenderEditorError('STALE_CANDIDATE', 'Surface preview presenter reentry was refused.');
      } catch (cause) {available = false; closePoleDrag(state); changed(); throw cause;}
      state.failure = null; changed(state); return prepared;
    } catch (cause) {
      if (poleDrag === state) {state.failure = caused(cause); changed(state);}
      throw cause;
    }
  };
  const cancelPole = (token: object) => {
    const state = currentPoleDrag(token); state.gestureActive = false;
    try {restorePole(state); closePoleDrag(state); changed();}
    catch (cause) {if (poleDrag === state) {state.failure = caused(cause); changed(state);} throw cause;}
  };
  const stagePole = (bodyId: string, patch: RenderNativeSceneSurfacePolePatch) => {
      const values = polePatchCopy(patch);
      if (reentered) throw new RenderEditorError('STALE_CANDIDATE', 'Control-point input reflection reentry was refused.');
      const selection = poleSelection(bodyId, values.uIndex, values.vIndex);
      const accepted = native.getSnapshot().accepted;
      check(surfacePole !== null || sameNative(draftDocument.nativeDocument, accepted.nativeDocument), 'Finish the other native source draft before editing a control point.');
      surfacePoleDraftPatch = Object.freeze({...values});
      try {
        const originalTargets = new Map(accepted.surfaceMaterials.map(item => [item.target.bodyId, item.target]));
        const baseline = {...draftDocument, nativeDocument: accepted.nativeDocument, surfaceMaterials: draftDocument.surfaceMaterials.map(item => {
          const target = originalTargets.get(item.target.bodyId); check(target, 'The original material target is absent.'); return {...item, target};
        })};
        const document = deriveRenderNativeSceneSurfacePoleEdit(baseline, bodyId, values);
        stage(document); invalidSurfacePole = false;
        surfacePole = sameNative(document.nativeDocument, accepted.nativeDocument) ? null : selection;
        changed();
      } catch (cause) {surfacePole = selection; invalidSurfacePole = true; changed(); throw cause;}
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
    check(!invalidSurfacePole, 'Correct the original Surface control-point values before Apply.');
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
  const commit = (candidate: RenderNativeScenePreparedCandidate, beforeCommit?: NativeScenePresenter, explicitCamera?: MeshCamera, preferredBodyId?: string, materialState?: MaterialPreviewState) => {
    const token = candidate !== null && typeof candidate === 'object' ? candidates.get(candidate) : undefined;
    if (!token || token.used || token.generation !== generation) throw new RenderEditorError('STALE_CANDIDATE', 'The scene candidate is stale, foreign, forged, or already used.');
    check(available && presenter, 'The native preview is unavailable.');
    // Provenance admission above precedes candidate reads and reservation planning.
    const nextRetainedIds = retainedPlan(candidate.preparation.document, candidate.purpose === 'open' || !nativePresented);
    const active = presenter;
    const previousCamera = displayCamera(), previousOwner = owner(), camera = explicitCamera ?? (!nativePresented || candidate.purpose === 'open'
      ? cameraCopy(candidate.preparation.document.display.camera) : previousCamera);
    const nextStore: {local: RenderMaterialSession | null; owner: object | null} = {local: null, owner: null};
    let nextBody = selectedBodyId;
    try {
      const result = commitRenderNativeSceneAppearanceCandidate(native, candidate, prepared => {
        const selected = selectedMaterial(prepared.authored, preferredBodyId ?? selectedBodyId);
        check(preferredBodyId === undefined || selected.target.bodyId === preferredBodyId, 'The preferred body has no qualified Surface material.');
        nextBody = selected.target.bodyId;
        nextStore.local = createRenderMaterialSession(selected.preparation.document);
        if (beforeCommit) synchronous(beforeCommit, prepared, camera);
        if (reentered) throw new RenderEditorError('STALE_CANDIDATE', 'Native scene callback reentry was refused.');
        check(sameCamera(displayCamera(), previousCamera), 'The displayed camera changed during scene preparation.');
        check(owner() === previousOwner, 'The displayed scene owner changed during scene preparation.');
        if (reentered) throw new RenderEditorError('STALE_CANDIDATE', 'Native scene reader reentry was refused.');
        if (materialState) presentMaterialPreview(materialState, prepared, false);
        else presented(active, prepared, camera);
        nextStore.owner = owner();
        if (reentered) throw new RenderEditorError('STALE_CANDIDATE', 'Native scene presenter reentry was refused.');
      });
      token.used = true;
      retainedIds = nextRetainedIds;
      acceptedOwner = nextStore.owner!;
      local.dispose(); local = nextStore.local!; nextStore.local = null;
      selectedBodyId = nextBody; draftDocument = native.getSnapshot().accepted;
      const body = draftDocument.nativeDocument.bodies.find(item => item.id === selectedBodyId);
      const asset = native.getSnapshot().preparation.native.compiledAssets.find(item => item.assetId === body?.assetId);
      const geometry = asset?.model.objects.find(item => item.id === body?.geometryId);
      if (candidate.purpose === 'open' || selectedPole.bodyId !== selectedBodyId || geometry?.kind !== 'surface'
        || !geometry.controlPoints[selectedPole.uIndex]?.[selectedPole.vIndex]) selectedPole = {bodyId: selectedBodyId, uIndex: 0, vIndex: 0};
      surfacePoleDraftPatch = null;
      invalidLighting = false; invalidBodyPoseBodyId = null; bodyPoseInputResetEpoch++; invalidSurfacePole = false; surfacePole = null; surfacePoleInputResetEpoch++; nativePresented = true; localView(camera); changed(); return result;
    } finally {nextStore.local?.dispose();}
  };
  const restore = () => {
    check(available && presenter, 'The native preview is unavailable.');
    const camera = displayCamera(), previousOwner = owner(), result = prepareRenderNativeSceneAppearance(native.getSnapshot().accepted);
    check(sameCamera(displayCamera(), camera), 'The displayed camera changed during scene restoration.');
    check(owner() === previousOwner, 'The displayed scene owner changed during scene restoration.');
    if (reentered) throw new RenderEditorError('STALE_CANDIDATE', 'Native scene reader reentry was refused.');
    presented(presenter, result, camera);
    const nextOwner = owner();
    if (reentered) throw new RenderEditorError('STALE_CANDIDATE', 'Native scene presenter reentry was refused.');
    acceptedOwner = nextOwner;
    nativePresented = true; localView(camera); return result;
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
      noView(); check(available, 'Finish the body transform or restore the preview before changing the active body.');
      check(!native.getSnapshot().dirty && !local.getSnapshot().dirty && !invalidLighting && invalidBodyPoseBodyId === null && !invalidSurfacePole, 'Apply or Discard authored drafts before changing the active body.');
      check(typeof bodyId === 'string' && snapshot.targets.some(item => item.bodyId === bodyId), 'Choose an authored visible Surface material.');
      if (bodyId === selectedBodyId) return;
      const selected = selectedMaterial(native.getSnapshot().preparation, bodyId);
      const next = createRenderMaterialSession(selected.preparation.document); local.dispose(); local = next; selectedBodyId = bodyId; selectedPole = {bodyId, uIndex: 0, vIndex: 0}; surfacePoleDraftPatch = null; surfacePole = null; invalidSurfacePole = false; surfacePoleInputResetEpoch++; changed();});},
    setPresenter(next, reader, cameraReader) {run(() => {check(next === null || typeof next === 'function', 'Native presenter must be a function or null.'); check(reader === undefined || typeof reader === 'function', 'Preview ownership reader must be a function.'); check(cameraReader === undefined || typeof cameraReader === 'function', 'Display camera reader must be a function.');
      if (next !== null) noView(); else {invalidatePose(); invalidatePoleDrag(); invalidateMaterialPreview();}
      const nextFallback = Object.freeze({}), nextOwner = next === null ? nextFallback : readOwner(reader, nextFallback);
      if (reentered) throw new RenderEditorError('STALE_CANDIDATE', 'Preview ownership reentry was refused.');
      presenter = next; ownershipReader = reader; actualCameraReader = cameraReader; fallbackOwner = nextFallback; acceptedOwner = nextOwner; available = next !== null; changed();});},
    setAvailable(value) {run(() => {check(typeof value === 'boolean', 'Native availability must be a boolean.'); if (!value) {invalidatePose(); invalidatePoleDrag(); invalidateMaterialPreview();} if (available !== value) {available = value; changed();}});},
    stageSceneDocument(document) {run(() => {noView(); clean(); stage(document); changed();});},
    addSurface(source, surfaceId) {return run(() => {
      noView(); clean(); check(available && presenter && nativePresented, 'The applied native preview is unavailable.');
      check(owner() === acceptedOwner, 'The applied preview belongs to another scene. Restore the current scene before adding a Surface.');
      if (reentered) throw new RenderEditorError('STALE_CANDIDATE', 'Native scene ownership reentry was refused.');
      const baseline = native.getSnapshot(), material = selectedMaterial(baseline.preparation, selectedBodyId);
      const derived = deriveRenderNativeSceneSurfaceAddition(baseline.accepted, source, surfaceId, {
        material: material.preparation.document, reservedIds: [...retainedIds],
      });
      retainedPlan(derived.document);
      if (reentered) throw new RenderEditorError('STALE_CANDIDATE', 'Native Surface addition reentry was refused.');
      stage(derived.document); changed();
      return commit(prepareDraft(), undefined, undefined, derived.bodyId);
    });},
    duplicateSelectedBody() {return run(() => {
      noView(); clean(); check(available && presenter && nativePresented, 'The applied native preview is unavailable.');
      check(owner() === acceptedOwner, 'The applied preview belongs to another scene. Restore the current scene before duplicating.');
      if (reentered) throw new RenderEditorError('STALE_CANDIDATE', 'Native scene ownership reentry was refused.');
      const original = native.getSnapshot().accepted;
      const selected = original.nativeDocument.bodies.find(body => body.id === selectedBodyId);
      check(selected, 'The active native body is missing.');
      const copyName = selected.name + ' copy';
      const derived = deriveRenderNativeSceneBodyDuplicate(original, selectedBodyId, {
        name: new TextEncoder().encode(copyName).length <= 128 ? copyName : selected.name,
        reservedIds: [...retainedIds],
      });
      // Refuse exhausted reservations before changing even the corrective SDK draft.
      retainedPlan(derived.document);
      if (reentered) throw new RenderEditorError('STALE_CANDIDATE', 'Native body duplication reentry was refused.');
      stage(derived.document); changed();
      return commit(prepareDraft(), undefined, undefined, derived.bodyId);
    });},
    removeSelectedBody() {return run(() => {
      noView(); clean(); check(available && presenter && nativePresented, 'The applied native preview is unavailable.');
      check(owner() === acceptedOwner, 'The applied preview belongs to another scene. Restore the current scene before removing a body.');
      if (reentered) throw new RenderEditorError('STALE_CANDIDATE', 'Native scene ownership reentry was refused.');
      const document = deriveRenderNativeSceneBodyRemoval(native.getSnapshot().accepted, selectedBodyId);
      const preferredBodyId = document.surfaceMaterials[0]?.target.bodyId;
      check(preferredBodyId, 'Removal requires a surviving qualified Surface material.');
      retainedPlan(document);
      if (reentered) throw new RenderEditorError('STALE_CANDIDATE', 'Native body removal reentry was refused.');
      stage(document); changed();
      return commit(prepareDraft(), undefined, undefined, preferredBodyId);
    });},
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
    stageSurfacePoleEdit(bodyId, patch) {run(() => stagePole(bodyId, patch));},
    selectSurfacePole(uIndex, vIndex) {run(() => {
      noView(); clean(); const {selection} = poleAt(selectedBodyId, uIndex, vIndex);
      check(available && presenter && owner() === acceptedOwner, 'The applied preview belongs to another scene. Restore it before choosing a control point.');
      if (reentered) throw new RenderEditorError('STALE_CANDIDATE', 'Control-point selection reader reentry was refused.');
      if (selectedPole.bodyId === selection.bodyId && selectedPole.uIndex === uIndex && selectedPole.vIndex === vIndex) return;
      selectedPole = selection; surfacePoleInputResetEpoch++; changed();
    });},
    beginSurfacePoleDrag(bodyId, uIndex, vIndex) {return run(() => {
      noView(); clean(); check(available && presenter, 'The original Surface preview is unavailable.');
      const {selection, body} = poleAt(bodyId, uIndex, vIndex);
      check(selectedPole.bodyId === bodyId && selectedPole.uIndex === uIndex && selectedPole.vIndex === vIndex, 'Drag the selected original control point.');
      check(!native.getSnapshot().accepted.nativeDocument.bodies.some(other => other.id !== bodyId && other.assetId === body.assetId), 'Duplicate the shared Surface asset before editing control points.');
      const camera = displayCamera(), currentOwner = owner();
      check(currentOwner === acceptedOwner, 'The preview belongs to another scene. Restore the current scene.');
      if (reentered) throw new RenderEditorError('STALE_CANDIDATE', 'Control-point capture reader reentry was refused.');
      const token = Object.freeze({});
      const state: PoleDrag = {token, selection, native: native.getSnapshot(), material: local.getSnapshot(), camera,
        owner: currentOwner, presenter, reader: ownershipReader, cameraReader: actualCameraReader, generation, used: false,
        gestureActive: true, document: null, patch: null, failure: null};
      poleDrag = state; poleDragTokens.set(token, state); changed(); state.generation = generation; return token;
    });},
    previewSurfacePoleDrag(token, patch) {return run(() => previewPole(currentPoleDrag(token), patch));},
    finishSurfacePoleDrag(token, patch) {return run(() => {
      const state = currentPoleDrag(token);
      check(state.gestureActive, 'Cancel the pending Surface preview before a new drag.');
      try {
        const owned = polePatchCopy(patch);
        check(owned.uIndex === state.selection.uIndex && owned.vIndex === state.selection.vIndex, 'Release the captured original point only.');
        currentPoleDrag(token);
        if (state.failure) throw state.failure;
        if (!state.patch || !sameNative(owned, state.patch)) previewPole(state, owned);
        state.gestureActive = false;
        if (!state.document) {closePoleDrag(state); changed(); return null;}
        const document = state.document, finalPatch = state.patch!;
        restorePole(state);
        closePoleDrag(state); surfacePoleInputResetEpoch++;
        // Reuse the actual displayed candidate, not a second source derivation.
        surfacePoleDraftPatch = finalPatch; surfacePole = state.selection; invalidSurfacePole = false;
        stage(document); changed(); return commit(prepareDraft());
      } catch (cause) {
        if (poleDrag === state) {
          state.gestureActive = false; state.failure = caused(cause);
          if (!state.document) closePoleDrag(state);
          changed(poleDrag === state ? state : undefined);
        } else changed();
        throw cause;
      }
    });},
    cancelSurfacePoleDrag(token) {run(() => cancelPole(token));},
    setSurfacePoleInputInvalid(bodyId, uIndex, vIndex) {run(() => {
      const selection = poleSelection(bodyId, uIndex, vIndex);
      check(surfacePole !== null || sameNative(draftDocument.nativeDocument, native.getSnapshot().accepted.nativeDocument), 'Finish the other native source draft before correcting a control point.');
      surfacePole = selection; invalidSurfacePole = true; changed();
    });},
    stageLighting(lighting) {run(() => {noView(); stage({...draftDocument, display: {...draftDocument.display, lighting}}); invalidLighting = false; changed();});},
    setLightingInputInvalid(value) {run(() => {noView(); check(typeof value === 'boolean', 'Lighting validity requires a boolean.'); if (invalidLighting !== value) {invalidLighting = value; changed();}});},
    prepareDraft: () => run(() => {noView(); return prepareDraft();}),
    prepareOpen: text => run(() => {noView(); clean(); return issue(native.prepareOpen(text))!;}),
    prepareUndo: () => run(() => {noView(); clean(); return issue(native.prepareUndo());}),
    prepareRedo: () => run(() => {noView(); clean(); return issue(native.prepareRedo());}),
    commitPrepared: (candidate, beforeCommit) => run(() => {noView(); return commit(candidate, beforeCommit);}),
    discardDraft() {run(() => {noView(); native.discardDraft(); local.discardDraft(); draftDocument = native.getSnapshot().accepted; invalidLighting = false; invalidBodyPoseBodyId = null; bodyPoseInputResetEpoch++; invalidSurfacePole = false; surfacePole = null; surfacePoleDraftPatch = null; surfacePoleInputResetEpoch++; changed();});},
    markSaved(revision) {run(() => {noView(); native.markSaved(revision); changed();});},
    observeView(camera) {run(() => {const next = cameraCopy(camera), accepted = native.getSnapshot().accepted.display.camera;
      if (materialPreview) {
        if (!sameCamera(next, materialPreview.camera)) {available = false; invalidateMaterialPreview(); localView(next); changed(); throw new RenderEditorError('STALE_CANDIDATE', 'The camera changed during material preview. Reopen the scene.');}
        return;
      }
      if (poleDrag) {
        if (!sameCamera(next, poleDrag.camera)) {if (poleDrag.document) available = false; invalidatePoleDrag(); localView(next); changed(); throw new RenderEditorError('STALE_CANDIDATE', 'The camera changed during control-point drag. Start a new drag.');}
        return;
      }
      if (bodyPose) {if (!sameCamera(next, bodyPose.camera)) {if (bodyPose.preview) available = false; invalidatePose(); localView(next); changed(); throw new RenderEditorError('STALE_CANDIDATE', 'The camera changed during the body transform. Reload or reopen the scene.');} return;}
      const pending = sameCamera(next, accepted) ? null : next;
      if (pending === null ? viewCamera !== null : viewCamera === null || !sameCamera(pending, viewCamera)) {viewCamera = pending; changed();}});},
    getDisplayCamera: () => run(() => {check(available, 'The native preview is unavailable.'); return displayCamera();}),
    resetViewportCamera() {run(() => {
      noView(); check(available && presenter, 'The native preview is unavailable.');
      const previousCamera = displayCamera(), previousOwner = owner(), camera = cameraCopy(native.getSnapshot().accepted.display.camera);
      const prepared = prepareRenderNativeSceneAppearance(native.getSnapshot().accepted);
      check(sameCamera(displayCamera(), previousCamera), 'The displayed camera changed during view reset.');
      check(owner() === previousOwner, 'The displayed scene owner changed during view reset.');
      if (reentered) throw new RenderEditorError('STALE_CANDIDATE', 'Native view reader reentry was refused.');
      presented(presenter, prepared, camera); const nextOwner = owner();
      if (reentered) throw new RenderEditorError('STALE_CANDIDATE', 'Native view reset reentry was refused.');
      acceptedOwner = nextOwner; nativePresented = true; viewCamera = null; changed();
    });},
    applyCamera() {return run(() => {noView(); clean(); check(available && presenter, 'The native preview is unavailable.');
      const camera = displayCamera(); check(!sameCamera(camera, native.getSnapshot().accepted.display.camera), 'The scene camera already matches this view.');
      stage({...draftDocument, display: {...draftDocument.display, camera}}); changed(); return commit(prepareDraft(), undefined, camera);
    });},
    restoreAccepted() {return run(() => {if (materialPreview) {cancelMaterialPreview(materialPreview.token); return prepareRenderNativeSceneAppearance(native.getSnapshot().accepted);} if (poleDrag) {cancelPole(poleDrag.token); return prepareRenderNativeSceneAppearance(native.getSnapshot().accepted);} if (bodyPose) {const result = cancelPose(bodyPose.token); if (result) return result;} const result = restore(); changed(); return result;});},
    beginMaterialPreview() {return run(() => {
      noView(); check(available && presenter && nativePresented, 'The applied native preview is unavailable.');
      check(!invalidLighting && invalidBodyPoseBodyId === null && !invalidSurfacePole && surfacePole === null,
        'Finish the geometry or lighting draft before material preview.');
      const baseline = native.getSnapshot(), raw = local.getSnapshot(), accepted = baseline.accepted;
      const binding = accepted.surfaceMaterials.find(item => item.target.bodyId === selectedBodyId);
      check(binding && baseline.preparation.materials.some(item => item.target.bodyId === selectedBodyId)
        && baseline.preparation.entries.some(item => item.kind === 'surface' && item.binding.bodyId === selectedBodyId)
        && accepted.display.visibleBodyIds.includes(selectedBodyId), 'Preview the selected visible original Surface material.');
      check(raw.dirty && raw.diagnostics.length === 0, 'Enter a valid changed material draft before Preview.');
      const preparedMaterial = local.prepareDraft().document;
      // stageValidMaterial mirrors raw into the native draft. Admit ONLY those fields, never a second scene edit.
      const normalized = {...draftDocument, surfaceMaterials: draftDocument.surfaceMaterials.map(item => {
        if (item.target.bodyId !== selectedBodyId) return item;
        check(item.material.revision === binding.material.revision || item.material.revision === preparedMaterial.revision,
          'The staged material revision is not the accepted or prepared revision.');
        return {...item, material: {...item.material, shaderSource: binding.material.shaderSource,
          uniforms: binding.material.uniforms, revision: binding.material.revision}};
      })};
      check(sameNative(normalized, accepted), 'Preview requires a material-only draft; finish other scene edits first.');
      const document = {...accepted, surfaceMaterials: accepted.surfaceMaterials.map(item => item === binding ? {...item, material: preparedMaterial} : item)};
      const prepared = prepareRenderNativeSceneAppearance(document), camera = displayCamera(), currentOwner = owner();
      check(currentOwner === acceptedOwner && !reentered, 'The applied preview belongs to another scene or capture reentered.');
      const token = Object.freeze({});
      const state: MaterialPreviewState = {token, native: baseline, material: raw, draft: draftDocument,
        document: prepared.authored.document, bodyId: selectedBodyId, materialDocumentId: preparedMaterial.documentId,
        camera, localCamera: viewCamera, owner: currentOwner, generation, used: false, presented: false,
        presenter, reader: ownershipReader, cameraReader: actualCameraReader};
      materialPreview = state; materialPreviewTokens.set(token, state);
      try {
        currentMaterialPreview(token);
        // Record successful presentation before callback-result/owner/camera verification can fail.
        presentMaterialPreview(state, prepared, true);
        try {
          state.owner = owner();
          check(sameCamera(displayCamera(), camera) && !reentered, 'Material preview ownership or camera reentry was refused.');
        } catch (cause) {available = false; closeMaterialPreview(state); changed(); throw cause;}
        changed(state); return token;
      } catch (cause) {if (materialPreview === state) {closeMaterialPreview(state); changed();} throw cause;}
    });},
    cancelMaterialPreview: token => run(() => cancelMaterialPreview(token)),
    applyMaterialPreview(token) {return run(() => {
      const state = currentMaterialPreview(token);
      try {restoreMaterialPreview(state);} catch (cause) {if (materialPreview === state) changed(state); throw cause;}
      closeMaterialPreview(state);
      // Exactly the captured prepared material, one full scene candidate, and no local material commit.
      try {stage(state.document); changed(); return commit(issue(native.prepareDraft())!, undefined, undefined, undefined, state);}
      catch (cause) {
        // Whole-commit callback uncertainty must never leave an apparently usable unowned display.
        try {if (owner() !== acceptedOwner || !sameCamera(displayCamera(), state.camera) || reentered) available = false;}
        catch {available = false;}
        changed(); throw cause;
      }
    });},
    beginBodyPosePreview(bodyId) {return run(() => {
      noView(); clean(); check(available && presenter, 'The native preview is unavailable.');
      const camera = displayCamera();
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
        presenter, reader: ownershipReader, cameraReader: actualCameraReader, camera, owner: currentOwner, generation, gestureActive: true, preview: null, document: null, failure: null, used: false};
      if (reentered) throw new RenderEditorError('STALE_CANDIDATE', 'Preview ownership reentry was refused.');
      localView(camera); bodyPose = state; poseTokens.set(token, state); changed(state); return token;
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
        presented(state.presenter, prepared, state.camera); state.owner = owner();
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
    dispose() {if (disposed) return; run(() => {invalidatePose(); invalidatePoleDrag(); invalidateMaterialPreview(); native.dispose(); local.dispose(); presenter = null; ownershipReader = undefined; actualCameraReader = undefined; available = false; disposed = true; viewCamera = null; changed(); listeners.clear();});},
  };
  readSnapshots(); return Object.freeze(host);
}
