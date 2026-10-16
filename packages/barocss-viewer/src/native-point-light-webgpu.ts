import { mountNativeBackend, pointDrawing } from './native-backend.js';
import type { NativeBackend, UpdateResult, ViewerWebGPUOptions, ViewerWebGPUStatus } from './native-backend.js';
import type { ViewerGeometryRef } from './index.js';
import { ViewerNativePointLightError, copyOwn, freezeOwn, prepareLightCandidate, refKey, refuse } from './native-point-light-candidate.js';
import type { ViewerNativePointLightInput, ViewerNativePointLightAccepted,
  ViewerNativePointLightPick, LightCandidate } from './native-point-light-candidate.js';

export interface ViewerNativePointLightWebGPU {
  readonly canvas: HTMLCanvasElement;
  readonly originals: ViewerNativePointLightInput;
  readonly accepted: ViewerNativePointLightAccepted;
  readonly selected: ViewerGeometryRef | null;
  readonly status: ViewerWebGPUStatus;
  replace(input: unknown): Promise<UpdateResult>;
  resize(width: number, height: number): Promise<UpdateResult>;
  readPixels(): Promise<Uint8Array>;
  pick(x: number, y: number): Promise<ViewerNativePointLightPick>;
  select(ref: ViewerGeometryRef | null): UpdateResult;
  dispose(): void;
}
const success: UpdateResult = Object.freeze({ ok: true });
function gpuError(cause: unknown): ViewerNativePointLightError {
  return new ViewerNativePointLightError('GPU', cause instanceof Error ? cause.message : 'GPU operation refused', cause);
}
function failure(cause: unknown): UpdateResult {
  return { ok: false, error: cause instanceof ViewerNativePointLightError ? cause : gpuError(cause) };
}
/** Explicit required-WebGPU consumer. Existing createViewer and Editor paths are unchanged. */
export async function createNativePointLightWebGPUViewer(canvas: HTMLCanvasElement, input: unknown,
  options: ViewerWebGPUOptions): Promise<ViewerNativePointLightWebGPU> {
  let current: LightCandidate = prepareLightCandidate(input, 1, null);
  let backend: NativeBackend;
  try { backend = await mountNativeBackend(canvas, current.gpuRequest, options, request => request as typeof current.gpuRequest, pointDrawing); }
  catch (cause) { throw gpuError(cause); }
  try {
    if (backend.status.state !== 'ready') refuse('STATE', 'WebGPU became unavailable during initial presentation');
    let lock: object | null = null, epoch = 0, disposed = false;
    const enter = (): object => {
      if (disposed) refuse('DISPOSED', 'Viewer is disposed');
      if (lock !== null) refuse('BUSY', 'Another Viewer operation is pending');
      if (backend.status.state !== 'ready') refuse('STATE', 'WebGPU is unavailable; explicit remount required');
      const token = {}; lock = token; return token;
    };
    const leave = (token: object | undefined): void => { if (token && lock === token) lock = null; };
    const check = (started: number): void => {
      if (disposed || epoch !== started) refuse('DISPOSED', 'Viewer was disposed during the operation');
    };
    const checkReady = (): void => {
      if (backend.status.state !== 'ready') refuse('STATE', 'WebGPU became unavailable during the operation; explicit remount required');
    };
    const viewer: ViewerNativePointLightWebGPU = {
      canvas,
      get originals() { return freezeOwn(copyOwn(current.originals)); },
      get accepted() { return current.accepted; },
      get selected() { return current.selected === null ? null : freezeOwn(copyOwn(current.selected)); },
      get status() { return backend.status; },
      async replace(next: unknown): Promise<UpdateResult> {
        let token: object | undefined;
        try {
          token = enter(); const started = epoch;
          const candidate = prepareLightCandidate(next, current.accepted.generation + 1, current.selected);
          let result: UpdateResult;
          try { result = await backend.updateFrame(candidate.gpuRequest); }
          catch (cause) { throw gpuError(cause); }
          check(started);
          if (!result.ok) throw gpuError(result.error);
          checkReady();
          // All copies, maps, selection and metadata were completed before presentation.
          current = candidate;
          return success;
        } catch (cause) { return failure(cause); }
        finally { leave(token); }
      },
      async resize(width: number, height: number): Promise<UpdateResult> {
        let token: object | undefined;
        try {
          token = enter(); const started = epoch;
          const candidate: LightCandidate = { ...current,
            accepted: freezeOwn({ ...current.accepted, generation: current.accepted.generation + 1 }) };
          let result: UpdateResult;
          try { result = await backend.resize(width, height); }
          catch (cause) { throw gpuError(cause); }
          check(started);
          if (!result.ok) throw gpuError(result.error);
          checkReady();
          current = candidate;
          return success;
        } catch (cause) { return failure(cause); }
        finally { leave(token); }
      },
      async readPixels(): Promise<Uint8Array> {
        let token: object | undefined;
        try {
          token = enter(); const started = epoch;
          let pixels: Uint8Array;
          try { pixels = await backend.readPixels(); } catch (cause) { throw gpuError(cause); }
          check(started); checkReady(); return pixels;
        } finally { leave(token); }
      },
      async pick(x: number, y: number): Promise<ViewerNativePointLightPick> {
        let token: object | undefined;
        try {
          token = enter(); const started = epoch;
          let picked: Awaited<ReturnType<NativeBackend['pick']>>;
          try { picked = await backend.pick(x, y); } catch (cause) { throw gpuError(cause); }
          check(started); checkReady();
          if (picked.generation !== current.accepted.generation) refuse('STATE', 'Picked generation differs from accepted native metadata');
          if (picked.ref === null) return Object.freeze({ generation: picked.generation, ref: null, binding: null });
          const row = current.visible.get(refKey({ kind: 'surface', modelId: picked.ref.modelId, surfaceId: picked.ref.geometryId }));
          if (!row) refuse('STATE', 'Picked full reference is not an accepted visible Surface');
          return freezeOwn({ generation: picked.generation, ref: copyOwn(row.ref), binding: copyOwn(row.binding) });
        } finally { leave(token); }
      },
      select(ref: ViewerGeometryRef | null): UpdateResult {
        let token: object | undefined;
        try {
          token = enter();
          const owned = copyOwn(ref);
          let selected: ViewerGeometryRef | null = null;
          if (owned !== null) {
            if (!owned || typeof owned !== 'object' || Array.isArray(owned) || owned.kind !== 'surface'
              || Object.keys(owned).length !== 3 || !Object.hasOwn(owned, 'modelId') || !Object.hasOwn(owned, 'surfaceId'))
              refuse('INPUT', 'Exact Surface reference required');
            const row = current.visible.get(refKey(owned));
            if (!row) refuse('STATE', 'Selection must be a current visible full Surface reference');
            selected = freezeOwn(copyOwn(row.ref));
          }
          const candidate = { ...current, selected };
          const result = backend.select(selected && selected.kind === 'surface'
            ? { modelId: selected.modelId, geometryId: selected.surfaceId } : null);
          if (!result.ok) throw gpuError(result.error);
          checkReady();
          current = candidate;
          return success;
        } catch (cause) { return failure(cause); }
        finally { leave(token); }
      },
      dispose(): void {
        if (disposed) return;
        disposed = true; epoch++; lock = null;
        current.selected = null;
        try { backend.dispose(); } catch (cause) { throw gpuError(cause); }
      },
    };
    return Object.freeze(viewer);
  } catch (cause) {
    try { backend.dispose(); }
    catch (cleanup) { throw new ViewerNativePointLightError('GPU', 'Viewer construction and cleanup refused', new AggregateError([cause, cleanup])); }
    throw cause;
  }
}
