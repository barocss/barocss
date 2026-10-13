import { isModelingCompositionGraph } from './modeling-composition.js';
import { prepareModelingScene, pickModelingScene } from './modeling-scene.js';
import type { ModelingDisplayScene, ModelingFaceSelection } from './modeling-scene.js';
import type { PrismDisplayPort, PrismDisplayCandidate } from './prism-feature-display.js';
import type { CadEditorModelingExample, CadEditorModelingSplitAxis, CadEditorModelingSummary, ModelingCommand, ModelingReply } from './modeling-engine.js';
import { validatePrismFeatureNativeReply } from './prism-feature-controller.js';
import type { CadEditorPrismFeatureSummary } from './prism-feature-types.js';

export interface CadEditorModelingSnapshot {
  accepted: CadEditorModelingSummary | null; authoredText: string | null;
  display: ModelingDisplayScene | null; faceSelection: (ModelingFaceSelection & { generation: number }) | null;
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
/** Inspect descriptors before cloning/posting so accessors never execute at this boundary. */
function finishingChanges(value: unknown, known: Record<string, boolean> | undefined): Record<string, boolean> {
  if (!known || !value || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype
    || Reflect.ownKeys(value).length > 6) throw new Error('Use a plain named finishing configuration.');
  const changes: Record<string, boolean> = {};
  for (const name of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, name)!;
    if (typeof name !== 'string' || !Object.hasOwn(known, name) || !descriptor.enumerable
      || !Object.hasOwn(descriptor, 'value') || typeof descriptor.value !== 'boolean')
      throw new Error('Use known finishing names and own boolean values.');
    changes[name] = descriptor.value;
  }
  return changes;
}
function authoredFinishes(nodes: Record<string, unknown>[], features: CadEditorModelingSummary['features']): Record<string, boolean> | undefined {
  const flags: Record<string, boolean> = {};
  for (const [index, node] of nodes.entries()) {
    const feature = features[index];
    if (Object.hasOwn(node, 'name') || Object.hasOwn(node, 'suppressed')) {
      if (node.kind !== 'chamfer' || typeof node.name !== 'string' || !/^[A-Za-z_][A-Za-z0-9_-]{0,47}$/.test(node.name)
        || ['__proto__', 'prototype', 'constructor'].includes(node.name) || typeof node.suppressed !== 'boolean'
        || Object.hasOwn(flags, node.name) || feature?.name !== node.name || feature.suppressed !== node.suppressed)
        throw new Error('Named finishing metadata differs from authored chamfer nodes.');
      flags[node.name] = node.suppressed;
    } else if (Object.hasOwn(feature ?? {}, 'name') || Object.hasOwn(feature ?? {}, 'suppressed'))
      throw new Error('Unnamed features must omit finishing metadata.');
  }
  return Object.keys(flags).length ? flags : undefined;
}
function sourceMatches(reply: Success, taskToken?: string) {
  const { summary } = reply, data = JSON.parse(reply.text);
  // Refuse unsupported ancestry before inspecting any worker display payload,
  // including a forged legacy/convex/two-box summary or hidden chain output.
  const composedGraph = isModelingCompositionGraph(data);
  if (!composedGraph && Array.isArray(data?.nodes) && data.nodes.some((node: { kind?: string; parent?: { node?: number } }, index: number) => {
    const parent = node?.parent?.node;
    return node?.kind === 'difference' && typeof parent === 'number' && Number.isSafeInteger(parent)
      && parent >= 0 && parent < index && data.nodes[parent]?.kind === 'union';
  }))
    throw new Error('Composed preview requires the supported eight-node rectangular union-slot ancestry.');
  const circleOutput = (index: number): boolean => {
    const node = data.nodes?.[index], sketch = node?.sketch;
    return node?.kind === 'extrude' && Number.isSafeInteger(sketch) && sketch >= 0 && sketch < index
      && data.nodes[sketch]?.kind === 'sketch' && data.nodes[sketch].profile === 'circle';
  };
  if (!summary || !Number.isSafeInteger(summary.revision) || summary.revision < 0 || typeof summary.documentId !== 'string'
    || !summary.parameters || typeof summary.parameters !== 'object' || Array.isArray(summary.parameters)
    || Object.keys(summary.parameters).length > 16 || !Object.values(summary.parameters).every(Number.isFinite)
    || !Array.isArray(summary.features) || summary.features.length > (composedGraph ? 8 : 6) || !Array.isArray(summary.outputs) || summary.outputs.length > 8)
    throw new Error('Invalid native model summary.');
  if (summary.source === 'model') {
    if (data?.format !== 'barocss-cad-model' || data.schema !== 1 || data.units !== 'mm' || !same(data.parameters, summary.parameters)
      || !Array.isArray(data.nodes) || !same(data.nodes.map((n: { kind: string }) => n.kind), summary.features.map(f => f.kind))
      || !same(Object.keys(data.outputs), summary.outputs.map(o => o.name)) || reply.compatibility !== undefined) throw new Error('Saved model differs from native summary.');
    if (composedGraph && !same(summary.features.map(f => f.dependencies), [[], [0], [], [2], [1, 3], [], [5], [4, 6]]))
      throw new Error('Composed features must retain exact owned dependency indices.');
    const outputNodes = Object.values(data.outputs as Record<string, { node: number }>);
    if (outputNodes.some(output => circleOutput(output.node)) && reply.display?.profile !== 'model-body-faces')
      throw new Error('Authored circle outputs require tagged circle body-face transport.');
    const outputKinds = Object.values(data.outputs as Record<string, { node: number }>).map(output => data.nodes[output.node]?.kind);
    if (outputKinds.some(kind => ['hole', 'union', 'difference'].includes(kind))
      && reply.display?.profile !== 'model-body-faces') throw new Error(outputKinds.includes('hole')
        ? 'Authored hole outputs require tagged body-face transport.' : outputKinds.includes('difference')
          ? 'Authored orthogonal outputs require tagged body-face transport.' : 'Authored union outputs require tagged body-face transport.');
    const flags = authoredFinishes(data.nodes, summary.features);
    if (!same(flags, summary.suppression) || (flags === undefined && Object.hasOwn(summary, 'suppression')))
      throw new Error('Saved finishing configuration differs from native summary.');
  } else if (summary.source === 'legacy') {
    if (data?.format !== 'barocss-xy-affine-prism-feature-document' || ![0, 2].includes(data.version)
      || data.id !== summary.documentId || data.revision !== summary.revision
      || !same(Object.fromEntries(data.parameters.map((p: { id: string; valueMM: number }) => [p.id, p.valueMM])), summary.parameters)
      || !same(data.nodes.map((n: { kind: string }) => n.kind), summary.features.map(f => f.kind))) throw new Error('Legacy source differs from native summary.');
    if (data.nodes.some((node: { kind: string; profile?: string }) => node.kind === 'sketch' && node.profile === 'circle')) throw new Error('Legacy files cannot author primary circle profiles.');
    if (data.nodes.some((node: { kind: string }) => ['hole', 'union', 'difference'].includes(node.kind))) throw new Error('Legacy files cannot author model hole, union or difference nodes.');
    if (Object.hasOwn(summary, 'suppression') || summary.features.some(f => Object.hasOwn(f, 'name') || Object.hasOwn(f, 'suppressed')))
      throw new Error('Legacy summaries must omit finishing metadata.');
    const legacy = reply.compatibility;
    if (!legacy || !same(data, legacy.document) || JSON.stringify(legacy).length > FILE_LIMIT
      || !same(legacy.components.filter(c => c.status === 'solid').map(c => [c.role, c.solidId]), summary.outputs.map(o => [o.name, o.solidId])))
      throw new Error('Legacy native summary differs from saved source.');
    if (reply.display.profile === 'model-body-faces') throw new Error('Legacy files cannot carry model body-face packets.');
    validatePrismFeatureNativeReply({ id: reply.id, ok: true, text: reply.text, summary: legacy, display: reply.display });
  } else throw new Error('Unknown native source summary.');
  if (!summary.features.every((f, i) => typeof f.kind === 'string' && f.kind.length > 0 && f.kind.length <= 64 && f.kind.trim().length > 0 && f.index === i && Array.isArray(f.dependencies)
    && f.dependencies.every(d => Number.isInteger(d) && d >= 0 && d < i))) throw new Error('Invalid feature dependencies.');
  if (!reply.display || reply.display.documentId !== summary.documentId || reply.display.revision !== summary.revision
    || !same(reply.display.outcomes.filter(o => o.status === 'solid').map(o => [o.role, o.solidId]), summary.outputs.map(o => [o.name, o.solidId])))
    throw new Error('Named output display differs from native summary.');
  if (reply.display.profile === 'model-body-faces') {
    if (summary.source !== 'model' || reply.display.taskToken !== taskToken
      || !same(reply.display.outcomes.map(o => o.family), summary.outputs.map(o => o.family)))
      throw new Error('Native body families or display task differ from the current request.');
    for (const output of summary.outputs) {
      const node = data.nodes[data.outputs[output.name]?.node];
      const circle = circleOutput(data.outputs[output.name]?.node);
      if (circle !== (output.family === 'stored-rational-circle-prism'))
        throw new Error('Authored circle outputs require their matching circle body-face family.');
      if (output.family === 'stored-rational-circle-prism') {
        if (output.volumeMM3 !== null) throw new Error('Circle outputs have no certified volume.');
      } else if (output.family === 'stored-rational-plate-hole') {
        if (node?.kind !== 'hole' || output.volumeMM3 !== null) throw new Error('Hole outputs have no certified volume and must name an authored hole.');
      } else if (output.family === 'orthogonal-cell') {
        const volume = output.volumeMM3, component = reply.display.components.find(c => c.family === 'orthogonal-cell' && c.role === output.name);
        const composedOutput = composedGraph && data.outputs[output.name].node === 7;
        if (composedOutput && component?.family === 'orthogonal-cell' && 'parent' in component.lineage) {
          const embedded = component.lineage.parent.component;
          for (const saved of summary.outputs.filter(value => data.outputs[value.name].node === 4)) {
            const named = reply.display.components.find(value => value.family === 'orthogonal-cell' && value.role === saved.name);
            if (!named || named.family !== 'orthogonal-cell' || named.solidId !== embedded.solidId
              || !same(named.qualification, embedded.qualification) || !same(named.lineage, embedded.lineage) || !same(named.mesh, embedded.mesh))
              throw new Error('Named parent differs from the complete embedded composed authority.');
          }
        }

        if (component?.family === 'orthogonal-cell'
          && (component.qualification.schema === 'barocss-orthogonal-solid-boolean') !== composedOutput)
          throw new Error('Authored composed output requires its exact composed native-schema transport.');
        if (!['union', 'difference'].includes(node?.kind) || !component || component.family !== 'orthogonal-cell' || component.qualification.operation !== node.kind || !volume || Object.keys(volume).length !== 2
          || volume.denominator !== '1' || volume.numerator !== String(component.qualification.volumeMM3))
          throw new Error('Orthogonal output must retain its authored operation and exact native integer volume.');
      } else {
        const volume = output.volumeMM3;
        if (output.family !== 'convex-planar' || ['hole', 'union', 'difference'].includes(node?.kind) || !volume || Object.keys(volume).length !== 2
          || typeof volume.numerator !== 'string' || typeof volume.denominator !== 'string'
          || !/^[1-9][0-9]{0,255}$/.test(volume.numerator) || !/^[1-9][0-9]{0,255}$/.test(volume.denominator))
          throw new Error('The output family or certified volume differs from its authored native result.');
      }
    }
  } else if (summary.outputs.some(o => Object.hasOwn(o, 'family')))
    throw new Error('Existing convex and legacy summaries must retain their original family-free transport.');
  return data as unknown;
}

