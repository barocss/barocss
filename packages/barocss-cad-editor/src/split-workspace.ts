import { mountEngineScene, prepareEngineScene } from '@barocss/gpu';
import type { EngineSceneRenderer } from '@barocss/gpu';
import { CadEditorError } from './types.js';
import { fitSolidSplitScene, pickSolidSplitScene } from './split-scene.js';
import type { SolidSplitSelection } from './split-scene.js';
import { createSplitWorkerClient } from './split-worker-client.js';
import type { SplitWorkerClient } from './split-worker-client.js';
import type { SplitWorkerDisplay, SplitWorkerSummary, SplitWorkerReply, SplitWorkerRequestPayload } from './split-worker-protocol.js';

type Display = SplitWorkerDisplay & { prepared: ReturnType<typeof prepareEngineScene> };
const FILE_LIMIT = 2097152;
export interface SolidSplitWorkspaceSnapshot {
  session: SplitWorkerSummary | null; display: Display | null; selection: SolidSplitSelection | null;
  filename: string; busy: boolean; available: boolean; error: Error | null; disposed: boolean;
  cancelling: boolean; canCancel: boolean; authorityAvailable: boolean;
}
interface Options { initialPresentation?: 'original' | 'split'; initialFilename?: string }
/** Internal transport/display seams; the public React component always uses a real dedicated worker. */
export interface SolidSplitWorkspacePorts {
  createClient: () => SplitWorkerClient;
  mountRenderer: (canvas: HTMLCanvasElement, scene: Display['scene'], size: { width: number; height: number }) => Pick<EngineSceneRenderer, 'update' | 'resize' | 'render' | 'dispose'>;
  yieldPaint: () => Promise<void>;
}
const defaultPorts: SolidSplitWorkspacePorts = {
  createClient: createSplitWorkerClient, mountRenderer: mountEngineScene,
  yieldPaint: () => new Promise(resolve => setTimeout(resolve, 0)),
};
function error(cause: unknown): Error { return cause instanceof Error ? cause : new Error(String(cause)); }
function requireValue(value: unknown, message: string, code: CadEditorError['code'] = 'INPUT'): asserts value {
  if (!value) throw new CadEditorError(code, message, { field: 'solid-split-workspace' });
}
function size(width: number, height: number) {
  requireValue(Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0, 'A finite positive viewport is required.');
  return { width: Math.max(1, Math.min(2048, Math.round(width))), height: Math.max(1, Math.min(2048, Math.round(height))) };
}
function fileText(text: string) {
  requireValue(typeof text === 'string' && text.length <= FILE_LIMIT && new TextEncoder().encode(text).length <= FILE_LIMIT,
    'The authored file exceeds the 2 MiB UTF8/UTF16 limits.', 'BUDGET');
}
function hydrate(dto: SplitWorkerDisplay): Display { return { ...dto, prepared: prepareEngineScene(dto.scene) }; }
function unchanged(cause: unknown) { return cause instanceof Error && 'unchanged' in cause && cause.unchanged === true; }
interface Operation { epoch: number; phase: 'preparing' | 'accepting' | 'working'; cancelled: boolean; nativeStarted: boolean; drain: Promise<void> | null }

