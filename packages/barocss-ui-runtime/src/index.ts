/** The complete server compiler result. Initial state and transport identity stay outside it. */
export interface CompilationArtifactV0 {
  version: 1;
  moduleId: string;
  sourceDigest: string;
  bundleDigest: string;
  bundle: Uint8Array;
  css: string;
  versions: { react: string; reactDom: string; esbuild: string };
}

export interface UiStateV0 { name: string; count: number }

export interface UiModuleRecordV0 {
  version: 1;
  seq: 1;
  type: 'module';
  phase: 'preview';
  streamId: string;
  revision: number;
  moduleId: string;
  sourceDigest: string;
  bundleDigest: string;
  initialState: UiStateV0;
}

export interface UiCommitRecordV0 {
  version: 1;
  seq: 2;
  type: 'commit';
  streamId: string;
  revision: number;
  bundleDigest: string;
}

export type UiStreamRecordV0 = UiModuleRecordV0 | UiCommitRecordV0;

export interface UiSaveRequestV0 {
  state: UiStateV0;
  streamId: string;
  revision: number;
  moduleId: string;
  bundleDigest: string;
  signal: AbortSignal;
}

export interface UiRuntimeOptions {
  container: HTMLElement;
  resolveResource: (record: UiModuleRecordV0, context: {
    instanceId: string;
    hostOrigin: string;
    signal: AbortSignal;
  }) => Promise<{ artifact: CompilationArtifactV0; frameUrl: string }>;
  onSave: (request: UiSaveRequestV0) => void | Promise<void>;
  onState?: (state: UiStateV0) => void;
  onError?: (error: Error) => void;
  mountTimeoutMs?: number;
}

export interface UiRuntimeSnapshot {
  phase: 'idle' | 'receiving' | 'preview' | 'committed' | 'cancelled' | 'error' | 'disposed';
  active: null | { instanceId: string; bundleDigest: string; state: UiStateV0 | null };
  committed: null | { instanceId: string; bundleDigest: string; state: UiStateV0 | null };
}

export interface UiRuntime {
  start(records: AsyncIterable<unknown>): Promise<boolean>;
  cancel(): void;
  hint(initialState: UiStateV0): void;
  inspect(): UiRuntimeSnapshot;
  dispose(): void;
}

type Phase = UiRuntimeSnapshot['phase'];
type Frame = {
  element: HTMLIFrameElement;
  instanceId: string;
  record: UiModuleRecordV0;
  ready: boolean;
  state: UiStateV0 | null;
  used: boolean;
  saving: boolean;
  abort: AbortController;
  mounted: Promise<void>;
  resolveMounted: () => void;
  rejectMounted: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
};
type Ticket = {
  abort: AbortController;
  cancelled: Promise<false>;
  resolveCancelled: () => void;
  iterator: AsyncIterator<unknown>;
  closed: boolean;
};

const digestPattern = /^[a-f0-9]{64}$/;
const idPattern = /^[a-zA-Z0-9_-]{1,64}$/;
const exact = (value: unknown, keys: readonly string[]): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value) &&
  Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
const validState = (value: unknown): value is UiStateV0 =>
  exact(value, ['name', 'count']) && typeof value.name === 'string' && value.name.length <= 80 &&
  Number.isInteger(value.count) && (value.count as number) >= 0 && (value.count as number) <= 1000;
const copyState = (state: UiStateV0): UiStateV0 => ({ name: state.name, count: state.count });
const validModule = (value: unknown): value is UiModuleRecordV0 =>
  exact(value, ['version', 'seq', 'type', 'phase', 'streamId', 'revision', 'moduleId', 'sourceDigest', 'bundleDigest', 'initialState']) &&
  value.version === 1 && value.seq === 1 && value.type === 'module' && value.phase === 'preview' &&
  typeof value.streamId === 'string' && idPattern.test(value.streamId) &&
  Number.isSafeInteger(value.revision) && (value.revision as number) > 0 &&
  typeof value.moduleId === 'string' && idPattern.test(value.moduleId) &&
  typeof value.sourceDigest === 'string' && digestPattern.test(value.sourceDigest) &&
  typeof value.bundleDigest === 'string' && digestPattern.test(value.bundleDigest) && validState(value.initialState);
const validCommit = (value: unknown, module: UiModuleRecordV0): value is UiCommitRecordV0 =>
  exact(value, ['version', 'seq', 'type', 'streamId', 'revision', 'bundleDigest']) &&
  value.version === 1 && value.seq === 2 && value.type === 'commit' &&
  value.streamId === module.streamId && value.revision === module.revision && value.bundleDigest === module.bundleDigest;

