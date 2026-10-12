import { mountEngineScene, prepareEngineScene } from '@barocss/gpu';
import type { EngineSceneRenderer } from '@barocss/gpu';
import { createCadEditorSplitSession } from './split-session.js';
import type { CadEditorSplitCandidate, CadEditorSplitSession, CadEditorSplitSnapshot } from './split-types.js';
import { CadEditorError } from './types.js';
import { prepareSolidSplitScene, fitSolidSplitScene, pickSolidSplitScene } from './split-scene.js';
import type { SolidSplitSceneReceipt, SolidSplitSelection } from './split-scene.js';

const FILE_LIMIT = 2097152;
export interface SolidSplitWorkspaceSnapshot {
  session: CadEditorSplitSnapshot | null;
  display: SolidSplitSceneReceipt | null;
  selection: SolidSplitSelection | null;
  filename: string;
  busy: boolean;
  available: boolean;
  error: Error | null;
  disposed: boolean;
}
interface Options { initialPresentation?: 'original' | 'split'; initialFilename?: string }
/** Internal seams exercise ordering only; the public React component always uses real providers. */
export interface SolidSplitWorkspacePorts {
  createSession: typeof createCadEditorSplitSession;
  prepareScene: typeof prepareSolidSplitScene;
  mountRenderer: (canvas: HTMLCanvasElement, scene: SolidSplitSceneReceipt['scene'], size: { width: number; height: number }) => Pick<EngineSceneRenderer, 'update' | 'resize' | 'render' | 'dispose'>;
  yieldPaint: () => Promise<void>;
}
const defaultPorts: SolidSplitWorkspacePorts = {
  createSession: createCadEditorSplitSession, prepareScene: prepareSolidSplitScene, mountRenderer: mountEngineScene,
  yieldPaint: () => new Promise(resolve => {
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => setTimeout(resolve, 0));
    else setTimeout(resolve, 0);
  }),
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
  requireValue(typeof text === 'string' && text.length <= FILE_LIMIT
    && new TextEncoder().encode(text).length <= FILE_LIMIT, 'The authored file exceeds the 2 MiB UTF8/UTF16 limits.', 'BUDGET');
}

