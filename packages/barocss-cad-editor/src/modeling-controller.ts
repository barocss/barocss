import { buildModelingStructure, canonicalModelingText, modelingSourceBytes, modelingSourceBudget } from './modeling-structure.js';
import type { ModelingStructureCommand } from './modeling-structure.js';
import { admitModelingDiagnostic, modelingDiagnostic } from './modeling-diagnostic.js';
import type { ModelingDiagnostic } from './modeling-diagnostic.js';
import { validateModelingStlExport } from './modeling-stl.js';
import type { CadEditorStlExport, ModelingStlBinding } from './modeling-stl.js';
import { isModelingCompositionGraph } from './modeling-composition.js';
import { prepareModelingScene, pickModelingScene } from './modeling-scene.js';
import type { ModelingDisplayScene, ModelingFaceSelection } from './modeling-scene.js';
import type { PrismDisplayPort, PrismDisplayCandidate, PrismPreviewDisplayCandidate } from './prism-feature-display.js';
import type { CadEditorModelingExample, CadEditorModelingSplitAxis, CadEditorModelingSummary, ModelingCommand, ModelingReply, ModelingDisplayReply, ModelingPreviewBinding, ModelingPreviewReply, ModelingPreviewAcceptedReply, ModelingSourcePreviewReply } from './modeling-engine.js';
import { validatePrismFeatureNativeReply } from './prism-feature-controller.js';
import type { CadEditorPrismFeatureSummary } from './prism-feature-types.js';

