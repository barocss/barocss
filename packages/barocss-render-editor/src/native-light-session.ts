import {createNativeDirectionalLightWebGPUViewer, createNativePointLightWebGPUViewer} from '@barocss/viewer';
import type {ViewerNativeDirectionalLightInput, ViewerNativePointLightInput, ViewerNativeDirectionalLightWebGPU, ViewerNativePointLightWebGPU} from '@barocss/viewer';
import {validateMeshCamera} from '@barocss/gpu';
import type {MeshCamera, NativeDirectionalLightWebGPUStatus, NativePointLightWebGPUStatus} from '@barocss/gpu';
import {prepareRenderNativeLightDocument, parseRenderNativeLightDocument,
  serializeRenderNativeLightDocument} from './native-light-document.js';
import type {RenderNativeLightDocument} from './native-light-document.js';
import {createRenderNativeLightRequest} from './native-light-request.js';
import {RENDER_NATIVE_SCENE_LIMITS} from './native-scene-document.js';
import {RenderEditorError} from './errors.js';

export type RenderNativeLightSessionPurpose = 'apply' | 'open' | 'undo' | 'redo';
export interface RenderNativeLightSessionVersion {readonly revision: number; readonly generation: number}
export interface RenderNativeLightPreparedCandidate {
  readonly document: RenderNativeLightDocument;
  readonly purpose: RenderNativeLightSessionPurpose;
  readonly expected: RenderNativeLightSessionVersion;
}
export interface RenderNativeLightSavePayload {readonly documentId: string; readonly revision: number; readonly text: string}
export interface RenderNativeLightSessionSnapshot {
  readonly accepted: RenderNativeLightDocument; readonly draftText: string;
  readonly dirty: boolean; readonly unsaved: boolean; readonly canUndo: boolean; readonly canRedo: boolean;
  readonly pending: RenderNativeLightSessionPurpose | 'view' | null;
  readonly viewportCamera: MeshCamera | null; readonly viewDirty: boolean;
  readonly version: RenderNativeLightSessionVersion; readonly disposed: boolean;
}
export interface RenderNativeLightSession {
  getSnapshot(): RenderNativeLightSessionSnapshot;
  getStatus(): NativeDirectionalLightWebGPUStatus | NativePointLightWebGPUStatus;
  subscribe(listener: () => void): () => void;
  setDraftText(text: string, expected: RenderNativeLightSessionVersion): void;
  prepareDraft(expected: RenderNativeLightSessionVersion): RenderNativeLightPreparedCandidate;
  prepareOpen(text: string, expected: RenderNativeLightSessionVersion): RenderNativeLightPreparedCandidate;
  prepareUndo(expected: RenderNativeLightSessionVersion): RenderNativeLightPreparedCandidate | null;
  prepareRedo(expected: RenderNativeLightSessionVersion): RenderNativeLightPreparedCandidate | null;
  commitPrepared(candidate: RenderNativeLightPreparedCandidate): Promise<void>;
  navigateViewportCamera(camera: MeshCamera, expected: RenderNativeLightSessionVersion): Promise<void>;
  resetViewportCamera(expected: RenderNativeLightSessionVersion): Promise<void>;
  pickViewportBody(xPixel: number, yPixel: number, expected: RenderNativeLightSessionVersion): Promise<string | null>;
  discardDraft(expected: RenderNativeLightSessionVersion): void;
  getSavePayload(): RenderNativeLightSavePayload;
  markSaved(payload: RenderNativeLightSavePayload): void;
  dispose(): void;
}
interface Entry {readonly document: RenderNativeLightDocument; readonly bytes: number}
interface State {
  readonly snapshot: RenderNativeLightSessionSnapshot; readonly text: string; readonly saved: string | null;
  readonly identity: object; readonly entries: readonly Entry[]; readonly index: number;
}
interface Candidate {
  readonly request: ViewerNativeDirectionalLightInput | ViewerNativePointLightInput; readonly success: State;
  readonly viewerGeneration: number; used: boolean;
}
const encoder = new TextEncoder();
function sameCamera(a: MeshCamera, b: MeshCamera): boolean {
  return (['eye', 'target', 'up'] as const).every(key => a[key].every((value, index) => Object.is(value, b[key][index])))
    && (['fovYDegrees', 'near', 'far'] as const).every(key => Object.is(a[key], b[key]));
}
/** Provider identity records must contain the exact own data pins, without evaluating accessors. */
function samePins(input: unknown, expected: object): boolean {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return false;
  const prototype = Object.getPrototypeOf(input);
  if (prototype !== Object.prototype && prototype !== null) return false;
  const keys = Reflect.ownKeys(input), pins = Object.entries(expected);
  return keys.length === pins.length && pins.every(([key, value]) => {
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    return descriptor?.enumerable && 'value' in descriptor && Object.is(descriptor.value, value);
  });
}
function viewed<T extends ViewerNativeDirectionalLightInput | ViewerNativePointLightInput>(request: T, camera: MeshCamera | null): T {
  return camera ? {...request, display: {...request.display, camera}} : request;
}
function fail(code: 'STALE_CANDIDATE' | 'DISPOSED' | 'DOCUMENT_INPUT' | 'DOCUMENT_BYTES' | 'HISTORY_LIMIT', message: string): never {
  throw new RenderEditorError(code, message);
}
function presentation(cause: unknown): RenderEditorError {
  const error = new RenderEditorError('PRESENTATION_REFUSED', 'Light presentation refused or became unavailable.');
  Object.defineProperty(error, 'cause', {value: cause, configurable: true}); return error;
}
function draftBudget(text: unknown): asserts text is string {
  if (typeof text !== 'string') fail('DOCUMENT_INPUT', 'Light draft requires text.');
  if (text.length > RENDER_NATIVE_SCENE_LIMITS.fileBytes || encoder.encode(text).length > RENDER_NATIVE_SCENE_LIMITS.fileBytes)
    fail('DOCUMENT_BYTES', 'Light draft exceeds its file byte limit.');
}
function state(document: RenderNativeLightDocument, text: string, saved: string | null, identity: object,
  entries: readonly Entry[], index: number, draftText: string, generation: number,
  pending: RenderNativeLightSessionSnapshot['pending'] = null, disposed = false, viewportCamera: MeshCamera | null = null): State {
  return Object.freeze({text, saved, identity, entries, index, snapshot: Object.freeze({accepted: document, draftText,
    dirty: draftText !== text, unsaved: text !== saved, canUndo: !disposed && index > 0,
    canRedo: !disposed && index < entries.length - 1, pending,
    version: Object.freeze({revision: document.revision, generation}), disposed, viewportCamera, viewDirty: viewportCamera !== null})});
}
function revise(current: State, draftText = current.snapshot.draftText, saved = current.saved,
  pending: RenderNativeLightSessionSnapshot['pending'] = null, disposed = false, viewportCamera: MeshCamera | null = current.snapshot.viewportCamera): State {
  return state(current.snapshot.accepted, current.text, saved, current.identity, current.entries, current.index,
    draftText, current.snapshot.version.generation + 1, pending, disposed, viewportCamera);
}
/** Required-WebGPU authoring. This session exclusively owns its actual Viewer and cannot be externally presented. */
export async function createRenderNativeLightSession(canvas: HTMLCanvasElement,
  initial: RenderNativeLightDocument, options: {width: number; height: number}): Promise<RenderNativeLightSession> {
  const document = prepareRenderNativeLightDocument(initial).document;
  const text = serializeRenderNativeLightDocument(document), request = createRenderNativeLightRequest(document);
  let current = state(document, text, null, Object.freeze({}), Object.freeze([Object.freeze({document, bytes: encoder.encode(text).length})]), 0, text, 0);
  const profile = document.lights.profile;
  let viewer: ViewerNativeDirectionalLightWebGPU | ViewerNativePointLightWebGPU;
  try {viewer = request.format === 'barocss-viewer-native-point-light-input'
    ? await createNativePointLightWebGPUViewer(canvas, request, options)
    : await createNativeDirectionalLightWebGPUViewer(canvas, request, options);} catch (cause) {throw presentation(cause);}
  try {
    let lock: object | null = null, epoch = 0, indeterminate = false;
    let viewerGeneration = viewer.accepted.generation;
    const candidates = new WeakMap<object, Candidate>(), saves = new WeakMap<object, object>(), listeners = new Set<() => void>();
    const notify = (observers: readonly (() => void)[]): void => {
      for (const observer of observers) {try {observer();} catch {/* Observers never undo acknowledged state. */}}
    };
    const mutable = (): void => {
      if (current.snapshot.disposed) fail('DISPOSED', 'Light session is disposed.');
      if (lock !== null) fail('STALE_CANDIDATE', 'Light session has a pending operation.');
      if (indeterminate || viewer.status.state !== 'ready') throw presentation('Explicit disposal/remount required; presentation is unavailable.');
    };
    const expectedVersion = (expected: RenderNativeLightSessionVersion): void => {
      // Read descriptors only: a caller cannot execute a getter in the version boundary.
      let keys: readonly PropertyKey[], revision: PropertyDescriptor | undefined, generation: PropertyDescriptor | undefined;
      if (!expected || typeof expected !== 'object') fail('STALE_CANDIDATE', 'Exact session version required.');
      try {
        keys = Reflect.ownKeys(expected);
        revision = Object.getOwnPropertyDescriptor(expected, 'revision');
        generation = Object.getOwnPropertyDescriptor(expected, 'generation');
      } catch (cause) {
        const error = new RenderEditorError('STALE_CANDIDATE', 'Session version reflection refused.');
        Object.defineProperty(error, 'cause', {value: cause}); throw error;
      }
      if (keys.length !== 2 || !revision || !('value' in revision) || !generation || !('value' in generation)
        || !Object.is(revision.value, current.snapshot.version.revision) || generation.value !== current.snapshot.version.generation)
        fail('STALE_CANDIDATE', 'Light session version changed.');
    };
    const qualify = <T,>(expected: RenderNativeLightSessionVersion, operation: () => T): T => {
      mutable(); const token = {}; lock = token; const started = epoch;
      try {
        expectedVersion(expected);
        if (epoch !== started || current.snapshot.disposed) fail('DISPOSED', 'Session disposed during version reflection.');
        const value = operation();
        if (epoch !== started || current.snapshot.disposed) fail('DISPOSED', 'Session disposed during preparation.');
        return value;
      } finally {if (lock === token) lock = null;}
    };
    const nextRevision = (): number => {
      if (current.snapshot.accepted.revision >= 2147483647) fail('DOCUMENT_INPUT', 'Light revision is at its maximum.');
      return current.snapshot.accepted.revision + 1;
    };
    const revisedDocument = (input: RenderNativeLightDocument): RenderNativeLightDocument => {
      const revision = nextRevision(); return {...input, revision, lights: {...input.lights, revision}};
    };
    const prepare = (input: RenderNativeLightDocument, purpose: RenderNativeLightSessionPurpose, target?: number): RenderNativeLightPreparedCandidate => {
      const next = prepareRenderNativeLightDocument(input).document;
      if (next.lights.profile !== profile) fail('DOCUMENT_INPUT', 'This workspace has a fixed light kind. Choose a new workspace to change it.');
      const canonical = serializeRenderNativeLightDocument(next);
      const entry = Object.freeze({document: next, bytes: encoder.encode(canonical).length});
      const entries = purpose === 'open' ? [entry] : target === undefined ? [...current.entries.slice(0, current.index + 1), entry] : [...current.entries];
      const index = purpose === 'open' ? 0 : target ?? entries.length - 1;
      if (target !== undefined) entries[index] = entry;
      if (entries.length > RENDER_NATIVE_SCENE_LIMITS.historyEntries || entries.reduce((total, item) => total + item.bytes, 0) > RENDER_NATIVE_SCENE_LIMITS.historyBytes)
        fail('HISTORY_LIMIT', 'Light history exceeds its entry or canonical byte limit.');
      const localView = purpose === 'open' || current.snapshot.viewportCamera && sameCamera(current.snapshot.viewportCamera, next.display.camera) ? null : current.snapshot.viewportCamera;
      const nextRequest = viewed(createRenderNativeLightRequest(next), localView);
      const success = state(next, canonical, purpose === 'open' ? canonical : current.saved, Object.freeze({}), Object.freeze(entries), index,
        canonical, current.snapshot.version.generation + 2, null, false, localView);
      const candidate = Object.freeze({document: next, purpose, expected: current.snapshot.version});
      candidates.set(candidate, {request: nextRequest, success, viewerGeneration, used: false}); return candidate;
    };
    const present = async (request: ViewerNativeDirectionalLightInput | ViewerNativePointLightInput,
      owner: {id: string; revision: number}, generation: number, started: number): Promise<void> => {
      let result: Awaited<ReturnType<typeof viewer.replace>>;
      try {result = await viewer.replace(request);} catch (cause) {
        if (epoch === started) indeterminate = true;
        throw presentation(cause);
      }
      if (epoch !== started || current.snapshot.disposed) fail('DISPOSED', 'Session disposed during presentation.');
      let ok: boolean | undefined, backendError: unknown, acknowledgedGeneration: number | undefined;
      let acknowledgedId: string | undefined, acknowledgedRevision: number | undefined;
      try {
        ok = result?.ok;
        if (ok === true) {
          const acknowledged = viewer.accepted;
          acknowledgedGeneration = acknowledged.generation; acknowledgedId = acknowledged.owner.id;
          acknowledgedRevision = acknowledged.owner.revision;
        } else if (ok === false) backendError = (result as {ok: false; error: unknown}).error;
      } catch (cause) {indeterminate = true; throw presentation(cause);}
      if (typeof ok !== 'boolean') {indeterminate = true; throw presentation('Malformed Viewer acknowledgement; explicit remount required.');}
      if (!ok) throw presentation(backendError);
      // This checks acknowledged metadata, not live status: ACK followed by loss still adopts.
      if (acknowledgedGeneration !== generation + 1 || acknowledgedId !== owner.id
        || !Object.is(acknowledgedRevision, owner.revision)) {
        indeterminate = true; throw presentation('Viewer acknowledgement metadata is inconsistent; explicit remount required.');
      }
    };
    const navigate = async (input: MeshCamera, expected: RenderNativeLightSessionVersion): Promise<void> => {
      mutable(); const token = {}; lock = token; const started = epoch;
      let refusal: State | undefined, observers: readonly (() => void)[] = [];
      try {
        expectedVersion(expected);
        const camera = validateMeshCamera(input);
        if (epoch !== started || current.snapshot.disposed) fail('DISPOSED', 'Session disposed during camera admission.');
        if (viewer.accepted.generation !== viewerGeneration) fail('STALE_CANDIDATE', 'Viewer generation differs from the local view.');
        if (sameCamera(camera, current.snapshot.viewportCamera ?? current.snapshot.accepted.display.camera)) return;
        const viewportCamera = sameCamera(camera, current.snapshot.accepted.display.camera) ? null : camera;
        const request = viewed(createRenderNativeLightRequest(current.snapshot.accepted), viewportCamera);
        const generation = viewerGeneration;
        const pending = revise(current, current.snapshot.draftText, current.saved, 'view');
        const success = revise(pending, pending.snapshot.draftText, pending.saved, null, false, viewportCamera);
        refusal = revise(pending); observers = [...listeners];
        current = pending; notify(observers);
        if (epoch !== started || lock !== token) fail('DISPOSED', 'Session disposed before camera presentation.');
        await present(request, request.owner, generation, started);
        if (epoch !== started || current.snapshot.disposed) fail('DISPOSED', 'Session disposed after camera acknowledgement.');
        current = success; viewerGeneration = generation + 1;
      } catch (cause) {
        if (refusal && epoch === started) current = refusal;
        throw cause;
      } finally {if (lock === token) {lock = null; notify(observers);}}
    };
    const session: RenderNativeLightSession = {
      getSnapshot: () => current.snapshot,
      getStatus: () => {
        const status = viewer.status;
        return current.snapshot.disposed ? Object.freeze({...status, state: 'disposed'})
          : indeterminate ? Object.freeze({...status, state: status.state === 'ready' ? 'failed' : status.state}) : status;
      },
      subscribe(listener) {
        mutable(); if (typeof listener !== 'function') fail('DOCUMENT_INPUT', 'Listener must be a function.');
        listeners.add(listener); return () => {if (lock !== null) fail('STALE_CANDIDATE', 'Cannot unsubscribe during a pending operation.'); listeners.delete(listener);};
      },
      setDraftText(value, expected) {
        qualify(expected, () => {draftBudget(value); if (value !== current.snapshot.draftText) current = revise(current, value);}); notify([...listeners]);
      },
      prepareDraft(expected) {
        return qualify(expected, () => {
          const input = parseRenderNativeLightDocument(current.snapshot.draftText);
          if (input.documentId !== current.snapshot.accepted.documentId || !Object.is(input.revision, current.snapshot.accepted.revision))
            fail('STALE_CANDIDATE', 'Draft owner and revision must match the accepted scene.');
          return prepare(revisedDocument(input), 'apply');
        });
      },
      prepareOpen(value, expected) {return qualify(expected, () => prepare(parseRenderNativeLightDocument(value), 'open'));},
      prepareUndo(expected) {return qualify(expected, () => current.index === 0 ? null : prepare(revisedDocument(current.entries[current.index - 1]!.document), 'undo', current.index - 1));},
      prepareRedo(expected) {return qualify(expected, () => current.index === current.entries.length - 1 ? null : prepare(revisedDocument(current.entries[current.index + 1]!.document), 'redo', current.index + 1));},
      async commitPrepared(candidate) {
        mutable(); const token = {}; lock = token; const started = epoch;
        let refusal: State | undefined, observers: readonly (() => void)[] = [];
        try {
          const owned = candidate !== null && typeof candidate === 'object' ? candidates.get(candidate) : undefined;
          if (!owned || owned.used) fail('STALE_CANDIDATE', 'Candidate is foreign, forged, or already consumed.');
          expectedVersion(candidate.expected);
          if (epoch !== started || current.snapshot.disposed) fail('DISPOSED', 'Session disposed during candidate admission.');
          if (owned.viewerGeneration !== viewerGeneration || viewer.accepted.generation !== viewerGeneration)
            fail('STALE_CANDIDATE', 'Viewer generation differs from the prepared candidate.');
          owned.used = true;
          const pending = revise(current, current.snapshot.draftText, current.saved, candidate.purpose);
          refusal = revise(pending); observers = [...listeners];
          current = pending; notify(observers);
          if (epoch !== started || lock !== token) fail('DISPOSED', 'Session disposed before presentation.');
          await present(owned.request, owned.request.owner, viewerGeneration, started);
          if (epoch !== started || current.snapshot.disposed) fail('DISPOSED', 'Session disposed after acknowledgement.');
          current = owned.success; viewerGeneration = owned.viewerGeneration + 1;
        } catch (cause) {
          if (refusal && epoch === started) current = refusal;
          throw cause;
        } finally {
          if (lock === token) {lock = null; notify(observers);}
        }
      },
      navigateViewportCamera: navigate,
      resetViewportCamera: expected => navigate(current.snapshot.accepted.display.camera, expected),
      async pickViewportBody(xPixel, yPixel, expected) {
        mutable(); const token = {}; lock = token; const started = epoch, before = current;
        try {
          expectedVersion(expected);
          const status = viewer.status, width = status.width, height = status.height;
          const check = () => {
            if (epoch !== started || current.snapshot.disposed) fail('DISPOSED', 'Light session disposed during pick.');
            if (current !== before || viewer.accepted.generation !== viewerGeneration || viewer.status.generation !== viewerGeneration
              || !samePins(viewer.accepted.owner, {id: before.snapshot.accepted.documentId, revision: before.snapshot.accepted.revision}))
              fail('STALE_CANDIDATE', 'Pick no longer belongs to the acknowledged scene.');
            if (viewer.status.state !== 'ready') throw presentation('Pick requires an available acknowledged scene.');
            if (viewer.status.width !== width || viewer.status.height !== height || canvas.width !== width || canvas.height !== height)
              fail('STALE_CANDIDATE', 'Pick backing dimensions changed.');
          };
          if (![width, height].every(value => Number.isInteger(value) && value > 0)
            || !Number.isInteger(xPixel) || !Number.isInteger(yPixel) || xPixel < 0 || yPixel < 0 || xPixel >= width || yPixel >= height)
            fail('DOCUMENT_INPUT', 'Pick requires a bounded integer top-left backing pixel.');
          check();
          const prepared = prepareRenderNativeLightDocument(before.snapshot.accepted);
          let picked: Awaited<ReturnType<typeof viewer.pick>>;
          try {picked = await viewer.pick(xPixel, yPixel);} catch (cause) {
            if (epoch !== started || current.snapshot.disposed) fail('DISPOSED', 'Light session disposed during pick.');
            throw presentation(cause);
          }
          check();
          // Copy only descriptors: a malformed provider response cannot run an accessor here.
          let generation: unknown, ref: unknown, binding: unknown;
          try {
            if (!picked || typeof picked !== 'object' || Reflect.ownKeys(picked).length !== 3)
              throw new Error('Exact pick result required.');
            const values = ['generation', 'ref', 'binding'].map(key => {
              const descriptor = Object.getOwnPropertyDescriptor(picked, key);
              if (!descriptor?.enumerable || !('value' in descriptor)) throw new Error('Own pick data required.');
              return descriptor.value;
            });
            [generation, ref, binding] = values;
            if (generation !== viewerGeneration) throw new Error('Pick generation differs from acknowledged scene.');
            if (ref === null && binding === null) return null;
            const matches = prepared.entries.filter(entry => entry.kind === 'surface'
              && prepared.document.display.visibleBodyIds.includes(entry.binding.bodyId)
              && samePins(binding, entry.binding)
              && samePins(ref, {kind: 'surface', modelId: entry.ref.modelId, surfaceId: entry.ref.geometryId})
              && prepared.materials.some(material => material.target.bodyId === entry.binding.bodyId
                && material.ref.modelId === entry.ref.modelId && material.ref.surfaceId === entry.ref.geometryId));
            if (matches.length !== 1) throw new Error('Pick must identify one current visible qualified material-bound body.');
            return matches[0]!.binding.bodyId;
          } catch (cause) {throw presentation(cause);}
        } finally {if (lock === token) lock = null;}
      },
      discardDraft(expected) {qualify(expected, () => {if (current.snapshot.draftText !== current.text) current = revise(current, current.text);}); notify([...listeners]);},
      getSavePayload() {
        if (current.snapshot.disposed) fail('DISPOSED', 'Light session is disposed.');
        const payload = Object.freeze({documentId: current.snapshot.accepted.documentId, revision: current.snapshot.accepted.revision, text: current.text});
        saves.set(payload, current.identity); return payload;
      },
      markSaved(payload) {
        mutable();
        if (!payload || typeof payload !== 'object' || saves.get(payload) !== current.identity) fail('STALE_CANDIDATE', 'Save payload is foreign or no longer the accepted document.');
        if (current.saved !== current.text) {current = revise(current, current.snapshot.draftText, current.text); notify([...listeners]);}
      },
      dispose() {
        if (current.snapshot.disposed) return;
        const disposed = revise(current, current.snapshot.draftText, current.saved, null, true), observers = [...listeners];
        epoch++; lock = null; current = disposed; listeners.clear();
        try {viewer.dispose();} catch (cause) {throw presentation(cause);} finally {notify(observers);}
      },
    };
    return Object.freeze(session);
  } catch (cause) {
    try {viewer.dispose();} catch (cleanup) {throw presentation(new AggregateError([cause, cleanup], 'Session construction and cleanup failed.'));}
    throw cause;
  }
}
