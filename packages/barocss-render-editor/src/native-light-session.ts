import {createNativeDirectionalLightWebGPUViewer, createNativePointLightWebGPUViewer} from '@barocss/viewer';
import type {ViewerNativeDirectionalLightInput, ViewerNativePointLightInput, ViewerNativeDirectionalLightWebGPU, ViewerNativePointLightWebGPU} from '@barocss/viewer';
import type {NativeDirectionalLightWebGPUStatus, NativePointLightWebGPUStatus} from '@barocss/gpu';
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
  readonly pending: RenderNativeLightSessionPurpose | null;
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
  pending: RenderNativeLightSessionPurpose | null = null, disposed = false): State {
  return Object.freeze({text, saved, identity, entries, index, snapshot: Object.freeze({accepted: document, draftText,
    dirty: draftText !== text, unsaved: text !== saved, canUndo: !disposed && index > 0,
    canRedo: !disposed && index < entries.length - 1, pending,
    version: Object.freeze({revision: document.revision, generation}), disposed})});
}
function revise(current: State, draftText = current.snapshot.draftText, saved = current.saved,
  pending: RenderNativeLightSessionPurpose | null = null, disposed = false): State {
  return state(current.snapshot.accepted, current.text, saved, current.identity, current.entries, current.index,
    draftText, current.snapshot.version.generation + 1, pending, disposed);
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
      const nextRequest = createRenderNativeLightRequest(next);
      const success = state(next, canonical, purpose === 'open' ? canonical : current.saved, Object.freeze({}), Object.freeze(entries), index,
        canonical, current.snapshot.version.generation + 2);
      const candidate = Object.freeze({document: next, purpose, expected: current.snapshot.version});
      candidates.set(candidate, {request: nextRequest, success, viewerGeneration, used: false}); return candidate;
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
          let result: Awaited<ReturnType<typeof viewer.replace>>;
          try {result = await viewer.replace(owned.request);} catch (cause) {
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
          if (acknowledgedGeneration !== viewerGeneration + 1 || acknowledgedId !== candidate.document.documentId
            || !Object.is(acknowledgedRevision, candidate.document.revision)) {
            indeterminate = true; throw presentation('Viewer acknowledgement metadata is inconsistent; explicit remount required.');
          }
          current = owned.success; viewerGeneration = owned.viewerGeneration + 1;
        } catch (cause) {
          if (refusal && epoch === started) current = refusal;
          throw cause;
        } finally {
          if (lock === token) {lock = null; notify(observers);}
        }
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