export interface CadEditorModelingSnapshot {
  accepted: CadEditorModelingSummary | null; authoredText: string | null;
  display: ModelingDisplayScene | null; faceSelection: (ModelingFaceSelection & { generation: number }) | null;
  drafts: Record<string, string>; selection: number | null; generation: number;
  busy: boolean; disposed: boolean; error: string | null; workerReady: boolean;
  viewOrientation: 'isometric' | 'top';
  preview: { operation?: 'structure' | 'history'; status: 'computing' | 'ready' | 'unchanged' | 'error'; parameters: Record<string, number>; outputs?: CadEditorModelingSummary['outputs']; diagnostic?: ModelingDiagnostic } | null;
  history: { index: number; count: number; canUndo: boolean; canRedo: boolean };
}
type Success = Extract<ModelingDisplayReply, { ok: true }>;
type ExportSuccess = Extract<ModelingReply, { kind: 'stl-export' }>;
type InternalSnapshot = Omit<CadEditorModelingSnapshot, 'workerReady'>;
type Payload = ModelingCommand extends infer C ? C extends ModelingCommand ? Omit<C, 'id'> : never : never;
type DisplayPayload = Exclude<Payload, { kind: 'export-stl' | 'prepare-preview' | 'accept-preview' | 'discard-preview' | 'prepare-source' | 'accept-source' }>;
type PreviewSuccess = Extract<ModelingPreviewReply, { ok: true }>;
type SourceSuccess = ModelingSourcePreviewReply;
type SourcePayload = Extract<Payload, { kind: 'prepare-source' }>;
type AcceptSourcePayload = Extract<Payload, { kind: 'accept-source' }>;
type PreviewAck = Extract<ModelingPreviewAcceptedReply, { ok: true }>;
type RequestSuccess = Success | ExportSuccess | PreviewSuccess | SourceSuccess | PreviewAck;
type PreviewPayload = Extract<Payload, { kind: 'prepare-preview' }>;
type AcceptPreviewPayload = Extract<Payload, { kind: 'accept-preview' }>;
type ExportPayload = Extract<Payload, { kind: 'export-stl' }>;
const FILE_LIMIT = 262144, HISTORY_BYTES = 8 * 1024 * 1024;
class ModelingRequestError extends Error {
  constructor(message: string, readonly diagnostic?: ModelingDiagnostic) { super(message); }
}
function previewBinding(value: unknown): asserts value is ModelingPreviewBinding {
  if (!value || Object.getPrototypeOf(value) !== Object.prototype) throw Error('Invalid preview binding.');
  const keys = ['workerToken', 'acceptedTaskToken', 'expectedRevision', 'candidateToken', 'previewTaskToken'];
  if (Reflect.ownKeys(value).length !== keys.length) throw Error('Invalid preview binding.');
  for (const key of keys) {
    const d = Object.getOwnPropertyDescriptor(value, key);
    if (!d?.enumerable || !Object.hasOwn(d, 'value') || (key === 'expectedRevision'
      ? !Number.isSafeInteger(d.value) || d.value < 0
      : typeof d.value !== 'string' || !/^[A-Za-z0-9_-]{1,48}$/.test(d.value))) throw Error('Invalid preview binding.');
  }
}
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
  let state: InternalSnapshot = { accepted: null, authoredText: null, display: null, faceSelection: null,
    drafts: {}, selection: null, generation: 0, busy: false, disposed: false, error: null,
    preview: null, viewOrientation: 'isometric', history: { index: -1, count: 0, canUndo: false, canRedo: false } };
  let worker: Worker | null = null, ready = false, acceptedWorkerToken = '', sequence = 0, epoch = 0, index = -1, draftVersion = 0, workerToken = '';
  let prepared: { reply: PreviewSuccess | SourceSuccess; expectedText?: string; historyTarget?: number; display: ModelingDisplayScene; handle: PrismPreviewDisplayCandidate | null;
    worker: Worker; text: string; generation: number; rawDrafts: Record<string, string>; draftVersion: number } | null = null;
  let previewRequest: { binding: ModelingPreviewBinding; worker: Worker; discarded: boolean } | null = null;
  let history: { text?: string; parameters: Record<string, number>; suppression?: Record<string, boolean>; bytes: number }[] = [];
  let pending: { id: number; taskToken: string; binding?: ModelingStlBinding; kind: Payload['kind']; previewBinding?: ModelingPreviewBinding; resolve: (reply: RequestSuccess) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> } | null = null;
  const listeners = new Set<() => void>();
  const emit = () => { for (const listener of listeners) { try { listener(); } catch { /* Subscriber isolation. */ } } };
  const live = () => { if (state.disposed) throw new Error('The modeling session is disposed.'); };
  const idle = () => { live(); if (state.busy) throw new Error('A native operation is in progress.'); };
  const clearPreview = (notifyWorker = true) => {
    const changed = state.preview !== null;
    const prior = prepared; prepared = null;
    // Restore accepted visibility before any asynchronous Worker cleanup.
    try { prior?.handle?.dispose(); } catch { /* Owned cleanup cannot mutate accepted history. */ }
    state = { ...state, preview: null };
    const request = previewRequest; previewRequest = null;
    if (notifyWorker && request && !request.discarded && worker === request.worker) {
      request.discarded = true;
      try { worker.postMessage({ id: ++sequence, taskToken: globalThis.crypto.randomUUID(), kind: 'discard-preview', binding: request.binding }); }
      catch { stop('Could not discard the native preview.'); }
    }
    return changed;
  };
  const stop = (message: string) => {
    clearPreview(false);
    worker?.terminate(); worker = null; ready = false; acceptedWorkerToken = ''; workerToken = '';
    if (pending) { const prior = pending; pending = null; clearTimeout(prior.timer); prior.reject(new Error(message)); }
  };
  function request(payload: DisplayPayload): Promise<Success>;
  function request(payload: ExportPayload): Promise<ExportSuccess>;
  function request(payload: PreviewPayload): Promise<PreviewSuccess>;
  function request(payload: AcceptPreviewPayload): Promise<PreviewAck>;
  function request(payload: SourcePayload): Promise<SourceSuccess>;
  function request(payload: AcceptSourcePayload): Promise<PreviewAck>;
  function request(payload: Payload): Promise<RequestSuccess> { return new Promise((resolve, reject) => {
    if (!worker) {
      const instance = new Worker(new URL('./modeling-worker.ts', import.meta.url), { type: 'module' }); worker = instance; workerToken = globalThis.crypto.randomUUID();
      instance.addEventListener('message', event => {
        if (worker !== instance || !pending) return;
        const reply = (event as MessageEvent<ModelingReply>).data;
        if (!reply || reply.id !== pending.id) return;
        const prior = pending; pending = null; clearTimeout(prior.timer);
        if (reply.ok === false && typeof reply.message === 'string') {
          try { prior.reject(new ModelingRequestError(reply.message.slice(0, 2048), reply.diagnostic === undefined ? undefined : admitModelingDiagnostic(reply.diagnostic))); }
          catch { stop('Invalid native diagnostic.'); prior.reject(new Error('Invalid native diagnostic.')); }
          return;
        }
        try {
          if (prior.kind === 'accept-preview' || prior.kind === 'accept-source') {
            if (reply.ok !== true || !('kind' in reply) || reply.kind !== 'preview-accepted'
              || Object.getPrototypeOf(reply) !== Object.prototype || Reflect.ownKeys(reply).length !== 5) throw Error('Invalid preview acceptance reply.');
            previewBinding(reply.binding);
            if (!same(reply.binding, prior.previewBinding) || reply.revision !== reply.binding.expectedRevision + 1) throw Error('Stale preview acceptance reply.');
            prior.resolve(reply); return;
          }
          if (prior.kind === 'prepare-preview') {
            if (reply.ok !== true || !('kind' in reply) || reply.kind !== 'preview'
              || Object.getPrototypeOf(reply) !== Object.prototype || Reflect.ownKeys(reply).length !== 7) throw Error('Invalid preview reply.');
            previewBinding(reply.binding);
            if (!same(reply.binding, prior.previewBinding) || typeof reply.text !== 'string' || reply.text.length > FILE_LIMIT
              || new TextEncoder().encode(reply.text).length > FILE_LIMIT || JSON.stringify(reply.summary).length > FILE_LIMIT) throw Error('Invalid preview reply.');
            sourceMatches(reply, prior.taskToken); prior.resolve(reply); return;
          }
          if (prior.kind === 'prepare-source') {
            if (reply.ok !== true || !('kind' in reply) || reply.kind !== 'source-preview'
              || Object.getPrototypeOf(reply) !== Object.prototype || Reflect.ownKeys(reply).length !== 8
              || !['structure', 'history'].includes(reply.operation)) throw Error('Invalid structural candidate reply.');
            previewBinding(reply.binding); modelingSourceBytes(reply.text);
            if (!same(reply.binding, prior.previewBinding) || JSON.stringify(reply.summary).length > FILE_LIMIT)
              throw Error('Invalid structural candidate binding.');
            sourceMatches(reply, prior.taskToken); prior.resolve(reply); return;
          }
          if (prior.binding) {
            if (reply.ok !== true || !('kind' in reply) || reply.kind !== 'stl-export'
              || Object.getPrototypeOf(reply) !== Object.prototype || Reflect.ownKeys(reply).length !== 4)
              throw Error('Invalid STL worker reply.');
            prior.resolve({ id: reply.id, ok: true, kind: 'stl-export', export: validateModelingStlExport(reply.export, prior.binding) });
            return;
          }
          if ('kind' in reply) throw Error('Unexpected STL reply for a modeling operation.');
          if (reply.ok !== true || typeof reply.text !== 'string' || reply.text.length > FILE_LIMIT
            || new TextEncoder().encode(reply.text).length > FILE_LIMIT || JSON.stringify(reply.summary).length > FILE_LIMIT) throw new Error('Invalid native worker reply.');
          sourceMatches(reply, prior.taskToken); acceptedWorkerToken = prior.taskToken; prior.resolve(reply);
        } catch (cause) { stop('Invalid native worker reply.'); prior.reject(cause instanceof Error ? cause : new Error('Invalid native worker reply.')); }
      });
      const fail = () => { if (worker === instance) {
        stop('Native worker failed. Accepted model is retained; retry to rebuild it.');
        if (!state.busy) { state = { ...state, error: 'Native worker unavailable. Recover the accepted model before exporting STL.' }; emit(); }
      } };
      instance.addEventListener('error', fail); instance.addEventListener('messageerror', fail);
    }
    const id = ++sequence, taskToken = globalThis.crypto.randomUUID();
    const candidateBinding = (payload.kind === 'prepare-preview' || payload.kind === 'prepare-source') ? { workerToken: payload.workerToken, acceptedTaskToken: payload.acceptedTaskToken, expectedRevision: payload.expectedRevision, candidateToken: payload.candidateToken, previewTaskToken: taskToken } : (payload.kind === 'accept-preview' || payload.kind === 'accept-source') ? payload.binding : undefined;
    if (payload.kind === 'prepare-preview' || payload.kind === 'prepare-source') previewRequest = { binding: candidateBinding!, worker: worker!, discarded: false };
    pending = { id, taskToken, kind: payload.kind, ...(candidateBinding ? { previewBinding: candidateBinding } : {}), ...(payload.kind === 'export-stl' ? { binding: { outputName: payload.outputName, solidId: payload.solidId, revision: payload.expectedRevision, acceptedTaskToken: payload.acceptedTaskToken, requestTaskToken: taskToken } } : {}), resolve, reject, timer: setTimeout(() => stop('Native operation timed out. Accepted model is retained.'), 120000) };
    try { worker.postMessage({ ...payload, id, taskToken }); } catch { stop('Could not send the model to its native worker.'); }
  }); }
  async function run(kind: 'open' | 'example' | 'apply' | 'suppression' | 'undo' | 'redo', text?: string, example?: CadEditorModelingExample, splitAxis?: CadEditorModelingSplitAxis, finishing?: Record<string, boolean>) {
    idle();
    if (kind === 'apply' && prepared) {
      if (prepared.reply.kind !== 'preview') throw Error('Use the current structural command to apply its preview.');
      return acceptPreview();
    }
    if ((kind === 'undo' || kind === 'redo') && state.accepted?.source === 'model') {
      if (Object.keys(state.drafts).length) throw Error('Apply or discard dimensions before Undo/Redo.');
      const target = index + (kind === 'undo' ? -1 : 1), text = history[target]?.text;
      if (!text) throw Error('This history direction is unavailable.');
      const current = JSON.parse(state.authoredText!), row = history[target];
      const expected = { ...current, parameters: row.parameters,
        nodes: current.nodes.map((node: Record<string, unknown>) => typeof node.name === 'string' && Object.hasOwn(row.suppression ?? {}, node.name)
          ? { ...node, suppressed: row.suppression![node.name] } : node) };
      // The existing fast path is safe only if its exact result is the recorded graph.
      if (canonicalModelingText(expected) !== text) return prepareSource(text, 'history', undefined, target, true);
    }
    if (clearPreview()) emit();
    if (kind === 'example') {
      if (example !== undefined && !['cut-chamfer', 'intersection', 'horizontal-split', 'two-chamfer', 'chamfer-split', 'derived-split', 'miter-split', 'configurable-finishes', 'mounting-plate', 'union-bracket', 'underside-pocket', 'top-entry-pocket', 'round-post', 'slotted-bracket', 'constrained-plate'].includes(example))
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
      if ((kind === 'undo' || kind === 'redo') && reply.summary.source === 'model' && reply.text !== history[target].text)
        throw Error('History result differs from the exact recorded source.');
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
      const display = prepareModelingScene(reply.display, aspect(), selectedOutput, state.viewOrientation);
      candidate = displayPort ? await displayPort.prepare(display) : null;
      if (operation !== epoch || state.disposed) { candidate?.dispose(); return; }
      let nextHistory = history, nextIndex = target;
      if (replacing || kind === 'apply' || kind === 'suppression') {
        nextHistory = replacing ? [] : history.slice(0, index + 1);
        nextHistory.push({ ...(reply.summary.source === 'model' ? { text: reply.text } : {}), parameters: clone(reply.summary.parameters),
          ...(reply.summary.suppression === undefined ? {} : { suppression: clone(reply.summary.suppression) }), bytes: new TextEncoder().encode(reply.text).length });
        while (nextHistory.length > 20 || nextHistory.reduce((sum, h) => sum + h.bytes, new TextEncoder().encode(reply.text).length) > HISTORY_BYTES) nextHistory.shift();
        nextIndex = nextHistory.length - 1;
      }
      const nextState: InternalSnapshot = { ...state, accepted: clone(reply.summary), authoredText: reply.text, display,
        drafts: {}, preview: null, faceSelection: null, selection: !replacing && state.selection !== null && state.selection < reply.summary.features.length ? state.selection : null,
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
  function currentPrepared(value: NonNullable<typeof prepared>): boolean {
    return value === prepared && worker === value.worker && value.generation === state.generation
      && value.text === state.authoredText && value.draftVersion === draftVersion && same(value.rawDrafts, state.drafts)
      && value.reply.binding.workerToken === workerToken && value.reply.binding.acceptedTaskToken === acceptedWorkerToken
      && value.reply.binding.expectedRevision === state.accepted?.revision;
  }
  async function preview(recover = false): Promise<void> {
    idle(); clearPreview();
    if (state.accepted?.source !== 'model' || !state.authoredText) throw Error('Preview currently supports primary models. Use Apply for legacy models.');
    if (!Object.keys(state.drafts).length) throw Error('Change a dimension before previewing.');
    const baseAccepted = state.accepted;
    const rawDrafts = clone(state.drafts), generation = state.generation, text = state.authoredText, version = draftVersion;
    let parameters: Record<string, number>;
    try { parameters = Object.fromEntries(Object.entries(rawDrafts).map(([name, raw]) => [name, scalar(raw)] as const).filter(([name, value]) => !Object.is(baseAccepted.parameters[name], value))); }
    catch (cause) { state = { ...state, preview: { status: 'error', parameters: {}, diagnostic: modelingDiagnostic(cause, 'input') }, error: cause instanceof Error ? cause.message : 'Invalid pending dimensions.' }; emit(); return; }
    if (!Object.keys(parameters).length) { state = { ...state, preview: { status: 'unchanged', parameters }, error: null }; emit(); return; }
    if (!ready && !recover) throw Error('Recover the accepted model explicitly before previewing.');
    if (displayPort && !displayPort.preparePreview) throw Error('This display does not support reversible previews. Apply remains available.');
    const expectedText = canonicalModelingText({ ...JSON.parse(text), parameters: { ...baseAccepted.parameters, ...parameters } });
    const expectedBytes = modelingSourceBytes(expectedText);
    modelingSourceBudget(history.map(row => row.bytes), modelingSourceBytes(text), [modelingSourceBytes(text), expectedBytes, expectedBytes]);
    const operation = ++epoch; let handle: PrismPreviewDisplayCandidate | null = null;
    state = { ...state, busy: true, error: null, preview: { status: 'computing', parameters } }; emit();
    let stage: ModelingDiagnostic['stage'] = 'transport';
    try {
      if (!ready) {
        const seed = await request({ kind: 'open', text, revision: baseAccepted.revision });
        if (operation !== epoch || state.disposed) return;
        if (!same(seed.summary, baseAccepted) || !same(JSON.parse(seed.text), JSON.parse(text))) throw Error('Reconstruction differs from the accepted model.');
        prepareModelingScene(seed.display, aspect(), state.display && 'selectedOutput' in state.display ? state.display.selectedOutput : undefined, state.viewOrientation);
        ready = true;
      }
      const reply = await request({ kind: 'prepare-preview', workerToken, acceptedTaskToken: acceptedWorkerToken,
        candidateToken: globalThis.crypto.randomUUID(), expectedRevision: baseAccepted.revision, parameters });
      if (operation !== epoch || state.disposed) return;
      stage = 'transport';
      if (reply.summary.source !== 'model' || reply.summary.documentId !== baseAccepted.documentId
        || reply.summary.revision !== baseAccepted.revision + 1 || !same(reply.summary.parameters, { ...baseAccepted.parameters, ...parameters })) throw Error('Stale or mismatched preview parameters.');
      const prior = JSON.parse(text), expected = { ...prior, parameters: { ...prior.parameters, ...parameters } };
      if (!same(JSON.parse(reply.text), expected)) throw Error('Preview changed immutable authored feature data.');
      const display = prepareModelingScene(reply.display, aspect(), state.display && 'selectedOutput' in state.display ? state.display.selectedOutput : undefined, state.viewOrientation);
      stage = 'display';
      handle = displayPort?.preparePreview ? await displayPort.preparePreview(display) : null;
      if (operation !== epoch || state.disposed) { handle?.dispose(); return; }
      if (!worker || generation !== state.generation || version !== draftVersion || text !== state.authoredText || !same(rawDrafts, state.drafts)) throw Error('Preview target changed.');
      handle?.show();
      prepared = { reply, expectedText, display, handle, worker, text, generation, rawDrafts, draftVersion: version }; handle = null;
      state = { ...state, busy: false, error: null, preview: { status: 'ready', parameters, outputs: clone(reply.summary.outputs) } }; emit();
    } catch (cause) {
      try { handle?.dispose(); } catch { /* Candidate cleanup cannot alter accepted state. */ }
      if (operation !== epoch || state.disposed) return;
      clearPreview();
      if (!ready) stop('Accepted-model preview recovery refused.');
      const diagnostic = cause instanceof ModelingRequestError && cause.diagnostic ? cause.diagnostic : modelingDiagnostic(cause, stage);
      state = { ...state, busy: false, error: diagnostic.message, preview: { status: 'error', parameters, diagnostic } }; emit();
    }
  }
  async function prepareSource(expectedText: string, operationKind: 'structure' | 'history', command?: ModelingStructureCommand, historyTarget?: number, recover = false): Promise<void> {
    idle();
    const accepted = state.accepted, text = state.authoredText;
    if (accepted?.source !== 'model' || !text || Object.keys(state.drafts).length)
      throw Error('Structural operations require an accepted primary model with no pending dimensions.');
    const expectedBytes = modelingSourceBytes(expectedText);
    if (canonicalModelingText(JSON.parse(expectedText)) !== expectedText) throw Error('Use exact canonical structural intent.');
    modelingSourceBudget(history.map(row => row.bytes), modelingSourceBytes(text), [modelingSourceBytes(text), expectedBytes, expectedBytes]);
    if (!ready && !recover) throw Error('Recover the accepted model explicitly before structural preview.');
    if (displayPort && !displayPort.preparePreview) throw Error('This display does not support reversible structural previews.');
    clearPreview();
    const operation = ++epoch, generation = state.generation, version = draftVersion;
    let handle: PrismPreviewDisplayCandidate | null = null, stage: ModelingDiagnostic['stage'] = 'transport';
    state = { ...state, busy: true, error: null, preview: { status: 'computing', operation: operationKind, parameters: {} } }; emit();
    try {
      if (!ready) {
        const seed = await request({ kind: 'open', text, revision: accepted.revision });
        if (operation !== epoch || state.disposed) return;
        if (!same(seed.summary, accepted) || seed.text !== text) throw Error('Reconstruction differs from the accepted model.');
        prepareModelingScene(seed.display, aspect(), state.display && 'selectedOutput' in state.display ? state.display.selectedOutput : undefined, state.viewOrientation);
        ready = true;
      }
      const reply = await request({ kind: 'prepare-source', workerToken, acceptedTaskToken: acceptedWorkerToken,
        candidateToken: globalThis.crypto.randomUUID(), expectedRevision: accepted.revision, baseText: text,
        operation: operationKind, text: expectedText, ...(command ? { command } : {}) });
      if (operation !== epoch || state.disposed) return;
      if (reply.operation !== operationKind || reply.text !== expectedText || reply.summary.source !== 'model'
        || reply.summary.documentId !== accepted.documentId || reply.summary.revision !== accepted.revision + 1)
        throw Error('Structural candidate differs from the exact target source.');
      modelingSourceBudget(history.map(row => row.bytes), modelingSourceBytes(text), [modelingSourceBytes(text), expectedBytes, modelingSourceBytes(reply.text)]);
      // Consumed names cannot select a different graph's reused native ID.
      const selectedOutput = reply.summary.outputs.some(output => output.name === 'part') ? 'part' : reply.summary.outputs[0]?.name;
      const display = prepareModelingScene(reply.display, aspect(), selectedOutput, state.viewOrientation);
      stage = 'display';
      handle = displayPort?.preparePreview ? await displayPort.preparePreview(display) : null;
      if (operation !== epoch || state.disposed) { handle?.dispose(); return; }
      if (!worker || generation !== state.generation || text !== state.authoredText || version !== draftVersion || Object.keys(state.drafts).length)
        throw Error('Structural target changed.');
      // History restores prepare off-screen and atomically promote; authoring previews are visible.
      if (operationKind === 'structure') handle?.show();
      prepared = { reply, expectedText, historyTarget, display, handle, worker, text, generation, rawDrafts: {}, draftVersion: version }; handle = null;
      state = { ...state, busy: false, error: null, preview: { status: 'ready', operation: operationKind, parameters: {}, outputs: clone(reply.summary.outputs) } };
      if (operationKind === 'history') await acceptPreview(); else emit();
    } catch (cause) {
      try { handle?.dispose(); } catch { /* Owned candidate cleanup preserves accepted authority. */ }
      if (operation !== epoch || state.disposed) return;
      clearPreview();
      if (!ready) stop('Accepted-model structural recovery refused.');
      const diagnostic = cause instanceof ModelingRequestError && cause.diagnostic ? cause.diagnostic : modelingDiagnostic(cause, stage);
      state = { ...state, busy: false, error: diagnostic.message, preview: { status: 'error', operation: operationKind, parameters: {}, diagnostic } }; emit();
    }
  }
  async function acceptPreview(): Promise<void> {
    const value = prepared;
    if (!value || !currentPrepared(value)) { clearPreview(); throw Error('Preview is stale. Preview the current dimensions again.'); }
    const reply = value.reply;
    // Prepare all source/history allocations before native acceptance can occur.
    const nextHistory = value.historyTarget === undefined ? history.slice(0, index + 1) : history.slice();
    if (value.historyTarget === undefined) {
      nextHistory.push({ ...(reply.summary.source === 'model' ? { text: reply.text } : {}), parameters: clone(reply.summary.parameters),
        ...(reply.summary.suppression === undefined ? {} : { suppression: clone(reply.summary.suppression) }), bytes: new TextEncoder().encode(reply.text).length });
      while (nextHistory.length > 20 || nextHistory.reduce((sum, row) => sum + row.bytes, new TextEncoder().encode(reply.text).length) > HISTORY_BYTES) nextHistory.shift();
    }
    const nextIndex = value.historyTarget ?? nextHistory.length - 1;
    modelingSourceBudget(nextHistory.map(row => row.bytes), new TextEncoder().encode(reply.text).length, [modelingSourceBytes(value.text), new TextEncoder().encode(reply.text).length, value.expectedText ? modelingSourceBytes(value.expectedText) : 0]);
    const nextState: InternalSnapshot = { ...state, accepted: clone(reply.summary), authoredText: reply.text, display: value.display,
      drafts: {}, preview: null, faceSelection: null, selection: reply.kind === 'source-preview' ? null : state.selection,
      generation: state.generation + 1, busy: false, error: null,
      history: { index: nextIndex, count: nextHistory.length, canUndo: nextIndex > 0, canRedo: nextIndex + 1 < nextHistory.length } };
    const operation = ++epoch;
    state = { ...state, busy: true, error: null }; emit();
    try {
      const ack = reply.kind === 'source-preview'
        ? await request({ kind: 'accept-source', binding: reply.binding, operation: reply.operation, text: value.expectedText! })
        : await request({ kind: 'accept-preview', binding: reply.binding, parameters: state.preview!.parameters });
      if (operation !== epoch || state.disposed) return;
      if (!currentPrepared(value) || !same(ack.binding, reply.binding)) throw Error('Preview acceptance is stale.');
      value.handle?.commit(); // Strong display guarantee: failures occur before its ownership swap.
      prepared = null; previewRequest = null; acceptedWorkerToken = reply.binding.previewTaskToken;
      history = nextHistory; index = nextIndex; state = nextState; draftVersion++; ready = true;
      try { value.handle?.dispose(); } catch { /* Post-promotion cleanup is not an acceptance failure. */ }
      emit();
    } catch (cause) {
      if (operation !== epoch || state.disposed) return;
      // Native acceptance may have happened even if its acknowledgement was lost.
      stop('Preview acceptance refused; recover the accepted model before continuing.');
      state = { ...state, busy: false, error: cause instanceof Error ? cause.message : 'Preview acceptance refused.', preview: null }; emit();
    }
  }
  return {
    getSnapshot: (): CadEditorModelingSnapshot => clone({ ...state, workerReady: ready }),
    setView(orientation: 'isometric' | 'top', generation: number) {
      idle();
      if ((orientation !== 'isometric' && orientation !== 'top') || generation !== state.generation || !state.accepted || !state.display)
        throw Error('Choose a current accepted model view.');
      if (prepared || previewRequest || state.preview?.status === 'ready' || state.preview?.status === 'computing')
        throw Error('Apply or cancel the preview before changing view. Choose Top before previewing.');
      if (orientation === state.viewOrientation) return;
      const display = prepareModelingScene(state.display.packet, aspect(), 'selectedOutput' in state.display ? state.display.selectedOutput : undefined, orientation);
      // Admission and the renderer's transactional update precede the logical
      // camera swap. This path sends no Worker request and creates no history.
      if (displayPort) {
        if (!displayPort.updateScene) throw Error('This display cannot update its model view.');
        displayPort.updateScene(display);
      }
      state = { ...state, display, viewOrientation: orientation, faceSelection: null }; emit();
    },
    preview,
    async previewStructure(command: ModelingStructureCommand, generation: number, recover = false) {
      idle();
      if (generation !== state.generation || !state.authoredText || !state.accepted) throw Error('The structural command is stale.');
      if (Object.keys(state.drafts).length) throw Error('Apply or cancel pending model dimensions before changing features.');
      const expected = buildModelingStructure(state.authoredText, state.accepted, command);
      return prepareSource(expected.text, 'structure', clone(command), undefined, recover);
    },
    async applyStructure(command: ModelingStructureCommand, generation: number) {
      idle();
      if (generation !== state.generation || !state.authoredText || !state.accepted || Object.keys(state.drafts).length)
        throw Error('The structural command is stale or dimensions are pending.');
      const expected = buildModelingStructure(state.authoredText, state.accepted, command);
      if (!prepared || prepared.reply.kind !== 'source-preview' || prepared.reply.operation !== 'structure'
        || prepared.expectedText !== expected.text || !currentPrepared(prepared)) throw Error('Preview the current structural command before Apply.');
      return acceptPreview();
    },
    clearPreview() { idle(); clearPreview(); emit(); },
    subscribe(listener: () => void) { live(); listeners.add(listener); return () => { listeners.delete(listener); }; },
    open: (text: string) => run('open', text), example: (example?: CadEditorModelingExample, splitAxis?: CadEditorModelingSplitAxis) => run('example', undefined, example, splitAxis), apply: () => run('apply'),
    configureFinishes: (suppression: Record<string, boolean>) => run('suppression', undefined, undefined, undefined, suppression), undo: () => run('undo'), redo: () => run('redo'),
    async exportStl(name: string, generation: number, recover = false): Promise<CadEditorStlExport | null> {
      idle();
      const accepted = state.accepted, output = accepted?.outputs.find(value => value.name === name);
      if (accepted?.source !== 'model' || !output || (output.family !== undefined && output.family !== 'convex-planar')
        || generation !== state.generation || typeof recover !== 'boolean') throw Error('Choose a current accepted convex output for STL.');
      if (Object.keys(state.drafts).length) throw Error('Apply or discard dimensions before exporting STL.');
      if (!ready && !recover) throw Error('Recover the accepted model explicitly before exporting STL.');
      const operation = ++epoch;
      state = { ...state, busy: true, error: null }; emit();
      try {
        if (!ready) {
          const seed = await request({ kind: 'open', text: state.authoredText!, revision: accepted.revision });
          if (operation !== epoch || state.disposed) return null;
          if (!same(seed.summary, accepted) || !same(JSON.parse(seed.text), JSON.parse(state.authoredText!)))
            throw Error('Reconstruction differs from the accepted model.');
          // Admit every recovered output without preparing/committing a renderer replacement.
          prepareModelingScene(seed.display, aspect(), state.display && 'selectedOutput' in state.display ? state.display.selectedOutput : undefined, state.viewOrientation);
          ready = true;
        }
        const reply = await request({ kind: 'export-stl', expectedRevision: accepted.revision,
          acceptedTaskToken: acceptedWorkerToken, outputName: name, solidId: output.solidId });
        if (operation !== epoch || state.disposed) return null;
        state = { ...state, busy: false, error: null }; emit();
        return operation === epoch && !state.disposed ? reply.export : null;
      } catch (cause) {
        if (operation !== epoch || state.disposed) return null;
        // A failed reconstruction must not make an unaccepted native session reusable.
        if (!ready) stop('Accepted-model recovery refused.');
        state = { ...state, busy: false, error: cause instanceof Error ? cause.message : 'STL export refused.' }; emit();
        return null;
      }
    },
    async viewOutput(name: string, generation: number) {
      idle();
      if (!state.display || state.display.packet.profile !== 'model-body-faces' || !('selectedOutput' in state.display)
        || generation !== state.generation || !state.accepted?.outputs.some(output => output.name === name))
        throw new Error('Choose a current named output body.');
      if (state.display.selectedOutput === name) return;
      clearPreview();
      const operation = ++epoch, packet = state.display.packet;
      let candidate: PrismDisplayCandidate | null = null;
      state = { ...state, busy: true, error: null }; emit();
      try {
        const display = prepareModelingScene(packet, aspect(), name, state.viewOrientation);
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
      clearPreview(); draftVersion++;
      state = { ...state, drafts: { ...state.drafts, [name]: raw }, error: null }; emit();
    },
    discard() { idle(); clearPreview(); draftVersion++; state = { ...state, drafts: {}, error: null }; emit(); },
    select(feature: number, generation: number) {
      idle(); if (generation !== state.generation || !state.accepted?.features.some(f => f.index === feature)) throw new Error('Feature selection is stale.');
      if (prepared?.reply.kind === 'source-preview') clearPreview();
      state = { ...state, selection: feature }; emit();
    },
    pick(width: number, height: number, x: number, y: number, generation: number) {
      idle(); if (prepared) throw Error('Apply or cancel the preview before selecting a face.');
      if (!state.display || generation !== state.generation) throw new Error('Display selection is stale.');
      const picked = pickModelingScene(state.display, width, height, x, y);
      state = { ...state, faceSelection: picked ? { ...picked, generation } : null }; emit();
    },
    cancel() { live(); ++epoch; stop('Cancelled.'); state = { ...state, busy: false, error: null }; emit(); },
    dispose() { if (state.disposed) return; ++epoch; stop('Disposed.'); state = { ...state, busy: false, disposed: true }; emit(); listeners.clear(); },
  };
}
export type CadEditorModelingController = ReturnType<typeof createCadEditorModelingController>;