async function checkArtifact(artifact: CompilationArtifactV0, record: UiModuleRecordV0): Promise<void> {
  if (!exact(artifact, ['version', 'moduleId', 'sourceDigest', 'bundleDigest', 'bundle', 'css', 'versions']) ||
    artifact.version !== 1 || artifact.moduleId !== record.moduleId ||
    artifact.sourceDigest !== record.sourceDigest || artifact.bundleDigest !== record.bundleDigest ||
    !(artifact.bundle instanceof Uint8Array) || artifact.bundle.byteLength === 0 || artifact.bundle.byteLength > 2_097_152 ||
    typeof artifact.css !== 'string' || !exact(artifact.versions, ['react', 'reactDom', 'esbuild']) ||
    !Object.values(artifact.versions).every((value) => typeof value === 'string')) throw new Error('Invalid compilation artifact');
  const bytes = await crypto.subtle.digest('SHA-256', new Uint8Array(artifact.bundle));
  const digest = Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
  if (digest !== record.bundleDigest) throw new Error('Compilation bundle digest mismatch');
}

/** Owns only browser frames, admission and bridge checks. The host owns resource and action policy. */
export function createUiRuntime(options: UiRuntimeOptions): UiRuntime {
  if (!(options.container instanceof HTMLElement) || typeof options.resolveResource !== 'function' ||
    typeof options.onSave !== 'function') throw new TypeError('Invalid UI runtime options');
  const hostOrigin = window.location.origin;
  const mountTimeoutMs = options.mountTimeoutMs ?? 5000;
  if (!Number.isFinite(mountTimeoutMs) || mountTimeoutMs <= 0) throw new RangeError('Invalid mount timeout');
  let phase: Phase = 'idle';
  let active: Frame | null = null;
  let committed: Frame | null = null;
  let ticket: Ticket | null = null;
  let disposed = false;

  const report = (error: unknown) => {
    try { options.onError?.(error instanceof Error ? error : new Error(String(error))); }
    catch { /* A host error reporter cannot change frame admission. */ }
  };
  const sendInit = (frame: Frame, initialState = frame.record.initialState) => {
    if (frame.ready && frame.element.contentWindow) frame.element.contentWindow.postMessage({
      type: 'init', instanceId: frame.instanceId, bundleDigest: frame.record.bundleDigest,
      initialState: copyState(initialState),
      canSave: phase === 'committed' && active === frame && committed === frame && !frame.used && !frame.saving,
    }, '*'); // A sandboxed frame has opaque origin. The child checks hostOrigin from its document metadata.
  };
  const removeFrame = (frame: Frame | null) => {
    if (!frame) return;
    clearTimeout(frame.timeout);
    frame.abort.abort();
    frame.rejectMounted(new DOMException('Frame disposed', 'AbortError'));
    frame.element.remove();
  };
  const restore = (nextPhase: Phase) => {
    if (active && active !== committed) removeFrame(active);
    active = committed;
    if (active) active.element.hidden = false;
    phase = nextPhase;
    if (active) sendInit(active);
  };
  const closeIterator = (current: Ticket) => {
    if (current.closed) return;
    current.closed = true;
    try { void Promise.resolve(current.iterator.return?.()).catch(() => {}); }
    catch { /* Source cleanup cannot change a frame transition. */ }
  };
  const stopTicket = () => {
    const current = ticket;
    ticket = null;
    if (current) {
      current.abort.abort();
      current.resolveCancelled();
      closeIterator(current);
    }
  };
  const handleMessage = (event: MessageEvent) => {
    const frame = active;
    const data: unknown = event.data;
    if (!frame || event.source !== frame.element.contentWindow || event.origin !== 'null' ||
      !exact(data, ['type', 'instanceId', 'bundleDigest']) && !exact(data, ['type', 'instanceId', 'bundleDigest', 'state'])) return;
    if (data.instanceId !== frame.instanceId || data.bundleDigest !== frame.record.bundleDigest) return;
    if (data.type === 'ready' && exact(data, ['type', 'instanceId', 'bundleDigest'])) {
      frame.ready = true;
      sendInit(frame);
      return;
    }
    if (!exact(data, ['type', 'instanceId', 'bundleDigest', 'state']) || !validState(data.state) ||
      (data.type !== 'state' && data.type !== 'save') || !frame.ready) return;
    frame.state = copyState(data.state);
    try { options.onState?.(copyState(frame.state)); } catch (error) { report(error); }
    if (data.type === 'state') {
      clearTimeout(frame.timeout);
      frame.resolveMounted();
    } else if (phase === 'committed' && frame === committed && !frame.used && !frame.saving) {
      frame.saving = true;
      sendInit(frame);
      const request: UiSaveRequestV0 = {
        state: copyState(frame.state), streamId: frame.record.streamId, revision: frame.record.revision,
        moduleId: frame.record.moduleId, bundleDigest: frame.record.bundleDigest, signal: frame.abort.signal,
      };
      void Promise.resolve().then(() => options.onSave(request)).then(() => {
        frame.used = true;
      }).catch(report).finally(() => {
        frame.saving = false;
        if (!disposed && active === frame) sendInit(frame);
      });
    }
  };
  window.addEventListener('message', handleMessage);

  const mount = (record: UiModuleRecordV0, instanceId: string, frameUrl: string): Frame => {
    const url = new URL(frameUrl, window.location.href);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('Invalid frame URL');
    const element = document.createElement('iframe');
    element.setAttribute('sandbox', 'allow-scripts');
    element.title = 'Compiled UI';
    let resolveMounted!: () => void;
    let rejectMounted!: (error: Error) => void;
    const mounted = new Promise<void>((resolve, reject) => { resolveMounted = resolve; rejectMounted = reject; });
    void mounted.catch(() => {});
    const frame: Frame = {
      element, instanceId, record, ready: false, state: null, used: false, saving: false,
      abort: new AbortController(), mounted, resolveMounted, rejectMounted,
      timeout: setTimeout(() => rejectMounted(new Error('Frame mount timeout')), mountTimeoutMs),
    };
    active = frame;
    options.container.append(element);
    element.src = url.href;
    return frame;
  };

  const start = async (records: AsyncIterable<unknown>): Promise<boolean> => {
    if (disposed) throw new Error('UI runtime disposed');
    stopTicket();
    if (active && active !== committed) removeFrame(active);
    if (committed) { committed.element.hidden = true; active = null; }
    phase = 'receiving';
    let iterator: AsyncIterator<unknown>;
    try {
      iterator = records[Symbol.asyncIterator]();
      if (!iterator || typeof iterator.next !== 'function') throw new TypeError('Invalid UI source iterator');
    } catch (error) {
      report(error);
      restore('error');
      return false;
    }
    const abort = new AbortController();
    let resolveCancelled!: () => void;
    const cancelled = new Promise<false>((resolve) => { resolveCancelled = () => resolve(false); });
    const current: Ticket = { abort, cancelled, resolveCancelled, iterator, closed: false };
    ticket = current;
    const next = () => Promise.race([iterator.next(), cancelled]);
    try {
      const first = await next();
      if (first === false) return false;
      if (first.done || !validModule(first.value)) throw new Error('Invalid UI module record');
      const record = first.value;
      if (committed?.record.bundleDigest === record.bundleDigest) {
        active = committed;
        active.element.hidden = false;
        sendInit(active, record.initialState);
      } else {
        const instanceId = crypto.randomUUID();
        const resource = await Promise.race([options.resolveResource(record, { instanceId, hostOrigin, signal: abort.signal }), cancelled]);
        if (resource === false) return false;
        await checkArtifact(resource.artifact, record);
        if (ticket !== current) return false;
        mount(record, instanceId, resource.frameUrl);
      }
      phase = 'preview';
      const second = await next();
      if (second === false) return false;
      if (second.done || !validCommit(second.value, record)) throw new Error('Invalid UI commit record');
      const end = await next();
      if (end === false) return false;
      if (!end.done) throw new Error('UI stream has trailing records');
      const frame = active;
      if (!frame) throw new Error('UI frame missing');
      const mounted = await Promise.race([frame.mounted.then(() => true), cancelled]);
      if (!mounted || ticket !== current) return false;
      if (committed && committed !== frame) removeFrame(committed);
      frame.record = record;
      committed = frame;
      active = frame;
      frame.used = false;
      phase = 'committed';
      ticket = null;
      sendInit(frame);
      return true;
    } catch (error) {
      if (ticket !== current) return false;
      report(error);
      restore('error');
      return false;
    } finally {
      if (ticket === current) ticket = null;
      abort.abort();
      closeIterator(current);
    }
  };
  return {
    start,
    cancel() {
      if (disposed) return;
      stopTicket();
      restore('cancelled');
    },
    hint(initialState) {
      if (disposed) throw new Error('UI runtime disposed');
      if (!validState(initialState)) throw new TypeError('Invalid state hint');
      if (active) sendInit(active, initialState);
    },
    inspect() {
      const view = (frame: Frame | null) => frame ? {
        instanceId: frame.instanceId, bundleDigest: frame.record.bundleDigest,
        state: frame.state ? copyState(frame.state) : null,
      } : null;
      return { phase, active: view(active), committed: view(committed) };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      stopTicket();
      removeFrame(active);
      if (committed !== active) removeFrame(committed);
      active = null;
      committed = null;
      phase = 'disposed';
      window.removeEventListener('message', handleMessage);
    },
  };
}
