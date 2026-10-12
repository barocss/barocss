import type { SplitWorkerIdentity, SplitWorkerReply, SplitWorkerRequestPayload } from './split-worker-protocol.js';
import { validateSplitWorkerReply, deserializeSplitWorkerError } from './split-worker-protocol.js';

export interface SplitWorkerTransport {
  postMessage(message: unknown): void;
  addEventListener(type: string, listener: (event: MessageEvent | Event) => void): void;
  removeEventListener(type: string, listener: (event: MessageEvent | Event) => void): void;
  terminate(): void;
}
export interface SplitWorkerExpectation { epoch: number; generation: number; displayGeneration: number }
export interface SplitWorkerClient {
  request(payload: SplitWorkerRequestPayload, expected: SplitWorkerExpectation): Promise<SplitWorkerReply>;
  readonly unavailable: boolean;
  subscribeFailure(listener: (cause: Error) => void): () => void;
  dispose(): void;
}
export class SplitWorkerFailure extends Error {
  readonly unchanged = false;
  constructor(message: string, cause?: unknown) { super(message, { cause }); this.name = 'SplitWorkerFailure'; }
}
let sequence = 0;
/** Private worker transport. No native session, mesh provider or synchronous fallback. */
export function createSplitWorkerClient(options: {
  createWorker?: () => SplitWorkerTransport; timeoutMS?: number;
  onMetrics?: (metrics: { requestId: number; senderPostMS: number; ingestionMS: number; roundTripMS: number }) => void;
} = {}): SplitWorkerClient {
  const workspaceId = `solid-worker-${Date.now()}-${++sequence}`;
  const worker = options.createWorker ? options.createWorker()
    : new Worker(new URL('./split-worker.ts', import.meta.url), { type: 'module' }) as unknown as SplitWorkerTransport;
  const timeout = options.timeoutMS ?? 180000;
  if (!Number.isFinite(timeout) || timeout <= 0 || timeout > 180000) { worker.terminate(); throw new Error('Invalid worker timeout.'); }
  let requestId = 0, dead = false;
  const listeners = new Set<(cause: Error) => void>();
  const pending = new Map<number, { identity: SplitWorkerIdentity; type: string; started: number; senderPostMS: number;
    timer: ReturnType<typeof setTimeout>; resolve: (reply: SplitWorkerReply) => void; reject: (cause: Error) => void }>();
  const detach = () => {
    worker.removeEventListener('message', receive); worker.removeEventListener('error', failed);
    worker.removeEventListener('messageerror', failed); worker.terminate();
  };
  const fail = (cause: Error) => {
    if (dead) return; dead = true; detach();
    for (const entry of pending.values()) { clearTimeout(entry.timer); entry.reject(cause); }
    pending.clear();
    for (const listener of [...listeners]) { try { listener(cause); } catch { /* Observers own their failures. */ } }
  };
  function failed(event: Event) { fail(new SplitWorkerFailure('The Solid worker is unavailable; accepted authority cannot be confirmed.', event)); }
  function receive(event: MessageEvent | Event) {
    if (dead) return;
    const start = performance.now();
    try {
      const data = (event as MessageEvent).data;
      validateSplitWorkerReply(data);
      // Replies for another worker instance can never affect this workspace.
      if (data.workspaceId !== workspaceId) return;
      const entry = pending.get(data.requestId);
      if (!entry) return; // Bounded duplicate/late ACK is inert.
      const identity = entry.identity;
      if (data.epoch !== identity.epoch || data.generation !== identity.generation
        || data.displayGeneration !== identity.displayGeneration) throw new Error('Worker reply identity does not match the request.');
      if (data.type !== 'ERROR') {
        const allowed = entry.type === 'INIT' ? ['INIT_READY'] : entry.type.startsWith('PREPARE_') ? ['CANDIDATE', 'ACK']
          : entry.type === 'SERIALIZE' ? ['SERIALIZED'] : ['ACK'];
        if (!allowed.includes(data.type)) throw new Error('Unexpected worker reply type.');
        if (data.type === 'CANDIDATE' && data.kind !== entry.type.slice(8).toLowerCase()) throw new Error('Unexpected worker candidate kind.');
        if (data.type === 'ACK' && data.cancelled !== (entry.type === 'CANCEL')) throw new Error('Unexpected cancellation acknowledgement.');
        if (!data.summary && entry.type !== 'DISPOSE' && entry.type !== 'CANCEL') throw new Error('Worker summary is missing.');
        if (data.summary) {
          const delta = entry.type === 'ACCEPT' ? 1 : 0;
          if (data.summary.generation !== identity.generation + delta || data.summary.displayGeneration !== identity.displayGeneration + delta)
            throw new Error('Worker summary generation does not match the transition.');
        }
        if (data.type === 'INIT_READY' && data.summary.presentation.kind !== data.display.presentationKind)
          throw new Error('Initial authority and display disagree.');
      }
      pending.delete(data.requestId); clearTimeout(entry.timer);
      const ingestionMS = performance.now() - start;
      try { options.onMetrics?.({ requestId: data.requestId, senderPostMS: entry.senderPostMS,
        ingestionMS, roundTripMS: performance.now() - entry.started }); } catch { /* Metrics cannot change acceptance. */ }
      if (data.type === 'ERROR') {
        const cause = deserializeSplitWorkerError(data.error);
        Object.defineProperty(cause, 'unchanged', { value: data.unchanged });
        Object.defineProperty(cause, 'cancelled', { value: data.cancelled }); entry.reject(cause);
      } else entry.resolve(data);
    } catch (cause) { fail(new SplitWorkerFailure('Invalid Solid worker reply; authority is unavailable.', cause)); }
  }
  worker.addEventListener('message', receive); worker.addEventListener('error', failed); worker.addEventListener('messageerror', failed);
  return {
    get unavailable() { return dead; },
    subscribeFailure(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    request(payload, expected) {
      if (dead) return Promise.reject(new SplitWorkerFailure('The Solid worker is unavailable.'));
      if (pending.size && (payload.type !== 'CANCEL' || [...pending.values()].some(value => value.type === 'CANCEL')))
        return Promise.reject(new Error('Another Solid worker request is in progress.'));
      if (++requestId > 1_000_000_000) { fail(new SplitWorkerFailure('Worker request limit reached.')); return Promise.reject(new Error('Worker request limit reached.')); }
      const identity: SplitWorkerIdentity = { protocol: 'barocss-cad-editor-split-worker', version: 0, workspaceId, requestId, ...expected };
      return new Promise((resolve, reject) => {
        const entry = { identity, type: payload.type, started: performance.now(), senderPostMS: 0,
          timer: setTimeout(() => fail(new SplitWorkerFailure('The Solid worker timed out; authority cannot be confirmed.')), timeout), resolve, reject };
        pending.set(requestId, entry);
        try { const start = performance.now(); worker.postMessage({ ...identity, ...payload }); entry.senderPostMS = performance.now() - start; }
        catch (cause) { fail(new SplitWorkerFailure('The Solid worker could not receive the request.', cause)); }
      });
    },
    dispose() { fail(new SplitWorkerFailure('The Solid worker was disposed.')); listeners.clear(); },
  };
}