/** One authoring session. Generations protect freshness even when native IDs are reused. */
export function createCadEditorModelingController(displayPort?: PrismDisplayPort, aspect: () => number = () => 1) {
  let state: CadEditorModelingSnapshot = { accepted: null, authoredText: null, display: null, faceSelection: null,
    drafts: {}, selection: null, generation: 0, busy: false, disposed: false, error: null,
    history: { index: -1, count: 0, canUndo: false, canRedo: false } };
  let worker: Worker | null = null, ready = false, sequence = 0, epoch = 0, index = -1;
  let history: { parameters: Record<string, number>; suppression?: Record<string, boolean>; bytes: number }[] = [];
  let pending: { id: number; taskToken: string; resolve: (reply: Success) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> } | null = null;
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
          sourceMatches(reply, prior.taskToken); prior.resolve(reply);
        } catch (cause) { stop('Invalid native worker reply.'); prior.reject(cause instanceof Error ? cause : new Error('Invalid native worker reply.')); }
      });
      const fail = () => { if (worker === instance) stop('Native worker failed. Accepted model is retained; retry to rebuild it.'); };
      instance.addEventListener('error', fail); instance.addEventListener('messageerror', fail);
    }
    const id = ++sequence, taskToken = globalThis.crypto.randomUUID();
    pending = { id, taskToken, resolve, reject, timer: setTimeout(() => stop('Native operation timed out. Accepted model is retained.'), 120000) };
    try { worker.postMessage({ ...payload, id, taskToken }); } catch { stop('Could not send the model to its native worker.'); }
  });
  async function run(kind: 'open' | 'example' | 'apply' | 'suppression' | 'undo' | 'redo', text?: string, example?: CadEditorModelingExample, splitAxis?: CadEditorModelingSplitAxis, finishing?: Record<string, boolean>) {
    idle();
    if (kind === 'example') {
      if (example !== undefined && !['cut-chamfer', 'intersection', 'horizontal-split', 'two-chamfer', 'chamfer-split', 'derived-split', 'miter-split', 'configurable-finishes', 'mounting-plate', 'union-bracket', 'underside-pocket', 'top-entry-pocket', 'round-post', 'slotted-bracket'].includes(example))
        throw new Error('Choose an available modeling example.');
      if (splitAxis !== undefined && (example === 'chamfer-split' ? !['x', 'z'].includes(splitAxis)
        : example !== 'horizontal-split' || !['x', 'y', 'z'].includes(splitAxis)))
        throw new Error('Choose an available split axis: X/Z for the beveled part, X/Y/Z for the plain part.');
    }
    let parameters: Record<string, number> = {}, suppression: Record<string, boolean> = {}, target = index;
    if (kind === 'open') {
      if (typeof text !== 'string' || text.length > FILE_LIMIT || new TextEncoder().encode(text).length > FILE_LIMIT)
        throw new Error('Authored input exceeds 262144 UTF-8 bytes or characters.');
    } else if (kind !== 'example') {
      if (!state.accepted) throw new Error('Open a saved model first.');
      if (kind === 'apply') parameters = Object.fromEntries(Object.entries(state.drafts).map(([name, raw]) => [name, scalar(raw)]));
      else if (kind === 'suppression') {
        if (Object.keys(state.drafts).length) throw new Error('Apply or discard dimensions before configuring finishes.');
        suppression = finishingChanges(finishing, state.accepted.suppression);
      } else {
        if (Object.keys(state.drafts).length) throw new Error('Apply or discard dimensions before Undo/Redo.');
        target += kind === 'undo' ? -1 : 1;
        if (target < 0 || target >= history.length) throw new Error('This history direction is unavailable.');
        parameters = history[target].parameters;
        suppression = history[target].suppression ?? {};
      }
      parameters = Object.fromEntries(Object.entries(parameters).filter(([name, value]) => !Object.is(state.accepted!.parameters[name], value)));
      suppression = Object.fromEntries(Object.entries(suppression).filter(([name, value]) => state.accepted!.suppression?.[name] !== value));
      if (Object.keys(parameters).length && Object.keys(suppression).length) throw new Error('History requires one atomic editing channel.');
      if (!Object.keys(parameters).length && !Object.keys(suppression).length) { state = { ...state, drafts: {}, error: null }; emit(); return; }
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
        : Object.keys(suppression).length ? { kind: 'suppression', expectedRevision: state.accepted!.revision, suppression }
          : { kind: 'apply', expectedRevision: state.accepted!.revision, parameters });
      if (operation !== epoch || state.disposed) return;
      nativeCandidate = true; const candidateWorker = worker;
      if (kind === 'open' && !same(JSON.parse(text!), JSON.parse(reply.text))) throw new Error('Opened result differs from requested authored data.');
      if (!replacing && (reply.summary.documentId !== state.accepted!.documentId || reply.summary.source !== state.accepted!.source
        || reply.summary.revision !== state.accepted!.revision + 1
        || !same(reply.summary.parameters, { ...state.accepted!.parameters, ...parameters }))) throw new Error('Stale or mismatched native model edit.');
      if (!replacing && reply.summary.source === 'model') {
        const prior = JSON.parse(state.authoredText!);
        const expected = { ...prior, parameters: { ...prior.parameters, ...parameters },
          nodes: prior.nodes.map((node: Record<string, unknown>) => typeof node.name === 'string' && Object.hasOwn(suppression, node.name)
            ? { ...node, suppressed: suppression[node.name] } : node) };
        if (!same(JSON.parse(reply.text), expected))
          throw new Error('An edit changed immutable authored feature data.');
      }
      if (!replacing && reply.summary.source === 'legacy' && reply.display.profile !== 'model-body-faces') validatePrismFeatureNativeReply(
        { id: reply.id, ok: true, text: reply.text, summary: reply.compatibility!, display: reply.display },
        JSON.parse(state.authoredText!) as CadEditorPrismFeatureSummary['document'],
        Object.entries(parameters).map(([parameterId, valueMM]) => ({ parameterId, valueMM })),
      );
      const selectedOutput = reply.display.profile === 'model-body-faces'
        ? replacing ? kind === 'example' && example === 'slotted-bracket' ? 'slotted' : kind === 'example' && example === 'mounting-plate' ? 'plate' : kind === 'example' && example === 'union-bracket' ? 'bracket' : kind === 'example' && (example === 'underside-pocket' || example === 'top-entry-pocket') ? 'part' : kind === 'example' && example === 'round-post' ? 'post' : undefined
          : state.display && 'selectedOutput' in state.display ? state.display.selectedOutput : undefined
        : undefined;
      const display = prepareModelingScene(reply.display, aspect(), selectedOutput);
      candidate = displayPort ? await displayPort.prepare(display) : null;
      if (operation !== epoch || state.disposed) { candidate?.dispose(); return; }
      let nextHistory = history, nextIndex = target;
      if (replacing || kind === 'apply' || kind === 'suppression') {
        nextHistory = replacing ? [] : history.slice(0, index + 1);
        nextHistory.push({ parameters: clone(reply.summary.parameters),
          ...(reply.summary.suppression === undefined ? {} : { suppression: clone(reply.summary.suppression) }), bytes: new TextEncoder().encode(reply.text).length });
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
    open: (text: string) => run('open', text), example: (example?: CadEditorModelingExample, splitAxis?: CadEditorModelingSplitAxis) => run('example', undefined, example, splitAxis), apply: () => run('apply'),
    configureFinishes: (suppression: Record<string, boolean>) => run('suppression', undefined, undefined, undefined, suppression), undo: () => run('undo'), redo: () => run('redo'),
    async viewOutput(name: string, generation: number) {
      idle();
      if (!state.display || state.display.packet.profile !== 'model-body-faces' || !('selectedOutput' in state.display)
        || generation !== state.generation || !state.accepted?.outputs.some(output => output.name === name))
        throw new Error('Choose a current named output body.');
      if (state.display.selectedOutput === name) return;
      const operation = ++epoch, packet = state.display.packet;
      let candidate: PrismDisplayCandidate | null = null;
      state = { ...state, busy: true, error: null }; emit();
      try {
        const display = prepareModelingScene(packet, aspect(), name);
        candidate = displayPort ? await displayPort.prepare(display) : null;
        if (operation !== epoch || state.disposed) return;
        candidate?.commit();
        state = { ...state, display, faceSelection: null, generation: state.generation + 1, busy: false, error: null };
      } catch (cause) {
        if (operation !== epoch || state.disposed) return;
        state = { ...state, busy: false, error: cause instanceof Error ? cause.message : 'Output display refused.' };
      } finally { candidate?.dispose(); }
      emit();
    },
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
      const picked = pickModelingScene(state.display, width, height, x, y);
      state = { ...state, faceSelection: picked ? { ...picked, generation } : null }; emit();
    },
    cancel() { live(); ++epoch; stop('Cancelled.'); state = { ...state, busy: false, error: null }; emit(); },
    dispose() { if (state.disposed) return; ++epoch; stop('Disposed.'); state = { ...state, busy: false, disposed: true }; emit(); listeners.clear(); },
  };
}
export type CadEditorModelingController = ReturnType<typeof createCadEditorModelingController>;
