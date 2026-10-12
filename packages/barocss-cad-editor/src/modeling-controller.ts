import { preparePrismFeatureScene, pickPrismFeatureScene } from './prism-feature-scene.js';
import type { PrismDisplayScene, PrismFaceSelection } from './prism-feature-scene.js';
import type { PrismDisplayPort, PrismDisplayCandidate } from './prism-feature-display.js';
import type { CadEditorModelingExample, CadEditorModelingSplitAxis, CadEditorModelingSummary, ModelingCommand, ModelingReply } from './modeling-engine.js';
import { validatePrismFeatureNativeReply } from './prism-feature-controller.js';
import type { CadEditorPrismFeatureSummary } from './prism-feature-types.js';

export interface CadEditorModelingSnapshot {
  accepted: CadEditorModelingSummary | null; authoredText: string | null;
  display: PrismDisplayScene | null; faceSelection: (PrismFaceSelection & { generation: number }) | null;
  drafts: Record<string, string>; selection: number | null; generation: number;
  busy: boolean; disposed: boolean; error: string | null;
  history: { index: number; count: number; canUndo: boolean; canRedo: boolean };
}
type Success = Extract<ModelingReply, { ok: true }>;
type Payload = ModelingCommand extends infer C ? C extends ModelingCommand ? Omit<C, 'id'> : never : never;
const FILE_LIMIT = 262144, HISTORY_BYTES = 8 * 1024 * 1024;
const clone = <T>(value: T): T => structuredClone(value);
function same(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
  const x = a as Record<string, unknown>, y = b as Record<string, unknown>;
  return Object.keys(x).length === Object.keys(y).length && Object.keys(x).every(k => Object.hasOwn(y, k) && same(x[k], y[k]));
}
function scalar(raw: string): number {
  if (raw.length > 128 || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(raw.trim())) throw new Error('Enter a finite decimal millimetre value.');
  const value = Number(raw);
  if (value === 0 && /[1-9]/.test(raw.trim().split(/[eE]/)[0])) throw new Error('The nonzero dimension is too small to represent.');
  if (!Number.isFinite(value) || Math.abs(value) > 10000) throw new Error('Use millimetres between -10000 and 10000.');
  return value;
}
function sourceMatches(reply: Success) {
  const { summary } = reply, data = JSON.parse(reply.text);
  if (!summary || !Number.isSafeInteger(summary.revision) || summary.revision < 0 || typeof summary.documentId !== 'string'
    || !summary.parameters || typeof summary.parameters !== 'object' || Array.isArray(summary.parameters)
    || Object.keys(summary.parameters).length > 16 || !Object.values(summary.parameters).every(Number.isFinite)
    || !Array.isArray(summary.features) || summary.features.length > 6 || !Array.isArray(summary.outputs) || summary.outputs.length > 8)
    throw new Error('Invalid native model summary.');
  if (summary.source === 'model') {
    if (data?.format !== 'barocss-cad-model' || data.schema !== 1 || data.units !== 'mm' || !same(data.parameters, summary.parameters)
      || !Array.isArray(data.nodes) || !same(data.nodes.map((n: { kind: string }) => n.kind), summary.features.map(f => f.kind))
      || !same(Object.keys(data.outputs), summary.outputs.map(o => o.name)) || reply.compatibility !== undefined) throw new Error('Saved model differs from native summary.');
  } else if (summary.source === 'legacy') {
    if (data?.format !== 'barocss-xy-affine-prism-feature-document' || ![0, 2].includes(data.version)
      || data.id !== summary.documentId || data.revision !== summary.revision
      || !same(Object.fromEntries(data.parameters.map((p: { id: string; valueMM: number }) => [p.id, p.valueMM])), summary.parameters)
      || !same(data.nodes.map((n: { kind: string }) => n.kind), summary.features.map(f => f.kind))) throw new Error('Legacy source differs from native summary.');
    const legacy = reply.compatibility;
    if (!legacy || !same(data, legacy.document) || JSON.stringify(legacy).length > FILE_LIMIT
      || !same(legacy.components.filter(c => c.status === 'solid').map(c => [c.role, c.solidId]), summary.outputs.map(o => [o.name, o.solidId])))
      throw new Error('Legacy native summary differs from saved source.');
    validatePrismFeatureNativeReply({ id: reply.id, ok: true, text: reply.text, summary: legacy, display: reply.display });
  } else throw new Error('Unknown native source summary.');
  if (!summary.features.every((f, i) => typeof f.kind === 'string' && f.kind.length > 0 && f.kind.length <= 64 && f.kind.trim().length > 0 && f.index === i && Array.isArray(f.dependencies)
    && f.dependencies.every(d => Number.isInteger(d) && d >= 0 && d < i))) throw new Error('Invalid feature dependencies.');
  if (!reply.display || reply.display.documentId !== summary.documentId || reply.display.revision !== summary.revision
    || !same(reply.display.outcomes.filter(o => o.status === 'solid').map(o => [o.role, o.solidId]), summary.outputs.map(o => [o.name, o.solidId])))
    throw new Error('Named output display differs from native summary.');
  return data as unknown;
}