/** Main-thread renderer coordinator. Native authority/history/meshing exist only in the dedicated worker. */
export function createSolidSplitWorkspace(initialText: string, options: Options = {}, ports: SolidSplitWorkspacePorts = defaultPorts) {
  let client: SplitWorkerClient | null = null, unsubscribeFailure: (() => void) | null = null;
  let session: SplitWorkerSummary | null = null, renderer: ReturnType<SolidSplitWorkspacePorts['mountRenderer']> | null = null;
  let display: Display | null = null, selection: SolidSplitSelection | null = null;
  let filename = options.initialFilename ?? 'solid-split.translated-strip-plane-split.json';
  let busy = false, available = false, authorityAvailable = true, disposed = false, lastError: Error | null = null;
  let epoch = 0, mountEpoch = 0, mounted = false, viewport = { width: 1, height: 1 };
  let active: Operation | null = null, settling: Promise<void> = Promise.resolve();
  const listeners = new Set<() => void>(), urls = new Set<string>(), urlTimers = new Set<ReturnType<typeof setTimeout>>();
  const emit = () => { for (const listener of [...listeners]) { try { listener(); } catch { /* Observers cannot alter acceptance. */ } } };
  const snapshot = (): SolidSplitWorkspaceSnapshot => ({ session, display, selection, filename, busy, available,
    error: lastError, disposed, cancelling: !!active?.cancelled, canCancel: active?.phase === 'preparing' && !active.cancelled,
    authorityAvailable });
  const live = () => requireValue(!disposed, 'The Solid workspace is disposed.', 'LIFECYCLE');
  const idle = () => { live(); requireValue(!busy, 'Another Solid operation is in progress.'); };
  const ready = () => { idle(); requireValue(mounted && renderer && available && authorityAvailable && session && display, 'The Solid display is unavailable.', 'DISPLAY'); };
  const uncertain = (cause: unknown) => { authorityAvailable = false; available = false; lastError = error(cause); emit(); };
  const request = (payload: SplitWorkerRequestPayload, operation: Operation) => {
    requireValue(client && authorityAvailable, 'The Solid worker authority is unavailable.', 'LIFECYCLE');
    if (payload.type !== 'CANCEL') operation.nativeStarted = true;
    return client.request(payload, { epoch: operation.epoch, generation: session?.generation ?? 0, displayGeneration: session?.displayGeneration ?? 0 });
  };
  const assertActive = (operation: Operation) => requireValue(!disposed && active === operation && !operation.cancelled
    && operation.epoch === epoch && mounted && authorityAvailable, 'Solid operation cancelled before display admission.', 'STALE');
  const ack = (reply: SplitWorkerReply) => {
    requireValue(reply.type === 'ACK' && reply.summary, 'The Solid worker did not confirm accepted authority.', 'LIFECYCLE');
    return reply.summary;
  };
  const restore = (prior: Display, cause: unknown) => {
    try {
      requireValue(renderer && mounted && available, 'The previous display cannot be restored.', 'DISPLAY');
      const result = renderer.update(prior.scene); if (!result.ok) throw result.error;
    } catch (rollback) {
      available = false;
      throw new AggregateError([error(cause), error(rollback)], 'Solid display failed and the previous frame could not be restored.');
    }
  };
  const begin = (phase: Operation['phase']) => {
    const operation: Operation = { epoch: ++epoch, phase, cancelled: false, nativeStarted: false, drain: null };
    active = operation; busy = true; lastError = null; emit(); return operation;
  };
  const finish = async (operation: Operation) => {
    if (operation.drain) await operation.drain;
    if (active === operation) { active = null; busy = false; emit(); }
  };
  const cancel = () => {
    const operation = active;
    if (!operation || operation.phase !== 'preparing' || operation.cancelled || disposed) return;
    operation.cancelled = true; ++epoch; emit();
    if (!client || !authorityAvailable || !operation.nativeStarted) return;
    // Cancellation is a drain barrier, never an interruption claim about synchronous native work.
    operation.drain = request({ type: 'CANCEL', targetEpoch: operation.epoch }, operation).then(reply => {
      requireValue(reply.type === 'ACK' && reply.cancelled, 'The Solid worker did not acknowledge cancellation.', 'LIFECYCLE');
      if (!disposed && reply.summary) session = reply.summary;
    }).catch(cause => { if (!disposed) uncertain(cause); });
  };
  const run = (operation: Operation, action: () => Promise<void>) => {
    const done = (async () => {
      try { await action(); }
      catch (cause) {
        if (!disposed && client && !session) uncertain(cause);
        if (!disposed && !operation.cancelled) lastError = error(cause);
      }
      finally { await finish(operation); }
    })();
    settling = done; return done;
  };
  const perform = async (kind: 'apply' | 'undo' | 'redo', read?: { file: File; replaceDirty: boolean }) => {
    ready(); const state = session!;
    if (kind !== 'apply' || read) requireValue(!Object.hasOwn(state.pending, 'cutY'), 'Apply or discard the Cut Y draft first.');
    if (!read && kind === 'undo') requireValue(state.history.canUndo, 'No earlier Solid state exists.');
    if (!read && kind === 'redo') requireValue(state.history.canRedo, 'No later Solid state exists.');
    if (!read && kind === 'apply' && Object.hasOwn(state.pending, 'cutY')) {
      const raw = state.pending.cutY!;
      requireValue(raw.length <= 128 && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(raw.trim()) && Number.isFinite(Number(raw)),
        'Cut Y must be a finite decimal or exponent number.');
    }
    if (read) {
      requireValue(!state.dirty || read.replaceDirty, 'Choose explicitly whether to replace the current unsaved Solid.');
      requireValue(Number.isSafeInteger(read.file.size) && read.file.size > 0 && read.file.size <= FILE_LIMIT, 'Choose an authored file no larger than 2 MiB.', 'BUDGET');
    }
    const operation = begin('preparing');
    return run(operation, async () => {
      await ports.yieldPaint(); assertActive(operation);
      let command: SplitWorkerRequestPayload = { type: kind === 'apply' ? 'PREPARE_APPLY' : kind === 'undo' ? 'PREPARE_UNDO' : 'PREPARE_REDO' };
      if (read) {
        const bytes = await read.file.arrayBuffer(); assertActive(operation);
        requireValue(bytes.byteLength === read.file.size && bytes.byteLength <= FILE_LIMIT, 'File bytes changed or exceeded the limit.', 'BUDGET');
        const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); fileText(text); command = { type: 'PREPARE_OPEN', text };
      }
      const reply = await request(command, operation);
      if (reply.type === 'ACK') { if (!operation.cancelled) session = ack(reply); return; }
      requireValue(reply.type === 'CANDIDATE', 'A complete Solid candidate is required.', 'DISPLAY');
      if (operation.cancelled || disposed) return;
      const prior = display!; let next: Display; let nextSelection: SolidSplitSelection | null = null;
      try {
        assertActive(operation);
        next = hydrate({ ...reply.display, scene: { ...reply.display.scene, camera: prior.scene.camera } });
        const same = reply.kind !== 'open' && selection && next.bodies.find(body => body.componentId === selection!.componentId && body.bodyId === selection!.bodyId);
        const face = same && selection?.faceId ? same.faces.find(value => value.faceId === selection!.faceId) : undefined;
        nextSelection = !same || (selection?.faceId && !face) ? null : face
          ? { componentId: same.componentId, bodyId: same.bodyId, faceId: face.faceId, role: face.role, orientation: face.orientation, supportRef: face.supportRef }
          : { componentId: same.componentId, bodyId: same.bodyId };
        const updated = renderer!.update(next.scene);
        if (!updated.ok) throw updated.error;
        assertActive(operation);
      } catch (cause) {
        lastError = error(cause);
        try { if (renderer && mounted) restore(prior, cause); }
        catch (rollback) { lastError = error(rollback); throw rollback; }
        finally { cancel(); }
        throw cause;
      }
      // No callback/yield between renderer admission and sending ACCEPT.
      operation.phase = 'accepting';
      const acceptance = request({ type: 'ACCEPT', token: reply.token, rendererAdmitted: true }, operation);
      emit();
      try {
        const committed = ack(await acceptance);
        if (disposed) return;
        session = committed; display = next;
        if (read) filename = read.file.name;
        selection = nextSelection;
      } catch (cause) {
        if (!disposed) {
          if (unchanged(cause)) { if (mounted && renderer) restore(prior, cause); }
          else uncertain(new Error('Solid acceptance was not confirmed. Authority and presentation are unavailable.', { cause }));
        }
        throw cause;
      }
    });
  };
  const unmount = () => {
    ++mountEpoch; mounted = false; available = false;
    cancel(); const owned = renderer; renderer = null; owned?.dispose(); emit();
  };
  const mutate = async (payload: SplitWorkerRequestPayload) => {
    ready(); const operation = begin('working');
    return run(operation, async () => { session = ack(await request(payload, operation)); });
  };
  return {
    getSnapshot: snapshot,
    subscribe(listener: () => void) { live(); listeners.add(listener); return () => { listeners.delete(listener); }; },
    async mount(canvas: HTMLCanvasElement, width: number, height: number) {
      live(); const nextSize = size(width, height); unmount(); const mountTicket = mountEpoch;
      await settling; live(); if (mountTicket !== mountEpoch) return;
      requireValue(authorityAvailable, 'The Solid worker authority is unavailable. Reload this workspace to start a new session.', 'LIFECYCLE');
      mounted = true; viewport = nextSize; const operation = begin('preparing');
      return run(operation, async () => {
        await ports.yieldPaint(); assertActive(operation);
        if (!client) {
          fileText(initialText);
          try { client = ports.createClient(); } catch (cause) { uncertain(cause); throw cause; }
          unsubscribeFailure = client.subscribeFailure(cause => { if (!disposed) uncertain(cause); });
          const reply = await request({ type: 'INIT', text: initialText, initialPresentation: options.initialPresentation ?? 'original' }, operation);
          requireValue(reply.type === 'INIT_READY', 'The Solid worker did not initialize a complete display.', 'LIFECYCLE');
          if (disposed) return;
          session = reply.summary; display = hydrate(reply.display);
        }
        assertActive(operation);
        requireValue(display && session, 'The Solid worker has no retained display.', 'DISPLAY');
        display = fitSolidSplitScene(display, viewport.width / viewport.height);
        renderer = ports.mountRenderer(canvas, display.scene, viewport); available = true;
      });
    },
    unmount,
    markUnavailable(cause: Error) { if (disposed) return; unmount(); lastError = cause; emit(); },
    stageCutYField(raw: string) { requireValue(typeof raw === 'string' && raw.length <= 128, 'Cut Y input must fit 128 characters.', 'BUDGET'); return mutate({ type: 'STAGE', cutY: raw }); },
    discardPending() { return mutate({ type: 'DISCARD' }); },
    apply: () => perform('apply'), undo: () => perform('undo'), redo: () => perform('redo'),
    open: (file: File, replaceDirty: boolean) => perform('apply', { file, replaceDirty }),
    cancelOperation: cancel,
    select(componentId: string, faceId?: string) {
      ready(); const body = display!.bodies.find(value => value.componentId === componentId);
      requireValue(body, 'The selected native Body is not displayed.', 'STALE');
      const face = faceId === undefined ? undefined : body.faces.find(value => value.faceId === faceId);
      requireValue(faceId === undefined || face, 'The selected native Face is not displayed.', 'STALE');
      selection = face ? { componentId, bodyId: body.bodyId, faceId: face.faceId, role: face.role, orientation: face.orientation, supportRef: face.supportRef }
        : { componentId, bodyId: body.bodyId }; emit();
    },
    pick(x: number, y: number) { ready(); selection = pickSolidSplitScene(display!, viewport.width, viewport.height, x, y); emit(); },
    fit(componentId?: string) {
      ready(); const prior = display!;
      try {
        const next = fitSolidSplitScene(prior, viewport.width / viewport.height, componentId);
        const result = renderer!.update(next.scene); if (!result.ok) restore(prior, result.error);
        display = next; lastError = null;
      } catch (cause) { lastError = error(cause); }
      emit();
    },
    resize(width: number, height: number) {
      live(); const next = size(width, height);
      if (!renderer || !available || busy) return;
      try { renderer.resize(next.width, next.height); renderer.render(); viewport = next; }
      catch (cause) { available = false; lastError = error(cause); }
      emit();
    },
    async download() {
      ready(); const operation = begin('working');
      return run(operation, async () => {
        const reply = await request({ type: 'SERIALIZE' }, operation);
        assertActive(operation); requireValue(reply.type === 'SERIALIZED', 'The Solid worker did not serialize accepted authority.', 'FILE');
        const url = URL.createObjectURL(new Blob([reply.download.text], { type: 'application/json' })); urls.add(url);
        const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename;
        document.body.append(anchor);
        try { anchor.click(); session = ack(await request({ type: 'MARK_DOWNLOADED', token: reply.download.token }, operation)); }
        finally {
          anchor.remove();
          if (disposed) { URL.revokeObjectURL(url); urls.delete(url); }
          else { const timer = setTimeout(() => { URL.revokeObjectURL(url); urls.delete(url); urlTimers.delete(timer); }, 0); urlTimers.add(timer); }
        }
      });
    },
    dispose() {
      if (disposed) return; disposed = true; mounted = false; available = false; authorityAvailable = false;
      renderer?.dispose(); renderer = null; unsubscribeFailure?.(); unsubscribeFailure = null; client?.dispose(); client = null;
      for (const timer of urlTimers) clearTimeout(timer); urlTimers.clear();
      for (const url of urls) URL.revokeObjectURL(url); urls.clear(); display = null; selection = null; session = null;
      busy = false; emit(); listeners.clear();
    },
  };
}
