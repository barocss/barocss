import { preparePrismFeatureScene, pickPrismFeatureScene } from './prism-feature-scene.js';
import type { PrismDisplayView } from './prism-feature-scene.js';
import type { PrismDisplayPort, PrismDisplayCandidate } from './prism-feature-display.js';
import type { CadEditorPrismFeatureSnapshot, PrismFeatureCommand, PrismFeatureReply } from './prism-feature-types.js';

type State = CadEditorPrismFeatureSnapshot;
type Values = { parameterId: string; valueMM: number }[];
const FILE_LIMIT = 262144, HISTORY_BYTES = 8 * 1024 * 1024;
const clone = <T>(value: T): T => structuredClone(value);
/** Authored own data comparison retains signed-zero bits and ignores JSON key order. */
function sameData(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
  const x = a as Record<string, unknown>, y = b as Record<string, unknown>;
  return Object.keys(x).length === Object.keys(y).length && Object.keys(x).every(k => Object.hasOwn(y, k) && sameData(x[k], y[k]));
}
function scalar(raw: string): number {
  if (raw.length > 128 || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(raw.trim()))
    throw new Error('Enter a finite decimal millimetre value.');
  const value = Number(raw);
  if (!Number.isFinite(value) || Math.abs(value) > 10000) throw new Error('Use millimetres between -10000 and 10000.');
  return value;
}

/** Native ASCII IDs may be ordinary Object prototype names. Read only owned drafts. */
export function prismFeatureFieldText(drafts: Record<string, string>, parameter: { id: string; valueMM: number }): string {
  return Object.hasOwn(drafts, parameter.id) ? drafts[parameter.id]
    : Object.is(parameter.valueMM, -0) ? '-0' : String(parameter.valueMM);
}