/** Exclusive owner of the unchanged native session and its display-before-commit transaction. */
export function createSolidSplitWorkspace(initialText: string, options: Options = {}, ports: SolidSplitWorkspacePorts = defaultPorts) {
  let session: CadEditorSplitSession | null = null;
  let renderer: ReturnType<SolidSplitWorkspacePorts['mountRenderer']> | null = null;
  let display: SolidSplitSceneReceipt | null = null, selection: SolidSplitSelection | null = null;
  let filename = options.initialFilename ?? 'solid-split.translated-strip-plane-split.json';
  let busy = false, available = false, disposed = false, lastError: Error | null = null;
  let epoch = 0, mounted = false, viewport = { width: 1, height: 1 };
  const listeners = new Set<() => void>();
  const urls = new Set<string>();
  const emit = () => { for (const listener of [...listeners]) { try { listener(); } catch { /* Observers cannot alter acceptance. */ } } };
  const snapshot = (): SolidSplitWorkspaceSnapshot => ({ session: session?.getSnapshot() ?? null,
    display, selection, filename, busy, available, error: lastError, disposed });
  const live = () => requireValue(!disposed, 'The Solid workspace is disposed.', 'LIFECYCLE');
  const idle = () => { live(); requireValue(!busy, 'Another Solid operation is in progress.'); };
  const ready = () => { idle(); requireValue(mounted && renderer && available && session && display, 'The Solid display is unavailable.', 'DISPLAY'); };
  const current = (operation: number) => !disposed && mounted && operation === epoch;
  const cancelOwn = (candidate: CadEditorSplitCandidate | null) => {
    if (candidate && session && !session.getSnapshot().disposed && session.getSnapshot().candidate?.token === candidate.token)
      session.cancelCandidate(candidate.token);
  };
  const assertCandidate = (candidate: CadEditorSplitCandidate, operation: number) => {
    const state = session!.getSnapshot();
    requireValue(current(operation) && available && renderer && state.candidate?.token === candidate.token
      && state.generation === candidate.baseGeneration && state.displayGeneration === candidate.baseDisplayGeneration,
    'The Solid candidate or mounted display changed.', 'STALE');
  };
  const restore = (prior: SolidSplitSceneReceipt, cause: unknown) => {
    try {
      requireValue(renderer && mounted && available, 'The previous display cannot be restored.', 'DISPLAY');
      const result = renderer.update(prior.scene);
      if (!result.ok) throw result.error;
    } catch (rollback) {
      available = false;
      throw new AggregateError([error(cause), error(rollback)], 'Solid display failed and the previous frame could not be restored. Accepted native authority is retained.');
    }
    throw cause;
  };
  const commit = (candidate: CadEditorSplitCandidate, operation: number) => {
    assertCandidate(candidate, operation);
    const prior = display!;
    let next = ports.prepareScene(candidate.presentation, candidate.result);
    // Preserve the user's accepted camera across model/history/file changes.
    const scene = { ...next.scene, camera: prior.scene.camera };
    next = { ...next, scene, prepared: prepareEngineScene(scene) };
    assertCandidate(candidate, operation);
    const updated = renderer!.update(next.scene);
    if (!updated.ok) restore(prior, updated.error);
    // No asynchronous boundary, emit, or user callback is permitted here.
    try { assertCandidate(candidate, operation); session!.acceptCandidate(candidate.token); }
    catch (cause) { restore(prior, cause); }
    display = next;
    const same = candidate.kind !== 'open' && selection && next.bodies.find(body => body.componentId === selection!.componentId && body.bodyId === selection!.bodyId);
    const face = same && selection?.faceId ? same.faces.find(value => value.faceId === selection!.faceId) : undefined;
    // Requalify from the accepted receipt. Triangle/UV details never survive a model commit.
    selection = !same || (selection?.faceId && !face) ? null : face
      ? { componentId: same.componentId, bodyId: same.bodyId, faceId: face.faceId,
          role: face.role, orientation: face.orientation, supportRef: face.supportRef }
      : { componentId: same.componentId, bodyId: same.bodyId };
  };
  const perform = async (kind: 'apply' | 'undo' | 'redo', read?: { file: File; replaceDirty: boolean }) => {
    ready();
    const state = session!.getSnapshot();
    requireValue(!state.candidate, 'Resolve the current candidate first.');
    if (kind !== 'apply' || read) requireValue(!Object.hasOwn(state.pending, 'cutY'), 'Apply or discard the Cut Y draft first.');
    if (!read && kind === 'undo') requireValue(state.history.canUndo, 'No earlier Solid state exists.');
    if (!read && kind === 'redo') requireValue(state.history.canRedo, 'No later Solid state exists.');
    if (!read && kind === 'apply' && Object.hasOwn(state.pending, 'cutY')) {
      const raw = state.pending.cutY!;
      requireValue(raw.length <= 128 && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(raw.trim()) && Number.isFinite(Number(raw)), 'Cut Y must be a finite decimal or exponent number.');
    }
    if (read) {
      requireValue(!state.dirty || read.replaceDirty, 'Choose explicitly whether to replace the current unsaved Solid.');
      requireValue(Number.isSafeInteger(read.file.size) && read.file.size > 0 && read.file.size <= FILE_LIMIT, 'Choose an authored file no larger than 2 MiB.', 'BUDGET');
    }
    const operation = ++epoch;
    busy = true; lastError = null; emit();
    let candidate: CadEditorSplitCandidate | null = null;
    try {
      await ports.yieldPaint();
      requireValue(current(operation), 'Solid operation cancelled before native work.', 'STALE');
      const now = session!.getSnapshot();
      requireValue(now.generation === state.generation && now.displayGeneration === state.displayGeneration && !now.candidate, 'Solid state changed before native work.', 'STALE');
      if (read) {
        const bytes = await read.file.arrayBuffer();
        requireValue(current(operation), 'File read cancelled.', 'STALE');
        requireValue(bytes.byteLength === read.file.size && bytes.byteLength <= FILE_LIMIT, 'File bytes changed or exceeded the limit.', 'BUDGET');
        const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); fileText(text);
        candidate = session!.prepareOpen(text);
      } else candidate = kind === 'apply' ? session!.prepareApply() : kind === 'undo' ? session!.prepareUndo() : session!.prepareRedo();
      if (candidate) commit(candidate, operation);
      if (read && candidate) filename = read.file.name;
    } catch (cause) {
      cancelOwn(candidate);
      if (operation === epoch && !disposed) lastError = error(cause);
    } finally { if (operation === epoch) { busy = false; emit(); } }
  };
  const unmount = () => {
    epoch++; mounted = false; busy = false; available = false;
    const owned = renderer; renderer = null; owned?.dispose();
    if (session) cancelOwn(session.getSnapshot().candidate);
    emit();
  };
  return {
    getSnapshot: snapshot,
    subscribe(listener: () => void) { live(); listeners.add(listener); return () => { listeners.delete(listener); }; },
    async mount(canvas: HTMLCanvasElement, width: number, height: number) {
      live(); const nextSize = size(width, height);
      unmount(); mounted = true; viewport = nextSize;
      const operation = ++epoch; busy = true; lastError = null; emit();
      try {
        await ports.yieldPaint();
        requireValue(current(operation), 'Solid mount cancelled.', 'STALE');
        if (!session) { fileText(initialText); session = ports.createSession(initialText, { initialPresentation: options.initialPresentation ?? 'original' }); }
        requireValue(current(operation), 'Solid mount cancelled after reconstruction.', 'STALE');
        if (!display) {
          const state = session.getSnapshot();
          display = fitSolidSplitScene(ports.prepareScene(state.presentation, state.accepted), viewport.width / viewport.height);
        }
        renderer = ports.mountRenderer(canvas, display.scene, viewport); available = true;
      } catch (cause) { if (operation === epoch) { available = false; lastError = error(cause); } }
      finally { if (operation === epoch) { busy = false; emit(); } }
    },
    unmount,
    markUnavailable(cause: Error) { if (disposed) return; epoch++; busy = false; available = false; lastError = cause; emit(); },
    stageCutYField(raw: string) { idle(); requireValue(session, 'The Solid is still loading.'); session.stageCutYField(raw); lastError = null; emit(); },
    discardPending() { idle(); requireValue(session, 'The Solid is still loading.'); session.discardPending(); lastError = null; emit(); },
    apply: () => perform('apply'), undo: () => perform('undo'), redo: () => perform('redo'),
    open: (file: File, replaceDirty: boolean) => perform('apply', { file, replaceDirty }),
    cancelOperation() { if (disposed) return; epoch++; busy = false; if (session) cancelOwn(session.getSnapshot().candidate); emit(); },
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
      ready(); const operation = ++epoch; busy = true; lastError = null; emit();
      try {
        await ports.yieldPaint(); requireValue(current(operation), 'Download cancelled.', 'STALE');
        const captured = session!.serializeAccepted();
        requireValue(current(operation), 'Download changed after capture.', 'STALE');
        const url = URL.createObjectURL(new Blob([captured.text], { type: 'application/json' })); urls.add(url);
        const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename;
        document.body.append(anchor);
        try { anchor.click(); session!.markDownloaded(captured.token); }
        finally { anchor.remove(); setTimeout(() => { URL.revokeObjectURL(url); urls.delete(url); }, 0); }
      } catch (cause) { if (operation === epoch) lastError = error(cause); }
      finally { if (operation === epoch) { busy = false; emit(); } }
    },
    dispose() { if (disposed) return; unmount(); disposed = true; session?.dispose(); session = null; display = null; selection = null;
      for (const url of urls) URL.revokeObjectURL(url); urls.clear(); emit(); listeners.clear(); },
  };
}