/** One authoring session. Generations protect freshness even when native IDs are reused. */
export function createCadEditorModelingController(displayPort?: PrismDisplayPort, aspect: () => number = () => 1) {
  let state: CadEditorModelingSnapshot = { accepted: null, authoredText: null, display: null, faceSelection: null,
    drafts: {}, selection: null, generation: 0, busy: false, disposed: false, error: null,
    history: { index: -1, count: 0, canUndo: false, canRedo: false } };
  let worker: Worker | null = null, ready = false, sequence = 0, epoch = 0, index = -1;
  let history: { parameters: Record<string, number>; bytes: number }[] = [];
  let pending: { id: number; resolve: (reply: Success) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> } | null = null;
  const listeners = new Set<() => void>();
  const emit = () => { for (const listener of listeners) { try { listener(); } catch { /* Subscriber isolation. */ } } };
  const live = () => { if (state.disposed) throw new Error('The modeling session is disposed.'); };
  const idle = () => { live(); if (state.busy) throw new Error('A native operation is in progress.'); };
  const stop = (message: string) => {
    worker?.terminate(); worker = null; ready = false;
    if (pending) { const prior = pending; pending = null; clearTimeout(prior.timer); prior.reject(new Error(message)); }
  };
  const request = (payload: Payload) => new Promise<Success>((resolve, reject) => {
    if (!worker) {
      const instance = new Worker(new URL('./modeling-worker.ts', import.meta.url), { type: 'module' }); worker = instance;
      instance.addEventListener('message', event => {
        if (worker !== instance || !pending) return;
        const reply = (event as MessageEvent<ModelingReply>).data;
        if (!reply || reply.id !== pending.id) return;
        const prior = pending; pending = null; clearTimeout(prior.timer);
        if (reply.ok === false && typeof reply.message === 'string') { prior.reject(new Error(reply.message.slice(0, 2048))); return; }
        try {
          if (reply.ok !== true || typeof reply.text !== 'string' || reply.text.length > FILE_LIMIT
            || new TextEncoder().encode(reply.text).length > FILE_LIMIT || JSON.stringify(reply.summary).length > FILE_LIMIT) throw new Error('Invalid native worker reply.');
          sourceMatches(reply); prior.resolve(reply);
        } catch (cause) { stop('Invalid native worker reply.'); prior.reject(cause instanceof Error ? cause : new Error('Invalid native worker reply.')); }
      });
      const fail = () => { if (worker === instance) stop('Native worker failed. Accepted model is retained; retry to rebuild it.'); };
      instance.addEventListener('error', fail); instance.addEventListener('messageerror', fail);
    }
    const id = ++sequence;
    pending = { id, resolve, reject, timer: setTimeout(() => stop('Native operation timed out. Accepted model is retained.'), 120000) };
    try { worker.postMessage({ ...payload, id }); } catch { stop('Could not send the model to its native worker.'); }
  });
  async function run(kind: 'open' | 'example' | 'apply' | 'undo' | 'redo', text?: string, example?: CadEditorModelingExample, splitAxis?: CadEditorModelingSplitAxis) {
    idle();
    if (kind === 'example') {
      if (example !== undefined && !['cut-chamfer', 'intersection', 'horizontal-split'].includes(example))
        throw new Error('Choose an available modeling example.');
      if (splitAxis !== undefined && (example !== 'horizontal-split' || !['x', 'y', 'z'].includes(splitAxis)))
        throw new Error('Choose X, Y or Z for the split example only.');
    }
    let parameters: Record<string, number> = {}, target = index;
    if (kind === 'open') {
      if (typeof text !== 'string' || text.length > FILE_LIMIT || new TextEncoder().encode(text).length > FILE_LIMIT)
        throw new Error('Authored input exceeds 262144 UTF-8 bytes or characters.');
    } else if (kind !== 'example') {
      if (!state.accepted) throw new Error('Open a saved model first.');
      if (kind === 'apply') parameters = Object.fromEntries(Object.entries(state.drafts).map(([name, raw]) => [name, scalar(raw)]));
      else {
        if (Object.keys(state.drafts).length) throw new Error('Apply or discard dimensions before Undo/Redo.');
        target += kind === 'undo' ? -1 : 1;
        if (target < 0 || target >= history.length) throw new Error('This history direction is unavailable.');
        parameters = history[target].parameters;
      }
      parameters = Object.fromEntries(Object.entries(parameters).filter(([name, value]) => !Object.is(state.accepted!.parameters[name], value)));
      if (!Object.keys(parameters).length) { state = { ...state, drafts: {}, error: null }; emit(); return; }
    }
    const operation = ++epoch, replacing = kind === 'open' || kind === 'example';
    let candidate: PrismDisplayCandidate | null = null, nativeCandidate = false;
    state = { ...state, busy: true, error: null }; emit();
    try {
      if (!replacing && !ready) {
        const seed = await request({ kind: 'open', text: state.authoredText!, revision: state.accepted!.revision });
        if (!same(seed.summary, state.accepted) || !same(JSON.parse(seed.text), JSON.parse(state.authoredText!)))
          throw new Error('Reconstruction differs from the accepted model.');
        if (operation !== epoch) return; ready = true;
      }
      const reply = await request(kind === 'example' ? { kind: 'example', ...(example === undefined ? {} : { example }), ...(splitAxis === undefined ? {} : { splitAxis }) } : kind === 'open' ? { kind: 'open', text: text! }
        : { kind: 'apply', expectedRevision: state.accepted!.revision, parameters });
      if (operation !== epoch || state.disposed) return;
      nativeCandidate = true; const candidateWorker = worker;
      if (kind === 'open' && !same(JSON.parse(text!), JSON.parse(reply.text))) throw new Error('Opened result differs from requested authored data.');
      if (!replacing && (reply.summary.documentId !== state.accepted!.documentId || reply.summary.source !== state.accepted!.source
        || reply.summary.revision !== state.accepted!.revision + 1
        || !same(reply.summary.parameters, { ...state.accepted!.parameters, ...parameters }))) throw new Error('Stale or mismatched native model edit.');
      if (!replacing && reply.summary.source === 'model') {
        const prior = JSON.parse(state.authoredText!);
        if (!same(JSON.parse(reply.text), { ...prior, parameters: { ...prior.parameters, ...parameters } }))
          throw new Error('A dimension edit changed the authored feature graph.');
      }
      if (!replacing && reply.summary.source === 'legacy') validatePrismFeatureNativeReply(
        { id: reply.id, ok: true, text: reply.text, summary: reply.compatibility!, display: reply.display },
        JSON.parse(state.authoredText!) as CadEditorPrismFeatureSummary['document'],
        Object.entries(parameters).map(([parameterId, valueMM]) => ({ parameterId, valueMM })),
      );
      const display = preparePrismFeatureScene(reply.display, 'result', aspect());
      candidate = displayPort ? await displayPort.prepare(display) : null;
      if (operation !== epoch || state.disposed) { candidate?.dispose(); return; }
      let nextHistory = history, nextIndex = target;
      if (replacing || kind === 'apply') {
        nextHistory = replacing ? [] : history.slice(0, index + 1);
        nextHistory.push({ parameters: clone(reply.summary.parameters), bytes: new TextEncoder().encode(reply.text).length });
        while (nextHistory.length > 20 || nextHistory.reduce((sum, h) => sum + h.bytes, 0) > HISTORY_BYTES) nextHistory.shift();
        nextIndex = nextHistory.length - 1;
      }
      const nextState: CadEditorModelingSnapshot = { ...state, accepted: clone(reply.summary), authoredText: reply.text, display,
        drafts: {}, faceSelection: null, selection: !replacing && state.selection !== null && state.selection < reply.summary.features.length ? state.selection : null,
        generation: state.generation + 1, busy: false, error: null,
        history: { index: nextIndex, count: nextHistory.length, canUndo: nextIndex > 0, canRedo: nextIndex + 1 < nextHistory.length } };
      if (!candidateWorker || worker !== candidateWorker) throw new Error('Native worker was lost before display acceptance.');
      candidate?.commit(); ready = true; history = nextHistory; index = nextIndex; state = nextState;
    } catch (cause) {
      if (operation !== epoch || state.disposed) return;
      candidate?.dispose(); if (nativeCandidate) stop('Display candidate refused.');
      state = { ...state, busy: false, error: cause instanceof Error ? cause.message : 'Modeling operation refused.' };
    }
    candidate?.dispose(); emit();
  }
  return {
    getSnapshot: (): CadEditorModelingSnapshot => clone(state),
    subscribe(listener: () => void) { live(); listeners.add(listener); return () => { listeners.delete(listener); }; },
    open: (text: string) => run('open', text), example: (example?: CadEditorModelingExample, splitAxis?: CadEditorModelingSplitAxis) => run('example', undefined, example, splitAxis), apply: () => run('apply'), undo: () => run('undo'), redo: () => run('redo'),
    stage(name: string, raw: string) {
      idle(); if (!state.accepted || !Object.hasOwn(state.accepted.parameters, name) || typeof raw !== 'string' || raw.length > 128)
        throw new Error('Choose a named dimension and bounded decimal input.');
      state = { ...state, drafts: { ...state.drafts, [name]: raw }, error: null }; emit();
    },
    discard() { idle(); state = { ...state, drafts: {}, error: null }; emit(); },
    select(feature: number, generation: number) {
      idle(); if (generation !== state.generation || !state.accepted?.features.some(f => f.index === feature)) throw new Error('Feature selection is stale.');
      state = { ...state, selection: feature }; emit();
    },
    pick(width: number, height: number, x: number, y: number, generation: number) {
      idle(); if (!state.display || generation !== state.generation) throw new Error('Display selection is stale.');
      const picked = pickPrismFeatureScene(state.display, width, height, x, y);
      state = { ...state, faceSelection: picked ? { ...picked, generation } : null }; emit();
    },
    cancel() { live(); ++epoch; stop('Cancelled.'); state = { ...state, busy: false, error: null }; emit(); },
    dispose() { if (state.disposed) return; ++epoch; stop('Disposed.'); state = { ...state, busy: false, disposed: true }; emit(); listeners.clear(); },
  };
}
export type CadEditorModelingController = ReturnType<typeof createCadEditorModelingController>;