/** Responsive authored-intent controller. Native work always runs in its own Worker. */
export function createCadEditorPrismFeatureController(displayPort?: PrismDisplayPort, aspect: () => number = () => 1, version: 0 | 2 = 0) {
  let state: State = { display: null, faceSelection: null, view: 'result', accepted: null, authoredText: null, drafts: {}, selection: null,
    busy: false, disposed: false, error: null, history: { index: -1, count: 0, canUndo: false, canRedo: false } };
  let worker: Worker | null = null, workerReady = false, sequence = 0, epoch = 0;
  let history: { values: Values; bytes: number }[] = [], index = -1;
  let pending: { id: number; resolve: (reply: Extract<PrismFeatureReply, { ok: true }>) => void;
    reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> } | null = null;
  const listeners = new Set<() => void>();
  const emit = () => { for (const listener of listeners) { try { listener(); } catch { /* UI subscriber isolation. */ } } };
  const live = () => { if (state.disposed) throw new Error('The prism inspector is disposed.'); };
  const idle = () => { live(); if (state.busy) throw new Error('A native operation is in progress.'); };
  const stopWorker = (message: string) => {
    worker?.terminate(); worker = null; workerReady = false;
    if (pending) { const request = pending; pending = null; clearTimeout(request.timer); request.reject(new Error(message)); }
  };
  const ensureWorker = () => {
    if (worker) return worker;
    const instance = new Worker(new URL('./prism-feature-worker.ts', import.meta.url), { type: 'module' });
    worker = instance;
    instance.addEventListener('message', event => {
      if (worker !== instance || !pending) return;
      const reply = (event as MessageEvent<PrismFeatureReply>).data;
      if (!reply || reply.id !== pending.id) return; // Late/duplicate/different-instance replies are inert.
      const request = pending; pending = null; clearTimeout(request.timer);
      try {
        if (reply.ok === false && typeof reply.message === 'string') { request.reject(new Error(reply.message.slice(0, 2048))); return; }
        if (reply.ok !== true || typeof reply.text !== 'string' || reply.text.length > FILE_LIMIT
          || !reply.summary || reply.summary.document?.format !== 'barocss-xy-affine-prism-feature-document'
          || reply.summary.document.version !== version || reply.summary.document.nodes?.length !== (version === 2 ? 6 : 5)
          || !Array.isArray(reply.summary.document.parameters) || reply.summary.document.parameters.length > 16) {
          stopWorker('Invalid native worker reply.'); request.reject(new Error('Invalid native worker reply.')); return;
        }
        if (JSON.stringify(reply.summary).length > FILE_LIMIT) { stopWorker('Native summary exceeds budget.'); request.reject(new Error('Native summary exceeds budget.')); return; }
        if (!sameData(JSON.parse(reply.text), reply.summary.document)) throw new Error('Authored source differs from native summary.');
        request.resolve(reply);
      } catch { stopWorker('Invalid native worker reply.'); request.reject(new Error('Invalid native worker reply.')); }
    });
    const failed = () => { if (worker === instance) stopWorker('Native worker failed. Accepted intent is retained; retry to rebuild it.'); };
    instance.addEventListener('error', failed); instance.addEventListener('messageerror', failed);
    return instance;
  };
  const request = (payload: Omit<Extract<PrismFeatureCommand, { kind: 'open' }>, 'id'>
    | Omit<Extract<PrismFeatureCommand, { kind: 'apply' }>, 'id'>) => new Promise<Extract<PrismFeatureReply, { ok: true }>>((resolve, reject) => {
    const instance = ensureWorker(), id = ++sequence;
    pending = { id, resolve, reject, timer: setTimeout(() => stopWorker('Native operation timed out. Accepted intent is retained.'), 120000) };
    try { instance.postMessage({ ...payload, id }); }
    catch { stopWorker('Could not send authored intent to the native worker.'); }
  });
  async function run(kind: 'open' | 'apply' | 'undo' | 'redo', text?: string) {
    idle();
    let values: Values = [], target = index;
    if (kind === 'open') {
      if (typeof text !== 'string' || text.length > FILE_LIMIT || new TextEncoder().encode(text).length > FILE_LIMIT)
        throw new Error('Authored input exceeds 262144 UTF-8 bytes or characters.');
    } else {
      if (!state.accepted) throw new Error('Open an authored document first.');
      if (kind === 'apply') values = Object.entries(state.drafts).map(([parameterId, raw]) => ({ parameterId, valueMM: scalar(raw) }));
      else {
        if (Object.keys(state.drafts).length) throw new Error('Apply or discard dimension drafts before Undo/Redo.');
        target += kind === 'undo' ? -1 : 1;
        if (target < 0 || target >= history.length) throw new Error('This history direction is unavailable.');
        values = history[target].values;
      }
      values = values.filter(edit => !Object.is(state.accepted!.document.parameters.find(p => p.id === edit.parameterId)?.valueMM, edit.valueMM));
      if (!values.length) { state = { ...state, drafts: {}, error: null }; emit(); return; }
    }
    const operation = ++epoch;
    let displayCandidate: PrismDisplayCandidate | null = null, nativeCandidate = false;
    state = { ...state, busy: true, error: null }; emit();
    try {
      if (kind !== 'open' && !workerReady) {
        const seeded = await request({ kind: 'open', text: state.authoredText!, version });
        if (!sameData(seeded.summary.document, state.accepted!.document)) { stopWorker('Rehydration differs from accepted intent.'); throw new Error('Rehydration differs from accepted intent.'); }
        if (operation !== epoch) return;
        workerReady = true;
      }
      const reply = await request(kind === 'open' ? { kind: 'open', text: text!, version }
        : { kind: 'apply', expectedRevision: state.accepted!.document.revision, edits: values });
      if (operation !== epoch || state.disposed) return;
      nativeCandidate = true;
      if (kind === 'open' && !sameData(JSON.parse(text!), reply.summary.document)) throw new Error('Opened result differs from requested intent.');
      const candidateWorker = worker;
      if (kind !== 'open' && (reply.summary.document.id !== state.accepted!.document.id
        || reply.summary.document.revision !== state.accepted!.document.revision + 1)) {
        stopWorker('Stale native result.'); throw new Error('Native result does not match the current document revision.');
      }
      if (!reply.display || reply.display.documentId !== reply.summary.document.id || reply.display.revision !== reply.summary.document.revision)
        throw new Error('Display packet does not match the native document.');
      if (JSON.stringify(reply.display.outcomes) !== JSON.stringify(reply.summary.components)) throw new Error('Display result roles do not match native summary.');
      if (version === 2) {
        const document = reply.summary.document;
        if (document.version !== 2) throw new Error('Explicit version two required.');
        const detail = document.nodes[5], source = document.nodes[0];
        if (!sameData(document.nodes.map(n => n.kind), ['sketch', 'sketch', 'prism', 'prism', 'subtraction', 'chamfer'])
          || reply.display.components.find(c => c.role === 'source')?.report.solidId !== document.nodes[2].options.solidId
          || reply.summary.components[0].solidId !== document.nodes[4].first.solidId
          || !sameData(reply.summary.selectedWalls, [document.nodes[4].first.reference, document.nodes[4].second.reference]))
          throw new Error('Serial document roles differ from worker reply.');
        if (kind !== 'open' && state.accepted && !sameData(document.parameters.map(p => [p.id, p.valueMM]),
          state.accepted.document.parameters.map(p => [p.id, values.find(e => e.parameterId === p.id)?.valueMM ?? p.valueMM])))
          throw new Error('Serial reply differs from requested parameter values.');
        const serial = reply.summary.serial, final = reply.display.components.find(c => c.role === 'second');
        if (!serial || !final || serial.finalSolidId !== final.report.solidId
          || serial.parentSolidId !== serial.resolution.parent.solidId
          || !('kind' in final.lineage) || final.lineage.kind !== 'serial-part-v2'
          || JSON.stringify(final.lineage.resolution) !== JSON.stringify(serial.resolution)
          || final.lineage.parentSolidId !== serial.parentSolidId || final.lineage.finalSolidId !== serial.finalSolidId
          || !sameData(serial.resolution.parent, detail.parent) || detail.parent.subtractionNodeId !== document.nodes[4].id
          || serial.parentSolidId !== document.nodes[4].second.solidId || serial.finalSolidId !== detail.options.retainedSolidId
          || serial.resolution.originalPrismNodeId !== document.nodes[2].id
          || final.lineage.original.sourceId !== source.sourceId || final.lineage.original.sketchId !== source.document.id
          || final.lineage.original.sourceRevision !== source.revision
          || detail.reference.sourceId !== source.sourceId || detail.reference.sketchId !== source.document.id || detail.reference.sourceRevision !== source.revision
          || final.lineage.original.segments.filter(s => s.segmentId === detail.reference.segmentId && s.topEdgeId === serial.resolution.originalTopEdgeId).length !== 1
          || !(['a', 'b'] as const).every(key => {
            const origin = serial.resolution[key].origin, reference = detail.reference[key];
            return origin.operand === 'parent'
              && Object.entries(reference).every(([field, value]) => origin[field as keyof typeof origin] === value);
          }))
          throw new Error('Serial part provenance does not match the final display.');
      } else if (reply.summary.serial) throw new Error('Version zero cannot carry serial part results.');
      const display = preparePrismFeatureScene(reply.display, state.view, aspect());
      displayCandidate = displayPort ? await displayPort.prepare(display) : null;
      if (operation !== epoch || state.disposed) { displayCandidate?.dispose(); return; }
      let nextHistory = history, nextIndex = target;
      if (kind === 'open' || kind === 'apply') {
        nextHistory = kind === 'open' ? [] : history.slice(0, index + 1);
        nextHistory.push({ values: reply.summary.document.parameters.map(p => ({ parameterId: p.id, valueMM: p.valueMM })),
          bytes: new TextEncoder().encode(reply.text).length });
        while (nextHistory.length > 20 || nextHistory.reduce((n, item) => n + item.bytes, 0) > HISTORY_BYTES) nextHistory.shift();
        nextIndex = nextHistory.length - 1;
      }
      const nodeId = kind !== 'open' && state.selection && reply.summary.document.nodes.some(n => n.id === state.selection!.nodeId)
        ? state.selection.nodeId : reply.summary.document.nodes[4].id;
      const nextState: State = { ...state, display, faceSelection: null, accepted: clone(reply.summary), authoredText: reply.text, drafts: {}, busy: false, error: null,
        selection: { documentId: reply.summary.document.id, revision: reply.summary.document.revision, nodeId },
        history: { index: nextIndex, count: nextHistory.length, canUndo: nextIndex > 0, canRedo: nextIndex >= 0 && nextIndex < nextHistory.length - 1 } };
      if (!candidateWorker || worker !== candidateWorker) throw new Error('Native worker was lost before display acceptance.');
      // All throwing preparation finishes before synchronous display/state/history acceptance.
      displayCandidate?.commit();
      workerReady = true; history = nextHistory; index = nextIndex; state = nextState;
    } catch (cause) {
      if (operation !== epoch || state.disposed) return;
      if (displayCandidate) displayCandidate.dispose();
      // Worker may have evaluated a candidate that display refused. Rebuild accepted intent next time.
      if (nativeCandidate) stopWorker('Display candidate refused.');
      state = { ...state, busy: false, error: cause instanceof Error ? cause.message : 'Native operation refused.' };
    }
    displayCandidate?.dispose();
    emit();
  }
  async function setView(view: PrismDisplayView) {
    idle(); const acceptedDisplay = state.display;
    if (!acceptedDisplay) throw new Error('Open an authored document first.');
    const operation = ++epoch; let candidate: PrismDisplayCandidate | null = null;
    state = { ...state, busy: true, error: null }; emit();
    try {
      const display = preparePrismFeatureScene(acceptedDisplay.packet, view, aspect());
      candidate = displayPort ? await displayPort.prepare(display) : null;
      if (operation !== epoch || state.disposed) { candidate?.dispose(); return; }
      candidate?.commit(); state = { ...state, display, view, faceSelection: null, busy: false };
    } catch (cause) {
      if (operation === epoch && !state.disposed) state = { ...state, busy: false, error: cause instanceof Error ? cause.message : 'Display refused.' };
    } finally { candidate?.dispose(); }
    if (operation === epoch && !state.disposed) emit();
  }
  return {
    getSnapshot: (): State => clone(state),
    subscribe(listener: () => void) { live(); listeners.add(listener); return () => { listeners.delete(listener); }; },
    setView,
    pick(width: number, height: number, x: number, y: number, revision: number) {
      idle(); if (!state.display || revision !== state.accepted?.document.revision) throw new Error('Display selection is stale.');
      state = { ...state, faceSelection: pickPrismFeatureScene(state.display, width, height, x, y) }; emit();
    },
    open: (text: string) => run('open', text), apply: () => run('apply'), undo: () => run('undo'), redo: () => run('redo'),
    stage(parameterId: string, raw: string) {
      idle(); if (!state.accepted?.document.parameters.some(p => p.id === parameterId) || typeof raw !== 'string' || raw.length > 128)
        throw new Error('Choose an existing parameter and bounded decimal input.');
      state = { ...state, drafts: { ...state.drafts, [parameterId]: raw }, error: null }; emit();
    },
    discard() { idle(); state = { ...state, drafts: {}, error: null }; emit(); },
    select(nodeId: string, revision: number) {
      idle(); const document = state.accepted?.document;
      if (!document || revision !== document.revision || !document.nodes.some(n => n.id === nodeId)) throw new Error('Feature selection is stale.');
      state = { ...state, selection: { documentId: document.id, revision, nodeId } }; emit();
    },
    cancel() { live(); ++epoch; stopWorker('Cancelled.'); state = { ...state, busy: false, error: null }; emit(); },
    dispose() { if (state.disposed) return; ++epoch; stopWorker('Disposed.'); state = { ...state, busy: false, disposed: true }; emit(); listeners.clear(); },
  };
}
export type CadEditorPrismFeatureController = ReturnType<typeof createCadEditorPrismFeatureController>;
